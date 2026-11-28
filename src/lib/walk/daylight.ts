/**
 * The walk's day (walker.ts): the sun, the moon and the stars going round,
 * and everything they light.
 *
 * The island is in the tropics (24° north, the sun 15° north of the equator:
 * early summer), so the sun comes up in the east at about half past five,
 * stands three-quarters of the way up the sky at noon, a little to the
 * south, and sets in the west at about half past six. From there:
 *
 *   - the air (atmosphere.ts): one physically based atmosphere gives the sky,
 *     the sun's colour (white at noon, gold low down, red as it sets, gone
 *     below the Earth's edge — its light is simply what gets through the air),
 *     the haze over everything far off, the twilight (the Earth's shadow
 *     rising in the east as the sun sets, the pink belt above it, the blue
 *     hour), and the light that fills the shade: the same sky, blurred into an
 *     environment map (with the ground's bounce below the horizon), measured
 *     as a white card lying flat receives it — so the sun against the sky
 *     comes out of the physics (about seven to one at noon), not a table;
 *   - the moon in its phase: a lunar month of days passes as the days do, the
 *     moon rising about fifty minutes later each one; it lights the night (and
 *     the night sky, the same blue a few hundred times brighter than a real
 *     moon's, as night in films is), its strength by how much of it is lit;
 *   - the stars where they really are (stars.ts), the Milky Way across them,
 *     the night's own glow (airglow, and the town's light low down, brighter
 *     under cloud), all turning about the pole with the hours;
 *   - what the eye is told of the hour (the lens meters the picture itself,
 *     lens.ts): keep a sunset's gold, let the night stay dark;
 *   - the town: the street lamps switching on at dusk and off at dawn, the
 *     windows lighting one by one as it gets dark and most of them going
 *     out after midnight, a few early risers' before dawn.
 *
 * And the weather (weather.ts) on top: cloud takes the sun out of the light
 * (only an overcast sky does it everywhere at once; scattered clouds cast
 * their own shadows), its damp hazes the air, the sky that lights the world
 * carries the clouds, lightning lights everything for a moment. Each day is a
 * little different: the air a touch clearer or hazier.
 */
import {
  AmbientLight, BackSide, Color, DataUtils, DirectionalLight, Fog, HalfFloatType, Matrix3, MathUtils, Mesh, MeshBasicMaterial, MeshStandardMaterial,
  type Object3D, OrthographicCamera, type PerspectiveCamera, PMREMGenerator, PlaneGeometry, Scene, ShaderChunk, SphereGeometry, Vector3, WebGLRenderTarget, type WebGLRenderer,
} from 'three'
import { atmosphere, SUN_E } from './atmosphere'
import { moonDisc, starField } from './stars'

const LAT = MathUtils.degToRad(24), DEC = MathUtils.degToRad(15), MOON_DEC = MathUtils.degToRad(-6)
/** The sun's right ascension (hours) on the island's day — early May — which sets which stars are up when. */
const SUN_RA = 2.8
/** A lunar month, in days; the moon's phase on the first day (0 new, 0.5 full): a waxing gibbous, up in the evening. */
const MONTH = 29.53, PHASE0 = 0.38
/**
 * The moon's light against the sun's (relative to the sun's, for a full moon): a real one's is 1/400 000; the walk's
 * night is the films' night, about 300 times that, so a moonlit street reads dim and blue rather than black.
 */
const MOON_REL = 8e-4

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

/**
 * The sun's light on level ground against the whole clear sky's, by the sun's elevation (degrees): measured direct and
 * diffuse irradiance on a clear day, a little hazier for a humid sea-level island. Not used to light anything any
 * more (the atmosphere gives the ratio itself): the checks hold the physical sky to it.
 */
const RATIO_EL = [0, 1, 3, 6, 10, 20, 30, 45, 60, 90], RATIO = [0, 0.08, 0.28, 0.7, 1.4, 2.9, 4.0, 5.3, 6.4, 7.2]
export function sunToSky(el: number) {
  if (el <= 0) return 0
  for (let k = 1; k < RATIO_EL.length; k++) if (el <= RATIO_EL[k]) { const t = (el - RATIO_EL[k - 1]) / (RATIO_EL[k] - RATIO_EL[k - 1]); return RATIO[k - 1] + t * (RATIO[k] - RATIO[k - 1]) }
  return RATIO[RATIO.length - 1]
}

