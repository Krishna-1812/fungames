/**
 * The island's air: what the light does on the way to the eye.
 *
 *   - after dark, an aurora over the far sea, and now and then a shooting star;
 *   - at dawn, mist lying on the water, and a wisp or two round the Peaks all day;
 *   - by day, the sun's shafts slanting in from where it stands (the top right).
 *
 * None of it is baked: it is drawn live by the engine's hooks (LiveLayer in
 * engine.ts), a few canvas calls a frame, and it eases in and out as the
 * hour turns. With motion off it stands still.
 */
import type { LiveHook } from './engine'

/** The ribbons of the aurora: where each runs (map units), how tall its curtain, and its two colours. */
const RIBBONS = [
  { from: [-1250, 520], via: [-520, 110], to: [0, -90], tall: 180, low: '#7dffd2', high: '#8f7bff', ph: 0 },
  { from: [90, -80], via: [560, 80], to: [1300, 520], tall: 190, low: '#8dfff0', high: '#6f8cff', ph: 2.1 },
  { from: [-1600, 980], via: [-1050, 560], to: [-760, 200], tall: 120, low: '#9bffe0', high: '#b08cff', ph: 4.4 },
]
/** Mist: where each bank lies, how big, how fast it drifts; `peak` ones cling to the Peaks all day. */
const BANKS: { x: number; y: number; w: number; h: number; v: number; peak?: boolean }[] = [
  { x: -440, y: 130, w: 520, h: 150, v: 5 }, { x: -600, y: 690, w: 560, h: 160, v: 4 }, { x: -330, y: 800, w: 480, h: 140, v: 6 },
  { x: 470, y: 770, w: 560, h: 160, v: 5 }, { x: 620, y: 230, w: 520, h: 150, v: 4 }, { x: 360, y: 110, w: 440, h: 130, v: 6 },
  { x: 250, y: 320, w: 300, h: 100, v: 3 }, { x: -900, y: 400, w: 520, h: 150, v: 4 }, { x: 900, y: 560, w: 520, h: 150, v: 5 },
  { x: 60, y: 960, w: 640, h: 170, v: 4 }, { x: -200, y: -120, w: 520, h: 140, v: 5 },
  { x: -160, y: 250, w: 340, h: 96, v: 2.2, peak: true }, { x: 230, y: 235, w: 300, h: 86, v: 1.8, peak: true }, { x: 40, y: 20, w: 280, h: 80, v: 2.6, peak: true },
]
/** The sun's shafts: each an angle off the sun's own way down the screen (radians), a width, and its own slow breath. */
const SHAFTS: [number, number, number][] = [[-0.34, 0.05, 0], [-0.2, 0.085, 1.7], [-0.06, 0.04, 3.1], [0.07, 0.1, 4.6], [0.23, 0.055, 0.9], [0.36, 0.07, 2.6]]

const mixHex = (a: string, b: string, t: number) => {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  const x = p(a), y = p(b)
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('')
}

