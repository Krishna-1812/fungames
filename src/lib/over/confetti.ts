/**
 * Confetti that is paper.
 *
 * The confetti used to be coloured squares on a parabola: it fell like
 * gravel. Paper does not. A piece of confetti is a thin card that tumbles,
 * so the face it shows the light keeps changing (bright, then edge-on and
 * almost gone, then its darker back), and because it is flat the air pushes
 * it sideways as it turns, so it flutters down slowly instead of dropping.
 * Some pieces are foil, and flash as they catch the light.
 *
 * What lands on the tank lies on the glass for a few seconds and then goes.
 *
 * Each piece is a rectangle with a tumble angle, a spin in the plane and a
 * flutter phase; its fall speed is bounded by drag on whichever area it is
 * currently presenting to the air.
 */

type Piece = {
  x: number; y: number; vx: number; vy: number
  w: number; h: number
  /** Tumble about its long axis, turn in the plane of the screen. */
  tumble: number; tumbleV: number; turn: number; turnV: number
  phase: number
  col: [number, number, number]; foil: boolean
  life: number; landed: number
}

const PAPER: Array<[number, number, number]> = [
  [255, 95, 158], [138, 255, 196], [99, 201, 240], [167, 139, 250], [244, 241, 234], [86, 140, 255],
]

export function createConfetti(o: { canvas: HTMLCanvasElement; floor: () => { left: number; right: number; y: number } | null; animate: boolean }) {
  const cv = o.canvas, ctx = cv.getContext('2d')!
  let W = 1, H = 1, dpr = 1
  const pieces: Piece[] = []
  const MAX = 520

  function resize() {
    const b = cv.getBoundingClientRect()
    W = Math.max(1, b.width); H = Math.max(1, b.height)
    dpr = Math.min(2, devicePixelRatio || 1)
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr)
  }

  function add(x: number, y: number, vx: number, vy: number) {
    if (pieces.length >= MAX) pieces.shift()
    const foil = Math.random() < 0.16
    const s = 0.8 + Math.random() * 0.5
    pieces.push({
      x, y, vx, vy, w: 7 * s, h: 12 * s,
      tumble: Math.random() * 6.28, tumbleV: (Math.random() < 0.5 ? -1 : 1) * (5 + Math.random() * 9),
      turn: Math.random() * 6.28, turnV: (Math.random() - 0.5) * 5,
      phase: Math.random() * 6.28,
      col: foil ? [214, 222, 236] : PAPER[(Math.random() * PAPER.length) | 0], foil,
      life: 0, landed: 0,
    })
  }

  /** A shower from above the room, across its width. */
  function rain(n: number) {
    if (!o.animate) return
    for (let i = 0; i < n; i++) add(Math.random() * W, -10 - Math.random() * 40, (Math.random() - 0.5) * 60, 40 + Math.random() * 80)
  }

  /** A burst from a point, mostly upwards, as from a popper. */
  function pop(x: number, y: number, n: number, power = 1) {
    if (!o.animate) return
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2, s = (380 + Math.random() * 520) * power
      add(x, y, Math.cos(a) * s, Math.sin(a) * s)
    }
  }

  function step(dt: number) {
    const g = 900
    const fl = o.floor()
    for (let i = pieces.length - 1; i >= 0; i--) {
      const p = pieces[i]
      p.life += dt
      if (p.landed) {
        p.landed += dt
        if (p.landed > 3.5) pieces.splice(i, 1)
        continue
      }
      // How much of its face it presents to the air, from edge-on to flat.
      const face = Math.abs(Math.cos(p.tumble))
      const drag = 1.2 + 7 * face
      p.vy += g * dt
      p.vx -= p.vx * Math.min(1, drag * 0.35 * dt)
      p.vy -= p.vy * Math.min(1, drag * dt * (p.vy > 0 ? 1 : 0.3))
      // Flat paper turning in the air slides sideways: the flutter.
      p.phase += dt * (3 + face * 2)
      p.vx += Math.sin(p.phase) * 260 * face * dt
      p.x += p.vx * dt; p.y += p.vy * dt
      p.tumble += p.tumbleV * dt * (0.55 + 0.45 * face)
      p.turn += p.turnV * dt
      if (fl && p.y > fl.y - 1 && p.x > fl.left && p.x < fl.right && p.vy > 0) {
        p.y = fl.y - 1 - Math.random() * 2; p.landed = 0.0001
        // It lies down flat, more or less.
        p.tumble = Math.random() < 0.5 ? 0.25 : Math.PI - 0.25
      } else if (p.y > H + 20 || p.life > 14) pieces.splice(i, 1)
    }
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, W, H)
    for (const p of pieces) {
      const c = Math.cos(p.tumble)
      // Front lit, back in shadow, edge-on dark; foil adds a specular flash.
      let lit = c > 0 ? 0.72 + 0.28 * c : 0.42 + 0.2 * -c
      if (p.foil) lit += Math.pow(Math.max(0, Math.sin(p.tumble * 2 + p.turn)), 12) * 1.2
      const a = p.landed ? Math.max(0, 1 - Math.max(0, p.landed - 2.5)) : 1
      const r = Math.min(255, p.col[0] * lit), g = Math.min(255, p.col[1] * lit), b = Math.min(255, p.col[2] * lit)
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.turn)
      ctx.scale(1, Math.max(0.06, Math.abs(c)))
      ctx.globalAlpha = a
      ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
      ctx.restore()
    }
    ctx.globalAlpha = 1
  }

  const ro = new ResizeObserver(resize)
  ro.observe(cv)
  resize()

  return {
    rain, pop,
    frame(dt: number) { if (!pieces.length) { if (cv.dataset.clear !== '1') { ctx.clearRect(0, 0, cv.width, cv.height); cv.dataset.clear = '1' } return } cv.dataset.clear = ''; step(Math.min(1 / 30, dt)); draw() },
    clear() { pieces.length = 0 },
    get count() { return pieces.length },
    dispose() { ro.disconnect() },
  }
}
