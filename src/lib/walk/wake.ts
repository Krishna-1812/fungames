/**
 * Ripples round you (water.ts reads them): a small sea of its own, 256² cells over some twenty-two metres of water
 * centred on you, run as the wave equation each frame — so the rings from a stroke or a jump spread out at the
 * speed short waves really go, cross each other and die away; rain pocks it everywhere it falls; a boat passing
 * close cuts through it. The square follows you, ripples and all.
 *
 * Two small buffers kept frame to frame (height and its rate of change), a pass that steps them, quads that press
 * disturbances in. Nothing read back.
 */
import {
  AddEquation, Camera, CustomBlending, HalfFloatType, LinearFilter, Mesh, OneFactor, OrthographicCamera, PlaneGeometry, RGFormat, Scene,
  ShaderMaterial, Vector4, type WebGLRenderer, WebGLRenderTarget,
} from 'three'
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js'
import { METRE } from './body'

/** The square (world units) and its cells. */
export const WAKE_SIZE = 22 * METRE, WAKE_RES = 256
/**
 * The speed ripples travel (world units a second: 0.8 m/s, a swimmer's half-metre waves), and how fast they
 * die away (a second). One step is stable while speed × step / cell stays under 1/√2 (checked in check-walk).
 */
export const WAKE_SPEED = 0.8 * METRE, WAKE_DAMP = 0.55
export const wakeStable = (dt: number) => (WAKE_SPEED * dt) / (WAKE_SIZE / WAKE_RES) < Math.SQRT1_2

export type Poke = { x: number; z: number; r: number; amount: number }

