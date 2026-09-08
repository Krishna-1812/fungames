/**
 * fold-scene — the sheet as an object in a room, rather than a line in a box.
 *
 * The edge-on diagram this game had is the honest picture and it stays: both
 * axes to one scale is the whole argument, because it shows the bend at the
 * crease growing until it is fatter than the paper is wide. But at fold zero
 * that diagram is a hairline in an empty rectangle, and the hairline is the
 * thing you are supposed to want to touch.
 *
 * So the argument becomes an inset and the stage becomes a sheet of paper on a
 * desk, seen from a low angle, lit from one side, with the flap coming over
 * under your finger. Nothing here decides anything — every quantity comes from
 * fold-paper.ts, and this only says where the corners land on the screen.
 *
 * The one thing worth saying about the geometry: the flap turns about the top
 * edge of the stack, not about the desk. Turn it about the desk and the paper
 * passes through itself, which nobody notices consciously and everybody
 * notices. And the rounded lip that appears at the crease is not decoration —
 * it is the radius the accumulated stack has to bend through, the same h/2
 * that `bendRadius` returns, and watching it grow past the width of the sheet
 * is the answer to the question the game asks.
 */

export type V3 = { x: number; y: number; z: number }
export type P2 = [number, number]

export type Cam = {
  /**
   * Radians the sheet is turned about its own vertical.
   *
   * Folding a sheet alternately means turning it a quarter between folds, and
   * that turn is the clearest statement of what "alternate" means — clearer
   * than the words on the button. So it is a real quarter turn, animated, and
   * the fold axis stays where the hand is.
   */
  yaw: number
  /** Radians the world tips towards the viewer. */
  pitch: number
  /** Camera distance along z, in scene units. */
  dist: number
  /** Focal length; set by `fitCam` rather than by hand. */
  f: number
  /** Where the origin lands on the canvas. */
  cx: number
  cy: number
}

export type Kind = 'top' | 'under' | 'side' | 'end' | 'bend' | 'desk'

export type Face = {
  pts: P2[]
  /** 0 to 1, ambient plus lambert. The page turns this into a colour. */
  shade: number
  kind: Kind
  /** Mean camera-space depth, for the painter's sort. */
  depth: number
}

export type Scene3 = {
  faces: Face[]
  /** Layer lines down the cut edge, while there are few enough to tell apart. */
  laminations: P2[][]
  /** The sheet's shadow on the desk, already projected. */
  shadow: P2[]
  /** Screen-space extent of everything drawn, for the caller's framing. */
  bounds: { x0: number; y0: number; x1: number; y1: number }
}

/* -------------------------------------------------------------------------- */
/* Projection                                                                 */
/* -------------------------------------------------------------------------- */

/** The sheet turned about its own vertical, before the camera sees it. */
export function yawed(p: V3, c: Cam): V3 {
  if (!c.yaw) return p
  const cw = Math.cos(c.yaw), sw = Math.sin(c.yaw)
  return { x: p.x * cw + p.z * sw, y: p.y, z: -p.x * sw + p.z * cw }
}

export function project(p: V3, c: Cam): { x: number; y: number; d: number } {
  const v = yawed(p, c)
  // Tilted so the far side of the desk rides UP the screen. The other sign
  // convention also renders, and renders the desk seen from underneath it.
  const cp = Math.cos(c.pitch), sp = Math.sin(c.pitch)
  const y = v.y * cp + v.z * sp
  const d = -v.y * sp + v.z * cp + c.dist
  const s = c.f / Math.max(0.001, d)
  return { x: c.cx + v.x * s, y: c.cy - y * s, d }
}

/**
 * A focal length that makes the object fill `target` pixels.
 *
 * Two passes rather than a formula: with a perspective divide the projected
 * size is not a fixed multiple of the world size, so the honest way to fit a
 * box is to project it and look. The alternative is a fudge factor that is
 * wrong at exactly the fold counts where the shape changes most.
 */
export function fitCam(
  corners: V3[], base: Cam, target: number, at: { x: number; y: number }, pad = 0.86,
): Cam {
  const probe: Cam = { ...base, f: 1000, cx: 0, cy: 0 }
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
  for (const p of corners) {
    const q = project(p, probe)
    x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x)
    y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y)
  }
  const w = Math.max(1e-6, x1 - x0), h = Math.max(1e-6, y1 - y0)
  const f = (1000 * target * pad) / Math.max(w, h)
  // Re-centre on where the object actually landed, not on the origin: a stack
  // that has folded itself onto one side is not centred on the fold line.
  const k = f / 1000
  return { ...base, f, cx: at.x - (x0 + x1) / 2 * k, cy: at.y - (y0 + y1) / 2 * k }
}

/* -------------------------------------------------------------------------- */
/* Shading                                                                    */
/* -------------------------------------------------------------------------- */

/** Up, towards the viewer, and off to the left. One light, obeyed by everything. */
const LIGHT = (() => {
  const v = { x: -0.42, y: 0.84, z: -0.34 }
  const m = Math.hypot(v.x, v.y, v.z)
  return { x: v.x / m, y: v.y / m, z: v.z / m }
})()

