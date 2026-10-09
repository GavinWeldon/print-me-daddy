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
  // Used in later phases, stored now so the settings file shape is stable.
  sourceFolders: string[]
  printerName: string | null
  quickMode: boolean
  quickModePageLimit: number
  firstRunComplete: boolean
}

export interface ChatMessage {
  id: string
  from: 'user' | 'host'
  text: string
  ts: number
}

export interface ChatState {
  messages: ChatMessage[]
  hostState: HostState
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

  openMain(opts?: { settings?: boolean }): void
  onOpenSettings(cb: () => void): () => void
  quickHide(): void
  quickResize(height: number): void
  onQuickShown(cb: () => void): () => void
}
