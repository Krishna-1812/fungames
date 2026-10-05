/**
 * The admin page's charts, drawn as SVG (or plain HTML bars) to the width of
 * their card, in the theme's tokens (--s1…--s4 for series, --q0…--q5 for a
 * one-hue blue ramp). Every one answers hover and keyboard focus with the
 * shared tooltip; every value is also in the card's table view.
 *
 * Rules kept throughout: one y-axis; hairline solid grids; thin lines; bars
 * with 4px rounded ends and a 2px gap; colour by series, never by rank; a
 * legend whenever there are two series or more.
 */
import { el, sv, tip, untip, fmt, full, type TipRow } from './ui'

const W = (body: HTMLElement) => Math.max(260, Math.floor(body.clientWidth || 600))

/** A round number at or above v, with 4 ticks to it. */
function nice(v: number) {
  if (v <= 0) return { max: 4, ticks: [0, 1, 2, 3, 4] }
  const raw = v / 4, mag = 10 ** Math.floor(Math.log10(raw)), f = raw / mag
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag
  const s = Math.max(step, v < 4 ? 1 : step)
  const max = Math.ceil(v / s) * s
  const ticks: number[] = []
  for (let t = 0; t <= max + 1e-9; t += s) ticks.push(+t.toFixed(6))
  return { max, ticks }
}

export type Series = { name: string; values: number[]; slot: number; dashed?: boolean }

/** Lines over time, one y-axis, with a crosshair that reads every series at the nearest x. */
export function lineChart(body: HTMLElement, o: { labels: string[]; series: Series[]; xLabel: (i: number) => string; tipTitle: (i: number) => string; fmtY?: (v: number) => string; height?: number; area?: boolean }) {
  const w = W(body), h = o.height ?? 240, L = 44, R = 12, T = 12, B = 28
  const fy = o.fmtY ?? fmt
  const n = o.labels.length
  const { max, ticks } = nice(Math.max(0, ...o.series.flatMap((s) => s.values)))
  const x = (i: number) => L + (n <= 1 ? (w - L - R) / 2 : (i / (n - 1)) * (w - L - R))
  const y = (v: number) => T + (1 - v / max) * (h - T - B)
  if (o.series.length > 1) body.append(el('div', { class: 'ad-legend' }, ...o.series.map((s) => el('span', {}, el('i', { class: `ad-key s${s.slot}${s.dashed ? ' is-dashed' : ''}` }), s.name))))
  const svg = sv('svg', { viewBox: `0 0 ${w} ${h}`, width: w, height: h, class: 'ad-svg', role: 'img', 'aria-label': `${o.series.map((s) => s.name).join(' and ')} over time` })
  for (const t of ticks) svg.append(sv('line', { x1: L, x2: w - R, y1: y(t), y2: y(t), class: t === 0 ? 'ax-base' : 'ax-grid' }), sv('text', { x: L - 8, y: y(t) + 4, class: 'ax-t', 'text-anchor': 'end' }, fy(t)))
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor((w - L) / 70))))
  for (let i = 0; i < n; i += every) svg.append(sv('text', { x: x(i), y: h - 8, class: 'ax-t', 'text-anchor': i === 0 && n > 1 ? 'start' : 'middle' }, o.xLabel(i)))
  o.series.forEach((s, k) => {
    const d = s.values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')
    if (o.area !== false && k === 0 && n > 1) svg.append(sv('path', { d: `${d}L${x(n - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z`, class: `area s${s.slot}` }))
    svg.append(sv('path', { d, class: `line s${s.slot}${s.dashed ? ' is-dashed' : ''}` }))
    if (n === 1) svg.append(sv('circle', { cx: x(0), cy: y(s.values[0]), r: 4, class: `dot s${s.slot}` }))
  })
  // The crosshair, and a marker per series at it.
  const cross = sv('line', { y1: T, y2: h - B, class: 'ax-cross', visibility: 'hidden' })
  const marks = o.series.map((s) => sv('circle', { r: 4.5, class: `dot s${s.slot}`, visibility: 'hidden' }))
  svg.append(cross, ...marks)
  const hit = sv('rect', { x: L, y: T, width: w - L - R, height: h - T - B, fill: 'transparent', tabindex: 0, class: 'hit', 'aria-label': 'Read values: arrow keys move along the chart' })
  svg.append(hit)
  let at = -1
  const show = (i: number, cx: number, cy: number) => {
    at = Math.max(0, Math.min(n - 1, i))
    cross.setAttribute('x1', String(x(at))); cross.setAttribute('x2', String(x(at))); cross.setAttribute('visibility', 'visible')
    marks.forEach((m, k) => { m.setAttribute('cx', String(x(at))); m.setAttribute('cy', String(y(o.series[k].values[at]))); m.setAttribute('visibility', 'visible') })
    tip(cx, cy, o.tipTitle(at), o.series.map((s) => ({ value: fy(s.values[at]), label: s.name, slot: s.slot })))
  }
  const hide = () => { cross.setAttribute('visibility', 'hidden'); marks.forEach((m) => m.setAttribute('visibility', 'hidden')); untip() }
  hit.addEventListener('pointermove', (e) => {
    const r = svg.getBoundingClientRect(), px = ((e.clientX - r.left) / r.width) * w
    show(n <= 1 ? 0 : Math.round(((px - L) / (w - L - R)) * (n - 1)), e.clientX, e.clientY)
  })
  hit.addEventListener('pointerleave', hide)
  hit.addEventListener('blur', hide)
  hit.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const i = at < 0 ? n - 1 : at + (e.key === 'ArrowRight' ? 1 : -1)
    const r = svg.getBoundingClientRect()
    show(i, r.left + (x(Math.max(0, Math.min(n - 1, i))) / w) * r.width, r.top + 20)
  })
  body.append(svg)
}

