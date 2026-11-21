/* January 1, 1983: ARPANET's flag day.
 *
 * The badge people wore afterwards: a 2 1/4 inch pin-back button lying face
 * up, its printed paper face under a clear mylar skin, crimped round a tin
 * shell whose rolled edge catches the light. The face is tcp-button.svg; the
 * ring of it wraps over the rim the way a real button's artwork does, so the
 * print runs right round the edge. A little dust, a faint scuff across the
 * mylar. Units: 1 is 1 cm.
 */
#define BOUND vec3(2.95, 0.55, 2.95)
#define CENTRE vec3(0.0, 0.55, 0.0)
#define VIEW_YAW 0.18
#define VIEW_PITCH 0.82
#define FILL 0.8
#define COAT(id) (id == 1.0 ? 1.0 : 0.0)
#define EXPOSURE 1.0

const float R = 2.86;    // the button's radius
const float H = 0.46;    // its height at the middle

/* The dome: a shallow spherical cap that rolls over at the rim. */
float dome(vec3 p) {
  float r = length(p.xz);
  float rc = min(r, R);
  float top = H - 0.16 * (rc * rc) / (R * R);
  float side = r - R;
  return smax(side, (p.y - top) * 0.96, 0.32);
}

vec2 map(vec3 p) {
  float d = smax(dome(p), -p.y, 0.02);
  return vec2(d, 1.0);
}

Mat material(float id, vec3 p, vec3 n) {
  // The print, mapped straight down: the face, then the ring over the rim.
  float r = length(p.xz);
  vec2 dir = p.xz / max(r, 1e-4);
  // Over the rim the paper keeps going: push the ring outward as it turns down.
  float rr = r + max(0.0, H * 0.6 - p.y) * smoothstep(R - 0.5, R, r) * 0.9;
  vec2 q = dir * rr / (R + 0.42);
  vec2 uv = vec2(q.x, -q.y) * 0.5 + 0.5;
  vec3 c = texture(u_tex, uv).rgb;
  c = pow(c, vec3(2.2));
  // A little dust and a faint scuff in the mylar.
  float dust = smoothstep(0.86, 0.93, noise(p * 26.0)) * 0.12;
  c = mix(c, vec3(0.6), dust);
  Mat m = mat(c * 0.8, 0.32, 0.0);
  return m;
}
