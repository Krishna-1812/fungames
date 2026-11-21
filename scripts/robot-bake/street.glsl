/* I'm Not a Robot: the street the image challenge shows you.
 *
 * A real challenge is a photograph, so this is a photograph's worth of
 * street, rendered: a four-lane road between sidewalks, a zebra crossing at
 * your feet, a mast-arm traffic signal reaching out over the road with its
 * red lit, five- to nine-storey blocks down both sides, parked cars, two
 * street trees and a lamp, all under an afternoon sun from behind your left
 * shoulder, with the sky's light filling the shadows and haze taking the far
 * end of the street. Units are metres; you stand at the kerb, 1.65 m up.
 *
 * With MASK defined it renders, instead of light, which pixels are the
 * signal head (red) and which its pole and arm (green). bake-robot.mjs turns
 * that into the answer key, so the squares you must tick are measured from
 * this picture rather than written down beside it.
 */

#define ID_ROAD 1.0
#define ID_WALK 2.0
#define ID_KERB 3.0
#define ID_BLD 4.0
#define ID_CAR 5.0
#define ID_GLASS 6.0
#define ID_TYRE 7.0
#define ID_TRUNK 8.0
#define ID_LEAF 9.0
#define ID_HEAD 10.0
#define ID_POLE 11.0
#define ID_LAMP 12.0

const vec3 SUN = normalize(vec3(-0.36, 0.84, -0.42));
const float ROAD = 7.0, WALK = 11.0;

float rrect(vec2 p, vec2 b, float r) { vec2 d = abs(p) - b + r; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r; }

/* ---- the buildings ------------------------------------------------------ */

/* One block per 15 m of street on each side, from 12 m ahead to the horizon. */
float blockH(float side, float k) { return 15.0 + 17.0 * hash21(vec2(k, side * 7.0)); }
float blockSet(float side, float k) { return 0.4 * hash21(vec2(k + 3.0, side)); }

float buildings(vec3 p, out float blockId) {
  float k = floor((p.z - 4.0) / 15.0);
  float d = 1e9;
  blockId = 0.0;
  // Both sides, always: a point on the road is shaded by the far side too.
  for (int sd = 0; sd < 2; sd++) {
  float side = sd == 0 ? -1.0 : 1.0;
  for (int j = -1; j <= 1; j++) {
    float kk = k + float(j);
    if (kk < -3.0 || kk > 16.0) continue;
    float h = blockH(side, kk);
    float zc = 4.0 + kk * 15.0 + 7.5;
    // Each block stands back a little more or less, and a narrow gap now and
    // then is an alley.
    float face = WALK + blockSet(side, kk);
    float gap = hash21(vec2(kk, side + 11.0)) < 0.3 ? 1.2 : 0.05;
    float px = p.x * side;
    vec3 q = vec3(px - (face + 20.0), p.y - h * 0.5, p.z - zc);
    float b = sdBox(q, vec3(20.0, h * 0.5, 7.5 - gap));
    // A cornice along the top and a band over the shopfronts.
    b = min(b, sdBox(q - vec3(-20.0, h * 0.5 - 0.3, 0.0), vec3(0.35, 0.25, 7.5 - gap)));
    b = min(b, sdBox(vec3(px - face + 0.15, p.y - 4.1, p.z - zc), vec3(0.2, 0.18, 7.5 - gap)));
    // Windows set into the wall: a grid of shallow recesses above the shops.
    vec2 cell = vec2(mod(p.z - zc + 1.5, 3.0) - 1.5, mod(p.y - 4.6, 3.3) - 1.65);
    float win = max(max(abs(cell.x) - 0.72, abs(cell.y) - 0.95), abs(px - face) - 0.18);
    win = max(win, 4.6 - p.y);
    win = max(win, p.y - (h - 1.2));
    win = max(win, abs(p.z - zc) - (7.5 - gap - 0.9));
    b = max(b, -win);
    // Shopfront glass, set back a little.
    float shop = max(max(abs(p.y - 1.9) - 1.6, abs(p.z - zc) - (7.5 - gap - 1.2)), abs(px - face) - 0.25);
    b = max(b, -shop);
    if (b < d) { d = b; blockId = kk + side * 40.0; }
  }
  }
  return d;
}

/* ---- a parked car --------------------------------------------------------- */

