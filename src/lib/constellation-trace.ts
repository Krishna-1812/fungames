/**
 * Constellation Draw's memory round: see a real figure, then draw it back.
 *
 * The figures are the real line figures in data/constellation-lines.ts, which
 * store each line as [ra, dec] points. Scoring works on the stars those points
 * sit on, so every vertex is resolved once to its catalogue star, and a figure
 * becomes a set of edges — unordered pairs of real star ids. A drawing is the
 * same thing, so the comparison is exact: the order you drew in, the direction
 * of each line and how you split it into strokes do not matter, only which
 * pairs of stars you joined.
 *
 * The score is the F-score of the two: recall (how much of the real figure you
 * drew) balanced against precision (how much of what you drew is in it), so
 * joining every star to every other star does not pay, and neither does
 * drawing one safe line. scripts/check-constellation-trace.mjs checks both.
 */
import { STARS, CONSTELLATIONS, nearestStar, constellationName, type Star } from './star-catalog'
import { project, angularSeparationDeg } from './sky-projection'

export type Edge = readonly [number, number]

/** One key per unordered pair, so a line drawn backwards is the same line. */
export const edgeKey = (a: number, b: number): string => (a < b ? `${a}-${b}` : `${b}-${a}`)

/**
 * How far a figure's vertex may sit from its star. The generated lines copy
 * the catalogue's own coordinates, so in practice they coincide; the
 * tolerance is only there so a rounding difference cannot orphan a vertex.
 */
const VERTEX_TOLERANCE_DEG = 0.05

/**
 * A pair of stars closer than this is one point of light to the naked eye —
 * γ Delphini's two components are 9″ apart — and to a click. The figure's
 * vertex is taken to be the brighter of them, since that is the one anybody
 * can actually pick.
 */
const UNRESOLVED_DEG = 0.1

function resolveVertex(ra: number, dec: number): Star | null {
  const s = nearestStar(ra, dec, VERTEX_TOLERANCE_DEG)
  if (!s) return null
  let best = s
  for (const o of STARS) {
    if (o.mag < best.mag && Math.abs(o.dec - s.dec) < UNRESOLVED_DEG && angularSeparationDeg(o.ra, o.dec, s.ra, s.dec) < UNRESOLVED_DEG) best = o
  }
  return best
}

const figureCache = new Map<string, Edge[]>()

/** A real constellation's figure as edges between real star ids. */
export function figureEdges(id: string): Edge[] {
  const hit = figureCache.get(id)
  if (hit) return hit
  const c = CONSTELLATIONS.find((k) => k.id === id)
  const seen = new Set<string>()
  const out: Edge[] = []
  for (const seg of c?.segments ?? []) {
    let prev: number | null = null
    for (const [ra, dec] of seg) {
      const s = resolveVertex(ra, dec)
      if (!s) { prev = null; continue }
      if (prev !== null && prev !== s.id) {
        const k = edgeKey(prev, s.id)
        if (!seen.has(k)) { seen.add(k); out.push([prev, s.id]) }
      }
      prev = s.id
    }
  }
  figureCache.set(id, out)
  return out
}

/** The distinct stars a figure uses. */
export const figureStars = (id: string): number[] => [...new Set(figureEdges(id).flat())]

/** Consecutive pairs of each chain of star ids, as edges. */
export function chainsToEdges(chains: readonly (readonly number[])[]): Edge[] {
  const out: Edge[] = []
  for (const ch of chains) for (let i = 1; i < ch.length; i++) if (ch[i] !== ch[i - 1]) out.push([ch[i - 1], ch[i]])
  return out
}

export type Trace = {
  /** 0–100. */
  score: number
  recall: number
  precision: number
  /** Edges of the real figure you drew. */
  hit: string[]
  /** Edges of the real figure you did not. */
  missed: string[]
  /** Edges you drew that are not in it. */
  extra: string[]
}

export function traceScore(real: readonly Edge[], drawn: readonly Edge[]): Trace {
  const realKeys = new Set(real.map(([a, b]) => edgeKey(a, b)))
  const drawnKeys = new Set(drawn.map(([a, b]) => edgeKey(a, b)))
  const hit = [...drawnKeys].filter((k) => realKeys.has(k))
  const extra = [...drawnKeys].filter((k) => !realKeys.has(k))
  const missed = [...realKeys].filter((k) => !drawnKeys.has(k))
  const recall = realKeys.size ? hit.length / realKeys.size : 0
  const precision = drawnKeys.size ? hit.length / drawnKeys.size : 0
  const f = recall + precision > 0 ? (2 * recall * precision) / (recall + precision) : 0
  return { score: Math.round(f * 100), recall, precision, hit, missed, extra }
}