/** Vertical bars (a distribution): one colour, each bar its own tooltip. */
export function columns(body: HTMLElement, o: { labels: string[]; values: number[]; tipTitle: (i: number) => string; unit?: string; height?: number; slot?: number; xLabel?: (i: number) => string }) {
  const w = W(body), h = o.height ?? 200, L = 40, R = 8, T = 10, B = 30
  const n = o.values.length
  const { max, ticks } = nice(Math.max(0, ...o.values))
  const y = (v: number) => T + (1 - v / max) * (h - T - B)
  const slotW = (w - L - R) / Math.max(1, n), bw = Math.max(2, Math.min(56, slotW - 2))
  const svg = sv('svg', { viewBox: `0 0 ${w} ${h}`, width: w, height: h, class: 'ad-svg', role: 'img', 'aria-label': 'Distribution' })
  for (const t of ticks) svg.append(sv('line', { x1: L, x2: w - R, y1: y(t), y2: y(t), class: t === 0 ? 'ax-base' : 'ax-grid' }), sv('text', { x: L - 8, y: y(t) + 4, class: 'ax-t', 'text-anchor': 'end' }, fmt(t)))
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor((w - L) / 64))))
  o.values.forEach((v, i) => {
    const cx = L + slotW * i + slotW / 2, top = y(v), base = y(0)
    const bh = Math.max(v > 0 ? 2 : 0, base - top)
    const r = Math.min(4, bw / 2, bh)
    const x0 = cx - bw / 2
    // Rounded at the data end only, square on the baseline.
    const d = `M${x0},${base}V${base - bh + r}Q${x0},${base - bh} ${x0 + r},${base - bh}H${x0 + bw - r}Q${x0 + bw},${base - bh} ${x0 + bw},${base - bh + r}V${base}Z`
    const bar = sv('path', { d, class: `bar s${o.slot ?? 1}` })
    const hit = sv('rect', { x: L + slotW * i, y: T, width: slotW, height: h - T - B, fill: 'transparent', tabindex: 0, class: 'hit', 'aria-label': `${o.tipTitle(i)}: ${full(v)}` })
    const on = (e: { clientX: number; clientY: number }) => { bar.classList.add('is-on'); tip(e.clientX, e.clientY, o.tipTitle(i), [{ value: full(v), label: o.unit ?? 'count' }]) }
    hit.addEventListener('pointermove', on)
    hit.addEventListener('focus', () => { const b = hit.getBoundingClientRect(); on({ clientX: b.left + b.width / 2, clientY: b.top + 20 }) })
    const off = () => { bar.classList.remove('is-on'); untip() }
    hit.addEventListener('pointerleave', off); hit.addEventListener('blur', off)
    svg.append(bar)
    if (i % every === 0) svg.append(sv('text', { x: cx, y: h - 10, class: 'ax-t', 'text-anchor': 'middle' }, o.xLabel ? o.xLabel(i) : o.labels[i]))
    svg.append(hit)
  })
  body.append(svg)
}

