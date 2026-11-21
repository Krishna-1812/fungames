/* June 1, 1999: Napster launches.
 *
 * A flash MP3 player of 1998: nothing but a slab of smoked-black plastic that
 * held a few songs in a few megabytes, a grey monochrome LCD under a clear
 * window showing a track number and the time, a cross of rubber buttons, three
 * small pills, a volume wheel on the right edge and the headphone socket on
 * the left, into which its wired earbuds are plugged, the cable coiled loose
 * beside it. Generic: the face print is mp3-player.svg (113.8 px to the cm),
 * a made-up model number and no maker. Units: 1 is 1 cm.
 */
#define BOUND vec3(7.4, 0.95, 4.9)
#define CENTRE vec3(-0.95, 0.95, 0.85)
#define VIEW_YAW 0.22
#define VIEW_PITCH 0.82
#define FILL 0.78
#define EXPOSURE 1.25
#define GLASS 1.0
#define GLASS_TINT vec3(0.97, 0.99, 0.98)
#define COAT(id) (id == 2.0 ? 0.8 : id == 3.0 ? 0.25 : id == 7.0 ? 0.4 : 0.0)
#define SHEEN(id) (id == 2.0 ? 0.5 : id == 8.0 ? 0.5 : 0.0)

const vec2 PP = vec2(1.4, 0.2);              // where the player lies
const float PC = 0.9759, PS = 0.2182;       // and how it is turned (12.6 degrees)

/* The player's frame: x across its face, y up, z down the face. */
vec3 loc(vec3 p) {
  vec2 d = p.xz - PP;
  return vec3(PC * d.x + PS * d.y, p.y, -PS * d.x + PC * d.y);
}
vec3 wld(vec3 q) { return vec3(PP.x + PC * q.x - PS * q.z, q.y, PP.y + PS * q.x + PC * q.z); }

float rrect(vec2 p, vec2 c, vec2 h, float r) {
  vec2 d = abs(p - c) - (h - r);
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;
}

/* The cross of buttons and the pills, 2D. */
float buttons2D(vec2 p) {
  float b = length(p - vec2(2.65, -0.5)) - 0.55;
  b = min(b, rrect(p, vec2(1.55, -0.5), vec2(0.33, 0.4), 0.14));
  b = min(b, rrect(p, vec2(3.75, -0.5), vec2(0.33, 0.4), 0.14));
  b = min(b, rrect(p, vec2(2.65, 0.75), vec2(0.5, 0.26), 0.2));
  b = min(b, rrect(p, vec2(-3.0, 2.15), vec2(0.45, 0.22), 0.2));
  b = min(b, rrect(p, vec2(-1.5, 2.15), vec2(0.45, 0.22), 0.2));
  b = min(b, rrect(p, vec2(0.0, 2.15), vec2(0.45, 0.22), 0.2));
  return b;
}

float shell(vec3 q) {
  vec2 c = abs(q.xz) - vec2(4.5 - 0.95, 3.1 - 0.95);
  float d2 = length(max(c, 0.0)) + min(max(c.x, c.y), 0.0) - 0.95;
  vec2 w = vec2(d2 + 0.32, abs(q.y - 0.8) - 0.8 + 0.32);
  return min(max(w.x, w.y), 0.0) + length(max(w, 0.0)) - 0.32;
}

