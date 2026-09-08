/**
 * robot-scene — the pictures the CAPTCHA shows you, and the answer key taken
 * out of them rather than typed in beside them.
 *
 * A real image challenge is a photograph with the thing it asks about
 * somewhere inside it. This is a drawing, so the tempting shape is: draw the
 * picture, then write down which squares the traffic light is in. That is two
 * facts held in step by hand, and they will not stay in step — move the light
 * three pixels and the answer key is quietly wrong, with nothing to say so.
 *
 * So the subject is kept apart from the rest of the scene and carries its own
 * bounding boxes, and `answerCells` works out which squares contain it.
 * scripts/check-robot-scene.mjs then rasterises the scene twice — once with
 * the subject, once without — and checks that the squares whose pixels
 * actually moved are the squares the arithmetic named. Two ways of asking,
 * and they have to agree.
 *
 * There are two keys, not one, and that is the more interesting half. A signal
 * head hanging over the road is in a square or it is not. The pole holding it
 * up clips three more squares on its way to the ground, and whether those
 * "contain a traffic light" is a judgement, not a fact. Real CAPTCHAs grade
 * that judgement as though it were a fact, which is the single thing that
 * makes them infuriating. So `coreCells` is what you must tick, `answerCells`
 * is what you may tick, and the squares in between are yours to decide.
 *
 * The rest of the file is the look. A flat fill reads as a diagram. What reads
 * as a photograph is: one light direction obeyed by everything, converging
 * lines, haze on whatever is far away, occlusion where surfaces meet, a
 * vignette, and grain. None of it is expensive, and all of it is the
 * difference between a picture of a street and a street.
 */

export type Box = { x: number; y: number; w: number; h: number }

export type Scene = {
  /** Side of the square the scene is drawn in. */
  size: number
  /** Gradients the scene refers to. */
  defs: string
  /** Everything that is not the thing being asked about. */
  ground: string
  /** The thing being asked about, alone, so it can be taken away again. */
  subject: string
  /**
   * Every part of the subject, in scene units. Must not overlap each other:
   * `coverage` adds them up, and a shared corner would be counted twice.
   */
  bounds: Box[]
  /** The part of it nobody could argue about. A subset of the above. */
  core: Box[]
}

/**
 * How much of a square the subject must fill before that square may be ticked.
 * Below this the subject is grazing a corner, and a player who ticks it is
 * wrong.
 *
 * The number is arbitrary. What is not arbitrary is that no square in any
 * scene here lands near it — the checker asserts every square is well over or
 * well under, so neither key turns on this constant.
 */
export const MIN_COVER = 0.045

/* ------------------------------------------------------------------------ */
/* Geometry                                                                  */
/* ------------------------------------------------------------------------ */

/** The window an n x n grid's cell `i` looks at, in scene units. */
export function cellBox(size: number, n: number, i: number): Box {
  const s = size / n
  return { x: (i % n) * s, y: Math.floor(i / n) * s, w: s, h: s }
}

function overlap(a: Box, b: Box): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
  return w > 0 && h > 0 ? w * h : 0
}

function cover(boxes: Box[], size: number, n: number, i: number): number {
  const cell = cellBox(size, n, i)
  let hit = 0
  for (const b of boxes) hit += overlap(cell, b)
  return hit / (cell.w * cell.h)
}

/** The fraction of cell `i` the whole subject fills. */
export function coverage(scene: Scene, n: number, i: number): number {
  return cover(scene.bounds, scene.size, n, i)
}

/** The squares that may be ticked. */
export function answerCells(scene: Scene, n = 3, min = MIN_COVER): number[] {
  const out: number[] = []
  for (let i = 0; i < n * n; i++) if (coverage(scene, n, i) >= min) out.push(i)
  return out
}

/** The squares that must be ticked. */
export function coreCells(scene: Scene, n = 3, min = MIN_COVER): number[] {
  const out: number[] = []
  for (let i = 0; i < n * n; i++) if (cover(scene.core, scene.size, n, i) >= min) out.push(i)
  return out
}

export type Mark = { ok: boolean; missed: number[]; wrong: number[] }

/** Mark a selection: every core square, no square outside the answer. */
export function mark(scene: Scene, chosen: Iterable<number>, n = 3): Mark {
  const set = new Set(chosen)
  const missed = coreCells(scene, n).filter((i) => !set.has(i))
  const allowed = new Set(answerCells(scene, n))
  const wrong = [...set].filter((i) => !allowed.has(i)).sort((a, b) => a - b)
  return { ok: missed.length === 0 && wrong.length === 0, missed, wrong }
}

/* ------------------------------------------------------------------------ */
/* Rendering                                                                 */
/* ------------------------------------------------------------------------ */

/**
 * The whole scene as one SVG. `withSubject` false is what the checker diffs
 * against, and is never shown to anybody.
 */
export function sceneSvg(scene: Scene, withSubject = true): string {
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + scene.size + ' ' + scene.size + '" ' +
    'width="' + scene.size + '" height="' + scene.size + '">' +
    '<defs>' + scene.defs + '</defs>' +
    '<g filter="url(#rs-grade)">' +
    scene.ground +
    (withSubject ? scene.subject : '') +
    '</g>' +
    GRAIN_RECT +
    '</svg>'
  )
}

/**
 * Grain. One octave rather than three: at this size the extra octaves are
 * invisible and the filter runs once per tile, nine times over.
 */
export const GRAIN_DEFS =
  '<filter id="rs-grain" filterUnits="userSpaceOnUse" x="0" y="0" ' +
  'width="300" height="300" color-interpolation-filters="sRGB">' +
  '<feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="11" result="n"/>' +
  '<feColorMatrix in="n" type="saturate" values="0.12"/>' +
  '<feComponentTransfer><feFuncA type="linear" slope="0.9" intercept="-0.4"/></feComponentTransfer>' +
  '</filter>'

/**
 * How the street is encoded for the page. Kept here rather than in the
 * endpoint so the checker can measure the artefact that actually ships rather
 * than an approximation of it.
 */
export const STREET_JPEG = { width: 900, quality: 82, maxBytes: 120_000 }

/** The grain layer, over everything. */
export const GRAIN_RECT =
  '<rect width="300" height="300" filter="url(#rs-grain)" opacity="0.55"/>'

/* ------------------------------------------------------------------------ */
/* Perspective                                                               */
/* ------------------------------------------------------------------------ */

/** Deterministic noise in [0,1). Scenes must render the same every time. */
function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

const HORIZON = 148
/** How much taller than eye level a building along this street is. */
const STOREYS = 3.0

const f1 = (n: number) => n.toFixed(1)
const shrink = (p: number[][], f: number) => {
  const cx = p.reduce((a, q) => a + q[0], 0) / p.length
  const cy = p.reduce((a, q) => a + q[1], 0) / p.length
  return p.map((q) => [q[0] + (cx - q[0]) * f, q[1] + (cy - q[1]) * f])
}
const quad = (p: number[][], fill: string, extra = '') =>
  '<path d="M' + p.map((q) => f1(q[0]) + ' ' + f1(q[1])).join('L') + 'Z" fill="' + fill + '"' +
  (extra ? ' ' + extra : '') + '/>'

/** A line receding to the vanishing point, sampled at a screen height. */
type Rail = { x0: number; x1: number }
const railX = (r: Rail, y: number) => r.x0 + ((y - HORIZON) / (300 - HORIZON)) * (r.x1 - r.x0)

const KERB_L: Rail = { x0: 166, x1: -10 }
const KERB_R: Rail = { x0: 178, x1: 330 }
const WALL_L: Rail = { x0: 156, x1: -80 }
const WALL_R: Rail = { x0: 190, x1: 430 }
/** Where the sun stops. Everything right of this line is in the buildings' shade. */
const SHADE: Rail = { x0: 174, x1: 104 }

/** Roof height for a building whose base meets the ground at screen y. */
const roofY = (y: number) => HORIZON - (y - HORIZON) * STOREYS

/** How big a thing standing at screen depth `y` appears. 0 at the horizon, 1 underfoot. */
const sc = (y: number) => (y - HORIZON) / (300 - HORIZON)

/**
 * Screen height at a fraction of the way between two depths. Interpolating y
 * directly would space things evenly on the screen, which is exactly what
 * perspective does not do; 1/(y - horizon) is linear in real distance, so the
 * interpolation happens there and comes back.
 */
function depthLerp(yFar: number, yNear: number, t: number): number {
  const wf = 1 / (yFar - HORIZON)
  const wn = 1 / (yNear - HORIZON)
  return HORIZON + 1 / (wf + (wn - wf) * t)
}

