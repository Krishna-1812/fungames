/**
 * Paper & Ink — the motion layer.
 *
 * One module, imported once by the Paper layout. Every effect checks `PLAY`
 * first and returns if it is off, so under reduced motion (or before this
 * file has loaded at all) the page is exactly its finished HTML and CSS.
 *
 * The rule that shapes most of this: nothing arrives card by card with an
 * index delay. Motion is typographic — lines of a headline, digits of a
 * number, letters of a wordmark — or it is one block settling as one object.
 */

const root = document.documentElement
export const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches
export const PLAY = root.classList.contains('play') && !REDUCED

const raf = (fn: FrameRequestCallback) => requestAnimationFrame(fn)
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

/* ------------------------------------------------------------------------ */
/* Reveal observer (A, B, C, D, I, M)                                        */
/* ------------------------------------------------------------------------ */

const revealed = new WeakSet<Element>()
const onReveal = new WeakMap<Element, () => void>()

const io =
  'IntersectionObserver' in window
    ? new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (!e.isIntersecting) continue
            const el = e.target
            io!.unobserve(el)
            if (revealed.has(el)) continue
            revealed.add(el)
            el.classList.add('is-in')
            onReveal.get(el)?.()
          }
        },
        { threshold: 0.18, rootMargin: '0px 0px -6% 0px' },
      )
    : null

/** Observe an (unclipped) wrapper; `fn` runs once when it first shows. */
export function whenSeen(el: Element, fn?: () => void) {
  if (fn) onReveal.set(el, fn)
  if (!io) { el.classList.add('is-in'); fn?.(); return }
  io.observe(el)
}

function initReveals(scope: ParentNode = document) {
  scope.querySelectorAll('[data-reveal], [data-settle], .marker[data-draw]').forEach((el) => {
    if (!PLAY) { el.classList.add('is-in'); return }
    whenSeen(el)
  })
}

/* ------------------------------------------------------------------------ */
/* Letter splitting, shared by springy headlines and the wordmark           */
/* ------------------------------------------------------------------------ */

/** Wrap every visible character in `.ch`, keeping any inline wrappers
 *  (the marker, the wonky italic) exactly where they were. */
export function splitLetters(el: HTMLElement): HTMLElement[] {
  if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', el.textContent!.replace(/\s+/g, ' ').trim())
  const out: HTMLElement[] = []
  const walk = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent ?? ''
        if (!text.trim()) continue
        const frag = document.createDocumentFragment()
        // Words stay together so a line can only break between them.
        for (const part of text.split(/(\s+)/)) {
          if (!part) continue
          if (/^\s+$/.test(part)) { frag.append(document.createTextNode(part)); continue }
          const word = document.createElement('span')
          word.style.display = 'inline-block'
          word.style.whiteSpace = 'nowrap'
          word.setAttribute('aria-hidden', 'true')
          for (const c of part) {
            const s = document.createElement('span')
            s.className = 'ch'
            s.textContent = c
            word.append(s)
            out.push(s)
          }
          frag.append(word)
        }
        child.replaceWith(frag)
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        walk(child)
      }
    }
  }
  walk(el)
  return out
}

/* ------------------------------------------------------------------------ */
/* E. Springy letters                                                        */
/* ------------------------------------------------------------------------ */