vec2 player(vec3 q) {
  float d = shell(q);
  // the parting line round the middle
  d += 0.012 * smoothstep(0.03, 0.0, abs(q.y - 0.78)) * smoothstep(0.1, 0.6, d + 0.5);
  // the window's recess, the LCD under it
  vec2 lc = vec2(-1.4, -0.5);
  d = smax(d, -max(rrect(q.xz, lc, vec2(2.5, 1.4), 0.18), q.y - 1.3), 0.03);
  // holes round the buttons
  float b2 = buttons2D(q.xz);
  d = smax(d, -max(b2 - 0.055, q.y - 1.34), 0.015);
  // the socket on the left edge, the wheel's slot on the right
  d = smax(d, -max(length(q.yz - vec2(0.8, 1.0)) - 0.19, q.x + 3.3), 0.02);
  d = smax(d, -sdBox(q - vec3(4.3, 0.8, -1.2), vec3(0.45, 0.62, 0.28)), 0.02);
  vec2 r = vec2(d, 2.0);
  // buttons
  vec2 bq = vec2(b2 + 0.1, abs(q.y - 1.56) - 0.16 + 0.1);
  float btn = min(max(bq.x, bq.y), 0.0) + length(max(bq, 0.0)) - 0.1;
  r = U(r, vec2(btn, 3.0));
  // the LCD itself and the window over it
  r = U(r, vec2(sdBox(q - vec3(lc.x, 1.33, lc.y), vec3(2.4, 0.03, 1.35)), 4.0));
  r = U(r, vec2(sdRound(q - vec3(lc.x, 1.46, lc.y), vec3(2.47, 0.06, 1.37), 0.03), 1.0));
  // the chrome ring at the socket
  r = U(r, vec2(max(abs(length(q.yz - vec2(0.8, 1.0)) - 0.29) - 0.06, abs(q.x + 4.52) - 0.04), 5.0));
  // the volume wheel
  float wheel = sdCyl(vec3(q.x - 4.1, q.z + 1.2, q.y - 0.8), 0.58, 0.22) - 0.03;
  r = U(r, vec2(wheel, 9.0));
  return r;
}

float cable(vec3 p, vec3 a, vec3 b) { return sdCapsule(p, a, b, 0.095); }

vec2 map(vec3 p) {
  vec3 q = loc(p);
  float bd = sdBox(q - vec3(0.0, 0.9, 0.0), vec3(5.0, 1.0, 3.5));
  vec2 d = bd < 0.6 ? player(q) : vec2(bd + 0.4, 2.0);
  // the plug in the socket: a chrome pin, a black moulded body
  vec3 pl = q - vec3(-4.5, 0.8, 1.0);
  float pin = sdCapsule(pl, vec3(0.15, 0.0, 0.0), vec3(-0.75, 0.0, 0.0), 0.075);
  float pbody = sdRound(pl - vec3(-1.5, 0.0, 0.0), vec3(0.7, 0.26, 0.26), 0.12);
  d = U(d, vec2(pin, 5.0));
  d = U(d, vec2(pbody, 6.0));
  // the cable from the plug round to the coil, the tail, the Y, the two buds
  vec3 A = wld(vec3(-5.9, 0.8, 1.0));
  vec3 q1 = vec3(A.x - 0.5, 0.45, A.z - 0.05);
  vec3 q2 = vec3(-6.0, 0.085, 0.45);
  float c = cable(p, A, q1);
  c = min(c, cable(p, q1, q2));
  // the coil: three loose turns, a little offset each
  vec3 cc = vec3(-6.35, 0.0, 2.15);
  vec3 pc = p - cc;
  pc.x *= 1.0 - 0.05;
  c = min(c, sdTorus(pc - vec3(0.0, 0.085, 0.0), 1.75, 0.085));
  c = min(c, sdTorus((pc - vec3(0.12, 0.26, -0.05)) * vec3(1.03, 1.0, 0.97), 1.62, 0.085) * 0.9);
  c = min(c, sdTorus((pc - vec3(-0.1, 0.43, 0.08)) * vec3(0.97, 1.0, 1.04), 1.48, 0.085) * 0.9);
  // the tail leaves the coil at the front right, to the Y
  vec3 t0 = vec3(-4.75, 0.085, 2.85), t1 = vec3(-4.0, 0.085, 3.55), t2 = vec3(-3.45, 0.14, 4.1);
  c = min(c, cable(p, t0, t1));
  c = min(c, cable(p, t1, t2));
  c = min(c, sdCapsule(p, vec3(-3.45, 0.16, 4.1), vec3(-3.4, 0.16, 4.35), 0.15));
  vec3 la = vec3(-3.9, 0.085, 4.8), ra = vec3(-2.75, 0.085, 4.85);
  c = min(c, cable(p, vec3(-3.4, 0.14, 4.3), la));
  c = min(c, cable(p, vec3(-3.4, 0.14, 4.3), ra));
  d = U(d, vec2(c, 6.0));
  // the buds: dark plastic, a charcoal foam over the front
  float bud = sdEllipsoid(p - vec3(-4.15, 0.3, 5.15), vec3(0.34, 0.3, 0.5));
  bud = min(bud, sdEllipsoid(p - vec3(-2.5, 0.3, 5.2), vec3(0.34, 0.3, 0.5)));
  d = U(d, vec2(bud, 7.0));
  float foam = sdSphere(p - vec3(-4.3, 0.29, 5.62), 0.34);
  foam = min(foam, sdSphere(p - vec3(-2.35, 0.29, 5.67), 0.34));
  d = U(d, vec2(foam, 8.0));
  return d;
}

