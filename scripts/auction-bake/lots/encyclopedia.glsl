/* Lot: six volumes of a nine-volume encyclopedia.
 *
 * Tall octavos in half calf: brown calf spines with five raised bands, a red
 * morocco title label and a black lettering-piece, gilt rolls and flower
 * tools in the compartments; calf corners and marbled-paper sides; sprinkled
 * edges. Volumes I to IV, a gap where V to VII should stand, then VIII and
 * IX. The spines are drawn in encyclopedia.svg (one column each, as masks).
 * Units: a volume is 1 tall (about 25 cm), spine facing +z.
 */
#define BOUND vec3(0.80, 0.52, 0.40)
#define CENTRE vec3(0.0, 0.50, 0.02)
#define VIEW_YAW 0.36
#define VIEW_PITCH 0.26
#define FILL 0.88
#define COAT(id) ((id) == 1.0 ? 0.16 : 0.0)

const float BH = 1.0;      // height
const float BW = 0.20;     // thickness across the boards
const float BD = 0.66;     // board width, fore-edge to spine
const float BT = 0.011;    // board thickness
const float SQ = 0.012;    // the squares: how far the boards stand past the leaves
const float SE = 0.034;    // where the spine's curve starts behind the back edge
const float BULGE = 0.018; // how round the spine is
const float PITCH = 0.2045;
const float GAP = 0.30;    // where V, VI and VII should be

float volX(int i) {
  float g = GAP / PITCH;
  float k = float(i) + (i >= 4 ? g : 0.0);
  return (k - 0.5 * (5.0 + g)) * PITCH;
}
float volYaw(int i) { return (hash11(float(i) * 3.17 + 1.0) - 0.5) * 0.035; }
float volZ(int i) { return (hash11(float(i) * 7.31 + 2.0) - 0.5) * 0.02; }

vec3 toVol(vec3 p, int i) {
  vec3 q = p - vec3(volX(i), 0.0, volZ(i));
  q.xz = rot(volYaw(i)) * q.xz;
  return q;
}
int nearestVol(float x) {
  int best = 0; float bd = 9.0;
  for (int i = 0; i < 6; i++) { float d = abs(x - volX(i)); if (d < bd) { bd = d; best = i; } }
  return best;
}

/* The raised bands, at 0.29 .. 0.85 of the height, as a bump. */
float bands(float y) {
  float v = y / BH;
  float k = clamp(floor((v - 0.29) / 0.14 + 0.5), 0.0, 4.0);
  float d = (v - (0.29 + k * 0.14)) * BH;
  float w = 0.0125;
  float t = max(0.0, 1.0 - (d * d) / (w * w));
  return 0.0068 * t * sqrt(t);
}

vec2 spineUV(vec3 q, int i) {
  return vec2((float(i) + clamp(q.x / BW + 0.5, 0.0, 1.0)) / 6.0, clamp(q.y / BH, 0.0, 1.0));
}

/* A 2D rounded rectangle. */
float rrect(vec2 p, vec2 b, float r) { vec2 d = abs(p) - b + r; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r; }

