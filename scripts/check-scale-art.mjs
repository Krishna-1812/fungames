/**
 * check-scale-art — are Scale's objects actually pictures of themselves?
 *
 * Scale used to draw every solid thing as one lit sphere. Nothing about that
 * is detectable in source: `{ m: 30, name: 'Blue whale', color: '#5a8fd4' }`
 * reads fine. It is only wrong once rendered, and it was wrong for a year.
 *
 * So this renders them, at the size and on the sky the page gives them, and
 * asks the questions that source cannot answer:
 *
 *   1. Does every object that is not one of the shader's shapes have a
 *      drawing, and does every drawing name a real object? A drawing keyed on
 *      a name that no longer exists is invisible on the page and green here
 *      unless something checks.
 *   2. Does each drawing agree with the registry about which axis `m` is?
 *      The two-axis change exists because `m` for the Eiffel Tower is a height
 *      and the old square drew it as a width. A comment saying so is worth
 *      nothing; this compares the numbers.
 *   3. Do the ids stay inside their own object? All twenty-six inline into one
 *      document. A gradient called `lit` in two of them means the second one
 *      silently wears the first one's colours.
 *   4. Does anything paint outside its own viewBox? The tile checker learned
 *      this the hard way — twenty-four stars drawn off-frame were invisible on
 *      every page load and made the rasteriser abort at one card width.
 *   5. Can you see it against the sky it appears over? The sky is a different
 *      colour at every decade, so this composites each object at the exponent
 *      where it is the subject rather than a speck.
 *   6. **Is it a picture or a blob?** This is the check the whole file is for.
 *      A lit sphere passes every other test here: it has ink, it has contrast,
 *      it is inside its box. What it does not have is internal structure, and
 *      measuring that is the difference between "there is something there" and
 *      "it is a whale".
 *   7. Are any two of them the same picture?
 *
 *   node scripts/check-scale-art.mjs [--sheet out.png] [--dbg name,name dir]
 */
import { Resvg } from '@resvg/resvg-js'
import fs from 'node:fs'
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

const { THINGS, skyAt, primeExp } = await import('../src/lib/scale-things.ts')
const { SCALE_ART, boxOf, slugOf, quotedMetres } = await import('../src/lib/scale-art.ts')

let failures = 0
const fail = (m) => {
  failures++
  console.log(`  FAIL  ${m}`)
}
const ok = (m) => console.log(`  ok    ${m}`)
const check = (c, m) => (c ? ok(m) : fail(m))

/* ---- colour ------------------------------------------------------------- */

const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
const lum = (r, g, b) => 0.2126 * lin(r / 255) + 0.7152 * lin(g / 255) + 0.0722 * lin(b / 255)
const contrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)

/**
 * oklab, because "can you see it" is the wrong question to ask with a
 * luminance ratio here.
 *
 * WCAG contrast is the right measure for text: letters are thin, they are read
 * by shape, and a hue difference at equal lightness does not help you read
 * them. An illustration is not text. The first version of the visibility test
 * below used a luminance ratio and failed the football pitch at 9% — a green
 * pitch against a pale blue sky, which is about as visible as two things can
 * be. What it was measuring was that mid-green and mid-blue sit at similar
 * lightness, which is true and has nothing to do with whether you can see the
 * pitch.
 */
const oklab = (r, g, b) => {
  const [R, G, B] = [lin(r / 255), lin(g / 255), lin(b / 255)]
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B)
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B)
  const s2 = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s2,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s2,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s2,
  ]
}
const dE = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
const hex2 = (a) => '#' + a.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')

/* ---- the viewport the page actually gives these ------------------------- */

/* Measured off the live page: the stage is inset 48px under the chrome bar,
   and `px` — pixels per metre — comes from the *smaller* viewport dimension.
   A laptop and a phone therefore disagree about how much of a wide object is
   on screen, so both are rendered. */
const VIEWS = [
  { name: 'laptop', w: 1280, h: 800 - 48 },
  { name: 'phone', w: 390, h: 780 - 48 },
]

