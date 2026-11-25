/**
 * The walk's lens (walker.ts): what a camera does to the light between the
 * world and the picture.
 *
 *   - ambient occlusion: the soft dark where things meet and light cannot
 *     get in — under eaves, at the foot of a wall, between two buildings,
 *     round your feet (GTAO: from the depth and normals of the scene);
 *   - bloom: light too bright for the picture spilling round itself — the
 *     sun's glitter on the sea, a lamp, a lit window at night;
 *   - tone mapping into the picture's range (ACES, as before), then a grade:
 *     a gentle contrast curve, shadows a touch cool, the corners falling off
 *     a little as through a lens, and a whisper of grain so flat colour
 *     never bands (still, for anyone who asked for reduced motion);
 *   - the sun, looked towards: its glare, and the faint ghosts a lens throws
 *     across the picture from it (none when something stands in front of it);
 *   - and the edges smoothed (SMAA, on the finished picture: a fraction of what
 *     multisampling costs), everything rendered in floating point until the
 *     tone mapping.
 *
 * The occlusion is worked out at half the picture's size (it is soft; nobody
 * can tell), and a phone does without it (its cost is a second drawing of
 * the scene), with bloom at a third of the size. If a machine still cannot
 * keep up, walker.ts steps the quality down (drop()).
 */
import { HalfFloatType, type PerspectiveCamera, type Scene, Vector2, type WebGLRenderer, WebGLRenderTarget } from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js'

