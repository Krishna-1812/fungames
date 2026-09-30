/**
 * The homepage's motion: the night sky behind the hero, the ring of games,
 * the title that thickens under the pointer, the two marquees, the tilting
 * cards, the magnetic buttons and the Surprise Me reel.
 *
 * Every effect takes PLAY from lib/motion and, without it, paints its
 * finished state once and stops: the sky is a still field of stars, the ring
 * faces its first game, the marquees stand still and nothing tilts. Anything
 * that runs every frame also stops while it is off screen or the tab is
 * hidden, so the page costs nothing once you have scrolled into the games.
 */
import { PLAY } from './motion'

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
const FINE = matchMedia('(hover: hover) and (pointer: fine)').matches

/** Run `frame(dt)` every animation frame while `el` is on screen and the tab
 *  is visible. `frame` returns false to say it has nothing left to do; the
 *  loop then sleeps until `wake()` is called. */
function loop(el: Element, frame: (dt: number) => boolean | void) {
  let seen = false
  let running = false
  let last = 0
  const tick = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    const more = frame(dt)
    if (seen && !document.hidden && more !== false) requestAnimationFrame(tick)
    else running = false
  }
  const wake = () => {
    if (running || !seen || document.hidden) return
    running = true
    last = performance.now()
    requestAnimationFrame(tick)
  }
  new IntersectionObserver(([e]) => { seen = e.isIntersecting; wake() }).observe(el)
  document.addEventListener('visibilitychange', wake)
  return wake
}

/* ------------------------------------------------------------------------ */
/* The sky: stars in three depths, a constellation around the pointer,      */
/* and the odd shooting star                                                 */
/* ------------------------------------------------------------------------ */

type Star = { x: number; y: number; z: number; r: number; tw: number; sp: number; c: string }
type Streak = { x: number; y: number; vx: number; vy: number; life: number }

const STAR_INKS = ['#ffffff', '#ffffff', '#dfe8ff', '#8ccbff', '#b8a1ff', '#4fe3c1']

