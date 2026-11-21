/* Lot: a first edition of a book nobody wanted.
 *
 * A Victorian octavo in the publisher's original slate-green cloth: blind
 * rules and arabesque corners struck into the boards, the title in gilt in a
 * blind cartouche on the front and in gilt on the spine; French grooves at
 * the joints. The spine has sunned to fawn, the corners are bumped and
 * rubbed through to the board, the leaves are uncut and dusty at the head.
 * It stands with the front board a little open. The stamping is drawn in
 * first-edition.svg. Units: the book is 1 tall (about 19.5 cm); the spine
 * faces -x, the front board +z.
 */
#define BOUND vec3(0.36, 0.5, 0.2)
#define CENTRE vec3(0.0, 0.5, 0.1)
#define VIEW_YAW -0.86
#define VIEW_PITCH 0.42
#define FILL 0.90
#define STEP 0.75

const float BH = 1.0;      // height
const float BW = 0.66;     // width, spine to fore-edge
const float BTH = 0.17;    // thickness
const float BT = 0.011;    // board
const float SQ = 0.011;    // squares
const float SE = 0.018;    // the spine's curve, from the back edge
const float BULGE = 0.010;
const float OPEN = 0.40;   // the front board, opened (radians)
const float CX = -BW * 0.5 + SE + BULGE;     // the spine's centre line
const float XH = CX - 0.014;                  // where the boards hinge
const float BL = BW * 0.5 - XH;              // a board's width from the hinge

float rrect(vec2 p, vec2 b, float r) { vec2 d = abs(p) - b + r; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r; }

/* A board in its own frame: x from the hinge, y up, z outwards. Returns the
   distance; the corners at the fore-edge are knocked round, each its own way. */
float boardSD(vec3 b, float seed, out float edge) {
  vec2 xy = vec2(b.x - BL * 0.5, b.y - BH * 0.5);
  float top = step(0.0, xy.y);
  float rc = 0.005 + 0.013 * hash21(vec2(seed, top + 3.0)) * step(0.0, xy.x);
  float d2 = rrect(xy, vec2(BL * 0.5, BH * 0.5), rc);
  edge = d2;
  // Boards bow a little outwards, as cloth boards do.
  float bow = 0.0025 * sin(clamp(b.x / BL, 0.0, 1.0) * PI) * sin(clamp(b.y / BH, 0.0, 1.0) * PI);
  vec2 w = vec2(d2, abs(b.z - bow) - BT * 0.5);
  float d = length(max(w + 0.0026, 0.0)) + min(max(w.x, w.y), 0.0) - 0.0026;
  // The French groove, a little way in from the hinge.
  float g = length(vec2(b.x - 0.024, b.z - BT * 0.5 - 0.0018)) - 0.0042;
  return smax(d, -g, 0.002);
}

vec3 frontLocal(vec3 q) {
  vec2 d = vec2(q.x - XH, q.z - (BTH * 0.5 - BT * 0.5));
  float c = cos(OPEN), s = sin(OPEN);
  return vec3(d.x * c + d.y * s, q.y, -d.x * s + d.y * c);
}
vec3 backLocal(vec3 q) { return vec3(q.x - XH, q.y, -(q.z + (BTH * 0.5 - BT * 0.5))); }

vec2 coverUV(vec3 b) { return vec2(clamp(b.x / BL, 0.0, 1.0) * 0.64, clamp(b.y / BH, 0.0, 1.0)); }
vec2 spineUV(vec3 q) { return vec2(0.70 + clamp(q.z / BTH + 0.5, 0.0, 1.0) * 0.17, clamp(q.y / BH, 0.0, 1.0)); }

