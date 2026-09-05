/**
 * Checks src/lib/impact.ts against impacts we have measured answers for.
 *
 * A scaling law that cannot reproduce Chelyabinsk, Tunguska, Meteor Crater and
 * Chicxulub is not worth shipping, however good the page looks. Run with:
 *
 *   node scripts/check-impact.mjs
 */
import { register } from 'node:module'
import { simulate } from '../src/lib/impact.ts'

// Lets the dynamic import of casualties.ts below resolve its own extensionless
// import of the city data the way Vite would.
register('./resolve-ts.mjs', import.meta.url)

const KM = 1000

/** [label, input, expectations] — expectations are ranges from the literature. */
const CASES = [
  {
    name: 'Chelyabinsk (2013)',
    input: { diameter: 19, composition: 'rock', velocity: 19_160, angle: 18 },
    expect: {
      // Brown et al. 2013 put the airburst at 0.4–0.6 Mt.
      energyMt: [0.3, 0.8],
      // It burst at ~23 km and left no crater whatsoever.
      airburst: [1, 1],
      burstAltitudeKm: [10, 45],
      crater: [0, 0],
    },
    note: 'Airburst over Russia. ~1500 injured, almost all by flying glass.',
  },
  {
    name: 'Tunguska (1908)',
    input: { diameter: 55, composition: 'rock', velocity: 17_000, angle: 45 },
    expect: {
      // Consensus band is 10–15 Mt; older estimates ran higher.
      energyMt: [7, 20],
      airburst: [1, 1],
      // Burst height is usually put at 5–10 km.
      burstAltitudeKm: [3, 15],
      crater: [0, 0],
      // Trees were flattened to ~26 km (2,150 km² of forest). Tree blowdown
      // happens nearer 5–7 kPa than 20 — trees are far weaker than buildings —
      // so the windows-shatter ring is the right analogue for that radius.
      blast6900PaKm: [15, 60],
    },
    note: 'Flattened 2,000 km² of forest. No crater — it burst in the air.',
  },
  {
    name: 'Meteor Crater, Arizona (~50 ka)',
    input: { diameter: 50, composition: 'iron', velocity: 12_800, angle: 45 },
    expect: {
      // Measured crater: 1,186 m across, ~170 m deep. Iron is strong enough to
      // survive entry, which is exactly why this one left a hole.
      airburst: [0, 0],
      craterKm: [0.8, 1.8],
    },
    note: 'The textbook simple crater. Still 170 m deep after 50,000 years.',
  },
  {
    name: 'Chicxulub (66 Ma)',
    input: { diameter: 10_000, composition: 'rock', velocity: 20_000, angle: 60 },
    expect: {
      // ~1e23 J is the standard figure; crater is ~180 km rim to rim.
      energyMt: [1e7, 5e8],
      craterKm: [90, 220],
      // Collins' own relation gives ~9.9 here. Published figures for Chicxulub
      // range from M9 to M11+ depending on the coupling assumed, so this is the
      // literature spread, not a loosened bound.
      magnitude: [9, 12],
      airburst: [0, 0],
    },
    note: 'Ended the Cretaceous. Our model should land in the right order of magnitude.',
  },
]

const fmt = (n) =>
  n >= 1e6 ? n.toExponential(2) : n >= 100 ? n.toFixed(0) : n.toPrecision(3)

let failures = 0

