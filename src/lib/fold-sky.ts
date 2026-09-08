/**
 * fold-sky — where you are, given how thick the stack is.
 *
 * The game's argument is that doubling is not a big number, it is a *journey*,
 * and the old page made that argument entirely in text: a beige column with
 * "the observable universe" written next to the top of it. The number went up
 * and nothing else changed.
 *
 * So the page's own backdrop is the altitude. Fold zero is a lamplit desk; by
 * fold thirty the sheet is past the Kármán line and so is the page; by the
 * last fold there is nothing behind it but other galaxies.
 *
 * ---------------------------------------------------------------------------
 * The rule that shapes every colour in this file: **the instrument is dark and
 * the paper is the brightest thing on the screen.**
 *
 * The first version of this had it the other way round — light cream panels,
 * dark ink, held light the whole way up so the ink never had to cross the
 * surface. It was safe and it was a mistake. At fold sixty you are between the
 * stars and the page is two white index cards with the galaxies hidden behind
 * them; and the sheet of paper, which is the only object the game is about, is
 * a white shape on a white card. The thing that should glow was camouflaged
 * against the furniture.
 *
 * Turning it over fixes the picture *and* the contrast argument at the same
 * time, which is the tell that it is the right way round. The console is dark
 * at every altitude and the ink is light at every altitude, so the crossing
 * that the old rule was avoiding cannot happen — not "does not happen at the
 * hundred and four points we sampled", cannot. `surfaceMax` and `inkMin` below
 * state the two bands, check-fold-scene.mjs holds every stop to them, and the
 * ratio is then guaranteed rather than observed.
 *
 * What a dark instrument costs is the *other* separation: a dark panel on a
 * sky that travels from daylight to black must, somewhere in the middle, pass
 * through the panel's own value. There is no palette that avoids that. So the
 * panel is not found by its value — it is found by its edge, and `rim` is the
 * colour of that edge. That is how dark interfaces have always worked, and it
 * is checked in place of the old and now impossible test.
 */

export type RGB = [number, number, number]

export type Sky = {
  /** Backdrop gradient, top and bottom of the viewport. */
  top: RGB
  bottom: RGB
  /** The console's face. Always dark — see the note above. */
  surface: RGB
  /** Recesses cut into it: the stage well, the meter grooves, the altimeter track. */
  well: RGB
  /** The two inks. Always light. */
  ink: RGB
  inkSoft: RGB
  /** Hairline dividers inside the console. Decorative; not held to a text ratio. */
  line: RGB
  /**
   * The one warm accent, cooling as the air runs out. It sets type — the line
   * naming where you are — and it is also the fill behind the primary button's
   * label, so it is checked in both directions.
   */
  accent: RGB
  /**
   * The lit edge of the console. This is what separates the panel from the sky
   * once the sky's value passes through the panel's, which it must.
   */
  rim: RGB
  /** How much of each layer to draw, 0 to 1. */
  ground: number
  clouds: number
  curve: number
  stars: number
  galaxies: number
  /** What to call where you are. */
  where: string
}

type Stop = Omit<Sky, 'where'> & { at: number; where: string }

/**
 * The two bands the whole palette lives inside.
 *
 * Every `surface` and `well` sits below the first; every `ink`, `inkSoft`,
 * `accent` and `rim` sits above the second. Because both are convex in
 * luminance under linear interpolation of the stops, nothing between two stops
 * can leave its band either — which is why the contrast holds *everywhere*
 * rather than at the points a checker happens to sample.
 */
export const surfaceMax = 0.03
export const inkMin = 0.07

/**
 * Nine places, and everything between them is interpolated.
 *
 * The heights are real: the Kármán line is 100 km, low orbit a few hundred,
 * the Moon 3.8e8 metres, Proxima 4e16, the Milky Way 1e21, the observable
 * universe 8.8e26. A sheet of paper 0.1 mm thick reaches each of them at the
 * fold the game says it does, because both come from the same doubling.
 */
