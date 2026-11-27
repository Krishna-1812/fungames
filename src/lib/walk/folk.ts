/**
 * The island's people, out on its pavements (walker.ts).
 *
 * Every street has a pavement down any side with no road off it (terrain.ts
 * draws them: a strip 0.16 of a tile wide, about a metre and a half), and
 * people walk them: each keeps to one side of the street, goes on straight
 * more often than it turns, and at a junction crosses the road leaving it on
 * its zebra — first looking for traffic and waiting for a gap; the traffic
 * (traffic.ts) waits for anyone on a crossing. At a dead end they turn round.
 * They step round lamp posts and bins, round one another (each to their own
 * right when they meet; behind someone slower, out and past), and round you;
 * now and then one stops to look at a phone, or for nothing much. A few stand
 * in pairs on corners, talking, hands going; some sit on the benches. At a
 * junction with traffic lights (street.ts) they cross only while the traffic
 * they cross has red. Fewer are out after dark.
 *
 * Each is somebody: a height from 1.55 to 1.92 m, slighter or broader, a skin
 * tone, hair (short, long, none; dark, fair, grey), a T-shirt or a long-
 * sleeved top or a dress, jeans or trousers or shorts or a skirt, trainers
 * or shoes, some with a bag over the shoulder or a backpack; walking at their
 * own pace (a few jog); when it rains, fewer are out, and most of those who
 * are put up an umbrella, held over their heads. They are jointed as you are (body.ts) and walk as you
 * do — a stride from their speed, arms against legs, hips rising and falling
 * — and drawn together: one draw for each part of a body (the heads, the
 * torsos, the shins) for everyone on the island.
 */
import {
  CapsuleGeometry, Color, CylinderGeometry, DoubleSide, Euler, Group, InstancedMesh, LatheGeometry, Matrix4, MeshStandardMaterial, Quaternion, SphereGeometry,
  Vector2, Vector3, type BufferGeometry, type Scene,
} from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { METRE } from './body'
import { Bag, place, seeded } from './kit'

type Box = { i0: number; i1: number; j0: number; j1: number; z0: number; z1: number }
/** A car, for people to look out for: where it is, its heading and speed (tiles), its footprint. */
export type CarNear = { x: number; z: number; hx: number; hz: number; v: number; hl: number; hw: number; yaw: number }

/** The pavement's middle, from the middle of the road (tiles); and its half-width, less a person's. */
const OFF = 0.42, ROOM = 0.048
/** The four ways along a street (x along j, z along i): north, south, west, east. */
const DX = [0, 0, -1, 1], DZ = [-1, 1, 0, 0], BACK = [1, 0, 3, 2]
const key = (i: number, j: number) => i * 1000 + j

/* ------------------------------------------------------------------ the bodies ---- */

/** Skin, hair, clothes: real ranges, in the cool palette for what is dyed. */
const SKIN = ['#f3d6c1', '#eac0a0', '#dcaa86', '#c99067', '#ad7650', '#8d5a37', '#6d4428', '#4f3120']
const HAIR = ['#17120f', '#2a1d16', '#3b2a20', '#56392a', '#7b5b3e', '#b89466', '#8f2f24', '#9d9a96', '#dcd9d4']
const TOPS = ['#f2f4f7', '#1f2a44', '#3a6ea5', '#4f8f8a', '#8fb3cf', '#2d2f33', '#7a7f87', '#6c4f7c', '#8e2a38', '#3f6b4f', '#c7cdd6', '#5f86b6', '#dfe7ee', '#24464f', '#a7b9c9', '#e9e4dc']
const LEGS = ['#2f3d5c', '#3a4a6a', '#1d1f24', '#55595f', '#a99c80', '#232c42', '#6e7b8a', '#46505e', '#d9d6cf']
const FEET = ['#f2f4f8', '#1c1d20', '#4a3426', '#7d8590', '#e4e6ea', '#2a3346']
const BROLLIES = ['#1d1f24', '#25324f', '#3a6ea5', '#7a7f87', '#8e2a38', '#2f5f55', '#e9e4dc', '#4f8f8a']
const BAGS = ['#3a2a20', '#1d1f24', '#2b3a55', '#6b4a33', '#5a6470', '#26464f']

type Look = {
  tall: number; broad: number; hips: number
  skin: Color; hair: Color; top: Color; legs: Color; feet: Color; bag: Color; brolly: Color | null
  /** Hair: 0 none, 1 short, 2 long. Top: 0 T-shirt, 1 long sleeves, 2 dress. Legs: 0 long, 1 shorts, 2 skirt. Carrying: 0 nothing, 1 a bag, 2 a backpack. */
  hairStyle: number; topStyle: number; legStyle: number; carry: number
  pace: number; jog: boolean
}

function someone(rnd: () => number, n: number): Look {
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)]
  const c = (h: string) => new Color(h)
  const slight = rnd() < 0.5
  const topStyle = rnd() < (slight ? 0.18 : 0.02) ? 2 : rnd() < 0.42 ? 1 : 0
  const legStyle = topStyle === 2 ? 2 : rnd() < (slight ? 0.16 : 0.02) ? 2 : rnd() < 0.24 ? 1 : 0
  const grey = rnd() < 0.16
  const jog = n % 13 === 5
  return {
    tall: (slight ? 1.6 + rnd() * 0.17 : 1.7 + rnd() * 0.2) / 1.75 * (n % 17 === 3 ? 0.84 : 1),
    broad: (slight ? 0.88 : 1) * (0.92 + rnd() * 0.2), hips: slight ? 1.08 : 0.96,
    skin: c(pick(SKIN)), hair: c(grey ? pick(HAIR.slice(7)) : pick(HAIR.slice(0, 7))), top: c(pick(TOPS)), legs: c(legStyle === 1 && rnd() < 0.5 ? pick(['#a99c80', '#3a4a6a', '#5a6470', '#d9d6cf']) : pick(LEGS)),
    feet: c(pick(FEET)), bag: c(pick(BAGS)), brolly: !jog && rnd() < 0.7 ? c(pick(BROLLIES)) : null,
    hairStyle: !slight && rnd() < 0.12 ? 0 : slight && rnd() < 0.7 ? 2 : 1,
    topStyle, legStyle, carry: jog ? 0 : rnd() < 0.22 ? 1 : rnd() < 0.18 ? 2 : 0,
    pace: jog ? 2.9 : (1.05 + rnd() * 0.5) * (grey ? 0.82 : 1), jog,
  }
}

