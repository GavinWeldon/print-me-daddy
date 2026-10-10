import { useCallback, useEffect, useState } from 'react'
import type { SmartStatus } from '../../../shared/types'

interface Props {
  enabled: boolean
  onToggle: (enabled: boolean) => void
}

/** Smart mode on/off, plus which Claude account on THIS PC it uses (or why it can't run). */
export function SmartModeField({ enabled, onToggle }: Props) {
  const [status, setStatus] = useState<SmartStatus | null>(null)
  const [checking, setChecking] = useState(false)

  const check = useCallback(async (refresh: boolean) => {
    setChecking(true)
    setStatus(await window.pmd.getSmartStatus(refresh))
    setChecking(false)
  }, [])
  useEffect(() => {
    check(false)
  }, [check])

  return (
    <div className="field">
      <span>Smart mode</span>
      <label className="field--row">
        <input type="checkbox" checked={enabled} onChange={(e) => onToggle(e.target.checked)} />
        <span>Use my big brain for tricky requests</span>
      </label>
      <small>
        For things like “all my tutorials with the solution after each one”, I ask Claude Code on this PC. It uses whoever
        is signed in to Claude here, never anyone else’s account. Simple requests never use it.
      </small>
      <div className="row">
        <small className={status?.available ? 'ok' : 'warn'} style={{ flex: 1 }}>
          {checking && !status
            ? 'Checking Claude Code…'
            : status?.available
              ? `Ready ✓ Signed in as ${status.account ?? 'someone'}${status.plan ? ` (${status.plan})` : ''}`
              : status?.reason === 'not-installed'
                ? 'Not available: Claude Code isn’t installed on this PC.'
                : status?.reason === 'signed-out'
                  ? 'Not available: Claude Code isn’t signed in on this PC.'
                  : 'Not available: Claude Code didn’t respond.'}
        </small>
        <button className="icon-btn" title="Check again" onClick={() => check(true)} disabled={checking}>
          ↻
        </button>
      </div>
      {status && !status.available && (
        <small>
          {status.reason === 'not-installed'
            ? 'Install Claude Code (claude.com/claude-code), sign in once with “claude auth login” in a terminal, then press ↻.'
            : 'Open a terminal, run “claude auth login”, sign in with your Claude account, then press ↻.'}{' '}
          Until then I still handle simple requests myself.
        </small>
      )}
    </div>
  )
}
