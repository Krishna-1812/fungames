/* Lot: a writing desk with one compartment nobody can open.
 *
 * A George III walnut kneehole bureau. The fall is let down onto its lopers
 * to show the fitted interior: an arched prospect door between two pilaster
 * document drawers, pigeonholes with shaped valances over two tiers of small
 * drawers, a few letters still in them. The writing surface is tooled green
 * leather. Below, a long drawer over a kneehole with a recessed cupboard,
 * flanked by two banks of three graduated drawers on bracket feet. Every
 * drawer front is burr walnut, crossbanded and feather-strung, with swan-neck
 * handles on oval plates; every one but the lower right, which has a keyhole,
 * no handles, and a seam you can barely get a fingernail into.
 * Units: metres. The bureau is 92 cm wide and a metre high.
 */
#define BOUND vec3(0.49, 0.51, 0.43)
#define CENTRE vec3(0.0, 0.51, 0.155)
#define VIEW_YAW 0.46
#define VIEW_PITCH 0.30
#define FILL 0.84
#define COAT(id) ((id) == 1.0 ? 0.42 : ((id) == 4.0 ? 0.10 : 0.0))

const float FZ = 0.24;     // the carcase front
const float HW = 0.46;     // half the width
const vec2 SN = vec2(0.785, 0.619);  // the slope's outward normal in (y, z)

/* The lower case's drawers: centre xy, half size. The last is the one. */
const vec4 DR[8] = vec4[8](
  vec4(0.0, 0.740, 0.375, 0.035),
  vec4(0.0, 0.6475, 0.150, 0.0475),
  vec4(-0.30, 0.625, 0.14, 0.07),
  vec4(-0.30, 0.455, 0.14, 0.09),
  vec4(-0.30, 0.245, 0.14, 0.11),
  vec4(0.30, 0.625, 0.14, 0.07),
  vec4(0.30, 0.455, 0.14, 0.09),
  vec4(0.30, 0.245, 0.14, 0.11));
const vec4 DOOR = vec4(0.0, 0.355, 0.125, 0.215);  // the kneehole cupboard, face at z = 0.03

float sdR(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }

/* Which drawer's patch of the front a point is on (the patches meet on the
   middle of the rails), or -1. */
int cellOf(vec2 q) {
  if (q.y > 0.70) return abs(q.x) < 0.38 ? 0 : -1;
  if (abs(q.x) < 0.155) return q.y > 0.5975 ? 1 : -1;
  int s = q.x > 0.0 ? 5 : 2;
  return q.y > 0.55 ? s : (q.y > 0.36 ? s + 1 : s + 2);
}

/* A keyhole: a round head and a slot, in the plate's own frame. */
float keyhole(vec2 q) { return min(length(q - vec2(0.0, 0.0028)) - 0.0024, sdR(q - vec2(0.0, -0.0015), vec2(0.0010, 0.0045))); }

float escutcheon(vec3 q) {
  // A shaped plate, wider at the head: a cartouche.
  vec2 e = vec2(q.x * (1.0 + 0.25 * smoothstep(-0.016, 0.016, q.y)), q.y) / vec2(0.010, 0.0155);
  float plate = max((length(e) - 1.0) * 0.010, abs(q.z - 0.0006) - 0.0007);
  return max(plate, -keyhole(q.xy));
}

/* A swan-neck bail on an oval plate; q is from the handle's centre. */
float handle(vec3 q) {
  const float RY = 0.010;
  float ros = sdEllipsoid(vec3(abs(q.x) - 0.030, q.y - RY, q.z - 0.0045), vec3(0.0075, 0.0075, 0.0045));
  vec2 b = vec2(q.x, q.y - 0.001) / vec2(0.050, 0.025);
  float plate = max((length(b) - 1.0) * 0.024, abs(q.z - 0.0007) - 0.0007);
  // The bail hangs from the rosettes, a little off the plate, and kicks up
  // at the ends into the swan necks.
  vec2 bq = vec2(q.x, (q.y - RY) * 1.18);
  float arc = (length(vec2(length(bq) - 0.030, q.z - 0.0085)) - 0.0026) * 0.85;
  arc = max(arc, q.y - RY + 0.003);
  float neck = sdCapsule(vec3(abs(q.x), q.y, q.z), vec3(0.030, RY - 0.004, 0.0085), vec3(0.030, RY, 0.0055), 0.0024);
  return min(min(ros, plate), min(arc, neck));
}