/* ------------------------------------------------------------------------ */
/* Materials                                                                 */
/* ------------------------------------------------------------------------ */

/**
 * A multiply-texture filter. This is the whole trick, and it is the difference
 * between a drawing of a street and a photograph of one: real surfaces are not
 * one colour with a gradient over them, they are one colour with several
 * octaves of dirt over them.
 *
 * `color-interpolation-filters="sRGB"` matters more than it looks. The default
 * is linearRGB, which is correct for compositing light and wrong for this —
 * turbulence authored to look like grit comes out washed and grey, and the
 * temptation is then to crank the contrast until it looks like static.
 */
function texture(id: string, fx: number, fy: number, octaves: number, seed: number, depth: number) {
  return (
    // No filter region override: resvg composites two primitives only when
    // they were computed over the same region, and giving the turbulence its
    // own padding is enough to make them disagree.
    '<filter id="' + id + '" color-interpolation-filters="sRGB">' +
    '<feTurbulence type="fractalNoise" baseFrequency="' + fx + ' ' + fy + '" numOctaves="' +
    octaves + '" seed="' + seed + '" result="n"/>' +
    '<feColorMatrix in="n" type="saturate" values="0" result="g"/>' +
    // Grey noise centred on 1.0, so multiplying by it darkens and lightens
    // about the surface colour rather than only darkening it.
    '<feComponentTransfer in="g" result="m">' +
    '<feFuncR type="linear" slope="' + depth + '" intercept="' + (1 - depth / 2).toFixed(3) + '"/>' +
    '<feFuncG type="linear" slope="' + depth + '" intercept="' + (1 - depth / 2).toFixed(3) + '"/>' +
    '<feFuncB type="linear" slope="' + depth + '" intercept="' + (1 - depth / 2).toFixed(3) + '"/>' +
    '<feFuncA type="linear" slope="0" intercept="1"/>' +
    '</feComponentTransfer>' +
    '<feComposite in="m" in2="SourceGraphic" operator="arithmetic" k1="1" k2="0" k3="0" k4="0"/>' +
    '</filter>'
  )
}

const MATERIALS =
  // Asphalt is the coarsest thing in the picture and the largest area of it.
  texture('rs-asphalt', 0.62, 1.15, 3, 3, 0.95) +
  // The same asphalt, two and a half times finer. A filter works in screen
  // space, so one texture over the whole road paints chippings the same size
  // underfoot and a hundred metres away — which is exactly what perspective
  // does not do, and it is the sort of wrongness you feel without locating.
  texture('rs-asphalt-far', 1.6, 2.9, 3, 3, 0.72) +
  texture('rs-concrete', 0.26, 0.34, 3, 17, 0.5) +
  // Stretched sideways, which is what a brick course does to noise.
  texture('rs-brick', 0.3, 1.05, 3, 41, 0.62) +
  texture('rs-plaster', 0.42, 0.42, 3, 63, 0.42) +
  texture('rs-walk', 0.75, 0.48, 3, 91, 0.46) +
  texture('rs-metal', 0.06, 0.9, 3, 7, 0.42) +
  texture('rs-leaf', 0.45, 0.45, 4, 29, 1.6) +
  // Air, not glass: everything at the end of the street goes slightly soft,
  // and it is atmosphere doing it rather than the lens. A street photograph is
  // sharp nearly everywhere, so this is small on purpose — a real depth-of-
  // field blur out there would read as a tilt-shift toy.
  '<filter id="rs-far" x="-4%" y="-4%" width="108%" height="108%" ' +
  'color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="0.55"/></filter>' +
  '<filter id="rs-mid" x="-4%" y="-4%" width="108%" height="108%" ' +
  'color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="0.22"/></filter>' +
  // Bloom: bright sky bleeding over the edges it meets. Every photograph of a
  // street against a bright sky has this and no drawing of one ever does.
  '<filter id="rs-bloom" x="-15%" y="-15%" width="130%" height="130%" ' +
  'color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="3"/>' +
  '<feComponentTransfer><feFuncA type="linear" slope="0.4"/></feComponentTransfer></filter>'

/**
 * The grade, over the finished frame. Black is lifted to 0.045 because a
 * photograph does not contain black — light scatters inside the lens and puts
 * a floor under the shadows — and the single fastest way to make a render look
 * rendered is to leave that floor at zero.
 */
const GRADE =
  '<filter id="rs-grade" filterUnits="userSpaceOnUse" x="0" y="0" ' +
  'width="300" height="300" color-interpolation-filters="sRGB">' +
  '<feComponentTransfer in="SourceGraphic">' +
  '<feFuncR type="table" tableValues="0.042 0.175 0.405 0.660 0.870 0.972"/>' +
  '<feFuncG type="table" tableValues="0.040 0.172 0.402 0.660 0.872 0.975"/>' +
  '<feFuncB type="table" tableValues="0.055 0.190 0.408 0.648 0.855 0.960"/>' +
  '</feComponentTransfer>' +
  '<feColorMatrix type="saturate" values="1.04" result="tone"/>' +
  // A slow, shallow mottle over the whole frame. Every shape in this picture
  // has one colour inside it, and nothing in a photograph does — weathering,
  // dirt and uneven light break up every surface at a scale much larger than
  // grain. One low-frequency layer over the finished frame does that to all of
  // them at once, which is far cheaper than doing it to each.
  '<feTurbulence type="fractalNoise" baseFrequency="0.014" numOctaves="2" seed="23" result="bn"/>' +
  '<feColorMatrix in="bn" type="saturate" values="0" result="bg"/>' +
  '<feComponentTransfer in="bg" result="bm">' +
  '<feFuncR type="linear" slope="0.34" intercept="0.83"/>' +
  '<feFuncG type="linear" slope="0.34" intercept="0.83"/>' +
  '<feFuncB type="linear" slope="0.34" intercept="0.83"/>' +
  '<feFuncA type="linear" slope="0" intercept="1"/>' +
  '</feComponentTransfer>' +
  '<feComposite in="bm" in2="tone" operator="arithmetic" k1="1" k2="0" k3="0" k4="0"/>' +
  // A lens and a sensor put about a pixel of softness on everything, and a
  // vector render is the only picture in the world with none. Perfectly hard
  // edges everywhere is the tell that survives every other improvement.
  '<feGaussianBlur stdDeviation="0.26"/>' +
  '</filter>'

/* ------------------------------------------------------------------------ */
/* Buildings                                                                 */
/* ------------------------------------------------------------------------ */

type Storey = { fill: string; tex: string; glass: string }

/**
 * One building face, seen at an angle, with its windows converging along with
 * it. The windows are not all the same window: some are lit, some have blinds
 * half down, some are dark, and the sky sits in them at different strengths.
 * A wall where every pane matches is wallpaper, and it is the tell that
 * survives every other improvement.
 */
