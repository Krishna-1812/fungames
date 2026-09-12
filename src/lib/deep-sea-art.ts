/**
 * The Deep Sea's twenty-two markers, drawn.
 *
 * Same three constraints as `time-art.ts`, for the same reason: these inline
 * into one document alongside the tile art, Scale's things and Deep Time's
 * events, and `check-deep-sea-art.mjs` enforces all three the same way
 * `check-time-art.mjs` does.
 *
 * **No gradients, no ids, no defs.** Flat colour only — genuinely the better
 * choice at the sizes these actually render at, not just a rule to follow.
 *
 * **One palette.** Every fill comes from `P` below.
 *
 * **Every scene owns its background.** These sit on a translucent card over a
 * background that runs from bright surface blue to hadal black, so a scene
 * with a gap in it is a different picture at the top of the page than the
 * bottom. Each one paints its own water, floor to ceiling.
 *
 * Depth itself is the one thing every scene shares without saying so: reef
 * water is bright and warm, midnight water is one flat near-black rect, and
 * nothing in between fakes daylight it should not have.
 */

export const P = {
  reef: '#0e5a72',
  shallow: '#155073',
  twilight: '#123a52',
  dusk: '#0d2438',
  ink: '#0a1a28',
  abyss: '#081420',
  void: '#0e1622',
  trench2: '#111c2a',
  foam: '#d8f3f7',
  coral: '#e2735a',
  coral2: '#f0a24f',
  coral3: '#f5b878',
  kelp: '#2f6b4a',
  kelp2: '#3f8a63',
  diver: '#1c2026',
  tank: '#8a94a0',
  glow: '#7ff2d6',
  glow2: '#69c8ff',
  lure: '#ffe27a',
  flesh: '#d99a8a',
  bone: '#e8dfc8',
  vamp: '#5c2734',
  vamp2: '#8f4a58',
  squid: '#42395a',
  squid2: '#544a70',
  squid3: '#6b5f88',
  whale: '#33465a',
  whale2: '#4a6076',
  vent: '#3a2a22',
  vent2: '#c96a3a',
  smoke: '#262a30',
  ember: '#ff7a3c',
  tube: '#c94f3f',
  rust: '#7a4030',
  iron: '#4a5560',
  hull2: '#6b7885',
  sand: '#8a7654',
  nodule: '#5c5142',
  pale: '#9fb8c4',
  scale: '#9db3bd',
} as const

export type Scene = {
  subject: string
  draw: () => string
}

const W = 120
const H = 80

/** Deterministic scatter, same generator as the other art modules. */
export const rnd = (seed: number, k: number) => {
  const x = Math.sin(seed * 9301 + k * 49297) * 233280
  return x - Math.floor(x)
}

/** A flat sheet of water filling the whole frame. */
const bg = (colour: string) => `<rect width="${W}" height="${H}" fill="${colour}"/>`

/** Water above a seafloor, for scenes that rest on the bottom. */
const floor = (water: string, ground: string, horizon = 58) =>
  `<rect width="${W}" height="${horizon}" fill="${water}"/>` +
  `<rect y="${horizon}" width="${W}" height="${H - horizon}" fill="${ground}"/>`

/** Marine snow — slow, tiny, dim. Present in every scene past the reef. */
const snow = (seed: number, n = 10, colour: string = P.pale, maxY = H) =>
  Array.from({ length: n }, (_, i) => {
    const x = rnd(seed, i) * W
    const y = rnd(seed, i + 30) * maxY
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(0.5 + rnd(seed, i + 60) * 0.6).toFixed(1)}" fill="${colour}" opacity="${(0.2 + rnd(seed, i + 90) * 0.25).toFixed(2)}"/>`
  }).join('')

/** A bioluminescent point — a dim halo under a bright core, since a real
 *  blur filter needs a <defs>, which these scenes are not allowed. */
const spark = (x: number, y: number, colour: string, r = 2.4) =>
  `<circle cx="${x}" cy="${y}" r="${r * 2.2}" fill="${colour}" opacity="0.18"/>` +
  `<circle cx="${x}" cy="${y}" r="${r}" fill="${colour}" opacity="0.9"/>`

/** A gentle current — one full wave cycle, full width, low opacity. Cheap
 *  texture that reads as moving water rather than as clutter, and the thing
 *  most of these scenes needed most: real perimeter spread across the whole
 *  frame, not just around whatever creature sits in the middle of it. */
const current = (seed: number, n = 5, colour: string = P.pale, maxY = H, op = 0.16) =>
  Array.from({ length: n }, (_, i) => {
    const y = ((i + 0.5) / n) * maxY
    const amp = (3 + rnd(seed, i) * 5) * (rnd(seed, i + 77) > 0.5 ? 1 : -1)
    return `<path d="M0 ${y.toFixed(1)} q${(W / 4).toFixed(1)} ${amp.toFixed(1)} ${(W / 2).toFixed(1)} 0 q${(W / 4).toFixed(1)} ${(-amp).toFixed(1)} ${(W / 2).toFixed(1)} 0" stroke="${colour}" stroke-width="1.4" fill="none" opacity="${op}"/>`
  }).join('')

const sparks = (seed: number, n: number, colour: string, maxY = H) =>
  Array.from({ length: n }, (_, i) =>
    spark(rnd(seed, i) * W, rnd(seed, i + 20) * maxY, colour, 0.8 + rnd(seed, i + 40) * 1.3),
  ).join('')

/** A slanted shaft of light, brightest at the top — the one accent that only
 *  ever belongs to the handful of scenes shallow enough to still earn it. */
const rays = (x: number, w: number, colour: string, op = 0.12) =>
  `<path d="M${x - w} 0 L${x + w} 0 L${x + w * 0.32} ${H} L${x - w * 0.32} ${H}Z" fill="${colour}" opacity="${op}"/>`

/** Sediment resting on the floor — denser, warmer and lower than marine snow,
 *  which drifts through the whole water column instead. */
const silt = (seed: number, n: number, colour: string, y0: number, y1: number) =>
  Array.from({ length: n }, (_, i) => {
    const x = rnd(seed, i) * W
    const y = y0 + rnd(seed, i + 40) * (y1 - y0)
    const r = 0.6 + rnd(seed, i + 70) * 0.9
    const o = 0.22 + rnd(seed, i + 90) * 0.3
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${colour}" opacity="${o.toFixed(2)}"/>`
  }).join('')

/** A diver's own rising breath — the only current-safe way to say "ascent"
 *  without a single stroke leaving the palette. */
const bubbleTrail = (x: number, yTop: number, yBottom: number, seed: number, n = 7) =>
  Array.from({ length: n }, (_, i) => {
    const t = i / n
    const y = yBottom - t * (yBottom - yTop)
    const wob = (rnd(seed, i) - 0.5) * 6
    const r = 0.5 + rnd(seed, i + 20) * 1.1
    const o = 0.22 + rnd(seed, i + 40) * 0.3
    return `<circle cx="${(x + wob).toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${P.foam}" opacity="${o.toFixed(2)}"/>`
  }).join('')

