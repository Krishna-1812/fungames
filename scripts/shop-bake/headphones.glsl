/* Product: the noise-cancelling headphones (GET IT NOW, Dark Patterns).
 *
 * Over-ear headphones standing on their cups, turned three-quarters: oval
 * cups in a graphite soft-touch plastic with a satin metal ring, thick
 * cushions in grey protein leather, steel sliders running into a padded
 * headband. Units: 1 is 10 cm.
 */
#define BOUND vec3(1.12, 1.0, 0.5)
#define CENTRE vec3(0.0, 1.0, 0.0)
#define VIEW_YAW 0.85
#define VIEW_PITCH 0.14
#define FILL 0.86
#define STEP 0.8

const float CY = 0.5;        // the cups' centre height
const float CX = 0.86;       // and how far apart

float rrect(vec2 p, vec2 b, float r) { vec2 d = abs(p) - b + r; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r; }

/* One cup, local frame: x is the axis through the ear (+x outward). */
vec2 cup(vec3 q) {
  vec2 oval = vec2(q.z / 0.36, q.y / 0.47);
  float r = length(oval) * 0.4;              // an oval, measured as a circle
  float shell = rrect(vec2(r, q.x - 0.06), vec2(0.4, 0.1), 0.07);
  vec2 d = vec2(shell, 1.0);
  // The ring between shell and cushion.
  d = U(d, vec2(rrect(vec2(r - 0.37, q.x + 0.06), vec2(0.035, 0.025), 0.012), 2.0));
  // The cushion: a fat, soft ring facing in, with a deep hollow for the ear.
  float cush = rrect(vec2(r, q.x + 0.16), vec2(0.39, 0.09), 0.08);
  cush = smax(cush, -(rrect(vec2(r, q.x + 0.2), vec2(0.22, 0.12), 0.06)), 0.03);
  d = U(d, vec2(cush, 3.0));
  return d;
}

vec2 map(vec3 p) {
  vec3 q = p - vec3(CX, CY, 0.0);
  vec2 d = cup(q);
  vec3 q2 = p - vec3(-CX, CY, 0.0); q2.x = -q2.x;
  d = U(d, cup(q2));
  // The sliders: flat steel bars up each side into the band.
  vec3 s = vec3(abs(p.x) - (CX + 0.02), p.y, p.z);
  float yoke = sdRound(s - vec3(0.0, CY + 0.62, 0.0), vec3(0.03, 0.2, 0.06), 0.02);
  // The fork round the cup: a thin arc from the slider to each side.
  vec3 f = vec3(abs(p.x) - CX - 0.04, p.y - CY, p.z);
  float fork = max(abs(length(f.yz * vec2(1.0, 0.95)) - 0.48) - 0.016, abs(f.x) - 0.022);
  fork = max(fork, -(f.y + 0.05));
  yoke = min(yoke, fork);
  d = U(d, vec2(yoke, 2.0));
  // The headband: an arc over the top, outer shell and padded underside.
  vec3 h = p - vec3(0.0, CY + 0.72, 0.0);
  float arc = length(h.xy * vec2(1.0, 1.15)) - 0.9;
  float band = max(rrect(vec2(arc, h.z), vec2(0.035, 0.085), 0.03), -h.y + 0.02);
  float pad = max(rrect(vec2(arc + 0.075, h.z), vec2(0.04, 0.07), 0.035), -h.y + 0.15);
  d = U(d, vec2(band, 1.0));
  d = U(d, vec2(pad, 3.0));
  return d;
}

Mat material(float id, vec3 p, vec3 n) {
  if (id == 1.0) return mat(mix(hex(0x2a2c2f), hex(0x313337), noise(p * 80.0)), 0.48, 0.0);
  if (id == 2.0) {
    float br = noise(vec3(p.x * 300.0, p.y * 6.0, p.z * 300.0));
    return mat(mix(hex(0x9aa0a6), hex(0xb6bbc0), br), 0.3, 1.0);
  }
  // Protein leather: soft, with fine creases.
  float c = fbm(p * 26.0);
  return mat(mix(hex(0x2c2f33), hex(0x383b40), c), 0.46 - 0.1 * c, 0.0);
}
