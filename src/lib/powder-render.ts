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
`

/* Shared by the emission pass and the composite, so a flame and the light it
   throws can never disagree about its own colour. */
const EMIT = `
float life0(uint id) {
  if (id == M_FIRE)  return 46.0;
  if (id == M_SMOKE) return 130.0;
  if (id == M_STEAM) return 170.0;
  if (id == M_EMBER) return 120.0;
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
uniform vec2 u_grid;

uint  idAt(ivec2 c)    { return texelFetch(u_id,    clamp(c, ivec2(0), ivec2(u_grid) - 1), 0).r; }
float lifeAt(ivec2 c)  { return float(texelFetch(u_life,  clamp(c, ivec2(0), ivec2(u_grid) - 1), 0).r); }
float shadeAt(ivec2 c) { return float(texelFetch(u_shade, clamp(c, ivec2(0), ivec2(u_grid) - 1), 0).r) / 255.0; }

// Fire counts as a gas here: it rises like one in the simulation, and drawn as
// hard squares it was the single worst-looking thing on the page.
bool isGas(uint id)   { return id == M_SMOKE || id == M_STEAM || id == M_FIRE; }
bool isFluid(uint id) { return id == M_WATER || id == M_OIL || id == M_ACID || id == M_LAVA; }
bool isOpen(uint id)  { return id == M_EMPTY || isGas(id); }

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
  float alpha;      // for glass, and for droplets too small to fill a cell
  float scatter;    // how much of the light field the medium itself carries
};

