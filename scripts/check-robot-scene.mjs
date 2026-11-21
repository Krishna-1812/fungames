/**
 * check-robot-scene — is the answer key true of the picture, and are the
 * pictures I'm Not a Robot shows you actually there?
 *
 *   1. The street (public/not-a-robot/street.jpg) is the 900 x 900 JPEG the
 *      page cuts its nine squares from, in budget, and not a blank frame.
 *   2. The key (src/data/robot-street-key.ts) is measured, not typed: it is
 *      written by bake-robot.mjs from a mask render of the signal head and
 *      its pole. Here it is held to being a key a person can be fairly marked
 *      against: the head is in at least one square, no square has the head
 *      only grazing it, every square you must tick is one you may tick, and
 *      at least one square is a judgement call (the arm), which is the joke.
 *   3. mark() grades the obvious answers the way a person would expect.
 *   4. The distorted text: deterministic, seeded, legible, actually warped.
 *   5. The hands: four photographs, square, exactly one with five digits and
 *      one thumb, and each wrong one able to say what is wrong with it.
 *
 *   node scripts/check-robot-scene.mjs
 */
import { Resvg } from '@resvg/resvg-js'
import sharp from 'sharp'
import fs from 'node:fs'
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

const { STREET_KEY, HEAD_MIN, SEEN_MIN, answerCells, coreCells, mark, warpedText, ALPHABET, hands, HAND_SHOTS } =
  await import('../src/lib/robot-scene.ts')

let failed = 0
const fail = (msg) => { console.error('  FAIL ' + msg); failed++ }
const ok = (msg) => console.log('  ok   ' + msg)
const pub = (p) => new URL('../public/' + p, import.meta.url)

function raster(svg, size) {
  const img = new Resvg(svg, { fitTo: { mode: 'width', value: size * 3 } }).render()
  return { px: img.pixels, w: img.width, h: img.height }
}

/* ------------------------------------------------------------------------ */
console.log('\nThe street')
/* ------------------------------------------------------------------------ */
{
  const f = pub('not-a-robot/street.jpg')
  if (!fs.existsSync(f)) fail('public/not-a-robot/street.jpg is missing: run node scripts/bake-robot.mjs street')
  else {
    const buf = fs.readFileSync(f)
    const m = await sharp(buf).metadata()
    if (m.format !== 'jpeg' || m.width !== 900 || m.height !== 900) fail(`street.jpg is ${m.format} ${m.width}x${m.height}, not a 900 x 900 JPEG`)
    else ok('a 900 x 900 JPEG, 300 pixels a square')
    if (buf.length > 140_000) fail(`street.jpg is ${(buf.length / 1024).toFixed(0)}KB, over 140KB`)
    else ok(`${(buf.length / 1024).toFixed(0)}KB`)
    const s = await sharp(buf).stats()
    if (s.channels.every((c) => c.stdev < 20)) fail('street.jpg is close to a flat frame')
    else ok('a picture, not a flat frame')
  }
}

/* ------------------------------------------------------------------------ */
console.log('\nThe key, measured from the picture')
/* ------------------------------------------------------------------------ */
{
  const K = STREET_KEY
  if (K.grid !== 3 || K.head.length !== 9 || K.pole.length !== 9 || K.size !== 900) fail('the key is not a 3 x 3 measurement of the 900px street')
  else ok('a share for every one of the nine squares, measured at 900px')
  const core = coreCells(), answer = answerCells()
  if (!core.length) fail('the signal head is in no square at all')
  else ok(`you must tick ${core.map((i) => i + 1).join(', ')}; you may also tick ${answer.filter((i) => !core.includes(i)).map((i) => i + 1).join(', ') || 'nothing else'}`)
  const grazing = K.head.map((h, i) => [h, i]).filter(([h]) => h > 0 && h < HEAD_MIN * 2)
  if (grazing.length) fail('the head only grazes square ' + grazing.map(([h, i]) => `${i + 1} (${(h * 100).toFixed(1)}%)`).join(', ') + ': not fair to mark either way')
  else ok('no square has the head only grazing it: each clearly has it or clearly does not')
  const sliver = K.head.map((h, i) => [h + K.pole[i], i]).filter(([v]) => v > 0 && v < SEEN_MIN * 1.5)
  if (sliver.length) fail('the pole barely touches square ' + sliver.map(([, i]) => i + 1).join(', '))
  else ok('nothing touches a square by a sliver')
  if (!core.every((i) => answer.includes(i))) fail('a square you must tick is not one you may tick')
  else ok('every square you must tick is one you may tick')
  if (answer.length === core.length) fail('there is no judgement call: the arm reaches no square of its own')
  else ok('at least one square is yours to decide')
}

/* ------------------------------------------------------------------------ */
console.log('\nMarking')
/* ------------------------------------------------------------------------ */
{
  const core = coreCells(), answer = answerCells()
  const others = [...Array(9).keys()].filter((i) => !answer.includes(i))
  if (!mark(core).ok) fail('ticking exactly the head is marked wrong')
  else ok('ticking exactly the head passes')
  if (!mark(answer).ok) fail('ticking the head and the arm is marked wrong')
  else ok('ticking the head and the arm passes too')
  if (core.length > 1 && mark(core.slice(1)).ok) fail('missing a head square passes')
  if (mark([]).ok) fail('ticking nothing passes')
  else ok('ticking nothing fails')
  if (others.length && mark([...core, others[0]]).ok) fail('ticking an empty square passes')
  else ok('ticking a square with no traffic light in it fails')
}

/* ------------------------------------------------------------------------ */
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
console.log('\nThe hands')
/* ------------------------------------------------------------------------ */
{
  const list = hands('/')
  if (list.length !== 4) fail(`${list.length} hands, not four`)
  const right = list.filter((h) => h.ok)
  if (right.length !== 1) fail(`${right.length} hands have five digits and one thumb, not exactly one`)
  else ok(`exactly one hand is right: ${right[0].fingers} fingers and a thumb`)
  if (list.some((h) => !h.ok && !h.why)) fail('a wrong hand cannot say what is wrong with it')
  else ok('every wrong hand says what is wrong: ' + list.filter((h) => !h.ok).map((h) => h.why).join(' '))
  for (const [f, t] of HAND_SHOTS) {
    const file = pub(`not-a-robot/hand-${f}-${t}.webp`)
    if (!fs.existsSync(file)) { fail(`hand-${f}-${t}.webp is missing: run node scripts/bake-robot.mjs hands`); continue }
    const m = await sharp(fs.readFileSync(file)).metadata()
    if (m.width !== 600 || m.height !== 600) fail(`hand-${f}-${t}.webp is ${m.width}x${m.height}`)
  }
  ok('all four photographs are there, 600 square')
  const allow = fs.readFileSync(new URL('./check-public-boundary.mjs', import.meta.url), 'utf8')
  if (!allow.includes("'not-a-robot'")) fail('public/not-a-robot is not on the deploy allowlist')
  else ok('public/not-a-robot is on the deploy allowlist')
}

console.log(failed ? '\n' + failed + ' failed.' : '\nAll good.')
process.exit(failed ? 1 : 0)
