/* Lot: a grand piano missing every black key.
 *
 * An Edwardian rosewood parlour grand, about 1.65 m long, French-polished.
 * The lid is up on its long stick, so you see the gilt iron frame with its
 * struts and portholes, three rows of tuning pins, the damper heads and the
 * strings over the soundboard. Turned legs on brass castors, a lyre with two
 * pedals, a fretwork music desk, and the maker's name in gold on the
 * nameboard. The keyboard has all 52 ivory-topped naturals; where the 36
 * sharps should be there are only slots, each with its front-rail pin and
 * felt punching still there at the bottom. Units: metres.
 */
#define BOUND vec3(0.76, 0.90, 0.84)
#define CENTRE vec3(0.0, 0.90, -0.23)
#define VIEW_YAW 0.72
#define VIEW_PITCH 0.42
#define FILL 0.84
#define EXPOSURE 1.2
#define COAT(id) ((id) == 1.0 ? 1.0 : ((id) == 11.0 ? 0.5 : ((id) == 7.0 ? 0.25 : 0.0)))
#define SHEEN(id) ((id) == 10.0 || (id) == 5.0 ? 0.7 : 0.0)

const float CW = 0.735;   // half the case's width
const float CF = 0.42;    // the front of the case, where the nameboard is
const float KF = 0.585;   // the front of the keys
const float RB = 0.64;    // the bottom of the rim
const float RT = 0.98;    // the top of the rim
const float LA = 0.60;    // the lid, open on its long stick
const float KW = 1.222 / 52.0;
const float X0 = -0.611;

float sdR(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
float seg2(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)); }

/* The case's width at z, from the spine: straight at the keyboard, the
   bentside sweeping in, then the round tail. */
float widthAt(float z) {
  if (z > 0.15) return 1.47;
  if (z > -0.80) { float t = (0.15 - z) / 0.95; return 1.47 - 1.0 * smoothstep(0.0, 1.0, pow(t, 1.5)); }
  float s = (z + 0.80) / 0.25;
  return 0.47 * sqrt(max(0.0, 1.0 - s * s));
}

/* The plan of the case (x, z), without its open front. */
float outline(vec2 q) {
  float w = widthAt(q.y);
  float sl = clamp((widthAt(q.y + 0.004) - widthAt(q.y - 0.004)) / 0.008, -10.0, 10.0);
  float d = (q.x + CW - w) / sqrt(1.0 + sl * sl);
  d = max(d, -CW - q.x);
  return max(d, -1.05 - q.y);
}

/* Which naturals have a sharp after them: C D F G A do, E and B don't, and
   the sharps sit a little off the joint, as they do on a real keyboard. */
float sharpOffset(float b, out bool has) {
  int L = int(mod(b - 1.0 + 5.0, 7.0));
  has = b >= 1.0 && b <= 51.0 && L != 2 && L != 6;
  return L == 0 ? -0.0022 : (L == 1 ? 0.0022 : (L == 3 ? -0.0028 : (L == 5 ? 0.0028 : 0.0)));
}

float leg(vec3 q) {
  float y = q.y;
  float d = sdRound(q - vec3(0.0, 0.607, 0.0), vec3(0.056, 0.034, 0.056), 0.006);
  d = min(d, sdRound(q - vec3(0.0, 0.568, 0.0), vec3(0.062, 0.007, 0.062), 0.004));
  float rr = mix(0.046, 0.028, clamp((0.56 - y) / 0.44, 0.0, 1.0));
  rr += 0.012 * exp(-pow((y - 0.535) / 0.012, 2.0));
  rr += 0.006 * exp(-pow((y - 0.505) / 0.006, 2.0));
  rr += 0.016 * exp(-pow((y - 0.40) / 0.065, 2.0));
  rr += 0.007 * exp(-pow((y - 0.255) / 0.008, 2.0));
  rr += 0.010 * exp(-pow((y - 0.125) / 0.014, 2.0));
  float shaft = max(length(q.xz) - rr, abs(y - 0.335) - 0.225);
  return min(d, shaft * 0.75);
}

