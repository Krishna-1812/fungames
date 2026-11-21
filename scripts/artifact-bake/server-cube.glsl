/* August 6, 1991: the World Wide Web goes public.
 *
 * The machine it ran on: a matte black magnesium cube of a workstation, thirty
 * centimetres a side, standing on four rubber feet with a parting line round
 * its lower third, a slot on its front, a recessed round button and a green
 * lamp. Unbranded. A sheet of paper is taped to its side, written on in red
 * marker, because somebody was afraid someone would switch it off
 * (server-cube.svg is the paper). A faint dust on the top, a power cable out of
 * the back and across the floor to its plug. Units: 1 is 1 cm.
 */
#define BOUND vec3(20.0, 15.7, 17.0)
#define CENTRE vec3(5.0, 15.7, -1.0)
#define VIEW_YAW 0.8
#define VIEW_PITCH 0.34
#define FILL 0.8
#define COAT(id) (id == 4.0 ? 1.0 : 0.0)
#define SHEEN(id) (id == 1.0 ? 0.12 : 0.0)
#define EXPOSURE 1.3

const float HALF = 15.0;    // half the cube's side
const float FY = 16.0;      // the cube's centre height
const vec2 LAB = vec2(2.5, 19.0);   // the label: z, y of its centre
const vec2 LABH = vec2(6.4, 5.4);   // its half size
const float LROT = 0.05;

/* A point in the label's own frame: x to the viewer's right, y up. */
vec2 labPos(vec3 p) {
  vec2 q = vec2(-(p.z - LAB.x), p.y - LAB.y);
  return rot(LROT) * q;
}

vec2 map(vec3 p) {
  vec3 c = p - vec3(0.0, FY, 0.0);
  float cube = sdRound(c, vec3(HALF), 1.1);
  // The parting line round the lower third, and a seam up one corner.
  float part = max(abs(p.y - 8.5) - 0.12, -sdBox(c, vec3(HALF - 0.15)));
  cube = smax(cube, -part, 0.05);
  // The slot in the front, and the round recess of the button.
  float slot = sdBox(p - vec3(-3.0, 22.0, HALF), vec3(6.6, 0.4, 1.4)) - 0.05;
  cube = smax(cube, -slot, 0.08);
  float well = sdCyl((p - vec3(9.5, 8.5 - 3.2, HALF)).xzy, 1.45, 0.7) - 0.05;
  cube = smax(cube, -well, 0.1);
  // A row of small ventilation slots along the front's lower edge.
  float vx = clamp(floor((p.x + 8.0) / 1.2 + 0.5) * 1.2, -4.8, 4.8) - 8.0;
  float vent = sdBox(vec3(p.x - vx, p.y - 5.0, p.z - HALF), vec3(0.18, 0.9, 0.9));
  cube = smax(cube, -vent, 0.05);
  vec2 d = vec2(cube, 1.0);
  // The button's cap and the lamp.
  float cap = sdCyl((p - vec3(9.5, 5.3, HALF - 0.35)).xzy, 1.15, 0.28) - 0.1;
  d = U(d, vec2(cap, 6.0));
  float led = sdCyl((p - vec3(2.5, 5.3, HALF - 0.1)).xzy, 0.28, 0.12) - 0.04;
  d = U(d, vec2(led, 7.0));
  // Four rubber feet.
  float foot = sdCyl(vec3(abs(p.x) - 11.5, p.y - 0.55, abs(p.z) - 11.5), 1.8, 0.55) - 0.2;
  d = U(d, vec2(foot, 2.0));
  // The paper on the +x side, corners lifting a hair; and the tape.
  vec2 l = labPos(p);
  float curl = 0.05 * smoothstep(2.0, 5.0, abs(l.y)) * (0.4 + 0.6 * smoothstep(3.0, 6.4, abs(l.x)));
  float paper = max(sdBox(vec3(l, p.x - (HALF + 0.03 + curl)), vec3(LABH, 0.03)), 0.0) - 0.0;
  paper = max(max(abs(l.x) - LABH.x, abs(l.y) - LABH.y), abs(p.x - (HALF + 0.035 + curl)) - 0.03) * 0.9;
  d = U(d, vec2(paper, 3.0));
  float tp = 1e5;
  vec2 t1 = rot(0.7) * (l - vec2(-5.8, 4.9));
  vec2 t2 = rot(-0.7) * (l - vec2(5.8, 4.9));
  vec2 t3 = rot(0.15) * (l - vec2(-1.0, -5.4));
  tp = min(tp, max(max(abs(t1.x) - 2.1, abs(t1.y) - 0.7), abs(p.x - (HALF + 0.085)) - 0.025));
  tp = min(tp, max(max(abs(t2.x) - 2.1, abs(t2.y) - 0.7), abs(p.x - (HALF + 0.085)) - 0.025));
  tp = min(tp, max(max(abs(t3.x) - 2.4, abs(t3.y) - 0.7), abs(p.x - (HALF + 0.085)) - 0.025));
  d = U(d, vec2(tp * 0.9, 4.0));
  // The cable and its plug.
  float cab = sdCapsule(p, vec3(9.0, 9.0, -HALF + 0.3), vec3(9.0, 5.5, -HALF - 2.0), 0.5);
  cab = min(cab, sdCapsule(p, vec3(9.0, 5.5, -HALF - 2.0), vec3(10.0, 0.5, -HALF - 1.6), 0.5));
  cab = min(cab, sdCapsule(p, vec3(10.0, 0.5, -HALF - 1.6), vec3(19.0, 0.5, -HALF - 0.4), 0.5));
  cab = min(cab, sdCapsule(p, vec3(19.0, 0.5, -HALF - 0.4), vec3(22.5, 0.5, -9.0), 0.5));
  cab = min(cab, sdCapsule(p, vec3(22.5, 0.5, -9.0), vec3(22.0, 0.5, -6.0), 0.5));
  float plug = sdRound(p - vec3(22.0, 0.95, -4.2), vec3(1.5, 0.95, 2.4), 0.35);
  d = U(d, vec2(min(cab, plug), 5.0));
  return d;
}

