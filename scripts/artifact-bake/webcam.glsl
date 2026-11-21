/* December 6, 2004: the Numa Numa Dance.
 *
 * A USB webcam of the mid-2000s, the kind a teenager lip-synced into: a glossy
 * silver ball for a head, 4.6 cm across, its face a flat black plate round a
 * chrome bezel with a ribbed focus ring and a lens of three glass elements
 * (the front one clear, the second coated so it throws purple and green, the
 * sensor behind them black), a green power LED above; the ball rests in a cup
 * on a hinged stand with a flat foot and a gripping clip arm that folds back;
 * the black USB cable runs off to a plug lying on the desk. No maker's mark.
 * Units: 1 is 1 cm.
 */
#define BOUND vec3(6.2, 3.7, 4.8)
#define CENTRE vec3(-1.5, 3.7, -0.4)
#define VIEW_YAW 0.46
#define VIEW_PITCH 0.22
#define FILL 0.97
#define EXPOSURE 1.15
#define GLASS 1.0
#define GLASS_TINT vec3(0.96, 0.98, 0.98)
#define COAT(id) (id == 2.0 ? 0.55 : id == 3.0 ? 0.6 : 0.0)
#define SHEEN(id) (id == 2.0 ? 0.35 : id == 6.0 ? 0.3 : 0.0)

const vec3 BC = vec3(0.0, 4.95, 0.0);      // the ball's centre
const float RB = 2.3;                       // its radius
const vec3 HG = vec3(0.0, 1.1, -2.3);       // the hinge

float rrect(vec2 p, vec2 c, vec2 h, float r) {
  vec2 d = abs(p - c) - (h - r);
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;
}

vec3 iaView() { return vec3(sin(VIEW_YAW) * cos(VIEW_PITCH), sin(VIEW_PITCH), cos(VIEW_YAW) * cos(VIEW_PITCH)); }

vec2 head(vec3 pb) {
  // the ball, flattened on the face, bored for the lens
  float ball = smax(length(pb) - RB, pb.z - 1.55, 0.05);
  ball = smax(ball, -max(length(pb.xy) - 0.97, 0.95 - pb.z), 0.02);
  // the seam where the two shells meet
  ball += 0.012 * smoothstep(0.06, 0.0, abs(pb.z + 0.15));
  vec2 d = vec2(ball, 2.0);
  if (pb.z > 1.5 && length(pb.xy) < 1.66) d.y = 3.0;       // the black face
  // chrome bezel round the face
  float bez = sdTorus(vec3(pb.x, pb.z - 1.57, pb.y), 1.7, 0.075);
  d = U(d, vec2(bez, 4.0));
  // the barrel with its ribbed focus ring
  float a = atan(pb.y, pb.x);
  float barrel = sdCyl(vec3(pb.x, pb.z - 1.75, pb.y), 1.3 + 0.025 * smoothstep(0.2, 0.7, sin(a * 64.0)), 0.2) - 0.02;
  barrel = smax(barrel, -max(length(pb.xy) - 0.95, 1.2 - pb.z), 0.015);
  d = U(d, vec2(barrel, 5.0));
  // the black bore, the sensor at the bottom of it
  d = U(d, vec2(sdCyl(vec3(pb.x, pb.z - 1.0, pb.y), 0.9, 0.03), 3.0));
  d = U(d, vec2(sdTorus(vec3(pb.x, pb.z - 1.7, pb.y), 0.95, 0.045), 4.0));
  d = U(d, vec2(sdTorus(vec3(pb.x, pb.z - 1.15, pb.y), 0.83, 0.05), 11.0));
  // the front element, clear; a coated one behind it
  float front = max(length(pb - vec3(0.0, 0.0, 0.095)) - 1.855, 1.7 - pb.z);
  front = max(front, length(pb.xy) - 0.93);
  d = U(d, vec2(front, 1.0));
  float second = max(length(pb - vec3(0.0, 0.0, 0.045)) - 1.405, 1.2 - pb.z);
  second = max(second, length(pb.xy) - 0.8);
  d = U(d, vec2(second, 6.0));
  // the LED, in its little window above the lens
  d = U(d, vec2(sdCyl(vec3(pb.x, pb.z - 1.56, pb.y - 1.3), 0.075, 0.025), 7.0));
  return d;
}

float stand(vec3 p) {
  // the foot: flat, rounded, rubber ridges on top
  vec2 w = vec2(rrect(p.xz, vec2(0.0, 0.2), vec2(3.2, 3.1), 1.1) + 0.2, abs(p.y - 0.3) - 0.3 + 0.2);
  float foot = min(max(w.x, w.y), 0.0) + length(max(w, 0.0)) - 0.2;
  // the hinge barrel and the stem to the cup
  float hinge = sdCyl(vec3(p.y - HG.y, p.x, p.z - HG.z), 0.62, 1.25) - 0.03;
  float stem = sdCapsule(p, HG, vec3(0.0, 3.05, -1.35), 0.5);
  float d = smin(foot, hinge, 0.12);
  d = smin(d, stem, 0.15);
  // the cup that holds the ball: the lower cap of a shell round it
  vec3 pb = p - BC;
  float cup = max(abs(length(pb) - (RB + 0.14)) - 0.14, pb.y + 1.15);
  cup = max(cup, -(pb.z - 1.2) * 0.0 + (pb.z > 0.9 && pb.y > -1.9 ? 0.0 : 0.0));
  d = smin(d, cup, 0.1);
  // the clip arm: a plate that swings back from the hinge, gripping pad on it
  vec3 dir = normalize(vec3(0.0, 0.52, -0.85)), nrm = vec3(0.0, 0.85, 0.52);
  vec3 r = p - HG;
  vec3 l = vec3(r.x, dot(r, nrm), dot(r, dir));
  float arm = sdRound(l - vec3(0.0, -0.05, 2.35), vec3(1.4, 0.22, 2.35), 0.16);
  d = min(d, arm);
  return d;
}

