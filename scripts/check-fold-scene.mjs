/**
 * check-fold-scene — the two things the new Paper Folds page is made of.
 *
 * check-fold.mjs already holds the physics to what people have folded. This
 * holds the *presentation* to the things a screenshot answers badly:
 *
 *   1. Is the page readable at every altitude? The backdrop travels from a
 *      warm desk to intergalactic space over a hundred and three folds, and
 *      the failure mode is not that it looks bad, it is that somewhere around
 *      fold fifty the ink and the surface pass through the same grey. Checked
 *      at all hundred and four, not at the two ends.
 *   2. Does the sky move smoothly, or does it step? Interpolation between
 *      nine stops is easy to get wrong in a way that draws a band edge across
 *      the screen at one particular fold.
 *   3. Does the projection put the object where the caller asked, at the size
 *      the caller asked for? A fit that is out by a sign centres the sheet
 *      off-screen at exactly the fold counts where the shape changes most.
 *   4. Is the drawing self-consistent — no back-faces, painter's order, the
 *      flap landing on top rather than through the stack?
 *   5. And the one that ties the picture back to the physics: the rounded lip
 *      at the crease is the paper that went round the bend, so it has to
 *      outgrow the sheet at the fold where the sheet gives up. If those two
 *      ever stopped agreeing, the drawing would be illustrating a different
 *      claim from the one the model makes.
 *
 *   node scripts/check-fold-scene.mjs [--png dir]
 */
import { Resvg } from '@resvg/resvg-js'
import fs from 'node:fs'
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

const { skyAt, stops, starField, contrast, luminance, surfaceMax, inkMin } =
  await import('../src/lib/fold-sky.ts')
const { project, fitCam, fold3d, fitCorners, signedArea } = await import('../src/lib/fold-scene.ts')
const { SHEETS, sheetById, maxFolds, have, footprint, thicknessAt, bendRadius } =
  await import('../src/lib/fold-paper.ts')

let failed = 0
const fail = (m) => { console.error('  FAIL ' + m); failed++ }
const ok = (m) => console.log('  ok   ' + m)

const MAX_FOLDS = 103
const START_MM = 0.1
/** Stack height in metres after n folds of a 0.1 mm sheet. */
const heightAt = (n) => (START_MM * Math.pow(2, n)) / 1000

/* -------------------------------------------------------------------------- */
console.log('\nThe page stays readable all the way up')
/* -------------------------------------------------------------------------- */

