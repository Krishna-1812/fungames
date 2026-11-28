/**
 * Footprints and tyre tracks (terrain.ts reads them): a small square of the ground round you, four metres a side,
 * into which each step on sand or snow presses a print and each wheel a track; the ground's shader sinks the sand
 * there, darkens it a little and bends its light. They settle away over a minute or so as the wind smooths them,
 * and the sea washes them out wherever it runs up the sand. The square follows you: when you walk off its middle it is moved, prints and all.
 *
 * One small buffer (256²) kept frame to frame, with a pass that fades and shifts it and quads that stamp it; nothing
 * read back. The ground's shader only looks at it within the square.
 */
import {
  Camera, CustomBlending, HalfFloatType, MaxEquation, OneFactor, LinearFilter, Mesh, OrthographicCamera, PlaneGeometry, RedFormat, Scene, ShaderMaterial, Vector4,
  type WebGLRenderer, WebGLRenderTarget,
} from 'three'
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js'
import { METRE } from './body'

/** The square's size (world units: four metres), and its buffer's. */
export const FOOT_SIZE = 4 * METRE, FOOT_RES = 256
/** How long a print takes to settle away (seconds, to a third). */
export const FOOT_LIFE = 70

export type Stamp = { x: number; z: number; yaw: number; len: number; wid: number; depth: number }

/** The print of a foot (or a tyre) at a point in the buffer's square: a soft-edged oval, deepest at the heel and ball. */
export const STAMP_GLSL = /* glsl */ `
float footShape(vec2 q) {
  // q: -1..1 along and across the print.
  float r = length(q * vec2(1.0, 1.0));
  float body = 1.0 - smoothstep(0.75, 1.0, r);
  float heelBall = 0.75 + 0.25 * cos(q.x * 3.14159 * 1.6);
  return body * heelBall;
}`

export function footprints(renderer: WebGLRenderer) {
  const make = () => new WebGLRenderTarget(FOOT_RES, FOOT_RES, { type: HalfFloatType, format: RedFormat, minFilter: LinearFilter, magFilter: LinearFilter, depthBuffer: false })
  const rt = [make(), make()]
  let cur = 0
  /** Where the square is (its middle), as the ground reads it: x, z, 1/size, and whether it is on. */
  const uniform = { value: new Vector4(0, 0, 1 / FOOT_SIZE, 0) }
  const fade = new ShaderMaterial({
    uniforms: { tPrev: { value: null }, uShift: { value: [0, 0] }, uKeep: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: /* glsl */ `
      uniform sampler2D tPrev; uniform vec2 uShift; uniform float uKeep; varying vec2 vUv;
      void main() {
        vec2 q = vUv + uShift;
        float f = q.x < 0.0 || q.x > 1.0 || q.y < 0.0 || q.y > 1.0 ? 0.0 : texture2D(tPrev, q).r;
        gl_FragColor = vec4(f * uKeep, 0.0, 0.0, 1.0);
      }`,
    depthTest: false, depthWrite: false,
  })
  const quad = new FullScreenQuad(fade)
  // The stamps: a unit quad per print, placed in the square's own space, kept to the deepest (max blending).
  const stampMat = new ShaderMaterial({
    uniforms: { uDepth: { value: 1 } },
    vertexShader: 'varying vec2 vQ; void main() { vQ = position.xy * 2.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: STAMP_GLSL + 'uniform float uDepth; varying vec2 vQ; void main() { gl_FragColor = vec4(footShape(vQ) * uDepth, 0.0, 0.0, 1.0); }',
    depthTest: false, depthWrite: false, transparent: true,
  })
  // (MAX blending: a print pressed into another keeps the deeper of the two.)
  stampMat.blending = CustomBlending; stampMat.blendEquation = MaxEquation
  stampMat.blendSrc = OneFactor; stampMat.blendDst = OneFactor
  const stampScene = new Scene()
  const stamp = new Mesh(new PlaneGeometry(1, 1), stampMat)
  stampScene.add(stamp)
  const cam = new OrthographicCamera(-0.5, 0.5, 0.5, -0.5, -1, 1)
  const pending: Stamp[] = []
  let cx = 0, cz = 0, started = false

  return {
    /** For the ground's shader. */
    texture: () => rt[cur].texture, uniform,
    /** A print (a foot or a tyre) pressed in at a point (world units), heading yaw, so long and wide. */
    press(s: Stamp) { if (pending.length < 16) pending.push(s) },
    /** Each frame: fade what is there, follow you, press in what was made. */
    update(dt: number, at: { x: number; z: number }, on: boolean) {
      uniform.value.w = on ? 1 : 0
      if (!on && !pending.length) return
      if (!started) { cx = at.x; cz = at.z; started = true }
      // Moved off the middle by a quarter: the square moves, by whole texels.
      let sx = 0, sz = 0
      const tex = FOOT_SIZE / FOOT_RES
      if (Math.abs(at.x - cx) > FOOT_SIZE / 4 || Math.abs(at.z - cz) > FOOT_SIZE / 4) {
        const nx = Math.round(at.x / tex) * tex, nz = Math.round(at.z / tex) * tex
        sx = (nx - cx) / FOOT_SIZE; sz = (nz - cz) / FOOT_SIZE; cx = nx; cz = nz
      }
      const was = renderer.getRenderTarget()
      const next = rt[1 - cur]
      fade.uniforms.tPrev.value = rt[cur].texture
      // (The square's v runs with z: its uv is (x, z) about its middle, as the ground's shader reads it.)
      fade.uniforms.uShift.value = [sx, sz]
      fade.uniforms.uKeep.value = Math.exp(-dt / FOOT_LIFE)
      renderer.setRenderTarget(next); quad.render(renderer)
      cur = 1 - cur
      if (pending.length) {
        const ac = renderer.autoClear; renderer.autoClear = false
        for (const s of pending) {
          stamp.position.set((s.x - cx) / FOOT_SIZE, (s.z - cz) / FOOT_SIZE, 0)
          stamp.rotation.set(0, 0, s.yaw)
          stamp.scale.set(s.len / FOOT_SIZE, s.wid / FOOT_SIZE, 1)
          stamp.updateMatrixWorld()
          stampMat.uniforms.uDepth.value = s.depth
          renderer.render(stampScene, cam as Camera)
        }
        renderer.autoClear = ac
        pending.length = 0
      }
      renderer.setRenderTarget(was)
      uniform.value.set(cx, cz, 1 / FOOT_SIZE, on ? 1 : 0)
    },
    dispose() { for (const t of rt) t.dispose(); fade.dispose(); quad.dispose(); stampMat.dispose(); stamp.geometry.dispose() },
  }
}
