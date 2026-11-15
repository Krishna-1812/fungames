/**
 * Deep Time's Earth.
 *
 * The page is an honest scale and a list of sentences, and for a long time the
 * only thing behind them was a coloured sky. But every one of those sentences
 * is about one object, and that object can be shown: the planet itself, from
 * outside, at the year the scroll is on.
 *
 * So this is one globe, drawn live, that is whatever the Earth was then:
 *
 *   4.54 Ga   a ball of magma in its own disc of rubble
 *   4.51      something the size of Mars arrives; the ring it leaves becomes
 *             the Moon, which starts close and backs away for the rest of time
 *   4.4       the crust sets and the steam rains out into an ocean
 *   4.1       still being hit
 *   3.7–2.4   methane haze, orange, over an iron-green sea and bare black rock
 *   2.4       oxygen: the haze clears, the land rusts, and the planet freezes
 *   0.72      and again, to the equator, twice
 *   0.47      a green edge on the continents, then forests
 *   0.25      one continent, and the Siberian Traps open on it
 *   0.066     the asteroid, and the dark after it
 *   0.034     ice on Antarctica; from 2.6 Ma ice on the north too, breathing
 *             in and out every hundred thousand years
 *   150 yr    lights on the night side
 *
 * What is measured and what is an impression: the coastline of the last few
 * million years is the real one (Natural Earth's, through `u_land`); the ice
 * sheets advance and retreat on their real rhythm; the Moon really was closer
 * and the Sun really was three-tenths dimmer. The continents before about two
 * hundred million years ago are invented — nobody has a map — and only their
 * amount and their habit of gathering into one and breaking up are true.
 */

/** The shader's body. The page hands it to `glsl()`, which puts the shared
 *  noise library in front of it; kept bare here so that a check can read this
 *  module without a browser. */
