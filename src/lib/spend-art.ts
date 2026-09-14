/**
 * Product illustrations for Spend It — one bespoke drawing per thing you can buy.
 *
 * Why these exist at all, when lib/icons.ts already draws a burger and a yacht:
 * those are *glyphs*. They are drawn on a 24-unit grid to survive being
 * rendered at 26 pixels in a table row, which means one flat fill per shape
 * and no detail that would turn to mud at that size. Spend It is the one page
 * where the thing you are buying is the whole point of the card, and a 34px
 * glyph floating in a 184px card is what made this page read as a settings
 * screen rather than a shop. The real reference (neal.fun's own Spend Bill
 * Gates' Money) puts a large photograph of the actual product on every card.
 * Photographs of branded goods are not an option here — the site deliberately
 * draws everything itself and deliberately avoids trademarks — so the answer
 * is our own artwork at the size the card actually wants.
 *
 * So: a 120-unit square stage, drawn to be looked at at ~110px rather than
 * survive at 26px. Three tones minimum on any solid form (a base, a shadow
 * side and a highlight), a real ground shadow so the thing sits somewhere
 * rather than floating, and enough small true detail — a sesame seed, a
 * rigging line, a wheel arch — to reward the size it is given.
 *
 * Conventions, all enforced by scripts/check-spend-art.mjs:
 *  - viewBox is `0 0 120 120` for every drawing, so cards are interchangeable.
 *  - The ground shadow sits at y ≈ 104; objects stand on it.
 *  - `palette` lists every colour the drawing uses, and nothing else.
 *  - `draw()` is deterministic: same output string, every time, forever.
 *  - Every `id=` is prefixed with the item's key, because all thirty of these
 *    inline into one document and SVG ids are global to it.
 */

export type Product = {
  /** What it depicts, in words. For the checker's report and the next editor. */
  subject: string
  /** Every colour the drawing uses. The checker fails on any colour not listed. */
  palette: string[]
  /** Inner SVG markup on a 0 0 120 120 grid. Deterministic. */
  draw: () => string
}

/* ---- shared plumbing ---------------------------------------------------- */

/** Deterministic pseudo-random in [0,1), so scatter is stable across renders. */
export const rnd = (seed: number, k: number) => {
  const x = Math.sin(seed * 9301 + k * 49297) * 233280
  return x - Math.floor(x)
}

const n = (v: number) => (Math.round(v * 10) / 10).toString()

/**
 * The soft ellipse every product stands on. Not decoration: without it each
 * drawing floats in the middle of a white card with nothing to say how big it
 * is or which way is down, which is most of the difference between "an icon"
 * and "a product shot".
 */
export const shadow = (cx: number, cy: number, rx: number, ry: number, fill: string) =>
  `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${n(ry)}" fill="${fill}" opacity="0.28"/>`

/** The shadow tone used under every product — one colour, so the set agrees. */
export const SHADOW = '#b9c6c2'

