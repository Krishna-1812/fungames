/**
 * The game registry — the single source of truth for the homepage grid, every
 * <head>, and the sitemap. Adding a game means one entry here plus one file in
 * src/pages/.
 *
 * `art` picks the tile illustration (see components/TileArt.astro), so a new
 * game looks deliberate on the grid without opening a design tool.
 */
export type TileArt =
  | 'strata'   // stacked geological bands
  | 'checklist'// a list that will not end
  | 'stroke'   // one wobbling hand-drawn line
  | 'orbit'    // two bodies merging
  | 'rings'    // concentric scale
  | 'stacks'   // columns of money
  | 'fold'     // paper folded on itself
  | 'bars'     // progress meters
  | 'waves'    // overlapping sound
  | 'tracks'   // a fork in the rails
  | 'sketch'   // a half-remembered scribble
  | 'grid'     // a life, counted out
  | 'powder'   // grains piling up
  | 'orbit2'   // bodies on a trajectory
  | 'chaos'    // everything at once
  | 'impact'   // concentric damage rings
  | 'verify'   // a checkbox grid, half ticked
  | 'gavel'    // a hammer coming down on a rising price

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
  glyph: string
  art: TileArt
  /** Hidden from the grid but still routable, like neal.fun's archive pages. */
  unlisted?: boolean
  /** ISO date. Newest first controls grid order. */
  added: string
}

