/**
 * Powder's renderer.
 *
 * The simulation is not touched by any of this. The cellular automaton, its
 * densities and its forty-odd reactions stay exactly where they were, in
 * `powder.astro`, because the emergent chemistry *is* the game. What changes is
 * that the grid is no longer painted straight into an ImageData as flat palette
 * colours.
 *
 * The old renderer had one honest failing: nothing in the world could see
 * anything else. A pool of lava sat next to a stone wall and the wall stayed the
 * same grey it was in the dark. Fire was an orange square. Water was a blue
 * square with a slightly different blue square next to it. Every material got
 * one colour plus a random per-grain jitter, and at four screen pixels per cell
 * that reads as Lego.
 *
 * So the grid is uploaded as three integer textures and shaded on the GPU:
 *
 *   1. **Emission** — every burning, molten or glowing cell writes its light
 *      into a small HDR buffer at grid resolution.
 *   2. **Light** — that buffer is blurred through a five-level dual-Kawase
 *      chain. The result is a real 2D light field, so lava genuinely lights the
 *      cave it is sitting in, fire throws a moving glow across the sand, and
 *      smoke drifting over an ember is lit from underneath.
 *   3. **Composite** — at display resolution, so there is room for detail
 *      *inside* a cell. Each material gets a surface rather than a colour:
 *      grain and inter-grain shadow on powders, a bilinear meniscus and
 *      specular on liquids, crust and glowing cracks on lava, thin-film sheen
 *      on oil, facets on ice, soft dissolving edges on gases. Everything is
 *      lit, tonemapped through ACES and dithered.
 *
 * The 2D path is kept intact underneath as `Canvas2DRenderer`, and is what runs
 * if WebGL2 is missing — the page then looks exactly as it did before.
 */
import { FULLSCREEN_VERT, GLSL, GLSL_PRELUDE, program } from './gl'

/* Material ids. These mirror the constants in powder.astro; they are the one
   thing the renderer and the simulation genuinely have to agree on. */
const MATS = `
#define M_EMPTY  0u
#define M_SAND   1u
#define M_WATER  2u
#define M_STONE  3u
#define M_WOOD   4u
#define M_FIRE   5u
#define M_SMOKE  6u
#define M_STEAM  7u
#define M_OIL    8u
#define M_LAVA   9u
#define M_ICE    10u
#define M_PLANT  11u
#define M_ACID   12u
#define M_POWDER 13u
#define M_GLASS  14u
#define M_EMBER  15u
#define M_SALT   16u
#define M_BRINE  17u
#define M_DIRT   18u
#define M_MUD    19u
#define M_SEED   20u
#define M_METAL  21u
#define M_RUST   22u
#define M_SPARK  23u
#define M_COAL   24u
#define M_ASH    25u
#define M_NITRO  26u
#define M_CLOUD  27u
#define M_SNOW   28u
#define M_THERMITE 29u
#define M_FUNGUS 30u
#define M_SLIME  31u
#define M_SODA   32u
#define M_CLAY   33u
#define M_WAX    34u
#define M_CERAMIC 35u
#define M_FOAM   36u
#define M_MELTED_WAX 37u

/* What kind of thing each material is: 0 holds its shape, 1 heaps (a powder),
   2 pours (a liquid), 3 drifts (smoke, steam, cloud, foam), 4 burns (fire and
   spark), 5 is air. Every id the simulation has is here — a material missing
   from the composite used to be drawn as empty air, which is how salt, metal,
   snow and a dozen others were invisible. */
const float KIND[38] = float[38](
  5.0, 1.0, 2.0, 0.0, 0.0, 4.0, 3.0, 3.0, 2.0, 2.0,
  0.0, 0.0, 2.0, 1.0, 0.0, 1.0, 1.0, 2.0, 1.0, 1.0,
  1.0, 0.0, 0.0, 4.0, 1.0, 1.0, 2.0, 3.0, 1.0, 1.0,
  0.0, 2.0, 1.0, 1.0, 0.0, 0.0, 3.0, 2.0);
float kindOf(uint id) { return id < 38u ? KIND[int(id)] : 0.0; }
`

/* Shared by the emission pass and the composite, so a flame and the light it
   throws can never disagree about its own colour. */
const EMIT = `
float life0(uint id) {
  if (id == M_FIRE)  return 46.0;
  if (id == M_SPARK) return 12.0;
  if (id == M_SMOKE) return 130.0;
  if (id == M_STEAM) return 170.0;
  if (id == M_EMBER) return 120.0;
  if (id == M_FOAM)  return 70.0;
  return 1.0;
}

/**
 * Light leaving a cell, in linear HDR. Values well above 1.0 are the point:
 * they survive the tonemap as light rather than being painted on as bright
 * paint, which is the difference between a flame and an orange square.
 */
vec3 emissive(uint id, float k, vec2 gp, float t) {
  if (id == M_FIRE) {
    // A flame cools as it burns down. Young is white-hot, old is deep red, and
    // because 'life' is per-cell the gradient falls out of the simulation
    // rather than being drawn on.
    vec3 c = mix(vec3(1.0, 0.14, 0.015), vec3(1.0, 0.72, 0.30), k * k);
    return c * (0.45 + 2.15 * k);
  }
  if (id == M_EMBER) {
    return mix(vec3(0.85, 0.10, 0.015), vec3(1.0, 0.52, 0.12), k) * (0.35 + 1.7 * k);
  }
  if (id == M_LAVA) {
    // Lava is not uniformly molten. A skin of cooled crust forms and drifts,
    // and the light comes out of the cracks between the plates.
    float crust = fbm(gp * 0.26 + vec2(t * 0.05, -t * 0.028), 3);
    float glow = smoothstep(0.60, 0.20, crust);
    return mix(vec3(0.38, 0.040, 0.007), vec3(1.0, 0.33, 0.05), glow) * (0.30 + 1.9 * glow);
  }
  if (id == M_ACID) return vec3(0.34, 0.95, 0.09) * 0.42;
  if (id == M_SPARK) return mix(vec3(1.0, 0.62, 0.22), vec3(1.0, 0.95, 0.75), k) * (1.4 + 3.2 * k);
  return vec3(0.0);
}
`

/* -------------------------------------------------------------------------- */
/* Pass 1 — emission at grid resolution                                       */
/* -------------------------------------------------------------------------- */

