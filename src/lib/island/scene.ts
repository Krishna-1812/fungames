/**
 * Tiny Island — the baked map, as the engine reads it.
 *
 * At build time (lib/island/bake) the island's SVG is taken apart into what
 * never moves and what does. Everything that stands still is painted once,
 * at five sizes, into square pictures a screen's width apart ("cells"); the
 * engine (lib/island/engine) draws those, and on top of them, in their right
 * places in the painting order, the few things that move, either as small
 * pictures of their own (sprites) or, for the simplest shapes, drawn again
 * each frame from their outlines. This file is the contract between the two.
 *
 * Coordinates are the island's own SVG user units throughout ("world").
 */

/** An affine transform, as SVG writes one: x' = a x + c y + e, y' = b x + d y + f. */
export type M = [number, number, number, number, number, number]
/** A box: x0, y0, x1, y1. */
export type Box = [number, number, number, number]

/** One transform function, with any percentages kept apart to be resolved against a box. */
export type Fn =
  | ['t', number, number, number, number] // translate: x, y, x%, y%
  | ['s', number, number] // scale
  | ['r', number] // rotate, degrees
  | ['kx', number] // skewX, degrees
  | ['ky', number] // skewY, degrees

/** A keyframe stop: where it falls (0..1) and what it sets. Unset means "not at this stop". */
export type Stop = { at: number; tf?: Fn[] | null; op?: number; fill?: string; doff?: number }
export type Keyframes = Stop[]

/** One running animation on a node, everything resolved for that node. */
export type Anim = {
  kf: string
  /** Seconds. */
  dur: number
  delay: number
  ease: string
  /** Infinity for a loop (written -1 in the scene file: JSON has no Infinity). */
  iter: number
  /** 0 normal, 1 reverse, 2 alternate, 3 alternate-reverse. */
  dir: number
  /** 0 none, 1 forwards, 2 backwards, 3 both. */
  fill: number
  /** The point it turns and scales round, in the node's own coordinates. */
  org: [number, number]
  /** The box a translate's percentages are of. */
  ref: [number, number]
}

/** When something is there at all: the time of day, the season, the hour. */
export type When = { time?: string[]; season?: string[]; hour?: number[] }

/** How a vector shape is painted. */
export type Style = {
  f?: string | null // fill colour, null for none
  fo?: number
  s?: string | null // stroke colour
  so?: number
  w?: number
  cap?: CanvasLineCap
  join?: CanvasLineJoin
  dash?: number[]
  doff?: number
  op?: number
  rule?: CanvasFillRule
}

export type Node =
  /** A group: a transform, animations, an opacity, things inside. */
  | {
      k: 'g'
      m?: M
      a?: Anim[]
      op?: number
      when?: When
      /** A clip, as path data in this group's own coordinates. */
      clip?: string
      /** Classes the engine looks for (the windmill's sails, a cloud...). */
      tags?: string[]
      /** A building (its slug) or a thing to poke (its kind). */
      lm?: string
      poke?: string
      /** Where to turn and lift a poke from: the foot of what is poked. */
      pokeOrg?: [number, number]
      /** The node's own box, in its own coordinates (CSS fill-box), for inner reactions. */
      fb?: Box
      /** Its reach in its parent's coordinates (the world, at the top), every pose of every animation included: for culling. Absent for groups of cell painting. */
      bb?: Box
      /** What it contains, back to front. */
      kids: Node[]
      /** Animations replace the transform attribute (as CSS does): this is that attribute. */
      base?: M
      data?: Record<string, string>
    }
  /** Still painting, cut into cells: drawn by the engine from the cell pictures. */
  | { k: 'run'; id: number }
  /** A small still picture, drawn in its group's coordinates. */
  | { k: 'spr'; id: number }
  /** A simple shape, drawn from its outline every frame. */
  | { k: 'v'; d: string; st: Style; m?: M; a?: Anim[]; base?: M; when?: When; tags?: string[]; data?: Record<string, string>; fb?: Box; bb?: Box }
  /** A line of lettering, drawn with the page's own fonts. */
  | { k: 'txt'; s: string; x: number; y: number; m?: M; font: string; fill: string | null; stroke?: string | null; sw?: number; op?: number; anchor: CanvasTextAlign; bl: CanvasTextBaseline; ls?: number; a?: Anim[]; tags?: string[]; bb?: Box }
  /** The open sea: a radial gradient as wide as the sky. */
  | { k: 'sea'; cx: number; cy: number; r: number; sy: number; stops: [number, string][]; rect: Box }

/** A sprite: where it sits (in its group's coordinates) and where each size of it is. */
export type Sprite = {
  /** Its box in its group's coordinates. */
  box: Box
  /** World units to one of its own (its groups' scale): level k is painted at levels[k] × u pixels to its unit. */
  u: number
  /** Per level: page index, x, y, width, height in that page. Absent above its largest size. */
  at: ([number, number, number, number, number] | null)[]
}

/** A sheet of sprites at one level. */
export type Page = { file: string; w: number; h: number; level: number; group: number }

/**
 * One level's index (L<n>.json): for each cell that has anything in it, by
 * day and by night, its pieces, seven numbers each: the run it is drawn at,
 * where it is in the cell's image (x, y, w, h), and where in the cell (x, y).
 * Cells are numbered row by row from the extent's top left.
 */
export type LevelIndex = { cols: number; rows: number; day: Record<number, number[]>; night: Record<number, number[]> }

export type Scene = {
  v: 1
  hash: string
  /** The island's SVG viewBox. */
  view: Box
  /** Pixels per world unit at each level, smallest first. */
  levels: number[]
  /** A cell is this many pixels square at every level. */
  cell: number
  /** The world box the cells cover. */
  extent: Box
  /** Per level: its grid of cells, and the file that says what is in each. */
  lv: { scale: number; cols: number; rows: number; index: string }[]
  /** The painting, back to front: the top-level layers. */
  root: Node[]
  keyframes: Record<string, Keyframes>
  sprites: Sprite[]
  pages: Page[]
  /** Sprite groups: the world box whose sprites each group holds. */
  groups: Box[]
  /** Hit masks: per building or poke, a bitmap in its own coordinates. */
  masks: Record<string, { box: Box; res: number; w: number; h: number; bits: string }>
  /** Every kind of thing there is to poke. */
  pokes: string[]
  /** The island's still painting by day, small, over the sea, covering the view: shown until the canvas can draw. */
  poster: { file: string; w: number; h: number } | null
}

/**
 * The scene as its file holds it. JSON has no Infinity, so a loop's count is
 * written -1; any other number that is not finite is a fault in the bake
 * (JSON would quietly write it as null, and the engine read that as 0), so
 * it stops the bake here, naming where it was.
 */
export function sceneJson(s: Scene): string {
  return JSON.stringify(s, function (key, v) {
    if (typeof v === 'number' && !Number.isFinite(v)) {
      if (key === 'iter' && v === Infinity) return -1
      throw new Error(`[island] the baked scene has ${v} for "${key}" in ${JSON.stringify(this).slice(0, 200)}`)
    }
    // A thousandth of a unit is far under a pixel even at the closest zoom (eight pixels a unit).
    if (typeof v === 'number') return Math.round(v * 1000) / 1000
    return v
  })
}

/** The scene read back from its file: loops endless again. */
export function sceneFrom(s: Scene): Scene {
  const fix = (n: Node) => {
    if ('a' in n && n.a) for (const a of n.a) if (a.iter < 0) a.iter = Infinity
    if (n.k === 'g') n.kids.forEach(fix)
  }
  s.root.forEach(fix)
  return s
}
