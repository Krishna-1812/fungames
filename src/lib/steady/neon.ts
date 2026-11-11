/**
 * Steady Hand, as neon.
 *
 * Bending neon is the job that needs the steadiest hand there is: the glass
 * is soft for a few seconds and the line is the line. So the board is a
 * painted brick wall at night, the marks are standoffs screwed into it, and
 * your stroke is a glass tube. While you draw, the gas glows faintly behind
 * the pen. Finish on the mark and the tube is lit: it catches, flickers,
 * hums, and holds, and the wall round it takes its colour. Miss the mark and
 * the glass cracks and falls.
 *
 * How it is lit, because that is the whole look:
 *
 *   1. the wall is a painted texture at full brightness (wall.ts);
 *   2. a light map is built at a quarter of the size: a dim night ambient,
 *      plus the tube drawn thick in its gas colour and blurred by halving it
 *      down three times and adding those back up, which is a cheap, soft,
 *      wide falloff that works in every browser;
 *   3. the wall is multiplied by that light map, so bricks near the tube are
 *      lit in its colour and the far wall sinks into the dark — light on a
 *      surface, not fog over it;
 *   4. a little of the blur is added on top, for the glow in the air;
 *   5. then the glass itself: a coloured body, a paler inner tube, and a
 *      white-hot core, with dark electrodes capping the ends.
 *
 * Chalk (the marks' labels, and the ideal shape after an attempt) is drawn
 * on the wall before step 3, so it is lit like the wall is.
 */
import { wallCanvas } from './wall'

export type Pt = { x: number; y: number }
export type Mark = { x: number; y: number; label?: string }

/** One gas per shape; all from the cool end of what neon does. */
export const GASES: Record<string, { name: string; rgb: [number, number, number] }> = {
  line: { name: 'Argon blue', rgb: [70, 160, 255] },
  circle: { name: 'Mint', rgb: [70, 255, 186] },
  square: { name: 'Violet', rgb: [168, 112, 255] },
  spiral: { name: 'Neon pink', rgb: [255, 82, 176] },
}

type Shard = { x: number; y: number; vx: number; vy: number; a: number; va: number; len: number; life: number; rest: number }

export type NeonState = {
  marks: Mark[]
  /** Open shapes: a chalk ring round the mark to start from. */
  startRing: boolean
  /** A chalk cross at the middle (the circle's centre). */
  centreMark: boolean
  ideal: Pt[] | null
  band: number
  tube: Pt[]
  gas: [number, number, number]
  /** 'warm' while you draw, 'lit' once it has caught. */
  mode: 'none' | 'warm' | 'lit'
  cursor: Pt | null
  /** Other tubes on the same wall, already lit: the finished sign. */
  extra: Array<{ pts: Pt[]; gas: [number, number, number] }>
}

