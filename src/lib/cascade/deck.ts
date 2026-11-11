/**
 * The rule cards, as cards on a desk.
 *
 * The list used to be boxes that FLIP-slid into their new order. Paper on a
 * desk does not slide like that. A card that has to go somewhere else is
 * picked up, carried, and put down again: it rises off the desk (its shadow
 * drops away from it and softens), it swings a little as it travels, and
 * when it arrives it falls the last few millimetres and taps down. New rules
 * are tossed onto the desk from its far edge, which is the cascade.
 *
 * Rules still to meet lie in a column, one under another, where you can read
 * them. Rules you have met go on the pile: squared up roughly, the way paper
 * is when someone stacks it without care, each a little turned and a little
 * off, the newest on top. The pile gets visibly thicker as you go. Spread it
 * and the approved cards fan out into a readable column of strips.
 *
 * Each card is a body with a position, a turn and a height above the desk,
 * all on damped springs towards wherever the layout wants it, except the
 * height, which falls under gravity once the card is close enough to put
 * down. The DOM keeps its reading order; this only moves what you see.
 */

export type DeckCard = {
  id: number
  el: HTMLElement
  shadow: HTMLElement
  x: number; y: number; r: number; z: number
  vx: number; vy: number; vr: number; vz: number
  tx: number; ty: number; tr: number
  h: number
  /** Stacking order the layout wants; a card in the air goes above it all. */
  order: number
  /** Which way this card swings when carried: a hand holds it off-centre. */
  hand: number
  /** Seeded scatter for the pile, so a card always lands the same way. */
  jx: number; jr: number
  peek: number
}

const GAP = 12
/** How much of each approved card shows when the pile is spread out. */
export const STRIP = 62

/** Small seeded noise per card id. */
const rnd = (id: number, k: number) => {
  const s = Math.sin(id * 127.1 + k * 311.7) * 43758.5453
  return s - Math.floor(s)
}

