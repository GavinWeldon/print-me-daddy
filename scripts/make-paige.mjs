// Draws the placeholder Paige artwork (one SVG per mood) into assets/host.
// Run with: npm run paige   (only needed if you change the drawing below)
//
// She's an original pin-up style character: blonde, waist-up, low-cut pink
// crop top, denim shorts, sunglasses pushed up into her hair.
// Every mood shares the same body; only the face, one arm and the props change.
// To use your own artwork instead, just replace the files in assets/host.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'host')

const C = {
  line: '#2a1420',
  skin: '#f9cdb0',
  skinShade: '#eaa98a',
  skinLine: '#c9846a',
  hair: '#f7d065',
  hairShade: '#dca33a',
  hairLight: '#fff2b0',
  brow: '#a8742a',
  top: '#ff3d9a',
  topShade: '#cf1f7a',
  topLight: '#ff9fd0',
  denim: '#3d74d9',
  denimShade: '#2a55a8',
  stitch: '#f0b44c',
  lips: '#e2195f',
  mouth: '#7d0f37',
  iris: '#3fb6d6',
  gold: '#f5c542',
  lens: '#1b1b2a',
  blush: '#ff7aa6'
}
const LW = 2.5 // outline width

const shape = (d, fill, extra = '', w = LW) => `<path d="${d}" fill="${fill}" stroke="${C.line}" stroke-width="${w}" stroke-linejoin="round" ${extra}/>`
const line = (d, colour, w = 2, extra = '') => `<path d="${d}" fill="none" stroke="${colour}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`

// An arm drawn as two thick strokes (upper arm, forearm) with an outline.
function arm(points, widths = [25, 21], colour = C.skin) {
  const [a, b, c] = points
  const seg = (p, q, w, col) => line(`M${p[0]} ${p[1]}L${q[0]} ${q[1]}`, col, w)
  const parts = [seg(a, b, widths[0] + LW * 2, C.line)]
  if (c) parts.push(seg(b, c, widths[1] + LW * 2, C.line))
  parts.push(seg(a, b, widths[0], colour))
  if (c) parts.push(seg(b, c, widths[1], colour))
  return parts.join('')
}

// ---------- Body (shared) ----------
const hairBack = [
  shape('M150 26C100 24 70 62 70 112C70 160 58 196 56 246C55 284 74 302 96 296C92 268 98 236 108 206L192 206C202 236 208 268 204 296C226 302 245 284 244 246C242 196 230 160 230 112C230 62 200 24 150 26Z', C.hair),
  `<path d="M110 150C114 180 110 200 108 212L192 212C190 200 186 180 190 150Z" fill="${C.hairShade}"/>`,
  line('M84 150C80 190 70 230 72 270', C.hairShade, 3),
  line('M216 150C220 190 230 230 228 270', C.hairShade, 3)
].join('')

const torso = [
  // neck
  shape('M137 132L137 178Q150 186 163 178L163 132Z', C.skin),
  `<path d="M137 140Q150 164 163 140L163 134L137 134Z" fill="${C.skinShade}"/>`,
  // trunk
  shape('M136 172C122 182 98 184 84 192C72 199 70 216 76 236C84 262 100 296 110 334C104 356 98 378 96 400L204 400C202 378 196 356 190 334C200 296 216 262 224 236C230 216 228 199 216 192C202 184 178 182 164 172Z', C.skin),
  // collarbones and a little cleavage shading
  line('M116 197Q130 202 141 195', C.skinLine, 1.6),
  line('M184 197Q170 202 159 195', C.skinLine, 1.6),
  line('M141 234C145 244 148 250 150 255', C.skinLine, 1.8),
  line('M159 234C155 244 152 250 150 255', C.skinLine, 1.8),
  // tummy
  line('M150 300L150 312', C.skinLine, 1.2, 'opacity=".5"'),
  line('M149 320q-2 5 1 8', C.skinLine, 2),
  `<path d="M190 334C196 304 208 276 220 246C214 280 204 310 196 336Z" fill="${C.skinShade}" opacity=".6"/>`
].join('')