vec2 book(vec3 q, int i) {
  float hx = BW * 0.5;
  float fi = float(i);
  // The boards: bumped at the fore-edge corners, each by its own knocks.
  vec2 yz = vec2(q.y - BH * 0.5, q.z + SE * 0.5);
  float side = q.x > 0.0 ? 1.0 : 0.0;
  float knock = hash21(vec2(fi, side + 2.0 * step(BH * 0.5, q.y)));
  float rc = 0.004 + 0.012 * knock * step(q.z, 0.0);
  float b2 = rrect(yz, vec2(BH * 0.5, (BD - SE) * 0.5), rc);
  float bx = abs(q.x) - (hx - BT * 0.5);
  vec2 w = vec2(b2, abs(bx) - BT * 0.5);
  float board = length(max(w + 0.0022, 0.0)) + min(max(w.x, w.y), 0.0) - 0.0022;
  // Boards warp a little away from the block at the fore-edge.
  vec2 r = vec2(board, 2.0);

  // The leaves, a touch concave at the fore-edge (the spine was rounded).
  float ix = hx - BT;
  float xx = clamp(q.x / ix, -1.0, 1.0);
  float zf = -BD * 0.5 + SQ + 0.011 * (1.0 - xx * xx);
  float lv = 0.0006 * noise(vec2(q.x * 900.0, q.z * 6.0));
  float blk = max(max(abs(q.x) - ix + 0.0004, abs(q.y - BH * 0.5) - (BH * 0.5 - SQ) + lv), max(zf - q.z + lv, q.z - (BD * 0.5 - SE)));
  r = U(r, vec2(blk, 3.0));

  // The spine: half an ellipse that carries on from the boards' faces, with
  // the five bands raised across it and the labels a hair proud.
  float bb = bands(q.y);
  vec2 s = vec2(q.x, q.z - (BD * 0.5 - SE));
  vec2 er = vec2(hx + bb * 0.25, SE + BULGE + bb);
  float k0 = length(s / er), k1 = length(s / (er * er));
  float sp = k0 * (k0 - 1.0) / k1;
  if (sp < 0.006 && s.y > 0.0) {
    vec3 t = textureLod(u_tex, spineUV(q, i), 0.0).rgb;
    sp -= 0.0007 * max(t.g, t.b) * (1.0 - bb / 0.0068);
    sp += 0.00045 * t.r;
  }
  // Head and tail, the leather a little rounded and worn.
  float wear = 0.002 * fbm(vec3(q.x * 80.0, q.z * 80.0, fi));
  sp = smax(sp, abs(q.y - BH * 0.5) - BH * 0.5 + 0.0015 + wear, 0.004);
  // The spine is hollow above the leaves at the head and the tail: a thin
  // cap of leather turned in over the headband.
  vec2 ei = er - 0.0045;
  float k2 = length(s / ei), k3 = length(s / (ei * ei));
  float inner = k2 * (k2 - 1.0) / k3;
  float hollow = max(inner, min(BH - SQ - 0.002 - q.y, q.y - SQ - 0.002));
  sp = smax(sp, -hollow, 0.0015);
  // The headbands: a bead of silk worked over a core, along the curve.
  float hbY = q.y > BH * 0.5 ? q.y - (BH - SQ + 0.0025) : q.y - (SQ - 0.0025);
  float hb = length(vec2(inner + 0.0035, hbY)) - 0.0034;
  hb = max(hb, -s.y - 0.02);
  r = U(r, vec2(hb, 4.0));
  // The joint, where the board hinges.
  float jg = length(vec2(abs(q.x) - hx - 0.0015, q.z - (BD * 0.5 - SE - 0.006))) - 0.0032;
  sp = smax(sp, -jg, 0.0015);
  r = U(r, vec2(sp, 1.0));
  return r;
}

vec2 map(vec3 p) {
  vec2 r = vec2(9.0, 0.0);
  for (int i = 0; i < 6; i++) {
    vec3 q = toVol(p, i);
    float bx = sdBox(q - vec3(0.0, BH * 0.5, 0.0), vec3(BW * 0.5 + 0.004, BH * 0.5 + 0.004, BD * 0.5 + 0.03));
    if (bx > 0.01) { r = U(r, vec2(bx, 1.0)); continue; }
    r = U(r, book(q, i));
  }
  return r;
}

/* ---- materials ---------------------------------------------------------- */

/* Calf: a mottled brown with fine pores, dried and crazed on the spine,
   darker where it has been handled and polished, pale and suede-like where
   it has been rubbed through the surface. */
vec3 calf(vec3 q, float rub, float fi) {
  float m = fbm(q * 16.0 + fi * 7.0);
  float m2 = fbm(q * 64.0 + 3.0);
  vec3 c = mix(hex(0x34221a), hex(0x5e3f2e), smoothstep(0.3, 0.75, m));
  c = mix(c, hex(0x2c1a10), smoothstep(0.55, 0.8, m2) * 0.5);
  c *= 0.9 + 0.2 * hash11(fi * 5.3 + 0.7);
  float pore = smoothstep(0.62, 0.8, noise(q * 1400.0));
  c *= 1.0 - 0.18 * pore;
  // Sprinkled: the fine dark spatter the binder threw on the calf.
  vec3 sv = voronoi(q * 520.0 + fi);
  c *= 1.0 - 0.35 * smoothstep(0.22, 0.1, sv.x) * step(0.55, sv.z);
  return mix(c, hex(0x86705e), rub);
}

