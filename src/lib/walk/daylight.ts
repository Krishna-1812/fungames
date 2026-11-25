/**
 * The walk's day (walker.ts): the sun, the moon and the stars going round,
 * and everything they light.
 *
 * The island is in the tropics (24° north, the sun 15° north of the equator:
 * early summer), so the sun comes up in the east at about half past five,
 * stands three-quarters of the way up the sky at noon, a little to the
 * south, and sets in the west at about half past six; the moon is up through
 * the night. From the sun's height follow the rest:
 *
 *   - its light: strong and nearly white when it is high, weaker and warmer
 *     the lower it is (more air in the way), gone below the horizon;
 *   - the sky (three's Sky, scattering the light as air does): deep blue by
 *     day, reddening and darkening at sunrise and sunset; then the blue hour
 *     (a dome of its own, as the scattering sky goes black too soon), the
 *     afterglow low where the sun went down, and the night's own dark, with the stars coming out and wheeling slowly about the pole;
 *   - the moon, rising as the sun sets, which casts the shadows at night;
 *   - the air: the haze's colour, and the eye's own adjustment to the dark;
 *   - the town: the street lamps switching on at dusk and off at dawn, the
 *     windows lighting one by one as it gets dark and most of them going
 *     out after midnight, a few early risers' before dawn.
 */
import {
  AmbientLight, BackSide, BufferGeometry, ShaderMaterial, Color, DirectionalLight, Float32BufferAttribute, Fog, HemisphereLight, MathUtils, Mesh, MeshBasicMaterial, PMREMGenerator,
  Points, PointsMaterial, Scene, SphereGeometry, Vector3, type WebGLRenderTarget, type WebGLRenderer,
} from 'three'
import { Sky } from 'three/examples/jsm/objects/Sky.js'

const LAT = MathUtils.degToRad(24), DEC = MathUtils.degToRad(15), MOON_DEC = MathUtils.degToRad(-6)

/** Where a body is (its elevation and azimuth from north, in degrees) at an hour, given when it crosses the meridian. */
function place(hour: number, noon: number, dec: number) {
  const H = MathUtils.degToRad((hour - noon) * 15)
  const sinEl = Math.sin(LAT) * Math.sin(dec) + Math.cos(LAT) * Math.cos(dec) * Math.cos(H)
  const el = Math.asin(sinEl)
  let cosAz = (Math.sin(dec) - sinEl * Math.sin(LAT)) / (Math.cos(el) * Math.cos(LAT))
  cosAz = Math.max(-1, Math.min(1, cosAz))
  let az = Math.acos(cosAz)
  if (Math.sin(H) > 0) az = Math.PI * 2 - az
  return { el: MathUtils.radToDeg(el), az: MathUtils.radToDeg(az) }
}
/** A direction in the world for an elevation and azimuth (north is -z, the top of the map; east is +x). */
function towards(el: number, az: number, out = new Vector3()) {
  const e = MathUtils.degToRad(el), a = MathUtils.degToRad(az)
  return out.set(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e))
}
const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t) }

/** The sun at an hour (for the checks): elevation and azimuth, degrees. */
export const sunPlace = (hour: number) => place(hour, 12, DEC)

/**
 * How many of the windows with someone home are lit, through the night: all of them in the evening, fewer
 * and fewer after eleven, a third at three, then some early risers before dawn.
 */
export function homesLit(hour: number) {
  const h = ((hour % 24) + 24) % 24
  if (h >= 15 && h < 23) return 1
  if (h >= 23 || h < 3) { const t = (h >= 23 ? h - 23 : h + 1) / 4; return 1 - 0.68 * t }
  if (h < 5) return 0.32 + 0.3 * ((h - 3) / 2)
  return 0.62
}

