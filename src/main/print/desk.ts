import { app } from 'electron'
import { randomUUID } from 'crypto'
import { rmSync } from 'fs'
import { basename, dirname } from 'path'
import type { Chat } from '../chat'
import type { SettingsStore } from '../settings'
import * as host from '../host/personality'
import { DEFAULT_PRINT_OPTIONS, type FileHit, type JobFile, type JobPatch, type PrintJob, type PrintOptions, type PrintResult } from '../../shared/types'
import { countPages, kindOf } from './documents'
import { applyOptions } from '../../shared/options'
import { resolvePrinter } from './printers'
import { CancelledError, jobPageTotal, PAGE_RANGES, printFile, removeFromQueue, runJob } from './runner'
import { makeTestPage } from './testPage'
import { applyForOneJob } from './capabilities'

/** Jobs bigger than this (pages × copies) need a second "yes, really". */
const BIG_JOB = 200

/** Turns a raw error into one short sentence Paige can say. */
function friendly(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  if (/ENOENT/.test(msg)) return 'the print helper (SumatraPDF) is missing.'
  if (/No such file/i.test(msg)) return 'that file has moved or been deleted.'
  const first = msg.split('\n').find((l) => l.trim()) ?? 'something went wrong.'
  return first.length > 140 ? first.slice(0, 137) + '...' : first
}

/** The print desk: turns dropped files into job cards, and prints, cancels and test-prints. */
export class PrintDesk {
  private cancelRequested = new Set<string>()
  private running = new Map<string, { printer: string; sent: string[]; since: Date }>()

  /** Looks up a file's folder in the index, for nicer labels (set by the main process). */
  folderOf?: (path: string) => string | undefined

  constructor(
    private readonly chat: Chat,
    private readonly settings: SettingsStore
  ) {}

  /** Turns paths into job files with page counts; files that can't print are marked with the reason. */
  async prepareFiles(items: { path: string; note?: string; folder?: string; alternatives?: FileHit[] }[]): Promise<JobFile[]> {
    const files: JobFile[] = items.map(({ path, note, folder, alternatives }) => {
      const kind = kindOf(path)
      const problem =
        kind === 'office'
          ? 'Word, PowerPoint and Excel printing arrives in a later update.'
          : kind === 'unsupported'
            ? 'I can’t print this kind of file.'
            : undefined
      return { id: randomUUID(), path, name: basename(path), pages: null, included: !problem, problem, note, folder: folder ?? basename(dirname(path)), alternatives }
    })
    await Promise.all(
      files.map(async (f) => {
        if (f.problem) return
        f.pages = await countPages(f.path)
        if (f.pages === null) {
          f.problem = 'Couldn’t open this PDF. It may be damaged or password-protected.'
          f.included = false
        }
      })
    )
    return files
  }

  /** Adds a job to the chat under Paige's message. Compact jobs show as a one-line status. */
  createJob(files: JobFile[], options: Partial<PrintOptions>, message: string, compact = false): PrintJob {
    const job: PrintJob = {
      id: randomUUID(),
      files,
      printerName: this.settings.get().printerName,
      // Your default print settings first, then anything the request asked for.
      options: { ...DEFAULT_PRINT_OPTIONS, ...this.settings.get().printDefaults, ...options },
      status: 'draft',
      compact
    }
    this.chat.add('host', message, job)
    return job
  }

  /** Files dropped on the window become a job card (Office and unknown files get a friendly note). */
  async filesDropped(paths: string[]): Promise<void> {
    const office = paths.filter((p) => kindOf(p) === 'office').map((p) => basename(p))
    const unknown = paths.filter((p) => kindOf(p) === 'unsupported').map((p) => basename(p))
    const printable = paths.filter((p) => kindOf(p) === 'pdf' || kindOf(p) === 'image')

    this.chat.setHostState('thinking')
    const files = await this.prepareFiles(printable.map((path) => ({ path })))
    if (office.length) this.chat.add('host', host.officeLater(office))
    if (unknown.length) this.chat.add('host', host.unsupported(unknown))
    if (files.length) {
      const draft = { files, options: { ...DEFAULT_PRINT_OPTIONS } } as PrintJob
      this.createJob(files, {}, host.jobReady(files.length, jobPageTotal(draft)))
    }
    this.chat.setHostState('idle')
  }

  /** Changes from the job card or pop-up: order, ticks, swaps, additions, printer, settings. */
  async update(id: string, patch: JobPatch): Promise<void> {
    const current = this.chat.job(id)
    if (!current || current.status === 'printing') return
    // Files being swapped in or added need their page counts first.
    const swapIn = patch.replace?.path ? (await this.prepareFiles([{ path: patch.replace.path, folder: this.folderOf?.(patch.replace.path) }]))[0] : null
    const added = Array.isArray(patch.add) ? await this.prepareFiles(patch.add.filter((p) => typeof p === 'string').map((path) => ({ path, folder: this.folderOf?.(path) }))) : []

    this.chat.updateJob(id, (job) => {
      if (job.status === 'printing') return job
      let files = job.files
      if (swapIn && patch.replace) files = files.map((f) => (f.id === patch.replace!.fileId ? swapIn : f))
      if (typeof patch.remove === 'string') files = files.filter((f) => f.id !== patch.remove)
      if (added.length) files = [...files, ...added]
      if (Array.isArray(patch.order) && patch.order.length === files.length) {
        const byId = new Map(files.map((f) => [f.id, f]))
        const reordered = patch.order.map((fid) => byId.get(fid)).filter((f): f is JobFile => !!f)
        if (reordered.length === files.length) files = reordered
      }
      if (patch.included) {
        files = files.map((f) => (f.id in patch.included! && !f.problem ? { ...f, included: !!patch.included![f.id] } : f))
      }
      const o = applyOptions(job.options, patch.options)
      const printerName = patch.printerName === null || typeof patch.printerName === 'string' ? patch.printerName : job.printerName
      // Editing a finished job turns it back into a draft you can print again.
      return { ...job, files, options: o, printerName, status: 'draft', error: undefined, progress: undefined }
    })
  }