export type BarRow = { k: string; n: number; label?: string; note?: string; href?: string; onClick?: () => void }
/** A ranked list with a bar under each label: the most common shape on the page. */
export function barList(body: HTMLElement, rows: BarRow[], o: { unit?: string; max?: number; limit?: number; slot?: number; total?: number } = {}) {
  const shown = rows.slice(0, o.limit ?? 10)
  const top = o.max ?? Math.max(1, ...shown.map((r) => r.n))
  const list = el('ol', { class: 'ad-bars' })
  for (const r of shown) {
    const label = r.label ?? (r.k || '(none)')
    const inner = [el('span', { class: 'ad-bar-k', text: label }), r.note ? el('span', { class: 'ad-bar-note', text: r.note }) : null, el('span', { class: 'ad-bar-v', text: fmt(r.n) + (o.total ? ` · ${((r.n / o.total) * 100).toFixed(0)}%` : '') })]
    const li = el('li', { style: `--w:${((r.n / top) * 100).toFixed(2)}%`, class: `s${o.slot ?? 1}` })
    if (r.onClick) { const b = el('button', { type: 'button', class: 'ad-bar-btn' }, ...inner); b.addEventListener('click', r.onClick); li.append(b) }
    else li.append(...inner.filter(Boolean) as HTMLElement[])
    li.title = `${label}: ${full(r.n)} ${o.unit ?? ''}`.trim()
    list.append(li)
  }
  if (rows.length > shown.length) list.append(el('li', { class: 'ad-bars-more', text: `and ${rows.length - shown.length} more in the table view` }))
  body.append(list)
}

/** One bar, split into its parts (part-to-whole, at most six), with a legend that carries the numbers. */
export function stackBar(body: HTMLElement, parts: { k: string; n: number; slot: number }[]) {
  const total = parts.reduce((a, p) => a + p.n, 0) || 1
  const bar = el('div', { class: 'ad-stack', role: 'img', 'aria-label': parts.map((p) => `${p.k} ${((p.n / total) * 100).toFixed(0)}%`).join(', ') })
  for (const p of parts) if (p.n > 0) {
    const seg = el('span', { class: `s${p.slot}`, style: `flex:${p.n}` })
    seg.addEventListener('pointermove', (e) => tip(e.clientX, e.clientY, p.k, [{ value: full(p.n), label: `${((p.n / total) * 100).toFixed(1)}% of ${full(total)}`, slot: p.slot }]))
    seg.addEventListener('pointerleave', untip)
    bar.append(seg)
  }
  body.append(bar, el('div', { class: 'ad-legend is-values' }, ...parts.map((p) => el('span', {}, el('i', { class: `ad-key box s${p.slot}` }), `${p.k} `, el('b', { text: `${((p.n / total) * 100).toFixed(0)}%` }), el('em', { text: ` ${fmt(p.n)}` })))))
}

