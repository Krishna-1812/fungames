/**
 * Progress's instrument, as the GPU draws it.
 *
 * The geometry and the palette live next door in progress-geom.ts, and the
 * split is not tidiness. Nothing on this site could test a shader module until
 * now, because every one of them imports ./gl and Node's TypeScript loader
 * refuses that file: ShaderSurface uses parameter properties, which strip-only
 * mode will not parse, and the module calls matchMedia at import time, which
 * does not exist off a browser. So everything a checker needs to reach lives
 * in the pure half, and this half holds only the source string.
 *
 * Every dimension below is interpolated from DIAL rather than typed in, so the
 * channels the shader mills and the channels ringAt() hit-tests are the same
 * channels by construction. check-progress-dial.mjs reads this file as text
 * and asserts exactly that: that each constant arrives by name, and that no
 * second copy of a number has quietly appeared.
 *
 * Everything is lit by one raked light from the upper left, and every edge is
 * shaded from a real surface normal rather than a gradient guess. That is the
 * whole difference between metal and a picture of metal: a gradient runs the
 * same way down both walls of a groove, and a normal does not. On a raised
 * bezel lit from the upper left the *inner* slope is bright on the far side
 * and the *outer* slope is bright on the near side — get that backwards and
 * the ring reads as printed rather than turned.
 *
 * ## Cost
 *
 * There is no loop over rings. Channels do not overlap, so the ring under a
 * fragment is floor((TRACK_OUT - r) / band) — one divide. Only the light a
 * fill throws onto its neighbours crosses a boundary, and that is two extra
 * emissive terms with no texture behind them. The shader is constant-cost per
 * fragment at any ring count, which matters: this is 700 CSS pixels square at
 * device pixel ratio 2.
 */
import { glsl } from './gl'
import { DIAL, APERTURE_MAX_LUM, LUME_COLD, LUME_HOT } from './progress-geom'

/** GLSL wants a decimal point on every float literal. */
const f = (n: number) => n.toFixed(5)

