/* B-DNA, 2 nanometres across: two turns of the double helix, each atom group
   a ball — phosphate and sugar along the two backbones, and the base pairs as
   the rungs between, ten and a half to a turn, with the two grooves unequal
   because the backbones are not opposite each other. */
#define STEP 0.8
#define VIEW_PITCH 0.1

const float PITCH = 0.5;      // one turn, in units where two turns are the height
const float PER = 10.5;       // base pairs a turn
const float RB = 0.118;       // radius the backbone runs at
const float GROOVE = 2.35;    // angle between the strands: not PI, hence two grooves

vec3 baseColour(float h) {
  return h < 0.25 ? hex(0x3f8f6a) : h < 0.5 ? hex(0xc24a52) : h < 0.75 ? hex(0x3f6fb5) : hex(0x8a5cc0);
}

vec2 map(vec3 p) {
  float step_ = PITCH / PER;
  float k0 = floor(p.y / step_ + 0.5);
  vec2 res = vec2(1.0, 0.0);
  for (int i = -2; i <= 2; i++) {
    float k = k0 + float(i);
    float y = k * step_;
    if (abs(y) > 0.47) continue;
    float th = k * TAU / PER;
    vec3 a = vec3(cos(th) * RB, y, sin(th) * RB);
    vec3 b = vec3(cos(th + GROOVE) * RB, y + 0.012, sin(th + GROOVE) * RB);
    // phosphate, then the sugar a little inboard and along
    res = U(res, vec2(sdSphere(p - a, 0.030), 1.0));
    res = U(res, vec2(sdSphere(p - b, 0.030), 1.0));
    float th2 = th + 0.33;
    vec3 sa = vec3(cos(th2) * RB * 0.74, y + 0.016, sin(th2) * RB * 0.74);
    vec3 sb = vec3(cos(th2 + GROOVE - 0.66) * RB * 0.74, y + 0.004, sin(th2 + GROOVE - 0.66) * RB * 0.74);
    res = U(res, vec2(sdSphere(p - sa, 0.024), 2.0));
    res = U(res, vec2(sdSphere(p - sb, 0.024), 2.0));
    // the base pair: two flat plates meeting in the middle
    vec3 mid = (sa + sb) * 0.5;
    float da = sdCapsule(p, sa * 0.86, mix(sa, mid, 0.93), 0.0185);
    float db = sdCapsule(p, sb * 0.86, mix(sb, mid, 0.93), 0.0185);
    res = U(res, vec2(da, 10.0 + mod(k + 64.0, 64.0)));
    res = U(res, vec2(db, 80.0 + mod(k + 64.0, 64.0)));
  }
  return res;
}

Mat material(float id, vec3 p, vec3 n) {
  if (id < 1.5) return mat(hex(0x8f97a8), 0.35, 0.0);
  if (id < 2.5) return mat(hex(0x55607a), 0.4, 0.0);
  float k = id < 79.5 ? id - 10.0 : id - 80.0;
  float h = hash11(k * 3.17 + 1.0);
  // A pairs with T and G with C, so the far half is the partner's colour.
  if (id > 79.5) h = h < 0.5 ? 0.49 - h : 1.49 - h;
  return mat(baseColour(clamp(h, 0.0, 0.999)), 0.38, 0.0);
}
