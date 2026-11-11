/**
 * What happens on the layout.
 *
 * `set` stands a problem's cast on the track; `act` takes the decision and
 * runs it: the lever goes over on a spring, the tram pulls away, takes the
 * points, and arrives. From the moment it touches anything the outcome is
 * the solver's: who is thrown where is not written down anywhere.
 *
 * The tram itself is driven along its route by distance, with a speed that
 * follows a simple rule (pull away, cruise, brake), and its body rides on
 * three springs so that braking, cornering and rail joints all show.
 */
import {
  AdditiveBlending, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, NormalBlending, Object3D, PointLight,
  Quaternion, SphereGeometry, Sprite, SpriteMaterial, Vector3, CylinderGeometry,
} from 'three'
import type { Scene } from 'three'
import type { Scene as Problem, Token } from '../../data/dilemmas'
import type { Cast, Piece } from './cast'
import { makeBody, spring, step, STEP } from './physics'
import type { Body, Driver, World } from './physics'
import { merge, part, puffTexture, rng } from './kit'
import { TRACK, at, distAtX, route, sideZ } from './track'
import type { Route } from './track'
import { TRAM } from './tram'
import type { Tram } from './tram'

export type Sound = 'bell' | 'lever' | 'clack' | 'strike' | 'land' | 'brake' | 'thump' | 'push'
export type Tag = { text: string; at: Vector3; el?: HTMLElement; gone?: boolean; follow?: Object3D }

type Actor = Piece & { body: Body; side: 'main' | 'branch' | 'deck' }

const CRUISE = 8.4, PULL = 2.7

