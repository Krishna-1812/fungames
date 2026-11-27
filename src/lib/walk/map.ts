/**
 * Finding your way on the walk (pages/walk.astro): a map in the corner that
 * turns as you do, a compass across the top, the name of the district as you
 * come into it, and the whole island's map (M, or a tap on the small one)
 * with every game on it: choose one and it becomes your waypoint — a column of
 * light in the world (walker.ts), the way there along the streets drawn on the
 * map, its bearing on the compass, how far it is.
 */
import { DISTRICTS } from '../island/landmarks'
import type { WorldData } from './build3d'

type Walkish = {
  view(): { x: number; z: number; yaw: number; driving: boolean }
  setWaypoint(at: { x: number; z: number } | null): void
  state(): { parked: number[][] }
}

const CSS = `
.wkm-mini { position: absolute; right: 16px; bottom: 58px; width: var(--wkm, 150px); height: var(--wkm, 150px); border-radius: 50%; overflow: hidden; border: 3px solid rgb(255 255 255 / 0.92); box-shadow: 0 6px 20px rgb(6 12 30 / 0.35); cursor: pointer; background: #3f8fbf; padding: 0; }
.wkm-mini:focus-visible { outline: 3px solid #4fe3c1; outline-offset: 3px; }
.wkm-mini canvas { width: 100%; height: 100%; display: block; }
.wkm-compass { position: absolute; top: 14px; left: 50%; transform: translateX(-50%); width: min(300px, 46vw); height: 34px; border-radius: 999px; background: rgb(255 255 255 / 0.9); box-shadow: 0 4px 14px rgb(0 0 0 / 0.25); overflow: hidden; pointer-events: none; }
.wkm-compass canvas { width: 100%; height: 100%; display: block; }
.wkm-where { position: absolute; top: 58px; left: 50%; transform: translateX(-50%); text-align: center; pointer-events: none; color: #fff; text-shadow: 0 2px 10px rgb(6 12 30 / 0.6); opacity: 0; transition: opacity 0.9s; }
.wkm-where[data-on='true'] { opacity: 1; }
.wkm-where b { display: block; font: 700 clamp(22px, 4vw, 34px)/1.1 var(--font-ui, system-ui, sans-serif); letter-spacing: 0.01em; }
.wkm-where small { font: 600 13px/1.6 var(--font-ui, system-ui, sans-serif); opacity: 0.9; }
.wkm-big { position: absolute; inset: 0; background: rgb(8 14 32 / 0.72); display: grid; place-items: center; z-index: 5; }
.wkm-big[hidden] { display: none; }
.wkm-sheet { position: relative; width: min(92vmin, 720px); aspect-ratio: 1; border-radius: 18px; overflow: hidden; box-shadow: 0 20px 60px rgb(0 0 0 / 0.5); background: #3f8fbf; }
.wkm-sheet canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
.wkm-pin { position: absolute; width: 22px; height: 22px; margin: -11px 0 0 -11px; border-radius: 50%; border: 2.5px solid #fff; background: #2f6df6; box-shadow: 0 2px 8px rgb(0 0 0 / 0.35); cursor: pointer; padding: 0; }
.wkm-pin:hover, .wkm-pin:focus-visible { background: #4fe3c1; outline: none; transform: scale(1.25); }
.wkm-pin[data-on='true'] { background: #4fe3c1; }
.wkm-dname { position: absolute; transform: translate(-50%, -50%); font: 700 13px/1 var(--font-ui, system-ui, sans-serif); color: #0f1730; background: rgb(255 255 255 / 0.82); padding: 4px 8px; border-radius: 999px; pointer-events: none; white-space: nowrap; letter-spacing: 0.02em; }
.wkm-bar { position: absolute; left: 12px; right: 12px; bottom: 12px; display: flex; gap: 8px; align-items: center; justify-content: space-between; }
.wkm-tip { font: 600 13px/1.3 var(--font-ui, system-ui, sans-serif); color: #0f1730; background: rgb(255 255 255 / 0.9); padding: 8px 12px; border-radius: 999px; }
.wkm-btn { border: 0; border-radius: 999px; padding: 8px 14px; background: #fff; color: #0f1730; font: 600 13px/1 var(--font-ui, system-ui, sans-serif); cursor: pointer; box-shadow: 0 2px 8px rgb(0 0 0 / 0.25); }
.wkm-btn:focus-visible { outline: 3px solid #4fe3c1; outline-offset: 2px; }
.wkm-close { position: absolute; top: 12px; right: 12px; }
@media (pointer: coarse), (max-width: 640px) { .wkm-mini { --wkm: 108px; bottom: 150px; right: 12px; } .wkm-compass { top: 64px; } .wkm-where { top: 106px; } }
`

