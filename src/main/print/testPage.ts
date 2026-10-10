import { randomUUID } from 'crypto'
import { mkdirSync } from 'fs'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { cmyk, PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { scratchDir } from './documents'

const PINK = rgb(1, 0.18, 0.64)
const INK = rgb(0.08, 0.04, 0.08)

/** Builds a one-page A4 test page: colour and grey bars, a border to check margins, and the printer's name. */
export async function makeTestPage(printerName: string, hostName: string, version: string): Promise<string> {
  const doc = await PDFDocument.create()
  doc.setTitle('Print Me Daddy test page')
  const page = doc.addPage([595.28, 841.89])
  const { width, height } = page.getSize()
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const regular = await doc.embedFont(StandardFonts.Helvetica)

  // Border: if all four sides print, the margins are fine.
  page.drawRectangle({ x: 18, y: 18, width: width - 36, height: height - 36, borderColor: PINK, borderWidth: 2 })
  for (const [x, y] of [
    [18, 18],
    [width - 18, 18],
    [18, height - 18],
    [width - 18, height - 18]
  ]) {
    page.drawCircle({ x, y, size: 5, color: PINK })
  }

  // The built-in PDF fonts only know Western characters; leave anything else (emoji, etc.) out.
  const text = (s: string, x: number, y: number, size: number, font = regular, color = INK) =>
    page.drawText(s.replace(/[^\x20-\x7E -ÿ’]/g, '').replace(/ {2,}/g, ' '), { x, y, size, font, color })

  text('PRINT ME DADDY', 48, height - 96, 40, bold, PINK)
  text('Test page', 50, height - 126, 18, bold)
  text(`Hey gorgeous, it's ${hostName}. If you can read this, we're officially connected.`, 50, height - 160, 12)
  text(`Printer: ${printerName}`, 50, height - 184, 11)
  text(`Printed: ${new Date().toLocaleString()}`, 50, height - 200, 11)
  text(`Print Me Daddy v${version}`, 50, height - 216, 11)

  // Colour bars: each ink on its own, then mixes.
  text('Colour', 50, height - 262, 14, bold)
  const swatches = [
    ['Cyan', cmyk(1, 0, 0, 0)],
    ['Magenta', cmyk(0, 1, 0, 0)],
    ['Yellow', cmyk(0, 0, 1, 0)],
    ['Black', cmyk(0, 0, 0, 1)],
    ['Red', rgb(0.9, 0.1, 0.1)],
    ['Green', rgb(0.1, 0.7, 0.2)],
    ['Blue', rgb(0.1, 0.25, 0.9)],
    ['Pink', PINK]
  ] as const
  swatches.forEach(([label, color], i) => {
    const x = 50 + i * 62
    page.drawRectangle({ x, y: height - 340, width: 54, height: 64, color })
    text(label, x, height - 356, 9)
  })

  // Grey ramp: every step should look different.
  text('Greys', 50, height - 398, 14, bold)
  for (let i = 0; i <= 10; i++) {
    const g = 1 - i / 10
    page.drawRectangle({ x: 50 + i * 45, y: height - 460, width: 45, height: 48, color: rgb(g, g, g), borderColor: INK, borderWidth: 0.5 })
    text(`${i * 10}%`, 58 + i * 45, height - 476, 8)
  }

  // Fine lines: should be crisp, not blurry or missing.
  text('Fine lines', 50, height - 518, 14, bold)
  ;[0.25, 0.5, 1, 2, 4].forEach((w, i) => {
    page.drawLine({ start: { x: 50, y: height - 540 - i * 14 }, end: { x: width - 50, y: height - 540 - i * 14 }, thickness: w, color: INK })
  })

  text('All good? Colours look right, greys all different, border complete: you’re ready to print.', 50, 120, 11)
  text(`Love, ${hostName}  xx`, 50, 100, 11, bold, PINK)

  mkdirSync(scratchDir, { recursive: true })
  const file = join(scratchDir, `test-page-${randomUUID()}.pdf`)
  await writeFile(file, await doc.save())
  return file
}
