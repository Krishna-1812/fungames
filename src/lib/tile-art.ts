/**
 * Tile illustrations — one bespoke drawing per game, keyed by slug.
 *
 * Keyed by SLUG on purpose. The old registry had an `art` field naming a
 * shape from a shared pool, which is exactly the thing that made eighteen
 * tiles look like one template with the silhouette swapped: same white ink,
 * same opacity ramp, same corner, every time. Keying on the slug makes
 * sharing a drawing between two games structurally impossible, and
 * scripts/check-art.mjs fails if a game has no drawing or a drawing has no
 * game.
 *
 * Each illustration declares its own `slot` — where it sits on the tile and
 * how it is cropped — and its own palette. Neither is decoration: the
 * checker rasterises every tile with resvg and asserts the drawing is
 * actually visible, that it stays out of the title's way, that white text
 * still clears 4.5:1 over it, and that no two drawings resolve to the same
 * thumbnail.
 *
 * Every gradient and clip id is prefixed with the slug. All eighteen of
 * these are inlined into one homepage document and SVG ids are global to the
 * document, so two drawings sharing an id means one of them silently renders
 * with the other's gradient.
 */

/** Where the drawing sits on the tile, and how it is cropped. */
export type Slot =
  | 'full'         // covers the card, cropped to fill
  | 'scatter'      // covers the card, elements spread across it
  | 'right'        // the right-hand third, bleeding off the corner
  | 'centre-right' // an object floated in the right half
  | 'band-bottom'  // a strip across the full width, on the bottom edge
  | 'corner-tr'    // tucked into the top-right corner
  | 'edge-right'   // full height, narrow, against the right edge

export type Illustration = {
  /** What it depicts. For check-art's report, and for whoever edits it next. */
  subject: string
  slot: Slot
  viewBox: string
  /** Every colour the drawing uses. Checked against the tile it sits on. */
  palette: string[]
  /** Inner markup. Deterministic: same seed, same string, forever. */
  draw: (seed: number) => string
}

/* ---- shared plumbing --------------------------------------------------- */

/** Deterministic pseudo-random in [0,1). Same shape as the tile rotation. */
export const rnd = (seed: number, k: number) => {
  const x = Math.sin(seed * 9301 + k * 49297) * 233280
  return x - Math.floor(x)
}

const n = (v: number) => (Math.round(v * 10) / 10).toString()
const range = (k: number) => Array.from({ length: k }, (_, i) => i)

/** A little standing figure — a head and a body, nothing more. */
const person = (x: number, y: number, h: number, fill: string) =>
  `<g fill="${fill}"><circle cx="${n(x)}" cy="${n(y - h)}" r="${n(h * 0.24)}"/>` +
  `<path d="M${n(x - h * 0.22)} ${n(y)} L${n(x - h * 0.18)} ${n(y - h * 0.62)} ` +
  `Q${n(x)} ${n(y - h * 0.82)} ${n(x + h * 0.18)} ${n(y - h * 0.62)} ` +
  `L${n(x + h * 0.22)} ${n(y)}Z"/></g>`