const Grade = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uGrain: { value: 0.018 }, uRes: { value: new Vector2(1, 1) }, uVignette: { value: 0.26 }, uCool: { value: 1 }, uSun: { value: new Vector2(0.5, 0.5) }, uSunVis: { value: 0 } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uTime, uGrain, uVignette, uCool, uSunVis; uniform vec2 uRes, uSun;
    varying vec2 vUv;
    float hash(vec2 p) { p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      // A gentle S: a little more depth in the shadows and snap in the lights.
      c = mix(c, c * c * (3.0 - 2.0 * c), 0.2);
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      // Shadows a touch cool, as daylight under a blue sky leaves them.
      c += vec3(-0.01, 0.0, 0.016) * (1.0 - smoothstep(0.0, 0.45, l)) * uCool;
      // The sun's glare, and its ghosts strung along the line through the middle of the picture.
      if (uSunVis > 0.001) {
        float asp = uRes.x / uRes.y;
        vec2 d = (vUv - uSun) * vec2(asp, 1.0);
        float r = length(d);
        vec3 glare = vec3(1.0, 0.98, 0.95) * (exp(-r * 6.0) * 0.22 + exp(-r * 30.0) * 0.45);
        // A faint starburst of rays.
        float ang = atan(d.y, d.x);
        glare += vec3(1.0, 0.98, 0.95) * pow(abs(sin(ang * 3.0 + 0.4)), 40.0) * exp(-r * 9.0) * 0.12;
        vec2 axis = vec2(0.5) - uSun;
        for (int k = 0; k < 4; k++) {
          float fk = float(k);
          vec2 gp = uSun + axis * (0.55 + fk * 0.45);
          float gr = 0.025 + 0.02 * fk * fk * 0.5;
          float gd = length((vUv - gp) * vec2(asp, 1.0));
          vec3 tint = fk < 1.0 ? vec3(0.55, 0.8, 1.0) : fk < 2.0 ? vec3(0.7, 1.0, 0.85) : fk < 3.0 ? vec3(0.75, 0.7, 1.0) : vec3(0.6, 0.9, 1.0);
          glare += tint * (smoothstep(gr, gr * 0.7, gd) * 0.028 + smoothstep(gr * 1.02, gr * 0.96, gd) * smoothstep(gr * 0.9, gr * 0.96, gd) * 0.03);
        }
        c += glare * uSunVis;
      }
      // The lens: its corners fall off a little.
      vec2 q = vUv - 0.5; q.x *= uRes.x / uRes.y;
      c *= 1.0 - uVignette * smoothstep(0.3, 0.95, length(q));
      // Grain, fine enough to read only as the end of banding.
      c += (hash(vUv * uRes + fract(uTime) * 61.0) - 0.5) * uGrain;
      gl_FragColor = vec4(c, 1.0);
    }`,
}

export function lens(renderer: WebGLRenderer, scene: Scene, camera: PerspectiveCamera, opts: { phone: boolean; still: boolean; ao?: boolean; samples?: number; bloom?: boolean }) {
  const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: opts.samples ?? 0 })
  const composer = new EffectComposer(renderer, target)
  composer.addPass(new RenderPass(scene, camera))
  let ao: GTAOPass | null = null
  if (!opts.phone && opts.ao !== false) {
    ao = new GTAOPass(scene, camera, 1, 1)
    // A tile is three and a half metres: reach about a metre, fade with distance.
    ao.updateGtaoMaterial({ radius: 0.4, distanceExponent: 1.5, thickness: 0.6, scale: 1.25, samples: 8, distanceFallOff: 1 })
    ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 8 })
    // (At half size.)
    const full = ao.setSize.bind(ao)
    ao.setSize = (w: number, h: number) => full(Math.max(1, Math.round(w / 2)), Math.max(1, Math.round(h / 2)))
    ao.blendIntensity = 1
    // Leaf sprays are cards cut out by their picture: the occlusion pass would see them as solid squares, so they are
    // left out of what it looks at (userData.noAO).
    let skip: { visible: boolean }[] | null = null
    const drawAO = ao.render.bind(ao)
    ao.render = (...args: Parameters<typeof drawAO>) => {
      if (!skip) { skip = []; scene.traverse((o) => { if (o.userData.noAO) skip!.push(o) }) }
      const was = skip.map((o) => o.visible); for (const o of skip) o.visible = false
      drawAO(...args)
      skip.forEach((o, i) => { o.visible = was[i] })
    }
    composer.addPass(ao)
  }
  const bloom = new UnrealBloomPass(new Vector2(256, 256), 0.16, 0.2, 7)
  if (opts.bloom !== false) composer.addPass(bloom)
  composer.addPass(new OutputPass())
  const smaa = opts.samples ? null : new SMAAPass()
  if (smaa) composer.addPass(smaa)
  const grade = new ShaderPass(Grade)
  composer.addPass(grade)
  let t = 0
  return {
    setSize(w: number, h: number, pr: number) {
      composer.setPixelRatio(pr); composer.setSize(w, h)
      // (Bloom need not be sharp: half the size, a third on a phone.)
      bloom.resolution.set((w * pr) / (opts.phone ? 3 : 2), (h * pr) / (opts.phone ? 3 : 2))
      grade.uniforms.uRes.value.set(w * pr, h * pr)
    },
    /** How light it is (0 night, 1 day): at night the lamps and the lit windows glow, and the shadows need no cooling. */
    setDaylight(d: number) {
      const L = (a: number, b: number) => a + (b - a) * d
      bloom.strength = L(0.3, 0.12); bloom.threshold = L(1.4, 9); bloom.radius = L(0.35, 0.2)
      grade.uniforms.uCool.value = d
      if (ao) ao.blendIntensity = L(0.6, 1)
    },
    /** Where the sun is in the picture (0–1 across and up) and how much of it can be seen. */
    sun(u: number, v: number, vis: number) { grade.uniforms.uSun.value.set(u, v); grade.uniforms.uSunVis.value = vis },
    render(dt: number) {
      if (!opts.still) t += dt
      grade.uniforms.uTime.value = t
      composer.render(dt)
    },
    /** Gives up the most costly thing left (the occlusion; then, for walker.ts, sharper shadows and pixels). Whether there was any to give. */
    drop() {
      if (ao && ao.enabled) { ao.enabled = false; return true }
      return false
    },
    dispose() { composer.dispose(); target.dispose(); ao?.dispose() },
  }
}
