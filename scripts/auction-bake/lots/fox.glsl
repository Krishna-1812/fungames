/* Lot: a taxidermy fox, standing, in a small waistcoat.
 *
 * A red fox mounted standing on an ebonised plinth, as a Victorian taxidermist
 * would have set it up: square on all four feet, the brush hanging and curled
 * round towards the camera, the head turned to look at whoever is bidding.
 * The waistcoat (later) is a slate-green tweed check with four horn buttons
 * down the chest and a welted pocket, fitted round the chest behind the
 * forelegs with the white bib showing at its V. Fur is displacement, combed
 * along each part's lie: down and back on the body, back from the nose on
 * the head, down the legs, out along the brush; there is a moth-thinned patch
 * on the brush. Units: centimetres.
 */
#define BOUND vec3(15.0, 30.5, 36.0)
#define CENTRE vec3(0.0, 30.5, 5.0)
#define VIEW_YAW 0.92
#define VIEW_PITCH 0.10
#define FILL 0.88
#define STEP 0.55
#define COAT(id) ((id) == 15.0 ? 1.0 : ((id) == 21.0 ? 0.75 : ((id) == 16.0 ? 0.3 : ((id) == 22.0 ? 0.6 : 0.0))))
#define SHEEN(id) ((id) >= 10.0 && (id) < 15.0 ? 0.85 : ((id) == 20.0 ? 0.3 : 0.0))

const float PH = 6.0;                       // the plinth's top
const vec2 PLINTH = vec2(14.0, 35.0);       // its half size in plan
const float PZ = 4.0;                       // its centre in z
const vec3 PIVOT = vec3(0.0, 37.0, 22.0);   // where the head turns on the neck
const float HEAD_YAW = 0.55, HEAD_ROLL = -0.13, HEAD_DIP = 0.06;

float sat(float x) { return clamp(x, 0.0, 1.0); }
float sdRR(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }

/* ---- the plinth -------------------------------------------------------- */

float plinth(vec3 p) {
  float y = p.y;
  // An ogee moulding between a plain foot and the top's fillet.
  float inset = 0.0;
  inset += 0.18 * smoothstep(0.9, 1.15, y) - 0.18 * smoothstep(1.35, 1.6, y);   // a bead
  inset += 1.7 * smoothstep(1.6, 4.5, y);
  float d = sdRR(p.xz - vec2(0.0, PZ), PLINTH - inset, 1.2 - inset * 0.4);
  d = smax(d, y - PH, 0.25);
  d = smax(d, -y, 0.1);
  return d * 0.85;
}

/* ---- the fox's frame and parts ---------------------------------------- */

vec3 headSpace(vec3 q) {
  vec3 v = q - PIVOT;
  v.xz = rot(-HEAD_YAW) * v.xz;
  v.xy = rot(-HEAD_ROLL) * v.xy;
  v.yz = rot(HEAD_DIP) * v.yz;
  return v + PIVOT;
}

float torso(vec3 q) {
  float chest = sdEllipsoid(q - vec3(0.0, 28.8, 13.0), vec3(6.0, 9.2, 9.8));
  float mid = sdEllipsoid(q - vec3(0.0, 30.0, 0.5), vec3(5.6, 7.0, 11.5));
  float hips = sdEllipsoid(q - vec3(0.0, 30.6, -12.0), vec3(6.2, 6.4, 8.5));
  float t = smin(smin(chest, mid, 4.0), hips, 4.0);
  return t;
}
float neck(vec3 q) { return sdCone(q, vec3(0.0, 30.5, 15.0), PIVOT + vec3(0.0, 0.8, 0.6), 5.8, 4.8); }

