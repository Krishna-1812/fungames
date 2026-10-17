/**
 * The island's people, as Unity models and renders them (unity/Assets/Island/
 * Editor/Actors.cs), on the realistic island.
 *
 * Everyone is a spec: their shirt's colour, their skin's, a hat's (or none),
 * and a number that picks the rest in Unity (their build, their hair, what
 * they wear below the waist), so the same person always looks the same. Each
 * picture of them is one pose of one facing (and for a stride, one of its
 * frames), named from all that; the island writes down every one it draws
 * (actorsWanted), scripts/export-island.mjs hands the list to Unity, and
 * scripts/unity-actors.mjs brings the pictures back into src/lib/island/
 * actors/, where figures.ts reads them with the trees. Until a picture is
 * there, the person is drawn as before.
 *
 * Someone walking a path (walker) carries all four facings, each shown only
 * while they head that way (opacity keyframes made from their path), and in
 * each, the frames of their stride, turning over as they go.
 */
import { N, r1 as f, motionCss, type MotionFrame } from './kit'
import { figureItem, figuresUsed } from './props'

export type Facing = 'se' | 'sw' | 'nw' | 'ne' | 's' | 'w' | 'n' | 'e'
/** The eight headings, round from +i (the site's se) through +j (sw): for boats, which turn as they go. */
export const HEADINGS: Facing[] = ['se', 's', 'sw', 'w', 'nw', 'n', 'ne', 'e']
export type Pose = 'stand' | 'wave' | 'look' | 'phone' | 'walk' | 'ground' | 'kite' | 'sit' | 'balance'
export type Who = { shirt: string; skin: string; hat: string | null; v: number }
export type Creature = 'sheep' | 'deer' | 'duck' | 'crab' | 'gull' | 'pigeon' | 'dolphin' | 'whale' | 'bfly' | 'cloud' | 'balloon' | 'plane' | 'dog' | 'robot' | 'globe' | 'pod' | 'yacht' | 'atom' | 'buoy' | 'pixelballoon' | 'stork' | 'cart' | 'bottle' | 'jetski'
export type Kind = 'person' | 'car' | 'bus' | 'bike' | 'sail' | 'ferry' | 'fishing' | 'speed' | 'row' | Creature
export type ActorRec = { name: string; kind: Kind; shirt: string; skin: string; hat: string; v: number; pose: Pose | 'drive' | 'up' | 'down' | 'swim' | 'peck' | `c${number}` | `f${number}`; facing: Facing; frame: number }

/** The frames of a stride, and how long one stride takes (a step with each foot). */
export const WALK_FRAMES = 8
export const STRIDE = 0.5

const SKINS = ['#f1d9c6', '#e8c4a8', '#d3a27f', '#a8714e', '#7a4b32', '#563626']
const hex = (c: string) => c.replace('#', '').toLowerCase()
const hash = (a: number, b: number) => { const v = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return v - Math.floor(v) }

/** A person: their shirt, and a seed for the rest (their skin and the number Unity picks the rest by), unless given. */
export function who(shirt: string, seed: number, o: { skin?: string; hat?: string | null; v?: number } = {}): Who {
  return { shirt, skin: o.skin ?? SKINS[Math.floor(hash(seed, 1) * SKINS.length)], hat: o.hat ?? null, v: o.v ?? Math.floor(hash(seed, 2) * 64) }
}

/** Every picture the island draws, for Unity to render. */
export const actorsWanted = new Map<string, ActorRec>()
let on = false
/** Whether the people are Unity's (the realistic island): set with the figures. */
export function setActors(yes: boolean) { on = yes; actorsWanted.clear() }
/** Whether the people are Unity's. */
export const actorsOn = () => on

export function actorName(w: Who, pose: Pose, facing: Facing, frame = 0) {
  return `p-${hex(w.shirt)}-${hex(w.skin)}-${w.hat ? hex(w.hat) : '0'}-${w.v}-${pose}-${facing}${pose === 'walk' ? `-${frame}` : ''}`
}

