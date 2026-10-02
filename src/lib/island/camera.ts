/**
 * Tiny Island — the camera and everything you do to the map.
 *
 * The island is one SVG; the camera is its viewBox. Drag it (it keeps a little
 * of your throw), wheel or pinch to zoom round the point under your fingers,
 * double-click to dive in, or use the keyboard. Names appear once you are close
 * enough to read them. Hovering a building shows its card; clicking one dives
 * the camera into it and opens the game. Everything eases towards a target, so
 * nothing ever jumps, and under reduced motion everything simply goes there.
 */
import { PLAY } from '../motion'

export type Anchor = { slug: string; district: string; x0: number; y0: number; x1: number; y1: number; bx: number; by: number }
export type GameInfo = { slug: string; title: string; blurb: string; href: string; best?: string | null; tint: string }

type Cam = { x: number; y: number; z: number }

export function initIsland(o: {
  box: HTMLElement
  /** Where pointers land: the map itself, under the buttons. */
  stage: HTMLElement
  /** The layers, all moved together by one transform. */
  world: HTMLElement
  bounds: [number, number, number, number]
  /** The island itself, without the sea: the camera never lets it all go off screen. */
  land?: [number, number, number, number]
  /** The district names, where their banners stand on the map. */
  districts?: { key: string; name: string; x: number; y: number }[]
  anchors: Record<string, Anchor>
  games: Record<string, GameInfo>
  onEnter?: (slug: string) => void
  /** Something that is not a building was clicked (it carries data-poke). */
  onPoke?: (el: Element) => void
}) {
  const { box, stage, world, anchors, games } = o
  const svg = world
  const [bx, by, bw, bh] = o.bounds
  const card = box.querySelector<HTMLElement>('.isl-card')!
  const labels = box.querySelector<HTMLElement>('.isl-labels')!
  const mini = box.querySelector<SVGSVGElement>('.isl-mini svg')
  const miniView = mini?.querySelector<SVGRectElement>('.isl-mini-view') ?? null
  const hint = box.querySelector<HTMLElement>('.isl-hint')
  const links = new Map<string, SVGAElement>()
  svg.querySelectorAll<SVGAElement>('a.lm').forEach((a) => links.set(a.dataset.slug!, a))

  /* ---- the camera ------------------------------------------------------ */
  let W = box.clientWidth, H = box.clientHeight
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
  const apply = () => {
    const w = W / cam.z, h = H / cam.z
    world.style.transform = `translate(${(W / 2 - cam.x * cam.z).toFixed(2)}px, ${(H / 2 - cam.y * cam.z).toFixed(2)}px) scale(${cam.z.toFixed(4)})`
    const near = cam.z / fitZ()
    box.classList.toggle('z-far', near < 1.25)
    box.classList.toggle('z-near', near > 2.1)
    if (miniView) { miniView.setAttribute('x', String(cam.x - w / 2)); miniView.setAttribute('y', String(cam.y - h / 2)); miniView.setAttribute('width', String(w)); miniView.setAttribute('height', String(h)) }
    placeOverlays()
    cull()
  }
  const toScreen = (x: number, y: number) => [(x - cam.x) * cam.z + W / 2, (y - cam.y) * cam.z + H / 2]
  const toWorld = (sx: number, sy: number) => [(sx - W / 2) / cam.z + cam.x, (sy - H / 2) / cam.z + cam.y]

  let running = false, dragging = false
  // While the zoom is changing, the island is one GPU layer that scales as a
  // picture (re-drawing every vector at every step is a few frames a second);
  // once it stops, the layer goes and the island is drawn sharp at its new size.
  let promoted = false, demoteT = 0
  const promote = () => { clearTimeout(demoteT); if (!promoted) { world.style.willChange = 'transform'; world.classList.add('is-zooming'); promoted = true } }
  const demote = () => { clearTimeout(demoteT); demoteT = window.setTimeout(() => { if (!running && promoted) { world.style.willChange = ''; world.classList.remove('is-zooming'); promoted = false } }, 140) }
  const tick = () => {
    if (!dragging && (Math.abs(vel.x) > 0.02 || Math.abs(vel.y) > 0.02)) {
      goal.x -= vel.x / cam.z; goal.y -= vel.y / cam.z
      vel.x *= 0.9; vel.y *= 0.9
      clampGoal()
    }
    const k = PLAY ? 0.16 : 1
    const dz = goal.z - cam.z, dx = goal.x - cam.x, dy = goal.y - cam.y
    cam.z += dz * k; cam.x += dx * k; cam.y += dy * k
    apply()
    const moving = Math.abs(dz) > 0.0005 * cam.z || Math.abs(dx) * cam.z > 0.3 || Math.abs(dy) * cam.z > 0.3 || Math.abs(vel.x) > 0.02 || Math.abs(vel.y) > 0.02
    if (moving || dragging) requestAnimationFrame(tick)
    else { Object.assign(cam, goal); apply(); cull(true); running = false; demote() }
  }
  const wake = () => { if (!running) { running = true; requestAnimationFrame(tick) } }
  const zoomAt = (f: number, sx = W / 2, sy = H / 2) => {
    const [wx, wy] = toWorld(sx, sy)
    const z = Math.min(zMax, Math.max(zMin, goal.z * f))
    // Keep the point under the cursor where it is.
    goal.x = wx - (sx - W / 2) / z; goal.y = wy - (sy - H / 2) / z; goal.z = z
    promote(); clampGoal(); wake()
  }
  const flyTo = (x: number, y: number, z: number) => { goal.x = x; goal.y = y; goal.z = z; vel = { x: 0, y: 0 }; if (Math.abs(z - cam.z) > 0.001) promote(); clampGoal(); wake() }
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
  let moved = 0, last = { x: 0, y: 0, t: 0 }, pinch0 = 0, pinchZ = 1, pressed: Element | null = null
  let interacted = false
  setTimeout(() => hint?.classList.add('is-gone'), 9000)
  function firstTouch() { if (interacted) return; interacted = true; hint?.classList.add('is-gone'); svg.classList.remove('is-intro') }
  stage.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY })
    // The stage takes the pointer for the drag, which makes the click that
    // follows land on the stage: remember what was really pressed.
    pressed = e.target as Element
    stage.setPointerCapture(e.pointerId)
    dragging = true; moved = 0; vel = { x: 0, y: 0 }
    last = { x: e.clientX, y: e.clientY, t: performance.now() }
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); pinchZ = goal.z }
    box.classList.add('is-grabbing'); firstTouch(); wake()
  })
  stage.addEventListener('pointermove', (e) => {
    if (!ptrs.has(e.pointerId)) return
    const p = ptrs.get(e.pointerId)!
    const dx = e.clientX - p.x, dy = e.clientY - p.y
    p.x = e.clientX; p.y = e.clientY
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()]
      const d = Math.hypot(a.x - b.x, a.y - b.y), r = box.getBoundingClientRect()
      const z = Math.min(zMax, Math.max(zMin, (pinchZ * d) / Math.max(1, pinch0)))
      const [wx, wy] = toWorld((a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top)
      goal.z = z; cam.z = z; promote()
      goal.x = cam.x = wx - ((a.x + b.x) / 2 - r.left - W / 2) / z + (cam.x - wx) * 0
      goal.y = cam.y = wy - ((a.y + b.y) / 2 - r.top - H / 2) / z
      moved += 10
      return
    }
    moved += Math.abs(dx) + Math.abs(dy)
    goal.x -= dx / cam.z; goal.y -= dy / cam.z
    cam.x = goal.x; cam.y = goal.y
    const now = performance.now(), dt = Math.max(8, now - last.t)
    const cap = (v: number) => Math.max(-38, Math.min(38, v))
    vel = { x: cap((dx / dt) * 16), y: cap((dy / dt) * 16) }
    last = { x: e.clientX, y: e.clientY, t: now }
    clampGoal()
    if (moved > 6) hideCard()
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
  stage.addEventListener('wheel', (e) => {
    e.preventDefault(); firstTouch()
    const r = box.getBoundingClientRect()
    const f = Math.exp(-e.deltaY * (e.ctrlKey ? 0.012 : 0.0022))
    zoomAt(f, e.clientX - r.left, e.clientY - r.top)
  }, { passive: false })
  stage.addEventListener('dblclick', (e) => { const r = box.getBoundingClientRect(); zoomAt(2, e.clientX - r.left, e.clientY - r.top) })
  box.addEventListener('keydown', (e) => {
    const step = 80 / cam.z
    const map: Record<string, () => void> = {
      ArrowLeft: () => { goal.x -= step }, ArrowRight: () => { goal.x += step }, ArrowUp: () => { goal.y -= step }, ArrowDown: () => { goal.y += step },
      '+': () => zoomAt(1.4), '=': () => zoomAt(1.4), '-': () => zoomAt(1 / 1.4), '0': home,
    }
    if (!map[e.key] || (e.target as HTMLElement).closest('.isl-card')) return
    e.preventDefault(); firstTouch(); map[e.key](); clampGoal(); wake()
  })

  /* ---- motion only where you are looking --------------------------------- */
  svg.classList.add('is-culling')
  const boxed = (sel: string) => Array.from(svg.querySelectorAll<SVGElement>(sel)).map((el) => ({ el, b: (el.dataset.b ?? '0 0 0 0').split(' ').map(Number) }))
  const walkerEls = boxed('.walker')
  // The small ambient things: glints, falls, and whatever else moves on its own.
  const ambEls = boxed('.amb')
  let lastCull = 0
  function cull(force = false) {
    const now = performance.now()
    if (!force && now - lastCull < 220) return
    lastCull = now
    const w = W / cam.z, h = H / cam.z, x0 = cam.x - w / 2, y0 = cam.y - h / 2, x1 = x0 + w, y1 = y0 + h
    const seen = (b: number[]) => b[2] > x0 && b[0] < x1 && b[3] > y0 && b[1] < y1
    // Fewer at once from far away, where the whole island is on screen and
    // every moving thing makes the browser repaint more of it.
    const near = cam.z / fitZ()
    // A phone shows less of the island and has less to spare: two thirds as many.
    const k = W < 700 ? 0.67 : 1
    const LIVE_LM = Math.round((near < 1.3 ? 8 : near < 2 ? 11 : 14) * k), LIVE_WALK = Math.round((near < 1.3 ? 10 : near < 2 ? 12 : 16) * k), LIVE_AMB = Math.round((near < 1.3 ? 10 : near < 2 ? 14 : 18) * k)
    const d = (b: number[]) => Math.hypot((b[0] + b[2]) / 2 - cam.x, (b[1] + b[3]) / 2 - cam.y)
    const lm = Object.values(anchors).map((a) => ({ s: a.slug, b: [a.x0, a.y0, a.x1, a.y1] })).filter((a) => seen(a.b)).sort((p, q) => d(p.b) - d(q.b)).slice(0, LIVE_LM).map((a) => a.s)
    const live = new Set(lm); if (hot) live.add(hot)
    for (const [s, a] of links) a.classList.toggle('is-live', live.has(s))
    const wl = new Set(walkerEls.filter((x) => seen(x.b)).sort((p, q) => d(p.b) - d(q.b)).slice(0, LIVE_WALK).map((x) => x.el))
    for (const x of walkerEls) x.el.classList.toggle('is-live', wl.has(x.el))
    const al = new Set(ambEls.filter((x) => seen(x.b)).sort((p, q) => d(p.b) - d(q.b)).slice(0, LIVE_AMB).map((x) => x.el))
    for (const x of ambEls) x.el.classList.toggle('is-live', al.has(x.el))
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
    if (hot && hot !== slug) links.get(hot)?.classList.remove('is-hot')
    hot = slug
    links.get(slug)?.classList.add('is-hot', 'is-live')
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
  }
  function hideCard(now = true) {
    const go = () => {
      card.classList.remove('is-on')
      if (hot) links.get(hot)?.classList.remove('is-hot')
      hot = null
    }
    clearTimeout(hideT)
    if (now) go(); else hideT = window.setTimeout(go, 260)
  }
  card.addEventListener('pointerenter', () => clearTimeout(hideT))
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && hot) { hideCard(); box.focus({ preventScroll: true }) } })
  card.addEventListener('pointerleave', () => hideCard(false))
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
    const near = box.classList.contains('z-near')
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
    }
  }

  /* ---- buildings: hover, focus, click ------------------------------------ */
  let touchish = false
  stage.addEventListener('pointerdown', (e) => { touchish = e.pointerType !== 'mouse' }, true)
  for (const [slug, a] of links) {
    a.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse' && !dragging) showCard(slug) })
    a.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') hideCard(false) })
    a.addEventListener('focus', () => { flyToSlug(slug, 2.2); showCard(slug) })
    // A click that reaches the link itself (the keyboard's Enter does).
    a.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); pick(slug) })
  }
  // On a touch screen the first tap shows the card; the second goes in.
  function pick(slug: string) {
    if (moved > 6) return
    if (touchish && hot !== slug) { showCard(slug); flyToSlug(slug, 2); return }
    enter(slug)
  }
  // A click with the mouse or a finger lands here, not on what was pressed:
  // the stage took the pointer for dragging (see pointerdown). So this is
  // where a building, or something to poke, is found and acted on.
  stage.addEventListener('click', (e) => {
    const t = (pressed ?? e.target) as Element
    if (moved > 6) return
    const lm = t.closest<SVGAElement>('a.lm')
    if (lm?.dataset.slug) { e.preventDefault(); pick(lm.dataset.slug); return }
    const pk = t.closest('[data-poke]')
    if (pk) { o.onPoke?.(pk); return }
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
  addEventListener('pageshow', (e) => { if (e.persisted) { entering = false; iris.classList.remove('is-closing'); zMax = Math.max(fitZ() * 7, 3.4) } })

  /* ---- the mini-map ------------------------------------------------------- */
  mini?.addEventListener('pointerdown', (e) => {
    const pt = mini.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY
    const w = pt.matrixTransform(mini.getScreenCTM()!.inverse())
    firstTouch(); flyTo(w.x, w.y, goal.z)
  })

  /* ---- sleeping when nobody is looking ------------------------------------ */
  new IntersectionObserver(([e]) => {
    const off = !e.isIntersecting
    svg.classList.toggle('is-paused', off)
  }).observe(box)

  new ResizeObserver(() => {
    W = box.clientWidth; H = box.clientHeight
    zMin = fitZ() * 0.85; zMax = Math.max(fitZ() * 7, 3.4)
    clampGoal(); Object.assign(cam, goal); apply()
  }).observe(box)

  /* ---- the opening: settle down from a little higher up ------------------- */
  cam.z = fitZ() * 0.82; cam.y -= bh * 0.08
  goal.z = fitZ() * (W < 700 ? 2.1 : 1.12)
  goal.x = bx + bw / 2; goal.y = by + bh * 0.54
  clampGoal(); apply()
  if (PLAY) { svg.classList.add('is-intro'); promote(); setTimeout(wake, 150); setTimeout(() => svg.classList.remove('is-intro'), 3200) }
  else Object.assign(cam, goal), apply()

  return {
    flyToSlug, showCard, hideCard, home, enter,
    zoomIn: () => { firstTouch(); zoomAt(1.5) }, zoomOut: () => { firstTouch(); zoomAt(1 / 1.5) },
    dim: (keep: Set<string> | null) => {
      svg.classList.toggle('is-dimming', !!keep)
      for (const [s, a] of links) a.classList.toggle('is-match', !!keep && keep.has(s))
    },
    worldPoint: (slug: string) => anchors[slug],
  }
}
