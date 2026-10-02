/**
 * Taking the island apart: what never moves, and what does.
 *
 * Every layer's markup is walked in painting order. Whatever stands still
 * goes into a "run", the longest stretch of still painting between two things
 * that move; runs at the top of the map (the sea, the ground, the scenery)
 * are painted into cells, and runs inside something that moves become that
 * thing's sprites (or, when they are a handful of plain shapes, its vector
 * shapes). Whatever moves becomes a node, carrying its animations with every
 * value resolved (the keyframes, its turning point, its reach), so the engine
 * only has to play them.
 *
 * Nothing here draws; draw.ts paints what this decides.
 */
import { Resvg } from '@resvg/resvg-js'
import { parse, write, classes, styleOf, walk, type El } from './xml'
import { RULES, KEYFRAMES, LAYERS, POKES, POKE_SAY, LANDMARK, type Loop, type Rule, type When } from '../moves'
import { parseKeyframes } from '../keyframes'
import { parseSvgTransform, mul, ID, apply, fnsMatrix, progress, sampleProp, ease, touches } from '../anim'
import type { Anim, Box, Keyframes, M, Node, Style } from '../scene'

export type RunItem = { el: El; chain: El[] }
/** A still stretch of painting: in cells (world) or as a sprite (in its node's coordinates). */
export type Run = { id: number; cell: boolean; night: boolean; items: RunItem[]; ctx: number; inherit: Record<string, string> }
export type Built = {
  root: Node[]
  runs: Run[]
  keyframes: Record<string, Keyframes>
  /** Sprites: their run, and for each the top node whose group it is sorted into. */
  /** Each sprite's run, the topmost moving group it is in, and how many world units one of its own units spans (its groups' scale, at rest). */
  sprites: { run: Run; top: Node & { k: 'g' }; scale: number }[]
  masks: { key: string; el: El; inherit: Record<string, string> }[]
  defs: Map<string, El>
  pokes: string[]
  cards: Record<string, string>
  warnings: string[]
}

/** Elements that never paint by themselves. */
const SILENT = new Set(['defs', 'clipPath', 'mask', 'linearGradient', 'radialGradient', 'pattern', 'symbol', 'filter', 'style', 'title', 'desc', 'stop'])
/** Shapes the engine can draw from their outline. */
const SHAPES = new Set(['path', 'circle', 'ellipse', 'rect', 'line', 'polygon', 'polyline'])
/** Presentation attributes that children inherit. */
const INHERITED = ['fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-miterlimit', 'font-family', 'font-size', 'font-weight', 'text-anchor', 'letter-spacing', 'dominant-baseline', 'visibility']
/** Classes the engine finds and drives by itself. */
const DRIVEN = new Set(['mover', 'es-win', 'liw-cell', 'wwa-year', 'pg-pct', 'pg-year', 'pg-bar', 'dt-fossil', 'cloud-puff', 'cloud-base', 'night-veil', 'lm-ring', 'lm-art', 'pk-say', 'mill-sails', 'fount-up', 'kite', 'cloud', 'isl-plane', 'walker', 'dsi-count'])
/**
 * Of those, the ones whose own paint the engine changes (a fill, a dash, a
 * width): drawn from their outlines. Everything else that moves is a
 * picture (a sprite) moved whole, which costs the canvas a fraction of
 * drawing the shape again: fifteen hundred shapes drawn from their outlines
 * every frame held the map to twelve frames a second.
 */
const OUTLINED = new Set(['es-win', 'liw-cell', 'pg-bar', 'cloud-puff', 'cloud-base', 'night-veil', 'lm-ring'])
/**
 * Classes whose opacity the time of day sets (moves.ts LAYERS): the page's
 * CSS set it over the element's own opacity attribute, so the engine's value
 * replaces that attribute rather than multiplying it.
 */
const TIMED_OPACITY = new Set(['night-veil', 'night-halos', 'night-cores', 'night-panes', 'night-shine', 'night-sky', 'cloud'])
/** Groups whose only change is how strongly they show (by the time of day): painted into cells like still painting. */
const ALPHA = new Set(['night-halos', 'night-panes', 'night-shine', 'night-sky', 'night-cores', 'fireworks'])
/** Groups that are only there at some times. */
const WHEN: Record<string, When> = { ufo: LAYERS.ufo.when, 'dawn-whale': LAYERS.dawnWhale.when, 'night-dim': LAYERS.nightDim.when, fireworks: LAYERS.fireworks.when }