/* A bracket foot's board in its own plane: u runs in from the corner, v up. */
float footBoard(vec2 q) {
  float d = sdR(q - vec2(0.031, 0.0475), vec2(0.043, 0.0475));
  // The scroll cut away under the inner end, ending in a spur.
  float cut = (length((q - vec2(0.088, -0.004)) / vec2(0.050, 0.058)) - 1.0) * 0.05;
  return max(d, -cut);
}

float foot(vec3 p, vec2 c, vec2 s) {
  // u, w: in from the corner along x and z (the outside faces are at 0).
  float u = (c.x - p.x) * s.x, w = (c.y - p.z) * s.y;
  // A slight ogee swell on the outside faces.
  float sw = 0.006 * sin(clamp(p.y / 0.092, 0.0, 1.0) * 3.0);
  float fb = max(footBoard(vec2(u, p.y)), abs(w - 0.008) - 0.020 - sw);
  float sb = max(footBoard(vec2(w, p.y)), abs(u - 0.008) - 0.020 - sw);
  return max(min(fb, sb), max(-u - 0.012 - sw, -w - 0.012 - sw)) - 0.0015;
}

/* The fitted interior. */
vec2 interior(vec3 p) {
  float px = abs(p.x);
  float inr = sdBox(p - vec3(0.0, 0.8875, -0.115), vec3(0.44, 0.0925, 0.115));
  float knobs = 1e9;
  if (px > 0.105) {
    // Pigeonholes, four a side, arched valances at the front.
    float cw = 0.335 / 4.0;
    float k = clamp(floor((px - 0.105) / cw), 0.0, 3.0);
    float hx = px - (0.105 + (k + 0.5) * cw), hw = cw * 0.5 - 0.0035;
    float back = sdBox(vec3(hx, p.y - 0.9375, p.z + 0.098), vec3(hw, 0.0335, 0.09));
    float a2 = min(sdR(vec2(hx, p.y - 0.925), vec2(hw, 0.021)), (length(vec2(hx / hw, (p.y - 0.946) / 0.020)) - 1.0) * 0.02);
    float front = max(a2, abs(p.z - 0.005) - 0.013);
    inr = max(inr, -min(back, front));
    // The middle tier: three small drawers a side, flush.
    float dw = 0.335 / 3.0;
    float j = clamp(floor((px - 0.105) / dw), 0.0, 2.0);
    vec2 dq = vec2(px - (0.105 + (j + 0.5) * dw), p.y - 0.8745);
    float e = sdR(dq, vec2(dw * 0.5 - 0.0025, 0.0225));
    inr = max(inr, -max(abs(e) - 0.0007, -0.008 - p.z));
    knobs = min(knobs, length(vec3(dq, p.z - 0.0035)) - 0.0042);
    // The bottom tier steps forward: two drawers a side.
    float step2 = sdBox(vec3(px - 0.2725, p.y - 0.8205, p.z - 0.0275), vec3(0.1675, 0.0255, 0.0275));
    float bw = 0.335 / 2.0;
    float b = clamp(floor((px - 0.105) / bw), 0.0, 1.0);
    vec2 bq = vec2(px - (0.105 + (b + 0.5) * bw), p.y - 0.821);
    float eb = sdR(bq, vec2(bw * 0.5 - 0.003, 0.0215));
    step2 = max(step2, -max(abs(eb) - 0.0007, 0.047 - p.z));
    inr = min(inr, step2);
    knobs = min(knobs, length(vec3(bq, p.z - 0.0585)) - 0.0045);
  } else {
    // The prospect door, arched panel, and the pilasters either side.
    float door = sdBox(p - vec3(0.0, 0.8875, 0.006), vec3(0.074, 0.0855, 0.006));
    vec2 dq = p.xy;
    float pan = min(sdR(dq - vec2(0.0, 0.873), vec2(0.048, 0.055)), length(dq - vec2(0.0, 0.928)) - 0.048);
    door = max(door, -max(abs(pan) - 0.0012, 0.0095 - p.z));
    inr = min(inr, door);
    vec3 cq = vec3(px - 0.09, p.y, p.z - 0.004);
    float col = max(length(cq.xz) - 0.0095, abs(p.y - 0.8875) - 0.072);
    col = min(col, sdRound(cq - vec3(0.0, 0.807, 0.004), vec3(0.0135, 0.007, 0.0135), 0.002));
    col = min(col, sdRound(cq - vec3(0.0, 0.968, 0.004), vec3(0.0135, 0.007, 0.0135), 0.002));
    inr = min(inr, col);
    knobs = min(knobs, escutcheon(vec3(p.x - 0.062, p.y - 0.885, p.z - 0.012) * 1.6) / 1.6);
  }
  vec2 r = U(vec2(inr, 1.0), vec2(knobs, 2.0));
  // Letters still in two of the pigeonholes: a bundle lying flat, and a few
  // standing, leaning on the partition.
  float cw = 0.335 / 4.0;
  float lt = sdRound(p - vec3(-(0.105 + 2.5 * cw), 0.9115, -0.09), vec3(0.031, 0.0075, 0.098), 0.0012);
  vec3 lq = p - vec3(0.105 + 0.5 * cw - 0.012, 0.904, -0.07);
  lq.xy = rot(0.22) * lq.xy;
  lt = min(lt, sdRound(lq - vec3(0.0, 0.024, 0.0), vec3(0.006, 0.024, 0.075), 0.001));
  r = U(r, vec2(lt, 6.0));
  return r;
}

