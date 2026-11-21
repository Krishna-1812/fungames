/* September 19, 1982: the first emoticon.
 *
 * A video terminal of the early eighties, the kind on a university's desks
 * when Scott Fahlman typed :-) into a bulletin board: a deep CRT in an
 * off-white injection-moulded case gone a little grey with age, a squared
 * front bezel round a curved glass face, a narrower rear housing slotted for
 * the heat, two knobs and a grille under the screen, a coiled-black cable out
 * of the back. The tube is a green phosphor, scanned in lines, with a blur of
 * bloom round every letter (crt-terminal.svg is what it shows). The glass
 * reflects the room. No maker's mark. Units: 1 is 1 cm.
 */
#define BOUND vec3(19.0, 16.0, 20.0)
#define CENTRE vec3(0.0, 16.0, -2.0)
#define VIEW_YAW 0.72
#define VIEW_PITCH 0.3
#define FILL 0.8
#define GLASS 3.0
#define GLASS_TINT vec3(0.9, 0.96, 0.92)
#define COAT(id) (id == 2.0 ? 0.0 : 0.0)
#define EXPOSURE 1.0

const vec3 SCR = vec3(0.0, 17.0, 0.0);   // the screen's centre (x, y)
const float RG = 60.0;                   // radius of the tube's face
const float TIP = 16.3;                  // how far the glass stands out at its middle

float rr2(vec2 q, vec2 b, float r) { vec2 d = abs(q) - b + r; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r; }

vec2 map(vec3 p) {
  // The case: a broad front block and a narrower, rounder rear housing.
  float front = sdRound(p - vec3(0.0, 15.5, 6.0), vec3(18.0, 13.5, 10.0), 1.7);
  float rear = sdRound(p - vec3(0.0, 15.8, -10.5), vec3(14.6, 11.6, 10.6), 3.2);
  float body = smin(front, rear, 0.5);
  // A groove round the seam where the two halves of the case meet.
  body = smax(body, -(max(abs(p.z + 0.2) - 0.14, -(front + 0.5))), 0.04);
  // Heat slots on both sides of the rear housing, and on its top.
  float cy = clamp(floor(p.y / 0.95 + 0.5) * 0.95, 17.0, 25.0);
  float cz = clamp(floor((p.z + 9.0) / 0.95 + 0.5) * 0.95, -4.75, 4.75) - 9.0;
  float slotS = sdBox(vec3(abs(p.x) - 14.6, p.y - cy, p.z + 9.0), vec3(0.8, 0.2, 5.4));
  float slotT = sdBox(vec3(p.x, p.y - 27.4, p.z - cz), vec3(7.5, 0.8, 0.2));
  body = smax(body, -min(slotS, slotT), 0.05);
  // The screen's recess in the bezel.
  float rec = max(rr2(p.xy - SCR.xy, vec2(12.8, 9.8), 1.6), 13.4 - p.z);
  body = smax(body, -rec, 0.2);
  // Lower grille, left of the front.
  float gx = clamp(floor((p.x + 8.5) / 0.9 + 0.5) * 0.9, -5.4, 5.4) - 8.5;
  float grille = sdBox(vec3(p.x - gx, p.y - 4.4, p.z - 16.0), vec3(0.2, 1.2, 0.6));
  body = smax(body, -grille, 0.04);
  // Feet.
  float foot = sdCyl(vec3(abs(p.x) - 13.5, p.y - 0.55, abs(p.z + 4.0) - 12.0), 1.7, 0.55) - 0.15;
  body = min(body, foot);
  vec2 d = vec2(body, 1.0);

  // Two knobs and a rocker lamp under the screen.
  float k1 = sdCyl((p - vec3(12.6, 6.0, 16.0)).xzy * vec3(1.0, 1.0, 1.0), 1.2, 0.0);
  vec3 q = p - vec3(12.6, 5.6, 16.0);
  float knob1 = sdCyl(q.xzy, 1.2, 1.1) - 0.15;
  q = p - vec3(8.9, 5.6, 16.0);
  float knob2 = sdCyl(q.xzy, 1.2, 1.1) - 0.15;
  knob2 = max(knob2, -(sdBox(q - vec3(0.0, 0.8, 1.2), vec3(0.15, 0.9, 0.5))));
  knob1 = max(knob1, -(sdBox(q + vec3(3.7, -0.4, -1.2), vec3(0.9, 0.15, 0.5))));
  d = U(d, vec2(min(knob1, knob2), 4.0));
  float led = sdCyl((p - vec3(-13.5, 5.6, 15.7)).xzy, 0.32, 0.25) - 0.05;
  d = U(d, vec2(led, 5.0));

  // The tube's face: a thin curved glass over a thin phosphor skin.
  vec3 gp = p - vec3(0.0, 17.0, TIP - RG);
  float gl = length(gp) - RG;
  float glass = max(abs(gl) - 0.07, rr2(p.xy - SCR.xy, vec2(12.6, 9.6), 1.5));
  d = U(d, vec2(glass, GLASS));
  float ph = max(abs(gl + 0.55) - 0.04, rr2(p.xy - SCR.xy, vec2(12.0, 9.0), 1.3));
  d = U(d, vec2(ph, 6.0));

  // The cable: out of the back, down, across the floor to the right.
  float cab = sdCapsule(p, vec3(0.0, 11.0, -21.0), vec3(0.0, 8.0, -21.6), 0.45);
  cab = min(cab, sdCapsule(p, vec3(0.0, 8.0, -21.6), vec3(1.0, 1.6, -21.6), 0.45));
  cab = min(cab, sdCapsule(p, vec3(1.0, 1.6, -21.6), vec3(3.5, 0.45, -19.0), 0.45));
  cab = min(cab, sdCapsule(p, vec3(3.5, 0.45, -19.0), vec3(12.0, 0.45, -17.0), 0.45));
  d = U(d, vec2(cab, 7.0));
  return d;
}

