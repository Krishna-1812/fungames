/*
 * How much the picture asks of the machine: four levels, and Auto.
 *
 *   Low     a phone or an old laptop: the screen's pixels at most one to a point,
 *           small soft shadows, no occlusion, contact shadows or glow, flat clouds
 *           (not raymarched), grass only close by, fewer people out and lighter rain.
 *   Medium  most phones and small laptops: up to one and a half pixels to a point,
 *           2048 shadows, the glow, more grass and people.
 *   High    a desktop or a good laptop: the screen's own pixels (up to two to a
 *           point), 4096 shadows, the occlusion at half size.
 *   Ultra   a strong graphics card: drawn at least one and a half pixels to a point
 *           even on a plain screen (so every edge is smooth), the occlusion at full
 *           size, the grass reaching furthest.
 *
 * Auto starts from what the device says of itself (a phone, how many cores, how
 * much memory) and from what it found last time; then, if the frames come too
 * slowly, it steps down a level (and, at Low, a little sharpness, never below
 * three quarters of a pixel). Once in a visit, if it is running easily at the level
 * it came down to last time, it tries the one above again.
 *
 * Pure: walker.ts applies a level; check-walk checks the table and the steps.
 */

export type Tier = 'low' | 'medium' | 'high' | 'ultra'
export const TIER_ORDER: Tier[] = ['low', 'medium', 'high', 'ultra']
export const TIER_NAMES: Record<Tier, string> = { low: 'Low', medium: 'Medium', high: 'High', ultra: 'Ultra' }

export type TierSpec = {
  /** Pixels to a point: at most this many (the screen's own, if fewer)… */
  maxPixels: number
  /** …and at least this many (more than the screen has: drawn larger, then smoothed down). */
  minPixels: number
  /** The sun's shadow map, a side. */
  shadow: number
  /** Ambient occlusion: none, at half the picture's size, or at its full size. */
  ao: 'off' | 'half' | 'full'
  /** The glow round bright lights. */
  bloom: boolean
  /** Contact shadows (lens.ts): the sun's shadow in the last few centimetres. */
  contact: boolean
  /** The volumetric clouds' steps through the sky (clouds.ts); none: the flat clouds stand in. */
  clouds: number
  /** How far the grass is drawn (tiles). */
  grass: number
  /** How many of the island's people are out (of all of them). */
  people: number
  /** How heavy the rain is drawn (of all the streaks). */
  rain: number
}

export const TIERS: Record<Tier, TierSpec> = {
  low: { maxPixels: 1, minPixels: 0.75, shadow: 1024, ao: 'off', bloom: false, contact: false, clouds: 0, grass: 4, people: 0.45, rain: 0.35 },
  medium: { maxPixels: 1.5, minPixels: 0.75, shadow: 2048, ao: 'off', bloom: true, contact: true, clouds: 24, grass: 6, people: 0.7, rain: 0.6 },
  high: { maxPixels: 2, minPixels: 1, shadow: 4096, ao: 'half', bloom: true, contact: true, clouds: 36, grass: 9, people: 1, rain: 1 },
  ultra: { maxPixels: 2.5, minPixels: 1.5, shadow: 4096, ao: 'full', bloom: true, contact: true, clouds: 48, grass: 12, people: 1, rain: 1 },
}

/** The pixels to a point a level draws at, on a screen with so many of its own. */
export const pixelsFor = (t: Tier, devicePixels: number, sharp = 1) => {
  const s = TIERS[t]
  return Math.max(0.75, Math.min(s.maxPixels, Math.max(s.minPixels, devicePixels)) * sharp)
}

/** What a device says of itself. */
export type Device = { phone: boolean; cores: number; memory: number | null; pixels: number; width: number; height: number }

/** Auto's first guess: a phone Medium (Low if a small one), a computer High (Medium if a small one); never Ultra. */
export function guessTier(d: Device): Tier {
  const weak = d.cores <= 4 || (d.memory !== null && d.memory <= 4)
  if (d.phone) return weak ? 'low' : 'medium'
  return weak ? 'medium' : 'high'
}

/** One level down (null at the bottom), one up (null at the top). */
export const below = (t: Tier): Tier | null => TIER_ORDER[TIER_ORDER.indexOf(t) - 1] ?? null
export const above = (t: Tier): Tier | null => TIER_ORDER[TIER_ORDER.indexOf(t) + 1] ?? null

/**
 * Auto, watching the frame rate: each stretch of a few seconds, how many frames a second it
 * managed (and how many milliseconds of each frame the processor was busy with). Two slow
 * stretches running (under 45) and it steps down; at Low, the sharpness goes down an
 * eighth at a time to three quarters — unless it is the processor that cannot keep up
 * (busy most of each frame), which fewer pixels would not help. A minute running at 58
 * or more, at a level it came down to from a higher one, and it tries the higher
 * one again — once a visit, and never above where it started.
 */
export function autoStep(s: { tier: Tier; sharp: number; slow: number; easy: number; triedUp: boolean; ceiling: Tier }, fps: number, stretch: number, cpuMs = 0) {
  const n = { ...s, changed: false as boolean }
  n.slow = fps < 45 ? s.slow + 1 : 0
  n.easy = fps >= 58 ? s.easy + stretch : 0
  if (n.slow >= 2) {
    n.slow = 0; n.easy = 0
    const d = below(s.tier)
    if (d) { n.tier = d; n.changed = true }
    else if (s.sharp > 0.75 && cpuMs < 0.75 * (1000 / Math.max(1, fps))) { n.sharp = Math.max(0.75, s.sharp - 0.125); n.changed = true }
  } else if (n.easy >= 60 && !s.triedUp && TIER_ORDER.indexOf(s.tier) < TIER_ORDER.indexOf(s.ceiling)) {
    n.easy = 0; n.triedUp = true
    if (s.sharp < 1) n.sharp = 1
    else n.tier = above(s.tier)!
    n.changed = true
  }
  return n
}
