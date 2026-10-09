// Everything the host says lives here, so her voice is easy to tweak.
// Personality: confident, flirty, cheeky, funny, always helpful, never explicit.

function pick(lines: string[]): string {
  return lines[Math.floor(Math.random() * lines.length)]
}

export function greeting(name: string): string {
  return pick([
    `Hey gorgeous, I'm ${name}. Tell me what you want printed and consider it done. 💋`,
    `Well hello there. ${name}, at your service. What are we putting on paper today?`,
    `${name} here. Type it, drop it, or just bat your eyelashes and I'll work it out. 😉`
  ])
}

export function placeholderReply(text: string): string {
  const short = text.length > 60 ? text.slice(0, 57) + '...' : text
  return pick([
    `"${short}"? Love the ambition. My printer hands arrive in the next update, so for now I'm just here looking pretty. 😉`,
    `I'd print that in a heartbeat, darling, but nobody's plugged me into a printer yet. Next phase, I promise. 💅`,
    `Noted, gorgeous. Once they connect me to a printer, you won't be able to stop me.`,
    `Ooh, demanding. I like it. Give me one more update and I'll make it happen.`
  ])
}

export function filesDropped(names: string[]): string {
  const list = names.length > 3 ? `${names.slice(0, 3).join(', ')} and ${names.length - 3} more` : names.join(', ')
  return `Ooh, ${names.length === 1 ? 'a file' : `${names.length} files`} for me? (${list}) Drag-and-drop printing lands in the next update. I'll remember how good that felt.`
}

export function moodReply(state: string): string {
  const lines: Record<string, string> = {
    idle: `Back to my resting face. Still flawless.`,
    thinking: `This is my thinking face. Deep, mysterious, slightly smouldering.`,
    printing: `My printing face. Try not to stare.`,
    error: `My error face. Not my best angle, be kind.`
  }
  return lines[state] ?? lines.idle
}

export function hotkeyTaken(hotkey: string): string {
  return `Someone else already grabbed ${hotkey}, so I can't pop up with it. Pick a different shortcut in Settings and I'll come running.`
}

export function trayHint(name: string, hotkey: string): string {
  return `${name} is hiding in your tray. Press ${hotkey} whenever you need her.`
}
