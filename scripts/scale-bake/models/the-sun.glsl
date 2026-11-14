/* The Sun, 1.39 million kilometres across, in white light: granulation — the
   tops of convection cells, each the size of France — sunspots in two belts
   either side of the equator, bright faculae near the edge, and the limb
   darker and redder than the centre because there you see less deep. */
#define STEP 0.9
#define UNLIT
#define FOG
#define EXPOSURE 1.0

const float RAD = 0.482;

vec2 map(vec3 p) { return vec2(length(p) - RAD, 1.0); }

float spots(vec3 d, out float pen) {
  float um = 0.0; pen = 0.0;
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    float lat = (hash11(fi * 3.1) < 0.5 ? 1.0 : -1.0) * radians(8.0 + 18.0 * hash11(fi * 5.7));
    float lon = radians(-60.0 + 120.0 * hash11(fi * 9.3));
    vec3 c = vec3(sin(lon) * cos(lat), sin(lat), cos(lon) * cos(lat));
    float size = 0.012 + 0.03 * hash11(fi * 2.2);
    float r = length(d - c) / size * (1.0 + 0.35 * (fbm(d * 60.0 + fi) - 0.5));
    um = max(um, smoothstep(0.55, 0.4, r));
    pen = max(pen, smoothstep(1.25, 1.05, r));
  }
  return um;
}

Mat material(float id, vec3 p, vec3 n) {
  vec3 d = normalize(p);
  d.xy = rot(0.12) * d.xy;
  float mu = max(n.z, 0.0);
  // granules: bright where the gas rises, dark lanes where it sinks
  vec3 v = voronoi(d * 95.0 + 0.4 * fbm(d * 40.0));
  float gran = smoothstep(0.02, 0.32, v.y - v.x) * (0.85 + 0.3 * v.z);
  float super_ = fbm(d * 12.0);
  float I = 0.72 + 0.34 * gran + 0.12 * (super_ - 0.5);
  float pen;
  float um = spots(d, pen);
  // a penumbra is combed outwards in filaments
  I = mix(I, 0.5 + 0.2 * noise(d * 400.0), pen * 0.8);
  I = mix(I, 0.10, um);
  // faculae: only seen towards the limb
  I += 0.35 * smoothstep(0.62, 0.8, fbm(d * 22.0 + 3.0)) * smoothstep(0.75, 0.3, mu);
  // limb darkening, stronger in blue than in red
  vec3 limb = vec3(1.0) - vec3(0.42, 0.62, 0.80) * (1.0 - pow(mu, 0.55));
  vec3 col = vec3(1.0, 0.72, 0.36) * limb * (0.25 + I * I) * 0.95;
  Mat m = mat(vec3(0.0), 1.0, 0.0);
  m.emit = col;
  return m;
}

/* The chromosphere: a thin red rim, ragged with spicules, and what little of
   the corona fits in the frame. */
vec4 fog(vec3 ro, vec3 rd, float tmax) {
  float b = length(ro.xy);
  if (b < RAD - 0.002) return vec4(0.0);
  float ang = atan(ro.y, ro.x);
  float h = (b - RAD) / 0.012;
  float spic = 0.6 + 0.8 * noise(vec2(ang * 90.0, 1.0)) + 0.6 * noise(vec2(ang * 260.0, 4.0));
  float chromo = exp(-h * 2.2 / spic);
  // a prominence or two
  float prom = exp(-pow((ang - 0.9) / 0.05, 2.0)) * exp(-pow((h - 1.6) / 0.9, 2.0)) + 0.8 * exp(-pow((ang + 2.2) / 0.035, 2.0)) * exp(-pow((h - 1.1) / 0.7, 2.0));
  float corona = 0.16 * exp(-h * 0.45) * (0.7 + 0.5 * noise(vec2(ang * 7.0, 2.0)));
  vec3 c = vec3(1.0, 0.25, 0.12) * (chromo * 0.9 + prom) + vec3(1.0, 0.92, 0.8) * corona;
  float a = clamp(chromo * 0.9 + prom + corona, 0.0, 1.0);
  return vec4(min(c, vec3(1.0)) * 1.0, a);
}