export function initSky(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  let w = 0
  let h = 0
  let stars: Star[] = []
  const streaks: Streak[] = []
  // Pointer in canvas pixels, eased so the parallax glides after it.
  const mouse = { x: -9999, y: -9999, tx: -9999, ty: -9999, px: 0, py: 0, tpx: 0, tpy: 0 }
  let t = 0
  let nextStreak = 2.5

  // A fixed seed, so the sky is the same sky on every visit.
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)

  const size = () => {
    const dpr = Math.min(2, devicePixelRatio || 1)
    const r = canvas.getBoundingClientRect()
    w = r.width
    h = r.height
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    seed = 7
    const n = clamp(Math.round((w * h) / 4200), 90, 300)
    stars = Array.from({ length: n }, () => {
      const z = rnd() ** 1.8
      return {
        x: rnd() * w,
        y: rnd() * h,
        z,
        r: 0.35 + z * 1.5,
        tw: rnd() * Math.PI * 2,
        sp: 0.6 + rnd() * 1.8,
        c: STAR_INKS[Math.floor(rnd() * STAR_INKS.length)],
      }
    })
  }

  const draw = () => {
    ctx.clearRect(0, 0, w, h)
    const near: { x: number; y: number }[] = []
    for (const s of stars) {
      const x = s.x + mouse.px * (0.2 + s.z) * 26
      const y = s.y + mouse.py * (0.2 + s.z) * 18 - ((t * (4 + s.z * 10)) % (h + 20))
      const yy = ((y % (h + 20)) + h + 20) % (h + 20) - 10
      const a = PLAY ? 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * s.sp + s.tw)) : 0.8
      ctx.globalAlpha = a * (0.35 + s.z * 0.65)
      ctx.fillStyle = s.c
      ctx.beginPath()
      ctx.arc(x, yy, s.r, 0, Math.PI * 2)
      ctx.fill()
      if (s.z > 0.55) {
        // The bright ones get a soft halo.
        ctx.globalAlpha = a * 0.12
        ctx.beginPath()
        ctx.arc(x, yy, s.r * 4, 0, Math.PI * 2)
        ctx.fill()
      }
      const dx = x - mouse.x
      const dy = yy - mouse.y
      if (dx * dx + dy * dy < 170 * 170) near.push({ x, y: yy })
    }
    // A constellation drawn between the stars nearest the pointer.
    ctx.lineWidth = 1
    for (let i = 0; i < near.length; i++) {
      for (let j = i + 1; j < near.length; j++) {
        const dx = near[i].x - near[j].x
        const dy = near[i].y - near[j].y
        const d = Math.hypot(dx, dy)
        if (d > 95) continue
        const fromMouse = Math.hypot(near[i].x - mouse.x, near[i].y - mouse.y)
        ctx.globalAlpha = (1 - d / 95) * (1 - fromMouse / 170) * 0.55
        ctx.strokeStyle = '#8ccbff'
        ctx.beginPath()
        ctx.moveTo(near[i].x, near[i].y)
        ctx.lineTo(near[j].x, near[j].y)
        ctx.stroke()
      }
    }
    for (const s of streaks) {
      const len = 110
      const k = Math.hypot(s.vx, s.vy)
      const g = ctx.createLinearGradient(s.x, s.y, s.x - (s.vx / k) * len, s.y - (s.vy / k) * len)
      const a = Math.sin(Math.min(1, s.life) * Math.PI)
      g.addColorStop(0, `rgba(255,255,255,${0.9 * a})`)
      g.addColorStop(1, 'rgba(140,203,255,0)')
      ctx.globalAlpha = 1
      ctx.strokeStyle = g
      ctx.lineWidth = 1.6
      ctx.beginPath()
      ctx.moveTo(s.x, s.y)
      ctx.lineTo(s.x - (s.vx / k) * len, s.y - (s.vy / k) * len)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }

  size()
  new ResizeObserver(() => { size(); if (!PLAY) draw() }).observe(canvas)
  if (!PLAY) { draw(); return }

  const host = canvas.parentElement!
  host.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect()
    mouse.tx = e.clientX - r.left
    mouse.ty = e.clientY - r.top
    mouse.tpx = (e.clientX - r.left) / r.width - 0.5
    mouse.tpy = (e.clientY - r.top) / r.height - 0.5
  }, { passive: true })
  host.addEventListener('pointerleave', () => { mouse.tx = mouse.ty = -9999; mouse.tpx = mouse.tpy = 0 })

  loop(canvas, (dt) => {
    t += dt
    mouse.px += (mouse.tpx - mouse.px) * 0.05
    mouse.py += (mouse.tpy - mouse.py) * 0.05
    if (mouse.tx < -999) { mouse.x = mouse.tx; mouse.y = mouse.ty }
    else if (mouse.x < -999) { mouse.x = mouse.tx; mouse.y = mouse.ty }
    else { mouse.x += (mouse.tx - mouse.x) * 0.2; mouse.y += (mouse.ty - mouse.y) * 0.2 }
    nextStreak -= dt
    if (nextStreak <= 0) {
      nextStreak = 3 + Math.random() * 5
      const fromLeft = Math.random() < 0.5
      streaks.push({
        x: fromLeft ? Math.random() * w * 0.5 : w * 0.5 + Math.random() * w * 0.5,
        y: Math.random() * h * 0.35,
        vx: (fromLeft ? 1 : -1) * (520 + Math.random() * 300),
        vy: 200 + Math.random() * 140,
        life: 0,
      })
    }
    for (let i = streaks.length - 1; i >= 0; i--) {
      const s = streaks[i]
      s.x += s.vx * dt
      s.y += s.vy * dt
      s.life += dt * 1.4
      if (s.life >= 1) streaks.splice(i, 1)
    }
    draw()
  })
}

/* ------------------------------------------------------------------------ */
/* The ring of games                                                        */
/* ------------------------------------------------------------------------ */