Mat material(float id, vec3 p, vec3 n) {
  vec3 q = loc(p);
  vec2 uv = vec2((q.x + 4.5) / 9.0, 1.0 - (q.z + 3.1) / 6.2);
  vec3 tex = pow(texture(u_tex, clamp(uv, 0.001, 0.999)).rgb, vec3(2.2));
  if (id == 2.0) {
    // Smoked polycarbonate: nearly black, blue-grey in the thin edges, with the
    // oils of a hand and a little dust on the face.
    float face = smoothstep(0.7, 0.95, n.y);
    float grease = smoothstep(0.5, 0.9, fbm(vec3(p.xz * 0.9, 2.0)));
    vec3 c = mix(hex(0x090a0d), hex(0x12151b), 1.0 - face);
    c += tex * 0.55 * face;
    Mat m = mat(c, 0.2 + 0.25 * grease * face + 0.03 * noise(p * 40.0), 0.0);
    m.sss = 0.3 * (1.0 - face);
    return m;
  }
  if (id == 3.0) {
    // Rubber-coated keys, a little lighter, with the symbol printed on.
    vec3 c = hex(0x24272c) + tex * 0.6;
    return mat(c, 0.55 + 0.1 * noise(p * 30.0), 0.0);
  }
  if (id == 4.0) {
    // The LCD: pale grey-green, a pixel grid at about 0.05 cm.
    vec2 g = fract(q.xz / 0.05);
    float grid = (smoothstep(0.0, 0.14, g.x) * smoothstep(0.0, 0.14, g.y)) * 0.12 + 0.88;
    vec3 c = tex * grid;
    Mat m = mat(c * 0.72, 0.35, 0.0);
    m.emit = c * 0.07;
    return m;
  }
  if (id == 5.0) return mat(hex(0xc5c8cc), 0.18, 1.0);
  if (id == 6.0) {
    // Black PVC cable and plug moulding.
    return mat(hex(0x0a0b0c) * (0.9 + 0.3 * noise(p * 22.0)), 0.5, 0.0);
  }
  if (id == 7.0) return mat(hex(0x2a2c30), 0.4, 0.0);
  if (id == 8.0) {
    // Foam: charcoal, dull, fuzzy at the edge.
    Mat m = mat(hex(0x1d1e21) * (0.8 + 0.6 * noise(p * 55.0)), 0.95, 0.0);
    m.sss = 0.3;
    return m;
  }
  // the volume wheel: ribbed grey rubber
  float a = atan(p.y - 0.8, q.x - 4.1);
  float rib = 0.5 + 0.5 * sin(a * 30.0);
  return mat(hex(0x34373c) * (0.7 + 0.5 * rib), 0.55, 0.0);
}
