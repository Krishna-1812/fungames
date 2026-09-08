/**
 * Why you cannot fold a sheet of paper eight times.
 *
 * The usual answer is that the paper "gets too strong", which is wrong and is
 * also the boring answer. The real one is geometric, and Britney Gallivan
 * worked it out in 2002 while still at school: every fold has to bend the
 * whole accumulated stack through 180°, and the material that goes round that
 * bend is no longer available to be folded. The stack halves in length each
 * time, but the length eaten by the rounded edges grows like 4^n. That race is
 * lost quickly, and it is lost at seven folds for a sheet of A4 whatever you
 * are made of.
 *
 * Two equations, both hers.
 *
 *   Folding always in the same direction, a strip of thickness `t` needs a
 *   length of
 *
 *       L = (π t / 6) (2^n + 4) (2^n − 1)
 *
 *   to reach `n` folds. Folding alternately in two directions, a square sheet
 *   needs a side of
 *
 *       W = π t 2^(3(n−1)/2)
 *
 * They are the reason this file exists rather than a `2 ** n`: the fold count
 * is not a free parameter of the game, it is a property of a real sheet, and
 * `check-fold.mjs` holds the model to two measured facts — a sheet of A4 folds
 * seven times, and Gallivan's own 1,219-metre roll folded twelve.
 *
 * Everything here is millimetres, and everything is a pure function of a
 * sheet. The page draws; this decides.
 */

export type Mode = 'single' | 'alternate'

export type Sheet = {
  id: string
  name: string
  /** What it actually is, for the caption. */
  note: string
  /** Millimetres. */
  thickness: number
  /** Millimetres, the long side — the one a single-direction fold runs along. */
  length: number
  /** Millimetres, the short side. An alternating fold is limited by this. */
  width: number
}

/**
 * Real sheets, with real numbers.
 *
 * Thicknesses are ordinary published figures for the material: 80 gsm office
 * paper is a tenth of a millimetre, a beaten gold leaf is about a ten-thousandth
 * of one. The roll is the one Gallivan actually used.
 */
export const SHEETS: Sheet[] = [
  {
    id: 'a4',
    name: 'A sheet of A4',
    note: '80 gsm office paper, 0.1 mm thick. The sheet in every printer.',
    thickness: 0.1,
    length: 297,
    width: 210,
  },
  {
    id: 'note',
    name: 'A banknote',
    note: 'Cotton paper, thinner and tougher than it looks.',
    thickness: 0.11,
    length: 146,
    width: 77,
  },
  {
    id: 'tissue',
    name: 'A tissue',
    note: 'Two thin plies, and much more give than paper.',
    thickness: 0.05,
    length: 210,
    width: 210,
  },
  {
    id: 'roll',
    name: "Gallivan's roll",
    // The count is computed and printed after this, so saying it here too
    // gave "She folded it twelve times. Folded this way it goes 12 times."
    note: '1,219 metres of toilet paper in one strip, bought for the attempt in 2002.',
    thickness: 0.1,
    length: 1_219_000,
    width: 100,
  },
  {
    id: 'pitch',
    name: 'A football pitch of tissue',
    note: 'One sheet, 105 by 68 metres. You would need machinery.',
    thickness: 0.05,
    length: 105_000,
    width: 68_000,
  },
  {
    id: 'leaf',
    name: 'Gold leaf',
    note: 'Beaten to 100 nanometres — a thousand times thinner than paper.',
    thickness: 0.0001,
    length: 80,
    width: 80,
  },
]

export const sheetById = (id: string) => SHEETS.find((s) => s.id === id)

/** Gallivan: the strip length needed to fold `n` times in one direction. */
export const lengthForFolds = (t: number, n: number) =>
  ((Math.PI * t) / 6) * (2 ** n + 4) * (2 ** n - 1)

/** Gallivan: the side of a square needed to fold `n` times, alternating. */
export const sideForFolds = (t: number, n: number) => Math.PI * t * 2 ** (1.5 * (n - 1))

/** What one more fold would cost, on top of what the previous ones already did. */
export const costOfFold = (t: number, n: number, mode: Mode) =>
  mode === 'single'
    ? lengthForFolds(t, n) - lengthForFolds(t, n - 1)
    : sideForFolds(t, n) - (n > 1 ? sideForFolds(t, n - 1) : 0)

/** The paper you must have to reach `n` folds, and the paper you do have. */
export function need(sheet: Sheet, n: number, mode: Mode): number {
  return mode === 'single'
    ? lengthForFolds(sheet.thickness, n)
    : sideForFolds(sheet.thickness, n)
}

export const have = (sheet: Sheet, mode: Mode) =>
  mode === 'single' ? sheet.length : Math.min(sheet.length, sheet.width)

/**
 * How big the sheet still is after `n` folds.
 *
 * `w` is the side the next fold runs across — the one the picture puts under
 * your hand — and `d` is the other one. Folding alternately means they take
 * turns, so after an odd number of folds they have swapped over.
 *
 * This is not the same quantity as `have`, and conflating the two is a mistake
 * worth naming because the page made it: `have(sheet, 'alternate') / 2**n`
 * looks like the remaining width and is not. `have` is the side Gallivan's
 * *alternating* bound is measured against, which is a property of the sheet
 * you started with; halving it n times describes a sheet folded n times the
 * same way. For A4 at seven folds the two answers are 1.6 mm and 26 mm.
 */
