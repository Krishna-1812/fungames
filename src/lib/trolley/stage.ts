/**
 * Trolley's stage: a model railway, lit by a real sky, that things happen on.
 *
 * The page hands it a problem (`show`) and later a decision (`act`); it lays
 * the track that problem needs, stands the right figures on it, and when the
 * decision comes it drives the tram along the chosen line and lets the
 * physics say what follows.
 *
 * If WebGL 2 is not there `createStage` returns null and the page keeps the
 * flat drawing it has always had.
 */
import {
  ACESFilmicToneMapping, BufferGeometry, DirectionalLight, Float32BufferAttribute, FogExp2, HalfFloatType,
  HemisphereLight, PCFShadowMap, PerspectiveCamera, PMREMGenerator, Points, PointsMaterial, Scene, Vector2, Vector3,
  WebGLRenderer, WebGLRenderTarget,
} from 'three'
import { Sky } from 'three/examples/jsm/objects/Sky.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import type { Scene as Problem } from '../../data/dilemmas'
import { buildLand } from './land'
import { createRailKit } from './rails'
import type { BranchKind } from './rails'
import { hourAt, sunDir } from './light'
import { rng } from './kit'
import { TRACK, groundAt, sideZ } from './track'
import { buildTram } from './tram'
import { createCast } from './cast'
import { createPlay } from './play'
import type { Sound, Tag } from './play'

export type StageOptions = {
  canvas: HTMLCanvasElement
  /** How many problems there are, so each knows what time of day it is. */
  total: number
  /** False under reduced motion: the picture is drawn and then holds still. */
  animate: boolean
  /** Where the name tags go: an element laid exactly over the canvas. */
  tags: HTMLElement
  sound?: (s: Sound, strength: number) => void
}

/**
 * The miniature look: sharp across the band where the tracks are, soft above
 * and below it, with the corners drawn in a little. One pass, sixteen taps.
 */
