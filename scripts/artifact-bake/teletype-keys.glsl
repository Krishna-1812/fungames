/* 1971: the first network email.
 *
 * Ray Tomlinson sent it between two machines side by side, typing, as he
 * remembered it, something like QWERTYUIOP. This is the kind of keyboard he
 * typed it on: an early-seventies teleprinter's, unbranded. Four stepped rows
 * of tall round keycaps with dished tops, cream legends on dark caps, in a
 * sloped hammer-grey metal case with a long space bar. The legends are
 * teletype-keys.svg, a 12 x 5 atlas of 128px cells (one per cap, row 0 at the
 * back, uv 0,0 bottom left). Paint worn at the edges, finger-shine on the
 * caps, a little dust. Units: 1 is 1 cm.
 */
#define BOUND vec3(13.6, 3.9, 6.4)
#define CENTRE vec3(0.0, 3.9, 0.0)
#define VIEW_YAW 0.34
#define VIEW_PITCH 0.50
#define FILL 0.74
#define EXPOSURE 1.12
#define COAT(id) (id == 2.0 ? 0.35 : 0.0)
#define SHEEN(id) (id == 1.0 ? 0.25 : 0.0)

const float SL = 0.30;                                  // the slope of the key plane
const vec3 NRM = vec3(0.0, cos(SL), sin(SL));
const vec3 DIR = vec3(0.0, sin(SL), -cos(SL));
const vec3 ORG = vec3(0.0, 2.2, 6.0);                  // the plane's front edge
const float PITCH = 1.9, RPITCH = 2.05, KR = 0.75, KH = 1.55;
const float BACKB = 10.8;                               // b of the number row

/* The frame of the key plane: x along the rows, y out of the plane, z up the slope. */
vec3 fr(vec3 p) { vec3 r = p - ORG; return vec3(r.x, dot(r, NRM), dot(r, DIR)); }

float rowOff(float j) { return j < 0.5 ? 0.0 : j < 1.5 ? 0.35 : j < 2.5 ? 0.7 : 1.05; }

/* Which cap is under a point: x column, y row, then the cap's centre a and b. */
vec4 capAt(vec3 f) {
  float j = clamp(floor((BACKB - f.z) / RPITCH + 0.5), 0.0, 3.0);
  float o = rowOff(j);
  float i = clamp(floor((f.x - o) / PITCH + 6.0), 0.0, 11.0);
  return vec4(i, j, (i - 5.5) * PITCH + o, BACKB - j * RPITCH);
}

float cap(vec3 lp, float r) {
  float k = sdCyl(lp - vec3(0.0, KH * 0.5, 0.0), r - 0.1, KH * 0.5 - 0.1) - 0.1;
  float R = 2.5, dp = 0.13;
  float dish = length(lp - vec3(0.0, KH + R - dp, 0.0)) - R;
  return smax(k, -dish, 0.05);
}

vec2 map(vec3 p) {
  vec3 f = fr(p);
  // The case: a wedge under the slope, a raised rail along the back.
  float box = sdRound(p - vec3(0.0, 3.6, 0.0), vec3(13.2, 3.6, 6.0), 0.22);
  float body = smax(box, f.y, 0.14);
  float rail = sdRound(vec3(f.x, f.y - 0.5, f.z - 11.9), vec3(13.0, 0.52, 0.62), 0.2);
  body = smin(body, rail, 0.18);
  // Key sockets cut into the top plate.
  vec4 c = capAt(f);
  vec3 lp = vec3(f.x - c.z, f.y, f.z - c.w);
  body = smax(body, -max(length(lp.xz) - (KR + 0.17), -(f.y + 0.30)), 0.04);
  // The space bar's socket.
  float sbz = BACKB - 4.0 * RPITCH + 0.05;
  vec3 sp = vec3(f.x, f.y, f.z - sbz);
  body = smax(body, -max(sdBox(vec3(sp.x, 0.0, sp.z), vec3(6.75, 1.0, 0.9)), -(f.y + 0.30)), 0.04);
  vec2 d = vec2(body, 1.0);

  // The caps.
  float k = cap(lp, KR);
  float bar = sdRound(vec3(sp.x, f.y - 0.6, sp.z), vec3(6.35, 0.6, 0.62), 0.14);
  float dishb = length(vec2(sp.z, f.y - 1.2 - 2.0 + 0.1)) - 2.0;
  bar = smax(bar, -dishb, 0.08);
  d = U(d, vec2(min(k, bar), 2.0));

  // Four screws that hold the top plate down.
  vec3 sc = vec3(abs(f.x) - 12.45, f.y, abs(f.z - 6.3) - 5.35);
  float screw = max(length(sc.xz) - 0.25, abs(f.y + 0.02) - 0.05) - 0.03;
  if (abs(f.x) > 11.0) d = U(d, vec2(screw, 3.0));
  return d;
}