vec2 map(vec3 p) {
  float px = abs(p.x);
  // ---- the lower case: one block, the kneehole and the loper slots cut out
  float body = sdBox(p - vec3(0.0, 0.46, -0.005), vec3(HW, 0.335, 0.245));
  body = max(body, -sdBox(p - vec3(0.0, 0.28, 0.53), vec3(0.15, 0.31, 0.5)));
  body = max(body, -sdBox(vec3(px - 0.4125, p.y - 0.74, p.z - FZ), vec3(0.0285, 0.0355, 0.30)));
  int ci = -1;
  vec3 cq = vec3(0.0);
  if (p.z > FZ - 0.03 && p.y > 0.12 && p.y < 0.79) {
    ci = cellOf(p.xy);
    if (ci >= 0) {
      vec4 dr = DR[ci];
      cq = vec3(p.xy - dr.xy, p.z - FZ);
      float e = sdR(cq.xy, dr.zw);
      float groove = min(abs(e) - (ci == 7 ? 0.00028 : 0.0012), keyhole(cq.xy));
      body = max(body, -max(groove, FZ - 0.022 - p.z));
      body = min(body, length(vec2(e + 0.0042, cq.z)) - 0.0026);
    }
  }
  // The cupboard at the back of the kneehole.
  if (p.z < 0.06 && px < 0.16 && p.y < 0.6) {
    vec2 q = p.xy - DOOR.xy;
    float e = sdR(q, DOOR.zw);
    body = max(body, -max(min(abs(e) - 0.0012, keyhole(q - vec2(0.10, 0.0))), 0.01 - p.z));
    body = min(body, length(vec2(e + 0.0042, p.z - 0.03)) - 0.0026);
  }
  // ---- the upper case: sides cut to the slope, back, top
  float up = max(sdBox(vec3(px - 0.45, p.y - 0.895, p.z + 0.005), vec3(0.01, 0.105, 0.245)), dot(vec2(p.y - 0.795, p.z - FZ), SN));
  up = min(up, sdBox(p - vec3(0.0, 0.895, -0.24), vec3(0.46, 0.105, 0.01)));
  up = min(up, sdRound(p - vec3(0.0, 0.99, -0.132), vec3(0.472, 0.01, 0.126), 0.004));
  body = min(body, up);
  // ---- the base moulding, returned into the kneehole, and six bracket feet
  float mould = sdRound(p - vec3(0.0, 0.110, -0.005), vec3(HW + 0.013, 0.016, 0.245 + 0.013), 0.010);
  mould = min(mould, sdRound(p - vec3(0.0, 0.128, -0.005), vec3(HW + 0.005, 0.004, 0.245 + 0.005), 0.003));
  mould = max(mould, -sdBox(p - vec3(0.0, 0.28, 0.53 + 0.013), vec3(0.15 - 0.013, 0.31, 0.5)));
  body = min(body, mould);
  if (p.y < 0.12) {
    vec3 fp = vec3(px, p.y, p.z);
    float f = foot(fp, vec2(HW, FZ), vec2(1.0, 1.0));
    f = min(f, foot(fp, vec2(0.15, FZ), vec2(-1.0, 1.0)));
    f = min(f, foot(fp, vec2(HW, -0.25), vec2(1.0, -1.0)));
    body = min(body, f);
  } else body = min(body, sdBox(p - vec3(0.0, 0.05, -0.005), vec3(HW + 0.02, 0.05, 0.27)));
  // ---- the lopers, pulled out, and the fall resting on them
  body = min(body, sdRound(vec3(px - 0.4125, p.y - 0.74, p.z - 0.17), vec3(0.0265, 0.034, 0.33), 0.002));
  float fall = sdRound(p - vec3(0.0, 0.785, 0.405), vec3(0.438, 0.01, 0.165), 0.003);
  fall = max(fall, -sdBox(p - vec3(0.0, 0.80, 0.405), vec3(0.40, 0.0055, 0.133)));
  body = min(body, fall);
  vec2 r = vec2(body, 1.0);
  r = U(r, vec2(sdBox(p - vec3(0.0, 0.7915, 0.405), vec3(0.3995, 0.0032, 0.1325)) - 0.0002, 4.0));

  // ---- the fitted interior, inside its box
  float ib = sdBox(p - vec3(0.0, 0.8875, -0.075), vec3(0.445, 0.0935, 0.16));
  r = ib < 0.01 ? U(r, interior(p)) : U(r, vec2(ib, 1.0));

  // ---- brass: handles, escutcheons, the loper knobs
  if (ci >= 0 && p.z < FZ + 0.03) {
    float br = escutcheon(cq);
    if (ci != 7) br = min(br, handle(vec3(abs(cq.x) - DR[ci].z * 0.55, cq.yz)));
    r = U(r, vec2(br, 2.0));
  } else if (ci >= 0) r = U(r, vec2(p.z - FZ - 0.015, 2.0));
  if (p.z < 0.05 && px < 0.15 && p.y < 0.6) r = U(r, vec2(escutcheon(vec3(p.x - 0.10, p.y - 0.355, p.z - 0.03)), 2.0));
  float lk = length(vec3(px - 0.4125, p.y - 0.74, p.z - 0.505)) - 0.0065;
  lk = min(lk, sdCyl(vec3(px - 0.4125, p.z - 0.501, p.y - 0.74), 0.003, 0.003));
  r = U(r, vec2(lk, 2.0));
  return r;
}

