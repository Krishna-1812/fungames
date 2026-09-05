/**
 * Impact physics.
 *
 * Every number this file produces comes from the published scaling relations in
 * Collins, Melosh & Marcus (2005), "Earth Impact Effects Program: A Web-Based
 * Computer Program for Calculating the Regional Environmental Consequences of a
 * Meteoroid Impact on Earth", Meteoritics & Planetary Science 40, 817–840 —
 * the same peer-reviewed model the Imperial College / Purdue impact calculator
 * runs on. Nothing here is invented to look impressive, and the constants are
 * kept as named values so they can be checked against the paper.
 *
 * Verified against four real events in scripts/check-impact.mjs. If you change a
 * constant, run it: Chelyabinsk, Tunguska, Meteor Crater and Chicxulub all have
 * measured answers, and a scaling law that gets those wrong is wrong.
 *
 * SI throughout — metres, kilograms, seconds, joules — and converted only at the
 * presentation layer.
 */

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const G = 9.81                 // surface gravity, m/s²
const TARGET_DENSITY = 2500    // sedimentary rock, kg/m³ (Collins' default land target)
const JOULES_PER_MT = 4.184e15 // 1 megatonne of TNT
const JOULES_PER_KT = 4.184e12
const P0 = 101_325             // ambient sea-level pressure, Pa
const C0 = 340                 // speed of sound at sea level, m/s
const LUMINOUS_EFFICIENCY = 3e-3 // η, fraction of energy radiated as light

/** Transition from bowl-shaped simple craters to terraced complex ones, on Earth. */
const SIMPLE_COMPLEX_D = 3200  // m

export type Composition = 'ice' | 'porous' | 'rock' | 'iron' | 'gold'

/** Bulk densities in kg/m³. Comet ≈ porous ice; iron is a Canyon Diablo analogue. */
export const DENSITIES: Record<Composition, number> = {
  ice: 917,
  porous: 1500,
  rock: 3000,
  iron: 7800,
  gold: 19_300,
}

export type ImpactInput = {
  /** Impactor diameter, metres. */
  diameter: number
  composition: Composition
  /** Impact speed, m/s. Earth's minimum is escape velocity, 11.2 km/s. */
  velocity: number
  /** Angle from horizontal, degrees. 90 is straight down; 45 is the most likely. */
  angle: number
}

/* -------------------------------------------------------------------------- */
/* Energy                                                                     */
/* -------------------------------------------------------------------------- */

/** Collins eq. 1: a sphere of the given diameter and bulk density. */
export function mass(diameter: number, composition: Composition): number {
  return (Math.PI / 6) * DENSITIES[composition] * diameter ** 3
}

/** Kinetic energy at the top of the atmosphere, joules. */
export function energy(input: ImpactInput): number {
  return 0.5 * mass(input.diameter, input.composition) * input.velocity ** 2
}

/**
 * How often an impact of this energy happens somewhere on Earth, in years.
 * Collins eq. 3, fitted to the observed near-Earth-object size distribution.
 */
export function recurrenceYears(energyJ: number): number {
  const mt = energyJ / JOULES_PER_MT
  return 109 * mt ** 0.78
}

/* -------------------------------------------------------------------------- */
/* Atmospheric entry                                                          */
/* -------------------------------------------------------------------------- */

const RHO_AIR_0 = 1.225 // sea-level air density, kg/m³
const SCALE_HEIGHT = 8000 // atmospheric scale height, m
const DRAG_COEFFICIENT = 2
/** Ratio of dispersed-cloud diameter to original diameter at burst. Collins §5. */
const PANCAKE_FACTOR = 7

/**
 * Yield strength of the impactor, Pa — Collins eq. 10, an empirical fit across
 * meteorite types. Iron is roughly a thousand times stronger than a comet, which
 * is exactly why iron reaches the ground and comets never do.
 */
function yieldStrength(composition: Composition): number {
  return 10 ** (2.107 + 0.0624 * Math.sqrt(DENSITIES[composition]))
}

export type Entry = {
  /** True if it detonated in the air and nothing solid reached the ground. */
  airburst: boolean
  /** Altitude of the burst, metres. Zero for a ground impact. */
  burstAltitude: number
  /** Altitude at which it started to come apart, metres. Null if it never did. */
  breakupAltitude: number | null
}

