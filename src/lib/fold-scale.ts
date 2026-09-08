/**
 * fold-scale — how big the stack is, said by putting something next to it.
 *
 * The page used to answer "how tall is it now?" with a gradient rail and seven
 * text labels: PAPER, A HOUSE, SPACE, THE MOON. That is a legend, not a
 * measurement. "Nearest star" written beside a coloured strip tells you a word
 * you already knew; it does not tell you anything about size, because a number
 * with thirty digits in it and a word are the same amount of nothing.
 *
 * So the rail is gone and this is what replaced it: a stack of real objects
 * with real heights, and at any moment the page draws the smallest one the
 * paper has not yet passed — to scale, standing on the same ground, with the
 * paper beside it. Fold twenty-one and the paper is two thirds of the way up
 * the Eiffel Tower. Fold twenty-two and it is past it, the view pulls back,
 * and Everest is standing there instead.
 *
 * Two rules keep it honest.
 *
 * **Every height here is the real one**, in metres, and they are the ordinary
 * published figures: the Eiffel Tower is 330 m to the tip, Everest 8,849 m,
 * the Kármán line 100 km, the Moon 384,400 km away, the observable universe
 * 8.8e26 m across. check-fold-scale.mjs holds a dozen of them to independent
 * values and holds the whole ladder to being sorted and gapped.
 *
 * **The paper's column is a measure, not a picture.** Its height is to scale
 * and its width is not — the true width is in the edge-on inset, where both
 * axes share one scale and the bend can be seen outgrowing the sheet. A column
 * drawn to scale in both directions would be a hair at fold ten and a wall at
 * fold forty, and neither of those is a reading.
 *
 * The silhouettes are authored in a box `w` wide and 100 tall with the ground
 * at y = 100, so the renderer only has to know one number: how many pixels a
 * hundred units is worth.
 */

export type Body =
  | 'earth' | 'moon' | 'sun' | 'star' | 'iss'
  | 'galaxy' | 'nebula' | 'cluster' | 'web' | 'sphere' | 'line'

export type Ref = {
  id: string
  /** Reads after "as tall as" or "as big as". */
  name: string
  /** Metres. The real figure. */
  metres: number
  /** What the height *is*, for the caption: a height, a width, or a distance. */
  says: 'tall' | 'across' | 'away'
} & (
  | {
      /** A thing standing on the ground, drawn from path data. */
      kind: 'stand'
      /** Width of the authoring box; the height is always 100. */
      w: number
      d: string
      /** Optional second path, filled lighter: windows, snow, a rim. */
      detail?: string
      /**
       * What that lighter thing is made of.
       *
       * 'lit' is light coming out of the object — windows, the platforms of a
       * tower — and it is warm. 'pale' is a surface catching what light there
       * is: snow, the face of a coin, the glaze on a mug. Painting snow with
       * the window colour puts a gold hat on Everest, which is how this field
       * came to exist.
       */
      tone?: 'lit' | 'pale'
    }
  | {
      /** A gap between two things: a horizon at the bottom, a marker on top. */
      kind: 'span'
      from: Body
      to: Body
    }
  | {
      /** A thing whose own size is the measure, sitting on the ground. */
      kind: 'body'
      disc: Body
    }
)

/**
 * The ladder.
 *
 * Spaced so that no two rungs are more than about six folds apart — a fold is
 * one click, and a comparison you cannot reach in half a dozen clicks stops
 * feeling like a next step and starts feeling like a wall.
 */
