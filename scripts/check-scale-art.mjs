/**
 * check-scale-art — are Scale's pictures the pictures the page thinks they are?
 *
 * Every solid thing in Scale is a 3D model, photographed by `bake-scale.mjs`
 * into `public/scale/`. The page never sees the model; it is handed a file
 * name and a size in metres. So everything that can go wrong goes wrong
 * silently: a renamed object keeps an orphaned picture, a model re-framed
 * without its entry being updated is stretched by the page to fit the old
 * proportions, a model that outgrew its frame is cropped at the edge, and a
 * bake that failed leaves a transparent rectangle that loads without error.
 *
 *   1. Does every solid thing have a picture, and every picture a thing?
 *   2. Does each picture agree with the registry about which axis `m` is?
 *   3. Is there a model, and both sizes of photograph, for each?
 *   4. Are the photographs the shape the registry says — so a metre across is
 *      a metre up — and the size the page expects?
 *   5. Is the object inside its frame, and is there an object in the frame?
 *   6. Is it a picture rather than a blob, and is each a different picture?
 *   7. Does anything stand on top of anything else, in a wide window or a
 *      tall one?
 *   8. Is the whole set still small enough to send to a phone?
 *
 *   node scripts/check-scale-art.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { register } from 'node:module'
import sharp from 'sharp'
register('./resolve-ts.mjs', import.meta.url)

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const { THINGS } = await import('../src/lib/scale-things.ts')
const { SCALE_ART, slugOf, quotedMetres, PAD } = await import('../src/lib/scale-art.ts')
const { layout, NEAR } = await import('../src/lib/scale-layout.ts')

let failures = 0
const fail = (m) => { failures++; console.log(`  FAIL  ${m}`) }
const ok = (m) => console.log(`  ok    ${m}`)
const check = (c, m) => (c ? ok(m) : fail(m))

/* ---- 1, 2: the two registries ------------------------------------------ */
console.log('\nregistry')
const solid = THINGS.filter((t) => !t.kind)
const missing = solid.filter((t) => !SCALE_ART[t.name]).map((t) => t.name)
const orphans = Object.keys(SCALE_ART).filter((n) => !solid.some((t) => t.name === n))
check(!missing.length, `every solid thing has a picture${missing.length ? ' — not: ' + missing.join(', ') : ''}`)
check(!orphans.length, `every picture names a solid thing${orphans.length ? ' — not: ' + orphans.join(', ') : ''}`)
const disagree = solid.filter((t) => SCALE_ART[t.name] && Math.abs(quotedMetres(SCALE_ART[t.name]) / t.m - 1) > 1e-9).map((t) => t.name)
check(!disagree.length, `each picture's quoted axis is the registry's m${disagree.length ? ' — not: ' + disagree.join(', ') : ''}`)
const sorted = THINGS.every((t, i) => i === 0 || t.m >= THINGS[i - 1].m)
check(sorted, 'things are in order of size, which the layout relies on')

/* ---- 3-6: the photographs ---------------------------------------------- */
console.log('\nphotographs')
const dir = path.join(root, 'public', 'scale')
const thumbs = []
let bytesFull = 0, bytesSmall = 0
for (const [name, a] of Object.entries(SCALE_ART)) {
  const slug = slugOf(name)
  const model = path.join(root, 'scripts', 'scale-bake', 'models', slug + '.glsl')
  const full = path.join(dir, slug + '.webp'), small = path.join(dir, slug + '-s.webp')
  if (!fs.existsSync(model)) { fail(`${name}: no model ${slug}.glsl`); continue }
  if (!fs.existsSync(full) || !fs.existsSync(small)) { fail(`${name}: not baked — run node scripts/bake-scale.mjs ${slug}`); continue }
  bytesFull += fs.statSync(full).size
  bytesSmall += fs.statSync(small).size
  const problems = []
  const meta = await sharp(full).metadata(), metaS = await sharp(small).metadata()
  // The frame is the object's box plus the margin on every side.
  const want = a.wm / a.hm
  const got = meta.width / meta.height
  if (Math.abs(got / want - 1) > 0.012) problems.push(`is ${got.toFixed(3)} wide for its height, registry says ${want.toFixed(3)}`)
  if (Math.max(meta.width, meta.height) !== 2048) problems.push(`long side is ${Math.max(meta.width, meta.height)}, not 2048`)
  if (Math.abs(metaS.width * 2 - meta.width) > 1) problems.push('the small one is not half the big one')
  if (!meta.hasAlpha) problems.push('has no transparency')

  const W = 256, H = Math.max(8, Math.round(256 / got))
  const px = await sharp(full).resize(W, H, { fit: 'fill' }).ensureAlpha().raw().toBuffer()
  let solidPx = 0, edge = 0, edgeN = 0, sum = 0, sum2 = 0
  const lum = new Float32Array(W * H)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4, al = px[i + 3]
    const l = (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255
    lum[y * W + x] = al > 128 ? l : -1
    if (al > 128) { solidPx++; sum += l; sum2 += l * l }
    if (x === 0 || y === 0 || x === W - 1 || y === H - 1) { edgeN++; if (al > 60) edge++ }
  }
  const cover = solidPx / (W * H)
  if (cover < 0.05) problems.push(`only ${(cover * 100).toFixed(1)}% of the frame has anything in it`)
  if (edge / edgeN > 0.03) problems.push(`${((edge / edgeN) * 100).toFixed(0)}% of the frame's edge is painted — the model is cropped`)
  // The margin is there to be empty: what is opaque should fit the box.
  const sd = Math.sqrt(Math.max(0, sum2 / solidPx - (sum / solidPx) ** 2))
  if (sd < 0.035) problems.push(`is nearly one flat tone (deviation ${sd.toFixed(3)})`)
  // Internal structure: steps in tone between neighbours inside the object.
  let steps = 0, pairs = 0
  for (let y = 0; y < H - 1; y++) for (let x = 0; x < W - 1; x++) {
    const c = lum[y * W + x], r = lum[y * W + x + 1], d = lum[(y + 1) * W + x]
    if (c < 0 || r < 0 || d < 0) continue
    pairs++
    if (Math.abs(c - r) + Math.abs(c - d) > 0.05) steps++
  }
  if (pairs && steps / pairs < 0.012) problems.push(`has no detail inside its outline (${((steps / pairs) * 100).toFixed(2)}% of it is edges)`)
  thumbs.push({ name, t: await sharp(full).resize(24, 24, { fit: 'fill' }).ensureAlpha().raw().toBuffer() })
  check(!problems.length, `${name}${problems.length ? ' — ' + problems.join('; ') : ` — ${meta.width}x${meta.height}, ${(cover * 100).toFixed(0)}% filled`}`)
}

