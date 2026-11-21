/* 1996: the Dancing Baby.
 *
 * A fifteen-inch CRT monitor of the mid-nineties, the kind a family's PC sat
 * behind when the Dancing Baby arrived as a four-megabyte attachment: a
 * boxy front bezel in beige plastic that has begun to yellow, a deep tapering
 * rear housing slotted for the heat, a row of small buttons and a lamp under
 * the glass, and a round tilt-and-swivel foot. The screen shows an email
 * inbox full of forwards (beige-monitor.svg), a generic client with no
 * program's name. Units: 1 is 1 cm.
 */
#define BOUND vec3(19.5, 20.0, 18.5)
#define CENTRE vec3(0.0, 20.0, -9.5)
#define VIEW_YAW 0.62
#define VIEW_PITCH 0.24
#define FILL 0.8
#define GLASS 3.0
#define GLASS_TINT vec3(0.93, 0.96, 0.95)
#define EXPOSURE 1.05

const vec2 SCR = vec2(0.0, 24.3);
const float RG = 95.0;
const float TIP = 8.0;

float rr2(vec2 q, vec2 b, float r) { vec2 d = abs(q) - b + r; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r; }

vec2 map(vec3 p) {
  float front = sdRound(p - vec3(0.0, 22.0, 3.0), vec3(19.0, 17.5, 5.5), 2.2);
  float rear = sdRound(p - vec3(0.0, 23.5, -14.5), vec3(14.2, 14.0, 14.0), 5.5);
  float neck = smin(front, rear, 2.5);
  // The seam where the two shells of the case meet.
  neck = smax(neck, -max(abs(p.z + 2.2) - 0.12, -(front + 0.6)), 0.04);
  // Slots: top of the rear, and both sides.
  float sz = clamp(floor((p.z + 14.0) / 1.1 + 0.5) * 1.1, -6.6, 6.6) - 14.0;
  float slotT = sdBox(vec3(p.x, p.y - 37.7, p.z - sz), vec3(8.5, 0.9, 0.22));
  float sy = clamp(floor(p.y / 1.1 + 0.5) * 1.1, 20.0, 28.0);
  float slotS = sdBox(vec3(abs(p.x) - 14.0, p.y - sy, p.z + 14.0), vec3(1.1, 0.22, 6.0));
  neck = smax(neck, -min(slotT, slotS), 0.06);
  // The bezel's recess for the glass.
  float rec = max(rr2(p.xy - SCR, vec2(15.2, 11.6), 1.8), 5.5 - p.z);
  neck = smax(neck, -rec, 0.25);
  // Small buttons and the power key along the lower bezel.
  float bx = clamp(floor((p.x + 12.0) / 3.2 + 0.5) * 3.2, -12.0, -2.4);
  float btn = sdRound(vec3(p.x - bx, p.y - 8.6, p.z - 8.5), vec3(1.0, 0.55, 0.9), 0.25);
  float pwr = sdRound(p - vec3(13.0, 8.6, 8.55), vec3(1.4, 0.8, 0.45), 0.25);
  // A shallow trough in the bezel to seat the buttons.
  float trough = sdBox(p - vec3(-7.2, 8.6, 8.9), vec3(6.4, 1.3, 1.4));
  neck = smax(neck, -trough, 0.15);
  vec2 d = vec2(neck, 1.0);
  d = U(d, vec2(min(btn, pwr), 4.0));
  float led = sdCyl((p - vec3(9.0, 8.6, 8.2)).xzy, 0.3, 0.12) - 0.05;
  d = U(d, vec2(led, 5.0));
  // The tilt-and-swivel foot: a wide ring, a turntable on it, and a neck.
  float f1 = sdCyl(p - vec3(0.0, 0.9, -2.0), 13.0, 0.9) - 0.4;
  float f2 = sdCyl(p - vec3(0.0, 2.4, -2.0), 11.0, 0.7) - 0.35;
  float f3 = sdCyl(p - vec3(0.0, 3.4, -2.0), 9.5, 0.8) - 0.3;
  d = U(d, vec2(min(f1, smin(f2, f3, 0.4)), 2.0));
  // The glass and the phosphor skin behind it.
  vec3 gp = p - vec3(0.0, SCR.y, TIP - RG);
  float gl = length(gp) - RG;
  float glass = max(abs(gl) - 0.08, rr2(p.xy - SCR, vec2(15.0, 11.4), 1.8));
  d = U(d, vec2(glass, GLASS));
  float ph = max(abs(gl + 0.6) - 0.04, rr2(p.xy - SCR, vec2(14.4, 10.8), 1.2));
  d = U(d, vec2(ph, 6.0));
  return d;
}