export function createAir(o: { play: boolean; time: () => string }) {
  /** How far in each is (0 to 1), eased toward what the hour asks for. */
  const k = { aurora: 0, mist: 0, wisp: 0, shafts: 0 }
  const WANT: Record<string, typeof k> = {
    day: { aurora: 0, mist: 0, wisp: 0.6, shafts: 0.75 },
    dawn: { aurora: 0, mist: 1, wisp: 0.9, shafts: 1 },
    dusk: { aurora: 0.12, mist: 0.25, wisp: 0.6, shafts: 0.9 },
    night: { aurora: 1, mist: 0.2, wisp: 0.35, shafts: 0 },
  }
  let last = 0, first = true
  const ease = (now: number) => {
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0
    last = now
    const w = WANT[o.time()] ?? WANT.day
    for (const n of Object.keys(k) as (keyof typeof k)[]) k[n] = first ? w[n] : k[n] + (w[n] - k[n]) * Math.min(1, dt / 1.2)
    first = false
  }
  const clock = (now: number) => (o.play ? now / 1000 : 0)

  /* ---- the aurora: curtains of light over the far water, once the night has fallen ---- */
  /**
   * One curtain, painted once: columns of light of uneven strength (its rays), each bright just above its
   * foot and thinning upward from the low colour to the high one. Twice as wide as it repeats, so a ribbon
   * can be cut from it anywhere as the rays drift along.
   */
  const CW = 384, CH = 160
  const curtains = new Map<string, HTMLCanvasElement>()
  const curtain = (low: string, high: string) => {
    const key = low + high
    let cv = curtains.get(key)
    if (cv) return cv
    cv = document.createElement('canvas'); cv.width = CW * 2; cv.height = CH
    const p = cv.getContext('2d')!
    const wave = (x: number, fs: number[]) => fs.reduce((sum, fq, i) => sum + Math.sin((x / CW) * Math.PI * 2 * fq + i * 1.9) / (i + 1), 0)
    const rgb = (h: string, al: number) => `rgba(${[1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).join(',')},${al.toFixed(3)})`
    for (let x = 0; x < CW; x++) {
      const ray = Math.min(1, Math.max(0, 0.5 + 0.34 * wave(x, [3, 7, 17, 41]))), reach = 0.55 + 0.45 * Math.min(1, Math.max(0, 0.5 + 0.4 * wave(x + 90, [2, 5, 11])))
      const I = 0.25 + 0.75 * ray * ray
      const g = p.createLinearGradient(0, CH, 0, CH * (1 - reach))
      g.addColorStop(0, rgb(low, 0)); g.addColorStop(0.07, rgb(low, I)); g.addColorStop(0.22, rgb(low, I * 0.62))
      g.addColorStop(0.55, rgb(mixHex(low, high, 0.6), I * 0.3)); g.addColorStop(1, rgb(high, 0))
      p.fillStyle = g
      p.fillRect(x, 0, 1, CH); p.fillRect(x + CW, 0, 1, CH)
    }
    curtains.set(key, cv)
    return cv
  }
  const SLICES = 14
  const aurora: LiveHook = (c, m, now) => {
    ease(now)
    if (k.aurora < 0.01) return 0
    const t = clock(now), cw = c.canvas.width, ch = c.canvas.height
    c.globalCompositeOperation = 'lighter'
    let n = 0
    for (const r of RIBBONS) {
      const pic = curtain(r.low, r.high)
      // The ribbon's foot: a bend from one end to the other, swaying as it goes.
      const pts: [number, number][] = []
      for (let i = 0; i <= SLICES; i++) {
        const u = i / SLICES, v = 1 - u
        const x = v * v * r.from[0] + 2 * v * u * r.via[0] + u * u * r.to[0], y = v * v * r.from[1] + 2 * v * u * r.via[1] + u * u * r.to[1]
        const sway = Math.sin(u * 8 + t * 0.19 + r.ph) * 30 + Math.sin(u * 19 - t * 0.31 + r.ph * 2) * 11
        pts.push([x + sway * 0.4, y + sway])
      }
      // It breathes, each ribbon in its own time; and its rays drift along it.
      const breath = 0.7 + 0.3 * Math.sin(t * 0.17 + r.ph * 1.7), sw = CW / SLICES, off = (((t * 5 + r.ph * 60) % CW) + CW) % CW
      for (let i = 0; i < SLICES; i++) {
        const [x0, y0] = pts[i], [x1, y1] = pts[i + 1]
        // Off the canvas: not drawn.
        const dx0 = m[0] * Math.min(x0, x1) + m[4], dx1 = m[0] * Math.max(x0, x1) + m[4], dy0 = m[3] * (Math.min(y0, y1) - r.tall) + m[5], dy1 = m[3] * Math.max(y0, y1) + m[5]
        if (dx1 < 0 || dx0 > cw || dy1 < 0 || dy0 > ch) continue
        // The slice's own space: across along the foot, up the curtain's height. Neighbours share an edge.
        const ax = (x1 - x0) / sw, ay = (y1 - y0) / sw, by = r.tall / CH
        c.setTransform(m[0] * ax, m[3] * ay, 0, m[3] * by, m[0] * x0 + m[4], m[3] * (y0 - r.tall) + m[5])
        c.globalAlpha = 0.8 * k.aurora * breath * Math.pow(Math.sin(((i + 0.5) / SLICES) * Math.PI), 0.7)
        c.drawImage(pic, off + i * sw, 0, sw + 0.5, CH, 0, 0, sw + 0.5, CH)
        n += 2
      }
    }
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1
    return n
  }

  /* ---- mist and the sun's shafts and shooting stars: over everything ---- */
  let puff: HTMLCanvasElement | null = null
  const puffPic = () => {
    if (puff) return puff
    puff = document.createElement('canvas'); puff.width = 256; puff.height = 96
    const p = puff.getContext('2d')!
    // A bank of it: a few soft blobs side by side.
    for (const [x, y, r, a] of [[70, 52, 46, 0.7], [128, 46, 46, 0.9], [186, 52, 44, 0.7], [100, 58, 36, 0.5], [158, 58, 36, 0.5]]) {
      const g = p.createRadialGradient(x, y, 0, x, y, r)
      g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(0.6, `rgba(255,255,255,${a * 0.35})`); g.addColorStop(1, 'rgba(255,255,255,0)')
      p.fillStyle = g; p.fillRect(0, 0, 256, 96)
    }
    return puff
  }
  type Star = { at: number; x: number; y: number; dx: number; dy: number; life: number }
  let star: Star | null = null, nextStar = 0
  let seed = 11
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)

  const top: LiveHook = (c, m, now) => {
    const t = clock(now), cw = c.canvas.width, ch = c.canvas.height
    let n = 0
    // Mist, in the map's own space: it drifts with the wind and comes round again.
    if (k.mist > 0.01 || k.wisp > 0.01) {
      const pic = puffPic(), night = o.time() === 'night' ? 0.45 : 1
      c.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]); n++
      for (let i = 0; i < BANKS.length; i++) {
        const b = BANKS[i], a = (b.peak ? k.wisp * 0.6 : k.mist * 0.8) * night
        if (a < 0.01) continue
        const span = b.peak ? 120 : 420, ph = ((t * b.v + i * 97) % span) / span
        const x = b.x + (ph - 0.5) * span, fade = Math.sin(ph * Math.PI)
        // Off the canvas: not drawn.
        const x0 = m[0] * (x - b.w / 2) + m[4], x1 = m[0] * (x + b.w / 2) + m[4], y0 = m[3] * (b.y - b.h / 2) + m[5], y1 = m[3] * (b.y + b.h / 2) + m[5]
        if (x1 < 0 || x0 > cw || y1 < 0 || y0 > ch) continue
        c.globalAlpha = a * fade
        c.drawImage(pic, x - b.w / 2, b.y - b.h / 2, b.w, b.h); n++
      }
      c.globalAlpha = 1
    }
    // The sun's shafts, in the screen's space: from past the top right corner, down across the view.
    if (k.shafts > 0.01) {
      c.setTransform(1, 0, 0, 1, 0, 0); n++
      c.globalCompositeOperation = 'soft-light'
      const sx = cw * 1.06, sy = -ch * 0.18, reach = Math.hypot(cw, ch) * 1.25, base = Math.atan2(ch * 1.0, -cw * 0.92)
      const warm = o.time() === 'dawn' || o.time() === 'dusk'
      for (const [off, wide, ph] of SHAFTS) {
        const a = base + off + Math.sin(t * 0.05 + ph) * 0.02, breath = 0.55 + 0.45 * Math.sin(t * 0.11 + ph * 2.3)
        const ex = sx + Math.cos(a) * reach, ey = sy + Math.sin(a) * reach
        const g = c.createLinearGradient(sx, sy, ex, ey)
        const tint = warm ? '255,238,214' : '255,255,255'
        g.addColorStop(0, `rgba(${tint},0.5)`); g.addColorStop(0.45, `rgba(${tint},0.26)`); g.addColorStop(1, `rgba(${tint},0)`)
        c.fillStyle = g
        c.globalAlpha = k.shafts * breath
        c.beginPath()
        c.moveTo(sx, sy)
        c.lineTo(sx + Math.cos(a - wide / 2) * reach, sy + Math.sin(a - wide / 2) * reach)
        c.lineTo(sx + Math.cos(a + wide / 2) * reach, sy + Math.sin(a + wide / 2) * reach)
        c.closePath(); c.fill(); n++
      }
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1
    }
    // A shooting star, now and then, somewhere in the upper part of the view.
    if (o.play && k.aurora > 0.5) {
      if (!nextStar) nextStar = now + 2500 + rnd() * 4000
      if (!star && now > nextStar) {
        const ang = Math.PI * (0.78 + rnd() * 0.14), len = (0.28 + rnd() * 0.22) * cw
        star = { at: now, x: cw * (0.3 + rnd() * 0.65), y: ch * (0.04 + rnd() * 0.3), dx: Math.cos(ang) * len, dy: Math.sin(ang) * len, life: 700 + rnd() * 500 }
        nextStar = now + 5000 + rnd() * 9000
      }
      if (star) {
        const u = (now - star.at) / star.life
        if (u >= 1) star = null
        else {
          const e = 1 - (1 - u) * (1 - u), hx = star.x + star.dx * e, hy = star.y + star.dy * e
          const tail = 0.24 * Math.sin(Math.min(1, u * 1.6) * Math.PI / 2), tx = hx - star.dx * tail, ty = hy - star.dy * tail
          c.setTransform(1, 0, 0, 1, 0, 0)
          const g = c.createLinearGradient(hx, hy, tx, ty)
          g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(190,230,255,0.6)'); g.addColorStop(1, 'rgba(160,200,255,0)')
          c.strokeStyle = g; c.lineCap = 'round'
          c.lineWidth = Math.max(1.5, cw / 700)
          c.globalAlpha = Math.sin(Math.min(1, u * 4) * Math.PI / 2) * (1 - u * u)
          c.beginPath(); c.moveTo(hx, hy); c.lineTo(tx, ty); c.stroke()
          c.globalAlpha = 1
          n += 2
        }
      }
    }
    return n
  }
  return { aurora, top }
}
