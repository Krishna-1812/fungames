/**
 * Deep Time's forty-four events, drawn.
 *
 * The page was an honest scale and a list of sentences. The scale is the good
 * part and none of this touches it; the sentences were the whole of the rest,
 * which is why the plan called this one a Wikipedia list on a gradient.
 *
 * Three decisions hold the set together, and all three are constraints rather
 * than style:
 *
 * **No gradients, no ids, no defs.** Forty-four of these inline into one
 * document alongside Scale's twenty-six and the tile art's eighteen. Prefixing
 * ids works and `tile-art.ts` and `scale-art.ts` both do it, but not having any
 * is a guarantee rather than a convention, and `check-time-art.mjs` enforces
 * it. Flat colour is also simply the better choice at 84 by 56 pixels.
 *
 * **One palette.** Every fill comes from `P` below and the checker rejects any
 * that does not. This is the lesson from `icons.ts`: forty-four drawings each
 * reaching for its own perfect colour is what emoji looked like.
 *
 * **Every scene owns its background.** These sit on a translucent dark card
 * over a sky that runs from near-black to daylight across the page, so a scene
 * that lets the card show through is a different picture at the top of the
 * page and the bottom. Each one paints its own ground.
 */

/** The whole palette. Mid-tone by design: these sit on a dark card, and the
 *  ground colours have to carry a silhouette on top of them. */
export const P = {
  night: '#232a44',
  dusk: '#4a4468',
  sky: '#7ea6c8',
  pale: '#cfe0ea',
  sea: '#2f6f8f',
  deep: '#1d4257',
  ice: '#dfeef5',
  ember: '#d2603a',
  flame: '#f0a63c',
  ash: '#6b6660',
  rock: '#7c6f5f',
  stone: '#a89b87',
  soil: '#6b4a33',
  leaf: '#4f8b52',
  moss: '#7fae5b',
  bone: '#e6dcc4',
  skin: '#c99a6e',
  iron: '#8a94a0',
  gold: '#c9a53f',
  blood: '#a63f3f',
  void: '#141425',
} as const

export type Scene = {
  /** What it shows, so a failure can name it. */
  subject: string
  /** Inner SVG on a viewBox of `0 0 120 80`. No defs, no ids, no gradients. */
  draw: () => string
}

const W = 120
const H = 80

/** A flat ground under a flat sky — the shared armature of most of these. */
const land = (sky: string, ground: string, horizon = 52) =>
  `<rect width="${W}" height="${horizon}" fill="${sky}"/>` +
  `<rect y="${horizon}" width="${W}" height="${H - horizon}" fill="${ground}"/>`

/**
 * Distant terrain on the horizon.
 *
 * Added because the distinctness test found two scenes eighty million years
 * apart that were the same picture, and the reason was that both called
 * `land` with the identical three arguments. A skyline is the cheapest thing
 * that makes one landscape a different place from another.
 */
const ridge = (y: number, colour: string, seed: number, height = 14) =>
  `<path d="M0 ${y} ` +
  Array.from({ length: 7 }, (_, i) => {
    const x = (i + 1) * (W / 7)
    const peak = y - height * (0.35 + rnd(seed, i) * 0.65)
    return `Q${(x - W / 14).toFixed(1)} ${peak.toFixed(1)} ${x.toFixed(1)} ${(
      y -
      height * 0.15 * rnd(seed, i + 20)
    ).toFixed(1)}`
  }).join(' ') +
  ` V${y + 4} H0Z" fill="${colour}"/>`

/** Deterministic scatter, same generator as the other two art modules. */
export const rnd = (seed: number, k: number) => {
  const x = Math.sin(seed * 9301 + k * 49297) * 233280
  return x - Math.floor(x)
}

const stars = (seed: number, n = 14, maxY = 46) =>
  Array.from({ length: n }, (_, i) => {
    const x = rnd(seed, i) * W
    const y = rnd(seed, i + 40) * maxY
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(
      0.5 +
      rnd(seed, i + 80) * 0.7
    ).toFixed(1)}" fill="${P.pale}" opacity="0.7"/>`
  }).join('')

/* ---- the Hadean and the Archean ---------------------------------------- */

