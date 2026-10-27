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
  // Water: hue 160–240, saturation above about 0.3.
  water: { from: [160, 178], to: [228, 242], sat: [0.26, 0.44], desat: 0.16, hueTo: 206, hueK: 0.25, deepen: 0.16 },
  // The shelf's neon cyan (hue 180–195 at high saturation and value) is pulled further toward clear aqua.
  shelf: { hue: [176, 198], val: [0.5, 0.8], desat: 0.16 },
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
