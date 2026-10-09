// Draws the placeholder app/tray icon (a pink printer) and saves it as PNG files.
// Run with: npm run icons   (only needed if you change the drawing below)
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'icon')

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
const PINK = hex('#ff3d9a')
const DARK = hex('#1c1822')
const SLOT = hex('#0b0a0e')
const WHITE = hex('#ffffff')
const LIGHT = hex('#ff9fd0')

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
function roundRect(x0, y0, x1, y1, r) {
  return (x, y) => {
    if (x < x0 || x > x1 || y < y0 || y > y1) return false
    const cx = clamp(x, x0 + r, x1 - r)
    const cy = clamp(y, y0 + r, y1 - r)
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r
  }
}
const circle = (cx, cy, r) => (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r

// Painted bottom to top, on a 256x256 canvas.
const shapes = [
  [roundRect(8, 8, 248, 248, 56), PINK],
  [roundRect(80, 34, 176, 112, 6), WHITE], // paper going in
  [roundRect(36, 96, 220, 186, 26), DARK], // printer body
  [roundRect(70, 148, 186, 160, 4), SLOT],
  [roundRect(84, 154, 172, 230, 6), WHITE], // paper coming out
  [roundRect(98, 174, 158, 181, 3), PINK],
  [roundRect(98, 190, 158, 197, 3), PINK],
  [roundRect(98, 206, 138, 213, 3), PINK],
  [circle(192, 122, 8), LIGHT]
]

function colourAt(x, y) {
  let c = null
  for (const [hit, colour] of shapes) if (hit(x, y)) c = colour
  return c
}

function render(size) {
  const px = Buffer.alloc(size * size * 4)
  const scale = 256 / size
  const ss = 4 // 4x4 samples per pixel for smooth edges
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const c = colourAt((x + (sx + 0.5) / ss) * scale, (y + (sy + 0.5) / ss) * scale)
          if (c) {
            r += c[0]; g += c[1]; b += c[2]; a++
          }
        }
      }
      const i = (y * size + x) * 4
      if (a) {
        px[i] = Math.round(r / a); px[i + 1] = Math.round(g / a); px[i + 2] = Math.round(b / a)
      }
      px[i + 3] = Math.round((a / (ss * ss)) * 255)
    }
  }
  return encodePng(size, size, px)
}

// ---- Minimal PNG encoder ----
const CRC = new Uint32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
function crc32(buf) {
  let c = 0xffffffff
  for (const byte of buf) c = CRC[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}
function encodePng(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h)
  for (let y = 0; y < h; y++) rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4)
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

mkdirSync(outDir, { recursive: true })
for (const [name, size] of [['icon.png', 256], ['tray.png', 16], ['tray@2x.png', 32]]) {
  writeFileSync(join(outDir, name), render(size))
  console.log(`wrote assets/icon/${name} (${size}x${size})`)
}
