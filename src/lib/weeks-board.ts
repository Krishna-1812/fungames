/**
 * Life in Weeks' board.
 *
 * 4,680 small glass lamps set into a dark panel, one for each week of ninety
 * years. A week that has been lived is lit: blue at birth, mint by ninety. A
 * week that has not is the same lamp switched off, and it is still glass, so
 * the light over the board (which follows the pointer) catches its bevel.
 * Lit weeks spill a little onto the panel and onto their unlit neighbours,
 * which is what makes the edge of a life look like an edge and not a colour
 * change.
 *
 * The board lies whichever way the screen does: years across and weeks down
 * on a wide screen, weeks across and years down on a phone. Either way it is
 * the whole of ninety years in one look, which is what the page claims.
 *
 * Everything a lamp is comes from its index, so there is no texture. The page
 * hands over how many are lit so far (it counts up from zero when a date is
 * given), which one is now, which one is under the pointer, and a short list
 * of the ones the world did something in.
 *
 * `BOARD_MARGIN` is the rim of bare panel round the lamps, in lamps. The page
 * needs the same number to turn a pointer position into a week.
 */
import { glsl } from './gl'

export const BOARD_MARGIN = 1
export const BOARD_PINS = 48

export function weeksBoardFrag(years: number, weeks: number) {
  return glsl(`
#define YEARS ${years}.0
#define WEEKS ${weeks}.0
#define M ${BOARD_MARGIN}.0
#define PINS ${BOARD_PINS}

uniform float u_lit;    // lamps lit so far, counting up to the weeks lived
uniform float u_now;    // the week being lived, or -1
uniform float u_hover;  // the week being looked at, or -1
uniform float u_tall;   // 1: weeks across, years down. 0: years across, weeks down.
uniform float u_head;   // 0..1: how hot the front of the count is
uniform vec2  u_light;  // where the light hangs over the board, 0..1, y down
uniform float u_pins[PINS];

vec2 yearWeek(vec2 id) { return u_tall > 0.5 ? id.yx : id.xy; }
vec2 place(vec2 yw) { return u_tall > 0.5 ? yw.yx : yw.xy; }
float litOf(float idx) { return clamp(u_lit - idx, 0.0, 1.0); }

vec3 lifeColour(float age) {
  vec3 young = toLinear(vec3(0.33, 0.45, 0.84));
  vec3 old   = toLinear(vec3(0.31, 0.89, 0.76));
  return mix(young, old, pow(age, 0.85));
}

void main() {
  vec2 n = u_tall > 0.5 ? vec2(WEEKS, YEARS) : vec2(YEARS, WEEKS);
  vec2 fragPx = vec2(vUv.x, 1.0 - vUv.y) * u_res; // y down, like the page
  vec2 cellPx = u_res / (n + 2.0 * M);
  float px = min(cellPx.x, cellPx.y);
  vec2 g = fragPx / cellPx - M;
  vec2 id = floor(g);
  float inside = step(0.0, id.x) * step(0.0, id.y) * step(id.x, n.x - 1.0) * step(id.y, n.y - 1.0);
  vec2 yw = yearWeek(id);
  float idx = yw.x * WEEKS + yw.y;
  float big = max(u_res.x, u_res.y);

  // The light: one soft lamp hanging over the board.
  vec3 toLamp = vec3(u_light * u_res, big * 0.36) - vec3(fragPx, 0.0);
  float lampD = length(toLamp);
  vec3 l = toLamp / lampD;
  float fall = 0.16 + 0.84 / (1.0 + pow(lampD / (big * 0.5), 2.0) * 2.0);
  vec3 hv = normalize(l + vec3(0.0, 0.0, 1.0));

  // The panel: dark anodised metal, brushed along its length.
  float brush = hash21(vec2(floor(fragPx.y / u_dpr), 7.0)) - 0.5;
  float fine = hash21(floor(fragPx / u_dpr)) - 0.5;
  vec3 panel = toLinear(vec3(0.060, 0.068, 0.108)) * (0.42 + 1.5 * fall * l.z);
  panel *= 1.0 + brush * 0.10 + fine * 0.08;

  // A hairline between decades, so ninety years can be counted in tens.
  float gy = u_tall > 0.5 ? g.y : g.x;
  float dec = floor(gy / 10.0 + 0.5) * 10.0;
  float seam = (1.0 - smoothstep(0.0, 0.8 * u_dpr, abs(gy - dec) * px)) * step(5.0, dec) * step(dec, YEARS - 5.0);
  float across = u_tall > 0.5 ? g.x : g.y;
  seam *= step(-0.5, across) * step(across, WEEKS + 0.5);
  panel += toLinear(vec3(0.42, 0.50, 0.72)) * seam * (0.10 + 0.35 * fall);

  // One lamp: a rounded square of glass with a bevelled edge.
  vec2 p = (g - id - 0.5) * cellPx;
  float gap = px * 0.15 + 0.5 * u_dpr;
  vec2 half_ = cellPx * 0.5 - gap * 0.5;
  float r = min(half_.x, half_.y) * 0.3;
  vec2 q = abs(p) - (half_ - r);
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  vec2 grad = q.x > 0.0 && q.y > 0.0 ? normalize(q) : (q.x > q.y ? vec2(1.0, 0.0) : vec2(0.0, 1.0));
  grad *= sign(p);
  float cover = clamp(0.5 - d / u_dpr, 0.0, 1.0) * inside;
  float bw = max(u_dpr, px * 0.22);
  float t = clamp(-d / bw, 0.0, 1.0); // 0 at the edge, 1 on the flat
  vec3 N = normalize(vec3(grad * (1.0 - t) * 0.95 + (p / half_) * 0.16, 1.0));
  float diff = max(dot(N, l), 0.0);
  float spec = pow(max(dot(N, hv), 0.0), 42.0) * fall;

  float jit = hash21(id + 3.0);
  float age = yw.x / (YEARS - 1.0);
  vec3 lc = lifeColour(age);
  float on = litOf(idx) * inside;

  // Off: dark glass, visible only by what it reflects.
  vec3 glass = toLinear(vec3(0.112, 0.132, 0.212)) * (0.62 + 1.05 * diff * fall) * (0.86 + 0.28 * jit);
  glass += vec3(0.55, 0.66, 0.95) * spec * 0.62;

  // On: lit from behind, brightest in the middle, a little uneven lamp to lamp.
  vec2 pn = p / half_;
  float core = exp(-dot(pn, pn) * 0.6);
  vec3 lamp = lc * (0.50 + 0.66 * core) * (0.88 + 0.24 * jit) * mix(0.66, 1.0, t);
  lamp += vec3(1.0) * spec * 0.22;

  // The front of the count runs white-hot for a moment.
  float behind = u_lit - idx;
  float flash = u_head * exp(-max(behind, 0.0) / 30.0) * step(0.0, behind);
  lamp = mix(lamp, vec3(1.0), flash * 0.85);

  vec3 tile = mix(glass, lamp, on);

  // What the lit lamps throw on everything near them.
  vec3 bloom = vec3(0.0);
  for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) {
    vec2 nid = id + vec2(float(i), float(j));
    if (nid.x < 0.0 || nid.y < 0.0 || nid.x >= n.x || nid.y >= n.y) continue;
    vec2 nyw = yearWeek(nid);
    vec2 dv = g - (nid + 0.5);
    bloom += lifeColour(nyw.x / (YEARS - 1.0)) * litOf(nyw.x * WEEKS + nyw.y) * exp(-dot(dv, dv) / 1.3);
  }
  bloom /= 4.08;
  panel += bloom * 0.30;
  tile += bloom * mix(0.20, 0.04, on);

  // This week: the one lamp that is still being lived, and it breathes.
  float nowOn = step(0.0, u_now) * clamp(u_lit - u_now + 1.0, 0.0, 1.0);
  float pulse = 0.72 + 0.28 * sin(u_time * 2.3);
  vec3 lilac = toLinear(vec3(0.72, 0.63, 1.0));
  vec2 nowId = place(vec2(floor((u_now + 0.01) / WEEKS), mod(u_now, WEEKS)));
  float nowDist = length((g - (nowId + 0.5)) * cellPx) / px;
  float halo = exp(-nowDist / 1.9) * pulse * nowOn;
  panel += lilac * halo * 0.55;
  tile += lilac * halo * 0.22;
  float isNow = (1.0 - step(0.5, abs(idx - u_now))) * nowOn * inside;
  tile = mix(tile, lilac * (0.80 + 0.62 * pulse) * (0.7 + 0.4 * core) + vec3(1.0) * spec * 0.3, isNow);

  // A week the world did something in: a pinhole, dark on a lit lamp, pale on an unlit one.
  float pinned = 0.0;
  for (int k = 0; k < PINS; k++) pinned = max(pinned, 1.0 - step(0.5, abs(u_pins[k] - idx)));
  float rdot = max(1.1 * u_dpr, px * 0.17);
  float dotm = (1.0 - smoothstep(rdot - 0.6 * u_dpr, rdot + 0.6 * u_dpr, length(p))) * pinned;
  tile = mix(tile, mix(vec3(0.50, 0.60, 0.86), toLinear(vec3(0.04, 0.07, 0.13)), max(on, isNow)), dotm);

  // The week being looked at: a white edge.
  float hov = (1.0 - step(0.5, abs(idx - u_hover))) * step(0.0, u_hover) * inside;
  tile = mix(tile, tile * 1.25 + 0.05, hov);
  float ring = (1.0 - smoothstep(0.6 * u_dpr, 1.5 * u_dpr, abs(d))) * hov;

  vec3 col = mix(panel, tile, cover);
  col = mix(col, vec3(1.0), ring * 0.92);

  // The panel falls away at its own edges.
  vec2 e = min(vUv, 1.0 - vUv) * u_res / (px * 1.4);
  col *= 0.80 + 0.20 * smoothstep(0.0, 1.0, min(e.x, e.y));

  col = clamp(col, 0.0, 1.0);
  col = toSRGB(col);
  col = dither(col, fragPx);
  fragColor = vec4(col, 1.0);
}
`)
}
