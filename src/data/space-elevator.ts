/**
 * Space Elevator — every marker, and the real altitude it sits at.
 *
 * Same shape as `deep-sea.ts`, going the other direction: a linear scroll
 * from the ground to the edge of space, zoned by the real, textbook
 * atmospheric layers rather than an invented scale. `altitude` is metres
 * above sea level. Every number here is a real recorded altitude — an
 * aircraft's certified service ceiling, a jump that actually happened, a
 * boundary with a real physical definition — not an invented waypoint.
 * Sources are in the commit that added this file; where a range exists,
 * `altitude` is picked from inside it rather than at an edge, and the note
 * says so.
 */
export type Marker = {
  altitude: number
  title: string
  note: string
  /** The turning points — a zone's defining fact, or a genuine record. */
  big?: boolean
}

export type Zone = {
  id: string
  /** What this page calls it, in the HUD and the seam. */
  label: string
  from: number
  to: number
  /** How many pixels of scroll one metre of real altitude gets in this zone. */
  pxPerMetre: number
  /** Two tones for the seam rule and the sky — this zone's own first and last colour. */
  sky: [string, string]
  note: string
}

// Real, textbook atmospheric layer boundaries (the fiducial values used by
// the US Standard Atmosphere and NOAA's own public reference). Density falls
// zone over zone on purpose: the troposphere is generous because that is
// where almost every aircraft, bird and mountain on this page actually is,
// and the thermosphere gets real height despite being the emptiest, because
// it holds the whole climb to the Kármán line.
export const ZONES: Zone[] = [
  {
    id: 'troposphere', label: 'The troposphere',
    from: 0, to: 12_000, pxPerMetre: 0.375,
    sky: ['#8fcaf0', '#2a5a86'],
    note: 'Where practically all weather happens, and 99% of the atmosphere’s water vapour lives.',
  },
  {
    id: 'stratosphere', label: 'The stratosphere',
    from: 12_000, to: 50_000, pxPerMetre: 0.118,
    sky: ['#1c3a5e', '#0d1f38'],
    note: 'Unlike the troposphere, it warms as you climb — the ozone layer absorbing UV is why.',
  },
  {
    id: 'mesosphere', label: 'The mesosphere',
    from: 50_000, to: 85_000, pxPerMetre: 0.0714,
    sky: ['#0d1f38', '#050b18'],
    note: 'The coldest layer of the whole atmosphere, and the one most meteors never get past.',
  },
  {
    id: 'thermosphere', label: 'The thermosphere',
    from: 85_000, to: 110_000, pxPerMetre: 0.12,
    sky: ['#050b18', '#030510'],
    note: 'Air this thin barely deserves the word — and it is where the Kármán line sits.',
  },
]

export const TOTAL_ALTITUDE = ZONES[ZONES.length - 1].to

