/**
 * The Deep Sea's water.
 *
 * What you would see from a submersible window on the way down, worked from
 * how seawater actually treats light:
 *
 *  - Water takes the red out of sunlight within a few metres, the green
 *    within a few tens, and the blue last. So the colour of the water at a
 *    depth is not picked from a palette: it is what is left of white light
 *    after that much water, and the top of the window is brighter than the
 *    bottom because it is looking up through less of it.
 *  - Near the surface the surface itself is overhead: a bright, moving
 *    ceiling, with shafts of light coming down through it and a net of
 *    caustics on everything near.
 *  - By two hundred metres a hundredth of the light is left; by a thousand,
 *    none. From there the only light is the submersible's own lamp, which
 *    shows as a beam because the water is full of marine snow, and the
 *    animals' own light, which is blue because blue is what carries.
 *  - At the very bottom the floor comes up into the lamp: pale silt.
 *
 * The lamp follows the pointer. The CSS gradient underneath stays for
 * anything without WebGL2.
 */
import { glsl } from './gl'

export const DEEP_SEA_WATER_FRAG = glsl(`
uniform float u_D;      // depth at the middle of the window, metres
uniform float u_floor;  // how far the sea floor has come up the window, 0..1 of its height
uniform float u_scroll; // metres travelled, for things that should stream past as you sink

// What is left of sunlight after this many metres of clear ocean water.
vec3 sunlightAt(float metres) {
  return exp(-vec3(0.36, 0.060, 0.0135) * max(metres, 0.0));
}

// Flecks of marine snow on one plane: a point somewhere in each cell, some cells empty.
float snow(vec2 p, float scale, float keep, float size) {
  vec2 g = p * scale;
  vec2 id = floor(g);
  if (hash21(id) > keep) return 0.0;
  vec2 c = 0.15 + 0.7 * vec2(hash21(id + 1.7), hash21(id + 5.3));
  return smoothstep(size, 0.0, length(fract(g) - c));
}

void main() {
  vec2 uv = vUv;
  vec2 p = centred(uv);                 // y up, the short side is -0.5..0.5
  float t = u_time;
  float aspect = u_res.x / u_res.y;
  // The window is about thirty metres tall near the top of the sea and shows less as it gets dark.
  float d = max(u_D + (0.5 - uv.y) * 26.0, 0.0);

  /* ---- daylight ---- */
  vec3 sun = sunlightAt(d);
  // Water glows with the light scattered in it; looking up there is more of it.
  // And the deeper it is, the bluer what is scattered: green gives out a long way above blue.
  vec3 hue = mix(vec3(0.10, 0.60, 0.76), vec3(0.015, 0.17, 0.52), smoothstep(15.0, 260.0, d));
  vec3 scatter = hue * pow(sun.b, 0.82) + vec3(0.36, 0.66, 0.58) * sun.g * 0.42 + vec3(0.9, 0.5, 0.3) * sun.r * 0.18;
  vec3 col = scatter * (0.40 + 0.55 * uv.y);
  float light = sun.b;                  // how much day is left, 0..1

  // The surface, overhead, for as long as it is near enough to see.
  float near = smoothstep(46.0, 0.0, u_D);
  if (near > 0.001) {
    // Perspective: the further up the window, the further away across the surface.
    float up = clamp((uv.y - 0.30) / 0.70, 0.0, 1.0);
    vec2 sp = vec2(p.x / (0.25 + up * 0.9), 1.6 / (0.18 + (1.0 - up)));
    float w = ridge(sp * vec2(1.4, 0.9) + vec2(t * 0.11, t * 0.07), 3) * ridge(sp * vec2(0.9, 1.3) - vec2(t * 0.06, t * 0.09), 2);
    float ceiling = smoothstep(0.35, 1.0, up) * (0.35 + 1.9 * pow(clamp(w * 2.0, 0.0, 1.0), 1.6));
    // Straight up is the bright window to the sky; off to the sides the surface is a mirror of the deep.
    float snell = exp(-pow(p.x / (0.55 * aspect), 2.0) * 1.4);
    col += vec3(0.62, 0.90, 0.96) * ceiling * near * (0.25 + 0.75 * snell) * 0.26;
  }

  // Shafts of light, leaning, moving slowly, gone with the day.
  float shaftMask = smoothstep(0.004, 0.25, light) * smoothstep(0.1, 0.9, uv.y + 0.25);
  if (shaftMask > 0.001) {
    float lean = p.x + (uv.y - 1.0) * 0.32;
    float sh = fbm(vec2(lean * 5.5 + t * 0.03, t * 0.05), 3) * fbm(vec2(lean * 13.0 - t * 0.04, 3.0), 2);
    sh = pow(clamp(sh * 3.2, 0.0, 1.0), 2.2);
    col += scatter * sh * shaftMask * 0.72;
  }

  // Caustics, on the water's own haze close to the surface.
  float cm = smoothstep(26.0, 2.0, u_D) * (1.0 - uv.y * 0.5);
  if (cm > 0.001) {
    float ca = ridge(p * vec2(3.4, 2.3) + vec2(t * 0.10, t * 0.05), 2) * ridge(p * vec2(2.5, 3.1) - vec2(t * 0.06, t * 0.12), 2);
    col += vec3(0.55, 0.9, 0.9) * pow(clamp(ca * 2.3, 0.0, 1.0), 2.5) * cm * 0.45;
  }

  /* ---- the lamp ---- */
  // On as the day goes: a wide beam from under the window, leaning toward the pointer.
  float lampOn = smoothstep(0.05, 0.002, light);
  vec2 from = vec2((u_pointer.x - 0.5) * aspect * 0.25, -0.62);
  vec2 aim = normalize(vec2((u_pointer.x - 0.5) * aspect, u_pointer.y - 0.5) * 0.9 - from + vec2(0.0, 0.35));
  vec2 rel = p - from;
  float along = dot(rel, aim);
  float across = length(rel - aim * along);
  float beam = exp(-pow(across / (0.10 + 0.34 * max(along, 0.0)), 2.0)) * smoothstep(0.0, 0.12, along) / (1.0 + along * along * 2.4);
  float pool = exp(-dot(rel, rel) * 3.2) * 0.5;
  float lamp = (beam + pool) * lampOn;
  col += vec3(0.42, 0.62, 0.72) * lamp * 0.085;       // the water itself, faintly, in the beam

  /* ---- marine snow ---- */
  // Three planes at different distances. It falls, and streams upward past the window as you sink.
  float flow = t * 0.035 + u_scroll * 0.012;
  float sFar  = snow(p + vec2(t * 0.004, flow * 0.5), 30.0, 0.26, 0.07);
  float sMid  = snow(p + vec2(-t * 0.006, flow) + 7.3, 17.0, 0.18, 0.06);
  float sNear = snow(p + vec2(t * 0.010, flow * 1.9) + 3.1, 8.0, 0.10, 0.07);
  float flakes = sFar * 0.35 + sMid * 0.6 + sNear * 0.9;
  // Seen by daylight as pale dust, by the lamp as bright sparks.
  col += vec3(0.75, 0.90, 0.95) * flakes * (light * 0.35 + 0.02);
  col += vec3(0.86, 0.93, 1.0) * flakes * lamp * 1.0;

  /* ---- living light ---- */
  float bio = smoothstep(180.0, 600.0, u_D) * (0.35 + 0.65 * smoothstep(7000.0, 1500.0, u_D));
  if (bio > 0.001) {
    vec2 g = (p + vec2(0.0, u_scroll * 0.004)) * 5.0;
    vec2 id = floor(g);
    float h = hash21(id + 11.0);
    if (h > 0.80) {
      vec2 c = 0.2 + 0.6 * vec2(hash21(id + 2.2), hash21(id + 6.1));
      // Each one flashes for a moment and then is dark for a long while.
      float phase = fract(t * (0.06 + 0.07 * hash21(id + 9.4)) + h * 17.0);
      float flash = smoothstep(0.0, 0.04, phase) * smoothstep(0.22, 0.05, phase);
      float dd = length(fract(g) - c);
      vec3 tint = mix(vec3(0.20, 0.95, 0.80), vec3(0.25, 0.60, 1.0), hash21(id + 4.0));
      col += tint * (smoothstep(0.045, 0.0, dd) * 1.6 + exp(-dd * 9.0) * 0.16 * smoothstep(0.34, 0.12, dd)) * flash * bio * (1.0 - min(lamp * 3.0, 0.8));
    }
  }

  /* ---- the bottom ---- */
  if (u_floor > 0.001) {
    // A plain of silt, seen at a low angle: rows crowd together toward its far edge.
    float top = u_floor * 0.9;
    float fy = (top - uv.y) / max(top, 0.001);          // 0 at the far edge, 1 at the window's foot
    if (fy > 0.0) {
      float depthAway = 1.0 / (0.12 + fy);
      vec2 gp = vec2(p.x * depthAway * 2.2, depthAway * 3.0 + u_scroll * 0.01);
      float silt = fbm(gp * 1.3, 5);
      float ripple = ridge(vec2(gp.x * 0.7 + silt, gp.y * 2.6), 3);
      float pits = smoothstep(0.74, 0.80, fbm(gp * 3.1 + 20.0, 3));
      vec3 ground = vec3(0.50, 0.47, 0.40) * (0.55 + 0.5 * silt) * (0.82 + 0.3 * ripple) * (1.0 - pits * 0.45);
      float lit = (0.03 + lamp * 2.4) * smoothstep(0.0, 0.25, fy + 0.05);
      float haze = exp(-depthAway * 0.55);              // the far edge is lost in the water
      vec3 floorCol = ground * lit * mix(0.25, 1.0, haze);
      col = mix(col, floorCol, smoothstep(0.0, 0.03, fy));
    }
  }

  // The window's own edges.
  col *= 1.0 - dot(p, p) * mix(0.10, 0.34, lampOn);

  col = aces(col * 1.08);
  col = toSRGB(col);
  col = dither(col, uv * u_res);
  fragColor = vec4(col, 1.0);
}
`)