function initSpringy() {
  if (!PLAY || !matchMedia('(hover: hover)').matches) return
  document.querySelectorAll<HTMLElement>('[data-springy]').forEach((el) => {
    el.classList.add('springy')
    const letters = splitLetters(el)
    let centres: { x: number; y: number }[] = []
    let dirty = true
    let live = false
    let px = -1e4, py = -1e4
    let queued = false
    const R = 170
    const measure = () => {
      centres = letters.map((l) => {
        const r = l.getBoundingClientRect()
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
      })
      dirty = false
    }
    const markDirty = () => { dirty = true }
    addEventListener('resize', markDirty, { passive: true })
    addEventListener('scroll', markDirty, { passive: true })

    const frame = () => {
      queued = false
      if (dirty) measure()
      letters.forEach((l, i) => {
        const c = centres[i]
        const d = Math.hypot(c.x - px, c.y - py)
        const k = live ? clamp(1 - d / R, 0, 1) : 0
        // Ease the falloff so the swell is a hill, not a cone.
        const w = Math.round(600 + 280 * (k * k * (3 - 2 * k)))
        const next = `'SOFT' 0, 'WONK' 1, 'opsz' 144, 'wght' ${w}`
        if (l.dataset.w !== String(w)) {
          l.dataset.w = String(w)
          l.style.fontVariationSettings = next
        }
      })
    }
    const queue = () => { if (!queued) { queued = true; raf(frame) } }

    addEventListener(
      'pointermove',
      (e) => {
        const r = el.getBoundingClientRect()
        const near = e.clientX > r.left - R && e.clientX < r.right + R && e.clientY > r.top - R && e.clientY < r.bottom + R
        if (!near && !live) return
        px = e.clientX; py = e.clientY
        if (near !== live) { live = near; el.classList.toggle('is-live', near) }
        queue()
      },
      { passive: true },
    )
    document.addEventListener('pointerleave', () => { live = false; el.classList.remove('is-live'); queue() })
  })
}

/* ------------------------------------------------------------------------ */
/* F. Pill flood and G. card flood                                           */
/* ------------------------------------------------------------------------ */

function initFloods() {
  if (!PLAY) return
  let lastPill: Element | null = null
  let lastCard: Element | null = null
  document.addEventListener(
    'pointerover',
    (e) => {
      const t = e.target as HTMLElement
      const pill = t.closest?.('.pill') as HTMLElement | null
      if (pill && pill !== lastPill) {
        const r = pill.getBoundingClientRect()
        pill.style.setProperty('--x', `${e.clientX - r.left}px`)
        pill.style.setProperty('--y', `${e.clientY - r.top}px`)
      }
      lastPill = pill
      const card = t.closest?.('.gcard') as HTMLElement | null
      if (card && card !== lastCard) {
        const r = card.getBoundingClientRect()
        card.style.setProperty('--fx', e.clientX - r.left < r.width / 2 ? '0%' : '100%')
        card.style.setProperty('--fy', e.clientY - r.top < r.height / 2 ? '0%' : '100%')
      }
      lastCard = card
    },
    { passive: true },
  )
  // Keyboard focus floods from the centre rather than a stale corner.
  document.addEventListener('focusin', (e) => {
    const t = e.target as HTMLElement
    if (t.matches?.('.pill')) { t.style.setProperty('--x', '50%'); t.style.setProperty('--y', '50%') }
    if (t.matches?.('.gcard')) { t.style.setProperty('--fx', '50%'); t.style.setProperty('--fy', '50%') }
  })
}

/* ------------------------------------------------------------------------ */
/* H. Odometer                                                               */
/* ------------------------------------------------------------------------ */

const odoState = new WeakMap<HTMLElement, { text: string; timer: number }>()

/**
 * Roll `el` to `text`. Each digit column starts from the digit that sat in the
 * same position (counted from the right) last time, so 98 -> 102 rolls the
 * units 8 -> 2 and the tens 9 -> 0 rather than every column from zero. Once
 * landed the columns are swapped back for plain text so the figures sit
 * proportionally again.
 */