export function createPlay(o: {
  scene: Scene
  cast: Cast
  tram: Tram
  ground: (x: number, z: number) => number
  animate: boolean
  sound: (s: Sound, strength: number) => void
  onTags: (tags: Tag[]) => void
  setPoints: (t: number) => void
}) {
  const { scene, cast, tram } = o
  const props = new Group()
  scene.add(props)
  let actors: Actor[] = []
  let tags: Tag[] = []
  let problem: Problem | null = null
  let lever: ReturnType<Cast['lever']> | null = null
  let crate: ReturnType<Cast['crate']> | null = null

  /* ---- lamps that stand there all day and come on at dusk ---- */
  const lampGeo = merge([
    part(new CylinderGeometry(0.05, 0.08, 4.4, 8), 0x2d3532, [0, 2.2, 0]),
    part(new CylinderGeometry(0.03, 0.03, 0.9, 6), 0x2d3532, [0, 4.35, -0.4], [Math.PI / 2, 0, 0]),
    part(new CylinderGeometry(0.2, 0.09, 0.16, 10), 0x2d3532, [0, 4.3, -0.8]),
  ])
  const lampMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.4 })
  const bulbMat = new MeshBasicMaterial({ color: 0x222222 })
  const bulbGeo = new SphereGeometry(0.1, 10, 8)
  const puff = puffTexture()
  const haloMat = new SpriteMaterial({ map: puff, color: 0xffdca6, blending: AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 })
  const lamps: PointLight[] = []
  for (const [x, z, turn] of [[TRACK.STAND + 5.5, 3.6, 0], [TRACK.STAND + 2.5, TRACK.SIDE - 3.4, Math.PI]] as const) {
    const post = new Mesh(lampGeo, lampMat)
    post.position.set(x, 0, z); post.rotation.y = turn
    post.castShadow = true
    const bulb = new Mesh(bulbGeo, bulbMat)
    bulb.position.set(0, 4.2, -0.8)
    const halo = new Sprite(haloMat)
    halo.position.copy(bulb.position); halo.scale.setScalar(2.6)
    const light = new PointLight(0xffd39a, 0, 22, 1.5)
    light.position.copy(bulb.position)
    post.add(bulb, halo, light)
    lamps.push(light)
    scene.add(post)
  }
  function setLamps(k: number) {
    for (const l of lamps) l.intensity = 110 * k
    bulbMat.color.setRGB(0.14 + 3 * k, 0.14 + 2.4 * k, 0.14 + 1.6 * k)
    haloMat.opacity = 0.8 * k
  }

  /* ---- dust and sparks ---- */
  type Mote = { s: Sprite; m: SpriteMaterial; life: number; span: number; v: Vector3; grow: number; g: number }
  const motes: Mote[] = []
  for (let i = 0; i < 56; i++) {
    const m = new SpriteMaterial({ map: puff, transparent: true, depthWrite: false, opacity: 0 })
    const s = new Sprite(m)
    s.visible = false
    scene.add(s)
    motes.push({ s, m, life: 0, span: 1, v: new Vector3(), grow: 0, g: 0 })
  }
  let nextMote = 0
  const rr = rng(99)
  function emit(x: number, y: number, z: number, kind: 'dust' | 'spark', n: number, push = 1) {
    for (let i = 0; i < n; i++) {
      const p = motes[nextMote++ % motes.length]
      p.s.visible = true
      p.s.position.set(x + (rr() - 0.5) * 0.5, y + rr() * 0.2, z + (rr() - 0.5) * 0.5)
      if (kind === 'dust') {
        p.m.blending = NormalBlending
        p.m.color.setRGB(0.72, 0.66, 0.56)
        p.span = p.life = 0.9 + rr() * 0.9
        p.v.set((rr() - 0.3) * 1.6 * push, 0.5 + rr() * 1.1, (rr() - 0.5) * 1.6)
        p.s.scale.setScalar(0.5 + rr() * 0.5); p.grow = 1.6; p.g = 0.2
      } else {
        p.m.blending = AdditiveBlending
        p.m.color.setRGB(1, 0.72, 0.32)
        p.span = p.life = 0.25 + rr() * 0.35
        p.v.set((rr() - 0.2) * 5 * push, 1 + rr() * 3, (rr() - 0.5) * 3)
        p.s.scale.setScalar(0.1 + rr() * 0.1); p.grow = -0.1; p.g = 9
      }
    }
  }
  function moveMotes(dt: number) {
    for (const p of motes) {
      if (p.life <= 0) continue
      p.life -= dt
      if (p.life <= 0) { p.s.visible = false; p.m.opacity = 0; continue }
      p.v.y -= p.g * dt
      p.s.position.addScaledVector(p.v, dt)
      p.s.scale.addScalar(p.grow * dt)
      const u = p.life / p.span
      p.m.opacity = (p.m.blending === AdditiveBlending ? 1 : 0.34) * Math.min(1, u * 2)
    }
  }

  /* ---- the physics world ---- */
  const tramBox: Driver = { h: [...TRAM.HALF], p: [0, 0, 0], yaw: 0, v: [0, 0, 0], e: 0.22 }
  const deck: Driver = { h: [1.1, 0.11, 6.2], p: [0, cast.DECK - 0.11, 0], yaw: 0, v: [0, 0, 0], e: 0 }
  let shake = 0
  let acting = false
  let struck = 0
  const world: World = {
    bodies: [], drivers: [tramBox], ground: o.ground, g: 9.81,
    onStrike(b, speed) {
      struck++
      shake = Math.min(1, shake + 0.35 + speed * 0.03)
      o.sound('strike', Math.min(1, speed / 9))
      emit(b.p[0], b.p[1], b.p[2], 'dust', 3)
      for (const t of tags) if (t.follow && (t.follow.userData.body === b || t.follow.userData.group === (b.tag as Actor).side)) t.gone = true
    },
    onLand(b, speed) {
      o.sound('land', Math.min(1, speed / 8))
      emit(b.p[0], o.ground(b.p[0], b.p[2]) + 0.1, b.p[2], 'dust', 2)
    },
  }

  /* ---- the tram's run ---- */
  const run = { route: route(false) as Route, s: 0, v: 0, yaw: 0, x: 0, z: 0 }
  /** What the tram is doing: waiting, running to a mark, or stopped. */
  const drive = { on: false, brakeAt: Infinity, decel: 3.4, stopBy: Infinity, wait: 0, done: null as null | (() => void), doneAt: Infinity, t: 0, hidden: false }
  const ride = { pitch: 0, pitchV: 0, roll: 0, rollV: 0, heave: 0, heaveV: 0, lastYaw: 0, joint: 0 }
  const lev = { x: 0, v: 0, to: 0 }
  const box = { x: 0, v: 0 }

  function placeTram() {
    const f = at(run.route, run.s + TRAM.AXLE), b = at(run.route, run.s - TRAM.AXLE)
    run.x = (f.x + b.x) / 2; run.z = (f.z + b.z) / 2
    run.yaw = Math.atan2(-(f.z - b.z), f.x - b.x)
    tram.group.position.set(run.x, TRACK.RAIL, run.z)
    tram.group.rotation.y = run.yaw
    tramBox.p = [run.x, TRACK.BED + 0.1 + TRAM.HALF[1], run.z]
    tramBox.yaw = run.yaw
    tramBox.v = [Math.cos(run.yaw) * run.v, 0, -Math.sin(run.yaw) * run.v]
  }

  const q = new Quaternion()
  function sync() {
    for (const a of actors) {
      a.mesh.position.set(a.body.p[0], a.body.p[1], a.body.p[2])
      a.mesh.quaternion.set(a.body.q[0], a.body.q[1], a.body.q[2], a.body.q[3])
    }
  }

  function clear() {
    for (const a of actors) { scene.remove(a.mesh); a.mesh.geometry.dispose() }
    actors = []
    props.traverse((n) => { const m = n as Mesh; if (m.isMesh) m.geometry.dispose() })
    props.clear()
    world.bodies = []
    world.drivers = [tramBox]
    tags = []
    lever = null; crate = null
    for (const p of motes) { p.life = 0; p.s.visible = false; p.m.opacity = 0 }
    shake = 0; struck = 0
  }

  function add(piece: Piece, x: number, y: number, z: number, yaw: number, side: Actor['side']) {
    const body = makeBody(piece.half, piece.mass, [x, y + piece.half[1], z], yaw)
    const a: Actor = { ...piece, body, side }
    body.tag = a
    a.mesh.userData.body = body
    a.mesh.userData.group = side
    actors.push(a)
    world.bodies.push(body)
    scene.add(a.mesh)
    return a
  }

  /** Stand a token's worth of whatever it is at a place on a line. */
  function stand(t: Token, x: number, z: number, side: Actor['side'], seed: number) {
    if (t.kind === 'empty' || !t.n) return
    if (t.kind === 'box') {
      crate = cast.crate()
      crate.group.position.set(x + 4.2, 0, z)
      props.add(crate.group)
      return
    }
    const r = rng(seed)
    const y = TRACK.BED
    const first: Object3D[] = []
    for (let k = 0; k < t.n; k++) {
      let piece: Piece, px: number, pz: number, yaw: number
      if (t.kind === 'lobsters') {
        piece = cast.lobster(seed + k); px = x + (k - (t.n - 1) / 2) * 1.25; pz = z + (k % 2 ? 0.42 : -0.38); yaw = r() * 6.28
      } else if (t.kind === 'chickens') {
        piece = cast.chicken(seed + k); px = x + (k - (t.n - 1) / 2) * 0.9; pz = z + (k % 2 ? 0.45 : -0.4) * (0.6 + r() * 0.6); yaw = r() * 6.28
      } else {
        const rows = t.kind === 'crowd'
        piece = cast.figure(seed + k * 3, t.kind === 'you' ? 'you' : t.kind === 'friend' ? 'friend' : t.ghost ? 'ghost' : 'person')
        px = x + (k - (t.n - 1) / 2) * (rows ? 0.8 : 1.08)
        pz = z + (k % 2 ? 0.36 : -0.3) * (t.n > 1 ? 1 : 0.2)
        // Facing the tram, more or less.
        yaw = -Math.PI / 2 + (r() - 0.5) * 0.9
      }
      first.push(add(piece, px, y, pz, yaw, side).mesh)
    }
    const label = t.kind === 'you' ? 'you' : t.kind === 'friend' ? 'your friend' : t.label ?? (t.consent ? 'signed' : '')
    const tall = t.kind === 'lobsters' ? 1.2 : t.kind === 'chickens' ? 1.6 : 3.1
    if (label) tags.push({ text: label, at: new Vector3(x, y + tall, z), follow: first[Math.floor(first.length / 2)] })
  }

  function set(p: Problem, index: number, lampsOn: number) {
    clear()
    problem = p
    setLamps(lampsOn)
    const loop = !!p.loop
    stand(p.straight, TRACK.STAND, 0, 'main', index * 31 + 1)
    if (!p.bridge && !loop) stand(p.branch, TRACK.STAND, sideZ(TRACK.STAND, false), 'branch', index * 31 + 17)
    if (p.bridge) {
      const b = cast.bridge()
      props.add(b)
      world.drivers.push(deck)
      const big = add(cast.figure(index * 31 + 5, 'stranger'), -0.62, cast.DECK - TRACK.BED + TRACK.BED, 0.15, -Math.PI / 2, 'deck')
      big.body.p[1] = cast.DECK + big.half[1]
      const you = add(cast.figure(index * 31 + 9, 'you'), 0.25, 0, 1.25, -Math.PI / 2 - 0.5, 'deck')
      you.body.p[1] = cast.DECK + you.half[1]
      tags.push({ text: 'you', at: new Vector3(0.25, cast.DECK + 3.1, 1.25), follow: you.mesh })
    } else {
      lever = cast.lever(!!p.dead)
      const fork = loop ? TRACK.LOOP_FORK : TRACK.FORK
      lever.group.position.set(fork + 1.2, 0, 2.75)
      props.add(lever.group)
      lev.x = lev.to = p.thrown ? 1 : 0
      lev.v = 0
      lever.set(lev.x)
      o.setPoints(lev.x)
      if (p.money) {
        const c = cast.briefcase()
        c.position.set(fork + 3.2, 0, 3.4); c.rotation.y = -0.5
        props.add(c)
        tags.push({ text: '$1,000,000', at: new Vector3(fork + 3.2, 1.5, 3.4) })
      }
    }
    run.route = route(!!p.thrown && !p.bridge && !p.dead, loop)
    run.s = distAtX(run.route, TRACK.START)
    run.v = 0
    drive.on = false; drive.done = null; drive.hidden = false
    acting = false
    tram.group.visible = true
    ride.pitch = ride.pitchV = ride.roll = ride.rollV = ride.heave = ride.heaveV = 0
    tram.body.rotation.set(0, 0, 0); tram.body.position.set(0, 0, 0)
    box.x = box.v = 0
    placeTram()
    ride.lastYaw = run.yaw
    sync()
    o.onTags(tags)
  }

  /**
   * The decision. `acts` is whether the player did something; `deaths` is what
   * the problem says follows, which decides the cases a picture cannot: a
   * crowd that only gets dust in its eyes, a pair one of whom gets clear.
   */
  function act(acts: boolean, deaths: number, done: () => void) {
    const p = problem!
    const loop = !!p.loop
    const pre = !!p.thrown
    const diverted = !p.bridge && !p.dead && acts !== pre
    run.route = route(diverted, loop)
    run.s = distAtX(run.route, TRACK.START)
    const token = diverted && !loop ? p.branch : p.straight
    const standZ = diverted && !loop ? sideZ(TRACK.STAND, false) : 0
    const mark = distAtX(run.route, TRACK.STAND)
    drive.on = true; drive.t = 0; drive.wait = 0.45; drive.decel = 6.4; drive.done = done
    // It brakes the moment it meets them, which is what a driver would do and is still too late.
    drive.brakeAt = mark - TRAM.HALF[0] - 0.4; drive.decel = 6.8; drive.doneAt = mark - 1.2; drive.stopBy = Infinity
    acting = true

    if (!p.bridge && lever && acts) { lev.to = pre ? 0 : 1; o.sound('lever', 1) }
    const mine = actors.filter((a) => a.side === (diverted && !loop ? 'branch' : 'main'))

    if (p.bridge && acts) {
      // Over the gap in the rail and down onto the line.
      const big = actors.find((a) => a.side === 'deck' && a.mass > 100)!
      big.body.asleep = false
      big.body.v = [-2.6, 1.5, 0]
      big.body.w = [0, 0, 2.2]
      o.sound('push', 1)
      drive.wait = 1.5
      // It stops where it meets them.
      drive.brakeAt = distAtX(run.route, -5.5); drive.decel = 9; drive.doneAt = distAtX(run.route, -4)
    } else if (token.kind === 'box') {
      drive.brakeAt = mark - 3; drive.stopBy = mark + 4.4; drive.doneAt = mark + 1
    } else if (token.n && token.kind !== 'empty' && deaths === 0 && (token.kind === 'people' || token.kind === 'crowd' || token.kind === 'you' || token.kind === 'friend')) {
      // Nobody is hurt: it pulls up short and the dust reaches them instead.
      drive.stopBy = mark - TRAM.HALF[0] - 2.4; drive.brakeAt = drive.stopBy - (CRUISE * CRUISE) / (2 * 5.2); drive.decel = 5.2; drive.doneAt = drive.stopBy - 0.4
    } else if (!token.n || token.kind === 'empty') {
      drive.brakeAt = mark - 6; drive.decel = 3; drive.doneAt = mark - 3
    } else if (mine.length > deaths && deaths > 0 && token.kind === 'people') {
      // Somebody gets clear.
      for (const a of mine.slice(deaths)) (a as Actor & { flee?: number }).flee = 0.0001
    }
    void standZ

    if (!o.animate) {
      // No motion: the tram is simply where it ends up, and whoever it met is lying down.
      const stop = Math.min(drive.stopBy, drive.brakeAt + (CRUISE * CRUISE) / (2 * drive.decel))
      run.s = stop; run.v = 0
      placeTram()
      if (token.kind === 'box') tram.group.visible = false
      if (lever) { lev.x = lev.to; lever.set(lev.x); o.setPoints(lev.x) }
      const front = run.x + TRAM.HALF[0]
      for (const a of mine) {
        if (a.body.p[0] > front + 0.5 || (a as Actor & { flee?: number }).flee) continue
        a.body.q = [0, 0, Math.SQRT1_2, Math.SQRT1_2]
        a.body.p[0] = front + 1 + (a.body.p[0] - TRACK.STAND) * 1.6
        a.body.p[1] = o.ground(a.body.p[0], a.body.p[2]) + a.half[0]
      }
      for (const t of tags) if (t.follow?.userData.group === (diverted && !loop ? 'branch' : 'main')) t.gone = true
      sync(); o.onTags(tags)
      drive.on = false
      done()
    } else {
      o.sound('bell', 1)
    }
  }

  let acc = 0
  /** Advance everything by a frame. Returns how hard the camera should shake. */
  function update(dt: number) {
    // The lever, and the blades it moves.
    if (lever && (Math.abs(lev.to - lev.x) > 1e-4 || Math.abs(lev.v) > 1e-3)) {
      ;[lev.x, lev.v] = spring(lev.x, lev.v, lev.to, 260, 17, dt)
      lever.set(lev.x)
      o.setPoints(Math.max(0, Math.min(1, lev.x)))
    }
    acc += dt
    let steps = 0
    while (acc >= STEP && steps < 14) {
      acc -= STEP; steps++
      if (drive.on) {
        drive.t += STEP
        const before = run.v
        if (drive.t > drive.wait) {
          const brake = run.s >= drive.brakeAt
          // Brake harder if that is what it takes to stop by the mark.
          let d = drive.decel
          if (drive.stopBy < Infinity && run.s < drive.stopBy) d = Math.max(d, (run.v * run.v) / (2 * Math.max(0.05, drive.stopBy - run.s)))
          run.v = brake ? Math.max(0, run.v - d * STEP) : Math.min(CRUISE, run.v + PULL * STEP)
          run.s += run.v * STEP
          if (brake && run.v > 2 && d > 4 && rr() < 0.06) {
            emit(run.x + Math.cos(run.yaw) * TRAM.AXLE, TRACK.RAIL + 0.05, run.z + TRACK.GAUGE, 'spark', 2, -1)
            o.sound('brake', Math.min(1, run.v / CRUISE))
          }
          if (brake && run.v === 0) { drive.on = false; if (drive.done) { drive.done(); drive.done = null } }
        }
        if (drive.done && run.s >= drive.doneAt && drive.t > drive.wait + 0.3) {
          const d = drive.done; drive.done = null
          // A beat after it arrives, so the picture lands before the words do.
          setTimeout(d, 700)
        }
        placeTram()
        // Rail joints, one every five metres.
        const j = Math.floor(run.s / 5)
        if (j !== ride.joint) { ride.joint = j; if (run.v > 0.8) { ride.heaveV -= 0.22; o.sound('clack', Math.min(1, run.v / CRUISE)) } }
        const aLong = (run.v - before) / STEP
        const yawRate = (run.yaw - ride.lastYaw) / STEP
        ride.lastYaw = run.yaw
        ;[ride.pitch, ride.pitchV] = spring(ride.pitch, ride.pitchV, aLong * 0.0075, 60, 7, STEP)
        ;[ride.roll, ride.rollV] = spring(ride.roll, ride.rollV, -yawRate * run.v * 0.012, 50, 6, STEP)
        ;[ride.heave, ride.heaveV] = spring(ride.heave, ride.heaveV, 0, 190, 9, STEP)
        if (crate && run.x + TRAM.HALF[0] > crate.group.position.x - crate.length / 2 + 1 && !drive.hidden && run.v < 0.4) {
          drive.hidden = true; box.v = 1.6; shake = Math.min(1, shake + 0.5); o.sound('thump', 1)
          emit(crate.group.position.x - crate.length / 2, 0.4, crate.group.position.z, 'dust', 8, -1)
        }
      }
      // Whoever was going to get clear, gets clear.
      for (const a of actors as Array<Actor & { flee?: number }>) {
        if (!a.flee || a.flee >= 1 || !drive.on || drive.t < drive.wait + 1.2) continue
        a.flee = Math.min(1, a.flee + STEP / 0.9)
        const e = a.flee * a.flee * (3 - 2 * a.flee)
        a.body.p[2] += (STEP / 0.9) * 3.4 * (e > 0 ? 1 : 0) * (a.body.p[2] < sideZ(TRACK.STAND, false) / 2 ? -1 : 1)
        a.body.p[1] = o.ground(a.body.p[0], a.body.p[2]) + a.half[1] + Math.sin(a.flee * Math.PI * 3) ** 2 * 0.12
      }
      step(world, STEP)
    }
    if (steps) {
      sync()
      tram.body.rotation.z = ride.pitch
      tram.body.rotation.x = ride.roll
      tram.body.position.y = ride.heave
      const spin = (run.v * steps * STEP) / TRAM.WHEEL
      for (const s of tram.sets) s.rotation.z -= spin
      if (crate) {
        ;[box.x, box.v] = spring(box.x, box.v, 0, 120, 6, steps * STEP)
        crate.group.rotation.z = box.x * 0.05
        crate.group.position.y = Math.abs(box.x) * 0.25
      }
    }
    moveMotes(dt)
    shake = Math.max(0, shake - dt * 1.6)
    return shake
  }

  void q
  return {
    set, act, update, run, setLamps,
    /** True while anything is still moving, so the stage knows to keep drawing. */
    get busy() { return drive.on || world.bodies.some((b) => !b.asleep) || motes.some((m) => m.life > 0) },
    get struck() { return struck },
    /** True from the decision until the next problem: the camera follows the tram while it is. */
    get acting() { return acting },
    dispose() {
      clear()
      lampGeo.dispose(); lampMat.dispose(); bulbMat.dispose(); bulbGeo.dispose(); haloMat.dispose(); puff.dispose()
      for (const p of motes) p.m.dispose()
    },
  }
}

export type Play = ReturnType<typeof createPlay>
