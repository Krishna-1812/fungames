/**
 * The walk — you, on foot, on the island (build3d.ts), in third person.
 *
 * Moving is physical: you walk at a walk and run at a run (a tile is about
 * three and a half metres, so you are half a tile tall), gravity pulls you
 * down and a jump takes you a hand's height off the ground; the ground under
 * you is the island's own (terrain.ts), so you walk up a slope, a little
 * slower the steeper it is, and down it without leaving it, and a wall you
 * cannot walk up you may climb if it is no higher than your chest; buildings stop you at their walls (their
 * solids, as boxes), and you can stand on what is low enough to step onto (a
 * plinth, a pier); in water too deep to stand in you swim, slowly, your head
 * above it, rising and falling with the swell; water slows you as you wade,
 * a stream's current carries you along, and the water answers you: rings
 * spread from you and spray flies when you jump in. The island's traffic (traffic.ts, the same that drives the map)
 * drives its roads round you and pushes you aside if you stand in its way.
 * Walk up to a game's building and it offers to take you in.
 *
 * The sky is a physical one (three's Sky: Rayleigh and Mie scattering) with
 * the sun in it, the distance hazed the way air hazes it; after dark the
 * windows light. Keyboard and mouse, or a thumb on a phone.
 */
import {
  ACESFilmicToneMapping, AmbientLight, BoxGeometry, Color, DirectionalLight, Fog, Group, HemisphereLight, Mesh, MeshStandardMaterial,
  PCFShadowMap, PerspectiveCamera, PointLight, Points, PointsMaterial, BufferGeometry, Float32BufferAttribute, PMREMGenerator, type WebGLRenderTarget, Scene, SphereGeometry, SRGBColorSpace, Vector3, WebGLRenderer, CylinderGeometry, MathUtils,
} from 'three'
import { Sky } from 'three/examples/jsm/objects/Sky.js'
import { buildWorld, Y, type WorldData } from './build3d'
import { createTraffic } from '../island/traffic'
import { splashes } from './splash'
import { lens } from './lens'

export type Walk = { dispose(): void; setNight(on: boolean): void; setAerial(on: boolean): void; near(): { slug: string; title: string; href: string } | null
  /** Where you are and how (for the checks). */
  state(): { x: number; y: number; z: number; onGround: boolean; swimming: boolean; inWater: boolean; spray: number; cars: number[][] }
  /** Set you down somewhere, looking a given way (for the checks, and for pictures). */
  goTo(x: number, z: number, view?: { yaw?: number; pitch?: number; dist?: number }): void }

const TALL = 0.5, RADIUS = 0.11, STEP = 0.14
/** The highest ledge you can pull yourself up onto (about 1.25 m), and out of the water onto a quay or a beach. */
const CLIMB = 0.36, CLIMB_WET = 0.62, CLIMB_SPEED = 1.5
const WALK = 0.5, RUN = 1.45, SWIM = 0.32
const GRAVITY = 2.8, JUMP = 1.15

