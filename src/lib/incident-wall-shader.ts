/**
 * Days Since Incident — the wall the sign is mounted on.
 *
 * A painted concrete-block wall in a warehouse: 390 × 190 mm blocks laid in
 * running bond on 10 mm tooled mortar joints, the pores and pock marks of
 * the block showing through the paint, each block sitting a fraction proud
 * or shy of its neighbours. It is lit by a fluorescent fitting out of frame
 * above the sign, a 2.2 m line of light half a metre off the wall, sampled
 * along its length, so the raking light picks out every joint and pit and
 * falls off down the wall as it would.
 *
 * The sign itself is the page's own markup, laid over this; the shader
 * only knows where it is (`u_plate`) so it can cast the sign's shadow. The
 * sign stands 20 mm off the wall on spacers, so its shadow drops a few
 * centimetres below it and spreads sideways, softened by the length of the
 * tube; close to its edges the wall also gets less of the room's light.
 *
 * Drawn once, and again when the page is resized: nothing on a wall moves.
 */
import { glsl } from './gl'

export const INCIDENT_WALL_FRAG = glsl(`
uniform vec4  u_plate;   // the sign, in pixels, y up: x0, y0, x1, y1
uniform float u_mm;      // pixels per millimetre of wall

#define UPTO(n) ((n) + int(min(u_time, 0.0)))

const float STANDOFF = 4.0;           // mm between the wall and the back of the sign, on its spacers
const float LAMP_UP = 520.0;          // the tube's height above the sign's top edge, mm
const float LAMP_OUT = 330.0;         // and how far off the wall
const float LAMP_HALF = 1100.0;       // half its length

// The wall's height at a point, in mm: 0 is the face of a block, below that
// a joint or a pit. p is in mm from the sign's centre.
float wallH(vec2 p, float fine) {
  float row = floor(p.y / 200.0);
  vec2 q = vec2(p.x + mod(row, 2.0) * 200.0 + 37.0, p.y);
  vec2 cell = mod(q, vec2(400.0, 200.0));
  vec2 id = floor(q / vec2(400.0, 200.0));
  float d = min(min(cell.x, 400.0 - cell.x), min(cell.y, 200.0 - cell.y));
  if (d < 5.0) {
    // A tooled joint: a concave groove 4 mm deep, sanded grit in it.
    float u = d / 5.0;
    return -4.0 * (1.0 - u * u) + (noise(p * 0.3) - 0.5) * 0.4 * fine;
  }
  // The arris rounds over into the joint.
  float arris = -1.4 * exp(-(d - 5.0) / 1.8);
  // Each block a little proud or shy, and very slightly dished.
  vec2 c = (cell - vec2(200.0, 100.0)) / vec2(200.0, 100.0);
  float block = (hash21(id + 3.1) - 0.5) * 0.9 - dot(c, c) * 0.35;
  // The face undulates gently under two coats of paint. Its pores are too
  // small to cast shadows at this distance; they are in the paint's colour.
  float grain = (noise(p * 0.035) - 0.5) * 0.5 + (noise(p * 0.11 + 11.0) - 0.5) * 0.12 * fine;
  return arris + block + grain;
}

// Light arriving at a point on the wall with this normal, from the tube,
// and how much of the tube the sign hides from it.
vec2 tubeLight(vec3 P, vec3 n, vec4 plate) {
  float lit = 0.0, seen = 0.0;
  for (int i = 0; i < UPTO(9); i++) {
    float s = (float(i) / 8.0) * 2.0 - 1.0;
    for (int j = 0; j < UPTO(3); j++) {
      // The diffuser is about 160 mm deep: three rows of samples across it.
      vec3 L = vec3(s * LAMP_HALF, plate.w + LAMP_UP + float(j) * 30.0, LAMP_OUT + float(j) * 80.0 - 80.0);
      vec3 l = L - P;
      float d2 = dot(l, l);
      vec3 ld = l * inversesqrt(d2);
      // The tube shines down and out of its diffuser, not up.
      float emit = max(0.0, (L.y - P.y) / sqrt(d2));
      float e = max(0.0, dot(n, ld)) * emit / d2;
      // Does the ray to this sample pass through the sign (its back, STANDOFF off the wall)?
      float t = (STANDOFF - P.z) / max(1e-3, l.z);
      vec2 X = P.xy + l.xy * t;
      float inside = step(plate.x, X.x) * step(X.x, plate.z) * step(plate.y, X.y) * step(X.y, plate.w);
      lit += e * (1.0 - inside * step(P.z, STANDOFF));
      seen += e;
    }
  }
  return vec2(lit, seen);
}

void main() {
  vec2 px = gl_FragCoord.xy;
  vec2 mid = 0.5 * (u_plate.xy + u_plate.zw);
  float mm = max(u_mm, 1e-3);
  vec2 p = (px - mid) / mm;
  // The sign, in mm about its own centre.
  vec2 hs = 0.5 * (u_plate.zw - u_plate.xy) / mm;
  vec4 plate = vec4(-hs, hs);

  // Detail finer than a pixel only shimmers: fade it out as the wall shrinks.
  float fine = smoothstep(1.2, 2.6, mm);
  float e = max(0.8, 1.2 / mm);
  float h = wallH(p, fine);
  float hx = wallH(p + vec2(e, 0.0), fine);
  float hy = wallH(p + vec2(0.0, e), fine);
  vec3 n = normalize(vec3(-(hx - h) / e, -(hy - h) / e, 1.0));
  vec3 P = vec3(p, h);

  vec2 L = tubeLight(P, n, plate);
  // How bright the wall is just above the sign, in the open: that is "1".
  vec2 ref = tubeLight(vec3(0.0, hs.y + 60.0, 0.0), vec3(0.0, 0.0, 1.0), plate);
  float direct = L.x / max(ref.y, 1e-12);

  // The room's light, fainter in the joints and pits and close in under the sign.
  vec2 out2 = max(abs(p) - hs, 0.0);
  float toSign = length(out2) + min(max(abs(p.x) - hs.x, abs(p.y) - hs.y), 0.0);
  float ao = mix(0.35, 1.0, smoothstep(0.0, 90.0, toSign)) * clamp(1.0 + h * 0.09, 0.6, 1.0);

  // Paint: a cool pale grey above the dado line, a deep slate below it, both a
  // little uneven, a little grimier toward the floor.
  float dado = -hs.y - 230.0;
  vec3 upper = vec3(0.34, 0.37, 0.40);
  vec3 lower = vec3(0.075, 0.105, 0.14);
  float band = smoothstep(dado - 1.0, dado + 1.0, p.y);
  vec3 paint = mix(lower, upper, band);
  // A thin cobalt line where the two paints meet, as safety walls have.
  paint = mix(paint, vec3(0.06, 0.16, 0.48), smoothstep(14.0, 12.0, abs(p.y - dado - 13.0)));
  paint *= 0.94 + 0.12 * noise(p * 0.004 + 3.0);
  // Each block took the paint a little differently.
  { float row = floor(p.y / 200.0); vec2 bid = floor(vec2(p.x + mod(row, 2.0) * 200.0 + 37.0, p.y) / vec2(400.0, 200.0)); paint *= 0.965 + 0.07 * hash21(bid + 9.7); }
  paint *= 1.0 - 0.10 * smoothstep(0.0, -900.0, p.y);
  // The block's pores, filled but not hidden by the paint: a fine dark stipple, and the odd larger pock.
  float pore = smoothstep(0.62, 0.8, noise(p * 0.42 + 5.0)) * 0.10 + smoothstep(0.74, 0.86, noise(p * 0.13 + 2.0)) * 0.12;
  paint *= 1.0 - pore * step(-2.0, h);
  // Darker in the joints, where the roller did not quite reach.
  paint *= mix(0.82, 1.0, smoothstep(-3.5, -0.5, h));

  vec3 tube = vec3(0.93, 0.97, 1.0);
  vec3 room = vec3(0.55, 0.62, 0.72);
  // The tube does most of the work; the room, bounced off the floor and far walls, fills the rest.
  vec3 col = paint * (tube * direct * 1.15 * mix(0.75, 1.0, ao) + room * 0.07 * ao);
  // Eggshell paint: a faint sheen of the tube on the block faces.
  vec3 v = vec3(0.0, 0.0, 1.0);
  vec3 lh = normalize(normalize(vec3(0.0, hs.y + LAMP_UP, LAMP_OUT) - P) + v);
  col += tube * pow(max(dot(n, lh), 0.0), 24.0) * 0.035 * direct;

  // The lens: a gentle fall-off to the corners.
  vec2 uv = px / u_res;
  col *= 1.0 - 0.35 * pow(length((uv - 0.5) * vec2(1.0, 1.15)), 2.2);

  fragColor = vec4(dither(toSRGB(aces(col * 1.05)), px), 1.0);
}
`)
