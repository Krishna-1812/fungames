/**
 * check-progress-dial — is the instrument the page points at the instrument
 * the shader draws, and can you read the number in the middle of it?
 *
 * Three separate worries.
 *
 * **One: the pointer and the shader must agree.** The channels are milled by
 * the fragment shader from `DIAL` and hit-tested in JavaScript by `ringAt()`
 * from the same constants, and if those two ever drift, hovering lights up a
 * different ring from the one under the cursor. That is a bug you can stare
 * straight at without seeing, because both halves look plausible. So the
 * radius is walked in fine steps and every point is asked which ring it is in,
 * and the answer has to match the geometry `ring()` reports.
 *
 * **Two: fifteen channels have to fit.** The band is 3% of the radius, and a
 * dial on a phone is 346 pixels wide. Below about three pixels a channel stops
 * being a channel and the whole picture becomes a gradient, so the widths are
 * computed at the sizes the CSS can actually produce rather than admired at
 * 880 pixels on a desktop.
 *
 * **Three: the readout.** The aperture carries the only large number on the
 * page, and it sits on a surface a shader paints. `APERTURE_MAX_LUM` is what
 * makes that safe, and this checks the cap is actually sufficient — not by
 * restating it, but by pushing it through the same transfer curve the shader
 * uses, decoding it with the real sRGB curve the way a browser would, and
 * measuring the contrast against every colour the page prints in there. The
 * two curves disagree at this end, and the disagreement is the whole reason
 * the constant is not simply the WCAG number.
 *
 *   node scripts/check-progress-dial.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

const { DIAL, APERTURE_MAX_LUM, LUME_COLD, LUME_HOT, ring, ringAt, lumeCss } =
  await import('../src/lib/progress-geom.ts')
const { UNITS, MAX_UNITS, read } = await import('../src/lib/progress-time.ts')

/* The shader itself is read rather than imported: it pulls in ./gl, which
   Node's TypeScript loader will not parse. That is the whole reason the
   geometry above lives in its own file — see the note at the top of it. */
const shader = readFileSync(new URL('../src/lib/progress-dial.ts', import.meta.url), 'utf8')

