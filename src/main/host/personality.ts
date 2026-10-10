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
    `"${short}"? Love the ambition. I can't find files by name just yet, so drag them onto me and I'll print them right now. 😉`,
    `I'm still learning to read your mind, darling. For now, drop the files on me and I'll handle the rest. 💅`,
    `Typing requests is coming in my next update. Drag and drop me something in the meantime?`
  ])
}

const list = (names: string[]) => (names.length > 3 ? `${names.slice(0, 3).join(', ')} and ${names.length - 3} more` : names.join(', '))
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

export function jobReady(files: number, pages: number): string {
  return pick([
    `Ooh, ${plural(files, 'file')}, ${plural(pages, 'page')}. Check the details and hit Print when you're ready. 💋`,
    `Got them. ${plural(pages, 'page')} lined up and waiting for your say-so.`,
    `Mmm, fresh documents. Have a look, tweak anything you like, then Print.`
  ])
}

export function officeLater(names: string[]): string {
  return `I can't do Word, PowerPoint or Excel files just yet (${list(names)}). That's coming in a later update, promise. Save them as PDF and I'm all yours.`
}

export function unsupported(names: string[]): string {
  return `I don't know how to print ${list(names)}, darling. PDFs and pictures are my thing.`
}

export function printing(printer: string): string {
  return pick([`Sending it to ${printer}. Warm up the paper tray. 🔥`, `Off to ${printer} it goes.`, `On it. ${printer}, do your thing.`])
}

export function printed(pages: number, printer: string): string {
  return pick([
    `Done! ${plural(pages, 'page')} sent to ${printer}. Hot off the press. 💋`,
    `All sent to ${printer}. ${plural(pages, 'page')} of pure perfection.`,
    `That's ${plural(pages, 'page')} on their way. Go grab them, gorgeous.`
  ])
}

export function printFailed(reason: string): string {
  return `Ugh, that didn't work: ${reason} Check the printer's on and has paper, then try again?`
}

export function cancelled(): string {
  return pick([`Cancelled. Consider it forgotten.`, `Stopped. Changed your mind? I'll allow it.`])
}

export function testPageSent(printer: string): string {
  return `Test page sent to ${printer}. If the colours look gorgeous and the border's all there, we're in business. 💋`
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
