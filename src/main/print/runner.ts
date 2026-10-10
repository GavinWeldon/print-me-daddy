import { execFile } from 'child_process'
import { rmSync } from 'fs'
import { basename } from 'path'
import { print } from 'pdf-to-printer'
import type { PrintJob, PrintOptions } from '../../shared/types'
import { PAGE_RANGES, sidesFor } from '../../shared/pages'
import { layoutPagesPerSheet, toPrintablePdf } from './documents'

export class CancelledError extends Error {}

const SIDE = { off: 'simplex', long: 'duplexlong', short: 'duplexshort' } as const

export { PAGE_RANGES }

/** Total sides of paper a job will print, including copies and pages per sheet. */
export function jobPageTotal(job: PrintJob): number {
  return (
    job.files
      .filter((f) => f.included && !f.problem)
      .reduce((sum, f) => sum + sidesFor(job.options.pages, f.pages ?? 1, job.options.pagesPerSheet), 0) * job.options.copies
  )
}

/**
 * Printers give paper long names like `Letter 8.5"x11" 22x28cm`. SumatraPDF knows the
 * standard ones by their short name, so use that when it's one of them; otherwise pass it as-is.
 */
function paperName(size: string): string | undefined {
  if (!size.trim()) return undefined
  const standard = size.match(/^(A[2-6]|letter|legal|tabloid|statement)\b/i)?.[1]
  return standard ? standard.toLowerCase().replace(/^a/, 'A') : size
}

function toPrinterOptions(printer: string, o: PrintOptions, pageRange: boolean) {
  return {
    printer,
    copies: o.copies,
    monochrome: o.color === 'mono',
    side: SIDE[o.duplex],
    pages: pageRange && o.pages.trim() ? o.pages.replace(/s+/g, '') : undefined,
    scale: o.scale,
    paperSize: paperName(o.paperSize),
    orientation: o.orientation === 'auto' ? undefined : o.orientation
  }
}

/**
 * Sends each ticked file to the printer, in order. Calls `onProgress` as it goes and
 * stops between files if `isCancelled()` turns true. Records the document names sent,
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
  const perSheet = job.options.pagesPerSheet
  for (const [i, file] of files.entries()) {
    if (isCancelled()) throw new CancelledError()
    onProgress(files.length > 1 ? `Sending ${i + 1} of ${files.length}: ${file.name}` : `Sending ${file.name}`)
    const temporary: string[] = []
    try {
      const printable = await toPrintablePdf(file.path)
      if (printable.temporary) temporary.push(printable.pdf)
      let pdf = printable.pdf
      // Several pages per sheet: lay them out ourselves (the page range is applied while doing so).
      if (perSheet > 1) {
        pdf = await layoutPagesPerSheet(pdf, perSheet, job.options.pages)
        temporary.push(pdf)
      }
      sent.push(basename(pdf))
      await print(pdf, toPrinterOptions(printer, job.options, perSheet === 1))
    } finally {
      for (const t of temporary) rmSync(t, { force: true })
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
