import { execFile } from 'child_process'
import { rmSync } from 'fs'
import { basename } from 'path'
import { print } from 'pdf-to-printer'
import type { PrintJob, PrintOptions } from '../../shared/types'
import { toPrintablePdf } from './documents'

export class CancelledError extends Error {}

const SIDE = { off: 'simplex', long: 'duplexlong', short: 'duplexshort' } as const

/** "1-3, 5" style page ranges. */
export const PAGE_RANGES = /^\s*\d+\s*(-\s*\d+\s*)?(,\s*\d+\s*(-\s*\d+\s*)?)*$/

/** How many pages a range like "1-3,5" picks out of a document with `total` pages. */
export function pagesInRange(range: string, total: number): number {
  if (!range.trim()) return total
  const picked = new Set<number>()
  for (const part of range.split(',')) {
    const [a, b] = part.split('-').map((n) => parseInt(n, 10))
    for (let p = a; p <= (Number.isNaN(b) || b === undefined ? a : b); p++) if (p >= 1 && p <= total) picked.add(p)
  }
  return picked.size
}

/** Total sheets-worth of pages a job will send, including copies. */
export function jobPageTotal(job: PrintJob): number {
  return job.files
    .filter((f) => f.included && !f.problem)
    .reduce((sum, f) => sum + pagesInRange(job.options.pages, f.pages ?? 1), 0) * job.options.copies
}

function toPrinterOptions(printer: string, o: PrintOptions) {
  return {
    printer,
    copies: o.copies,
    monochrome: o.color === 'mono',
    side: SIDE[o.duplex],
    pages: o.pages.trim() ? o.pages.replace(/\s+/g, '') : undefined,
    scale: 'shrink' as const
  }
}

/**
 * Sends each ticked file to the printer, in order. Calls `onProgress` as it goes and
 * stops between files if `isCancelled()` turns true. Returns the document names sent,
 * so a cancel can also pull them back out of the Windows print queue.
 */
export async function runJob(
  job: PrintJob,
  printer: string,
  onProgress: (text: string) => void,
  isCancelled: () => boolean,
  sent: string[]
): Promise<void> {
  const files = job.files.filter((f) => f.included && !f.problem)
  for (const [i, file] of files.entries()) {
    if (isCancelled()) throw new CancelledError()
    onProgress(files.length > 1 ? `Sending ${i + 1} of ${files.length}: ${file.name}` : `Sending ${file.name}`)
    const { pdf, temporary } = await toPrintablePdf(file.path)
    sent.push(basename(pdf))
    try {
      await print(pdf, toPrinterOptions(printer, job.options))
    } finally {
      if (temporary) rmSync(pdf, { force: true })
    }
  }
}

export async function printFile(pdf: string, printer: string): Promise<void> {
  await print(pdf, { printer, scale: 'noscale' })
}

/**
 * Removes this app's documents from a printer's Windows queue (used by Cancel).
 * Values go in through environment variables so odd printer or file names can't break the command.
 */
export function removeFromQueue(printer: string, documents: string[], since: Date): Promise<void> {
  const script = `
    $names = $env:PMD_DOCS -split "\`n" | Where-Object { $_ }
    $since = [datetime]::Parse($env:PMD_SINCE)
    Get-PrintJob -PrinterName $env:PMD_PRINTER -ErrorAction SilentlyContinue | ForEach-Object {
      $job = $_
      if ($job.SubmittedTime -ge $since -and ($names | Where-Object { $job.DocumentName -like "*$_*" })) {
        $job | Remove-PrintJob -ErrorAction SilentlyContinue
      }
    }`
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { env: { ...process.env, PMD_PRINTER: printer, PMD_DOCS: documents.join('\n'), PMD_SINCE: since.toISOString() }, windowsHide: true },
      () => resolve()
    )
  })
}
