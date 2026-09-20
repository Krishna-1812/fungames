/**
 * Space Elevator's twenty-nine markers, drawn.
 *
 * These used to be inline SVG strings in the page itself, each one a flat
 * rect the exact colour of its zone's sky with a small scene painted on top —
 * a porthole, the same shape Deep Sea's creatures were in before
 * `deep-sea-art.ts` cut them loose. The page already computes the real sky
 * colour for the metre you are looking at (`mix(zone.sky[0], zone.sky[1],
 * zt)` in `space-elevator.astro`), so a marker painting its own approximation
 * of that colour behind its subject was always going to drift from the real
 * thing as you scrolled past it. These are cut-outs instead: no background of
 * their own, composited directly over the climb's real sky.
 *
 * Two consequences of that:
 *
 * - A handful of the originals had no subject at all — 'A grey, overcast
 *   sky' was four flat bars the width of the frame, and 'The Kármán line' was
 *   a filled rectangle standing for the void above it. A block of colour is
 *   invisible with no block to sit on, so both are redrawn as an actual thing:
 *   a real stratus deck with a top and an underside, and a boundary line with
 *   a glow rather than a fill.
 * - Small decorative "stars" scattered through a few of the originals (the
 *   U-2, Falcon 9, Noctilucent clouds, the X-15) are gone. The climb already
 *   has its own starfield past the stratosphere — `.starfield` in
 *   `space-elevator.astro` — so a marker drawing three more of its own was
 *   duplicate work that would drift out of register with the real ones.
 *
 * **No gradients, no ids, no defs, no filters.** Flat colour only, so all
 * twenty-nine inline into one document without colliding.
 *
 * **One palette**, tuned for the sky rather than the sea: the pale
 * ice-and-metal tones almost everything is drawn in read against troposphere
 * blue, stratosphere navy and thermosphere black alike, and the warm tones
 * (gold, ember, flare) are reserved for things that are genuinely hot or lit
 * from within — a contrail catching the sun, a fireball, a mushroom cloud.
 */

export const P = {
  frost: '#eaf3ff',
  steel: '#dfe6ee',
  cloud: '#c7d4e2',
  cloud2: '#8fa0b8',
  slate: '#3a4a66',
  slate2: '#4c5568',
  umber: '#2a2010',
  gold: '#ffd27a',
  ember: '#ff9d5c',
  ember2: '#ff8a5c',
  flare: '#ffb066',
  flare2: '#ffd9a8',
  skin: '#ffe3c2',
  cyan: '#6ee7ff',
  sky2: '#5aa9e8',
  noc: '#bfe8ff',
  noc2: '#8fd0ff',
  stem: '#c98a5a',
} as const

export type Scene = {
  subject: string
  draw: () => string
}

const W = 120
const H = 120

/** Deterministic scatter, same generator as the other art modules. */
export const rnd = (seed: number, k: number) => {
  const x = Math.sin(seed * 9301 + k * 49297) * 233280
  return x - Math.floor(x)
}

