// Builds the graffiti-style "PRINT ME DADDY" logo as an SVG image.
// Run with: npm run logo   (only needed if you change the design below)
//
// The letters start from the free Knewave font, then get the graffiti treatment:
// tilted and overlapping letters, thick black outlines, a 3D drop shadow,
// a bubbly white cloud behind, gradient paint, a rim of shine and sparkles.
import opentype from 'opentype.js'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const fontFile = join(root, 'node_modules/@fontsource/knewave/files/knewave-latin-400-normal.woff')
const buf = readFileSync(fontFile)
const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))

// ---- Design knobs ----
const OUTLINE = 8 // black outline around letters
const FAT = 5 // extra paint around each letter to make it chunkier
const CLOUD = 34 // how far the white cloud reaches past the letters
const EXTRUDE = { dx: 3.5, dy: 5, steps: 5 } // 3D drop shadow
const OVERLAP = 6 // how far DADDY tucks up under PRINT ME

const LINES = [
  {
    id: 'top',
    text: 'PRINT ME',
    size: 195,
    tight: 0.97,
    rot: [-2, 1, -1, 2, -1, 0, 2, -1],
    dy: [0, -3, 2, -2, 2, 0, -2, 1],
    shadow: '#0b3f86'
  },
  {
    id: 'bottom',
    text: 'DADDY',
    size: 300,
    tight: 0.93,
    rot: [-3, 2, -1, 2, -2],
    dy: [2, -5, 3, -4, 1],
    shadow: '#4b1576'
  }
]

// ---- Lay out the letters ----

// Our own path writer: opentype.js's toPathData() prints "NaN" for numbers
// like 51.00000000000001, which silently deletes letters (Knewave's P and N).
const num = (v) => String(Math.round(v * 100) / 100)
function pathData(commands) {
  return commands
    .map((c) => {
      if (c.type === 'M' || c.type === 'L') return `${c.type}${num(c.x)} ${num(c.y)}`
      if (c.type === 'Q') return `Q${num(c.x1)} ${num(c.y1)} ${num(c.x)} ${num(c.y)}`
      if (c.type === 'C') return `C${num(c.x1)} ${num(c.y1)} ${num(c.x2)} ${num(c.y2)} ${num(c.x)} ${num(c.y)}`
      return 'Z'
    })
    .join('')
}

function layoutLine(line, baseline) {
  const letters = []
  let x = 0
  let i = 0
  for (const ch of line.text) {
    if (ch !== ' ') {
      const glyph = font.charToGlyph(ch)
      const path = glyph.getPath(0, 0, line.size)
      letters.push({ d: pathData(path.commands), x, y: baseline + (line.dy[i] ?? 0), rot: line.rot[i] ?? 0, bb: path.getBoundingBox() })
      x += (glyph.advanceWidth * line.size * line.tight) / font.unitsPerEm
    } else {
      x += line.size * 0.24
    }
    i++
  }
  return { letters, width: x }
}

const box = (l) => ({ x1: l.x + l.bb.x1, x2: l.x + l.bb.x2, y1: l.y + l.bb.y1, y2: l.y + l.bb.y2 })
const span = (line) => {
  const boxes = line.letters.map(box)
  return {
    x1: Math.min(...boxes.map((b) => b.x1)),
    x2: Math.max(...boxes.map((b) => b.x2)),
    y1: Math.min(...boxes.map((b) => b.y1)),
    y2: Math.max(...boxes.map((b) => b.y2))
  }
}

const top = layoutLine(LINES[0], 0)
// DADDY's tops sit just under PRINT ME's baseline, overlapping a little like a real piece.
const bottomBaseline = span(top).y2 - span(layoutLine(LINES[1], 0)).y1 - OVERLAP
const bottom = layoutLine(LINES[1], bottomBaseline)

// Centre both lines on each other.
const centre = (line, mid) => {
  const s = span(line)
  const shift = mid - (s.x1 + s.x2) / 2
  for (const l of line.letters) l.x += shift
}
centre(bottom, 0)
centre(top, 10)

const all = [...top.letters, ...bottom.letters]
const bounds = span({ letters: all })

const transform = (l) => {
  const cx = (l.bb.x1 + l.bb.x2) / 2
  const cy = (l.bb.y1 + l.bb.y2) / 2
  return `translate(${l.x.toFixed(1)} ${l.y.toFixed(1)}) rotate(${l.rot} ${cx.toFixed(1)} ${cy.toFixed(1)})`
}
const letterPaths = (letters) => letters.map((l) => `<path d="${l.d}" transform="${transform(l)}"/>`).join('')

// Puffs make the cloud bubbly instead of just following the letters.
const puffs = []
for (const l of all) {
  const b = box(l)
  const w = b.x2 - b.x1
  puffs.push([b.x1 + w * 0.5, b.y1 + 6, w * 0.22])
  puffs.push([b.x1 + w * 0.5, b.y2 + EXTRUDE.dy * EXTRUDE.steps - 4, w * 0.2])
}
const puffCircles = puffs.map(([cx, cy, r]) => `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}"/>`).join('')

// Four-point sparkles.
const sparkle = (x, y, s) =>
  `<path transform="translate(${x.toFixed(1)} ${y.toFixed(1)})" d="M0 ${-s} Q${s * 0.12} ${-s * 0.12} ${s} 0 Q${s * 0.12} ${s * 0.12} 0 ${s} Q${-s * 0.12} ${s * 0.12} ${-s} 0 Q${-s * 0.12} ${-s * 0.12} 0 ${-s} Z"/>`
