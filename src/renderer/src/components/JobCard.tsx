import { useState, type DragEvent } from 'react'
import type { JobPatch, PrinterInfo, PrintJob } from '../../../shared/types'
import { PrintOptionsFields } from './PrintOptionsFields'
import { JobPrinterFeatures } from './JobPrinterFeatures'
import { usePaperSizes } from '../hooks'
import { sidesFor } from '../../../shared/pages'
import { PrinterSelect } from './PrinterSelect'
import { FileSearch } from './FileSearch'
import { DropBox } from './DropBox'

interface Props {
  job: PrintJob
  printers: PrinterInfo[]
  /** "confirm" is the pop-up shown before printing: adds folders, swaps, remove and search. */
  variant?: 'card' | 'confirm'
  /** Pop-up only: files being dragged over the window, and how to add picked files. */
  dragging?: boolean
  onAddFiles?: (paths: string[]) => void
}

const STATUS_LABEL: Record<PrintJob['status'], string> = {
  draft: 'Ready',
  printing: 'Printing',
  done: 'Printed ✓',
  failed: 'Didn’t print',
  cancelled: 'Cancelled'
}

/** A print job: files in order (drag to reorder, tick to include), settings, and Print / Cancel. */
export function JobCard({ job, printers, variant = 'card', dragging = false, onAddFiles }: Props) {
  const confirming = variant === 'confirm'
  const paperSizes = usePaperSizes(job.printerName)
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
  const pages = included.reduce((n, f) => n + sidesFor(job.options.pages, f.pages ?? 1, job.options.pagesPerSheet), 0)
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
        <span className="job-title">{confirming ? '♛ Here’s what I found' : '♛ Print job'}</span>
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
            <span className="finfo">
              <span className="fname">{f.name}</span>
              {confirming && (f.folder || f.note) && (
                <span className="fsub">
                  {f.folder}
                  {f.note && <em>{f.note}</em>}
                </span>
              )}
            </span>
            {confirming && !locked && f.alternatives && f.alternatives.length > 0 && (
              <select
                className="select swap"
                value=""
                title="Not this one? Swap it for another file"
                onChange={(e) => e.target.value && update({ replace: { fileId: f.id, path: e.target.value } })}
              >
                <option value="">Swap for…</option>
                {f.alternatives.map((a) => (
                  <option key={a.path} value={a.path}>
                    {a.name} ({a.folder})
                  </option>
                ))}
              </select>
            )}
            <span className="fpages">{f.problem ? f.problem : `${f.pages ?? '?'} pg`}</span>
            {confirming && !locked && (
              <button className="remove" title="Take this off the list" onClick={() => update({ remove: f.id })}>
                ✕
              </button>
            )}
          </li>
        ))}
      </ol>

      {confirming && !locked && (
        <div className="job-add">
          <FileSearch onAdd={(path) => update({ add: [path] })} exclude={job.files.map((f) => f.path)} />
          {onAddFiles && <DropBox active={dragging} onFiles={onAddFiles} label="Drop more files here" />}
        </div>
      )}

      <div className="job-settings">
        <label>
          <span>Printer</span>
          <PrinterSelect printers={printers} value={job.printerName} disabled={locked} onChange={(printerName) => update({ printerName })} />
        </label>
        <PrintOptionsFields
          options={job.options}
          onChange={(options) => update({ options })}
          paperSizes={paperSizes}
          disabled={locked}
          showPages
          pagesLabel={`Pages${job.files.length > 1 ? ' (each file)' : ''}`}
          openMore={Object.keys(job.options.printerFeatures).length > 0}
          moreExtra={
            <JobPrinterFeatures
              printerName={job.printerName}
              value={job.options.printerFeatures}
              disabled={locked}
              onChange={(printerFeatures) => update({ options: { printerFeatures } })}
            />
          }
        />
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
