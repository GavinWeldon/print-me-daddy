import type { Chat } from '../chat'
import type { SettingsStore } from '../settings'
import type { Library, LibraryFile } from '../library/library'
import type { PrintDesk } from '../print/desk'
import { jobPageTotal } from '../print/runner'
import * as host from '../host/personality'
import { DEFAULT_PRINT_OPTIONS, type FileHit, type PrintJob, type PrintOptions } from '../../shared/types'
import { parseRequest, rankFiles, resolveChunk, type ChunkResult, type ParsedRequest } from './fastPath'
import type { SmartCandidate, SmartProvider } from './smart/provider'
import { resolvePrinter } from '../print/printers'
import { readPrinterFeatures, writePrinterFeatures } from '../print/capabilities'
import { describePrinterFeatures } from '../../shared/printerWords'

const MAX_CANDIDATES = 120

/**
 * Handles typed requests. The fast path (no AI) goes first; anything it can't handle
 * confidently goes to the smart provider (Claude Code on this PC) if it's available.
 * Either way, the person confirms in a pop-up before anything prints.
 */
export class Assistant {
  constructor(
    private readonly chat: Chat,
    private readonly desk: PrintDesk,
    private readonly library: Library,
    private readonly settings: SettingsStore,
    private readonly smart: SmartProvider,
    /** Opens the confirmation pop-up for a job. */
    private readonly confirm: (jobId: string) => void
  ) {}

  async handle(text: string): Promise<void> {
    const request = parseRequest(text)
    const s = this.settings.get()
    if (request.settingsCommand && request.options.printerFeatures) return this.changePrinterSettings(request.options.printerFeatures)
    if (request.asksPrinterSettings) return this.describePrinterSettings()
    if (!request.isPrint) return this.say(host.chitChat())
    if (!s.sourceFolders.length) return this.say(host.needFolders())

    const files = this.library.list()
    if (!files.length) return this.say(this.library.status().busy ? host.stillIndexing() : host.needFolders())
    if (!request.chunks.length && !request.tooComplex) return this.say(host.nothingMentioned())

    const results = request.tooComplex ? [] : request.chunks.map((chunk) => resolveChunk(chunk, files))
    const missing = results.filter((r) => !r.files.length).map((r) => r.chunk)
    const found = results.filter((r) => r.files.length)
    const fastPathSure = !request.tooComplex && found.length > 0 && !missing.length && found.every((r) => r.confident)

    if (fastPathSure) return this.fromFastPath(request, found, [])

    // The fast path isn't sure: ask the smart brain, if we can.
    const status = s.smartMode ? await this.smart.status() : null
    if (status?.available) {
      this.say(host.smartThinking())
      try {
        const shortlist = this.candidates(text, request, files)
        const plan = await this.smart.plan({ request: text, hostName: s.hostName, candidates: shortlist.map((c) => c.candidate) })
        return await this.fromSmartPlan(request, plan, shortlist.map((c) => c.file))
      } catch (e) {
        this.say(host.smartFailed(e instanceof Error ? e.message : String(e)))
      }
    } else if (request.tooComplex || !found.length) {
      // Nothing the fast path can offer, and no smart brain to ask.
      return this.say(host.smartUnavailable(s.smartMode ? status?.reason : undefined))
    }

    // Fall back to the fast path's best guesses.
    if (!found.length) return this.say(host.notFound(missing))
    return this.fromFastPath(request, found, missing)
  }

  // ---------- Fast path ----------

  private async fromFastPath(request: ParsedRequest, found: ChunkResult[], missing: string[]): Promise<void> {
    if (missing.length) this.say(host.notFound(missing))
    if (request.wantsMerge) this.say(host.mergeLater())
    const hit = (f: LibraryFile): FileHit => ({ path: f.path, name: f.name, folder: f.folder })
    const jobFiles = await this.desk.prepareFiles(
      found.flatMap((r) =>
        r.files.map((file) => ({
          path: file.path,
          folder: file.folder,
          note: r.confident ? undefined : `Best guess for “${r.chunk}”`,
          alternatives: r.confident ? undefined : r.alternatives.map(hit)
        }))
      )
    )
    const allConfident = found.every((r) => r.confident) && !missing.length
    await this.offer(jobFiles, request.options, (names, settingsText) => host.planReady(names, settingsText, !allConfident), allConfident && !request.wantsMerge)
  }

  // ---------- Smart path ----------

