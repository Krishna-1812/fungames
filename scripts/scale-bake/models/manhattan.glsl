/* Manhattan from above, twenty-one kilometres from the Battery to Inwood:
   the island, the grid the 1811 plan laid over it, the park left out of the
   grid, towers in two clumps — Midtown and Downtown — with lower blocks
   between, and the old streets at the bottom that the grid never reached. */
#define STEP 0.5
#define VIEW_PITCH -0.42
#define EXPOSURE 1.15

const int N = 24;
const vec2 V[24] = vec2[](
  vec2(0.0085, 0.496), vec2(0.0405, 0.426), vec2(0.0525, 0.310), vec2(0.0465, 0.200),
  vec2(0.0585, 0.108), vec2(0.0505, 0.030), vec2(0.0625, -0.060), vec2(0.0525, -0.160),
  vec2(0.0365, -0.242), vec2(0.0185, -0.330), vec2(-0.0015, -0.400), vec2(-0.0295, -0.462),
  vec2(-0.0515, -0.496), vec2(-0.0675, -0.472), vec2(-0.0735, -0.380), vec2(-0.0655, -0.280),
  vec2(-0.0735, -0.190), vec2(-0.0635, -0.090), vec2(-0.0715, 0.000), vec2(-0.0615, 0.100),
  vec2(-0.0675, 0.200), vec2(-0.0535, 0.300), vec2(-0.0355, 0.390), vec2(-0.0155, 0.460));

float island(vec2 p) {
  p += 0.004 * (vec2(fbm(p * 40.0), fbm(p * 40.0 + 7.0)) - 0.5);
  float d = dot(p - V[0], p - V[0]), s = 1.0;
  for (int i = 0, j = N - 1; i < N; j = i, i++) {
    vec2 e = V[j] - V[i], w = p - V[i];
    vec2 b = w - e * clamp(dot(w, e) / dot(e, e), 0.0, 1.0);
    d = min(d, dot(b, b));
    bvec3 c = bvec3(p.y >= V[i].y, p.y < V[j].y, e.x * w.y > e.y * w.x);
    if (all(c) || all(not(c))) s = -s;
  }
  return s * sqrt(d) - 0.004;
}

bool inPark(vec2 p) { return abs(p.x + 0.0115) < 0.0195 && abs(p.y - 0.229) < 0.075; }

/** A city block: its box in plan (as a distance) and how tall it stands. */
vec2 block(vec2 p) {
  // avenues every 280 m, streets every 80 m; below Houston Street, no plan
  vec2 cell = vec2(0.0132, 0.0038);
  vec2 q = p;
  bool old = p.y < -0.40;
  if (old) { q = rot(0.5) * p; cell = vec2(0.0062, 0.0058); }
  vec2 id = floor(q / cell);
  vec2 f = (fract(q / cell) - 0.5) * cell;
  // a block is several buildings; split it along its length
  float parts = old ? 1.0 : 4.0;
  float sub = floor((f.x / cell.x + 0.5) * parts);
  float fx = (fract((f.x / cell.x + 0.5) * parts) - 0.5) * cell.x / parts;
  vec2 hb = vec2(cell.x / parts * 0.5 - (old ? 0.0009 : 0.0003), cell.y * 0.5 - 0.0008);
  float edge = old ? 0.0 : step(parts - 1.5, sub) + step(sub, 0.5);
  hb.x -= 0.0008 * edge * 0.0;
  float d = max(abs(fx) - hb.x, abs(f.y) - hb.y);
  // the avenue itself
  if (!old) d = max(d, abs(f.x) - (cell.x * 0.5 - 0.0011));
  float h = hash21(id * 7.3 + sub * 3.1);
  float mid = exp(-pow((p.y - 0.085) / 0.055, 2.0));
  float down = exp(-pow((p.y + 0.435) / 0.035, 2.0));
  float tall = 0.0010 + 0.0020 * h + (mid + down) * (0.003 + 0.020 * h * h);
  // uptown is lower
  tall *= mix(1.0, 0.6, smoothstep(0.3, 0.45, p.y));
  return vec2(d, tall);
}

vec2 map(vec3 p) {
  p.y *= 0.955;
  float isl = island(p.xy);
  float land = max(isl, abs(p.z + 0.004) - 0.004);
  vec2 res = vec2(land, 1.0);
  if (isl < 0.002 && !inPark(p.xy)) {
    vec2 b = block(p.xy);
    float d = max(max(b.x, isl + 0.0015), abs(p.z - b.y * 0.5) - b.y * 0.5);
    res = U(res, vec2(d, 2.0));
  }
  return res;
}

Mat material(float id, vec3 p, vec3 n) {
  p.y *= 0.955;
  if (id > 1.5) {
    vec2 b = block(p.xy);
    float h = hash21(floor(p.xy / vec2(0.0033, 0.0038)) + 2.0);
    // roofs: tar, gravel, the odd pale membrane; walls: brick below, glass above
    vec3 roof = mix(hex(0x6a6862), hex(0xd2cdc2), h * h);
    vec3 wall = mix(hex(0x8d6a56), hex(0x8fa9bd), smoothstep(0.004, 0.009, b.y));
    wall *= 0.8 + 0.2 * step(0.5, fract(p.z * 2500.0));
    return mat(mix(wall, roof, smoothstep(0.5, 0.8, n.z)), 0.6, 0.0);
  }
  if (inPark(p.xy)) {
    // the Reservoir, and trees
    vec2 r = (p.xy - vec2(-0.0115, 0.262)) / vec2(0.012, 0.017);
    if (dot(r, r) < 1.0) return mat(hex(0x23465c), 0.1, 0.0);
    float tree = voronoi(p.xy * 900.0).x;
    return mat(mix(hex(0x1f3d1f), hex(0x3f6a33), tree) * (0.7 + 0.5 * fbm(p.xy * 200.0)), 0.9, 0.0);
  }
  float shore = smoothstep(-0.0025, 0.0, island(p.xy));
  // asphalt, and a strip of piers and parkland round the edge
  return mat(mix(hex(0x34353a), hex(0x6f7166), shore), 0.85, 0.0);
}