const EMIT_FRAG = GLSL + MATS + EMIT + `
uniform highp usampler2D u_id;
uniform highp usampler2D u_life;
uniform vec2 u_grid;

void main() {
  // The simulation's row 0 is the top of the world; a texture's row 0 lands at
  // the bottom of the screen. Flipped once, here and in the composite, so the
  // light field and the world agree.
  vec2 gp = vec2(vUv.x, 1.0 - vUv.y) * u_grid;
  ivec2 c = clamp(ivec2(gp), ivec2(0), ivec2(u_grid) - 1);
  uint id = texelFetch(u_id, c, 0).r;
  float k = float(texelFetch(u_life, c, 0).r) / life0(id);
  fragColor = vec4(emissive(id, clamp(k, 0.0, 1.0), gp, u_time), 1.0);
}`

/* -------------------------------------------------------------------------- */
/* Pass 1b — the smoothed fields, at grid resolution                          */
/* -------------------------------------------------------------------------- */

/* Four fields, one per channel: where liquid is, where any matter is (liquid,
   powder or solid), how hot the flames are, and how thick the gases are. They
   are blurred a cell or two wide, so the composite can draw a pool's surface,
   a dune's outline and a plume of smoke as smooth shapes rather than as the
   staircase of cells the simulation works in. */
const FIELD_FRAG = GLSL + MATS + EMIT + `
uniform highp usampler2D u_id;
uniform highp usampler2D u_life;
uniform vec2 u_grid;
/* 0: liquid, matter, flame, gas. 1: how much of the gas is pale (steam, cloud,
   foam) and how much is smoke, so a plume's colour blends as smoothly as its
   thickness instead of changing a cell at a time. */
uniform float u_which;

void main() {
  vec2 gp = vec2(vUv.x, 1.0 - vUv.y) * u_grid;
  ivec2 c = clamp(ivec2(gp), ivec2(0), ivec2(u_grid) - 1);
  uint id = texelFetch(u_id, c, 0).r;
  float kd = kindOf(id);
  float k = clamp(float(texelFetch(u_life, c, 0).r) / life0(id), 0.0, 1.0);
  if (u_which > 0.5) {
    float pale = (id == M_STEAM || id == M_FOAM) ? k : id == M_CLOUD ? 1.0 : 0.0;
    fragColor = vec4(pale, id == M_SMOKE ? k : 0.0, 0.0, 0.0);
    return;
  }
  fragColor = vec4(
    kd == 2.0 ? 1.0 : 0.0,
    kd <= 2.0 ? 1.0 : 0.0,
    id == M_FIRE ? 0.25 + 0.75 * k : 0.0,
    kd == 3.0 ? (id == M_CLOUD ? 1.0 : k) : 0.0);
}`

/* A Gaussian a cell and a half wide, one axis at a time. */
const BLUR_FRAG = GLSL_PRELUDE + `
uniform sampler2D u_src;
uniform vec2 u_dir;
void main() {
  vec4 s = texture(u_src, vUv) * 0.2270;
  s += (texture(u_src, vUv + u_dir) + texture(u_src, vUv - u_dir)) * 0.1945;
  s += (texture(u_src, vUv + 2.0 * u_dir) + texture(u_src, vUv - 2.0 * u_dir)) * 0.1216;
  s += (texture(u_src, vUv + 3.0 * u_dir) + texture(u_src, vUv - 3.0 * u_dir)) * 0.0540;
  s += (texture(u_src, vUv + 4.0 * u_dir) + texture(u_src, vUv - 4.0 * u_dir)) * 0.0162;
  fragColor = s;
}`

/* -------------------------------------------------------------------------- */
/* Passes 2a/2b — dual-Kawase blur                                            */
/* -------------------------------------------------------------------------- */

/* Five taps down, eight up. Cheaper than a wide Gaussian and, chained across
   mips, gives a falloff that keeps a hot core while still reaching halfway
   across the screen — which is what a light field needs and a single blur
   radius cannot do. */
const DOWN_FRAG = GLSL_PRELUDE + `
uniform sampler2D u_src;
uniform vec2 u_texel;
void main() {
  vec2 h = u_texel * 0.5;
  vec3 s = texture(u_src, vUv).rgb * 4.0;
  s += texture(u_src, vUv - h).rgb;
  s += texture(u_src, vUv + h).rgb;
  s += texture(u_src, vUv + vec2(h.x, -h.y)).rgb;
  s += texture(u_src, vUv - vec2(h.x, -h.y)).rgb;
  fragColor = vec4(s / 8.0, 1.0);
}`

const UP_FRAG = GLSL_PRELUDE + `
uniform sampler2D u_src;
uniform vec2 u_texel;
void main() {
  vec2 h = u_texel * 0.5;
  vec3 s = texture(u_src, vUv + vec2(-h.x * 2.0, 0.0)).rgb;
  s += texture(u_src, vUv + vec2(-h.x, h.y)).rgb * 2.0;
  s += texture(u_src, vUv + vec2(0.0, h.y * 2.0)).rgb;
  s += texture(u_src, vUv + vec2(h.x, h.y)).rgb * 2.0;
  s += texture(u_src, vUv + vec2(h.x * 2.0, 0.0)).rgb;
  s += texture(u_src, vUv + vec2(h.x, -h.y)).rgb * 2.0;
  s += texture(u_src, vUv + vec2(0.0, -h.y * 2.0)).rgb;
  s += texture(u_src, vUv + vec2(-h.x, -h.y)).rgb * 2.0;
  fragColor = vec4(s / 12.0, 1.0);
}`

/* -------------------------------------------------------------------------- */
/* Pass 3 — composite at display resolution                                   */
/* -------------------------------------------------------------------------- */

