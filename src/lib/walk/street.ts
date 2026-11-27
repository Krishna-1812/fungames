/**
 * The street's furniture (walker.ts): traffic lights at the junctions, benches
 * and litter bins along the pavements and the front, street-name plates on
 * the corners, and a few road signs.
 *
 * The traffic lights work. Each junction's signals take turns — the north–
 * south road green fourteen seconds, amber three, both red two, then the
 * east–west road — and the traffic (traffic.ts) stops at red, and at amber
 * when there is room to; the island's people (folk.ts) cross a road at the
 * junction only while its traffic has red. Each approach has its signal head
 * on the near corner to the driver's right (the island drives on the right),
 * three lamps under their visors, lit as they are.
 *
 * Benches stand on the grass by the pavement, facing the road, and along the
 * sand facing the sea (slatted wood on cast-iron ends), a bin beside every
 * other one and at the corners; some have someone sitting on them (folk.ts).
 * The street-name plates (navy, white lettering) name each road by its
 * district and the way it runs. Everything is solid: it joins the world's
 * boxes, so you and everyone else go round it.
 */
import { BoxGeometry, CanvasTexture, Color, CylinderGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, Quaternion, SRGBColorSpace, Vector3, type BufferGeometry, type Scene } from 'three'
import { METRE } from './body'
import { Bag, place, seeded } from './kit'

type Box = { i0: number; i1: number; j0: number; j1: number; z0: number; z1: number }
export type Light = 'green' | 'amber' | 'red'
const M = METRE
/** North, south, west, east (x along j, z along i). */
const DX = [0, 0, -1, 1], DZ = [-1, 1, 0, 0]
const key = (i: number, j: number) => i * 1000 + j

/** A signal's cycle (seconds): north–south green, amber, both red, east–west green, amber, both red. */
const CYCLE = [14, 3, 2, 14, 3, 2], PERIOD = CYCLE.reduce((a, b) => a + b, 0)
/** The light for traffic running one way (ns or ew) at a junction, at a time. */
export function lightAt(t: number, offset: number, axis: 'ns' | 'ew'): Light {
  let u = (((t + offset) % PERIOD) + PERIOD) % PERIOD
  const phase = (() => { for (let k = 0; k < 6; k++) { if (u < CYCLE[k]) return k; u -= CYCLE[k] } return 0 })()
  if (axis === 'ns') return phase === 0 ? 'green' : phase === 1 ? 'amber' : 'red'
  return phase === 3 ? 'green' : phase === 4 ? 'amber' : 'red'
}

/** What a district's streets are called, by the way they run. */
const NAMES: Record<string, [string, string]> = {
  oldtown: ['Castle Street', 'Chapel Lane'], market: ['Market Street', 'Corn Row'], harbour: ['Quay Road', 'Anchor Lane'], funfair: ['Pier Parade', 'Carousel Walk'],
  peaks: ['Summit Road', 'Scree Lane'], badlands: ['Mesa Road', 'Canyon Lane'], proving: ['Gauge Road', 'Test Track Lane'],
}
const nameFor = (district: string, ew: boolean) => {
  const n = NAMES[district] ?? [district.replace(/(^|-)(\w)/g, (_, a, b) => (a ? ' ' : '') + b.toUpperCase()) + ' Street', district.replace(/(^|-)(\w)/g, (_, a, b) => (a ? ' ' : '') + b.toUpperCase()) + ' Lane']
  return ew ? n[0] : n[1]
}