const AMBIENT = 0.46

function normal(a: V3, b: V3, c: V3): V3 {
  const u = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z }
  const v = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z }
  const n = {
    x: u.y * v.z - u.z * v.y,
    y: u.z * v.x - u.x * v.z,
    z: u.x * v.y - u.y * v.x,
  }
  const m = Math.hypot(n.x, n.y, n.z) || 1
  return { x: n.x / m, y: n.y / m, z: n.z / m }
}

function lambert(n: V3): number {
  const d = n.x * LIGHT.x + n.y * LIGHT.y + n.z * LIGHT.z
  return AMBIENT + (1 - AMBIENT) * Math.max(0, d)
}

/**
 * Where the camera is, in world space.
 *
 * `project` sends a point to depth −y·sin p + z·cos p + dist, so the view axis
 * is (0, −sin p, cos p) and the eye sits one `dist` back along it: above the
 * desk and in front of it. Which also settles the convention that kept
 * catching me out — **+z is away from the viewer**, so the near edge of the
 * sheet, the one whose laminations you can count, is at −z.
 */
export const eyeOf = (c: Cam): V3 => ({
  x: 0, y: c.dist * Math.sin(c.pitch), z: -c.dist * Math.cos(c.pitch),
})

/** Signed area in screen space. Used to check winding is consistent, not to cull. */
export function signedArea(pts: P2[]): number {
  let a = 0
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length]
    a += x0 * y1 - x1 * y0
  }
  return a / 2
}

/* -------------------------------------------------------------------------- */
/* The sheet                                                                  */
/* -------------------------------------------------------------------------- */

export type FoldOpts = {
  /** Half the sheet's width, along x. The fold axis is x = 0. */
  halfW: number
  /** Half the sheet's depth, along z. */
  halfD: number
  /** Height of the stack as it is now, before this fold lands. */
  height: number
  /** How many layers that height is made of, for the lamination lines. */
  layers: number
  /** The fold in progress, 0 to 1. */
  u: number
  cam: Cam
  /** Draw the desk shadow. False once there is no desk. */
  grounded?: boolean
}

const rotAbout = (x: number, y: number, px: number, py: number, a: number) => {
  const dx = x - px, dy = y - py
  const c = Math.cos(a), s = Math.sin(a)
  return { x: px + dx * c - dy * s, y: py + dx * s + dy * c }
}

/**
 * The stack, the flap and the lip, projected and sorted back to front.
 *
 * Back-facing quads are dropped by their screen winding rather than by a dot
 * product with the view vector — the two agree, and the winding does not need
 * the camera to be right to be right.
 */
