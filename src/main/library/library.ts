import { app } from 'electron'
import { EventEmitter } from 'events'
import { existsSync, readFileSync, watch, type FSWatcher } from 'fs'
import { readdir, readFile, rename, stat, writeFile } from 'fs/promises'
import { basename, dirname, extname, join, relative } from 'path'
import { kindOf, type FileKind } from '../print/documents'
import type { IndexStatus } from '../../shared/types'

/** One printable file found in the user's folders. */
export interface LibraryFile {
  path: string
  name: string
  /** Name without the extension, e.g. "Tutorial 3". */
  stem: string
  /** Folder path inside the chosen root, e.g. "Uni/Mechanics of Machines". */
  folder: string
  kind: Exclude<FileKind, 'unsupported'>
  size: number
  mtime: number
  /** Text from the first page (PDFs only). */
  text?: string
  /** mtime the text was read at, so it's re-read when the file changes. */
  textMtime?: number
}

const SKIP_DIRS = new Set(['node_modules', '$recycle.bin', 'system volume information', 'appdata', '.git', '__pycache__'])
const MAX_FILES = 50_000
const MAX_DEPTH = 12
const TEXT_LIMIT = 2000
const TEXT_MAX_BYTES = 40 * 1024 * 1024

/**
 * The index of the user's documents: walks the chosen folders, remembers every
 * PDF / picture / Office file, reads the first page of PDFs in the background,
 * and keeps itself up to date as files change. Saved to disk so start-up is instant.
 */
export class Library extends EventEmitter {
  private files = new Map<string, LibraryFile>()
  private folders: string[] = []
  private watchers: FSWatcher[] = []
  private scanning = false
  private rescanQueued = false
  private reading = false
  private rescanTimer: NodeJS.Timeout | null = null
  private saveTimer: NodeJS.Timeout | null = null
  private readonly cacheFile = join(app.getPath('userData'), 'library.json')

  constructor() {
    super()
    try {
      if (existsSync(this.cacheFile)) {
        for (const f of JSON.parse(readFileSync(this.cacheFile, 'utf8')) as LibraryFile[]) this.files.set(f.path, f)
      }
    } catch {
      // A damaged cache just means a fresh scan.
    }
  }

  list(): LibraryFile[] {
    return [...this.files.values()]
  }

  status(): IndexStatus {
    const pendingText = this.list().filter((f) => f.kind === 'pdf' && f.textMtime !== f.mtime && f.size <= TEXT_MAX_BYTES).length
    return { folders: this.folders.length, files: this.files.size, busy: this.scanning || pendingText > 0, pendingText }
  }

  /** Start (or restart) indexing these folders. */
  setFolders(folders: string[]): void {
    this.folders = [...folders]
    for (const w of this.watchers) w.close()
    this.watchers = []
    for (const root of this.folders) {
      try {
        // Windows can watch a whole folder tree in one go.
        const w = watch(root, { recursive: true }, () => this.scheduleRescan())
        w.on('error', () => {})
        this.watchers.push(w)
      } catch {
        // Folder missing or not watchable: the scan below will simply find nothing there.
      }
    }
    void this.scan()
  }

  private scheduleRescan(): void {
    if (this.rescanTimer) clearTimeout(this.rescanTimer)
    this.rescanTimer = setTimeout(() => void this.scan(), 1500)
  }

  private emitStatus(): void {
    this.emit('status', this.status())
  }

  /** Walks every folder; cheap to repeat because unchanged files keep their saved details. */
  async scan(): Promise<void> {
    if (this.scanning) {
      this.rescanQueued = true
      return
    }
    this.scanning = true
    this.emitStatus()
    const seen = new Map<string, LibraryFile>()
    try {
      for (const root of this.folders) await this.walk(root, root, 0, seen)
    } finally {
      this.files = seen
      this.scanning = false
      this.scheduleSave()
      this.emitStatus()
    }
    if (this.rescanQueued) {
      this.rescanQueued = false
      return this.scan()
    }
    void this.readTexts()
  }

  private async walk(root: string, dir: string, depth: number, seen: Map<string, LibraryFile>): Promise<void> {
    if (depth > MAX_DEPTH || seen.size >= MAX_FILES) return
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return // no permission, or it vanished
    }
    for (const entry of entries) {
      if (seen.size >= MAX_FILES) return
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        const lower = entry.name.toLowerCase()
        if (lower.startsWith('.') || lower.startsWith('$') || SKIP_DIRS.has(lower)) continue
        await this.walk(root, full, depth + 1, seen)
      } else if (entry.isFile()) {
        if (entry.name.startsWith('~$')) continue // Office lock files
        const kind = kindOf(full)
        if (kind === 'unsupported') continue
        let info
        try {
          info = await stat(full)
        } catch {
          continue
        }
        const old = this.files.get(full)
        const mtime = Math.round(info.mtimeMs)
        seen.set(full, {
          path: full,
          name: entry.name,
          stem: basename(entry.name, extname(entry.name)),
          folder: relative(root, dirname(full)).split('\\').join('/') || basename(root),
          kind,
          size: info.size,
          mtime,
          // Keep text we've already read if the file hasn't changed.
          ...(old && old.mtime === mtime && old.text !== undefined ? { text: old.text, textMtime: old.textMtime } : {})
        })
      }
    }
  }

  /** Reads the first page of each new or changed PDF, one at a time so the app stays snappy. */
  private async readTexts(): Promise<void> {
    if (this.reading) return
    this.reading = true
    try {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
      let sinceStatus = 0
      for (;;) {
        const next = this.list().find((f) => f.kind === 'pdf' && f.textMtime !== f.mtime && f.size <= TEXT_MAX_BYTES)
        if (!next || this.scanning) break
        let text = ''
        try {
          const task = pdfjs.getDocument({ data: new Uint8Array(await readFile(next.path)), verbosity: 0 })
          try {
            const doc = await task.promise
            const content = await (await doc.getPage(1)).getTextContent()
            text = content.items
              .map((i) => ('str' in i ? i.str : ''))
              .join(' ')
              .replace(/\s+/g, ' ')
              .trim()
              .slice(0, TEXT_LIMIT)
          } finally {
            await task.destroy()
          }
        } catch {
          // Password-protected or damaged: just no text.
        }
        const current = this.files.get(next.path)
        if (current && current.mtime === next.mtime) this.files.set(next.path, { ...current, text, textMtime: next.mtime })
        if (++sinceStatus >= 10) {
          sinceStatus = 0
          this.emitStatus()
          this.scheduleSave()
        }
        await new Promise((r) => setImmediate(r))
      }
    } catch {
      // PDF reader unavailable: names and folders still work.
    } finally {
      this.reading = false
      this.scheduleSave()
      this.emitStatus()
    }
  }

  private scheduleSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => void this.save(), 2000)
  }

  private async save(): Promise<void> {
    const tmp = this.cacheFile + '.tmp'
    await writeFile(tmp, JSON.stringify(this.list()))
    await rename(tmp, this.cacheFile)
  }
}
