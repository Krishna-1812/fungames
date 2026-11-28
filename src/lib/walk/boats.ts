/**
 * Boats round the island (walker.ts), where the map has them (world.ts):
 *
 *   - rowing boats tied up alongside the piers, clinker-built, painted, a
 *     pair of oars shipped inside, swinging a little on their lines;
 *   - fishing boats at anchor in the harbour and off the north and south
 *     coasts, all lying head to wind as boats at anchor do — a high bow,
 *     the wheelhouse forward, a mast with its lights and radar, a gantry at
 *     the stern;
 *   - the ferry, double-ended, white with a navy band: in from the open sea
 *     to the harbour pier on its timetable, alongside a couple of minutes,
 *     then out again, its saloon windows lit after dark;
 *   - a speedboat racing round the south-east corner of the island and back,
 *     leaning into its turns, a white wake spreading behind it;
 *   - two yachts sailing round, their sails set to the wind (the boom out
 *     the further off the wind they sail, on whichever side is to leeward),
 *     heeling to it;
 *   - mooring buoys.
 *
 * Each floats: it rises and falls, pitches and rolls with the sea under it
 * (water.ts) — a small boat quickly, the ferry slowly. Hulls are lofted from
 * a few curves (the sheer, the keel, the half-breadth) with a section from
 * round-bilged to a deep V; antifouling below the waterline, a boot-top,
 * topsides and a sheer stripe. After dark they show their lights: red to
 * port, green to starboard, white at the masthead and the stern. A swimmer is
 * kept out of their hulls.
 */
import { OVER_WATER_LAYER } from './water'
import {
  CanvasTexture, Color, CylinderGeometry, DoubleSide, Euler, Float32BufferAttribute, Group, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, RepeatWrapping,
  SphereGeometry, BufferGeometry, TorusGeometry, Vector3, type Scene,
} from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { METRE } from './body'
import { Bag, curve, loft, place, seeded, strip } from './kit'

const C = (h: string) => new Color(h)
const RED = C('#ff2a2a'), GREEN = C('#22ff6a'), WHITE_L = C('#ffffff')

type HullDef = {
  len: number; beam: number
  /** Sheer and keel heights above the waterline, and the half-breadth at the sheer (fractions of the beam), stern (t 0) to bow (t 1). */
  sheer: [number, number][]; keel: [number, number][]; half: [number, number][]
  /** How full the sections are: 2 is round-bilged, lower is more of a V. */
  full: number
  topside: string; bottom: string; boot: string; stripe?: [number, string]
  /** A deck (how far below the sheer; a bulwark that high round it), or open (a dinghy). */
  deck: number | null; deckCol?: string; inner?: string
}

/** The hull: a loft from the port sheer down round the keel and up to the starboard sheer; the transom; a deck or an open inside. */
function hull(bag: Bag, H: HullDef) {
  const S = curve(H.sheer), K = curve(H.keel), B = curve(H.half)
  const R = 14
  const at = (t: number, s: number) => {
    // s from −1 (starboard sheer) through 0 (keel) to 1 (port sheer); port is +x (the boat faces +z).
    const phi = Math.abs(s) * Math.PI / 2, side = Math.sign(s) || 1
    const b = B(t) * H.beam / 2, k = K(t), sh = S(t)
    const x = side * b * Math.pow(Math.sin(phi), 2 / H.full)
    const y = k + (sh - k) * (1 - Math.pow(Math.cos(phi), 2 / H.full))
    return new Vector3(x, y, (t - 0.5) * H.len)
  }
  const top = C(H.topside), bot = C(H.bottom), boot = C(H.boot), stripe = H.stripe ? C(H.stripe[1]) : null
  loft(bag, 40, (t) => Array.from({ length: R + 1 }, (_, r) => at(t, 1 - (2 * r) / R)), (t, r) => {
    const y = (at(t, 1 - (2 * r) / R).y + at(t, 1 - (2 * (r + 1)) / R).y) / 2
    if (y < -0.02) return bot
    if (y < 0.1) return boot
    if (stripe && y > S(t) - H.stripe![0]) return stripe
    return top
  }, { capStart: true })
  const deckH = (t: number) => S(t) - (H.deck ?? 0)
  const inset = (t: number, side: number, y: number) => { const p = at(t, side); const w = Math.max(0, Math.abs(p.x) - 0.06); return new Vector3(Math.sign(p.x) * w, y, p.z) }
  if (H.deck !== null) {
    const deck = C(H.deckCol ?? '#d8dadb'), inner = C(H.inner ?? H.topside)
    // The deck, a little crowned, and the bulwarks' insides and their capping rail.
    for (const side of [1, -1]) {
      strip(bag, 40, (t) => inset(t, side, deckH(t)), (t) => new Vector3(0, deckH(t) + 0.04 * H.beam / 3, at(t, side).z), deck, () => new Vector3(0, 1, 0))
      if (H.deck > 0) {
        strip(bag, 40, (t) => inset(t, side, S(t)), (t) => inset(t, side, deckH(t)), inner, () => new Vector3(-side, 0, 0))
        strip(bag, 40, (t) => at(t, side), (t) => inset(t, side, S(t)), inner, () => new Vector3(0, 1, 0))
      }
    }
  } else {
    // Open: the planking's inside, the floorboards, the gunwale on top.
    const wood = C(H.inner ?? '#9b7b58')
    loft(bag, 30, (t) => Array.from({ length: R + 1 }, (_, r) => { const p = at(t, -1 + (2 * r) / R); return new Vector3(p.x * 0.94, Math.max(p.y, K(t) + 0.05) * 0.98 + 0.01, p.z * 0.985) }), () => wood, {})
    for (const side of [1, -1]) strip(bag, 40, (t) => at(t, side), (t) => { const p = at(t, side); return new Vector3(p.x * 0.93, p.y, p.z * 0.985) }, C('#5e4631'), () => new Vector3(0, 1, 0))
  }
  return { at, S, K, B, deckH }
}