{
  let worstInk = Infinity, worstSoft = Infinity, worstAt = 0, worstAccent = Infinity
  for (let n = 0; n <= MAX_FOLDS; n++) {
    const s = skyAt(heightAt(n))
    const ci = contrast(s.ink, s.surface)
    const cs = contrast(s.inkSoft, s.surface)
    if (ci < worstInk) { worstInk = ci; worstAt = n }
    worstSoft = Math.min(worstSoft, cs)
    worstAccent = Math.min(worstAccent, contrast(s.accent, s.surface))
    if (ci < 4.5) fail('fold ' + n + ': ink on surface is ' + ci.toFixed(2) + ':1')
    if (cs < 4.5) fail('fold ' + n + ': soft ink on surface is ' + cs.toFixed(2) + ':1')
  }
  if (worstInk >= 4.5)
    ok('ink never drops below ' + worstInk.toFixed(1) + ':1 (worst at fold ' + worstAt + ')')
  if (worstSoft >= 4.5) ok('soft ink never drops below ' + worstSoft.toFixed(1) + ':1')
  // The accent sets the line naming where you are, so it is text and is held
  // to the text threshold. Held at 3:1 it passed at 3.3 and was unreadable.
  if (worstAccent < 4.5) fail('the accent falls to ' + worstAccent.toFixed(2) + ':1 on the surface')
  else ok('the accent holds ' + worstAccent.toFixed(1) + ':1 against the surface')

  // The label on the primary button is the console's own recess colour sitting
  // on the accent, so the accent is text *and* background and has to clear the
  // threshold read both ways.
  let worstBtn = Infinity
  for (let n = 0; n <= MAX_FOLDS; n++) {
    const s = skyAt(heightAt(n))
    worstBtn = Math.min(worstBtn, contrast(s.well, s.accent))
  }
  if (worstBtn < 4.5) fail("the primary button's label falls to " + worstBtn.toFixed(2) + ':1')
  else ok("the primary button's label holds " + worstBtn.toFixed(1) + ':1 on the accent')

  /**
   * The bands, checked at the stops rather than at samples.
   *
   * This is the check that replaced sampling-and-hoping. Every surface sits
   * below `surfaceMax` and every ink above `inkMin`, at every one of the
   * declared stops; luminance under a linear mix of two values in the same
   * band stays in that band; so no fold *between* two stops can leave it
   * either. The ratios above are then a consequence rather than an
   * observation, which is what you want from a page whose background travels
   * thirty orders of magnitude.
   */
  {
    let bad = 0
    for (const s of stops()) {
      for (const k of ['surface', 'well'])
        if (luminance(s[k]) > surfaceMax) {
          fail('"' + s.where + '": ' + k + ' is lighter than the dark band allows')
          bad++
        }
      for (const k of ['ink', 'inkSoft', 'accent', 'rim'])
        if (luminance(s[k]) < inkMin) {
          fail('"' + s.where + '": ' + k + ' is darker than the light band allows')
          bad++
        }
    }
    if (!bad) ok('every stop keeps its surfaces under ' + surfaceMax + ' and its inks over ' + inkMin)
  }

  /**
   * And the separation a dark console cannot get from its value.
   *
   * The old test here asked that the panel stay off the sky by 1.12:1, and
   * with a dark console it is not merely failing, it is *unsatisfiable*: the
   * backdrop travels from daylight to black, so it must at some altitude pass
   * through the panel's own luminance. Around fold thirty it does, and the
   * face of the console and the sky behind it are the same value to within a
   * hundredth.
   *
   * What actually keeps the panel findable there is its edge. The console is
   * drawn as a lit rim over a dark face, two tones 2.2:1 apart, and one sky
   * value cannot match both — so at every fold at least one of the two
   * separates. That is the real invariant, and unlike the old one it is a
   * statement about how the thing is drawn rather than a hope about where the
   * colours happened to land.
   */
  let worstEdge = Infinity, worstEdgeAt = 0
  for (let k = 0; k <= MAX_FOLDS * 10; k++) {
    const s = skyAt(heightAt(k / 10))
    const best = Math.max(contrast(s.rim, s.bottom), contrast(s.surface, s.bottom))
    if (best < worstEdge) { worstEdge = best; worstEdgeAt = k / 10 }
  }
  if (worstEdge < 1.4)
    fail('the console has no findable edge against the sky at fold ' +
      worstEdgeAt.toFixed(1) + ' (' + worstEdge.toFixed(2) + ':1)')
  else
    ok('the console keeps an edge of at least ' + worstEdge.toFixed(2) +
      ':1 against the sky (worst at fold ' + worstEdgeAt.toFixed(1) + ')')
}

/* -------------------------------------------------------------------------- */
console.log('\nThe sky moves rather than steps')
/* -------------------------------------------------------------------------- */