/* ---- walnut ------------------------------------------------------------ */

vec3 wl() { return hex(0x7b5d40); }
vec3 wm() { return hex(0x4f3926); }
vec3 wd() { return hex(0x261a12); }

/* Flat-sawn walnut: the growth rings cut through at a slant, so they open
   into arches along the board; g.x runs along the grain. */
vec3 grain(vec2 g, float seed) {
  g += seed * 3.7;
  float board = floor(g.y * 3.2);
  float hb = hash11(board + seed * 13.0);
  vec2 w = vec2(fbm(vec2(g.x * 0.9, g.y * 5.0)), fbm(vec2(g.x * 1.4 + 3.1, g.y * 7.0)));
  float across = (fract(g.y * 3.2) - 0.5) / 3.2 + (hb - 0.5) * 0.12 + (w.x - 0.5) * 0.03;
  float depth = 0.02 + 0.09 * (0.5 + 0.5 * sin(g.x * (1.6 + hb) + hb * 6.0));
  float s = length(vec2(across, depth)) * 42.0 + w.y * 1.8;
  float ring = fract(s);
  float late = smoothstep(0.45, 0.9, ring) * smoothstep(1.0, 0.93, ring);
  float fine = noise(vec2(g.x * 3.0, g.y * 260.0 + w.x * 20.0));
  float pore = smoothstep(0.76, 0.9, noise(vec2(g.x * 26.0, g.y * 1100.0)));
  // Walnut's dark streaks: broad, wandering, smoky.
  float streak = smoothstep(0.52, 0.82, fbm(vec2(g.x * 0.7, g.y * 6.0 + w.x * 2.0)));
  vec3 c = mix(wl(), wm(), 0.2 + 0.15 * fine + 0.35 * w.y + 0.25 * hb);
  c = mix(c, wd(), late * 0.38 + streak * 0.5);
  // Broad heartwood colour swings, as one board differs from the next.
  c *= 0.86 + 0.28 * fbm(vec2(g.x * 0.6, g.y * 2.5) + seed);
  return c * (1.0 - 0.2 * pore);
}