const cropTop = [
  // straps
  line('M106 212L112 181', C.line, 6 + LW * 2),
  line('M194 212L188 181', C.line, 6 + LW * 2),
  line('M106 212L112 181', C.top, 6),
  line('M194 212L188 181', C.top, 6),
  // low scoop neckline
  shape('M84 220C88 212 100 208 112 210C122 232 134 252 150 257C166 252 178 232 188 210C200 208 212 212 216 220C220 240 214 262 208 286Q150 298 92 286C86 262 80 240 84 220Z', C.top),
  line('M100 232C104 262 132 272 150 259', C.topShade, 2.6),
  line('M200 232C196 262 168 272 150 259', C.topShade, 2.6),
  line('M110 236C114 250 124 258 134 260', C.topLight, 3, 'opacity=".8"'),
  line('M190 236C188 246 182 252 176 256', C.topLight, 2.4, 'opacity=".6"'),
  line('M94 282Q150 293 206 282', C.topShade, 2)
].join('')

const shorts = [
  shape('M108 338Q150 348 192 338L200 400L100 400Z', C.denim),
  shape('M108 338Q150 348 192 338L193 351Q150 361 107 351Z', C.denimShade),
  `<circle cx="150" cy="358" r="3.6" fill="${C.gold}" stroke="${C.line}" stroke-width="1.5"/>`,
  line('M150 364L150 400', C.stitch, 1.5, 'stroke-dasharray="3 3"'),
  line('M120 346L120 358', C.line, 2),
  line('M180 346L180 358', C.line, 2)
].join('')

const necklace = [
  line('M130 181Q150 212 170 181', C.gold, 1.8),
  `<path d="M150 210C142 203 144 197 148 198C149 198 150 199 150 200C150 199 151 198 152 198C156 197 158 203 150 210Z" fill="${C.gold}" stroke="${C.line}" stroke-width="1.2"/>`
].join('')

const head = [
  `<ellipse cx="116" cy="104" rx="7" ry="11" fill="${C.skin}" stroke="${C.line}" stroke-width="${LW}"/>`,
  `<ellipse cx="184" cy="104" rx="7" ry="11" fill="${C.skin}" stroke="${C.line}" stroke-width="${LW}"/>`,
  `<circle cx="115" cy="124" r="9" fill="none" stroke="${C.gold}" stroke-width="3"/>`,
  `<circle cx="185" cy="124" r="9" fill="none" stroke="${C.gold}" stroke-width="3"/>`,
  shape('M116 98C116 66 132 54 150 54C168 54 184 66 184 98C184 124 172 144 150 150C128 144 116 124 116 98Z', C.skin),
  `<path d="M118 110C122 132 134 146 150 150C136 140 126 128 121 106Z" fill="${C.skinShade}" opacity=".55"/>`,
  // nose and beauty mark
  line('M152 104Q149 116 153 119Q150 121 147 119', C.skinLine, 1.8),
  `<circle cx="171" cy="127" r="1.4" fill="${C.line}"/>`
].join('')

const hairFront = [
  // side-swept fringe
  shape('M114 104C104 62 126 38 156 38C188 38 202 66 190 108C186 88 180 76 170 66C158 76 138 82 119 86C117 92 115 98 114 104Z', C.hair),
  shape('M121 86C138 81 156 73 170 66C164 79 148 88 128 91Z', C.hair),
  // long strands falling over the shoulders
  shape('M117 100C106 134 104 170 94 210C91 222 99 228 104 222C112 192 114 150 119 116Z', C.hair),
  shape('M183 100C194 134 196 170 206 210C209 222 201 228 196 222C188 192 186 150 181 116Z', C.hair),
  line('M154 44C138 50 126 64 122 88', C.hairLight, 3, 'opacity=".9"'),
  line('M172 48C186 60 190 80 188 100', C.hairLight, 2.4, 'opacity=".8"'),
  line('M111 146C108 172 104 194 99 212', C.hairLight, 2, 'opacity=".8"'),
  line('M189 146C192 172 196 194 201 212', C.hairShade, 2),
  line('M140 81C150 77 160 72 166 69', C.hairShade, 2)
].join('')

