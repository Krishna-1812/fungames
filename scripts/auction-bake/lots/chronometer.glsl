/* Lot: a ship's chronometer, stopped at 4:11.
 *
 * A two-day marine chronometer in its mahogany box, outer lid thrown back:
 * the brass bowl hangs in its gimbal ring inside the well, the silvered dial
 * has Roman numerals, a seconds dial at six and the up-and-down dial at
 * twelve, and the blued spade hands stopped where the logbook ends. Units:
 * the box is 1 wide (about 19 cm).
 */
#define BOUND vec3(0.52, 0.78, 0.62)
#define CENTRE vec3(0.0, 0.78, -0.1)
#define VIEW_YAW 0.48
#define VIEW_PITCH 0.50
#define FILL 0.80
#define COAT(id) ((id) == 1.0 ? 1.0 : 0.0)

const float WELL = 0.50;     // top of the box
const float DIAL = 0.405;    // the dial's face
const float LID = 1.86;      // how far the lid is thrown back (radians)

/* Where a hand points, in the dial's own plane (y towards twelve, which is
   the far side of the box): clockwise from twelve. */
vec2 handDir(float turns) { float a = turns * TAU; return vec2(sin(a), cos(a)); }

/* A hand on the dial, as a flat 2D shape in the dial's plane. */
float hand2(vec2 q, vec2 d, float len, float w, float tail, float spade) {
  vec2 nrm = vec2(-d.y, d.x);
  float s = dot(q, d), t = dot(q, nrm);
  float body = max(abs(t) - mix(w, w * 0.35, clamp(s / len, 0.0, 1.0)), max(-s - tail, s - len));
  // The spade: a lozenge two thirds of the way out.
  float sp = spade > 0.0 ? ((abs(s - len * 0.70) / (spade * 1.4) + abs(t) / spade) - 1.0) * spade * 0.6 : 9.0;
  float ring = abs(length(q) - w * 2.2) - w * 0.6;
  return min(min(body, sp), ring);
}

