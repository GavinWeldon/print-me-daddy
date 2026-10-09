import { useEffect, useRef, useState, type KeyboardEvent } from 'react'

interface Props {
  hostName: string
  onSend: (text: string) => void
}

/** The type-here box. Enter sends; Shift+Enter makes a new line. */
export function Composer({ hostName, onSend }: Props) {
  const [text, setText] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const focus = () => ref.current?.focus()
    focus()
    window.addEventListener('focus', focus)
    return () => window.removeEventListener('focus', focus)
  }, [])

  // Grow with the text, up to about five lines.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 140) + 'px'
  }, [text])

  const send = () => {
    if (!text.trim()) return
    onSend(text)
    setText('')
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="composer">
      <textarea
        ref={ref}
        rows={1}
        value={text}
        placeholder={`Tell ${hostName} what to print…`}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
      />
      <button className="send-btn" onClick={send} disabled={!text.trim()} title="Send (Enter)">
        Send
      </button>
    </div>
  )
}