export const TIME_ART: Record<string, Scene> = {
  'Earth forms': {
    subject: 'a molten proto-Earth still sweeping up its own disc',
    draw: () =>
      `<rect width="${W}" height="${H}" fill="${P.void}"/>${stars(3)}` +
      `<ellipse cx="60" cy="42" rx="56" ry="7" fill="${P.rock}" opacity="0.5"/>` +
      `<circle cx="60" cy="42" r="22" fill="${P.ember}"/>` +
      `<path d="M42 36 q12 -8 22 2 q10 9 -2 16 q-14 7 -20 -4Z" fill="${P.flame}"/>` +
      `<circle cx="52" cy="34" r="4" fill="${P.ash}"/>` +
      `<circle cx="70" cy="50" r="3" fill="${P.ash}"/>` +
      `<circle cx="14" cy="40" r="2.4" fill="${P.rock}"/>` +
      `<circle cx="104" cy="45" r="3.2" fill="${P.rock}"/>` +
      `<circle cx="92" cy="38" r="1.8" fill="${P.stone}"/>`,
  },

  'Something the size of Mars hits us': {
    subject: 'Theia striking Earth, at the moment of contact',
    draw: () =>
      `<rect width="${W}" height="${H}" fill="${P.void}"/>${stars(5, 10)}` +
      // Overlapping, not side by side: two balls with a gap between them is a
      // diagram of two planets, not a collision.
      `<circle cx="44" cy="46" r="28" fill="${P.ember}"/>` +
      `<path d="M44 18 a28 28 0 0 1 22 45 l-22 -17Z" fill="${P.flame}"/>` +
      `<circle cx="80" cy="30" r="18" fill="${P.rock}"/>` +
      `<path d="M66 18 a18 18 0 0 0 -4 22 l18 -10Z" fill="${P.ash}"/>` +
      // The contact flash and the ejecta arc that becomes the Moon.
      `<path d="M58 26 q10 12 6 24 q-14 -4 -18 -16Z" fill="${P.bone}"/>` +
      `<path d="M70 14 q26 6 38 34" fill="none" stroke="${P.flame}" stroke-width="2.4" opacity="0.8"/>` +
      `<circle cx="104" cy="44" r="4.4" fill="${P.stone}"/>` +
      `<circle cx="96" cy="60" r="2.6" fill="${P.stone}"/>` +
      `<circle cx="112" cy="62" r="2" fill="${P.stone}"/>` +
      `<circle cx="86" cy="8" r="2.4" fill="${P.flame}"/>`,
  },

  'The first oceans': {
    subject: 'the first liquid water, still boiling off',
    draw: () =>
      land(P.dusk, P.sea, 40) +
      `<circle cx="24" cy="20" r="9" fill="${P.pale}" opacity="0.5"/>` +
      `<circle cx="36" cy="17" r="12" fill="${P.pale}" opacity="0.4"/>` +
      `<circle cx="86" cy="19" r="11" fill="${P.pale}" opacity="0.45"/>` +
      `<path d="M0 46 q14 -4 28 0 t28 0 t28 0 t28 0" fill="none" stroke="${P.pale}" stroke-width="1.6" opacity="0.6"/>` +
      `<path d="M0 56 q14 -4 28 0 t28 0 t28 0 t28 0" fill="none" stroke="${P.pale}" stroke-width="1.4" opacity="0.4"/>` +
      `<path d="M0 66 q14 -4 28 0 t28 0 t28 0 t28 0" fill="none" stroke="${P.pale}" stroke-width="1.2" opacity="0.3"/>` +
      `<path d="M76 40 L92 26 L108 40Z" fill="${P.rock}"/>`,
  },

  'Heavy bombardment': {
    subject: 'a cratered crust, still being pelted',
    draw: () =>
      `<rect width="${W}" height="${H}" fill="${P.void}"/>${stars(7, 8, 26)}` +
      `<rect y="34" width="${W}" height="46" fill="${P.rock}"/>` +
      Array.from({ length: 7 }, (_, i) => {
        const x = 8 + i * 17 + rnd(11, i) * 6
        const y = 42 + rnd(11, i + 20) * 26
        const r = 4 + rnd(11, i + 40) * 5
        return (
          `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${r.toFixed(1)}" ry="${(
            r * 0.55
          ).toFixed(1)}" fill="${P.ash}"/>` +
          `<ellipse cx="${x.toFixed(1)}" cy="${(y - r * 0.2).toFixed(1)}" rx="${(r * 0.6).toFixed(
            1,
          )}" ry="${(r * 0.3).toFixed(1)}" fill="${P.stone}"/>`
        )
      }).join('') +
      `<path d="M18 4 L30 24" stroke="${P.flame}" stroke-width="2.4" stroke-linecap="round"/>` +
      `<path d="M70 2 L84 26" stroke="${P.flame}" stroke-width="3" stroke-linecap="round"/>` +
      `<path d="M100 8 L108 22" stroke="${P.ember}" stroke-width="2" stroke-linecap="round"/>`,
  },

  'The oldest trace of life': {
    subject: 'graphite in Greenland gneiss — a chemical signature, not a fossil',
    draw: () =>
      `<rect width="${W}" height="${H}" fill="${P.night}"/>` +
      `<rect x="10" y="10" width="100" height="60" rx="3" fill="${P.stone}"/>` +
      `<path d="M10 24 q26 -6 50 0 t50 0" fill="none" stroke="${P.rock}" stroke-width="3"/>` +
      `<path d="M10 40 q26 6 50 0 t50 0" fill="none" stroke="${P.rock}" stroke-width="4"/>` +
      `<path d="M10 56 q26 -5 50 0 t50 0" fill="none" stroke="${P.rock}" stroke-width="3"/>` +
      Array.from({ length: 11 }, (_, i) => {
        const x = 16 + rnd(13, i) * 88
        const y = 16 + rnd(13, i + 30) * 48
        return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(
          1 +
          rnd(13, i + 60) * 1.6
        ).toFixed(1)}" fill="${P.void}"/>`
      }).join(''),
  },

  Cyanobacteria: {
    subject: 'stromatolites, and the first oxygen going into the water',
    draw: () =>
      land(P.deep, P.soil, 62) +
      [22, 48, 74, 98].map((x, i) => {
        const h = 22 + i * 4
        return (
          `<path d="M${x - 10} 62 q0 -${h} 10 -${h} q10 0 10 ${h}Z" fill="${P.rock}"/>` +
          `<path d="M${x - 6} 62 q0 -${h - 6} 6 -${h - 6} q6 0 6 ${h - 6}Z" fill="${P.moss}"/>`
        )
      }).join('') +
      [14, 38, 62, 88, 108].map(
        (x, i) =>
          `<circle cx="${x}" cy="${10 + i * 6}" r="${2 + (i % 3)}" fill="${P.pale}" opacity="0.55"/>`,
      ).join(''),
  },

  'The Great Oxidation': {
    subject: 'banded iron — the ocean rusting as oxygen arrives',
    draw: () =>
      `<rect width="${W}" height="${H}" fill="${P.deep}"/>` +
      Array.from({ length: 8 }, (_, i) =>
        `<rect y="${i * 10}" width="${W}" height="5" fill="${i % 2 ? P.ember : P.iron}"/>`,
      ).join('') +
      [16, 34, 52, 70, 88, 106].map(
        (x, i) =>
          `<circle cx="${x}" cy="${64 - i * 8}" r="${1.8 + (i % 3) * 0.8}" fill="${P.pale}" opacity="0.7"/>`,
      ).join(''),
  },

  'The first complex cell': {
    subject: 'one cell that swallowed another and kept it',
    draw: () =>
      // Deliberately not green on teal: the multicellular scene two events
      // later is a ring of green cells on teal, and the distinctness test
      // caught the two of them being the same picture.
      `<rect width="${W}" height="${H}" fill="${P.night}"/>` +
      `<ellipse cx="56" cy="40" rx="46" ry="31" fill="${P.pale}"/>` +
      `<ellipse cx="56" cy="40" rx="41" ry="27" fill="${P.sky}"/>` +
      `<circle cx="40" cy="34" r="12" fill="${P.sea}"/>` +
      `<circle cx="36" cy="30" r="4" fill="${P.deep}"/>` +
      // The passenger. Its own membrane, its own colour, and its own folded
      // inside — which is the entire event.
      `<ellipse cx="76" cy="48" rx="17" ry="10" fill="${P.ember}" transform="rotate(-16 76 48)"/>` +
      `<ellipse cx="76" cy="48" rx="13" ry="6.4" fill="${P.flame}" transform="rotate(-16 76 48)"/>` +
      `<path d="M66 50 q6 -6 11 -1 q5 5 11 -2" fill="none" stroke="${P.blood}" stroke-width="1.8"/>` +
      `<path d="M64 55 q6 -6 11 -1 q5 5 11 -2" fill="none" stroke="${P.blood}" stroke-width="1.8"/>` +
      // A second one still outside, on its way in.
      `<ellipse cx="105" cy="18" rx="11" ry="6" fill="${P.ember}" transform="rotate(28 105 18)"/>` +
      `<path d="M96 22 q5 -4 8 -1" fill="none" stroke="${P.blood}" stroke-width="1.6"/>` +
      `<path d="M92 62 q10 6 22 4" fill="none" stroke="${P.sky}" stroke-width="1.6" opacity="0.6"/>`,
  },

  'The first multicellular life': {
    subject: 'a colony — cells that stopped leaving',
    draw: () =>
      `<rect width="${W}" height="${H}" fill="${P.deep}"/>` +
      Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2
        return `<circle cx="${(60 + Math.cos(a) * 24).toFixed(1)}" cy="${(
          40 +
          Math.sin(a) * 20
        ).toFixed(1)}" r="8" fill="${P.moss}"/>`
      }).join('') +
      Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2
        return `<circle cx="${(60 + Math.cos(a) * 24).toFixed(1)}" cy="${(
          40 +
          Math.sin(a) * 20
        ).toFixed(1)}" r="4" fill="${P.leaf}"/>`
      }).join('') +
      `<circle cx="60" cy="40" r="10" fill="${P.moss}" opacity="0.5"/>` +
      `<circle cx="16" cy="66" r="5" fill="${P.moss}" opacity="0.5"/>`,
  },

  'Snowball Earth': {
    subject: 'ice to the equator, twice',
    draw: () =>
      `<rect width="${W}" height="${H}" fill="${P.night}"/>${stars(17, 10)}` +
      `<circle cx="60" cy="42" r="28" fill="${P.ice}"/>` +
      `<path d="M36 30 q14 6 28 0 t20 4" fill="none" stroke="${P.sky}" stroke-width="2"/>` +
      `<path d="M34 44 q16 5 30 -1 t22 3" fill="none" stroke="${P.sky}" stroke-width="2"/>` +
      `<path d="M40 56 q14 4 26 -2" fill="none" stroke="${P.sky}" stroke-width="2"/>` +
      `<circle cx="60" cy="42" r="28" fill="none" stroke="${P.pale}" stroke-width="1.4"/>` +
      `<path d="M52 20 L56 26 L48 26Z" fill="${P.pale}"/>`,
  },

  /* ---- the Palaeozoic --------------------------------------------------- */

  'The Cambrian explosion': {
    subject: 'Anomalocaris and a trilobite — every body plan at once',
    draw: () =>
      `<rect width="${W}" height="${H}" fill="${P.deep}"/>` +
      `<rect y="66" width="${W}" height="14" fill="${P.soil}"/>` +
      // Anomalocaris: segmented lobes, two grasping appendages, stalked eyes.
      `<path d="M20 26 q28 -10 56 0 q16 6 0 12 q-28 10 -56 0 q-14 -6 0 -12Z" fill="${P.ember}"/>` +
      Array.from({ length: 6 }, (_, i) =>
        `<path d="M${28 + i * 9} 36 q4 8 -2 12 q-6 -4 -4 -12Z" fill="${P.blood}"/>`,
      ).join('') +
      `<path d="M20 28 q-10 2 -14 8 q8 2 14 -2Z" fill="${P.blood}"/>` +
      `<path d="M18 32 q-8 6 -12 12" fill="none" stroke="${P.blood}" stroke-width="2"/>` +
      `<circle cx="24" cy="22" r="3" fill="${P.void}"/>` +
      `<path d="M76 26 q14 -2 20 6 q-10 6 -20 2Z" fill="${P.blood}"/>` +
      // Trilobite on the floor.
      `<ellipse cx="88" cy="62" rx="16" ry="8" fill="${P.stone}"/>` +
      `<path d="M76 62 q12 -6 24 0" fill="none" stroke="${P.ash}" stroke-width="1.4"/>` +
      `<path d="M80 56 v12 M88 55 v14 M96 56 v12" stroke="${P.ash}" stroke-width="1.2"/>`,
  },

  'Plants move onto land': {
    subject: 'liverworts and the first upright stems, close up on damp rock',
    draw: () =>
      `<rect width="${W}" height="${H}" fill="${P.dusk}"/>` +
      // No sea. The event is that something is no longer in it, and keeping a
      // shoreline here made this the same picture as Tiktaalik's.
      `<path d="M0 18 q26 -8 52 -2 q34 8 68 -4 v68 H0Z" fill="${P.rock}"/>` +
      `<path d="M0 34 q30 -6 58 2 q32 9 62 -4" fill="none" stroke="${P.ash}" stroke-width="2.4"/>` +
      `<path d="M0 54 q34 -6 62 3 q28 8 58 -3" fill="none" stroke="${P.ash}" stroke-width="2"/>` +
      // Cushions of liverwort, which is what actually got there first.
      [
        [18, 44, 15],
        [52, 58, 20],
        [92, 40, 17],
        [76, 70, 13],
      ]
        .map(
          ([x, y, r]) =>
            `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.55}" fill="${P.leaf}"/>` +
            `<ellipse cx="${x - r * 0.3}" cy="${y - r * 0.18}" rx="${r * 0.5}" ry="${
              r * 0.3
            }" fill="${P.moss}"/>`,
        )
        .join('') +
      // A few sporophytes standing up, which is the whole innovation.
      [24, 46, 58, 96]
        .map(
          (x, i) =>
            `<path d="M${x} ${52 + (i % 2) * 12} v-${16 + i * 2}" stroke="${P.moss}" stroke-width="2.2" stroke-linecap="round"/>` +
            `<ellipse cx="${x}" cy="${34 - i * 2 + (i % 2) * 12}" rx="3" ry="4.4" fill="${P.gold}"/>`,
        )
        .join(''),
  },

  'The first mass extinction': {
    subject: 'a seabed of empty shells, tipped over',
    draw: () =>
      `<rect width="${W}" height="${H}" fill="${P.deep}"/>` +
      `<rect y="50" width="${W}" height="30" fill="${P.ash}"/>` +
      `<path d="M0 50 q22 -6 44 0 q26 7 40 -2 q20 -7 36 3 v6 H0Z" fill="${P.rock}"/>` +
      // Brachiopods: two valves and the ribs running out from the hinge. Empty
      // and lying at angles, which is what an extinction bed looks like.
      [
        [22, 60, -18],
        [50, 66, 12],
        [78, 58, 28],
        [102, 68, -8],
      ]
        .map(
          ([x, y, r]) =>
            `<g transform="rotate(${r} ${x} ${y})">` +
            `<path d="M${x - 13} ${y} q3 -14 13 -14 q10 0 13 14 q-13 5 -26 0Z" fill="${P.bone}"/>` +
            `<path d="M${x - 13} ${y} q13 6 26 0 q-3 8 -13 8 q-10 0 -13 -8Z" fill="${P.stone}"/>` +
            [-8, -4, 0, 4, 8]
              .map((o) => `<path d="M${x + o * 0.4} ${y - 13} L${x + o * 1.6} ${y}" stroke="${P.rock}" stroke-width="0.9"/>`)
              .join('') +
            `</g>`,
        )
        .join('') +
      `<path d="M8 44 q14 -4 26 0 M60 40 q12 -4 22 0" stroke="${P.pale}" stroke-width="1" opacity="0.25"/>` +
      `<path d="M34 74 h16 M86 74 h20" stroke="${P.bone}" stroke-width="2" stroke-linecap="round" opacity="0.55"/>`,
  },

  'A fish crawls out of the water': {
    subject: 'Tiktaalik hauling out, still half in the water',
    draw: () =>
      `<rect width="${W}" height="${H}" fill="${P.sky}"/>` +
      // Mostly water, and the bank only in the corner it is heading for.
      `<rect y="26" width="${W}" height="54" fill="${P.sea}"/>` +
      `<path d="M62 30 q26 -6 58 -2 v52 H70 q-14 -18 -8 -50Z" fill="${P.soil}"/>` +
      `<path d="M62 30 q26 -6 58 -2 v8 q-30 -4 -56 2Z" fill="${P.rock}"/>` +
      // Half out: the head and shoulders are on the mud, the tail is not.
      `<path d="M14 58 q22 -12 46 -12 q22 0 36 -8 q-10 16 -34 20 q-24 6 -48 0Z" fill="${P.moss}"/>` +
      `<path d="M96 38 q10 -3 16 -10 q2 10 -8 16Z" fill="${P.moss}"/>` +
      `<path d="M14 58 q-10 4 -12 12 q10 2 16 -6Z" fill="${P.moss}"/>` +
      `<circle cx="88" cy="42" r="2" fill="${P.void}"/>` +
      `<path d="M82 38 q6 -4 12 -2" fill="none" stroke="${P.leaf}" stroke-width="1.4"/>` +
      // The propped fins: the reason this event has a name.
      `<path d="M74 52 q2 10 -4 14" fill="none" stroke="${P.leaf}" stroke-width="3.4" stroke-linecap="round"/>` +
      `<path d="M52 56 q3 10 -3 14" fill="none" stroke="${P.leaf}" stroke-width="3" stroke-linecap="round"/>` +
      // Ripples where the body meets the surface.
      [0, 1, 2]
        .map(
          (i) =>
            `<path d="M${4 + i * 8} ${62 + i * 6} q14 -4 26 0 q12 4 24 0" fill="none" stroke="${P.pale}" stroke-width="1.4" opacity="${
              0.5 - i * 0.12
            }"/>`,
        )
        .join(''),
  },

  'The coal forests': {
    subject: 'Lepidodendron — the trees that became the Industrial Revolution',
    draw: () =>
      land(P.sky, P.soil, 60) +
      [16, 40, 64, 90].map((x, i) => {
        const h = 34 + (i % 2) * 12
        return (
          `<rect x="${x - 3}" y="${60 - h}" width="6" height="${h}" fill="${P.rock}"/>` +
          Array.from({ length: 5 }, (_, k) =>
            `<circle cx="${x + (k % 2 ? 2 : -2)}" cy="${60 - h + 6 + k * 6}" r="1.1" fill="${P.soil}"/>`,
          ).join('') +
          [-1, 1]
            .map(
              (s) =>
                `<path d="M${x} ${60 - h} q${s * 12} -4 ${s * 16} 6" fill="none" stroke="${P.leaf}" stroke-width="2.4" stroke-linecap="round"/>`,
            )
            .join('')
        )
      }).join('') +
      `<ellipse cx="110" cy="66" rx="12" ry="5" fill="${P.moss}"/>` +
      `<ellipse cx="30" cy="72" rx="16" ry="4" fill="${P.moss}" opacity="0.7"/>`,
  },

  'The first reptiles': {
    subject: 'a small amniote — the egg that did not need a pond',
    draw: () =>
      land(P.sky, P.gold, 54) +
      ridge(54, P.ember, 71, 18) +
      `<path d="M24 52 q10 -8 24 -6 q16 2 26 6 q10 4 22 -2 q-6 10 -22 10 q-16 2 -28 -2 q-14 -2 -22 -6Z" fill="${P.leaf}"/>` +
      `<path d="M24 52 q-10 -2 -14 -8 q10 -2 16 2Z" fill="${P.leaf}"/>` +
      `<circle cx="18" cy="46" r="1.6" fill="${P.void}"/>` +
      `<path d="M96 50 q14 -6 20 -14" fill="none" stroke="${P.leaf}" stroke-width="2.6" stroke-linecap="round"/>` +
      `<path d="M34 60 v6 M52 62 v6 M74 61 v6" stroke="${P.leaf}" stroke-width="2.4" stroke-linecap="round"/>` +
      Array.from({ length: 7 }, (_, i) =>
        `<path d="M${34 + i * 8} 46 l3 -4 l3 4Z" fill="${P.moss}"/>`,
      ).join('') +
      `<ellipse cx="98" cy="70" rx="7" ry="5" fill="${P.bone}"/>`,
  },

  'The Great Dying': {
    subject: 'the Siberian Traps, and a sky nobody could breathe',
    draw: () =>
      `<rect width="${W}" height="${H}" fill="${P.ash}"/>` +
      `<rect y="50" width="${W}" height="30" fill="${P.void}"/>` +
      `<path d="M0 50 q20 -14 38 -2 q14 10 30 -4 q18 -14 34 4 q10 10 18 2 v50 H0Z" fill="${P.ember}"/>` +
      `<path d="M0 62 q26 -8 52 0 t68 -2 v20 H0Z" fill="${P.blood}"/>` +
      [22, 58, 92].map(
        (x) =>
          `<path d="M${x} 46 q-4 -14 2 -22 q8 8 4 22Z" fill="${P.flame}"/>` +
          `<circle cx="${x + 1}" cy="18" r="4" fill="${P.ash}"/>` +
          `<circle cx="${x + 7}" cy="12" r="5" fill="${P.ash}"/>`,
      ).join('') +
      `<rect width="${W}" height="14" fill="${P.void}" opacity="0.45"/>`,
  },

  /* ---- the Mesozoic ----------------------------------------------------- */

  'The first dinosaurs': {
    subject: 'a small bipedal predator, before any of them were large',
    draw: () =>
      land(P.sky, P.stone, 58) +
      // Tail, body, neck and head as one silhouette so the shape reads before
      // any of the detail does. The first version was a blob with legs.
      `<path d="M114 22 q-20 6 -30 18 q-6 8 -18 8 q-14 0 -20 -12 q-6 -14 4 -22
               q10 -8 22 -4 q10 3 16 -2 q10 -8 26 -6 q-10 8 -22 12 q14 2 22 8Z" fill="${P.leaf}"/>` +
      `<path d="M60 36 q-14 -8 -30 -6 q-14 2 -18 10 q10 6 22 2 q12 -4 26 -6Z" fill="${P.leaf}"/>` +
      `<path d="M12 40 q-8 1 -10 4 q7 3 12 0Z" fill="${P.moss}"/>` +
      `<circle cx="18" cy="38" r="2" fill="${P.void}"/>` +
      `<path d="M4 43 h10" stroke="${P.void}" stroke-width="1.2"/>` +
      // Two legs, both bent, both clearly under the hips.
      `<path d="M56 52 q6 8 -2 12 l-4 6" fill="none" stroke="${P.leaf}" stroke-width="5" stroke-linecap="round"/>` +
      `<path d="M72 52 q8 8 2 12 l4 6" fill="none" stroke="${P.leaf}" stroke-width="5" stroke-linecap="round"/>` +
      `<path d="M44 71 h12 M74 71 h12" stroke="${P.leaf}" stroke-width="3.4" stroke-linecap="round"/>` +
      `<path d="M40 34 q14 -4 26 0" fill="none" stroke="${P.moss}" stroke-width="1.6"/>` +
      `<ellipse cx="20" cy="70" rx="12" ry="3" fill="${P.rock}" opacity="0.5"/>`,
  },

  'The first mammals': {
    subject: 'something small and nocturnal, waiting 160 million years',
    draw: () =>
      `<rect width="${W}" height="${H}" fill="${P.night}"/>${stars(23, 9, 30)}` +
      `<rect y="58" width="${W}" height="22" fill="${P.soil}"/>` +
      `<path d="M34 58 q4 -16 22 -16 q20 0 24 16Z" fill="${P.skin}"/>` +
      `<path d="M34 58 q-12 -2 -18 -8 q8 -8 20 -4Z" fill="${P.skin}"/>` +
      `<circle cx="22" cy="49" r="1.6" fill="${P.void}"/>` +
      `<circle cx="30" cy="44" r="3.4" fill="${P.skin}"/>` +
      `<path d="M16 50 l-8 -2 M16 53 l-8 2" stroke="${P.bone}" stroke-width="0.9"/>` +
      `<path d="M80 52 q16 -4 22 -14" fill="none" stroke="${P.skin}" stroke-width="2.4" stroke-linecap="round"/>` +
      `<circle cx="96" cy="20" r="8" fill="${P.pale}" opacity="0.85"/>` +
      `<circle cx="92" cy="18" r="7" fill="${P.night}"/>`,
  },

  'Feathers and flight': {
    subject: 'Archaeopteryx in the air — feathered wings, a bony tail, and teeth',
    draw: () =>
      land(P.sky, P.leaf, 68) +
      ridge(68, P.soil, 83, 20) +
      // Flying, wings spread, seen from the side and slightly below. The first
      // attempt drew it perched with the feathers as marks along the wing and
      // it read as a centipede.
      `<path d="M28 40 q22 -6 42 2 q10 4 14 12 q-24 6 -44 -2 q-10 -4 -12 -12Z" fill="${P.soil}"/>` +
      // Upper wing, swept back over the body.
      `<path d="M46 38 q6 -22 26 -30 q6 16 -6 32Z" fill="${P.rock}"/>` +
      [0, 1, 2, 3, 4]
        .map((i) => `<path d="M${50 + i * 4} ${34 - i * 2} L${62 + i * 3} ${12 - i * 1}" stroke="${P.soil}" stroke-width="1.8" stroke-linecap="round"/>`)
        .join('') +
      // Lower wing, foreshortened.
      `<path d="M52 48 q10 14 30 18 q-2 -14 -16 -22Z" fill="${P.soil}"/>` +
      // Long bony tail with a feather down each side — the diagnostic feature.
      `<path d="M84 52 q16 4 30 16" fill="none" stroke="${P.rock}" stroke-width="3" stroke-linecap="round"/>` +
      [0, 1, 2, 3]
        .map((i) => `<path d="M${92 + i * 7} ${55 + i * 4} l6 -6 M${92 + i * 7} ${55 + i * 4} l3 8" stroke="${P.soil}" stroke-width="1.6" stroke-linecap="round"/>`)
        .join('') +
      // Head: a small toothed jaw, not a beak.
      `<path d="M28 40 q-12 -4 -18 0 q4 8 18 6Z" fill="${P.soil}"/>` +
      `<path d="M10 40 q6 -3 12 -1 l-1 3 q-6 -2 -11 -2Z" fill="${P.gold}"/>` +
      `<circle cx="24" cy="38" r="1.6" fill="${P.void}"/>` +
      `<path d="M14 45 v2 M18 46 v2 M22 46 v2" stroke="${P.bone}" stroke-width="0.9"/>`,
  },

  'The first flower': {
    subject: 'a magnolia — pollinated by beetles, because bees did not exist yet',
    draw: () =>
      land(P.sky, P.moss, 62) +
      `<path d="M60 62 v-20" stroke="${P.leaf}" stroke-width="3" stroke-linecap="round"/>` +
      `<path d="M60 54 q-14 -2 -18 -10 q14 -2 18 6Z" fill="${P.leaf}"/>` +
      `<path d="M60 58 q14 -2 20 -10 q-14 -4 -20 4Z" fill="${P.leaf}"/>` +
      Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2
        return `<ellipse cx="${(60 + Math.cos(a) * 11).toFixed(1)}" cy="${(
          32 +
          Math.sin(a) * 11
        ).toFixed(1)}" rx="8" ry="4.4" fill="${P.bone}" transform="rotate(${(
          (a * 180) /
          Math.PI
        ).toFixed(0)} ${(60 + Math.cos(a) * 11).toFixed(1)} ${(32 + Math.sin(a) * 11).toFixed(1)})"/>`
      }).join('') +
      `<circle cx="60" cy="32" r="6" fill="${P.gold}"/>` +
      `<ellipse cx="76" cy="24" rx="4" ry="2.6" fill="${P.blood}" transform="rotate(-20 76 24)"/>`,
  },

  'The asteroid': {
    subject: 'ten kilometres wide, arriving',
    draw: () =>
      `<rect width="${W}" height="${H}" fill="${P.void}"/>` +
      `<rect y="56" width="${W}" height="24" fill="${P.blood}"/>` +
      `<path d="M0 56 q24 -10 46 -2 q26 10 74 -6 v8 H0Z" fill="${P.ember}"/>` +
      `<circle cx="76" cy="56" r="24" fill="${P.flame}"/>` +
      `<circle cx="76" cy="56" r="13" fill="${P.bone}"/>` +
      `<path d="M8 4 L64 44" stroke="${P.flame}" stroke-width="4" stroke-linecap="round"/>` +
      `<path d="M4 12 L54 46" stroke="${P.ember}" stroke-width="2" stroke-linecap="round" opacity="0.8"/>` +
      `<circle cx="66" cy="46" r="5" fill="${P.ash}"/>` +
      Array.from({ length: 5 }, (_, i) =>
        `<path d="M${52 + i * 12} 56 q${i - 2} -${16 + i * 3} ${(i - 2) * 3} -${22 + i * 4}" fill="none" stroke="${P.ash}" stroke-width="2.4" stroke-linecap="round" opacity="0.75"/>`,
      ).join(''),
  },
}

