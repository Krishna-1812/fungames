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
    scene.ground +
    (withSubject ? scene.subject : '') +
    GRAIN_RECT +
    '</svg>'
  )
}

/**
 * Grain. One octave rather than three: at this size the extra octaves are
 * invisible and the filter runs once per tile, nine times over.
 */
export const GRAIN_DEFS =
  '<filter id="rs-grain" x="0" y="0" width="100%" height="100%">' +
  '<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="11" result="n"/>' +
  '<feColorMatrix in="n" type="saturate" values="0"/>' +
  '<feComponentTransfer><feFuncA type="linear" slope="0.55" intercept="-0.22"/></feComponentTransfer>' +
  '</filter>'

/** The grain layer, over everything. */
export const GRAIN_RECT =
  '<rect width="300" height="300" filter="url(#rs-grain)" opacity="0.5"/>'

/* ------------------------------------------------------------------------ */
/* Perspective                                                               */
/* ------------------------------------------------------------------------ */

/** Deterministic noise in [0,1). Scenes must render the same every time. */
function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

const HORIZON = 148
/** How much taller than eye level the buildings are. */
const STOREYS = 3.0

/** A line receding to the vanishing point, sampled at a screen height. */
type Rail = { x0: number; x1: number }
const railX = (r: Rail, y: number) => r.x0 + ((y - HORIZON) / (300 - HORIZON)) * (r.x1 - r.x0)

const KERB_L: Rail = { x0: 166, x1: -10 }
const KERB_R: Rail = { x0: 178, x1: 330 }
const WALL_L: Rail = { x0: 156, x1: -80 }
const WALL_R: Rail = { x0: 190, x1: 430 }

/** Roof height for a building whose base meets the ground at screen y. */
const roofY = (y: number) => HORIZON - (y - HORIZON) * STOREYS

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

const f1 = (n: number) => n.toFixed(1)
const quad = (p: number[][], fill: string, extra = '') =>
  '<path d="M' + p.map((q) => f1(q[0]) + ' ' + f1(q[1])).join('L') + 'Z" fill="' + fill + '"' +
  (extra ? ' ' + extra : '') + '/>'

/**
 * One building face, seen at an angle, with its windows converging along with
 * it. Occlusion is painted over the lot at the end: streets are darker at
 * pavement level than three storeys up, and leaving that out is what makes
 * drawn buildings look like stickers.
 */
function facade(
  rail: Rail, yFar: number, yNear: number, fill: string, cols: number, seed: number,
): string {
  const xf = railX(rail, yFar), xn = railX(rail, yNear)
  const tf = roofY(yFar), tn = roofY(yNear)
  let s = quad([[xf, tf], [xn, tn], [xn, yNear], [xf, yFar]], fill)

  // A parapet along the roofline catches the sky and separates one building
  // from the next more convincingly than an outline would.
  s += quad([[xf, tf], [xn, tn], [xn, tn + 4], [xf, tf + 2]], '#ffffff', 'opacity="0.22"')

  const rows = 4
  for (let c = 0; c < cols; c++)
    for (let r = 0; r < rows; r++) {
      const t0 = (c + 0.18) / cols, t1 = (c + 0.82) / cols
      const y0 = depthLerp(yFar, yNear, t0), y1 = depthLerp(yFar, yNear, t1)
      const x0 = railX(rail, y0), x1 = railX(rail, y1)
      // Windows sit in the top four-fifths; the ground floor is shopfront.
      const a = 0.1 + r * 0.19, b = a + 0.13
      const pane = [
        [x0, roofY(y0) + (y0 - roofY(y0)) * a], [x1, roofY(y1) + (y1 - roofY(y1)) * a],
        [x1, roofY(y1) + (y1 - roofY(y1)) * b], [x0, roofY(y0) + (y0 - roofY(y0)) * b],
      ]
      const k = hash(seed + c * 7 + r * 13)
      s += quad(pane, '#26313d', 'opacity="' + (0.62 + k * 0.3).toFixed(2) + '"')
      // Sky in the glass. Lighting one pane in four differently is what stops
      // a wall of windows reading as wallpaper.
      s += quad(pane, 'url(#rs-glass)', 'opacity="' + (0.15 + k * 0.75).toFixed(2) + '"')
    }

  // Shopfront band along the bottom fifth.
  const g0 = 0.84
  s += quad([
    [xf, roofY(yFar) + (yFar - roofY(yFar)) * g0], [xn, roofY(yNear) + (yNear - roofY(yNear)) * g0],
    [xn, yNear], [xf, yFar],
  ], '#2f2a30', 'opacity="0.72"')

  s += quad([[xf, tf], [xn, tn], [xn, yNear], [xf, yFar]], 'url(#rs-ao)')
  return s
}

