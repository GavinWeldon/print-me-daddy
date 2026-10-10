import { app, BrowserWindow, globalShortcut, ipcMain, Menu, nativeImage, screen, shell, Tray } from 'electron'
import { join } from 'path'
import { SettingsStore } from './settings'
import { Chat } from './chat'
import { loadAvatars } from './avatars'
import * as host from './host/personality'
import { prettyHotkey } from '../shared/hotkey'
import { PrintDesk } from './print/desk'
import { listPrinters } from './print/printers'
import { cleanScratch } from './print/documents'
import { HOST_STATES, type HostState, type JobPatch, type Settings, type SettingsUpdateResult } from '../shared/types'

// Where artwork lives: the project's assets folder while developing,
// or the installed app's resources folder once packaged.
const assetsDir = app.isPackaged ? join(process.resourcesPath, 'assets') : join(app.getAppPath(), 'assets')
const preloadPath = join(__dirname, '../preload/index.js')
const QUICK_WIDTH = 680

// Started by Windows at login? Then stay quietly in the tray.
const startHidden = process.argv.includes('--hidden')

let settings: SettingsStore
let chat: Chat
let desk: PrintDesk
let mainWindow: BrowserWindow | null = null
let quickWindow: BrowserWindow | null = null
let tray: Tray | null = null
let quitting = false
let hotkeyActive = false
let shownTrayHint = false

// Only ever run one copy. Opening it again just brings the window forward.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => showMain())
  app.whenReady().then(start)
}

function start(): void {
  app.setAppUserModelId('com.gavweldon.printmedaddy')
  settings = new SettingsStore()
  chat = new Chat((state) => broadcast('chat:changed', state))
  desk = new PrintDesk(chat, settings)
  cleanScratch()
  listPrinters().catch(() => {}) // warm up the printer list in the background

  registerIpc()
  createMainWindow()
  createQuickWindow()
  createTray()

  const s = settings.get()
  chat.add('host', host.greeting(s.hostName))
  hotkeyActive = registerHotkey(s.hotkey)
  if (!hotkeyActive) chat.add('host', host.hotkeyTaken(prettyHotkey(s.hotkey)))
  applyStartWithWindows(s.startWithWindows)
}

app.on('before-quit', () => (quitting = true))
app.on('will-quit', () => globalShortcut.unregisterAll())
// Closing windows doesn't quit: the app lives in the tray until "Quit" is chosen.
app.on('window-all-closed', () => {})

// ---------- Windows ----------

function loadScreen(win: BrowserWindow, hash = ''): void {
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (!app.isPackaged && devUrl) win.loadURL(hash ? `${devUrl}#${hash}` : devUrl)
  else win.loadFile(join(__dirname, '../renderer/index.html'), { hash })
}

function lockDown(win: BrowserWindow): void {
  // Links open in the real browser; the app window never navigates away
  // (that also stops a dropped file from replacing the chat screen).
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e) => e.preventDefault())
}

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1040,
    height: 720,
    minWidth: 760,
    minHeight: 520,
    show: false,
    title: 'Print Me Daddy',
    backgroundColor: '#0f0d12',
    icon: join(assetsDir, 'icon', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: { preload: preloadPath, sandbox: true, contextIsolation: true }
  })
  lockDown(mainWindow)
  mainWindow.once('ready-to-show', () => {
    if (!startHidden) mainWindow?.show()
  })
  mainWindow.on('close', (e) => {
    if (quitting) return
    e.preventDefault()
    mainWindow?.hide()
    // Get the loading screen ready for next time the window opens.
    mainWindow?.webContents.send('ui:closed')
    if (!shownTrayHint) {
      shownTrayHint = true
      const s = settings.get()
      tray?.displayBalloon({
        title: 'Still here 💋',
        content: host.trayHint(s.hostName, prettyHotkey(s.hotkey)),
        iconType: 'none'
      })
    }
  })
  loadScreen(mainWindow)
}

function showMain(opts?: { settings?: boolean }): void {
  if (!mainWindow) return
  quickWindow?.hide()
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
  if (opts?.settings) mainWindow.webContents.send('ui:open-settings')
}

function createQuickWindow(): void {
  quickWindow = new BrowserWindow({
    width: QUICK_WIDTH,
    height: 84,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: { preload: preloadPath, sandbox: true, contextIsolation: true }
  })
  lockDown(quickWindow)
  // Click anywhere else and the quick bar gets out of the way.
  quickWindow.on('blur', () => quickWindow?.hide())
  loadScreen(quickWindow, 'quick')
}

function toggleQuickBar(): void {
  if (!quickWindow) return
  if (quickWindow.isVisible()) {
    quickWindow.hide()
    return
  }
  // Appear near the top-middle of whichever screen the mouse is on.
  const { x, y, width, height } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea
  const [, h] = quickWindow.getSize()
  quickWindow.setBounds({ x: Math.round(x + (width - QUICK_WIDTH) / 2), y: Math.round(y + height * 0.22), width: QUICK_WIDTH, height: h })
  quickWindow.show()
  quickWindow.focus()
  quickWindow.webContents.send('quick:shown')
}

// ---------- Tray ----------

function createTray(): void {
  tray = new Tray(nativeImage.createFromPath(join(assetsDir, 'icon', 'tray.png')))
  tray.on('click', () => showMain())
  refreshTray()
}