const TiltShift = {
  uniforms: {
    tDiffuse: { value: null },
    uTexel: { value: new Vector2(1 / 1024, 1 / 512) },
    uFocus: { value: 0.45 },
    uBand: { value: 0.2 },
    uMax: { value: 6 },
    uVignette: { value: 0.3 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uTexel;
    uniform float uFocus, uBand, uMax, uVignette;
    varying vec2 vUv;
    void main() {
      float d = abs(vUv.y - uFocus) - uBand;
      float r = uMax * smoothstep(0.0, 0.34, d);
      vec3 sum = texture2D(tDiffuse, vUv).rgb;
      float n = 1.0;
      if (r > 0.35) {
        // A golden-angle spiral: even cover of the disc from few taps.
        for (int i = 1; i <= 16; i++) {
          float a = float(i) * 2.39996, q = sqrt(float(i) / 16.0) * r;
          sum += texture2D(tDiffuse, vUv + vec2(cos(a), sin(a)) * q * uTexel).rgb;
          n += 1.0;
        }
      }
      vec3 c = sum / n;
      vec2 v = vUv - 0.5;
      c *= 1.0 - uVignette * smoothstep(0.25, 0.95, dot(v, v) * 2.2);
      gl_FragColor = vec4(c, 1.0);
    }`,
}

export function createStage(o: StageOptions) {
  let renderer: WebGLRenderer
  try {
    if (!o.canvas.getContext('webgl2')) return null
    renderer = new WebGLRenderer({ canvas: o.canvas, antialias: false, powerPreference: 'high-performance' })
  } catch {
    return null
  }
  const coarse = matchMedia('(pointer: coarse)').matches
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFShadowMap
  renderer.toneMapping = ACESFilmicToneMapping

  const scene = new Scene()
  const fog = new FogExp2(0xc8d4e4, 0.006)
  scene.fog = fog
  const camera = new PerspectiveCamera(24, 2, 1, 2400)

  /* ---- sky, and the light it gives ---- */
  const sky = new Sky()
  sky.scale.setScalar(1800)
  scene.add(sky)
  const skyOnly = new Scene()
  const skyCopy = new Sky()
  skyCopy.scale.setScalar(1800)
  skyOnly.add(skyCopy)
  const pmrem = new PMREMGenerator(renderer)
  let envTarget: WebGLRenderTarget | null = null

  const sun = new DirectionalLight(0xffffff, 3)
  sun.castShadow = true
  sun.shadow.mapSize.setScalar(coarse ? 1024 : 2048)
  const sc = sun.shadow.camera
  sc.left = -36; sc.right = 36; sc.top = 24; sc.bottom = -24; sc.near = 10; sc.far = 190
  sun.shadow.bias = -0.0004
  sun.shadow.normalBias = 0.04
  sun.target.position.set(0, 0, -3)
  scene.add(sun, sun.target)
  const fill = new HemisphereLight(0xffffff, 0x444444, 0.5)
  scene.add(fill)

  const starGeo = new BufferGeometry()
  {
    const r = rng(77), p: number[] = []
    for (let i = 0; i < 1100; i++) {
      const a = r() * 6.283, y = 0.04 + r() * 0.96, k = Math.sqrt(1 - y * y)
      p.push(Math.cos(a) * k * 1500, y * 1500, Math.sin(a) * k * 1500)
    }
    starGeo.setAttribute('position', new Float32BufferAttribute(p, 3))
  }
  const starMat = new PointsMaterial({ color: 0xdfe8ff, size: 1.7, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false })
  const stars = new Points(starGeo, starMat)
  scene.add(stars)

  /* ---- the world ---- */
  let lines: Array<(x: number) => number | null> = [() => 0]
  const ground = (x: number, z: number) => groundAt(x, z, lines)
  // The grass is planted once, clear of every bed any problem lays.
  const anyBed = (x: number, z: number) =>
    groundAt(x, z, [() => 0, (x) => (x > TRACK.FORK ? sideZ(x, false) : null), (x) => (x > TRACK.LOOP_FORK && x < 11.5 ? sideZ(x, true) : null)]) > 0
  const land = buildLand(anyBed)
  scene.add(land.group)
  const railKit = createRailKit()
  let rails: ReturnType<typeof railKit.build> | null = null

  /* ---- the tram ---- */
  const tram = buildTram()
  scene.add(tram.group)
  const cast = createCast()
  let tags: Tag[] = []
  const play = createPlay({
    scene, cast, tram, ground, animate: o.animate,
    sound: (s, k) => o.sound?.(s, k),
    setPoints: (t) => rails?.setPoints(t),
    onTags(list) {
      tags = list
      o.tags.textContent = ''
      for (const t of list) {
        t.el = document.createElement('span')
        t.el.className = 'tr-tag'
        t.el.textContent = t.text
        o.tags.append(t.el)
      }
      placeTags()
    },
  })
  const tagAt = new Vector3()
  function placeTags() {
    for (const t of tags) {
      if (!t.el) continue
      t.el.classList.toggle('is-gone', !!t.gone)
      const q = tagAt.copy(t.at).project(camera)
      const x = (q.x * 0.5 + 0.5) * size.x, y = (0.5 - q.y * 0.5) * size.y
      t.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%) translateY(-10px)`
    }
  }

  /* ---- the picture ---- */
  const size = new Vector2(2, 1)
  const target = new WebGLRenderTarget(2, 1, { samples: coarse ? 2 : 4, type: HalfFloatType })
  const composer = new EffectComposer(renderer, target)
  composer.addPass(new RenderPass(scene, camera))
  const tilt = new ShaderPass(TiltShift)
  composer.addPass(tilt)
  composer.addPass(new OutputPass())

  /* ---- the camera ---- */
  const look = new Vector3(), home = new Vector3(), tmp = new Vector3()
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 }
  let reach = 60
  /** Points that have to be in the frame for the problem to be readable. */
  let must: Vector3[] = []
  function frame() {
    const a = size.x / size.y
    const k = Math.max(0, Math.min(1, (a - 0.9) / 1.1))
    const yaw = (-48 + 34 * k) * (Math.PI / 180), el = (22 - 9 * k) * (Math.PI / 180)
    const dir = tmp.set(Math.sin(yaw) * Math.cos(el), Math.sin(el), Math.cos(yaw) * Math.cos(el)).clone()
    camera.aspect = a
    camera.fov = 36
    camera.updateProjectionMatrix()
    look.set(-1.5, 1.2, -2.5)
    const fits = (dist: number) => {
      camera.position.copy(look).addScaledVector(dir, dist)
      camera.lookAt(look)
      camera.updateMatrixWorld()
      let x0 = 1, x1 = -1, y0 = 1, y1 = -1
      for (const p of must) {
        const q = tmp.copy(p).project(camera)
        x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y)
      }
      return { x0, x1, y0, y1 }
    }
    // Twice: fit, centre what was fitted, fit again.
    for (let pass = 0; pass < 3; pass++) {
      let lo = 14, hi = 260
      for (let i = 0; i < 22; i++) {
        const mid = (lo + hi) / 2, b = fits(mid)
        if (b.x1 - b.x0 < 1.84 && b.y1 - b.y0 < 1.02 + 0.3 * (1 - k)) hi = mid; else lo = mid
      }
      reach = hi
      const b = fits(reach)
      const halfH = Math.tan((camera.fov * Math.PI) / 360) * reach, halfW = halfH * a
      const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0), up = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1)
      look.addScaledVector(right, ((b.x0 + b.x1) / 2) * halfW)
      // What matters sits a little below the middle; the sky gets the rest.
      look.addScaledVector(up, ((b.y0 + b.y1) / 2 + 0.2 * k) * halfH)
    }
    home.copy(look).addScaledVector(dir, reach)
    camera.position.copy(home)
    camera.lookAt(look)
    // Where the sharp band is: from the near shoulder of the main line to the far side of the siding.
    camera.updateMatrixWorld()
    const near = tmp.set(0, 0, 4).project(camera).y, far = tmp.set(0, 2.5, TRACK.SIDE - 2.5).project(camera).y
    tilt.uniforms.uFocus.value = (near + far) / 4 + 0.5
    tilt.uniforms.uBand.value = Math.abs(far - near) / 4 + 0.03
  }

  function resize() {
    const w = Math.max(2, o.canvas.clientWidth), h = Math.max(2, o.canvas.clientHeight)
    const dpr = Math.min(devicePixelRatio || 1, coarse ? 2 : 1.75)
    renderer.setPixelRatio(dpr)
    renderer.setSize(w, h, false)
    composer.setPixelRatio(dpr)
    composer.setSize(w, h)
    size.set(w, h)
    tilt.uniforms.uTexel.value.set(1 / (w * dpr), 1 / (h * dpr))
    tilt.uniforms.uMax.value = Math.max(2.5, (h * dpr) / 90)
    frame()
    dirty = true
  }

  /* ---- the hour ---- */
  function setHour(u: number) {
    const h = hourAt(u)
    const d = sunDir(h.el, h.az), s = sunDir(h.skyEl, h.skyEl > 0 ? h.az : 140)
    for (const one of [sky, skyCopy]) {
      const un = one.material.uniforms
      un.turbidity.value = h.turbidity
      un.rayleigh.value = h.rayleigh
      un.mieCoefficient.value = 0.004
      un.mieDirectionalG.value = 0.82
      un.sunPosition.value.set(s[0], s[1], s[2])
      un.cloudCoverage.value = h.clouds
      un.cloudDensity.value = 0.55
      un.cloudElevation.value = 0.55
      un.cloudScale.value = 0.00028
    }
    skyCopy.material.uniforms.showSunDisc.value = 0
    envTarget?.dispose()
    envTarget = pmrem.fromScene(skyOnly, 0, 1, 2400)
    scene.environment = envTarget.texture
    scene.environmentIntensity = h.env
    sun.color.setRGB(h.sun[0], h.sun[1], h.sun[2])
    sun.intensity = h.sunPower
    sun.position.set(d[0] * 90, d[1] * 90, d[2] * 90 - 3)
    fill.color.setRGB(h.fillSky[0], h.fillSky[1], h.fillSky[2])
    fill.groundColor.setRGB(h.fillGround[0], h.fillGround[1], h.fillGround[2])
    fill.intensity = h.fill
    fog.color.setRGB(h.fog[0], h.fog[1], h.fog[2])
    fog.density = h.fogDensity
    renderer.toneMappingExposure = h.exposure
    starMat.opacity = h.stars
    stars.visible = h.stars > 0.01
    return h
  }

  /* ---- a problem ---- */
  function show(p: Problem, index: number) {
    if (rails) { scene.remove(rails.group); rails.dispose() }
    const kind: BranchKind = p.bridge ? 'none' : p.loop ? 'loop' : 'siding'
    rails = railKit.build(kind, !!p.dead)
    scene.add(rails.group)
    lines = [() => 0]
    if (kind === 'siding') lines.push((x) => (x > TRACK.FORK ? sideZ(x, false) : null))
    if (kind === 'loop') lines.push((x) => (x > TRACK.LOOP_FORK && x < 11.5 ? sideZ(x, true) : null))
    const hour = setHour(o.total > 1 ? index / (o.total - 1) : 0)
    tram.setLamps(hour.lamps)
    tram.setNumber(index + 1)
    play.set(p, index, hour.lamps)
    must = [
      new Vector3(TRACK.START - 2.4, 0.4, 1.4), new Vector3(TRACK.START - 2.4, 3.9, -1.4),
      new Vector3(TRACK.STAND + 8, 0.3, 1.6), new Vector3(TRACK.STAND + 8, 3.4, TRACK.SIDE - 1.4),
      new Vector3(TRACK.FORK, 0, 3.8),
    ]
    if (p.branch.kind === 'box') must.push(new Vector3(TRACK.STAND + 9, 5, TRACK.SIDE - 1.5))
    if (p.bridge) must.push(new Vector3(0, cast.DECK + 2.6, 0))
    dolly.x = dolly.v = 0
    frame()
    placeTags()
    dirty = true
  }

  /* ---- the loop ---- */
  let raf = 0, last = 0, clock = 0, dirty = true, seen = true, disposed = false
  /** How far the camera has slid along the line to keep the tram in view. */
  const dolly = { x: 0, v: 0 }
  function tick(now: number) {
    raf = 0
    if (disposed) return
    const dt = Math.min(0.05, (now - last) / 1000 || 0)
    last = now
    if (o.animate) {
      clock += dt
      land.update(clock)
      sky.material.uniforms.time.value = clock * 6
      pointer.sx += (pointer.x - pointer.sx) * Math.min(1, dt * 3)
      pointer.sy += (pointer.y - pointer.sy) * Math.min(1, dt * 3)
      const shake = play.update(dt)
      // Follow the tram, a little behind it, and only as far as it needs.
      const want = play.acting ? Math.max(0, Math.min(11, play.run.x - 1)) * 0.75 : 0
      const a = 9 * (want - dolly.x) - 5.5 * dolly.v
      dolly.v += a * dt; dolly.x += dolly.v * dt
      camera.position.copy(home)
      camera.position.x += dolly.x
      camera.translateX(pointer.sx * reach * 0.02)
      camera.translateY(pointer.sy * reach * 0.012)
      camera.lookAt(tmp.copy(look).setX(look.x + dolly.x))
      if (shake > 0.01) {
        // Trauma squared: a knock is sharp and dies quickly.
        const k = shake * shake * reach * 0.006
        camera.position.x += Math.sin(clock * 71) * k
        camera.position.y += Math.sin(clock * 93 + 1.3) * k
        camera.rotation.z += Math.sin(clock * 57 + 0.7) * shake * shake * 0.006
      }
      camera.updateMatrixWorld()
      placeTags()
      dirty = true
    }
    if (dirty) { composer.render(dt); dirty = false }
    if (o.animate && seen && !document.hidden) raf = requestAnimationFrame(tick)
  }
  const wake = () => { if (!raf && !disposed) { last = performance.now(); raf = requestAnimationFrame(tick) } }

  const io = new IntersectionObserver((es) => { seen = es[es.length - 1].isIntersecting; if (seen) wake() })
  io.observe(o.canvas)
  const onVis = () => { if (!document.hidden) wake() }
  document.addEventListener('visibilitychange', onVis)
  const ro = new ResizeObserver(() => { resize(); wake() })
  ro.observe(o.canvas)
  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return
    const b = o.canvas.getBoundingClientRect()
    pointer.x = Math.max(-1, Math.min(1, ((e.clientX - b.left) / b.width) * 2 - 1))
    pointer.y = Math.max(-1, Math.min(1, 1 - ((e.clientY - b.top) / b.height) * 2))
  }
  addEventListener('pointermove', onMove, { passive: true })

  resize()

  return {
    show(p: Problem, index: number) { show(p, index); wake() },
    /** Run the decision; `done` is called when the outcome can be told. */
    act(acts: boolean, deaths: number, done: () => void) { play.act(acts, deaths, done); dirty = true; wake() },
    resize,
    ground,
    /** For looking at it from a console. */
    debug: { tram, play, renderer, scene, camera, composer, tilt, sun, fill, look, home, setHour, redraw: () => { dirty = true; wake() } },
    dispose() {
      disposed = true
      cancelAnimationFrame(raf)
      io.disconnect(); ro.disconnect()
      document.removeEventListener('visibilitychange', onVis)
      removeEventListener('pointermove', onMove)
      rails?.dispose()
      play.dispose(); cast.dispose(); railKit.dispose(); land.dispose(); tram.dispose()
      envTarget?.dispose(); pmrem.dispose()
      starGeo.dispose(); starMat.dispose()
      target.dispose(); composer.dispose(); renderer.dispose()
    },
  }
}

export type Stage = NonNullable<ReturnType<typeof createStage>>
