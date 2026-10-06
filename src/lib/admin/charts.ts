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
import { el, sv, tip, untip, fmt, full, pct, type TipRow } from './ui'

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

/* ---- phase 3: the crowd, journeys, return visits, the island ------------------ */

/**
 * One row per question, each a bar split into its answers (part-to-whole):
 * the same answers in the same colours on every row, the four most picked
 * overall, and the rest as "Other" in a neutral grey.
 */
export function splitBars(body: HTMLElement, rows: { of: string; n: number; values: { k: string; n: number }[] }[], answers: string[], o: { limit?: number; label?: (k: string) => string } = {}) {
  const lab = o.label ?? ((k: string) => k)
  const keys = answers.length > 4 ? answers.slice(0, 4) : answers
  const other = answers.length > 4 || rows.some((r) => r.values.some((v) => !keys.includes(v.k)))
  body.append(el('div', { class: 'ad-legend' }, ...keys.map((k, i) => el('span', {}, el('i', { class: `ad-key box s${i + 1}` }), lab(k))), other ? el('span', {}, el('i', { class: 'ad-key box so' }), 'Other') : null))
  const list = el('div', { class: 'ad-split' })
  for (const r of rows.slice(0, o.limit ?? 14)) {
    const parts = keys.map((k, i) => ({ k: lab(k), n: r.values.find((v) => v.k === k)?.n ?? 0, cls: `s${i + 1}` }))
    const rest = r.values.filter((v) => !keys.includes(v.k)).reduce((a, v) => a + v.n, 0)
    if (rest) parts.push({ k: 'Other', n: rest, cls: 'so' })
    const total = parts.reduce((a, p) => a + p.n, 0) || 1
    const bar = el('div', { class: 'ad-split-bar', role: 'img', 'aria-label': `${r.of}: ${parts.filter((p) => p.n).map((p) => `${p.k} ${pct(p.n, total)}`).join(', ')}` })
    for (const p of parts) if (p.n) {
      const seg = el('span', { class: p.cls, style: `flex:${p.n}` }, p.n / total >= 0.12 ? pct(p.n, total) : '')
      seg.addEventListener('pointermove', (e) => tip(e.clientX, e.clientY, r.of, [{ value: pct(p.n, total), label: `${p.k} · ${full(p.n)} of ${full(total)}` }]))
      seg.addEventListener('pointerleave', untip)
      bar.append(seg)
    }
    list.append(el('div', { class: 'ad-split-row' }, el('p', { class: 'ad-split-k' }, el('span', { text: r.of }), el('span', { class: 'ad-dim', text: fmt(r.n) })), bar))
  }
  body.append(list)
  if (rows.length > (o.limit ?? 14)) body.append(el('p', { class: 'ad-bars-more', text: `and ${rows.length - (o.limit ?? 14)} more in the table view` }))
}

/**
 * A number per row, as a spread on one shared scale: a thin line from the
 * least to the most, a thick one from the median to the 90th percentile, and
 * a dot at the median. A log scale when the values span over a hundredfold.
 */
