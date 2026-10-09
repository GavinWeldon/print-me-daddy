import { useEffect, useState } from 'react'
import type { Avatars, ChatState, Settings } from '../../shared/types'

/** Live copy of the conversation, kept in sync with the main process. */
export function useChat(): ChatState {
  const [state, setState] = useState<ChatState>({ messages: [], hostState: 'idle' })
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
