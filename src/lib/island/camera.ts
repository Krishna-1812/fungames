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
 * Until the canvas has what it needs to draw the view, a small picture of the
 * island stands in for it (the poster), moved by the same camera; then the
 * poster fades, and the buildings drop in.
 */
import { PLAY } from '../motion'
import { createEngine, type Engine, type IslandState } from './engine'
import { POKE_MS } from './moves'
import type { Scene } from './scene'

export type Anchor = { slug: string; district: string; x0: number; y0: number; x1: number; y1: number; bx: number; by: number }
export type GameInfo = { slug: string; title: string; blurb: string; href: string; best?: string | null; tint: string }

type Cam = { x: number; y: number; z: number }

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
  /** Something that is not a building was poked. */
  onPoke?: (kind: string) => void
}) {
  const { box, stage, canvas, poster, anchors, games, links } = o
  const [bx, by, bw, bh] = o.bounds
  const card = box.querySelector<HTMLElement>('.isl-card')!
  const labels = box.querySelector<HTMLElement>('.isl-labels')!
  const mini = box.querySelector<SVGSVGElement>('.isl-mini svg')
  const miniView = mini?.querySelector<SVGRectElement>('.isl-mini-view') ?? null
  const hint = box.querySelector<HTMLElement>('.isl-hint')

  /* ---- the camera ------------------------------------------------------ */
  let W = box.clientWidth, H = box.clientHeight
  // Past two device pixels per CSS pixel the island looks no sharper, and the canvas costs more than twice as much to fill.
  const ratio = () => Math.min(2, window.devicePixelRatio || 1)
  const fitZ = () => Math.min(W / (bw * 0.86), H / (bh * 0.8))
  let zMin = fitZ() * 0.85, zMax = Math.max(fitZ() * 7, 3.4)
  const cam: Cam = { x: bx + bw / 2, y: by + bh * 0.56, z: fitZ() }
  const goal: Cam = { ...cam }
  let vel = { x: 0, y: 0 }
  const clampGoal = () => {
    goal.z = Math.min(zMax, Math.max(zMin, goal.z))
    const hw = W / goal.z / 2, hh = H / goal.z / 2
    const padX = Math.max(0, bw / 2 - hw * 0.4), padY = Math.max(0, bh / 2 - hh * 0.4)
    goal.x = Math.min(bx + bw / 2 + padX, Math.max(bx + bw / 2 - padX, goal.x))
    goal.y = Math.min(by + bh / 2 + padY, Math.max(by + bh / 2 - padY, goal.y))
    // However hard it is thrown, the middle of the view stays over the island.
    if (o.land) {
      const [lx0, ly0, lx1, ly1] = o.land, ix = (lx1 - lx0) * 0.12, iy = (ly1 - ly0) * 0.12
      goal.x = Math.min(lx1 - ix, Math.max(lx0 + ix, goal.x))
      goal.y = Math.min(ly1 - iy, Math.max(ly0 + iy, goal.y))
    }
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
    for (const fn of waiting.splice(0)) fn(e)
    wake()
  }, (err) => console.error('[island] the map could not load', err))
  let keep: Set<string> | null = null
  let raf = 0, lastT = 0, visible = true, paused = false, dragging = false
  function wake() { if (!raf && visible && !paused) raf = requestAnimationFrame(frame) }

  /** One step of the camera towards its goal, over dt milliseconds. Whether it is still on its way. */
  const step = (dt: number) => {
    const f = dt / FRAME
    if (!dragging && (Math.abs(vel.x) > 0.02 || Math.abs(vel.y) > 0.02)) {
      goal.x -= (vel.x * f) / cam.z; goal.y -= (vel.y * f) / cam.z
      const d = Math.pow(0.9, f); vel.x *= d; vel.y *= d
      clampGoal()
    }
    // Each sixtieth of a second, a sixth of the way there.
    const k = PLAY ? 1 - Math.pow(0.84, f) : 1
    const dz = goal.z - cam.z, dx = goal.x - cam.x, dy = goal.y - cam.y
    const moving = Math.abs(dz) > 0.0005 * cam.z || Math.abs(dx) * cam.z > 0.3 || Math.abs(dy) * cam.z > 0.3 || Math.abs(vel.x) > 0.02 || Math.abs(vel.y) > 0.02
    if (moving) { cam.z += dz * k; cam.x += dx * k; cam.y += dy * k }
    else Object.assign(cam, goal)
    return moving
  }

  function frame(t: number) {
    raf = 0
    const dt = lastT ? Math.min(64, Math.max(1, t - lastT)) : FRAME
    lastT = t
    const moving = step(dt)
    if (engine) { engine.setView(cam, W, H, ratio()); engine.frame(t) }
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
    // The buildings drop in, unless the map is already being used.
    if (PLAY && !interacted) { engine!.intro(); settle() }
    const gone = () => { stage0 = 'gone'; if (poster) poster.hidden = true }
    if (PLAY && poster) setTimeout(gone, 450)
    else gone()
  }

  /* ---- zooming and flying ------------------------------------------------- */
  const zoomAt = (f: number, sx = W / 2, sy = H / 2) => {
    const [wx, wy] = toWorld(sx, sy)
    const z = Math.min(zMax, Math.max(zMin, goal.z * f))
    // Keep the point under the cursor where it is.
    goal.x = wx - (sx - W / 2) / z; goal.y = wy - (sy - H / 2) / z; goal.z = z
    clampGoal(); wake()
  }
  const flyTo = (x: number, y: number, z: number) => { goal.x = x; goal.y = y; goal.z = z; vel = { x: 0, y: 0 }; clampGoal(); wake() }
  const flyToSlug = (slug: string, zoom = 2.6) => {
    const a = anchors[slug]; if (!a) return
    // Close enough that the building is the subject, far enough that its card fits.
    const fit = Math.min(W / ((a.x1 - a.x0) * 2.8), H / ((a.y1 - a.y0) * 2.6))
    firstTouch()
    flyTo((a.x0 + a.x1) / 2, (a.y0 + a.y1) / 2 + (a.y1 - a.y0) * 0.1, Math.min(zMax, Math.max(fitZ() * 1.3, Math.min(fit, fitZ() * zoom))))
  }
  const home = () => { firstTouch(); flyTo(bx + bw / 2, by + bh * 0.56, fitZ()) }

  /* ---- pointers: drag, pinch, wheel, double-click ------------------------ */
  const ptrs = new Map<number, { x: number; y: number }>()
  let moved = 0, last = { x: 0, y: 0, t: 0 }, pinch0 = 0, pinchZ = 1
  let press = { x: 0, y: 0 }
  let interacted = false
  setTimeout(() => hint?.classList.add('is-gone'), 9000)
  function firstTouch() { if (interacted) return; interacted = true; hint?.classList.add('is-gone'); engine?.endIntro() }
  const local = (e: { clientX: number; clientY: number }) => { const r = box.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top } }
  stage.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY })
    press = local(e)
    stage.setPointerCapture(e.pointerId)
    dragging = true; moved = 0; vel = { x: 0, y: 0 }
    last = { x: e.clientX, y: e.clientY, t: performance.now() }
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); pinchZ = goal.z }
    box.classList.add('is-grabbing'); stage.style.cursor = ''; firstTouch(); wake()
  })
  stage.addEventListener('pointermove', (e) => {
    if (!ptrs.has(e.pointerId)) {
      // Just pointing (a mouse, no button down): what is under it, looked at in the next frame.
      if (e.pointerType === 'mouse' && !dragging) { const p = local(e); hover.x = p.x; hover.y = p.y; hover.dirty = true; hover.on = true; wake() }
      return
    }
    const p = ptrs.get(e.pointerId)!
    const dx = e.clientX - p.x, dy = e.clientY - p.y
    p.x = e.clientX; p.y = e.clientY
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()]
      const d = Math.hypot(a.x - b.x, a.y - b.y), r = box.getBoundingClientRect()
      const z = Math.min(zMax, Math.max(zMin, (pinchZ * d) / Math.max(1, pinch0)))
      const mx = (a.x + b.x) / 2 - r.left, my = (a.y + b.y) / 2 - r.top
      const [wx, wy] = toWorld(mx, my)
      goal.z = cam.z = z
      goal.x = cam.x = wx - (mx - W / 2) / z
      goal.y = cam.y = wy - (my - H / 2) / z
      moved += 10
      wake()
      return
    }
    moved += Math.abs(dx) + Math.abs(dy)
    goal.x -= dx / cam.z; goal.y -= dy / cam.z
    cam.x = goal.x; cam.y = goal.y
    const now = performance.now(), dt = Math.max(8, now - last.t)
    const cap = (v: number) => Math.max(-38, Math.min(38, v))
    vel = { x: cap((dx / dt) * FRAME), y: cap((dy / dt) * FRAME) }
    last = { x: e.clientX, y: e.clientY, t: now }
    clampGoal()
    if (moved > 6) hideCard()
    wake()
  })
  const up = (e: PointerEvent) => {
    ptrs.delete(e.pointerId)
    if (ptrs.size) return
    dragging = false; box.classList.remove('is-grabbing')
    if (performance.now() - last.t > 80) vel = { x: 0, y: 0 }
    if (!PLAY) vel = { x: 0, y: 0 }
    wake()
  }
  stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up)
  stage.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && hover.on) { hover.on = false; hover.dirty = true; wake() } })
  stage.addEventListener('wheel', (e) => {
    e.preventDefault(); firstTouch()
    const p = local(e)
    const f = Math.exp(-e.deltaY * (e.ctrlKey ? 0.012 : 0.0022))
    zoomAt(f, p.x, p.y)
  }, { passive: false })
  stage.addEventListener('dblclick', (e) => { const p = local(e); zoomAt(2, p.x, p.y) })
  box.addEventListener('keydown', (e) => {
    const step = 80 / cam.z
    const map: Record<string, () => void> = {
      ArrowLeft: () => { goal.x -= step }, ArrowRight: () => { goal.x += step }, ArrowUp: () => { goal.y -= step }, ArrowDown: () => { goal.y += step },
      '+': () => zoomAt(1.4), '=': () => zoomAt(1.4), '-': () => zoomAt(1 / 1.4), '0': home,
    }
    if (!map[e.key] || (e.target as HTMLElement).closest('.isl-card')) return
    e.preventDefault(); firstTouch(); map[e.key](); clampGoal(); wake()
  })

  /* ---- what is under the mouse ---------------------------------------------- */
  const hover = { x: 0, y: 0, on: false, dirty: false, lm: null as string | null }
  function hoverTest() {
    hover.dirty = false
    const h = hover.on && !dragging && engine ? engine.hit(hover.x, hover.y) : null
    stage.style.cursor = h ? 'pointer' : ''
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
    card.querySelector('.isl-card-title')!.textContent = g.title
    card.querySelector('.isl-card-blurb')!.textContent = g.blurb
    cardBest.textContent = g.best ? `Best ${g.best}` : ''
    cardBest.hidden = !g.best
    cardExtra.textContent = extra; cardExtra.hidden = !extra
    cardPlay.href = g.href
    card.style.setProperty('--tint', g.tint)
    card.hidden = false
    requestAnimationFrame(() => card.classList.add('is-on'))
    placeOverlays()
    wake()
  }
  function hideCard(now = true) {
    const go = () => {
      card.classList.remove('is-on')
      hot = null
      engine?.setHot(null)
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
    for (const { t, d } of dtags) {
      const [sx, sy] = toScreen(d.x, d.y)
      const on = !near && sx > -120 && sx < W + 120 && sy > -40 && sy < H + 40
      t.classList.toggle('is-on', on)
      if (on) t.style.transform = `translate(${sx.toFixed(0)}px, ${sy.toFixed(0)}px) translate(-50%, -50%)`
    }
    if (near) {
      // Nearest the middle first; a name that would sit on one already placed waits.
      const placed: [number, number, number, number][] = []
      const order = [...tags].map(([s, t]) => { const a = anchors[s]; const [sx, sy] = toScreen(a.bx, a.y1); return { s, t, sx, sy: sy + 6, d: Math.hypot(sx - W / 2, sy - H / 2) } }).sort((p, q) => p.d - q.d)
      for (const { s, t, sx, sy } of order) {
        let w = tagW.get(s)
        if (w === undefined) { w = t.offsetWidth || 120; tagW.set(s, w) }
        const r: [number, number, number, number] = [sx - w / 2 - 4, sy - 2, sx + w / 2 + 4, sy + 28]
        const inView = sx > -80 && sx < W + 80 && sy > -40 && sy < H + 40 && s !== hot
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
  // A click with the mouse or a finger: what was under it when it went down.
  stage.addEventListener('click', () => {
    if (moved > 6) return
    const h = engine?.hit(press.x, press.y)
    if (h?.lm) { pick(h.lm); return }
    if (h?.poke) {
      engine!.poke(h.poke.node)
      o.onPoke?.(h.poke.kind)
      wake()
      // Without motion the canvas only draws when asked: once more when the reaction is over.
      if (!PLAY) setTimeout(wake, POKE_MS + 60)
      return
    }
    hideCard()
  })

  /* ---- going in: the camera dives, a circle closes, the game opens ------- */
  const iris = box.querySelector<HTMLElement>('.isl-iris')!
  let entering = false
  function enter(slug: string) {
    const g = games[slug]; if (!g || entering) return
    o.onEnter?.(slug)
    if (!PLAY) { location.href = g.href; return }
    entering = true
    hideCard()
    const a = anchors[slug]
    flyTo((a.x0 + a.x1) / 2, (a.y0 + a.y1) / 2, Math.min(zMax * 1.3, Math.min(W / (a.x1 - a.x0), H / (a.y1 - a.y0)) * 0.9))
    zMax *= 1.3
    iris.style.setProperty('--tint', g.tint)
    setTimeout(() => iris.classList.add('is-closing'), 380)
    setTimeout(() => { location.href = g.href }, 980)
  }
  // Coming back with the browser's back button: open the iris again.
  addEventListener('pageshow', (e) => { if (e.persisted) { entering = false; iris.classList.remove('is-closing'); zMax = Math.max(fitZ() * 7, 3.4); clampGoal(); wake() } })

  /* ---- the mini-map ------------------------------------------------------- */
  mini?.addEventListener('pointerdown', (e) => {
    const pt = mini.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY
    const w = pt.matrixTransform(mini.getScreenCTM()!.inverse())
    firstTouch(); flyTo(w.x, w.y, goal.z)
  })

  /* ---- sleeping when nobody is looking ------------------------------------ */
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) wake() }).observe(box)
  new ResizeObserver(() => {
    W = box.clientWidth; H = box.clientHeight
    zMin = fitZ() * 0.85; zMax = Math.max(fitZ() * 7, 3.4)
    clampGoal(); Object.assign(cam, goal); seen.z = NaN; wake()
  }).observe(box)

  /* ---- the opening: settle down from a little higher up ------------------- */
  // Until the canvas can draw, the camera holds here, over the poster; then it settles.
  cam.z = fitZ() * 0.82; cam.y -= bh * 0.08
  goal.x = bx + bw / 2; goal.y = by + bh * 0.54; goal.z = fitZ() * (W < 700 ? 2.1 : 1.12)
  clampGoal()
  const settleTo = { ...goal }
  if (PLAY) Object.assign(goal, cam)
  else Object.assign(cam, goal)
  function settle() { if (!interacted) { Object.assign(goal, settleTo); wake() } }
  wake()

  return {
    /** Do something with the engine (draw something, change a sign) as soon as the map has loaded. */
    withEngine,
    flyToSlug, showCard, hideCard, home, enter,
    zoomIn: () => { firstTouch(); zoomAt(1.5) }, zoomOut: () => { firstTouch(); zoomAt(1 / 1.5) },
    dim: (set: Set<string> | null) => { keep = set; engine?.dim(set); wake() },
    /** Draw again (the page changed something the island shows). */
    redraw: wake,
    /** Stop drawing altogether (a dialog over the page), or start again. */
    pause: (on: boolean) => { paused = on; if (!on) wake() },
    /** Whether the island is being drawn: on screen, the page in front, nothing over it. */
    awake: () => visible && !paused && !document.hidden,
    worldPoint: (slug: string) => anchors[slug],
    /** What the camera is looking at, in map units: for the soundscape. */
    view: () => ({ x: cam.x, y: cam.y, w: W / cam.z, h: H / cam.z }),
  }
}
