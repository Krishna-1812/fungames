/**
 * The hour.
 *
 * Twenty-six problems take a day: the first is asked a little after sunrise
 * and the last under the moon, and the light moves a twenty-fifth of the way
 * each time. Nothing in the questions says so. It is there because a decision
 * made at noon and the same decision made at dusk do not feel like the same
 * decision, and because the long shadows are the best thing a low sun does.
 *
 * Every figure is a key on a single track `u` from 0 to 1, interpolated.
 */

export type Hour = {
  /** Sun (or, after dark, moon) elevation and bearing, degrees. Bearing 0 is behind the camera, 180 over the hills. */
  el: number
  az: number
  /** Where the sky model thinks the sun is; it goes below the horizon while the key light becomes the moon. */
  skyEl: number
  turbidity: number
  rayleigh: number
  sun: [number, number, number]
  sunPower: number
  /** Fill from the sky and from the ground. */
  fillSky: [number, number, number]
  fillGround: [number, number, number]
  fill: number
  /** How much of the sky's own light the surfaces take. */
  env: number
  fog: [number, number, number]
  fogDensity: number
  exposure: number
  clouds: number
  stars: number
  /** Lamps, windows and the headlight: 0 by day, 1 after dark. */
  lamps: number
}

const KEYS: Array<[number, Hour]> = [
  [0, {
    el: 15, az: -64, skyEl: 15, turbidity: 5, rayleigh: 2.4, sun: [1, 0.8, 0.6], sunPower: 3.4,
    fillSky: [0.62, 0.72, 0.95], fillGround: [0.42, 0.36, 0.26], fill: 0.5, env: 0.55,
    fog: [0.86, 0.78, 0.7], fogDensity: 0.0045, exposure: 0.5, clouds: 0.42, stars: 0, lamps: 0,
  }],
  [0.24, {
    el: 36, az: -48, skyEl: 36, turbidity: 3, rayleigh: 1.4, sun: [1, 0.95, 0.86], sunPower: 4.2,
    fillSky: [0.6, 0.76, 1], fillGround: [0.4, 0.4, 0.28], fill: 0.55, env: 0.5,
    fog: [0.72, 0.82, 0.93], fogDensity: 0.0033, exposure: 0.44, clouds: 0.38, stars: 0, lamps: 0,
  }],
  [0.5, {
    el: 58, az: -22, skyEl: 58, turbidity: 2.4, rayleigh: 1.1, sun: [1, 0.98, 0.94], sunPower: 4.6,
    fillSky: [0.58, 0.76, 1], fillGround: [0.4, 0.42, 0.28], fill: 0.6, env: 0.5,
    fog: [0.7, 0.82, 0.95], fogDensity: 0.0030, exposure: 0.42, clouds: 0.34, stars: 0, lamps: 0,
  }],
  [0.72, {
    el: 30, az: 52, skyEl: 30, turbidity: 3.4, rayleigh: 1.6, sun: [1, 0.9, 0.74], sunPower: 4.2,
    fillSky: [0.6, 0.74, 1], fillGround: [0.44, 0.4, 0.28], fill: 0.52, env: 0.5,
    fog: [0.78, 0.82, 0.9], fogDensity: 0.0035, exposure: 0.45, clouds: 0.44, stars: 0, lamps: 0,
  }],
  [0.86, {
    el: 9, az: 84, skyEl: 8, turbidity: 8, rayleigh: 3, sun: [1, 0.62, 0.36], sunPower: 3.6,
    fillSky: [0.62, 0.6, 0.86], fillGround: [0.5, 0.36, 0.26], fill: 0.42, env: 0.55,
    fog: [0.9, 0.68, 0.56], fogDensity: 0.0048, exposure: 0.52, clouds: 0.5, stars: 0, lamps: 0.35,
  }],
  [0.93, {
    el: 34, az: -50, skyEl: -3.5, turbidity: 9, rayleigh: 3.4, sun: [0.52, 0.62, 1], sunPower: 0.5,
    fillSky: [0.4, 0.46, 0.8], fillGround: [0.3, 0.26, 0.3], fill: 0.5, env: 0.9,
    fog: [0.42, 0.4, 0.56], fogDensity: 0.0051, exposure: 0.85, clouds: 0.4, stars: 0.35, lamps: 1,
  }],
  [1, {
    el: 42, az: -48, skyEl: -16, turbidity: 6, rayleigh: 2, sun: [0.56, 0.68, 1], sunPower: 1.15,
    fillSky: [0.2, 0.28, 0.6], fillGround: [0.1, 0.1, 0.16], fill: 0.55, env: 1,
    fog: [0.05, 0.07, 0.14], fogDensity: 0.0054, exposure: 1, clouds: 0.25, stars: 1, lamps: 1,
  }],
]

const mix = (a: number, b: number, t: number) => a + (b - a) * t
const mix3 = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)]

export function hourAt(u: number): Hour {
  const x = Math.max(0, Math.min(1, u))
  let i = 0
  while (i < KEYS.length - 2 && KEYS[i + 1][0] < x) i++
  const [ua, a] = KEYS[i], [ub, b] = KEYS[i + 1]
  const lin = (x - ua) / (ub - ua), t = lin * lin * (3 - 2 * lin)
  // The key light jumps from the sun to the moon between two keys; turning it
  // through the ground would light everything from underneath on the way.
  const swap = Math.abs(a.az - b.az) > 150
  return {
    el: swap ? (t < 0.5 ? a.el : b.el) : mix(a.el, b.el, t),
    az: swap ? (t < 0.5 ? a.az : b.az) : mix(a.az, b.az, t),
    skyEl: mix(a.skyEl, b.skyEl, t),
    turbidity: mix(a.turbidity, b.turbidity, t), rayleigh: mix(a.rayleigh, b.rayleigh, t),
    sun: mix3(a.sun, b.sun, t),
    sunPower: swap ? (t < 0.5 ? a.sunPower * (1 - t * 2) : b.sunPower * (t * 2 - 1)) : mix(a.sunPower, b.sunPower, t),
    fillSky: mix3(a.fillSky, b.fillSky, t), fillGround: mix3(a.fillGround, b.fillGround, t), fill: mix(a.fill, b.fill, t),
    env: mix(a.env, b.env, t), fog: mix3(a.fog, b.fog, t), fogDensity: mix(a.fogDensity, b.fogDensity, t),
    exposure: mix(a.exposure, b.exposure, t), clouds: mix(a.clouds, b.clouds, t), stars: mix(a.stars, b.stars, t),
    lamps: mix(a.lamps, b.lamps, t),
  }
}

/** Unit vector towards the light. */
export function sunDir(el: number, az: number): [number, number, number] {
  const e = (el * Math.PI) / 180, a = (az * Math.PI) / 180
  return [Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a)]
}