export const REFS: Ref[] = [
  {
    id: 'sand', name: 'a grain of sand', metres: 0.0005, says: 'tall', kind: 'stand',
    w: 122,
    d: 'M4 100 C-2 74 4 44 24 24 C44 -1 86 -6 104 14 C120 30 122 64 112 84 '
      + 'C104 96 96 100 84 100 Z',
    detail: 'M28 34 C38 22 56 16 70 20 C56 22 42 30 34 42 Z',
    tone: 'pale',
  },
  {
    id: 'rice', name: 'a grain of rice', metres: 0.005, says: 'tall', kind: 'stand',
    w: 44,
    d: 'M22 0 C34 8 42 30 42 56 C42 82 34 100 22 100 C10 100 2 82 2 56 C2 30 10 8 22 0 Z',
    detail: 'M14 16 C10 30 8 46 9 62 C6 46 8 28 14 16 Z',
    tone: 'pale',
  },
  {
    id: 'coin', name: 'a coin on its edge', metres: 0.0245, says: 'tall', kind: 'stand',
    w: 100,
    // Four cubics rather than an arc. The arc is shorter and it makes the
    // path unmeasurable: check-fold-scale.mjs walks these to prove every
    // silhouette stands on the ground, and an elliptical arc's extent is not
    // in its endpoints.
    d: 'M50 0 C77.6 0 100 22.4 100 50 C100 77.6 77.6 100 50 100 '
      + 'C22.4 100 0 77.6 0 50 C0 22.4 22.4 0 50 0 Z',
    detail: 'M50 9 C72.6 9 91 27.4 91 50 C91 72.6 72.6 91 50 91 '
      + 'C27.4 91 9 72.6 9 50 C9 27.4 27.4 9 50 9 Z',
    tone: 'pale',
  },
  {
    id: 'mug', name: 'a coffee mug', metres: 0.095, says: 'tall', kind: 'stand',
    w: 134,
    d: 'M18 16 C18 8 36 2 57 2 C78 2 96 8 96 16 L96 92 C96 97 91 100 84 100 '
      + 'L30 100 C23 100 18 97 18 92 Z'
      + 'M94 34 C122 34 132 44 132 57 C132 71 120 82 94 82 L94 73 C113 73 122 66 122 57 '
      + 'C122 48 113 43 94 43 Z',
    detail: 'M25 16 C25 10 40 6 57 6 C74 6 89 10 89 16 C89 22 74 26 57 26 '
      + 'C40 26 25 22 25 16 Z',
    tone: 'pale',
  },
  {
    id: 'pencil', name: 'a pencil', metres: 0.19, says: 'tall', kind: 'stand',
    w: 9,
    d: 'M0 11 C0 5 2 2 4.5 2 C7 2 9 5 9 11 L9 91 L4.5 100 L0 91 Z',
    detail: 'M0 17 L9 17 L9 25 L0 25 Z M2.2 93 L4.5 100 L6.8 93 Z',
  },
  {
    id: 'chair', name: 'a kitchen chair', metres: 0.85, says: 'tall', kind: 'stand',
    w: 58,
    d: 'M6 0 L15 0 L15 60 L52 60 L52 100 L44 100 L44 68 L15 68 L15 100 L6 100 Z',
    detail: 'M6 14 L15 14 L15 20 L6 20 Z M6 32 L15 32 L15 38 L6 38 Z',
    tone: 'pale',
  },
  {
    id: 'person', name: 'a person', metres: 1.75, says: 'tall', kind: 'stand',
    w: 34,
    d: 'M17 1 C21.7 1 25.5 4.8 25.5 9.5 C25.5 14.2 21.7 18 17 18 '
      + 'C12.3 18 8.5 14.2 8.5 9.5 C8.5 4.8 12.3 1 17 1 Z'
      + 'M17 20 C23.6 20 27.6 24.6 28.6 32 L30.8 53 C31.2 57.4 27 58.4 26.2 54.4 '
      + 'L24.6 43.4 L24.6 62 L27.4 96 C27.8 100.4 21.4 101 21 97 L18.4 68 L15.6 68 '
      + 'L13 97 C12.6 101 6.2 100.4 6.6 96 L9.4 62 L9.4 43.4 L7.8 54.4 '
      + 'C7 58.4 2.8 57.4 3.2 53 L5.4 32 C6.4 24.6 10.4 20 17 20 Z',
  },
  {
    id: 'giraffe', name: 'a giraffe', metres: 5.5, says: 'tall', kind: 'stand',
    w: 62,
    d: 'M46 4 C51 4 55 7 55 12 L55 17 L47 17 L44 22 L38 44 C46 47 52 54 53 63 '
      + 'L55 88 L56 100 L50 100 L48 78 L44 100 L38 100 L40 76 L26 76 L24 100 L18 100 '
      + 'L20 74 C14 70 11 64 12 57 L14 46 C15 39 20 35 27 34 L34 33 L38 12 '
      + 'C39 7 42 4 46 4 Z',
    detail: 'M22 44 L28 44 L28 50 L22 50 Z M32 56 L39 56 L39 63 L32 63 Z '
      + 'M20 60 L25 60 L25 66 L20 66 Z M42 50 L48 50 L48 56 L42 56 Z',
    tone: 'pale',
  },
  {
    id: 'house', name: 'a house', metres: 8, says: 'tall', kind: 'stand',
    w: 150,
    d: 'M6 48 L75 4 L102 21 L102 9 L115 9 L115 29 L144 48 L131 48 L131 100 L19 100 '
      + 'L19 48 Z',
    detail: 'M35 58 L57 58 L57 78 L35 78 Z M93 58 L115 58 L115 78 L93 78 Z '
      + 'M64 78 L86 78 L86 100 L64 100 Z',
  },
  {
    id: 'tree', name: 'an oak tree', metres: 25, says: 'tall', kind: 'stand',
    w: 86,
    d: 'M42 6 C62 0 80 12 82 30 C85 48 70 62 48 62 C26 62 12 48 14 30 '
      + 'C16 12 26 10 42 6 Z'
      + 'M38 100 L38 66 C33 58 28 54 25 46 L32 46 C36 54 39 58 41 62 L42 44 L50 44 '
      + 'L49 62 C51 57 55 51 60 44 L67 44 C62 54 55 61 48 68 L48 100 Z',
    detail: 'M30 18 C40 12 54 12 64 18 C52 16 40 16 30 22 Z',
    tone: 'pale',
  },
  {
    id: 'liberty', name: 'the Statue of Liberty', metres: 93, says: 'tall', kind: 'stand',
    w: 46,
    d: 'M2 100 L2 68 L8 68 L8 60 L38 60 L38 68 L44 68 L44 100 Z'
      + 'M16 60 L18 42 C18 36 20 32 22 29 L21 23 C19 23 18 21 18 19 '
      + 'C18 16 20 14 23 14 C26 14 28 16 28 19 C28 21 27 23 25 23 L24 28 L28 26 '
      + 'L30 9 L27 9 L29 2 L32 2 L34 9 L31 9 L32 25 C34 30 32 36 31 42 L32 60 Z',
    detail: 'M17 17 L19 12 L21 17 L23 11 L25 17 L27 12 L29 17 Z '
      + 'M2 72 L44 72 L44 76 L2 76 Z',
    tone: 'pale',
  },
  {
    id: 'eiffel', name: 'the Eiffel Tower', metres: 330, says: 'tall', kind: 'stand',
    w: 38,
    // Traced as one outline rather than as a body with the arch punched out of
    // it: a hole needs an even-odd fill, and even-odd would turn the mug's
    // handle and the tree's canopy into holes as well.
    d: 'M0 100 C2 88 6 86 9 82 C11 76 12.4 70 13.2 64 C14.4 48 15.4 32 16.2 17 '
      + 'L17.4 8 L19 0 L20.6 8 L21.8 17 C22.6 32 23.6 48 24.8 64 C25.6 70 27 76 29 82 '
      + 'C32 86 36 88 38 100 L30 100 C28.6 92 26.4 88 24 84.5 C22 82.6 16 82.6 14 84.5 '
      + 'C11.6 88 9.4 92 8 100 Z',
    detail: 'M6 82 L32 82 L32 85.5 L6 85.5 Z M11.5 62 L26.5 62 L26.5 65 L11.5 65 Z '
      + 'M15.4 15 L22.6 15 L22.6 17.6 L15.4 17.6 Z',
  },
  {
    id: 'burj', name: 'the Burj Khalifa', metres: 828, says: 'tall', kind: 'stand',
    w: 15.5,
    d: 'M0 100 L0 64 L2 64 L2 46 L4 46 L4 31 L5.6 31 L5.6 19 L7.2 19 L7.6 3 '
      + 'L8 19 L9.6 19 L9.6 31 L11.2 31 L11.2 46 L13.2 46 L13.2 64 L15.2 64 '
      + 'L15.2 100 Z',
    detail: 'M0 82 L15.2 82 L15.2 84 L0 84 Z M2 56 L13.2 56 L13.2 58 L2 58 Z '
      + 'M4 38 L11.2 38 L11.2 40 L4 40 Z',
  },
  {
    id: 'everest', name: 'Mount Everest', metres: 8849, says: 'tall', kind: 'stand',
    w: 196,
    d: 'M0 100 L36 61.3 L54 74.2 L76 37.6 L92 13.9 L100 1 L112 18.2 L128 52.7 '
      + 'L146 39.7 L164 67.7 L196 100 Z',
    // A cap that follows the summit ridge and breaks up along its lower edge.
    // Drawn as a lozenge it read as a flag planted on the mountain.
    detail: 'M84 25.8 L92 13.9 L100 1 L112 18.2 L121 36.5 L114 33.3 L108 40.8 '
      + 'L102 31.1 L96 38.7 L90 29 Z',
    tone: 'pale',
  },

  /* Above about ten kilometres nothing stands on the ground any more, so the
     drawings change: a curved horizon at the bottom and something marking the
     top, or a body whose own diameter is the measure. */
  { id: 'karman', name: 'the edge of space', metres: 100_000, says: 'away', kind: 'span', from: 'earth', to: 'line' },
  { id: 'iss', name: "the space station's orbit", metres: 408_000, says: 'away', kind: 'span', from: 'earth', to: 'iss' },
  { id: 'earth', name: 'the width of the Earth', metres: 12_742_000, says: 'across', kind: 'body', disc: 'earth' },
  { id: 'moon', name: 'the way to the Moon', metres: 384_400_000, says: 'away', kind: 'span', from: 'earth', to: 'moon' },
  { id: 'sun', name: 'the Sun', metres: 1.392e9, says: 'across', kind: 'body', disc: 'sun' },
  { id: 'au', name: 'the way to the Sun', metres: 1.496e11, says: 'away', kind: 'span', from: 'sun', to: 'earth' },
  { id: 'neptune', name: "Neptune's orbit", metres: 4.5e12, says: 'away', kind: 'span', from: 'sun', to: 'earth' },
  { id: 'heliopause', name: 'the edge of the solar wind', metres: 1.8e13, says: 'away', kind: 'span', from: 'sun', to: 'line' },
  { id: 'oort', name: 'the Oort cloud', metres: 1.2e15, says: 'across', kind: 'body', disc: 'sphere' },
  { id: 'proxima', name: 'the way to the nearest star', metres: 4.0e16, says: 'away', kind: 'span', from: 'sun', to: 'star' },
  { id: 'orion', name: 'the Orion Nebula', metres: 2.3e17, says: 'across', kind: 'body', disc: 'nebula' },
  { id: 'betelgeuse', name: 'the way to Betelgeuse', metres: 6.2e18, says: 'away', kind: 'span', from: 'sun', to: 'star' },
  { id: 'core', name: 'the way to the galactic centre', metres: 2.5e20, says: 'away', kind: 'span', from: 'star', to: 'galaxy' },
  { id: 'milkyway', name: 'the Milky Way', metres: 1.0e21, says: 'across', kind: 'body', disc: 'galaxy' },
  { id: 'andromeda', name: 'the way to Andromeda', metres: 2.4e22, says: 'away', kind: 'span', from: 'galaxy', to: 'galaxy' },
  { id: 'virgo', name: 'the Virgo Supercluster', metres: 3.3e23, says: 'across', kind: 'body', disc: 'cluster' },
  { id: 'wall', name: 'the Sloan Great Wall', metres: 1.4e25, says: 'across', kind: 'body', disc: 'web' },
  { id: 'universe', name: 'the observable universe', metres: 8.8e26, says: 'across', kind: 'body', disc: 'sphere' },
]

