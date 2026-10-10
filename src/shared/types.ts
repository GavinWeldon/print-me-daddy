// Shapes of data shared between the behind-the-scenes (main) part of the app
// and the screen (renderer). Keeping them in one place stops the two drifting.

export type HostState = 'idle' | 'thinking' | 'printing' | 'error'
export const HOST_STATES: HostState[] = ['idle', 'thinking', 'printing', 'error']

export interface Settings {
  /** The host character's name. */
  hostName: string
  /** Global shortcut, in Electron "accelerator" format, e.g. "Control+Shift+P". */
  hotkey: string
  startWithWindows: boolean
  /** Chosen printer, or null to use the Windows default printer. */
  printerName: string | null
  // Used in later phases, stored now so the settings file shape is stable.
  sourceFolders: string[]
  quickMode: boolean
  quickModePageLimit: number
  firstRunComplete: boolean
}

export interface ChatMessage {
  id: string
  from: 'user' | 'host'
  text: string
  ts: number
  /** Set when this message carries a print job card. */
  jobId?: string
}

export interface ChatState {
  messages: ChatMessage[]
  hostState: HostState
  jobs: Record<string, PrintJob>
}

// ---------- Printing ----------

export interface PrinterInfo {
  name: string
  isDefault: boolean
}

export interface PrintOptions {
  copies: number
  color: 'color' | 'mono'
  duplex: 'off' | 'long' | 'short'
  /** Page ranges like "1-3,5". Empty means all pages. */
  pages: string
}

export const DEFAULT_PRINT_OPTIONS: PrintOptions = { copies: 1, color: 'color', duplex: 'off', pages: '' }

export interface JobFile {
  id: string
  path: string
  name: string
  /** Page count, or null if it couldn't be read. */
  pages: number | null
  included: boolean
  /** Why this file can't be printed, if it can't. */
  problem?: string
}

export type JobStatus = 'draft' | 'printing' | 'done' | 'failed' | 'cancelled'

export interface PrintJob {
  id: string
  files: JobFile[]
  /** Printer for this job, or null for the Windows default. */
  printerName: string | null
  options: PrintOptions
  status: JobStatus
  /** e.g. "Sending 2 of 3…" while printing. */
  progress?: string
  error?: string
}

export interface JobPatch {
  /** New order of file ids. */
  order?: string[]
  /** Tick or untick files. */
  included?: Record<string, boolean>
  printerName?: string | null
  options?: Partial<PrintOptions>
}

export interface PrintResult {
  ok: boolean
  /** Set when the job is big and needs a second "yes, really". */
  needsConfirm?: number
  error?: string
}

export interface SettingsUpdateResult {
  ok: boolean
  settings: Settings
  error?: string
}

export interface AppInfo {
  version: string
  isPackaged: boolean
  hotkeyActive: boolean
}

export type Avatars = Partial<Record<HostState, string>>

/** Everything the screen is allowed to ask the main process for. */
export interface PmdApi {
  getSettings(): Promise<Settings>
  updateSettings(patch: Partial<Settings>): Promise<SettingsUpdateResult>
  onSettingsChanged(cb: (s: Settings) => void): () => void

  getAvatars(): Promise<Avatars>
  getAppInfo(): Promise<AppInfo>

  getChat(): Promise<ChatState>
  sendMessage(text: string): Promise<void>
  filesDropped(paths: string[]): Promise<void>
  onChatChanged(cb: (s: ChatState) => void): () => void

  getPathForFile(file: File): string

  listPrinters(refresh?: boolean): Promise<PrinterInfo[]>
  updateJob(jobId: string, patch: JobPatch): Promise<void>
  printJob(jobId: string, confirmed?: boolean): Promise<PrintResult>
  cancelJob(jobId: string): Promise<void>
  printTestPage(printerName: string | null): Promise<PrintResult>

  openMain(opts?: { settings?: boolean }): void
  onOpenSettings(cb: () => void): () => void
  quickHide(): void
  quickResize(height: number): void
  onQuickShown(cb: () => void): () => void
}
