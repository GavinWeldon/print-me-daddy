import { useCallback, useEffect, useState } from 'react'
import type { Avatars, ChatState, PrinterInfo, Settings } from '../../shared/types'

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