/** Composite one object over the page's sky, exactly as the stage stacks it. */
function frame(name, view, fill = 0.4) {
  const d = SCALE_ART[name]
  const t = THINGS.find((x) => x.name === name)
  const box = boxOf(d)
  const longest = Math.max(d.wm, d.hm)
  const exp = primeExp(longest)
  const sky = skyAt(exp)

  // `px` per metre, from the page: min(innerWidth, innerHeight) / screenMetres,
  // with screenMetres set so the object's long side is `fill` of that min.
  const min = Math.min(view.w, view.h)
  const px = (min * fill) / longest
  const w = Math.max(2, Math.round(d.wm * px))
  const h = Math.max(2, Math.round(d.hm * px))

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${view.w}" height="${view.h}" ` +
    `viewBox="0 0 ${view.w} ${view.h}">` +
    `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0%" stop-color="${hex2(sky.top)}"/>` +
    `<stop offset="100%" stop-color="${hex2(sky.bot)}"/></linearGradient></defs>` +
    `<rect width="${view.w}" height="${view.h}" fill="url(#sky)"/>` +
    `<svg x="${Math.round((view.w - w) / 2)}" y="${Math.round((view.h - h) / 2)}" ` +
    `width="${w}" height="${h}" viewBox="0 0 ${box.w} ${box.h}" preserveAspectRatio="xMidYMid meet">` +
    d.draw(t.color, slugOf(name)) +
    `</svg></svg>`

  const img = new Resvg(svg, { fitTo: { mode: 'width', value: view.w } }).render()
  // The same composite with the sky taken away, so the alpha channel is the
  // object's own silhouette. Without this the only mask available is the
  // bounding rectangle, and for anything that is not a filled square — a
  // lattice tower, a whale, a strand of DNA — that is mostly sky.
  const bare = new Resvg(svg.replace(/<rect width="\d+" height="\d+" fill="url\(#sky\)"\/>/, ''), {
    fitTo: { mode: 'width', value: view.w },
  }).render()
  return {
    px: img.pixels,
    mask: bare.pixels,
    W: img.width,
    H: img.height,
    rect: { x: Math.round((view.w - w) / 2), y: Math.round((view.h - h) / 2), w, h },
    sky,
    exp,
  }
}

/** Luminance at a pixel of an opaque composite. */
const lumAt = (f, x, y) => {
  const i = (y * f.W + x) * 4
  return lum(f.px[i], f.px[i + 1], f.px[i + 2])
}

/* ---- 1. coverage -------------------------------------------------------- */

console.log('\ncoverage')
{
  const needsArt = THINGS.filter((t) => !t.kind).map((t) => t.name)
  const missing = needsArt.filter((n) => !SCALE_ART[n])
  const orphan = Object.keys(SCALE_ART).filter((n) => !THINGS.some((t) => t.name === n))
  const shaderShaped = Object.keys(SCALE_ART).filter((n) => THINGS.find((t) => t.name === n)?.kind)
  check(missing.length === 0, `every solid object has a drawing${missing.length ? ': missing ' + missing : ''}`)
  check(orphan.length === 0, `no drawing names an object that does not exist${orphan.length ? ': ' + orphan : ''}`)
  check(
    shaderShaped.length === 0,
    `no drawing shadows a shader shape${shaderShaped.length ? ': ' + shaderShaped : ''}`,
  )
  ok(`${Object.keys(SCALE_ART).length} drawings over ${THINGS.length} things`)
}

/* ---- 2. the quoted dimension -------------------------------------------- */

console.log('\nwhat `m` means')
{
  let bad = 0
  for (const [name, d] of Object.entries(SCALE_ART)) {
    const t = THINGS.find((x) => x.name === name)
    const q = quotedMetres(d)
    if (Math.abs(q - t.m) / t.m >= 1e-9) {
      fail(`${name}: registry says ${t.m}, drawing's ${d.axis} axis is ${q}`)
      bad++
      continue
    }
    // The word is free to disagree with which axis is longer — Everest is
    // quoted "tall" and is wider than it is high — but not with orientation.
    const wordOk = d.word === 'tall' ? d.axis === 'h' : d.word === 'across' ? d.wm >= d.hm : true
    if (!wordOk) {
      fail(`${name}: called "${d.word}" but measures ${d.wm.toExponential(2)} by ${d.hm.toExponential(2)}`)
      bad++
    }
  }
  check(bad === 0, `all ${Object.keys(SCALE_ART).length} drawings agree with the registry about which axis is quoted`)
}

/* ---- 3. ids ------------------------------------------------------------- */