{
  // Sampled ten times per fold: a discontinuity between stops would sit
  // between two folds and a per-fold check would step straight over it.
  let worst = 0, worstAt = 0
  let prev = null
  for (let k = 0; k <= MAX_FOLDS * 10; k++) {
    const n = k / 10
    const s = skyAt(heightAt(n))
    if (prev) {
      for (const key of ['top', 'bottom', 'surface', 'well', 'ink', 'inkSoft', 'accent', 'rim', 'line'])
        for (let c = 0; c < 3; c++) {
          const d = Math.abs(s[key][c] - prev[key][c])
          if (d > worst) { worst = d; worstAt = n }
        }
    }
    prev = s
  }
  if (worst > 6) fail('a colour jumps ' + worst + ' levels in a tenth of a fold, at fold ' + worstAt.toFixed(1))
  else ok('no colour moves more than ' + worst + ' levels per tenth of a fold')

  // Layer amounts have to stay amounts.
  let bad = 0
  for (let k = 0; k <= MAX_FOLDS * 4; k++) {
    const s = skyAt(heightAt(k / 4))
    for (const key of ['ground', 'clouds', 'curve', 'stars', 'galaxies'])
      if (!(s[key] >= 0 && s[key] <= 1)) bad++
  }
  if (bad) fail(bad + ' layer amounts outside 0..1')
  else ok('every layer amount stays between 0 and 1')

  // It has to actually get dark, and the daylight in the middle has to be
  // brighter than either end — that is the shape of the journey.
  const desk = luminance(skyAt(heightAt(0)).bottom)
  const day = luminance(skyAt(heightAt(20)).bottom)
  const deep = luminance(skyAt(heightAt(103)).bottom)
  if (!(day > desk && desk > deep * 12))
    fail('the journey is not desk -> daylight -> dark (' + desk.toFixed(3) + ', ' +
      day.toFixed(3) + ', ' + deep.toFixed(3) + ')')
  else ok('desk ' + desk.toFixed(2) + ' -> daylight ' + day.toFixed(2) + ' -> deep space ' + deep.toFixed(3))

  const names = []
  for (let n = 0; n <= MAX_FOLDS; n++) {
    const w = skyAt(heightAt(n)).where
    if (w !== names[names.length - 1]) names.push(w)
  }
  if (names.length < 6) fail('only ' + names.length + ' places named on the way up')
  else ok(names.length + ' places named: ' + names.join(' -> '))

  const a = starField(60, 3), b = starField(60, 3)
  if (JSON.stringify(a) !== JSON.stringify(b)) fail('the star field is not deterministic')
  else if (starField(60, 4)[0].x === a[0].x) fail('the star seed does nothing')
  else ok('the star field is the same sky every frame')
}

/* -------------------------------------------------------------------------- */
console.log('\nThe camera puts it where it was asked to')
/* -------------------------------------------------------------------------- */

const BASE = { yaw: 0, pitch: 0.42, dist: 3.2, f: 1, cx: 0, cy: 0 }
const W = 420, H = 300

{
  // Across the whole range of shapes the sheet takes: a wide thin sheet at
  // fold 0, a tall narrow tower by fold 7.
  let worstFill = 1, worstOff = 0
  for (let n = 0; n <= 12; n++) {
    const halfW = 1 / Math.pow(2, n / 2)
    const h = 0.0005 * Math.pow(2, n)
    const corners = fitCorners(halfW, halfW * 0.7, h)
    const cam = fitCam(corners, BASE, Math.min(W, H), { x: W / 2, y: H / 2 })
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
    for (const p of corners) {
      const q = project(p, cam)
      x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x)
      y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y)
    }
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2
    worstOff = Math.max(worstOff, Math.hypot(cx - W / 2, cy - H / 2))
    worstFill = Math.min(worstFill, Math.max(x1 - x0, y1 - y0) / Math.min(W, H))
    if (x0 < -1 || x1 > W + 1 || y0 < -1 || y1 > H + 1)
      fail('fold ' + n + ': the fitted object leaves the frame (' +
        [x0, y0, x1, y1].map((v) => v.toFixed(0)).join(', ') + ')')
  }
  if (worstOff > 0.6) fail('the fit is off centre by up to ' + worstOff.toFixed(1) + 'px')
  else ok('the fit centres to within ' + worstOff.toFixed(2) + 'px')
  if (worstFill < 0.8) fail('the fit only fills ' + (worstFill * 100).toFixed(0) + '% of the frame')
  else ok('the fit fills at least ' + (worstFill * 100).toFixed(0) + '% of the frame')

  // Perspective has to be perspective: the far edge of the sheet is narrower
  // on screen than the near edge.
  const cam = fitCam(fitCorners(1, 0.7, 0.01), BASE, 300, { x: 0, y: 0 })
  // +z is away. Getting this backwards is how the first version of this
  // check passed a projection that had the camera under the desk.
  const nearL = project({ x: -1, y: 0, z: -0.7 }, cam)
  const nearR = project({ x: 1, y: 0, z: -0.7 }, cam)
  const farL = project({ x: -1, y: 0, z: 0.7 }, cam)
  const farR = project({ x: 1, y: 0, z: 0.7 }, cam)
  if (!(farR.x - farL.x < nearR.x - nearL.x))
    fail('the far edge is not narrower than the near edge')
  else ok('the far edge is ' +
    (((farR.x - farL.x) / (nearR.x - nearL.x)) * 100).toFixed(0) + '% the width of the near edge')
}