vec2 map(vec3 p) {
  vec3 q = p;
  float e;
  // The front board, opened, with the stamping struck into its face.
  vec3 fb = frontLocal(q);
  float front = boardSD(fb, 1.0, e);
  if (abs(front) < 0.004 && fb.z > 0.0) {
    vec2 t = textureLod(u_tex, coverUV(fb), 0.0).rg;
    front += 0.0016 * t.g;
  }
  vec2 r = vec2(front, 1.0);
  // The back board.
  r = U(r, vec2(boardSD(backLocal(q), 2.0, e), 1.0));

  // The spine: half an ellipse, with the hinge's groove either side.
  vec2 s = vec2(q.x - CX, q.z);
  vec2 er = vec2(SE + BULGE, BTH * 0.5);
  float k0 = length(s / er), k1 = length(s / (er * er));
  float sp = max(k0 * (k0 - 1.0) / k1, s.x);
  if (abs(sp) < 0.004) sp += 0.0012 * textureLod(u_tex, spineUV(q), 0.0).g;
  // The spine is a little shorter than the boards at head and tail, where
  // the cloth is turned in and has frayed.
  float fray = 0.0025 * fbm(vec3(q.z * 90.0, q.x * 90.0, 3.0));
  sp = smax(sp, abs(q.y - BH * 0.5) - BH * 0.5 + 0.002 + fray, 0.003);
  // Hollow over the leaves at head and tail: a thin cap of cloth.
  vec2 ei = er - 0.003;
  float k2 = length(s / ei), k3 = length(s / (ei * ei));
  float inner = k2 * (k2 - 1.0) / k3;
  sp = smax(sp, -max(inner, min(BH - SQ - 0.002 - q.y, q.y - SQ - 0.002)), 0.0015);
  r = U(r, vec2(sp, 1.0));

  // The leaves, uncut: each gathering stands a little proud or short of the
  // next at the head and the fore-edge, and the leaves are ragged.
  float zb = BTH * 0.5 - BT - 0.0008;
  float gz = (q.z + zb) / 0.0085;
  float gather = hash11(floor(gz) + 3.0);
  float leaf = noise(vec2(q.z * 1100.0, q.y * 18.0)) * 0.6 + noise(vec2(q.z * 2600.0, q.x * 25.0)) * 0.4;
  float zz = clamp(q.z / zb, -1.0, 1.0);
  float xf = BW * 0.5 - SQ - 0.006 * (1.0 - zz * zz) - 0.004 * gather - 0.0018 * leaf;
  float yh = BH - SQ - 0.0035 * gather - 0.0015 * leaf;
  float blk = max(max(abs(q.z) - zb, max(q.y - yh, SQ - q.y)), q.x - xf);
  // Rounded at the back with the spine, inside its cloth.
  blk = max(blk, min(CX - q.x, inner - 0.0005));
  r = U(r, vec2(blk * 0.8, 2.0));
  return r;
}

/* ---- materials ---------------------------------------------------------- */

/* The cloth: a fine diagonal rib, the dye a little uneven. */
vec3 cloth(vec2 uv, float fade) {
  float rib = sin((uv.x + uv.y) * 1800.0) * 0.5 + 0.5;
  float slub = noise(uv * vec2(300.0, 40.0));
  vec3 c = mix(hex(0x334a50), hex(0x3d555b), smoothstep(0.25, 0.75, fbm(vec3(uv * 9.0, 1.0))));
  c *= 0.93 + 0.07 * rib + 0.05 * (slub - 0.5);
  // Sunned: the green goes out of the dye first, leaving a dusty fawn.
  vec3 sun = mix(hex(0x4f4b3f), hex(0x5f5a4b), fbm(vec3(uv * 14.0, 4.0)));
  sun *= 0.94 + 0.06 * rib;
  return mix(c, sun, fade);
}

