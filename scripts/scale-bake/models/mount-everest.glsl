/* Everest, cut out of the Earth down to sea level, because that is what
   8,849 metres is measured from. The country round it is already five
   kilometres up; the mountain is the last three and a half. Lhotse stands to
   its right, Nuptse's wall in front, the Khumbu glacier runs out between. */
#define STEP 0.35
#define VIEW_YAW 0.3
#define VIEW_PITCH 0.2

const float H = 0.526;          // 8,849 m in units of the block's width

float peak(vec2 q, vec2 c, float top, float rad, float sharp) {
  return top * pow(max(0.0, 1.0 - length(q - c) / rad), sharp);
}

/** Height above sea level, as a fraction of Everest's. */
float height(vec2 q) {
  float h = 0.54 + 0.07 * fbm(q * 3.2 + 2.0);
  float m = peak(q, vec2(0.03, -0.02), 0.44, 0.34, 1.35);
  m = max(m, peak(q, vec2(0.215, 0.05), 0.405, 0.24, 1.3));     // Lhotse, 8,516 m
  m = max(m, peak(q, vec2(-0.04, 0.15), 0.33, 0.20, 1.2));      // Nuptse, 7,861 m
  m = max(m, peak(q, vec2(-0.27, -0.03), 0.25, 0.17, 1.3));     // Pumori, 7,161 m
  m = max(m, peak(q, vec2(0.02, -0.21), 0.29, 0.17, 1.3));      // Changtse, 7,543 m
  m = max(m, peak(q, vec2(0.40, 0.14), 0.22, 0.2, 1.2));
  h += m;
  // arêtes and gullies, deeper the higher you are
  float r = ridged(q * 4.6 + 1.7);
  h += (r - 0.42) * 0.16 * smoothstep(0.05, 0.3, m) + (ridged(q * 19.0) - 0.4) * 0.018;
  // the glacier has ground its valley flat
  float valley = smoothstep(0.05, 0.0, abs(q.y - 0.04 + 0.10 * sin(q.x * 5.0 + 2.6)) - 0.012) * smoothstep(-0.02, -0.12, q.x);
  h = mix(h, 0.585, valley * 0.85);
  return h;
}

vec2 map(vec3 p) {
  float y = -0.5 * H + H * height(p.xz);
  float d = (p.y - y) * 0.5;
  // a ragged-edged block, flat at sea level
  float edge = max(abs(p.x) - 0.5, abs(p.z) - 0.27) + 0.0;
  float bot = -0.5 * H - p.y;
  return vec2(max(d, max(edge, bot)), 1.0);
}

Mat material(float id, vec3 p, vec3 n) {
  float alt = (p.y + 0.5 * H) / H;                       // 0 sea level .. 1 summit
  // the cut faces of the block: strata
  if (abs(p.x) > 0.4985 || abs(p.z) > 0.2685) {
    float band = fbm(vec2(p.y * 60.0 + 0.6 * fbm(p.xz * 8.0), 1.0));
    return mat(mix(hex(0x4a4038), hex(0x8a7866), band) * (0.8 + 0.3 * noise(p * 200.0)), 0.9, 0.0);
  }
  float steep = 1.0 - n.y;
  vec3 rock = mix(hex(0x3d3a3a), hex(0x6a625c), fbm(p * 30.0));
  // the Yellow Band: a stripe of limestone round the mountain at 8,200 m
  rock = mix(rock, hex(0x9a8a62), smoothstep(0.012, 0.0, abs(alt - 0.93 - 0.02 * fbm(p.xz * 12.0))) * 0.7);
  vec3 scree = mix(hex(0x6b6257), hex(0x8b8272), fbm(p * 50.0));
  vec3 turf = hex(0x5f6248);
  // snow holds where it is high and not too steep; ice in the valley
  float snowline = 0.64 + 0.05 * fbm(p.xz * 9.0);
  float snow = smoothstep(snowline, snowline + 0.05, alt) * smoothstep(0.62, 0.42, steep + 0.12 * fbm(p * 40.0));
  vec3 alb = mix(mix(turf, scree, smoothstep(0.55, 0.62, alt)), rock, smoothstep(0.25, 0.5, steep));
  float ice = smoothstep(0.03, 0.0, abs(p.z - 0.04 + 0.10 * sin(p.x * 5.0 + 2.6)) - 0.012) * smoothstep(-0.02, -0.12, p.x) * step(alt, 0.66);
  alb = mix(alb, mix(hex(0x9fb1bd), hex(0xdfe7ec), fbm(p * vec3(80.0, 1.0, 20.0))), ice * 0.9);
  alb = mix(alb, vec3(0.93, 0.95, 0.98), snow);
  Mat m = mat(alb, mix(0.9, 0.55, snow), 0.0);
  m.sss = snow * 0.6;
  return m;
}