/** A picture of someone, at the origin: written down, and drawn if Unity has made it (else null). */
export function actorUse(w: Who, pose: Pose, facing: Facing, frame = 0, attrs: Record<string, string | number | undefined> = {}): N | null {
  // Written down whether or not they are drawn: the list is for Unity (scripts/export-island.mjs).
  const name = actorName(w, pose, facing, frame)
  actorsWanted.set(name, { name, kind: 'person', shirt: hex(w.shirt), skin: hex(w.skin), hat: w.hat ? hex(w.hat) : '0', v: w.v, pose, facing, frame })
  if (!on || !figureItem(name)) return null
  figuresUsed.add(name)
  return new N('use', { href: `#fig-${name}`, ...attrs })
}

/** A car, the bus or a bike (with its rider), in its colour, facing one way: written down, and drawn if Unity has made it. */
export function vehicleUse(kind: 'car' | 'bus' | 'bike', body: string, facing: Facing): N | null {
  const name = `v-${kind}-${hex(body)}-${facing}`
  actorsWanted.set(name, { name, kind, shirt: hex(body), skin: '0', hat: '0', v: 7, pose: 'drive', facing, frame: 0 })
  if (!on || !figureItem(name)) return null
  figuresUsed.add(name)
  return new N('use', { href: `#fig-${name}` })
}

/** A boat in its colour, on one of eight headings: written down, and drawn if Unity has made it. */
export function boatUse(kind: 'sail' | 'ferry' | 'fishing' | 'speed' | 'row', hull: string, facing: Facing, attrs: Record<string, string | number | undefined> = {}): N | null {
  const name = `v-${kind}-${hex(hull)}-${facing}`
  actorsWanted.set(name, { name, kind, shirt: hex(hull), skin: '0', hat: '0', v: 7, pose: 'drive', facing, frame: 0 })
  if (!on || !figureItem(name)) return null
  figuresUsed.add(name)
  return new N('use', { href: `#fig-${name}`, ...attrs })
}

/** The pictures the page itself draws on its canvas (lib/island/play.ts: the pigeons, the parade), by name; written down for Unity. */
export type Sprites = { pigeon: Record<'stand' | 'peck' | 'up' | 'down', [string, string]>; marchers: string[][][]; dog: string[][] }
export const FOUR: Facing[] = ['se', 'sw', 'nw', 'ne']
export function spriteNames(crowd: Who[]): Sprites {
  const pig = (pose: ActorRec['pose'], a: Facing, b: Facing): [string, string] => [a, b].map((h) => { creatureUse('pigeon', '#8e93a6', pose, h); return `a-pigeon-8e93a6-${pose}-${h}` }) as [string, string]
  return {
    pigeon: { stand: pig('stand', 'se', 'sw'), peck: pig('peck', 'se', 'sw'), up: pig('up', 'e', 'w'), down: pig('down', 'e', 'w') },
    marchers: crowd.map((w) => FOUR.map((h) => Array.from({ length: WALK_FRAMES }, (_, k) => { actorUse(w, 'walk', h, k); return actorName(w, 'walk', h, k) }))),
    dog: FOUR.map((h) => Array.from({ length: 4 }, (_, k) => { creatureUse('dog', '#d8d2cc', `c${k}`, h); return `a-dog-d8d2cc-c${k}-${h}` })),
  }
}

/** An animal, in its colour, in a pose, facing one way: written down, and drawn if Unity has made it. */
export function creatureUse(kind: Creature, colour: string, pose: ActorRec['pose'], facing: Facing, attrs: Record<string, string | number | undefined> = {}, alt?: string): N | null {
  const name = `a-${kind}-${hex(colour)}${alt ? '_' + hex(alt) : ''}-${pose}-${facing}`
  actorsWanted.set(name, { name, kind, shirt: hex(colour), skin: alt ? hex(alt) : '0', hat: '0', v: 3, pose, facing, frame: 0 })
  if (!on || !figureItem(name)) return null
  figuresUsed.add(name)
  return new N('use', { href: `#fig-${name}`, ...attrs })
}

