/* The Moon, 3,474 kilometres across, the side that faces us: the maria where
   they are — Imbrium, Serenitatis, Tranquillitatis, Crisium, the Ocean of
   Storms down the western limb — and Tycho in the south with its rays. */
#define STEP 0.7
#define SHADOW 1.0
#define EXPOSURE 0.95

const float RAD = 0.4985;

vec3 at(float lon, float lat) {
  lon = radians(lon); lat = radians(lat);
  return vec3(sin(lon) * cos(lat), sin(lat), cos(lon) * cos(lat));
}

/** How far inside a sea this direction is: > 0 inside. */
float sea(vec3 d, float lon, float lat, float r) {
  float ang = degrees(acos(clamp(dot(d, at(lon, lat)), -1.0, 1.0)));
  return 1.0 - ang / r;
}

float maria(vec3 d) {
  float m = sea(d, -16.0, 33.0, 19.0);                 // Imbrium
  m = max(m, sea(d, 17.0, 28.0, 11.5));               // Serenitatis
  m = max(m, sea(d, 31.0, 9.0, 13.5));                // Tranquillitatis
  m = max(m, sea(d, 59.0, 17.0, 8.5));                // Crisium
  m = max(m, sea(d, 51.0, -8.0, 11.0));               // Fecunditatis
  m = max(m, sea(d, 35.0, -15.0, 6.5));               // Nectaris
  m = max(m, sea(d, -17.0, -21.0, 12.0));             // Nubium
  m = max(m, sea(d, -39.0, -24.0, 7.5));              // Humorum
  m = max(m, sea(d, -55.0, 14.0, 24.0));              // Procellarum
  m = max(m, sea(d, -38.0, -6.0, 16.0));
  m = max(m, sea(d, 3.0, 13.0, 5.0));                 // Vaporum
  return m + 0.9 * (fbm(d * 4.0) - 0.5) + 0.45 * (fbm(d * 13.0) - 0.5) + 0.2 * (fbm(d * 40.0) - 0.5);
}

/** Craters: bowls with raised rims, at four sizes. */
float craters(vec3 d) {
  float h = 0.0;
  float amp = 1.0, scale = 5.0;
  for (int i = 0; i < 5; i++) {
    vec3 v = voronoi(d * scale + float(i) * 13.0);
    float present = step(0.45, v.z);
    float r = v.x / (0.18 + 0.3 * v.z);
    h += present * amp * (smoothstep(0.75, 1.0, r) * smoothstep(1.35, 1.0, r) * 0.6 - (1.0 - smoothstep(0.0, 0.85, r)));
    amp *= 0.55; scale *= 2.3;
  }
  return h;
}

float relief(vec3 d) {
  float m = smoothstep(-0.1, 0.3, maria(d));
  // the seas are lava plains: lower, and far less cratered
  return 0.0024 * craters(d) * mix(1.0, 0.25, m) - 0.0016 * m + 0.0015 * (fbm(d * 30.0) - 0.5);
}

vec2 map(vec3 p) {
  vec3 d = normalize(p);
  return vec2(length(p) - RAD - relief(d), 1.0);
}

Mat material(float id, vec3 p, vec3 n) {
  vec3 d = normalize(p);
  float m = smoothstep(-0.12, 0.32, maria(d));
  vec3 alb = mix(hex(0x9d9890), hex(0x5f5d59), m);
  alb *= 0.82 + 0.36 * fbm(d * 24.0);
  // Tycho, Copernicus, Kepler, Aristarchus: young, so still bright, with rays
  vec3 tycho = at(-11.0, -43.0);
  float ta = degrees(acos(clamp(dot(d, tycho), -1.0, 1.0)));
  vec3 e = normalize(cross(tycho, vec3(0.0, 1.0, 0.0))), nn = cross(tycho, e);
  float bearing = atan(dot(d, e), dot(d, nn));
  float ray = pow(0.5 + 0.5 * sin(bearing * 11.0 + 3.0 * noise(vec2(bearing * 3.0, 1.0))), 6.0) * exp(-ta / 28.0) * smoothstep(2.0, 5.0, ta);
  alb += 0.07 * ray + 0.2 * smoothstep(3.5, 1.0, ta);
  alb += 0.2 * smoothstep(3.0, 1.0, degrees(acos(dot(d, at(-20.0, 10.0)))));
  alb += 0.2 * smoothstep(2.0, 0.6, degrees(acos(dot(d, at(-38.0, 8.0)))));
  alb += 0.3 * smoothstep(1.8, 0.5, degrees(acos(dot(d, at(-47.0, 24.0)))));
  // Plato: a dark-floored crater on the north shore of Imbrium
  alb *= 1.0 - 0.45 * smoothstep(2.2, 1.4, degrees(acos(dot(d, at(-9.0, 51.6)))));
  return mat(alb, 1.0, 0.0);
}