/* Marbled paper, in the cool blues and greys of a Stormont pattern. */
vec3 marble(vec2 uv, float fi) {
  // Stormont: the colour floated on the size and broken by turpentine into
  // a lace of small pale holes in a dark ground, drawn out into drifts.
  vec2 o = uv * 3.5 + fi * 7.3;
  vec2 w = uv * vec2(58.0, 44.0) + 1.7 * vec2(fbm(o), fbm(o + 4.3)) * vec2(11.0, 8.0);
  vec3 v = voronoi(w);
  float hole = smoothstep(0.46, 0.30, v.x);
  vec3 v2 = voronoi(w * 2.3 + 11.0);
  float small = smoothstep(0.34, 0.2, v2.x) * step(0.35, v2.z);
  float drift = fbm(w * 0.09 + 3.0);
  vec3 ground = mix(hex(0x121821), hex(0x1f2b3b), smoothstep(0.35, 0.7, drift));
  vec3 pale = mix(hex(0x3f5470), hex(0x6f7d8c), v.z);
  pale = mix(pale, hex(0x8f8a76), step(0.9, v.z) * 0.6);
  vec3 c = mix(ground, pale, hole * (0.55 + 0.45 * smoothstep(0.25, 0.65, drift)));
  c = mix(c, hex(0x52657c), small * 0.5 * (1.0 - hole));
  // Faded and a little grubby.
  c = mix(c, hex(0x5f625f), 0.1 + 0.12 * fbm(uv * 4.0 + fi));
  return c;
}