/** A soft double-ring halo behind a creature's own light — the glow a real
 *  bioluminescent lure or photophore throws into the water around it,
 *  distinct from `spark`'s tight point-light. */
const halo = (x: number, y: number, colour: string, r: number, op = 0.14) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="${colour}" opacity="${op}"/>` +
  `<circle cx="${x}" cy="${y}" r="${r * 0.55}" fill="${colour}" opacity="${op * 1.6}"/>`

export const DEEP_SEA_ART: Record<string, Scene> = {
  'Coral reefs': {
    subject: 'a bright, sunlit reef crowded with coral and small fish',
    draw: () =>
      floor(P.reef, P.sand, 60) +
      rays(18, 10, P.foam, 0.11) + rays(56, 8, P.foam, 0.08) + rays(96, 11, P.foam, 0.09) +
      `<path d="M0 60 q10 -3 20 0 t20 0 t20 0 t20 0 t20 0 t20 0" stroke="${P.nodule}" stroke-width="1" fill="none" opacity="0.3"/>` +
      // brain coral, ridged
      `<ellipse cx="24" cy="64" rx="10" ry="6" fill="${P.coral3}"/>` +
      Array.from({ length: 4 }, (_, i) => `<path d="M${17 + i * 4} 64 q2 -3.5 4 0" stroke="${P.coral2}" stroke-width="0.8" fill="none" opacity="0.6"/>`).join('') +
      // branching staghorn coral, two-tone for volume
      `<path d="M72 60 q-4 -16 2 -22 q3 8 1 14 q6 -9 12 -7 q-2 8 -8 11 q8 -3 12 3 q-6 5 -13 3 q4 6 0 9Z" fill="${P.coral}"/>` +
      `<path d="M78 44 q3 5 1 10 q4 -4 6 -2 q-3 4 -7 4" fill="${P.coral2}" opacity="0.7"/>` +
      // fan coral + anemone
      `<ellipse cx="94" cy="40" rx="5" ry="3" fill="${P.coral2}"/><path d="M99 40 L104 36 L104 44Z" fill="${P.coral2}"/>` +
      `<ellipse cx="46" cy="28" rx="4" ry="2.3" fill="${P.foam}"/><path d="M50 28 L54 25 L54 31Z" fill="${P.foam}"/>` +
      `<ellipse cx="46" cy="28" rx="2" ry="1.1" fill="${P.coral3}" opacity="0.6"/>` +
      // kelp, shaded
      `<path d="M8 60 q4 -18 -2 -32" fill="none" stroke="${P.kelp}" stroke-width="3"/>` +
      `<path d="M8 60 q4 -18 -2 -32" fill="none" stroke="${P.kelp2}" stroke-width="1"/>` +
      `<path d="M16 60 q6 -14 0 -28" fill="none" stroke="${P.kelp}" stroke-width="2.2"/>` +
      // a small school, schooling toward the light
      Array.from({ length: 6 }, (_, i) => {
        const x = 58 + i * 8 + (i % 2) * 3
        const y = 14 + (i % 3) * 5
        return `<path d="M${x} ${y} l5 -2.2 l0 4.4Z" fill="${P.coral2}"/><path d="M${x} ${y} l-2.4 -1 l0 2Z" fill="${P.coral}"/>`
      }).join('') +
      snow(41, 6, P.foam, 22),
  },

  'The recreational diving limit': {
    subject: 'a lone diver descending a marked line, breath rising toward a surface far above',
    draw: () =>
      bg(P.shallow) +
      rays(30, 15, P.foam, 0.09) + rays(94, 11, P.foam, 0.07) +
      `<ellipse cx="60" cy="-14" rx="76" ry="18" fill="${P.foam}" opacity="0.14"/>` +
      `<line x1="24" y1="0" x2="24" y2="76" stroke="${P.foam}" stroke-width="1" opacity="0.4"/>` +
      Array.from({ length: 8 }, (_, i) => `<line x1="20" y1="${i * 10 + 4}" x2="28" y2="${i * 10 + 4}" stroke="${P.foam}" stroke-width="1" opacity="0.35"/>`).join('') +
      `<rect x="55" y="34" width="10" height="16" rx="4" fill="${P.tank}"/>` +
      `<rect x="55" y="34" width="3" height="16" rx="1.5" fill="${P.foam}" opacity="0.4"/>` +
      `<rect x="56" y="36" width="8" height="4" fill="${P.ink}"/>` +
      `<ellipse cx="60" cy="48" rx="9" ry="13" fill="${P.diver}"/>` +
      `<path d="M60 36 q7 0 8 12 q1 12 -8 13Z" fill="${P.ink}" opacity="0.5"/>` +
      `<rect x="50" y="46" width="8" height="6" rx="2" fill="${P.tank}"/><line x1="51" y1="49" x2="57" y2="49" stroke="${P.glow2}" stroke-width="1"/>` +
      `<path d="M52 42 q-11 3 -15 -6" stroke="${P.diver}" stroke-width="4" fill="none" stroke-linecap="round"/>` +
      `<path d="M68 44 q10 7 11 17" stroke="${P.diver}" stroke-width="4" fill="none" stroke-linecap="round"/>` +
      `<path d="M55 60 q-6 9 -3 17" stroke="${P.diver}" stroke-width="4" fill="none" stroke-linecap="round"/>` +
      `<path d="M65 60 q6 8 1 17" stroke="${P.diver}" stroke-width="4" fill="none" stroke-linecap="round"/>` +
      `<path d="M52 77 l-6 2 l1 -4Z" fill="${P.diver}"/><path d="M68 77 l6 2 l-1 -4Z" fill="${P.diver}"/>` +
      bubbleTrail(67, 4, 40, 41) +
      Array.from({ length: 4 }, (_, i) => `<path d="M${84 + i * 5} ${18 + i * 3} l4 -1.7 l0 3.4Z" fill="${P.pale}" opacity="0.4"/>`).join('') +
      `<circle cx="67" cy="24" r="2" fill="${P.foam}" opacity="0.55"/>` +
      `<circle cx="71" cy="15" r="1.3" fill="${P.foam}" opacity="0.45"/>` +
      `<circle cx="63" cy="9" r="1" fill="${P.foam}" opacity="0.4"/>` +
      snow(41, 6, P.pale, 76),
  },

  'Ninety percent of what lives here makes its own light': {
    subject: 'a shoal of hatchetfish and lanternfish, lit from underneath by themselves',
    draw: () =>
      bg(P.twilight) +
      current(45, 6, P.pale, 80, 0.55) +
      snow(4, 10) +
      `<path d="M32 36 L22 31 L14 36 L22 43 L32 48 L40 38Z" fill="${P.dusk}"/>` +
      `<path d="M32 36 L22 31 L14 36 L22 40Z" fill="${P.ink}" opacity="0.55"/>` +
      `<circle cx="24" cy="34" r="1.1" fill="${P.foam}" opacity="0.5"/>` +
      halo(22, 43, P.glow, 5, 0.1) +
      `${spark(20, 43, P.glow, 1.2)}${spark(25, 46, P.glow, 1)}${spark(30, 45, P.glow, 1)}${spark(35, 41, P.glow, 0.8)}` +
      `<path d="M90 50 L79 44 L70 50 L79 57 L90 62 L99 52Z" fill="${P.dusk}"/>` +
      `<path d="M90 50 L79 44 L70 50 L79 54Z" fill="${P.ink}" opacity="0.55"/>` +
      `<circle cx="81" cy="47" r="1.1" fill="${P.foam}" opacity="0.5"/>` +
      halo(80, 57, P.glow2, 5, 0.1) +
      `${spark(76, 57, P.glow2, 1.2)}${spark(82, 60, P.glow2, 1)}${spark(88, 59, P.glow2, 1)}${spark(93, 54, P.glow2, 0.8)}` +
      `<path d="M58 14 L50 10 L44 14 L50 19 L58 23 L64 17Z" fill="${P.dusk}"/>` +
      `${spark(48, 19, P.glow, 1)}${spark(54, 21, P.glow, 0.9)}${spark(60, 18, P.glow, 0.7)}` +
      `<path d="M20 64 L13 60 L7 64 L13 69 L20 72 L26 65Z" fill="${P.dusk}"/>` +
      `${spark(11, 69, P.glow2, 0.9)}${spark(16, 71, P.glow2, 0.8)}` +
      `<path d="M100 20 L94 16 L88 20 L94 25 L100 28 L106 21Z" fill="${P.ink}" opacity="0.7"/>` +
      `${spark(92, 25, P.glow2, 0.8)}` +
      `<path d="M0 20 q60 8 120 -4" stroke="${P.pale}" stroke-width="0.6" fill="none" opacity="0.15"/>` +
      `<path d="M0 60 q60 -10 120 6" stroke="${P.pale}" stroke-width="0.6" fill="none" opacity="0.12"/>` +
      sparks(11, 10, P.glow2),
  },

  'The deepest a scuba diver has ever gone': {
    subject: 'a pressure gauge pinned near its limit, and a line up to a memory of a surface',
    draw: () =>
      bg(P.dusk) +
      `<line x1="70" y1="0" x2="70" y2="80" stroke="${P.pale}" stroke-width="1" opacity="0.3"/>` +
      `<rect x="64" y="30" width="12" height="18" rx="4" fill="${P.tank}"/>` +
      `<rect x="64" y="30" width="4" height="18" rx="2" fill="${P.scale}" opacity="0.4"/>` +
      `<ellipse cx="70" cy="45" rx="9" ry="12" fill="${P.diver}"/>` +
      `<path d="M70 33 q7 0 8 12 q1 11 -8 12Z" fill="${P.ink}" opacity="0.45"/>` +
      `<path d="M62 40 q-10 2 -13 -6" stroke="${P.diver}" stroke-width="4" fill="none" stroke-linecap="round"/>` +
      `<path d="M78 42 q9 6 9 15" stroke="${P.diver}" stroke-width="4" fill="none" stroke-linecap="round"/>` +
      `<path d="M65 56 q-5 8 -2 15" stroke="${P.diver}" stroke-width="4" fill="none" stroke-linecap="round"/>` +
      `<path d="M75 56 q5 7 1 15" stroke="${P.diver}" stroke-width="4" fill="none" stroke-linecap="round"/>` +
      bubbleTrail(76, 4, 34, 6) +
      `<circle cx="22" cy="18" r="20" fill="${P.foam}" opacity="0.06"/>` +
      `<circle cx="22" cy="46" r="16" fill="${P.ink}" opacity="0.5"/>` +
      `<circle cx="22" cy="46" r="15" fill="none" stroke="${P.pale}" stroke-width="1.6" opacity="0.7"/>` +
      Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2
        const x1 = 22 + Math.cos(a) * 12, y1 = 46 + Math.sin(a) * 12
        const x2 = 22 + Math.cos(a) * 15, y2 = 46 + Math.sin(a) * 15
        return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${P.pale}" stroke-width="1" opacity="0.6"/>`
      }).join('') +
      `<line x1="22" y1="46" x2="30" y2="38" stroke="${P.ember}" stroke-width="1.6" stroke-linecap="round"/>` +
      `<circle cx="22" cy="46" r="1.6" fill="${P.pale}"/>` +
      snow(6, 8, P.pale, 30),
  },

  'Giant squid': {
    subject: 'a huge eye and a wall of trailing, sucker-lined tentacles',
    draw: () =>
      bg(P.dusk) +
      current(2, 4, P.pale, 80, 0.2) +
      `<ellipse cx="60" cy="26" rx="14" ry="17" fill="${P.squid}"/>` +
      `<path d="M48 20 q-2 12 6 22 q-9 -6 -10 -18 Z" fill="${P.squid2}" opacity="0.6"/>` +
      `<path d="M60 10 q-4 -8 0 -10 q4 2 0 10Z" fill="${P.squid}"/>` +
      `<path d="M50 14 q4 -3 8 -2" stroke="${P.squid3}" stroke-width="1" fill="none" opacity="0.4"/>` +
      `<path d="M46 14 q-9 5 -8 14 q6 -4 9 -10Z" fill="${P.squid2}"/>` +
      `<path d="M74 14 q9 5 8 14 q-6 -4 -9 -10Z" fill="${P.squid2}"/>` +
      `<circle cx="55" cy="22" r="5.4" fill="${P.void}"/><circle cx="53.5" cy="20.5" r="1.6" fill="${P.foam}" opacity="0.6"/>` +
      `<path d="M48 30 q12 6 24 0" stroke="${P.squid3}" stroke-width="1" fill="none" opacity="0.4"/>` +
      `<path d="M46 38 q14 6 28 0" stroke="${P.ink}" stroke-width="1" fill="none" opacity="0.45"/>` +
      Array.from({ length: 7 }, (_, i) => {
        const x = 48 + rnd(2, i + 60) * 24
        const y = 14 + rnd(2, i + 70) * 26
        const r = 0.7 + rnd(2, i + 80) * 0.6
        return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${P.bone}" opacity="0.3"/>`
      }).join('') +
      // Eight arms and, longer and thinner, the two feeding tentacles that
      // actually set Architeuthis apart — real anatomy, not decoration.
      Array.from({ length: 8 }, (_, i) => {
        const feeder = i === 1 || i === 6
        const x = 30 + i * 8 + (rnd(2, i + 50) - 0.5) * 3
        const len = feeder ? 42 + rnd(2, i) * 8 : 20 + rnd(2, i) * 12
        const drift = (i - 3.5) * 4 + (rnd(2, i + 9) - 0.5) * 14
        const midx = x + drift * 0.5
        const midy = 40 + len * 0.55
        const endx = x + drift + (rnd(2, i + 30) - 0.5) * 8
        const endy = 40 + len
        const suckers = feeder
          ? ''
          : Array.from({ length: 3 }, (_, k) => {
              const t = (k + 1) / 4
              const sx = x + 2 * (1 - t) * t * (midx - x) + t * t * (endx - x)
              const sy = 40 + 2 * (1 - t) * t * (midy - 40) + t * t * len
              return `<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="0.8" fill="${P.bone}" opacity="0.5"/>`
            }).join('')
        const club = feeder
          ? `<ellipse cx="${endx.toFixed(1)}" cy="${endy.toFixed(1)}" rx="2.4" ry="4" fill="${P.squid3}"/>` +
            `<circle cx="${endx.toFixed(1)}" cy="${(endy - 1.5).toFixed(1)}" r="0.7" fill="${P.bone}" opacity="0.55"/>` +
            `<circle cx="${endx.toFixed(1)}" cy="${(endy + 1).toFixed(1)}" r="0.6" fill="${P.bone}" opacity="0.5"/>`
          : ''
        return (
          `<path d="M${x.toFixed(1)} 40 Q${midx.toFixed(1)} ${midy.toFixed(1)} ${endx.toFixed(1)} ${endy.toFixed(1)}" ` +
          `stroke="${P.squid2}" stroke-width="${feeder ? 1.8 : 2.6}" fill="none" stroke-linecap="round"/>${suckers}${club}`
        )
      }).join('') +
      snow(2, 8),
  },

  'Vampire squid': {
    subject: 'a webbed, umbrella-like cape of arms, lit by a ring of its own small lights',
    draw: () => {
      const cx = 60, cy = 42
      const n = 8
      const pts: [number, number][] = []
      for (let i = 0; i < n; i++) {
        const aTip = (i / n) * Math.PI * 2 - Math.PI / 2
        const aValley = aTip + Math.PI / n
        const rTip = 21 + rnd(48, i) * 7
        pts.push([cx + Math.cos(aTip) * rTip * 1.2, cy + Math.sin(aTip) * rTip * 0.82])
        pts.push([cx + Math.cos(aValley) * 9 * 1.2, cy + Math.sin(aValley) * 9 * 0.82])
      }
      const cape = 'M' + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L') + 'Z'
      const webShade = pts
        .map(([x, y], i) => (i % 2 === 1 ? `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.6" fill="${P.vamp2}" opacity="0.45"/>` : ''))
        .join('')
      const ribs = pts
        .map(([x, y], i) => (i % 2 === 0 ? `<path d="M${cx} ${cy} L${x.toFixed(1)} ${y.toFixed(1)}" stroke="${P.ink}" stroke-width="0.7" opacity="0.3"/>` : ''))
        .join('')
      const lights = pts
        .map(([x, y], i) => (i % 2 === 0 ? spark(x, y, i % 4 === 0 ? P.glow : P.glow2, 0.9) : ''))
        .join('')
      return (
        bg(P.ink) +
        current(48, 5, P.pale, 80, 0.4) +
        `<path d="${cape}" fill="${P.vamp}"/>` +
        webShade + ribs +
        `<ellipse cx="60" cy="30" rx="13" ry="12" fill="${P.vamp}"/>` +
        `<path d="M49 25 q11 -9 22 0 q-5 9 -11 9 q-6 0 -11 -9Z" fill="${P.vamp2}" opacity="0.3"/>` +
        `<circle cx="53" cy="29" r="5.8" fill="${P.void}"/><circle cx="67" cy="29" r="5.8" fill="${P.void}"/>` +
        `<circle cx="50.8" cy="27" r="1.6" fill="${P.foam}" opacity="0.55"/><circle cx="64.8" cy="27" r="1.6" fill="${P.foam}" opacity="0.55"/>` +
        lights +
        snow(7, 8)
      )
    },
  },

  Blobfish: {
    subject: 'a droopy, near-boneless body, resting on the rocks',
    draw: () =>
      floor(P.ink, P.sand, 60) +
      silt(8, 10, P.nodule, 60, 78) +
      `<ellipse cx="30" cy="66" rx="10" ry="6" fill="${P.abyss}"/>` +
      `<ellipse cx="82" cy="68" rx="14" ry="7" fill="${P.abyss}"/>` +
      `<path d="M42 58 q-6 -12 8 -18 q22 -8 30 4 q6 10 -6 20 q-4 8 -16 8 q-12 0 -16 -14Z" fill="${P.flesh}"/>` +
      `<path d="M46 52 q-2 -8 8 -12 q10 -4 16 2 q-14 -2 -20 4 q-4 3 -4 6Z" fill="${P.bone}" opacity="0.35"/>` +
      `<path d="M58 62 q10 4 18 -2 q2 8 -8 10 q-8 1 -10 -8Z" fill="${P.rust}" opacity="0.3"/>` +
      `<path d="M56 46 q6 -6 14 -2" stroke="${P.rust}" stroke-width="2" fill="none" opacity="0.4"/>` +
      `<ellipse cx="48" cy="42" rx="2.6" ry="2.2" fill="${P.void}"/><circle cx="47.3" cy="41.2" r="0.6" fill="${P.foam}" opacity="0.5"/>` +
      snow(8, 6),
  },

  'Below this, no light has ever reached': {
    subject: 'a lone siphonophore, trailing the only lights for a very long way',
    draw: () =>
      bg(P.void) +
      current(16, 6, P.pale, 80, 0.36) +
      `<path d="M60 14 q-16 2 -16 18 q0 14 16 16 q16 -2 16 -16 q0 -16 -16 -18Z" fill="${P.ink}" opacity="0.7"/>` +
      `<path d="M60 14 q-10 2 -13 12 q7 -6 13 -6Z" fill="${P.trench2}" opacity="0.5"/>` +
      `<path d="M46 28 q14 8 28 0" stroke="${P.trench2}" stroke-width="1" fill="none" opacity="0.5"/>` +
      `<path d="M46 34 q14 7 28 0" stroke="${P.trench2}" stroke-width="1" fill="none" opacity="0.4"/>` +
      Array.from({ length: 5 }, (_, i) => {
        const x = 40 + i * 10
        const len = 20 + rnd(43, i) * 26
        return `<path d="M${x} 48 q${(rnd(43, i + 9) - 0.5) * 8} ${len} ${(rnd(43, i + 20) - 0.5) * 6} ${len + 6}" stroke="${P.ink}" stroke-width="1" fill="none" opacity="0.6"/>`
      }).join('') +
      halo(52, 26, P.glow, 6, 0.12) + halo(68, 26, P.glow2, 6, 0.12) +
      spark(52, 26, P.glow, 1.4) + spark(68, 26, P.glow2, 1.4) + spark(60, 40, P.glow, 1) +
      Array.from({ length: 5 }, (_, i) => spark(40 + i * 10 + (rnd(43, i + 20) - 0.5) * 6, 74 + rnd(43, i) * 4, i % 2 ? P.glow2 : P.glow, 0.9)).join('') +
      sparks(15, 6, P.glow, 74),
  },

  Anglerfish: {
    subject: 'a single lure, and the mouth waiting underneath it',
    draw: () =>
      bg(P.void) +
      current(59, 5, P.pale, 80, 0.36) +
      `<path d="M40 30 q26 -4 6 8" stroke="${P.bone}" stroke-width="1.6" fill="none"/>` +
      halo(48, 40, P.lure, 8, 0.12) +
      spark(48, 40, P.lure, 2.2) +
      `<path d="M30 38 q4 -10 18 -12 q20 -2 24 10 q3 10 -8 16 q4 6 -2 10 q-8 4 -14 -2 q-16 4 -20 -8 q-4 -10 2 -14Z" fill="${P.squid}"/>` +
      `<path d="M32 34 q4 -8 14 -10 q-8 6 -10 14 q-3 -1 -4 -4Z" fill="${P.squid3}" opacity="0.35"/>` +
      `<path d="M34 40 q8 -6 18 -4" stroke="${P.void}" stroke-width="1" fill="none" opacity="0.5"/>` +
      `<circle cx="38" cy="36" r="2" fill="${P.void}"/><circle cx="37" cy="35.3" r="0.6" fill="${P.foam}" opacity="0.6"/>` +
      `<path d="M64 48 L70 44 L70 52Z" fill="${P.foam}" opacity="0.85"/>` +
      `<path d="M46 50 L44 56 L48 55Z" fill="${P.foam}" opacity="0.85"/>` +
      `<path d="M56 50 L55 57 L59 55Z" fill="${P.foam}" opacity="0.85"/>` +
      `<path d="M50 52 L49 58 L52 57Z" fill="${P.foam}" opacity="0.75"/>` +
      `<path d="M60 51 L60 57 L63 55Z" fill="${P.foam}" opacity="0.75"/>` +
      `<path d="M28 46 q6 8 16 8" stroke="${P.void}" stroke-width="0.8" fill="none" opacity="0.4"/>` +
      snow(9, 8),
  },

  'Sperm whales hunt here': {
    subject: 'a whale diving on an angle, chasing something smaller',
    draw: () =>
      bg(P.void) +
      current(60, 5, P.pale, 80, 0.36) +
      `<path d="M14 14 q40 -6 66 20 q10 10 2 18 q-8 6 -20 -2 q-46 -18 -52 -30 q-2 -4 4 -6Z" fill="${P.whale}"/>` +
      `<path d="M18 16 q30 -2 48 16 q-30 -8 -48 -10Z" fill="${P.whale2}" opacity="0.4"/>` +
      `<path d="M76 46 q10 2 14 12 q-10 2 -16 -6Z" fill="${P.whale}"/>` +
      `<path d="M20 16 q6 8 6 16" stroke="${P.void}" stroke-width="1" fill="none" opacity="0.4"/>` +
      `<path d="M32 20 q6 9 5 18" stroke="${P.void}" stroke-width="1" fill="none" opacity="0.35"/>` +
      `<path d="M44 26 q5 9 4 18" stroke="${P.void}" stroke-width="1" fill="none" opacity="0.3"/>` +
      `<circle cx="30" cy="22" r="1.6" fill="${P.void}" opacity="0.6"/><circle cx="29.4" cy="21.4" r="0.5" fill="${P.foam}" opacity="0.5"/>` +
      Array.from({ length: 6 }, (_, i) => {
        const x = 40 + i * 8
        const y = 58 + rnd(21, i) * 6
        return `<path d="M${x} ${y}q${(rnd(21, i + 5) - 0.5) * 6} 6 0 12" stroke="${P.squid2}" stroke-width="1.6" fill="none"/>`
      }).join('') +
      `<ellipse cx="62" cy="62" rx="6" ry="7" fill="${P.squid}"/>` +
      `<circle cx="60" cy="59" r="1.2" fill="${P.void}"/>` +
      snow(21, 10),
  },

  'A hydrothermal vent': {
    subject: 'a mineral chimney, its own heat lighting the smoke coming off it',
    draw: () =>
      floor(P.abyss, P.vent, 66) +
      silt(2, 8, P.rust, 66, 79) +
      `<path d="M52 66 L56 20 L64 20 L70 66Z" fill="${P.vent}"/>` +
      `<path d="M53 66 L57 26 L60 26 L58 66Z" fill="${P.rust}" opacity="0.5"/>` +
      `<path d="M63 66 L65 30 L64 20 L67 20 L69 66Z" fill="${P.vent2}" opacity="0.3"/>` +
      `<path d="M58 22 q4 -10 4 -22 q6 14 2 24 q10 8 10 22 q-8 -4 -12 -14 q-4 10 -10 12 q0 -12 6 -22Z" fill="${P.smoke}" opacity="0.85"/>` +
      `<path d="M58 22 q3 -8 4 -16 q3 9 2 17 q-3 1 -6 -1Z" fill="${P.vent2}" opacity="0.22"/>` +
      `<path d="M56 30 q4 -4 8 0" stroke="${P.ember}" stroke-width="1.6" fill="none" opacity="0.8"/>` +
      `<circle cx="60" cy="24" r="1.6" fill="${P.ember}"/><circle cx="60" cy="24" r="3.2" fill="${P.ember}" opacity="0.18"/>` +
      `<path d="M56 40 q4 6 0 14" stroke="${P.abyss}" stroke-width="0.8" fill="none" opacity="0.5"/>` +
      `<path d="M66 36 q-4 8 0 18" stroke="${P.abyss}" stroke-width="0.8" fill="none" opacity="0.5"/>` +
      Array.from({ length: 5 }, (_, i) => {
        const x = 40 + i * 10
        return `<path d="M${x} 66 q-2 -12 1 -18" stroke="${P.bone}" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M${x} 48 q1 -4 2 0" stroke="${P.tube}" stroke-width="3" fill="none" stroke-linecap="round"/>`
      }).join('') +
      Array.from({ length: 4 }, (_, i) => {
        const x = 82 + i * 8
        return `<path d="M${x} 66 q-1 -9 1 -14" stroke="${P.bone}" stroke-width="1.8" fill="none" stroke-linecap="round"/><path d="M${x} 53 q1 -3 1.4 0" stroke="${P.tube}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`
      }).join('') +
      Array.from({ length: 3 }, (_, i) => `<circle cx="${28 + i * 9}" cy="${70 - i * 2}" r="1.4" fill="${P.bone}" opacity="0.5"/>`).join(''),
  },

  'Colossal squid': {
    subject: 'a heavier, hook-armed relative of the giant squid',
    draw: () =>
      bg(P.void) +
      current(5, 4, P.pale, 80, 0.31) +
      `<ellipse cx="60" cy="30" rx="18" ry="20" fill="${P.squid2}"/>` +
      `<path d="M46 16 q-2 16 8 30 q-14 -8 -14 -22 q0 -6 6 -8Z" fill="${P.squid3}" opacity="0.3"/>` +
      `<path d="M48 14 q-6 -6 -2 -10 q6 2 2 10Z" fill="${P.squid2}"/>` +
      `<path d="M72 14 q6 -6 2 -10 q-6 2 -2 10Z" fill="${P.squid2}"/>` +
      `<circle cx="54" cy="26" r="6.4" fill="${P.abyss}"/><circle cx="52" cy="24" r="1.8" fill="${P.foam}" opacity="0.55"/>` +
      Array.from({ length: 8 }, (_, i) => {
        const x = 26 + i * 9 + (rnd(5, i + 50) - 0.5) * 4
        const len = 24 + rnd(5, i) * 20
        const drift = (i - 3.5) * 5 + (rnd(5, i + 9) - 0.5) * 16
        const midx = x + drift * 0.5
        const midy = 46 + len * 0.55
        const endx = x + drift + (rnd(5, i + 20) - 0.5) * 8
        const endy = 46 + len
        const hooks = Array.from({ length: 2 }, (_, k) => {
          const t = (k + 1) / 3
          const hx = x + 2 * (1 - t) * t * (midx - x) + t * t * (endx - x)
          const hy = 46 + 2 * (1 - t) * t * (midy - 46) + t * t * len
          return `<path d="M${hx.toFixed(1)} ${hy.toFixed(1)} l1.6 -1.6" stroke="${P.bone}" stroke-width="0.9" fill="none"/>`
        }).join('')
        return (
          `<path d="M${x.toFixed(1)} 46 Q${midx.toFixed(1)} ${midy.toFixed(1)} ${endx.toFixed(1)} ${endy.toFixed(1)}" ` +
          `stroke="${P.squid}" stroke-width="3" fill="none" stroke-linecap="round"/>${hooks}` +
          `<circle cx="${endx.toFixed(1)}" cy="${endy.toFixed(1)}" r="1.1" fill="${P.bone}"/>`
        )
      }).join('') +
      snow(5, 6),
  },

  'The deepest dive any mammal has ever made': {
    subject: 'a beaked whale, alone, on a single breath, past a scale nothing else here reaches',
    draw: () =>
      bg(P.abyss) +
      current(13, 5, P.pale, 80, 0.36) +
      `<path d="M20 30 q34 -10 56 8 q8 8 0 14 q-30 8 -50 -6 q-10 -8 -6 -16Z" fill="${P.whale}"/>` +
      `<path d="M22 32 q26 -6 44 6 q-24 -2 -44 0Z" fill="${P.whale2}" opacity="0.4"/>` +
      `<path d="M18 32 q-6 0 -8 -6 q6 -2 10 2Z" fill="${P.whale}"/>` +
      `<path d="M66 46 q6 0 10 8 q-8 2 -12 -4Z" fill="${P.whale}"/>` +
      `<path d="M28 30 q10 -4 20 -2" stroke="${P.void}" stroke-width="1" fill="none" opacity="0.4"/>` +
      `<path d="M32 40 q10 -2 22 0" stroke="${P.void}" stroke-width="1" fill="none" opacity="0.3"/>` +
      `<circle cx="26" cy="30" r="1.2" fill="${P.void}"/><circle cx="25.5" cy="29.5" r="0.4" fill="${P.foam}" opacity="0.5"/>` +
      `<line x1="14" y1="58" x2="14" y2="76" stroke="${P.pale}" stroke-width="1" opacity="0.5"/>` +
      Array.from({ length: 5 }, (_, i) => `<line x1="11" y1="${58 + i * 4.5}" x2="17" y2="${58 + i * 4.5}" stroke="${P.pale}" stroke-width="0.8" opacity="0.45"/>`).join('') +
      `<line x1="14" y1="58" x2="72" y2="20" stroke="${P.pale}" stroke-width="0.6" stroke-dasharray="2 2" opacity="0.35"/>` +
      snow(13, 9),
  },

  'The average depth of the entire ocean': {
    subject: 'a plain measuring line, holding the whole ocean to one number',
    draw: () =>
      bg(P.abyss) +
      current(35, 4, P.pale, 80, 0.18) +
      `<line x1="18" y1="8" x2="18" y2="72" stroke="${P.pale}" stroke-width="1.4"/>` +
      Array.from({ length: 6 }, (_, i) => {
        const y = 8 + i * 12.8
        return `<line x1="14" y1="${y}" x2="22" y2="${y}" stroke="${P.pale}" stroke-width="1.4"/>`
      }).join('') +
      `<rect x="34" y="8" width="72" height="64" fill="${P.dusk}" opacity="0.5"/>` +
      `<rect x="34" y="40" width="72" height="32" fill="${P.trench2}" opacity="0.4"/>` +
      `<line x1="34" y1="40" x2="106" y2="40" stroke="${P.foam}" stroke-width="1.2" stroke-dasharray="3 3" opacity="0.8"/>` +
      `<path d="M96 8 h6 q4 0 4 6 v52 q0 6 -4 6 h-6" fill="none" stroke="${P.pale}" stroke-width="1.2" opacity="0.7"/>` +
      snow(35, 8, P.pale, 72),
  },

  'The Titanic': {
    subject: 'a broken hull, settled and rusting on the sediment',
    draw: () =>
      floor(P.abyss, P.sand, 64) +
      silt(17, 12, P.rust, 64, 79) +
      `<path d="M10 58 q4 -22 30 -26 L94 30 q10 0 10 10 l0 12 q0 6 -8 6 L18 60Z" fill="${P.iron}"/>` +
      `<path d="M14 54 q4 -18 26 -22 L90 32 q-2 6 -4 10 L20 56Z" fill="${P.hull2}" opacity="0.3"/>` +
      `<rect x="30" y="36" width="6" height="10" fill="${P.abyss}"/><rect x="30" y="36" width="6" height="2" fill="${P.trench2}"/>` +
      `<rect x="42" y="34" width="6" height="10" fill="${P.abyss}"/><rect x="42" y="34" width="6" height="2" fill="${P.trench2}"/>` +
      `<rect x="54" y="33" width="6" height="10" fill="${P.abyss}"/><rect x="54" y="33" width="6" height="2" fill="${P.trench2}"/>` +
      `<rect x="66" y="33" width="6" height="10" fill="${P.abyss}"/><rect x="66" y="33" width="6" height="2" fill="${P.trench2}"/>` +
      `<path d="M20 40 q6 10 2 20" stroke="${P.rust}" stroke-width="3" fill="none" opacity="0.8"/>` +
      `<path d="M50 32 q4 14 -2 26" stroke="${P.rust}" stroke-width="2.4" fill="none" opacity="0.7"/>` +
      `<path d="M76 34 q3 10 -1 18" stroke="${P.rust}" stroke-width="2" fill="none" opacity="0.6"/>` +
      `<rect x="44" y="14" width="4" height="20" fill="${P.iron}"/><rect x="44" y="14" width="1.4" height="20" fill="${P.hull2}" opacity="0.5"/>` +
      `<path d="M18 60 q40 6 76 -4 l0 3 q-38 9 -76 3Z" fill="${P.nodule}" opacity="0.5"/>` +
      snow(17, 8),
  },

  'Almost nothing lives here, and almost everything that does is beige': {
    subject: 'a single small creature, alone in an enormous, nearly empty frame',
    draw: () =>
      floor(P.void, P.sand, 62) +
      current(19, 5, P.pale, 60, 0.36) +
      silt(19, 14, P.nodule, 62, 79) +
      `<path d="M0 62 q30 -4 60 0 t60 0" stroke="${P.nodule}" stroke-width="1" fill="none" opacity="0.4"/>` +
      `<path d="M0 70 q30 -3 60 0 t60 0" stroke="${P.nodule}" stroke-width="1" fill="none" opacity="0.3"/>` +
      `<ellipse cx="70" cy="66" rx="5" ry="2.6" fill="${P.flesh}"/>` +
      `<ellipse cx="68.5" cy="65" rx="2" ry="1" fill="${P.bone}" opacity="0.5"/>` +
      Array.from({ length: 6 }, (_, i) => `<line x1="${67 + i}" y1="68" x2="${66.5 + i}" y2="70" stroke="${P.flesh}" stroke-width="0.6" opacity="0.7"/>`).join('') +
      `<path d="M60 68 q6 1 12 0" stroke="${P.sand}" stroke-width="0.8" fill="none" opacity="0.5"/>` +
      snow(19, 20, P.pale, 62),
  },

  'Sea cucumbers, grazing': {
    subject: 'a scatter of nodules, and the trails the slow animals working them leave behind',
    draw: () =>
      floor(P.void, P.nodule, 60) +
      current(24, 6, P.pale, 58, 0.4) +
      Array.from({ length: 13 }, (_, i) => {
        const x = 6 + rnd(23, i) * 108
        const y = 64 + rnd(23, i + 9) * 14
        const r = 2 + rnd(23, i + 18) * 2
        return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${P.sand}"/><circle cx="${(x - r * 0.3).toFixed(1)}" cy="${(y - r * 0.3).toFixed(1)}" r="${(r * 0.4).toFixed(1)}" fill="${P.bone}" opacity="0.3"/>`
      }).join('') +
      `<path d="M8 64 q10 1 18 0" stroke="${P.sand}" stroke-width="1" fill="none" opacity="0.55"/>` +
      `<ellipse cx="34" cy="64" rx="8" ry="3" fill="${P.flesh}"/>` +
      `<ellipse cx="32" cy="62.6" rx="5" ry="1.4" fill="${P.bone}" opacity="0.35"/>` +
      `<path d="M56 69 q14 1 24 0" stroke="${P.sand}" stroke-width="1" fill="none" opacity="0.55"/>` +
      `<ellipse cx="80" cy="68" rx="7" ry="2.6" fill="${P.bone}"/>` +
      `<ellipse cx="14" cy="72" rx="5" ry="2" fill="${P.flesh}"/>` +
      snow(24, 8, P.pale, 60),
  },

  'Past this line, life only exists in trenches': {
    subject: 'a crack in an otherwise flat and empty plain, with something small living at the bottom of it',
    draw: () =>
      bg(P.void) +
      `<rect y="0" width="${W}" height="30" fill="${P.abyss}"/>` +
      `<path d="M0 30 L40 30 L54 74 L66 74 L80 30 L${W} 30 L${W} ${H} L0 ${H}Z" fill="${P.abyss}"/>` +
      `<path d="M40 30 L54 74 L58 74 L46 30Z" fill="${P.trench2}" opacity="0.6"/>` +
      current(27, 6, P.pale, 30, 0.42) +
      current(28, 5, P.pale, H, 0.26) +
      `<path d="M40 30 L54 74" stroke="${P.pale}" stroke-width="0.7" opacity="0.3"/>` +
      `<path d="M80 30 L66 74" stroke="${P.pale}" stroke-width="0.7" opacity="0.3"/>` +
      `<path d="M46 46 L50 62 L54 48" stroke="${P.pale}" stroke-width="0.6" opacity="0.2" fill="none"/>` +
      `<path d="M72 40 L68 56 L74 50" stroke="${P.pale}" stroke-width="0.6" opacity="0.2" fill="none"/>` +
      `<ellipse cx="60" cy="70" rx="5" ry="2.4" fill="${P.bone}" opacity="0.7"/>` +
      `<ellipse cx="58.5" cy="69" rx="2" ry="0.8" fill="${P.foam}" opacity="0.3"/>` +
      halo(60, 70, P.glow, 4, 0.1) +
      sparks(27, 4, P.glow, 74),
  },

  'The deepest-living octopus ever filmed': {
    subject: 'ear-like fins, and a pale, nearly translucent mantle',
    draw: () =>
      floor(P.void, P.sand, 66) +
      silt(29, 8, P.nodule, 66, 78) +
      `<ellipse cx="60" cy="42" rx="14" ry="12" fill="${P.bone}" opacity="0.9"/>` +
      `<ellipse cx="55" cy="37" rx="7" ry="5" fill="${P.foam}" opacity="0.25"/>` +
      `<ellipse cx="48" cy="36" rx="6" ry="4" fill="${P.bone}" opacity="0.9"/>` +
      `<ellipse cx="72" cy="36" rx="6" ry="4" fill="${P.bone}" opacity="0.9"/>` +
      Array.from({ length: 6 }, (_, i) => {
        const x = 48 + i * 5
        return `<path d="M${x} 52 q${(rnd(29, i) - 0.5) * 6} 10 0 16" stroke="${P.bone}" stroke-width="2.4" fill="none" stroke-linecap="round" opacity="0.85"/>`
      }).join('') +
      `<circle cx="55" cy="40" r="1.6" fill="${P.void}"/><circle cx="54.6" cy="39.6" r="0.5" fill="${P.foam}" opacity="0.6"/>` +
      `<circle cx="65" cy="40" r="1.6" fill="${P.void}"/><circle cx="64.6" cy="39.6" r="0.5" fill="${P.foam}" opacity="0.6"/>` +
      snow(29, 6),
  },

  'The deepest fish ever recorded': {
    subject: 'a translucent, tadpole-shaped fish, its own skeleton visible through its skin',
    draw: () =>
      floor(P.void, P.abyss, 64) +
      silt(31, 8, P.nodule, 64, 78) +
      current(31, 5, P.pale, 62, 0.36) +
      `<path d="M36 58 q4 -20 26 -20 q20 0 22 15 q1 9 -9 11 q-7 7 -18 5 q-18 -2 -21 -11Z" fill="${P.bone}" opacity="0.7"/>` +
      `<path d="M40 52 q6 -12 20 -14 q-4 8 -2 16 q-10 2 -18 -2Z" fill="${P.foam}" opacity="0.15"/>` +
      `<path d="M46 50 L70 52" stroke="${P.pale}" stroke-width="1" opacity="0.55"/>` +
      Array.from({ length: 6 }, (_, i) => `<line x1="${48 + i * 4}" y1="49" x2="${47 + i * 4}" y2="58" stroke="${P.pale}" stroke-width="0.6" opacity="0.4"/>`).join('') +
      `<path d="M48 44 q10 -2 18 4" stroke="${P.pale}" stroke-width="1" fill="none" opacity="0.5"/>` +
      `<circle cx="48" cy="44" r="2" fill="${P.void}" opacity="0.7"/>` +
      `<ellipse cx="88" cy="64" rx="8" ry="4" fill="${P.bone}" opacity="0.3"/>` +
      snow(31, 12, P.pale, 64),
  },

  'Fewer people have been here than on the Moon': {
    subject: 'a single lit porthole, descending through total black',
    draw: () =>
      bg(P.void) +
      current(33, 6, P.pale, 80, 0.36) +
      `<path d="M56 10 L64 10 L68 60 L64 68 L56 68 L52 60Z" fill="${P.iron}"/>` +
      `<path d="M56 10 L59 10 L61 60 L58 68 L56 68 L52 60Z" fill="${P.hull2}" opacity="0.3"/>` +
      halo(60, 30, P.lure, 9, 0.1) +
      `<circle cx="60" cy="30" r="4" fill="${P.lure}" opacity="0.9"/>` +
      `<circle cx="60" cy="30" r="6" fill="${P.lure}" opacity="0.2"/>` +
      `<rect x="54" y="46" width="12" height="4" fill="${P.abyss}"/>` +
      Array.from({ length: 6 }, (_, i) => `<circle cx="${58 + (i % 2) * 4}" cy="${14 + i * 8}" r="0.7" fill="${P.void}" opacity="0.6"/>`).join('') +
      `<path d="M52 60 L48 66 L56 68Z" fill="${P.iron}"/>` +
      `<path d="M68 60 L72 66 L64 68Z" fill="${P.iron}"/>` +
      snow(33, 16, P.pale, 80),
  },

  'Challenger Deep — the bottom': {
    subject: 'a submersible and a marker, resting on the true floor of the ocean',
    draw: () =>
      bg(P.void) +
      current(37, 5, P.pale, 66, 0.36) +
      `<path d="M0 66 L44 66 L60 78 L76 66 L${W} 66 L${W} ${H} L0 ${H}Z" fill="${P.abyss}"/>` +
      `<path d="M44 66 L60 78 L76 66 L72 66 L60 74 L48 66Z" fill="${P.trench2}" opacity="0.6"/>` +
      `<path d="M20 66 L26 74" stroke="${P.void}" stroke-width="0.6" opacity="0.3"/>` +
      `<path d="M96 66 L90 74" stroke="${P.void}" stroke-width="0.6" opacity="0.3"/>` +
      `<ellipse cx="60" cy="52" rx="10" ry="8" fill="${P.iron}"/>` +
      `<path d="M52 48 q4 -6 12 -6 q-6 3 -8 9Z" fill="${P.hull2}" opacity="0.4"/>` +
      halo(60, 50, P.lure, 6, 0.12) +
      `<circle cx="60" cy="50" r="2.4" fill="${P.lure}" opacity="0.85"/>` +
      `<circle cx="60" cy="50" r="4" fill="${P.lure}" opacity="0.18"/>` +
      `<rect x="57" y="60" width="6" height="8" fill="${P.iron}"/>` +
      `<ellipse cx="60" cy="72" rx="14" ry="3" fill="${P.abyss}"/>` +
      `<line x1="84" y1="40" x2="84" y2="70" stroke="${P.foam}" stroke-width="1"/>` +
      `<path d="M84 40 L94 44 L84 48Z" fill="${P.foam}"/>` +
      sparks(37, 4, P.glow, 74) +
      snow(37, 10, P.pale, 66),
  },
}