export function build(island: { layers: { kind: string; slug?: string; body: string }[]; css: string; viewBox: [number, number, number, number] }): Built {
  const warnings: string[] = []
  const warn = (s: string) => { if (!warnings.includes(s)) warnings.push(s) }
  const [vx, vy, vw, vh] = island.viewBox
  const keyframes = parseKeyframes(KEYFRAMES + island.css)
  const beamOrg = island.css.match(/\.isl-layer--beam\{transform-origin:([-\d.]+)px ([-\d.]+)px\}/)

  /* ---- the layers, as trees ---- */
  const layers: El[] = island.layers.map((l) => {
    const root: El = { tag: 'g', attrs: { 'data-layer': l.kind, ...(l.slug ? { 'data-slug': l.slug } : {}) }, kids: parse(l.body) }
    for (const k of root.kids) if (typeof k !== 'string') k.parent = root
    return root
  })
  const defs = new Map<string, El>()
  for (const L of layers) for (const el of walk(L)) if (el.attrs.id) defs.set(el.attrs.id, el)

  /* ---- what a class says about an element ---- */
  const hasAncestorClass = (el: El, c: string) => { for (let p = el.parent; p; p = p.parent) if (classes(p).includes(c)) return true; return false }
  type Resolved = { loop?: Loop; fillBox?: boolean; origin?: string; base: NonNullable<Rule['base']>; when?: When }
  const resolved = new Map<El, Resolved>()
  const rulesOf = (el: El): Resolved => {
    const hit = resolved.get(el)
    if (hit) return hit
    const cs = classes(el)
    const r: Resolved = { base: {} }
    for (const rule of RULES) {
      if (!rule.on.every((c) => cs.includes(c))) continue
      if (rule.inside && !hasAncestorClass(el, rule.inside)) continue
      if (rule.loop) r.loop = rule.loop
      if (rule.fillBox !== undefined) r.fillBox = rule.fillBox
      if (rule.origin) r.origin = rule.origin
      if (rule.base) r.base = { ...r.base, ...rule.base }
      if (rule.when) r.when = rule.when
    }
    for (const c of cs) if (WHEN[c]) r.when = WHEN[c]
    // Inline style beats a class rule, as in CSS: the shorthand replaces the
    // whole animation, a longhand only its own part.
    const st = styleOf(el)
    if (st.animation) r.loop = shorthand(st.animation)
    if (r.loop && st['animation-delay']) r.loop = { ...r.loop, delay: secs(st['animation-delay']) }
    if (r.loop && st['animation-duration']) r.loop = { ...r.loop, dur: secs(st['animation-duration']) }
    if (st['transform-origin']) { r.origin = st['transform-origin']; r.fillBox = false }
    resolved.set(el, r)
    return r
  }

  const layerOf = (el: El): El => { let p: El = el; while (p.parent) p = p.parent; return p }
  type Kind = 'skip' | 'static' | 'dyn' | 'alpha'
  const kinds = new Map<El, Kind>()
  const kindOf = (el: El): Kind => {
    const hit = kinds.get(el)
    if (hit) return hit
    let k: Kind = 'static'
    const cs = classes(el), lay = el.attrs['data-layer']
    if (SILENT.has(el.tag)) k = 'skip'
    else if (lay === 'surf' || lay === 'night') k = 'alpha'
    else if (lay === 'beam' || lay === 'weather') k = 'dyn'
    else if (el.tag === 'text') k = 'dyn'
    else if (el.attrs['data-poke'] || cs.includes('lm') || cs.some((c) => DRIVEN.has(c))) k = 'dyn'
    else if (rulesOf(el).loop) k = 'dyn'
    else if (cs.some((c) => ALPHA.has(c)) || rulesOf(el).when) k = 'alpha'
    kinds.set(el, k)
    return k
  }
  const moving = new Map<El, boolean>()
  const hasDyn = (el: El): boolean => {
    const hit = moving.get(el)
    if (hit !== undefined) return hit
    const k = kindOf(el)
    const v = k === 'dyn' || k === 'alpha' || el.kids.some((c) => typeof c !== 'string' && hasDyn(c))
    moving.set(el, v)
    return v
  }

  /* ---- boxes: what the browser would call each element's fill-box ---- */
  const docOf = (body: string, refs: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${vw} ${vh}" width="${vw}" height="${vh}">${refs ? `<defs>${refs}</defs>` : ''}${body}</svg>`
  const fbCache = new Map<El, Box | null>()
  /** The element's geometry, in its own user space (its own transform not applied). */
  const fillBox = (el: El): Box | null => {
    if (fbCache.has(el)) return fbCache.get(el)!
    const own = { ...el, attrs: { ...el.attrs } }
    delete own.attrs.transform
    const body = write(own, (e) => ({ ...e.attrs, opacity: '1', 'fill-opacity': '1', 'stroke-opacity': '1', visibility: 'visible', ...(e.attrs.fill === 'transparent' || e.attrs.fill === 'none' ? { fill: '#000' } : {}) }))
    let box: Box | null = null
    try {
      const b = new Resvg(docOf(body, refsFor([own])), { font: { loadSystemFonts: false } }).getBBox()
      if (b && b.width >= 0 && Number.isFinite(b.x)) box = [b.x, b.y, b.x + b.width, b.y + b.height]
    } catch (e) { warn(`no box for <${el.tag} class="${el.attrs.class ?? ''}">: ${(e as Error).message}`) }
    fbCache.set(el, box)
    return box
  }

  /** Definitions an element (and everything in it) refers to, written out. */
  function refsFor(els: El[]): string {
    const need = new Set<string>()
    const look = (e: El) => {
      for (const v of Object.values(e.attrs)) for (const m of v.matchAll(/url\(#([^)]+)\)/g)) need.add(m[1])
      const h = e.attrs.href ?? e.attrs['xlink:href']
      if (h?.startsWith('#')) need.add(h.slice(1))
      for (const k of e.kids) if (typeof k !== 'string') look(k)
    }
    els.forEach(look)
    const done = new Set<string>()
    let out = ''
    const add = (id: string) => {
      if (done.has(id)) return
      done.add(id)
      const d = defs.get(id)
      if (!d) { warn(`#${id} is referred to but not defined`); return }
      look(d)
      for (const k of [...need]) if (!done.has(k)) add(k)
      // A definition outside <defs> (a drawn path that a <use> repeats) goes in as a definition too.
      out += write(d, (e) => { const a = { ...e.attrs }; if (e !== d) delete a.id; return a })
    }
    for (const id of [...need]) add(id)
    return out
  }

  /* ---- animations, resolved for one element ---- */
  const animFor = (el: El, loop: Loop, r: Resolved, extraRef?: [number, number]): Anim => {
    const kf = keyframes[loop.kf]
    if (!kf) throw new Error(`no keyframes called ${loop.kf}`)
    const fb = r.fillBox || /%/.test(r.origin ?? '') ? fillBox(el) : null
    const org = originOf(r.origin, r.fillBox ? fb : null, el)
    const ref: [number, number] = extraRef ?? (r.fillBox && fb ? [fb[2] - fb[0], fb[3] - fb[1]] : [vw, vh])
    // An element with its own transform attribute is moved by CSS instead of
    // by that attribute, while the animation plays. Keyframes that leave out
    // a stop would ease from the attribute, which the engine does not do.
    if (el.attrs.transform && touches(kf).has('tf') && !(kf.some((s) => s.at === 0 && s.tf !== undefined) && kf.some((s) => s.at === 1 && s.tf !== undefined)))
      warn(`<${el.tag} class="${el.attrs.class}"> has a transform attribute and ${loop.kf} leaves out a stop`)
    return { kf: loop.kf, dur: loop.dur, delay: loop.delay ?? 0, ease: loop.ease ?? 'ease', iter: loop.iter ?? Infinity, dir: ['normal', 'reverse', 'alternate', 'alternate-reverse'].indexOf(loop.dir ?? 'normal'), fill: ['none', 'forwards', 'backwards', 'both'].indexOf(loop.fill ?? 'none'), org, ref }
  }
  function originOf(src: string | undefined, fb: Box | null, el: El): [number, number] {
    if (!src) return [0, 0]
    const parts = src.trim().split(/\s+/)
    const w = fb ? fb[2] - fb[0] : vw, h = fb ? fb[3] - fb[1] : vh, ox = fb ? fb[0] : 0, oy = fb ? fb[1] : 0
    const one = (v: string, size: number, axis: 'x' | 'y'): number => {
      if (v === 'center') return size / 2
      if (v === 'left' || v === 'top') return 0
      if (v === 'right' || v === 'bottom') return size
      if (v.endsWith('%')) return (Number(v.slice(0, -1)) / 100) * size
      const n = Number(v.replace(/px$/, ''))
      if (!Number.isFinite(n)) throw new Error(`transform-origin not understood: ${src} on ${el.attrs.class}`)
      void axis
      return n
    }
    const xs = parts[0] ?? 'center', ys = parts[1] ?? (parts[0] === 'center' ? 'center' : 'center')
    if (!fb && (xs.endsWith('%') || ys.endsWith('%'))) warn(`a percentage origin without a box on ${el.attrs.class}`)
    return [(fb ? ox : 0) + one(xs, w, 'x'), (fb ? oy : 0) + one(ys, h, 'y')]
  }

  /* ---- styles, for the shapes drawn from their outlines ---- */
  const inheritFrom = (chain: El[], start: Record<string, string>) => {
    const out = { ...start }
    for (const e of chain) for (const k of INHERITED) if (e.attrs[k] !== undefined) out[k] = e.attrs[k]
    return out
  }
  const baseAttr = (el: El, k: string): string | undefined => {
    const st = styleOf(el), r = rulesOf(el).base
    if (st[k] !== undefined) return st[k]
    if (k === 'opacity' && r.opacity !== undefined) return String(r.opacity)
    if (k === 'stroke-dasharray' && r.dash) return r.dash
    if (k === 'fill' && r.fill) return r.fill
    return el.attrs[k]
  }
  const solid = (v: string | undefined) => v === undefined || v === 'none' || v === 'transparent' || /^#[0-9a-f]{3,8}$/i.test(v) || /^(white|black|currentColor)$/.test(v)
  /** An element's own opacity, unless the time of day sets it (TIMED_OPACITY). */
  const ownOpacity = (el: El) => (classes(el).some((c) => TIMED_OPACITY.has(c)) ? undefined : baseAttr(el, 'opacity'))
  /** Whether the engine can draw this element by itself, from its outline. */
  const vectorable = (el: El, inh: Record<string, string>) => {
    if (!SHAPES.has(el.tag) || el.kids.length) return false
    if (el.attrs['clip-path'] || el.attrs.mask || el.attrs.filter) return false
    const fill = baseAttr(el, 'fill') ?? inh.fill, stroke = baseAttr(el, 'stroke') ?? inh.stroke
    return solid(fill) && solid(stroke)
  }
  const styleFor = (el: El, inh: Record<string, string>): Style => {
    const g = (k: string) => baseAttr(el, k) ?? inh[k]
    const col = (v: string | undefined, dflt: string | null): string | null => (v === undefined ? dflt : v === 'none' || v === 'transparent' ? null : v === 'white' ? '#ffffff' : v === 'black' ? '#000000' : v)
    const st: Style = { f: col(g('fill'), '#000000'), s: col(g('stroke'), null) }
    const n = (k: string) => { const v = g(k); return v === undefined ? undefined : Number(v) }
    if (st.s) {
      st.w = n('stroke-width') ?? 1
      const cap = g('stroke-linecap'), join = g('stroke-linejoin')
      if (cap && cap !== 'butt') st.cap = cap as CanvasLineCap
      st.join = (join ?? 'miter') as CanvasLineJoin
      const dash = g('stroke-dasharray')
      if (dash && dash !== 'none') st.dash = dash.split(/[\s,]+/).map(Number)
      const doff = n('stroke-dashoffset'); if (doff) st.doff = doff
      const so = n('stroke-opacity'); if (so !== undefined && so !== 1) st.so = so
    }
    const fo = n('fill-opacity'); if (fo !== undefined && fo !== 1) st.fo = fo
    const op = ownOpacity(el); if (op !== undefined && Number(op) !== 1) st.op = Number(op)
    if (g('fill-rule') === 'evenodd') st.rule = 'evenodd'
    return st
  }

  /* ---- the walk ---- */
  const runs: Run[] = []
  const sprites: Built['sprites'] = []
  const masks: Built['masks'] = []
  type Ctx = { cell: boolean; night: boolean; m: M; chain: El[]; out: Node[]; run: Run | null; ctx: number; inherit: Record<string, string>; top: (Node & { k: 'g' }) | null }
  let ctxSeq = 0

  const openRun = (c: Ctx): Run => {
    if (c.run) return c.run
    const run: Run = { id: runs.length, cell: c.cell, night: c.night, items: [], ctx: c.ctx, inherit: c.inherit }
    runs.push(run)
    c.run = run
    c.out.push({ k: c.cell ? 'run' : 'spr', id: run.id })
    return run
  }
  const closeRun = (c: Ctx) => {
    const run = c.run
    c.run = null
    if (!run || run.cell) return
    sprites.push({ run, top: c.top!, scale: 1 })
  }

  const matOf = (chain: El[]) => chain.reduce((m, e) => (e.attrs.transform ? mul(m, parseSvgTransform(e.attrs.transform)) : m), [...ID] as M)

  function vectorNode(el: El, chain: El[], inh: Record<string, string>): Node {
    const r = rulesOf(el)
    const st = styleFor(el, inh)
    const node: Node & { k: 'v' } = { k: 'v', d: pathData(el), st, bb: [0, 0, 0, 0] }
    const m = matOf(chain)
    if (m.some((v, i) => v !== ID[i])) node.m = m
    if (el.attrs.transform) node.base = parseSvgTransform(el.attrs.transform)
    if (r.loop) node.a = [animFor(el, r.loop, r)]
    if (r.when) node.when = r.when
    const tags = classes(el).filter((x) => DRIVEN.has(x))
    if (tags.length) node.tags = tags
    const data = Object.fromEntries(Object.entries(el.attrs).filter(([k]) => k.startsWith('data-') && k !== 'data-l' && k !== 'data-la' && k !== 'data-b').map(([k, v]) => [k.slice(5), v]))
    if (Object.keys(data).length) node.data = data
    if (el.tag === 'rect') node.data = { ...(node.data ?? {}), x: el.attrs.x ?? '0', y: el.attrs.y ?? '0', width: el.attrs.width ?? '0', height: el.attrs.height ?? '0', rx: el.attrs.rx ?? el.attrs.ry ?? '0' }
    const fb = fillBox(el)
    if (fb) { node.fb = fb; node.bb = grow(fb, (st.s ? (st.w ?? 1) / 2 : 0) + 1) }
    return node
  }

  function textNode(el: El, c: Ctx): Node {
    const inh = inheritFrom(c.chain, c.inherit)
    const g = (k: string) => baseAttr(el, k) ?? inheritFrom([el], inh)[k]
    const size = Number(g('font-size') ?? 12), weight = g('font-weight') ?? '400', fam = g('font-family') ?? 'Fredoka, system-ui, sans-serif'
    const fill = g('fill'), stroke = g('stroke')
    const s = el.kids.map((k) => (typeof k === 'string' ? k : '')).join('')
    const anchor = ({ middle: 'center', end: 'right', start: 'left' } as Record<string, CanvasTextAlign>)[g('text-anchor') ?? 'start'] ?? 'left'
    const node: Node & { k: 'txt' } = {
      k: 'txt', s, x: Number(el.attrs.x ?? 0), y: Number(el.attrs.y ?? 0), font: `${weight} ${size}px ${fam}`,
      fill: fill === 'none' ? null : fill === undefined ? '#000000' : fill, anchor, bl: g('dominant-baseline') === 'middle' ? 'middle' : 'alphabetic', bb: [0, 0, 0, 0],
    }
    if (stroke && stroke !== 'none') { node.stroke = stroke; node.sw = Number(g('stroke-width') ?? 1) }
    const op = baseAttr(el, 'opacity'); if (op !== undefined && Number(op) !== 1) node.op = Number(op)
    const ls = g('letter-spacing'); if (ls) node.ls = Number(ls)
    const m = mul(matOf(c.chain), el.attrs.transform ? parseSvgTransform(el.attrs.transform) : ID)
    if (m.some((v, i) => v !== ID[i])) node.m = m
    const r = rulesOf(el)
    if (r.loop) node.a = [animFor(el, r.loop, r)]
    const tags = classes(el).filter((x) => DRIVEN.has(x)); if (tags.length) node.tags = tags
    // A rough box, for culling: the browser's own text box is not known here.
    const w = s.length * size * 0.75 + (node.ls ?? 0) * s.length, x0 = anchor === 'center' ? node.x - w / 2 : anchor === 'right' ? node.x - w : node.x
    const y0 = node.bl === 'middle' ? node.y - size * 0.6 : node.y - size, y1 = node.bl === 'middle' ? node.y + size * 0.6 : node.y + size * 0.3
    node.bb = grow([x0, y0, x0 + w, y1], (node.sw ?? 0) + 1)
    return node
  }

  function visit(el: El, c: Ctx) {
    const k = kindOf(el)
    if (k === 'skip') return
    if (el.tag === 'rect' && el.attrs.fill === 'url(#isl-sea)') { closeRun(c); c.out.push(seaNode(el)); return }
    if (k === 'static' && !hasDyn(el)) { openRun(c).items.push({ el, chain: c.chain }); return }
    if (k === 'static') {
      // A still wrapper round something that moves. A clip or an opacity on it
      // must reach what moves inside, so such a wrapper is kept as a group.
      const clip = el.attrs['clip-path'], op = el.attrs.opacity
      if (clip || (op !== undefined && Number(op) !== 1) || el.attrs.mask || el.attrs.filter) {
        if (el.attrs.mask || el.attrs.filter) warn(`a mask or filter round something that moves (${el.attrs.class ?? el.tag}) is not carried over`)
        closeRun(c)
        const node: Node & { k: 'g' } = { k: 'g', kids: [] }
        const m = mul(matOf(c.chain), el.attrs.transform ? parseSvgTransform(el.attrs.transform) : ID)
        if (m.some((v, i) => v !== ID[i])) node.m = m
        if (op !== undefined) node.op = Number(op)
        if (clip) node.clip = clipPathData(clip)
        c.out.push(node)
        const inner: Ctx = { ...c, cell: false, m: [...ID] as M, chain: [], out: node.kids, run: null, ctx: ++ctxSeq, inherit: inheritFrom([...c.chain, el], c.inherit), top: c.top ?? node }
        for (const kid of el.kids) if (typeof kid !== 'string') visit(kid, inner)
        closeRun(inner)
        return
      }
      const inner: Ctx = { ...c, chain: [...c.chain, el] }
      for (const kid of el.kids) if (typeof kid !== 'string') visit(kid, inner)
      c.run = inner.run
      return
    }
    if (k === 'alpha' && c.cell) {
      closeRun(c)
      const node = groupNode(el, c, true)
      c.out.push(node)
      const leaf = !el.kids.some((k) => typeof k !== 'string')
      const inner: Ctx = { ...c, night: c.night || el.attrs['data-layer'] === 'night', out: node.kids, run: null, ctx: ++ctxSeq, chain: leaf ? c.chain : [...c.chain, stripped(el)] }
      if (leaf) openRun(inner).items.push({ el: stripped(el), chain: c.chain })
      else for (const kid of el.kids) if (typeof kid !== 'string') visit(kid, inner)
      closeRun(inner)
      return
    }
    // Something that moves.
    closeRun(c)
    if (el.tag === 'text') { c.out.push(textNode(el, c)); return }
    const inh = inheritFrom(c.chain, c.inherit)
    if (vectorable(el, inh) && !el.attrs['data-poke'] && !classes(el).includes('lm') && outlined(el)) {
      c.out.push(vectorNode(el, c.chain, inh))
      return
    }
    const node = groupNode(el, c, false)
    c.out.push(node)
    const inner: Ctx = { cell: false, night: c.night, m: [...ID] as M, chain: [], out: node.kids, run: null, ctx: ++ctxSeq, inherit: inheritFrom([el], inh), top: c.top ?? node }
    if (SHAPES.has(el.tag) || el.tag === 'use') {
      // A single shape that cannot be drawn from its outline (a gradient
      // fill, a <use>): a sprite of itself, inside its moving group.
      const self = stripped(el)
      openRun(inner).items.push({ el: self, chain: [] })
    } else for (const kid of el.kids) if (typeof kid !== 'string') visit(kid, inner)
    closeRun(inner)
    if (node.lm || node.poke) masks.push({ key: node.lm ? `lm:${node.lm}` : `pk:${masks.filter((x) => x.key.startsWith('pk:')).length}:${node.poke}`, el, inherit: inh })
    if (node.poke) node.data = { ...(node.data ?? {}), mask: masks[masks.length - 1].key }
  }

  /** Whether the engine must draw a moving shape from its outline: it changes the shape's paint (see OUTLINED). */
  function outlined(el: El): boolean {
    if (classes(el).some((x) => OUTLINED.has(x))) return true
    const r = rulesOf(el)
    return !!r.loop && (keyframes[r.loop.kf] ?? []).some((st) => st.fill !== undefined || st.doff !== undefined)
  }

  /** An element with what the engine now does for it taken off: its transform, opacity and visibility (its class's own paint kept). */
  function stripped(el: El): El {
    const a = { ...el.attrs }
    const rb = rulesOf(el).base
    if (rb.fill) a.fill = rb.fill
    if (rb.dash) a['stroke-dasharray'] = rb.dash
    delete a.transform; delete a.opacity; delete a.visibility; delete a.class
    const st = styleOf(el)
    const keep = Object.entries(st).filter(([k]) => !k.startsWith('animation') && k !== 'transform-origin' && !k.startsWith('--'))
    if (keep.length) a.style = keep.map(([k, v]) => `${k}:${v}`).join(';'); else delete a.style
    const out: El = { tag: el.tag, attrs: a, kids: el.kids, parent: el.parent }
    return out
  }

  function groupNode(el: El, c: Ctx, alpha: boolean): Node & { k: 'g' } {
    const r = rulesOf(el), cs = classes(el), lay = el.attrs['data-layer']
    const node: Node & { k: 'g' } = { k: 'g', kids: [] }
    const m = matOf(c.chain)
    if (!alpha && m.some((v, i) => v !== ID[i])) node.m = m
    if (!alpha && el.attrs.transform) node.base = parseSvgTransform(el.attrs.transform)
    if (alpha && el.attrs.transform) warn(`an alpha group with a transform: ${el.attrs.class}`)
    const op = ownOpacity(el)
    if (op !== undefined && Number(op) !== 1) node.op = Number(op)
    if (el.attrs['clip-path']) node.clip = clipPathData(el.attrs['clip-path'])
    const tags = cs.filter((x) => DRIVEN.has(x) || ALPHA.has(x))
    if (lay) tags.push(`layer-${lay}${el.attrs['data-slug'] ? `-${el.attrs['data-slug']}` : ''}`)
    if (tags.length) node.tags = tags
    if (r.when) node.when = r.when
    if (cs.includes('lm')) { node.lm = el.attrs['data-slug']; node.data = { d: (styleOf(el)['--d'] ?? '0ms').replace('ms', '') } }
    if (el.attrs['data-poke']) {
      node.poke = el.attrs['data-poke']
      const fb = fillBox(el)
      if (fb) node.pokeOrg = [fb[0] + (fb[2] - fb[0]) / 2, fb[3]]
    }
    // Layer-wide motions.
    if (lay === 'surf') { const L2 = el.attrs['data-slug'] === 'in' ? LAYERS.surfIn : LAYERS.surfOut; node.op = L2.opacity; node.a = [animFor(el, L2.loop, { base: {} })] }
    else if (lay === 'night') { node.when = { time: ['dawn', 'dusk', 'night'] } }
    else if (lay === 'beam') {
      node.when = LAYERS.beam.when
      const o: [number, number] = beamOrg ? [vx + Number(beamOrg[1]), vy + Number(beamOrg[2])] : [0, 0]
      node.a = [{ ...animFor(el, LAYERS.beam.loop, { base: {} }), org: o }]
    } else if (lay === 'weather') {
      const W = el.attrs['data-slug'] === 'petals' ? LAYERS.petals : LAYERS.snow
      node.when = W.when
      node.a = [animFor(el, W.loop, { base: {} }, [vw, vh])]
    } else if (r.loop) node.a = [animFor(el, r.loop, r)]
    const fb = !alpha ? fillBox(el) : null
    if (fb) node.fb = fb
    return node
  }

  function seaNode(el: El): Node {
    const g = defs.get('isl-sea')!
    const tf = g.attrs.gradientTransform ?? ''
    const sy = Number(tf.match(/scale\(1 ([\d.]+)\)/)?.[1] ?? 1)
    const stops = g.kids.filter((k): k is El => typeof k !== 'string').map((k) => [Number(k.attrs.offset), k.attrs['stop-color']] as [number, string])
    const x = Number(el.attrs.x), y = Number(el.attrs.y)
    return { k: 'sea', cx: Number(g.attrs.cx), cy: Number(g.attrs.cy), r: Number(g.attrs.r), sy, stops, rect: [x, y, x + Number(el.attrs.width), y + Number(el.attrs.height)] }
  }

  function clipPathData(ref: string): string {
    const id = ref.match(/url\(#([^)]+)\)/)?.[1]
    const cp = id ? defs.get(id) : undefined
    if (!cp) { warn(`clip ${ref} not found`); return '' }
    return cp.kids.filter((k): k is El => typeof k !== 'string').map((k) => pathData(k)).join('')
  }

  const root: Node[] = []
  for (const L of layers) {
    const c: Ctx = { cell: true, night: L.attrs['data-layer'] === 'night', m: [...ID] as M, chain: [], out: root, run: null, ctx: ++ctxSeq, inherit: {}, top: null }
    const k = kindOf(L)
    if (k === 'static') {
      // A layer is a group of its own: a still layer's painting continues the
      // one below it (the same context), so cells can merge across them.
      c.ctx = 1
      const inner: Ctx = { ...c, chain: [L] }
      for (const kid of L.kids) if (typeof kid !== 'string') visit(kid, inner)
      closeRun(inner)
      // The next still layer starts a new run: what lies between is decided per cell.
    } else visit(L, c)
    closeRun(c)
  }

  /* ---- what the cards under the map draw: each building's own art ---- */
  const cards: Record<string, string> = {}
  for (const L of layers) for (const el of walk(L)) if (classes(el).includes('lm-art') && el.attrs.id?.startsWith('lm-')) {
    cards[el.attrs.id.slice(3)] = el.kids.map((k) => write(k, (e) => { const a = { ...e.attrs }; delete a.id; delete a['data-l']; delete a['data-la']; delete a['data-b']; return a })).join('')
  }

  const pokes = [...new Set(masks.filter((m) => m.key.startsWith('pk:')).map((m) => m.key.split(':')[2]))]
  // A sprite is painted in its own group's units, which its groups may scale
  // far up or down (the trolley's cart is drawn a thirty-second the size and
  // scaled back up): it must be painted at the size it is seen.
  const scaleOf = new Map<number, number>()
  const measure = (n: Node, m: M) => {
    if (n.k === 'spr') { scaleOf.set(n.id, Math.max(Math.hypot(m[0], m[1]), Math.hypot(m[2], m[3]))); return }
    if (n.k !== 'g') return
    let mm = n.m ? mul(m, n.m) : m
    if (n.base) mm = mul(mm, n.base)
    for (const k of n.kids) measure(k, mm)
  }
  for (const n of root) measure(n, ID)
  for (const sp of sprites) sp.scale = scaleOf.get(sp.run.id) ?? 1

  return { root, runs, keyframes, sprites, masks, defs, pokes, cards, warnings }

  /* ---- helpers needing the closure ---- */
}

/* ---- small things ---- */

export const grow = (b: Box, d: number): Box => [b[0] - d, b[1] - d, b[2] + d, b[3] + d]
export const union = (a: Box | null, b: Box | null): Box | null => (!a ? b : !b ? a : [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])])
export function xform(m: M, b: Box): Box {
  const pts = [apply(m, b[0], b[1]), apply(m, b[2], b[1]), apply(m, b[0], b[3]), apply(m, b[2], b[3])]
  return [Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))]
}

const secs = (s: string) => (s.endsWith('ms') ? Number(s.slice(0, -2)) / 1000 : Number(s.replace(/s$/, '')))
/** The animation shorthand, as the island writes it. */
function shorthand(s: string): Loop {
  const toks = s.match(/cubic-bezier\([^)]*\)|steps\([^)]*\)|\S+/g) ?? []
  const loop: Loop = { kf: '', dur: 0 }
  let times = 0
  for (const t of toks) {
    if (/^-?[\d.]+m?s$/.test(t)) { if (times++ === 0) loop.dur = secs(t); else loop.delay = secs(t) }
    else if (/^(linear|ease|ease-in|ease-out|ease-in-out|step-start|step-end)$/.test(t) || t.startsWith('cubic-bezier') || t.startsWith('steps')) loop.ease = t
    else if (t === 'infinite') loop.iter = Infinity
    else if (/^[\d.]+$/.test(t)) loop.iter = Number(t)
    else if (/^(normal|reverse|alternate|alternate-reverse)$/.test(t)) loop.dir = t as Loop['dir']
    else if (/^(none|forwards|backwards|both)$/.test(t)) loop.fill = t as Loop['fill']
    else loop.kf = t
  }
  if (!loop.kf) throw new Error(`animation shorthand without a name: ${s}`)
  return loop
}