/* ---- the Cenozoic, and then us ------------------------------------------

   From here the events stop being about the planet and start being about one
   animal, and the drawings follow: a branch, a hand, a tool, a machine. That
   change of subject is the actual shape of the last sixty-six million years,
   and it is worth letting the pictures say so. ---------------------------- */

Object.assign(TIME_ART, {
  'The first primates': {
    subject: 'something small in a tree, with hands',
    draw: () =>
      land(P.sky, P.moss, 66) +
      `<path d="M0 30 q30 6 54 2 q26 -4 66 4" fill="none" stroke="${P.soil}" stroke-width="6" stroke-linecap="round"/>` +
      `<path d="M46 34 q6 -14 20 -12 q14 2 14 14 q0 12 -16 12 q-18 0 -18 -14Z" fill="${P.skin}"/>` +
      `<circle cx="72" cy="26" r="5" fill="${P.bone}"/>` +
      `<circle cx="71" cy="25" r="1.6" fill="${P.void}"/>` +
      `<circle cx="79" cy="22" r="2.6" fill="${P.skin}"/>` +
      `<circle cx="62" cy="20" r="2.6" fill="${P.skin}"/>` +
      `<path d="M46 40 q-16 8 -20 26" fill="none" stroke="${P.skin}" stroke-width="3" stroke-linecap="round"/>` +
      `<path d="M56 46 v10 M70 46 v10" stroke="${P.skin}" stroke-width="2.6" stroke-linecap="round"/>` +
      `<circle cx="20" cy="22" r="4" fill="${P.leaf}"/><circle cx="30" cy="18" r="5" fill="${P.leaf}"/>` +
      `<circle cx="100" cy="20" r="5" fill="${P.leaf}"/><circle cx="110" cy="26" r="4" fill="${P.leaf}"/>`,
  },

  'The first apes': {
    subject: 'no tail, longer arms, and a shoulder that can hang',
    draw: () =>
      land(P.pale, P.leaf, 70) +
      ridge(70, P.moss, 79, 12) +
      `<path d="M0 18 q34 8 60 4 q30 -4 60 6" fill="none" stroke="${P.soil}" stroke-width="6" stroke-linecap="round"/>` +
      `<path d="M46 44 q8 -14 20 -14 q14 0 16 14 q2 16 -16 18 q-22 0 -20 -18Z" fill="${P.soil}"/>` +
      `<circle cx="58" cy="30" r="8" fill="${P.skin}"/>` +
      `<path d="M52 28 q6 -6 12 0 q-2 8 -6 8 q-4 0 -6 -8Z" fill="${P.bone}"/>` +
      `<circle cx="55" cy="28" r="1.4" fill="${P.void}"/><circle cx="61" cy="28" r="1.4" fill="${P.void}"/>` +
      // The arms are the point: long enough to hang from, which a monkey's are not.
      `<path d="M48 40 q-14 -8 -12 -22" fill="none" stroke="${P.soil}" stroke-width="4.4" stroke-linecap="round"/>` +
      `<path d="M80 40 q16 -6 16 -20" fill="none" stroke="${P.soil}" stroke-width="4.4" stroke-linecap="round"/>` +
      `<path d="M52 62 v6 M72 62 v6" stroke="${P.soil}" stroke-width="3.4" stroke-linecap="round"/>`,
  },

  'Our line splits from chimpanzees': {
    subject: 'one branch becoming two, with something different on each',
    draw: () =>
      land(P.moss, P.soil, 62) +
      // A canopy, so this is a place rather than two marks on a dark field.
      [12, 34, 58, 82, 106]
        .map((x, i) => `<circle cx="${x}" cy="${8 + (i % 2) * 7}" r="${13 + (i % 3) * 3}" fill="${P.leaf}"/>`)
        .join('') +
      `<path d="M46 62 V34" stroke="${P.soil}" stroke-width="9" stroke-linecap="round"/>` +
      `<path d="M46 36 L18 16" stroke="${P.soil}" stroke-width="7" stroke-linecap="round"/>` +
      `<path d="M46 36 L96 22" stroke="${P.soil}" stroke-width="7" stroke-linecap="round"/>` +
      `<circle cx="46" cy="36" r="6" fill="${P.gold}"/>` +
      // Upright on one branch, knuckle-walking on the other, both big enough
      // to tell apart at fifty pixels.
      `<circle cx="18" cy="6" r="6" fill="${P.skin}"/>` +
      `<path d="M18 12 v14" stroke="${P.skin}" stroke-width="5" stroke-linecap="round"/>` +
      `<path d="M10 18 h16" stroke="${P.skin}" stroke-width="4" stroke-linecap="round"/>` +
      `<path d="M18 26 l-6 12 M18 26 l6 12" stroke="${P.skin}" stroke-width="4.4" stroke-linecap="round"/>` +
      `<ellipse cx="98" cy="38" rx="16" ry="11" fill="${P.soil}"/>` +
      `<circle cx="84" cy="30" r="7" fill="${P.skin}"/>` +
      `<circle cx="82" cy="29" r="1.6" fill="${P.void}"/>` +
      `<path d="M88 46 v8 M108 46 v8" stroke="${P.soil}" stroke-width="4.4" stroke-linecap="round"/>` +
      `<path d="M84 36 q-8 6 -6 18" fill="none" stroke="${P.soil}" stroke-width="4.4" stroke-linecap="round"/>`,
  },

  'Lucy walks upright': {
    subject: 'a small australopith, and the Laetoli footprints',
    draw: () =>
      land(P.sky, P.stone, 58) +
      ridge(58, P.ash, 73, 16) +
      `<circle cx="42" cy="20" r="6" fill="${P.skin}"/>` +
      `<path d="M36 30 q6 -4 12 0 q4 12 0 18 h-12 q-4 -6 0 -18Z" fill="${P.soil}"/>` +
      `<path d="M36 32 q-8 8 -8 16" fill="none" stroke="${P.skin}" stroke-width="2.6" stroke-linecap="round"/>` +
      `<path d="M48 32 q9 6 10 14" fill="none" stroke="${P.skin}" stroke-width="2.6" stroke-linecap="round"/>` +
      `<path d="M39 48 l-3 12 M46 48 l4 12" stroke="${P.skin}" stroke-width="3" stroke-linecap="round"/>` +
      // Two and a half metres of volcanic ash, and somebody walked across it.
      [64, 78, 92, 106]
        .map(
          (x, i) =>
            `<ellipse cx="${x}" cy="${64 + (i % 2) * 7}" rx="4" ry="6" fill="${P.rock}" transform="rotate(${
              i % 2 ? 8 : -8
            } ${x} ${64 + (i % 2) * 7})"/>` +
            `<circle cx="${x}" cy="${58 + (i % 2) * 7}" r="2" fill="${P.rock}"/>`,
        )
        .join(''),
  },

  'The first stone tool': {
    subject: 'a handaxe, drawn the way an excavation report draws one',
    draw: () =>
      `<rect width="${W}" height="${H}" fill="${P.night}"/>` +
      `<rect y="64" width="${W}" height="16" fill="${P.soil}"/>` +
      // A clean almond, pointed at the top and round at the butt — the outline
      // is the whole of what a handaxe is, and every attempt to add texture to
      // it turned it into a gemstone or a fern.
      `<path d="M60 6 q20 20 22 40 q2 22 -22 26 q-24 -4 -22 -26 q2 -20 22 -40Z" fill="${P.stone}"/>` +
      `<path d="M60 6 q20 20 22 40 q2 22 -22 26Z" fill="${P.ash}"/>` +
      // The ridge, and straight scars running from it to each edge. Straight,
      // because a struck flake leaves a chord and not a curve.
      `<path d="M60 6 V72" stroke="${P.rock}" stroke-width="1.8"/>` +
      [0, 1, 2, 3]
        .map(
          (i) =>
            `<path d="M60 ${20 + i * 13} L${38 + i * 1.5} ${30 + i * 12}" stroke="${P.bone}" stroke-width="1.6" opacity="0.75"/>` +
            `<path d="M60 ${26 + i * 13} L${82 - i * 1.5} ${36 + i * 12}" stroke="${P.soil}" stroke-width="1.6" opacity="0.6"/>`,
        )
        .join('') +
      `<path d="M60 6 q20 20 22 40 q2 22 -22 26 q-24 -4 -22 -26 q2 -20 22 -40Z"
             fill="none" stroke="${P.bone}" stroke-width="2"/>` +
      // A struck flake lying beside it, which says this one was made.
      `<path d="M96 62 l14 -6 l4 10 l-14 4Z" fill="${P.stone}"/>` +
      `<ellipse cx="60" cy="75" rx="20" ry="3.4" fill="${P.void}" opacity="0.35"/>`,
  },

  'Fire, kept and carried': {
    subject: 'a fire somebody is looking after',
    draw: () =>
      `<rect width="${W}" height="${H}" fill="${P.void}"/>` +
      `<rect y="62" width="${W}" height="18" fill="${P.soil}"/>` +
      `<circle cx="60" cy="46" r="30" fill="${P.ember}" opacity="0.22"/>` +
      `<path d="M46 62 L74 58 M48 58 L72 62" stroke="${P.rock}" stroke-width="3.4" stroke-linecap="round"/>` +
      `<path d="M60 24 q12 14 8 24 q-3 10 -8 12 q-5 -2 -8 -12 q-4 -10 8 -24Z" fill="${P.flame}"/>` +
      `<path d="M60 36 q6 8 4 15 q-2 6 -4 7 q-2 -1 -4 -7 q-2 -7 4 -15Z" fill="${P.bone}"/>` +
      [30, 90]
        .map(
          (x) =>
            `<circle cx="${x}" cy="50" r="4" fill="${P.skin}"/>` +
            `<path d="M${x} 54 v8" stroke="${P.skin}" stroke-width="3" stroke-linecap="round"/>` +
            `<path d="M${x} 56 q${x < 60 ? 10 : -10} 0 ${x < 60 ? 14 : -14} -6" fill="none" stroke="${P.skin}" stroke-width="2.4" stroke-linecap="round"/>`,
        )
        .join(''),
  },

  'Homo sapiens': {
    subject: 'the skull — the tall forehead and the chin nothing else has',
    draw: () =>
      `<rect width="${W}" height="${H}" fill="${P.night}"/>` +
      `<path d="M40 16 q26 -6 38 12 q8 14 2 26 l-4 4 q1 8 -6 10 l-14 2 q-10 0 -12 -8 l-2 -8 q-12 -6 -10 -22 q2 -12 8 -16Z" fill="${P.bone}"/>` +
      `<ellipse cx="52" cy="40" rx="7" ry="8" fill="${P.night}"/>` +
      `<ellipse cx="72" cy="40" rx="7" ry="8" fill="${P.night}"/>` +
      `<path d="M62 46 l-4 10 h8Z" fill="${P.night}"/>` +
      `<path d="M50 62 q12 4 24 0" fill="none" stroke="${P.night}" stroke-width="1.6"/>` +
      `<path d="M52 64 v5 M58 65 v5 M64 65 v5 M70 64 v5" stroke="${P.night}" stroke-width="1.2"/>` +
      // The forehead, which is the whole difference.
      `<path d="M36 26 q22 -12 42 4" fill="none" stroke="${P.stone}" stroke-width="1.4" opacity="0.7"/>`,
  },

  'Out of Africa': {
    subject: 'the continent, and the way out of it',
    draw: () =>
      `<rect width="${W}" height="${H}" fill="${P.deep}"/>` +
      `<path d="M34 10 L54 6 L64 14 L62 24 L58 34 L54 48 L48 62 L42 70 L36 64 L36 50 L30 38 L28 22Z" fill="${P.moss}"/>` +
      `<path d="M64 14 L78 12 L84 22 L74 28 L64 22Z" fill="${P.moss}"/>` +
      `<path d="M62 18 q18 -8 34 -2" fill="none" stroke="${P.bone}" stroke-width="2" stroke-dasharray="4 3"/>` +
      `<path d="M96 16 l-6 -3 l1 7Z" fill="${P.bone}"/>` +
      [0, 1, 2]
        .map(
          (i) =>
            `<circle cx="${86 + i * 8}" cy="${34 + i * 8}" r="2.6" fill="${P.skin}"/>` +
            `<path d="M${86 + i * 8} ${37 + i * 8} v6" stroke="${P.skin}" stroke-width="2" stroke-linecap="round"/>`,
        )
        .join(''),
  },

  'Cave paintings at Chauvet': {
    subject: 'an ochre aurochs on the rock, and a stencilled hand beside it',
    draw: () =>
      `<rect width="${W}" height="${H}" fill="${P.rock}"/>` +
      `<path d="M0 0 q40 10 62 4 q34 -8 58 6 v12 q-30 -9 -58 -1 q-26 8 -62 -7Z" fill="${P.stone}" opacity="0.45"/>` +
      `<path d="M0 72 q34 -8 62 -2 q30 7 58 -4 v14 H0Z" fill="${P.ash}" opacity="0.4"/>` +
      // A whole animal, side on. Two profile heads in a row failed to read;
      // four legs and a humped back cannot be mistaken for anything else.
      `<path d="M42 40 q4 -12 20 -13 q18 -1 30 3 q10 3 14 10 q3 8 -2 13
               q-8 5 -22 5 q-16 1 -28 -2 q-13 -3 -12 -16Z" fill="${P.ember}"/>` +
      // A charcoal contour, the way an actual Chauvet aurochs is drawn: the
      // ochre fill and the rock behind it are close enough in value that the
      // shape's own edge barely registered as one — real cave art has this
      // exact line for the same reason a camera would have the same problem.
      `<path d="M42 40 q4 -12 20 -13 q18 -1 30 3 q10 3 14 10 q3 8 -2 13
               q-8 5 -22 5 q-16 1 -28 -2 q-13 -3 -12 -16Z" fill="none" stroke="${P.night}" stroke-width="1.1" opacity="0.8"/>` +
      // Head and horns at the right.
      `<path d="M92 30 q12 -2 18 6 q4 8 -2 14 q-8 5 -16 -2 q-5 -8 0 -18Z" fill="${P.ember}"/>` +
      `<path d="M96 28 q-4 -12 4 -16 q2 8 4 14Z" fill="${P.blood}"/>` +
      `<path d="M108 30 q6 -10 14 -10 q-4 8 -10 14Z" fill="${P.blood}"/>` +
      `<circle cx="104" cy="40" r="2.4" fill="${P.rock}"/>` +
      // Four legs, short and thick, as they are drawn on the wall.
      `<path d="M50 54 l-4 16 M64 56 l-2 16 M84 55 l2 16 M96 52 l5 16" stroke="${P.ember}" stroke-width="5" stroke-linecap="round"/>` +
      `<path d="M42 40 q-10 4 -14 12 q8 3 14 -4Z" fill="${P.ember}"/>` +
      // Hand stencil: the pigment is sprayed, so the hand is the bare wall.
      `<path d="M4 22 q-3 18 5 26 q11 6 20 -3 q6 -14 -3 -23 q-12 -6 -22 0Z" fill="${P.blood}" opacity="0.6"/>` +
      `<path d="M11 28 v16 M18 26 v18 M25 29 v14" stroke="${P.rock}" stroke-width="2.8" stroke-linecap="round"/>`,
  },

  'Somebody plants a seed on purpose': {
    subject: 'a hand, a seed, and a furrow',
    draw: () =>
      land(P.sky, P.soil, 42) +
      [0, 1, 2, 3, 4]
        .map(
          (i) =>
            `<path d="M0 ${48 + i * 8} q30 -5 60 0 t60 0" fill="none" stroke="${P.rock}" stroke-width="2.6" opacity="0.7"/>`,
        )
        .join('') +
      `<path d="M74 20 q16 -6 26 4 q6 8 -2 12 l-18 6 q-10 2 -12 -6 q-2 -10 6 -16Z" fill="${P.skin}"/>` +
      `<path d="M78 38 q10 -4 18 -2" fill="none" stroke="${P.soil}" stroke-width="1.4" opacity="0.6"/>` +
      [58, 50, 44]
        .map((y, i) => `<ellipse cx="${74 - i * 4}" cy="${y}" rx="2.4" ry="3.2" fill="${P.gold}"/>`)
        .join('') +
      `<path d="M22 48 v-10" stroke="${P.leaf}" stroke-width="2" stroke-linecap="round"/>` +
      `<path d="M22 40 q-6 -4 -8 -10 q8 0 8 8Z" fill="${P.moss}"/>` +
      `<path d="M22 42 q6 -4 10 -10 q-8 -1 -10 8Z" fill="${P.moss}"/>`,
  },

  Writing: {
    subject: 'a clay tablet, and a reed pressed into it',
    draw: () =>
      `<rect width="${W}" height="${H}" fill="${P.night}"/>` +
      `<rect x="14" y="12" width="82" height="58" rx="6" fill="${P.skin}"/>` +
      `<rect x="18" y="16" width="74" height="50" rx="4" fill="${P.stone}"/>` +
      [0, 1, 2, 3]
        .map((r) =>
          [0, 1, 2, 3, 4, 5]
            .map((k) => {
              const x = 24 + k * 11
              const y = 24 + r * 12
              // Wedges: cuneiform is a stylus pushed in, not a line drawn.
              return (
                `<path d="M${x} ${y} l4 -2 l0 4Z" fill="${P.soil}"/>` +
                (k % 2
                  ? `<path d="M${x + 2} ${y + 4} l4 -2 l0 4Z" fill="${P.soil}"/>`
                  : `<path d="M${x} ${y + 5} l4 2 l-4 2Z" fill="${P.soil}"/>`)
              )
            })
            .join(''),
        )
        .join('') +
      `<path d="M96 66 L114 40" stroke="${P.rock}" stroke-width="3.4" stroke-linecap="round"/>` +
      `<path d="M96 66 l-4 6 l7 -2Z" fill="${P.soil}"/>`,
  },

  'The Great Pyramid': {
    subject: 'two and a half million blocks, already ancient to the Romans',
    draw: () =>
      land(P.sky, P.gold, 56) +
      `<path d="M60 10 L108 62 H12Z" fill="${P.bone}"/>` +
      `<path d="M60 10 L108 62 H60Z" fill="${P.stone}"/>` +
      [0, 1, 2, 3, 4, 5, 6]
        .map(
          (i) =>
            `<path d="M${(60 - (i + 1) * 6.9).toFixed(1)} ${(17.5 + i * 7.5).toFixed(1)} H${(
              60 +
              (i + 1) * 6.9
            ).toFixed(1)}" stroke="${P.rock}" stroke-width="0.8" opacity="0.55"/>`,
        )
        .join('') +
      `<path d="M28 62 L44 44 L60 62Z" fill="${P.bone}" opacity="0.35"/>` +
      `<ellipse cx="60" cy="64" rx="52" ry="4" fill="${P.rock}" opacity="0.4"/>` +
      `<circle cx="100" cy="18" r="7" fill="${P.flame}"/>`,
  },

  'The Roman Empire': {
    subject: 'an arch, which is the technology the whole thing ran on',
    draw: () =>
      land(P.sky, P.stone, 62) +
      `<rect x="10" y="20" width="100" height="10" fill="${P.bone}"/>` +
      `<rect x="6" y="14" width="108" height="7" fill="${P.stone}"/>` +
      [24, 60, 96]
        .map(
          (x) =>
            `<path d="M${x - 15} 62 V40 a15 15 0 0 1 30 0 V62Z" fill="${P.bone}"/>` +
            `<path d="M${x - 9} 62 V40 a9 9 0 0 1 18 0 V62Z" fill="${P.night}"/>`,
        )
        .join('') +
      [0, 1, 2, 3, 4, 5, 6, 7, 8]
        .map((i) => `<path d="M${8 + i * 13} 30 v-9" stroke="${P.rock}" stroke-width="0.9" opacity="0.5"/>`)
        .join('') +
      `<rect y="62" width="${W}" height="18" fill="${P.rock}"/>` +
      `<path d="M0 70 h120" stroke="${P.stone}" stroke-width="1.4" opacity="0.5"/>`,
  },

  'The printing press': {
    subject: 'movable type, and the screw that pushed it',
    draw: () =>
      `<rect width="${W}" height="${H}" fill="${P.night}"/>` +
      `<rect x="16" y="60" width="88" height="10" fill="${P.soil}"/>` +
      `<rect x="20" y="10" width="10" height="52" fill="${P.rock}"/>` +
      `<rect x="90" y="10" width="10" height="52" fill="${P.rock}"/>` +
      `<rect x="16" y="8" width="88" height="8" fill="${P.soil}"/>` +
      `<rect x="34" y="42" width="52" height="10" fill="${P.iron}"/>` +
      `<rect x="30" y="52" width="60" height="8" fill="${P.bone}"/>` +
      `<path d="M60 42 V18" stroke="${P.iron}" stroke-width="6"/>` +
      [0, 1, 2, 3, 4]
        .map((i) => `<path d="M54 ${20 + i * 4} h12" stroke="${P.stone}" stroke-width="2"/>`)
        .join('') +
      `<path d="M60 22 h26" stroke="${P.soil}" stroke-width="4" stroke-linecap="round"/>` +
      `<circle cx="90" cy="22" r="4" fill="${P.rock}"/>` +
      [0, 1, 2, 3, 4, 5, 6, 7]
        .map((i) => `<rect x="${(34 + i * 6.5).toFixed(1)}" y="54" width="4" height="4" fill="${P.void}"/>`)
        .join(''),
  },

  'The steam engine': {
    subject: 'a beam engine — the first power that was not muscle, water or wind',
    draw: () =>
      `<rect width="${W}" height="${H}" fill="${P.dusk}"/>` +
      `<rect y="64" width="${W}" height="16" fill="${P.soil}"/>` +
      `<rect x="8" y="34" width="30" height="30" fill="${P.blood}"/>` +
      `<rect x="8" y="30" width="30" height="6" fill="${P.rock}"/>` +
      `<circle cx="23" cy="50" r="7" fill="${P.flame}"/>` +
      `<rect x="46" y="18" width="6" height="46" fill="${P.iron}"/>` +
      `<path d="M20 20 L92 28" stroke="${P.iron}" stroke-width="7" stroke-linecap="round"/>` +
      `<circle cx="49" cy="24" r="4" fill="${P.rock}"/>` +
      `<path d="M92 28 V52" stroke="${P.iron}" stroke-width="4"/>` +
      `<circle cx="92" cy="58" r="8" fill="${P.iron}"/>` +
      `<circle cx="92" cy="58" r="3" fill="${P.rock}"/>` +
      `<rect x="60" y="4" width="7" height="30" fill="${P.rock}"/>` +
      `<circle cx="66" cy="6" r="5" fill="${P.stone}" opacity="0.75"/>` +
      `<circle cx="74" cy="2" r="6" fill="${P.stone}" opacity="0.6"/>`,
  },

  'The telephone': {
    subject: 'a candlestick set — a voice arriving from nowhere',
    draw: () =>
      `<rect width="${W}" height="${H}" fill="${P.night}"/>` +
      `<ellipse cx="54" cy="68" rx="20" ry="6" fill="${P.iron}"/>` +
      `<rect x="50" y="26" width="8" height="42" fill="${P.iron}"/>` +
      // Banding on the shaft — cast iron was turned on a lathe, not extruded
      // smooth, and a bare rectangle is most of why this one read as a
      // backdrop with a mark on it rather than an object.
      [32, 40, 48, 56, 62].map(
        (y) => `<path d="M50 ${y} h8" stroke="${P.rock}" stroke-width="1" opacity="0.5"/>`,
      ).join('') +
      `<path d="M44 26 q10 -8 20 0 q-10 6 -20 0Z" fill="${P.rock}"/>` +
      `<path d="M46 22 q8 -8 16 0 l-3 4 q-5 -5 -10 0Z" fill="${P.void}"/>` +
      `<path d="M58 34 q22 -14 30 4" fill="none" stroke="${P.soil}" stroke-width="2"/>` +
      `<rect x="82" y="30" width="10" height="22" rx="5" fill="${P.void}"/>` +
      `<circle cx="87" cy="34" r="3" fill="${P.rock}"/>` +
      `<path d="M54 68 q30 8 56 -4" fill="none" stroke="${P.soil}" stroke-width="2"/>` +
      // Sound, drawn rather than implied: three widening arcs off the
      // earpiece rather than two lone dots, which is the actual subject —
      // "a voice arriving from nowhere" — made visible instead of gestured at.
      [5, 9, 13].map(
        (r, i) =>
          `<path d="M${(24 - r).toFixed(1)} 22 a${r} ${r} 0 0 1 0 -${(
            r * 1.6
          ).toFixed(1)}" fill="none" stroke="${P.gold}" stroke-width="1.3" opacity="${(
            0.7 - i * 0.18
          ).toFixed(2)}"/>`,
      ).join(''),
  },

  'Twelve seconds of powered flight': {
    subject: 'the Flyer just off the rail at Kitty Hawk',
    draw: () =>
      land(P.pale, P.gold, 62) +
      // Two wings with visible struts between them, a pilot lying on the lower
      // one, and a propeller. Without those it is a pile of sticks.
      `<path d="M8 30 q52 -5 100 3 v5 q-48 -8 -100 -3Z" fill="${P.bone}"/>` +
      `<path d="M12 46 q52 -5 100 3 v5 q-48 -8 -100 -3Z" fill="${P.bone}"/>` +
      [0, 1, 2, 3, 4, 5]
        .map(
          (i) =>
            `<path d="M${18 + i * 16} ${33 + i * 0.8} L${21 + i * 16} ${49 + i * 0.8}" stroke="${P.soil}" stroke-width="1.6"/>`,
        )
        .join('') +
      `<path d="M40 38 h34" stroke="${P.soil}" stroke-width="1.2"/>` +
      `<ellipse cx="54" cy="45" rx="12" ry="3.4" fill="${P.soil}"/>` +
      `<circle cx="44" cy="43" r="3" fill="${P.skin}"/>` +
      `<path d="M86 36 v16" stroke="${P.rock}" stroke-width="1.6"/>` +
      `<path d="M86 34 q4 5 0 10 q-4 -5 0 -10Z" fill="${P.rock}"/>` +
      `<path d="M86 44 q4 5 0 10 q-4 -5 0 -10Z" fill="${P.rock}"/>` +
      // The forward elevator, which is why it looks backwards to modern eyes.
      `<path d="M4 24 q-4 6 0 10 h12 q4 -5 0 -10Z" fill="${P.bone}"/>` +
      `<path d="M16 30 q-6 6 -4 14" fill="none" stroke="${P.soil}" stroke-width="1.4"/>` +
      // The launching rail.
      `<path d="M0 68 h84" stroke="${P.rock}" stroke-width="3" stroke-linecap="round"/>` +
      `<path d="M0 74 q30 -4 60 0 t60 -2" fill="none" stroke="${P.stone}" stroke-width="2" opacity="0.6"/>`,
  },

  'The first computer': {
    subject: 'a cabinet of valves, and a reel of tape',
    draw: () =>
      `<rect width="${W}" height="${H}" fill="${P.night}"/>` +
      `<rect x="10" y="12" width="60" height="58" rx="3" fill="${P.iron}"/>` +
      [0, 1, 2]
        .map((r) =>
          [0, 1, 2, 3, 4]
            .map(
              (k) =>
                `<rect x="${16 + k * 11}" y="${18 + r * 12}" width="6" height="9" rx="3" fill="${
                  (r + k) % 3 === 0 ? P.flame : P.void
                }"/>`,
            )
            .join(''),
        )
        .join('') +
      [0, 1, 2, 3, 4, 5]
        .map((i) => `<circle cx="${18 + i * 9}" cy="60" r="2.4" fill="${i % 2 ? P.gold : P.stone}"/>`)
        .join('') +
      `<circle cx="90" cy="26" r="13" fill="${P.rock}"/>` +
      `<circle cx="90" cy="26" r="4" fill="${P.iron}"/>` +
      `<circle cx="90" cy="58" r="13" fill="${P.rock}"/>` +
      `<circle cx="90" cy="58" r="4" fill="${P.iron}"/>` +
      `<path d="M78 30 q-6 12 0 24" fill="none" stroke="${P.bone}" stroke-width="2.4"/>`,
  },

  'Footprints on the Moon': {
    subject: 'a boot print in regolith, and the Earth over the horizon',
    draw: () =>
      `<rect width="${W}" height="${H}" fill="${P.void}"/>${stars(29, 12, 22)}` +
      `<rect y="30" width="${W}" height="50" fill="${P.bone}"/>` +
      `<path d="M0 30 q22 -6 40 0 q26 8 46 -2 q18 -8 34 2 v5 H0Z" fill="${P.stone}"/>` +
      `<circle cx="20" cy="14" r="9" fill="${P.sea}"/>` +
      `<path d="M14 10 q8 -5 12 2 q-6 6 -12 -2Z" fill="${P.moss}"/>` +
      // Sole and heel as two separate blocks, which is what a lunar overshoe
      // print actually is and what makes it read as a boot rather than a hole.
      `<path d="M40 40 q22 -4 34 4 q6 5 5 14 l-38 3 q-5 -12 -1 -21Z" fill="${P.ash}"/>` +
      `<path d="M42 43 q20 -3 30 4 q5 4 4 11 l-32 2 q-4 -10 -2 -17Z" fill="${P.night}"/>` +
      `<path d="M41 63 q20 -4 36 -1 q4 8 -2 13 q-14 5 -30 1 q-6 -6 -4 -13Z" fill="${P.ash}"/>` +
      `<path d="M44 66 q17 -4 30 -1 q3 6 -2 9 q-12 4 -25 1 q-5 -4 -3 -9Z" fill="${P.night}"/>` +
      // Four thick bars, not a ladder of thin ones.
      [0, 1, 2, 3]
        .map((i) => `<path d="M${46 + i} ${47 + i * 5} h${26 - i * 2}" stroke="${P.bone}" stroke-width="2.6"/>`)
        .join('') +
      `<path d="M47 70 h24" stroke="${P.bone}" stroke-width="2.6"/>` +
      `<path d="M96 58 q11 -3 16 4 q3 6 -3 10 q-10 4 -16 -3 q-2 -7 3 -11Z" fill="${P.ash}"/>` +
      `<path d="M98 62 q9 -2 12 3 q1 3 -3 5 q-7 2 -10 -2Z" fill="${P.night}"/>`,
  },

  'The World Wide Web': {
    subject: 'documents that point at each other',
    draw: () => {
      const nodes: [number, number][] = [
        [26, 22],
        [92, 20],
        [60, 44],
        [22, 62],
        [96, 60],
      ]
      const links = nodes
        .slice(1)
        .map(([x, y]) => `<path d="M26 22 L${x} ${y}" stroke="${P.sea}" stroke-width="1.6" opacity="0.7"/>`)
        .join('')
      const docs = nodes
        .map(
          ([x, y]) =>
            `<rect x="${x - 9}" y="${y - 11}" width="18" height="22" rx="2" fill="${P.bone}"/>` +
            `<rect x="${x - 9}" y="${y - 11}" width="18" height="5" fill="${P.sky}"/>` +
            `<path d="M${x - 6} ${y - 2} h12 M${x - 6} ${y + 2} h12 M${x - 6} ${y + 6} h7" stroke="${P.iron}" stroke-width="1.2"/>`,
        )
        .join('')
      return (
        `<rect width="${W}" height="${H}" fill="${P.night}"/>` +
        links +
        `<path d="M92 20 L96 60 M60 44 L22 62 M60 44 L96 60" stroke="${P.sea}" stroke-width="1.6" opacity="0.7"/>` +
        docs
      )
    },
  },

  'A computer in everyone’s pocket': {
    subject: 'the thing you are most likely reading this on',
    draw: () => {
      const tiles = [P.ember, P.moss, P.gold, P.blood, P.leaf, P.flame, P.sea, P.dusk, P.stone]
      return (
        `<rect width="${W}" height="${H}" fill="${P.night}"/>` +
        `<rect x="42" y="6" width="36" height="68" rx="6" fill="${P.void}"/>` +
        `<rect x="45" y="12" width="30" height="54" rx="2" fill="${P.sky}"/>` +
        [0, 1, 2]
          .map((r) =>
            [0, 1, 2]
              .map(
                (k) =>
                  `<rect x="${48 + k * 9}" y="${16 + r * 9}" width="6" height="6" rx="1.5" fill="${
                    tiles[r * 3 + k]
                  }"/>`,
              )
              .join(''),
          )
          .join('') +
        `<rect x="48" y="46" width="24" height="16" rx="2" fill="${P.pale}"/>` +
        `<path d="M51 51 h18 M51 55 h18 M51 59 h11" stroke="${P.iron}" stroke-width="1.2"/>` +
        `<circle cx="60" cy="70" r="2.4" fill="${P.iron}"/>` +
        `<path d="M20 30 q-6 8 0 16 M14 24 q-12 14 0 28" fill="none" stroke="${P.sea}" stroke-width="2" stroke-linecap="round" opacity="0.7"/>` +
        `<path d="M100 30 q6 8 0 16 M106 24 q12 14 0 28" fill="none" stroke="${P.sea}" stroke-width="2" stroke-linecap="round" opacity="0.7"/>`
      )
    },
  },

  'You, scrolling': {
    subject: 'a hand on a page, at the bottom of four and a half billion years',
    draw: () =>
      `<rect width="${W}" height="${H}" fill="${P.pale}"/>` +
      `<rect x="14" y="6" width="70" height="68" rx="4" fill="${P.bone}"/>` +
      [0, 1, 2, 3, 4, 5, 6]
        .map(
          (i) =>
            `<path d="M22 ${14 + i * 8} h${i === 6 ? 32 : 54}" stroke="${P.iron}" stroke-width="2" opacity="${(
              0.2 +
              i * 0.1
            ).toFixed(2)}"/>`,
        )
        .join('') +
      `<rect x="88" y="10" width="5" height="60" rx="2.5" fill="${P.iron}" opacity="0.4"/>` +
      `<rect x="88" y="54" width="5" height="16" rx="2.5" fill="${P.sea}"/>` +
      `<path d="M96 40 q14 -8 20 2 q4 8 -4 14 l-10 8 q-8 4 -12 -2 q-4 -8 6 -22Z" fill="${P.skin}"/>` +
      `<path d="M100 46 q8 -3 12 0" fill="none" stroke="${P.soil}" stroke-width="1.2" opacity="0.6"/>`,
  },
} satisfies Record<string, Scene>)

