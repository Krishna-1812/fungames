/**
 * What the sheet is as tall as, fold by fold.
 *
 * Out here rather than in the page's frontmatter so scripts/check-icons.mjs
 * can read it: every mark names an icon, and the checker fails if one has no
 * drawing.
 */
export type Mark = {
  /** The fold this comparison starts being true at. */
  at: number
  text: string
  /** Key into lib/icons.ts. */
  icon: string
}

// Chosen so a comparison lands every few folds and each one is a real figure.
export const MARKS: Mark[] = [
  { at: 0, text: 'A single sheet of paper.', icon: 'sheet' },
  { at: 3, text: 'About as thick as a credit card.', icon: 'credit-card' },
  { at: 7, text: 'A stack of Lego bricks.', icon: 'lego' },
  { at: 10, text: 'Roughly a coffee mug.', icon: 'coffee' },
  { at: 13, text: 'Taller than a toddler.', icon: 'toddler' },
  { at: 16, text: 'A two-storey house.', icon: 'house' },
  { at: 20, text: 'Taller than the Statue of Liberty.', icon: 'statue' },
  { at: 23, text: 'Taller than the Burj Khalifa, the tallest building on Earth.', icon: 'skyline' },
  { at: 27, text: 'Higher than a passenger jet cruises.', icon: 'airliner' },
  { at: 30, text: 'Past the Kármán line. This is space now.', icon: 'satellite' },
  { at: 34, text: 'Longer than Great Britain.', icon: 'map' },
  { at: 37, text: 'Wider than the Earth.', icon: 'earth' },
  { at: 42, text: 'It reaches the Moon.', icon: 'moon' },
  { at: 51, text: 'Past the Sun.', icon: 'sun' },
  { at: 60, text: 'Well beyond Pluto and out of the solar system.', icon: 'ringed-planet' },
  { at: 69, text: 'Past Proxima Centauri, the nearest star.', icon: 'star' },
  { at: 83, text: 'Across the entire Milky Way.', icon: 'galaxy' },
  { at: 92, text: 'Beyond the Local Group of galaxies.', icon: 'galaxies' },
  { at: 103, text: 'Larger than the observable universe. Please stop.', icon: 'universe' },
]
