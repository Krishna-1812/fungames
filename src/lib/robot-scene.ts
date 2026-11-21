/**
 * robot-scene — the pictures the CAPTCHA shows you, and the answer key taken
 * out of them rather than typed in beside them.
 *
 * A real image challenge is a photograph with the thing it asks about
 * somewhere inside it, so the street is a photograph's worth of street,
 * rendered offline (scripts/robot-bake/street.glsl, by bake-robot.mjs) to
 * public/not-a-robot/street.jpg. The same scene is rendered a second time as
 * a mask of the signal head and of the pole and arm holding it up, and the
 * share of each of the nine squares each one covers is measured from that
 * mask into src/data/robot-street-key.ts. Nothing here says where the
 * traffic light is; the picture does.
 *
 * There are two keys, not one, and that is the more interesting half. A signal
 * head hanging over the road is in a square or it is not. The arm holding it
 * up reaches into another square, and whether that square "contains a traffic
 * light" is a judgement, not a fact. Real CAPTCHAs grade that judgement as
 * though it were a fact, which is the single thing that makes them
 * infuriating. So `coreCells` is what you must tick, `answerCells` is what you
 * may tick, and the squares in between are yours to decide.
 *
 * scripts/check-robot-scene.mjs holds the key to the picture: no square where
 * the head only grazes a corner, the core inside the answer, the pictures
 * present at the sizes the page asks for.
 */
import { KEY } from '../data/robot-street-key'

/** The measured key: for each square of the 3 x 3 grid, left to right and
 *  top to bottom, the share of it the head covers and the pole covers. */
export const STREET_KEY: { grid: number; size: number; head: number[]; pole: number[] } = KEY

/** Under this share of a square, the head is grazing it: not a fact either
 *  way, so the checker insists no square of the picture lands there. */
export const HEAD_MIN = 0.02
/** Under this share of a square, the subject is not visibly in it at all. */
export const SEEN_MIN = 0.008

/** The squares that must be ticked: the ones the signal head is in. */
export function coreCells(key = STREET_KEY): number[] {
  return key.head.map((h, i) => (h >= HEAD_MIN ? i : -1)).filter((i) => i >= 0)
}

/** The squares that may be ticked: anywhere the head, pole or arm is seen. */
export function answerCells(key = STREET_KEY): number[] {
  return key.head.map((h, i) => (h + key.pole[i] >= SEEN_MIN ? i : -1)).filter((i) => i >= 0)
}

export type Mark = { ok: boolean; missed: number[]; wrong: number[] }

/** Mark a selection: every core square, no square outside the answer. */
export function mark(chosen: Iterable<number>, key = STREET_KEY): Mark {
  const set = new Set(chosen)
  const missed = coreCells(key).filter((i) => !set.has(i))
  const allowed = new Set(answerCells(key))
  const wrong = [...set].filter((i) => !allowed.has(i)).sort((a, b) => a - b)
  return { ok: missed.length === 0 && wrong.length === 0, missed, wrong }
}

/* ------------------------------------------------------------------------ */
/* ------------------------------------------------------------------------ */
/* The text challenge                                                        */
/* ------------------------------------------------------------------------ */

/** A repeatable scatter, so one seed always warps the same way. */
function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}
const f1 = (n: number) => n.toFixed(1)

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
 * Four photographs of a hand, one of which has the right number of parts —
 * the joke everybody has made about generated pictures of hands. They are
 * one model (scripts/robot-bake/hand.glsl) shot four times in the Auction
 * studio's white room with a different count of fingers and thumbs, so
 * `digits` is the count the picture was rendered with, not a caption.
 */
export type Hand = { src: string; fingers: number; thumbs: number; digits: number; ok: boolean; why: string }

/** The four, as bake-robot.mjs renders them: [fingers, thumbs]. */
export const HAND_SHOTS: [number, number][] = [[4, 1], [5, 1], [3, 1], [4, 2]]

export function hands(base = '/'): Hand[] {
  return HAND_SHOTS.map(([fingers, thumbs]) => {
    const digits = fingers + thumbs
    const why = thumbs > 1 ? 'Two thumbs.' : digits === 5 ? '' : digits > 5 ? 'Six digits.' : 'Four digits.'
    return { src: `${base}not-a-robot/hand-${fingers}-${thumbs}.webp`, fingers, thumbs, digits, ok: digits === 5 && thumbs === 1, why }
  })
}