/** Nav lights: red to port (+x), green to starboard, white aloft and astern. */
function navLights(lamps: Bag, side: (s: number) => Vector3, mast: Vector3 | null, stern: Vector3) {
  lamps.add(new SphereGeometry(0.07, 8, 6), new Matrix4().setPosition(side(1)), RED)
  lamps.add(new SphereGeometry(0.07, 8, 6), new Matrix4().setPosition(side(-1)), GREEN)
  if (mast) lamps.add(new SphereGeometry(0.08, 8, 6), new Matrix4().setPosition(mast), WHITE_L)
  lamps.add(new SphereGeometry(0.06, 8, 6), new Matrix4().setPosition(stern), WHITE_L)
}

const box = (w: number, h: number, d: number, r = 0.04) => new RoundedBoxGeometry(w, h, d, 1, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3))
const rod = (a: Vector3, b: Vector3, r: number, seg = 6) => {
  const g = new CylinderGeometry(r, r, a.distanceTo(b), seg)
  const m = new Matrix4().lookAt(a, b, new Vector3(0, 1, 0).cross(new Vector3().subVectors(b, a)).lengthSq() < 1e-8 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0))
  g.rotateX(Math.PI / 2); g.applyMatrix4(m); g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2)
  return g
}
/** A row of window panes along a wall (each a thin box). */
const panes = (bag: Bag, n: number, from: Vector3, step: Vector3, w: number, h: number, d: number, rotY = 0) => {
  for (let k = 0; k < n; k++) bag.add(box(w, h, d, 0.03), place(from.x + step.x * k, from.y + step.y * k, from.z + step.z * k, 0, rotY))
}

type Shapes = { body: BufferGeometry; glass: BufferGeometry | null; lamps: BufferGeometry | null; lit: BufferGeometry | null; len: number; beam: number; draft: number }
const make = (body: Bag, glass: Bag, lamps: Bag, lit: Bag, len: number, beam: number, draft: number): Shapes => ({
  body: body.geometry(), glass: glass.empty ? null : glass.geometry(), lamps: lamps.empty ? null : lamps.geometry(), lit: lit.empty ? null : lit.geometry(), len, beam, draft,
})

function rowboat(paint: string): Shapes {
  const body = new Bag(), glass = new Bag(), lamps = new Bag(), lit = new Bag()
  const H = hull(body, {
    len: 3.6, beam: 1.42, full: 1.7, deck: null, topside: paint, bottom: '#e9ebec', boot: '#e9ebec', stripe: [0.06, '#f2f2ef'], inner: '#a5835e',
    sheer: [[0, 0.36], [0.5, 0.34], [0.85, 0.42], [1, 0.55]], keel: [[0, -0.08], [0.15, -0.16], [0.7, -0.17], [0.9, -0.08], [1, 0.42]], half: [[0, 0.62], [0.15, 0.85], [0.5, 1], [0.78, 0.84], [0.93, 0.45], [1, 0.02]],
  })
  // Planking lines (clinker laps), thwarts, a stern seat, the oars shipped.
  for (let k = 1; k <= 3; k++) for (const side of [1, -1]) strip(body, 30, (t) => { const p = H.at(t * 0.97 + 0.015, side * (1 - k * 0.22)); return p.add(new Vector3(side * 0.008, 0, 0)) }, (t) => { const p = H.at(t * 0.97 + 0.015, side * (1 - k * 0.22)); return p.add(new Vector3(side * 0.008, -0.018, 0)) }, C(paint).multiplyScalar(0.78), () => new Vector3(side, -0.2, 0))
  const wood = C('#8a6a48')
  for (const z of [-0.2, 0.55]) body.add(box(1.25, 0.04, 0.24, 0.01), place(0, 0.2, z), wood)
  body.add(box(1.0, 0.04, 0.45, 0.01), place(0, 0.22, -1.35), wood)
  for (const s of [1, -1]) {
    body.add(new CylinderGeometry(0.022, 0.022, 2.5, 6), place(s * 0.22, 0.26, 0.1, Math.PI / 2, 0, 0), wood)
    body.add(box(0.14, 0.012, 0.55, 0.005), place(s * 0.22, 0.26, 1.42, 0, 0, s * 0.1), wood)
    // Rowlocks.
    body.add(new TorusGeometry(0.035, 0.007, 4, 8), place(s * 0.68, 0.38, 0.2, 0, Math.PI / 2), C('#6d6f72'))
  }
  // The painter, coiled in the bow.
  body.add(new TorusGeometry(0.08, 0.015, 4, 10), place(0, 0.18, 1.3, Math.PI / 2), C('#d8d3c4'))
  return make(body, glass, lamps, lit, 3.6, 1.42, 0.17)
}

