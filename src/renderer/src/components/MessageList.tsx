import { useEffect, useRef } from 'react'
import type { ChatMessage, PrinterInfo, PrintJob } from '../../../shared/types'
import { JobCard } from './JobCard'

interface Props {
  messages: ChatMessage[]
  jobs: Record<string, PrintJob>
  printers: PrinterInfo[]
  hostName: string
  typing: boolean
}

export function MessageList({ messages, jobs, printers, hostName, typing }: Props) {
  const endRef = useRef<HTMLDivElement>(null)

  // Keep the newest message in view.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length, typing])

  return (
    <div className="messages">
      {messages.map((m) => (
        <div key={m.id} className={`msg msg--${m.from}`}>
          {m.from === 'host' && <div className="msg-name">{hostName}</div>}
          <div className="msg-bubble">{m.text}</div>
          {m.jobId && jobs[m.jobId] && <JobCard job={jobs[m.jobId]} printers={printers} />}
        </div>
      ))}
      {typing && (
        <div className="msg msg--host">
          <div className="msg-name">{hostName}</div>
          <div className="msg-bubble typing">
            <span />
            <span />
            <span />
          </div>
        </div>
      )}
      <div ref={endRef} />
    </div>
  )
}