const sunglasses = `<g transform="rotate(-5 150 46)">
  <rect x="119" y="38" width="28" height="17" rx="7" fill="${C.lens}" stroke="${C.top}" stroke-width="3"/>
  <rect x="153" y="38" width="28" height="17" rx="7" fill="${C.lens}" stroke="${C.top}" stroke-width="3"/>
  ${line('M147 45Q150 42 153 45', C.top, 3)}
  ${line('M124 43L131 41', '#ffffff', 2, 'opacity=".7"')}
  ${line('M158 43L165 41', '#ffffff', 2, 'opacity=".7"')}
</g>`

// ---------- Face parts ----------
// Eyes are drawn as a right-hand eye; for the left one (mirror: true) it's drawn
// at the opposite x and flipped back across the centre line.
let clipId = 0
function eye(x, y, { look = [0, 0], lid = 0, mirror = false } = {}) {
  if (mirror) x = 300 - x
  const id = `eye${clipId++}`
  const almond = `M${x - 12} ${y}Q${x} ${y - 9} ${x + 12} ${y - 1}Q${x} ${y + 7} ${x - 12} ${y}Z`
  const lx = x + look[0]
  const ly = y + look[1]
  const body = `
    <clipPath id="${id}"><path d="${almond}"/></clipPath>
    <path d="M${x - 12} ${y - 1}Q${x} ${y - 15} ${x + 14} ${y - 3}Q${x} ${y - 10} ${x - 12} ${y - 1}Z" fill="${C.top}" opacity=".45"/>
    <path d="${almond}" fill="#ffffff"/>
    <g clip-path="url(#${id})">
      <circle cx="${lx}" cy="${ly}" r="5.6" fill="${C.iris}"/>
      <circle cx="${lx}" cy="${ly}" r="2.6" fill="${C.line}"/>
      <circle cx="${lx + 1.8}" cy="${ly - 2}" r="1.6" fill="#ffffff"/>
      ${lid ? `<path d="M${x - 14} ${y - 12}L${x + 14} ${y - 12}L${x + 13} ${y - 2}Q${x} ${y - 9 + lid} ${x - 13} ${y + 1}Z" fill="${C.skin}"/>` : ''}
    </g>
    ${line(`M${x - 13} ${y + 1}Q${x} ${y - 10 + lid} ${x + 13} ${y - 2}`, C.line, 1.8)}
    ${line(`M${x} ${y - 5.25 + lid / 2}Q${x + 6.5} ${y - 6 + lid / 2} ${x + 13} ${y - 2}L${x + 18} ${y - 6}`, C.line, 3.4)}
    ${line(`M${x + 9} ${y - 5 + lid / 2}l3 -5M${x + 5} ${y - 7 + lid / 2}l1.5 -5`, C.line, 1.6)}
    ${line(`M${x - 10} ${y + 2}Q${x} ${y + 7} ${x + 11} ${y}`, C.skinLine, 1.2)}`
  return mirror ? `<g transform="matrix(-1 0 0 1 ${2 * 150} 0)">${body}</g>` : body
}

function closedEye(x, y, { wink = false, mirror = false } = {}) {
  if (mirror) x = 300 - x
  const d = wink ? `M${x - 11} ${y - 1}Q${x} ${y + 6} ${x + 12} ${y - 2}` : `M${x - 11} ${y + 2}Q${x} ${y - 8} ${x + 12} ${y + 1}`
  const body = `${line(d, C.line, 3.2)}${line(`M${x + 11} ${y - 1}l5 -4M${x + 7} ${y - 3}l2 -5`, C.line, 1.6)}`
  return mirror ? `<g transform="matrix(-1 0 0 1 ${2 * 150} 0)">${body}</g>` : body
}