function fishingBoat(paint: string): Shapes {
  const body = new Bag(), glass = new Bag(), lamps = new Bag(), lit = new Bag()
  const H = hull(body, {
    len: 11, beam: 3.9, full: 1.75, deck: 0.75, topside: paint, bottom: '#7a2630', boot: '#f1f2f2', stripe: [0.14, '#f1f2f2'], deckCol: '#b9bdbf', inner: '#eceeef',
    sheer: [[0, 1.35], [0.4, 1.3], [0.8, 1.65], [1, 2.15]], keel: [[0, -0.6], [0.1, -1.1], [0.7, -1.25], [0.92, -0.6], [1, 1.2]], half: [[0, 0.72], [0.2, 0.95], [0.5, 1], [0.75, 0.9], [0.92, 0.5], [1, 0.03]],
  })
  const white = C('#f3f4f4'), grey = C('#8d949a'), dark = C('#2b3036')
  // The wheelhouse, forward, its roof, and the panes round it.
  const dz = 1.4, dy = H.deckH(0.63)
  body.add(box(2.5, 2.1, 2.6, 0.08), place(0, dy + 1.05, dz), white)
  body.add(box(2.8, 0.12, 3.0, 0.05), place(0, dy + 2.16, dz + 0.05), white)
  panes(glass, 3, new Vector3(-0.8, dy + 1.55, dz + 1.31), new Vector3(0.8, 0, 0), 0.7, 0.6, 0.04)
  for (const s of [1, -1]) panes(glass, 2, new Vector3(s * 1.26, dy + 1.55, dz + 0.55), new Vector3(0, 0, -1.05), 0.04, 0.55, 0.8)
  panes(lit, 3, new Vector3(-0.8, dy + 1.55, dz + 1.335), new Vector3(0.8, 0, 0), 0.62, 0.52, 0.02)
  // Mast, radar, lights; the stern gantry; fish boxes, a life ring, a liferaft canister.
  const top = new Vector3(0, dy + 5.3, dz - 0.3)
  body.add(rod(new Vector3(0, dy + 2.2, dz - 0.3), top, 0.06), undefined, white)
  body.add(rod(new Vector3(-0.9, dy + 4.1, dz - 0.3), new Vector3(0.9, dy + 4.1, dz - 0.3), 0.035), undefined, white)
  body.add(box(1.3, 0.1, 0.22, 0.04), place(0, dy + 2.55, dz - 0.3), dark)
  body.add(new CylinderGeometry(0.12, 0.12, 0.25, 8), place(0, dy + 2.32, dz - 0.3), grey)
  for (const s of [1, -1]) body.add(rod(new Vector3(s * 1.45, H.deckH(0.06), -4.9), new Vector3(s * 1.2, H.deckH(0.06) + 3.2, -4.9), 0.08), undefined, white)
  body.add(rod(new Vector3(1.25, H.deckH(0.06) + 3.2, -4.9), new Vector3(-1.25, H.deckH(0.06) + 3.2, -4.9), 0.08), undefined, white)
  for (let k = 0; k < 4; k++) body.add(box(0.75, 0.3, 0.5, 0.03), place(-0.6 + (k % 2) * 0.85, H.deckH(0.3) + 0.15 + Math.floor(k / 2) * 0.3, -1.6), C(k % 3 ? '#e8eaec' : '#3d6e9c'))
  body.add(new TorusGeometry(0.3, 0.06, 6, 14), place(1.27, dy + 1.0, dz - 1.0, 0, Math.PI / 2), C('#e23b3b'))
  body.add(new CylinderGeometry(0.28, 0.28, 0.9, 10), place(-1.0, dy + 2.45, dz - 0.6, 0, 0, Math.PI / 2), white)
  // Net drum.
  body.add(new CylinderGeometry(0.5, 0.5, 1.8, 12), place(0, H.deckH(0.2) + 0.6, -3.2, 0, 0, Math.PI / 2), C('#3f5a4c'))
  navLights(lamps, (s) => new Vector3(s * 1.28, dy + 1.85, dz + 0.4), top.clone().add(new Vector3(0, 0.12, 0)), new Vector3(0, H.deckH(0) + 0.9, -5.45))
  return make(body, glass, lamps, lit, 11, 3.9, 1.25)
}

