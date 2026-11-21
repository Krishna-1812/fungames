/* April 23, 2005: the first YouTube video.
 *
 * "Me at the zoo" was shot on a small digital camera like this one: a 5
 * megapixel compact of 2005 in anodised silver aluminium, brushed along its
 * width, with a black plastic base. The three-stage zoom lens is out and
 * ready: a chrome collar, a silver stage, a black one, a silver one, and in
 * the bore a clear front glass over a coated element that throws violet and
 * green, and a dark element deeper still. On the front, a viewfinder window
 * and flash window (a frosted fresnel), the AF lamp and a few lines of print
 * (digital-camera.svg). On top a shutter button and the
 * power button. Generic; no maker's mark. Units: 1 is 1 cm.
 */
#define BOUND vec3(4.9, 3.15, 2.5)
#define CENTRE vec3(0.0, 3.15, 1.18)
#define VIEW_YAW 0.52
#define VIEW_PITCH 0.2
#define FILL 0.9
#define EXPOSURE 1.2
#define GLASS 2.0
#define GLASS_TINT vec3(0.96, 0.98, 0.98)
#define COAT(id) (id == 7.0 ? 0.6 : id == 3.0 ? 0.3 : 0.0)
#define SHEEN(id) (id == 1.0 ? 0.15 : 0.0)

const vec3 LC = vec3(-1.5, 3.35, 0.0);     // the lens's axis, along +z

float rrect(vec2 p, vec2 c, vec2 h, float r) {
  vec2 d = abs(p - c) - (h - r);
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;
}

vec3 iaView() { return vec3(sin(VIEW_YAW) * cos(VIEW_PITCH), sin(VIEW_PITCH), cos(VIEW_YAW) * cos(VIEW_PITCH)); }

/* A tube round the lens axis: outer radius, inner radius, from z0 to z1. */
float tube(vec3 l, float ro, float ri, float z0, float z1) {
  vec3 q = vec3(l.x, l.z - (z0 + z1) * 0.5, l.y);
  return max(sdCyl(q, ro, (z1 - z0) * 0.5), -(length(l.xy) - ri));
}

vec2 lens(vec3 l) {
  vec2 d = vec2(1e3, 1.0);
  // the collar on the face
  float collar = tube(l, 1.98, 1.58, 1.1, 1.42) - 0.03;
  d = U(d, vec2(collar, 4.0));
  // three stages, each stepping in: silver, black, silver
  float s1 = tube(l, 1.58, 1.4, 1.2, 2.15) - 0.015;
  float s2 = tube(l, 1.37, 1.2, 2.1, 2.95) - 0.015;
  float s3 = tube(l, 1.15, 0.98, 2.9, 3.65) - 0.015;
  d = U(d, vec2(s1, 1.0));
  d = U(d, vec2(s2, 3.0));
  d = U(d, vec2(s3, 1.0));
  // chrome lips where each stage ends
  d = U(d, vec2(sdTorus(vec3(l.x, l.z - 2.15, l.y), 1.49, 0.045), 4.0));
  d = U(d, vec2(sdTorus(vec3(l.x, l.z - 2.95, l.y), 1.285, 0.045), 4.0));
  d = U(d, vec2(sdTorus(vec3(l.x, l.z - 3.62, l.y), 1.07, 0.05), 4.0));
  // the black throat behind the glass
  d = U(d, vec2(sdCyl(vec3(l.x, l.z - 1.3, l.y), 1.0, 0.03), 5.0));
  // the elements: clear front, coated second, a dark third
  float front = max(length(l - vec3(0.0, 0.0, 1.22)) - 1.93, 2.9 - l.z);
  front = max(front, length(l.xy) - 0.97);
  d = U(d, vec2(front, GLASS));
  float second = max(length(l - vec3(0.0, 0.0, 0.7)) - 1.745, 2.2 - l.z);
  second = max(second, length(l.xy) - 0.9);
  d = U(d, vec2(second, 6.0));
  float third = max(length(l - vec3(0.0, 0.0, 0.52)) - 1.3, 1.65 - l.z);
  third = max(third, length(l.xy) - 0.72);
  d = U(d, vec2(third, 8.0));
  // a thin coated rim on the front glass
  d = U(d, vec2(sdTorus(vec3(l.x, l.z - 2.92, l.y), 0.95, 0.03), 9.0));
  return d;
}

