// Plain-English words for the most common printer settings, mapped to the standard
// Windows print-schema names every driver uses. Shared by the fast path and the smart path.

export const QUALITY = 'psk:PageOutputQuality'
export const BORDERLESS = 'psk:PageBorderless'

export const QUALITY_OPTIONS = { high: 'psk:High', normal: 'psk:Normal', draft: 'psk:Draft' } as const
export type QualityWord = keyof typeof QUALITY_OPTIONS

/** "psk:High" → "high quality", for Paige's replies. */
export function describePrinterFeatures(features: Record<string, string>): string[] {
  const out: string[] = []
  const q = features[QUALITY]
  if (q) out.push(`${q === 'psk:Normal' ? 'standard' : q.replace(/^[\w]+:/, '').toLowerCase()} quality`)
  if (features[BORDERLESS] === 'psk:Borderless') out.push('borderless')
  return out
}