function ferry(): Shapes {
  const body = new Bag(), glass = new Bag(), lamps = new Bag(), lit = new Bag()
  // Double-ended: the same either way.
  const H = hull(body, {
    len: 24, beam: 7, full: 2.4, deck: 0, topside: '#f4f5f6', bottom: '#28344a', boot: '#1d2a44', stripe: [0.6, '#1d2a44'], deckCol: '#9aa3ab',
    sheer: [[0, 2.5], [0.1, 2.3], [0.5, 2.2], [0.9, 2.3], [1, 2.5]], keel: [[0, 0.2], [0.07, -1.4], [0.5, -1.6], [0.93, -1.4], [1, 0.2]], half: [[0, 0.55], [0.08, 0.86], [0.2, 1], [0.8, 1], [0.92, 0.86], [1, 0.55]],
  })
  const white = C('#f4f5f6'), navy = C('#1d2a44'), grey = C('#7d8790')
  const d0 = H.deckH(0.5)
  // The saloon: a long cabin with a band of windows all round; the bridge deck over it; the funnel; masts.
  body.add(box(5.6, 2.4, 16, 0.25), place(0, d0 + 1.2, 0), white)
  body.add(box(6.2, 0.15, 17.2, 0.06), place(0, d0 + 2.45, 0), white)
  for (const s of [1, -1]) {
    panes(glass, 11, new Vector3(s * 2.81, d0 + 1.45, -6.75), new Vector3(0, 0, 1.35), 0.05, 1.05, 1.15)
    panes(lit, 11, new Vector3(s * 2.84, d0 + 1.45, -6.75), new Vector3(0, 0, 1.35), 0.02, 0.95, 1.05)
  }
  for (const e of [1, -1]) {
    panes(glass, 4, new Vector3(-2.0, d0 + 1.45, e * 8.01), new Vector3(1.33, 0, 0), 1.1, 1.05, 0.05)
    panes(lit, 4, new Vector3(-2.0, d0 + 1.45, e * 8.04), new Vector3(1.33, 0, 0), 1.0, 0.95, 0.02)
  }
  // The bridge: a raised cabin with windows facing both ways.
  body.add(box(4.6, 2.0, 5.5, 0.2), place(0, d0 + 3.5, 0), white)
  body.add(box(5.2, 0.12, 6.2, 0.05), place(0, d0 + 4.55, 0), navy)
  for (const e of [1, -1]) { panes(glass, 4, new Vector3(-1.65, d0 + 3.75, e * 2.76), new Vector3(1.1, 0, 0), 0.95, 0.8, 0.05); panes(lit, 4, new Vector3(-1.65, d0 + 3.75, e * 2.79), new Vector3(1.1, 0, 0), 0.85, 0.7, 0.02) }
  for (const s of [1, -1]) panes(glass, 3, new Vector3(s * 2.31, d0 + 3.75, -1.7), new Vector3(0, 0, 1.7), 0.05, 0.8, 1.3)
  // Railings round the top deck and the main deck.
  for (const [w, y, l] of [[6.0, d0 + 2.5, 17], [6.7, d0, 23]] as const) for (const s of [1, -1]) {
    body.add(rod(new Vector3(s * w / 2, y + 1.0, -l / 2), new Vector3(s * w / 2, y + 1.0, l / 2), 0.035), undefined, white)
    for (let z = -l / 2; z <= l / 2 + 0.01; z += 1.5) body.add(rod(new Vector3(s * w / 2, y, z), new Vector3(s * w / 2, y + 1.0, z), 0.025, 4), undefined, white)
  }
  body.add(new CylinderGeometry(0.55, 0.65, 2.2, 14), place(0, d0 + 5.6, -0.8, 0, 0, 0, 1, 1, 1.6), navy)
  body.add(new CylinderGeometry(0.67, 0.67, 0.35, 14), place(0, d0 + 5.0, -0.8, 0, 0, 0, 1, 1, 1.6), white)
  const top = new Vector3(0, d0 + 7.6, 1.2)
  body.add(rod(new Vector3(0, d0 + 4.6, 1.2), top, 0.07), undefined, white)
  body.add(box(1.8, 0.12, 0.3, 0.05), place(0, d0 + 6.2, 1.2), C('#262b31'))
  // Life rafts in their canisters, and the fenders (rubbing strake) all round.
  for (const s of [1, -1]) for (const z of [-5, 5]) body.add(new CylinderGeometry(0.4, 0.4, 1.2, 10), place(s * 2.7, d0 + 2.85, z, Math.PI / 2), white)
  for (const s of [1, -1]) strip(body, 40, (t) => H.at(t * 0.9 + 0.05, s * 0.82).add(new Vector3(s * 0.12, 0, 0)), (t) => H.at(t * 0.9 + 0.05, s * 0.82).add(new Vector3(s * 0.12, -0.3, 0)), C('#202426'), () => new Vector3(s, 0, 0))
  navLights(lamps, (s) => new Vector3(s * 2.62, d0 + 4.2, 2.2), top.clone().add(new Vector3(0, 0.15, 0)), new Vector3(0, d0 + 2.7, -8.4))
  for (let k = 0; k < 6; k++) lamps.add(new SphereGeometry(0.1, 6, 5), new Matrix4().setPosition((k % 2 ? 1 : -1) * 2.95, d0 + 2.3, -6 + Math.floor(k / 2) * 6), C('#eef3ff'))
  return make(body, glass, lamps, lit, 24, 7, 1.6)
}

function speedboat(): Shapes {
  const body = new Bag(), glass = new Bag(), lamps = new Bag(), lit = new Bag()
  const H = hull(body, {
    len: 6.4, beam: 2.4, full: 1.15, deck: 0.45, topside: '#f5f6f7', bottom: '#f0f1f2', boot: '#1f3c66', stripe: [0.18, '#1f3c66'], deckCol: '#e3e5e6', inner: '#d6d9dc',
    sheer: [[0, 0.75], [0.5, 0.8], [0.85, 0.95], [1, 1.05]], keel: [[0, -0.35], [0.6, -0.45], [0.9, -0.1], [1, 0.75]], half: [[0, 0.9], [0.3, 1], [0.7, 0.92], [0.9, 0.55], [1, 0.02]],
  })
  const dy = H.deckH(0.5)
  // The console and its windscreen, two seats, the bench astern; the outboard on the transom.
  body.add(box(0.9, 0.8, 0.7, 0.08), place(0.35, dy + 0.4, 0.4), C('#f5f6f7'))
  glass.add(box(1.6, 0.42, 0.04, 0.02), place(0, dy + 0.98, 0.85, -0.5))
  for (const x of [0.4, -0.4]) body.add(box(0.55, 0.4, 0.55, 0.12), place(x, dy + 0.25, -0.35), C('#c9ced3'))
  body.add(box(1.9, 0.4, 0.6, 0.12), place(0, dy + 0.25, -1.9), C('#c9ced3'))
  body.add(box(0.45, 0.8, 0.55, 0.15), place(0, 0.95, -3.45), C('#2a2e33'))
  body.add(box(0.14, 0.9, 0.2, 0.03), place(0, 0.2, -3.5), C('#2a2e33'))
  navLights(lamps, (s) => new Vector3(s * 0.75, H.S(0.82) + 0.05, 1.9), new Vector3(0, dy + 1.35, -2.4), new Vector3(0, H.S(0) + 0.05, -3.15))
  body.add(rod(new Vector3(0, dy, -2.4), new Vector3(0, dy + 1.3, -2.4), 0.02), undefined, C('#c4c9ce'))
  return make(body, glass, lamps, lit, 6.4, 2.4, 0.45)
}

