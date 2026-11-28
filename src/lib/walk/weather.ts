/**
 * The walk's weather (walker.ts): the clouds, the rain, the wind, and how wet
 * it all gets.
 *
 * It goes through spells of its own — clear, fair-weather clouds, overcast,
 * rain, now and then a storm — each lasting a few minutes and passing into
 * the next over a minute or so; or you choose one (the clock's panel, or
 * ?w=rain). What each brings:
 *
 *   - clouds: a layer some five hundred metres up, drifting with the wind,
 *     its cumulus lit on the side towards the sun and grey underneath, a
 *     silver edge where the sun is behind one; thickening to a ceiling of grey
 *     when it is overcast. They cast their shadows on the island (a sheet
 *     only the sun's shadow sees, carrying the clouds' own pattern, so the
 *     shadows that sweep over the streets are of the clouds overhead), and an
 *     overcast sky takes the sun out of the light altogether; the sky that
 *     lights the world (daylight.ts) carries them too;
 *   - rain: streaks falling past you at a raindrop's speed (nine metres a
 *     second), slanting with the wind, splashes where they land; rings in the
 *     puddles and on the sea;
 *   - wet: the ground and the walls darken and shine as it soaks in, puddles
 *     gather on the streets and the paving, and it all dries slowly once the
 *     rain stops (wet.ts; the shaders read it);
 *   - wind: the trees and the grass bend harder, the sea gets choppier and
 *     its swell higher, the clouds and the rain go with it; it veers slowly;
 *   - in a storm, lightning: the clouds and the town lit white for a moment.
 */
import {
  AdditiveBlending, BackSide, BufferGeometry, CanvasTexture, Color, DirectionalLight, Float32BufferAttribute, Mesh, MeshDepthMaterial, PlaneGeometry, Points, PointsMaterial,
  RGBADepthPacking, ShaderMaterial, SphereGeometry, Vector3, type Scene, HalfFloatType, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, WebGLRenderTarget, type WebGLRenderer,
} from 'three'
import { wetness } from './wet'
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js'

export type WeatherKind = 'clear' | 'cloudy' | 'overcast' | 'rain' | 'storm'
/** What each spell brings: how much of the sky is cloud, how hard it rains, how hard the wind blows (0 to 1). */
const LOOKS: Record<WeatherKind, { cover: number; rain: number; wind: number }> = {
  clear: { cover: 0.12, rain: 0, wind: 0.3 },
  cloudy: { cover: 0.5, rain: 0, wind: 0.5 },
  overcast: { cover: 0.9, rain: 0, wind: 0.55 },
  rain: { cover: 0.96, rain: 0.62, wind: 0.7 },
  storm: { cover: 1, rain: 1, wind: 1 },
}
export const WEATHERS = Object.keys(LOOKS) as WeatherKind[]
/** How the spells follow one another, left to themselves (each a few minutes). */
const NEXT: Record<WeatherKind, [WeatherKind, number][]> = {
  clear: [['clear', 2], ['cloudy', 3]],
  cloudy: [['clear', 2], ['cloudy', 1], ['overcast', 2]],
  overcast: [['cloudy', 2], ['rain', 3]],
  rain: [['overcast', 2], ['rain', 1], ['storm', 1]],
  storm: [['rain', 3]],
}

/** The cloud layer's height (world units: about five hundred metres), and its pattern's scale. */
export const H = 55, SCALE = 0.022
/** The clouds' pattern repeats every so many of its own units (far wider than anything seen at once), so it can be one texture. */
export const PERIOD = 64

/**
 * The clouds' pattern, as the shaders and the page both work it out: value noise in five octaves, repeating every
 * PERIOD, thresholded by the cover. Made once into a texture (cloudField) that everything cloudy reads: the flat
 * clouds, their shadows on the ground and the volumetric ones (clouds.ts); the processor works out the same pattern
 * (for the sun's glare behind a cloud, and the checks).
 */
