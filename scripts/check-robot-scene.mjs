/**
 * check-robot-scene — is the answer key true of the picture?
 *
 * src/lib/robot-scene.ts works out which squares contain the traffic light
 * from a handful of bounding boxes. That is arithmetic on numbers I typed, and
 * numbers I typed are exactly the thing that goes stale when the drawing
 * moves. So this asks the same question a completely different way: render the
 * street twice, once with the light and once without, and see which squares
 * changed. Pixels do not care what the boxes say.
 *
 * If the two ever disagree, one of them is wrong and the picture is lying to
 * the player about what the right answer was.
 *
 * It also checks the things a screenshot answers badly:
 *
 *   - Is the subject actually visible, or merely present? A traffic light at
 *     4% opacity satisfies every bounding box in the file and cannot be seen.
 *   - Does the answer turn on the coverage threshold? If some square sat at
 *     4.6% against a 4.5% cut, the key would be one nudge from changing, and
 *     nothing would say so.
 *   - Is the scene a photograph or a diagram? Measured as the number of
 *     distinct tones present: flat fills produce very few.
 *   - Is the distorted text distorted, and still all there?
 *
 *   node scripts/check-robot-scene.mjs [--png dir]
 */
import { Resvg } from '@resvg/resvg-js'
import fs from 'node:fs'
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

const {
  STREET, MIN_COVER, answerCells, coreCells, mark, coverage, cellBox, sceneSvg, warpedText, ALPHABET,
} = await import('../src/lib/robot-scene.ts')

let failed = 0
const fail = (msg) => { console.error('  FAIL ' + msg); failed++ }
const ok = (msg) => console.log('  ok   ' + msg)

/** Render at 3x so a one-unit pole is three pixels and cannot vanish. */
const SCALE = 3
function raster(svg, size) {
  const img = new Resvg(svg, { fitTo: { mode: 'width', value: size * SCALE } }).render()
  return { px: img.pixels, w: img.width, h: img.height }
}

const SCENES = [['the street', STREET]]

/* ------------------------------------------------------------------------ */
console.log('\nBounding boxes')
/* ------------------------------------------------------------------------ */

for (const [name, scene] of SCENES) {
  // coverage() adds the boxes up, so two that overlap would count their shared
  // area twice and could push a square over the line on its own.
  let clash = 0
  for (let i = 0; i < scene.bounds.length; i++)
    for (let j = i + 1; j < scene.bounds.length; j++) {
      const a = scene.bounds[i], b = scene.bounds[j]
      const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
      const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
      if (w > 0 && h > 0) clash += w * h
    }
  if (clash > 0) fail(name + ': subject boxes overlap by ' + clash.toFixed(1) + ' square units')
  else ok(name + ': ' + scene.bounds.length + ' subject boxes, none overlapping')

  const key = answerCells(scene)
  if (key.length === 0) fail(name + ': nothing to find')
  else if (key.length === 9) fail(name + ': every square is the answer, which is not a question')
  else ok(name + ': the answer is ' + key.length + ' of 9 squares — ' + key.join(', '))
}

/* ------------------------------------------------------------------------ */
console.log('\nThe answer key against the pixels')
/* ------------------------------------------------------------------------ */

/**
 * A square counts as changed if enough of its pixels moved by enough. Both
 * numbers are loose on purpose: the question is "did the light land here",
 * not "by how much", and a threshold tuned finely enough to matter would be
 * measuring itself.
 */
const DELTA = 12          // per-channel difference that counts as a change
const CHANGED_MIN = 0.02  // fraction of a square's pixels that must have moved

