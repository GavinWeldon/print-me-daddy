import { useEffect, useRef, useState } from 'react'
import splashUrl from '../../../../assets/brand/loading-screen.webp'

// Where the empty loading bar sits inside the picture (it's 1672 × 941),
// so the live fill lines up exactly with the drawn one.
const BAR = { left: (569 / 1672) * 100, top: (819 / 941) * 100, width: (536 / 1672) * 100, height: (32 / 941) * 100 }

interface Step {
  to: number // percent reached at the end of this step
  ms: number // minimum time the step takes
  text: string
  work?: () => Promise<unknown> // real work that must finish before moving on
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * The loading screen: the owner's picture with a live progress bar.
 * It genuinely waits for the printer list and Paige's pictures, but always
 * takes about 6–7 seconds, speeding up and pausing like a real game loader.
 */
export function Splash({ onDone }: { onDone: () => void }) {
  const [progress, setProgress] = useState(0)
  const [text, setText] = useState('Warming up the printer…')
  const [leaving, setLeaving] = useState(false)
  const progressRef = useRef(0)
  const skipped = useRef(false)

  useEffect(() => {
    let alive = true
    const steps: Step[] = [
      { to: 17, ms: 900, text: 'Warming up the printer…' },
      { to: 21, ms: 550, text: 'Warming up the printer…' },
      { to: 47, ms: 1400, text: 'Finding your printers…', work: () => window.pmd.listPrinters().catch(() => null) },
      { to: 70, ms: 1150, text: 'Doing Paige’s make-up…', work: () => window.pmd.getAvatars().catch(() => null) },
      { to: 72, ms: 650, text: 'Doing Paige’s make-up…' },
      { to: 94, ms: 1100, text: 'Polishing the paper tray…' },
      { to: 100, ms: 550, text: 'Ready, gorgeous ♥' }
    ]

    // Glide the bar from where it is to `to` over `ms`, easing out like a real loader.
    // Driven by the clock (not screen refreshes) so it keeps time even on a busy PC.
    const glide = (to: number, ms: number) =>
      new Promise<void>((resolve) => {
        const from = progressRef.current
        const start = performance.now()
        const timer = setInterval(() => {
          const t = Math.min(1, (performance.now() - start) / ms)
          const eased = 1 - Math.pow(1 - t, 2)
          progressRef.current = from + (to - from) * eased
          setProgress(progressRef.current)
          if (t >= 1 || !alive || skipped.current) {
            clearInterval(timer)
            resolve()
          }
        }, 16)
      })

    ;(async () => {
      for (const step of steps) {
        if (!alive || skipped.current) break
        setText(step.text)
        // The real work runs alongside the animation; if it's slow the bar waits near the end of the step.
        await Promise.all([glide(step.to, step.ms), step.work ? Promise.race([step.work(), sleep(8000)]) : null])
      }
      if (!alive) return
      setProgress(100)
      await sleep(skipped.current ? 0 : 450)
      setLeaving(true)
      await sleep(500)
      if (alive) onDone()
    })()

    // Esc or a click skips it, for the impatient.
    const skip = () => (skipped.current = true)
    window.addEventListener('keydown', skip)
    return () => {
      alive = false
      window.removeEventListener('keydown', skip)
    }
  }, [onDone])

  return (
    <div className={`splash ${leaving ? 'is-leaving' : ''}`} onClick={() => (skipped.current = true)}>
      <div className="splash-backdrop" style={{ backgroundImage: `url("${splashUrl}")` }} />
      <div className="splash-frame">
        <img src={splashUrl} alt="Print Me Daddy is loading" draggable={false} />
        <div className="splash-bar" style={{ left: `${BAR.left}%`, top: `${BAR.top}%`, width: `${BAR.width}%`, height: `${BAR.height}%` }}>
          <div className="splash-fill" style={{ width: `${progress}%` }}>
            <span className="splash-spark" />
          </div>
        </div>
        <div className="splash-status" style={{ top: `${BAR.top + BAR.height + 5.9}%` }}>
          {text} <b>{Math.floor(progress)}%</b>
        </div>
      </div>
    </div>
  )
}