export function daylight(scene: Scene, renderer: WebGLRenderer, opts: { shadowSize: number; reach: number; soft?: number }) {
  const sky = new Sky()
  sky.scale.setScalar(4000)
  const su = sky.material.uniforms
  su.mieDirectionalG.value = 0.88; su.mieCoefficient.value = 0.004
  scene.add(sky)
  // The sky also lights the world: blurred into an environment map, it is what the sea and the glass
  // reflect and the soft light that fills every shadow (made again as the sun moves).
  const pmrem = new PMREMGenerator(renderer)
  const envScene = new Scene(), envSky = new Sky()
  envSky.material = sky.material; envSky.scale.setScalar(1000); envScene.add(envSky)
  const nightEnv = new Scene(); nightEnv.background = new Color('#1b2a52')
  let envRT: WebGLRenderTarget | null = null, envAt = -999, envNight: boolean | null = null

  // The stars: a few thousand, on a sphere that turns about the pole once a day.
  const starPos: number[] = []
  for (let k = 0; k < 2800; k++) {
    const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u)
    starPos.push(r * Math.cos(a) * 420, u * 420, r * Math.sin(a) * 420)
  }
  const starGeo = new BufferGeometry(); starGeo.setAttribute('position', new Float32BufferAttribute(starPos, 3))
  const starMat = new PointsMaterial({ color: '#dfe8ff', size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0, depthWrite: false })
  const stars = new Points(starGeo, starMat)
  // The blue hour and the night: a dome, blue overhead, paler at the horizon, glowing where the sun went down.
  const domeMat = new ShaderMaterial({
    uniforms: { uZen: { value: new Color() }, uHor: { value: new Color() }, uGlow: { value: new Color() }, uSun: { value: new Vector3() }, uOpacity: { value: 0 } },
    vertexShader: 'varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 uZen, uHor, uGlow, uSun; uniform float uOpacity; varying vec3 vDir;
      void main() {
        float up = max(vDir.y, 0.0);
        vec3 c = mix(uHor, uZen, pow(up, 0.55));
        vec2 s = normalize(uSun.xz + 1e-5), d = normalize(vDir.xz + 1e-5);
        float toward = max(dot(s, d), 0.0);
        c += uGlow * pow(toward, 3.0) * exp(-up * 7.0);
        c = mix(c, uHor * 0.6, smoothstep(0.0, -0.2, vDir.y));
        gl_FragColor = vec4(c, uOpacity);
      }`,
    side: BackSide, transparent: true, depthWrite: false, fog: false,
  })
  const dome = new Mesh(new SphereGeometry(440, 48, 24), domeMat)
  dome.renderOrder = -1
  scene.add(dome)
  const ZEN_NIGHT = new Color('#070d22'), ZEN_BLUE = new Color('#1d3466'), HOR_NIGHT = new Color('#101a38'), HOR_BLUE = new Color('#5d74a6'), GLOW = new Color('#e0a48e')
  const moonMat = new MeshBasicMaterial({ color: '#eef2ff', fog: false, transparent: true })
  const moon = new Mesh(new SphereGeometry(9, 24, 16), moonMat)
  scene.add(stars, moon)

  // One light casts the shadows: the sun by day, the moon by night (they hand over in the dark of dusk).
  const light = new DirectionalLight('#fff3e2', 2.6)
  light.castShadow = true
  light.shadow.mapSize.set(opts.shadowSize, opts.shadowSize)
  const sc = light.shadow.camera; sc.left = -opts.reach; sc.right = opts.reach; sc.top = opts.reach; sc.bottom = -opts.reach; sc.near = 0.5; sc.far = 70
  light.shadow.radius = opts.soft ?? 3; light.shadow.bias = -0.0004; light.shadow.normalBias = 0.02
  scene.add(light, light.target)
  const hemi = new HemisphereLight('#bcd4f0', '#7d8a6a', 0.6)
  const amb = new AmbientLight('#ffffff', 0.12)
  scene.add(hemi, amb)
  const fog = new Fog('#c9dbe8', 14, 70)
  scene.fog = fog
  const nightBg = new Color('#0b1430')

  const C = (h: string) => new Color(h)
  const SUN_HIGH = C('#fff4e8'), SUN_LOW = C('#ffcfaa'), MOON = C('#c3cde8')
  const FOG_DAY = C('#c9dbe8'), FOG_GOLD = C('#ddd0cc'), FOG_DUSK = C('#56617f'), FOG_NIGHT = C('#0d1424')
  const HEMI_DAY = C('#bcd4f0'), HEMI_NIGHT = C('#3d4866'), GROUND_DAY = C('#7d8a6a'), GROUND_NIGHT = C('#1a1e28')

  const state = {
    hour: 16.5,
    /** The sun's and the moon's directions, towards them. */
    sunDir: new Vector3(), moonDir: new Vector3(), lightDir: new Vector3(),
    sunEl: 0, moonEl: 0,
    /** 0 at night, 1 in daylight. */
    day: 1,
    /** How golden the light is (the hour after sunrise and before sunset). */
    gold: 0,
    lamps: false, lampGlow: 0, homes: 0,
    exposure: 0.55,
  }

  const set = (hour: number) => {
    state.hour = ((hour % 24) + 24) % 24
    const s = place(state.hour, 12, DEC), m = place(state.hour, 0, MOON_DEC)
    state.sunEl = s.el; state.moonEl = m.el
    towards(s.el, s.az, state.sunDir); towards(m.el, m.az, state.moonDir)
    const e = s.el
    // (Twilight lingers: the sky lights the world for a while after the sun has gone.)
    const day = smooth(-9, 5, e), gold = smooth(-2, 3, e) * (1 - smooth(6, 22, e))
    state.day = day; state.gold = gold
    // The light: the sun's, warmer and weaker low down; the moon's, cool and faint, once the sun is well down.
    const sunI = 2.7 * smooth(-0.5, 8, e) * (0.62 + 0.38 * smooth(6, 40, e))
    const moonI = 0.42 * smooth(-2, -9, e) * smooth(-2, 10, m.el)
    if (sunI >= moonI) {
      light.intensity = sunI; light.color.copy(SUN_LOW).lerp(SUN_HIGH, smooth(3, 30, e)); state.lightDir.copy(state.sunDir)
    } else {
      light.intensity = moonI; light.color.copy(MOON); state.lightDir.copy(state.moonDir)
    }
    // The sky: scattering more, and redder, through more air at sunrise and sunset; the night's dark under it.
    const low = 1 - smooth(4, 25, e)
    su.turbidity.value = 4 + 2 * low; su.rayleigh.value = 1.6 + 1.0 * low
    su.sunPosition.value.copy(state.sunDir)
    sky.visible = e > -11
    scene.background = sky.visible ? null : nightBg
    const blue = smooth(-12, -2, e), dm = domeMat.uniforms
    dm.uZen.value.copy(ZEN_NIGHT).lerp(ZEN_BLUE, blue).multiplyScalar(1.6)
    dm.uHor.value.copy(HOR_NIGHT).lerp(HOR_BLUE, blue).multiplyScalar(1.6)
    dm.uGlow.value.copy(GLOW).multiplyScalar(smooth(-10, -1, e) * (1 - smooth(-1, 4, e)) * 1.4)
    dm.uSun.value.copy(state.sunDir)
    dm.uOpacity.value = smooth(5, -4, e) * (0.55 + 0.45 * smooth(0, -4, e))
    dome.visible = dm.uOpacity.value > 0.001
    // The stars come out as it gets dark, and turn about the pole (tilted by the latitude).
    starMat.opacity = 0.9 * smooth(-3, -12, e)
    stars.visible = starMat.opacity > 0.01
    stars.rotation.set(-(Math.PI / 2 - LAT), 0, 0); stars.rotateY((state.hour / 24) * Math.PI * 2)
    moonMat.opacity = smooth(-4, 3, m.el) * (0.35 + 0.65 * (1 - day))
    moon.visible = moonMat.opacity > 0.01
    hemi.intensity = 0.2 + 0.4 * day; hemi.color.copy(HEMI_NIGHT).lerp(HEMI_DAY, day); hemi.groundColor.copy(GROUND_NIGHT).lerp(GROUND_DAY, day)
    fog.color.copy(FOG_NIGHT).lerp(FOG_DUSK, smooth(-10, -3, e)).lerp(FOG_DAY, day).lerp(FOG_GOLD, gold * 0.6)
    // The eye opens to the dark, and a little to the low light of the golden hour.
    state.exposure = 0.95 - 0.4 * day + 0.05 * gold
    // Street lamps: on as the sun goes down, off once it is up (a little apart, as their switches are).
    if (e < 1.5) state.lamps = true
    else if (e > 4) state.lamps = false
    state.homes = smooth(7, -4, e) * homesLit(state.hour)
    // The sky's light on the world, made again as the sun moves (or for the night, once).
    const nightNow = e < -9
    if (nightNow !== envNight || (!nightNow && Math.abs(e - envAt) > 1.2)) {
      envNight = nightNow; envAt = e
      envRT?.dispose(); envRT = pmrem.fromScene(nightNow ? nightEnv : envScene)
      scene.environment = envRT.texture
    }
    scene.environmentIntensity = 0.35 - 0.05 * day
    renderer.toneMappingExposure = state.exposure
  }
  set(state.hour)

  return {
    state, light, sky, stars, moon,
    set,
    /** Each frame: the stars and the moon stay at infinity round the camera; the lamps fade on or off. */
    follow(camera: Vector3, dt: number) {
      stars.position.copy(camera); dome.position.copy(camera)
      moon.position.copy(camera).addScaledVector(state.moonDir, 400)
      state.lampGlow += ((state.lamps ? 1 : 0) - state.lampGlow) * Math.min(1, dt * 2.5)
    },
    dispose() { envRT?.dispose(); pmrem.dispose() },
  }
}