console.log('\nids')
{
  const seen = new Map()
  let stray = 0
  let dangling = 0
  for (const [name, d] of Object.entries(SCALE_ART)) {
    const slug = slugOf(name)
    const markup = d.draw(THINGS.find((t) => t.name === name).color, slug)
    const ids = [...markup.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])
    for (const id of ids) {
      if (!id.startsWith(slug + '-')) {
        fail(`${name}: id "${id}" is not prefixed with "${slug}-"`)
        stray++
      }
      if (seen.has(id)) {
        fail(`${name}: id "${id}" is already used by ${seen.get(id)}`)
        stray++
      }
      seen.set(id, name)
    }
    for (const m of markup.matchAll(/url\(#([^)]+)\)/g)) {
      if (!ids.includes(m[1])) {
        fail(`${name}: url(#${m[1]}) points at nothing it defines`)
        dangling++
      }
    }
  }
  check(stray === 0, 'every id is unique and carries its own object’s prefix')
  check(dangling === 0, 'every url(#…) resolves inside the drawing that uses it')
  ok(`${seen.size} ids across the set`)
}

/* ---- 4. inside the box -------------------------------------------------- */

/* `artSvg` sets overflow:visible, which is deliberate — a drop shadow and a
   corona need it — so nothing clips this at render time. Which means an
   object drawn off its own frame just sits in the middle of the page on top
   of whatever else is there. */
console.log('\ninside the frame')
{
  const MARGIN = 0.14
  let over = 0
  for (const [name, d] of Object.entries(SCALE_ART)) {
    const box = boxOf(d)
    const mx = box.w * MARGIN
    const my = box.h * MARGIN
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-mx} ${-my} ${box.w + mx * 2} ${
        box.h + my * 2
      }">` +
      d.draw(THINGS.find((t) => t.name === name).color, slugOf(name)) +
      `</svg>`
    const img = new Resvg(svg, { fitTo: { mode: 'width', value: 420 } }).render()
    // `.pixels` is a getter that allocates a fresh buffer on every read, so
    // indexing it inside the scan below asks for a new copy of the whole image
    // per pixel. It does not leak slowly; it dies, with a Rust allocation
    // failure and no stack, at exactly the buffer size you were reading.
    const buf = img.pixels
    const W = img.width
    const H = img.height
    const bx = Math.round((MARGIN / (1 + MARGIN * 2)) * W)
    const by = Math.round((MARGIN / (1 + MARGIN * 2)) * H)
    let outside = 0
    let ring = 0
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (x >= bx && x < W - bx && y >= by && y < H - by) continue
        ring++
        if (buf[(y * W + x) * 4 + 3] > 24) outside++
      }
    const f = ring ? outside / ring : 0
    // A soft glow reaching a little past the frame is fine and intended; a
    // shape out there is not. 4% of the margin ring separates the two.
    if (f > 0.04) {
      fail(`${name}: ${(f * 100).toFixed(1)}% of the margin around its viewBox is painted`)
      over++
    }
  }
  check(over === 0, 'nothing is drawn outside its own viewBox')
}

/* ---- 5. visible against the sky ----------------------------------------- */

