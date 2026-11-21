/* Lot: portrait of a gentleman who is not enjoying it.
 *
 * Oil on canvas, 30 x 25 inches, 1843, relined, in a later ebonised frame:
 * a deep moulding with a ripple-turned torus, carved leaf clasps at the
 * corners and a narrow tarnished silver slip, the whole leaning back a few
 * degrees on the sweep. The picture itself is portrait.png (colour on the
 * left half, the paint's relief on the right), painted offline; here it gets
 * its canvas weave, its impasto, a yellowed varnish and the craquelure of
 * one hundred and eighty years. Units: metres.
 */
#define BOUND vec3(0.445, 0.51, 0.11)
#define CENTRE vec3(0.0, 0.51, -0.03)
#define VIEW_YAW 0.30
#define VIEW_PITCH 0.10
#define FILL 0.84
#define STEP 0.7
#define COAT(id) ((id) == 3.0 ? 0.35 : ((id) == 1.0 ? 0.3 : 0.0))

const vec2 SIGHT = vec2(0.311, 0.375);   // half the opening inside the slip
const vec2 CANVAS = vec2(0.3175, 0.381); // half the canvas
const float LEAN = 0.10;                 // radians back from upright
const float MW = 0.13;                   // the moulding's width, slip included

/* World to the frame's own frame: origin at the picture's centre, z out of
   the picture. The frame rests on the back of its bottom rail. */
vec3 toFrame(vec3 p) {
  float c = cos(LEAN), s = sin(LEAN);
  float ty = (SIGHT.y + MW) * c + 0.02 * s;
  vec3 q = p - vec3(0.0, ty, 0.0);
  return vec3(q.x, q.y * c - q.z * s, q.y * s + q.z * c);
}

/* The moulding's cross-section: u outwards from the sight edge, z up off the
   picture plane. Slip, sight cove, ogee, rippled torus, scotia, a reeded
   flat and the outer bead. Returns distance and 1 for wood, 2 for the slip. */
vec2 profile(float u, float z) {
  vec2 q = vec2(u, z);
  // The silver slip: a bevel falling to the picture.
  float slip = max(max(-u, u - 0.022), max(-z - 0.004, (z - 0.004 - u * 0.32) * 0.95));
  slip = min(slip, length(q - vec2(0.0205, 0.0115)) - 0.0028);
  // The wood.
  float base = max(max(0.0205 - u, u - MW), max(-z - 0.022, z - 0.024));
  float ogee = length(q - vec2(0.046, 0.016)) - 0.022;
  ogee = max(ogee, -(length(q - vec2(0.026, 0.040)) - 0.012));
  float torus = length(q - vec2(0.071, 0.040)) - 0.0145;
  float flat_ = max(max(0.086 - u, u - 0.118), max(-z, z - 0.033));
  flat_ = max(flat_, -(length(q - vec2(0.097, 0.041)) - 0.0105));
  // Reeds along the flat.
  flat_ += 0.0005 * smoothstep(0.104, 0.107, u) * (0.5 + 0.5 * cos(u * TAU / 0.0035));
  float bead = length(q - vec2(0.121, 0.030)) - 0.0085;
  float wood = min(min(base, ogee), min(torus, min(flat_, bead)));
  wood = max(wood, u - MW);
  return wood < slip ? vec2(wood, 1.0) : vec2(slip, 2.0);
}

/* The picture's surface relief, in metres: impasto from the painted strokes,
   the weave, the cracks. */
vec2 picUV(vec3 f) { return (f.xy + CANVAS) / (2.0 * CANVAS); }

float weave(vec2 p) {
  vec2 t = p / 0.00085;
  float wx = sin(t.x * PI) * 0.5 + 0.5, wy = sin(t.y * PI) * 0.5 + 0.5;
  float over = step(0.5, fract(floor(t.x) * 0.5 + floor(t.y) * 0.5));
  return mix(wx * (0.6 + 0.4 * sin(t.y * TAU)), wy * (0.6 + 0.4 * sin(t.x * TAU)), over);
}

float crack(vec2 p) {
  // A network of cells a centimetre or two across, with a finer one inside.
  vec3 v = voronoi(p * 105.0 + 0.15 * vec2(fbm(p * 200.0), fbm(p * 200.0 + 7.0)));
  float c = smoothstep(0.035, 0.0, v.y - v.x) * (0.55 + 0.45 * noise(p * 60.0));
  vec3 w = voronoi(p * 190.0 + 3.0);
  c = max(c, 0.5 * smoothstep(0.03, 0.0, w.y - w.x) * step(0.55, noise(p * 40.0)));
  return c;
}

float relief(vec3 f) {
  vec2 uv = picUV(f);
  float h = textureLod(u_tex, vec2(uv.x * 0.5 + 0.5, uv.y), 0.0).r;
  return h * 0.00025 + weave(f.xy) * 0.00003 - crack(f.xy) * 0.00004;
}

