/**
 * The game registry — the single source of truth for the homepage grid, every
 * <head>, and the sitemap. Adding a game means one entry here, one file in
 * src/pages/, and one drawing in lib/tile-art.ts keyed by the same slug.
 *
 * There is deliberately no `art` field any more. It used to name a shape from
 * a shared pool, which is how eighteen tiles ended up looking like one
 * template with the silhouette swapped. Illustrations are keyed on the slug
 * instead, so two games cannot share one, and check-art fails if a game has no
 * drawing or a drawing has no game.
 *
 * There is deliberately no `glyph` field either. An emoji in the corner of
 * every card is the loudest possible statement that nobody drew anything.
 *
 * `category` groups the homepage into sections. It is an honest description
 * of what each game actually *does* — a real mechanism, not a marketing
 * vibe — which is why "Money, spent unwisely" has exactly two members and
 * nobody was moved into it to balance the section sizes.
 */
export type Game = {
  slug: string
  title: string
  /** Short line shown on the tile. */
  blurb: string
  /** Longer line for <meta name="description"> and share cards. */
  description: string
  accent: string
  accent2: string
  /** Ink colour used on the tile — set to dark for pale gradients. */
  onAccent?: string
  /** Hidden from the grid but still routable, like neal.fun's archive pages. */
  unlisted?: boolean
  /** ISO date. Newest first controls grid order and the homepage carousel. */
  added: string
  /** Which homepage section this belongs in. */
  category: Category
}

export type Category = 'science' | 'you' | 'money' | 'fun'

export const CATEGORIES: { key: Category; label: string; note: string }[] = [
  {
    key: 'science',
    label: 'Real science, worked out live',
    note: 'Nothing here is looked up — it is computed in your browser from the same equations the real thing runs on.',
  },
  {
    key: 'you',
    label: 'Measures the actual you',
    note: 'Not a quiz with outcomes written in advance. Real input — your tremor, your memory, your choices — actually measured.',
  },
  {
    key: 'money',
    label: 'Money, spent unwisely',
    note: 'Two ways to find out exactly how a large amount of money leaves your hands.',
  },
  {
    key: 'fun',
    label: 'Just because',
    note: 'No lesson, no measurement. Some things are worth building for their own sake.',
  },
]

