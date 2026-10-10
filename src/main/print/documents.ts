import { app, nativeImage } from 'electron'
import { randomUUID } from 'crypto'
import { mkdirSync, readdirSync, rmSync } from 'fs'
import { readFile, writeFile } from 'fs/promises'
import { extname, join } from 'path'
import { PDFDocument } from 'pdf-lib'

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