/* ------------------------------------------------------------------------ */
/* The street                                                                */
/* ------------------------------------------------------------------------ */

const STREET_DEFS =
  GRAIN_DEFS +
  // Sky: deeper overhead, hazier at the horizon, which is what air does.
  '<linearGradient id="rs-sky" x1="0" y1="0" x2="0" y2="1">' +
  '<stop offset="0" stop-color="#5d93c4"/><stop offset="0.5" stop-color="#96bcd9"/>' +
  '<stop offset="0.84" stop-color="#cfdde2"/><stop offset="1" stop-color="#e6e5db"/></linearGradient>' +
  '<radialGradient id="rs-cloud"><stop offset="0" stop-color="#fff" stop-opacity="0.9"/>' +
  '<stop offset="0.55" stop-color="#fff" stop-opacity="0.34"/>' +
  '<stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>' +
  // The sun is off the top right, so everything in the picture is lit from
  // there and shadows fall to the left.
  '<radialGradient id="rs-sun"><stop offset="0" stop-color="#fff6e0" stop-opacity="0.95"/>' +
  '<stop offset="0.35" stop-color="#ffeecb" stop-opacity="0.42"/>' +
  '<stop offset="1" stop-color="#ffe9c0" stop-opacity="0"/></radialGradient>' +
  '<linearGradient id="rs-glass" x1="0" y1="0" x2="0.6" y2="1">' +
  '<stop offset="0" stop-color="#c9dcec"/><stop offset="0.5" stop-color="#7f9db4" stop-opacity="0.4"/>' +
  '<stop offset="1" stop-color="#232f3a" stop-opacity="0"/></linearGradient>' +
  // Painted over every facade: dark at pavement level, clear up top.
  '<linearGradient id="rs-ao" x1="0" y1="0" x2="0" y2="1">' +
  '<stop offset="0" stop-color="#0d1620" stop-opacity="0"/>' +
  '<stop offset="0.62" stop-color="#0d1620" stop-opacity="0.1"/>' +
  '<stop offset="1" stop-color="#0d1620" stop-opacity="0.42"/></linearGradient>' +
  // Asphalt: lighter far off where it catches the sky, darker underfoot.
  '<linearGradient id="rs-road" x1="0" y1="0" x2="0" y2="1">' +
  '<stop offset="0" stop-color="#8d8f93"/><stop offset="0.22" stop-color="#63656b"/>' +
  '<stop offset="0.62" stop-color="#4c4d53"/><stop offset="1" stop-color="#3c3d43"/></linearGradient>' +
  '<linearGradient id="rs-walk" x1="0" y1="0" x2="0" y2="1">' +
  '<stop offset="0" stop-color="#b8b5ab"/><stop offset="0.5" stop-color="#a5a298"/>' +
  '<stop offset="1" stop-color="#8e8b83"/></linearGradient>' +
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
  '<radialGradient id="rs-glow"><stop offset="0" stop-color="#ff7050" stop-opacity="0.55"/>' +
  '<stop offset="1" stop-color="#ff7050" stop-opacity="0"/></radialGradient>' +
  '<linearGradient id="rs-car" x1="0" y1="0" x2="0" y2="1">' +
  '<stop offset="0" stop-color="#e0e2e4"/><stop offset="0.4" stop-color="#adb2b7"/>' +
  '<stop offset="1" stop-color="#5f6469"/></linearGradient>' +
  // The corners of a photograph are always darker than the middle.
  '<radialGradient id="rs-vig" cx="0.5" cy="0.45" r="0.74">' +
  '<stop offset="0.5" stop-color="#000" stop-opacity="0"/>' +
  '<stop offset="1" stop-color="#0a1018" stop-opacity="0.34"/></radialGradient>' +
  // Distance is not just smaller. It is paler, and bluer. Strongest at the
  // horizon and fading out both ways: a haze layer with a hard top edge draws
  // a line across the picture at exactly the height nothing is happening.
  '<linearGradient id="rs-haze" x1="0" y1="0" x2="0" y2="1">' +
  '<stop offset="0" stop-color="#dceaf1" stop-opacity="0"/>' +
  '<stop offset="0.46" stop-color="#dceaf1" stop-opacity="0.6"/>' +
  '<stop offset="0.62" stop-color="#dceaf1" stop-opacity="0.42"/>' +
  '<stop offset="1" stop-color="#dceaf1" stop-opacity="0"/></linearGradient>'