/** The smallest thing the paper has not yet grown past. */
export function target(metres: number): Ref {
  for (const r of REFS) if (r.metres > metres) return r
  return REFS[REFS.length - 1]
}

/** Everything it has, largest first. */
export function passed(metres: number): Ref[] {
  return REFS.filter((r) => r.metres <= metres).reverse()
}

/**
 * How much world the frame shows, in metres.
 *
 * Enough headroom over the thing being climbed toward that its top is inside
 * the frame, and never less than the paper itself needs. It steps when the
 * target changes — by a factor of three to a thousand — and the page eases it
 * in log space, which turns each overtake into the view pulling back rather
 * than into a cut.
 */
export function worldHeight(metres: number): number {
  return Math.max(metres * 1.3, target(metres).metres * 1.19)
}

/** "62% of it", or "3.4 × it" once it is past. */
export function relation(metres: number, r: Ref): string {
  const k = metres / r.metres
  if (k >= 1) return (k < 10 ? k.toFixed(1) : Math.round(k).toLocaleString('en-US')) + ' × it'
  if (k >= 0.01) return Math.round(k * 100) + '% of it'
  if (k >= 0.0001) return (k * 100).toFixed(2) + '% of it'
  return 'a rounding error next to it'
}

/** "as tall as" / "as wide as" / "as far as". */
export const leadIn = (r: Ref) =>
  r.says === 'tall' ? 'as tall as' : r.says === 'across' ? 'as wide as' : 'as far as'
