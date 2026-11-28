/**
 * The walk's lens (walker.ts): what a camera does to the light between the
 * world and the picture. Everything up to the tone mapping is light in
 * floating point, in proportion (the sun to the sky, daylight.ts); the lens
 * meters it, as a camera or an eye does, rather than being told how bright
 * the day is.
 *
 *   - the scene, drawn once, with its depth kept: the occlusion, the contact
 *     shadows and the steadying all read that depth (no second drawing);
 *   - ambient occlusion: the soft dark where things meet and light cannot get
 *     in — under eaves, at the foot of a wall, round your feet (GTAO, from the
 *     depth alone: its normals worked out from it);
 *   - contact shadows: the sun's shadow in the last few centimetres, where the
 *     shadow map is too coarse — a shoe on the pavement, a cone on the kerb —
 *     found by stepping towards the sun through the depth;
 *   - the clouds (clouds.ts), marched through the sky at a quarter size and
 *     laid over it;
 *   - the air (atmosphere.ts): everything seen through the haze between it and
 *     you — the light the air adds and what it takes away, by distance and
 *     direction, from the same atmosphere as the sky (the far hills blue, the
 *     far side of the bay soft); and the morning mist, thick near the sea and
 *     the low ground and thin above, lit by the sky and the sun;
 *   - light shafts: when the sun is low and in or near the picture, the haze
 *     lit along the lines from it, cut by whatever stands in the way;
 *   - the eye: each frame the picture's brightness is measured (the average of
 *     its log luminance, the middle counting most) and the exposure eases
 *     towards it, quicker into the light than into the dark, as eyes adapt;
 *     with a compensation the day gives (night stays night, a sunset golden)
 *     and a floor (in the dark the eye can open only so far), and never so far
 *     open that the brightest parts burn out (a dusk sky over a dark street);
 *   - steadying (temporal anti-aliasing): the camera is moved a fraction of
 *     a pixel each frame, and each picture is blended with the last one,
 *     found again from the depth and both cameras, the last one held to the
 *     colours round each point so nothing ghosts; edges, grass, leaves and
 *     thin rails stop shimmering;
 *   - bloom: light brighter than white spilling round itself, as through any
 *     glass — the sun on the sea, a lamp, a lit window (with no threshold at
 *     all it laid a milky veil over the whole picture, so it starts softly
 *     just above white by day, lower at night when the lamps are the point);
 *   - tone mapping (AgX: brights roll off to white the way film's do,
 *     without hues skewing), then a grade: a little sharpening to undo the
 *     steadying's softness, the corners falling off as a real lens does
 *     (cos⁴, gently), a trace of colour fringing at the very corners, grain
 *     strongest in the middle tones as film's is (still for reduced motion);
 *   - the sun, looked towards: its glare, and the faint ghosts a lens throws.
 *
 * How much of this is done is the quality level's (tiers.ts, applied by
 * walker.ts as it goes): the occlusion at half the picture's size, at its
 * full size, or not at all; the glow or none; the steadying (off, SMAA
 * instead, only where ?taa=0 asks).
 */
import {
  AlwaysDepth, type Camera, DataUtils, DepthTexture, FloatType, HalfFloatType, LinearFilter, LinearMipmapLinearFilter, Matrix4, NearestFilter,
  type PerspectiveCamera, type Scene, ShaderMaterial, type Texture, Vector2, Vector3, type WebGLRenderer, WebGLRenderTarget,
} from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js'
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js'
import { AP_GLSL, UNIT_KM } from './atmosphere'
import { CloudPass, type CloudLook } from './clouds'