console.log('\nvisible against the sky it appears over')
{
  let bad = 0
  const rows = []
  for (const name of Object.keys(SCALE_ART)) {
    for (const view of VIEWS) {
      const f = frame(name, view)
      const skyOk = oklab(...f.sky.top.map((v, i) => (v + f.sky.bot[i]) / 2))
      // Under the object's own ink, not over its bounding box. Measuring the
      // box is the third time this exact mistake has come up on this site —
      // the tile checker made it about a text container and the icon checker
      // about a glyph — and it fails in a way that looks like a real result:
      // the Eiffel Tower scored 10% because a lattice tower's box is mostly
      // sky, not because you cannot see the tower.
      let n = 0
      let seen = 0
      let peak = 0
      for (let y = f.rect.y; y < f.rect.y + f.rect.h; y++)
        for (let x = f.rect.x; x < f.rect.x + f.rect.w; x++) {
          if (f.mask[(y * f.W + x) * 4 + 3] < 153) continue
          const i = (y * f.W + x) * 4
          const c = dE(oklab(f.px[i], f.px[i + 1], f.px[i + 2]), skyOk)
          n++
          if (c >= 0.1) seen++
          if (c > peak) peak = c
        }
      const frac = n ? seen / n : 0
      if (n < 40) {
        fail(`${name} @${view.name}: only ${n} opaque pixels — nothing is really drawn`)
        bad++
        continue
      }
      rows.push({ name, view: view.name, frac, peak })
      // 0.10 in oklab is a difference nobody has to look for; 0.30 somewhere
      // in the object is what stops a uniformly-faint drawing passing on a
      // technicality.
      if (frac < 0.6 || peak < 0.3) {
        fail(
          `${name} @${view.name}: only ${(frac * 100).toFixed(0)}% of it separates from the sky ` +
            `(peak dE ${peak.toFixed(2)}) at 10^${f.exp.toFixed(1)} m`,
        )
        bad++
      }
    }
  }
  check(bad === 0, `all ${Object.keys(SCALE_ART).length} read against their own sky, at both viewports`)
  const worst = rows.sort((a, b) => a.frac - b.frac)[0]
  ok(`faintest is ${worst.name} @${worst.view} at ${(worst.frac * 100).toFixed(0)}% separated`)

  // The control, so the bar is known to be one something can fail: the sky's
  // own colour, drawn as a disc on the sky.
  {
    const sky = skyAt(0)
    const ghost =
      `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">` +
      `<rect width="300" height="300" fill="${hex2(sky.bot)}"/>` +
      `<circle cx="150" cy="150" r="120" fill="${hex2(sky.bot.map((v) => v * 1.06))}"/></svg>`
    const img = new Resvg(ghost, { fitTo: { mode: 'width', value: 300 } }).render()
    const gp = img.pixels
    const skyOk = oklab(...sky.bot)
    let n = 0
    let seen = 0
    for (let y = 40; y < 260; y++)
      for (let x = 40; x < 260; x++) {
        const i = (y * 300 + x) * 4
        n++
        if (dE(oklab(gp[i], gp[i + 1], gp[i + 2]), skyOk) >= 0.1) seen++
      }
    check(seen / n < 0.6, `a disc 6% off the sky's own colour scores ${((seen / n) * 100).toFixed(0)}% and fails`)
  }
}

/* ---- 6. a picture, not a blob ------------------------------------------- */

/* The check this file exists for.
 *
 * A lit sphere passes everything above: it has ink, it has contrast, it is in
 * its box. What separates a drawing from a coloured ball is *internal
 * structure* — edges inside the silhouette, where one part of the object meets
 * another. A radial gradient has none: it is smooth everywhere, so every pixel
 * is within a whisker of its neighbours.
 *
 * So: at the real display size, what fraction of the object's own pixels sit
 * on a step of at least 0.04 in luminance? A sphere scores near zero however
 * strong its shading, because a ramp is not an edge. This is the one number
 * that would have failed the old page. */
console.log('\nstructure — is it a picture or a ball?')
{
  const STEP = 0.04
  const FLOOR = 0.03
  let bad = 0
  const rows = []
  for (const name of Object.keys(SCALE_ART)) {
    const f = frame(name, VIEWS[0], 0.62)
    let n = 0
    let edge = 0
    for (let y = f.rect.y + 1; y < f.rect.y + f.rect.h - 1; y++)
      for (let x = f.rect.x + 1; x < f.rect.x + f.rect.w - 1; x++) {
        if (f.mask[(y * f.W + x) * 4 + 3] < 153) continue
        const l = lumAt(f, x, y)
        n++
        const d = Math.max(
          Math.abs(l - lumAt(f, x - 1, y)),
          Math.abs(l - lumAt(f, x + 1, y)),
          Math.abs(l - lumAt(f, x, y - 1)),
          Math.abs(l - lumAt(f, x, y + 1)),
        )
        if (d >= STEP) edge++
      }
    const density = n ? edge / n : 0
    rows.push({ name, density })
    if (density < FLOOR) {
      fail(`${name}: ${(density * 100).toFixed(1)}% of it is edge — that is a shaded ball, not a drawing`)
      bad++
    }
  }
  check(bad === 0, `all ${rows.length} have internal structure at ${(FLOOR * 100).toFixed(0)}% edge or better`)
  const sorted = rows.sort((a, b) => a.density - b.density)
  ok(
    `flattest ${sorted[0].name} ${(sorted[0].density * 100).toFixed(1)}%, ` +
      `busiest ${sorted[sorted.length - 1].name} ${(sorted[sorted.length - 1].density * 100).toFixed(1)}%`,
  )

  // The control: a plain lit sphere in the same harness, so the floor above is
  // shown to be a bar something can actually fail rather than a formality.
  const ball =
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">` +
    `<rect width="400" height="400" fill="#101a2c"/>` +
    `<defs><radialGradient id="g" cx="34%" cy="28%" r="78%">` +
    `<stop offset="0%" stop-color="#a9cdf0"/><stop offset="52%" stop-color="#4d90d9"/>` +
    `<stop offset="100%" stop-color="#1d3752"/></radialGradient></defs>` +
    `<circle cx="200" cy="200" r="190" fill="url(#g)"/></svg>`
  const img = new Resvg(ball, { fitTo: { mode: 'width', value: 400 } }).render()
  const bpx = img.pixels
  let n = 0
  let edge = 0
  const L = (x, y) => {
    const i = (y * img.width + x) * 4
    return lum(bpx[i], bpx[i + 1], bpx[i + 2])
  }
  for (let y = 12; y < 388; y++)
    for (let x = 12; x < 388; x++) {
      const l = L(x, y)
      n++
      if (
        Math.max(
          Math.abs(l - L(x - 1, y)),
          Math.abs(l - L(x + 1, y)),
          Math.abs(l - L(x, y - 1)),
          Math.abs(l - L(x, y + 1)),
        ) >= STEP
      )
        edge++
    }
  const ballDensity = edge / n
  check(
    ballDensity < FLOOR,
    `the old lit sphere scores ${(ballDensity * 100).toFixed(1)}% and would fail this — the bar bites`,
  )
}

