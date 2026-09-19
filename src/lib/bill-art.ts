/**
 * One drawn bill, reused two ways: tiled edge-to-edge as the literal strip
 * for the five tiers small enough to draw, and once, large, as the page's
 * own hero.
 *
 * Not a photograph of real currency, and not the site's usual flat-colour
 * cut-out contract either — that contract exists because tile-art and the
 * space/deep-sea scenes all inline into *one shared document*, where an id
 * or a gradient from one drawing can collide with another's. This bill is a
 * fully standalone `<svg>` document of its own, only ever referenced from
 * the outside as a CSS `background-image` data: URI, so it can use defs,
 * patterns, clipPaths and filters freely without anything else on the page
 * ever seeing them.
 *
 * The engraving look is built from the same handful of real intaglio-print
 * tricks: a guilloché (fine repeating wave lattice) border, radial-spoke
 * seals, an arched banner, and cross-hatched shading inside a clipped
 * silhouette rather than a flat fill — plus a feTurbulence grain so the
 * paper itself has fibre rather than being a flat cream rectangle.
 */

export const P = {
  paper: '#efe9d2',
  paper2: '#e2dabb',
  ink: '#1c2a20',
  ink2: '#33452f',
  ink3: '#4a5c46',
  seal: '#2f6b3f',
  sealLight: '#4f8f5c',
  sealDark: '#173a20',
  gold: '#8a7331',
} as const

/** Real note proportions, 6.14 x 2.61 inches, drawn on a 240x102 grid. */
export const BILL_W = 240
export const BILL_H = 102
const CX = BILL_W / 2
const CY = BILL_H / 2

const TAU = Math.PI * 2
const pt = (cx: number, cy: number, r: number, a: number) => [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const
const n = (v: number) => (Math.round(v * 100) / 100).toString()

/* ---- the guilloché border: a fine repeating wave, the way an intaglio
   press actually decorates the field around the portrait --------------- */

function guillochePattern(id: string, color: string): string {
  // One period of a double sine, thin enough to read as engraving rather
  // than a cartoon squiggle.
  return `<pattern id="${id}" width="9" height="7" patternUnits="userSpaceOnUse">
    <path d="M0 3.5 Q2.25 0.5 4.5 3.5 T9 3.5" fill="none" stroke="${color}" stroke-width="0.55" opacity="0.85"/>
    <path d="M0 5.6 Q2.25 3 4.5 5.6 T9 5.6" fill="none" stroke="${color}" stroke-width="0.4" opacity="0.5"/>
  </pattern>`
}

/** A thin decorative band filled with the guilloché tile — horizontal bands
 *  use it directly, vertical ones rotate the pattern with the band. */
function band(x: number, y: number, w: number, h: number, patternId: string, vertical = false): string {
  const rot = vertical ? ` patternTransform="rotate(90)"` : ''
  return `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="url(#${patternId})"${rot ? '' : ''}/>`
}

/* ---- a seal: two rings and N radiating spokes, the way both the Federal
   Reserve and Treasury seals are actually built ------------------------- */

function seal(cx: number, cy: number, rOuter: number, rInner: number, spokes: number, color: string, colorLight: string): string {
  let spokesMarkup = ''
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * TAU
    const [x1, y1] = pt(cx, cy, rInner, a)
    const [x2, y2] = pt(cx, cy, rOuter, a)
    spokesMarkup += `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${color}" stroke-width="0.8" opacity="0.75"/>`
  }
  return `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(rOuter)}" fill="none" stroke="${color}" stroke-width="1.3"/>` +
    `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(rOuter)}" fill="${colorLight}" opacity="0.08"/>` +
    spokesMarkup +
    `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(rInner)}" fill="none" stroke="${color}" stroke-width="1.1"/>`
}

/** The Treasury-style seal: a sunburst of small triangular spikes ringing a
 *  plain disc, rather than the Federal Reserve's spoked wheel — the two
 *  real seals are deliberately built differently, and drawing them
 *  identically would be the "one template" mistake this site keeps
 *  catching itself making elsewhere. */
