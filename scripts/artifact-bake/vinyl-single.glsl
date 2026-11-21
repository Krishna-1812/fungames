/* May 15, 2007: the first Rickroll.
 *
 * A 7 inch, 45 rpm single half out of its plain paper sleeve: black vinyl
 * 17.8 cm across with the big centre hole, a flat-coloured generic label
 * (vinyl-single.svg: SIDE A, 45 RPM, 1987) and a band of fine grooves that
 * catch the key light in rings, with the smooth gaps between tracks. The
 * sleeve is thin cream card, a round window cut through its front, the record
 * drawn out of the open end; a faint ring of wear shows where the disc has
 * pressed the paper. Units: 1 is 1 cm.
 */
#define BOUND vec3(13.65, 0.13, 9.4)
#define CENTRE vec3(4.35, 0.13, 0.0)
#define VIEW_YAW 0.22
#define VIEW_PITCH 0.92
#define FILL 0.68
#define EXPOSURE 1.1
#define COAT(id) (id == 1.0 ? 0.55 : 0.0)
#define SHEEN(id) (id == 2.0 ? 0.2 : 0.0)

const vec2 RC = vec2(9.0, 0.0);    // the record's centre
const float RR = 8.89;             // its radius
const float SH = 9.2;              // the sleeve's half-size
const float WIN = 4.4;             // the window's radius

float sleeveFront(vec3 p) {
  float dist = length(p.xz - RC);
  float y = 0.065 + 0.125 * smoothstep(10.3, 8.5, dist);
  float rect = max(abs(p.z) - SH, max(-SH - p.x, p.x - SH));
  float slab = max(abs(p.y - y) - 0.016, rect);
  float win = WIN - length(p.xz);
  return smax(slab, win, 0.03);
}

vec2 map(vec3 p) {
  // The record: a disc with a rolled edge, the big hole, grooves in a band.
  vec2 q = p.xz - RC;
  float r = length(q);
  float disc = sdCyl(vec3(q.x, p.y - 0.095, q.y), RR - 0.03, 0.057) - 0.03;
  float band = smoothstep(4.95, 5.1, r) * smoothstep(8.75, 8.6, r);
  float gap = smoothstep(0.05, 0.0, abs(r - 6.1) - 0.09) + smoothstep(0.05, 0.0, abs(r - 7.35) - 0.09);
  disc += band * (1.0 - gap) * 0.0065 * sin(r * 39.0) * step(0.1, p.y);
  disc = smax(disc, 1.9 - r, 0.04);
  vec2 d = vec2(disc * 0.8, 1.0);
  // The sleeve: front with its window, back, and the three glued edges.
  float front = sleeveFront(p);
  float back = max(abs(p.y - 0.015) - 0.015, max(abs(p.z) - SH, max(-SH - p.x, p.x - SH)));
  float e1 = sdBox(p - vec3(-SH + 0.1, 0.045, 0.0), vec3(0.1, 0.045, SH));
  float e2 = sdBox(p - vec3(0.0, 0.045, SH - 0.1), vec3(SH, 0.045, 0.1));
  float e3 = sdBox(p - vec3(0.0, 0.045, -SH + 0.1), vec3(SH, 0.045, 0.1));
  float sl = min(min(front, back), min(e1, min(e2, e3)));
  d = U(d, vec2(sl * 0.9, 2.0));
  return d;
}

Mat material(float id, vec3 p, vec3 n) {
  if (id == 2.0) {
    // Card stock, cream-grey, ring wear where the disc has pressed.
    float dist = length(p.xz - RC);
    float ring = smoothstep(0.3, 0.0, abs(dist - 8.95)) * 0.22 + smoothstep(0.5, 0.0, abs(dist - 8.4)) * 0.06;
    vec3 c = hex(0xcdc4ac) * (0.92 + 0.12 * fbm(p * 5.0));
    c = mix(c, hex(0xe2dac4), ring);
    float grime = smoothstep(0.5, 0.9, fbm(p * 1.3));
    c *= 1.0 - 0.1 * grime;
    c *= 1.0 - 0.1 * smoothstep(7.0, 9.2, max(abs(p.x), abs(p.z))) * noise(p * 6.0);
    float fib = noise(vec3(p.x * 50.0, p.y * 4.0, p.z * 50.0));
    Mat m = mat(c * (0.7 + 0.08 * fib), 0.9, 0.0);
    m.sss = 0.2;
    return m;
  }
  vec2 q = p.xz - RC;
  float r = length(q);
  if (r < 4.6 && n.y > 0.5 && p.y > 0.12) {
    vec2 uv = vec2(0.5 + q.y / 9.2, 0.5 + q.x / 9.2);
    vec3 c = pow(texture(u_tex, clamp(uv, 0.0, 1.0)).rgb, vec3(2.2));
    return mat(c * 0.8, 0.6, 0.0);
  }
  // Vinyl: near black, polished smooth between the tracks and at the lead-in.
  float gap = smoothstep(0.05, 0.0, abs(r - 6.1) - 0.09) + smoothstep(0.05, 0.0, abs(r - 7.35) - 0.09)
            + smoothstep(8.55, 8.8, r) + smoothstep(5.1, 4.95, r);
  float scratch = smoothstep(0.88, 0.97, noise(vec2(r * 38.0, atan(q.y, q.x) * 6.0)));
  float rough = mix(0.15, 0.07, clamp(gap, 0.0, 1.0)) + 0.1 * scratch;
  return mat(hex(0x0a0a0c) * (1.0 + 2.0 * scratch), rough, 0.0);
}
