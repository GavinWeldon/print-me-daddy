import { app, nativeImage } from 'electron'
import { randomUUID } from 'crypto'
import { mkdirSync, readdirSync, rmSync } from 'fs'
import { readFile, writeFile } from 'fs/promises'
import { extname, join } from 'path'
import { PDFDocument } from 'pdf-lib'
import { pageNumbers } from '../../shared/pages'

export type FileKind = 'pdf' | 'image' | 'office' | 'unsupported'

const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.bmp', '.ico']
const OFFICE_EXTS = ['.doc', '.docx', '.rtf', '.odt', '.ppt', '.pptx', '.odp', '.xls', '.xlsx', '.ods', '.csv']

export function kindOf(path: string): FileKind {
  const ext = extname(path).toLowerCase()
  if (ext === '.pdf') return 'pdf'
  if (IMAGE_EXTS.includes(ext)) return 'image'
  if (OFFICE_EXTS.includes(ext)) return 'office'
  return 'unsupported'
}

/** Number of pages a file will print as, or null if it can't be read. */
export async function countPages(path: string): Promise<number | null> {
  const kind = kindOf(path)
  if (kind === 'image') return 1
  if (kind !== 'pdf') return null
  try {
    const doc = await PDFDocument.load(await readFile(path), { ignoreEncryption: true, updateMetadata: false })
    return doc.getPageCount()
  } catch {
    return null
  }
}

/** Scratch folder for PDFs we make on the fly (pictures, test pages). */
export const scratchDir = join(app.getPath('temp'), 'print-me-daddy')

/** Clear out leftovers from last time. */
export function cleanScratch(): void {
  mkdirSync(scratchDir, { recursive: true })
  for (const f of readdirSync(scratchDir)) rmSync(join(scratchDir, f), { force: true })
}

const A4 = { w: 595.28, h: 841.89 }
const MARGIN = 28

/**
 * Returns a PDF ready to print. PDFs are used as they are; pictures are placed
 * on an A4 page (turned sideways if the picture is wide), shrunk to fit.
 * `temporary` is true when we made a file that should be deleted afterwards.
 */
export async function toPrintablePdf(path: string): Promise<{ pdf: string; temporary: boolean }> {
  const kind = kindOf(path)
  if (kind === 'pdf') return { pdf: path, temporary: false }
  if (kind !== 'image') throw new Error('This kind of file can’t be printed yet.')

  const doc = await PDFDocument.create()
  const ext = extname(path).toLowerCase()
  const bytes = await readFile(path)
  const image =
    ext === '.png'
      ? await doc.embedPng(bytes)
      : ext === '.jpg' || ext === '.jpeg'
        ? await doc.embedJpg(bytes)
        : await doc.embedPng(nativeImage.createFromPath(path).toPNG()) // BMP / ICO via Windows

  const landscape = image.width > image.height
  const page = doc.addPage(landscape ? [A4.h, A4.w] : [A4.w, A4.h])
  const boxW = page.getWidth() - MARGIN * 2
  const boxH = page.getHeight() - MARGIN * 2
  const scale = Math.min(boxW / image.width, boxH / image.height, 1)
  const w = image.width * scale
  const h = image.height * scale
  page.drawImage(image, { x: (page.getWidth() - w) / 2, y: (page.getHeight() - h) / 2, width: w, height: h })

  mkdirSync(scratchDir, { recursive: true })
  const pdf = join(scratchDir, `${randomUUID()}.pdf`)
  await writeFile(pdf, await doc.save())
  return { pdf, temporary: true }
}

/** Grid for each pages-per-sheet choice: columns × rows, and whether the sheet turns sideways. */
const LAYOUTS: Record<number, { cols: number; rows: number; landscape: boolean }> = {
  2: { cols: 2, rows: 1, landscape: true },
  4: { cols: 2, rows: 2, landscape: false },
  6: { cols: 3, rows: 2, landscape: true },
  9: { cols: 3, rows: 3, landscape: false }
}

/** Makes a temporary PDF with several pages shrunk onto each A4 sheet, in reading order. */
export async function layoutPagesPerSheet(pdf: string, perSheet: number, range: string): Promise<string> {
  const layout = LAYOUTS[perSheet]
  if (!layout) return pdf
  const source = await PDFDocument.load(await readFile(pdf), { ignoreEncryption: true })
  const wanted = pageNumbers(range, source.getPageCount()).map((n) => n - 1)
  const out = await PDFDocument.create()
  const embedded = await out.embedPdf(source, wanted)
  const sheetW = layout.landscape ? A4.h : A4.w
  const sheetH = layout.landscape ? A4.w : A4.h
  const gap = 10
  const cellW = (sheetW - MARGIN * 2 - gap * (layout.cols - 1)) / layout.cols
  const cellH = (sheetH - MARGIN * 2 - gap * (layout.rows - 1)) / layout.rows

  for (let i = 0; i < embedded.length; i += perSheet) {
    const sheet = out.addPage([sheetW, sheetH])
    embedded.slice(i, i + perSheet).forEach((page, k) => {
      const col = k % layout.cols
      const row = Math.floor(k / layout.cols)
      const scale = Math.min(cellW / page.width, cellH / page.height)
      const w = page.width * scale
      const h = page.height * scale
      const x = MARGIN + col * (cellW + gap) + (cellW - w) / 2
      const y = sheetH - MARGIN - (row + 1) * cellH - row * gap + (cellH - h) / 2
      sheet.drawPage(page, { x, y, width: w, height: h })
    })
  }

  mkdirSync(scratchDir, { recursive: true })
  const file = join(scratchDir, `${randomUUID()}-${perSheet}up.pdf`)
  await writeFile(file, await out.save())
  return file
}