export const ART: Record<string, Illustration> = {
  /* ---- Universe Forecast ----------------------------------------------- */
  'universe-forecast': {
    subject: 'totality, corona and prominences, with the lunar month running beneath it',
    // `full` because the subject is a sky, and a sky in a box on the right is
    // just a logo.
    //
    // Two constraints come with it, and the first draft broke both. `full` is
    // xMidYMid *slice*, and the three card widths have aspect ratios from 2.03
    // to 3.89, so a drawing gets cropped hard on one axis or the other. Against
    // this 320x120 box the region visible on every card is only x 38–282 by
    // y 19–101; the first version put its horizon and its row of moons at
    // y 100–130, which on the widest card were not merely cut off but outside
    // the frame entirely — and resvg panics outright on an element with no
    // visible box, taking the whole checker down with a Rust backtrace and no
    // slug. Everything below therefore lives inside that band.
    //
    // The second: the slot dissolves from 10% to 70% of the width, so anything
    // that has to be legible belongs on the right.
    slot: 'full',
    viewBox: '0 0 320 120',
    palette: [
      '#ffd98a', '#ffd774', '#fff3d0', '#fff8e2', '#ffe6ae',
      '#ff8fa8', '#8fb4ff', '#cfe0ff', '#4b5a9c', '#141c40', '#080c22',
    ],
    draw: (seed) => {
      const CX = 224, CY = 50, R = 21
      // The corona as spokes, not a blur: a blur at tile size resolves to a
      // fuzzy grey ring and reads as a rendering mistake rather than as light.
      const corona = range(34).map((i) => {
        const a = (i / 34) * Math.PI * 2 + rnd(seed, i) * 0.12
        const r1 = R + 4 + rnd(seed, i + 40) * 16
        return `<path d="M${n(CX + Math.cos(a) * (R + 1))} ${n(CY + Math.sin(a) * (R + 1))} ` +
          `L${n(CX + Math.cos(a) * r1)} ${n(CY + Math.sin(a) * r1)}" ` +
          `stroke="#ffd98a" stroke-width="${n(0.9 + rnd(seed, i + 90) * 1.7)}" ` +
          `stroke-linecap="round" opacity="${n(0.22 + rnd(seed, i + 12) * 0.5)}"/>`
      }).join('')
      // Stars only inside the always-visible band, and never inside the corona,
      // where they would read as dust on the lens.
      const stars = range(54).map((i) => {
        const x = 44 + rnd(seed, i + 200) * 234
        const y = 24 + rnd(seed, i + 300) * 52
        if (Math.hypot(x - CX, y - CY) < R + 21) return ''
        return `<circle cx="${n(x)}" cy="${n(y)}" r="${n(0.6 + rnd(seed, i + 400) * 1.4)}" ` +
          `fill="#fff3d0" opacity="${n(0.18 + rnd(seed, i + 500) * 0.55)}"/>`
      }).join('')
      // Two long equatorial streamers on top of the even spokes. A real corona
      // is not radially symmetric — it is pulled out sideways along the Sun's
      // magnetic equator — and the asymmetry is most of what makes a
      // photograph of one recognisable.
      const streamers = [0, Math.PI].map((base) => {
        const a = base + (rnd(seed, 7) - 0.5) * 0.3
        const len = R + 30
        return `<path d="M${n(CX + Math.cos(a - 0.16) * R)} ${n(CY + Math.sin(a - 0.16) * R)} ` +
          `Q${n(CX + Math.cos(a) * len * 0.7)} ${n(CY + Math.sin(a) * len * 0.7)} ` +
          `${n(CX + Math.cos(a) * len)} ${n(CY + Math.sin(a) * len)} ` +
          `Q${n(CX + Math.cos(a) * len * 0.7)} ${n(CY + Math.sin(a) * len * 0.7)} ` +
          `${n(CX + Math.cos(a + 0.16) * R)} ${n(CY + Math.sin(a + 0.16) * R)}Z" ` +
          `fill="#fff3d0" opacity="0.16"/>`
      }).join('')

      // Prominences: the pink loops on the limb, and the one detail that says
      // this is totality rather than a hole punched in a gradient.
      const proms = [0.7, 2.4, 4.3].map((a, i) =>
        `<circle cx="${n(CX + Math.cos(a) * (R - 3.6))}" cy="${n(CY + Math.sin(a) * (R - 3.6))}" ` +
        `r="${n(1.3 + rnd(seed, i + 60) * 1.1)}" fill="#ff8fa8" opacity="0.9"/>`).join('')

      // The month running underneath, waxing left to right — the other half of
      // what the page forecasts, and what makes the tile read as a calendar of
      // the sky rather than one picture of one eclipse.
      //
      // The terminator is an ellipse, not an arc of a circle: it is the edge of
      // a sphere seen at an angle, and its width is the cosine of the phase
      // angle. Drawing crescents as half-discs is the usual shortcut and it is
      // why most moon icons look like logos.
      const Y = 92, r = 6.5
      const phase = (x: number, frac: number, waxing: boolean) => {
        if (frac < 0.02)
          return `<circle cx="${n(x)}" cy="${Y}" r="${r}" fill="none" stroke="#8fb4ff" stroke-width="1.4" opacity="0.7"/>`
        if (frac > 0.98)
          return `<circle cx="${n(x)}" cy="${Y}" r="${r}" fill="#cfe0ff" opacity="0.95"/>`
        const ci = 2 * frac - 1
        const rx = Math.abs(ci) * r
        const sweep = ci > 0 ? 1 : 0
        const body = `<path d="M${n(x)} ${Y - r} A${r} ${r} 0 0 1 ${n(x)} ${Y + r} ` +
          `A${n(rx)} ${r} 0 0 ${sweep} ${n(x)} ${Y - r}Z" fill="#cfe0ff" opacity="0.95"/>`
        const flipped = waxing ? body : `<g transform="translate(${n(2 * x)} 0) scale(-1 1)">${body}</g>`
        return `<circle cx="${n(x)}" cy="${Y}" r="${r}" fill="#141c40"/>${flipped}` +
          `<circle cx="${n(x)}" cy="${Y}" r="${r}" fill="none" stroke="#4b5a9c" stroke-width="1"/>`
      }
      const MONTH: [number, boolean][] = [[0, true], [0.28, true], [0.75, true], [1, true], [0.4, false]]
      return `
        <defs>
          <radialGradient id="universe-forecast-corona" cx="0.5" cy="0.5">
            <stop offset="${n((R - 1) / (R + 17))}" stop-color="#fff8e2" stop-opacity="0.85"/>
            <stop offset="${n((R + 4) / (R + 17))}" stop-color="#ffe6ae" stop-opacity="0.4"/>
            <stop offset="1" stop-color="#cfe0ff" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <g>${stars}</g>
        <g>${streamers}</g>
        <g>${corona}</g>
        <circle cx="${CX}" cy="${CY}" r="${R + 17}" fill="url(#universe-forecast-corona)"/>
        <circle cx="${CX}" cy="${CY}" r="${R - 3.2}" fill="none" stroke="#ffd774" stroke-width="1.8"/>
        <g>${proms}</g>
        <circle cx="${CX}" cy="${CY}" r="${R - 4}" fill="#080c22"/>
        ${MONTH.map(([f, w], i) => phase(64 + i * 42, f, w)).join('')}`
    },
  },

  /* ---- The Auction Game ------------------------------------------------ */
  auction: {
    subject: 'a gavel coming down on the block, over a bidding paddle',
    slot: 'centre-right',
    viewBox: '0 0 140 140',
    palette: ['#f2e3cc', '#b9773c', '#8a5327', '#e8c07a'],
    draw: () => `
      <g transform="rotate(-13 34 74)" opacity="0.42">
        <rect x="4" y="34" width="52" height="60" rx="8" fill="#f2e3cc"/>
        <rect x="11" y="41" width="38" height="46" rx="5" fill="none" stroke="#8a5327" stroke-width="2.8" opacity="0.5"/>
        <rect x="25" y="92" width="10" height="34" rx="5" fill="#b9773c"/>
      </g>
      <rect x="40" y="112" width="86" height="11" rx="4" fill="#8a5327"/>
      <rect x="48" y="99" width="70" height="15" rx="5" fill="#f2e3cc"/>
      <g transform="rotate(-34 88 62)">
        <rect x="52" y="42" width="72" height="34" rx="11" fill="#b9773c"/>
        <rect x="52" y="42" width="72" height="13" rx="11" fill="#e8c07a" opacity="0.5"/>
        <rect x="62" y="42" width="6" height="34" fill="#e8c07a"/>
        <rect x="108" y="42" width="6" height="34" fill="#e8c07a"/>
        <rect x="82" y="74" width="12" height="52" rx="6" fill="#8a5327"/>
      </g>
      <g fill="none" stroke="#e8c07a" stroke-width="3" stroke-linecap="round" opacity="0.8">
        <path d="M16 66 q9 -15 25 -21"/>
        <path d="M14 86 q12 -21 34 -29"/>
      </g>`,
  },

  /* ---- I'm Not a Robot ------------------------------------------------- */
  'not-a-robot': {
    subject: 'a verification grid, one square of which is watching back',
    slot: 'corner-tr',
    viewBox: '0 0 120 90',
    palette: ['#e9eefc', '#5b8def', '#1d3f8f', '#ff5a5a', '#ffffff'],
    draw: () => {
      const cells = range(9)
        .map((i) => {
          const x = 20 + (i % 3) * 27
          const y = 6 + ((i / 3) | 0) * 27
          // The middle-right square is the one that is not a photograph.
          if (i === 5) {
            return `<rect x="${x}" y="${y}" width="23" height="23" rx="4" fill="#1d3f8f"/>
              <rect x="${x + 4}" y="${y + 8}" width="15" height="10" rx="3" fill="#e9eefc"/>
              <circle cx="${x + 8.5}" cy="${y + 13}" r="2.1" fill="#ff5a5a"/>
              <circle cx="${x + 14.5}" cy="${y + 13}" r="2.1" fill="#ff5a5a"/>
              <path d="M${x + 11.5} ${y + 3} v5" stroke="#e9eefc" stroke-width="1.6"/>`
          }
          const ticked = i === 0 || i === 4 || i === 7
          return `<rect x="${x}" y="${y}" width="23" height="23" rx="4" fill="${
            ticked ? '#5b8def' : '#e9eefc'
          }" opacity="${ticked ? '1' : '0.32'}"/>${
            ticked
              ? `<path d="M${x + 6} ${y + 12} l4 4 l7 -9" fill="none" stroke="#ffffff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`
              : ''
          }`
        })
        .join('')
      return `<g transform="rotate(-5 60 45)">${cells}</g>
        <path d="M72 60 L72 86 L78.5 80 L83 90 L88 87.6 L83.6 78 L92 76.6 Z"
              fill="#ffffff" stroke="#1d3f8f" stroke-width="2" stroke-linejoin="round"/>`
    },
  },

  /* ---- Asteroid Launcher ----------------------------------------------- */
  asteroid: {
    subject: 'a city on the horizon, and the rock most of the way down',
    slot: 'band-bottom',
    viewBox: '0 -18 240 96',
    palette: ['#1a0703', '#40160c', '#ff7a33', '#ffd08a', '#fff3d6'],
    draw: (s) => {
      const towers = range(15)
        .map((i) => {
          const x = 6 + i * 15.4 + rnd(s, i) * 4
          const h = 8 + rnd(s, i + 20) * 20
          const w = 6 + rnd(s, i + 40) * 5
          return `<rect x="${n(x)}" y="${n(50 - h)}" width="${n(w)}" height="${n(h + 8)}" fill="#1a0703"/>`
        })
        .join('')
      return `
        <defs>
          <radialGradient id="asteroid-fire" cx="0.5" cy="0.5">
            <stop offset="0" stop-color="#fff3d6"/>
            <stop offset="0.36" stop-color="#ffd08a"/>
            <stop offset="0.7" stop-color="#ff7a33"/>
            <stop offset="1" stop-color="#ff7a33" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <ellipse cx="176" cy="50" rx="46" ry="30" fill="url(#asteroid-fire)" opacity="0.82"/>
        <path d="M0 52 Q120 30 240 52 L240 78 L0 78 Z" fill="#40160c"/>
        ${towers}
        <g fill="none" stroke="#ff7a33" stroke-linecap="round">
          <ellipse cx="176" cy="59" rx="24" ry="7" stroke-width="2.2" opacity="0.9"/>
          <ellipse cx="176" cy="59" rx="44" ry="12" stroke-width="1.8" opacity="0.5"/>
          <ellipse cx="176" cy="59" rx="68" ry="17" stroke-width="1.4" opacity="0.26"/>
          <ellipse cx="176" cy="59" rx="94" ry="23" stroke-width="1.1" opacity="0.14"/>
        </g>
        <ellipse cx="176" cy="59" rx="12" ry="4.2" fill="#fff3d6" opacity="0.95"/>
        <path d="M236 4 L188 43" stroke="#fff3d6" stroke-width="2.6" stroke-linecap="round" opacity="0.85"/>
        <path d="M239 11 L198 43" stroke="#ffd08a" stroke-width="1.4" stroke-linecap="round" opacity="0.4"/>
        <circle cx="186" cy="44.5" r="4.2" fill="#fff3d6"/>`
    },
  },

  /* ---- Overstimulated -------------------------------------------------- */
  overstimulated: {
    subject: 'every upgrade at once, fighting over the same rectangle',
    slot: 'scatter',
    viewBox: '0 14 240 108',
    palette: ['#ff4d94', '#31e6d6', '#ffe066', '#8bff5a', '#ffffff', '#1b0327'],
    draw: (s) => {
      const cols = ['#ff4d94', '#31e6d6', '#ffe066', '#8bff5a']
      const bits = range(15)
        .map((i) => {
          // Kept clear of the type — this one is loud enough to matter, and a
          // 6px chip of #8bff5a under a blurb is a real contrast failure even
          // though it looks like nothing on a contact sheet.
          const x = 146 + rnd(s, i) * 90
          const y = 18 + rnd(s, i + 30) * 100
          const c = cols[i % 4]
          const sz = 4 + rnd(s, i + 60) * 6
          return rnd(s, i + 90) > 0.5
            ? `<circle cx="${n(x)}" cy="${n(y)}" r="${n(sz / 2)}" fill="${c}" opacity="0.7"/>`
            : `<rect x="${n(x)}" y="${n(y)}" width="${n(sz)}" height="${n(sz)}" rx="1.5" fill="${c}" opacity="0.65" transform="rotate(${n(
                rnd(s, i + 120) * 70 - 35,
              )} ${n(x)} ${n(y)})"/>`
        })
        .join('')
      const cursors = [
        [196, 18, -8],
        [214, 60, 14],
        [178, 96, -22],
      ]
        .map(
          ([x, y, r]) =>
            `<path transform="translate(${x} ${y}) rotate(${r})" d="M0 0 L0 17 L4.4 13 L7.4 20 L10.6 18.4 L7.6 11.8 L13 11 Z" fill="#ffffff" stroke="#1b0327" stroke-width="1.4" stroke-linejoin="round"/>`,
        )
        .join('')
      return `${bits}
        <g transform="rotate(6 194 54)">
          <rect x="152" y="24" width="86" height="60" rx="7" fill="#1b0327" stroke="#ff4d94" stroke-width="2.4"/>
          <path d="M152 31 a7 7 0 0 1 7 -7 h72 a7 7 0 0 1 7 7 v8 h-86 Z" fill="#ff4d94"/>
          <path d="M225 28 l6.5 6.5 M231.5 28 l-6.5 6.5" stroke="#1b0327" stroke-width="2" stroke-linecap="round"/>
          <rect x="161" y="47" width="58" height="5" rx="2.5" fill="#31e6d6" opacity="0.85"/>
          <rect x="161" y="57" width="40" height="5" rx="2.5" fill="#ffffff" opacity="0.45"/>
          <rect x="161" y="68" width="34" height="11" rx="5.5" fill="#8bff5a"/>
        </g>
        <rect x="138" y="104" width="94" height="11" rx="5.5" fill="#1b0327" opacity="0.5"/>
        <rect x="138" y="104" width="76" height="11" rx="5.5" fill="#ffe066"/>
        ${cursors}`
    },
  },

  /* ---- Orbit ------------------------------------------------------------ */
  orbit: {
    subject: 'a star, two planets on real ellipses, and a comet on its way out',
    slot: 'full',
    viewBox: '0 18 240 104',
    palette: ['#fff6d8', '#ffd98a', '#8fb8ff', '#dfe8ff', '#ffffff'],
    draw: (s) => {
      const stars = range(24)
        .map(
          (i) =>
            `<circle cx="${n(3 + rnd(s, i) * 234)}" cy="${n(21 + rnd(s, i + 50) * 98)}" r="${n(
              0.5 + rnd(s, i + 100) * 0.85,
            )}" fill="#ffffff" opacity="${n(0.18 + rnd(s, i + 150) * 0.42)}"/>`,
        )
        .join('')
      return `
        <defs>
          <radialGradient id="orbit-star" cx="0.5" cy="0.5">
            <stop offset="0" stop-color="#ffffff"/>
            <stop offset="0.28" stop-color="#fff6d8"/>
            <stop offset="0.58" stop-color="#ffd98a" stop-opacity="0.5"/>
            <stop offset="1" stop-color="#ffd98a" stop-opacity="0"/>
          </radialGradient>
        </defs>
        ${stars}
        <g fill="none" stroke="#dfe8ff" transform="rotate(-16 170 74)">
          <ellipse cx="170" cy="74" rx="56" ry="21" opacity="0.28" stroke-width="1.3"/>
          <ellipse cx="170" cy="74" rx="94" ry="45" opacity="0.18" stroke-width="1.3"/>
          <path d="M114 70 A64 26 0 0 1 224 68" stroke="#dfe8ff" stroke-width="2.4"
                stroke-linecap="round" opacity="0.6"/>
        </g>
        <circle cx="170" cy="74" r="27" fill="url(#orbit-star)"/>
        <circle cx="170" cy="74" r="8.5" fill="#fff6d8"/>
        <circle cx="219" cy="60" r="5" fill="#8fb8ff"/>
        <circle cx="84" cy="106" r="6.5" fill="#dfe8ff"/>
        <path d="M56 32 Q30 19 8 20" stroke="#ffffff" stroke-width="2.2" fill="none"
              stroke-linecap="round" opacity="0.38"/>
        <circle cx="58" cy="33" r="3.4" fill="#ffffff"/>`
    },
  },

  /* ---- Powder ----------------------------------------------------------- */
  powder: {
    subject: 'sand, water and lava each finding their own level',
    slot: 'band-bottom',
    viewBox: '0 -18 240 96',
    palette: ['#e0b268', '#b9873f', '#3f7fbf', '#6fb0e0', '#ff6a1f', '#ffd07a', '#5fbf5f', '#6b5f52'],
    draw: (s) => {
      const grains = range(20)
        .map((i) => {
          const x = 150 + rnd(s, i) * 86
          const y = rnd(s, i + 40) * 36
          return `<rect x="${n(x)}" y="${n(y)}" width="2.8" height="2.8" fill="#e0b268" opacity="${n(
            0.35 + rnd(s, i + 80) * 0.55,
          )}"/>`
        })
        .join('')
      return `
        <defs>
          <radialGradient id="powder-glow" cx="0.5" cy="0.65">
            <stop offset="0" stop-color="#ffd07a" stop-opacity="0.85"/>
            <stop offset="1" stop-color="#ff6a1f" stop-opacity="0"/>
          </radialGradient>
        </defs>
        ${grains}
        <path d="M0 78 L0 72 L86 72 L94 78 Z" fill="#6b5f52"/>
        <!-- a liquid is flat; a poured powder holds an angle of repose. The
             control point is solved back from the apex, because a quadratic
             only reaches (P0 + 2C + P2)/4 — halfway to where it is aimed. -->
        <!-- Water needs something to be in. Left as a bare rectangle on the
             floor it reads as a blue box rather than as a liquid sitting at
             its own level, which is the one thing this game is about. -->
        <path d="M82 78 L82 62 L90 62 L90 78 Z" fill="#6b5f52"/>
        <path d="M124 78 L124 62 L132 62 L132 78 Z" fill="#6b5f52"/>
        <path d="M88 78 L88 66 L126 66 L126 78 Z" fill="#3f7fbf"/>
        <rect x="88" y="64" width="38" height="2.6" fill="#6fb0e0"/>
        <path d="M126 78 Q190 -22 240 70 Z" fill="#b9873f"/>
        <path d="M140 78 Q190 0 234 73 Z" fill="#e0b268"/>
        <!-- the ridge a poured cone keeps down its near face -->
        <path d="M188 24 Q198 50 208 78" fill="none" stroke="#f0cf9a" stroke-width="2"
              stroke-linecap="round" opacity="0.5"/>
        <ellipse cx="228" cy="70" rx="28" ry="14" fill="url(#powder-glow)"/>
        <path d="M206 78 Q226 30 240 74 Z" fill="#ff6a1f"/>
        <path d="M216 78 Q230 48 240 76 Z" fill="#ffd07a" opacity="0.75"/>
        <g stroke="#5fbf5f" stroke-width="2.4" fill="none" stroke-linecap="round">
          <path d="M166 66 v-20"/>
          <path d="M166 54 q-9 -3 -11 -12"/>
          <path d="M166 59 q10 -4 13 -13"/>
        </g>`
    },
  },

  /* ---- Deep Time --------------------------------------------------------- */
  'deep-time': {
    subject: 'a cliff face in cross-section: strata, a fossil, and the iridium line',
    slot: 'edge-right',
    viewBox: '0 0 82 140',
    palette: ['#241b45', '#332762', '#43357a', '#54408f', '#6a4d9e', '#8a63b4', '#efe3c9', '#ffd166', '#7fce8a'],
    draw: (s) => {
      // Oldest at the bottom, which is the only way round it can be.
      const beds = ['#1d1636', '#3a2a63', '#2b4a6e', '#5b4187', '#7a5a4a', '#8a63b4']
      const bands = beds
        .map((c, i) => {
          const y = 132 - i * 21
          const wob = 3 + rnd(s, i) * 5
          const edge = `M0 ${n(y)} Q26 ${n(y - wob)} 46 ${n(y - wob * 0.4)} T82 ${n(y - wob * 0.8)}`
          return (
            `<path d="${edge} L82 ${n(y + 24)} L0 ${n(y + 24)} Z" fill="${c}"/>` +
            `<path d="${edge}" fill="none" stroke="#efe3c9" stroke-width="1.1" opacity="0.3"/>`
          )
        })
        .reverse()
        .join('')
      // An ammonite: a logarithmic spiral, because that is what one is.
      const spiral = range(30)
        .map((i) => {
          const a = i * 0.52
          const r = 1.4 * Math.exp(0.11 * i)
          return `${i ? 'L' : 'M'}${n(50 + Math.cos(a) * r)},${n(74 + Math.sin(a) * r)}`
        })
        .join(' ')
      return `${bands}
        <!-- the boundary layer: thin, bright, and the reason you are reading this -->
        <path d="M0 47 Q28 43 50 45 T82 44" stroke="#ffd166" stroke-width="2.6" fill="none" opacity="0.95"/>
        <path d="M0 26 Q30 21 52 24 T82 22 L82 0 L0 0 Z" fill="#7fce8a" opacity="0.32"/>
        <g transform="rotate(-14 50 74)">
          <path d="${spiral}" fill="none" stroke="#efe3c9" stroke-width="2.4"
                stroke-linecap="round" opacity="0.9"/>
          ${range(7)
            .map((i) => {
              const a = 2.2 + i * 0.62
              const r0 = 4 + i * 2.2
              const r1 = r0 + 5.5 + i * 1.4
              return `<path d="M${n(50 + Math.cos(a) * r0)} ${n(74 + Math.sin(a) * r0)} L${n(
                50 + Math.cos(a) * r1,
              )} ${n(74 + Math.sin(a) * r1)}" stroke="#efe3c9" stroke-width="1.2" opacity="0.55"/>`
            })
            .join('')}
        </g>`
    },
  },

  /* ---- Scale ------------------------------------------------------------- */
  scale: {
    subject: 'four rings of magnitude, each carrying what lives at that size',
    slot: 'centre-right',
    viewBox: '0 0 140 140',
    palette: ['#eafaff', '#8fdce8', '#2b9bb3', '#ffffff'],
    draw: () => {
      const arm = (turn: number) =>
        range(13)
          .map((i) => {
            const a = turn + i * 0.27
            const r = 1.6 + i * 1.5
            return `${i ? 'L' : 'M'}${n(70 + Math.cos(a) * r)},${n(70 + Math.sin(a) * r * 0.7)}`
          })
          .join(' ')
      return `
        <g fill="none" stroke="#eafaff">
          <circle cx="70" cy="70" r="64" stroke-width="1.6" opacity="0.4"/>
          <circle cx="70" cy="70" r="46" stroke-width="1.8" opacity="0.5"/>
          <circle cx="70" cy="70" r="28" stroke-width="2" opacity="0.62"/>
        </g>
        <g transform="rotate(-24 70 70)" stroke="#eafaff" stroke-width="2.4" fill="none"
           stroke-linecap="round" opacity="0.9">
          <path d="${arm(0)}"/><path d="${arm(Math.PI)}"/>
        </g>
        <g transform="translate(70 6)">
          <circle r="11" fill="#2b9bb3"/>
          <path d="M-11 -2 q5 -4 11 -1 t11 -2" stroke="#eafaff" stroke-width="2" fill="none" opacity="0.85"/>
          <path d="M-9 5 q6 3 9 0 t9 1" stroke="#eafaff" stroke-width="1.8" fill="none" opacity="0.7"/>
          <circle r="11" fill="none" stroke="#eafaff" stroke-width="1.8"/>
        </g>
        ${person(70, 46, 19, '#eafaff')}
        <g transform="translate(70 70)" fill="none" stroke="#eafaff" stroke-width="2">
          <ellipse rx="18" ry="7"/>
          <ellipse rx="18" ry="7" transform="rotate(60)" opacity="0.85"/>
          <ellipse rx="18" ry="7" transform="rotate(-60)" opacity="0.85"/>
          <circle r="4.4" fill="#ffffff" stroke="none"/>
        </g>`
    },
  },

  /* ---- Rule Cascade ------------------------------------------------------ */
  'rule-cascade': {
    subject: 'a password field, the rules stacking under it, and the moth',
    slot: 'right',
    viewBox: '0 0 240 140',
    palette: ['#0a2b20', '#5cb872', '#8ce8a0', '#ff6b6b', '#cfd8c8', '#ffffff'],
    draw: () => {
      const rows = [
        { ok: true, w: 96 },
        { ok: true, w: 118 },
        { ok: false, w: 82 },
        { ok: true, w: 106 },
      ]
        .map(
          (r, i) => `
          <g transform="translate(0 ${64 + i * 19})" opacity="${1 - i * 0.14}">
            ${
              r.ok
                ? `<path d="M42 8 l4.5 5 l8 -10" fill="none" stroke="#8ce8a0" stroke-width="2.6"
                     stroke-linecap="round" stroke-linejoin="round"/>`
                : `<path d="M42 3 l11 11 M53 3 l-11 11" stroke="#ff6b6b" stroke-width="2.6" stroke-linecap="round"/>`
            }
            <rect x="64" y="4" width="${r.w}" height="7" rx="3.5" fill="#ffffff" opacity="0.4"/>
          </g>`,
        )
        .join('')
      return `
        <rect x="36" y="18" width="184" height="32" rx="8" fill="#0a2b20" opacity="0.75"/>
        <rect x="36" y="18" width="184" height="32" rx="8" fill="none" stroke="#5cb872" stroke-width="2"/>
        <g fill="#8ce8a0">
          ${range(7)
            .map((i) => `<circle cx="${52 + i * 11}" cy="34" r="3.4"/>`)
            .join('')}
        </g>
        <!-- the caret, and the gap where a letter used to be -->
        <rect x="130" y="26" width="2.4" height="16" fill="#8ce8a0"/>
        ${rows}
        <!-- something has been in here -->
        <path d="M148 128 q10 -9 22 -4" stroke="#ffffff" stroke-width="1.4" fill="none"
              opacity="0.3" stroke-dasharray="3 4"/>
        <g transform="rotate(16 186 122)">
          <path d="M186 122 q-16 -14 -22 -3 q4 9 22 3Z" fill="#cfd8c8" opacity="0.85"/>
          <path d="M186 122 q14 -16 21 -5 q-3 10 -21 5Z" fill="#cfd8c8" opacity="0.7"/>
          <ellipse cx="186" cy="123" rx="2.6" ry="6" fill="#0a2b20"/>
        </g>`
    },
  },

  /* ---- Spend It ---------------------------------------------------------- */
  'spend-it': {
    subject: 'bundles of notes, one of them going over, and the loose change',
    slot: 'right',
    viewBox: '0 0 240 140',
    palette: ['#63c9a4', '#2f8f74', '#e9f7f1', '#f2c94c', '#c99a24'],
    draw: (s) => {
      const bundle = (x: number, y: number, k: number) =>
        range(k)
          .map(
            (i) => `
            <g transform="translate(${n(x + rnd(s, i + k) * 2 - 1)} ${n(y - i * 9)})">
              <rect width="52" height="9" rx="1.6" fill="#2f8f74"/>
              <rect y="0.6" width="52" height="7" rx="1.4" fill="#63c9a4"/>
              <rect x="20" y="0.6" width="12" height="7" fill="#e9f7f1" opacity="0.9"/>
            </g>`,
          )
          .join('')
      const coin = (x: number, y: number, r: number) =>
        `<g><ellipse cx="${n(x)}" cy="${n(y + 2)}" rx="${n(r)}" ry="${n(r * 0.42)}" fill="#c99a24"/>
          <ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(r)}" ry="${n(r * 0.42)}" fill="#f2c94c"/>
          <ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(r * 0.55)}" ry="${n(r * 0.23)}" fill="#c99a24" opacity="0.45"/></g>`
      return `
        ${bundle(46, 122, 6)}
        ${bundle(104, 122, 9)}
        ${bundle(162, 122, 4)}
        <!-- the one that has had enough -->
        <g transform="rotate(-58 214 104)">${bundle(196, 116, 3)}</g>
        ${coin(84, 130, 9)}
        ${coin(148, 132, 7)}
        ${coin(196, 128, 8)}
        ${coin(122, 134, 5.5)}`
    },
  },

  /* ---- Steady Hand -------------------------------------------------------- */
  'steady-hand': {
    subject: 'the four shapes, drawn by a hand that is not as steady as it thinks',
    slot: 'full',
    viewBox: '0 16 240 106',
    palette: ['#ffcf8f', '#fff3e2', '#ffffff'],
    draw: (s) => {
      // Every one of these is drawn with a wobble, because none of them is
      // ever drawn without one.
      const wob = (i: number, amp: number) => (rnd(s, i) - 0.5) * amp
      const circle = range(37)
        .map((i) => {
          const a = (i / 36) * Math.PI * 2
          const r = 20 + wob(i, 3.2)
          return `${i ? 'L' : 'M'}${n(216 + Math.cos(a) * r)},${n(50 + Math.sin(a) * r)}`
        })
        .join(' ')
      const square = range(41)
        .map((i) => {
          const t = (i / 40) * 4
          const k = Math.min(3, Math.floor(t))
          const f = t - k
          const c = [
            [-19, -19],
            [19, -19],
            [19, 19],
            [-19, 19],
          ]
          const a = c[k]
          const b = c[(k + 1) % 4]
          return `${i ? 'L' : 'M'}${n(214 + a[0] + (b[0] - a[0]) * f + wob(i + 60, 3.4))},${n(
            98 + a[1] + (b[1] - a[1]) * f + wob(i + 90, 3.4),
          )}`
        })
        .join(' ')
      const spiral = range(44)
        .map((i) => {
          const a = i * 0.3
          const r = 1.6 + i * 0.46
          return `${i ? 'L' : 'M'}${n(158 + Math.cos(a) * r + wob(i + 130, 2.4))},${n(
            98 + Math.sin(a) * r + wob(i + 170, 2.4),
          )}`
        })
        .join(' ')
      const line = range(25)
        .map((i) => {
          const t = i / 24
          return `${i ? 'L' : 'M'}${n(154 + t * 62)},${n(46 + Math.sin(t * 7) * 3 + wob(i + 210, 2.8))}`
        })
        .join(' ')
      return `
        <g fill="none" stroke="#ffcf8f" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round">
          <path d="${line}" opacity="0.92"/>
          <path d="${circle}" opacity="0.92"/>
          <path d="${square}" opacity="0.88"/>
          <path d="${spiral}" opacity="0.85"/>
        </g>
        <g fill="#fff3e2">
          <circle cx="154" cy="46" r="4.6"/>
          <circle cx="216" cy="46" r="4.6"/>
          <circle cx="216" cy="50" r="3.6"/>
          <circle cx="158" cy="98" r="3.6"/>
        </g>
        <path d="M154 46 L216 46" stroke="#ffffff" stroke-width="1.4"
              stroke-dasharray="4 6" opacity="0.3"/>`
    },
  },

  /* ---- Fusion ------------------------------------------------------------- */
  fusion: {
    subject: 'two things arriving at the same place, and what happens there',
    slot: 'centre-right',
    viewBox: '0 0 140 140',
    palette: ['#b44cf0', '#ff6bd6', '#7ee8ff', '#ffffff'],
    draw: () => {
      const spikes = range(12)
        .map((i) => {
          const a = (i / 12) * Math.PI * 2
          const r1 = i % 2 ? 34 : 47
          return `<path d="M${n(70 + Math.cos(a) * 19)} ${n(70 + Math.sin(a) * 19)} L${n(
            70 + Math.cos(a) * r1,
          )} ${n(70 + Math.sin(a) * r1)}" stroke="#ffffff" stroke-width="${i % 2 ? 2 : 3.2}" opacity="${
            i % 2 ? 0.5 : 0.85
          }" stroke-linecap="round"/>`
        })
        .join('')
      return `
        <defs>
          <radialGradient id="fusion-core" cx="0.5" cy="0.5">
            <stop offset="0" stop-color="#ffffff"/>
            <stop offset="0.36" stop-color="#ff6bd6"/>
            <stop offset="1" stop-color="#b44cf0" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <g transform="translate(2 24)">
          <path d="M16 0 C26 15 32 22 32 30 a16 16 0 0 1 -32 0 c0 -8 6 -15 16 -30Z" fill="#7ee8ff"/>
          <ellipse cx="10" cy="32" rx="4" ry="6" fill="#ffffff" opacity="0.6"/>
        </g>
        <g transform="translate(94 74)">
          <path d="M17 0 C30 17 36 28 36 37 a18 18 0 0 1 -36 0 c0 -11 8 -18 17 -37Z" fill="#ff6bd6"/>
          <path d="M18 17 c7 9 8 15 8 19 a9 9 0 0 1 -18 0 c0 -5 4 -10 10 -19Z" fill="#ffffff" opacity="0.65"/>
        </g>
        <circle cx="70" cy="70" r="44" fill="url(#fusion-core)"/>
        ${spikes}
        <circle cx="70" cy="70" r="14" fill="#ffffff"/>`
    },
  },

  /* ---- Trolley ------------------------------------------------------------ */
  trolley: {
    subject: 'the trolley, the fork, the lever, and the arithmetic on both branches',
    slot: 'right',
    viewBox: '0 0 150 140',
    palette: ['#d94f3d', '#f0c9a0', '#ffe6c4', '#8a7060', '#4a3125', '#f5ded0', '#ffd166'],
    draw: () => {
      const sleepers = range(6)
        .map((i) => `<rect x="${2 + i * 15}" y="90" width="9" height="9" rx="1.5" fill="#4a3125"/>`)
        .join('')
      return `
        ${sleepers}
        <path d="M0 88 H84 L150 50" stroke="#8a7060" stroke-width="3" fill="none" stroke-linecap="round"/>
        <path d="M0 98 H86 L150 60" stroke="#8a7060" stroke-width="3" fill="none" stroke-linecap="round"/>
        <path d="M84 88 L150 96" stroke="#8a7060" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.85"/>
        <path d="M86 98 L150 107" stroke="#8a7060" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.85"/>
        <g>
          <rect x="72" y="78" width="9" height="8" rx="2" fill="#4a3125"/>
          <path d="M76.5 80 L85 60" stroke="#ffd166" stroke-width="3.4" stroke-linecap="round"/>
          <circle cx="85.5" cy="58" r="4" fill="#ffd166"/>
        </g>
        <!-- one down there -->
        ${person(128, 61, 16, '#f5ded0')}
        <!-- and five on the line it is already on -->
        ${person(103, 108, 14, '#f5ded0')}
        ${person(114, 110, 14, '#f5ded0')}
        ${person(125, 107, 14, '#f5ded0')}
        ${person(136, 111, 14, '#f5ded0')}
        ${person(146, 108, 14, '#f5ded0')}
        <g>
          <rect x="18" y="46" width="60" height="38" rx="6" fill="#d94f3d"/>
          <rect x="14" y="39" width="68" height="10" rx="5" fill="#f0c9a0"/>
          <rect x="25" y="53" width="19" height="16" rx="3" fill="#ffe6c4"/>
          <rect x="52" y="53" width="19" height="16" rx="3" fill="#ffe6c4"/>
          <rect x="31" y="74" width="34" height="4" rx="2" fill="#4a3125" opacity="0.35"/>
          <circle cx="31" cy="88" r="7" fill="#4a3125"/>
          <circle cx="31" cy="88" r="2.8" fill="#f0c9a0"/>
          <circle cx="66" cy="88" r="7" fill="#4a3125"/>
          <circle cx="66" cy="88" r="2.8" fill="#f0c9a0"/>
          <path d="M48 39 V26" stroke="#4a3125" stroke-width="2.4"/>
          <path d="M39 26 H59" stroke="#4a3125" stroke-width="2.8" stroke-linecap="round"/>
        </g>`
    },
  },

  /* ---- Paper Folds -------------------------------------------------------- */
  'paper-folds': {
    subject: 'a sheet halving itself, with where it ends up hanging over it',
    slot: 'corner-tr',
    viewBox: '0 0 120 90',
    palette: ['#fffdf4', '#f6ecd4', '#a9873f', '#5c4413'],
    draw: () => `
      <defs>
        <radialGradient id="paper-folds-moon" cx="0.36" cy="0.32">
          <stop offset="0" stop-color="#fffdf4"/>
          <stop offset="1" stop-color="#a9873f"/>
        </radialGradient>
      </defs>
      <circle cx="96" cy="17" r="19" fill="url(#paper-folds-moon)"/>
      <circle cx="89" cy="12" r="4" fill="#a9873f" opacity="0.55"/>
      <circle cx="103" cy="24" r="2.8" fill="#a9873f" opacity="0.5"/>
      <circle cx="97" cy="8" r="2" fill="#a9873f" opacity="0.45"/>
      <!-- the sheet, and the same sheet three folds later; each fold doubles
           the thickness, which is the only fact the game needs -->
      <path d="M4 76 L54 63 L96 74 L44 89 Z" fill="#5c4413"/>
      <path d="M11 67 L57 55 L92 65 L46 78 Z" fill="#a9873f"/>
      <path d="M19 58 L60 47 L88 56 L48 68 Z" fill="#f6ecd4"/>
      <path d="M30 50 L63 41 L82 48 L50 58 Z" fill="#fffdf4"/>
      <path d="M19 58 L88 56" stroke="#5c4413" stroke-width="1.6" opacity="0.55"/>
      <path d="M46 78 L57 55" stroke="#5c4413" stroke-width="1.4" opacity="0.4"/>
      <path d="M16 38 q24 -13 44 -1" fill="none" stroke="#fffdf4" stroke-width="2.4"
            stroke-linecap="round" opacity="0.7" stroke-dasharray="4 5"/>
      <path d="M57 31 l5 7 l-8 2Z" fill="#fffdf4" opacity="0.75"/>`,
  },

  /* ---- Ambient Mix -------------------------------------------------------- */
  'ambient-mix': {
    subject: 'rain falling into a waveform, over the fader that set its level',
    slot: 'band-bottom',
    viewBox: '0 -18 240 96',
    palette: ['#eaf6ff', '#8fd0ff', '#3f7fbf', '#ffffff'],
    draw: (s) => {
      const rain = range(22)
        .map((i) => {
          const x = 128 + rnd(s, i) * 110
          const y = rnd(s, i + 40) * 26
          const len = 8 + rnd(s, i + 80) * 13
          return `<path d="M${n(x)} ${n(y)} l${n(-len * 0.32)} ${n(len)}" stroke="#8fd0ff" stroke-width="1.6"
            stroke-linecap="round" opacity="${n(0.25 + rnd(s, i + 120) * 0.4)}"/>`
        })
        .join('')
      // Mirrored about its own centre line, the way a waveform is drawn.
      const bars = range(38)
        .map((i) => {
          const x = 118 + i * 3.3
          const env = Math.sin((i / 37) * Math.PI)
          const h = 2.2 + env * (5 + rnd(s, i + 200) * 12)
          return `<rect x="${n(x)}" y="${n(62 - h)}" width="2.4" height="${n(h * 2)}" rx="1.2"
            fill="#eaf6ff" opacity="${n(0.45 + env * 0.5)}"/>`
        })
        .join('')
      return `${rain}${bars}
        <g transform="translate(120 71)">
          <rect width="116" height="5" rx="2.5" fill="#3f7fbf"/>
          <rect width="74" height="5" rx="2.5" fill="#8fd0ff"/>
          <rect x="69" y="-5" width="10" height="15" rx="4" fill="#eaf6ff"/>
        </g>`
    },
  },

  /* ---- Progress ----------------------------------------------------------- */
  progress: {
    subject: 'a dial running off the edge, and three meters filling under it',
    slot: 'edge-right',
    viewBox: '0 0 82 140',
    palette: ['#ffffff', '#e3c9ff', '#c79bf5', '#5b3585'],
    draw: () => {
      const R = 33
      const C = 2 * Math.PI * R
      return `
        <g transform="translate(56 34)">
          <circle r="${R}" fill="none" stroke="#5b3585" stroke-width="11"/>
          <circle r="${R}" fill="none" stroke="#e3c9ff" stroke-width="11" stroke-linecap="round"
                  stroke-dasharray="${n(C * 0.68)} ${n(C)}" transform="rotate(-90)"/>
          <path d="M0 0 L0 -21" stroke="#ffffff" stroke-width="3.8" stroke-linecap="round"
                transform="rotate(128)"/>
          <circle r="4" fill="#ffffff"/>
        </g>
        ${[0.86, 0.41, 0.63]
          .map(
            (v, i) => `
          <g transform="translate(11 ${102 + i * 15})">
            <rect width="62" height="10" rx="5" fill="#5b3585"/>
            <rect width="${n(62 * v)}" height="10" rx="5" fill="#c79bf5"/>
            <rect x="${n(62 * v - 3)}" width="3" height="10" fill="#ffffff"/>
          </g>`,
          )
          .join('')}`
    },
  },

  /* ---- From Memory --------------------------------------------------------- */
  'from-memory': {
    subject: 'a bicycle drawn from memory, which is to say a bicycle that cannot work',
    slot: 'scatter',
    viewBox: '0 20 240 102',
    palette: ['#ffa8d2', '#ffffff', '#ffe1f0'],
    draw: () => `
      <!-- the shape everyone is sure of, faintly, underneath -->
      <g fill="none" stroke="#ffffff" stroke-width="1.6" opacity="0.2">
        <circle cx="158" cy="90" r="23"/>
        <circle cx="216" cy="90" r="23"/>
        <path d="M158 90 L178 58 L206 58 L216 90 M178 58 L190 90 L216 90 M190 90 L158 90"/>
      </g>
      <!-- and the shape they actually draw: no seat tube, pedals nowhere near -->
      <g fill="none" stroke="#ffa8d2" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="157" cy="92" r="24"/>
        <circle cx="218" cy="88" r="24"/>
        <path d="M157 92 L182 54 L210 58 L218 88"/>
        <path d="M182 54 L174 43 L190 41"/>
        <path d="M210 58 L214 46 L224 46"/>
        <circle cx="192" cy="103" r="7"/>
        <path d="M192 96 L197 89"/>
      </g>
      <g fill="#ffe1f0">
        <circle cx="157" cy="92" r="3.2"/>
        <circle cx="218" cy="88" r="3.2"/>
      </g>
      <!-- two earlier goes, abandoned -->
      <g stroke="#ffffff" stroke-width="2" opacity="0.22" stroke-linecap="round">
        <path d="M46 34 l18 18 M64 34 l-18 18"/>
        <path d="M82 30 l14 14 M96 30 l-14 14"/>
      </g>`,
  },

  /* ---- Life in Weeks -------------------------------------------------------- */
  'life-in-weeks': {
    subject: 'the weeks, running down the card, with the one you are in ringed',
    slot: 'edge-right',
    viewBox: '0 0 82 140',
    palette: ['#ffffff', '#ff6b6b'],
    draw: () => `
      <!-- Two patterns rather than three hundred rects: the grid is the same
           square repeated, and repeating it in markup would be four times the
           weight of the rest of the tile put together. -->
      <defs>
        <pattern id="life-in-weeks-cell" width="9" height="9" patternUnits="userSpaceOnUse">
          <rect x="1" y="1" width="6" height="6" rx="1.2" fill="#ffffff"/>
        </pattern>
      </defs>
      <rect x="-2" y="-2" width="86" height="144" fill="url(#life-in-weeks-cell)" opacity="0.16"/>
      <rect x="-2" y="-2" width="86" height="47" fill="url(#life-in-weeks-cell)" opacity="0.82"/>
      <rect x="-2" y="45" width="43" height="9" fill="url(#life-in-weeks-cell)" opacity="0.82"/>
      <rect x="40" y="45" width="9" height="9" fill="url(#life-in-weeks-cell)" opacity="0.4"/>
      <circle cx="44.5" cy="49.5" r="7" fill="none" stroke="#ff6b6b" stroke-width="2.6"/>`,
  },

  /* ---- The Deep Sea ------------------------------------------------------ */
  'deep-sea': {
    // edge-right was already at its cap of three (Deep Time, Life in Weeks,
    // and one more) before this drawing existed, and check-art's "no shared
    // template" pass counts slots across the whole registry, not per game —
    // corner-tr had the most room left.
    subject: 'a shaft of sunlight narrowing into the dark, one small light still descending under it',
    slot: 'corner-tr',
    viewBox: '0 0 90 120',
    palette: ['#bdeaf5', '#3fa7c9', '#155073', '#7ff2d6', '#69c8ff', '#1c2026', '#8a94a0', '#ffe27a'],
    draw: (seed) => {
      const sparks = range(6)
        .map((i) => {
          const x = 6 + rnd(seed, i + 4) * 78
          const y = 82 + rnd(seed, i + 40) * 36
          const c = i % 2 ? '#69c8ff' : '#7ff2d6'
          return (
            `<circle cx="${n(x)}" cy="${n(y)}" r="3.8" fill="${c}" opacity="0.32"/>` +
            `<circle cx="${n(x)}" cy="${n(y)}" r="1.6" fill="${c}" opacity="1"/>`
          )
        })
        .join('')
      return `
        <defs>
          <linearGradient id="deep-sea-shaft" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#bdeaf5"/>
            <stop offset="45%" stop-color="#3fa7c9"/>
            <stop offset="100%" stop-color="#155073"/>
          </linearGradient>
        </defs>
        <path d="M0 0 L90 0 L74 72 Q45 88 16 72 Z" fill="url(#deep-sea-shaft)"/>
        <path d="M10 4 L28 4 L23 58 Q16 68 9 58Z" fill="#bdeaf5" opacity="0.35"/>
        <path d="M58 4 L78 4 L69 62 Q62 72 55 62Z" fill="#bdeaf5" opacity="0.26"/>
        <line x1="45" y1="72" x2="45" y2="92" stroke="#8a94a0" stroke-width="1.6" opacity="0.65"/>
        <circle cx="45" cy="98" r="7" fill="#1c2026"/>
        <circle cx="45" cy="95.6" r="2.6" fill="#ffe27a" opacity="1"/>
        <circle cx="45" cy="95.6" r="5.2" fill="#ffe27a" opacity="0.32"/>
        ${sparks}`
    },
  },
}

