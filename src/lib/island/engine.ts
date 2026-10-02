/**
 * Tiny Island — the engine: the baked island (scene.ts), drawn on one canvas.
 *
 * Every frame it paints the island back to front: the open sea, then each
 * still run from the cells of the right level (the nearest coarser cell
 * standing in, cut to size, while a sharper one loads), and in between, in
 * their places in the painting order, everything that moves: sprites, plain
 * shapes from their outlines, lettering in the page's own fonts, all posed
 * by their keyframes at this moment. Nothing of the map is in the page as
 * elements, so moving the camera costs the browser one canvas, whatever is
 * on the island.
 *
 * The page drives it: where the camera is (setView), what time of day it is
 * (the state callback), which building is picked, which are dimmed, what was
 * poked. It answers what is under a point (hit).
 */
import type { Anim, Box, LevelIndex, M, Node, Scene, Style, When } from './scene'
import { ID, mulTo, invert, fnsMatrix, progress, sampleProp, ease, type Ease } from './anim'
import { POKES, POKE_SAY, POKE_MS, POKE_INNER_ORIGIN, LANDMARK, LAYERS, type Loop } from './moves'

type G = Node & { k: 'g' }
type V = Node & { k: 'v' }
type T = Node & { k: 'txt' }
type Cam = { x: number; y: number; z: number }
export type IslandState = { time: string; season: string; hour: number; near: boolean }
export type Hit = { lm?: string; poke?: { kind: string; node: object } } | null

/** Per-node bookkeeping the engine keeps beside the scene's own nodes. */
type Live = {
  path?: Path2D
  clip?: Path2D
  eases?: Ease[]
  /** The matrix it was last drawn with, for hit tests (pokes and buildings). */
  drawn?: M
  frame?: number
  pokedAt?: number
  /** A reaction played on it, and when it began. */
  over?: { a: Anim; at: number }
  speed?: { k: number; until: number }
  hasRun?: boolean
  text?: string
  fill?: string
}

const near = (a: number, b: number) => Math.abs(a - b) < 1e-6
const toAnim = (l: Loop, org: [number, number], ref: [number, number] = [0, 0]): Anim => ({ kf: l.kf, dur: l.dur, delay: l.delay ?? 0, ease: l.ease ?? 'ease', iter: l.iter ?? Infinity, dir: ['normal', 'reverse', 'alternate', 'alternate-reverse'].indexOf(l.dir ?? 'normal'), fill: ['none', 'forwards', 'backwards', 'both'].indexOf(l.fill ?? 'none'), org, ref })
const fbOrigin = (fb: Box | undefined, spec: string): [number, number] => {
  if (!fb) return [0, 0]
  const [xs, ys = xs] = spec === 'center' ? ['50%', '50%'] : spec.split(/\s+/)
  const one = (v: string, a: number, b: number) => (v.endsWith('%') ? a + ((b - a) * Number(v.slice(0, -1))) / 100 : a + Number(v))
  return [one(xs, fb[0], fb[2]), one(ys, fb[1], fb[3])]
}