vec2 map(vec3 p) {
  // The box: a hollow well, rounded at the edges.
  float outer = sdRound(p - vec3(0.0, WELL * 0.5, 0.0), vec3(0.5, WELL * 0.5, 0.5), 0.018);
  float inner = sdBox(p - vec3(0.0, WELL * 0.5 + 0.08, 0.0), vec3(0.43, WELL * 0.5, 0.43));
  float box = max(outer, -inner);
  // A moulding round the top edge.
  box = min(box, max(sdRound(p - vec3(0.0, WELL - 0.012, 0.0), vec3(0.508, 0.012, 0.508), 0.008), -sdBox(p - vec3(0.0, WELL, 0.0), vec3(0.43, 0.1, 0.43))));
  box = max(box, -sdBox(p - vec3(0.0, WELL + 0.2, 0.0), vec3(0.43, 0.2, 0.43)));
  vec2 r = vec2(box, 1.0);

  // The lid, hinged along the back edge and thrown back.
  vec3 q = p - vec3(0.0, WELL, -0.5);
  q.yz = rot(-LID) * q.yz;
  float lid = sdRound(q - vec3(0.0, 0.035, 0.5), vec3(0.5, 0.035, 0.5), 0.016);
  lid = max(lid, -sdBox(q - vec3(0.0, -0.01, 0.5), vec3(0.44, 0.03, 0.44)));
  r = U(r, vec2(lid, 1.0));
  // The maker's plaque inside the lid.
  r = U(r, vec2(sdRound(q - vec3(0.0, 0.022, 0.42), vec3(0.17, 0.006, 0.07), 0.004), 6.0));
  // Brass: hinges, the escutcheon on the front, flush handles on the sides.
  float br = sdRound(p - vec3(0.0, WELL - 0.004, -0.505), vec3(0.06, 0.012, 0.008), 0.004);
  br = min(br, sdRound(abs(p - vec3(0.0, WELL - 0.004, -0.505)) - vec3(0.32, 0.0, 0.0), vec3(0.05, 0.012, 0.008), 0.004));
  br = min(br, sdRound(p - vec3(0.0, 0.33, 0.503), vec3(0.028, 0.04, 0.006), 0.004));
  br = min(br, sdRound(p - vec3(0.0, 0.16, 0.503), vec3(0.12, 0.035, 0.004), 0.003));
  vec3 hp = vec3(abs(p.x) - 0.503, p.y - 0.3, p.z);
  br = min(br, max(sdTorus(hp.yxz, 0.075, 0.008), -hp.y));
  br = min(br, sdRound(hp, vec3(0.006, 0.02, 0.1), 0.004));
  // Brass-bound corners.
  vec3 cp = vec3(abs(p.x) - 0.5, p.y - WELL * 0.5, abs(p.z) - 0.5);
  br = min(br, sdRound(cp, vec3(0.012, WELL * 0.5 - 0.02, 0.012), 0.006));

  // The bowl, its bezel and the gimbal ring that carries it.
  vec3 b = p - vec3(0.0, DIAL, 0.0);
  float bowl = max(abs(length(b) - 0.33) - 0.012, b.y);
  bowl = min(bowl, sdTorus(b - vec3(0.0, 0.010, 0.0), 0.335, 0.016));
  float gim = max(abs(length(b.xz) - 0.385) - 0.018, abs(b.y + 0.01) - 0.022);
  float pivot = sdCapsule(vec3(abs(b.x), b.y + 0.01, b.z), vec3(0.33, 0.0, 0.0), vec3(0.43, 0.0, 0.0), 0.012);
  br = min(br, min(bowl, min(gim, pivot)));
  r = U(r, vec2(br, 2.0));

  // The dial.
  r = U(r, vec2(sdCyl(b - vec3(0.0, -0.004, 0.0), 0.322, 0.004), 3.0));
  // The hands, blued steel, just above it.
  vec2 dq = vec2(b.x, -b.z);
  float hh = hand2(dq, handDir((4.0 + 11.0 / 60.0) / 12.0), 0.17, 0.009, 0.04, 0.022);
  float mh = hand2(dq, handDir(11.0 / 60.0), 0.27, 0.007, 0.05, 0.0);
  vec2 sq = dq - vec2(0.0, -0.15);
  float sh = hand2(sq, handDir(37.0 / 60.0), 0.062, 0.0025, 0.016, 0.0);
  vec2 uq = dq - vec2(0.0, 0.15);
  float uh = hand2(uq, handDir(0.32), 0.055, 0.003, 0.012, 0.0);
  float hands = max(min(hh, mh), abs(b.y - 0.006) - 0.0016);
  hands = min(hands, max(min(sh, uh), abs(b.y - 0.003) - 0.0012));
  hands = min(hands, sdCyl(b - vec3(0.0, 0.004, 0.0), 0.011, 0.006));
  r = U(r, vec2(hands, 4.0));
  return r;
}

/* ---- the dial's printing ---------------------------------------------- */

float seg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)); }

/* Roman numerals as strokes: 1 = I, 2 = V, 3 = X, packed four to a number. */
int numeral(int h) {
  if (h == 1) return 1; if (h == 2) return 5; if (h == 3) return 21; if (h == 4) return 85;
  if (h == 5) return 2; if (h == 6) return 6; if (h == 7) return 22; if (h == 8) return 86;
  if (h == 9) return 13; if (h == 10) return 3; if (h == 11) return 7; return 23;
}
float glyphW(int g) { return g == 1 ? 0.30 : 0.72; }

