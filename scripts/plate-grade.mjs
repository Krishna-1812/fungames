/**
 * plate-grade — one photographic grade for the Unity plate, applied once, when
 * its tiles are stitched (scripts/unity-plate.mjs), so the site only ever
 * ships the graded picture and nothing is graded per frame.
 *
 * What it corrects, measured on the raw renders (Oct 2026): the deep sea came
 * out at saturation 0.85–0.89 (#1153a1–#1f66ba), the shelf a neon cyan halo
 * (#00bad3–#26ccd8), and the lawns a Kelly green at hue 101–107, saturation up
 * to 0.79. Between them they fill 60–75% of every realistic frame and pull the
 * eye off the town: the biggest single "this is a CG render" cue. A miniature
 * photograph of a coastal town has a calmer, deeper sea, a clear turquoise only
 * on the shelf, and grass leaning yellow-green.
 *
 * Everything is keyed softly by hue and saturation, so the blue-grey building
 * shadows (low saturation), sand, roads and roofs fall outside both keys and
 * keep their colour. Alpha is never touched.
 */

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }

/** The grade's settings: tuned on the renders by eye against reference photographs. */
export const GRADE = {
  // Water: hue 160–240, saturation above about 0.3. (Unity's water is natural now, Water.shader: these stand at
  // nothing, kept to put a render right that needs it.)
  water: { from: [160, 178], to: [228, 242], sat: [0.26, 0.44], desat: -0.22, hueTo: 206, hueK: 0, deepen: 0 },
  // The shelf's cyan (hue 180–195 at high saturation and value), pulled toward clear aqua if it needs it.
  shelf: { hue: [176, 198], val: [0.5, 0.8], desat: 0 },
  // Grass: hue 70–150, leaning toward 86 and a little less saturated.
  green: { from: [62, 76], to: [140, 156], sat: [0.18, 0.32], hueTo: 86, hueK: 0.35, desat: 0.12 },
  // Highlights roll off rather than clip.
  knee: 0.86, kneeK: 0.55,
}

function rgb2hsv(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  let h = 0
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60; if (h < 0) h += 360
  }
  return [h, max === 0 ? 0 : d / max, max]
}

function hsv2rgb(h, s, v) {
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c
  let r = 0, g = 0, b = 0
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  return [r + m, g + m, b + m]
}

/** Grades straight (unpremultiplied) RGBA pixels in place. */
export function gradePlate(px, W, H, G = GRADE) {
  const n = W * H
  for (let p = 0; p < n; p++) {
    const k = p * 4
    if (px[k + 3] === 0) continue
    let [h, s, v] = rgb2hsv(px[k] / 255, px[k + 1] / 255, px[k + 2] / 255)
    // Water.
    const w = smooth(G.water.from[0], G.water.from[1], h) * (1 - smooth(G.water.to[0], G.water.to[1], h)) * smooth(G.water.sat[0], G.water.sat[1], s)
    if (w > 0) {
      // (Keyed over a wide band of hue: the render shades from shelf to deep water through it, and a
      // narrow key cut a hard step into that gradient.)
      const shelf = smooth(G.shelf.hue[0] - 8, G.shelf.hue[0] + 4, h) * (1 - smooth(G.shelf.hue[1] - 6, G.shelf.hue[1] + 14, h)) * smooth(G.shelf.val[0], G.shelf.val[1], v)
      s *= 1 - G.water.desat * w - G.shelf.desat * w * shelf
      h += (G.water.hueTo - h) * G.water.hueK * w * (1 - shelf * 0.5)
      // Deep water (saturated, away from the shelf) darkens; the shelf keeps its light.
      v *= 1 - G.water.deepen * w * (1 - shelf) * smooth(0.5, 0.85, s)
    }
    // Grass.
    const g = smooth(G.green.from[0], G.green.from[1], h) * (1 - smooth(G.green.to[0], G.green.to[1], h)) * smooth(G.green.sat[0], G.green.sat[1], s)
    if (g > 0) {
      h -= (h - G.green.hueTo) * G.green.hueK * g
      s *= 1 - G.green.desat * g
    }
    // Highlights.
    if (v > G.knee) v = G.knee + (v - G.knee) * G.kneeK
    const [r, gg, b] = hsv2rgb(h, s, v)
    px[k] = Math.round(r * 255); px[k + 1] = Math.round(gg * 255); px[k + 2] = Math.round(b * 255)
  }
  return px
}

/**
 * The night light's grade (scripts/unity-glow.mjs), applied as its tiles are stitched. Unity gives the light
 * as a colour at full brightness and its strength as alpha. Its street lamps came out a cold neutral white,
 * their pools clipping, and on the lawns a neon green (white light on a Kelly-green ground). Street lighting
 * is sodium or warm LED, about 3000 K: so light that is nearly neutral is warmed to that, light off the lawns
 * is warmed and calmed toward yellow-green, and the strongest of it rolls off rather than clipping. Light
 * that has a colour of its own (an amber room, a television's blue, a coloured bulb) keeps it.
 */
// (Unity's lamps are warm themselves now, Night.cs: the warming of near-neutral light stands at nothing.)
export const GLOW = {
  warm: [1, 1, 1], neutral: [0.15, 0.3],
  green: { from: [62, 76], to: [150, 166], sat: [0.22, 0.4], hueTo: 58, hueK: 0.45, desat: 0.35 },
  knee: 0.72, kneeK: 0.45,
}

/** Grades the night light's straight (unpremultiplied) RGBA pixels in place. */
export function gradeGlow(px, W, H, G = GLOW) {
  const n = W * H
  for (let p = 0; p < n; p++) {
    const k = p * 4
    if (px[k + 3] === 0) continue
    let [h, s, v] = rgb2hsv(px[k] / 255, px[k + 1] / 255, px[k + 2] / 255)
    const s0 = s
    // Off a lawn: toward yellow-green, and less of it.
    const g = smooth(G.green.from[0], G.green.from[1], h) * (1 - smooth(G.green.to[0], G.green.to[1], h)) * smooth(G.green.sat[0], G.green.sat[1], s)
    if (g > 0) { h -= (h - G.green.hueTo) * G.green.hueK * g; s *= 1 - G.green.desat * g }
    let [r, gg, b] = hsv2rgb(h, s, v)
    // Warmed to a street lamp's colour (all of the near-neutral light, and the lawns' with it), as bright as it was.
    const w = Math.max(1 - smooth(G.neutral[0], G.neutral[1], s0), g)
    r *= 1 + (G.warm[0] - 1) * w; gg *= 1 + (G.warm[1] - 1) * w; b *= 1 + (G.warm[2] - 1) * w
    const lift = v / Math.max(r, gg, b, 1e-6)
    px[k] = Math.round(r * lift * 255); px[k + 1] = Math.round(gg * lift * 255); px[k + 2] = Math.round(b * lift * 255)
    // The strongest light rolls off.
    const a = px[k + 3] / 255
    if (a > G.knee) px[k + 3] = Math.round((G.knee + (a - G.knee) * G.kneeK) * 255)
  }
  return px
}