function facade(
  rail: Rail, yFar: number, yNear: number, m: Storey, cols: number, seed: number, lit: boolean,
): string {
  const xf = railX(rail, yFar), xn = railX(rail, yNear)
  const tf = roofY(yFar), tn = roofY(yNear)
  const shell = [[xf, tf], [xn, tn], [xn, yNear], [xf, yFar]]
  let s = '<g filter="url(#' + m.tex + ')">' + quad(shell, m.fill) + '</g>'

  // A parapet along the roofline catches the sky and separates one building
  // from the next more convincingly than an outline would.
  s += quad([[xf, tf], [xn, tn], [xn, tn + 4], [xf, tf + 2]], '#ffffff', 'opacity="0.2"')

  const rows = 5
  for (let c = 0; c < cols; c++)
    for (let r = 0; r < rows; r++) {
      const t0 = (c + 0.2) / cols, t1 = (c + 0.8) / cols
      const y0 = depthLerp(yFar, yNear, t0), y1 = depthLerp(yFar, yNear, t1)
      const x0 = railX(rail, y0), x1 = railX(rail, y1)
      const a = 0.07 + r * 0.155, b = a + 0.105
      const at = (y: number, k: number) => roofY(y) + (y - roofY(y)) * k
      const pane = [[x0, at(y0, a)], [x1, at(y1, a)], [x1, at(y1, b)], [x0, at(y0, b)]]
      const k = hash(seed + c * 7 + r * 13)
      const k2 = hash(seed * 3 + c * 11 + r * 5)

      // The opening, then the glass set back inside it.
      s += quad(pane, '#2a2f36', 'opacity="0.92"')
      const glassPane = shrink(pane, 0.22)
      s += quad(glassPane, '#222c37', 'opacity="' + (0.66 + k * 0.28).toFixed(2) + '"')
      if (k2 > 0.86) {
        // A light on inside. Two or three of these across a whole street is
        // what stops the buildings reading as a model of a street.
        s += quad(glassPane, '#ffdca8', 'opacity="' + (0.4 + k * 0.35).toFixed(2) + '"')
      } else if (k2 > 0.62) {
        // Blinds, halfway. Drawn as the top half of the pane, paler.
        const mid = [
          [x0, at(y0, a)], [x1, at(y1, a)],
          [x1, at(y1, a + (b - a) * (0.3 + k * 0.4))], [x0, at(y0, a + (b - a) * (0.3 + k * 0.4))],
        ]
        s += quad(mid, '#c9cdd2', 'opacity="0.5"')
      }
      s += quad(glassPane, 'url(#rs-glass)', 'opacity="' + (0.12 + k * 0.7).toFixed(2) + '"')
      // The underside of the head catches nothing; the top of the sill catches
      // the sky. Two one-pixel quads, and the wall gains a thickness.
      s += quad([pane[0], pane[1], glassPane[1], glassPane[0]], '#12181f', 'opacity="0.5"')
      s += quad([glassPane[3], glassPane[2], pane[2], pane[3]], '#efe9dc', 'opacity="0.42"')
      // A sill, and the stain that runs down from it. Rain does this to every
      // building ever built and nobody draws it.
      s += quad([[x0, at(y0, b)], [x1, at(y1, b)], [x1, at(y1, b + 0.012)], [x0, at(y0, b + 0.012)]],
        '#e8e3d8', 'opacity="0.4"')
      if (k > 0.45)
        s += quad([[x0, at(y0, b)], [x1, at(y1, b)], [x1, at(y1, b + 0.1)], [x0, at(y0, b + 0.1)]],
          '#1d2833', 'opacity="' + (0.05 + k * 0.09).toFixed(2) + '"')
    }

  for (let r = 1; r < rows; r++) {
    const a = 0.07 + r * 0.155 - 0.026
    const at0 = (y: number, k: number) => roofY(y) + (y - roofY(y)) * k
    s += quad([[xf, at0(yFar, a)], [xn, at0(yNear, a)],
      [xn, at0(yNear, a + 0.007)], [xf, at0(yFar, a + 0.007)]], '#ffffff', 'opacity="0.13"')
    s += quad([[xf, at0(yFar, a + 0.007)], [xn, at0(yNear, a + 0.007)],
      [xn, at0(yNear, a + 0.016)], [xf, at0(yFar, a + 0.016)]], '#1b232c', 'opacity="0.16"')
  }

  // Ground floor: shopfront glazing, a signage band over it, and an awning on
  // some of them.
  const g0 = 0.855
  const at = (y: number, k: number) => roofY(y) + (y - roofY(y)) * k
  s += quad([[xf, at(yFar, g0)], [xn, at(yNear, g0)], [xn, yNear], [xf, yFar]], '#2a2530', 'opacity="0.78"')
  s += quad([[xf, at(yFar, g0)], [xn, at(yNear, g0)], [xn, at(yNear, g0 + 0.03)], [xf, at(yFar, g0 + 0.03)]],
    hash(seed) > 0.5 ? '#8e4b3f' : '#3d5a52', 'opacity="0.85"')
  s += quad([[xf, at(yFar, g0 + 0.05)], [xn, at(yNear, g0 + 0.05)], [xn, yNear - 2], [xf, yFar - 1]],
    'url(#rs-glass)', 'opacity="0.3"')

  s += quad(shell, 'url(#rs-ao)')
  // The one rule the whole picture obeys: this side faces the sun and that one
  // does not. Sunlight is warm, and the light filling a shadow is the sky, so
  // the two sides of a street are different colours as well as different
  // brightnesses — and it is the colour difference people read, not the
  // brightness.
  s += quad(shell, lit ? '#ffdba2' : '#2c4463', lit ? 'opacity="0.11"' : 'opacity="0.17"')
  return s
}

/** Boxes, aerials and a tank on a roofline. Nobody looks at it; everybody would miss it. */
function roofClutter(rail: Rail, y: number, seed: number): string {
  const x = railX(rail, y), top = roofY(y), k = sc(y)
  let s = ''
  const w = 26 * k, h = 11 * k
  s += '<rect x="' + f1(x - w * 0.2) + '" y="' + f1(top - h) + '" width="' + f1(w * 0.5) +
    '" height="' + f1(h) + '" fill="#6a7078" opacity="0.9"/>'
  if (hash(seed) > 0.4) {
    s += '<rect x="' + f1(x + w * 0.4) + '" y="' + f1(top - h * 1.9) + '" width="' + f1(w * 0.32) +
      '" height="' + f1(h * 1.9) + '" rx="' + f1(w * 0.16) + '" fill="#5d646c" opacity="0.9"/>'
  }
  s += '<path d="M' + f1(x + w * 0.14) + ' ' + f1(top) + ' v' + f1(-h * 2.6) +
    '" stroke="#4a5058" stroke-width="' + f1(Math.max(0.5, 1.1 * k)) + '" fill="none"/>'
  return s
}

/* ------------------------------------------------------------------------ */
/* Things standing in the street                                             */
/* ------------------------------------------------------------------------ */

/** A parked car, at a depth, against a kerb. */
function car(y: number, rail: Rail, inward: number, body: string, seed: number): string {
  const k = sc(y)
  const W = 96 * k, H = 30 * k
  const cx = railX(rail, y) + inward * W * 0.55
  const x = cx - W / 2, top = y - H
  const r = Math.max(1, 4 * k)
  let s = '<ellipse cx="' + f1(cx) + '" cy="' + f1(y + H * 0.06) + '" rx="' + f1(W * 0.54) +
    '" ry="' + f1(Math.max(1.2, H * 0.16)) + '" fill="#131820" opacity="0.42"/>'
  s += '<path d="M' + f1(x) + ' ' + f1(y) + ' v' + f1(-H * 0.55) + ' q0 ' + f1(-H * 0.26) + ' ' +
    f1(W * 0.09) + ' ' + f1(-H * 0.3) + ' l' + f1(W * 0.13) + ' ' + f1(-H * 0.45) + ' q' +
    f1(W * 0.03) + ' ' + f1(-H * 0.14) + ' ' + f1(W * 0.09) + ' ' + f1(-H * 0.14) + ' h' +
    f1(W * 0.3) + ' q' + f1(W * 0.06) + ' 0 ' + f1(W * 0.09) + ' ' + f1(H * 0.14) + ' l' +
    f1(W * 0.13) + ' ' + f1(H * 0.45) + ' q' + f1(W * 0.09) + ' ' + f1(H * 0.04) + ' ' +
    f1(W * 0.09) + ' ' + f1(H * 0.3) + ' v' + f1(H * 0.55) + ' z" fill="' + body + '"/>'
  // Glass, and the sky in it.
  s += '<path d="M' + f1(x + W * 0.26) + ' ' + f1(top + H * 0.02) + ' h' + f1(W * 0.44) + ' l' +
    f1(W * 0.1) + ' ' + f1(H * 0.42) + ' h' + f1(-W * 0.64) + ' z" fill="#2e3d49" opacity="0.9"/>'
  s += '<path d="M' + f1(x + W * 0.28) + ' ' + f1(top + H * 0.05) + ' h' + f1(W * 0.14) + ' l' +
    f1(-W * 0.08) + ' ' + f1(H * 0.36) + ' h' + f1(-W * 0.13) + ' z" fill="#b9d5e8" opacity="0.5"/>'
  // A highlight along the shoulder, wheels, and lights.
  s += '<rect x="' + f1(x) + '" y="' + f1(y - H * 0.5) + '" width="' + f1(W) + '" height="' +
    f1(Math.max(0.6, H * 0.05)) + '" fill="#fff" opacity="0.24"/>'
  for (const wx of [x + W * 0.2, x + W * 0.8]) {
    s += '<circle cx="' + f1(wx) + '" cy="' + f1(y - H * 0.04) + '" r="' + f1(r * 1.5) + '" fill="#15181d"/>'
    s += '<circle cx="' + f1(wx) + '" cy="' + f1(y - H * 0.04) + '" r="' + f1(r * 0.62) + '" fill="#7b8189"/>'
  }
  if (hash(seed) > 0.5)
    s += '<rect x="' + f1(x) + '" y="' + f1(y - H * 0.42) + '" width="' + f1(W * 0.06) +
      '" height="' + f1(H * 0.1) + '" rx="' + f1(W * 0.02) + '" fill="#ff6a52" opacity="0.9"/>'
  return s
}