function yacht(): Shapes & { mast: number; boomY: number } {
  const body = new Bag(), glass = new Bag(), lamps = new Bag(), lit = new Bag()
  const H = hull(body, {
    len: 9.6, beam: 3.1, full: 1.9, deck: 0, topside: '#f6f7f8', bottom: '#1a2740', boot: '#1a2740', stripe: [0.08, '#25406b'], deckCol: '#eceeef',
    sheer: [[0, 0.95], [0.5, 0.95], [1, 1.25]], keel: [[0, 0.1], [0.08, -0.45], [0.5, -0.55], [0.85, -0.3], [1, 1.05]], half: [[0, 0.78], [0.3, 1], [0.6, 0.96], [0.85, 0.62], [1, 0.02]],
  })
  const d0 = H.deckH(0.5)
  // The coachroof with its long windows, the cockpit (teak), the mast and the shrouds, the pulpit.
  body.add(box(2.1, 0.5, 3.6, 0.2), place(0, d0 + 0.25, 0.7), C('#f6f7f8'))
  for (const s of [1, -1]) glass.add(box(0.04, 0.16, 2.4, 0.03), place(s * 1.04, d0 + 0.3, 0.7, 0, 0, s * 0.18))
  body.add(box(1.9, 0.1, 2.4, 0.04), place(0, d0 - 0.05, -2.6), C('#a07b55'))
  const mast = 12.5, foot = new Vector3(0, d0 + 0.5, 1.4), head = new Vector3(0, d0 + mast, 1.4)
  body.add(rod(foot, head, 0.08, 8), undefined, C('#c9cdd1'))
  for (const s of [1, -1]) body.add(rod(new Vector3(s * 1.45, d0 + 0.05, 1.2), head.clone().add(new Vector3(0, -0.6, 0)), 0.012, 3), undefined, C('#8d949a'))
  body.add(rod(new Vector3(0, H.S(0.99), 4.7), head.clone().add(new Vector3(0, -1.2, 0)), 0.012, 3), undefined, C('#8d949a'))
  body.add(rod(new Vector3(0, d0 + 0.05, -4.6), head, 0.012, 3), undefined, C('#8d949a'))
  for (const s of [1, -1]) body.add(rod(new Vector3(s * 0.55, H.S(0.94) + 0.6, 4.2), new Vector3(s * 0.2, H.S(0.98) + 0.6, 4.75), 0.02, 4), undefined, C('#c9cdd1'))
  navLights(lamps, (s) => new Vector3(s * 0.4, H.S(0.97) + 0.62, 4.6), head.clone().add(new Vector3(0, 0.12, 0)), new Vector3(0, H.S(0) + 0.3, -4.75))
  return { ...make(body, glass, lamps, lit, 9.6, 3.1, 0.55), mast, boomY: d0 + 1.35 }
}

/** A sail: a cambered triangle (luff up the mast from the tack, foot along the boom), bellied out to one side. */
function sail(luff: number, footLen: number, side: number, jib = false) {
  const bag = new Bag(), col = C('#f4f2ec'), seam = C('#e3e0d6')
  const U = 10, V = 6
  const P = (u: number, v: number) => {
    // u up the luff (0 foot, 1 head), v from the luff aft (0) to the leech (1).
    const chord = footLen * (1 - u) * (1 + (jib ? 0 : 0.12 * Math.sin(u * Math.PI)))
    const z = -v * chord, y = u * luff + (jib ? 0 : 0)
    const depth = 0.1 * chord * Math.sin(Math.min(1, v * 1.15) * Math.PI) * (1 - 0.3 * u)
    return new Vector3(side * depth, y, z)
  }
  for (let a = 0; a < U; a++) for (let b = 0; b < V; b++) {
    const c = a % 3 === 2 ? seam : col
    bag.tri(P(a / U, b / V), P((a + 1) / U, b / V), P((a + 1) / U, (b + 1) / V), c)
    bag.tri(P(a / U, b / V), P((a + 1) / U, (b + 1) / V), P(a / U, (b + 1) / V), c)
  }
  return bag.geometry()
}

type Boat = {
  group: Group; s: Shapes; kind: string; seed: number
  /** How it moves: tied up, at anchor, round a loop, on the ferry's timetable. */
  how: 'moored' | 'anchored' | 'loop' | 'ferry'
  x: number; z: number; yaw: number; base: number
  y: number; pitch: number; roll: number; heel: number; v: number
  loop?: { cx: number; cz: number; ax: number; az: number; bx: number; bz: number; speed: number; ang: number }
  sails?: { boom: Group; mains: Mesh[]; jib: Group; jibs: Mesh[] }
  wake?: { pts: { x: number; z: number; age: number; w: number }[]; mesh: Mesh; tick: number }
}