/** Each look back at the figure costs this much off that figure's score. */
export const PEEK_COST = 10
export const withPeeks = (score: number, peeks: number): number => Math.max(0, score - PEEK_COST * peeks)

/**
 * The round: one figure from each tier, smallest first. Every tier holds
 * figures of about the same size, all of them well known and bright enough to
 * find without a telescope, so a round is fair whichever of them it draws.
 */
export const TIERS: readonly (readonly string[])[] = [
  ['Cru', 'Tri', 'Sge', 'Ari'],
  ['Cas', 'Crv', 'Del', 'Cnc'],
  ['CrB', 'Lyr', 'UMi', 'Cyg'],
  ['Aql', 'Leo', 'Aur', 'Lep'],
  ['CMa', 'Gem', 'Tau', 'Sco'],
]

export function pickRound(rand: () => number = Math.random): string[] {
  return TIERS.map((t) => t[Math.min(t.length - 1, Math.floor(rand() * t.length))])
}

/** Long enough to take in a figure, short enough that it is a memory test. */
export const memoMs = (edges: number): number => Math.round(2600 + 380 * edges)

/**
 * Where to look to see a whole figure, and how wide it is: the mean direction
 * of its stars (on the sphere, so Cassiopeia straddling RA 0° is not averaged
 * to the far side of the sky) and its half-extent in tangent-plane radians.
 */
export function figureView(id: string): { ra: number; dec: number; halfW: number; halfH: number } {
  const c = CONSTELLATIONS.find((k) => k.id === id)
  const pts = (c?.segments ?? []).flat()
  let x = 0, y = 0, z = 0
  for (const [ra, dec] of pts) {
    const r = (ra * Math.PI) / 180, d = (dec * Math.PI) / 180
    x += Math.cos(d) * Math.cos(r); y += Math.cos(d) * Math.sin(r); z += Math.sin(d)
  }
  const ra = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
  const dec = (Math.atan2(z, Math.hypot(x, y)) * 180) / Math.PI
  let halfW = 0, halfH = 0
  for (const [pra, pdec] of pts) {
    const p = project(pra, pdec, ra, dec)
    if (!p.visible) continue
    halfW = Math.max(halfW, Math.abs(p.x))
    halfH = Math.max(halfH, Math.abs(p.y))
  }
  return { ra, dec, halfW, halfH }
}

export const figureName = (id: string): string => constellationName(id)?.name ?? id

/** A view onto the sky: look direction, pixels per radian, and the canvas size. */
export type View = { ra0: number; dec0: number; scale: number; W: number; H: number }

export const PICK_RADIUS = 18
const PICK_MAG_WEIGHT = 1.2

/**
 * The star under a click at (cx, cy) in canvas pixels. Brighter stars win
 * near-ties: the stars a figure is made of are the bright ones, and at a wide
 * view a faint one a pixel nearer should not steal the click from the one you
 * were obviously aiming at.
 */
export function pickStar(cx: number, cy: number, v: View): Star | null {
  let best: Star | null = null
  let bestCost = Infinity
  for (const s of STARS) {
    const p = project(s.ra, s.dec, v.ra0, v.dec0)
    if (!p.visible) continue
    const sx = v.W / 2 + p.x * v.scale
    if (Math.abs(sx - cx) > PICK_RADIUS) continue
    const d = Math.hypot(sx - cx, v.H / 2 - p.y * v.scale - cy)
    if (d > PICK_RADIUS) continue
    const cost = d + s.mag * PICK_MAG_WEIGHT
    if (cost < bestCost) { best = s; bestCost = cost }
  }
  return best
}

/** The view that shows a whole figure in a canvas of this size. */
export function fitView(id: string, W: number, H: number, min = 120, max = 6400): View {
  const f = figureView(id)
  const scale = Math.max(min, Math.min(max, Math.min((W * 0.36) / Math.max(f.halfW, 0.01), (H * 0.34) / Math.max(f.halfH, 0.01))))
  return { ra0: f.ra, dec0: f.dec, scale, W, H }
}

export const BANDS: readonly { min: number; name: string; line: string }[] = [
  { min: 90, name: 'Star chart.', line: 'You could navigate by that.' },
  { min: 75, name: 'Navigator.', line: 'A sailor would trust most of it.' },
  { min: 55, name: 'Stargazer.', line: 'Recognisable, with a few stars borrowed from the neighbours.' },
  { min: 35, name: 'Tourist.', line: 'The shape is in there somewhere.' },
  { min: 0, name: 'Cloudy night.', line: 'The sky will still be there tomorrow.' },
]
export const verdictFor = (score: number) => BANDS.find((b) => score >= b.min) ?? BANDS[BANDS.length - 1]