/** A lamp standard: post, curved arm, head. */
function lamp(y: number, rail: Rail, dir: number): string {
  const k = sc(y)
  const x = railX(rail, y)
  const H = 150 * k, arm = 34 * k
  const w = Math.max(0.7, 4 * k)
  let s = '<ellipse cx="' + f1(x) + '" cy="' + f1(y) + '" rx="' + f1(Math.max(1.5, 7 * k)) +
    '" ry="' + f1(Math.max(0.6, 2.2 * k)) + '" fill="#131820" opacity="0.34"/>'
  s += '<rect x="' + f1(x - w / 2) + '" y="' + f1(y - H) + '" width="' + f1(w) + '" height="' +
    f1(H) + '" fill="url(#rs-pole)"/>'
  s += '<path d="M' + f1(x) + ' ' + f1(y - H) + ' q' + f1(dir * arm * 0.6) + ' ' + f1(-arm * 0.45) +
    ' ' + f1(dir * arm) + ' ' + f1(-arm * 0.06) + '" fill="none" stroke="#5a6167" stroke-width="' +
    f1(w * 0.8) + '"/>'
  s += '<ellipse cx="' + f1(x + dir * arm) + '" cy="' + f1(y - H - arm * 0.02) + '" rx="' +
    f1(Math.max(1.2, 7 * k)) + '" ry="' + f1(Math.max(0.5, 2.6 * k)) + '" fill="#9aa2a8"/>'
  return s
}

/** A street tree: trunk, and a canopy of overlapping blobs under a leaf texture. */
function tree(y: number, rail: Rail, inward: number, seed: number): string {
  const k = sc(y)
  const x = railX(rail, y) + inward * 14 * k
  const H = 130 * k
  let s = '<ellipse cx="' + f1(x) + '" cy="' + f1(y) + '" rx="' + f1(14 * k) + '" ry="' +
    f1(Math.max(0.8, 4 * k)) + '" fill="#131820" opacity="0.36"/>'
  s += '<path d="M' + f1(x - 2.6 * k) + ' ' + f1(y) + ' l' + f1(1.4 * k) + ' ' + f1(-H * 0.55) +
    ' h' + f1(2.4 * k) + ' l' + f1(1.4 * k) + ' ' + f1(H * 0.55) + ' z" fill="#4a3b30"/>'
  s += '<g filter="url(#rs-leaf)">'
  for (let i = 0; i < 7; i++) {
    const a = hash(seed + i) * Math.PI * 2
    const rr = 16 * k * (0.55 + hash(seed * 2 + i) * 0.6)
    s += '<circle cx="' + f1(x + Math.cos(a) * 15 * k) + '" cy="' +
      f1(y - H * 0.72 + Math.sin(a) * 12 * k) + '" r="' + f1(rr) + '" fill="' +
      (i % 3 === 0 ? '#4e6b3c' : i % 3 === 1 ? '#5c7a45' : '#3e5a33') + '"/>'
  }
  s += '</g>'
  return s
}

/** Somebody, small, a long way off. */
function person(y: number, rail: Rail, inward: number, coat: string): string {
  const k = sc(y)
  const x = railX(rail, y) + inward * 10 * k
  const H = 62 * k
  let s = '<ellipse cx="' + f1(x) + '" cy="' + f1(y) + '" rx="' + f1(Math.max(0.8, 4 * k)) +
    '" ry="' + f1(Math.max(0.4, 1.4 * k)) + '" fill="#131820" opacity="0.34"/>'
  s += '<rect x="' + f1(x - H * 0.1) + '" y="' + f1(y - H * 0.55) + '" width="' + f1(H * 0.2) +
    '" height="' + f1(H * 0.55) + '" rx="' + f1(H * 0.05) + '" fill="#2f3540"/>'
  s += '<rect x="' + f1(x - H * 0.13) + '" y="' + f1(y - H * 0.86) + '" width="' + f1(H * 0.26) +
    '" height="' + f1(H * 0.36) + '" rx="' + f1(H * 0.09) + '" fill="' + coat + '"/>'
  s += '<circle cx="' + f1(x) + '" cy="' + f1(y - H * 0.92) + '" r="' + f1(H * 0.09) + '" fill="#c99873"/>'
  return s
}

/* ------------------------------------------------------------------------ */
/* The street                                                                */
/* ------------------------------------------------------------------------ */

const STREET_DEFS =
  MATERIALS + GRADE + GRAIN_DEFS +
  // Sky: deeper overhead, hazier at the horizon, which is what air does.
  '<linearGradient id="rs-sky" x1="0" y1="0" x2="0.15" y2="1">' +
  '<stop offset="0" stop-color="#4d86bd"/><stop offset="0.42" stop-color="#8fb8d8"/>' +
  '<stop offset="0.8" stop-color="#c9dbe3"/><stop offset="1" stop-color="#e7e4d9"/></linearGradient>' +
  '<radialGradient id="rs-cloud"><stop offset="0" stop-color="#fff" stop-opacity="0.9"/>' +
  '<stop offset="0.5" stop-color="#fff" stop-opacity="0.32"/>' +
  '<stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>' +
  // The sun is off the top right, so everything in the picture is lit from
  // there and every shadow falls to the left.
  '<radialGradient id="rs-sun"><stop offset="0" stop-color="#fff8e6" stop-opacity="0.95"/>' +
  '<stop offset="0.32" stop-color="#ffeecb" stop-opacity="0.4"/>' +
  '<stop offset="1" stop-color="#ffe9c0" stop-opacity="0"/></radialGradient>' +
  '<linearGradient id="rs-glass" x1="0" y1="0" x2="0.6" y2="1">' +
  '<stop offset="0" stop-color="#cfe0ee"/><stop offset="0.48" stop-color="#7f9db4" stop-opacity="0.42"/>' +
  '<stop offset="1" stop-color="#1d2831" stop-opacity="0"/></linearGradient>' +
  // Painted over every facade: dark at pavement level, clear up top.
  '<linearGradient id="rs-ao" x1="0" y1="0" x2="0" y2="1">' +
  '<stop offset="0" stop-color="#0d1620" stop-opacity="0"/>' +
  '<stop offset="0.6" stop-color="#0d1620" stop-opacity="0.09"/>' +
  '<stop offset="1" stop-color="#0d1620" stop-opacity="0.4"/></linearGradient>' +
  '<linearGradient id="rs-road" x1="0" y1="0" x2="0" y2="1">' +
  '<stop offset="0" stop-color="#8b8d92"/><stop offset="0.2" stop-color="#63656b"/>' +
  '<stop offset="0.6" stop-color="#4b4c52"/><stop offset="1" stop-color="#3b3c42"/></linearGradient>' +
  '<linearGradient id="rs-walkg" x1="0" y1="0" x2="0" y2="1">' +
  '<stop offset="0" stop-color="#b6b3a9"/><stop offset="0.5" stop-color="#a3a096"/>' +
  '<stop offset="1" stop-color="#8b8880"/></linearGradient>' +
  // A pole is a cylinder, and a cylinder is four tones across its width.
  '<linearGradient id="rs-pole" x1="0" y1="0" x2="1" y2="0">' +
  '<stop offset="0" stop-color="#33383c"/><stop offset="0.3" stop-color="#7b8288"/>' +
  '<stop offset="0.55" stop-color="#565d62"/><stop offset="1" stop-color="#2c3134"/></linearGradient>' +
  '<linearGradient id="rs-case" x1="0" y1="0" x2="1" y2="0">' +
  '<stop offset="0" stop-color="#171b1e"/><stop offset="0.22" stop-color="#333a3f"/>' +
  '<stop offset="0.7" stop-color="#1d2225"/><stop offset="1" stop-color="#0f1214"/></linearGradient>' +
  '<radialGradient id="rs-lamp-red" cx="0.38" cy="0.3">' +
  '<stop offset="0" stop-color="#ffe2d2"/><stop offset="0.26" stop-color="#f8624a"/>' +
  '<stop offset="1" stop-color="#9c1810"/></radialGradient>' +
  '<radialGradient id="rs-glow"><stop offset="0" stop-color="#ff7050" stop-opacity="0.5"/>' +
  '<stop offset="1" stop-color="#ff7050" stop-opacity="0"/></radialGradient>' +
  // The corners of a photograph are always darker than the middle.
  '<radialGradient id="rs-vig" cx="0.5" cy="0.45" r="0.74">' +
  '<stop offset="0.5" stop-color="#000" stop-opacity="0"/>' +
  '<stop offset="1" stop-color="#0a1018" stop-opacity="0.32"/></radialGradient>' +
  // Distance is not just smaller. It is paler, and bluer.
  // Shade is not "the same colour, darker". Sunlight is warm and the light in
  // a shadow is sky, so a shadow on a street is bluer than what is beside it.
  '<linearGradient id="rs-shade" x1="0" y1="0" x2="0" y2="1">' +
  '<stop offset="0" stop-color="#20344a" stop-opacity="0.2"/>' +
  '<stop offset="1" stop-color="#16283e" stop-opacity="0.52"/></linearGradient>' +
  // And the other half has to be lit, or the shadow has nothing to be darker
  // than. This is the warm wash on everything the sun still reaches.
  '<linearGradient id="rs-lit" x1="0" y1="0" x2="0" y2="1">' +
  '<stop offset="0" stop-color="#ffe6b8" stop-opacity="0.06"/>' +
  '<stop offset="1" stop-color="#ffdca0" stop-opacity="0.17"/></linearGradient>' +
  // Fades the fine road texture out as the road comes towards the camera. A
  // gradient over the whole surface rather than a band with an edge: two
  // different noise frequencies meeting along a line draw that line.
  '<linearGradient id="rs-farfade" gradientUnits="userSpaceOnUse" ' +
  'x1="0" y1="' + HORIZON + '" x2="0" y2="266">' +
  '<stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>' +
  '<mask id="rs-farmask" maskUnits="userSpaceOnUse" x="0" y="0" width="300" height="300">' +
  '<rect y="' + HORIZON + '" width="300" height="' + (300 - HORIZON) +
  '" fill="url(#rs-farfade)"/></mask>' +
  '<linearGradient id="rs-haze" x1="0" y1="0" x2="0" y2="1">' +
  '<stop offset="0" stop-color="#dceaf1" stop-opacity="0"/>' +
  '<stop offset="0.46" stop-color="#dceaf1" stop-opacity="0.34"/>' +
  '<stop offset="0.62" stop-color="#dceaf1" stop-opacity="0.2"/>' +
  '<stop offset="1" stop-color="#dceaf1" stop-opacity="0"/></linearGradient>'

