// Page-range maths shared by the printing code and the job card.

/** "1-3, 5" style page ranges. */
export const PAGE_RANGES = /^\s*\d+\s*(-\s*\d+\s*)?(,\s*\d+\s*(-\s*\d+\s*)?)*$/

/** The page numbers (1-based, in order, no repeats) a range picks out of a document with `total` pages. */
export function pageNumbers(range: string, total: number): number[] {
  if (!range.trim() || !PAGE_RANGES.test(range)) return Array.from({ length: total }, (_, i) => i + 1)
  const picked: number[] = []
  for (const part of range.split(',')) {
    const [a, b] = part.split('-').map((n) => parseInt(n, 10))
    const end = Number.isNaN(b) || b === undefined ? a : b
    for (let p = a; p <= end; p++) if (p >= 1 && p <= total && !picked.includes(p)) picked.push(p)
  }
  return picked
}

/** Sides of paper one file prints on, given page range and pages per sheet. */
export function sidesFor(range: string, total: number, pagesPerSheet: number): number {
  return Math.ceil(pageNumbers(range, total).length / Math.max(1, pagesPerSheet))
}