export function wayfinding(root: HTMLElement, data: WorldData, walk: Walkish, opts: { phone: boolean }) {
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style)
  const N = data.grid, PAD = 4, S = 10, size = (N + PAD * 2) * S
  const kind = (i: number, j: number) => (i < 0 || j < 0 || i >= N || j >= N ? '0' : data.ground[i * N + j])
  const roads = new Set(data.road.map(([i, j]) => i * 1000 + j))
  const isRoad = (i: number, j: number) => roads.has(i * 1000 + j)

  /* ---- the island, drawn once ---- */
  const base = document.createElement('canvas'); base.width = base.height = size
  {
    const g = base.getContext('2d')!
    g.fillStyle = '#3f8fbf'; g.fillRect(0, 0, size, size)
    const px = (j: number) => (j + PAD) * S
    // Shallows round the land, then sand and land; high ground paler.
    for (let i = -PAD; i < N + PAD; i++) for (let j = -PAD; j < N + PAD; j++) {
      const k = kind(i, j)
      if (k !== '0') continue
      let near = false
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (kind(i + a, j + b) !== '0') near = true
      if (near) { g.fillStyle = '#5eb2d6'; g.fillRect(px(j), px(i), S, S) }
    }
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const k = kind(i, j); if (k === '0') continue
      const h = data.height?.[i]?.[j] ?? 0
      g.fillStyle = k === 'b' ? '#ecdfc3' : h > 6 ? '#c9cfc6' : h > 3 ? '#a9c79a' : '#9cc78e'
      g.fillRect(px(j), px(i), S + 0.5, S + 0.5)
    }
    for (const [i, j] of data.pond ?? []) { g.fillStyle = '#5eb2d6'; g.fillRect(px(j), px(i), S, S) }
    for (const [i, j] of data.river ?? []) { g.fillStyle = '#5eb2d6'; g.fillRect(px(j) + S * 0.25, px(i) + S * 0.25, S * 0.5, S * 0.5) }
    // Buildings, the games' in the accent blue.
    for (const b of data.buildings) {
      g.fillStyle = data.games[b.slug] ? '#3b74e8' : '#e7ecf3'
      g.fillRect(px(b.j) + 1, px(b.i) + 1, b.d * S - 2, b.w * S - 2)
    }
    // The streets: white, their kerbs a shade.
    g.lineCap = 'round'
    for (const [w, c] of [[S * 0.62, '#c9d2de'], [S * 0.46, '#ffffff']] as const) {
      g.strokeStyle = c; g.lineWidth = w
      for (const [i, j] of data.road) for (const [a, b] of [[1, 0], [0, 1]]) if (isRoad(i + a, j + b)) {
        g.beginPath(); g.moveTo(px(j) + S / 2, px(i) + S / 2); g.lineTo(px(j + b) + S / 2, px(i + a) + S / 2); g.stroke()
      }
      for (const [i, j] of data.road) { g.beginPath(); g.arc(px(j) + S / 2, px(i) + S / 2, w / 2, 0, Math.PI * 2); g.fillStyle = c; g.fill() }
    }
    for (const pts of data.piers ?? []) { g.strokeStyle = '#d9c7a8'; g.lineWidth = S * 0.35; g.beginPath(); pts.forEach(([i, j], n) => (n ? g.lineTo((j + PAD) * S, (i + PAD) * S) : g.moveTo((j + PAD) * S, (i + PAD) * S))); g.stroke() }
  }

  /* ---- the way there: along the streets, by the fewest tiles ---- */
  let target: { x: number; z: number; title: string; slug: string } | null = null
  let route: [number, number][] = [], routeFrom = '', routeT = 0
  const nearestRoad = (x: number, z: number) => { let best: [number, number] = data.road[0], bd = Infinity; for (const [i, j] of data.road) { const d = Math.hypot(j + 0.5 - x, i + 0.5 - z); if (d < bd) { bd = d; best = [i, j] } } return best }
  const findRoute = (x: number, z: number) => {
    if (!target) { route = []; return }
    const a = nearestRoad(x, z), b = nearestRoad(target.x, target.z)
    const prev = new Map<number, number>(), q = [a[0] * 1000 + a[1]]
    prev.set(q[0], -1)
    while (q.length) {
      const k = q.shift()!; if (k === b[0] * 1000 + b[1]) break
      const i = Math.floor(k / 1000), j = k % 1000
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = (i + di) * 1000 + j + dj; if (roads.has(n) && !prev.has(n)) { prev.set(n, k); q.push(n) } }
    }
    const out: [number, number][] = [[target.x, target.z]]
    for (let k = b[0] * 1000 + b[1]; k !== -1 && prev.has(k); k = prev.get(k)!) out.push([(k % 1000) + 0.5, Math.floor(k / 1000) + 0.5])
    out.push([x, z])
    route = out.reverse()
  }
  const routeLen = () => route.slice(1).reduce((s, p, n) => s + Math.hypot(p[0] - route[n][0], p[1] - route[n][1]), 0)

  /* ---- the small map, turning as you do ---- */
  const mini = document.createElement('button'); mini.type = 'button'; mini.className = 'wkm-mini'; mini.setAttribute('aria-label', 'The island map (M)')
  const mc = document.createElement('canvas'); mini.appendChild(mc); root.appendChild(mini)
  const compass = document.createElement('div'); compass.className = 'wkm-compass'; compass.setAttribute('aria-hidden', 'true')
  const cc = document.createElement('canvas'); compass.appendChild(cc); root.appendChild(compass)
  const where = document.createElement('div'); where.className = 'wkm-where'; where.setAttribute('aria-live', 'polite')
  root.appendChild(where)
  const dpr = Math.min(2, devicePixelRatio || 1)
  const fitCanvas = (c: HTMLCanvasElement) => { const r = c.getBoundingClientRect(); const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr)); if (c.width !== w || c.height !== h) { c.width = w; c.height = h } }
  // (The small map shows some sixteen tiles across round you.)
  const SPAN = opts.phone ? 13 : 16
  const drawMini = (v: { x: number; z: number; yaw: number; driving: boolean }) => {
    fitCanvas(mc)
    const g = mc.getContext('2d')!, W = mc.width, k = W / (SPAN * S)
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, W)
    g.save(); g.translate(W / 2, W / 2); g.rotate(v.yaw); g.scale(k, k)
    g.translate(-(v.x + PAD) * S, -(v.z + PAD) * S)
    g.imageSmoothingEnabled = true; g.drawImage(base, 0, 0)
    // Your cars, and the way to the waypoint.
    for (const [x, z] of walk.state().parked) { g.fillStyle = '#0f1730'; g.beginPath(); g.arc((x + PAD) * S, (z + PAD) * S, S * 0.22, 0, Math.PI * 2); g.fill() }
    if (route.length > 1) {
      g.lineJoin = g.lineCap = 'round'; g.strokeStyle = '#ffffff'; g.lineWidth = S * 0.5
      g.beginPath(); route.forEach(([x, z], n) => (n ? g.lineTo((x + PAD) * S, (z + PAD) * S) : g.moveTo((x + PAD) * S, (z + PAD) * S))); g.stroke()
      g.strokeStyle = '#1fb894'; g.lineWidth = S * 0.3; g.stroke()
    }
    if (target) { g.fillStyle = '#1fb894'; g.strokeStyle = '#fff'; g.lineWidth = S * 0.18; g.beginPath(); g.arc((target.x + PAD) * S, (target.z + PAD) * S, S * 0.45, 0, Math.PI * 2); g.fill(); g.stroke() }
    g.restore()
    // You: an arrow at the middle, pointing the way you look.
    g.save(); g.translate(W / 2, W / 2)
    const a = W * 0.06
    g.fillStyle = v.driving ? '#0f1730' : '#2f6df6'; g.strokeStyle = '#fff'; g.lineWidth = W * 0.016
    g.beginPath(); g.moveTo(0, -a * 1.3); g.lineTo(a * 0.9, a); g.lineTo(0, a * 0.45); g.lineTo(-a * 0.9, a); g.closePath(); g.fill(); g.stroke()
    // North, on the rim.
    const nx = Math.sin(v.yaw), ny = -Math.cos(v.yaw), r = W * 0.41
    g.fillStyle = '#0f1730'; g.beginPath(); g.arc(nx * r, ny * r, W * 0.075, 0, Math.PI * 2); g.fill()
    g.fillStyle = '#fff'; g.font = `700 ${Math.round(W * 0.085)}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('N', nx * r, ny * r + W * 0.004)
    g.restore()
  }
  /* ---- the compass ---- */
  const drawCompass = (v: { x: number; z: number; yaw: number }) => {
    fitCanvas(cc)
    const g = cc.getContext('2d')!, W = cc.width, H = cc.height
    g.clearRect(0, 0, W, H)
    const bearing = ((((-v.yaw * 180) / Math.PI) % 360) + 360) % 360, span = 110, pxDeg = W / span
    g.font = `700 ${Math.round(H * 0.42)}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'
    for (let d = Math.ceil((bearing - span / 2) / 15) * 15; d <= bearing + span / 2; d += 15) {
      const x = W / 2 + (d - bearing) * pxDeg, dd = ((d % 360) + 360) % 360
      const label = ({ 0: 'N', 90: 'E', 180: 'S', 270: 'W', 45: 'NE', 135: 'SE', 225: 'SW', 315: 'NW' } as Record<number, string>)[dd]
      if (label) { g.fillStyle = dd === 0 ? '#2f6df6' : '#0f1730'; g.fillText(label, x, H * 0.52) }
      else { g.fillStyle = '#9aa6bd'; g.fillRect(x - dpr * 0.75, H * 0.36, dpr * 1.5, H * 0.3) }
    }
    // The waypoint's bearing, as a marker on the strip.
    if (target) {
      let b = (Math.atan2(target.x - v.x, -(target.z - v.z)) * 180) / Math.PI - bearing
      b = ((b + 540) % 360) - 180
      const x = W / 2 + Math.max(-span / 2 + 3, Math.min(span / 2 - 3, b)) * pxDeg
      g.fillStyle = '#1fb894'; g.beginPath(); g.moveTo(x, H * 0.1); g.lineTo(x + H * 0.18, H * 0.3); g.lineTo(x, H * 0.5); g.lineTo(x - H * 0.18, H * 0.3); g.closePath(); g.fill()
    }
    g.fillStyle = '#2f6df6'; g.fillRect(W / 2 - dpr, H * 0.78, dpr * 2, H * 0.22)
  }
  /* ---- the district you are in ---- */
  const names = Object.fromEntries(DISTRICTS.map((d) => [d.key, d.name]))
  let shownDistrict = '', pendingDistrict = '', pendingT = 0, hideT = 0
  const say = (title: string, sub = '') => { where.innerHTML = ''; const b = document.createElement('b'); b.textContent = title; where.appendChild(b); if (sub) { const s = document.createElement('small'); s.textContent = sub; where.appendChild(s) } where.dataset.on = 'true'; hideT = 3.5 }

  /* ---- the whole island ---- */
  const big = document.createElement('div'); big.className = 'wkm-big'; big.hidden = true
  big.setAttribute('role', 'dialog'); big.setAttribute('aria-label', 'The island map')
  const sheet = document.createElement('div'); sheet.className = 'wkm-sheet'
  const bc = document.createElement('canvas'); sheet.appendChild(bc)
  const at = (x: number, z: number) => ({ left: `${((x + PAD) / (N + PAD * 2)) * 100}%`, top: `${((z + PAD) / (N + PAD * 2)) * 100}%` })
  for (const d of DISTRICTS) { const el = document.createElement('span'); el.className = 'wkm-dname'; el.textContent = d.name; Object.assign(el.style, at(d.at[0], d.at[1])); sheet.appendChild(el) }
  const pins: HTMLButtonElement[] = []
  for (const b of data.buildings) {
    const gm = data.games[b.slug]; if (!gm) continue
    const pin = document.createElement('button'); pin.type = 'button'; pin.className = 'wkm-pin'; pin.title = gm.title; pin.setAttribute('aria-label', `Go to ${gm.title}`)
    pin.dataset.slug = b.slug
    const x = b.j + b.d / 2, z = b.i + b.w / 2
    Object.assign(pin.style, at(x, z))
    pin.addEventListener('click', () => { setTarget({ x, z, title: gm.title, slug: b.slug }); close() })
    pins.push(pin); sheet.appendChild(pin)
  }
  const bar = document.createElement('div'); bar.className = 'wkm-bar'
  const tip = document.createElement('span'); tip.className = 'wkm-tip'; tip.textContent = 'Choose a game to make for it'
  const clear = document.createElement('button'); clear.type = 'button'; clear.className = 'wkm-btn'; clear.textContent = 'Clear waypoint'; clear.hidden = true
  clear.addEventListener('click', () => { setTarget(null); close() })
  bar.append(tip, clear); sheet.appendChild(bar)
  const closeBtn = document.createElement('button'); closeBtn.type = 'button'; closeBtn.className = 'wkm-btn wkm-close'; closeBtn.textContent = 'Close (M)'
  closeBtn.addEventListener('click', () => close())
  sheet.appendChild(closeBtn)
  big.appendChild(sheet); root.appendChild(big)
  big.addEventListener('click', (e) => { if (e.target === big) close() })
  const drawBig = () => {
    fitCanvas(bc)
    const g = bc.getContext('2d')!, W = bc.width, k = W / size
    g.setTransform(k, 0, 0, k, 0, 0); g.drawImage(base, 0, 0)
    const v = walk.view()
    if (route.length > 1) { g.lineJoin = g.lineCap = 'round'; g.strokeStyle = '#1fb894'; g.lineWidth = S * 0.35; g.beginPath(); route.forEach(([x, z], n) => (n ? g.lineTo((x + PAD) * S, (z + PAD) * S) : g.moveTo((x + PAD) * S, (z + PAD) * S))); g.stroke() }
    // You.
    g.save(); g.translate((v.x + PAD) * S, (v.z + PAD) * S); g.rotate(-v.yaw)
    g.fillStyle = '#2f6df6'; g.strokeStyle = '#fff'; g.lineWidth = S * 0.15
    g.beginPath(); g.moveTo(0, -S * 0.9); g.lineTo(S * 0.6, S * 0.6); g.lineTo(0, S * 0.3); g.lineTo(-S * 0.6, S * 0.6); g.closePath(); g.fill(); g.stroke(); g.restore()
    for (const p of pins) p.dataset.on = String(p.dataset.slug === target?.slug)
    clear.hidden = !target
  }
  let opener: HTMLElement | null = null
  const open = () => { opener = document.activeElement as HTMLElement; big.hidden = false; drawBig(); (pins.find((p) => p.dataset.on === 'true') ?? pins[0])?.focus() }
  const close = () => { big.hidden = true; opener?.focus?.() }
  mini.addEventListener('click', open)
  const setTarget = (t: typeof target) => {
    target = t; walk.setWaypoint(t ? { x: t.x, z: t.z } : null); routeFrom = ''
    if (t) say(t.title, 'Waypoint set')
  }
  addEventListener('keydown', (e) => {
    if ((e.target as HTMLElement)?.closest?.('input, textarea')) return
    if (e.code === 'KeyM') { if (big.hidden) open(); else close() }
    if (e.code === 'Escape' && !big.hidden) close()
  })

  /* ---- each tick ---- */
  let last = performance.now(), raf = 0
  const tick = (now: number) => {
    raf = requestAnimationFrame(tick)
    const dt = Math.min(0.1, (now - last) / 1000); last = now
    const v = walk.view()
    drawMini(v); drawCompass(v)
    // The way there, worked out again as you go.
    routeT -= dt
    const fromKey = `${Math.floor(v.x)},${Math.floor(v.z)}`
    if (target && (fromKey !== routeFrom || routeT <= 0)) { routeFrom = fromKey; routeT = 1; findRoute(v.x, v.z) }
    if (target && route.length) route[0] = [v.x, v.z]
    // Arrived.
    if (target && Math.hypot(target.x - v.x, target.z - v.z) < 0.9) { say(target.title, 'You have arrived'); setTarget(null); route = [] }
    // The district: named once you have been in it a moment.
    const i = Math.floor(v.z), j = Math.floor(v.x)
    const d = kind(i, j) !== '0' ? data.district[i]?.[j] ?? '' : ''
    if (d !== pendingDistrict) { pendingDistrict = d; pendingT = 1.2 }
    if (pendingT > 0 && (pendingT -= dt) <= 0 && d && d !== shownDistrict) { shownDistrict = d; say(names[d] ?? d, target ? `${target.title} · ${Math.round(routeLen() * 9)} m` : '') }
    if (hideT > 0 && (hideT -= dt) <= 0) where.dataset.on = 'false'
    if (!big.hidden) drawBig()
  }
  raf = requestAnimationFrame(tick)
  return {
    /** Hidden (photo mode) or shown. */
    show(on: boolean) { for (const el of [mini, compass, where]) el.style.visibility = on ? '' : 'hidden' },
    dispose() { cancelAnimationFrame(raf); mini.remove(); compass.remove(); where.remove(); big.remove(); style.remove() },
  }
}