function sunburstSeal(cx: number, cy: number, r: number, spikes: number, color: string): string {
  let spikesMarkup = ''
  for (let i = 0; i < spikes; i++) {
    const a = (i / spikes) * TAU
    const a2 = a + TAU / spikes
    const [bx1, by1] = pt(cx, cy, r * 0.72, a)
    const [bx2, by2] = pt(cx, cy, r * 0.72, a2)
    const [px, py] = pt(cx, cy, r, (a + a2) / 2)
    spikesMarkup += `<path d="M${n(bx1)} ${n(by1)} L${n(px)} ${n(py)} L${n(bx2)} ${n(by2)}Z" fill="${color}" opacity="0.85"/>`
  }
  // A five-pointed star stands in for the balance-scale emblem — legible at
  // the size this actually renders, unlike a scale's own thin ink.
  let star = ''
  for (let i = 0; i < 5; i++) {
    const aOuter = -TAU / 4 + (i / 5) * TAU
    const aInner = aOuter + TAU / 10
    const [ox, oy] = pt(cx, cy, r * 0.34, aOuter)
    const [ix, iy] = pt(cx, cy, r * 0.14, aInner)
    star += `${i === 0 ? 'M' : 'L'}${n(ox)} ${n(oy)} L${n(ix)} ${n(iy)} `
  }
  return spikesMarkup +
    `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r * 0.72)}" fill="none" stroke="${color}" stroke-width="1.2"/>` +
    `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r * 0.4)}" fill="${color}" opacity="0.14"/>` +
    `<path d="${star}Z" fill="${color}" opacity="0.9"/>`
}

/** The portrait: a bust silhouette, clipped, then cross-hatched with offset
 *  arcs of falling opacity rather than filled flat — the actual technique
 *  an engraved plate uses to fake tone out of pure line work. */
function portrait(cx: number, cy: number): string {
  const clipId = 'pm-bust-clip'
  // A head (rounded, narrow) over angled shoulders (wide, suit-collar V) —
  // two recognisably different widths joining at a neck, rather than one
  // continuous blob, which is what read as a snowman on the first pass.
  const bust = `M${cx - 22} ${cy + 26}
    L${cx - 22} ${cy + 15}
    Q${cx - 21} ${cy + 6} ${cx - 10} ${cy + 2}
    Q${cx - 13} ${cy - 4} ${cx - 12} ${cy - 10}
    Q${cx - 11} ${cy - 21} ${cx - 2} ${cy - 24}
    Q${cx + 7} ${cy - 27} ${cx + 12} ${cy - 19}
    Q${cx + 15} ${cy - 12} ${cx + 12} ${cy - 6}
    Q${cx + 12} ${cy - 1} ${cx + 10} ${cy + 2}
    Q${cx + 21} ${cy + 6} ${cx + 22} ${cy + 15}
    L${cx + 22} ${cy + 26} Z`
  const collar = `M${cx - 10} ${cy + 4} L${cx - 2} ${cy + 22} L${cx + 2} ${cy + 10} L${cx + 6} ${cy + 22} L${cx + 10} ${cy + 4}`
  let hatch = ''
  for (let i = 0; i < 11; i++) {
    const yy = cy - 26 + i * 5
    hatch += `<path d="M${cx - 24} ${yy} Q${cx} ${yy + 3.4} ${cx + 24} ${yy}" fill="none" stroke="${P.ink}" stroke-width="${n(0.45 + i * 0.05)}" opacity="${n(0.2 + i * 0.045)}"/>`
  }
  for (let i = 0; i < 7; i++) {
    const xx = cx - 16 + i * 5.4
    hatch += `<path d="M${xx} ${cy - 26} Q${xx + 2} ${cy} ${xx} ${cy + 26}" fill="none" stroke="${P.ink2}" stroke-width="0.35" opacity="0.16"/>`
  }
  return `<clipPath id="${clipId}"><path d="${bust}"/></clipPath>` +
    `<g clip-path="url(#${clipId})">` +
    `<rect x="${cx - 26}" y="${cy - 32}" width="52" height="64" fill="${P.ink3}" opacity="0.5"/>` +
    hatch +
    `<path d="${collar}" fill="none" stroke="${P.ink}" stroke-width="0.7" opacity="0.6"/>` +
    `</g>` +
    `<path d="${bust}" fill="none" stroke="${P.ink}" stroke-width="0.9"/>`
}

/** The single bill, as a self-contained SVG document (not a fragment) —
 *  used directly for the hero, and re-encoded as a data: URI for the tiled
 *  strips, since a CSS background-image needs a full document. */
