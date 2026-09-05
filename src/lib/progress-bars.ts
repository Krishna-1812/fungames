/**
 * Progress's meters.
 *
 * The page shows thirteen units draining at once, and the spread between the
 * fastest and the slowest is about fifteen orders of magnitude: this minute
 * empties in sixty seconds, the Sun's takes ten billion years. The page drew
 * all thirteen with the same violet gradient, so the one fact that makes the
 * list worth reading — that these things are not remotely alike — was the one
 * fact the picture threw away. A screenshot of it is thirteen identical bars.
 *
 * Every fill here is made of moving material, and it moves at that row's real
 * rate. The minute streams. The year creeps. The Sun's does not move at all,
 * because it does not: it will read 46% for the rest of your life. Rate is
 * carried in colour as well as in motion — hot and liquid at the top of the
 * list, cold and mineral at the bottom — so the difference survives a still
 * screenshot and survives prefers-reduced-motion.
 *
 * One surface draws all thirteen. Browsers cap live WebGL contexts at around
 * a dozen, so a canvas per row would have been over budget on its own.
 */
import { glsl } from './gl'

/** Rows the shader has room for. Thirteen today, with slack. */
export const MAX_ROWS = 16

/**
 * A row's real rate, in fraction-of-itself per second, mapped to 0..1.
 *
 * The raw rates span 1.7e-2 (a minute) to 3.2e-11 (a millennium), which is
 * unusable directly: linear, everything below "today" is stopped; and a plain
 * reciprocal makes the minute a strobe. Log10 over that range spreads them out
 * with the ordering intact, and the 1.5 power in the shader stretches the fast
 * end back out again so the top of the list still looks alive.
 *
 * A rate of zero — the Sun, whose figures are fixed — stays exactly zero. That
 * is the point of it.
 */
export function rateOf(seconds: number) {
  if (!(seconds > 0) || !isFinite(seconds)) return 0
  const decades = Math.log10(1 / seconds)
  return Math.min(1, Math.max(0, (decades + 11) / 9.3))
}

