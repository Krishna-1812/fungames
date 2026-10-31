/**
 * Tiny Island — the lights things carry at night.
 *
 * Cars and buses with their headlights (a pool of light on the road ahead)
 * and tail lights; boats with a white light at the masthead, a red or green
 * one at the side and warm windows, each laid on the black water below as a
 * wavering streak; buoys blinking red and green. Whatever carries them names
 * itself with data-lamp (world.ts, town.ts: "car:se", "fishing:w:646.4:700"),
 * and its lights are looked up here, in its own units, so they turn and move
 * with it (and can be put right without baking the island again). The engine (engine.ts) gathers
 * those it drew this frame, then lays their light on after the night's
 * grade, as light, so the dark does not dim it.
 *
 * Two calls a light (three for a headlight's beam, one more for a light on
 * the water), and none by day.
 */
import type { M } from './scene'

/** What a light is: a headlight (and which way it shines), a tail light, a masthead, a side light, a window, a buoy's blink. */
type Kind = 'head' | 'tail' | 'mast' | 'red' | 'green' | 'warm' | 'buoy-r' | 'buoy-g'
/** A light: where on its carrier, which way it shines (a headlight), how high above the water (a boat's). */
type Lit = { kind: Kind; x: number; y: number; dx: number; dy: number; h: number }
/** A carrier's lights, and whether they stand over water (and so are seen again in it). */
type Spec = { water: boolean; lights: Lit[] }
/**
 * A carrier drawn this frame: where (its matrix to the device), how strongly, what it is (its data-lamp),
 * and the window it was drawn through, if it is the copy drawn in front of a building (engine.ts).
 */
export type Lamp = { m: M; a: number; spec: string; win?: { path: Path2D; m: M } | null }

/** Each light: its colour, the radius of its glow (map units) and how hot its middle is. */
const LOOK: Record<Kind, { rgb: string; r: number; core: number }> = {
  head: { rgb: '255, 244, 220', r: 4.2, core: 1 },
  tail: { rgb: '255, 74, 90', r: 3.4, core: 0.9 },
  mast: { rgb: '255, 255, 255', r: 5.5, core: 1 },
  red: { rgb: '255, 80, 80', r: 4, core: 0.95 },
  green: { rgb: '90, 255, 160', r: 4, core: 0.95 },
  warm: { rgb: '255, 224, 168', r: 4.4, core: 0.85 },
  'buoy-r': { rgb: '255, 80, 80', r: 6, core: 1 },
  'buoy-g': { rgb: '90, 255, 160', r: 6, core: 1 },
}
/** A headlight's pool of light: how far ahead it reaches, how wide it spreads, how bright (map units). */
const CONE = { len: 30, half: 9, a: 0.3 }
/** A light's streak on the water: how wide, how bright, and its sway (Hz). */
const STREAK = { w: 3.2, a: 0.42, hz: 0.7 }
/** A buoy's blink: on for one second in four. */
const BLINK = { period: 4, on: 1 }

const specs = new Map<string, Spec>()
/** A carrier's lights, from what it is ("car:se"): "water;mast 8 -66 0 0 64;head 17 0 2 1 4;...", each light its kind, where, which way, how high. */
function parse(key: string): Spec {
  let spec = specs.get(key)
  if (spec) return spec
  spec = { water: false, lights: [] }
  const [what, face, ...at] = key.split(':'), h = face === 'x' ? null : (face as Heading)
  const s = what === 'car' || what === 'bus' ? vehicleSpec(what, h) ?? ''
    : what === 'buoy' ? buoySpec(Number(at[0]), Number(at[1]), face === '1')
    : boatSpec(what as 'sail' | 'ferry' | 'speed' | 'fishing', h, at.length ? [Number(at[0]), Number(at[1])] : undefined)
  for (const part of s.split(';')) {
    const [k, ...v] = part.trim().split(/\s+/)
    const n = v.map(Number)
    if (k === 'water') spec.water = true
    else if (k in LOOK) spec.lights.push({ kind: k as Kind, x: n[0], y: n[1], dx: n[2] ?? 0, dy: n[3] ?? 0, h: n[4] ?? 4 })
  }
  specs.set(key, spec)
  return spec
}

