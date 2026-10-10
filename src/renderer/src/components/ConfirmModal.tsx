import { useEffect } from 'react'
import type { PrinterInfo, PrintJob } from '../../../shared/types'
import { JobCard } from './JobCard'

interface Props {
  job: PrintJob
  printers: PrinterInfo[]
  hostName: string
  onClose: () => void
}

/**
 * The final check before printing a typed request: what Paige found, in order,
 * with page counts. Closes once printing starts or the job is cancelled; the job
 * stays in the chat either way.
 */
export function ConfirmModal({ job, printers, hostName, onClose }: Props) {
  useEffect(() => {
    if (job.status !== 'draft') onClose()
  }, [job.status, onClose])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label="Check before printing">
        <header className="modal-head">
          <span className="name-tag small">
            <i>♥</i>
            {hostName}
          </span>
          <span className="modal-sub">Check it’s all right, then print. Nothing goes to the printer until you say so.</span>
          <button className="icon-btn" onClick={onClose} title="Close (the job stays in the chat)">
            ✕
          </button>
        </header>
        <JobCard job={job} printers={printers} variant="confirm" />
      </div>
    </div>
  )
}
