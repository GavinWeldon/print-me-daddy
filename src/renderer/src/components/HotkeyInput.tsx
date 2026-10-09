import { useEffect, useState } from 'react'
import { prettyHotkey } from '../../../shared/hotkey'

const SPECIAL_KEYS: Record<string, string> = {
  Space: 'Space', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']',
  Backslash: '\\', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/',
  ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
  Insert: 'Insert', Delete: 'Delete', Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown'
}

/** Reads the physical key (so Shift doesn't turn "1" into "!"). */
function keyName(code: string): string | null {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3)
  if (/^Digit\d$/.test(code)) return code.slice(5)
  if (/^F([1-9]|1\d|2[0-4])$/.test(code)) return code
  return SPECIAL_KEYS[code] ?? null
}

/** Converts a key press into Electron's shortcut format, or null if it isn't a usable combo yet. */
function toAccelerator(e: KeyboardEvent): string | null {
  const key = keyName(e.code)
  if (!key) return null
  const isFKey = /^F\d+$/.test(key)
  // Plain letters would fire while typing anywhere, so require Ctrl, Alt or Win (F-keys are fine alone).
  if (!isFKey && !e.ctrlKey && !e.altKey && !e.metaKey) return null
  const parts: string[] = []
  if (e.ctrlKey) parts.push('Control')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  if (e.metaKey) parts.push('Super')
  parts.push(key)
  return parts.join('+')
}

interface Props {
  value: string
  onChange: (accelerator: string) => void
}

export function HotkeyInput({ value, onChange }: Props) {
  const [recording, setRecording] = useState(false)

  useEffect(() => {
    if (!recording) return
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.code === 'Escape') return setRecording(false)
      const accelerator = toAccelerator(e)
      if (accelerator) {
        setRecording(false)
        onChange(accelerator)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [recording, onChange])

  return (
    <button className={`hotkey-input ${recording ? 'is-recording' : ''}`} onClick={() => setRecording(!recording)}>
      {recording ? 'Press your new shortcut… (Esc to cancel)' : prettyHotkey(value)}
    </button>
  )
}