/** The pictures every light is drawn from, made once: a soft glow in each colour, the beam, the streak. */
let pics: { glow: Map<string, HTMLCanvasElement>; cone: HTMLCanvasElement; streak: Map<string, HTMLCanvasElement> } | null = null
function picture() {
  const can = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')!] as const }
  const glow = new Map<string, HTMLCanvasElement>()
  for (const { rgb, core } of Object.values(LOOK)) {
    const key = `${rgb}|${core}`
    if (glow.has(key)) continue
    const [c, g] = can(64, 64)
    // A hot white middle, the light's colour round it, falling away softly.
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32)
    gr.addColorStop(0, `rgba(255, 255, 255, ${core})`)
    gr.addColorStop(0.12, `rgba(${rgb}, ${core})`)
    gr.addColorStop(0.3, `rgba(${rgb}, 0.38)`)
    gr.addColorStop(0.62, `rgba(${rgb}, 0.1)`)
    gr.addColorStop(1, `rgba(${rgb}, 0)`)
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64)
    glow.set(key, c)
  }
  // The beam: from the lamp (0, 32) out along x, widening, fading with distance and to its sides.
  const [cone, cg] = can(128, 64)
  for (let x = 0; x < 128; x++) {
    const t = x / 127, half = 4 + t * 28, a = Math.pow(1 - t, 1.4) * Math.min(1, t * 6)
    const gr = cg.createLinearGradient(0, 32 - half, 0, 32 + half)
    gr.addColorStop(0, 'rgba(255, 240, 210, 0)'); gr.addColorStop(0.5, `rgba(255, 240, 210, ${a})`); gr.addColorStop(1, 'rgba(255, 240, 210, 0)')
    cg.fillStyle = gr; cg.fillRect(x, 32 - half, 1, half * 2)
  }
  // The streak on the water, in each light's colour: long, narrow, brightest near its top, broken into ripples.
  const streak = new Map<string, HTMLCanvasElement>()
  for (const { rgb } of Object.values(LOOK)) {
    if (streak.has(rgb)) continue
    const [sc, sg] = can(16, 96)
    for (let y = 0; y < 96; y++) {
      const t = y / 95, a = (1 - t) * Math.min(1, t * 5) * (0.55 + 0.45 * Math.abs(Math.sin(t * 19)))
      const gr = sg.createLinearGradient(0, 0, 16, 0)
      gr.addColorStop(0, `rgba(${rgb}, 0)`); gr.addColorStop(0.5, `rgba(${rgb}, ${a})`); gr.addColorStop(1, `rgba(${rgb}, 0)`)
      sg.fillStyle = gr; sg.fillRect(0, y, 16, 1)
    }
    streak.set(rgb, sc)
  }
  return { glow, cone, streak }
}

/**
 * The lights of everything gathered this frame, `k` as strong as the time of
 * day wants (none by day). `z` is device pixels to a map unit; `t` seconds;
 * `seen`, whether a light at a point on the device shows (not behind a building).
 * Returns the canvas calls it made.
 */
export function drawLamps(c: CanvasRenderingContext2D, lamps: Lamp[], k: number, z: number, t: number, seen: (x: number, y: number, L: Lamp) => boolean): number {
  if (!lamps.length || k < 0.01) return 0
  if (!pics) pics = picture()
  const W = c.canvas.width, H = c.canvas.height
  let n = 2
  c.save()
  c.setTransform(1, 0, 0, 1, 0, 0)
  c.globalCompositeOperation = 'lighter'
  for (const L of lamps) {
    const { water, lights } = parse(L.spec)
    const [a, b, cc, d, e, f] = L.m
    for (const li of lights) {
      const x = a * li.x + cc * li.y + e, y = b * li.x + d * li.y + f
      const look = LOOK[li.kind]
      // Far out, a light blooms bigger than what carries it, as lights do at night in a photograph.
      const r = look.r * Math.max(z, 1.2)
      if (x < -r * 8 || y < -r * 8 || x > W + r * 8 || y > H + r * 8 || !seen(x, y, L)) continue
      let op = L.a * k
      if (li.kind === 'buoy-r' || li.kind === 'buoy-g') {
        // On for a second in four, each buoy at its own moment, snapping on and fading off.
        const p = ((t + li.x * 0.013) % BLINK.period + BLINK.period) % BLINK.period
        op *= p < BLINK.on ? 1 - Math.pow(p / BLINK.on, 3) * 0.6 : 0
        if (op < 0.01) continue
      }
      if (li.kind === 'head' && (li.dx || li.dy)) {
        // The beam on the road ahead, turned the way the carrier faces on the screen.
        const ux = a * li.dx + cc * li.dy, uy = b * li.dx + d * li.dy, l = Math.hypot(ux, uy) || 1
        const fx = ux / l, fy = uy / l, L2 = CONE.len * z, w = CONE.half * z * 2
        c.setTransform(fx * L2 / 128, fy * L2 / 128, -fy * w / 64 * 0.6, fx * w / 64 * 0.6, x, y)
        c.globalAlpha = op * CONE.a
        c.drawImage(pics.cone, 0, -32)
        c.setTransform(1, 0, 0, 1, 0, 0)
        n += 3
      }
      c.globalAlpha = Math.min(1, op)
      c.drawImage(pics.glow.get(`${look.rgb}|${look.core}`)!, x - r, y - r, r * 2, r * 2)
      n++
      if (water) {
        // Its streak on the water, from the water line under it down as far again as it stands above, swaying.
        const above = Math.max(3, li.h) * z, wy = y + above
        const sway = 1 + 0.15 * Math.sin(t * STREAK.hz * Math.PI * 2 + li.x * 0.7 + li.y)
        const h = (above * 1.6 + 10 * z) * sway, sw = Math.max(2, STREAK.w * z)
        c.globalAlpha = Math.min(1, op * STREAK.a)
        c.drawImage(pics.streak.get(look.rgb)!, x - sw / 2, wy + 1 * z, sw, h)
        n++
      }
    }
  }
  c.restore()
  return n
}