/**
 * Does it reach the ground?
 *
 * Collins §5 (eqs. 8–18). The object holds together until the ram pressure
 * ρ_air·v² exceeds its own strength; after that it spreads sideways into a
 * "pancake" of fragments, which decelerates catastrophically because its
 * cross-section is growing. If that runaway completes before it reaches sea
 * level, the whole kinetic energy is dumped into the air as a burst and there is
 * no crater at all.
 *
 * This is the single most important branch in the model. Chelyabinsk and
 * Tunguska were both airbursts; a version of this that ignored entry would tell
 * you a 20 m rock digs a hole in your city, and that is simply not what happens.
 */
export function entry(input: ImpactInput): Entry {
  const strength = yieldStrength(input.composition)
  const theta = (input.angle * Math.PI) / 180
  const v = input.velocity

  // Collins eq. 11, neglecting deceleration above the breakup point.
  const ratio = strength / (RHO_AIR_0 * v * v)
  if (ratio >= 1) {
    // Strong enough that ram pressure never exceeds strength, even at sea level.
    return { airburst: false, burstAltitude: 0, breakupAltitude: null }
  }
  const breakup = -SCALE_HEIGHT * Math.log(ratio)
  if (breakup <= 0) return { airburst: false, burstAltitude: 0, breakupAltitude: null }

  // Dispersion length scale (eq. 16): how far it must fall for the fragment
  // cloud to spread by the pancake factor.
  const rhoAtBreakup = RHO_AIR_0 * Math.exp(-breakup / SCALE_HEIGHT)
  const l =
    input.diameter *
    Math.sin(theta) *
    Math.sqrt(DENSITIES[input.composition] / (DRAG_COEFFICIENT * rhoAtBreakup))

  // Collins eq. 18.
  const burst =
    breakup -
    2 * SCALE_HEIGHT * Math.log(1 + (l / (2 * SCALE_HEIGHT)) * Math.sqrt(PANCAKE_FACTOR ** 2 - 1))

  return burst > 0
    ? { airburst: true, burstAltitude: burst, breakupAltitude: breakup }
    : { airburst: false, burstAltitude: 0, breakupAltitude: breakup }
}

/* -------------------------------------------------------------------------- */
/* Crater                                                                     */
/* -------------------------------------------------------------------------- */

export type Crater = {
  /** Transient cavity, before the walls collapse. Metres. */
  transient: number
  /** The crater you would actually find afterwards. Metres. */
  final: number
  /** Rim-to-floor depth of the final crater, metres. */
  depth: number
  /** True once the crater is big enough to slump into terraces and a central peak. */
  complex: boolean
}

/**
 * Crater size by π-group scaling — Collins eq. 21, the gravity-dominated regime,
 * which is the right regime for everything bigger than a few metres.
 *
 * The sin(θ) term is why a grazing impact digs a smaller hole than a vertical one
 * at the same energy: only the vertical component of the velocity does the work.
 */
export function crater(input: ImpactInput): Crater {
  const rhoI = DENSITIES[input.composition]
  const theta = (input.angle * Math.PI) / 180

  const transient =
    1.161 *
    (rhoI / TARGET_DENSITY) ** (1 / 3) *
    input.diameter ** 0.78 *
    input.velocity ** 0.44 *
    G ** -0.22 *
    Math.sin(theta) ** (1 / 3)

  // Collins eq. 22 / 27. Below the transition the cavity just keeps its shape;
  // above it, gravity pulls the walls in and the crater ends up wider and shallower.
  const complex = transient >= SIMPLE_COMPLEX_D / 1.25
  const final = complex
    ? (1.17 * transient ** 1.13) / SIMPLE_COMPLEX_D ** 0.13
    : 1.25 * transient

  /* Depth.
   *
   * Collins eq. 28 for complex craters is written in kilometres — d = 0.4 D^0.3
   * with both sides in km. Feeding it metres is dimensionally meaningless and
   * silently returns a plausible-looking small number: Chicxulub came out as a
   * 129 km crater 14 m deep, which is a scratch, not a basin. Converted here.
   *
   * Simple craters use the observed depth-to-diameter ratio of about 1:5 for
   * fresh terrestrial bowls rather than the transient-cavity depth, because by
   * the time anyone measures a crater the breccia lens has already partly
   * filled it back in. Meteor Crater is 1.19 km across and was roughly 230 m
   * deep before 50,000 years of infill.
   */
  const depth = complex
    ? 0.4 * (final / 1000) ** 0.3 * 1000
    : 0.2 * final

  return { transient, final, depth, complex }
}

/* -------------------------------------------------------------------------- */
/* Fireball and thermal radiation                                             */
/* -------------------------------------------------------------------------- */

