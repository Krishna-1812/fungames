/**
 * The walk — you, on foot, on the island (build3d.ts), in third person.
 *
 * Moving is physical, at the island's own scale (body.ts: a metre is 0.11 of
 * a world unit, a tile about nine metres): you walk at 1.5 m/s and run at 5.5, gravity pulls you
 * down and a jump takes you a hand's height off the ground; the ground under
 * you is the island's own (terrain.ts), so you walk up a slope, a little
 * slower the steeper it is, and down it without leaving it, and a wall you
 * cannot walk up you may climb if it is no higher than your chest; buildings stop you at their walls (their
 * solids, as boxes), and you can stand on what is low enough to step onto (a
 * plinth, a pier); in water too deep to stand in you swim, slowly, your head
 * above it, rising and falling with the swell; water slows you as you wade,
 * a stream's current carries you along, and the water answers you: rings
 * spread from you and spray flies when you jump in. The island's traffic (traffic.ts, the same that drives the map)
 * drives its roads round you in real cars (cars.ts), and stops for you if you stand in its way.
 * Walk up to a game's building and it offers to take you in.
 *
 * Cars of your own stand parked by the road: get in (F) and drive one
 * (drive.ts) — throttle, brake and reverse, steering, the handbrake — with a
 * camera that follows behind; its headlights light the road after dark; get
 * out wherever you like and it stays where you left it.
 *
 * The day passes (daylight.ts): the sun goes over, it gets dark, the lamps
 * come on and the windows light, the moon and the stars come out. Keyboard and mouse, or a thumb on a phone.
 */
import {
  ACESFilmicToneMapping, Fog, Group, PCFShadowMap, PerspectiveCamera, PointLight, SpotLight,
  Scene, SRGBColorSpace, Vector3, WebGLRenderer, MathUtils,
} from 'three'
import { buildWorld, Y, type WorldData } from './build3d'
import { createTraffic } from '../island/traffic'
import { splashes } from './splash'
import { lens } from './lens'
import { daylight } from './daylight'
import { figure, METRE } from './body'
import { fleet, MODELS, parkingSpots, type ModelName, type Pose } from './cars'
import { vehicle, type Ground, type Vehicle } from './drive'
import { folk, type CarNear, type Folk } from './folk'
import { gulls } from './birds'
import { fishes } from './fish'
import { boats } from './boats'
import { WAVES } from './water'

export type Walk = { dispose(): void
  /** Jump to the night (half past nine) or to the morning (ten). */
  setNight(on: boolean): void
  /** The time of day, in hours (0–24), and whether it is passing. */
  setTime(hour: number): void; time(): number; setClock(on: boolean): void; clock(): boolean
  setAerial(on: boolean): void; near(): { slug: string; title: string; href: string } | null
  /** Get into the car you are next to, or out of the one you are driving; false if there is neither (or no room to get out). */
  toggleCar(): boolean
  /** Where you are and how (for the checks). */
  state(): { x: number; y: number; z: number; onGround: boolean; swimming: boolean; inWater: boolean; spray: number; quality: string; cars: number[][]; driving: boolean; speed: number; parked: number[][]; people: ReturnType<Folk['state']>; gulls: { x: number; y: number; z: number; mode: string; water: boolean }[]; fish: ReturnType<ReturnType<typeof fishes>['state']>; boats: ReturnType<ReturnType<typeof boats>['state']>; lifeMs: number }
  /** Set you down somewhere, looking a given way (for the checks, and for pictures). */
  goTo(x: number, z: number, view?: { yaw?: number; pitch?: number; dist?: number }): void
  /** Hold the camera at a point, looking at another (for the checks, and for pictures); null to let it follow you again. */
  look(eye: [number, number, number] | null, at?: [number, number, number]): void
  scene: Scene }

/** What the page shows about cars: one to get into near you, the one you drive (its speed in km/h, and its gear). */
export type CarInfo = { near: boolean; driving: boolean; kmh: number; gear: 'D' | 'R' | 'N'; flooded: boolean }

/*
 * Everything at the island's own scale (body.ts): a metre is 0.11 of a world unit. You are 1.75 m tall and
 * 25 cm round; a step up of 35 cm you just take; a wall up to 3 m you climb, as anyone fit can with a run at
 * it; out of the water you can haul yourself onto a quay 3.6 m above your feet.
 */
const TALL = 1.75 * METRE, RADIUS = 0.25 * METRE, STEP = 0.35 * METRE
const CLIMB = 3 * METRE, CLIMB_WET = 3.6 * METRE, CLIMB_SPEED = 2.6 * METRE
/** A walk is 1.5 m a second, a run 5.5, swimming 1.1. */
const WALK = 1.5 * METRE, RUN = 5.5 * METRE, SWIM = 1.1 * METRE
/** Gravity is the Earth's; a jump leaves the ground at 3 m a second (a 46 cm hop). */
const GRAVITY = 9.8 * METRE, JUMP = 3 * METRE
/** Water deeper than your chest you swim in, your hips just under the surface. */
const CHEST = 1.3 * METRE, AFLOAT = 1.05 * METRE
/** The traffic's own cars, and the paints they come in (and yours: a blue saloon, a red hatchback, a white SUV). */
const TRAFFIC: ModelName[] = ['hatch', 'saloon', 'suv']
const PAINTS = ['#8e1622', '#e8ebee', '#1c5c66', '#9ea6b0', '#1b2b4c', '#26292e', '#c9cdd3', '#36624c', '#5d6f86']
const YOURS: { model: ModelName; paint: string }[] = [{ model: 'saloon', paint: '#1f3f94' }, { model: 'hatch', paint: '#a3121f' }, { model: 'suv', paint: '#eef0f2' }]

