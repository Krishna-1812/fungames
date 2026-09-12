/**
 * The Deep Sea's water column.
 *
 * One background, keyed to real depth rather than to a fixed set of five
 * flat CSS colours per zone: sunlit cyan gives way to a twilight blue, then
 * to black, on the same schedule real seawater actually loses its light —
 * most of it is gone by two hundred metres, all of it well before a
 * thousand. God rays exist only near the surface and fade out exactly where
 * the sunlight zone ends. Marine snow drifts at every depth. Bioluminescent
 * sparks only start appearing once the water is dark enough for them to be
 * the only light left, and thin out again in the emptiest stretches of the
 * abyss before the trenches bring the last hadal life back.
 *
 * The CSS gradient underneath stays in place for anything without WebGL2.
 */
import { glsl } from './gl'

export const DEEP_SEA_FRAG = glsl(`
uniform float u_D; // current depth in metres, 0 at the surface

vec3 depthColour(float d) {
  vec3 surface  = vec3(0.62, 0.88, 0.93);
  vec3 shallow  = vec3(0.07, 0.42, 0.58);
  vec3 twilight = vec3(0.035, 0.14, 0.24);
  vec3 midnight = vec3(0.012, 0.028, 0.05);
  vec3 black    = vec3(0.004, 0.007, 0.011);

  vec3 c = mix(surface, shallow, smoothstep(0.0, 45.0, d));
  c = mix(c, twilight, smoothstep(45.0, 200.0, d));
  c = mix(c, midnight, smoothstep(200.0, 650.0, d));
  c = mix(c, black, smoothstep(650.0, 1400.0, d));
  return c;
}

/* Sparse drifting points, two grid scales layered for near/far snow. Seeded
   off both position and a slow depth-linked drift so the field genuinely
   moves as you scroll rather than just sitting there. */
float speckField(vec2 p, float scale, float drift, float sparse) {
  vec2 gp = p * scale + vec2(0.0, drift);
  vec2 id = floor(gp);
  vec2 f = fract(gp);
  float h = hash21(id);
  if (h < sparse) return 0.0;
  vec2 c = vec2(hash21(id + 1.7), hash21(id + 5.3));
  float d2 = length(f - c);
  return smoothstep(0.07, 0.0, d2);
}

void main() {
  vec2 uv = vUv;
  vec2 p = centred(uv);
  float t = u_time;
  float d = max(u_D, 0.0);

  vec3 col = depthColour(d);

  // A little brighter toward the top of the frame and the centre, everywhere
  // — the surface gets real daylight there, the deep gets a hint of the same
  // shape so it never reads as a completely flat fill.
  col += vec3(0.05, 0.09, 0.11) * (1.0 - uv.y) * smoothstep(1400.0, 0.0, d);
  col *= 1.0 - dot(p, p) * 0.14;

  // God rays. Fully gone by the bottom of the sunlight zone.
  float rayMask = smoothstep(190.0, 10.0, d);
  if (rayMask > 0.001) {
    float rays = fbm(vec2(p.x * 2.6 + t * 0.015, p.y * 0.4), 4);
    rays = pow(clamp(rays, 0.0, 1.0), 3.2);
    col += vec3(0.55, 0.82, 0.88) * rays * rayMask * (1.0 - uv.y) * 0.55;
  }

  // Marine snow — present at every depth, the one constant of the whole page.
  float driftT = t * 0.02 + d * 0.00035;
  float snowNear = speckField(p, 9.0, driftT * 1.6, 0.986);
  float snowFar = speckField(p * 1.7 + 4.1, 14.0, driftT, 0.975);
  float snowVisible = smoothstep(0.0, 40.0, d) * 0.8 + 0.2;
  col += vec3(0.65, 0.74, 0.8) * (snowNear * 0.5 + snowFar * 0.3) * snowVisible;

  // Bioluminescence. Ramps in as the twilight zone loses the last of the
  // sun, peaks through the midnight zone and the vents, and thins out again
  // once the abyss's near-total emptiness sets in — then a last few points
  // for the hadal life still holding on in the trenches.
  float bioRamp = smoothstep(120.0, 500.0, d) * smoothstep(6000.0, 2600.0, d)
                + smoothstep(5200.0, 6200.0, d) * 0.5;
  if (bioRamp > 0.001) {
    float driftB = t * 0.03 + d * 0.0002;
    float spB = speckField(p * 2.3 + 1.3, 6.0, driftB, 0.978);
    float twinkle = 0.55 + 0.45 * sin(t * 2.4 + dot(p, vec2(37.1, 91.7)));
    vec3 bio = mix(vec3(0.35, 0.95, 0.78), vec3(0.3, 0.75, 0.98), step(0.5, hash21(floor(p * 6.0))));
    col += bio * spB * bioRamp * twinkle * 1.4;
  }

  col = aces(col * 1.05);
  col = toSRGB(col);
  col = dither(col, uv * u_res);
  fragColor = vec4(col, 1.0);
}
`)
