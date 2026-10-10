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

  listPrinters: (refresh) => ipcRenderer.invoke('printers:list', refresh),
  updateJob: (jobId, patch) => ipcRenderer.invoke('job:update', jobId, patch),
  printJob: (jobId, confirmed) => ipcRenderer.invoke('job:print', jobId, confirmed),
  cancelJob: (jobId) => ipcRenderer.invoke('job:cancel', jobId),
  printTestPage: (printerName) => ipcRenderer.invoke('print:test-page', printerName),

  openMain: (opts) => ipcRenderer.send('window:open-main', opts),
  onOpenSettings: (cb) => listen('ui:open-settings', cb),
  quickHide: () => ipcRenderer.send('quick:hide'),
  quickResize: (height) => ipcRenderer.send('quick:resize', height),
  onQuickShown: (cb) => listen('quick:shown', cb)
}

contextBridge.exposeInMainWorld('pmd', api)
