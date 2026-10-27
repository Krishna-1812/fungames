/**
 * Tiny Island — the whole map, built once at build time.
 *
 * The ground is a grid of tiles: which ones are land is the union of the
 * seven districts (each a wobbly disc), plus every building's footprint.
 * Only Sky Peaks rises; everything else sits one step above the sea. Roads
 * are found, not drawn: a path search from every district to the middle of
 * Old Town that walks round the buildings, so a road never runs under one.
 * People walk those roads; boats sail round the coast; clouds and birds go
 * over the top. Everything is painted back to front.
 */
import { look, signBoxes, printsWanted, puffShade, C, INK, N, OUT, P, Pen, render, rng, shade, mix, S, Bounds, motionCss, motionPath, r1, joinRoot, glows, type Light, Solids, type Solid, type MotionFrame } from './kit'
import { type Who } from './actors'
import { setActors, walker, who, actorsWanted, onPath, boatUse, headingOf, creatureUse, spriteNames, type ActorRec, type Sprites } from './actors'
import { folkPic } from './folk'
import { figFeet, tree, person, lamp, bench, flowers, walkerFigure, sailboat, birds, cloudShape, cloudModel, type TreeKind, setFigures, figureDefs, planted, type Planted } from './props'
import type { FigureSet, BuildingSet } from './figures'
import type { SkyArt } from './plate'
import { LANDMARKS, DISTRICTS, PLACES, type DistrictKey, type District } from './landmarks'
import { beacon, harbourArt } from './lm-harbour'
import { hotAirBalloon, plane as skyPlane, ufo } from './sky'
import { cottage, postbox, signpost, crossing, busStop, fountain, sitter, picnic, kiteFlyer, playground, umbrella, towel, sandcastle, lifeguard, surfboard, pier, rowboat, buoy, tent, campfire, shuttle, stall, stringLights, ferry, fishingBoat, speedboat, secretIslet, house32, sayBubble, beachBottle, noticeboard, pigeonSquare, type Emblem } from './town'
import { paintGround, LAND, wander } from './terrain'
import { STAMP } from '../passport-art'
import { glassOf, BOTTLE_COUNT } from '../bottles'
import { RULES } from './moves'
import { snowPine, cactus, barrelCactus, reeds, hedge, topiary, toadstools, arch, butte, hoodoo, boulders, field as cropField, bale, windmill, sheep, duck, crab, dolphin, whale, gullStanding, gullsCircling, butterfly, deer, tumbleweed, dawnWhale } from './nature'

export const GRID = 30
const SEA = -12
const BEACH = -6
/** The hot-air balloons: where each loops round (a tile and a height), its two colours, and its start in the loop (s). */
const BALLOONS: [number, number, number, string, string, number][] = [[9, 26, 230, C.rasp, '#ffffff', 0], [26, 10, 260, C.cobalt, C.mint, 40]]
/** The two fishing boats moored off the coast: a tile, the hull's colour, and when each starts to bob. */
const FISHING: [number, number, string, number][] = [[31.6, 11.4, C.mint, 0], [-2.6, 9.2, C.rasp, 2.2]]
/** Piers: a run of ground points from a beach out over the water. */
const PIERS: [number, number][][] = [[[5.5, 17.2], [5.5, 14.3]], [[14.5, 29.4], [14.5, 31.7]], [[21.5, 27.3], [21.5, 30.1]]]
/** The ferry ties up at the end of the last pier, on its far side; a crossing takes this long. */
const FERRY_DUR = 48
const FERRY = { dock: [21.02, 29.75] as [number, number], from: [21.02, 47] as [number, number] }
const f = (v: number) => Math.round(v * 10) / 10
const f2 = (v: number) => Math.round(v * 100) / 100
/** Sand: two tones for the tops, the wet edge, and the two faces of a step. */
const SAND = ['#f6f0e1', '#efe7d3', '#d9ccad', '#e3d7ba', '#cbbb98']
const key = (i: number, j: number) => `${i},${j}`
/** A colour (#rrggbb) darkened by k. */
const deepen = (hex: string, k: number) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * k).toString(16).padStart(2, '0')).join('')

/** A node and everything in it, again. */
const copyOf = (n: N): N => { const c = new N(n.tag, { ...n.attrs }); for (const k of n.kids) c.kids.push(typeof k === 'string' ? k : copyOf(k)); return c }

/** Classes that move or change by themselves (moves.ts), and the engine's own: an outline of them would be left behind. */
const MOVES = new Set([...RULES.flatMap((r) => (r.loop || r.base ? r.on : [])), 'mover', 'amb', 'walker', 'visitor', 'lm-ring', 'pk'])
/** How much further the line round a building's outside reaches than its own lines. */
const RIM = 1.6
/**
 * A heavier line round the outside of a building: each of its outlined
 * shapes once more, underneath it, in ink and wider, so that only the part
 * outside the building shows. Inside, every line stays as drawn; outside, the
 * building is drawn round twice as heavily as anything on the ground, and
 * stands up off it. Left out: whatever moves (a still outline would be left
 * behind it), and whatever is faint or not drawn round in ink (shading,
 * glints, glass, lettering).
 */
/**
 * A colour towards paint: saturation above a little over half is pulled in by
 * half, the very lightest whites come down to a soft cool stone, and the
 * hue is kept, so a cobalt is still a cobalt, only a painted one.
 */
function paintGrade(hex: string): string {
  const v = hex.slice(1), r = parseInt(v.slice(0, 2), 16) / 255, g = parseInt(v.slice(2, 4), 16) / 255, b = parseInt(v.slice(4, 6), 16) / 255
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn
  let h = 0, s = 0
  if (d > 0) {
    s = d / (1 - Math.abs(2 * l - 1))
    h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4
    h *= 60
  }
  const S2 = s > 0.5 ? 0.5 + (s - 0.5) * 0.45 : s, L2 = l > 0.94 ? 0.94 + (l - 0.94) * 0.4 : l
  const C2 = (1 - Math.abs(2 * L2 - 1)) * S2, X = C2 * (1 - Math.abs(((h / 60) % 2 + 2) % 2 - 1)), m = L2 - C2 / 2
  const hh = ((h % 360) + 360) % 360
  const [R, G, B] = hh < 60 ? [C2, X, 0] : hh < 120 ? [X, C2, 0] : hh < 180 ? [0, C2, X] : hh < 240 ? [0, X, C2] : hh < 300 ? [X, 0, C2] : [C2, 0, X]
  return '#' + [R, G, B].map((c) => Math.max(0, Math.min(255, Math.round((c + m) * 255))).toString(16).padStart(2, '0')).join('')
}

const rims = new Map<string, string>()
const rimFor = (fill: string) => { let r = rims.get(fill); if (!r) { r = mix(shade(fill, 0.34), INK, 0.55); rims.set(fill, r) } return r }
function rim(art: N): N {
  const out = new N('g', { class: 'lm-rim' })
  const copy = (from: N, into: N) => {
    for (const k of from.kids) {
      if (typeof k === 'string') continue
      const a = k.attrs
      if (String(a.class ?? '').split(/\s+/).some((c) => MOVES.has(c)) || String(a.style ?? '').includes('animation') || a['data-poke'] !== undefined) continue
      if ((a.opacity !== undefined && Number(a.opacity) < 1) || (a['fill-opacity'] !== undefined && Number(a['fill-opacity']) < 1) || a.mask || a.filter) continue
      if (k.tag === 'g' || k.tag === 'a') {
        const g = into.add(new N('g', { transform: a.transform, 'clip-path': a['clip-path'] }))
        copy(k, g)
        if (!g.kids.length) into.kids.pop()
        continue
      }
      if (!['path', 'polygon', 'rect', 'circle', 'ellipse'].includes(k.tag)) continue
      const sw = Number(a['stroke-width'] ?? OUT)
      if (a.stroke !== INK || !a.fill || a.fill === 'none' || a.fill === 'transparent' || !(sw >= 1)) continue
      const { class: _c, id: _i, style: _s, opacity: _o, 'data-l': _l, 'data-la': _la, 'stroke-linecap': _cap, ...shape } = a
      // The cartoon island's rim is a deep shade of what it rims (a red roof in deep red), and finer.
      const ink = look.soft && typeof a.fill === 'string' && /^#[0-9a-f]{6}$/i.test(a.fill) ? rimFor(a.fill) : INK
      into.add(new N(k.tag, { ...shape, fill: ink, stroke: ink, 'stroke-width': sw + (look.soft ? RIM * 1.25 : RIM * 2) }))
    }
  }
  copy(art, out)
  return out
}

export type Anchor = { slug: string; district: DistrictKey; x0: number; y0: number; x1: number; y1: number; bx: number; by: number; foot: string }
export type Layer = { kind: 'sea' | 'surf' | 'boats' | 'beam' | 'weather' | 'ground' | 'walkers' | 'things' | 'landmark' | 'night' | 'banners' | 'sky'; slug?: string; body: string }
/** A message in a bottle: its number, where it lies (in tiles), and the district whose shore it is on. */
export type Bottle = { n: number; i: number; j: number; district: DistrictKey }
/** A signpost: where it stands (in tiles), and the district each of its boards points to. */
export type Signpost = { i: number; j: number; at: [number, number]; boards: { dx: number; dy: number; to: DistrictKey; steps: number }[] }
/**
 * What the page brings to life on the map itself (lib/island/play.ts): the
 * square the pigeons live on, the noticeboard beside it, the stretch of beach
 * the ball can roll on, and for every building the roads from the town square
 * to its door, for the day's parade. All in tiles.
 */
export type PlayData = { square: [number, number]; board: [number, number]; ball: { at: [number, number]; cells: [number, number][] }; routes: Record<string, [number, number][]>; sprites?: (Sprites & { id: string }) | null; folk?: import('./play').FolkPic[] }
/**
 * The island as facts rather than a picture, for anything that draws it
 * another way (the Unity scene in unity/, which renders it in 3D): every
 * tile's ground, height and district, the water, the roads, the fields, and
 * where each building stands. Tiles are [i, j]; heights are in the same screen
 * units as P()'s z.
 */
export type IslandModel = {
  grid: number; tile: number; sea: number; beachZ: number
  /** A letter a tile, i * grid + j: 0 sea, 1 land, b beach. */
  ground: string
  height: number[][]
  district: string[][]
  river: [number, number][]; pond: [number, number][]; road: [number, number][]
  /** The roads as drawn: lines through tile middles. */
  routes: [number, number][][]
  wash: [number, number][] | null
  fields: [number, number, number, number, string][]
  mill: [number, number] | null; bales: [number, number][]; arch: [number, number] | null
  buttes: [number, number, number][]; hoodoos: [number, number][]; boulders: [number, number][]
  piers: [number, number][][]
  buildings: { slug: string; district: string; i: number; j: number; w: number; d: number; z: number; water: boolean }[]
  /** Every tree, rock and cactus, by figure name (props.ts), where it stands. */
  plants: Planted[]
  /** Every picture of a person the island draws, for Unity (lib/island/actors.ts). */
  actors: ActorRec[]
  /** The rocks standing in the sea: tile i, j, and size. */
  seaRocks: [number, number, number][]
  /** The stones at the waterline: tile x, y (not tile corners: where they stand), and size. */
  shoreRocks: [number, number, number][]
  /** Banks of sand out of the sea, and trenches in it: tile i, j, radius in tiles, the top's height. */
  isles: [number, number, number, number][]
  /** Each building's solids (kit.ts, Solids), in their runs, for Unity to build. */
  solids: { slug: string; runs: Solid[][]; /** A set piece: built this much bigger about this point (tile i, j, height z). */ k?: number; at?: [number, number, number] }[]
  /**
   * The night's lights, for Unity to light the island from: where each is (tile i, j, height z), what it is
   * ('win' a window, with the face it looks out of; 'lamp' a street lamp; 'bulb' anything else that glows),
   * its colour, and whether it is on tonight (about one window in five stays dark).
   */
  lights: { i: number; j: number; z: number; kind: 'win' | 'lamp' | 'bulb'; face?: 'x' | 'y'; col: string; lit: boolean }[]
  /** Artwork printed on what Unity builds (kit.ts, print): its name, size in screen pixels, and its drawing. */
  prints: { name: string; w: number; h: number; svg: string }[]
  viewBox: [number, number, number, number]
}
/** The parade's marchers as the cartoon island draws them (play.ts): the drum major, the flag, a drum, a trumpet, two children. */
const PARADE: [number, string, number][] = [[61.3, '#5b82ff', 1.04], [72.9, '#2c355e', 1.04], [84.1, '#ffffff', 1.04], [95.7, '#4fe3c1', 1.04], [17.2, '#ff4f6e', 0.85], [23.8, '#b8a1ff', 0.85]]
export type Island = { land: [number, number, number, number]; hiddenLights: number; svg: string; layers: Layer[]; css: string; viewBox: [number, number, number, number]; moon: { x: number; y: number; run: number }; anchors: Record<string, Anchor>; lights: [number, number][]; banners: Record<string, [number, number]>; mini: string; bottles: Bottle[]; signposts: Signpost[]; play: PlayData; grid: string; model: IslandModel }
export type GameLink = { slug: string; title: string; blurb: string; href: string }

/**
 * Draws an SVG document into RGBA pixels at a given width: resvg at build
 * time. Given one, the island works out which of its lights something in
 * front hides, so no window glows through a sign at night.
 */
export type Raster = (svg: string, width: number) => { width: number; height: number; pixels: Uint8Array }

/**
 * The ground as Unity renders it (unity/, scripts/unity-plate.mjs): where it
 * lies on the map, a small copy to draw into the SVG, and an id. With one,
 * the island draws that picture in place of its own ground and still
 * shallows; the bake paints the map from the full-size picture (bake/draw.ts).
 */
export type PlateRef = { box: [number, number, number, number]; href: string; id: string; /** The open sea's colour round the picture's edges (scripts/unity-plate.mjs). */ sea?: string }