console.log('\ndistinct')
let twins = 0
for (let i = 0; i < thumbs.length; i++) for (let j = i + 1; j < thumbs.length; j++) {
  let d = 0
  for (let k = 0; k < thumbs[i].t.length; k++) d += Math.abs(thumbs[i].t[k] - thumbs[j].t[k])
  d /= thumbs[i].t.length * 255
  if (d < 0.035) { twins++; fail(`${thumbs[i].name} and ${thumbs[j].name} are nearly the same picture (${d.toFixed(3)})`) }
}
if (!twins) ok(`no two of the ${thumbs.length} are the same picture`)

/* ---- 7: where they stand ------------------------------------------------ */
console.log('\nlayout')
const boxes = THINGS.map((t) => {
  const a = SCALE_ART[t.name]
  return { name: t.name, w: a ? a.wm : t.m, h: a ? a.hm : t.m, centred: t.at === 'origin', open: !!t.kind }
})
for (const [label, portrait] of [['wide', false], ['tall', true]]) {
  const place = layout(boxes, portrait)
  const clashes = []
  for (let i = 0; i < boxes.length; i++) for (let j = 0; j < i; j++) {
    const a = boxes[i], b = boxes[j]
    if (a.open || b.open) continue
    const la = Math.max(a.w, a.h), lb = Math.max(b.w, b.h)
    if (Math.min(la, lb) * NEAR < Math.max(la, lb)) continue
    const dx = Math.abs(place[i].x - place[j].x) - (a.w + b.w) / 2
    const dy = Math.abs(place[i].y - place[j].y) - (a.h + b.h) / 2
    if (dx < 0 && dy < 0) clashes.push(`${b.name} / ${a.name}`)
  }
  check(!clashes.length, `in a ${label} window nothing stands on anything of its own size${clashes.length ? ' — ' + clashes.join(', ') : ''}`)
  // Nothing should be so far out that it never comes into the frame while it
  // is a readable size: its near edge within its own length of the origin.
  // (Unless it is standing clear of something solid on the origin: Jupiter,
  // of the Sun.)
  const sunward = (i) => Math.max(0, ...boxes.slice(i + 1).filter((o) => o.centred && !o.open && Math.max(o.w, o.h) < Math.max(boxes[i].w, boxes[i].h) * NEAR).map((o) => Math.max(o.w, o.h) * 0.6))
  const lost = boxes.filter((b, i) => !b.centred && Math.max(Math.abs(place[i].x) - b.w / 2, Math.abs(place[i].y) - b.h / 2) > Math.max(1.2 * Math.max(b.w, b.h), sunward(i))).map((b) => b.name)
  check(!lost.length, `in a ${label} window everything stays near the origin${lost.length ? ' — not: ' + lost.join(', ') : ''}`)
}

/* ---- 8: weight ---------------------------------------------------------- */
console.log('\nweight')
check(bytesSmall < 3.2e6, `the phone set is ${(bytesSmall / 1e6).toFixed(2)} MB (limit 3.2)`)
check(bytesFull < 7e6, `the desktop set is ${(bytesFull / 1e6).toFixed(2)} MB (limit 7)`)
check(Math.abs(PAD - 0.04) < 1e-9, 'the margin is the one the photographs were framed with')

console.log(failures ? `\n${failures} failed` : '\nall passed')
process.exit(failures ? 1 : 0)