export function billSvg(): string {
  const wave = guillochePattern('pm-wave', P.ink3)
  const waveGold = guillochePattern('pm-wave-gold', P.gold)

  const arcTop = `<path id="pm-arc-top" d="M${CX - 108} 30 Q${CX} 4 ${CX + 108} 30" fill="none"/>`
  const arcMid = `<path id="pm-arc-mid" d="M${CX - 52} 34 Q${CX} 22 ${CX + 52} 34" fill="none"/>`

  const corner = (cx: number, cy: number, mirrored: boolean) => `
    <g>
      <rect x="${n(cx - 15)}" y="${n(cy - 15)}" width="30" height="30" fill="none" stroke="${P.ink3}" stroke-width="1.3"/>
      <rect x="${n(cx - 11.5)}" y="${n(cy - 11.5)}" width="23" height="23" fill="none" stroke="${P.ink3}" stroke-width="0.5" opacity="0.7"/>
      <text x="${n(cx)}" y="${n(cy + 5.4)}" font-family="Georgia, 'Times New Roman', serif" font-size="14" font-weight="700" fill="${P.ink}" text-anchor="middle">1</text>
      <path d="M${n(cx - 15)} ${n(cy - 15)} l-5 -5 M${n(cx + 15)} ${n(cy - 15)} l5 -5 M${n(cx - 15)} ${n(cy + 15)} l-5 5 M${n(cx + 15)} ${n(cy + 15)} l5 5"
            stroke="${P.ink3}" stroke-width="1" opacity="${mirrored ? 0.5 : 0.5}"/>
    </g>`

  const serial = (x: number, y: number, anchor: string) =>
    `<text x="${n(x)}" y="${n(y)}" font-family="'Courier New', monospace" font-size="6.4" font-weight="700" fill="${P.seal}" text-anchor="${anchor}" letter-spacing="0.6">L37402186A</text>`

  return `<svg viewBox="0 0 ${BILL_W} ${BILL_H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      ${wave}${waveGold}${arcTop}${arcMid}
      <radialGradient id="pm-paper-grad" cx="50%" cy="42%" r="75%">
        <stop offset="0%" stop-color="${P.paper}"/>
        <stop offset="100%" stop-color="${P.paper2}"/>
      </radialGradient>
      <filter id="pm-grain" x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="noise"/>
        <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.05 0"/>
      </filter>
      <linearGradient id="pm-sheen" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#fff" stop-opacity="0.16"/>
        <stop offset="35%" stop-color="#fff" stop-opacity="0"/>
        <stop offset="100%" stop-color="#fff" stop-opacity="0"/>
      </linearGradient>
    </defs>

    <rect width="${BILL_W}" height="${BILL_H}" fill="url(#pm-paper-grad)"/>
    <rect width="${BILL_W}" height="${BILL_H}" filter="url(#pm-grain)"/>

    <rect x="2.4" y="2.4" width="${BILL_W - 4.8}" height="${BILL_H - 4.8}" fill="none" stroke="${P.ink}" stroke-width="1.6"/>
    <rect x="5.5" y="5.5" width="${BILL_W - 11}" height="${BILL_H - 11}" fill="none" stroke="${P.ink3}" stroke-width="0.5"/>

    ${band(9, 9, BILL_W - 18, 5.2, 'pm-wave')}
    ${band(9, BILL_H - 14.2, BILL_W - 18, 5.2, 'pm-wave')}
    ${band(9, 14, 5.2, BILL_H - 28, 'pm-wave', true)}
    ${band(BILL_W - 14.2, 14, 5.2, BILL_H - 28, 'pm-wave', true)}

    ${corner(24, 24, false)}
    ${corner(BILL_W - 24, 24, true)}
    ${corner(24, BILL_H - 24, false)}
    ${corner(BILL_W - 24, BILL_H - 24, true)}

    <text font-family="Georgia, 'Times New Roman', serif" font-size="6.6" font-weight="700" fill="${P.ink}" letter-spacing="1">
      <textPath href="#pm-arc-top" startOffset="50%" text-anchor="middle">THE UNITED STATES OF AMERICA</textPath>
    </text>
    <text font-family="Georgia, 'Times New Roman', serif" font-size="4.6" fill="${P.ink2}" letter-spacing="1.1">
      <textPath href="#pm-arc-mid" startOffset="50%" text-anchor="middle">IN GOD WE TRUST</textPath>
    </text>

    ${seal(58, CY + 2, 15.5, 8, 22, P.ink3, P.ink2)}
    ${portrait(CX, CY + 3)}
    ${sunburstSeal(BILL_W - 58, CY + 2, 15.5, 13, P.seal)}

    <path d="M${CX - 30} ${BILL_H - 21} L${CX + 30} ${BILL_H - 21} L${CX + 24} ${BILL_H - 12} L${CX + 30} ${BILL_H - 5} L${CX - 30} ${BILL_H - 5} L${CX - 24} ${BILL_H - 12} Z"
          fill="${P.paper2}" stroke="${P.ink3}" stroke-width="0.8"/>
    <text x="${CX}" y="${BILL_H - 10.5}" font-family="Georgia, 'Times New Roman', serif" font-size="7.6" font-weight="700" fill="${P.ink}" text-anchor="middle" letter-spacing="1.4">ONE DOLLAR</text>

    ${serial(BILL_W - 26, 32, 'end')}
    ${serial(26, BILL_H - 25, 'start')}

    <rect width="${BILL_W}" height="${BILL_H}" fill="url(#pm-sheen)"/>
  </svg>`
}

/** The bill as a data: URI, for use as a CSS `background-image` tiled with
 *  `repeat-x` — the only way to show a strip that might be hundreds of bills
 *  long without putting hundreds of nodes in the DOM. */
export function billDataUri(): string {
  return `data:image/svg+xml,${encodeURIComponent(billSvg())}`
}