for (const c of CASES) {
  const r = simulate(c.input)
  const blast69 = r.blast.find((b) => b.pa === 6_900)

  const actual = {
    energyMt: r.energyMt,
    craterKm: r.crater ? r.crater.final / KM : null,
    crater: r.crater ? 1 : 0,
    magnitude: r.magnitude,
    airburst: r.entry.airburst ? 1 : 0,
    burstAltitudeKm: r.entry.airburst ? r.entry.burstAltitude / KM : null,
    blast6900PaKm: blast69 ? blast69.radius / KM : null,
  }

  console.log(`\n${c.name}`)
  console.log(`  ${c.note}`)
  console.log(
    `  energy ${fmt(actual.energyMt)} Mt` +
      `  ·  ${
        r.entry.airburst
          ? `airburst at ${fmt(actual.burstAltitudeKm)} km, no crater`
          : `crater ${fmt(actual.craterKm)} km`
      }` +
      `  ·  M${actual.magnitude.toFixed(1)}` +
      `  ·  recurrence ~${fmt(r.recurrenceYears)} yr`,
  )

  for (const [key, [lo, hi]] of Object.entries(c.expect)) {
    const got = actual[key]
    const ok = got !== null && got >= lo && got <= hi
    if (!ok) failures++
    console.log(
      `  ${ok ? 'ok  ' : 'FAIL'} ${key}: ${got === null ? 'none' : fmt(got)} ` +
        `(expected ${fmt(lo)}–${fmt(hi)})`,
    )
  }
}

/* -------------------------------------------------------------------------- */
/* Casualty model                                                             */
/* -------------------------------------------------------------------------- */

const { estimateCasualties, cityRadius } = await import('../src/lib/casualties.ts')

console.log('\n--- casualty model ---')

// City footprints. Greater London is ~1,570 km² (r ≈ 22 km); the built-up area
// of Tokyo is larger still. Anything in the tens of km is the right shape.
for (const [label, pop, expectKm] of [
  ['London 8.96M', 8_962_000, [15, 35]],
  ['a 500k city', 500_000, [4, 10]],
]) {
  const r = cityRadius(pop) / KM
  const ok = r >= expectKm[0] && r <= expectKm[1]
  if (!ok) failures++
  console.log(
    `  ${ok ? 'ok  ' : 'FAIL'} radius, ${label}: ${r.toFixed(1)} km ` +
      `(expected ${expectKm[0]}–${expectKm[1]})`,
  )
}

const CASUALTY_CASES = [
  {
    name: 'Chelyabinsk airburst, over Chelyabinsk',
    input: { diameter: 19, composition: 'rock', velocity: 19_160, angle: 18 },
    at: [55.15, 61.43],
    // Reality: 0 dead, ~1,500 injured. An order-of-magnitude model should put
    // deaths at zero and injuries in the thousands, not the hundreds of
    // thousands and not zero.
    expect: { dead: [0, 50], injured: [100, 40_000] },
  },
  {
    name: 'Tunguska-scale airburst, over London',
    input: { diameter: 55, composition: 'rock', velocity: 17_000, angle: 45 },
    at: [51.51, -0.13],
    // The 1908 event flattened 2,000 km² of empty forest. Over a city of nine
    // million that has to be a major disaster, but not an extinction event.
    expect: { dead: [1_000, 3_000_000], injured: [10_000, 9_000_000] },
  },
  {
    name: 'Same rock, middle of the Pacific',
    input: { diameter: 55, composition: 'rock', velocity: 17_000, angle: 45 },
    at: [0, -140],
    expect: { dead: [0, 0], injured: [0, 0] },
  },
]

for (const c of CASUALTY_CASES) {
  const r = simulate(c.input)
  const cas = estimateCasualties(r, c.at[0], c.at[1])
  console.log(`\n  ${c.name}`)
  console.log(
    `    dead ${cas.dead.toLocaleString('en-US')}` +
      `  ·  injured ${cas.injured.toLocaleString('en-US')}` +
      `  ·  ${cas.cities.length} cities affected`,
  )
  for (const [key, [lo, hi]] of Object.entries(c.expect)) {
    const got = cas[key]
    const ok = got >= lo && got <= hi
    if (!ok) failures++
    console.log(
      `    ${ok ? 'ok  ' : 'FAIL'} ${key}: ${got.toLocaleString('en-US')} ` +
        `(expected ${lo.toLocaleString('en-US')}–${hi.toLocaleString('en-US')})`,
    )
  }
}

console.log(
  failures === 0
    ? '\nAll checks passed.\n'
    : `\n${failures} check(s) failed.\n`,
)
process.exit(failures === 0 ? 0 : 1)
