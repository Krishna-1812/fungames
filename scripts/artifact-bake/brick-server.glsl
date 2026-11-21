/* September 4, 1998: Google is founded.
 *
 * Its first servers kept their disks in a case built from toy bricks, because
 * a pile of bare drives needed somewhere to stand and bricks were cheap and
 * came in the shape of a shelf. This is that case: a light-grey baseplate and
 * two tiers of walls in primary colours, studs on the top, open at the front,
 * with ten bare 3.5 inch hard drives on their edges, five to a tier, their
 * green circuit boards turned to the room and a grey ribbon cable plugged
 * into each. Bricks 1.6 by 3.2 by 0.96 cm, studs 0.8 cm apart, drives
 * 2.54 by 10.2 by 14.7 cm. No marks on the bricks or the studs. Units: 1 cm.
 */
#define BOUND vec3(13.0, 11.95, 11.4)
#define CENTRE vec3(0.0, 11.95, 3.0)
#define VIEW_YAW -0.4
#define VIEW_PITCH 0.34
#define FILL 0.82
#define EXPOSURE 1.4
#define STEP 0.8
#define COAT(id) (id == 1.0 || id == 9.0 ? 0.2 : id == 2.0 ? 0.25 : 0.0)

const float PITCH = 4.48;
const float BRICK_H = 0.96;
const float Y1 = 0.32;       // the floor of the lower tier's walls
const float Y2 = 12.16;      // the shelf plate's top, the upper tier's walls start
const float DRV_Y = 5.08;    // half the drive's height (on its edge)

/* ---- the walls, one tier ---- */
float wallTier(vec3 p, float y0) {
  vec3 q = p - vec3(0.0, y0 + 5.76, 0.0);
  float ho = sdBox(q, vec3(12.8, 5.76, 8.4));
  float hi = sdBox(q - vec3(0.0, 0.0, 4.0), vec3(11.2, 6.0, 10.8));
  float d = max(ho, -hi);
  float yy = p.y - y0;
  bool side = abs(p.x) > 11.15;
  float u = side ? p.z : p.x;
  float c = floor(yy / BRICK_H);
  float v = yy - (c + 0.5) * BRICK_H;
  float ub = mod(u + mod(c, 2.0) * 1.6 + 1.6, 3.2) - 1.6;
  float ed = min(1.6 - abs(ub), 0.48 - abs(v));
  float low = smoothstep(11.35, 11.1, yy);
  d += 0.035 * (1.0 - smoothstep(0.0, 0.04, ed)) * low;
  return d;
}

float studs(vec3 p, float yTop, vec2 ext) {
  vec3 c = vec3(mod(p.x, 0.8) - 0.4, p.y - yTop - 0.085, mod(p.z + 0.4, 0.8) - 0.4);
  float d = sdCyl(c, 0.245, 0.085) - 0.012;
  return max(d, max(abs(p.x) - ext.x, abs(p.z) - ext.y));
}

/* ---- one drive, in its own frame: x across (the PCB side is +x), y up the
   edge, z along its length with the connectors at +z ---- */
