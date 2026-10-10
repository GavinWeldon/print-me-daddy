import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react'
import { useAvatars, useChat, usePrinters, useSettings } from './hooks'
import { Host, HOST_STATUS } from './components/Host'
import { MessageList } from './components/MessageList'
import { Composer } from './components/Composer'
import { SettingsPanel } from './components/SettingsPanel'
import { Splash } from './components/Splash'
import { ConfirmModal } from './components/ConfirmModal'
import { DropBox } from './components/DropBox'
import { PrinterPanel } from './components/PrinterPanel'
import { QualitySwitch } from './components/QualitySwitch'
import logoUrl from '../../../assets/brand/logo.webp'
import printerUrl from '../../../assets/brand/printer.webp'

/** The full window: the host standing on the left, logo and chat on the right. */
export default function App() {
  const chat = useChat()
  const settings = useSettings()
  const avatars = useAvatars()
  const { printers, refresh: refreshPrinters, reload: reloadPrinters } = usePrinters()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [printerOpen, setPrinterOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [confirmJobId, setConfirmJobId] = useState<string | null>(null)
  const closeConfirm = useCallback(() => setConfirmJobId(null), [])
  // The loading screen shows when the app starts and every time the window is reopened.
  const [loading, setLoading] = useState(true)
  const [loadingRun, setLoadingRun] = useState(0)
  const finishLoading = useCallback(() => {
    setLoading(false)
    reloadPrinters()
  }, [reloadPrinters])
  // Drag events fire for every child element, so count enters/leaves to know when it really left.
  const dragDepth = useRef(0)

  useEffect(() => window.pmd.onOpenSettings(() => setSettingsOpen(true)), [])
  useEffect(() => window.pmd.onConfirmJob((id) => setConfirmJobId(id)), [])
  useEffect(
    () =>
      window.pmd.onWindowClosed(() => {
        setSettingsOpen(false)
        setLoadingRun((n) => n + 1)
        setLoading(true)
      }),
    []
  )

  const hostName = settings?.hostName ?? 'Paige'
  // With the confirmation pop-up open, new files join that job; otherwise they start a new one.
  const addFiles = (paths: string[]) => {
    if (!paths.length) return
    if (confirmJobId) window.pmd.updateJob(confirmJobId, { add: paths })
    else window.pmd.filesDropped(paths)
  }
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
    addFiles(
      Array.from(e.dataTransfer.files)
        .map((f) => window.pmd.getPathForFile(f))
        .filter(Boolean)
    )
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
            {settings && <QualitySwitch printerName={settings.printerName} />}
            <button className="icon-btn printer-btn" onClick={() => setPrinterOpen(true)} title="Printer settings & preferences">
              🖨
            </button>
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
            <DropBox active={dragging && !confirmJobId} onFiles={addFiles} />
            <Composer hostName={hostName} onSend={(t) => window.pmd.sendMessage(t)} />
          </div>
        </section>
      </main>

      <div className="drop-overlay" aria-hidden={!dragging}>
        <div className="drop-card">
          {confirmJobId ? 'Add them to the list' : 'Drop it on me'} <span>♥</span>
          <small>{confirmJobId ? 'Let go to add these files to this print job' : `Let go to send these files to ${hostName}`}</small>
        </div>
      </div>

      {confirmJobId && chat.jobs[confirmJobId] && (
        <ConfirmModal job={chat.jobs[confirmJobId]} printers={printers} hostName={hostName} dragging={dragging} onAddFiles={addFiles} onClose={closeConfirm} />
      )}

      {printerOpen && settings && (
        <PrinterPanel settings={settings} printers={printers} onRefreshPrinters={refreshPrinters} onClose={() => setPrinterOpen(false)} />
      )}

      {loading && <Splash key={loadingRun} onDone={finishLoading} />}

      {settingsOpen && settings && (
        <SettingsPanel
          settings={settings}
          printers={printers}
          onOpenPrinter={() => {
            setSettingsOpen(false)
            setPrinterOpen(true)
          }}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  )
}
