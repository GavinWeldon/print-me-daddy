// Everything the host says lives here, so her voice is easy to tweak.
// Personality: confident, flirty, cheeky, funny, always helpful, never explicit.

import { describePrinterFeatures } from '../../shared/printerWords'

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

export function chitChat(): string {
  return pick([
    `Flattered you want to chat, but I'm a printing girl. Tell me what to print, or drop a file on me. 😉`,
    `Mm, small talk. Cute. My big brain arrives in the next update; for now, tell me a file to print.`,
    `I only have eyes for your documents right now, darling. What are we printing?`
  ])
}

export function needFolders(): string {
  return `I don't know where your files live yet, darling. Open ⚙ Settings, add your document folders, then ask me again. (Or just drop the files on me.)`
}

export function stillIndexing(): string {
  return `Still flicking through your folders, gorgeous. Give me a moment and ask again.`
}

export function nothingMentioned(): string {
  return `Print what, gorgeous? Give me a file name, like "print my CV".`
}

export function notFound(chunks: string[]): string {
  return `I couldn't find anything like ${chunks.map((c) => `"${c}"`).join(' or ')} in your folders. Check the spelling, or drop the file on me.`
}

export function tooComplex(): string {
  return `Ooh, that one needs my big brain, and she arrives in the next update. For now, tell me the files one by one ("print x, then y"), or drop them on me.`
}

export function smartThinking(): string {
  return pick([
    `Ooh, a thinker. Give me a sec to work this one out… 🤔`,
    `Mm, let me put my big brain on. One moment, gorgeous.`,
    `Tricky. I like tricky. Thinking…`
  ])
}

export function smartUnavailable(reason?: string): string {
  const why =
    reason === 'not-installed'
      ? "Claude Code isn't installed on this PC"
      : reason === 'signed-out'
        ? "Claude Code isn't signed in on this PC (run \"claude auth login\" once)"
        : 'smart mode is switched off in Settings'
  return `That one needs my big brain, darling, and she's not available: ${why}. Tell me the files one by one ("print x, then y") and I'll handle it.`
}

export function smartFailed(reason: string): string {
  return `My big brain hiccupped (${reason}). Here's my best guess instead, so give it a careful look.`
}

export function printerSettingsChanged(what: string[], printer: string): string {
  return pick([
    `Done: ${what.join(' and ')} from now on, on ${printer}. 💋`,
    `Switched ${printer} to ${what.join(' and ')}. Consider it handled.`
  ])
}

export function printerSettingsNow(printer: string, lines: string[]): string {
  return `Here's how ${printer} is set up right now, gorgeous:\n${lines.map((l) => '• ' + l).join('\n')}\nWant anything changed? Just say, e.g. "switch to high quality".`
}

export function printerSettingsFailed(reason: string): string {
  return `I tried, but the printer said no: ${reason}`
}

export function mergeLater(): string {
  return `Stitching them into one PDF comes in a later update, so I'll print them one after another in that order instead.`
}

/** "2 copies, black & white, double-sided" */
export function describeOptions(o: {
  copies: number
  color: string
  duplex: string
  pages: string
  pagesPerSheet: number
  printerFeatures?: Record<string, string>
}): string {
  const parts: string[] = []
  if (o.copies > 1) parts.push(`${o.copies} copies`)
  parts.push(o.color === 'mono' ? 'black & white' : 'colour')
  if (o.duplex === 'long') parts.push('double-sided')
  if (o.duplex === 'short') parts.push('double-sided (short edge)')
  if (o.pages.trim()) parts.push(`pages ${o.pages}`)
  if (o.pagesPerSheet > 1) parts.push(`${o.pagesPerSheet} per sheet`)
  parts.push(...describePrinterFeatures(o.printerFeatures ?? {}))
  return parts.join(', ')
}

const ordered = (names: string[]) => (names.length > 4 ? `${names.slice(0, 3).join(', then ')} and ${names.length - 3} more` : names.join(', then '))

export function quickPrint(names: string[], settings: string): string {
  return pick([`On it: ${ordered(names)}. ${settings}. 💋`, `Coming right up: ${ordered(names)}, ${settings}.`])
}

export function planReady(names: string[], settings: string, unsure: boolean): string {
  return unsure
    ? `Here's my best guess: ${ordered(names)}, ${settings}. I wasn't sure about everything, so check the list before you hit Print.`
    : `Here's the plan: ${ordered(names)}, ${settings}. Hit Print when you're ready.`
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
