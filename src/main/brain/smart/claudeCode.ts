import { execFile, spawn } from 'child_process'
import { existsSync, mkdirSync, readFileSync } from 'fs'
import { homedir, tmpdir } from 'os'
import { dirname, join } from 'path'
import { applyOptions } from '../../../shared/options'
import type { SmartStatus } from '../../../shared/types'
import type { SmartPlan, SmartProvider, SmartRequest } from './provider'

// The smart path through Claude Code, run headless ("claude -p").
// It uses whichever Claude account is signed in on THIS PC (never the developer's),
// gets no tools (it can only read what we send and answer), and must reply in a
// strict JSON shape, which is checked again here before anything is used.

const TIMEOUT_MS = 90_000

/** The answer shape Claude must follow (passed with --json-schema). */
const PLAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['files', 'settings', 'merge', 'reply', 'unsure'],
  properties: {
    files: { type: 'array', items: { type: 'integer' }, description: 'Candidate ids to print, in print order. Empty if nothing fits.' },
    settings: {
      type: 'object',
      additionalProperties: false,
      description: 'Only settings the person explicitly asked for; leave the rest out.',
      properties: {
        copies: { type: 'integer', minimum: 1, maximum: 99 },
        color: { enum: ['color', 'mono'] },
        duplex: { enum: ['off', 'long', 'short'] },
        pages: { type: 'string', description: 'Page ranges like "1-3,5" applied to each file' },
        pagesPerSheet: { enum: [1, 2, 4, 6, 9] }
      }
    },
    merge: { type: 'boolean', description: 'True if they want everything combined into one PDF.' },
    reply: { type: 'string', description: 'One or two short sentences, in character.' },
    unsure: { type: 'boolean', description: 'True if the request was ambiguous or some files might be wrong.' }
  }
}

function systemPrompt(hostName: string): string {
  return `You are the planning brain of "Print Me Daddy", a Windows app that prints documents. You speak as ${hostName}, the app's host: confident, flirty, cheeky, funny, always helpful, never explicit.

You get a print request and a numbered list of candidate files (name | folder | last modified | start of first page). Decide exactly which files to print and in what order. Rules:
- Only use ids from the list. Never invent files.
- Follow the order the person asked for. For "all X", sort naturally (2 before 10).
- For pairing requests (e.g. "with the solution after each one") match each item to its partner by number/topic and interleave them; skip partners that don't exist and say so.
- Leave out files they didn't ask for (e.g. solutions, old versions, drafts) unless requested. Prefer the latest version when versions differ by year/number.
- settings: include only what they explicitly asked for (copies, colour vs black and white, double-sided, page ranges, pages per sheet).
- merge: true only if they asked for one PDF / combined / merged.
- reply: 1-2 short sentences as ${hostName}, describing the plan (e.g. "Here's what I've lined up…"). The person reviews it before anything prints, so never say it's printing, sent or merged already. No markdown.
- If nothing fits, return an empty files list and say so in the reply. Set unsure when you had to guess.`
}

function userPrompt(req: SmartRequest): string {
  const lines = req.candidates.map((c) => `#${c.id} | ${c.name} | ${c.folder} | ${c.modified}${c.text ? ` | "${c.text}"` : ''}`)
  return `Today is ${new Date().toDateString()}.

Candidate files:
${lines.join('\n')}

Request: ${req.request}`
}

/** Checks the answer has the right shape and only refers to real candidates. */
export function validatePlan(raw: unknown, candidateCount: number): SmartPlan {
  if (!raw || typeof raw !== 'object') throw new Error('the answer was empty')
  const r = raw as Record<string, unknown>
  if (!Array.isArray(r.files)) throw new Error('the answer had no file list')
  const files = r.files.filter((id): id is number => Number.isInteger(id) && (id as number) >= 0 && (id as number) < candidateCount).slice(0, 200)
  if (files.length !== r.files.length) throw new Error('the answer mentioned files that don’t exist')
  const settings = applyOptions({}, (typeof r.settings === 'object' && r.settings) || {})
  const reply = typeof r.reply === 'string' ? r.reply.replace(/\s+/g, ' ').trim().slice(0, 400) : ''
  return { files, settings, merge: r.merge === true, reply, unsure: r.unsure === true }
}