/** Which step of the one-hue ramp (q1…q5) a value takes, q0 for none. */
export const rampStep = (v: number, max: number) => (v <= 0 || max <= 0 ? 0 : Math.min(5, 1 + Math.floor((v / max) * 4.999)))

function rampLegend(max: number, unit: string) {
  return el('div', { class: 'ad-ramp' }, el('span', { text: '0' }), ...[1, 2, 3, 4, 5].map((k) => el('i', { class: `q${k}` })), el('span', { text: `${fmt(max)} ${unit}` }))
}

/** The week as a grid: days down, hours across, darker for more. */
export function weekGrid(body: HTMLElement, cells: { dow: number; h: number; n: number }[]) {
  const max = Math.max(0, ...cells.map((c) => c.n))
  const by = new Map(cells.map((c) => [`${c.dow}-${c.h}`, c.n]))
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const grid = el('div', { class: 'ad-week', role: 'grid', 'aria-label': 'Visitors by day of the week and hour, in their own time' })
  grid.append(el('span', {}), ...Array.from({ length: 24 }, (_, h) => el('span', { class: 'ad-week-h', text: h % 3 === 0 ? String(h).padStart(2, '0') : '' })))
  days.forEach((d, i) => {
    grid.append(el('span', { class: 'ad-week-d', text: d }))
    for (let h = 0; h < 24; h++) {
      const v = by.get(`${i + 1}-${h}`) ?? 0
      const c = el('span', { class: `ad-cell q${rampStep(v, max)}`, tabindex: 0, role: 'gridcell', 'aria-label': `${d} ${h}:00, ${v} visitors` })
      const on = (x: number, y: number) => tip(x, y, `${d}, ${String(h).padStart(2, '0')}:00–${String(h + 1).padStart(2, '0')}:00`, [{ value: full(v), label: 'visitors' }])
      c.addEventListener('pointermove', (e) => on(e.clientX, e.clientY))
      c.addEventListener('focus', () => { const b = c.getBoundingClientRect(); on(b.left, b.top) })
      c.addEventListener('pointerleave', untip); c.addEventListener('blur', untip)
      grid.append(c)
    }
  })
  body.append(grid, rampLegend(max, 'visitors'))
}

/** Steps that lose people: each bar is a share of the first, with the step-to-step rate between. */
export function funnel(body: HTMLElement, steps: { k: string; n: number }[]) {
  const first = steps[0]?.n || 1
  const list = el('ol', { class: 'ad-funnel' })
  steps.forEach((s, i) => {
    const prev = i ? steps[i - 1].n : s.n
    list.append(el('li', { style: `--w:${((s.n / first) * 100).toFixed(2)}%`, class: `q${Math.max(2, 5 - i)}` },
      el('span', { class: 'ad-funnel-k', text: s.k }),
      el('span', { class: 'ad-funnel-v' }, el('b', { text: full(s.n) }), ` · ${((s.n / first) * 100).toFixed(0)}% of all`),
      i ? el('span', { class: 'ad-funnel-step', text: `${prev ? ((s.n / prev) * 100).toFixed(0) : 0}% of the step before` }) : null))
  })
  body.append(list)
}

/** A sparkline for a table cell. */
export function spark(values: number[], w = 96, h = 24) {
  const max = Math.max(1, ...values), n = values.length
  const x = (i: number) => (n <= 1 ? w / 2 : (i / (n - 1)) * (w - 2) + 1)
  const y = (v: number) => h - 2 - (v / max) * (h - 4)
  return sv('svg', { viewBox: `0 0 ${w} ${h}`, width: w, height: h, class: 'ad-spark', 'aria-hidden': 'true' },
    sv('path', { d: values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(''), class: 'line s1' }))
}

