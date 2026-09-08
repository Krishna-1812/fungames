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
 *   - Is the scene a photograph or a diagram? Several ways: how many distinct
 *     tones there are, how much of the frame is perfectly flat, whether the
 *     far end is softer than the near end, and whether the sunlit side of the
 *     street is actually brighter than the shaded side. These are measured on
 *     the encoded JPEG the page really loads, not on the SVG it came from.
 *   - Is the distorted text distorted, and still all there?
 *   - Do the four hands have the number of fingers they say they have, and is
 *     exactly one of them right?
 *
 *   node scripts/check-robot-scene.mjs [--png dir]
 */
import { Resvg } from '@resvg/resvg-js'
import sharp from 'sharp'
import fs from 'node:fs'
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

const {
  STREET, MIN_COVER, answerCells, coreCells, mark, coverage, cellBox, sceneSvg, warpedText, ALPHABET,
  STREET_JPEG,
  hands, HAND_DEFS,
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

/**
 * Everything below is measured on the JPEG the browser downloads, encoded
 * exactly as src/pages/street.jpg.ts encodes it. Checking the SVG instead
 * would be checking something nobody ever sees: the encoder softens the flat
 * areas and rings the hard edges, and both of those change the answers.
 */
{
  const png = new Resvg(sceneSvg(STREET, true), {
    fitTo: { mode: 'width', value: STREET_JPEG.width },
  }).render().asPng()
  const jpg = await sharp(png)
    .jpeg({ quality: STREET_JPEG.quality, mozjpeg: true, chromaSubsampling: '4:2:0' })
    .toBuffer()

  if (jpg.length > STREET_JPEG.maxBytes)
    fail('the street is ' + (jpg.length / 1024).toFixed(0) + 'KB, over the ' +
      (STREET_JPEG.maxBytes / 1024).toFixed(0) + 'KB budget')
  else
    ok('the street ships as ' + (jpg.length / 1024).toFixed(0) + 'KB of JPEG at ' +
      STREET_JPEG.width + 'px')

  const dec = await sharp(jpg).raw().toBuffer({ resolveWithObject: true })
  const px = dec.data, W = dec.info.width, H = dec.info.height, CH = dec.info.channels
  const lum = (x, y) => {
    const o = (y * W + x) * CH
    return 0.2126 * px[o] + 0.7152 * px[o + 1] + 0.0722 * px[o + 2]
  }

  // A drawing made of flat fills has a handful of colours in it. A photograph
  // has thousands, because every surface is textured and nothing is even.
  const tones = new Set()
  for (let o = 0; o < px.length; o += CH)
    tones.add((px[o] >> 3) * 1024 + (px[o + 1] >> 3) * 32 + (px[o + 2] >> 3))
  if (tones.size < 900) fail('only ' + tones.size + ' distinct tones — that is a diagram')
  else ok(tones.size + ' distinct tones')

  /**
   * The one that actually separates the two. A photograph has no perfectly
   * even patches anywhere in it — sensor noise alone guarantees that — and
   * vector art is nothing but perfectly even patches. Counted as the fraction
   * of the frame whose three-by-three neighbourhood is completely uniform.
   */
  let flat = 0, total = 0
  for (let y = 1; y < H - 1; y += 2)
    for (let x = 1; x < W - 1; x += 2) {
      total++
      const c = lum(x, y)
      let same = true
      for (let dy = -1; dy <= 1 && same; dy++)
        for (let dx = -1; dx <= 1; dx++)
          if (Math.abs(lum(x + dx, y + dy) - c) > 0.5) { same = false; break }
      if (same) flat++
    }
  const flatPct = (flat / total) * 100
  if (flatPct > 8) fail(flatPct.toFixed(1) + '% of the frame is perfectly flat — that reads as rendered')
  else ok(flatPct.toFixed(1) + '% of the frame is perfectly flat')

  /**
   * Depth, as haze washing out contrast with distance.
   *
   * The first version of this compared a band near the horizon against a band
   * near the bottom and failed, because the horizon band is full of windows
   * and the bottom band is empty road: it was measuring how much is going on
   * at each height, not how sharp any of it is. Both samples now sit on the
   * same material — shaded asphalt — at two distances.
   *
   * And it is relative contrast, not absolute. The near band is deeper in the
   * building's shadow and therefore darker, so the same texture there produces
   * smaller absolute differences; dividing by the local mean is what makes the
   * two numbers comparable, and it is what the eye is doing anyway.
   */
  const grit = (y0, y1, x0, x1) => {
    let e = 0, m = 0, n = 0
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1 - 1; x++) { e += Math.abs(lum(x, y) - lum(x + 1, y)); m += lum(x, y); n++ }
    return (e / n) / Math.max(1, m / n) * 100
  }
  const xa = Math.round(W * 0.6), xb = Math.round(W * 0.7)
  const far = grit(Math.round(H * 0.545), Math.round(H * 0.585), xa, xb)
  const near = grit(Math.round(H * 0.8), Math.round(H * 0.855), xa, xb)
  if (far >= near)
    fail('road grit does not fall off with distance (' + far.toFixed(2) + ' far vs ' +
      near.toFixed(2) + ' near) — there is no air in this picture')
  else ok('road grit falls from ' + near.toFixed(2) + '% contrast underfoot to ' + far.toFixed(2) + '% up the street')

  // The sun is somewhere. Sampled across the road at one height, the lit side
  // has to be brighter than the shaded side — if the cast shadow ever stops
  // being drawn, this is what says so.
  const rowAvg = (y, x0, x1) => {
    let a = 0
    for (let x = x0; x < x1; x++) a += lum(x, y)
    return a / (x1 - x0)
  }
  const y = Math.round(H * 0.8)
  const litSide = rowAvg(y, Math.round(W * 0.06), Math.round(W * 0.22))
  const shadeSide = rowAvg(y, Math.round(W * 0.74), Math.round(W * 0.9))
  if (litSide - shadeSide < 8)
    fail('the two sides of the street differ by only ' + (litSide - shadeSide).toFixed(1) +
      ' levels — there is no sun in this picture')
  else ok('the sunlit side is ' + (litSide - shadeSide).toFixed(0) + ' levels brighter than the shade')

  // Every square has to carry something. A tile that is one flat colour looks
  // like a loading failure, and there are nine chances to ship one.
  for (let i = 0; i < 9; i++) {
    const b = cellBox(W, 3, i)
    let min = 255, max = 0
    for (let yy = b.y; yy < b.y + b.h; yy++)
      for (let xx = b.x; xx < b.x + b.w; xx++) {
        const l = lum(xx, yy)
        if (l < min) min = l
        if (l > max) max = l
      }
    if (max - min < 40)
      fail('square ' + i + ' spans only ' + (max - min).toFixed(0) + ' levels — it is blank')
  }
  ok('no square is flat')

  // The corners of a photograph are darker than the middle.
  const e = 8
  const corner = (lum(e, e) + lum(W - e, e)) / 2
  const middle = lum(Math.floor(W / 2), e)
  if (corner >= middle) fail('the top corners are not darker than the top middle')
  else ok('corners sit ' + (middle - corner).toFixed(0) + ' levels under the middle')
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

/* ------------------------------------------------------------------------ */
console.log('\nThe hands')
/* ------------------------------------------------------------------------ */

const HAND_SVG = (h) =>
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 140" width="120" height="140">' +
  '<defs>' + HAND_DEFS + '</defs>' + h.svg + '</svg>'

{
  const list = hands()
  const right = list.filter((h) => h.ok)
  if (right.length !== 1) fail(right.length + ' of the four hands are correct, not one')
  else ok('exactly one of the four has five digits')

  // The count comes out of the loop that draws them, so a hand cannot say four
  // and be drawn with five. This checks the counts are the ones intended.
  const got = list.map((h) => h.digits).join(',')
  if (got !== '5,6,4,6') fail('digit counts are ' + got + ', expected 5,6,4,6')
  else ok('digit counts drawn: ' + got)

  for (const h of list) if (!h.ok && !h.why) fail('a wrong hand does not say why it is wrong')
  ok('every wrong hand says what is wrong with it')

  // Four pictures that are nearly the same picture is not a question. Rendered
  // and compared, because "I moved a rectangle" is not evidence of difference.
  const imgs = list.map((h) => raster(HAND_SVG(h), 120))
  for (let i = 0; i < imgs.length; i++)
    for (let j = i + 1; j < imgs.length; j++) {
      let moved = 0
      for (let o = 0; o < imgs[i].px.length; o += 4)
        if (Math.abs(imgs[i].px[o] - imgs[j].px[o]) > 14) moved++
      const f = moved / (imgs[i].px.length / 4)
      if (f < 0.015) fail('hands ' + i + ' and ' + j + ' differ in only ' + (f * 100).toFixed(1) + '% of pixels')
    }
  ok('all six pairs are visibly different from each other')

  // And each one has to be a hand on a ground, not a ground.
  for (let i = 0; i < imgs.length; i++) {
    const img = imgs[i]
    let skin = 0
    for (let o = 0; o < img.px.length; o += 4) {
      const [r, g, b] = [img.px[o], img.px[o + 1], img.px[o + 2]]
      if (r > 150 && r - b > 30 && g > b) skin++
    }
    const f = skin / (img.px.length / 4)
    if (f < 0.12) fail('hand ' + i + ' covers only ' + (f * 100).toFixed(1) + '% of its frame')
  }
  ok('every hand fills at least 12% of its frame')

  const tones = new Set()
  for (let o = 0; o < imgs[0].px.length; o += 4)
    tones.add((imgs[0].px[o] >> 3) * 1024 + (imgs[0].px[o + 1] >> 3) * 32 + (imgs[0].px[o + 2] >> 3))
  if (tones.size < 150) fail('a hand has only ' + tones.size + ' distinct tones — that is an outline')
  else ok('the correct hand has ' + tones.size + ' distinct tones')
}

const dir = process.argv.indexOf('--png') >= 0 ? process.argv[process.argv.indexOf('--png') + 1] : null
if (dir) {
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(dir + '/street.png',
    new Resvg(sceneSvg(STREET, true), { fitTo: { mode: 'width', value: 600 } }).render().asPng())
  fs.writeFileSync(dir + '/street.jpg', await sharp(
    new Resvg(sceneSvg(STREET, true), { fitTo: { mode: 'width', value: STREET_JPEG.width } })
      .render().asPng())
    .jpeg({ quality: STREET_JPEG.quality, mozjpeg: true, chromaSubsampling: '4:2:0' }).toBuffer())
  fs.writeFileSync(dir + '/street-nolight.png',
    new Resvg(sceneSvg(STREET, false), { fitTo: { mode: 'width', value: 600 } }).render().asPng())
  const sheet = hands().map((h, i) =>
    '<g transform="translate(' + i * 120 + ' 0)">' + h.svg + '</g>').join('')
  fs.writeFileSync(dir + '/hands.png', new Resvg(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 140" width="480" height="140">' +
    '<defs>' + HAND_DEFS + '</defs>' + sheet + '</svg>',
    { fitTo: { mode: 'width', value: 720 } }).render().asPng())
  fs.writeFileSync(dir + '/text.png',
    new Resvg(warpedText('K4WBP', 7).svg, { fitTo: { mode: 'width', value: 528 } }).render().asPng())
  console.log('\nwrote ' + dir)
}

console.log(failed ? '\n' + failed + ' failed.' : '\nAll good.')
process.exitCode = failed ? 1 : 0
