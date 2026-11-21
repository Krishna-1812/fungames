/* May 3, 1978: the first spam email.
 *
 * What a mainframe's line printer left of it: a short stack of green-bar
 * continuous fanfold paper, 14 7/8 by 11 inches, a sheet to every perforation,
 * tractor-feed holes down both margins at half-inch pitch. The top sheet
 * (spam-printout.svg) carries the message in dot-matrix capitals: the mail
 * header, then the first lines of the announcement. The sheets are joined by
 * folds that zig-zag, the first at the back and the next at the front, and
 * each sheet bellies a little between its folds. Thin paper, matt, a little
 * translucent. Units: 1 is 1 cm.
 */
#define BOUND vec3(19.1, 2.0, 14.4)
#define CENTRE vec3(0.0, 2.0, 0.0)
#define VIEW_YAW 0.30
#define VIEW_PITCH 0.95
#define FILL 0.68
#define EXPOSURE 1.05

const int N = 7;           // sheets in the stack
const float S = 0.5;      // their pitch
const float HT = 0.03;   // half a sheet's thickness
const float XH = 18.9;     // half the sheet's width
const float ZH = 13.97;    // half its length (11 in)

float belly(int i) { return 0.08 + 0.2 * hash11(float(i) * 3.7 + 1.0); }

float sheet(vec3 p, int i) {
  float z = clamp(p.z / ZH, -1.0, 1.0);
  float y = (float(i) + 0.5) * S + belly(i) * (1.0 - z * z) * (i == N - 1 ? 1.0 : 0.8);
  float dy = (p.y - y) * 0.85;
  float edge = max(abs(p.x) - XH, abs(p.z) - ZH);
  float slab = max(abs(dy) - HT, edge);
  if (abs(p.x) > 17.7) {
    float zr = mod(p.z + ZH, 1.27) - 0.635;
    slab = max(slab, 0.2 - length(vec2(abs(p.x) - 18.27, zr)));
  }
  return slab;
}

vec2 map(vec3 p) {
  int i0 = int(clamp(floor(p.y / S), 0.0, float(N - 1)));
  float d = sheet(p, i0);
  d = min(d, sheet(p, max(i0 - 1, 0)));
  d = min(d, sheet(p, min(i0 + 1, N - 1)));
  // The folds between neighbouring sheets: half a tube, back then front.
  float j = clamp(floor(p.y / S + 0.5), 1.0, float(N - 1));
  float back = mod(float(N - 1) - j, 2.0) < 0.5 ? 1.0 : -1.0;
  float o = back * -p.z - ZH;               // how far out past the sheets' ends
  float r = length(vec2(o, p.y - j * S));
  float fold = max(max(abs(r - S * 0.5) - HT, -o + 0.0), abs(p.x) - XH);
  d = min(d, fold);
  return vec2(d, 1.0);
}

Mat material(float id, vec3 p, vec3 n) {
  vec3 c;
  if (abs(p.z) > ZH + 0.01) {
    // On a fold the green bar and the white one meet at the crease.
    c = (p.y > floor(p.y / S + 0.5) * S) ? hex(0xf0efe5) : hex(0x8fc088);
  } else if (abs(n.y) < 0.55) {
    c = hex(0xe4e7da) * (0.8 + 0.2 * noise(p * 14.0));
  } else if (n.y > 0.0) {
    vec2 uv = vec2(clamp(p.x / (2.0 * XH) + 0.5, 0.0, 1.0), clamp(0.5 - p.z / (2.0 * ZH), 0.0, 1.0));
    c = pow(texture(u_tex, uv).rgb, vec3(2.2));
  } else {
    c = hex(0xe6e8de);
  }
  // Fibre and a little grey from handling; fold lines soiled.
  c *= 0.9 + 0.1 * noise(p * vec3(30.0, 30.0, 30.0));
  float soil = smoothstep(0.5, 0.9, fbm(p * 0.9)) * 0.08;
  c *= 1.0 - soil;
  float foldLine = smoothstep(ZH - 0.6, ZH + 0.3, abs(p.z));
  c *= 1.0 - 0.18 * foldLine;
  Mat m = mat(c * 0.74, 0.88, 0.0);
  m.sss = 0.35;
  return m;
}