/** Radius of the luminous fireball at maximum size, metres. Collins eq. 32. */
export function fireballRadius(energyJ: number): number {
  return 0.002 * energyJ ** (1 / 3)
}

/**
 * Thermal exposure thresholds, in MJ/m², from Collins Table 1.
 *
 * They scale as E^(1/6) because a bigger fireball burns for longer, so the same
 * total dose arrives more slowly and more of it is lost to re-radiation.
 */
const THERMAL_THRESHOLDS = {
  clothingIgnites: 1.0,
  thirdDegreeBurns: 0.67,
  grassIgnites: 0.38,
  secondDegreeBurns: 0.34,
  treesIgnite: 0.25,
  firstDegreeBurns: 0.13,
} as const

export type ThermalEffect = keyof typeof THERMAL_THRESHOLDS

/**
 * How far out a given thermal effect reaches, metres — or null if the fireball
 * never delivers that dose anywhere (small impacts simply do not set things
 * alight).
 *
 * Inverts Φ = ηE / 2πr². The horizon check matters: past a few hundred
 * kilometres the fireball is below the curve of the Earth and radiates into
 * space rather than at you.
 */
export function thermalRadius(
  energyJ: number,
  effect: ThermalEffect,
  burstAltitude = 0,
): number | null {
  const mt = energyJ / JOULES_PER_MT
  const thresholdJ = THERMAL_THRESHOLDS[effect] * 1e6 * mt ** (1 / 6)
  if (thresholdJ <= 0) return null
  const slant = Math.sqrt((LUMINOUS_EFFICIENCY * energyJ) / (2 * Math.PI * thresholdJ))
  if (!Number.isFinite(slant) || slant <= 0) return null
  return groundRange(slant, burstAltitude)
}

/* -------------------------------------------------------------------------- */
/* Air blast                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Peak overpressure at range r, in pascals — Collins eq. 54, a fit to the
 * measured surface-burst curve.
 *
 * The two terms are the two regimes: 1/r far out where the shock has decayed to
 * an acoustic wave, and a much steeper near-field term that dominates close in.
 */
export function overpressure(energyJ: number, r: number): number {
  const kt = energyJ / JOULES_PER_KT
  const rx = 290 * kt ** (1 / 3) // crossover range, m
  const px = 75_000              // overpressure at rx, Pa
  if (r <= 0) return Infinity
  return ((px * rx) / (4 * r)) * (1 + 3 * (rx / r) ** 1.3)
}

/**
 * Range at which the blast has decayed to a given overpressure, metres.
 *
 * Solved by bisection rather than algebraically: eq. 54 has no closed-form
 * inverse, and 200 halvings of a bracket from 1 m to 40,000 km is exact to well
 * under a metre while being impossible to get subtly wrong.
 */
/**
 * Peak overpressure felt *at ground level*, at ground range r from the point
 * directly under the burst.
 *
 * Two branches, because they are genuinely different situations.
 *
 * **Surface impact.** Eq. 54 is fitted to surface bursts, so ground reflection
 * is already inside it. Use it as-is.
 *
 * **Airburst.** A surface burst behaves like a free-air burst of twice the
 * energy, because the ground reflects the whole thing back — so eq. 54 run at
 * half the energy recovers the free-air curve. The blast then travels the slant
 * distance down to the ground and reflects there, and for the weak shocks an
 * airburst delivers from tens of kilometres up, that reflection is acoustic and
 * doubles the pressure. Hence 2 × p_surface(E/2, slant).
 *
 * The obvious-looking alternative — treating the merged Mach stem as a surface
 * burst of 2E at ground *range* — is only valid when the burst is low compared
 * to the damage radii. Applied to Chelyabinsk, 0.5 Mt at 34 km up, it claims
 * 678 kPa a kilometre from ground zero: enough to level reinforced concrete,
 * from an event whose real signature was broken windows. It is off by more than
 * two orders of magnitude and it is not used here.
 *
 * This version puts 2.1 kPa under Chelyabinsk and 31 km of ≥7 kPa under
 * Tunguska, against a measured tree-fall radius of about 26 km.
 */
export function groundOverpressure(energyJ: number, r: number, burstAltitude = 0): number {
  if (burstAltitude <= 0) return overpressure(energyJ, r)
  const slant = Math.hypot(r, burstAltitude)
  return 2 * overpressure(energyJ / 2, slant)
}

export function overpressureRadius(
  energyJ: number,
  targetPa: number,
  burstAltitude = 0,
): number | null {
  const at = (r: number) => groundOverpressure(energyJ, r, burstAltitude)
  let lo = 1
  let hi = 4e7
  if (at(lo) < targetPa) return null
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2
    if (at(mid) > targetPa) lo = mid
    else hi = mid
  }
  return lo
}

