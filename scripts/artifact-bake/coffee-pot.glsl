/* November 1993: a coffee pot gets the first webcam.
 *
 * A filter-machine carafe of the early nineties standing on its hot plate:
 * thin borosilicate glass, bellied at the bottom and drawn in at the neck,
 * a black polypropylene collar with a pouring lip, a lid with a knob, and a
 * handle that hangs off the collar and never touches the glass. A third of a
 * pot of coffee left, as the camera in the Trojan Room usually found it.
 * No maker's mark. Units: 1 is 10 cm.
 */
#define BOUND vec3(0.98, 0.98, 0.9)
#define CENTRE vec3(0.14, 0.98, 0.0)
#define VIEW_YAW 0.34
#define VIEW_PITCH 0.30
#define FILL 0.8
#define GLASS 4.0
#define GLASS_TINT vec3(0.95, 0.975, 0.965)
#define COAT(id) (id == 2.0 ? 0.5 : id == 1.0 ? 1.0 : 0.0)

const float BASE = 0.07;     // the hot plate's top
const float NECK = 1.30;     // where the glass meets the collar
const float LEVEL = 0.56;    // the coffee left in it

/* The glass's radius at a height: a full belly, drawn in to the neck. */
float prof(float y) {
  float b = y - BASE;
  return 0.64 + 0.03 * smoothstep(0.0, 0.25, b) - 0.21 * smoothstep(0.42, 1.12, b);
}

float glassSolid(vec3 p) {
  float r = length(p.xz);
  float side = (r - prof(p.y)) * 0.86;
  return smax(side, -(p.y - BASE), 0.09);
}

float sdHandle(vec3 p) {
  // A flat bar that drops from the collar, outside the glass on +x.
  vec3 q = p - vec3(0.86, 0.0, 0.0);
  float bar = sdCapsule(q, vec3(0.0, 0.52, 0.0), vec3(0.04, 1.30, 0.0), 0.075);
  bar = max(bar, abs(q.z) - 0.11);
  float arm = sdCapsule(p, vec3(0.48, 1.42, 0.0), vec3(0.88, 1.36, 0.0), 0.07);
  arm = max(arm, abs(p.z) - 0.13);
  float foot = sdCapsule(q, vec3(0.0, 0.52, 0.0), vec3(-0.12, 0.44, 0.0), 0.06);
  return smin(smin(bar, arm, 0.08), foot, 0.05);
}

vec2 map(vec3 p) {
  float r = length(p.xz);
  // The glass: a shell, open at the top where the collar takes over.
  float g = max(abs(glassSolid(p)) - 0.011, p.y - NECK - 0.05);
  vec2 d = vec2(g, GLASS);
  // The coffee, a little inside the glass, flat on top.
  float c = max(glassSolid(p) + 0.014, p.y - LEVEL);
  d = U(d, vec2(c, 1.0));
  // The collar: a black band round the neck, a pouring lip at -x.
  float cr = prof(NECK) + 0.035;
  float lip = 0.13 * smoothstep(0.55, 0.98, -p.x / max(r, 1e-3)) * smoothstep(NECK + 0.05, NECK + 0.26, p.y);
  float band = max(abs(r - (cr + lip)) - 0.035, abs(p.y - (NECK + 0.15)) - 0.17);
  band = smin(band, max(r - cr - 0.05, abs(p.y - (NECK + 0.0)) - 0.03), 0.02);
  // The lid: a low dome inside the collar, with a knob.
  float lid = max(length((p - vec3(0.03, NECK + 0.17, 0.0)) * vec3(1.0, 2.6, 1.0)) - cr * 0.97, -(p.y - NECK - 0.2));
  lid = max(lid, r - cr + 0.01);
  float knob = sdCapsule(p, vec3(0.06, NECK + 0.3, 0.0), vec3(0.06, NECK + 0.36, 0.0), 0.07);
  float black = smin(min(band, lid), knob, 0.03);
  black = min(black, sdHandle(p));
  d = U(d, vec2(black, 2.0));
  // The hot plate: a dished black-enamel disc with a stainless rim.
  float plate = sdCyl(p - vec3(0.0, BASE * 0.5, 0.0), 0.84, BASE * 0.5) - 0.008;
  plate = smax(plate, -(length(vec2(r, p.y - BASE - 0.6)) - 0.6), 0.004);
  float steel = max(abs(r - 0.85) - 0.025, abs(p.y - BASE * 0.5) - BASE * 0.5);
  d = U(d, vec2(plate, 3.0));
  d = U(d, vec2(steel - 0.004, 5.0));
  return d;
}

Mat material(float id, vec3 p, vec3 n) {
  if (id == 1.0) {
    // Coffee left on the plate too long: near-black, red-brown where thin.
    float rim = smoothstep(0.04, 0.0, abs(p.y - LEVEL)) * 0.4;
    vec3 c = mix(hex(0x120805), hex(0x3a1a0c), rim + 0.15 * fbm(p * 8.0));
    Mat m = mat(c, 0.06, 0.0);
    m.sss = 0.08;
    return m;
  }
  if (id == 2.0) {
    // Black polypropylene, a little worn grey where hands go.
    float wear = smoothstep(0.62, 0.85, fbm(p * 9.0)) * 0.18;
    Mat m = mat(mix(hex(0x0d0e10), hex(0x2a2c30), wear), 0.42 + 0.1 * noise(p * 60.0), 0.0);
    return m;
  }
  if (id == 3.0) {
    // Black enamel with a burnt ring where the pot sits.
    float r = length(p.xz);
    float ring = smoothstep(0.05, 0.0, abs(r - 0.6)) * 0.5;
    vec3 c = mix(hex(0x111214), hex(0x2b1f18), ring * fbm(p * 20.0));
    return mat(c, 0.28 + 0.2 * ring, 0.0);
  }
  // Brushed stainless.
  float brush = noise(vec3(atan(p.z, p.x) * 140.0, p.y * 4.0, 0.0));
  return mat(mix(hex(0x9aa0a6), hex(0xc2c7cc), brush), 0.26, 1.0);
}