export const GAMES: Game[] = [
  {
    slug: 'speed',
    title: 'How Fast Are You Moving?',
    blurb: 'Seven real speeds, stacking, live',
    description:
      'You are not standing still. Seven real, cited speeds stack live while you read: your tectonic plate drifting, the Earth turning beneath you (computed from your real latitude), its orbit around the Sun, the Sun drifting against nearby stars, its orbit around the galaxy, the Milky Way falling toward Andromeda, and the Local Group’s real, measured motion against the cosmic microwave background — out past which the observable universe itself recedes faster than light.',
    accent: '#0a0e1e', accent2: '#6ee7ff',
    category: 'science',
    added: '2026-09-24',
  },
  {
    slug: 'day-go',
    title: 'Where Does The Day Go?',
    blurb: 'Your day, cut into its real pieces',
    description:
      'Slide in your work, home and sleep hours and watch a perfectly tidy 24-hour bar — then carve your actual morning routine, meals and commute out of it, and watch your own phone-check habit cut what is left into dozens of pieces. The 23-minute refocus cost after each one is Gloria Mark’s real, published figure, not a guess.',
    accent: '#301a10', accent2: '#7ec8ff',
    category: 'you',
    added: '2026-09-23',
  },
  {
    slug: 'dark-patterns',
    title: 'Dark Patterns',
    blurb: 'Eleven tricks, live, done to you',
    description:
      'Eleven manipulative UI patterns — sneaking items into your basket, a countdown that never runs out, a cancellation flow built to exhaust you — reproduced as working fake websites so you feel each one rather than just read about it. Every trick is named the way researchers actually catalogue it.',
    accent: '#1a1206', accent2: '#ffb020',
    category: 'you',
    added: '2026-09-22',
  },
  {
    slug: 'every-second',
    title: 'Every Second, Somewhere',
    blurb: 'A live world, seeded with real numbers',
    description:
      'A genuine Poisson process runs on forty countries’ real population and their real published birth and death rates, so a dot lights up on the map roughly as often as it really would. Watch it at real speed, or fast-forward a day.',
    accent: '#0a1420', accent2: '#f3c667',
    category: 'science',
    added: '2026-09-21',
  },
  {
    slug: 'deep-sea',
    title: 'The Deep Sea',
    blurb: 'Scroll to the bottom of the ocean',
    description:
      'A real linear descent from the sunlit surface to Challenger Deep, 10,935 metres down — the deepest known point in any ocean on Earth. Every creature and every record along the way is real: a documented depth, a surveyed wreck, a dive that actually happened.',
    accent: '#0a1a28', accent2: '#4fe0c4',
    category: 'science',
    added: '2026-09-20',
  },
  {
    slug: 'universe-forecast',
    title: 'Universe Forecast',
    blurb: 'The weather, for the sky',
    description:
      'Every eclipse, solstice, full moon and meteor shower for the next two years, worked out in your browser from the orbits themselves rather than looked up. It can tell a total eclipse from a ring, and it will still be right in 2400.',
    accent: '#0b1030', accent2: '#ffd98a',
    category: 'science',
    added: '2026-09-19',
  },
  {
    slug: 'auction',
    title: 'The Auction Game',
    blurb: 'Fourteen lots. You will overpay.',
    description:
      'Bid against five rivals with their own money and their own bad habits. Real bidding increments, a real 25% buyer’s premium, a secret reserve, and bids the auctioneer takes off the wall. At the end it shows you exactly how you were parted from your money.',
    accent: '#2b1418', accent2: '#c8894a',
    category: 'money',
    added: '2026-09-18',
  },
  {
    slug: 'not-a-robot',
    title: "I'm Not a Robot",
    blurb: 'Twelve checks. It gets personal.',
    description:
      'Prove you are human through twelve escalating checks, while the page quietly measures your tremor, your click rhythm, your typing rhythm and the roundness of your circle. The measurements are real. The verdict is not.',
    accent: '#121430', accent2: '#7a68e8',
    category: 'you',
    added: '2026-09-17',
  },
  {
    slug: 'asteroid',
    title: 'Asteroid Launcher',
    blurb: 'Drop a rock on your own city',
    description:
      'Pick a size, a speed and a target, then watch the crater, the fireball and the blast rings land on a real map. The physics is the peer-reviewed impact model, checked against Chelyabinsk, Tunguska and Chicxulub.',
    accent: '#2a0d08', accent2: '#ff7a33',
    category: 'science',
    added: '2026-09-16',
  },
  {
    slug: 'overstimulated',
    title: 'Overstimulated',
    blurb: 'Every upgrade makes it worse',
    description:
      'A clicker where the things you buy are a progress bar, a bassline, a popup, nineteen extra cursors and a slow rotation of the entire page. There is an off switch. You will want it.',
    accent: '#1b0327', accent2: '#ff4d94',
    category: 'fun',
    added: '2026-09-13',
  },
  {
    slug: 'orbit',
    title: 'Orbit',
    blurb: 'Real gravity, and eight things to attempt in it',
    description:
      'A real n-body gravity sandbox. Every body pulls on every other one, orbits stay stable for minutes, and collisions merge worlds while conserving momentum. Eight challenges to attempt: a circular orbit, a comet, a grazing pass, a binary star, and a genuine gravity assist.',
    accent: '#060a1e', accent2: '#4d7ce8',
    category: 'science',
    added: '2026-09-14',
  },
  {
    slug: 'powder',
    title: 'Powder',
    blurb: 'Thirty-one materials, and eight problems to solve',
    description:
      'A falling-sand sandbox with real emergent chemistry. Oil floats on water. Lava turns sand into glass. Salt kills plants, a spark runs through metal, and thermite burns through everything. Forty-eight reactions to find, and eight scenarios that hand you a grid, take away most of the palette and set you a problem.',
    accent: '#1d1712', accent2: '#d0a86b',
    unlisted: true,
    category: 'fun',
    added: '2026-09-15',
  },
  {
    slug: 'deep-time',
    title: 'Deep Time',
    blurb: 'Scroll through 4.5 billion years',
    description:
      'Every pixel you scroll is a fixed number of years. Fall through the entire history of Earth and find out how recently everything you have ever heard of happened.',
    accent: '#171132', accent2: '#7d4a9e',
    category: 'science',
    added: '2026-09-12',
  },
  {
    slug: 'scale',
    title: 'Scale',
    blurb: 'From a quark to the whole universe',
    description:
      'Zoom out by powers of ten, from the smallest thing physics allows to the edge of the observable universe. Twenty-two thousand pixels of pure perspective.',
    accent: '#04263f', accent2: '#2b9bb3',
    category: 'science',
    added: '2026-09-11',
  },
  {
    slug: 'rule-cascade',
    title: 'Rule Cascade',
    blurb: 'Thirty rules. One of them eats your typing.',
    description:
      'It is just a username field. Then it wants a prime number, then the time, then a chess square. Then a moth gets in and starts eating characters, and a letter of the alphabet is taken away from you permanently. Thirty rules, and none of them ever switches off.',
    accent: '#0d3b2b', accent2: '#5cb872',
    category: 'fun',
    added: '2026-09-10',
  },
  {
    slug: 'spend-it',
    title: 'Spend It',
    blurb: 'You have 100 billion dollars',
    description:
      'Buy sandwiches, islands, aircraft carriers and small countries until the money is gone. It is harder than it sounds.',
    accent: '#0f3d3e', accent2: '#63c9a4',
    category: 'money',
    added: '2026-09-09',
  },
  {
    slug: 'steady-hand',
    title: 'Steady Hand',
    blurb: 'Four shapes, and none of them forgiving',
    description:
      'A line, a circle, a square and a spiral, one unbroken stroke each, nothing traced. Every pixel of wobble is measured and scored, and the four average into one steadiness rating. Nobody is as steady as they think.',
    accent: '#4c1d2e', accent2: '#e8a75c',
    category: 'you',
    added: '2026-09-08',
  },
  {
    slug: 'fusion',
    title: 'Fusion',
    blurb: 'Combine anything with anything',
    description:
      'Start with four things. Drag one onto another and get something new. Every combination anyone has ever made is remembered forever.',
    accent: '#1e1a45', accent2: '#b44cf0',
    unlisted: true,
    category: 'fun',
    added: '2026-09-07',
  },
  {
    slug: 'trolley',
    title: 'Trolley',
    blurb: 'Twenty-six increasingly unreasonable levers',
    description:
      'A runaway trolley and twenty-six choices that get less defensible every time. At the end it scores your answers against four real ethical positions and shows you which one you actually argued for. No invented crowd statistics — the numbers are about you.',
    accent: '#16212e', accent2: '#7d9ec4',
    category: 'you',
    added: '2026-09-06',
  },
  {
    slug: 'paper-folds',
    title: 'Paper Folds',
    blurb: 'Fold it enough and it reaches the Moon',
    description:
      'A sheet of paper is a tenth of a millimetre thick. Fold it in half forty-two times and it reaches the Moon. Watch it happen.',
    accent: '#43310f', accent2: '#c9a13f',
    category: 'fun',
    added: '2026-09-05',
  },
  {
    slug: 'ambient-mix',
    title: 'Ambient Mix',
    blurb: 'Build a soundscape, then send it to someone',
    description:
      'Rain, waves, a coffee shop, a distant lawnmower. Layer them into something calming, or keep going until it is unbearable. Every sound is synthesised live, and the whole mix fits in the link.',
    accent: '#12283c', accent2: '#86bde0',
    category: 'fun',
    added: '2026-09-04',
  },
  {
    slug: 'progress',
    title: 'Progress',
    blurb: 'Everything, ending, live',
    description:
      'How much of this minute, this year, this century is already gone. Updated every frame, which does not help.',
    accent: '#2c1440', accent2: '#a86ede',
    category: 'fun',
    added: '2026-09-03',
  },
  {
    // Deliberately not brand logos: reproducing trademarks is a bad default for
    // a site anyone can clone, and everyday objects are a better test anyway.
    slug: 'from-memory',
    title: 'From Memory',
    blurb: 'Sixteen things you cannot draw',
    description:
      'You have looked at a bicycle every day of your life. Draw one without looking, then see the real thing. Sixteen prompts, ten a sitting — a paperclip, the recycling arrows, a rainbow in the right order. It goes badly for almost everyone.',
    accent: '#3b1338', accent2: '#e0629b',
    category: 'you',
    added: '2026-09-02',
  },
  {
    slug: 'life-in-weeks',
    title: 'Life in Weeks',
    blurb: 'Your whole life on one screen',
    description:
      'Every week you have lived, and every week you probably have left, as a single grid of small squares. It fits on one screen. That is the point.',
    accent: '#221f1a', accent2: '#b0a68c',
    category: 'you',
    added: '2026-09-01',
  },
]

export const listedGames = () => GAMES.filter((g) => !g.unlisted)
export const gameBySlug = (slug: string) => GAMES.find((g) => g.slug === slug)

/** Listed games grouped by category, in CATEGORIES' order, newest first
 *  within each — empty categories are omitted rather than shown as a blank
 *  section. */
export function gamesByCategory(): { key: Category; label: string; note: string; games: Game[] }[] {
  const listed = listedGames().sort((a, b) => b.added.localeCompare(a.added))
  return CATEGORIES.map((c) => ({ ...c, games: listed.filter((g) => g.category === c.key) })).filter(
    (c) => c.games.length > 0,
  )
}