vec2 map(vec3 p) {
  vec3 f = toFrame(p);
  vec2 a = abs(f.xy);
  float u = max(a.x - SIGHT.x, a.y - SIGHT.y);
  // Along the rail: y on the stiles, x on the top and bottom.
  float along = a.x - SIGHT.x > a.y - SIGHT.y ? f.y : f.x;
  vec2 pr = profile(u, f.z);
  // The torus is turned in ripples, as Dutch-revival ebonised frames are.
  float rip = smoothstep(0.056, 0.062, u) * smoothstep(0.086, 0.080, u);
  pr.x += rip * 0.0009 * sin(along * TAU / 0.0065 + 0.6 * sin(along * 40.0));
  vec2 r = pr;

  // Carved leaf clasps across the corners of the torus.
  vec2 cq = a - SIGHT;
  vec2 dg = vec2(0.70710678);
  float s = dot(cq - vec2(0.071), dg), t = dot(cq - vec2(0.071), vec2(-dg.y, dg.x));
  float leaf = sdEllipsoid(vec3(s - 0.004, t, f.z - 0.046), vec3(0.030, 0.012, 0.012));
  for (int k = -1; k <= 1; k += 2) {
    float fk = float(k);
    vec2 lq = rot(fk * 0.75) * vec2(s + 0.006, t);
    leaf = smin(leaf, sdEllipsoid(vec3(lq.x - 0.014, lq.y, f.z - 0.043), vec3(0.016, 0.0075, 0.009)), 0.004);
  }
  // The veins cut into it.
  leaf += 0.0012 * smoothstep(0.3, 1.0, sin(atan(t, s + 0.03) * 9.0));
  r = U(r, vec2(leaf, 1.0));

  // The canvas, a hair below the slip, its paint standing proud of the weave.
  float pic = f.z - relief(f);
  pic = max(pic, max(a.x - CANVAS.x, a.y - CANVAS.y));
  pic = max(pic, -f.z - 0.02);
  r = U(r, vec2(pic * 0.8, 3.0));
  return r;
}

/* ---- materials ----------------------------------------------------------- */

Mat material(float id, vec3 p, vec3 n) {
  vec3 f = toFrame(p);
  vec2 a = abs(f.xy);
  float u = max(a.x - SIGHT.x, a.y - SIGHT.y);
  float along = a.x - SIGHT.x > a.y - SIGHT.y ? f.y : f.x;
  if (id == 1.0) {
    // Ebonised: black stain and polish over a close-grained wood whose figure
    // still shows in the light, rubbed through to brown on the high edges.
    float grain = noise(vec2(along * 900.0 + fbm(vec2(along * 30.0, u * 200.0)) * 6.0, u * 60.0));
    float fig = fbm(vec2(along * 60.0, u * 300.0 + f.z * 200.0));
    vec3 c = mix(hex(0x0b0a09), hex(0x17130f), grain * 0.5 + fig * 0.4);
    // Wear: where hands and dusters have reached, the highest edges.
    float high = smoothstep(0.050, 0.055, f.z) + smoothstep(0.036, 0.039, f.z) * smoothstep(0.112, 0.121, u);
    float rub = high * smoothstep(0.45, 0.75, fbm(vec3(f.xy * 90.0, 1.0)));
    c = mix(c, hex(0x2b2119), rub * 0.6);
    // Dust in the hollows.
    float hollow = smoothstep(0.03, 0.0, f.z) * (1.0 - smoothstep(0.02, 0.03, u));
    c = mix(c, hex(0x3b3936), 0.15 * hollow);
    return mat(c, 0.36 + 0.18 * fig + 0.15 * rub, 0.0);
  }
  if (id == 2.0) {
    // Silver leaf over gesso, tarnished, the bole grey-brown where it shows.
    float tarn = smoothstep(0.35, 0.75, fbm(vec3(along * 90.0, u * 400.0, 2.0)));
    vec3 c = mix(vec3(0.60, 0.60, 0.58), vec3(0.34, 0.33, 0.31), tarn * 0.6);
    return mat(c, 0.32 + 0.15 * tarn, 1.0);
  }
  if (id == 3.0) {
    vec2 uv = picUV(f);
    vec3 c = pow(textureLod(u_tex, vec2(uv.x * 0.5, uv.y), 0.0).rgb, vec3(2.2));
    // The varnish: old, slightly yellowed, a little dimming, thicker and
    // browner where the cleaner never quite reached the corners.
    vec2 e = abs(uv - 0.5) * 2.0;
    float edge = smoothstep(0.75, 1.0, max(e.x, e.y));
    c *= mix(vec3(0.98, 0.92, 0.78), vec3(0.86, 0.76, 0.58), edge * 0.7);
    // Craquelure: the cracks hold dirt.
    float cr = crack(f.xy);
    c *= 1.0 - 0.3 * cr;
    // Bloom: a faint milkiness in the deepest darks.
    c += vec3(0.004, 0.0038, 0.0034) * smoothstep(0.02, 0.0, dot(c, vec3(0.33)));
    return mat(c, 0.55, 0.0);
  }
  return mat(hex(0x15120f), 0.8, 0.0);
}