const STOPS: Stop[] = [
  {
    at: -4, where: 'on the desk',
    top: [40, 29, 20], bottom: [124, 93, 58],
    surface: [30, 24, 18], well: [20, 16, 12],
    ink: [248, 240, 226], inkSoft: [186, 170, 142], line: [62, 51, 38],
    accent: [245, 178, 66], rim: [96, 77, 54],
    ground: 1, clouds: 0, curve: 0, stars: 0, galaxies: 0,
  },
  {
    at: 0.6, where: 'in the room',
    top: [38, 29, 22], bottom: [110, 84, 54],
    surface: [30, 24, 18], well: [20, 16, 12],
    ink: [248, 240, 226], inkSoft: [186, 170, 142], line: [62, 51, 38],
    accent: [245, 178, 66], rim: [96, 77, 54],
    ground: 1, clouds: 0, curve: 0, stars: 0, galaxies: 0,
  },
  {
    // Between the lamplit room and full daylight the backdrop has to travel
    // further than anywhere else on the climb, and it has only five folds to
    // do it in. Without a stop here the sky steps rather than moves.
    at: 1.2, where: 'out of the window',
    top: [56, 58, 72], bottom: [150, 136, 112],
    surface: [30, 25, 21], well: [20, 17, 14],
    ink: [247, 241, 231], inkSoft: [184, 172, 152], line: [61, 52, 42],
    accent: [246, 181, 75], rim: [96, 78, 60],
    ground: 0.95, clouds: 0.25, curve: 0, stars: 0, galaxies: 0,
  },
  {
    at: 2.3, where: 'above the rooftops',
    top: [96, 140, 192], bottom: [208, 212, 202],
    surface: [30, 26, 24], well: [20, 17, 16],
    ink: [246, 242, 236], inkSoft: [182, 174, 162], line: [60, 53, 47],
    accent: [246, 184, 84], rim: [96, 80, 66],
    ground: 0.75, clouds: 0.6, curve: 0, stars: 0, galaxies: 0,
  },
  {
    at: 3.4, where: 'up where the weather is',
    top: [58, 116, 186], bottom: [176, 206, 230],
    surface: [28, 28, 30], well: [18, 18, 21],
    ink: [244, 246, 250], inkSoft: [176, 180, 190], line: [56, 56, 61],
    accent: [248, 190, 100], rim: [88, 88, 96],
    ground: 0.24, clouds: 1, curve: 0.15, stars: 0, galaxies: 0,
  },
  {
    at: 4.5, where: 'the top of the air',
    top: [18, 44, 96], bottom: [86, 138, 190],
    surface: [26, 27, 32], well: [17, 18, 22],
    ink: [242, 245, 252], inkSoft: [170, 176, 192], line: [54, 56, 63],
    accent: [250, 198, 116], rim: [82, 86, 100],
    ground: 0, clouds: 0.5, curve: 0.6, stars: 0.25, galaxies: 0,
  },
  {
    at: 5.6, where: 'in orbit',
    top: [5, 9, 24], bottom: [16, 32, 66],
    surface: [24, 26, 36], well: [15, 17, 24],
    ink: [238, 242, 252], inkSoft: [162, 172, 194], line: [52, 56, 68],
    accent: [252, 206, 132], rim: [78, 86, 106],
    ground: 0, clouds: 0.1, curve: 1, stars: 0.7, galaxies: 0,
  },
  {
    at: 9, where: 'out past the planets',
    top: [3, 4, 14], bottom: [8, 12, 30],
    surface: [24, 26, 38], well: [15, 17, 25],
    ink: [236, 240, 252], inkSoft: [158, 168, 192], line: [52, 56, 70],
    accent: [250, 212, 150], rim: [76, 84, 108],
    ground: 0, clouds: 0, curve: 0.25, stars: 1, galaxies: 0.1,
  },
  {
    at: 17, where: 'between the stars',
    top: [2, 3, 11], bottom: [6, 8, 22],
    surface: [24, 26, 40], well: [15, 17, 26],
    ink: [234, 238, 252], inkSoft: [154, 166, 194], line: [52, 56, 72],
    accent: [214, 206, 255], rim: [74, 82, 114],
    ground: 0, clouds: 0, curve: 0, stars: 1, galaxies: 0.55,
  },
  {
    at: 27, where: 'past everything there is',
    top: [2, 2, 9], bottom: [4, 5, 17],
    surface: [25, 25, 42], well: [16, 16, 28],
    ink: [234, 236, 252], inkSoft: [152, 164, 196], line: [52, 54, 74],
    accent: [198, 200, 255], rim: [74, 80, 120],
    ground: 0, clouds: 0, curve: 0, stars: 1, galaxies: 1,
  },
]

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const mixRGB = (a: RGB, b: RGB, t: number): RGB =>
  [Math.round(lerp(a[0], b[0], t)), Math.round(lerp(a[1], b[1], t)), Math.round(lerp(a[2], b[2], t))]

