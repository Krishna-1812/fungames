/**
 * Painting what build.ts decided: the cells, the sprites, the hit masks and
 * a small picture of the whole island for before the cells arrive.
 *
 * Cells: the world is cut into squares 512 pixels across at each level.
 * Each still run is painted, a strip of cells at a time, and cut into its
 * piece of each cell. Within a cell, runs that follow one another with
 * nothing moving over that cell in between are flattened into one piece,
 * so a cell far from anything that moves is a single picture; each cell's
 * pieces share one image. The engine draws a piece where its first run
 * falls in the painting order.
 */
import { Resvg } from '@resvg/resvg-js'
import sharp from 'sharp'
import { write, classes, styleOf, type El } from './xml'
import { RULES, LAYERS } from '../moves'
import type { Built, Run } from './build'
import { computeReach, grow, union } from './build'
import type { Box, M, Node, Page, Scene, Sprite } from '../scene'
import { Bounds, pathBounds } from '../kit'
import { mul, ID, parseSvgTransform } from '../anim'
import { xform } from './build'

export const LEVELS = process.env.ISLAND_LEVELS ? process.env.ISLAND_LEVELS.split(',').map(Number) : [0.5, 1, 2, 4, 8]
export const CELL = 512
/** Native memory (resvg's pictures) is only given back when JavaScript collects: collect often, when allowed. */
const gc = () => (globalThis as { gc?: () => void }).gc?.()
const MAX_SPRITE = 2048
const PAGE = 2048
const WEBP = { quality: 84, alphaQuality: 90, effort: 4, smartSubsample: true }

type Frag = { run: number; x: number; y: number; w: number; h: number; px: Buffer }

export type Painted = { scene: Scene; files: Map<string, Buffer>; levels: unknown[]; stats: Record<string, number> }