/* The forelegs; the near one (+x) is a step ahead. */
float foreLeg(vec3 q, out float lower) {
  float zo = q.x > 0.0 ? 1.6 : 0.0;
  vec3 m = vec3(abs(q.x), q.y, q.z);
  float up = sdCone(m, vec3(4.0, 30.0, 15.0 + zo * 0.3), vec3(3.7, 20.5, 11.8 + zo * 0.6), 3.0, 1.9);
  float fore = sdCone(m, vec3(3.6, 20.5, 11.8 + zo * 0.6), vec3(3.0, 5.6, 13.4 + zo), 1.5, 0.95);
  float past = sdCone(m, vec3(3.0, 5.6, 13.4 + zo), vec3(3.0, 1.8, 14.7 + zo), 0.95, 0.9);
  float paw = sdEllipsoid(m - vec3(3.0, 1.0, 15.4 + zo), vec3(1.25, 1.0, 1.9));
  lower = smin(smin(fore, past, 0.8), paw, 0.7);
  return smin(up, lower, 1.0);
}
float hindLeg(vec3 q) {
  float zo = q.x > 0.0 ? -1.2 : 0.0;
  vec3 m = vec3(abs(q.x), q.y, q.z);
  float thigh = sdEllipsoid(m - vec3(4.3, 26.0, -11.5 + zo * 0.3), vec3(3.5, 7.2, 6.4));
  float gas = sdCone(m, vec3(4.1, 21.0, -9.0 + zo * 0.5), vec3(3.6, 9.4, -16.8 + zo), 2.3, 1.0);
  float meta = sdCone(m, vec3(3.6, 9.4, -16.8 + zo), vec3(3.3, 1.9, -15.0 + zo), 0.95, 0.85);
  float paw = sdEllipsoid(m - vec3(3.3, 0.95, -14.2 + zo), vec3(1.2, 0.95, 1.8));
  return smin(smin(smin(thigh, gas, 1.6), meta, 0.6), paw, 0.6);
}

// The brush: a chain of tapered pieces, hanging and curling round to the front.
const vec4 TL[7] = vec4[7](
  vec4(0.0, 33.0, -19.5, 2.6), vec4(0.4, 29.0, -25.0, 3.8), vec4(1.8, 23.5, -29.0, 4.9),
  vec4(4.2, 17.0, -30.6, 5.3), vec4(7.4, 11.0, -29.2, 5.0), vec4(10.4, 6.9, -25.2, 3.9),
  vec4(12.2, 5.2, -20.6, 0.9));
float tail(vec3 q, out float tp, out vec3 dir) {
  float best = 1e9; tp = 0.0; dir = vec3(0.0, -1.0, 0.0);
  for (int i = 0; i < 6; i++) {
    vec3 a = TL[i].xyz, b = TL[i + 1].xyz;
    vec3 pa = q - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    float d = length(pa - ba * h) - mix(TL[i].w, TL[i + 1].w, h);
    if (d < best) { tp = (float(i) + h) / 6.0; dir = normalize(ba); }
    best = smin(best, d, 1.2);
  }
  return best;
}

/* The head, in its own (turned) frame. */
const vec3 EYE = vec3(2.05, 42.35, 30.95);
vec3 eyeGaze() { return normalize(vec3(0.42, 0.02, 1.0)); }
float socket(vec3 h) {
  vec3 m = vec3(abs(h.x), h.y, h.z) - EYE;
  vec3 g = eyeGaze();
  vec3 u = normalize(cross(vec3(0.0, 1.0, 0.0), g)), v = cross(g, u);
  vec3 l = vec3(dot(m, u), dot(m, v), dot(m, g));
  // An almond, slanting up at the outer corner, the upper lid a little lowered.
  l.xy = rot(-0.26) * l.xy;
  l.y += 0.06 + 0.10 * l.x;
  return sdEllipsoid(l - vec3(0.0, 0.0, 0.32), vec3(0.82, 0.40, 0.55));
}
float headShape(vec3 h) {
  vec3 m = vec3(abs(h.x), h.y, h.z);
  float cran = sdEllipsoid(h - vec3(0.0, 42.3, 26.8), vec3(4.4, 4.1, 5.0));
  float cheek = sdEllipsoid(m - vec3(3.3, 40.3, 25.6), vec3(3.0, 3.1, 4.2));
  float muz = sdCone(h, vec3(0.0, 41.5, 29.5), vec3(0.0, 40.25, 37.5), 2.55, 1.05);
  float jaw = sdCone(h, vec3(0.0, 39.5, 29.0), vec3(0.0, 39.55, 36.5), 1.95, 0.8);
  float d = smin(cran, cheek, 1.6);
  d = smin(d, muz, 1.6);
  d = smin(d, jaw, 0.7);
  // The mouth: a shallow crease along each side, turning up at the corner.
  float ym = 39.78 + 0.25 * smoothstep(31.6, 30.2, h.z);
  d += 0.07 * smoothstep(0.13, 0.0, abs(h.y - ym)) * smoothstep(29.8, 30.6, h.z) * smoothstep(37.8, 37.2, h.z);
  d = smax(d, -socket(h), 0.14);
  return d;
}
float noseShape(vec3 h) {
  vec3 m = vec3(abs(h.x), h.y, h.z);
  float n = sdEllipsoid(h - vec3(0.0, 40.4, 37.75), vec3(0.8, 0.62, 0.62));
  float nostril = sdEllipsoid(m - vec3(0.38, 40.32, 38.32), vec3(0.2, 0.13, 0.2));
  return smax(n, -nostril, 0.05);
}
float eyes(vec3 h) { return length(vec3(abs(h.x), h.y, h.z) - EYE) - 0.62; }