export function roll(el: HTMLElement, text: string, opts: { from?: string; ms?: number } = {}) {
  const prev = opts.from ?? odoState.get(el)?.text ?? el.textContent ?? ''
  const old = odoState.get(el)
  if (old) clearTimeout(old.timer)
  if (!PLAY || prev === text) {
    el.textContent = text
    odoState.set(el, { text, timer: 0 })
    return
  }
  const ms = opts.ms ?? 1100
  const prevDigits = prev.replace(/\D/g, '')
  const totalDigits = text.replace(/\D/g, '').length
  let digitIndex = 0
  el.textContent = ''
  const wrap = document.createElement('span')
  wrap.className = 'odo'
  wrap.setAttribute('aria-hidden', 'true')
  const strips: [HTMLElement, number][] = []
  for (const c of text) {
    if (/\d/.test(c)) {
      const fromRight = totalDigits - 1 - digitIndex++
      const startCh = prevDigits[prevDigits.length - 1 - fromRight]
      const start = startCh === undefined ? 0 : Number(startCh)
      const col = document.createElement('span')
      col.className = 'odo-col'
      const strip = document.createElement('span')
      strip.className = 'odo-strip'
      for (let d = 0; d <= 9; d++) {
        const s = document.createElement('span')
        s.textContent = String(d)
        strip.append(s)
      }
      strip.style.transform = `translateY(${-start * 10}%)`
      col.append(strip)
      wrap.append(col)
      strips.push([strip, Number(c)])
    } else {
      const s = document.createElement('span')
      s.className = 'odo-sym'
      s.textContent = c
      wrap.append(s)
    }
  }
  const sr = document.createElement('span')
  sr.className = 'sr-only'
  sr.textContent = text
  el.append(wrap, sr)
  // Two frames so the start position is committed before the transition.
  raf(() => raf(() => {
    for (const [strip, d] of strips) {
      strip.style.transition = `transform ${ms}ms cubic-bezier(.22,1,.36,1)`
      strip.style.transform = `translateY(${-d * 10}%)`
    }
  }))
  const timer = window.setTimeout(() => { el.textContent = text }, ms + 60)
  odoState.set(el, { text, timer })
}

function initOdometers() {
  document.querySelectorAll<HTMLElement>('[data-odo]').forEach((el) => {
    const target = el.dataset.odo ?? el.textContent ?? ''
    if (!PLAY) { el.textContent = target; return }
    const zero = target.replace(/\d/g, '0')
    el.textContent = zero
    odoState.set(el, { text: zero, timer: 0 })
    whenSeen(el, () => roll(el, target))
  })
}

/* ------------------------------------------------------------------------ */
/* J. Ticker, skewed by scroll velocity                                     */
/* ------------------------------------------------------------------------ */

function initTicker() {
  if (!PLAY) return
  const tracks = document.querySelectorAll<HTMLElement>('.ticker-track')
  if (!tracks.length) return
  let lastY = scrollY
  let lastT = performance.now()
  let skew = 0
  let running = false
  const step = () => {
    skew *= 0.9
    if (Math.abs(skew) < 0.02) { skew = 0; running = false }
    tracks.forEach((t) => t.style.setProperty('--skew', `${skew.toFixed(2)}deg`))
    if (running) raf(step)
  }
  addEventListener(
    'scroll',
    () => {
      const now = performance.now()
      const v = (scrollY - lastY) / Math.max(1, now - lastT)
      lastY = scrollY; lastT = now
      skew = clamp(skew + v * -3, -7, 7)
      if (!running) { running = true; raf(step) }
    },
    { passive: true },
  )
}

/* ------------------------------------------------------------------------ */
/* K. Decode labels                                                          */
/* ------------------------------------------------------------------------ */

const GLYPHS = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&*+'

function decode(el: HTMLElement) {
  const final = el.textContent ?? ''
  el.setAttribute('aria-label', final)
  const view = document.createElement('span')
  view.setAttribute('aria-hidden', 'true')
  el.textContent = ''
  el.append(view)
  const start = performance.now()
  const dur = 700
  const frame = (now: number) => {
    const p = clamp((now - start) / dur, 0, 1)
    const settled = Math.floor(p * final.length)
    let s = final.slice(0, settled)
    for (let i = settled; i < final.length; i++) {
      const c = final[i]
      s += c === ' ' || c === '·' ? c : GLYPHS[(Math.random() * GLYPHS.length) | 0]
    }
    view.textContent = s
    if (p < 1) raf(frame)
    else el.textContent = final
  }
  raf(frame)
}