/* ---- mood, and the standalone svg wrapper ------------------------------- */

/** Backgrounds — never the colour a card is lit by. */
const BACKDROP: Set<string> = new Set([
  P.reef, P.shallow, P.twilight, P.dusk, P.ink, P.abyss, P.void, P.smoke, P.pale,
  P.trench2,
  // Ground and sediment — the floor every benthic scene rests on, not the
  // creature standing on it. Without this, a big flat seabed routinely
  // outweighs a small, vivid animal and every one of them ends up lit the
  // same shade of sand.
  P.sand, P.nodule, P.vent,
])

export function dominantMood(svg: string): string {
  const weight = new Map<string, number>()
  const add = (hex: string | undefined, area: number) => {
    if (!hex || !hex.startsWith('#') || BACKDROP.has(hex)) return
    weight.set(hex, (weight.get(hex) ?? 0) + area)
  }
  const num = (attrs: string, name: string) => {
    const m = attrs.match(new RegExp(`${name}="(-?[\\d.]+)"`))
    return m ? Number(m[1]) : undefined
  }
  const attr = (attrs: string, name: string) => attrs.match(new RegExp(`${name}="([^"]*)"`))?.[1]

  for (const m of svg.matchAll(/<(rect|circle|ellipse|path|polygon|line)\s+([^>]*)\/?>/g)) {
    const [, tag, attrs] = m
    const fill = attr(attrs, 'fill')
    const stroke = attr(attrs, 'stroke')
    let area = 40
    if (tag === 'rect') {
      const w = num(attrs, 'width'), h = num(attrs, 'height')
      if (w && h) area = w * h
    } else if (tag === 'circle') {
      const r = num(attrs, 'r')
      if (r) area = Math.PI * r * r
    } else if (tag === 'ellipse') {
      const rx = num(attrs, 'rx'), ry = num(attrs, 'ry')
      if (rx && ry) area = Math.PI * rx * ry
    } else if (tag === 'path' || tag === 'polygon') {
      area = fill && fill !== 'none' ? 260 : 60
    } else {
      area = 60
    }
    if (fill && fill !== 'none') add(fill, area)
    else if (stroke && stroke !== 'none') add(stroke, area * 0.3)
  }

  let best: string | null = null
  let bestArea = 0
  for (const [hex, area] of weight) if (area > bestArea) { best = hex; bestArea = area }
  return best ?? P.bone
}

export const MOOD: Record<string, string> = Object.fromEntries(
  Object.entries(DEEP_SEA_ART).map(([title, s]) => [title, dominantMood(s.draw())]),
)

/** Full standalone SVG, sized to fill whatever box the card gives it. */
export function sceneSvg(title: string): string {
  const s = DEEP_SEA_ART[title]
  if (!s) return ''
  return (
    `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" ` +
    `style="width:100%;height:100%;display:block" aria-hidden="true" focusable="false">` +
    `${s.draw()}</svg>`
  )
}
