/**
 * The list of games under the island, as it is met.
 *
 *   - each card comes up into place the first time it scrolls into view, a
 *     beat after the one before it;
 *   - under a mouse a card leans toward the pointer, and a soft light on its
 *     picture follows it.
 *
 * Without script, or with motion off, the cards simply stand there.
 */
export function gridFx(grid: HTMLElement) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const slots = [...grid.querySelectorAll<HTMLElement>('.gs-slot')]

  /* ---- coming into view ---- */
  if ('IntersectionObserver' in window) {
    grid.classList.add('is-fx')
    let wave = 0, waveAt = 0
    const show = (el: HTMLElement) => {
      // Cards that arrive together come up one after another.
      const now = performance.now()
      if (now - waveAt > 120) wave = 0
      waveAt = now
      el.style.setProperty('--in', `${Math.min(wave++, 7) * 55}ms`)
      el.classList.add('is-in')
    }
    const io = new IntersectionObserver((es) => {
      for (const e of es) if (e.isIntersecting) { show(e.target as HTMLElement); io.unobserve(e.target) }
    }, { rootMargin: '0px 0px -6% 0px' })
    for (const s of slots) io.observe(s)
    // Whatever a filter or a search brings in (or a jump down the page skips past) is not left waiting.
    const all = () => { for (const s of slots) if (!s.classList.contains('is-in')) { const r = s.getBoundingClientRect(); if (r.bottom < 0 || s.hidden) { s.style.setProperty('--in', '0ms'); s.classList.add('is-in'); io.unobserve(s) } } }
    addEventListener('scroll', all, { passive: true })
    grid.addEventListener('gs:filter', () => { for (const s of slots) { s.style.setProperty('--in', '0ms'); s.classList.add('is-in'); io.unobserve(s) } })
  }

  /* ---- leaning toward the pointer ---- */
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return
  let raf = 0, cur: HTMLElement | null = null, px = 0, py = 0
  const apply = () => {
    raf = 0
    if (!cur) return
    const r = cur.getBoundingClientRect(), u = (px - r.left) / r.width, v = (py - r.top) / r.height
    cur.style.setProperty('--ry', `${((u - 0.5) * 9).toFixed(2)}deg`)
    cur.style.setProperty('--rx', `${((0.5 - v) * 7).toFixed(2)}deg`)
    cur.style.setProperty('--mx', `${(u * 100).toFixed(1)}%`)
    cur.style.setProperty('--my', `${(v * 100).toFixed(1)}%`)
  }
  grid.addEventListener('pointermove', (e) => {
    const card = (e.target as Element).closest?.<HTMLElement>('.gc') ?? null
    if (card !== cur) { cur?.classList.remove('is-lean'); cur = card; cur?.classList.add('is-lean') }
    px = e.clientX; py = e.clientY
    if (cur && !raf) raf = requestAnimationFrame(apply)
  })
  grid.addEventListener('pointerleave', () => { cur?.classList.remove('is-lean'); cur = null })
}