float car(vec3 p, out float part) {
  // Local frame: x across, z along, standing on y = 0, 4.5 m long.
  float body = rrect(vec2(abs(p.x), p.y - 0.62).yx * vec2(1.0, 1.0), vec2(0.88, 0.32), 0.14);
  body = smax(rrect(vec2(p.x, p.y - 0.62), vec2(0.88, 0.32), 0.16), abs(p.z) - 2.25, 0.25);
  float cabin = smax(rrect(vec2(p.x, p.y - 1.13), vec2(0.78, 0.26), 0.2), abs(p.z + 0.15 - 0.25 * smoothstep(0.8, 1.3, p.y)) - 1.25 + 0.35 * smoothstep(0.9, 1.4, p.y), 0.2);
  float shell = smin(body, cabin, 0.08);
  // Wheel arches out of the body, wheels into them.
  vec3 w = vec3(abs(p.x) - 0.78, p.y - 0.34, abs(p.z) - 1.42);
  shell = smax(shell, -(length(w.yz) - 0.42), 0.03);
  float tyre = max(length(w.yz) - 0.34, abs(w.x) - 0.11);
  part = tyre < shell ? ID_TYRE : (p.y > 0.98 && abs(p.x) < 0.8 && abs(p.z + 0.1) < 1.25 ? ID_GLASS : ID_CAR);
  return min(shell, tyre);
}

/* ---- the signal ------------------------------------------------------------ */

const vec3 POLE = vec3(8.2, 0.15, 5.6);
const vec3 HEAD = vec3(1.9, 5.25, 5.6);

float signalHead(vec3 p) {
  vec3 q = p - HEAD;
  float housing = sdRound(q, vec3(0.19, 0.55, 0.15), 0.04);
  float plate = sdRound(q - vec3(0.0, 0.0, 0.12), vec3(0.34, 0.72, 0.012), 0.03);
  // Three visors, each a hood open at the bottom, over three lenses.
  vec3 v = q; v.y = mod(v.y + 0.55, 0.36) - 0.18;
  float visor = max(max(abs(length(v.xy) - 0.135) - 0.012, -v.z - 0.34), v.z + 0.12);
  visor = max(visor, -v.y - 0.02 + 0.04 * v.z);
  visor = max(visor, abs(q.y) - 0.55);
  float hanger = sdCapsule(p, HEAD + vec3(0.0, 0.55, 0.0), vec3(HEAD.x, 6.15, HEAD.z), 0.035);
  return min(min(housing, plate), min(visor, hanger));
}

float signalPole(vec3 p) {
  float pole = sdCone(p, POLE, POLE + vec3(0.0, 6.3, 0.0), 0.16, 0.11);
  float base = sdRound(p - POLE - vec3(0.0, 0.25, 0.0), vec3(0.26, 0.25, 0.26), 0.04);
  float arm = sdCone(p, POLE + vec3(-0.05, 6.15, 0.0), vec3(HEAD.x - 0.6, 6.15, HEAD.z), 0.1, 0.06);
  float brace = sdCapsule(p, POLE + vec3(0.0, 5.3, 0.0), POLE + vec3(-2.2, 6.1, 0.0), 0.035);
  // A pedestrian push-button box and a street sign on the pole.
  float sign = sdBox(p - (POLE + vec3(-0.06, 3.6, 0.0)), vec3(0.62, 0.15, 0.01));
  return min(min(pole, base), min(min(arm, brace), sign));
}

/* ---- the scene ---------------------------------------------------------- */

