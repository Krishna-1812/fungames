/* The Burj Khalifa, 828 metres: three wings round a hexagonal core, each wing
   stepping back in turn so the setbacks climb in a spiral — twenty-seven of
   them — until only the core is left, and then a spire. Glass and steel. */
#define STEP 0.4
#define VIEW_YAW 0.5
#define VIEW_PITCH 0.02
#define EXPOSURE 0.72

const float WING = 0.050;       // how far a wing reaches at the ground
const float TOP = 0.72;         // where the last wing gives out

float wingLength(float t, float wi) {
  float tier = floor(t / TOP * 9.0 + wi / 3.0);
  return WING * max(0.0, 1.0 - tier / 9.3);
}

float plan(vec2 q, float t) {
  float ang = atan(q.y, q.x);
  float sector = TAU / 3.0;
  float wi = floor((ang + sector * 0.5) / sector);
  float a3 = ang - wi * sector;
  float r = length(q);
  vec2 l = vec2(r * cos(a3), r * sin(a3));
  wi = mod(wi + 3.0, 3.0);
  float L = wingLength(t, wi);
  float ww = 0.0095 * (0.55 + 0.45 * L / WING);
  // a wing: a bar from the core out, round at the nose
  vec2 b = abs(l - vec2(L * 0.5, 0.0)) - vec2(L * 0.5 - ww, 0.0);
  float wing = length(max(b, 0.0)) - ww;
  if (L < 0.004) wing = 1.0;
  float core = r - mix(0.0145, 0.0075, smoothstep(0.0, 0.8, t));
  return min(wing, core);
}

vec2 map(vec3 p) {
  float t = p.y + 0.5;
  float d = plan(p.xz, clamp(t, 0.0, 1.0));
  d = max(d, t - 0.80);
  // the spire: telescoping tubes
  float sp = max(length(p.xz) - mix(0.0058, 0.0009, smoothstep(0.78, 0.995, t)) * (1.0 + 0.25 * step(t, 0.86) + 0.2 * step(t, 0.92)), t - 0.998);
  d = min(d, max(sp, 0.78 - t));
  d = max(d, -t);
  return vec2(d, 1.0);
}

Mat material(float id, vec3 p, vec3 n) {
  float t = p.y + 0.5;
  // floors, and the darker bands where the plant rooms are
  float floors = smoothstep(0.35, 0.5, abs(fract(t * 163.0 / 0.80) - 0.5));
  float plant = step(0.94, fract(t / 0.80 * 5.4 + 0.3));
  // the vertical steel fins
  float fin = smoothstep(0.3, 0.45, abs(fract((p.x + p.z * 0.7) * 520.0) - 0.5));
  vec3 alb = mix(hex(0x7f9db3), hex(0xb9c7d0), fin * 0.6);
  alb *= 1.0 - 0.22 * floors;
  alb = mix(alb, hex(0x56636e), plant * 0.8);
  if (t > 0.80) alb = hex(0xb9c0c6);
  return mat(alb, 0.16 + 0.12 * floors, 0.9);
}