/** Where claude.exe lives on this PC, if anywhere. Looks it up fresh on each machine. */
function findClaude(): Promise<string | null> {
  return new Promise((resolve) => {
    execFile('where.exe', ['claude'], { windowsHide: true }, (_err, stdout) => {
      const found = stdout
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
      const candidates: string[] = []
      for (const path of found) {
        const lower = path.toLowerCase()
        if (lower.endsWith('.exe')) candidates.push(path)
        else if (lower.endsWith('.cmd')) {
          // npm installs a small .cmd that launches the real claude.exe; read where it points.
          try {
            const target = readFileSync(path, 'utf8').match(/"([^"]*claude\.exe)"/i)?.[1]
            if (target) candidates.push(target.replace(/%~?dp0%?\\?/gi, dirname(path) + '\\'))
          } catch {
            // unreadable: ignore
          }
          candidates.push(join(dirname(path), 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe'))
        }
      }
      // The native installer's usual home.
      candidates.push(join(homedir(), '.local', 'bin', 'claude.exe'))
      resolve(candidates.find((c) => existsSync(c)) ?? null)
    })
  })
}

export class ClaudeCodeProvider implements SmartProvider {
  readonly name = 'Claude Code'
  private cached: { at: number; status: SmartStatus; exe: string | null } | null = null
  private readonly workDir = join(tmpdir(), 'print-me-daddy-brain')

  async status(refresh = false): Promise<SmartStatus> {
    if (!refresh && this.cached && Date.now() - this.cached.at < 60_000) return this.cached.status
    const exe = await findClaude()
    let status: SmartStatus
    if (!exe) status = { available: false, provider: this.name, reason: 'not-installed' }
    else {
      const auth = await new Promise<Record<string, unknown> | null>((resolve) => {
        execFile(exe, ['auth', 'status'], { windowsHide: true, timeout: 20_000 }, (_err, stdout) => {
          try {
            resolve(JSON.parse(stdout))
          } catch {
            resolve(null)
          }
        })
      })
      if (!auth) status = { available: false, provider: this.name, reason: 'not-working' }
      else if (!auth.loggedIn) status = { available: false, provider: this.name, reason: 'signed-out' }
      else
        status = {
          available: true,
          provider: this.name,
          account: typeof auth.email === 'string' ? auth.email : undefined,
          plan: typeof auth.subscriptionType === 'string' ? auth.subscriptionType : undefined
        }
    }
    this.cached = { at: Date.now(), status, exe }
    return status
  }

  async plan(req: SmartRequest): Promise<SmartPlan> {
    const status = await this.status()
    const exe = this.cached?.exe
    if (!status.available || !exe) throw new Error('smart mode isn’t available on this PC')
    mkdirSync(this.workDir, { recursive: true })

    const args = [
      '-p',
      '--output-format', 'json',
      '--json-schema', JSON.stringify(PLAN_SCHEMA),
      '--system-prompt', systemPrompt(req.hostName),
      '--tools', '', // no tools: it can only read what we send and answer
      '--no-session-persistence', // don't clutter the person's Claude history
      '--setting-sources', '', // ignore personal Claude settings, hooks and plugins
      '--strict-mcp-config',
      '--disable-slash-commands'
    ]

    const stdout = await new Promise<string>((resolve, reject) => {
      // No shell: arguments go straight to claude.exe, so nothing in them can be misread as a command.
      const child = spawn(exe, args, { cwd: this.workDir, windowsHide: true })
      let out = ''
      let err = ''
      const timer = setTimeout(() => {
        child.kill()
        reject(new Error('it took too long to answer'))
      }, TIMEOUT_MS)
      child.stdout.on('data', (d) => (out += d))
      child.stderr.on('data', (d) => (err += d))
      child.on('error', (e) => {
        clearTimeout(timer)
        reject(e)
      })
      child.on('close', (code) => {
        clearTimeout(timer)
        if (out.trim()) resolve(out)
        else reject(new Error(err.split('\n')[0] || `Claude Code stopped (code ${code})`))
      })
      child.stdin.end(userPrompt(req)) // the request goes in through stdin, not the command line
    })

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(stdout)
    } catch {
      throw new Error('the answer wasn’t readable')
    }
    if (parsed.is_error) {
      const message = String(parsed.result ?? 'unknown problem')
      if (/log ?in|auth|oauth/i.test(message)) this.cached = null // signed out: check again next time
      throw new Error(message.slice(0, 160))
    }
    let structured = parsed.structured_output
    // Fallback: some versions only put the JSON in "result".
    if (!structured && typeof parsed.result === 'string') {
      const text = parsed.result.replace(/^```(?:json)?|```$/g, '').trim()
      try {
        structured = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1))
      } catch {
        structured = null
      }
    }
    return validatePlan(structured, req.candidates.length)
  }
}