/** Ground depths of the building corners, far to near. */
const DEPTHS = [156, 164, 176, 196, 230, 300]

const LEFT: Storey[] = [
  { fill: '#94a7b4', tex: 'rs-concrete', glass: '' },
  { fill: '#a88a76', tex: 'rs-brick', glass: '' },
  { fill: '#95705d', tex: 'rs-brick', glass: '' },
  { fill: '#8b9295', tex: 'rs-concrete', glass: '' },
  { fill: '#7c5645', tex: 'rs-brick', glass: '' },
]
const RIGHT: Storey[] = [
  { fill: '#7d8d99', tex: 'rs-concrete', glass: '' },
  { fill: '#6a5b52', tex: 'rs-brick', glass: '' },
  { fill: '#575e64', tex: 'rs-plaster', glass: '' },
  { fill: '#6b6156', tex: 'rs-brick', glass: '' },
  { fill: '#3a3e43', tex: 'rs-concrete', glass: '' },
]

function sky(): string {
  let s = '<rect width="300" height="300" fill="url(#rs-sky)"/>'
  s += '<ellipse cx="288" cy="4" rx="150" ry="118" fill="url(#rs-sun)"/>'
  s += '<ellipse cx="62" cy="38" rx="72" ry="17" fill="url(#rs-cloud)"/>'
  s += '<ellipse cx="108" cy="28" rx="42" ry="11" fill="url(#rs-cloud)" opacity="0.72"/>'
  s += '<ellipse cx="212" cy="62" rx="62" ry="13" fill="url(#rs-cloud)" opacity="0.48"/>'
  s += '<ellipse cx="150" cy="98" rx="90" ry="12" fill="url(#rs-cloud)" opacity="0.3"/>'
  return s
}

function farPlane(): string {
  let s = '<g filter="url(#rs-far)">'
  // Whatever is at the end of the street, seen through most of a mile of air.
  // A cross street closes the vista, with whatever is on the far side of it
  // stacked up behind.
  s += '<g opacity="0.5" fill="#6a8aa6">'
  for (const [x, w, h] of [
    [140, 11, 22], [150, 8, 34], [157, 13, 27], [168, 9, 41], [176, 12, 30],
    [186, 8, 21], [193, 11, 36], [203, 9, 24],
  ] as [number, number, number][])
    s += '<rect x="' + x + '" y="' + (HORIZON - h) + '" width="' + w + '" height="' + h + '"/>'
  s += '</g>'
  s += '<g opacity="0.32" fill="#4e7290">'
  for (const [x, w, h] of [[128, 16, 15], [146, 22, 19], [172, 18, 13], [196, 20, 17]] as
    [number, number, number][])
    s += '<rect x="' + x + '" y="' + (HORIZON - h) + '" width="' + w + '" height="' + h + '"/>'
  s += '</g>'
  // The road running away past them, before anything is drawn over it.
  s += quad([[railX(KERB_L, HORIZON), HORIZON], [railX(KERB_R, HORIZON), HORIZON],
    [railX(KERB_R, 176), 176], [railX(KERB_L, 176), 176]], '#71797f', 'opacity="0.9"')
  s += '</g>'
  return s
}

function buildings(): string {
  let s = ''
  for (let i = DEPTHS.length - 2; i >= 0; i--) {
    const wrap = i <= 1 ? '<g filter="url(#rs-mid)">' : '<g>'
    s += wrap
    s += facade(WALL_R, DEPTHS[i], DEPTHS[i + 1], RIGHT[i], 3, 200 + i * 17, false)
    s += roofClutter(WALL_R, DEPTHS[i + 1], 300 + i)
    s += facade(WALL_L, DEPTHS[i], DEPTHS[i + 1], LEFT[i], 3, 11 + i * 23, true)
    s += roofClutter(WALL_L, DEPTHS[i + 1], 400 + i)
    s += '</g>'
  }
  // A fire escape down the nearest left facade. Zigzag, thin, and the one
  // thing in the picture that could not be anywhere but a street.
  const fx = railX(WALL_L, 232), fy = 232, k = sc(fy)
  let esc = '<g stroke="#3d444a" fill="none" stroke-width="' + f1(1.4 * k) + '" opacity="0.9">'
  for (let i = 0; i < 4; i++) {
    const y = roofY(fy) + (fy - roofY(fy)) * (0.12 + i * 0.19)
    esc += '<path d="M' + f1(fx + 4 * k) + ' ' + f1(y) + ' h' + f1(30 * k) + '"/>'
    esc += '<path d="M' + f1(fx + (i % 2 ? 4 : 34) * k) + ' ' + f1(y) + ' L' +
      f1(fx + (i % 2 ? 34 : 4) * k) + ' ' + f1(y + (fy - roofY(fy)) * 0.19) + '"/>'
  }
  esc += '</g>'
  return s + esc
}