export function fold3d(o: FoldOpts): Scene3 {
  const { halfW: a, halfD: b, height: h, cam } = o
  const u = Math.max(0, Math.min(1, o.u))
  const theta = Math.PI * u
  const faces: Face[] = []

  const eye = eyeOf(cam)

  /**
   * Culled against the normal rather than against the screen winding.
   *
   * The winding test is one line shorter and it was wrong in a way that took a
   * checker to find: it depends on the projection's handedness, and this one
   * flips y, so "counter-clockwise" on screen means the opposite of what it
   * means on paper. Comparing the face normal with the direction of the eye
   * needs no such agreement.
   */
  const push = (raw: V3[], hint?: Kind) => {
    // Normals are computed after the turn, so culling and shading agree with
    // what is on the screen rather than with where the sheet started.
    const v = raw.map((q) => yawed(q, cam))
    const n = normal(v[0], v[1], v[2])
    const c = {
      x: v.reduce((t, q) => t + q.x, 0) / v.length,
      y: v.reduce((t, q) => t + q.y, 0) / v.length,
      z: v.reduce((t, q) => t + q.z, 0) / v.length,
    }
    if (n.x * (eye.x - c.x) + n.y * (eye.y - c.y) + n.z * (eye.z - c.z) <= 0) return
    const q = raw.map((p) => project(p, cam))
    // Sub-pixel quads draw nothing and their screen winding is whatever the
    // rounding decided, so they are dropped rather than emitted as noise. The
    // lip is made of fourteen of them and spends the first tenth of every fold
    // smaller than a pixel.
    if (Math.abs(signedArea(q.map((p) => [p.x, p.y] as P2))) < 0.02) return
    // The name follows the normal, so a flap that has turned past vertical is
    // reported as showing its underside because it is showing its underside.
    const kind: Kind = hint ??
      (Math.abs(n.y) >= Math.abs(n.x) && Math.abs(n.y) >= Math.abs(n.z)
        ? (n.y > 0 ? 'top' : 'under')
        : Math.abs(n.x) >= Math.abs(n.z) ? 'end' : 'side')
    faces.push({
      pts: q.map((p) => [p.x, p.y] as P2),
      shade: lambert(n),
      kind,
      depth: q.reduce((s, p) => s + p.d, 0) / q.length,
    })
  }

  /**
   * A box, optionally turned about the crease. Every face is wound so its
   * normal points out of the solid; the rotation carries the winding with it,
   * which is why a flap past vertical correctly reports a downward normal.
   */
  const box = (x0: number, x1: number, y0: number, y1: number, turn = 0) => {
    const m = (x: number, y: number) => (turn ? rotAbout(x, y, 0, h, turn) : { x, y })
    // 0: (x0,y0)  1: (x1,y0)  2: (x1,y1)  3: (x0,y1)
    const c = [m(x0, y0), m(x1, y0), m(x1, y1), m(x0, y1)]
    const V = (i: number, z: number): V3 => ({ x: c[i].x, y: c[i].y, z })
    push([V(3, b), V(2, b), V(2, -b), V(3, -b)])   // y1
    push([V(0, -b), V(1, -b), V(1, b), V(0, b)])   // y0
    push([V(0, -b), V(3, -b), V(2, -b), V(1, -b)]) // z-  (near)
    push([V(0, b), V(1, b), V(2, b), V(3, b)])     // z+  (far)
    push([V(1, b), V(1, -b), V(2, -b), V(2, b)])   // x1
    push([V(0, -b), V(0, b), V(3, b), V(3, -b)])   // x0
  }

  // The half that stays put, and the half that comes over — but only once the
  // fold has started. Drawn as two boxes at rest, the shared edge between them
  // is stroked by the caller and the sheet arrives with a crease already in it.
  if (u < 1e-4) {
    box(-a, a, 0, h)
  } else {
    box(-a, 0, 0, h)
    box(0, a, 0, h, theta)
  }

  /**
   * The lip at the crease. This is the paper that went round the bend, and its
   * radius is half the stack — the same h/2 the length accounting charges for.
   * It grows with the stack while the sheet halves, and the fold it finally
   * refuses is the one where this circle is wider than the paper left to feed
   * it.
   */
  const r = (h / 2) * u
  if (r > 1e-9) {
    const SEG = 14
    for (let i = 0; i < SEG; i++) {
      const a0 = Math.PI / 2 + (i / SEG) * Math.PI
      const a1 = Math.PI / 2 + ((i + 1) / SEG) * Math.PI
      const p0 = { x: Math.cos(a0) * r, y: h + Math.sin(a0) * r }
      const p1 = { x: Math.cos(a1) * r, y: h + Math.sin(a1) * r }
      push([
        { x: p0.x, y: p0.y, z: b }, { x: p1.x, y: p1.y, z: b },
        { x: p1.x, y: p1.y, z: -b }, { x: p0.x, y: p0.y, z: -b },
      ], 'bend')
    }
  }

  faces.sort((p, q) => q.depth - p.depth)

  // Layer lines down the near cut edge, while they can be told apart.
  const laminations: P2[][] = []
  const step = h / Math.max(1, o.layers)
  if (o.layers > 1 && o.layers <= 96) {
    const near = project({ x: -a, y: 0, z: -b }, cam)
    const far = project({ x: -a, y: h, z: -b }, cam)
    const px = Math.abs(far.y - near.y) / o.layers
    if (px > 1.2)
      for (let k = 1; k < o.layers; k++) {
        const y = k * step
        const A = project({ x: -a, y, z: -b }, cam)
        const B = project({ x: 0, y, z: -b }, cam)
        laminations.push([[A.x, A.y], [B.x, B.y]])
      }
  }

  /**
   * The shadow: what the paper covers, pushed away from the light.
   *
   * It has to follow the footprint rather than the original sheet. The first
   * version used [−a, a] throughout, so half a fold in — with the flap
   * standing up and nothing under it — there was still a hard rectangle of
   * shade lying on the desk where the paper used to be. Nobody reads that as a
   * shadow; they read it as a second sheet.
   */
  let fx0 = -a, fx1 = 0
  for (const [cx, cy] of [[0, 0], [a, 0], [a, h], [0, h]] as [number, number][]) {
    const q = rotAbout(cx, cy, 0, h, theta)
    fx0 = Math.min(fx0, q.x); fx1 = Math.max(fx1, q.x)
  }
  const off = a * 0.1 + h * 0.12
  const sx = -LIGHT.x * off, sz = -LIGHT.z * off
  const shadow: P2[] = o.grounded === false ? [] : [
    { x: fx0 + sx, z: -b + sz }, { x: fx1 + sx, z: -b + sz },
    { x: fx1 + sx, z: b + sz }, { x: fx0 + sx, z: b + sz },
  ].map((p) => {
    const q = project({ x: p.x, y: 0, z: p.z }, cam)
    return [q.x, q.y] as P2
  })

  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const f of faces)
    for (const [x, y] of f.pts) {
      x0 = Math.min(x0, x); x1 = Math.max(x1, x)
      y0 = Math.min(y0, y); y1 = Math.max(y1, y)
    }

  return { faces, laminations, shadow, bounds: { x0, y0, x1, y1 } }
}

/** The eight corners the camera has to frame, including the lip and the flap. */
export function fitCorners(halfW: number, halfD: number, height: number): V3[] {
  const a = halfW, b = halfD, h = height
  const out: V3[] = []
  for (const x of [-a - h / 2, a])
    for (const y of [0, h * 2])
      for (const z of [-b, b]) out.push({ x, y, z })
  return out
}
