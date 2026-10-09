import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useAvatars, useChat, useSettings } from './hooks'
import { Host } from './components/Host'

/** The small pop-up bar summoned by the global shortcut. */
export default function QuickBar() {
  const chat = useChat()
  const settings = useSettings()
  const avatars = useAvatars()
  const [text, setText] = useState('')
  // Only show replies that arrived after you sent something this time.
  const [sentAt, setSentAt] = useState<number | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(
    () =>
      window.pmd.onQuickShown(() => {
        setText('')
        setSentAt(null)
        inputRef.current?.focus()
      }),
    []
  )

  // Tell the window how tall to be, so it hugs the content.
  useLayoutEffect(() => {
    const el = boxRef.current
    if (!el) return
    const observer = new ResizeObserver(() => window.pmd.quickResize(el.getBoundingClientRect().height))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const hostName = settings?.hostName ?? 'Paige'
  const reply = sentAt === null ? undefined : [...chat.messages].reverse().find((m) => m.from === 'host' && m.ts >= sentAt)
  const thinking = sentAt !== null && chat.hostState === 'thinking'

  const send = () => {
    if (!text.trim()) return
    setSentAt(Date.now())
    window.pmd.sendMessage(text)
    setText('')
  }

  return (
    <div className="quick" ref={boxRef}>
      <div className="quick-row">
        <Host name={hostName} state={chat.hostState} avatars={avatars} size="small" />
        <input
          ref={inputRef}
          autoFocus
          value={text}
          placeholder={`What shall I print, gorgeous?`}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') send()
            if (e.key === 'Escape') window.pmd.quickHide()
          }}
        />
        <button className="icon-btn" title="Open the full window" onClick={() => window.pmd.openMain()}>
          ⤢
        </button>
      </div>
      {(thinking || reply) && (
        <div className="quick-reply">
          <strong>{hostName}:</strong> {thinking ? '…' : reply?.text}
        </div>
      )}
    </div>
  )
}
