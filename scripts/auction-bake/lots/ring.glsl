/* Lot: a diamond ring, with a note from the previous owner.
 *
 * An Edwardian platinum solitaire: an old European cut diamond of about
 * 1.8 ct (high crown, small table, open culet) held in six claws over an
 * openwork gallery, on a slim band. It stands in the slot of its original
 * box: navy morocco leather outside with a gilt fillet round the lid, navy
 * velvet rolls below and a white silk lining stamped with the jeweller's
 * name above. Beside it the note, folded once and springing open a little,
 * so only the ends of its lines show. Units: the box is about 1 wide (5 cm).
 */
#define BOUND vec3(0.86, 0.50, 0.52)
#define CENTRE vec3(0.22, 0.50, -0.08)
#define VIEW_YAW 0.38
#define VIEW_PITCH 0.50
#define FILL 0.84
#define STEP 0.75
#define COAT(id) ((id) == 1.0 ? 0.35 : 0.0)
#define SHEEN(id) ((id) == 2.0 ? 1.0 : ((id) == 3.0 ? 0.35 : 0.0))

const vec3 BX = vec3(-0.12, 0.0, -0.02);   // the box's footprint centre
const vec2 FOOT = vec2(0.48, 0.40);
const float HB = 0.25;                     // the base's height
const float OPEN = 1.86;                   // how far the lid is thrown back
const float LEAN = 0.30;                   // the ring leans towards us
const vec3 RC = vec3(-0.12, 0.24, -0.02); // the ring's centre
const float RM = 0.186;                    // the band's mid radius
const float RG = 0.078;                    // the stone's radius
const float YG = 0.276;                    // its girdle above the ring's centre
const vec3 NC = vec3(0.80, 0.0, 0.06);     // the note
const float NYAW = -0.52;

