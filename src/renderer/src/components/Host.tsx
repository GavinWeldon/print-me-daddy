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
  size?: 'poster' | 'small'
}

/** The host character, showing the picture for her current mood. */
export function Host({ name, state, avatars, size = 'poster' }: Props) {
  const src = avatars[state]

  if (size === 'small') {
    // A round crop of her face for the quick bar.
    return (
      <div
        className={`host-badge host--${state}`}
        style={src ? { backgroundImage: `url("${src}")` } : undefined}
        role="img"
        aria-label={name}
      >
        {!src && name[0]}
      </div>
    )
  }

  return (
    <div className={`host-poster host--${state}`}>
      <div className="host-card">
        {src ? <img src={src} alt={`${name} (${state})`} draggable={false} /> : <span className="host-fallback">{name[0]}</span>}
      </div>
      <div className="host-caption">
        <strong>{name}</strong>
        <span className="status-pill">
          <i />
          {STATUS[state]}
        </span>
      </div>
    </div>
  )
}
