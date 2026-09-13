/**
 * Access helpers over the real star data in data/star-catalog.ts and
 * data/constellation-lines.ts. The generated files store rows as compact
 * tuples and plain arrays; everything that reads them by field name or
 * looks one up by id lives here, once, so a column-order slip has exactly
 * one place to happen rather than one per call site.
 */
import { STAR_TUPLES, type StarTuple } from '../data/star-catalog'
import { CONSTELLATION_LINES, CONSTELLATION_NAMES, type ConstellationLines, type ConstellationName } from '../data/constellation-lines'
import { angularSeparationDeg } from './sky-projection'

export interface Star {
  id: number
  ra: number
  dec: number
  mag: number
  ci: number | null
  proper: string
  bayer: string
  flam: string
  con: string
}

const starOf = (t: StarTuple): Star => ({
  id: t[0], ra: t[1], dec: t[2], mag: t[3], ci: t[4], proper: t[5], bayer: t[6], flam: t[7], con: t[8],
})

/** All ${STAR_TUPLES.length} real stars, decoded once. */
export const STARS: Star[] = STAR_TUPLES.map(starOf)

const byId = new Map(STARS.map((s) => [s.id, s]))
export const starById = (id: number): Star | undefined => byId.get(id)

/** Real Bayer Greek-letter abbreviations (Yale Bright Star Catalogue convention), for display. */
const GREEK: Record<string, string> = {
  Alp: 'α', Bet: 'β', Gam: 'γ', Del: 'δ', Eps: 'ε', Zet: 'ζ',
  Eta: 'η', The: 'θ', Iot: 'ι', Kap: 'κ', Lam: 'λ', Mu: 'μ',
  Nu: 'ν', Xi: 'ξ', Omi: 'ο', Pi: 'π', Rho: 'ρ', Sig: 'σ',
  Tau: 'τ', Ups: 'υ', Phi: 'φ', Chi: 'χ', Psi: 'ψ', Ome: 'ω',
}

/** "Sirius" if it has a real proper name, else a real Bayer-style label like
 *  "α CMa", else a plain "HYG 32263" as the last resort. */
export function starLabel(s: Star): string {
  if (s.proper) return s.proper
  if (s.bayer) {
    const [letter, component] = s.bayer.split('-')
    const glyph = GREEK[letter]
    if (glyph) return `${glyph}${component ?? ''} ${s.con}`.trim()
  }
  if (s.flam) return `${s.flam} ${s.con}`
  return `HYG ${s.id}`
}

export const CONSTELLATIONS: ConstellationLines[] = CONSTELLATION_LINES
export const CONSTELLATION_BY_ID = new Map(CONSTELLATION_NAMES.map((c) => [c.id, c]))
export const constellationName = (id: string): ConstellationName | undefined => CONSTELLATION_BY_ID.get(id)

const starsByCon = new Map<string, Star[]>()
for (const s of STARS) {
  if (!s.con) continue
  const list = starsByCon.get(s.con)
  if (list) list.push(s)
  else starsByCon.set(s.con, [s])
}
/** Every catalogued star (mag ≤ 6.5) inside a real IAU constellation, brightest first — STARS is already mag-sorted, so insertion order already is too. */
export const starsInConstellation = (con: string): Star[] => starsByCon.get(con) ?? []

/** The real brightest catalogued star in a constellation, or null if none made the cut. */
export function brightestIn(con: string): Star | null {
  return starsInConstellation(con)[0] ?? null
}

/** The nearest star to (ra, dec) within maxDeg of real angular separation, or null. Linear scan — fine at ~8,900 stars for an interactive click, not a hot loop. */
export function nearestStar(ra: number, dec: number, maxDeg: number): Star | null {
  let best: Star | null = null
  let bestSep = maxDeg
  for (const s of STARS) {
    // A cheap declination-only pre-filter avoids the trig below for the
    // overwhelming majority of stars that cannot possibly be within range.
    if (Math.abs(s.dec - dec) > maxDeg) continue
    const sep = angularSeparationDeg(ra, dec, s.ra, s.dec)
    if (sep <= bestSep) { best = s; bestSep = sep }
  }
  return best
}

/** Case-insensitive search over real proper names and constellation names, for a "fly to" search box. */
export function searchStars(query: string, limit = 8): Star[] {
  const q = query.trim().toLowerCase()
  if (q.length < 2) return []
  const out: Star[] = []
  for (const s of STARS) {
    if (s.proper.toLowerCase().includes(q)) out.push(s)
    if (out.length >= limit) break
  }
  return out
}
