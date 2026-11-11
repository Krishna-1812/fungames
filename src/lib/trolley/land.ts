/**
 * The country the line runs through.
 *
 * Flat where the tracks are, because that is where the eye has to read who is
 * standing on what, and rising into hills behind so there is somewhere for
 * the light to come over. Grass in tufts that lean with the wind, trees in a
 * belt at the back, a post-and-rail fence for scale, stones and flowers for
 * the eye to find the second time.
 *
 * Built once. Nothing here changes between problems; only the light does.
 */
import {
  BoxGeometry, Color, ConeGeometry, CylinderGeometry, DodecahedronGeometry, DoubleSide, Float32BufferAttribute,
  Group, IcosahedronGeometry, InstancedMesh, Mesh, MeshStandardMaterial, Object3D, PlaneGeometry,
  SphereGeometry, BufferGeometry,
} from 'three'
import type { Texture } from 'three'
import { grassTexture, merge, part, rng } from './kit'

/** Smooth value noise, two octaves, good for hills and for patches of colour. */
function noise(x: number, z: number) {
  const h = (i: number, j: number) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s) }
  const one = (x: number, z: number) => {
    const i = Math.floor(x), j = Math.floor(z), u = x - i, v = z - j
    const a = u * u * (3 - 2 * u), b = v * v * (3 - 2 * v)
    return (h(i, j) * (1 - a) + h(i + 1, j) * a) * (1 - b) + (h(i, j + 1) * (1 - a) + h(i + 1, j + 1) * a) * b
  }
  return one(x, z) * 0.65 + one(x * 2.3 + 9, z * 2.3 + 4) * 0.35
}
const ramp = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t))

/** Height of the land, track beds not included. */
export function landHeight(x: number, z: number) {
  const back = ramp((-17 - z) / 46)
  const front = ramp((z - 13) / 26)
  const side = ramp((Math.abs(x) - 44) / 40)
  return back * (3 + 7 * noise(x * 0.022, z * 0.022)) + side * (1 - back) * 2.6 * noise(x * 0.04 + 7, z * 0.04) - front * 3.2
    + (back + side) * 0.5 * noise(x * 0.11, z * 0.11)
}

