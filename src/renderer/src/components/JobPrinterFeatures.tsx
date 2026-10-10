import { usePrinterFeatures } from '../hooks'

interface Props {
  printerName: string | null
  /** This job's own choices, e.g. { "psk:PageOutputQuality": "psk:High" }. */
  value: Record<string, string>
  onChange: (value: Record<string, string>) => void
  disabled?: boolean
}

/** The printer's everyday settings (quality, paper type, borderless, ink) for this job only. */
export function JobPrinterFeatures({ printerName, value, onChange, disabled }: Props) {
  const { features } = usePrinterFeatures(printerName)
  const common = features.filter((f) => f.common).slice(0, 4)
  return (
    <>
      {common.map((f) => {
        const current = f.options.find((o) => o.name === f.current)?.label
        return (
          <label key={f.name}>
            <span>{f.label} (this job)</span>
            <select
              className="select"
              value={value[f.name] ?? ''}
              disabled={disabled}
              onChange={(e) => {
                const next = { ...value }
                if (e.target.value) next[f.name] = e.target.value
                else delete next[f.name]
                onChange(next)
              }}
            >
              <option value="">Printer’s setting{current ? ` (${current})` : ''}</option>
              {f.options.map((o) => (
                <option key={o.name} value={o.name}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        )
      })}
    </>
  )
}
