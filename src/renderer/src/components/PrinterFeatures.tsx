import { useCallback, useEffect, useState } from 'react'
import type { PrinterFeature } from '../../../shared/types'

interface Props {
  printerName: string | null
}

/**
 * Every setting the printer itself offers (quality, paper type, borderless, ink…),
 * read live from Windows. Changing one saves it as the printer's preference,
 * the same as Windows' "Printing preferences" window.
 */
export function PrinterFeatures({ printerName }: Props) {
  const [state, setState] = useState<{ loading: boolean; printer?: string; features: PrinterFeature[]; error?: string }>({
    loading: true,
    features: []
  })
  const [saving, setSaving] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)
  const [showAll, setShowAll] = useState(false)

  const load = useCallback(
    async (refresh = false) => {
      setState((s) => ({ ...s, loading: true }))
      const result = await window.pmd.getPrinterFeatures(printerName, refresh)
      if ('error' in result) setState({ loading: false, features: [], error: result.error })
      else setState({ loading: false, printer: result.printer, features: result.features })
    },
    [printerName]
  )
  useEffect(() => {
    load()
    return window.pmd.onPrinterFeaturesChanged(() => load(true))
  }, [load])

  const change = async (feature: PrinterFeature, option: string) => {
    setSaving(feature.name)
    setNotice(null)
    const result = await window.pmd.setPrinterFeature(printerName, feature.name, option)
    setSaving(null)
    if (!result.ok) setNotice({ ok: false, text: result.error ?? 'That didn’t save.' })
    else if (result.kept && result.kept !== option) setNotice({ ok: false, text: `The printer adjusted ${feature.label} to fit its other settings.` })
    else setNotice({ ok: true, text: `${feature.label} saved ✓` })
    load(true) // other settings can change along with it
  }

  if (state.error) return <small className="warn">{state.error}</small>
  const common = state.features.filter((f) => f.common)
  const rest = state.features.filter((f) => !f.common)
  const shown = showAll ? [...common, ...rest] : common

  return (
    <div className="printer-features">
      <div className="row">
        <small style={{ flex: 1 }}>
          {state.loading && !state.features.length
            ? 'Asking the printer what it can do…'
            : `${state.features.length} settings from ${state.printer}. Changes save to the printer straight away.`}
        </small>
        <button className="icon-btn" title="Read the printer's settings again" onClick={() => load(true)} disabled={state.loading}>
          ↻
        </button>
      </div>
      <div className="job-settings">
        {shown.map((f) => (
          <label key={f.name}>
            <span>{f.label}</span>
            <select
              className="select"
              value={f.options.some((o) => o.name === f.current) ? f.current : ''}
              disabled={saving !== null}
              onChange={(e) => e.target.value && change(f, e.target.value)}
            >
              {!f.options.some((o) => o.name === f.current) && <option value="">(not set)</option>}
              {f.options.map((o) => (
                <option key={o.name} value={o.name}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      {rest.length > 0 && (
        <button type="button" className={`more-toggle ${showAll ? 'is-open' : ''}`} onClick={() => setShowAll(!showAll)}>
          {showAll ? '▾ Fewer settings' : `▸ All ${state.features.length} printer settings`}
        </button>
      )}
      {saving && <small>Saving…</small>}
      {notice && <small className={notice.ok ? 'ok' : 'warn'}>{notice.text}</small>}
    </div>
  )
}