export function startWalk(canvas: HTMLCanvasElement, data: WorldData, ui: { onNear(g: { title: string } | null): void; move?: () => [number, number] }): Walk {
  const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 0.55
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFShadowMap // (soft-edged by the light's shadow.radius)
  // A phone (or a small screen) draws a lighter picture: no occlusion pass, a smaller shadow map.
  const phone = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 600
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches
  let post: ReturnType<typeof lens> | null = null
  renderer.debug.checkShaderErrors = false

  const scene = new Scene()
  const world = buildWorld(data)
  scene.add(world.root)
  // Asked for less motion: the sea lies flat (no swell rocking you, or the camera, as you swim).
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) world.swell.value = 0

  /* ---- the sky, the sun, the air ---- */
  const sky = new Sky()
  sky.scale.setScalar(4000)
  const su = sky.material.uniforms
  su.turbidity.value = 4; su.rayleigh.value = 1.6; su.mieCoefficient.value = 0.004; su.mieDirectionalG.value = 0.86
  scene.add(sky)
  // The sky also lights the world: blurred into an environment map, it is what
  // the sea and the glass reflect and the soft light that fills every shadow.
  const pmrem = new PMREMGenerator(renderer)
  const envScene = new Scene(), envSky = new Sky()
  envSky.material = sky.material; envSky.scale.setScalar(1000); envScene.add(envSky)
  let envRT: WebGLRenderTarget | null = null
  // The night: a deep blue dark, a few thousand stars and the moon, which casts the shadows.
  const nightEnv = new Scene(); nightEnv.background = new Color('#1b2a52')
  const starPos: number[] = []
  for (let k = 0; k < 2600; k++) {
    const u = Math.random(), a = Math.random() * Math.PI * 2, el = Math.asin(0.04 + 0.96 * u)
    starPos.push(Math.cos(el) * Math.sin(a) * 900, Math.sin(el) * 900, Math.cos(el) * Math.cos(a) * 900)
  }
  const starGeo = new BufferGeometry(); starGeo.setAttribute('position', new Float32BufferAttribute(starPos, 3))
  const stars = new Points(starGeo, new PointsMaterial({ color: '#dfe8ff', size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 }))
  const moon = new Mesh(new SphereGeometry(18, 24, 16), new MeshStandardMaterial({ color: '#000000', emissive: new Color('#eef2ff'), emissiveIntensity: 1.1, fog: false }))
  scene.add(stars, moon)
  // Light from the lamps nearest you (a handful of real lights, moved to whichever lamps are close).
  const lampLights = Array.from({ length: 6 }, () => { const l = new PointLight('#dfe8ff', 0, 2.2, 1.6); scene.add(l); return l })
  const sun = new DirectionalLight('#fff3e2', 2.6)
  sun.castShadow = true
  // Shadows soft-edged, cast across the thirteen tiles round you (more than you can make out the shadows past).
  const SHADOW = phone ? 2048 : 4096, REACH = 13
  sun.shadow.mapSize.set(SHADOW, SHADOW)
  const sc = sun.shadow.camera; sc.left = -REACH; sc.right = REACH; sc.top = REACH; sc.bottom = -REACH; sc.near = 0.5; sc.far = 70
  sun.shadow.radius = 3
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02
  scene.add(sun, sun.target)
  const hemi = new HemisphereLight('#bcd4f0', '#7d8a6a', 0.9)
  const amb = new AmbientLight('#ffffff', 0.12)
  scene.add(hemi, amb)
  scene.fog = new Fog('#c9dbe8', 14, 70)
  let night = false, aerial = false
  const sunDir = new Vector3()
  const setSky = () => {
    const elev = night ? 38 : 34, az = night ? 140 : 215
    sunDir.setFromSphericalCoords(1, MathUtils.degToRad(90 - elev), MathUtils.degToRad(az))
    su.sunPosition.value.copy(sunDir)
    sun.intensity = night ? 0.32 : 2.6
    sky.visible = !night; stars.visible = moon.visible = night
    scene.background = night ? new Color('#0b1430') : null
    moon.position.copy(sunDir).multiplyScalar(800)
    world.bulbs.emissiveIntensity = night ? 2.2 : 0
    // The moon's light under the water is a faint net; the sun's, a bright one.
    world.caustics.value = night ? 0.12 : 1
    sun.color.set(night ? '#9fb4ff' : '#fff1dc')
    hemi.intensity = night ? 0.12 : 0.6
    hemi.color.set(night ? '#4a5a88' : '#bcd4f0')
    ;(scene.fog as Fog).color.set(night ? '#0d1424' : '#c9dbe8')
    world.glass.emissiveIntensity = night ? 1.4 : 0
    renderer.toneMappingExposure = night ? 0.9 : 0.55
    post?.setNight(night)
    envRT?.dispose(); envRT = pmrem.fromScene(night ? nightEnv : envScene)
    scene.environment = envRT.texture
    scene.environmentIntensity = night ? 0.35 : 0.3
  }
  setSky()

  /* ---- you ---- */
  const me = new Group()
  const skin = new MeshStandardMaterial({ color: '#e0b38f', roughness: 0.7 }), shirt = new MeshStandardMaterial({ color: '#4fe3c1', roughness: 0.8 }), trousers = new MeshStandardMaterial({ color: '#3b4a6b', roughness: 0.85 })
  const body = new Mesh(new CylinderGeometry(0.075, 0.085, 0.2, 10), shirt); body.position.y = 0.3
  const head = new Mesh(new SphereGeometry(0.065, 14, 10), skin); head.position.y = 0.45
  const legGeo = new BoxGeometry(0.05, 0.2, 0.06)
  const legL = new Mesh(legGeo, trousers), legR = new Mesh(legGeo, trousers)
  legL.geometry.translate(0, -0.1, 0)
  legL.position.set(-0.035, 0.2, 0); legR.position.set(0.035, 0.2, 0)
  const armGeo = new BoxGeometry(0.035, 0.17, 0.04); armGeo.translate(0, -0.085, 0)
  const armL = new Mesh(armGeo, shirt), armR = new Mesh(armGeo, shirt)
  armL.position.set(-0.1, 0.39, 0); armR.position.set(0.1, 0.39, 0)
  for (const m of [body, head, legL, legR, armL, armR]) { m.castShadow = true; me.add(m) }
  scene.add(me)

  /* ---- where you can stand ---- */
  const seaY = Y(data.sea)
  /** The ground's height at a world point: the tile's top, or the top of something built low enough to stand on. */
  const groundAt = (x: number, z: number, from: number, reach = STEP) => {
    let g = world.heightAt(x, z)
    for (const b of world.boxes) if (x > b.j0 && x < b.j1 && z > b.i0 && z < b.i1 && b.z1 <= from + reach && b.z1 > g) g = b.z1
    return g
  }
  /** Whether a wall stands at a point: ground or something built, higher than you can get up (by a step, or a climb). */
  const blockedAt = (x: number, z: number, y: number, reach = STEP) => {
    // A terrace wall or a cliff too tall.
    for (const [dx, dz] of [[RADIUS, 0], [-RADIUS, 0], [0, RADIUS], [0, -RADIUS]]) if (world.heightAt(x + dx, z + dz) > y + reach) return true
    // A wall: any box you would be inside that rises above what you can get up.
    for (const b of world.boxes) if (b.z1 > y + reach && b.z0 < y + TALL && x > b.j0 - RADIUS && x < b.j1 + RADIUS && z > b.i0 - RADIUS && z < b.i1 + RADIUS) return true
    return false
  }
  /** Moving to a point: free, a ledge to pull yourself up onto first (its top), or a wall (false). */
  const moveTo = (x: number, z: number): boolean | number => {
    if (!blockedAt(x, z, pos.y)) return true
    const reach = swimming || pos.y < seaY ? CLIMB_WET : CLIMB
    if (blockedAt(x, z, pos.y, reach)) return false
    // Lower than a climb: the ledge's top, at the point you reach for.
    const top = Math.max(groundAt(x, z, pos.y, reach), ...[[RADIUS, 0], [-RADIUS, 0], [0, RADIUS], [0, -RADIUS]].map(([dx, dz]) => groundAt(x + dx, z + dz, pos.y, reach)))
    return top > pos.y ? top : true
  }
  let climbTo: number | null = null
  /** The water's surface where you are (the sea with its swell, or the stream or the pond), if there is water there. */
  const waterAt = (x: number, z: number, ground: number) => world.poolAt(x, z) ?? (ground < seaY + 0.06 ? world.seaAt(x, z) : null)
  let inWater = false, waterDepth = 0, rippleTick = 0
  const water = splashes(scene)

  // Set down in the town square, facing into it.
  const start = data.road[Math.floor(data.road.length / 2)] ?? [15, 15]
  const pos = new Vector3(start[1] + 0.5, 0, start[0] + 0.5)
  pos.y = groundAt(pos.x, pos.z, 99)
  const vel = new Vector3()
  let yaw = Math.PI * 0.75, pitch = 0.32, dist = innerHeight > innerWidth ? 1.9 : 1.35, onGround = true, swimming = false, stride = 0, stroke = 0

  /* ---- the traffic ---- */
  const traffic = createTraffic({ roads: data.road, play: true, dark: () => (night ? 1 : 0) })
  const carMeshes: Group[] = []
  const carGeo = new BoxGeometry(0.42, 0.09, 0.2), cabGeo = new BoxGeometry(0.22, 0.07, 0.18), busGeo = new BoxGeometry(0.76, 0.2, 0.24), wheelGeo = new CylinderGeometry(0.035, 0.035, 0.21, 10)
  const glassMat = new MeshStandardMaterial({ color: '#203048', roughness: 0.2, metalness: 0.4 }), tyre = new MeshStandardMaterial({ color: '#1b1f27', roughness: 0.9 })
  for (const c of traffic.state()) {
    const g = new Group(), paint = new MeshStandardMaterial({ color: c.kind === 'bus' ? '#5b82ff' : ['#ff4f6e', '#4fe3c1', '#ffffff'][carMeshes.length % 3], roughness: 0.35, metalness: 0.3 })
    if (c.kind === 'bus') { const b = new Mesh(busGeo, paint); b.position.y = 0.14; g.add(b) }
    else { const b = new Mesh(carGeo, paint); b.position.y = 0.075; const cab = new Mesh(cabGeo, glassMat); cab.position.set(-0.02, 0.15, 0); g.add(b, cab) }
    for (const [x] of [[-0.13], [0.13]]) { const w = new Mesh(wheelGeo, tyre); w.rotation.x = Math.PI / 2; w.position.set(x * (c.kind === 'bus' ? 2 : 1), 0.035, 0); g.add(w) }
    g.traverse((m) => { if ((m as Mesh).isMesh) m.castShadow = true })
    scene.add(g); carMeshes.push(g)
  }

  /* ---- the camera ---- */
  const camera = new PerspectiveCamera(55, 1, 0.03, 500)
  const fit = () => {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight
    const pr = Math.min(devicePixelRatio, 2)
    renderer.setPixelRatio(pr); renderer.setSize(w, h, false)
    post?.setSize(w, h, pr)
    camera.aspect = w / h; camera.updateProjectionMatrix()
  }
  post = lens(renderer, scene, camera, { phone, still, ao: !new URLSearchParams(location.search).has('noao') })
  post.setNight(night)
  fit()
  addEventListener('resize', fit)

  /* ---- input ---- */
  const keys = new Set<string>()
  const kd = (e: KeyboardEvent) => { keys.add(e.code); if (e.code === 'Space') e.preventDefault() }
  const ku = (e: KeyboardEvent) => keys.delete(e.code)
  addEventListener('keydown', kd); addEventListener('keyup', ku)
  let dragging = false, lx = 0, ly = 0
  const pd = (e: PointerEvent) => { if ((e.target as HTMLElement) !== canvas) return; dragging = true; lx = e.clientX; ly = e.clientY; canvas.setPointerCapture(e.pointerId) }
  const pm = (e: PointerEvent) => { if (!dragging) return; yaw -= (e.clientX - lx) * 0.006; pitch = MathUtils.clamp(pitch + (e.clientY - ly) * 0.004, 0.05, 1.2); lx = e.clientX; ly = e.clientY }
  const pu = () => { dragging = false }
  const wh = (e: WheelEvent) => { dist = MathUtils.clamp(dist * (1 + e.deltaY * 0.001), 0.6, 4); e.preventDefault() }
  canvas.addEventListener('pointerdown', pd); addEventListener('pointermove', pm); addEventListener('pointerup', pu); canvas.addEventListener('wheel', wh, { passive: false })

  /* ---- each frame ---- */
  let raf = 0, last = performance.now(), near: { slug: string; title: string; href: string } | null = null
  const camPos = new Vector3(), look = new Vector3()
  let sunTick = 0, sunSeen = 0, sunVis = 0
  const sunAt = new Vector3(), sunLook = new Vector3(), ray = new Vector3()
  /** Whether a line from the camera towards the sun gets clear of the ground and everything built. */
  const sunClear = () => {
    for (let t = 0.15; t < 18; t += 0.3) {
      ray.copy(camera.position).addScaledVector(sunDir, t)
      if (ray.y < world.heightAt(ray.x, ray.z)) return false
      for (const b of world.boxes) if (ray.y < b.z1 && ray.y > b.z0 && ray.x > b.j0 && ray.x < b.j1 && ray.z > b.i0 && ray.z < b.i1) return false
      if (ray.y > 3) return true
    }
    return true
  }
  const UP = new Vector3(0, 1, 0), lightRight = new Vector3(), lightUp = new Vector3(), snapped = new Vector3()
  let lampTick = 0
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop)
    const dt = Math.min(0.05, (now - last) / 1000); last = now
    world.time.value = now / 1000
    // Which way you want to go, turned to the camera.
    let fx = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0)
    let fz = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0)
    const stick = ui.move?.() ?? [0, 0]
    if (stick[0] || stick[1]) { fx = stick[0]; fz = -stick[1] }
    const mag = Math.min(1, Math.hypot(fx, fz))
    const speed0 = swimming ? SWIM : keys.has('ShiftLeft') || keys.has('ShiftRight') || mag > 0.95 && stick[0] + stick[1] !== 0 ? RUN : WALK
    const sx = Math.sin(yaw), cz = Math.cos(yaw)
    // Uphill is harder going: slower the steeper it is the way you are heading (and a touch quicker down).
    const hx = -fz * sx + fx * cz, hz = -fz * cz - fx * sx, hl = Math.hypot(hx, hz) || 1
    const rise = onGround && !swimming ? (world.heightAt(pos.x + (hx / hl) * 0.08, pos.z + (hz / hl) * 0.08) - world.heightAt(pos.x, pos.z)) / 0.08 : 0
    // Wading, the water holds you back: the deeper, the harder (up to your chest, about half your pace).
    const wade = !swimming && inWater ? 1 - 0.5 * Math.min(1, waterDepth / 0.32) : 1
    const speed = speed0 * Math.max(0.55, Math.min(1.12, 1 - rise * 0.9)) * wade
    const wantX = (-fz * sx + fx * cz) * speed * mag / (mag || 1), wantZ = (-fz * cz - fx * sx) * speed * mag / (mag || 1)
    // Your feet take a moment to get going and to stop (more on the ground than in the air or the water).
    const grip = onGround ? 10 : swimming ? 3 : 1.5
    vel.x += (wantX - vel.x) * Math.min(1, grip * dt); vel.z += (wantZ - vel.z) * Math.min(1, grip * dt)
    if (climbTo !== null) {
      // Pulling yourself up a ledge: up first, then on over it.
      pos.y = Math.min(climbTo + 0.002, pos.y + CLIMB_SPEED * dt); vel.y = 0
      if (pos.y >= climbTo) { climbTo = null; onGround = true; swimming = false }
    } else {
      if (onGround && !swimming && keys.has('Space')) { vel.y = JUMP; onGround = false }
      vel.y -= GRAVITY * dt
      // Across, then along: each blocked on its own, so you slide along a wall; a
      // ledge no higher than your chest (from the water, a quay or a beach) you climb.
      const nx = pos.x + vel.x * dt, mx = moveTo(nx, pos.z)
      if (mx === true) pos.x = nx; else if (typeof mx === 'number' && (onGround || swimming)) climbTo = mx; else vel.x = 0
      const nz = pos.z + vel.z * dt, mz = climbTo !== null ? false : moveTo(pos.x, nz)
      if (mz === true) pos.z = nz; else if (typeof mz === 'number' && (onGround || swimming)) climbTo = mz; else if (climbTo === null) vel.z = 0
      // Out at sea, a current turns you back towards the island.
      const OUT = 6
      pos.x = Math.max(-OUT, Math.min(data.grid + OUT, pos.x)); pos.z = Math.max(-OUT, Math.min(data.grid + OUT, pos.z))
      // Down: onto the ground, or into the water.
      const g = groundAt(pos.x, pos.z, pos.y)
      const wasOn = onGround && !swimming
      swimming = g < seaY - 0.32
      pos.y += vel.y * dt
      // Swimming, you float with your head out, riding the swell.
      const floor = swimming ? world.seaAt(pos.x, pos.z) - 0.36 : g
      const falling = vel.y
      // Walking down a slope (or off a kerb) your feet keep to the ground; off anything higher than a step you fall.
      if (pos.y <= floor || (wasOn && vel.y <= 0 && pos.y - floor < STEP * 0.6) || (swimming && vel.y <= 0 && pos.y - floor < 0.12)) { pos.y = floor; vel.y = 0; onGround = true } else onGround = swimming
      // In the water, and how deep; jumping or stepping in throws up spray.
      const surface = waterAt(pos.x, pos.z, g)
      const wet = surface !== null && pos.y < surface - 0.004
      if (wet && !inWater) {
        const hard = Math.min(1, Math.max(0, -falling) / 1.4)
        water.burst(pos.x, surface, pos.z, Math.round(6 + 60 * hard), 0.45 + hard * 0.9, [vel.x, vel.z])
        water.ring(pos.x, surface, pos.z, 1 + hard * 1.5, 1.6)
      }
      inWater = wet; waterDepth = wet ? surface - pos.y : 0
      // A stream carries you with it.
      const run = wet ? world.flowAt(pos.x, pos.z) : null
      if (run) {
        const cx = pos.x + run[0] * 0.14 * dt, cz = pos.z + run[1] * 0.14 * dt
        if (!blockedAt(cx, cz, pos.y)) { pos.x = cx; pos.z = cz }
      }
      // Moving through it, rings spread behind you and a little spray is kicked up; still, it only laps round you.
      if (wet && (rippleTick -= dt) <= 0) {
        const moving = Math.hypot(vel.x, vel.z) > 0.08
        rippleTick = moving ? (swimming ? 0.3 : 0.38) : 1.5
        water.ring(pos.x, surface, pos.z, moving ? 0.7 : 0.45, moving ? 1.3 : 2)
        if (moving) water.burst(pos.x + vel.x * 0.12, surface, pos.z + vel.z * 0.12, swimming ? 5 : 3, 0.32, [vel.x, vel.z])
      }
    }
    // The traffic: driven, and in your way only for as long as it takes to push you aside.
    traffic.step(dt)
    traffic.state().forEach((c, k) => {
      const m = carMeshes[k]; if (!m) return
      m.position.set(c.j, world.heightAt(c.j, c.i), c.i)
      m.rotation.y = Math.atan2(-c.hi, c.hj)
      const dx = pos.x - c.j, dz = pos.z - c.i, d = Math.hypot(dx, dz)
      if (d < 0.26 && pos.y < m.position.y + 0.25) { pos.x += (dx / (d || 1)) * (0.26 - d); pos.z += (dz / (d || 1)) * (0.26 - d) }
    })
    // You, walking: legs and arms swinging with your speed, turned the way you go.
    const sp = Math.hypot(vel.x, vel.z)
    if (sp > 0.05) me.rotation.y = MathUtils.lerp(me.rotation.y, Math.atan2(vel.x, vel.z) + (Math.abs(Math.atan2(vel.x, vel.z) - me.rotation.y) > Math.PI ? Math.sign(me.rotation.y) * Math.PI * 2 : 0), Math.min(1, dt * 10))
    stride += sp * dt * 22
    const swing = Math.sin(stride) * Math.min(1, sp * 2) * (swimming ? 0.3 : 0.7)
    legL.rotation.x = swing; legR.rotation.x = -swing; armL.rotation.x = -swing * 0.8; armR.rotation.x = swing * 0.8
    // Swimming: a crawl, arm over arm, the legs kicking.
    if (swimming) { stroke += dt * (2.5 + sp * 9); armL.rotation.x = -stroke; armR.rotation.x = -stroke - Math.PI; legL.rotation.x = Math.sin(stroke * 3) * 0.25; legR.rotation.x = -legL.rotation.x }
    water.update(dt)
    me.position.copy(pos)
    // The camera, behind and above, easing after you; never inside a wall of the ground.
    look.set(pos.x, pos.y + TALL * 0.8, pos.z)
    camPos.set(pos.x + Math.sin(yaw) * Math.cos(pitch) * dist, pos.y + TALL * 0.8 + Math.sin(pitch) * dist, pos.z + Math.cos(yaw) * Math.cos(pitch) * dist)
    // From the air: high over the island's middle, looking down at it the way the map does.
    if (aerial) { const c = data.grid / 2; look.set(c, 0, c); camPos.set(c + Math.sin(yaw) * 24, 26, c + Math.cos(yaw) * 24) }
    const under = world.heightAt(camPos.x, camPos.z) + 0.08
    if (camPos.y < under) camPos.y = under
    camera.position.lerp(camPos, Math.min(1, dt * (aerial ? 3 : 8)))
    camera.lookAt(look)
    // At night the lamps near you light the street.
    if (night && (lampTick -= dt) <= 0) {
      lampTick = 0.4
      const near6 = world.lamps.map((l) => [l.distanceToSquared(pos), l] as const).sort((a, b) => a[0] - b[0]).slice(0, lampLights.length)
      lampLights.forEach((L, k) => { const p = near6[k]; if (p) { L.position.copy(p[1]).y -= 0.03; L.intensity = 1.3 } else L.intensity = 0 })
    }
    if (!night && lampLights[0].intensity) for (const L of lampLights) L.intensity = 0
    // The sun's shadows follow you.
    // (Held to whole texels of the shadow map, so the edges of shadows do not crawl as you walk.)
    const texel = (2 * REACH) / SHADOW
    lightRight.crossVectors(UP, sunDir).normalize(); lightUp.crossVectors(sunDir, lightRight)
    const pr = Math.round(pos.dot(lightRight) / texel) * texel, pu = Math.round(pos.dot(lightUp) / texel) * texel, pa = pos.dot(sunDir)
    snapped.copy(lightRight).multiplyScalar(pr).addScaledVector(lightUp, pu).addScaledVector(sunDir, pa)
    sun.position.copy(snapped).addScaledVector(sunDir, 35); sun.target.position.copy(snapped)
    // A game's building near: it offers to take you in.
    let best: typeof near = null, bd = 0.45
    for (const b of data.buildings) {
      const gm = data.games[b.slug]; if (!gm) continue
      const cx = Math.max(b.j, Math.min(b.j + b.d, pos.x)), cz = Math.max(b.i, Math.min(b.i + b.w, pos.z))
      const d = Math.hypot(pos.x - cx, pos.z - cz)
      if (d < bd) { bd = d; best = { slug: b.slug, title: gm.title, href: gm.href } }
    }
    if (best?.slug !== near?.slug) { near = best; ui.onNear(best) }
    // The sun in the picture: where, and whether anything (the hill, a building) stands in front of it.
    if (!night && !aerial) {
      if ((sunTick -= dt) <= 0) { sunTick = 0.1; sunSeen = sunClear() ? 1 : 0 }
      sunAt.copy(camera.position).addScaledVector(sunDir, 100).project(camera)
      camera.getWorldDirection(sunLook)
      const facing = MathUtils.smoothstep(sunLook.dot(sunDir), 0.55, 0.9)
      sunVis += ((sunAt.z < 1 ? sunSeen * facing : 0) - sunVis) * Math.min(1, dt * 6)
    } else sunVis = 0
    post!.sun(sunAt.x * 0.5 + 0.5, sunAt.y * 0.5 + 0.5, sunVis)
    post!.render(dt)
  }
  raf = requestAnimationFrame(loop)

  return {
    setNight(on) { night = on; setSky() },
    setAerial(on) { aerial = on; (scene.fog as Fog).far = on ? 160 : 70 },
    near: () => near,
    goTo(x, z, view) {
      pos.set(x, world.heightAt(x, z), z); vel.set(0, 0, 0); climbTo = null
      if (view?.yaw !== undefined) yaw = view.yaw
      if (view?.pitch !== undefined) pitch = view.pitch
      if (view?.dist !== undefined) dist = view.dist
      camera.position.set(pos.x + Math.sin(yaw) * Math.cos(pitch) * dist, pos.y + TALL * 0.8 + Math.sin(pitch) * dist, pos.z + Math.cos(yaw) * Math.cos(pitch) * dist)
    },
    state: () => ({ x: pos.x, y: pos.y, z: pos.z, onGround, swimming, inWater, spray: water.drops(), cars: carMeshes.map((g) => [g.position.x, g.position.z]) }),
    dispose() {
      cancelAnimationFrame(raf)
      removeEventListener('resize', fit); removeEventListener('keydown', kd); removeEventListener('keyup', ku)
      removeEventListener('pointermove', pm); removeEventListener('pointerup', pu)
      envRT?.dispose(); pmrem.dispose(); post?.dispose(); renderer.dispose()
    },
  }
}