/* ---- what carries lights (for world.ts and town.ts, as data-lamp) ---- */

/** A car or a bus (a bike carries none) on a facing, or the drawn one (null). */
export const vehicleLamps = (kind: 'car' | 'bus' | 'bike', facing: string | null) => kind === 'bike' ? undefined : `${kind}:${facing ?? 'x'}`
/** A boat on a heading, or the drawn one (null); `at`, where one is drawn in place (the fishing boats). */
export const boatLamps = (kind: 'sail' | 'ferry' | 'speed' | 'fishing', facing: string | null, at?: [number, number]) => `${kind}:${facing ?? 'x'}${at ? `:${r1(at[0])}:${r1(at[1])}` : ''}`
/** A buoy at x, y, Unity's or drawn. */
export const buoyLamp = (x: number, y: number, real: boolean) => `buoy:${real ? 1 : 0}:${r1(x)}:${r1(y)}`

/* ---- where each carrier's lights are ---- */

type Heading = 'se' | 'sw' | 'nw' | 'ne' | 's' | 'w' | 'n' | 'e'
type Spot = [Kind, number, number, number?, number?, number?]
const r1 = (v: number) => Math.round(v * 10) / 10
/** Lights as data-lamp: on the water (each light's height above it last) or not. */
const spec = (water: boolean, spots: Spot[], at: [number, number] = [0, 0]) =>
  (water ? 'water;' : '') + spots.map(([k, x, y, dx = 0, dy = 0, h = 4]) => [k, r1(x + at[0]), r1(y + at[1]), dx, dy, h].join(' ')).join(';')
const mirror = (s: Spot[]): Spot[] => s.map(([k, x, y, dx = 0, dy = 0, h]) => [k, -x, y, -dx, dy, h])

/**
 * A car's or a bus's lights: Unity's on each of its four facings (measured on
 * its pictures: the near headlight, the far one, the tail lights), or the
 * drawn one's (facing +x, turned and skewed with it).
 */
function vehicleSpec(kind: 'car' | 'bus', facing: Heading | null): string | undefined {
  if (!facing) return spec(false, kind === 'bus' ? [['head', 19.5, -4, 1, 0], ['tail', -19.5, -4]] : [['head', 11.5, -4, 1, 0], ['tail', -11.5, -4]])
  const car: Record<string, Spot[]> = {
    se: [['head', 17, 0.5, 2, 1], ['head', 11, 3.6, 2, 1], ['tail', -18, -10], ['tail', -12, -12.6]],
    nw: [['head', -17, -10.6, -2, -1], ['head', -11, -13.5, -2, -1], ['tail', 17.4, -1.2], ['tail', 9.2, 3.1]],
  }
  const bus: Record<string, Spot[]> = {
    se: [['head', 33, 16.5, 2, 1], ['head', 44.5, 11, 2, 1], ['tail', -44.7, -19], ['tail', -34, -24]],
    nw: [['head', -44.7, -19, -2, -1], ['head', -34.5, -24, -2, -1], ['tail', 33, 19], ['tail', 44, 11.5]],
  }
  const t = kind === 'bus' ? bus : car
  // South-west and north-east are the others seen in a mirror.
  return spec(false, facing === 'sw' ? mirror(t.se) : facing === 'ne' ? mirror(t.nw) : t[facing] ?? t.se)
}

