/**
 * The permanent way: ballast, sleepers, two rails, the points, and the wire
 * overhead with the poles that hold it up.
 *
 * Laid again for every problem, because the branch is different in each: a
 * siding, a loop that comes back, none at all under the footbridge, or one
 * whose rails stop short because the lever was never connected to it.
 */
import {
  BoxGeometry, Color, CylinderGeometry, DodecahedronGeometry, Group, InstancedMesh, Mesh,
  MeshStandardMaterial, Object3D,
} from 'three'
import type { BufferGeometry, Material, Texture } from 'three'
import { along, gravelTexture, merge, part, rng, sweep, woodTexture } from './kit'
import type { Along } from './kit'
import { TRACK, branch as branchLine, sideZ } from './track'

export type BranchKind = 'siding' | 'loop' | 'none'

const RAIL_SECTION: Array<[number, number]> = [
  [-0.07, 0.3], [0.07, 0.3], [0.07, 0.32], [0.018, 0.34], [0.018, 0.41], [0.036, 0.42],
  [0.036, TRACK.RAIL], [-0.036, TRACK.RAIL], [-0.036, 0.42], [-0.018, 0.41], [-0.018, 0.34], [-0.07, 0.32],
]
const BED_SECTION = (dy: number): Array<[number, number]> => [[-2.15, -0.02], [-1.35, TRACK.BED - 0.04 + dy], [1.35, TRACK.BED - 0.04 + dy], [2.15, -0.02]]
const WIRE = 5.45

const shift = (line: Along[], off: number): Along[] => line.map((p) => ({ ...p, x: p.x + p.nx * off, z: p.z + p.nz * off }))