float romanInk(vec2 q) {
  // The nearest hour, and the point in its frame: x along the dial, y outwards.
  float a = atan(q.x, q.y);
  int h = int(floor(a / TAU * 12.0 + 0.5 + 12.0)) % 12;
  if (h == 0) h = 12;
  float ah = float(h) / 12.0 * TAU;
  vec2 rd = vec2(sin(ah), cos(ah)), td = vec2(rd.y, -rd.x);
  const float H = 0.042, R0 = 0.228;
  vec2 lp = vec2(dot(q, td), dot(q, rd) - R0) / H;
  int code = numeral(h);
  float total = 0.0; int c = code;
  for (int i = 0; i < 4; i++) { int g = c & 3; if (g == 0) break; total += glyphW(g) + 0.12; c >>= 2; }
  total -= 0.12;
  float x0 = -total * 0.5, d = 9.0; c = code;
  for (int i = 0; i < 4; i++) {
    int g = c & 3; if (g == 0) break;
    float w = glyphW(g), cx = x0 + w * 0.5;
    vec2 g2 = lp - vec2(cx, 0.0);
    if (g == 1) {
      d = min(d, seg(g2, vec2(0.0, 0.0), vec2(0.0, 1.0)) - 0.075);
      d = min(d, max(abs(abs(g2.y - 0.5) - 0.485) - 0.03, abs(g2.x) - 0.17));
    } else {
      bool vee = g == 2;
      // A thick stroke and a thin one, as cut type has.
      vec2 a0 = vee ? vec2(-0.3, 1.0) : vec2(-0.3, 1.0), a1 = vee ? vec2(0.0, 0.0) : vec2(0.3, 0.0);
      vec2 b0 = vee ? vec2(0.3, 1.0) : vec2(-0.3, 0.0), b1 = vee ? vec2(0.0, 0.0) : vec2(0.3, 1.0);
      d = min(d, min(seg(g2, a0, a1) - 0.07, seg(g2, b0, b1) - 0.03));
      // Serifs on the free ends only.
      d = min(d, max(abs(g2.y - 0.985) - 0.028, abs(abs(g2.x) - 0.3) - 0.13));
      if (!vee) d = min(d, max(abs(g2.y - 0.015) - 0.028, abs(abs(g2.x) - 0.3) - 0.13));
    }
    c >>= 2;
    x0 += w + 0.12;
  }
  return smoothstep(0.02, -0.02, d);
}

float dialInk(vec2 q) {
  float r = length(q), a = atan(q.x, q.y);
  float ink = 0.0;
  // The minute track: two rings and sixty ticks, every fifth longer.
  ink = max(ink, smoothstep(0.0012, 0.0004, abs(r - 0.300)));
  ink = max(ink, smoothstep(0.0012, 0.0004, abs(r - 0.284)));
  float m = a / TAU * 60.0, mf = abs(fract(m + 0.5) - 0.5) * TAU / 60.0 * r;
  bool five = abs(fract(m / 5.0 + 0.5) - 0.5) * 5.0 < 0.5;
  ink = max(ink, smoothstep(0.0013, 0.0005, mf) * step(five ? 0.276 : 0.284, r) * step(r, 0.300));
  ink = max(ink, romanInk(q));
  // The seconds dial at six and the up-and-down dial at twelve.
  for (int k = 0; k < 2; k++) {
    vec2 c = vec2(0.0, k == 0 ? -0.15 : 0.15), s = q - c;
    float sr = length(s), sa = atan(s.x, s.y);
    float rr = k == 0 ? 0.068 : 0.062;
    ink = max(ink, smoothstep(0.0011, 0.0003, abs(sr - rr)));
    float n = k == 0 ? 60.0 : 56.0;
    float st = abs(fract(sa / TAU * n + 0.5) - 0.5) * TAU / n * sr;
    float arc = k == 0 ? 1.0 : step(abs(sa), 2.3);
    ink = max(ink, smoothstep(0.0010, 0.0003, st) * step(rr - 0.012, sr) * step(sr, rr) * arc);
  }
  // The maker's name and the town, two lines of small capitals under twelve.
  vec2 tq = q - vec2(0.0, 0.062);
  for (int l = 0; l < 2; l++) {
    vec2 lq = tq - vec2(0.0, -float(l) * 0.024);
    float w = l == 0 ? 0.075 : 0.05;
    vec2 cell = vec2(floor(lq.x / 0.0072), 0.0);
    float on = step(0.35, hash21(cell + float(l) * 17.0)) * 0.5 + 0.5;
    float letter = step(abs(fract(lq.x / 0.0072) - 0.5), 0.3) * step(abs(lq.y), 0.0036) * step(abs(lq.x), w);
    ink = max(ink, letter * on * 0.55);
  }
  return ink;
}

