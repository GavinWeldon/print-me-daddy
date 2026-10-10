// The fast path: understands simple print requests with no AI at all.
// "print my CV twice, double-sided" / "print x, then y, then z in that order in black and white"
import type { PrintOptions } from '../../shared/types'
import { BORDERLESS, QUALITY, QUALITY_OPTIONS } from '../../shared/printerWords'
import type { LibraryFile } from '../library/library'

export interface ParsedRequest {
  isPrint: boolean
  /** The things to print, in the order they were asked for. */
  chunks: string[]
  options: Partial<PrintOptions>
  /** Asked for everything in one PDF (merging arrives in a later phase). */
  wantsMerge: boolean
  /** Needs real understanding (pairing, "after each", vague descriptions): a job for the smart path. */
  tooComplex: boolean
  /** The request with the "print" verb and settings words taken out. */
  body: string
  /** "switch to standard quality" etc.: change the printer's settings from now on (no files). */
  settingsCommand: boolean
  /** "what quality are you on?" */
  asksPrinterSettings: boolean
}

const COMPLEX = /\b(?:after|before|between)\s+(?:each|every)\b|\beach\s+one\b|\bwith\s+(?:the|its|their)\s+\w+\s+(?:after|before|next)\b|\bpair(?:ed)?\b|\bmatching\b|\bcorresponding\b|\bthe\s+one\s+(?:about|with|where|that)\b|\bsomething\b|\bwhichever\b/

const NUMBER_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 }
const toNumber = (w: string) => NUMBER_WORDS[w] ?? parseInt(w, 10)

/** Pulls settings words out of the text, returning what's left. */
function takeSettings(text: string): { rest: string; options: Partial<PrintOptions>; wantsMerge: boolean } {
  const options: Partial<PrintOptions> = {}
  let wantsMerge = false
  let t = ` ${text} `
  const take = (re: RegExp, fn: (m: RegExpMatchArray) => void) => {
    const m = t.match(re)
    if (m) {
      fn(m)
      t = t.replace(re, ' ')
    }
  }

  const feature = (name: string, option: string) => (options.printerFeatures = { ...(options.printerFeatures ?? {}), [name]: option })
  take(/\b(?:in\s+|at\s+|on\s+)?(?:high|highest|best|top|max(?:imum)?|photo|fine)[\s-]+quality\b|\bhigh[\s-]?res\b|\bhq\b/, () => feature(QUALITY, QUALITY_OPTIONS.high))
  take(/\b(?:in\s+|at\s+|on\s+)?(?:standard|normal|regular|medium)[\s-]+quality\b/, () => feature(QUALITY, QUALITY_OPTIONS.normal))
  take(/\b(?:in\s+|at\s+|on\s+)?(?:draft|fast|quick|economy|eco|low(?:est)?)[\s-]+(?:quality|mode)\b|\b(?:in\s+|at\s+|on\s+)?(?:draft|ink[\s-]?sav(?:er|ing))(?:\s+mode)?\b/, () =>
    feature(QUALITY, QUALITY_OPTIONS.draft)
  )
  take(/\b(?:quality\s+(?:to\s+)?)(high|standard|normal|draft)\b/, (m) =>
    feature(QUALITY, m[1] === 'high' ? QUALITY_OPTIONS.high : m[1] === 'draft' ? QUALITY_OPTIONS.draft : QUALITY_OPTIONS.normal)
  )
  take(/\b(?:with\s+)?(?:borderless|no\s+borders?|edge[\s-]to[\s-]edge|full[\s-]bleed)\b/, () => feature(BORDERLESS, 'psk:Borderless'))
  take(/\b(?:in\s+)?(?:black\s*(?:and|&|n)\s*white|b\s*&\s*w|b\/w|greyscale|grayscale|monochrome|mono)\b/, () => (options.color = 'mono'))
  take(/\b(?:in\s+)?(?:full\s+)?colou?r(?:ed)?\b/, () => (options.color ??= 'color'))
  take(/\b(?:double|two|2)[\s-]?sided\b(?:\s*,?\s*(?:flip(?:ped)?\s+on\s+)?(?:the\s+)?short\s+edge)?|\bboth\s+sides\b|\bduplex\b/, (m) =>
    (options.duplex = /short/.test(m[0]) ? 'short' : 'long')
  )
  take(/\b(?:single|one)[\s-]?sided\b|\bsimplex\b/, () => (options.duplex = 'off'))
  take(/\btwice\b/, () => (options.copies = 2))
  take(/\bthrice\b/, () => (options.copies = 3))
  take(/\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:copies|copy|times|x)\b/, (m) => (options.copies = toNumber(m[1])))
  take(/\bx\s*(\d{1,2})\b/, (m) => (options.copies = parseInt(m[1], 10)))
  take(/\b(\d|two|four|six|nine)\s*(?:pages?\s*)?(?:per|a|to\s+a|on\s+(?:one|each|a))\s*(?:sheet|side)\b|\b(\d)[\s-]?up\b/, (m) => {
    const n = toNumber(m[1] ?? m[2])
    if ([2, 4, 6, 9].includes(n)) options.pagesPerSheet = n as PrintOptions['pagesPerSheet']
  })
  take(/\b(?:(?:just|only)\s+)?(?:the\s+)?(?:first|1st)\s+page(?:\s+only)?\b/, () => (options.pages = '1'))
  take(/\bpages?\s+(\d+(?:\s*(?:-|–|to)\s*\d+)?(?:\s*(?:,|and|&)\s*\d+(?:\s*(?:-|–|to)\s*\d+)?)*)/, (m) => {
    options.pages = m[1]
      .replace(/\s*(?:–|to)\s*/g, '-')
      .replace(/\s*(?:and|&)\s*/g, ',')
      .replace(/\s+/g, '')
  })
  take(/\b(?:as|into|in)\s+(?:one|a\s+single|a|1)\s+(?:pdf|file|document)\b|\bmerge[ds]?\b|\bcombine[ds]?\b/, () => (wantsMerge = true))
  take(/\bin\s+(?:that|this|the\s+same|the\s+right)\s+order\b|\bin\s+order\b/, () => {})
  return { rest: t.trim(), options, wantsMerge }
}