export function footprint(sheet: Sheet, n: number, mode: Mode): { w: number; d: number } {
  if (mode === 'single') return { w: sheet.length / 2 ** n, d: sheet.width }
  return n % 2 === 0
    ? { w: sheet.length / 2 ** (n / 2), d: sheet.width / 2 ** (n / 2) }
    : { w: sheet.width / 2 ** ((n - 1) / 2), d: sheet.length / 2 ** ((n + 1) / 2) }
}

/**
 * How many times this sheet can actually be folded.
 *
 * Counted rather than solved, because the closed form needs a Lambert W and
 * the count is never above about forty. Zero is a real answer: a sheet of gold
 * leaf 2 mm across cannot be folded at all.
 */
export function maxFolds(sheet: Sheet, mode: Mode): number {
  const room = have(sheet, mode)
  let n = 0
  while (n < 64 && need(sheet, n + 1, mode) <= room) n++
  return n
}

/** Layers after `n` folds. Exact past 2^53, because the game shows the number. */
export const layersAt = (n: number) => (1n << BigInt(n)).toLocaleString('en-US')

/** Millimetres of stack after `n` folds. */
export const thicknessAt = (t: number, n: number) => t * 2 ** n

/**
 * The radius the paper turns through when making fold `n`.
 *
 * Half the stack it has to bend, which is what the rounded edge in the drawing
 * is drawn at. This is the *picture* of the equation above rather than a term
 * in it — the length accounting is Gallivan's and comes from `need`.
 */
export const bendRadius = (t: number, n: number) => (t * 2 ** (n - 1)) / 2

/**
 * How far a fold gets before the paper stops it, from 0 to 1.
 *
 * A fold the sheet has the length for goes all the way. One it does not is not
 * simply refused — paper does not work like that, and neither should the
 * handle. It comes over as far as the shortfall allows and then will not go,
 * which is exactly what the eighth fold of an A4 sheet feels like in your
 * hands: it moves, it just will not close.
 */
export function reach(sheet: Sheet, n: number, mode: Mode): number {
  const room = have(sheet, mode)
  const wanted = need(sheet, n, mode)
  if (wanted <= room) return 1
  // Square-rooted so the last impossible fold still travels visibly, rather
  // than every one of them dying in the same first millimetre.
  return Math.max(0.08, Math.min(0.62, Math.sqrt(room / wanted)))
}

/** Millimetres, in whatever unit stops the number being unreadable. */
export function mm(v: number): string {
  const abs = Math.abs(v)
  if (abs < 0.001) return `${(v * 1e6).toFixed(0)} nanometres`
  if (abs < 1) return `${v.toFixed(v < 0.1 ? 3 : 2)} mm`
  if (abs < 1000) return `${v < 10 ? v.toFixed(1) : v.toFixed(0)} mm`
  if (abs < 1e6) return `${(v / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })} m`
  return `${(v / 1e6).toLocaleString('en-US', { maximumFractionDigits: 1 })} km`
}

/* -------------------------------------------------------------------------- */
/* The picture                                                                */
/* -------------------------------------------------------------------------- */

export type Profile = {
  /** One entry per drawn layer, top to bottom, as fractions of the box. */
  layers: { y: number; h: number }[]
  /** True when there were too many layers to draw and they are one block. */
  merged: boolean
}

/**
 * The stack, edge-on, for `n` folds inside a box `boxH` tall.
 *
 * Individual layers while they can still be told apart, and one solid block
 * once they cannot. The alternative — drawing 2^30 hairlines — is not a more
 * honest picture of a stack, it is a grey rectangle that took longer.
 */
export function profile(n: number, boxH: number, minGap = 1.6): Profile {
  const count = 2 ** n
  const h = boxH / count
  if (count > 64 || h < minGap) return { layers: [{ y: 0, h: boxH }], merged: true }
  return {
    layers: Array.from({ length: count }, (_, i) => ({ y: i * h, h })),
    merged: false,
  }
}

/**
 * The outline of a sheet caught mid-fold, as an SVG path.
 *
 * A flat run, a half-turn of radius `r`, and the lifted flap coming back over
 * it at angle `u`·180°. Drawn in the box's own units; the caller decides what
 * a millimetre is worth on screen.
 */
export function foldPath(
  x0: number,
  x1: number,
  y: number,
  thick: number,
  u: number,
  r: number,
): string {
  const a = Math.PI * Math.max(0, Math.min(1, u))
  const hinge = x1
  const cy = y - r
  // Where the flap's far end has swung to.
  const len = x1 - x0
  const tipX = hinge - Math.cos(a) * len
  const tipY = cy - Math.sin(a) * len
  const nx = Math.sin(a) * thick
  const ny = -Math.cos(a) * thick
  return (
    `M${x0.toFixed(2)} ${y.toFixed(2)}` +
    `L${hinge.toFixed(2)} ${y.toFixed(2)}` +
    `A${r.toFixed(2)} ${r.toFixed(2)} 0 0 0 ${(hinge - Math.cos(a) * 0).toFixed(2)} ${(cy - r).toFixed(2)}` +
    `L${tipX.toFixed(2)} ${tipY.toFixed(2)}` +
    `l${nx.toFixed(2)} ${ny.toFixed(2)}` +
    `L${(hinge + thick).toFixed(2)} ${(y + thick).toFixed(2)}` +
    `L${x0.toFixed(2)} ${(y + thick).toFixed(2)}Z`
  )
}