export const BARS_FRAG = glsl(`
uniform float u_n;            // rows actually in use
uniform float u_y[${MAX_ROWS}];    // track centre, 0 at the bottom of the canvas
uniform float u_frac[${MAX_ROWS}]; // 0..1 filled
uniform float u_rate[${MAX_ROWS}]; // 0..1 visual speed, from rateOf()
uniform float u_x0;           // track left edge, canvas-normalised
uniform float u_x1;           // track right edge
/* The track's half-height, given twice: once against the canvas width and once
   against its height. The canvas is roughly 460 x 1110, so a step of 0.01 in
   uv.x and a step of 0.01 in uv.y are nothing like the same distance, and
   mixing the two axes without this is how a bar ends up with oval corners. */
uniform float u_thX;
uniform float u_thY;
uniform float u_motion;       // 0 under prefers-reduced-motion

/**
 * Rounded box, signed. Radius is capped at half the length so a nearly empty
 * bar is a lozenge rather than a circle that overhangs its own start.
 */
float roundedBox(vec2 p, float len) {
  float r = min(1.0, len * 0.5);
  vec2 b = vec2(max(len * 0.5 - r, 0.0), 1.0 - r);
  vec2 q = abs(p - vec2(len * 0.5, 0.0)) - b;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void main() {
  vec2 uv = vUv;
  vec3 col = vec3(0.0);
  float cov = 0.0;

  // Everything below works in half-heights of the track, which makes the
  // corner radius exactly 1 and every distance readable as "bar thicknesses".
  float aspect = (u_x1 - u_x0) / u_thX;
  float px = (uv.x - u_x0) / u_thX;

  for (int i = 0; i < ${MAX_ROWS}; i++) {
    if (float(i) >= u_n) break;

    float py = (uv.y - u_y[i]) / u_thY;
    /* Rows sit about twenty bar-heights apart, and the bloom below has fallen
       under one 8-bit step by five. Rejecting here is what keeps a canvas this
       tall cheap: almost all of it is the gap between rows. */
    if (abs(py) > 5.0) continue;

    float fi = float(i);
    float sp = u_rate[i];
    float len = max(u_frac[i], 0.0) * aspect;
    vec2 p = vec2(px, py);

    float d = roundedBox(p, len);
    float aa = max(fwidth(d), 1e-4);
    float body = smoothstep(aa, -aa, d);
    if (d > 4.5) continue;

    /* Flow. Speed is the row's real rate, stretched at the fast end: at 1.0 a
       streak crosses the bar in about four seconds, and the millennium's takes
       three minutes. Slow is not the same as stopped, and it should not look
       like it. */
    float v = pow(sp, 1.5);
    float sx = p.x * 0.55 - u_time * u_motion * v * 11.0 + fi * 13.0;

    // Two materials. Liquid at the top of the list, rock at the bottom, mixed
    // by the row's own rate.
    float liquid = fbm(vec2(sx * 0.62, p.y * 1.1 + fi * 5.0), 2);
    float bedding = 0.42 + 0.34 * sin(p.x * 1.7 + fbm(vec2(p.x * 0.26 + fi * 3.1, p.y * 0.5), 2) * 7.0);
    float tex = mix(bedding, liquid, smoothstep(0.14, 0.72, sp));

    /* Value, not just hue. An earlier pass separated these two only by colour
       and it did not survive the pipeline: ACES compresses the top end and the
       sRGB curve lifts the bottom, so a violet and a pink of similar intensity
       both land near rgb(200,170,215) and thirteen bars look identical again.
       Stone is genuinely dark. Live is genuinely hot. */
    vec3 stone = vec3(0.23, 0.13, 0.50);
    vec3 live  = vec3(1.05, 0.40, 1.05);
    vec3 base = mix(stone, live, sp * sp * (3.0 - 2.0 * sp));
    // The gradient the CSS had, kept: violet at the start, pink at the head.
    base = mix(base * 0.86, base, clamp(p.x / max(len, 1e-3), 0.0, 1.0));

    vec3 c = base * (0.72 + 0.52 * tex);

    /* The head of the fill. This is the only part of a progress bar anyone
       actually watches, so it gets a hot cap and a bloom that spills past the
       body — including past the track, which is why the canvas is wider than
       the groove. */
    float head = exp(-abs(p.x - len) * 1.5) * step(0.02, len);
    // Near nothing at the slow end: a bar that is not advancing has no wave in
    // front of it, and the Sun has not moved since the page was written.
    c += mix(vec3(0.70, 0.45, 1.00), vec3(1.00, 0.72, 0.95), sp) * head * (0.10 + 1.25 * sp);

    col += c * body;
    cov = max(cov, body);

    // Light thrown past the edge of the fill. Gated on the bar being non-empty
    // so a row at 0% is not a glowing dot sitting in an empty groove.
    float lit = step(0.02, len);
    float bloom = exp(-max(d, 0.0) * 1.3) * (1.0 - body) * lit;
    vec3 glow = mix(vec3(0.40, 0.24, 0.72), vec3(0.92, 0.50, 0.98), sp);
    col += glow * bloom * (0.10 + 0.26 * sp);
    cov = max(cov, bloom * (0.20 + 0.40 * sp));
  }

  /* col accumulated premultiplied — every term was scaled by its own coverage.
     It has to be divided back out before the transfer curve, because
     toSRGB(c * a) is not toSRGB(c) * a: skipping this is the reason so many
     glows have a bright rim one pixel wide along every antialiased edge. */
  float a = clamp(cov, 0.0, 1.0);
  vec3 c = a > 1e-4 ? col / a : vec3(0.0);
  c = aces(c);
  c = toSRGB(c);
  c = dither(c, uv * u_res);
  // Premultiplied again: the surface blends ONE, ONE_MINUS_SRC_ALPHA.
  fragColor = vec4(c * a, a);
}
`)