export function boats(scene: Scene, o: {
  seaAt(x: number, z: number): number
  piers: [number, number][][]
  /** Which way the wind blows (a unit vector, x and z). */
  wind: [number, number]
  splash(x: number, y: number, z: number, n: number, power: number): void
  seed?: number
}) {
  const rnd = seeded(o.seed ?? 71)
  const M = METRE
  const bodyMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.38, metalness: 0.02, envMapIntensity: 1.1 })
  const glassMat = new MeshStandardMaterial({ color: '#0c1319', roughness: 0.05, metalness: 0.3, envMapIntensity: 1.8 })
  const lampMat = new MeshBasicMaterial({ vertexColors: true })
  const litMat = new MeshBasicMaterial({ vertexColors: true, color: '#dfe8ff' })
  const sailMat = new MeshStandardMaterial({ color: '#f4f2ec', roughness: 0.85, side: DoubleSide })
  // The wake's foam: a texture of streaks and flecks.
  const foam = typeof document === 'undefined' ? null : (() => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 256
    const g = c.getContext('2d')!
    g.fillStyle = '#000'; g.fillRect(0, 0, 64, 256)
    for (let k = 0; k < 900; k++) { const x = rnd() * 64, y = rnd() * 256, r = 0.6 + rnd() * 2.4; g.fillStyle = `rgba(255,255,255,${0.25 + rnd() * 0.6})`; g.beginPath(); g.ellipse(x, y, r, r * (1.5 + rnd() * 3), 0, 0, Math.PI * 2); g.fill() }
    const t = new CanvasTexture(c); t.wrapS = t.wrapT = RepeatWrapping
    return t
  })()
  const wakeMat = new MeshBasicMaterial({ color: '#f2f7fa', alphaMap: foam, transparent: true, depthWrite: false, vertexColors: true })

  const fleet: Boat[] = []
  const add = (s: Shapes, kind: string, how: Boat['how'], x: number, z: number, yaw: number, extra: Partial<Boat> = {}) => {
    const group = new Group(); group.name = `boat-${kind}`
    const body = new Mesh(s.body, bodyMat); body.castShadow = true; body.receiveShadow = true; group.add(body)
    if (s.glass) group.add(new Mesh(s.glass, glassMat))
    if (s.lamps) group.add(new Mesh(s.lamps, lampMat))
    if (s.lit) { const l = new Mesh(s.lit, litMat); l.name = 'lit'; group.add(l) }
    scene.add(group)
    const b: Boat = { group, s, kind, seed: rnd() * 100, how, x, z, yaw, base: yaw, y: 0, pitch: 0, roll: 0, heel: 0, v: 0, ...extra }
    // (Starting where it is on its loop, afloat.)
    const L = b.loop
    if (L) { b.x = L.cx + L.ax * Math.cos(L.ang) + L.bx * Math.sin(L.ang); b.z = L.cz + L.az * Math.cos(L.ang) + L.bz * Math.sin(L.ang); b.yaw = Math.atan2(-L.ax * Math.sin(L.ang) + L.bx * Math.cos(L.ang), -L.az * Math.sin(L.ang) + L.bz * Math.cos(L.ang)) }
    b.y = o.seaAt(b.x, b.z)
    fleet.push(b)
    return b
  }
  const windYaw = Math.atan2(-o.wind[0], -o.wind[1])

  // Rowing boats tied up alongside the first two piers (as the map has them), and one at the harbour pier.
  const paints = ['#2f6a8f', '#e9ecef', '#2c6b5f']
  o.piers.forEach((pts, n) => {
    const [si, sj] = pts[0], [ei, ej] = pts[pts.length - 1], di = Math.sign(ei - si), dj = Math.sign(ej - sj)
    const at = n < 2 ? [ei - di * 0.6 + (dj ? 0.42 : 0), ej - dj * 0.6 + (di ? 0.42 : 0)] : [si + (ei - si) * 0.45 - (dj ? 0.4 : 0), sj + (ej - sj) * 0.45 - (di ? 0.4 : 0)]
    add(rowboat(paints[n % paints.length]), 'rowboat', 'moored', at[1], at[0], Math.atan2(dj, di) + (n === 1 ? Math.PI : 0))
  })
  // Fishing boats at anchor (world.ts's FISHING), head to wind.
  const hulls = ['#1f3c5a', '#2b5f6e', '#8a2a35', '#2f3e57']
  ;[[31.6, 11.4], [-2.6, 9.2], [23.5, 21.7], [24.7, 24.5]].forEach(([i, j], n) => add(fishingBoat(hulls[n]), 'fishing', 'anchored', j, i, windYaw + (rnd() - 0.5) * 0.4))
  // The speedboat's loop round the south-east corner (the map's run, from (33, 27) to (25, 37.5), and back).
  {
    const A = [27, 33], B = [37.5, 25], cx = (A[0] + B[0]) / 2 + 0.6, cz = (A[1] + B[1]) / 2 + 0.6
    const ax = (B[0] - A[0]) / 2, az = (B[1] - A[1]) / 2, l = Math.hypot(ax, az)
    add(speedboat(), 'speed', 'loop', cx, cz, 0, { loop: { cx, cz, ax, az, bx: (-az / l) * 1.5, bz: (ax / l) * 1.5, speed: 1.0, ang: 0 } })
  }
  // Two yachts sailing round, off the west coast and the south.
  const yachts: Boat[] = []
  for (const [cx, cz, rx, rz, a0] of [[-5, 15, 2, 4.5, 0], [14, 33.6, 4.5, 1.6, 2]] as const) {
    const y = yacht()
    const b = add(y, 'yacht', 'loop', cx, cz, 0, { loop: { cx, cz, ax: rx, az: 0, bx: 0, bz: rz, speed: 0.33, ang: a0 } })
    // The mainsail on its boom, and the jib, each made for either tack.
    const boom = new Group(); boom.position.set(0, y.boomY * M, 1.4 * M)
    const boomRod = new Mesh(new CylinderGeometry(0.06 * M, 0.06 * M, 3.9 * M, 6).rotateX(Math.PI / 2).translate(0, 0, -1.95 * M), bodyMat); boom.add(boomRod)
    const mains = [1, -1].map((s) => { const m = new Mesh(sail(y.mast - y.boomY + 0.3, 3.8, s), sailMat); m.castShadow = true; boom.add(m); return m })
    const jib = new Group(); jib.position.set(0, (y.boomY - 0.6) * M, 4.6 * M)
    // (The jib's luff runs up the forestay, leaning aft.)
    const jibs = [1, -1].map((s) => { const m = new Mesh(sail(y.mast - 2.4, 3.2, s, true), sailMat); m.rotation.x = -0.27; m.castShadow = true; jib.add(m); return m })
    b.group.add(boom, jib)
    b.sails = { boom, mains, jib, jibs }
    yachts.push(b)
  }
  // The ferry.
  const FERRY = { j: 22.95, dock: 26.05, far: 64, cycle: 360 }
  const ferryBoat = add(ferry(), 'ferry', 'ferry', FERRY.j, FERRY.far, Math.PI)
  // Mooring buoys.
  const buoyGeo = (() => { const b = new Bag(); b.add(new SphereGeometry(0.45, 14, 10), place(0, 0.12, 0, 0, 0, 0, 1, 0.85, 1), C('#d8333a')); b.add(new CylinderGeometry(0.4, 0.4, 0.12, 14), place(0, 0.25, 0), C('#f2f2f2')); b.add(new TorusGeometry(0.1, 0.03, 5, 10), place(0, 0.6, 0), C('#9aa1a7')); return b.geometry() })()
  const buoys = [[30, 21], [26.5, 29.2], [31, 16.5]].map(([i, j], n) => { const m = new Mesh(buoyGeo, bodyMat); m.castShadow = true; scene.add(m); return { m, x: j, z: i, seed: n * 1.7 } })

  // Wakes behind those that move.
  for (const b of fleet) if (b.how === 'loop' || b.how === 'ferry') {
    const n = 48, g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(new Float32Array(n * 2 * 3), 3))
    g.setAttribute('uv', new Float32BufferAttribute(new Float32Array(n * 2 * 2), 2))
    g.setAttribute('color', new Float32BufferAttribute(new Float32Array(n * 2 * 4), 4))
    const idx: number[] = []; for (let k = 0; k < n - 1; k++) idx.push(k * 2, k * 2 + 1, k * 2 + 2, k * 2 + 1, k * 2 + 3, k * 2 + 2)
    g.setIndex(idx)
    const mesh = new Mesh(g, wakeMat); mesh.frustumCulled = false; mesh.renderOrder = 3; mesh.layers.set(OVER_WATER_LAYER); scene.add(mesh)
    b.wake = { pts: [], mesh, tick: 0 }
  }

  const e = new Euler(), wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))
  /** Rising and falling, pitching and rolling, with the sea under it (a big hull answers slowly). */
  const float = (b: Boat, dt: number) => {
    const hl = (b.s.len / 2) * M * 0.8, hw = (b.s.beam / 2) * M * 0.8, cs = Math.cos(b.yaw), sn = Math.sin(b.yaw)
    const fx = sn * hl, fz = cs * hl, px = cs * hw, pz = -sn * hw
    const bow = o.seaAt(b.x + fx, b.z + fz), stern = o.seaAt(b.x - fx, b.z - fz), port = o.seaAt(b.x + px, b.z + pz), stb = o.seaAt(b.x - px, b.z - pz)
    const k = Math.min(1, dt * (b.s.len > 15 ? 0.9 : b.s.len > 8 ? 1.6 : 3.5))
    b.y += ((bow + stern + port + stb) / 4 - b.y) * k
    b.pitch += (-Math.atan2(bow - stern, 2 * hl) - b.pitch) * k
    b.roll += (Math.atan2(port - stb, 2 * hw) - b.roll) * k
  }

  let glowWas = -1
  return {
    /** Each frame: each moves, floats; its wake spreads; its lights after dark. */
    update(dt: number, c: { time: number; glow: number; cam: Vector3 }) {
      if (dt <= 0) return
      const t = c.time
      for (const b of fleet) {
        const oldX = b.x, oldZ = b.z
        if (b.how === 'moored') b.yaw = b.base + 0.1 * Math.sin(t * 0.17 + b.seed) + 0.04 * Math.sin(t * 0.53 + b.seed * 2)
        else if (b.how === 'anchored') b.yaw = b.base + 0.22 * Math.sin(t * 0.045 + b.seed) + 0.05 * Math.sin(t * 0.21 + b.seed)
        else if (b.how === 'loop') {
          // Round its loop at its speed; leaning into the turn (a planing hull) or heeled by the wind (a yacht).
          const L = b.loop!
          const px = L.ax * Math.cos(L.ang) + L.bx * Math.sin(L.ang), pz = L.az * Math.cos(L.ang) + L.bz * Math.sin(L.ang)
          const tx = -L.ax * Math.sin(L.ang) + L.bx * Math.cos(L.ang), tz = -L.az * Math.sin(L.ang) + L.bz * Math.cos(L.ang)
          L.ang += (L.speed / Math.hypot(tx, tz)) * dt
          b.x = L.cx + px; b.z = L.cz + pz
          const yaw = Math.atan2(tx, tz), turn = wrap(yaw - b.yaw) / dt
          b.yaw = yaw
          if (b.kind === 'speed') b.heel += (Math.max(-0.2, Math.min(0.2, -turn * 0.25)) - b.heel) * Math.min(1, dt * 2)
        } else if (b.how === 'ferry') {
          // The timetable: in from the open sea, slowing to come alongside; a while at the pier; out again.
          const f = (t % FERRY.cycle) / FERRY.cycle, run = 60 / FERRY.cycle, stay = 140 / FERRY.cycle
          const D = FERRY.far - (FERRY.dock + b.s.len * M / 2 + 0.06)
          let off = D
          if (f < run) off = D * Math.pow(1 - f / run, 2)
          else if (f < run + stay) off = 0
          else if (f < 2 * run + stay) off = D * Math.pow((f - run - stay) / run, 2)
          b.x = FERRY.j; b.z = FERRY.dock + b.s.len * M / 2 + 0.06 + off
          b.group.visible = off < D * 0.95
        }
        b.v = Math.hypot(b.x - oldX, b.z - oldZ) / dt
        float(b, dt)
        // Yachts: the boom let out the further off the wind, on the side the wind blows to; heeled by it.
        if (b.sails) {
          const hx = Math.sin(b.yaw), hz = Math.cos(b.yaw)
          const off = Math.acos(Math.max(-1, Math.min(1, -(hx * o.wind[0] + hz * o.wind[1]))))
          const lee = Math.sign(hx * o.wind[1] - hz * o.wind[0]) || 1
          const boom = Math.max(0.12, Math.min(1.35, (off - 0.5) * 0.75)) * lee
          b.sails.boom.rotation.y += (boom - b.sails.boom.rotation.y) * Math.min(1, dt * 1.5)
          b.sails.jib.rotation.y += (boom * 0.7 - b.sails.jib.rotation.y) * Math.min(1, dt * 1.5)
          b.sails.mains[0].visible = b.sails.jibs[0].visible = b.sails.boom.rotation.y > 0
          b.sails.mains[1].visible = b.sails.jibs[1].visible = b.sails.boom.rotation.y <= 0
          b.heel += (-lee * 0.2 * Math.sin(Math.min(off, Math.PI / 2)) - b.heel) * Math.min(1, dt)
        }
        b.group.position.set(b.x, b.y, b.z)
        b.group.rotation.copy(e.set(b.pitch, b.yaw, b.roll + b.heel, 'YXZ'))
        // The wake: a trail of foam from the stern, spreading and fading.
        if (b.wake) {
          const W = b.wake
          // (Spreading at about half the boat's speed, as a wake's arms open; a yacht's barely there.)
          const spread = b.kind === 'yacht' ? 0.012 : b.kind === 'ferry' ? 0.05 : 0.07, strength = b.kind === 'yacht' ? 0.3 : b.kind === 'ferry' ? 0.6 : 0.85
          for (const p of W.pts) { p.age += dt; p.w += dt * spread }
          while (W.pts.length && W.pts[W.pts.length - 1].age > 9) W.pts.pop()
          if ((W.tick -= dt) <= 0 && b.v > 0.02) {
            W.tick = 0.15
            const back = (b.s.len / 2) * M * 0.9
            W.pts.unshift({ x: b.x - Math.sin(b.yaw) * back, z: b.z - Math.cos(b.yaw) * back, age: 0, w: (b.s.beam / 2) * M * (b.kind === 'yacht' ? 0.45 : 0.7) })
            if (W.pts.length > 48) W.pts.length = 48
            if (b.kind === 'speed') { const fx = b.x + Math.sin(b.yaw) * back * 0.5, fz = b.z + Math.cos(b.yaw) * back * 0.5; o.splash(fx, o.seaAt(fx, fz), fz, 3, 0.35) }
          }
          const P = W.mesh.geometry.getAttribute('position') as Float32BufferAttribute, U = W.mesh.geometry.getAttribute('uv') as Float32BufferAttribute, Cc = W.mesh.geometry.getAttribute('color') as Float32BufferAttribute
          const n = W.pts.length
          for (let k = 0; k < 48; k++) {
            const p = W.pts[Math.min(k, n - 1)]
            if (!p) { P.setXYZ(k * 2, b.x, -9, b.z); P.setXYZ(k * 2 + 1, b.x, -9, b.z); continue }
            const q = W.pts[Math.min(k + 1, n - 1)], r = W.pts[Math.min(Math.max(k - 1, 0), n - 1)]
            let dx = r.x - q.x, dz = r.z - q.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l
            const y = o.seaAt(p.x, p.z) + 0.004
            P.setXYZ(k * 2, p.x - dz * p.w, y, p.z + dx * p.w); P.setXYZ(k * 2 + 1, p.x + dz * p.w, y, p.z - dx * p.w)
            U.setXY(k * 2, 0, p.age * 0.35 - t * 0.02); U.setXY(k * 2 + 1, 1, p.age * 0.35 - t * 0.02)
            const a = k >= n ? 0 : Math.max(0, 1 - p.age / 9) * Math.min(1, p.age * 4) * Math.min(1, b.v / (0.4 * M)) * strength
            Cc.setXYZW(k * 2, 1, 1, 1, a); Cc.setXYZW(k * 2 + 1, 1, 1, 1, a)
          }
          P.needsUpdate = U.needsUpdate = Cc.needsUpdate = true
        }
      }
      for (const by of buoys) { const y = o.seaAt(by.x, by.z); by.m.position.set(by.x, y - 0.1 * M, by.z); by.m.rotation.set(0.12 * Math.sin(t * 0.9 + by.seed), 0, 0.12 * Math.cos(t * 0.7 + by.seed)) }
      // The lights: glowing after dark (their lenses dim by day); the ferry's saloon lit.
      if (Math.abs(c.glow - glowWas) > 0.01) {
        glowWas = c.glow
        lampMat.color.setScalar(0.3 + 3.2 * c.glow)
        litMat.color.set('#dfe8ff').multiplyScalar(1.4 * c.glow)
        for (const b of fleet) { const l = b.group.getObjectByName('lit'); if (l) l.visible = c.glow > 0.03 }
      }
      void yachts; void ferryBoat
    },
    /** A swimmer in a hull's way: how far out of it they are pushed (or null). */
    push(x: number, z: number, y: number, r: number) {
      for (const b of fleet) {
        if (!b.group.visible || Math.abs(y - b.y) > 0.4) continue
        const dx = x - b.x, dz = z - b.z, cs = Math.cos(b.yaw), sn = Math.sin(b.yaw)
        const along = dx * sn + dz * cs, across = dx * cs - dz * sn
        const hl = (b.s.len / 2) * M + r, hw = (b.s.beam / 2) * M * 0.9 + r
        if (Math.abs(along) < hl && Math.abs(across) < hw) {
          const pa = hl - Math.abs(along), pc = hw - Math.abs(across)
          if (pc < pa) { const s = Math.sign(across) || 1; return [cs * pc * s, -sn * pc * s] as [number, number] }
          const s = Math.sign(along) || 1; return [sn * pa * s, cs * pa * s] as [number, number]
        }
      }
      return null
    },
    /** Shown or not (all of them, with their wakes and the buoys). */
    show(on: boolean) { for (const b of fleet) { b.group.visible = on; if (b.wake) b.wake.mesh.visible = on } for (const by of buoys) by.m.visible = on },
    /** (For the checks.) */
    state: () => fleet.map((b) => ({ kind: b.kind, x: b.x, z: b.z, y: b.y, yaw: b.yaw, visible: b.group.visible, v: b.v })),
    dispose() {
      for (const b of fleet) { scene.remove(b.group); b.group.traverse((m) => (m as Mesh).geometry?.dispose()); if (b.wake) { scene.remove(b.wake.mesh); b.wake.mesh.geometry.dispose() } }
      for (const by of buoys) scene.remove(by.m)
      buoyGeo.dispose(); foam?.dispose(); for (const m of [bodyMat, glassMat, lampMat, litMat, sailMat, wakeMat]) m.dispose()
    },
  }
}
