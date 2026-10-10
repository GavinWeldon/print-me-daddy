import { useEffect, useRef, useState, type DragEvent } from 'react'
import { useAvatars, useChat, usePrinters, useSettings } from './hooks'
import { Host, HOST_STATUS } from './components/Host'
import { MessageList } from './components/MessageList'
import { Composer } from './components/Composer'
import { SettingsPanel } from './components/SettingsPanel'
import logoUrl from '../../../assets/brand/logo.webp'
import printerUrl from '../../../assets/brand/printer.webp'

/** The full window: the host standing on the left, logo and chat on the right. */
export default function App() {
  const chat = useChat()
  const settings = useSettings()
  const avatars = useAvatars()
  const { printers, refresh: refreshPrinters } = usePrinters()
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
      <aside className="stage">
        <Host name={hostName} state={chat.hostState} avatars={avatars} />
      </aside>

      <main className="main">
        <div className={`topline host--${chat.hostState}`}>
          <img className="logo" src={logoUrl} alt="Print Me Daddy" draggable={false} />
          <img className="printer" src={printerUrl} alt="" draggable={false} />
        </div>

        <section className={`chat host--${chat.hostState}`}>
          <header className="chat-head">
            <span className="name-tag">
              <i>♥</i>
              {hostName}
            </span>
            <span className="status-pill">
              <i />
              {HOST_STATUS[chat.hostState]}
            </span>
            <button className="icon-btn" onClick={() => setSettingsOpen(true)} title="Settings">
              ⚙
            </button>
          </header>
          <div className="chat-frame">
            <MessageList
              messages={chat.messages}
              jobs={chat.jobs}
              printers={printers}
              hostName={hostName}
              typing={chat.hostState === 'thinking'}
            />
            <Composer hostName={hostName} onSend={(t) => window.pmd.sendMessage(t)} />
          </div>
        </section>
      </main>

      <div className="drop-overlay" aria-hidden={!dragging}>
        <div className="drop-card">
          Drop it on me <span>♥</span>
          <small>Let go to send these files to {hostName}</small>
        </div>
      </div>

      {settingsOpen && settings && (
        <SettingsPanel settings={settings} printers={printers} onRefreshPrinters={refreshPrinters} onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  )
}
