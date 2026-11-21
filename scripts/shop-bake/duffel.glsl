/* Product: the Weekender duffel (NIMBUS, Dark Patterns).
 *
 * A waxed-canvas holdall in deep slate, with dark brown bridle-leather end
 * panels, base and handles, and brass at the zip and the strap rings. The
 * canvas is soft: it slumps a little on the sweep and creases across the
 * middle. Units: 1 is 10 cm.
 */
#define BOUND vec3(2.55, 1.55, 1.25)
#define CENTRE vec3(0.0, 1.55, 0.0)
#define VIEW_YAW 0.5
#define VIEW_PITCH 0.24
#define FILL 0.84
#define STEP 0.7

float rrect(vec2 p, vec2 b, float r) { vec2 d = abs(p) - b + r; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r; }

/* The body: a loaf in section, wider at the base, rounded at the ends. */
float body(vec3 p) {
  float sag = 0.06 * smoothstep(2.4, 0.0, abs(p.x));
  vec2 s = vec2(p.z * (1.0 + 0.12 * smoothstep(0.4, 1.2, p.y)), p.y - 1.05 + sag);
  float sec = rrect(s, vec2(1.05, 1.0), 0.62);
  float d = smax(sec, abs(p.x) - 2.4, 0.18);
  // Creases across the middle where the canvas gives.
  d += 0.008 * sin(p.x * 7.0 + 2.0 * noise(p * 2.0)) * smoothstep(1.6, 0.0, abs(p.x)) * smoothstep(0.3, 1.2, p.y);
  return d;
}

vec2 map(vec3 p) {
  float b = body(p);
  vec2 d = vec2(b, 1.0);
  // Leather: the end panels and the base, a hair proud of the canvas.
  float skin = b - 0.012;
  float leather = min(max(skin, 2.18 - abs(p.x)), max(skin, p.y - 0.32));
  d = U(d, vec2(leather, 2.0));
  // The handles: two leather loops over the top, and their straps sewn
  // down the sides.
  vec3 h = vec3(abs(p.x) - 0.62, p.y - 2.05, p.z);
  float loop = max(rrect(vec2(length(h.yz * vec2(1.0, 1.25)) - 0.56, h.x), vec2(0.035, 0.07), 0.02), -h.y + 0.02);
  float strap = max(abs(h.x) - 0.07, max(abs(b) - 0.02, max(p.y - 2.08, 0.45 - p.y)));
  d = U(d, vec2(min(loop, strap), 2.0));
  // The zip along the top, and its brass puller.
  float zip = max(sdBox(vec3(p.x, p.y - 2.05, p.z), vec3(1.95, 0.02, 0.025)), b - 0.02);
  d = U(d, vec2(zip, 3.0));
  d = U(d, vec2(sdRound(p - vec3(1.62, 2.07, 0.07), vec3(0.06, 0.012, 0.11), 0.01), 3.0));
  // Brass D-rings at each end for a shoulder strap.
  vec3 r = vec3(abs(p.x) - 2.43, p.y - 1.55, p.z);
  d = U(d, vec2(length(vec2(length(r.yz * vec2(1.0, 0.9)) - 0.12, r.x)) - 0.022, 3.0));
  return d;
}

Mat material(float id, vec3 p, vec3 n) {
  if (id == 1.0) {
    // Waxed canvas: a tight weave, the wax darker where it has been handled.
    float weave = 0.5 + 0.25 * (sin(p.x * 260.0) + sin(p.y * 260.0 + p.z * 260.0));
    float wax = fbm(p * 3.0);
    vec3 c = mix(hex(0x23282c), hex(0x2f353a), wax) * (0.9 + 0.12 * weave);
    return mat(c, 0.78 - 0.12 * wax, 0.0);
  }
  if (id == 2.0) return mat(mix(hex(0x24160f), hex(0x3a2618), fbm(p * 30.0)), 0.44, 0.0);
  return mat(hex(0xc9a76b), 0.25, 1.0);
}
