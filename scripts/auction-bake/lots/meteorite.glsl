/* Lot: a meteorite fragment, or possibly slag.
 *
 * An iron meteorite (or something that would like to be one): a dark lump
 * dished all over with regmaglypts, the thumbprint hollows that melting in
 * the air leaves, under a thin brown-black fusion crust that has rusted in
 * patches. One end has been sawn off, polished and etched, and shows a
 * Widmanstatten pattern: long crossing plates of kamacite in three
 * directions, each set catching the light differently, edged with bright
 * taenite and filled between with dark plessite. A few gas holes argue for
 * slag. A blue horseshoe magnet clings to its flank, and in front lies the
 * certificate, filled in by hand and signed with great confidence. Units:
 * the stone is about 1 long (12 cm).
 */
#define BOUND vec3(0.94, 0.30, 0.56)
#define CENTRE vec3(-0.04, 0.28, 0.10)
#define VIEW_YAW 0.32
#define VIEW_PITCH 0.52
#define FILL 0.86
#define STEP 0.65
#define COAT(id) ((id) == 4.0 ? 0.5 : 0.0)

const vec3 ROCK = vec3(0.16, 0.0, -0.06);
const vec3 CARD = vec3(-0.52, 0.0, 0.36);
const vec2 CH = vec2(0.40, 0.275);
const float CYAW = 0.30;
const vec3 MAG = vec3(0.70, 0.24, 0.04);

/* The camera's direction, and the cut: sawn so the polished face looks back
   at the camera and a little towards the softbox, as a dealer would show it. */
vec3 camBack() { return vec3(sin(VIEW_YAW) * cos(VIEW_PITCH), sin(VIEW_PITCH), cos(VIEW_YAW) * cos(VIEW_PITCH)); }
vec3 cutNormal() {
  vec3 bk = camBack(), f = -bk, r = normalize(cross(f, vec3(0.0, 1.0, 0.0))), u = cross(r, f);
  vec3 key = normalize(vec3(-0.62, 0.66, 0.42));
  vec3 kw = key.x * r + key.y * u + key.z * bk;
  // Mostly towards the camera's left, so it is the end of the stone that
  // was sawn off, turned up a little to the light.
  return normalize(normalize(vec3(-0.80, 0.0, 0.42)) + 0.45 * normalize(kw + bk));
}

/* The stone before it was sawn. */
float lump(vec3 c, out float cup) {
  float d = sdEllipsoid(c, vec3(0.48, 0.28, 0.34));
  d += 0.13 * (fbm(c * 1.6 + 3.1) - 0.5) + 0.015 * (fbm(c * 4.2 + 8.0) - 0.5);
  // Broken faces from when it came apart, worn round since.
  d = smax(d, dot(c, normalize(vec3(0.5, 0.75, -0.45))) - 0.22, 0.06);
  d = smax(d, dot(c, normalize(vec3(0.85, 0.2, 0.5))) - 0.36, 0.06);
  // Regmaglypts: shallow dishes with sharp rims between them.
  vec3 v = voronoi(c * 4.6 + 1.7);
  cup = smoothstep(0.0, 0.6, v.y - v.x);
  d += 0.05 * cup;
  return d;
}

float rock(vec3 p, out float cut) {
  vec3 c = p - ROCK - vec3(0.0, 0.26, 0.0);
  float bound = sdEllipsoid(c, vec3(0.6, 0.37, 0.45));
  cut = 0.0;
  if (bound > 0.04) return bound;
  float cup;
  float d = lump(c, cup);
  // Flat where it sits.
  d = smax(d, -(p.y), 0.02);
  // The sawn face.
  vec3 nc = cutNormal();
  float fc = dot(c, nc) - 0.27;
  if (fc > d) { d = fc; cut = 1.0; }
  // Gas holes: a few, scattered, some on the cut too.
  vec3 g = voronoi(c * 11.0 + 4.4);
  if (g.z < 0.16) {
    float pit = g.x / 11.0 - (0.010 + 0.012 * fract(g.z * 37.0));
    if (-pit > d) { d = -pit; }
  }
  return d;
}

/* ---- the magnet --------------------------------------------------------- */