float castor(vec3 q) {
  float d = sdCone(q, vec3(0.0, 0.112, 0.0), vec3(0.0, 0.082, 0.0), 0.031, 0.026);
  d = min(d, sdRound(vec3(abs(q.x) - 0.013, q.y - 0.058, q.z - 0.006), vec3(0.003, 0.026, 0.016), 0.002));
  d = min(d, sdCyl(vec3(q.y - 0.033, q.x, q.z - 0.012), 0.033, 0.0085) - 0.0015);
  return d;
}

vec2 map(vec3 p) {
  float px = abs(p.x);
  float ol = outline(p.xz);
  float olF = max(ol, p.z - CF);

  // ---- the case: the rim, its mouldings, the bottom
  float rim = max(max(olF, -(ol + 0.03)), abs(p.y - 0.81) - 0.17);
  rim = min(rim, max(olF - 0.007, abs(p.y - 0.654) - 0.014) - 0.002);
  rim = min(rim, max(max(olF - 0.004, -(ol + 0.03)), abs(p.y - 0.972) - 0.008) - 0.002);
  rim = min(rim, max(olF, abs(p.y - 0.65) - 0.01));
  // The cheeks either end of the keyboard, the keybed and the keyslip.
  rim = min(rim, sdRound(vec3(px - 0.674, p.y - 0.712, p.z - 0.5085), vec3(0.061, 0.054, 0.0885), 0.014));
  rim = min(rim, sdBox(p - vec3(0.0, 0.665, 0.4485), vec3(CW, 0.02, 0.1485)));
  rim = min(rim, sdRound(p - vec3(0.0, 0.684, 0.5865), vec3(0.613, 0.020, 0.0105), 0.003));
  // The nameboard, the fallboard folded away above it, the desk's bed.
  rim = min(rim, sdBox(p - vec3(0.0, 0.7625, 0.4125), vec3(0.613, 0.0375, 0.0075)));
  rim = min(rim, sdBox(vec3(px - 0.66, p.y - 0.80, p.z - 0.32), vec3(0.05, 0.04, 0.10)));
  rim = min(rim, sdRound(p - vec3(0.0, 0.816, 0.373), vec3(0.705, 0.021, 0.052), 0.019));
  rim = min(rim, sdBox(p - vec3(0.0, 0.815, 0.265), vec3(0.705, 0.035, 0.065)));
  vec2 r = vec2(rim, 1.0);

  // ---- the music desk, leaning back, its middle pierced
  float dbx = sdBox(p - vec3(0.0, 1.05, 0.23), vec3(0.43, 0.21, 0.13));
  if (dbx < 0.01) {
    vec3 q = p - vec3(0.0, 0.85, 0.272);
    q.yz = rot(-0.26) * q.yz;
    float desk = sdRound(q - vec3(0.0, 0.19, 0.0), vec3(0.40, 0.19, 0.008), 0.003);
    vec2 f = q.xy - vec2(0.0, 0.205);
    float field = sdR(f, vec2(0.33, 0.125));
    // A trellis of slender bars, each diamond with a pierced quatrefoil.
    vec2 dg = vec2(f.x + f.y, f.x - f.y) * 0.7071 / 0.03;
    vec2 c = (fract(dg) - 0.5) * 0.03;
    float hole = (0.0105 - max(abs(c.x), abs(c.y)));
    hole = -hole;
    // A plain oval cartouche left solid in the middle.
    hole = max(hole, -((length(f / vec2(0.09, 0.06)) - 1.0) * 0.06));
    desk = max(desk, -max(hole, field + 0.006));
    desk = min(desk, sdRound(q - vec3(0.0, 0.012, 0.022), vec3(0.40, 0.012, 0.016), 0.003));
    r = U(r, vec2(desk, 1.0));
  } else r = U(r, vec2(dbx, 1.0));

  // ---- the keys
  float kb = sdBox(p - vec3(0.0, 0.708, 0.4425), vec3(0.613, 0.022, 0.1445));
  if (kb < 0.01) {
    float fk = (p.x - X0) / KW;
    float k = clamp(floor(fk), 0.0, 51.0);
    float u = p.x - (X0 + (k + 0.5) * KW);
    float key = sdRound(vec3(u, p.y - 0.7125, p.z - 0.4425), vec3(KW * 0.5 - 0.0005, 0.0125, 0.1425), 0.0011);
    float b = clamp(floor(fk + 0.5), 0.0, 52.0);
    bool has;
    float off = sharpOffset(b, has);
    float bx = X0 + b * KW + off;
    float pins = 1e9;
    if (has) {
      key = max(key, -sdBox(vec3(p.x - bx, p.y - 0.72, p.z - 0.4175), vec3(0.0071, 0.02, 0.1175)));
      // The front-rail pin the sharp sat on, in its felt punching.
      vec3 pq = vec3(p.x - bx, p.y, p.z - 0.519);
      pins = min(sdCyl(pq - vec3(0.0, 0.6985, 0.0), 0.0016, 0.0075), sdEllipsoid(pq - vec3(0.0, 0.706, 0.0), vec3(0.0019, 0.0012, 0.0019)));
      r = U(r, vec2(sdCyl(pq - vec3(0.0, 0.6915, 0.0), 0.0048, 0.0012), 5.0));
    }
    r = U(r, vec2(key, 3.0));
    r = U(r, vec2(pins, 6.0));
    // The key frame under them, and the strip of cloth on its front rail.
    r = U(r, vec2(sdBox(p - vec3(0.0, 0.6875, 0.44), vec3(0.613, 0.0025, 0.14)), 4.0));
    r = U(r, vec2(sdBox(p - vec3(0.0, 0.6905, 0.519), vec3(0.613, 0.0006, 0.014)), 5.0));
  } else r = U(r, vec2(kb, 3.0));

  // ---- inside the case: soundboard, iron frame, pins, strings, dampers
  float inb = max(ol + 0.03, max(abs(p.y - 0.82) - 0.11, p.z - 0.21));
  if (inb < 0.01) {
    r = U(r, vec2(max(ol + 0.03, max(abs(p.y - 0.712) - 0.006, p.z - 0.21)), 8.0));
    // The frame: a slab with the belly cut away between the struts, a band
    // of portholes, the strike gap, and the pin field in front.
    float pl = max(ol + 0.045, max(abs(p.y - 0.862) - 0.013, p.z - 0.195));
    float belly = max(ol + 0.115, p.z + 0.10);
    float st = min(min(seg2(p.xz, vec2(-0.47, 0.0), vec2(-0.62, -0.88)), seg2(p.xz, vec2(-0.14, 0.0), vec2(-0.44, -0.74))),
                   min(seg2(p.xz, vec2(0.20, 0.0), vec2(-0.12, -0.46)), seg2(p.xz, vec2(0.52, 0.0), vec2(0.36, -0.14)))) - 0.019;
    belly = max(belly, -st);
    float ports = max(length(vec2(mod(p.x + 0.6, 0.24) - 0.12, p.z + 0.04)) - 0.036, px - 0.56);
    float gap = max(abs(p.z - 0.066) - 0.03, ol + 0.07);
    pl = max(pl, -min(min(belly, ports), gap));
    // A raised rib round the belly's edge.
    pl = min(pl, max(abs(belly + 0.012) - 0.009, max(abs(p.y - 0.877) - 0.004, ol + 0.045)) - 0.001);
    r = U(r, vec2(pl, 7.0));
    // Tuning pins, three staggered rows.
    float row = clamp(floor((p.z - 0.1125) / 0.025 + 0.5), 0.0, 2.0);
    float zc = 0.1125 + row * 0.025, sh = row * 0.0045;
    float xc = (floor((p.x + sh) / 0.0135) + 0.5) * 0.0135 - sh;
    float tp = max(sdCyl(vec3(p.x - xc, p.y - 0.887, p.z - zc), 0.0033, 0.012) - 0.0004, px - 0.605);
    r = U(r, vec2(tp, 6.0));
    // Strings: trichords in the treble, single wound strings in the bass,
    // from the pins back to the hitch pins along the bentside.
    float sy = p.y - 0.8795;
    if (abs(sy) < 0.01) {
      float lim = max(ol + 0.075, max(p.z - 0.17, px - 0.605));
      if (p.x < -0.22) {
        float c = (floor(p.x / 0.0105) + 0.5) * 0.0105;
        r = U(r, vec2(max(length(vec2(p.x - c, sy + 0.0007)) - 0.0013, lim), 9.0));
      } else {
        float c = (floor(p.x / 0.0135) + 0.5) * 0.0135;
        float uu = p.x - c;
        uu -= clamp(floor(uu / 0.0036 + 0.5), -1.0, 1.0) * 0.0036;
        r = U(r, vec2(max(length(vec2(uu, sy)) - 0.00055, lim), 12.0));
      }
    } else r = U(r, vec2(abs(sy) - 0.008, 6.0));
    // Damper heads sitting on the strings, one to a note.
    if (p.x > -0.46 && p.x < 0.50) {
      float c = (floor(p.x / 0.0135) + 0.5) * 0.0135;
      r = U(r, vec2(sdRound(vec3(p.x - c, p.y - 0.899, p.z - 0.066), vec3(0.0058, 0.018, 0.022), 0.0015), 10.0));
    }
  } else r = U(r, vec2(inb, 7.0));

  // ---- the lid, hinged along the spine, the front flap folded back on it
  if (p.y > 0.95) {
    vec3 lq = p - vec3(-CW, RT, 0.0);
    lq.xy = rot(LA) * lq.xy;
    float lid = max(max(outline(vec2(lq.x - CW, p.z)), p.z - 0.145) + 0.003, abs(lq.y - 0.011) - 0.011) - 0.003;
    lid = min(lid, sdRound(vec3(lq.x - CW, lq.y - 0.0335, p.z - 0.0075), vec3(CW - 0.003, 0.011, 0.1375), 0.004));
    r = U(r, vec2(lid, 11.0));
  } else r = U(r, vec2(0.95 - p.y + 0.004, 11.0));
  // The stick, from a cup on the bentside's rim up to the lid.
  vec3 sb = vec3(0.635, RT + 0.004, -0.15);
  vec3 stp = vec3(-CW + 1.25 * cos(LA) + 0.012 * sin(LA), RT + 1.25 * sin(LA) - 0.012 * cos(LA), -0.15);
  if (px > 0.2 && p.y > 0.9) {
    r = U(r, vec2(sdCone(p, sb, stp, 0.0115, 0.0085), 1.0));
    float fe = min(sdCone(p, sb - vec3(0.0, 0.004, 0.0), sb + normalize(stp - sb) * 0.03, 0.013, 0.0125), sdCone(p, stp - normalize(stp - sb) * 0.025, stp, 0.0105, 0.010));
    r = U(r, vec2(fe, 2.0));
  } else r = U(r, vec2(max(max(0.2 - px, 0.9 - p.y), 0.002), 1.0));

  // ---- legs, castors, the lyre and pedals
  if (p.y < 0.66) {
    vec3 l1 = vec3(px - 0.64, p.y, p.z - 0.31), l2 = vec3(p.x + 0.50, p.y, p.z + 0.80);
    float lb = min(length(l1.xz), length(l2.xz)) - 0.075;
    if (lb < 0.01) {
      r = U(r, vec2(min(leg(l1), leg(l2)), 1.0));
      r = U(r, vec2(min(castor(l1), castor(l2)), 2.0));
    } else r = U(r, vec2(lb, 1.0));
    vec3 q = vec3(p.x, p.y, p.z - 0.31);
    float lyb = sdBox(q - vec3(0.0, 0.35, 0.06), vec3(0.16, 0.3, 0.13));
    if (lyb < 0.01) {
      float ly = sdRound(q - vec3(0.0, 0.627, 0.0), vec3(0.12, 0.014, 0.032), 0.005);
      float ay = clamp((q.y - 0.14) / 0.47, 0.0, 1.0);
      float ax = 0.032 + 0.062 * sin(ay * 2.6) - 0.02 * ay;
      float arm = max(max(abs(abs(q.x) - ax) - 0.011, abs(q.z) - 0.015), abs(q.y - 0.375) - 0.235) * 0.7;
      ly = min(ly, arm);
      // Its turned rods.
      ly = min(ly, max(length(vec2(abs(q.x - 0.0) , q.z)) - 0.0045, abs(q.y - 0.38) - 0.22));
      ly = min(ly, max(length(vec2(abs(q.x) - 0.026, q.z)) - 0.004, abs(q.y - 0.38) - 0.2));
      ly = min(ly, sdRound(q - vec3(0.0, 0.10, 0.0), vec3(0.13, 0.038, 0.05), 0.01));
      ly = min(ly, sdRound(q - vec3(0.0, 0.145, 0.0), vec3(0.11, 0.008, 0.04), 0.004));
      r = U(r, vec2(ly, 1.0));
      float ped = sdRound(vec3(abs(q.x) - 0.04, q.y - 0.088 + 0.03 * max(q.z - 0.1, 0.0), q.z - 0.10), vec3(0.012 + 0.004 * smoothstep(0.08, 0.15, q.z), 0.0035, 0.058), 0.003);
      r = U(r, vec2(ped, 2.0));
    } else r = U(r, vec2(lyb, 1.0));
  } else r = U(r, vec2(p.y - 0.65, 1.0));
  return r;
}