export const GAMES: Game[] = [
  {
    slug: 'auction',
    title: 'The Auction Game',
    blurb: 'Fourteen lots. You will overpay.',
    description:
      'Bid against five rivals with their own money and their own bad habits. Real bidding increments, a real 25% buyer’s premium, a secret reserve, and bids the auctioneer takes off the wall. At the end it shows you exactly how you were parted from your money.',
    accent: '#2b1418', accent2: '#c8894a', glyph: '🔨', art: 'gavel',
    added: '2026-09-18',
  },
  {
    slug: 'not-a-robot',
    title: "I'm Not a Robot",
    blurb: 'Twelve checks. It gets personal.',
    description:
      'Prove you are human through twelve escalating checks, while the page quietly measures your tremor, your click rhythm, your typing rhythm and the roundness of your circle. The measurements are real. The verdict is not.',
    accent: '#101a33', accent2: '#5b8def', glyph: '🤖', art: 'verify',
    added: '2026-09-17',
  },
  {
    slug: 'asteroid',
    title: 'Asteroid Launcher',
    blurb: 'Drop a rock on your own city',
    description:
      'Pick a size, a speed and a target, then watch the crater, the fireball and the blast rings land on a real map. The physics is the peer-reviewed impact model, checked against Chelyabinsk, Tunguska and Chicxulub.',
    accent: '#2a0d08', accent2: '#ff7a33', glyph: '☄️', art: 'impact',
    added: '2026-09-16',
  },
  {
    slug: 'overstimulated',
    title: 'Overstimulated',
    blurb: 'Every upgrade makes it worse',
    description:
      'A clicker where the things you buy are a progress bar, a bassline, a popup, nineteen extra cursors and a slow rotation of the entire page. There is an off switch. You will want it.',
    accent: '#1b0327', accent2: '#ff4d94', glyph: '🤯', art: 'chaos',
    added: '2026-09-13',
  },
  {
    slug: 'orbit',
    title: 'Orbit',
    blurb: 'Real gravity, and eight things to attempt in it',
    description:
      'A real n-body gravity sandbox. Every body pulls on every other one, orbits stay stable for minutes, and collisions merge worlds while conserving momentum. Eight challenges to attempt: a circular orbit, a comet, a grazing pass, a binary star, and a genuine gravity assist.',
    accent: '#060a1e', accent2: '#4d7ce8', glyph: '🪐', art: 'orbit2',
    added: '2026-09-14',
  },
  {
    slug: 'powder',
    title: 'Powder',
    blurb: 'Thirty-one materials, and eight problems to solve',
    description:
      'A falling-sand sandbox with real emergent chemistry. Oil floats on water. Lava turns sand into glass. Salt kills plants, a spark runs through metal, and thermite burns through everything. Forty-eight reactions to find, and eight scenarios that hand you a grid, take away most of the palette and set you a problem.',
    accent: '#1a120c', accent2: '#e8813c', glyph: '⏳', art: 'powder',
    added: '2026-09-15',
  },
  {
    slug: 'deep-time',
    title: 'Deep Time',
    blurb: 'Scroll through 4.5 billion years',
    description:
      'Every pixel you scroll is a fixed number of years. Fall through the entire history of Earth and find out how recently everything you have ever heard of happened.',
    accent: '#171132', accent2: '#7d4a9e', glyph: '🌍', art: 'strata',
    added: '2026-09-12',
  },
  {
    slug: 'scale',
    title: 'Scale',
    blurb: 'From a quark to the whole universe',
    description:
      'Zoom out by powers of ten, from the smallest thing physics allows to the edge of the observable universe. Twenty-two thousand pixels of pure perspective.',
    accent: '#04263f', accent2: '#2b9bb3', glyph: '🔭', art: 'rings',
    added: '2026-09-11',
  },
  {
    slug: 'rule-cascade',
    title: 'Rule Cascade',
    blurb: 'Thirty rules. One of them eats your typing.',
    description:
      'It is just a username field. Then it wants a prime number, then the time, then a chess square. Then a moth gets in and starts eating characters, and a letter of the alphabet is taken away from you permanently. Thirty rules, and none of them ever switches off.',
    accent: '#0d3b2b', accent2: '#5cb872', glyph: '📋', art: 'checklist',
    added: '2026-09-10',
  },
  {
    slug: 'spend-it',
    title: 'Spend It',
    blurb: 'You have 100 billion dollars',
    description:
      'Buy sandwiches, islands, aircraft carriers and small countries until the money is gone. It is harder than it sounds.',
    accent: '#0f3d3e', accent2: '#63c9a4', glyph: '💸', art: 'stacks',
    added: '2026-09-09',
  },
  {
    slug: 'steady-hand',
    title: 'Steady Hand',
    blurb: 'How straight is your line, really?',
    description:
      'Draw one unbroken stroke between two dots. Every pixel of wobble is measured and scored. Nobody is as steady as they think.',
    accent: '#4c1d2e', accent2: '#e8a75c', glyph: '✍️', art: 'stroke',
    added: '2026-09-08',
  },
  {
    slug: 'fusion',
    title: 'Fusion',
    blurb: 'Combine anything with anything',
    description:
      'Start with four things. Drag one onto another and get something new. Every combination anyone has ever made is remembered forever.',
    accent: '#1e1a45', accent2: '#b44cf0', glyph: '⚗️', art: 'orbit',
    added: '2026-09-07',
  },
  {
    slug: 'trolley',
    title: 'Trolley',
    blurb: 'Twenty-six increasingly unreasonable levers',
    description:
      'A runaway trolley and twenty-six choices that get less defensible every time. At the end it scores your answers against four real ethical positions and shows you which one you actually argued for. No invented crowd statistics — the numbers are about you.',
    accent: '#3d1f14', accent2: '#d97742', glyph: '🚋', art: 'tracks',
    added: '2026-09-06',
  },
  {
    slug: 'paper-folds',
    title: 'Paper Folds',
    blurb: 'Fold it enough and it reaches the Moon',
    description:
      'A sheet of paper is a tenth of a millimetre thick. Fold it in half forty-two times and it reaches the Moon. Watch it happen.',
    accent: '#43310f', accent2: '#c9a13f', glyph: '📄', art: 'fold',
    added: '2026-09-05',
  },
  {
    slug: 'ambient-mix',
    title: 'Ambient Mix',
    blurb: 'Build a soundscape, then ruin it',
    description:
      'Rain, waves, a coffee shop, a distant lawnmower. Layer them into something calming, or keep going until it is unbearable. Every sound is synthesised live.',
    accent: '#132a3f', accent2: '#5a9fd4', glyph: '🎧', art: 'waves',
    added: '2026-09-04',
  },
  {
    slug: 'progress',
    title: 'Progress',
    blurb: 'Everything, ending, live',
    description:
      'How much of this minute, this year, this century is already gone. Updated every frame, which does not help.',
    accent: '#2c1440', accent2: '#a86ede', glyph: '⏳', art: 'bars',
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
    accent: '#3b1338', accent2: '#e0629b', glyph: '🎨', art: 'sketch',
    added: '2026-09-02',
  },
  {
    slug: 'life-in-weeks',
    title: 'Life in Weeks',
    blurb: 'Your whole life on one screen',
    description:
      'Every week you have lived, and every week you probably have left, as a single grid of small squares. It fits on one screen. That is the point.',
    accent: '#1b1f2e', accent2: '#8fa2c4', glyph: '🗓️', art: 'grid',
    added: '2026-09-01',
  },
]

export const listedGames = () => GAMES.filter((g) => !g.unlisted)
export const gameBySlug = (slug: string) => GAMES.find((g) => g.slug === slug)