/* Burr walnut: swirls round dark clustered eyes. */
vec3 burr(vec2 q) {
  vec2 w = q * 10.0 + vec2(fbm(q * 6.0), fbm(q * 6.0 + 5.2)) * 2.8;
  float f = fbm(w);
  float swirl = 0.5 + 0.5 * sin(f * 40.0 + fbm(q * 22.0) * 7.0);
  float sw2 = 0.5 + 0.5 * sin(fbm(w * 2.3 + 7.0) * 60.0);
  vec3 v = voronoi(q * 85.0);
  float cluster = smoothstep(0.45, 0.72, fbm(q * 8.0 + 3.0));
  float pip = smoothstep(0.22, 0.04, v.x) * cluster * step(0.3, v.z);
  float cloud = smoothstep(0.40, 0.8, fbm(q * 3.5 + 11.0));
  vec3 c = mix(hex(0x7d5e40), hex(0x4a3424), swirl * 0.45 + sw2 * 0.2 + f * 0.3);
  c = mix(c, wd(), cloud * 0.5 + pip * 0.7);
  c = mix(c, wd() * 0.8, smoothstep(0.32, 0.12, v.x) * cluster * 0.3);
  float pore = smoothstep(0.76, 0.9, noise(q * 900.0));
  return c * (1.0 - 0.18 * pore);
}

/* A veneered panel: burr in the field, feather banding, crossbanded edge. */
vec3 panel(vec2 l, vec2 h, float seed) {
  float e = -sdR(l, h);
  bool vert = (h.x - abs(l.x)) < (h.y - abs(l.y));
  float along = vert ? l.y : l.x, across = vert ? l.x : l.y;
  if (e < 0.017) {
    // Crossbanding: short pieces, the grain across the edge.
    float pc = along / 0.055 + seed * 9.0;
    float piece = floor(pc);
    vec3 c = grain(vec2(across * 3.0, along), seed + hash11(piece) * 7.0);
    c *= 0.92 + 0.14 * hash11(piece + 3.1);
    float joint = smoothstep(0.0007, 0.0, abs(fract(pc) - 0.5) * 0.055 - 0.0268);
    return c * (1.0 - 0.3 * joint);
  }
  if (e < 0.0225) {
    // Feather banding: two rows of little diagonal slips, a dark line each side.
    float row = e < 0.01975 ? 1.0 : -1.0;
    float slip = fract((along + row * e) / 0.0032);
    vec3 c = mix(hex(0x8f7150), hex(0x3a2a1c), smoothstep(0.35, 0.65, slip) * 0.7);
    c = mix(c, wd() * 0.6, step(abs(e - 0.0172), 0.0005) + step(abs(e - 0.0222), 0.0005));
    return c;
  }
  return burr(l + seed * 1.7);
}