/** Unity's sailing boat on each heading: its masthead and its bow (measured on its pictures); the hull's middle is at (0, -4). */
const SAIL: Record<Heading, [[number, number], [number, number]]> = {
  e: [[9.2, -67], [30, -4]], se: [[6.5, -63.6], [21, 8]], s: [[0, -65], [0, 11]], sw: [[-7.8, -63.6], [-23, 8]],
  w: [[-10.5, -67], [-31, -1]], nw: [[-7.8, -70], [-23, -16]], n: [[-1, -74], [-2.4, -19]], ne: [[7.8, -70], [18, -16]],
}

/**
 * A boat's lights: a white masthead, the side light that faces you (green to
 * starboard, red to port), its windows; each with its height above the water.
 * `at` is where it is drawn, for those drawn in place (the fishing boats).
 */
function boatSpec(kind: 'sail' | 'ferry' | 'speed' | 'fishing', facing: Heading | null, at: [number, number] = [0, 0]): string {
  if (kind === 'sail') {
    if (!facing) return spec(true, [['mast', 1.1, -37.4, 0, 0, 38], ['red', -16, -4, 0, 0, 4], ['green', 16, -4, 0, 0, 4]])
    const [[mx, my], [bx, by]] = SAIL[facing]
    const sx = bx * 0.55, sy = -4 + (by + 4) * 0.55 - 2
    // Heading east you see its starboard side, west its port; coming at you, both; going away, its stern.
    const side: Spot[] = facing === 's' ? [['red', 6, sy, 0, 0, 4], ['green', -6, sy, 0, 0, 4]]
      : facing === 'n' ? [['warm', 0, -4 - (by + 4) * 0.6, 0, 0, 4]]
      : [[facing.includes('e') ? 'green' : 'red', sx, sy, 0, 0, 4]]
    return spec(true, [['mast', mx, my, 0, 0, 64], ...side, ['warm', 0, -9, 0, 0, 6]])
  }
  if (kind === 'ferry') {
    if (!facing) return spec(true, [['mast', -28, -12, 0, 0, 14], ['red', -26, -3, 0, 0, 5], ...[-10.4, -3.4, 3.6, 10.6, 17.6].map((x): Spot => ['warm', x, -12.5, 0, 0, 15])])
    // The windows along its near side, from the stern to the bow.
    const row = (a: [number, number], b: [number, number]) => [0.1, 0.3, 0.5, 0.7, 0.9].map((t): Spot => ['warm', a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, 0, 0, 12])
    return facing === 'sw'
      ? spec(true, [['mast', -17.8, -34.7, 0, 0, 40], ['red', -30, 5, 0, 0, 6], ...row([-8, 6], [38.7, -15])])
      : spec(true, [['mast', 17.5, -52, 0, 0, 45], ['green', 30, -22, 0, 0, 6], ...row([-38, 8], [28, -10])])
  }
  if (kind === 'speed') {
    if (!facing) return spec(true, [['warm', 3, -8, 0, 0, 8], ['red', -14, -3, 0, 0, 3]])
    return facing === 'w' ? spec(true, [['warm', -3.2, -13, 0, 0, 8], ['red', -22, -6, 0, 0, 3]]) : spec(true, [['warm', 2.2, -13, 0, 0, 8], ['green', 22, -6, 0, 0, 3]])
  }
  // A fishing boat at anchor: its anchor light at the masthead, and the wheelhouse lit.
  if (!facing) return spec(true, [['mast', -9, -30, 0, 0, 30], ['warm', 7.5, -11, 0, 0, 12]], at)
  const s: Spot[] = [['mast', 16, -46, 0, 0, 44], ['warm', -13.5, -9, 0, 0, 10]]
  return spec(true, facing === 'w' ? mirror(s) : s, at)
}

/** A buoy's light, blinking on its top. */
function buoySpec(x: number, y: number, real: boolean, green = false): string {
  return spec(true, [[green ? 'buoy-g' : 'buoy-r', x, y - (real ? 11 : 14), 0, 0, real ? 11 : 14]])
}
