import { app } from 'electron'
import { existsSync, readFileSync, renameSync, writeFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import type { Settings } from '../shared/types'
import { DEFAULT_PRINT_DEFAULTS } from '../shared/options'

export const DEFAULT_SETTINGS: Settings = {
  hostName: 'Paige',
  hotkey: 'Control+Shift+P',
  startWithWindows: false,
  sourceFolders: [],
  printerName: null,
  printDefaults: { ...DEFAULT_PRINT_DEFAULTS },
  smartMode: true,
  quickMode: false,
  quickModePageLimit: 20,
  firstRunComplete: false,
  settingsVersion: 2
}

/**
 * Settings live in a small JSON file in the user's own app-data folder
 * (%APPDATA%\Print Me Daddy\settings.json), so each person who installs
 * the app gets their own.
 */
export class SettingsStore {
  readonly file = join(app.getPath('userData'), 'settings.json')
  private current: Settings

  constructor() {
    this.current = this.load()
  }

  get(): Settings {
    return { ...this.current, sourceFolders: [...this.current.sourceFolders] }
  }

  set(next: Settings): void {
    this.current = next
    this.save()
  }

  private load(): Settings {
    if (!existsSync(this.file)) return { ...DEFAULT_SETTINGS }
    try {
      const saved = JSON.parse(readFileSync(this.file, 'utf8'))
      // v2: typed requests always get a confirmation pop-up unless quick mode is switched on deliberately.
      if (saved.settingsVersion !== 2) {
        saved.quickMode = false
        saved.settingsVersion = 2
      }
      // Fill in any print defaults added since the file was saved.
      return { ...DEFAULT_SETTINGS, ...saved, printDefaults: { ...DEFAULT_PRINT_DEFAULTS, ...(saved.printDefaults ?? {}) } }
    } catch {
      // A broken file shouldn't stop the app opening: keep a copy and start fresh.
      renameSync(this.file, this.file + '.broken')
      return { ...DEFAULT_SETTINGS }
    }
  }

  private save(): void {
    mkdirSync(dirname(this.file), { recursive: true })
    // Write to a temp file first, then swap, so a crash mid-save can't corrupt it.
    const tmp = this.file + '.tmp'
    writeFileSync(tmp, JSON.stringify(this.current, null, 2))
    renameSync(tmp, this.file)
  }
}
