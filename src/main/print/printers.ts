import { execFile } from 'child_process'
import type { PrinterInfo } from '../../shared/types'

let cache: { at: number; list: PrinterInfo[] } | null = null

/**
 * Asks Windows for every installed printer (any brand) and which one is the default.
 * (pdf-to-printer has its own list, but it crashes on some virtual printers like OneNote's.)
 */
function queryWindows(): Promise<PrinterInfo[]> {
  const script = 'Get-CimInstance Win32_Printer | Select-Object Name, Default | ConvertTo-Json -Compress'
  return new Promise((resolve, reject) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true }, (err, stdout) => {
      if (err) return reject(err)
      try {
        const raw = stdout.trim() ? JSON.parse(stdout) : []
        const rows: { Name?: string; Default?: boolean }[] = Array.isArray(raw) ? raw : [raw]
        resolve(rows.filter((r) => r.Name).map((r) => ({ name: r.Name!, isDefault: !!r.Default })))
      } catch (e) {
        reject(e)
      }
    })
  })
}

/** Every printer installed in Windows, default first. Remembered briefly because asking takes a second. */
export async function listPrinters(refresh = false): Promise<PrinterInfo[]> {
  if (!refresh && cache && Date.now() - cache.at < 30_000) return cache.list
  const list = (await queryWindows()).sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.name.localeCompare(b.name))
  cache = { at: Date.now(), list }
  return list
}

/** Works out which printer to actually use: the chosen one, or the Windows default. */
export async function resolvePrinter(chosen: string | null): Promise<{ name: string } | { error: string }> {
  const list = await listPrinters()
  if (chosen) {
    if (list.some((p) => p.name === chosen)) return { name: chosen }
    // It may have just been installed: check again before giving up.
    if ((await listPrinters(true)).some((p) => p.name === chosen)) return { name: chosen }
    return { error: `"${chosen}" isn't installed on this PC any more. Pick another printer.` }
  }
  const fallback = list.find((p) => p.isDefault)
  if (fallback) return { name: fallback.name }
  return list.length ? { name: list[0].name } : { error: 'No printers are installed in Windows yet.' }
}
