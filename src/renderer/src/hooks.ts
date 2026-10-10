import { useCallback, useEffect, useState } from 'react'
import type { Avatars, ChatState, IndexStatus, PrinterFeature, PrinterInfo, Settings } from '../../shared/types'

/** Live copy of the conversation, kept in sync with the main process. */
export function useChat(): ChatState {
  const [state, setState] = useState<ChatState>({ messages: [], hostState: 'idle', jobs: {} })
  useEffect(() => {
    window.pmd.getChat().then(setState)
    return window.pmd.onChatChanged(setState)
  }, [])
  return state
}

/** Live copy of the settings. */
export function useSettings(): Settings | null {
  const [settings, setSettings] = useState<Settings | null>(null)
  useEffect(() => {
    window.pmd.getSettings().then(setSettings)
    return window.pmd.onSettingsChanged(setSettings)
  }, [])
  return settings
}

/** The host's pictures, re-read whenever the window gets focus so swapped artwork shows up. */
export function useAvatars(): Avatars {
  const [avatars, setAvatars] = useState<Avatars>({})
  useEffect(() => {
    const load = () => window.pmd.getAvatars().then(setAvatars)
    load()
    window.addEventListener('focus', load)
    return () => window.removeEventListener('focus', load)
  }, [])
  return avatars
}

/** Printers installed in Windows (default first), plus a way to look again. */
export function usePrinters(): { printers: PrinterInfo[]; loading: boolean; refresh: () => void; reload: () => void } {
  const [printers, setPrinters] = useState<PrinterInfo[]>([])
  const [loading, setLoading] = useState(true)
  const load = useCallback((refresh: boolean) => {
    setLoading(true)
    window.pmd
      .listPrinters(refresh)
      .then(setPrinters)
      .catch(() => setPrinters([]))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => load(false), [load])
  // refresh: ask Windows again. reload: pick up the app's latest list (e.g. after the loading screen refreshed it).
  // Both keep the same identity between renders, so they're safe to depend on.
  const refresh = useCallback(() => load(true), [load])
  const reload = useCallback(() => load(false), [load])
  return { printers, loading, refresh, reload }
}

/** How the folder index is getting on. */
export function useIndexStatus(): IndexStatus | null {
  const [status, setStatus] = useState<IndexStatus | null>(null)
  useEffect(() => {
    window.pmd.getIndexStatus().then(setStatus)
    return window.pmd.onIndexStatus(setStatus)
  }, [])
  return status
}

/** Paper sizes the given printer supports (null = Windows default printer). */
export function usePaperSizes(printerName: string | null): string[] {
  const [sizes, setSizes] = useState<string[]>([])
  useEffect(() => {
    let current = true
    window.pmd
      .getPaperSizes(printerName)
      .then((s) => current && setSizes(s))
      .catch(() => current && setSizes([]))
    return () => {
      current = false
    }
  }, [printerName])
  return sizes
}

/** The printer's own settings (quality, paper type…), kept up to date when they change anywhere. */
export function usePrinterFeatures(printerName: string | null): { features: PrinterFeature[]; printer?: string; error?: string; loading: boolean; reload: () => void } {
  const [state, setState] = useState<{ features: PrinterFeature[]; printer?: string; error?: string; loading: boolean }>({ features: [], loading: true })
  const reload = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }))
    const result = await window.pmd.getPrinterFeatures(printerName)
    setState('error' in result ? { features: [], error: result.error, loading: false } : { features: result.features, printer: result.printer, loading: false })
  }, [printerName])
  useEffect(() => {
    reload()
    return window.pmd.onPrinterFeaturesChanged(() => reload())
  }, [reload])
  return { ...state, reload }
}
