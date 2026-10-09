import { useEffect, useState } from 'react'
import type { AppInfo, Settings } from '../../../shared/types'
import { HotkeyInput } from './HotkeyInput'

interface Props {
  settings: Settings
  onClose: () => void
}

export function SettingsPanel({ settings, onClose }: Props) {
  const [name, setName] = useState(settings.hostName)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [info, setInfo] = useState<AppInfo | null>(null)

  useEffect(() => {
    window.pmd.getAppInfo().then(setInfo)
  }, [settings])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const update = async (patch: Partial<Settings>) => {
    const result = await window.pmd.updateSettings(patch)
    setError(result.ok ? null : (result.error ?? 'That did not save.'))
    if (!result.ok) setName(result.settings.hostName)
    setSaved(result.ok)
    if (result.ok) setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="panel-backdrop" onMouseDown={onClose}>
      <aside className="panel" onMouseDown={(e) => e.stopPropagation()}>
        <header className="panel-head">
          <h2>Settings</h2>
          <button className="icon-btn" onClick={onClose} title="Close (Esc)">
            ✕
          </button>
        </header>

        <label className="field">
          <span>Host name</span>
          <input
            value={name}
            maxLength={30}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name !== settings.hostName && update({ hostName: name })}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
        </label>

        <div className="field">
          <span>Quick bar shortcut</span>
          <HotkeyInput value={settings.hotkey} onChange={(hotkey) => update({ hotkey })} />
          <small>
            Works from anywhere in Windows. Heads up: while Print Me Daddy is running it takes this shortcut from other
            apps too (Ctrl+Shift+P is also VS Code's command palette).
          </small>
          {info && !info.hotkeyActive && <small className="warn">The shortcut isn't active right now. Pick another one.</small>}
        </div>

        <label className="field field--row">
          <input
            type="checkbox"
            checked={settings.startWithWindows}
            onChange={(e) => update({ startWithWindows: e.target.checked })}
          />
          <span>Start with Windows (quietly, in the tray)</span>
        </label>
        {info && !info.isPackaged && (
          <small className="note">This one switches on for real once the app is installed. In development it's just remembered.</small>
        )}

        {error && <p className="warn">{error}</p>}
        {saved && <p className="ok">Saved 💋</p>}

        <footer className="panel-foot">
          Print Me Daddy {info ? `v${info.version}` : ''}
          <br />
          Swap the host's pictures in the <code>assets/host</code> folder (idle, thinking, printing, error).
        </footer>
      </aside>
    </div>
  )
}
