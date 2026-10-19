/**
 * Tiny Island — the camera and everything you do to the map.
 *
 * The island is drawn on one canvas by the engine (lib/island/engine), from
 * pictures baked at build time; the camera says where it looks. Drag it (it
 * keeps a little of your throw), wheel or pinch to zoom round the point under
 * your fingers, double-click to dive in, or use the keyboard: every building
 * is also a link, out of sight, so Tab reaches each one and Enter goes in.
 * Names appear once you are close enough to read them. Hovering a building
 * shows its card; clicking one dives the camera into it and opens the game.
 *
 * Everything eases towards a target by the time that has passed, not by the
 * frame, so it feels the same at 30 frames a second and at 120; and under
 * reduced motion everything simply goes there.
 *
 * The edges give: drag past them and the map follows less and less, throw it
 * and it runs on a little and springs back, and the same for zooming past the
 * nearest or farthest. Held arrow keys glide, faster the longer they are held.
 * Where the camera comes to rest close to a size the island was painted at,
 * it settles on exactly that size, and every pixel of the painting lands on
 * one of the screen's.
 *
 * Until the canvas has what it needs to draw the view, a small picture of the
 * island stands in for it (the poster), moved by the same camera; then the
 * poster fades, and the buildings drop in.
 *
 * Going into a game, the camera dives into its building and a circle of the
 * game's colour opens from it over the page; the game's page then opens the
 * same circle from the same point (Paper.astro). The view is kept for the
 * visit, so coming back finds the island where it was left, the camera
 * stepping back out of the building just played.
 */
import { PLAY } from '../motion'
import { createEngine, type Engine, type IslandState } from './engine'
import { POKE_MS } from './moves'
import { perfMeter } from './perf'
import type { Scene } from './scene'

export type Anchor = { slug: string; district: string; x0: number; y0: number; x1: number; y1: number; bx: number; by: number }
export type GameInfo = { slug: string; title: string; blurb: string; href: string; best?: string | null; tint: string }

type Cam = { x: number; y: number; z: number }

/**
 * How close the island opens, as a share of the zoom that fits it all: close
 * enough that the buildings are the subject and the coast peeks in at the
 * edges, rather than a map of the whole. The Home button and the mini-map
 * are the overview. Closer still on a phone's narrow screen.
 */
const OPEN = (w: number) => (w < 700 ? 3.3 : 2.25)

/** A frame's worth of time at 60 frames a second: the unit the easing was tuned in. */
const FRAME = 1000 / 60