const lb = (line, i) => box(line.letters[i])
const sparkles = [
  sparkle(lb(bottom, 0).x1 + 45, lb(bottom, 0).y1 + 40, 26),
  sparkle(lb(bottom, 4).x2 - 40, lb(bottom, 4).y1 + 24, 34),
  sparkle(lb(bottom, 2).x1 + 70, lb(bottom, 2).y1 + 60, 14),
  sparkle(lb(top, 0).x1 + 26, lb(top, 0).y1 + 22, 18),
  sparkle(lb(top, top.letters.length - 1).x2 - 8, lb(top, top.letters.length - 1).y1 + 8, 22)
].join('')

const pad = CLOUD + OUTLINE + FAT + 30
const vb = {
  x: Math.floor(bounds.x1 - pad),
  y: Math.floor(bounds.y1 - pad),
  w: Math.ceil(bounds.x2 - bounds.x1 + pad * 2 + EXTRUDE.dx * EXTRUDE.steps),
  h: Math.ceil(bounds.y2 - bounds.y1 + pad * 2 + EXTRUDE.dy * EXTRUDE.steps)
}

const thick = (w) => `stroke-width="${w}" stroke-linejoin="round"`

const extrude = (id, colour) => {
  const { dx, dy, steps } = EXTRUDE
  let out = `<use href="#${id}" transform="translate(${dx * steps} ${dy * steps})" fill="${colour}" stroke="#0d0710" ${thick((OUTLINE + FAT) * 2)}/>`
  for (let k = steps; k >= 1; k--) {
    out += `<use href="#${id}" transform="translate(${dx * k} ${dy * k})" fill="${colour}" stroke="${colour}" ${thick(FAT * 2)}/>`
  }
  return out
}

// Gradients are measured in each letter's own coordinates (before it's moved into place),
// so every letter fades top to bottom the same way.
const grad = (id, line, stops) => {
  const y1 = Math.min(...line.letters.map((l) => l.bb.y1))
  const y2 = Math.max(...line.letters.map((l) => l.bb.y2))
  return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="${y1.toFixed(0)}" x2="0" y2="${y2.toFixed(0)}">${stops
    .map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`)
    .join('')}</linearGradient>`
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}">
<!-- Print Me Daddy logo. Generated by scripts/make-logo.mjs; edit that, not this. -->
<defs>
  ${grad('cyan', top, [[0, '#c8f9ff'], [0.35, '#4fdcff'], [1, '#0f8fe0']])}
  ${grad('pink', bottom, [[0, '#ffa6d6'], [0.3, '#ff45a5'], [0.65, '#d81f8f'], [1, '#6c1aa6']])}
  <filter id="glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14"/></filter>
  <filter id="sparkleGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <g id="top">${letterPaths(top.letters)}</g>
  <g id="bottom">${letterPaths(bottom.letters)}</g>
  <g id="cloud"><use href="#top"/><use href="#bottom"/>${puffCircles}</g>
  <mask id="rim" maskUnits="userSpaceOnUse" x="${vb.x}" y="${vb.y}" width="${vb.w}" height="${vb.h}">
    <use href="#top" fill="#fff" stroke="#fff" ${thick(FAT * 2 - 3)}/>
    <use href="#bottom" fill="#fff" stroke="#fff" ${thick(FAT * 2 - 3)}/>
    <use href="#top" transform="translate(4 6)" fill="#000" stroke="#000" ${thick(FAT * 2)}/>
    <use href="#bottom" transform="translate(5 8)" fill="#000" stroke="#000" ${thick(FAT * 2)}/>
  </mask>
</defs>

<!-- neon glow behind the cloud -->
<use href="#cloud" fill="#ff3d9a" stroke="#ff3d9a" ${thick((CLOUD + OUTLINE) * 2 + 16)} filter="url(#glow)" opacity=".55"/>
<!-- the white cloud with its black edge -->
<use href="#cloud" fill="#0d0710" stroke="#0d0710" ${thick((CLOUD + OUTLINE) * 2)}/>
<use href="#cloud" fill="#ffffff" stroke="#ffffff" ${thick(CLOUD * 2)}/>

<!-- 3D drop shadows -->
${extrude('bottom', LINES[1].shadow)}
${extrude('top', LINES[0].shadow)}

<!-- outlines, then paint -->
<use href="#bottom" fill="#0d0710" stroke="#0d0710" ${thick((OUTLINE + FAT) * 2)}/>
<use href="#bottom" fill="url(#pink)" stroke="url(#pink)" ${thick(FAT * 2)}/>
<use href="#top" fill="#0d0710" stroke="#0d0710" ${thick((OUTLINE + FAT) * 2)}/>
<use href="#top" fill="url(#cyan)" stroke="url(#cyan)" ${thick(FAT * 2)}/>

<!-- shine: a crescent of light along the top-left edges (each letter minus a nudged copy) -->
<rect x="${vb.x}" y="${vb.y}" width="${vb.w}" height="${vb.h}" fill="#ffffff" opacity=".85" mask="url(#rim)"/>

<!-- sparkles -->
<g fill="#ffffff" filter="url(#sparkleGlow)">${sparkles}</g>
</svg>
`

const outDir = join(root, 'assets', 'brand')
mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'logo.svg'), svg)
console.log(`wrote assets/brand/logo.svg (${Math.round(svg.length / 1024)} KB)`)