export function wakes(renderer: WebGLRenderer) {
  const make = () => new WebGLRenderTarget(WAKE_RES, WAKE_RES, { type: HalfFloatType, format: RGFormat, minFilter: LinearFilter, magFilter: LinearFilter, depthBuffer: false })
  const rt = [make(), make()]
  let cur = 0
  /** For the water's shader: the square's middle (x, z), one over its size, and whether it is there. */
  const uniform = { value: new Vector4(0, 0, 1 / WAKE_SIZE, 0) }
  const step = new ShaderMaterial({
    uniforms: { tPrev: { value: null }, uShift: { value: [0, 0] }, uK: { value: 0 }, uDamp: { value: 1 }, uDt: { value: 0 }, uTexel: { value: 1 / WAKE_RES }, uRain: { value: 0 }, uSeed: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: /* glsl */ `
      uniform sampler2D tPrev; uniform vec2 uShift; uniform float uK, uDamp, uDt, uTexel, uRain, uSeed; varying vec2 vUv;
      vec2 at(vec2 q) { return q.x < 0.0 || q.x > 1.0 || q.y < 0.0 || q.y > 1.0 ? vec2(0.0) : texture2D(tPrev, q).rg; }
      float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      void main() {
        vec2 q = vUv + uShift;
        vec2 s = at(q);
        float lap = at(q + vec2(uTexel, 0.0)).r + at(q - vec2(uTexel, 0.0)).r + at(q + vec2(0.0, uTexel)).r + at(q - vec2(0.0, uTexel)).r - 4.0 * s.r;
        // The wave equation: the height's rate of change pulled by its neighbours (speed² ∇²h), damped.
        float v = (s.g + uK * lap * uDt) * uDamp;
        float h = s.r + v * uDt;
        // Rain: a drop here and there, pressing the surface down where it lands.
        if (uRain > 0.0 && hash(floor(vUv * 256.0) + uSeed) < uRain * 0.0016) v -= 0.6;
        // (Held in range, and nothing that is not a number gets in.)
        h = clamp(h, -1.0, 1.0); v = clamp(v, -30.0, 30.0);
        if (h != h || v != v) { h = 0.0; v = 0.0; }
        // Faded towards the square's edge, so nothing reflects back off it.
        float e = smoothstep(0.0, 0.08, min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y)));
        gl_FragColor = vec4(h * e, v * e, 0.0, 1.0);
      }`,
    depthTest: false, depthWrite: false,
  })
  const quad = new FullScreenQuad(step)
  // A poke: a soft dimple of velocity, added in.
  const pokeMat = new ShaderMaterial({
    uniforms: { uAmount: { value: 1 } },
    vertexShader: 'varying vec2 vQ; void main() { vQ = position.xy * 2.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float uAmount; varying vec2 vQ; void main() { float r = dot(vQ, vQ); gl_FragColor = vec4(0.0, -uAmount * exp(-r * 4.0) * step(r, 1.0), 0.0, 0.0); }',
    depthTest: false, depthWrite: false, transparent: true,
  })
  pokeMat.blending = CustomBlending; pokeMat.blendEquation = AddEquation; pokeMat.blendSrc = OneFactor; pokeMat.blendDst = OneFactor
  const pokeScene = new Scene(), poke = new Mesh(new PlaneGeometry(1, 1), pokeMat)
  pokeScene.add(poke)
  const cam = new OrthographicCamera(-0.5, 0.5, 0.5, -0.5, -1, 1)
  const pending: Poke[] = []
  let cx = 0, cz = 0, started = false, seed = 0

  return {
    texture: () => rt[cur].texture, uniform,
    /** A disturbance at a point (world units): its radius and how hard (a stroke about 1, a jump in 6). */
    poke(p: Poke) { if (pending.length < 24) pending.push(p) },
    /** Whether a point is in the square (and so its ripples are drawn). */
    covers: (x: number, z: number) => started && Math.abs(x - cx) < WAKE_SIZE * 0.45 && Math.abs(z - cz) < WAKE_SIZE * 0.45,
    update(dt: number, at: { x: number; z: number }, o: { on: boolean; rain: number }) {
      uniform.value.w = o.on ? 1 : 0
      if (!o.on) return
      if (!started) { cx = at.x; cz = at.z; started = true }
      let sx = 0, sz = 0
      const cell = WAKE_SIZE / WAKE_RES
      if (Math.abs(at.x - cx) > WAKE_SIZE / 5 || Math.abs(at.z - cz) > WAKE_SIZE / 5) {
        const nx = Math.round(at.x / cell) * cell, nz = Math.round(at.z / cell) * cell
        sx = (nx - cx) / WAKE_SIZE; sz = (nz - cz) / WAKE_SIZE; cx = nx; cz = nz
      }
      const was = renderer.getRenderTarget()
      // (In steps short enough to be stable, at most three a frame.)
      const h = Math.min(dt, 0.05), n = Math.max(1, Math.min(3, Math.ceil(h / (1 / 60))))
      const sub = h / n, c = WAKE_SPEED / cell
      for (let k = 0; k < n; k++) {
        const u = step.uniforms
        u.tPrev.value = rt[cur].texture; u.uShift.value = k === 0 ? [sx, sz] : [0, 0]
        u.uK.value = c * c; u.uDt.value = sub; u.uDamp.value = Math.exp(-sub / WAKE_DAMP); u.uRain.value = o.rain; u.uSeed.value = (seed = (seed + 0.618) % 97)
        renderer.setRenderTarget(rt[1 - cur]); quad.render(renderer)
        cur = 1 - cur
      }
      if (pending.length) {
        const ac = renderer.autoClear; renderer.autoClear = false
        renderer.setRenderTarget(rt[cur])
        for (const p of pending) {
          poke.position.set((p.x - cx) / WAKE_SIZE, (p.z - cz) / WAKE_SIZE, 0)
          poke.scale.set((2 * p.r) / WAKE_SIZE, (2 * p.r) / WAKE_SIZE, 1); poke.updateMatrixWorld()
          pokeMat.uniforms.uAmount.value = p.amount * 4
          renderer.render(pokeScene, cam as Camera)
        }
        renderer.autoClear = ac
        pending.length = 0
      }
      renderer.setRenderTarget(was)
      uniform.value.set(cx, cz, 1 / WAKE_SIZE, 1)
    },
    dispose() { for (const t of rt) t.dispose(); step.dispose(); quad.dispose(); pokeMat.dispose(); poke.geometry.dispose() },
  }
}