export function createDeck(o: {
  tray: HTMLElement
  animate: boolean
  /** A card touched down on the desk; `hard` is how fast, 0..1. */
  onLand?: (c: DeckCard, hard: number) => void
}) {
  const cards = new Map<number, DeckCard>()
  let raf = 0
  let last = 0
  let height = 0
  let fanned = false
  let pileTop = 0

  function add(id: number, el: HTMLElement) {
    const shadow = el.querySelector<HTMLElement>('.rc-shadow')!
    const c: DeckCard = {
      id, el, shadow,
      x: 0, y: 0, r: 0, z: 0, vx: 0, vy: 0, vr: 0, vz: 0,
      tx: 0, ty: 0, tr: 0, h: 0, order: 0,
      hand: rnd(id, 1) < 0.5 ? -1 : 1,
      jx: (rnd(id, 2) - 0.5) * 16, jr: (rnd(id, 3) - 0.5) * 6.4,
      peek: 0,
    }
    cards.set(id, c)
    return c
  }

  /** Throw a card in from beyond the top right of the desk. */
  function toss(c: DeckCard) {
    const from = o.tray.getBoundingClientRect()
    c.x = c.tx + Math.min(260, innerWidth - from.right + 180) * (0.7 + rnd(c.id, 4) * 0.3)
    c.y = c.ty - 240 - rnd(c.id, 5) * 80
    c.r = c.tr + 18 + rnd(c.id, 6) * 16
    c.z = 1.35
    c.vx = -300; c.vy = 520; c.vr = -40; c.vz = 0
    paint(c)
  }

  /**
   * Where everything should be. `unmet` top to bottom; `met` from the bottom
   * of the pile to the top.
   */
  function layout(unmet: number[], met: number[], opts: { fanned?: boolean } = {}) {
    if (opts.fanned !== undefined) fanned = opts.fanned
    const W = o.tray.clientWidth
    for (const c of cards.values()) c.h = c.el.offsetHeight
    let y = 0
    unmet.forEach((id, i) => {
      const c = cards.get(id)!
      c.ty = y; c.tx = (rnd(id, 7) - 0.5) * 6; c.tr = (rnd(id, 8) - 0.5) * 1.3
      c.order = 60 + i
      y += c.h + GAP
    })
    pileTop = unmet.length ? y + 22 : 0
    let bottom = y
    met.forEach((id, i) => {
      const c = cards.get(id)!
      if (fanned) {
        c.ty = pileTop + i * STRIP; c.tx = 0; c.tr = (rnd(id, 9) - 0.5) * 0.8
      } else {
        // Roughly squared: a couple of pixels of paper per card, and every
        // card a little off and a little turned.
        c.ty = pileTop + i * 2.4; c.tx = c.jx * (W > 420 ? 1 : 0.6); c.tr = c.jr
      }
      c.order = 10 + i
      bottom = Math.max(bottom, c.ty + c.h)
    })
    height = Math.ceil(bottom + 24)
    o.tray.style.height = height + 'px'
    if (!o.animate) { for (const c of cards.values()) settle(c); return }
    wake()
  }

  function settle(c: DeckCard) {
    c.x = c.tx; c.y = c.ty; c.r = c.tr; c.z = 0
    c.vx = c.vy = c.vr = c.vz = 0
    paint(c)
  }

  /** The stamp comes down on it: pressed into the desk, then it relaxes. */
  function press(id: number) {
    const c = cards.get(id)
    if (!c || !o.animate) return
    c.vz -= 1.4; c.vr += c.hand * 14
    wake()
  }

  /** It stopped being true: the card jumps, as if someone slapped the desk. */
  function jolt(id: number) {
    const c = cards.get(id)
    if (!c || !o.animate) return
    c.vz += 2.2; c.vr += c.hand * 90; c.vx += c.hand * 120
    wake()
  }

  function lookAt(id: number | null) {
    for (const c of cards.values()) c.peek = c.id === id ? 1 : 0
    wake()
  }

  function remove(id: number) { cards.delete(id) }
  function setFanned(v: boolean) { fanned = v }
  function clear() { cards.clear() }

  function paint(c: DeckCard) {
    const lift = Math.max(0, c.z) + c.peek * 0.35
    const s = 1 + lift * 0.035
    c.el.style.transform = `translate3d(${c.x.toFixed(2)}px, ${(c.y - c.peek * 6).toFixed(2)}px, 0) rotate(${c.r.toFixed(3)}deg) scale(${s.toFixed(4)})`
    // Lit from the upper left, so the shadow falls down and to the right,
    // further and softer the higher the card is.
    c.shadow.style.transform = `translate(${(1 + lift * 12).toFixed(1)}px, ${(2 + lift * 18).toFixed(1)}px) scale(${(1 + lift * 0.05).toFixed(3)})`
    c.shadow.style.opacity = String(Math.max(0.35, 1 - lift * 0.4).toFixed(3))
    const air = lift > 0.08 || Math.hypot(c.tx - c.x, c.ty - c.y) > 30
    c.el.style.zIndex = String(c.peek ? 400 : air ? 200 + c.order : c.order)
  }

  function step(dt: number) {
    let busy = false
    for (const c of cards.values()) {
      const dx = c.tx - c.x, dy = c.ty - c.y
      const far = Math.hypot(dx, dy)
      // Carried: springs for the hand, a swing from how fast it is going.
      const k = 150, damp = 2 * 0.78 * Math.sqrt(k)
      c.vx += (k * dx - damp * c.vx) * dt
      c.vy += (k * dy - damp * c.vy) * dt
      const swing = Math.max(-7, Math.min(7, c.vy * 0.006 * c.hand + c.vx * 0.01))
      const kr = 120, dr = 2 * 0.6 * Math.sqrt(kr)
      c.vr += (kr * (c.tr + swing - c.r) - dr * c.vr) * dt
      // Up while it is being carried any distance; down under gravity once
      // it is nearly there, with a small bounce when it meets the desk.
      if (far > 26) {
        const kz = 60, dz = 2 * 0.9 * Math.sqrt(kz)
        c.vz += (kz * (Math.min(0.75, 0.25 + far / 500) - c.z) - dz * c.vz) * dt
      } else c.vz -= 9 * dt
      c.x += c.vx * dt; c.y += c.vy * dt; c.r += c.vr * dt; c.z += c.vz * dt
      if (c.z < 0) {
        const hard = Math.min(1, -c.vz / 3)
        if (c.vz < -0.5) { c.vz = -c.vz * 0.28; o.onLand?.(c, hard) } else c.vz = 0
        c.z = 0
      }
      if (far > 0.25 || Math.abs(c.vx) + Math.abs(c.vy) > 2 || Math.abs(c.vr) > 0.4 || c.z > 0.002 || Math.abs(c.vz) > 0.01 || Math.abs(c.tr - c.r) > 0.05) busy = true
      paint(c)
    }
    return busy
  }

  function tick(now: number) {
    const dt = Math.min(1 / 30, (now - last) / 1000 || 1 / 60)
    last = now
    // Two substeps: the springs are stiff enough to wobble at 30 fps.
    const a = step(dt / 2), b = step(dt / 2)
    raf = a || b ? requestAnimationFrame(tick) : 0
  }

  function wake() {
    if (!o.animate || raf) return
    last = performance.now()
    raf = requestAnimationFrame(tick)
  }

  return {
    add, toss, layout, press, jolt, lookAt, remove, clear, settle, setFanned,
    get(id: number) { return cards.get(id) },
    get height() { return height },
    get pileTop() { return pileTop },
    get fanned() { return fanned },
  }
}