export const SPEND_ART: Record<string, Product> = {
  /* ---- Big Mac ---------------------------------------------------------- */
  'Big Mac': {
    subject: 'a stacked burger in section — sesame bun, two patties, cheese, lettuce',
    palette: [SHADOW, '#e8a94e', '#d9933a', '#f2c273', '#6b4423', '#8a5a2f', '#f7d154', '#7fb04a', '#c8412f', '#fffdf6'],
    draw: () => {
      // Sesame seeds are placed on a fixed arc rather than scattered randomly:
      // a real bun has them spread over the dome, and a seeded scatter put
      // three of them on the silhouette edge where they read as chips out of it.
      const seeds = [
        [46, 34], [56, 30], [67, 32], [51, 40], [62, 38], [73, 39],
      ]
        .map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="2.6" ry="1.5" fill="#fffdf6" opacity="0.92" transform="rotate(-18 ${x} ${y})"/>`)
        .join('')
      return `
      ${shadow(60, 104, 34, 5, SHADOW)}
      <!-- top bun: a dome with a lit crown and a shaded underside -->
      <path d="M24 46c0-14 16-24 36-24s36 10 36 24c0 3-2 5-6 5H30c-4 0-6-2-6-5Z" fill="#e8a94e"/>
      <path d="M24 46c0-14 16-24 36-24 6 0 12 1 17 3-14 1-25 5-32 12-5 5-8 10-9 15h-6c-4 0-6-2-6-5Z" fill="#f2c273"/>
      ${seeds}
      <!-- lettuce -->
      <path d="M26 51c5 4 9 1 13 4s8 1 12 4 9 0 13 3 9-1 13 2 8-2 12 1l-2 5H28Z" fill="#7fb04a"/>
      <!-- cheese, with the corner droop that says it has melted -->
      <path d="M28 60h64l-4 7-9-4-8 6-9-5-8 5-9-5-9 4Z" fill="#f7d154"/>
      <!-- patty -->
      <rect x="27" y="66" width="66" height="9" rx="4.5" fill="#6b4423"/>
      <rect x="27" y="66" width="66" height="3.4" rx="1.7" fill="#8a5a2f"/>
      <!-- tomato -->
      <path d="M31 77h58c2 0 2 4 0 4H31c-2 0-2-4 0-4Z" fill="#c8412f"/>
      <!-- bottom bun -->
      <path d="M28 82h64c3 0 5 3 5 6 0 5-5 9-12 9H35c-7 0-12-4-12-9 0-3 2-6 5-6Z" fill="#d9933a"/>
      <path d="M28 82h64c3 0 5 3 5 6H23c0-3 2-6 5-6Z" fill="#e8a94e"/>`
    },
  },

  /* ---- Grand piano ------------------------------------------------------- */
  'Grand piano': {
    subject: 'a grand piano seen from above-left, lid raised on its stick, keys along the front',
    palette: [SHADOW, '#1b1b1f', '#33333a', '#4a4a54', '#0e0e11', '#fdfcf8', '#c9c9cf'],
    draw: () => {
      // White keys are drawn as one bar with dark gaps rather than 20 separate
      // rects: at this size the gaps are the thing you actually see, and the
      // black keys can then sit on top without fighting a seam for each one.
      const gaps = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
        .map((i) => `<rect x="${n(30 + i * 5.2)}" y="78" width="0.9" height="11" fill="#c9c9cf"/>`)
        .join('')
      const blacks = [0.7, 1.7, 3.7, 4.7, 5.7, 7.7, 8.7]
        .map((i) => `<rect x="${n(30 + i * 5.2 + 2.6)}" y="78" width="2.6" height="7" rx="0.6" fill="#0e0e11"/>`)
        .join('')
      return `
      ${shadow(62, 103, 40, 5, SHADOW)}
      <!-- raised lid, the wing shape seen slightly from the left -->
      <path d="M26 74 28 30c0-4 4-7 9-6l52 9c9 2 14 9 12 17-2 9-11 15-23 14L26 74Z" fill="#33333a"/>
      <path d="M28 30c0-4 4-7 9-6l52 9c9 2 14 9 12 17-1 3-3 6-6 8 2-7-2-13-10-15L28 33Z" fill="#4a4a54"/>
      <!-- the lid stick -->
      <rect x="72" y="26" width="2" height="22" rx="1" transform="rotate(9 73 37)" fill="#1b1b1f"/>
      <!-- case -->
      <path d="M24 74h74c2 0 3 2 3 4v6c0 2-1 4-3 4H24c-2 0-3-2-3-4v-6c0-2 1-4 3-4Z" fill="#1b1b1f"/>
      <!-- keyboard -->
      <rect x="28" y="77" width="60" height="13" rx="1.6" fill="#fdfcf8"/>
      ${gaps}
      ${blacks}
      <!-- legs -->
      <rect x="30" y="90" width="4" height="12" rx="1.4" fill="#1b1b1f"/>
      <rect x="86" y="90" width="4" height="12" rx="1.4" fill="#1b1b1f"/>`
    },
  },
}

/** One product as a complete inline `<svg>`, filling whatever box it is given. */
export function productSvg(name: string): string {
  const p = SPEND_ART[name]
  if (!p) return ''
  return (
    `<svg viewBox="0 0 120 120" style="width:100%;height:100%;display:block" ` +
    `aria-hidden="true" focusable="false">${p.draw()}</svg>`
  )
}

export const productNames = () => Object.keys(SPEND_ART)