vec2 map(vec3 p) {
  // the body: a rounded slab, the base a separate black plastic band
  float body = sdRound(p - vec3(0.0, 3.0, 0.0), vec3(4.75, 3.0, 1.2), 0.5);
  // the viewfinder window, the flash, the AF lamp sunk a little
  body = smax(body, -max(rrect(p.xy, vec2(0.6, 5.0), vec2(0.5, 0.3), 0.1), 1.17 - p.z), 0.01);
  body = smax(body, -max(rrect(p.xy, vec2(2.7, 4.95), vec2(1.0, 0.45), 0.12), 1.16 - p.z), 0.01);
  body = smax(body, -max(length(p.xy - vec2(3.95, 3.7)) - 0.26, 1.16 - p.z), 0.01);
  // the seam above the black base
  body += 0.012 * smoothstep(0.04, 0.0, abs(p.y - 0.55)) * smoothstep(0.0, 0.2, 1.2 - abs(p.z) + 0.0);
  vec2 d = vec2(body, 1.0);
  // viewfinder glass, flash window, AF lamp
  d = U(d, vec2(sdBox(p - vec3(0.6, 5.0, 1.12), vec3(0.45, 0.25, 0.04)), 7.0));
  d = U(d, vec2(sdBox(p - vec3(2.7, 4.95, 1.12), vec3(0.95, 0.4, 0.04)), 10.0));
  d = U(d, vec2(sdCyl(vec3(p.x - 3.95, p.z - 1.12, p.y - 3.7), 0.22, 0.04), 11.0));
  // the buttons on top: shutter, power
  float sh = sdRound(p - vec3(2.4, 6.05, 0.0), vec3(0.55, 0.12, 0.34), 0.1);
  d = U(d, vec2(sh, 4.0));
  d = U(d, vec2(sdCyl(p - vec3(3.65, 6.02, 0.1), 0.24, 0.07) - 0.03, 4.0));
  // the lens
  vec3 l = p - LC;
  float bl = sdBox(l - vec3(0.0, 0.0, 2.3), vec3(2.3, 2.3, 1.6));
  if (bl < 0.4) d = U(d, lens(l)); else d = U(d, vec2(bl, 1.0));
  return d;
}

Mat material(float id, vec3 p, vec3 n) {
  vec3 l = p - LC;
  if (id == 1.0) {
    // Anodised aluminium, brushed along its width; the base is black plastic.
    if (p.y < 0.55 && p.z < 1.9 && length(l.xy) > 2.0) return mat(hex(0x0e0f11) * (0.9 + 0.3 * noise(p * 30.0)), 0.42, 0.0);
    float br = noise(vec3(p.x * 2.5, p.y * 220.0, p.z * 2.5));
    float smudge = smoothstep(0.55, 0.9, fbm(p * 1.7));
    Mat m = mat(hex(0xb9bdc2) * (0.86 + 0.2 * br), 0.3 + 0.16 * smudge, 1.0);
    // The print: ink on the front only.
    if (n.z > 0.7 && p.z > 1.0) {
      vec2 uv = vec2((p.x + 4.75) / 9.5, p.y / 6.0);
      float ink = texture(u_tex, clamp(uv, 0.001, 0.999)).r;
      m.alb = mix(m.alb, vec3(0.04, 0.045, 0.05), ink * 0.85);
      m.metal = mix(m.metal, 0.0, ink);
      m.rough = mix(m.rough, 0.5, ink);
    }
    return m;
  }
  if (id == 3.0) {
    // Black anodised stage: dull, a little worn at the ends.
    return mat(hex(0x0f1012) * (0.9 + 0.3 * noise(p * 60.0)), 0.36, 0.5);
  }
  if (id == 4.0) return mat(hex(0xcfd2d6), 0.14 + 0.1 * noise(p * 40.0), 1.0);
  if (id == 5.0) return mat(vec3(0.004), 0.5, 0.0);
  if (id == 6.0) {
    // The coated element: dark glass, violet at the rim, green in the middle.
    vec3 v = iaView();
    float f = 1.0 - clamp(dot(n, v) * 0.5 + 0.5, 0.0, 1.0);
    float rr = length(l.xy);
    vec3 col = mix(vec3(0.02, 0.03, 0.09), vec3(0.07, 0.34, 0.2), smoothstep(0.1, 0.5, rr + f * 0.5));
    col = mix(col, vec3(0.5, 0.1, 0.75), smoothstep(0.5, 0.88, rr + f * 0.3));
    Mat m = mat(vec3(0.01, 0.012, 0.02), 0.08, 0.0);
    m.emit = col * 0.3;
    return m;
  }
  if (id == 7.0) return mat(hex(0x050608), 0.08, 0.0);
  if (id == 8.0) {
    Mat m = mat(vec3(0.01), 0.1, 0.0);
    m.emit = vec3(0.03, 0.06, 0.12) * (0.4 + 2.0 * smoothstep(0.7, 0.2, length(l.xy)));
    return m;
  }
  if (id == 9.0) { Mat m = mat(vec3(0.02), 0.2, 0.0); m.emit = vec3(0.5, 0.15, 0.8) * 0.2; return m; }
  if (id == 10.0) {
    // Frosted fresnel: a fine ridged milk-white plastic, a little lit from behind.
    float rid = 0.5 + 0.5 * sin(p.x * 70.0);
    Mat m = mat(vec3(0.4, 0.38, 0.32) * (0.8 + 0.25 * rid), 0.5, 0.0);
    m.sss = 0.6;
    m.emit = vec3(0.012, 0.01, 0.006);
    return m;
  }
  // AF lamp: dark red glass
  Mat m = mat(vec3(0.05, 0.005, 0.005), 0.1, 0.0);
  m.emit = vec3(0.04, 0.0, 0.0);
  return m;
}