/* An ear: half a flattened cone, its hollow turned forwards. */
float ear(vec3 h, out vec3 el) {
  vec3 m = vec3(abs(h.x), h.y, h.z);
  vec3 base = vec3(2.8, 45.3, 25.9), tip = vec3(4.3, 53.0, 25.0);
  vec3 A = normalize(tip - base);
  vec3 C = normalize(vec3(0.42, 0.0, 1.0)); C = normalize(C - A * dot(C, A));
  vec3 B = cross(A, C);
  vec3 r = m - base;
  vec3 e = vec3(dot(r, B), dot(r, A), dot(r, C));
  float L = length(tip - base);
  float a = clamp(e.y / L, 0.0, 1.0);
  float hw = 2.55 * pow(1.0 - a, 0.85) + 0.1;
  float ry = hw * 0.55;
  float k = length(vec2(e.x / hw, (e.z + ry * 0.2) / ry));
  float cone = (k - 1.0) * ry;
  float sh = abs(cone) - mix(0.32, 0.16, a);
  sh = max(sh, e.z - ry * 0.35);
  sh = smax(sh, -e.y - 0.6, 0.3);
  sh = max(sh, e.y - L);
  el = vec3(e.x / hw, a, e.z);
  return sh * 0.8;
}

/* Fur: noise combed along the lie, tufts and then strands. 0..1. */
float furField(vec3 q, vec3 f, float near) {
  vec3 a = normalize(cross(f, abs(f.y) > 0.9 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0)));
  vec3 b = cross(f, a);
  vec3 P = vec3(dot(q, a), dot(q, b), dot(q, f));
  float t = noise(P * vec3(0.75, 0.75, 0.22));
  float s = 0.0;
  if (near > 0.0) s = noise(P * vec3(3.4, 3.4, 0.45) + 7.0) * 0.6 + noise(P * vec3(7.5, 7.5, 0.8) + 3.0) * 0.4;
  return 0.55 * t + 0.45 * mix(0.5, s, near);
}
float furred(float d, vec3 q, vec3 f, float amp) {
  if (d > amp + 0.8) return d - amp;
  float near = smoothstep(amp + 0.6, 0.0, d);
  return d - amp * furField(q, f, near);
}

/* ---- the waistcoat ----------------------------------------------------- */

float clothForm(vec3 q) {
  float chest = sdEllipsoid(q - vec3(0.0, 28.8, 13.0), vec3(6.0, 9.2, 9.8));
  float mid = sdEllipsoid(q - vec3(0.0, 30.0, 0.5), vec3(5.6, 7.0, 11.5));
  return smin(chest, mid, 4.5);
}
/* < 0 where the waistcoat is: behind the collar, before the hem, outside the
   armholes and the V. */