for (const [name, scene] of SCENES) {
  const withIt = raster(sceneSvg(scene, true), scene.size)
  const without = raster(sceneSvg(scene, false), scene.size)
  if (withIt.w !== without.w || withIt.h !== without.h) {
    fail(name + ': the two renders are different sizes')
    continue
  }

  const n = 3
  const cell = withIt.w / n
  const moved = new Array(n * n).fill(0)
  for (let y = 0; y < withIt.h; y++)
    for (let x = 0; x < withIt.w; x++) {
      const o = (y * withIt.w + x) * 4
      const d = Math.max(
        Math.abs(withIt.px[o] - without.px[o]),
        Math.abs(withIt.px[o + 1] - without.px[o + 1]),
        Math.abs(withIt.px[o + 2] - without.px[o + 2]),
      )
      if (d >= DELTA) moved[Math.floor(y / cell) * n + Math.floor(x / cell)]++
    }

  const perCell = cell * cell
  const seen = []
  for (let i = 0; i < 9; i++) if (moved[i] / perCell >= CHANGED_MIN) seen.push(i)
  const key = answerCells(scene)

  if (seen.join(',') !== key.join(',')) {
    fail(name + ': the boxes say ' + JSON.stringify(key) + ' but the pixels say ' + JSON.stringify(seen))
    for (let i = 0; i < 9; i++)
      console.error('       square ' + i + ': boxes ' + (coverage(scene, 3, i) * 100).toFixed(1) +
        '%, pixels ' + ((moved[i] / perCell) * 100).toFixed(1) + '%')
  } else {
    ok(name + ': both methods name the same squares — ' + key.join(', '))
  }

  // Present is not the same as visible. Every answer square has to have been
  // properly repainted, not grazed.
  for (const i of key) {
    const f = moved[i] / perCell
    if (f < 0.05) fail(name + ': square ' + i + ' is an answer but only ' + (f * 100).toFixed(1) +
      '% of it changed — the subject is there but you cannot see it')
  }
  ok(name + ': every answer square is at least 5% repainted (worst ' +
    (Math.min(...key.map((i) => moved[i] / perCell)) * 100).toFixed(1) + '%)')

  // And the key must not sit near the cut.
  let closest = 1
  for (let i = 0; i < 9; i++) closest = Math.min(closest, Math.abs(coverage(scene, 3, i) - MIN_COVER))
  if (closest < 0.02)
    fail(name + ': a square sits ' + (closest * 100).toFixed(2) +
      ' points from the ' + (MIN_COVER * 100) + '% cut — the key turns on the threshold')
  else
    ok(name + ': nearest square is ' + (closest * 100).toFixed(1) + ' points clear of the cut')
}

/* ------------------------------------------------------------------------ */
console.log('\nDoes it look like a photograph')
/* ------------------------------------------------------------------------ */

for (const [name, scene] of SCENES) {
  const img = raster(sceneSvg(scene, true), scene.size)

  // A drawing made of flat fills has a handful of colours in it. A photograph
  // has thousands, because every surface is a gradient and nothing is even.
  const tones = new Set()
  for (let o = 0; o < img.px.length; o += 4)
    tones.add((img.px[o] >> 3) * 1024 + (img.px[o + 1] >> 3) * 32 + (img.px[o + 2] >> 3))
  if (tones.size < 400) fail(name + ': only ' + tones.size + ' distinct tones — that is a diagram')
  else ok(name + ': ' + tones.size + ' distinct tones')

  // Every square has to carry something. A tile that is one flat colour looks
  // like a loading failure, and there are nine chances to ship one.
  for (let i = 0; i < 9; i++) {
    const b = cellBox(img.w, 3, i)
    let min = 255, max = 0
    for (let y = b.y; y < b.y + b.h; y++)
      for (let x = b.x; x < b.x + b.w; x++) {
        const o = (y * img.w + x) * 4
        const l = 0.2126 * img.px[o] + 0.7152 * img.px[o + 1] + 0.0722 * img.px[o + 2]
        if (l < min) min = l
        if (l > max) max = l
      }
    if (max - min < 40)
      fail(name + ': square ' + i + ' spans only ' + (max - min).toFixed(0) + ' levels — it is blank')
  }
  ok(name + ': no square is flat')

  // The corners of a photograph are darker than the middle. This is the
  // vignette, and it is the cue that stops a rendering reading as a swatch.
  const lum = (x, y) => {
    const o = (y * img.w + x) * 4
    return 0.2126 * img.px[o] + 0.7152 * img.px[o + 1] + 0.0722 * img.px[o + 2]
  }
  const e = 6
  const corner = (lum(e, e) + lum(img.w - e, e)) / 2
  const middle = lum(Math.floor(img.w / 2), e)
  if (corner >= middle) fail(name + ': the top corners are not darker than the top middle')
  else ok(name + ': corners sit ' + (middle - corner).toFixed(0) + ' levels under the middle')
}

