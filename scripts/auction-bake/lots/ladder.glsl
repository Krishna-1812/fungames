/* Lot: a library ladder from a library that burned down.
 *
 * A Victorian oak folding library step-ladder, standing open. Quarter-sawn
 * oak stiles with the medullary rays catching the light, five treads with
 * brass nosings, a moulded top platform, the stiles rising past it into
 * turned hand posts. Behind, a pair of chamfered back legs on two round
 * stretchers, hung from the top on brass butt hinges and held by folding
 * brass stays. Brass shoes on all four feet. From the fourth tread up the oak
 * browns, then blackens: the top tread, the platform and the posts are
 * charred to alligator char, the brass up there gone dark with heat.
 * Units: metres. It stands 1.9 m to the top of the posts.
 */
#define BOUND vec3(0.33, 0.97, 0.47)
#define CENTRE vec3(0.0, 0.97, -0.095)
#define VIEW_YAW 0.62
#define VIEW_PITCH 0.16
#define FILL 0.90
#define COAT(id) ((id) == 1.0 ? 0.35 : ((id) == 4.0 ? 0.12 : 0.0))

const vec2 FD = vec2(0.9640, -0.2659);   // up the front stiles, in (y, z)
const vec2 FN = vec2(0.2659, 0.9640);    // out of their front edge
const vec2 BD = vec2(0.9558, 0.2941);    // up the back legs
const vec2 BN = vec2(-0.2941, 0.9558);
const float TOP = 1.45;

float zFront(float y) { return 0.36 - 0.40 * y / 1.45; }
float zBack(float y) { return -0.55 + 0.44 * y / 1.43; }
float xFront(float y) { return 0.255 - 0.06 * y / 1.45; }
float xBack(float y) { return 0.24 - 0.06 * y / 1.43; }

/* How burnt a point is: 0 sound oak .. 1 charcoal. Ragged, and worse on
   the side nearer where the fire was. */
float charOf(vec3 p) {
  float n = noise(p * 9.0) * 0.6 + noise(p * 31.0) * 0.4;
  return smoothstep(1.10, 1.30, p.y + (n - 0.5) * 0.16 + p.x * 0.08);
}
float brownOf(vec3 p) {
  float n = noise(p * 7.0);
  return smoothstep(0.80, 1.14, p.y + (n - 0.5) * 0.14 + p.x * 0.06);
}

