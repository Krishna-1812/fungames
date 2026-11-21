/* Lot: nine views of the same hill, by the same unknown hand.
 *
 * Nine small oil sketches on millboard, about 10 x 8 inches each, stood on a
 * three-shelf display rack of grey-painted deal that leans back against its
 * own rear legs. Eight are the same rounded hill under a different sky,
 * painted with one brush and great sincerity; the ninth (bottom right, a
 * little larger, turned slightly to the room) is a winter afternoon painted
 * by someone who had finally learned to look. The pictures are
 * nine-views.png: a 3 x 3 grid of colour on the left half, the paint's
 * relief on the right. Units: metres.
 */
#define BOUND vec3(0.50, 0.48, 0.17)
#define CENTRE vec3(0.0, 0.48, -0.10)
#define VIEW_YAW 0.34
#define VIEW_PITCH 0.12
#define FILL 0.86
#define STEP 0.8
#define COAT(id) ((id) >= 10.0 ? 0.18 : ((id) == 1.0 ? 0.08 : 0.0))

const float LEAN = 0.17;  // the rack leans back this far (radians)
const float THICK = 0.0055;

/* World to the rack's leaning frame: x across, s up the rack, t out of it. */
vec3 toRack(vec3 p) {
  float c = cos(LEAN), s = sin(LEAN);
  return vec3(p.x, p.y * c - p.z * s, p.y * s + p.z * c);
}

float ledgeS(int r) { return r == 0 ? 0.64 : (r == 1 ? 0.36 : 0.08); }

/* Each board: centre x, width, height, a nudge along the shelf; the ninth
   is larger and turned a little towards the camera. */
vec4 boardDim(int i) {
  if (i == 0) return vec4(-0.292, 0.250, 0.198, 0.0);
  if (i == 1) return vec4(-0.004, 0.246, 0.202, 0.0);
  if (i == 2) return vec4(0.287, 0.252, 0.196, 0.0);
  if (i == 3) return vec4(-0.289, 0.248, 0.200, 0.0);
  if (i == 4) return vec4(0.003, 0.251, 0.197, 0.0);
  if (i == 5) return vec4(0.291, 0.247, 0.203, 0.0);
  if (i == 6) return vec4(-0.294, 0.252, 0.199, 0.0);
  if (i == 7) return vec4(-0.006, 0.245, 0.201, 0.0);
  return vec4(0.296, 0.268, 0.214, 1.0);
}

/* A point in board i's own frame: x across, y up, z out of the paint (the
   painted face at z = THICK / 2). */
vec3 boardLocal(int i, vec3 r) {
  vec4 b = boardDim(i);
  int row = i / 3;
  vec3 q = vec3(r.x - b.x, r.y - ledgeS(row) - b.z * 0.5, r.z - 0.006 - THICK * 0.5);
  if (b.w > 0.5) {
    // Turned on its left edge towards the room, its right edge pulled out.
    q.z -= 0.012;
    q.xz = rot(-0.10) * q.xz;
  }
  return q;
}

vec2 cellUV(int i, vec3 q) {
  vec4 b = boardDim(i);
  vec2 l = clamp(q.xy / b.yz + 0.5, 0.0, 1.0);
  float c = float(i % 3), rr = float(i / 3);
  return vec2((c + l.x) / 3.0, 1.0 - (rr + 1.0 - l.y) / 3.0);
}

float paintRelief(int i, vec3 q) {
  vec2 uv = cellUV(i, q);
  return textureLod(u_tex, vec2(0.5 + uv.x * 0.5, uv.y), 0.0).r;
}

vec2 map(vec3 p) {
  vec3 r = toRack(p);
  // The rack: two uprights, three shelves with lips, a slat behind each row.
  vec3 ua = vec3(abs(r.x) - 0.475, r.y - 0.46, r.z + 0.016);
  float rack = sdRound(ua, vec3(0.018, 0.46, 0.016), 0.003);
  for (int k = 0; k < 3; k++) {
    float s0 = ledgeS(k);
    float shelf = sdRound(vec3(r.x, r.y - s0 + 0.009, r.z - 0.02), vec3(0.47, 0.009, 0.023), 0.002);
    shelf = min(shelf, sdRound(vec3(r.x, r.y - s0 - 0.004, r.z - 0.04), vec3(0.47, 0.009, 0.004), 0.0015));
    shelf = min(shelf, sdRound(vec3(r.x, r.y - s0 - 0.15, r.z + 0.006), vec3(0.47, 0.025, 0.006), 0.002));
    rack = min(rack, shelf);
  }
  // Rear legs from high on each upright down to the floor behind.
  vec3 a = vec3(0.475, 0.0, 0.0), legTop = vec3(0.0, 0.55 * cos(LEAN), -0.55 * sin(LEAN) - 0.03);
  vec3 lp = vec3(abs(p.x) - 0.475, p.y, p.z);
  rack = min(rack, sdCapsule(lp, legTop, vec3(0.0, 0.012, -0.24), 0.013));
  vec2 res = vec2(rack, 1.0);

  // The boards.
  for (int i = 0; i < 9; i++) {
    vec3 q = boardLocal(i, r);
    vec4 b = boardDim(i);
    float d = sdRound(q, vec3(b.y * 0.5, b.z * 0.5, THICK * 0.5), 0.0007);
    if (d < 0.004 && q.z > 0.0) {
      float in_ = smoothstep(0.0, 0.004, min(b.y * 0.5 - abs(q.x), b.z * 0.5 - abs(q.y)));
      d -= paintRelief(i, q) * 0.0007 * in_;
    }
    if (d < res.x) res = vec2(d * 0.9, 10.0 + float(i));
  }
  return res;
}

Mat material(float id, vec3 p, vec3 n) {
  vec3 r = toRack(p);
  if (id == 1.0) {
    // Deal, painted a cool grey, the paint chipped and rubbed on the edges.
    float g = noise(vec2(r.x * 4.0 + fbm(r * 30.0) * 2.0, (r.y + r.z) * 220.0));
    vec3 c = mix(hex(0x3a3e42), hex(0x464b50), g * 0.5);
    float chip = smoothstep(0.7, 0.78, fbm(r * 70.0));
    c = mix(c, hex(0x56534e), chip * 0.35);
    c *= 0.9 + 0.1 * noise(r * 300.0);
    return mat(c, 0.62 - 0.1 * g, 0.0);
  }
  int i = int(id - 10.0 + 0.5);
  vec3 q = boardLocal(i, r);
  vec4 b = boardDim(i);
  // Millboard: grey-brown fibre, the edges cut a little rough.
  vec3 board = mix(hex(0x5a5048), hex(0x6b6156), noise(q.xy * 900.0));
  if (q.z < THICK * 0.5 - 0.0004 || abs(q.x) > b.y * 0.5 - 0.0004 || abs(q.y) > b.z * 0.5 - 0.0004)
    return mat(board * (0.85 + 0.15 * noise(q * 2000.0)), 0.85, 0.0);
  vec3 c = pow(textureLod(u_tex, vec2(cellUV(i, q).x * 0.5, cellUV(i, q).y), 0.0).rgb, vec3(2.2));
  // Unvarnished sketches: a little dust and a slight dulling of the darks.
  c = mix(c * 0.72, vec3(0.05, 0.05, 0.048), 0.04);
  float h = paintRelief(i, q);
  return mat(c, mix(0.62, 0.42, h), 0.0);
}