const VERT = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`
const LUMA = /* glsl */ `float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }`
/** A point in the world from a depth and a place in the picture (any matrix that undoes the camera). */
const UNPROJECT = /* glsl */ `vec3 unproject(mat4 inv, vec2 uv, float d) { vec4 p = inv * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); return p.xyz / p.w; }`

/** Halton's low-discrepancy sequence: the sub-pixel offsets the camera cycles through (eight of them). */
const halton = (i: number, b: number) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b) } return r }
const JITTER = Array.from({ length: 8 }, (_, k) => [halton(k + 1, 2) - 0.5, halton(k + 1, 3) - 0.5] as const)

const Grade = {
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uGrain: { value: 0.03 }, uRes: { value: new Vector2(1, 1) }, uVignette: { value: 0.26 }, uCool: { value: 1 },
    uSun: { value: new Vector2(0.5, 0.5) }, uSunVis: { value: 0 }, uExpo: { value: 1 }, uSat: { value: 1 }, uWarm: { value: 0 }, uFilm: { value: 0 },
    uSharp: { value: 0.22 }, uFringe: { value: 0.6 }, uTan: { value: new Vector2(0.5, 0.5) },
  },
  vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uTime, uGrain, uVignette, uCool, uSunVis, uExpo, uSat, uWarm, uFilm, uSharp, uFringe; uniform vec2 uRes, uSun, uTan;
    varying vec2 vUv;
    ${LUMA}
    float hash(vec2 p) { p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
    void main() {
      vec2 px = 1.0 / uRes;
      vec2 q = vUv - 0.5;
      // Colour fringing (lateral chromatic aberration): red and blue land a fraction of a pixel apart, growing with
      // the square of the distance from the middle, so only the corners show it.
      vec2 ca = q * dot(q, q) * 2.0 * uFringe * px * 3.0;
      vec3 c = vec3(texture2D(tDiffuse, vUv + ca).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - ca).b);
      // Sharpening: what the steadying softened, taken back (the middle against its four neighbours, held in range).
      vec3 n = texture2D(tDiffuse, vUv + vec2(px.x, 0.0)).rgb + texture2D(tDiffuse, vUv - vec2(px.x, 0.0)).rgb
             + texture2D(tDiffuse, vUv + vec2(0.0, px.y)).rgb + texture2D(tDiffuse, vUv - vec2(0.0, px.y)).rgb;
      c = clamp(c + (c - n * 0.25) * uSharp * 1.6, 0.0, 1.0);
      // AgX leaves the picture flat by design (a log negative); a print's contrast round middle grey, and the colour
      // it took out given back a little — the look a graded film has.
      vec3 sc = c * c * (3.0 - 2.0 * c);
      c = mix(c, sc, 0.55);
      float l = luma(c);
      c = max(mix(vec3(l), c, 1.18), 0.0);
      l = luma(c);
      // Shadows a touch cool, as daylight under a blue sky leaves them.
      c += vec3(-0.008, 0.0, 0.012) * (1.0 - smoothstep(0.0, 0.4, l)) * uCool;
      // The sun's glare, and its ghosts strung along the line through the middle of the picture.
      if (uSunVis > 0.001) {
        float asp = uRes.x / uRes.y;
        vec2 d = (vUv - uSun) * vec2(asp, 1.0);
        float r = length(d);
        vec3 glare = vec3(1.0, 0.98, 0.95) * (exp(-r * 6.0) * 0.18 + exp(-r * 30.0) * 0.4);
        float ang = atan(d.y, d.x);
        glare += vec3(1.0, 0.98, 0.95) * pow(abs(sin(ang * 3.0 + 0.4)), 40.0) * exp(-r * 9.0) * 0.1;
        vec2 axis = vec2(0.5) - uSun;
        for (int k = 0; k < 4; k++) {
          float fk = float(k);
          vec2 gp = uSun + axis * (0.55 + fk * 0.45);
          float gr = 0.025 + 0.02 * fk * fk * 0.5;
          float gd = length((vUv - gp) * vec2(asp, 1.0));
          vec3 tint = fk < 1.0 ? vec3(0.55, 0.8, 1.0) : fk < 2.0 ? vec3(0.7, 1.0, 0.85) : fk < 3.0 ? vec3(0.75, 0.7, 1.0) : vec3(0.6, 0.9, 1.0);
          glare += tint * (smoothstep(gr, gr * 0.7, gd) * 0.022 + smoothstep(gr * 1.02, gr * 0.96, gd) * smoothstep(gr * 0.9, gr * 0.96, gd) * 0.024);
        }
        c += glare * uSunVis;
      }
      // A photograph's own look (photo mode): exposure, colour, warmth, a film's lifted blacks and soft highlights.
      c *= uExpo;
      float lum = luma(c);
      c = max(mix(vec3(lum), c, uSat), 0.0);
      c += vec3(0.035, 0.008, -0.03) * uWarm;
      c = mix(c, 0.045 + 0.9 * c * c * (3.0 - 2.0 * c), uFilm);
      // The lens: light falls off towards the corners as the cosine of the angle off the axis (to the fourth power
      // in a simple lens; a modern one corrects most of it, so gently).
      vec2 p = (vUv * 2.0 - 1.0) * uTan;
      float cos2 = 1.0 / (1.0 + dot(p, p));
      c *= pow(cos2, 1.3 * uVignette);
      // Film grain: strongest in the middle tones, as a film's is; fine enough to read only as the end of banding.
      float g = hash(vUv * uRes + fract(uTime) * 61.0) - 0.5;
      lum = luma(c);
      c += g * uGrain * (0.3 + 2.8 * lum * (1.0 - lum));
      gl_FragColor = vec4(c, 1.0);
    }`,
}

/** The depth of whatever the scene was last drawn into (the composer's two buffers take turns). */
type Shared = { depth: Texture | null; inv: Matrix4; invJ: Matrix4; prev: Matrix4; viewProj: Matrix4; reset: boolean }

/**
 * Draws the scene into a buffer of its own, depth and all, and hands the composer a copy of its colour: the passes
 * after it read that depth, and none of them may draw into the buffer whose depth they read (a feedback loop, which
 * the graphics card refuses — the picture goes black).
 */
class ScenePass extends Pass {
  scene: Scene; camera: Camera; shared: Shared; rt: WebGLRenderTarget; quad: FullScreenQuad; copy: ShaderMaterial
  /**
   * The water (water.ts) is drawn after everything solid, so it can see what lies under it: the solid world into
   * this.rt; then this.wet seeded with its colour and depth; then the water (and what floats over it) into this.wet,
   * reading this.rt (never the buffer it draws into). Its layers, and what it is told of the solid picture first.
   */
  water: { mask: number; before: (colour: Texture, depth: Texture) => void } | null = null
  wet: WebGLRenderTarget | null = null; seed: ShaderMaterial | null = null; seedQuad: FullScreenQuad | null = null
  constructor(scene: Scene, camera: Camera, shared: Shared, samples: number) {
    super(); this.scene = scene; this.camera = camera; this.shared = shared; this.needsSwap = false
    this.rt = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples })
    // (The scene's depth kept as a texture, in full floating point: the camera's near plane is a centimetre.)
    if (!samples) {
      this.rt.depthTexture = new DepthTexture(1, 1); this.rt.depthTexture.type = FloatType
      this.wet = new WebGLRenderTarget(1, 1, { type: HalfFloatType })
      this.wet.depthTexture = new DepthTexture(1, 1); this.wet.depthTexture.type = FloatType
      // (Colour and depth carried over in one quad: the depth written as the fragment's own.)
      this.seed = new ShaderMaterial({
        uniforms: { tDiffuse: { value: null }, tDepth: { value: null } }, vertexShader: VERT,
        fragmentShader: 'uniform sampler2D tDiffuse, tDepth; varying vec2 vUv; void main() { gl_FragColor = texture2D(tDiffuse, vUv); gl_FragDepth = texture2D(tDepth, vUv).x; }',
        depthTest: true, depthWrite: true, depthFunc: AlwaysDepth,
      })
      this.seedQuad = new FullScreenQuad(this.seed)
    }
    this.copy = new ShaderMaterial({ uniforms: { tDiffuse: { value: null } }, vertexShader: VERT, fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv; void main() { gl_FragColor = texture2D(tDiffuse, vUv); }' })
    this.quad = new FullScreenQuad(this.copy)
  }
  render(renderer: WebGLRenderer, _w: WebGLRenderTarget, read: WebGLRenderTarget) {
    const cam = this.camera, w = this.water, mask = cam.layers.mask
    if (w && this.wet && this.seed && this.seedQuad && this.rt.depthTexture) {
      cam.layers.mask = mask & ~w.mask
      renderer.setRenderTarget(this.rt); renderer.clear(); renderer.render(this.scene, cam)
      this.seed.uniforms.tDiffuse.value = this.rt.texture; this.seed.uniforms.tDepth.value = this.rt.depthTexture
      renderer.setRenderTarget(this.wet); renderer.clear(); this.seedQuad.render(renderer)
      w.before(this.rt.texture, this.rt.depthTexture)
      // (The water's own draw: nothing cleared, the shadows not drawn again.)
      const ac = renderer.autoClear, su = renderer.shadowMap.autoUpdate
      renderer.autoClear = false; renderer.shadowMap.autoUpdate = false
      cam.layers.mask = w.mask
      renderer.render(this.scene, cam)
      renderer.autoClear = ac; renderer.shadowMap.autoUpdate = su; cam.layers.mask = mask
      this.shared.depth = this.wet.depthTexture
      this.copy.uniforms.tDiffuse.value = this.wet.texture
    } else {
      // (No depth to read — multisampling asked for — or no water: everything at once.)
      if (w) cam.layers.mask = mask | w.mask
      renderer.setRenderTarget(this.rt); renderer.clear(); renderer.render(this.scene, cam)
      cam.layers.mask = mask
      this.shared.depth = this.rt.depthTexture
      this.copy.uniforms.tDiffuse.value = this.rt.texture
    }
    renderer.setRenderTarget(read); this.quad.render(renderer)
  }
  setSize(w: number, h: number) { this.rt.setSize(w, h); this.wet?.setSize(w, h) }
  dispose() { this.rt.dispose(); this.wet?.dispose(); this.seed?.dispose(); this.seedQuad?.dispose(); this.copy.dispose(); this.quad.dispose() }
}