/* ---- 7. distinctness ---------------------------------------------------- */

/* Same shape as the icon checker, and for the same reason: a fixed minimum
   distance is an order statistic, so it drifts downwards as the set grows
   whether or not anything got worse. The question worth asking is whether the
   closest pair stands out from the pack. */
console.log('\ndistinctness')
{
  const N = 14
  const sig = (name) => {
    const f = frame(name, VIEWS[0], 0.62)
    const out = []
    for (let gy = 0; gy < N; gy++)
      for (let gx = 0; gx < N; gx++) {
        const x0 = f.rect.x + Math.floor((gx * f.rect.w) / N)
        const x1 = f.rect.x + Math.floor(((gx + 1) * f.rect.w) / N)
        const y0 = f.rect.y + Math.floor((gy * f.rect.h) / N)
        const y1 = f.rect.y + Math.floor(((gy + 1) * f.rect.h) / N)
        let r = 0
        let g = 0
        let b = 0
        let c = 0
        for (let y = y0; y <= Math.min(y1, f.rect.y + f.rect.h - 1); y++)
          for (let x = x0; x <= Math.min(x1, f.rect.x + f.rect.w - 1); x++) {
            const i = (y * f.W + x) * 4
            r += f.px[i]
            g += f.px[i + 1]
            b += f.px[i + 2]
            c++
          }
        out.push(r / c / 255, g / c / 255, b / c / 255)
      }
    // Aspect is part of what an object *is* here — a whale and a tower cannot
    // be confused, and pretending otherwise would only invent failures.
    const d = SCALE_ART[name]
    out.push(Math.log10(d.wm / d.hm))
    return out
  }
  const names = Object.keys(SCALE_ART)
  const sigs = Object.fromEntries(names.map((n) => [n, sig(n)]))
  const pairs = []
  for (let i = 0; i < names.length; i++)
    for (let j = i + 1; j < names.length; j++) {
      const a = sigs[names[i]]
      const b = sigs[names[j]]
      let s = 0
      for (let k = 0; k < a.length; k++) s += Math.abs(a[k] - b[k])
      pairs.push({ a: names[i], b: names[j], d: s / a.length })
    }
  pairs.sort((x, y) => x.d - y.d)
  const pack = pairs[Math.min(9, pairs.length - 1)].d
  check(
    pairs[0].d > pack * 0.62,
    `closest pair (${pairs[0].a} / ${pairs[0].b}, ${pairs[0].d.toFixed(3)}) is not an outlier ` +
      `against the tenth-closest (${pack.toFixed(3)})`,
  )
}

/* ---- 8. determinism ----------------------------------------------------- */

console.log('\ndeterminism')
{
  let drift = 0
  for (const [name, d] of Object.entries(SCALE_ART)) {
    const c = THINGS.find((t) => t.name === name).color
    if (d.draw(c, slugOf(name)) !== d.draw(c, slugOf(name))) {
      fail(`${name} draws differently twice`)
      drift++
    }
  }
  check(drift === 0, 'every drawing is the same twice — no Math.random in the scatter')
}

