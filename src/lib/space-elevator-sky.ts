/**
 * Space Elevator's sky.
 *
 * What is outside the car's window at the altitude on the gauge, worked from
 * the two things that actually change on the way up:
 *
 *  - The air thins. Its density halves about every five and a half
 *    kilometres, and the blue of the sky is sunlight scattered by air, so
 *    the sky overhead goes from blue to indigo to black at the rate the air
 *    goes. Along the horizon you are looking through far more of it, which
 *    is why the last of the blue is a thin bright line on the edge of the
 *    Earth. Stars come out as the sky stops outshining them.
 *  - The horizon drops and bends. From a height h it lies below eye level by
 *    the angle whose cosine is R / (R + h): a third of a degree at the top
 *    of a tower, three degrees from an airliner, ten at the Karman line. It
 *    is drawn at that angle, so the curve of the Earth arrives when it
 *    really does and no sooner.
 *
 * On the way there are two decks of cloud to go through, at about 2 km and
 * about 9 km: under them they are overhead, in them the window is white,
 * above them they are a floor.
 *
 * The CSS gradient underneath stays for anything without WebGL2.
 */
import { glsl } from './gl'

export const EARTH_RADIUS_M = 6_371_000
export const SCALE_HEIGHT_M = 8_000

export const SPACE_ELEVATOR_SKY_FRAG = glsl(`
uniform float u_alt; // metres above the sea

const float R = ${EARTH_RADIUS_M}.0;
const float H = ${SCALE_HEIGHT_M}.0;
const float FOV = 1.05;      // radians, top of the window to the foot of it
const float EYE = 0.44;      // where level is, up the window

// Cloud cover on a deck, at a place on it (metres).
float deck(vec2 at, float cell, float cover) {
  float n = fbm(at / cell + fbm(at / (cell * 3.1) + 9.0, 2) * 1.7, 4);
  return smoothstep(cover, cover + 0.22, n);
}

void main() {
  vec2 uv = vUv;
  float aspect = u_res.x / u_res.y;
  float t = u_time;
  float h = max(u_alt, 2.0);

  // The ray through this pixel: how far above level it looks, and how far round.
  float az = (uv.x - 0.5) * FOV * aspect;
  float el = (uv.y - EYE) * FOV;
  // The horizon, where it really is from this height. Level rays meet it later the further round they look.
  float dip = acos(R / (R + h));
  float horizon = -dip * (1.0 + 0.9 * (1.0 / max(cos(az * 0.9), 0.3) - 1.0));
  float above = el - horizon;                       // radians above the horizon

  float air = exp(-h / H);                          // how much air is left at this height, 1 at the sea
  vec3 sunDir = normalize(vec3(sin(0.55), sin(0.42), cos(0.55)));
  vec3 ray = normalize(vec3(sin(az) * cos(el), sin(el), cos(az) * cos(el)));
  float toSun = max(dot(ray, sunDir), 0.0);

  /* ---- the sky ---- */
  // How much air this ray looks through, in units of the air straight up from the sea.
  float path = air / (max(sin(max(above, 0.0)), 0.0) + 0.045 + 0.035 * air);
  float scatter = 1.0 - exp(-path * 0.36);
  vec3 blue = mix(vec3(0.10, 0.30, 0.82), vec3(0.50, 0.72, 0.98), smoothstep(1.5, 9.0, path));
  // Low down, a long path whitens: haze. High up there is none to speak of.
  blue = mix(blue, vec3(0.86, 0.91, 0.97), smoothstep(8.0, 22.0, path) * air);
  vec3 sky = blue * scatter;
  // Round the Sun the air glows; with no air there is only the disc.
  sky += vec3(1.0, 0.93, 0.80) * pow(toSun, 9.0) * 0.30 * scatter;
  sky += vec3(1.0, 0.97, 0.90) * (smoothstep(0.99955, 0.99985, toSun) * 6.0 + pow(toSun, 900.0) * (0.22 + 0.98 * air));

  // Stars, as far as the sky lets them through.
  // And as far as an eye used to daylight would see them: not until well above the weather.
  float dark = pow(1.0 - min(scatter * 1.25, 1.0), 6.0) * smoothstep(20000.0, 42000.0, h);
  if (dark > 0.002) {
    vec2 sg = vec2(az, el) * 46.0;
    vec2 id = floor(sg);
    float sh = hash21(id);
    vec2 sc = 0.2 + 0.6 * vec2(hash21(id + 3.3), hash21(id + 7.7));
    float star = smoothstep(0.09, 0.0, length(fract(sg) - sc)) * step(0.80, sh) * (0.35 + 0.65 * hash21(id + 5.1));
    star *= 0.82 + 0.18 * sin(t * (1.0 + sh * 3.0) + sh * 40.0) * air * 8.0;   // they only twinkle through air
    sky += vec3(0.86, 0.90, 1.0) * star * dark * 1.4;
  }

  vec3 col = sky;

  /* ---- the Earth ---- */
  if (above < 0.0) {
    float down = -el;                                              // radians below level
    // Where the ray lands. Flat enough near by; the horizon is its limit.
    float reach = min(h / max(tan(down), 1e-4), sqrt(2.0 * R * h + h * h) * 0.985);
    vec2 at = vec2(sin(az), cos(az)) * reach + vec2(0.0, 4.0e5);
    float coast = fbm(at / 260000.0 + 3.0, 4);
    float land = smoothstep(0.50, 0.53, coast);
    float rough = fbm(at / 24000.0, 4);
    float fine = fbm(at / 2600.0, 3);
    float near = exp(-reach / 30000.0);                            // detail only shows near by
    vec3 ground = mix(vec3(0.16, 0.30, 0.13), vec3(0.42, 0.37, 0.24), smoothstep(0.42, 0.66, rough));
    ground = mix(ground, vec3(0.30, 0.34, 0.22), (fine - 0.5) * 1.2 * near + 0.0);
    ground = mix(ground, vec3(0.88, 0.90, 0.93), smoothstep(0.66, 0.78, rough) * smoothstep(0.55, 0.7, coast)); // snow on high ground
    vec3 sea = mix(vec3(0.03, 0.14, 0.30), vec3(0.05, 0.25, 0.42), smoothstep(0.38, 0.5, coast));
    // The Sun on the water, toward it.
    sea += vec3(1.0, 0.95, 0.85) * pow(max(dot(normalize(vec3(sin(az), 0.35, cos(az))), sunDir), 0.0), 60.0) * 0.5;
    vec3 earth = mix(sea, ground, land) * 0.85;

    // Air between here and there: it blues and pales with distance, and from above it is a veil over everything.
    // Low down that is the air along the ground; from high up it is the whole atmosphere, looked through at a slant.
    float along = 1.0 - exp(-reach / 70000.0);
    float through = 1.0 - exp(-0.13 / max(sin(down), 0.035));
    float hazed = mix(through, along, air);
    earth = mix(earth, mix(vec3(0.34, 0.56, 0.92), vec3(0.62, 0.78, 0.95), air), clamp(hazed * 0.9, 0.0, 0.92));
    // The limb: the last of the atmosphere, edge on.
    earth += vec3(0.35, 0.62, 1.0) * exp(above / 0.012) * (1.0 - air) * 0.9;
    col = earth;
  } else {
    // The same thin line from the sky side, once you are above most of the air.
    col += vec3(0.30, 0.58, 1.0) * exp(-above / 0.010) * (1.0 - air) * 0.75;
  }

  /* ---- cloud ---- */
  for (int k = 0; k < 2; k++) {
    float hc = k == 0 ? 2100.0 : 9200.0;
    float cell = k == 0 ? 2600.0 : 9000.0;
    float cover = k == 0 ? 0.50 : 0.60;
    float thick = k == 0 ? 1.0 : 0.45;
    float gap = hc - h;                                            // above us if positive
    float slope = sin(el);
    // Only rays going toward the deck meet it.
    if (gap * slope > 0.0 && (gap < 0.0 ? above < 0.0 || true : true)) {
      float dist = gap / slope / max(cos(el), 0.2);
      float limit = sqrt(2.0 * R * max(h, hc)) * 1.2;
      if (dist > 0.0 && dist < limit) {
        vec2 at = vec2(sin(az), cos(az)) * dist + vec2(t * 6.0, t * 2.0 + 1.0e5 * float(k));
        // Weather comes in systems hundreds of kilometres across: whole regions are clear and whole regions are not.
        float c = deck(at, cell, cover) * thick * mix(1.0, smoothstep(0.40, 0.62, fbm(at / 210000.0 + 5.0 * float(k), 3)), smoothstep(4000.0, 20000.0, h));
        // Lit from the Sun's side, grey underneath, lost in haze far off.
        float lit = gap > 0.0 ? 0.62 + 0.25 * fbm(at / (cell * 0.5), 2) : 0.92 + 0.12 * fbm(at / (cell * 0.4), 2);
        float far = exp(-dist / (gap > 0.0 ? 60000.0 : 240000.0));
        vec3 cc = mix(vec3(0.72, 0.80, 0.92), vec3(1.0), lit) * (gap > 0.0 ? 0.92 : 1.0);
        if (gap < 0.0 && above > 0.0) c = 0.0;                     // a deck below is never seen above the horizon
        col = mix(col, cc, c * far * smoothstep(0.0, 400.0, abs(gap)));
      }
    }
    // Inside it, the window is white.
    float inside = exp(-pow(gap / 260.0, 2.0)) * thick;
    col = mix(col, vec3(0.90, 0.93, 0.96), inside * 0.94);
  }

  col = aces(col * 1.05);
  col = toSRGB(col);
  col = dither(col, uv * u_res);
  fragColor = vec4(col, 1.0);
}
`)