/** Contact shadows: marched a short way towards the sun through the depth; where something is in the way, darker. */
class ContactPass extends Pass {
  quad: FullScreenQuad; mat: ShaderMaterial; camera: PerspectiveCamera; shared: Shared
  constructor(camera: PerspectiveCamera, shared: Shared) {
    super(); this.camera = camera; this.shared = shared
    this.mat = new ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, tDepth: { value: null }, uProj: { value: new Matrix4() }, uInvProj: { value: new Matrix4() }, uSun: { value: new Vector3() }, uStrength: { value: 0 }, uReach: { value: 0.03 }, uRes: { value: new Vector2(1, 1) }, uFrame: { value: 0 } },
      vertexShader: VERT,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse, tDepth; uniform mat4 uProj, uInvProj; uniform vec3 uSun; uniform float uStrength, uReach, uFrame; uniform vec2 uRes;
        varying vec2 vUv;
        ${UNPROJECT}
        float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
        void main() {
          vec4 col = texture2D(tDiffuse, vUv);
          float d = texture2D(tDepth, vUv).x;
          if (uStrength < 0.001 || d >= 1.0) { gl_FragColor = col; return; }
          vec3 P = unproject(uInvProj, vUv, d);
          // The surface's own facing, from the depth round it: one turned from the sun is in its own shade already.
          vec3 cr = cross(dFdx(P), dFdy(P));
          if (!(dot(cr, cr) > 1e-24)) { gl_FragColor = col; return; }
          vec3 N = normalize(cr);
          float facing = dot(N, uSun);
          if (!(facing > 0.05)) { gl_FragColor = col; return; }
          // Twelve steps towards the sun, the first a little way off the surface (and jittered, for the steadying to smooth).
          float hit = 0.0, j = ign(gl_FragCoord.xy + uFrame * 5.588238);
          float reach = uReach * clamp(-P.z * 0.08, 0.35, 1.0);
          for (int k = 0; k < 12; k++) {
            float t = (float(k) + j) / 12.0;
            vec3 S = P + uSun * reach * t * t + N * 0.002;
            vec4 c = uProj * vec4(S, 1.0);
            vec2 uv = c.xy / c.w * 0.5 + 0.5;
            if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) break;
            float sd = texture2D(tDepth, uv).x;
            vec3 Q = unproject(uInvProj, uv, sd);
            // In front of the step (towards the camera), and not by more than a thin thing is thick: in the way.
            float gap = Q.z - S.z;
            if (gap > 0.0015 && gap < 0.03) { hit = 1.0 - t * 0.5; break; }
          }
          // (Fading out with distance, past which the shadow map does the work.)
          float fade = 1.0 - smoothstep(4.0, 9.0, -P.z);
          float k = 1.0 - hit * uStrength * fade * smoothstep(0.05, 0.3, facing);
          gl_FragColor = vec4(col.rgb * (k == k ? clamp(k, 0.0, 1.0) : 1.0), col.a);
        }`,
    })
    this.quad = new FullScreenQuad(this.mat)
  }
  render(renderer: WebGLRenderer, write: WebGLRenderTarget, read: WebGLRenderTarget) {
    const u = this.mat.uniforms
    u.tDiffuse.value = read.texture; u.tDepth.value = this.shared.depth
    u.uProj.value.copy(this.camera.projectionMatrix); u.uInvProj.value.copy(this.camera.projectionMatrixInverse)
    u.uFrame.value = (u.uFrame.value + 1) % 64
    renderer.setRenderTarget(this.renderToScreen ? null : write); this.quad.render(renderer)
  }
  setSize(w: number, h: number) { this.mat.uniforms.uRes.value.set(w, h) }
  dispose() { this.mat.dispose(); this.quad.dispose() }
}

/** The air over the picture: the atmosphere's haze by distance, and the morning mist low down. */
class AirPass extends Pass {
  mat: ShaderMaterial; quad: FullScreenQuad; camera: PerspectiveCamera; shared: Shared
  constructor(camera: PerspectiveCamera, shared: Shared) {
    super(); this.camera = camera; this.shared = shared
    this.mat = new ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null }, tDepth: { value: null }, tAP: { value: null }, uApMax: { value: 6 }, uE: { value: 80 }, uInvP: { value: new Matrix4() }, uCamW: { value: new Matrix4() },
        uCam: { value: new Vector3() }, uMist: { value: 0 }, uMistH: { value: 4 }, uSea: { value: 0 }, uMistCol: { value: new Vector3() },
        uUnder: { value: 0 }, uWSigma: { value: new Vector3() }, uWIn: { value: new Vector3() },
      },
      vertexShader: VERT,
      fragmentShader: AP_GLSL + /* glsl */ `
        uniform sampler2D tDiffuse, tDepth; uniform float uE, uMist, uMistH, uSea, uUnder; uniform mat4 uInvP, uCamW; uniform vec3 uCam, uMistCol, uWSigma, uWIn;
        varying vec2 vUv;
        void main() {
          vec4 c = texture2D(tDiffuse, vUv);
          float d = texture2D(tDepth, vUv).x;
          vec4 pv = uInvP * vec4(vUv * 2.0 - 1.0, min(d, 0.999999) * 2.0 - 1.0, 1.0); pv /= pv.w;
          vec3 dir = normalize(pv.xyz);
          // (The sky already has the air in it: only the mist is laid over it, as if at the far plane.)
          float dist = d < 1.0 ? length(pv.xyz) : 600.0;
          vec3 P = (uCamW * vec4(dir * dist, 1.0)).xyz;
          if (uUnder > 0.5) {
            // Under the water: everything seen through it — dimmed per colour by the path (red first), filled in by the
            // water's own scattered light; the surface overhead is as far as the water goes.
            vec3 T = exp(-uWSigma * min(dist, 60.0));
            c.rgb = c.rgb * T + uWIn * (1.0 - T);
            gl_FragColor = c; return;
          }
          if (d < 1.0) { vec4 ap = apAt(vUv, dist * ${UNIT_KM.toFixed(7)}); c.rgb = c.rgb * ap.a + ap.rgb * uE; }
          if (uMist > 0.0) {
            // An exponential height fog, worked out along the line of sight exactly.
            float H = uMistH, y0 = uCam.y - uSea, dy = P.y - uCam.y;
            float k = abs(dy) > 1e-3 ? (1.0 - exp(-dy / H)) / (dy / H) : 1.0;
            float od = uMist * exp(-y0 / H) * dist * k;
            float T = exp(-od);
            c.rgb = c.rgb * T + uMistCol * (1.0 - T);
          }
          gl_FragColor = c;
        }`,
    })
    this.quad = new FullScreenQuad(this.mat)
  }
  render(renderer: WebGLRenderer, write: WebGLRenderTarget, read: WebGLRenderTarget) {
    const u = this.mat.uniforms
    u.tDiffuse.value = read.texture; u.tDepth.value = this.shared.depth
    u.uInvP.value.copy(this.camera.projectionMatrixInverse); u.uCamW.value.copy(this.camera.matrixWorld); u.uCam.value.copy(this.camera.position)
    renderer.setRenderTarget(this.renderToScreen ? null : write); this.quad.render(renderer)
  }
  dispose() { this.mat.dispose(); this.quad.dispose() }
}

/** Light shafts: the bright sky round the sun, smeared outwards from it a quarter size, cut by what stands in front. */
class ShaftPass extends Pass {
  rt = new WebGLRenderTarget(1, 1, { type: HalfFloatType, minFilter: LinearFilter, magFilter: LinearFilter, depthBuffer: false })
  march: ShaderMaterial; lay: ShaderMaterial; quad = new FullScreenQuad(); shared: Shared
  sun = new Vector2(0.5, 0.5); strength = 0; colour = new Vector3()
  constructor(shared: Shared) {
    super(); this.shared = shared
    this.march = new ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, tDepth: { value: null }, uSun: { value: new Vector2() }, uFrame: { value: 0 } },
      vertexShader: VERT,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse, tDepth; uniform vec2 uSun; uniform float uFrame; varying vec2 vUv;
        float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
        void main() {
          float acc = 0.0, w = 1.0, sum = 0.0, j = ign(gl_FragCoord.xy + uFrame * 5.588238);
          for (int i = 0; i < 28; i++) {
            vec2 uv = mix(vUv, uSun, (float(i) + j) / 28.0 * 0.92);
            float sky = step(0.99999, texture2D(tDepth, uv).x);
            // (How bright the sky is there: a cloud in front dims it.)
            vec3 c = texture2D(tDiffuse, uv).rgb;
            acc += sky * min(dot(c, vec3(0.3333)), 40.0) * w; sum += w; w *= 0.965;
          }
          gl_FragColor = vec4(vec3(acc / sum), 1.0);
        }`,
    })
    this.lay = new ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, tShafts: { value: null }, uStrength: { value: 0 }, uColour: { value: new Vector3() }, uSun: { value: new Vector2() }, uAsp: { value: 1 } },
      vertexShader: VERT,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse, tShafts; uniform float uStrength, uAsp; uniform vec3 uColour; uniform vec2 uSun; varying vec2 vUv;
        void main() {
          vec4 c = texture2D(tDiffuse, vUv);
          float r = length((vUv - uSun) * vec2(uAsp, 1.0));
          // (Fading with distance from the sun across the picture, as the haze's forward scattering does.)
          float s = texture2D(tShafts, vUv).r * exp(-r * 1.6);
          gl_FragColor = vec4(c.rgb + uColour * s * uStrength, c.a);
        }`,
    })
  }
  render(renderer: WebGLRenderer, write: WebGLRenderTarget, read: WebGLRenderTarget) {
    const m = this.march.uniforms
    m.tDiffuse.value = read.texture; m.tDepth.value = this.shared.depth; m.uSun.value.copy(this.sun); m.uFrame.value = (m.uFrame.value + 1) % 64
    this.quad.material = this.march; renderer.setRenderTarget(this.rt); this.quad.render(renderer)
    const l = this.lay.uniforms
    l.tDiffuse.value = read.texture; l.tShafts.value = this.rt.texture; l.uStrength.value = this.strength; l.uColour.value.copy(this.colour); l.uSun.value.copy(this.sun)
    this.quad.material = this.lay; renderer.setRenderTarget(this.renderToScreen ? null : write); this.quad.render(renderer)
  }
  setSize(w: number, h: number) { this.rt.setSize(Math.max(1, Math.ceil(w / 4)), Math.max(1, Math.ceil(h / 4))); this.lay.uniforms.uAsp.value = w / Math.max(h, 1) }
  dispose() { this.rt.dispose(); this.march.dispose(); this.lay.dispose(); this.quad.dispose() }
}

/**
 * The eye: meters the picture (log luminance, the middle weighted) into a small buffer whose mipmaps average it,
 * eases the adaptation towards that (in a 1×1 buffer, kept from frame to frame), and exposes the picture by it.
 * Nothing is read back to the processor.
 */
class EyePass extends Pass {
  meterRT = new WebGLRenderTarget(64, 64, { type: HalfFloatType, generateMipmaps: true, minFilter: LinearMipmapLinearFilter, magFilter: LinearFilter, depthBuffer: false })
  adapt = [0, 1].map(() => new WebGLRenderTarget(1, 1, { type: HalfFloatType, minFilter: NearestFilter, magFilter: NearestFilter, depthBuffer: false }))
  cur = 0; dt = 0; snap = true
  meter: ShaderMaterial; adaptMat: ShaderMaterial; expose: ShaderMaterial; quad = new FullScreenQuad()
  /** The compensation (in stops: +1 twice as bright), the dimmest the eye adapts to (log2 of a luminance), the brightest. */
  comp = 0; floor = -6; ceil = 4
  constructor() {
    super()
    this.meter = new ShaderMaterial({
      uniforms: { tDiffuse: { value: null } }, vertexShader: VERT,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse; varying vec2 vUv;
        ${LUMA}
        void main() {
          // Four looks round this texel's patch of the picture.
          float s = 0.0, lin = 0.0;
          for (int k = 0; k < 4; k++) {
            vec2 o = (vec2(float(k / 2), float(k - (k / 2) * 2)) - 0.5) / 128.0;
            float L = luma(texture2D(tDiffuse, vUv + o).rgb);
            L = L > 1e-5 && L < 1e6 ? L : 1e-5;
            s += log2(L); lin += min(L, 200.0);
          }
          // The middle counts most (and the sky at the top a little less: a camera's centre-weighted metering).
          vec2 c = vUv - vec2(0.5, 0.45);
          float w = exp(-dot(c, c) * 5.0) * (1.0 - 0.35 * smoothstep(0.6, 1.0, vUv.y)) + 0.02;
          gl_FragColor = vec4(s * 0.25 * w, w, lin * 0.25 * w, 1.0);
        }`,
    })
    this.adaptMat = new ShaderMaterial({
      uniforms: { tMeter: { value: null }, tPrev: { value: null }, uDt: { value: 0 }, uSnap: { value: 1 }, uLevel: { value: 6 } }, vertexShader: VERT,
      fragmentShader: /* glsl */ `
        uniform sampler2D tMeter, tPrev; uniform float uDt, uSnap, uLevel; varying vec2 vUv;
        void main() {
          vec3 m = textureLod(tMeter, vec2(0.5), uLevel).rgb;
          // The log average (the scene's middle), unless the brightest parts would be lost: a camera's highlight
          // protection, so a bright sky over a dark street (the dusk) keeps its colour rather than burning out.
          float target = max(m.x / max(m.y, 1e-6), log2(max(m.z / max(m.y, 1e-6), 1e-6)) - 1.6);
          float prev = texture2D(tPrev, vec2(0.5)).r;
          // Into brighter light the eye closes in about a second; opening to the dark takes three.
          float rate = target > prev ? 2.4 : 0.8;
          float k = uSnap > 0.5 ? 1.0 : 1.0 - exp(-uDt * rate);
          gl_FragColor = vec4(prev + (target - prev) * k, target, 0.0, 1.0);
        }`,
    })
    this.expose = new ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, tEye: { value: null }, uComp: { value: 0 }, uFloor: { value: -6 }, uCeil: { value: 4 } }, vertexShader: VERT,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse, tEye; uniform float uComp, uFloor, uCeil; varying vec2 vUv;
        void main() {
          float ev = clamp(texture2D(tEye, vec2(0.5)).r, uFloor, uCeil);
          // The average brought to middle grey (0.18), then the day's compensation.
          float k = 0.18 * exp2(uComp - ev);
          vec4 c = texture2D(tDiffuse, vUv);
          if (any(isnan(c.rgb)) || any(isinf(c.rgb))) c.rgb = vec3(0.0);
          gl_FragColor = vec4(c.rgb * k, c.a);
        }`,
    })
  }
  render(renderer: WebGLRenderer, write: WebGLRenderTarget, read: WebGLRenderTarget) {
    this.quad.material = this.meter; this.meter.uniforms.tDiffuse.value = read.texture
    renderer.setRenderTarget(this.meterRT); this.quad.render(renderer)
    const prev = this.adapt[this.cur], next = this.adapt[1 - this.cur]
    const a = this.adaptMat.uniforms
    a.tMeter.value = this.meterRT.texture; a.tPrev.value = prev.texture; a.uDt.value = this.dt; a.uSnap.value = this.snap ? 1 : 0
    this.quad.material = this.adaptMat; renderer.setRenderTarget(next); this.quad.render(renderer)
    this.cur = 1 - this.cur; this.snap = false
    const e = this.expose.uniforms
    e.tDiffuse.value = read.texture; e.tEye.value = next.texture; e.uComp.value = this.comp; e.uFloor.value = this.floor; e.uCeil.value = this.ceil
    this.quad.material = this.expose; renderer.setRenderTarget(this.renderToScreen ? null : write); this.quad.render(renderer)
  }
  /** What the eye has adapted to, and what it is metering now (log2 luminance; for the checks: a read back, so not every frame). */
  read(renderer: WebGLRenderer) { const b = new Uint16Array(4); renderer.readRenderTargetPixels(this.adapt[this.cur], 0, 0, 1, 1, b); return { adapted: DataUtils.fromHalfFloat(b[0]), metered: DataUtils.fromHalfFloat(b[1]) } }
  dispose() { this.meterRT.dispose(); for (const t of this.adapt) t.dispose(); this.meter.dispose(); this.adaptMat.dispose(); this.expose.dispose(); this.quad.dispose() }
}

/**
 * Steadying (temporal anti-aliasing): the picture blended with the last one, found again through the depth and the
 * two cameras, the last one held to the colours round each point here (in YCoCg, by their spread), weighted against
 * the brightest so no one sparkle lingers. A fresh start wherever the last picture did not see this point.
 */
class SteadyPass extends Pass {
  hist = [0, 1].map(() => new WebGLRenderTarget(1, 1, { type: HalfFloatType, minFilter: LinearFilter, magFilter: LinearFilter, depthBuffer: false }))
  cur = 0; mat: ShaderMaterial; copy: ShaderMaterial; quad = new FullScreenQuad(); shared: Shared
  constructor(shared: Shared) {
    super(); this.shared = shared
    this.mat = new ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, tHist: { value: null }, tDepth: { value: null }, uInvJ: { value: new Matrix4() }, uPrev: { value: new Matrix4() }, uRes: { value: new Vector2(1, 1) }, uReset: { value: 1 } },
      vertexShader: VERT,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse, tHist, tDepth; uniform mat4 uInvJ, uPrev; uniform vec2 uRes; uniform float uReset;
        varying vec2 vUv;
        ${UNPROJECT}
        vec3 ycocg(vec3 c) { return vec3(dot(c, vec3(0.25, 0.5, 0.25)), dot(c, vec3(0.5, 0.0, -0.5)), dot(c, vec3(-0.25, 0.5, -0.25))); }
        vec3 rgb(vec3 c) { return vec3(c.x + c.y - c.z, c.x + c.z, c.x - c.y - c.z); }
        // The last picture, read sharply (Catmull-Rom from five bilinear looks), so it does not soften frame on frame.
        vec3 history(vec2 uv) {
          vec2 sp = uv * uRes, tp = floor(sp - 0.5) + 0.5, f = sp - tp;
          vec2 w0 = f * (-0.5 + f * (1.0 - 0.5 * f)), w1 = 1.0 + f * f * (-2.5 + 1.5 * f), w2 = f * (0.5 + f * (2.0 - 1.5 * f)), w3 = f * f * (-0.5 + 0.5 * f);
          vec2 w12 = w1 + w2, t0 = (tp - 1.0) / uRes, t3 = (tp + 2.0) / uRes, t12 = (tp + w2 / w12) / uRes;
          vec3 c = texture2D(tHist, vec2(t12.x, t0.y)).rgb * (w12.x * w0.y)
                 + texture2D(tHist, vec2(t0.x, t12.y)).rgb * (w0.x * w12.y)
                 + texture2D(tHist, t12).rgb * (w12.x * w12.y)
                 + texture2D(tHist, vec2(t3.x, t12.y)).rgb * (w3.x * w12.y)
                 + texture2D(tHist, vec2(t12.x, t3.y)).rgb * (w12.x * w3.y);
          float w = w12.x * w0.y + w0.x * w12.y + w12.x * w12.y + w3.x * w12.y + w12.x * w3.y;
          return max(c / w, 0.0);
        }
        void main() {
          vec3 cur = texture2D(tDiffuse, vUv).rgb;
          // (Nothing that is not a number gets into the history: it would spread through it, and through the glow.)
          if (any(isnan(cur)) || any(isinf(cur))) cur = vec3(0.0);
          if (uReset > 0.5) { gl_FragColor = vec4(cur, 1.0); return; }
          // Where this point was in the last picture (the nearest depth round it, so edges move with what is in front).
          vec2 px = 1.0 / uRes; float d = 1.0;
          for (int k = 0; k < 5; k++) { vec2 o = k == 0 ? vec2(0.0) : vec2(k == 1 ? 1.0 : k == 2 ? -1.0 : 0.0, k == 3 ? 1.0 : k == 4 ? -1.0 : 0.0); d = min(d, texture2D(tDepth, vUv + o * px).x); }
          vec3 W = unproject(uInvJ, vUv, d);
          vec4 pc = uPrev * vec4(W, 1.0);
          vec2 puv = pc.xy / pc.w * 0.5 + 0.5;
          if (puv.x < 0.0 || puv.x > 1.0 || puv.y < 0.0 || puv.y > 1.0 || pc.w <= 0.0) { gl_FragColor = vec4(cur, 1.0); return; }
          // The colours round here: their mean and spread, in YCoCg (a tighter box than in RGB).
          vec3 m1 = vec3(0.0), m2 = vec3(0.0), lo = vec3(1e9), hi = vec3(-1e9);
          for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
            vec3 s = ycocg(texture2D(tDiffuse, vUv + vec2(float(x), float(y)) * px).rgb);
            m1 += s; m2 += s * s; lo = min(lo, s); hi = max(hi, s);
          }
          m1 /= 9.0; vec3 sd = sqrt(max(m2 / 9.0 - m1 * m1, 0.0));
          vec3 h = ycocg(history(puv));
          // Held to the box (towards its middle, so the colour's hue survives).
          vec3 bl = max(lo, m1 - 1.25 * sd), bh = min(hi, m1 + 1.25 * sd);
          vec3 cen = 0.5 * (bh + bl), ext = 0.5 * (bh - bl) + 1e-5, off = h - cen, r = abs(off / ext);
          float mx = max(r.x, max(r.y, r.z));
          if (mx > 1.0) h = cen + off / mx;
          vec3 hc = rgb(h);
          // How much of this frame: a tenth when still, more the further the point moved (less of the last to trust).
          float moved = length((puv - vUv) * uRes);
          float a = mix(0.1, 0.3, smoothstep(0.0, 12.0, moved));
          // Weighted by brightness, so a single bright speck cannot hold on.
          float wc = a / (1.0 + max(cur.r, max(cur.g, cur.b))), wh = (1.0 - a) / (1.0 + max(hc.r, max(hc.g, hc.b)));
          gl_FragColor = vec4((cur * wc + hc * wh) / (wc + wh), 1.0);
        }`,
    })
    this.copy = new ShaderMaterial({ uniforms: { tDiffuse: { value: null } }, vertexShader: VERT, fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv; void main() { gl_FragColor = texture2D(tDiffuse, vUv); }' })
  }
  render(renderer: WebGLRenderer, write: WebGLRenderTarget, read: WebGLRenderTarget) {
    const u = this.mat.uniforms, s = this.shared
    const into = this.hist[1 - this.cur]
    u.tDiffuse.value = read.texture; u.tHist.value = this.hist[this.cur].texture; u.tDepth.value = s.depth
    u.uInvJ.value.copy(s.invJ); u.uPrev.value.copy(s.prev); u.uReset.value = s.reset ? 1 : 0
    this.quad.material = this.mat; renderer.setRenderTarget(into); this.quad.render(renderer)
    this.cur = 1 - this.cur
    this.copy.uniforms.tDiffuse.value = into.texture; this.quad.material = this.copy
    renderer.setRenderTarget(this.renderToScreen ? null : write); this.quad.render(renderer)
  }
  setSize(w: number, h: number) { for (const t of this.hist) t.setSize(w, h); this.mat.uniforms.uRes.value.set(w, h); this.shared.reset = true }
  dispose() { for (const t of this.hist) t.dispose(); this.mat.dispose(); this.copy.dispose(); this.quad.dispose() }
}