const hash = (x: number, y: number) => { const a = (x * 127.1 + y * 311.7), s = Math.sin(a) * 43758.5453; return s - Math.floor(s) }
const wrap = (v: number, p: number) => ((v % p) + p) % p
const vnoise = (x: number, y: number, per: number) => {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy)
  const x0 = wrap(ix, per), x1 = wrap(ix + 1, per), y0 = wrap(iy, per), y1 = wrap(iy + 1, per)
  const a = hash(x0, y0), b = hash(x1, y0), c = hash(x0, y1), d = hash(x1, y1)
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy
}
export const fbm = (x: number, y: number) => { let v = 0, a = 0.5, f = 1; for (let k = 0; k < 5; k++) { v += a * vnoise(x * f + k * 7, y * f + k * 3, PERIOD * f); f *= 2; a *= 0.5 } return v / 0.96875 }
export const thresh = (cover: number) => 0.78 - 0.66 * cover

/** The pattern, made into a texture on the graphics card (once): PERIOD of its units across, sixteen texels to one. */
export const FIELD_GLSL = /* glsl */ `
  float cHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float cNoise(vec2 p, float per) {
    vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    vec2 i0 = mod(i, per), i1 = mod(i + 1.0, per);
    float a = cHash(i0), b = cHash(vec2(i1.x, i0.y)), c = cHash(vec2(i0.x, i1.y)), d = cHash(i1);
    return a + (b - a) * u.x + (c - a) * u.y + (a - b - c + d) * u.x * u.y;
  }
  float cFbm(vec2 p) { float v = 0.0, a = 0.5, f = 1.0; for (int k = 0; k < 5; k++) { v += a * cNoise(p * f + vec2(float(k) * 7.0, float(k) * 3.0), ${PERIOD.toFixed(1)} * f); f *= 2.0; a *= 0.5; } return v / 0.96875; }
`
export function cloudField(renderer: WebGLRenderer) {
  const rt = new WebGLRenderTarget(1024, 1024, { type: HalfFloatType, wrapS: RepeatWrapping, wrapT: RepeatWrapping, generateMipmaps: true, minFilter: LinearMipmapLinearFilter, magFilter: LinearFilter, depthBuffer: false })
  const m = new ShaderMaterial({
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: FIELD_GLSL + `varying vec2 vUv; void main() { gl_FragColor = vec4(cFbm((vUv - 0.5 / 1024.0) * ${PERIOD.toFixed(1)}), 0.0, 0.0, 1.0); }`,
  })
  const q = new FullScreenQuad(m), was = renderer.getRenderTarget()
  renderer.setRenderTarget(rt); q.render(renderer); renderer.setRenderTarget(was)
  q.dispose(); m.dispose()
  return rt
}

export const CLOUD_GLSL = /* glsl */ `
uniform float uCover;
uniform vec3 uDrift;
uniform sampler2D tCloudField;
/** How much cloud is over a point of the world (0 clear sky, 1 thick). */
float cloudField(vec2 w) { return texture2D(tCloudField, (w * ${SCALE.toFixed(4)} + uDrift.xy) / ${PERIOD.toFixed(1)}).r; }
float cloudAt(vec2 w) {
  float th = 0.78 - 0.66 * uCover;
  return smoothstep(th, th + 0.2, cloudField(w));
}
`

export type Weather = ReturnType<typeof weather>