function refreshTray(): void {
  if (!tray) return
  const s = settings.get()
  const hotkey = prettyHotkey(s.hotkey)
  tray.setToolTip(`Print Me Daddy (${hotkey})`)
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open Print Me Daddy', click: () => showMain() },
      { label: hotkeyActive ? `Quick bar (${hotkey})` : 'Quick bar', click: () => toggleQuickBar() },
      { label: 'Settings…', click: () => showMain({ settings: true }) },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() }
    ])
  )
}

// ---------- Hotkey and start-with-Windows ----------

function registerHotkey(accelerator: string): boolean {
  try {
    return globalShortcut.register(accelerator, toggleQuickBar)
  } catch {
    return false // not a valid shortcut
  }
}

function applyStartWithWindows(enabled: boolean): void {
  // Only meaningful for the installed app; in development it would register
  // the bare Electron program, not Print Me Daddy.
  if (!app.isPackaged) return
  app.setLoginItemSettings({ openAtLogin: enabled, args: ['--hidden'] })
}

// ---------- Settings ----------

function updateSettings(patch: Partial<Settings>): SettingsUpdateResult {
  const prev = settings.get()
  const next: Settings = { ...prev }

  if (typeof patch.hostName === 'string') {
    const name = patch.hostName.trim().slice(0, 30)
    if (!name) return { ok: false, settings: prev, error: 'She needs a name, darling.' }
    next.hostName = name
  }
  if (typeof patch.startWithWindows === 'boolean') next.startWithWindows = patch.startWithWindows
  if (patch.printerName === null || typeof patch.printerName === 'string') next.printerName = patch.printerName

  if (typeof patch.hotkey === 'string' && patch.hotkey !== prev.hotkey) {
    if (hotkeyActive) globalShortcut.unregister(prev.hotkey)
    if (registerHotkey(patch.hotkey)) {
      next.hotkey = patch.hotkey
      hotkeyActive = true
    } else {
      hotkeyActive = registerHotkey(prev.hotkey)
      return { ok: false, settings: prev, error: `${prettyHotkey(patch.hotkey)} is already taken by another app. Try a different combo.` }
    }
  }

  settings.set(next)
  if (next.startWithWindows !== prev.startWithWindows) applyStartWithWindows(next.startWithWindows)
  refreshTray()
  broadcast('settings:changed', next)
  return { ok: true, settings: next }
}

// ---------- Talking to the screen ----------

function broadcast(channel: string, payload: unknown): void {
  for (const win of [mainWindow, quickWindow]) {
    if (win && !win.isDestroyed()) win.webContents.send(channel, payload)
  }
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function handleUserMessage(raw: unknown): Promise<void> {
  const text = String(raw ?? '').trim().slice(0, 2000)
  if (!text) return
  chat.add('user', text)

  // "/mood error" etc. shows each avatar state, handy for testing artwork.
  const mood = text.match(/^\/mood\s+(\w+)$/i)?.[1]?.toLowerCase()
  if (mood && HOST_STATES.includes(mood as HostState)) {
    chat.setHostState(mood as HostState)
    chat.add('host', host.moodReply(mood))
    return
  }

  chat.setHostState('thinking')
  await wait(600 + Math.random() * 500)
  chat.add('host', host.placeholderReply(text))
  chat.setHostState('idle')
}

function registerIpc(): void {
  ipcMain.handle('settings:get', () => settings.get())
  ipcMain.handle('settings:update', (_e, patch: Partial<Settings>) => updateSettings(patch ?? {}))
  ipcMain.handle('host:avatars', () => loadAvatars(join(assetsDir, 'host')))
  ipcMain.handle('app:info', () => ({ version: app.getVersion(), isPackaged: app.isPackaged, hotkeyActive }))
  ipcMain.handle('chat:get', () => chat.get())
  ipcMain.handle('chat:send', (_e, text: unknown) => handleUserMessage(text))
  ipcMain.handle('chat:files-dropped', (_e, paths: unknown) => {
    const files = (Array.isArray(paths) ? paths : []).filter((p): p is string => typeof p === 'string' && !!p)
    if (files.length) return desk.filesDropped(files)
  })

  ipcMain.handle('printers:list', (_e, refresh: unknown) => listPrinters(refresh === true))
  ipcMain.handle('job:update', (_e, id: unknown, patch: unknown) => desk.update(String(id), (patch ?? {}) as JobPatch))
  ipcMain.handle('job:print', (_e, id: unknown, confirmed: unknown) => desk.print(String(id), confirmed === true))
  ipcMain.handle('job:cancel', (_e, id: unknown) => desk.cancel(String(id)))
  ipcMain.handle('print:test-page', (_e, printer: unknown) => desk.testPage(typeof printer === 'string' ? printer : null))

  // The loading screen waits until the main window is really open (not just "visible" to the browser engine).
  ipcMain.handle('window:is-open', () => !!mainWindow && mainWindow.isVisible() && !mainWindow.isMinimized())
  ipcMain.on('window:open-main', (_e, opts?: { settings?: boolean }) => showMain(opts))
  ipcMain.on('quick:hide', () => quickWindow?.hide())
  ipcMain.on('quick:resize', (_e, height: number) => {
    if (!quickWindow || typeof height !== 'number') return
    const b = quickWindow.getBounds()
    quickWindow.setBounds({ ...b, width: QUICK_WIDTH, height: Math.max(60, Math.min(400, Math.round(height))) })
  })
}