vec2 map(vec3 p) {
  float px = abs(p.x);
  vec2 yz = vec2(p.y, p.z - 0.36);
  // ---- the front stiles, splayed, rising into hand posts
  float s = dot(yz, FD), t = dot(yz, FN);
  float sx = px - xFront(p.y);
  float st = sdRound(vec3(sx, s - 0.77, t), vec3(0.017, 0.80, 0.043), 0.003);
  st = max(st, -p.y);
  // Above the platform the stile is turned round, with a ball finial.
  float sp = s - 1.53;
  if (sp > -0.05) {
    vec2 c = vec2(sx, t);
    float rr = 0.021 + 0.004 * exp(-pow((sp - 0.02) / 0.01, 2.0)) - 0.004 * smoothstep(0.1, 0.35, sp) + 0.003 * exp(-pow((sp - 0.36) / 0.01, 2.0));
    float post = max(length(c) - rr, abs(sp - 0.19) - 0.19);
    post = min(post, length(vec3(c, sp - 0.415)) - 0.028);
    post = min(post, max(length(c) - 0.016, abs(sp - 0.39) - 0.02));
    st = max(st, sp);
    st = min(st, post);
  }
  // ---- the treads, let into the stiles, each with a brass nosing
  float ti = clamp(floor(p.y / 0.24 + 0.5), 1.0, 5.0);
  float ty = ti * 0.24 + 0.01;
  float tz = zFront(ty);
  float tr = sdRound(vec3(p.x, p.y - ty, p.z - tz + 0.012), vec3(xFront(ty) - 0.006, 0.012, 0.072), 0.004);
  // ---- the top platform, moulded edge
  float pl = sdRound(p - vec3(0.0, TOP + 0.013, zFront(TOP) - 0.06), vec3(0.262, 0.013, 0.118), 0.006);
  pl = min(pl, sdRound(p - vec3(0.0, TOP - 0.004, zFront(TOP) - 0.06), vec3(0.248, 0.006, 0.106), 0.003));
  // ---- the back legs and their stretchers
  vec2 bq = vec2(p.y, p.z + 0.55);
  float bs = dot(bq, BD), bt = dot(bq, BN);
  float bl = sdRound(vec3(px - xBack(p.y), bs - 0.75, bt), vec3(0.021, 0.75, 0.021), 0.005);
  bl = max(bl, -p.y);
  bl = max(bl, p.y - (TOP - 0.025));
  float ry = p.y < 0.68 ? 0.40 : 0.95;
  float rung = max(length(vec2(p.y - ry, p.z - zBack(ry))) - 0.0135, px - xBack(ry));
  float oak = min(min(st, tr), min(min(pl, bl), rung));
  // The fire ate into the top: soft, ragged loss on the charred parts.
  // Where it is charred or browned the polish has gone too.
  float oid = 1.0;
  if (p.y > 0.75) {
    float ch = charOf(p);
    oak += ch * (0.0015 + 0.0035 * noise(p * 70.0));
    oid = ch > 0.5 ? 3.0 : (brownOf(p) > 0.6 ? 4.0 : 1.0);
  }
  vec2 r = vec2(oak, oid);

  // ---- brass: nosings, shoes, hinges, stays
  float br = 1e9;
  vec3 nq = vec3(p.x, p.y - ty, p.z - tz - 0.060);
  float nos = sdBox(nq - vec3(0.0, 0.0115, -0.012), vec3(xFront(ty) - 0.01, 0.0015, 0.014));
  nos = min(nos, sdBox(nq - vec3(0.0, 0.002, 0.0015), vec3(xFront(ty) - 0.01, 0.011, 0.0015)));
  br = min(br, nos - 0.0005);
  // Shoes on the four feet.
  float shb = sdBox(p - vec3(0.0, 0.035, -0.09), vec3(0.3, 0.035, 0.5));
  if (shb < 0.01) {
    float sh = sdRound(vec3(sx, p.y - 0.025, t), vec3(0.019, 0.025, 0.040), 0.003);
    sh = min(sh, sdRound(vec3(px - xBack(0.0), p.y - 0.025, bt), vec3(0.024, 0.025, 0.024), 0.004));
    br = min(br, sh);
  } else br = min(br, shb);
  // Butt hinges under the platform, front stiles to back legs.
  vec3 hq = vec3(px - 0.18, p.y - (TOP - 0.018), p.z + 0.140);
  float hg = sdCyl(hq.yxz, 0.0065, 0.032);
  hg = min(hg, sdBox(hq - vec3(0.0, -0.03, 0.0068), vec3(0.03, 0.03, 0.0015)));
  hg = min(hg, sdBox(hq - vec3(0.0, 0.009, -0.024), vec3(0.03, 0.0015, 0.024)));
  br = min(br, hg);
  // The folding stays, one each side, from the front stile to the back leg,
  // a knuckle in the middle.
  float sy = 0.66;
  vec3 a = vec3(0.198, sy, zFront(sy) - 0.01), b = vec3(0.198, sy + 0.01, zBack(sy) + 0.01);
  vec3 m = (a + b) * 0.5 + vec3(0.0, 0.035, 0.0);
  vec3 sq = vec3(px, p.y, p.z);
  float stay = min(sdCapsule(sq, a, m, 0.0055), sdCapsule(sq, m, b, 0.0055));
  stay = max(stay, abs(px - 0.198) - 0.003);
  stay = min(stay, sdCyl((sq - m).yxz, 0.008, 0.0055));
  stay = min(stay, min(sdCyl((sq - a).yxz, 0.008, 0.014), sdCyl((sq - b).yxz, 0.008, 0.014)));
  br = min(br, stay);
  // A collar where each post leaves the platform.
  float sc = s - 1.545;
  br = min(br, max(length(vec2(sx, t)) - 0.026, abs(sc) - 0.009));
  r = U(r, vec2(br, 2.0));
  return r;
}

/* ---- oak --------------------------------------------------------------- */

/* g.x along the grain, g.y across. Quarter-sawn faces show the rays as
   pale, satiny flakes across the grain; flat-sawn ones show arches. */