/**
 * Cards stand round a circle and the circle turns. Drag it to spin it (it
 * keeps some of your throw), hover to slow it, and tab onto a card to bring
 * that one round to the front. `onFront` hears which card is facing you
 * whenever that changes.
 */
export function initRing(wrap: HTMLElement, onFront: (i: number) => void) {
  const ring = wrap.querySelector<HTMLElement>('.h-ring')!
  const cards = Array.from(ring.querySelectorAll<HTMLElement>('.h-rc'))
  const n = cards.length
  const step = 360 / n
  const AUTO = -9 // degrees a second
  let spin = 0
  let vel = AUTO
  let slow = 1
  let target: number | null = null
  let front = -1

  const paint = () => {
    ring.style.setProperty('--spin', `${spin.toFixed(2)}deg`)
    let best = 0
    let bestF = -2
    cards.forEach((c, k) => {
      const f = Math.cos(((k * step + spin) * Math.PI) / 180)
      const lit = (f + 1) / 2
      c.style.opacity = (0.18 + 0.82 * lit ** 1.6).toFixed(3)
      c.style.setProperty('--lit', lit.toFixed(3))
      c.classList.toggle('is-back', f < 0.2)
      if (f > bestF) { bestF = f; best = k }
    })
    if (best !== front) {
      front = best
      cards.forEach((c, k) => c.classList.toggle('is-front', k === best))
      onFront(best)
    }
  }
  paint()

  // Bring card k round the short way, from any focus: keyboard or not.
  const face = (k: number) => {
    const want = -k * step
    const d = ((((want - spin) % 360) + 540) % 360) - 180
    target = spin + d
  }
  cards.forEach((c, k) => c.addEventListener('focus', () => { face(k); if (!PLAY) { spin = target!; target = null; paint() } }))
  if (!PLAY) return

  let dragging = false
  let moved = 0
  let lastX = 0
  let lastT = 0
  wrap.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return
    dragging = true
    moved = 0
    lastX = e.clientX
    lastT = performance.now()
    target = null
    vel = 0
    wrap.setPointerCapture(e.pointerId)
    wrap.classList.add('is-dragging')
    wake()
  })
  wrap.addEventListener('pointermove', (e) => {
    if (!dragging) return
    const now = performance.now()
    const dx = e.clientX - lastX
    moved += Math.abs(dx)
    const d = dx * 0.32
    spin += d
    vel = clamp((d / Math.max(8, now - lastT)) * 1000, -520, 520)
    lastX = e.clientX
    lastT = now
    paint()
  })
  const release = () => {
    if (!dragging) return
    dragging = false
    wrap.classList.remove('is-dragging')
    wake()
  }
  wrap.addEventListener('pointerup', release)
  wrap.addEventListener('pointercancel', release)
  // A drag is not a click on whichever card it ended over.
  wrap.addEventListener('click', (e) => { if (moved > 6) { e.preventDefault(); moved = 0 } }, true)
  wrap.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') slow = 0.18 })
  wrap.addEventListener('pointerleave', () => { slow = 1 })

  const wake = loop(wrap, (dt) => {
    if (dragging) return true
    if (target !== null) {
      spin += (target - spin) * Math.min(1, dt * 7)
      if (Math.abs(target - spin) < 0.05) { spin = target; target = null; vel = 0 }
    } else {
      vel += (AUTO * slow - vel) * Math.min(1, dt * 1.6)
      spin += vel * dt
    }
    spin = ((spin % 360) + 360) % 360
    if (target !== null) target = spin + ((((target - spin) % 360) + 540) % 360) - 180
    paint()
    return true
  })
  cards.forEach((c) => c.addEventListener('focus', wake))
}

/* ------------------------------------------------------------------------ */
/* The title: letters thicken under the pointer, and a wave runs through    */
/* ------------------------------------------------------------------------ */

/**
 * Fraunces is a variable font, so weight is a number the page can animate.
 * Each letter eases towards 900 as the pointer nears it and back to its
 * resting weight as it leaves; on load, and whenever the title is clicked, a
 * swell of weight runs through the letters left to right.
 */
