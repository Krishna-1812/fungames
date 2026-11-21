/* Lot: a full set of gold dentures, apparently unworn.
 *
 * A closed upper and lower set, swaged gold plate with porcelain teeth, lying
 * in the fitted recess of its case: a navy morocco box with a domed lid,
 * blue velvet below, a padded grey silk cushion in the lid and the maker's
 * printed label pasted on it (dentures.svg). Units: centimetres. The teeth
 * are laid along a real dental arch, a semicircle in front and splayed
 * straights behind, each tooth sized and shaped as its kind is (chisel
 * incisors, pointed canines, cusped premolars and molars), and the gold is
 * festooned round every neck as a gum is.
 */
#define BOUND vec3(5.6, 5.0, 6.6)
#define CENTRE vec3(0.0, 5.0, -2.0)
#define VIEW_YAW 0.50
#define VIEW_PITCH 0.42
#define FILL 0.84
#define STEP 0.7
#define SHEEN(id) ((id) == 2.0 ? 1.0 : ((id) == 3.0 ? 0.25 : 0.0))

const vec2 CASE = vec2(5.5, 4.5);   // half the case, in plan
const float CR = 1.25;              // its corners
const float BASE_H = 3.2;           // the base's height
const float WALL = 0.3;
const float VEL = 2.92;             // the velvet's surface
const float LID = 1.88;             // how far the lid is thrown back
const float YO = 3.80;              // the plane the teeth meet on
const float ZO = 0.45;              // the set's arch centre, in z
const float TILT = 0.30;            // the set leans back in its recess, teeth up to the light