  async print(id: string, confirmed: boolean): Promise<PrintResult> {
    const job = this.chat.job(id)
    if (!job) return { ok: false, error: 'That job has gone.' }
    if (job.status === 'printing') return { ok: false, error: 'It’s already printing.' }
    if (job.options.pages.trim() && !PAGE_RANGES.test(job.options.pages)) {
      return { ok: false, error: 'Pages should look like "1-3, 5". Leave it empty for all pages.' }
    }
    if (!job.files.some((f) => f.included && !f.problem)) return { ok: false, error: 'Tick at least one file.' }

    const total = jobPageTotal(job)
    if (total > BIG_JOB && !confirmed) return { ok: false, needsConfirm: total }

    const target = await resolvePrinter(job.printerName)
    if ('error' in target) {
      this.chat.updateJob(id, (j) => ({ ...j, status: 'failed', error: target.error }))
      return { ok: false, error: target.error }
    }

    const printer = target.name
    const run = { printer, sent: [] as string[], since: new Date() }
    this.running.set(id, run)
    this.cancelRequested.delete(id)
    this.chat.updateJob(id, (j) => ({ ...j, status: 'printing', error: undefined, progress: 'Getting ready…' }))
    this.chat.setHostState('printing')
    this.chat.add('host', host.printing(printer))

    // The job's own printer settings (e.g. high quality) apply for this job only, then go back.
    let restore: () => Promise<void> = async () => {}
    try {
      if (Object.keys(job.options.printerFeatures).length) {
        this.chat.updateJob(id, (j) => ({ ...j, progress: 'Setting up the printer…' }))
        restore = await applyForOneJob(printer, job.options.printerFeatures).catch(() => async () => {})
      }
      await runJob(job, printer, (progress) => this.chat.updateJob(id, (j) => ({ ...j, progress })), () => this.cancelRequested.has(id), run.sent)
      if (this.cancelRequested.has(id)) throw new CancelledError()
      this.chat.updateJob(id, (j) => ({ ...j, status: 'done', progress: undefined }))
      this.chat.add('host', host.printed(total, printer))
      this.chat.setHostState('idle')
      return { ok: true }
    } catch (e) {
      if (e instanceof CancelledError || this.cancelRequested.has(id)) {
        this.chat.updateJob(id, (j) => ({ ...j, status: 'cancelled', progress: undefined }))
        this.chat.add('host', host.cancelled())
        this.chat.setHostState('idle')
        return { ok: true }
      }
      const reason = friendly(e)
      this.chat.updateJob(id, (j) => ({ ...j, status: 'failed', progress: undefined, error: reason }))
      this.chat.add('host', host.printFailed(reason))
      this.showError()
      return { ok: false, error: reason }
    } finally {
      await restore()
      this.running.delete(id)
      this.cancelRequested.delete(id)
    }
  }

  /** Stops a job: no more files are sent, and anything already in the Windows queue is pulled back. */
  async cancel(id: string): Promise<void> {
    const job = this.chat.job(id)
    if (!job) return
    if (job.status !== 'printing') {
      this.chat.updateJob(id, (j) => ({ ...j, status: 'cancelled', progress: undefined }))
      return
    }
    this.cancelRequested.add(id)
    this.chat.updateJob(id, (j) => ({ ...j, progress: 'Cancelling…' }))
    const run = this.running.get(id)
    if (run) await removeFromQueue(run.printer, run.sent, run.since)
  }

  async testPage(printerName: string | null): Promise<PrintResult> {
    const target = await resolvePrinter(printerName)
    if ('error' in target) return { ok: false, error: target.error }
    let file: string | null = null
    try {
      this.chat.setHostState('printing')
      file = await makeTestPage(target.name, this.settings.get().hostName, app.getVersion())
      await printFile(file, target.name)
      this.chat.add('host', host.testPageSent(target.name))
      this.chat.setHostState('idle')
      return { ok: true }
    } catch (e) {
      const reason = friendly(e)
      this.chat.add('host', host.printFailed(reason))
      this.showError()
      return { ok: false, error: reason }
    } finally {
      if (file) rmSync(file, { force: true })
    }
  }

  private showError(): void {
    this.chat.setHostState('error')
    setTimeout(() => {
      if (this.chat.get().hostState === 'error') this.chat.setHostState('idle')
    }, 4000)
  }
}
