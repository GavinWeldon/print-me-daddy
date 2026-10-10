import { useEffect, useState } from 'react'
import type { PrinterInfo, Settings } from '../../../shared/types'
import { PrinterSelect } from './PrinterSelect'
import { PrintOptionsFields } from './PrintOptionsFields'
import { PrinterFeatures } from './PrinterFeatures'
import { usePaperSizes } from '../hooks'

interface Props {
  settings: Settings
  printers: PrinterInfo[]
  onRefreshPrinters: () => void
  onClose: () => void
}

/** Everything about the printer in one place: which one, its own settings, the app's defaults, test page. */
export function PrinterPanel({ settings, printers, onRefreshPrinters, onClose }: Props) {
  const paperSizes = usePaperSizes(settings.printerName)
  const [testState, setTestState] = useState<{ busy: boolean; message?: string; ok?: boolean }>({ busy: false })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const update = (patch: Partial<Settings>) => window.pmd.updateSettings(patch)
  const printTest = async () => {
    setTestState({ busy: true, message: 'Sending a test page…' })
    const result = await window.pmd.printTestPage(settings.printerName)
    setTestState({ busy: false, ok: result.ok, message: result.ok ? 'Test page sent. Go have a look 💋' : result.error })
  }

  return (
    <div className="panel-backdrop" onMouseDown={onClose}>
      <aside className="panel" onMouseDown={(e) => e.stopPropagation()}>
        <header className="panel-head">
          <h2>Printer</h2>
          <button className="icon-btn" onClick={onClose} title="Close (Esc)">
            ✕
          </button>
        </header>

        <div className="field">
          <span>Printer</span>
          <div className="row">
            <PrinterSelect printers={printers} value={settings.printerName} onChange={(printerName) => update({ printerName })} />
            <button className="icon-btn" title="Look for printers again" onClick={onRefreshPrinters}>
              ↻
            </button>
          </div>
          {printers.length === 0 && (
            <small>No printers found yet. Add one in Windows Settings › Bluetooth & devices › Printers & scanners, then press ↻.</small>
          )}
          <div className="row">
            <button className="pill-btn small" disabled={testState.busy || printers.length === 0} onClick={printTest}>
              <span className="crown">♛</span> Print a test page
            </button>
          </div>
          {testState.message && <small className={testState.ok === false ? 'warn' : testState.ok ? 'ok' : ''}>{testState.message}</small>}
        </div>

        <div className="field">
          <h3 className="sub-head">Printer settings & preferences</h3>
          <small>
            Quality, paper type, borderless, ink and everything else this printer offers. Changes save to the printer straight
            away. Or just tell me: “switch to standard quality”, “print my CV in high quality”.
          </small>
          <PrinterFeatures printerName={settings.printerName} />
        </div>

        <div className="field">
          <h3 className="sub-head">Print Me Daddy defaults</h3>
          <small>Every new print job starts with these. Anything you type (like “in black and white”) or change on a job still wins.</small>
          <div className="job-settings">
            <PrintOptionsFields
              options={settings.printDefaults}
              onChange={(patch) => update({ printDefaults: { ...settings.printDefaults, ...patch } })}
              paperSizes={paperSizes}
              openMore
            />
          </div>
        </div>

        <div className="field">
          <span>Windows’ own printer windows</span>
          <div className="row wrap">
            <button className="ghost-btn small" onClick={() => window.pmd.openPrinterWindow(settings.printerName, 'preferences')}>
              Printing preferences
            </button>
            <button className="ghost-btn small" onClick={() => window.pmd.openPrinterWindow(settings.printerName, 'properties')}>
              Printer properties
            </button>
            <button className="ghost-btn small" onClick={() => window.pmd.openPrinterWindow(settings.printerName, 'queue')}>
              Print queue
            </button>
          </div>
        </div>
      </aside>
    </div>
  )
}
