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
 * poked, which bottles have been found and so are gone. It answers what is
 * under a point (hit), and paints any view into a canvas of its own for a
 * postcard (snapshot).
 */
import { sceneFrom, type Anim, type Box, type LevelIndex, type M, type Node, type Scene, type Style, type When } from './scene'
import { ID, mulTo, invert, fnsMatrix, progress, sampleProp, ease, type Ease } from './anim'
import { POKES, POKE_SAY, POKE_MS, POKE_INNER_ORIGIN, LANDMARK, LAYERS, type Loop } from './moves'

type G = Node & { k: 'g' }
type V = Node & { k: 'v' }
type T = Node & { k: 'txt' }
type Cam = { x: number; y: number; z: number }
export type IslandState = { time: string; season: string; hour: number; near: boolean; fest?: boolean }
/**
 * Something the page draws itself, live, in the painting's own order (a ball
 * you can throw, pigeons, a parade): given the canvas, the world-to-device
 * matrix and the time, it draws and says how many canvas calls that took.
 */
export type LiveHook = (c: CanvasRenderingContext2D, m: M, t: number) => number
export type LiveLayer = {
  /** Drawn just after the layer of that kind (sea, walkers...), so whatever is painted later stands in front of it. */
  after?: Partial<Record<string, LiveHook>>
  /** Drawn over everything (what flies). */
  top?: LiveHook
  /**
   * Drawn again in each window in front of a building (see drawGroup), so
   * what walks the road there is not cut off by the wall behind it. inWin
   * says whether a box in world units shows in the window, and if so clips to it.
   */
  front?: (c: CanvasRenderingContext2D, m: M, t: number, inWin: (b: Box) => boolean) => number
}
export type Hit = { lm?: string; poke?: { kind: string; node: object; n?: number } } | null

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
  /** Shown as it is at its height until then, without moving there (a poke's words, under reduced motion). */
  hold?: { op: number; until: number }
  hasRun?: boolean
  text?: string
  fill?: string
}

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
  const { base } = o
  /** The canvas being drawn: the page's, or a postcard's while it is painted (snapshot). */
  let canvas = o.canvas
  const scene = sceneFrom(o.scene)
  const main = canvas.getContext('2d', { alpha: true })!
  /** The context being drawn into: the canvas's own, or a pool canvas while a group is drawn apart. */
  let ctx: CanvasRenderingContext2D = main
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
    // What no frame has asked for lately (a size the camera has flown past) is not fetched at all.
    for (let i = queue.length - 1; i >= 0; i--) if (frameNo - (imgs.get(queue[i].url)?.used ?? 0) > 2) queue.splice(i, 1)
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

  /* ---- prepared once: which groups hold still painting, the buildings, what is tagged ---- */
  const lms = new Map<string, G>()
  const tagged = new Map<string, Node[]>()
  const lmOf = new Map<Node, string>()
  const prep = (n: Node, inLm?: G): boolean => {
    if (n.k === 'run') return true
    if ('tags' in n && n.tags) { for (const t of n.tags) (tagged.get(t) ?? tagged.set(t, []).get(t)!).push(n); if (inLm?.lm) lmOf.set(n, inLm.lm) }
    if (n.k !== 'g') return false
    if (n.lm) { lms.set(n.lm, n); inLm = n }
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
  const lmState = new Map<string, { lift: number; ring: number; dim: number }>()
  const lmS = (s: string) => lmState.get(s) ?? lmState.set(s, { lift: 0, ring: 0, dim: 1 }).get(s)!
  let introAt = -1
  const texts = new Map<string, string>()
  const fills = new Map<object, string>()
  const extra: Node[] = []
  /** The numbers of the bottles already found, which are not drawn (and so cannot be hit). */
  const gone = new Set<number>()

  const cssEase = ease('ease')
  let st: IslandState = o.state()
  // A festival night (Friday's fireworks) counts as the season 'fest' too.
  const whenOk = (w: When | undefined) => !w || ((!w.time || w.time.includes(st.time)) && (!w.season || w.season.includes(st.season) || (!!st.fest && w.season.includes('fest'))) && (!w.hour || w.hour.includes(st.hour)))

  /* ---- posing a node at this moment ---- */
  const tNow = () => (o.play ? (now - t0) / 1000 : 0)
  const easeOf = (a: Anim) => ease(a.ease)
  /** Where an animation has a node now: its matrix (or null for "as built"), its opacity, fill, dash offset. */
  type Pose = { m: M | null; op: number | undefined; fill: string | undefined; doff: number | undefined }
  const pose = (n: { a?: Anim[]; base?: M; tags?: string[] }, t: number, out: Pose): Pose => {
    out.m = null; out.op = undefined; out.fill = undefined; out.doff = undefined
    const lv = L(n)
    if (lv.hold) { if (now < lv.hold.until) { out.op = lv.hold.op; return out } lv.hold = undefined }
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
  /**
   * What the last frame cost, counted as it is drawn: the canvas calls (on a
   * phone each is a few microseconds of the main thread, and their number,
   * not the pixels, is what decides the frame rate), and what they drew.
   */
  const NO_STATS = { calls: 0, images: 0, transforms: 0, paths: 0, texts: 0, frags: 0, sprites: 0, apart: 0, ms: 0 }
  let cs = { ...NO_STATS }, lastStats = { ...NO_STATS }
  let level = 0
  /** Visible world box (with a margin) and the current level's visible cells. */
  let vis: Box = [0, 0, 0, 0]
  let deviceM: M = [1, 0, 0, 1, 0, 0]
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
      if (img && want(img, li0 === level ? 0 : 1)) { out.push({ li: li0, ci, night, clip: null }); if (li0 !== level) blurry++; continue }
      blurry++
      // Not loaded yet: the nearest coarser level that is, cut to this cell.
      let found = false
      for (let li = li0 - 1; li >= 0 && !found; li--) {
        const l2 = levels[li]; if (!l2) continue
        const S = scene.cell / scene.lv[li].scale, [ex, ey] = scene.extent
        const cx = Math.floor((box[0] + 1 - ex) / S), cy = Math.floor((box[1] + 1 - ey) / S), c2 = cy * l2.cols + cx
        const s2 = (night ? l2.night : l2.day).get(c2)
        const im2 = s2 && [...s2.values()][0]?.img
        if (!im2) { found = true; break }
        // Only the smallest level is fetched to stand in; a middle one stands in only if it is here already.
        if (li === 0 ? want(im2, 2) : imgs.get(im2)?.bm) { out.push({ li, ci: c2, night, clip: box }); found = true }
      }
      if (!found) gaps++
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
    // Read half a pixel inside the piece's own edges in its sheet: scaled with smoothing, the edge would
    // take in a sliver of whatever lies next to it there, and every cell would show a hairline.
    if (sw > 2 && sh > 2) {
      const l = sx === f.sx ? 0.5 : 0, t = sy === f.sy ? 0.5 : 0, r = sx + sw === f.sx + f.w ? 0.5 : 0, b = sy + sh === f.sy + f.h ? 0.5 : 0
      sx += l; sy += t; sw -= l + r; sh -= t + b
    }
    ctx.drawImage(bm, sx, sy, sw, sh, dx0, dy0, dx1 - dx0, dy1 - dy0)
    cs.images++; cs.frags++
  }

  let alphaNow = 1
  // Changing the transform is one of the dearer calls on a phone: most sprites are drawn in device pixels, the transform left as it is.
  let ident = false
  const setM = (m: M) => { ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]); ident = false; cs.transforms++ }
  const toIdent = () => { if (!ident) { ctx.setTransform(1, 0, 0, 1, 0, 0); ident = true; cs.transforms++ } }
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
    if (n.bb && offscreen(m, n.bb)) return
    pose(n, tNow(), P)
    let mm = m
    if (n.m) mm = mulTo([1, 0, 0, 1, 0, 0], mm, n.m)
    if (P.m) mm = mulTo([1, 0, 0, 1, 0, 0], mm, P.m)
    else if (n.base) mm = mulTo([1, 0, 0, 1, 0, 0], mm, n.base)
    let a = alpha * (P.op ?? n.st.op ?? 1)
    if (n.tags) a *= tagAlpha(n.tags, n)
    if (a <= 0.002) return
    if (!lv.path) lv.path = new Path2D(n.d)
    if (win && n.bb && outsideWin(devBox(m, n.bb))) return
    setM(mm)
    const st = n.st
    const fill = fills.get(n) ?? P.fill ?? tagFill(n) ?? undefined
    if (st.f || fill) {
      ctx.globalAlpha = a * (st.fo ?? 1)
      ctx.fillStyle = fill ?? st.f!
      if (st.blend) ctx.globalCompositeOperation = st.blend
      ctx.fill(lv.path, st.rule ?? 'nonzero')
      if (st.blend) ctx.globalCompositeOperation = 'source-over'
      cs.paths++
    }
    if (st.s) {
      ctx.globalAlpha = a * (st.so ?? 1)
      applyStyle({ ...st, f: null })
      let doff = P.doff ?? st.doff ?? 0
      if (ringOwner.has(n) && o.play && ringOwner.get(n) === hot) doff = marchOffset(st.doff ?? 0)
      if (st.dash) { ctx.setLineDash(st.dash); ctx.lineDashOffset = doff } else if (P.doff !== undefined) ctx.lineDashOffset = doff
      ctx.stroke(lv.path)
      cs.paths++
      if (st.dash) ctx.setLineDash([])
    }
  }

  /** The text settings the context has now (a restore puts back older ones, so it forgets them). */
  let textCtx: CanvasRenderingContext2D | null = null, textFont = '', textLs = ''
  const restore = () => { ctx.restore(); textCtx = null; ident = false }
  const drawText = (n: T, m: M, alpha: number) => {
    if (n.bb && offscreen(m, n.bb)) return
    pose(n, tNow(), P)
    const a = alpha * (P.op ?? n.op ?? 1)
    if (a <= 0.002) return
    const mm = n.m ? mulTo([1, 0, 0, 1, 0, 0], m, n.m) : m
    if (win && n.bb && outsideWin(devBox(m, n.bb))) return
    setM(mm)
    // Setting a font makes the canvas read it again: only when it changes.
    if (textCtx !== ctx) { textCtx = ctx; textFont = ''; textLs = '' }
    if (textFont !== n.font) { ctx.font = n.font; textFont = n.font }
    const ls = n.ls ? `${n.ls}px` : '0px'
    if (textLs !== ls) { (ctx as unknown as { letterSpacing: string }).letterSpacing = ls; textLs = ls }
    ctx.textAlign = n.anchor
    ctx.textBaseline = n.bl
    const s = (n.tags && n.tags.map((t) => texts.get(t)).find((x) => x !== undefined)) ?? n.s
    ctx.globalAlpha = a
    if (n.stroke) { ctx.strokeStyle = n.stroke; ctx.lineWidth = n.sw ?? 1; ctx.lineJoin = 'round'; ctx.strokeText(s, n.x, n.y); cs.texts++ }
    if (n.fill) { ctx.fillStyle = n.fill; ctx.fillText(s, n.x, n.y); cs.texts++ }
  }

  /** The best loaded size of a sprite, and draw it. */
  const drawSprite = (id: number, m: M, alpha: number) => {
    const sp = scene.sprites[id], u = sp.u
    if (offscreen(m, sp.box)) return
    if (win && outsideWin(devBox(m, sp.box))) return
    // Screen pixels to one of its units, along its longer axis (a squashed one is as sharp as it is long).
    const s = Math.max(Math.hypot(m[0], m[1]), Math.hypot(m[2], m[3]))
    // The size wanted: the smallest level at least as sharp as the screen.
    let li = scene.levels.findIndex((l, i) => sp.at[i] && l * u >= s * 0.92)
    if (li < 0) { li = sp.at.length - 1; while (li > 0 && !sp.at[li]) li-- }
    let use = -1
    // The size wanted is fetched, and the smallest to stand in for it meanwhile; any size between only if it is here already.
    for (let k = li; k >= 0; k--) { const at = sp.at[k]; if (!at) continue; const file = scene.pages[at[0]].file; if (k === li || k === 0 || !sp.at.slice(0, k).some(Boolean) ? want(file, k === li ? 0 : 3) : imgs.get(file)?.bm) { use = k; break } }
    if (use < 0) for (let k = li + 1; k < sp.at.length; k++) { const at = sp.at[k]; if (at && imgs.get(scene.pages[at[0]].file)?.bm) { use = k; break } }
    if (use < 0) { gaps++; return }
    if (use !== li) blurry++
    const at = sp.at[use]!, bm = imgs.get(scene.pages[at[0]].file)!.bm!
    const sc = scene.levels[use] * u, b = sp.box
    ctx.globalAlpha = alpha
    if (m[1] === 0 && m[2] === 0 && m[0] > 0 && m[3] > 0) {
      toIdent()
      // On whole device pixels, as the cells are: a sprite at rest is as crisp as the ground it stands on, and moves with it.
      ctx.drawImage(bm, at[1], at[2], at[3], at[4], Math.round(m[0] * b[0] + m[4]), Math.round(m[3] * b[1] + m[5]), (m[0] * at[3]) / sc, (m[3] * at[4]) / sc)
    } else {
      setM(m)
      ctx.drawImage(bm, at[1], at[2], at[3], at[4], b[0], b[1], at[3] / sc, at[4] / sc)
    }
    cs.images++; cs.sprites++
  }

  /** How strongly something tagged shows: the night's layers, the clouds, a building's ring. */
  const tagAlpha = (tags: string[], n: Node): number => {
    let a = 1
    const N = LAYERS.night
    for (const t of tags) {
      if (t === 'night-halos') a *= timed('halos', N.halos[st.time] ?? 0, N.fadeMs)
      else if (t === 'night-cores') a *= timed('cores', N.cores[st.time] ?? 0, N.fadeMs)
      else if (t === 'night-panes') a *= timed('panes', N.panes[st.time] ?? 0, N.fadeMs)
      else if (t === 'night-shine') a *= timed('shine', N.shine[st.time] ?? 0, N.fadeMs)
      else if (t === 'night-sky') a *= timed('sky', N.sky[st.time] ?? 0, N.fadeMs)
      else if (t === 'night-veil') {
        const blend = n.k === 'v' ? (n as V).st.blend : undefined
        const real = blend ? N.real[blend as 'multiply' | 'saturation'] : null
        a *= real ? timed(`veil:${blend}`, real[st.time]?.[1] ?? 0, N.fadeMs) : timed('veil', N.veil[st.time]?.[1] ?? 0, N.fadeMs)
      }
      else if (t === 'night-grade') {
        const blend = (n as V).st.blend as 'multiply' | 'saturation'
        a *= timed(`grade:${blend}`, N.toon[blend]?.[st.time]?.[1] ?? 0, N.fadeMs)
      }
      else if (t === 'night-glow') a *= timed('glow', N.glow[st.time] ?? 0, N.fadeMs)
      else if (t === 'layer-night') a *= timed('night', st.time === 'day' ? 0 : 1, N.fadeMs)
      else if (t === 'cloud') a *= timed('cloud', st.time === 'night' ? LAYERS.cloud.night : st.near ? LAYERS.cloud.near : 1, LAYERS.cloud.fadeMs)
      else if (t === 'layer-beam') a *= st.time === 'dusk' ? LAYERS.beam.dusk : 1
      else if (t === 'lm-ring') { const lmn = ringOwner.get(n); a *= lmn ? lmS(lmn).ring : 0 }
      else if (t === 'isl-plane' && !o.play) a = 0
      // A signpost's names, only once they are big enough to read.
      else if (t === 'sign-words') a *= timed('sign-words', cam.z >= SIGN_Z ? 1 : 0, 260)
    }
    return a
  }
  const tagFill = (n: V): string | undefined => {
    if (!n.tags) return undefined
    for (const t of n.tags) {
      if (t === 'night-veil' || t === 'night-grade') {
        if (!n.st.blend) return LAYERS.night.veil[st.time]?.[0]
        // The veils' colours move from one time's to the next as their strength does (by day, they keep the last).
        const table = (t === 'night-grade' ? LAYERS.night.toon : LAYERS.night.real)[n.st.blend as 'multiply' | 'saturation']
        const hex = table?.[st.time]?.[0]
        const ch = [16, 8, 0].map((sh, i) => {
          const key = `${t === 'night-grade' ? 'grade' : 'veil'}-c:${n.st.blend}:${i}`
          return Math.round(timed(key, hex ? (parseInt(hex.slice(1), 16) >> sh) & 255 : timers.get(key)?.to ?? 255, LAYERS.night.fadeMs))
        })
        return `rgb(${ch.join(',')})`
      }
      if (t === 'cloud-puff') return LAYERS.cloud.puff[st.time]
      if (t === 'cloud-base') return LAYERS.cloud.base[st.time]
    }
    return undefined
  }
  /** CSS pixels to a map unit from which a signpost's names are drawn (they are 4.5 units tall). */
  const SIGN_Z = 2.5
  const ringOwner = new Map<Node, string>()
  const MARCH = toAnim(LANDMARK.ringMarch, [0, 0])
  const marchEase = ease(MARCH.ease)
  const marchOffset = (base: number) => { const p = progress(MARCH, (now - t0) / 1000); return p === null ? base : (sampleProp(KF[MARCH.kf], 'doff', p, marchEase, base) as number) }
  for (const [slug, g] of lms) for (const k of g.kids) if (k.k === 'v' && k.tags?.includes('lm-ring')) ringOwner.set(k, slug)

  /** A box under a matrix, on the device: x0, y0, x1, y1. */
  const devBox = (m: M, b: Box): Box => {
    const ax = m[0] * b[0], bx = m[0] * b[2], cx = m[2] * b[1], dx = m[2] * b[3]
    const ay = m[1] * b[0], by = m[1] * b[2], cy = m[3] * b[1], dy = m[3] * b[3]
    return [Math.min(ax, bx) + Math.min(cx, dx) + m[4], Math.min(ay, by) + Math.min(cy, dy) + m[5], Math.max(ax, bx) + Math.max(cx, dx) + m[4], Math.max(ay, by) + Math.max(cy, dy) + m[5]]
  }
  /** Whether a box under a matrix is wholly off the canvas, to cull by. */
  const offscreen = (m: M, b: Box) => {
    const d = devBox(m, b)
    return d[2] < 0 || d[0] > canvas.width || d[3] < 0 || d[1] > canvas.height
  }

  const drawNode = (n: Node, m: M, alpha: number) => {
    switch (n.k) {
      case 'run': return drawRun(n.id, alpha)
      case 'spr': {
        // A sprite has no motion of its own, but can be thrown by a reaction (the gull's flight).
        const lv = live.get(n)
        if (lv?.over) { pose(n as { a?: Anim[] }, tNow(), P); if (P.m) return drawSprite(n.id, mulTo([1, 0, 0, 1, 0, 0], m, P.m), alpha * (P.op ?? 1)) }
        return drawSprite(n.id, m, alpha)
      }
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
    // A bottle that has been found: gone, after it has had a moment to hop.
    if (n.poke && n.data?.n) a *= timed(`gone:${n.data.n}`, gone.has(Number(n.data.n)) ? 0 : 1, 700)
    if (a <= 0.002) return
    // A building: faded when filtered out, and fading in as it drops in at the start.
    // Either fade is of the building as a whole (as CSS opacity is), so it is drawn apart.
    let iso = false
    if (n.lm) {
      const s = lmS(n.lm)
      s.dim = timed(`dim:${n.lm}`, !keep || keep.has(n.lm) ? 1 : LANDMARK.dim, LANDMARK.dimMs)
      a *= s.dim * introPose(n.lm).op
      lv.drawn = mm.slice() as M; lv.frame = frameNo
      if (a <= 0.002) return
      iso = a < 0.999
    }
    if (n.poke) { lv.drawn = mm.slice() as M; lv.frame = frameNo }
    if (n.tags?.includes('lm-art')) mm = artMatrix(n, mm)
    // A clip with a box of its own is a window that is mostly empty (people
    // passing in front of a building): it is only set up once something in
    // it is about to be drawn, and what lies outside its box is not drawn.
    const outer = win
    if (n.clip) {
      if (!lv.clip) lv.clip = new Path2D(n.clip)
      if (n.cb) {
        // Far out, a person is a few pixels tall and what the window puts right does not show: it is not worth its calls.
        if (deviceM[0] < WIN_MIN || offscreen(mm, n.cb)) return
        win = { path: lv.clip, m: mm, box: devBox(mm, n.cb), on: false }
      } else { ctx.save(); setM(mm); ctx.clip(lv.clip) }
    }
    if (iso && n.bb) drawApart(n, m, mm, a)
    else for (const k of n.kids) drawNode(k, mm, a)
    if (n.clip) {
      if (!n.cb) restore()
      else {
        // What the page walks along the road here, through the same window.
        if (drawLive.front && win) { cs.paths += drawLive.front(ctx, deviceM, now, (b) => !outsideWin(devBox(deviceM, b))); ident = false; textCtx = null; ctx.globalAlpha = 1 }
        if (win?.on) restore(); win = outer
      }
    }
  }

  /** Device pixels to a map unit below which the windows in front of buildings are left out. */
  const WIN_MIN = 1.2
  /** The window being drawn through (see drawGroup), if any, and whether its clip is set yet. */
  let win: { path: Path2D; m: M; box: Box; on: boolean } | null = null
  /** Whether a box on the device is wholly outside the window; and if not, set the window's clip. */
  const outsideWin = (d: Box) => {
    if (!win) return false
    const b = win.box
    if (d[2] < b[0] || d[0] > b[2] || d[3] < b[1] || d[1] > b[3]) return true
    if (!win.on) { ctx.save(); setM(win.m); ctx.clip(win.path); win.on = true }
    return false
  }

  // Canvases to draw a group apart in, reused.
  const pool: OffscreenCanvas[] = []
  /** Draw a group's contents into a canvas of its own, then lay that down at once: a fade of the whole, as CSS opacity does. */
  const drawApart = (n: G, parentM: M, mm: M, a: number) => {
    // Where it can reach on screen (its reach is in its parent's coordinates).
    const [x0, y0, x1, y1] = devBox(parentM, n.bb!)
    const X0 = Math.max(0, Math.floor(x0) - 2), Y0 = Math.max(0, Math.floor(y0) - 2)
    const X1 = Math.min(canvas.width, Math.ceil(x1) + 2), Y1 = Math.min(canvas.height, Math.ceil(y1) + 2)
    const w = X1 - X0, h = Y1 - Y0
    if (w <= 0 || h <= 0) return
    const oc = pool.pop() ?? new OffscreenCanvas(w, h)
    if (oc.width < w || oc.height < h) { oc.width = Math.max(oc.width, w); oc.height = Math.max(oc.height, h) }
    const octx = oc.getContext('2d')! as unknown as CanvasRenderingContext2D
    octx.setTransform(1, 0, 0, 1, 0, 0)
    octx.globalAlpha = 1
    octx.clearRect(0, 0, w, h)
    octx.imageSmoothingEnabled = true
    octx.imageSmoothingQuality = 'high'
    // Everything as if the canvas began at (X0, Y0): the matrices, and the device matrix the still runs use.
    const saved = ctx, savedDev = deviceM
    ctx = octx; ident = false
    deviceM = [deviceM[0], deviceM[1], deviceM[2], deviceM[3], deviceM[4] - X0, deviceM[5] - Y0]
    const shifted: M = [mm[0], mm[1], mm[2], mm[3], mm[4] - X0, mm[5] - Y0]
    for (const k of n.kids) drawNode(k, shifted, 1)
    ctx = saved; deviceM = savedDev; ident = false
    toIdent()
    ctx.globalAlpha = a
    ctx.drawImage(oc, 0, 0, w, h, X0, Y0, w, h)
    cs.images++; cs.apart++
    pool.push(oc)
  }

  /**
   * A value moving to a target as a CSS transition does: when the target
   * changes it sets off from wherever it is, over ms, eased. Without motion it
   * is at its target at once.
   */
  const timers = new Map<string, { v: number; from: number; to: number; at: number }>()
  const timed = (key: string, to: number, ms: number, e: Ease = cssEase): number => {
    let tm = timers.get(key)
    if (!tm) { tm = { v: to, from: to, to, at: now }; timers.set(key, tm); return to }
    if (tm.to !== to) { tm.from = tm.v; tm.to = to; tm.at = now }
    const k = o.play ? Math.min(1, (now - tm.at) / ms) : 1
    tm.v = k >= 1 ? to : tm.from + (tm.to - tm.from) * e(k)
    return tm.v
  }

  /**
   * A building dropping in at the start: its art's transform and the whole
   * building's opacity now. As the page's CSS had it, the drop is round the
   * world's origin (the art has no transform box of its own), each building
   * a little after the last.
   */
  const INTRO = toAnim(LANDMARK.intro, [0, 0])
  const introEase = ease(INTRO.ease)
  const introOut = { m: null as M | null, op: 1 }
  const introPose = (slug: string) => {
    introOut.m = null; introOut.op = 1
    if (introAt < 0 || !o.play) return introOut
    const t = (now - introAt) / 1000 - Number(lms.get(slug)?.data?.d ?? 0) / 1000
    const p = progress(INTRO, t)
    if (p === null) return introOut
    const kf = KF[INTRO.kf]
    introOut.m = fnsMatrix(sampleProp(kf, 'tf', p, introEase, null) as never, INTRO.ref, INTRO.org)
    introOut.op = sampleProp(kf, 'op', p, introEase, 1) as number
    return introOut
  }

  /** A building's art: lifted (with a spring) when picked, and dropping in at the start. */
  const liftEase = ease(LANDMARK.liftEase)
  const artMatrix = (n: G, mm: M): M => {
    const owner = artOwner.get(n); if (!owner) return mm
    const s = lmS(owner)
    s.lift = timed(`lift:${owner}`, owner === hot ? LANDMARK.lift : 0, LANDMARK.liftMs, liftEase)
    s.ring = timed(`ring:${owner}`, owner === hot ? 1 : 0, LANDMARK.ringMs)
    // The lift was a transition on the art's transform, which the drop (an animation) overrides while it runs.
    const ip = introPose(owner)
    if (ip.m) return mulTo([1, 0, 0, 1, 0, 0], mm, ip.m)
    return s.lift ? mulTo([1, 0, 0, 1, 0, 0], mm, [1, 0, 0, 1, 0, -s.lift]) : mm
  }
  const artOwner = new Map<Node, string>()
  for (const [slug, g] of lms) { const walkArt = (n: Node) => { if (n.k === 'g') { if (n.tags?.includes('lm-art')) artOwner.set(n, slug); n.kids.forEach(walkArt) } }; walkArt(g) }

  /** A still run: its piece in each visible cell, from the cells' own level or a stand-in. */
  const drawRun = (id: number, alpha: number) => {
    toIdent()
    ctx.globalAlpha = alpha
    for (const night of [false, true]) {
      if (night && st.time === 'day' && (timers.get('night')?.v ?? 0) <= 0) continue
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
    restore()
    if (o.play && !n.still) drawWaves(n, alpha)
  }

  /**
   * The open sea moving: little wave marks in three sets, each in turn
   * fading in, drifting a short way with the wind and fading out again, then
   * coming back somewhere else. Whatever is painted over the sea (the
   * shallows, the land) hides them, so they are only ever out in deep water.
   * One stroke a set, three a frame at most, whatever the zoom.
   */
  const WAVES = { sets: 3, each: 120, period: 8, drift: 26, alpha: 0.5 }
  let waves: Path2D[] | null = null
  const drawWaves = (n: Node & { k: 'sea' }, alpha: number) => {
    if (!waves) {
      let seed = 7
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
      const [x0, y0, x1, y1] = n.rect
      waves = Array.from({ length: WAVES.sets }, () => {
        const p = new Path2D()
        for (let k = 0; k < WAVES.each; k++) {
          const x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0), s = 0.75 + rnd() * 0.5
          p.moveTo(x, y); p.quadraticCurveTo(x + 5 * s, y - 3.6 * s, x + 10 * s, y); p.quadraticCurveTo(x + 15 * s, y - 3.6 * s, x + 20 * s, y)
        }
        return p
      })
    }
    const t = (now - t0) / 1000
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.7; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    for (let k = 0; k < WAVES.sets; k++) {
      const ph = t / WAVES.period + k / WAVES.sets, cyc = Math.floor(ph), u = ph - cyc
      const a = 0.5 - 0.5 * Math.cos(u * Math.PI * 2)
      if (a < 0.02) continue
      // Each time round, the set comes back shifted somewhere new (it is out of sight as it moves).
      const dx = ((cyc * 137 + k * 53) % 211) + u * WAVES.drift, dy = ((cyc * 89 + k * 31) % 157) - u * WAVES.drift * 0.3
      const m = deviceM
      setM([m[0], m[1], m[2], m[3], m[0] * dx + m[2] * dy + m[4], m[1] * dx + m[3] * dy + m[5]])
      ctx.globalAlpha = alpha * WAVES.alpha * a
      ctx.stroke(waves[k])
      cs.paths++
    }
  }

  /** Last frame: what had nothing to draw yet, and what was drawn from a coarser picture than it wanted. */
  let gaps = 0, blurry = 0, lastGaps = 1, lastBlurry = 1

  /* ---- what the page draws live ---- */
  let drawLive: LiveLayer = {}
  /** The layers that end after each top-level node (sea, walkers...), for the hooks after them. */
  const endsAfter = new Map<number, string[]>()
  // Only where the last layer of each kind ends (the sea comes in more than one), so each hook runs once a frame.
  const lastEnd = new Map<string, number>()
  for (const [kind, at] of scene.ends ?? []) lastEnd.set(kind, at)
  for (const [kind, at] of lastEnd) (endsAfter.get(at - 1) ?? endsAfter.set(at - 1, []).get(at - 1)!).push(kind)
  const hook = (h: LiveHook) => { cs.paths += h(ctx, deviceM, now); ident = false; textCtx = null; ctx.globalAlpha = 1 }

  /* ---- one frame ---- */
  /** A colour to lay down before the island (a snapshot has no page behind it). */
  let under: string | null = null
  function frame(t: number) {
    const began = performance.now()
    cs = { ...NO_STATS }
    gaps = levels[0] ? 0 : 1; blurry = levels[level] ? 0 : 1
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
    sources = { day: planSources(false), night: st.time === 'day' && (timers.get('night')?.v ?? 0) <= 0 ? [] : planSources(true) }
    ctx.setTransform(1, 0, 0, 1, 0, 0); ident = true
    ctx.globalAlpha = 1
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (under) { ctx.fillStyle = under; ctx.fillRect(0, 0, canvas.width, canvas.height) }
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    scene.root.forEach((n, i) => {
      drawNode(n, deviceM, 1)
      const ended = endsAfter.get(i)
      if (ended) for (const k of ended) { const h = drawLive.after?.[k]; if (h) hook(h) }
    })
    for (const n of extra) drawNode(n, deviceM, 1)
    if (drawLive.top) hook(drawLive.top)
    ctx.globalAlpha = 1
    lastGaps = gaps; lastBlurry = blurry
    pump()
    if (frameNo % 60 === 0) trim()
    cs.calls = cs.images + cs.transforms + cs.paths + cs.texts
    cs.ms = performance.now() - began
    lastStats = cs
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
      if (test(it.n, it.key)) return it.lm ? { lm: it.lm } : { poke: { kind: it.n.poke!, node: it.n, n: it.n.data?.n ? Number(it.n.data.n) : undefined } }
    }
    return null
  }

  /* ---- reactions ---- */
  function poke(node: object) {
    const n = node as G
    const def = POKES[n.poke ?? '']
    // Without motion nothing reacts; what was poked only says its word.
    if (!o.play) {
      const say = (k: Node) => { if ('tags' in k && k.tags?.includes('pk-say')) L(k).hold = { op: 1, until: now + POKE_MS }; if (k.k === 'g') k.kids.forEach(say) }
      n.kids.forEach(say)
      return
    }
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
  /** A reaction played on one thing a poked group holds, whatever kind it is. */
  const wrapOver = (k: Node, loop: Loop) => {
    if (k.k === 'g' || k.k === 'v' || k.k === 'txt' || k.k === 'spr') L(k).over = { a: toAnim(loop, [0, 0]), at: now }
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
        // A canvas given a new size forgets its settings: so must we.
        ident = false; textCtx = null
      }
    },
    setHot(slug: string | null) {
      // Pointing at Dinosaur Time makes its fossil blink, three times.
      if (slug && slug !== hot && o.play) {
        const b = LANDMARK.hoverBlink
        for (const n of tagged.get(b.on) ?? []) if (lmOf.get(n) === slug) L(n).over = { a: toAnim(b.loop, [0, 0]), at: now }
      }
      hot = slug
    },
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
    /** What the page draws live, in the painting's order (see LiveLayer). */
    setLive(l: LiveLayer) { drawLive = l },
    /** Bottles found: they fade away (at once, for those found on an earlier visit). */
    setGone(ns: Iterable<number>) { for (const n of ns) gone.add(n) },
    /**
     * Paint a view into a canvas of its own, at one pixel to a CSS pixel: the
     * island as it is this moment, centred on (x, y), at zoom z, w by h. The
     * page's own canvas, and what its last frame cost and drew, are as they
     * were. Whether everything in the view was drawn at its own sharpness: if
     * not, what it still wants is on its way, and another try will be sharper.
     */
    snapshot(target: HTMLCanvasElement, view: Cam, w: number, h: number): { drawable: boolean; sharp: boolean } {
      const was = { canvas, ctx, cam: { ...cam }, W, H, dpr, stats: lastStats, gaps: lastGaps, blurry: lastBlurry }
      target.width = Math.round(w); target.height = Math.round(h)
      canvas = target
      ctx = target.getContext('2d')!
      ident = false; textCtx = null
      cam.x = view.x; cam.y = view.y; cam.z = view.z; W = w; H = h; dpr = 1
      // The sea's colour under everything, as the page's own background is under its canvas.
      under = getComputedStyle(document.body).backgroundColor || '#8ccbff'
      try { frame(performance.now()) } finally { under = null }
      const out = { drawable: lastGaps === 0, sharp: lastGaps === 0 && lastBlurry === 0 }
      canvas = was.canvas; ctx = was.ctx; Object.assign(cam, was.cam); W = was.W; H = was.H; dpr = was.dpr
      lastStats = was.stats; lastGaps = was.gaps; lastBlurry = was.blurry
      ident = false; textCtx = null
      return out
    },
    pokeKinds: scene.pokes,
    /** Call when the engine may have more to draw (an image arrived). */
    set onLoaded(f: (() => void) | null) { onLoaded = f },
    /** Whether the last frame drew everything in view (if not all of it at its sharpest yet). */
    drawable() { return lastGaps === 0 },
    /** Whether the last frame drew everything in view at its own sharpness. */
    sharp() { return lastGaps === 0 && lastBlurry === 0 },
    /** Stop the buildings dropping in (someone has started using the map). */
    endIntro() { introAt = -1 },
    lmBox(slug: string) { return lms.get(slug)?.bb ?? null },
    /** What the last frame cost and drew, and what is loaded: for the ?perf meter and the speed check. */
    stats() {
      let loaded = 0, bytes = 0
      for (const im of imgs.values()) if (im.bm) { loaded++; bytes += im.bytes }
      return { ...lastStats, frame: frameNo, level, scale: scene.levels[level], dpr, w: canvas.width, h: canvas.height, gaps: lastGaps, blurry: lastBlurry, loaded, bytes, queued: queue.length + inflight }
    },
  }
}
export type Engine = ReturnType<typeof createEngine>
