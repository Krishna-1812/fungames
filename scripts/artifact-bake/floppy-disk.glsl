/* November 2, 1988: the Morris Worm.
 *
 * A 3.5 inch floppy disk of the late eighties, lying on a table at an angle:
 * a charcoal-black injection-moulded shell with the cut corner, a sprung
 * steel shutter over the head window, the write-protect and density holes
 * in the near corners, and a paper label, hand-lettered in ballpoint, curling
 * up a little at one corner. A disk holding the worm's source code is kept at
 * the Museum of Science in Boston; this stands for it. The label is
 * floppy-disk.svg, mapped flat on the face (uv 0,0 bottom left). Fingerprints
 * and dust on the shell, scuffed edges. No maker's mark. Units: 1 is 1 cm.
 */
#define BOUND vec3(5.7, 0.2, 5.4)
#define CENTRE vec3(0.0, 0.2, 0.0)
#define VIEW_YAW 0.06
#define VIEW_PITCH 0.92
#define FILL 0.78
#define EXPOSURE 1.15
#define COAT(id) (id == 1.0 ? 0.18 : id == 2.0 ? 0.2 : 0.0)
#define SHEEN(id) (id == 1.0 ? 0.55 : 0.0)

const float ROT = 0.52;       // how the disk is turned on the table
const float T = 0.165;        // half its thickness
const float HW = 4.5;         // half its width
const float HD = 4.7;         // half its depth
const float LHX = 3.3, LHZ = 2.0, LCZ = 2.45;   // the label's half sizes and centre
const vec2 WP = vec2(3.75, 4.12);               // the write-protect hole
const vec2 DN = vec2(-3.75, 4.12);              // the density hole

vec3 loc(vec3 p) { vec3 q = p; q.xz = rot(ROT) * p.xz; return q; }

float rbox2(vec2 p, vec2 b, float r) { vec2 d = abs(p) - b + r; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r; }

float labelLift(vec3 q) {
  float c = clamp((-q.x / LHX + (q.z - LCZ) / LHZ) * 0.5, 0.0, 1.0);
  float s = smoothstep(0.80, 1.0, c);
  return 0.075 * s * s;
}

vec2 map(vec3 p) {
  vec3 q = loc(p);
  // The shell.
  float body = sdRound(q - vec3(0.0, T, 0.0), vec3(HW, T, HD), 0.055);
  float ch = (q.x - q.z - (2.0 * 4.6 - 0.95)) * 0.7071;
  body = smax(body, ch, 0.05);
  // Shutter channel, and the pocket in it that shows the disc inside.
  float chan = sdBox(q - vec3(1.6, 2.0 * T, -3.78), vec3(1.72, 0.032, 1.03));
  body = smax(body, -chan, 0.012);
  float pocket = sdBox(q - vec3(1.45, 2.0 * T, -3.8), vec3(0.8, 0.14, 0.6));
  body = smax(body, -pocket, 0.01);
  // The label's shallow recess.
  float rec = rbox2(q.xz - vec2(0.0, LCZ), vec2(LHX + 0.04, LHZ + 0.04), 0.12);
  body = smax(body, -max(rec, (2.0 * T - 0.02) - q.y), 0.006);
  // The two corner holes, through.
  body = smax(body, -(rbox2(q.xz - WP, vec2(0.23), 0.03)), 0.008);
  body = smax(body, -(rbox2(q.xz - DN, vec2(0.23), 0.03)), 0.008);
  vec2 d = vec2(body, 1.0);

  // The label.
  float lift = labelLift(q);
  vec3 ql = q - vec3(0.0, 2.0 * T - 0.016 + lift, 0.0);
  float lab = max(rbox2(q.xz - vec2(0.0, LCZ), vec2(LHX, LHZ), 0.1), abs(ql.y) - 0.012) * 0.8;
  d = U(d, vec2(lab, 2.0));

  // The shutter: a bent steel plate with a window and a grip ridge.
  float sh = sdRound(q - vec3(1.45, 2.0 * T - 0.012, -3.83), vec3(1.4, 0.016, 0.88), 0.012);
  sh = max(sh, -rbox2(q.xz - vec2(1.45, -3.82), vec2(0.8, 0.6), 0.05));
  float grip = sdRound(q - vec3(1.45, 2.0 * T + 0.002, -3.1), vec3(1.0, 0.012, 0.045), 0.012);
  d = U(d, vec2(min(sh, grip), 3.0));

  // The write-protect slider: a little black block seen through its hole.
  float sl = sdRound(q - vec3(WP.x, 0.1, WP.y + 0.08), vec3(0.2, 0.045, 0.13), 0.02);
  d = U(d, vec2(sl, 5.0));
  return d;
}