vec2 map(vec3 p) {
  // Ground: road at 0, sidewalks a kerb's height up.
  float ax = abs(p.x);
  vec2 d = vec2(p.y - (ax > ROAD ? 0.15 : 0.0), ax > ROAD ? ID_WALK : ID_ROAD);
  float kerb = max(rrect(vec2(ax - ROAD, p.y - 0.075), vec2(0.15, 0.075), 0.03), -p.z - 2.0);
  d = U(d, vec2(kerb, ID_KERB));

  float bid;
  d = U(d, vec2(buildings(p, bid), ID_BLD));

  // Parked cars along both kerbs.
  float part;
  vec3 c = p;
  if (p.x > 0.0) {
    float k = clamp(floor((p.z - 15.0) / 7.5 + 0.5), 0.0, 3.0);
    c = vec3(p.x - 5.85, p.y, p.z - (15.0 + k * 7.5));
    if (k != 2.0) d = U(d, vec2(car(c, part), part));
  } else {
    float k = clamp(floor((p.z - 19.0) / 8.0 + 0.5), 0.0, 3.0);
    c = vec3(-p.x - 5.85, p.y, p.z - (19.0 + k * 8.0));
    if (k != 1.0) d = U(d, vec2(car(c, part), part));
  }

  // Two street trees on the left, and a lamp.
  vec3 t = vec3(p.x + 9.0, p.y, p.z - 13.0);
  t.z = mod(t.z + 11.0, 22.0) - 11.0;
  if (p.z < 40.0 && p.z > 2.0) {
    d = U(d, vec2(sdCone(t, vec3(0.0, 0.15, 0.0), vec3(0.0, 3.6, 0.0), 0.16, 0.1), ID_TRUNK));
    float crown = length((t - vec3(0.0, 5.0, 0.0)) * vec3(1.0, 1.15, 1.0)) - 2.3;
    if (crown < 0.6) crown += 0.55 * (fbm(t * 1.6) - 0.5);
    d = U(d, vec2(crown * 0.7, ID_LEAF));
  }
  vec3 l = p - vec3(-9.6, 0.15, 30.0);
  d = U(d, vec2(min(sdCone(l, vec3(0.0), vec3(0.0, 7.5, 0.0), 0.12, 0.07), sdCapsule(l, vec3(0.0, 7.4, 0.0), vec3(1.6, 7.6, 0.0), 0.05)), ID_LAMP));
  d = U(d, vec2(sdRound(l - vec3(1.7, 7.5, 0.0), vec3(0.32, 0.06, 0.16), 0.04), ID_LAMP));

  d = U(d, vec2(signalPole(p), ID_POLE));
  d = U(d, vec2(signalHead(p), ID_HEAD));
  return d;
}

vec3 normalAt(vec3 p, float t) {
  vec2 e = vec2(1.0, -1.0) * (0.0006 + 0.0004 * t);
  return normalize(e.xyy * map(p + e.xyy).x + e.yyx * map(p + e.yyx).x + e.yxy * map(p + e.yxy).x + e.xxx * map(p + e.xxx).x);
}

float shadowTo(vec3 p, vec3 l) {
  float t = 0.03;
  for (int i = 0; i < 110; i++) {
    float h = map(p + l * t).x;
    if (h < 0.0015) return 0.0;
    t += clamp(h, 0.02, 4.0);
    if (t > 140.0) break;
  }
  return 1.0;
}

float occlusion(vec3 p, vec3 n) {
  float o = 0.0, w = 1.0;
  for (int i = 1; i <= 5; i++) {
    float h = 0.12 * float(i * i);
    o += (h - min(map(p + n * h).x, h)) * w;
    w *= 0.6;
  }
  return clamp(1.0 - 0.55 * o, 0.0, 1.0);
}

vec3 sky(vec3 d) {
  float up = max(d.y, 0.0);
  vec3 c = mix(vec3(0.78, 0.84, 0.90), vec3(0.32, 0.50, 0.78), pow(up, 0.55));
  float s = max(dot(d, SUN), 0.0);
  c += vec3(1.0, 0.92, 0.8) * (pow(s, 600.0) * 30.0 + pow(s, 8.0) * 0.25);
  // Thin high cloud.
  if (d.y > 0.0) {
    vec2 uv = d.xz / (d.y + 0.12);
    float cl = smoothstep(0.55, 0.85, fbm(uv * 0.7 + 3.0));
    c = mix(c, vec3(0.93, 0.94, 0.96), cl * 0.6 * smoothstep(0.0, 0.25, d.y));
  }
  return c;
}

struct Surf { vec3 alb; float rough; float metal; vec3 emit; };

