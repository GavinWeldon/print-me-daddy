import { useState } from 'react'
import { QUALITY } from '../../../shared/printerWords'
import { usePrinterFeatures } from '../hooks'

/** One-click print quality switch for the chat header (saves to the printer straight away). */
export function QualitySwitch({ printerName }: { printerName: string | null }) {
  const { features } = usePrinterFeatures(printerName)
  const [saving, setSaving] = useState(false)
  const feature = features.find((f) => f.name === QUALITY)
  if (!feature) return null
  return (
    <label className={`quality-switch ${saving ? 'is-saving' : ''}`} title="Print quality (saved to the printer)">
      <span>Quality</span>
      <select
        value={feature.current}
        disabled={saving}
        onChange={async (e) => {
          setSaving(true)
          await window.pmd.setPrinterFeature(printerName, feature.name, e.target.value)
          setSaving(false)
        }}
      >
        {!feature.options.some((o) => o.name === feature.current) && <option value={feature.current}>—</option>}
        {feature.options.map((o) => (
          <option key={o.name} value={o.name}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
