/**
 * Checks From Memory's prompt pool.
 *
 * The game's whole effect depends on the reference drawing being right: it is
 * overlaid directly on top of what you drew, in the same 200×140 box, and the
 * moment it sits off-centre or runs off the edge the comparison stops meaning
 * anything. You cannot see that by reading a path, so this parses every
 * coordinate out of every shape and checks where it lands.
 *
 *   node scripts/check-memory.mjs [--verbose]
 */
import { ITEMS, ROUND_SIZE, pickRound } from '../src/data/memory.ts'

const VERBOSE = process.argv.includes('--verbose')
const W = 200
const H = 140
/** Strokes are 2.4 wide and round-capped, so a hair outside the box is fine. */
const SLACK = 4

let failures = 0
const report = (label, ok, extra = '') => {
  if (!ok) failures++
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${extra ? '  ' + extra : ''}`)
}

console.log(`\n${ITEMS.length} prompts, ${ROUND_SIZE} per sitting\n`)

/* -------------------------------------------------------------------------- */
/* The writing                                                                */
/* -------------------------------------------------------------------------- */

console.log('the prompts')
report('there are 16', ITEMS.length === 16, String(ITEMS.length))
const ids = ITEMS.map((i) => i.id)
report('ids are unique', new Set(ids).size === ids.length)
const prompts = ITEMS.map((i) => i.prompt.toLowerCase())
report('prompts are unique', new Set(prompts).size === prompts.length)
report('every prompt is a thing to draw', ITEMS.every((i) => i.prompt.length > 4))
report('every reveal is named', ITEMS.every((i) => i.reveal.length > 3))
// The fact is the payload — it is the bit that tells you what you got wrong.
report('every fact explains the mistake', ITEMS.every((i) => i.fact.length > 50))
report('and none of them is a stub', ITEMS.every((i) => /[.!]$/.test(i.fact.trim())))

/* -------------------------------------------------------------------------- */
/* The drawings                                                               */
/* -------------------------------------------------------------------------- */

console.log('\nevery reference fits the box it is drawn over')

const ALLOWED = new Set(['path', 'circle', 'ellipse'])

/** Every element name used, so a typo like <cirlce> cannot slip through. */
function tags(svg) {
  return [...svg.matchAll(/<([a-zA-Z]+)/g)].map((m) => m[1])
}

/**
 * Points along an elliptical arc, sampled.
 *
 * The obvious shortcut — expand the chord's box by one radius in each
 * direction — is wrong by a mile: a semicircle 160 wide came out as 320 wide
 * and flagged three drawings that render perfectly. This is the endpoint-to-
 * centre conversion from the SVG specification, sampled densely enough that the
 * bounding box is right to well under a pixel.
 */
function arcPoints(x1, y1, rx, ry, rotDeg, fa, fs, x2, y2) {
  if (!rx || !ry) return [[x2, y2]]
  rx = Math.abs(rx); ry = Math.abs(ry)
  const phi = (rotDeg * Math.PI) / 180
  const cosP = Math.cos(phi), sinP = Math.sin(phi)
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2
  const x1p = cosP * dx + sinP * dy
  const y1p = -sinP * dx + cosP * dy

  // An arc whose radii are too small to reach is scaled up until it just does.
  const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry)
  if (lam > 1) { const s = Math.sqrt(lam); rx *= s; ry *= s }

  const sign = fa !== fs ? 1 : -1
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p
  const co = den === 0 ? 0 : sign * Math.sqrt(Math.max(0, num / den))
  const cxp = (co * rx * y1p) / ry
  const cyp = (-co * ry * x1p) / rx
  const cx = cosP * cxp - sinP * cyp + (x1 + x2) / 2
  const cy = sinP * cxp + cosP * cyp + (y1 + y2) / 2

  const ang = (ux, uy, vx, vy) => {
    const d = (ux * vx + uy * vy) / (Math.hypot(ux, uy) * Math.hypot(vx, vy))
    const a = Math.acos(Math.min(1, Math.max(-1, d)))
    return ux * vy - uy * vx < 0 ? -a : a
  }
  const ux = (x1p - cxp) / rx, uy = (y1p - cyp) / ry
  const vx = (-x1p - cxp) / rx, vy = (-y1p - cyp) / ry
  const t1 = ang(1, 0, ux, uy)
  let dt = ang(ux, uy, vx, vy)
  if (!fs && dt > 0) dt -= 2 * Math.PI
  if (fs && dt < 0) dt += 2 * Math.PI

  const out = []
  const STEPS = 64
  for (let k = 0; k <= STEPS; k++) {
    const t = t1 + (dt * k) / STEPS
    out.push([
      cx + rx * Math.cos(t) * cosP - ry * Math.sin(t) * sinP,
      cy + rx * Math.cos(t) * sinP + ry * Math.sin(t) * cosP,
    ])
  }
  return out
}

/**
 * Pull the coordinates out of one path's `d`.
 *
 * Only the commands these drawings actually use are handled, and arcs need
 * care: of an arc's seven numbers only the last two are a point, and treating
 * the radii or the flags as coordinates would report nonsense.
 */
function pathPoints(d) {
  const pts = []
  let x = 0
  let y = 0
  const tokens = d.match(/[MmLlHhVvCcQqSsTtAaZz]|-?\d*\.?\d+/g) || []
  let i = 0
  let cmd = ''
  while (i < tokens.length) {
    if (/[A-Za-z]/.test(tokens[i])) { cmd = tokens[i]; i++; continue }
    const rel = cmd === cmd.toLowerCase()
    const num = () => Number(tokens[i++])
    const up = (nx, ny) => { x = rel ? x + nx : nx; y = rel ? y + ny : ny; pts.push([x, y]) }
    switch (cmd.toUpperCase()) {
      case 'M': case 'L': case 'T': up(num(), num()); break
      case 'H': { const nx = num(); x = rel ? x + nx : nx; pts.push([x, y]); break }
      case 'V': { const ny = num(); y = rel ? y + ny : ny; pts.push([x, y]); break }
      case 'C': { const c = [num(), num(), num(), num(), num(), num()]
        // Control points count: a curve can bulge past its own endpoints.
        pts.push([rel ? x + c[0] : c[0], rel ? y + c[1] : c[1]])
        pts.push([rel ? x + c[2] : c[2], rel ? y + c[3] : c[3]])
        up(c[4], c[5]); break }
      case 'S': case 'Q': { const c = [num(), num(), num(), num()]
        pts.push([rel ? x + c[0] : c[0], rel ? y + c[1] : c[1]])
        up(c[2], c[3]); break }
      case 'A': { const rx = num(), ry = num(), rot = num(), fa = num(), fs = num()
        const ex = num(), ey = num()
        const nx = rel ? x + ex : ex
        const ny = rel ? y + ey : ey
        pts.push(...arcPoints(x, y, rx, ry, rot, fa, fs, nx, ny))
        x = nx; y = ny; pts.push([x, y]); break }
      case 'Z': break
      default: i++
    }
  }
  return pts
}

/** Every extreme point of one item's whole drawing. */
function bounds(svg) {
  const pts = []
  for (const m of svg.matchAll(/<circle[^>]*>/g)) {
    const at = (k) => Number((m[0].match(new RegExp(k + '="(-?[\\d.]+)"')) || [])[1] ?? NaN)
    const cx = at('cx'), cy = at('cy'), r = at('r')
    if ([cx, cy, r].some(Number.isNaN)) continue
    pts.push([cx - r, cy - r], [cx + r, cy + r])
  }
  for (const m of svg.matchAll(/<ellipse[^>]*>/g)) {
    const at = (k) => Number((m[0].match(new RegExp(k + '="(-?[\\d.]+)"')) || [])[1] ?? NaN)
    const cx = at('cx'), cy = at('cy'), rx = at('rx'), ry = at('ry')
    if ([cx, cy, rx, ry].some(Number.isNaN)) continue
    // Rotated, so the worst case is the larger radius in both directions.
    const r = Math.max(rx, ry)
    pts.push([cx - r, cy - r], [cx + r, cy + r])
  }
  for (const m of svg.matchAll(/\sd="([^"]+)"/g)) pts.push(...pathPoints(m[1]))
  if (!pts.length) return null
  return {
    minX: Math.min(...pts.map((p) => p[0])),
    maxX: Math.max(...pts.map((p) => p[0])),
    minY: Math.min(...pts.map((p) => p[1])),
    maxY: Math.max(...pts.map((p) => p[1])),
  }
}

const strays = []
const empties = []
const badTags = []
const tiny = []
for (const it of ITEMS) {
  const bad = tags(it.svg).filter((t) => !ALLOWED.has(t))
  if (bad.length) badTags.push(`${it.id} uses <${bad.join('>, <')}>`)

  const b = bounds(it.svg)
  if (!b) { empties.push(it.id); continue }
  if (b.minX < -SLACK || b.maxX > W + SLACK || b.minY < -SLACK || b.maxY > H + SLACK) {
    strays.push(
      `${it.id} [${b.minX.toFixed(0)}, ${b.minY.toFixed(0)}] to [${b.maxX.toFixed(0)}, ${b.maxY.toFixed(0)}]`,
    )
  }
  // A drawing crammed into a corner of the box would be as bad as one that
  // spills out of it.
  const w = b.maxX - b.minX
  const h = b.maxY - b.minY
  if (w < W * 0.3 && h < H * 0.3) tiny.push(`${it.id} ${w.toFixed(0)}x${h.toFixed(0)}`)
  if (VERBOSE) {
    console.log(`       ${it.id.padEnd(11)} [${b.minX.toFixed(0)}, ${b.minY.toFixed(0)}] to [${b.maxX.toFixed(0)}, ${b.maxY.toFixed(0)}]`)
  }
}

report('only shapes the overlay can render', badTags.length === 0, badTags.join('; '))
report('every reference draws something', empties.length === 0, empties.join(', '))
report(`nothing strays outside 0–${W} by 0–${H}`, strays.length === 0, strays.join('; '))
report('and nothing is drawn too small to see', tiny.length === 0, tiny.join('; '))

/* -------------------------------------------------------------------------- */
/* The sitting                                                                */
/* -------------------------------------------------------------------------- */

console.log('\npicking a round')

let seed = 7
const rand = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0
  return seed / 4294967296
}

let sizeOk = true
let firstOk = true
let dupOk = true
const seen = new Map()
for (let n = 0; n < 400; n++) {
  const round = pickRound(rand)
  if (round.length !== ROUND_SIZE) sizeOk = false
  if (round[0].id !== 'bicycle') firstOk = false
  if (new Set(round.map((r) => r.id)).size !== round.length) dupOk = false
  for (const r of round) seen.set(r.id, (seen.get(r.id) ?? 0) + 1)
}
report(`every round is ${ROUND_SIZE} long`, sizeOk)
report('the bicycle is always first', firstOk)
report('no prompt appears twice in one round', dupOk)
// A prompt that never came up would be content nobody ever sees.
report('every prompt in the pool gets used', seen.size === ITEMS.length, `${seen.size}/${ITEMS.length}`)
const rest = [...seen.entries()].filter(([id]) => id !== 'bicycle').map(([, n]) => n)
const spread = Math.max(...rest) / Math.min(...rest)
report('and they come up about equally often', spread < 1.25, `worst ratio ${spread.toFixed(2)}`)

console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) failed.\n`)
process.exit(failures === 0 ? 0 : 1)