Mat material(float id, vec3 p, vec3 n) {
  if (id == 1.0) {
    // Off-white ABS gone a warm grey: an orange-peel grain, yellowing in the
    // heat above the vents, grime in the seams, a scuff on the front edges.
    float grain = noise(p * 40.0) * 0.5 + noise(p * 110.0) * 0.5;
    float tone = fbm(p * 0.35);
    vec3 c = mix(hex(0xb2ad9e), hex(0xc4bfae), tone);
    c = mix(c, hex(0xc0b58f), smoothstep(22.0, 29.0, p.y) * 0.5 * smoothstep(-20.0, 0.0, p.z) + smoothstep(0.55, 0.9, fbm(p * 0.8)) * 0.18);
    c *= 0.94 + 0.12 * grain;
    // Dirt where the case has been handled, and dust settled on the top.
    float dirt = smoothstep(0.55, 0.85, fbm(p * 1.7)) * 0.2;
    c = mix(c, hex(0x7d7766), dirt);
    c = mix(c, hex(0xa9a597), smoothstep(0.6, 0.95, n.y) * smoothstep(0.55, 0.8, noise(p * 9.0)) * 0.35);
    // The screen's frame: a dark grey trim inside the recess.
    float inRec = step(rr2(p.xy - SCR.xy, vec2(13.1, 10.1), 1.8), 0.0) * step(p.z, 15.5);
    c = mix(c, hex(0x1d1e1f), inRec);
    // The grille and the lamp's window.
    Mat m = mat(c, mix(0.5, 0.38, dirt) + 0.08 * grain, 0.0);
    return m;
  }
  if (id == 2.0) return mat(hex(0x222222), 0.5, 0.0);
  if (id == 4.0) {
    // Knobs: a darker brown-grey plastic, worn bright at the grip.
    float wear = smoothstep(0.5, 0.9, noise(p * 30.0)) * 0.2;
    return mat(mix(hex(0x56524a), hex(0x8a8576), wear), 0.4, 0.0);
  }
  if (id == 5.0) {
    Mat m = mat(hex(0x1a3a1c), 0.3, 0.0);
    m.emit = vec3(0.1, 0.9, 0.2) * 1.4;
    return m;
  }
  if (id == 6.0) {
    // The phosphor: the picture, scanned in lines, dimming at the corners.
    vec2 uv = vec2((p.x + 12.0) / 24.0, (p.y - 8.0) / 18.0);
    vec3 c = texture(u_tex, uv).rgb;
    c = pow(c, vec3(2.2));
    float line = 0.78 + 0.22 * cos(p.y * 34.9);
    float tri = 0.94 + 0.06 * cos(p.x * 62.0);
    vec2 e = abs(uv - 0.5) * 2.0;
    float vig = 1.0 - 0.55 * pow(max(e.x, e.y), 3.0) - 0.25 * dot(e, e) * 0.5;
    Mat m = mat(vec3(0.01, 0.02, 0.012), 0.6, 0.0);
    m.emit = c * line * tri * vig * vec3(0.9, 1.0, 0.85) * 1.9 + vec3(0.002, 0.012, 0.004);
    // The room in the glass: a window-shaped softbox high on the left, and a pale veil of the ceiling.
    vec2 w = (uv - vec2(0.2, 0.78)) / vec2(0.2, 0.13);
    float win = smoothstep(1.0, 0.7, max(abs(w.x), abs(w.y)));
    m.emit += vec3(0.62, 0.66, 0.7) * (0.12 * win + 0.025 * smoothstep(0.1, 1.0, uv.y) * smoothstep(1.0, 0.2, uv.x));
    return m;
  }
  // The cable: black PVC.
  return mat(hex(0x0c0c0d), 0.38, 0.0);
}