export function spreadRows(body: HTMLElement, rows: { of: string; n: number; median: number; p90: number; min: number; max: number }[], o: { fmtV?: (v: number) => string; limit?: number } = {}) {
  const fv = o.fmtV ?? ((v: number) => fmt(Math.abs(v) >= 100 ? Math.round(v) : +v.toFixed(2)))
  const shown = rows.slice(0, o.limit ?? 14)
  const lo = Math.min(...shown.map((r) => r.min)), hi = Math.max(...shown.map((r) => r.max))
  const log = lo > 0 && hi / lo > 100
  const f = (v: number) => (log ? Math.log10(Math.max(v, lo)) : v)
  const w = W(body), rowH = 34, labW = Math.min(200, Math.round(w * 0.34)), L = labW + 12, R = 56, T = 4, B = 26
  const h = T + B + rowH * shown.length
  const x = (v: number) => L + ((f(v) - f(lo)) / (f(hi) - f(lo) || 1)) * (w - L - R)
  const svg = sv('svg', { viewBox: `0 0 ${w} ${h}`, width: w, height: h, class: 'ad-svg', role: 'img', 'aria-label': 'Spread of values per row' })
  const ticks = log ? Array.from({ length: Math.floor(Math.log10(hi)) - Math.ceil(Math.log10(lo)) + 1 }, (_, i) => 10 ** (Math.ceil(Math.log10(lo)) + i)) : [0, 1, 2, 3, 4].map((i) => lo + ((hi - lo) * i) / 4)
  for (const t of ticks) svg.append(sv('line', { x1: x(t), x2: x(t), y1: T, y2: h - B, class: 'ax-grid' }), sv('text', { x: x(t), y: h - 8, class: 'ax-t', 'text-anchor': 'middle' }, fv(t)))
  const chars = Math.max(8, Math.floor(labW / 7.2))
  shown.forEach((r, i) => {
    const cy = T + rowH * i + rowH / 2
    const g = sv('g', { class: 'ad-spread', tabindex: 0, 'aria-label': `${r.of}: median ${fv(r.median)}, 90% under ${fv(r.p90)}, from ${fv(r.min)} to ${fv(r.max)}, ${r.n} answers` })
    g.append(
      sv('text', { x: 0, y: cy + 4, class: 'ax-t is-label' }, r.of.length > chars ? r.of.slice(0, chars - 1) + '…' : r.of),
      sv('line', { x1: x(r.min), x2: Math.max(x(r.max), x(r.min) + 1), y1: cy, y2: cy, class: 'ad-spread-range' }),
      sv('line', { x1: x(r.median), x2: Math.max(x(r.p90), x(r.median) + 1), y1: cy, y2: cy, class: 'ad-spread-iqr' }),
      sv('circle', { cx: x(r.median), cy, r: 5, class: 'ad-spread-dot' }),
      sv('text', { x: w - 4, y: cy + 4, class: 'ax-t', 'text-anchor': 'end' }, fv(r.median)),
      sv('rect', { x: 0, y: cy - rowH / 2, width: w, height: rowH, fill: 'transparent' }),
    )
    const on = (cx: number, cy2: number) => tip(cx, cy2, r.of, [{ value: fv(r.median), label: 'median' }, { value: fv(r.p90), label: '9 in 10 under' }, { value: `${fv(r.min)} – ${fv(r.max)}`, label: 'least to most' }, { value: full(r.n), label: 'answers' }])
    g.addEventListener('pointermove', (e) => on(e.clientX, e.clientY))
    g.addEventListener('focus', () => { const b = g.getBoundingClientRect(); on(b.left + L, b.top) })
    g.addEventListener('pointerleave', untip); g.addEventListener('blur', untip)
    svg.append(g)
  })
  body.append(svg, el('div', { class: 'ad-legend' }, el('span', {}, el('i', { class: 'ad-key is-range' }), 'least to most'), el('span', {}, el('i', { class: 'ad-key is-iqr' }), 'median to the 90th percentile'), log ? el('span', { class: 'ad-dim', text: 'log scale' }) : null))
}

/**
 * Where visits go, page to page: a column per step, a node per page (the
 * commonest few, then "other", then "left" where visits ended), and bands
 * between them as wide as the visits that took that step.
 */