function initDecode() {
  if (!PLAY) return
  document.querySelectorAll<HTMLElement>('[data-decode]').forEach((el) => whenSeen(el, () => decode(el)))
}

/* ------------------------------------------------------------------------ */
/* N. Confetti                                                               */
/* ------------------------------------------------------------------------ */

const CONFETTI = ['#ff6022', '#ffb500', '#8ccbff', '#ff3b30', '#121213']
let layer: HTMLElement | null = null

export function confetti(x = innerWidth / 2, y = innerHeight / 3, count = 42) {
  if (!PLAY) return
  if (!layer) {
    layer = document.createElement('div')
    layer.className = 'confetti-layer'
    layer.setAttribute('aria-hidden', 'true')
    document.body.append(layer)
  }
  type Bit = { el: HTMLElement; x: number; y: number; vx: number; vy: number; r: number; vr: number; life: number }
  const bits: Bit[] = []
  for (let i = 0; i < count; i++) {
    const el = document.createElement('i')
    el.className = 'confetti-bit'
    const kind = i % 3
    const c = CONFETTI[i % CONFETTI.length]
    const size = 7 + Math.random() * 7
    if (kind === 0) Object.assign(el.style, { width: size + 'px', height: size + 'px', borderRadius: '50%', background: c })
    else if (kind === 1) Object.assign(el.style, { width: size * 1.9 + 'px', height: size * 0.8 + 'px', borderRadius: '999px', background: c })
    else Object.assign(el.style, { width: size + 'px', height: size + 'px', background: c, clipPath: 'polygon(50% 0, 100% 100%, 0 100%)' })
    layer.append(el)
    const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1
    const sp = 7 + Math.random() * 9
    bits.push({ el, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: Math.random() * 360, vr: (Math.random() - 0.5) * 22, life: 0 })
  }
  let last = performance.now()
  const frame = (now: number) => {
    const dt = Math.min(2, (now - last) / 16.7)
    last = now
    let alive = 0
    for (const b of bits) {
      if (!b.el.isConnected) continue
      b.vy += 0.42 * dt
      b.vx *= 0.99
      b.x += b.vx * dt
      b.y += b.vy * dt
      b.r += b.vr * dt
      b.life += dt
      const fade = b.life > 70 ? Math.max(0, 1 - (b.life - 70) / 30) : 1
      b.el.style.transform = `translate(${b.x}px, ${b.y}px) rotate(${b.r}deg)`
      b.el.style.opacity = String(fade)
      if (fade <= 0 || b.y > innerHeight + 40) b.el.remove()
      else alive++
    }
    if (alive) raf(frame)
  }
  raf(frame)
}

function initConfettiTriggers() {
  if (!PLAY) return
  document.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest?.('[data-confetti]') as HTMLElement | null
    if (!t) return
    const r = t.getBoundingClientRect()
    const x = e.clientX || r.left + r.width / 2
    const y = e.clientY || r.top + r.height / 2
    confetti(x, y, 36)
  })
}

/* ------------------------------------------------------------------------ */
/* Masthead: solid on scroll, and the progress bar                          */
/* ------------------------------------------------------------------------ */

function initMasthead() {
  const head = document.querySelector<HTMLElement>('.masthead')
  const bar = document.querySelector<HTMLElement>('.progress-bar')
  if (!head && !bar) return
  let queued = false
  const frame = () => {
    queued = false
    const y = scrollY
    head?.classList.toggle('is-solid', y > 12)
    if (bar) {
      const max = document.documentElement.scrollHeight - innerHeight
      bar.style.transform = `scaleX(${max > 0 ? clamp(y / max, 0, 1) : 0})`
    }
  }
  addEventListener('scroll', () => { if (!queued) { queued = true; raf(frame) } }, { passive: true })
  addEventListener('resize', frame, { passive: true })
  frame()
}

/* ------------------------------------------------------------------------ */
/* M. Footer wordmark: letters rise, then hop under the pointer             */
/* ------------------------------------------------------------------------ */