function streetSurface(): string {
  let s = ''
  const pave = (wall: Rail, kerb: Rail) =>
    quad([[railX(wall, HORIZON), HORIZON], [railX(kerb, HORIZON), HORIZON],
      [railX(kerb, 300), 300], [railX(wall, 300), 300]], 'url(#rs-walkg)')
  s += '<g filter="url(#rs-walk)">' + pave(WALL_L, KERB_L) + pave(WALL_R, KERB_R) + '</g>'

  // Slab joints, converging with everything else.
  for (const [wall, kerb] of [[WALL_L, KERB_L], [WALL_R, KERB_R]] as [Rail, Rail][])
    for (let i = 1; i < 9; i++) {
      const y = depthLerp(300, 158, i / 9)
      s += '<path d="M' + f1(railX(wall, y)) + ' ' + f1(y) + ' L' + f1(railX(kerb, y)) + ' ' +
        f1(y) + '" stroke="#7d7a72" stroke-width="' + f1(Math.max(0.3, 0.9 * sc(y))) +
        '" opacity="0.5" fill="none"/>'
    }

  const roadQuad = [[railX(KERB_L, HORIZON), HORIZON], [railX(KERB_R, HORIZON), HORIZON],
    [railX(KERB_R, 300), 300], [railX(KERB_L, 300), 300]]
  s += '<g filter="url(#rs-asphalt)">' + quad(roadQuad, 'url(#rs-road)') + '</g>'
  s += '<g mask="url(#rs-farmask)"><g filter="url(#rs-asphalt-far)">' +
    quad(roadQuad, 'url(#rs-road)') + '</g></g>'

  // Patches. Real asphalt has been dug up and put back, and the seams are the
  // only thing in the picture that is not going somewhere.
  s += quad([[168, 176], [206, 176], [214, 198], [160, 198]], '#3f4147', 'opacity="0.26"')
  s += quad([[88, 238], [142, 238], [128, 278], [56, 278]], '#585a60', 'opacity="0.2"')
  s += '<path d="M160 198 L214 198" stroke="#2b2d32" stroke-width="0.7" opacity="0.5" fill="none"/>'
  // Cracks.
  for (const d of [
    'M40 300 L58 268 L52 250 L64 236', 'M262 300 L246 272 L254 258',
    'M120 232 L136 220 L132 210', 'M196 258 L214 246 L210 238 L222 230',
  ]) s += '<path d="' + d + '" stroke="#2c2e33" stroke-width="0.6" opacity="0.42" fill="none"/>'

  // Tyre polish: two bands where everybody drives.
  for (const off of [-0.26, 0.26]) {
    const at = (y: number) => {
      const l = railX(KERB_L, y), r = railX(KERB_R, y)
      return (l + r) / 2 + (r - l) * off
    }
    const w = (y: number) => (railX(KERB_R, y) - railX(KERB_L, y)) * 0.15
    s += quad([[at(160) - w(160) / 2, 160], [at(160) + w(160) / 2, 160],
      [at(300) + w(300) / 2, 300], [at(300) - w(300) / 2, 300]], '#8e9097', 'opacity="0.1"')
  }

  // Centre line, worn unevenly, because paint is.
  for (let i = 0; i < 7; i++) {
    const y0 = depthLerp(300, 158, i / 7)
    const y1 = depthLerp(300, 158, (i + 0.52) / 7)
    const mid = (y: number) => (railX(KERB_L, y) + railX(KERB_R, y)) / 2
    const hw = (y: number) => (railX(KERB_R, y) - railX(KERB_L, y)) * 0.017
    s += quad([[mid(y0) - hw(y0), y0], [mid(y0) + hw(y0), y0],
      [mid(y1) + hw(y1), y1], [mid(y1) - hw(y1), y1]], '#e8e2c6',
      'opacity="' + (0.5 + hash(i * 9) * 0.28).toFixed(2) + '"')
  }

  // A crossing under the camera, each bar worn by a different amount.
  for (let i = 0; i < 5; i++) {
    const y0 = 262 + i * 8.4, y1 = y0 + 4.6
    s += quad([[railX(KERB_L, y0) + 6, y0], [railX(KERB_R, y0) - 6, y0],
      [railX(KERB_R, y1) - 6, y1], [railX(KERB_L, y1) + 6, y1]], '#e2ddc8',
      'opacity="' + (0.4 + hash(i * 17) * 0.3).toFixed(2) + '"')
  }

  // The kerb edge: the brightest line in the picture, and the only thing
  // saying the pavement is higher than the road.
  const kerbFace = (r: Rail, dir: number) => {
    const y0 = HORIZON + 1
    return quad([[railX(r, y0), y0], [railX(r, 300) + dir * 5, 300],
      [railX(r, 300) + dir * 5 + 4, 300], [railX(r, y0) + 0.6, y0]], '#ded9cb', 'opacity="0.72"') +
      quad([[railX(r, y0) + 0.6, y0], [railX(r, 300) + dir * 9, 300],
        [railX(r, 300) + dir * 9 + 3, 300], [railX(r, y0) + 1.1, y0]], '#2b2c31', 'opacity="0.48"')
  }
  s += kerbFace(KERB_L, 1) + kerbFace(KERB_R, -1)

  // Drains and a manhole, on the road side of each kerb.
  const grate = (y: number, rail: Rail, dir: number) => {
    const k = sc(y), x = railX(rail, y) + dir * 9 * k
    let g = '<ellipse cx="' + f1(x) + '" cy="' + f1(y) + '" rx="' + f1(9 * k) + '" ry="' +
      f1(Math.max(0.7, 3.4 * k)) + '" fill="#2b2d32" opacity="0.75"/>'
    for (let i = -2; i <= 2; i++)
      g += '<path d="M' + f1(x + i * 3 * k) + ' ' + f1(y - 2.4 * k) + ' v' + f1(4.8 * k) +
        '" stroke="#70747a" stroke-width="' + f1(Math.max(0.25, 0.7 * k)) + '" opacity="0.5"/>'
    return g
  }
  s += grate(246, KERB_R, -1) + grate(206, KERB_L, 1)
  s += '<ellipse cx="118" cy="256" rx="15" ry="5.4" fill="#3a3c42" opacity="0.75"/>'
  s += '<ellipse cx="118" cy="255" rx="12" ry="4" fill="#63666c" opacity="0.4"/>'
  return s
}

function clutter(): string {
  let s = ''
  // Far to near, so the near things overlap properly.
  s += person(180, KERB_R, -1, '#5a6b8a')
  s += person(186, KERB_L, 1, '#8a5a52')
  s += car(190, KERB_R, -1, '#9aa0a6', 3)
  s += lamp(196, KERB_R, -1)
  s += tree(200, KERB_L, 1, 5)
  s += car(214, KERB_L, 1, '#3f4d63', 8)
  s += person(222, KERB_L, 1, '#3f4550')
  s += lamp(238, KERB_L, 1)
  s += car(248, KERB_R, -1, '#b8b2a6', 12)
  s += tree(266, KERB_L, 1, 21)

  // Wires. Three of them, sagging across the street at different depths — the
  // one thing that says "somewhere with overhead cables" faster than a sign.
  for (const [y, sag, op] of [[168, 5, 0.5], [186, 8, 0.42], [212, 13, 0.34]] as
    [number, number, number][]) {
    const lx = railX(WALL_L, y), rx = railX(WALL_R, y)
    const top = HORIZON - (y - HORIZON) * 1.7
    s += '<path d="M' + f1(lx) + ' ' + f1(top) + ' Q' + f1((lx + rx) / 2) + ' ' + f1(top + sag) +
      ' ' + f1(rx) + ' ' + f1(top) + '" fill="none" stroke="#1d2227" stroke-width="' +
      f1(Math.max(0.35, 0.9 * sc(y))) + '" opacity="' + op + '"/>'
  }

  // Signs on the right pavement.
  const sign = (y: number, rail: Rail, dir: number, face: string, glyph: string) => {
    const k = sc(y), x = railX(rail, y) + dir * 8 * k, H = 74 * k, w = Math.max(0.6, 2.6 * k)
    return '<rect x="' + f1(x - w / 2) + '" y="' + f1(y - H) + '" width="' + f1(w) +
      '" height="' + f1(H) + '" fill="url(#rs-pole)"/>' +
      '<rect x="' + f1(x - 11 * k) + '" y="' + f1(y - H - 15 * k) + '" width="' + f1(22 * k) +
      '" height="' + f1(17 * k) + '" rx="' + f1(2 * k) + '" fill="' + face +
      '" stroke="#e8e6df" stroke-width="' + f1(Math.max(0.3, 1.1 * k)) + '"/>' + glyph(x, y - H - 6.5 * k, k)
  }
  const arrow = (x: number, y: number, k: number) =>
    '<rect x="' + f1(x - 7 * k) + '" y="' + f1(y - 1.6 * k) + '" width="' + f1(14 * k) +
    '" height="' + f1(3.2 * k) + '" fill="#fff"/>'
  const bar = (x: number, y: number, k: number) =>
    '<rect x="' + f1(x - 7.5 * k) + '" y="' + f1(y - 1.8 * k) + '" width="' + f1(15 * k) +
    '" height="' + f1(3.6 * k) + '" rx="' + f1(1.4 * k) + '" fill="#fff"/>'
  s += sign(228, KERB_R, -1, '#2f5fa8', arrow)
  s += sign(196, KERB_L, 1, '#b03a2c', bar)

  // Bollards along the near right kerb.
  for (const y of [272, 288]) {
    const k = sc(y), x = railX(KERB_R, y) - 7 * k
    s += '<ellipse cx="' + f1(x) + '" cy="' + f1(y) + '" rx="' + f1(5 * k) + '" ry="' +
      f1(1.8 * k) + '" fill="#131820" opacity="0.36"/>'
    s += '<rect x="' + f1(x - 3.4 * k) + '" y="' + f1(y - 26 * k) + '" width="' + f1(6.8 * k) +
      '" height="' + f1(26 * k) + '" rx="' + f1(3.4 * k) + '" fill="#5c6165"/>'
    s += '<rect x="' + f1(x - 3.4 * k) + '" y="' + f1(y - 20 * k) + '" width="' + f1(6.8 * k) +
      '" height="' + f1(3.4 * k) + '" fill="#d8d3c4" opacity="0.8"/>'
  }

  // A hydrant on the right pavement, for something to look at that is not the
  // answer. It is nearly the same red as the lit lamp, deliberately: a picture
  // where the only red thing is the correct one is not asking you anything.
  s += '<ellipse cx="286" cy="252" rx="8" ry="2.6" fill="#131820" opacity="0.34"/>'
  s += '<path d="M281 252 v-13 q0-4.5 5-4.5 q5 0 5 4.5 v13 z" fill="#9c372a"/>'
  s += '<path d="M281 252 v-13 q0-4.5 5-4.5 v17.5 z" fill="#bd5040"/>'
  s += '<rect x="278.5" y="237" width="15" height="2.6" rx="1.3" fill="#b04735"/>'
  s += '<circle cx="286" cy="233" r="3.2" fill="#a63e30"/>'
  return s
}

