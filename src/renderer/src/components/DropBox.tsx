interface Props {
  /** Files were chosen with the picker. (Dropped files are handled by the window, so drops anywhere work.) */
  onFiles: (paths: string[]) => void
  /** Glows while files are being dragged over the window. */
  active: boolean
  label?: string
}

/** A visible "drop files here" box. Click it to choose files instead of dragging. */
export function DropBox({ onFiles, active, label = 'Drop files here' }: Props) {
  const browse = async () => {
    const paths = await window.pmd.pickFiles()
    if (paths.length) onFiles(paths)
  }
  return (
    <button type="button" className={`drop-box ${active ? 'is-active' : ''}`} onClick={browse}>
      <span className="drop-icon">♥</span>
      <span>
        <strong>{active ? 'Let go, gorgeous' : label}</strong>
        {!active && <small> or click to choose · PDFs, pictures, Office files</small>}
      </span>
    </button>
  )
}