float clothClip(vec3 q) {
  float hem = (-3.4 - 0.15 * (q.y - 28.0)) - q.z;
  vec3 nA = normalize(vec3(0.0, 7.0, 7.5));
  float collar = dot(q - vec3(0.0, 30.5, 15.0), nA) - 1.6;
  float vh = max(0.0, (q.y - 23.6) * 0.55);
  float vee = -max(abs(q.x) - vh, 16.0 - q.z);
  float zo = q.x > 0.0 ? 1.6 : 0.0;
  float arm = -sdCone(vec3(abs(q.x), q.y, q.z), vec3(4.2, 31.0, 15.0 + zo * 0.3), vec3(3.8, 16.0, 12.0 + zo * 0.7), 3.7, 3.0);
  return max(max(hem, collar), max(vee, arm));
}
const float BTN_Y[4] = float[4](22.7, 21.25, 19.9, 18.7);
float buttonAt(vec3 q, out float rB) {
  rB = 9.0;
  if (q.z < 14.0) return 0.0;
  for (int i = 0; i < 4; i++) rB = min(rB, length(vec2(q.x + 0.05, q.y - BTN_Y[i])));
  return rB;
}
float waistcoat(vec3 q, float clip) {
  float f = clothForm(q);
  float d = max(f - 0.95, -(f - 0.45));
  // Soft folds round the ribs, the edges turned and a little thicker.
  d -= 0.07 * (fbm(q * vec3(0.22, 0.7, 0.3)) - 0.5);
  d -= 0.05 * smoothstep(-0.7, -0.15, clip);
  // The left front laps over the right down the chest.
  if (q.z > 14.0) d -= 0.06 * smoothstep(0.08, -0.08, q.x - 0.62) * smoothstep(23.8, 23.2, q.y);
  // Buttons: small domes.
  float rB; buttonAt(q, rB);
  d -= 0.2 * sqrt(max(0.0, 1.0 - (rB / 0.42) * (rB / 0.42)));
  // A welted pocket on the near flank.
  vec2 pk = vec2(q.y - 25.2 + 0.12 * (q.z - 5.0), q.z - 5.0);
  if (q.x > 0.0) d -= 0.07 * smoothstep(0.05, -0.05, max(abs(pk.x) - 0.32, abs(pk.y) - 2.2));
  return smax(d, clip, 0.12);
}

/* ---- everything -------------------------------------------------------- */

