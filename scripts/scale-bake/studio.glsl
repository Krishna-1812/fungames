/* The camera and the lights. Appended after the model, which has defined
   map() and material() by now. */

#ifndef VIEW_YAW
#define VIEW_YAW 0.0
#endif
#ifndef VIEW_PITCH
#define VIEW_PITCH 0.0
#endif
#ifndef STEP
#define STEP 1.0
#endif
#ifndef EXPOSURE
#define EXPOSURE 1.0
#endif
#ifndef SHADOW
#define SHADOW 1.0
#endif

const vec3 KEY = normalize(vec3(-0.42, 0.52, 0.74));
const vec3 RIM = normalize(vec3(0.75, 0.35, -0.55));

vec3 normalAt(vec3 p) {
  const vec2 e = vec2(1.0, -1.0) * 0.00035;
  return normalize(e.xyy * map(p + e.xyy).x + e.yyx * map(p + e.yyx).x + e.yxy * map(p + e.yxy).x + e.xxx * map(p + e.xxx).x);
}

float shadow(vec3 p, vec3 l) {
  float res = 1.0, t = 0.004;
  for (int i = 0; i < 90; i++) {
    float h = map(p + l * t).x;
    res = min(res, 9.0 * h / t);
    t += clamp(h * STEP, 0.003, 0.06);
    if (res < 0.002 || t > 2.5) break;
  }
  return clamp(res, 0.0, 1.0);
}

float occlusion(vec3 p, vec3 n) {
  float occ = 0.0, w = 1.0;
  for (int i = 1; i <= 6; i++) {
    float h = 0.012 * float(i) * float(i) * 0.45 + 0.004;
    occ += (h - map(p + n * h).x) * w;
    w *= 0.72;
  }
  return clamp(1.0 - 2.6 * occ, 0.0, 1.0);
}

/* A photographer's room rather than a place: bright overhead, a softbox where
   the key is, a cool strip behind, a dim floor. Only reflections see it. */
vec3 room(vec3 d) {
  // A white sweep under everything, so a surface that faces down still has
  // something to reflect.
  vec3 c = mix(vec3(0.34, 0.35, 0.37), vec3(0.62, 0.70, 0.82), smoothstep(-0.5, 0.75, d.y));
  c *= 0.75 + 0.5 * smoothstep(-0.2, 0.2, sin(d.x * 5.0 + d.y * 2.0));
  c += vec3(1.0, 0.96, 0.9) * 4.0 * smoothstep(0.62, 0.96, dot(d, KEY));
  c += vec3(0.55, 0.7, 1.0) * 2.2 * smoothstep(0.80, 0.95, dot(d, RIM));
  c += vec3(0.9) * 1.2 * smoothstep(0.90, 0.99, d.y);
  return c;
}

float ggx(float nh, float a) { float a2 = a * a; float d = nh * nh * (a2 - 1.0) + 1.0; return a2 / (PI * d * d); }

vec3 lightFrom(vec3 l, vec3 lc, vec3 n, vec3 v, Mat m, vec3 f0) {
  float nl = dot(n, l);
  // Wrapped where light gets through the body, so a cell or a hand has no
  // hard terminator.
  float wrap = m.sss * 0.6;
  float diff = max(0.0, (nl + wrap) / (1.0 + wrap));
  vec3 h = normalize(l + v);
  float nh = max(dot(n, h), 0.0), vh = max(dot(v, h), 0.0);
  float a = max(m.rough * m.rough, 0.02);
  vec3 f = f0 + (1.0 - f0) * pow(1.0 - vh, 5.0);
  float spec = ggx(nh, a) * 0.25 / max(0.25, mix(1.0, vh * vh * 4.0, 0.5));
  return lc * (m.alb * (1.0 - m.metal) * diff / PI * 3.0 + f * spec * max(nl, 0.0));
}

vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }

void main() {
  vec2 uv = ((gl_FragCoord.xy + u_jit) / u_res * 2.0 - 1.0) * u_half;
  mat2 ry = rot(VIEW_YAW), rx = rot(VIEW_PITCH);
  vec3 ro = vec3(uv, 3.0), rd = vec3(0.0, 0.0, -1.0);
  ro.yz = rx * ro.yz; rd.yz = rx * rd.yz;
  ro.xz = ry * ro.xz; rd.xz = ry * rd.xz;

  float t = 0.0; vec2 h = vec2(1.0, 0.0); bool hit = false;
  for (int i = 0; i < 320; i++) {
    h = map(ro + rd * t);
    if (h.x < 0.00018) { hit = true; break; }
    t += h.x * STEP;
    if (t > 6.0) break;
  }
  if (!hit) { o = vec4(0.0); return; }

  vec3 p = ro + rd * t;
  vec3 n = normalAt(p);
  vec3 v = -rd;
  Mat m = material(h.y, p, n);
  vec3 f0 = mix(vec3(0.04), m.alb, m.metal);

  // The lights live in the camera's frame, so turning the view to show an
  // object from its better side does not turn the light with it.
  vec3 key = KEY, rim = RIM;
  key.yz = rx * key.yz; key.xz = ry * key.xz;
  rim.yz = rx * rim.yz; rim.xz = ry * rim.xz;

  float sh = mix(1.0, shadow(p + n * 0.002, key), SHADOW);
  float ao = occlusion(p, n);
  vec3 col = lightFrom(key, vec3(1.0, 0.96, 0.9) * 1.25, n, v, m, f0) * sh;
  col += lightFrom(rim, vec3(0.6, 0.75, 1.0) * 0.55, n, v, m, f0);

  // Sky dome and bounce from below.
  vec3 up = vec3(0.0, 1.0, 0.0); up.yz = rx * up.yz; up.xz = ry * up.xz;
  float sky = 0.5 + 0.5 * dot(n, up);
  vec3 amb = mix(vec3(0.20, 0.17, 0.15), vec3(0.50, 0.58, 0.72), sky) * 0.62;
  col += m.alb * (1.0 - m.metal) * amb * ao;

  // The room in the surface. Rougher things see a dimmer, flatter room.
  vec3 r = reflect(rd, n);
  vec3 rr = r; // back into the room's own frame
  rr.xz = rot(-VIEW_YAW) * rr.xz; rr.yz = rot(-VIEW_PITCH) * rr.yz;
  float nv = max(dot(n, v), 0.0);
  vec3 fres = f0 + (max(vec3(1.0 - m.rough), f0) - f0) * pow(1.0 - nv, 5.0);
  vec3 refl = mix(room(rr), vec3(0.42, 0.46, 0.52), smoothstep(0.1, 0.8, m.rough));
  col += refl * fres * ao * mix(1.0, 0.35, m.rough);

  // Light through the body: the far side of the key shows as a warm edge.
  if (m.sss > 0.0) {
    float back = pow(clamp(dot(v, -key) * 0.5 + 0.5, 0.0, 1.0), 2.0) * (1.0 - nv);
    col += m.alb * vec3(1.0, 0.55, 0.4) * back * m.sss * 0.9;
  }
  col += m.emit;

  col = aces(col * EXPOSURE);
  o = vec4(col, 1.0);
}