Mat material(float id, vec3 p, vec3 n) {
  if (id == 1.0) {
    // Beige ABS that has yellowed: most at the top, in the vents' warmth, and
    // round the screen; greyer where hands and the dust have been.
    float grain = noise(p * 45.0) * 0.5 + noise(p * 120.0) * 0.5;
    vec3 c = mix(hex(0xb4a888), hex(0xc2b794), fbm(p * 0.3));
    float warm = smoothstep(14.0, 38.0, p.y) * 0.55 + smoothstep(0.5, 0.9, fbm(p * 0.7)) * 0.25;
    c = mix(c, hex(0xc7a966), warm * 0.7);
    c *= 0.95 + 0.1 * grain;
    float dirt = smoothstep(0.55, 0.85, fbm(p * 1.9)) * 0.16;
    c = mix(c, hex(0x857a5f), dirt);
    c = mix(c, hex(0xaaa690), smoothstep(0.7, 1.0, n.y) * smoothstep(0.5, 0.8, noise(p * 6.0)) * 0.25);
    // The glass's frame: dark inside the recess.
    float inRec = step(rr2(p.xy - SCR, vec2(15.5, 11.9), 2.1), 0.0) * step(p.z, 7.8) * step(4.0, p.z);
    c = mix(c, hex(0x1c1c1c), inRec);
    return mat(c, mix(0.5, 0.4, dirt) + 0.08 * grain, 0.0);
  }
  if (id == 2.0) return mat(mix(hex(0xa59c82), hex(0xb5ac90), noise(p * 3.0)), 0.55, 0.0);
  if (id == 4.0) return mat(mix(hex(0xa89f82), hex(0xbab193), noise(p * 5.0)), 0.42, 0.0);
  if (id == 5.0) {
    Mat m = mat(hex(0x1a3a1c), 0.3, 0.0);
    m.emit = vec3(0.1, 0.9, 0.2) * 1.2;
    return m;
  }
  // The phosphor: the picture, scanned, dimmer at the corners.
  vec2 uv = vec2((p.x + 14.4) / 28.8, (p.y - SCR.y + 10.8) / 21.6);
  vec3 c = pow(texture(u_tex, uv).rgb, vec3(2.2));
  float line = 0.88 + 0.12 * cos(p.y * 38.0);
  float tri = 0.96 + 0.04 * cos(p.x * 70.0);
  vec2 e = abs(uv - 0.5) * 2.0;
  float vig = 1.0 - 0.4 * pow(max(e.x, e.y), 3.0) - 0.12 * dot(e, e);
  Mat m = mat(vec3(0.01), 0.6, 0.0);
  m.emit = c * line * tri * vig * 0.95;
  // The room in the glass: a window softbox and a veil.
  vec2 w = (uv - vec2(0.2, 0.8)) / vec2(0.2, 0.12);
  float win = smoothstep(1.0, 0.7, max(abs(w.x), abs(w.y)));
  m.emit += vec3(0.62, 0.66, 0.7) * (0.1 * win + 0.02 * smoothstep(0.1, 1.0, uv.y) * smoothstep(1.0, 0.2, uv.x));
  return m;
}