export function weather(scene: Scene, o: { light: DirectionalLight; phone: boolean; still: boolean; start?: string | null; renderer?: WebGLRenderer }) {
  const state = {
    kind: 'clear' as WeatherKind, auto: true,
    cover: 0.12, rain: 0, wind: 0.3,
    /** Which way the wind blows (a unit vector, x and z), and its gusts now. */
    dir: new Vector3(0.94, 0, 0.33), gust: 0,
    /** A lightning flash, fading (0 to 1). */
    flash: 0,
  }
  const start = o.start && (o.start in LOOKS) ? (o.start as WeatherKind) : null
  if (start) { state.kind = start; state.auto = false; Object.assign(state, { ...LOOKS[start] }); wetness.wet.value = LOOKS[start].rain > 0 ? 0.85 : 0 }
  let spell = 150 + Math.random() * 120, nextFlash = 6, second = -1, t = 0
  // Less motion asked for (no lightning); how much of the rain is drawn (the quality level's).
  let still = o.still, density = 1
  const cover = { value: state.cover }
  const driftUv = { value: new Vector3(Math.random() * 50, Math.random() * 50, 0) }
  // The clouds' pattern as a texture (none in the checks, which have no graphics card).
  const field = o.renderer ? cloudField(o.renderer) : null
  const fieldTex = { value: field?.texture ?? null }

  /* ---- the clouds: a dome round the camera, each ray meeting the layer overhead ---- */
  const cloudMat = new ShaderMaterial({
    uniforms: {
      uCover: cover, uDrift: { value: driftUv.value }, tCloudField: fieldTex, uCam: { value: new Vector3() }, uSun: { value: new Vector3(0, 1, 0) },
      uLit: { value: new Color() }, uShade: { value: new Color() }, uHaze: { value: new Color() }, uFlash: { value: 0 },
    },
    vertexShader: 'varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: CLOUD_GLSL + /* glsl */ `
      uniform vec3 uCam, uSun, uLit, uShade, uHaze; uniform float uFlash;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        if (d.y < 0.002) discard;
        vec2 w = uCam.xz + d.xz * (${H.toFixed(1)} - uCam.y) / d.y;
        // (A heavy sky closes into one grey ceiling, its texture only a little lighter and darker.)
        float sheetK = smoothstep(0.7, 1.0, uCover);
        float den = mix(cloudAt(w), 0.92 + 0.08 * cloudAt(w * 2.3), sheetK);
        // Light through the cloud: thinner towards the sun's side, so lit there and grey underneath.
        vec2 sd = normalize(uSun.xz + 1e-4);
        float occ = cloudAt(w + sd * 6.0) + cloudAt(w + sd * 14.0) * 0.7 + cloudAt(w + sd * 26.0) * 0.5;
        float lit = exp(-occ * 0.9) * smoothstep(-0.1, 0.25, uSun.y) * (1.0 - 0.8 * sheetK);
        vec3 col = mix(uShade, uLit, 0.18 + 0.82 * lit);
        // Thick cloud is darker at its base; thin edges let the light through, silver where the sun is behind them.
        col *= mix(1.0, 0.68, smoothstep(0.45, 1.0, den) * uCover);
        float toward = pow(max(dot(d, normalize(uSun)), 0.0), 10.0);
        col += uLit * toward * (1.0 - den) * den * 4.0 * (1.0 - sheetK);
        col += vec3(0.75, 0.8, 0.95) * uFlash * (0.5 + den);
        float a = smoothstep(0.0, 0.4, den);
        // Into the haze at the horizon.
        float hz = smoothstep(0.0, 0.2, d.y);
        col = mix(uHaze, col, 0.25 + 0.75 * hz);
        a *= smoothstep(0.0, 0.06, d.y);
        gl_FragColor = vec4(col, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    side: BackSide, transparent: true, depthWrite: false, fog: false,
  })
  const dome = new Mesh(new SphereGeometry(420, 48, 24), cloudMat)
  dome.renderOrder = -0.5; dome.frustumCulled = false; dome.name = 'clouds'
  scene.add(dome)
  // The same clouds, for the sky that lights the world (daylight.ts makes it from a scene of its own).
  // (Inside the reach of the cube camera that renders it, which stops at a hundred.)
  const envDome = new Mesh(new SphereGeometry(60, 32, 16), cloudMat)

  /* ---- their shadows: a sheet only the sun's shadow sees, holes where the sky is clear ---- */
  const shadeMat = new MeshDepthMaterial({ depthPacking: RGBADepthPacking })
  const shift = { value: new Vector3() }
  shadeMat.onBeforeCompile = (sh) => {
    sh.uniforms.uCover = cover; sh.uniforms.uDrift = { value: driftUv.value }; sh.uniforms.uShift = shift; sh.uniforms.tCloudField = fieldTex
    sh.vertexShader = 'varying vec2 vCW;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vCW = (modelMatrix * vec4(transformed, 1.0)).xz;')
    sh.fragmentShader = CLOUD_GLSL + 'uniform vec3 uShift;\nvarying vec2 vCW;\n' + sh.fragmentShader.replace('void main() {', 'void main() {\n  if (cloudAt(vCW + uShift.xz) < 0.5) discard;')
  }
  shadeMat.customProgramCacheKey = () => 'walk-cloud-shade'
  const sheet = new Mesh(new PlaneGeometry(90, 90).rotateX(-Math.PI / 2), new MeshDepthMaterial())
  sheet.customDepthMaterial = shadeMat
  sheet.castShadow = true; sheet.frustumCulled = false
  // (On a layer of its own: the shadow's camera sees it, the picture's does not.)
  sheet.layers.set(1); o.light.shadow.camera.layers.enable(1)
  scene.add(sheet)

  /* ---- the rain: streaks in a box round you, worked out on the graphics card ---- */
  const DROPS = o.phone ? 2500 : 7000
  const rainGeo = new BufferGeometry()
  {
    const seed: number[] = [], corner: number[] = [], pos: number[] = []
    for (let k = 0; k < DROPS; k++) {
      const s = [Math.random(), Math.random(), Math.random(), Math.random()]
      for (const [a, b] of [[0, 0], [1, 0], [1, 1], [0, 0], [1, 1], [0, 1]]) { seed.push(...s); corner.push(a, b); pos.push(0, 0, 0) }
    }
    rainGeo.setAttribute('position', new Float32BufferAttribute(pos, 3))
    rainGeo.setAttribute('aSeed', new Float32BufferAttribute(seed, 4))
    rainGeo.setAttribute('aCorner', new Float32BufferAttribute(corner, 2))
  }
  const BOX = new Vector3(4.2, 2.6, 4.2)
  const rainMat = new ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uCam: { value: new Vector3() }, uWind: { value: new Vector3() }, uBox: { value: BOX }, uColor: { value: new Color() }, uAlpha: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute vec4 aSeed; attribute vec2 aCorner;
      uniform float uTime; uniform vec3 uCam, uWind, uBox;
      varying float vA; varying float vEdge;
      void main() {
        // Falling at nine metres a second (a world unit a second), drifting with the wind; the box wraps round you.
        vec3 vel = vec3(uWind.x, -(0.9 + aSeed.w * 0.25), uWind.z);
        vec3 p = aSeed.xyz * uBox + vel * uTime;
        p = mod(p - (uCam - uBox * 0.5), uBox) + uCam - uBox * 0.5;
        // A streak: as long as a drop goes in a twentieth of a second, a hair across, facing you.
        vec3 tail = p - vel * 0.075;
        vec3 view = normalize(cameraPosition - p);
        vec3 side = normalize(cross(vel, view)) * 0.003 * (1.0 + aSeed.w);
        vec3 q = mix(p, tail, aCorner.y) + side * (aCorner.x - 0.5) * 2.0;
        vA = 1.0 - smoothstep(0.5, 1.0, length(p.xz - uCam.xz) / (uBox.x * 0.5));
        vA *= smoothstep(0.03, 0.25, length(p - cameraPosition));
        vEdge = aCorner.x;
        gl_Position = projectionMatrix * viewMatrix * vec4(q, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uAlpha;
      varying float vA; varying float vEdge;
      void main() {
        float a = uAlpha * vA * (1.0 - abs(vEdge - 0.5) * 2.0);
        gl_FragColor = vec4(uColor, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false,
  })
  const rainMesh = new Mesh(rainGeo, rainMat)
  rainMesh.frustumCulled = false; rainMesh.renderOrder = 4; rainMesh.name = 'rain'
  rainMesh.userData.noAO = true
  scene.add(rainMesh)

  /* ---- splashes where it lands ---- */
  const SPL = o.phone ? 90 : 220
  const splGeo = new BufferGeometry()
  splGeo.setAttribute('position', new Float32BufferAttribute(new Float32Array(SPL * 3), 3))
  const dot = (() => {
    if (typeof document === 'undefined') return null
    const c = document.createElement('canvas'); c.width = c.height = 32
    const g = c.getContext('2d')!, gr = g.createRadialGradient(16, 16, 0, 16, 16, 16)
    gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32)
    return new CanvasTexture(c)
  })()
  const splMat = new PointsMaterial({ color: '#dfe7ee', size: 0.009, map: dot, transparent: true, depthWrite: false, opacity: 0, blending: AdditiveBlending })
  const splashes = new Points(splGeo, splMat)
  splashes.frustumCulled = false; splashes.userData.noAO = true
  scene.add(splashes)
  const splAge = new Float32Array(SPL).map(() => Math.random() * 0.25)

  const pickNext = () => {
    const opts = NEXT[state.kind], sum = opts.reduce((a, [, w]) => a + w, 0)
    let r = Math.random() * sum
    for (const [k, w] of opts) { if ((r -= w) <= 0) return k }
    return opts[0][0]
  }
  const ease = (a: number, b: number, k: number) => a + (b - a) * Math.min(1, k)
  let dirAng = Math.atan2(state.dir.z, state.dir.x)

  return {
    state, dome: envDome,
    /** The flat cloud layer in the picture (shown only where the volumetric clouds are not: the lowest level). */
    flat: dome,
    /** What the volumetric clouds read (clouds.ts): the pattern, how much of the sky is cloud, the drift. */
    field: fieldTex, cover, drift: driftUv,
    /** Choose the weather (or 'auto', to let it change by itself). */
    set(kind: WeatherKind | 'auto') {
      if (kind === 'auto') { state.auto = true; spell = 120 }
      else { state.auto = false; state.kind = kind }
    },
    /** How much cloud is between the camera and a direction (the sun, for its glare). */
    cloudToward(cam: Vector3, dir: Vector3) {
      if (dir.y <= 0.01) return 0
      const w = (H - cam.y) / dir.y, x = cam.x + dir.x * w, z = cam.z + dir.z * w
      const n = fbm(x * SCALE + driftUv.value.x, z * SCALE + driftUv.value.y), th = thresh(state.cover)
      const s = Math.max(0, Math.min(1, (n - th) / 0.2))
      return s * s * (3 - 2 * s)
    },
    /** Each frame: the weather moves on; the clouds drift, the rain falls round you, the sun's shadow carries the clouds'. */
    update(dt: number, c: { cam: Vector3; groundAt(x: number, z: number): number; sunDir: Vector3; lightDir: Vector3; lightTarget: Vector3; litColor: Color; shadeColor: Color; haze: Color; day: number; lampGlow: number }) {
      if (dt <= 0) return
      t += dt
      // The spells: one passes into the next.
      if (state.auto && (spell -= dt) <= 0) { state.kind = pickNext(); spell = 150 + Math.random() * 200 }
      const L = LOOKS[state.kind]
      // (Clouds gather before the rain, and the rain eases before they clear; a spell you choose comes on in a few seconds.)
      const quick = state.auto ? 1 : 6
      state.cover = ease(state.cover, L.cover, dt * quick * (L.cover > state.cover ? 0.02 : 0.015))
      const rainTo = state.cover > 0.85 ? L.rain : 0
      state.rain = ease(state.rain, rainTo, dt * quick * 0.05)
      state.wind = ease(state.wind, L.wind, dt * quick * 0.03)
      cover.value = state.cover
      // Gusts, and a slow veer.
      state.gust = 0.5 + 0.5 * Math.sin(t * 0.37) * Math.sin(t * 0.13 + 1.7)
      dirAng += Math.sin(t * 0.011) * dt * 0.01
      state.dir.set(Math.cos(dirAng), 0, Math.sin(dirAng))
      // Wet: soaking in while it rains, drying slowly once it stops (faster in sun and wind).
      const w = wetness.wet
      if (state.rain > 0.05) w.value = Math.min(1, w.value + dt * state.rain * 0.04)
      else w.value = Math.max(0, w.value - dt * (0.002 + 0.006 * (1 - state.cover) * c.day + 0.002 * state.wind))
      wetness.rain.value = state.rain
      wetness.chop.value = 0.8 + 0.9 * state.wind
      // The clouds drift with the wind (some ten metres a second at their height, more in a storm).
      const speed = (0.6 + 1.4 * state.wind) * SCALE * dt
      driftUv.value.x -= state.dir.x * speed; driftUv.value.y -= state.dir.z * speed
      const U = cloudMat.uniforms
      U.uCam.value.copy(c.cam); U.uSun.value.copy(c.lightDir)
      U.uLit.value.copy(c.litColor); U.uShade.value.copy(c.shadeColor); U.uHaze.value.copy(c.haze)
      dome.position.copy(c.cam)
      // Lightning, in a storm.
      if (state.kind === 'storm' && state.rain > 0.6 && !still) {
        if ((nextFlash -= dt) <= 0) { state.flash = 1; second = 0.34; nextFlash = 7 + Math.random() * 18 }
      }
      state.flash = Math.max(0, state.flash - dt * (state.flash > 0.5 ? 2.5 : 1.2))
      // (Two pulses a third of a second apart, then nothing for seconds: never more than two flashes in a second, well
      // short of the three that can bring on a seizure.)
      if (second > 0 && (second -= dt) <= 0) { second = -1; if (!still) state.flash = Math.max(state.flash, 0.65) }
      if (still) state.flash = 0
      U.uFlash.value = state.flash
      // The shadow sheet: under the sun's shadow camera, carrying the pattern of the clouds overhead where its shadow falls.
      const sy = Math.max(0.05, c.lightDir.y), y0 = c.lightTarget.y + Math.min(6, Math.max(1.2, c.lightDir.y * 35 * 0.6))
      sheet.position.set(c.lightTarget.x, y0, c.lightTarget.z)
      shift.value.set((c.lightDir.x / sy) * (H - y0), 0, (c.lightDir.z / sy) * (H - y0))
      sheet.visible = state.cover > 0.2 && c.lightDir.y > 0.08
      // The rain round you.
      const R = rainMat.uniforms
      R.uTime.value = t; R.uCam.value.copy(c.cam)
      R.uWind.value.set(state.dir.x * state.wind * 0.45, 0, state.dir.z * state.wind * 0.45)
      R.uColor.value.setRGB(0.75, 0.8, 0.86).multiplyScalar(0.35 + 0.65 * c.day + 0.6 * c.lampGlow * (1 - c.day) + state.flash)
      R.uAlpha.value = Math.min(1, state.rain * 1.6) * 0.6
      rainMesh.visible = state.rain > 0.01
      rainGeo.setDrawRange(0, Math.ceil(DROPS * density * Math.min(1, state.rain * 1.3)) * 6)
      // Splashes on whatever is under you, round about.
      splashes.visible = state.rain > 0.05
      if (splashes.visible) {
        const P = splGeo.getAttribute('position') as Float32BufferAttribute
        for (let k = 0; k < SPL; k++) {
          if (k >= SPL * density) { P.setXYZ(k, 0, -999, 0); continue }
          splAge[k] += dt
          if (splAge[k] > 0.22) {
            if (Math.random() > state.rain) { P.setXYZ(k, 0, -999, 0); splAge[k] = Math.random() * 0.2; continue }
            const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 1.6, x = c.cam.x + Math.cos(a) * r, z = c.cam.z + Math.sin(a) * r
            P.setXYZ(k, x, c.groundAt(x, z) + 0.004, z); splAge[k] = Math.random() * 0.05
          }
        }
        P.needsUpdate = true
        splMat.opacity = 0.45 * state.rain * (0.15 + 0.85 * c.day)
      }
    },
    /** Less motion: no lightning. */
    setStill(on: boolean) { still = on },
    /** How much of the rain (streaks and splashes) is drawn, 0 to 1. */
    setDensity(f: number) { density = Math.max(0.1, Math.min(1, f)) },
    dispose() {
      for (const m of [dome, envDome, sheet, rainMesh]) { scene.remove(m); m.geometry.dispose() }
      scene.remove(splashes); splGeo.dispose(); splMat.dispose(); dot?.dispose(); cloudMat.dispose(); rainMat.dispose(); shadeMat.dispose(); field?.dispose()
    },
  }
}