const MAIN_FRAG = GLSL + MATS + EMIT + `
uniform highp usampler2D u_id;
uniform highp usampler2D u_life;
uniform highp usampler2D u_shade;
uniform sampler2D u_light;
uniform sampler2D u_field;
uniform sampler2D u_gas;
uniform vec2 u_grid;

uint  idAt(ivec2 c)    { return texelFetch(u_id,    clamp(c, ivec2(0), ivec2(u_grid) - 1), 0).r; }
float lifeAt(ivec2 c)  { return float(texelFetch(u_life,  clamp(c, ivec2(0), ivec2(u_grid) - 1), 0).r); }
float shadeAt(ivec2 c) { return float(texelFetch(u_shade, clamp(c, ivec2(0), ivec2(u_grid) - 1), 0).r) / 255.0; }

/* Things that pour or heap: their outline is smoothed (see the field pass),
   so a dune is a dune and a puddle is round, not a staircase of cells. */
bool isSoft(uint id) { float k = kindOf(id); return k == 1.0 || k == 2.0; }
bool isFluid(uint id) { return kindOf(id) == 2.0; }

float bilin(float a, float b, float c, float d, vec2 f) {
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
/* The exact gradient of that bilinear patch. Free surface normals: no sampling
   the field twice, no sobel, no extra fetches. */
vec2 bigrad(float a, float b, float c, float d, vec2 f) {
  return vec2(mix(b - a, d - c, f.y), mix(c - a, d - b, f.x));
}

struct Surf {
  vec3 albedo;
  vec3 n;
  float spec;
  float shine;
  vec3 emit;
  float alpha;      // for glass, ice and the soft edge of anything that pours
  float scatter;    // how much of the light field the medium itself carries
};

/* The back of the tank: dark slate, a little mottled, lit softly from above by
   the room — and by whatever is burning in front of it, which is what puts a
   fire in a place instead of on a blank page. */
vec3 wallAt(vec2 uv, vec3 lightF) {
  vec2 p = uv * vec2(u_res.x / u_res.y, 1.0);
  float big = fbm(p * 2.3 + 3.1, 4);
  float fine = noise(p * 120.0);
  float room = 0.78 + 0.34 * uv.y;
  vec2 c = centred(uv);
  float vig = 1.0 - dot(c, c) * 0.22;
  vec3 slate = vec3(0.026, 0.029, 0.035) * (0.80 + 0.36 * big + 0.05 * (fine - 0.5));
  return slate * room * vig + lightF * (0.17 + 0.16 * big);
}

void main() {
  vec2 gp = vec2(vUv.x, 1.0 - vUv.y) * u_grid;
  ivec2 ic = ivec2(floor(gp));
  vec2 fc = fract(gp);                 // where we are inside this cell

  uint cid = idAt(ic);
  float csh = shadeAt(ic);
  float clife = lifeAt(ic);

  /* One 2x2 lattice, offset half a cell: the rigid materials' edges, and which
     neighbour a smoothed outline borrows from. Four fetches, reused. */
  vec2 lat = gp - 0.5;
  ivec2 b = ivec2(floor(lat));
  vec2 fr = fract(lat);
  uint i00 = idAt(b), i10 = idAt(b + ivec2(1, 0));
  uint i01 = idAt(b + ivec2(0, 1)), i11 = idAt(b + ivec2(1, 1));

  vec3 lightF = texture(u_light, vUv).rgb;

  /* The smoothed fields (see FIELD_FRAG): liquid, matter, flame, gas — and the
     slope of the matter field, in grid terms (x right, y down). */
  vec4 F = texture(u_field, vUv);
  vec2 tx = 1.0 / u_grid;
  float oR = texture(u_field, vUv + vec2(tx.x, 0.0)).g, oL = texture(u_field, vUv - vec2(tx.x, 0.0)).g;
  float oU = texture(u_field, vUv + vec2(0.0, tx.y)).g, oD = texture(u_field, vUv - vec2(0.0, tx.y)).g;
  vec2 og = vec2(oR - oL, oD - oU) * 0.5;

  /* ---- which material is here, with the outline smoothed ----------------- */

  uint base = kindOf(cid) >= 3.0 ? M_EMPTY : cid;
  float occ = F.g;
  float aw = max(fwidth(occ) * 0.8, 0.02);
  float edgeA = 1.0;
  // A lone grain or droplet is round, whatever the smoothing says about it.
  float disc = 1.0 - smoothstep(0.36, 0.52, length(fc - 0.5));
  if (base != M_EMPTY && isSoft(base)) {
    edgeA = max(smoothstep(0.40 - aw, 0.40 + aw, occ), disc);
  } else if (base == M_EMPTY && occ > 0.40 - aw) {
    // Air inside a smoothed outline: the nearest pouring neighbour fills it.
    float w00 = (1.0 - fr.x) * (1.0 - fr.y), w10 = fr.x * (1.0 - fr.y);
    float w01 = (1.0 - fr.x) * fr.y, w11 = fr.x * fr.y;
    uint n = M_EMPTY; float best = 0.0;
    if (isSoft(i00) && w00 > best) { n = i00; best = w00; }
    if (isSoft(i10) && w10 > best) { n = i10; best = w10; }
    if (isSoft(i01) && w01 > best) { n = i01; best = w01; }
    if (isSoft(i11) && w11 > best) { n = i11; best = w11; }
    if (n != M_EMPTY) { base = n; edgeA = smoothstep(0.40 - aw, 0.40 + aw, occ); }
    // Rock: fill only the inside corners of its steps, never wear its edges
    // away, so a drawn wall stays a wall and a hillside stops being stairs.
    else if (occ > 0.5) {
      if (i00 == M_STONE || i10 == M_STONE || i01 == M_STONE || i11 == M_STONE) { base = M_STONE; edgeA = smoothstep(0.5, 0.5 + aw * 2.0, occ); }
    }
  }

  Surf s;
  s.albedo = vec3(0.0);
  s.n = vec3(0.0, 0.0, 1.0);
  s.spec = 0.0;
  s.shine = 24.0;
  s.emit = vec3(0.0);
  s.alpha = 1.0;
  s.scatter = 0.0;

  // Coverage of this material over the 2x2 lattice, and its slope: the edge
  // of anything rigid.
  float m00 = i00 == base ? 1.0 : 0.0, m10 = i10 == base ? 1.0 : 0.0;
  float m01 = i01 == base ? 1.0 : 0.0, m11 = i11 == base ? 1.0 : 0.0;
  float cov = bilin(m00, m10, m01, m11, fr);
  vec2 cg = bigrad(m00, m10, m01, m11, fr);

  // Distance from a cell edge, used for the shadow between grains.
  float edge = min(min(fc.x, 1.0 - fc.x), min(fc.y, 1.0 - fc.y));
  float kb = kindOf(base);

  if (kb == 1.0) {
    /* A powder is grains, not a fill. Every cell gets its own tone from the
       simulation's 'shade' byte, the gaps between them are shadowed, and each
       powder has its own colour, its own spread of tones and its own shine. */
    vec3 c0 = vec3(0.5); float spread = 0.4; float sp = 0.12; float sh = 18.0; float glint = 0.0;
    if (base == M_SAND)          { c0 = vec3(0.72, 0.53, 0.22); spread = 0.34; sp = 0.30; }
    else if (base == M_POWDER)   { c0 = vec3(0.055, 0.052, 0.062); spread = 0.55; sp = 0.10; }
    else if (base == M_SODA)     { c0 = vec3(0.88, 0.87, 0.83); spread = 0.18; sp = 0.20; }
    else if (base == M_CLAY)     { c0 = vec3(0.55, 0.35, 0.27); spread = 0.30; sp = 0.10; }
    else if (base == M_EMBER)    { c0 = vec3(0.085, 0.050, 0.038); spread = 0.55; sp = 0.10; }
    else if (base == M_SALT)     { c0 = vec3(0.80, 0.81, 0.80); spread = 0.16; sp = 0.55; sh = 70.0; glint = 1.0; }
    else if (base == M_DIRT)     { c0 = vec3(0.17, 0.105, 0.060); spread = 0.50; sp = 0.05; }
    else if (base == M_MUD)      { c0 = vec3(0.090, 0.062, 0.040); spread = 0.20; sp = 0.55; sh = 34.0; }
    else if (base == M_SEED)     { c0 = vec3(0.46, 0.36, 0.14); spread = 0.36; sp = 0.25; }
    else if (base == M_COAL)     { c0 = vec3(0.030, 0.030, 0.034); spread = 0.50; sp = 0.55; sh = 44.0; }
    else if (base == M_ASH)      { c0 = vec3(0.30, 0.29, 0.28); spread = 0.20; sp = 0.03; }
    else if (base == M_SNOW)     { c0 = vec3(0.86, 0.90, 0.95); spread = 0.10; sp = 0.40; sh = 60.0; glint = 0.7; }
    else if (base == M_THERMITE) { c0 = vec3(0.40, 0.17, 0.09); spread = 0.40; sp = 0.18; }
    float v = csh - 0.5;
    s.albedo = c0 * (1.0 + v * spread);
    s.albedo *= 0.72 + 0.28 * smoothstep(0.0, 0.30, edge);
    s.albedo *= 0.88 + 0.24 * noise(gp * 5.0 + csh * 40.0);
    // Grains catch the light on whichever side they were packed against.
    s.n = normalize(vec3(-og * 2.0 + (hash22(vec2(ic)) - 0.5) * 0.5, 1.0));
    s.spec = sp;
    s.shine = sh;
    // Crystals: now and then a grain faces the light exactly and flashes.
    if (glint > 0.0) {
      float g = step(0.93, hash22(vec2(ic) + 7.0).x) * glint;
      s.emit += vec3(0.9, 0.95, 1.0) * g * (0.18 + 0.12 * sin(u_time * 3.0 + csh * 30.0));
    }

  } else if (base == M_STONE || base == M_CERAMIC) {
    float mott = fbm(gp * 0.55, 4);
    // Ceramic is stone's own mottling, warmed: the same kiln that hardens the
    // clay also oxidises the iron in it, which is the real reason terracotta
    // is orange rather than the grey it started as.
    s.albedo = base == M_CERAMIC
      ? mix(vec3(0.24, 0.11, 0.075), vec3(0.62, 0.32, 0.20), mott) * (0.85 + 0.28 * csh)
      : mix(vec3(0.075, 0.077, 0.086), vec3(0.20, 0.20, 0.215), mott) * (0.85 + 0.28 * csh);
    float rel = fbm(gp * 0.85 + 11.0, 3);
    s.albedo *= 0.82 + 0.30 * rel;
    s.n = normalize(vec3(-cg * 1.4 + (vec2(rel, fbm(gp * 0.85 + 31.0, 3)) - 0.5) * 0.6, 1.0));
    s.spec = base == M_CERAMIC ? 0.22 : 0.09;
    s.shine = base == M_CERAMIC ? 26.0 : 10.0;

  } else if (base == M_METAL) {
    // Brushed steel: fine streaks along the plate, and a reflection of the
    // room that slides down it, which is what makes metal read as metal.
    float brush = noise(vec2(gp.x * 0.4, gp.y * 9.0)) * 0.6 + noise(vec2(gp.x * 1.3, gp.y * 22.0)) * 0.4;
    float room = smoothstep(0.15, 0.85, vUv.y + (fbm(gp * 0.06, 2) - 0.5) * 0.3);
    s.albedo = vec3(0.30, 0.32, 0.35) * (0.82 + 0.30 * brush) + vec3(0.10, 0.11, 0.12) * room;
    s.n = normalize(vec3(-cg * 1.6 + vec2(0.0, (brush - 0.5) * 0.4), 1.0));
    s.spec = 1.0;
    s.shine = 70.0;

  } else if (base == M_RUST) {
    // Iron oxide: flaking, pitted, and the colour of it varies a lot.
    float flake = fbm(gp * 0.9 + 5.0, 4);
    float pit = smoothstep(0.62, 0.78, fbm(gp * 2.2 + 9.0, 3));
    s.albedo = mix(vec3(0.21, 0.075, 0.030), vec3(0.46, 0.19, 0.07), flake) * (1.0 - 0.45 * pit) * (0.86 + 0.26 * csh);
    s.n = normalize(vec3(-cg * 1.2 + (vec2(flake, pit) - 0.5) * 0.9, 1.0));
    s.spec = 0.06;
    s.shine = 8.0;

  } else if (base == M_FUNGUS) {
    // Soft, spongy and full of pores.
    float body = fbm(gp * 0.45 + csh * 3.0, 4);
    float pore = smoothstep(0.66, 0.80, noise(gp * 2.6 + 13.0));
    s.albedo = mix(vec3(0.22, 0.11, 0.26), vec3(0.52, 0.32, 0.56), body) * (1.0 - 0.5 * pore);
    s.n = normalize(vec3(-cg * 0.9 + (vec2(body, pore) - 0.5) * 0.7, 1.0));
    s.spec = 0.16;
    s.shine = 16.0;

  } else if (base == M_WOOD) {
    // Grain runs across the plank and the rings are the only thing that varies,
    // which is what stops a wooden wall looking like brown stone.
    float ring = fbm(vec2(gp.x * 0.35, gp.y * 3.1), 4);
    float grain = abs(sin(gp.y * 1.6 + ring * 6.0));
    s.albedo = mix(vec3(0.14, 0.075, 0.035), vec3(0.30, 0.175, 0.085), grain) * (0.86 + 0.28 * csh);
    s.n = normalize(vec3(-cg * 0.8 + vec2(0.0, (grain - 0.5) * 0.9), 1.0));
    s.spec = 0.16;
    s.shine = 14.0;

  } else if (base == M_PLANT) {
    float tip = 1.0 - smoothstep(0.35, 0.95, cov);
    float clump = fbm(gp * 0.30, 4);
    float leaf = fbm(gp * 1.5 + csh * 24.0, 3);
    s.albedo = mix(vec3(0.020, 0.075, 0.022), vec3(0.105, 0.34, 0.055), clump);
    s.albedo = mix(s.albedo, vec3(0.20, 0.52, 0.10), leaf * 0.55);
    s.albedo *= 0.80 + 0.40 * csh;
    s.albedo = mix(s.albedo, vec3(0.42, 0.70, 0.18), tip * 0.65);
    s.n = normalize(vec3(-cg * 1.2 + (vec2(leaf, clump) - 0.5) * 0.9, 1.0));
    s.spec = 0.24;
    s.shine = 20.0;

  } else if (base == M_GLASS) {
    float rim = clamp(length(cg) * 1.9, 0.0, 1.0);
    s.albedo = vec3(0.38, 0.52, 0.55) * (0.25 + 0.75 * rim);
    float streak = fbm(vec2(gp.x * 0.30 + gp.y * 0.10, gp.y * 0.06), 3);
    s.albedo += vec3(0.10, 0.13, 0.14) * smoothstep(0.55, 0.78, streak);
    s.alpha = 0.26 + 0.58 * rim;
    s.n = normalize(vec3(-cg * 2.2, 1.0));
    s.spec = 0.95;
    s.shine = 60.0;

  } else if (base == M_ICE) {
    float f = fbm(gp * 0.42 + csh * 6.0, 4);
    float facet = floor(f * 5.0) / 5.0;
    s.albedo = mix(vec3(0.155, 0.30, 0.42), vec3(0.46, 0.64, 0.76), facet) * 0.82;
    float veins = 1.0 - abs(f * 2.0 - 1.0);
    s.albedo += vec3(0.10, 0.14, 0.16) * pow(veins, 6.0);
    s.n = normalize(vec3(-cg * 1.1 + (vec2(f, fbm(gp * 0.42 + 17.0, 4)) - 0.5) * 0.7, 1.0));
    s.spec = 0.55;
    s.shine = 34.0;
    s.alpha = 0.88;

  } else if (base == M_WAX) {
    float soft = fbm(gp * 0.32 + csh * 5.0, 3);
    s.albedo = mix(vec3(0.62, 0.52, 0.27), vec3(0.86, 0.78, 0.48), soft) * (0.88 + 0.20 * csh);
    s.n = normalize(vec3(-cg * 0.7 + (vec2(soft, fbm(gp * 0.32 + 21.0, 3)) - 0.5) * 0.35, 1.0));
    s.spec = 0.42;
    s.shine = 28.0;

  } else if (kb == 2.0) {
    /* Liquids. Depth is how far in from open air: the smoothed matter field is
       ~1 inside a body, against its floor and walls too, and falls only at
       the free surface. So depth tint and the meniscus come out of one number,
       the floor of a pool is dark rather than rimmed with surface light, and
       the normal comes from the smoothed outline — a round pool, not a stack
       of cells. */
    float depth = smoothstep(0.55, 1.0, F.g);
    float surf = 1.0 - depth;
    vec2 flow = vec2(u_time * 0.35, -u_time * 0.18);
    float rip = fbm(gp * 0.20 + flow, 3);

    if (base == M_WATER || base == M_BRINE) {
      s.albedo = mix(vec3(0.16, 0.42, 0.72), vec3(0.015, 0.075, 0.20), depth);
      // Brine is the same water gone cloudy and a shade greener.
      if (base == M_BRINE) s.albedo = mix(s.albedo, vec3(0.20, 0.36, 0.40), 0.45);
      s.albedo += vec3(0.10, 0.20, 0.26) * pow(rip, 3.0) * (1.0 - depth * 0.6);
      s.spec = 0.85;
      s.shine = 52.0;
      s.alpha = 0.94;
    } else if (base == M_OIL) {
      s.albedo = mix(vec3(0.055, 0.042, 0.030), vec3(0.012, 0.009, 0.007), depth);
      vec3 film = 0.5 + 0.5 * cos(vec3(0.0, 2.1, 4.2) + rip * 5.0 + gp.x * 0.06);
      s.albedo += film * surf * 0.15;
      s.spec = 0.72;
      s.shine = 40.0;
    } else if (base == M_ACID) {
      s.albedo = mix(vec3(0.30, 0.66, 0.07), vec3(0.10, 0.26, 0.02), depth);
      s.albedo += vec3(0.20, 0.42, 0.04) * pow(rip, 2.4);
      s.spec = 0.55;
      s.shine = 30.0;
    } else if (base == M_NITRO) {
      // Oily and faintly pink, with a slow swirl in it: nothing about it says
      // it is safe.
      float swirl = fbm(gp * 0.35 + vec2(u_time * 0.12, 0.0), 3);
      s.albedo = mix(vec3(0.52, 0.10, 0.28), vec3(0.20, 0.03, 0.11), depth) * (0.85 + 0.3 * swirl);
      s.spec = 0.78;
      s.shine = 46.0;
    } else if (base == M_SLIME) {
      // Thick and see-through: it holds its bubbles.
      float bub = smoothstep(0.72, 0.80, noise(gp * 1.7 + vec2(0.0, u_time * 0.08)));
      s.albedo = mix(vec3(0.26, 0.64, 0.40), vec3(0.06, 0.24, 0.12), depth) + vec3(0.10, 0.20, 0.14) * bub;
      s.spec = 0.85;
      s.shine = 56.0;
      s.alpha = 0.90;
    } else if (base == M_MELTED_WAX) {
      s.albedo = mix(vec3(0.82, 0.70, 0.40), vec3(0.52, 0.42, 0.20), depth);
      s.albedo += vec3(0.18, 0.15, 0.08) * pow(rip, 3.0) * (1.0 - depth * 0.6);
      s.spec = 0.58;
      s.shine = 36.0;
    } else {                       // lava
      float crust = fbm(gp * 0.26 + vec2(u_time * 0.05, -u_time * 0.028), 3);
      s.albedo = mix(vec3(0.075, 0.032, 0.026), vec3(0.16, 0.075, 0.05), crust);
      s.spec = 0.20;
      s.shine = 12.0;
    }
    s.n = normalize(vec3(-og * 4.0 + vec2(dFdx(rip), dFdy(rip)) * 2.2, 1.0));

  } else {
    /* Air: the back wall of the tank, lit by the room and by everything in
       front of it that glows. */
    s.albedo = vec3(0.0);
    s.emit = wallAt(vUv, lightF);
    s.alpha = 1.0;
  }

  /* Solids keep a trace of the grid they live on: the quiet version of the
     powders' hard gaps. Without it a sandbox stops reading as a sandbox. */
  if (kb == 0.0) s.albedo *= 0.90 + 0.10 * smoothstep(0.0, 0.20, edge);

  float k = clamp(clife / life0(base), 0.0, 1.0);
  s.emit += emissive(base, k, gp, u_time);

  /* ---- lighting --------------------------------------------------------- */

  const vec3 KEY = vec3(-0.42, 0.60, 0.68);
  vec3 kd = normalize(KEY);
  float diff = max(0.0, dot(s.n, kd)) * 0.5 + 0.5;
  vec3 half_ = normalize(kd + vec3(0.0, 0.0, 1.0));
  float sp = pow(max(0.0, dot(s.n, half_)), s.shine) * s.spec;

  vec3 amb = vec3(0.115, 0.125, 0.155);
  vec3 col = s.albedo * (amb + vec3(0.30, 0.30, 0.33) * diff + lightF * 0.62);
  col += vec3(0.55, 0.58, 0.66) * sp;
  col += lightF * s.spec * 0.22;
  col += lightF * s.scatter;
  col += s.emit;

  // Seen through: the wall behind glass, ice, a thin liquid, or the soft edge
  // of anything that pours — bent a little by the surface.
  float a = s.alpha * edgeA;
  if (a < 1.0) {
    vec3 behind = wallAt(vUv + cg * 0.004 + og * 0.004, texture(u_light, vUv + cg * 0.006).rgb);
    col = mix(behind, col, a);
  }

  /* ---- gases, over the top ---------------------------------------------- */

  // Smoothed, and read a little wider again, so a plume has no cells in it.
  vec2 o = tx * 1.5;
  vec4 Fw = (texture(u_field, vUv + o) + texture(u_field, vUv - o)
           + texture(u_field, vUv + vec2(o.x, -o.y)) + texture(u_field, vUv + vec2(-o.x, o.y))) * 0.25;
  /* A burning plank throws a few scattered flame cells, not a solid sheet,
     and averaged they all but vanish. So both fields go through a curve that
     lets a sparse few read as flame or smoke and a dense mass not blow out. */
  vec4 G = texture(u_gas, vUv);
  vec4 Gw = (texture(u_gas, vUv + o) + texture(u_gas, vUv - o)
           + texture(u_gas, vUv + vec2(o.x, -o.y)) + texture(u_gas, vUv + vec2(-o.x, o.y))) * 0.25;
  vec2 gm = mix(G.rg, Gw.rg, 0.5);
  float gasS = 1.0 - exp(-(gm.x + gm.y) * 3.5);
  float fireS = 1.0 - exp(-max(F.b, Fw.b * 0.85) * 5.0);

  if (gasS > 0.004) {
    // Pale where it is steam or cloud, grey where it is smoke, and blended
    // between them as smoothly as the plume thins.
    float pale = gm.x / max(gm.x + gm.y, 1e-4);
    float puff = fbm(gp * 0.42 + vec2(-u_time * 0.10, -u_time * 0.22), 4);
    float ga = clamp(gasS * 1.5 - 0.06, 0.0, 1.0) * (0.40 + 0.80 * puff);
    // Smoke is a grey haze, lit by the room and the fire under it — not
    // soot-black, which on the dark wall was simply invisible.
    vec3 gcol = mix(vec3(0.20, 0.20, 0.215), vec3(0.64, 0.69, 0.75) * (0.85 + 0.25 * puff), pale);
    // Lit like anything else, which is why smoke over a fire glows orange from
    // below and grey higher up.
    gcol = gcol * (amb + vec3(0.30) + lightF * 2.4);
    col = mix(col, gcol, clamp(ga * 0.94, 0.0, 1.0));
  }

  if (fireS > 0.004) {
    // Tongues that climb: a noise stretched upward and scrolling fast breaks
    // the smoothed heat into flames, hottest at their roots.
    float lick = fbm(vec2(gp.x * 0.55, gp.y * 0.16 + u_time * 1.6), 3);
    // A second, faster flicker, swaying, so the tongues split and rejoin.
    float lick2 = noise(vec2(gp.x * 0.9 + sin(u_time * 3.1 + gp.y * 0.3) * 0.6, gp.y * 0.35 + u_time * 4.2));
    float tongue = smoothstep(0.22, 0.85, fireS * (0.50 + 0.62 * lick + 0.38 * lick2));
    float heat = clamp(fireS * (0.45 + 0.75 * lick), 0.0, 1.0);
    vec3 fc2 = emissive(M_FIRE, heat, gp, u_time);
    // Flame is light: mostly added, with only a little of what is behind it
    // hidden, so you see the wall and the wood through it.
    col = col * (1.0 - 0.3 * tongue) + fc2 * tongue;
  }

  // A spark is a point of light: crisp in its own cell, its glow in the light field.
  if (cid == M_SPARK) {
    float pt = 1.0 - smoothstep(0.0, 0.55, length(fc - 0.5));
    col += emissive(M_SPARK, clamp(clife / life0(M_SPARK), 0.0, 1.0), gp, u_time) * pt;
  }

  /* ---- the glass in front ----------------------------------------------- */

  // A pane between you and the tank: the faintest diagonal sheen, and its
  // edges a touch darker where the frame shades them.
  float sheen = smoothstep(0.30, 0.0, abs(vUv.x * 0.8 + vUv.y - 1.25)) * 0.010;
  vec2 ce = min(vUv, 1.0 - vUv) * u_res / min(u_res.x, u_res.y);
  float frame = smoothstep(0.0, 0.035, min(ce.x, ce.y));
  col = col * (0.82 + 0.18 * frame) + vec3(sheen);

  col = aces(col * 1.05);
  col = toSRGB(col);
  col = dither(col, vUv * u_res);
  fragColor = vec4(col, 1.0);
}`

