/**
 * Checks Internet Artifacts' photographs (src/lib/internet-artifacts-art.ts,
 * baked by scripts/bake-artifacts.mjs into public/internet-artifacts/):
 *
 *   1. every moment has a photograph and every photograph a moment, each
 *      with its own file name and a caption in the site's typography;
 *   2. every photograph has its model, and both sizes are there, square,
 *      with alpha, and nothing in the folder is left over from a model
 *      that has gone;
 *   3. each is cut out cleanly: its border is fully transparent (nothing
 *      cropped, the shadow let go before the edge), the object fills a fair
 *      part of the frame without crowding it, and it reads on the page's
 *      dark skies (its highlights are not lost in them);
 *   4. the folder is on the deploy allowlist.
 */
import sharp from 'sharp'
import fs from 'node:fs'
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

const { MARKERS } = await import('../src/data/internet-artifacts.ts')
const { PHOTOS } = await import('../src/lib/internet-artifacts-art.ts')

let failed = 0
const fail = (m) => { failed++; console.log('  FAIL ' + m) }
const ok = (m) => console.log('  ok   ' + m)
const root = new URL('../', import.meta.url)
const at = (p) => new URL(p, root)

/* ------------------------------------------------------------------------ */
console.log('\nEvery moment has its photograph')
/* ------------------------------------------------------------------------ */
{
  const titles = MARKERS.map((m) => m.title)
  const missing = titles.filter((t) => !PHOTOS[t])
  const extra = Object.keys(PHOTOS).filter((t) => !titles.includes(t))
  if (missing.length) fail('no photograph for: ' + missing.join(' | '))
  if (extra.length) fail('a photograph for no moment (a title that changed?): ' + extra.join(' | '))
  if (!missing.length && !extra.length) ok(`${titles.length} moments, ${titles.length} photographs`)
  const slugs = Object.values(PHOTOS).map((p) => p.slug)
  const dup = slugs.filter((s, i) => slugs.indexOf(s) !== i)
  if (dup.length) fail('two moments share a photograph: ' + dup.join(', '))
  else ok('each photograph is its own')
  const bad = Object.values(PHOTOS).filter((p) => /['"]/.test(p.caption) || !p.caption.trim() || p.caption.length > 90)
  if (bad.length) fail('captions need curly quotes and under 90 characters: ' + bad.map((p) => p.slug).join(', '))
  else ok('captions are short and use curly quotes')
}

/* ------------------------------------------------------------------------ */
console.log('\nThe files')
/* ------------------------------------------------------------------------ */
const slugs = Object.values(PHOTOS).map((p) => p.slug)
const present = []
{
  for (const s of slugs) {
    if (!fs.existsSync(at(`scripts/artifact-bake/${s}.glsl`))) fail(`${s}: no model, scripts/artifact-bake/${s}.glsl`)
    let good = true
    for (const [suffix, size] of [['', 960], ['-s', 480]]) {
      const f = at(`public/internet-artifacts/${s}${suffix}.webp`)
      if (!fs.existsSync(f)) { fail(`${s}${suffix}.webp is missing: node scripts/bake-artifacts.mjs ${s}`); good = false; continue }
      const m = await sharp(fs.readFileSync(f)).metadata()
      if (m.width !== size || m.height !== size) { fail(`${s}${suffix}.webp is ${m.width}x${m.height}, not ${size} square`); good = false }
      if (!m.hasAlpha) { fail(`${s}${suffix}.webp has no alpha`); good = false }
    }
    if (good) present.push(s)
  }
  ok(`${present.length} of ${slugs.length} photographs there, at 960 and 480, with alpha`)
  const leftover = fs.readdirSync(at('public/internet-artifacts/')).filter((f) => !slugs.includes(f.replace(/(-s)?\.webp$/, '')))
  if (leftover.length) fail('files no photograph uses: ' + leftover.join(', '))
  else ok('nothing left over in public/internet-artifacts/')
  const orphan = fs.readdirSync(at('scripts/artifact-bake/')).filter((f) => f.endsWith('.svg') && !fs.existsSync(at('scripts/artifact-bake/' + f.replace(/\.svg$/, '.glsl'))))
  if (orphan.length) fail('a print with no model: ' + orphan.join(', '))
}

/* ------------------------------------------------------------------------ */
console.log('\nEach is cut out cleanly')
/* ------------------------------------------------------------------------ */
{
  const lum = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  for (const s of present) {
    const { data, info } = await sharp(fs.readFileSync(at(`public/internet-artifacts/${s}.webp`))).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const W = info.width, H = info.height, C = info.channels
    let edge = 0, solid = 0, x0 = W, x1 = 0, y0 = H, y1 = 0
    const lums = []
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * C, a = data[i + 3]
      if ((x < 3 || y < 3 || x >= W - 3 || y >= H - 3) && a > 6) edge++
      if (a > 230) {
        solid++
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
        if ((x + y) % 3 === 0) lums.push(lum(data[i], data[i + 1], data[i + 2]))
      }
    }
    const share = solid / (W * H)
    const span = Math.max((x1 - x0) / W, (y1 - y0) / H)
    const margin = Math.min(x0, y0, W - 1 - x1, H - 1 - y1) / W
    lums.sort((a, b) => a - b)
    const p90 = lums.length ? lums[Math.floor(lums.length * 0.99)] : 0
    const why = []
    if (edge) why.push(`${edge} border pixels are not transparent (cropped, or the shadow reaches the edge)`)
    // A thin thing (a pen) covers little of a frame it spans; that is fine.
    if (share < (span > 0.55 ? 0.045 : 0.08)) why.push(`the object is only ${(share * 100).toFixed(1)}% of the frame`)
    if (span < 0.42) why.push(`the object spans only ${(span * 100).toFixed(0)}% of the frame`)
    if (margin < 0.025) why.push(`the object comes within ${(margin * 100).toFixed(1)}% of the edge`)
    if (p90 < 0.32) why.push(`too dark to read on the page: no highlights (99th percentile ${p90.toFixed(2)})`)
    if (why.length) fail(`${s}: ` + why.join('; '))
    else ok(`${s.padEnd(15)} ${(share * 100).toFixed(0).padStart(2)}% of the frame, spans ${(span * 100).toFixed(0)}%, highlights ${p90.toFixed(2)}`)
  }
}

/* ------------------------------------------------------------------------ */
console.log('\nDeploy')
/* ------------------------------------------------------------------------ */
{
  const allow = fs.readFileSync(new URL('./check-public-boundary.mjs', import.meta.url), 'utf8')
  if (!allow.includes("'internet-artifacts'")) fail('public/internet-artifacts is not on the deploy allowlist')
  else ok('public/internet-artifacts is on the deploy allowlist')
}

console.log(failed ? '\n' + failed + ' failed.' : '\nAll good.')
process.exit(failed ? 1 : 0)