/* -------------------------------------------------------------------------- */
console.log('\nThe sheet is drawn like a solid')
/* -------------------------------------------------------------------------- */

{
  let backfaces = 0, misordered = 0, nonFinite = 0, frames = 0
  for (let n = 0; n <= 9; n++)
    for (let k = 0; k <= 10; k++) {
      const u = k / 10
      const halfW = 1 / Math.pow(2, n / 2)
      const h = 0.0006 * Math.pow(2, n)
      const cam = fitCam(fitCorners(halfW, halfW * 0.7, h), BASE, 300, { x: 150, y: 150 })
      const s = fold3d({ halfW, halfD: halfW * 0.7, height: h, layers: 2 ** n, u, cam })
      frames++
      if (!s.faces.length) { fail('fold ' + n + ' at u=' + u + ' drew nothing'); continue }
      // Every kept face must wind the same way on screen. Which way is not
      // the point — that depends on the projection — but a mixture means the
      // solid has been built inside out somewhere.
      const sign = s.faces.length ? Math.sign(signedArea(s.faces[0].pts)) : 0
      for (const f of s.faces) {
        if (Math.sign(signedArea(f.pts)) !== sign) backfaces++
        for (const [x, y] of f.pts) if (!Number.isFinite(x) || !Number.isFinite(y)) nonFinite++
        if (!(f.shade >= 0 && f.shade <= 1)) fail('a face is shaded ' + f.shade)
      }
      for (let i = 1; i < s.faces.length; i++)
        if (s.faces[i].depth > s.faces[i - 1].depth + 1e-9) misordered++
    }
  if (backfaces) fail(backfaces + ' quads wind against the rest of their frame')
  else ok('every quad winds the same way, in ' + frames + ' frames')
  if (misordered) fail(misordered + ' faces are out of painter order')
  else ok('every frame is sorted back to front')
  if (nonFinite) fail(nonFinite + ' non-finite coordinates')
  else ok('every coordinate is finite')

  // One light, obeyed: a flat sheet has a bright top and darker sides, and the
  // two are far enough apart to read as a solid rather than a silhouette.
  const cam = fitCam(fitCorners(1, 0.7, 0.06), BASE, 300, { x: 150, y: 150 })
  const flat = fold3d({ halfW: 1, halfD: 0.7, height: 0.06, layers: 1, u: 0, cam })
  const top = flat.faces.find((f) => f.kind === 'top')
  const side = flat.faces.find((f) => f.kind === 'side' || f.kind === 'end')
  if (!top || !side) fail('a flat sheet is missing a top or a side')
  else if (top.shade - side.shade < 0.1)
    fail('top and side differ by only ' + (top.shade - side.shade).toFixed(3) + ' — it is a silhouette')
  else ok('the lit top sits ' + (top.shade - side.shade).toFixed(2) + ' above the sides')

  // The flap turns about the top of the stack, so a finished fold is exactly
  // twice as tall and half as wide. Turn it about the desk instead and the
  // paper passes through itself.
  /**
   * A finished fold stands exactly twice as tall.
   *
   * The first version of this compared the topmost pixel of the whole scene
   * against a point on the centre line, and failed on a correct drawing: the
   * far corners of the sheet sit higher on the screen than anything at z = 0,
   * and with a sheet this wide that offset is six times the height being
   * measured. Both sides of the comparison now come from the same four
   * corners.
   */
  const h = 0.05
  const c2 = fitCam(fitCorners(1, 0.7, h), BASE, 300, { x: 150, y: 150 })
  const topOf = (y) => Math.min(
    ...[-1, 0].flatMap((x) => [-0.7, 0.7].map((z) => project({ x, y, z }, c2).y)))
  const s1 = fold3d({ halfW: 1, halfD: 0.7, height: h, layers: 1, u: 1, cam: c2 })
  const highest = Math.min(...s1.faces.flatMap((f) => f.pts.map((p) => p[1])))
  const oneHigh = topOf(h), twoHigh = topOf(2 * h)
  if (Math.abs(highest - twoHigh) > Math.abs(oneHigh - twoHigh) * 0.25)
    fail('a finished fold reaches ' + highest.toFixed(1) + ', but one stack is at ' +
      oneHigh.toFixed(1) + ' and two are at ' + twoHigh.toFixed(1))
  else ok('a finished fold stands exactly twice as tall')

  // And it has folded to the left: nothing is left of the crease on the right.
  const rightMost = Math.max(...s1.faces.flatMap((f) => f.pts.map((p) => p[0])))
  const creaseX = project({ x: 0, y: h, z: 0.7 }, c2).x
  if (rightMost > creaseX + 2)
    fail('paper is still on the far side of the crease after the fold')
  else ok('the flap has come all the way over')
}

