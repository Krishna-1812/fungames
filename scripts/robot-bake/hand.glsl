/* I'm Not a Robot: a hand, for "select the image showing a human hand".
 *
 * A hand lying flat on a white table, back up, fingers spread a little and
 * pointing away, photographed from above in the Auction studio's white room.
 * FINGERS and THUMBS are defined before this file, so the same hand is shot
 * four times with the wrong number of parts three times: the joke of every
 * generated picture of a hand. Each finger is three phalanges that taper and
 * bend a little and rest on the table; the knuckles stand up through the
 * back of the hand; the nails are their own material. Units: 1 is 10 cm.
 */
#define BOUND vec3(1.05, 0.32, 1.3)
#define CENTRE vec3(-0.2, 0.32, -0.42)
#define VIEW_YAW 0.0
#define VIEW_PITCH 1.2
#define FILL 1.02
#define STEP 0.75

#ifndef FINGERS
#define FINGERS 4
#endif
#ifndef THUMBS
#define THUMBS 1
#endif

float nailAt;   // set by map(): how near the last fingertip's nail the point is

/* A finger from its knuckle k, pointing along dir in the table's plane,
   `len` long: three capsules that taper, the middle joint lifted a little. */
float finger(vec3 p, vec3 k, vec2 dir, float len, float r) {
  vec3 d = normalize(vec3(dir.x, 0.0, dir.y));
  vec3 a = k + d * len * 0.44 + vec3(0.0, 0.03, 0.0);
  vec3 b = a + d * len * 0.31 - vec3(0.0, 0.025, 0.0);
  vec3 c = b + d * len * 0.25 - vec3(0.0, 0.02, 0.0);
  float f = sdCone(p, k, a, r, r * 0.92);
  f = smin(f, sdCone(p, a, b, r * 0.92, r * 0.84), 0.03);
  f = smin(f, sdCone(p, b, c, r * 0.84, r * 0.74), 0.025);
  f = smin(f, length(p - c) - r * 0.74, 0.02);
  float along = dot(p - b, d) / (len * 0.25);
  if (length(p - c) < r * 1.6) nailAt = max(nailAt, smoothstep(0.35, 1.0, along) * step(abs(dot(p - c, vec3(-d.z, 0.0, d.x))), r * 0.62));
  return f;
}

vec2 map(vec3 p) {
  nailAt = 0.0;
  // The back of the hand: a low dome, wider at the knuckles.
  vec3 q = p - vec3(0.0, 0.13, 0.05);
  float w = 0.37 + 0.05 * smoothstep(0.4, -0.45, q.z);
  float back = sdEllipsoid(q, vec3(w, 0.15, 0.58));
  back = max(back, -p.y);
  // The wrist and forearm, running off the bottom of the picture.
  float arm = sdCone(p * vec3(1.0, 1.25, 1.0), vec3(0.04, 0.2, 0.45), vec3(0.12, 0.26, 2.6), 0.32, 0.4) * 0.8;
  float hand = smin(back, arm, 0.18);

  // The fingers, fanned across the far edge of the hand.
  float fingers = 1e9;
  float n = float(FINGERS);
  for (int i = 0; i < FINGERS; i++) {
    float u = n > 1.0 ? float(i) / (n - 1.0) : 0.5;          // 0 index .. 1 little
    float x = mix(-0.3, 0.33, u);
    float len = 1.32 * (n == 3.0 ? mix(0.74, 0.66, u) : mix(0.7, 0.52, u) + 0.1 * max(0.0, 1.0 - abs(u - 0.33) * 2.6));
    float r = mix(0.098, 0.08, u);
    vec2 dir = normalize(vec2(mix(-0.16, 0.22, u), -1.0));
    vec3 k = vec3(x, r + 0.02, -0.42 + 0.06 * abs(u - 0.4));
    fingers = min(fingers, finger(p, k, dir, len, r));
  }
  hand = smin(hand, fingers, 0.06);

  // The thumb from the side of the hand, out and forward; with THUMBS 2 a
  // second one on the other side.
  for (int s = 0; s < THUMBS; s++) {
    float sx = s == 0 ? -1.0 : 1.0;
    vec3 base = vec3(0.3 * sx, 0.12, 0.18);
    vec3 mid = vec3(0.62 * sx, 0.1, -0.12);
    vec3 tip = vec3(0.8 * sx, 0.09, -0.36);
    float th = sdCone(p, base, mid, 0.13, 0.1);
    th = smin(th, sdCone(p, mid, tip, 0.1, 0.085), 0.03);
    th = smin(th, length(p - tip) - 0.085, 0.02);
    hand = smin(hand, th, 0.08);
  }
  // Knuckles and tendons, just under the skin.
  hand -= 0.012 * smoothstep(0.08, 0.0, abs(p.z + 0.4)) * smoothstep(0.0, 0.15, p.y);
  // Fine skin texture.
  hand += 0.0012 * noise(p * 140.0);
  return vec2(hand, 1.0);
}

Mat material(float id, vec3 p, vec3 n) {
  // Skin: warmer and pinker at the knuckles and fingertips, a little paler
  // on the back of the hand, with fine mottling.
  vec3 base = hex(0xa86f52);
  vec3 c = mix(base, hex(0xb98064), 0.4 * fbm(p * 18.0));
  float tips = smoothstep(-0.9, -1.15, p.z);
  float knuckle = smoothstep(0.09, 0.0, abs(p.z + 0.42)) * smoothstep(0.1, 0.2, p.y);
  c = mix(c, hex(0xa9604d), clamp(tips * 0.45 + knuckle * 0.4, 0.0, 1.0));
  c *= 0.96 + 0.08 * noise(p * 90.0);
  Mat m = mat(c, 0.52, 0.0);
  m.sss = 0.45;
  // Nails: on top of each fingertip, pale and glossy, with a paler free edge.
  if (n.y > 0.75 && nailAt > 0.5) {
    m.alb = mix(hex(0xc99383), hex(0xe9d2c4), smoothstep(0.85, 1.0, nailAt));
    m.rough = 0.22;
    m.sss = 0.3;
  }
  return m;
}
