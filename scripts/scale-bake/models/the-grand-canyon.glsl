/* The Grand Canyon from above, 446 kilometres of the Colorado: a plateau,
   forested where it is highest, and a ragged trench cut down through it in
   steps — each step a different rock, each rock a different colour — to a
   thin river at the bottom. The depth is drawn six times too deep; at true
   scale the deepest canyon on the continent is a scratch. */
#define STEP 0.4
#define VIEW_PITCH 0.0

/** How far the river is from here, measured across it. */
float river(vec2 p) {
  float c = 0.038 * sin(p.x * 6.5 + 0.8) + 0.022 * sin(p.x * 15.0 + 2.0) + 0.009 * sin(p.x * 37.0);
  // the big bend in the middle
  c += 0.03 * smoothstep(0.25, 0.0, abs(p.x + 0.05)) - 0.012;
  return p.y - c;
}

/** Depth below the rim, 0..1. */
float depth(vec2 p) {
  float r = abs(river(p));
  // wide in the middle of its length, a slot at each end
  float wide = mix(0.012, 0.062, smoothstep(0.5, 0.1, abs(p.x + 0.05)));
  // side canyons: the edge is not a line, it is a coast
  vec2 w = p * 9.0 + 0.6 * vec2(fbm(p * 7.0), fbm(p * 7.0 + 3.0));
  float rag = ridged(w) * 0.9 + ridged(w * 2.7 + 5.0) * 0.4;
  float e = r / (wide * (0.18 + 1.25 * rag * rag));
  float d = 1.0 - smoothstep(0.0, 1.0, e);
  // tributaries reaching out across the plateau
  float trib = smoothstep(0.82, 0.97, ridged(p * 5.0 + 9.0 + 0.3 * fbm(p * 11.0))) * smoothstep(0.2, 0.03, r) * 0.45;
  d = max(d, trib);
  // terraces: hard layers make cliffs, soft ones make slopes
  float steps = 7.0;
  d = clamp(d + 0.10 * (fbm(p * 60.0) - 0.5) * smoothstep(0.0, 0.2, d) * smoothstep(1.0, 0.8, d), 0.0, 1.0);
  float f = d * steps, i = floor(f), g = fract(f);
  d = (i + smoothstep(0.15, 0.85, g)) / steps;
  return d;
}

float surface(vec2 p) {
  float plateau = 0.004 * fbm(p * 6.0) + 0.0015 * fbm(p * 30.0);
  return plateau - 0.026 * depth(p);
}

vec2 map(vec3 p) {
  float d = (p.z - surface(p.xy)) * 0.5;
  float edge = max(abs(p.x) - 0.5 + 0.004 * fbm(p.xy * 30.0), abs(p.y) - 0.1135 + 0.004 * fbm(p.xy * 30.0 + 4.0));
  return vec2(max(d, max(edge, -0.034 - p.z)), 1.0);
}

Mat material(float id, vec3 p, vec3 n) {
  float d = depth(p.xy);
  float grain = fbm(p.xy * 120.0);
  // rim to river: Kaibab limestone, Coconino sandstone, the red Supai and
  // Redwall, green-grey Bright Angel shale, and the dark schist of the gorge
  vec3 c = hex(0xc9b999);
  c = mix(c, hex(0xd9c7a3), smoothstep(0.10, 0.2, d));
  c = mix(c, hex(0x9a6a56), smoothstep(0.3, 0.4, d));
  c = mix(c, hex(0x7d5547), smoothstep(0.5, 0.6, d));
  c = mix(c, hex(0x7f7a63), smoothstep(0.7, 0.78, d));
  c = mix(c, hex(0x3c3431), smoothstep(0.88, 0.95, d));
  c *= 0.82 + 0.36 * grain;
  // the plateau: sage and bare ground, ponderosa on the high north side
  if (d < 0.04) {
    float forest = smoothstep(0.5, 0.62, fbm(p.xy * 9.0 + 2.0) + 0.12 * clamp(river(p.xy) * 12.0, -1.0, 1.0));
    vec3 top = mix(hex(0xb3a281), hex(0x8d8a66), fbm(p.xy * 40.0));
    top = mix(top, hex(0x56633f) * (0.75 + 0.5 * voronoi(p.xy * 500.0).x), forest * 0.8);
    c = mix(top, c, smoothstep(0.0, 0.04, d));
  }
  // the Colorado, green where it is clear and brown in flood
  if (d > 0.985 && abs(river(p.xy)) < 0.0016) return mat(hex(0x3f6f5e), 0.15, 0.0);
  return mat(c, 0.9, 0.0);
}
