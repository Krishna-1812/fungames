/**
 * The admin page's small toolkit: building elements (always with textContent:
 * everything shown came from visitors' browsers), formatting numbers and
 * times, one tooltip for every chart, and the card every chart sits in, with
 * its table view and CSV download.
 */
import { csvCell } from '../analytics/csv'

type Attrs = Record<string, string | number | boolean | undefined | null>
/** An element, with attributes, and children as nodes or plain text (never HTML). */
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...kids: (Node | string | number | null | undefined | false)[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue
    if (k === 'class') e.className = String(v)
    else if (k === 'text') e.textContent = String(v)
    else e.setAttribute(k, v === true ? '' : String(v))
  }
  for (const c of kids) if (c !== null && c !== undefined && c !== false) e.append(c instanceof Node ? c : String(c))
  return e
}
export const SVG = 'http://www.w3.org/2000/svg'
export function sv<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Attrs = {}, ...kids: (Node | string | null | undefined | false)[]): SVGElementTagNameMap[K] {
  const e = document.createElementNS(SVG, tag)
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null && v !== false) e.setAttribute(k, String(v))
  for (const c of kids) if (c) e.append(c instanceof Node ? c : document.createTextNode(c))
  return e
}

/* ---- numbers and times ------------------------------------------------- */

export const fmt = (v: number) => {
  const a = Math.abs(v)
  if (a >= 1e6) return (v / 1e6).toFixed(a >= 1e7 ? 0 : 1) + 'M'
  if (a >= 1e4) return Math.round(v / 1e3) + 'k'
  if (a >= 1e3) return (v / 1e3).toFixed(1).replace(/\.0$/, '') + 'k'
  return Number.isInteger(v) ? v.toLocaleString() : v.toLocaleString(undefined, { maximumFractionDigits: v < 10 ? 2 : 1 })
}
export const full = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 2 })
export const pct = (a: number, b: number, digits = 0) => (b ? ((a / b) * 100).toFixed(digits) + '%' : '–')
export const share = (v: number) => (v * 100).toFixed(v < 0.1 && v > 0 ? 1 : 0) + '%'
export function dur(ms: number) {
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`
  return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m`
}
export function ago(t: string | Date) {
  const s = Math.max(0, Math.round((Date.now() - new Date(t).getTime()) / 1000))
  return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.floor(s / 60)}m ago` : s < 86400 ? `${Math.floor(s / 3600)}h ago` : `${Math.floor(s / 86400)}d ago`
}
const regionNames = (() => { try { return new Intl.DisplayNames(undefined, { type: 'region' }) } catch { return null } })()
const langNames = (() => { try { return new Intl.DisplayNames(undefined, { type: 'language' }) } catch { return null } })()
export const country = (c: string) => { try { return (c && regionNames?.of(c)) || c || 'Unknown' } catch { return c } }
export const language = (c: string) => { try { return (c && langNames?.of(c)) || c } catch { return c } }
/** A bucket label from the server ('2026-10-05T14:00') as the axis and tooltip say it. */
export function when(t: string, bucket: 'hour' | 'day' | 'week', long = false) {
  const d = new Date(t.length === 16 ? t + ':00' : t)
  if (bucket === 'hour') return long ? d.toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : d.toLocaleTimeString(undefined, { hour: 'numeric' })
  if (bucket === 'week') return (long ? 'Week of ' : '') + d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  return d.toLocaleDateString(undefined, long ? { weekday: 'short', day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short' })
}

/* ---- the tooltip ------------------------------------------------------- */

let tipEl: HTMLDivElement | null = null
export type TipRow = { value: string; label: string; slot?: number }
/** One tooltip for every chart: a title, then rows with the value first. */
export function tip(x: number, y: number, title: string, rows: TipRow[]) {
  if (!tipEl) { tipEl = el('div', { class: 'ad-tip', role: 'status' }); document.body.append(tipEl) }
  tipEl.replaceChildren(el('p', { class: 'ad-tip-t', text: title }), ...rows.map((r) => el('p', { class: 'ad-tip-r' },
    r.slot ? el('i', { class: `ad-key s${r.slot}` }) : '', el('b', { text: r.value }), el('span', { text: r.label }))))
  tipEl.hidden = false
  const w = tipEl.offsetWidth, h = tipEl.offsetHeight
  const left = Math.min(innerWidth - w - 8, Math.max(8, x + 14))
  const top = y - h - 12 < 8 ? y + 16 : y - h - 12
  tipEl.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`
}
export const untip = () => { if (tipEl) tipEl.hidden = true }

/* ---- cards, tables, CSV ------------------------------------------------- */

export type Table = { cols: string[]; rows: (string | number)[][]; align?: ('l' | 'r')[] }