vec2 map(vec3 p) {
  vec2 r = vec2(plinth(p), 21.0);
  vec3 q = p - vec3(0.0, PH, 0.0);
  float bb = sdBox(q - vec3(4.0, 28.0, 4.0), vec3(13.0, 28.5, 37.0));
  if (bb > 1.0) return U(r, vec2(bb, 0.0));

  // Torso, neck and legs, each worked out only near its own box.
  float bT = sdBox(q - vec3(0.0, 30.5, 4.0), vec3(8.0, 12.0, 25.0));
  float bF = sdBox(q - vec3(0.0, 13.0, 14.5), vec3(6.5, 13.0, 5.0));
  float bH = sdBox(q - vec3(0.0, 16.5, -12.5), vec3(8.0, 16.5, 8.0));
  float clip = 9.0, press = 0.0;
  float d = min(bT, min(bF, bH));
  float id = 10.0;
  if (d < 2.0) {
    clip = clothClip(q);
    press = smoothstep(0.6, -0.4, clip);
    float body = bT < 2.0 ? smin(torso(q), neck(q), 3.0) : bT;
    float lowerFore;
    float fl = bF < 2.0 ? foreLeg(q, lowerFore) : bF;
    float hl = bH < 2.0 ? hindLeg(q) : bH;
    float side = sign(q.x);
    vec3 flowB = normalize(vec3(side * 0.2, -0.5 - 0.5 * smoothstep(30.0, 22.0, q.y), -1.0));
    body = furred(body, q, flowB, mix(0.55, 0.05, press));
    float legs = furred(min(fl, hl), q, normalize(vec3(0.0, -1.0, 0.12)), mix(0.16, 0.05, press));
    d = smin(body, legs, 1.2);
  }

  // Head, ears, nose and eyes, in the head's frame.
  vec3 h = headSpace(q);
  float bHd = sdBox(h - vec3(0.0, 44.5, 29.0), vec3(7.5, 10.0, 10.5));
  if (bHd < 2.0) {
    float hd = headShape(h);
    vec3 flowH = normalize(vec3(sign(h.x) * 0.45 * smoothstep(29.0, 25.0, h.z), 0.1, -1.0));
    hd = furred(hd, h, flowH, 0.2);
    vec3 el;
    float er = ear(h, el);
    er = furred(er, h, vec3(0.0, 1.0, 0.0), 0.05);
    hd = smin(hd, er, 0.5);
    if (hd < d - 0.5) id = 11.0;
    else if (hd < d + 0.5 && h.z > 24.0) id = 11.0;
    d = smin(d, hd, 1.6);
    if (er < d + 0.02) id = 14.0;
    r = U(r, vec2(noseShape(h), 16.0));
    r = U(r, vec2(eyes(h), 15.0));
  } else d = min(d, bHd);

  // The brush.
  float bTl = sdBox(q - vec3(6.0, 19.0, -25.0), vec3(12.5, 16.0, 11.5));
  if (bTl < 2.0) {
    float tp; vec3 tdir;
    float tl = tail(q, tp, tdir);
    float moth = smoothstep(2.2, 0.6, length(vec2((tp - 0.42) * 26.0, q.y - 21.0 + (q.x - 6.0) * 0.6)));
    tl = furred(tl, q, tdir, mix(1.0, 0.25, moth));
    if (tl < d) id = 12.0;
    d = smin(d, tl, 1.0);
  } else d = min(d, bTl);
  r = U(r, vec2(d, id));

  if (clip < 1.0) r = U(r, vec2(waistcoat(q, clip), 20.0));
  return r;
}

/* ---- materials --------------------------------------------------------- */

float seg2(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)); }

/* The fox's colours, laid out the way a red fox's are; the hairs streak
   each colour, darker at the root and paler at the tip. */
vec3 furColour(float id, vec3 q, vec3 h, float st) {
  vec3 rufous = hex(0x96522b), deep = hex(0x6f3419), flank = hex(0xaa784f);
  vec3 cream = hex(0xddd6c8), black = hex(0x1b1613), grey = hex(0x8e8478);
  vec3 c = vec3(0.0);
  if (id == 11.0) {
    c = mix(rufous, flank, 0.35);
    // Grizzled forehead.
    c = mix(c, grey, 0.25 * smoothstep(0.55, 0.8, st) * smoothstep(41.0, 45.0, h.y));
    // White lips, chin and lower cheeks.
    float wl = 39.95 + 0.17 * clamp(37.6 - h.z, 0.0, 9.0) + 0.25 * smoothstep(29.0, 26.0, h.z);
    float white = smoothstep(0.35, -0.35, h.y - wl + 0.3 * (st - 0.5));
    c = mix(c, cream, white);
    // A black lip line, and the dark tear streak from the eye.
    float ym = 39.78 + 0.25 * smoothstep(31.6, 30.2, h.z);
    float lip = smoothstep(0.16, 0.06, abs(h.y - ym)) * step(30.0, h.z) * step(0.5, abs(h.x));
    c = mix(c, black, lip);
    float tear = seg2(vec2(h.y, h.z), vec2(42.0, 31.5), vec2(40.55, 34.2));
    c = mix(c, hex(0x2e1d14), smoothstep(0.42, 0.15, tear) * step(1.0, abs(h.x)) * 0.85);
    // Dark rims round the eyes.
    c = mix(c, black, smoothstep(0.22, 0.04, socket(h)));
    return c;
  }
  // Body, neck and legs.
  float dors = smoothstep(27.0, 35.5, q.y);
  c = mix(flank, rufous, 0.4 + 0.6 * dors);
  c = mix(c, deep, 0.35 * dors * smoothstep(0.3, 0.8, st));
  // Grizzle over the hips.
  c = mix(c, grey, 0.3 * smoothstep(-6.0, -14.0, q.z) * dors * smoothstep(0.55, 0.85, st));
  // The white bib down the throat and chest.
  float ya = 30.5 + (q.z - 15.0) * (6.8 / 7.6);
  float bib = smoothstep(0.9, -0.9, q.y - ya + 1.2 + 1.5 * (st - 0.5)) * smoothstep(11.0, 15.0, q.z);
  c = mix(c, cream, bib);
  // Black stockings: forelegs from above the knee, hind legs from the hock.
  float fore = smoothstep(18.5, 14.0, q.y + 1.5 * (st - 0.5)) * step(4.0, q.z);
  float hind = smoothstep(12.5, 8.5, q.y + 1.5 * (st - 0.5)) * step(q.z, 4.0);
  c = mix(c, black, max(fore, hind));
  return c;
}