export function initTitle(title: HTMLElement) {
  if (!PLAY) return
  const letters = Array.from(title.querySelectorAll<HTMLElement>('.ch'))
  const rest = 600
  const cur = letters.map(() => rest)
  let centres: { x: number; y: number }[] = []
  let mx = -9999
  let my = -9999
  let waveAt = -1
  let settled = true

  const measure = () => {
    centres = letters.map((l) => {
      const r = l.getBoundingClientRect()
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    })
  }
  const wake = loop(title, (dt) => {
    if (waveAt >= 0) waveAt += dt
    settled = true
    letters.forEach((l, i) => {
      let want = rest
      if (FINE && mx > -999) {
        const c = centres[i]
        const d = Math.hypot(c.x - mx, (c.y - my) * 1.4)
        want = Math.max(want, rest + 300 * Math.max(0, 1 - d / 190) ** 1.4)
      }
      if (waveAt >= 0) {
        // A bump of weight centred on a moving letter index.
        const front = waveAt * 22 - 3
        want = Math.max(want, rest + 300 * Math.exp(-((i - front) ** 2) / 5))
      }
      cur[i] += (want - cur[i]) * Math.min(1, dt * 10)
      if (Math.abs(cur[i] - want) > 0.5 || want !== rest) settled = false
      l.style.fontWeight = cur[i].toFixed(0)
    })
    if (waveAt > (letters.length + 6) / 22) waveAt = -1
    return !(settled && waveAt < 0)
  })
  const run = () => { waveAt = 0; measure(); wake() }
  title.addEventListener('click', run)
  // After the letters have risen into place.
  setTimeout(run, 1500)
  if (FINE) {
    const host = title.closest('section') ?? title
    host.addEventListener('pointermove', (e) => {
      if (!centres.length) measure()
      mx = e.clientX
      my = e.clientY
      wake()
    }, { passive: true })
    host.addEventListener('pointerleave', () => { mx = my = -9999; wake() })
    addEventListener('scroll', () => { centres = [] }, { passive: true })
    addEventListener('resize', () => { centres = [] }, { passive: true })
  }
}

/* ------------------------------------------------------------------------ */
/* Marquees, sped up by the scroll                                           */
/* ------------------------------------------------------------------------ */

export function initMarquee(host: HTMLElement) {
  if (!PLAY) return
  const rows = Array.from(host.querySelectorAll<HTMLElement>('[data-dir]')).map((row) => ({
    track: row.firstElementChild as HTMLElement,
    dir: Number(row.dataset.dir),
    x: 0,
    half: 0,
  }))
  const measure = () => rows.forEach((r) => { r.half = r.track.scrollWidth / 2 })
  measure()
  addEventListener('resize', measure, { passive: true })
  let boost = 0
  let lastY = scrollY
  addEventListener('scroll', () => {
    boost = clamp(boost + Math.abs(scrollY - lastY) * 0.9, 0, 900)
    lastY = scrollY
  }, { passive: true })
  loop(host, (dt) => {
    boost *= Math.pow(0.04, dt)
    const speed = 46 + boost
    for (const r of rows) {
      if (!r.half) continue
      // Each track holds its titles twice; slide one copy's width and wrap.
      r.x = (r.x + speed * dt) % r.half
      const x = r.dir < 0 ? -r.x : r.x - r.half
      const skew = clamp(boost * 0.012, 0, 8) * -r.dir
      r.track.style.transform = `translate3d(${x.toFixed(1)}px,0,0) skewX(${skew.toFixed(2)}deg)`
    }
  })
}

/* ------------------------------------------------------------------------ */
/* Cards that tilt towards the pointer, with a glare that follows it        */
/* ------------------------------------------------------------------------ */

