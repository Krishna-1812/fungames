/**
 * Ambient Mix's layers, its presets, and the code that goes in the URL.
 *
 * The layer list used to live in the page's frontmatter. It is here now
 * because a shareable mix has to be encoded and decoded, and anything that
 * turns state into a string somebody else will paste back deserves to be
 * tested rather than hoped about.
 *
 * ## The format
 *
 *     1  k  r v  w v  ...
 *     ^  ^  ^^^^
 *     |  |  one pair per audible layer: its code, then its volume
 *     |  master volume
 *     version
 *
 * Two properties matter more than compactness, and both are checked in
 * scripts/check-mix.mjs:
 *
 * **It is keyed on a per-layer letter, not on position.** Encoding by index
 * would mean that adding a thirteenth layer, or sorting the list differently,
 * silently rewrites every link anybody has already shared. The letters below
 * are fixed for good; a new layer gets a new one.
 *
 * **Unknown pairs are skipped, not fatal.** A link made by a later version
 * with layers this one has never heard of should still play the layers it does
 * know, rather than refusing the whole mix.
 *
 * Volumes are quantised to 32 steps. A volume slider has about five useful
 * positions and this gives thirty-two, so the loss is inaudible and the whole
 * mix fits in twenty-six characters.
 */

export type Layer = {
  id: string
  name: string
  /** Key into lib/icons.ts. Not an emoji: see the note at the top of that file. */
  icon: string
  hint: string
  /** Fixed for the life of the layer. Never reuse one. */
  code: string
}

export const LAYERS: Layer[] = [
  { id: 'rain', name: 'Rain', icon: 'rain', hint: 'Filtered white noise', code: 'r' },
  { id: 'waves', name: 'Waves', icon: 'waves', hint: 'Brown noise under a slow swell', code: 'w' },
  { id: 'wind', name: 'Wind', icon: 'wind', hint: 'A drifting low-pass', code: 'i' },
  { id: 'fire', name: 'Campfire', icon: 'fire', hint: 'Rumble plus random crackle', code: 'f' },
  { id: 'cafe', name: 'Coffee shop', icon: 'cafe', hint: 'Murmur and occasional cups', code: 'c' },
  { id: 'birds', name: 'Birds', icon: 'bird', hint: 'Swept sine chirps', code: 'b' },
  { id: 'crickets', name: 'Crickets', icon: 'cricket', hint: 'Rhythmic high bursts', code: 'k' },
  { id: 'traffic', name: 'Highway', icon: 'traffic', hint: 'Distant steady roar', code: 't' },
  { id: 'clock', name: 'Clock', icon: 'clock', hint: 'One click per second', code: 'o' },
  { id: 'thunder', name: 'Thunder', icon: 'thunder', hint: 'Rare, long, low', code: 'h' },
  { id: 'mower', name: 'Lawnmower', icon: 'mower', hint: 'A neighbour, at 8am', code: 'm' },
  { id: 'dial', name: 'Dial-up modem', icon: 'modem', hint: 'Regrettable', code: 'd' },
]

export const layerById = (id: string) => LAYERS.find((l) => l.id === id)
export const layerByCode = (c: string) => LAYERS.find((l) => l.code === c)

/* -------------------------------------------------------------------------- */
/* The code                                                                   */
/* -------------------------------------------------------------------------- */

export const VERSION = '1'
/** 32 steps, in an alphabet with no characters a URL would want to escape. */
const VOLS = '0123456789abcdefghijklmnopqrstuv'
const STEPS = VOLS.length - 1

/** A mix: a master level, and a level for every layer that is audible. */
export type Mix = {
  master: number
  /** Keyed by layer id. Anything absent is off. All values in 0..1. */
  levels: Record<string, number>
}

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0)
const toChar = (v: number) => VOLS[Math.round(clamp01(v) * STEPS)]
const fromChar = (c: string) => {
  const i = VOLS.indexOf(c)
  return i < 0 ? null : i / STEPS
}

/**
 * Pack a mix into a URL-safe string.
 *
 * Silent layers are left out rather than written as zero, so a two-layer mix
 * is six characters and not twenty-six.
 */