export function download(name: string, text: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = el('a', { href: url, download: name })
  document.body.append(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
export const csvOf = (t: Table) => '﻿' + [t.cols, ...t.rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n'

export function tableEl(t: Table, opts: { sortable?: boolean; onRow?: (i: number) => void } = {}) {
  const align = (i: number) => t.align?.[i] ?? (i === 0 ? 'l' : 'r')
  const table = el('table', { class: 'ad-table' })
  const thead = el('thead', {}, el('tr', {}, ...t.cols.map((c, i) => el('th', { scope: 'col', class: `a-${align(i)}` }, opts.sortable ? el('button', { type: 'button', 'data-col': i, text: c }) : c))))
  const tbody = el('tbody')
  let order = t.rows.map((_, i) => i), sortCol = -1, dir = -1
  const paint = () => tbody.replaceChildren(...order.map((i) => {
    const tr = el('tr', {}, ...t.rows[i].map((v, j) => (j === 0 ? el('th', { scope: 'row', class: `a-${align(j)}` }, String(v)) : el('td', { class: `a-${align(j)}` }, typeof v === 'number' ? full(v) : String(v)))))
    if (opts.onRow) { tr.classList.add('is-link'); tr.tabIndex = 0; tr.addEventListener('click', () => opts.onRow!(i)); tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') opts.onRow!(i) }) }
    return tr
  }))
  paint()
  if (opts.sortable) thead.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button'); if (!b) return
    const c = Number(b.dataset.col)
    dir = sortCol === c ? -dir : -1; sortCol = c
    order = [...order].sort((x, y) => { const a = t.rows[x][c], bb = t.rows[y][c]; return (typeof a === 'number' && typeof bb === 'number' ? a - bb : String(a).localeCompare(String(bb))) * dir })
    for (const th of thead.querySelectorAll('button')) th.removeAttribute('aria-sort')
    b.setAttribute('aria-sort', dir < 0 ? 'descending' : 'ascending')
    paint()
  })
  table.append(thead, tbody)
  return el('div', { class: 'ad-scroll' }, table)
}

export type CardOpts = {
  title: string
  sub?: string
  /** How many of the grid's columns it spans (1 to 4), or 'full'. */
  span?: 1 | 2 | 3 | 4 | 'full'
  table?: () => Table
  /** Draw the chart into body; called again when the card is resized. */
  draw?: (body: HTMLElement) => void
  /** Show the table, not a chart (for things that are only a table). */
  tableOnly?: boolean
  file?: string
  empty?: boolean
  emptyText?: string
}

/** A card: a title, a chart (redrawn on resize), and a table twin with a CSV download. */
export function card(parent: HTMLElement, o: CardOpts) {
  const body = el('div', { class: 'ad-card-body' })
  const head = el('div', { class: 'ad-card-head' }, el('div', {}, el('h3', { text: o.title }), o.sub ? el('p', { class: 'ad-sub', text: o.sub }) : null))
  const acts = el('div', { class: 'ad-card-acts' })
  const c = el('section', { class: `ad-card span-${o.span ?? 2}` }, head, body)
  head.append(acts)
  let showTable = !!o.tableOnly
  const paint = () => {
    body.replaceChildren()
    if (o.empty) { body.append(el('p', { class: 'ad-empty', text: o.emptyText ?? 'Nothing in this period yet.' })); return }
    if (showTable && o.table) body.append(tableEl(o.table(), { sortable: true }))
    else o.draw?.(body)
  }
  if (o.table && !o.empty) {
    if (o.draw && !o.tableOnly) {
      const tb = el('button', { type: 'button', class: 'ad-mini', 'aria-pressed': 'false', text: 'Table' })
      tb.addEventListener('click', () => { showTable = !showTable; tb.setAttribute('aria-pressed', String(showTable)); paint() })
      acts.append(tb)
    }
    const cb = el('button', { type: 'button', class: 'ad-mini', text: 'CSV', 'aria-label': `Download ${o.title} as CSV` })
    cb.addEventListener('click', () => download(`${o.file ?? o.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`, csvOf(o.table!())))
    acts.append(cb)
  }
  parent.append(c)
  paint()
  if (o.draw && !o.empty) {
    let w = 0, t = 0
    new ResizeObserver(() => {
      const nw = Math.round(body.clientWidth)
      if (!w) { w = nw; return }
      if (Math.abs(nw - w) < 8 || showTable) return
      w = nw; clearTimeout(t); t = window.setTimeout(paint, 80)
    }).observe(body)
  }
  return c
}

/** A row of headline numbers. */
export type Stat = { label: string; value: string; delta?: { now: number; before: number; invert?: boolean }; sub?: string; slot?: number }
export function stats(parent: HTMLElement, items: Stat[], compare = true) {
  const wrap = el('section', { class: 'ad-stats' })
  for (const s of items) {
    const d = s.delta
    let dEl: HTMLElement | null = null
    if (compare && d) {
      if (!d.before) dEl = el('span', { class: 'ad-delta is-new', text: d.now ? 'new' : '' })
      else {
        const ch = Math.round(((d.now - d.before) / d.before) * 100)
        const good = d.invert ? ch < 0 : ch > 0
        dEl = el('span', { class: `ad-delta ${ch === 0 ? 'is-flat' : good ? 'is-up' : 'is-down'}`, text: ch === 0 ? '±0%' : `${ch > 0 ? '↑' : '↓'} ${Math.abs(ch)}%`, title: `vs ${full(d.before)} the period before` })
      }
    }
    wrap.append(el('div', { class: `ad-stat${s.slot ? ' k' + s.slot : ''}` }, el('p', { class: 'ad-stat-l', text: s.label }), el('p', { class: 'ad-stat-v', text: s.value }), dEl, s.sub ? el('p', { class: 'ad-stat-s', text: s.sub }) : null))
  }
  parent.append(wrap)
  return wrap
}

export function section(parent: HTMLElement, title: string, sub?: string) {
  parent.append(el('div', { class: 'ad-section' }, el('h2', { text: title }), sub ? el('p', { text: sub }) : null))
}