function brow(x, y, kind = 'normal', mirror = false) {
  if (mirror) x = 300 - x
  const d = {
    normal: `M${x - 11} ${y - 14}Q${x} ${y - 20} ${x + 13} ${y - 15}`,
    raised: `M${x - 11} ${y - 17}Q${x} ${y - 26} ${x + 13} ${y - 19}`,
    worried: `M${x - 11} ${y - 21}Q${x} ${y - 19} ${x + 13} ${y - 13}`,
    happy: `M${x - 11} ${y - 16}Q${x} ${y - 23} ${x + 13} ${y - 17}`
  }[kind]
  const body = line(d, C.brow, 3)
  return mirror ? `<g transform="matrix(-1 0 0 1 ${2 * 150} 0)">${body}</g>` : body
}

const blush = (o = 0.35) =>
  `<ellipse cx="126" cy="118" rx="10" ry="5" fill="${C.blush}" opacity="${o}"/><ellipse cx="174" cy="118" rx="10" ry="5" fill="${C.blush}" opacity="${o}"/>`

const mouths = {
  smirk: [
    shape('M137 131Q143 126 150 129Q157 126 165 127Q160 131 150 132Q142 132 137 131Z', C.lips, '', 1.6),
    shape('M137 131Q150 134 165 127Q160 142 150 142Q140 142 137 131Z', C.lips, '', 1.6),
    `<ellipse cx="153" cy="137" rx="4.5" ry="1.6" fill="#ffffff" opacity=".7"/>`,
    line('M165 127q3 -1 4 -4', C.line, 1.6)
  ].join(''),
  pursed: [
    shape('M145 133Q149 128 153 131Q157 128 161 132Q153 135 145 133Z', C.lips, '', 1.6),
    shape('M145 133Q153 135 161 132Q158 141 153 141Q147 141 145 133Z', C.lips, '', 1.6),
    `<ellipse cx="154" cy="137.5" rx="2.6" ry="1.2" fill="#ffffff" opacity=".7"/>`
  ].join(''),
  grin: [
    shape('M133 127Q150 134 167 127Q165 147 150 148Q135 147 133 127Z', C.mouth),
    `<path d="M137 129Q150 134 163 129L162 135Q150 139 138 135Z" fill="#ffffff"/>`,
    `<path d="M141 143Q150 139 159 143Q155 147 150 147Q145 147 141 143Z" fill="#ff6f9c"/>`,
    line('M133 127Q150 134 167 127Q165 147 150 148Q135 147 133 127Z', C.lips, 3)
  ].join(''),
  oh: [`<ellipse cx="150" cy="135" rx="6" ry="7.5" fill="${C.mouth}" stroke="${C.lips}" stroke-width="3.4"/>`].join('')
}

const sparkle = (x, y, s, fill = '#ffffff') =>
  `<path transform="translate(${x} ${y})" d="M0 ${-s}Q${s * 0.12} ${-s * 0.12} ${s} 0Q${s * 0.12} ${s * 0.12} 0 ${s}Q${-s * 0.12} ${s * 0.12} ${-s} 0Q${-s * 0.12} ${-s * 0.12} 0 ${-s}Z" fill="${fill}"/>`

const paper = (x, y, rot, w = 56, h = 72) => `<g transform="rotate(${rot} ${x + w / 2} ${y + h / 2})">
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="#ffffff" stroke="${C.line}" stroke-width="${LW}"/>
  ${[0.2, 0.34, 0.48, 0.62].map((f, i) => line(`M${x + 9} ${y + h * f}h${i === 3 ? w * 0.4 : w - 18}`, C.top, 3.5)).join('')}
</g>`

// ---------- Arms per mood ----------
const LEFT_ARM = arm([[82, 206], [56, 292], [124, 330]]) // hand tucked on her hip
const RIGHT_SHOULDER = [218, 206]

