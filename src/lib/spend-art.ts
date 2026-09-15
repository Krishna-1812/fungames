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
  'Latte': {
    subject: 'a ceramic cup of latte on a saucer, a foam heart poured on the crema, steam rising',
    palette: [SHADOW, '#ffffff', '#f4f1e9', '#e8e3d5', '#d5d0c2', '#b6b0a0', '#c98f4f', '#a86b33'],
    draw: () => `
      ${shadow(60, 104, 38, 5, SHADOW)}
      <!-- saucer: a rim seen edge-on, a near half in shade, a lit far half -->
      <ellipse cx="60" cy="97.6" rx="40" ry="9" fill="#b6b0a0"/>
      <ellipse cx="60" cy="95" rx="40" ry="9" fill="#d5d0c2"/>
      <path d="M20 95A40 9 0 0 1 100 95Z" fill="#f4f1e9"/>
      <ellipse cx="60" cy="95.2" rx="23" ry="5" fill="#e8e3d5"/>
      <path d="M37 95.2A23 5 0 0 1 83 95.2Z" fill="#d5d0c2"/>
      <!-- handle first, so the body covers where it joins the wall -->
      <path d="M84 61C99 60 101 80 82 84.5" fill="none" stroke="#d5d0c2" stroke-width="8" stroke-linecap="round"/>
      <path d="M84 61C98 60.4 100 79 82 83" fill="none" stroke="#f4f1e9" stroke-width="4.6" stroke-linecap="round"/>
      <path d="M86 63.4C95.5 64 97.5 76 87 79.5" fill="none" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round"/>
      <!-- cup wall: base, the shaded right flank, a highlight down the left -->
      <path d="M33 55C34 73 39 86 46 91c6 3.5 22 3.5 28 0 7-5 12-18 13-36Z" fill="#f4f1e9"/>
      <path d="M87 55c-1 18-6 31-13 36-2.5 1.5-6 2.4-9.5 2.8C72 87 78.5 73 79.5 55Z" fill="#d5d0c2"/>
      <path d="M38.6 57c.6 15 4.4 27 10 32.6-2 .8-3.8.6-5.2-.6-5-5.6-7.8-18-8.2-32Z" fill="#ffffff"/>
      <!-- rim, then the crema, with the far wall's shadow cast across it -->
      <ellipse cx="60" cy="55" rx="27" ry="7.6" fill="#ffffff"/>
      <ellipse cx="60" cy="55.4" rx="25.2" ry="6.9" fill="#e8e3d5"/>
      <ellipse cx="60" cy="55.8" rx="23.4" ry="6.2" fill="#c98f4f"/>
      <path d="M36.6 55.8A23.4 6.2 0 0 1 83.4 55.8Z" fill="#a86b33"/>
      <!-- the poured heart, squashed onto the surface the way the ellipse is -->
      <g transform="translate(60 56.4) scale(1 0.42)">
        <path d="M0 10.5C-6.5 4-11.5 0-11.5-4.5-11.5-9-6-11-2.8-7.4L0-4.2 2.8-7.4C6-11 11.5-9 11.5-4.5 11.5 0 6.5 4 0 10.5Z" fill="#f4f1e9"/>
      </g>
      <!-- steam -->
      <path d="M50 44c-4.5-5 3-9-1.5-14.5-2.5-3-1.1-5.9 1.5-8" fill="none" stroke="#d5d0c2" stroke-width="2.4" stroke-linecap="round" opacity="0.82"/>
      <path d="M66.5 43c-3.7-4.6 2.9-8.4-.9-13.2-2.2-2.8-1-5.4 1.2-7.2" fill="none" stroke="#d5d0c2" stroke-width="1.8" stroke-linecap="round" opacity="0.6"/>`,
  },
  'Cinema ticket': {
    subject: 'a two-part admit-one cinema ticket lying flat at an angle, perforated tear line and a printed seal',
    palette: [SHADOW, '#f7ecd6', '#fffaf0', '#d8c49b', '#cbb590', '#b02a38', '#7d1b26', '#6d6355'],
    draw: () => {
      // The notch arcs are sweep=0 at both ends: on the top edge that bows the
      // arc down into the paper, and on the bottom edge (walked right to left)
      // it bows up — the two half-moons a cinema ticket is torn between.
      const body =
        'M19 46H71A3 3 0 0 0 77 46H101A3 3 0 0 1 104 49V83A3 3 0 0 1 101 86H77' +
        'A3 3 0 0 0 71 86H19A3 3 0 0 1 16 83V49A3 3 0 0 1 19 46Z'
      const perf = [0, 1, 2, 3, 4, 5, 6, 7]
        .map((i) => `<rect x="73.4" y="${n(50 + i * 4.6)}" width="1.3" height="2.6" rx="0.5" fill="#cbb590"/>`)
        .join('')
      const stub = [[52.4, 13], [57, 9.4], [61.6, 11.6]]
        .map(([y, w]) => `<rect x="87" y="${n(y)}" width="${n(w)}" height="2" rx="1" fill="#6d6355"/>`)
        .join('')
      return `
      ${shadow(60, 104, 40, 5, SHADOW)}
      <g transform="rotate(-8 60 66)">
        <path d="${body}" transform="translate(0 3)" fill="#d8c49b"/>
        <path d="${body}" fill="#f7ecd6"/>
        <rect x="18" y="46.8" width="52" height="2.2" fill="#fffaf0"/>
        <rect x="78" y="46.8" width="24" height="2.2" fill="#fffaf0"/>
        <rect x="18" y="83.4" width="52" height="2" fill="#d8c49b"/>
        <rect x="78" y="83.4" width="24" height="2" fill="#d8c49b"/>
        <!-- main half: a printed header, rules, and two blocked-out fields -->
        <rect x="21" y="51" width="45" height="9" rx="1.5" fill="#b02a38"/>
        <rect x="21" y="57" width="45" height="3" fill="#7d1b26"/>
        <rect x="21" y="63.6" width="38" height="2" rx="1" fill="#cbb590"/>
        <rect x="21" y="67.6" width="29" height="2" rx="1" fill="#cbb590"/>
        <rect x="21" y="73" width="17" height="8" rx="1.5" fill="#6d6355"/>
        <rect x="41" y="73" width="11" height="8" rx="1.5" fill="#6d6355"/>
        <!-- the box-office seal -->
        <circle cx="61" cy="72" r="7.4" fill="#b02a38"/>
        <circle cx="61" cy="72" r="4.4" fill="#f7ecd6"/>
        <circle cx="61" cy="72" r="2.1" fill="#7d1b26"/>
        <!-- the perforation, and the stub that stays behind -->
        ${perf}
        <rect x="79.5" y="51" width="5" height="31" rx="1" fill="#b02a38"/>
        <rect x="82.5" y="51" width="2" height="31" fill="#7d1b26"/>
        ${stub}
        <rect x="87" y="70" width="13" height="12" rx="1.5" fill="#cbb590"/>
        <rect x="89.4" y="73.4" width="8.2" height="2" rx="1" fill="#6d6355"/>
        <rect x="89.4" y="77.4" width="5.4" height="2" rx="1" fill="#6d6355"/>
      </g>`
    },
  },
  'Hardback book': {
    subject: 'a cloth hardback standing upright, boards overhanging the page block, a ribbon marker over the fore-edge',
    palette: [
      SHADOW, '#1e5f5c', '#154643', '#26706a', '#c9a227', '#8a6f16',
      '#efe6cf', '#fdf8ea', '#ddd0ae', '#f0e7d0', '#b0303a', '#822029',
    ],
    draw: () => {
      // Page edges on the top face run spine-to-fore-edge, stacked back through
      // the thickness — so they are horizontal here, not vertical: it is the
      // fore-edge face that bands the other way.
      const leaves = [0.25, 0.44, 0.63, 0.82]
        .map((s) => `<rect x="${n(28 + 13 * s)}" y="${n(27.65 - 7 * s)}" width="46" height="0.7" fill="#ddd0ae"/>`)
        .join('')
      return `
      ${shadow(58, 104, 32, 5, SHADOW)}
      <!-- fore-edge: the page block, banded across its thickness -->
      <path d="M74 28 87 21V90L74 97Z" fill="#efe6cf"/>
      <path d="M74.6 27.7 76 27v69l-1.4.7Z" fill="#fdf8ea"/>
      <path d="M77.2 26.3 80.4 24.6v69l-3.2 1.7Z" fill="#ddd0ae"/>
      <path d="M83 23.2 85 22.2v69l-2 1Z" fill="#ddd0ae"/>
      <path d="M74 28 87 21v3.4L74 31.4Z" fill="#154643"/>
      <path d="M74 93.6 87 86.6V90l-13 7Z" fill="#154643"/>
      <!-- top edge: board, then leaves, then the back board -->
      <path d="M28 28 41 21h46l-13 7Z" fill="#efe6cf"/>
      ${leaves}
      <path d="M28 28h46l1.2-.65H29.2Z" fill="#154643"/>
      <path d="M41 21h46l-1.2.65H39.8Z" fill="#154643"/>
      <!-- front board -->
      <path d="M28 28h46v69H28Z" fill="#1e5f5c"/>
      <path d="M66 28h8v69h-8Z" fill="#26706a"/>
      <path d="M28 28h5.4v69H28Z" fill="#154643"/>
      <path d="M33.4 28h1.2v69h-1.2Z" fill="#26706a"/>
      <rect x="37" y="33" width="32" height="59" fill="none" stroke="#c9a227" stroke-width="1"/>
      <rect x="39.2" y="35.2" width="27.6" height="54.6" fill="none" stroke="#c9a227" stroke-width="0.5"/>
      <!-- blocked gilt device, and the jacket band across the lower third -->
      <path d="M53 37 59.6 45 53 53 46.4 45Z" fill="#c9a227"/>
      <path d="M53 41 56.4 45 53 49 49.6 45Z" fill="#8a6f16"/>
      <rect x="37" y="60" width="32" height="13" fill="#f0e7d0"/>
      <rect x="37" y="60" width="32" height="1.8" fill="#c9a227"/>
      <rect x="40" y="63.6" width="26" height="2.6" rx="0.9" fill="#154643"/>
      <rect x="44" y="68.2" width="18" height="1.9" rx="0.8" fill="#154643"/>
      <rect x="44" y="82" width="18" height="1.6" fill="#c9a227"/>
      <!-- ribbon marker: across the top, then down the fore-edge -->
      <path d="M79.6 25 82.2 23.6H62.2L59.6 25Z" fill="#b0303a"/>
      <path d="M79.6 25h2.6v37l-1.3-2.4-1.3 4.4Z" fill="#b0303a"/>
      <path d="M81.2 24.2 82.2 23.6V62l-1-1.8Z" fill="#822029"/>`
    },
  },
  'Video game': {
    subject: 'a boxed game in its plastic case, own cover art, with a cartridge leaning against it',
    palette: [
      SHADOW, '#171a1f', '#22252b', '#33373f', '#8e1d2c', '#c23b3b', '#d9694f',
      '#a8283a', '#4e1220', '#e8b73e', '#a8762a', '#e6e3dc', '#6b6f77',
      '#ffffff', '#6e747c', '#8b929b', '#565c64', '#c9a227',
    ],
    draw: () => {
      const rays = [[33, 41], [44, 52], [56, 64]]
        .map(([a, b]) => `<path d="M${a} 20 ${b} 20 ${n(b - 14)} 50 ${n(a - 14)} 50Z" fill="#d9694f"/>`)
        .join('')
      const ridges = [0, 1, 2, 3]
        .map((i) => `<rect x="78" y="${n(81.5 + i * 1.5)}" width="20" height="0.8" fill="#565c64"/>`)
        .join('')
      const pins = [0, 1, 2, 3, 4]
        .map((i) => `<rect x="${n(80 + i * 3.6)}" y="88" width="2.2" height="4" fill="#c9a227"/>`)
        .join('')
      return `
      ${shadow(58, 104, 36, 5, SHADOW)}
      <!-- the spine, receding to the left -->
      <path d="M26 18 19.5 22v68l6.5 4Z" fill="#171a1f"/>
      <path d="M26 18 19.5 22v3.2L26 21.2Z" fill="#33373f"/>
      <path d="M21.6 26.4h2.4v56h-2.4Z" fill="#8e1d2c"/>
      <!-- case and the printed insert behind its plastic -->
      <rect x="26" y="18" width="48" height="76" rx="2.5" fill="#22252b"/>
      <clipPath id="video-game-panel"><rect x="28.4" y="20.4" width="43.2" height="71.2" rx="1.2"/></clipPath>
      <g clip-path="url(#video-game-panel)">
        <rect x="28" y="20" width="44" height="72" fill="#8e1d2c"/>
        <rect x="28" y="20" width="44" height="26" fill="#c23b3b"/>
        ${rays}
        <path d="M28 64 38 53 47 62 56 49 65 60 72 54v38H28Z" fill="#a8283a"/>
        <path d="M28 72 37 63 45 71 55 60 64 72 72 65v27H28Z" fill="#4e1220"/>
        <path d="M50 27 62 32.4V44c0 7.4-6.4 11.6-12 14.4-5.6-2.8-12-7-12-14.4V32.4Z" fill="#e8b73e"/>
        <path d="M50 32 57.6 35.4V44c0 4.8-3.8 7.6-7.6 9.4-3.8-1.8-7.6-4.6-7.6-9.4v-8.6Z" fill="#a8762a"/>
        <path d="M50 37.4 55.6 43.4h-3L50 40.6 47.4 43.4h-3Z" fill="#e8b73e"/>
        <path d="M28 92 52 20h8L34 92Z" fill="#ffffff" opacity="0.1"/>
        <rect x="28" y="80" width="44" height="12" fill="#171a1f"/>
        <rect x="31" y="82.4" width="8" height="7.4" rx="0.8" fill="#e6e3dc"/>
        <rect x="32.4" y="85.6" width="5.2" height="1.6" fill="#171a1f"/>
        <rect x="42" y="83.6" width="16" height="1.8" rx="0.9" fill="#6b6f77"/>
        <rect x="42" y="87.2" width="11" height="1.6" rx="0.8" fill="#6b6f77"/>
      </g>
      <!-- the cartridge, leaning on the case -->
      <g transform="rotate(13 88 76)">
        <rect x="74" y="59" width="28" height="34" rx="3" fill="#6e747c"/>
        <path d="M77 59h22a3 3 0 0 1 3 3v2.4H74V62a3 3 0 0 1 3-3Z" fill="#8b929b"/>
        <path d="M95 59h4a3 3 0 0 1 3 3v28a3 3 0 0 1-3 3h-4Z" fill="#565c64"/>
        <rect x="77.5" y="67" width="21" height="12" rx="1.2" fill="#e6e3dc"/>
        <rect x="79.5" y="69.4" width="17" height="3" rx="1" fill="#8e1d2c"/>
        <rect x="79.5" y="74" width="12" height="2.2" rx="1" fill="#6b6f77"/>
        ${ridges}
        <rect x="78" y="87" width="20" height="5" rx="1" fill="#33373f"/>
        ${pins}
      </g>`
    },
  },
  'Concert ticket': {
    subject: 'a torn concert stub on the diagonal — ragged tear down one side, punch hole, barcode across the foot',
    palette: [SHADOW, '#faf6ee', '#ffffff', '#cfc6b4', '#b9ae9b', '#c2185b', '#8c1145', '#5b2d82', '#2b2b30'],
    draw: () => {
      // The tear is a fixed profile rather than a seeded scatter: a stub torn
      // off a book leaves teeth of roughly one size, and random ones read as
      // damage rather than a perforation given up under a thumb.
      const tear = [0, 2.6, -0.7, 2.2, 0.4, 2.9, -0.4, 2.4, 0.2, 2.7, -0.6, 2.3, 0]
        .map((t, i) => `${n(42 + t)} ${n(96 - i * 6)}`)
        .join(' ')
      const body = `M42 24H75A3 3 0 0 1 78 27V93A3 3 0 0 1 75 96H42 ${tear}Z`
      let bx = 46
      const code = [1.3, 0.7, 2, 0.7, 1.1, 1.7, 0.7, 2.2, 1, 0.8, 1.6, 1.2, 0.7, 1.9, 1.1]
        .map((w) => {
          const r = `<rect x="${n(bx)}" y="83" width="${n(w)}" height="10" fill="#2b2b30"/>`
          bx += w + 0.75
          return r
        })
        .join('')
      const rules = [[56, 24], [60.6, 17], [65.2, 21]]
        .map(([y, w]) => `<rect x="46" y="${n(y)}" width="${n(w)}" height="2.2" rx="1.1" fill="#b9ae9b"/>`)
        .join('')
      return `
      ${shadow(60, 104, 30, 5, SHADOW)}
      <g transform="rotate(14 60 60)">
        <path d="${body}" transform="translate(1.6 2.4)" fill="#cfc6b4"/>
        <path d="${body}" fill="#faf6ee"/>
        <rect x="45" y="24.8" width="30" height="2" fill="#ffffff"/>
        <!-- punched hole -->
        <circle cx="60" cy="33" r="3.6" fill="#b9ae9b"/>
        <circle cx="60.4" cy="32.6" r="2.7" fill="#cfc6b4"/>
        <!-- headline block, rules, and the row/seat fields -->
        <rect x="46" y="41" width="28" height="12" rx="1.2" fill="#c2185b"/>
        <rect x="46" y="49.6" width="28" height="3.4" fill="#8c1145"/>
        ${rules}
        <rect x="46" y="70" width="14" height="8" rx="1.4" fill="#5b2d82"/>
        <rect x="63" y="70" width="11" height="8" rx="1.4" fill="#5b2d82"/>
        ${code}
      </g>`
    },
  },
  'Diamond ring': {
    subject: 'a solitaire ring standing upright — brilliant-cut stone in four claws over a rounded platinum band',
    palette: [
      SHADOW, '#c3cad4', '#6f7883', '#98a0ab', '#eef2f7', '#ffffff',
      '#eaf7ff', '#cfeaf8', '#a9d8ee', '#8bc4e0', '#6fa9cc', '#4d88ad',
    ],
    draw: () => `
      ${shadow(60, 104, 26, 5, SHADOW)}
      <!-- band: one thick stroke, then the lit and shaded quarters over it -->
      <ellipse cx="60" cy="80" rx="23.2" ry="20.5" fill="none" stroke="#c3cad4" stroke-width="7.6"/>
      <path d="M60 100.5A23.2 20.5 0 0 0 83.2 80" fill="none" stroke="#6f7883" stroke-width="7.6"/>
      <path d="M39.9 90.25A23.2 20.5 0 0 1 39.9 69.75" fill="none" stroke="#eef2f7" stroke-width="7.6"/>
      <ellipse cx="60" cy="80" rx="26.6" ry="23.9" fill="none" stroke="#eef2f7" stroke-width="1.6"/>
      <ellipse cx="60" cy="80.4" rx="20" ry="17.4" fill="none" stroke="#98a0ab" stroke-width="1.8"/>
      <path d="M43.2 91.5A23.2 20.5 0 0 1 41 84" fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round"/>
      <!-- the collet, mostly hidden behind the stone it carries -->
      <path d="M53 46h14l-3.4 15h-7.2Z" fill="#c3cad4"/>
      <path d="M60 46h7l-3.4 15H60Z" fill="#98a0ab"/>
      <!-- pavilion: four facets converging on the culet -->
      <path d="M41 31h9l10 22Z" fill="#6fa9cc"/>
      <path d="M50 31h10v22Z" fill="#a9d8ee"/>
      <path d="M60 31h10L60 53Z" fill="#4d88ad"/>
      <path d="M70 31h9L60 53Z" fill="#8bc4e0"/>
      <path d="M55.4 31h9.2L60 45.4Z" fill="#eaf7ff"/>
      <!-- crown: bezel facets stepping down from the table to the girdle -->
      <path d="M41 31 52.5 23.5 50 19Z" fill="#a9d8ee"/>
      <path d="M79 31 67.5 23.5 70 19Z" fill="#6fa9cc"/>
      <path d="M41 31h7l4.5-7.5Z" fill="#cfeaf8"/>
      <path d="M48 31h12v-7.5h-7.5Z" fill="#eaf7ff"/>
      <path d="M60 31h12l-4.5-7.5H60Z" fill="#a9d8ee"/>
      <path d="M72 31h7l-11.5-7.5Z" fill="#8bc4e0"/>
      <path d="M50 19h20l-2.5 4.5h-15Z" fill="#ffffff"/>
      <path d="M52.5 23.5h15l-1.4 2.6h-12.2Z" fill="#cfeaf8"/>
      <rect x="42" y="30.3" width="36" height="1.6" fill="#4d88ad"/>
      <!-- four claws over the girdle -->
      <g fill="#c3cad4">
        <rect x="38.6" y="25.4" width="5.2" height="11" rx="2.6" transform="rotate(-17 41.2 30.9)"/>
        <rect x="76.2" y="25.4" width="5.2" height="11" rx="2.6" transform="rotate(17 78.8 30.9)"/>
        <rect x="50.2" y="26.8" width="4.4" height="9" rx="2.2"/>
        <rect x="65.4" y="26.8" width="4.4" height="9" rx="2.2"/>
      </g>
      <g fill="#98a0ab">
        <rect x="41.8" y="25.8" width="1.8" height="10.2" rx="0.9" transform="rotate(-17 42.7 30.9)"/>
        <rect x="76.4" y="25.8" width="1.8" height="10.2" rx="0.9" transform="rotate(17 77.3 30.9)"/>
        <rect x="52.8" y="27.2" width="1.6" height="8.2" rx="0.8"/>
        <rect x="68" y="27.2" width="1.6" height="8.2" rx="0.8"/>
      </g>
      <!-- the one glint the stone is bought for -->
      <path d="M55 20.5 56.3 24.4 60 25.8 56.3 27.2 55 31.1 53.7 27.2 50 25.8 53.7 24.4Z" fill="#ffffff"/>`,
  },
  'A Van Gogh': {
    subject: 'a swirling night-sky canvas in a mitred gilt frame — our own hand, not a copy of any painting',
    palette: [
      SHADOW, '#c9a961', '#eddaa5', '#dcc484', '#a88a45', '#8a7134', '#6f5a25',
      '#1b3a6b', '#24487f', '#2f5f9e', '#3a72b4', '#5a8cc4', '#7fa9d8',
      '#f6e2a0', '#e3c774', '#17335c', '#13294a', '#14312e', '#1f4a3f',
    ],
    draw: () => {
      // Impasto dabs on a fixed lattice: the sky wants a rhythm, and a seeded
      // scatter puts two of them on the moon and none on the left half.
      const dabs = [
        [31, 63], [43, 69], [37, 47], [50, 61], [62, 67], [70, 53],
        [85, 56], [77, 43], [57, 39], [46, 39], [88, 64], [33, 73],
      ]
        .map(([x, y], i) => `<path d="M${x} ${y}q3 ${i % 2 ? -2.6 : 2.6} 6 0" fill="none" stroke="#5a8cc4" stroke-width="1.5" stroke-linecap="round" opacity="0.7"/>`)
        .join('')
      const stars = [[36, 43], [49, 45], [67, 41], [73, 58]]
        .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.4" fill="none" stroke="#e3c774" stroke-width="1.2" opacity="0.75"/><circle cx="${x}" cy="${y}" r="1.6" fill="#f6e2a0"/>`)
        .join('')
      return `
      ${shadow(60, 104, 42, 5, SHADOW)}
      <clipPath id="a-van-gogh-canvas"><rect x="26" y="36" width="68" height="50"/></clipPath>
      <g clip-path="url(#a-van-gogh-canvas)">
        <rect x="26" y="36" width="68" height="50" fill="#1b3a6b"/>
        <path d="M26 44c8-6 18 4 28-2s22 4 40-2v-6H26Z" fill="#24487f"/>
        <path d="M26 51c10-5 20 4 32-2s22 4 36-2" fill="none" stroke="#24487f" stroke-width="5"/>
        <path d="M37 61c-2-16 17-25 30-16 10 7 5 22-7 21" fill="none" stroke="#2f5f9e" stroke-width="4.2" stroke-linecap="round"/>
        <path d="M41 57c0-11 15-15 23-7 6 6 0 14-7 12-5-1.4-6-8-1-9" fill="none" stroke="#3a72b4" stroke-width="3.2" stroke-linecap="round"/>
        <path d="M72 73c0-8 10-11 14-5 3 4.5-2 9-6 6.5" fill="none" stroke="#3a72b4" stroke-width="2.8" stroke-linecap="round"/>
        <path d="M26 50c10-5 20 4 32-2s22 4 36-2" fill="none" stroke="#7fa9d8" stroke-width="1.4" opacity="0.7"/>
        ${dabs}
        ${stars}
        <circle cx="82" cy="47" r="9.4" fill="none" stroke="#e3c774" stroke-width="2.2" opacity="0.8"/>
        <circle cx="82" cy="47" r="6" fill="#f6e2a0"/>
        <path d="M26 72c12-6 26 2 40-4 12-5 22 2 28-2v20H26Z" fill="#17335c"/>
        <path d="M26 76h7l4-4 6 4 7-5 7 5 7-3 8 4 8-3 8 4 6-2v11H26Z" fill="#13294a"/>
        <rect x="34" y="79.6" width="2.4" height="2" fill="#f6e2a0"/>
        <rect x="52" y="80.4" width="2.4" height="2" fill="#f6e2a0"/>
        <rect x="76" y="81" width="2.4" height="2" fill="#f6e2a0"/>
        <path d="M36 86c-3-10 1-16-1-23-1-6 3-11 1.5-18 2.5 4 4.5 0 5.5 4 2 6-1 11 1 17 1.5 6-2 13-1 20Z" fill="#14312e"/>
        <path d="M38.6 84c-1.6-8 .9-14-.1-20-.7-6 1.5-10 .5-15.5 1.5 3.5 2 7.5 1 11.5-1 6 1 12-.2 18Z" fill="#1f4a3f"/>
      </g>
      <!-- mitred frame: lit along the top and left, in shade below and right -->
      <path d="M14 26h92L94 36H26Z" fill="#eddaa5"/>
      <path d="M14 26 26 36v50L14 96Z" fill="#dcc484"/>
      <path d="M106 26 94 36v50l12 10Z" fill="#8a7134"/>
      <path d="M14 96h92L94 86H26Z" fill="#a88a45"/>
      <rect x="15" y="27" width="90" height="68" fill="none" stroke="#c9a961" stroke-width="1.6"/>
      <rect x="25.2" y="35.2" width="69.6" height="51.6" fill="none" stroke="#6f5a25" stroke-width="1.6"/>
      <rect x="14" y="96" width="92" height="2.4" rx="1" fill="#6f5a25"/>`
    },
  },
  'Camera drone': {
    subject: 'a quadcopter hovering — four blurred rotor discs on splayed arms, a gimballed camera ball slung under the shell',
    palette: [SHADOW, '#23272d', '#3f454d', '#646c76', '#8e97a2', '#aab3bd', '#101318', '#cfe4f2', '#e04b3a'],
    draw: () => {
      // Rotors are discs, not blades. A propeller at speed photographs as a
      // translucent disc, and four sets of stopped blades at 110px read as a
      // dead insect — the one thing a hovering drone must not look like. The
      // front pair are larger and lower than the rear pair, which is the whole
      // of the three-quarter view: nothing else here is foreshortened.
      const props: number[][] = [
        [28, 64, 18, 6],
        [92, 64, 18, 6],
        [35, 42, 15, 5],
        [85, 42, 15, 5],
      ]
      const discs = props
        .map(
          ([x, y, rx, ry]) =>
            `<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(rx)}" ry="${n(ry)}" fill="#aab3bd" opacity="0.9"/>` +
            `<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(rx * 0.7)}" ry="${n(ry * 0.64)}" fill="#8e97a2"/>` +
            `<ellipse cx="${n(x)}" cy="${n(y - ry * 0.36)}" rx="${n(rx * 0.84)}" ry="${n(ry * 0.2)}" fill="#cfe4f2" opacity="0.5"/>`,
        )
        .join('')
      const motors = props
        .map(
          ([x, y]) =>
            `<ellipse cx="${n(x)}" cy="${n(y)}" rx="4.4" ry="3.6" fill="#23272d"/>` +
            `<ellipse cx="${n(x - 0.7)}" cy="${n(y - 1.1)}" rx="2.5" ry="1.8" fill="#646c76"/>`,
        )
        .join('')
      const arms = ([
        [47, 61, 30, 64.6, 7],
        [73, 61, 90, 64.6, 7],
        [48, 49, 35, 43.6, 6],
        [72, 49, 85, 43.6, 6],
      ] as number[][])
        .map(
          ([x1, y1, x2, y2, w]) =>
            `<path d="M${n(x1)} ${n(y1)}L${n(x2)} ${n(y2)}" stroke="#3f454d" stroke-width="${n(w)}" stroke-linecap="round" fill="none"/>` +
            `<path d="M${n(x1)} ${n(y1 - w * 0.3)}L${n(x2)} ${n(y2 - w * 0.3)}" stroke="#646c76" stroke-width="${n(w * 0.32)}" stroke-linecap="round" fill="none"/>`,
        )
        .join('')
      return `
      ${shadow(60, 105, 17, 3.4, SHADOW)}
      ${discs}
      ${arms}
      ${motors}
      <circle cx="28" cy="69.5" r="1.7" fill="#e04b3a"/>
      <circle cx="92" cy="69.5" r="1.7" fill="#e04b3a"/>
      <!-- landing skids, hanging clear of the ground: this one is in the air -->
      <path d="M48 72L41 90" stroke="#23272d" stroke-width="3" stroke-linecap="round" fill="none"/>
      <path d="M72 72L79 90" stroke="#23272d" stroke-width="3" stroke-linecap="round" fill="none"/>
      <path d="M34 91.4h14" stroke="#3f454d" stroke-width="3.4" stroke-linecap="round" fill="none"/>
      <path d="M72 91.4h14" stroke="#3f454d" stroke-width="3.4" stroke-linecap="round" fill="none"/>
      <!-- shell: a hexagonal pod, lit deck, shaded starboard flank -->
      <path d="M48 42h24l8 8v14l-10 12H50L40 64V50Z" fill="#3f454d"/>
      <path d="M72 42l8 8v14l-10 12h-6l6-12V48Z" fill="#23272d"/>
      <path d="M48 42h24l8 8H40Z" fill="#646c76"/>
      <path d="M51.5 43.6h17l4.4 4.4H47Z" fill="#8e97a2"/>
      <rect x="47" y="66" width="26" height="2.4" rx="1.2" fill="#23272d"/>
      <!-- gimbal yoke and the camera ball itself -->
      <path d="M52 73v5M68 73v5" stroke="#23272d" stroke-width="2.6" stroke-linecap="round" fill="none"/>
      <circle cx="61.6" cy="84.2" r="8.2" fill="#23272d"/>
      <circle cx="60" cy="82.4" r="7.8" fill="#3f454d"/>
      <circle cx="59.4" cy="82" r="5.2" fill="#646c76"/>
      <circle cx="59.4" cy="82" r="4.2" fill="#101318"/>
      <circle cx="57.6" cy="80.2" r="1.5" fill="#cfe4f2" opacity="0.9"/>`
    },
  },
  'Smartphone': {
    subject: 'a black phone stood face-on, screen lit — status bar, a grid of app tiles, a dock and a home bar',
    palette: [SHADOW, '#6b727c', '#2a2e34', '#14181d', '#16324a', '#24557a', '#3a72a0', '#e8734a', '#4ea3e8', '#5cc98a', '#e8c04a', '#dfe6ee'],
    draw: () => {
      // The app grid is the whole read. A dark slab with a blank blue screen is
      // a phone-shaped rectangle; twenty coloured tiles in four columns is a
      // phone, and nothing else on this page looks remotely like it. Colours are
      // laid out by hand rather than cycled, because a strict repeat of four
      // reads as a test card.
      const grid = [
        '#e8734a', '#4ea3e8', '#5cc98a', '#dfe6ee',
        '#4ea3e8', '#e8c04a', '#dfe6ee', '#e8734a',
        '#5cc98a', '#dfe6ee', '#e8734a', '#4ea3e8',
        '#e8c04a', '#e8734a', '#4ea3e8', '#5cc98a',
        '#dfe6ee', '#5cc98a', '#e8c04a', '#e8734a',
      ]
        .map((c, i) => {
          const x = 45.6 + (i % 4) * 8
          const y = 26 + Math.floor(i / 4) * 10
          return (
            `<rect x="${n(x)}" y="${n(y)}" width="6.4" height="6.4" rx="1.9" fill="${c}"/>` +
            `<rect x="${n(x)}" y="${n(y)}" width="6.4" height="2.6" rx="1.3" fill="#dfe6ee" opacity="0.3"/>`
          )
        })
        .join('')
      const dock = ['#4ea3e8', '#5cc98a', '#e8734a', '#dfe6ee']
        .map((c, i) => `<rect x="${n(46.8 + i * 7)}" y="80.7" width="5.6" height="5.6" rx="1.7" fill="${c}"/>`)
        .join('')
      const signal = [1.6, 2.2, 2.8]
        .map((h, i) => `<rect x="${n(45 + i * 2.1)}" y="${n(21 - h)}" width="1.3" height="${n(h)}" rx="0.4" fill="#dfe6ee"/>`)
        .join('')
      return `
      ${shadow(60, 104, 26, 4, SHADOW)}
      <rect x="36.6" y="34" width="2" height="7" rx="1" fill="#6b727c"/>
      <rect x="36.6" y="43" width="2" height="7" rx="1" fill="#6b727c"/>
      <rect x="81.4" y="36" width="2" height="11" rx="1" fill="#6b727c"/>
      <rect x="38" y="12" width="44" height="90" rx="9" fill="#2a2e34"/>
      <rect x="39" y="13" width="42" height="88" rx="8.2" fill="none" stroke="#6b727c" stroke-width="2"/>
      <rect x="41" y="15" width="38" height="84" rx="6.4" fill="#14181d"/>
      <rect x="42.4" y="16.4" width="35.2" height="81.2" rx="5.2" fill="#16324a"/>
      <path d="M42.4 62h35.2v30.4a5.2 5.2 0 0 1-5.2 5.2H47.6a5.2 5.2 0 0 1-5.2-5.2Z" fill="#24557a"/>
      <rect x="54" y="17.6" width="12" height="3.4" rx="1.7" fill="#14181d"/>
      ${signal}
      <rect x="70" y="18.2" width="5.4" height="2.4" rx="1" fill="#dfe6ee"/>
      ${grid}
      <rect x="44.8" y="77" width="30.4" height="13" rx="5" fill="#3a72a0"/>
      ${dock}
      <rect x="53" y="93.4" width="14" height="1.8" rx="0.9" fill="#dfe6ee"/>`
    },
  },
  'Laptop': {
    subject: 'a silver laptop open on a desk, seen three-quarter from the left — lit screen, keyboard in perspective, trackpad',
    palette: [SHADOW, '#e2e7eb', '#c4cbd2', '#aeb6be', '#8f979f', '#71797f', '#3a4047', '#5a626b', '#141a22', '#1d3145', '#356b8f', '#7fb3cf'],
    draw: () => {
      // Everything on the base is placed through one perspective map, so the
      // keys, the trackpad and the deck all vanish to the same point. Drawing
      // fifty-five keys as axis-aligned rects instead — the obvious shortcut —
      // makes the deck look like a sticker laid on a wedge.
      const P = (u: number, v: number) => `${n(12 + 60 * u + 28 * v)} ${n(78 + 15 * u - 18 * v)}`
      const deckQuad = (u0: number, u1: number, v0: number, v1: number, fill: string) =>
        `<path d="M${P(u0, v0)}L${P(u1, v0)}L${P(u1, v1)}L${P(u0, v1)}Z" fill="${fill}"/>`
      const keys = Array.from({ length: 5 }, (_, r) =>
        Array.from({ length: 11 }, (_, c) => {
          const u = 0.1 + c * 0.0727
          const v = 0.37 + r * 0.107
          return deckQuad(u, u + 0.057, v, v + 0.083, '#5a626b')
        }).join(''),
      ).join('')

      // The screen has its own map — same hinge line, tilted back instead of flat.
      const Q = (s: number, t: number) => `${n(40 + 60 * s + 7 * t)} ${n(60 + 15 * s - 38 * t)}`
      const lit = (s0: number, s1: number, t0: number, t1: number, fill: string) =>
        `<path d="M${Q(s0, t0)}L${Q(s1, t0)}L${Q(s1, t1)}L${Q(s0, t1)}Z" fill="${fill}"/>`
      const lines = [0.595, 0.545, 0.495]
        .map((t, i) => lit(0.22, 0.56 - i * 0.07, t, t + 0.026, '#8f979f'))
        .join('')
      return `
      ${shadow(58, 104, 45, 5, SHADOW)}
      <!-- base: top deck, then the two faces that give it thickness -->
      <path d="M12 78L72 93L100 75L40 60Z" fill="#c4cbd2"/>
      <path d="M12 78L72 93v5L12 83Z" fill="#8f979f"/>
      <path d="M72 93L100 75v5l-28 18Z" fill="#71797f"/>
      <path d="M12 78L72 93" stroke="#e2e7eb" stroke-width="1.6" fill="none"/>
      ${deckQuad(0.07, 0.93, 0.33, 0.94, '#3a4047')}
      ${keys}
      ${deckQuad(0.33, 0.67, 0.05, 0.29, '#8f979f')}
      ${deckQuad(0.35, 0.65, 0.07, 0.27, '#aeb6be')}
      <!-- screen: bezel, panel, and a desktop on it -->
      <path d="M40 60L100 75L107 37L47 22Z" fill="#3a4047"/>
      <path d="M40 60L100 75" stroke="#71797f" stroke-width="2.2" fill="none"/>
      ${lit(0.05, 0.95, 0.1, 0.93, '#141a22')}
      ${lit(0.06, 0.94, 0.11, 0.86, '#1d3145')}
      ${lit(0.06, 0.94, 0.5, 0.86, '#356b8f')}
      ${lit(0.06, 0.94, 0.47, 0.51, '#7fb3cf')}
      ${lit(0.06, 0.94, 0.86, 0.915, '#aeb6be')}
      ${lit(0.18, 0.62, 0.3, 0.72, '#e2e7eb')}
      ${lit(0.18, 0.62, 0.66, 0.72, '#aeb6be')}
      ${lines}
      ${lit(0.28, 0.72, 0.125, 0.18, '#aeb6be')}
      <circle cx="76.7" cy="31.2" r="0.9" fill="#141a22"/>`
    },
  },
  'Motorcycle': {
    subject: 'a red naked motorcycle in side view facing left — alloy wheels, tank, engine, forks, chrome muffler',
    palette: [SHADOW, '#22252a', '#2e3239', '#4d545c', '#8a9299', '#adb5bd', '#d9e0e6', '#f0f4f6', '#8f2118', '#c8382c', '#e05a45', '#f6e6a8'],
    draw: () => {
      // Five-spoke alloys rather than wire spokes: at 110px a 36-spoke wheel
      // turns into a grey disc, and the whole point of drawing the wheel at all
      // is that light gets through it. The gaps are the picture.
      const wheel = (cx: number, cy: number, r: number) =>
        `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="#22252a"/>` +
        `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r * 0.87)}" fill="#2e3239"/>` +
        `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r * 0.68)}" fill="#8a9299"/>` +
        `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r * 0.6)}" fill="#4d545c"/>` +
        [0, 72, 144, 216, 288]
          .map(
            (a) =>
              `<rect x="${n(cx - 1.6)}" y="${n(cy - r * 0.64)}" width="3.2" height="${n(r * 0.64)}" rx="1.3" fill="#adb5bd" transform="rotate(${a} ${n(cx)} ${n(cy)})"/>`,
          )
          .join('') +
        `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r * 0.2)}" fill="#8a9299"/>` +
        `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r * 0.09)}" fill="#22252a"/>`
      return `
      ${shadow(60, 104, 40, 5, SHADOW)}
      ${wheel(31, 84, 16)}
      ${wheel(89, 84, 16)}
      <!-- swingarm, shock, chain -->
      <path d="M69 84.5L88 84.5" stroke="#4d545c" stroke-width="5" stroke-linecap="round" fill="none"/>
      <path d="M69 82.8L88 82.8" stroke="#8a9299" stroke-width="1.8" stroke-linecap="round" fill="none"/>
      <path d="M71 87.4L88 87.4" stroke="#22252a" stroke-width="1.6" fill="none"/>
      <path d="M80 66L88 82" stroke="#8a9299" stroke-width="3.2" stroke-linecap="round" fill="none"/>
      <!-- frame downtube, then the engine: finned barrel over a dark crankcase -->
      <path d="M56 52L58.5 70" stroke="#8a9299" stroke-width="3" stroke-linecap="round" fill="none"/>
      <path d="M56 73h21l2.5 6-2.5 9H60.5L56 80Z" fill="#4d545c"/>
      <path d="M74 73h3l2.5 6-2.5 9h-6.5l4.5-9Z" fill="#2e3239"/>
      <path d="M58 62h15l-1.4 13H59.4Z" fill="#8a9299"/>
      <path d="M69.6 62H73l-1.4 13h-3.4Z" fill="#4d545c"/>
      <path d="M58.4 65.4h14.2M58.2 68.6h14.2M58 71.8h14" stroke="#2e3239" stroke-width="1.3" fill="none"/>
      <path d="M59.5 78h15M59.5 81.5h16" stroke="#8a9299" stroke-width="1.3" fill="none"/>
      <!-- forks, front to the left -->
      <path d="M56 51L36 83" stroke="#2e3239" stroke-width="3.2" stroke-linecap="round" fill="none"/>
      <path d="M53 50L33 82" stroke="#4d545c" stroke-width="5.6" stroke-linecap="round" fill="none"/>
      <path d="M51.6 48.8L37 72" stroke="#adb5bd" stroke-width="3.6" stroke-linecap="round" fill="none"/>
      <!-- front mudguard, hugging the tyre -->
      <path d="M13.3 80.9A18 18 0 0 1 44.8 72.4" stroke="#8f2118" stroke-width="5.6" stroke-linecap="round" fill="none"/>
      <path d="M14.4 79.6A17 17 0 0 1 43.6 71.6" stroke="#c8382c" stroke-width="3.2" stroke-linecap="round" fill="none"/>
      <!-- tank -->
      <path d="M52 62c0-6 5-10 12-11l12-1c5 0 7 3 7 7 0 5-4 9-10 10l-14 2c-5 0-7-3-7-7Z" fill="#c8382c"/>
      <path d="M55.5 58c1.5-3.6 5.5-6.2 10-6.8l11-1c2.8 0 4.4 1.2 4.8 3.6-3-1.6-8-1.4-14-0.4-6 1-9.6 2.6-11.8 4.6Z" fill="#e05a45"/>
      <path d="M52.2 64c1 3.6 3.4 5.4 7.8 5l14-2c5-1 8.4-4 9-8.6 0.6 6-2.6 9.8-8.6 11.4l-14 2c-5.4 0.6-8-2.4-8.2-7.8Z" fill="#8f2118"/>
      <!-- seat and tail -->
      <path d="M76 56h12c6 0 10 3 10 7l-1 4H85l-9-3Z" fill="#22252a"/>
      <path d="M77 56h11c5 0 9 2 10.4 5.4-3-2-6.4-2.8-10.4-2.8H78Z" fill="#4d545c"/>
      <rect x="93" y="62.6" width="6" height="3.4" rx="1.5" fill="#e05a45"/>
      <!-- chrome muffler, on the near side of the rear wheel -->
      <path d="M60 86C68 94 75 93.6 81 91" stroke="#adb5bd" stroke-width="3.2" stroke-linecap="round" fill="none"/>
      <rect x="78" y="86" width="22" height="7.4" rx="3.7" transform="rotate(-8 89 89.7)" fill="#8a9299"/>
      <rect x="78" y="86" width="22" height="3" rx="1.5" transform="rotate(-8 89 89.7)" fill="#d9e0e6"/>
      <!-- headlight and bars -->
      <path d="M55 47.4L41.6 41.6" stroke="#4d545c" stroke-width="3" stroke-linecap="round" fill="none"/>
      <path d="M46.4 43.4L40.6 41" stroke="#22252a" stroke-width="4.2" stroke-linecap="round" fill="none"/>
      <ellipse cx="45.4" cy="50.4" rx="7.6" ry="9.2" transform="rotate(-28 45.4 50.4)" fill="#4d545c"/>
      <ellipse cx="44.2" cy="49.6" rx="6" ry="7.4" transform="rotate(-28 44.2 49.6)" fill="#f6e6a8"/>
      <ellipse cx="42.4" cy="47.6" rx="2.4" ry="3" transform="rotate(-28 42.4 47.6)" fill="#f0f4f6" opacity="0.9"/>`
    },
  },
  'A social network': {
    subject: 'a network of people as a solid object — connected profile pucks on steel rods, mounted on a round plinth',
    palette: [SHADOW, '#1a222c', '#243447', '#2a3442', '#3d5570', '#4a6280', '#1f5b96', '#3a8ed0', '#6fb8ea', '#eef6fc'],
    draw: () => {
      // The abstract one. A flat node-and-line diagram would read as a slide,
      // not as something you could buy, so every node is a thick disc with a
      // lit face and a cast side, every edge a rod with a highlight along its
      // top, and the whole cluster is bolted to a plinth that sits on the
      // ground shadow. The person glyph inside each puck is what separates
      // "a social network" from "a molecule".
      const nodes: number[][] = [
        [60, 52, 15],
        [30, 34, 9.5],
        [92, 38, 9],
        [24, 66, 8],
        [96, 68, 8.5],
        [62, 20, 7.5],
      ]
      const links: number[][] = [
        [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [1, 5], [1, 3], [2, 4],
      ]
      const rod = (w: number, colour: string, dx: number, dy: number) =>
        links
          .map(([a, b]) => {
            const p = nodes[a]
            const q = nodes[b]
            return `<path d="M${n(p[0] + dx)} ${n(p[1] + dy)}L${n(q[0] + dx)} ${n(q[1] + dy)}" stroke="${colour}" stroke-width="${n(w)}" stroke-linecap="round" fill="none"/>`
          })
          .join('')
      const puck = (cx: number, cy: number, r: number) =>
        `<circle cx="${n(cx + r * 0.11)}" cy="${n(cy + r * 0.13)}" r="${n(r)}" fill="#1f5b96"/>` +
        `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r * 0.92)}" fill="#3a8ed0"/>` +
        `<circle cx="${n(cx - r * 0.27)}" cy="${n(cy - r * 0.3)}" r="${n(r * 0.5)}" fill="#6fb8ea" opacity="0.6"/>` +
        `<circle cx="${n(cx)}" cy="${n(cy - r * 0.2)}" r="${n(r * 0.25)}" fill="#eef6fc"/>` +
        `<path d="M${n(cx - r * 0.44)} ${n(cy + r * 0.5)}a${n(r * 0.44)} ${n(r * 0.42)} 0 0 1 ${n(r * 0.88)} 0Z" fill="#eef6fc"/>`
      // Back to front, so the big central puck overlaps everything it touches.
      const order = [5, 1, 2, 3, 4, 0]
      const pucks = order.map((i) => puck(nodes[i][0], nodes[i][1], nodes[i][2])).join('')
      return `
      ${shadow(60, 105, 36, 4.6, SHADOW)}
      <path d="M26 90v6a34 9 0 0 0 68 0v-6Z" fill="#1a222c"/>
      <ellipse cx="60" cy="90" rx="34" ry="9" fill="#2a3442"/>
      <ellipse cx="58" cy="88.4" rx="28" ry="6.6" fill="#3d5570"/>
      <rect x="56.4" y="58" width="7.2" height="32" fill="#243447"/>
      <rect x="56.4" y="58" width="2.6" height="32" fill="#4a6280"/>
      ${rod(4.8, '#243447', 0, 0)}
      ${rod(1.7, '#4a6280', -0.8, -1.1)}
      ${pucks}`
    },
  },
  'Orbital rocket': {
    subject: 'a launch vehicle lit on the pad — white stage with a black interstage, grid fins, engine plume and a lattice tower alongside',
    palette: [SHADOW, '#22262b', '#3b4149', '#5d666f', '#7c848c', '#a8b0b8', '#c2c8cf', '#d8dee2', '#eceff2', '#fbfcfd', '#cf4a3c', '#f2a33c', '#ffd98a', '#fff3d0'],
    draw: () => {
      // The tower is doing real work: a white cylinder with a flame under it is
      // a firework, and the thing that makes it a launch vehicle is the lattice
      // mast and swing arm standing next to it at the same scale.
      const braces = Array.from({ length: 8 }, (_, i) => {
        const y = 22 + i * 10
        return (
          `<path d="M19.4 ${n(y)}L29 ${n(y + 10)}" stroke="#7c848c" stroke-width="1.4" fill="none"/>` +
          `<path d="M29 ${n(y)}L19.4 ${n(y + 10)}" stroke="#5d666f" stroke-width="1.4" fill="none"/>`
        )
      }).join('')
      const smoke = ([
        [28, 98, 10], [41, 102, 9], [21, 103, 6.5],
        [82, 99, 10], [92, 103, 8], [99, 105, 5.5],
      ] as number[][])
        .map(
          ([x, y, r]) =>
            `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="#c2c8cf"/>` +
            `<circle cx="${n(x - r * 0.24)}" cy="${n(y - r * 0.3)}" r="${n(r * 0.7)}" fill="#d8dee2"/>` +
            `<circle cx="${n(x - r * 0.4)}" cy="${n(y - r * 0.46)}" r="${n(r * 0.4)}" fill="#eceff2"/>`,
        )
        .join('')
      return `
      ${shadow(60, 104, 32, 5, SHADOW)}
      <!-- lattice tower and swing arm -->
      <rect x="16" y="20" width="3.4" height="82" fill="#5d666f"/>
      <rect x="29" y="20" width="3.4" height="82" fill="#3b4149"/>
      ${braces}
      <rect x="14" y="18" width="21" height="3.2" fill="#7c848c"/>
      <rect x="32" y="39" width="16" height="3.4" fill="#5d666f"/>
      <rect x="32" y="39" width="16" height="1.2" fill="#a8b0b8"/>
      <!-- grid fins -->
      <path d="M50 38l-7-2.4v11L50 44Z" fill="#a8b0b8"/>
      <path d="M44.4 36.6v9.6M46.8 36.2v9.6" stroke="#5d666f" stroke-width="1" fill="none"/>
      <path d="M72 38l7-2.4v11L72 44Z" fill="#5d666f"/>
      <path d="M74.6 36.6v9.6M77 36.2v9.6" stroke="#3b4149" stroke-width="1" fill="none"/>
      <!-- engine skirt and legs -->
      <path d="M52 82L44 98" stroke="#7c848c" stroke-width="3" stroke-linecap="round" fill="none"/>
      <path d="M70 82L78 98" stroke="#5d666f" stroke-width="3" stroke-linecap="round" fill="none"/>
      <path d="M50 80h22l4.4 9H45.6Z" fill="#a8b0b8"/>
      <path d="M65 80h7l4.4 9h-8Z" fill="#7c848c"/>
      <rect x="45.6" y="87" width="30.8" height="2.6" fill="#3b4149"/>
      <!-- stage -->
      <rect x="50" y="34" width="22" height="46" fill="#eceff2"/>
      <rect x="65" y="34" width="7" height="46" fill="#c2c8cf"/>
      <rect x="51" y="34" width="3.4" height="46" fill="#fbfcfd"/>
      <path d="M50 36C50 24 55 14 61 11c6 3 11 13 11 25Z" fill="#eceff2"/>
      <path d="M61 11c6 3 11 13 11 25h-7c0-11-1.6-20-4-25Z" fill="#c2c8cf"/>
      <path d="M61 11c-4 3-8.4 13-8.4 25H51c0-12 4.4-22 10-25Z" fill="#fbfcfd"/>
      <rect x="50" y="55" width="22" height="7" fill="#3b4149"/>
      <rect x="50" y="57" width="22" height="5" fill="#22262b"/>
      <rect x="50" y="71" width="22" height="3" fill="#cf4a3c"/>
      <!-- plume -->
      <path d="M51 88h20c0 6.6-4 12-10 17-6-5-10-10.4-10-17Z" fill="#f2a33c"/>
      <path d="M55 88h12c0 4.6-2.4 8.6-6 12.4-3.6-3.8-6-7.8-6-12.4Z" fill="#ffd98a"/>
      <path d="M58.2 88h5.6c0 3-1.2 5.6-2.8 7.6-1.6-2-2.8-4.6-2.8-7.6Z" fill="#fff3d0"/>
      ${smoke}`
    },
  },
  'Mission to Mars': {
    subject: 'the red planet with its polar cap, and a six-wheeled rover on regolith in front of it — mast camera, solar deck, dish',
    palette: [SHADOW, '#7e3524', '#8d3427', '#a03e2b', '#c1543a', '#e0774f', '#f2e2d8', '#33383e', '#6b7379', '#9aa2aa', '#dfe3e7', '#a87a28', '#d9a441', '#2b4a7c', '#4a76ad'],
    draw: () => {
      // Deliberately not a second rocket. The planet carries the destination
      // and the rover carries the mission, and the two are at wildly different
      // scales on purpose — a rover drawn small enough to be "correct" against
      // a 26-unit Mars would be four pixels of grey.
      const wheel = (cx: number, cy: number, r: number) =>
        [0, 60, 120, 180, 240, 300]
          .map(
            (a) =>
              `<rect x="${n(cx - 0.6)}" y="${n(cy - r - 0.8)}" width="1.2" height="2.4" fill="#6b7379" transform="rotate(${a} ${n(cx)} ${n(cy)})"/>`,
          )
          .join('') +
        `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="#33383e"/>` +
        `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r * 0.62)}" fill="#6b7379"/>` +
        `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r * 0.3)}" fill="#9aa2aa"/>` +
        `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r * 0.12)}" fill="#33383e"/>`
      // Solar-cell seams follow the deck's taper rather than running vertically,
      // which is the only thing making the deck read as a plane rather than a bar.
      const seams = [1, 2, 3, 4, 5]
        .map((k) => {
          const f = k / 6
          return `<path d="M${n(22 + 48 * f)} 66L${n(14 + 64 * f)} 74" stroke="#33383e" stroke-width="0.9" fill="none" opacity="0.65"/>`
        })
        .join('')
      const pebbles = ([
        [26, 92, 4, 1.6], [41, 100, 5, 1.8], [78, 92, 4.5, 1.6], [92, 99, 4, 1.5], [62, 102, 6, 2],
      ] as number[][])
        .map(
          ([x, y, rx, ry]) =>
            `<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(rx)}" ry="${n(ry)}" fill="#8d3427"/>` +
            `<ellipse cx="${n(x)}" cy="${n(y - ry * 0.5)}" rx="${n(rx * 0.7)}" ry="${n(ry * 0.5)}" fill="#e0774f" opacity="0.55"/>`,
        )
        .join('')
      return `
      <!-- Mars: base disc, a lit limb to the left, the terminator to the right -->
      <circle cx="82" cy="35" r="26" fill="#c1543a"/>
      <path d="M82 9A26 26 0 0 0 82 61 30 30 0 0 1 82 9Z" fill="#e0774f"/>
      <path d="M82 61A26 26 0 0 0 82 9 34 34 0 0 0 82 61Z" fill="#8d3427"/>
      <ellipse cx="74" cy="28" rx="10" ry="5.5" transform="rotate(-18 74 28)" fill="#a03e2b"/>
      <ellipse cx="88" cy="44" rx="8" ry="4.5" transform="rotate(12 88 44)" fill="#a03e2b" opacity="0.8"/>
      <ellipse cx="70" cy="46" rx="5.5" ry="3" transform="rotate(-8 70 46)" fill="#a03e2b"/>
      <path d="M68 38q10 4 22 2" stroke="#7e3524" stroke-width="2.2" stroke-linecap="round" fill="none"/>
      <ellipse cx="80" cy="13.5" rx="11" ry="4" fill="#f2e2d8"/>
      <ellipse cx="86" cy="57" rx="7" ry="2.6" fill="#f2e2d8" opacity="0.7"/>
      <!-- regolith -->
      <ellipse cx="58" cy="96" rx="47" ry="12" fill="#8d3427"/>
      <path d="M11 96a47 12 0 0 1 94 0Z" fill="#c1543a"/>
      ${pebbles}
      ${shadow(44, 103, 26, 4.4, SHADOW)}
      <!-- rover -->
      ${wheel(26, 93, 6.2)}
      ${wheel(44, 93, 6.2)}
      ${wheel(62, 93, 6.2)}
      <path d="M34 84L26 91M34 84L44 91M54 84L62 91" stroke="#9aa2aa" stroke-width="2.6" stroke-linecap="round" fill="none"/>
      <path d="M34 84L54 84" stroke="#6b7379" stroke-width="2.4" stroke-linecap="round" fill="none"/>
      <path d="M26 82L16 88L20 94" stroke="#9aa2aa" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <circle cx="20" cy="94" r="2.2" fill="#6b7379"/>
      <rect x="24" y="74" width="42" height="13" rx="2.6" fill="#dfe3e7"/>
      <rect x="24" y="82" width="42" height="5" rx="2" fill="#9aa2aa"/>
      <rect x="28" y="76" width="18" height="6" rx="1.2" fill="#d9a441"/>
      <rect x="28" y="79.6" width="18" height="2.4" rx="1" fill="#a87a28"/>
      <rect x="50" y="76" width="12" height="5" rx="1.2" fill="#6b7379"/>
      <path d="M66.6 59L68.4 66" stroke="#6b7379" stroke-width="1.8" fill="none"/>
      <ellipse cx="66.8" cy="59.2" rx="7.5" ry="3.4" transform="rotate(-24 66.8 59.2)" fill="#6b7379"/>
      <ellipse cx="66" cy="58" rx="7.5" ry="3.4" transform="rotate(-24 66 58)" fill="#dfe3e7"/>
      <path d="M22 66h48l8 8H14Z" fill="#2b4a7c"/>
      <path d="M22 66h48l4 4H18Z" fill="#4a76ad"/>
      ${seams}
      <rect x="27" y="52" width="3.6" height="15" fill="#9aa2aa"/>
      <rect x="29.2" y="52" width="1.4" height="15" fill="#6b7379"/>
      <rect x="19" y="44" width="17" height="8" rx="1.8" fill="#dfe3e7"/>
      <rect x="19" y="49" width="17" height="3" rx="1.4" fill="#9aa2aa"/>
      <circle cx="23.5" cy="47.6" r="2" fill="#33383e"/>
      <circle cx="31.5" cy="47.6" r="2" fill="#33383e"/>
      <circle cx="22.8" cy="46.9" r="0.7" fill="#dfe3e7"/>
      <circle cx="30.8" cy="46.9" r="0.7" fill="#dfe3e7"/>`
    },
  },
  'Superyacht': {
    subject: 'a motor yacht from the bow quarter — dark hull, white flybridge, tinted glass, a bow wave',
    palette: [
      '#57b6cb', '#3a95ac', '#8ed7e1', '#eaf8fb',
      '#16283c', '#23425f', '#3a6b92',
      '#ffffff', '#e5ecf0', '#c2d0d9',
      '#1e2c37', '#e7dcc2', '#c9bb9c', '#6f818d',
    ],
    draw: () => {
      // The boat is built on one axis: bow at (24,79), stern at (102,55.5),
      // beam foreshortened by (0.5,0.6) per unit. Every deck line below is that
      // axis offset, which is the only way a three-quarter view stays coherent
      // once there are four decks stacked on it.
      const SHEER = -0.301 // screen slope of every deck edge, bow to stern
      // Hull portholes follow the sheer rather than sitting level; level ones
      // made the boat look like it was going down by the head.
      const ports = [0, 1, 2, 3, 4]
        .map((i) => {
          const x = 43 + i * 10.5
          const y = 77.2 + SHEER * (x - 43)
          return `<path d="M${n(x)} ${n(y)}l7 -2.1 0 2.4 -7 2.1Z" fill="#1e2c37"/>`
        })
        .join('')
      // Mullions down the saloon glass, each sheared to sit on the sheer.
      const mull = [70, 77.5, 85]
        .map((x) => {
          const t = 64 + SHEER * (x - 64)
          return `<path d="M${n(x)} ${n(t + 6.5)}l1.2 ${n(SHEER * 1.2)} 0 -6.5 -1.2 ${n(-SHEER * 1.2)}Z" fill="#ffffff"/>`
        })
        .join('')
      const ripples = [
        [17, 71, 5], [104, 65, 4], [21, 85, 7], [45, 96, 9],
        [77, 89, 8], [99, 81, 6], [63, 100, 7], [33, 77, 4],
      ]
        .map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="1" fill="#8ed7e1" opacity="0.6"/>`)
        .join('')
      return `
      <!-- open water: far side lighter, near side deeper, so the plane reads -->
      <path d="M14 76C18 63 40 57 62 58 84 59 106 65 108 78 110 91 102 100 88 100L30 100C16 100 11 89 14 76Z" fill="#57b6cb"/>
      <path d="M14 76C18 63 40 57 62 58 84 59 106 65 108 78 84 73 44 73 16 83 13.8 81 13.6 78.5 14 76Z" fill="#8ed7e1"/>
      <path d="M13.6 86C40 97 86 96 108.6 84 110 92 102 100 88 100L30 100C18 100 14 93 13.6 86Z" fill="#3a95ac"/>
      ${ripples}
      <!-- hull -->
      <path d="M24 79 41 78.4 55.8 76.2 83.1 67.9 105.8 60C107 61 107 69 105.8 70L83.1 78.9 55.8 87.2 41 89.4 31 90C26.5 89.4 23.6 84.6 24 79Z" fill="#23425f"/>
      <path d="M24 79 41 78.4 55.8 76.2 83.1 67.9 105.8 60 105.8 63.4 83.1 71.3 55.8 79.6 41 81.8 24.3 82.4Z" fill="#3a6b92"/>
      <path d="M31 90 41 89.4 55.8 87.2 83.1 78.9 105.8 70 105.8 66.6 83.1 75.5 55.8 83.8 41 86 29.8 86.6C30 88 30.4 89.3 31 90Z" fill="#16283c"/>
      <path d="M24 79 41 78.4 55.8 76.2 83.1 67.9 105.8 60l0 1.9 -22.7 8 -27.3 8.2 -14.8 2.2 -16.9 0.6Z" fill="#e5ecf0"/>
      ${ports}
      <!-- foredeck, seen from above: teak between two white bulwarks -->
      <path d="M24 79 41 78.4 61.3 74.5 52.3 63.7 35.5 71.8Z" fill="#e7dcc2"/>
      <path d="M24 79 35.5 71.8 52.3 63.7 53.6 65.2 37 73.2 25.4 80.2Z" fill="#ffffff"/>
      <path d="M28.5 77.6 51 68" stroke="#c9bb9c" stroke-width="0.6" fill="none"/>
      <path d="M31 79.6 54 70.2" stroke="#c9bb9c" stroke-width="0.6" fill="none"/>
      <!-- aft deck -->
      <path d="M85.8 53.6 94.8 64.4 105.8 60 98.2 51Z" fill="#e7dcc2"/>
      <!-- main deckhouse -->
      <path d="M61.3 74.5 94.8 64.4 94.8 49.4 65.1 58.4Z" fill="#e5ecf0"/>
      <path d="M52.3 63.7 61.3 74.5 65.1 58.4 56.1 47.6Z" fill="#ffffff"/>
      <path d="M61.3 74.5 94.8 64.4 94.8 62.3 61.3 72.4Z" fill="#c2d0d9"/>
      <path d="M64 70.5 92.5 61.9 92.5 55.4 64 64Z" fill="#1e2c37"/>
      ${mull}
      <path d="M53.6 60.1 62.6 70.9 63.8 65.5 54.8 54.7Z" fill="#1e2c37"/>
      <!-- flybridge -->
      <path d="M66.25 56.15 88.05 49.6 88.05 40.1 69.15 45.8Z" fill="#e5ecf0"/>
      <path d="M59.75 48.35 66.25 56.15 69.15 45.8 62.65 38Z" fill="#ffffff"/>
      <path d="M69.15 45.8 88.05 40.1 81.55 32.3 62.65 38Z" fill="#c2d0d9"/>
      <path d="M68.1 52.9 86.5 47.4 86.5 43.4 68.1 48.9Z" fill="#1e2c37"/>
      <path d="M61.2 46.5 67.1 53.6 68.5 48.5 62.6 41.4Z" fill="#1e2c37"/>
      <!-- radar mast -->
      <path d="M73.6 38.6h1.8l1.1 -16h-1.6Z" fill="#6f818d"/>
      <path d="M69.5 27.6 80.2 26.1 80.4 27.4 69.7 28.9Z" fill="#6f818d"/>
      <ellipse cx="75.2" cy="22.6" rx="4.4" ry="1.5" fill="#c2d0d9"/>
      <path d="M75 21.4h1v-4h-1Z" fill="#6f818d"/>
      <!-- bow wave and the wake trailing off the quarter -->
      <path d="M29.6 87.4C24 90 19 92.6 14.5 93.6 21 95.6 28.2 94.6 33.4 91.6 31.6 90.2 30.4 88.9 29.6 87.4Z" fill="#eaf8fb"/>
      <path d="M33 91.6 55.8 88.6 83.1 80.1 105.4 71.4 105.7 73.8 83.1 82.6 55.8 91.2 33.2 94.2Z" fill="#eaf8fb" opacity="0.8"/>
      <ellipse cx="101" cy="74.5" rx="7" ry="2.6" fill="#eaf8fb" opacity="0.7"/>`
    },
  },
  'Cruise ship': {
    subject: 'a cruise liner broadside — a floating block of flats, balcony rows, lifeboats, twin funnels',
    palette: [
      '#1d4e78', '#123a5c', '#4d87b4', '#dfeef6',
      '#0e1b28', '#1c3450', '#33557a',
      '#f7f8f9', '#dfe6ea', '#c0ccd3',
      '#2a3c4e', '#e2803c', '#f2b183', '#2c343c', '#5d666f',
    ],
    draw: () => {
      // Cabin rows are one dark band per deck with white piers laid across all
      // of them, not 90 separate windows: at 110px the piers are what you see,
      // and this way every row lines up by construction.
      const rows: [number, number][] = [[38, 62], [43, 66], [48, 70], [53, 72], [58, 72], [63, 72]]
      const bands = rows
        .map(([y, w]) => `<rect x="22" y="${y}" width="${w}" height="3.4" fill="#2a3c4e"/>`)
        .join('')
      const sills = rows
        .map(([y, w]) => `<rect x="22" y="${n(y + 3.4)}" width="${w}" height="0.9" fill="#c0ccd3"/>`)
        .join('')
      const piers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
        .map((i) => `<rect x="${n(22.8 + i * 5.1)}" y="36" width="1.7" height="32" fill="#f7f8f9"/>`)
        .join('')
      const boats = [0, 1, 2, 3, 4, 5, 6, 7]
        .map((i) => {
          const x = 24 + i * 8.4
          return (
            `<rect x="${n(x)}" y="68.6" width="7" height="4.2" rx="1.7" fill="#e2803c"/>` +
            `<rect x="${n(x)}" y="68.6" width="7" height="1.7" rx="0.85" fill="#f2b183"/>`
          )
        })
        .join('')
      const ports = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
        .map((i) => `<rect x="${n(24 + i * 6.4)}" y="78" width="2.6" height="2" rx="1" fill="#33557a"/>`)
        .join('')
      const swell = [
        [16, 96, 13], [42, 99, 17], [70, 95, 15], [96, 99, 12], [30, 102, 11], [84, 102, 14],
      ]
        .map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="1.1" fill="#4d87b4" opacity="0.7"/>`)
        .join('')
      return `
      <!-- a flat calm: one long band, nothing like the yacht's open swell -->
      <path d="M11 92h98c1.6 0 2.4 1 2.4 2.6v8.8c0 1.6-0.8 2.6-2.4 2.6H11c-1.6 0-2.4-1-2.4-2.6v-8.8C8.6 93 9.4 92 11 92Z" fill="#1d4e78"/>
      <path d="M8.6 99h102.8v4.4c0 1.6-0.8 2.6-2.4 2.6H11c-1.6 0-2.4-1-2.4-2.6Z" fill="#123a5c"/>
      ${swell}
      <!-- hull: a dark slab that sits deep, with a raked stem at the bow -->
      <path d="M16 74h78c9 0 15 3 18.5 10v4c0 3-2 4.6-5 4.6H23c-6 0-8-3.4-8-8.6v-7C15 75 15.4 74 16 74Z" fill="#0e1b28"/>
      <path d="M16 74h78c9 0 15 3 18.5 10H15v-9C15 75 15.4 74 16 74Z" fill="#1c3450"/>
      ${ports}
      <rect x="15" y="88.6" width="96" height="1.6" fill="#33557a"/>
      <!-- superstructure: eight decks of it, which is the whole joke -->
      <path d="M20 34h68l14 12v28H17V37c0-1.8 1.2-3 3-3Z" fill="#f7f8f9"/>
      <path d="M88 34l14 12v28h-8V44Z" fill="#dfe6ea"/>
      <rect x="17" y="72" width="85" height="2" fill="#c0ccd3"/>
      ${bands}
      ${sills}
      ${piers}
      ${boats}
      <!-- sun deck, funnels and the forward mast -->
      <path d="M22 28h62c5 0 9 2.6 11 6H20c0-3.4 0.8-6 2-6Z" fill="#dfe6ea"/>
      <rect x="20" y="30" width="75" height="4" fill="#f7f8f9"/>
      <ellipse cx="38" cy="31.6" rx="7" ry="2.2" fill="#4d87b4"/>
      <path d="M43 30h14l-1.8-13h-9.4Z" fill="#2c343c"/>
      <path d="M43 30h5l-1.4-13h-2.6Z" fill="#5d666f"/>
      <rect x="43.7" y="22" width="12.7" height="2.6" fill="#dfeef6"/>
      <path d="M62 30h14l-1.8-13h-9.4Z" fill="#2c343c"/>
      <path d="M62 30h5l-1.4-13h-2.6Z" fill="#5d666f"/>
      <rect x="62.7" y="22" width="12.7" height="2.6" fill="#dfeef6"/>
      <path d="M92 34h2.4l1.2-14h-1.6Z" fill="#5d666f"/>
      <path d="M89 24h9.4v1.4H89Z" fill="#5d666f"/>
      <!-- bow flare and the anchor pocket -->
      <path d="M94 74h8l-1-8Z" fill="#dfe6ea"/>
      <ellipse cx="104" cy="80" rx="2" ry="1.4" fill="#0e1b28"/>`
    },
  },
  'Aircraft carrier': {
    subject: 'a carrier from above the port bow — flat deck, angled landing strip, island to starboard, two jets',
    palette: [
      '#4d7370', '#2f5457', '#86aca4', '#dff0ea',
      '#8f978f', '#78807a', '#a6ada4', '#eef1ec', '#d9bb47',
      '#4e5a55', '#626e68', '#37423e',
      '#7c857e', '#2f3a38', '#5a635e',
      '#6d7a73', '#566159', '#99a49c',
    ],
    draw: () => {
      // The whole deck is one plane: along-ship (1,-0.128), across-ship
      // (0.4,-1). Markings and aircraft are placed in that basis, which is why
      // they all lie down rather than floating above the deck.
      const dash = [0, 1, 2, 3, 4, 5, 6]
        .map((i) => {
          const x = 40 + i * 7.6
          const y = 68.6 - 0.117 * (x - 40)
          return `<path d="M${n(x)} ${n(y)}l4.6 -0.55 0 -1.4 -4.6 0.55Z" fill="#eef1ec"/>`
        })
        .join('')
      const crests = [
        [18, 95, 5], [34, 100, 6], [52, 94, 5], [66, 101, 6],
        [82, 93, 5], [96, 99, 6], [26, 88, 4], [60, 87, 4],
      ]
        .map(([x, y, w]) => `<path d="M${x} ${y}l${w} -2.4 ${w} 2.4Z" fill="#86aca4"/>`)
        .join('')
      // One jet, drawn already foreshortened: swept wings, twin fins, canopy.
      const jet = (x: number, y: number, s: number) => `<g transform="translate(${x} ${y}) scale(${s})">
        <path d="M-9 -4.8-11.6 -4.2-6.4 -1-2.6 -1.2Z" fill="#566159"/>
        <path d="M-9 4.4-11.6 3.8-6.4 0.8-2.6 1Z" fill="#6d7a73"/>
        <path d="M-12 0.6 12.4 -0.2 14 0.5 12.4 1.3 -12 1.9C-13 1.5-13 1-12 0.6Z" fill="#99a49c"/>
        <path d="M-12 0.6 12.4 -0.2 12.4 -1.2 -11.4 -0.4C-12.4 -0.1-12.6 0.3-12 0.6Z" fill="#6d7a73"/>
        <path d="M-10.6 -2.6-13 -3.4-13 -2.2-11 -1.4Z" fill="#566159"/>
        <ellipse cx="7" cy="0.1" rx="2.4" ry="0.9" fill="#2f3a38"/>
      </g>`
      return `
      <!-- a working sea: crests, not a flat band -->
      <path d="M10 92C18 86 34 88 48 87 66 86 84 80 104 78.4 108.6 78.2 110 81.6 110 87v11c0 4-3 6.4-7.4 6.4H19C13 104.4 10 101 10 96Z" fill="#4d7370"/>
      <path d="M10 96C30 102 84 102 110 95v3c0 4-3 6.4-7.4 6.4H19C13 104.4 10 101 10 96Z" fill="#2f5457"/>
      ${crests}
      <ellipse cx="101" cy="81" rx="10" ry="3.4" fill="#dff0ea" opacity="0.75"/>
      <!-- hull below the deck edge -->
      <path d="M12 68.5 20 77 98 67 99 80 26 89.5C18 88 13 80 12 68.5Z" fill="#4e5a55"/>
      <path d="M12 68.5 20 77 98 67 98.4 71 20.6 81.4 12.6 73.6Z" fill="#626e68"/>
      <path d="M20 81 98 70.7 99 80 26 89.5C22 88.8 20.4 85.4 20 81Z" fill="#37423e"/>
      <path d="M32 78.8 41 77.6 41.4 81.4 32.4 82.6Z" fill="#37423e"/>
      <path d="M62 74.8 71 73.6 71.4 77.4 62.4 78.6Z" fill="#37423e"/>
      <!-- flight deck -->
      <path d="M12 68.5 20 77 98 67 106 47 28 57Z" fill="#8f978f"/>
      <path d="M12 68.5 20 77 98 67 98.6 65.4 20.8 75.4 14.2 68Z" fill="#78807a"/>
      <path d="M28 57 106 47 104.6 50.4 27.4 60.2Z" fill="#a6ada4"/>
      <!-- the angled landing area, set in a darker non-skid -->
      <path d="M34 71 95 63.7 95 57.7 34 65Z" fill="#78807a"/>
      <path d="M34 71 95 63.7 95 62.8 34 70.1Z" fill="#eef1ec"/>
      <path d="M34 65 95 57.7 95 58.6 34 65.9Z" fill="#eef1ec"/>
      ${dash}
      <!-- bow catapult tracks and the foul line -->
      <path d="M20.5 70.4 63 65.4 63 64.3 20.6 69.3Z" fill="#eef1ec"/>
      <path d="M25.5 63.6 68 58.6 68 57.5 25.6 62.5Z" fill="#eef1ec"/>
      <path d="M22 73.6 96 65 96 63.8 22 72.4Z" fill="#d9bb47"/>
      <path d="M14.6 67.4 24 66.2 24.6 69.8 16.6 70.8Z" fill="#d9bb47"/>
      <!-- parked aircraft -->
      ${jet(44, 61.2, 1)}
      ${jet(82, 56.4, 0.92)}
      <!-- island, its shadow, and the mast -->
      <path d="M66 55.6 85 52.8 80 59.6 61 62.4Z" fill="#78807a" opacity="0.7"/>
      <path d="M67 55 85 52.4 85 40 67 42.6Z" fill="#7c857e"/>
      <path d="M67 55 71 54.4 71 42 67 42.6Z" fill="#5a635e"/>
      <path d="M70 42.4 82 40.7 82 33 70 34.7Z" fill="#8f978f"/>
      <path d="M71 39.6 81 38.2 81 35.8 71 37.2Z" fill="#2f3a38"/>
      <path d="M75.6 33.4h1.8l0.8 -14h-1.4Z" fill="#5a635e"/>
      <path d="M72.4 26.6 81 25.4 81.2 26.6 72.6 27.8Z" fill="#5a635e"/>
      <path d="M73.6 30.4 80 29.5 80.2 30.7 73.8 31.6Z" fill="#5a635e"/>
      <ellipse cx="77" cy="22.4" rx="3.6" ry="1.3" fill="#a6ada4"/>`
    },
  },
  'Nuclear submarine': {
    subject: 'a boat running on the surface — sail and casing above a dark sea, the hull showing through below',
    palette: [
      '#1a4560', '#0d2a3d', '#2c6e8e', '#12384f', '#e6f2f6',
      '#171c21', '#262f37', '#3d4a54', '#0e1215',
      '#4e5f6b',
    ],
    draw: () => {
      // Anechoic tiling is the one detail that makes a black fin read as a
      // submarine rather than a shark, so it is drawn as a real grid on both
      // the sail and the exposed casing.
      const tiles: string[] = []
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
          tiles.push(
            `<rect x="${n(47 + c * 3.4)}" y="${n(32 + r * 3.8)}" width="2.6" height="2.8" fill="#262f37"/>`,
          )
        }
      }
      for (let c = 0; c < 6; c++) {
        tiles.push(`<rect x="${n(70 + c * 4.4)}" y="53.4" width="3.4" height="2.4" fill="#262f37"/>`)
        tiles.push(`<rect x="${n(22 + c * 3.2)}" y="54.2" width="2.4" height="2.2" fill="#262f37"/>`)
      }
      const ripples = [
        [20, 66, 8], [86, 64, 9], [30, 76, 11], [96, 74, 8],
        [16, 86, 9], [56, 84, 13], [98, 90, 10], [40, 94, 12], [76, 97, 11],
      ]
        .map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="1.1" fill="#2c6e8e" opacity="0.55"/>`)
        .join('')
      return `
      <!-- the sea takes half the stage, because almost all of the boat is in it -->
      <path d="M12 58h96c2.4 0 3.6 1.4 3.6 3.6v36c0 3.4-2.4 5.6-6 5.6H14.4c-3.6 0-6-2.2-6-5.6v-36C8.4 59.4 9.6 58 12 58Z" fill="#1a4560"/>
      <path d="M8.4 84h103.2v13.6c0 3.4-2.4 5.6-6 5.6H14.4c-3.6 0-6-2.2-6-5.6Z" fill="#0d2a3d"/>
      <!-- the pressure hull, seen through the water -->
      <path d="M22 62C34 58 92 58 102 63c4 2 4 10 0 13-12 6-70 6-80 1-5-2.4-5-12 0-15Z" fill="#12384f"/>
      <path d="M104 64c4 1.6 6 4.4 6 6.6 0 2.4-2 4.6-6 6Z" fill="#12384f"/>
      <path d="M100 70h10v1.6h-10Z" fill="#12384f"/>
      ${ripples}
      <!-- exposed casing: a low whaleback, barely proud of the surface -->
      <path d="M18 59.2C30 50 92 49.4 104 58.6c1.6 1.2 1 2.4-1 2.4H19.6C17.4 61 16.6 60.2 18 59.2Z" fill="#171c21"/>
      <path d="M18 59.2C30 50 92 49.4 104 58.6 92 52.6 30 53.2 19.4 60Z" fill="#3d4a54"/>
      <!-- the sail, with its planes and masts -->
      <path d="M42 56C42 38 45 27.6 52 26.4h10c3 3.6 4 14 4 29.6Z" fill="#171c21"/>
      <path d="M42 56C42 38 45 27.6 52 26.4h3.6C49.6 30 47 41 47 56Z" fill="#3d4a54"/>
      <path d="M66 52C66 40 65.4 32 63 28.4l2.4 -0.6C67.4 32 68 40 68 52Z" fill="#0e1215"/>
      ${tiles}
      <path d="M34.6 37.2h40.8c1.2 0 1.8 0.6 1.8 1.6s-0.6 1.6-1.8 1.6H34.6c-1.2 0-1.8-0.6-1.8-1.6s0.6-1.6 1.8-1.6Z" fill="#171c21"/>
      <path d="M34.6 37.2h40.8c1.2 0 1.8 0.6 1.8 1.6H32.8c0-1 0.6-1.6 1.8-1.6Z" fill="#4e5f6b"/>
      <path d="M53.4 26.4h1.8l0.8 -13.6h-1.4Z" fill="#4e5f6b"/>
      <path d="M58.6 26.4h1.8l0.6 -9.4h-1.2Z" fill="#4e5f6b"/>
      <path d="M50.6 19.4h8.2v1.2h-8.2Z" fill="#4e5f6b"/>
      <!-- where the boat actually meets the water -->
      <path d="M19.6 57.6h84.8v2.2H19.6Z" fill="#e6f2f6" opacity="0.5"/>
      <path d="M20 58.8C15 60.4 12.4 62.6 11.4 65 17 64.4 22.6 62.4 26.4 59.6 24 59.6 21.8 59.4 20 58.8Z" fill="#e6f2f6"/>
      <path d="M104 58.8c3.6 1.4 6 3.4 6.6 5.6-5.6-0.6-10.6-2.2-14-4.4 2.6-0.2 5.2-0.6 7.4-1.2Z" fill="#e6f2f6" opacity="0.8"/>
      <path d="M26 61.6C44 65.4 82 65.2 100 61.4 82 68 44 68 26 61.6Z" fill="#e6f2f6" opacity="0.45"/>`
    },
  },
  'Family home': {
    subject: 'a modest suburban house three-quarter on — pitched roof, gable end, chimney, front door and path',
    palette: [
      SHADOW, '#efe3cd', '#d3c3a6', '#e7d9c0', '#c4b294',
      '#4a4f55', '#3a3f45', '#5e646c',
      '#47657f', '#6d8aa2', '#fbfaf6',
      '#2e6a6a', '#3d8181', '#d8b463',
      '#a3574a', '#7f4237', '#ded6c6',
      '#3f7a4a', '#2d5c38', '#5a9a62',
    ],
    draw: () => {
      // Shingle courses run parallel to the eave, stepping from ridge to gutter
      // down the slope vector (30,26). Without them the roof is one dark
      // lozenge and the house stops being a house.
      const courses = [1, 2, 3, 4, 5]
        .map((i) => {
          const t = i / 6
          return `<path d="M${n(50 + t * 30)} ${n(34 + t * 26)} ${n(72 + t * 30)} ${n(25 + t * 26)}" stroke="#3a3f45" stroke-width="0.7" fill="none"/>`
        })
        .join('')
      const siding = [0, 1, 2, 3, 4, 5, 6]
        .map((i) => `<rect x="24" y="${n(60.5 + i * 5.4)}" width="52" height="0.7" fill="#c4b294"/>`)
        .join('')
      const win = (x: number, y: number) => `<rect x="${x}" y="${y}" width="13" height="14" rx="0.6" fill="#fbfaf6"/>
        <rect x="${n(x + 1.4)}" y="${n(y + 1.4)}" width="10.2" height="11.2" fill="#47657f"/>
        <path d="M${n(x + 1.4)} ${n(y + 12.6)} ${n(x + 11.6)} ${n(y + 1.4)} ${n(x + 11.6)} ${n(y + 5.4)} ${n(x + 5.4)} ${n(y + 12.6)}Z" fill="#6d8aa2"/>
        <rect x="${n(x + 6)}" y="${n(y + 1.4)}" width="1" height="11.2" fill="#fbfaf6"/>
        <rect x="${n(x + 1.4)}" y="${n(y + 6.4)}" width="10.2" height="1" fill="#fbfaf6"/>
        <rect x="${n(x - 0.8)}" y="${n(y + 14)}" width="14.6" height="1.6" rx="0.5" fill="#fbfaf6"/>`
      const bush = (cx: number, cy: number, r: number) => `<ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${n(r * 0.86)}" fill="#2d5c38"/>
        <ellipse cx="${n(cx - r * 0.25)}" cy="${n(cy - r * 0.2)}" rx="${n(r * 0.7)}" ry="${n(r * 0.6)}" fill="#3f7a4a"/>
        <ellipse cx="${n(cx - r * 0.4)}" cy="${n(cy - r * 0.35)}" rx="${n(r * 0.34)}" ry="${n(r * 0.28)}" fill="#5a9a62"/>`
      return `
      ${shadow(60, 104, 38, 5, SHADOW)}
      <path d="M45 98h14l6 8H39Z" fill="#ded6c6"/>
      <path d="M47.6 101.4h10.4M43.6 104.8h15.6" stroke="#c4b294" stroke-width="0.7" fill="none"/>
      <!-- the roof plane that faces us, and the gable end beside it -->
      <path d="M50 34 72 25 102 51 80 60Z" fill="#4a4f55"/>
      ${courses}
      <path d="M72 25 102 51 100.4 52.6 70.6 26.8Z" fill="#5e646c"/>
      <!-- right wall, set back -->
      <path d="M76 58 98 49 98 88 76 98Z" fill="#d3c3a6"/>
      <path d="M82 63.4 92 59.4 92 73.4 82 77.4Z" fill="#fbfaf6"/>
      <path d="M83.4 65.2 90.6 62.3 90.6 72 83.4 74.9Z" fill="#47657f"/>
      <path d="M83.4 72.6 90.6 62.3 90.6 65.4 84.8 73.4Z" fill="#6d8aa2"/>
      <!-- front wall and gable -->
      <path d="M24 58h52v40H24Z" fill="#efe3cd"/>
      ${siding}
      <path d="M26 58 50 39.4 74 58Z" fill="#e7d9c0"/>
      <path d="M26 58 50 39.4 50 58Z" fill="#efe3cd"/>
      <path d="M46.6 50.6h6.8l1.6 4.4h-10Z" fill="#4a4f55"/>
      <path d="M46.6 50.6h2.4l-0.6 4.4h-3.4Z" fill="#5e646c"/>
      <!-- barge boards over the gable, and the eave line -->
      <path d="M19.6 60.6 50 37 80.4 60.6 78.2 63 50 41.2 21.8 63Z" fill="#3a3f45"/>
      <path d="M22 96h56v2.4H22Z" fill="#c4b294"/>
      ${win(28, 66)}
      ${win(57, 66)}
      <!-- front door -->
      <path d="M45 72h14v26H45Z" fill="#2e6a6a"/>
      <path d="M45 72h4v26h-4Z" fill="#3d8181"/>
      <path d="M50.4 75h6.2v7h-6.2Z" fill="#3d8181"/>
      <path d="M50.4 85h6.2v9.6h-6.2Z" fill="#3d8181"/>
      <circle cx="48" cy="86" r="1.1" fill="#d8b463"/>
      <path d="M43.4 70.4h17.2v2.2H43.4Z" fill="#fbfaf6"/>
      <!-- chimney, standing square on the roof plane -->
      <path d="M80 44h7V31h-7Z" fill="#a3574a"/>
      <path d="M87 44 92.6 41.7 92.6 28.7 87 31Z" fill="#7f4237"/>
      <path d="M80 31h7l5.6-2.3h-7Z" fill="#c4b294"/>
      <path d="M80.6 35h6.8M80.6 39h6.8" stroke="#7f4237" stroke-width="0.7" fill="none"/>
      ${bush(21, 92, 7)}
      ${bush(86, 93, 6)}`
    },
  },
  'Beach villa': {
    subject: 'a low flat-roofed villa behind a turquoise pool, glass walls and a palm leaning in from the left',
    palette: [
      SHADOW, '#f8f6ef', '#ddd7c6', '#ffffff', '#c3bba6',
      '#234451', '#47707f', '#16313c',
      '#3fbcd0', '#2691a6', '#a7e6ef', '#f3eee0', '#e9dfc9',
      '#8a6a4a', '#6a5136', '#3d8a52', '#2d6a3e', '#5aa868',
    ],
    draw: () => {
      // Two glazed bays broken by a stucco pier, each with its own mullions:
      // one unbroken band of glass across the whole front read as a shop.
      const mullions = [28, 36, 44, 52, 68, 76, 84]
        .map((x) => `<rect x="${x}" y="62" width="1.4" height="22" fill="#f8f6ef"/>`)
        .join('')
      const upper = [70, 78, 86]
        .map((x) => `<rect x="${x}" y="42" width="1.3" height="14" fill="#f8f6ef"/>`)
        .join('')
      // Fronds are listed as tip + the two bow points, so each one keeps its
      // own droop; a mirrored pair looked like a propeller.
      const fronds: [number, number, number, number, number, number][] = [
        [9, 41, 12, 42, 15, 47], [17, 35, 14, 40, 20, 41], [27, 38, 22, 37, 24, 44],
        [31, 47, 26, 43, 27, 50], [24, 56, 24, 48, 19, 53], [10, 51, 13, 47, 14, 54],
      ]
      const palm = fronds
        .map(([tx, ty, ax, ay, bx, by], i) => {
          const tone = i % 2 === 0 ? '#2d6a3e' : '#3d8a52'
          return `<path d="M17 50Q${ax} ${ay} ${tx} ${ty}Q${bx} ${by} 17 50Z" fill="${tone}"/>`
        })
        .join('')
      const loungers = [64, 78]
        .map((x) => `<path d="M${x} 90h11v2h-11Z" fill="#f3eee0"/>
        <path d="M${x} 90h3.4l1.4-4h-3.4Z" fill="#ffffff"/>
        <path d="M${n(x + 1)} 92h1v2h-1M${n(x + 9)} 92h1v2h-1" fill="#c3bba6"/>`)
        .join('')
      return `
      ${shadow(60, 104, 42, 5, SHADOW)}
      <!-- terrace -->
      <path d="M14 100 106 100 97 83 23 83Z" fill="#e9dfc9"/>
      <path d="M14 100 106 100 104 96 16 96Z" fill="#c3bba6"/>
      <!-- pool, deep end nearest -->
      <path d="M28 97 92 97 86 86 34 86Z" fill="#f3eee0"/>
      <path d="M30.4 95.6 89.6 95.6 84.6 87.4 35.4 87.4Z" fill="#3fbcd0"/>
      <path d="M30.4 95.6 89.6 95.6 87.8 92.6 32.2 92.6Z" fill="#2691a6"/>
      <path d="M37 89.6h46M34.6 93.8h50.8" stroke="#a7e6ef" stroke-width="0.9" fill="none"/>
      ${loungers}
      <!-- upper block, set back to the right -->
      <path d="M58 34h42v4.6H58Z" fill="#ffffff"/>
      <path d="M58 38.6h42v1.8H58Z" fill="#c3bba6"/>
      <path d="M62 40.4h34v18H62Z" fill="#f8f6ef"/>
      <path d="M62 40.4h5v18h-5Z" fill="#ddd7c6"/>
      <path d="M68 42h26v14H68Z" fill="#234451"/>
      <path d="M68 56 94 42v4.6L74.6 56Z" fill="#47707f"/>
      ${upper}
      <!-- main roof slab: a flat plane with a real overhang -->
      <path d="M16 54h84v5H16Z" fill="#ffffff"/>
      <path d="M18 50.6h80L100 54H16Z" fill="#f8f6ef"/>
      <path d="M16 59h84v1.8H16Z" fill="#c3bba6"/>
      <!-- main block -->
      <path d="M20 60.6h76V84H20Z" fill="#f8f6ef"/>
      <path d="M20 60.6h6V84h-6Z" fill="#ddd7c6"/>
      <path d="M56 60.6h8V84h-8Z" fill="#ffffff"/>
      <path d="M26 62h30v22H26Z" fill="#234451"/>
      <path d="M64 62h28v22H64Z" fill="#234451"/>
      <path d="M26 84 52 62h4L30 84Z" fill="#47707f"/>
      <path d="M64 84 88 62h4L68 84Z" fill="#47707f"/>
      ${mullions}
      <path d="M20 84h76v2H20Z" fill="#16313c"/>
      <!-- palm -->
      <path d="M20.6 86C19 74 17.2 62 15.4 51.6l4 -0.4C21 61.8 22.8 74 24.6 86Z" fill="#8a6a4a"/>
      <path d="M20.6 86C19 74 17.2 62 15.4 51.6l1.6 -0.2C18.6 62 20 74 21.6 86Z" fill="#6a5136"/>
      <path d="M17.6 58.6 21.4 58.2M18.4 66.4 22.4 66M19.4 74.4 23.4 74" stroke="#6a5136" stroke-width="0.8" fill="none"/>
      ${palm}
      <circle cx="19.6" cy="51.6" r="1.7" fill="#5aa868"/>
      <circle cx="15.4" cy="52.8" r="1.5" fill="#3d8a52"/>`
    },
  },
  'Skyscraper': {
    subject: 'a glass tower three-quarter on, two low neighbours at its feet, a full window grid and a mast on top',
    palette: [
      SHADOW, '#7493a8', '#4f6c80', '#a8bdc9', '#9ab5c6',
      '#2b4356', '#1f3242', '#f3d590',
      '#5f7e92', '#3f5a6c', '#24394a', '#3a5162',
    ],
    draw: () => {
      // Every floor is one band across both faces, the side face sheared by the
      // -0.5 of its own recession. Lit windows are a fixed handful — scattering
      // them randomly put four in a row and read as a fault, not as offices.
      const lit = new Set(['3:1', '3:4', '7:0', '11:3', '14:2', '14:3', '18:5', '22:1'])
      const floors: string[] = []
      for (let f = 0; f < 24; f++) {
        const y = 42 + f * 2.4
        floors.push(`<rect x="35" y="${n(y)}" width="34" height="1.5" fill="#2b4356"/>`)
        const sy = y - 0.5 * 1
        floors.push(
          `<path d="M70 ${n(sy - 0.5)}l15 -7.5 0 1.5 -15 7.5Z" fill="#1f3242"/>`,
        )
      }
      for (let f = 0; f < 24; f++) {
        for (let c = 0; c < 6; c++) {
          if (!lit.has(`${f}:${c}`)) continue
          floors.push(`<rect x="${n(35.6 + c * 5.6)}" y="${n(42 + f * 2.4)}" width="4.4" height="1.5" fill="#f3d590"/>`)
        }
      }
      const piers = [0, 1, 2, 3, 4, 5, 6]
        .map((i) => `<rect x="${n(34.6 + i * 5.6)}" y="40" width="1.4" height="58" fill="#7493a8"/>`)
        .join('')
      const sidePiers = [0, 1, 2, 3]
        .map((i) => {
          const x = 70 + i * 4.2
          return `<path d="M${n(x)} ${n(39 - (x - 70) * 0.5)}l1.2 -0.6 0 56 -1.2 0.6Z" fill="#4f6c80"/>`
        })
        .join('')
      const upperFloors = [0, 1, 2, 3, 4, 5]
        .map((f) => {
          const y = 22 + f * 2.5
          return (
            `<rect x="41" y="${n(y)}" width="22" height="1.6" fill="#2b4356"/>` +
            `<path d="M64 ${n(y - 0.5)}l15 -7.5 0 1.6 -15 7.5Z" fill="#1f3242"/>`
          )
        })
        .join('')
      return `
      ${shadow(60, 104, 34, 5, SHADOW)}
      <!-- Two low neighbours at its feet. Not scenery: a lone lit grid on a
           dark slab is the same picture as a phone screen, and check-spend-art
           caught exactly that — Smartphone and Skyscraper came out the closest
           pair in the whole set. Giving the tower a street to stand in is also
           simply truer to what a skyscraper is. -->
      <path d="M12 100h22V72H12Z" fill="#3f5a6c"/>
      <path d="M12 72h22l7-4H19Z" fill="#5f7e92"/>
      <g fill="#24394a">
        <rect x="16" y="78" width="5" height="4"/><rect x="25" y="78" width="5" height="4"/>
        <rect x="16" y="87" width="5" height="4"/><rect x="25" y="87" width="5" height="4"/>
      </g>
      <path d="M88 100h20V62H88Z" fill="#3f5a6c"/>
      <path d="M88 62h20l6-4H94Z" fill="#5f7e92"/>
      <g fill="#24394a">
        <rect x="92" y="68" width="4.6" height="4"/><rect x="100" y="68" width="4.6" height="4"/>
        <rect x="92" y="77" width="4.6" height="4"/><rect x="100" y="77" width="4.6" height="4"/>
        <rect x="92" y="86" width="4.6" height="4"/><rect x="100" y="86" width="4.6" height="4"/>
      </g>
      <!-- podium, so the tower lands on something -->
      <path d="M26 100h50V88H26Z" fill="#5f7e92"/>
      <path d="M76 100 92 92V80l-16 8Z" fill="#3f5a6c"/>
      <path d="M26 88h50l16-8H42Z" fill="#a8bdc9"/>
      <path d="M30 98h14V90H30Z" fill="#24394a"/>
      <path d="M50 98h22v-6H50Z" fill="#24394a"/>
      <path d="M78 96 90 90v-6l-12 6Z" fill="#24394a"/>
      <!-- shaft -->
      <path d="M34 98h36V38H34Z" fill="#7493a8"/>
      <path d="M70 98 86 90V30l-16 8Z" fill="#4f6c80"/>
      ${floors.join('')}
      ${piers}
      ${sidePiers}
      <path d="M34 38h36l16-8H50Z" fill="#a8bdc9"/>
      <path d="M34 38h36v1.6H34Z" fill="#9ab5c6"/>
      <!-- upper setback -->
      <path d="M40 38h24V20H40Z" fill="#7493a8"/>
      <path d="M64 38 80 30V12L64 20Z" fill="#4f6c80"/>
      ${upperFloors}
      <path d="M40 20h24l16-8H56Z" fill="#a8bdc9"/>
      <path d="M40 20h24v1.5H40Z" fill="#9ab5c6"/>
      <path d="M39.4 20h1.3v18h-1.3M46.6 20h1.3v18h-1.3M54 20h1.3v18H54M62.4 20h1.3v18h-1.3Z" fill="#9ab5c6"/>
      <!-- crown and mast -->
      <path d="M50 20h14l8-4H58Z" fill="#9ab5c6"/>
      <path d="M58.4 16 66 16.1 66.6 12.4 59.4 12.4Z" fill="#a8bdc9"/>
      <path d="M62.2 12.4h1.6l0.5-3.6h-1.4Z" fill="#3a5162"/>
      <circle cx="63.2" cy="8.4" r="1.2" fill="#3a5162"/>`
    },
  },
  /* ---- Electric car ------------------------------------------------------ */
  'Electric car': {
    subject: 'an upright family hatchback three-quarter front, plugged in at a charge point',
    palette: [SHADOW, '#2e7d5b', '#3f9a72', '#245f47', '#1b2733', '#9fb3c4', '#e8eef2', '#c9d6df', '#a67f1f'],
    draw: () => `
      ${shadow(58, 103, 36, 5, SHADOW)}
      <rect x="96" y="52" width="9" height="42" rx="2.4" fill="#9fb3c4"/>
      <rect x="98" y="56" width="5" height="7" rx="1.2" fill="#1b2733"/>
      <path d="M96 70c-9 2-13 8-15 14" fill="none" stroke="#a67f1f" stroke-width="3" stroke-linecap="round"/>
      <path d="M18 88V66c0-3 2-6 5-7l9-3 7-12c1-2 3-3 5-3h22c2 0 4 1 5 3l8 13 8 3c3 1 5 4 5 7v20Z" fill="#2e7d5b"/>
      <path d="M18 88V66c0-3 2-6 5-7l9-3 7-12c1-2 3-3 5-3h10v47Z" fill="#3f9a72"/>
      <path d="M18 80h74v8H18Z" fill="#245f47"/>
      <path d="M38 47h10v13H33Zm14 0h18l7 13H52Z" fill="#1b2733"/>
      <rect x="16" y="68" width="7" height="5" rx="2" fill="#e8eef2"/>
      <rect x="87" y="68" width="7" height="5" rx="2" fill="#c9d6df"/>
      <circle cx="34" cy="88" r="10" fill="#1b2733"/>
      <circle cx="34" cy="88" r="4.4" fill="#c9d6df"/>
      <circle cx="76" cy="88" r="10" fill="#1b2733"/>
      <circle cx="76" cy="88" r="4.4" fill="#c9d6df"/>`,
  },

  /* ---- Sports car -------------------------------------------------------- */
  'Sports car': {
    subject: 'a low wide supercar in side profile, spoiler up, wheels filling the arches',
    palette: [SHADOW, '#c04545', '#d9635f', '#8f2f2f', '#1b1b1f', '#3a3a42', '#e8eef2', '#c9c9cf'],
    draw: () => `
      ${shadow(60, 103, 40, 5, SHADOW)}
      <path d="M8 84 12 72c1-3 4-5 7-6l22-4 12-10c2-2 5-3 8-3h14c4 0 7 2 9 5l8 12 20 4c3 1 5 3 5 6v8Z" fill="#c04545"/>
      <path d="M8 84 12 72c1-3 4-5 7-6l22-4 12-10c2-2 5-3 8-3h6l-6 35Z" fill="#d9635f"/>
      <path d="M8 84h109v6H8Z" fill="#8f2f2f"/>
      <path d="M56 53h14c2 0 4 1 5 3l6 9H50Z" fill="#1b1b1f"/>
      <path d="M56 53h7l-4 12h-9Z" fill="#e8eef2"/>
      <rect x="96" y="58" width="22" height="4" rx="1.6" fill="#1b1b1f"/>
      <rect x="103" y="61" width="3" height="7" fill="#3a3a42"/>
      <path d="M78 72h14l-3 6H78Z" fill="#3a3a42"/>
      <circle cx="33" cy="84" r="13" fill="#1b1b1f"/>
      <circle cx="33" cy="84" r="6" fill="#c9c9cf"/>
      <circle cx="33" cy="84" r="2.2" fill="#3a3a42"/>
      <circle cx="92" cy="84" r="13" fill="#1b1b1f"/>
      <circle cx="92" cy="84" r="6" fill="#c9c9cf"/>
      <circle cx="92" cy="84" r="2.2" fill="#3a3a42"/>`,
  },

  /* ---- Formula 1 car ----------------------------------------------------- */
  'Formula 1 car': {
    subject: 'an open-wheel racer in side view, front and rear wings, halo over the cockpit, exposed suspension',
    palette: [SHADOW, '#1f7d80', '#2b9ea1', '#14494b', '#1b1b1f', '#3a3a42', '#a67f1f', '#e8eef2'],
    draw: () => `
      ${shadow(60, 103, 44, 4, SHADOW)}
      <path d="M20 78h16l6-8h22l8-10h10c4 0 7 3 7 7v11h12v8H20Z" fill="#1f7d80"/>
      <path d="M42 70h22l8-10h6l-4 10-6 8H36Z" fill="#2b9ea1"/>
      <path d="M20 84h81v3H20Z" fill="#14494b"/>
      <path d="M4 82h18v-4l-18 2Z" fill="#1f7d80"/>
      <rect x="1" y="84" width="24" height="3.4" rx="1" fill="#1b1b1f"/>
      <rect x="4" y="79" width="16" height="2.6" rx="1" fill="#3a3a42"/>
      <rect x="98" y="47" width="21" height="4.4" rx="1.2" fill="#1b1b1f"/>
      <rect x="100" y="53" width="17" height="3" rx="1" fill="#3a3a42"/>
      <rect x="106" y="51" width="3.4" height="22" fill="#3a3a42"/>
      <path d="M58 60c7-6 16-6 22 0" fill="none" stroke="#1b1b1f" stroke-width="3.2" stroke-linecap="round"/>
      <path d="M69 60v-4" fill="none" stroke="#1b1b1f" stroke-width="2.6"/>
      <path d="M80 60h8l3 8h-11Z" fill="#a67f1f"/>
      <g fill="none" stroke="#3a3a42" stroke-width="2.6" stroke-linecap="round">
        <path d="M28 80 36 74"/><path d="M28 86 37 82"/>
        <path d="M96 80 88 74"/><path d="M96 86 87 82"/>
      </g>
      <circle cx="28" cy="84" r="13" fill="#1b1b1f"/>
      <circle cx="28" cy="84" r="5" fill="#e8eef2"/>
      <circle cx="96" cy="84" r="14" fill="#1b1b1f"/>
      <circle cx="96" cy="84" r="5.4" fill="#e8eef2"/>`,
  },

  /* ---- Private jet ------------------------------------------------------- */
  'Private jet': {
    subject: 'a business jet on the apron seen from the front quarter, airstair down, engines at the tail',
    palette: [SHADOW, '#e8eef2', '#c9d6df', '#9fb3c4', '#1b2733', '#3a6ea5', '#5b6b78'],
    draw: () => `
      ${shadow(62, 100, 38, 4, SHADOW)}
      <path d="M14 74c0-7 6-12 15-13l46-5c9-1 16 1 22 5l14 9-14 8c-6 4-13 6-22 5l-46-5c-9-1-15-6-15-4Z" fill="#e8eef2"/>
      <path d="M14 74c0-7 6-12 15-13l46-5c9-1 16 1 22 5l14 9H14Z" fill="#c9d6df"/>
      <g fill="#1b2733">
        <circle cx="40" cy="69" r="2.1"/><circle cx="50" cy="68.4" r="2.1"/>
        <circle cx="60" cy="67.8" r="2.1"/><circle cx="70" cy="67.4" r="2.1"/>
      </g>
      <path d="M18 70c3-4 7-6 12-6l-2 7h-9Z" fill="#3a6ea5"/>
      <path d="M52 76 34 94h10l24-16Z" fill="#9fb3c4"/>
      <path d="M96 62 108 40h6l-4 23Z" fill="#c9d6df"/>
      <rect x="96" y="38" width="24" height="4" rx="1.6" fill="#9fb3c4"/>
      <ellipse cx="92" cy="62" rx="9" ry="6" fill="#5b6b78"/>
      <ellipse cx="92" cy="62" rx="4.4" ry="3" fill="#1b2733"/>
      <path d="M30 78 22 94h11l6-14Z" fill="#c9d6df"/>
      <g fill="none" stroke="#9fb3c4" stroke-width="2.2">
        <path d="M27 84h8"/><path d="M25 88h8"/>
      </g>`,
  },

  /* ---- Boeing 787 -------------------------------------------------------- */
  'Boeing 787': {
    subject: 'a widebody airliner head-on and slightly below, full wingspan, two underwing engines, raked tips',
    palette: [SHADOW, '#e8eef2', '#c9d6df', '#9fb3c4', '#1b2733', '#3a6ea5', '#5b6b78'],
    draw: () => `
      ${shadow(60, 106, 30, 4, SHADOW)}
      <path d="M4 66c14-5 34-8 56-8s42 3 56 8l-4 7c-16-4-33-6-52-6s-36 2-52 6Z" fill="#c9d6df"/>
      <path d="M4 66c14-5 34-8 56-8v5c-19 0-36 2-52 6Z" fill="#9fb3c4"/>
      <path d="M4 66 1 58l7 3Z" fill="#9fb3c4"/>
      <path d="M116 66 119 58l-7 3Z" fill="#9fb3c4"/>
      <ellipse cx="60" cy="62" rx="13" ry="21" fill="#e8eef2"/>
      <path d="M57 41h6l-1-16h-4Z" fill="#9fb3c4"/>
      <path d="M52 50c5-4 11-4 16 0l-2 5H54Z" fill="#1b2733"/>
      <path d="M53 51c4-3 9-3 14 0" fill="none" stroke="#3a6ea5" stroke-width="2.2"/>
      <ellipse cx="34" cy="76" rx="10" ry="8" fill="#5b6b78"/>
      <ellipse cx="34" cy="76" rx="5.4" ry="4.4" fill="#1b2733"/>
      <ellipse cx="86" cy="76" rx="10" ry="8" fill="#5b6b78"/>
      <ellipse cx="86" cy="76" rx="5.4" ry="4.4" fill="#1b2733"/>
      <g fill="none" stroke="#5b6b78" stroke-width="3" stroke-linecap="round">
        <path d="M50 82v10"/><path d="M70 82v10"/>
      </g>
      <g fill="#1b2733">
        <circle cx="50" cy="95" r="3.4"/><circle cx="70" cy="95" r="3.4"/>
      </g>`,
  },

  /* ---- Racehorse --------------------------------------------------------- */
  'Racehorse': {
    subject: 'a thoroughbred at full gallop with a saddle and a numbered cloth, all four feet off the ground',
    palette: [SHADOW, '#a86b4c', '#8a5232', '#c08a63', '#1b1b1f', '#c04545', '#e8eef2', '#6f7f2e'],
    draw: () => `
      ${shadow(60, 104, 34, 4, SHADOW)}
      <path d="M38 56c10-6 24-7 34-3 8 3 13 9 14 17 1 7-2 13-8 16l-6-12-10 3-14-2-8 9-7-11c-3-6-1-13 5-17Z" fill="#a86b4c"/>
      <path d="M38 56c10-6 24-7 34-3 5 2 9 5 11 9-12-4-26-4-38 2Z" fill="#c08a63"/>
      <path d="M40 58 26 44c-3-3-3-7 0-9s7-2 9 1l10 13Z" fill="#a86b4c"/>
      <path d="M26 44 16 36l-4 4 9 9Z" fill="#a86b4c"/>
      <path d="M12 40l-4 1 3 4Z" fill="#8a5232"/>
      <circle cx="21" cy="40" r="1.5" fill="#1b1b1f"/>
      <path d="M27 33l-1-6 5 5Z" fill="#8a5232"/>
      <path d="M32 40c6-2 10 0 13 5-5-1-9-2-13-5Z" fill="#1b1b1f"/>
      <g fill="none" stroke="#a86b4c" stroke-width="5" stroke-linecap="round">
        <path d="M46 72 34 84l-9 4"/>
        <path d="M52 74 48 88l3 8"/>
        <path d="M78 74 88 84l10 2"/>
        <path d="M72 78 74 90l-4 7"/>
      </g>
      <g fill="none" stroke="#1b1b1f" stroke-width="3" stroke-linecap="round">
        <path d="M25 88h-3"/><path d="M51 96h-3"/><path d="M98 86h3"/><path d="M70 97h-3"/>
      </g>
      <path d="M86 58c8 0 14 5 17 13-6-5-12-7-18-6Z" fill="#8a5232"/>
      <path d="M52 50h18l3 10H50Z" fill="#6f7f2e"/>
      <rect x="56" y="54" width="11" height="9" rx="1.4" fill="#e8eef2"/>
      <rect x="59" y="56" width="5" height="5" fill="#c04545"/>`,
  },

  /* ---- Football club ----------------------------------------------------- */
  'Football club': {
    subject: 'a stadium bowl three-quarter on, floodlight masts up, a lit green pitch inside it',
    palette: [SHADOW, '#5b6b78', '#9fb3c4', '#3d4a54', '#2e7d5b', '#3f9a72', '#e8eef2', '#a67f1f'],
    draw: () => `
      ${shadow(60, 100, 44, 6, SHADOW)}
      <ellipse cx="60" cy="72" rx="48" ry="26" fill="#5b6b78"/>
      <ellipse cx="60" cy="69" rx="48" ry="26" fill="#9fb3c4"/>
      <ellipse cx="60" cy="69" rx="40" ry="21" fill="#3d4a54"/>
      <ellipse cx="60" cy="69" rx="32" ry="16" fill="#5b6b78"/>
      <ellipse cx="60" cy="69" rx="26" ry="12.5" fill="#2e7d5b"/>
      <g fill="#3f9a72">
        <path d="M42 60h7v18h-9Z"/><path d="M58 59h7v20h-7Z"/><path d="M74 60h6l-3 18h-6Z"/>
      </g>
      <ellipse cx="60" cy="69" rx="6" ry="3" fill="none" stroke="#e8eef2" stroke-width="2.2"/>
      <path d="M34 69h52" fill="none" stroke="#e8eef2" stroke-width="2.2"/>
      <g fill="none" stroke="#3d4a54" stroke-width="3" stroke-linecap="round">
        <path d="M18 56V36"/><path d="M102 56V36"/><path d="M40 48V28"/><path d="M80 48V28"/>
      </g>
      <g fill="#a67f1f">
        <rect x="12" y="30" width="13" height="7" rx="1.6"/>
        <rect x="96" y="30" width="13" height="7" rx="1.6"/>
        <rect x="34" y="22" width="13" height="7" rx="1.6"/>
        <rect x="74" y="22" width="13" height="7" rx="1.6"/>
      </g>`,
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