export function lens(renderer: WebGLRenderer, scene: Scene, camera: PerspectiveCamera, opts: { phone: boolean; still: boolean; ao?: 'off' | 'half' | 'full'; samples?: number; bloom?: boolean; taa?: boolean }) {
  const taa = opts.taa !== false && !opts.samples
  // (The composer's own two buffers need no depth: only the scene's has one.)
  const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType, depthBuffer: false })
  const composer = new EffectComposer(renderer, target)
  const shared: Shared = { depth: null, inv: new Matrix4(), invJ: new Matrix4(), prev: new Matrix4(), viewProj: new Matrix4(), reset: true }
  const scenePass = new ScenePass(scene, camera, shared, opts.samples ?? 0)
  composer.addPass(scenePass)
  let ao: GTAOPass | null = null, aoHalf = true, still = opts.still
  const size = { w: 1, h: 1, pr: 1 }
  /** The occlusion pass, made the first time it is wanted: from the scene's own depth (no second drawing of it). */
  const makeAO = () => {
    const ao = new GTAOPass(scene, camera, 1, 1)
    if (scenePass.rt.depthTexture) ao.setGBuffer(scenePass.rt.depthTexture)
    // A tile is nine metres: reach about a metre, fade with distance.
    ao.updateGtaoMaterial({ radius: 0.12, distanceExponent: 1.4, thickness: 0.08, scale: 1.1, samples: taa ? 8 : 12, distanceFallOff: 1 })
    ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: taa ? 3 : 5, rings: 2, samples: taa ? 6 : 8 })
    // (At half size, unless at full.)
    const full = ao.setSize.bind(ao)
    ao.setSize = (w: number, h: number) => (aoHalf ? full(Math.max(1, Math.round(w / 2)), Math.max(1, Math.round(h / 2))) : full(w, h))
    ao.blendIntensity = 1
    // (Whichever buffer the scene went into this frame: its depth.)
    const drawAO = ao.render.bind(ao)
    ao.render = (...args: Parameters<typeof drawAO>) => {
      if (shared.depth) { ao.gtaoMaterial.uniforms.tDepth.value = shared.depth; ao.pdMaterial.uniforms.tDepth.value = shared.depth }
      drawAO(...args)
    }
    composer.insertPass(ao, 1)
    return ao
  }
  const setAO = (mode: 'off' | 'half' | 'full') => {
    if (mode === 'off') { if (ao) ao.enabled = false; return }
    if (!ao) ao = makeAO()
    aoHalf = mode === 'half'; ao.enabled = true
    ao.setSize(Math.round(size.w * size.pr), Math.round(size.h * size.pr))
  }
  const contact = new ContactPass(camera, shared)
  contact.enabled = !!scenePass.rt.depthTexture
  composer.addPass(contact)
  const clouds = new CloudPass(camera, () => shared.depth)
  clouds.enabled = false
  composer.addPass(clouds)
  const air = new AirPass(camera, shared)
  air.enabled = !!scenePass.rt.depthTexture
  composer.addPass(air)
  const shafts = new ShaftPass(shared)
  shafts.enabled = false
  composer.addPass(shafts)
  const eye = new EyePass()
  composer.addPass(eye)
  const steady = taa ? new SteadyPass(shared) : null
  if (steady) composer.addPass(steady)
  const bloom = new UnrealBloomPass(new Vector2(256, 256), 0.12, 0.6, 1.1)
  bloom.enabled = opts.bloom !== false
  // (Only the light above the threshold spills, eased in over a soft knee — not the whole of anything that crosses it —
  // and none past eight times white, so a bright sky cannot flood the picture.)
  bloom.materialHighPassFilter.fragmentShader = /* glsl */ `
    uniform sampler2D tDiffuse; uniform float luminosityThreshold; uniform float smoothWidth; varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float v = max(c.r, max(c.g, c.b)), t = luminosityThreshold, k = 0.5 * t;
      float soft = clamp(v - t + k, 0.0, 2.0 * k); soft = soft * soft / (4.0 * k + 1e-4);
      float w = max(soft, v - t) / max(v, 1e-4);
      gl_FragColor = vec4(min(c * w, vec3(8.0)), 1.0);
    }`
  bloom.materialHighPassFilter.needsUpdate = true
  composer.addPass(bloom)
  composer.addPass(new OutputPass())
  const smaa = opts.samples || taa ? null : new SMAAPass()
  if (smaa) composer.addPass(smaa)
  const grade = new ShaderPass(Grade)
  grade.uniforms.uSharp.value = taa ? 0.22 : 0
  composer.addPass(grade)
  setAO(opts.ao ?? 'half')
  let t = 0, frame = 0
  const lastPos = new Vector3(), lastDir = new Vector3(), dir = new Vector3()
  return {
    setSize(w: number, h: number, pr: number) {
      size.w = w; size.h = h; size.pr = pr
      composer.setPixelRatio(pr); composer.setSize(w, h)
      // (Bloom need not be sharp: half the size, a third on a phone.)
      bloom.resolution.set((w * pr) / (opts.phone ? 3 : 2), (h * pr) / (opts.phone ? 3 : 2))
      grade.uniforms.uRes.value.set(w * pr, h * pr)
      shared.reset = true
    },
    /** How light it is (0 night, 1 day), and the mist: the glow, the shadows' coolness, the occlusion's weight. */
    setDaylight(d: number, mist = 0) {
      const L = (a: number, b: number) => a + (b - a) * d
      // (In rain, the lights haze over a little wider.)
      bloom.strength = L(0.14, 0.06) + 0.05 * mist; bloom.radius = 0.6 + 0.1 * mist; bloom.threshold = L(1.0, 1.6) - 0.2 * mist
      grade.uniforms.uCool.value = d
      if (ao) ao.blendIntensity = L(0.7, 1)
    },
    /** The eye's say from the day: a compensation in stops, the dimmest light it opens fully to, and the brightest (log2). */
    setEye(comp: number, floor: number, ceil = 6) { eye.comp = comp; eye.floor = floor; eye.ceil = ceil },
    /** The contact shadows' strength (0 when the sun is down or behind cloud), and the sun's direction (towards it). */
    setContact(strength: number, toSun: Vector3) {
      contact.mat.uniforms.uStrength.value = strength
      contact.mat.uniforms.uSun.value.copy(toSun).transformDirection(camera.matrixWorldInverse)
    },
    /** A photograph's look: exposure (×), saturation (0 grey, 1 as is), warmth, film; a vignette and grain (defaults when unset). */
    look(o: { expo?: number; sat?: number; warm?: number; film?: number; vignette?: number; grain?: number }) {
      const u = grade.uniforms
      u.uExpo.value = o.expo ?? 1; u.uSat.value = o.sat ?? 1; u.uWarm.value = o.warm ?? 0; u.uFilm.value = o.film ?? 0
      u.uVignette.value = o.vignette ?? 0.26; u.uGrain.value = o.grain ?? 0.03
    },
    /** Where the sun is in the picture (0–1 across and up) and how much of it can be seen. */
    sun(u: number, v: number, vis: number) { grade.uniforms.uSun.value.set(u, v); grade.uniforms.uSunVis.value = vis },
    /** Start the eye and the steadying afresh (a jump: the camera cut somewhere else). */
    cut() { shared.reset = true; eye.snap = true },
    render(dt: number) {
      if (!still) t += dt
      grade.uniforms.uTime.value = t
      eye.dt = dt
      camera.updateMatrixWorld()
      // A cut — the camera jumped, or turned a long way at once — starts the steadying afresh.
      camera.getWorldDirection(dir)
      if (lastPos.distanceTo(camera.position) > 0.8 || dir.dot(lastDir) < 0.8) shared.reset = true
      lastPos.copy(camera.position); lastDir.copy(dir)
      // (The lens's own tangents, for its fall-off.)
      const th = Math.tan((camera.fov * Math.PI) / 360)
      grade.uniforms.uTan.value.set(th * camera.aspect, th)
      if (steady) {
        // The last picture's camera (unmoved by any sub-pixel offset), then this one's offset for this frame.
        const W = Math.max(1, Math.round(size.w * size.pr)), H = Math.max(1, Math.round(size.h * size.pr))
        camera.clearViewOffset()
        shared.viewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
        const [jx, jy] = JITTER[frame++ % JITTER.length]
        camera.setViewOffset(W, H, jx, jy, W, H)
        shared.invJ.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).invert()
      }
      composer.render(dt)
      if (steady) { shared.prev.copy(shared.viewProj); shared.reset = false }
    },
    /** The occlusion: none, at half size, at full size. */
    setAO,
    /** The air over the picture: the atmosphere's haze table (and how far it reaches, km), the sun's strength; the mist. */
    setAir(o: { ap: Texture; apMax: number; skyE: number; mist: number; mistH: number; sea: number; mistColour: Vector3 }) {
      const u = air.mat.uniforms
      u.tAP.value = o.ap; u.uApMax.value = o.apMax; u.uE.value = o.skyE; u.uMist.value = o.mist; u.uMistH.value = o.mistH; u.uSea.value = o.sea; u.uMistCol.value.copy(o.mistColour)
    },
    /** Under the water (or not): its extinction per world unit, and the light its own scattering fills in. */
    setUnder(on: boolean, sigma?: Vector3, inscatter?: Vector3) {
      const u = air.mat.uniforms; u.uUnder.value = on ? 1 : 0
      if (sigma) u.uWSigma.value.copy(sigma); if (inscatter) u.uWIn.value.copy(inscatter)
    },
    /** The volumetric clouds (null: none, the flat ones stand in). */
    setClouds(look: CloudLook | null) { clouds.look = look; clouds.enabled = !!look && !!scenePass.rt.depthTexture },
    /** Light shafts from the sun at a place in the picture (0–1), by a strength (0 none), in its light's colour. */
    setShafts(u: number, v: number, strength: number, colour: Vector3) {
      shafts.sun.set(u, v); shafts.strength = strength; shafts.colour.copy(colour); shafts.enabled = strength > 0.001 && !!scenePass.rt.depthTexture
    },
    /** The water (water.ts): its layers, drawn after the solid world, told of that picture first. */
    setWater(w: { mask: number; before: (colour: Texture, depth: Texture) => void } | null) { scenePass.water = w },
    /** Whether the water can see the picture under it (a depth to read). */
    canRefract: () => !!scenePass.wet,
    /** Contact shadows, or none. */
    setContactOn(on: boolean) { contact.enabled = on && !!scenePass.rt.depthTexture },
    /** The glow round bright lights, or none. */
    setBloom(on: boolean) { bloom.enabled = on },
    /** For less motion: the film grain holds still. */
    setStill(on: boolean) { still = on },
    /** What it is doing (for the checks and the settings). */
    state: () => ({ ao: ao?.enabled ? (aoHalf ? 'half' : 'full') : 'off', bloom: bloom.enabled, taa: !!steady, contact: contact.enabled, clouds: clouds.enabled, shafts: shafts.enabled }),
    /** The eye: adapted and metered log2 luminance (a read back from the graphics card: for the checks only). */
    eye: () => eye.read(renderer),
    dispose() {
      composer.dispose(); target.dispose(); scenePass.dispose(); ao?.dispose(); contact.dispose(); clouds.dispose(); air.dispose(); shafts.dispose(); eye.dispose(); steady?.dispose()
      camera.clearViewOffset()
    },
  }
}

// (Kept for the checks: the jitter cycle's offsets all lie within half a pixel and average to nearly nothing.)
export const jitterCycle = JITTER