Mat material(float id, vec3 p, vec3 n) {
  vec3 q = loc(p);
  if (id == 1.0) {
    // Charcoal polystyrene: matte, faintly textured, thumb-marked, dusty.
    vec3 c = hex(0x202226);
    // The disc seen through the shutter window: brown mylar, glossier.
    if (q.y < 2.0 * T - 0.1 && abs(q.x - 1.45) < 0.85 && abs(q.z + 3.8) < 0.65) return mat(hex(0x2a1f1a), 0.25, 0.0);
    float grain = noise(q * 38.0);
    float edge = smoothstep(0.1, 0.16, abs(q.y - T)) * smoothstep(0.995, 0.8, n.y);
    float scuff = edge * smoothstep(0.5, 0.8, fbm(q * 4.0));
    c = mix(c, hex(0x5a5e64), scuff * 0.55);
    // Fingerprints: broad smudges that raise the roughness and the grey a touch.
    float fp = smoothstep(0.55, 0.78, fbm(q.xz * 1.6 + 4.0));
    float whorl = 0.6 + 0.4 * noise(q * 18.0);
    float prints = smoothstep(1.1, 0.1, length(q.xz - vec2(-2.4, -1.2) * vec2(1.0, 1.4))) * whorl + 0.7 * smoothstep(0.9, 0.1, length(q.xz - vec2(1.0, 0.0))) * whorl;
    float dust = smoothstep(0.9, 0.97, noise(q * 120.0)) * 0.10;
    c = mix(c, hex(0x8a8d90), fp * 0.012 + prints * 0.05 + dust);
    // The moulding seam round the edge.
    float seam = smoothstep(0.012, 0.0, abs(q.y - T)) * step(0.5, 1.0 - n.y);
    c *= 1.0 - 0.5 * seam;
    float rough = 0.36 + 0.16 * grain + 0.18 * fp + 0.12 * prints + 0.2 * scuff;
    return mat(c, clamp(rough, 0.2, 0.85), 0.0);
  }
  if (id == 2.0) {
    // The paper label.
    vec2 uv = vec2(q.x / LHX * 0.5 + 0.5, 0.5 - (q.z - LCZ) / LHZ * 0.5);
    vec3 c = pow(texture(u_tex, uv).rgb, vec3(2.2));
    float fib = noise(vec3(q.xz * 40.0, 1.0));
    c *= 0.86 + 0.1 * fib;
    float edge = smoothstep(0.55, 1.0, max(abs(q.x) / LHX, abs(q.z - LCZ) / LHZ));
    c = mix(c, c * vec3(0.9, 0.84, 0.66), edge * 0.5 + 0.18 * fbm(q * 3.0));
    float dust = smoothstep(0.86, 0.92, noise(q * 40.0)) * 0.12;
    c = mix(c, vec3(0.5), dust);
    return mat(c, 0.72, 0.0);
  }
  if (id == 3.0) {
    // The shutter: brushed along its length, a few fine scratches.
    float brush = noise(vec3(q.z * 90.0, q.x * 2.0, 0.0));
    float scr = smoothstep(0.93, 0.99, noise(vec3(q.x * 5.0, q.z * 120.0, 3.0)));
    vec3 c = mix(hex(0x9da3a9), hex(0xc4c9ce), brush);
    c = mix(c, hex(0xe0e4e8), scr * 0.6);
    return mat(c, 0.30 + 0.1 * brush, 1.0);
  }
  if (id == 5.0) {
    return mat(hex(0x23252a), 0.45, 0.0);
  }
  return mat(hex(0x23252a), 0.5, 0.0);
}
