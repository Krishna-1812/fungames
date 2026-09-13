/**
 * A star's real apparent colour, from its real B-V colour index — not an
 * artistic tint. Two real, published steps:
 *
 * 1. B-V to temperature: Ballesteros (2012), "New insights into black body
 *    radiation" (EPL 97 34008) — a closed-form approximation treating a
 *    star as a black body seen through the B and V filter bands.
 * 2. Temperature to RGB: Tanner Helland's widely-used blackbody
 *    approximation (tannerhelland.com, 2012), fitted to Mitchell Charity's
 *    published blackbody colour table. Helland's own note applies here too:
 *    "a high-quality approximation," not spectroscopy — good enough to tell
 *    Betelgeuse's red from Rigel's blue-white, not a lab instrument.
 *
 * `scripts/check-star-color.mjs` checks both stages against real reference
 * stars: the Sun's own B-V (0.65) reproduces its own well-known ~5778K
 * effective temperature, and Betelgeuse/Rigel/Vega land in the right real
 * colour bands.
 */

/** Ballesteros 2012. Returns kelvin. */
export function bvToKelvin(bv: number): number {
  return 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62))
}

const clamp255 = (v: number) => Math.max(0, Math.min(255, v))

/** Tanner Helland's blackbody approximation. Input in kelvin, output 0-255 RGB. */
export function kelvinToRgb(kelvinIn: number): [number, number, number] {
  const t = Math.max(1000, Math.min(40000, kelvinIn)) / 100

  const red = t <= 66 ? 255 : clamp255(329.698727446 * Math.pow(t - 60, -0.1332047592))
  const green =
    t <= 66
      ? clamp255(99.4708025861 * Math.log(t) - 161.1195681661)
      : clamp255(288.1221695283 * Math.pow(t - 60, -0.0755148492))
  let blue: number
  if (t >= 66) blue = 255
  else if (t <= 19) blue = 0
  else blue = clamp255(138.5177312231 * Math.log(t - 10) - 305.0447927307)

  return [Math.round(red), Math.round(green), Math.round(blue)]
}

/** The Sun's own real B-V index — the fallback for a star with none recorded. */
export const SUN_BV = 0.65

/** A star's real apparent colour as a CSS `rgb()` string, from its B-V index. */
export function starColor(ci: number | null): string {
  const [r, g, b] = kelvinToRgb(bvToKelvin(ci ?? SUN_BV))
  return `rgb(${r},${g},${b})`
}