export async function paint(b: Built, view: [number, number, number, number], hash: string, log: (s: string) => void = () => {}): Promise<Painted> {
  const [vx, vy, vw, vh] = view
  const files = new Map<string, Buffer>()
  const stats: Record<string, number> = {}
  const t0 = Date.now()

  /* ---- writing a run (or anything) out as an SVG document ---- */
  const baseOf = (el: El) => {
    const cs = classes(el)
    const out: { opacity?: number; dash?: string; fill?: string } = {}
    for (const r of RULES) if (r.base && r.on.every((c) => cs.includes(c))) Object.assign(out, r.base)
    return out
  }
  const PRESENT = new Set(['transform', 'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-miterlimit', 'opacity', 'clip-path', 'mask', 'font-family', 'font-size', 'font-weight', 'text-anchor'])
  /** An element as resvg should see it: class rules applied, our own attributes gone. */
  const edit = (opts: { solid?: boolean } = {}) => (e: El): Record<string, string> | null => {
    const cs = classes(e)
    // Hidden by day, or only for the engine to show.
    if (cs.some((c) => c === 'ufo' || c === 'dawn-whale' || c === 'fireworks' || c === 'night-dim') && !opts.solid) return null
    const a: Record<string, string> = {}
    for (const [k, v] of Object.entries(e.attrs)) {
      if (k.startsWith('data-') || k === 'class' || k === 'aria-label' || k === 'href' && e.tag === 'a') continue
      if (k === 'style') {
        const keep = Object.entries(styleOf(e)).filter(([sk]) => !sk.startsWith('animation') && sk !== 'transform-origin' && !sk.startsWith('--'))
        if (keep.length) a.style = keep.map(([sk, sv]) => `${sk}:${sv}`).join(';')
        continue
      }
      if (k === 'visibility' && cs.includes('layer-night')) continue
      a[k] = v
    }
    if (e.tag === 'a') return { ...a }
    const st = styleOf(e), base = baseOf(e)
    if (base.opacity !== undefined && st.opacity === undefined) a.opacity = String(base.opacity)
    if (base.dash && st['stroke-dasharray'] === undefined) a['stroke-dasharray'] = base.dash
    if (base.fill && st.fill === undefined) a.fill = base.fill
    if (opts.solid) {
      // For hit masks: everything that can be pointed at, at full strength.
      if (a.fill === 'transparent' || a.fill === 'none') a.fill = '#000'
      a.opacity = '1'; delete a['fill-opacity']; delete a['stroke-opacity']
      delete a.visibility
    }
    return a
  }
  const wrapper = (e: El): string => {
    let a = ''
    for (const [k, v] of Object.entries(e.attrs)) if (PRESENT.has(k) && k !== 'opacity') a += ` ${k}="${v.replace(/"/g, '&quot;')}"`
    return `<g${a}>`
  }
  const idsIn = (els: El[]) => { const s = new Set<string>(); const go = (e: El) => { if (e.attrs.id) s.add(e.attrs.id); for (const k of e.kids) if (typeof k !== 'string') go(k) }; els.forEach(go); return s }
  /** Definitions that some elements refer to, not already among them. */
  const refs = (els: El[]): string => {
    const have = idsIn(els), need = new Set<string>()
    const look = (e: El) => {
      for (const v of Object.values(e.attrs)) for (const m of v.matchAll(/url\(#([^)]+)\)/g)) need.add(m[1])
      const h = e.attrs.href ?? e.attrs['xlink:href']
      if (h?.startsWith('#')) need.add(h.slice(1))
      for (const k of e.kids) if (typeof k !== 'string') look(k)
    }
    els.forEach(look)
    let out = ''
    const done = new Set<string>()
    const queue = [...need]
    while (queue.length) {
      const id = queue.shift()!
      if (done.has(id) || have.has(id)) continue
      done.add(id)
      const d = b.defs.get(id)
      if (!d) continue
      const before = need.size
      look(d)
      for (const n of need) if (!done.has(n)) queue.push(n)
      void before
      out += write(d, (e) => { const a = edit()(e); if (a && e !== d) delete a.id; if (a && e === d) a.id = id; return a })
    }
    return out
  }
  /** A run's markup: its elements, each inside the still groups it was drawn in. */
  const runBody = (run: Run, keep?: (el: El) => boolean): string => {
    let out = '', open: El[] = []
    for (const it of run.items) {
      if (keep && !keep(it.el)) continue
      let k = 0
      while (k < open.length && k < it.chain.length && open[k] === it.chain[k]) k++
      for (let i = open.length - 1; i >= k; i--) out += '</g>'
      for (let i = k; i < it.chain.length; i++) out += wrapper(it.chain[i])
      open = it.chain.slice()
      out += write(it.el, keep ? (e) => (keep(e) ? edit()(e) : null) : edit())
    }
    for (let i = open.length - 1; i >= 0; i--) out += '</g>'
    let inh = ''
    for (const [k, v] of Object.entries(run.inherit)) if (PRESENT.has(k)) inh += ` ${k}="${v.replace(/"/g, '&quot;')}"`
    return inh ? `<g${inh}>${out}</g>` : out
  }
  const doc = (body: string, defs: string, box: Box = [vx, vy, vx + vw, vy + vh]) => `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${box[0]} ${box[1]} ${box[2] - box[0]} ${box[3] - box[1]}" width="${box[2] - box[0]}" height="${box[3] - box[1]}">${defs ? `<defs>${defs}</defs>` : ''}${body}</svg>`
  const refCache = new Map<number, string>()
  const refsOf = (run: Run) => refCache.get(run.id) ?? refCache.set(run.id, refs(run.items.map((i) => i.el).concat(run.items.flatMap((i) => i.chain)))).get(run.id)!
  const runDoc = (run: Run, box?: Box) => doc(runBody(run), refs(run.items.map((i) => i.el).concat(run.items.flatMap((i) => i.chain))), box)
  const resvg = (svg: string, zoom: number) => new Resvg(svg, { fitTo: { mode: 'zoom', value: zoom }, font: { loadSystemFonts: false }, shapeRendering: 2, imageRendering: 0 })
  const crop = (r: Resvg, box: Box) => { const bb = r.getBBox() ?? (r.innerBBox() as never); if (!bb) return false; bb.x = box[0]; bb.y = box[1]; bb.width = box[2] - box[0]; bb.height = box[3] - box[1]; r.cropByBBox(bb); return true }
  /** The alpha box of some pixels (exclusive end), or null if all clear. */
  const alphaBox = (px: Buffer, w: number, x0: number, y0: number, x1: number, y1: number): [number, number, number, number] | null => {
    let ax0 = x1, ay0 = y1, ax1 = x0, ay1 = y0
    for (let y = y0; y < y1; y++) {
      const row = y * w
      for (let x = x0; x < x1; x++) if (px[(row + x) * 4 + 3]) { if (x < ax0) ax0 = x; if (x >= ax1) ax1 = x + 1; if (y < ay0) ay0 = y; ay1 = y + 1 }
    }
    return ax1 > ax0 ? [ax0, ay0, ax1, ay1] : null
  }
  /** Each cell's painted box in a strip of cells (x within its cell), in one pass. */
  const cellBoxes = (px: Buffer, W: number, H: number, n: number): ([number, number, number, number] | null)[] => {
    const u = new Uint32Array(px.buffer, px.byteOffset, (px.byteLength / 4) | 0)
    const x0 = new Int32Array(n).fill(CELL), y0 = new Int32Array(n).fill(H), x1 = new Int32Array(n), y1 = new Int32Array(n)
    for (let y = 0; y < H; y++) {
      const row = y * W
      for (let c = 0; c < n; c++) {
        const base = row + c * CELL
        let lo = -1, hi = -1
        for (let x = 0; x < CELL; x++) if (u[base + x] >>> 24) { lo = x; break }
        if (lo < 0) continue
        for (let x = CELL - 1; x >= lo; x--) if (u[base + x] >>> 24) { hi = x + 1; break }
        if (lo < x0[c]) x0[c] = lo
        if (hi > x1[c]) x1[c] = hi
        if (y < y0[c]) y0[c] = y
        y1[c] = y + 1
      }
    }
    const out: ([number, number, number, number] | null)[] = []
    for (let c = 0; c < n; c++) out.push(x1[c] > x0[c] ? [x0[c], y0[c], x1[c], y1[c]] : null)
    return out
  }
  const cut = (px: Buffer, w: number, x0: number, y0: number, cw: number, ch: number): Buffer => {
    const out = Buffer.alloc(cw * ch * 4)
    for (let y = 0; y < ch; y++) px.copy(out, y * cw * 4, ((y0 + y) * w + x0) * 4, ((y0 + y) * w + x0 + cw) * 4)
    return out
  }
  const webp = (px: Buffer, w: number, h: number) => (process.env.BAKE_NOENC ? Promise.resolve(Buffer.alloc(0)) : sharp(px, { raw: { width: w, height: h, channels: 4, premultiplied: true } }).webp(WEBP).toBuffer())

  /* ---- every still element's box in the world ----
   * resvg cannot paint a document in which something with an opacity of its
   * own lies wholly off the picture, so each strip is painted only from what
   * reaches it. These boxes are generous (curves by their control points,
   * strokes at full width): they only ever keep too much. */
  const SILENT_TAGS = new Set(['defs', 'clipPath', 'mask', 'linearGradient', 'radialGradient', 'pattern', 'symbol', 'filter', 'stop'])
  const wbox = new Map<El, Box | null>()
  const scaleOf = (m: M) => Math.max(Math.hypot(m[0], m[1]), Math.hypot(m[2], m[3]))
  const geom = (e: El, m: M, sw: number | null, depth = 0): Box | null => {
    if (SILENT_TAGS.has(e.tag)) return null
    const own = e.attrs.transform ? mul(m, parseSvgTransform(e.attrs.transform)) : m
    const st = styleOf(e)
    const strokeAttr = st.stroke ?? e.attrs.stroke
    const swAttr = st['stroke-width'] ?? e.attrs['stroke-width']
    const strokeW = strokeAttr === 'none' ? null : swAttr !== undefined ? Number(swAttr) : strokeAttr !== undefined ? (sw ?? 1) : sw
    const pad = (b: Box | null): Box | null => (b ? grow(b, (strokeW ? (strokeW * scaleOf(own)) / 2 : 0) + 2) : null)
    const n = (k: string) => Number(e.attrs[k] ?? 0)
    let local: Box | null = null
    switch (e.tag) {
      case 'path': { const bb = new Bounds(); pathBounds(e.attrs.d ?? '', bb); if (Number.isFinite(bb.x0)) local = [bb.x0, bb.y0, bb.x1, bb.y1]; break }
      case 'circle': local = [n('cx') - n('r'), n('cy') - n('r'), n('cx') + n('r'), n('cy') + n('r')]; break
      case 'ellipse': local = [n('cx') - n('rx'), n('cy') - n('ry'), n('cx') + n('rx'), n('cy') + n('ry')]; break
      case 'rect': local = [n('x'), n('y'), n('x') + n('width'), n('y') + n('height')]; break
      case 'line': local = [Math.min(n('x1'), n('x2')), Math.min(n('y1'), n('y2')), Math.max(n('x1'), n('x2')), Math.max(n('y1'), n('y2'))]; break
      case 'polygon': case 'polyline': { const v = (e.attrs.points ?? '').trim().split(/[\s,]+/).map(Number); const xs = v.filter((_, i) => i % 2 === 0), ys = v.filter((_, i) => i % 2 === 1); if (xs.length) local = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; break }
      case 'use': {
        const ref = b.defs.get((e.attrs.href ?? e.attrs['xlink:href'] ?? '').slice(1))
        if (ref && depth < 4) { const at = mul(own, [1, 0, 0, 1, n('x'), n('y')]); return geom(ref, at, strokeW, depth + 1) && pad(geom(ref, at, strokeW, depth + 1)) }
        return null
      }
      default: {
        let u: Box | null = null
        for (const k of e.kids) if (typeof k !== 'string') u = union(u, geomCached(k, own, strokeW))
        return u
      }
    }
    return local ? pad(xform(own, local)) : null
  }
  const geomCached = (e: El, m: M, sw: number | null): Box | null => { if (wbox.has(e)) return wbox.get(e)!; const bx = geom(e, m, sw); wbox.set(e, bx); return bx }
  const inheritedSw = (chain: El[], inh: Record<string, string>) => { let sw: number | null = inh['stroke-width'] ? Number(inh['stroke-width']) : inh.stroke && inh.stroke !== 'none' ? 1 : null; for (const c of chain) { if (c.attrs['stroke-width']) sw = Number(c.attrs['stroke-width']); if (c.attrs.stroke === 'none') sw = null } return sw }
  const chainM = (chain: El[]) => chain.reduce((m, c) => (c.attrs.transform ? mul(m, parseSvgTransform(c.attrs.transform)) : m), [...ID] as M)
  for (const run of b.runs) if (run.cell) for (const it of run.items) geomCached(it.el, chainM(it.chain), inheritedSw(it.chain, run.inherit))
  /** Whether some markup holds anything but empty groups. */
  const PAINTS = /<(?!\/|g[ >/])/
  const reaches = (e: El, bx: Box) => { for (let q: El | undefined = e; q; q = q.parent) if (SILENT_TAGS.has(q.tag)) return true; const w = wbox.get(e); return !!w && w[0] < bx[2] && w[2] > bx[0] && w[1] < bx[3] && w[3] > bx[1] }

  /* ---- where each still run is: a quick small painting of each ---- */
  const cellRuns = b.runs.filter((r) => r.cell && r.items.length)
  const PROBE = 0.5, wide: Box = [vx - vw * 0.6, vy - vh * 0.6, vx + vw * 1.6, vy + vh * 1.6]
  const runBox = new Map<number, Box>()
  for (const run of process.env.BAKE_SKIP ? [] : cellRuns) {
    const body = runBody(run, (e) => reaches(e, wide))
    if (!PAINTS.test(body)) continue
    const r = resvg(doc(body, refs(run.items.map((i) => i.el).concat(run.items.flatMap((i) => i.chain))), wide), PROBE)
    const img = r.render(), ab = alphaBox(img.pixels, img.width, 0, 0, img.width, img.height)
    gc()
    if (!ab) continue
    // Two probe pixels of margin each way: anything fainter than the probe can see is inside that.
    runBox.set(run.id, [wide[0] + (ab[0] - 2) / PROBE, wide[1] + (ab[1] - 2) / PROBE, wide[0] + (ab[2] + 2) / PROBE, wide[1] + (ab[3] + 2) / PROBE])
  }
  let ext: Box | null = null
  for (const bx of runBox.values()) ext = union(ext, bx)
  ext = union(ext, view)!
  // Cell edges land on whole pixels at every level: the origin on a multiple of 64.
  const ox = Math.floor(ext[0] / 64) * 64, oy = Math.floor(ext[1] / 64) * 64
  const extent: Box = [ox, oy, Math.ceil(ext[2] / 64) * 64, Math.ceil(ext[3] / 64) * 64]
  log(`probed ${cellRuns.length} runs in ${Date.now() - t0}ms; extent ${extent.join(' ')}`)

  /* ---- sprites: measured and painted at every level ---- */
  const spriteList: Sprite[] = []
  const spriteRun = new Map<number, number>()
  const spritePx: { level: number; w: number; h: number; px: Buffer; sprite: number }[] = []
  for (const { run } of process.env.BAKE_SKIP ? [] : b.sprites) {
    const body = runDoc(run)
    let gb: Box | null = null
    try { const r = resvg(body, 1); const bb = r.getBBox(); if (bb) gb = [bb.x, bb.y, bb.x + bb.width, bb.y + bb.height] } catch { /* empty */ }
    if (!gb) continue
    let margin = 6, box: Box = gb, ok = false
    const out: { level: number; w: number; h: number; px: Buffer; trim: [number, number, number, number] }[] = []
    for (let tries = 0; tries < 4 && !ok; tries++) {
      box = [Math.floor((gb[0] - margin) / 2) * 2, Math.floor((gb[1] - margin) / 2) * 2, Math.ceil((gb[2] + margin) / 2) * 2, Math.ceil((gb[3] + margin) / 2) * 2]
      out.length = 0; ok = true
      for (const L of LEVELS) {
        const w = Math.round((box[2] - box[0]) * L), h = Math.round((box[3] - box[1]) * L)
        if (w > MAX_SPRITE || h > MAX_SPRITE) break
        const r = resvg(doc(runBody(run), refs(run.items.map((i) => i.el).concat(run.items.flatMap((i) => i.chain))), box), L)
        const img = r.render(), ipx = img.pixels
        const ab = alphaBox(ipx, img.width, 0, 0, img.width, img.height)
        if (!ab) break
        // Paint touching the edge means the margin was too small: widen and paint again.
        if (L === LEVELS[LEVELS.length - 1] || L === 2) if (ab[0] === 0 || ab[1] === 0 || ab[2] === img.width || ab[3] === img.height) { ok = false; margin *= 3; break }
        out.push({ level: L, w: img.width, h: img.height, px: ipx, trim: ab })
      }
    }
    if (!out.length) continue
    const id = spriteList.length
    spriteRun.set(run.id, id)
    spriteList.push({ box, at: LEVELS.map(() => null) })
    for (const o of out) spritePx.push({ level: o.level, w: o.w, h: o.h, px: o.px, sprite: id })
  }
  log(`sprites: ${spriteList.length} measured and painted (${Date.now() - t0}ms)`)

  /* ---- now every node's reach is known ---- */
  const spriteBoxOf = (runId: number) => { const s = spriteRun.get(runId); return s === undefined ? null : spriteList[s].box }
  computeReach(b.root, b.keyframes, spriteBoxOf)

  /* ---- sprites into sheets, grouped by where they are ---- */
  const GC = 3, GR = 2
  const groups: Box[] = [extent]
  for (let r = 0; r < GR; r++) for (let c = 0; c < GC; c++) groups.push([extent[0] + ((extent[2] - extent[0]) * c) / GC, extent[1] + ((extent[3] - extent[1]) * r) / GR, extent[0] + ((extent[2] - extent[0]) * (c + 1)) / GC, extent[1] + ((extent[3] - extent[1]) * (r + 1)) / GR])
  const groupOf = new Map<number, number>()
  for (const { run, top } of b.sprites) {
    const s = spriteRun.get(run.id); if (s === undefined) continue
    const bb = top.bb ?? extent
    const big = bb[2] - bb[0] > (extent[2] - extent[0]) * 0.4 || bb[3] - bb[1] > (extent[3] - extent[1]) * 0.4
    if (big) { groupOf.set(s, 0); continue }
    const cx = (bb[0] + bb[2]) / 2, cy = (bb[1] + bb[3]) / 2
    const gc = Math.max(0, Math.min(GC - 1, Math.floor(((cx - extent[0]) / (extent[2] - extent[0])) * GC)))
    const gr = Math.max(0, Math.min(GR - 1, Math.floor(((cy - extent[1]) / (extent[3] - extent[1])) * GR)))
    groupOf.set(s, 1 + gr * GC + gc)
  }
  const pages: Page[] = []
  for (const L of LEVELS) {
    const li = LEVELS.indexOf(L)
    // At the small levels everything fits in a sheet or two: one group.
    const byGroup = new Map<number, typeof spritePx>()
    for (const sp of spritePx) if (sp.level === L) { const g = L <= 1 ? 0 : groupOf.get(sp.sprite) ?? 0; (byGroup.get(g) ?? byGroup.set(g, []).get(g)!).push(sp) }
    for (const [g, list] of byGroup) {
      list.sort((a, c) => c.h - a.h)
      // Shelf packing, two pixels apart.
      let page: { w: number; h: number; items: { sp: (typeof spritePx)[number]; x: number; y: number }[] } | null = null
      let shelfY = 0, shelfH = 0, x = 0
      const flush = async () => {
        if (!page || !page.items.length) return
        const W = page.w, H = page.h
        const px = Buffer.alloc(W * H * 4)
        for (const it of page.items) { const s = it.sp; for (let y = 0; y < s.h; y++) s.px.copy(px, ((it.y + y) * W + it.x) * 4, y * s.w * 4, (y + 1) * s.w * 4) }
        const file = `s/${li}-${g}-${pages.length}.webp`
        files.set(file, await webp(px, W, H))
        const pi = pages.length
        pages.push({ file, w: W, h: H, level: L, group: g })
        for (const it of page.items) spriteList[it.sp.sprite].at[li] = [pi, it.x, it.y, it.sp.w, it.sp.h]
      }
      for (const sp of list) {
        if (!page || (x + sp.w > PAGE && shelfY + shelfH + sp.h + 2 > PAGE)) { await flush(); page = { w: 0, h: 0, items: [] }; shelfY = 0; shelfH = 0; x = 0 }
        if (x + sp.w > PAGE) { shelfY += shelfH + 2; shelfH = 0; x = 0 }
        if (shelfY + sp.h > PAGE) { await flush(); page = { w: 0, h: 0, items: [] }; shelfY = 0; shelfH = 0; x = 0 }
        page.items.push({ sp, x, y: shelfY })
        page.w = Math.max(page.w, x + sp.w); page.h = Math.max(page.h, shelfY + sp.h)
        x += sp.w + 2; shelfH = Math.max(shelfH, sp.h)
      }
      await flush()
    }
  }
  stats.spritePages = pages.length
  log(`sprite sheets: ${pages.length} (${Date.now() - t0}ms)`)

  /* ---- the painting order, as the cells see it ---- */
  type Step = { run: number; ctx: number } | { bar: Box | null }
  const seq: Step[] = []
  const hasRun = (n: Node): boolean => n.k === 'run' || (n.k === 'g' && n.kids.some(hasRun))
  const flat = (n: Node) => {
    if (n.k === 'run') { const run = b.runs[n.id]; if (runBox.has(n.id)) seq.push({ run: n.id, ctx: run.ctx }); return }
    if (n.k === 'g' && hasRun(n)) { seq.push({ bar: null }); n.kids.forEach(flat); seq.push({ bar: null }); return }
    if (n.k === 'sea') return
    seq.push({ bar: (n as { bb?: Box }).bb ?? null })
  }
  b.root.forEach(flat)
  // A group boundary (bar: null) separates contexts but crosses no cell by itself; ctx already tells them apart.
  const steps = seq.filter((s) => !('bar' in s) || s.bar)

  /* ---- the cells ---- */
  const levelIndex: { cols: number; rows: number; day: Record<number, number[]>; night: Record<number, number[]> }[] = []
  let cellFiles = 0, cellBytes = 0
  for (const L of process.env.BAKE_SKIP ? [] : LEVELS) {
    const li = LEVELS.indexOf(L)
    const S = CELL / L
    const cols = Math.ceil((extent[2] - extent[0]) / S), rows = Math.ceil((extent[3] - extent[1]) / S)
    const idx = { cols, rows, day: {} as Record<number, number[]>, night: {} as Record<number, number[]> }
    for (let cy = 0; cy < rows; cy++) {
      const y0 = extent[1] + cy * S, y1 = y0 + S
      // Each run's piece of each cell in this row.
      const frags = new Map<number, Frag[]>() // cell x -> frags
      for (const run of cellRuns) {
        const rb = runBox.get(run.id); if (!rb || rb[3] <= y0 || rb[1] >= y1) continue
        const cx0 = Math.max(0, Math.floor((rb[0] - extent[0]) / S)), cx1 = Math.min(cols, Math.ceil((rb[2] - extent[0]) / S))
        if (cx1 <= cx0) continue
        const strip: Box = [extent[0] + cx0 * S, y0, extent[0] + cx1 * S, y1]
        const body = runBody(run, (e) => reaches(e, strip))
        if (!PAINTS.test(body)) continue
        const img = resvg(doc(body, refsOf(run), strip), L).render(), W = img.width, H = Math.min(CELL, img.height)
        // (Reading .pixels copies the whole picture: once.)
        const px = img.pixels
        const boxes = cellBoxes(px, W, H, cx1 - cx0)
        for (let cx = cx0; cx < cx1; cx++) {
          const ab = boxes[cx - cx0]
          if (!ab) continue
          const px0 = (cx - cx0) * CELL
          const w = ab[2] - ab[0], h = ab[3] - ab[1]
          ;(frags.get(cx) ?? frags.set(cx, []).get(cx)!).push({ run: run.id, x: ab[0], y: ab[1], w, h, px: cut(px, W, px0 + ab[0], ab[1], w, h) })
        }
      }
      gc()
      // Pieces that can be flattened together, cell by cell.
      for (const [cx, list] of frags) {
        const cellBox: Box = [extent[0] + cx * S - 1, y0 - 1, extent[0] + (cx + 1) * S + 1, y1 + 1]
        const has = new Map(list.map((f) => [f.run, f]))
        const touches = (bb: Box) => bb[0] < cellBox[2] && bb[2] > cellBox[0] && bb[1] < cellBox[3] && bb[3] > cellBox[1]
        const segs: { night: boolean; first: number; parts: Frag[] }[] = []
        let cur: (typeof segs)[number] | null = null, curCtx = -1
        for (const st of steps) {
          if ('bar' in st) { if (st.bar && touches(st.bar)) cur = null; continue }
          const f = has.get(st.run)
          if (!f) continue
          const night = b.runs[st.run].night
          if (cur && curCtx === st.ctx && cur.night === night) cur.parts.push(f)
          else { cur = { night, first: st.run, parts: [f] }; segs.push(cur); curCtx = st.ctx }
        }
        // Flatten each: paint its parts one over another, premultiplied.
        const out: { night: boolean; first: number; x: number; y: number; w: number; h: number; px: Buffer }[] = []
        for (const sg of segs) {
          if (sg.parts.length === 1) { const f = sg.parts[0]; out.push({ night: sg.night, first: sg.first, x: f.x, y: f.y, w: f.w, h: f.h, px: f.px }); continue }
          const x0 = Math.min(...sg.parts.map((f) => f.x)), y0b = Math.min(...sg.parts.map((f) => f.y))
          const x1 = Math.max(...sg.parts.map((f) => f.x + f.w)), y1b = Math.max(...sg.parts.map((f) => f.y + f.h))
          const w = x1 - x0, h = y1b - y0b, px = Buffer.alloc(w * h * 4)
          for (const f of sg.parts) {
            for (let y = 0; y < f.h; y++) {
              let si = y * f.w * 4, di = ((f.y - y0b + y) * w + (f.x - x0)) * 4
              for (let x = 0; x < f.w; x++, si += 4, di += 4) {
                const a = f.px[si + 3]
                if (!a) continue
                if (a === 255) { px[di] = f.px[si]; px[di + 1] = f.px[si + 1]; px[di + 2] = f.px[si + 2]; px[di + 3] = 255; continue }
                const k = (255 - a) / 255
                px[di] = f.px[si] + px[di] * k; px[di + 1] = f.px[si + 1] + px[di + 1] * k; px[di + 2] = f.px[si + 2] + px[di + 2] * k; px[di + 3] = a + px[di + 3] * k
              }
            }
          }
          out.push({ night: sg.night, first: sg.first, x: x0, y: y0b, w, h, px })
        }
        // Into one image per cell (and one for the night), stacked in shelves.
        for (const night of [false, true]) {
          const mine = out.filter((o) => o.night === night)
          if (!mine.length) continue
          const PW = 1024
          let x = 0, y = 0, sh = 0, W = 0, H = 0
          const at = mine.map((o) => { if (x + o.w > PW) { y += sh + 2; x = 0; sh = 0 } const p = [x, y]; x += o.w + 2; sh = Math.max(sh, o.h); W = Math.max(W, p[0] + o.w); H = Math.max(H, p[1] + o.h); return p })
          const px = Buffer.alloc(W * H * 4)
          mine.forEach((o, i) => { for (let yy = 0; yy < o.h; yy++) o.px.copy(px, ((at[i][1] + yy) * W + at[i][0]) * 4, yy * o.w * 4, (yy + 1) * o.w * 4) })
          const file = `c/${li}/${night ? 'n' : ''}${cx}_${cy}.webp`
          const buf = await webp(px, W, H)
          files.set(file, buf); cellFiles++; cellBytes += buf.length
          const ci = cy * cols + cx
          const list2: number[] = []
          mine.forEach((o, i) => list2.push(o.first, at[i][0], at[i][1], o.w, o.h, o.x, o.y))
          ;(night ? idx.night : idx.day)[ci] = list2
        }
      }
    }
    levelIndex.push(idx)
    gc()
    log(`level ${L}: ${cols}x${rows} cells (${Date.now() - t0}ms, ${cellFiles} files so far, ${(cellBytes / 1e6).toFixed(1)} MB, rss ${(process.memoryUsage().rss / 1e6).toFixed(0)} MB)`)
  }
  stats.cellFiles = cellFiles; stats.cellBytes = cellBytes

  /* ---- hit masks ---- */
  const masks: Scene['masks'] = {}
  const RES = 1
  for (const m of process.env.BAKE_MASK ? b.masks.filter((x) => x.key === process.env.BAKE_MASK) : b.masks) {
    const own: El = { ...m.el, attrs: { ...m.el.attrs } }
    delete own.attrs.transform
    let inh = ''
    for (const [k, v] of Object.entries(m.inherit)) if (PRESENT.has(k) && k !== 'transform') inh += ` ${k}="${v}"`
    const body = `<g${inh}>${write(own, edit({ solid: true }))}</g>`
    const defs = refs([own])
    let gb: Box | null = null
    try { const bb = resvg(doc(body, defs), 1).getBBox(); if (bb) gb = [bb.x, bb.y, bb.x + bb.width, bb.y + bb.height] } catch { /* empty */ }
    if (!gb) continue
    const box: Box = [Math.floor(gb[0] - 3), Math.floor(gb[1] - 3), Math.ceil(gb[2] + 3), Math.ceil(gb[3] + 3)]
    if (process.env.BAKE_DEBUG) { log(`mask ${m.key} ${box.join(" ")}`); if (process.env.BAKE_DUMP && m.key === process.env.BAKE_MASK) (await import("node:fs")).writeFileSync(process.env.BAKE_DUMP, doc(body, defs, box)) }
    const img = resvg(doc(body, defs, box), RES).render()
    const w = img.width, h = img.height, mpx = img.pixels
    const bits = new Uint8Array(Math.ceil((w * h) / 8))
    for (let i = 0; i < w * h; i++) if (mpx[i * 4 + 3] > 40) bits[i >> 3] |= 1 << (i & 7)
    masks[m.key] = { box, res: RES, w, h, bits: Buffer.from(bits).toString('base64') }
  }
  log(`masks: ${Object.keys(masks).length} (${Date.now() - t0}ms)`)

  /* ---- the whole island, small, for before the cells arrive (and without script) ---- */
  {
    const everything = b.runs.filter((r) => r.items.length && !r.night)
    void everything
  }

  /* ---- the scene ---- */
  // Run ids as the engine sees them: only runs that painted something keep a slot.
  const remap = (n: Node): Node | null => {
    if (n.k === 'run') return runBox.has(n.id) ? n : null
    if (n.k === 'spr') { const s = spriteRun.get(n.id); return s === undefined ? null : { k: 'spr', id: s } }
    if (n.k === 'g') { n.kids = n.kids.map(remap).filter((x): x is Node => !!x); return n }
    return n
  }
  const root = b.root.map(remap).filter((x): x is Node => !!x)
  const used = new Set<string>()
  const findKf = (n: Node) => { if ('a' in n && n.a) for (const a of n.a) used.add(a.kf); if (n.k === 'g') n.kids.forEach(findKf) }
  root.forEach(findKf)
  const keyframes = Object.fromEntries(Object.entries(b.keyframes))
  const levelsOut = levelIndex.map((ix, i) => { const file = `L${i}.json`; files.set(file, Buffer.from(JSON.stringify(ix))); return { scale: LEVELS[i], cols: ix.cols, rows: ix.rows, index: file } })
  const scene: Scene = { v: 1, hash, view, levels: LEVELS, cell: CELL, extent, lv: levelsOut, root, keyframes, sprites: spriteList, pages, groups, masks, pokes: b.pokes }
  void LAYERS; void grow
  stats.ms = Date.now() - t0
  return { scene, files, levels: levelsOut, stats }
}