/** Reads a typed request into the things to print and the settings to use. */
export function parseRequest(raw: string): ParsedRequest {
  const text = raw
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
  const isPrint = /\bprint(?:s|ing)?\b(?!\s+(?:quality|settings?|mode|preferences?))|\bprint\s*out\b/.test(text)
  const { rest, options, wantsMerge } = takeSettings(text)

  const body = rest
    .replace(/^(?:(?:hey|hi|ok|okay)\s+\w+[,!]?\s*)?/, '')
    .replace(/^(?:please\s+)?(?:(?:can|could|would|will)\s+you\s+)?(?:please\s+)?(?:print(?:\s+out)?|printout)\s*(?:off\s+|out\s+)?:?\s*/, '')
    .replace(/\b(?:please|pls|for me|thanks|thank you|asap|now)\b/g, ' ')
    .replace(/[.!?]+$/, '')
    .trim()

  // Strong separators keep their order: "x, then y; followed by z".
  const chunks = body
    .split(/\s*(?:,|;|\band\s+then\b|\bthen\b|\bfollowed\s+by\b|\bafter\s+that\b|\bnext\b)\s*/)
    .map((c) => c.replace(/^(?:and|&)\s+/, '').replace(/\s+(?:in|at|on|with|as|using)$/, '').trim())
    .filter((c) => c && !/^(?:and|&|the|my|it|them)$/.test(c))

  const settingsCommand =
    !isPrint && !!options.printerFeatures && /\b(?:set|change|switch|make|put|use|turn|go|always)\b|\bfrom now on\b|\bby default\b/.test(text)
  const asksPrinterSettings = !isPrint && !settingsCommand && /\b(?:what|which|current|tell me)\b.*\b(?:quality|settings?|paper|borderless|ink)\b/.test(text)
  return { isPrint, chunks, options, wantsMerge, tooComplex: COMPLEX.test(body), body, settingsCommand, asksPrinterSettings }
}