/* ---- materials --------------------------------------------------------- */

/* Rosewood: dark purple-brown, warmer streaks, the black lines that wander
   through it; g.x runs along the grain. */
vec3 rosewood(vec2 g) {
  float warp = fbm(vec2(g.x * 0.7, g.y * 4.0)) * 2.0;
  float band = fbm(vec2(g.x * 0.45, g.y * 8.0 + warp));
  vec3 c = mix(hex(0x452c27), hex(0x211514), smoothstep(0.3, 0.7, band));
  c = mix(c, hex(0x57352a), smoothstep(0.6, 0.8, fbm(vec2(g.x * 0.35, g.y * 5.0) + 7.0)) * 0.5);
  float s = g.y * 38.0 + warp * 3.0;
  float line = smoothstep(0.07, 0.0, abs(fract(s) - 0.5)) * smoothstep(0.35, 0.7, noise(vec2(g.x * 1.6, floor(s))));
  float hair = smoothstep(0.03, 0.0, abs(fract(s * 3.7 + 0.3) - 0.5)) * 0.4;
  c = mix(c, hex(0x0b0605), clamp(line * 0.85 + hair * 0.5, 0.0, 1.0));
  float pore = smoothstep(0.76, 0.9, noise(vec2(g.x * 28.0, g.y * 900.0)));
  return c * (1.0 - 0.18 * pore);
}

