/* October 29, 1969: the first message between two computers.
 *
 * A bound laboratory log book lying open flat, the kind a graduate student
 * logs a night's work in: cloth-bound boards in dark claret buckram, a block
 * of pale green-grey ruled leaves, thicker on the right where the night's
 * entries are. The right-hand page is logbook.svg: the evening's two entries
 * in blue ballpoint and the initials. The leaves dip into the gutter and
 * their edges show as a stack of sheets; the boards stand proud of the block
 * on all three sides. Units: 1 is 1 cm (pages 20.8 x 26 each).
 */
#define BOUND vec3(22.0, 1.4, 14.4)
#define CENTRE vec3(0.0, 1.4, 0.0)
#define VIEW_YAW 0.22
#define VIEW_PITCH 1.08
#define FILL 0.68
#define EXPOSURE 1.08
#define COAT(id) (id == 2.0 ? 0.08 : 0.0)

const float PX = 20.8;     // each page's half-width
const float PZ = 13.0;     // the pages' half-depth
const float BASE = 0.32;   // the boards' top
const float HL = 1.5;     // the left block's thickness
const float HR = 2.5;     // the right block's

float pageTop(float x) {
  float ax = abs(x);
  float h = mix(HL, HR, smoothstep(-1.2, 1.2, x));
  float dip = 1.0 - 0.62 * exp(-ax / 3.6);
  float crease = 0.035 * exp(-ax / 0.35);
  float droop = 0.05 * pow(min(ax / PX, 1.0), 3.0);
  return BASE + h * (dip - droop) - crease;
}

vec2 map(vec3 p) {
  // The boards.
  float cover = sdRound(p - vec3(0.0, 0.16, 0.0), vec3(21.95, 0.16, 13.95), 0.13);
  // The cloth hinge: a faint groove down the spine.
  cover += 0.015 * exp(-abs(p.x) / 0.5) * step(0.2, p.y);
  vec2 d = vec2(cover, 1.0);
  // The leaves: a block that dips into the gutter, ragged a touch at the edges.
  float x = clamp(p.x, -PX - 0.3, PX + 0.3);
  float top = pageTop(x);
  float rag = 0.012 * sin(p.z * 3.1 + p.x * 0.7);
  vec2 q = vec2(max(abs(p.x) - PX, abs(p.z) - PZ), (p.y - top + rag) * 0.78);
  float pg = smax(q.x, q.y, 0.05);
  pg = smax(pg, BASE - 0.02 - p.y, 0.02);
  d = U(d, vec2(pg, 2.0));
  // The ribbon marker: from the gutter, over the foot of the page and the board.
  float yc = mix(pageTop(0.6) + 0.025, BASE + 0.045, smoothstep(PZ - 0.5, PZ + 0.9, p.z));
  float rb = max(max(abs(p.x - 0.6) - 0.34, abs(p.z - 3.1) - 11.1), abs(p.y - yc) - 0.022);
  d = U(d, vec2(rb, 3.0));
  return d;
}

Mat material(float id, vec3 p, vec3 n) {
  if (id == 3.0) {
    float f = 0.5 + 0.5 * sin(p.z * 120.0);
    return mat(mix(hex(0x3a2810), hex(0x2c1e0c), f * 0.5), 0.55, 0.0);
  }
  if (id == 1.0) {
    // Buckram: a woven cloth, slightly mottled, rubbed paler at the edges.
    float w = 0.5 + 0.5 * sin(p.x * 70.0) * sin(p.z * 70.0);
    float w2 = noise(p * vec3(55.0, 3.0, 55.0));
    float mott = fbm(p * 0.7);
    vec3 c = mix(hex(0x4a1a1f), hex(0x6a2a2c), 0.35 * mott + 0.25 * w2);
    c *= 0.82 + 0.3 * w;
    float edge = smoothstep(0.55, 0.9, 1.0 - abs(n.y));
    c = mix(c, hex(0x8a5a52), edge * 0.35);
    Mat m = mat(c, 0.78, 0.0);
    return m;
  }
  vec3 c;
  if (n.y < 0.55) {
    // Page edges: a stack of leaves, a little foxed.
    float s = 0.5 + 0.5 * sin(p.y * 190.0 + noise(p * 6.0) * 4.0);
    c = mix(hex(0xc9cdb9), hex(0xa7ab94), s * 0.6);
    c *= 0.85 + 0.15 * noise(p * 9.0);
    return mat(c, 0.9, 0.0);
  }
  vec2 uv = vec2((p.x + PX) / (2.0 * PX), 0.5 - p.z / (2.0 * PZ));
  c = texture(u_tex, uv).rgb;
  c = pow(c, vec3(2.2));
  c *= 1.0 - 0.42 * exp(-abs(p.x) / 2.2);
  float soil = smoothstep(0.55, 0.9, fbm(p * 1.4));
  c *= 1.0 - 0.09 * soil;
  // Fingered edges: a little dirt at the open sides and the lower margin.
  float edge = smoothstep(PX - 2.2, PX, abs(p.x)) + smoothstep(PZ - 1.4, PZ, abs(p.z));
  c *= 1.0 - 0.07 * edge * noise(p * 4.0);
  Mat m = mat(c * 0.7, 0.66 + 0.1 * noise(p * 30.0), 0.0);
  return m;
}
