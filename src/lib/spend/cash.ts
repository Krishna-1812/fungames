/**
 * What a hundred billion dollars is, as a thing.
 *
 * In hundred-dollar notes it is a billion pieces of paper, about a thousand
 * tonnes, and it fills a warehouse floor. Cash moves the way banks move it,
 * so this counts it the same way:
 *
 *   a note            $100       156 × 66 mm, a tenth of a millimetre thick
 *   a bundle          $10,000    a hundred notes under a paper strap
 *   a brick           $100,000   ten bundles, shrink-wrapped
 *   a pallet          $100M      a thousand bricks: five along, twenty across,
 *                                ten high, on a wooden pallet, wrapped in film
 *
 * and the hundred billion is a thousand pallets in rows on the floor, in
 * blocks of fifty with aisles between them.
 *
 * Whatever is left is the fewest of those that make it up exactly: whole
 * pallets in their rows, then one pallet being broken into — its bricks laid
 * from the bottom layer up, one brick opened into bundles, one bundle into
 * notes, and the odd dollars as smaller notes on top. So spending a latte
 * takes a five off the top, and buying a yacht takes forty pallets off the
 * back. Pure, and in metres, so scripts/check-spend-cash.mjs can count it.
 */

/** A $100 note, in metres: long side along x, short along z, thickness up. */
export const NOTE = { w: 0.156, d: 0.0663, h: 0.00011 }
export const NOTES_PER_BUNDLE = 100
export const BUNDLE = { w: NOTE.w, d: NOTE.d, h: NOTE.h * NOTES_PER_BUNDLE }
export const BUNDLES_PER_BRICK = 10
export const BRICK = { w: NOTE.w, d: NOTE.d, h: BUNDLE.h * BUNDLES_PER_BRICK }
/** Bricks on a pallet: along x, across z, and layers up. */
export const LAYOUT = { x: 5, z: 20, y: 10 }
export const BRICKS_PER_PALLET = LAYOUT.x * LAYOUT.z * LAYOUT.y
/** The wooden pallet under the cash. */
export const BASE = { w: 0.8, d: 1.36, h: 0.144 }
/** The cash on a full pallet. */
export const BLOCK = { w: BRICK.w * LAYOUT.x, d: BRICK.d * LAYOUT.z, h: BRICK.h * LAYOUT.y }
export const PALLETS = 1000

export const VALUE = {
  note: 100,
  bundle: 100 * NOTES_PER_BUNDLE,
  brick: 100 * NOTES_PER_BUNDLE * BUNDLES_PER_BRICK,
  pallet: 100 * NOTES_PER_BUNDLE * BUNDLES_PER_BRICK * BRICKS_PER_PALLET,
}
/** The notes under a hundred, largest first. */
export const CHANGE = [50, 20, 10, 5, 1] as const

/** The floor plan: forty pallets across, twenty-five deep, in blocks with aisles. */
const COLS = 40, BLOCK_COLS = 10, BLOCK_ROWS = 5
const PITCH_X = BASE.w + 0.12, PITCH_Z = BASE.d + 0.16, AISLE = 1.5

export type Cash = {
  pallets: number
  /** On the pallet being broken into. */
  bricks: number
  /** In the brick being broken into. */
  bundles: number
  /** In the bundle being broken into. */
  notes: number
  /** Smaller notes for the dollars under a hundred, largest first. */
  change: number[]
}

/** The fewest pallets, bricks, bundles and notes that make exactly `dollars`. */
export function breakDown(dollars: number): Cash {
  let d = Math.max(0, Math.floor(dollars))
  const pallets = Math.min(PALLETS, Math.floor(d / VALUE.pallet)); d -= pallets * VALUE.pallet
  const bricks = Math.floor(d / VALUE.brick); d -= bricks * VALUE.brick
  const bundles = Math.floor(d / VALUE.bundle); d -= bundles * VALUE.bundle
  const notes = Math.floor(d / VALUE.note); d -= notes * VALUE.note
  const change: number[] = []
  for (const c of CHANGE) while (d >= c) { change.push(c); d -= c }
  return { pallets, bricks, bundles, notes, change }
}

export function total(c: Cash) {
  return c.pallets * VALUE.pallet + c.bricks * VALUE.brick + c.bundles * VALUE.bundle +
    c.notes * VALUE.note + c.change.reduce((a, b) => a + b, 0)
}

/** Where pallet i stands: the centre of its base on the floor. Pallet 0 is at the front. */
export function palletAt(i: number) {
  const row = Math.floor(i / COLS), col = i % COLS
  const x = col * PITCH_X + Math.floor(col / BLOCK_COLS) * AISLE
  const z = -(row * PITCH_Z + Math.floor(row / BLOCK_ROWS) * AISLE)
  // Centred across, with the front row at z = 0.
  const width = (COLS - 1) * PITCH_X + Math.floor((COLS - 1) / BLOCK_COLS) * AISLE
  return { x: x - width / 2, z }
}

/** Where brick j of a pallet sits, relative to the pallet's centre on the floor: its centre. */
export function brickAt(j: number) {
  const layer = Math.floor(j / (LAYOUT.x * LAYOUT.z)), k = j % (LAYOUT.x * LAYOUT.z)
  const bx = k % LAYOUT.x, bz = Math.floor(k / LAYOUT.x)
  return {
    x: (bx - (LAYOUT.x - 1) / 2) * BRICK.w,
    y: BASE.h + layer * BRICK.h + BRICK.h / 2,
    z: (bz - (LAYOUT.z - 1) / 2) * BRICK.d,
  }
}

