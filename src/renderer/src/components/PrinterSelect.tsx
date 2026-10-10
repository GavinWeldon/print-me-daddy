import type { PrinterInfo } from '../../../shared/types'

interface Props {
  printers: PrinterInfo[]
  value: string | null
  onChange: (printerName: string | null) => void
  disabled?: boolean
}

/** Pick a printer. "Windows default" follows whatever Windows has set as default. */
export function PrinterSelect({ printers, value, onChange, disabled }: Props) {
  const fallback = printers.find((p) => p.isDefault)
  const missing = value !== null && printers.length > 0 && !printers.some((p) => p.name === value)
  return (
    <select
      className="select"
      value={value ?? ''}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
    >
      <option value="">Windows default{fallback ? ` (${fallback.name})` : ''}</option>
      {printers.map((p) => (
        <option key={p.name} value={p.name}>
          {p.name}
        </option>
      ))}
      {missing && <option value={value!}>{value} (not found)</option>}
    </select>
  )
}