void main() {
  vec2 gp = vec2(vUv.x, 1.0 - vUv.y) * u_grid;
  ivec2 ic = ivec2(floor(gp));
  vec2 fc = fract(gp);                 // where we are inside this cell

  uint cid = idAt(ic);
  float csh = shadeAt(ic);
  float clife = lifeAt(ic);

  /* One 2x2 lattice, offset half a cell, drives every smooth field on the
     page — liquid surfaces, gas edges, plant tips. Four fetches, reused. */
  vec2 lat = gp - 0.5;
  ivec2 b = ivec2(floor(lat));
  vec2 fr = fract(lat);
  uint i00 = idAt(b), i10 = idAt(b + ivec2(1, 0));
  uint i01 = idAt(b + ivec2(0, 1)), i11 = idAt(b + ivec2(1, 1));

  vec3 lightF = texture(u_light, vUv).rgb;

  /* ---- the solid layer -------------------------------------------------- */

  uint base = isGas(cid) ? M_EMPTY : cid;

  Surf s;
  s.albedo = vec3(0.0);
  s.n = vec3(0.0, 0.0, 1.0);
  s.spec = 0.0;
  s.shine = 24.0;
  s.emit = vec3(0.0);
  s.alpha = 1.0;
  s.scatter = 0.0;

  // Coverage of the material under the cursor, and its gradient. For anything
  // that pools, this is the meniscus.
  float m00 = i00 == base ? 1.0 : 0.0, m10 = i10 == base ? 1.0 : 0.0;
  float m01 = i01 == base ? 1.0 : 0.0, m11 = i11 == base ? 1.0 : 0.0;
  float cov = bilin(m00, m10, m01, m11, fr);
  vec2 cg = bigrad(m00, m10, m01, m11, fr);

  // Distance from a cell edge, used for the shadow between grains.
  float edge = min(min(fc.x, 1.0 - fc.x), min(fc.y, 1.0 - fc.y));

  if (base == M_SAND || base == M_POWDER || base == M_EMBER) {
    // A powder is grains, not a fill. Every cell gets its own tone from the
    // simulation's own 'shade' byte, and the gaps between them are shadowed,
    // so a dune reads as granular at any zoom.
    //
    // Ember belongs here and not with the gases: it is charcoal that happens to
    // be glowing, and emissive() lights it from the inside. Left out of every
    // branch it inherited air, and a falling coal was a bodiless streak.
    vec3 c0 = base == M_SAND   ? vec3(0.72, 0.53, 0.22)
            : base == M_POWDER ? vec3(0.055, 0.052, 0.062)
            :                    vec3(0.085, 0.050, 0.038);
    float v = csh - 0.5;
    s.albedo = c0 * (1.0 + v * (base == M_SAND ? 0.34 : 0.55));
    s.albedo *= 0.72 + 0.28 * smoothstep(0.0, 0.30, edge);
    s.albedo *= 0.88 + 0.24 * noise(gp * 5.0 + csh * 40.0);
    // Grains catch the light on whichever side they were packed against.
    s.n = normalize(vec3(-cg * 0.9 + (hash22(vec2(ic)) - 0.5) * 0.5, 1.0));
    s.spec = base == M_SAND ? 0.30 : 0.10;
    s.shine = 18.0;

  } else if (base == M_STONE) {
    float mott = fbm(gp * 0.55, 4);
    s.albedo = mix(vec3(0.075, 0.077, 0.086), vec3(0.20, 0.20, 0.215), mott) * (0.85 + 0.28 * csh);
    /* Relief at just under one cycle per cell, not 2.6. Faster than that and
       the noise is finer than the thing it is supposed to be carving, so a
       wall stops reading as rock and starts reading as static. */
    float rel = fbm(gp * 0.85 + 11.0, 3);
    s.albedo *= 0.82 + 0.30 * rel;
    s.n = normalize(vec3(-cg * 1.4 + (vec2(rel, fbm(gp * 0.85 + 31.0, 3)) - 0.5) * 0.6, 1.0));
    s.spec = 0.09;
    s.shine = 10.0;

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
    // Growing tips are where the coverage thins out, so they lighten on their
    // own as the plant spreads.
    float tip = 1.0 - smoothstep(0.35, 0.95, cov);
    // Two scales. One alone is a flat green mass: broad clumps give the thicket
    // its shape, leaf-sized detail inside them gives it a surface.
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
    // Glass is mostly not there. What you see is the edge, where the surface
    // turns away and catches the light.
    float rim = clamp(length(cg) * 1.9, 0.0, 1.0);
    s.albedo = vec3(0.38, 0.52, 0.55) * (0.25 + 0.75 * rim);
    // A pane is not perfectly flat. The streaks are what tell you the dark
    // patch is glass and not a hole in the world.
    float streak = fbm(vec2(gp.x * 0.30 + gp.y * 0.10, gp.y * 0.06), 3);
    s.albedo += vec3(0.10, 0.13, 0.14) * smoothstep(0.55, 0.78, streak);
    s.alpha = 0.26 + 0.58 * rim;
    s.n = normalize(vec3(-cg * 2.2, 1.0));
    s.spec = 0.95;
    s.shine = 60.0;

  } else if (base == M_ICE) {
    // Faceted, not smooth: the noise field is stepped so it breaks into planes
    // that each catch the light at their own angle.
    float f = fbm(gp * 0.42 + csh * 6.0, 4);
    // The steps drive colour only. Taking normals from them made every step
    // boundary a specular edge, and the whole block crawled with white pixels.
    float facet = floor(f * 5.0) / 5.0;
    s.albedo = mix(vec3(0.155, 0.30, 0.42), vec3(0.46, 0.64, 0.76), facet) * 0.82;
    // Fracture planes and trapped air, which is what makes ice read as frozen
    // rather than as pale plastic.
    float veins = 1.0 - abs(f * 2.0 - 1.0);
    s.albedo += vec3(0.10, 0.14, 0.16) * pow(veins, 6.0);
    s.n = normalize(vec3(-cg * 1.1 + (vec2(f, fbm(gp * 0.42 + 17.0, 4)) - 0.5) * 0.7, 1.0));
    s.spec = 0.55;
    s.shine = 34.0;
    s.alpha = 0.88;

  } else if (isFluid(base)) {
    // Liquids get the meniscus. 'cov' is ~1 deep inside the body and falls off
    // at the surface, so depth-tinting and the specular both fall out of the
    // same number.
    float depth = smoothstep(0.25, 1.0, cov);
    float surf = 1.0 - depth;
    vec2 flow = vec2(u_time * 0.35, -u_time * 0.18);
    // Low frequency on purpose. One noise cell per two grid cells put a
    // highlight on almost every pixel and the whole pool crawled with white
    // speckle; a ripple has to be wider than the thing it is rippling across.
    float rip = fbm(gp * 0.20 + flow, 3);
    // A droplet in mid-air is one cell, and one cell drawn flat is a square.
    // Fading by coverage rounds it off against the air behind it.
    s.alpha = smoothstep(0.05, 0.42, cov);

    if (base == M_WATER) {
      s.albedo = mix(vec3(0.16, 0.42, 0.72), vec3(0.015, 0.075, 0.20), depth);
      // Caustic-ish shimmer, brightest just under the surface where light
      // actually gets in.
      s.albedo += vec3(0.10, 0.20, 0.26) * pow(rip, 3.0) * (1.0 - depth * 0.6);
      s.spec = 0.85;
      s.shine = 52.0;
    } else if (base == M_OIL) {
      s.albedo = mix(vec3(0.055, 0.042, 0.030), vec3(0.012, 0.009, 0.007), depth);
      // Thin-film sheen: only on the skin, and it shifts hue across the slick,
      // which is the giveaway that reads as oil rather than as dark water.
      vec3 film = 0.5 + 0.5 * cos(vec3(0.0, 2.1, 4.2) + rip * 5.0 + gp.x * 0.06);
      s.albedo += film * surf * 0.15;
      s.spec = 0.72;
      s.shine = 40.0;
    } else if (base == M_ACID) {
      s.albedo = mix(vec3(0.30, 0.66, 0.07), vec3(0.10, 0.26, 0.02), depth);
      s.albedo += vec3(0.20, 0.42, 0.04) * pow(rip, 2.4);
      s.spec = 0.55;
      s.shine = 30.0;
    } else {                       // lava
      float crust = fbm(gp * 0.26 + vec2(u_time * 0.05, -u_time * 0.028), 3);
      s.albedo = mix(vec3(0.075, 0.032, 0.026), vec3(0.16, 0.075, 0.05), crust);
      s.spec = 0.20;
      s.shine = 12.0;
    }
    // Surface normal from the meniscus, roughened by the ripple so a still pool
    // is not a mirror.
    s.n = normalize(vec3(-cg * 2.4 + vec2(dFdx(rip), dFdy(rip)) * 2.2, 1.0));

  } else {
    /* Air. Not black: it takes the light field, which is what makes a fire look
       like it is in a room rather than pasted on top of one. */
    vec2 p = centred(vUv);
    s.albedo = vec3(0.0);
    s.emit = vec3(0.026, 0.027, 0.032) * (1.0 - dot(p, p) * 0.16);
    s.alpha = 1.0;
    // Air is the one medium with no surface, so it cannot pick light up the way
    // everything else does. Without this a fire lights the floor it is standing
    // on and leaves the room around it pitch black.
    s.scatter = 0.24;
  }

  /* Solids keep a trace of the grid they live on. Powders shadow their own
     gaps hard, above; this is the quiet version for everything else. Without
     it the shading smooths the world into an airbrush painting and a sandbox
     stops reading as a sandbox. */
  if (base == M_STONE || base == M_WOOD || base == M_PLANT || base == M_ICE) {
    s.albedo *= 0.90 + 0.10 * smoothstep(0.0, 0.20, edge);
  }

  float k = clamp(clife / life0(base), 0.0, 1.0);
  s.emit += emissive(base, k, gp, u_time);

  /* ---- lighting --------------------------------------------------------- */

  // A cool key from the upper left, so solids have a consistent form, plus the
  // emitters, which are warm and are the only thing that moves.
  const vec3 KEY = vec3(-0.42, 0.60, 0.68);
  vec3 kd = normalize(KEY);
  float diff = max(0.0, dot(s.n, kd)) * 0.5 + 0.5;      // wrapped, so nothing goes pure black
  vec3 half_ = normalize(kd + vec3(0.0, 0.0, 1.0));
  float sp = pow(max(0.0, dot(s.n, half_)), s.shine) * s.spec;

  /* The blur chain accumulates five levels into level 0, so the light field
     carries several times the energy the emitters put in. These gains bring it
     back to something the tonemap can hold: at 1.9 a lava pool washed itself,
     and everything within reach of it, to white. */
  vec3 amb = vec3(0.115, 0.125, 0.155);
  vec3 col = s.albedo * (amb + vec3(0.30, 0.30, 0.33) * diff + lightF * 0.62);
  col += vec3(0.55, 0.58, 0.66) * sp;
  // Emitters glint off nearby surfaces too, or a lake beside lava stays flat.
  col += lightF * s.spec * 0.22;
  col += lightF * s.scatter;
  col += s.emit;

  if (s.alpha < 1.0) {
    // Whatever is behind glass or ice: the air plate, plus the light coming
    // through, bent a little by the surface.
    /* Whatever is behind glass, ice, or a droplet too small to fill its cell:
       the same air the air branch draws, at the same scatter, bent a little by
       the surface. Giving it a gain of its own put a bright halo around every
       stray water cell whenever anything nearby was burning. */
    vec3 behind = vec3(0.026, 0.027, 0.032) + texture(u_light, vUv + cg * 0.006).rgb * 0.24;
    col = mix(behind, col, s.alpha);
  }

  /* ---- gases, over the top ---------------------------------------------- */

  // Gases dissolve into the air instead of ending at a cell boundary. Their
  // remaining life is their opacity, so a plume genuinely thins as it drifts.
  float g00 = isGas(i00) ? clamp(lifeAt(b) / life0(i00), 0.0, 1.0) : 0.0;
  float g10 = isGas(i10) ? clamp(lifeAt(b + ivec2(1, 0)) / life0(i10), 0.0, 1.0) : 0.0;
  float g01 = isGas(i01) ? clamp(lifeAt(b + ivec2(0, 1)) / life0(i01), 0.0, 1.0) : 0.0;
  float g11 = isGas(i11) ? clamp(lifeAt(b + ivec2(1, 1)) / life0(i11), 0.0, 1.0) : 0.0;
  float ga = bilin(g00, g10, g01, g11, fr);

  if (ga > 0.001) {
    // Which gas: the nearest one wins, so a steam cloud beside smoke keeps its
    // own colour instead of averaging to grey.
    uint gid = i00;
    float best = g00;
    if (g10 > best) { gid = i10; best = g10; }
    if (g01 > best) { gid = i01; best = g01; }
    if (g11 > best) { gid = i11; best = g11; }

    float puff = fbm(gp * 0.42 + vec2(-u_time * 0.10, -u_time * 0.22), 4);
    // Eroding the alpha with noise is what turns a blob into a plume.
    float a = clamp(ga * 1.6 - 0.16, 0.0, 1.0);
    a *= 0.35 + 0.85 * puff;

    if (gid == M_FIRE) {
      // A noise stretched vertically and scrolling upward fast: it breaks the
      // plume into tongues that climb, which is the difference between fire and
      // an orange cloud. Stretching it is what makes them vertical.
      float lick = fbm(vec2(gp.x * 0.55, gp.y * 0.16 + u_time * 1.6), 3);
      vec3 fc2 = emissive(M_FIRE, clamp(best * (0.55 + 0.75 * lick), 0.0, 1.0), gp, u_time);
      float fa = clamp(a * 1.7, 0.0, 1.0) * (0.45 + 0.85 * lick);
      col = mix(col, fc2, clamp(fa, 0.0, 1.0));
    } else {
      vec3 gcol = gid == M_STEAM ? vec3(0.62, 0.68, 0.74) : vec3(0.085, 0.082, 0.088);
      // Lit like anything else, which is why smoke over a fire glows orange
      // from below and grey higher up.
      gcol = gcol * (amb + vec3(0.30) + lightF * 2.2);
      col = mix(col, gcol, clamp(a * 0.92, 0.0, 1.0));
    }
  }

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

    this.vao = gl.createVertexArray()!
    gl.bindVertexArray(this.vao)
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)   // grid widths are not multiples of four

    this.texId = this.intTex()
    this.texLife = this.intTex()
    this.texShade = this.intTex()
  }

  get ok() { return !!(this.emitP && this.downP && this.upP && this.mainP) }

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

    // 3. Composite.
    const mp = this.mainP!
    this.blit(mp, null, () => {
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.texId)
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.texLife)
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.texShade)
      gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, this.levels[0].tex)
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
    for (const l of this.levels) { gl.deleteFramebuffer(l.fb); gl.deleteTexture(l.tex) }
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
    usable = [EMIT_FRAG, DOWN_FRAG, UP_FRAG, MAIN_FRAG]
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
