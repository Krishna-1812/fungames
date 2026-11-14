/* Jupiter, 139,820 kilometres across the equator and six and a half percent
   less through the poles, because it spins in ten hours: pale zones and brown
   belts, sheared against each other into festoons, and the Great Red Spot in
   the south — a storm wider than the Earth. */
#define STEP 0.9
#define SHADOW 0.0
#define EXPOSURE 0.95

const float OBL = 0.935;

vec3 turn(vec3 p) { p.xy = rot(-0.05) * p.xy; p.yz = rot(0.05) * p.yz; return p; }

vec2 map(vec3 p) { return vec2(sdEllipsoid(p, vec3(0.497, 0.497 * OBL, 0.497)), 1.0); }

Mat material(float id, vec3 p, vec3 n) {
  vec3 d = normalize(turn(p) / vec3(1.0, OBL, 1.0));
  float lat = asin(d.y), lon = atan(d.x, d.z);
  // the spot, at 22 south
  vec2 s = vec2((lon - 0.35) * cos(lat), lat + 0.385);
  float spot = length(s / vec2(0.17, 0.085));
  // jets shear the clouds east and west in alternate bands
  float jet = sin(lat * 13.0);
  vec3 q = vec3(lon * 2.2 + jet * 0.5, lat * 9.0, 0.0);
  float turb = fbm(vec2(q.x * 2.0 + 4.0 * fbm(q.xy * vec2(1.0, 1.6)), q.y * 2.6));
  float fine = fbm(vec2(lon * 14.0 + jet * 3.0, lat * 60.0));
  // the storm drags its surroundings round it
  float swirl = exp(-spot * spot * 0.7);
  float l = lat + 0.035 * (turb - 0.5) + 0.012 * (fine - 0.5) - 0.05 * swirl * s.y / 0.085 * 0.3;
  // belts where this is high; the two great ones either side of the equator
  float belt = 0.5 + 0.5 * sin(l * 15.5 + 1.2 * sin(l * 3.1));
  belt = smoothstep(0.35, 0.75, belt + 0.18 * (turb - 0.5));
  float major = exp(-pow((abs(l - 0.02) - 0.21) / 0.07, 2.0));
  belt = clamp(belt * 0.8 + major * 0.9, 0.0, 1.0);
  vec3 zone = mix(hex(0xe6dcc6), hex(0xd3c2a0), fine);
  vec3 brown = mix(hex(0x8a5a3c), hex(0x5f3d2c), turb);
  vec3 alb = mix(zone, brown, belt);
  // blue-grey festoons along the equatorial edge of the north belt
  alb = mix(alb, hex(0x7f8fa0), 0.35 * smoothstep(0.6, 0.9, fine) * exp(-pow((l - 0.13) / 0.03, 2.0)));
  // the poles are a darker, mottled grey-brown
  alb = mix(alb, hex(0x7d6f62) * (0.8 + 0.4 * fbm(d * 20.0)), smoothstep(0.85, 1.2, abs(lat)));
  // the spot: brick red, paler collar, spiral inside
  float spiral = 0.5 + 0.5 * sin(atan(s.y / 0.085, s.x / 0.17) * 2.0 + spot * 9.0);
  vec3 red = mix(hex(0xb5553a), hex(0xd08565), spiral * 0.5);
  alb = mix(alb, hex(0xe9dfcc), smoothstep(1.55, 1.15, spot) * 0.8);
  alb = mix(alb, red, smoothstep(1.05, 0.8, spot));
  return mat(alb, 1.0, 0.0);
}
