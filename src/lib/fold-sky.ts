/**
 * fold-sky — where you are, given how thick the stack is.
 *
 * The game's argument is that doubling is not a big number, it is a *journey*,
 * and the old page made that argument entirely in text: a beige column with
 * "the observable universe" written next to the top of it. The number went up
 * and nothing else changed.
 *
 * So the page's own backdrop is the altitude. Fold zero is a warm desk; by
 * fold thirty the sheet is past the Kármán line and so is the page; by the
 * last fold there is nothing behind it but other galaxies. It is the same
 * claim the text makes, made by the thing the text is sitting on.
 *
 * One rule holds the whole file together: **the panels stay light.** The
 * obvious design has the cards darken along with the sky, which means that
 * somewhere around fold forty-eight the surface and the ink pass through the
 * same grey and the page is briefly unreadable. Keeping the surfaces light and
 * letting only the world behind them travel means there is no crossing to get
 * wrong — and scripts/check-fold-scene.mjs checks the contrast at every one of
 * the hundred and four folds rather than trusting that.
 */

export type RGB = [number, number, number]

export type Sky = {
  /** Backdrop gradient, top and bottom of the viewport. */
  top: RGB
  bottom: RGB
  /** Panel surface, and the two inks that have to stay legible on it. */
  surface: RGB
  ink: RGB
  inkSoft: RGB
  line: RGB
  /** The one warm accent, cooling as the air runs out. It sets type — the line
   * naming where you are — so it is held to the text threshold, not the 3:1 one. */
  accent: RGB
  /** How much of each layer to draw, 0 to 1. */
  ground: number
  clouds: number
  curve: number
  stars: number
  galaxies: number
  /** What to call where you are. */
  where: string
}

type Stop = {
  /** log10 of the stack height in metres. */
  at: number
  where: string
  top: RGB
  bottom: RGB
  surface: RGB
  ink: RGB
  inkSoft: RGB
  line: RGB
  accent: RGB
  ground: number
  clouds: number
  curve: number
  stars: number
  galaxies: number
}

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
    top: [238, 226, 200], bottom: [214, 195, 152],
    surface: [255, 253, 246], ink: [42, 32, 16], inkSoft: [104, 88, 52], line: [232, 219, 189],
    accent: [146, 104, 26],
    ground: 1, clouds: 0, curve: 0, stars: 0, galaxies: 0,
  },
  {
    at: 0.6, where: 'in the room',
    top: [223, 214, 192], bottom: [190, 176, 145],
    surface: [255, 253, 246], ink: [42, 32, 16], inkSoft: [104, 88, 52], line: [232, 219, 189],
    accent: [146, 104, 26],
    ground: 1, clouds: 0, curve: 0, stars: 0, galaxies: 0,
  },
  {
    at: 1.9, where: 'above the rooftops',
    top: [138, 178, 216], bottom: [206, 224, 233],
    surface: [255, 254, 250], ink: [34, 40, 30], inkSoft: [92, 92, 78], line: [226, 226, 216],
    accent: [136, 102, 30],
    ground: 0.75, clouds: 0.6, curve: 0, stars: 0, galaxies: 0,
  },
  {
    at: 3.4, where: 'up where the weather is',
    top: [80, 132, 190], bottom: [176, 206, 226],
    surface: [253, 253, 252], ink: [30, 38, 44], inkSoft: [86, 94, 102], line: [222, 226, 230],
    accent: [126, 98, 36],
    ground: 0.24, clouds: 1, curve: 0.15, stars: 0, galaxies: 0,
  },
  {
    at: 4.5, where: 'the top of the air',
    top: [28, 56, 106], bottom: [104, 152, 194],
    surface: [251, 252, 254], ink: [26, 34, 44], inkSoft: [82, 92, 104], line: [218, 224, 232],
    accent: [116, 100, 52],
    ground: 0, clouds: 0.5, curve: 0.6, stars: 0.25, galaxies: 0,
  },
  {
    at: 5.6, where: 'in orbit',
    top: [7, 12, 30], bottom: [24, 44, 82],
    surface: [249, 251, 254], ink: [22, 30, 42], inkSoft: [78, 90, 104], line: [214, 222, 232],
    accent: [104, 100, 66],
    ground: 0, clouds: 0.1, curve: 1, stars: 0.7, galaxies: 0,
  },
  {
    at: 9, where: 'out past the planets',
    top: [4, 6, 18], bottom: [10, 16, 38],
    surface: [247, 249, 253], ink: [20, 28, 40], inkSoft: [76, 88, 104], line: [212, 220, 232],
    accent: [92, 102, 84],
    ground: 0, clouds: 0, curve: 0.25, stars: 1, galaxies: 0.1,
  },
  {
    at: 17, where: 'between the stars',
    top: [3, 4, 13], bottom: [7, 9, 26],
    surface: [246, 248, 253], ink: [20, 28, 40], inkSoft: [76, 88, 104], line: [212, 220, 232],
    accent: [84, 100, 104],
    ground: 0, clouds: 0, curve: 0, stars: 1, galaxies: 0.55,
  },
  {
    at: 27, where: 'past everything there is',
    top: [2, 3, 10], bottom: [5, 6, 20],
    surface: [246, 248, 253], ink: [20, 28, 40], inkSoft: [76, 88, 104], line: [212, 220, 232],
    accent: [80, 96, 110],
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
  const f = (k: 'ground' | 'clouds' | 'curve' | 'stars' | 'galaxies') => lerp(a[k], b[k], t)
  return {
    top: mixRGB(a.top, b.top, t),
    bottom: mixRGB(a.bottom, b.bottom, t),
    surface: mixRGB(a.surface, b.surface, t),
    ink: mixRGB(a.ink, b.ink, t),
    inkSoft: mixRGB(a.inkSoft, b.inkSoft, t),
    line: mixRGB(a.line, b.line, t),
    accent: mixRGB(a.accent, b.accent, t),
    ground: f('ground'), clouds: f('clouds'), curve: f('curve'),
    stars: f('stars'), galaxies: f('galaxies'),
    // The name of the place you are leaving until you are most of the way out
    // of it: "in orbit" should not appear the instant you clear the air.
    where: t < 0.55 ? a.where : b.where,
  }
}

export const rgb = (c: RGB) => 'rgb(' + c[0] + ' ' + c[1] + ' ' + c[2] + ')'
export const rgba = (c: RGB, a: number) => 'rgb(' + c[0] + ' ' + c[1] + ' ' + c[2] + ' / ' + a + ')'

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