function initWordmark() {
  const el = document.querySelector<HTMLElement>('.wordmark')
  if (!el) return
  if (!PLAY) return
  const letters = splitLetters(el)
  letters.forEach((l, i) => l.style.setProperty('--i', String(i)))
  el.setAttribute('data-reveal', '')
  whenSeen(el, () => {
    setTimeout(() => el.classList.add('is-landed'), 900 + letters.length * 45)
  })
  el.addEventListener(
    'pointermove',
    (e) => {
      if (!el.classList.contains('is-landed')) return
      const hit = (e.target as HTMLElement).closest('.ch') as HTMLElement | null
      if (!hit || hit.classList.contains('is-hop')) return
      hit.classList.add('is-hop')
      setTimeout(() => hit.classList.remove('is-hop'), 170)
    },
    { passive: true },
  )
}

/* ------------------------------------------------------------------------ */
/* Portal: the ink band opens from a small rounded window                   */
/* ------------------------------------------------------------------------ */

function initPortals() {
  if (!PLAY) return
  const portals = document.querySelectorAll<HTMLElement>('.portal')
  if (!portals.length) return
  let queued = false
  const frame = () => {
    queued = false
    portals.forEach((p) => {
      const r = p.getBoundingClientRect()
      // 0 when the band's top enters the bottom of the screen, 1 once it has
      // travelled 55% of the viewport up.
      const t = clamp((innerHeight - r.top) / (innerHeight * 0.55), 0, 1)
      const e = 1 - Math.pow(1 - t, 3)
      const inner = p.firstElementChild as HTMLElement
      inner.style.setProperty('--pi', `${((1 - e) * 22).toFixed(2)}%`)
      inner.style.setProperty('--pj', `${((1 - e) * 34).toFixed(2)}%`)
      inner.style.setProperty('--pr', `${(24 + (1 - e) * 280).toFixed(1)}px`)
    })
  }
  addEventListener('scroll', () => { if (!queued) { queued = true; raf(frame) } }, { passive: true })
  addEventListener('resize', frame, { passive: true })
  frame()
}

/* ------------------------------------------------------------------------ */
/* The deck: deals itself, drifts against the pointer, can be thrown        */
/* ------------------------------------------------------------------------ */