// ---------- Matching names to files ----------

const STOPWORDS = new Set(['my', 'the', 'a', 'an', 'of', 'for', 'file', 'files', 'document', 'documents', 'doc', 'docs', 'pdf', 'copy', 'version', 'latest', 'new', 'that', 'this', 'one', 'please', 'from', 'in'])
const SYNONYMS: Record<string, string[]> = {
  cv: ['resume', 'curriculum'],
  resume: ['cv'],
  sol: ['solution'],
  soln: ['solution'],
  sols: ['solution'],
  answers: ['solution'],
  answer: ['solution'],
  hw: ['homework'],
  tut: ['tutorial'],
  lec: ['lecture'],
  assn: ['assignment']
}

/** Lowercase words, with letters and numbers split apart ("tut3" → "tut", "3") and simple plurals removed. */
export function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/([a-z])(\d)|(\d)([a-z])/g, '$1$3 $2$4')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w))
}

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = tmp
    }
  }
  return row[b.length]
}

/** How well one typed word matches one word from a file (0–1). Numbers must match exactly. */
function wordSimilarity(q: string, w: string): number {
  if (q === w) return 1
  const qNum = /^\d+$/.test(q)
  const wNum = /^\d+$/.test(w)
  if (qNum || wNum) return qNum && wNum && parseInt(q, 10) === parseInt(w, 10) ? 1 : 0
  if (SYNONYMS[q]?.includes(w)) return 0.95
  if (q.length >= 3 && w.startsWith(q)) return 0.9 // "tut" → "tutorial"
  if (w.length >= 3 && q.startsWith(w)) return 0.85
  if (Math.min(q.length, w.length) < 4) return 0
  const ratio = 1 - editDistance(q, w) / Math.max(q.length, w.length)
  return ratio >= 0.75 ? ratio * 0.9 : 0 // small typos
}

export interface Match {
  file: LibraryFile
  score: number
}

/** Scores every file against what was typed; best first. */
export function rankFiles(query: string, files: LibraryFile[]): Match[] {
  const q = tokens(query).filter((w) => !STOPWORDS.has(w))
  if (!q.length) return []
  const qPhrase = q.join(' ')
  const newest = Math.max(1, ...files.map((f) => f.mtime))

  const scored: Match[] = []
  for (const file of files) {
    const name = tokens(file.stem)
    const folder = tokens(file.folder)
    const text = file.text ? tokens(file.text.slice(0, 600)) : []
    let total = 0
    const used = new Set<string>()
    for (const word of q) {
      let best = 0
      for (const w of name) {
        const s = wordSimilarity(word, w)
        if (s > best) best = s
        if (s >= 0.85) used.add(w)
      }
      for (const w of folder) best = Math.max(best, wordSimilarity(word, w) * 0.8)
      if (best < 0.6) for (const w of text) best = Math.max(best, wordSimilarity(word, w) * 0.55)
      total += best
    }
    const coverage = total / q.length
    if (coverage < 0.35) continue
    // Prefer names that are mostly what you typed ("CV.pdf" over "CV cover letter template.pdf").
    const precision = name.length ? Math.min(1, used.size / name.length) : 0
    let score = 0.75 * coverage + 0.25 * precision
    if (name.join(' ').includes(qPhrase)) score += 0.06
    score += 0.02 * (file.mtime / newest) // newer wins a tie
    // Not capped at 1: bonuses still need to separate two near-perfect matches.
    scored.push({ file, score })
  }
  return scored.sort((a, b) => b.score - a.score)
}

/** Sorts names the way people expect: "Tutorial 2" before "Tutorial 10". */
export const naturalCompare = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })

export interface ChunkResult {
  chunk: string
  /** Files chosen for this chunk (several for "all ..."). */
  files: LibraryFile[]
  confident: boolean
  /** Other likely files, for a "did you mean" hint. */
  alternatives: LibraryFile[]
}