Mat material(float id, vec3 p, vec3 n) {
  float px = abs(p.x);
  if (id == 2.0) {
    // Old brass, never lacquered since, rubbed bright where hands go.
    float tarn = smoothstep(0.3, 0.75, fbm(p * 140.0));
    vec3 c = mix(hex(0xa8864f), hex(0x5a4228), 0.4 + tarn * 0.45);
    return mat(c, 0.34 + 0.18 * tarn, 0.8);
  }
  if (id == 4.0) {
    // Tooled green leather, worn and faded where the wrists go.
    vec2 l = vec2(p.x, p.z - 0.405);
    float e = -sdR(l, vec2(0.3995, 0.1325));
    float pebble = noise(p.xz * 900.0) * 0.5 + noise(p.xz * 2600.0) * 0.5;
    float wear = smoothstep(0.35, 0.8, fbm(vec3(p.xz * 7.0, 2.0))) * smoothstep(0.16, 0.0, abs(p.z - 0.49));
    vec3 c = mix(hex(0x203026), hex(0x3c4638), pebble * 0.3 + wear * 0.6);
    c *= 0.82 + 0.28 * fbm(vec3(p.xz * 24.0, 1.0));
    // Gilt tooling: a double fillet and a run of little stamps between.
    float gilt = step(abs(e - 0.008), 0.0007) + step(abs(e - 0.019), 0.0006);
    float along = (0.3995 - abs(l.x)) < (0.1325 - abs(l.y)) ? l.y : l.x;
    float stamp = step(abs(e - 0.0135), 0.0025) * step(abs(fract(along / 0.007) - 0.5), 0.22);
    gilt = clamp(gilt + stamp * 0.8, 0.0, 1.0) * (0.45 + 0.4 * noise(p.xz * 400.0));
    return mat(mix(c, hex(0x8c6c38), gilt), mix(0.6, 0.38, gilt), gilt * 0.85);
  }
  if (id == 6.0) {
    // Old letters: rag paper, browned at the edges.
    float tone = fbm(p * 60.0);
    vec3 c = mix(hex(0xa89a7c), hex(0x837256), tone * 0.7);
    float leaves = smoothstep(0.25, 0.5, abs(fract((abs(n.x) > 0.5 ? p.y : p.y) * 1300.0) - 0.5));
    c *= 1.0 - 0.2 * leaves * step(abs(n.y), 0.5);
    Mat m = mat(c, 0.8, 0.0);
    m.sss = 0.2;
    return m;
  }
  // Walnut.
  vec3 c;
  bool frontFace = n.z > 0.6;
  int ci = (frontFace && p.z > FZ - 0.006 && p.z < FZ + 0.006 && p.y > 0.125 && p.y < 0.785) ? cellOf(p.xy) : -1;
  vec2 l = ci >= 0 ? p.xy - DR[ci].xy : vec2(0.0);
  if (ci >= 0 && sdR(l, DR[ci].zw) < -0.0002) {
    c = panel(l, DR[ci].zw, float(ci) * 1.37);
    c *= mix(1.0, 0.03, smoothstep(0.0003, -0.0003, keyhole(l)) * step(p.z, FZ - 0.0008));
    if (ci == 7) {
      // Faint scratches round the keyhole, where people have tried.
      float a = atan(l.y, l.x), rr = length(l);
      float sc = step(0.8, hash11(floor(a * 18.0))) * smoothstep(0.03, 0.012, rr) * step(0.009, rr);
      sc *= smoothstep(0.35, 0.0, abs(fract(a * 18.0) - 0.5));
      c = mix(c, hex(0x9c8062), sc * 0.55);
    }
  } else if (frontFace && p.z > FZ - 0.006 && p.z < FZ + 0.006 && p.y < 0.79) {
    // Rails run across, stiles up.
    float fy = p.y;
    bool rail = px < 0.445 && (fy > 0.775 || fy < 0.135 || abs(fy - 0.700) < 0.006 || abs(fy - 0.550) < 0.006 || abs(fy - 0.360) < 0.006 || (px < 0.155 && fy > 0.585));
    c = rail ? grain(vec2(p.x, p.y), 4.0) : grain(vec2(p.y, p.x), 5.0);
  } else if (frontFace && p.z < 0.035 && p.z > 0.025 && px < 0.15 && p.y < 0.59 && p.y > 0.13) {
    vec2 dl = p.xy - DOOR.xy;
    c = panel(dl, DOOR.zw, 8.3);
    c *= mix(1.0, 0.03, smoothstep(0.0003, -0.0003, keyhole(dl - vec2(0.10, 0.0))) * step(p.z, 0.0292));
  } else if (n.y > 0.7 && p.y > 0.79 && p.y < 0.8 && p.z > FZ) {
    // The fall's inner face: crossbanding round the leather.
    vec2 fl = vec2(p.x, p.z - 0.405);
    c = abs(fl.x) > 0.40 ? grain(vec2(fl.x * 3.0, fl.y), 6.0) : grain(vec2(fl.y * 3.0, fl.x), 6.5);
  } else if (abs(n.x) > 0.7) {
    c = grain(vec2(p.y, p.z), 1.0);
  } else if (abs(n.y) > 0.7) {
    c = grain(vec2(p.x, p.z), 2.0);
    // The top is faded by a window, a century of it.
    c = mix(c, hex(0x86705a), smoothstep(0.97, 1.0, p.y) * 0.25);
  } else {
    c = grain(vec2(p.x, p.y + p.z), 3.0);
  }
  // Inside the interior and the kneehole the colour is deeper, unfaded.
  float inside = smoothstep(0.03, -0.02, p.z) * step(0.79, p.y) * step(px, 0.44);
  c *= 1.0 - 0.1 * inside;
  float rough = 0.40 + 0.14 * noise(p * 70.0);
  return mat(c, rough, 0.0);
}