/* -------------------------------------------------------------------------- */
/* Renderers                                                                  */
/* -------------------------------------------------------------------------- */

export interface PowderRenderer {
  readonly gpu: boolean
  /** Grid size changed: rebuild anything sized off it. */
  resize(w: number, h: number): void
  draw(grid: Uint8Array, life: Uint8Array, shade: Uint8Array, time: number): void
  dispose(): void
}

/**
 * The original renderer, preserved. Flat palette colours straight into an
 * ImageData — what every visitor without WebGL2 still gets, unchanged.
 */
class Canvas2DRenderer implements PowderRenderer {
  readonly gpu = false
  private ctx: CanvasRenderingContext2D
  private img: ImageData | null = null
  private buf: Uint32Array | null = null

  constructor(private canvas: HTMLCanvasElement, private pal: Uint8Array, private vary: Uint8Array, private life0: Uint16Array) {
    this.ctx = canvas.getContext('2d', { alpha: false })!
  }

  resize(w: number, h: number) {
    this.canvas.width = w
    this.canvas.height = h
    this.img = this.ctx.createImageData(w, h)
    this.buf = new Uint32Array(this.img.data.buffer)
    this.ctx.imageSmoothingEnabled = false
  }

  draw(grid: Uint8Array, life: Uint8Array, shade: Uint8Array) {
    const buf = this.buf
    if (!buf || !this.img) return
    const { pal, vary, life0 } = this
    for (let i = 0; i < grid.length; i++) {
      const el = grid[i]
      if (el === 0) { buf[i] = 0xff0d0e10; continue }
      const v = (shade[i] / 255 - 0.5) * vary[el]
      let r = pal[el * 3] + v, g = pal[el * 3 + 1] + v, b = pal[el * 3 + 2] + v
      if (el === 5 || el === 15) {
        const t = life[i] / (life0[el] || 1)
        g *= 0.35 + t * 0.65
        b *= t * 0.6
      }
      buf[i] = (255 << 24) |
        (Math.max(0, Math.min(255, b | 0)) << 16) |
        (Math.max(0, Math.min(255, g | 0)) << 8) |
        Math.max(0, Math.min(255, r | 0))
    }
    this.ctx.putImageData(this.img, 0, 0)
  }

