/* December 16, 2000: "All your base are belong to us".
 *
 * A 16-bit console cartridge, the kind a bad translation was printed on: a
 * two-part grey ABS shell with a seam down its edge, a ridged band for the
 * thumb at the back, a label sunk in a shallow recess (game-cartridge.svg:
 * a generic blocky craft and the sentence itself), a stepped-in lower end and
 * the board's edge connector showing in its slot. It lies label-up, as it
 * does when it has just been pulled out. Generic shape, no maker's mark.
 * Units: 1 is 1 cm.
 */
#define BOUND vec3(6.9, 1.0, 5.9)
#define CENTRE vec3(0.0, 1.0, -0.2)
#define VIEW_YAW 0.34
#define VIEW_PITCH 0.62
#define FILL 0.82
#define EXPOSURE 1.0
#define COAT(id) (id == 2.0 ? 0.45 : id == 1.0 ? 0.2 : 0.0)
#define SHEEN(id) (id == 1.0 ? 0.25 : 0.0)

float rrect(vec2 p, vec2 c, vec2 h, float r) {
  vec2 d = abs(p - c) - (h - r);
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;
}

float plan(vec2 p) {
  float a = rrect(p, vec2(0.0, -1.6), vec2(6.8, 4.4), 0.55);
  float b = rrect(p, vec2(0.0, 4.1), vec2(5.0, 1.5), 0.4);
  return smin(a, b, 0.4);
}

vec2 map(vec3 p) {
  float pl = plan(p.xz);
  vec2 w = vec2(pl + 0.22, abs(p.y - 1.0) - 1.0 + 0.22);
  float d = min(max(w.x, w.y), 0.0) + length(max(w, 0.0)) - 0.22;
  // the seam where the two halves meet
  d += 0.014 * smoothstep(0.04, 0.0, abs(p.y - 1.0)) * smoothstep(0.0, 0.3, pl + 0.4);
  // the thumb ridges across the back of the top
  float g = abs(mod(p.z + 5.6 + 0.21, 0.42) - 0.21) - 0.065;
  float band = max(abs(p.z + 4.85) - 0.95, abs(p.x) - 6.1);
  d = smax(d, -max(max(g, 1.9 - p.y), band), 0.02);
  // the label's recess
  d = smax(d, -max(rrect(p.xz, vec2(0.0, -0.95), vec2(5.8, 2.95), 0.25), 1.88 - p.y), 0.02);
  // the connector's slot in the lower end
  d = smax(d, -sdBox(p - vec3(0.0, 1.0, 4.9), vec3(4.5, 0.42, 1.1)), 0.04);
  vec2 r = vec2(d, 1.0);
  // the label
  r = U(r, vec2(sdBox(p - vec3(0.0, 1.87, -0.95), vec3(5.75, 0.03, 2.9)) - 0.004, 2.0));
  // the board inside, its fingers at the edge
  r = U(r, vec2(sdBox(p - vec3(0.0, 1.0, 4.2), vec3(4.3, 0.08, 0.95)) - 0.01, 3.0));
  return r;
}

Mat material(float id, vec3 p, vec3 n) {
  if (id == 2.0) {
    vec2 uv = vec2((p.x + 5.8) / 11.6, 1.0 - (p.z + 3.9) / 5.9);
    vec3 c = pow(texture(u_tex, clamp(uv, 0.001, 0.999)).rgb, vec3(2.2));
    // A rubbed corner, a crease from the thumb, dust.
    float rub = smoothstep(0.75, 0.9, fbm(p * vec3(3.0, 3.0, 3.0))) * 0.2;
    c = mix(c, vec3(0.55, 0.52, 0.48), rub);
    return mat(c * 0.85, 0.34, 0.0);
  }
  if (id == 3.0) {
    // The board: dark green, then the gold fingers along the edge, both sides.
    vec3 c = hex(0x10412a);
    float fing = step(4.55, p.z) * step(mod(p.x + 4.2 + 0.14, 0.28), 0.2) * step(abs(p.x), 4.2);
    c = mix(c, hex(0xc9a34a), fing);
    Mat m = mat(c, mix(0.4, 0.22, fing), fing);
    return m;
  }
  // Grey ABS, a touch yellowed, with the moulding's stipple, hand-oil
  // and worn edges where the plastic has been rubbed pale.
  float stip = noise(p * 45.0);
  float age = fbm(p * 1.3);
  vec3 c = mix(hex(0x5f6164), hex(0x75726a), age * 0.8);
  float edge = smoothstep(0.55, 0.0, abs(p.y - 1.0));
  float scuff = smoothstep(0.7, 0.9, fbm(p * 6.0 + 4.0));
  c = mix(c, hex(0xa6a499), scuff * 0.35);
  c *= 0.93 + 0.1 * stip;
  float fing = smoothstep(0.55, 0.9, fbm(vec3(p.xz * 1.1, 7.0)));
  Mat m = mat(c, 0.52 - 0.22 * fing + 0.06 * stip, 0.0);
  return m;
}