export const MARKERS: Marker[] = [
  {
    altitude: 600, title: 'A grey, overcast sky',
    note: 'Stratus clouds — the flat, featureless blanket that turns a whole sky one colour — sit unusually low, typically under 2,000 metres. This is the cloud that makes a ceiling feel close enough to touch.',
  },
  {
    altitude: 1_500, title: 'A fair-weather cumulus',
    note: 'The cartoon cloud — flat-bottomed, cauliflower-topped — forms where a rising bubble of warm, moist air cools past its dew point. That almost always happens within the lowest two kilometres.',
  },
  {
    altitude: 8_848.86, title: 'Mount Everest’s summit',
    note: 'Officially remeasured by Nepal and China together in December 2020 — the first time both countries agreed on one number.',
  },
  {
    altitude: 9_000, title: 'A bumblebee, in a lab',
    note: 'Researchers lowered the air pressure around bumblebees in a chamber until they stopped being able to fly. Several kept going past the pressure equivalent of Everest’s own summit — by taking wider wingbeats, not faster ones.',
  },
  {
    altitude: 10_700, title: 'Where your flight is probably cruising',
    note: 'Most commercial jets cruise between about 10 and 11 kilometres — high enough to clear most weather, low enough that the engines still have air to breathe.',
  },
  {
    altitude: 11_300, title: 'The highest a bird has ever been confirmed flying',
    note: 'A Rüppell’s griffon vulture, struck by a commercial aircraft over Abidjan, Ivory Coast, on 29 November 1973. Feather remains let the American Museum of Natural History identify it. The species is rarely seen above 6,000 metres.',
    big: true,
  },
  {
    altitude: 11_600, title: 'A cumulonimbus, flattening into an anvil',
    note: 'A storm strong enough to reach here stops climbing and spreads sideways — the stable stratosphere above is too stiff to push through, and that flat top is the collision.',
    big: true,
  },
  {
    altitude: 18_000, title: 'Concorde’s cruising altitude',
    note: 'Every scheduled Concorde flight cruised around 18 kilometres up — nearly twice as high as an ordinary airliner, and fast enough to outrun the sunrise going west.',
  },
  {
    altitude: 21_336, title: 'The U-2’s service ceiling',
    note: 'The Lockheed U-2 spy plane’s official ceiling is 70,000 feet. Declassified CIA flight logs describe it routinely going higher still.',
  },
  {
    altitude: 23_163, title: 'The highest a glider has ever flown',
    note: 'Airbus Perlan 2 has no engine at all — it climbed here in September 2018 by riding stratospheric mountain waves above the Andes, in a pressurised cabin, above almost every powered aircraft that has ever flown.',
    big: true,
  },
  {
    altitude: 25_000, title: 'Inside the ozone layer',
    note: 'The ozone layer is not a single altitude but a band, roughly 15 to 35 kilometres up, with the ozone itself most concentrated near the top of that range.',
  },
  {
    altitude: 25_929, title: 'The SR-71’s altitude record',
    note: 'Set on 28 July 1976 by an SR-71 Blackbird in sustained, level flight — not a brief zoom-climb. It still stands.',
  },
  {
    altitude: 29_700, title: 'The Chelyabinsk meteor',
    note: 'On 13 February 2013, a 20-metre asteroid disintegrated over Russia in stages; the main airburst’s peak radiation has been measured at close to this height. The shockwave still broke windows across six cities.',
  },
  {
    altitude: 31_000, title: 'Where most weather balloons pop',
    note: 'By the time a balloon released at sea level reaches here, the near-vacuum outside has let it swell to many times its launch size — and it bursts, rather than leaks.',
  },
  {
    altitude: 31_333, title: 'Joseph Kittinger’s jump',
    note: 'On 16 August 1960, Captain Kittinger stepped out of an open gondola over New Mexico and fell for four and a half minutes. The record stood for fifty-two years.',
  },
  {
    altitude: 38_969, title: 'Felix Baumgartner’s jump',
    note: 'Red Bull Stratos, 14 October 2012: the first human to break the sound barrier with nothing but his own body, reaching 1,357 km/h in freefall.',
    big: true,
  },
  {
    altitude: 41_419, title: 'The current highest skydive on record',
    note: 'Alan Eustace, a Google engineer, went two kilometres higher than Baumgartner in 2014 — carried up by a stratospheric balloon alone, no capsule, just a pressure suit.',
    big: true,
  },
  {
    altitude: 53_700, title: 'The highest a balloon has ever reached',
    note: 'An unmanned high-altitude balloon, BU60-1, reached roughly this height in 2013 — still the record for any balloon of any kind.',
  },
  {
    altitude: 64_000, title: 'Tsar Bomba’s mushroom cloud',
    note: 'The largest nuclear device ever detonated, tested by the USSR on 30 October 1961. Its mushroom cloud climbed to somewhere around this altitude — estimates vary — and its flash was visible 1,000 kilometres away.',
    big: true,
  },
  {
    altitude: 80_000, title: 'Where a Falcon 9 lets its first stage go',
    note: 'This is also the altitude NASA and the US Air Force use as their own definition of “space” — a lower, quieter rival to the Kármán line eighty thousand feet above it.',
  },
  {
    altitude: 82_000, title: 'Noctilucent clouds',
    note: 'The highest clouds in the sky, made of ice crystals on meteor dust, visible only after sunset at high latitudes — everything below them has already gone dark.',
  },
  {
    altitude: 100_000, title: 'The Kármán line',
    note: 'The internationally recognised edge of space, adopted by the Fédération Aéronautique Internationale — the altitude at which a conventional aircraft’s wings stop being able to generate enough lift to matter.',
    big: true,
  },
  {
    altitude: 107_960, title: 'The X-15’s highest flight',
    note: 'Joseph Walker flew a rocket plane — not a rocket — this high on 22 August 1963. Nobody has ever flown a winged aircraft higher; the U.S. Air Force awarded him astronaut wings for it.',
    big: true,
  },
]

export const fmtAltitude = (m: number) =>
  m >= 1000 ? `${(m / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })}km` : `${Math.round(m)}m`