/* -------------------------------------------------------------------------- */
console.log('\nThe lip in the picture is the bend in the equations')
/* -------------------------------------------------------------------------- */

{
  /**
   * The lip is drawn at half the stack, which is the radius `bendRadius`
   * charges for. So the fold where the lip no longer fits on the remaining
   * paper is a bound on how far the sheet can go — and it has to be a *looser*
   * bound than Gallivan's, because hers charges for every earlier bend as well
   * as this one. Paper that went round fold three is still going round it at
   * fold seven, and cannot be spent twice.
   *
   * An earlier version of this asserted the two bounds were equal and passed,
   * which was the checker agreeing with a bug rather than with the world: the
   * page was computing the remaining width as have/2^n, which is the answer
   * for folding the same way every time, and it happened to make the numbers
   * meet. With the real footprint they do not meet, and they should not.
   */
  for (const id of ['a4', 'note', 'tissue', 'roll']) {
    const sheet = sheetById(id)
    for (const mode of ['alternate', 'single']) {
      const lim = maxFolds(sheet, mode)
      let crossed = null
      for (let n = 1; n <= lim + 12; n++) {
        if (bendRadius(sheet.thickness, n) >= footprint(sheet, n - 1, mode).w / 2) { crossed = n; break }
      }
      if (crossed === null) continue
      if (crossed <= lim)
        fail(sheet.name + ' (' + mode + '): the lip outgrows the paper at fold ' + crossed +
          ', but the model still allows ' + lim + ' — the picture contradicts the numbers')
    }
  }
  ok('the lip never outgrows the paper before the model says it should')
  {
    const sheet = sheetById('a4')
    const lim = maxFolds(sheet, 'alternate')
    let crossed = 0
    for (let n = 1; n <= 40; n++)
      if (bendRadius(sheet.thickness, n) >= footprint(sheet, n - 1, 'alternate').w / 2) { crossed = n; break }
    ok('A4: this fold\'s bend alone would allow ' + crossed + ' folds; charging for all of them allows ' + lim)
  }

  // The footprint has to be a footprint: half the area gone per fold, and the
  // two modes agreeing at the only place they describe the same thing.
  for (const id of ['a4', 'tissue']) {
    const sheet = sheetById(id)
    for (const mode of ['alternate', 'single'])
      for (let n = 0; n <= 8; n++) {
        const f = footprint(sheet, n, mode)
        const want = (sheet.length * sheet.width) / Math.pow(2, n)
        if (Math.abs(f.w * f.d - want) > want * 1e-9)
          fail(sheet.name + ' (' + mode + ') at ' + n + ': area is ' + (f.w * f.d).toFixed(3) +
            ', should be ' + want.toFixed(3))
      }
  }
  ok('every fold halves the area, both ways round')

  // And the lip is actually drawn, at the size claimed.
  const h = 0.4
  const cam = fitCam(fitCorners(1, 0.7, h), BASE, 300, { x: 150, y: 150 })
  const none = fold3d({ halfW: 1, halfD: 0.7, height: h, layers: 1, u: 0, cam })
  const full = fold3d({ halfW: 1, halfD: 0.7, height: h, layers: 1, u: 1, cam })
  if (none.faces.some((f) => f.kind === 'bend')) fail('there is a lip before the fold starts')
  else ok('no lip until the fold starts')
  const lipFaces = full.faces.filter((f) => f.kind === 'bend')
  if (lipFaces.length < 8) fail('the lip is only ' + lipFaces.length + ' quads')
  else {
    const leftMost = Math.min(...lipFaces.flatMap((f) => f.pts.map((p) => p[0])))
    const want = project({ x: -h / 2, y: h, z: -0.7 }, cam).x
    if (Math.abs(leftMost - want) > 4)
      fail('the lip reaches ' + leftMost.toFixed(1) + ' but half the stack is at ' + want.toFixed(1))
    else ok('the lip stands exactly half a stack proud of the crease')
  }
}

