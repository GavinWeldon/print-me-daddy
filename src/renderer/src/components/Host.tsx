import type { Avatars, HostState } from '../../../shared/types'

const STATUS: Record<HostState, string> = {
  idle: 'Ready when you are',
  thinking: 'Thinking…',
  printing: 'Printing…',
  error: 'Uh-oh'
}

interface Props {
  name: string
  state: HostState
  avatars: Avatars
  size?: 'large' | 'small'
}

/** The host character. Shows the picture for her current mood. */
export function Host({ name, state, avatars, size = 'large' }: Props) {
  const src = avatars[state]
  return (
    <div className={`host host--${size} host--${state}`}>
      <div className="host-frame">
        {src ? <img src={src} alt={`${name} (${state})`} draggable={false} /> : <span className="host-fallback">{name[0]}</span>}
      </div>
      {size === 'large' && (
        <div className="host-caption">
          <strong>{name}</strong>
          <span>{STATUS[state]}</span>
        </div>
      )}
    </div>
  )
}