/** Any shape, as path data. */
export function pathData(el: El): string {
  const n = (k: string) => Number(el.attrs[k] ?? 0)
  switch (el.tag) {
    case 'path': return el.attrs.d ?? ''
    case 'circle': { const cx = n('cx'), cy = n('cy'), r = n('r'); return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z` }
    case 'ellipse': { const cx = n('cx'), cy = n('cy'), rx = n('rx'), ry = n('ry'); return `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0Z` }
    case 'rect': {
      const x = n('x'), y = n('y'), w = n('width'), h = n('height')
      let rx = el.attrs.rx !== undefined ? n('rx') : el.attrs.ry !== undefined ? n('ry') : 0, ry = el.attrs.ry !== undefined ? n('ry') : rx
      rx = Math.min(rx, w / 2); ry = Math.min(ry, h / 2)
      if (!rx || !ry) return `M${x} ${y}h${w}v${h}h${-w}Z`
      return `M${x + rx} ${y}h${w - 2 * rx}a${rx} ${ry} 0 0 1 ${rx} ${ry}v${h - 2 * ry}a${rx} ${ry} 0 0 1 ${-rx} ${ry}h${-(w - 2 * rx)}a${rx} ${ry} 0 0 1 ${-rx} ${-ry}v${-(h - 2 * ry)}a${rx} ${ry} 0 0 1 ${rx} ${-ry}Z`
    }
    case 'line': return `M${n('x1')} ${n('y1')}L${n('x2')} ${n('y2')}`
    case 'polygon': case 'polyline': {
      const pts = (el.attrs.points ?? '').trim().split(/[\s,]+/).map(Number)
      let d = ''
      for (let i = 0; i + 1 < pts.length; i += 2) d += `${i ? 'L' : 'M'}${pts[i]} ${pts[i + 1]}`
      return d + (el.tag === 'polygon' ? 'Z' : '')
    }
  }
  return ''
}

/**
 * Every moving node's reach in the world: its box in every pose of every
 * animation it and its contents play (a poke's too, and a building's lift
 * and drop), as far up as the node the engine culls by. Needs the sprites'
 * boxes, which only painting them measures (draw.ts).
 */
export function computeReach(root: Node[], keyframes: Record<string, Keyframes>, spriteBox: (id: number) => Box | null) {
  const poses = (n: { a?: Anim[]; base?: M; poke?: string; pokeOrg?: [number, number]; tags?: string[] }): M[] => {
    const out: M[] = [n.base ?? ([...ID] as M)]
    const add = (kfName: string, ez: string, ref: [number, number], org: [number, number], steps = 48) => {
      const kf = keyframes[kfName]
      const at = new Set<number>(kf.map((s) => s.at))
      for (let i = 0; i <= steps; i++) at.add(i / steps)
      for (const p of at) out.push(fnsMatrix(sampleProp(kf, 'tf', p, ease(ez), null) as never, ref, org))
    }
    for (const a of n.a ?? []) add(a.kf, a.ease, a.ref, a.org)
    const pk = n.poke ? POKES[n.poke] : undefined
    if (pk?.self) add(pk.self.kf, pk.self.ease ?? 'ease', [0, 0], n.pokeOrg ?? [0, 0], 32)
    if (n.tags?.includes('pk-say')) add(POKE_SAY.kf, POKE_SAY.ease ?? 'ease', [0, 0], [0, 0], 8)
    if (n.tags?.includes('lm-art')) { out.push([1, 0, 0, 1, 0, -LANDMARK.lift - 4]); out.push([1, 0, 0, 0.6, 0, -60]) }
    return out
  }
  // A node's reach in its parent's coordinates, worked out once from its
  // contents' reach and its own poses, and stored only when all are known
  // (each shape's own box is what its reach is worked out from).
  const memo = new Map<Node, Box | null>()
  const reach = (n: Node): Box | null => {
    if (memo.has(n)) return memo.get(n)!
    let out: Box | null = null
    if (n.k === 'spr') out = spriteBox(n.id)
    else if (n.k === 'g' || n.k === 'v' || n.k === 'txt') {
      let local: Box | null = null
      if (n.k === 'g') {
        for (const kid of n.kids) local = union(local, reach(kid))
        // Inner poke reactions (a kite looping, a fountain's jet) reach further than the kid's own poses.
        if (n.poke && local) local = grow(local, 30)
      } else local = n.bb ?? null
      if (local) {
        const own = n.m ?? ID
        for (const p of poses(n as never)) out = union(out, xform(mul(own, p), local))
      }
    }
    memo.set(n, out)
    return out
  }
  const all: Node[] = []
  const collect = (n: Node) => { all.push(n); if (n.k === 'g') n.kids.forEach(collect) }
  root.forEach(collect)
  for (const n of all) reach(n)
  for (const n of all) if (n.k === 'g' || n.k === 'v' || n.k === 'txt') { const r = memo.get(n); if (r) n.bb = r; else delete n.bb }
}