/** Smoothstep, so the bands arrive and leave rather than switching. */
const ease = (t: number) => t * t * (3 - 2 * t)

/** Where you are, given a stack height in metres. */
export function skyAt(metres: number): Sky {
  const L = Math.log10(Math.max(1e-9, metres))
  let i = 0
  while (i < STOPS.length - 2 && L >= STOPS[i + 1].at) i++
  const a = STOPS[i], b = STOPS[i + 1]
  const t = ease(Math.max(0, Math.min(1, (L - a.at) / (b.at - a.at))))
  const c = (k: 'top' | 'bottom' | 'surface' | 'well' | 'ink' | 'inkSoft' | 'line' | 'accent' | 'rim') =>
    mixRGB(a[k], b[k], t)
  const f = (k: 'ground' | 'clouds' | 'curve' | 'stars' | 'galaxies') => lerp(a[k], b[k], t)
  return {
    top: c('top'), bottom: c('bottom'),
    surface: c('surface'), well: c('well'),
    ink: c('ink'), inkSoft: c('inkSoft'), line: c('line'),
    accent: c('accent'), rim: c('rim'),
    ground: f('ground'), clouds: f('clouds'), curve: f('curve'),
    stars: f('stars'), galaxies: f('galaxies'),
    // The name of the place you are leaving until you are most of the way out
    // of it: "in orbit" should not appear the instant you clear the air.
    where: t < 0.55 ? a.where : b.where,
  }
}

/** Every stop, for a checker that wants the corners rather than a sampling. */
export const stops = (): readonly Stop[] => STOPS

export const rgb = (c: RGB) => 'rgb(' + c[0] + ' ' + c[1] + ' ' + c[2] + ')'
export const rgba = (c: RGB, a: number) => 'rgb(' + c[0] + ' ' + c[1] + ' ' + c[2] + ' / ' + a + ')'

/** Nudge a colour towards black or white. Used for canvas-side shading only. */
export function shade(c: RGB, k: number): RGB {
  const t = k < 0 ? 0 : 255
  const m = Math.abs(k)
  return [
    Math.round(c[0] + (t - c[0]) * m),
    Math.round(c[1] + (t - c[1]) * m),
    Math.round(c[2] + (t - c[2]) * m),
  ]
}

/* -------------------------------------------------------------------------- */
/* The star field                                                             */
/* -------------------------------------------------------------------------- */

export type Star = { x: number; y: number; r: number; a: number; hue: number }

/** Deterministic noise in [0,1). The sky has to be the same sky every frame. */
function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

/**
 * Stars in a unit square, with real colours rather than white dots.
 *
 * The blue ones are rare and the orange ones are common, which is the way
 * round it actually is and the way round nobody draws it.
 */
export function starField(count: number, seed = 1): Star[] {
  const out: Star[] = []
  for (let i = 0; i < count; i++) {
    const m = hash(seed + i * 3.1)
    out.push({
      x: hash(seed + i * 7.3),
      y: hash(seed + i * 11.7),
      r: 0.35 + Math.pow(hash(seed + i * 5.9), 3) * 1.5,
      a: 0.25 + Math.pow(hash(seed + i * 13.3), 1.6) * 0.75,
      hue: m < 0.06 ? 215 : m < 0.2 ? 195 : m < 0.72 ? 45 : 22,
    })
  }
  return out
}

/* -------------------------------------------------------------------------- */
/* Contrast                                                                   */
/* -------------------------------------------------------------------------- */

export function luminance(c: RGB): number {
  const f = (v: number) => {
    const x = v / 255
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])
}

export function contrast(a: RGB, b: RGB): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}
