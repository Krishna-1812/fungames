/**
 * From Memory's prompt pool.
 *
 * Deliberately ordinary objects rather than brand logos: it avoids reproducing
 * trademarks, and the effect is stronger anyway. Almost nobody can draw a
 * working bicycle, which is a genuine documented phenomenon, and the same turns
 * out to be true of a paperclip.
 *
 * Every reference is hand-authored SVG in a shared 200×140 viewBox so the
 * overlay lines up with the drawing canvas exactly. That only works if the
 * shapes actually stay inside the box, which is not something you can see by
 * reading a path — scripts/check-memory.mjs parses the coordinates and checks.
 */

export type Item = {
  id: string
  prompt: string
  reveal: string
  /** What people get wrong, and why. Shown after the reveal. */
  fact: string
  svg: string
}

export const ITEMS: Item[] = [
  {
    id: 'bicycle',
    prompt: 'A bicycle',
    reveal: 'A bicycle',
    fact: 'In a study of 376 people, most drew a frame that could not physically work — usually the chain or the front fork.',
    svg: `<circle cx="46" cy="100" r="30"/><circle cx="154" cy="100" r="30"/>
          <path d="M46 100 L82 54 L128 54 L154 100 M82 54 L110 100 L154 100"/>
          <path d="M82 54 L74 40 M63 38 L85 38"/>
          <path d="M128 54 L136 39 M126 36 L150 36"/>
          <circle cx="110" cy="100" r="6"/>`,
  },
  {
    id: 'clock',
    prompt: 'A clock face showing twenty to four',
    reveal: 'Twenty to four',
    fact: 'Most people draw the hour hand pointing exactly at the 3. At 3:40 it has already moved two thirds of the way to the 4.',
    svg: `<circle cx="100" cy="70" r="54"/>
          <path d="M100 22 v8 M148 70 h-8 M100 118 v-8 M52 70 h8"/>
          <path d="M100 70 L133 82" stroke-width="4"/>
          <path d="M100 70 L61 93"/>
          <circle cx="100" cy="70" r="3.5" fill="currentColor"/>`,
  },
  {
    id: 'dipper',
    prompt: 'The Big Dipper',
    reveal: 'The Big Dipper',
    fact: 'Seven stars. The two at the end of the bowl point almost exactly at Polaris.',
    svg: `<circle cx="32" cy="96" r="4" fill="currentColor"/><circle cx="66" cy="106" r="4" fill="currentColor"/>
          <circle cx="100" cy="100" r="4" fill="currentColor"/><circle cx="124" cy="78" r="4" fill="currentColor"/>
          <circle cx="150" cy="60" r="4" fill="currentColor"/><circle cx="152" cy="30" r="4" fill="currentColor"/>
          <circle cx="118" cy="34" r="4" fill="currentColor"/>
          <path d="M32 96 L66 106 L100 100 L124 78 L150 60 L152 30 L118 34 L124 78" stroke-dasharray="3 4"/>`,
  },
  {
    id: 'key',
    prompt: 'A house key',
    reveal: 'A house key',
    fact: 'The teeth go on one edge only, and the bow is usually much larger than people remember.',
    svg: `<circle cx="48" cy="70" r="22"/><circle cx="48" cy="70" r="9"/>
          <path d="M70 70 H160"/>
          <path d="M120 70 v16 M134 70 v20 M148 70 v14"/>`,
  },
  {
    id: 'umbrella',
    prompt: 'An open umbrella',
    reveal: 'An open umbrella',
    fact: 'The canopy is made of scalloped panels, and the handle almost always curves the wrong way in drawings.',
    svg: `<path d="M22 78 A78 78 0 0 1 178 78"/>
          <path d="M22 78 q19 22 39 0 q19 22 39 0 q19 22 39 0 q19 22 39 0"/>
          <path d="M100 78 V116 a14 14 0 0 0 28 0"/>
          <path d="M100 78 V16"/>`,
  },
  {
    id: 'bulb',
    prompt: 'A light bulb',
    reveal: 'A light bulb',
    fact: 'The screw thread is a spiral, not a stack of rings, and the glass narrows into a neck before it starts.',
    svg: `<path d="M100 16 a38 38 0 0 1 22 68 q-6 5 -6 12 h-32 q0 -7 -6 -12 a38 38 0 0 1 22 -68 Z"/>
          <path d="M84 100 h32 M84 108 h32 M88 116 h24"/>
          <path d="M92 84 q8 -18 16 0" stroke-dasharray="3 3"/>`,
  },
  {
    id: 'boat',
    prompt: 'A sailboat',
    reveal: 'A sailboat',
    fact: 'Two sails: a large one behind the mast and a smaller triangle in front of it.',
    svg: `<path d="M34 104 h132 l-18 22 H52 Z"/>
          <path d="M100 100 V16"/>
          <path d="M104 96 V26 L150 96 Z"/>
          <path d="M96 96 V30 L58 96 Z"/>`,
  },
  {
    id: 'peace',
    prompt: 'The peace symbol',
    reveal: 'The peace symbol',
    fact: 'The two lower strokes go down and outwards. Drawing them as a Y pointing up is the most common mistake.',
    svg: `<circle cx="100" cy="70" r="54"/>
          <path d="M100 16 V124 M100 70 L62 108 M100 70 L138 108"/>`,
  },

  /* ---------------------------------------------------------------------- */

  {
    id: 'paperclip',
    prompt: 'A paperclip',
    reveal: 'A paperclip',
    fact: 'One wire, two U-turns, and the inner loop finishes inside the outer one. Nearly everybody draws a spiral instead.',
    svg: `<path d="M68 118 V42 a24 24 0 0 1 48 0 V104 a16 16 0 0 1 -32 0 V62"/>`,
  },
  {
    id: 'recycling',
    prompt: 'The recycling symbol',
    reveal: 'The recycling symbol',
    fact: 'Three arrows chasing each other, and one of them is folded the other way — it is a Möbius strip, which is the whole idea.',
    svg: `<path d="M60 110 L88 54"/><path d="M94 42 L81 51 L94 58 Z" fill="currentColor"/>
          <path d="M112 54 L136 102"/><path d="M140 110 L127 101 L140 94 Z" fill="currentColor"/>
          <path d="M130 120 L82 120"/><path d="M68 120 L82 113 L82 127 Z" fill="currentColor"/>`,
  },
  {
    id: 'scissors',
    prompt: 'A pair of scissors',
    reveal: 'A pair of scissors',
    fact: 'The two handle loops are different sizes — the lower one takes three fingers — and the pivot sits nearer the blades than the middle.',
    svg: `<circle cx="108" cy="74" r="4" fill="currentColor"/>
          <path d="M108 74 L176 40 M108 74 L176 56"/>
          <path d="M108 74 L58 88 M108 74 L54 112"/>
          <ellipse cx="44" cy="84" rx="14" ry="11" transform="rotate(-20 44 84)"/>
          <ellipse cx="38" cy="118" rx="17" ry="13" transform="rotate(-20 38 118)"/>`,
  },
  {
    id: 'anchor',
    prompt: 'A ship’s anchor',
    reveal: 'A ship’s anchor',
    fact: 'The crossbar sits near the top, not the middle, and it lies at right angles to the arms so the anchor cannot land flat.',
    svg: `<circle cx="100" cy="22" r="10"/>
          <path d="M100 32 V118"/>
          <path d="M72 48 H128"/>
          <path d="M100 118 c-26 0 -38 -16 -40 -34"/>
          <path d="M100 118 c26 0 38 -16 40 -34"/>
          <path d="M60 84 l-10 -2 l8 -10"/>
          <path d="M140 84 l10 -2 l-8 -10"/>`,
  },
  {
    id: 'guitar',
    prompt: 'An acoustic guitar',
    reveal: 'An acoustic guitar',
    fact: 'Six strings and six tuning pegs, three a side. The sound hole sits under the neck end of the body, not in the middle.',
    svg: `<path d="M30 70 C30 44 52 36 72 40 C84 44 86 52 96 52
                   C108 52 114 58 114 70 C114 82 108 88 96 88
                   C86 88 84 96 72 100 C52 104 30 96 30 70 Z"/>
          <circle cx="94" cy="70" r="9"/>
          <path d="M114 62 H156 M114 78 H156"/>
          <path d="M156 54 h24 v32 h-24 z"/>
          <circle cx="162" cy="62" r="2.5" fill="currentColor"/>
          <circle cx="169" cy="62" r="2.5" fill="currentColor"/>
          <circle cx="176" cy="62" r="2.5" fill="currentColor"/>
          <circle cx="162" cy="78" r="2.5" fill="currentColor"/>
          <circle cx="169" cy="78" r="2.5" fill="currentColor"/>
          <circle cx="176" cy="78" r="2.5" fill="currentColor"/>`,
  },
  {
    id: 'safetypin',
    prompt: 'A safety pin, open',
    reveal: 'A safety pin',
    fact: 'The coil at one end is the spring — it is what holds the point in the clasp. Without it the pin is just bent wire.',
    // The pin and the body have to run parallel and meet only at the clasp.
    // Letting them converge along their whole length drew a closed wedge, which
    // is not a thing anybody recognises.
    svg: `<circle cx="46" cy="98" r="16"/>
          <path d="M46 82 H142"/>
          <path d="M46 114 H140 a16 16 0 0 0 16 -16 V86"/>
          <path d="M156 86 a10 10 0 0 0 -10 -10 h-8"/>`,
  },
  {
    id: 'glasses',
    prompt: 'A pair of glasses',
    reveal: 'A pair of glasses',
    fact: 'The arms join the lenses at the top corner, not the middle, and the bridge sits high — level with the top of the lenses.',
    svg: `<circle cx="64" cy="74" r="26"/>
          <circle cx="136" cy="74" r="26"/>
          <path d="M90 66 q10 -7 20 0"/>
          <path d="M38 62 L16 46"/>
          <path d="M162 62 L184 46"/>`,
  },
  {
    id: 'rainbow',
    prompt: 'A rainbow',
    reveal: 'A rainbow',
    fact: 'Red is on the outside and violet on the inside — the opposite of how most people draw it.',
    svg: `<path d="M20 124 a80 80 0 0 1 160 0" stroke="#d94040"/>
          <path d="M26 124 a74 74 0 0 1 148 0" stroke="#e08a3c"/>
          <path d="M32 124 a68 68 0 0 1 136 0" stroke="#d8bd45"/>
          <path d="M38 124 a62 62 0 0 1 124 0" stroke="#4fa04f"/>
          <path d="M44 124 a56 56 0 0 1 112 0" stroke="#3f6fc0"/>
          <path d="M50 124 a50 50 0 0 1 100 0" stroke="#5a4fa0"/>
          <path d="M56 124 a44 44 0 0 1 88 0" stroke="#8f4fa0"/>`,
  },
]

/** How many prompts one sitting asks for. */
export const ROUND_SIZE = 10

/**
 * Ten of the sixteen, with the bicycle always first.
 *
 * The bicycle is the hook — it is the one with the study behind it and the one
 * that makes people call someone over — so it is never left out. The other nine
 * are drawn from the rest, which means the pool is worth more than a fixed list
 * of the same ten every time.
 */
export function pickRound(rand: () => number = Math.random): Item[] {
  const [first, ...rest] = ITEMS
  const pool = rest.slice()
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return [first, ...pool.slice(0, ROUND_SIZE - 1)]
}