vec2 drive(vec3 q, float k) {
  q.x = -q.x;   // the boards face -x, towards the light and the lens
  float bb = sdBox(q - vec3(1.0, 0.0, 4.3), vec3(2.2, 5.3, 11.4));
  if (bb > 0.25) return vec2(bb, 3.0);
  vec2 d = vec2(sdRound(q - vec3(0.0, 0.0, 0.6), vec3(1.27, DRV_Y, 7.35), 0.12), 3.0);
  // the circuit board on the +x face, and what stands on it
  d = U(d, vec2(sdRound(q - vec3(1.35, 0.0, 0.8), vec3(0.08, 4.9, 7.0), 0.02), 2.0));
  vec3 s = q - vec3(1.5, 0.0, 0.0);
  float chips = sdBox(s - vec3(0.0, 1.5, -2.5), vec3(0.09, 1.2, 1.2));
  chips = min(chips, sdBox(s - vec3(0.0, -1.8, -1.0), vec3(0.09, 1.0, 1.5)));
  chips = min(chips, sdBox(s - vec3(0.0, 2.6, 2.8), vec3(0.09, 0.8, 1.6)));
  chips = min(chips, sdBox(s - vec3(0.0, -2.8, 3.5), vec3(0.09, 0.7, 0.7)));
  chips = min(chips, sdBox(s - vec3(0.0, 0.2, -5.0), vec3(0.09, 0.9, 0.5)));
  chips = min(chips, sdBox(s - vec3(0.0, -4.0, -3.0), vec3(0.08, 0.4, 0.25)));
  d = U(d, vec2(chips - 0.012, 4.0));
  float cap = sdCyl(vec3(q.y + 3.8, q.x - 1.58, mod(q.z - 0.3, 0.95) - 0.475), 0.27, 0.14);
  cap = max(cap, abs(q.z + 1.2) - 5.4);
  float cap2 = sdCyl(vec3(q.y - 4.0 + 0.0, q.x - 1.6, q.z - 4.0), 0.4, 0.16);
  d = U(d, vec2(min(cap, cap2) - 0.01, 7.0));
  // header, jumper pins, power socket
  float hd = sdBox(q - vec3(1.8, -1.9, 7.0), vec3(0.45, 2.65, 0.9));
  hd = max(hd, -sdBox(q - vec3(2.3, -1.9, 7.0), vec3(0.3, 2.35, 0.6)));
  d = U(d, vec2(hd - 0.015, 4.0));
  d = U(d, vec2(sdBox(q - vec3(1.65, 1.8, 7.3), vec3(0.25, 0.5, 0.45)) - 0.01, 4.0));
  float pw = sdBox(q - vec3(1.8, 3.4, 7.0), vec3(0.45, 1.15, 0.9));
  pw = max(pw, -sdBox(q - vec3(2.3, 3.4, 7.0), vec3(0.3, 0.85, 0.6)));
  d = U(d, vec2(pw - 0.015, 6.0));
  // the cable's plug and the ribbon
  d = U(d, vec2(sdRound(q - vec3(1.88, -1.9, 8.5), vec3(0.5, 2.75, 0.65), 0.08), 5.0));
  float u = q.z - 9.15;
  float xr = 1.88 + (k - 0.5) * 0.5 * u * u;
  float rib = max(abs(q.x - xr) * 0.7 - 0.1, max(abs(q.y + 1.9) - 2.65, max(-u, u - 2.6)));
  d = U(d, vec2(rib, 5.0));
  return d;
}

float cellHash(float i, float t) { return fract(sin(i * 12.9898 + t * 78.233 + 3.1) * 43758.5453); }

vec2 drives(vec3 p, float yc, float tier) {
  float i0 = clamp(floor((p.x + 11.2) / PITCH), 0.0, 4.0);
  vec2 best = vec2(1e3, 3.0);
  for (int j = -1; j <= 1; j++) {
    float i = i0 + float(j);
    if (i < 0.0 || i > 4.0) continue;
    float xc = -11.2 + PITCH * (i + 0.5);
    best = U(best, drive(p - vec3(xc, yc, 0.0), cellHash(i, tier)));
  }
  return best;
}

vec2 map(vec3 p) {
  // baseplate, lower tier, shelf plate, upper tier
  float plate1 = sdRound(p - vec3(0.0, 0.16, 0.0), vec3(12.8, 0.16, 8.4), 0.05);
  float plate2 = sdRound(p - vec3(0.0, 12.0, 0.0), vec3(12.8, 0.16, 8.4), 0.05);
  float w1 = wallTier(p, Y1);
  float w2 = wallTier(p, Y2);
  float st = min(studs(p, Y1, vec2(12.4, 8.0)), studs(p, Y2, vec2(12.4, 8.0)));
  st = min(st, studs(p, Y2 + 11.52, vec2(12.4, 8.0)));
  vec2 d = vec2(min(min(plate1, plate2), st), 9.0);
  d = U(d, vec2(min(w1, w2), 1.0));
  // stud caps over the walls belong to the bricks
  if (p.y > Y2 + 11.4 && st < 0.02) d.y = 1.0;
  d = U(d, drives(p, Y1 + 0.17 + DRV_Y + 0.0, 0.0));
  d = U(d, drives(p, Y2 + 0.17 + DRV_Y, 1.0));
  return d;
}