/* The tweed: a slate-green ground, a darker check and a fine pale overcheck,
   flecked as tweed is, woven in a twill. */
vec3 tweed(vec3 q, vec3 n) {
  vec3 w = abs(n); w = w / (w.x + w.y + w.z);
  vec3 col = vec3(0.0);
  for (int k = 0; k < 3; k++) {
    vec2 uv = k == 0 ? q.yz : (k == 1 ? q.xz : q.xy);
    float wt = k == 0 ? w.x : (k == 1 ? w.y : w.z);
    vec2 cell = fract(uv / 1.6);
    float chk = 0.5 * (smoothstep(0.12, 0.08, abs(cell.x - 0.25)) + smoothstep(0.12, 0.08, abs(cell.y - 0.25)));
    float over = max(smoothstep(0.022, 0.0, abs(cell.x - 0.75)), smoothstep(0.022, 0.0, abs(cell.y - 0.75)));
    float twill = 0.5 + 0.5 * sin((uv.x + uv.y) * 55.0);
    vec3 c = hex(0x45534b);
    c = mix(c, hex(0x2b3530), chk * 0.7);
    c = mix(c, hex(0x8d9b98), over * 0.75);
    c *= 0.88 + 0.16 * twill;
    float fl = hash21(floor(uv * 26.0));
    c = mix(c, fl > 0.94 ? hex(0x9aa3a8) : (fl < 0.05 ? hex(0x1d2421) : c), 0.6);
    col += c * wt;
  }
  return col;
}