export const DIAL_FRAG = glsl(`
uniform float u_n;             // rings in use
uniform float u_frac[16];      // 0..1 filled, outermost first
uniform float u_rate[16];      // 0..1 visual speed, from rateOf()
uniform float u_focus;         // highlighted ring, or -1
uniform float u_focusMix;      // 0..1, eased, so focus fades rather than snaps
uniform float u_motion;        // 0 under prefers-reduced-motion

#define CASE_R    ${f(DIAL.caseR)}
#define BEZEL_IN  ${f(DIAL.bezelIn)}
#define TRACK_OUT ${f(DIAL.trackOut)}
#define TRACK_IN  ${f(DIAL.trackIn)}
#define APER_R    ${f(DIAL.aperR)}
#define GROOVE    ${f(DIAL.groove)}
#define APER_LUM  ${f(APERTURE_MAX_LUM)}

/* One light, upper left, raked. The z term is what stops every bevel reading
   as pure black on its far side: a real desk has a ceiling too. */
const vec3 L   = vec3(-0.5121, 0.6401, 0.5729);
const vec2 LXY = vec2(-0.6247, 0.7809);

/** Lume colour by rate: cold mineral when slow, hot liquid when fast. */
vec3 lume(float sp) {
  float k = sp * sp * (3.0 - 2.0 * sp);
  return mix(vec3(${LUME_COLD.map(f).join(', ')}), vec3(${LUME_HOT.map(f).join(', ')}), k);
}

/**
 * Shade a surface whose normal is tilted by its nxy off facing us.
 *
 * The return is a colour rather than a number because the lamp has one: it is
 * a warm bulb in a cool room, so the highlight runs warmer than the fill
 * light. That is the cheapest realism available — one tint on the specular,
 * another on the diffuse — and it is most of the difference between metal and
 * grey plastic, which is what this was before the two were separated.
 */
vec3 lit(vec2 nxy, float gloss) {
  vec3 N = normalize(vec3(nxy, 1.0));
  float dif = max(dot(N, L), 0.0);
  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
  float s = pow(max(dot(N, H), 0.0), gloss);
  return vec3(0.94, 0.95, 1.06) * (dif * 0.75) + vec3(1.06, 0.97, 0.84) * (s * 0.9);
}

/**
 * Circumferential brushing — marks that run around the dial, not across it.
 *
 * Sampled off the direction vector rather than off atan(). Anything hashed
 * from an angle tears at twelve o'clock, because one side of the cut is keyed
 * on an input near 0 and the other on an input near 6.283; the direction
 * vector has no cut in it at all.
 */
float brushed(vec2 dir, float r, float fine) {
  // Slow along the circle, fast across it. That is what a spun finish is.
  float a = dir.x * 6.1 + dir.y * 2.37;
  return noise(vec2(a, r * fine)) * 0.62 + noise(vec2(a * 2.7 + 11.0, r * fine * 2.6)) * 0.38;
}

void main() {
  vec2 p = centred(vUv);
  float r = length(p);
  float aa = max(fwidth(r), 1e-5);

  // Past the case is the shadow it throws, and then nothing at all.
  if (r > CASE_R + 0.075) { fragColor = vec4(0.0); return; }

  vec2 dir = r > 1e-4 ? p / r : vec2(0.0, 1.0);
  // 0 at twelve o'clock, increasing clockwise. atan(x, y), not atan(y, x).
  float ang = atan(p.x, p.y);
  float t01 = ang < 0.0 ? (ang + TAU) / TAU : ang / TAU;

  vec3 col = vec3(0.0);
  float alpha = 1.0;

  /* --------------------------------------------------------------------
     The shadow the case throws on the panel behind it. Emitted as alpha, so
     it darkens what is actually back there rather than painting grey on it.
     -------------------------------------------------------------------- */
  if (r > CASE_R - aa) {
    float sd = length(p + LXY * 0.030) - CASE_R;   // offset opposite the light
    alpha = 0.66 * exp(-max(sd, 0.0) * 24.0);
    alpha = mix(alpha, 1.0, smoothstep(CASE_R + aa, CASE_R - aa, r));
    if (r > CASE_R) { fragColor = vec4(0.0, 0.0, 0.0, clamp(alpha, 0.0, 1.0)); return; }
  }

  if (r > BEZEL_IN) {
    /* ------------------------------------------------------------------
       The bezel: a raised, radially brushed steel ring, knurled at the rim,
       with four countersunk screws in it.
       ------------------------------------------------------------------ */
    float bz = (r - BEZEL_IN) / (CASE_R - BEZEL_IN);   // 0 at the plate, 1 at the rim
    // Domed: rises off the plate, crowns, falls away to the rim.
    float slope = bz < 0.30 ? (1.0 - bz / 0.30) : -smoothstep(0.55, 1.0, bz);
    vec2 nxy = -dir * slope * 0.85;

    // Knurling on the outer third. A whole number of teeth, so it closes up.
    float knurl = smoothstep(0.35, 1.0, bz) * sin(t01 * TAU * 168.0);
    nxy += vec2(dir.y, -dir.x) * knurl * 0.40;

    float steel = 0.60 + 0.40 * brushed(vec2(dir.y, dir.x), r * 3.0, 900.0);
    col = vec3(0.086, 0.080, 0.104) * steel * (0.30 + 1.45 * lit(nxy, 34.0));

    for (int s = 0; s < 4; s++) {
      float sa = (float(s) + 0.5) * PI * 0.5;
      vec2 sc = vec2(sin(sa), cos(sa)) * (BEZEL_IN + CASE_R) * 0.5;
      vec2 q = p - sc;
      float sr = length(q) / 0.032;
      if (sr > 1.30) continue;
      // Countersunk: a dished cone, so the far wall is the lit one.
      float cone = smoothstep(1.0, 0.15, sr);
      vec2 sn = (sr > 1e-4 ? normalize(q) : vec2(0.0)) * cone * 1.05;
      // Every screw was done up by a different hand.
      float slotA = hash11(float(s) + 3.0) * PI;
      float slot = smoothstep(0.17, 0.07, abs(dot(q, vec2(cos(slotA), sin(slotA)))) / 0.032)
                 * smoothstep(1.02, 0.88, sr);
      vec3 sbase = vec3(0.115, 0.109, 0.134) * (0.55 + 0.45 * brushed(q * 30.0, sr, 400.0));
      vec3 scol = sbase * (0.34 + 1.70 * lit(sn - vec2(0.0, slot * 0.75), 40.0));
      // The slot is a shadowed cut, not a hole punched through the bezel.
      scol = mix(scol, scol * 0.42, slot);
      col = mix(col, scol, smoothstep(1.06, 0.97, sr));
    }
  } else {
    /* ------------------------------------------------------------------
       The dial plate, and the channels milled into it.
       ------------------------------------------------------------------ */
    /* Sunburst: an anisotropic finish has two lobes, at the light and opposite
       it — which is why a spun dial wears a bright bar across it, not a blob.
       The floor under the lobe matters as much as the lobe: with it too low the
       ribs went black and the whole dial read as neon on nothing rather than
       as lume in metal. */
    float lobe = pow(abs(dot(dir, LXY)), 3.0);
    col = vec3(0.075, 0.064, 0.100)
        * (0.72 + 0.85 * lobe)
        * (0.78 + 0.48 * brushed(dir, r, 1500.0))
        * (0.80 + 0.20 * smoothstep(TRACK_IN * 0.6, TRACK_OUT, r));

    float band = (TRACK_OUT - TRACK_IN) / u_n;
    /* Every fill starts at twelve o'clock, and the engraved index says so.
       Measured in arc length rather than in turns: a constant width in t01
       is a wedge that fans out to nothing at the rim and swallows the middle
       of the dial at the centre, which is exactly what it looked like. */
    float zero = smoothstep(0.0060, 0.0022, min(t01, 1.0 - t01) * TAU * r);

    if (r < TRACK_OUT && r > TRACK_IN) {
      /* Index marks engraved on the ribs — sixty minors, twelve majors. They
         are on the plate rather than in the channels so that a full ring does
         not paint over its own scale. */
      float minor = abs(fract(t01 * 60.0) - 0.5) * 2.0;
      float major = abs(fract(t01 * 12.0) - 0.5) * 2.0;
      float w = fwidth(t01 * 60.0) * 2.4;
      col += vec3(0.42, 0.36, 0.55)
           * (smoothstep(1.0 - w, 1.0, minor) * 0.30 + smoothstep(1.0 - w * 0.2, 1.0, major) * 0.85)
           * 0.032;
      col += vec3(0.62, 0.54, 0.80) * zero * 0.055;
    }

    if (r < TRACK_IN) {
      /* Guilloché on the boss. Engine turning is two interfering ray families;
         the gradient is analytic because differencing something this fine with
         dFdx aliases into moiré the moment the page is zoomed. */
      /* Forty rays and a radial pitch of 150 puts both families at fourteen
         pixels or so on a 650-pixel dial. The first pass used 68 and 300,
         which is a fine pattern on a retina screen and is gone entirely at
         device pixel ratio 1 — the fade below correctly took it to 6% and the
         boss came out a flat smudge. Engine turning has to be coarse enough
         to survive the display it is on. */
      float rays = 40.0, pitch = 150.0;
      float A = t01 * TAU * rays + r * pitch;
      float B = t01 * TAU * rays - r * pitch;
      float h = sin(A) * sin(B);
      float dhdr = pitch * (cos(A) * sin(B) - sin(A) * cos(B));
      float dhdt = TAU * rays * (cos(A) * sin(B) + sin(A) * cos(B));
      vec2 grad = dir * dhdr + vec2(dir.y, -dir.x) * (dhdt / max(TAU * r, 0.05));
      // Fade the relief out as the pattern closes on a pixel wide.
      float keep = 1.0 - smoothstep(0.0055, 0.0130, aa);
      /* Kept dim. Engine turning is a texture on the way to the number in the
         middle, and at the first pass's brightness it was a lattice you looked
         at instead — the boss out-competed its own readout. */
      col = vec3(0.048, 0.041, 0.068) * (0.88 + 0.22 * h * keep)
          * (0.50 + 0.62 * lit(grad * 0.00085 * keep, 26.0));

      /* The readout aperture: a recess with a chamfered lip, matte inside.
         Being a recess is what makes it dark, and being dark is what makes the
         percentage on top of it readable — see APERTURE_MAX_LUM. */
      float t = clamp((APER_R - r) / 0.026, 0.0, 1.0);
      vec3 apCol = vec3(0.0125, 0.0105, 0.0205) * (0.55 + 0.55 * brushed(dir, r, 2600.0));
      // The lip's far wall catches the light; the near wall is in its own shade.
      apCol *= (0.34 + 0.85 * lit(dir * sin(t * PI) * 1.6, 18.0))
             * (0.42 + 0.58 * smoothstep(0.0, 0.45, t));
      col = mix(col, apCol, smoothstep(0.0, 0.55, t));
      // A hard contact shadow right at the edge, so it is a step and not a fade.
      col *= 1.0 - 0.45 * exp(-abs(r - APER_R) * 430.0);
    }

    /* ------------------------------------------------------------------
       The channel under this fragment. One index, no loop: bands do not
       overlap, so finding the ring is a division rather than a search.
       ------------------------------------------------------------------ */
    float fi = floor((TRACK_OUT - r) / band);
    if (r <= TRACK_OUT && r >= TRACK_IN && fi >= 0.0 && fi < u_n) {
      int i = int(fi);
      float b1 = TRACK_OUT - fi * band;
      float cut = band * (1.0 - GROOVE) * 0.5;
      float g0 = b1 - band + cut, g1 = b1 - cut;

      float sp = u_rate[i];
      float frac = u_frac[i];
      float focus = mix(1.0, abs(fi - u_focus) < 0.5 ? 1.55 : 0.32, u_focusMix);

      float rc = (r - g0) / (g1 - g0);          // 0 at the inner wall, 1 at the outer
      float inCh = smoothstep(-aa, aa, r - g0) * smoothstep(-aa, aa, g1 - r);

      if (inCh > 0.001) {
        float cw = 0.26;                        // chamfer, as a share of the width
        /* The two walls tilt opposite ways. This is the whole reason a groove
           reads as cut into metal rather than drawn on it. */
        float wall = rc < cw ? -(1.0 - rc / cw)
                   : rc > 1.0 - cw ? (rc - (1.0 - cw)) / cw
                   : 0.0;
        vec3 walls = lit(-dir * wall * 1.15, 22.0);
        vec3 ch = vec3(0.021, 0.017, 0.035) * (0.7 + 0.6 * brushed(dir, r, 3400.0))
                * (0.35 + 1.25 * walls)
                // Contact shadow where each wall meets the floor.
                * (0.45 + 0.55 * smoothstep(0.0, cw * 0.9, min(rc, 1.0 - rc)));
        ch += vec3(0.30, 0.26, 0.42) * zero * 0.030;

        float edge = fwidth(t01) * 1.5;
        float on = frac >= 0.99999 ? 1.0 : smoothstep(frac + edge, frac - edge, t01);

        if (on > 0.001) {
          /* Material by rate. Liquid at the rim, bedded rock at the centre.
             The flow runs at the ring's real speed: the seconds channel
             streams, the millennium's creeps, and the Sun's is stationary
             because its rate is exactly zero rather than merely small. */
          float sx = t01 * 9.0 - u_time * u_motion * pow(sp, 1.6) * 1.35 + fi * 13.0;
          float liquid = fbm(vec2(sx * 1.9, rc * 1.6 + fi * 5.0), 2);
          float bedding = 0.44 + 0.32 * sin(t01 * 46.0 + fbm(vec2(t01 * 7.0 + fi * 3.1, rc), 2) * 7.0);
          float tex = mix(bedding, liquid, smoothstep(0.14, 0.72, sp));

          vec3 base = lume(sp) * (0.72 + 0.38 * clamp(t01 / max(frac, 1e-3), 0.0, 1.0));
          /* Domed meniscus, so the lume sits in the channel rather than on it,
             and the same wall lighting the empty floor gets. Without the walls
             term the fill simply replaced the groove: every empty channel read
             as cut into metal and every full one read as a painted stripe, and
             since most of them are mostly full, the dial as a whole read as
             painted. The overall level is low on purpose — the first pass ran
             the fill at 1.6 in linear light, which ACES takes to 0.95, white.
             Lume is bright, and bright is not the same as blown. */
          vec3 fill = base * (0.26 + 0.30 * tex)
                    * (0.66 + 0.50 * sin(clamp(rc, 0.0, 1.0) * PI))
                    * (0.70 + 0.55 * walls);
          ch = mix(ch, fill, on);

          // The head. The only part of a gauge anybody actually watches.
          float dh = abs(t01 - frac);
          dh = min(dh, 1.0 - dh) * TAU * r;
          float cap = exp(-dh * 210.0) * step(0.0008, frac);
          ch += mix(vec3(0.72, 0.46, 1.00), vec3(1.00, 0.74, 0.96), sp) * cap * (0.10 + 0.66 * sp);
        }

        col = mix(col, ch * focus, inCh);
      }

      /* Light thrown out of a channel onto the plate and its neighbours.
         Three terms rather than a loop: a channel's glow does not reach past
         the ring either side of it. */
      for (int k = -1; k <= 1; k++) {
        float ni = fi + float(k);
        if (ni < 0.0 || ni >= u_n) continue;
        int j = int(ni);
        float nb1 = TRACK_OUT - ni * band;
        float d = max(max(nb1 - band + cut - r, r - (nb1 - cut)), 0.0);
        /* Zero means the fragment is inside that channel, where the fill has
           already been drawn. Light spills out of a groove, not into itself —
           without this every filled channel got its own bloom laid over it at
           full strength, which is most of why the first pass came out white. */
        if (d < 1e-6 || d > band * 1.4) continue;
        float nf = u_frac[j];
        float nOn = nf >= 0.99999 ? 1.0 : smoothstep(nf + fwidth(t01) * 1.5, nf - fwidth(t01) * 1.5, t01);
        col += lume(u_rate[j]) * nOn * exp(-d * 190.0) * (0.03 + 0.12 * u_rate[j])
             * mix(1.0, abs(ni - u_focus) < 0.5 ? 1.7 : 0.22, u_focusMix);
      }
    }
  }

  /* --------------------------------------------------------------------
     The crystal. A reflection is the strongest single cue that there is
     glass over something, and a real one is a window: soft at the edges,
     with hard bars across it.
     -------------------------------------------------------------------- */
  {
    // Parallax against the pointer, so the reflection sits on a different
    // plane from the dial rather than being painted onto it.
    vec2 rp = p - (u_pointer - 0.5) * vec2(0.30, -0.30);
    float u =  rp.x * 0.93 + rp.y * 0.37;
    float v = -rp.x * 0.37 + rp.y * 0.93;
    float win = smoothstep(0.72, 0.10, abs(u + 0.34)) * smoothstep(1.00, 0.15, abs(v - 0.48))
              // Kept off the aperture: a domed crystal throws the reflection
              // of an off-axis window out toward the rim, and the readout is
              // the one place on this dial that has to stay legible.
              * smoothstep(0.30, 0.52, r);
    float bars = 0.60 + 0.40 * smoothstep(0.045, 0.078, abs(fract(u * 2.6 + 0.5) - 0.5));
    col += vec3(0.36, 0.34, 0.46) * win * bars * 0.048;

    // Anti-reflective coating: violet, and only at grazing angles.
    col += vec3(0.16, 0.07, 0.34) * pow(clamp(r / CASE_R, 0.0, 1.0), 9.0) * 0.30;
    // The hairline where the crystal turns down into the bezel.
    col += vec3(0.55, 0.50, 0.72) * exp(-abs(r - CASE_R * 0.982) * 640.0) * 0.24;
  }

  col = aces(col);

  /* The cap, after the tonemap so it constrains what reaches the screen, and
     scaled by luminance rather than clamped per channel — a per-channel clamp
     on a violet turns it grey at the top end. */
  float ap = smoothstep(APER_R, APER_R - 0.010, r);
  if (ap > 0.0) {
    float lm = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col *= mix(1.0, min(1.0, APER_LUM / max(lm, 1e-5)), ap);
  }

  col = toSRGB(col);
  col = dither(col, vUv * u_res);
  // The surface blends ONE, ONE_MINUS_SRC_ALPHA.
  fragColor = vec4(col * alpha, alpha);
}
`)