/* ------------------------------------------------------------------------ */
console.log('\nThe distorted text')
/* ------------------------------------------------------------------------ */

{
  const code = 'K4WBP'
  const a = warpedText(code, 7)
  const b = warpedText(code, 7)
  if (a.svg !== b.svg) fail('warpedText is not deterministic')
  else ok('the same code and seed give the same picture')

  if (warpedText(code, 8).svg === a.svg) fail('the seed does nothing')
  else ok('a different seed gives a different picture')

  for (const ch of code) {
    const uses = a.svg.split('>' + ch + '</text>').length - 1
    if (uses !== 1) fail('character ' + ch + ' appears ' + uses + ' times, not once')
  }
  ok('every character is drawn exactly once')

  for (const ch of ALPHABET) {
    if ('IOS015'.includes(ch)) fail('the alphabet contains ' + ch + ', which is unreadable warped')
  }
  ok('the alphabet has no letter-digit lookalikes in it (' + ALPHABET.length + ' characters)')

  // Distorted, but still ink on a page: too little and it is blank, too much
  // and it is a black rectangle with a code hidden somewhere inside it.
  const img = raster(a.svg, a.width)
  let dark = 0
  for (let o = 0; o < img.px.length; o += 4) {
    const l = 0.2126 * img.px[o] + 0.7152 * img.px[o + 1] + 0.0722 * img.px[o + 2]
    if (l < 140) dark++
  }
  const inked = dark / (img.px.length / 4)
  if (inked < 0.04) fail('the text is ' + (inked * 100).toFixed(1) + '% ink — nothing is there')
  else if (inked > 0.35) fail('the text is ' + (inked * 100).toFixed(1) + '% ink — it is a blot')
  else ok((inked * 100).toFixed(1) + '% of the frame is ink')

  // The displacement has to actually displace. Rendered without the warp
  // filter the picture would be different; if it is not, the filter is inert.
  const flat = raster(a.svg.replace(/filter="url\(#w7w\)"/, ''), a.width)
  let diff = 0
  for (let o = 0; o < img.px.length; o += 4) if (Math.abs(img.px[o] - flat.px[o]) > 20) diff++
  const moved = diff / (img.px.length / 4)
  if (moved < 0.02) fail('the warp filter changes only ' + (moved * 100).toFixed(1) + '% of the frame')
  else ok('the warp moves ' + (moved * 100).toFixed(1) + '% of the frame')
}

/* ------------------------------------------------------------------------ */

const dir = process.argv.indexOf('--png') >= 0 ? process.argv[process.argv.indexOf('--png') + 1] : null
if (dir) {
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(dir + '/street.png',
    new Resvg(sceneSvg(STREET, true), { fitTo: { mode: 'width', value: 600 } }).render().asPng())
  fs.writeFileSync(dir + '/street-nolight.png',
    new Resvg(sceneSvg(STREET, false), { fitTo: { mode: 'width', value: 600 } }).render().asPng())
  fs.writeFileSync(dir + '/text.png',
    new Resvg(warpedText('K4WBP', 7).svg, { fitTo: { mode: 'width', value: 528 } }).render().asPng())
  console.log('\nwrote ' + dir)
}

console.log(failed ? '\n' + failed + ' failed.' : '\nAll good.')
process.exitCode = failed ? 1 : 0
