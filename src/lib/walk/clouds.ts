/**
 * The walk's clouds, in three dimensions (round two, phase 2): raymarched through the sky, as film and the best games
 * draw them (Schneider's Horizon Zero Dawn clouds, Hillaire's lighting of them), at a quarter of the picture's size.
 *
 *   - where: a layer from about six hundred metres up, as deep as the weather makes it — cumulus a kilometre and a
 *     half tall on a fair day, a low grey sheet when it is overcast, towering in a storm — on the curve of the
 *     Earth, so the far ones sink to the horizon;
 *   - their shape: the same pattern of cover as the flat clouds and the clouds' shadows on the ground (weather.ts's
 *     cloud field, so a cloud overhead is the shadow beneath it), rounded over the top and flat underneath as a
 *     cumulus is, its edges eaten away by billowing 3D noise (inverted Worley, made once on the processor);
 *   - their light: the sun's (or the moon's) through the air to them, then through the cloud itself towards each
 *     point (a short march towards the light), scattered forward strongly — the silver lining on a cloud with the
 *     sun behind it — and a little back; the sky's own light from above and around for their shaded sides; the
 *     energy-conserving step of Hillaire's integration, so a thick cloud is dark underneath and bright on top;
 *   - far off, the haze: each cloud fades into the sky behind it with distance, as real ones do;
 *   - a storm's lightning lights them from inside.
 *
 * The march's start is jittered each frame and the steadying (lens.ts) smooths the noise away. The level sets the
 * steps (tiers.ts); at Low the flat clouds stand in.
 */
import { Data3DTexture, HalfFloatType, LinearFilter, Matrix4, RedFormat, RepeatWrapping, ShaderMaterial, type Texture, UnsignedByteType, Vector2, Vector3, type WebGLRenderer, WebGLRenderTarget, Color } from 'three'
import { FullScreenQuad, Pass } from 'three/examples/jsm/postprocessing/Pass.js'
import { ATMO_GLSL, SKYVIEW_GLSL, UNIT_KM } from './atmosphere'
import { PERIOD, SCALE } from './weather'

/** A 3D noise that tiles: inverted Worley (billows) in three octaves over a little value noise, made once (N³ bytes). */
export function billows(N = 64) {
  const data = new Uint8Array(N * N * N)
  let s = 0x7a3b1
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
  const worley = (cells: number) => {
    const pts = new Float32Array(cells * cells * cells * 3)
    for (let k = 0; k < pts.length; k++) pts[k] = rnd()
    return (x: number, y: number, z: number) => {
      const fx = x * cells, fy = y * cells, fz = z * cells, ix = Math.floor(fx), iy = Math.floor(fy), iz = Math.floor(fz)
      let best = 9
      for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const cx = ix + dx, cy = iy + dy, cz = iz + dz
        const wx = ((cx % cells) + cells) % cells, wy = ((cy % cells) + cells) % cells, wz = ((cz % cells) + cells) % cells
        const o = ((wz * cells + wy) * cells + wx) * 3
        const px = cx + pts[o], py = cy + pts[o + 1], pz = cz + pts[o + 2]
        const d = (px - fx) ** 2 + (py - fy) ** 2 + (pz - fz) ** 2
        if (d < best) best = d
      }
      return Math.min(1, Math.sqrt(best))
    }
  }
  const w1 = worley(4), w2 = worley(8), w3 = worley(16)
  for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N, v = y / N, t = z / N
    const b = (1 - w1(u, v, t)) * 0.625 + (1 - w2(u, v, t)) * 0.25 + (1 - w3(u, v, t)) * 0.125
    data[(z * N + y) * N + x] = Math.round(Math.max(0, Math.min(1, b)) * 255)
  }
  const tex = new Data3DTexture(data, N, N, N)
  tex.format = RedFormat; tex.type = UnsignedByteType
  tex.wrapS = tex.wrapT = tex.wrapR = RepeatWrapping
  tex.minFilter = tex.magFilter = LinearFilter
  tex.needsUpdate = true
  return tex
}

