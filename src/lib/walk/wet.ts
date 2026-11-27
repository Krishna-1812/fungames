/**
 * The weather's hold on surfaces (weather.ts sets these; terrain.ts, facade.ts
 * and water.ts read them in their shaders): how wet everything is, how hard it
 * is raining this moment, and how choppy the wind makes the sea.
 */
export const wetness = {
  /** How soaked the ground and the walls are: 0 dry, 1 streaming (it soaks in as it rains, and dries slowly after). */
  wet: { value: 0 },
  /** How hard it is raining now (0 to 1): rings in the puddles and on the sea. */
  rain: { value: 0 },
  /** How rough the wind makes the sea's small waves (1 a breeze). */
  chop: { value: 1 },
}

/** Rings spreading where raindrops land: their slope (x, z) to bend a surface's normal by, and their height (the third): two layers of cells, a drop in each now and then. */
export const RIPPLES_GLSL = /* glsl */ `
vec3 rRipples(vec2 p, float t, float amount) {
  vec3 g = vec3(0.0);
  for (int k = 0; k < 2; k++) {
    float sc = k == 0 ? 34.0 : 53.0;
    vec2 q = p * sc + float(k) * 17.3, i = floor(q), f = fract(q) - 0.5;
    float h = fract(sin(dot(i, vec2(127.1, 311.7)) + float(k) * 3.1) * 43758.5453);
    vec2 o = (vec2(fract(h * 13.7), fract(h * 71.3)) - 0.5) * 0.5;
    vec2 d = f - o;
    float ph = fract(t * (0.9 + h * 0.6) + h);
    float r = length(d), front = ph * 0.45;
    float env = exp(-abs(r - front) * 22.0) * (1.0 - ph) * step(h, amount);
    g.xy += d / (r + 1e-3) * sin((r - front) * 42.0) * env;
    g.z += cos((r - front) * 42.0) * env;
  }
  return g;
}
`