export const SPACE_ELEVATOR_ART: Record<string, Scene> = {
  'The highest a bird has ever been confirmed flying': {
    subject: 'a vulture, wings spread, gliding',
    draw: () =>
      `<path d="M18 76 Q40 48 60 68 Q80 48 102 76" fill="none" stroke="${P.frost}" stroke-width="5" stroke-linecap="round"/>` +
      `<path d="M28 71 Q40 58 52 67 M92 71 Q80 58 68 67" fill="none" stroke="${P.cloud}" stroke-width="2" stroke-linecap="round" opacity="0.7"/>` +
      `<path d="M60 68 L60 90" stroke="${P.frost}" stroke-width="4" stroke-linecap="round"/>` +
      `<circle cx="60" cy="58" r="3" fill="${P.gold}"/>`,
  },
  'The highest a glider has ever flown': {
    subject: 'a sailplane, engineless, banking',
    draw: () =>
      `<path d="M12 60 L108 60 L60 46Z" fill="${P.steel}"/>` +
      `<path d="M60 46 L60 92" stroke="${P.steel}" stroke-width="4"/>` +
      `<path d="M60 92 L46 104 M60 92 L74 104" stroke="${P.steel}" stroke-width="4" stroke-linecap="round"/>` +
      `<path d="M30 58 L46 52 M90 58 L74 52" stroke="${P.cloud2}" stroke-width="1.6" opacity="0.7"/>` +
      `<path d="M4 66 Q60 80 116 66" fill="none" stroke="${P.sky2}" stroke-width="2" opacity="0.55"/>`,
  },
  'Felix Baumgartner’s jump': {
    subject: 'a pressure-suited figure in freefall',
    draw: () =>
      `<circle cx="60" cy="38" r="9" fill="${P.skin}"/>` +
      `<path d="M55 33 a5 5 0 0 1 10 0" fill="none" stroke="${P.slate}" stroke-width="2.5"/>` +
      `<path d="M60 47 L60 78 M60 53 L38 65 M60 53 L82 65 M60 78 L44 102 M60 78 L76 102"
        stroke="${P.skin}" stroke-width="4.5" stroke-linecap="round" fill="none"/>` +
      `<path d="M56 58 L64 58 M52 88 L60 84 M68 88 L60 84" stroke="${P.ember2}" stroke-width="2" stroke-linecap="round"/>` +
      `<path d="M60 18 L60 2" stroke="${P.ember}" stroke-width="2" stroke-dasharray="2 3"/>`,
  },
  'The current highest skydive on record': {
    subject: 'a balloon-borne diver, canopy trailing above',
    draw: () =>
      `<ellipse cx="60" cy="20" rx="27" ry="10" fill="none" stroke="${P.frost}" stroke-width="2.4"/>` +
      `<path d="M36 24 L60 52 M84 24 L60 52" stroke="${P.frost}" stroke-width="1.6"/>` +
      `<circle cx="60" cy="62" r="7" fill="${P.skin}"/>` +
      `<path d="M60 69 L60 92 M60 74 L42 86 M60 74 L78 86" stroke="${P.skin}" stroke-width="4" stroke-linecap="round" fill="none"/>`,
  },
  'A grey, overcast sky': {
    subject: 'a stratus deck, flat-bottomed and featureless',
    draw: () => {
      // A wavering top edge from real points (no under-specified Q commands —
      // each control/end pair is written out in full), a flat-ish underside,
      // and both short of the side edges so the deck reads as a slab of cloud
      // rather than a crop of one.
      const pts = Array.from({ length: 8 }, (_, i) => {
        const x = 8 + (i * (W - 16)) / 7
        const y = 40 + Math.sin(i * 1.7 + 0.4) * 7 + rnd(41, i) * 4
        return [x, y]
      })
      let top = `M8 ${pts[0][1].toFixed(1)}`
      for (let i = 1; i < pts.length; i++) {
        const [px, py] = pts[i - 1]
        const [x, y] = pts[i]
        const cx = (px + x) / 2
        top += ` Q${cx.toFixed(1)} ${py.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`
      }
      const path = `${top} L112 88 Q60 100 8 88 Z`
      return (
        `<path d="${path}" fill="${P.slate2}"/>` +
        `<path d="M18 58 Q40 48 62 55 Q86 48 102 58" fill="none" stroke="${P.cloud}" stroke-width="2.4"/>` +
        `<path d="M14 72 Q50 82 106 72" fill="none" stroke="${P.slate}" stroke-width="2.4"/>` +
        `<path d="M22 90 Q60 98 98 90" fill="none" stroke="${P.slate}" stroke-width="2" opacity="0.7"/>`
      )
    },
  },
  'A fair-weather cumulus': {
    subject: 'a cartoon cumulus, flat-bottomed and cauliflower-topped',
    draw: () =>
      `<circle cx="42" cy="66" r="20" fill="${P.frost}"/>` +
      `<circle cx="68" cy="56" r="26" fill="${P.frost}"/>` +
      `<circle cx="92" cy="70" r="16" fill="${P.frost}"/>` +
      `<rect x="32" y="72" width="72" height="18" rx="9" fill="${P.frost}"/>` +
      // A shaded underside — real fair-weather cumulus are lit from above and
      // flat-grey beneath, and the tone gives the checker's contrast tests
      // something to measure besides "pale on blue".
      `<path d="M32 78 Q68 96 104 78 L104 88 Q68 104 32 88Z" fill="${P.cloud2}" opacity="0.9"/>` +
      `<circle cx="60" cy="46" r="15" fill="${P.steel}"/>`,
  },
  'Mount Everest’s summit': {
    subject: 'a snow-capped peak',
    draw: () =>
      `<path d="M2 100 L38 34 L54 58 L70 22 L118 100Z" fill="${P.slate}"/>` +
      `<path d="M2 100 L38 34 L44 45 L20 100Z" fill="${P.umber}" opacity="0.55"/>` +
      `<path d="M70 22 L118 100 L96 100 L82 60Z" fill="${P.umber}" opacity="0.4"/>` +
      `<path d="M60 34 L70 22 L82 42 L70 40Z" fill="${P.frost}"/>` +
      `<path d="M28 62 L38 34 L48 56Z" fill="${P.frost}" opacity="0.95"/>` +
      `<path d="M64 30 L70 22 L74 30 L70 33Z" fill="${P.steel}"/>`,
  },
  'A bumblebee, in a lab': {
    subject: 'a bumblebee, wings a blur',
    draw: () =>
      `<ellipse cx="60" cy="66" rx="22" ry="16" fill="${P.umber}"/>` +
      `<path d="M42 58 a22 16 0 0 1 36 0" fill="none" stroke="${P.gold}" stroke-width="7"/>` +
      `<ellipse cx="46" cy="48" rx="14" ry="9" fill="${P.frost}" opacity="0.5" transform="rotate(-18 46 48)"/>` +
      `<ellipse cx="74" cy="48" rx="14" ry="9" fill="${P.frost}" opacity="0.5" transform="rotate(18 74 48)"/>`,
  },
  'Where your flight is probably cruising': {
    subject: 'an airliner, contrail behind',
    draw: () =>
      `<path d="M16 66 L96 66 L78 58 L52 58 L40 44 L34 44 L40 58 L16 58Z" fill="${P.frost}"/>` +
      `<path d="M16 66 L96 66 L78 58 L52 58 L46 51 L40 58 L16 58Z" fill="${P.cloud2}" opacity="0.5"/>` +
      `<path d="M66 66 L80 82 L74 82 L62 66Z" fill="${P.frost}"/>` +
      `<circle cx="30" cy="62" r="2" fill="${P.gold}"/>` +
      `<path d="M2 66 Q60 76 118 66" fill="none" stroke="${P.sky2}" stroke-width="1.6" opacity="0.5"/>`,
  },
  'A cumulonimbus, flattening into an anvil': {
    subject: 'a thunderhead colliding with the stratosphere',
    draw: () =>
      `<path d="M18 92 Q14 66 40 62 Q44 42 68 44 Q78 30 96 40 Q112 42 108 60 Q118 64 112 82 L18 92Z" fill="${P.slate2}"/>` +
      `<path d="M18 92 Q14 66 40 62 Q44 46 60 46 Q46 68 40 92Z" fill="${P.umber}" opacity="0.55"/>` +
      `<path d="M96 40 Q112 42 108 60 Q118 64 112 82 L90 82 Q100 62 96 40Z" fill="${P.umber}" opacity="0.4"/>` +
      `<path d="M70 40 L106 28 L116 32 L78 46Z" fill="${P.cloud2}" opacity="0.9"/>` +
      `<path d="M54 92 L46 108 L56 104 L48 120" fill="none" stroke="${P.gold}" stroke-width="3" stroke-linecap="round"/>`,
  },
  'Concorde’s cruising altitude': {
    subject: 'a delta-winged supersonic airliner',
    draw: () =>
      `<path d="M6 64 L96 60 L114 64 L96 68 L58 66 L28 80 L20 80 L32 66 L6 64Z" fill="${P.frost}"/>` +
      `<path d="M52 66 L38 44 L46 44 L60 64Z" fill="${P.frost}" opacity="0.85"/>` +
      `<path d="M8 64 Q60 74 112 64" fill="none" stroke="${P.ember}" stroke-width="1.4" stroke-dasharray="2 4" opacity="0.7"/>`,
  },
  'The U-2’s service ceiling': {
    subject: 'a glider-winged spy plane, alone',
    draw: () =>
      // A real wingspan relative to its fuselage — a U-2's wings are closer
      // to a glider's than a jet's, which is the whole reason it can hold
      // this altitude at all, so the silhouette is drawn wide and thin rather
      // than swept, with actual chord depth rather than a one-pixel sliver.
      `<path d="M4 66 L44 62 L44 58 L76 58 L76 62 L116 66 L76 70 L76 74 L44 74 L44 70Z" fill="${P.steel}"/>` +
      `<path d="M52 58 L58 32 L64 32 L66 58Z" fill="${P.frost}"/>` +
      `<path d="M55 74 L52 88 L58 88 L60 74Z" fill="${P.cloud2}" opacity="0.9"/>`,
  },
  'Inside the ozone layer': {
    subject: 'UV, absorbed before it reaches the ground',
    draw: () =>
      // A band, not a ring: the layer is a thickness of gas the incoming ray
      // is stopped inside, so it is drawn as a solid arc of atmosphere with
      // the ray running into it and stopping, rather than a diagram of rings.
      `<path d="M4 82 A64 64 0 0 1 116 82 L116 100 A82 82 0 0 0 4 100Z" fill="${P.cyan}" opacity="0.5"/>` +
      `<path d="M4 82 A64 64 0 0 1 116 82" fill="none" stroke="${P.cyan}" stroke-width="2.6"/>` +
      `<path d="M116 100 A82 82 0 0 0 4 100" fill="none" stroke="${P.cyan}" stroke-width="2.2" opacity="0.85"/>` +
      `<path d="M60 4 L60 50" stroke="${P.ember}" stroke-width="3.2" stroke-linecap="round"/>` +
      `<circle cx="60" cy="58" r="7" fill="${P.gold}"/>`,
  },
  'The SR-71’s altitude record': {
    subject: 'a Blackbird, sustained and level, chines flat',
    draw: () =>
      `<path d="M8 68 L60 60 L70 38 L76 38 L72 60 L106 62 L114 66 L72 66 L52 80 L44 80 L58 66 L8 68Z" fill="${P.slate}"/>` +
      `<path d="M8 68 L60 60 L64 64 L18 70Z" fill="${P.slate2}" opacity="0.7"/>` +
      `<path d="M60 60 L68 42 L72 42 L68 60Z" fill="${P.cloud2}"/>` +
      `<circle cx="106" cy="62" r="2.4" fill="${P.ember}"/>` +
      `<path d="M6 68 Q60 80 112 66" fill="none" stroke="${P.ember2}" stroke-width="1.6" stroke-dasharray="1 3" opacity="0.6"/>`,
  },
  'The Chelyabinsk meteor': {
    subject: 'an airburst, mid-shatter',
    draw: () =>
      `<path d="M104 14 L42 92" stroke="${P.ember}" stroke-width="3" stroke-linecap="round" opacity="0.6"/>` +
      `<circle cx="40" cy="96" r="27" fill="${P.ember}" opacity="0.4"/>` +
      `<circle cx="40" cy="96" r="16" fill="${P.gold}"/>` +
      `<circle cx="35" cy="90" r="6" fill="${P.frost}"/>` +
      `<circle cx="46" cy="102" r="3" fill="${P.umber}" opacity="0.65"/>` +
      `<circle cx="30" cy="104" r="2.4" fill="${P.umber}" opacity="0.6"/>` +
      `<path d="M22 100 L6 110 M28 114 L18 126 M52 108 L60 122" stroke="${P.gold}" stroke-width="2" opacity="0.65" stroke-linecap="round"/>`,
  },
  'Where most weather balloons pop': {
    subject: 'a balloon, swollen past bursting',
    draw: () =>
      `<ellipse cx="60" cy="44" rx="30" ry="34" fill="${P.frost}" opacity="0.5"/>` +
      `<path d="M60 10 a34 34 0 1 0 0.1 0Z" fill="none" stroke="${P.frost}" stroke-width="2.2"/>` +
      `<path d="M46 70 L52 88 L68 88 L74 70" fill="none" stroke="${P.frost}" stroke-width="1.8"/>` +
      `<rect x="52" y="88" width="16" height="12" fill="${P.gold}" opacity="0.9"/>` +
      `<path d="M28 30 L16 18 M92 30 L104 18" stroke="${P.ember}" stroke-width="2.2" opacity="0.75" stroke-linecap="round"/>`,
  },
  'Joseph Kittinger’s jump': {
    subject: 'a diver, open gondola falling away above',
    draw: () =>
      `<path d="M38 20 L82 20 L88 38 L32 38Z" fill="none" stroke="${P.frost}" stroke-width="2"/>` +
      `<circle cx="60" cy="56" r="7" fill="${P.skin}"/>` +
      `<path d="M60 63 L60 92 M60 69 L42 84 M60 69 L78 84 M60 92 L46 114 M60 92 L74 114"
        stroke="${P.skin}" stroke-width="3.6" stroke-linecap="round" fill="none"/>`,
  },
  'The highest a balloon has ever reached': {
    subject: 'the record balloon, alone at the top of the world',
    draw: () =>
      `<ellipse cx="60" cy="42" rx="27" ry="36" fill="${P.steel}" opacity="0.45"/>` +
      `<ellipse cx="60" cy="42" rx="27" ry="36" fill="none" stroke="${P.steel}" stroke-width="2.2"/>` +
      `<path d="M38 74 L46 96 L74 96 L82 74" fill="none" stroke="${P.steel}" stroke-width="1.8"/>` +
      `<rect x="48" y="96" width="24" height="14" rx="2" fill="${P.slate2}" stroke="${P.frost}" stroke-width="1.4"/>` +
      `<circle cx="56" cy="103" r="1.8" fill="${P.gold}"/>`,
  },
  'Where a Falcon 9 lets its first stage go': {
    subject: 'stage separation, high and thin',
    draw: () =>
      `<rect x="51" y="16" width="17" height="48" rx="2" fill="${P.frost}"/>` +
      `<rect x="51" y="16" width="6" height="48" fill="${P.steel}" opacity="0.7"/>` +
      `<rect x="51" y="66" width="17" height="32" rx="2" fill="${P.cloud2}"/>` +
      `<rect x="51" y="66" width="17" height="6" fill="${P.slate}" opacity="0.6"/>` +
      `<path d="M51 98 L42 114 M68 98 L77 114" stroke="${P.ember}" stroke-width="3" stroke-linecap="round"/>` +
      `<circle cx="59.5" cy="106" r="4" fill="${P.flare}"/>` +
      `<path d="M45 64 L74 64" stroke="${P.gold}" stroke-width="1.4" stroke-dasharray="2 2" opacity="0.8"/>`,
  },
  'Noctilucent clouds': {
    subject: 'electric-blue cloud, lit after the ground has gone dark',
    draw: () =>
      // Bands of real width rather than single strokes — noctilucent cloud
      // photographs read as ribbons of light, not wire-frame lines, and a
      // 2px stroke at 46px is a scratch.
      `<path d="M4 60 Q40 46 76 60 Q98 70 120 56 L120 66 Q98 80 76 70 Q40 56 4 70Z" fill="${P.noc}" opacity="0.85"/>` +
      `<path d="M8 76 Q44 64 80 76 Q100 84 118 72 L118 80 Q100 92 80 84 Q44 72 8 84Z" fill="${P.noc2}" opacity="0.75"/>` +
      `<path d="M16 92 Q48 84 82 92 L82 98 Q48 90 16 98Z" fill="${P.noc}" opacity="0.5"/>` +
      // The streaking the real thing is named for — thin combed lines along
      // the ribbon, catching more or less light than the sheet around them.
      `<path d="M14 62 Q40 52 66 62 M20 66 Q46 58 90 64" stroke="${P.frost}" stroke-width="1" opacity="0.55" fill="none"/>` +
      `<path d="M18 78 Q48 70 86 80 M30 82 Q60 76 100 82" stroke="${P.frost}" stroke-width="1" opacity="0.45" fill="none"/>`,
  },
  'Tsar Bomba’s mushroom cloud': {
    subject: 'the largest detonation ever tested, still climbing',
    draw: () =>
      `<path d="M60 108 L60 66" stroke="${P.stem}" stroke-width="10"/>` +
      `<path d="M56 108 L56 66" stroke="${P.umber}" stroke-width="3" opacity="0.5"/>` +
      `<circle cx="60" cy="52" r="30" fill="${P.ember2}" opacity="0.9"/>` +
      `<circle cx="40" cy="40" r="14" fill="${P.flare}" opacity="0.85"/>` +
      `<circle cx="82" cy="44" r="16" fill="${P.flare}" opacity="0.85"/>` +
      `<circle cx="60" cy="24" r="15" fill="${P.flare2}" opacity="0.9"/>` +
      `<circle cx="52" cy="56" r="8" fill="${P.umber}" opacity="0.4"/>` +
      `<circle cx="72" cy="58" r="7" fill="${P.umber}" opacity="0.35"/>`,
  },
  'The Kármán line': {
    subject: 'the boundary itself, a band of light with nothing on either side',
    draw: () =>
      // A glow rather than a diagram — the line has no object to draw, so it
      // is drawn as the thing it actually is: a bright band, faked without a
      // gradient by three solid bars stacked wide-to-narrow, with a sharp
      // bright core at the centre.
      `<rect x="4" y="52" width="112" height="16" fill="${P.cyan}" opacity="0.35"/>` +
      `<rect x="4" y="56" width="112" height="8" fill="${P.cyan}" opacity="0.55"/>` +
      `<rect x="4" y="58.5" width="112" height="3" fill="${P.frost}"/>` +
      // A little internal grain in the glow itself, so it is not one flat
      // wash — flecks of the line's own bright core, scattered along it.
      Array.from({ length: 10 }, (_, i) => {
        const x = 10 + rnd(53, i) * 100
        const y = 54 + rnd(53, i + 20) * 12
        return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(0.8 + rnd(53, i + 40) * 1.1).toFixed(1)}" fill="${P.slate}" opacity="0.4"/>`
      }).join('') +
      `<path d="M46 34 L60 58 L74 34 M46 86 L60 62 L74 86" fill="none" stroke="${P.gold}" stroke-width="2.2" opacity="0.7" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  'The X-15’s highest flight': {
    subject: 'a stubby rocket plane, off the top of the chart',
    draw: () =>
      `<path d="M18 96 Q50 46 84 20" fill="none" stroke="${P.ember2}" stroke-width="2" stroke-dasharray="3 4" opacity="0.7"/>` +
      // A rocket plane, not a jet: short, thick, wedge-nosed, stub wings
      // rather than a swept jet silhouette — the shape that made it a rocket
      // with a cockpit rather than an aircraft with an engine.
      `<g transform="translate(84 20) rotate(-32)">` +
      `<path d="M-24 -5 L18 -5 L26 0 L18 5 L-24 5 L-18 0Z" fill="${P.frost}"/>` +
      `<path d="M-24 -5 L2 -5 L2 5 L-24 5Z" fill="${P.cloud2}" opacity="0.55"/>` +
      `<path d="M-4 -5 L-16 -16 L-8 -16 L2 -5Z" fill="${P.steel}"/>` +
      `<path d="M-4 5 L-16 16 L-8 16 L2 5Z" fill="${P.steel}" opacity="0.85"/>` +
      `<path d="M-24 -3 L-34 -3 L-34 3 L-24 3Z" fill="${P.slate}"/>` +
      `<ellipse cx="-32" cy="0" rx="6" ry="4" fill="${P.flare}"/>` +
      `<ellipse cx="-36" cy="0" rx="3" ry="2.2" fill="${P.frost}"/>` +
      `</g>`,
  },

  /* ---- filling the 1,500m-to-Everest gap ----------------------------------- */

  'Where altitude sickness starts to bite': {
    subject: 'a hiker sitting on a boulder, head down, wrapped around their knees',
    draw: () =>
      `<path d="M18 100 Q22 78 44 78 Q62 78 64 96 Q66 106 48 108 L22 108 Q14 106 18 100Z" fill="${P.slate2}"/>` +
      `<path d="M24 92 Q34 84 46 88" fill="none" stroke="${P.slate}" stroke-width="1.4" opacity="0.55"/>` +
      `<path d="M40 68 Q40 58 50 58 Q60 58 60 70 L58 92 Q58 100 49 100 Q40 100 40 90Z" fill="${P.steel}"/>` +
      `<circle cx="49" cy="52" r="8.5" fill="${P.skin}"/>` +
      `<path d="M44 92 L36 104 M56 92 L64 102" stroke="${P.steel}" stroke-width="4.5" stroke-linecap="round"/>` +
      `<path d="M42 66 L34 82 M56 66 L64 80" stroke="${P.skin}" stroke-width="3.6" stroke-linecap="round"/>` +
      `<path d="M45 68 Q49 74 53 68" fill="none" stroke="${P.cloud2}" stroke-width="1.4" opacity="0.6"/>` +
      `<path d="M84 30 L90 104" stroke="${P.stem}" stroke-width="2.6" stroke-linecap="round"/>`,
  },
  'La Paz, the highest capital city on Earth': {
    subject: 'a city built up the walls of a bowl-shaped valley, a cable car crossing above it',
    draw: () =>
      `<path d="M2 108 Q30 54 60 54 Q90 54 118 108Z" fill="${P.slate2}"/>` +
      `<path d="M2 108 Q30 54 60 54 Q90 54 118 108" fill="none" stroke="${P.slate}" stroke-width="1.6" opacity="0.6"/>` +
      `<rect x="32" y="86" width="7" height="22" fill="${P.frost}"/>` +
      `<rect x="41" y="78" width="6" height="30" fill="${P.steel}"/>` +
      `<rect x="49" y="90" width="6" height="18" fill="${P.cloud}"/>` +
      `<rect x="57" y="82" width="7" height="26" fill="${P.frost}"/>` +
      `<rect x="66" y="94" width="6" height="14" fill="${P.steel}"/>` +
      `<rect x="74" y="88" width="6" height="20" fill="${P.cloud}"/>` +
      `<rect x="83" y="96" width="6" height="12" fill="${P.frost}"/>` +
      `<circle cx="35.5" cy="92" r="0.9" fill="${P.slate}"/><circle cx="44" cy="84" r="0.9" fill="${P.slate}"/>` +
      `<circle cx="60.5" cy="88" r="0.9" fill="${P.slate}"/><circle cx="77" cy="94" r="0.9" fill="${P.slate}"/>` +
      `<path d="M16 62 L104 92" stroke="${P.cloud2}" stroke-width="1.3" opacity="0.7"/>` +
      `<line x1="56" y1="80" x2="56" y2="75" stroke="${P.cloud2}" stroke-width="1"/>` +
      `<rect x="51" y="75" width="10" height="6.5" rx="2" fill="${P.gold}"/>`,
  },
  'Mont Blanc’s summit': {
    subject: 'a jagged double-peaked rock massif, snow on its two highest points and a shadowed face below',
    draw: () =>
      `<path d="M8 106 L50 32 L62 48 L76 20 L112 106Z" fill="${P.slate2}"/>` +
      `<path d="M76 20 L90 42 L70 46 L62 48Z" fill="${P.frost}"/>` +
      `<path d="M50 32 L60 44 L42 46Z" fill="${P.frost}" opacity="0.92"/>` +
      `<path d="M62 48 L76 20 L82 32 L68 58Z" fill="${P.slate}"/>` +
      `<path d="M42 46 L50 32 L56 40 L46 58Z" fill="${P.slate}" opacity="0.85"/>` +
      `<path d="M66 40 L74 52 M78 34 L86 46" stroke="${P.cloud2}" stroke-width="2" opacity="0.85"/>` +
      `<path d="M20 92 L42 60 M32 98 L52 70 M84 92 L98 66" stroke="${P.cloud2}" stroke-width="1.8" opacity="0.6"/>`,
  },
  'Kilimanjaro’s summit': {
    subject: 'a broad, flat-topped massif with a band of snow along its rim and cloud below',
    draw: () =>
      `<path d="M6 106 L34 52 Q60 38 86 52 L114 106Z" fill="${P.slate2}"/>` +
      `<path d="M34 52 Q60 40 86 52 L82 60 Q60 50 38 60Z" fill="${P.frost}"/>` +
      `<path d="M28 92 L44 64 M50 98 L64 66 M76 94 L92 64" stroke="${P.slate}" stroke-width="1.3" opacity="0.5"/>` +
      `<ellipse cx="60" cy="80" rx="58" ry="10" fill="${P.cloud}" opacity="0.6"/>` +
      `<ellipse cx="60" cy="86" rx="48" ry="8" fill="${P.cloud2}" opacity="0.5"/>`,
  },
  'The highest-altitude spider ever found': {
    subject: 'a jumping spider, eight legs splayed, on a bare patch of rock',
    draw: () =>
      `<ellipse cx="60" cy="100" rx="30" ry="7" fill="${P.slate2}" opacity="0.7"/>` +
      `<path d="M53 50 L36 40 M53 56 L32 55 M53 63 L34 70 M53 70 L38 84" fill="none" stroke="${P.steel}" stroke-width="2" stroke-linecap="round"/>` +
      `<path d="M67 50 L84 40 M67 56 L88 55 M67 63 L86 70 M67 70 L82 84" fill="none" stroke="${P.steel}" stroke-width="2" stroke-linecap="round"/>` +
      `<ellipse cx="60" cy="63" rx="11" ry="14" fill="${P.umber}"/>` +
      `<circle cx="60" cy="47" r="7.5" fill="${P.umber}"/>` +
      `<circle cx="57" cy="45" r="1.3" fill="${P.frost}"/><circle cx="63" cy="45" r="1.3" fill="${P.frost}"/>` +
      `<path d="M52 60 Q60 66 68 60" fill="none" stroke="${P.slate}" stroke-width="1.2" opacity="0.5"/>`,
  },
  'A bar-headed goose, crossing the Himalaya': {
    subject: 'a goose in level flight, neck extended, black bars across a pale head',
    draw: () =>
      `<path d="M10 106 L30 88 L46 102 L64 82 L84 102 L104 90 L118 106Z" fill="${P.slate2}" opacity="0.6"/>` +
      `<path d="M52 62 Q30 42 14 48 Q28 60 50 68Z" fill="${P.steel}"/>` +
      `<path d="M70 62 Q92 42 108 48 Q94 60 72 68Z" fill="${P.steel}"/>` +
      `<path d="M40 66 Q60 54 82 62 Q76 70 60 70 Q46 70 40 66Z" fill="${P.frost}"/>` +
      `<path d="M78 62 Q92 58 99 66" fill="none" stroke="${P.frost}" stroke-width="5" stroke-linecap="round"/>` +
      `<circle cx="101" cy="67" r="5" fill="${P.frost}"/>` +
      `<path d="M97 63 Q101 61 105 63" fill="none" stroke="${P.slate}" stroke-width="1.6"/>` +
      `<path d="M98 70 Q101 72 104 70" fill="none" stroke="${P.slate}" stroke-width="1.6"/>` +
      `<path d="M106 66 L111 67 L106 69Z" fill="${P.gold}"/>`,
  },
} as const

/* ---- mood, and the standalone svg wrapper -------------------------------- */

export function dominantMood(svg: string): string {
  const weight = new Map<string, number>()
  const add = (hex: string | undefined, area: number) => {
    if (!hex || !hex.startsWith('#')) return
    weight.set(hex, (weight.get(hex) ?? 0) + area)
  }
  const num = (attrs: string, name: string) => {
    const m = attrs.match(new RegExp(`${name}="(-?[\\d.]+)"`))
    return m ? Number(m[1]) : undefined
  }
  const attr = (attrs: string, name: string) => attrs.match(new RegExp(`${name}="([^"]*)"`))?.[1]

  for (const m of svg.matchAll(/<(rect|circle|ellipse|path|polygon|line|text)\s+([^>]*)\/?>/g)) {
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
  return best ?? P.frost
}

export const MOOD: Record<string, string> = Object.fromEntries(
  Object.entries(SPACE_ELEVATOR_ART).map(([title, s]) => [title, dominantMood(s.draw())]),
)

/** Full standalone SVG, sized to fill whatever box the marker gives it. */
export function sceneSvg(title: string): string {
  const s = SPACE_ELEVATOR_ART[title]
  if (!s) return ''
  return (
    `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" ` +
    `style="width:100%;height:100%;display:block" aria-hidden="true" focusable="false">` +
    `${s.draw()}</svg>`
  )
}