float sdRR(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
float extrude(float d2, float y, float y0, float y1, float r) {
  vec2 w = vec2(d2 + r, max(y0 - y, y - y1) + r);
  return min(max(w.x, w.y), 0.0) + length(max(w, 0.0)) - r;
}
float sat(float x) { return clamp(x, 0.0, 1.0); }

/* ---- the arch --------------------------------------------------------- */

const float RU = 2.02, AU = 0.10;   // upper: front radius, splay of the sides
const float RL = 1.80, AL = 0.15;   // lower

/* (s, n): distance along the arch from the midline (for |x|) and outwards. */
vec2 archUV(vec2 q, float R, float a) {
  q.x = abs(q.x);
  vec2 A = vec2(R, 0.0), d = vec2(sin(a), -cos(a));
  float t = dot(q - A, d);
  if (t > 0.0) return vec2(R * 1.5707963 + t, dot(q - A, vec2(cos(a), sin(a))));
  return vec2(R * atan(q.x, q.y), length(q) - R);
}

// Central, lateral, canine, two premolars, two molars: width along the arch,
// crown height, half the labial-lingual thickness. Upper then lower.
const float UW[7] = float[7](0.86, 0.68, 0.78, 0.70, 0.68, 1.02, 0.92);
const float UH[7] = float[7](1.00, 0.84, 0.98, 0.80, 0.74, 0.68, 0.62);
const float UT[7] = float[7](0.33, 0.30, 0.40, 0.44, 0.45, 0.54, 0.52);
const float LW[7] = float[7](0.54, 0.60, 0.70, 0.71, 0.72, 1.12, 1.05);
const float LH[7] = float[7](0.86, 0.90, 1.00, 0.84, 0.78, 0.70, 0.66);
const float LT[7] = float[7](0.29, 0.30, 0.38, 0.40, 0.42, 0.52, 0.50);
const float KIND[7] = float[7](0.0, 0.0, 1.0, 2.0, 2.0, 3.0, 3.0);
const float OB[7] = float[7](0.16, 0.13, 0.08, 0.02, 0.0, 0.0, 0.0);   // overbite
const float END_U = 5.64, END_L = 5.44;

float tW(int j, int i) { return j == 0 ? UW[i] : LW[i]; }
float tH(int j, int i) { return j == 0 ? UH[i] : LH[i]; }
float tT(int j, int i) { return j == 0 ? UT[i] : LT[i]; }

/* The neck line's height above the bite and the arch's thickness, smoothed
   along the arch so the gum runs on without steps. */
vec2 neckThick(float s, int j) {
  float c = 0.0, sw = 0.0; vec2 acc = vec2(0.0);
  for (int i = 0; i < 7; i++) {
    float w = tW(j, i), ctr = c + w * 0.5; c += w;
    float x = (s - ctr) / w, k = 1.0 / (0.03 + x * x * x * x);
    acc += k * vec2(tH(j, i) - OB[i], tT(j, i)); sw += k;
  }
  return acc / sw;
}

float rr2(vec2 p, vec2 b, float r) { r = min(r, min(b.x, b.y)); return sdRR(p, b, r); }

/* One tooth in its own frame: u along the arch, v from the neck towards the
   bite, w outwards. */
float tooth(float u, float v, float w, float hw, float ht, float top, float kind) {
  float t = clamp(v / top, 0.0, 1.0);
  bool ant = kind < 1.5;
  float wv, tl, wc;
  if (ant) {
    wv = hw * mix(0.62, 0.97, smoothstep(0.0, 0.5, t));
    tl = ht * mix(1.0, 0.22, pow(t, 1.15));
    float lab = ht * (1.0 - 0.12 * t);
    wc = lab - tl;
    // The labial face is a gentle convex shield, with two faint grooves.
    w += 0.26 * ht * (u * u) / (wv * wv);
    w += 0.012 * smoothstep(0.25, 0.0, abs(abs(u / wv) - 0.38)) * t;
  } else {
    wv = hw * mix(0.74, 0.97, smoothstep(0.0, 0.35, t)) * mix(1.0, 0.9, smoothstep(0.6, 1.0, t));
    tl = ht * mix(0.84, 1.0, smoothstep(0.0, 0.35, t)) * mix(1.0, 0.84, smoothstep(0.55, 1.0, t));
    wc = 0.0;
  }
  float r = min(wv, tl) * (ant ? 0.62 : 0.9);
  float d2 = rr2(vec2(u, w - wc), vec2(wv, tl), r);
  float tp = top;
  float au = abs(u) / hw;
  if (kind < 0.5) tp -= 0.10 * top * pow(au, 5.0) + 0.02 * top * au;
  else if (kind < 1.5) tp -= 0.30 * top * pow(au, 1.3);
  else {
    // Cusps: a fissure along the middle, and for molars across it too.
    float wn = (w - wc) / tl;
    tp -= 0.16 * top * exp(-wn * wn * 9.0);
    tp -= 0.08 * top * pow(au, 2.0);
    if (kind > 2.5) tp -= 0.09 * top * exp(-u * u / (0.02 * hw * hw));
  }
  float d = smax(d2, v - tp, 0.06 * top);
  return max(d, -v - 0.5);
}

/* All the teeth of one jaw. hgt is height above the bite (upper) or below it
   (lower). Also hands back the nearest tooth: (u, half width, index). */
float teeth(vec2 a, float hgt, int j, vec2 nt, out vec3 near) {
  float s = a.x, n = a.y;
  float v = nt.x - hgt;
  float best = 1e9, c = 0.0;
  near = vec3(9.0, 1.0, 6.0);
  int at = 6;
  for (int i = 0; i < 7; i++) { float w = tW(j, i); if (s < c + w) { at = i; break; } c += w; }
  float cs = 0.0;
  for (int i = 0; i < 7; i++) {
    float w = tW(j, i);
    if (i >= at - 1 && i <= at + 1) {
      float u = s - (cs + w * 0.5);
      float incl = KIND[i] < 1.5 ? (j == 0 ? 0.16 : 0.06) : 0.02;
      float d = tooth(u, v, n - v * incl, w * 0.5, tT(j, i), nt.x + OB[i], KIND[i]);
      best = min(best, d);
      if (i == at) near = vec3(u, w * 0.5, float(i));
    }
    cs += w;
  }
  // The other central incisor, across the midline.
  if (at <= 1) {
    float w = tW(j, 0);
    float incl = j == 0 ? 0.16 : 0.06;
    best = min(best, tooth(s + w * 0.5, v, n - v * incl, w * 0.5, tT(j, 0), nt.x + OB[0], 0.0));
  }
  return best;
}

/* The gold gum, festooned round every neck, swelling a little over each root. */
float gum(vec2 a, float hgt, int j, vec2 nt, vec3 near) {
  float s = a.x, n = a.y;
  float h = hgt - nt.x;          // into the gum from the neck
  float th = nt.y;
  float au = clamp(abs(near.x) / near.y, 0.0, 1.0);
  float edge = -0.20 * pow(au, 2.4) - 0.01;
  float body = sdRR(vec2(n - (-0.04 + 0.06 * h), h - 0.36), vec2(th + 0.08, 0.52), 0.3);
  body -= 0.03 * (0.5 + 0.5 * cos(3.14159 * au)) * smoothstep(-0.1, 0.2, h) * smoothstep(0.85, 0.3, h) * sat(n * 4.0 + 0.5);
  body = smax(body, edge - h, 0.05);
  // The back end of the plate, rounded off behind the last molar.
  body = smax(body, s - (j == 0 ? END_U : END_L) - 0.16, 0.2);
  return body;
}

vec3 setFrame(vec3 p) {
  vec3 d = p - vec3(0.0, YO, ZO);
  d.yz = rot(-TILT) * d.yz;
  return d;
}

vec2 dentures(vec3 d) {
  vec2 r = vec2(1e9, 0.0);
  // Upper.
  vec2 au = archUV(d.xz, RU, AU);
  vec2 ntu = neckThick(au.x, 0);
  vec3 nu;
  float tu = teeth(au, d.y, 0, ntu, nu);
  float gu = gum(au, d.y, 0, ntu, nu);
  // The palate: a thin vault from one side of the ridge to the other.
  float yp = 1.62 + 0.42 * sat(1.0 - pow(d.x / 2.0, 2.0)) * smoothstep(1.7, -0.3, d.z);
  float pal = abs(d.y - yp) - 0.06;
  pal = max(pal, au.y + 0.2);
  pal = smax(pal, -2.5 - 0.2 * pow(d.x / 2.0, 2.0) - d.z, 0.1);
  gu = smin(gu, pal, 0.25);
  // The groove the ridge sat in.
  float hu = d.y - ntu.x;
  float gro = sdEllipsoid(vec3(au.y + 0.03, hu - 1.12, 0.0), vec3(ntu.y + 0.0, 0.7, 1.0));
  gro = max(gro, au.x - END_U - 0.02);
  gu = smax(gu, -gro, 0.05);
  r = U(r, vec2(gu, 4.0));
  r = U(r, vec2(tu, 5.0 + nu.z * 0.1));
  // Lower.
  vec2 al = archUV(d.xz, RL, AL);
  vec2 ntl = neckThick(al.x, 1);
  vec3 nl;
  float tl = teeth(al, -d.y, 1, ntl, nl);
  float gl = gum(al, -d.y, 1, ntl, nl);
  r = U(r, vec2(gl, 4.0));
  r = U(r, vec2(tl, 7.0 + nl.z * 0.1));
  return r;
}

/* ---- the case ---------------------------------------------------------- */

vec3 lidFrame(vec3 p) {
  vec3 q = p - vec3(0.0, BASE_H, -CASE.y);
  q.yz = rot(-LID) * q.yz;
  return q + vec3(0.0, BASE_H, -CASE.y);
}
float lidTop(float d2) { float x = sat(-d2 / 2.6); return BASE_H + 0.8 + 0.9 * (1.0 - (1.0 - x) * (1.0 - x)); }
float cushion(vec3 c, float d2i) {
  // Padded: tucked in at the walls, full in the middle, with soft creases.
  float y = BASE_H + 0.55 - 0.36 * smoothstep(0.0, 1.2, -d2i);
  y += 0.025 * (fbm(c * vec3(1.6, 0.0, 0.5) + 2.0) - 0.5) * smoothstep(0.0, 0.8, -d2i);
  return y;
}

/* Fine pebbled morocco, only worth working out near the surface. */
float pebble(vec3 p) { vec3 g = voronoi(p * 30.0); return smoothstep(0.0, 0.45, g.y - g.x); }

vec2 map(vec3 p) {
  vec2 r = vec2(1e9, 0.0);
  // The base: leather outside, velvet within.
  float d2 = sdRR(p.xz, CASE, CR);
  float outer = extrude(d2, p.y, 0.0, BASE_H, 0.16);
  float inner = extrude(sdRR(p.xz, CASE - WALL, CR - WALL), p.y, WALL, BASE_H + 1.0, 0.04);
  if (outer < 0.02 && outer > -0.02 && outer > -inner) outer -= 0.0018 * pebble(p);
  float shell = max(outer, -inner);
  r = U(r, vec2(shell, outer > -inner ? 1.0 : 2.0));
  // The velvet insert, with the recess the set lies in.
  float ins = extrude(sdRR(p.xz, CASE - WALL + 0.02, CR - WALL), p.y, WALL, VEL, 0.14);
  vec3 sd = setFrame(p);
  vec2 al = archUV(sd.xz, RL + 0.06, AL);
  float ch = max(abs(al.y + 0.02) - 0.66, al.x - END_L - 0.22);
  ch = max(ch, -1.85 - sd.y);
  ins = smax(ins, -ch, 0.12);
  r = U(r, vec2(ins, 2.0));

  // The lid, thrown back on its hinges.
  vec3 c = lidFrame(p);
  float l2 = sdRR(c.xz, CASE, CR);
  float lo = smax(l2, c.y - lidTop(l2), 0.24);
  lo = smax(lo, BASE_H - c.y, 0.04);
  if (lo < 0.02 && lo > -0.02) lo -= 0.0018 * pebble(c);
  float l2i = sdRR(c.xz, CASE - 0.28, CR - 0.28);
  float cav = smax(l2i, c.y - cushion(c, l2i), 0.08);
  float lid = max(lo, -cav);
  r = U(r, vec2(lid, lo > -cav ? 1.0 : 3.0));

  // Nickel: the push-button catch at the front and two hinges behind.
  float ni = sdRound(p - vec3(0.0, BASE_H - 0.3, CASE.y + 0.03), vec3(0.45, 0.22, 0.06), 0.04);
  ni = min(ni, sdCyl((p - vec3(0.0, BASE_H - 0.32, CASE.y + 0.09)).xzy, 0.12, 0.04) - 0.02);
  vec3 hp = vec3(abs(p.x) - 2.6, p.y - BASE_H, p.z + CASE.y + 0.03);
  ni = min(ni, sdCapsule(hp, vec3(-0.5, 0.0, 0.0), vec3(0.5, 0.0, 0.0), 0.09));
  r = U(r, vec2(ni, 6.0));

  // The set, only when near it.
  float bb = sdBox(sd - vec3(0.0, 0.2, -0.65), vec3(2.8, 2.2, 3.0));
  if (bb < 0.3) r = U(r, dentures(sd));
  else r = U(r, vec2(bb, 0.0));
  return r;
}

/* ---- materials --------------------------------------------------------- */

Mat material(float id, vec3 p, vec3 n) {
  if (id == 1.0) {
    // Navy morocco, rubbed paler on the edges and corners.
    float pb = pebble(abs(n.y) > 0.5 && p.y > BASE_H + 0.1 ? lidFrame(p) : p);
    float edge = smoothstep(0.25, 0.6, 1.0 - abs(n.y)) * smoothstep(0.98, 0.7, 1.0 - abs(n.y));
    vec3 col = mix(hex(0x0f1622), hex(0x1c2738), pb * 0.6 + 0.3 * fbm(p * 2.0));
    col = mix(col, hex(0x3b4655), edge * 0.5 * smoothstep(0.35, 0.75, fbm(p * 6.0)));
    return mat(col, mix(0.55, 0.42, pb) - 0.1 * edge, 0.0);
  }
  if (id == 2.0) {
    // Blue velvet: the pile lies differently from place to place.
    float crush = fbm(p * 3.0 + vec3(0.0, 0.0, 3.0));
    vec3 col = mix(hex(0x0f1424), hex(0x1c2338), crush);
    return mat(col * (0.9 + 0.1 * noise(p * 90.0)), 0.95, 0.0);
  }
  if (id == 3.0) {
    // Grey silk over the cushion, with the maker's label pasted on.
    vec3 c = lidFrame(p);
    vec2 uv = vec2(c.x, c.z - 0.25) / 4.2 + 0.5;
    float weave = 0.5 + 0.5 * sin(c.x * 300.0) * sin(c.z * 280.0);
    vec3 col = mix(hex(0x434b57), hex(0x5a6371), 0.5 + 0.5 * fbm(c * 1.5)) * (0.95 + 0.05 * weave);
    float rough = 0.34;
    if (all(greaterThan(uv, vec2(0.0))) && all(lessThan(uv, vec2(1.0)))) {
      vec4 t = texture(u_tex, uv);
      vec3 paper = pow(t.rgb, vec3(2.2));
      // The paper has browned a little, and is slightly foxed.
      float fox = smoothstep(0.6, 0.85, fbm(vec3(uv * 14.0, 2.0)));
      paper *= mix(vec3(0.95), vec3(0.86, 0.83, 0.78), fox * 0.7);
      col = mix(col, paper * 0.85, t.a);
      rough = mix(rough, 0.8, t.a);
    }
    return mat(col, rough, 0.0);
  }
  if (id == 4.0) {
    // Gold plate: polished, with the fine scratches of the finishing.
    // The fitting side, swaged against the cast and never polished, is frosted.
    vec3 sd = setFrame(p), ns = n;
    ns.yz = rot(-TILT) * ns.yz;
    float fit = smoothstep(0.2, 0.6, ns.y) * smoothstep(1.2, 1.6, sd.y);
    float sc = noise(vec2(dot(sd.xz, vec2(0.8, 0.6)) * 400.0, sd.y * 6.0));
    float bloom = fbm(sd * 5.0);
    vec3 col = mix(vec3(1.0, 0.70, 0.33), vec3(1.0, 0.77, 0.42), bloom);
    col *= mix(1.0, 0.9, fit);
    return mat(col, mix(0.24 + 0.05 * sc + 0.04 * bloom, 0.46, fit), 1.0);
  }
  if ((id >= 5.0 && id < 6.0) || id >= 7.0) {
    // Porcelain teeth: warmer at the neck, cooler and clearer at the edge,
    // each tooth slightly its own shade.
    float tone = hash11(floor(id * 10.0 + 0.5) + 3.0);
    vec3 d = setFrame(p);
    float fromBite = sat(abs(d.y) / 0.85);
    vec3 neck = hex(0xbcaa86), body = hex(0xcdc6b2), edge = hex(0x9ea7ad);
    vec3 col = mix(edge, body, smoothstep(0.02, 0.4, fromBite));
    col = mix(col, neck, smoothstep(0.45, 1.0, fromBite));
    // Fine horizontal growth lines in the glaze, as the makers copied them.
    col *= 0.97 + 0.03 * sin(d.y * 260.0 + noise(d.xz * 30.0) * 3.0);
    col *= 0.88 + 0.14 * tone;
    Mat m = mat(col, 0.14, 0.0);
    m.sss = 0.5;
    return m;
  }
  // Nickel.
  return mat(vec3(0.58, 0.58, 0.57), 0.26 + 0.1 * fbm(p * 30.0), 1.0);
}