/** The parts of a body, each one shape drawn for everyone: which joint it hangs from, and what it is made of. */
type Part = { geo: BufferGeometry; joint: number; mat: number; shadow: boolean; two?: boolean }
/** Joints: 0 root, 1 hips, 2 torso, 3 neck, 4 head, 5/6 shoulders, 7/8 elbows, 9/10 hips, 11/12 knees, 13/14 ankles. */
const J = { root: 0, hips: 1, torso: 2, neck: 3, head: 4, sh: 5, el: 7, hip: 9, knee: 11, ank: 13 }

function bodyParts() {
  const cap = (r: number, len: number, y: number, sx = 1, sz = 1, seg = 7) => new Bag().add(new CapsuleGeometry(r, len, 2, seg), place(0, y, 0, 0, 0, 0, sx, 1, sz)).geometry(1)
  const dark = new Color(0.07, 0.06, 0.06), brow = new Color(0.42, 0.36, 0.34), lip = new Color(0.82, 0.62, 0.6), white = new Color(1, 1, 1)
  // The torso: waist, chest, shoulders, turned in to the neck (an ellipse in plan, deeper at the chest).
  const torso = new Bag().add(new LatheGeometry([[0.0, -0.03], [0.13, -0.02], [0.135, 0.08], [0.128, 0.16], [0.142, 0.27], [0.15, 0.36], [0.142, 0.42], [0.1, 0.475], [0.05, 0.5], [0.0, 0.505]].map(([r, y]) => new Vector2(r, y)), 12), place(0, 0, 0, 0, 0, 0, 1.2, 1, 0.74)).geometry(1)
  const head = new Bag()
    .add(new SphereGeometry(0.105, 11, 8), place(0, 0.11, 0, 0, 0, 0, 0.9, 1.12, 1))
    .add(new SphereGeometry(0.06, 8, 5), place(0, 0.06, 0.03, 0, 0, 0, 1.2, 0.9, 1.1)) // jaw
    .add(new SphereGeometry(0.013, 5, 3), place(0.036, 0.122, 0.093), dark).add(new SphereGeometry(0.013, 5, 3), place(-0.036, 0.122, 0.093), dark)
    .add(new SphereGeometry(0.02, 5, 3), place(0.037, 0.148, 0.092, 0, 0, 0, 1.4, 0.3, 0.5), brow).add(new SphereGeometry(0.02, 5, 3), place(-0.037, 0.148, 0.092, 0, 0, 0, 1.4, 0.3, 0.5), brow)
    .add(new SphereGeometry(0.019, 5, 3), place(0, 0.098, 0.106, 0, 0, 0, 0.8, 1.1, 1.1))
    .add(new SphereGeometry(0.02, 5, 3), place(0, 0.058, 0.084, 0, 0, 0, 1.3, 0.38, 0.6), lip)
    .add(new SphereGeometry(0.022, 5, 3), place(0.096, 0.105, -0.005, 0, 0, 0, 0.5, 1, 0.8)).add(new SphereGeometry(0.022, 5, 3), place(-0.096, 0.105, -0.005, 0, 0, 0, 0.5, 1, 0.8))
    .geometry(1)
  const hairShort = new Bag().add(new SphereGeometry(0.113, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.62), place(0, 0.12, -0.012, -0.32, 0, 0, 0.96, 1.02, 1.04)).geometry(1)
  const hairLong = new Bag()
    .add(new SphereGeometry(0.115, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.6), place(0, 0.12, -0.01, -0.3, 0, 0, 0.98, 1.04, 1.05))
    .add(new CapsuleGeometry(0.085, 0.16, 2, 8), place(0, 0.04, -0.05, 0.12, 0, 0, 1.12, 1, 0.55))
    .geometry(1)
  const foot = new Bag()
    .add(new CapsuleGeometry(0.045, 0.17, 2, 6), place(0, -0.02, 0.055, Math.PI / 2, 0, 0, 1, 1, 0.75))
    .add(new CapsuleGeometry(0.047, 0.17, 1, 6), place(0, -0.042, 0.055, Math.PI / 2, 0, 0, 1.02, 1, 0.3), new Color(0.32, 0.33, 0.36))
    .geometry(1)
  const skirt = new Bag().add(new CylinderGeometry(0.165, 0.25, 0.5, 11, 1, true), place(0, -0.17, 0, 0, 0, 0, 1.08, 1, 0.82)).geometry(1)
  const bag = new Bag()
    .add(new RoundedBoxGeometry(0.07, 0.2, 0.25, 1, 0.02), place(0.2, -0.02, 0.02))
    .add(new RoundedBoxGeometry(0.012, 0.66, 0.035, 1, 0.005), place(0.02, 0.27, 0.0, 0, 0, -0.62, 1, 1, 1), new Color(0.6, 0.6, 0.6))
    .geometry(1)
  const pack = new Bag()
    .add(new RoundedBoxGeometry(0.29, 0.38, 0.15, 1, 0.05), place(0, 0.26, -0.17))
    .add(new RoundedBoxGeometry(0.2, 0.12, 0.05, 1, 0.02), place(0, 0.16, -0.25), new Color(0.82, 0.82, 0.82))
    .geometry(1)
  // An umbrella, held up in the right hand: the shaft from the hand, the canopy of eight gores on its ribs, the tip.
  // (Built along +y from the hand, then turned to stand upright for the arm's pose when holding it: fore-arm raised 1.9 radians.)
  const brolly = (() => {
    // (Leaning in, so the canopy is over the head, not the hand.)
    const b = new Bag(), up = place(0, -0.26, 0.01, 1.9, 0, -0.34)
    const dark = new Color(0.12, 0.12, 0.13)
    const part = (g: BufferGeometry, m: Matrix4, c?: Color) => b.add(g, up.clone().multiply(m), c)
    part(new CylinderGeometry(0.007, 0.007, 0.84, 5), place(0, 0.32, 0), dark)
    part(new CylinderGeometry(0.016, 0.014, 0.1, 6), place(0, -0.06, 0), dark)
    part(new LatheGeometry([[0.0, 0.17], [0.16, 0.15], [0.32, 0.1], [0.46, 0.02], [0.5, -0.02]].map(([r, y]) => new Vector2(r, y)), 8), place(0, 0.62, 0))
    part(new CylinderGeometry(0.004, 0.006, 0.07, 4), place(0, 0.82, 0), dark)
    return b.geometry(1)
  })()
  // The materials: 0 skin, 1 cloth, 2 hair, 3 shoes, 4 bags, 5 an umbrella's canopy (seen from under it too).
  const parts: Record<string, Part> = {
    pelvis: { geo: cap(0.15, 0.08, 0.03, 1.1, 0.78), joint: J.hips, mat: 1, shadow: true },
    torso: { geo: torso, joint: J.torso, mat: 1, shadow: true },
    neck: { geo: cap(0.05, 0.06, 0.03), joint: J.neck, mat: 0, shadow: false },
    head: { geo: head, joint: J.head, mat: 0, shadow: true },
    hairS: { geo: hairShort, joint: J.head, mat: 2, shadow: false },
    hairL: { geo: hairLong, joint: J.head, mat: 2, shadow: false },
    sleeve: { geo: cap(0.056, 0.08, -0.06), joint: J.sh, mat: 1, shadow: false, two: true },
    upper: { geo: cap(0.042, 0.2, -0.15), joint: J.sh, mat: 0, shadow: false, two: true },
    fore: { geo: cap(0.036, 0.19, -0.12), joint: J.el, mat: 0, shadow: false, two: true },
    hand: { geo: new Bag().add(new SphereGeometry(0.045, 6, 4), place(0, -0.26, 0.005, 0, 0, 0, 0.8, 1.15, 0.7)).geometry(1), joint: J.el, mat: 0, shadow: false, two: true },
    thighHi: { geo: cap(0.072, 0.14, -0.12), joint: J.hip, mat: 1, shadow: true, two: true },
    thighLo: { geo: cap(0.062, 0.16, -0.3), joint: J.hip, mat: 1, shadow: true, two: true },
    shin: { geo: cap(0.055, 0.31, -0.2), joint: J.knee, mat: 1, shadow: true, two: true },
    shoe: { geo: foot, joint: J.ank, mat: 3, shadow: false, two: true },
    skirt: { geo: skirt, joint: J.hips, mat: 1, shadow: true },
    bag: { geo: bag, joint: J.torso, mat: 4, shadow: false },
    pack: { geo: pack, joint: J.torso, mat: 4, shadow: false },
    brolly: { geo: brolly, joint: J.el + 1, mat: 5, shadow: true },
  }
  return parts
}