vec3 oak(vec2 g, float quarter, float seed) {
  g += seed * 5.1;
  vec2 w = vec2(fbm(vec2(g.x * 1.1, g.y * 6.0)), fbm(vec2(g.x * 1.6 + 2.0, g.y * 9.0)));
  float s;
  if (quarter > 0.5) s = g.y * 160.0 + w.x * 6.0;
  else s = length(vec2(g.y + (w.x - 0.5) * 0.03, 0.03 + 0.04 * (0.5 + 0.5 * sin(g.x * 1.6 + seed)))) * 90.0 + w.y * 1.5;
  float ring = fract(s);
  float late = smoothstep(0.55, 0.92, ring) * smoothstep(1.0, 0.95, ring);
  float pore = smoothstep(0.6, 0.85, noise(vec2(g.x * 40.0, g.y * 800.0))) * smoothstep(0.2, 0.5, ring) * smoothstep(0.7, 0.5, ring);
  vec3 c = mix(hex(0x63503d), hex(0x4a3a2a), 0.3 * w.y + 0.25 * noise(vec2(g.x * 2.0, g.y * 40.0)));
  c = mix(c, hex(0x3c2b1b), late * 0.45);
  c *= 0.88 + 0.24 * fbm(vec2(g.x * 0.7, g.y * 3.0) + seed);
  c *= 1.0 - 0.3 * pore;
  if (quarter > 0.5) {
    // Medullary rays: flakes across the grain, a centimetre or two along it.
    float f = noise(vec2(g.x * 55.0 + w.y * 8.0, g.y * 14.0 + w.x * 3.0));
    float fl = smoothstep(0.62, 0.72, f) * smoothstep(0.35, 0.6, noise(vec2(g.x * 9.0, g.y * 5.0)));
    c = mix(c, hex(0x958065), fl * 0.7);
  }
  return c;
}

/* Alligator char: blocks split across and along the grain, the cracks deep
   black, the tops a dull silvery black. */
vec3 charred(vec2 g, out float crack) {
  vec3 v = voronoi(vec2(g.x * 45.0, g.y * 70.0));
  vec3 v2 = voronoi(vec2(g.x * 140.0, g.y * 190.0));
  crack = max(smoothstep(0.10, 0.02, v.y - v.x), 0.5 * smoothstep(0.06, 0.01, v2.y - v2.x));
  vec3 c = mix(hex(0x1d1a17), hex(0x0f0d0c), v.z * 0.6 + noise(g * 300.0) * 0.4);
  c = mix(c, hex(0x2f2c29), smoothstep(0.65, 0.95, noise(g * 90.0 + 3.0)) * 0.6);
  return mix(c, vec3(0.002), crack);
}

Mat material(float id, vec3 p, vec3 n) {
  float px = abs(p.x);
  float ch = charOf(p), bn = brownOf(p);
  if (id == 2.0) {
    // Brass: aged below, heat-darkened to bronze and black above.
    float tarn = smoothstep(0.3, 0.75, fbm(p * 120.0));
    vec3 c = mix(hex(0xb48f54), hex(0x6a5030), 0.25 + tarn * 0.45);
    c = mix(c, hex(0x4a3226), bn * 0.6);
    c = mix(c, hex(0x1a1512), ch * 0.85);
    return mat(c, mix(0.3 + 0.18 * tarn, 0.6, ch), mix(0.85, 0.3, ch));
  }
  // Which way the grain runs, and whether this face is quarter-sawn.
  vec2 yz = vec2(p.y, p.z - 0.36);
  vec2 g; float quarter = 0.0, seed = 0.0;
  bool front = abs(dot(yz, FN)) < 0.045 && px > xFront(p.y) - 0.03 && p.y < TOP + 0.6;
  bool back = p.z < zBack(p.y) + 0.06 && px > xBack(p.y) - 0.035 && p.y < TOP - 0.02;
  if (front) {
    g = vec2(dot(yz, FD), dot(yz, FN));
    if (abs(n.x) > 0.7) quarter = 1.0;
    else g.y = p.x;
    seed = sign(p.x) * 2.0;
  } else if (back) {
    vec2 bq = vec2(p.y, p.z + 0.55);
    g = vec2(dot(bq, BD), dot(bq, BN) + p.x);
    quarter = abs(n.x) > 0.7 ? 1.0 : 0.0;
    seed = 4.0 + sign(p.x);
  } else if (abs(n.y) > 0.6) {
    g = vec2(p.x, p.z);
    seed = floor(p.y / 0.24 + 0.5) * 1.7 + 7.0;
  } else {
    g = vec2(p.x, p.y + p.z);
    seed = floor(p.y / 0.24 + 0.5) * 1.7 + 9.0;
  }
  vec3 c = oak(g, quarter, seed);
  // Handled and trodden: the tread tops worn paler in the middle.
  if (n.y > 0.6) c = mix(c, hex(0x8f7656), smoothstep(0.12, 0.0, px) * 0.25);
  // The fire: browned and scorched first, then charcoal, with soot above.
  c = mix(c, c * vec3(0.55, 0.45, 0.38), bn);
  float soot = smoothstep(0.25, 0.75, fbm(p * 14.0)) * bn;
  c = mix(c, hex(0x231c17), soot * 0.55);
  float crack;
  vec3 cc = charred(g, crack);
  c = mix(c, cc, ch);
  float rough = mix(0.42 + 0.1 * noise(p * 60.0), mix(0.55, 0.95, crack), ch);
  return mat(c, rough, 0.0);
}