export function flowChart(body: HTMLElement, o: { steps: { k: string; n: number }[][]; links: { s: number; a: string; b: string; n: number }[]; label: (k: string) => string; heads: string[] }) {
  const w = W(body), cols = o.steps.length
  const narrow = w < 640
  const h = narrow ? 420 : 440, T = 26, B = 6, nodeW = 10, gapY = 8
  const colX = (i: number) => (cols <= 1 ? 0 : (i / (cols - 1)) * (w - nodeW))
  const maxTotal = Math.max(1, ...o.steps.map((s) => s.reduce((a, x) => a + x.n, 0)))
  const maxNodes = Math.max(1, ...o.steps.map((s) => s.length))
  const k = (h - T - B - gapY * (maxNodes - 1)) / maxTotal
  const pos = o.steps.map((s, i) => {
    let y = T
    const m = new Map<string, { y: number; h: number; out: number; in: number }>()
    for (const nd of s) { const hh = Math.max(2, nd.n * k); m.set(nd.k, { y, h: hh, out: 0, in: 0 }); y += hh + gapY }
    return { i, m }
  })
  const neutral = (key: string) => key.startsWith('(')
  const svg = sv('svg', { viewBox: `0 0 ${w} ${h}`, width: w, height: h, class: 'ad-svg ad-flow', role: 'img', 'aria-label': 'How visits move from page to page over their first four steps' })
  o.heads.forEach((t, i) => svg.append(sv('text', { x: i === cols - 1 ? w : colX(i), y: 14, class: 'ax-t is-head', 'text-anchor': i === cols - 1 ? 'end' : 'start' }, t)))
  // Bands, sorted so they leave and arrive in node order and never cross inside a node.
  const order = (s: number, key: string) => [...o.steps[s].map((x) => x.k)].indexOf(key)
  const links = [...o.links].sort((a, b) => a.s - b.s || order(a.s, a.a) - order(b.s, b.a) || order(a.s + 1, a.b) - order(b.s + 1, b.b))
  const total0 = (s: number, key: string) => o.steps[s].find((x) => x.k === key)?.n ?? 0
  for (const l of links) {
    const A = pos[l.s]?.m.get(l.a), Bn = pos[l.s + 1]?.m.get(l.b)
    if (!A || !Bn) continue
    const t = Math.max(1, l.n * k)
    const x0 = colX(l.s) + nodeW, x1 = colX(l.s + 1), y0 = A.y + A.out, y1 = Bn.y + Bn.in
    A.out += t; Bn.in += t
    const mx = (x0 + x1) / 2
    const d = `M${x0},${y0}C${mx},${y0} ${mx},${y1} ${x1},${y1}L${x1},${y1 + t}C${mx},${y1 + t} ${mx},${y0 + t} ${x0},${y0 + t}Z`
    const band = sv('path', { d, class: `ad-band${neutral(l.b) ? ' is-neutral' : ''}` })
    band.addEventListener('pointermove', (e) => { band.classList.add('is-on'); tip(e.clientX, e.clientY, `${o.label(l.a)} → ${o.label(l.b)}`, [{ value: full(l.n), label: `visits · ${pct(l.n, total0(l.s, l.a))} of those on ${o.label(l.a)}` }]) })
    band.addEventListener('pointerleave', () => { band.classList.remove('is-on'); untip() })
    svg.append(band)
  }
  const chars = Math.max(6, Math.floor(((w - nodeW * cols) / Math.max(1, cols - 1) - 18) / 7))
  pos.forEach(({ i, m }) => {
    for (const [key, p] of m) {
      const node = sv('rect', { x: colX(i), y: p.y, width: nodeW, height: p.h, rx: 3, class: `ad-node${neutral(key) ? ' is-neutral' : ''}` })
      const n = o.steps[i].find((x) => x.k === key)!.n
      node.addEventListener('pointermove', (e) => tip(e.clientX, e.clientY, o.label(key), [{ value: full(n), label: `visits at step ${i + 1}` }]))
      node.addEventListener('pointerleave', untip)
      svg.append(node)
      if (p.h >= 11) {
        const last = i === cols - 1, name = o.label(key)
        svg.append(sv('text', { x: last ? colX(i) - 6 : colX(i) + nodeW + 6, y: p.y + Math.min(p.h / 2, 12) + 4, class: 'ax-t is-node', 'text-anchor': last ? 'end' : 'start' }, name.length > chars ? name.slice(0, chars - 1) + '…' : name))
      }
    }
  })
  body.append(svg)
}

