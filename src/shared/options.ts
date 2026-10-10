import { DEFAULT_PRINT_OPTIONS, PAGES_PER_SHEET, type PrintOptions } from './types'

/**
 * Applies a (possibly untrusted) change to print options, keeping only valid values.
 * Used for job edits and for the default print settings, so both follow the same rules.
 */
export function applyOptions<T extends Partial<PrintOptions>>(base: T, patch: Partial<PrintOptions> | undefined): T {
  const o = { ...base }
  const p = patch ?? {}
  if (typeof p.copies === 'number' && Number.isFinite(p.copies)) o.copies = Math.min(99, Math.max(1, Math.round(p.copies)))
  if (p.color === 'color' || p.color === 'mono') o.color = p.color
  if (p.duplex === 'off' || p.duplex === 'long' || p.duplex === 'short') o.duplex = p.duplex
  if (typeof p.pages === 'string') o.pages = p.pages.slice(0, 60)
  if (PAGES_PER_SHEET.includes(p.pagesPerSheet as PrintOptions['pagesPerSheet'])) o.pagesPerSheet = p.pagesPerSheet
  if (typeof p.paperSize === 'string') o.paperSize = p.paperSize.slice(0, 80)
  if (p.scale === 'shrink' || p.scale === 'fit' || p.scale === 'noscale') o.scale = p.scale
  if (p.orientation === 'auto' || p.orientation === 'portrait' || p.orientation === 'landscape') o.orientation = p.orientation
  if (p.printerFeatures && typeof p.printerFeatures === 'object') {
    // A small map of the printer's own settings; empty values mean "use the printer's default".
    o.printerFeatures = Object.fromEntries(
      Object.entries(p.printerFeatures)
        .filter(([k, v]) => typeof k === 'string' && typeof v === 'string' && k.length < 100 && v.length > 0 && v.length < 100)
        .slice(0, 20)
    )
  }
  return o
}

export const DEFAULT_PRINT_DEFAULTS = (({ pages: _pages, ...rest }) => rest)(DEFAULT_PRINT_OPTIONS)