  dispose() {}
}

/** How wide the light spreads. Five levels reaches roughly a third of the world. */
const LIGHT_LEVELS = 5
/** Fragments in the composite. Above this the shading cost stops being free. */
const MAX_FRAGMENTS = 1.5e6

type Level = { fb: WebGLFramebuffer; tex: WebGLTexture; w: number; h: number }

class GLRenderer implements PowderRenderer {
  readonly gpu = true
  private gl: WebGL2RenderingContext
  private emitP: WebGLProgram | null
  private downP: WebGLProgram | null
  private upP: WebGLProgram | null
  private mainP: WebGLProgram | null
  private fieldP: WebGLProgram | null
  private blurP: WebGLProgram | null
  /** The smoothed fields, and a scratch target for blurring them. */
  private fieldA: Level | null = null
  private fieldB: Level | null = null
  private fieldG: Level | null = null
  private vao: WebGLVertexArrayObject
  private texId: WebGLTexture
  private texLife: WebGLTexture
  private texShade: WebGLTexture
  private levels: Level[] = []
  private locs = new Map<WebGLProgram, Map<string, WebGLUniformLocation | null>>()
  private gw = 0
  private gh = 0
  private half: number

  constructor(private canvas: HTMLCanvasElement, gl: WebGL2RenderingContext) {
    this.gl = gl
    // Half-float render targets need this in WebGL2. Without it the light
    // chain still works at 8 bits — the glow just cannot carry values above
    // 1.0, so it reads dimmer rather than breaking.
    const ext = gl.getExtension('EXT_color_buffer_half_float') || gl.getExtension('EXT_color_buffer_float')
    this.half = ext ? gl.RGBA16F : gl.RGBA8

    this.emitP = program(gl, EMIT_FRAG, FULLSCREEN_VERT)
    this.downP = program(gl, DOWN_FRAG, FULLSCREEN_VERT)
    this.upP = program(gl, UP_FRAG, FULLSCREEN_VERT)
    this.mainP = program(gl, MAIN_FRAG, FULLSCREEN_VERT)
    this.fieldP = program(gl, FIELD_FRAG, FULLSCREEN_VERT)
    this.blurP = program(gl, BLUR_FRAG, FULLSCREEN_VERT)

    this.vao = gl.createVertexArray()!
    gl.bindVertexArray(this.vao)
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)   // grid widths are not multiples of four