export function startWalk(canvas: HTMLCanvasElement, data: WorldData, ui: { onNear(g: { title: string } | null): void; move?: () => [number, number]; onCar?(c: CarInfo): void }): Walk {
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
  const world = buildWorld(data, { phone: matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 600 })
  scene.add(world.root)
  // Asked for less motion: the sea lies flat (no swell rocking you, or the camera, as you swim).
  // (And the wind barely stirs the trees and the grass.)
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { world.swell.value = 0; world.flora.wind.value = 0.25 }

  /* ---- the day: sun, moon, stars, sky and air (daylight.ts) ---- */
  // Shadows soft-edged, cast across the thirteen tiles round you (more than you can make out the shadows past).
  const Q = new URLSearchParams(location.search)
  const SHADOW = Number(Q.get('shadow')) || (phone ? 2048 : 4096), REACH = 13
  const dl = daylight(scene, renderer, { shadowSize: SHADOW, reach: REACH, soft: Q.has('soft') ? Number(Q.get('soft')) : undefined })
  const sun = dl.light, sunDir = dl.state.lightDir
  // Light from the lamps nearest you (a handful of real lights, moved to whichever lamps are close).
  const lampLights = Array.from({ length: 6 }, () => { const l = new PointLight('#dfe8ff', 0, 2.2, 1.6); scene.add(l); return l })
  // Your car's headlights: a real light, thrown ahead down the road (always there, dark by day, so nothing has to be redrawn when it comes on).
  const beam = new SpotLight('#eef3ff', 0, 7, 0.52, 0.55, 1.3)
  scene.add(beam, beam.target)
  // The windows (facade.ts): a room behind each; those with someone home light one by one as it gets dark,
  // and go out one by one late at night.
  const homes = world.windows.homes
  let hour = Number(new URLSearchParams(location.search).get('t') ?? '16.5'), clockOn = true, aerial = false
  if (!Number.isFinite(hour)) hour = 16.5
  /** It is dark enough to count as night (for the traffic's lights). */
  const dark = () => dl.state.day < 0.5
  const applyTime = () => {
    dl.set(hour)
    homes.value = dl.state.homes
    world.windows.day.value = dl.state.day
    // The name boards are lit from behind after dark.
    world.boards.emissiveIntensity = 0.85 * (1 - dl.state.day)
    // The sun's light under the water is a bright net; the moon's, a faint one.
    world.caustics.value = Math.max(0.12, dl.state.day)
    post?.setDaylight(dl.state.day)
  }
  applyTime()

  /* ---- you (body.ts) ---- */
  const you = figure(), me = you.root
  scene.add(me)

  /* ---- where you can stand ---- */
  const seaY = Y(data.sea)
  /** A parked car at a point (or within pad of it): its footprint and the height of its roof. */
  let own: Vehicle[] = []
  let driving: number | null = null
  const carAt = (x: number, z: number, pad: number) => {
    for (let k = 0; k < own.length; k++) {
      if (k === driving) continue
      const b = own[k].box(), c = Math.cos(b.yaw), n = Math.sin(b.yaw), dx = x - b.x, dz = z - b.z
      if (Math.abs(dx * c - dz * n) < b.hl + pad && Math.abs(dx * n + dz * c) < b.hw + pad) return b
    }
    return null
  }
  /** The ground's height at a world point: the tile's top, or the top of something built low enough to stand on (a car's roof, too). */
  const groundAt = (x: number, z: number, from: number, reach = STEP) => {
    let g = world.heightAt(x, z)
    for (const b of world.boxes) if (x > b.j0 && x < b.j1 && z > b.i0 && z < b.i1 && b.z1 <= from + reach && b.z1 > g) g = b.z1
    const car = carAt(x, z, 0)
    if (car && car.top <= from + reach && car.top > g) g = car.top
    return g
  }
  /** Whether a wall stands at a point: ground or something built, higher than you can get up (by a step, or a climb). */
  const blockedAt = (x: number, z: number, y: number, reach = STEP) => {
    // A terrace wall or a cliff too tall.
    for (const [dx, dz] of [[RADIUS, 0], [-RADIUS, 0], [0, RADIUS], [0, -RADIUS]]) if (world.heightAt(x + dx, z + dz) > y + reach) return true
    // A wall: any box you would be inside that rises above what you can get up.
    for (const b of world.boxes) if (b.z1 > y + reach && b.z0 < y + TALL && x > b.j0 - RADIUS && x < b.j1 + RADIUS && z > b.i0 - RADIUS && z < b.i1 + RADIUS) return true
    // A parked car.
    const car = carAt(x, z, RADIUS)
    if (car && car.top > y + reach) return true
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
  let climbTo: number | null = null, climbFrom = 0, climbed: number | null = null
  /** The water's surface where you are (the sea with its swell, or the stream or the pond), if there is water there. */
  const waterAt = (x: number, z: number, ground: number) => world.poolAt(x, z) ?? (ground < seaY + 0.06 ? world.seaAt(x, z) : null)
  let inWater = false, waterDepth = 0, rippleTick = 0
  const water = splashes(scene)

  // Set down in the town square, facing into it.
  const start = data.road[Math.floor(data.road.length / 2)] ?? [15, 15]
  const pos = new Vector3(start[1] + 0.5, 0, start[0] + 0.5)
  pos.y = groundAt(pos.x, pos.z, 99)
  const vel = new Vector3()
  let yaw = Math.PI * 0.75, pitch = 0.32, dist = innerHeight > innerWidth ? 1.05 : 0.8, onGround = true, swimming = false

  /* ---- the traffic, and cars of your own ---- */
  /** Where the traffic must stop: the car you drive, and you if you are on foot in the road. */
  const obstacles: { i: number; j: number; r: number; w: number }[] = []
  const traffic = createTraffic({ roads: data.road, play: true, dark: () => (dark() ? 1 : 0), others: () => obstacles })
  const tStart = traffic.state()
  const kinds = tStart.map((c, k) => ({ model: (c.kind === 'bus' ? 'bus' : TRAFFIC[k % TRAFFIC.length]) as ModelName, paint: PAINTS[k % PAINTS.length] }))
  // Cars of your own, parked by the road (cars.ts): the first near the square, the others about the island.
  const spots = parkingSpots(world, data.road, pos, YOURS.length)
  const mine = spots.map((_, k) => YOURS[k])
  const cars = fleet(scene, [...kinds, ...mine])
  const NT = kinds.length
  const ground: Ground = {
    heightAt: world.heightAt, boxes: world.boxes, grid: data.grid,
    waterAt: (x, z, g) => waterAt(x, z, g),
    others: () => {
      const o = traffic.state().map((c, k) => { const S = MODELS[kinds[k].model]; return { x: c.j, z: c.i, yaw: Math.atan2(-c.hi, c.hj), hl: (S.len / 2) * METRE, hw: (S.wid / 2) * METRE } })
      own.forEach((v, k) => { if (k !== driving) { const b = v.box(); o.push({ x: b.x, z: b.z, yaw: b.yaw, hl: b.hl, hw: b.hw }) } })
      return o
    },
  }
  own = spots.map((s, k) => { const v = vehicle(MODELS[mine[k].model].spec, s.x, s.z, s.yaw); v.place(s.x, s.z, s.yaw, ground); return v })
  // (No grass growing up through a parked car.)
  world.flora.lawn.clear((x, z) => spots.some((s) => Math.abs(x - s.x) < (s.yaw ? 1.2 : 2.6) * METRE && Math.abs(z - s.z) < (s.yaw ? 2.6 : 1.2) * METRE))
  // Riding in a car: you sit at its wheel (on its left: the island drives on the right).
  const rig = new Group(); rig.matrixAutoUpdate = false; scene.add(rig)
  const tPrev: number[] = [], tSpin: number[] = [], tSteer: number[] = []
  let carDist = 1.25, lastDrag = -1e9, carTick = 0, splashTick = 0, wasDeep = false
  const pose: Pose = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, dive: 0, lean: 0, bob: 0, spin: 0, steer: 0, on: 1, head: 0, tail: 0, brake: 0, reverse: 0 }
  /** The seat (metres from the car's middle): the driver's hips. */
  const seatOf = (k: number) => { const S = MODELS[mine[k].model]; return { x: (S.screen[1] - 0.5) * S.len - 1.2, y: S.seat, z: -0.37 } }
  /** The car you could get into: near its driver's door, and not one you are driving. */
  const nearCar = () => {
    if (driving !== null || swimming || climbTo !== null) return null
    let best: number | null = null, bd = 0.36
    own.forEach((v, k) => { const d = Math.hypot(v.s.x - pos.x, v.s.z - pos.z); if (d < bd && Math.abs(pos.y - v.s.y) < 0.15) { bd = d; best = k } })
    return best
  }
  const getIn = (k: number) => {
    driving = k; vel.set(0, 0, 0); climbTo = null
    const st = seatOf(k)
    rig.add(me); me.position.set(st.x * METRE, (st.y - 0.93) * METRE, st.z * METRE); me.rotation.set(0, Math.PI / 2, 0)
    // The camera swings round behind the car.
    const v = own[k]; yaw = Math.atan2(-Math.cos(v.s.yaw), Math.sin(v.s.yaw)); pitch = 0.2; lastDrag = -1e9
  }
  const getOut = () => {
    if (driving === null) return false
    const v = own[driving], S = MODELS[mine[driving].model], st = seatOf(driving)
    if (v.speed() > 2.5) return false
    // Out of the driver's door if there is room; if not, across and out of the other one.
    for (const sd of [-1, 1]) {
      const [x, z] = v.toWorld(st.x, sd * (S.wid / 2 + 0.45))
      const k: number = driving
      driving = null // (so the car itself counts as in the way)
      const g = groundAt(x, z, v.s.y + 0.4 * METRE)
      if (!blockedAt(x, z, g) && Math.abs(g - v.s.y) < 0.6 * METRE) {
        scene.add(me); me.position.set(x, g, z); me.rotation.set(0, v.s.yaw + (sd < 0 ? Math.PI : 0), 0)
        pos.set(x, g, z); vel.set(0, 0, 0); onGround = true; swimming = false
        v.s.u = v.s.vl = v.s.r = 0
        return true
      }
      driving = k
    }
    return false
  }

  /* ---- the island's people, on its pavements (folk.ts) ---- */
  // (?nolife: none of them; ?off=people,boats,fish,gulls: some — to measure what each costs.)
  const off = new Set(Q.has('nolife') ? ['people', 'boats', 'fish', 'gulls'] : (Q.get('off') ?? '').split(','))
  const people = folk(scene, { roads: data.road, heightAt: world.heightAt, boxes: world.boxes, count: phone ? 26 : 40 })
  const nearCars: CarNear[] = []
  let lifeMs = 0
  // The gulls: circling over the harbour, the west bay and off the north shore, and standing about by the sea (birds.ts).
  const birds = gulls(scene, { seaY, grid: data.grid, heightAt: world.heightAt, seaAt: world.seaAt, depthAt: world.depthAt, kind: world.kind, boxes: world.boxes, lamps: world.lamps, piers: data.piers, rocks: data.seaRocks, rings: [[24, 23], [13, 4], [3, 23]], count: phone ? 12 : 18 })

  // Fish in the shallows, and now and then one leaping (fish.ts).
  const shoals = fishes(scene, { seaY, grid: data.grid, depthAt: world.depthAt, seaAt: world.seaAt, splash: (x, y, z, n, p) => water.burst(x, y, z, n, p, [0, 0]), ring: (x, y, z, r) => water.ring(x, y, z, r, 1.4), schools: phone ? 5 : 8 })
  // Boats: tied up at the piers, at anchor, the ferry on its timetable, a speedboat, two yachts (boats.ts).
  const harbour = boats(scene, { seaAt: world.seaAt, piers: data.piers, wind: [WAVES[0].x, WAVES[0].z], splash: (x, y, z, n, p) => water.burst(x, y, z, n, p, [0, 0]) })

  if (off.has('fish')) shoals.mesh.visible = false
  if (off.has('boats')) harbour.show(false)

  /* ---- the camera ---- */
  const camera = new PerspectiveCamera(55, 1, 0.012, 500)
  /** The picture's sharpness: the screen's own pixels (up to two to a point), less if the machine needs it. */
  let sharp = 1
  const fit = () => {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight
    const pr = Math.max(0.75, Math.min(devicePixelRatio, 2) * sharp)
    renderer.setPixelRatio(pr); renderer.setSize(w, h, false)
    post?.setSize(w, h, pr)
    camera.aspect = w / h; camera.updateProjectionMatrix()
  }
  post = lens(renderer, scene, camera, { phone, still, ao: !Q.has('noao'), samples: Q.has('msaa') ? Number(Q.get('msaa')) : undefined, bloom: !Q.has('nobloom') })
  post.setDaylight(dl.state.day)
  fit()
  addEventListener('resize', fit)

  /* ---- input ---- */
  const keys = new Set<string>()
  const kd = (e: KeyboardEvent) => { keys.add(e.code); if (e.code === 'Space' || (driving !== null && e.code.startsWith('Arrow'))) e.preventDefault() }
  const ku = (e: KeyboardEvent) => keys.delete(e.code)
  addEventListener('keydown', kd); addEventListener('keyup', ku)
  let dragging = false, lx = 0, ly = 0
  const pd = (e: PointerEvent) => { if ((e.target as HTMLElement) !== canvas) return; dragging = true; lx = e.clientX; ly = e.clientY; canvas.setPointerCapture(e.pointerId) }
  const pm = (e: PointerEvent) => { if (!dragging) return; yaw -= (e.clientX - lx) * 0.006; pitch = MathUtils.clamp(pitch + (e.clientY - ly) * 0.004, 0.05, 1.2); lx = e.clientX; ly = e.clientY; lastDrag = performance.now() }
  const pu = () => { dragging = false }
  const wh = (e: WheelEvent) => { if (driving !== null) carDist = MathUtils.clamp(carDist * (1 + e.deltaY * 0.001), 0.5, 3); else dist = MathUtils.clamp(dist * (1 + e.deltaY * 0.001), 0.3, 3); e.preventDefault() }
  canvas.addEventListener('pointerdown', pd); addEventListener('pointermove', pm); addEventListener('pointerup', pu); canvas.addEventListener('wheel', wh, { passive: false })

  /* ---- each frame ---- */
  const born = performance.now()
  let frames = 0, spent = 0, lastFrame = born, quality = 'full', slow = 0
  let raf = 0, last = performance.now(), near: { slug: string; title: string; href: string } | null = null
  let shownCar: string | null = null
  const camPos = new Vector3(), look = new Vector3()
  let held: [Vector3, Vector3] | null = null
  let sunTick = 0, sunSeen = 0, sunVis = 0
  const sunAt = new Vector3(), sunLook = new Vector3(), ray = new Vector3()
  /** Whether a line from the camera towards the sun gets clear of the ground and everything built. */
  const sunClear = () => {
    for (let t = 0.15; t < 18; t += 0.3) {
      ray.copy(camera.position).addScaledVector(dl.state.sunDir, t)
      if (ray.y < world.heightAt(ray.x, ray.z)) return false
      for (const b of world.boxes) if (ray.y < b.z1 && ray.y > b.z0 && ray.x > b.j0 && ray.x < b.j1 && ray.z > b.i0 && ray.z < b.i1) return false
      if (ray.y > 3) return true
    }
    return true
  }
  const UP = new Vector3(0, 1, 0), lightRight = new Vector3(), lightUp = new Vector3(), snapped = new Vector3()
  let lampTick = 0, grassTick = 0
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop)
    const dt = Math.min(0.05, (now - last) / 1000); last = now
    world.time.value = now / 1000
    // Which way you want to go, turned to the camera.
    let fx = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0)
    let fz = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0)
    const stick = ui.move?.() ?? [0, 0]
    if (stick[0] || stick[1]) { fx = stick[0]; fz = -stick[1] }
    const glow = dl.state.lampGlow
    if (driving !== null) {
      // Driving: the keys are the pedals and the wheel.
      const v = own[driving]
      v.step(dt, { throttle: fz, steer: fx, handbrake: keys.has('Space') }, ground)
      pos.set(v.s.x, v.s.y, v.s.z); vel.set(0, 0, 0); onGround = true; swimming = false; inWater = false
      // Into the water: a wave thrown up as it goes in, spray off the wheels as it ploughs on.
      const deep = v.s.depth > 0.15, surf = waterAt(v.s.x, v.s.z, v.s.y)
      if (deep && surf !== null) {
        const sp = v.speed()
        if (!wasDeep) { water.burst(v.s.x, surf, v.s.z, Math.round(20 + 50 * Math.min(1, sp / 8)), 0.7 + Math.min(1, sp / 8), [0, 0]); water.ring(v.s.x, surf, v.s.z, 2.5, 1.8) }
        if ((splashTick -= dt) <= 0 && sp > 0.8) {
          splashTick = 0.12
          for (const sd of [-1, 1]) { const [x, z] = v.toWorld(v.spec.front, sd * v.spec.wid * 0.55); water.burst(x, surf, z, 3 + Math.round(sp), 0.3 + sp * 0.06, [0, 0]) }
          water.ring(v.s.x, surf, v.s.z, 1.4, 1.4)
        }
      }
      wasDeep = deep
    } else {
      const mag = Math.min(1, Math.hypot(fx, fz))
      const speed0 = swimming ? SWIM : keys.has('ShiftLeft') || keys.has('ShiftRight') || mag > 0.95 && stick[0] + stick[1] !== 0 ? RUN : WALK
      const sx = Math.sin(yaw), cz = Math.cos(yaw)
      // Uphill is harder going: slower the steeper it is the way you are heading (and a touch quicker down).
      const hx = -fz * sx + fx * cz, hz = -fz * cz - fx * sx, hl = Math.hypot(hx, hz) || 1
      const rise = onGround && !swimming ? (world.heightAt(pos.x + (hx / hl) * 0.08, pos.z + (hz / hl) * 0.08) - world.heightAt(pos.x, pos.z)) / 0.08 : 0
      // Wading, the water holds you back: the deeper, the harder (up to your chest, about half your pace).
      const wade = !swimming && inWater ? 1 - 0.5 * Math.min(1, waterDepth / CHEST) : 1
      const speed = speed0 * Math.max(0.55, Math.min(1.12, 1 - rise * 0.9)) * wade
      const wantX = (-fz * sx + fx * cz) * speed * mag / (mag || 1), wantZ = (-fz * cz - fx * sx) * speed * mag / (mag || 1)
      // Your feet take a moment to get going and to stop (more on the ground than in the air or the water).
      const grip = onGround ? 10 : swimming ? 3 : 1.5
      vel.x += (wantX - vel.x) * Math.min(1, grip * dt); vel.z += (wantZ - vel.z) * Math.min(1, grip * dt)
      if (climbTo !== null) {
        // Pulling yourself up a ledge: up first, then on over it.
        pos.y = Math.min(climbTo + 0.002, pos.y + CLIMB_SPEED * dt); vel.y = 0
        if (pos.y >= climbTo) { climbTo = null; onGround = true; swimming = false }
        climbed = climbTo === null ? null : Math.min(1, (pos.y - climbFrom) / Math.max(1e-4, climbTo - climbFrom))
      } else {
        if (onGround && !swimming && keys.has('Space')) { vel.y = JUMP; onGround = false }
        vel.y -= GRAVITY * dt
        // Across, then along: each blocked on its own, so you slide along a wall; a
        // ledge no higher than your chest (from the water, a quay or a beach) you climb.
        const nx = pos.x + vel.x * dt, mx = moveTo(nx, pos.z)
        if (mx === true) pos.x = nx; else if (typeof mx === 'number' && (onGround || swimming)) { climbTo = mx; climbFrom = pos.y } else vel.x = 0
        const nz = pos.z + vel.z * dt, mz = climbTo !== null ? false : moveTo(pos.x, nz)
        if (mz === true) pos.z = nz; else if (typeof mz === 'number' && (onGround || swimming)) { climbTo = mz; climbFrom = pos.y } else if (climbTo === null) vel.z = 0
        // Out at sea, a current turns you back towards the island.
        const OUT = 6
        pos.x = Math.max(-OUT, Math.min(data.grid + OUT, pos.x)); pos.z = Math.max(-OUT, Math.min(data.grid + OUT, pos.z))
        // Down: onto the ground, or into the water.
        const g = groundAt(pos.x, pos.z, pos.y)
        const wasOn = onGround && !swimming
        swimming = g < seaY - CHEST
        pos.y += vel.y * dt
        // Swimming, you float with your head out, riding the swell.
        const floor = swimming ? world.seaAt(pos.x, pos.z) - AFLOAT : g
        const falling = vel.y
        // Walking down a slope (or off a kerb) your feet keep to the ground; off anything higher than a step you fall.
        if (pos.y <= floor || (wasOn && vel.y <= 0 && pos.y - floor < STEP * 0.6) || (swimming && vel.y <= 0 && pos.y - floor < 0.05)) { pos.y = floor; vel.y = 0; onGround = true } else onGround = swimming
        // In the water, and how deep; jumping or stepping in throws up spray.
        const surface = waterAt(pos.x, pos.z, g)
        const wet = surface !== null && pos.y < surface - 0.004
        if (wet && !inWater) {
          const hard = Math.min(1, Math.max(0, -falling) / 1.4)
          water.burst(pos.x, surface, pos.z, Math.round(6 + 60 * hard), 0.45 + hard * 0.9, [vel.x, vel.z])
          water.ring(pos.x, surface, pos.z, 1 + hard * 1.5, 1.6)
        }
        inWater = wet; waterDepth = wet ? surface - pos.y : 0
        // Someone in the way: you are held back out of them.
        const bump = people.push(pos.x, pos.z, pos.y, RADIUS)
        if (bump && !blockedAt(pos.x + bump[0], pos.z + bump[1], pos.y)) { pos.x += bump[0]; pos.z += bump[1] }
        // A boat's hull, swimming into it.
        const hulled = inWater || swimming ? harbour.push(pos.x, pos.z, pos.y, RADIUS) : null
        if (hulled) { pos.x += hulled[0]; pos.z += hulled[1] }
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
    }
    // The traffic stops for the car you drive, and for you in the road.
    obstacles.length = 0
    if (driving !== null) { const b = own[driving].box(); obstacles.push({ i: b.z, j: b.x, r: b.hl, w: b.hw }) } else obstacles.push({ i: pos.z, j: pos.x, r: 0.03, w: 0.03 })
    obstacles.push(...people.crossing())
    traffic.step(dt)
    const ts = traffic.state()
    ts.forEach((c, k) => {
      const S = MODELS[kinds[k].model], heading = Math.atan2(-c.hi, c.hj)
      let turn = heading - (tPrev[k] ?? heading); turn = Math.atan2(Math.sin(turn), Math.cos(turn)); tPrev[k] = heading
      const ms = c.v / METRE, rate = dt > 0 ? turn / dt : 0
      tSpin[k] = (tSpin[k] ?? 0) + (ms * dt) / S.wheel
      // The front wheels turned as much as the curve it is on needs.
      tSteer[k] = MathUtils.lerp(tSteer[k] ?? 0, ms > 0.4 ? Math.atan((rate * (S.front - S.rear)) / ms) : tSteer[k] ?? 0, Math.min(1, dt * 6))
      const cs = Math.cos(heading), sn = Math.sin(heading)
      const hf = world.heightAt(c.j + cs * S.front * METRE, c.i - sn * S.front * METRE), hr = world.heightAt(c.j + cs * S.rear * METRE, c.i - sn * S.rear * METRE)
      const braking = (c.acc ?? 0) < -0.35 || c.v < 0.04
      Object.assign(pose, {
        x: c.j, y: (hf + hr) / 2, z: c.i, yaw: heading, pitch: Math.atan2(hf - hr, (S.front - S.rear) * METRE), roll: 0,
        dive: MathUtils.clamp(((c.acc ?? 0) / METRE) * 0.0075, -0.05, 0.04), lean: MathUtils.clamp(ms * rate * 0.0085, -0.06, 0.06), bob: 0,
        spin: tSpin[k], steer: tSteer[k], on: 1, head: glow, tail: glow, brake: braking ? 1 : 0, reverse: 0,
      })
      cars.set(k, pose, Math.hypot(c.j - camera.position.x, c.i - camera.position.z) < 2.8)
      // In your way only for as long as it takes to push you aside (it stops for you; this is if you step out in front).
      if (driving === null) {
        const dx = pos.x - c.j, dz = pos.z - c.i, d = Math.hypot(dx, dz)
        if (d < 0.22 && pos.y < pose.y + 0.15) { pos.x += (dx / (d || 1)) * (0.22 - d); pos.z += (dz / (d || 1)) * (0.22 - d) }
      }
    })
    // Your cars: the one you drive, and those standing where they were left.
    own.forEach((v, k) => {
      const s = v.s, on = k === driving
      Object.assign(pose, {
        x: s.x, y: s.y, z: s.z, yaw: s.yaw, pitch: s.pitch, roll: s.roll, dive: s.dive, lean: s.lean, bob: 0, spin: s.spin, steer: s.steer,
        on: on ? 1 : 0, head: on ? glow : 0, tail: on ? glow : 0, brake: on && s.braking ? 1 : 0, reverse: on && s.reversing ? 1 : 0,
      })
      cars.set(NT + k, pose, Math.hypot(s.x - camera.position.x, s.z - camera.position.z) < 2.8)
    })
    cars.done()
    // The people on the pavements: they look out for the traffic (and your car), and step round you.
    nearCars.length = 0
    ts.forEach((c, k) => { const S = MODELS[kinds[k].model]; nearCars.push({ x: c.j, z: c.i, hx: c.hj, hz: c.hi, v: c.v, hl: (S.len / 2) * METRE, hw: (S.wid / 2) * METRE, yaw: Math.atan2(-c.hi, c.hj) }) })
    if (driving !== null) { const v = own[driving], b = v.box(); nearCars.push({ x: b.x, z: b.z, hx: Math.cos(b.yaw) * Math.sign(v.s.u || 1), hz: -Math.sin(b.yaw) * Math.sign(v.s.u || 1), v: Math.abs(v.s.u) * METRE, hl: b.hl, hw: b.hw, yaw: b.yaw }) }
    {
      const t0 = performance.now()
      if (!off.has('people')) people.update(dt, { cam: camera.position, you: driving === null ? pos : null, cars: nearCars, day: dl.state.day })
      if (!off.has('boats')) harbour.update(dt, { time: now / 1000, glow, cam: camera.position })
      if (!off.has('fish')) shoals.update(dt, { cam: camera.position, you: pos, inWater: inWater || swimming, time: now / 1000 })
      if (!off.has('gulls')) birds.update(dt, { cam: camera.position, you: pos, driving: driving !== null, day: dl.state.day, time: now / 1000, still })
      lifeMs += (performance.now() - t0 - lifeMs) * 0.05
    }
    // You, at the wheel or on foot.
    if (driving !== null) {
      rig.matrix.copy(cars.body(NT + driving)); rig.matrixWorldNeedsUpdate = true
      you.update(dt, { speed: 0, running: false, ground: false, swimming: false, wade: 0, climb: null, vy: 0, seated: -own[driving].s.steer / own[driving].spec.lock })
    } else {
      // You, walking: legs and arms swinging with your speed, turned the way you go.
      const sp = Math.hypot(vel.x, vel.z)
      if (sp > 0.05) me.rotation.y = MathUtils.lerp(me.rotation.y, Math.atan2(vel.x, vel.z) + (Math.abs(Math.atan2(vel.x, vel.z) - me.rotation.y) > Math.PI ? Math.sign(me.rotation.y) * Math.PI * 2 : 0), Math.min(1, dt * 10))
      you.update(dt, { speed: sp, running: sp > WALK * 1.4, ground: onGround && !swimming && climbTo === null, swimming, wade: inWater && !swimming ? Math.min(1, waterDepth / CHEST) : 0, climb: climbed, vy: vel.y })
      me.position.copy(pos)
    }
    water.update(dt)
    // Your headlights: on after dark while you drive, thrown down the road ahead.
    if (driving !== null && glow > 0.02) {
      const v = own[driving], S = MODELS[mine[driving].model]
      const [bx, bz] = v.toWorld(S.len / 2 - 0.2, 0), [tx, tz] = v.toWorld(S.len / 2 + 14, 0)
      beam.position.set(bx, v.s.y + 0.75 * METRE, bz); beam.target.position.set(tx, v.s.y - 1.2 * METRE, tz); beam.target.updateMatrixWorld()
      beam.intensity = 5.5 * glow
    } else beam.intensity = 0
    // The camera, behind and above, easing after you; never inside a wall of the ground.
    if (driving !== null) {
      const v = own[driving]
      look.set(pos.x, pos.y + 1.25 * METRE, pos.z)
      // Behind the car, unless you have just looked round: it swings back once you let go.
      if (!dragging && now - lastDrag > 1400 && v.speed() > 0.8) {
        const behind = Math.atan2(-Math.cos(v.s.yaw), Math.sin(v.s.yaw))
        let dy = behind - yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy))
        yaw += dy * Math.min(1, dt * 2.6)
        pitch += (0.2 - pitch) * Math.min(1, dt * 1.5)
      }
      camPos.set(pos.x + Math.sin(yaw) * Math.cos(pitch) * carDist, look.y + Math.sin(pitch) * carDist, pos.z + Math.cos(yaw) * Math.cos(pitch) * carDist)
    } else {
      look.set(pos.x, pos.y + TALL * 0.85, pos.z)
      camPos.set(pos.x + Math.sin(yaw) * Math.cos(pitch) * dist, pos.y + TALL * 0.85 + Math.sin(pitch) * dist, pos.z + Math.cos(yaw) * Math.cos(pitch) * dist)
    }
    // ...and never behind a wall: drawn in to just short of whatever stands between it and you.
    if (!aerial) {
      const dir = camPos.clone().sub(look), len = dir.length(); dir.divideScalar(len)
      let t = len
      for (const b of world.boxes) {
        if (b.z1 - b.z0 < 0.04 || b.j1 - b.j0 < 0.03 || b.i1 - b.i0 < 0.03) continue
        const tx0 = (b.j0 - look.x) / dir.x, tx1 = (b.j1 - look.x) / dir.x, ty0 = (b.z0 - look.y) / dir.y, ty1 = (b.z1 - look.y) / dir.y, tz0 = (b.i0 - look.z) / dir.z, tz1 = (b.i1 - look.z) / dir.z
        const tin = Math.max(Math.min(tx0, tx1), Math.min(ty0, ty1), Math.min(tz0, tz1)), tout = Math.min(Math.max(tx0, tx1), Math.max(ty0, ty1), Math.max(tz0, tz1))
        if (tin < tout && tout > 0 && tin > 0.02 && tin < t) t = tin
      }
      if (t < len) camPos.copy(look).addScaledVector(dir, Math.max(0.06, t - 0.03))
    }
    // From the air: high over the island's middle, looking down at it the way the map does.
    if (aerial) { const c = data.grid / 2; look.set(c, 0, c); camPos.set(c + Math.sin(yaw) * 24, 26, c + Math.cos(yaw) * 24) }
    const under = world.heightAt(camPos.x, camPos.z) + 0.03
    if (camPos.y < under) camPos.y = under
    camera.position.lerp(camPos, Math.min(1, dt * (aerial ? 3 : driving !== null ? 10 : 8)))
    camera.lookAt(look)
    if (held) { camera.position.copy(held[0]); camera.lookAt(held[1]) }
    // The day goes on: an hour of it a minute.
    if (clockOn) { hour = (hour + dt / 60) % 24; applyTime() }
    dl.follow(camera.position, dt)
    // The grass near you is drawn; further off, the ground's own green does.
    if ((grassTick -= dt) <= 0) { grassTick = 0.25; world.flora.lawn.near(camera.position.x, camera.position.z) }
    world.bulbs.emissiveIntensity = 2.2 * dl.state.lampGlow
    // After dark the lamps near you light the street.
    if (dl.state.lampGlow > 0.02 && (lampTick -= dt) <= 0) {
      lampTick = 0.4
      const near6 = world.lamps.map((l) => [l.distanceToSquared(pos), l] as const).sort((a, b) => a[0] - b[0]).slice(0, lampLights.length)
      lampLights.forEach((L, k) => { const p = near6[k]; if (p) { L.position.copy(p[1]).y -= 0.03; L.intensity = 1.3 * dl.state.lampGlow } else L.intensity = 0 })
    }
    if (dl.state.lampGlow <= 0.02 && lampLights[0].intensity) for (const L of lampLights) L.intensity = 0
    // The sun's shadows follow you.
    // (Held to whole texels of the shadow map, so the edges of shadows do not crawl as you walk.)
    const texel = (2 * REACH) / SHADOW
    lightRight.crossVectors(UP, sunDir).normalize(); lightUp.crossVectors(sunDir, lightRight)
    const pr = Math.round(pos.dot(lightRight) / texel) * texel, pu = Math.round(pos.dot(lightUp) / texel) * texel, pa = pos.dot(sunDir)
    snapped.copy(lightRight).multiplyScalar(pr).addScaledVector(lightUp, pu).addScaledVector(sunDir, pa)
    sun.position.copy(snapped).addScaledVector(sunDir, 35); sun.target.position.copy(snapped)
    // A game's building near: it offers to take you in (not while you drive).
    let best: typeof near = null, bd = 0.45
    if (driving === null) for (const b of data.buildings) {
      const gm = data.games[b.slug]; if (!gm) continue
      const cx = Math.max(b.j, Math.min(b.j + b.d, pos.x)), cz = Math.max(b.i, Math.min(b.i + b.w, pos.z))
      const d = Math.hypot(pos.x - cx, pos.z - cz)
      if (d < bd) { bd = d; best = { slug: b.slug, title: gm.title, href: gm.href } }
    }
    if (best?.slug !== near?.slug) { near = best; ui.onNear(best) }
    // A car to get into, or the one you drive: what the page shows of it.
    if ((carTick -= dt) <= 0) {
      carTick = 0.1
      const v = driving !== null ? own[driving] : null
      const info: CarInfo = { near: nearCar() !== null, driving: !!v, kmh: v ? Math.round(Math.abs(v.s.u) * 3.6) : 0, gear: v ? (v.s.u < -0.2 ? 'R' : Math.abs(v.s.u) < 0.2 ? 'N' : 'D') : 'N', flooded: !!v?.s.flooded }
      const key = JSON.stringify(info)
      if (key !== shownCar) { shownCar = key; ui.onCar?.(info) }
    }
    // The sun in the picture: where, and whether anything (the hill, a building) stands in front of it.
    if (dl.state.sunEl > -1 && !aerial) {
      if ((sunTick -= dt) <= 0) { sunTick = 0.1; sunSeen = sunClear() ? 1 : 0 }
      sunAt.copy(camera.position).addScaledVector(dl.state.sunDir, 100).project(camera)
      camera.getWorldDirection(sunLook)
      // (A low sun, through more air, glares less.)
      const facing = MathUtils.smoothstep(sunLook.dot(dl.state.sunDir), 0.55, 0.9) * MathUtils.smoothstep(dl.state.sunEl, -1, 3) * (0.4 + 0.6 * MathUtils.smoothstep(dl.state.sunEl, 3, 25))
      sunVis += ((sunAt.z < 1 ? sunSeen * facing : 0) - sunVis) * Math.min(1, dt * 6)
    } else sunVis = 0
    post!.sun(sunAt.x * 0.5 + 0.5, sunAt.y * 0.5 + 0.5, sunVis)
    post!.render(dt)
    // Keeping up: once it has settled, if six seconds go by at under 45 frames a second, give up the costliest
    // thing left — the occlusion, then the finer shadows, then a little sharpness (never more than a quarter).
    if (!Q.has('fixed')) {
      // (A pause — another tab, a dragged window — is not a slow frame.)
      const gap = now - lastFrame
      if (gap < 250) { frames++; spent += gap }
      if (now - born > 9000 && spent > 3000) {
        const fps = (frames * 1000) / spent
        // (Two slow stretches running, not a hitch while something new is first drawn.)
        slow = fps < 45 ? slow + 1 : 0
        if (slow >= 2) {
          slow = 0
          if (post!.drop()) quality = 'no occlusion'
          else if (sun.shadow.mapSize.x > 2048) { sun.shadow.mapSize.setScalar(sun.shadow.mapSize.x / 2); sun.shadow.map?.dispose(); sun.shadow.map = null; quality = `shadows ${sun.shadow.mapSize.x}` }
          else if (world.flora.lawn.reach.value > 6) { world.flora.lawn.reach.value = 6; quality = 'less grass' }
          else if (sharp > 0.75) { sharp = Math.max(0.75, sharp - 0.125); fit(); quality = `sharpness ${sharp.toFixed(2)}` }
        }
        frames = 0; spent = 0
      }
    }
    lastFrame = now
  }
  raf = requestAnimationFrame(loop)

  return {
    setNight(on) { hour = on ? 21.5 : 10; applyTime() },
    setTime(h) { hour = ((h % 24) + 24) % 24; applyTime() },
    time: () => hour,
    setClock(on) { clockOn = on },
    clock: () => clockOn,
    setAerial(on) { aerial = on; (scene.fog as Fog).far = on ? 160 : 70 },
    near: () => near,
    toggleCar() {
      if (driving !== null) return getOut()
      const k = nearCar()
      if (k === null) return false
      getIn(k); return true
    },
    look(eye, at) { held = eye && at ? [new Vector3(...eye), new Vector3(...at)] : null },
    goTo(x, z, view) {
      // (Out of any car first, wherever it is.)
      if (driving !== null) { const v = own[driving]; v.s.u = v.s.vl = v.s.r = 0; driving = null; scene.add(me); me.rotation.set(0, 0, 0) }
      pos.set(x, world.heightAt(x, z), z); vel.set(0, 0, 0); climbTo = null
      if (view?.yaw !== undefined) yaw = view.yaw
      if (view?.pitch !== undefined) pitch = view.pitch
      if (view?.dist !== undefined) dist = view.dist
      camera.position.set(pos.x + Math.sin(yaw) * Math.cos(pitch) * dist, pos.y + TALL * 0.8 + Math.sin(pitch) * dist, pos.z + Math.cos(yaw) * Math.cos(pitch) * dist)
    },
    state: () => ({
      x: pos.x, y: pos.y, z: pos.z, onGround, swimming, inWater, spray: water.drops(), quality,
      cars: traffic.state().map((c) => [c.j, c.i]), driving: driving !== null, speed: driving !== null ? own[driving].speed() : 0,
      parked: own.map((v) => [v.s.x, v.s.z, v.s.yaw]), people: people.state(), gulls: birds.state(), fish: shoals.state(), boats: harbour.state(), lifeMs,
    }),
    /** (For the checks: the scene itself.) */
    scene,
    dispose() {
      cancelAnimationFrame(raf)
      removeEventListener('resize', fit); removeEventListener('keydown', kd); removeEventListener('keyup', ku)
      removeEventListener('pointermove', pm); removeEventListener('pointerup', pu)
      dl.dispose(); post?.dispose(); renderer.dispose()
    },
  }
}