/**
 * The shadow the right-hand buildings throw across the street. This is the
 * largest single thing in the frame that says the sun is somewhere, and a
 * street without one reads as an overcast render of a street no matter what
 * else is done to it.
 */
function shade(): string {
  const edge = (r: Rail) => [
    [railX(r, HORIZON), HORIZON], [railX(WALL_R, HORIZON), HORIZON],
    [railX(WALL_R, 300), 300], [railX(r, 300), 300],
  ]
  // A penumbra first, wider and weaker: the sun is a disc, not a point, and a
  // shadow edge fifty metres from what casts it is several pixels soft.
  const lit = [
    [railX(WALL_L, HORIZON), HORIZON], [railX(SHADE, HORIZON), HORIZON],
    [railX(SHADE, 300), 300], [railX(WALL_L, 300), 300],
  ]
  return quad(lit, 'url(#rs-lit)') +
    quad(edge({ x0: SHADE.x0 - 5, x1: SHADE.x1 - 26 }), '#22364c', 'opacity="0.13"') +
    quad(edge(SHADE), 'url(#rs-shade)')
}

function streetGround(): string {
  let s = sky() + farPlane() + buildings() + streetSurface() + clutter() + shade()
  s += '<rect y="' + (HORIZON - 74) + '" width="300" height="156" fill="url(#rs-haze)"/>'
  // Bloom: a blurred copy of the bright sky, laid back over the edges it meets.
  s += '<g filter="url(#rs-bloom)" opacity="0.16">' +
    '<path d="M0 0 H300 V' + HORIZON + ' L' + f1(railX(WALL_R, HORIZON)) + ' ' + HORIZON +
    ' L' + f1(railX(WALL_L, HORIZON)) + ' ' + HORIZON + ' Z" fill="#dbe8f0"/></g>'
  s += '<rect width="300" height="300" fill="url(#rs-vig)"/>'
  return s
}

/**
 * The signal, alone. Kept out of `ground` so the checker can render the street
 * without it and find out for itself which squares changed.
 */
function streetSubject(): string {
  const POLE_X = 33, POLE_W = 14, POLE_TOP = 34, POLE_FOOT = 222
  let s = ''
  // Its shadow lies to the left along the pavement, because the sun is off the
  // top right. Getting that backwards reads as fake a moment before you can
  // say why.
  s += '<path d="M33 222 L-6 232 L-6 240 L47 226 Z" fill="#131820" opacity="0.28"/>'
  s += '<ellipse cx="40" cy="230" rx="21" ry="6" fill="#131820" opacity="0.32"/>'

  s += '<path d="M24 236 h32 l-3 -14 h-26 z" fill="#7d7a72"/>'
  s += '<path d="M24 236 h32 l-1.4 -6 h-29.2 z" fill="#5e5c56" opacity="0.6"/>'
  s += '<g filter="url(#rs-metal)">'
  s += '<rect x="' + POLE_X + '" y="' + POLE_TOP + '" width="' + POLE_W + '" height="' +
    (POLE_FOOT - POLE_TOP) + '" fill="url(#rs-pole)"/>'
  // The arm. Two strokes: the tube, then a highlight along its sunlit top.
  s += '<path d="M40 44 C 82 40, 118 46, 152 58 l0 10 C 118 56, 82 50, 40 54 Z" fill="url(#rs-pole)"/>'
  s += '</g>'
  s += '<rect x="' + POLE_X + '" y="216" width="' + POLE_W + '" height="6" fill="#22272a" opacity="0.5"/>'
  s += '<path d="M40 45.5 C 82 41.5, 118 47.5, 152 59.5" fill="none" stroke="#9aa2a8" ' +
    'stroke-width="1.6" opacity="0.55"/>'
  s += '<path d="M36 34 h8 v14 h-8 z" fill="#4a5055"/>'

  // The head, hanging. A rounded case, a rim light down its sunlit right edge.
  s += '<g filter="url(#rs-metal)">' +
    '<rect x="146" y="56" width="44" height="70" rx="6" fill="url(#rs-case)"/></g>'
  s += '<rect x="186.6" y="58" width="2" height="66" rx="1" fill="#a7b0b6" opacity="0.5"/>'
  s += '<rect x="150" y="50" width="36" height="8" rx="3" fill="#20262a"/>'
  s += '<rect x="164" y="44" width="8" height="8" fill="#3b4247"/>'

  const lamps: [number, string, boolean][] = [
    [75, 'url(#rs-lamp-red)', true],
    [94, '#4b3c21', false],
    [113, '#213a2c', false],
  ]
  for (const [cy, fill, lit] of lamps) {
    if (lit) s += '<circle cx="168" cy="' + cy + '" r="19" fill="url(#rs-glow)"/>'
    s += '<circle cx="168" cy="' + cy + '" r="10.6" fill="#0b0e10"/>'
    s += '<circle cx="168" cy="' + cy + '" r="8.9" fill="' + fill + '"/>'
    if (lit) s += '<ellipse cx="164.8" cy="' + (cy - 3.2) + '" rx="2.9" ry="2" fill="#fff" opacity="0.55"/>'
    // The visor. Without these it is three circles on a box; with them it is a
    // traffic light, and it is the single most recognisable part of one.
    s += '<path d="M155.5 ' + (cy - 5) + ' a12.5 12.5 0 0 1 25 0 l0 -3.2 a13.6 13.6 0 0 0 -25 0 z" ' +
      'fill="#12161a"/>'
    s += '<path d="M155.5 ' + (cy - 8.2) + ' a13.6 13.6 0 0 1 25 0" fill="none" stroke="#6b7379" ' +
      'stroke-width="1" opacity="0.65"/>'
  }
  return s
}

/** The street. The signal head is not arguable; the pole under it is. */
export const STREET: Scene = {
  size: 300,
  defs: STREET_DEFS,
  ground: streetGround(),
  subject: streetSubject(),
  bounds: [
    { x: 146, y: 44, w: 44, h: 82 },   // the head, its bracket and its hanger
    { x: 47, y: 40, w: 53, h: 16 },    // the arm, left of the column line
    { x: 100, y: 46, w: 46, h: 16 },   // the arm, right of it
    { x: 33, y: 34, w: 14, h: 188 },   // the mast
    { x: 24, y: 222, w: 32, h: 14 },   // the foundation
  ],
  core: [{ x: 146, y: 44, w: 44, h: 82 }],
}

/* ------------------------------------------------------------------------ */
/* ------------------------------------------------------------------------ */
/* The text challenge                                                        */
/* ------------------------------------------------------------------------ */

/** No I, O, S or 0, 1, 5. A CAPTCHA nobody can read is not a joke, it is a wall. */
export const ALPHABET = 'ABCDEFGHJKLMNPQRTUVWXYZ2346789'

export type WarpedText = { svg: string; width: number; height: number }

/**
 * Distorted characters, done the way the real ones were: a turbulence field
 * pushing the glyphs about, rather than a rotation applied to each letter.
 * Rotating letters individually leaves every one of them perfectly formed and
 * merely tilted, which is why that never looked right — in the real thing the
 * strokes themselves bend.
 */