/** The moon's phase (0 new, 0.25 first quarter, 0.5 full) on a day of the walk at an hour; and how much of it is lit. */
export function moonPhase(day: number, hour: number) {
  const p = (((PHASE0 + (day + hour / 24) / MONTH) % 1) + 1) % 1
  return { phase: p, lit: (1 - Math.cos(p * Math.PI * 2)) / 2 }
}
/** When the moon crosses the meridian (hours): with the sun at new moon, at midnight when full, fifty minutes later a day. */
export const moonTransit = (phase: number) => (12 + phase * 24) % 24
/** The moon's place at an hour of a day of the walk (for the checks too). */
export const moonPlace = (day: number, hour: number) => place(hour, moonTransit(moonPhase(day, hour).phase), MOON_DEC)

/**
 * Shadows in two cascades: the sun's own shadow map, sharp, over the ground round you; a second, wide one (its light
 * gives nothing — it is only there for its map) over the whole island and the sea round it. Each fragment takes the
 * sharp one where it reaches, the wide one beyond, the two blended across the sharp one's last few texels so no
 * seam shows. Done once in three's shared light loop, so every material (the walk's own patches included) gets it.
 */
let cascaded = false
export function cascadeShadows() {
  if (cascaded) return
  cascaded = true
  const line = 'directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;'
  if (!ShaderChunk.lights_fragment_begin.includes(line)) { console.warn('walk: three changed its light loop; one shadow cascade only'); return }
  ShaderChunk.lights_fragment_begin = ShaderChunk.lights_fragment_begin.replace(line, /* glsl */ `
    #if UNROLLED_LOOP_INDEX == 0 && NUM_DIR_LIGHT_SHADOWS > 1
    if ( directLight.visible && receiveShadow ) {
      vec3 c0 = vDirectionalShadowCoord[ 0 ].xyz / vDirectionalShadowCoord[ 0 ].w;
      float f0 = smoothstep( 0.0, 0.05, min( min( c0.x, 1.0 - c0.x ), min( c0.y, 1.0 - c0.y ) ) ) * step( c0.z, 1.0 );
      float sNear = f0 > 0.0 ? getShadow( directionalShadowMap[ 0 ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ 0 ] ) : 1.0;
      float sFar = 1.0;
      if ( f0 < 1.0 ) {
        DirectionalLightShadow wide = directionalLightShadows[ 1 ];
        sFar = getShadow( directionalShadowMap[ 1 ], wide.shadowMapSize, wide.shadowIntensity, wide.shadowBias, wide.shadowRadius, vDirectionalShadowCoord[ 1 ] );
      }
      directLight.color *= mix( sFar, sNear, f0 );
    }
    #elif UNROLLED_LOOP_INDEX == 1 && NUM_DIR_LIGHT_SHADOWS > 1
    directLight.color *= 0.0;
    #else
    ${line}
    #endif`)
}

/** What the island's ground gives back of the light on it (grass, streets, sand and the sea, in the round). */
const GROUND_ALBEDO = new Color(0.11, 0.12, 0.1)

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

/** The sky turns with the hours: the matrix from the equatorial frame (stars, the galaxy) to the world, at a local sidereal time. */
export function skyTurn(lstHours: number, out = new Matrix3()) {
  const col = (ra: number, dec: number) => { const p = place(lstHours, ra, MathUtils.degToRad(dec)); return towards(p.el, p.az) }
  const x = col(0, 0), y = col(6, 0), z = new Vector3().crossVectors(x, y).normalize()
  return out.set(x.x, y.x, z.x, x.y, y.y, z.y, x.z, y.z, z.z)
}