/** Ground depths of the building corners, far to near. */
const DEPTHS = [156, 164, 176, 196, 230, 300]

function streetGround(): string {
  let s = '<rect width="300" height="300" fill="url(#rs-sky)"/>'
  s += '<ellipse cx="286" cy="8" rx="150" ry="120" fill="url(#rs-sun)"/>'
  s += '<ellipse cx="66" cy="40" rx="70" ry="18" fill="url(#rs-cloud)"/>'
  s += '<ellipse cx="112" cy="30" rx="40" ry="12" fill="url(#rs-cloud)" opacity="0.75"/>'
  s += '<ellipse cx="216" cy="66" rx="60" ry="14" fill="url(#rs-cloud)" opacity="0.5"/>'

  // Whatever is at the end of the street, seen through most of a mile of air.
  s += '<g opacity="0.34" fill="#5c7d9a">'
  for (const [x, w, h] of [[150, 8, 26], [159, 6, 17], [166, 11, 32], [178, 7, 21], [186, 9, 14]] as
    [number, number, number][])
    s += '<rect x="' + x + '" y="' + (HORIZON - h) + '" width="' + w + '" height="' + h + '"/>'
  s += '</g>'

  // Buildings, far pair first so the near ones overlap them.
  // Lit side and shade side. The sun is off the right, so the left row's faces
  // catch it and the right row's are turned away — one rule, obeyed by ten
  // buildings, which is most of what makes a drawing read as a photograph.
  const leftFill = ['#9fb0bb', '#a8968c', '#9c8074', '#8d949a', '#7d635a']
  const rightFill = ['#93a1ac', '#7c6f68', '#666c72', '#7b7367', '#44484d']
  for (let i = DEPTHS.length - 2; i >= 0; i--) {
    s += facade(WALL_R, DEPTHS[i], DEPTHS[i + 1], rightFill[i], 3, 200 + i * 17)
    s += facade(WALL_L, DEPTHS[i], DEPTHS[i + 1], leftFill[i], 3, 11 + i * 23)
  }

  // Pavements, kerbs, road. Painted after the buildings so the kerb line runs
  // in front of them, which is where it is.
  const pave = (wall: Rail, kerb: Rail) =>
    quad([[railX(wall, HORIZON), HORIZON], [railX(kerb, HORIZON), HORIZON],
      [railX(kerb, 300), 300], [railX(wall, 300), 300]], 'url(#rs-walk)')
  s += pave(WALL_L, KERB_L) + pave(WALL_R, KERB_R)

  s += quad([[railX(KERB_L, HORIZON), HORIZON], [railX(KERB_R, HORIZON), HORIZON],
    [railX(KERB_R, 300), 300], [railX(KERB_L, 300), 300]], 'url(#rs-road)')

  // The kerb edge: the brightest line in the picture, and the only thing
  // saying the pavement is higher than the road.
  const kerbFace = (r: Rail, dir: number) => {
    const y0 = HORIZON + 1
    return quad([[railX(r, y0), y0], [railX(r, 300) + dir * 5, 300],
      [railX(r, 300) + dir * 5 + 4, 300], [railX(r, y0) + 0.6, y0]], '#ded9cb', 'opacity="0.75"') +
      quad([[railX(r, y0) + 0.6, y0], [railX(r, 300) + dir * 9, 300],
        [railX(r, 300) + dir * 9 + 3, 300], [railX(r, y0) + 1.1, y0]], '#2b2c31', 'opacity="0.5"')
  }
  s += kerbFace(KERB_L, 1) + kerbFace(KERB_R, -1)

  // Tyre polish: two bands where everybody drives, in perspective.
  for (const off of [-0.26, 0.26]) {
    const at = (y: number) => {
      const l = railX(KERB_L, y), r = railX(KERB_R, y)
      return (l + r) / 2 + (r - l) * off
    }
    const w = (y: number) => ((railX(KERB_R, y) - railX(KERB_L, y)) * 0.15)
    s += quad([[at(160) - w(160) / 2, 160], [at(160) + w(160) / 2, 160],
      [at(300) + w(300) / 2, 300], [at(300) - w(300) / 2, 300]], '#8e9097', 'opacity="0.12"')
  }

  // Centre line. Dashes at even distances, which on the screen means bunched
  // up near the horizon and stretched out under the camera.
  for (let i = 0; i < 7; i++) {
    const y0 = depthLerp(300, 158, i / 7)
    const y1 = depthLerp(300, 158, (i + 0.52) / 7)
    const mid = (y: number) => (railX(KERB_L, y) + railX(KERB_R, y)) / 2
    const hw = (y: number) => (railX(KERB_R, y) - railX(KERB_L, y)) * 0.017
    s += quad([[mid(y0) - hw(y0), y0], [mid(y0) + hw(y0), y0],
      [mid(y1) + hw(y1), y1], [mid(y1) - hw(y1), y1]], '#e8e2c6', 'opacity="0.7"')
  }

  // A crossing under the camera. Nothing says "intersection with a traffic
  // light" faster, and the bars give the road something to be flat against.
  for (let i = 0; i < 5; i++) {
    const y0 = 262 + i * 8.4, y1 = y0 + 4.6
    s += quad([[railX(KERB_L, y0) + 6, y0], [railX(KERB_R, y0) - 6, y0],
      [railX(KERB_R, y1) - 6, y1], [railX(KERB_L, y1) + 6, y1]], '#e2ddc8', 'opacity="0.6"')
  }

  // A car waiting at the light, small, in the middle distance, with the
  // contact shadow that stops it floating.
  s += '<ellipse cx="205" cy="212" rx="27" ry="4.5" fill="#171a1e" opacity="0.42"/>'
  s += '<path d="M181 210 v-11 q0-5 6-6 l7-9 q2-3 6-3 h19 q4 0 6 3 l7 9 q6 1 6 6 v11 z" fill="url(#rs-car)"/>'
  s += '<path d="M196 186 h17 l6 8 h-30 z" fill="#33414d" opacity="0.85"/>'
  s += '<path d="M197 187 h6 l-4 7 h-6 z" fill="#b9d5e8" opacity="0.55"/>'
  s += '<rect x="181" y="203" width="57" height="1.6" fill="#f2d0b4" opacity="0.4"/>'
  s += '<circle cx="192" cy="209" r="5.6" fill="#1a1c20"/><circle cx="192" cy="209" r="2.4" fill="#767b81"/>'
  s += '<circle cx="228" cy="209" r="5.6" fill="#1a1c20"/><circle cx="228" cy="209" r="2.4" fill="#767b81"/>'
  s += '<rect x="181" y="196" width="4" height="3" rx="1.4" fill="#ff6a52" opacity="0.9"/>'
  s += '<rect x="234" y="196" width="4" height="3" rx="1.4" fill="#ff6a52" opacity="0.9"/>'

  // Patches and a drain. Real asphalt has been dug up and put back, and the
  // seams are the only thing in the picture that is not going somewhere.
  s += quad([[168, 176], [206, 176], [212, 196], [162, 196]], '#3f4147', 'opacity="0.3"')
  s += quad([[92, 236], [140, 236], [128, 274], [62, 274]], '#54565c', 'opacity="0.22"')
  s += '<ellipse cx="248" cy="238" rx="11" ry="4" fill="#2f3136" opacity="0.6"/>'
  s += '<ellipse cx="248" cy="237" rx="9" ry="3" fill="#6a6c72" opacity="0.35"/>'

  // A hydrant on the right pavement, for something to look at that is not the
  // answer. It is nearly the same red as the lit lamp, deliberately: a picture
  // where the only red thing is the correct one is not asking you anything.
  s += '<ellipse cx="286" cy="252" rx="8" ry="2.6" fill="#171a1e" opacity="0.34"/>'
  s += '<path d="M281 252 v-13 q0-4.5 5-4.5 q5 0 5 4.5 v13 z" fill="#9c372a"/>'
  s += '<path d="M281 252 v-13 q0-4.5 5-4.5 v17.5 z" fill="#bd5040"/>'
  s += '<rect x="278.5" y="237" width="15" height="2.6" rx="1.3" fill="#b04735"/>'
  s += '<circle cx="286" cy="233" r="3.2" fill="#a63e30"/>'

  s += '<rect y="' + (HORIZON - 74) + '" width="300" height="156" fill="url(#rs-haze)"/>'
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

  // The sun is off the top right, so the pole's shadow lies to the left along
  // the pavement. Getting that backwards reads as fake a moment before you can
  // say why.
  s += '<path d="M33 222 L-6 232 L-6 240 L47 226 Z" fill="#171a1e" opacity="0.3"/>'
  s += '<ellipse cx="40" cy="230" rx="21" ry="6" fill="#171a1e" opacity="0.34"/>'

  // Foundation, then the mast.
  s += '<path d="M24 236 h32 l-3 -14 h-26 z" fill="#7d7a72"/>'
  s += '<path d="M24 236 h32 l-1.4 -6 h-29.2 z" fill="#5e5c56" opacity="0.6"/>'
  s += '<rect x="' + POLE_X + '" y="' + POLE_TOP + '" width="' + POLE_W + '" height="' +
    (POLE_FOOT - POLE_TOP) + '" fill="url(#rs-pole)"/>'
  s += '<rect x="' + POLE_X + '" y="216" width="' + POLE_W + '" height="6" fill="#22272a" opacity="0.5"/>'

  // The arm. Two strokes: the tube, then a highlight along its sunlit top.
  s += '<path d="M40 44 C 82 40, 118 46, 152 58 l0 10 C 118 56, 82 50, 40 54 Z" fill="url(#rs-pole)"/>'
  s += '<path d="M40 45.5 C 82 41.5, 118 47.5, 152 59.5" fill="none" stroke="#9aa2a8" ' +
    'stroke-width="1.6" opacity="0.6"/>'
  s += '<path d="M36 34 h8 v14 h-8 z" fill="#4a5055"/>'

  // The head, hanging. A rounded case, a rim light down its sunlit right edge,
  // and a soft shadow where it meets the arm.
  s += '<rect x="146" y="56" width="44" height="70" rx="6" fill="url(#rs-case)"/>'
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