export function initTilt(cards: HTMLElement[]) {
  if (!PLAY || !FINE) return
  for (const card of cards) {
    let queued = false
    let px = 0.5
    let py = 0.5
    const frame = () => {
      queued = false
      card.style.setProperty('--rx', `${((0.5 - py) * 9).toFixed(2)}deg`)
      card.style.setProperty('--ry', `${((px - 0.5) * 11).toFixed(2)}deg`)
      card.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`)
      card.style.setProperty('--my', `${(py * 100).toFixed(1)}%`)
    }
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect()
      px = clamp((e.clientX - r.left) / r.width, 0, 1)
      py = clamp((e.clientY - r.top) / r.height, 0, 1)
      card.classList.add('is-tilting')
      if (!queued) { queued = true; requestAnimationFrame(frame) }
    })
    card.addEventListener('pointerleave', () => {
      card.classList.remove('is-tilting')
      px = py = 0.5
      frame()
    })
  }
}

/* ------------------------------------------------------------------------ */
/* Buttons that lean towards the pointer                                     */
/* ------------------------------------------------------------------------ */

export function initMagnets(els: HTMLElement[]) {
  if (!PLAY || !FINE) return
  for (const el of els) {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect()
      const x = e.clientX - (r.left + r.width / 2)
      const y = e.clientY - (r.top + r.height / 2)
      el.style.translate = `${(x * 0.22).toFixed(1)}px ${(y * 0.3).toFixed(1)}px`
    })
    el.addEventListener('pointerleave', () => { el.style.translate = '' })
  }
}

/* ------------------------------------------------------------------------ */
/* A soft light that follows the pointer round the page                     */
/* ------------------------------------------------------------------------ */

export function initGlow(el: HTMLElement) {
  if (!PLAY || !FINE) return
  let x = innerWidth / 2
  let y = innerHeight / 3
  let tx = x
  let ty = y
  let running = false
  const tick = () => {
    x += (tx - x) * 0.14
    y += (ty - y) * 0.14
    el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
    if (Math.abs(tx - x) + Math.abs(ty - y) > 0.5 && !document.hidden) requestAnimationFrame(tick)
    else running = false
  }
  addEventListener('pointermove', (e) => {
    tx = e.clientX
    ty = e.clientY
    el.classList.add('is-on')
    if (!running) { running = true; requestAnimationFrame(tick) }
  }, { passive: true })
  document.documentElement.addEventListener('pointerleave', () => el.classList.remove('is-on'))
}

/* ------------------------------------------------------------------------ */
/* The Surprise Me reel                                                     */
/* ------------------------------------------------------------------------ */

/**
 * A one-armed bandit of game titles. It idles by clicking round to a new
 * title every couple of seconds; `spinTo(i)` runs it through three whole
 * turns and lands on title `i`, resolving when it stops.
 */
export function initReel(reel: HTMLElement, count: number) {
  const track = reel.querySelector<HTMLElement>('.h-reel-track')!
  // The titles are written out three times over, so a spin has room to run.
  let at = 0
  let busy = false
  const rowH = () => track.firstElementChild!.getBoundingClientRect().height
  const place = (row: number, ms: number, ease = 'cubic-bezier(0.34, 1.4, 0.64, 1)') => {
    track.style.transition = ms ? `transform ${ms}ms ${ease}` : 'none'
    track.style.transform = `translate3d(0, ${(-row * rowH()).toFixed(1)}px, 0)`
  }
  place(0, 0)
  let idle = 0
  if (PLAY) {
    idle = window.setInterval(() => {
      if (busy || document.hidden) return
      at = (at + 1 + Math.floor(Math.random() * 3)) % count
      place(at, 520)
    }, 2200)
  }
  return {
    spinTo(i: number): Promise<void> {
      busy = true
      clearInterval(idle)
      if (!PLAY) { place(i, 0); return Promise.resolve() }
      // From the matching row in the first copy, round into the third.
      place(at, 0)
      void track.offsetWidth
      place(i + count * 2, 1700, 'cubic-bezier(0.12, 0.8, 0.18, 1)')
      return new Promise((done) => {
        const end = () => { track.removeEventListener('transitionend', end); done() }
        track.addEventListener('transitionend', end)
        setTimeout(end, 1900)
      })
    },
  }
}