export function initIsland(o: {
  box: HTMLElement
  /** Where pointers land: the map itself, under the buttons. */
  stage: HTMLElement
  canvas: HTMLCanvasElement
  /** The island, small, shown until the canvas can draw: it covers the bounds, at this many pixels a unit. */
  poster: HTMLImageElement | null
  posterScale: number
  /** The baked island, on its way. */
  scene: Promise<Scene>
  /** Where the baked files are, ending in a slash. */
  base: string
  /** The time of day, the season, the hour, as the page has them. */
  state: () => Omit<IslandState, 'near'>
  bounds: [number, number, number, number]
  /** The island itself, without the sea: the camera never lets it all go off screen. */
  land?: [number, number, number, number]
  /** The district names, where their banners stand on the map. */
  districts?: { key: string; name: string; x: number; y: number }[]
  anchors: Record<string, Anchor>
  games: Record<string, GameInfo>
  /** One link per building, for the keyboard and for anything reading the page. */
  links: Map<string, HTMLAnchorElement>
  onEnter?: (slug: string) => void
  /** Back from a game by the browser's back button: the circle opens out of the building again. */
  onBack?: () => void
  /** A building's card came up (hovered, tapped or focused). */
  onCard?: (slug: string) => void
  /** Something that is not a building was poked (and which one of its kind, if they are counted: a bottle). */
  onPoke?: (kind: string, n?: number) => void
  /**
   * A hand going down on the map at (x, y), in map units (z is screen pixels
   * to a unit): something there that can be picked up (the ball) takes the
   * pointer instead of the map, until it lets go.
   */
  grab?: (x: number, y: number, z: number, touch: boolean) => { move(x: number, y: number): void; up(): void } | null
  /** The pointer over the map (hovering, pressing, or a tap on nothing in particular), for what reacts to it. */
  pointer?: (x: number, y: number, z: number, kind: 'hover' | 'down' | 'tap') => void
  /** A click or tap on the map at (x, y) in map units, and what it landed on (for the admin page's heat-map). */
  onTap?: (x: number, y: number, z: number, hit: 'game' | 'poke' | 'none', what: string) => void
  /** Whether something that can be picked up is under (x, y): the cursor says so. */
  grabbable?: (x: number, y: number, z: number) => boolean
}) {
  const { box, stage, canvas, poster, anchors, games, links } = o
  const [bx, by, bw, bh] = o.bounds
  const card = box.querySelector<HTMLElement>('.isl-card')!
  const labels = box.querySelector<HTMLElement>('.isl-labels')!
  const mini = box.querySelector<SVGSVGElement>('.isl-mini svg')
  const miniView = mini?.querySelector<SVGRectElement>('.isl-mini-view') ?? null
  const hint = box.querySelector<HTMLElement>('.isl-hint')

  /* ---- the camera ------------------------------------------------------ */
  // A page opened out of sight (a hidden frame) has no size yet: the window's stands in until it has.
  const sizeW = () => box.clientWidth || innerWidth || 1280, sizeH = () => box.clientHeight || innerHeight || 800
  let W = sizeW(), H = sizeH()
  // Past two device pixels per CSS pixel the island looks no sharper, and the canvas costs more than twice as much to fill.
  // On a phone, past one and a half: held a little way from the eye it is as sharp, and each frame has 44% fewer
  // pixels to fill and smaller pictures to fetch, which is what a phone's frame rate and first visit are short of.
  const PHONE = matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 600
  const ratio = () => Math.min(PHONE ? 1.5 : 2, window.devicePixelRatio || 1)
  const fitZ = () => Math.min(W / (bw * 0.86), H / (bh * 0.8))
  let zMin = fitZ() * 0.85, zMax = Math.max(fitZ() * 7, 3.4)
  const cam: Cam = { x: bx + bw / 2, y: by + bh * 0.56, z: fitZ() }
  /** Where the camera is going. */
  const goal: Cam = { ...cam }
  /** Where hands (a drag, a throw, a wheel, a pinch) have asked it to go, before the edges push back. */
  const raw: Cam = { ...cam }
  let vel = { x: 0, y: 0 }

  /* ---- the edges: where the camera may rest, and how it gives past them ---- */
  const limZ = (z: number) => Math.min(zMax, Math.max(zMin, z))
  /** Where the middle of the view may rest at zoom z: some of the island always in sight. */
  const limX = (x: number, z: number) => {
    const pad = Math.max(0, bw / 2 - (W / z / 2) * 0.4)
    x = Math.min(bx + bw / 2 + pad, Math.max(bx + bw / 2 - pad, x))
    // However hard it is thrown, the middle of the view comes back over the island.
    if (o.land) { const [lx0, , lx1] = o.land, i = (lx1 - lx0) * 0.12; x = Math.min(lx1 - i, Math.max(lx0 + i, x)) }
    return x
  }
  const limY = (y: number, z: number) => {
    const pad = Math.max(0, bh / 2 - (H / z / 2) * 0.4)
    y = Math.min(by + bh / 2 + pad, Math.max(by + bh / 2 - pad, y))
    if (o.land) { const [, ly0, , ly1] = o.land, i = (ly1 - ly0) * 0.12; y = Math.min(ly1 - i, Math.max(ly0 + i, y)) }
    return y
  }
  /**
   * How far past an edge the view goes when asked to go `over` past it: all
   * of a short way, less and less of a long one, never more than `most`. (The
   * curve a phone's own lists give at their ends.)
   */
  const give = (over: number, most: number) => Math.sign(over) * most * (1 - 1 / ((Math.abs(over) * 0.55) / most + 1))
  /** Past a pan edge, in map units at zoom z (the give is measured on the screen). */
  const givePan = (over: number, z: number) => give(over * z, Math.min(W, H) * 0.42) / z
  /** Past the nearest or farthest zoom, as a factor. */
  const giveZoom = (z: number) => { const l = limZ(z); return l === z ? z : l * Math.exp(give(Math.log(z / l), 0.22)) }
  /** Put `to` where `from` asks, inside the edges, or (soft) giving past them. */
  const place = (to: Cam, from: Cam, soft: boolean) => {
    const z = soft ? giveZoom(from.z) : limZ(from.z)
    const lx = limX(from.x, z), ly = limY(from.y, z)
    to.z = z
    to.x = soft ? lx + givePan(from.x - lx, z) : lx
    to.y = soft ? ly + givePan(from.y - ly, z) : ly
  }
  const outside = (c: Cam) => limZ(c.z) !== c.z || limX(c.x, c.z) !== c.x || limY(c.y, c.z) !== c.y
  /** Bring the goal inside the edges (the camera eases back after it), and forget what the hands asked. */
  const clampGoal = () => { place(goal, goal, false); Object.assign(raw, goal); pace = 1 }
  /**
   * How quickly the camera closes on its goal, as a share of the usual: the
   * step back out of a building is taken slowly, and anything the visitor
   * does (which sets a goal) puts it back.
   */
  let pace = 1

  /**
   * The sizes the island was painted at, in device pixels to a unit. A camera
   * at rest within a few percent of one moves onto it, so the painting is
   * copied to the screen pixel for pixel rather than resampled.
   */
  let painted: number[] = []
  const crisp = (z: number) => {
    const s = z * ratio()
    for (const l of painted) if (Math.abs(s / l - 1) < 0.06) return limZ(l / ratio()) === l / ratio() ? l / ratio() : z
    return z
  }

  const toScreen = (x: number, y: number) => [(x - cam.x) * cam.z + W / 2, (y - cam.y) * cam.z + H / 2]
  const toWorld = (sx: number, sy: number) => [(sx - W / 2) / cam.z + cam.x, (sy - H / 2) / cam.z + cam.y]

  /* ---- the engine, once the scene is in, and the one loop that drives it ---- */
  let near = false
  let engine: Engine | null = null
  const waiting: ((e: Engine) => void)[] = []
  /** Do something with the engine now, or as soon as there is one. */
  const withEngine = (fn: (e: Engine) => void) => { if (engine) fn(engine); else waiting.push(fn) }
  o.scene.then((scene) => {
    const e = createEngine({ canvas, base: o.base, scene, play: PLAY, state: () => ({ ...o.state(), near }) })
    e.onLoaded = () => wake()
    e.setHot(hot); e.dim(keep)
    engine = e
    painted = scene.levels
    for (const fn of waiting.splice(0)) fn(e)
    wake()
  }, (err) => console.error('[island] the map could not load', err))
  let keep: Set<string> | null = null
  let raf = 0, lastT = 0, visible = true, paused = false, dragging = false
  function wake() { if (!raf && visible && !paused) raf = requestAnimationFrame(frame) }

  /* ---- held keys: arrows glide, + and − keep zooming ----------------------- */
  /** The keys held down, and since when. */
  const held = new Map<string, number>()
  const ARROWS: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
  /** Screen pixels a second: a held arrow sets off at the first, and is at the second after about a second. */
  const GLIDE = [420, 1500]
  const smooth = (k: number) => k * k * (3 - 2 * k)
  const holdStep = (dt: number) => {
    const now = performance.now()
    let dx = 0, dy = 0, dz = 0
    for (const [key, since] of held) {
      const age = now - since
      if (ARROWS[key]) {
        const v = GLIDE[0] + (GLIDE[1] - GLIDE[0]) * smooth(Math.min(1, age / 1100))
        dx += ARROWS[key][0] * v; dy += ARROWS[key][1] * v
      }
      // A tap of + or − is one step; held, after a moment, it keeps going, twice as close every second or so.
      else if (age > 280) dz += key === 'in' ? 1 : -1
    }
    if (dx || dy) {
      // Two arrows at once go no faster than one.
      const n = Math.hypot(dx, dy) / Math.max(Math.abs(dx), Math.abs(dy))
      goal.x += (dx / n) * (dt / 1000) / goal.z; goal.y += (dy / n) * (dt / 1000) / goal.z
    }
    if (dz) goal.z = limZ(goal.z * Math.exp(dz * 0.75 * (dt / 1000)))
    clampGoal()
  }

  /** One step of the camera towards its goal, over dt milliseconds. Whether it is still on its way. */
  const step = (dt: number) => {
    const f = dt / FRAME
    if (!dragging && (Math.abs(vel.x) > 0.02 || Math.abs(vel.y) > 0.02)) {
      raw.x -= (vel.x * f) / cam.z; raw.y -= (vel.y * f) / cam.z
      const d = Math.pow(0.9, f); vel.x *= d; vel.y *= d
      // Past an edge the throw runs on a little, slowing hard; then the camera springs back.
      if (outside(raw)) { const e = Math.pow(0.62, f); vel.x *= e; vel.y *= e }
      place(goal, raw, true)
      if (Math.abs(vel.x) <= 0.02 && Math.abs(vel.y) <= 0.02) { vel = { x: 0, y: 0 }; settleSoon(0) }
    }
    if (held.size) holdStep(dt)
    // Each sixtieth of a second, a sixth of the way there.
    const k = PLAY ? 1 - Math.pow(0.84, f * pace) : 1
    const dz = goal.z - cam.z, dx = goal.x - cam.x, dy = goal.y - cam.y
    const moving = held.size > 0 || Math.abs(dz) > 0.0005 * cam.z || Math.abs(dx) * cam.z > 0.3 || Math.abs(dy) * cam.z > 0.3 || Math.abs(vel.x) > 0.02 || Math.abs(vel.y) > 0.02
    if (moving) { cam.z += dz * k; cam.x += dx * k; cam.y += dy * k }
    else { Object.assign(cam, goal); pace = 1 }
    return moving
  }

  /**
   * Once the hands let go (the wheel stops turning, the fingers lift, a throw
   * runs out): back inside the edges, and onto the nearest painted size if
   * the zoom is close to one, keeping still the point the hands were at.
   */
  let settleT = 0
  const focus = { x: 0, y: 0 }
  function settleSoon(ms: number) {
    clearTimeout(settleT)
    settleT = window.setTimeout(() => {
      // Not while the hands are still on, nor once a dive has its own goal (the click that let go began one).
      if (dragging || entering) return
      // The point under the hands, where the camera is going.
      const wx = goal.x + (focus.x - W / 2) / goal.z, wy = goal.y + (focus.y - H / 2) / goal.z
      const z = crisp(limZ(goal.z))
      goal.x = wx - (focus.x - W / 2) / z; goal.y = wy - (focus.y - H / 2) / z; goal.z = z
      clampGoal(); wake()
    }, ms)
  }

  const perf = new URLSearchParams(location.search).has('perf') ? perfMeter(box) : null
  /**
   * Left alone, the island's own life (walkers, waves, birds) is drawn thirty
   * times a second, not sixty, and never takes more than about three fifths
   * of the main thread: the rest is the page's, so scrolling and taps answer
   * at once, and a phone stays cool; and while the island is still loading,
   * the downloads land sooner. Anything the hands do, or a flight, is drawn
   * every frame.
   */
  const AMBIENT = 1000 / 30
  let drawnAt = 0, cost = 0
  /** Until when it is drawn every frame anyway: while the buildings drop in, and while a picked one lifts or settles. */
  let livelyUntil = 0, liftFor: string | null = null
  function frame(t: number) {
    raf = 0
    const dt = lastT ? Math.min(64, Math.max(1, t - lastT)) : FRAME
    lastT = t
    const moving = step(dt)
    if (hot !== liftFor) { liftFor = hot; livelyUntil = Math.max(livelyUntil, t + 800) }
    // (Pictures still coming in are no reason: each one wakes a frame as it lands, and behind the poster nothing shows yet.)
    const busy = moving || dragging || hover.dirty || held.size > 0 || stage0 === 'live' || t < livelyUntil
    if (engine && PLAY && !busy && t - drawnAt < Math.max(AMBIENT, cost * 1.6) - 3) { wake(); return }
    drawnAt = t
    const c0 = performance.now()
    if (engine) { engine.setView(cam, W, H, ratio()); engine.frame(t) }
    cost = performance.now() - c0
    perf?.tick(t, engine ? engine.stats() : null)
    after()
    // With motion there is always something moving on the island; without, draw only while something changes.
    if ((engine && (PLAY || !engine.sharp())) || moving || dragging || hover.dirty) wake()
    else lastT = 0
  }

  /* ---- after each frame: the page around the canvas ----------------------- */
  const seen: Cam = { x: NaN, y: NaN, z: NaN }
  let seenHot: string | null = null
  function after() {
    const moved = cam.x !== seen.x || cam.y !== seen.y || cam.z !== seen.z
    if (moved || hot !== seenHot) {
      Object.assign(seen, cam); seenHot = hot
      const n = cam.z / fitZ()
      box.classList.toggle('z-far', n < 1.25)
      const wasNear = near
      near = n > 2.1
      if (near !== wasNear) box.classList.toggle('z-near', near)
      if (miniView) {
        const w = W / cam.z, h = H / cam.z
        miniView.setAttribute('x', (cam.x - w / 2).toFixed(1)); miniView.setAttribute('y', (cam.y - h / 2).toFixed(1))
        miniView.setAttribute('width', w.toFixed(1)); miniView.setAttribute('height', h.toFixed(1))
      }
      placeOverlays()
      placePoster()
    }
    if (hover.dirty) hoverTest()
    if (stage0 === 'poster' && fontsIn && engine?.drawable()) goLive()
  }

  /* ---- the poster, and going live ------------------------------------------ */
  function placePoster() {
    if (!poster || stage0 === 'gone') return
    poster.style.transform = `translate(${(W / 2 - (cam.x - bx) * cam.z).toFixed(2)}px, ${(H / 2 - (cam.y - by) * cam.z).toFixed(2)}px) scale(${(cam.z / o.posterScale).toFixed(5)})`
  }
  let stage0: 'poster' | 'live' | 'gone' = 'poster'
  // The lettering on the map is in the page's own fonts: wait for them, a little.
  let fontsIn = !document.fonts
  if (document.fonts) {
    Promise.all(['600 16px Fredoka', '16px Silkscreen'].map((f) => document.fonts.load(f).catch(() => null))).finally(() => { fontsIn = true; wake() })
    setTimeout(() => { fontsIn = true; wake() }, 2500)
  }
  function goLive() {
    stage0 = 'live'
    box.classList.add('is-live')
    // The buildings drop in (the first time this visit), unless the map is already being used; then the camera settles.
    if (PLAY && !interacted) { if (opening.intro) engine!.intro(); settle() }
    livelyUntil = performance.now() + 4000
    const gone = () => { stage0 = 'gone'; if (poster) poster.hidden = true }
    if (PLAY && poster) setTimeout(gone, 450)
    else gone()
  }

  /* ---- zooming and flying ------------------------------------------------- */
  /** Zoom by f round a point on the screen, keeping what is under it there; settling on a painted size if one is near. */
  const zoomAt = (f: number, sx = W / 2, sy = H / 2) => {
    const [wx, wy] = toWorld(sx, sy)
    const z = crisp(limZ(goal.z * f))
    goal.x = wx - (sx - W / 2) / z; goal.y = wy - (sy - H / 2) / z; goal.z = z
    clampGoal(); wake()
  }
  /** Zoom to z keeping the map point (wx, wy) at (sx, sy), for a wheel or a pinch: past the nearest and farthest it gives, until the hands stop. */
  const zoomSoft = (z: number, sx: number, sy: number, wx: number, wy: number) => {
    pace = 1
    raw.z = Math.min(zMax * 2, Math.max(zMin / 2, z))
    const shown = giveZoom(raw.z)
    raw.x = wx - (sx - W / 2) / shown; raw.y = wy - (sy - H / 2) / shown
    place(goal, raw, true)
  }
  const flyTo = (x: number, y: number, z: number) => { goal.x = x; goal.y = y; goal.z = crisp(limZ(z)); vel = { x: 0, y: 0 }; clampGoal(); wake() }
  /** A view of a building: close enough that it is the subject, far enough that its card fits. */
  const framing = (slug: string, zoom: number): Cam => {
    const a = anchors[slug]
    const fit = Math.min(W / ((a.x1 - a.x0) * 2.8), H / ((a.y1 - a.y0) * 2.6))
    return { x: (a.x0 + a.x1) / 2, y: (a.y0 + a.y1) / 2 + (a.y1 - a.y0) * 0.1, z: Math.min(zMax, Math.max(fitZ() * 1.3, Math.min(fit, fitZ() * zoom))) }
  }
  /** Right up to a building, as the camera is at the end of a dive into it. */
  const inside = (slug: string): Cam => {
    const a = anchors[slug]
    return { x: (a.x0 + a.x1) / 2, y: (a.y0 + a.y1) / 2, z: Math.min(zMax * 1.3, Math.min(W / (a.x1 - a.x0), H / (a.y1 - a.y0)) * 0.9) }
  }
  const flyToSlug = (slug: string, zoom = 2.6) => {
    if (!anchors[slug]) return
    firstTouch()
    const v = framing(slug, zoom)
    flyTo(v.x, v.y, v.z)
  }
  const home = () => { firstTouch(); flyTo(bx + bw / 2, by + bh * 0.56, fitZ()) }

  /* ---- pointers: drag, pinch, wheel, double-click ------------------------ */
  const ptrs = new Map<number, { x: number; y: number }>()
  let moved = 0, last = { x: 0, y: 0, t: 0 }, pinch0 = 0, pinchZ = 1
  /** The point between two fingers, as it was at the last move. */
  let mid = { x: 0, y: 0 }
  let press = { x: 0, y: 0 }
  let interacted = false
  setTimeout(() => hint?.classList.add('is-gone'), 9000)
  function firstTouch() { if (interacted) return; interacted = true; hint?.classList.add('is-gone'); engine?.endIntro() }
  const local = (e: { clientX: number; clientY: number }) => { const r = box.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top } }
  const twoFingers = () => {
    const [a, b] = [...ptrs.values()], r = box.getBoundingClientRect()
    return { d: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2 - r.left, y: (a.y + b.y) / 2 - r.top }
  }
  /** What a hand is holding instead of the map (the ball), and which pointer it is. */
  let holding: { id: number; g: { move(x: number, y: number): void; up(): void } } | null = null
  stage.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return
    if (!ptrs.size && !holding) {
      const p0 = local(e), [wx, wy] = toWorld(p0.x, p0.y)
      const g = o.grab?.(wx, wy, cam.z, e.pointerType !== 'mouse')
      if (g) {
        holding = { id: e.pointerId, g }
        stage.setPointerCapture(e.pointerId)
        // Not a click: nothing under it is picked as well.
        moved = 99
        firstTouch(); hideCard(); box.classList.add('is-grabbing'); wake()
        return
      }
      o.pointer?.(wx, wy, cam.z, 'down')
    }
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY })
    press = local(e)
    stage.setPointerCapture(e.pointerId)
    // A hand on the map catches it where it is, mid-throw or mid-flight.
    if (!dragging) { goal.x = cam.x; goal.y = cam.y; Object.assign(raw, goal) }
    dragging = true; moved = 0; vel = { x: 0, y: 0 }
    clearTimeout(settleT)
    last = { x: e.clientX, y: e.clientY, t: performance.now() }
    if (ptrs.size === 2) { const t = twoFingers(); pinch0 = t.d; pinchZ = raw.z; mid = { x: t.x, y: t.y } }
    box.classList.add('is-grabbing'); stage.style.cursor = ''; firstTouch(); wake()
  })
  stage.addEventListener('pointermove', (e) => {
    if (holding && e.pointerId === holding.id) { const p = local(e), [wx, wy] = toWorld(p.x, p.y); holding.g.move(wx, wy); wake(); return }
    if (!ptrs.has(e.pointerId)) {
      // Just pointing (a mouse, no button down): what is under it, looked at in the next frame.
      if (e.pointerType === 'mouse' && !dragging) { const p = local(e); hover.x = p.x; hover.y = p.y; hover.dirty = true; hover.on = true; const [wx, wy] = toWorld(p.x, p.y); o.pointer?.(wx, wy, cam.z, 'hover'); wake() }
      return
    }
    const p = ptrs.get(e.pointerId)!
    const dx = e.clientX - p.x, dy = e.clientY - p.y
    p.x = e.clientX; p.y = e.clientY
    if (ptrs.size === 2) {
      // Two fingers zoom round the point between them, and carry the map as that point moves.
      const t = twoFingers()
      const wx = raw.x + (mid.x - W / 2) / goal.z, wy = raw.y + (mid.y - H / 2) / goal.z
      zoomSoft((pinchZ * t.d) / Math.max(1, pinch0), t.x, t.y, wx, wy)
      mid = { x: t.x, y: t.y }
      Object.assign(cam, goal)
      focus.x = t.x; focus.y = t.y
      moved += 10
      wake()
      return
    }
    moved += Math.abs(dx) + Math.abs(dy)
    raw.x -= dx / cam.z; raw.y -= dy / cam.z
    place(goal, raw, true)
    cam.x = goal.x; cam.y = goal.y
    const now = performance.now(), dt = Math.max(8, now - last.t)
    const cap = (v: number) => Math.max(-38, Math.min(38, v))
    vel = { x: cap((dx / dt) * FRAME), y: cap((dy / dt) * FRAME) }
    last = { x: e.clientX, y: e.clientY, t: now }
    const lp = local(e); focus.x = lp.x; focus.y = lp.y
    if (moved > 6) hideCard()
    wake()
  })
  const up = (e: PointerEvent) => {
    if (holding && e.pointerId === holding.id) { holding.g.up(); holding = null; box.classList.remove('is-grabbing'); wake(); return }
    if (!ptrs.delete(e.pointerId)) return
    // From two fingers to one: the one left carries on dragging, without a throw from the change.
    if (ptrs.size) { vel = { x: 0, y: 0 }; return }
    dragging = false; box.classList.remove('is-grabbing')
    if (performance.now() - last.t > 80 || !PLAY) vel = { x: 0, y: 0 }
    // A throw settles when it runs out (in step); anything else, now.
    if (Math.abs(vel.x) <= 0.02 && Math.abs(vel.y) <= 0.02) settleSoon(0)
    wake()
  }
  stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up)
  stage.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && hover.on) { hover.on = false; hover.dirty = true; wake() } })
  stage.addEventListener('wheel', (e) => {
    e.preventDefault(); firstTouch()
    const p = local(e)
    const f = Math.exp(-e.deltaY * (e.ctrlKey ? 0.012 : 0.0022))
    const [wx, wy] = toWorld(p.x, p.y)
    zoomSoft(raw.z * f, p.x, p.y, wx, wy)
    focus.x = p.x; focus.y = p.y
    settleSoon(170)
    wake()
  }, { passive: false })
  stage.addEventListener('dblclick', (e) => { const p = local(e); zoomAt(2, p.x, p.y) })

  /* ---- the keyboard ----------------------------------------------------------- */
  // Arrows move, and held they glide; + and − zoom, and held keep zooming; 0 shows the whole island.
  const keyOf = (k: string) => (ARROWS[k] ? k : k === '+' || k === '=' ? 'in' : k === '-' || k === '_' ? 'out' : k === '0' ? 'home' : null)
  box.addEventListener('keydown', (e) => {
    // The browser's own shortcuts (its zoom is ctrl and +) stay the browser's.
    if (e.ctrlKey || e.metaKey || e.altKey) return
    const k = keyOf(e.key)
    if (!k || (e.target as HTMLElement).closest('.isl-card')) return
    e.preventDefault()
    // A key held down repeats: the glide is the loop's to do.
    if (e.repeat) return
    firstTouch()
    if (k === 'home') { home(); return }
    if (k === 'in' || k === 'out') zoomAt(k === 'in' ? 1.4 : 1 / 1.4)
    else { goal.x += (ARROWS[k][0] * 60) / goal.z; goal.y += (ARROWS[k][1] * 60) / goal.z; clampGoal() }
    held.set(k, performance.now())
    wake()
  })
  addEventListener('keyup', (e) => {
    const k = keyOf(e.key)
    if (!k || !held.delete(k)) return
    if (k === 'in' || k === 'out') { focus.x = W / 2; focus.y = H / 2; settleSoon(0) }
  })
  // A key let go of in another window would glide on for ever.
  const letGo = () => held.clear()
  addEventListener('blur', letGo)
  document.addEventListener('visibilitychange', letGo)

  /* ---- what is under the mouse ---------------------------------------------- */
  const hover = { x: 0, y: 0, on: false, dirty: false, lm: null as string | null }
  function hoverTest() {
    hover.dirty = false
    const h = hover.on && !dragging && engine ? engine.hit(hover.x, hover.y) : null
    const [wx, wy] = toWorld(hover.x, hover.y)
    stage.style.cursor = h ? 'pointer' : hover.on && o.grabbable?.(wx, wy, cam.z) ? 'grab' : ''
    const lm = h?.lm ?? null
    if (lm === hover.lm) return
    hover.lm = lm
    if (lm) showCard(lm)
    else hideCard(false)
  }

  /* ---- names, when close enough to read them ----------------------------- */
  const tags = new Map<string, HTMLElement>()
  const tagW = new Map<string, number>()
  for (const s of Object.keys(anchors)) {
    const g = games[s]; if (!g) continue
    const t = document.createElement('span')
    t.className = 'isl-tag'; t.textContent = g.title
    t.style.setProperty('--tint', g.tint)
    labels.append(t); tags.set(s, t)
  }

  // District names, drawn in the page rather than the picture, so they are
  // the same readable size at every zoom. They give way to the building
  // names once you are close.
  const dtags = (o.districts ?? []).map((d) => {
    const t = document.createElement('span')
    t.className = 'isl-dtag'; t.textContent = d.name; t.dataset.d = d.key
    labels.append(t)
    return { t, d }
  })
  const dtagW = new Map<string, number>()
  // Measured in the fallback font, a name is the wrong width once Fredoka arrives.
  document.fonts?.addEventListener?.('loadingdone', () => { dtagW.clear(); tagW.clear() })

  /* ---- the card --------------------------------------------------------- */
  let hot: string | null = null, hideT = 0
  const cardBest = card.querySelector<HTMLElement>('.isl-card-best')!
  const cardPlay = card.querySelector<HTMLAnchorElement>('.isl-card-play')!
  const cardExtra = card.querySelector<HTMLElement>('.isl-card-extra')!
  function showCard(slug: string, extra = '') {
    const g = games[slug]; if (!g) return
    clearTimeout(hideT)
    hot = slug
    engine?.setHot(slug)
    o.onCard?.(slug)
    pinHot(slug)
    card.querySelector('.isl-card-title')!.textContent = g.title
    card.querySelector('.isl-card-blurb')!.textContent = g.blurb
    cardBest.textContent = g.best ? `Best ${g.best}` : ''
    cardBest.hidden = !g.best
    cardExtra.textContent = extra; cardExtra.hidden = !extra
    cardPlay.href = g.href
    card.style.setProperty('--tint', g.tint)
    card.hidden = false
    // Its page is likely next: fetch it now, so the circle opens on it sooner.
    prefetch(g.href)
    requestAnimationFrame(() => card.classList.add('is-on'))
    placeOverlays()
    wake()
  }
  function hideCard(now = true) {
    const go = () => {
      card.classList.remove('is-on')
      hot = null
      engine?.setHot(null)
      pinHot(null)
      wake()
    }
    clearTimeout(hideT)
    if (now) go(); else hideT = window.setTimeout(go, 260)
  }
  card.addEventListener('pointerenter', () => clearTimeout(hideT))
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && hot) { hideCard(); box.focus({ preventScroll: true }) } })
  card.addEventListener('pointerleave', () => { hover.lm = null; hideCard(false) })
  cardPlay.addEventListener('click', (e) => { if (hot) { e.preventDefault(); enter(hot) } })

  function placeOverlays() {
    if (hot && anchors[hot]) {
      const a = anchors[hot]
      const [sx, sy] = toScreen((a.x0 + a.x1) / 2, a.y0)
      const cw = card.offsetWidth || 260
      const x = Math.min(W - cw / 2 - 12, Math.max(cw / 2 + 12, sx))
      // Above the building unless that would run under the top bar.
      const below = sy - 14 - (card.offsetHeight || 150) < 74
      const [, sb] = toScreen(0, a.y1)
      card.classList.toggle('is-below', below)
      card.style.transform = `translate(${(x - cw / 2).toFixed(0)}px, ${(below ? sb + 14 : sy - 14).toFixed(0)}px) translateY(${below ? '0' : '-100%'})`
      card.style.setProperty('--arrow', `${(sx - x + cw / 2).toFixed(0)}px`)
    }
    // Zoomed right out (a phone's whole island), the districts' names are wider than the gaps between
    // them: each tries its own spot, then a little above or below it, and waits if none is clear.
    const dplaced: [number, number, number, number][] = []
    for (const { t, d } of dtags) {
      const [sx, sy] = toScreen(d.x, d.y)
      let on = !near && sx > -120 && sx < W + 120 && sy > -40 && sy < H + 40
      let dy = 0
      if (on) {
        const w = (dtagW.get(d.key) ?? dtagW.set(d.key, t.offsetWidth || 120).get(d.key)!) / 2 + 3, h = (t.offsetHeight || 34) / 2 + 2
        const box = (y: number): [number, number, number, number] => [sx - w, sy + y - h, sx + w, sy + y + h]
        const clear = (r: [number, number, number, number]) => !dplaced.some((q) => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1])
        const at = [0, -1, 1, -2, 2].map((k) => k * h * 1.1).find((y) => clear(box(y)))
        if (at === undefined) on = false
        else { dy = at; dplaced.push(box(at)) }
      }
      t.classList.toggle('is-on', on)
      if (on) t.style.transform = `translate(${sx.toFixed(0)}px, ${(sy + dy).toFixed(0)}px) translate(-50%, -50%)`
    }
    if (near) {
      // Nearest the middle first; a name that would sit on one already placed waits.
      const placed: [number, number, number, number][] = []
      // How far from the middle a name shows: a little over a third of the view, never less than a phone's worth.
      const focusR = Math.max(130, Math.min(W, H) * (W < 700 ? 0.36 : 0.42))
      const order = [...tags].map(([s, t]) => { const a = anchors[s]; const [sx, sy] = toScreen(a.bx, a.y1); return { s, t, sx, sy: sy + 6, d: Math.hypot(sx - W / 2, sy - H / 2) } }).sort((p, q) => p.d - q.d)
      for (const { s, t, sx, sy, d } of order) {
        let w = tagW.get(s)
        if (w === undefined) { w = t.offsetWidth || 120; tagW.set(s, w) }
        const r: [number, number, number, number] = [sx - w / 2 - 4, sy - 2, sx + w / 2 + 4, sy + 28]
        const inView = sx > -80 && sx < W + 80 && sy > -40 && sy < H + 40 && s !== hot && d < focusR
        const clear = !placed.some((q) => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1])
        const on = inView && clear
        t.classList.toggle('is-on', on)
        if (on) { placed.push(r); t.style.transform = `translate(${sx.toFixed(0)}px, ${sy.toFixed(0)}px) translateX(-50%)` }
      }
    } else for (const t of tags.values()) t.classList.remove('is-on')
  }

  /* ---- buildings and pokes: hover, focus, click ------------------------------ */
  let touchish = false
  stage.addEventListener('pointerdown', (e) => { touchish = e.pointerType !== 'mouse' }, true)
  for (const [slug, a] of links) {
    a.addEventListener('focus', () => { flyToSlug(slug, 2.2); showCard(slug) })
    // The keyboard's Enter.
    a.addEventListener('click', (e) => { e.preventDefault(); pick(slug) })
  }
  // On a touch screen the first tap shows the card; the second goes in.
  function pick(slug: string) {
    if (moved > 6) return
    if (touchish && hot !== slug) { showCard(slug); flyToSlug(slug, 2); return }
    enter(slug)
  }
  /**
   * What a finger meant. A fingertip is wide and hides what it presses, so a
   * tap that lands just off a building (or a bottle) still counts: if nothing
   * is under the tap itself, rings round it are tried, nearest first, out to
   * about the width of a fingertip.
   */
  const RINGS = [9, 16, 24]
  const fingerHit = (x: number, y: number) => {
    const h = engine?.hit(x, y)
    if (h || !touchish || !engine) return h ?? null
    for (const r of RINGS) for (let k = 0; k < 8; k++) {
      const t = (k / 8) * Math.PI * 2 + (r === 16 ? Math.PI / 8 : 0)
      const q = engine.hit(x + Math.cos(t) * r, y + Math.sin(t) * r)
      if (q) return q
    }
    return null
  }
  // A click with the mouse or a finger: what was under it when it went down.
  stage.addEventListener('click', () => {
    if (moved > 6) return
    const h = fingerHit(press.x, press.y)
    { const [wx, wy] = toWorld(press.x, press.y); o.onTap?.(wx, wy, cam.z, h?.lm ? 'game' : h?.poke ? 'poke' : 'none', h?.lm ?? h?.poke?.kind ?? '') }
    if (h?.lm) { pick(h.lm); return }
    if (h?.poke) {
      engine!.poke(h.poke.node)
      o.onPoke?.(h.poke.kind, h.poke.n)
      wake()
      // Without motion the canvas only draws when asked: once more when the reaction is over.
      if (!PLAY) setTimeout(wake, POKE_MS + 60)
      return
    }
    { const [wx, wy] = toWorld(press.x, press.y); o.pointer?.(wx, wy, cam.z, 'tap') }
    hideCard()
  })

  /* ---- going in: the camera dives, a circle opens from the building, the game opens ---- */
  const iris = document.querySelector<HTMLElement>('.isl-iris')!
  let entering = false
  const prefetch = (href: string) => {
    if (document.head.querySelector(`link[rel="prefetch"][href="${CSS.escape(href)}"]`)) return
    const l = document.createElement('link'); l.rel = 'prefetch'; l.href = href
    document.head.append(l)
  }
  function enter(slug: string) {
    const g = games[slug]; if (!g || entering) return
    o.onEnter?.(slug)
    // Where to come back to: here, and out of this building.
    save(goal, slug)
    if (!PLAY) { location.href = g.href; return }
    entering = true
    hideCard()
    prefetch(g.href)
    // In, closer than the camera goes otherwise.
    zMax *= 1.3
    Object.assign(goal, inside(slug)); vel = { x: 0, y: 0 }; clampGoal(); wake()
    // Where the building will be on the screen (the edges can stop it short of the middle).
    const a = anchors[slug], r = box.getBoundingClientRect()
    const x = r.left + ((a.x0 + a.x1) / 2 - goal.x) * goal.z + W / 2, y = r.top + ((a.y0 + a.y1) / 2 - goal.y) * goal.z + H / 2
    const vw = innerWidth, vh = innerHeight
    iris.style.setProperty('--tint', g.tint)
    iris.style.setProperty('--ix', `${x.toFixed(0)}px`); iris.style.setProperty('--iy', `${y.toFixed(0)}px`)
    iris.style.setProperty('--ir', `${Math.ceil(Math.hypot(Math.max(x, vw - x), Math.max(y, vh - y))) + 2}px`)
    setTimeout(() => { iris.classList.remove('is-opening'); iris.classList.add('is-closing') }, 380)
    setTimeout(() => {
      // The game's page opens the circle again from the same point (Paper.astro).
      try { sessionStorage.setItem('isl-iris', JSON.stringify({ tint: g.tint, x: x / vw, y: y / vh, path: new URL(g.href, location.href).pathname, at: Date.now() })) } catch {}
      location.href = g.href
    }, 1020)
  }
  // The circle is the page change: the browser's own transition between pages is not wanted over it.
  type WithTransition = Event & { viewTransition?: { skipTransition(): void; ready: Promise<void>; finished: Promise<void> } | null }
  const skip = (e: Event) => {
    const vt = (e as WithTransition).viewTransition; if (!vt) return
    // A skipped transition rejects its promises: expected, so caught.
    vt.ready.catch(() => {}); vt.finished.catch(() => {})
    vt.skipTransition()
  }
  addEventListener('pageswap', (e) => { if (entering) skip(e) })
  // Back from the game with the browser's back button, to this very page as it was left: the circle
  // closes back into the building, and the camera steps back out of it.
  let backIn = false
  addEventListener('pageshow', (e) => {
    if (!e.persisted || !entering) return
    entering = false; backIn = true
    zMax = Math.max(fitZ() * 7, 3.4)
    iris.classList.remove('is-closing'); iris.classList.add('is-opening')
    o.onBack?.()
    setTimeout(() => iris.classList.remove('is-opening'), 700)
    const s = readSaved()
    if (s) Object.assign(goal, { x: s.x, y: s.y, z: s.n * fitZ() })
    clampGoal(); pace = 0.4; wake()
  })
  addEventListener('pagereveal', (e) => { if (backIn) { backIn = false; skip(e) } })

  /* ---- the mini-map ------------------------------------------------------- */
  // Click a place on it to fly there; drag across it and the camera follows.
  const miniTo = (e: PointerEvent) => {
    const pt = mini!.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY
    const w = pt.matrixTransform(mini!.getScreenCTM()!.inverse())
    flyTo(w.x, w.y, goal.z)
  }
  mini?.addEventListener('pointerdown', (e) => { if (e.button !== 0) return; mini.setPointerCapture(e.pointerId); firstTouch(); miniTo(e) })
  mini?.addEventListener('pointermove', (e) => { if (mini.hasPointerCapture(e.pointerId)) miniTo(e) })
  const pins = new Map([...(mini?.querySelectorAll<SVGElement>('.isl-mini-pin') ?? [])].map((p) => [p.dataset.slug!, p]))
  let pinned: SVGElement | null = null
  /** The pin of the building whose card is open, larger. */
  const pinHot = (slug: string | null) => { pinned?.classList.remove('is-hot'); pinned = slug ? pins.get(slug) ?? null : null; pinned?.classList.add('is-hot') }

  /* ---- sleeping when nobody is looking ------------------------------------ */
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) wake() }).observe(box)
  new ResizeObserver(() => {
    W = sizeW(); H = sizeH()
    zMin = fitZ() * 0.85; zMax = Math.max(fitZ() * 7, 3.4)
    clampGoal(); Object.assign(cam, goal); seen.z = NaN; wake()
  }).observe(box)

  /* ---- the view, kept for the visit ---------------------------------------- */
  // As a share of the zoom that fits the island, so a turned phone or a resized window keeps the place.
  type Saved = { x: number; y: number; n: number; from?: string }
  const KEY = 'isl-view'
  function readSaved(): Saved | null {
    try {
      const v = JSON.parse(sessionStorage.getItem(KEY) ?? 'null')
      return v && [v.x, v.y, v.n].every(Number.isFinite) ? v : null
    } catch { return null }
  }
  function save(c: Cam, from?: string) { try { sessionStorage.setItem(KEY, JSON.stringify({ x: c.x, y: c.y, n: c.z / fitZ(), from })) } catch {} }
  // Kept once there is a view worth keeping: the visitor has moved it, or the opening has settled.
  addEventListener('pagehide', () => { if (!entering && (interacted || stage0 !== 'poster')) save(goal) })
  /** The game this page was come back to from, if any: the camera steps out of its building. */
  const cameFrom = (() => {
    try {
      // Sent on from the other island's page, if it handed this visit straight here (IslandHome.astro).
      let ref = document.referrer
      const handed = sessionStorage.getItem('isl-ref')
      if (handed !== null) { sessionStorage.removeItem('isl-ref'); ref = handed }
      const r = ref && new URL(ref)
      if (!r || r.origin !== location.origin) return null
      return Object.keys(anchors).find((s) => games[s] && new URL(games[s].href, location.href).pathname === r.pathname) ?? null
    } catch { return null }
  })()

  /* ---- the opening ------------------------------------------------------------ */
  // The first time this visit: settle down from a little higher up, and the
  // buildings drop in. Back again: where the island was left, stepping out of
  // the building just played, if there was one. Until the canvas can draw, the
  // camera holds where it starts, over the poster; then it settles.
  const saved = readSaved()
  const settleTo: Cam = saved
    ? { x: saved.x, y: saved.y, z: saved.n * fitZ() }
    : cameFrom ? framing(cameFrom, 2.2)
    : { x: bx + bw / 2, y: by + bh * 0.54, z: fitZ() * OPEN(W) }
  place(settleTo, settleTo, false)
  const opening = { intro: !saved && !cameFrom }
  if (cameFrom) Object.assign(cam, inside(cameFrom))
  else if (saved) Object.assign(cam, settleTo)
  // The first look: the whole island, then down into Old Town.
  else { cam.z = fitZ() * 0.95; cam.y = by + bh * 0.5 }
  if (!opening.intro) hint?.classList.add('is-gone')
  if (PLAY) Object.assign(goal, cam)
  else { Object.assign(goal, settleTo); Object.assign(cam, settleTo) }
  Object.assign(raw, goal)
  function settle() {
    if (interacted) return
    Object.assign(goal, settleTo); goal.z = crisp(goal.z)
    clampGoal()
    if (cameFrom) pace = 0.4
    wake()
  }
  wake()

  /* ---- ?perf: the numbers, for the meter's readers and scripts/bench-island.mjs ---- */
  if (perf) {
    (window as unknown as { __island: unknown }).__island = {
      stats: () => engine?.stats() ?? null,
      /** Whether everything in view is drawn at its sharpest. */
      sharp: () => !!engine?.sharp(),
      /** The zoom that fits the island, and the island's box. */
      fit: () => fitZ(), bounds: o.bounds, anchors,
      /** Put the camera somewhere at once (z as a share of the fitting zoom). */
      jump: (x: number, y: number, n: number) => { firstTouch(); Object.assign(goal, { x, y, z: n * fitZ() }); clampGoal(); Object.assign(cam, goal); wake(); return { ...cam } },
      view: () => ({ ...cam }),
      /** Fly there, as the mini-map and the signposts do. */
      fly: (x: number, y: number, n: number) => { firstTouch(); flyTo(x, y, n * fitZ()) },
      time: (t: string) => { box.dataset.time = t; wake() },
    }
  }

  return {
    /** Do something with the engine (draw something, change a sign) as soon as the map has loaded. */
    withEngine,
    flyToSlug, showCard, hideCard, home, enter,
    /** Fly to a point on the map, at n times the zoom that fits the island. */
    flyToPoint: (x: number, y: number, n: number) => { firstTouch(); flyTo(x, y, fitZ() * n) },
    zoomIn: () => { firstTouch(); zoomAt(1.5) }, zoomOut: () => { firstTouch(); zoomAt(1 / 1.5) },
    dim: (set: Set<string> | null) => { keep = set; engine?.dim(set); wake() },
    /** Draw again (the page changed something the island shows). */
    redraw: wake,
    /** Stop drawing altogether (a dialog over the page), or start again. */
    pause: (on: boolean) => { paused = on; if (!on) wake() },
    /** Whether the island is being drawn: on screen, the page in front, nothing over it. */
    awake: () => visible && !paused && !document.hidden,
    /** Whether the island can be heard: on screen and the page in front. A dialog over it muffles it (sound.ts) rather than stopping it. */
    heard: () => visible && !document.hidden,
    worldPoint: (slug: string) => anchors[slug],
    /** The game this page was come back to from, by a link (not the back button), if any. */
    cameFrom,
    /** What the camera is looking at, in map units: for the soundscape. */
    view: () => ({ x: cam.x, y: cam.y, w: W / cam.z, h: H / cam.z }),
  }
}