const VERT = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`

export type CloudLook = {
  /** The cloud field (weather.ts), how much of the sky is cloud, its drift. */
  field: { value: Texture | null }; cover: { value: number }; drift: { value: Vector3 }
  /** Towards the light that lights them, and that light at the clouds (colour × strength). */
  toLight: Vector3; light: Color
  /** The sky from where you stand (atmosphere.ts) and its strength; the air's haze; lightning. */
  skyView: Texture; skyE: number; haze: number; flash: number
  /** The wind's offset for the billows (world units), and the steps the march may take. */
  wind: Vector3; steps: number
}

/** The clouds: marched at a quarter size into a buffer of their own, then laid over the sky in the picture. */
export class CloudPass extends Pass {
  rt = new WebGLRenderTarget(1, 1, { type: HalfFloatType, minFilter: LinearFilter, magFilter: LinearFilter, depthBuffer: false })
  march: ShaderMaterial; lay: ShaderMaterial; quad = new FullScreenQuad()
  copy = new ShaderMaterial({ uniforms: { tDiffuse: { value: null } }, vertexShader: VERT, fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv; void main() { gl_FragColor = texture2D(tDiffuse, vUv); }' })
  camera: { matrixWorld: Matrix4; position: Vector3; projectionMatrixInverse: Matrix4 }
  depth: () => Texture | null
  look: CloudLook | null = null
  frame = 0; noise = billows()
  constructor(camera: CloudPass['camera'], depth: () => Texture | null) {
    super(); this.camera = camera; this.depth = depth
    this.march = new ShaderMaterial({
      uniforms: {
        tDepth: { value: null }, tCloudField: { value: null }, tNoise: { value: this.noise }, tView: { value: null }, uHaze: { value: 22 },
        uInvP: { value: new Matrix4() }, uCamW: { value: new Matrix4() }, uCam: { value: new Vector3() }, uCover: { value: 0 }, uDrift: { value: new Vector3() },
        uToL: { value: new Vector3(0, 1, 0) }, uLight: { value: new Color() }, uSkyE: { value: 80 }, uFlash: { value: 0 }, uWind: { value: new Vector3() },
        uSteps: { value: 32 }, uFrame: { value: 0 }, uRes: { value: new Vector2(1, 1) },
      },
      vertexShader: VERT,
      fragmentShader: ATMO_GLSL + SKYVIEW_GLSL + /* glsl */ `
        uniform sampler2D tDepth, tCloudField, tView; uniform highp sampler3D tNoise;
        uniform mat4 uInvP, uCamW; uniform vec3 uCam, uDrift, uToL, uLight, uWind; uniform float uCover, uSkyE, uFlash, uSteps, uFrame; uniform vec2 uRes;
        varying vec2 vUv;
        #define UNIT ${UNIT_KM.toFixed(7)}
        float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
        // The layer: its base and its top (km above the sea), by the weather.
        float base() { return 0.62 - 0.12 * smoothstep(0.8, 1.0, uCover); }
        float top() { return base() + mix(0.35, 1.6, smoothstep(0.1, 0.55, uCover)) * (1.0 - 0.45 * smoothstep(0.75, 0.95, uCover)) + 2.2 * smoothstep(0.97, 1.0, uCover); }
        /** The cloud's density at a point (world units across, height in km above the sea). */
        float density(vec3 w, float h, float lod) {
          float b = base(), t = top(), hf = (h - b) / (t - b);
          if (hf < 0.0 || hf > 1.0) return 0.0;
          float th = 0.78 - 0.66 * uCover;
          vec3 q = (w + uWind) * 0.011;
          // Where the cover is read wobbles with height (a billow's own noise), so a cloud's sides bulge and lean
          // instead of standing as walls straight up from its outline.
          vec2 wob = (vec2(texture(tNoise, q * 0.45 + vec3(0.3, 0.0, 0.1)).r, texture(tNoise, q * 0.45 + vec3(0.7, 0.5, 0.2)).r) - 0.5) * (30.0 + 60.0 * hf);
          // (Its pattern softened — the finest octaves left out — for the billows make the fine detail in 3D: read sharp,
          // the outline's fine edges stood straight up, comb-like, under every cloud.)
          float f = textureLod(tCloudField, ((w.xz + wob) * ${SCALE.toFixed(4)} + uDrift.xy) / ${PERIOD.toFixed(1)}, 2.5).r;
          float cov = smoothstep(th - 0.08, th + 0.25, f);
          if (cov < 0.01) return 0.0;
          // Flat underneath; rounded over the top, as high as the cover there is thick (a cumulus's dome).
          float topH = 0.12 + 0.88 * cov;
          float shape = smoothstep(0.0, 0.06, hf) * (1.0 - smoothstep(topH * 0.55, topH, hf));
          float d = cov * shape;
          if (d < 0.01) return 0.0;
          // Billows eat into it, hardest at the edges (finer ones too, near; skipped in the light's march).
          float bil = texture(tNoise, q).r;
          if (lod < 0.5) bil = bil * 0.65 + 0.35 * texture(tNoise, q * 3.3 + 0.37).r;
          d = clamp((d - (1.0 - bil) * (0.75 - 0.35 * d)) * 2.2, 0.0, 1.0);
          // (An overcast sheet fills in.)
          return max(d, smoothstep(0.82, 1.0, uCover) * shape * (0.55 + 0.45 * bil));
        }
        float hg(float c, float g) { float g2 = g * g; return (1.0 - g2) / (4.0 * PI_A * pow(1.0 + g2 - 2.0 * g * c, 1.5)); }
        void main() {
          float d = texture2D(tDepth, vUv).x;
          vec4 v = uInvP * vec4(vUv * 2.0 - 1.0, 1.0, 1.0); vec3 rdv = normalize(v.xyz / v.w);
          vec3 rd = normalize((uCamW * vec4(rdv, 0.0)).xyz);
          // How far the picture's own surfaces are (km): clouds stop there.
          float far = 1e5;
          if (d < 1.0) { vec4 pv = uInvP * vec4(vUv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); far = length(pv.xyz / pv.w) * UNIT; }
          vec3 ro = vec3(0.0, RG + max(uCam.y * UNIT, 0.0) + 0.002, 0.0);
          float rb = RG + base(), rtop = RG + top(), h0 = ro.y - RG;
          float t0, t1;
          if (h0 < base()) { t0 = sphere(ro, rd, rb); t1 = sphere(ro, rd, rtop); if (t0 < 0.0 || rd.y < -0.02) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; } }
          else if (h0 < top()) { t0 = 0.0; t1 = sphere(ro, rd, rtop); float tb = sphere(ro, rd, rb); if (tb > 0.0) t1 = min(t1, tb); }
          else { t0 = sphere(ro, rd, rtop); t1 = sphere(ro, rd, rb); if (t0 < 0.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; } if (t1 < 0.0) t1 = t0 + 2.0; }
          t1 = min(min(t1, t0 + 14.0), far);
          if (t1 <= t0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
          int N = int(uSteps);
          float dt = 0.0, j = ign(gl_FragCoord.xy + uFrame * 5.588238);
          float cs = dot(rd, uToL);
          float phase = mix(hg(cs, 0.65), hg(cs, -0.2), 0.25) + 0.6 * hg(cs, 0.9) * 0.3;
          // The sky's light on them: from overhead (their tops), and from round the horizon (their sides and bases).
          vec3 skyTop = texture2D(tView, skyUv(vec3(0.0, 1.0, 0.0))).rgb * uSkyE, skyLow = texture2D(tView, skyUv(normalize(vec3(rd.x, 0.15, rd.z)))).rgb * uSkyE;
          vec3 L = vec3(0.0); float T = 1.0, tMid = 0.0, wMid = 0.0;
          const float SIGMA = 38.0;
          for (int k = 0; k < 64; k++) {
            if (k >= N || T < 0.03) break;
            // (Steps closer together where the ray first enters, longer further in, where less of it shows.)
            float a0 = float(k) / uSteps, a1 = (float(k) + 1.0) / uSteps;
            float ta = t0 + (t1 - t0) * a0 * a0 * (0.4 + 0.6 * a0), tb = t0 + (t1 - t0) * a1 * a1 * (0.4 + 0.6 * a1);
            float t = mix(ta, tb, j); dt = tb - ta;
            vec3 p = ro + rd * t; float h = length(p) - RG;
            vec3 w = uCam + rd * (t / UNIT);
            float dens = density(w, h, 0.0);
            if (dens <= 0.0) continue;
            // Through the cloud towards the light: four steps, longer each.
            float od = 0.0, sl = 0.05;
            for (int i = 0; i < 4; i++) { vec3 lp = w + uToL * ((sl * (float(i) + 0.5)) / UNIT); od += density(lp, h + uToL.y * sl * (float(i) + 0.5), 1.0) * sl; sl *= 1.9; }
            float hf = clamp((h - base()) / (top() - base()), 0.0, 1.0);
            // Beer's law, with the light that has scattered many times inside (softer, reaching deeper), and the powder
            // darkening of a cloud's sunlit edge seen from the side.
            float beer = exp(-od * SIGMA) * 0.75 + exp(-od * SIGMA * 0.25) * 0.25;
            float powder = 1.0 - 0.6 * exp(-dens * SIGMA * 0.04);
            vec3 sun = uLight * beer * powder * phase * 4.0 * PI_A * 0.25;
            vec3 amb = mix(skyLow * 0.9, skyTop * 1.1, hf) * (0.35 + 0.65 * hf) + vec3(0.75, 0.8, 0.95) * uFlash * 6.0;
            vec3 S = (sun + amb) * dens * SIGMA;
            float ext = dens * SIGMA, Ts = exp(-ext * dt);
            L += T * (S - S * Ts) / max(ext, 1e-5);
            tMid += t * T * (1.0 - Ts); wMid += T * (1.0 - Ts);
            T *= Ts;
          }
          // Far off, into the haze: towards the sky behind the cloud, by the distance through the air.
          float dist = wMid > 0.0 ? tMid / wMid : t0;
          float aer = 1.0 - exp(-dist * 0.003 * uHaze);
          vec3 behind = texture2D(tView, skyUv(normalize(vec3(rd.x, max(rd.y, 0.0005), rd.z)))).rgb * uSkyE;
          L = mix(L, behind * (1.0 - T), aer);
          gl_FragColor = vec4(L, T);
        }`,
    })
    this.lay = new ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, tClouds: { value: null }, tDepth: { value: null } },
      vertexShader: VERT,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse, tClouds, tDepth; varying vec2 vUv;
        void main() {
          vec4 c = texture2D(tDiffuse, vUv), k = texture2D(tClouds, vUv);
          // (Over the sky only, unless the camera is among or above them: the march already stopped at surfaces.)
          float sky = step(0.99999, texture2D(tDepth, vUv).x);
          gl_FragColor = vec4(mix(c.rgb, c.rgb * k.a + k.rgb, sky), c.a);
        }`,
    })
  }
  render(renderer: WebGLRenderer, write: WebGLRenderTarget, read: WebGLRenderTarget) {
    const o = this.look, depth = this.depth()
    if (!o || !o.field.value || !depth) { this.quad.material = this.copy; this.copy.uniforms.tDiffuse.value = read.texture; renderer.setRenderTarget(this.renderToScreen ? null : write); this.quad.render(renderer); return }
    const u = this.march.uniforms
    u.tDepth.value = depth; u.tCloudField.value = o.field.value; u.tView.value = o.skyView
    u.uInvP.value.copy(this.camera.projectionMatrixInverse); u.uCamW.value.copy(this.camera.matrixWorld); u.uCam.value.copy(this.camera.position)
    u.uCover.value = o.cover.value; u.uDrift.value.copy(o.drift.value); u.uToL.value.copy(o.toLight); u.uLight.value.copy(o.light)
    u.uSkyE.value = o.skyE; u.uHaze.value = o.haze; u.uFlash.value = o.flash; u.uWind.value.copy(o.wind); u.uSteps.value = o.steps
    u.uFrame.value = this.frame = (this.frame + 1) % 64
    this.quad.material = this.march; renderer.setRenderTarget(this.rt); this.quad.render(renderer)
    const l = this.lay.uniforms
    l.tDiffuse.value = read.texture; l.tClouds.value = this.rt.texture; l.tDepth.value = depth
    this.quad.material = this.lay; renderer.setRenderTarget(this.renderToScreen ? null : write); this.quad.render(renderer)
  }
  setSize(w: number, h: number) { this.rt.setSize(Math.max(1, Math.ceil(w / 4)), Math.max(1, Math.ceil(h / 4))); this.march.uniforms.uRes.value.set(w / 4, h / 4) }
  dispose() { this.rt.dispose(); this.march.dispose(); this.lay.dispose(); this.copy.dispose(); this.quad.dispose(); this.noise.dispose() }
}