Mat material(float id, vec3 p, vec3 n) {
  vec3 q = p;
  if (id == 1.0) {
    vec3 fb = frontLocal(q), bb = backLocal(q);
    float ef, eb;
    float df = boardSD(fb, 1.0, ef), db = boardSD(bb, 2.0, eb);
    bool onFront = df < 0.002 && df <= db;
    bool onBack = !onFront && db < 0.002;
    bool spine = !onFront && !onBack;
    vec3 b = onFront ? fb : bb;
    float edge = onFront ? ef : eb;
    vec2 uv; vec3 t = vec3(0.0); float fade = 0.0;
    float face = 0.0;   // 1 on a board's outer face
    if (spine) {
      uv = spineUV(q);
      t = texture(u_tex, uv).rgb;
      fade = 0.92;
    } else {
      face = smoothstep(0.7, 0.9, abs(dot(n, onFront ? vec3(-sin(OPEN), 0.0, cos(OPEN)) : vec3(0.0, 0.0, -1.0)))) * step(0.0, b.z);
      uv = vec2(b.x, b.y);
      if (onFront) t = texture(u_tex, coverUV(b)).rgb * face;
      // The sun reached the boards along the joint and the top edge too.
      fade = max(smoothstep(0.03, 0.0, b.x) * 0.85, smoothstep(0.012, 0.0, BH - b.y) * 0.5);
      fade = max(fade, (1.0 - face) * 0.35);
    }
    vec3 c = cloth(uv * (spine ? 1.0 : 1.0) + (onBack ? 3.0 : 0.0), fade);
    // Soiling, a faint tide-line low on the front board, and handling.
    float soil = fbm(vec3(uv * 6.0, 9.0));
    c *= 0.95 + 0.07 * soil;
    if (onFront) {
      float tide = fbm(vec3(uv * 3.0, 2.0)) * 0.12 + length((uv - vec2(BL * 0.9, 0.06)) * vec2(1.0, 1.3));
      c *= 1.0 - 0.18 * smoothstep(0.012, 0.0, abs(tide - 0.2)) - 0.06 * smoothstep(0.2, 0.15, tide);
    }
    float rough = 0.82;
    // Rubbed at every edge, and through to the grey board at the corners.
    if (!spine) {
      float rub = smoothstep(0.009, 0.0, -edge) * smoothstep(0.3, 0.65, fbm(vec3(uv * 160.0, 2.0)));
      rub = max(rub, 1.0 - face);
      vec3 worn = mix(c, hex(0x77736a), 0.45);
      c = mix(c, worn, rub * 0.8);
      float corner = smoothstep(0.045, 0.0, length(vec2(max(BL - b.x - 0.004, 0.0), min(b.y, BH - b.y))) - 0.0) * step(BL * 0.5, b.x);
      float thru = corner * smoothstep(0.25, 0.55, fbm(vec3(uv * 120.0, 5.0)));
      c = mix(c, mix(hex(0x5b5248), hex(0x8d8370), noise(uv * 900.0)), thru);
      rough = mix(rough, 0.9, thru);
    } else {
      // The spine's ends have frayed: the threads show pale.
      float ends = min(q.y, BH - q.y);
      float fr = smoothstep(0.02, 0.0, ends) * smoothstep(0.3, 0.6, noise(vec2(q.z * 900.0, q.y * 60.0)));
      c = mix(c, hex(0x9a9282), fr * 0.7);
      // Rubbed along the joints, where it is handled.
      float j = smoothstep(0.75, 1.0, abs(q.z) / (BTH * 0.5));
      c = mix(c, hex(0x8a8474), j * 0.35 * smoothstep(0.35, 0.7, fbm(vec3(q.y * 40.0, q.z * 200.0, 1.0))));
    }
    // Blind stamping: the cloth is burnished and darker where it was struck.
    float blind = t.g;
    c = mix(c, c * 0.5, blind * (1.0 - t.r));
    rough = mix(rough, 0.55, blind);
    // Gilt, a little dulled, rubbed away at the edges of the letters.
    float loss = smoothstep(0.5, 0.7, fbm(vec3(uv * vec2(700.0, 500.0), 7.0)));
    float gilt = t.r * (1.0 - loss * 0.85) * (spine ? 0.85 : 1.0);
    vec3 gold = mix(hex(0xa98545), hex(0xd2b064), noise(uv * 500.0));
    c = mix(c, c * 0.5, t.r * (1.0 - gilt));
    return mat(mix(c, gold, gilt), mix(rough, 0.3, gilt), gilt);
  }

  // The leaves: toned paper, darker and dusty at the head, a few fox marks
  // on the fore-edge, the first leaf (the free endpaper) a cream wove.
  float leafLine = noise(vec2(q.z * 2600.0, 1.0)) * 0.6 + noise(vec2(q.z * 700.0, 4.0)) * 0.4;
  vec3 c = mix(hex(0xc9bc9d), hex(0xe0d6bf), leafLine);
  float up = smoothstep(0.5, 0.9, n.y);
  c = mix(c, hex(0x857b68), up * (0.35 + 0.35 * fbm(q * 50.0)));
  vec3 fox = voronoi(vec3(q.yz * 80.0, 1.0).xzy);
  c = mix(c, hex(0x8f7253), smoothstep(0.18, 0.05, fox.x) * step(0.82, fox.z) * 0.6 * smoothstep(0.5, 0.9, n.x));
  if (n.z > 0.8) c = mix(hex(0xd8cfb8), hex(0xcfc3a6), fbm(q * 30.0));
  // Toned more at the edges of every leaf.
  return mat(c, 0.85, 0.0);
}