/**
 * Return visits by the week of a first visit: a row per week's newcomers, a
 * column per week after, each cell the share seen again that week. Week 0 is
 * everyone, so the ramp is scaled to the later weeks; weeks still to come are
 * left empty, not zero.
 */
export function cohortGrid(body: HTMLElement, weeks: { cohort: string; size: number; back: { wk: number; n: number }[] }[], o: { now: Date; label: (iso: string) => string }) {
  const COLS = 12
  const age = (iso: string) => Math.floor((o.now.getTime() - new Date(iso + 'T00:00').getTime()) / (7 * 864e5))
  const later = weeks.flatMap((w) => w.back.filter((b) => b.wk > 0).map((b) => (w.size ? b.n / w.size : 0)))
  const max = Math.max(0.0001, ...later)
  const grid = el('div', { class: 'ad-coh', role: 'grid', 'aria-label': 'Share of each week’s new visitors seen again in each week after' })
  grid.append(el('span', { class: 'ad-coh-h', text: 'First came' }), el('span', { class: 'ad-coh-h a-r', text: 'People' }), ...Array.from({ length: COLS }, (_, i) => el('span', { class: 'ad-coh-h', text: i === 0 ? 'Wk 0' : String(i) })))
  for (const w of [...weeks].reverse()) {
    grid.append(el('span', { class: 'ad-coh-d', text: o.label(w.cohort) }), el('span', { class: 'ad-coh-n', text: fmt(w.size) }))
    const old = age(w.cohort)
    for (let i = 0; i < COLS; i++) {
      if (i > old) { grid.append(el('span', { class: 'ad-coh-c is-future' })); continue }
      const n = w.back.find((b) => b.wk === i)?.n ?? 0
      const s = w.size ? n / w.size : 0
      const step = i === 0 ? 5 : rampStep(s, max)
      const c = el('span', { class: `ad-coh-c q${step}${step >= 4 ? ' is-strong' : ''}`, tabindex: 0, role: 'gridcell', text: w.size ? (i === 0 ? '100%' : s ? (s * 100).toFixed(s < 0.1 ? 1 : 0) + '%' : '·') : '' })
      const on = (x: number, y: number) => tip(x, y, `${o.label(w.cohort)} · week ${i}`, [{ value: full(n), label: `of ${full(w.size)} came back that week` }])
      c.addEventListener('pointermove', (e) => on(e.clientX, e.clientY)); c.addEventListener('pointerleave', untip)
      c.addEventListener('focus', () => { const b = c.getBoundingClientRect(); on(b.left, b.top) }); c.addEventListener('blur', untip)
      grid.append(c)
    }
  }
  body.append(el('div', { class: 'ad-scroll' }, grid), rampLegend(Math.round(max * 100), '% came back'))
}

/** The island as its own picture, and where it is busy. */
export type IslandMap = { src: string; x: number; y: number; w: number; h: number; bounds: [number, number, number, number]; frame: [number, number, number, number]; anchors: Record<string, [number, number]> }
type HeatMode = 'taps' | 'look' | 'dives'
/**
 * The island heat-maps, over the poster the homepage opens on (greyed, so
 * the heat reads): taps where they landed, where the middle of the screen
 * rested (a 10 × 7 grid over the map, softened), or a circle on each
 * building as big as the dives into it. The heat runs from the series blue
 * through violet to pink, faint to strong, scaled to the busiest spot.
 */