vec3 magFrame(vec3 p) {
  vec3 m = p - MAG;
  m.xz = rot(-0.38) * m.xz;
  m.xy = rot(0.22) * m.xy;
  return m;
}
float magnet(vec3 m, out float pole) {
  const float R = 0.062, L = 0.15;
  vec2 hs = vec2(0.021, 0.028);
  // The bow, a half ring opening towards the stone (-x), and the two legs.
  vec2 rq = vec2(length(m.xy) - R, m.z);
  float bow = max(length(max(abs(rq) - hs + 0.006, 0.0)) - 0.006, -m.x);
  vec3 lq = vec3(m.x + L * 0.5, abs(m.y) - R, m.z);
  float legs = sdRound(lq, vec3(L * 0.5, hs.x, hs.y), 0.006);
  float body = min(bow, legs);
  pole = step(m.x, -L + 0.035);
  return body;
}

/* ---- the certificate ---------------------------------------------------- */

vec3 cardFrame(vec3 p) {
  vec3 q = p - CARD;
  q.xz = rot(CYAW) * q.xz;
  return q;
}
float card(vec3 q) {
  // Thick card, bowed a little along its length.
  float bow = 0.012 * (1.0 - (q.x / CH.x) * (q.x / CH.x));
  return sdRound(q - vec3(0.0, 0.0045 + bow, 0.0), vec3(CH.x, 0.0045, CH.y), 0.002);
}

vec2 map(vec3 p) {
  float cut;
  float r = rock(p, cut);
  vec2 res = vec2(r, cut > 0.5 ? 2.0 : 1.0);
  float pole;
  vec3 m = magFrame(p);
  float mb = length(m) - 0.26;
  if (mb < 0.02) {
    float mg = magnet(m, pole);
    res = U(res, vec2(mg, pole > 0.5 ? 5.0 : 4.0));
  } else res = U(res, vec2(mb, 4.0));
  vec3 q = cardFrame(p);
  float cb = max(length(max(abs(q.xz) - CH, 0.0)), q.y - 0.03);
  res = U(res, vec2(cb > 0.02 ? cb : card(q), 3.0));
  return res;
}

/* ---- the etched face ----------------------------------------------------- */

/* One family of kamacite plates: parallel, of uneven width and spacing, each
   a few centimetres long. Returns (inside, priority, distance to its edge). */
vec3 plates(vec2 q, float ang, float fam) {
  vec2 d = vec2(cos(ang), sin(ang));
  float a = dot(q, d), b = dot(q, vec2(-d.y, d.x));
  const float S = 0.023;
  float j = floor(b / S);
  float hj = hash11(j * 1.37 + fam * 17.0);
  float c = (j + 0.5 + 0.35 * (hj - 0.5)) * S;
  float hw = S * (0.36 + 0.14 * hash11(j * 2.9 + fam * 5.0));
  // Along the plate: broken into lengths, most of them present.
  const float L = 0.34;
  float k = floor(a / L + hj * 3.0);
  float on = step(0.25, hash11(k * 3.1 + j * 7.7 + fam * 13.0));
  float e = hw - abs(b - c);
  return vec3(on * step(0.0, e), hash11(k * 1.9 + j * 4.3 + fam), e);
}

/* Returns the face's look: x = which phase (0 plessite, 1-3 kamacite of
   each family, 4 taenite), y = a fine texture, z = Neumann lines. */
vec3 widman(vec2 q) {
  // The section is not quite symmetric: the three directions are a few
  // degrees off sixty.
  float best = -1.0, fam = 0.0, edge = 1.0;
  vec3 a = plates(q, 0.32, 1.0);
  vec3 b = plates(q, 0.32 + 1.02, 2.0);
  vec3 c = plates(q, 0.32 + 2.11, 3.0);
  if (a.x > 0.5 && a.y > best) { best = a.y; fam = 1.0; edge = a.z; }
  if (b.x > 0.5 && b.y > best) { best = b.y; fam = 2.0; edge = b.z; }
  if (c.x > 0.5 && c.y > best) { best = c.y; fam = 3.0; edge = c.z; }
  // Taenite: a bright skin round every plate.
  float tae = fam > 0.5 ? smoothstep(0.0018, 0.0006, edge) : 0.0;
  float tex = noise(q * 900.0);
  // Neumann lines: fine straight twins across the kamacite.
  float nl = fam > 0.5 ? smoothstep(0.82, 0.97, sin(dot(q, vec2(cos(fam * 2.1), sin(fam * 2.1))) * 900.0) * 0.5 + 0.5) * step(0.5, hash11(floor(dot(q, vec2(cos(fam * 2.1), sin(fam * 2.1))) * 140.0))) : 0.0;
  return vec3(tae > 0.5 ? 4.0 : fam, tex, nl);
}

