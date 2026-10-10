import { useEffect, useState } from 'react'
import type { FileHit } from '../../../shared/types'

interface Props {
  onAdd: (path: string) => void
  /** Files already in the job (shown as added). */
  exclude: string[]
}

/** Search the indexed folders by name and add a file to the job. */
export function FileSearch({ onAdd, exclude }: Props) {
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<FileHit[]>([])

  // Search as you type, after a short pause.
  useEffect(() => {
    if (query.trim().length < 2) {
      setHits([])
      return
    }
    let current = true
    const timer = setTimeout(() => {
      window.pmd.searchFiles(query).then((h) => current && setHits(h))
    }, 180)
    return () => {
      current = false
      clearTimeout(timer)
    }
  }, [query])

  return (
    <div className="file-search">
      <input placeholder="🔍 Search your files to add another…" value={query} onChange={(e) => setQuery(e.target.value)} />
      {query.trim().length >= 2 && (
        <ul>
          {hits.length === 0 && <li className="empty">Nothing like that in your folders.</li>}
          {hits.map((h) => {
            const added = exclude.includes(h.path)
            return (
              <li key={h.path} title={h.path}>
                <span className="finfo">
                  <span className="fname">{h.name}</span>
                  <span className="fsub">{h.folder}</span>
                </span>
                <button className="ghost-btn small" disabled={added} onClick={() => onAdd(h.path)}>
                  {added ? 'Added' : '+ Add'}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
