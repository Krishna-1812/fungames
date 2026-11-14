/* Earth, 12,742 kilometres across, Africa and Europe towards you: the real
   coastline (Natural Earth's, through u_tex), land coloured by what grows at
   each latitude, ice at both ends, weather over everything, and the thin
   blue line of the air at the edge. */
#define STEP 0.9
#define FOG
#define SHADOW 0.0
#define EXPOSURE 1.0

const float RAD = 0.4925;

vec3 turn(vec3 p) {
  // 23.4 degrees of tilt, leaning the north towards the camera a little,
  // and the meridian of 18 degrees east facing front
  p.xy = rot(-0.36) * p.xy;
  p.yz = rot(0.22) * p.yz;
  p.xz = rot(0.31) * p.xz;
  return p;
}

vec2 lonlat(vec3 d) { return vec2(atan(d.x, d.z), asin(clamp(d.y, -1.0, 1.0))); }

float clouds(vec3 d) {
  // weather goes round in bands: storms in the mid latitudes, a broken line
  // at the equator, clear over the deserts either side of it
  vec3 w = d + 0.18 * vec3(fbm(d * 3.0), fbm(d * 3.0 + 5.0), fbm(d * 3.0 + 9.0));
  float lat = abs(asin(d.y));
  float cover = 0.24 + 0.12 * cos(lat * 6.0) - 0.10 * exp(-pow((lat - 0.42) / 0.16, 2.0));
  float c = fbm(w * 5.5) * 0.65 + fbm(w * 17.0) * 0.35;
  return smoothstep(1.0 - cover - 0.02, 1.0 - cover + 0.2, c + 0.2);
}

vec2 map(vec3 p) { return vec2(length(p) - RAD, 1.0); }

Mat material(float id, vec3 p, vec3 n) {
  vec3 d = turn(normalize(p));
  vec2 ll = lonlat(d);
  vec2 uv = vec2(ll.x / TAU + 0.5, ll.y / PI + 0.5);
  vec2 tex = texture(u_tex, uv).rg;
  float land = smoothstep(0.42, 0.58, tex.r);
  float inland = tex.g;
  float lat = degrees(ll.y), alat = abs(lat);

  // sea: deep, and paler on the shelves
  vec3 sea = mix(hex(0x06204a), hex(0x1a5a86), smoothstep(0.05, 0.45, inland));
  // land: rainforest, savannah, desert, steppe, forest, tundra
  float wet = fbm(d * 9.0);
  vec3 jungle = hex(0x2f5a2a), dry = hex(0xa88b62), grass = hex(0x6f7f45), taiga = hex(0x3a4f33), tundra = hex(0x7d7868);
  float desert = exp(-pow((alat - 24.0) / 9.0, 2.0)) * smoothstep(0.25, 0.6, inland + 0.3 * wet);
  vec3 ground = mix(jungle, grass, smoothstep(6.0, 16.0, alat + 8.0 * wet));
  ground = mix(ground, dry, clamp(desert * 1.5, 0.0, 1.0));
  ground = mix(ground, taiga, smoothstep(40.0, 52.0, alat + 6.0 * wet) * (1.0 - desert));
  ground = mix(ground, tundra, smoothstep(60.0, 68.0, alat));
  ground *= 0.85 + 0.3 * fbm(d * 40.0);
  // ice: Antarctica, Greenland, the Arctic pack
  float ice = smoothstep(66.0, 72.0, alat + 3.0 * wet) * land;
  ice = max(ice, land * step(lat, -60.0));
  ice = max(ice, land * smoothstep(59.0, 64.0, lat) * smoothstep(-60.0, -52.0, degrees(ll.x)) * smoothstep(-18.0, -26.0, degrees(ll.x)));
  float pack = smoothstep(74.0, 80.0, lat + 4.0 * wet) * (1.0 - land);
  vec3 alb = mix(sea, ground, land);
  alb = mix(alb, vec3(0.9, 0.93, 0.96), max(ice, pack));

  float c = clouds(d);
  // a cloud's shadow falls a little down-light of it
  float shade = clouds(normalize(d + 0.012 * vec3(-0.42, 0.52, 0.2)));
  alb *= 1.0 - 0.3 * shade * (1.0 - c);
  alb = mix(alb, vec3(0.95), c);
  Mat m = mat(alb, mix(mix(0.22, 0.95, land), 1.0, c), 0.0);
  // the air: bluer towards the limb, where you look through more of it
  float rim = pow(1.0 - max(dot(n, vec3(0.0, 0.0, 1.0)), 0.0), 3.0);
  m.emit = vec3(0.10, 0.22, 0.50) * rim * 0.55;
  return m;
}

/* The atmosphere past the limb: a hundred kilometres, which at this size is
   under one part in a hundred of the radius. */
vec4 fog(vec3 ro, vec3 rd, float tmax) {
  float b = length(ro.xy);
  float a = smoothstep(RAD + 0.011, RAD - 0.001, b) * step(RAD - 0.002, b);
  // lit side only
  float sun = clamp(dot(normalize(vec3(ro.xy, 0.15)), normalize(vec3(-0.42, 0.52, 0.74))) * 1.4 + 0.35, 0.0, 1.0);
  a *= 0.75 * sun;
  return vec4(vec3(0.35, 0.6, 1.0) * a, a);
}