/* -------------------------------------------------------------------------- */
console.log('\nAnd it renders')
/* -------------------------------------------------------------------------- */

const svgOf = (n, u) => {
  const halfW = 1 / Math.pow(2, n / 2)
  const h = 0.0005 * Math.pow(2, n)
  const cam = fitCam(fitCorners(halfW, halfW * 0.72, h), BASE, Math.min(W, H), { x: W / 2, y: H / 2 })
  const s = fold3d({ halfW, halfD: halfW * 0.72, height: h, layers: 2 ** n, u, cam })
  const sky = skyAt(heightAt(n))
  let out = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="' +
    W + '" height="' + H + '"><rect width="' + W + '" height="' + H + '" fill="rgb(' +
    sky.bottom.join(',') + ')"/>'
  if (s.shadow.length)
    out += '<path d="M' + s.shadow.map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L') +
      'Z" fill="#000" opacity="0.22"/>'
  for (const f of s.faces) {
    const v = Math.round(150 + f.shade * 105)
    out += '<path d="M' + f.pts.map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L') +
      'Z" fill="rgb(' + v + ',' + Math.round(v * 0.97) + ',' + Math.round(v * 0.9) + ')"/>'
  }
  for (const l of s.laminations)
    out += '<path d="M' + l.map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L') +
      '" stroke="rgb(120,100,60)" stroke-width="0.5" fill="none" opacity="0.5"/>'
  return out + '</svg>'
}

{
  for (const [n, u] of [[0, 0], [0, 0.5], [3, 0.35], [7, 1]]) {
    const img = new Resvg(svgOf(n, u), { fitTo: { mode: 'width', value: W } }).render()
    const px = img.pixels
    const tones = new Set()
    for (let o = 0; o < px.length; o += 4) tones.add((px[o] >> 3) * 1024 + (px[o + 1] >> 3))
    if (tones.size < 6)
      fail('fold ' + n + ' at u=' + u + ' renders in only ' + tones.size + ' tones')
  }
  ok('every sampled frame renders with shading in it')
}

const dir = process.argv.indexOf('--png') >= 0 ? process.argv[process.argv.indexOf('--png') + 1] : null
if (dir) {
  fs.mkdirSync(dir, { recursive: true })
  for (const [n, u] of [[0, 0], [0, 0.45], [1, 1], [4, 0.5], [7, 1]])
    fs.writeFileSync(dir + '/fold-' + n + '-' + String(u).replace('.', '') + '.png',
      new Resvg(svgOf(n, u), { fitTo: { mode: 'width', value: W * 2 } }).render().asPng())
  console.log('\nwrote ' + dir)
}

console.log(failed ? '\n' + failed + ' failed.' : '\nAll good.')
process.exitCode = failed ? 1 : 0