export function daylight(scene: Scene, renderer: WebGLRenderer, opts: { shadowSize: number; reach: number; soft?: number; farReach?: number; farSize?: number }) {
  if (opts.farReach) cascadeShadows()
  const air = atmosphere(renderer)
  air.prepare()
  const sky = air.dome(true)
  scene.add(sky)
  // The sky also lights the world: blurred into an environment map, it is what the sea and the glass
  // reflect and the soft light that fills every shadow (made again as the sun moves).
  const pmrem = new PMREMGenerator(renderer)
  const envScene = new Scene()
  envScene.add(air.dome(false))
  // Below the horizon, the ground: what it gives back of the sun's and the sky's light on it (made as the light is measured).
  // (Inside the reach of the cube camera that renders it, which stops at a hundred.)
  const groundMat = new MeshBasicMaterial({ color: new Color(0.02, 0.022, 0.02), side: BackSide, fog: false })
  envScene.add(new Mesh(new SphereGeometry(80, 32, 8, 0, Math.PI * 2, Math.PI / 2 + 0.002, Math.PI / 2), groundMat))
  // The light measured: a white card lying flat, lit by nothing but the sky's environment, read back (only when it is made again).
  const card = new Scene(), cardMat = new MeshStandardMaterial({ color: '#ffffff', roughness: 1, metalness: 0 })
  const cardMesh = new Mesh(new PlaneGeometry(4, 4), cardMat); cardMesh.rotation.x = -Math.PI / 2; card.add(cardMesh)
  const cardCam = new OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.1, 10); cardCam.position.set(0, 5, 0); cardCam.lookAt(0, 0, 0)
  const cardRT = new WebGLRenderTarget(1, 1, { type: HalfFloatType, depthBuffer: false }), cardPx = new Uint16Array(4)
  /** What a flat white card receives from an environment: the sky's irradiance over pi (its luminance). */
  const measure = (env: WebGLRenderTarget) => {
    card.environment = env.texture
    const was = renderer.getRenderTarget()
    renderer.setRenderTarget(cardRT); renderer.render(card, cardCam); renderer.readRenderTargetPixels(cardRT, 0, 0, 1, 1, cardPx); renderer.setRenderTarget(was)
    const r = DataUtils.fromHalfFloat(cardPx[0]), g = DataUtils.fromHalfFloat(cardPx[1]), b = DataUtils.fromHalfFloat(cardPx[2])
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  /** The sky's light on level ground (as a white card's radiance) when last measured. */
  let skyCard = 3
  let envRT: WebGLRenderTarget | null = null, envSun = new Vector3(0, -2, 0), envMoon = new Vector3(0, -2, 0), envCover = -1, envHaze = -1, envMade = false

  const stars = starField()
  const moon = moonDisc(3.2)
  scene.add(stars.points, moon.mesh)

  // One light casts the shadows: the sun by day, the moon by night (they hand over in the dark of dusk).
  const light = new DirectionalLight('#fff3e2', 2.6)
  light.castShadow = true
  light.shadow.mapSize.set(opts.shadowSize, opts.shadowSize)
  const sc = light.shadow.camera; sc.left = -opts.reach; sc.right = opts.reach; sc.top = opts.reach; sc.bottom = -opts.reach; sc.near = 0.5; sc.far = 70
  light.shadow.radius = opts.soft ?? 3; light.shadow.bias = -0.0004; light.shadow.normalBias = 0.02
  scene.add(light, light.target)
  // The wide cascade's light: no light of its own, only its shadow map (made every few frames: far off, nothing
  // moves fast enough to tell).
  const far = new DirectionalLight('#ffffff', 0)
  if (opts.farReach) {
    far.castShadow = true
    far.shadow.mapSize.set(opts.farSize ?? 2048, opts.farSize ?? 2048)
    const fc = far.shadow.camera; fc.left = -opts.farReach; fc.right = opts.farReach; fc.top = opts.farReach; fc.bottom = -opts.farReach; fc.near = 0.5; fc.far = 90
    far.shadow.radius = 1.5; far.shadow.bias = -0.0008; far.shadow.normalBias = 0.05
    far.shadow.autoUpdate = false; far.shadow.needsUpdate = true
    scene.add(far, far.target)
  }
  // Lightning lights everything for a moment.
  const amb = new AmbientLight('#dfe6ff', 0)
  scene.add(amb)
  // The haze's colour (no longer the scene's fog — the lens lays the air over the picture — but the weather's own
  // clouds for the sky that lights the world, and the old flat clouds on the lowest level, still fade into it).
  const fog = new Fog('#c9dbe8', 14, 70)

  const C = (h: string) => new Color(h), skyTint = new Color(), tmp = new Color()
  const MOON = C('#c3cde8')
  const FOG_DAY = C('#c9dbe8'), FOG_GOLD = C('#ddd0cc'), FOG_DUSK = C('#56617f'), FOG_NIGHT = C('#0d1424'), FOG_GREY = C('#a7b1bb')
  const HEMI_DAY = C('#bcd4f0'), HEMI_NIGHT = C('#3d4866'), HEMI_GREY = C('#c2cad3')
  const NIGHT_GLOW = new Color(0.0012, 0.0016, 0.0028), TOWN = new Color(0.0035, 0.0022, 0.0012)

  const state = {
    hour: 16.5,
    /** Which day of the walk it is (the moon's phase moves on with them; the air differs a little). */
    date: 0,
    /** The sun's and the moon's directions, towards them. */
    sunDir: new Vector3(), moonDir: new Vector3(), lightDir: new Vector3(),
    sunEl: 0, moonEl: 0,
    /** The moon's phase (0 new, 0.5 full) and how much of it is lit. */
    phase: 0, moonLit: 0,
    /** 0 at night, 1 in daylight. */
    day: 1,
    /** How golden the light is (the hour after sunrise and before sunset). */
    gold: 0,
    lamps: false, lampGlow: 0, homes: 0,
    /** What the eye is told (lens.ts): a compensation in stops, and the dimmest light it opens fully to (log2). */
    comp: 0, floor: -4,
    /** The sky's light on level ground and the sun's (or the moon's), as a white card's brightness. */
    skyCard: 0, sunCard: 0,
    /** The sun's (or the moon's) light at the clouds: its colour times its strength. */
    lightAtClouds: new Color(),
    /** The air's haze (1 a textbook clear sky; the island's humid air about 22; rain and cloud more). */
    haze: 22,
    /** The morning's mist (0 to 1): over the sea and the low ground at dawn, burning off. */
    mist: 0,
    /** The weather's say (weather.ts): how much of the sky is cloud, how hard it rains, a lightning flash. */
    cover: 0, rain: 0, flash: 0,
    /** The clouds' colours (the flat clouds' and the sky that lights the world's): lit by the sun or the moon, and in their own shade. */
    cloudLit: new Color(), cloudShade: new Color(),
  }

  let lastHour = 16.5
  const eq = new Matrix3()
  const set = (hour: number) => {
    const h = ((hour % 24) + 24) % 24
    // (Past midnight, the next day.)
    if (h < lastHour - 12) state.date++
    else if (h > lastHour + 12) state.date = Math.max(0, state.date - 1)
    lastHour = h
    state.hour = h
    const s = place(h, 12, DEC), ph = moonPhase(state.date, h), m = place(h, moonTransit(ph.phase), MOON_DEC)
    state.phase = ph.phase; state.moonLit = ph.lit
    state.sunEl = s.el; state.moonEl = m.el
    towards(s.el, s.az, state.sunDir); towards(m.el, m.az, state.moonDir)
    const e = s.el
    // (Twilight lingers: the sky lights the world for a while after the sun has gone.)
    const day = smooth(-9, 5, e), gold = smooth(-2, 3, e) * (1 - smooth(6, 22, e))
    state.day = day; state.gold = gold
    const cv = state.cover, dim = 1 - 0.86 * smooth(0.55, 1, cv)
    // The air: the island's humid sea haze (an aerosol optical depth of about 0.12, against a textbook clear sky's
    // 0.005 — visibility some twenty-five kilometres), a little different each day, heavier with cloud, much heavier in rain.
    const daily = 0.85 + 0.3 * (Math.sin(state.date * 12.9898) * 43758.5453 % 1 + 1) % 1
    state.haze = 22 * daily * (1 + 0.6 * cv) + 60 * state.rain
    air.haze.value = Math.round(state.haze * 4) / 4
    // The morning mist: from before dawn, burning off as the sun climbs; none in a wind (the weather's cover stands in).
    state.mist = smooth(1.5, 6, h) * (1 - smooth(6.6, 8.8, h)) * (1 - 0.6 * cv) + 0.35 * state.rain
    // The light: whatever of the sun's gets through the air (and the cloud); the moon's, by how much of it is lit.
    air.through(state.sunDir, tmp)
    const sunMax = Math.max(tmp.r, tmp.g, tmp.b), sunI = SUN_E * sunMax * dim
    const moonT = air.through(state.moonDir, new Color()), moonMax = Math.max(moonT.r, moonT.g, moonT.b)
    const moonI = SUN_E * MOON_REL * (0.15 + 0.85 * ph.lit) * moonMax * dim * smooth(-1, 6, m.el)
    if (sunI >= moonI) {
      light.intensity = sunI; if (sunMax > 0) light.color.setRGB(tmp.r / sunMax, tmp.g / sunMax, tmp.b / sunMax); state.lightDir.copy(state.sunDir)
    } else {
      light.intensity = moonI; light.color.copy(MOON).multiply(tmp.setRGB(moonT.r, moonT.g, moonT.b).multiplyScalar(1 / Math.max(moonMax, 1e-4))); state.lightDir.copy(state.moonDir)
    }
    state.lightAtClouds.copy(light.color).multiplyScalar(light.intensity / Math.max(dim, 0.14))
    state.sunCard = (light.intensity * Math.max(0, state.lightDir.y)) / Math.PI
    // The stars come out as it gets dark, the brighter first; the sky turns about the pole (the local sidereal time).
    skyTurn(h - 12 + SUN_RA, eq)
    stars.mat.uniforms.uEq.value.copy(eq)
    stars.mat.uniforms.uShow.value = smooth(-2, -12, e) * (1 - smooth(0.35, 0.9, cv))
    stars.points.visible = stars.mat.uniforms.uShow.value > 0.001
    const su = air.skyMat.uniforms
    su.uEq.value.copy(eq).transpose()
    // The night's own glow, and the town's (brighter on a cloud base); the Milky Way, washed out by the moon.
    const dark = smooth(-6, -15, e)
    su.uNight.value.copy(NIGHT_GLOW).multiplyScalar(dark * (1 - 0.5 * cv))
    su.uTown.value.copy(TOWN).multiplyScalar(dark * (1 + 2 * cv))
    su.uMilky.value = 0.016 * dark * (1 - 0.75 * ph.lit * smooth(-2, 15, m.el)) * (1 - smooth(0.3, 0.8, cv))
    // The moon: lit from where the sun is; as bright, against the night, as the eye expects of it.
    const mu = moon.mat.uniforms
    mu.uSun.value.copy(state.sunDir)
    mu.uBright.value = 2.2 * smooth(-3, 2, m.el) * (1 - 0.9 * smooth(0.6, 1, cv))
    mu.uTint.value.setRGB(moonT.r, moonT.g, moonT.b).multiplyScalar(1 / Math.max(moonMax, 1e-4)).lerp(tmp.setRGB(1, 1, 1), 0.5)
    moon.mesh.visible = mu.uBright.value > 0.001
    // (The sky's colour, for the flat clouds' shade.)
    skyTint.copy(HEMI_NIGHT).lerp(HEMI_DAY, day).lerp(HEMI_GREY, cv * 0.75 * day)
    amb.intensity = state.flash * Math.PI * Math.max(skyCard * 0.4, 0.05)
    fog.color.copy(FOG_NIGHT).lerp(FOG_DUSK, smooth(-10, -3, e)).lerp(FOG_DAY, day).lerp(FOG_GOLD, gold * 0.6 * (1 - cv)).lerp(FOG_GREY.clone().multiplyScalar(0.35 + 0.65 * day), cv * 0.7)
    const fl = 0.2126 * fog.color.r + 0.7152 * fog.color.g + 0.0722 * fog.color.b
    fog.color.multiplyScalar((0.5 * skyCard + 0.1 * state.sunCard) / Math.max(fl, 1e-4))
    // The flat clouds' colours (the lowest level's, and the sky that lights the world's): the light's own where it reaches them.
    state.cloudLit.copy(light.color).multiplyScalar((light.intensity / SUN_E) * 9 + 0.3 * skyCard * smooth(-12, -2, e))
    state.cloudShade.copy(skyTint).multiplyScalar(1.3 * skyCard * (1 - 0.35 * cv) * (1 - 0.35 * state.rain))
    // What the eye is told: keep a sunset's gold (a third of a stop up); let the dusk and the night stay darker than the
    // day; and however dark it gets, the eye opens only so far — at night about eight stops past the day's (noon meters
    // near 2.3), so a moonlit street stays dim and blue and a lamp's pool reads as light.
    const dusk = smooth(3, -5, e), night = smooth(-5, -12, e)
    state.comp = 0.35 * gold - 0.7 * dusk * (1 - night) - 1.2 * night - 0.25 * cv * day
    state.floor = -6 - 1.5 * dusk * (1 - night)
    // Street lamps: on as the sun goes down, off once it is up (a little apart, as their switches are).
    if (e < 1.5) state.lamps = true
    else if (e > 4) state.lamps = false
    state.homes = smooth(7, -4, e) * homesLit(h)
    scene.environmentIntensity = 1
  }
  set(state.hour)

  const invVP = new Matrix3(), rot = new Matrix3(), diag = new Matrix3()
  return {
    state, light, far, sky, stars: stars.points, moon: moon.mesh, air, fog,
    set,
    /** Something more for the sky that lights the world to carry (the clouds). */
    addToSky(o: Object3D) { envScene.add(o); envCover = -1 },
    /**
     * Each frame, before the picture: the sky from where the camera is, the haze through the picture, the sky's light
     * on the world (made again as the sun or the moon moves, the cloud or the haze changes), the stars and the moon at
     * infinity round the camera, the lamps fading on or off.
     */
    frame(camera: PerspectiveCamera, dt: number, o: { still: boolean; time: number; pixels: number }) {
      // (The picture's corners to the world's directions, from the camera without its sub-pixel offset.)
      const th = Math.tan(MathUtils.degToRad(camera.fov / 2))
      rot.setFromMatrix4(camera.matrixWorld)
      diag.set(th * camera.aspect, 0, 0, 0, th, 0, 0, 0, -1)
      invVP.multiplyMatrices(rot, diag)
      air.update({ toSun: state.sunDir, toMoon: state.moonDir, moonE: MOON_REL * (0.15 + 0.85 * state.moonLit), camY: camera.position.y, invViewProj: invVP, apMax: 6 })
      // The sky's light on the world: made again when the sun has moved a degree, the moon three, or the weather changed.
      if (!envMade || envSun.angleTo(state.sunDir) > 0.021 || (state.sunEl < -4 && envMoon.angleTo(state.moonDir) > 0.05) || Math.abs(state.cover - envCover) > 0.06 || Math.abs(air.haze.value - envHaze) > 0.1) {
        envSun.copy(state.sunDir); envMoon.copy(state.moonDir); envCover = state.cover; envHaze = air.haze.value
        groundMat.color.copy(GROUND_ALBEDO).multiplyScalar(skyCard + state.sunCard)
        envRT?.dispose(); envRT = pmrem.fromScene(envScene, 0, 0.1, 100, { size: 128 })
        skyCard = measure(envRT)
        // (The first time, once more with the ground's bounce measured in.)
        if (!envMade) { groundMat.color.copy(GROUND_ALBEDO).multiplyScalar(skyCard + state.sunCard); envRT.dispose(); envRT = pmrem.fromScene(envScene, 0, 0.1, 100, { size: 128 }); skyCard = measure(envRT) }
        envMade = true
        scene.environment = envRT.texture
        state.skyCard = skyCard
      }
      sky.position.copy(camera.position)
      stars.points.position.copy(camera.position)
      stars.mat.uniforms.uTime.value = o.time; stars.mat.uniforms.uTwinkle.value = o.still ? 0 : 1; stars.mat.uniforms.uPR.value = o.pixels
      moon.mesh.position.copy(camera.position).addScaledVector(state.moonDir, 400)
      state.lampGlow += ((state.lamps ? 1 : 0) - state.lampGlow) * Math.min(1, dt * 2.5)
    },
    dispose() { envRT?.dispose(); pmrem.dispose(); cardRT.dispose(); air.dispose() },
  }
}
