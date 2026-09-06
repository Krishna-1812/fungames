/**
 * Screen juice: the small feedback that separates a chart from a game.
 *
 * One shared full-screen canvas handles every particle on the page, so a game
 * can throw sparks from anywhere without managing its own render loop. The loop
 * sleeps whenever there is nothing alive, so an idle page costs nothing.
 */

type P = {
  x: number; y: number; vx: number; vy: number
  life: number; max: number
  size: number; color: string
  gravity: number; drag: number; shape: 'dot' | 'square' | 'ring' | 'streak'
  spin: number; rot: number
}

let canvas: HTMLCanvasElement | null = null
let ctx: CanvasRenderingContext2D | null = null
let parts: P[] = []
let running = false
let dpr = 1
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches

function ensure() {
  if (canvas) return
  canvas = document.createElement('canvas')
  canvas.setAttribute('aria-hidden', 'true')
  Object.assign(canvas.style, {
    position: 'fixed', inset: '0', width: '100%', height: '100%',
    pointerEvents: 'none', zIndex: '9000',
  } as CSSStyleDeclaration)
  document.body.appendChild(canvas)
  ctx = canvas.getContext('2d')
  size()
  addEventListener('resize', size, { passive: true })
}

function size() {
  if (!canvas || !ctx) return
  dpr = Math.min(devicePixelRatio || 1, 2)
  canvas.width = Math.round(innerWidth * dpr)
  canvas.height = Math.round(innerHeight * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}

function loop() {
  if (!ctx || !canvas) return
  ctx.clearRect(0, 0, innerWidth, innerHeight)

  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]
    p.life--
    if (p.life <= 0) { parts.splice(i, 1); continue }

    p.vy += p.gravity
    p.vx *= p.drag
    p.vy *= p.drag
    p.x += p.vx
    p.y += p.vy
    p.rot += p.spin

    const t = p.life / p.max
    ctx.globalAlpha = Math.min(1, t * 1.6)
    ctx.fillStyle = p.color
    ctx.strokeStyle = p.color

    if (p.shape === 'ring') {
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size * (1.6 - t), 0, Math.PI * 2)
      ctx.stroke()
    } else if (p.shape === 'square') {
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size)
      ctx.restore()
    } else if (p.shape === 'streak') {
      ctx.lineWidth = p.size
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(p.x, p.y)
      ctx.lineTo(p.x - p.vx * 2.5, p.y - p.vy * 2.5)
      ctx.stroke()
    } else {
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size * t, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.globalAlpha = 1

  if (parts.length) requestAnimationFrame(loop)
  else running = false
}

function start() {
  if (running) return
  running = true
  requestAnimationFrame(loop)
}

export type BurstOpts = {
  count?: number
  colors?: string[]
  speed?: number
  spread?: number
  /** Radians. 0 is right, -Math.PI/2 is up. */
  angle?: number
  gravity?: number
  drag?: number
  life?: number
  size?: number
  shape?: P['shape']
}

/** Throw particles from a point in viewport coordinates. */
export function burst(x: number, y: number, o: BurstOpts = {}) {
  if (reduced) return
  ensure()
  const {
    count = 14, colors = ['#fff'], speed = 4, spread = Math.PI * 2,
    angle = -Math.PI / 2, gravity = 0.14, drag = 0.97, life = 44, size = 4,
    shape = 'dot',
  } = o
  for (let i = 0; i < count; i++) {
    const a = angle + (Math.random() - 0.5) * spread
    const s = speed * (0.45 + Math.random() * 0.9)
    const max = life * (0.6 + Math.random() * 0.8)
    parts.push({
      x, y,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: max, max,
      size: size * (0.6 + Math.random() * 0.8),
      color: colors[(Math.random() * colors.length) | 0],
      gravity, drag, shape,
      spin: (Math.random() - 0.5) * 0.3, rot: Math.random() * Math.PI,
    })
  }
  // A hard cap keeps a stuck emitter from ever tanking the frame rate.
  if (parts.length > 900) parts.splice(0, parts.length - 900)
  start()
}

/** An expanding ring — good for impacts and "something happened here". */
export function ring(x: number, y: number, color = '#fff', size = 18) {
  if (reduced) return
  ensure()
  parts.push({
    x, y, vx: 0, vy: 0, life: 26, max: 26,
    size, color, gravity: 0, drag: 1, shape: 'ring', spin: 0, rot: 0,
  })
  start()
}

let shakeTimer = 0
/** Nudge an element around for `ms`. Skipped under reduced-motion. */
export function shake(el: HTMLElement | null, strength = 6, ms = 260) {
  if (!el || reduced) return
  const started = performance.now()
  cancelAnimationFrame(shakeTimer)
  const step = (now: number) => {
    const t = (now - started) / ms
    if (t >= 1) { el.style.transform = ''; return }
    const k = strength * (1 - t)
    el.style.transform = `translate(${(Math.random() - 0.5) * k}px, ${(Math.random() - 0.5) * k}px)`
    shakeTimer = requestAnimationFrame(step)
  }
  shakeTimer = requestAnimationFrame(step)
}

/** A number or word that floats up and fades — score feedback. */
export function floatText(x: number, y: number, text: string, color = '#fff') {
  if (reduced) return
  const el = document.createElement('div')
  el.textContent = text
  Object.assign(el.style, {
    position: 'fixed', left: `${x}px`, top: `${y}px`, zIndex: '9001',
    color, font: '700 16px/1 Inter, system-ui, sans-serif',
    pointerEvents: 'none', textShadow: '0 1px 3px rgba(0,0,0,.45)',
    transform: 'translate(-50%,-50%)',
    transition: 'transform 700ms cubic-bezier(.22,.61,.36,1), opacity 700ms linear',
  } as CSSStyleDeclaration)
  document.body.appendChild(el)
  requestAnimationFrame(() => {
    el.style.transform = 'translate(-50%,-160%)'
    el.style.opacity = '0'
  })
  setTimeout(() => el.remove(), 760)
}

/**
 * The same rise-and-fade as floatText, but carrying markup instead of a string.
 *
 * Paper Folds used to throw the milestone's emoji up the screen; the emoji is
 * now a drawn icon, which is an `<svg>` and not something `textContent` can
 * hold. Same motion, same lifetime, same reduced-motion opt-out.
 */
export function floatIcon(x: number, y: number, markup: string, size = 30) {
  if (reduced) return
  const el = document.createElement('div')
  el.innerHTML = markup
  Object.assign(el.style, {
    position: 'fixed', left: `${x}px`, top: `${y}px`, zIndex: '9001',
    width: `${size}px`, height: `${size}px`,
    pointerEvents: 'none', filter: 'drop-shadow(0 1px 3px rgba(0,0,0,.35))',
    transform: 'translate(-50%,-50%)',
    transition: 'transform 700ms cubic-bezier(.22,.61,.36,1), opacity 700ms linear',
  } as CSSStyleDeclaration)
  document.body.appendChild(el)
  requestAnimationFrame(() => {
    el.style.transform = 'translate(-50%,-160%)'
    el.style.opacity = '0'
  })
  setTimeout(() => el.remove(), 760)
}

export const prefersReducedMotion = reduced