export function islandHeat(body: HTMLElement, o: { map: IslandMap; taps: { x: number; y: number; hit: string; n: number }[]; look: number[]; lookW: number; lookH: number; dives: { k: string; n: number }[]; title: (s: string) => string; mode: HeatMode; onMode: (m: HeatMode) => void }) {
  const M = o.map, [fx, fy, fw, fh] = M.frame
  const modes: [HeatMode, string][] = [['taps', 'Taps'], ['look', 'Where screens rested'], ['dives', 'Games entered']]
  const seg = el('div', { class: 'ad-seg', role: 'group', 'aria-label': 'Which heat-map' }, ...modes.map(([m, t]) => {
    const b = el('button', { type: 'button', 'aria-pressed': String(m === o.mode), text: t })
    b.addEventListener('click', () => o.onMode(m))
    return b
  }))
  const w = W(body), hgt = Math.round((w * fh) / fw), s = w / fw
  const box = el('div', { class: 'ad-heat', style: `height:${hgt}px` })
  const img = el('img', { src: M.src, alt: '', class: 'ad-heat-img', style: `left:${((M.x - fx) * s).toFixed(1)}px;top:${((M.y - fy) * s).toFixed(1)}px;width:${(M.w * s).toFixed(1)}px;height:${(M.h * s).toFixed(1)}px`, decoding: 'async' })
  const dpr = Math.min(2, devicePixelRatio || 1)
  const cv = el('canvas', { width: Math.round(w * dpr), height: Math.round(hgt * dpr), class: 'ad-heat-cv', role: 'img', 'aria-label': `Heat-map of the island: ${modes.find((m) => m[0] === o.mode)![1].toLowerCase()}` })
  box.append(img, cv)
  const css = getComputedStyle(body)
  const rgb = (v: string) => { const h = css.getPropertyValue(v).trim().replace('#', ''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) }
  const stops: [number, number[], number][] = [[0, rgb('--s1'), 0], [0.12, rgb('--s1'), 0.45], [0.5, rgb('--s3'), 0.75], [1, rgb('--s4'), 0.95]]
  const color = (t: number) => {
    let i = 0; while (i < stops.length - 2 && t > stops[i + 1][0]) i++
    const [t0, c0, a0] = stops[i], [t1, c1, a1] = stops[i + 1], u = Math.min(1, Math.max(0, (t - t0) / (t1 - t0 || 1)))
    return [c0[0] + (c1[0] - c0[0]) * u, c0[1] + (c1[1] - c0[1]) * u, c0[2] + (c1[2] - c0[2]) * u, (a0 + (a1 - a0) * u) * 255]
  }
  const ctx = cv.getContext('2d')!
  ctx.scale(dpr, dpr)
  const sx = (wx: number) => (wx - fx) * s, sy = (wy: number) => (wy - fy) * s
  // Density into alpha first, then coloured by how strong it is against the strongest.
  const colourise = () => {
    const im = ctx.getImageData(0, 0, cv.width, cv.height), px = im.data
    let max = 0
    for (let i = 3; i < px.length; i += 4) if (px[i] > max) max = px[i]
    if (!max) return
    for (let i = 0; i < px.length; i += 4) {
      const a = px[i + 3]
      if (!a) continue
      const [r, g, b, al] = color(a / max)
      px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = al
    }
    ctx.putImageData(im, 0, 0)
  }
  let hover: (wx: number, wy: number) => [string, { value: string; label: string }[]] | null = () => null
  if (o.mode === 'taps') {
    const top = Math.max(1, ...o.taps.map((t) => t.n))
    const r = Math.max(10, 26 * (w / 900))
    for (const t of o.taps) {
      const g = ctx.createRadialGradient(sx(t.x), sy(t.y), 0, sx(t.x), sy(t.y), r)
      const a = Math.min(1, 0.25 + 0.75 * (t.n / top))
      g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.globalCompositeOperation = 'lighter'
      ctx.fillStyle = g; ctx.fillRect(sx(t.x) - r, sy(t.y) - r, r * 2, r * 2)
    }
    ctx.globalCompositeOperation = 'source-over'
    colourise()
    hover = (wx, wy) => {
      const near = o.taps.filter((t) => Math.hypot(t.x - wx, t.y - wy) < 40)
      if (!near.length) return null
      const n = near.reduce((a, t) => a + t.n, 0), what = new Map<string, number>()
      for (const t of near) what.set(t.hit, (what.get(t.hit) ?? 0) + t.n)
      return ['Taps here', [{ value: full(n), label: 'taps' }, ...[...what].map(([k, v]) => ({ value: full(v), label: ({ game: 'on a building', poke: 'on something to poke', none: 'on nothing in particular' } as Record<string, string>)[k] ?? k }))]]
    }
  } else if (o.mode === 'look') {
    const [bx, by, bw, bh] = M.bounds, LW = o.lookW, LH = o.lookH
    const max = Math.max(1, ...o.look)
    const small = document.createElement('canvas'); small.width = LW; small.height = LH
    const sc = small.getContext('2d')!
    const im = sc.createImageData(LW, LH)
    o.look.forEach((v, i) => { im.data[i * 4 + 3] = Math.round((v / max) * 255) })
    sc.putImageData(im, 0, 0)
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'
    ctx.filter = `blur(${Math.round(w / 60)}px)`
    ctx.drawImage(small, sx(bx), sy(by), bw * s, bh * s)
    ctx.filter = 'none'
    colourise()
    hover = (wx, wy) => {
      const i = Math.floor(((wx - bx) / bw) * LW), j = Math.floor(((wy - by) / bh) * LH)
      if (i < 0 || j < 0 || i >= LW || j >= LH) return null
      return ['Where screens rested', [{ value: full(o.look[j * LW + i] * 2), label: 'seconds, summed over every visit' }]]
    }
  } else {
    const max = Math.max(1, ...o.dives.map((d) => d.n)), R = Math.max(12, w / 32)
    const fill = rgb('--s1'), ink = css.getPropertyValue('--ink').trim(), surface = css.getPropertyValue('--surface').trim()
    const placed = o.dives.filter((d) => M.anchors[d.k]).sort((a, b) => b.n - a.n)
    for (const d of [...placed].reverse()) {
      const [ax, ay] = M.anchors[d.k], r = Math.max(4, Math.sqrt(d.n / max) * R)
      ctx.beginPath(); ctx.arc(sx(ax), sy(ay), r, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${fill.join(',')},0.55)`; ctx.fill()
      ctx.lineWidth = 1.5; ctx.strokeStyle = surface; ctx.stroke()
    }
    ctx.font = `600 ${Math.max(11, Math.round(w / 80))}px system-ui, sans-serif`; ctx.textAlign = 'center'
    for (const d of placed.slice(0, 6)) {
      const [ax, ay] = M.anchors[d.k], r = Math.max(4, Math.sqrt(d.n / max) * R)
      ctx.lineWidth = 3; ctx.strokeStyle = surface; ctx.strokeText(o.title(d.k), sx(ax), sy(ay) - r - 5)
      ctx.fillStyle = ink; ctx.fillText(o.title(d.k), sx(ax), sy(ay) - r - 5)
    }
    hover = (wx, wy) => {
      const d = placed.find((x) => Math.hypot(M.anchors[x.k][0] - wx, M.anchors[x.k][1] - wy) < Math.max(30, (Math.sqrt(x.n / max) * R) / s))
      return d ? [o.title(d.k), [{ value: full(d.n), label: 'dives from the map' }]] : null
    }
  }
  cv.addEventListener('pointermove', (e) => {
    const b = cv.getBoundingClientRect()
    const hit = hover(fx + ((e.clientX - b.left) / b.width) * fw, fy + ((e.clientY - b.top) / b.height) * fh)
    if (hit) tip(e.clientX, e.clientY, hit[0], hit[1]); else untip()
  })
  cv.addEventListener('pointerleave', untip)
  const empty = o.mode === 'taps' ? !o.taps.length : o.mode === 'look' ? !o.look.some(Boolean) : !o.dives.length
  body.append(seg, box, empty ? el('p', { class: 'ad-empty', text: 'Nothing to show for this one in this period yet.' }) : o.mode === 'dives' ? el('p', { class: 'ad-dim ad-heat-note', text: 'Each circle’s area is the dives into that building.' }) : el('div', { class: 'ad-ramp is-heat' }, el('span', { text: 'Quiet' }), el('i', { class: 'ad-heat-grad' }), el('span', { text: 'Busiest' })))
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