/** The nearest of the eight headings to a step on screen (dx, dy). */
export function headingOf(dx: number, dy: number): Facing {
  // Screen to the ground's own axes: i runs down-right, j down-left.
  const di = dx / 64 + dy / 32, dj = dy / 32 - dx / 64
  const k = Math.round(Math.atan2(dj, di) / (Math.PI / 4))
  return HEADINGS[((k % 8) + 8) % 8]
}

/**
 * Something carried along a path (motionPath's frames) that turns to face
 * its way: a picture for each heading it takes, each shown while it heads
 * that way. `pic` makes the picture for a heading (null if not made yet).
 */
export function onPath(pic: (h: Facing) => N | null, name: string, frames: MotionFrame[], dur: string, delay: string, eight = true): N | null {
  const heads: Facing[] = []
  for (let i = 0; i + 1 < frames.length; i++) { const dx = frames[i + 1][1] - frames[i][1], dy = frames[i + 1][2] - frames[i][2]; heads.push(eight ? headingOf(dx, dy) : facingOf(dx, dy)) }
  const g = new N('g', { class: 'actor' })
  let missing = false
  for (const face of [...new Set(heads)]) {
    const stops: string[] = []
    for (let i = 0; i < heads.length; i++) {
      const t = frames[i][0]
      if (i > 0) stops.push(`${Math.max(0, Math.round((t - 0.05) * 100) / 100)}%{opacity:${heads[i - 1] === face ? 1 : 0}}`)
      stops.push(`${Math.round(t * 100) / 100}%{opacity:${heads[i] === face ? 1 : 0}}`)
    }
    stops.push(`100%{opacity:${heads[heads.length - 1] === face ? 1 : 0}}`)
    const u = pic(face)
    if (!u) { missing = true; continue }
    if (on) motionCss.push(`@keyframes ${name}-${face}{${stops.join('')}}`)
    g.add(new N('g', { style: `animation:${name}-${face} ${dur} linear infinite ${delay}` })).add(u)
  }
  return missing ? null : g
}

/** Which way a step from a to b heads, on the site's diagonals. */
export function facingOf(dx: number, dy: number): Facing {
  return dx >= 0 ? (dy >= 0 ? 'se' : 'ne') : dy >= 0 ? 'sw' : 'nw'
}

/**
 * Someone walking a path made by motionPath (its frames), on a mover whose
 * animation is `anim` (its duration and delay, as in its style): their four
 * facings, each shown while they head that way, each a stride turning over.
 * Null if Unity has not made them yet.
 */
export function walker(w: Who, name: string, frames: MotionFrame[], dur: string, delay: string): N | null {
  // Which way each stretch of the path heads.
  const heads: Facing[] = []
  for (let i = 0; i + 1 < frames.length; i++) heads.push(facingOf(frames[i + 1][1] - frames[i][1], frames[i + 1][2] - frames[i][2]))
  const used = [...new Set(heads)]
  const g = new N('g', { class: 'actor' })
  let missing = false
  for (const face of used) {
    // Shown while heading this way: the switch is all but instant at each corner.
    const stops: string[] = []
    for (let i = 0; i < heads.length; i++) {
      const t = frames[i][0], v = heads[i] === face ? 1 : 0
      if (i > 0) stops.push(`${Math.max(0, Math.round((t - 0.05) * 100) / 100)}%{opacity:${heads[i - 1] === face ? 1 : 0}}`)
      stops.push(`${Math.round(t * 100) / 100}%{opacity:${v}}`)
    }
    stops.push(`100%{opacity:${heads[heads.length - 1] === face ? 1 : 0}}`)
    if (on) motionCss.push(`@keyframes ${name}-${face}{${stops.join('')}}`)
    const fg = g.add(new N('g', { style: `animation:${name}-${face} ${dur} linear infinite ${delay}` }))
    for (let k = 0; k < WALK_FRAMES; k++) {
      // Every frame asked for, whether or not Unity has made it yet.
      const u = actorUse(w, 'walk', face, k, { class: 'stride', style: `animation-delay:${f(-(k * STRIDE) / WALK_FRAMES)}s` })
      if (u) fg.add(u); else missing = true
    }
  }
  return missing ? null : g
}