float rrect(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
float sdEll2(vec2 p, vec2 r) { float k0 = length(p / r), k1 = max(length(p / (r * r)), 1e-5); return k0 * (k0 - 1.0) / k1; }

/* The lid's own frame: where a point would be if the lid were shut. */
vec3 lidFrame(vec3 p) {
  vec3 q = p - BX - vec3(0.0, HB, -FOOT.y);
  q.yz = rot(-OPEN) * q.yz;
  return q + vec3(0.0, HB, -FOOT.y);
}
vec3 ringFrame(vec3 p) {
  vec3 r = p - RC;
  r.yz = rot(-LEAN) * r.yz;
  return r;
}
vec3 noteFrame(vec3 p) {
  vec3 n = p - NC;
  n.xz = rot(NYAW) * n.xz;
  return n;
}

/* ---- the stone ---------------------------------------------------------- */

/* An old European cut as 58 planes: the table, the open culet, and for each
   of the eight sectors a bezel, a star, two upper girdle facets, a pavilion
   main and two lower girdle facets. Each is cut a little off the drawing, as
   a stone cut by hand and eye is. Inside is where dot(s, n) < w for all. */
const float GT = 0.0028;                    // half the girdle's thickness
const float BEZ = 0.663, STAR = 0.34, UG = 0.74, PAV = 0.716, LG = 0.75;
const float AT = 0.50;                      // the table's apothem, x RG
const float CULET = 0.066;

vec4 gemPlane(int i) {
  float ht = GT + (1.0 - AT / cos(PI / 8.0)) * RG * tan(BEZ);
  if (i == 0) return vec4(0.0, 1.0, 0.0, ht);
  if (i == 1) return vec4(0.0, -1.0, 0.0, CULET);
  int k = (i - 2) / 7, j = (i - 2) - k * 7;
  float a = float(k) * PI / 4.0, b = a + PI / 8.0;
  float az = a, slope = BEZ; vec2 th = vec2(AT / cos(PI / 8.0) * RG, ht);
  if (j == 1) { az = b; slope = STAR; th = vec2(AT * RG, ht); }
  if (j == 2) { az = b - 0.15; slope = UG; th = vec2(RG, GT); }
  if (j == 3) { az = b + 0.15; slope = UG; th = vec2(RG, GT); }
  if (j == 4) { az = a; slope = PAV; th = vec2(RG, GT); }
  if (j == 5) { az = b - 0.16; slope = LG; th = vec2(RG, GT); }
  if (j == 6) { az = b + 0.16; slope = LG; th = vec2(RG, GT); }
  float h = hash11(az * 13.1 + slope * 7.7 + float(j > 3) * 3.3);
  az += (h - 0.5) * 0.06;
  slope += (hash11(h * 91.0) - 0.5) * 0.05;
  vec3 n = vec3(sin(slope) * cos(az), cos(slope), sin(slope) * sin(az));
  vec3 p0 = vec3(th.x * cos(az), th.y, th.x * sin(az));
  if (j > 3) { n.y = -n.y; p0.y = -p0.y; }
  return vec4(n, dot(p0, n));
}

float diamond(vec3 s) {
  float bs = length(s) - 0.106;
  if (bs > 0.01) return bs;
  float d = length(s.xz) - RG;
  for (int i = 0; i < 58; i++) { vec4 pl = gemPlane(i); d = max(d, dot(s, pl.xyz) - pl.w); }
  return d;
}

/* ---- the mount ---------------------------------------------------------- */

float mount(vec3 r) {
  // The band: a slim D-section, thickening into the shoulders under the head.
  float a = atan(r.x, r.y);                   // 0 at the top
  float sh = smoothstep(1.3, 0.25, abs(a));
  vec2 cs = vec2(length(r.xy) - RM - 0.006 * sh, r.z);
  float band = sdRound(vec3(cs, 0.0), vec3(0.016 + 0.006 * sh, 0.019 + 0.004 * sh, 1.0), 0.009);
  vec3 s = r - vec3(0.0, YG, 0.0);
  // The gallery: two wires round under the stone, the claws rising from them.
  float g = sdTorus(s - vec3(0.0, -0.046, 0.0), 0.054, 0.0055);
  g = min(g, sdTorus(s - vec3(0.0, -0.074, 0.0), 0.030, 0.006));
  // Six claws, each a wire that leans out to the girdle and bends over it.
  float ang = atan(s.z, s.x);
  float k = floor(ang / (PI / 3.0)) + 0.5;
  float ca = k * PI / 3.0;
  vec2 dir = vec2(cos(ca), sin(ca));
  vec3 c = vec3(dot(s.xz, dir), s.y, dot(s.xz, vec2(-dir.y, dir.x)));
  float claw = sdCone(c, vec3(0.026, -0.082, 0.0), vec3(RG + 0.004, 0.0, 0.0), 0.0058, 0.0068);
  claw = min(claw, sdCone(c, vec3(RG + 0.004, 0.0, 0.0), vec3(RG - 0.007, 0.012, 0.0), 0.0068, 0.0042));
  g = min(g, claw);
  // The underside of the head runs into the shoulders.
  g = smin(g, band, 0.012);
  return g;
}

/* ---- the note ----------------------------------------------------------- */

const vec2 NH = vec2(0.33, 0.22);   // half the folded note
const float NT = 0.0022;            // half a sheet's thickness
const float FLAP = 0.27;            // how far the top half has sprung open

/* The flap's frame: z from the fold, y up from its inside face. */
vec3 flapFrame(vec3 n) {
  vec3 f = n - vec3(0.0, 2.0 * NT, -NH.y);
  f.yz = rot(-FLAP) * f.yz;
  return f;
}
float curlOf(float x) { return 0.008 * (x / NH.x) * (x / NH.x); }

float note(vec3 n, out float part) {
  // Far off, the distance to the sheet's footprint: never too short, so the
  // floor's occlusion does not see a ghost of the note round it.
  float bound = max(length(max(abs(n.xz) - NH - 0.004, 0.0)), n.y - 0.13);
  part = 0.0;
  if (bound > 0.02) return bound;
  float lower = sdBox(n - vec3(0.0, NT + curlOf(n.x), 0.0), vec3(NH.x, NT, NH.y));
  vec3 f = flapFrame(n);
  float upper = sdBox(f - vec3(0.0, NT + curlOf(f.x) * 1.4 + 0.006 * smoothstep(0.0, 0.44, f.z), NH.y), vec3(NH.x, NT, NH.y));
  // The fold, a little rounded.
  float fold = max(abs(length(n.yz - vec2(2.0 * NT, -NH.y)) - NT) - NT, abs(n.x) - NH.x);
  fold = max(fold, n.z + NH.y);
  float d = min(lower, fold);
  if (upper < d) { part = 1.0; d = upper; }
  return d - 0.0003;
}

/* ---- the box ------------------------------------------------------------ */

float boxBase(vec3 b) {
  float foot = rrect(b.xz, FOOT, 0.13);
  float d = smax(foot, abs(b.y - HB * 0.5) - HB * 0.5, 0.025);
  // A moulded plinth round the bottom.
  d = min(d, smax(rrect(b.xz, FOOT + 0.012, 0.14), abs(b.y - 0.018) - 0.018, 0.012));
  // Hollow above the rolls.
  d = max(d, -max(rrect(b.xz, FOOT - 0.045, 0.09), 0.10 - b.y));
  return d;
}

float rolls(vec3 b) {
  float inner = rrect(b.xz, FOOT - 0.045, 0.09);
  float zf = abs(b.z) - 0.176;
  float roll = sdEll2(vec2(zf, b.y - 0.150), vec2(0.180, 0.086));
  return smax(roll, inner + 0.002, 0.01);
}

float lidShell(vec3 l) {
  float foot = rrect(l.xz, FOOT, 0.13);
  float y = l.y - HB;
  // Domed on top.
  float top = 0.155 - 0.05 * dot(l.xz / FOOT, l.xz / FOOT);
  float d = smax(foot, max(-y, (y - top) * 0.85), 0.025);
  d = max(d, -max(rrect(l.xz, FOOT - 0.045, 0.09), y - 0.11));
  return d;
}

float lining(vec3 l) {
  float inner = rrect(l.xz, FOOT - 0.045, 0.09);
  float y = l.y - HB;
  // Padded silk, puffed towards the opening.
  float r2 = dot(l.xz / (FOOT - 0.045), l.xz / (FOOT - 0.045));
  float surf = 0.075 - 0.028 * (1.0 - r2);
  return max(inner + 0.001, max((surf - y) * 0.8, y - 0.11));
}

vec2 map(vec3 p) {
  vec3 b = p - BX;
  vec2 res = vec2(boxBase(b), 1.0);
  res = U(res, vec2(rolls(b), 2.0));
  // The gilt metal rim round the mouth of the base.
  float rim = max(abs(rrect(b.xz, FOOT - 0.032, 0.11)) - 0.012, abs(b.y - HB + 0.006) - 0.008);
  // The press-catch at the front.
  rim = min(rim, sdCapsule(b, vec3(0.0, HB - 0.02, FOOT.y), vec3(0.0, HB - 0.02, FOOT.y + 0.012), 0.016));
  // Hinge knuckles along the back.
  vec3 hk = b - vec3(0.0, HB, -FOOT.y - 0.004);
  rim = min(rim, sdCapsule(vec3(abs(hk.x) - 0.24, hk.yz), vec3(-0.05, 0.0, 0.0), vec3(0.05, 0.0, 0.0), 0.012));
  res = U(res, vec2(rim, 4.0));

  vec3 l = lidFrame(p) - BX;
  res = U(res, vec2(lidShell(l), 1.0));
  res = U(res, vec2(lining(l), 3.0));
  // The lid's own gilt rim.
  float lrim = max(abs(rrect(l.xz, FOOT - 0.032, 0.11)) - 0.012, abs(l.y - HB - 0.006) - 0.008);
  res = U(res, vec2(lrim, 4.0));

  // The ring.
  vec3 r = ringFrame(p);
  float near = sdCapsule(r, vec3(0.0, 0.0, 0.0), vec3(0.0, YG - 0.01, 0.0), 0.225);
  if (near < 0.02) {
    res = U(res, vec2(mount(r), 5.0));
    res = U(res, vec2(diamond(r - vec3(0.0, YG, 0.0)), 6.0));
  } else res = U(res, vec2(near, 5.0));

  // The note, folded once.
  vec3 n = noteFrame(p);
  float part;
  res = U(res, vec2(note(n, part), 7.0));
  return res;
}

/* ---- materials ---------------------------------------------------------- */

Mat leather(vec3 b, vec3 l, vec3 n, bool lid) {
  // Morocco: a fine pebbled grain, darker in the hollows.
  vec3 v = voronoi(b * 160.0);
  float grain = smoothstep(0.0, 0.5, v.y - v.x);
  float fine = noise(b * 700.0);
  vec3 c = hex(0x1a2234) * (0.75 + 0.3 * grain) * (0.9 + 0.15 * fine);
  // Worn where it was handled: the corners and edges go grey-brown.
  vec3 w = lid ? l : b;
  float edge = smoothstep(-0.02, 0.0, rrect(w.xz, FOOT, 0.13));
  float scuff = smoothstep(0.55, 0.8, fbm(b * 30.0)) * 0.6 + edge * 0.5;
  c = mix(c, hex(0x34363c), clamp(scuff, 0.0, 1.0) * 0.4);
  float rough = 0.42 + 0.25 * grain + 0.2 * scuff;
  // A gilt fillet round the top of the lid, rubbed through in places.
  if (lid) {
    float f = abs(rrect(l.xz, FOOT - 0.045, 0.09));
    float line = smoothstep(0.0035, 0.0015, f) * step(HB + 0.08, l.y);
    line *= smoothstep(0.25, 0.5, noise(l.xz * 90.0));
    if (line > 0.0) return mat(mix(c, hex(0xc9a463), line), mix(rough, 0.35, line), line);
  }
  return mat(c, rough, 0.0);
}

Mat paper(vec3 n, vec3 nrm) {
  float part;
  note(n, part);
  vec3 f = flapFrame(n);
  // Where on the sheet: x across, z from the fold (lower half) or from the
  // fold up the flap.
  vec2 at = part > 0.5 ? vec2(f.x, f.z - NH.y) : n.xz;
  vec3 c = hex(0xb8a988);
  // Toned at the edges and along the fold, foxed here and there.
  float edgeD = min(NH.x - abs(at.x), NH.y - abs(at.y));
  c *= mix(0.8, 1.0, smoothstep(0.0, 0.05, edgeD));
  c *= mix(0.85, 1.0, smoothstep(0.0, 0.02, at.y + NH.y));
  vec2 fq = at + part * 3.1;
  float fox = smoothstep(0.78, 0.84, noise(fq * 45.0)) * 0.3 + smoothstep(0.62, 0.9, fbm(vec3(fq * 5.0, 1.0))) * 0.12;
  c = mix(c, hex(0xa1825a), fox);
  c *= 0.95 + 0.06 * noise(at * 400.0);
  float ink = 0.0;
  if (part < 0.5 && nrm.y > 0.6) {
    // The lower half's inside: the second half of the letter.
    vec2 uv = vec2((at.x + NH.x) / (2.0 * NH.x), 1.0 - (at.y + NH.y) / (2.0 * NH.y) * (1100.0 / 2048.0));
    ink = texture(u_tex, uv).r;
  } else if (part > 0.5 && nrm.y > 0.6) {
    // The outside of the top half: the first half shows through, faintly
    // and backwards.
    vec2 uv = vec2(1.0 - (at.x + NH.x) / (2.0 * NH.x), 1.0 - (at.y + NH.y) / (2.0 * NH.y) * (1100.0 / 2048.0));
    ink = texture(u_tex, uv).r * 0.07;
  }
  c = mix(c, hex(0x2a1f18), ink * 0.9);
  return mat(c, 0.8, 0.0);
}

/* ---- the light inside the stone ------------------------------------------ */

/* The studio's softbox, strip, card and sweep, as the stone's facets see them
   (the same room the darkroom lights everything else with, in the camera's
   frame). */
vec3 roomLight(vec3 d) {
  const vec3 K = vec3(-0.62, 0.66, 0.42), RI = vec3(0.70, 0.42, -0.58), FI = vec3(0.86, 0.12, 0.50);
  vec3 c = mix(vec3(0.010, 0.013, 0.017), vec3(0.06, 0.07, 0.085), smoothstep(-0.4, 0.8, d.y));
  c += pow(vec3(0.415, 0.462, 0.522), vec3(2.2)) * 0.5 * smoothstep(0.1, -0.5, d.y);
  vec3 k = normalize(K), kx = normalize(cross(vec3(0.0, 1.0, 0.0), k)), ky = cross(k, kx);
  float kb = smoothstep(0.30, 0.26, abs(dot(d, kx))) * smoothstep(0.22, 0.18, abs(dot(d, ky))) * step(0.0, dot(d, k));
  c += vec3(1.0, 0.985, 0.96) * 7.0 * kb;
  vec3 r = normalize(RI), rx = normalize(cross(vec3(0.0, 1.0, 0.0), r));
  c += vec3(0.80, 0.88, 1.0) * 5.0 * smoothstep(0.075, 0.05, abs(dot(d, rx))) * smoothstep(0.5, 0.42, abs(d.y - r.y)) * step(0.0, dot(d, r));
  c += vec3(0.85, 0.88, 0.92) * 0.9 * smoothstep(0.82, 0.95, dot(d, normalize(FI)));
  c += vec3(0.6, 0.64, 0.7) * 0.6 * smoothstep(0.86, 0.97, d.y);
  return c;
}

/* The white card a jewellery photographer stands round the lens, which only
   polished metal and stones see. */
vec3 lensCard(vec3 d) {
  return vec3(0.82, 0.84, 0.88) * 0.32 * smoothstep(0.55, 0.92, d.z) * (1.0 - smoothstep(0.985, 1.0, d.z));
}

vec3 camBack() { return vec3(sin(VIEW_YAW) * cos(VIEW_PITCH), sin(VIEW_PITCH), cos(VIEW_YAW) * cos(VIEW_PITCH)); }

/* Where the darkroom's camera stands: the same sum it does. */
vec3 eyePos() {
  vec3 bk = camBack(), f = -bk, r = normalize(cross(f, vec3(0.0, 1.0, 0.0))), u = cross(r, f);
  float aspect = u_res.x / u_res.y, D = 0.0;
  for (int i = 0; i < 8; i++) {
    vec3 q = vec3(float(i & 1) * 2.0 - 1.0, float((i >> 1) & 1) * 2.0 - 1.0, float((i >> 2) & 1) * 2.0 - 1.0) * BOUND;
    D = max(D, dot(q, bk) + max(abs(dot(q, r)) / (0.30 * aspect), abs(dot(q, u)) / 0.30));
  }
  return CENTRE + bk * D;
}

/* The open lid's white silk, which the studio's room does not know is there
   but which fills the stone and the band with light from behind: where a
   ray from o along d meets the lining. */
vec3 liningGlow(vec3 o, vec3 d) {
  vec3 lo = lidFrame(o) - BX, ld = d;
  ld.yz = rot(-OPEN) * ld.yz;
  if (ld.y < 1e-4) return vec3(0.0);
  float t = (HB + 0.06 - lo.y) / ld.y;
  if (t < 0.0) return vec3(0.0);
  vec2 h = lo.xz + ld.xz * t;
  float inside = smoothstep(0.01, -0.01, rrect(h, FOOT - 0.045, 0.09));
  return vec3(0.82, 0.83, 0.86) * 0.85 * inside;
}

/* Light that comes back out of the stone towards the camera: the ray goes
   in, bounces off the pavilion (totally, mostly), and leaves through the
   crown into the room, each colour bent a little differently. */
vec3 stoneLight(vec3 p, vec3 nw) {
  vec3 bk = camBack(), f = -bk, cr = normalize(cross(f, vec3(0.0, 1.0, 0.0))), cu = cross(cr, f);
  vec3 rd = normalize(p - eyePos());
  // Into the stone's frame.
  vec3 s = ringFrame(p) - vec3(0.0, YG, 0.0);
  vec3 d0 = rd, n0 = nw;
  d0.yz = rot(-LEAN) * d0.yz;
  n0.yz = rot(-LEAN) * n0.yz;
  vec4 P[58];
  for (int i = 0; i < 58; i++) P[i] = gemPlane(i);
  float ci = max(dot(-d0, n0), 0.0);
  float fin = 1.0 - (0.17 + 0.83 * pow(1.0 - ci, 5.0));
  vec3 col = vec3(0.0);
  for (int c = 0; c < 3; c++) {
    float eta = 2.407 + 0.0125 * float(c);
    vec3 dir = refract(d0, n0, 1.0 / eta);
    vec3 pos = s - n0 * 0.0004;
    float w = fin;
    for (int b = 0; b < 7; b++) {
      // Where the ray leaves: the nearest plane ahead, or the girdle.
      float tm = 1e3; vec3 ne = vec3(0.0);
      float A = dot(dir.xz, dir.xz), B = dot(pos.xz, dir.xz), C = dot(pos.xz, pos.xz) - RG * RG;
      if (A > 1e-6) { tm = (-B + sqrt(max(B * B - A * C, 0.0))) / A; ne = normalize(vec3(pos.x + dir.x * tm, 0.0, pos.z + dir.z * tm)); }
      for (int i = 0; i < 58; i++) {
        float dn = dot(dir, P[i].xyz);
        if (dn > 1e-5) { float t = (P[i].w - dot(pos, P[i].xyz)) / dn; if (t < tm) { tm = t; ne = P[i].xyz; } }
      }
      pos += dir * max(tm, 0.0);
      vec3 o = refract(dir, -ne, eta);
      if (dot(o, o) < 1e-6) { dir = reflect(dir, -ne); pos -= ne * 0.0002; continue; }
      float ce = max(dot(o, ne), 0.0);
      float F = 0.17 + 0.83 * pow(1.0 - ce, 5.0);
      // Back to the room, in the camera's frame.
      vec3 ow = o;
      ow.yz = rot(LEAN) * ow.yz;
      vec3 oc = vec3(dot(ow, cr), dot(ow, cu), dot(ow, bk));
      vec3 pw = (pos + vec3(0.0, YG, 0.0));
      pw.yz = rot(LEAN) * pw.yz;
      col[c] += w * (1.0 - F) * (roomLight(oc)[c] + lensCard(oc)[c] + liningGlow(pw + RC, ow)[c]);
      w *= F;
      dir = reflect(dir, -ne);
      pos -= ne * 0.0002;
    }
  }
  return col;
}

Mat material(float id, vec3 p, vec3 n) {
  vec3 b = p - BX;
  vec3 l = lidFrame(p) - BX;
  if (id == 1.0) {
    bool lid = lidShell(l) < boxBase(b);
    return leather(b, l, n, lid);
  }
  if (id == 2.0) {
    // Navy velvet: the pile catches in soft patches.
    float brush = fbm(vec3(b.xz * vec2(4.0, 9.0), 2.0));
    float pile = noise(b * 900.0);
    vec3 c = hex(0x0e1529) * (0.75 + 0.4 * brush) * (0.85 + 0.25 * pile);
    return mat(c, 1.0, 0.0);
  }
  if (id == 3.0) {
    // White silk, a little yellowed, with the jeweller's stamp in gold.
    vec3 c = hex(0xd9dade) * (0.94 + 0.06 * noise(l.xz * vec2(800.0, 40.0)));
    c = mix(c, hex(0xd8cfb8), smoothstep(0.4, 0.8, fbm(l * 6.0)) * 0.4);
    // The stamp, centred in the lid; the lid's front edge is up when it is open.
    float ink = 0.0;
    if (abs(l.x) < 0.16 && abs(l.z) < 0.1) ink = texture(u_tex, vec2((1024.0 + l.x / 0.15 * 300.0) / 2048.0, (698.0 + l.z / 0.15 * 300.0) / 2048.0)).r;
    ink *= 0.85;
    return mat(mix(c, hex(0xc9a463), ink), mix(0.38, 0.3, ink), ink);
  }
  if (id == 4.0) {
    float tarn = smoothstep(0.4, 0.8, fbm(p * 40.0));
    return mat(mix(hex(0xdcb877), hex(0x9c7a45), tarn * 0.6), 0.25 + 0.15 * tarn, 1.0);
  }
  if (id == 5.0) {
    // Platinum: grey-white, a fine polish with the scuffs of daily wear.
    vec3 r = ringFrame(p);
    float sc = noise(vec3(r.x * 900.0, r.y * 40.0, r.z * 900.0));
    Mat m = mat(hex(0xd2d0cb) * (0.95 + 0.05 * sc), 0.10 + 0.08 * sc, 1.0);
    // The lid's lining, reflected in the metal.
    vec3 rd = normalize(p - eyePos());
    vec3 rr = reflect(rd, n);
    vec3 bk = camBack(), cr = normalize(cross(-bk, vec3(0.0, 1.0, 0.0))), cu = cross(cr, -bk);
    m.emit = m.alb * (liningGlow(p, rr) * 0.9 + lensCard(vec3(dot(rr, cr), dot(rr, cu), dot(rr, bk))));
    return m;
  }
  if (id == 6.0) {
    // The diamond: its surface a mirror (F0 0.17, which a grey metal gives),
    // and the light that comes back out of it from inside.
    Mat m = mat(vec3(0.17), 0.015, 1.0);
    m.emit = stoneLight(p, n);
    return m;
  }
  return paper(noteFrame(p), n);
}
