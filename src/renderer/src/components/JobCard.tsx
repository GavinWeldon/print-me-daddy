import { useState, type DragEvent } from 'react'
import type { JobPatch, PrinterInfo, PrintJob } from '../../../shared/types'
import { PrinterSelect } from './PrinterSelect'

interface Props {
  job: PrintJob
  printers: PrinterInfo[]
}

const STATUS_LABEL: Record<PrintJob['status'], string> = {
  draft: 'Ready',
  printing: 'Printing',
  done: 'Printed ✓',
  failed: 'Didn’t print',
  cancelled: 'Cancelled'
}

function pageCount(range: string, total: number): number {
  if (!range.trim() || !/^\s*\d+\s*(-\s*\d+\s*)?(,\s*\d+\s*(-\s*\d+\s*)?)*$/.test(range)) return total
  const picked = new Set<number>()
  for (const part of range.split(',')) {
    const [a, b] = part.split('-').map((n) => parseInt(n, 10))
    for (let p = a; p <= (Number.isNaN(b) || b === undefined ? a : b); p++) if (p >= 1 && p <= total) picked.add(p)
  }
  return picked.size
}

/** A print job in the chat: files in order (drag to reorder, tick to include), settings, and Print / Cancel. */
export function JobCard({ job, printers }: Props) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [confirmPages, setConfirmPages] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const locked = job.status === 'printing'
  const update = (patch: JobPatch) => {
    setError(null)
    setConfirmPages(null)
    window.pmd.updateJob(job.id, patch)
  }

  const included = job.files.filter((f) => f.included && !f.problem)
  const pages = included.reduce((n, f) => n + pageCount(job.options.pages, f.pages ?? 1), 0)
  const sheets = pages * job.options.copies

  const print = async (confirmed = false) => {
    setBusy(true)
    setError(null)
    const result = await window.pmd.printJob(job.id, confirmed)
    setBusy(false)
    if (result.needsConfirm) setConfirmPages(result.needsConfirm)
    else {
      setConfirmPages(null)
      if (!result.ok && result.error) setError(result.error)
    }
  }

  // Drag a file onto another to move it there.
  const onDrop = (targetId: string) => (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!dragId || dragId === targetId) return
    const order = job.files.map((f) => f.id).filter((id) => id !== dragId)
    order.splice(order.indexOf(targetId), 0, dragId)
    setDragId(null)
    update({ order })
  }

  return (
    <div className={`job-card job--${job.status}`}>
      <div className="job-head">
        <span className="job-title">♛ Print job</span>
        <span className="job-meta">
          {included.length} of {job.files.length} file{job.files.length === 1 ? '' : 's'} · {sheets} page{sheets === 1 ? '' : 's'}
        </span>
        <span className="job-status">{STATUS_LABEL[job.status]}</span>
      </div>

      <ol className="job-files">
        {job.files.map((f, i) => (
          <li
            key={f.id}
            className={`${f.included && !f.problem ? '' : 'is-off'} ${dragId === f.id ? 'is-dragging' : ''}`}
            draggable={!locked && job.files.length > 1}
            onDragStart={(e) => {
              setDragId(f.id)
              e.dataTransfer.effectAllowed = 'move'
            }}
            onDragEnd={() => setDragId(null)}
            onDragOver={(e) => dragId && e.preventDefault()}
            onDrop={onDrop(f.id)}
            title={f.path}
          >
            {job.files.length > 1 && <span className="grip">⋮⋮</span>}
            <span className="num">{i + 1}</span>
            <input
              type="checkbox"
              checked={f.included && !f.problem}
              disabled={locked || !!f.problem}
              onChange={(e) => update({ included: { [f.id]: e.target.checked } })}
            />
            <span className="fname">{f.name}</span>
            <span className="fpages">{f.problem ? f.problem : `${f.pages ?? '?'} pg`}</span>
          </li>
        ))}
      </ol>

      <div className="job-settings">
        <label>
          <span>Printer</span>
          <PrinterSelect printers={printers} value={job.printerName} disabled={locked} onChange={(printerName) => update({ printerName })} />
        </label>
        <label className="narrow">
          <span>Copies</span>
          <input
            type="number"
            min={1}
            max={99}
            value={job.options.copies}
            disabled={locked}
            onChange={(e) => update({ options: { copies: Number(e.target.value) || 1 } })}
          />
        </label>
        <div className="seg" role="group" aria-label="Colour">
          <span>Colour</span>
          <div>
            {(['color', 'mono'] as const).map((c) => (
              <button key={c} className={job.options.color === c ? 'on' : ''} disabled={locked} onClick={() => update({ options: { color: c } })}>
                {c === 'color' ? 'Colour' : 'B&W'}
              </button>
            ))}
          </div>
        </div>
        <label>
          <span>Double-sided</span>
          <select
            className="select"
            value={job.options.duplex}
            disabled={locked}
            onChange={(e) => update({ options: { duplex: e.target.value as PrintJob['options']['duplex'] } })}
          >
            <option value="off">Off</option>
            <option value="long">Long edge (like a book)</option>
            <option value="short">Short edge (flip up)</option>
          </select>
        </label>
        <label>
          <span>Pages{job.files.length > 1 ? ' (each file)' : ''}</span>
          <input
            placeholder="All"
            value={job.options.pages}
            disabled={locked}
            onChange={(e) => update({ options: { pages: e.target.value } })}
          />
        </label>
      </div>

      {confirmPages !== null && (
        <div className="job-confirm">
          That’s <strong>{confirmPages} pages</strong>, darling. Sure you want all of them?
          <div>
            <button className="pill-btn small" onClick={() => print(true)}>
              Yes, print it
            </button>
            <button className="ghost-btn" onClick={() => setConfirmPages(null)}>
              No
            </button>
          </div>
        </div>
      )}

      <div className="job-actions">
        <span className={`job-note ${job.status === 'failed' || error ? 'is-error' : ''}`}>{error ?? job.error ?? job.progress ?? ''}</span>
        {(job.status === 'printing' || job.status === 'draft') && (
          <button className="ghost-btn" onClick={() => window.pmd.cancelJob(job.id)}>
            Cancel
          </button>
        )}
        {job.status !== 'printing' && (
          <button className="pill-btn" disabled={busy || included.length === 0} onClick={() => print(false)}>
            <span className="crown">♛</span> {job.status === 'draft' ? 'Print' : 'Print again'} <span className="chev">›</span>
          </button>
        )}
      </div>
    </div>
  )
}