export function createRailKit() {
  const gravel = gravelTexture(), wood = woodTexture()
  const textures: Texture[] = [gravel, wood]
  const mat = {
    ballast: new MeshStandardMaterial({ map: gravel, roughness: 1, color: 0xd8d2c8 }),
    stone: new MeshStandardMaterial({ roughness: 0.95, flatShading: true }),
    sleeper: new MeshStandardMaterial({ map: wood, roughness: 0.85 }),
    rail: new MeshStandardMaterial({ color: 0x9a938c, metalness: 1, roughness: 0.32 }),
    rust: new MeshStandardMaterial({ color: 0x6b4a35, metalness: 0.5, roughness: 0.85 }),
    pole: new MeshStandardMaterial({ color: 0x3d4a45, metalness: 0.3, roughness: 0.6 }),
    wire: new MeshStandardMaterial({ color: 0x2a2623, metalness: 0.8, roughness: 0.4 }),
  }
  const sleeperGeo = new BoxGeometry(0.26, 0.15, 2.5)
  const stoneGeo = new DodecahedronGeometry(0.075, 0)
  const dummy = new Object3D()
  const tint = new Color()

  /** One line of track: bed, stones, sleepers, both rails. */
  function lay(group: Group, pts: Array<{ x: number; z: number }>, seed: number, o: { dy?: number; railsFrom?: number; rusty?: boolean } = {}) {
    const r = rng(seed)
    const line = along(pts)
    const bed = new Mesh(sweep(line, BED_SECTION(o.dy ?? 0), false, 1 / 3.2), mat.ballast)
    bed.receiveShadow = true
    group.add(bed)

    // Distance along, for spacing things evenly round a curve.
    const runs: number[] = [0]
    for (let i = 1; i < line.length; i++) runs.push(runs[i - 1] + Math.hypot(line[i].x - line[i - 1].x, line[i].z - line[i - 1].z))
    const total = runs[runs.length - 1]
    let k = 0
    const where = (d: number) => {
      while (k < runs.length - 2 && runs[k + 1] < d) k++
      const a = line[k], b = line[k + 1], t = (d - runs[k]) / (runs[k + 1] - runs[k] || 1)
      return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, nx: a.nx + (b.nx - a.nx) * t, nz: a.nz + (b.nz - a.nz) * t }
    }

    const count = Math.floor(total / 0.66)
    const sleepers = new InstancedMesh(sleeperGeo, mat.sleeper, count)
    for (let i = 0; i < count; i++) {
      const p = where(i * 0.66 + 0.2)
      dummy.position.set(p.x, TRACK.BED - 0.075 + (o.dy ?? 0), p.z)
      // The sleeper's long side lies across the line.
      dummy.rotation.set(0, Math.atan2(p.nx, p.nz) + (r() - 0.5) * 0.03, 0)
      dummy.scale.set(1, 1, 1)
      dummy.updateMatrix()
      sleepers.setMatrixAt(i, dummy.matrix)
      sleepers.setColorAt(i, tint.setScalar(0.75 + r() * 0.5))
    }
    sleepers.castShadow = sleepers.receiveShadow = true
    group.add(sleepers)

    k = 0
    const n = Math.floor(total * 7)
    const stones = new InstancedMesh(stoneGeo, mat.stone, n)
    const ds = Array.from({ length: n }, () => r() * total).sort((a, b) => a - b)
    const tones = [0x8d877e, 0x7a746c, 0xa09a90, 0x655f58, 0x93887a, 0xb0aaa0]
    for (let i = 0; i < n; i++) {
      const p = where(ds[i]), off = (r() - 0.5) * 4.1, d = Math.abs(off)
      const y = d < 1.35 ? TRACK.BED - 0.03 : TRACK.BED * (1 - (d - 1.35) / 0.8) - 0.02
      dummy.position.set(p.x + p.nx * off, Math.max(0.02, y) + (o.dy ?? 0), p.z + p.nz * off)
      dummy.rotation.set(r() * 3, r() * 3, r() * 3)
      dummy.scale.set(0.6 + r() * 1.1, 0.5 + r() * 0.7, 0.6 + r() * 1.1)
      dummy.updateMatrix()
      stones.setMatrixAt(i, dummy.matrix)
      stones.setColorAt(i, tint.setHex(tones[(r() * tones.length) | 0]))
    }
    stones.castShadow = stones.receiveShadow = true
    group.add(stones)

    const from = o.railsFrom ?? -Infinity
    const railLine = line.filter((p) => p.x >= from)
    for (const side of [-1, 1]) {
      const rail = new Mesh(sweep(shift(railLine, side * TRACK.GAUGE), RAIL_SECTION, true), o.rusty ? mat.rust : mat.rail)
      rail.castShadow = rail.receiveShadow = true
      group.add(rail)
    }
  }

  function pole(group: Group, x: number, z: number, reach: number) {
    const g: BufferGeometry[] = [
      part(new CylinderGeometry(0.075, 0.11, 6.2, 8), 0xffffff, [0, 3.1, 0]),
      part(new CylinderGeometry(0.16, 0.16, 0.12, 8), 0xffffff, [0, 0.06, 0]),
      // The bracket arm, and the stay that holds it up.
      part(new CylinderGeometry(0.035, 0.035, Math.abs(reach) + 0.3, 6), 0xffffff, [0, WIRE + 0.25, reach / 2], [Math.PI / 2, 0, 0]),
      part(new CylinderGeometry(0.02, 0.02, Math.hypot(reach * 0.7, 0.7), 5), 0xffffff, [0, WIRE + 0.6, reach * 0.35], [Math.PI / 2 - Math.sign(reach) * Math.atan2(0.7, Math.abs(reach) * 0.7), 0, 0]),
      part(new CylinderGeometry(0.03, 0.03, 0.25, 6), 0xffffff, [0, WIRE + 0.12, reach]),
    ]
    const m = new Mesh(merge(g), mat.pole)
    m.position.set(x, 0, z)
    m.castShadow = true
    group.add(m)
  }

  function wire(group: Group, pts: Array<{ x: number; z: number }>) {
    const s = 0.016
    const m = new Mesh(sweep(along(pts, WIRE), [[-s, -s], [s, -s], [s, s], [-s, s]], true), mat.wire)
    group.add(m)
  }

  return {
    WIRE,
    build(kind: BranchKind, dead: boolean) {
      const group = new Group()
      const main: Array<{ x: number; z: number }> = []
      for (let x = -TRACK.FAR - 30; x <= TRACK.FAR + 30; x += 2) main.push({ x, z: 0 })
      lay(group, main, 3)
      wire(group, main)
      for (const x of [-48, -30, 24, 44, 64]) pole(group, x, 3.1, -3.1)

      const loop = kind === 'loop'
      const fork = loop ? TRACK.LOOP_FORK : TRACK.FORK
      let blades: Mesh[] = []
      if (kind !== 'none') {
        const b = branchLine(loop).pts.filter((_, i) => i % 3 === 0)
        // A hair lower than the main bed, so the two do not fight where they overlap.
        lay(group, b, 7, { dy: -0.012, railsFrom: dead ? fork + 6.5 : undefined, rusty: dead })
        if (!dead) wire(group, b)
        if (!loop) for (const x of [16, 32, 48, 64]) pole(group, x, sideZ(x, false) - 3, 3)
        else pole(group, -0.75, TRACK.LOOP_SIDE - 3, 3)

        if (!dead) {
          // The switch blades: two tapered rails hinged at the heel.
          blades = [-1, 1].map((side) => {
            const m = new Mesh(new BoxGeometry(4.6, 0.13, 0.05), mat.rail)
            m.geometry.translate(-2.3, 0, 0) // hinge at the far end
            m.position.set(fork + 4.8, TRACK.RAIL - 0.07, side * (TRACK.GAUGE - 0.1))
            m.castShadow = true
            group.add(m)
            return m
          })
        }
      }
      return {
        group,
        /** 0 is set for the main line, 1 for the branch. */
        setPoints(t: number) {
          const away = TRACK.SIDE < 0 ? 1 : -1
          blades.forEach((m, i) => {
            // The blade on the branch side closes against its stock rail as the other opens.
            const side = i ? 1 : -1
            m.rotation.y = away * (side * 0.008 + (t - 0.5) * 0.036)
          })
        },
        dispose() {
          group.traverse((o) => {
            const m = o as Mesh
            if (m.geometry && m.geometry !== sleeperGeo && m.geometry !== stoneGeo) m.geometry.dispose()
          })
        },
      }
    },
    dispose() {
      for (const t of textures) t.dispose()
      for (const m of Object.values(mat) as Material[]) m.dispose()
      sleeperGeo.dispose(); stoneGeo.dispose()
    },
  }
}
