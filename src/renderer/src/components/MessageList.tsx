import { useEffect, useRef } from 'react'
import type { ChatMessage } from '../../../shared/types'

interface Props {
  messages: ChatMessage[]
  hostName: string
  typing: boolean
}

export function MessageList({ messages, hostName, typing }: Props) {
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
