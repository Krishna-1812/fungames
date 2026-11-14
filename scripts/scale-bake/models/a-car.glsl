/* A car, four and a half metres long: an ordinary hatchback of no make at
   all — a body, a glasshouse, four wheels in arches, lamps at each end. */
#define STEP 0.8
#define VIEW_YAW 0.0
#define VIEW_PITCH 0.07

const float GROUND = -0.158;
const vec2 AXLE = vec2(0.298, -0.090);
const float WHEEL = 0.068;

float bodyShape(vec3 p) {
  // lower body: a long box, narrowed towards the nose and tail, tucked under
  float taper = 1.0 - 0.10 * smoothstep(0.2, 0.5, abs(p.x));
  float lower = sdRound(vec3(p.x, p.y + 0.032, p.z / taper), vec3(0.482, 0.070, 0.190), 0.045);
  // bonnet falls away to the front
  lower = smax(lower, p.y - 0.036 + 0.085 * smoothstep(0.12, 0.5, p.x) + 0.02 * smoothstep(-0.3, -0.5, p.x), 0.03);
  // glasshouse
  vec3 c = p - vec3(-0.055, 0.020, 0.0);
  float cab = sdEllipsoid(c, vec3(0.300, 0.128, 0.176));
  cab = smax(cab, -(c.y + 0.03), 0.01);
  // a hatch: the tail of the roof is cut off steeply
  cab = smax(cab, (c.x * -1.0 - 0.255) * 0.8 + (c.y - 0.02) * 0.6, 0.03);
  return smin(lower, cab, 0.035);
}

vec2 map(vec3 p) {
  vec3 q = vec3(p.x, p.y, abs(p.z));
  float body = bodyShape(p);
  // sills are higher than the ground
  body = smax(body, GROUND + 0.042 - p.y, 0.012);
  // arches
  vec2 w = vec2(abs(q.x) - AXLE.x, q.y - AXLE.y);
  float arch = length(w) - (WHEEL + 0.013);
  body = smax(body, -max(arch, 0.11 - q.z), 0.008);
  // shut lines
  float seam = min(min(abs(p.x - 0.105), abs(p.x + 0.115)), abs(p.x + 0.29 + 0.15 * (p.y - 0.02)));
  body += 0.0022 * smoothstep(0.0028, 0.0, seam) * step(p.y, 0.035) * step(-0.115, p.y) * step(0.1, q.z);
  vec2 res = vec2(body, 1.0);

  // wheels
  vec3 wp = vec3(w, q.z - 0.168);
  float tyre = length(vec2(length(wp.xy) - (WHEEL - 0.021), wp.z)) - 0.021;
  float rim = max(length(wp.xy) - (WHEEL - 0.019), abs(wp.z - 0.006) - 0.012);
  // five spokes, dished
  float ang = atan(wp.y, wp.x);
  float spoke = abs(fract(ang / TAU * 5.0 + 0.5) - 0.5);
  rim += 0.008 * smoothstep(0.16, 0.24, spoke) * smoothstep(0.012, 0.03, length(wp.xy)) * smoothstep(WHEEL - 0.022, WHEEL - 0.03, length(wp.xy));
  res = U(res, vec2(tyre, 2.0));
  res = U(res, vec2(rim, 3.0));
  // door mirror
  res = U(res, vec2(sdEllipsoid(q - vec3(0.125, 0.045, 0.198), vec3(0.022, 0.013, 0.016)), 1.0));
  return res;
}

Mat material(float id, vec3 p, vec3 n) {
  vec3 q = vec3(p.x, p.y, abs(p.z));
  if (id > 2.5) {
    float r = length(vec2(abs(q.x) - AXLE.x, q.y - AXLE.y));
    return mat(mix(vec3(0.72, 0.73, 0.75), vec3(0.05), step(r, 0.011)), 0.22, 1.0);
  }
  if (id > 1.5) return mat(vec3(0.022), 0.85, 0.0);

  vec3 c = p - vec3(-0.055, 0.020, 0.0);
  // glass: the band between the waistline and the roof, less the pillars
  float band = step(0.026, c.y) * step(c.y + 0.03 * abs(c.x), 0.102);
  float side = band * step(0.12, q.z) * smoothstep(0.012, 0.016, abs(c.x - 0.045)) * smoothstep(0.012, 0.016, abs(c.x + 0.16)) * step(abs(c.x - 0.0), 0.24);
  float screen = band * step(q.z, 0.15) * step(0.13, abs(c.x)) * step(0.3, abs(n.x) + n.y * 0.5);
  if (max(side, screen) > 0.5) return mat(vec3(0.015, 0.02, 0.025), 0.04, 0.0);

  // lamps
  if (p.x > 0.445 && p.y > -0.035 && p.y < 0.0 && q.z > 0.07) { Mat m = mat(vec3(0.85), 0.1, 0.0); m.emit = vec3(0.35, 0.36, 0.4); return m; }
  if (p.x < -0.455 && p.y > -0.03 && p.y < 0.012 && q.z > 0.06) { Mat m = mat(vec3(0.5, 0.02, 0.02), 0.15, 0.0); m.emit = vec3(0.12, 0.0, 0.0); return m; }
  // black plastic along the bottom and in the grille
  if (p.y < GROUND + 0.062 || (p.x > 0.46 && p.y < -0.055 && q.z < 0.11)) return mat(vec3(0.03), 0.6, 0.0);

  // paint: a metallic blue-green under a clear coat
  float flake = noise(p * 900.0);
  Mat m = mat(hex(0x1f5f78) * (0.85 + 0.3 * flake), 0.25, 0.35);
  // seams read dark
  float seam = min(min(abs(p.x - 0.105), abs(p.x + 0.115)), abs(p.x + 0.29 + 0.15 * (p.y - 0.02)));
  m.alb *= 1.0 - 0.7 * smoothstep(0.0028, 0.0, seam) * step(p.y, 0.035) * step(-0.115, p.y) * step(0.1, q.z);
  return m;
}