/**
 * Slant distance converted to a circle on the ground, for effects that travel in
 * a straight line and do not reflect — thermal radiation. If the burst is higher
 * than the range at which a dose is delivered, that dose never lands anywhere.
 */
function groundRange(slant: number, burstAltitude: number): number | null {
  if (burstAltitude <= 0) return slant
  if (slant <= burstAltitude) return null
  return Math.sqrt(slant * slant - burstAltitude * burstAltitude)
}

/** Named blast thresholds in pascals, with what they actually do to a city. */
export const BLAST_LEVELS = [
  { pa: 426_000, label: 'Everything flattened', note: 'Multi-storey concrete buildings collapse' },
  { pa: 121_000, label: 'Buildings collapse', note: 'Most structures fail; near-total fatalities' },
  { pa: 42_600, label: 'Homes destroyed', note: 'Wood-frame houses collapse entirely' },
  { pa: 20_000, label: 'Homes damaged', note: 'Roofs and walls fail; widespread injuries' },
  { pa: 6_900, label: 'Windows shatter', note: 'Flying glass injures anyone near a window' },
  // Chelyabinsk's band. Large panes start failing well below the conventional
  // 1 psi figure, and this is the ring that actually put people in hospital.
  { pa: 2_000, label: 'Windows crack', note: 'Big panes fail; you feel it in your chest' },
] as const

/**
 * Peak wind speed behind a shock of the given overpressure, m/s.
 * Rankine–Hugoniot, Collins eq. 56.
 */
export function windSpeed(overpressurePa: number): number {
  const ratio = overpressurePa / P0
  return ((5 * ratio) / 7) * (C0 / Math.sqrt(1 + (6 * ratio) / 7))
}

/* -------------------------------------------------------------------------- */
/* Seismic                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Richter magnitude of the impact-generated earthquake. Collins eq. 42.
 *
 * Only about 1e-4 of the impact energy goes into seismic waves, which is why a
 * Tunguska-scale airburst barely registers as an earthquake despite being a
 * multi-megatonne explosion.
 */
export function seismicMagnitude(energyJ: number): number {
  return 0.67 * Math.log10(energyJ) - 5.87
}

/* -------------------------------------------------------------------------- */
/* The whole result                                                           */
/* -------------------------------------------------------------------------- */

export type BlastRing = {
  pa: number
  label: string
  note: string
  radius: number
  /** Peak wind at this overpressure, m/s. */
  wind: number
}

export type ImpactResult = {
  input: ImpactInput
  mass: number
  energyJ: number
  energyMt: number
  recurrenceYears: number
  entry: Entry
  /** Null on an airburst — nothing solid reached the ground to dig a hole. */
  crater: Crater | null
  fireball: number
  thermal: { effect: ThermalEffect; radius: number }[]
  blast: BlastRing[]
  magnitude: number
  /** Largest radius any effect reaches, metres — what the map has to fit. */
  maxRadius: number
}

export function simulate(input: ImpactInput): ImpactResult {
  const energyJ = energy(input)
  const e = entry(input)
  const z = e.burstAltitude

  // No crater on an airburst. Tunguska flattened two thousand square kilometres
  // of forest and left nothing to excavate.
  const c = e.airburst ? null : crater(input)

  const thermal = (Object.keys(THERMAL_THRESHOLDS) as ThermalEffect[])
    .map((effect) => ({ effect, radius: thermalRadius(energyJ, effect, z) }))
    .filter((t): t is { effect: ThermalEffect; radius: number } => t.radius !== null)

  const blast = BLAST_LEVELS.map((level) => {
    const radius = overpressureRadius(energyJ, level.pa, z)
    return radius === null ? null : { ...level, radius, wind: windSpeed(level.pa) }
  }).filter((b): b is BlastRing => b !== null)

  const maxRadius = Math.max(
    c ? c.final / 2 : 0,
    ...thermal.map((t) => t.radius),
    ...blast.map((b) => b.radius),
    1,
  )

  return {
    input,
    mass: mass(input.diameter, input.composition),
    energyJ,
    energyMt: energyJ / JOULES_PER_MT,
    recurrenceYears: recurrenceYears(energyJ),
    entry: e,
    crater: c,
    fireball: fireballRadius(energyJ),
    thermal,
    blast,
    magnitude: seismicMagnitude(energyJ),
    maxRadius,
  }
}
