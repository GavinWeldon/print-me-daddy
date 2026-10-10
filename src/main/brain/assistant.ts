import type { Chat } from '../chat'
import type { SettingsStore } from '../settings'
import type { Library } from '../library/library'
import type { PrintDesk } from '../print/desk'
import { jobPageTotal } from '../print/runner'
import * as host from '../host/personality'
import { DEFAULT_PRINT_OPTIONS, type FileHit, type PrintJob } from '../../shared/types'
import { parseRequest, resolveChunk } from './fastPath'

/**
 * Handles typed requests. Today that's the fast path (no AI); Phase 4 adds the
 * smart path behind this same class for anything the fast path can't handle.
 */
export class Assistant {
  constructor(
    private readonly chat: Chat,
    private readonly desk: PrintDesk,
    private readonly library: Library,
    private readonly settings: SettingsStore,
    /** Opens the confirmation pop-up for a job. */
    private readonly confirm: (jobId: string) => void
  ) {}

  async handle(text: string): Promise<void> {
    const request = parseRequest(text)
    const s = this.settings.get()
    if (!request.isPrint) return this.say(host.chitChat())
    if (request.tooComplex) return this.say(host.tooComplex())
    if (!s.sourceFolders.length) return this.say(host.needFolders())

    const files = this.library.list()
    if (!files.length) return this.say(this.library.status().busy ? host.stillIndexing() : host.needFolders())
    if (!request.chunks.length) return this.say(host.nothingMentioned())

    const results = request.chunks.map((chunk) => resolveChunk(chunk, files))
    const missing = results.filter((r) => !r.files.length).map((r) => r.chunk)
    const found = results.filter((r) => r.files.length)
    if (!found.length) return this.say(host.notFound(missing))
    if (missing.length) this.say(host.notFound(missing))
    if (request.wantsMerge) this.say(host.mergeLater())

    const hit = (f: { path: string; name: string; folder: string }): FileHit => ({ path: f.path, name: f.name, folder: f.folder })
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

    const options = { ...DEFAULT_PRINT_OPTIONS, ...request.options }
    const names = jobFiles.map((f) => f.name)
    const settingsText = host.describeOptions(options)
    const allConfident = found.every((r) => r.confident) && !missing.length
    const total = jobPageTotal({ files: jobFiles, options } as PrintJob)
    const quick =
      s.quickMode && allConfident && !request.wantsMerge && jobFiles.every((f) => !f.problem) && total <= s.quickModePageLimit

    if (quick) {
      const job = this.desk.createJob(jobFiles, options, host.quickPrint(names, settingsText))
      await this.desk.print(job.id, false)
    } else {
      const job = this.desk.createJob(jobFiles, options, host.planReady(names, settingsText, !allConfident))
      this.confirm(job.id)
    }
  }

  private say(text: string): void {
    this.chat.add('host', text)
  }
}