export function buildIsland(games: GameLink[], opts: { raster?: Raster; plate?: PlateRef | null; glow?: PlateRef | null; sky?: SkyArt | null; figures?: FigureSet | null; buildings?: BuildingSet | null } = {}): Island {
  const plate = opts.plate ?? null
  // The cartoon island is inked in colour, with contact shadows; the realistic one's drawn bits keep plain ink.
  look.soft = !plate
  harbourArt.moon = plate ? opts.sky?.moon ?? null : null
  setFigures(opts.figures ?? null)
  setActors(!!opts.figures)
  const R = rng(20260930)
  motionCss.length = 0
  glows.length = 0
  const D = (k: DistrictKey) => DISTRICTS.find((d) => d.key === k)!

  /* ---- land, height, district ------------------------------------------ */
  const land: boolean[][] = [], height: number[][] = [], dist: District[][] = []
  for (let i = 0; i < GRID; i++) { land[i] = []; height[i] = []; dist[i] = []; for (let j = 0; j < GRID; j++) {
    const c = [i + 0.5, j + 0.5]
    let best = DISTRICTS[0], bd = Infinity, inside = false
    for (const d of DISTRICTS) {
      const r = Math.hypot(c[0] - d.at[0], c[1] - d.at[1])
      const wob = 0.55 * Math.sin(i * 1.27 + j * 0.71) + 0.4 * Math.cos(j * 1.93 - i * 0.43)
      if (r < d.r + wob) inside = true
      if (r / d.r < bd) { bd = r / d.r; best = d }
    }
    land[i][j] = inside; dist[i][j] = best
    const sd = Math.hypot(c[0] - 5.2, c[1] - 5.2)
    height[i][j] = inside && best.key === 'peaks' ? Math.max(0, Math.round(5.2 - sd * 0.62)) * 12 : 0
  } }
  const inGrid = (i: number, j: number) => i >= 0 && j >= 0 && i < GRID && j < GRID
  const isLand = (i: number, j: number) => inGrid(i, j) && land[i][j]

  // Every building stands on its own flat plaza; water buildings stay in the sea.
  const taken = new Map<string, string>()
  const placed = PLACES.map(([slug, district, i, j]) => {
    const lm = LANDMARKS[slug], [w, d] = lm.size
    const cells: [number, number][] = []
    for (let a = Math.floor(i); a < Math.ceil(i + w); a++) for (let b = Math.floor(j); b < Math.ceil(j + d); b++) cells.push([a, b])
    const own = cells.filter(([a, b]) => inGrid(a, b))
    const z = lm.water ? SEA : Math.max(0, ...own.map(([a, b]) => height[a][b]))
    for (const [a, b] of own) { if (!lm.water) { land[a][b] = true; height[a][b] = z; dist[a][b] = D(district) } else land[a][b] = false; taken.set(key(a, b), slug) }
    return { slug, district, i, j, w, d, z, lm, cells: own }
  })
  /**
   * Each district's set piece, on the cartoon island: drawn this much bigger,
   * grown up and back from the front corner of its plot into the open ground
   * behind it (so the roads in front stay clear, and the realistic island,
   * whose picture is Unity's, keeps every plot exactly as it was).
   */
  const HERO: Record<string, number> = { orbit: 1.5, 'deep-time': 1.4, 'steady-hand': 1.45, 'share-this-page': 1.5, overstimulated: 1.45, auction: 1.5, 'every-second': 1.35 }
  // (On the realistic island, as Unity built it: none until its pictures of them are in.)
  const heroK = (slug: string) => (plate ? opts.buildings?.heroes?.[slug] ?? 1 : HERO[slug] ?? 1)
  /** A building's plot as drawn: its own, or for a set piece, the bigger one it grows into. */
  const drawnPlot = (pl: { slug: string; i: number; j: number; w: number; d: number }) => { const k = heroK(pl.slug); return { i: pl.i + pl.w * (1 - k), j: pl.j + pl.d * (1 - k), w: pl.w * k, d: pl.d * k, k } }
  const coast = (i: number, j: number) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => !isLand(i + a, j + b))
  const H = (i: number, j: number) => (isLand(i, j) ? height[i][j] : SEA)

  // The low coast steps down to a beach, half-way to the sea.
  const beach = new Set<string>()
  for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) if (isLand(i, j) && height[i][j] === 0 && !taken.has(key(i, j)) && coast(i, j)) beach.add(key(i, j))
  for (const k of beach) { const [i, j] = k.split(',').map(Number); height[i][j] = BEACH }

  // A river: a spring high on Sky Peaks, falling down the terraces to the sea.
  const river: [number, number][] = []
  for (let j = 4; j < GRID && isLand(7, j); j++) river.push([7, j])
  const wet = new Set(river.map((c) => key(...c)))
  // A pond in the park in Old Town.
  const pond = new Set<string>()
  for (const [i, j] of [[14, 9], [14, 10], [14, 11], [15, 9], [15, 10], [15, 11]]) if (isLand(i, j) && !taken.has(key(i, j))) pond.add(key(i, j))
  // Ground kept for fields, the windmill and the rock formations, so no tree
  // or tuft lands on them. Each is only used if its ground really is free.
  const reserved = new Set<string>()
  const FIELDS: [number, number, number, number, 'lavender' | 'wheat' | 'greens'][] = [[9, 13, 1, 3, 'lavender'], [19, 15, 2, 3, 'wheat'], [22, 19, 2, 3, 'greens']]
  const SPOTS: { mill: [number, number]; bale: [number, number][]; arch: [number, number]; buttes: [number, number, number][]; hoodoos: [number, number][]; boulders: [number, number][] } = { mill: [8, 15], bale: [[8, 16], [9, 12], [21, 15], [21, 16]], arch: [20, 7], buttes: [[22, 3, 34], [25, 6, 26], [18, 5, 20]], hoodoos: [[18, 4], [20, 9], [24, 3]], boulders: [[19, 6], [26, 6], [23, 4], [20, 10]] }

  /* ---- roads: found by searching round the buildings -------------------- */
  const road = new Set<string>()
  const walkable = (i: number, j: number) => isLand(i, j) && height[i][j] === 0 && !taken.has(key(i, j)) && !coast(i, j) && !wet.has(key(i, j)) && !pond.has(key(i, j))
  const nearestFree = (x: number, y: number) => {
    let best: [number, number] = [Math.floor(x), Math.floor(y)], bd = Infinity
    for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) if (walkable(i, j)) { const d = Math.hypot(i + 0.5 - x, j + 0.5 - y); if (d < bd) { bd = d; best = [i, j] } }
    return best
  }
  function search(from: [number, number], to: [number, number]): [number, number][] {
    const open = new Map<string, { c: [number, number]; g: number; f: number; dir: number; prev?: string }>()
    const done = new Map<string, { c: [number, number]; prev?: string }>()
    const hf = (c: [number, number]) => Math.abs(c[0] - to[0]) + Math.abs(c[1] - to[1])
    open.set(key(...from), { c: from, g: 0, f: hf(from), dir: -1 })
    const steps: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]]
    while (open.size) {
      let bk = '', bn: { c: [number, number]; g: number; f: number; dir: number; prev?: string } | null = null
      for (const [k, n] of open) if (!bn || n.f < bn.f) { bk = k; bn = n }
      open.delete(bk); done.set(bk, bn!)
      if (bn!.c[0] === to[0] && bn!.c[1] === to[1]) break
      steps.forEach(([a, b], dir) => {
        const c: [number, number] = [bn!.c[0] + a, bn!.c[1] + b], k = key(...c)
        if (done.has(k) || !walkable(...c)) return
        const g = bn!.g + (road.has(k) ? 0.35 : 1) + (bn!.dir >= 0 && bn!.dir !== dir ? 0.6 : 0)
        const cur = open.get(k)
        if (!cur || g < cur.g) open.set(k, { c, g, f: g + hf(c), dir, prev: bk })
      })
    }
    const out: [number, number][] = []
    let k: string | undefined = key(...to)
    if (!done.has(k)) return out
    while (k) { const n = done.get(k)!; out.unshift(n.c); k = n.prev }
    return out
  }
  const hub = nearestFree(14.8, 12.9)
  const gates = Object.fromEntries(DISTRICTS.map((d) => [d.key, nearestFree(d.at[0] + (d.key === 'peaks' ? 3.6 : 0), d.at[1] + (d.key === 'peaks' ? 3.6 : 0))])) as Record<DistrictKey, [number, number]>
  const routes: [number, number][][] = []
  for (const d of DISTRICTS) if (d.key !== 'oldtown') { const r = search(gates[d.key], hub); if (r.length > 1) { routes.push(r); r.forEach((c) => road.add(key(...c))) } }
  for (const [a, b] of [['market', 'funfair'], ['funfair', 'harbour'], ['harbour', 'proving'], ['proving', 'badlands']] as [DistrictKey, DistrictKey][]) { const r = search(gates[a], gates[b]); if (r.length > 1) { routes.push(r); r.forEach((c) => road.add(key(...c))) } }

  const free = (i: number, j: number) => { const k = key(i, j); return isLand(i, j) && !taken.has(k) && !road.has(k) && !wet.has(k) && !pond.has(k) && !beach.has(k) && !reserved.has(k) }
  const claim = (cells: [number, number][]) => { if (!cells.every(([i, j]) => free(i, j))) return false; cells.forEach(([i, j]) => reserved.add(key(i, j))); return true }
  const fields = FIELDS.filter(([i, j, w, d]) => { const c: [number, number][] = []; for (let a = i; a < i + w; a++) for (let b = j; b < j + d; b++) c.push([a, b]); return claim(c) })
  const mill = claim([SPOTS.mill]) ? SPOTS.mill : null
  const bales = SPOTS.bale.filter((c) => claim([c]))
  const archAt = claim([SPOTS.arch]) ? SPOTS.arch : null
  const buttes = SPOTS.buttes.filter(([i, j]) => claim([[i, j]]))
  const hoodoos = SPOTS.hoodoos.filter((c) => claim([c]))
  const boulderAt = SPOTS.boulders.filter((c) => claim([c]))
  // A dry wash across the Badlands: a riverbed that only runs once a year,
  // winding down to the western beach. Its cells are kept clear.
  const WASH: [number, number][] = [[25.5, 8.7], [24.7, 7.6], [23.6, 7.4], [22.7, 6.4], [22.4, 5.0], [22.0, 4.1], [21.4, 3.3], [21.0, 2.4], [20.5, 2.05]]
  const washCells = [...new Set(WASH.map(([u, v]) => key(Math.floor(u), Math.floor(v))))].map((k) => k.split(',').map(Number) as [number, number])
  const wash = claim(washCells) ? WASH : null

  // The cartoon island's ground, painted as one picture (terrain.ts): its
  // coast, terraces and patches in curves. (The realistic island's ground is
  // Unity's picture; it keeps the tiles below for what it still needs.)
  const meadow = (i: number, j: number) => 0.5 + 0.22 * Math.sin(i * 0.55 + j * 0.31 + 1.7) + 0.2 * Math.cos(j * 0.62 - i * 0.23) + 0.08 * Math.sin(i * 2.1 + j * 1.7)
  const snowyAt = (i: number, j: number) => dist[i][j].key === 'peaks' && (height[i][j] >= 48 || (height[i][j] === 36 && meadow(i, j) > 0.62))
  const busySea = new Set([...PIERS.flatMap((pts) => pts.map(([u, v]) => key(Math.floor(u), Math.floor(v)))), ...placed.filter((p) => p.lm.water).flatMap((p) => p.cells.map((c) => key(...c)))])
  // Water the open sea cannot reach: everything not land, flooded in from the edge; what is left is a pool.
  const lakes = new Set<string>()
  {
    const sea = new Set<string>(), todo: [number, number][] = [[-1, -1]]
    while (todo.length) {
      const [i, j] = todo.pop()!, k = key(i, j)
      if (i < -1 || j < -1 || i > GRID || j > GRID || sea.has(k) || isLand(i, j)) continue
      sea.add(k); todo.push([i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1])
    }
    for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) if (!isLand(i, j) && !sea.has(key(i, j))) lakes.add(key(i, j))
  }
  const painted = plate ? null : paintGround({
    grid: GRID, sea: SEA, beachZ: BEACH, isLand, height: (i, j) => height[i][j], district: (i, j) => dist[i][j].key,
    beach: (i, j) => beach.has(key(i, j)), taken: (i, j) => taken.has(key(i, j)), road: (i, j) => road.has(key(i, j)),
    busySea: (i, j) => busySea.has(key(i, j)), snowy: (i, j) => isLand(i, j) && snowyAt(i, j), river, lake: (i, j) => lakes.has(key(i, j)),
    hz: (a, b, c) => { const v = Math.sin(a * 12.9898 + b * 78.233 + c * 3.71) * 43758.5453; return v - Math.floor(v) },
  })

  if (process.env.ISLAND_ASCII) {
    const rows = ['    ' + [...Array(GRID).keys()].map((j) => j % 10).join('')]
    for (let i = 0; i < GRID; i++) { let out = String(i).padStart(3) + ' '; for (let j = 0; j < GRID; j++) { const k = key(i, j); out += !isLand(i, j) ? '.' : taken.has(k) ? '#' : road.has(k) ? '=' : wet.has(k) ? '~' : pond.has(k) ? 'o' : beach.has(k) ? ',' : height[i][j] > 0 ? String(height[i][j] / 12) : dist[i][j].key[0] } rows.push(out) }
    const out = rows.join(String.fromCharCode(10))
    console.log(out)
  }
  /* ---- the painting ------------------------------------------------------ */
  // Things to poke. Each is wrapped in a group the page listens on
  // (data-poke names what it is); the reaction plays on the wrapper, so
  // whatever moves inside it keeps moving. A small thing gets a ring of
  // nothing round it to tap, and some have something to say.
  const pokeN = (kind: string, hit?: [number, number, number]) => {
    const w = new N('g', { 'data-poke': kind, class: `pk pk-${kind}` })
    if (hit) w.add(new N('circle', { cx: f(hit[0]), cy: f(hit[1]), r: hit[2], fill: 'transparent' }))
    return w
  }
  const poke = (p: Pen, kind: string, x: number, y: number, words?: string, z = 26): Pen => {
    const [sx, sy] = p.at(x, y)
    const w = p.el('g', { 'data-poke': kind, class: `pk pk-${kind}` })
    w.add(new N('circle', { cx: f(sx), cy: f(sy - 8), r: 15, fill: 'transparent' }))
    const inner = w.add(new N('g'))
    if (words) { const [bx, by] = p.at(x, y, z); sayBubble(w, bx, by, words) }
    return new Pen(inner, p.ox, p.oy, p.oz, p.b, p.lights, p.sink)
  }
  // A fixed hash, for choices that must line up from one tile to the next.
  const hz = (a: number, b: number, c: number) => { const v = Math.sin(a * 12.9898 + b * 78.233 + c * 3.71) * 43758.5453; return v - Math.floor(v) }
  // The island is painted in layers, each its own SVG, so an animation only
  // makes the browser rework the small layer it is in rather than the lot.
  const made: { kind: Layer['kind']; slug?: string; node: N }[] = []
  // Every layer joins its strokes round, once, for everything in it to
  // inherit (render() then leaves the attribute off each shape).
  const open = (kind: Layer['kind'], slug?: string) => { const node = joinRoot(new N('g', { class: `layer-${kind}`, 'stroke-linejoin': 'round' })); made.push({ kind, slug, node }); return node }
  let root = open('sea')
  const first = root
  const lights: Light[] = []

  // The sea, its shallows, and the surf round the coast.
  const [sx0, sy0] = P(-8, GRID + 8), [sx1] = P(GRID + 8, -8), [, sy1] = P(-8, -8), [, sy2] = P(GRID + 8, GRID + 8)
  // The open sea is a touch deeper the further it is from the island.
  const [mx, my] = P(GRID / 2, GRID / 2, SEA)
  const defs = root.add(new N('defs'))
  const grad = defs.add(new N('radialGradient', { id: 'isl-sea', cx: f(mx), cy: f(my), r: plate ? 1500 : 1150, gradientUnits: 'userSpaceOnUse', gradientTransform: `translate(${f(mx)} ${f(my)}) scale(1 0.55) translate(${f(-mx)} ${f(-my)})` }))
  // On the realistic island, the ocean the plate fades into: its own colour, deepening further out.
  grad.add(new N('stop', { offset: 0.3, 'stop-color': plate?.sea ?? LAND.seaNear }))
  // (The drawn sea deepens inside the view, not off past its edges: a stop half way, a nearer far edge.)
  if (!plate) grad.add(new N('stop', { offset: 0.55, 'stop-color': '#3a82c8' }))
  grad.add(new N('stop', { offset: 1, 'stop-color': plate?.sea ? deepen(plate.sea, 0.82) : LAND.seaFar }))
  // (data-still: on the realistic sea the page draws no wave marks of its own over it.)
  root.add(new N('rect', { x: sx0 - 400, y: sy1 - 1400, width: sx1 - sx0 + 800, height: sy2 - sy1 + 2000, fill: 'url(#isl-sea)', 'data-still': plate ? 1 : undefined }))
  // The ground as Unity renders it, land and shallows together, over the open sea.
  if (plate) {
    const [x0, y0, x1, y1] = plate.box
    root.add(new N('image', { 'data-plate': plate.id, href: plate.href, x: x0, y: y0, width: x1 - x0, height: y1 - y0, preserveAspectRatio: 'none' }))
  }

  // The shallows: the whole coast's outline, stroked wider and wider with
  // round joins, which is the same as growing it outwards by that much. Drawn
  // flat on the sea in tile units, so the bands curve round the coast the way
  // shallow water does, rather than stepping tile by tile. A thin lighter
  // ring marks each band's edge, like the line a wave leaves.
  const [sox, soy] = P(0, 0, SEA)
  const flat = (cls?: string) => root.add(new N('g', { class: cls, transform: `translate(${f(sox)} ${f(soy)}) matrix(${S / 2} ${S / 4} ${-S / 2} ${S / 4} 0 0)` }))
  let landSq = ''
  for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) if (isLand(i, j)) landSq += `M${i} ${j}h1v1h-1z`
  // (With a plate, the shallows and the foam are in its picture: drawn into nothing.)
  const sh = plate ? new N('g') : flat('shallows')
  // One outline, drawn eight times: each band and its lighter edge.
  // The coast's outline, kept in the SVG whatever happens to the shallows: the surf and the foam draw from it.
  root.add(new N('defs')).add(new N('path', { id: 'isl-coast', d: painted?.coast || landSq }))
  if (painted) {
    // The cartoon sea: the shallows in many close steps, so they shade towards the shore with no rings.
    // (The outer band feathers out over more steps: invisible by day, and at night, over a sea darker than
    // it, it no longer ends in two hard contour rings round the island.)
    ;([[12, LAND.shallows[0], 0.1], [11, LAND.shallows[0], 0.2], [10.2, LAND.shallows[0], 0.32], [9.5, LAND.shallows[0], 0.45], [8.4, LAND.shallows[0], 0.7], [7.4, LAND.shallows[0], 1], [5.6, mix(LAND.shallows[0], LAND.shallows[1], 0.5), 1], [4.2, LAND.shallows[1], 1], [3.1, mix(LAND.shallows[1], LAND.shallows[2], 0.5), 1], [2.2, LAND.shallows[2], 1], [1.4, mix(LAND.shallows[2], LAND.shallows[3], 0.5), 1], [0.8, LAND.shallows[3], 1], [0.45, '#9fdfd6', 1]] as [number, string, number][]).forEach(([w, c, op]) => {
      sh.add(new N('use', { href: '#isl-coast', fill: c, stroke: c, 'stroke-width': w, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', opacity: op < 1 ? op : undefined }))
    })
  } else {
    // (Braced: written as `else` and then a line opening with `;`, the empty statement was the whole
    // else, and these old pale ring bands were painted over the smooth ramp above in every bake.)
    ;([[7.2, '#98d4fc'], [4.6, '#a7ddf9'], [2.6, '#b8e7f6'], [1.2, '#cdf1f4']] as [number, string][]).forEach(([w, c]) => {
      sh.add(new N('use', { href: '#isl-coast', fill: c, stroke: mix(c, '#ffffff', 0.45), 'stroke-width': w, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }))
      sh.add(new N('use', { href: '#isl-coast', fill: c, stroke: c, 'stroke-width': f2(w - 0.09), 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }))
    })
  }
  // Sand and pebbles seen through the clearest water, right by the shore.
  let seabed = ''
  for (let i = -2; i < GRID + 2; i++) for (let j = -2; j < GRID + 2; j++) {
    if (isLand(i, j)) continue
    if (![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => isLand(i + a, j + b))) continue
    for (let k = 0; k < 2; k++) { const u = i + 0.2 + R() * 0.6, v = j + 0.2 + R() * 0.6, r = 0.035 + R() * 0.05; seabed += `M${f2(u - r)} ${f2(v)}a${f2(r)} ${f2(r)} 0 1 0 ${f2(r * 2)} 0a${f2(r)} ${f2(r)} 0 1 0 ${f2(-r * 2)} 0` }
  }
  sh.add(new N('path', { d: seabed, fill: '#ffffff', opacity: 0.45 }))

  /** A ring spreading out on the water round something sitting in it, now and then. */
  // (On the realistic sea, a fainter, finer ring: the swell round something afloat, not a drawn circle.)
  const ripple = (x: number, y: number, rx: number, ry: number, delay: number) => new N('ellipse', { cx: f(x), cy: f(y), rx: f(rx), ry: f(ry), fill: 'none', stroke: '#ffffff', 'stroke-width': plate ? 0.6 : 1.4, 'stroke-opacity': plate ? 0.16 : undefined, class: 'ripple', style: `animation-delay:${f(-delay)}s` })
  const waves = root.add(new N('g', { class: 'waves' }))
  // Wave marks out in open water only, where they will not sit on the shallows.
  const nearLand = (u: number, v: number, r: number) => { for (let a = Math.floor(u - r); a <= u + r; a++) for (let b = Math.floor(v - r); b <= v + r; b++) if (isLand(a, b)) return true; return false }
  // (Not on the realistic sea, whose picture has ripples of its own: drawn into nothing, the same dice thrown.)
  for (let g = 0; g < 4; g++) {
    let d = ''
    for (let k = 0; k < 45; k++) {
      const u = R() * (GRID + 16) - 8, v = R() * (GRID + 16) - 8
      if (nearLand(u, v, 3.5)) continue
      const [x, y] = P(u, v, SEA), L = 16 + hz(g, k, 51) * 24
      // One soft crest, its length varied (hz, so the dice above are thrown exactly as before).
      d += `M${f(x)} ${f(y)}q${f(L / 2)} -2.5 ${f(L)} 0`
    }
    if (!plate) waves.add(new N('path', { d, fill: 'none', stroke: '#ffffff', 'stroke-width': 1.4, 'stroke-linecap': 'round', opacity: f(0.2 + g * 0.04), class: `wave w${g}` }))
  }
  // Rocks standing in the shallows, each with a ring of foam, and a little
  // sandbar off the harbour with one palm on it.
  const waterSlug = new Set(placed.filter((p) => p.lm.water).flatMap((p) => p.cells.map((c) => key(...c))))
  const clearOf = (i: number, j: number, r: number) => { for (let a = i - r; a <= i + r; a++) for (let b = j - r; b <= j + r; b++) if (isLand(a, b) || waterSlug.has(key(a, b))) return false; return true }
  const seaRocks: [number, number, number][] = []
  /**
   * Where the realistic sea floor rises out of the water or falls away (Unity: Terrain3D, Isle): tile i, j,
   * radius in tiles, and the height of its top (above the sea, a bank of sand; far under it, a trench).
   */
  const isles: [number, number, number, number][] = []
  for (const [i, j, k] of [[-2, 12, 1], [12, 31, 1.2], [31, 6, 0.9], [29, 28, 1.1], [-2, 8, 0.8], [13, -2, 0.9], [18, -2, 1], [9, 30, 0.9]] as [number, number, number][]) {
    if (!clearOf(Math.floor(i), Math.floor(j), 1)) continue
    seaRocks.push([i, j, k])
  }
  for (const rk of seaRocks) {
    const [i, j, k] = rk
    const [x, y] = P(i + 0.5, j + 0.5, SEA)
    // With a plate, the rock and its foam are in its picture (Unity: IslandBuild.Scene); its ripple and its gull stay.
    if (!plate) root.add(new N('ellipse', { cx: f(x + 2), cy: f(y + 3), rx: f(26 * k), ry: f(11 * k), fill: '#ffffff', opacity: 0.55 }))
    if (!plate) root.add(new N('ellipse', { cx: f(x + 2), cy: f(y + 3), rx: f(19 * k), ry: f(8 * k), fill: '#cdf1f4' }))
    if (!plate) root.add(ripple(x + 2, y + 3, 24 * k, 10 * k, hz(i, j, 61) * 3.6))
    if (!plate) root.add(new N('path', { d: `M${f(x - 12 * k)} ${f(y + 4)}L${f(x - 1 * k)} ${f(y + 16 * k)}L${f(x + 11 * k)} ${f(y + 4)}Z`, fill: C.rockDark, opacity: 0.22 }))
    if (!plate) root.add(new N('path', { d: `M${f(x - 14 * k)} ${f(y + 4)}L${f(x - 10 * k)} ${f(y - 8 * k)}L${f(x - 1 * k)} ${f(y - 14 * k)}L${f(x + 9 * k)} ${f(y - 7 * k)}L${f(x + 13 * k)} ${f(y + 4)}Z`, fill: C.rock, stroke: INK, 'stroke-width': OUT, 'stroke-linejoin': 'round' }))
    if (!plate) root.add(new N('path', { d: `M${f(x - 1 * k)} ${f(y - 14 * k)}L${f(x + 9 * k)} ${f(y - 7 * k)}L${f(x + 13 * k)} ${f(y + 4)}L${f(x + 1 * k)} ${f(y + 4)}Z`, fill: C.rockDark, opacity: 0.55 }))
    if (!plate) root.add(new N('path', { d: `M${f(x - 9 * k)} ${f(y - 8 * k)}l5 -3`, stroke: '#ffffff', 'stroke-width': 1.6, 'stroke-linecap': 'round', opacity: 0.7 }))
    if (!plate) root.add(new N('path', { d: `M${f(x - 18 * k)} ${f(y + 5)}q${f(18 * k)} ${f(7 * k)} ${f(36 * k)} 0`, fill: 'none', stroke: '#ffffff', 'stroke-width': 2, 'stroke-linecap': 'round' }))
    // A gull on every other rock.
    if (seaRocks.indexOf(rk) % 2 === 0) { const w = root.add(pokeN('gull', [x, y - 16 * k, 14])); w.add(gullStanding(x - 1 * k, y - 13.5 * k, seaRocks.indexOf(rk) % 4 === 0)); sayBubble(w, x, y - 26 * k, 'squawk!') }
  }
  const sandbar = [30.2, 24.4]
  if (clearOf(30, 24, 1)) {
    const [x, y] = P(sandbar[0], sandbar[1], SEA)
    isles.push([sandbar[0], sandbar[1], 0.72, SEA + 3])
  }
  if (clearOf(30, 24, 1) && !plate) {
    const [x, y] = P(sandbar[0], sandbar[1], SEA)
    root.add(new N('ellipse', { cx: f(x), cy: f(y + 4), rx: 54, ry: 21, fill: '#ffffff', opacity: 0.6 }))
    root.add(new N('ellipse', { cx: f(x), cy: f(y + 4), rx: 46, ry: 17, fill: '#cdf1f4' }))
    root.add(new N('path', { d: `M${f(x - 34)} ${f(y + 3)}q34 -16 68 0q-34 14 -68 0z`, fill: SAND[0], stroke: INK, 'stroke-width': OUT, 'stroke-linejoin': 'round' }))
    root.add(new N('path', { d: `M${f(x - 34)} ${f(y + 3)}q34 14 68 0`, fill: 'none', stroke: SAND[2], 'stroke-width': 2.4, 'stroke-linecap': 'round' }))
    for (const [dx, dy] of [[-14, 1], [10, 4], [20, 0]]) root.add(new N('circle', { cx: f(x + dx), cy: f(y + dy), r: 1.3, fill: '#ffffff', stroke: INK, 'stroke-width': 0.6 }))
  }
  // Shimmer: short streaks of light lying flat on the water, a few at a
  // time catching the sun, thickest just off the shore. (On the realistic
  // island the sea's own picture glitters: these, and the glints, are kept out.)
  const shim = plate ? new N('g') : root.add(new N('g', { class: 'shimmer' }))
  for (let k = 0; k < 40; k++) {
    const u = hz(k, 1, 21) * (GRID + 10) - 5, v = hz(k, 2, 22) * (GRID + 10) - 5
    if (nearLand(u, v, 0.8) || !nearLand(u, v, 4.5)) continue
    const [x, y] = P(u, v, SEA), w = (6 + hz(k, 3, 23) * 10) * (plate ? 0.6 : 1)
    shim.add(new N('path', { d: `M${f(x - w)} ${f(y)}h${f(w * 2)}M${f(x - w * 0.5)} ${f(y + 3)}h${f(w)}`, stroke: '#ffffff', 'stroke-width': plate ? 0.8 : 1.6, opacity: plate ? 0.45 : undefined, 'stroke-linecap': 'round', class: 'shim amb', 'data-b': `${f(x - w)} ${f(y - 2)} ${f(x + w)} ${f(y + 5)}`, style: `animation-delay:${f(-hz(k, 4, 24) * 6)}s` }))
  }
  // Glints of sun on the water, here and there.
  const glints = plate ? new N('g') : root.add(new N('g', { class: 'glints' }))
  for (let k = 0; k < 26; k++) {
    const u = R() * (GRID + 14) - 7, v = R() * (GRID + 14) - 7
    if (nearLand(u, v, 1.5)) continue
    const [x, y] = P(u, v, SEA), r = (3 + R() * 3) * (plate ? 0.45 : 1)
    glints.add(new N('path', { d: `M${f(x)} ${f(y - r)}Q${f(x)} ${f(y)} ${f(x + r)} ${f(y)}Q${f(x)} ${f(y)} ${f(x)} ${f(y + r)}Q${f(x)} ${f(y)} ${f(x - r)} ${f(y)}Q${f(x)} ${f(y)} ${f(x)} ${f(y - r)}Z`, fill: '#ffffff', class: 'glint amb', 'data-b': `${f(x - r)} ${f(y - r)} ${f(x + r)} ${f(y + r)}`, style: `animation-delay:${f(-R() * 4)}s` }))
  }
  // Foam where the water meets the land: the coast's outline once more,
  // stroked narrow and white, so it hugs every beach and cliff foot.
  const coastT = `translate(${f(sox)} ${f(soy)}) matrix(${S / 2} ${S / 4} ${-S / 2} ${S / 4} 0 0)`
  const foamG = plate ? new N('g', { transform: coastT }) : root.add(new N('g', { transform: coastT }))
  // A broken lace of foam a little way out, so the rim reads as water breaking rather than a sticker's edge.
  foamG.add(new N('use', { href: '#isl-coast', fill: 'none', stroke: '#ffffff', 'stroke-width': 0.7, 'stroke-dasharray': '0.9 0.3 2.1 0.45 1.3 0.35', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0.45 }))
  foamG.add(new N('use', { href: '#isl-coast', fill: '#ffffff', stroke: '#ffffff', 'stroke-width': 0.86, 'stroke-linejoin': 'round', opacity: 0.2 }))
  foamG.add(new N('use', { href: '#isl-coast', fill: '#ffffff', stroke: '#ffffff', 'stroke-width': 0.42, 'stroke-linejoin': 'round', opacity: 0.9 }))
  // Rocks at the waterline, here and there along the sides we can see: a
  // few stones in a ring of their own foam, never in front of a pier or a
  // building that stands in the sea.
  const pierCells = new Set(PIERS.flatMap((pts) => pts.map(([u, v]) => key(Math.floor(u), Math.floor(v)))))
  // (With a plate, they are in its picture: Unity stands them where these are.)
  const shoreRocks: [number, number, number][] = []
  for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) {
    if (!isLand(i, j)) continue
    for (const [di, dj] of [[1, 0], [0, 1]]) {
      const ni = i + di, nj = j + dj
      if (isLand(ni, nj) || waterSlug.has(key(ni, nj)) || pierCells.has(key(ni, nj)) || hz(i * 3 + di, j * 5 + dj, 7) > 0.16) continue
      const u = di ? i + 1.16 : i + 0.25 + hz(i, j, 1) * 0.5, v = dj ? j + 1.16 : j + 0.25 + hz(j, i, 2) * 0.5
      const [x, y] = P(u, v, SEA)
      const big = 0.55 + hz(i, j, 3) * 0.35
      shoreRocks.push([u, v, Math.round(big * 100) / 100])
      if (plate) continue
      root.add(new N('ellipse', { cx: f(x + 3), cy: f(y + 2), rx: f(19 * big), ry: f(7 * big), fill: '#ffffff', opacity: 0.6 }))
      for (const [dx, dy, k] of [[0, 0, big], [10 * big, 3, big * 0.6], [-9 * big, 3.5, big * 0.45]] as [number, number, number][]) {
        const X = x + dx, Y = y + dy
        root.add(new N('path', { d: `M${f(X - 11 * k)} ${f(Y + 3)}L${f(X - 8 * k)} ${f(Y - 6 * k)}L${f(X + 1 * k)} ${f(Y - 10 * k)}L${f(X + 9 * k)} ${f(Y - 4 * k)}L${f(X + 10 * k)} ${f(Y + 3)}Z`, fill: C.rock, stroke: INK, 'stroke-width': 1.2, 'stroke-linejoin': 'round' }))
        root.add(new N('path', { d: `M${f(X + 1 * k)} ${f(Y - 10 * k)}L${f(X + 9 * k)} ${f(Y - 4 * k)}L${f(X + 10 * k)} ${f(Y + 3)}L${f(X + 1 * k)} ${f(Y + 3)}Z`, fill: C.rockDark, opacity: 0.5 }))
      }
      root.add(new N('path', { d: `M${f(x - 15 * big)} ${f(y + 4)}q${f(15 * big)} ${f(5 * big)} ${f(30 * big)} 0`, fill: 'none', stroke: '#ffffff', 'stroke-width': 1.6, 'stroke-linecap': 'round' }))
    }
  }

  // The surf: two lines of breaking wave, a little way out, each in a layer
  // of its own whose opacity rises and falls in turn, so the waves seem to
  // roll in to the shore. Fading a whole layer costs the browser nothing;
  // moving a line round the whole coast would cost it every frame.
  for (const [k, w0, w1] of [['out', 1.66, 1.82], ['in', 1.1, 1.24]] as [string, number, number][]) {
    root = open('surf', k)
    if (plate) continue
    const id = `isl-surf-${k}`
    const m = root.add(new N('mask', { id, maskUnits: 'userSpaceOnUse', x: f(sx0 - 400), y: f(sy1 - 1400), width: f(sx1 - sx0 + 800), height: f(sy2 - sy1 + 2000) }))
    const mg = m.add(new N('g', { transform: coastT }))
    mg.add(new N('use', { href: '#isl-coast', fill: '#ffffff', stroke: '#ffffff', 'stroke-width': w1, 'stroke-linejoin': 'round' }))
    mg.add(new N('use', { href: '#isl-coast', fill: '#000000', stroke: '#000000', 'stroke-width': w0, 'stroke-linejoin': 'round' }))
    root.add(new N('rect', { x: f(sx0 - 400), y: f(sy1 - 1400), width: f(sx1 - sx0 + 800), height: f(sy2 - sy1 + 2000), fill: '#ffffff', mask: `url(#${id})` }))
  }
  root = open('sea')

  // Boats sailing round the island, and fish that jump.
  root = open('boats')
  const boats = root.add(new N('g', { class: 'boats' }))
  ;[[C.rasp, 7.2, 60, 0], [C.cobalt, 5.8, 80, -25], [C.lilac, 6.6, 70, -50], [C.mint, 5.4, 95, -10]].forEach(([hull, rad, dur, begin]) => {
    const rr = GRID / 2 + (rad as number), c = GRID / 2
    const pts: [number, number][] = []
    for (let k = 0; k < 40; k++) { const a = (k / 40) * Math.PI * 2; pts.push(P(c + Math.cos(a) * rr, c + Math.sin(a) * rr * 0.96, SEA)) }
    const name = `boat${boats.kids.length}`
    const frames = motionPath(name, pts, { closed: true })
    const g = boats.add(new N('g', { class: 'mover', style: `animation:${name} ${dur}s linear infinite ${begin}s` }))
    // Unity's (lib/island/actors.ts): turning to each of its eight headings as it goes round.
    g.add(onPath((h) => boatUse('sail', hull as string, h), name, frames, `${dur}s`, `${begin}s`) ?? sailboat(hull as string, '#ffffff', 1.1))
  })
  for (const [i, j, d] of [[27, 26, 0], [2, 26, 3.5], [29, 10, 6]]) {
    const [x, y] = P(i, j, SEA)
    root.add(new N('path', { d: `M${f(x - 7)} ${f(y)}q7 -5 14 0q-7 5 -14 0zM${f(x + 7)} ${f(y)}l5 -3v6z`, fill: plate ? '#c3cedb' : C.sky, stroke: plate ? '#7d8aa0' : INK, 'stroke-width': plate ? 0.5 : 1.2, class: 'fish', style: `animation-delay:${d}s` }))
  }
  // Dolphins leaping, and a whale further out, now and then blowing.
  ;[[33, 13, 0, false], [16, 34, 2.6, true], [-3, 16, 5.1, false]].forEach(([i, j, d, flip]) => {
    const [x, y] = P(i as number, j as number, SEA)
    root.add(pokeN('dolphin', [x, y - 14, 22])).add(dolphin(x, y, d as number, flip as boolean))
  })
  { const [x, y] = P(3, 29.5, SEA); const w = root.add(pokeN('whale', [x, y - 10, 34])); w.add(whale(x, y)); sayBubble(w, x, y - 44, 'pfffsh!') }
  // A second whale, much bigger, that only comes up at dawn.
  { const [x, y] = P(36, 21, SEA); root.add(pokeN('dawnwhale')).add(dawnWhale(x, y)) }
  // Rowing boats tied up at the piers, and buoys off the harbour.
  for (const [n, pts] of PIERS.slice(0, 2).entries()) { const [ei, ej] = pts[pts.length - 1], [si, sj] = pts[0]; const di = Math.sign(ei - si), dj = Math.sign(ej - sj); const [x, y] = P(ei - di * 0.6 + (dj ? 0.42 : 0), ej - dj * 0.6 + (di ? 0.42 : 0), SEA); root.add(ripple(x, y + 4, 22, 6.5, n * 1.9 + 0.6)); root.add(rowboat(x, y, n ? C.cobalt : C.mint)) }
  ;[[30, 21], [26.5, 29.2], [31, 16.5]].forEach(([i, j], n) => { const [x, y] = P(i, j, SEA); root.add(ripple(x, y + 2, 13, 4.6, n * 1.3)); root.add(buoy(x, y, n * 1.4)) })
  // Two fishing boats at anchor, out past the rocks.
  FISHING.forEach(([i, j, c, d]) => { const [x, y] = P(i, j, SEA); root.add(ripple(x, y + 5, 30, 8, d + 1)); root.add(fishingBoat(x, y, c, d)) })
  // A speedboat racing along the bottom of the map and back.
  {
    const a = P(33, 27, SEA), b = P(25, 37.5, SEA)
    const out = boatUse('speed', C.rasp, headingOf(b[0] - a[0], b[1] - a[1])), back = boatUse('speed', C.rasp, headingOf(a[0] - b[0], a[1] - b[1]))
    const real = !!(out && back)
    const pose = (q: [number, number], dir: number) => real ? `transform:translate(${r1(q[0])}px,${r1(q[1])}px)` : `transform:translate(${r1(q[0])}px,${r1(q[1])}px) scaleX(${dir})`
    motionCss.push(`@keyframes isl-speed{0%{${pose(a, 1)}}44%{${pose(b, 1)}}50%{${pose(b, -1)}}94%{${pose(a, -1)}}100%{${pose(a, 1)}}}`)
    const g = root.add(new N('g', { class: 'mover amb', 'data-b': `${f(b[0] - 70)} ${f(a[1] - 50)} ${f(a[0] + 70)} ${f(b[1] + 40)}`, style: 'animation:isl-speed 22s ease-in-out infinite -4s' }))
    if (real) {
      motionCss.push('@keyframes isl-speed-o{0%,46.9%{opacity:1}47%,96.9%{opacity:0}97%,100%{opacity:1}}', '@keyframes isl-speed-b{0%,46.9%{opacity:0}47%,96.9%{opacity:1}97%,100%{opacity:0}}')
      g.add(new N('g', { style: 'animation:isl-speed-o 22s linear infinite -4s' })).add(out!)
      g.add(new N('g', { style: 'animation:isl-speed-b 22s linear infinite -4s' })).add(back!)
    } else g.add(speedboat(C.rasp))
  }
  // The ferry: in from the open sea, a while at the jetty, out again.
  {
    const a = P(FERRY.from[0], FERRY.from[1], SEA), b = P(FERRY.dock[0], FERRY.dock[1], SEA)
    const inb = boatUse('ferry', '#ffffff', headingOf(b[0] - a[0], b[1] - a[1])), outb = boatUse('ferry', '#ffffff', headingOf(a[0] - b[0], a[1] - b[1]))
    const real = !!(inb && outb)
    const pose = (q: [number, number], dir: number) => real ? `transform:translate(${r1(q[0])}px,${r1(q[1])}px)` : `transform:translate(${r1(q[0])}px,${r1(q[1])}px) scaleX(${dir})`
    motionCss.push(`@keyframes isl-ferry{0%{${pose(a, -1)};opacity:0}4%{opacity:1}32%,62%{${pose(b, -1)}}62.4%{${pose(b, 1)}}95%{opacity:1}100%{${pose(a, 1)};opacity:0}}`)
    const g = root.add(pokeN('ferry')).add(new N('g', { class: 'mover amb', 'data-b': `${f(a[0] - 130)} ${f(b[1] - 90)} ${f(b[0] + 130)} ${f(a[1] + 60)}`, style: `animation:isl-ferry ${FERRY_DUR}s linear infinite` }))
    if (real) {
      motionCss.push('@keyframes isl-ferry-i{0%,62.2%{opacity:1}62.3%,100%{opacity:0}}', '@keyframes isl-ferry-o{0%,62.2%{opacity:0}62.3%,100%{opacity:1}}')
      g.add(new N('g', { style: `animation:isl-ferry-i ${FERRY_DUR}s linear infinite` })).add(inb!)
      g.add(new N('g', { style: `animation:isl-ferry-o ${FERRY_DUR}s linear infinite` })).add(outb!)
    } else g.add(ferry())
  }
  // Each building's solids, and with Unity's pictures of them (opts.buildings), those in their place.
  const solids: IslandModel['solids'] = []
  const shots = opts.buildings ?? null
  /** Unity's pictures of runs: each already where it goes on the map, at its size (a set piece's too). */
  const shotImgs = new WeakSet<N>()
  /** Where a building's solids are written down, and with Unity's pictures of them, put in their place. */
  const sinkFor = (slug: string) => {
    // (Any of its runs: a first run of nothing, a trench, has no picture.)
    const real = !!shots && Object.keys(shots.items).some((k) => k.startsWith(`${slug}/`))
    const sink = new Solids(!real, real ? (g, run) => {
      const it = shots!.items[`${slug}/${run}`]
      if (it) shotImgs.add(g.add(new N('image', { href: it.href, x: it.x, y: it.y, width: it.w, height: it.h, preserveAspectRatio: 'none' })))
    } : undefined)
    solids.push({ slug, runs: sink.runs })
    return { sink, real }
  }
  // The islet with the secret, far out to the west.
  // The castaway's islet: on the realistic island, a bank of sand Unity raises out of the sea, the hut and chest built.
  isles.push([-1.4, 26.2, 1.25, SEA + 5])
  secretIslet(new Pen(root, 0, 0, 0, new Bounds(), lights, sinkFor('islet').sink), -1.4, 26.2)

  // The ground, a diagonal row at a time: tops merged by colour, then cliffs.
  root = open('ground')
  const ground = root.add(new N('g', { class: 'ground' }))
  let mini = ''
  const quad = (pts: [number, number][]) => `M${pts.map((p) => p.map(f).join(' ')).join('L')}Z`
  const seg = (a: [number, number], b: [number, number]) => `M${f(a[0])} ${f(a[1])}L${f(b[0])} ${f(b[1])}`
  const ring = (x: number, y: number, rx: number, ry: number) => `M${f(x - rx)} ${f(y)}a${f(rx)} ${f(ry)} 0 1 0 ${f(rx * 2)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-rx * 2)} 0`
  // A smooth, low-frequency field, so the grass falls into soft patches of
  // lighter and darker green rather than a chessboard.
  const field = (i: number, j: number) => 0.5 + 0.22 * Math.sin(i * 0.55 + j * 0.31 + 1.7) + 0.2 * Math.cos(j * 0.62 - i * 0.23) + 0.08 * Math.sin(i * 2.1 + j * 1.7)
  const grassTones = (d: District) => [shade(d.ground[0], 0.95), d.ground[0], mix(d.ground[0], d.ground[1], 0.5), d.ground[1], mix(d.ground[1], '#ffffff', 0.14)]
  const FACE = { soil: ['#c9cfe6', '#a3add6'], rock: ['#a9a1d6', '#8a80c2'], sand: [SAND[3], SAND[4]], slate: ['#c2bde3', '#a59ed2'] }
  // The Badlands' dust: soft patches of five tones, one with a little rose in it.
  const DUST = ['#c6bce0', '#cec4e5', '#d6cdea', '#d5c5e3', '#ddd5ee']
  // Tops that should read as one surface, with no seam between tiles.
  const seamless = new Set<string>()
  const drip = (along: (u: number, z: number) => [number, number], h: number, seed: number) => {
    const pts: [number, number][] = [along(0, h + 0.5), along(1, h + 0.5)]
    for (let k = 8; k >= 0; k--) { const u = k / 8, deep = 2.5 + 3.2 * Math.abs(Math.sin(seed * 1.7 + k * 1.9)) * (k % 2 ? 1 : 0.45); pts.push(along(u, h - deep)) }
    return quad(pts)
  }
  // Wet sand along every edge of a beach that meets the sea.
  let wetSand = ''
  const fallStreaks: { d: string; b: string }[] = []
  let splash = ''
  for (let s = 0; s < GRID * 2; s++) {
    const tops = new Map<string, string>(), cliffs = new Map<string, string>(), lips = new Map<string, string>()
    let strata = '', wetTop = '', wetFall = '', wetHi = '', ink = '', foot = '', wetFoot = '', ledge = '', ledgeHi = ''
    const add = (m: Map<string, string>, c: string, d: string) => m.set(c, (m.get(c) ?? '') + d)
    for (let i = 0; i < GRID; i++) {
      const j = s - i
      if (!isLand(i, j)) continue
      const h = height[i][j], d = dist[i][j], k = key(i, j), n = field(i, j)
      const isBeach = beach.has(k), snowy = d.key === 'peaks' && (h >= 48 || (h === 36 && n > 0.62))
      let top: string, lip: string | null = null, face: string[]
      if (taken.has(k)) { top = (i + j) % 2 ? '#eef0f8' : '#e6e9f4'; face = FACE.soil }
      else if (isBeach && d.key === 'badlands') { top = n > 0.5 ? '#ddd8ef' : '#d5cfe9'; face = FACE.slate; seamless.add(top) }
      else if (isBeach) { top = n > 0.5 ? SAND[0] : SAND[1]; face = FACE.sand; seamless.add(top) }
      else if (snowy) { top = n > 0.55 ? '#f7faff' : '#e9f0ff'; lip = '#ffffff'; face = FACE.rock; seamless.add(top) }
      else {
        // One tone per district, with no seam between tiles: the light and
        // shade across it are soft patches laid over it afterwards (dapple).
        const t = d.key === 'badlands' ? DUST : grassTones(d)
        top = t[2]
        seamless.add(top)
        lip = shade(d.ground[0], d.key === 'badlands' ? 0.86 : 0.8)
        face = d.key === 'badlands' || d.key === 'peaks' ? FACE.rock : FACE.soil
      }
      const tq = quad([P(i, j, h), P(i + 1, j, h), P(i + 1, j + 1, h), P(i, j + 1, h)])
      add(tops, top, tq); mini += tq
      if (isBeach) {
        const w = 0.26
        if (!isLand(i + 1, j)) wetSand += quad([P(i + 1 - w, j, h), P(i + 1, j, h), P(i + 1, j + 1, h), P(i + 1 - w, j + 1, h)])
        if (!isLand(i, j + 1)) wetSand += quad([P(i, j + 1 - w, h), P(i + 1, j + 1 - w, h), P(i + 1, j + 1, h), P(i, j + 1, h)])
        if (!isLand(i - 1, j)) wetSand += quad([P(i, j, h), P(i + w, j, h), P(i + w, j + 1, h), P(i, j + 1, h)])
        if (!isLand(i, j - 1)) wetSand += quad([P(i, j, h), P(i + 1, j, h), P(i + 1, j + w, h), P(i, j + w, h)])
      }
      const hr = H(i + 1, j), hd = H(i, j + 1)
      const rocky = face === FACE.rock, sandy = face === FACE.sand
      // The two faces we can see, with a lip of grass (or snow) along the top.
      // A run of faces reads as one wall: ink only along its top and foot and
      // up the corners that stick out, not at every tile; the rock's layers
      // sit at the same heights everywhere, so each runs on from tile to tile,
      // with a ledge at every terrace; and the foot is darker, wet at the sea.
      const detail = (hi: number, lo: number, along: (u: number, z: number) => [number, number]) => {
        const tall = hi - lo
        ink += seg(along(0, hi), along(1, hi)) + seg(along(0, lo), along(1, lo))
        const b = Math.min(6, tall * 0.42)
        foot += quad([along(0, lo + b), along(1, lo + b), along(1, lo), along(0, lo)])
        if (lo <= SEA) wetFoot += quad([along(0, SEA + 2.6), along(1, SEA + 2.6), along(1, SEA), along(0, SEA)])
        if (sandy) return
        for (let z = Math.ceil((lo + 2) / 2) * 2; z < hi - 2.5; z += 2) {
          const m = ((z % 12) + 12) % 12
          if (m === 0 && rocky) { ledge += seg(along(0, z - 1.2), along(1, z - 1.2)); ledgeHi += seg(along(0, z), along(1, z)); continue }
          if (rocky ? m % 4 !== 0 : m !== 6) continue
          // Gaps in a layer, so it weathers rather than ruling a line.
          const g0 = hz(i, j, z), g1 = hz(j, i, z + 1)
          if (g0 < 0.18) continue
          strata += g1 < 0.3 ? seg(along(0, z), along(0.55, z)) : g1 > 0.8 ? seg(along(0.4, z), along(1, z)) : seg(along(0, z), along(1, z))
        }
        if (rocky && tall >= 10 && R() < 0.7) { const p = along(0.2 + R() * 0.6, lo + tall * (0.25 + R() * 0.4)); strata += `M${f(p[0])} ${f(p[1])}l1.5 -4l-1 -3` }
      }
      // A corner's ink, less whatever part of it the next face along shares.
      const corner = (pt: (z: number) => [number, number], lo: number, hi: number, ni: number, nj: number, ai: number, aj: number) => {
        const shared = isLand(ni, nj) && H(ai, aj) < H(ni, nj) ? [Math.max(lo, H(ai, aj)), Math.min(hi, H(ni, nj))] : null
        const parts: [number, number][] = shared && shared[0] < shared[1] ? [[lo, shared[0]], [shared[1], hi]] : [[lo, hi]]
        for (const [a, b] of parts) if (b - a > 0.3) ink += seg(pt(a), pt(b))
      }
      if (hr < h) {
        add(cliffs, face[0], quad([P(i + 1, j, h), P(i + 1, j + 1, h), P(i + 1, j + 1, hr), P(i + 1, j, hr)]))
        if (lip) add(lips, lip, snowy ? drip((u, z) => P(i + 1, j + u, z), h, i * 7 + j) : quad([P(i + 1, j, h), P(i + 1, j + 1, h), P(i + 1, j + 1, h - 2.6), P(i + 1, j, h - 2.6)]))
        detail(h, hr, (u, z) => P(i + 1, j + u, z))
        corner((z) => P(i + 1, j + 1, z), hr, h, i, j + 1, i + 1, j + 1)
        corner((z) => P(i + 1, j, z), hr, h, i, j - 1, i + 1, j - 1)
      }
      if (hd < h) {
        add(cliffs, face[1], quad([P(i, j + 1, h), P(i + 1, j + 1, h), P(i + 1, j + 1, hd), P(i, j + 1, hd)]))
        if (lip) add(lips, lip, snowy ? drip((u, z) => P(i + u, j + 1, z), h, i + j * 5) : quad([P(i, j + 1, h), P(i + 1, j + 1, h), P(i + 1, j + 1, h - 2.6), P(i, j + 1, h - 2.6)]))
        detail(h, hd, (u, z) => P(i + u, j + 1, z))
        corner((z) => P(i + 1, j + 1, z), hd, h, i + 1, j, i + 1, j + 1)
        corner((z) => P(i, j + 1, z), hd, h, i - 1, j, i - 1, j + 1)
      }
      // The river: a channel across the top, and a fall down every step.
      if (wet.has(k)) {
        const first = river[0][0] === i && river[0][1] === j, j0 = first ? 0.3 : 0
        wetTop += quad([P(i + 0.32, j + j0, h), P(i + 0.68, j + j0, h), P(i + 0.68, j + 1, h), P(i + 0.32, j + 1, h)])
        wetHi += seg(P(i + 0.42, j + j0 + 0.08, h), P(i + 0.42, j + 0.95, h))
        if (first) { const [px, py] = P(i + 0.5, j + 0.32, h); wetTop += ring(px, py, 14, 7) }
        if (hd < h) {
          wetFall += quad([P(i + 0.32, j + 1, h), P(i + 0.68, j + 1, h), P(i + 0.68, j + 1, hd), P(i + 0.32, j + 1, hd)])
          let st = ''
          for (const u of [0.41, 0.5, 0.59]) st += seg(P(i + u, j + 1, h - 1), P(i + u, j + 1, hd + 1))
          const [ax, ay] = P(i + 0.32, j + 1, h), [bx2, by2] = P(i + 0.68, j + 1, hd)
          fallStreaks.push({ d: st, b: `${f(Math.min(ax, bx2))} ${f(Math.min(ay, by2))} ${f(Math.max(ax, bx2))} ${f(Math.max(ay, by2))}` })
          const [sx, sy] = P(i + 0.5, j + 1.1, hd)
          splash += ring(sx, sy, 9, 3.8) + ring(sx - 9, sy - 2, 3, 2) + ring(sx + 9, sy + 1, 2.6, 1.7)
        }
      }
    }
    for (const [c, d] of tops) ground.add(new N('path', { d, fill: c, stroke: seamless.has(c) ? c : shade(c, 0.95), 'stroke-width': 0.7 }))
    if (wetSand) { ground.add(new N('path', { d: wetSand, fill: '#dccfae' })); wetSand = '' }
    for (const [c, d] of cliffs) ground.add(new N('path', { d, fill: c, stroke: c, 'stroke-width': 0.7, 'stroke-linejoin': 'round' }))
    if (foot) ground.add(new N('path', { d: foot, fill: INK, opacity: 0.13 }))
    if (wetFoot) ground.add(new N('path', { d: wetFoot, fill: '#3b4f9e', opacity: 0.3 }))
    for (const [c, d] of lips) ground.add(new N('path', { d, fill: c }))
    if (strata) ground.add(new N('path', { d: strata, fill: 'none', stroke: INK, 'stroke-width': 1, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0.22 }))
    if (ledge) ground.add(new N('path', { d: ledge, fill: 'none', stroke: INK, 'stroke-width': 1.6, 'stroke-linecap': 'round', opacity: 0.22 }))
    if (ledgeHi) ground.add(new N('path', { d: ledgeHi, fill: 'none', stroke: '#ffffff', 'stroke-width': 1.3, 'stroke-linecap': 'round', opacity: 0.45 }))
    if (ink) ground.add(new N('path', { d: ink, fill: 'none', stroke: INK, 'stroke-width': 1.3, 'stroke-linecap': 'round' }))
    if (wetTop) ground.add(new N('path', { d: wetTop, fill: '#8fd3ff', stroke: INK, 'stroke-width': 1.2, 'stroke-linejoin': 'round' }))
    if (wetHi) ground.add(new N('path', { d: wetHi, fill: 'none', stroke: '#ffffff', 'stroke-width': 1.6, 'stroke-linecap': 'round', opacity: 0.75 }))
    if (wetFall) ground.add(new N('path', { d: wetFall, fill: '#b9e6ff', stroke: INK, 'stroke-width': 1.2, 'stroke-linejoin': 'round' }))
  }
  // Where each fall lands, after the step below it is down.
  ground.add(new N('path', { d: splash, fill: '#ffffff', stroke: INK, 'stroke-width': 1 }))
  // The falls' white water, running down: only these few strokes move.
  // On the realistic island the water is Unity's (Falls.cs): these only the light glinting as it runs down it.
  for (const st of fallStreaks) ground.add(new N('path', { d: st.d, fill: 'none', stroke: '#ffffff', 'stroke-width': plate ? 0.9 : 1.8, 'stroke-linecap': 'round', 'stroke-dasharray': plate ? '1.5 7' : '4 5', opacity: plate ? 0.55 : undefined, class: 'fall amb', 'data-b': st.b }))
  // Dapple: soft patches of lighter and darker ground across the open land,
  // following the same slow field the tones once stepped through tile by
  // tile, so a meadow falls into sunlit and shaded stretches with no edges.
  // Only over a tile with open ground of its own district all round it at
  // the same height, so a patch never lies over a step, a beach, the river,
  // a road or a building's plaza. Each tone is one sheet, so patches that
  // meet do not darken, laid twice (wide and faint, then close) for a soft edge.
  {
    const openAt = (i: number, j: number, h: number, d: District) => isLand(i, j) && height[i][j] === h && dist[i][j] === d && !beach.has(key(i, j)) && !taken.has(key(i, j)) && !wet.has(key(i, j)) && !pond.has(key(i, j))
    const sheets = new Map<string, [string, string]>()
    const lay = (c: string, x: number, y: number, rx: number, ry: number) => { const s = sheets.get(c) ?? ['', '']; s[0] += ring(x, y, rx * 1.3, ry * 1.3); s[1] += ring(x, y, rx, ry); sheets.set(c, s) }
    for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) {
      if (!isLand(i, j)) continue
      const h = height[i][j], d = dist[i][j]
      if (!openAt(i, j, h, d)) continue
      let ok = true
      for (let a = -1; a <= 1 && ok; a++) for (let b = -1; b <= 1 && ok; b++) ok = openAt(i + a, j + b, h, d)
      if (!ok) continue
      const base = d.key === 'badlands' ? DUST[2] : grassTones(d)[2]
      const n = field(i, j) + (hz(i, j, 31) - 0.5) * 0.12
      const lightC = d.key === 'badlands' ? DUST[4] : mix(base, '#ffffff', 0.2), darkC = d.key === 'badlands' ? DUST[0] : shade(base, 0.92)
      const [x, y] = P(i + 0.3 + hz(i, j, 32) * 0.4, j + 0.3 + hz(j, i, 33) * 0.4, h)
      const r = 0.42 + hz(i, j, 34) * 0.26
      if (n > 0.58) lay(lightC, x, y, r * S * 0.62, r * S * 0.31)
      else if (n < 0.42) lay(darkC, x, y, r * S * 0.62, r * S * 0.31)
      // And small dapples anywhere, light or shade.
      if (hz(i, j, 35) < 0.55) { const [u, v] = P(i + 0.2 + hz(i, j, 36) * 0.6, j + 0.2 + hz(j, i, 37) * 0.6, h), q = 0.12 + hz(i, j, 38) * 0.12; lay(hz(i, j, 39) < 0.5 ? lightC : darkC, u, v, q * S * 0.62, q * S * 0.31) }
    }
    for (const [c, [wide, close]] of sheets) {
      ground.add(new N('g', { opacity: 0.4 })).add(new N('path', { d: wide, fill: c }))
      ground.add(new N('g', { opacity: 0.55 })).add(new N('path', { d: close, fill: c }))
    }
  }
  // The outline of the whole island's edge, drawn once, so the coast reads.
  let edge = ''
  for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) {
    if (!isLand(i, j)) continue
    const h = height[i][j]
    const seg = (a: [number, number, number], b: [number, number, number]) => { const p1 = P(...a), p2 = P(...b); edge += `M${f(p1[0])} ${f(p1[1])}L${f(p2[0])} ${f(p2[1])}` }
    if (!isLand(i - 1, j)) seg([i, j, h], [i, j + 1, h])
    if (!isLand(i, j - 1)) seg([i, j, h], [i + 1, j, h])
  }
  ground.add(new N('path', { d: edge, fill: 'none', stroke: INK, 'stroke-width': 1.4, 'stroke-linecap': 'round' }))
  // The cartoon island: the painting in place of the tiles, with its own falls.
  if (painted) {
    root.kids = [painted.g]
    for (const st of painted.falls) painted.g.add(new N('path', { d: st.d, fill: 'none', stroke: '#ffffff', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-dasharray': '4 5', class: 'fall amb', 'data-b': st.b }))
  }

  // Roads: a verge, a surface, a dashed middle line.
  const roads = root.add(new N('g', { class: 'roads' }))
  const toPlane = (r: [number, number][]) => `M${r.map(([i, j]) => `${i + 0.5} ${j + 0.5}`).join('L')}`
  const [ox, oy] = P(0, 0)
  const plane = roads.add(new N('g', { transform: `translate(${f(ox)} ${f(oy)}) matrix(${S / 2} ${S / 4} ${-S / 2} ${S / 4} 0 0)` }))
  const rd = routes.map(toPlane).join('')
  if (painted) {
    // Lanes of packed gravel, turning in curves: each corner rounded off half a tile either side.
    const curve = (r: [number, number][]) => {
      const p = r.map(([i, j]) => [i + 0.5, j + 0.5])
      let d = `M${p[0][0]} ${p[0][1]}`
      for (let k = 1; k < p.length - 1; k++) {
        const [a, b, c2] = [p[k - 1], p[k], p[k + 1]]
        if ((b[0] - a[0]) === (c2[0] - b[0]) && (b[1] - a[1]) === (c2[1] - b[1])) continue
        d += `L${f2(b[0] - (b[0] - a[0]) * 0.48)} ${f2(b[1] - (b[1] - a[1]) * 0.48)}Q${b[0]} ${b[1]} ${f2(b[0] + (c2[0] - b[0]) * 0.48)} ${f2(b[1] + (c2[1] - b[1]) * 0.48)}`
      }
      return d + `L${p[p.length - 1][0]} ${p[p.length - 1][1]}`
    }
    const rc = routes.map(curve).join('')
    const st = (w: number, c: string, extra: Record<string, string | number> = {}) => plane.add(new N('path', { d: rc, fill: 'none', stroke: c, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', ...extra }))
    // Grass worn thin either side, then the lane's edge, its surface, and a paler crown where the wheels go.
    st(0.9, LAND.roadWorn, { opacity: 0.16 })
    st(0.74, LAND.roadWorn, { opacity: 0.18 })
    st(0.64, LAND.roadEdge)
    st(0.55, LAND.road)
    st(0.2, '#ece5d6', { opacity: 0.7 })
    // Grit along it: a few darker stones, and the odd paler one.
    let grit = '', pale = ''
    for (const [n, r] of routes.entries()) for (const [k, [i, j]] of r.entries()) for (let q = 0; q < 3; q++) {
      const u = i + 0.5 + (hz(n * 31 + k, q, 71) - 0.5) * 0.46, v = j + 0.5 + (hz(k, n * 17 + q, 72) - 0.5) * 0.46, s = 0.018 + hz(i, j, 73 + q) * 0.022
      const dot = `M${f2(u - s)} ${f2(v)}a${f2(s)} ${f2(s)} 0 1 0 ${f2(s * 2)} 0a${f2(s)} ${f2(s)} 0 1 0 ${f2(-s * 2)} 0`
      if (q === 2) pale += dot; else grit += dot
    }
    plane.add(new N('path', { d: grit, fill: LAND.roadEdge, opacity: 0.8 }))
    plane.add(new N('path', { d: pale, fill: '#ffffff', opacity: 0.55 }))
  } else {
  // Worn ground either side of every road, darker nearest it, so a road is
  // trodden into the grass rather than laid on top of it.
  plane.add(new N('g', { opacity: 0.05 })).add(new N('path', { d: rd, fill: 'none', stroke: INK, 'stroke-width': 0.86, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }))
  plane.add(new N('g', { opacity: 0.06 })).add(new N('path', { d: rd, fill: 'none', stroke: INK, 'stroke-width': 0.75, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }))
  plane.add(new N('path', { d: rd, fill: 'none', stroke: '#c9cfe6', 'stroke-width': 0.66, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }))
  plane.add(new N('path', { d: rd, fill: 'none', stroke: '#f3f5fb', 'stroke-width': 0.56, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }))
  plane.add(new N('path', { d: rd, fill: 'none', stroke: '#c9cfe6', 'stroke-width': 0.035, 'stroke-dasharray': '0.14 0.16' }))
  }

  // The pond, laid flat in the park: a sandy rim, deep middle, lily pads.
  if (pond.size) {
    const cells = [...pond].map((k) => k.split(',').map(Number))
    const i0 = Math.min(...cells.map((c) => c[0])), i1 = Math.max(...cells.map((c) => c[0])) + 1
    const j0 = Math.min(...cells.map((c) => c[1])), j1 = Math.max(...cells.map((c) => c[1])) + 1
    const po = plane.add(new N('g', { class: 'pond' }))
    const rr = (x0: number, y0: number, x1: number, y1: number, r: number, a: Record<string, string | number>) => po.add(new N('rect', { x: f2(x0), y: f2(y0), width: f2(x1 - x0), height: f2(y1 - y0), rx: r, ...a }))
    rr(i0 + 0.08, j0 + 0.1, i1 - 0.08, j1 - 0.1, 0.62, { fill: painted ? LAND.sand[1] : SAND[1], stroke: INK, 'stroke-width': 0.035 })
    rr(i0 + 0.2, j0 + 0.22, i1 - 0.2, j1 - 0.22, 0.52, { fill: painted ? LAND.waterLight : '#9fdcff', stroke: INK, 'stroke-width': 0.03 })
    rr(i0 + 0.42, j0 + 0.5, i1 - 0.4, j1 - 0.55, 0.36, { fill: painted ? LAND.water : '#7cc8fb' })
    po.add(new N('path', { d: `M${f2(i0 + 0.3)} ${f2(j0 + 0.9)}q0 -0.5 0.5 -0.58`, fill: 'none', stroke: '#ffffff', 'stroke-width': 0.06, 'stroke-linecap': 'round', opacity: 0.8 }))
    for (const [u, v, r] of [[0.3, 0.55, 0.13], [0.62, 0.32, 0.1], [0.75, 0.7, 0.12], [0.38, 0.82, 0.09]]) {
      const x = i0 + 0.2 + (i1 - i0 - 0.4) * u, y = j0 + 0.22 + (j1 - j0 - 0.44) * v
      po.add(new N('path', { d: `M${f2(x)} ${f2(y)}L${f2(x + r)} ${f2(y - r * 0.3)}A${f2(r)} ${f2(r)} 0 1 1 ${f2(x + r)} ${f2(y + r * 0.3)}Z`, fill: painted ? '#5aa64e' : '#3fcf9f', stroke: INK, 'stroke-width': 0.025 }))
    }
    const [fx2, fy2] = [i0 + 0.2 + (i1 - i0 - 0.4) * 0.62, j0 + 0.22 + (j1 - j0 - 0.44) * 0.32]
    po.add(new N('circle', { cx: f2(fx2 + 0.03), cy: f2(fy2), r: 0.045, fill: '#ffc4d4', stroke: INK, 'stroke-width': 0.02 }))
  }

  // The dry wash: dark banks, a pale bed of dried mud cracked into plates,
  // and a scatter of pebbles the last flood left behind.
  if (wash) {
    const wg = plane.add(new N('g', { class: 'wash' }))
    let d = `M${wash[0][0]} ${wash[0][1]}`
    for (let k = 1; k < wash.length; k++) { const [a, b] = wash[k - 1], [c, e] = wash[k]; d += `Q${f2(a)} ${f2(b)} ${f2((a + c) / 2)} ${f2((b + e) / 2)}` }
    d += `L${wash[wash.length - 1][0]} ${wash[wash.length - 1][1]}`
    wg.add(new N('path', { d, fill: 'none', stroke: painted ? '#a8977d' : '#a99cd2', 'stroke-width': 0.56, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }))
    wg.add(new N('path', { d, fill: 'none', stroke: painted ? '#e6dfd0' : '#e6e0f2', 'stroke-width': 0.42, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }))
    wg.add(new N('path', { d, fill: 'none', stroke: painted ? '#d8cfbd' : '#d9d1ec', 'stroke-width': 0.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }))
    let cr = '', pb = ''
    for (let k = 0; k < wash.length - 1; k++) {
      const [a, b] = wash[k], [c, e] = wash[k + 1]
      for (let q = 0; q < 3; q++) {
        const t = (q + 0.5) / 3, u = a + (c - a) * t, v = b + (e - b) * t, o = (hz(k, q, 4) - 0.5) * 0.24
        const nx = -(e - b), ny = c - a, L = Math.hypot(nx, ny) || 1, px = u + (nx / L) * o, py = v + (ny / L) * o
        cr += `M${f2(px - 0.07)} ${f2(py)}l0.05 -0.06l0.08 0.02l0.04 0.07`
        pb += `M${f2(px + 0.1)} ${f2(py + 0.05)}a0.025 0.025 0 1 0 0.05 0a0.025 0.025 0 1 0 -0.05 0`
      }
    }
    wg.add(new N('path', { d: cr, fill: 'none', stroke: painted ? '#b3a48a' : '#b7aada', 'stroke-width': 0.022, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }))
    wg.add(new N('path', { d: pb, fill: painted ? '#9c8c75' : '#a59ad3', stroke: INK, 'stroke-width': 0.012 }))
  }

  // Zebra crossings on the roads into the busiest junctions.
  {
    let n = 0
    for (let i = 0; i < GRID && n < 9; i++) for (let j = 0; j < GRID && n < 9; j++) {
      if (!road.has(key(i, j)) || !['oldtown', 'market', 'funfair', 'harbour'].includes(dist[i][j].key)) continue
      const out = [[1, 0], [0, 1], [-1, 0], [0, -1]].filter(([a, b]) => road.has(key(i + a, j + b)))
      if (out.length < 3) continue
      const [a, b] = out[(i + j) % out.length]
      // The crossing sits on the arm, its stripes along the road.
      crossing(new Pen(root), i + a * 0.95 + 0.5, j + b * 0.95 + 0.5, a !== 0 ? 'y' : 'x')
      n++
    }
  }

  // Every building throws a soft shadow the way everything else does: the
  // sun is behind the island on the right, so shadows fall towards the
  // front left, on the side of each building that is in shade. Longer the
  // taller it is, measured by drawing the building once into nothing.
  //
  // Soft, without a blur (the bake paints the map in strips, and a blur
  // would stop at each strip's edge): the same shadows four times over, each
  // time reaching a little further and fainter, every layer one sheet of
  // shade so that where two shadows meet they do not darken; and a closer,
  // darker band hugging each building's foot, where the most light is kept off.
  {
    const keep = motionCss.length, keepGlow = glows.length
    const sg = root.add(new N('g', { class: 'shadows' }))
    // One sheet per height a building stands at: a landmark up on a terrace (the Sky Peaks) shadows its own
    // terrace, not the ground and sea pl.z below it, where its shade once fell as grey ghosts on the cliffs.
    const byZ = new Map<number, { cast: string[]; foot: string[] }>()
    for (const pl of placed) {
      if (pl.lm.water) continue
      const b = new Bounds()
      pl.lm.draw(new Pen(new N('g'), pl.i, pl.j, pl.z, b, []))
      const [, footY] = P(pl.i + pl.w / 2, pl.j + pl.d / 2, pl.z)
      const hp = drawnPlot(pl)
      const L = Math.min(2.4 * hp.k, Math.max(0.35, ((footY - b.y0) / 76) * hp.k))
      const x0 = hp.i + 0.08, y0 = hp.j + 0.08, x1 = hp.i + hp.w - 0.08, y1 = hp.j + hp.d - 0.08
      const a = L * 0.5
      const { cast, foot } = byZ.get(pl.z) ?? byZ.set(pl.z, { cast: [], foot: [] }).get(pl.z)!
      cast.push(`M${f2(x0)} ${f2(y0)}L${f2(x1)} ${f2(y0)}L${f2(x1)} ${f2(y1)}L${f2(x1 - a)} ${f2(y1 + a)}L${f2(x0 - a)} ${f2(y1 + a)}L${f2(x0 - a)} ${f2(y0 + a)}Z`)
      const e = 0.1
      foot.push(`M${f2(hp.i - e)} ${f2(hp.j - e)}L${f2(hp.i + hp.w + e)} ${f2(hp.j - e)}L${f2(hp.i + hp.w + e)} ${f2(hp.j + hp.d + e)}L${f2(hp.i - e)} ${f2(hp.j + hp.d + e)}Z`)
    }
    for (const [z, { cast, foot }] of [...byZ].sort((p, q) => p[0] - q[0])) {
      const [zx, zy] = P(0, 0, z)
      const hg = sg.add(new N('g', { transform: `translate(${f(zx)} ${f(zy)}) matrix(${S / 2} ${S / 4} ${-S / 2} ${S / 4} 0 0)` }))
      for (const [w, op] of [[0.44, 0.06], [0.28, 0.065], [0.14, 0.07], [0, 0.08]] as [number, number][]) {
        hg.add(new N('g', { opacity: op })).add(new N('path', { d: cast.join(''), fill: INK, stroke: w ? INK : undefined, 'stroke-width': w || undefined, 'stroke-linejoin': 'round' }))
      }
      hg.add(new N('g', { opacity: 0.09 })).add(new N('path', { d: foot.join(''), fill: INK, stroke: INK, 'stroke-width': 0.08, 'stroke-linejoin': 'round' }))
    }
    motionCss.length = keep
    glows.length = keepGlow
  }

  // Grass tufts and flower dots, merged into a handful of paths.
  const tufts = new Map<string, string>()
  const filled = (c: string) => c.startsWith('#ff') || c === '#c6b6ff' || c === '#b3acd8'
  for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) {
    const k0 = key(i, j)
    if (!isLand(i, j) || taken.has(k0) || road.has(k0) || wet.has(k0) || pond.has(k0) || reserved.has(k0)) continue
    const d = dist[i][j], h = height[i][j]
    // Shells and pebbles on the beaches.
    if (beach.has(k0)) {
      for (let k = 0; k < 2; k++) {
        const [x, y] = P(i + 0.15 + R() * 0.7, j + 0.15 + R() * 0.7, h)
        const col = R() < 0.5 ? '#ffffff' : d.key === 'badlands' ? '#b3acd8' : '#ffc9d6'
        tufts.set(col, (tufts.get(col) ?? '') + (R() < 0.5 ? `M${f(x - 1.8)} ${f(y)}a1.8 1.2 0 1 0 3.6 0a1.8 1.2 0 1 0 -3.6 0` : `M${f(x - 2)} ${f(y)}q2 -3.5 4 0z`))
      }
      continue
    }
    // The Badlands are dry: the ground is cracked into plates.
    if (d.key === 'badlands') {
      if (h === 0 && R() < 0.75) {
        const u = i + 0.2 + R() * 0.5, v = j + 0.2 + R() * 0.5
        const pts = [[u, v], [u + 0.12, v + 0.1], [u + 0.1, v + 0.24], [u + 0.26, v + 0.3]].map(([a, b]) => P(a, b, h))
        const [bx2, by2] = P(u + 0.12, v + 0.1, h), [cx2, cy2] = P(u + 0.22, v + 0.02, h)
        const crack = `M${pts.map((p) => p.map(f).join(' ')).join('L')}M${f(bx2)} ${f(by2)}L${f(cx2)} ${f(cy2)}`
        tufts.set('crack', (tufts.get('crack') ?? '') + crack)
      }
      if (h === 0 && hz(i, j, 11) < 0.5) {
        const u = i + 0.15 + hz(i, j, 12) * 0.45, v = j + 0.2 + hz(j, i, 13) * 0.5
        let rp = ''
        for (let q = 0; q < 3; q++) { const [a1, b1] = P(u + q * 0.08, v - q * 0.05, h), [a2, b2] = P(u + q * 0.08 + 0.3, v - q * 0.05 + 0.06, h); rp += `M${f(a1)} ${f(b1)}Q${f((a1 + a2) / 2)} ${f((b1 + b2) / 2 - 2)} ${f(a2)} ${f(b2)}` }
        tufts.set('ripple', (tufts.get('ripple') ?? '') + rp)
      }
      continue
    }
    if (h < 0) continue
    // Tufts of three kinds, and flowers where the meadow is lightest.
    const bright = field(i, j) > 0.62
    // One more than there were, from a hash of the tile rather than the island's
    // random stream, so that every tree and house after this stays where it was.
    const extra = (n: number) => hz(i + 0.37, j + 0.71, n)
    for (let k = 0; k < (bright ? 4 : 3); k++) {
      const last = k === (bright ? 3 : 2)
      const rand = last ? ((m: number) => () => extra(m++))(60) : R
      const [x, y] = P(i + 0.15 + rand() * 0.7, j + 0.15 + rand() * 0.7, h)
      const r = rand()
      const col = bright && r < 0.45 ? (rand() < 0.35 ? '#ffffff' : rand() < 0.6 ? '#ffb3c2' : '#c6b6ff') : r < 0.12 ? '#ffffff' : shade(d.ground[0], 0.78)
      const isFlower = filled(col)
      const kind = rand()
      tufts.set(col, (tufts.get(col) ?? '') + (isFlower ? `M${f(x - 1.6)} ${f(y)}a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0 -3.2 0` : kind < 0.45 ? `M${f(x - 3)} ${f(y)}l1.5 -3.5l1.5 3.5l1.5 -4l1.5 4` : kind < 0.8 ? `M${f(x - 2)} ${f(y)}q-0.5 -4 -2 -6M${f(x)} ${f(y)}v-7M${f(x + 2)} ${f(y)}q0.5 -4 2 -6` : `M${f(x - 2.5)} ${f(y)}q2.5 -4 5 0`))
    }
  }
  // Pebbles kicked to the side of the roads, and clover in the grass.
  let pebbles = '', clover = ''
  for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) {
    const k0 = key(i, j)
    if (!isLand(i, j) || taken.has(k0) || road.has(k0) || wet.has(k0) || pond.has(k0) || reserved.has(k0) || beach.has(k0) || height[i][j] !== 0) continue
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (!road.has(key(i + a, j + b)) || hz(i * 3 + a, j * 3 + b, 41) > 0.55) continue
      // On this tile's side of the edge it shares with the road, a little in from it.
      const along = 0.2 + hz(i, j + a, 42) * 0.6
      const u = a ? (a > 0 ? i + 0.86 : i + 0.14) : i + along, v = b ? (b > 0 ? j + 0.86 : j + 0.14) : j + along
      for (let q = 0; q < 2; q++) {
        const [x, y] = P(u + (hz(i, j, 43 + q) - 0.5) * 0.14, v + (hz(j, i, 45 + q) - 0.5) * 0.14, 0), r = 1.2 + hz(i, j, 47 + q) * 1.1
        pebbles += ring(x, y, r * 1.35, r)
      }
    }
    if (dist[i][j].key !== 'badlands' && hz(i, j, 49) < 0.32) {
      const [x, y] = P(i + 0.25 + hz(i, j, 50) * 0.5, j + 0.25 + hz(j, i, 51) * 0.5, 0)
      for (const [dx, dy] of [[-1.7, 0.3], [1.7, 0.3], [0, -1.3]]) clover += ring(x + dx, y + dy, 1.6, 1.2)
    }
  }
  const tuftG = root.add(new N('g', { class: 'tufts' }))
  tuftG.add(new N('path', { d: clover, fill: C.leaf, opacity: 0.5 }))
  tuftG.add(new N('path', { d: pebbles, fill: painted ? '#d9d4c8' : '#e3e6f2', stroke: INK, 'stroke-width': 0.6 }))
  if (painted) {
    // Wildflowers, the way they grow: in drifts, one kind to a drift, thick in the
    // middle and thinning out, with open grass between. A slow field says where the
    // drifts are and another which flower; each spot of a drift is a little clump.
    const open = (i: number, j: number) => { const k = key(i, j); return isLand(i, j) && !taken.has(k) && !road.has(k) && !wet.has(k) && !pond.has(k) && !reserved.has(k) && !beach.has(k) && dist[i][j].key !== 'badlands' && !snowyAt(i, j) }
    const KINDS = [['#ffffff', '#f4d9e4'], ['#ff9fb6', '#ffd0dc'], ['#b9a2ff', '#ddd0ff'], ['#7fb2ff', '#c7dcff']]
    const heads = KINDS.map(() => ''), hearts = KINDS.map(() => '')
    let stems = '', leaves = ''
    for (let a = 0; a < GRID * 3; a++) for (let b = 0; b < GRID * 3; b++) {
      const u = (a + 0.5 + (hz(a, b, 81) - 0.5) * 0.9) / 3, v = (b + 0.5 + (hz(b, a, 82) - 0.5) * 0.9) / 3
      const i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j
      if (!open(i, j) || fu < 0.08 || fv < 0.08 || fu > 0.92 || fv > 0.92) continue
      const drift = wander(u * 0.62, v * 0.62, 12.3) + 0.25 * wander(u * 2.1, v * 2.1, 3.3)
      if (drift < 0.3 + hz(a, b, 83) * 0.3) continue
      const kind = Math.floor(((wander(u * 0.27, v * 0.27, 4.4) + 1) / 2) * KINDS.length * 0.999 + 4) % KINDS.length
      const z = height[i][j], n = 2 + Math.floor(hz(a, b, 84) * 3)
      for (let q = 0; q < n; q++) {
        const [x, y] = P(u + (hz(a + q, b, 85) - 0.5) * 0.16, v + (hz(a, b + q, 86) - 0.5) * 0.16, z), h = 4 + hz(a, q, 87) * 3
        stems += `M${f(x)} ${f(y)}q0.4 ${f(-h * 0.5)} 0 ${f(-h)}`
        if (q === 0) leaves += `M${f(x)} ${f(y - 1)}q-2.6 -0.6 -3.4 -3M${f(x)} ${f(y - 1.4)}q2.4 -0.8 3 -3.2`
        heads[kind] += `M${f(x - 2.3)} ${f(y - h)}a2.3 1.9 0 1 0 4.6 0a2.3 1.9 0 1 0 -4.6 0`
        hearts[kind] += `M${f(x - 0.7)} ${f(y - h - 0.3)}a0.7 0.6 0 1 0 1.4 0a0.7 0.6 0 1 0 -1.4 0`
      }
    }
    // Long grass in the verges, where the mower never reaches: clumps along both sides of every lane.
    let verge = '', vergeLit = ''
    for (const [n, r] of routes.entries()) for (let k = 1; k < r.length; k++) {
      const [i0, j0] = r[k - 1], [i1, j1] = r[k]
      for (const side of [-1, 1]) {
        if (hz(n * 7 + k, side + 3, 88) > 0.55) continue
        const di = i1 - i0, dj = j1 - j0, t = hz(k, n, 89 + side)
        const u = i0 + 0.5 + di * t + -dj * side * 0.64, v = j0 + 0.5 + dj * t + di * side * 0.64
        if (!open(Math.floor(u), Math.floor(v))) continue
        const [x, y] = P(u, v, 0)
        const blade = `M${f(x - 3)} ${f(y)}q-0.6 -4 -2.4 -6M${f(x - 1)} ${f(y)}q-0.2 -5.4 -0.8 -7.8M${f(x + 1)} ${f(y)}q0.4 -4.6 1.6 -7M${f(x + 3)} ${f(y)}q0.8 -3.4 2.6 -5`
        if ((k + side) % 3) verge += blade; else vergeLit += blade
      }
    }
    tuftG.add(new N('path', { d: verge, fill: 'none', stroke: LAND.grassDeep, 'stroke-width': 1.3, 'stroke-linecap': 'round' }))
    tuftG.add(new N('path', { d: vergeLit, fill: 'none', stroke: LAND.lip, 'stroke-width': 1.3, 'stroke-linecap': 'round' }))
    tuftG.add(new N('path', { d: leaves, fill: 'none', stroke: LAND.grassDeep, 'stroke-width': 1.2, 'stroke-linecap': 'round' }))
    tuftG.add(new N('path', { d: stems, fill: 'none', stroke: LAND.grassDeep, 'stroke-width': 0.9, 'stroke-linecap': 'round' }))
    KINDS.forEach(([c, hi], q) => {
      if (!heads[q]) return
      tuftG.add(new N('path', { d: heads[q], fill: c, stroke: INK, 'stroke-width': 0.55 }))
      tuftG.add(new N('path', { d: hearts[q], fill: q === 0 ? '#f3ead2' : hi }))
    })
  }
  for (const [c, d] of tufts) tuftG.add(new N('path', c === 'crack' ?{ d, fill: 'none', stroke: painted ? '#a59478' : '#9d95c9', 'stroke-width': 1.1, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' } : c === 'ripple' ? { d, fill: 'none', stroke: painted ? '#e6dfd0' : '#ebe5f6', 'stroke-width': 1.1, 'stroke-linecap': 'round', opacity: 0.9 } : filled(c) ? { d, fill: c, stroke: INK, 'stroke-width': 0.5 } : { d, fill: 'none', stroke: c, 'stroke-width': 1.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }))

  // Fields, laid flat: lavender under Sky Peaks, wheat on the Proving
  // Grounds, an allotment by the harbour.
  for (const [i, j, w, d, kind] of fields) cropField(new Pen(root), i, j, w, d, kind)

  // People walking the roads, there and back.
  // With a plate, the ground is its picture: of all this, only the falls' moving water stays.
  if (plate) {
    const falls: N[] = []
    const find = (n: N) => { for (const k of n.kids) if (typeof k !== 'string') { if (String(k.attrs.class ?? '').split(' ').includes('fall')) falls.push(k); else find(k) } }
    find(root)
    root.kids = falls.length ? [new N('g', { class: 'ground' })] : []
    for (const f of falls) (root.kids[0] as N).add(f)
  }
  root = open('walkers')
  const walkers = root.add(new N('g', { class: 'walkers' }))
  /** Everyone on the roads, and the road cells each one uses: drawn again in front of a building they pass (below). */
  const goers: { cells: Set<string>; node: N }[] = []
  const cellsOf = (cells: [number, number][]) => new Set(cells.map((c) => key(...c)))
  const shirts = [C.rasp, C.cobalt, C.lilac, C.mint, C.sky, '#ffffff', C.slate]
  /** Stops along a walk (when, in %; where), as motionPath's frames, so a walker knows which way it heads between them. */
  const stopsOf = (stops: [number, [number, number]][]): MotionFrame[] => stops.map(([t, q]) => [t, q[0], q[1], 0])
  // The town's walkers: a crowd of a dozen, each always the same person (lib/island/actors.ts), out on the roads by turns.
  const crowd = Array.from({ length: 12 }, (_, m) => who(shirts[m % shirts.length], m * 13.7 + 2))
  routes.forEach((r, n) => {
    if (r.length < 4) return
    for (let k = 0; k < 2; k++) {
      const side = k ? 0.14 : -0.14
      const pts = r.map(([i, j]) => P(i + 0.5 + side, j + 0.5 - side))
      const name = `walk${walkers.kids.length}`
      const frames = motionPath(name, k ? [...pts].reverse() : pts, { back: true })
      const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1])
      const dur = `${f(r.length * 2.6 + R() * 8)}s`, delay = `${f(-R() * 30)}s`
      const g = walkers.add(new N('g', { class: 'walker mover', 'data-b': `${f(Math.min(...xs) - 30)} ${f(Math.min(...ys) - 34)} ${f(Math.max(...xs) + 12)} ${f(Math.max(...ys) + 8)}`, style: `animation:${name} ${dur} linear infinite ${delay}` }))
      g.add(walker(crowd[(n * 2 + k) % crowd.length], name, frames, dur, delay) ?? walkerFigure(shirts[(n * 2 + k) % shirts.length], 1, n * 2 + k))
      goers.push({ cells: cellsOf(r), node: g })
    }
  })

  // Traffic: cars, a bus and bikes up and down the longest straight roads.
  {
    const runs: [number, number][][] = []
    for (const r of routes) {
      let cur: [number, number][] = [r[0]]
      for (let n = 1; n < r.length; n++) {
        const d0 = cur.length > 1 ? [cur[1][0] - cur[0][0], cur[1][1] - cur[0][1]] : null
        const d1 = [r[n][0] - r[n - 1][0], r[n][1] - r[n - 1][1]]
        if (d0 && (d0[0] !== d1[0] || d0[1] !== d1[1])) { runs.push(cur); cur = [r[n - 1]] }
        cur.push(r[n])
      }
      runs.push(cur)
    }
    const seen = new Set<string>()
    const long = runs.filter((r) => r.length >= 5).sort((a, b) => b.length - a.length).filter((r) => { const k = r.map((c) => key(...c)); if (k.some((x) => seen.has(x))) return false; k.forEach((x) => seen.add(x)); return true }).slice(0, 6)
    const kinds: ['car' | 'bus' | 'bike', string][] = [['car', C.rasp], ['bus', C.cobalt], ['car', C.mint], ['bike', C.rasp], ['car', '#ffffff'], ['bike', C.cobalt]]
    long.forEach((r, n) => {
      const [kind, body] = kinds[n % kinds.length]
      const a0 = r[0], b0 = r[r.length - 1]
      const axis: 'x' | 'y' = a0[0] !== b0[0] ? 'x' : 'y'
      const dur = r.length * (kind === 'bike' ? 3.2 : 2) + 4, delay = n * 3.3
      const A = P(a0[0] + 0.5, a0[1] + 0.5), B = P(b0[0] + 0.5, b0[1] + 0.5)
      // Cause and effect, part three: the first few stop at a zebra crossing
      // half-way along, while someone waiting on the kerb walks over.
      if (n < 4 && kind !== 'bike' && r.length >= 6) {
        const mid = r[Math.floor(r.length / 2)], di = Math.sign(b0[0] - a0[0]), dj = Math.sign(b0[1] - a0[1])
        const cx = mid[0] + 0.5, cy = mid[1] + 0.5
        crossing(new Pen(walkers), cx, cy, axis === 'x' ? 'y' : 'x')
        const back = kind === 'bus' ? 0.75 : 0.58
        const sh = shuttle(kind, body, A, B, axis, `drive${n}`, dur, delay, [P(cx - di * back, cy - dj * back), P(cx + di * back, cy + dj * back)])
        const [h1, h2] = sh.holds!
        const kA = P(cx + dj * 0.4, cy + di * 0.4), kB = P(cx - dj * 0.4, cy - di * 0.4)
        const tr = (q: [number, number]) => `transform:translate(${r1(q[0])}px,${r1(q[1])}px)`
        motionCss.push(`@keyframes cross${n}{0%,${f(h1[0] + 1)}%{${tr(kA)}}${f(h1[1] - 1)}%,${f(h2[0] + 1)}%{${tr(kB)}}${f(h2[1] - 1)}%,100%{${tr(kA)}}}`)
        const pg = walkers.add(new N('g', { class: 'walker mover', 'data-b': `${f(Math.min(kA[0], kB[0]) - 8)} ${f(Math.min(kA[1], kB[1]) - 24)} ${f(Math.max(kA[0], kB[0]) + 8)} ${f(Math.max(kA[1], kB[1]) + 3)}`, style: `animation:cross${n} ${dur}s linear infinite ${f(-delay)}s` }))
        pg.add(walker(crowd[(n + 5) % crowd.length], `cross${n}`, stopsOf([[0, kA], [h1[0] + 1, kA], [h1[1] - 1, kB], [h2[0] + 1, kB], [h2[1] - 1, kA], [100, kA]]), `${dur}s`, `${f(-delay)}s`) ?? walkerFigure(shirts[(n + 2) % shirts.length], 1, 100 + n))
        walkers.add(sh)
        goers.push({ cells: cellsOf([mid]), node: pg }, { cells: cellsOf(r), node: sh })
        return
      }
      const sh = walkers.add(shuttle(kind, body, A, B, axis, `drive${n}`, dur, delay))
      goers.push({ cells: cellsOf(r), node: sh })
    })
  }

  // Two ducks going round the pond.
  if (pond.size) {
    const loop = (ri: number, rj: number): [number, number][] => Array.from({ length: 20 }, (_, k) => { const a = (k / 20) * Math.PI * 2; return P(15 + Math.cos(a) * ri, 10.5 + Math.sin(a) * rj) })
    walkers.add(pokeN('duck')).add(duck(loop(0.42, 0.85), 'duck0', 26, 0))
    walkers.add(pokeN('duck')).add(duck(loop(0.3, 0.6).reverse(), 'duck1', 19, 7, '#b9a6ff'))
  }

  /* ---- everything standing up, back to front ---------------------------- */
  type Thing = { depth: number; slug?: string; draw: (g: N) => void }
  const things: Thing[] = []
  const anchors: Record<string, Anchor> = {}
  const link = new Map(games.map((g) => [g.slug, g]))
  const cx = GRID / 2
  for (const pl of placed) {
    const g = link.get(pl.slug)
    things.push({ depth: pl.i + pl.j + (pl.w + pl.d) / 2 + 0.01, slug: pl.slug, draw: (layer) => {
      const a = layer.add(new N('a', { class: 'lm', href: g?.href ?? `/${pl.slug}/`, 'data-slug': pl.slug, 'aria-label': g ? `${g.title}: ${g.blurb}` : pl.slug, style: `--d:${Math.round(Math.hypot(pl.i + pl.w / 2 - cx, pl.j + pl.d / 2 - cx) * 45)}ms` }))
      // The ring that shows under a building when it is picked.
      const [rx, ry] = P(pl.i, pl.j, pl.z)
      const hp = drawnPlot(pl)
      a.add(new N('path', { class: 'lm-ring', d: quad([P(hp.i - 0.08, hp.j - 0.08, pl.z), P(hp.i + hp.w + 0.08, hp.j - 0.08, pl.z), P(hp.i + hp.w + 0.08, hp.j + hp.d + 0.08, pl.z), P(hp.i - 0.08, hp.j + hp.d + 0.08, pl.z)]), fill: '#ffffff', 'fill-opacity': 0.35, stroke: '#ffffff', 'stroke-width': 3, 'stroke-dasharray': '6 6' }))
      void rx; void ry
      const art = a.add(joinRoot(new N('g', { class: 'lm-art', id: `lm-${pl.slug}`, 'stroke-linejoin': 'round' })))
      const b = new Bounds()
      const { sink, real } = sinkFor(pl.slug)
      const lp = new Pen(art, pl.i, pl.j, pl.z, b, lights, sink)
      const l0 = lights.length, g0 = glows.length, beacon0 = [beacon[0], beacon[1]], p0 = planted.length, s0 = signBoxes.length
      // (The lamp of a lighthouse is set afresh: the drawing for its shadow, earlier, set it already.)
      beacon[0] = 0; beacon[1] = 0
      pl.lm.draw(lp)
      const ownBeacon = !!(beacon[0] || beacon[1])
      if (!ownBeacon) { beacon[0] = beacon0[0]; beacon[1] = beacon0[1] }
      // A set piece's people stay their own size, where they stood (before its rim is drawn round them).
      const inv = hp.k !== 1 ? ` scale(${Math.round((1 / hp.k) * 1000) / 1000}) ` : ''
      if (inv) {
        const lifeSize = (n: N | string) => {
          if (typeof n === 'string') return
          const foot = figFeet.get(n)
          if (foot) { n.attrs.transform = `translate(${f(foot[0])} ${f(foot[1])})${inv}translate(${f(-foot[0])} ${f(-foot[1])})`; return }
          n.kids.forEach(lifeSize)
        }
        lifeSize(art)
      }
      // The heavier line round its outside, under everything else in it (not round a photograph).
      if (!real) art.kids.unshift(rim(art))
      if (hp.k !== 1) {
        // A set piece: the whole drawing scaled about the front corner of its plot. Its lines are
        // thinned to match (a little heavier than the rest: it is the district's own building), and
        // whatever keeps a screen position of it (its bounds, its lights, its glows, a lighthouse's
        // lamp) is moved to where it now is.
        const k = hp.k, [ax, ay] = P(pl.i + pl.w, pl.j + pl.d, pl.z)
        const tf = `translate(${f(ax)} ${f(ay)}) scale(${k}) translate(${f(-ax)} ${f(-ay)})`
        const T = (x: number, y: number): [number, number] => [ax + (x - ax) * k, ay + (y - ay) * k]
        // The same in the world's units, about the plot's front corner.
        const W = ([i, j, z]: [number, number, number]): [number, number, number] => [pl.i + pl.w + (i - pl.i - pl.w) * k, pl.j + pl.d + (j - pl.j - pl.d) * k, pl.z + (z - pl.z) * k]
        art.attrs.transform = tf
        const thin = (n: N | string) => {
          if (typeof n === 'string') return
          // (Not a person put back to size: their lines are everyone's already.)
          if (typeof n.attrs.transform === 'string' && n.attrs.transform.includes(inv)) return
          const sw = n.attrs['stroke-width']
          if (typeof sw === 'number') n.attrs['stroke-width'] = Math.round((sw / k) * 1.15 * 1000) / 1000
          for (const c of n.kids) thin(c)
        }
        thin(art)
        const [x0, y0] = T(b.x0, b.y0), [x1, y1] = T(b.x1, b.y1)
        b.x0 = x0; b.y0 = y0; b.x1 = x1; b.y1 = y1
        for (let n = l0; n < lights.length; n++) { const l = lights[n], [x, y] = T(l[0], l[1]); l[0] = x; l[1] = y; l.tf = tf; if (l.w) l.w = W(l.w) }
        // For Unity, which builds it bigger about the same point (Buildings.cs, Hero): where it is, and how much.
        const rec = solids.find((s) => s.slug === pl.slug)
        if (rec) { rec.k = k; rec.at = [pl.i + pl.w, pl.j + pl.d, pl.z] }
        // What grows on it stands where it now is, its own size (as its people do).
        for (let n = p0; n < planted.length; n++) { const q = planted[n], [x, y, z] = W([q.x, q.y, q.z]); q.x = f(x); q.y = f(y); q.z = f(z) }
        // Unity's pictures of its runs are already where they go, and their size: the scale is undone on each.
        if (real) {
          const un = `translate(${f(ax)} ${f(ay)}) scale(${Math.round((1 / k) * 1e5) / 1e5}) translate(${f(-ax)} ${f(-ay)})`
          const unscale = (n: N) => { n.kids = n.kids.map((c) => (typeof c === 'string' ? c : shotImgs.has(c) ? Object.assign(new N('g', { transform: un }), { kids: [c] }) : (unscale(c), c))) }
          unscale(art)
        }
        for (let n = g0; n < glows.length; n++) { const w = new N('g', { transform: tf }); w.add(glows[n]); glows[n] = w }
        if (ownBeacon) { const [x, y] = T(beacon[0], beacon[1]); beacon[0] = x; beacon[1] = y }
      }
      if (hp.k !== 1 && !pl.lm.water) {
        // Its plinth, under it: low dressed stone a little wider than the plot, with steps up the
        // middle of each side we see (where a road or the open ground meets it).
        const base = new N('g', { class: 'lm-set' })
        a.kids.splice(a.kids.indexOf(art), 0, base)
        // (Its solids written down for Unity as a building of its own, built and pictured as the rest are.)
        const set = sinkFor(`${pl.slug}-set`)
        const bp = new Pen(base, 0, 0, pl.z, b, lights, set.sink)
        const e = 0.16, x0 = hp.i - e, y0 = hp.j - e, w = hp.w + e * 2, d = hp.d + e * 2, stone = '#d8d5cc'
        bp.box(x0, y0, w, d, 5, { fill: stone, sw: 1.2 })
        // Flagstones on its top, in two directions (Unity's stone has its own).
        let flags = ''
        for (let u = 0.5; u < w; u += 0.5) { const [p1, p2] = [P(x0 + u, y0, pl.z + 5), P(x0 + u, y0 + d, pl.z + 5)]; flags += `M${f(p1[0])} ${f(p1[1])}L${f(p2[0])} ${f(p2[1])}` }
        for (let v = 0.5; v < d; v += 0.5) { const [p1, p2] = [P(x0, y0 + v, pl.z + 5), P(x0 + w, y0 + v, pl.z + 5)]; flags += `M${f(p1[0])} ${f(p1[1])}L${f(p2[0])} ${f(p2[1])}` }
        if (!set.real) base.add(new N('path', { d: flags, fill: 'none', stroke: shade(stone, 0.72), 'stroke-width': 0.7, opacity: 0.6 }))
        bp.box(x0 + w, y0 + d / 2 - 0.22, 0.12, 0.44, 2.5, { fill: shade(stone, 0.97), sw: 1 })
        bp.box(x0 + w / 2 - 0.22, y0 + d, 0.44, 0.12, 2.5, { fill: shade(stone, 0.97), sw: 1 })
        // In front of it: a planter at each front corner, and a lamp beside each, unless that is road.
        const sp = new Pen(a, 0, 0, pl.z, b, lights, set.sink)
        const fx = x0 + w, fy = y0 + d
        for (const [px, py, lx, ly] of [[fx - 0.1, fy - 0.42, fx - 0.1, y0 + 0.2], [fx - 0.42, fy - 0.1, x0 + 0.2, fy - 0.1]] as [number, number, number, number][]) {
          if (!road.has(key(Math.floor(px + 0.12), Math.floor(py + 0.12)))) {
            sp.box(px - 0.11, py - 0.11, 0.22, 0.22, 7, { z0: 5, fill: '#b7b2a6', sw: 1.1 })
            tree(sp.move(0, 0, 12), px, py, 'bush', C.leaf, 0.55)
          }
          // (Nor where it would stand in front of its building's own sign, now grown with it.)
          const [qx, qy] = P(lx, ly, pl.z + 5)
          const [ax, ay] = P(pl.i + pl.w, pl.j + pl.d, pl.z), T = (x: number, y: number) => [ax + (x - ax) * hp.k, ay + (y - ay) * hp.k]
          const hides = signBoxes.slice(s0).some(([a0, b0, a1, b1]) => { const [x0, y0] = T(a0, b0), [x1, y1] = T(a1, b1); return qx > x0 - 5 && qx < x1 + 5 && qy - 30 < y1 && qy > y0 })
          if (!hides && !road.has(key(Math.floor(lx + 0.12), Math.floor(ly + 0.12)))) lamp(sp.move(0, 0, 5), lx, ly, 26)
        }
      }
      const [bx, by] = P(pl.i + pl.w / 2, pl.j + pl.d / 2, pl.z)
      anchors[pl.slug] = { slug: pl.slug, district: pl.district, x0: f(b.x0), y0: f(b.y0), x1: f(b.x1), y1: f(b.y1), bx: f(bx), by: f(by), foot: [P(hp.i, hp.j, pl.z), P(hp.i + hp.w, hp.j, pl.z), P(hp.i + hp.w, hp.j + hp.d, pl.z), P(hp.i, hp.j + hp.d, pl.z)].map((q) => q.map(f).join(',')).join(' ') }
      // People on the roads are painted below everything that stands up, which
      // is right for whatever is in front of them; but walking past the front
      // of a building, their heads would go behind its wall. So everyone who
      // uses a road cell along the two sides of it we can see is drawn once
      // more, after it, through a window just over those cells: in front of
      // the building there, and nowhere else. (The canvas only draws the copy
      // while someone is in the window.)
      if (pl.lm.water) return
      const front: [number, number][] = []
      const fi = Math.ceil(pl.i + pl.w), fj = Math.ceil(pl.j + pl.d)
      for (let q = Math.floor(pl.j); q < fj; q++) front.push([fi, q])
      for (let q = Math.floor(pl.i); q <= fi; q++) front.push([q, fj])
      const onRoad = front.filter((c) => road.has(key(...c)))
      const passing = goers.filter((g) => onRoad.some((c) => g.cells.has(key(...c))))
      // (Kept with no one in it too: the day's parade walks through it.)
      if (!onRoad.length) return
      const id = `isl-front-${pl.slug}`, up = 30
      layer.add(new N('clipPath', { id })).add(new N('path', { d: onRoad.map(([i, j]) => quad([P(i, j, up), P(i + 1, j, up), P(i + 1, j, 0), P(i + 1, j + 1, 0), P(i, j + 1, 0), P(i, j + 1, up)])).join('') }))
      const fg = layer.add(new N('g', { class: 'lm-front', 'clip-path': `url(#${id})` }))
      for (const g of passing) fg.add(copyOf(g.node))
    } })
  }
  /* ---- the wild things and the farm ---------------------------------------- */
  // Each thing standing on the island has its solids written down too (a cottage's walls, a stall's awning), for Unity's pictures of them.
  let atN = 0
  const at = (i: number, j: number, depth: number, fn: (p: Pen) => void, z = height[Math.floor(i)]?.[Math.floor(j)] ?? 0) => { const slug = `at-${atN++}`; things.push({ depth, draw: (layer) => fn(new Pen(layer, 0, 0, z, new Bounds(), lights, sinkFor(slug).sink)) }) }
  if (mill) at(mill[0] + 0.5, mill[1] + 0.5, mill[0] + mill[1] + 1, (p) => { p.sink = sinkFor('windmill').sink; windmill(poke(p, 'windmill', mill[0] + 0.5, mill[1] + 0.5, 'whoosh!', 62), mill[0] + 0.5, mill[1] + 0.5) })
  for (const [i, j] of bales) for (const [u, v] of [[0.35, 0.4], [0.65, 0.62]]) at(i + u, j + v, i + j + u + v, (p) => bale(p, i + u, j + v))
  if (archAt) at(archAt[0] + 0.5, archAt[1] + 0.5, archAt[0] + archAt[1] + 1, (p) => arch(p, archAt[0] + 0.5, archAt[1] + 0.5))
  for (const [i, j, h] of buttes) at(i + 0.5, j + 0.5, i + j + 1, (p) => butte(p, i + 0.5, j + 0.5, h))
  for (const [n, [i, j]] of hoodoos.entries()) for (const [u, v, h, k] of [[0.38, 0.4, 44 - n * 6, 1], [0.66, 0.56, 30, 0.8], [0.4, 0.74, 22, 0.7]] as [number, number, number, number][]) at(i + u, j + v, i + j + u + v, (p) => hoodoo(p, i + u, j + v, h, k))
  for (const [n, [i, j]] of boulderAt.entries()) at(i + 0.5, j + 0.5, i + j + 1, (p) => boulders(p, i + 0.5, j + 0.5, 0.85 + (n % 2) * 0.25))
  // Sheep graze the low slopes of Sky Peaks; deer stand at the forest edge.
  ;[[10.5, 3.4, false], [10.35, 5.3, true], [11.45, 6.6, false], [9.55, 9.55, true], [10.6, 7.7, false]].forEach(([i, j, flip], n) => {
    if (!free(Math.floor(i as number), Math.floor(j as number))) return
    at(i as number, j as number, (i as number) + (j as number), (p) => sheep(poke(p, 'sheep', i as number, j as number, 'baa!', 16), i as number, j as number, flip as boolean, n * 1.7))
  })
  ;[[8.5, 9.45, false], [6.45, 1.5, true]].forEach(([i, j, flip], n) => {
    if (!free(Math.floor(i as number), Math.floor(j as number))) return
    at(i as number, j as number, (i as number) + (j as number), (p) => deer(poke(p, 'deer', i as number, j as number), i as number, j as number, flip as boolean, n * 3))
  })
  for (const [i, j] of [[10.5, 2.5], [12.5, 7.5], [4.6, 1.5]]) if (free(Math.floor(i), Math.floor(j))) at(i, j, i + j, (p) => toadstools(p, i, j))
  // Reeds round the pond and along the river's banks.
  for (const [i, j] of [[14.22, 9.25], [15.8, 11.72], [14.2, 11.75], [15.82, 9.3], [7.12, 6.5], [7.86, 9.4], [7.85, 5.3], [7.14, 10.6]]) at(i, j, i + j, (p) => reeds(p, i, j, 0.85))
  // Crabs on the beaches, a tumbleweed in the Badlands.
  ;[[8.5, 13.5], [24.5, 24.6], [13.5, 27.5], [3.5, 17.4]].forEach(([i, j], n) => { if (beach.has(key(Math.floor(i), Math.floor(j)))) at(i, j, i + j, (p) => crab(poke(p, 'crab', i, j, 'snip!', 12), i, j, n * 2.3)) })
  if (free(23, 7) || isLand(23, 7)) at(23.5, 6.5, 30, (p) => tumbleweed(p, 23.5, 6.5, 2))
  // Butterflies over the brightest meadows.
  {
    let made = 0
    const cols = ['#ff9fb2', C.lilac, '#ffffff', C.sky, '#ffd1da']
    for (let i = 0; i < GRID && made < 9; i++) for (let j = 0; j < GRID && made < 9; j++) {
      const d = dist[i][j]
      if (!free(i, j) || height[i][j] !== 0 || coast(i, j) || field(i, j) < 0.66 || !['oldtown', 'funfair', 'market', 'proving'].includes(d.key)) continue
      if ((i * 13 + j * 7) % 5) continue
      const c = cols[made % cols.length], n = made++
      at(i + 0.5, j + 0.5, i + j + 1.5, (p) => butterfly(p, i + 0.5, j + 0.5, 18, c, n * 1.3))
    }
  }
  // Hedges along Old Town's roads, and a topiary or two.
  for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) {
    if (!road.has(key(i, j)) || dist[i][j].key !== 'oldtown') continue
    for (const [a, b] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const ni = i + a, nj = j + b
      if (!free(ni, nj) || height[ni][nj] !== 0 || coast(ni, nj) || (i * 5 + j * 3 + a * 7 + b * 11) % 3) continue
      // A hedge on the free side of the shared edge, a little in from it.
      const e = 0.12
      if (a === 1) at(ni + e, nj + 0.5, ni + nj + 0.6, (p) => hedge(p, ni + e, nj + 0.12, ni + e, nj + 0.88))
      else if (a === -1) at(ni + 1 - e, nj + 0.5, ni + nj + 1.4, (p) => hedge(p, ni + 1 - e, nj + 0.12, ni + 1 - e, nj + 0.88))
      else if (b === 1) at(ni + 0.5, nj + e, ni + nj + 0.6, (p) => hedge(p, ni + 0.12, nj + e, ni + 0.88, nj + e))
      else at(ni + 0.5, nj + 1 - e, ni + nj + 1.4, (p) => hedge(p, ni + 0.12, nj + 1 - e, ni + 0.88, nj + 1 - e))
      reserved.add(key(ni, nj))
    }
  }
  for (const [i, j] of [[12.3, 12.4], [12.7, 12.6], [17.3, 13.3], [10.4, 13.6]]) if (free(Math.floor(i), Math.floor(j)) && height[Math.floor(i)][Math.floor(j)] === 0) at(i, j, i + j, (p) => topiary(p, i, j, 0.9))

  /* ---- town life ------------------------------------------------------------ */
  // Filler is quieter than the games: paler roofs, no raspberry, so the
  // buildings you can play stand out from the houses between them.
  const ROOFS = ['#9fb5f2', '#c3b3f3', '#8fd9c4', '#a9cdf5', '#d6b9e6', '#b3c4e8']
  const WALLS = ['#ffffff', '#f6f8fd', '#f2f6fd', '#f6f3fd']
  // Little houses between the big ones, each with its door to a road we can
  // see (the +x or +y side), kept a tile clear of every building.
  {
    let made = 0
    const nearLm = (i: number, j: number) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => taken.has(key(i + a, j + b)))
    const homes = new Set<string>()
    const nearHome = (i: number, j: number) => { for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (homes.has(key(i + a, j + b))) return true; return false }
    for (let s = 0; s < GRID * 2 && made < 16; s++) for (let i = 0; i < GRID && made < 16; i++) {
      const j = s - i
      if (j < 0 || j >= GRID || !free(i, j) || height[i][j] !== 0 || coast(i, j) || nearLm(i, j) || nearHome(i, j)) continue
      if (!['oldtown', 'market', 'harbour', 'funfair', 'proving'].includes(dist[i][j].key)) continue
      const door: 'x' | 'y' | null = road.has(key(i + 1, j)) ? 'x' : road.has(key(i, j + 1)) ? 'y' : null
      if (!door) continue
      reserved.add(key(i, j)); homes.add(key(i, j))
      const n = made++
      const roof = ROOFS[n % ROOFS.length], wall = WALLS[n % WALLS.length]
      at(i + 0.5, j + 0.5, i + j + 1, (p) => cottage(p, i + 0.45, j + 0.45, { wall, roof, door, smoke: n % 3 === 0 }))
      if (n % 2 === 0) at(i + 0.9, j + 0.88, i + j + 1.8, (p) => (door === 'x' ? postbox(p, i + 0.9, j + 0.85) : postbox(p, i + 0.85, j + 0.9)))
      else at(i + 0.82, j + 0.14, i + j + 0.96, (p) => flowers(p, i + 0.82, j + 0.16))
    }
  }
  // Signposts at the crossroads, and where a road crosses from one district
  // into the next: a board for each road out, saying which district it leads to: the district whose own end of the roads (its gate,
  // or the hub for Old Town) is fewest steps away that way, and nearer that
  // way than any other. A road that leads nowhere in particular, or that leads
  // as quickly as another road does to the same place, gets no board. Each
  // board wears its district's passport ink and stamp shape, and its name.
  const signposts: Signpost[] = []
  {
    const NAME: Record<DistrictKey, string> = { peaks: 'Sky Peaks', badlands: 'Badlands', proving: 'Proving', harbour: 'Harbour', funfair: 'Funfair', market: 'Market', oldtown: 'Old Town' }
    const goalOf = (k: DistrictKey): [number, number] => (k === 'oldtown' ? hub : gates[k])
    /** Steps along the roads from a cell to every road cell, never through the one blocked. */
    const along = (from: [number, number], block: string) => {
      const d = new Map<string, number>([[key(...from), 0]]), q: [number, number][] = [from]
      while (q.length) {
        const c = q.shift()!, n = d.get(key(...c))!
        for (const [u, v] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nk = key(c[0] + u, c[1] + v)
          if (nk === block || d.has(nk) || !road.has(nk)) continue
          d.set(nk, n + 1); q.push([c[0] + u, c[1] + v])
        }
      }
      return d
    }
    const outOf = (i: number, j: number) => [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([u, v]) => road.has(key(i + u, j + v)))
    const cells: [number, number][] = []
    for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) if (road.has(key(i, j)) && outOf(i, j).length >= 3) cells.push([i, j])
    // A straight stretch of road where the district changes underfoot.
    for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) {
      const o = road.has(key(i, j)) ? outOf(i, j) : []
      if (o.length === 2 && o[0][0] === -o[1][0] && o.some(([u, v]) => dist[i + u][j + v].key !== dist[i][j].key)) cells.push([i, j])
    }
    for (const [i, j] of cells) {
      if (signposts.length >= 8) break
      const out = outOf(i, j)
      if (signposts.some((q) => Math.abs(q.i - i) + Math.abs(q.j - j) < 5)) continue
      // A free spot beside the junction (a corner, or a side no road leaves by), best one with no
      // building just in front of it to hide the post.
      const behind = (a: number, b: number) => [[1, 0], [0, 1], [1, 1]].some(([u, v]) => taken.has(key(a + u, b + v)))
      const spots = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [0, 1], [-1, 0], [0, -1]].filter(([u, v]) => free(i + u, j + v) && height[i + u][j + v] === 0 && !coast(i + u, j + v))
      const corner = spots.find(([u, v]) => !behind(i + u, j + v)) ?? spots[0]
      if (!corner) continue
      const ways = out.map(([u, v]) => ({ u, v, d: along([i + u, j + v], key(i, j)) }))
      // A board names the nearest district its road leads to, other than the one it stands in where it can.
      const pick = new Map<number, { to: DistrictKey; steps: number; rank: number }>()
      for (const D of DISTRICTS) {
        const g = key(...goalOf(D.key))
        const by = ways.map((w) => (w.d.get(g) ?? Infinity) + 1)
        const best = Math.min(...by), w = by.indexOf(best)
        // Unreachable, or no quicker this way than another: no board says so.
        if (!Number.isFinite(best) || by.filter((x) => x - best < 2).length > 1) continue
        const cur = pick.get(w), rank = best + (D.key === dist[i][j].key ? 1000 : 0)
        if (!cur || rank < cur.rank) pick.set(w, { to: D.key, steps: best, rank })
      }
      const boards = [...pick].map(([w, p]) => ({ dx: ways[w].u, dy: ways[w].v, to: p.to, steps: p.steps })).sort((x, y) => x.steps - y.steps).slice(0, 3)
      if (boards.length < 2) continue
      const [ci, cj] = [i + corner[0], j + corner[1]]
      const x = ci + 0.5 - corner[0] * 0.3, y = cj + 0.5 - corner[1] * 0.3
      signposts.push({ i, j, at: [x, y], boards })
      at(x, y, ci + cj + 1 - (corner[0] + corner[1]) * 0.3, (p) => signpost(p, x, y, boards.map((q) => ({ dx: q.dx, dy: q.dy, ink: STAMP[q.to].ink, name: NAME[q.to], shape: STAMP[q.to].shape as Emblem }))))
      reserved.add(key(ci, cj))
    }
  }
  const spot = (cands: [number, number][], fn: (i: number, j: number) => void, ok = (i: number, j: number) => height[i][j] === 0 && !coast(i, j)) => {
    for (const [i, j] of cands) if (free(i, j) && ok(i, j)) { reserved.add(key(i, j)); fn(i, j); return true }
    return false
  }
  spot([[13, 16], [16, 13], [12, 13], [11, 17], [13, 11]], (i, j) => at(i + 0.5, j + 0.5, i + j + 1, (p) => fountain(poke(p, 'fountain', i + 0.5, j + 0.5, 'splash!', 34), i + 0.5, j + 0.5)))
  spot([[16, 16], [16, 15], [16, 17], [12, 14], [9, 16]], (i, j) => at(i + 0.5, j + 0.5, i + j + 1, (p) => busStop(p, i + 0.5, j + 0.45)), (i, j) => height[i][j] === 0 && [[1, 0], [0, 1], [-1, 0], [0, -1]].some(([a, b]) => road.has(key(i + a, j + b))))
  // The park: a picnic, someone flying a kite, a playground.
  spot([[16, 18], [16, 14], [12, 15], [11, 13]], (i, j) => at(i + 0.5, j + 0.5, i + j + 1, (p) => picnic(p, i + 0.5, j + 0.5, [C.cobalt, C.rasp])))
  spot([[16, 17], [17, 17], [13, 19], [12, 16]], (i, j) => at(i + 0.5, j + 0.5, i + j + 1, (p) => kiteFlyer(poke(p, 'kite', i + 0.5, j + 0.5, 'wheee!', 30), i + 0.5, j + 0.5, C.lilac, C.rasp, 1)))
  spot([[11, 18], [12, 19], [13, 15], [17, 16]], (i, j) => at(i + 0.5, j + 0.5, i + j + 1, (p) => playground(p, i + 0.5, j + 0.5)))
  spot([[13, 22], [12, 21], [10, 23], [16, 23]], (i, j) => at(i + 0.5, j + 0.5, i + j + 1, (p) => kiteFlyer(poke(p, 'kite', i + 0.5, j + 0.5, 'wheee!', 30), i + 0.5, j + 0.5, C.mint, C.cobalt, 4)))
  // The 32nd building: tucked away at the very back of Sky Peaks, among
  // the pines, where hardly anyone looks.
  spot([[1, 7], [2, 7], [2, 6], [1, 8], [3, 3]], (i, j) => at(i + 0.5, j + 0.5, i + j + 1, (p) => house32(poke(p, 'house32', i + 0.5, j + 0.5, 'shh!', 34), i + 0.5, j + 0.5)), (i, j) => height[i][j] >= 12)
  // A campsite high on the peaks: two tents round a fire.
  {
    const cells: [number, number][] = [[3, 4], [3, 5], [2, 5]]
    const ok = cells.filter(([i, j]) => free(i, j))
    if (ok.length === cells.length) {
      ok.forEach(([i, j]) => reserved.add(key(i, j)))
      at(3.35, 4.4, 7.75, (p) => tent(p, 3.35, 4.4, C.rasp))
      at(2.6, 5.5, 8.1, (p) => tent(p, 2.6, 5.5, C.leafB))
      at(3.5, 5.5, 9.0, (p) => campfire(p, 3.5, 5.45))
      at(3.75, 5.85, 9.6, (p) => sitter(p, 3.75, 5.85, C.cobalt, '#e0b899'))
    }
  }
  // The promenade: a row of market stalls along Market Street's beach, lit
  // by a string of bulbs from one to the next.
  {
    const cells = [...beach].map((k) => k.split(',').map(Number) as [number, number]).filter(([i, j]) => dist[i][j].key === 'market' && j >= 23 && i >= 6 && !reserved.has(key(i, j)) && !taken.has(key(i, j))).sort((a, b) => a[0] - b[0])
    const kinds = ['fruit', 'fish', 'flowers', 'ices', 'books'] as const, stripes = [C.rasp, C.cobalt, C.mint, C.lilac, C.sky]
    let prev: [number, number] | null = null, n = 0
    for (const [i, j] of cells) {
      if (n >= 5) break
      reserved.add(key(i, j))
      const x = i + 0.5, y = j + 0.42, m = n++
      at(x, y, i + j + 0.9, (p) => stall(p, x, y, kinds[m], stripes[m]), BEACH)
      if (prev && Math.hypot(prev[0] - x, prev[1] - y) < 1.8) { const q = prev; at((q[0] + x) / 2, (q[1] + y) / 2 + 0.3, i + j + 1.2, (p) => stringLights(p, [q[0] - 0.22, q[1] + 0.2], [x - 0.22, y + 0.2], 29), BEACH) }
      prev = [x, y]
    }
  }
  // The beaches: umbrellas and towels, a sandcastle, surfboards, the lifeguard.
  {
    const sandy = [...beach].map((k) => k.split(',').map(Number) as [number, number]).filter(([i, j]) => dist[i][j].key !== 'badlands' && dist[i][j].key !== 'peaks')
    sandy.sort((a, b) => (a[0] * 31 + a[1] * 17) % 11 - (b[0] * 31 + b[1] * 17) % 11)
    let n = 0
    const towels = ['#ff9fb2', C.cobalt, C.mint, C.lilac, C.sky]
    for (const [i, j] of sandy) {
      if (n >= 11 || reserved.has(key(i, j))) continue
      const z = height[i][j], kind = n % 4
      reserved.add(key(i, j))
      const m = n++
      if (kind === 0 || kind === 2) { at(i + 0.4, j + 0.45, i + j + 0.85, (p) => umbrella(p, i + 0.4, j + 0.45, ROOFS[m % ROOFS.length]), z); at(i + 0.62, j + 0.6, i + j + 1.0, (p) => towel(p, i + 0.62, j + 0.6, towels[m % towels.length], m % 2 ? 'x' : 'y'), z) }
      else if (kind === 1) at(i + 0.5, j + 0.5, i + j + 1, (p) => (m === 1 ? lifeguard(p, i + 0.5, j + 0.5) : sandcastle(p, i + 0.5, j + 0.5)), z)
      else { at(i + 0.4, j + 0.4, i + j + 0.8, (p) => surfboard(p, i + 0.4, j + 0.4, ROOFS[(m + 2) % ROOFS.length]), z); at(i + 0.6, j + 0.55, i + j + 1.15, (p) => towel(p, i + 0.6, j + 0.55, towels[(m + 1) % towels.length]), z); at(i + 0.62, j + 0.58, i + j + 1.2, (p) => sitter(p, i + 0.62, j + 0.58, '#ffffff', '#c99a78'), z) }
    }
  }
  // Messages in bottles, washed up round the coast (lib/bottles keeps which
  // ones this browser has found): picked one at a time, each as far as the
  // beaches allow from all the others, so they lie along every stretch of
  // shore; on the wet sand at the water's edge, never at the foot of a pier.
  // Numbered round the coast. The last is out at sea, off the castaway's islet.
  const bottles: Bottle[] = []
  {
    const feet = PIERS.map((pts) => pts[0].map(Math.floor))
    const sea = (i: number, j: number) => [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([u, v]) => !isLand(i + u, j + v))
    const cand = [...beach].map((k) => k.split(',').map(Number) as [number, number])
      .filter(([i, j]) => !reserved.has(key(i, j)) && sea(i, j).length > 0 && !feet.some(([u, v]) => Math.abs(u - i) + Math.abs(v - j) <= 1))
      .sort((p, q) => p[0] - q[0] || p[1] - q[1])
    const picked: [number, number][] = []
    // The first is the beach nearest the front; then each the farthest from those already picked.
    if (cand.length) picked.push(cand.reduce((m, c) => (c[0] + c[1] > m[0] + m[1] ? c : m)))
    while (picked.length < BOTTLE_COUNT - 1 && picked.length < cand.length) {
      let best = cand[0], bd = -1
      for (const c of cand) { if (picked.includes(c)) continue; const d = Math.min(...picked.map((p) => Math.hypot(p[0] - c[0], p[1] - c[1]))); if (d > bd) { bd = d; best = c } }
      picked.push(best)
    }
    const round = ([i, j]: [number, number]) => Math.atan2(j - 14.5, i - 14.5)
    picked.sort((p, q) => round(p) - round(q)).forEach(([i, j], k) => {
      const w = sea(i, j), u = w.reduce((t, [a]) => t + a, 0) / w.length, v = w.reduce((t, [, b]) => t + b, 0) / w.length
      const x = i + 0.5 + u * 0.24, y = j + 0.5 + v * 0.24, n = k + 1
      reserved.add(key(i, j))
      bottles.push({ n, i: f2(x), j: f2(y), district: dist[i][j].key })
      at(x, y, i + j + 0.95, (p) => { beachBottle(p, x, y, n, glassOf(n), (i * 7 + j * 3) % 2 === 1) })
    })
    bottles.push({ n: BOTTLE_COUNT, i: -3, j: 27.4, district: 'market' })
  }
  // Piers out from the beaches, each with someone fishing off the end.
  for (const [n, pts] of PIERS.entries()) things.push({ depth: pts[0][0] + pts[0][1] + 0.4, draw: (layer) => pier(new Pen(layer, 0, 0, 0, new Bounds(), [], sinkFor(`pier-${n}`).sink), pts, BEACH + 1, n === 2 ? null : C.rasp) })

  /* ---- what the page brings to life: pigeons, a noticeboard, a ball, the parade ---- */
  // The pigeons' square and the noticeboard beside it: two free tiles side by
  // side next to a road, as near the town square (the hub) as there are, with
  // no building just in front of either to hide them.
  let square: [number, number] = hub, board: [number, number] = hub
  {
    let best: { a: [number, number]; b: [number, number]; d: number } | null = null
    const ok = (i: number, j: number) => free(i, j) && height[i][j] === 0 && !coast(i, j)
    const byRoad = (i: number, j: number) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([u, v]) => road.has(key(i + u, j + v)))
    for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) for (const [u, v] of [[1, 0], [0, 1]]) {
      const hidden = (a: number, b: number) => [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2], [2, 2]].some(([x, y]) => taken.has(key(a + x, b + y)))
      if (!ok(i, j) || !ok(i + u, j + v) || !byRoad(i + u, j + v) || hidden(i, j) || hidden(i + u, j + v)) continue
      const d = Math.hypot(i - hub[0], j - hub[1])
      if (!best || d < best.d) best = { a: [i, j], b: [i + u, j + v], d }
    }
    if (best) {
      square = best.a; board = best.b
      reserved.add(key(...square)); reserved.add(key(...board))
      at(square[0] + 0.5, square[1] + 0.5, square[0] + square[1] + 0.2, (p) => pigeonSquare(p, square[0] + 0.5, square[1] + 0.5, new Pen(ground)))
      at(board[0] + 0.5, board[1] + 0.5, board[0] + board[1] + 1, (p) => noticeboard(p, board[0] + 0.5, board[1] + 0.45))
    }
  }
  // The ball's beach: the widest open stretch of sand at the front, that the
  // ball can roll about on (and off, into the sea, which brings it back).
  const ball = { at: [0, 0] as [number, number], cells: [] as [number, number][] }
  {
    const sand = (i: number, j: number) => beach.has(key(i, j))
    const reach = (from: [number, number]) => {
      const seen = new Set([key(...from)]), out: [number, number][] = [from], q = [from]
      while (q.length && out.length < 16) { const [i, j] = q.shift()!; for (const [u, v] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = key(i + u, j + v); if (seen.has(k) || !sand(i + u, j + v)) continue; seen.add(k); out.push([i + u, j + v]); q.push([i + u, j + v]) } }
      return out
    }
    let best: { c: [number, number]; n: number } | null = null
    for (const k of beach) {
      const c = k.split(',').map(Number) as [number, number]
      if (reserved.has(k) || c[0] + c[1] < 30) continue
      const open = reach(c).filter(([i, j]) => !reserved.has(key(i, j))).length
      if (open < 4) continue
      const score = c[0] + c[1] + open
      if (!best || score > best.n) best = { c, n: score }
    }
    if (best) { ball.cells = reach(best.c); ball.at = [best.c[0] + 0.5, best.c[1] + 0.5]; reserved.add(key(...best.c)) }
  }
  // The day's parade: for every building, the roads from the town square to
  // the road cell nearest its door.
  const parades: Record<string, [number, number][]> = {}
  {
    const prev = new Map<string, string>([[key(...hub), '']]), q: [number, number][] = [hub]
    while (q.length) { const [i, j] = q.shift()!; for (const [u, v] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = key(i + u, j + v); if (prev.has(k) || !road.has(k)) continue; prev.set(k, key(i, j)); q.push([i + u, j + v]) } }
    const back = (k: string) => { const out: [number, number][] = []; let c: string | undefined = k; while (c) { out.unshift(c.split(',').map(Number) as [number, number]); c = prev.get(c) || undefined } return out }
    // To the road cell nearest the building (most stand on one; the rest, up the
    // peaks or out at sea, as close as the roads go).
    const reached = [...prev.keys()].map((k) => k.split(',').map(Number) as [number, number])
    for (const pl of placed) {
      const cx = pl.i + pl.w / 2, cy = pl.j + pl.d / 2
      let bestK = '', bestD = Infinity
      for (const [a, b] of reached) {
        const d = Math.hypot(a + 0.5 - cx, b + 0.5 - cy) - Math.max(pl.w, pl.d) / 2
        if (d < bestD - 0.01 || (Math.abs(d - bestD) <= 0.01 && back(key(a, b)).length < back(bestK).length)) { bestD = d; bestK = key(a, b) }
      }
      if (bestK) parades[pl.slug] = back(bestK)
    }
  }

  // Trees, rocks and the odd lamp or bench, on the land left over.
  const treeKind = (d: District, coastal: boolean): TreeKind => {
    if (coastal && d.key === 'peaks') return R() < 0.7 ? 'pine' : 'rock'
    if (coastal) return d.key === 'badlands' ? 'rock' : 'palm'
    const r = R()
    if (d.key === 'peaks') return r < 0.8 ? 'pine' : 'rock'
    if (d.key === 'badlands') return r < 0.55 ? 'rock' : r < 0.8 ? 'snag' : 'bush'
    if (d.key === 'oldtown') return r < 0.4 ? 'blossom' : r < 0.75 ? 'round' : 'cypress'
    if (d.key === 'market') return r < 0.5 ? 'cypress' : 'round'
    return r < 0.55 ? 'round' : r < 0.8 ? 'bush' : 'blossom'
  }
  const heroPlots = placed.filter((pl) => heroK(pl.slug) !== 1 && !pl.lm.water).map(drawnPlot)
  const under = (x: number, y: number) => heroPlots.some((h) => x > h.i - 0.12 && x < h.i + h.w + 0.12 && y > h.j - 0.12 && y < h.j + h.d + 0.12)
  const grow = (x: number, y: number, t: Thing) => { if (!under(x, y)) things.push(t) }
  for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) {
    if (!isLand(i, j) || taken.has(key(i, j)) || pond.has(key(i, j)) || reserved.has(key(i, j))) continue
    const d = dist[i][j], z = height[i][j], coastal = coast(i, j)
    // Nothing grows in the river; the odd rock stands beside it.
    if (wet.has(key(i, j))) continue
    if (road.has(key(i, j))) {
      if ((i * 7 + j * 3) % 5 === 0) things.push({ depth: i + j + 0.9, draw: (layer) => lamp(new Pen(layer, 0, 0, z, new Bounds(), lights, sinkFor(`lamp-${i}-${j}`).sink), i + 0.12, j + 0.12, 24) })
      continue
    }
    const density = { peaks: 0.55, badlands: 0.3, proving: 0.28, harbour: 0.16, funfair: 0.24, market: 0.2, oldtown: 0.22 }[d.key]
    const cluster = 0.5 + 0.5 * Math.sin(i * 0.9 + 1.3) * Math.cos(j * 0.8 - 0.4)
    if (R() > density * (0.5 + cluster)) {
      if (R() < 0.04 && !coastal && z === 0) grow(i + 0.5, j + 0.5, { depth: i + j + 1, draw: (layer) => flowers(new Pen(layer, 0, 0, 0, new Bounds(), [], sinkFor(`flowers-${i}-${j}`).sink), i + 0.5, j + 0.5) })
      else if (R() < 0.03 && !coastal && z === 0) grow(i + 0.5, j + 0.5, { depth: i + j + 1, draw: (layer) => person(new Pen(layer), i + 0.5, j + 0.5, shirts[(i + j) % shirts.length], { pose: R() < 0.3 ? 'wave' : hz(i, j, 71) < 0.3 ? 'phone' : 'stand', dog: hz(i, j, 72) < 0.35 }) })
      continue
    }
    // The Badlands grow cacti as often as anything.
    if (d.key === 'badlands' && !coastal && R() < 0.45) {
      const x = i + 0.3 + R() * 0.4, y = j + 0.3 + R() * 0.4, big = R() < 0.6, flower = R() < 0.3, k = 0.85 + R() * 0.3
      grow(x, y, { depth: x + y, draw: (layer) => (big ? cactus(new Pen(layer, 0, 0, z), x, y, k, flower) : barrelCactus(new Pen(layer, 0, 0, z), x, y, k)) })
      continue
    }
    const kind = treeKind(d, coastal)
    const snowy = d.key === 'peaks' && (z >= 48 || (z === 36 && field(i, j) > 0.62))
    const n = kind === 'pine' && R() < 0.6 ? 2 : 1
    for (let k = 0; k < n; k++) {
      const x = i + 0.3 + R() * 0.4, y = j + 0.3 + R() * 0.4
      const c = kind === 'blossom' ? C.leaf : R() < 0.22 ? C.bloom : R() < 0.5 ? C.leaf : C.leafB
      const sz = 0.85 + R() * 0.35
      grow(x, y, { depth: x + y, draw: (layer) => (snowy && kind === 'pine' ? snowPine(new Pen(layer, 0, 0, z), x, y, c === C.bloom ? C.leaf : c, sz) : tree(new Pen(layer, 0, 0, z), x, y, kind, c, sz)) })
    }
  }
  // Cause and effect, part one: the ferry's passengers. One steps off when
  // it ties up and walks the jetty ashore; another hurries out to catch it.
  {
    const z = BEACH + 3
    const end = P(21.5, 29.85, z), land = P(21.5, 27.4, z), shore = P(20.7, 26.5, BEACH)
    const tr = (q: [number, number]) => `transform:translate(${r1(q[0])}px,${r1(q[1])}px)`
    motionCss.push(`@keyframes isl-off{0%,33%{${tr(end)};opacity:0}34%{opacity:1}52%{${tr(land)}}58%{${tr(shore)};opacity:1}60%,100%{${tr(shore)};opacity:0}}`)
    motionCss.push(`@keyframes isl-on{0%,40%{${tr(shore)};opacity:0}41%{opacity:1}46%{${tr(land)}}59%{${tr(end)};opacity:1}61%,100%{${tr(end)};opacity:0}}`)
    const ways: Record<string, MotionFrame[]> = { 'isl-off': stopsOf([[0, end], [34, end], [52, land], [58, shore], [100, shore]]), 'isl-on': stopsOf([[0, shore], [41, shore], [46, land], [59, end], [100, end]]) }
    for (const [name, shirt] of [['isl-off', C.rasp], ['isl-on', C.mint]] as const) things.push({ depth: 21.5 + 30.5, draw: (layer) => { const g = layer.add(new N('g', { class: 'mover amb', 'data-b': `${f(shore[0] - 30)} ${f(land[1] - 30)} ${f(end[0] + 12)} ${f(end[1] + 8)}`, style: `animation:${name} ${FERRY_DUR}s linear infinite` })); g.add(walker(who(shirt, name === 'isl-on' ? 31 : 47), name, ways[name], `${FERRY_DUR}s`, '0s') ?? walkerFigure(shirt, 1, shirt === C.rasp ? 201 : 202)) } })
  }
  // Cause and effect, part two: people walking up to a building's door and
  // going in, and a while later coming out again and walking off.
  {
    let made = 0
    for (const pl of placed) {
      if (pl.lm.water || made >= 10) continue
      // A road cell against a side we can see, and two more along the road from it.
      let door: [number, number] | null = null, r0: [number, number] | null = null
      for (let b = pl.j; b < pl.j + pl.d && !door; b++) if (road.has(key(pl.i + pl.w, b))) { door = [pl.i + pl.w - 0.04, b + 0.5]; r0 = [pl.i + pl.w, b] }
      for (let a = pl.i; a < pl.i + pl.w && !door; a++) if (road.has(key(a, pl.j + pl.d))) { door = [a + 0.5, pl.j + pl.d - 0.04]; r0 = [a, pl.j + pl.d] }
      if (!door || !r0) continue
      const path: [number, number][] = [r0]
      for (let k = 0; k < 2; k++) { const [ci, cj] = path[path.length - 1]; const nx = [[1, 0], [0, 1], [-1, 0], [0, -1]].map(([di, dj]) => [ci + di, cj + dj] as [number, number]).find(([ni, nj]) => road.has(key(ni, nj)) && !path.some(([pi, pj]) => pi === ni && pj === nj)); if (!nx) break; path.push(nx) }
      if (path.length < 3) continue
      const pts = [...path].reverse().map(([i, j]) => P(i + 0.5, j + 0.5, 0)).concat([P(door[0], door[1], pl.z)])
      const segs = pts.slice(1).map((q, k) => Math.hypot(q[0] - pts[k][0], q[1] - pts[k][1])), total = segs.reduce((x, y) => x + y, 0)
      const name = `isl-visit${made}`, tr = (q: [number, number]) => `transform:translate(${r1(q[0])}px,${r1(q[1])}px)`
      let run = 0, fr = `0%{${tr(pts[0])};opacity:0}4%{opacity:1}`
      pts.forEach((q, k) => { if (k) { run += segs[k - 1]; fr += `${f(4 + (36 * run) / total)}%{${tr(q)}}` } })
      fr += `40.5%{opacity:1}41.5%,66%{opacity:0}67%{opacity:1}`
      run = 0
      ;[...pts].reverse().forEach((q, k, rv) => { if (k) { run += Math.hypot(q[0] - rv[k - 1][0], q[1] - rv[k - 1][1]); fr += `${f(67 + (29 * run) / total)}%{${tr(q)}}` } })
      fr += `97%{opacity:1}100%{${tr(pts[0])};opacity:0}`
      motionCss.push(`@keyframes ${name}{${fr}}`)
      const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]), m = made++
      const dur = f(total / 9 + 14)
      // The same walk as times and points, for which way they face: up the road to the door, a while inside, and back.
      const st: [number, [number, number]][] = [[0, pts[0]], [4, pts[0]]]
      let acc = 0
      pts.forEach((q, k) => { if (k) { acc += segs[k - 1]; st.push([4 + (36 * acc) / total, q]) } })
      st.push([66, pts[pts.length - 1]])
      acc = 0
      ;[...pts].reverse().forEach((q, k, rv) => { if (k) { acc += Math.hypot(q[0] - rv[k - 1][0], q[1] - rv[k - 1][1]); st.push([67 + (29 * acc) / total, q]) } })
      st.push([100, pts[0]])
      things.push({ depth: pl.i + pl.j + (pl.w + pl.d) / 2 + 0.02, draw: (layer) => { const g = layer.add(new N('g', { class: 'mover amb visitor', 'data-b': `${f(Math.min(...xs) - 30)} ${f(Math.min(...ys) - 34)} ${f(Math.max(...xs) + 12)} ${f(Math.max(...ys) + 8)}`, style: `animation:${name} ${dur}s linear infinite ${f(-m * 3.7)}s` })); g.add(walker(crowd[(m + 3) % crowd.length], name, stopsOf(st), `${dur}s`, `${f(-m * 3.7)}s`) ?? walkerFigure(shirts[(m + 3) % shirts.length], 1, 300 + m)) } })
    }
  }

  things.sort((a, b) => a.depth - b.depth)
  // Every building gets a layer of its own; whatever stands between two
  // buildings shares one still layer.
  let bundle: N | null = null
  for (const t of things) {
    if (t.slug) { t.draw(open('landmark', t.slug)); bundle = null }
    else { bundle ??= open('things'); t.draw(bundle) }
  }

  const [vx0] = P(0, GRID), [vx1] = P(GRID, 0), [, vy0] = P(0, 0, 220), [, vy1] = P(GRID, GRID, SEA)
  const viewBox: [number, number, number, number] = [f(vx0 - 120), f(vy0 - 60), f(vx1 - vx0 + 240), f(vy1 - vy0 + 180)]
  // Open water at a point on the sea: no land within 1.3 tiles, and no building's picture standing over it.
  const seaOpen = (x: number, y: number) => {
    const u = ((y + SEA) / (S / 4) + x / (S / 2)) / 2, v = ((y + SEA) / (S / 4) - x / (S / 2)) / 2
    return !nearLand(u, v, 1.3) && !Object.values(anchors).some((a) => x > a.x0 - 14 && x < a.x1 + 14 && y > a.y0 - 14 && y < a.y1 + 14)
  }
  // What the moon's light must not fall on, beyond land and buildings: the loops the balloons fly (they
  // would pass under it at night on the realistic island, whose night is drawn over the sky), and whatever
  // stays put on the water, the moored fishing boats and the rocks with their gulls.
  const flown = BALLOONS.map(([i, j, z]) => { const [x, y] = P(i, j, z); return [x - 124, y - 132, x + 124, y + 62] })
  const underBalloon = (x: number, y: number) => flown.some((b) => x > b[0] && x < b[2] && y > b[1] && y < b[3])
  const moored = [...FISHING.map(([i, j]) => [...P(i, j, SEA), 70, 60]), ...seaRocks.map(([i, j, k]) => [...P(i, j, SEA), 30 * k + 14, 30 * k + 20])]
  const onMoored = (x: number, y: number) => moored.some(([mx, my, rx, ry]) => Math.abs(x - mx) < rx && y > my - ry && y < my + 12)
  // Where the moon hangs (the night layer). It must be seen whole in a desktop's opening view, and is
  // better still if a phone's opening shows it too: framed as camera.ts frames them (the view box's middle,
  // a little low; fitted, then 1.5x closer on a desktop and 2.1x on a phone, in boxes about 1440x842 and
  // 390x660), clear of the buttons, the title and the switches over the map. It hangs over open water,
  // outside the loops the balloons fly (they would pass under it at night on the realistic island, whose
  // night is drawn over the sky), with as long a run of open sea below it as there is, for its path.
  const moonAt = (() => {
    const [bx, by, bw, bh] = viewBox, cx = bx + bw / 2, cy = by + bh * 0.54
    const view = (W: number, H: number, k: number, ui: [number, number, number, number][]) => {
      const z = Math.min(W / (bw * 0.86), H / (bh * 0.8)) * k
      const sx = (x: number) => W / 2 + (x - cx) * z, sy = (y: number) => H / 2 + (y - cy) * z
      // The disc and its glow (r 40) whole on the screen, 10px in from the edges, and off every control.
      return (x: number, y: number) => {
        const r = 40 * z, x0 = sx(x) - r, x1 = sx(x) + r, y0 = sy(y) - r, y1 = sy(y) + r
        return x0 > 10 && y0 > 10 && x1 < W - 10 && y1 < H - 10 && !ui.some((u) => x1 > u[0] - 8 && x0 < u[2] + 8 && y1 > u[1] - 8 && y0 < u[3] + 8)
      }
    }
    const desk = view(1440, 842, 1.5, [[32, 16, 236, 72], [928, 18, 1396, 70], [552, 84, 872, 188], [32, 826, 320, 842], [1344, 650, 1396, 842]])
    const phone = view(390, 660, 2.1, [[10, 16, 380, 72], [60, 82, 330, 152], [330, 440, 380, 660], [10, 600, 380, 660]])
    const deskFoot = cy + 842 / 2 / (Math.min(1440 / (bw * 0.86), 842 / (bh * 0.8)) * 1.5)
    // The disc keeps off the boats and rocks too; its path may run on between them (see the glints).
    const clear = (x: number, y: number) => seaOpen(x, y) && !underBalloon(x, y)
    const clearDisc = (x: number, y: number) => clear(x, y) && !onMoored(x, y)
    const spots: { x: number; y: number; run: number; both: boolean }[] = []
    for (let x = bx; x <= bx + bw; x += 8) for (let y = by; y <= by + bh; y += 6) {
      if (!desk(x, y)) continue
      let ok = true
      for (let dx = -34; dx <= 34 && ok; dx += 8) for (let dy = -34; dy <= 34 && ok; dy += 8) if (!clearDisc(x + dx, y + dy)) ok = false
      if (!ok) continue
      let run = 0
      // (Only as far as the desktop's view reaches: water below the frame is never seen.)
      for (let yy = y + 40; yy < Math.min(y + 300, deskFoot) && clear(x, yy); yy += 6) run = yy - (y + 40)
      spots.push({ x, y, run, both: phone(x, y) })
    }
    // The longest run, counting a phone seeing it too as worth 40; between near-equals, the highest.
    const score = (s: { run: number; both: boolean }) => s.run + (s.both ? 40 : 0)
    const most = Math.max(0, ...spots.map(score))
    const best = spots.filter((s) => score(s) >= most - 6).sort((p, q) => p.y - q.y)[0] ?? { x: bx + bw * 0.72, y: by + 290, run: 0 }
    return { x: best.x, y: best.y, run: best.run }
  })()

  let hiddenLights = 0
  /* ---- night ------------------------------------------------------------- */
  // Which lights can be seen: everything that stands up is drawn once more,
  // with each light's pane or bulb painted a colour of its own, and the
  // pixels of each colour counted. Then the same again with every light also
  // drawn on top of everything, which is how much of it there would be with
  // nothing in front. A light that keeps less than a fifth of itself glows
  // no more. (Things that move, such as clouds, are not in these pictures;
  // they pass over a glow, which is how light behaves anyway.)
  /** Whether a light is on tonight: every lamp and bulb, and about four windows in five. */
  function litTonight(l: Light, n: number) { return l.glow !== '#ffe6a1' || hz(n, 3, 9) > 0.2 }
  function occlusion(raster: Raster): boolean[] {
    const code = (n: number) => [(n + 1) & 255, (((n + 1) >> 8) & 15) * 16 + 3, 251]
    const hex = (c: number[]) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('')
    const body = made.filter((m) => m.kind === 'landmark' || m.kind === 'things').map((m) => render(m.node)).join('')
      .replace(/<(\w+)([^>]*?) data-l="(\d+)"/g, (_, tag: string, attrs: string, n: string) => `<${tag}${attrs.replace(/ (fill|opacity|class)="[^"]*"/g, '')} fill="${hex(code(Number(n)))}" data-l="${n}"`)
    const onTop = (body.match(/<(?:polygon|circle|rect|path)[^>]*data-l="\d+"[^>]*\/>/g) ?? []).map((m) => { const tf = lights[Number(m.match(/data-l="(\d+)"/)![1])]?.tf; return tf ? `<g transform="${tf}">${m}</g>` : m }).join('')
    const [vx, vy, vw, vh] = viewBox, W = 3200, k = W / vw
    const doc = (inner: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${vw} ${vh}" width="${W}" height="${Math.round(vh * k)}">${inner}</svg>`
    const tally = (inner: string) => {
      const px = raster(doc(inner), W).pixels, count = new Uint32Array(lights.length)
      for (let o = 0; o < px.length; o += 4) {
        if (px[o + 2] < 249 || px[o + 3] < 250 || (px[o + 1] & 15) !== 3) continue
        const n = ((px[o + 1] >> 4) << 8) + px[o] - 1
        if (n >= 0 && n < lights.length) count[n]++
      }
      return count
    }
    const shown = tally(body), whole = tally(body + onTop)
    return lights.map((_, n) => whole[n] === 0 || shown[n] >= whole[n] * 0.2)
  }

  // Hidden by day. At dusk and at night the page lays a deep blue veil over
  // the whole map, and then, on top of that, the light:
  // every lit window and lamp drawn again in its own glow with a halo, and
  // everything that shines by itself (neon, screens, bulbs) drawn again
  // as it is by day, so it stays bright. And the sky: a moon and its path on
  // the sea, stars, the lighthouse's beam going round, fireflies.
  const night = open('night')
  // Hidden in the markup itself, so a still render (or a page whose styles
  // have not loaded) shows day; the engine shows it when the time asks.
  night.attrs.visibility = 'hidden'
  // The realistic island (Unity's night light to lay over it): the day multiplied down to moonlight and
  // some of its colour taken out, rather than a blue laid over it (moves.ts, LAYERS.night.real).
  const glowRef = opts.plate ? opts.glow ?? null : null
  const veilBox = { x: sx0 - 400, y: sy1 - 1400, width: sx1 - sx0 + 800, height: sy2 - sy1 + 2000 }
  // The line the night's light falls along (engine.ts tagFill, when a time's veil colour is a pair): from the
  // moon across the island to its far side, so the land nearest the moon is the most lit.
  const [icx, icy] = P(GRID / 2, GRID / 2)
  const light = [moonAt.x, moonAt.y, 2 * icx - moonAt.x, 2 * icy - moonAt.y].map((v) => f(v)).join(' ')
  if (glowRef) {
    night.add(new N('rect', { class: 'night-veil', 'data-blend': 'multiply', 'data-light': light, ...veilBox, fill: '#3c4a82', style: 'mix-blend-mode:multiply' }))
    night.add(new N('rect', { class: 'night-veil', 'data-blend': 'saturation', 'data-light': light, ...veilBox, fill: '#808080', opacity: 0.5, style: 'mix-blend-mode:saturation' }))
    // The light of the lamps and the lit windows: on the ground round them, on the walls and the trees,
    // in the rooms, given back by the sea (Unity: Night.cs). Painted by the bake from its full-size render.
    const [x0, y0, x1, y1] = glowRef.box
    night.add(new N('g', { class: 'night-glow' })).add(new N('image', { 'data-plate': glowRef.id, href: glowRef.href, x: x0, y: y0, width: x1 - x0, height: y1 - y0, preserveAspectRatio: 'none' }))
  }
  else {
    // The drawn island's night is graded, not covered: its colours multiplied down to moonlight (so the
    // outlines stay dark and the whites go blue rather than grey), and a little of their colour taken out
    // (moves.ts, LAYERS.night.toon). A flat blue laid over everything took the contrast out with the light.
    night.add(new N('rect', { class: 'night-grade', 'data-blend': 'multiply', 'data-light': light, ...veilBox, fill: '#6272b4', style: 'mix-blend-mode:multiply' }))
    night.add(new N('rect', { class: 'night-grade', 'data-blend': 'saturation', 'data-light': light, ...veilBox, fill: '#808080', opacity: 0.25, style: 'mix-blend-mode:saturation' }))
  }
  {
    const nd = night.add(new N('defs'))
    const glow = nd.add(new N('radialGradient', { id: 'isl-glow' }))
    glow.add(new N('stop', { offset: 0, 'stop-color': '#fff4cf', 'stop-opacity': 0.95 }))
    glow.add(new N('stop', { offset: 0.35, 'stop-color': '#ffe7a8', 'stop-opacity': 0.45 }))
    glow.add(new N('stop', { offset: 1, 'stop-color': '#ffe7a8', 'stop-opacity': 0 }))
    let cores = ''
    const halos = night.add(new N('g', { class: 'night-halos' }))
    const seen = opts.raster ? occlusion(opts.raster) : lights.map(() => true)
    hiddenLights = seen.filter((v) => !v).length
    // A town at night is not every window lit: about one in five stays dark.
    const lit = lights.map((l, n) => seen[n] && litTonight(l, n))
    const panes = night.add(new N('g', { class: 'night-panes' }))
    lights.forEach((l, n) => {
      if (!lit[n]) return
      // With Unity's night light, the windows and the street lamps are in it, glowing as they really do;
      // what is left (bulbs on strings, the hall's display) keeps a softer glow of its own.
      // (The lighthouse's lantern too: Unity's glow has it, a bright core in its glass.)
      if (glowRef && (l.face || l.el?.attrs.class === 'lamp-bulb' || l.el?.attrs.class === 'stp-lamp')) return
      const [x, y] = l
      // On the drawn island the glow is wide enough to fall on the ground round a lamp, not just ring it.
      halos.add(new N('circle', { cx: f(x), cy: f(y), r: glowRef ? 7 : 19, fill: 'url(#isl-glow)', opacity: glowRef ? 0.55 : undefined }))
      if (!glowRef) cores += `M${f(x - 1.2)} ${f(y)}a1.2 1.2 0 1 0 2.4 0a1.2 1.2 0 1 0 -2.4 0`
      // The pane or bulb itself, in its glow colour, above the veil.
      if (l.el && l.glow) {
        const a: Record<string, string | number | undefined> = {}
        for (const k of ['points', 'd', 'cx', 'cy', 'r', 'x', 'y', 'width', 'height', 'rx', 'transform'] as const) { const v = l.el.attrs[k]; if (v !== undefined && v !== null && v !== '') a[k] = v as string | number }
        const pane = new N(l.el.tag, { ...a, fill: l.glow, opacity: 0.92 })
        if (l.tf) panes.add(new N('g', { transform: l.tf })).add(pane)
        else panes.add(pane)
      }
    })
    if (cores) night.add(new N('path', { d: cores, fill: '#fff8de', opacity: 0.8, class: 'night-cores' }))
    // Everything that shines by itself, as bright as by day.
    const shine = night.add(new N('g', { class: 'night-shine' }))
    for (const g of glows) shine.add(g)
    // The lighthouse's beam, going round: a long soft wedge turning about the
    // lamp, squashed flat so it sweeps across the sea and the land. It is a
    // layer of its own, and the page turns the whole layer, which costs
    // nothing; turning a shape this big inside a layer would repaint half
    // the map every frame.
    if (beacon[0] || beacon[1]) {
      const beam = open('beam')
      const bd = beam.add(new N('defs')).add(new N('linearGradient', { id: 'isl-beam' }))
      const sweep = beam.add(new N('g', { transform: `translate(${f(beacon[0])} ${f(beacon[1])})` }))
      if (glowRef) {
        // A shaft of light in the night air: brightest down its middle, fading to nothing at its sides
        // (wedges inside wedges, each faint) and along its length as the air takes it; a clean cool white.
        for (const [o, op] of [[0, 0.5], [0.25, 0.26], [0.6, 0.08], [1, 0]]) bd.add(new N('stop', { offset: o, 'stop-color': '#eef3ff', 'stop-opacity': op }))
        for (const rot of [0, 180]) for (const w of [1, 0.72, 0.48, 0.3, 0.16]) sweep.add(new N('path', { d: `M0 ${f(-2.5 * w)}L700 ${f(-58 * w)}L700 ${f(58 * w)}L0 ${f(2.5 * w)}Z`, fill: 'url(#isl-beam)', opacity: 0.3, transform: rot ? 'rotate(180)' : undefined }))
      } else {
        for (const [o, op] of [[0, 0.75], [0.5, 0.22], [1, 0]]) bd.add(new N('stop', { offset: o, 'stop-color': '#fff8e0', 'stop-opacity': op }))
        for (const rot of [0, 180]) sweep.add(new N('path', { d: 'M0 -4L640 -60L640 60L0 4Z', fill: 'url(#isl-beam)', transform: rot ? 'rotate(180)' : undefined }))
      }
      motionCss.push(`.isl-layer--beam{transform-origin:${f(beacon[0] - viewBox[0])}px ${f(beacon[1] - viewBox[1])}px}`)
      // The lantern's own light, on the realistic island too: Unity's night light was meant to light it, but
      // its core never reaches the glass, so the island's brightest light stood dark there all night.
      night.add(new N('circle', { cx: f(beacon[0]), cy: f(beacon[1]), r: glowRef ? 14 : 18, fill: 'url(#isl-glow)', class: 'night-shine' }))
    }
    // The moon, low over the sea to the north-east, and its path on the water. Its place is picked here,
    // over open water inside a desktop's opening view and clear of the buttons along its top, where the
    // longest run of open sea lies below it; and its path is drawn only on that open sea. (From a fixed
    // spot the path once ran across the Badlands' sand, the Deep Time roof and today's balloon.)
    {
      const [vx, vy, vw] = viewBox
      const { x: mx, y: my, run } = moonAt
      const sky = night.add(new N('g', { class: 'night-sky' }))
      const art = glowRef ? opts.sky ?? null : null
      if (art) {
        // The realistic moon: its light in the air round it, the moon itself (make-night-sky.mjs), and under it
        // its path on the sea in glints on the ripples, two sets, one fading in and out over the other: shimmer.
        const mg = nd.add(new N('radialGradient', { id: 'isl-moonglow' }))
        for (const [o, col, op] of [[0, '#e6edff', 0.34], [0.28, '#cfdbff', 0.14], [0.6, '#b8c8f0', 0.04], [1, '#b8c8f0', 0]] as [number, string, number][]) mg.add(new N('stop', { offset: o, 'stop-color': col, 'stop-opacity': op }))
        sky.add(new N('circle', { cx: f(mx), cy: f(my), r: 120, fill: 'url(#isl-moonglow)' }))
        sky.add(new N('image', { href: art.moon, x: f(mx - 30), y: f(my - 30), width: 60, height: 60 }))
        // The glints, cut (not squashed) to the open water below the moon: the top middle of each picture.
        const gw = 150, gh = Math.max(30, run + 18)
        for (const [href, cls, op] of [[art.glintsB, undefined, 0.75], [art.glintsA, 'moon-path', 0.85]] as [string, string | undefined, number][]) {
          sky.add(new N('image', { href, x: f(mx - gw / 2), y: f(my + 40), width: gw, height: f(gh), preserveAspectRatio: 'xMidYMin slice', class: cls, opacity: op }))
        }
      } else {
      sky.add(new N('circle', { cx: f(mx), cy: f(my), r: 70, fill: 'url(#isl-glow)', opacity: 0.6 }))
      sky.add(new N('circle', { cx: f(mx), cy: f(my), r: 30, fill: '#f6f4ff', stroke: INK, 'stroke-width': OUT }))
      sky.add(new N('path', { d: `M${f(mx + 6)} ${f(my - 29)}a30 30 0 0 1 0 58a24 30 0 0 0 0 -58z`, fill: '#d9dcf5' }))
      for (const [dx, dy, r] of [[-10, -8, 5], [4, 10, 3.5], [-4, 16, 2.4], [10, -14, 2.6]]) sky.add(new N('circle', { cx: f(mx + dx), cy: f(my + dy), r, fill: '#e2e4f6' }))
      // Its path: broken glints, row by row down the open water, in two sets, one fading in and out over
      // the other so they glitter; each glint only where the water under both its ends is open.
      const glints = ['', '']
      for (let k = 0, y = my + 40; y <= my + 40 + run; k++, y += 7) {
        const spread = 8 + (y - my) * 0.16
        for (let s = 0; s < 3; s++) {
          const w = 2 + hz(k, s, 41) * 7, x = mx + (hz(k, s, 42) - 0.5) * spread * 2
          if (!seaOpen(x - w, y) || !seaOpen(x + w, y) || onMoored(x - w, y) || onMoored(x + w, y)) continue
          glints[(k + s) % 2] += `M${f(x - w)} ${f(y)}h${f(w * 2)}`
        }
      }
      sky.add(new N('path', { d: glints[0], stroke: '#f6f4ff', 'stroke-width': 1.6, 'stroke-linecap': 'round', opacity: 0.75 }))
      sky.add(new N('path', { d: glints[1], stroke: '#f6f4ff', 'stroke-width': 1.6, 'stroke-linecap': 'round', class: 'moon-path', opacity: 0.85 }))
      }
      // Stars across the dark water, like the sky reflected in it.
      let st = '', st2 = ''
      for (let k = 0; k < 90; k++) {
        const x = vx + hz(k, 1, 31) * vw, y = vy + hz(k, 2, 32) * (viewBox[3] * 0.98)
        const u = (x / 32 + y / 16) / 2, v = (y / 16 - x / 32) / 2
        if (nearLand(u, v, 1.5)) continue
        // (On the realistic sea, the stars in it are pinpricks, and a few of them twinkle.)
        const r = art ? 0.45 + hz(k, 3, 33) * 0.7 : 1 + hz(k, 3, 33) * 1.6
        if (art) { if (k % 4) st += `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(r * 2)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-r * 2)} 0`; else st2 += `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(r * 2)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-r * 2)} 0`; continue }
        if (k % 3) st += `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(r * 2)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-r * 2)} 0`
        else st2 += `M${f(x)} ${f(y - r * 2.6)}l${f(r * 0.5)} ${f(r * 2.1)}l${f(r * 2.1)} ${f(r * 0.5)}l${f(-r * 2.1)} ${f(r * 0.5)}l${f(-r * 0.5)} ${f(r * 2.1)}l${f(-r * 0.5)} ${f(-r * 2.1)}l${f(-r * 2.1)} ${f(-r * 0.5)}l${f(r * 2.1)} ${f(-r * 0.5)}z`
      }
      sky.add(new N('path', { d: st, fill: '#eef0ff', opacity: art ? 0.6 : 0.85 }))
      sky.add(new N('path', { d: st2, fill: '#ffffff', class: 'star-twinkle' }))
    }
    // New Year: fireworks over the island (shown only on those two nights).
    {
      const fw = night.add(new N('g', { class: 'fireworks' }))
      const at: [number, number, number, string][] = [[8, 20, 330, C.rasp], [15, 13, 380, C.mint], [21, 9, 340, C.sky], [13, 24, 300, C.lilac], [24, 19, 360, '#ffffff'], [6, 9, 400, '#ffd1da']]
      at.forEach(([i, j, z, c], n) => {
        const [x, y] = P(i, j, z)
        const g = fw.add(new N('g', { class: 'fw', style: `animation-delay:${f(n * 0.7)}s` }))
        let d = '', dots = ''
        for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 2, r0 = 10, r1 = 38 + (k % 2) * 8; d += `M${f(x + Math.cos(a) * r0)} ${f(y + Math.sin(a) * r0)}L${f(x + Math.cos(a) * r1)} ${f(y + Math.sin(a) * r1)}`; dots += `M${f(x + Math.cos(a + 0.2) * (r1 + 8))} ${f(y + Math.sin(a + 0.2) * (r1 + 8))}h0.1` }
        g.add(new N('path', { d, stroke: c, 'stroke-width': 2.4, 'stroke-linecap': 'round' }))
        g.add(new N('path', { d: dots, stroke: '#ffffff', 'stroke-width': 3, 'stroke-linecap': 'round' }))
        g.add(new N('circle', { cx: f(x), cy: f(y), r: 7, fill: '#ffffff' }))
      })
    }
    // Fireflies over the meadows.
    let made = 0
    for (let i = 0; i < GRID && made < 10; i++) for (let j = 0; j < GRID && made < 10; j++) {
      if (!isLand(i, j) || taken.has(key(i, j)) || road.has(key(i, j)) || height[i][j] !== 0 || (i * 11 + j * 7) % 7 || !['oldtown', 'funfair', 'harbour', 'market', 'proving'].includes(dist[i][j].key)) continue
      const [x, y] = P(i + 0.5, j + 0.5, 10 + (made % 3) * 6)
      night.add(new N('circle', { cx: f(x), cy: f(y), r: 2.2, fill: '#d9ffb0', class: 'firefly amb', 'data-b': `${f(x - 14)} ${f(y - 14)} ${f(x + 14)} ${f(y + 14)}`, style: `animation-delay:${f(-made * 0.9)}s` }))
      made++
    }
  }

  /* ---- weather ----------------------------------------------------------- */
  // Snow in December, petals in April. Each is a layer of its own holding
  // the same fall twice, one copy above the other; the page slides the whole
  // layer down by one copy's height and round again, which is a transform
  // of one element, so the browser does it without redrawing a thing.
  // (The island's calendar, lib/island/seasons.ts, says which is out when.)
  {
    const [vx, vy, vw, vh] = viewBox
    const circ = (x: number, y: number, r: number) => `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(r * 2)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-r * 2)} 0`
    /** One fall drawn twice, the second copy a whole height away (above for falling, below for rising). */
    const twice = (w: N, attrs: Record<string, string | number>, dy: number) => {
      w.add(new N('path', attrs))
      w.add(new N('path', { ...attrs, transform: `translate(0 ${f(dy)})` }))
    }
    // The monsoon: long, thin, slanting streaks, many of them, fast.
    {
      const w = open('weather', 'rain')
      let d = '', d2 = ''
      for (let k = 0; k < 520; k++) {
        const x = vx + hz(k, 17, 61) * vw, y = vy + hz(k, 19, 62) * vh, len = 30 + hz(k, 5, 63) * 34
        const seg = `M${f(x)} ${f(y)}l${f(-len * 0.18)} ${f(len)}`
        if (k % 3) d += seg; else d2 += seg
      }
      twice(w, { d, fill: 'none', stroke: '#4d6894', 'stroke-width': 1.7, 'stroke-linecap': 'round', opacity: 0.5 }, -vh)
      twice(w, { d: d2, fill: 'none', stroke: '#f2f7ff', 'stroke-width': 2.2, 'stroke-linecap': 'round', opacity: 0.75 }, -vh)
    }
    // Holi: soft clouds of coloured powder, each a bright core in a paler haze.
    {
      const w = open('weather', 'powder')
      const tones = ['#ff6fae', '#b48cff', '#4fe3c1', '#6fb8ff']
      for (const [i, c] of tones.entries()) {
        let haze = '', core = ''
        for (let k = i; k < 84; k += tones.length) {
          const x = vx + hz(k, 31, 81) * vw, y = vy + hz(k, 37, 82) * vh, r = 26 + hz(k, 5, 83) * 30
          haze += circ(x, y, r); core += circ(x + r * 0.15, y - r * 0.1, r * 0.48)
        }
        twice(w, { d: haze, fill: c, opacity: 0.3 }, -vh)
        twice(w, { d: core, fill: c, opacity: 0.55 }, -vh)
      }
    }
    // Diwali: paper sky lanterns, a warm glow round each, going up.
    {
      const w = open('weather', 'lanterns')
      let glow = '', body = '', flame = ''
      for (let k = 0; k < 64; k++) {
        const x = vx + hz(k, 41, 91) * vw, y = vy + hz(k, 43, 92) * vh, s = 0.8 + hz(k, 4, 93) * 0.7
        glow += circ(x, y, 15 * s)
        body += `M${f(x - 5 * s)} ${f(y - 7 * s)}h${f(10 * s)}l${f(-1.6 * s)} ${f(13 * s)}h${f(-6.8 * s)}z`
        flame += circ(x, y + 4.5 * s, 1.7 * s)
      }
      twice(w, { d: glow, fill: '#ffb36b', opacity: 0.34 }, vh)
      twice(w, { d: body, fill: '#ffe2b0', stroke: '#b5532a', 'stroke-width': 0.8, 'stroke-linejoin': 'round' }, vh)
      twice(w, { d: flame, fill: '#fff4d6' }, vh)
    }
    for (const kind of ['snow', 'petals'] as const) {
      const w = open('weather', kind)
      let d = ''
      for (let k = 0; k < (kind === 'snow' ? 170 : 60); k++) {
        const x = vx + hz(k, kind === 'snow' ? 7 : 8, 41) * vw, y0 = vy + hz(k, 9, 42) * vh, r = kind === 'snow' ? 3.2 + hz(k, 4, 43) * 4.4 : 4 + hz(k, 4, 43) * 2.4
        for (const y of [y0]) d += kind === 'snow' ? `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(r * 2)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-r * 2)} 0` : `M${f(x)} ${f(y)}q${f(r)} ${f(-r)} ${f(r * 2)} 0q${f(-r)} ${f(r)} ${f(-r * 2)} 0z`
      }
      // One fall, and the same again a whole height above it (a <use>: it never moves on its own).
      w.add(new N('path', { id: `isl-${kind}`, d, fill: kind === 'snow' ? '#ffffff' : '#ffc9d6', stroke: kind === 'snow' ? '#a9bde6' : INK, 'stroke-width': kind === 'snow' ? 0.8 : 0.5, opacity: kind === 'snow' ? 0.95 : 1 }))
      w.add(new N('use', { href: `#isl-${kind}`, y: f(-vh) }))
    }
  }

  /* ---- labels and sky ---------------------------------------------------- */
  const banners: Record<string, [number, number]> = {}
  const bannerG = open('banners')
  for (const d of DISTRICTS) {
    const [x, y] = P(d.at[0], d.at[1], d.key === 'peaks' ? 150 : 90)
    banners[d.key] = [f(x), f(y)]
    const w = d.name.length * 9.5 + 34
    const g = bannerG.add(new N('g', { class: 'banner' }))
    g.add(new N('path', { d: `M${f(x - w / 2 - 12)} ${f(y - 14)}h14v26h-14l7 -13z M${f(x + w / 2 + 12)} ${f(y - 14)}h-14v26h14l-7 -13z`, fill: shade(d.tint, 0.8), stroke: INK, 'stroke-width': 2 }))
    g.add(new N('rect', { x: x - w / 2, y: y - 19, width: w, height: 29, rx: 8, fill: '#ffffff', stroke: INK, 'stroke-width': 2.4 }))
    g.add(new N('text', { x, y: y + 1, 'text-anchor': 'middle', 'font-family': 'Fredoka, system-ui, sans-serif', 'font-weight': 700, 'font-size': 16, fill: INK }).text(d.name))
  }
  const sky = open('sky')
  ;[[-0.2, 0.1, 1.2], [0.25, 0.45, 1], [0.6, 0.2, 1.3], [0.05, 0.7, 0.9], [0.8, 0.6, 1.1]].forEach(([u, v, k], n) => {
    const [x, y] = P(u * GRID * 1.3, v * GRID, 170)
    const drift = { class: 'cloud', style: `animation-delay:${-n * 23}s;animation-duration:${150 + n * 20}s` }
    // Its shadow on the ground far below (on the realistic island, soft-edged, as a cloud's is), drifting with
    // it in a group of its own, so each is a sprite of its own size.
    const sh = sky.add(new N('g', { ...drift }))
    sh.add(new N('ellipse', { cx: f(x + 14), cy: f(y + 120), rx: f(56 * k * (plate ? 1.25 : 1)), ry: f(17 * k * (plate ? 1.25 : 1)), fill: plate ? puffShade(sh, `cl-shadow${n}`, '#1b2340', 0.16) : INK, opacity: plate ? undefined : 0.06, class: 'cloud-shadow' }))
    const g = sky.add(new N('g', { ...drift }))
    g.add(new N('g', { transform: `translate(${f(x)} ${f(y)})` })).add(cloudModel(n, k) ?? cloudShape(k))
  })
  // Hot-air balloons drifting slowly over, and a little plane towing a banner.
  BALLOONS.forEach(([i, j, z, a, b, d], n) => {
    const [x, y] = P(i, j, z)
    sky.add(pokeN('balloon')).add(hotAirBalloon(x, y, a, b, `hab${n}`, 90 + n * 30, d))
  })
  sky.add(skyPlane('isl-plane'))
  { const [x, y] = P(23.4, 6.4, 170), [, gy] = P(23.4, 6.4, 0); sky.add(pokeN('ufo')).add(ufo(x, y, gy)) }
  { const [x, y] = P(24, 23, 150); sky.add(gullsCircling(x, y, 70, 26, 'gulls0', 14)) }
  { const [x, y] = P(5, 20, 130); sky.add(gullsCircling(x, y, 50, 20, 'gulls1', 11)) }
  for (const [n, d] of [[0, 0], [1, 18]]) {
    const g = sky.add(new N('g', { class: `flock flock${n}`, style: `animation-delay:${-d}s` }))
    // Unity's gulls, flying the flock's way (up and to the right), wings beating out of step.
    const three = [[0, 0], [16, 8], [-14, 10]].map(([dx, dy], m) => {
      const up = creatureUse('gull', '#f4f5f8', 'up', 'ne', { class: 'wing2', style: `animation-delay:${f(-m * 0.13)}s` }), down = creatureUse('gull', '#f4f5f8', 'down', 'ne', { class: 'wing2', style: `animation-delay:${f(-m * 0.13 - 0.21)}s` })
      if (!up || !down) return null
      const b = new N('g', { transform: `translate(${dx} ${dy})` }); b.add(up); b.add(down); return b
    })
    if (three.every(Boolean)) three.forEach((b) => g.add(b!))
    else g.add(birds())
  }

  // What the page draws on its canvas, as Unity's pictures (the parade's marchers and dog, the pigeons): their names, for the bake's sheet of them.
  const parade: Who[] = ['#2c355e', '#3f4a6b', '#ffffff', '#4fe3c1', '#5b82ff', '#b8a1ff'].map((sh, k) => who(sh, 91 + k * 17, { hat: k === 0 ? '#5b82ff' : null }))
  const names = spriteNames(parade)
  const sprites: (Sprites & { id: string }) | null = opts.figures ? { ...names, id: opts.figures.id } : null
  // The figures' pictures, once each, for every <use> of them.
  const figDefs = figureDefs()
  if (figDefs) first.add(figDefs)
  // On the realistic island, whatever is still drawn loses the drawing's ink: an outline becomes the edge its own
  // colour makes in the light (darker, finer), as paint on a board or cloth has. Words, bubbles and banners keep theirs.
  if (opts.plate) {
    const KEEP = new Set(['banners', 'night', 'beam'])
    const deInk = (n: N | string) => {
      if (typeof n === 'string') return
      const a = n.attrs
      if (typeof a.class === 'string' && /\b(pk-say|say|sign-words|lm-ring)\b/.test(a.class)) return
      if (a.stroke === INK && n.tag !== 'text') {
        const fill = typeof a.fill === 'string' && /^#[0-9a-f]{6}$/i.test(a.fill) ? a.fill : null
        const w = Number(a['stroke-width'] ?? OUT)
        // (A shape drawn with no line, as a beam of light is, gets none.)
        if (w === 0) a.stroke = 'none'
        else if (fill) { a.stroke = shade(fill, 0.66); a['stroke-width'] = Math.max(0.35, Math.round(w * 0.5 * 100) / 100) }
        else { a.stroke = '#3a3f4c'; a['stroke-width'] = Math.max(0.4, Math.round(w * 0.6 * 100) / 100); if (a.opacity === undefined) a.opacity = 0.85 }
      }
      for (const k of n.kids) deInk(k)
    }
    for (const m of made) if (!KEEP.has(m.kind)) deInk(m.node)
  }
  // The cartoon island's buildings and things, graded towards paint: the candy-bright colours (a full cobalt, a hot
  // raspberry) lose some of their saturation, and pure white goes to a soft stone, so the ground's natural greens lead
  // and the buildings sit in them. The ground was painted in its own colours already; words and banners keep theirs.
  if (!opts.plate) {
    const graded = new Map<string, string>()
    const grade = (c: unknown) => {
      if (typeof c !== 'string' || !/^#[0-9a-f]{6}$/i.test(c)) return c
      let g = graded.get(c)
      if (!g) { g = paintGrade(c); graded.set(c, g) }
      return g
    }
    const walk = (n: N | string) => {
      if (typeof n === 'string') return
      const a = n.attrs
      if (typeof a.class === 'string' && /\b(pk-say|say|sign-words|lm-ring)\b/.test(a.class)) return
      if (n.tag !== 'text') { a.fill = grade(a.fill) as string; if (a.stroke !== INK) a.stroke = grade(a.stroke) as string }
      if (n.tag === 'stop') a['stop-color'] = grade(a['stop-color']) as string
      for (const k of n.kids) walk(k)
    }
    for (const m of made) if (m.kind === 'landmark' || m.kind === 'things') walk(m.node)
  }
  // The order, in both worlds: the night (its grade, and the lights it does not grade) and the lighthouse's
  // beam; then the sky above them, which the engine grades apart with the night's own veils (engine.ts,
  // gradeSky), so the balloons, clouds and birds are darkened like everything else and yet no lit window
  // shows through them; then the lanterns, which give off light of their own; then the districts' names.
  {
    const of = (want: (m: (typeof made)[number]) => boolean) => made.filter(want)
    const night = of((m) => m.kind === 'night' || m.kind === 'beam'), sky = of((m) => m.kind === 'sky')
    const lanterns = of((m) => m.kind === 'weather' && m.slug === 'lanterns'), names = of((m) => m.kind === 'banners')
    const late = [...night, ...sky, ...lanterns, ...names]
    made.splice(0, made.length, ...made.filter((m) => !late.includes(m)), ...late)
  }
  const layers: Layer[] = made.map((m) => ({ kind: m.kind, slug: m.slug, body: render(m.node) }))
  const css = motionCss.join('')
  // The island's own extent, without the sea round it: the camera keeps this in view.
  const landBox: [number, number, number, number] = [f(P(0, GRID)[0]), f(P(0, 0, 60)[1]), f(P(GRID, 0)[0]), f(P(GRID, GRID)[1])]
  return { land: landBox, hiddenLights, svg: `<style>${css}</style>` + layers.map((l) => l.body).join(''), layers, css, viewBox, moon: moonAt, anchors, lights, banners, mini, bottles, signposts, play: { square, board, ball, routes: parades, sprites, folk: plate ? undefined : PARADE.map(([seed, shirt, k]) => folkPic(seed, shirt, k)) }, grid: Array.from({ length: GRID }, (_, i) => Array.from({ length: GRID }, (_, j) => (isLand(i, j) ? (beach.has(key(i, j)) ? 'b' : '1') : '0')).join('')).join(''), model: {
    grid: GRID, tile: S, sea: SEA, beachZ: BEACH,
    ground: Array.from({ length: GRID }, (_, i) => Array.from({ length: GRID }, (_, j) => (isLand(i, j) ? (beach.has(key(i, j)) ? 'b' : '1') : '0')).join('')).join(''),
    height: height.map((r) => [...r]), district: dist.map((r) => r.map((d) => d.key)),
    river, pond: [...pond].map((k) => k.split(',').map(Number) as [number, number]), road: [...road].map((k) => k.split(',').map(Number) as [number, number]), routes: routes.map((r) => r.map(([i, j]) => [i, j] as [number, number])),
    wash, fields: fields.map((f) => [...f]), mill, bales, arch: archAt, buttes, hoodoos, boulders: boulderAt, piers: PIERS,
    buildings: placed.map((b) => ({ slug: b.slug, district: b.district, i: b.i, j: b.j, w: b.w, d: b.d, z: b.z, water: !!b.lm.water })),
    plants: planted.map((q) => ({ ...q })),
    actors: [...actorsWanted.values()].sort((a, b) => a.name.localeCompare(b.name)),
    seaRocks, shoreRocks, solids,
    prints: [...printsWanted].map(([name, p]) => ({ name, ...p })),
    isles: [...isles, ...placed.filter((pl) => pl.slug === 'deep-sea').map((pl) => [pl.i + 1.35, pl.j + 1.3, 0.85, SEA - 60] as [number, number, number, number])],
    lights: lights.flatMap((l, n) => {
      if (!l.w) return []
      const kind = l.face ? 'win' : l.el?.attrs.class === 'lamp-bulb' ? 'lamp' : 'bulb'
      const r = (v: number) => Math.round(v * 1000) / 1000
      return [{ i: r(l.w[0]), j: r(l.w[1]), z: r(l.w[2]), kind, face: l.face, col: l.glow ?? '#ffffff', lit: litTonight(l, n) }]
    }),
    viewBox,
  } }
}

export { OUT, bench }
