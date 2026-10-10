// Makes the app and tray icons from art/source/app-icon.webp.
// The picture itself isn't changed, only resized to the sizes Windows needs.
// Run with: npm run icons   (after replacing art/source/app-icon.webp)
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(root, 'art', 'source', 'app-icon.webp')
const outDir = join(root, 'assets', 'icon')
mkdirSync(outDir, { recursive: true })

for (const [name, size] of [
  ['icon.png', 512], // window, taskbar and installer icon
  ['tray.png', 16], // system tray (normal screens)
  ['tray@2x.png', 32] // system tray (high-DPI screens)
]) {
  await sharp(source).resize(size, size, { kernel: 'lanczos3' }).png().toFile(join(outDir, name))
  console.log(`wrote assets/icon/${name} (${size}x${size})`)
}