/* ---- 9. no emoji -------------------------------------------------------- */

console.log('\nno emoji')
{
  const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u
  for (const f of ['src/lib/scale-art.ts', 'src/lib/scale-things.ts', 'src/pages/scale.astro']) {
    const body = fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8')
    check(!EMOJI.test(body), `${f} has no emoji left in it`)
  }
}

/* ---- output ------------------------------------------------------------- */

const args = process.argv.slice(2)
const sheetAt = args.indexOf('--sheet')
if (sheetAt >= 0) {
  const COLS = 5
  const CELL = 300
  const names = Object.keys(SCALE_ART)
  const rows = Math.ceil(names.length / COLS)
  let body = ''
  names.forEach((name, i) => {
    const d = SCALE_ART[name]
    const t = THINGS.find((x) => x.name === name)
    const box = boxOf(d)
    const sky = skyAt(primeExp(Math.max(d.wm, d.hm)))
    const x = (i % COLS) * CELL
    const y = Math.floor(i / COLS) * CELL
    const s = Math.min((CELL - 40) / box.w, (CELL - 60) / box.h)
    const w = box.w * s
    const h = box.h * s
    body +=
      `<g transform="translate(${x} ${y})">` +
      `<rect width="${CELL}" height="${CELL}" fill="${hex2(sky.bot)}"/>` +
      `<svg x="${(CELL - w) / 2}" y="${(CELL - 40 - h) / 2}" width="${w}" height="${h}" ` +
      `viewBox="0 0 ${box.w} ${box.h}">${d.draw(t.color, slugOf(name) + '-s')}</svg>` +
      `<text x="${CELL / 2}" y="${CELL - 14}" fill="#fff" font-size="13" font-family="sans-serif" ` +
      `text-anchor="middle" opacity="0.85">${name.replace(/&/g, '&amp;')}</text></g>`
  })
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${COLS * CELL}" height="${rows * CELL}" ` +
    `viewBox="0 0 ${COLS * CELL} ${rows * CELL}">` +
    `<rect width="${COLS * CELL}" height="${rows * CELL}" fill="#0a0a12"/>${body}</svg>`
  fs.writeFileSync(
    args[sheetAt + 1],
    new Resvg(svg, { fitTo: { mode: 'width', value: COLS * CELL } }).render().asPng(),
  )
  console.log(`\nwrote ${args[sheetAt + 1]}`)
}

const dbgAt = args.indexOf('--dbg')
if (dbgAt >= 0) {
  const dir = args[dbgAt + 2]
  fs.mkdirSync(dir, { recursive: true })
  for (const name of args[dbgAt + 1].split(',')) {
    for (const view of VIEWS) {
      // Nearly filling the viewport rather than the 40% the tests use: this
      // mode is for looking at a drawing, and the measurements above have
      // nothing to say about whether it is the right picture.
      const f = frame(name, view, 0.92)
      // Re-rendered straight to png rather than rebuilt from the buffer.
      const d = SCALE_ART[name]
      const t = THINGS.find((x) => x.name === name)
      const box = boxOf(d)
      const sky = f.sky
      const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" width="${view.w}" height="${view.h}" ` +
        `viewBox="0 0 ${view.w} ${view.h}">` +
        `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0%" stop-color="${hex2(sky.top)}"/>` +
        `<stop offset="100%" stop-color="${hex2(sky.bot)}"/></linearGradient></defs>` +
        `<rect width="${view.w}" height="${view.h}" fill="url(#sky)"/>` +
        `<svg x="${f.rect.x}" y="${f.rect.y}" width="${f.rect.w}" height="${f.rect.h}" ` +
        `viewBox="0 0 ${box.w} ${box.h}">${d.draw(t.color, slugOf(name))}</svg></svg>`
      fs.writeFileSync(
        `${dir}/${slugOf(name)}-${view.name}.png`,
        new Resvg(svg, { fitTo: { mode: 'width', value: view.w } }).render().asPng(),
      )
    }
  }
  console.log(`\nwrote debug frames to ${dir}`)
}

console.log(failures ? `\n${failures} failed.` : '\nAll scale-art checks passed.')
process.exitCode = failures ? 1 : 0