export function buildLand(onBed: (x: number, z: number) => boolean) {
  const group = new Group()
  const r = rng(5)
  const textures: Texture[] = []

  /* ---- the ground ---- */
  const W = 340, D = 240, cz = -62
  const geo = new PlaneGeometry(W, D, 170, 120)
  geo.rotateX(-Math.PI / 2)
  geo.translate(0, 0, cz)
  const pos = geo.getAttribute('position')
  const col = new Float32Array(pos.count * 3), uv = geo.getAttribute('uv')
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i)
    pos.setY(i, landHeight(x, z))
    uv.setXY(i, x / 11, z / 11)
    // Patches: drier and paler on the rises, darker in the hollows.
    const p = noise(x * 0.06 + 3, z * 0.06 + 8), q = noise(x * 0.21, z * 0.21)
    const far = ramp((-20 - z) / 70)
    const c = new Color().setRGB(0.86 + p * 0.3 - far * 0.1, 0.9 + q * 0.2 - far * 0.04, 0.8 + p * 0.16 + far * 0.1)
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b
  }
  geo.setAttribute('color', new Float32BufferAttribute(col, 3))
  geo.computeVertexNormals()
  const grass = grassTexture()
  textures.push(grass)
  const ground = new Mesh(geo, new MeshStandardMaterial({ map: grass, vertexColors: true, roughness: 1, metalness: 0 }))
  ground.receiveShadow = true
  group.add(ground)

  const dummy = new Object3D()
  const tint = new Color()

  /* ---- tufts of grass ---- */
  const blade = (lean: number, turn: number, hgt: number) => {
    const g = new BufferGeometry()
    const w = 0.03
    g.setAttribute('position', new Float32BufferAttribute([-w, 0, 0, w, 0, 0, lean, hgt, 0], 3))
    g.setAttribute('normal', new Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0], 3))
    g.setAttribute('uv', new Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2))
    return part(g, 0xffffff, [(r() - 0.5) * 0.12, 0, (r() - 0.5) * 0.12], [0, turn, 0])
  }
  const tuftGeo = merge(Array.from({ length: 7 }, (_, k) => blade((r() - 0.5) * 0.16, k * 0.9 + r(), 0.2 + r() * 0.24)))
  // Lit like the ground it stands on: a blade's own normal would make half of them black.
  const tn = tuftGeo.getAttribute('normal')
  for (let i = 0; i < tn.count; i++) tn.setXYZ(i, 0, 1, 0)
  const tuftMat = new MeshStandardMaterial({ side: DoubleSide, roughness: 1, metalness: 0 })
  const wind = { value: 0 }
  tuftMat.onBeforeCompile = (sh) => {
    sh.uniforms.uWind = wind
    sh.vertexShader = 'uniform float uWind;\n' + sh.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       #ifdef USE_INSTANCING
         float ph = instanceMatrix[3].x * 0.31 + instanceMatrix[3].z * 0.23;
         float sway = sin(uWind * 1.6 + ph) * 0.6 + sin(uWind * 3.7 + ph * 2.1) * 0.25;
         transformed.x += sway * position.y * 0.32;
       #endif`,
    )
  }
  const TUFTS = 15000
  const tufts = new InstancedMesh(tuftGeo, tuftMat, TUFTS)
  const tuftTones = [0x4f6f2a, 0x638437, 0x7a9642, 0x8a9c48, 0x56702c, 0x9aa552, 0x6d8c3a]
  let placed = 0
  for (let guard = 0; placed < TUFTS && guard < TUFTS * 4; guard++) {
    // Thicker towards the camera, where a blade is more than a pixel.
    const z = 14 - Math.pow(r(), 1.6) * 36, x = (r() - 0.5) * 96
    if (onBed(x, z)) continue
    dummy.position.set(x, landHeight(x, z), z)
    dummy.rotation.set(0, r() * 6.28, 0)
    const s = 0.5 + r() * 0.7
    dummy.scale.set(s, s * (0.6 + r() * 0.8), s)
    dummy.updateMatrix()
    tufts.setMatrixAt(placed, dummy.matrix)
    tint.setHex(tuftTones[(r() * tuftTones.length) | 0]).multiplyScalar(0.8 + r() * 0.4)
    tufts.setColorAt(placed, tint)
    placed++
  }
  tufts.count = placed
  tufts.receiveShadow = true
  group.add(tufts)

  /* ---- flowers and stones ---- */
  const flowerGeo = new SphereGeometry(0.055, 6, 5)
  const flowers = new InstancedMesh(flowerGeo, new MeshStandardMaterial({ roughness: 0.7 }), 700)
  const petals = [0xf4f1e6, 0xf4f1e6, 0xe8d36a, 0xb49ad8, 0xe6a6b8]
  for (let i = 0, n = 0; n < 700 && i < 6000; i++) {
    // In drifts, not evenly: a patch is seeded and filled.
    const cx = (r() - 0.5) * 80, czz = 12 - r() * 26, hue = petals[(r() * petals.length) | 0]
    for (let k = 0; k < 18 && n < 700; k++) {
      const x = cx + (r() - 0.5) * 5, z = czz + (r() - 0.5) * 3
      if (onBed(x, z)) continue
      dummy.position.set(x, landHeight(x, z) + 0.2 + r() * 0.12, z)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.setScalar(0.7 + r() * 0.8)
      dummy.updateMatrix()
      flowers.setMatrixAt(n, dummy.matrix)
      flowers.setColorAt(n, tint.setHex(hue))
      n++
    }
  }
  group.add(flowers)

  const stoneGeo = new DodecahedronGeometry(0.3, 0)
  const stones = new InstancedMesh(stoneGeo, new MeshStandardMaterial({ roughness: 0.95, flatShading: true }), 60)
  for (let i = 0; i < 60; i++) {
    let x = 0, z = 0
    do { x = (r() - 0.5) * 90; z = 12 - r() * 30 } while (onBed(x, z))
    dummy.position.set(x, landHeight(x, z) + 0.05, z)
    dummy.rotation.set(r() * 3, r() * 3, r() * 3)
    dummy.scale.set(0.5 + r() * 1.4, 0.35 + r() * 0.6, 0.5 + r() * 1.2)
    dummy.updateMatrix()
    stones.setMatrixAt(i, dummy.matrix)
    stones.setColorAt(i, tint.setHex(r() > 0.5 ? 0x8b8880 : 0x76736c).multiplyScalar(0.8 + r() * 0.4))
  }
  stones.castShadow = stones.receiveShadow = true
  group.add(stones)

  /* ---- trees ---- */
  const leaf = [0x3f6a2c, 0x4d7a31, 0x5c8a3a, 0x35602a, 0x6f9440]
  const broad = () => {
    const parts = [part(new CylinderGeometry(0.2, 0.32, 2.6, 7), 0x5a4332, [0, 1.3, 0])]
    for (let k = 0; k < 6; k++) {
      const a = r() * 6.28, d = k ? 0.6 + r() * 0.9 : 0
      parts.push(part(new IcosahedronGeometry(1.25 + r() * 0.7, 1), new Color(leaf[(r() * leaf.length) | 0]).multiplyScalar(0.85 + r() * 0.3),
        [Math.cos(a) * d, 3.2 + r() * 1.7, Math.sin(a) * d], [r(), r(), r()], [1, 0.82 + r() * 0.25, 1]))
    }
    return merge(parts)
  }
  const fir = () => {
    const parts = [part(new CylinderGeometry(0.16, 0.26, 1.6, 6), 0x4e3a2b, [0, 0.8, 0])]
    for (let k = 0; k < 5; k++)
      parts.push(part(new ConeGeometry(1.7 - k * 0.3, 2.1, 9), new Color(0x2f5630).multiplyScalar(0.85 + k * 0.07), [0, 2 + k * 1.15, 0], [0, r() * 3, 0]))
    return merge(parts)
  }
  const treeMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.92, flatShading: false })
  const kinds = [broad(), broad(), broad(), fir(), fir()]
  const spots: Array<[number, number, number, number]> = []
  // A belt behind the far fence, thinning as it climbs, and a stand at each end.
  for (let i = 0; i < 150; i++) {
    const z = -24 - Math.pow(r(), 1.3) * 70, x = (r() - 0.5) * 230
    spots.push([x, z, 0.8 + r() * 0.8, (r() * kinds.length) | 0])
  }
  for (let i = 0; i < 26; i++) {
    const s = i % 2 ? 1 : -1
    spots.push([s * (40 + r() * 34), -15 + r() * 22, 0.8 + r() * 0.7, (r() * kinds.length) | 0])
  }
  kinds.forEach((g, k) => {
    const mine = spots.filter((s) => s[3] === k)
    const inst = new InstancedMesh(g, treeMat, mine.length)
    mine.forEach(([x, z, s], i) => {
      dummy.position.set(x, landHeight(x, z) - 0.1, z)
      dummy.rotation.set(0, r() * 6.28, 0)
      dummy.scale.set(s, s * (0.9 + r() * 0.3), s)
      dummy.updateMatrix()
      inst.setMatrixAt(i, dummy.matrix)
      inst.setColorAt(i, tint.setScalar(0.82 + r() * 0.3))
    })
    inst.castShadow = true
    inst.receiveShadow = true
    group.add(inst)
  })

  /* ---- bushes along the fence ---- */
  const bushGeo = merge([0, 1, 2].map((k) => part(new IcosahedronGeometry(0.7, 1), new Color(leaf[k + 1]), [k * 0.5 - 0.5, 0.45, (k % 2) * 0.3], [k, k, 0], [1, 0.75, 1])))
  const bushes = new InstancedMesh(bushGeo, treeMat, 40)
  for (let i = 0; i < 40; i++) {
    const x = (r() - 0.5) * 110, z = -13.5 - r() * 3.5
    dummy.position.set(x, landHeight(x, z), z)
    dummy.rotation.set(0, r() * 6.28, 0)
    dummy.scale.setScalar(0.7 + r() * 0.9)
    dummy.updateMatrix()
    bushes.setMatrixAt(i, dummy.matrix)
    bushes.setColorAt(i, tint.setScalar(0.8 + r() * 0.35))
  }
  bushes.castShadow = bushes.receiveShadow = true
  group.add(bushes)

  /* ---- the fence ---- */
  const fenceMat = new MeshStandardMaterial({ color: 0x8a7458, roughness: 0.9 })
  const FZ = -12.6
  const posts = new InstancedMesh(new BoxGeometry(0.13, 1.25, 0.13), fenceMat, 60)
  for (let i = 0; i < 60; i++) {
    const x = -88 + i * 3
    dummy.position.set(x, landHeight(x, FZ) + 0.55, FZ)
    dummy.rotation.set((r() - 0.5) * 0.05, 0, (r() - 0.5) * 0.06)
    dummy.scale.set(1, 1, 1)
    dummy.updateMatrix()
    posts.setMatrixAt(i, dummy.matrix)
  }
  posts.castShadow = true
  group.add(posts)
  for (const y of [0.45, 0.9]) {
    const rail = new Mesh(new BoxGeometry(177, 0.09, 0.04), fenceMat)
    rail.position.set(0, y, FZ + 0.07)
    rail.castShadow = true
    group.add(rail)
  }

  return {
    group,
    update(t: number) { wind.value = t },
    dispose() {
      group.traverse((o) => {
        const m = o as Mesh
        m.geometry?.dispose()
        const mat = m.material as MeshStandardMaterial | undefined
        mat?.dispose?.()
      })
      for (const t of textures) t.dispose()
    },
  }
}