/* ------------------------------------------------------------------ the people ---- */

type Person = {
  look: Look
  /** Where along the street: the tile being walked to, the way in and the way out of it, which side. */
  ti: number; tj: number; din: number; dout: number; side: number
  /** The point being walked to, and the one before it (the straight between them is the path). */
  ax: number; az: number; bx: number; bz: number
  /** Along the path (the base point), stepped out to the side of it (lat, towards latT), and where drawn. */
  x: number; z: number; lat: number; latT: number; px: number; pz: number; py: number; yaw: number
  v: number; phase: number; breathe: number; stuck: number
  /** What they are doing: walking, standing a while (looking at a phone, or not), waiting to cross, talking. */
  mode: 'walk' | 'pause' | 'wait' | 'talk' | 'sit'; timer: number; phone: boolean; gesture: number
  /** Holding an umbrella up (it is raining, and they have one). */
  brolly: boolean
  shown: boolean; out: boolean
  /** Their joints' angles now (eased towards what they are doing). */
  a: Float32Array
}

export type Folk = ReturnType<typeof folk>

export function folk(scene: Scene, o: {
  roads: [number, number][]; heightAt(x: number, z: number): number; boxes: Box[]; seed?: number; count?: number
  /** Benches to sit on (where, facing which way). */
  seats?: { x: number; z: number; y: number; yaw: number }[]
  /** At traffic lights: whether someone may cross a junction's road whose traffic runs one way (it has red). */
  mayCross?: (i: number, j: number, axis: 'ns' | 'ew') => boolean
}) {
  const rnd = seeded(o.seed ?? 7)
  const roads = new Set(o.roads.map(([i, j]) => key(i, j)))
  const R_ = (i: number, j: number) => roads.has(key(i, j))
  const links = (i: number, j: number) => [0, 1, 2, 3].filter((d) => R_(i + DZ[d], j + DX[d]))

  /** Whether a point is on a pavement (or off the street altogether) rather than in the road: as terrain.ts paints it. */
  const onFoot = (x: number, z: number) => {
    const i = Math.floor(z), j = Math.floor(x)
    if (!R_(i, j)) return true
    const lx = x - j, ly = z - i, W = 0.16
    const cN = R_(i - 1, j), cS = R_(i + 1, j), cW = R_(i, j - 1), cE = R_(i, j + 1)
    const inN = ly < W, inS = 1 - ly < W, inW = lx < W, inE = 1 - lx < W
    if ((!cN && inN) || (!cS && inS) || (!cW && inW) || (!cE && inE)) return true
    return (inN && inW && !R_(i - 1, j - 1)) || (inN && inE && !R_(i - 1, j + 1)) || (inS && inW && !R_(i + 1, j - 1)) || (inS && inE && !R_(i + 1, j + 1))
  }

  // What stands on the streets to be stepped round (a lamp, a bin, a post; a terrace built out over the pavement), filed by tile.
  const near = new Map<number, Box[]>()
  for (const b of o.boxes) {
    for (let i = Math.floor(b.i0); i <= Math.floor(b.i1); i++) for (let j = Math.floor(b.j0); j <= Math.floor(b.j1); j++) {
      if (!R_(i, j)) continue
      const k = key(i, j); if (!near.has(k)) near.set(k, []); near.get(k)!.push(b)
    }
  }
  const PAD = 0.028
  const blocked = (x: number, z: number, y: number) => {
    const l = near.get(key(Math.floor(z), Math.floor(x))); if (!l) return false
    for (const b of l) if (b.z1 > y + 0.03 && b.z0 < y + 0.19 && x > b.j0 - PAD && x < b.j1 + PAD && z > b.i0 - PAD && z < b.i1 + PAD) return true
    return false
  }

  /** Right of a way: −z, x of it; and which side of the street that is, for someone on side s. */
  const rx = (d: number) => -DZ[d], rz = (d: number) => DX[d]
  const sideOf = (s: number, d: number) => [0, 1, 2, 3].find((e) => DX[e] === s * rx(d) && DZ[e] === s * rz(d))!
  /**
   * Where along a street's side to walk (its distance from the middle of the road): down the middle of the pavement,
   * or nearer the kerb where something is built out over it (a terrace, a step), or along the gutter; null if not even
   * that is clear the length of the tile (then nobody walks that side of it).
   */
  const lanes = new Map<number, number | null>()
  const lineAt = (i: number, j: number, d: number) => {
    const k = key(i, j) * 4 + d
    if (lanes.has(k)) return lanes.get(k)!
    const cx = j + 0.5, cz = i + 0.5, ax = DZ[d] !== 0 ? 1 : 0, az = 1 - ax, y = o.heightAt(cx, cz)
    let found: number | null = null
    for (let off = OFF; off >= 0.29 && found === null; off -= 0.02) {
      let bad = 0
      for (let t = -0.45; t <= 0.45; t += 0.1) {
        const x = cx + DX[d] * off + ax * t, z = cz + DZ[d] * off + az * t
        const l = near.get(key(Math.floor(z), Math.floor(x))) ?? []
        if (l.some((b) => (b.j1 - b.j0 > 0.08 || b.i1 - b.i0 > 0.08) && b.z1 > y + 0.03 && b.z0 < y + 0.19 && x > b.j0 - PAD && x < b.j1 + PAD && z > b.i0 - PAD && z < b.i1 + PAD)) bad++
      }
      // (A bench or a planter is stepped round as they come to it; a terrace the length of the street is not.)
      if (bad <= 2) found = off
    }
    lanes.set(k, found)
    return found
  }
  /** The way on from a tile, come into it going din on side s: straight on more often than not, round a dead end; never down a side with nowhere to walk. */
  const onward = (i: number, j: number, din: number, s: number) => {
    const ok = (d: number) => lineAt(i, j, sideOf(s, d)) !== null && lineAt(i + DZ[d], j + DX[d], sideOf(s, d)) !== null
    const ways = links(i, j).filter((d) => d !== BACK[din] && ok(d))
    if (!ways.length) return BACK[din]
    if (ways.includes(din) && rnd() < 0.55) return din
    return ways[Math.floor(rnd() * ways.length)]
  }
  /** The point a walker on side s turns at in a tile (in going din, out going dout). */
  const corner = (p: Person) => {
    const cx = p.tj + 0.5, cz = p.ti + 0.5, s = p.side, a = p.din, b = p.dout
    const la = lineAt(p.ti, p.tj, sideOf(s, a)) ?? 0.3, lb = lineAt(p.ti, p.tj, sideOf(s, b)) ?? 0.3
    if (a === b) return [cx + s * la * rx(a), cz + s * la * rz(a)]
    if (b === BACK[a]) {
      // (Round the end of a dead end: as far along as is clear of anything built there.)
      let reach = 0.28
      while (reach > 0.02 && blocked(cx + s * la * rx(a) + DX[a] * reach, cz + s * la * rz(a) + DZ[a] * reach, o.heightAt(cx, cz))) reach -= 0.04
      return [cx + s * la * rx(a) + DX[a] * reach, cz + s * la * rz(a) + DZ[a] * reach]
    }
    // (A corner with something built into it: taken a little nearer the kerb.)
    let x = cx + s * (la * rx(a) + lb * rx(b)), z = cz + s * (la * rz(a) + lb * rz(b))
    for (let k = 0; k < 6 && blocked(x, z, o.heightAt(cx, cz)); k++) { x += (cx - x) * 0.12; z += (cz - z) * 0.12 }
    return [x, z]
  }
  /** On to the next tile: its turning point becomes the one walked to. */
  const advance = (p: Person) => {
    // Round a dead end, they come back on the same pavement (on what is now their other side).
    if (p.dout === BACK[p.din]) p.side = -p.side
    p.bx = p.ax; p.bz = p.az
    p.ti += DZ[p.dout]; p.tj += DX[p.dout]; p.din = p.dout; p.dout = onward(p.ti, p.tj, p.din, p.side)
    ;[p.ax, p.az] = corner(p)
  }

  const N = o.count ?? 40
  const people: Person[] = []
  const tiles = o.roads.filter(([i, j]) => links(i, j).length > 0)
  for (let n = 0, tries = 0; n < N && tiles.length && tries < 2000; tries++) {
    const [i, j] = tiles[Math.floor(rnd() * tiles.length)]
    // (Come from a street: the tile behind them is road too.)
    const ways = links(i, j).map((d) => BACK[d]), din = ways[Math.floor(rnd() * ways.length)], side = rnd() < 0.5 ? 1 : -1
    // (Somewhere there is room to walk.)
    if (lineAt(i, j, sideOf(side, din)) === null || lineAt(i - DZ[din], j - DX[din], sideOf(side, din)) === null) continue
    const p: Person = {
      look: someone(rnd, n++), ti: i, tj: j, din, dout: din, side,
      ax: 0, az: 0, bx: 0, bz: 0, x: 0, z: 0, lat: 0, latT: (rnd() - 0.5) * 0.03, px: 0, pz: 0, py: 0, yaw: 0,
      v: 0, phase: rnd() * 6.28, breathe: rnd() * 10, stuck: 0, mode: 'walk', timer: 0, phone: false, gesture: rnd() * 6, shown: true, out: true, brolly: false, a: new Float32Array(20),
    }
    p.dout = onward(i, j, din, side)
    ;[p.ax, p.az] = corner(p)
    // Start part way down the street before it.
    p.bx = p.ax - DX[din] * 0.7; p.bz = p.az - DZ[din] * 0.7
    const f = rnd(); p.x = p.bx + (p.ax - p.bx) * f; p.z = p.bz + (p.az - p.bz) * f
    p.px = p.x; p.pz = p.z; p.py = o.heightAt(p.x, p.z)
    if (blocked(p.x, p.z, p.py)) { n--; continue }
    p.yaw = Math.atan2(DX[din], DZ[din])
    people.push(p)
  }
  // Some sitting on the benches: one or two to a bench, at either end of it.
  for (const [n, s] of (o.seats ?? []).entries()) {
    if (rnd() > 0.45) continue
    for (const end of rnd() < 0.3 ? [-1, 1] : [rnd() < 0.5 ? -1 : 1]) {
      const along = end * 0.45 * METRE, back = -0.1 * METRE
      const px = s.x + Math.cos(s.yaw) * along + Math.sin(s.yaw) * back, pz = s.z - Math.sin(s.yaw) * along + Math.cos(s.yaw) * back
      const look = someone(rnd, 300 + n * 2 + (end > 0 ? 1 : 0)); look.carry = rnd() < 0.25 ? 1 : 0; look.jog = false
      people.push({
        look, ti: Math.floor(pz), tj: Math.floor(px), din: 0, dout: 0, side: 1, ax: px, az: pz, bx: px, bz: pz, x: px, z: pz, lat: 0, latT: 0,
        px, pz, py: s.y, yaw: s.yaw, v: 0, phase: 0, breathe: rnd() * 10, stuck: 0, mode: 'sit', timer: 0, phone: rnd() < 0.3, gesture: rnd() * 6,
        shown: true, out: true, brolly: false, a: new Float32Array(20),
      })
    }
  }
  // A few in pairs on corners, talking: on a junction's corner square, facing each other.
  const corners: [number, number][] = []
  for (const [i, j] of o.roads) {
    if (links(i, j).length < 3) continue
    for (const [si, sj] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) if (!R_(i + si, j + sj)) {
      const x = j + 0.5 + sj * 0.42, z = i + 0.5 + si * 0.42
      if (onFoot(x, z)) corners.push([x, z])
    }
  }
  for (let n = 0; n < 4 && corners.length; n++) {
    const [x, z] = corners.splice(Math.floor(rnd() * corners.length), 1)[0]
    const turn = rnd() * Math.PI * 2
    for (const s of [-1, 1]) {
      const px = x + Math.sin(turn) * 0.045 * s, pz = z + Math.cos(turn) * 0.045 * s
      if (blocked(px, pz, o.heightAt(px, pz))) continue
      const look = someone(rnd, 100 + n * 2 + (s > 0 ? 1 : 0)); look.carry = rnd() < 0.3 ? 1 : 0
      people.push({
        look, ti: Math.floor(z), tj: Math.floor(x), din: 0, dout: 0, side: 1, ax: px, az: pz, bx: px, bz: pz, x: px, z: pz, lat: 0, latT: 0,
        px, pz, py: o.heightAt(px, pz), yaw: turn + (s > 0 ? Math.PI : 0), v: 0, phase: 0, breathe: rnd() * 10, stuck: 0, mode: 'talk', timer: 0, phone: false, gesture: rnd() * 6,
        shown: true, out: true, brolly: false, a: new Float32Array(20),
      })
    }
  }

  /* ---- drawing them ---- */
  const parts = bodyParts()
  const mats = [
    new MeshStandardMaterial({ vertexColors: true, roughness: 0.55 }),
    new MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }),
    new MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }),
    new MeshStandardMaterial({ vertexColors: true, roughness: 0.5 }),
    new MeshStandardMaterial({ vertexColors: true, roughness: 0.62 }),
    new MeshStandardMaterial({ vertexColors: true, roughness: 0.45, side: DoubleSide }),
  ]
  const group = new Group(); group.name = 'folk'
  const meshes: Record<string, InstancedMesh> = {}
  for (const [name, P] of Object.entries(parts)) {
    const m = new InstancedMesh(P.geo, mats[P.mat], people.length * (P.two ? 2 : 1))
    m.castShadow = P.shadow; m.receiveShadow = true; m.frustumCulled = false; m.count = 0
    m.setColorAt(0, new Color()); m.name = name
    meshes[name] = m; group.add(m)
  }
  scene.add(group)

  // The joints' matrices, for one person at a time.
  const Mj = Array.from({ length: 15 }, () => new Matrix4())
  const L = new Matrix4(), e = new Euler(), sc = new Vector3(), q = new Quaternion(), v3 = new Vector3(), one = new Vector3(1, 1, 1)
  const joint = (out: number, parent: number, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => {
    L.compose(v3.set(x, y, z), q.setFromEuler(e.set(rx, ry, rz, 'XYZ')), one)
    Mj[out].multiplyMatrices(Mj[parent], L)
  }
  const counts: Record<string, number> = Object.fromEntries(Object.keys(parts).map((k) => [k, 0]))
  const put = (name: string, j: number, c: Color) => { const m = meshes[name], k = counts[name]++; m.setMatrixAt(k, Mj[j]); m.setColorAt(k, c) }

  /** Angles: 0 hipY, 1 lean, 2 twist, 3 headY, 4 headX, 5-7 left thigh/knee/ankle, 8-10 right, 11-13 left shoulder/elbow/out, 14-16 right. */
  const tgt = new Float32Array(20)
  const pose = (p: Person, dt: number) => {
    const a = p.a, Lk = p.look
    tgt.fill(0)
    tgt[0] = 0.93; tgt[13] = 0.07; tgt[16] = -0.07
    p.breathe += dt
    if (p.mode === 'walk' || p.v > 0.02) {
      const sp = p.v / METRE
      const walkK = Math.min(1, sp / 1.2), runK = Lk.jog ? Math.min(1, Math.max(0, (sp - 1.8) / 1)) : 0
      const sw = walkK * (0.4 + 0.33 * runK)
      const leg = (ph: number, o2: number) => { const t = -Math.sin(ph) * sw, kn = (0.12 + 0.95 * runK) * walkK * Math.pow(Math.max(0, Math.cos(ph)), 1.4) + 0.06 * walkK; tgt[o2] = t; tgt[o2 + 1] = kn; tgt[o2 + 2] = -(t + kn) * 0.75 }
      leg(p.phase, 5); leg(p.phase + Math.PI, 8)
      const arm = walkK * (0.32 + 0.45 * runK)
      tgt[11] = Math.sin(p.phase) * arm; tgt[14] = -Math.sin(p.phase) * arm
      tgt[12] = tgt[15] = -(0.16 + 1.2 * runK) * walkK - 0.06
      tgt[0] -= (0.025 + 0.035 * runK) * walkK * (0.5 + 0.5 * Math.cos(2 * p.phase)) + 0.005
      tgt[1] = 0.04 * walkK + 0.18 * runK
      tgt[2] = Math.sin(p.phase) * 0.09 * walkK
      // (A bag's strap holds that arm a little still.)
      if (Lk.carry === 1) { tgt[14] *= 0.4; tgt[15] = -0.5 }
    } else if (p.mode === 'sit') {
      // Sat on a bench: hips on the seat, thighs along it, shins down; leaning back, hands in the lap (or a phone).
      tgt[0] = 0.5 + 0.003 * Math.sin(p.breathe * 0.7); tgt[1] = -0.12
      tgt[5] = tgt[8] = -1.5; tgt[6] = tgt[9] = 1.45; tgt[7] = tgt[10] = 0.05
      tgt[11] = tgt[14] = -0.45; tgt[12] = tgt[15] = -0.75; tgt[13] = 0.1; tgt[16] = -0.1
      tgt[3] = 0.5 * Math.sin(p.breathe * 0.17 + p.gesture); tgt[4] = 0.05
      if (p.phone) { tgt[4] = 0.55; tgt[3] = 0; tgt[11] = tgt[14] = -0.6; tgt[12] = tgt[15] = -1.4 }
    } else {
      // Standing: breathing, weight on one foot and then the other.
      tgt[0] += 0.004 * Math.sin(p.breathe * 0.7)
      tgt[6] = 0.05 + 0.05 * Math.max(0, Math.sin(p.breathe * 0.3)); tgt[9] = 0.05 + 0.05 * Math.max(0, -Math.sin(p.breathe * 0.3))
      tgt[3] = 0.35 * Math.sin(p.breathe * 0.23 + p.gesture)
      if (p.phone) {
        // Head down over a phone held in both hands.
        tgt[4] = 0.5; tgt[3] = 0
        tgt[11] = tgt[14] = -0.32; tgt[12] = tgt[15] = -1.55; tgt[13] = -0.12; tgt[16] = 0.12
      } else if (p.mode === 'talk') {
        // Talking: hands going now and then, a nod, a turn of the head.
        const g = Math.sin(p.breathe * 0.9 + p.gesture), h = Math.max(0, Math.sin(p.breathe * 0.45 + p.gesture * 2))
        tgt[11] = -0.35 * h; tgt[12] = -0.9 * h - 0.1; tgt[13] = 0.07 + 0.12 * h * (0.5 + 0.5 * g)
        tgt[14] = -0.2 * h * (g > 0 ? 1 : 0.3); tgt[15] = -0.6 * h - 0.1
        tgt[4] = 0.05 * Math.sin(p.breathe * 2.3); tgt[3] = 0.2 * Math.sin(p.breathe * 0.31 + p.gesture)
      } else if (p.mode === 'wait') { tgt[3] = 0.7 * Math.sin(p.breathe * 1.1) }
    }
    // An umbrella up: the right arm raised and still, holding it over the head.
    if (p.brolly) { tgt[14] = -0.55; tgt[15] = -1.35; tgt[16] = -0.12; tgt[2] *= 0.4 }
    const k = Math.min(1, dt * 10)
    for (let n = 0; n < 17; n++) a[n] += (tgt[n] - a[n]) * (n === 3 ? Math.min(1, dt * 3) : k)
  }

  /** One person, posed, into the instance lists. */
  const draw = (p: Person) => {
    const Lk = p.look, a = p.a, s = METRE * Lk.tall
    Mj[0].compose(v3.set(p.px, p.py, p.pz), q.setFromEuler(e.set(0, p.yaw, 0)), sc.set(s * Lk.broad, s, s * Lk.broad))
    joint(J.hips, J.root, 0, a[0], 0)
    joint(J.torso, J.hips, 0, 0.05, 0, a[1], a[2], 0)
    joint(J.neck, J.torso, 0, 0.5, 0)
    joint(J.head, J.neck, 0, 0.08, 0, a[4] - a[1] * 0.6, a[3], 0)
    for (const sd of [0, 1]) {
      const x = sd ? -1 : 1, o2 = sd ? 3 : 0
      joint(J.sh + sd, J.torso, x * 0.2, 0.42, 0, a[11 + o2], 0, a[13 + o2])
      joint(J.el + sd, J.sh + sd, 0, -0.29, 0, a[12 + o2], 0, 0)
      joint(J.hip + sd, J.hips, x * 0.09 * Lk.hips, 0, 0, a[5 + o2], 0, 0)
      joint(J.knee + sd, J.hip + sd, 0, -0.44, 0, a[6 + o2], 0, 0)
      joint(J.ank + sd, J.knee + sd, 0, -0.44, 0, a[7 + o2], 0, 0)
    }
    const skin = Lk.skin, top = Lk.top, legs = Lk.legs
    put('pelvis', J.hips, legs); put('torso', J.torso, top); put('neck', J.neck, skin); put('head', J.head, skin)
    if (Lk.hairStyle === 1) put('hairS', J.head, Lk.hair); else if (Lk.hairStyle === 2) put('hairL', J.head, Lk.hair)
    for (const sd of [0, 1]) {
      put('sleeve', J.sh + sd, top); put('upper', J.sh + sd, Lk.topStyle === 1 ? top : skin); put('fore', J.el + sd, Lk.topStyle === 1 ? top : skin); put('hand', J.el + sd, skin)
      // (Sat down, a skirt lies over the thighs.)
      const skirtCol = Lk.topStyle === 2 ? top : legs, seated = p.mode === 'sit' && Lk.legStyle === 2
      put('thighHi', J.hip + sd, seated ? skirtCol : Lk.legStyle === 2 ? skin : legs); put('thighLo', J.hip + sd, seated ? skirtCol : Lk.legStyle === 0 ? legs : skin); put('shin', J.knee + sd, Lk.legStyle === 0 ? legs : skin)
      put('shoe', J.ank + sd, Lk.feet)
    }
    if (Lk.legStyle === 2 && p.mode !== 'sit') put('skirt', J.hips, Lk.topStyle === 2 ? top : legs)
    if (Lk.carry === 1) put('bag', J.torso, Lk.bag); else if (Lk.carry === 2) put('pack', J.torso, Lk.bag)
    // (Only once the arm is up.)
    if (p.brolly && Lk.brolly && a[15] < -1.2) put('brolly', J.el + 1, Lk.brolly)
  }

  /** People out in the road (crossing it), for the traffic to wait for. */
  const crossing: { i: number; j: number; r: number; w: number }[] = []
  let thin = 0

  // (A lighter quality level has fewer of them out: tiers.ts.)
  let density = 1
  return {
    group, onFoot,
    /** What share of them may be out at once (the quality level's), 0 to 1. */
    setDensity(f: number) { density = Math.max(0, Math.min(1, f)) },
    /** How many are about. */
    get count() { return people.filter((p) => p.out).length },
    /** Each frame: everyone walks on, and is drawn if near enough to see. */
    update(dt: number, c: { cam: Vector3; you: { x: number; z: number; y: number } | null; cars: CarNear[]; day: number; rain?: number }) {
      if (dt <= 0) return
      crossing.length = 0
      // Fewer out at night: those past the count go home (out of sight), and come back out in the morning.
      // (And fewer in the rain.)
      const rain = c.rain ?? 0
      const wanted = Math.round(people.length * density * (0.3 + 0.7 * Math.min(1, c.day * 1.4)) * (1 - 0.45 * rain))
      for (const k in counts) counts[k] = 0
      thin = (thin + 1) % 8
      people.forEach((p, n) => {
        const camD = Math.hypot(p.px - c.cam.x, p.pz - c.cam.z)
        if (n % 8 === thin && camD > 5) p.out = p.mode === 'talk' || p.mode === 'sit' ? c.day > 0.25 && rain < (p.mode === 'sit' ? 0.2 : 0.6) : n < wanted
        if (!p.out) return
        const Lk = p.look
        p.brolly = !!Lk.brolly && rain > 0.15
        if (p.mode !== 'talk' && p.mode !== 'sit') {
          // Along the path: towards the turning point, then on round it.
          let dx = p.ax - p.bx, dz = p.az - p.bz
          const len = Math.hypot(dx, dz) || 1; dx /= len; dz /= len
          const rx = -dz, rz = dx
          let want = p.mode === 'walk' ? Lk.pace * METRE : 0
          // Others ahead: step to your right for someone coming the other way; behind someone slower, go out and past, or keep pace.
          for (const q2 of people) {
            if (q2 === p || !q2.out) continue
            const ox = q2.px - p.px, oz = q2.pz - p.pz, ahead = ox * dx + oz * dz, side = ox * rx + oz * rz
            if (ahead < 0 || ahead > 0.16 || Math.abs(side) > 0.06) continue
            const facing = Math.sin(q2.yaw) * dx + Math.cos(q2.yaw) * dz
            if (facing < -0.3 || q2.v < 0.02) p.latT = side > 0 ? -ROOM : ROOM
            else if (q2.v < want - 0.01) { if (ahead < 0.09) want = Math.min(want, q2.v); p.latT = side > 0 ? -ROOM : ROOM }
            if (ahead < 0.05 && Math.abs(side) < 0.035) want = Math.min(want, q2.v * 0.8)
          }
          // You: stepped round, or waited for if there is no room.
          if (c.you) {
            const ox = c.you.x - p.px, oz = c.you.z - p.pz, ahead = ox * dx + oz * dz, side = ox * rx + oz * rz
            if (ahead > 0 && ahead < 0.2 && Math.abs(side) < 0.07 && Math.abs(c.you.y - p.py) < 0.15) {
              p.latT = side > 0 ? -ROOM : ROOM
              if (ahead < 0.07) want = 0
            }
          }
          // A lamp post or a bin in the way: round whichever side is clear; with the whole pavement built over, along the gutter.
          const free = (l: number) => !blocked(p.x + dx * 0.05 + rx * l, p.z + dz * 0.05 + rz * l, p.py)
          if (!free(p.latT)) {
            const kerb = -p.side * 0.07
            const pick = [p.latT >= 0 ? ROOM : -ROOM, p.latT >= 0 ? -ROOM : ROOM, kerb].find(free)
            if (pick !== undefined) p.latT = pick; else { want = 0; p.stuck += dt }
          } else p.stuck = 0
          // Nowhere to go at all: back the way they came.
          if (p.stuck > 2.5) {
            p.stuck = 0
            p.ti -= DZ[p.din]; p.tj -= DX[p.din]; p.din = BACK[p.din]; p.side = -p.side; p.dout = onward(p.ti, p.tj, p.din, p.side)
            p.bx = p.x; p.bz = p.z; [p.ax, p.az] = corner(p)
          }
          // Out into the road: look first, and wait while a car is coming.
          const nx = p.x + dx * 0.07, nz = p.z + dz * 0.07
          const road = !onFoot(nx, nz)
          if (road && onFoot(p.px, p.pz) && p.mode === 'walk') {
            // (At traffic lights, only while the traffic being crossed has red.)
            const ni = Math.floor(nz), nj = Math.floor(nx)
            const red = !o.mayCross || o.mayCross(ni, nj, Math.abs(dx) > Math.abs(dz) ? 'ns' : 'ew')
            const coming = !red || c.cars.some((k2) => { const ox = nx - k2.x, oz = nz - k2.z, d = Math.hypot(ox, oz); return d < 0.25 + k2.hl || (d < 1.3 && k2.v > 0.05 && (ox * k2.hx + oz * k2.hz) / d > 0.6) })
            if (coming) { p.mode = 'wait'; p.timer = 0.6 }
          }
          if (p.mode === 'wait') { want = 0; if ((p.timer -= dt) <= 0) p.mode = 'walk' }
          if (!onFoot(p.px, p.pz)) crossing.push({ i: p.pz, j: p.px, r: 0.04, w: 0.04 })
          // Now and then, a stop: a look at the phone, or just a moment.
          if (p.mode === 'walk' && !Lk.jog && !road && rnd() < dt * 0.012) { p.mode = 'pause'; p.timer = 3 + rnd() * 7; p.phone = !p.brolly && rnd() < 0.65 }
          if (p.mode === 'pause') { want = 0; if ((p.timer -= dt) <= 0) { p.mode = 'walk'; p.phone = false } }
          // The pace: picking up and slowing as people do.
          p.v += Math.max(-0.5 * METRE * dt * 4, Math.min(0.9 * METRE * dt * 2, want - p.v))
          let step = p.v * dt
          while (step > 0) {
            const left = Math.hypot(p.ax - p.x, p.az - p.z)
            if (step < left) { p.x += ((p.ax - p.x) / left) * step; p.z += ((p.az - p.z) / left) * step; step = 0 }
            else { step -= left; p.x = p.ax; p.z = p.az; advance(p) }
          }
          // Back towards the middle of the pavement once past.
          if (free(p.latT * 0.5)) p.latT *= Math.max(0, 1 - dt * 0.6)
          p.lat += (p.latT - p.lat) * Math.min(1, dt * 3)
          p.phase += (p.v / (METRE * Lk.tall * (1.4 + (Lk.jog ? 1.1 : 0)))) * Math.PI * 2 * dt
          // Drawn a little behind the path, so corners are rounded and steps aside eased.
          const tx = p.x + rx * p.lat, tz = p.z + rz * p.lat
          const ox = p.px, oz = p.pz
          p.px += (tx - p.px) * Math.min(1, dt * 7); p.pz += (tz - p.pz) * Math.min(1, dt * 7)
          const mx = p.px - ox, mz = p.pz - oz
          if (Math.hypot(mx, mz) > 1e-5 && p.v > 0.01) {
            let dy = Math.atan2(mx, mz) - p.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy))
            p.yaw += dy * Math.min(1, dt * 6)
          }
          p.py = o.heightAt(p.px, p.pz)
          // (Somehow inside something after all — eased round a corner into it: straight back onto the path.)
          if (blocked(p.px, p.pz, p.py) && !blocked(p.x, p.z, p.py)) { p.px = p.x; p.pz = p.z; p.lat = p.latT = 0 }
        }
        // Out of the way of a car that comes at them (yours, on the pavement).
        for (const k2 of c.cars) {
          const ox = p.px - k2.x, oz = p.pz - k2.z, cs = Math.cos(k2.yaw), sn = Math.sin(k2.yaw)
          const along = ox * cs - oz * sn, across = ox * sn + oz * cs
          const hl = k2.hl + 0.03, hw = k2.hw + 0.03
          if (Math.abs(along) < hl && Math.abs(across) < hw) {
            const push = hw - Math.abs(across), sg = Math.sign(across) || 1
            p.px += sn * push * sg; p.pz += cs * push * sg; p.x = p.px; p.z = p.pz
            if (p.mode === 'walk') { p.mode = 'pause'; p.timer = 1.5 }
          }
        }
        // Drawn only near enough to make out.
        p.shown = camD < 9
        if (!p.shown) return
        pose(p, dt)
        draw(p)
      })
      for (const [name, m] of Object.entries(meshes)) {
        m.count = counts[name]
        if (m.count) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true }
      }
    },
    /** Who is in the road: the traffic waits for them. */
    crossing: () => crossing,
    /** You, bumping into someone: how far you are pushed back out of them (or null). */
    push(x: number, z: number, y: number, r: number) {
      for (const p of people) {
        if (!p.out) continue
        const dx = x - p.px, dz = z - p.pz, d = Math.hypot(dx, dz), min = r + 0.024 * p.look.broad
        if (d < min && Math.abs(y - p.py) < 0.15) return [(dx / (d || 1)) * (min - d), (dz / (d || 1)) * (min - d)] as [number, number]
      }
      return null
    },
    /** (For the checks.) */
    state: () => people.map((p) => ({ x: p.px, z: p.pz, y: p.py, mode: p.mode, out: p.out, v: p.v, onFoot: onFoot(p.px, p.pz) })),
    dispose() { for (const m of Object.values(meshes)) { m.geometry.dispose(); m.dispose() } for (const m of mats) m.dispose(); scene.remove(group) },
  }
}