Mat material(float id, vec3 p, vec3 n) {
  int i = nearestVol(p.x);
  float fi = float(i);
  vec3 q = toVol(p, i);
  vec3 nq = n; nq.xz = rot(volYaw(i)) * nq.xz;
  float hx = BW * 0.5;

  if (id == 1.0) {
    // The spine.
    vec2 uv = spineUV(q, i);
    vec3 t = texture(u_tex, uv).rgb;
    float bb = bands(q.y) / 0.0068;
    // Rubbing: the crowns of the bands, the joints, the head and the tail.
    float edgeX = abs(q.x) / hx;
    float rub = 0.0;
    rub = max(rub, smoothstep(0.55, 1.0, bb) * 0.6 * smoothstep(0.4, 0.75, fbm(q * vec3(200.0, 60.0, 200.0))));
    rub = max(rub, smoothstep(0.86, 0.99, edgeX) * smoothstep(0.3, 0.7, fbm(vec3(q.y * 70.0, q.x * 300.0, fi))));
    float ends = min(q.y, BH - q.y);
    rub = max(rub, smoothstep(0.03, 0.0, ends) * smoothstep(0.25, 0.6, fbm(vec3(q.x * 120.0, q.z * 120.0, fi + 2.0))));
    // Scuffs from being taken down and put back.
    rub = max(rub, smoothstep(0.68, 0.8, fbm(vec3(q.x * 30.0, q.y * 12.0, fi * 3.0))) * 0.4);
    vec3 c = calf(q, rub, fi);
    // The spine has dried: fine crazing, darker cracks.
    vec3 cr = voronoi(vec2(q.x * 260.0, q.y * 120.0) + fi * 11.0);
    float crack = smoothstep(0.06, 0.0, cr.y - cr.x) * smoothstep(0.35, 0.65, fbm(q * 30.0 + fi));
    c = mix(c, hex(0x24130b), crack * 0.55);
    // A little sunned and dry: duller than the corners.
    c = mix(c, c * vec3(1.05, 0.98, 0.92) + 0.015, 0.4);
    float rough = mix(0.46, 0.85, rub);
    // The labels, chipped at their edges.
    float chip = smoothstep(0.45, 0.62, fbm(vec3(uv * vec2(900.0, 400.0), fi)));
    float red = t.g * (1.0 - chip * smoothstep(0.98, 0.5, t.g) * 0.0);
    float blk = t.b;
    float lchip = smoothstep(0.66, 0.72, fbm(vec3(q.x * 70.0, q.y * 70.0, fi + 5.0)));
    red *= 1.0 - lchip * 0.8; blk *= 1.0 - lchip * 0.8;
    vec3 redc = mix(hex(0x3c1310), hex(0x521c16), fbm(q * 120.0));
    redc = mix(redc, hex(0x8d5545), rub * 0.6);
    vec3 blkc = mix(hex(0x141112), hex(0x2a2423), fbm(q * 140.0));
    blkc = mix(blkc, hex(0x5a4a42), rub * 0.6);
    c = mix(c, redc, red);
    c = mix(c, blkc, blk);
    rough = mix(rough, 0.38, max(red, blk));
    // Gilt: bright where it held, gone where it flaked, rubbed off the bands.
    float flake = smoothstep(0.5, 0.64, fbm(vec3(uv * vec2(1400.0, 520.0), fi * 1.7)));
    float gilt = t.r * (1.0 - flake) * (1.0 - 0.85 * smoothstep(0.3, 0.8, rub));
    // Where the gold has gone the tool's impression is left, darker.
    c = mix(c, c * 0.62, t.r * (1.0 - gilt));
    vec3 gold = mix(hex(0xb48a42), hex(0xd8b56a), noise(q * 600.0));
    Mat m = mat(mix(c, gold, gilt), mix(rough, 0.3, gilt), gilt);
    return m;
  }

  if (id == 2.0) {
    // A board: calf at the back edge and the corners, marbled paper between.
    float fromSpine = (BD * 0.5 - SE) - q.z;
    float fromFore = q.z + BD * 0.5;
    float fromEnd = min(q.y, BH - q.y);
    float halfLeather = 0.13 - fromSpine;
    float leather = max(halfLeather, 0.15 - (fromFore + fromEnd));
    float onSide = smoothstep(0.6, 0.8, abs(nq.x));
    vec3 c;
    float rough;
    float rubEdge = 1.0 - onSide;
    if (leather > 0.0) {
      float rub = max(rubEdge * smoothstep(0.3, 0.6, fbm(q * 160.0)), smoothstep(0.012, 0.0, min(fromFore, fromEnd)) * 0.8);
      rub = max(rub, smoothstep(0.62, 0.75, fbm(vec3(q.y * 18.0, q.z * 30.0, fi + 9.0))) * 0.5 * onSide);
      c = calf(q, rub, fi);
      rough = mix(0.42, 0.85, rub);
    } else {
      c = marble(vec2(q.z * 1.2, q.y * 1.2) + (q.x > 0.0 ? 0.0 : 5.0), fi);
      c = mix(c * 0.62, vec3(dot(c, vec3(0.3, 0.5, 0.2))) * 0.62, 0.2);
      // The paper is rubbed through on the edges to the grey board.
      float thru = rubEdge * smoothstep(0.35, 0.6, fbm(q * vec3(200.0, 60.0, 200.0)));
      c = mix(c, hex(0x6f675c), thru);
      // Shelf-rubbing on the sides, more towards the fore-edge.
      c = mix(c, hex(0x5c5d5c), onSide * 0.25 * smoothstep(0.6, 0.85, fbm(vec3(q.z * 9.0, q.y * 9.0, fi))));
      rough = 0.72;
    }
    // A gilt fillet along the edge of the leather.
    float edgeLine = abs(leather + 0.0045) - 0.0009;
    float g = smoothstep(0.0004, -0.0002, edgeLine) * onSide;
    g *= 1.0 - smoothstep(0.45, 0.6, fbm(q * 500.0));
    // The paper's edge over the leather: a fine dark line.
    c *= 1.0 - 0.35 * smoothstep(0.0012, 0.0, abs(leather)) * onSide;
    vec3 gold = hex(0xbf9850);
    return mat(mix(c, gold, g), mix(rough, 0.32, g), g);
  }

  if (id == 4.0) {
    // Silk headband, faded: blue and cream in turn, worked in little beads.
    float a = atan(q.x, q.z - (BD * 0.5 - SE)) * 22.0;
    float st = step(0.5, fract(a * 0.5));
    vec3 c = mix(hex(0x6d6a5e), hex(0x2c3a52), st);
    c *= 0.7 + 0.3 * sin(fract(a) * 3.14159);
    return mat(c, 0.6, 0.0);
  }
  // The leaves: old paper, sprinkled at the edges, the leaves showing as
  // fine lines, dust settled on the head.
  float leafLine = noise(vec2(q.x * 2400.0, fi)) * 0.6 + noise(vec2(q.x * 700.0, fi + 3.0)) * 0.4;
  vec3 c = mix(hex(0xb7aa8c), hex(0xd3c8ae), leafLine);
  vec2 sp2 = abs(nq.y) > 0.5 ? q.xz : q.xy;
  vec3 v = voronoi(sp2 * 420.0 + fi * 3.0);
  float dot1 = smoothstep(0.22, 0.12, v.x) * step(0.45, v.z);
  vec3 v2 = voronoi(sp2 * 160.0 + fi * 5.0);
  float dot2 = smoothstep(0.16, 0.08, v2.x) * step(0.7, v2.z);
  c = mix(c, hex(0x3d4c60), max(dot1 * 0.75, dot2 * 0.8));
  if (nq.y > 0.5) c = mix(c, hex(0x6f675a), 0.35 + 0.3 * fbm(q * 40.0));
  return mat(c, 0.85, 0.0);
}