function initDeck() {
  const deck = document.querySelector<HTMLElement>('.deck')
  if (!deck || !PLAY) return
  let cards = Array.from(deck.querySelectorAll<HTMLElement>('.deck-card'))
  if (cards.length < 2) return

  let driftX = 0, driftY = 0
  let held: { card: HTMLElement; x0: number; y0: number; dx: number; dy: number; t: number; vx: number; vy: number } | null = null
  let dealTimer = 0
  let moved = false

  const place = () => {
    cards.forEach((c, k) => {
      c.style.setProperty('--k', String(k))
      c.style.zIndex = String(10 - k)
      if (c === held?.card) return
      const depth = 1 - k * 0.22
      c.style.transform =
        `translate(calc(${k} * 14px + ${driftX * depth}px), calc(${k} * -14px + ${driftY * depth}px)) ` +
        `rotate(${k * 3}deg) scale(${1 - k * 0.04})`
      c.tabIndex = k === 0 ? 0 : -1
      c.setAttribute('aria-hidden', k === 0 ? 'false' : 'true')
    })
  }

  const sendTop = (dirX = 1, dirY = -0.2) => {
    const top = cards[0]
    top.classList.add('is-flying')
    top.style.transform = `translate(${dirX * 120}%, ${dirY * 60}%) rotate(${dirX * 24}deg)`
    setTimeout(() => {
      top.classList.remove('is-flying')
      cards = [...cards.slice(1), top]
      place()
    }, 420)
  }

  const schedule = () => {
    clearInterval(dealTimer)
    dealTimer = window.setInterval(() => {
      if (!held && !deck.matches(':hover') && !deck.contains(document.activeElement) && document.visibilityState === 'visible') sendTop()
    }, 3600)
  }

  addEventListener(
    'pointermove',
    (e) => {
      if (held) return
      const r = deck.getBoundingClientRect()
      driftX = clamp(((e.clientX - (r.left + r.width / 2)) / innerWidth) * -26, -14, 14)
      driftY = clamp(((e.clientY - (r.top + r.height / 2)) / innerHeight) * -20, -10, 10)
      place()
    },
    { passive: true },
  )

  deck.addEventListener('pointerdown', (e) => {
    const card = (e.target as HTMLElement).closest('.deck-card') as HTMLElement | null
    if (!card || card !== cards[0] || e.button !== 0) return
    held = { card, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0, t: performance.now(), vx: 0, vy: 0 }
    moved = false
    card.classList.add('is-held')
    card.setPointerCapture(e.pointerId)
  })
  deck.addEventListener('pointermove', (e) => {
    if (!held) return
    const now = performance.now()
    const dx = e.clientX - held.x0
    const dy = e.clientY - held.y0
    const dt = Math.max(1, now - held.t)
    held.vx = (dx - held.dx) / dt
    held.vy = (dy - held.dy) / dt
    held.dx = dx; held.dy = dy; held.t = now
    if (Math.hypot(dx, dy) > 6) moved = true
    held.card.style.transform = `translate(${dx}px, ${dy}px) rotate(${dx * 0.06}deg)`
  })
  const release = () => {
    if (!held) return
    const { card, dx, dy, vx, vy } = held
    held = null
    card.classList.remove('is-held')
    const far = Math.hypot(dx, dy) > 140 || Math.hypot(vx, vy) > 0.9
    if (far) {
      sendTop(Math.sign(dx || vx || 1), clamp(dy / 200, -1, 1))
    } else {
      // Home again, with the spring's own overshoot as the wobble.
      card.style.transform = `translate(${-dx * 0.12}px, ${-dy * 0.12}px) rotate(${-dx * 0.03}deg)`
      setTimeout(place, 90)
    }
    schedule()
  }
  deck.addEventListener('pointerup', release)
  deck.addEventListener('pointercancel', release)
  // A drag must never also be a click-through.
  deck.addEventListener('click', (e) => { if (moved) { e.preventDefault(); moved = false } }, true)
  deck.addEventListener('dragstart', (e) => e.preventDefault())

  place()
  schedule()
}

/* ------------------------------------------------------------------------ */
/* FLIP, for anything that re-flows                                         */
/* ------------------------------------------------------------------------ */

/**
 * Record where `items` are, run `mutate`, then carry each one from its old
 * position to its new one with a transform. Items that were hidden and are now
 * shown settle in from scale(.94) instead of fading.
 */
export function flip(items: HTMLElement[], mutate: () => void) {
  if (!PLAY) { mutate(); return }
  const before = new Map<HTMLElement, DOMRect | null>()
  for (const el of items) before.set(el, el.hidden ? null : el.getBoundingClientRect())
  mutate()
  for (const el of items) {
    if (el.hidden) continue
    const was = before.get(el)
    const now = el.getBoundingClientRect()
    el.classList.remove('is-moving', 'is-arriving', 'is-settling')
    if (!was) {
      el.classList.add('is-arriving')
      void el.offsetWidth
      el.classList.add('is-settling')
      setTimeout(() => el.classList.remove('is-arriving', 'is-settling'), 700)
      continue
    }
    const dx = was.left - now.left
    const dy = was.top - now.top
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue
    el.style.transform = `translate(${dx}px, ${dy}px)`
    void el.offsetWidth
    el.classList.add('is-moving')
    el.style.transform = ''
    setTimeout(() => el.classList.remove('is-moving'), 660)
  }
}

/* ------------------------------------------------------------------------ */

let started = false
export function initMotion() {
  if (started) return
  started = true
  initReveals()
  initSpringy()
  initFloods()
  initOdometers()
  initTicker()
  initDecode()
  initConfettiTriggers()
  initMasthead()
  initWordmark()
  initPortals()
  initDeck()
  root.classList.add('motion-ready')
}