export type Box = { x: number; y: number; z: number; w: number; h: number; d: number; rot?: number }
export type Piece = Box & { key: string }

/**
 * Every piece of what is left, with a key that stays the same for as long as
 * the piece does — so a page can tell what was taken away and what was put
 * back by comparing keys.
 */
export function pieces(c: Cash) {
  const out = {
    pallets: [] as Piece[],
    /** The wooden pallets: one under each full pallet, and one under the pallet being broken into. */
    bases: [] as Piece[],
    bricks: [] as Piece[],
    bundles: [] as Piece[],
    notes: [] as Piece[],
    change: [] as (Piece & { value: number })[],
  }
  for (let i = 0; i < c.pallets; i++) {
    const p = palletAt(i)
    out.pallets.push({ key: 'p' + i, x: p.x, y: BASE.h + BLOCK.h / 2, z: p.z, w: BLOCK.w, h: BLOCK.h, d: BLOCK.d })
    out.bases.push({ key: 'w' + i, x: p.x, y: BASE.h / 2, z: p.z, w: BASE.w, h: BASE.h, d: BASE.d })
  }
  const open = c.bricks + c.bundles + c.notes + c.change.length > 0
  if (!open || c.pallets >= PALLETS) return out
  const P = c.pallets, p = palletAt(P)
  out.bases.push({ key: 'w' + P, x: p.x, y: BASE.h / 2, z: p.z, w: BASE.w, h: BASE.h, d: BASE.d })
  for (let j = 0; j < c.bricks; j++) {
    const b = brickAt(j)
    out.bricks.push({ key: `b${P}.${j}`, x: p.x + b.x, y: b.y, z: p.z + b.z, w: BRICK.w, h: BRICK.h, d: BRICK.d })
  }
  // The brick being opened is taken off and laid on top of the stack — on
  // the last brick put down, which is at the front of the top layer, where it
  // can be seen — or, with no bricks left, at the front of the bare pallet.
  // Its bundles stack up from there, and the bundle being opened on them.
  const FRONT = LAYOUT.x * (LAYOUT.z - 1) + Math.floor(LAYOUT.x / 2)
  const slot = brickAt(c.bricks > 0 ? c.bricks - 1 : FRONT)
  const bx = p.x + slot.x, bz = p.z + slot.z
  const floor = c.bricks > 0 ? slot.y + BRICK.h / 2 : BASE.h
  for (let k = 0; k < c.bundles; k++) {
    out.bundles.push({ key: `u${P}.${c.bricks}.${k}`, x: bx, y: floor + k * BUNDLE.h + BUNDLE.h / 2, z: bz, w: BUNDLE.w, h: BUNDLE.h, d: BUNDLE.d })
  }
  // Counted out by hand, so the notes do not line up exactly: a millimetre
  // here and there and the odd degree.
  let y = floor + c.bundles * BUNDLE.h
  for (let m = 0; m < c.notes; m++) {
    const jx = (hash(P * 7 + c.bricks * 13 + m * 31) - 0.5) * 0.002
    const jz = (hash(m * 17 + 5) - 0.5) * 0.0016
    const rot = (hash(m * 29 + 11) - 0.5) * 0.02
    out.notes.push({ key: `n${P}.${c.bricks}.${c.bundles}.${m}`, x: bx + jx, y: y + NOTE.h / 2, z: bz + jz, w: NOTE.w, h: NOTE.h, d: NOTE.d, rot })
    y += NOTE.h
  }
  // The change, dropped on top, each at its own angle.
  c.change.forEach((v, m) => {
    const rot = (hash(v * 3 + m * 41) - 0.5) * 0.36
    const jx = (hash(v + m * 7 + 2) - 0.5) * 0.03, jz = (hash(v * 5 + m) - 0.5) * 0.008
    out.change.push({ key: `c${P}.${m}.${v}`, value: v, x: bx + jx, y: y + NOTE.h / 2, z: bz + jz, w: NOTE.w, h: NOTE.h, d: NOTE.d, rot })
    y += NOTE.h
  })
  return out
}

/** The box around the money (not the wooden pallets), for framing it. */
export function bounds(c: Cash): { min: [number, number, number]; max: [number, number, number] } | null {
  const ps = pieces(c)
  const all = [...ps.pallets, ...ps.bricks, ...ps.bundles, ...ps.notes, ...ps.change]
  if (!all.length) return null
  const min: [number, number, number] = [Infinity, Infinity, Infinity], max: [number, number, number] = [-Infinity, -Infinity, -Infinity]
  for (const b of all) {
    // A turned note reaches a little further than its own width: allow for it.
    const r = b.rot ? Math.hypot(b.w, b.d) / 2 : 0
    const hw = r || b.w / 2, hd = r || b.d / 2
    min[0] = Math.min(min[0], b.x - hw); max[0] = Math.max(max[0], b.x + hw)
    min[1] = Math.min(min[1], b.y - b.h / 2); max[1] = Math.max(max[1], b.y + b.h / 2)
    min[2] = Math.min(min[2], b.z - hd); max[2] = Math.max(max[2], b.z + hd)
  }
  return { min, max }
}

function hash(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}