export function warpedText(code: string, seed: number): WarpedText {
  const W = 264, H = 92
  const id = 'w' + seed
  const step = (W - 40) / code.length
  let glyphs = ''
  for (let i = 0; i < code.length; i++) {
    const r = hash(seed * 31 + i)
    const r2 = hash(seed * 71 + i * 5)
    const x = 26 + i * step + (r - 0.5) * 5
    const y = 60 + (r2 - 0.5) * 13
    glyphs +=
      '<text x="' + f1(x) + '" y="' + f1(y) + '" font-size="' + (44 + r2 * 9).toFixed(1) +
      '" font-family="Georgia, &apos;Times New Roman&apos;, serif" fill="#2a2a2a" ' +
      'transform="rotate(' + ((r - 0.5) * 22).toFixed(1) + ' ' + f1(x) + ' ' + f1(y) + ')">' +
      code[i] + '</text>'
  }

  // Two strokes through the type. The real ones had these, and they are why a
  // machine could not simply cut the picture up into letters.
  let lines = ''
  for (let k = 0; k < 2; k++) {
    const base = 34 + k * 26
    let d = ''
    for (let i = 0; i <= 10; i++) {
      const px = (i / 10) * W
      const py = base + Math.sin(i * 0.8 + seed + k * 2) * 14
      d += (i ? 'L' : 'M') + f1(px) + ' ' + f1(py)
    }
    lines += '<path d="' + d + '" fill="none" stroke="#2a2a2a" stroke-width="' + (1.3 + k * 0.5) +
      '" opacity="0.5"/>'
  }

  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W +
    '" height="' + H + '">' +
    '<defs>' +
    '<filter id="' + id + 'w"><feTurbulence type="turbulence" baseFrequency="0.024 0.038" ' +
    'numOctaves="2" seed="' + seed + '" result="t"/>' +
    '<feDisplacementMap in="SourceGraphic" in2="t" scale="9" xChannelSelector="R" ' +
    'yChannelSelector="G"/><feGaussianBlur stdDeviation="0.35"/></filter>' +
    '<filter id="' + id + 's" x="0" y="0" width="100%" height="100%">' +
    '<feTurbulence type="fractalNoise" baseFrequency="0.62" numOctaves="2" seed="' + (seed + 5) + '"/>' +
    '<feColorMatrix type="saturate" values="0"/>' +
    '<feComponentTransfer><feFuncA type="linear" slope="0.42" intercept="-0.2"/></feComponentTransfer>' +
    '</filter>' +
    '</defs>' +
    '<rect width="' + W + '" height="' + H + '" fill="#efefef"/>' +
    '<g filter="url(#' + id + 'w)">' + glyphs + lines + '</g>' +
    '<rect width="' + W + '" height="' + H + '" filter="url(#' + id + 's)" opacity="0.55"/>' +
    '</svg>'
  return { svg, width: W, height: H }
}

/* ------------------------------------------------------------------------ */
/* The hands                                                                 */
/* ------------------------------------------------------------------------ */

/**
 * Four pictures of a hand, one of which has the right number of parts.
 *
 * The joke is the one everybody has made about generated images, so these have
 * to look generated rather than drawn: a studio ground, skin that is lit from
 * one side, creases at the joints, nails, a shadow underneath. A flat outline
 * would be a diagram of a hand, and the question "is this a real photograph of
 * a hand" does not mean anything about a diagram.
 *
 * `digits` is counted from the loop that draws them rather than typed in
 * beside it, so a hand cannot claim four fingers and be drawn with five.
 */
export type Hand = { svg: string; digits: number; ok: boolean; why: string }

export const HAND_DEFS =
  '<linearGradient id="rh-bg" x1="0" y1="0" x2="0.3" y2="1">' +
  '<stop offset="0" stop-color="#eef1f4"/><stop offset="1" stop-color="#c3ccd4"/></linearGradient>' +
  '<radialGradient id="rh-vig" cx="0.5" cy="0.42" r="0.75">' +
  '<stop offset="0.45" stop-color="#000" stop-opacity="0"/>' +
  '<stop offset="1" stop-color="#0d141b" stop-opacity="0.26"/></radialGradient>' +
  // Lit from the left, like the street is, so the two do not disagree.
  '<linearGradient id="rh-skin" x1="0" y1="0" x2="1" y2="0.2">' +
  '<stop offset="0" stop-color="#f6cfae"/><stop offset="0.42" stop-color="#e7b189"/>' +
  '<stop offset="1" stop-color="#c1855f"/></linearGradient>' +
  '<radialGradient id="rh-palm" cx="0.38" cy="0.3">' +
  '<stop offset="0" stop-color="#f5cdaa"/><stop offset="1" stop-color="#d29b74"/></radialGradient>' +
  '<linearGradient id="rh-nail" x1="0" y1="0" x2="0" y2="1">' +
  '<stop offset="0" stop-color="#fadfc8"/><stop offset="1" stop-color="#e9bd9c"/></linearGradient>'

/** One hand, with however many fingers and thumbs it was asked for. */
export function handSvg(fingers: number, thumbs: number): { svg: string; digits: number } {
  const span = Math.max(46, fingers * 14)
  const x0 = 60 - span / 2
  const per = span / fingers
  let digits = 0
  let s = '<rect width="120" height="140" fill="url(#rh-bg)"/>'
  // The shadow it casts on the ground behind it.
  s += '<ellipse cx="63" cy="134" rx="30" ry="6" fill="#28323a" opacity="0.3"/>'

  /**
   * One digit: a capsule with the two creases a finger actually bends at, a
   * nail, and a highlight down its lit side. `rot` turns it about a pivot,
   * which is how a thumb gets its angle while its base stays inside the palm —
   * drawing the thumb out to one side and then rotating it as well is what
   * leaves it floating next to the hand instead of attached to it.
   */
  const digit = (x: number, y: number, w: number, h: number, rot = 0, cx = 0, cy = 0) => {
    digits++
    const t2 = rot ? ' transform="rotate(' + rot + ' ' + f1(cx) + ' ' + f1(cy) + ')"' : ''
    let d = '<g' + t2 + '>'
    d += '<rect x="' + f1(x) + '" y="' + f1(y) + '" width="' + f1(w) + '" height="' + f1(h) +
      '" rx="' + f1(w / 2) + '" fill="url(#rh-skin)"/>'
    d += '<rect x="' + f1(x + w * 0.14) + '" y="' + f1(y + w * 0.5) + '" width="' + f1(w * 0.2) +
      '" height="' + f1(h - w) + '" rx="' + f1(w * 0.1) + '" fill="#ffe4cd" opacity="0.34"/>'
    for (const k of [0.42, 0.68])
      d += '<path d="M' + f1(x + w * 0.14) + ' ' + f1(y + h * k) + ' q' + f1(w * 0.36) + ' ' +
        f1(w * 0.2) + ' ' + f1(w * 0.72) + ' 0" fill="none" stroke="#a06a49" ' +
        'stroke-width="0.9" opacity="0.5"/>'
    d += '<rect x="' + f1(x + w * 0.2) + '" y="' + f1(y + w * 0.36) + '" width="' + f1(w * 0.6) +
      '" height="' + f1(w * 0.82) + '" rx="' + f1(w * 0.26) + '" fill="url(#rh-nail)"/>'
    d += '</g>'
    return d
  }

  // Fingers, longest in the middle — the shape you check without knowing you
  // are checking it. Their lower ends run under the palm, which is drawn after.
  for (let i = 0; i < fingers; i++) {
    const t2 = fingers === 1 ? 0.5 : i / (fingers - 1)
    const h = 36 + Math.sin(t2 * Math.PI) * 20
    const w = per - 3.4
    s += digit(x0 + i * per + 1.7, 76 - h, w, h + 18)
  }

  // Palm over the bottom of them, then the wrist under that.
  s += '<rect x="46" y="102" width="28" height="38" rx="9" fill="#cf9a72"/>'
  s += '<rect x="' + f1(x0 - 5) + '" y="64" width="' + f1(span + 10) +
    '" height="48" rx="16" fill="url(#rh-palm)"/>'
  // Knuckles: a soft dark band where the fingers meet the palm.
  s += '<rect x="' + f1(x0 - 3) + '" y="64" width="' + f1(span + 6) +
    '" height="8" rx="4" fill="#ac7754" opacity="0.28"/>'
  // Two palm creases, because a palm without them is a mitten.
  s += '<path d="M' + f1(x0 + 2) + ' 80 q' + f1(span * 0.44) + ' 11 ' + f1(span * 0.84) +
    ' 3" fill="none" stroke="#ac7754" stroke-width="1.2" opacity="0.4"/>'
  s += '<path d="M' + f1(x0 + 5) + ' 90 q' + f1(span * 0.34) + ' 13 ' + f1(span * 0.58) +
    ' 17" fill="none" stroke="#ac7754" stroke-width="1.2" opacity="0.34"/>'

  // Thumbs. Base inside the palm, tip swung out and up.
  if (thumbs >= 1) s += digit(x0 - 6, 72, 17, 42, -36, x0 + 2.5, 112)
  if (thumbs >= 2) s += digit(x0 + span - 11, 72, 17, 42, 36, x0 + span - 2.5, 112)

  s += '<rect width="120" height="140" fill="url(#rh-vig)"/>'
  return { svg: s, digits }
}

/** The four options. Exactly one of them has five digits. */
export function hands(): Hand[] {
  const make = (fingers: number, thumbs: number, why: string): Hand => {
    const { svg, digits } = handSvg(fingers, thumbs)
    return { svg, digits, ok: digits === 5, why }
  }
  return [
    make(4, 1, ''),
    make(5, 1, 'Six digits.'),
    make(3, 1, 'Four digits.'),
    make(4, 2, 'Two thumbs.'),
  ]
}
