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
 *   - the air: the haze's colour; and what the eye is told of the hour (the lens
 *     meters the picture itself, lens.ts): at night to stay dark, at sunset
 *     to keep its gold;
 *   - the light in proportion, as it is outdoors: the sky's own light (its
 *     environment map, the ground's bounce below the horizon) measured each
 *     time it is made — what a white card lying flat receives from it — and
 *     the sun set against that from real daylight: on a clear noon the sun
 *     gives a flat card about seven times what the whole sky does, at 20°
 *     about three times, at the horizon nothing; the moon about six times the
 *     night sky's glow;
 *   - the town: the street lamps switching on at dusk and off at dawn, the
 *     windows lighting one by one as it gets dark and most of them going
 *     out after midnight, a few early risers' before dawn.
 *
 * And the weather (weather.ts) on top: cloud takes the sun out of the light
 * (only an overcast sky does it everywhere at once; scattered clouds cast
 * their own shadows) and lets the sky's grey fill it instead, the haze
 * greys, the sky that lights the world carries the clouds, lightning lights
 * everything for a moment.
 */
import {
  AmbientLight, BackSide, ShaderChunk, type Object3D, BufferGeometry, ShaderMaterial, Color, DataUtils, DirectionalLight, Float32BufferAttribute, Fog, HalfFloatType, HemisphereLight, MathUtils, Mesh,
  MeshBasicMaterial, MeshStandardMaterial, OrthographicCamera, PMREMGenerator, PlaneGeometry, Points, PointsMaterial, Scene, SphereGeometry, Vector3, WebGLRenderTarget, type WebGLRenderer,
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

/**
 * The sun's light on level ground against the whole clear sky's, by the sun's elevation (degrees): measured direct
 * and diffuse irradiance on a clear day, a little hazier for a humid sea-level island (about 0.8 of a dry
 * continental sky's ratios). At the zenith about 7, at 20° about 3, at 3° a third, at the horizon none.
 */
const RATIO_EL = [0, 1, 3, 6, 10, 20, 30, 45, 60, 90], RATIO = [0, 0.08, 0.28, 0.7, 1.4, 2.9, 4.0, 5.3, 6.4, 7.2]
export function sunToSky(el: number) {
  if (el <= 0) return 0
  for (let k = 1; k < RATIO_EL.length; k++) if (el <= RATIO_EL[k]) { const t = (el - RATIO_EL[k - 1]) / (RATIO_EL[k] - RATIO_EL[k - 1]); return RATIO[k - 1] + t * (RATIO[k] - RATIO[k - 1]) }
  return RATIO[RATIO.length - 1]
}
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

export function daylight(scene: Scene, renderer: WebGLRenderer, opts: { shadowSize: number; reach: number; soft?: number; farReach?: number; farSize?: number }) {
  if (opts.farReach) cascadeShadows()
  const sky = new Sky()
  sky.scale.setScalar(4000)
  const su = sky.material.uniforms
  su.mieDirectionalG.value = 0.88; su.mieCoefficient.value = 0.004; su.cloudCoverage.value = 0
  scene.add(sky)
  // The sky also lights the world: blurred into an environment map, it is what the sea and the glass
  // reflect and the soft light that fills every shadow (made again as the sun moves).
  const pmrem = new PMREMGenerator(renderer)
  const envScene = new Scene(), envSky = new Sky()
  // (Its own copy of the sky, without the sun's disc: the sun lights the world itself, and in the sky's light too it would count twice.)
  envSky.material = sky.material.clone(); envSky.material.uniforms.showSunDisc.value = 0; envSky.scale.setScalar(1000); envScene.add(envSky)
  // Below the horizon, the ground: what it gives back of the sun's and the sky's light on it (made as the light is measured).
  const groundMat = new MeshBasicMaterial({ color: new Color(0.02, 0.022, 0.02), side: BackSide, fog: false })
  const ground = new Mesh(new SphereGeometry(900, 32, 8, 0, Math.PI * 2, Math.PI / 2 + 0.002, Math.PI / 2), groundMat)
  envScene.add(ground)
  const nightEnv = new Scene(); nightEnv.background = new Color('#1b2a52')
  const nightGround = new Mesh(ground.geometry, groundMat); nightEnv.add(nightGround)
  // The light measured: a white card lying flat, lit by nothing but the sky's environment, read back (only when it is made again).
  const card = new Scene(), cardMat = new MeshStandardMaterial({ color: '#ffffff', roughness: 1, metalness: 0 })
  const cardMesh = new Mesh(new PlaneGeometry(4, 4), cardMat); cardMesh.rotation.x = -Math.PI / 2; card.add(cardMesh)
  const cardCam = new OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.1, 10); cardCam.position.set(0, 5, 0); cardCam.lookAt(0, 0, 0)
  const cardRT = new WebGLRenderTarget(1, 1, { type: HalfFloatType, depthBuffer: false }), cardPx = new Uint16Array(4)
  /** What a flat white card receives from an environment: the sky's irradiance over pi, per colour (the luminance of it returned). */
  const measure = (env: WebGLRenderTarget) => {
    card.environment = env.texture
    const was = renderer.getRenderTarget()
    renderer.setRenderTarget(cardRT); renderer.render(card, cardCam); renderer.readRenderTargetPixels(cardRT, 0, 0, 1, 1, cardPx); renderer.setRenderTarget(was)
    const r = DataUtils.fromHalfFloat(cardPx[0]), g = DataUtils.fromHalfFloat(cardPx[1]), b = DataUtils.fromHalfFloat(cardPx[2])
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  /** The sky's light on level ground (as a white card's radiance) when last measured, and the night's. */
  let skyCard = 0.3, nightCard = 0.003
  let envRT: WebGLRenderTarget | null = null, envAt = -999, envNight: boolean | null = null, envCover = -1

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
  // (And in the sky that lights the world, so the blue hour's light is blue.)
  envScene.add(new Mesh(dome.geometry, domeMat))
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
  const hemi = new HemisphereLight('#bcd4f0', '#7d8a6a', 0.6)
  const amb = new AmbientLight('#ffffff', 0.12)
  scene.add(hemi, amb)
  const fog = new Fog('#c9dbe8', 14, 70)
  scene.fog = fog
  const nightBg = new Color('#0b1430')

  const C = (h: string) => new Color(h), skyTint = new Color()
  const SUN_HIGH = C('#fff4e8'), SUN_LOW = C('#ffcfaa'), MOON = C('#c3cde8')
  const FOG_DAY = C('#c9dbe8'), FOG_GOLD = C('#ddd0cc'), FOG_DUSK = C('#56617f'), FOG_NIGHT = C('#0d1424')
  const HEMI_DAY = C('#bcd4f0'), HEMI_NIGHT = C('#3d4866'), GROUND_DAY = C('#7d8a6a'), GROUND_NIGHT = C('#1a1e28'), HEMI_GREY = C('#c2cad3'), FOG_GREY = C('#a7b1bb'), NIGHT_ENV = C('#1b2a52')

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
    /** What the eye is told (lens.ts): a compensation in stops, and the dimmest light it opens fully to (log2). */
    comp: 0, floor: -4,
    /** The sky's light on level ground and the sun's (or the moon's), as a white card's brightness: for the checks. */
    skyCard: 0, sunCard: 0,
    /** The weather's say (weather.ts): how much of the sky is cloud, how hard it rains, a lightning flash. */
    cover: 0, rain: 0, flash: 0,
    /** The clouds' colours: lit by the sun (or the moon), and in their own shade. */
    cloudLit: new Color(), cloudShade: new Color(),
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
    const cv = state.cover, dim = 1 - 0.86 * smooth(0.55, 1, cv)
    // The sky: scattering more, and redder, through more air at sunrise and sunset; the night's dark under it.
    const low = 1 - smooth(4, 25, e)
    su.turbidity.value = 4 + 2 * low + 8 * cv; su.rayleigh.value = (1.6 + 1.0 * low) * (1 - 0.5 * cv)
    su.sunPosition.value.copy(state.sunDir)
    const eu = envSky.material.uniforms
    for (const k of ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG'] as const) eu[k].value = su[k].value
    eu.sunPosition.value.copy(state.sunDir)
    // The sun's and the moon's strength against the sky's own light (measured when the sky's light is made, below).
    const sunRatio = sunToSky(e) * dim, moonRatio = 6 * smooth(-2, -9, e) * smooth(-2, 10, m.el) * dim
    const moonUp = moonRatio > 0 && sunRatio < 0.02
    // The sky's light on the world, made again as the sun moves (or for the night, once), and measured.
    const nightNow = e < -9
    if (nightNow !== envNight || (!nightNow && Math.abs(e - envAt) > 1.2) || Math.abs(cv - envCover) > 0.06) {
      envNight = nightNow; envAt = e; envCover = cv
      nightEnv.background = NIGHT_ENV.clone().multiplyScalar(0.12 * (1 - 0.5 * cv))
      for (let pass = 0; pass < (envRT ? 1 : 2); pass++) {
        // (The ground below the horizon gives back what lands on it; the first time, measured again once it is in.)
        const card = nightNow ? nightCard : skyCard, ratio = nightNow ? moonRatio : sunRatio
        groundMat.color.copy(GROUND_ALBEDO).multiplyScalar(card * (1 + ratio))
        envRT?.dispose(); envRT = pmrem.fromScene(nightNow ? nightEnv : envScene)
        const v = measure(envRT)
        if (nightNow) nightCard = v; else skyCard = v
      }
      scene.environment = envRT!.texture
    }
    // The light: the sun's, warmer and weaker low down (and as strong as the sky makes it); the moon's, cool and faint.
    const skyNow = nightNow ? nightCard : skyCard
    const sunI = (sunRatio * Math.PI * skyCard) / Math.max(Math.sin(MathUtils.degToRad(e)), 0.02)
    const moonI = (moonRatio * Math.PI * skyNow) / Math.max(Math.sin(MathUtils.degToRad(m.el)), 0.05)
    if (!moonUp) {
      light.intensity = sunI; light.color.copy(SUN_LOW).lerp(SUN_HIGH, smooth(3, 30, e)); state.lightDir.copy(state.sunDir)
    } else {
      light.intensity = moonI; light.color.copy(MOON); state.lightDir.copy(state.moonDir)
    }
    state.skyCard = skyNow; state.sunCard = (light.intensity * Math.max(0, state.lightDir.y)) / Math.PI
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
    starMat.opacity = 0.9 * smooth(-3, -12, e) * (1 - smooth(0.3, 0.85, state.cover))
    stars.visible = starMat.opacity > 0.01
    stars.rotation.set(-(Math.PI / 2 - LAT), 0, 0); stars.rotateY((state.hour / 24) * Math.PI * 2)
    moonMat.opacity = smooth(-4, 3, m.el) * (0.35 + 0.65 * (1 - day)) * (1 - 0.85 * smooth(0.6, 1, state.cover))
    moon.visible = moonMat.opacity > 0.01
    // (Under cloud the sky's grey light is most of what there is.)
    // (The sky's colour, for the clouds' shade; lightning lights everything for a moment, as bright as a dull day.)
    skyTint.copy(HEMI_NIGHT).lerp(HEMI_DAY, day).lerp(HEMI_GREY, cv * 0.75 * day)
    hemi.intensity = 0; amb.intensity = state.flash * Math.PI * Math.max(skyCard * 0.4, nightCard * 60)
    fog.color.copy(FOG_NIGHT).lerp(FOG_DUSK, smooth(-10, -3, e)).lerp(FOG_DAY, day).lerp(FOG_GOLD, gold * 0.6 * (1 - cv)).lerp(FOG_GREY.clone().multiplyScalar(0.35 + 0.65 * day), cv * 0.7)
    fog.color.multiplyScalar(1 - 0.25 * state.rain)
    // (Its hue from the hour; its brightness that of lit air in the same light as everything else: about what a pale
    // surface in the open gives back.)
    const fl = 0.2126 * fog.color.r + 0.7152 * fog.color.g + 0.0722 * fog.color.b
    fog.color.multiplyScalar((0.5 * (nightNow ? nightCard : skyCard) + 0.1 * state.sunCard) / Math.max(fl, 1e-4))
    // The clouds' colours: the light's own where it reaches them, a grey of the sky's in their shade; dark at night.
    state.cloudLit.copy(light.color).multiplyScalar((sunI >= moonI ? 2.3 * smooth(-3, 10, e) + 0.3 * smooth(-12, -2, e) : 0.07) * (1 - 0.5 * cv))
    state.cloudShade.copy(skyTint).multiplyScalar((0.12 + 1.0 * day) * (1 - 0.35 * cv) * (1 - 0.35 * state.rain))
    // What the eye is told: keep a sunset's gold (a third of a stop up); let the dusk and the night stay darker than the
    // day (over a stop down); and however dark it gets, the eye opens only so far — about eight stops past the day's
    // (noon meters near 2.3) at night, so a moonlit street stays dim and blue and a lamp's pool reads as light, but
    // further at dusk, when the sky is still bright to an eye and the sky here goes dark too soon.
    const dusk = smooth(3, -5, e), night = smooth(-5, -12, e)
    state.comp = 0.35 * gold - 1.1 * dusk * (1 - night) - 1.2 * night - 0.25 * cv * day
    state.floor = -6 - 1.5 * dusk * (1 - night)
    // Street lamps: on as the sun goes down, off once it is up (a little apart, as their switches are).
    if (e < 1.5) state.lamps = true
    else if (e > 4) state.lamps = false
    state.homes = smooth(7, -4, e) * homesLit(state.hour)
    scene.environmentIntensity = 1
  }
  set(state.hour)

  return {
    state, light, far, sky, stars, moon,
    set,
    /** Something more for the sky that lights the world to carry (the clouds). */
    addToSky(o: Object3D) { envScene.add(o); envAt = -999 },
    /** Each frame: the stars and the moon stay at infinity round the camera; the lamps fade on or off. */
    follow(camera: Vector3, dt: number) {
      stars.position.copy(camera); dome.position.copy(camera)
      moon.position.copy(camera).addScaledVector(state.moonDir, 400)
      state.lampGlow += ((state.lamps ? 1 : 0) - state.lampGlow) * Math.min(1, dt * 2.5)
    },
    dispose() { envRT?.dispose(); pmrem.dispose(); cardRT.dispose() },
  }
}