/**
 * A scene's own colour, for the card it sits on.
 *
 * The cards used to be one flat tone regardless of what was drawn inside
 * them — a molten Earth and a snowball Earth sat in identical charcoal boxes.
 * This is not a second palette invented to fix that: it is computed by
 * walking each scene's own SVG and finding which of `P`'s colours actually
 * covers the most of it, so the card for the Cambrian explosion is lit by the
 * same ember the animal is drawn in, and cannot go out of sync with a scene
 * that gets redrawn later.
 *
 * Six tones are excluded from winning even when they cover the most area —
 * `night`, `dusk`, `sky`, `deep`, `void`, `pale` — because in this set they
 * are never the subject, only the sky, the sea or the page it happens on.
 * `land()` alone spends a full-canvas rect on one of them in most scenes, so
 * without the exclusion almost every card would be lit by whatever backdrop
 * happened to be biggest rather than by the thing actually being shown. Found
 * by printing every scene's computed mood and reading the list: without
 * `pale` here, the Wright Flyer's own overcast sky beat the aircraft, and the
 * first apes' dawn beat the apes.
 *
 * Shapes are weighted by real area where the markup gives one — a rect's
 * width*height, a circle's πr², an ellipse's π·rx·ry — and by a nominal
 * mid-size weight for filled paths, which carry most of the actual subjects
 * here (an animal's body, a leaf, a hand) but have no closed-form area
 * without a real path parser. Stroked paths and lines count for less: they
 * draw ribs, ripples and cracks — real detail, but a thin one.
 */