Mat material(float id, vec3 p, vec3 n) {
  vec3 q = p - vec3(0.0, PH, 0.0);
  vec3 h = headSpace(q);
  if (id == 21.0) {
    // Ebonised wood: black stain over a close grain that still shows, rubbed
    // through to the wood on the moulding's high edges.
    float g = fbm(vec3(p.x * 0.6, p.y * 3.0, p.z * 0.08) * 2.0);
    float lines = 0.5 + 0.5 * sin(p.x * 9.0 + g * 9.0);
    vec3 c = mix(hex(0x0d0c0c), hex(0x1d1916), lines * 0.5 + 0.2 * g);
    float rubbed = smoothstep(0.7, 0.95, fbm(p * 1.5)) * smoothstep(0.75, 0.3, abs(n.y)) * smoothstep(0.1, 0.5, abs(n.y));
    c = mix(c, hex(0x3b2a1e), rubbed * 0.6);
    return mat(c, 0.42 + 0.1 * g, 0.0);
  }
  if (id == 20.0) {
    float rB; buttonAt(q, rB);
    if (rB < 0.45) {
      // Dark horn buttons, four holes each.
      vec2 bq = vec2(q.x + 0.05, q.y);
      float hole = 0.0;
      for (int i = 0; i < 4; i++) {
        vec2 c = vec2(q.x + 0.05, q.y - BTN_Y[i]);
        if (length(c) < 0.45) hole = smoothstep(0.075, 0.05, length(abs(c) - vec2(0.1)));
      }
      vec3 hc = mix(hex(0x2a2522), hex(0x4a423b), fbm(p * 12.0));
      return mat(mix(hc, vec3(0.01), hole), 0.3, 0.0);
    }
    vec3 c = tweed(q, n);
    // A dark seam round the pocket welt and along the edges.
    vec2 pk = vec2(q.y - 25.2 + 0.12 * (q.z - 5.0), q.z - 5.0);
    float welt = abs(max(abs(pk.x) - 0.32, abs(pk.y) - 2.2));
    c *= q.x > 0.0 ? mix(0.6, 1.0, smoothstep(0.0, 0.06, welt)) : 1.0;
    return mat(c, 0.85, 0.0);
  }
  if (id == 15.0) {
    // Glass eyes: amber, darker at the rim and streaked, with an upright pupil.
    vec3 m = vec3(abs(h.x), h.y, h.z) - EYE;
    vec3 g = eyeGaze();
    vec3 u = normalize(cross(vec3(0.0, 1.0, 0.0), g)), v = cross(g, u);
    vec2 e = vec2(dot(m, u), dot(m, v)) / 0.62;
    float rr = length(e), ang = atan(e.y, e.x);
    vec3 iris = mix(hex(0xc98a1e), hex(0x8a4f12), smoothstep(0.25, 0.85, rr));
    iris *= 0.8 + 0.3 * noise(vec2(ang * 9.0, rr * 3.0));
    iris = mix(iris, hex(0x2a1708), smoothstep(0.78, 0.95, rr));
    float pupil = length(e * vec2(2.6, 1.0));
    iris = mix(iris, vec3(0.006), smoothstep(0.42, 0.36, pupil));
    return mat(iris, 0.08, 0.0);
  }
  if (id == 16.0) {
    // The nose: black leather, finely pebbled.
    vec3 vo = voronoi(h * 9.0);
    return mat(mix(hex(0x141110), hex(0x2a2522), smoothstep(0.0, 0.3, vo.y - vo.x)), 0.42, 0.0);
  }
  // Fur.
  vec3 f = id == 11.0 ? normalize(vec3(sign(h.x) * 0.45, 0.1, -1.0)) : normalize(vec3(sign(q.x) * 0.2, -0.8, -1.0));
  float st = furField(id == 11.0 || id == 14.0 ? h : q, f, 1.0);
  vec3 c;
  float sheenTip = 0.0;
  if (id == 14.0) {
    vec3 el; ear(h, el);
    // Black backs, a russet base, cream hairs in the hollow.
    float front = smoothstep(-0.1, 0.15, el.z + 0.2 * (1.0 - abs(el.x)));
    c = mix(hex(0x1b1512), hex(0x8f4a23), smoothstep(0.35, 0.05, el.y));
    vec3 inner = mix(hex(0x7a4022), hex(0xd8cfbf), smoothstep(0.85, 0.35, abs(el.x)) * smoothstep(0.85, 0.25, el.y));
    c = mix(c, inner, front * smoothstep(0.98, 0.7, el.y));
  } else if (id == 12.0) {
    float tp; vec3 td; tail(q, tp, td);
    st = furField(q, td, 1.0);
    c = mix(hex(0x8e5130), hex(0x60341d), smoothstep(0.4, 0.75, st));
    c = mix(c, hex(0x191412), 0.55 * smoothstep(0.62, 0.85, st));
    // A dark spot over the gland near the root.
    c = mix(c, hex(0x2a1a12), smoothstep(0.12, 0.04, tp) * 0.6);
    // The white tip.
    c = mix(c, hex(0xe4ddd0), smoothstep(0.84, 0.9, tp + 0.04 * (st - 0.5)));
    // Moth: thinned to the pale underfur, a little skin showing.
    float moth = smoothstep(2.2, 0.6, length(vec2((tp - 0.42) * 26.0, q.y - 21.0 + (q.x - 6.0) * 0.6)));
    c = mix(c, mix(hex(0x9b8a76), hex(0xb9a896), step(0.7, st)), moth * 0.75);
  } else {
    c = furColour(id, q, h, st);
  }
  c *= 0.72 + 0.5 * st;
  return mat(c, 0.62, 0.0);
}