    this.texId = this.intTex()
    this.texLife = this.intTex()
    this.texShade = this.intTex()
  }

  get ok() { return !!(this.emitP && this.downP && this.upP && this.mainP && this.fieldP && this.blurP) }

  /** An 8-bit, linearly filtered target at grid size: values 0..1 are all a field needs. */
  private target(w: number, h: number): Level {
    const gl = this.gl
    const tex = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    const fb = gl.createFramebuffer()!
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
    return { fb, tex, w, h }
  }

  private intTex() {
    const gl = this.gl
    const t = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, t)
    // Integer textures cannot be filtered, which is exactly right here: the
    // shader wants the true material id of a cell, never a blend of two.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    return t
  }

  private uni(p: WebGLProgram, name: string) {
    let m = this.locs.get(p)
    if (!m) { m = new Map(); this.locs.set(p, m) }
    if (!m.has(name)) m.set(name, this.gl.getUniformLocation(p, name))
    return m.get(name) ?? null
  }

  resize(w: number, h: number) {
    const gl = this.gl
    this.gw = w
    this.gh = h

    for (const t of [this.texId, this.texLife, this.texShade]) {
      gl.bindTexture(gl.TEXTURE_2D, t)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8UI, w, h, 0, gl.RED_INTEGER, gl.UNSIGNED_BYTE, null)
    }

    for (const l of this.levels) { gl.deleteFramebuffer(l.fb); gl.deleteTexture(l.tex) }
    this.levels = []
    for (const l of [this.fieldA, this.fieldB, this.fieldG]) if (l) { gl.deleteFramebuffer(l.fb); gl.deleteTexture(l.tex) }
    this.fieldA = this.target(w, h)
    this.fieldB = this.target(w, h)
    this.fieldG = this.target(w, h)
    let lw = w, lh = h
    for (let i = 0; i < LIGHT_LEVELS; i++) {
      const tex = gl.createTexture()!
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.texImage2D(gl.TEXTURE_2D, 0, this.half, lw, lh, 0, gl.RGBA,
        this.half === gl.RGBA16F ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      const fb = gl.createFramebuffer()!
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
      this.levels.push({ fb, tex, w: lw, h: lh })
      lw = Math.max(1, lw >> 1)
      lh = Math.max(1, lh >> 1)
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)

    this.sizeCanvas()
  }

  /**
   * The composite runs at display resolution, not grid resolution — that is
   * the whole point of it, since the detail lives *inside* a cell. Capped by
   * area rather than by device pixel ratio, so a large window costs the same as
   * a small one on a retina screen.
   */
  private sizeCanvas() {
    const r = this.canvas.getBoundingClientRect()
    const dpr = Math.min(devicePixelRatio || 1, 2)
    let w = Math.max(1, Math.round(r.width * dpr))
    let h = Math.max(1, Math.round(r.height * dpr))
    const area = w * h
    if (area > MAX_FRAGMENTS) {
      const k = Math.sqrt(MAX_FRAGMENTS / area)
      w = Math.max(1, Math.round(w * k))
      h = Math.max(1, Math.round(h * k))
    }
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w
      this.canvas.height = h
    }
  }

  private blit(p: WebGLProgram, dst: Level | null, set: () => void) {
    const gl = this.gl
    gl.useProgram(p)
    gl.bindVertexArray(this.vao)
    if (dst) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb)
      gl.viewport(0, 0, dst.w, dst.h)
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    }
    set()
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  draw(grid: Uint8Array, life: Uint8Array, shade: Uint8Array, time: number) {
    const gl = this.gl
    if (!this.ok || !this.gw) return
    this.sizeCanvas()

    const w = this.gw, h = this.gh
    gl.bindTexture(gl.TEXTURE_2D, this.texId)
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, w, h, gl.RED_INTEGER, gl.UNSIGNED_BYTE, grid)
    gl.bindTexture(gl.TEXTURE_2D, this.texLife)
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, w, h, gl.RED_INTEGER, gl.UNSIGNED_BYTE, life)
    gl.bindTexture(gl.TEXTURE_2D, this.texShade)
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, w, h, gl.RED_INTEGER, gl.UNSIGNED_BYTE, shade)

    gl.disable(gl.BLEND)

    // 1. Emission.
    const ep = this.emitP!
    this.blit(ep, this.levels[0], () => {
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.texId)
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.texLife)
      gl.uniform1i(this.uni(ep, 'u_id'), 0)
      gl.uniform1i(this.uni(ep, 'u_life'), 1)
      gl.uniform2f(this.uni(ep, 'u_grid'), w, h)
      gl.uniform2f(this.uni(ep, 'u_res'), w, h)
      gl.uniform1f(this.uni(ep, 'u_time'), time)
    })

    // 2a. Down the chain.
    const dp = this.downP!
    for (let i = 1; i < this.levels.length; i++) {
      const src = this.levels[i - 1]
      this.blit(dp, this.levels[i], () => {
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src.tex)
        gl.uniform1i(this.uni(dp, 'u_src'), 0)
        gl.uniform2f(this.uni(dp, 'u_texel'), 1 / src.w, 1 / src.h)
      })
    }

    // 2b. And back up, adding into what the downsample left behind. Additive
    // blending saves a second set of targets.
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE)
    const up = this.upP!
    for (let i = this.levels.length - 1; i > 0; i--) {
      const src = this.levels[i]
      this.blit(up, this.levels[i - 1], () => {
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src.tex)
        gl.uniform1i(this.uni(up, 'u_src'), 0)
        gl.uniform2f(this.uni(up, 'u_texel'), 1 / src.w, 1 / src.h)
      })
    }
    gl.disable(gl.BLEND)

    // 2c. The fields — the main four, then the gas colours — each drawn, then
    // blurred across and back down through the scratch target.
    const fp = this.fieldP!, bp = this.blurP!
    for (const [out, which] of [[this.fieldA!, 0], [this.fieldG!, 1]] as const) {
      this.blit(fp, out, () => {
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.texId)
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.texLife)
        gl.uniform1i(this.uni(fp, 'u_id'), 0)
        gl.uniform1i(this.uni(fp, 'u_life'), 1)
        gl.uniform2f(this.uni(fp, 'u_grid'), w, h)
        gl.uniform2f(this.uni(fp, 'u_res'), w, h)
        gl.uniform1f(this.uni(fp, 'u_time'), time)
        gl.uniform1f(this.uni(fp, 'u_which'), which)
      })
      for (const [src, dst, dx, dy] of [[out, this.fieldB!, 1 / w, 0], [this.fieldB!, out, 0, 1 / h]] as const) {
        this.blit(bp, dst, () => {
          gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src.tex)
          gl.uniform1i(this.uni(bp, 'u_src'), 0)
          gl.uniform2f(this.uni(bp, 'u_dir'), dx, dy)
        })
      }
    }

    // 3. Composite.
    const mp = this.mainP!
    this.blit(mp, null, () => {
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.texId)
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.texLife)
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.texShade)
      gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, this.levels[0].tex)
      gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, this.fieldA!.tex)
      gl.uniform1i(this.uni(mp, 'u_field'), 4)
      gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, this.fieldG!.tex)
      gl.uniform1i(this.uni(mp, 'u_gas'), 5)
      gl.uniform1i(this.uni(mp, 'u_id'), 0)
      gl.uniform1i(this.uni(mp, 'u_life'), 1)
      gl.uniform1i(this.uni(mp, 'u_shade'), 2)
      gl.uniform1i(this.uni(mp, 'u_light'), 3)
      gl.uniform2f(this.uni(mp, 'u_grid'), w, h)
      gl.uniform2f(this.uni(mp, 'u_res'), this.canvas.width, this.canvas.height)
      gl.uniform1f(this.uni(mp, 'u_time'), time)
    })
  }

  dispose() {
    const gl = this.gl
    for (const l of [...this.levels, this.fieldA, this.fieldB, this.fieldG]) if (l) { gl.deleteFramebuffer(l.fb); gl.deleteTexture(l.tex) }
    gl.getExtension('WEBGL_lose_context')?.loseContext()
  }
}