/* ---- materials ---- */
vec3 brickCol(float h) {
  vec3 c = hex(0xc4161c);
  if (h > 0.16) c = hex(0x0e5cb5);
  if (h > 0.34) c = hex(0xf1c10a);
  if (h > 0.52) c = hex(0x1c9a46);
  if (h > 0.68) c = hex(0xeceae2);
  if (h > 0.82) c = hex(0xee7410);
  return c;
}

Mat material(float id, vec3 p, vec3 n) {
  if (id == 1.0 || id == 9.0) {
    float tier = p.y > 12.0 ? 1.0 : 0.0;
    float y0 = tier > 0.5 ? Y2 : Y1;
    Mat m;
    if (id == 9.0 && p.y < Y2 + 11.3) {
      // plates and the studs on them: light bluish grey
      m = mat(hex(0x8e9398) * (0.92 + 0.08 * noise(p * 3.0)), 0.34, 0.0);
    } else {
      float yy = clamp(p.y - y0, 0.01, 11.5);
      float c = floor(yy / BRICK_H);
      bool side = abs(p.x) > 11.15;
      float u = side ? p.z : p.x;
      float ix = floor((u + mod(c, 2.0) * 1.6 + 16.0) / 3.2);
      float h = fract(sin(dot(vec3(c, ix, (side ? (p.x > 0.0 ? 1.0 : 2.0) : 3.0) + tier * 7.0), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
      vec3 col = brickCol(h) * (0.94 + 0.1 * noise(vec3(c, ix, tier) * 3.7));
      m = mat(col, 0.3, 0.0);
    }
    // handling: fine scratches, dust in the lows, a little scuffed gloss
    float sc = noise(p * vec3(30.0, 30.0, 30.0));
    m.rough += 0.1 * smoothstep(0.55, 0.85, sc) + 0.06 * noise(p * 5.0);
    m.alb = mix(m.alb, vec3(0.5), smoothstep(0.78, 0.95, fbm(p * 3.0)) * 0.12);
    return m;
  }
  if (id == 2.0) {
    // Green solder mask over copper: darker, glossy, lighter where tracks run.
    float tr = smoothstep(0.42, 0.5, abs(noise(vec2(p.y * 6.0, p.z * 1.5)) - 0.5) * 0.0 + noise(vec2(p.y * 3.2, p.z * 14.0)));
    vec3 c = mix(hex(0x105c2b), hex(0x2a9a4c), tr * 0.55 + 0.15 * noise(p * 9.0));
    float pad = smoothstep(0.93, 0.97, noise(p.yz * 4.3));
    c = mix(c, hex(0xb28a3c), pad * 0.8);
    float sil = smoothstep(0.7, 0.75, noise(p.yz * 6.0 + 9.0)) * step(0.5, fbm(p.yz * 2.0));
    c = mix(c, hex(0xd8d6c4), sil * 0.5);
    Mat m = mat(c, 0.38 - 0.12 * pad, pad * 0.6);
    return m;
  }
  if (id == 3.0) {
    // Cast aluminium, bead-blasted, with a darker edge from handling.
    float g = noise(p * vec3(40.0, 40.0, 40.0));
    Mat m = mat(hex(0xd0d4d8) * (0.85 + 0.2 * g), 0.4 + 0.12 * g, 1.0);
    m.alb = mix(m.alb, hex(0x6c7075), smoothstep(0.5, 0.8, fbm(p * 2.5)) * 0.3);
    return m;
  }
  if (id == 4.0) return mat(hex(0x0d0e10) * (0.9 + 0.5 * noise(p * 30.0)), 0.34, 0.0);
  if (id == 5.0) {
    // Grey ribbon: a stripe of red on the first wire, faint ribbing.
    float rib = 0.5 + 0.5 * sin(p.y * 12.0);
    vec3 c = hex(0xa6a8ac) * (0.94 + 0.06 * rib);
    c = mix(c, hex(0xa02a2a), smoothstep(0.1, 0.0, abs(p.y - floor(p.y / 0.1) * 0.1)) * 0.0);
    return mat(c, 0.5, 0.0);
  }
  if (id == 6.0) return mat(hex(0xe6e3d4), 0.4, 0.0);
  // capacitors, brown-gold electrolytic
  return mat(hex(0x7a5a2c) * (0.8 + 0.4 * noise(p * 20.0)), 0.3, 0.55);
}