const moods = {
  idle: {
    behind: arm([RIGHT_SHOULDER, [244, 292], [176, 330]]),
    face: [brow(134, 100, 'normal', true), brow(166, 100, 'raised'), eye(134, 100, { lid: 2.5, mirror: true, look: [1, 1] }), eye(166, 100, { lid: 2.5, look: [-1, 1] }), blush(), mouths.smirk].join(''),
    front: '',
    props: sparkle(232, 70, 9) + sparkle(250, 92, 5)
  },
  thinking: {
    behind: arm([RIGHT_SHOULDER, [240, 296]], [25]),
    face: [brow(134, 100, 'normal', true), brow(166, 100, 'raised'), eye(134, 100, { look: [-3, -3], mirror: true }), eye(166, 100, { look: [3, -3] }), blush(0.25), mouths.pursed].join(''),
    front: [
      arm([[240, 296], [184, 168]], [21]),
      `<ellipse cx="177" cy="160" rx="13" ry="11" transform="rotate(-35 177 160)" fill="${C.skin}" stroke="${C.line}" stroke-width="${LW}"/>`,
      line('M170 154L163 138', C.line, 7 + LW * 2),
      line('M170 154L163 138', C.skin, 7),
      line('M176 164l7 -6M180 168l6 -5', C.skinLine, 1.4)
    ].join(''),
    props: `<g fill="${C.topLight}" stroke="${C.line}" stroke-width="2"><circle cx="222" cy="58" r="6"/><circle cx="240" cy="40" r="9"/><circle cx="264" cy="22" r="12"/></g>`
  },
  printing: {
    behind: arm([RIGHT_SHOULDER, [258, 176]], [25]),
    face: [brow(134, 100, 'happy', true), brow(166, 100, 'happy'), closedEye(134, 100, { mirror: true }), closedEye(166, 100), blush(0.5), mouths.grin].join(''),
    front: [
      paper(230, 34, 8),
      arm([[258, 176], [256, 116]], [21]),
      `<ellipse cx="255" cy="106" rx="12" ry="13" fill="${C.skin}" stroke="${C.line}" stroke-width="${LW}"/>`,
      line('M246 100l-4 -6', C.line, 6 + LW * 2),
      line('M246 100l-4 -6', C.skin, 6)
    ].join(''),
    props: paper(14, 30, -18, 40, 52) + paper(40, 330, 14, 36, 46) + sparkle(64, 120, 9) + sparkle(278, 150, 7) + sparkle(30, 230, 6)
  },
  error: {
    behind: arm([RIGHT_SHOULDER, [248, 150]], [25]),
    face: [brow(134, 100, 'worried', true), brow(166, 100, 'worried'), eye(134, 100, { mirror: true }), eye(166, 100), blush(0.3), mouths.oh].join(''),
    front: [
      arm([[248, 150], [190, 84]], [21]),
      `<ellipse cx="180" cy="74" rx="15" ry="11" transform="rotate(-28 180 74)" fill="${C.skin}" stroke="${C.line}" stroke-width="${LW}"/>`,
      line('M168 70l-6 -4M170 78l-7 -2M172 84l-6 0', C.skinLine, 1.6)
    ].join(''),
    props: [
      shape('M116 66q7 10 0 15q-7 -5 0 -15Z', '#7fd4ff'),
      `<circle cx="258" cy="40" r="17" fill="#ffb35c" stroke="${C.line}" stroke-width="${LW}"/>`,
      `<rect x="255" y="28" width="6" height="15" rx="3" fill="${C.line}"/><circle cx="258" cy="49" r="3.4" fill="${C.line}"/>`
    ].join('')
  }
}

function render(name, mood) {
  clipId = 0
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400">
<!-- Placeholder Paige (${name}). Generated by scripts/make-paige.mjs. Replace this file with your own art (any of svg/png/gif/webp/jpg, same name). -->
<defs><filter id="neon" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="#ff3d9a" flood-opacity=".75"/></filter></defs>
<g filter="url(#neon)">
${hairBack}
${LEFT_ARM}
${mood.behind}
${torso}
${cropTop}
${shorts}
${necklace}
${head}
${mood.face}
${hairFront}
${sunglasses}
${mood.front}
</g>
${mood.props}
</svg>
`
}

mkdirSync(outDir, { recursive: true })
for (const [name, mood] of Object.entries(moods)) {
  writeFileSync(join(outDir, `${name}.svg`), render(name, mood))
  console.log(`wrote assets/host/${name}.svg`)
}
