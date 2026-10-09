import { useEffect, useRef, useState, type DragEvent } from 'react'
import { useAvatars, useChat, useSettings } from './hooks'
import { Host } from './components/Host'
import { MessageList } from './components/MessageList'
import { Composer } from './components/Composer'
import { SettingsPanel } from './components/SettingsPanel'

/** The full window: chat on the left, the host in the bottom-right corner. */
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
      <header className="topbar">
        <div className="brand">
          <span className="brand-dot" />
          Print Me <em>Daddy</em>
        </div>
        <button className="icon-btn" onClick={() => setSettingsOpen(true)} title="Settings">
          ⚙
        </button>
      </header>

      <main className="layout">
        <section className="chat">
          <MessageList messages={chat.messages} hostName={hostName} typing={chat.hostState === 'thinking'} />
          <Composer hostName={hostName} onSend={(t) => window.pmd.sendMessage(t)} />
        </section>
        <aside className="host-corner">
          <Host name={hostName} state={chat.hostState} avatars={avatars} />
        </aside>
      </main>

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