Mat material(float id, vec3 p, vec3 n) {
  if (id == 1.0) {
    // Magnesium, painted matte black and grained: nearly no reflection but a
    // fine sparkle, a slightly shinier smudge of fingerprints on the sides, and
    // dust that has settled on the top.
    float spark = noise(p * 90.0);
    float grain = noise(p * 28.0);
    float smudge = smoothstep(0.55, 0.8, fbm(p * 0.9 + 3.0)) * (1.0 - abs(n.y));
    vec3 c = vec3(0.013, 0.013, 0.014) * (0.85 + 0.3 * grain) + 0.008 * smoothstep(0.7, 1.0, spark);
    float dust = smoothstep(0.7, 1.0, n.y) * (0.3 + 0.7 * smoothstep(0.3, 0.8, fbm(p * 0.45))) * 0.5;
    c = mix(c, vec3(0.16, 0.16, 0.16), dust * 0.12 * smoothstep(0.4, 0.9, noise(p * 40.0)));
    float rough = mix(0.58, 0.34, smudge) + 0.1 * grain;
    rough = mix(rough, 0.8, dust);
    // The edge of the paint worn through at the corners.
    return mat(c, rough, 0.0);
  }
  if (id == 2.0) return mat(hex(0x151515), 0.7, 0.0);
  if (id == 3.0) {
    vec2 l = labPos(p);
    vec2 uv = vec2((l.x + LABH.x) / (2.0 * LABH.x), (l.y + LABH.y) / (2.0 * LABH.y));
    vec3 c = pow(texture(u_tex, uv).rgb, vec3(2.2));
    float age = 0.5 + 0.5 * fbm(p * 1.3);
    c *= mix(vec3(0.95, 0.93, 0.88), vec3(1.0), age);
    c = mix(c, hex(0x6b6a60), smoothstep(0.6, 0.9, noise(p * 8.0)) * 0.12);
    return mat(c * 0.9, 0.78, 0.0);
  }
  if (id == 4.0) {
    // Clear tape, a little yellowed: the paper or the cube shows through it.
    vec2 l = labPos(p);
    bool onPaper = abs(l.x) < LABH.x && abs(l.y) < LABH.y;
    vec3 under = onPaper ? vec3(0.62, 0.6, 0.52) : vec3(0.045, 0.043, 0.04);
    float ripple = noise(p * 14.0) * 0.06;
    return mat(under + hex(0xb59a4a) * 0.05 + ripple * 0.5, 0.18, 0.0);
  }
  if (id == 6.0) return mat(hex(0x1b1b1c), 0.3, 0.0);
  if (id == 7.0) {
    Mat m = mat(hex(0x1a3a1c), 0.3, 0.0);
    m.emit = vec3(0.1, 0.9, 0.2) * 1.1;
    return m;
  }
  return mat(hex(0x0b0b0c), 0.4, 0.0);
}