Mat material(float id, vec3 p, vec3 n) {
  vec3 f = fr(p);
  if (id == 1.0) {
    // Hammer-grey enamel, warm: orange peel in the roughness, bright where
    // hands and edges have worn it back to the metal.
    vec3 c = hex(0x7d7867);
    float peel = noise(p * 26.0);
    float flat1 = max(max(dot(n, NRM), abs(n.x)), max(abs(n.z), abs(n.y)));
    float edge = smoothstep(0.995, 0.86, flat1) * smoothstep(0.35, 0.7, fbm(p * 4.0));
    float soil = smoothstep(0.4, 0.9, fbm(p * 1.3 + 3.0));
    c = mix(c, c * vec3(0.84, 0.8, 0.72), soil * 0.5);
    c = mix(c, hex(0x8c8e90), edge * 0.8);
    // the front plinth is a darker band
    float low = smoothstep(1.1, 0.95, p.y) * step(0.5, abs(n.z) + abs(n.x));
    c = mix(c, hex(0x6f6d63), low);
    // The slot round each cap is black.
    vec4 ca = capAt(f);
    float rr = length(vec2(f.x - ca.z, f.z - ca.w));
    float sbz = BACKB - 4.0 * RPITCH + 0.05;
    float inSock = max(smoothstep(KR + 0.17, KR + 0.12, rr) * step(0.0, 0.5 - ca.y), 0.0);
    float inBar = step(abs(f.x), 6.75) * step(abs(f.z - sbz), 0.9);
    float dark = max(inSock, inBar) * smoothstep(-0.05, -0.2, f.y);
    c = mix(c, hex(0x0b0b0c), dark);
    // A line where the plate meets the body.
    float seam = smoothstep(0.03, 0.0, abs(f.y + 1.25)) * step(0.5, abs(n.z) + abs(n.x));
    c *= 1.0 - 0.5 * seam;
    return mat(c, 0.52 + 0.1 * peel - 0.15 * edge, edge * 0.4);
  }
  if (id == 2.0) {
    // The caps: dark ABS, the legend on top, a worn shine where fingers land.
    vec4 ca = capAt(f);
    float isBar = step(abs(f.z - (BACKB - 4.0 * RPITCH + 0.05)), 0.9) * step(abs(f.x), 6.8);
    vec2 lp = vec2(f.x - ca.z, f.z - ca.w);
    vec3 c = hex(0x252427);
    float legend = 0.0;
    if (isBar < 0.5 && n.y > -2.0) {
      vec2 uv = vec2((ca.x + 0.5 + lp.x / (2.0 * KR)) / 12.0, 1.0 - (ca.y + 0.5 - lp.y / (2.0 * KR)) / 5.0);
      float topMask = smoothstep(KR - 0.08, KR - 0.15, length(lp)) * smoothstep(KH - 0.22, KH - 0.12, f.y);
      legend = texture(u_tex, uv).r * topMask;
      float wornL = smoothstep(0.35, 0.8, fbm(p * 9.0));
      legend *= 1.0 - 0.45 * wornL;
    }
    float shine = smoothstep(0.55, 0.9, fbm(p * 5.0 + ca.x * 3.1 + ca.y * 7.7));
    c = mix(c, hex(0x403f42), shine * 0.55);
    c = mix(c, hex(0xe6dcbc), legend);
    float rough = mix(0.34, 0.22, shine) + 0.08 * noise(p * 50.0);
    rough = mix(rough, 0.55, legend);
    return mat(c, rough, 0.0);
  }
  // Screws: zinc.
  return mat(hex(0x9a9ea2), 0.4, 1.0);
}
