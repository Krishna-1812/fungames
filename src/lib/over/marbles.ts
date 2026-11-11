/**
 * Overstimulated's attention, as something you can hold.
 *
 * The number at the top of the room used to be the only place attention
 * existed. Now every point of it is glass: a marble shot out of the button
 * into a tank along the bottom of the room, where it rolls, knocks into the
 * others and settles. Spending it takes marbles back out.
 *
 * The tank is an abacus, so the picture is exact and never a thousand
 * marbles: ones are mint, tens sky, hundreds violet, thousands rose, ten
 * thousands pearl. Ten of a colour pull together and become one of the next;
 * spending what is not there in small change breaks a big one into ten.
 * However long the game goes on, the tank holds at most nine of each and
 * always adds up to the number on the screen.
 *
 * Physics: position-based (Verlet) circles, four substeps a frame, a grid for
 * neighbours, a glass box with a floor. The pointer pushes marbles it moves
 * through. No library; the engine is the first half of this file.
 */

export type Pt = { x: number; y: number }

type State = 'live' | 'merge' | 'leave'
type Marble = {
  x: number; y: number; px: number; py: number
  r: number; tier: number; a: number
  state: State
  /** For merge and leave: where to, from where, and how far along. */
  to: Pt; from: Pt; t: number; dur: number
  /** Seconds since it was born, for a little pop of scale. */
  age: number
  seed: number
}

export const TIERS = [
  { value: 1, name: 'one', glass: [95, 240, 192], deep: [16, 120, 96] },
  { value: 10, name: 'ten', glass: [86, 184, 255], deep: [14, 72, 160] },
  { value: 100, name: 'hundred', glass: [160, 128, 255], deep: [64, 34, 168] },
  { value: 1000, name: 'thousand', glass: [255, 104, 176], deep: [150, 20, 86] },
  { value: 10000, name: 'ten thousand', glass: [232, 240, 255], deep: [120, 134, 168] },
] as const
const TOP = TIERS.length - 1
const SIZE = [1, 1.22, 1.46, 1.74, 2.05]

type Flash = { x: number; y: number; r: number; t: number; tier: number }