/** The world, shaded by a value per country (ISO codes), and dots where people are right now. */
export async function worldMap(body: HTMLElement, o: { values: Map<string, number>; dots?: { lat: number; lon: number; label: string }[]; unit?: string; isoByName: Record<string, string>; onPick?: (iso: string) => void }) {
  const { COUNTRY_SHAPES, MAP_W, MAP_H } = await import('../../data/population-geo')
  const max = Math.max(0, ...o.values.values())
  // Antarctica takes a fifth of the frame and nobody plays from there.
  const svg = sv('svg', { viewBox: `0 8 ${MAP_W} ${MAP_H - 32}`, class: 'ad-map', role: 'img', 'aria-label': `World map of ${o.unit ?? 'visitors'} by country` })
  for (const c of COUNTRY_SHAPES) {
    const iso = o.isoByName[c.name] ?? ''
    const v = o.values.get(iso) ?? 0
    const p = sv('path', { d: c.path, class: `ad-land q${rampStep(v, max)}`, tabindex: v ? 0 : undefined, 'aria-label': v ? `${c.name}: ${v}` : undefined })
    const on = (x: number, y: number) => tip(x, y, c.name, [{ value: full(v), label: o.unit ?? 'visitors' }])
    p.addEventListener('pointermove', (e) => on(e.clientX, e.clientY))
    p.addEventListener('focus', () => { const b = p.getBoundingClientRect(); on(b.left + b.width / 2, b.top) })
    p.addEventListener('pointerleave', untip); p.addEventListener('blur', untip)
    if (o.onPick && iso && v) { p.style.cursor = 'pointer'; p.addEventListener('click', () => o.onPick!(iso)) }
    svg.append(p)
  }
  for (const d of o.dots ?? []) {
    const cx = ((d.lon + 180) / 360) * MAP_W, cy = ((90 - d.lat) / 180) * MAP_H
    const g = sv('g', { class: 'ad-dot' }, sv('circle', { cx, cy, r: 4, class: 'ad-dot-ring' }), sv('circle', { cx, cy, r: 1.6, class: 'ad-dot-core' }))
    g.addEventListener('pointermove', (e) => tip(e.clientX, e.clientY, d.label, [{ value: 'here now', label: '' }]))
    g.addEventListener('pointerleave', untip)
    svg.append(g)
  }
  body.append(svg, rampLegend(max, o.unit ?? 'visitors'))
}

/** Status of a Web Vital against Google's lines, with its own word and mark (never colour alone). */
export const VITALS: Record<string, { good: number; poor: number; unit: 'ms' | ''; name: string; what: string }> = {
  LCP: { good: 2500, poor: 4000, unit: 'ms', name: 'Largest paint', what: 'when the biggest thing on the page has drawn' },
  INP: { good: 200, poor: 500, unit: 'ms', name: 'Response to input', what: 'how long a tap or click takes to show its effect' },
  CLS: { good: 0.1, poor: 0.25, unit: '', name: 'Layout shift', what: 'how much the page jumps while it loads' },
  FCP: { good: 1800, poor: 3000, unit: 'ms', name: 'First paint', what: 'when anything at all has drawn' },
  TTFB: { good: 800, poor: 1800, unit: 'ms', name: 'Server response', what: 'how long the first byte takes to arrive' },
}
export function vitalValue(metric: string, v: number) {
  const m = VITALS[metric]
  if (!m) return String(v)
  return m.unit === 'ms' ? (v >= 1000 ? (v / 1000).toFixed(2) + ' s' : Math.round(v) + ' ms') : v.toFixed(3)
}
export function vitalRating(metric: string, v: number): 'good' | 'mid' | 'poor' {
  const m = VITALS[metric]
  return !m ? 'good' : v <= m.good ? 'good' : v <= m.poor ? 'mid' : 'poor'
}
export const RATING = { good: { mark: '✓', word: 'Good' }, mid: { mark: '◐', word: 'Needs work' }, poor: { mark: '✕', word: 'Poor' } } as const
export const statusBadge = (r: 'good' | 'mid' | 'poor') => el('span', { class: `ad-status is-${r}` }, el('i', { 'aria-hidden': 'true', text: RATING[r].mark }), RATING[r].word)

export type { TipRow }
