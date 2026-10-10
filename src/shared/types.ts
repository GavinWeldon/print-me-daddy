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
  /** Folders whose files Paige can find by name. */
  sourceFolders: string[]
  /** What every new print job starts with (typed requests can still override them). */
  printDefaults: PrintDefaults
  /** Use the smart path (Claude Code on this PC) for requests the fast path can't handle. */
  smartMode: boolean
  /** Small, confident typed requests print straight away without a job card. */
  quickMode: boolean
  quickModePageLimit: number
  /** Bumped when a default changes in a way old settings files need adjusting for. */
  settingsVersion?: number
  // Used in later phases, stored now so the settings file shape is stable.
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
  /** Pages shrunk onto each side of paper. */
  pagesPerSheet: 1 | 2 | 4 | 6 | 9
  /** Paper name as the printer knows it (e.g. "A4"); empty means the printer's own default. */
  paperSize: string
  /** shrink: only shrink pages that are too big; fit: always fill the page; noscale: actual size. */
  scale: 'shrink' | 'fit' | 'noscale'
  orientation: 'auto' | 'portrait' | 'landscape'
  /** The printer's own settings for this job only, e.g. { "psk:PageOutputQuality": "psk:High" }. */
  printerFeatures: Record<string, string>
}

/** The settings a new job starts with (everything except page ranges, which are per job). */
export type PrintDefaults = Omit<PrintOptions, 'pages'>

export const PAGES_PER_SHEET = [1, 2, 4, 6, 9] as const

export const DEFAULT_PRINT_OPTIONS: PrintOptions = {
  copies: 1,
  color: 'color',
  duplex: 'off',
  pages: '',
  pagesPerSheet: 1,
  paperSize: '',
  scale: 'shrink',
  orientation: 'auto',
  printerFeatures: {}
}

export interface JobFile {
  id: string
  path: string
  name: string
  /** Page count, or null if it couldn't be read. */
  pages: number | null
  included: boolean
  /** Why this file can't be printed, if it can't. */
  problem?: string
  /** A note from Paige, e.g. that this was her best guess for something you typed. */
  note?: string
  /** Where it lives, e.g. "Uni/Mechanics/Tutorials". */
  folder?: string
  /** Other files that could be what you meant (offered as "Swap for…"). */
  alternatives?: FileHit[]
}

/** A file from the user's folders, as shown in search results. */
export interface FileHit {
  path: string
  name: string
  folder: string
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
  /** Quick-mode jobs show as a small status line instead of a full card. */
  compact?: boolean
}

/** One of the printer's own settings (quality, paper type…), read from Windows. */
export interface PrinterFeature {
  /** Internal name, e.g. "psk:PageOutputQuality". */
  name: string
  label: string
  /** Everyday settings shown first. */
  common: boolean
  /** Currently chosen option name ('' if unknown). */
  current: string
  options: { name: string; label: string }[]
}

// ---------- Smart mode ----------

export interface SmartStatus {
  available: boolean
  provider: string
  /** The account signed in on THIS PC. */
  account?: string
  plan?: string
  reason?: 'not-installed' | 'signed-out' | 'not-working'
}

// ---------- Folder index ----------

export interface IndexStatus {
  folders: number
  files: number
  /** Still walking folders or reading PDF text. */
  busy: boolean
  /** PDFs whose first page still needs reading. */
  pendingText: number
}

export interface JobPatch {
  /** New order of file ids. */
  order?: string[]
  /** Tick or untick files. */
  included?: Record<string, boolean>
  printerName?: string | null
  options?: Partial<PrintOptions>
  /** Add files (by path) to the end of the list. */
  add?: string[]
  /** Swap one file for another. */
  replace?: { fileId: string; path: string }
  /** Take a file off the list. */
  remove?: string
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
  /** Opens a Windows file picker for documents; returns the chosen files (empty if cancelled). */
  pickFiles(): Promise<string[]>

  listPrinters(refresh?: boolean): Promise<PrinterInfo[]>
  updateJob(jobId: string, patch: JobPatch): Promise<void>
  /** Paige found files for a typed request: show the confirmation pop-up for this job. */
  onConfirmJob(cb: (jobId: string) => void): () => void
  searchFiles(query: string): Promise<FileHit[]>
  printJob(jobId: string, confirmed?: boolean): Promise<PrintResult>
  cancelJob(jobId: string): Promise<void>
  printTestPage(printerName: string | null): Promise<PrintResult>
  /** Paper sizes the printer supports (empty if unknown). */
  getPaperSizes(printerName: string | null): Promise<string[]>
  /** Opens one of Windows' own windows for a printer. */
  openPrinterWindow(printerName: string | null, which: 'preferences' | 'properties' | 'queue'): Promise<void>
  /** The printer's own changeable settings. */
  getPrinterFeatures(printerName: string | null, refresh?: boolean): Promise<{ printer: string; features: PrinterFeature[] } | { error: string }>
  /** Saves one of the printer's own settings; returns the option it kept. */
  setPrinterFeature(printerName: string | null, feature: string, option: string): Promise<{ ok: boolean; kept?: string; error?: string }>
  /** A printer's own settings changed (from the panel, Paige, or a job). */
  onPrinterFeaturesChanged(cb: (printer: string) => void): () => void

  /** Opens a folder picker; returns the chosen folders (empty if cancelled). */
  getSmartStatus(refresh?: boolean): Promise<SmartStatus>
  pickFolders(): Promise<string[]>
  getIndexStatus(): Promise<IndexStatus>
  onIndexStatus(cb: (s: IndexStatus) => void): () => void

  openMain(opts?: { settings?: boolean }): void
  onOpenSettings(cb: () => void): () => void
  /** The window was closed to the tray (the loading screen plays when it reopens). */
  onWindowClosed(cb: () => void): () => void
  isWindowOpen(): Promise<boolean>
  quickHide(): void
  quickResize(height: number): void
  onQuickShown(cb: () => void): () => void
}