Mat material(float id, vec3 p, vec3 n) {
  vec3 c = p - ROCK - vec3(0.0, 0.26, 0.0);
  if (id == 1.0) {
    float cup;
    lump(c, cup);
    // Fusion crust: brown-black, a fine orange-peel texture.
    float fine = noise(c * 260.0);
    vec3 col = mix(hex(0x1a1816), hex(0x2a2522), fine);
    float rough = 0.72 + 0.18 * fine;
    float metal = 0.0;
    // Rust, gathered in the hollows and in patches.
    float rp = fbm(c * 4.5 + 9.0);
    float rust = smoothstep(0.56, 0.78, rp + 0.2 * cup);
    float rust2 = smoothstep(0.62, 0.8, fbm(c * 14.0 + 2.0)) * smoothstep(0.4, 0.6, rp);
    col = mix(col, mix(hex(0x271c15), hex(0x3d281b), noise(c * 90.0)), rust * 0.75);
    col = mix(col, hex(0x55361f), rust2 * 0.35);
    rough = mix(rough, 0.9, rust);
    // Bare metal on the rims, where it has been handled and the crust is gone.
    float rim = smoothstep(0.2, 0.04, cup) * smoothstep(0.55, 0.72, fbm(c * 7.0 + 1.0));
    col = mix(col, hex(0x5d5954), rim * 0.8);
    metal = rim * 0.8;
    rough = mix(rough, 0.38, rim);
    return mat(col, rough, metal);
  }
  if (id == 2.0) {
    vec3 nc = cutNormal();
    vec3 t1 = normalize(cross(nc, vec3(0.0, 1.0, 0.0))), t2 = cross(nc, t1);
    vec2 q = vec2(dot(c, t1), dot(c, t2));
    vec3 w = widman(q * 1.6);
    // Etched iron: each set of plates its own grey and its own sheen.
    vec3 col; float rough;
    // Etching leaves it frosted rather than mirror-bright: mostly a matte
    // grey whose shade depends on how each crystal was cut across.
    float metal = 0.35;
    if (w.x < 0.5) { col = hex(0x3a3835) * (0.85 + 0.3 * w.y); rough = 0.62; }
    else if (w.x < 1.5) { col = hex(0x5e5b57); rough = 0.42; }
    else if (w.x < 2.5) { col = hex(0x4c4a46); rough = 0.5; }
    else if (w.x < 3.5) { col = hex(0x56534f); rough = 0.38; }
    else { col = hex(0x8a8781); rough = 0.25; metal = 0.65; }
    col *= 0.92 + 0.12 * w.y;
    col *= 1.0 - 0.25 * w.z;
    // Rust creeping in from the rim, and a stain or two.
    float cup;
    float dn = lump(c, cup);
    float edge = smoothstep(-0.012, 0.0, dn) * (0.6 + 0.4 * noise(q * 60.0));
    float stain = smoothstep(0.66, 0.8, fbm(vec3(q * 12.0, 3.0)));
    float rust = clamp(edge * 0.9 + stain * 0.5, 0.0, 1.0);
    col = mix(col, mix(hex(0x2a1c14), hex(0x4f3220), noise(q * 120.0)), rust * 0.8);
    return mat(col, mix(rough, 0.8, rust), metal * (1.0 - rust));
  }
  if (id == 3.0) {
    vec3 q = cardFrame(p);
    vec3 col = hex(0xd3cec1) * (0.95 + 0.06 * noise(q.xz * 500.0));
    // Handled: a little grubby at the edges, one corner dog-eared.
    float edgeD = min(CH.x - abs(q.x), CH.y - abs(q.z));
    col *= mix(0.86, 1.0, smoothstep(0.0, 0.04, edgeD));
    if (n.y > 0.5) {
      vec2 uv = vec2((q.x + CH.x) / (2.0 * CH.x), 1.0 - (q.z + CH.y) / (2.0 * CH.y) * (1408.0 / 2048.0));
      vec3 t = texture(u_tex, uv).rgb;
      col = mix(col, hex(0x14171f), t.r * 0.95);
      col = mix(col, hex(0x14216a), t.g * 0.95);
    }
    return mat(col, 0.7, 0.0);
  }
  if (id == 4.0) {
    // Blue enamel paint, chipped on the edges of the bow.
    vec3 m = magFrame(p);
    float chip = smoothstep(0.72, 0.78, noise(m * 70.0)) * smoothstep(0.015, 0.025, abs(m.z) + 0.01 * noise(m * 30.0));
    vec3 col = mix(hex(0x1f2a4c), hex(0x5c5a57), chip);
    return mat(col, mix(0.3, 0.4, chip), chip);
  }
  // The pole pieces: bright nickel, worn.
  return mat(hex(0xb9b6b0), 0.22, 1.0);
}
