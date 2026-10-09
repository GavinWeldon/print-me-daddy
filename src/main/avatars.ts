import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { HOST_STATES, type Avatars } from '../shared/types'

const MIME: Record<string, string> = {
  svg: 'image/svg+xml',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg'
}

/**
 * Looks in the assets/host folder for idle.*, thinking.*, printing.* and error.*
 * (any of svg/png/gif/webp/jpg), so artwork can be swapped without touching code.
 * Any missing state falls back to the idle picture.
 */
export function loadAvatars(folder: string): Avatars {
  const avatars: Avatars = {}
  for (const state of HOST_STATES) {
    for (const ext of Object.keys(MIME)) {
      const file = join(folder, `${state}.${ext}`)
      if (existsSync(file)) {
        avatars[state] = `data:${MIME[ext]};base64,${readFileSync(file).toString('base64')}`
        break
      }
    }
  }
  for (const state of HOST_STATES) avatars[state] ??= avatars.idle
  return avatars
}
