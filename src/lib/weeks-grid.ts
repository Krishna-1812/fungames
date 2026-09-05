/**
 * Life in Weeks' grid.
 *
 * The page's whole idea is 4,680 identical squares, one per week of a
 * ninety-year life. The DOM version drew that literally: 4,680 <i> elements,
 * each flipped between three flat CSS colours by a class name. It works, but
 * every week ever lived or left to live renders as the exact same rectangle,
 * and the one week that actually matters — the one being lived right now —
 * got a 2px box-shadow to try to say so.
 *
 * This is the same grid as one shader pass instead of 4,680 nodes. A week's
 * state is entirely a function of its index and how many weeks are lived,
 * both cheap arithmetic from the fragment's own grid position — so nothing
 * here needs a lookup table or a data texture. One uniform, `u_lived`, carries
 * the single number that changes.
 *
 * Three things this adds that a flat fill could not:
 *
 *  - Lived weeks warm gradually, from a cool blue at birth to an amber near
 *    the current week, keyed to age rather than to the week itself — so
 *    ninety rows read as one gradient instead of ninety repaints of a colour.
 *  - The current week breathes: a slow pulse whose glow bleeds past its own
 *    cell into the void around it, rather than stopping at a hard edge. It is
 *    the one cell on the page that is still alive, and the only thing that
 *    moves.
 *  - Unlived weeks carry a scattering of faint points, dim enough to read as
 *    grain rather than pattern — the same distinction Deep Time and Scale
 *    draw between "empty" and "not yet resolved".
 *
 * The DOM grid stays underneath, hidden rather than removed: its layout is
 * what gives this canvas its size (52 columns of aspect-ratio squares decide
 * the container's height), and it is what a visitor without WebGL2 sees.
 */
import { glsl } from './gl'

export function weeksGridFrag(years: number, weeks: number) {
  return glsl(`
#define YEARS ${years}.0
#define WEEKS ${weeks}.0

uniform float u_lived;

float roundedBox(vec2 p, vec2 half_, float r) {
  vec2 q = abs(p) - (half_ - r);
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void main() {
  // Continuous grid-space position; (0,0) is the top-left week (birth),
  // matching the DOM version's row-major, oldest-first order.
  vec2 gridPos = vec2(vUv.x * WEEKS, (1.0 - vUv.y) * YEARS);
  vec2 cellId = clamp(floor(gridPos), vec2(0.0), vec2(WEEKS - 1.0, YEARS - 1.0));
  vec2 cellUV = gridPos - cellId;
  float idx = cellId.y * WEEKS + cellId.x;

  // A rounded square sized in real pixels, so the corner radius and gap read
  // the same at any container size rather than stretching with the grid.
  vec2 cellPx = u_res / vec2(WEEKS, YEARS);
  vec2 p = (cellUV - 0.5) * cellPx;
  float gap = min(cellPx.x, cellPx.y) * 0.16 + 0.5;
  vec2 half_ = cellPx * 0.5 - gap * 0.5;
  float r = min(half_.x, half_.y) * 0.32;
  float d = roundedBox(p, half_, r);
  float aa = fwidth(d) + 0.6;
  float cover = 1.0 - smoothstep(-aa, aa, d);

  float isLived = step(idx, u_lived - 0.5);
  float isNow = 1.0 - step(0.5, abs(idx - u_lived));

  /* No ACES past this point — deliberately, for the same reason memo-paper.ts
     has none. The tonemapper exists to stop bright HDR cores clipping; fed
     the flat 0.3-0.9 range a "blue at birth, amber near now" gradient
     actually lives in, it compresses the whole span toward the same pale
     grey and the gradient simply disappears. Authored in sRGB via toLinear,
     clamped once at the end instead. */

  // Unlived: a quiet field with a rare, faint point of light — the same
  // "not yet resolved" grain Scale and Deep Time use for the unknown.
  float grain = hash21(cellId + 3.0) * 0.14 - 0.07;
  float star = step(0.986, hash21(cellId + 41.0)) * (0.35 + 0.65 * hash21(cellId + 71.0));
  vec3 future = toLinear(vec3(0.129, 0.153, 0.239)) * (1.0 + grain);
  future += toLinear(vec3(0.55, 0.62, 0.85)) * star * 0.6;

  // Lived: one gradient from a cool birth-blue to a lived-in amber, keyed to
  // age (the row) rather than the individual week.
  float age = cellId.y / (YEARS - 1.0);
  vec3 young = toLinear(vec3(0.40, 0.53, 0.74));
  vec3 old   = toLinear(vec3(0.910, 0.663, 0.310));
  vec3 lived = mix(young, old, pow(age, 0.85)) * (1.0 + grain * 0.6);

  vec3 cellCol = mix(future, lived, isLived);

  // Background: the void the grid sits in, with a soft seam at each decade
  // (matching the row labels beside the grid) and the current week's pulse
  // bleeding out past its own edges.
  vec3 bg = toLinear(vec3(0.063, 0.075, 0.125));

  float toDecade = mod(gridPos.y, 10.0);
  toDecade = min(toDecade, 10.0 - toDecade);
  float lineAA = fwidth(gridPos.y) * 1.5 + 0.03;
  bg += (1.0 - smoothstep(0.0, lineAA, toDecade)) * 0.05;

  vec2 nowCell = vec2(mod(u_lived, WEEKS), floor((u_lived + 0.01) / WEEKS));
  vec2 deltaPx = (gridPos - (nowCell + 0.5)) * cellPx;
  float pulse = 0.7 + 0.3 * sin(u_time * 2.35);
  float glow = exp(-length(deltaPx) / (min(cellPx.x, cellPx.y) * 1.7)) * pulse;
  bg += toLinear(vec3(1.0, 0.74, 0.35)) * glow * 0.6;

  vec3 nowCol = toLinear(vec3(1.0, 0.82, 0.40)) * (0.85 + 0.55 * pulse);
  cellCol = mix(cellCol, nowCol, isNow);

  vec3 col = mix(bg, cellCol, cover);
  col = clamp(col, 0.0, 1.0);
  col = toSRGB(col);
  col = dither(col, vUv * u_res);
  fragColor = vec4(col, 1.0);
}
`)
}