/* ---- how each slot is cropped ------------------------------------------- */

/**
 * Slots that cover the whole card get `slice` — scale to fill and crop the
 * overflow — because a tile is roughly 2.4:1 and none of these viewBoxes is.
 * The rest are `meet`, so the object keeps its proportions.
 *
 * band-bottom pins to the bottom-RIGHT and edge-right to the right edge:
 * those two are compositions *against an edge*, and centring them would leave
 * a gap on the side that is supposed to be the anchor. band-bottom is anchored
 * right rather than centred because a 3:1 band in a 2:1 card loses a third of
 * its width, and everything a band-bottom drawing has to say is on the right —
 * centring took the lava off the end of Powder and left dark floor in its
 * place.
 */
export const PRESERVE: Record<Slot, string> = {
  full: 'xMidYMid slice',
  scatter: 'xMidYMid slice',
  right: 'xMidYMid meet',
  'centre-right': 'xMidYMid meet',
  'band-bottom': 'xMidYMax slice',
  'corner-tr': 'xMaxYMin meet',
  'edge-right': 'xMaxYMid meet',
}

/** Every slug that has a drawing. */
export const artSlugs = () => Object.keys(ART)

/** The complete `<svg>` for one game, ready to inline. */
export function artSvg(slug: string, seed = 1): string {
  const a = ART[slug]
  if (!a) return ''
  return (
    `<svg class="art slot-${a.slot}" viewBox="${a.viewBox}" ` +
    `preserveAspectRatio="${PRESERVE[a.slot]}" aria-hidden="true" focusable="false">` +
    `${a.draw(seed)}</svg>`
  )
}

