/**
 * The catalogue.
 *
 * Estimates are the only honest numbers a bidder gets before the hammer falls,
 * and in a real sale they are wide, soft, and set partly to encourage you. So
 * the appraised value here is not the mid-estimate: it is rolled around it with
 * enough spread that the catalogue is genuinely uncertain, which is the whole
 * reason the winner's curse has anywhere to live.
 */

export type Category =
  | 'Curiosities'
  | 'Paintings'
  | 'Jewellery'
  | 'Furniture'
  | 'Books'
  | 'Instruments'
  | 'Ceramics'

/** The fixed part — what the catalogue prints. */
export type LotSpec = {
  id: string
  category: Category
  title: string
  /** Catalogue voice: condition, provenance, and what they are not saying. */
  blurb: string
  /** Low and high estimate, in pounds. */
  low: number
  high: number
}

/** A lot as dealt for one sale, with the hidden numbers rolled. */
export type Lot = LotSpec & {
  /** What it turns out to be worth. Revealed only at the end. */
  value: number
  /** Below this the house will not sell. Never printed. */
  reserve: number
}

export const CATALOGUE: LotSpec[] = [
  {
    id: 'fox',
    category: 'Curiosities',
    title: 'A taxidermy fox, standing, in a small waistcoat',
    blurb:
      'English, c.1890. The waistcoat is later. Some moth to the tail. The expression has been described by two previous owners as knowing.',
    low: 300,
    high: 500,
  },
  {
    id: 'brooch',
    category: 'Jewellery',
    title: "A mourning brooch containing a stranger's hair",
    blurb:
      'Jet and gold, c.1861. The inscription reads only IN MEMORY, which does narrow it down less than one would hope.',
    low: 400,
    high: 600,
  },
  {
    id: 'nine-views',
    category: 'Paintings',
    title: 'Nine views of the same hill, by the same unknown hand',
    blurb:
      'Oil on board, unsigned, sold as one lot. The hill is not identified. The ninth is noticeably better than the other eight.',
    low: 800,
    high: 1_200,
  },
  {
    id: 'chronometer',
    category: 'Instruments',
    title: "A ship's chronometer, stopped at 4:11",
    blurb:
      'Mahogany case, gimballed, movement seized. Sold not working. The logbook it came with ends on the same page as the winding record.',
    low: 1_200,
    high: 1_800,
  },
  {
    id: 'desk',
    category: 'Furniture',
    title: 'A writing desk with one compartment nobody can open',
    blurb:
      'Walnut, c.1790, with fitted interior. The lower right compartment does not open and no key is present. Sound, and heavier than it looks.',
    low: 2_000,
    high: 3_000,
  },
  {
    id: 'first-edition',
    category: 'Books',
    title: 'A first edition of a book nobody wanted',
    blurb:
      'One of 400 printed, of which most survive, in original cloth. Scarcity is not the difficulty here.',
    low: 250,
    high: 400,
  },
  {
    id: 'dentures',
    category: 'Curiosities',
    title: 'A full set of dentures, gold, apparently unworn',
    blurb:
      'Late 19th century, in a fitted case with the maker’s label. Commissioned, paid for, and by every indication never collected.',
    low: 900,
    high: 1_400,
  },
  {
    id: 'portrait',
    category: 'Paintings',
    title: 'Portrait of a gentleman who is not enjoying it',
    blurb:
      'Oil on canvas, 1843, in a later frame. Relined. The sitter is unidentified and the artist has captured something.',
    low: 1_500,
    high: 2_500,
  },
  {
    id: 'meteorite',
    category: 'Curiosities',
    title: 'A meteorite fragment, or possibly slag',
    blurb:
      'Sold with a handwritten certificate of authenticity by a person who is not a recognised authority. Attracts a magnet, which proves less than it seems to.',
    low: 600,
    high: 900,
  },
  {
    id: 'piano',
    category: 'Instruments',
    title: 'A grand piano missing every black key',
    blurb:
      'Rosewood case, c.1905, restrung. The white keys are original and in excellent order. Plays beautifully in C major.',
    low: 1_800,
    high: 2_600,
  },
  {
    id: 'tea-service',
    category: 'Ceramics',
    title: 'A tea service for eleven',
    blurb:
      'Twelve of everything else. The missing cup is not accounted for in the original inventory either, which is the interesting part.',
    low: 500,
    high: 800,
  },
  {
    id: 'ring',
    category: 'Jewellery',
    title: 'A diamond ring, with a note from the previous owner',
    blurb:
      'Old European cut, approximately 1.8ct, in a platinum mount. The note is included in the lot and is not read out.',
    low: 3_000,
    high: 5_000,
  },
  {
    id: 'ladder',
    category: 'Furniture',
    title: 'A library ladder from a library that burned down',
    blurb:
      'Oak, with brass fittings, c.1880. Scorched to the upper treads. Structurally sound and, in the circumstances, remarkable.',
    low: 700,
    high: 1_100,
  },
  {
    id: 'encyclopedia',
    category: 'Books',
    title: 'Six volumes of a nine-volume encyclopedia',
    blurb:
      'Half calf, gilt. Volumes I to IV and VIII to IX. The world between CHARIOT and SALT is not represented.',
    low: 300,
    high: 500,
  },
]

/** Box-Muller, so the spread on the appraisal is a real normal, not a triangle. */
function gauss(rng: () => number): number {
  const u = Math.max(1e-9, rng())
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng())
}

/**
 * Roll the hidden numbers for one sale.
 *
 * The appraisal is log-normal around the mid-estimate, so it is as likely to
 * come in at two thirds as at one and a half — which is roughly how wrong
 * printed estimates actually are, and is what makes bidding to the top of the
 * estimate a real gamble rather than a safe move.
 */
export function dealLots(rng: () => number, spread = 0.3): Lot[] {
  return CATALOGUE.map((spec) => {
    const mid = (spec.low + spec.high) / 2
    const value = Math.round(
      Math.min(spec.high * 2.6, Math.max(spec.low * 0.35, mid * Math.exp(gauss(rng) * spread))),
    )
    // Houses set the reserve at or just under the low estimate, and never
    // print it.
    const reserve = Math.round(spec.low * (0.75 + rng() * 0.2))
    return { ...spec, value, reserve }
  })
}
