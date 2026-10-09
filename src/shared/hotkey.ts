// Turns Electron's shortcut names into what people expect to read,
// e.g. "Control+Shift+P" -> "Ctrl+Shift+P".
export function prettyHotkey(accelerator: string): string {
  return accelerator
    .split('+')
    .map((part) => (part === 'Control' ? 'Ctrl' : part === 'Super' ? 'Win' : part))
    .join('+')
}