Mat material(float id, vec3 p, vec3 n) {
  float px = abs(p.x);
  if (id == 1.0 || id == 11.0) {
    vec2 g;
    if (p.y > RT + 0.004 && p.z < 0.15 && px > 0.0) {
      vec3 lq = p - vec3(-CW, RT, 0.0);
      lq.xy = rot(LA) * lq.xy;
      g = vec2(p.z, lq.x);
    } else if (abs(n.y) > 0.7) g = vec2(p.z, p.x);
    else if (abs(n.x) > abs(n.z)) g = vec2(p.z, p.y);
    else g = vec2(p.x, p.y);
    vec3 c = rosewood(g);
    float rough = 0.30 + 0.1 * noise(p * 40.0);
    // The maker's name in gold on the nameboard.
    if (n.z > 0.5 && p.z > 0.418 && p.z < 0.424 && p.y > 0.726 && p.y < 0.799 && px < 0.3) {
      vec2 uv = vec2((p.x + 0.3) / 0.6, (p.y - 0.727) / 0.068);
      float ink = pow(texture(u_tex, uv).r, 2.2);
      ink = clamp(ink * 1.3, 0.0, 1.0) * (0.8 + 0.2 * noise(p.xy * 3000.0));
      return mat(mix(c, hex(0xd0aa60), ink), mix(rough, 0.38, ink), ink * 0.45);
    }
    return mat(c, rough, 0.0);
  }
  if (id == 2.0) {
    float tarn = smoothstep(0.3, 0.75, fbm(p * 120.0));
    return mat(mix(hex(0xb8955a), hex(0x6a5030), 0.25 + tarn * 0.45), 0.3 + 0.18 * tarn, 0.85);
  }
  if (id == 3.0) {
    float k = clamp(floor((p.x - X0) / KW), 0.0, 51.0);
    // The sides of the keys below the ivory are bare limewood.
    if (abs(n.y) < 0.5 && n.z < 0.5 && p.y < 0.7225) {
      vec3 c = mix(hex(0x7a664e), hex(0x62513e), noise(vec2(p.z * 60.0, p.y * 300.0)));
      return mat(c, 0.7, 0.0);
    }
    // Ivory: each key its own cream, faint grain along the key, and the
    // joint between head and tail.
    float h = hash11(k * 7.13);
    vec3 c = mix(hex(0xe9dfc8), hex(0xd8c8a2), h * 0.7);
    c = mix(c, hex(0xcdb98e), smoothstep(0.5, 0.85, fbm(vec3(p.x * 60.0, p.z * 12.0, k))) * 0.45);
    c *= 0.98 + 0.02 * noise(vec2(p.x * 1200.0, p.z * 25.0));
    float joint = smoothstep(0.0005, 0.0001, abs(p.z - (KF - 0.050))) * step(0.5, n.y);
    c *= 1.0 - 0.25 * joint;
    // A little grime in the gaps and along the edges.
    float u = abs(p.x - (X0 + (k + 0.5) * KW));
    c *= 1.0 - 0.12 * smoothstep(KW * 0.5 - 0.0025, KW * 0.5, u);
    Mat m = mat(c, 0.30 + 0.08 * h, 0.0);
    m.sss = 0.35;
    return m;
  }
  if (id == 4.0) return mat(mix(hex(0x1c1611), hex(0x2a2018), noise(p.xz * vec2(30.0, 200.0))), 0.8, 0.0);
  if (id == 5.0) return mat(mix(hex(0x5c1c20), hex(0x6e2428), noise(p * 2000.0)), 0.95, 0.0);
  if (id == 12.0) return mat(hex(0x9a9da2), 0.4, 1.0);
  if (id == 6.0) return mat(p.y > 0.882 && p.z > 0.1 ? hex(0x7c7f84) : hex(0xb9bcc0), p.y > 0.882 && p.z > 0.1 ? 0.38 : 0.25, 1.0);
  if (id == 7.0) {
    // Gilt bronze paint on the iron, a little dulled and mottled.
    float m = fbm(p * 30.0);
    vec3 c = mix(hex(0xb2924f), hex(0x8a6d3a), m * 0.6);
    return mat(c, 0.42 + 0.1 * m, 0.75);
  }
  if (id == 8.0) {
    // The soundboard: quarter-sawn spruce, varnished, its grain on the diagonal.
    float s = (p.x - p.z) * 0.707;
    float gr = smoothstep(0.3, 0.7, noise(vec2(s * 420.0, (p.x + p.z) * 3.0)));
    vec3 c = mix(hex(0xb18c5b), hex(0x8c6a40), gr * 0.5);
    return mat(c, 0.45, 0.0);
  }
  if (id == 9.0) {
    // Copper-wound bass strings: the winding catches the light in fine rings.
    float wind = 0.8 + 0.2 * sin(p.z * 9000.0);
    return mat(hex(0xb47a52) * wind, 0.3, 1.0);
  }
  // Damper heads: black felt underneath, a stained wooden block above.
  if (p.y < 0.8875) return mat(hex(0x161515), 0.95, 0.0);
  return mat(rosewood(vec2(p.x * 3.0, p.y)) * 0.8, 0.45, 0.0);
}
