import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { PmdApi } from '../shared/types'

// The preload is the only bridge between the screen and the rest of the computer.
// The screen can only do the specific things listed here, nothing more.

function listen<T>(channel: string, cb: (value: T) => void): () => void {
  const handler = (_e: Electron.IpcRendererEvent, value: T) => cb(value)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const api: PmdApi = {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (patch) => ipcRenderer.invoke('settings:update', patch),
  onSettingsChanged: (cb) => listen('settings:changed', cb),

  getAvatars: () => ipcRenderer.invoke('host:avatars'),
  getAppInfo: () => ipcRenderer.invoke('app:info'),

  getChat: () => ipcRenderer.invoke('chat:get'),
  sendMessage: (text) => ipcRenderer.invoke('chat:send', text),
  filesDropped: (paths) => ipcRenderer.invoke('chat:files-dropped', paths),
  onChatChanged: (cb) => listen('chat:changed', cb),

  getPathForFile: (file) => webUtils.getPathForFile(file),
  pickFiles: () => ipcRenderer.invoke('files:pick'),

  listPrinters: (refresh) => ipcRenderer.invoke('printers:list', refresh),
  updateJob: (jobId, patch) => ipcRenderer.invoke('job:update', jobId, patch),
  onConfirmJob: (cb) => listen('job:confirm', cb),
  searchFiles: (query) => ipcRenderer.invoke('library:search', query),
  printJob: (jobId, confirmed) => ipcRenderer.invoke('job:print', jobId, confirmed),
  cancelJob: (jobId) => ipcRenderer.invoke('job:cancel', jobId),
  printTestPage: (printerName) => ipcRenderer.invoke('print:test-page', printerName),
  getPaperSizes: (printerName) => ipcRenderer.invoke('printers:paper-sizes', printerName),
  openPrinterWindow: (printerName, which) => ipcRenderer.invoke('printers:open-window', printerName, which),
  getPrinterFeatures: (printerName, refresh) => ipcRenderer.invoke('printers:features', printerName, refresh),
  setPrinterFeature: (printerName, feature, option) => ipcRenderer.invoke('printers:set-feature', printerName, feature, option),
  onPrinterFeaturesChanged: (cb) => listen('printer:features-changed', cb),

  getSmartStatus: (refresh) => ipcRenderer.invoke('smart:status', refresh),
  pickFolders: () => ipcRenderer.invoke('library:pick-folders'),
  getIndexStatus: () => ipcRenderer.invoke('library:status'),
  onIndexStatus: (cb) => listen('library:status', cb),

  openMain: (opts) => ipcRenderer.send('window:open-main', opts),
  onOpenSettings: (cb) => listen('ui:open-settings', cb),
  onWindowClosed: (cb) => listen('ui:closed', cb),
  isWindowOpen: () => ipcRenderer.invoke('window:is-open'),
  quickHide: () => ipcRenderer.send('quick:hide'),
  quickResize: (height) => ipcRenderer.send('quick:resize', height),
  onQuickShown: (cb) => listen('quick:shown', cb)
}

contextBridge.exposeInMainWorld('pmd', api)