  /** The files most likely to matter, so the brain gets a short list instead of the whole drive. */
  private candidates(text: string, request: ParsedRequest, files: LibraryFile[]): { candidate: SmartCandidate; file: LibraryFile }[] {
    const picked = new Map<string, LibraryFile>()
    for (const m of rankFiles(request.body || text, files).slice(0, 80)) picked.set(m.file.path, m.file)
    for (const chunk of request.chunks) for (const m of rankFiles(chunk, files).slice(0, 15)) picked.set(m.file.path, m.file)
    // Words like "tutorials" or "invoices" can name a folder: include what's in matching folders.
    const words = (request.body || text).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3)
    for (const f of files) {
      if (picked.size >= MAX_CANDIDATES) break
      if (words.some((w) => f.folder.toLowerCase().includes(w.replace(/s$/, '')))) picked.set(f.path, f)
    }
    // Too few? Add the most recently changed files, for "the thing I printed yesterday" requests.
    if (picked.size < 30) for (const f of [...files].sort((a, b) => b.mtime - a.mtime).slice(0, 40)) picked.set(f.path, f)

    return [...picked.values()].slice(0, MAX_CANDIDATES).map((file, id) => ({
      file,
      candidate: {
        id,
        name: file.name,
        folder: file.folder,
        modified: new Date(file.mtime).toISOString().slice(0, 10),
        text: file.text ? file.text.slice(0, 160) : undefined
      }
    }))
  }

  private async fromSmartPlan(request: ParsedRequest, plan: Awaited<ReturnType<SmartProvider['plan']>>, candidates: LibraryFile[]): Promise<void> {
    if (!plan.files.length) return this.say(plan.reply || host.notFound([request.body]))
    const jobFiles = await this.desk.prepareFiles(
      plan.files.map((id) => {
        const file = candidates[id]
        return { path: file.path, folder: file.folder, note: plan.unsure ? 'Picked by smart mode, double-check' : undefined }
      })
    )
    // What the fast path read from the words counts too; the brain's settings win if they differ.
    const options = { ...request.options, ...plan.settings }
    await this.offer(jobFiles, options, (names, settingsText) => plan.reply || host.planReady(names, settingsText, plan.unsure), false)
    if (plan.merge || request.wantsMerge) this.say(host.mergeLater())
  }

  // ---------- "Switch to standard quality" ----------

  /** Changes the printer's own settings from now on (same as Printer panel / Printing preferences). */
  private async changePrinterSettings(wanted: Record<string, string>): Promise<void> {
    const target = await resolvePrinter(this.settings.get().printerName)
    if ('error' in target) return this.say(host.printerSettingsFailed(target.error))
    try {
      const features = await readPrinterFeatures(target.name, true)
      const supported = Object.fromEntries(
        Object.entries(wanted).filter(([name, option]) => features.find((f) => f.name === name)?.options.some((o) => o.name === option))
      )
      if (!Object.keys(supported).length) return this.say(host.printerSettingsFailed(`${target.name} doesn't have that setting.`))
      const kept = await writePrinterFeatures(target.name, supported)
      const applied = Object.fromEntries(Object.entries(supported).filter(([name, option]) => kept[name] === option))
      if (!Object.keys(applied).length) return this.say(host.printerSettingsFailed(`${target.name} wouldn't accept that combination.`))
      this.say(host.printerSettingsChanged(describePrinterFeatures(applied), target.name))
    } catch (e) {
      this.say(host.printerSettingsFailed(e instanceof Error ? e.message : String(e)))
    }
  }

  private async describePrinterSettings(): Promise<void> {
    const target = await resolvePrinter(this.settings.get().printerName)
    if ('error' in target) return this.say(target.error)
    try {
      const features = (await readPrinterFeatures(target.name)).filter((f) => f.common)
      const lines = features.map((f) => `${f.label}: ${f.options.find((o) => o.name === f.current)?.label ?? 'not set'}`)
      this.say(host.printerSettingsNow(target.name, lines))
    } catch (e) {
      this.say(host.printerSettingsFailed(e instanceof Error ? e.message : String(e)))
    }
  }

  // ---------- Shared ----------

  /** Creates the job and either prints it straight away (quick mode) or opens the confirmation pop-up. */
  private async offer(
    jobFiles: Awaited<ReturnType<PrintDesk['prepareFiles']>>,
    requested: Partial<PrintOptions>,
    message: (names: string[], settingsText: string) => string,
    quickAllowed: boolean
  ): Promise<void> {
    const s = this.settings.get()
    const options = { ...DEFAULT_PRINT_OPTIONS, ...s.printDefaults, ...requested }
    const names = jobFiles.map((f) => f.name)
    const settingsText = host.describeOptions(options)
    const total = jobPageTotal({ files: jobFiles, options } as PrintJob)
    const quick = quickAllowed && s.quickMode && jobFiles.every((f) => !f.problem) && total <= s.quickModePageLimit
    if (quick) {
      const job = this.desk.createJob(jobFiles, requested, host.quickPrint(names, settingsText))
      await this.desk.print(job.id, false)
    } else {
      const job = this.desk.createJob(jobFiles, requested, message(names, settingsText))
      this.confirm(job.id)
    }
  }

  private say(text: string): void {
    this.chat.add('host', text)
  }
}