const CONFIDENT = 0.74
const CLEAR_LEAD = 0.07
const POSSIBLE = 0.5

/** Words that mark a variant of a document; "all tutorials" shouldn't sweep these in unless asked. */
const VARIANT_WORDS = ['solution', 'answer', 'memo', 'marking', 'scheme', 'draft', 'old', 'backup', 'copy']

/** Same name apart from numbers you didn't type (a year, a version): treat as versions of one document. */
function onlyNumbersDiffer(a: LibraryFile, b: LibraryFile, query: string): boolean {
  const typed = new Set(tokens(query))
  const words = (f: LibraryFile) => tokens(f.stem).filter((w) => !/^\d+$/.test(w) || typed.has(w)).join(' ')
  return words(a) === words(b)
}

/** Finds the file(s) for one chunk of a request. */
export function resolveChunk(chunk: string, library: LibraryFile[]): ChunkResult {
  const all = chunk.match(/^(?:all|every|each)\s+(?:of\s+)?(?:the\s+|my\s+)?(.+)$/)
  if (all) {
    const asked = new Set(tokens(all[1]))
    const matches = rankFiles(all[1], library)
      .filter((m) => m.score >= CONFIDENT - 0.04)
      .filter((m) => !tokens(m.file.stem).some((w) => VARIANT_WORDS.includes(w) && !asked.has(w)))
    const files = matches.map((m) => m.file).sort((a, b) => naturalCompare(a.stem, b.stem))
    return { chunk, files, confident: files.length > 0, alternatives: [] }
  }

  let ranked = rankFiles(chunk, library)
  // "x and y" might be two files rather than one name with "and" in it.
  const parts = chunk.split(/\s+(?:and|&|plus)\s+/)
  if (parts.length > 1 && (ranked[0]?.score ?? 0) < CONFIDENT) {
    const split = parts.map((p) => resolveChunk(p, library))
    if (split.every((r) => r.files.length)) {
      return { chunk, files: split.flatMap((r) => r.files), confident: split.every((r) => r.confident), alternatives: [] }
    }
  }

  // The same file saved in two places counts as one match.
  ranked = ranked.filter((m, i) => ranked.findIndex((o) => o.file.name === m.file.name && o.file.size === m.file.size) === i)
  if (!ranked[0] || ranked[0].score < POSSIBLE) return { chunk, files: [], confident: false, alternatives: ranked.slice(0, 3).map((m) => m.file) }

  // Versions of the same document (e.g. "CV 2024" / "CV 2026", "Report v2" / "Report v3"):
  // pick the highest number in the name, then the most recently changed.
  const versions = ranked.filter((m) => ranked[0].score - m.score < CLEAR_LEAD && onlyNumbersDiffer(ranked[0].file, m.file, chunk))
  if (versions.length > 1) {
    const latest = versions.reduce((a, b) => (compareVersions(b.file, a.file) > 0 ? b : a))
    ranked = [latest, ...ranked.filter((m) => m !== latest)]
  }
  const [best, second] = ranked
  const confident =
    best.score >= CONFIDENT - (versions.length > 1 ? CLEAR_LEAD : 0) &&
    (!second || versions.length > 1 || best.score - second.score >= CLEAR_LEAD)
  return { chunk, files: [best.file], confident, alternatives: ranked.slice(1, 4).map((m) => m.file) }
}

/** Positive if `a` looks like a later version than `b`: bigger numbers in the name first, then newer file. */
function compareVersions(a: LibraryFile, b: LibraryFile): number {
  const nums = (f: LibraryFile) => tokens(f.stem).filter((w) => /^\d+$/.test(w)).map(Number)
  const [na, nb] = [nums(a), nums(b)]
  for (let i = 0; i < Math.max(na.length, nb.length); i++) {
    if ((na[i] ?? -1) !== (nb[i] ?? -1)) return (na[i] ?? -1) - (nb[i] ?? -1)
  }
  return a.mtime - b.mtime
}