const BACKDROP: Set<string> = new Set([P.night, P.dusk, P.sky, P.deep, P.void, P.pale])

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
    let area = 40 // a nominal floor, so even an unmeasured shape counts a little
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
  // Every scene draws at least one non-backdrop shape; this is a floor for
  // the (never taken, in practice) case that somehow none did.
  return best ?? P.stone
}

/**
 * The one correction to the computed set, found by printing all forty-four
 * and reading them. The steam engine's frame is wooden and really is drawn
 * with more soil-brown area than iron — but a beam engine is the first power
 * in this whole timeline that is not muscle, water or wind, and the metal is
 * the entire reason it has a scene at all. Left as `soil` here it would be
 * the only mid-Victorian machine on the page lit like a barn.
 */
const MOOD_OVERRIDE: Record<string, string> = {
  'The steam engine': P.iron,
}

/** Every scene's own colour, keyed the same as TIME_ART. Computed once. */
export const MOOD: Record<string, string> = Object.fromEntries(
  Object.entries(TIME_ART).map(([title, s]) => [
    title,
    MOOD_OVERRIDE[title] ?? dominantMood(s.draw()),
  ]),
)

/** Full standalone SVG, sized to fill whatever box the card gives it. */
export function sceneSvg(title: string): string {
  const s = TIME_ART[title]
  if (!s) return ''
  return (
    `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" ` +
    `style="width:100%;height:100%;display:block" aria-hidden="true" focusable="false">` +
    `${s.draw()}</svg>`
  )
}