export function createMarbles(o: {
  canvas: HTMLCanvasElement
  /** The tank, in canvas CSS pixels; asked for again on every resize. */
  tank: () => { left: number; right: number; bottom: number; height: number }
  animate: boolean
  /** A marble landed or knocked another; strength 0..1. */
  onClick?: (strength: number, tier: number) => void
  onMerge?: (tier: number) => void
}) {
  const cv = o.canvas
  const ctx = cv.getContext('2d')!
  let W = 1, H = 1, dpr = 1
  let tank = { left: 0, right: 1, bottom: 1, top: 0 }
  let base = 10
  const marbles: Marble[] = []
  const flashes: Flash[] = []
  /** What the tank is worth right now, counting marbles in flight to it. */
  const count = [0, 0, 0, 0, 0]
  let seed = 1
  /** Something was added or taken away since the tank last settled. */
  let unsettled = false

  /* ---------------------------------------------------------------- */
  /* layout                                                           */
  /* ---------------------------------------------------------------- */

  function resize() {
    const b = cv.getBoundingClientRect()
    W = Math.max(1, b.width); H = Math.max(1, b.height)
    dpr = Math.min(2, devicePixelRatio || 1)
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr)
    const t = o.tank()
    const old = tank
    tank = { left: t.left, right: t.right, bottom: t.bottom, top: t.bottom - t.height }
    const nb = Math.max(11, Math.min(24, (tank.right - tank.left) / 40, (tank.bottom - tank.top) / 7))
    // Keep what is already in the tank in the tank: shift and rescale it.
    if (old.right > old.left) {
      const sx = (tank.right - tank.left) / (old.right - old.left)
      for (const m of marbles) {
        const nx = tank.left + (m.x - old.left) * sx, ny = tank.bottom - (old.bottom - m.y) * (nb / base)
        m.px += nx - m.x; m.py += ny - m.y; m.x = nx; m.y = ny
        m.r = nb * SIZE[m.tier]
      }
    }
    base = nb
    sprites.clear()
    draw()
  }

  /* ---------------------------------------------------------------- */
  /* the glass, drawn once per tier and size                          */
  /* ---------------------------------------------------------------- */

  type Sprite = { body: HTMLCanvasElement; swirl: HTMLCanvasElement; gloss: HTMLCanvasElement; s: number }
  const sprites = new Map<string, Sprite>()
  const rgba = (c: readonly number[], a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`

  function sprite(tier: number, r: number): Sprite {
    const key = tier + ':' + Math.round(r * dpr)
    const hit = sprites.get(key)
    if (hit) return hit
    const R = r * dpr, s = Math.ceil(R * 2 + 4), c = s / 2
    const T = TIERS[tier]
    const make = () => { const e = document.createElement('canvas'); e.width = e.height = s; return [e, e.getContext('2d')!] as const }

    // Body: glass that is darker at the rim (Fresnel) and glows low on the far
    // side, where the light that came in at the top left is focused.
    const [body, b] = make()
    let g = b.createRadialGradient(c + R * 0.18, c + R * 0.22, R * 0.05, c, c, R)
    g.addColorStop(0, rgba(T.glass, 0.34))
    g.addColorStop(0.62, rgba(T.glass, 0.5))
    g.addColorStop(0.9, rgba(T.deep, 0.88))
    g.addColorStop(1, rgba(T.deep, 0.98))
    b.fillStyle = g
    b.beginPath(); b.arc(c, c, R, 0, Math.PI * 2); b.fill()

    // Swirl: the twist of coloured glass inside a cat's eye, which rolls with it.
    const [swirl, w] = make()
    w.save()
    w.beginPath(); w.arc(c, c, R * 0.84, 0, Math.PI * 2); w.clip()
    w.translate(c, c)
    // One twisted ribbon through the middle, seen edge-on at the waist and
    // wide at the ends, the way the vane in a cat's eye catches the light.
    const ribbon = (col: string, k: number, blur: number) => {
      w.filter = blur ? `blur(${blur}px)` : 'none'
      w.beginPath()
      w.moveTo(-R * 0.95, -R * 0.42 * k)
      w.bezierCurveTo(-R * 0.4, -R * 0.5 * k, -R * 0.2, R * 0.06, 0, 0)
      w.bezierCurveTo(R * 0.2, -R * 0.06, R * 0.4, R * 0.5 * k, R * 0.95, R * 0.42 * k)
      w.lineTo(R * 0.95, R * 0.12 * k)
      w.bezierCurveTo(R * 0.45, R * 0.18 * k, R * 0.2, -R * 0.02, 0, 0)
      w.bezierCurveTo(-R * 0.2, R * 0.02, -R * 0.45, -R * 0.18 * k, -R * 0.95, -R * 0.12 * k)
      w.closePath()
      w.fillStyle = col; w.fill()
    }
    ribbon(rgba(T.deep, 0.9), 1, R * 0.06)
    ribbon(rgba(T.glass.map((v) => Math.min(255, v + 50)), 0.95), 0.8, 0)
    ribbon('rgba(255,255,255,0.5)', 0.35, R * 0.03)
    w.filter = 'none'
    // A few seed bubbles caught in the glass.
    for (let i = 0; i < 4; i++) {
      const a = i * 2.1 + tier, d = R * (0.3 + 0.12 * i)
      w.fillStyle = 'rgba(255,255,255,0.35)'
      w.beginPath(); w.arc(Math.cos(a) * d, Math.sin(a) * d, R * 0.035, 0, Math.PI * 2); w.fill()
    }
    w.restore()

    // Gloss: what stays put while it rolls. A window of light top left, a
    // smaller second one, the caustic low right, and a thin dark edge.
    const [gloss, k] = make()
    g = k.createRadialGradient(c + R * 0.42, c + R * 0.5, 0, c + R * 0.42, c + R * 0.5, R * 0.5)
    g.addColorStop(0, rgba(T.glass.map((v) => Math.min(255, v + 90)), 0.75))
    g.addColorStop(1, rgba(T.glass, 0))
    k.fillStyle = g
    k.beginPath(); k.arc(c, c, R, 0, Math.PI * 2); k.fill()
    k.save()
    k.translate(c - R * 0.36, c - R * 0.42); k.rotate(-0.6)
    g = k.createRadialGradient(0, 0, 0, 0, 0, R * 0.34)
    g.addColorStop(0, 'rgba(255,255,255,0.95)')
    g.addColorStop(0.5, 'rgba(255,255,255,0.5)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    k.fillStyle = g
    k.scale(1, 0.62)
    k.beginPath(); k.arc(0, 0, R * 0.34, 0, Math.PI * 2); k.fill()
    k.restore()
    k.fillStyle = 'rgba(255,255,255,0.7)'
    k.beginPath(); k.arc(c + R * 0.12, c - R * 0.6, R * 0.07, 0, Math.PI * 2); k.fill()
    k.strokeStyle = rgba(T.deep, 0.55)
    k.lineWidth = Math.max(1, R * 0.06)
    k.beginPath(); k.arc(c, c, R - k.lineWidth / 2, 0, Math.PI * 2); k.stroke()

    const out = { body, swirl, gloss, s }
    sprites.set(key, out)
    return out
  }

  /* ---------------------------------------------------------------- */
  /* bookkeeping: what is in the tank against what should be           */
  /* ---------------------------------------------------------------- */

  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }

  function birth(tier: number, x: number, y: number, vx = 0, vy = 0): Marble {
    const r = base * SIZE[tier]
    // Verlet keeps velocity as the last substep's movement: four substeps a 60 Hz frame.
    const m: Marble = { x, y, px: x - vx / 240, py: y - vy / 240, r, tier, a: rnd() * 6.28, state: 'live', to: { x, y }, from: { x, y }, t: 0, dur: 0, age: 0, seed: rnd() }
    marbles.push(m)
    count[tier]++
    unsettled = true
    return m
  }

  /** Throw a new marble from a point so it lands somewhere along the tank. */
  function throwFrom(tier: number, from: Pt) {
    const r = base * SIZE[tier]
    const tx = tank.left + r + rnd() * (tank.right - tank.left - 2 * r), ty = tank.top
    const g = gravity()
    const T = 0.5 + rnd() * 0.25
    const vx = (tx - from.x) / T, vy = (ty - from.y - 0.5 * g * T * T) / T
    const m = birth(tier, from.x, from.y, vx, vy)
    if (!o.animate) settleNear(m)
  }

  function settleNear(m: Marble) {
    m.x = m.px = tank.left + m.r + rnd() * (tank.right - tank.left - 2 * m.r)
    m.y = m.py = tank.top + rnd() * (tank.bottom - tank.top - m.r)
  }

  const live = (tier: number) => marbles.filter((m) => m.state === 'live' && m.tier === tier)

  /** Ten of a tier pull together into one of the next. */
  function merge(tier: number) {
    const ms = live(tier)
    if (ms.length < 10) return false
    // The ten closest to the one lowest in the tank, so they gather visibly.
    const anchor = ms.reduce((a, b) => (b.y > a.y ? b : a))
    ms.sort((a, b) => Math.hypot(a.x - anchor.x, a.y - anchor.y) - Math.hypot(b.x - anchor.x, b.y - anchor.y))
    const ten = ms.slice(0, 10)
    const cx = ten.reduce((s, m) => s + m.x, 0) / 10, cy = Math.min(tank.bottom - base * SIZE[tier + 1], ten.reduce((s, m) => s + m.y, 0) / 10)
    for (const m of ten) { m.state = 'merge'; m.from = { x: m.x, y: m.y }; m.to = { x: cx, y: cy }; m.t = 0; m.dur = 0.36; count[tier]-- }
    const n = birth(tier + 1, cx, cy)
    n.age = -0.36 // appears when the ten arrive
    if (!o.animate) { for (const m of ten) m.t = m.dur; n.age = 1 }
    return true
  }

  /** One of a tier breaks into ten of the one below. */
  function shatter(tier: number) {
    const ms = live(tier)
    if (!ms.length || tier === 0) return false
    const m = ms[(rnd() * ms.length) | 0]
    marbles.splice(marbles.indexOf(m), 1)
    count[tier]--
    flashes.push({ x: m.x, y: m.y, r: m.r, t: 0, tier })
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2
      const k = birth(tier - 1, m.x + Math.cos(a) * m.r * 0.5, m.y + Math.sin(a) * m.r * 0.5, Math.cos(a) * 240, Math.sin(a) * 240 - 160)
      if (!o.animate) settleNear(k)
    }
    return true
  }

  /** A marble leaves the tank for a point (a shop card). */
  function leave(tier: number, to: Pt) {
    const ms = live(tier)
    if (!ms.length) return false
    // The ones on top go first, because that is what you would pick up.
    const m = ms.reduce((a, b) => (b.y < a.y ? b : a))
    m.state = 'leave'; m.from = { x: m.x, y: m.y }; m.to = to; m.t = 0; m.dur = 0.5 + rnd() * 0.15
    count[tier]--
    if (!o.animate) m.t = m.dur
    return true
  }

  const worth = () => count.reduce((s, n, t) => s + n * TIERS[t].value, 0)

  /**
   * Make the tank worth `value`. New marbles come from `from`; marbles that go
   * fly to `to`. Then carry, so no colour has more than nine.
   */
  function sync(value: number, from: Pt, to: Pt) {
    value = Math.max(0, Math.floor(value))
    let d = value - worth()
    if (d > 0) {
      // Largest first so a big income arrives as a few marbles, not hundreds.
      for (let t = TOP; t >= 0; t--) {
        let n = Math.floor(d / TIERS[t].value)
        if (t < TOP) n = Math.min(n, 30)
        d -= n * TIERS[t].value
        for (let i = 0; i < n; i++) throwFrom(t, from)
      }
    } else if (d < 0) {
      let r = -d
      let guard = 0
      while (r > 0 && guard++ < 200) {
        let took = false
        for (let t = TOP; t >= 0; t--) {
          while (r >= TIERS[t].value && count[t] > 0 && live(t).length) { leave(t, to); r -= TIERS[t].value; took = true }
        }
        if (r > 0 && !took) {
          // Nothing small enough: break the smallest marble that is bigger.
          let t = 0
          while (t <= TOP && (TIERS[t].value <= r || !live(t).length)) t++
          if (t > TOP) break
          shatter(t)
        }
      }
    }
    for (let t = 0; t < TOP; t++) while (live(t).length >= 10) merge(t)
  }

  /* ---------------------------------------------------------------- */
  /* physics                                                          */
  /* ---------------------------------------------------------------- */

  const gravity = () => Math.max(1400, H * 3.4)
  const pointer = { x: -1e4, y: -1e4, px: -1e4, py: -1e4, on: false }
  let ticksSince = 0

  function step(dt: number) {
    const g = gravity()
    const SUB = 4, h = dt / SUB
    const lw = tank.left, rw = tank.right, fl = tank.bottom
    for (let s = 0; s < SUB; s++) {
      for (const m of marbles) {
        if (m.state !== 'live' || m.age < 0) continue
        let vx = (m.x - m.px) * 0.999, vy = (m.y - m.py) * 0.999
        // Nothing moves faster than a hard throw: a deep overlap corrected in
        // one step must not turn into a launch.
        const sp = Math.hypot(vx, vy), cap = 2600 * h
        if (sp > cap) { vx *= cap / sp; vy *= cap / sp }
        m.px = m.x; m.py = m.y
        m.x += vx; m.y += vy + g * h * h
      }
      // Neighbours, through a grid of cells one big marble across.
      const cell = base * SIZE[TOP] * 2
      const grid = new Map<number, Marble[]>()
      for (const m of marbles) {
        if (m.state !== 'live' || m.age < 0) continue
        const k = ((m.x / cell) | 0) * 4099 + ((m.y / cell) | 0)
        let l = grid.get(k)
        if (!l) grid.set(k, (l = []))
        l.push(m)
      }
      for (const m of marbles) {
        if (m.state !== 'live' || m.age < 0) continue
        const cx = (m.x / cell) | 0, cy = (m.y / cell) | 0
        for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
          const l = grid.get((cx + i) * 4099 + cy + j)
          if (!l) continue
          for (const n of l) {
            if (n === m || n.seed < m.seed) continue
            // Two marbles still in the air pass by each other: they were thrown
            // together from one place and would only burst apart.
            if (m.y + m.r < tank.top && n.y + n.r < tank.top) continue
            const dx = n.x - m.x, dy = n.y - m.y, rr = m.r + n.r
            const d2 = dx * dx + dy * dy
            if (d2 >= rr * rr || d2 < 1e-6) continue
            const d = Math.sqrt(d2), push = Math.min(rr - d, m.r * 0.5) / d
            const wm = (n.r * n.r) / (m.r * m.r + n.r * n.r), wn = 1 - wm
            const knock = Math.abs((n.x - n.px - (m.x - m.px)) * dx + (n.y - n.py - (m.y - m.py)) * dy) / d / h
            m.x -= dx * push * wm; m.y -= dy * push * wm
            n.x += dx * push * wn; n.y += dy * push * wn
            if (knock > 260 && s === 0) click(Math.min(1, knock / 1600), Math.max(m.tier, n.tier))
          }
        }
      }
      for (const m of marbles) {
        if (m.state !== 'live') continue
        // The glass walls only matter once it is down inside the tank.
        if (m.y + m.r > tank.top - base) {
          if (m.x - m.r < lw) { const v = m.x - m.px; m.x = lw + m.r; m.px = m.x + v * 0.4 }
          if (m.x + m.r > rw) { const v = m.x - m.px; m.x = rw - m.r; m.px = m.x + v * 0.4 }
        }
        if (m.y + m.r > fl) {
          const vy = m.y - m.py, vx = m.x - m.px
          m.y = fl - m.r
          // A little bounce, and the floor's grip turns sliding into rolling.
          m.py = m.y + vy * 0.32
          m.px = m.x - vx * 0.92
          if (vy / h > 300 && s === 0) click(Math.min(1, vy / h / 2200), m.tier)
        }
        // Anything shot past the room comes back down rather than vanishing.
        if (m.x < m.r) m.x = m.r
        if (m.x > W - m.r) m.x = W - m.r
      }
      // The pointer is a hand moving through the tank.
      if (pointer.on) {
        const pvx = (pointer.x - pointer.px) / SUB, pvy = (pointer.y - pointer.py) / SUB
        for (const m of marbles) {
          if (m.state !== 'live') continue
          const dx = m.x - pointer.x, dy = m.y - pointer.y, rr = m.r + 16
          const d = Math.hypot(dx, dy)
          if (d >= rr || d < 1e-3) continue
          m.x += (dx / d) * (rr - d) * 0.5 + pvx * 0.6
          m.y += (dy / d) * (rr - d) * 0.5 + pvy * 0.6
        }
      }
    }
    pointer.px = pointer.x; pointer.py = pointer.y
    for (const m of marbles) {
      // A marble made by a merge appears when the ten that made it arrive.
      if (m.age < 0 && m.age + dt >= 0) { o.onMerge?.(m.tier); flashes.push({ x: m.x, y: m.y, r: m.r, t: 0, tier: m.tier }) }
      m.age += dt
      if (m.state === 'live') m.a += (m.x - m.px) / m.r
      else m.t += dt
    }
    // Arrived: merged ones and spent ones go.
    for (let i = marbles.length - 1; i >= 0; i--) {
      const m = marbles[i]
      if (m.state !== 'live' && m.t >= m.dur) {
        marbles.splice(i, 1)
      }
    }
    for (let i = flashes.length - 1; i >= 0; i--) { flashes[i].t += dt; if (flashes[i].t > 0.45) flashes.splice(i, 1) }
    ticksSince += dt
  }

  let lastClick = 0
  function click(k: number, tier: number) {
    const now = performance.now()
    if (now - lastClick < 28) return
    lastClick = now
    o.onClick?.(k, tier)
  }

  /* ---------------------------------------------------------------- */
  /* drawing                                                          */
  /* ---------------------------------------------------------------- */

  const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3)

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, W, H)
    const L = tank.left, R = tank.right, B = tank.bottom, T = tank.top
    const lip = Math.max(8, base * 0.9)

    /* back of the tank: a darker pane with the room seen dimly through it */
    let g = ctx.createLinearGradient(0, T, 0, B)
    g.addColorStop(0, 'rgba(160,190,255,0.03)')
    g.addColorStop(1, 'rgba(120,150,230,0.10)')
    ctx.fillStyle = g
    ctx.fillRect(L, T, R - L, B - T)
    // The floor of the tank, lit from the front.
    g = ctx.createLinearGradient(0, B - lip, 0, B)
    g.addColorStop(0, 'rgba(10,4,20,0)')
    g.addColorStop(1, 'rgba(10,4,20,0.5)')
    ctx.fillStyle = g
    ctx.fillRect(L, B - lip, R - L, lip)

    /* shadows, all first, so no marble's shadow lands on another marble */
    for (const m of marbles) {
      if (m.state === 'leave') continue
      const above = B - (m.y + m.r)
      const k = Math.max(0, 1 - above / (m.r * 6))
      if (k <= 0) continue
      ctx.fillStyle = `rgba(4,0,12,${0.42 * k})`
      ctx.beginPath()
      ctx.ellipse(m.x + m.r * 0.15, B - 1, m.r * (0.9 + 0.3 * (1 - k)), m.r * 0.22, 0, 0, Math.PI * 2)
      ctx.fill()
    }

    /* the marbles */
    for (const m of marbles) {
      let x = m.x, y = m.y, sc = 1, al = 1
      if (m.state !== 'live') {
        const e = ease(m.t / m.dur)
        x = m.from.x + (m.to.x - m.from.x) * e
        y = m.from.y + (m.to.y - m.from.y) * e - (m.state === 'leave' ? Math.sin(e * Math.PI) * 60 : 0)
        sc = m.state === 'merge' ? 1 - e * 0.7 : 1 - e * 0.55
        al = m.state === 'merge' ? 1 - e * 0.4 : 1 - e * e
      } else if (m.age < 0) continue
      else if (m.age < 0.22) sc = 0.6 + 0.4 * Math.sin((m.age / 0.22) * Math.PI * 0.5) + Math.sin((m.age / 0.22) * Math.PI) * 0.12
      const sp = sprite(m.tier, m.r)
      const d = (sp.s / dpr) * sc
      ctx.globalAlpha = al
      ctx.drawImage(sp.body, x - d / 2, y - d / 2, d, d)
      ctx.save()
      ctx.translate(x, y); ctx.rotate(m.a)
      ctx.drawImage(sp.swirl, -d / 2, -d / 2, d, d)
      ctx.restore()
      ctx.drawImage(sp.gloss, x - d / 2, y - d / 2, d, d)
    }
    ctx.globalAlpha = 1

    /* a ring of light where something merged or broke */
    for (const f of flashes) {
      const u = f.t / 0.45
      ctx.strokeStyle = rgba(TIERS[f.tier].glass, 0.8 * (1 - u))
      ctx.lineWidth = 3 * (1 - u) + 0.5
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1 + u * 1.6), 0, Math.PI * 2); ctx.stroke()
    }
    for (const m of marbles) if (m.state === 'live' && m.age >= 0 && m.age < 0.3 && m.tier > 0 && m.r > base * 1.2) {
      const u = m.age / 0.3
      ctx.strokeStyle = rgba(TIERS[m.tier].glass, 0.7 * (1 - u))
      ctx.lineWidth = 2
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r * (1 + u), 0, Math.PI * 2); ctx.stroke()
    }

    /* the front pane: edge highlights, a long reflection, the thick glass at the bottom */
    ctx.strokeStyle = 'rgba(220,230,255,0.22)'
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.moveTo(L, T); ctx.lineTo(L, B); ctx.lineTo(R, B); ctx.lineTo(R, T)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(220,230,255,0.38)'
    ctx.beginPath(); ctx.moveTo(L - 2, T); ctx.lineTo(L + 6, T); ctx.moveTo(R - 6, T); ctx.lineTo(R + 2, T); ctx.stroke()
    g = ctx.createLinearGradient(L, 0, R, 0)
    g.addColorStop(0, 'rgba(255,255,255,0)')
    g.addColorStop(0.07, 'rgba(255,255,255,0.07)')
    g.addColorStop(0.1, 'rgba(255,255,255,0)')
    g.addColorStop(0.62, 'rgba(255,255,255,0)')
    g.addColorStop(0.7, 'rgba(255,255,255,0.05)')
    g.addColorStop(0.74, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(L, T, R - L, B - T)
    g = ctx.createLinearGradient(0, B, 0, B + lip * 0.7)
    g.addColorStop(0, 'rgba(190,210,255,0.36)')
    g.addColorStop(0.25, 'rgba(120,150,220,0.2)')
    g.addColorStop(1, 'rgba(60,80,140,0.08)')
    ctx.fillStyle = g
    ctx.fillRect(L - 2, B, R - L + 4, lip * 0.7)
  }

  /* ---------------------------------------------------------------- */
  /* running                                                          */
  /* ---------------------------------------------------------------- */

  const onMove = (e: PointerEvent) => {
    const b = cv.getBoundingClientRect()
    pointer.x = e.clientX - b.left; pointer.y = e.clientY - b.top
    if (!pointer.on) { pointer.px = pointer.x; pointer.py = pointer.y }
    pointer.on = pointer.y > tank.top - 40 && pointer.x > tank.left - 20 && pointer.x < tank.right + 20
  }
  addEventListener('pointermove', onMove, { passive: true })
  const ro = new ResizeObserver(resize)
  ro.observe(cv)
  resize()

  return {
    sync,
    /** Advance the physics and redraw. Under reduced motion it settles at once. */
    frame(dt: number) {
      if (!o.animate) {
        // Run the physics to rest off-screen and show only where it ends up.
        if (!unsettled) return
        unsettled = false
        let n = 0
        while (n++ < 600 && (n < 60 || marbles.some((m) => m.state === 'live' && Math.hypot(m.x - m.px, m.y - m.py) > 0.05))) step(1 / 60)
        // Nothing in flight under reduced motion.
        for (let i = marbles.length - 1; i >= 0; i--) if (marbles[i].state !== 'live') marbles.splice(i, 1)
        flashes.length = 0
        draw()
        return
      }
      step(Math.min(1 / 30, dt))
      draw()
    },
    /** Everything that should be worth looking at is still. */
    get still() { return marbles.every((m) => m.state === 'live' && Math.hypot(m.x - m.px, m.y - m.py) < 0.05) && !flashes.length },
    get worth() { return worth() },
    counts: () => [...count],
    /** For looking at from a console. */
    list: () => marbles.map((m) => ({ x: Math.round(m.x), y: Math.round(m.y), r: Math.round(m.r), tier: m.tier, state: m.state, age: +m.age.toFixed(2) })),
    get box() { return { ...tank, W, H } },
    dispose() { ro.disconnect(); removeEventListener('pointermove', onMove) },
  }
}

export type Marbles = ReturnType<typeof createMarbles>
