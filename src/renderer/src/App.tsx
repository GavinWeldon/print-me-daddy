import { useEffect, useRef, useState, type DragEvent } from 'react'
import { useAvatars, useChat, useSettings } from './hooks'
import { Host } from './components/Host'
import { MessageList } from './components/MessageList'
import { Composer } from './components/Composer'
import { SettingsPanel } from './components/SettingsPanel'
import logoUrl from '../../../assets/brand/logo.svg'

/** The full window: a poster column (host + logo) on the left, chat on the right. */
export default function App() {
  const chat = useChat()
  const settings = useSettings()
  const avatars = useAvatars()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  // Drag events fire for every child element, so count enters/leaves to know when it really left.
  const dragDepth = useRef(0)

  useEffect(() => window.pmd.onOpenSettings(() => setSettingsOpen(true)), [])

  const hostName = settings?.hostName ?? 'Paige'
  const hasFiles = (e: DragEvent) => e.dataTransfer.types.includes('Files')

  const onDragEnter = (e: DragEvent) => {
    if (!hasFiles(e)) return
    e.preventDefault()
    dragDepth.current++
    setDragging(true)
  }
  const onDragLeave = () => {
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setDragging(false)
  }
  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    dragDepth.current = 0
    setDragging(false)
    const paths = Array.from(e.dataTransfer.files)
      .map((f) => window.pmd.getPathForFile(f))
      .filter(Boolean)
    if (paths.length) window.pmd.filesDropped(paths)
  }

  return (
    <div
      className={`app ${dragging ? 'is-dragging' : ''}`}
      onDragEnter={onDragEnter}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <aside className="poster">
        <Host name={hostName} state={chat.hostState} avatars={avatars} />
        <img className="logo" src={logoUrl} alt="Print Me Daddy" draggable={false} />
      </aside>

      <section className="chat">
        <header className="chat-head">
          <h1>
            Chat with <span>{hostName}</span>
          </h1>
          <button className="icon-btn" onClick={() => setSettingsOpen(true)} title="Settings">
            ⚙
          </button>
        </header>
        <MessageList messages={chat.messages} hostName={hostName} typing={chat.hostState === 'thinking'} />
        <Composer hostName={hostName} onSend={(t) => window.pmd.sendMessage(t)} />
      </section>

      <div className="drop-overlay" aria-hidden={!dragging}>
        <div className="drop-card">
          Drop it on me 💋
          <small>Let go to send these files to {hostName}</small>
        </div>
      </div>

      {settingsOpen && settings && <SettingsPanel settings={settings} onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}