Surf surface(float id, vec3 p, vec3 n) {
  Surf s = Surf(vec3(0.5), 0.8, 0.0, vec3(0.0));
  if (id == ID_ROAD) {
    float g = noise(p.xz * 9.0) * 0.5 + noise(p.xz * 40.0) * 0.5;
    vec3 c = mix(hex(0x3a3b3d), hex(0x4a4a4b), g);
    c *= 0.85 + 0.25 * fbm(p.xz * 0.15);
    // Paint: edge lines, the dashed centre, lane dashes, and the zebra.
    float paint = 0.0;
    paint += step(abs(abs(p.x) - 6.55), 0.07);
    paint += step(abs(p.x), 0.08) * step(fract(p.z / 6.0), 0.5) * step(9.0, p.z);
    paint += step(abs(abs(p.x) - 3.4), 0.06) * step(fract(p.z / 9.0), 0.33) * step(9.0, p.z);
    paint += step(abs(p.z - 5.0), 1.9) * step(fract(p.x / 1.1 + 0.25), 0.5) * step(abs(p.x), 6.3);
    paint += step(abs(p.z - 7.6), 0.15) * step(abs(p.x), 6.5);
    paint = clamp(paint, 0.0, 1.0) * (0.75 + 0.25 * noise(p.xz * 20.0));
    s.alb = mix(c, hex(0xd8d8d2), paint);
    s.rough = mix(0.85, 0.6, paint);
  } else if (id == ID_WALK) {
    vec2 j = abs(fract(p.xz / 1.5) - 0.5);
    float joint = smoothstep(0.485, 0.495, max(j.x, j.y));
    s.alb = mix(hex(0xa9a7a1), hex(0xb9b6ae), noise(floor(p.xz / 1.5) * 3.1)) * (1.0 - 0.35 * joint);
  } else if (id == ID_KERB) {
    s.alb = hex(0xb0ada6);
  } else if (id == ID_BLD) {
    float bid; buildings(p, bid);
    float h = hash11(bid * 1.7 + 3.0);
    vec3 base = h < 0.33 ? hex(0x8a4f3a) : h < 0.6 ? hex(0xbfae92) : h < 0.8 ? hex(0x6c7177) : hex(0x9c8466);
    // Brick courses on the brick ones, a little weathering on everything.
    float course = h < 0.33 ? 0.9 + 0.1 * step(0.08, fract(p.y / 0.075)) : 1.0;
    s.alb = base * course * (0.82 + 0.3 * fbm(p * 0.6));
    s.alb *= 1.0 - 0.25 * smoothstep(1.5, 0.0, p.y - 0.15);
    // Inside a window recess: glass, which reflects.
    float face = WALK + blockSet(sign(p.x), floor((p.z - 4.0) / 15.0));
    if (abs(p.x) > face + 0.1 && (p.y > 4.4 || p.y < 3.5)) {
      // Glass, and behind it whatever each flat has: blinds, curtains, dark.
      float w = hash21(floor(vec2(p.z / 3.0 + 0.5, p.y / 3.3)) + bid);
      s.alb = w < 0.55 ? hex(0x10151b) : w < 0.8 ? hex(0x6d665a) : hex(0xa49a86);
      s.rough = w < 0.55 ? 0.06 : 0.5; s.metal = w < 0.55 ? 0.75 : 0.2;
      if (p.y < 3.5) { s.alb = hex(0x1a1f24); s.rough = 0.12; s.metal = 0.4; }
    }
    // A string course of darker stone at every floor.
    else if (p.y > 4.4 && fract((p.y - 4.6) / 3.3) > 0.93) s.alb *= 0.78;
  } else if (id == ID_CAR) {
    float k = floor((p.z + 2.0) / 7.5) + (p.x > 0.0 ? 0.0 : 9.0);
    float h = hash11(k * 3.3);
    s.alb = h < 0.3 ? hex(0xd9dadb) : h < 0.55 ? hex(0x2a3442) : h < 0.8 ? hex(0x8b9096) : hex(0x15181b);
    s.rough = 0.18; s.metal = 0.0;
  } else if (id == ID_GLASS) {
    s.alb = hex(0x0d1014); s.rough = 0.05; s.metal = 0.7;
  } else if (id == ID_TYRE) {
    s.alb = hex(0x161616); s.rough = 0.7;
  } else if (id == ID_TRUNK) {
    s.alb = hex(0x4a3f35) * (0.8 + 0.4 * noise(p * 8.0));
  } else if (id == ID_LEAF) {
    float g = fbm(p * 3.0);
    s.alb = mix(hex(0x2f4a22), hex(0x5d7a33), g);
    s.rough = 0.7;
  } else if (id == ID_LAMP) {
    s.alb = hex(0x33383c); s.rough = 0.45; s.metal = 0.5;
  } else if (id == ID_POLE) {
    s.alb = hex(0x5c6266) * (0.85 + 0.3 * noise(p * 5.0)); s.rough = 0.45; s.metal = 0.7;
    if (abs(p.y - (POLE.y + 3.6)) < 0.15 && p.z < POLE.z) { s.alb = hex(0x1f6b3a); s.metal = 0.0; s.rough = 0.4; }
  } else if (id == ID_HEAD) {
    vec3 q = p - HEAD;
    s.alb = hex(0x141515); s.rough = 0.5;
    // The backplate's reflective white border.
    if (q.z > 0.1 && (abs(q.x) > 0.29 || abs(q.y) > 0.67)) { s.alb = hex(0xd9d9d2); s.rough = 0.4; }
    // Lenses on the front face: red lit at the top, the others dark.
    float ly = q.y - 0.36;
    for (int i = 0; i < 3; i++) {
      float y = q.y - (0.36 - 0.36 * float(i));
      if (length(vec2(q.x, y)) < 0.11 && q.z < -0.12) {
        if (i == 0) { s.alb = hex(0x5a0505); s.emit = vec3(4.2, 0.18, 0.08) * (1.0 - 0.5 * length(vec2(q.x, y)) / 0.11); }
        else s.alb = i == 1 ? hex(0x2a2008) : hex(0x062014);
        s.rough = 0.1;
      }
    }
  }
  return s;
}