vec2 map(vec3 p) {
  vec3 pb = p - BC;
  vec2 d = vec2(1e3, 2.0);
  float bb = length(pb) - 2.9;
  if (bb < 0.5) d = head(pb); else d = vec2(bb - 0.3, 2.0);
  // the stand, dark satin
  float st = stand(p);
  d = U(d, vec2(st, 8.0));
  // the cable: from the foot's left side round to the plug, and the plug
  float c = sdCapsule(p, vec3(-3.0, 0.4, 0.0), vec3(-4.0, 0.17, -0.8), 0.17);
  c = min(c, sdCapsule(p, vec3(-4.0, 0.17, -0.8), vec3(-5.2, 0.17, -0.7), 0.17));
  c = min(c, sdCapsule(p, vec3(-5.2, 0.17, -0.7), vec3(-5.95, 0.17, 0.5), 0.17));
  c = min(c, sdCapsule(p, vec3(-5.95, 0.17, 0.5), vec3(-5.6, 0.17, 1.8), 0.17));
  c = min(c, sdCapsule(p, vec3(-5.6, 0.17, 1.8), vec3(-5.35, 0.2, 2.5), 0.17));
  d = U(d, vec2(c, 9.0));
  // the USB plug: moulded collar, steel shell
  d = U(d, vec2(sdRound(p - vec3(-5.35, 0.3, 3.0), vec3(0.42, 0.3, 0.55), 0.12), 9.0));
  float plug = sdRound(p - vec3(-5.35, 0.24, 4.05), vec3(0.62, 0.22, 0.95), 0.05);
  plug = smax(plug, -sdBox(p - vec3(-5.35, 0.24, 5.0), vec3(0.5, 0.1, 0.25)), 0.02);
  d = U(d, vec2(plug, 10.0));
  return d;
}

Mat material(float id, vec3 p, vec3 n) {
  vec3 pb = p - BC;
  if (id == 2.0) {
    // Glossy silver: a vacuum-metallised shell, fine orange-peel, a little oil.
    float peel = noise(p * 70.0);
    float oil = smoothstep(0.55, 0.9, fbm(p * 2.2));
    Mat m = mat(hex(0xb4b9c0) * (0.94 + 0.08 * peel), 0.16 + 0.2 * oil + 0.03 * peel, 0.9);
    return m;
  }
  if (id == 3.0) return mat(hex(0x050607), 0.12 + 0.05 * noise(p * 40.0), 0.0);
  if (id == 4.0) return mat(hex(0xc9ccd0), 0.12, 1.0);
  if (id == 5.0) {
    // The focus ring: anodised black, with a bright edge on the ribs.
    float a = atan(pb.y, pb.x);
    float rib = smoothstep(0.2, 0.7, sin(a * 64.0)) * smoothstep(0.6, 0.2, abs(n.z));
    return mat(mix(hex(0x0c0d0f), hex(0x4a4d52), rib * 0.6), 0.3 + 0.1 * rib, 0.7);
  }
  if (id == 6.0) {
    // The coated element: a deep blue-violet that goes green at a slant.
    vec3 v = iaView();
    float f = 1.0 - clamp(dot(normalize(n + vec3(0.0, 0.0, 0.0001)), v) * 0.5 + 0.5, 0.0, 1.0);
    float rr = length(pb.xy);
    vec3 col = mix(vec3(0.02, 0.03, 0.09), vec3(0.08, 0.38, 0.22), smoothstep(0.1, 0.5, rr + f * 0.5));
    col = mix(col, vec3(0.5, 0.1, 0.75), smoothstep(0.5, 0.78, rr + f * 0.3));
    Mat m = mat(vec3(0.01, 0.012, 0.02), 0.08, 0.0);
    m.emit = col * 0.3;
    return m;
  }
  if (id == 7.0) {
    Mat m = mat(vec3(0.02, 0.1, 0.03), 0.3, 0.0);
    m.emit = vec3(0.15, 1.2, 0.35);
    return m;
  }
  if (id == 8.0) {
    // The stand: graphite satin plastic, rubber ridges on the foot's top.
    float ridge = smoothstep(0.35, 0.5, abs(fract(p.x * 1.6) - 0.5)) * step(0.5, p.y) * step(p.y, 0.7) * step(abs(p.z - 0.2), 2.4);
    Mat m = mat(hex(0x1d1f23) * (0.9 + 0.3 * noise(p * 30.0)) * (1.0 - 0.3 * ridge), 0.42 + 0.1 * noise(p * 8.0), 0.0);
    return m;
  }
  if (id == 9.0) return mat(hex(0x0b0c0d) * (0.9 + 0.5 * noise(p * 20.0)), 0.5, 0.0);
  if (id == 11.0) { Mat m = mat(vec3(0.02), 0.2, 0.0); m.emit = vec3(0.5, 0.15, 0.8) * 0.25; return m; }
  return mat(hex(0xb8bcc2), 0.28 + 0.2 * noise(p * 50.0), 1.0);
}