/* Mahogany: close straight grain along the board, a soft ribbon figure that
   changes with the light, open pores filled and polished. Deep red-brown, not
   orange: the colour of a box that has been French-polished for a century. */
vec3 mahogany(vec3 p, vec3 n) {
  // Grain runs along x on the front, back and top, along z on the sides.
  vec3 g = abs(n.x) > 0.7 ? p.zyx : p;
  float warp = fbm(g * vec3(2.0, 9.0, 9.0)) * 1.3;
  float fine = noise(vec2(g.y * 160.0 + warp * 7.0 + g.z * 40.0, g.x * 4.0));
  float stripe = fract((g.y * 1.0 + g.z * 0.6) * 26.0 + warp);
  float late = smoothstep(0.55, 0.9, stripe) * smoothstep(1.0, 0.92, stripe);
  float ribbon = 0.5 + 0.5 * sin((g.y + g.z * 0.6) * 55.0 + fbm(g * 5.0) * 4.0);
  float pore = smoothstep(0.7, 0.85, noise(g * vec3(18.0, 600.0, 600.0)));
  vec3 base = mix(hex(0x2f170e), hex(0x4f2818), ribbon * 0.5 + fine * 0.3);
  base = mix(base, hex(0x22110a), late * 0.35);
  return base * (1.0 - 0.3 * pore);
}

Mat material(float id, vec3 p, vec3 n) {
  if (id == 1.0) {
    vec3 c = mahogany(p, n);
    // Darker where hands have not polished it: the corners and the lower edges.
    c *= 0.85 + 0.15 * smoothstep(0.0, 0.25, p.y);
    return mat(c, 0.42 + 0.1 * noise(p * 60.0), 0.0);
  }
  if (id == 2.0) {
    // Brass, lacquered once and worn back where it was handled.
    float tarn = smoothstep(0.35, 0.8, fbm(p * 22.0));
    vec3 c = mix(hex(0xc7a25e), hex(0x8c6c3a), tarn * 0.7);
    return mat(c, 0.22 + 0.2 * tarn, 1.0);
  }
  if (id == 3.0) {
    vec3 b = p - vec3(0.0, DIAL, 0.0);
    vec2 q = vec2(b.x, -b.z);
    // Silvered, grained in circles, with a little foxing.
    float grain = noise(vec2(length(q) * 900.0, atan(q.x, q.y) * 3.0));
    float fox = smoothstep(0.62, 0.85, fbm(vec3(q * 18.0, 4.0)));
    vec3 c = mix(vec3(0.80, 0.80, 0.78), vec3(0.62, 0.58, 0.50), fox * 0.5);
    float ink = dialInk(q);
    Mat m = mat(mix(c * (0.96 + 0.04 * grain), vec3(0.018), ink), mix(0.36, 0.55, ink), mix(0.75, 0.0, ink));
    return m;
  }
  if (id == 4.0) return mat(hex(0x1d2c55), 0.22, 1.0);
  // The ivorine plaque, engraved with the maker's name, the town and a number.
  vec3 q = p - vec3(0.0, WELL, -0.5);
  q.yz = rot(-LID) * q.yz;
  vec2 t = vec2(q.x, q.z - 0.42);
  float ink = 0.0;
  for (int l = 0; l < 3; l++) {
    float y = 0.03 - float(l) * 0.028, w = l == 0 ? 0.12 : (l == 1 ? 0.085 : 0.05), hgt = l == 0 ? 0.0085 : 0.006;
    float cw = l == 0 ? 0.017 : 0.012;
    float on = step(0.3, hash21(vec2(floor(t.x / cw), float(l) * 7.0)));
    ink = max(ink, on * step(abs(fract(t.x / cw) - 0.5), 0.34) * step(abs(t.y - y), hgt) * step(abs(t.x), w));
  }
  vec3 c = mix(hex(0xe2dbc6), hex(0x2a2522), ink * 0.9);
  c *= 0.92 + 0.08 * noise(p * 200.0);
  return mat(c, 0.42, 0.0);
}
