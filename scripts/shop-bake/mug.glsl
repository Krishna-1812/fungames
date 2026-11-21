/* Product: the ceramic mug (Fenwick & Oates, Dark Patterns).
 *
 * A thrown stoneware mug: a speckled oatmeal clay body, dipped in a deep
 * blue-grey reactive glaze that stops in a wavering line above an unglazed
 * foot, breaks paler over the rim and pools darker where it runs thick. The
 * walls carry the faint rings of the potter's fingers; the handle is pulled,
 * a flattened loop that meets the wall in a soft fillet. Units: 1 is 10 cm.
 */
#define BOUND vec3(0.66, 0.50, 0.44)
#define CENTRE vec3(0.10, 0.50, 0.0)
#define VIEW_YAW 0.55
#define VIEW_PITCH 0.30
#define FILL 0.72
#define COAT(id) (id == 1.0 ? 0.9 : 0.0)

const float R = 0.42, H = 0.98, WALL = 0.03;

float rrect(vec2 p, vec2 b, float r) { vec2 d = abs(p) - b + r; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r; }

float rings(float y) { return 0.0011 * sin(y * 41.0 + 1.3 * sin(y * 9.0)) * smoothstep(0.12, 0.3, y) * smoothstep(H, H - 0.12, y); }

/* Where the dipping stopped: a little higher on one side, never level. */
float dip(vec3 p) { float a = atan(p.z, p.x); return 0.22 + 0.025 * sin(a * 2.0 + 0.7) + 0.012 * sin(a * 7.0 + 2.0); }

vec2 map(vec3 p) {
  vec2 ry = vec2(length(p.xz), p.y);
  float outer = rrect(ry - vec2(0.0, H * 0.5), vec2(R + rings(p.y) - 0.012 * smoothstep(0.3, 0.0, p.y), H * 0.5), 0.05);
  float inner = rrect(ry - vec2(0.0, H * 0.5 + 0.12), vec2(R - WALL, H * 0.5), 0.07);
  float body = smax(outer, -inner, 0.014);
  // The pulled handle: a loop in the x-y plane, flattened front to back.
  vec3 h = p - vec3(R + 0.05, 0.54, 0.0);
  vec2 hp = vec2(h.x * 1.05, h.y * 0.82);
  float loop = length(vec2((length(hp) - 0.2) * 1.0, h.z * 0.62)) - 0.034;
  loop = max(loop, -(length(p.xz) - (R - 0.02)));
  float d = smin(body, loop, 0.03);
  bool raw = p.y < dip(p) && length(p.xz) > R - WALL * 0.5;
  return vec2(d, raw ? 2.0 : 1.0);
}

Mat material(float id, vec3 p, vec3 n) {
  // The clay: oatmeal, with iron speckles that bleed through the glaze too.
  float sp = smoothstep(0.82, 0.9, noise(p * 90.0)) + 0.6 * smoothstep(0.86, 0.92, noise(p * 160.0 + 7.0));
  if (id == 2.0) {
    vec3 c = mix(hex(0xd5cab6), hex(0xc4b59c), fbm(p * 14.0));
    c = mix(c, hex(0x4a3828), clamp(sp, 0.0, 1.0) * 0.85);
    Mat m = mat(c, 0.86, 0.0);
    return m;
  }
  // The glaze: deep where it pools, breaking to the clay's colour over the
  // rim and the edges where it ran thin, with a little movement in it.
  vec2 ry = vec2(length(p.xz), p.y);
  float rim = smoothstep(H - 0.05, H, p.y) * smoothstep(R - WALL - 0.01, R - WALL * 0.5, ry.x);
  float edge = smoothstep(0.05, 0.0, p.y - dip(p)) * step(R - WALL, ry.x);
  float flow = fbm(vec3(p.x * 6.0, p.y * 22.0, p.z * 6.0));
  vec3 deep = mix(hex(0x18262f), hex(0x24394a), flow);
  vec3 pale = mix(hex(0x7f98a3), hex(0xb9b3a2), fbm(p * 30.0));
  vec3 c = mix(deep, pale, clamp(rim * 0.9 + edge * 0.7 + smoothstep(0.62, 0.78, flow) * 0.35, 0.0, 1.0));
  c = mix(c, hex(0x2a2018), clamp(sp, 0.0, 1.0) * 0.55);
  return mat(c, 0.14, 0.0);
}