export function createNeon(canvas: HTMLCanvasElement, o: { animate: boolean; onLand?: (n: number) => void }) {
  const g = canvas.getContext('2d')!
  let W = 1, H = 1, dpr = 1
  let wall: HTMLCanvasElement | null = null
  const mk = () => { const c = document.createElement('canvas'); return { c, x: c.getContext('2d')! } }
  const q = [mk(), mk(), mk(), mk(), mk(), mk()]
  const light = mk()
  /** The glow in the air, blurred from the same tube mask. */
  const air = mk()
  /** A real blur where the canvas has one; the halving chain where it does not. */
  const BLUR = 'filter' in light.x

  const s: NeonState = { marks: [], startRing: false, centreMark: false, ideal: null, band: 0, tube: [], gas: [70, 160, 255], mode: 'none', cursor: null, extra: [] }
  let lit = 0
  let igniteAt = -1
  let shards: Shard[] = []
  let shardGas: [number, number, number] = [200, 220, 240]
  let raf = 0, last = 0, now = 0

  function resize(w: number, h: number, d: number) {
    W = Math.max(1, w); H = Math.max(1, h); dpr = d
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr)
    wall = wallCanvas(W, H, dpr)
    const sizes = [4, 8, 16, 32, 64, 128]
    q.forEach((b, i) => { b.c.width = Math.max(2, Math.ceil(W / sizes[i])); b.c.height = Math.max(2, Math.ceil(H / sizes[i])) })
    light.c.width = air.c.width = q[0].c.width; light.c.height = air.c.height = q[0].c.height
    draw()
  }

  /* ---- paths ------------------------------------------------------------ */

  /** Through the midpoints with quadratics: the raw samples, smoothed, not moved. */
  function trace(x: CanvasRenderingContext2D, p: Pt[]) {
    x.beginPath()
    if (p.length < 2) return
    x.moveTo(p[0].x, p[0].y)
    for (let i = 1; i < p.length - 1; i++) x.quadraticCurveTo(p[i].x, p[i].y, (p[i].x + p[i + 1].x) / 2, (p[i].y + p[i + 1].y) / 2)
    x.lineTo(p[p.length - 1].x, p[p.length - 1].y)
  }

  /** The first and last `len` px of a path, for the electrodes. */
  function ends(p: Pt[], len: number): [Pt[], Pt[]] {
    const walk = (pts: Pt[]) => {
      const out = [pts[0]]
      let acc = 0
      for (let i = 1; i < pts.length && acc < len; i++) { acc += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); out.push(pts[i]) }
      return out
    }
    return [walk(p), walk(p.slice().reverse())]
  }

  /* ---- the light map ---------------------------------------------------- */

  function lightMap(on: number) {
    const L = light.x, lw = light.c.width, lh = light.c.height
    L.globalCompositeOperation = 'source-over'
    // Night: a little cold sky light from the upper left, almost none below.
    const amb = L.createLinearGradient(0, 0, lw * 0.6, lh)
    amb.addColorStop(0, 'rgb(132, 142, 166)')
    amb.addColorStop(1, 'rgb(74, 80, 100)')
    L.fillStyle = amb
    L.fillRect(0, 0, lw, lh)
    const tubes = [...(on > 0.001 && s.tube.length > 1 ? [{ pts: s.tube, gas: s.gas, on }] : []), ...s.extra.map((e) => ({ ...e, on: 1 }))]
    if (!tubes.length) return
    on = Math.max(on, s.extra.length ? 1 : 0)
    const t0 = q[0]
    t0.x.setTransform(1, 0, 0, 1, 0, 0)
    t0.x.clearRect(0, 0, t0.c.width, t0.c.height)
    t0.x.setTransform(t0.c.width / W, 0, 0, t0.c.height / H, 0, 0)
    t0.x.lineCap = 'round'; t0.x.lineJoin = 'round'
    t0.x.lineWidth = 20
    for (const tb of tubes) {
      t0.x.strokeStyle = `rgb(${tb.gas[0]},${tb.gas[1]},${tb.gas[2]})`
      t0.x.globalAlpha = Math.min(1, tb.on)
      trace(t0.x, tb.pts); t0.x.stroke()
    }
    t0.x.globalAlpha = 1
    if (BLUR) {
      // Blur radii in light-map pixels (a quarter of the screen's): from the
      // bright wall right behind the glass to a long faint tail.
      L.globalCompositeOperation = 'lighter'
      for (const [b, n] of [[1.5, 2], [5, 3], [13, 4], [30, 5], [60, 4]] as const) {
        ;(L as any).filter = `blur(${b}px)`
        for (let k = 0; k < n; k++) L.drawImage(t0.c, 0, 0, lw, lh)
      }
      ;(L as any).filter = 'none'
      L.globalCompositeOperation = 'source-over'
      const A = air.x
      A.clearRect(0, 0, air.c.width, air.c.height)
      A.globalCompositeOperation = 'lighter'
      for (const b of [4, 12, 28]) { (A as any).filter = `blur(${b}px)`; A.drawImage(t0.c, 0, 0) }
      ;(A as any).filter = 'none'
      A.globalCompositeOperation = 'source-over'
      return
    }
    for (let i = 1; i < q.length; i++) {
      q[i].x.clearRect(0, 0, q[i].c.width, q[i].c.height)
      q[i].x.imageSmoothingQuality = 'high'
      q[i].x.drawImage(q[i - 1].c, 0, 0, q[i].c.width, q[i].c.height)
    }
    L.globalCompositeOperation = 'lighter'
    L.imageSmoothingQuality = 'high'
    // Each level is the tube spread wider and fainter; adding them up with
    // these weights gives a falloff with a bright near wall and a long tail.
    const k = [2, 3, 4, 5, 6, 6]
    L.globalAlpha = Math.min(1, on)
    for (let i = 0; i < q.length; i++) for (let n = 0; n < k[i]; n++) L.drawImage(q[i].c, 0, 0, lw, lh)
    L.globalAlpha = 1
    L.globalCompositeOperation = 'source-over'
  }

  /* ---- chalk, standoffs, glass ------------------------------------------ */

  function chalk(x: CanvasRenderingContext2D) {
    x.save()
    x.lineCap = 'round'; x.lineJoin = 'round'
    if (s.ideal && s.ideal.length > 1) {
      // The tolerance, as a smudge; the ideal, as a dashed chalk line.
      x.strokeStyle = 'rgba(232, 238, 250, 0.10)'
      x.lineWidth = s.band
      trace(x, s.ideal); x.stroke()
      x.setLineDash([8, 9])
      x.strokeStyle = 'rgba(236, 241, 252, 0.75)'
      x.lineWidth = 2.2
      trace(x, s.ideal); x.stroke()
      x.setLineDash([])
    }
    if (s.startRing && s.marks[0]) {
      const m = s.marks[0]
      x.strokeStyle = 'rgba(236, 241, 252, 0.7)'
      x.lineWidth = 1.8
      x.beginPath()
      // A ring drawn by hand: not quite closed, not quite round.
      for (let a = 0.3; a < Math.PI * 2 + 0.2; a += 0.12) {
        const rr = 24 + Math.sin(a * 3 + 1) * 1.2
        const px = m.x + Math.cos(a) * rr, py = m.y + Math.sin(a) * rr
        if (a === 0.3) x.moveTo(px, py); else x.lineTo(px, py)
      }
      x.stroke()
    }
    if (s.centreMark && s.marks[0]) {
      const m = s.marks[0]
      x.strokeStyle = 'rgba(236, 241, 252, 0.6)'; x.lineWidth = 1.6
      x.beginPath(); x.moveTo(m.x - 16, m.y); x.lineTo(m.x - 10, m.y); x.moveTo(m.x + 10, m.y); x.lineTo(m.x + 16, m.y)
      x.moveTo(m.x, m.y - 16); x.lineTo(m.x, m.y - 10); x.moveTo(m.x, m.y + 10); x.lineTo(m.x, m.y + 16); x.stroke()
    }
    x.fillStyle = 'rgba(238, 243, 252, 0.82)'
    x.font = '600 22px Caveat, "Segoe Print", cursive'
    x.textAlign = 'center'; x.textBaseline = 'middle'
    for (const m of s.marks) if (m.label) x.fillText(m.label, m.x + 21, m.y - 20)
    x.restore()
  }

  /** A standoff: a steel post screwed into the wall, which the tube clips to. */
  function standoffs(x: CanvasRenderingContext2D) {
    for (const m of s.marks) {
      x.save()
      const sh = x.createRadialGradient(m.x + 3, m.y + 5, 2, m.x + 3, m.y + 5, 14)
      sh.addColorStop(0, 'rgba(0,0,0,0.55)'); sh.addColorStop(1, 'rgba(0,0,0,0)')
      x.fillStyle = sh
      x.beginPath(); x.arc(m.x + 3, m.y + 5, 14, 0, Math.PI * 2); x.fill()
      const body = x.createRadialGradient(m.x - 3, m.y - 3, 0.5, m.x, m.y, 9)
      body.addColorStop(0, '#f4f7fb'); body.addColorStop(0.4, '#aab4c3'); body.addColorStop(0.85, '#5b6576'); body.addColorStop(1, '#2c3340')
      x.fillStyle = body
      x.beginPath(); x.arc(m.x, m.y, 9, 0, Math.PI * 2); x.fill()
      x.fillStyle = 'rgba(20, 24, 32, 0.85)'
      x.beginPath(); x.arc(m.x, m.y, 3, 0, Math.PI * 2); x.fill()
      x.strokeStyle = 'rgba(255,255,255,0.35)'; x.lineWidth = 0.8
      x.beginPath(); x.arc(m.x, m.y, 8.4, Math.PI * 1.1, Math.PI * 1.7); x.stroke()
      x.restore()
    }
  }

  function glass(x: CanvasRenderingContext2D, p: Pt[], on: number, gas = s.gas) {
    if (p.length < 2) return
    const [r, gg, b] = gas
    x.save()
    x.lineCap = 'round'; x.lineJoin = 'round'
    // Its shadow on the wall, from the night light: gone in its own glow.
    if (on < 0.9) {
      x.save(); x.translate(3, 6)
      x.strokeStyle = `rgba(0, 0, 0, ${(0.4 * (1 - on)).toFixed(3)})`; x.lineWidth = 9
      trace(x, p); x.stroke(); x.restore()
    }
    // The glass: brighter at its edges than through the middle.
    x.strokeStyle = `rgba(196, 212, 236, ${(0.34 - 0.18 * on).toFixed(3)})`; x.lineWidth = 9.5
    trace(x, p); x.stroke()
    x.strokeStyle = `rgba(8, 12, 22, ${(0.32 * (1 - on)).toFixed(3)})`; x.lineWidth = 5
    trace(x, p); x.stroke()
    if (on > 0.001) {
      x.globalCompositeOperation = 'lighter'
      x.strokeStyle = `rgba(${r},${gg},${b},${(0.22 * on).toFixed(3)})`; x.lineWidth = 26
      trace(x, p); x.stroke()
      x.globalCompositeOperation = 'source-over'
      x.strokeStyle = `rgba(${r},${gg},${b},${on.toFixed(3)})`; x.lineWidth = 8
      trace(x, p); x.stroke()
      const mix = (c: number) => Math.round(c + (255 - c) * 0.72)
      x.strokeStyle = `rgba(${mix(r)},${mix(gg)},${mix(b)},${on.toFixed(3)})`; x.lineWidth = 3.8
      trace(x, p); x.stroke()
      x.strokeStyle = `rgba(255,255,255,${(0.9 * on).toFixed(3)})`; x.lineWidth = 1.4
      trace(x, p); x.stroke()
    }
    // The light catching the side of the tube that faces it.
    x.save(); x.translate(-1.6, -1.8)
    x.strokeStyle = `rgba(255, 255, 255, ${(0.5 - 0.25 * on).toFixed(3)})`; x.lineWidth = 1.1
    trace(x, p); x.stroke(); x.restore()
    // Electrodes: the last centimetre at each end is metal in a black boot.
    if (p.length > 4) {
      // While it is still being drawn, the far end is the pen, not an electrode.
      const caps = ends(p, 13)
      for (const e of s.mode === 'warm' && p === s.tube ? caps.slice(0, 1) : caps) {
        x.strokeStyle = '#11151d'; x.lineWidth = 11
        trace(x, e); x.stroke()
        x.strokeStyle = 'rgba(150, 165, 190, 0.5)'; x.lineWidth = 1.2
        x.save(); x.translate(-1.5, -2); trace(x, e); x.stroke(); x.restore()
      }
    }
    x.restore()
  }

  function drawShards(x: CanvasRenderingContext2D) {
    const [r, gg, b] = shardGas
    x.save()
    for (const d of shards) {
      const fade = Math.max(0, Math.min(1, 1 - (d.life - 1.1) / 0.6))
      if (fade <= 0) continue
      x.save()
      x.translate(d.x, d.y); x.rotate(d.a)
      x.globalAlpha = fade
      x.fillStyle = `rgba(${(r + 400) / 3 | 0}, ${(gg + 420) / 3 | 0}, ${(b + 450) / 3 | 0}, 0.38)`
      x.strokeStyle = 'rgba(235, 244, 255, 0.7)'; x.lineWidth = 0.9
      x.beginPath()
      // A curved sliver of tube wall, never a neat rectangle.
      x.moveTo(-d.len / 2, -3.6); x.lineTo(d.len / 2 - 2, -4.2); x.lineTo(d.len / 2, 1.5); x.lineTo(-d.len / 2 + 3, 4.2); x.closePath()
      x.fill(); x.stroke()
      x.restore()
    }
    x.restore()
  }

  function draw() {
    if (!wall) return
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.globalCompositeOperation = 'source-over'
    g.drawImage(wall, 0, 0)
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    chalk(g)
    const on = s.mode === 'lit' ? lit : s.mode === 'warm' ? 0.42 : 0
    // Light the wall.
    lightMap(on)
    g.globalCompositeOperation = 'multiply'
    g.imageSmoothingQuality = 'high'
    g.drawImage(light.c, 0, 0, W, H)
    // The glow in the air between you and the wall.
    const glowAir = Math.max(s.tube.length > 1 ? on : 0, s.extra.length ? 1 : 0)
    if (glowAir > 0.001) {
      g.globalCompositeOperation = 'lighter'
      if (BLUR) { g.globalAlpha = 0.5 * glowAir; g.drawImage(air.c, 0, 0, W, H) }
      else {
        g.globalAlpha = 0.34 * glowAir; g.drawImage(q[2].c, 0, 0, W, H)
        g.globalAlpha = 0.34 * glowAir; g.drawImage(q[3].c, 0, 0, W, H)
        g.globalAlpha = 0.3 * glowAir; g.drawImage(q[4].c, 0, 0, W, H)
      }
      g.globalAlpha = 1
    }
    g.globalCompositeOperation = 'source-over'
    standoffs(g)
    for (const e of s.extra) glass(g, e.pts, 1, e.gas)
    glass(g, s.tube, on)
    drawShards(g)
    if (s.cursor) cursor(g, s.cursor)
  }

  function cursor(x: CanvasRenderingContext2D, p: Pt) {
    x.save()
    for (const [col, w] of [['rgba(10, 30, 26, 0.55)', 4.5], ['#4fe3c1', 2]] as [string, number][]) {
      x.strokeStyle = col; x.lineWidth = w; x.lineCap = 'round'
      x.beginPath(); x.arc(p.x, p.y, 7, 0, Math.PI * 2); x.stroke()
      x.beginPath(); x.moveTo(p.x - 14, p.y); x.lineTo(p.x - 9, p.y); x.moveTo(p.x + 9, p.y); x.lineTo(p.x + 14, p.y)
      x.moveTo(p.x, p.y - 14); x.lineTo(p.x, p.y - 9); x.moveTo(p.x, p.y + 9); x.lineTo(p.x, p.y + 14); x.stroke()
    }
    x.restore()
  }

  /* ---- animation -------------------------------------------------------- */

  /** How a tube catches: a stutter of false starts, then it holds. */
  function flicker(t: number) {
    const keys: Array<[number, number]> = [[0, 0], [0.07, 0], [0.09, 0.9], [0.14, 0.15], [0.2, 0.75], [0.24, 0.05], [0.3, 0.3], [0.36, 0.95], [0.4, 0.6], [0.5, 1]]
    if (t >= 0.5) return 1
    for (let i = 1; i < keys.length; i++) if (t < keys[i][0]) {
      const [t0, v0] = keys[i - 1], [t1, v1] = keys[i]
      return v0 + (v1 - v0) * ((t - t0) / (t1 - t0))
    }
    return 1
  }

  function step(dt: number) {
    let busy = false
    if (igniteAt >= 0) {
      const t = (now - igniteAt) / 1000
      lit = flicker(t)
      if (t >= 0.5) { igniteAt = -1; lit = 1 } else busy = true
    }
    if (shards.length) {
      const floor = H - 4
      for (const d of shards) {
        d.life += dt
        if (d.rest) continue
        d.vy += 1900 * dt
        d.x += d.vx * dt; d.y += d.vy * dt; d.a += d.va * dt
        if (d.y > floor) {
          d.y = floor
          if (d.vy > 160) { o.onLand?.(Math.min(1, d.vy / 900)); d.vy = -d.vy * 0.28; d.vx *= 0.6; d.va *= 0.5 }
          else { d.vy = 0; d.vx *= 0.8; d.va *= 0.6; if (Math.abs(d.vx) < 5) d.rest = 1 }
        }
      }
      shards = shards.filter((d) => d.life < 1.75)
      if (shards.length) busy = true
    }
    return busy
  }

  function tick(t: number) {
    now = t
    const dt = Math.min(1 / 30, (t - last) / 1000 || 1 / 60)
    last = t
    const busy = step(dt)
    draw()
    raf = busy ? requestAnimationFrame(tick) : 0
  }
  function wake() {
    if (raf) return
    last = performance.now()
    raf = requestAnimationFrame(tick)
  }

  return {
    state: s,
    resize,
    /** Change what is on the wall, then draw it. */
    set(patch: Partial<NeonState>) {
      Object.assign(s, patch)
      if (patch.mode === 'lit' && igniteAt < 0 && !raf) lit = 1
      if (!raf) draw()
    },
    /** The tube catches. */
    ignite() {
      s.mode = 'lit'
      if (!o.animate) { lit = 1; draw(); return }
      lit = 0; igniteAt = performance.now(); wake()
    },
    /** The glass breaks along its length and falls. */
    shatter() {
      const p = s.tube
      shardGas = s.gas
      s.tube = []; s.mode = 'none'
      if (!o.animate || p.length < 2) { draw(); return }
      let acc = 0, from = p[0]
      for (let i = 1; i < p.length; i++) {
        acc += Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y)
        const piece = 9 + ((i * 7919) % 17)
        if (acc >= piece || i === p.length - 1) {
          const to = p[i]
          const mx = (from.x + to.x) / 2, my = (from.y + to.y) / 2
          shards.push({
            x: mx, y: my,
            vx: (Math.random() - 0.5) * 260, vy: -60 - Math.random() * 260,
            a: Math.atan2(to.y - from.y, to.x - from.x), va: (Math.random() - 0.5) * 22,
            len: Math.max(6, acc), life: Math.random() * 0.1, rest: 0,
          })
          acc = 0; from = to
        }
      }
      wake()
    },
    get lit() { return lit },
    get busy() { return !!raf },
    draw,
  }
}
