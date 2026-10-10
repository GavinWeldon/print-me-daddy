import { useState } from 'react'
import { PAGES_PER_SHEET, type PrintOptions } from '../../../shared/types'

interface Props {
  options: Omit<PrintOptions, 'pages'> & { pages?: string }
  onChange: (patch: Partial<PrintOptions>) => void
  paperSizes: string[]
  disabled?: boolean
  /** Show the page-range box (jobs have it; the defaults in Settings don't). */
  showPages?: boolean
  pagesLabel?: string
  /** Start with "More options" open. */
  openMore?: boolean
}

/** The print settings controls, shared by job cards, the confirmation pop-up and Settings. */
export function PrintOptionsFields({ options, onChange, paperSizes, disabled, showPages, pagesLabel = 'Pages', openMore = false }: Props) {
  const [more, setMore] = useState(openMore)
  // Keep a chosen paper size visible even if this printer doesn't list it.
  const sizes = options.paperSize && !paperSizes.includes(options.paperSize) ? [options.paperSize, ...paperSizes] : paperSizes
  const extrasChanged = !!options.paperSize || options.scale !== 'shrink' || options.orientation !== 'auto'

  return (
    <>
      <label className="narrow">
        <span>Copies</span>
        <input
          type="number"
          min={1}
          max={99}
          value={options.copies}
          disabled={disabled}
          onChange={(e) => onChange({ copies: Number(e.target.value) || 1 })}
        />
      </label>
      <div className="seg" role="group" aria-label="Colour">
        <span>Colour</span>
        <div>
          {(['color', 'mono'] as const).map((c) => (
            <button key={c} className={options.color === c ? 'on' : ''} disabled={disabled} onClick={() => onChange({ color: c })}>
              {c === 'color' ? 'Colour' : 'B&W'}
            </button>
          ))}
        </div>
      </div>
      <label>
        <span>Double-sided</span>
        <select className="select" value={options.duplex} disabled={disabled} onChange={(e) => onChange({ duplex: e.target.value as PrintOptions['duplex'] })}>
          <option value="off">Off</option>
          <option value="long">Long edge (like a book)</option>
          <option value="short">Short edge (flip up)</option>
        </select>
      </label>
      <label className="narrow">
        <span>Per sheet</span>
        <select
          className="select"
          value={options.pagesPerSheet}
          disabled={disabled}
          onChange={(e) => onChange({ pagesPerSheet: Number(e.target.value) as PrintOptions['pagesPerSheet'] })}
        >
          {PAGES_PER_SHEET.map((n) => (
            <option key={n} value={n}>
              {n === 1 ? '1 (normal)' : `${n} pages`}
            </option>
          ))}
        </select>
      </label>
      {showPages && (
        <label>
          <span>{pagesLabel}</span>
          <input placeholder="All" value={options.pages ?? ''} disabled={disabled} onChange={(e) => onChange({ pages: e.target.value })} />
        </label>
      )}

      <button type="button" className={`more-toggle ${more ? 'is-open' : ''}`} onClick={() => setMore(!more)}>
        {more ? '▾' : '▸'} More options{!more && extrasChanged ? ' •' : ''}
      </button>
      {more && (
        <>
          <label>
            <span>Paper size</span>
            <select className="select" value={options.paperSize} disabled={disabled} onChange={(e) => onChange({ paperSize: e.target.value })}>
              <option value="">Printer’s default</option>
              {sizes.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Scaling</span>
            <select className="select" value={options.scale} disabled={disabled} onChange={(e) => onChange({ scale: e.target.value as PrintOptions['scale'] })}>
              <option value="shrink">Shrink big pages to fit</option>
              <option value="fit">Fit to page</option>
              <option value="noscale">Actual size</option>
            </select>
          </label>
          <label>
            <span>Orientation</span>
            <select
              className="select"
              value={options.orientation}
              disabled={disabled}
              onChange={(e) => onChange({ orientation: e.target.value as PrintOptions['orientation'] })}
            >
              <option value="auto">Automatic</option>
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
          </label>
        </>
      )}
    </>
  )
}