/**
 * Where each slot sits on the card, as percentages of the card.
 *
 * One source of truth, deliberately. The page positions the drawing from
 * these numbers and so does check-art's rasteriser — if they were written
 * twice, the checker would be measuring a layout the site does not have, and
 * would pass a tile whose illustration is sitting on the title.
 *
 * Values outside 0-100 bleed off the edge on purpose.
 */
export const SLOT_BOX: Record<Slot, { l: number; t: number; w: number; h: number }> = {
  full: { l: 0, t: 0, w: 100, h: 100 },
  scatter: { l: 0, t: 0, w: 100, h: 100 },
  right: { l: 52, t: 6, w: 50, h: 92 },
  'centre-right': { l: 56, t: 5, w: 42, h: 90 },
  'band-bottom': { l: 0, t: 22, w: 100, h: 78 },
  'corner-tr': { l: 55, t: -8, w: 48, h: 72 },
  'edge-right': { l: 61, t: 0, w: 39, h: 100 },
}

/**
 * How far across the card a drawing fades in from nothing, as fractions of the
 * card's width.
 *
 * The full-bleed compositions were the ones that failed check-art: a drawing
 * that covers the card necessarily covers the title too, and bright ink under
 * white type took Steady Hand's contrast from 8:1 down to 2.2:1. Rather than
 * shrinking those drawings into a corner — which would have put every tile
 * back on one template, the exact thing this phase exists to undo — they
 * dissolve on the left, under the type, and resolve on the right.
 *
 * The narrow right-hand slots get a short fade too, which is what stops
 * edge-right reading as a panel pasted onto the card with a hard seam.
 *
 * check-art applies these same numbers as an SVG mask before it measures, so
 * what it grades is what ships. `null` means no fade.
 */
export const SLOT_FADE: Record<Slot, [number, number] | null> = {
  full: [0.1, 0.7],
  scatter: [0.1, 0.74],
  'band-bottom': [0.04, 0.66],
  'edge-right': [0.58, 0.74],
  right: [0.5, 0.7],
  'centre-right': [0.54, 0.72],
  'corner-tr': null,
}

/**
 * The fade converted to the drawing element's own coordinate space, since the
 * element is only part of the card. Stops can land outside 0-100%; both CSS
 * gradients and SVG gradients handle that, and clamping them here would move
 * the fade.
 */
export function fadeStops(slot: Slot): [number, number] | null {
  const f = SLOT_FADE[slot]
  if (!f) return null
  const box = SLOT_BOX[slot]
  return [((f[0] * 100 - box.l) / box.w) * 100, ((f[1] * 100 - box.l) / box.w) * 100]
}