export const EARTH_FRAG = `
uniform float u_years;      // before present
uniform float u_spin;       // how far the globe has turned, radians
uniform vec3  u_globe;      // centre x, centre y (from the bottom), radius — as fractions of the height, x in the same unit
uniform vec2  u_moon;       // where the Moon sits, in globe radii from the centre
uniform vec2  u_hit;        // seconds since the last impact was set off, and which (1 Theia, 2 Chicxulub)
uniform vec4  u_pin;        // where the event on the line happened: a direction on the globe, and how strongly to mark it
uniform float u_moonPin;    // the same, for the one that happened on the Moon
uniform sampler2D u_land;

const vec3 SUN = normalize(vec3(-0.64, 0.36, 0.56));

mat2 rot2(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float bump(float x, float c, float w) { float k = (x - c) / w; return exp(-k * k); }
float sat(float x) { return clamp(x, 0.0, 1.0); }

/* ---- stars, and what else is out there --------------------------------- */

vec3 space(vec2 px, float Ga) {
  vec3 c = vec3(0.004, 0.005, 0.011);
  // the Milky Way, which was there the whole time
  vec2 g0 = px / (u_res.y);
  float across = (g0.y - 0.62) * 0.94 + (g0.x - 0.5) * 0.34;
  float mw = exp(-across * across * 9.0);
  c += vec3(0.020, 0.023, 0.036) * mw * (0.25 + fbm(g0 * 2.6 + 2.0, 3) * 1.2);
  for (int k = 0; k < 2; k++) {
    float size = k == 0 ? 46.0 : 17.0;
    vec2 g = px / (size * u_dpr), id = floor(g), f = fract(g) - 0.5;
    vec2 o = hash22(id + float(k) * 91.0) - 0.5;
    float h = hash21(id * 1.7 + 3.1 + float(k) * 17.0);
    float d = length(f - o * 0.8) * size;
    float mag = pow(h, k == 0 ? 14.0 : 26.0) * (1.0 + mw * 1.5);
    float tw = 0.85 + 0.15 * sin(u_time * (1.0 + h * 3.0) + h * 40.0);
    vec3 tint = mix(vec3(1.0, 0.86, 0.74), vec3(0.74, 0.84, 1.0), hash21(id + 7.7));
    c += tint * mag * tw * (k == 0 ? 3.0 : 2.4) * exp(-d * d * (k == 0 ? 1.1 : 2.6));
  }
  return c;
}

/* ---- where the land is -------------------------------------------------- */

/** Above a half is land. Also hands back how real the map is, 0 to 1. */
float landField(vec3 d, float Ga, float grow, out float real) {
  real = 1.0 - sqrt(sat(Ga / 0.26));
  float N = 0.0;
  if (real < 0.97) {
    // The invented continents slide through their own noise as time passes,
    // which reads as drift; and four times they are pulled to one side of
    // the planet, because supercontinents are a thing the Earth does.
    vec3 q = d * 1.15 + vec3(0.7, -0.45, 0.3) * Ga * 1.6;
    float f = fbm3(q, 5);
    float gather = bump(Ga, 0.27, 0.10) + bump(Ga, 0.95, 0.16) + bump(Ga, 1.65, 0.16) + bump(Ga, 2.6, 0.16);
    vec3 towards = normalize(vec3(sin(Ga * 5.0), 0.25 * cos(Ga * 3.0) - 0.1, cos(Ga * 5.0)));
    f += gather * 0.16 * dot(d, towards);
    float T = mix(0.80, 0.555, grow);
    N = 0.5 + (f - T) * 5.0;
  }
  float S = 0.0;
  if (real > 0.0) {
    vec2 uv = vec2(atan(d.x, d.z) / TAU + 0.5, asin(clamp(d.y, -1.0, 1.0)) / PI + 0.5);
    S = texture(u_land, uv).r;
  }
  return mix(N, S, real);
}

float cloudCover(vec3 d, float amount, float t) {
  d.xz = rot2(t * 0.012) * d.xz;
  // Weather is stretched along the parallels and curled by itself: fronts
  // and their tails, not blobs.
  vec3 curl = vec3(noise3(d * 2.6 + 1.0), noise3(d * 2.6 + 6.0), noise3(d * 2.6 + 11.0)) - 0.5;
  vec3 w = (d + 0.5 * curl) * vec3(3.0, 4.6, 3.0);
  float lat = abs(asin(clamp(d.y, -1.0, 1.0)));
  float cover = amount + 0.08 * cos(lat * 6.0) - 0.10 * bump(lat, 0.42, 0.15);
  float big = fbm3(w, 3);
  float small = fbm3(w * 3.7 + 20.0, 4);
  float c = big * 0.68 + small * 0.32;
  float body = smoothstep(0.60 - cover * 0.40, 0.74 - cover * 0.34, c);
  return body * (0.45 + 0.55 * smoothstep(0.34, 0.62, small));
}

/** One city's worth of light: degrees east, north, and how far it spreads. */
float town(vec2 ll, float lon, float lat, float r) {
  vec2 k = vec2((ll.x - lon) * cos(radians(lat)), ll.y - lat) / r;
  return exp(-dot(k, k));
}

/* ---- the Moon ------------------------------------------------------------ */

vec4 moon(vec2 p, float Ga, float born) {
  // Three or four Earth radii away when it formed, sixty now: it has been
  // leaving ever since, fastest at the start.
  float rm = (0.105 + 0.20 * pow(sat(Ga / 4.5), 5.0)) * born;
  vec2 q = (p - u_moon) / max(rm, 1e-4);
  float r2 = dot(q, q);
  if (r2 > 1.3 || born <= 0.0) return vec4(0.0);
  vec3 n = vec3(q, sqrt(max(1.0 - r2, 0.0)));
  float hot = smoothstep(4.40, 4.50, Ga);
  // the seas: basalt that flooded the big basins between 3.9 and 3.1 Ga
  float mare = smoothstep(0.52, 0.62, fbm3(n * 1.7 + 4.0, 4)) * smoothstep(3.9, 3.2, Ga) * smoothstep(-0.3, 0.3, n.x + n.z * 0.3);
  float crater = fbm3(n * 9.0, 4);
  vec3 alb = mix(vec3(0.34, 0.33, 0.32), vec3(0.50, 0.49, 0.47), crater);
  alb = mix(alb, vec3(0.13, 0.13, 0.14), mare * 0.8);
  float ndl = dot(n, SUN);
  vec3 c = alb * max(ndl, 0.0) * 1.5 + alb * 0.012;
  c = mix(c, c * 0.25, hot);
  c += vec3(2.4, 0.6, 0.10) * pow(ridge3(n * 3.0 + 2.0, 4), 3.2) * hot * 1.6 + vec3(0.05, 0.012, 0.004) * hot;
  if (u_moonPin > 0.0) {
    // Tranquility Base: just north of the equator, on the eastern side
    float dp = length(q - vec2(0.36, 0.06));
    float beat = fract(u_time * 0.6);
    c += vec3(0.6, 0.85, 1.0) * u_moonPin * (smoothstep(0.13, 0.04, dp) * 2.0 + bump(dp, 0.12 + 0.5 * beat, 0.05) * (1.0 - beat) * 1.5);
  }
  float a = smoothstep(1.0, 1.0 - 2.5 / (rm * u_globe.z * u_res.y + 1.0), sqrt(r2));
  return vec4(c * a, a);
}

void main() {
  vec2 px = vUv * u_res;
  float R = u_globe.z * u_res.y;
  vec2 p = (px - vec2(u_globe.x, u_globe.y) * u_res.y) / R;
  float r = length(p);

  float y = u_years;
  float Ga = y * 1e-9, Ma = y * 1e-6;
  float sunI = 1.0 / (1.0 + 0.4 * Ga / 4.57);          // the faint young Sun

  /* -- the eras, each a number between nought and one -- */
  float molten = smoothstep(4.44, 4.50, Ga);
  float steam = bump(Ga, 4.42, 0.035);
  float ocean = smoothstep(4.45, 4.37, Ga);
  float bomb = bump(Ga, 4.02, 0.13);
  float grow = pow(smoothstep(4.40, 2.4, Ga), 0.7);
  float haze = smoothstep(3.95, 3.60, Ga) * smoothstep(2.30, 2.45, Ga);
  float air = smoothstep(2.46, 2.28, Ga);               // oxygen, and a blue sky
  float rust = air;
  float snow = max(bump(Ga, 2.29, 0.05) * 0.85, max(
    smoothstep(0.722, 0.714, Ga) * smoothstep(0.656, 0.664, Ga),
    smoothstep(0.652, 0.648, Ga) * smoothstep(0.633, 0.637, Ga)));
  float plants = smoothstep(480.0, 400.0, Ma);
  float forest = smoothstep(395.0, 345.0, Ma);
  float dying = bump(Ma, 251.5, 3.0);
  float kpg = bump(Ma, 66.0, 1.6);
  // set off by the page as the card crosses the line, so it plays in seconds
  // however fast the scroll went past it
  float hitT = u_hit.x;
  // ...but not if the scroll has since left for another age altogether
  float kind = u_hit.y;
  if (kind == 2.0 && (Ma < 57.0 || Ma > 66.5)) kind = 0.0;
  if (kind == 1.0 && Ga < 4.44) kind = 0.0;
  float theiaHit = kind == 1.0 ? exp(-hitT * 0.9) : 0.0;
  float chicHit = kind == 2.0 ? exp(-hitT * 0.7) : 0.0;
  // ice: the Ordovician and Carboniferous souths, Antarctica from 34 Ma, the
  // north from 2.6 Ma — and from two million years ago, the rhythm of it
  float glacial = y > 21000.0
    ? mix(0.5, 0.5 + 0.5 * cos(TAU * (y - 21000.0) / (y < 1.0e6 ? 1.0e5 : 4.1e4)), smoothstep(2.2e6, 1.9e6, y))
    : smoothstep(8000.0, 19000.0, y);
  float north = smoothstep(3.4, 2.5, Ma) * (0.25 + 0.75 * glacial);
  float south = max(smoothstep(40.0, 30.0, Ma), max(bump(Ma, 445.0, 5.0), smoothstep(345.0, 322.0, Ma) * smoothstep(262.0, 288.0, Ma)));
  float lit = pow(sat(1.0 - y / 145.0), 1.6);            // electric light

  /* -- behind everything -- */
  // nothing behind the planet needs drawing
  vec3 col = r > 0.985 ? space(px, Ga) : vec3(0.0);
  // the disc the planet is still sweeping up
  float disc = smoothstep(4.46, 4.535, Ga);
  if (disc > 0.0) {
    vec2 dq = vec2(p.x * 0.96 + p.y * 0.28, (p.y - p.x * 0.28) * 3.6);
    float dr = length(dq);
    float lanes = 0.55 + 0.45 * fbm(vec2(dr * 7.0, atan(dq.y, dq.x) * 1.5 - u_time * 0.02), 4);
    col += vec3(0.50, 0.24, 0.10) * disc * lanes * exp(-dr * 0.55) * 0.5 * smoothstep(0.9, 1.5, dr + 0.4);
  }

  /* -- the Moon, and what it was made from -- */
  float born = smoothstep(4.507, 4.47, Ga);
  float ring = smoothstep(4.5105, 4.508, Ga) * smoothstep(4.462, 4.50, Ga);
  ring = max(ring, theiaHit * step(Ga, 4.512));
  vec4 mn = moon(p, Ga, born);
  col = col * (1.0 - mn.a) + mn.rgb;
  // the ring is tilted, so half of it passes behind the planet
  vec2 rq = vec2(p.x * 0.94 + p.y * 0.34, (p.y - p.x * 0.34) * 3.1);
  float rr = length(rq);
  float ringI = 0.0;
  if (ring > 0.0) {
    float band = smoothstep(1.12, 1.3, rr) * smoothstep(2.5, 1.7, rr);
    float grain = 0.5 + 0.5 * fbm(vec2(rr * 16.0, atan(rq.y, rq.x) * 3.0 + u_time * 0.05), 4);
    ringI = ring * band * grain;
    if (rq.y > 0.0 || r > 1.0) col += vec3(1.9, 0.62, 0.16) * ringI * 0.6;
  }

  /* -- Theia, on its way in -- */
  float coming = smoothstep(4.54, 4.5105, Ga) * step(4.5105, Ga);
  if (coming > 0.0) {
    float e = pow(coming, 1.4);
    vec2 tc = mix(vec2(2.55, 1.62), vec2(1.02, 0.80), e);
    vec2 q = (p - tc) / 0.53;
    float q2 = dot(q, q);
    if (q2 < 1.0) {
      vec3 n = vec3(q, sqrt(1.0 - q2));
      float cr = ridge3(n * 2.4 + 3.0, 4);
      vec3 c = mix(vec3(0.06, 0.035, 0.03), vec3(0.13, 0.08, 0.06), fbm3(n * 5.0, 3)) * (0.05 + max(dot(n, SUN), 0.0) * 1.4);
      c += vec3(2.4, 0.7, 0.12) * pow(cr, 3.0) * 1.6;
      // the side facing us heats as it closes
      c += vec3(1.5, 0.5, 0.15) * e * e * sat(dot(n, normalize(vec3(-tc, 0.6)))) * 1.2;
      float a = smoothstep(1.0, 0.985, sqrt(q2));
      col = mix(col, c, a);
    }
  }

  /* -- the air past the limb -- */
  vec3 airCol = mix(vec3(0.30, 0.52, 1.0), vec3(1.0, 0.50, 0.16), haze);
  airCol = mix(airCol, vec3(1.0, 0.36, 0.10), molten);
  airCol = mix(airCol, vec3(0.80, 0.84, 0.90), max(steam, snow * 0.4));
  float airAmt = mix(mix(0.55, 1.0, max(air, haze)), 0.9, molten);
  if (r >= 1.0 - 3.0 / R) {
    vec3 ln = normalize(vec3(p, 0.12));
    float day = smoothstep(-0.35, 0.45, dot(ln, SUN));
    float h = max(r - 1.0, 0.0);
    col += airCol * airAmt * sunI * (0.75 * exp(-h / 0.014) + 0.10 * exp(-h / 0.09)) * (0.06 + day);
    // every impact lights the sky round the planet for a moment
    col += vec3(1.0, 0.66, 0.34) * (theiaHit * (1.2 * exp(-h * 3.5) + 2.0 * exp(-length(p - vec2(0.72, 0.58)) * 2.6)) + chicHit * 0.4 * exp(-h * 6.0));
  }

  /* -- the planet -- */
  if (r < 1.0) {
    vec3 n = vec3(p, sqrt(1.0 - r * r));
    vec3 d = n;
    d.xy = rot2(0.41) * d.xy;                           // 23.4 degrees of tilt
    d.yz = rot2(0.30) * d.yz;                          // and the north towards us a little
    d.xz = rot2(u_spin) * d.xz;
    vec2 ll = vec2(degrees(atan(d.x, d.z)), degrees(asin(clamp(d.y, -1.0, 1.0))));
    float alat = abs(ll.y);
    float ndl = dot(n, SUN);
    float day = smoothstep(-0.10, 0.22, ndl);

    float real;
    float F = landField(d, Ga, grow, real);
    float land = smoothstep(0.488, 0.512, F) * ocean + (1.0 - ocean);
    float inland = sat((F - 0.5) * 2.2);
    float shelf = smoothstep(0.40, 0.5, F) * 0.55;
    float wet = fbm3(d * 7.0 + 3.0, 3);
    float fine = fbm3(d * 28.0, 3);
    float high = ridge3(d * 5.0 + 9.0, 3) * inland;

    /* the sea */
    vec3 sea = mix(vec3(0.010, 0.050, 0.130), vec3(0.030, 0.200, 0.340), shelf * 0.8);
    vec3 oldSea = mix(vec3(0.012, 0.060, 0.050), vec3(0.050, 0.200, 0.130), shelf);   // iron in it, no oxygen
    sea = mix(oldSea, sea, smoothstep(2.5, 1.7, Ga));

    /* the ground */
    vec3 basalt = mix(vec3(0.045, 0.042, 0.045), vec3(0.14, 0.12, 0.11), wet) * (0.7 + 0.6 * fine);
    vec3 red = mix(vec3(0.34, 0.15, 0.08), vec3(0.56, 0.36, 0.22), wet) * (0.75 + 0.5 * fine);
    vec3 ground = mix(basalt, red, rust);
    if (plants > 0.0) {
      // what grows at each latitude: rainforest, savannah, desert, steppe,
      // forest, tundra — tidier now than it was in the Devonian
      float modern = smoothstep(120.0, 20.0, Ma);
      vec3 jungle = vec3(0.045, 0.140, 0.040), dry = vec3(0.50, 0.38, 0.22), grass = vec3(0.20, 0.25, 0.09),
           taiga = vec3(0.060, 0.120, 0.060), tundra = vec3(0.25, 0.23, 0.18);
      float desert = bump(alat, 24.0, 9.0) * smoothstep(0.15, 0.55, inland + 0.4 * wet);
      // one continent is mostly a long way from the sea
      desert = max(desert, bump(Ma, 250.0, 60.0) * smoothstep(0.35, 0.8, inland));
      // the Sahara was green from about eleven to five and a half thousand years ago
      float humid = smoothstep(12500.0, 10500.0, y) * smoothstep(4800.0, 6000.0, y);
      desert *= 1.0 - 0.8 * humid * step(-20.0, ll.x) * step(ll.x, 40.0) * step(8.0, ll.y) * step(ll.y, 34.0);
      vec3 veg = mix(jungle, grass, smoothstep(6.0, 18.0, alat + 10.0 * wet));
      veg = mix(veg, taiga, smoothstep(40.0, 54.0, alat + 8.0 * wet));
      veg = mix(veg, tundra, smoothstep(62.0, 70.0, alat) * modern);
      veg *= 0.8 + 0.5 * fine;
      // plants take the wet edges first and the interiors only with forests
      float cover = plants * mix(smoothstep(0.42, 0.05, inland + 0.3 * wet), 1.0, forest);
      cover *= 1.0 - 0.75 * dying - 0.5 * kpg;   // and what dies back
      ground = mix(ground, mix(veg, dry * (0.85 + 0.3 * fine), sat(desert * 1.5)), cover * (1.0 - 0.0));
      ground = mix(ground, mix(ground, dry, 0.6), sat(desert * 1.5) * (1.0 - cover));
    }
    // mountains, greyer and then white — and lit from the side, which is
    // what makes a range a range: the same height a little way towards the
    // Sun, and the difference is the slope
    vec3 sunward = normalize(SUN - n * dot(SUN, n));
    vec3 ds = sunward;
    ds.xy = rot2(0.41) * ds.xy; ds.yz = rot2(0.30) * ds.yz; ds.xz = rot2(u_spin) * ds.xz;
    float high2 = ridge3(normalize(d + ds * 0.012) * 5.0 + 9.0, 3) * inland;
    float slope = clamp((high2 - high) * 14.0, -1.0, 1.0);
    ground = mix(ground, vec3(0.30, 0.28, 0.26), smoothstep(0.30, 0.55, high) * 0.6 * (1.0 - molten));
    ground *= 1.0 - 0.55 * slope * land * smoothstep(0.02, 0.2, inland);
    ground *= 0.80 + 0.40 * mix(wet, fine, 0.5);

    vec3 alb = mix(sea, ground, land);
    float rough = mix(0.0, 1.0, land);

    /* ice */
    float ice = 0.0;
    if (snow > 0.0) ice = smoothstep(1.0 - snow * 1.25, 1.06 - snow * 1.1, alat / 90.0 + 0.10 * wet);
    if (south > 0.0) ice = max(ice, south * smoothstep(-58.0, -66.0, ll.y + 8.0 * wet - 6.0 * land));
    if (north > 0.0) {
      // the Laurentide sheet came further south than the Siberian one did
      float reach = mix(80.0, 50.0, north) + 12.0 * (wet - 0.5) - 7.0 * bump(ll.x, -85.0, 35.0) + 9.0 * bump(ll.x, 120.0, 45.0);
      ice = max(ice, smoothstep(reach, reach + 4.0, ll.y) * mix(smoothstep(reach + 14.0, reach + 20.0, ll.y), 1.0, land));
    }
    ice = max(ice, smoothstep(0.62, 0.8, high) * smoothstep(3.0, 0.0, Ga) * land * (1.0 - molten) * 0.8);
    ice *= 1.0 - molten;
    vec3 iceCol = mix(vec3(0.72, 0.80, 0.86), vec3(0.93, 0.95, 0.97), fine);
    if (snow > 0.0) {
      // sea ice a kilometre thick still moves: leads and pressure ridges, and
      // bare blue ice where the wind has scoured the snow off
      float lead = pow(ridge3(d * 6.0 + 2.0, 4), 2.5);
      iceCol = mix(iceCol, vec3(0.42, 0.62, 0.78), snow * (0.5 * smoothstep(0.45, 0.65, wet) + lead * 0.7) * (1.0 - land * 0.6));
      iceCol = mix(iceCol, vec3(0.50, 0.44, 0.40), snow * land * smoothstep(0.35, 0.6, high) * 0.5);
    }
    alb = mix(alb, iceCol, ice);
    rough = mix(rough, 1.0, ice);

    /* Chicxulub, 89.5 west, 21.3 north: how far round the planet this
       point is from it, and whether the blast has got here yet */
    float ang = degrees(acos(clamp(dot(d, vec3(-0.9316, 0.3633, 0.0081)), -1.0, 1.0)));
    float front = 48.0 * hitT;
    float soot = kpg;
    if (kind == 2.0 && hitT < 14.0) soot = max(kpg, exp(-hitT * 0.12)) * smoothstep(ang - 14.0, ang + 6.0, front - 6.0);

    /* weather */
    float cAmt = mix(0.34, 0.80, steam) * (1.0 - molten) * mix(1.0, 0.30, snow);
    cAmt = mix(cAmt, 0.72, max(dying * 0.6, soot));
    float cl = cloudCover(d, cAmt, u_time);
    vec3 clCol = mix(vec3(0.95), vec3(0.92, 0.62, 0.34), haze * 0.75);
    clCol = mix(clCol, vec3(0.045, 0.038, 0.034), max(sat(soot * 1.5), dying * 0.45));
    alb = mix(alb, clCol * (0.80 + 0.20 * cl), cl);
    rough = mix(rough, 1.0, cl);
    // the haze itself: a Titan-coloured veil you can only just see through
    alb = mix(alb, vec3(0.74, 0.40, 0.14) * (0.8 + 0.4 * fbm3(d * 3.0 + u_time * 0.01, 3)), haze * 0.5);

    /* light */
    vec3 c = alb * sunI * max(ndl, 0.0) * 1.55;
    vec3 hv = normalize(SUN + vec3(0.0, 0.0, 1.0));
    float ndh = max(dot(n, hv), 0.0);
    c += vec3(1.0, 0.93, 0.82) * sunI * (pow(ndh, 40.0) * 0.16 + pow(ndh, 700.0) * 0.9) * (1.0 - rough) * (1.0 - haze * 0.7);
    float rim = pow(1.0 - n.z, 3.0);
    c += airCol * airAmt * sunI * rim * (0.05 + day) * 0.85;
    c += airCol * airAmt * sunI * 0.035 * day;
    // sunset all the way round the terminator
    c += vec3(1.0, 0.42, 0.16) * bump(ndl, 0.05, 0.08) * rim * 0.12 * max(air, haze);

    /* things that make their own light */
    vec3 glow = vec3(0.0);
    if (molten > 0.0 || theiaHit > 0.0) {
      float m = max(molten, theiaHit);
      vec3 mq = d * 2.2 + vec3(0.0, u_time * 0.004, 0.0);
      float crack = ridge3(mq, 5);
      float plate = fbm3(d * 4.0, 4);
      vec3 crust = mix(vec3(0.012, 0.008, 0.008), vec3(0.060, 0.034, 0.028), plate);
      crack = max(crack, 0.8 * ridge3(d * 7.0 + 3.0, 4) * (0.4 + 0.6 * crack));
      float open = sat(smoothstep(4.47, 4.54, Ga) * 0.75 + theiaHit);
      float heat = pow(crack, mix(5.5, 2.8, open));
      vec3 lava = vec3(3.0, 0.72, 0.10) * heat * mix(0.7, 1.2, open) + vec3(1.8, 1.25, 0.6) * pow(crack, 10.0) * 2.4;
      c = mix(c, crust * sunI * max(ndl, 0.0) * 1.6, m);
      glow += (lava + vec3(0.035, 0.006, 0.002)) * m;
    }
    if (bomb > 0.0) {
      // craters that have not finished cooling, and the odd one arriving
      vec3 cq = d * 5.0;
      vec3 id = floor(cq);
      vec3 o = hash33(id * 1.31 + 7.0) * 0.3;
      float dd = length(fract(cq) - 0.5 - o);
      float when = fract(hash31(id + 2.0) * 7.0 + u_time * 0.07 + Ga * 9.0);
      float fresh = exp(-when * 5.0);
      glow += vec3(2.6, 0.75, 0.14) * bomb * step(hash31(id), 0.5) * smoothstep(0.17, 0.0, dd) * (0.5 + 3.0 * fresh) * (0.4 + 0.6 * pow(ridge3(d * 22.0, 3), 1.5));
      glow += vec3(1.0, 0.85, 0.6) * bomb * step(hash31(id), 0.5) * smoothstep(0.03 + 0.10 * fresh, 0.0, dd) * fresh * 3.0;
    }
    if (dying > 0.0) {
      // the Siberian Traps: two million cubic kilometres of basalt, in the north
      float trap = bump(ll.y, 58.0, 13.0) * smoothstep(0.50, 0.66, fbm3(d * 3.0 + 31.0, 4)) * land;
      glow += vec3(2.8, 0.7, 0.12) * dying * trap * pow(ridge3(d * 16.0, 4), 1.5) * 3.0;
    }
    if (kind == 2.0 && hitT < 14.0) {
      // the fireball, the shock going round the world from it, and the
      // forests alight behind the shock
      float ball = ang / (5.0 + 16.0 * hitT);
      glow += (vec3(3.4, 2.7, 1.9) * exp(-ball * ball * 4.0) * 9.0 + vec3(3.0, 0.9, 0.2) * exp(-ball * ball) * 3.0) * exp(-hitT * 0.9);
      glow += vec3(2.2, 1.5, 0.9) * bump(ang, front, 1.5 + hitT * 1.2) * exp(-hitT * 0.45) * 1.3;
      float burning = smoothstep(front, front - 12.0, ang) * exp(-hitT * 0.30) * smoothstep(0.0, 0.6, hitT);
      float flick = smoothstep(0.52, 0.75, fbm3(d * 34.0 + vec3(0.0, u_time * 0.25, 0.0), 3));
      glow += vec3(2.6, 0.62, 0.10) * burning * flick * land * 2.2;
    }
    if (lit > 0.0 && real > 0.5) {
      float pop = town(ll, -80.0, 39.0, 9.0) + town(ll, 5.0, 49.0, 9.0) + town(ll, 79.0, 23.0, 9.0) + town(ll, 115.0, 32.0, 9.0)
        + town(ll, 138.0, 36.0, 4.0) + town(ll, 110.0, -7.0, 4.0) + town(ll, -46.0, -23.0, 5.0) + town(ll, 31.0, 29.0, 2.5)
        + town(ll, 5.0, 8.0, 5.0) + town(ll, 28.0, -26.0, 3.0) + town(ll, -99.0, 20.0, 4.0) + town(ll, -120.0, 36.0, 4.0)
        + town(ll, 48.0, 30.0, 6.0) + town(ll, 127.0, 37.0, 2.5) + town(ll, 37.0, 56.0, 4.0) + town(ll, -58.0, -34.0, 3.0);
      float speck = smoothstep(0.50, 0.72, fbm3(d * 70.0, 3)) * 0.8 + smoothstep(0.55, 0.8, fbm3(d * 190.0, 2));
      float settled = land * (1.0 - ice) * smoothstep(64.0, 52.0, alat);
      glow += vec3(1.0, 0.72, 0.38) * lit * settled * speck * (0.10 + pop * (0.5 + 1.5 * lit)) * 3.2 * (1.0 - cl * 0.6);
    }
    // only where it is dark enough to see them — except magma, which is brighter than day
    c += glow * mix(1.0 - day * 0.92, 1.0, max(max(molten, theiaHit), max(bomb, kind == 2.0 ? exp(-hitT * 0.25) : 0.0)));
    // the flash itself
    c += vec3(1.0, 0.85, 0.6) * theiaHit * theiaHit * 3.0 * sat(dot(n, normalize(vec3(0.62, 0.50, 0.60))) * 1.4);

    // where it happened: a point of light, and a ring going out from it
    if (u_pin.w > 0.0) {
      float pa = degrees(acos(clamp(dot(d, u_pin.xyz), -1.0, 1.0)));
      float beat = fract(u_time * 0.6);
      float mark = smoothstep(1.5, 0.6, pa) * 3.2 + exp(-pa * pa / 9.0) * 0.5 + bump(pa, 1.5 + 8.0 * beat, 0.5 + beat) * (1.0 - beat) * 1.1;
      c += vec3(0.6, 0.85, 1.0) * u_pin.w * mark;
    }

    // the near half of the ring crosses the face
    if (ring > 0.0 && rq.y <= 0.0) c += vec3(1.9, 0.62, 0.16) * ringI * 0.6;

    float edge = smoothstep(1.0, 1.0 - 1.5 / R, r);
    col = mix(col, c, edge);
  }

  col = aces(col);
  col = toSRGB(col);
  col = dither(col, px);
  fragColor = vec4(col, 1.0);
}
`

