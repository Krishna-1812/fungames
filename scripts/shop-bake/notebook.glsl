/* Product: the leather notebook (Fenwick & Oates, Dark Patterns).
 *
 * An A5 notebook lying on the sweep at an angle: a soft slate-blue leather
 * cover with a fine grain and rounded corners, a cream page block showing
 * at the three open edges, a black elastic band round the fore-edge, and a
 * grey ribbon marker trailing out of the foot. Units: 1 is 10 cm.
 */
#define BOUND vec3(1.15, 0.13, 1.25)
#define CENTRE vec3(0.0, 0.13, 0.0)
#define VIEW_YAW 0.25
#define VIEW_PITCH 0.62
#define FILL 0.82
#define STEP 0.7

vec3 local(vec3 p) { vec3 q = p; q.xz = rot(0.38) * q.xz; return q; }

vec2 map(vec3 p) {
  vec3 q = local(p) - vec3(0.0, 0.11, 0.0);
  // The cover: two boards and a rounded spine, all one soft leather skin.
  float grain = 0.0012 * noise(q * 220.0);
  vec3 bb = vec3(0.74, 0.11, 1.05);
  float block = sdRound(q - vec3(0.015, 0.0, 0.0), bb - vec3(0.03, 0.022, 0.03), 0.01);
  float cover = sdRound(q, bb, 0.05);
  // Hollow out the open edges so the page block shows between the boards.
  float gap = sdBox(q - vec3(0.06, 0.0, 0.0), vec3(0.74, 0.088, 1.02));
  cover = max(cover, -gap) + grain;
  vec2 d = U(vec2(cover, 1.0), vec2(block, 2.0));
  // The elastic: a flat band hooping the book near the fore-edge.
  float band = max(abs(sdBox(q, bb + vec3(0.0, 0.004, 0.004))) - 0.006, abs(q.x - 0.52) - 0.028);
  d = U(d, vec2(band, 3.0));
  // The ribbon: out of the foot and down onto the sweep in a lazy S.
  vec3 r = q - vec3(-0.2, 0.0, -1.05);
  float s = clamp(-r.z / 0.55, 0.0, 1.0);
  float ry = mix(0.0, -0.105, smoothstep(0.0, 0.35, s));
  float ribbon = sdBox(vec3(r.x - 0.06 * sin(s * 4.0), r.y - ry, r.z + 0.275), vec3(0.03, 0.003, 0.275));
  d = U(d, vec2(ribbon, 4.0));
  return d;
}

Mat material(float id, vec3 p, vec3 n) {
  vec3 q = local(p);
  if (id == 1.0) {
    float g = noise(q * 220.0), w = fbm(q * 4.0);
    vec3 c = mix(hex(0x1d2126), hex(0x262b31), w * 0.5 + 0.3 * g);
    // Worn paler on the corners and the spine's edges.
    float wear = smoothstep(0.6, 0.74, abs(q.x)) * 0.3 + smoothstep(0.92, 1.05, abs(q.z)) * 0.3;
    return mat(mix(c, hex(0x3b4047), wear), 0.42 - 0.12 * g, 0.0);
  }
  if (id == 2.0) {
    // The page edges: sheet after sheet.
    float sheet = 0.5 + 0.5 * sin(q.y * 1400.0 + noise(q * 40.0) * 3.0);
    return mat(mix(hex(0xe7dfcc), hex(0xd2c8b2), sheet * 0.6), 0.8, 0.0);
  }
  if (id == 3.0) return mat(hex(0x151617), 0.6, 0.0);
  return mat(mix(hex(0x6f7a84), hex(0x89939c), noise(q * 300.0)), 0.5, 0.0);
}