export function street(scene: Scene, o: { roads: [number, number][]; kind(i: number, j: number): string; heightAt(x: number, z: number): number; boxes: Box[]; district: string[][]; seed?: number }) {
  const rnd = seeded(o.seed ?? 91)
  const roads = new Set(o.roads.map(([i, j]) => key(i, j)))
  const R_ = (i: number, j: number) => roads.has(key(i, j))
  const links = (i: number, j: number) => [0, 1, 2, 3].filter((d) => R_(i + DZ[d], j + DX[d]))
  const wide = (i: number, j: number) => [[0, 0], [-1, 0], [0, -1], [-1, -1]].some(([a, b]) => R_(i + a, j + b) && R_(i + a + 1, j + b) && R_(i + a, j + b + 1) && R_(i + a + 1, j + b + 1))
  const added: Box[] = []
  const solid = (x: number, z: number, hx: number, hz: number, y0: number, h: number) => { const b = { j0: x - hx, j1: x + hx, i0: z - hz, i1: z + hz, z0: y0, z1: y0 + h }; added.push(b); o.boxes.push(b) }
  const free = (x: number, z: number, r: number) => {
    const g = o.heightAt(x, z)
    for (const [a, b] of [[r, 0], [-r, 0], [0, r], [0, -r]]) if (Math.abs(o.heightAt(x + a, z + b) - g) > 0.004) return false
    return !o.boxes.some((B) => B.z1 > g + 0.01 && B.z0 < g + 0.25 && x + r > B.j0 && x - r < B.j1 && z + r > B.i0 && z - r < B.i1)
  }
  const group = new Group(); group.name = 'street'
  scene.add(group)

  /* ---- the junctions and their signals ---- */
  const junctions = o.roads.filter(([i, j]) => links(i, j).length >= 3 && !wide(i, j))
  const offsets = new Map<number, number>()
  junctions.forEach(([i, j]) => offsets.set(key(i, j), rnd() * PERIOD))
  type Head = { x: number; y: number; z: number; yaw: number; cell: number; axis: 'ns' | 'ew' }
  const heads: Head[] = [], poles: { x: number; z: number; y: number }[] = []
  for (const [i, j] of junctions) {
    for (const d of links(i, j)) {
      // The approach from the road off this side: traffic comes in heading the other way (BACK[d]).
      const hd = [1, 0, 3, 2][d], fx = DX[hd], fz = DZ[hd], rx = -fz, rz = fx
      // Its signal: the corner on the driver's right, before the junction.
      const x = j + 0.5 - fx * 0.42 + rx * 0.42, z = i + 0.5 - fz * 0.42 + rz * 0.42
      const y = o.heightAt(x, z)
      // (Facing the traffic coming at it.)
      heads.push({ x, y, z, yaw: Math.atan2(-fx, -fz), cell: key(i, j), axis: fz !== 0 ? 'ns' : 'ew' })
      if (!poles.some((p) => Math.hypot(p.x - x, p.z - z) < 0.02)) poles.push({ x, z, y })
    }
  }
  for (const p of poles) solid(p.x, p.z, 0.012, 0.012, p.y, 3.2 * M)

  /* ---- benches and bins ---- */
  type Seat = { x: number; z: number; y: number; yaw: number }
  const benches: Seat[] = [], bins: { x: number; z: number; y: number }[] = []
  // By the pavement on the grass, facing the road.
  const sides: Seat[] = []
  for (const [i, j] of o.roads) for (let d = 0; d < 4; d++) {
    const ti = i + DZ[d], tj = j + DX[d]
    if (R_(ti, tj) || o.kind(ti, tj) !== '1') continue
    // (On a straight: road on both sides along it.)
    const ax = DZ[d] !== 0 ? 1 : 0, az = 1 - ax
    if (!R_(i + az, j + ax) || !R_(i - az, j - ax)) continue
    const x = j + 0.5 + DX[d] * 0.62, z = i + 0.5 + DZ[d] * 0.62
    sides.push({ x, z, y: o.heightAt(x, z), yaw: Math.atan2(-DX[d], -DZ[d]) })
  }
  // On the sand, facing the sea.
  for (let i = 0; i < o.district.length; i++) for (let j = 0; j < o.district.length; j++) {
    if (o.kind(i, j) !== 'b') continue
    for (let d = 0; d < 4; d++) if (o.kind(i + DZ[d], j + DX[d]) === '0' && (o.kind(i - DZ[d], j - DX[d]) === '1' || R_(i - DZ[d], j - DX[d]))) {
      const x = j + 0.5 - DX[d] * 0.2, z = i + 0.5 - DZ[d] * 0.2
      sides.push({ x, z, y: o.heightAt(x, z), yaw: Math.atan2(DX[d], DZ[d]) })
    }
  }
  for (const s of sides.sort(() => rnd() - 0.5)) {
    if (benches.length >= 22) break
    if (benches.some((b) => Math.hypot(b.x - s.x, b.z - s.z) < 2.6) || !free(s.x, s.z, 0.11)) continue
    benches.push(s)
    const hx = Math.abs(Math.cos(s.yaw)) * 0.9 * M + Math.abs(Math.sin(s.yaw)) * 0.3 * M, hz = Math.abs(Math.sin(s.yaw)) * 0.9 * M + Math.abs(Math.cos(s.yaw)) * 0.3 * M
    solid(s.x, s.z, hx, hz, s.y, 0.45 * M)
    // A bin beside every other one.
    if (benches.length % 2 === 0) {
      const bx = s.x + Math.cos(s.yaw) * 1.25 * M, bz = s.z - Math.sin(s.yaw) * 1.25 * M
      if (free(bx, bz, 0.03)) { bins.push({ x: bx, z: bz, y: o.heightAt(bx, bz) }); solid(bx, bz, 0.025, 0.025, o.heightAt(bx, bz), 0.95 * M) }
    }
  }
  // And at the corners of the junctions.
  for (const [i, j] of junctions) for (const [si, sj] of [[-1, -1], [1, 1]]) {
    const x = j + 0.5 + sj * 0.455, z = i + 0.5 + si * 0.3
    if (bins.length < 40 && !R_(i + si, j + sj) && free(x, z, 0.03)) { bins.push({ x, z, y: o.heightAt(x, z) }); solid(x, z, 0.025, 0.025, o.heightAt(x, z), 0.95 * M) }
  }

  /* ---- road signs: thirty on the way into town, a crossing ahead before a junction ---- */
  type Sign = { x: number; z: number; y: number; yaw: number; kind: 'thirty' | 'crossing' }
  const signs: Sign[] = []
  for (const [i, j] of junctions) {
    if (signs.length >= 14 || rnd() < 0.5) continue
    const d = links(i, j)[Math.floor(rnd() * links(i, j).length)]
    // Two tiles back up the road off this side, on the driver's right (heading into the junction).
    const ti = i + DZ[d] * 2, tj = j + DX[d] * 2
    if (!R_(ti, tj) || links(ti, tj).length !== 2) continue
    const hd = [1, 0, 3, 2][d], rx = -DZ[hd], rz = DX[hd]
    const x = tj + 0.5 + rx * 0.45, z = ti + 0.5 + rz * 0.45
    if (!free(x, z, 0.01)) continue
    signs.push({ x, z, y: o.heightAt(x, z), yaw: Math.atan2(-DX[hd], -DZ[hd]), kind: signs.length % 2 ? 'crossing' : 'thirty' })
    solid(x, z, 0.01, 0.01, o.heightAt(x, z), 2.4 * M)
  }

  /* ---- drawing it all ---- */
  const metal = new MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.6 })
  const painted = new MeshStandardMaterial({ vertexColors: true, roughness: 0.7 })
  const inst = (geo: BufferGeometry, mat: MeshStandardMaterial | MeshBasicMaterial, list: { x: number; y: number; z: number; yaw?: number }[], shadow = true) => {
    const m = new InstancedMesh(geo, mat, Math.max(1, list.length)); m.count = list.length
    const mx = new Matrix4(), q = new Quaternion(), up = new Vector3(0, 1, 0), one = new Vector3(1, 1, 1)
    list.forEach((p, k) => m.setMatrixAt(k, mx.compose(new Vector3(p.x, p.y, p.z), q.setFromAxisAngle(up, p.yaw ?? 0), one)))
    m.castShadow = shadow; m.receiveShadow = true
    group.add(m)
    return m
  }
  // A signal pole: galvanised grey, a little cap.
  const pole = new Bag().add(new CylinderGeometry(0.055, 0.07, 3.2, 10), place(0, 1.6, 0), new Color('#8c949c')).add(new CylinderGeometry(0.07, 0.07, 0.04, 10), place(0, 3.2, 0), new Color('#5d646b'))
    .add(new CylinderGeometry(0.11, 0.13, 0.3, 10), place(0, 0.15, 0), new Color('#5d646b')).geometry()
  inst(pole, metal, poles)
  // Its head: a black housing with a backboard, three visors (the lamps go in front, separately, to light).
  const head = new Bag()
  const black = new Color('#15171a'), board = new Color('#202327')
  head.add(new BoxGeometry(0.32, 0.92, 0.24), place(0, 2.75, 0.18), black)
  head.add(new BoxGeometry(0.52, 1.12, 0.03), place(0, 2.75, 0.05), board)
  head.add(new BoxGeometry(0.06, 0.12, 0.2), place(0, 2.75, 0.06), new Color('#5d646b'))
  for (const y of [3.03, 2.75, 2.47]) head.add(new CylinderGeometry(0.14, 0.14, 0.2, 12, 1, true, -Math.PI / 2, Math.PI), place(0, y + 0.02, 0.37, Math.PI / 2, 0, 0), black)
  inst(head.geometry(), painted, heads)
  // The lamps: a lens each, lit (red, amber, green) or dark; three per head, coloured each frame.
  const lens = new Bag().add(new CylinderGeometry(0.105, 0.105, 0.02, 16).rotateX(Math.PI / 2), place(0, 0, 0.3)).geometry()
  const lampMat = new MeshBasicMaterial({ color: '#ffffff' })
  const lamps = new InstancedMesh(lens, lampMat, Math.max(1, heads.length * 3)); lamps.count = heads.length * 3
  {
    const mx = new Matrix4(), q = new Quaternion(), up = new Vector3(0, 1, 0), one = new Vector3(1, 1, 1)
    heads.forEach((h, k) => [3.03, 2.75, 2.47].forEach((y, n) => lamps.setMatrixAt(k * 3 + n, mx.compose(new Vector3(h.x, h.y + y * M, h.z), q.setFromAxisAngle(up, h.yaw), one).multiply(new Matrix4().makeTranslation(0, 0, 0.3 * M - 0.3 * M)))))
    lamps.setColorAt(0, new Color())
  }
  lamps.userData.noAO = true
  group.add(lamps)
  // A bench: two cast-iron ends, four slats to sit on, three to lean on.
  const bench = new Bag(), iron = new Color('#22302b'), wood = [new Color('#8a6643'), new Color('#7f5d3d'), new Color('#936d48')]
  for (const s of [-1, 1]) {
    bench.add(new BoxGeometry(0.05, 0.45, 0.06), place(s * 0.8, 0.225, 0.18), iron); bench.add(new BoxGeometry(0.05, 0.85, 0.06), place(s * 0.8, 0.42, -0.2, -0.18, 0, 0), iron)
    bench.add(new BoxGeometry(0.05, 0.05, 0.5), place(s * 0.8, 0.43, -0.02), iron); bench.add(new BoxGeometry(0.05, 0.04, 0.42), place(s * 0.8, 0.66, 0.0), iron)
  }
  for (let k = 0; k < 4; k++) bench.add(new BoxGeometry(1.8, 0.035, 0.09), place(0, 0.46, 0.17 - k * 0.11), wood[k % 3])
  for (let k = 0; k < 3; k++) bench.add(new BoxGeometry(1.8, 0.09, 0.03), place(0, 0.6 + k * 0.13, -0.25 - k * 0.025, -0.18, 0, 0), wood[(k + 1) % 3])
  inst(bench.geometry(), painted, benches)
  // A litter bin: dark green, ribbed, a domed lid with its slot.
  const bin = new Bag(), green = new Color('#1f3b33')
  bin.add(new CylinderGeometry(0.24, 0.21, 0.8, 16), place(0, 0.4, 0), green)
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; bin.add(new BoxGeometry(0.025, 0.78, 0.03), place(Math.cos(a) * 0.235, 0.4, Math.sin(a) * 0.235, 0, -a, 0), new Color('#17302a')) }
  bin.add(new CylinderGeometry(0.2, 0.26, 0.15, 16), place(0, 0.87, 0), green)
  bin.add(new BoxGeometry(0.22, 0.05, 0.05), place(0, 0.88, 0.2), new Color('#0b1411'))
  inst(bin.geometry(), painted, bins)
  // Road signs: a post, the sign (its face painted), a grey back.
  const post = new Bag().add(new CylinderGeometry(0.035, 0.035, 2.4, 8), place(0, 1.2, 0), new Color('#8c949c')).geometry()
  inst(post, metal, signs)
  const signTex = (() => {
    if (typeof document === 'undefined') return null
    const c = document.createElement('canvas'); c.width = 512; c.height = 256
    const g = c.getContext('2d')!
    // Left: 30 in a red ring. Right: a pedestrian crossing, a walking figure in a red triangle.
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(128, 128, 120, 0, Math.PI * 2); g.fill()
    g.lineWidth = 26; g.strokeStyle = '#d0262f'; g.beginPath(); g.arc(128, 128, 104, 0, Math.PI * 2); g.stroke()
    g.fillStyle = '#111'; g.font = 'bold 110px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('30', 128, 136)
    g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(384, 14); g.lineTo(502, 236); g.lineTo(266, 236); g.closePath(); g.fill()
    g.lineWidth = 22; g.strokeStyle = '#d0262f'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(384, 34); g.lineTo(484, 224); g.lineTo(284, 224); g.closePath(); g.stroke()
    g.fillStyle = '#111'; g.beginPath(); g.arc(384, 110, 13, 0, Math.PI * 2); g.fill()
    g.lineWidth = 12; g.strokeStyle = '#111'; g.lineCap = 'round'
    g.beginPath(); g.moveTo(384, 125); g.lineTo(378, 165); g.lineTo(360, 195); g.moveTo(378, 165); g.lineTo(396, 196); g.moveTo(382, 138); g.lineTo(362, 155); g.moveTo(382, 138); g.lineTo(402, 152); g.stroke()
    const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.anisotropy = 4
    return t
  })()
  const signMat = new MeshStandardMaterial({ map: signTex, roughness: 0.5, transparent: true, alphaTest: 0.5 })
  for (const s of signs) {
    const g = new PlaneGeometry(0.62 * M, 0.62 * M)
    const uv = g.getAttribute('uv'); for (let k = 0; k < uv.count; k++) uv.setX(k, uv.getX(k) * 0.5 + (s.kind === 'crossing' ? 0.5 : 0))
    const m = new Mesh(g, signMat)
    m.position.set(s.x + Math.sin(s.yaw) * 0.045 * M, s.y + 2.1 * M, s.z + Math.cos(s.yaw) * 0.045 * M); m.rotation.y = s.yaw; m.castShadow = true
    const back = new Mesh(new PlaneGeometry(0.6 * M, 0.6 * M), new MeshStandardMaterial({ color: '#9aa1a8', roughness: 0.6, metalness: 0.5 }))
    back.position.set(s.x + Math.sin(s.yaw) * 0.04 * M, s.y + 2.1 * M, s.z + Math.cos(s.yaw) * 0.04 * M); back.rotation.y = s.yaw + Math.PI
    group.add(m, back)
  }
  // Street-name plates on the signal poles: navy, white lettering, one along each road.
  if (typeof document !== 'undefined' && poles.length) {
    const names = [...new Set(junctions.flatMap(([i, j]) => [nameFor(o.district[i]?.[j] ?? 'town', true), nameFor(o.district[i]?.[j] ?? 'town', false)]))]
    const c = document.createElement('canvas'); c.width = 512; c.height = 64 * names.length
    const g = c.getContext('2d')!
    names.forEach((n, k) => {
      g.fillStyle = '#1b2a4c'; g.fillRect(0, k * 64, 512, 64)
      g.strokeStyle = '#eef2f8'; g.lineWidth = 4; g.strokeRect(6, k * 64 + 6, 500, 52)
      g.fillStyle = '#eef2f8'; g.font = '600 34px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(n, 256, k * 64 + 34)
    })
    const tex = new CanvasTexture(c); tex.colorSpace = SRGBColorSpace; tex.anisotropy = 4
    const mat = new MeshStandardMaterial({ map: tex, roughness: 0.45 })
    for (const [i, j] of junctions) {
      const corner = poles.find((p) => Math.abs(p.x - (j + 0.5)) < 0.5 && Math.abs(p.z - (i + 0.5)) < 0.5)
      if (!corner) continue
      for (const ew of [true, false]) {
        const n = names.indexOf(nameFor(o.district[i]?.[j] ?? 'town', ew))
        const gm = new PlaneGeometry(0.78 * M, 0.1 * M), uv = gm.getAttribute('uv')
        for (let k = 0; k < uv.count; k++) uv.setY(k, 1 - (n + 1 - uv.getY(k)) / names.length)
        for (const side of [0, Math.PI]) {
          const m = new Mesh(gm, mat)
          // (Running along its road: plates for an east–west road face north and south.)
          const yaw = (ew ? 0 : Math.PI / 2) + side
          m.position.set(corner.x + Math.sin(yaw) * 0.006, corner.y + (ew ? 2.32 : 2.2) * M, corner.z + Math.cos(yaw) * 0.006); m.rotation.y = yaw
          group.add(m)
        }
      }
    }
  }

  const red = new Color(1, 0.08, 0.06), amber = new Color(1, 0.55, 0.05), green2 = new Color(0.1, 1, 0.45), dark = new Color(0.06, 0.06, 0.07)
  const darkRed = new Color(0.16, 0.03, 0.03), darkAmber = new Color(0.16, 0.1, 0.03), darkGreen = new Color(0.03, 0.12, 0.07)
  let t = 0
  const light = (cell: number, axis: 'ns' | 'ew') => lightAt(t, offsets.get(cell) ?? 0, axis)
  void dark
  return {
    group, benches, junctions,
    /** The light facing traffic driving from one cell into a junction's cell. */
    signal: (cell: [number, number], from: [number, number]): Light => (offsets.has(key(cell[0], cell[1])) ? light(key(cell[0], cell[1]), cell[0] !== from[0] ? 'ns' : 'ew') : 'green'),
    /** Whether someone on foot may cross the road at a junction cell whose traffic runs one way (it has red). */
    mayCross: (i: number, j: number, axis: 'ns' | 'ew') => !offsets.has(key(i, j)) || light(key(i, j), axis) === 'red',
    /** Each frame: the signals change; the lamps light. */
    update(dt: number, glow: number) {
      t += dt
      const k = 2.2 + 2.5 * glow
      heads.forEach((h, n) => {
        const l = light(h.cell, h.axis)
        lamps.setColorAt(n * 3, l === 'red' ? red.clone().multiplyScalar(k) : darkRed)
        lamps.setColorAt(n * 3 + 1, l === 'amber' ? amber.clone().multiplyScalar(k) : darkAmber)
        lamps.setColorAt(n * 3 + 2, l === 'green' ? green2.clone().multiplyScalar(k) : darkGreen)
      })
      if (lamps.instanceColor) lamps.instanceColor.needsUpdate = true
    },
    /** (For the checks.) */
    counts: () => ({ junctions: junctions.length, heads: heads.length, poles: poles.length, benches: benches.length, bins: bins.length, signs: signs.length, solids: added.length }),
  }
}