export function encode(mix: Mix): string {
  let s = VERSION + toChar(mix.master)
  for (const l of LAYERS) {
    const v = clamp01(mix.levels[l.id] ?? 0)
    if (v <= 0) continue
    s += l.code + toChar(v)
  }
  return s
}

/**
 * Unpack one. Returns null only when the string is not a mix code at all —
 * everything recoverable is recovered.
 */
export function decode(s: string | null | undefined): Mix | null {
  if (typeof s !== 'string') return null
  const t = s.trim()
  if (t.length < 2 || t[0] !== VERSION) return null
  const master = fromChar(t[1])
  if (master === null) return null

  const levels: Record<string, number> = {}
  // Pairs after the header. An odd trailing character is ignored rather than
  // treated as an error: half a pair carries no information either way.
  for (let i = 2; i + 1 < t.length; i += 2) {
    const l = layerByCode(t[i])
    const v = fromChar(t[i + 1])
    // A code this version has never heard of belongs to a later one. Skip it
    // and play the rest, which is the whole reason for pairing rather than
    // writing a fixed-width vector.
    if (!l || v === null) continue
    if (v > 0) levels[l.id] = v
  }
  return { master, levels }
}

/** Round-trip a mix through the code, so callers can see what will survive. */
export const quantise = (mix: Mix): Mix => decode(encode(mix)) ?? { master: 0.7, levels: {} }

/* -------------------------------------------------------------------------- */
/* Presets                                                                    */
/* -------------------------------------------------------------------------- */

export type Preset = {
  id: string
  name: string
  /** One line, shown under the name. */
  note: string
  mix: Mix
}

/**
 * Eight starting points.
 *
 * The point of these is that the twelve layers are not equally good together,
 * and finding the combinations that work is the sort of thing you only do if
 * you already know the toy. Somebody arriving for thirty seconds does not.
 */
export const PRESETS: Preset[] = [
  {
    id: 'storm',
    name: 'Thunderstorm',
    note: 'Heavy rain, wind behind it, and thunder far enough away to be pleasant.',
    mix: { master: 0.75, levels: { rain: 0.85, wind: 0.4, thunder: 0.6 } },
  },
  {
    id: 'coast',
    name: 'The coast',
    note: 'Swell and wind, with gulls that are not quite gulls.',
    mix: { master: 0.7, levels: { waves: 0.8, wind: 0.45, birds: 0.2 } },
  },
  {
    id: 'camp',
    name: 'Camp at night',
    note: 'A fire, and everything in the grass that comes out after dark.',
    mix: { master: 0.7, levels: { fire: 0.75, crickets: 0.45, wind: 0.2 } },
  },
  {
    id: 'cafe',
    name: 'Corner table',
    note: 'A coffee shop with rain on the window. The classic, and it works.',
    mix: { master: 0.65, levels: { cafe: 0.6, rain: 0.5 } },
  },
  {
    id: 'office',
    name: '3am office',
    note: 'The building is empty, the motorway is not, and the clock is the loudest thing in the room.',
    mix: { master: 0.6, levels: { traffic: 0.3, clock: 0.55, rain: 0.15 } },
  },
  {
    id: 'dawn',
    name: 'Dawn chorus',
    note: 'Birds, a little wind, and nothing else awake yet.',
    mix: { master: 0.7, levels: { birds: 0.65, wind: 0.25 } },
  },
  {
    id: 'sunday',
    name: 'Suburbia, Sunday',
    note: 'Somebody two gardens away has started the mower. It is nine in the morning.',
    mix: { master: 0.65, levels: { mower: 0.55, birds: 0.35, traffic: 0.2 } },
  },
  {
    id: 'unbearable',
    name: 'Unbearable',
    note: 'Every layer at once, including the modem. You will not last a minute.',
    mix: {
      master: 0.85,
      levels: Object.fromEntries(LAYERS.map((l) => [l.id, 1])),
    },
  },
]

export const presetById = (id: string) => PRESETS.find((p) => p.id === id)

/** How many layers a mix actually plays. */
export const layerCount = (mix: Mix) =>
  LAYERS.reduce((n, l) => n + ((mix.levels[l.id] ?? 0) > 0 ? 1 : 0), 0)