const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
const contrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
const hexLum = (h) => {
  const n = h.length === 4
    ? [...h.slice(1)].map((c) => parseInt(c + c, 16))
    : [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  return lum(n[0] / 255, n[1] / 255, n[2] / 255)
}

/* -------------------------------------------------------------------------- */
/* The dial is a dial                                                         */
/* -------------------------------------------------------------------------- */

assert.ok(DIAL.aperR < DIAL.trackIn, 'the aperture is inside the innermost channel')
assert.ok(DIAL.trackIn < DIAL.trackOut, 'the track band has a width')
assert.ok(DIAL.trackOut < DIAL.bezelIn, 'the outermost channel is inside the bezel')
assert.ok(DIAL.bezelIn < DIAL.caseR, 'the bezel has a width')
assert.ok(DIAL.caseR <= 1, 'the case fits in its own canvas')
assert.ok(DIAL.groove > 0 && DIAL.groove < 1, 'a band is part channel and part rib')

/* The bezel has to be wide enough for the numerals stamped into it. They are
   10px, positioned by CSS at the middle of the bezel, and at the first pass's
   width they landed eight pixels from the rim on top of the knurling.
   Measured at the *smallest* dial the CSS can produce, which is the case that
   can actually fail — the first version of this asserted it at 700px, where
   the bezel is 35px and nothing is in danger. */
const bezelPx = (DIAL.caseR - DIAL.bezelIn) * (346 / 2)
assert.ok(bezelPx >= 14,
  `bezel is ${bezelPx.toFixed(1)}px on a phone — a 10px numeral will not sit in it`)

/* -------------------------------------------------------------------------- */
/* Rings, and the hit test that has to find them                              */
/* -------------------------------------------------------------------------- */

// Fifteen today; fourteen from 2038, when the 32-bit row expires. Both layouts
// have to work, because the second one arrives without anybody editing a file.
for (const n of [UNITS.length, UNITS.length - 1]) {
  const rs = Array.from({ length: n }, (_, i) => ring(n, i))

  for (let i = 0; i < n; i++) {
    const g = rs[i]
    assert.ok(g.b0 >= DIAL.trackIn - 1e-9 && g.b1 <= DIAL.trackOut + 1e-9,
      `n=${n} ring ${i} outside the track band`)
    assert.ok(g.r0 > g.b0 && g.r1 < g.b1, `n=${n} ring ${i} has no rib around it`)
    assert.ok(g.r1 > g.r0, `n=${n} ring ${i} channel has no width`)
    assert.ok(g.mid > g.r0 && g.mid < g.r1, `n=${n} ring ${i} mid is not in its channel`)
    // Outward-in: ring 0 is the fastest unit and sits at the rim.
    if (i > 0) assert.ok(g.b1 <= rs[i - 1].b0 + 1e-9, `n=${n} ring ${i} overlaps ${i - 1}`)
  }
  assert.ok(Math.abs(rs[0].b1 - DIAL.trackOut) < 1e-9, `n=${n} first ring is not at the rim`)
  assert.ok(Math.abs(rs[n - 1].b0 - DIAL.trackIn) < 1e-9, `n=${n} last ring leaves a gap`)

  /* Walk the radius. Every point is either in exactly the ring the geometry
     says, or on a rib, and the answer is the same at every angle. */
  let inChannel = 0, onRib = 0
  for (let r = DIAL.trackIn; r <= DIAL.trackOut; r += 0.00025) {
    const truth = rs.findIndex((g) => r >= g.r0 && r <= g.r1)
    for (const a of [0, 0.7, 1.9, 3.0, 4.4, 5.8]) {
      const got = ringAt(r * Math.sin(a), r * Math.cos(a), n)
      assert.equal(got, truth, `n=${n} r=${r.toFixed(5)} a=${a}: got ${got}, want ${truth}`)
    }
    truth >= 0 ? inChannel++ : onRib++
  }
  // Sanity on the walk itself: it must have found both kinds of ground.
  assert.ok(inChannel > 0 && onRib > 0, `n=${n} the walk never left the channels`)
  const share = inChannel / (inChannel + onRib)
  assert.ok(Math.abs(share - DIAL.groove) < 0.02,
    `n=${n} channels cover ${(share * 100).toFixed(1)}% of the band, not ${DIAL.groove * 100}%`)

  // Everything that is not a channel says so.
  for (const r of [0, 0.1, DIAL.aperR, DIAL.trackIn - 0.001, DIAL.trackOut + 0.001,
    DIAL.bezelIn, DIAL.caseR, 0.99, 4]) {
    assert.equal(ringAt(0, r, n), -1, `r=${r} is not in a channel`)
    assert.equal(ringAt(r, 0, n), -1, `r=${r} is not in a channel`)
  }
  assert.equal(ringAt(0, 0, n), -1, 'the centre of the dial is not a channel')
}

/* -------------------------------------------------------------------------- */
/* Fifteen channels have to fit on a phone                                    */
/* -------------------------------------------------------------------------- */

/* The widths the CSS can produce. 346 is a 390px phone, less the wrap's 22px
   of padding either side; 880 is the desktop cap. A channel below ~3 CSS
   pixels stops reading as a cut and the dial turns into a gradient — this is a
   threshold for how it *looks*, not for how easily it is tapped. Tapping is
   what the register is for: those rows are full-width buttons and they carry
   every value the dial does. */
const page = readFileSync(new URL('../src/pages/progress.astro', import.meta.url), 'utf8')

/* Read out of the page rather than assumed. The readout is sized in `cqw` —
   hundredths of the dial's own width — and the chord factor is in the
   aperture's width rule; both are the numbers this check is actually about. */
const cqw = Number((page.match(/\.ap-pct[^{]*\{[^}]*font-size:\s*([\d.]+)cqw/) ?? [])[1])
const chord = Number((page.match(/width:\s*calc\(var\(--aper\)\s*\*\s*([\d.]+)\s*\*\s*100%\)/) ?? [])[1])
assert.ok(Number.isFinite(cqw) && Number.isFinite(chord),
  'could not read the aperture type size out of the page')

for (const [where_, w] of [['phone', 346], ['desktop', 880]]) {
  const half = w / 2
  const n = UNITS.length
  const g = ring(n, 0)
  const channel = (g.r1 - g.r0) * half
  const rib = (g.b1 - g.b0) * half - channel
  assert.ok(channel >= 3.0, `${where_}: channel is ${channel.toFixed(2)}px`)
  assert.ok(rib >= 1.5, `${where_}: rib is ${rib.toFixed(2)}px`)
  // And the readout has to fit the widest number the page can ever print.
  const aperture = DIAL.aperR * chord * w
  const widest = '100.0000%'.length * (w * cqw / 100) * 0.6   // IBM Plex Mono advance
  assert.ok(aperture >= widest,
    `${where_}: aperture is ${aperture.toFixed(0)}px, widest readout needs ${widest.toFixed(0)}px`)
}

/* -------------------------------------------------------------------------- */
/* The readout has to be readable                                             */
/* -------------------------------------------------------------------------- */

/* Every colour the page prints inside the aperture, read out of the page
   itself rather than typed in again here — a checker that keeps its own copy
   of the palette stops being a check the moment somebody edits the CSS. */
// (the page source is read once, above)
const vars = Object.fromEntries(
  [...page.matchAll(/--(ink\d?):\s*(#[0-9a-f]{3,8})/gi)].map((m) => ['--' + m[1], m[2]]))
const apRules = [...page.matchAll(/\.ap-[a-z]+[^{]*\{([^}]*)\}/gi)].map((m) => m[1])
assert.ok(apRules.length >= 2, 'found no aperture rules to check')

const inks = []
for (const body of apRules) {
  const m = body.match(/(?:^|[;{\s])color:\s*([^;]+);/)
  if (!m) continue
  const raw = m[1].trim()
  const hex = raw.startsWith('var(') ? vars[raw.slice(4, -1).trim()] : raw
  assert.ok(hex && hex.startsWith('#'), `aperture colour ${raw} did not resolve to a hex`)
  inks.push(hex)
}
assert.ok(inks.length >= 2, `expected two aperture inks, found ${inks.length}`)

/**
 * The brightest ground the cap permits, as a browser would measure it.
 *
 * The shader caps *luminance* after the tonemap and then sends each channel
 * through pow(1/2.2). A grey at the cap is the easy case; a saturated colour
 * at the same luminance comes out brighter once decoded, because pow is
 * concave and lifts the small channels more than it flattens the large one.
 * So rather than assume grey, this sweeps hues, caps each to the limit, and
 * takes the worst one.
 */
let worst = 0
for (let i = 0; i < 360; i++) {
  const h = (i / 360) * 6
  const seg = Math.floor(h) % 6, ff = h - Math.floor(h)
  const q = 1 - ff
  const rgb = [[1, ff, 0], [q, 1, 0], [0, 1, ff], [0, q, 1], [ff, 0, 1], [1, 0, q]][seg]
  for (const sat of [0, 0.4, 0.75, 1]) {
    const c = rgb.map((v) => v * sat + (1 - sat))
    const l = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
    if (l <= 1e-6) continue
    const capped = c.map((v) => (v * APERTURE_MAX_LUM) / l)     // luminance-scaled, as the shader does
    if (capped.some((v) => v > 1)) continue
    const shown = capped.map((v) => Math.pow(v, 1 / 2.2))       // the shader's toSRGB
    worst = Math.max(worst, lum(shown[0], shown[1], shown[2]))  // decoded properly
  }
}

for (const ink of inks) {
  const c = contrast(hexLum(ink), worst)
  assert.ok(c >= 4.5,
    `aperture ink ${ink} is ${c.toFixed(2)}:1 against the capped ground (L=${worst.toFixed(4)})`)
}

/* -------------------------------------------------------------------------- */
/* The lume, which the dial and the register both paint from                  */
/* -------------------------------------------------------------------------- */

assert.ok(LUME_HOT.every((v, i) => v > LUME_COLD[i]), 'hot is brighter than cold on every channel')
for (const s of [lumeCss(0), lumeCss(0.5), lumeCss(1), lumeCss(1, 0.3)]) {
  assert.match(s, /^rgb\(\d{1,3} \d{1,3} \d{1,3}\)$/, `bad css: ${s}`)
}
const rgbOf = (s) => s.match(/(\d+) (\d+) (\d+)/).slice(1, 4).map(Number)

// Monotone: a faster ring is never painted darker than a slower one.
let prev = -1
for (let r = 0; r <= 1.0001; r += 0.02) {
  const [R, G, B] = rgbOf(lumeCss(r))
  const L = lum(R / 255, G / 255, B / 255)
  assert.ok(L >= prev - 1e-9, `lumeCss is not monotone at ${r.toFixed(2)}`)
  prev = L
}

/* The two ends have to be tellable apart at a glance. Measured as channel
   distance rather than as a contrast ratio: contrast is a luminance test and
   would score a violet and a pink of the same brightness as identical, which
   is precisely the failure the old thirteen-identical-bars version had and
   precisely the thing this ramp exists to avoid. */
const cold = rgbOf(lumeCss(0)), hot = rgbOf(lumeCss(1))
const spread = cold.reduce((a, c, i) => a + Math.abs(c - hot[i]), 0)
assert.ok(spread >= 150,
  `the slow end ${cold} and the fast end ${hot} are ${spread}/765 apart — too close to read`)
// And they differ in brightness too, so the ramp survives a greyscale screen.
assert.ok(contrast(lum(...hot.map((v) => v / 255)), lum(...cold.map((v) => v / 255))) >= 2.5,
  'the ramp is hue-only and vanishes in greyscale')

/* Every real unit's colour, so the register cannot silently go monochrome.
   One collision is allowed and only one: a lunation and a calendar month are
   the same length to within a percent, so they are the same rate and honestly
   the same colour. That is the same exception the ladder makes, for the same
   reason, and it is not licence for a third.

   Checked at four fixed dates rather than at `new Date()`, because whether
   those two collide at all depends on the month: in February the calendar
   month is the shorter of the pair and they come out distinct. A checker whose
   answer changes with the day it is run is not a checker. */
for (const when of ['2026-02-14', '2026-03-14', '2026-06-14', '2026-12-14']) {
  const d = new Date(when + 'T12:00:00Z')
  const byColour = new Map()
  for (const u of UNITS.filter((x) => !x.fixed)) {
    const c = lumeCss(read(u, d).rate)
    byColour.set(c, [...(byColour.get(c) ?? []), u.id])
  }
  for (const [c, group] of byColour) {
    if (group.length === 1) continue
    assert.deepEqual(group.sort(), ['lunation', 'month'],
      `${when}: ${group.join(' and ')} are both ${c}`)
  }
}

/* The register prints the lit row's index number in that ring's own colour,
   and a colour chosen to look right as a 4px rule is not automatically legible
   as 11px type. `--lume-lit` is the lifted version; every unit's has to clear
   4.5:1 on the page, including the slowest, whose unlifted lume is 3.33:1. */
const pageBg = page.match(/\.progress-body\s*\{[^}]*background:\s*(#[0-9a-f]{3,8})/i)
assert.ok(pageBg, 'could not find the page background to measure against')
const bgL = hexLum(pageBg[1])
const gainM = page.match(/setProperty\('--lume-lit',\s*lumeCss\(rate,\s*([\d.]+)\)\)/)
assert.ok(gainM, 'could not read the --lume-lit gain out of the page')
const gain = Number(gainM[1])
for (const d of [new Date('2026-02-14T12:00:00Z'), new Date('2026-08-14T12:00:00Z')]) {
  for (const u of UNITS) {
    const [R, G, B] = rgbOf(lumeCss(read(u, d).rate, gain))
    const c = contrast(lum(R / 255, G / 255, B / 255), bgL)
    assert.ok(c >= 4.5, `${u.id}: lit index is ${c.toFixed(2)}:1 on ${pageBg[1]}`)
  }
}

/* -------------------------------------------------------------------------- */
/* The shader got the constants                                               */
/* -------------------------------------------------------------------------- */

/* Each dimension has to arrive by name. Checking for the *number* would pass
   just as happily on a hardcoded copy, which is the failure this is for: two
   plausible-looking statements of where a channel is, silently diverging. */
for (const name of Object.keys(DIAL)) {
  assert.ok(shader.includes(`\${f(DIAL.${name})}`),
    `the shader does not take DIAL.${name} from the geometry`)
}
assert.ok(shader.includes('${f(APERTURE_MAX_LUM)}'), 'the shader does not take the cap')
assert.ok(shader.includes('${LUME_COLD.map(f)') && shader.includes('${LUME_HOT.map(f)'),
  'the shader does not take the lume colours from the geometry')

// No loose decimals in the GLSL that match a geometry constant — that would be
// a second copy of a number that is supposed to have exactly one.
const glslBody = shader.slice(shader.indexOf('export const DIAL_FRAG'))
for (const [name, v] of Object.entries(DIAL)) {
  const stray = new RegExp(`(?<![.\\w$])${v.toFixed(5).replace('.', '\\.')}`)
  assert.ok(!stray.test(glslBody.replace(/\$\{[^}]*\}/g, '')),
    `${v} appears literally in the shader as well as via DIAL.${name}`)
}

for (const u of ['u_frac[16]', 'u_rate[16]', 'u_focus', 'u_focusMix', 'u_motion', 'u_n']) {
  assert.ok(shader.includes(u), `the shader is missing ${u}`)
}
// The arrays have to be at least as long as the ladder, or rings fall off the end.
assert.ok(MAX_UNITS >= UNITS.length, `MAX_UNITS ${MAX_UNITS} < ${UNITS.length} units`)
assert.ok(shader.includes(`u_frac[${MAX_UNITS}]`),
  `the shader's arrays are not MAX_UNITS (${MAX_UNITS}) long`)

console.log(
  `Progress dial: ${UNITS.length} and ${UNITS.length - 1} rings hit-test exactly; ` +
  `channel ${((ring(UNITS.length, 0).r1 - ring(UNITS.length, 0).r0) * 173).toFixed(1)}px on a phone; ` +
  `aperture inks ${inks.join(' ')} at ` +
  `${Math.min(...inks.map((i) => contrast(hexLum(i), worst))).toFixed(2)}:1 against the cap; ` +
  `lit index lifted x${gain}.`)
