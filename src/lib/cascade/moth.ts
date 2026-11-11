/**
 * The moth.
 *
 * Rule 24 says a moth has got into your username. It used to be invisible: a
 * timer took a letter away every six seconds and the field shook. Now there is
 * a moth. It comes in towards the lamp, the way moths do, and loops about in
 * the light above the clipboard; a couple of seconds before it is hungry again
 * it drops down onto your username, lands on one letter, chews, and the letter
 * is gone, in crumbs. Then it goes back to the lamp. Put a spider in the
 * username and it leaves, quickly, and stays away while the spider is there.
 *
 * It is drawn from above, like everything on the desk, into a small canvas
 * that travels with it: wings that blur as they beat and lie flat when it
 * lands, a furred body, feathered antennae, and a shadow that falls down and
 * to the right of it and closes in as it comes down.
 */

import { caretMap } from './caret'

type Mode = 'away' | 'arrive' | 'lamp' | 'drop' | 'landed' | 'leave'

export function createMoth(o: {
  /** The desk: the moth's world, and what its canvas is positioned in. */
  host: HTMLElement
  field: HTMLTextAreaElement
  /** Where the lamp's light is brightest, in host coordinates. */
  lamp: () => { x: number; y: number }
  animate: boolean
  /** Is there a moth at all (rule 24 on the desk, the game not over)? */
  present: () => boolean
  /** Is it hungry: no spider in the username? */
  hungry: () => boolean
  /** The game is paused: everything holds still, the clock included. */
  paused: () => boolean
  /** A character it may eat, or null if there is nothing edible. */
  pick: () => number | null
  /** Eat it; returns false if it could not. */
  eat: (i: number) => boolean
  onFlutter?: () => void
  /** Every six seconds. */
  every?: number
}) {
  const EVERY = o.every ?? 6
  const S = 190
  const cv = document.createElement('canvas')
  cv.className = 'rc-moth'
  cv.setAttribute('aria-hidden', 'true')
  const dpr = Math.min(2, devicePixelRatio || 1)
  cv.width = S * dpr; cv.height = S * dpr
  cv.style.width = cv.style.height = S + 'px'
  cv.hidden = true
  o.host.appendChild(cv)
  const g = cv.getContext('2d')!
  const caret = caretMap(o.field)

  let mode: Mode = 'away'
  let x = -120, y = -120, vx = 0, vy = 0, h = 1, heading = 0
  let flap = 0, t = 0, clock = 0, next = EVERY, target = -1, chew = 0, rest = 0
  let raf = 0, last = 0, wobble = Math.random() * 10

  const hostXY = (vx: number, vy: number) => {
    const r = o.host.getBoundingClientRect()
    return { x: vx - r.left, y: vy - r.top }
  }
  const view = () => {
    const r = o.host.getBoundingClientRect()
    return { top: -r.top, bottom: innerHeight - r.top, left: -r.left, right: innerWidth - r.left }
  }
  function letter(i: number) {
    const p = caret.at(i)
    if (!p) return null
    const q = hostXY(p.x, p.y)
    return { x: q.x, y: q.y, w: p.w, h: p.h }
  }

  /** Where it circles: in the lamp's light, but kept on screen. */
  function lampSpot() {
    const l = o.lamp(), v = view()
    return { x: Math.max(v.left + 60, Math.min(v.right - 60, l.x)), y: Math.max(v.top + 70, Math.min(v.bottom - 120, l.y)) }
  }

  /* ---- flying --------------------------------------------------------- */
  function steer(tx: number, ty: number, speed: number, dt: number, jitter: number) {
    const dx = tx - x, dy = ty - y, d = Math.hypot(dx, dy) || 1
    const want = Math.min(speed, d * 3.2)
    const ax = (dx / d) * want - vx, ay = (dy / d) * want - vy
    // A moth does not fly in straight lines: it is pushed about all the time.
    wobble += dt * 7
    const jx = (Math.sin(wobble * 1.7) + Math.sin(wobble * 3.1 + 2)) * jitter
    const jy = (Math.cos(wobble * 1.3) + Math.sin(wobble * 2.6 + 1)) * jitter
    vx += (ax * 5.5 + jx) * dt; vy += (ay * 5.5 + jy) * dt
    x += vx * dt; y += vy * dt
    const sp = Math.hypot(vx, vy)
    if (sp > 20) {
      const want = Math.atan2(vy, vx)
      let dh = want - heading
      dh = Math.atan2(Math.sin(dh), Math.cos(dh))
      heading += dh * Math.min(1, dt * 8)
    }
    return d
  }

  function step(dt: number) {
    t += dt
    const here = o.present(), hungry = here && o.hungry()
    if (hungry) clock += dt
    if (!hungry && mode !== 'away' && mode !== 'leave') { mode = 'leave'; o.onFlutter?.() }

    switch (mode) {
      case 'away': {
        if (hungry) {
          // In from the dark beyond the lamp, top left.
          const v = view(), l = lampSpot()
          x = Math.max(v.left - 90, l.x - 380); y = Math.max(v.top - 90, l.y - 260)
          vx = 200; vy = 140; h = 1; heading = Math.atan2(vy, vx)
          mode = 'arrive'; next = clock + EVERY
          o.onFlutter?.()
        }
        break
      }
      case 'arrive':
      case 'lamp': {
        const l = lampSpot()
        const tx = l.x + Math.cos(t * 1.3) * 80 + Math.cos(t * 3.1) * 26
        const ty = l.y + Math.sin(t * 1.7) * 52 + Math.sin(t * 2.7) * 22
        steer(tx, ty, 300, dt, 260)
        h += (1 - h) * Math.min(1, dt * 3)
        if (mode === 'arrive' && Math.hypot(l.x - x, l.y - y) < 140) mode = 'lamp'
        if (hungry && clock > next - 2.8) {
          const i = o.pick()
          if (i !== null) { target = i; mode = 'drop'; o.onFlutter?.() }
          else next = clock + EVERY
        }
        break
      }
      case 'drop': {
        const p = letter(target)
        if (!p) { mode = 'lamp'; break }
        const near = d0(p)
        const d = steer(p.x, p.y - 2, 340, dt, near > 60 ? 220 : 30 * Math.min(1, near / 40))
        // Coming down: lower as it closes in, and slower.
        h += (Math.min(1, d / 90) - h) * Math.min(1, dt * 5)
        if (d < 9 && h < 0.22) { mode = 'landed'; vx = vy = 0; h = 0; chew = 0; rest = 0 }
        break
      }
      case 'landed': {
        const p = letter(target)
        if (!p) { mode = 'lamp'; break }
        // It stays on its letter if the text moves under it; it shuffles a little.
        x += (p.x - x) * Math.min(1, dt * 12)
        y += (p.y - 2 - y) * Math.min(1, dt * 12)
        rest += dt
        heading += Math.sin(t * 2.3) * dt * 0.3
        if (clock >= next) {
          chew += dt
          if (chew > 0.45) {
            const p = letter(target)
            if (p && o.eat(target)) crumbs(p.x, p.y, p.h)
            target = -1
            next = clock + EVERY
            mode = 'lamp'
            vx = (Math.random() - 0.5) * 120; vy = -200
            o.onFlutter?.()
          }
        }
        break
      }
      case 'leave': {
        const v = view()
        steer(v.left - 200, v.top - 160, 620, dt, 120)
        h += (1 - h) * Math.min(1, dt * 4)
        if (x < v.left - 100 || y < v.top - 100) { mode = 'away'; target = -1 }
        break
      }
    }
    if (mode !== 'landed') flap += dt * 2 * Math.PI * 11
  }
  const d0 = (p: { x: number; y: number }) => Math.hypot(p.x - x, p.y - y)

  /** What is left of a letter: flecks of ink and paper, scattered and fading. */
  function crumbs(cx: number, cy: number, size: number) {
    if (!o.animate) return
    for (let k = 0; k < 11; k++) {
      const c = document.createElement('i')
      c.className = 'rc-crumb'
      const s = 1.4 + Math.random() * 2.2
      c.style.cssText = `left:${cx}px;top:${cy + (Math.random() - 0.5) * size * 0.5}px;width:${s}px;height:${s * (0.6 + Math.random() * 0.8)}px;background:${k % 3 ? '#1d2030' : '#e9e7df'}`
      o.host.appendChild(c)
      const a = Math.random() * Math.PI * 2, d = 10 + Math.random() * 26
      const dx = (Math.cos(a) * d).toFixed(1), dy = (Math.sin(a) * d * 0.6 + 14).toFixed(1)
      c.animate([
        { transform: 'translate(-50%, -50%) rotate(0deg)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${(Math.random() * 400 - 200).toFixed(0)}deg)`, opacity: 0 },
      ], { duration: 700 + Math.random() * 500, easing: 'cubic-bezier(.2,.7,.4,1)', fill: 'forwards' }).onfinish = () => c.remove()
    }
  }

  /* ---- drawing -------------------------------------------------------- */

  function wings(span: number, pass: 'shadow' | 'body', sweep = 0) {
    // One side, mirrored. Forewing first, then the hindwing tucked under it.
    for (const side of [1, -1]) {
      g.save()
      g.scale(side * span, 1)
      // At rest a moth folds its wings back into a flat delta over its body.
      if (sweep) g.rotate(sweep)
      // Hindwing.
      g.beginPath()
      g.moveTo(1.5, 1)
      g.bezierCurveTo(9, 2, 17, 6, 17.5, 11)
      g.bezierCurveTo(16, 16, 9, 18, 2, 12)
      g.closePath()
      if (pass === 'body') {
        const hg = g.createLinearGradient(0, 0, 17, 14)
        hg.addColorStop(0, '#8d8273'); hg.addColorStop(1, '#c9bfae')
        g.fillStyle = hg
      }
      g.fill()
      // Forewing: long, swept back, with a squared tip.
      g.beginPath()
      g.moveTo(1.5, -5)
      g.bezierCurveTo(10, -8, 22, -7, 27.5, -2.5)
      g.bezierCurveTo(28.5, 0, 27, 3, 24, 5)
      g.bezierCurveTo(17, 9, 9, 11, 2.5, 8)
      g.closePath()
      if (pass === 'body') {
        const fg = g.createLinearGradient(0, -6, 28, 6)
        fg.addColorStop(0, '#6a6053'); fg.addColorStop(0.45, '#9a8f7f'); fg.addColorStop(1, '#b8ad9b')
        g.fillStyle = fg
        g.fill()
        // The pattern: two wavy cross-lines, a kidney spot, a pale fringe.
        g.save(); g.clip()
        g.strokeStyle = 'rgba(52, 44, 36, 0.55)'; g.lineWidth = 1.1
        g.beginPath(); g.moveTo(9, -8); g.quadraticCurveTo(11, 0, 8, 10); g.stroke()
        g.beginPath(); g.moveTo(18, -8); g.quadraticCurveTo(15.5, -1, 19, 3); g.quadraticCurveTo(20, 6, 16, 9); g.stroke()
        g.fillStyle = 'rgba(48, 40, 33, 0.5)'
        g.beginPath(); g.ellipse(13.5, -1, 2.2, 1.4, 0.4, 0, Math.PI * 2); g.fill()
        g.strokeStyle = 'rgba(236, 228, 212, 0.55)'; g.lineWidth = 1.4
        g.beginPath(); g.moveTo(27.5, -2.5); g.bezierCurveTo(28.5, 0, 27, 3, 24, 5); g.stroke()
        g.restore()
        g.strokeStyle = 'rgba(40, 34, 28, 0.5)'; g.lineWidth = 0.6; g.stroke()
      } else g.fill()
      g.restore()
    }
  }

  function body() {
    // Abdomen, segmented and tapering.
    const ag = g.createLinearGradient(-3, 0, 3, 0)
    ag.addColorStop(0, '#4f463c'); ag.addColorStop(0.5, '#8a7e6d'); ag.addColorStop(1, '#4f463c')
    g.fillStyle = ag
    g.beginPath(); g.ellipse(0, 7, 2.8, 8, 0, 0, Math.PI * 2); g.fill()
    g.strokeStyle = 'rgba(40, 33, 26, 0.45)'; g.lineWidth = 0.6
    for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(-2.4 + k * 0.2, 3 + k * 2.4); g.lineTo(2.4 - k * 0.2, 3 + k * 2.4); g.stroke() }
    // Thorax: fur.
    const tg = g.createRadialGradient(-1, -3, 0.5, 0, -2, 5)
    tg.addColorStop(0, '#b3a792'); tg.addColorStop(0.6, '#7c7161'); tg.addColorStop(1, '#4c4339')
    g.fillStyle = tg
    g.beginPath(); g.ellipse(0, -2, 4, 5, 0, 0, Math.PI * 2); g.fill()
    g.strokeStyle = 'rgba(220, 210, 190, 0.35)'; g.lineWidth = 0.5
    for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2; g.beginPath(); g.moveTo(Math.cos(a) * 3, -2 + Math.sin(a) * 4); g.lineTo(Math.cos(a) * 4.6, -2 + Math.sin(a) * 5.6); g.stroke() }
    // Head, eyes.
    g.fillStyle = '#5a5045'
    g.beginPath(); g.ellipse(0, -7.6, 2.6, 2.1, 0, 0, Math.PI * 2); g.fill()
    g.fillStyle = '#1c1915'
    g.beginPath(); g.arc(-1.9, -8, 0.9, 0, Math.PI * 2); g.arc(1.9, -8, 0.9, 0, Math.PI * 2); g.fill()
    // Feathered antennae.
    g.strokeStyle = '#5b5145'; g.lineWidth = 0.8
    for (const s of [1, -1]) {
      g.beginPath(); g.moveTo(s * 1, -9.4); g.quadraticCurveTo(s * 4, -15, s * 8.5, -18); g.stroke()
      g.lineWidth = 0.45
      for (let k = 1; k < 7; k++) {
        const u = k / 7, ax = s * (1 + 7.5 * u), ay = -9.4 - 8.6 * u
        g.beginPath(); g.moveTo(ax, ay); g.lineTo(ax + s * 1.4, ay + 0.6); g.moveTo(ax, ay); g.lineTo(ax - s * 0.6, ay - 1.2); g.stroke()
      }
      g.lineWidth = 0.8
    }
  }

  function draw() {
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.clearRect(0, 0, S, S)
    if (mode === 'away') return
    const flying = mode !== 'landed'
    // Seen from above, a beating wing is foreshortened: wide, then edge-on.
    const span = flying ? 0.34 + 0.66 * Math.abs(Math.cos(flap)) : 1
    const lift = h
    const scale = 1.2 + lift * 0.1
    const rot = heading + Math.PI / 2
    const bob = mode === 'landed' && clock >= next ? Math.sin(t * 40) * 0.5 : 0

    // Shadow first, down and to the right, softer the higher it is.
    g.save()
    g.translate(S / 2 + 3 + lift * 26, S / 2 + 4 + lift * 34)
    g.rotate(rot)
    g.scale(scale * (1 + lift * 0.12), scale * (1 + lift * 0.12))
    g.globalAlpha = 0.38 - lift * 0.16
    g.fillStyle = '#02050c'
    if ('filter' in g) (g as any).filter = `blur(${(0.8 + lift * 3.5).toFixed(1)}px)`
    wings(flying ? 0.75 : 0.92, 'shadow', flying ? 0 : 0.5)
    g.beginPath(); g.ellipse(0, 2, 3.5, 11, 0, 0, Math.PI * 2); g.fill()
    if ('filter' in g) (g as any).filter = 'none'
    g.restore()

    g.save()
    g.translate(S / 2, S / 2 + bob)
    g.rotate(rot)
    g.scale(scale, scale)
    if (flying) {
      // Two exposures of the beat, so it reads as a blur, not a strobe.
      g.globalAlpha = 0.3
      wings(0.34 + 0.66 * Math.abs(Math.cos(flap + 1.1)), 'body')
      g.globalAlpha = 0.92
    }
    wings(flying ? span : 0.92, 'body', flying ? 0 : 0.5)
    g.globalAlpha = 1
    body()
    g.restore()
  }

  function place() {
    cv.style.transform = `translate3d(${(x - S / 2).toFixed(1)}px, ${(y - S / 2).toFixed(1)}px, 0)`
  }

  /* ---- the loop -------------------------------------------------------- */
  function tick(now: number) {
    const dt = Math.min(1 / 30, (now - last) / 1000 || 1 / 60)
    last = now
    if (!o.paused()) { if (o.animate) step(dt); else stepStill(dt) }
    cv.hidden = mode === 'away'
    if (!cv.hidden) { place(); draw() }
    const idle = mode === 'away' && !(o.present() && o.hungry())
    raf = idle ? 0 : requestAnimationFrame(tick)
  }

  /** With reduced motion: no flight. It is simply on the letter it will eat. */
  function stepStill(dt: number) {
    const hungry = o.present() && o.hungry()
    if (!hungry) { mode = 'away'; return }
    clock += dt
    if (mode === 'away') { next = clock + EVERY; mode = 'landed'; target = o.pick() ?? -1 }
    if (target < 0 || !letter(target)) target = o.pick() ?? -1
    const p = target >= 0 ? letter(target) : null
    if (p) { x = p.x; y = p.y - 2 }
    h = 0; heading = -Math.PI / 2 + 0.3
    if (clock >= next) {
      if (target >= 0) o.eat(target)
      next = clock + EVERY
      target = o.pick() ?? -1
    }
  }

  /** Something changed: the moth may need to come, or go. */
  function poke() {
    if (raf) return
    last = performance.now()
    raf = requestAnimationFrame(tick)
  }

  return {
    poke,
    get mode() { return mode },
    get where() { return { x, y } },
    reset() { mode = 'away'; target = -1; clock = 0; next = EVERY; cv.hidden = true },
    dispose() { cancelAnimationFrame(raf); caret.dispose(); cv.remove() },
  }
}