/* -------------------------------------------------------------------------- */
/* The numbers beside it                                                      */
/* -------------------------------------------------------------------------- */

const lerpTable = (table: [number, number][], x: number) => {
  if (x <= table[0][0]) return table[0][1]
  for (let i = 1; i < table.length; i++) {
    if (x <= table[i][0]) {
      const [x0, y0] = table[i - 1], [x1, y1] = table[i]
      return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0)
    }
  }
  return table[table.length - 1][1]
}

/**
 * How long a day was, in hours. The Moon's tides have been slowing the Earth
 * since the Moon formed. The recent end is measured — growth lines in
 * Devonian corals, layers in tidal muds 620 million years old — and the far
 * end is modelled, so read the old values as "about".
 */
export const dayHours = (years: number) =>
  lerpTable([[0, 24], [70e6, 23.6], [200e6, 22.8], [400e6, 21.9], [620e6, 21.5], [1e9, 19.6], [2e9, 19], [2.5e9, 17], [3e9, 14.5], [3.5e9, 12], [4e9, 9], [4.5e9, 6], [4.51e9, 5]], years)

/**
 * Oxygen, as a percentage of the air. None to speak of until the Great
 * Oxidation, about a tenth of today's for the billion years after it, then
 * the climb to the Carboniferous peak that let dragonflies have
 * seventy-centimetre wings. Reconstructions disagree in the details; the
 * shape is not in doubt.
 */
export const oxygenPct = (years: number) =>
  lerpTable([[0, 21], [30e6, 21], [100e6, 23], [200e6, 16], [250e6, 17], [300e6, 31], [370e6, 17], [420e6, 15], [540e6, 8], [800e6, 2], [2.2e9, 1.5], [2.4e9, 0.3], [2.5e9, 0], [4.54e9, 0]], years)

/** The Sun's output against today's: it has brightened by about 40% (Gough, 1981). */
export const sunPct = (years: number) => 100 / (1 + 0.4 * (years / 4.57e9))