vec3 shade(vec3 ro, vec3 rd, float t, float id, vec3 sunDir) {
  vec3 p = ro + rd * t;
  vec3 n = normalAt(p, t);
  Surf s = surface(id, p, n);
  vec3 v = -rd;
  float ao = occlusion(p, n);
  float sh = shadowTo(p + n * 0.02, sunDir);
  float nl = max(dot(n, sunDir), 0.0);
  vec3 sunC = vec3(1.0, 0.9, 0.76) * 3.6;
  vec3 skyC = mix(vec3(0.24, 0.29, 0.37), vec3(0.36, 0.43, 0.55), n.y * 0.5 + 0.5);
  vec3 bounce = vec3(0.28, 0.26, 0.24) * max(-n.y, 0.0);
  vec3 dif = s.alb * (1.0 - s.metal) * (sunC * nl * sh + (skyC * (0.55 + 0.45 * n.y) + bounce) * ao);
  // Specular: the sun, and the sky in anything glossy.
  vec3 h = normalize(sunDir + v);
  float a = max(s.rough * s.rough, 0.002);
  float nh = max(dot(n, h), 0.0);
  float dd = nh * nh * (a * a - 1.0) + 1.0;
  float ggx = a * a / (PI * dd * dd);
  float fr = 0.04 + 0.96 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
  vec3 f0 = mix(vec3(0.04), s.alb, s.metal);
  vec3 spec = sunC * ggx * nl * sh * mix(vec3(fr), f0 + (1.0 - f0) * fr, s.metal) * 0.25;
  vec3 r = reflect(rd, n);
  vec3 env = sky(r) * (r.y < 0.0 ? 0.35 : 1.0);
  vec3 refl = env * mix(vec3(fr), f0 + (1.0 - f0) * fr, s.metal) * (1.0 - s.rough) * ao;
  vec3 col = dif + spec + refl + s.emit;
  // Air: the far end of the street goes into the haze.
  float haze = 1.0 - exp(-t * 0.0042);
  return mix(col, vec3(0.66, 0.74, 0.84), haze);
}

void main() {
  vec2 uv = ((gl_FragCoord.xy + u_jit) / u_res) * 2.0 - 1.0;
  vec3 ro = vec3(1.3, 1.65, -1.5);
  vec3 ta = vec3(0.6, 5.0, 30.0);
  vec3 f = normalize(ta - ro), r = normalize(cross(vec3(0.0, 1.0, 0.0), f)), u = cross(f, r);
  vec3 rd = normalize(f * 1.55 + uv.x * r + uv.y * u);

  float t = 0.05, id = 0.0;
  bool hit = false;
  for (int i = 0; i < 320; i++) {
    vec2 h = map(ro + rd * t);
    if (h.x < 0.0004 * t) { id = h.y; hit = true; break; }
    t += h.x * 0.85;
    if (t > 400.0) break;
  }

#ifdef MASK
  o = vec4(hit && id == ID_HEAD ? 1.0 : 0.0, hit && id == ID_POLE ? 1.0 : 0.0, 0.0, 1.0);
  return;
#endif

  // Each sample sees the sun from a slightly different point of its disc.
  vec2 j = fract(hash22(floor(gl_FragCoord.xy)) + u_jit + 0.5) - 0.5;
  vec3 sunDir = normalize(SUN + (cross(SUN, vec3(0.0, 1.0, 0.0)) * j.x + vec3(0.0, 1.0, 0.0) * j.y) * 0.02);

  vec3 col = hit ? shade(ro, rd, t, id, sunDir) : sky(rd);
  // A phone camera's picture: exposed, graded, a little vignette.
  col *= 0.95;
  col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);
  col = clamp(col, 0.0, 1.0);
  col *= 1.0 - 0.18 * dot(uv * 0.7, uv * 0.7);
  // Sensor noise, as a phone camera has.
  col += (hash21(gl_FragCoord.xy + u_jit * 91.0) - 0.5) * 0.025;
  o = vec4(col, 1.0);
}