/**
 * Pick a renderer. The 2D one is not a stub — it is the renderer this page
 * shipped with, and it stays the answer for anything without WebGL2.
 */
export function createPowderRenderer(
  canvas: HTMLCanvasElement,
  pal: Uint8Array,
  vary: Uint8Array,
  life0: Uint16Array,
): PowderRenderer {
  const attrs: WebGLContextAttributes = {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: 'high-performance',
  }

  /*
   * Compiled on a throwaway canvas first, and only then on the real one.
   *
   * A canvas can only ever have one kind of context: ask it for 'webgl2' and
   * '2d' returns null from then on, permanently. So asking the real canvas
   * directly would mean that a driver which cannot compile these shaders — the
   * exact case the 2D renderer exists for — would take the fallback down with
   * it and leave a blank page. Probing costs one extra compile at startup.
   */
  const probe = document.createElement('canvas')
  probe.width = probe.height = 1
  const pgl = probe.getContext('webgl2', attrs)
  let usable = false
  if (pgl) {
    // A compile failure is already logged with line numbers by `program`.
    usable = [EMIT_FRAG, DOWN_FRAG, UP_FRAG, MAIN_FRAG, FIELD_FRAG, BLUR_FRAG]
      .every((f) => !!program(pgl, f, FULLSCREEN_VERT))
    pgl.getExtension('WEBGL_lose_context')?.loseContext()
  }

  if (usable) {
    const gl = canvas.getContext('webgl2', attrs)
    if (gl) {
      const r = new GLRenderer(canvas, gl)
      if (r.ok) return r
      r.dispose()
    }
  }
  return new Canvas2DRenderer(canvas, pal, vary, life0)
}