export function createEngine(o: {
  canvas: HTMLCanvasElement
  /** Where the baked files are, ending in a slash. */
  base: string
  scene: Scene
  /** Whether things move at all (reduced motion says no). */
  play: boolean
  state: () => IslandState
}) {
  const { canvas, base, scene } = o
  const ctx = canvas.getContext('2d', { alpha: true })!
  const live = new WeakMap<object, Live>()
  const L = (n: object): Live => live.get(n) ?? live.set(n, {}).get(n)!
  const KF = scene.keyframes
  const t0 = performance.now()
  let now = t0, frameNo = 0

  /* ---- loading: level indexes, cell images, sprite sheets ---- */
  type Img = { bm: ImageBitmap | null; p: Promise<void> | null; failed?: boolean; used: number; bytes: number }
  const imgs = new Map<string, Img>()
  let inflight = 0
  const queue: { url: string; pri: number }[] = []
  const MAX_FLIGHT = 6
  let budget = 0
  const BUDGET = (navigator as { deviceMemory?: number }).deviceMemory && (navigator as { deviceMemory?: number }).deviceMemory! <= 4 ? 96e6 : 256e6
  let onLoaded: (() => void) | null = null
  const want = (url: string, pri: number): ImageBitmap | null => {
    let im = imgs.get(url)
    if (!im) { im = { bm: null, p: null, used: frameNo, bytes: 0 }; imgs.set(url, im) }
    im.used = frameNo
    if (im.bm || im.failed) return im.bm
    if (!im.p && !queue.some((q) => q.url === url)) queue.push({ url, pri })
    return null
  }
  const pump = () => {
    queue.sort((a, b) => a.pri - b.pri)
    while (inflight < MAX_FLIGHT && queue.length) {
      const { url } = queue.shift()!
      const im = imgs.get(url)!
      if (im.p || im.bm) continue
      inflight++
      im.p = fetch(base + url).then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status))))).then((b) => createImageBitmap(b)).then((bm) => {
        im.bm = bm; im.bytes = bm.width * bm.height * 4; budget += im.bytes
        onLoaded?.()
      }, () => { im.failed = true }).finally(() => { inflight--; im.p = null; pump() })
    }
  }
  /** Forget the pictures not drawn for a while once over budget (never the smallest level's). */
  const trim = () => {
    if (budget < BUDGET) return
    const old = [...imgs.entries()].filter(([u, im]) => im.bm && frameNo - im.used > 120 && !u.startsWith('c/0/') && !u.startsWith('s/0-')).sort((a, b) => a[1].used - b[1].used)
    for (const [u, im] of old) { if (budget < BUDGET * 0.8) break; im.bm!.close(); budget -= im.bytes; imgs.delete(u) }
  }

  type Frag = { img: string; sx: number; sy: number; w: number; h: number; dx: number; dy: number }
  /** Per level, once its index is in: for each cell (by number), its pieces by the run they are drawn at. */
  const levels: ({ cols: number; rows: number; day: Map<number, Map<number, Frag>>; night: Map<number, Map<number, Frag>> } | null)[] = scene.lv.map(() => null)
  const indexLoading = new Set<number>()
  const loadIndex = (li: number) => {
    if (levels[li] || indexLoading.has(li)) return
    indexLoading.add(li)
    fetch(base + scene.lv[li].index).then((r) => r.json()).then((ix: LevelIndex) => {
      const read = (src: Record<number, number[]>, night: boolean) => {
        const out = new Map<number, Map<number, Frag>>()
        for (const [k, arr] of Object.entries(src)) {
          const ci = Number(k), cx = ci % ix.cols, cy = Math.floor(ci / ix.cols)
          const m = new Map<number, Frag>()
          for (let i = 0; i < arr.length; i += 7) m.set(arr[i], { img: `c/${li}/${night ? 'n' : ''}${cx}_${cy}.webp`, sx: arr[i + 1], sy: arr[i + 2], w: arr[i + 3], h: arr[i + 4], dx: arr[i + 5], dy: arr[i + 6] })
          out.set(ci, m)
        }
        return out
      }
      levels[li] = { cols: ix.cols, rows: ix.rows, day: read(ix.day, false), night: read(ix.night, true) }
      onLoaded?.()
    }).catch(() => indexLoading.delete(li))
  }
  loadIndex(0)

  /* ---- prepared once: which groups hold still painting, landmark and poke nodes ---- */
  const lms = new Map<string, G>()
  const pokeNodes: G[] = []
  const tagged = new Map<string, Node[]>()
  const prep = (n: Node, inLm?: G): boolean => {
    if (n.k === 'run') return true
    if ('tags' in n && n.tags) for (const t of n.tags) (tagged.get(t) ?? tagged.set(t, []).get(t)!).push(n)
    if (n.k !== 'g') return false
    if (n.lm) { lms.set(n.lm, n); inLm = n }
    if (n.poke) pokeNodes.push(n)
    let has = false
    for (const k of n.kids) has = prep(k, inLm) || has
    L(n).hasRun = has
    return has
  }
  for (const n of scene.root) prep(n)
  const masks = new Map<string, { box: Box; res: number; w: number; h: number; bits: Uint8Array }>()
  const maskOf = (key: string) => {
    let m = masks.get(key)
    if (!m) {
      const src = scene.masks[key]; if (!src) return null
      const raw = atob(src.bits), bits = new Uint8Array(raw.length)
      for (let i = 0; i < raw.length; i++) bits[i] = raw.charCodeAt(i)
      m = { ...src, bits }; masks.set(key, m)
    }
    return m
  }

  /* ---- the page's controls ---- */
  const cam: Cam = { x: 0, y: 0, z: 1 }
  let W = 1, H = 1, dpr = 1
  let hot: string | null = null
  let keep: Set<string> | null = null
  const lmState = new Map<string, { lift: number; liftFrom: number; liftAt: number; liftTo: number; ring: number; dim: number; blinkAt: number }>()
  const lmS = (s: string) => lmState.get(s) ?? lmState.set(s, { lift: 0, liftFrom: 0, liftAt: 0, liftTo: 0, ring: 0, dim: 1, blinkAt: -1e9 }).get(s)!
  let introAt = -1
  const texts = new Map<string, string>()
  const fills = new Map<object, string>()
  const extra: Node[] = []

  /* ---- night, clouds and the like: values that ease when the time changes ---- */
  const tweens = new Map<string, { v: number; from: number; to: number; at: number; ms: number }>()
  const tween = (key: string, to: number, ms: number) => {
    let tw = tweens.get(key)
    if (!tw) { tw = { v: to, from: to, to, at: now, ms }; tweens.set(key, tw); return to }
    if (!near(tw.to, to)) { tw.from = tw.v; tw.to = to; tw.at = now; tw.ms = ms }
    const k = o.play ? Math.min(1, (now - tw.at) / tw.ms) : 1
    tw.v = tw.from + (tw.to - tw.from) * (k * k * (3 - 2 * k))
    return tw.v
  }
  let st: IslandState = o.state()
  const whenOk = (w: When | undefined) => !w || ((!w.time || w.time.includes(st.time)) && (!w.season || w.season.includes(st.season)) && (!w.hour || w.hour.includes(st.hour)))

  /* ---- posing a node at this moment ---- */
  const tNow = () => (o.play ? (now - t0) / 1000 : 0)
  const easeOf = (a: Anim) => ease(a.ease)
  /** Where an animation has a node now: its matrix (or null for "as built"), its opacity, fill, dash offset. */
  type Pose = { m: M | null; op: number | undefined; fill: string | undefined; doff: number | undefined }
  const pose = (n: { a?: Anim[]; base?: M; tags?: string[] }, t: number, out: Pose): Pose => {
    out.m = null; out.op = undefined; out.fill = undefined; out.doff = undefined
    const lv = L(n)
    let anims = n.a
    // A reaction (a poke) plays over the node's own loop while it lasts.
    if (lv.over) {
      const p = progress(lv.over.a, (now - lv.over.at) / 1000)
      if (p !== null) anims = [{ ...lv.over.a, delay: 0 }]
      else lv.over = undefined
      if (p !== null) return poseOne(lv.over!.a, (now - lv.over!.at) / 1000, n, out)
    }
    if (!anims?.length) return out
    // Without motion only what travels a path keeps a place along it (held at its start); everything else is as built.
    if (!o.play && !n.tags?.includes('mover') && !n.tags?.includes('walker')) return out
    let tt = t
    if (lv.speed) { if (now > lv.speed.until) lv.speed = undefined; else tt = t * lv.speed.k }
    return poseOne(anims[0], tt, n, out)
  }
  const poseOne = (a: Anim, t: number, n: { base?: M }, out: Pose): Pose => {
    const p = progress(a, t)
    if (p === null) return out
    const kf = KF[a.kf], e = easeOf(a)
    let hasTf = false, hasOp = false, hasFill = false, hasDoff = false
    for (const s of kf) { if (s.tf !== undefined) hasTf = true; if (s.op !== undefined) hasOp = true; if (s.fill !== undefined) hasFill = true; if (s.doff !== undefined) hasDoff = true }
    if (hasTf) out.m = fnsMatrix(sampleProp(kf, 'tf', p, e, null) as never, a.ref, a.org)
    else if (n.base) out.m = null
    if (hasOp) out.op = sampleProp(kf, 'op', p, e, undefined) as number
    if (hasFill) out.fill = sampleProp(kf, 'fill', p, e, undefined) as string
    if (hasDoff) out.doff = sampleProp(kf, 'doff', p, e, 0) as number
    return out
  }

  /* ---- drawing ---- */
  let level = 0
  /** Visible world box (with a margin) and the current level's visible cells. */
  let vis: Box = [0, 0, 0, 0]
  let deviceM: M = [1, 0, 0, 1, 0, 0]
  const scratch: M = [1, 0, 0, 1, 0, 0]
  const P: Pose = { m: null, op: undefined, fill: undefined, doff: undefined }

  const visibleCells = (li: number): number[] => {
    const lvl = levels[li]; if (!lvl) return []
    const S = scene.cell / scene.lv[li].scale, [ex, ey] = scene.extent
    const c0 = Math.max(0, Math.floor((vis[0] - ex) / S)), c1 = Math.min(lvl.cols - 1, Math.floor((vis[2] - ex) / S))
    const r0 = Math.max(0, Math.floor((vis[1] - ey) / S)), r1 = Math.min(lvl.rows - 1, Math.floor((vis[3] - ey) / S))
    const out: number[] = []
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) out.push(r * lvl.cols + c)
    return out
  }
  /** For each visible cell at the drawing level: where its pieces come from (itself, or an ancestor that has loaded). */
  type Source = { li: number; ci: number; night: boolean; clip: Box | null }
  let sources: { day: Source[]; night: Source[] } = { day: [], night: [] }
  const cellBox = (li: number, ci: number): Box => {
    const lvl = levels[li]!, S = scene.cell / scene.lv[li].scale, [ex, ey] = scene.extent
    const cx = ci % lvl.cols, cy = Math.floor(ci / lvl.cols)
    return [ex + cx * S, ey + cy * S, ex + (cx + 1) * S, ey + (cy + 1) * S]
  }
  const planSources = (night: boolean): Source[] => {
    const out: Source[] = []
    const lvl = levels[level]
    const li0 = lvl ? level : 0
    for (const ci of visibleCells(li0)) {
      const box = cellBox(li0, ci)
      const set = (night ? levels[li0]!.night : levels[li0]!.day).get(ci)
      if (!set) continue
      const img = [...set.values()][0]?.img
      if (img && want(img, li0 === level ? 0 : 1)) { out.push({ li: li0, ci, night, clip: null }); continue }
      // Not loaded yet: the nearest coarser level that is, cut to this cell.
      let found = false
      for (let li = li0 - 1; li >= 0 && !found; li--) {
        const l2 = levels[li]; if (!l2) continue
        const S = scene.cell / scene.lv[li].scale, [ex, ey] = scene.extent
        const cx = Math.floor((box[0] + 1 - ex) / S), cy = Math.floor((box[1] + 1 - ey) / S), c2 = cy * l2.cols + cx
        const s2 = (night ? l2.night : l2.day).get(c2)
        const im2 = s2 && [...s2.values()][0]?.img
        if (!im2) { found = true; break }
        if (want(im2, 2)) { out.push({ li, ci: c2, night, clip: box }); found = true }
      }
    }
    // Several finer cells can share one coarse stand-in: each draws only its own part.
    return out
  }

  const drawFrag = (f: Frag, li: number, ci: number, clip: Box | null) => {
    const bm = imgs.get(f.img)?.bm
    if (!bm) return
    const sc = scene.lv[li].scale, cb = cellBox(li, ci)
    let wx0 = cb[0] + f.dx / sc, wy0 = cb[1] + f.dy / sc, wx1 = wx0 + f.w / sc, wy1 = wy0 + f.h / sc
    let sx = f.sx, sy = f.sy, sw = f.w, sh = f.h
    if (clip) {
      const cx0 = Math.max(wx0, clip[0]), cy0 = Math.max(wy0, clip[1]), cx1 = Math.min(wx1, clip[2]), cy1 = Math.min(wy1, clip[3])
      if (cx1 <= cx0 || cy1 <= cy0) return
      sx += (cx0 - wx0) * sc; sy += (cy0 - wy0) * sc; sw = (cx1 - cx0) * sc; sh = (cy1 - cy0) * sc
      wx0 = cx0; wy0 = cy0; wx1 = cx1; wy1 = cy1
    }
    // Whole device pixels at the edges, so neighbouring cells meet without a seam.
    const m = deviceM
    const dx0 = Math.round(m[0] * wx0 + m[4]), dy0 = Math.round(m[3] * wy0 + m[5]), dx1 = Math.round(m[0] * wx1 + m[4]), dy1 = Math.round(m[3] * wy1 + m[5])
    if (dx1 <= dx0 || dy1 <= dy0) return
    ctx.drawImage(bm, sx, sy, sw, sh, dx0, dy0, dx1 - dx0, dy1 - dy0)
  }

  let alphaNow = 1
  const setM = (m: M) => ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5])
  const applyStyle = (s: Style, fillOverride?: string) => {
    const f = fillOverride ?? s.f
    if (f) ctx.fillStyle = f
    if (s.s) {
      ctx.strokeStyle = s.s
      ctx.lineWidth = s.w ?? 1
      ctx.lineCap = s.cap ?? 'butt'
      ctx.lineJoin = s.join ?? 'miter'
    }
  }

  const drawVector = (n: V, m: M, alpha: number) => {
    const lv = L(n)
    if (n.when && !whenOk(n.when)) return
    pose(n, tNow(), P)
    let mm = m
    if (n.m) mm = mulTo([1, 0, 0, 1, 0, 0], mm, n.m)
    if (P.m) mm = mulTo([1, 0, 0, 1, 0, 0], mm, P.m)
    else if (n.base) mm = mulTo([1, 0, 0, 1, 0, 0], mm, n.base)
    let a = alpha * (P.op ?? n.st.op ?? 1)
    if (n.tags) a *= tagAlpha(n.tags, n)
    if (a <= 0.002) return
    if (!lv.path) lv.path = new Path2D(n.d)
    setM(mm)
    const st = n.st
    const fill = fills.get(n) ?? P.fill ?? tagFill(n) ?? undefined
    if (st.f || fill) {
      ctx.globalAlpha = a * (st.fo ?? 1)
      ctx.fillStyle = fill ?? st.f!
      ctx.fill(lv.path, st.rule ?? 'nonzero')
    }
    if (st.s) {
      ctx.globalAlpha = a * (st.so ?? 1)
      applyStyle({ ...st, f: null })
      if (st.dash) { ctx.setLineDash(st.dash); ctx.lineDashOffset = P.doff ?? st.doff ?? 0 } else if (P.doff !== undefined) ctx.lineDashOffset = P.doff
      ctx.stroke(lv.path)
      if (st.dash) ctx.setLineDash([])
    }
  }

  const drawText = (n: T, m: M, alpha: number) => {
    pose(n, tNow(), P)
    const a = alpha * (P.op ?? n.op ?? 1)
    if (a <= 0.002) return
    const mm = n.m ? mulTo([1, 0, 0, 1, 0, 0], m, n.m) : m
    setM(mm)
    ctx.font = n.font
    ctx.textAlign = n.anchor
    ctx.textBaseline = n.base
    ;(ctx as unknown as { letterSpacing: string }).letterSpacing = n.ls ? `${n.ls}px` : '0px'
    const s = (n.tags && n.tags.map((t) => texts.get(t)).find((x) => x !== undefined)) ?? n.s
    ctx.globalAlpha = a
    if (n.stroke) { ctx.strokeStyle = n.stroke; ctx.lineWidth = n.sw ?? 1; ctx.lineJoin = 'round'; ctx.strokeText(s, n.x, n.y) }
    if (n.fill) { ctx.fillStyle = n.fill; ctx.fillText(s, n.x, n.y) }
  }

  /** The best loaded size of a sprite, and draw it. */
  const drawSprite = (id: number, m: M, alpha: number) => {
    const sp = scene.sprites[id]
    const s = Math.hypot(m[0], m[1])
    // The size wanted: the smallest level at least as sharp as the screen.
    let li = scene.levels.findIndex((l, i) => sp.at[i] && l >= s * 0.92)
    if (li < 0) { li = sp.at.length - 1; while (li > 0 && !sp.at[li]) li-- }
    let use = -1
    for (let k = li; k >= 0; k--) { const at = sp.at[k]; if (!at) continue; if (want(scene.pages[at[0]].file, k === li ? 0 : 3)) { use = k; break } }
    if (use < 0) for (let k = li + 1; k < sp.at.length; k++) { const at = sp.at[k]; if (at && imgs.get(scene.pages[at[0]].file)?.bm) { use = k; break } }
    if (use < 0) return
    const at = sp.at[use]!, bm = imgs.get(scene.pages[at[0]].file)!.bm!
    const sc = scene.levels[use], b = sp.box
    setM(m)
    ctx.globalAlpha = alpha
    ctx.drawImage(bm, at[1], at[2], at[3], at[4], b[0], b[1], at[3] / sc, at[4] / sc)
  }

  /** How strongly something tagged shows: the night's layers, the clouds, a building's ring. */
  const tagAlpha = (tags: string[], n: Node): number => {
    let a = 1
    const N = LAYERS.night
    for (const t of tags) {
      if (t === 'night-halos') a *= tween('halos', N.halos[st.time] ?? 0, N.fadeMs)
      else if (t === 'night-cores') a *= tween('cores', N.cores[st.time] ?? 0, N.fadeMs)
      else if (t === 'night-panes') a *= tween('panes', N.panes[st.time] ?? 0, N.fadeMs)
      else if (t === 'night-shine') a *= tween('shine', N.shine[st.time] ?? 0, N.fadeMs)
      else if (t === 'night-sky') a *= tween('sky', N.sky[st.time] ?? 0, N.fadeMs)
      else if (t === 'night-veil') a *= tween('veil', N.veil[st.time]?.[1] ?? 0, N.fadeMs)
      else if (t === 'layer-night') a *= tween('night', st.time === 'day' ? 0 : 1, N.fadeMs)
      else if (t === 'cloud') a *= tween('cloud', st.time === 'night' ? LAYERS.cloud.night : st.near ? LAYERS.cloud.near : 1, LAYERS.cloud.fadeMs)
      else if (t === 'layer-beam') a *= st.time === 'dusk' ? LAYERS.beam.dusk : 1
      else if (t === 'lm-ring') { const lmn = ringOwner.get(n); a *= lmn ? lmS(lmn).ring : 0 }
      else if (t === 'isl-plane' && !o.play) a = 0
    }
    return a
  }
  const tagFill = (n: V): string | undefined => {
    if (!n.tags) return undefined
    for (const t of n.tags) {
      if (t === 'night-veil') return LAYERS.night.veil[st.time]?.[0]
      if (t === 'cloud-puff') return LAYERS.cloud.puff[st.time]
      if (t === 'cloud-base') return LAYERS.cloud.base[st.time]
    }
    return undefined
  }
  const ringOwner = new Map<Node, string>()
  for (const [slug, g] of lms) for (const k of g.kids) if (k.k === 'v' && k.tags?.includes('lm-ring')) ringOwner.set(k, slug)

  /** The device box of a box under a matrix, to cull by. */
  const offscreen = (m: M, b: Box) => {
    const xs = [m[0] * b[0] + m[2] * b[1] + m[4], m[0] * b[2] + m[2] * b[1] + m[4], m[0] * b[0] + m[2] * b[3] + m[4], m[0] * b[2] + m[2] * b[3] + m[4]]
    const ys = [m[1] * b[0] + m[3] * b[1] + m[5], m[1] * b[2] + m[3] * b[1] + m[5], m[1] * b[0] + m[3] * b[3] + m[5], m[1] * b[2] + m[3] * b[3] + m[5]]
    return Math.max(...xs) < 0 || Math.min(...xs) > canvas.width || Math.max(...ys) < 0 || Math.min(...ys) > canvas.height
  }

  // A pool of canvases for drawing a group apart (a building fading as a whole).
  const pool: OffscreenCanvas[] = []

  const drawNode = (n: Node, m: M, alpha: number) => {
    switch (n.k) {
      case 'run': return drawRun(n.id, alpha)
      case 'spr': return drawSprite(n.id, m, alpha)
      case 'v': return drawVector(n, m, alpha)
      case 'txt': return drawText(n, m, alpha)
      case 'sea': return drawSea(n, alpha)
      case 'g': return drawGroup(n, m, alpha)
    }
  }

  const drawGroup = (n: G, m: M, alpha: number) => {
    if (n.when && !whenOk(n.when)) return
    const lv = L(n)
    const t = tNow()
    // Cull by reach, unless it holds still painting (which the cells cull).
    if (n.bb && !lv.hasRun && offscreen(m, n.bb)) return
    pose(n, t, P)
    const own = n.m ? mulTo([1, 0, 0, 1, 0, 0], m, n.m) : m.slice() as M
    let mm = own
    if (P.m) mm = mulTo(mm, own, P.m)
    else if (n.base) mm = mulTo(mm, own, n.base)
    let a = alpha * (P.op ?? n.op ?? 1)
    if (n.tags) a *= tagAlpha(n.tags, n)
    if (a <= 0.002) return
    // A building: lifted when picked, dropping in at the start, faded when filtered out.
    let iso = false
    if (n.lm) {
      const s = lmS(n.lm)
      const target = !keep || keep.has(n.lm) ? 1 : LANDMARK.dim
      s.dim = target === s.dim ? s.dim : approach(s.dim, target, LANDMARK.dimMs)
      a *= s.dim
      lv.drawn = mm.slice() as M; lv.frame = frameNo
      iso = a < 0.999
    }
    if (n.poke) { lv.drawn = mm.slice() as M; lv.frame = frameNo }
    if (n.tags?.includes('lm-art')) mm = artMatrix(n, mm)
    if (n.clip) {
      if (!lv.clip) lv.clip = new Path2D(n.clip)
      ctx.save(); setM(mm); ctx.clip(lv.clip)
    }
    if (iso && n.bb) {
      drawApart(n, mm, a)
    } else {
      for (const k of n.kids) drawNode(k, mm, a)
    }
    if (n.clip) ctx.restore()
  }

  /** Draw a group into a canvas of its own and lay it down at once: a fade of the whole, as CSS opacity does. */
  const drawApart = (n: G, mm: M, a: number) => {
    const bb = n.bb!
    // n.bb is in the parent's coordinates; the group's own transform is in mm, so measure on screen.
    const parentM = mm
    const pts = [[bb[0], bb[1]], [bb[2], bb[1]], [bb[0], bb[3]], [bb[2], bb[3]]].map(([x, y]) => [deviceM[0] * x + deviceM[2] * y + deviceM[4], deviceM[1] * x + deviceM[3] * y + deviceM[5]])
    const x0 = Math.max(0, Math.floor(Math.min(...pts.map((p) => p[0]))) - 2), y0 = Math.max(0, Math.floor(Math.min(...pts.map((p) => p[1]))) - 2)
    const x1 = Math.min(canvas.width, Math.ceil(Math.max(...pts.map((p) => p[0]))) + 2), y1 = Math.min(canvas.height, Math.ceil(Math.max(...pts.map((p) => p[1]))) + 2)
    const w = x1 - x0, h = y1 - y0
    if (w <= 0 || h <= 0) return
    let oc = pool.pop()
    if (!oc) oc = new OffscreenCanvas(w, h)
    if (oc.width < w || oc.height < h) { oc.width = Math.max(oc.width, w); oc.height = Math.max(oc.height, h) }
    const octx = oc.getContext('2d')!
    octx.setTransform(1, 0, 0, 1, 0, 0)
    octx.clearRect(0, 0, w, h)
    const saved = ctxRef.c
    ctxRef.c = octx as unknown as CanvasRenderingContext2D
    const shifted: M = [parentM[0], parentM[1], parentM[2], parentM[3], parentM[4] - x0, parentM[5] - y0]
    const savedDev = deviceM
    deviceM = [deviceM[0], deviceM[1], deviceM[2], deviceM[3], deviceM[4] - x0, deviceM[5] - y0]
    for (const k of n.kids) drawNode(k, shifted, 1)
    deviceM = savedDev
    ctxRef.c = saved
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalAlpha = a
    ctx.drawImage(oc, 0, 0, w, h, x0, y0, w, h)
    pool.push(oc)
  }
  // The context drawn into (the canvas's own, or a pool canvas while drawing a group apart).
  const ctxRef = { c: ctx }
  void ctxRef

  const approach = (v: number, to: number, ms: number) => { const k = Math.min(1, frameDt / ms); return Math.abs(to - v) < 0.002 ? to : v + (to - v) * (1 - Math.pow(1 - Math.min(0.99, 3 * k), 1)) }
  let frameDt = 16

  /** A building's art: lifted (with a spring) when picked, and its drop at the start. */
  const artMatrix = (n: G, mm: M): M => {
    const owner = artOwner.get(n); if (!owner) return mm
    const s = lmS(owner)
    // The lift springs, like the CSS transition it replaces (cubic-bezier 0.34, 1.56, 0.64, 1).
    const target = owner === hot ? LANDMARK.lift : 0
    if (target !== s.liftTo) { s.liftFrom = s.lift; s.liftTo = target; s.liftAt = now }
    const k = o.play ? Math.min(1, (now - s.liftAt) / LANDMARK.liftMs) : 1
    s.lift = s.liftFrom + (s.liftTo - s.liftFrom) * liftEase(k)
    s.ring = approach(s.ring, owner === hot ? 1 : 0, LANDMARK.ringMs)
    let out = s.lift ? mulTo([1, 0, 0, 1, 0, 0], mm, [1, 0, 0, 1, 0, -s.lift]) : mm
    if (introAt >= 0 && o.play) {
      const d = Number(lms.get(owner)?.data?.d ?? 0) / 1000
      const a = toAnim(LANDMARK.intro, [0, 0])
      const t = (now - introAt) / 1000 - d
      const p = progress(a, t)
      if (p !== null) {
        const kf = KF[a.kf], e = ease(a.ease)
        const fb = n.fb ?? [0, 0, 0, 0]
        const org: [number, number] = [(fb[0] + fb[2]) / 2, (fb[1] + fb[3]) / 2]
        out = mulTo([1, 0, 0, 1, 0, 0], out, fnsMatrix(sampleProp(kf, 'tf', p, e, null) as never, [0, 0], org))
        const op = sampleProp(kf, 'op', p, e, 1) as number
        introAlpha.set(owner, op)
      } else introAlpha.delete(owner)
    }
    return out
  }
  const liftEase = ease(LANDMARK.liftEase)
  const introAlpha = new Map<string, number>()
  const artOwner = new Map<Node, string>()
  for (const [slug, g] of lms) { const walkArt = (n: Node) => { if (n.k === 'g') { if (n.tags?.includes('lm-art')) artOwner.set(n, slug); n.kids.forEach(walkArt) } }; walkArt(g) }

  /** A still run: its piece in each visible cell, from the cells' own level or a stand-in. */
  const drawRun = (id: number, alpha: number) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalAlpha = alpha
    for (const night of [false, true]) {
      if (night && st.time === 'day' && (tweens.get('night')?.v ?? 0) <= 0) continue
      for (const s of night ? sources.night : sources.day) {
        const lvl = levels[s.li]; if (!lvl) continue
        const f = (night ? lvl.night : lvl.day).get(s.ci)?.get(id)
        if (f) drawFrag(f, s.li, s.ci, s.clip)
      }
    }
  }

  const drawSea = (n: Node & { k: 'sea' }, alpha: number) => {
    setM(deviceM)
    const g = ctx.createRadialGradient(n.cx, n.cy / n.sy, 0, n.cx, n.cy / n.sy, n.r)
    for (const [off, c] of n.stops) g.addColorStop(off, c)
    ctx.globalAlpha = alpha
    ctx.save()
    ctx.transform(1, 0, 0, n.sy, 0, 0)
    ctx.fillStyle = g
    ctx.fillRect(vis[0], vis[1] / n.sy, vis[2] - vis[0], (vis[3] - vis[1]) / n.sy)
    ctx.restore()
  }

  /* ---- one frame ---- */
  function frame(t: number) {
    frameDt = Math.min(100, Math.max(1, t - now))
    now = t; frameNo++
    st = o.state()
    const s = cam.z * dpr
    // The level: the smallest at least as sharp as the screen (a little upscaling allowed).
    let want0 = scene.levels.findIndex((l) => l >= s * 0.9)
    if (want0 < 0) want0 = scene.levels.length - 1
    level = want0
    loadIndex(level)
    // World → device, with the translation on whole pixels: the cells stay crisp.
    deviceM = [s, 0, 0, s, Math.round(W * dpr / 2 - cam.x * s), Math.round(H * dpr / 2 - cam.y * s)]
    const inv = invert(deviceM), pad = 4 / s
    vis = [inv[4] - pad, inv[5] - pad, inv[0] * canvas.width + inv[4] + pad, inv[3] * canvas.height + inv[5] + pad]
    sources = { day: planSources(false), night: st.time === 'day' && (tweens.get('night')?.v ?? 0) <= 0 ? [] : planSources(true) }
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalAlpha = 1
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    for (const n of scene.root) drawNode(n, deviceM, 1)
    for (const n of extra) drawNode(n, deviceM, 1)
    ctx.globalAlpha = 1
    pump()
    if (frameNo % 60 === 0) trim()
    void scratch
  }

  /* ---- what is under a point ---- */
  function hit(sx: number, sy: number): Hit {
    const px = sx * dpr, py = sy * dpr
    const test = (n: G, key: string | undefined): boolean => {
      const lv = live.get(n)
      if (!lv?.drawn || lv.frame !== frameNo || !key) return false
      const mk = maskOf(key); if (!mk) return false
      const inv = invert(lv.drawn)
      const x = inv[0] * px + inv[2] * py + inv[4], y = inv[1] * px + inv[3] * py + inv[5]
      const u = Math.floor((x - mk.box[0]) * mk.res), v = Math.floor((y - mk.box[1]) * mk.res)
      if (u < 0 || v < 0 || u >= mk.w || v >= mk.h) return false
      const i = v * mk.w + u
      return !!(mk.bits[i >> 3] & (1 << (i & 7)))
    }
    // Topmost first: the painting order, backwards.
    const order: { n: G; lm?: string; key?: string }[] = []
    const collect = (n: Node) => { if (n.k !== 'g') return; if (n.lm) order.push({ n, lm: n.lm, key: `lm:${n.lm}` }); else if (n.poke) order.push({ n, key: n.data?.mask }); n.kids.forEach(collect) }
    scene.root.forEach(collect)
    for (let i = order.length - 1; i >= 0; i--) {
      const it = order[i]
      if (test(it.n, it.key)) return it.lm ? { lm: it.lm } : { poke: { kind: it.n.poke!, node: it.n } }
    }
    return null
  }

  /* ---- reactions ---- */
  function poke(node: object) {
    const n = node as G
    const def = POKES[n.poke ?? '']
    if (def?.self) L(n).over = { a: toAnim(def.self, n.pokeOrg ?? [0, 0]), at: now }
    const inner = (k: Node) => {
      if (k.k === 'g' || k.k === 'v') {
        const tags = 'tags' in k ? k.tags ?? [] : []
        if (tags.includes('pk-say')) L(k).over = { a: toAnim(POKE_SAY, [0, 0]), at: now }
        for (const r of def?.inner ?? []) {
          if (r.on !== '*' && !tags.includes(r.on)) continue
          if (r.speed) L(k).speed = { k: r.speed, until: now + POKE_MS }
          if (r.loop) L(k).over = { a: toAnim(r.loop, fbOrigin(k.fb, POKE_INNER_ORIGIN[r.on] ?? 'center')), at: now }
        }
      }
      if (k.k === 'g') k.kids.forEach(inner)
    }
    // The gull: everything it holds flies, except its squawk.
    if (def?.inner?.some((r) => r.on === '*')) {
      const fly = def.inner.find((r) => r.on === '*')!
      for (const k of n.kids) if (!('tags' in k && k.tags?.includes('pk-say'))) wrapOver(k, fly.loop!)
      for (const k of n.kids) if ('tags' in k && k.tags?.includes('pk-say')) L(k).over = { a: toAnim(POKE_SAY, [0, 0]), at: now }
    } else n.kids.forEach(inner)
  }
  // A reaction for a kid with no group of its own (a sprite, a run of shapes): played on a wrapper made for it.
  const wrapOver = (k: Node, loop: Loop) => {
    if (k.k === 'g' || k.k === 'v') { L(k).over = { a: toAnim(loop, [0, 0]), at: now }; return }
    void loop
  }

  return {
    frame,
    hit,
    poke,
    /** The camera, in world units and CSS pixels per unit; and the canvas's size in CSS pixels. */
    setView(c: Cam, w: number, h: number, ratio: number) {
      cam.x = c.x; cam.y = c.y; cam.z = c.z
      if (w !== W || h !== H || ratio !== dpr) {
        W = w; H = h; dpr = ratio
        canvas.width = Math.round(w * ratio); canvas.height = Math.round(h * ratio)
      }
    },
    setHot(slug: string | null) { if (slug && slug !== hot) lmS(slug).blinkAt = now; hot = slug },
    dim(set: Set<string> | null) { keep = set },
    intro() { introAt = now },
    setText(tag: string, s: string) { texts.set(tag, s) },
    /** Set the fill of every shape with a tag (a lit window, a week filled in). */
    eachShape(tag: string, fn: (data: Record<string, string>, set: (fill: string | null) => void) => void) {
      for (const n of tagged.get(tag) ?? []) if (n.k === 'v') fn(n.data ?? {}, (f) => { if (f) fills.set(n, f); else fills.delete(n) })
    },
    /** Change a tagged rectangle's width (the progress bar). */
    setRectWidth(tag: string, fn: (data: Record<string, string>) => number) {
      for (const n of tagged.get(tag) ?? []) if (n.k === 'v' && n.data) {
        const d = n.data, w = fn(d), x = Number(d.x), y = Number(d.y), h = Number(d.height)
        n.d = `M${x} ${y}h${w}v${h}h${-w}Z`
        L(n).path = undefined
      }
    },
    /** How far along its loop the first node with this animation is (0..1): the ferry, for the soundscape. */
    phase(kf: string): number | null {
      let found: Anim | null = null
      const look = (n: Node) => { if (found) return; if ('a' in n && n.a) for (const a of n.a) if (a.kf === kf) found = a; if (n.k === 'g') n.kids.forEach(look) }
      scene.root.forEach(look)
      if (!found) return null
      const a = found as Anim
      const t = tNow() - a.delay
      return ((t % a.dur) + a.dur) % a.dur / a.dur
    },
    /** Things the page adds on top: flags, the day's balloon. */
    add(nodes: Node[]) { extra.push(...nodes) },
    pokeKinds: scene.pokes,
    /** Call when the engine may have more to draw (an image arrived). */
    set onLoaded(f: (() => void) | null) { onLoaded = f },
    /** Whether everything the current view wants at its own level is in. */
    ready() { return levels[level] !== null && sources.day.every((s) => s.li === level) },
    lmBox(slug: string) { return lms.get(slug)?.bb ?? null },
  }
}
export type Engine = ReturnType<typeof createEngine>
