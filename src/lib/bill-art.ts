/**
 * One drawn bill, reused two ways: tiled edge-to-edge as the literal strip
 * for the five tiers small enough to draw, and once, large, as the page's
 * own hero. Not a photograph of real currency — an engraving-style original,
 * on the same flat-colour, no-gradient discipline as the rest of the site's
 * art, at the real note's own proportions (6.14 x 2.61 inches).
 */

export const P = {
  paper: '#e8e2c8',
  ink: '#2c3a2e',
  ink2: '#3f5142',
  seal: '#2f6b3f',
  sealDark: '#1f4a2b',
  border: '#4a5c46',
} as const

/** Real note proportions, 6.14 x 2.61 inches, drawn on a 240x102 grid. */
export const BILL_W = 240
export const BILL_H = 102

/** A corner box with its numeral drawn upright — real bills never mirror the
 *  digit itself, only its position, so the box is placed at each corner
 *  rather than flipped there. */
const corner = (cx: number, cy: number) =>
  `<rect x="${cx - 17}" y="${cy - 17}" width="34" height="34" fill="none" stroke="${P.border}" stroke-width="1.4"/>` +
  `<text x="${cx}" y="${cy + 5}" font-family="Georgia, serif" font-size="15" font-weight="700" fill="${P.ink}" text-anchor="middle">1</text>`

/** The single bill, as a self-contained SVG document (not a fragment) —
 *  used directly for the hero, and re-encoded as a data: URI for the tiled
 *  strips, since a CSS background-image needs a full document. */
export function billSvg(): string {
  return `<svg viewBox="0 0 ${BILL_W} ${BILL_H}" xmlns="http://www.w3.org/2000/svg">` +
    `<rect x="0" y="0" width="${BILL_W}" height="${BILL_H}" fill="${P.paper}"/>` +
    `<rect x="3" y="3" width="${BILL_W - 6}" height="${BILL_H - 6}" fill="none" stroke="${P.border}" stroke-width="2"/>` +
    `<rect x="7" y="7" width="${BILL_W - 14}" height="${BILL_H - 14}" fill="none" stroke="${P.border}" stroke-width="0.7"/>` +
    corner(26, 26) +
    corner(BILL_W - 26, 26) +
    corner(26, BILL_H - 26) +
    corner(BILL_W - 26, BILL_H - 26) +
    `<circle cx="${BILL_W / 2}" cy="${BILL_H / 2}" r="26" fill="none" stroke="${P.ink2}" stroke-width="1"/>` +
    `<ellipse cx="${BILL_W / 2}" cy="${BILL_H / 2 + 2}" rx="15" ry="19" fill="${P.ink}" opacity="0.85"/>` +
    `<path d="M${BILL_W / 2 - 15} ${BILL_H / 2 + 18} Q${BILL_W / 2} ${BILL_H / 2 + 6} ${BILL_W / 2 + 15} ${BILL_H / 2 + 18}" fill="${P.ink}" opacity="0.85"/>` +
    `<circle cx="${BILL_W / 2 - 62}" cy="${BILL_H / 2}" r="17" fill="none" stroke="${P.seal}" stroke-width="1.4"/>` +
    `<circle cx="${BILL_W / 2 - 62}" cy="${BILL_H / 2}" r="17" fill="${P.seal}" opacity="0.12"/>` +
    `<path d="M${BILL_W / 2 - 62} ${BILL_H / 2 - 11} L${BILL_W / 2 - 62} ${BILL_H / 2 + 11} M${BILL_W / 2 - 71} ${BILL_H / 2} L${BILL_W / 2 - 53} ${BILL_H / 2}" stroke="${P.sealDark}" stroke-width="1"/>` +
    `<g fill="none" stroke="${P.ink2}" stroke-width="0.6" opacity="0.7">` +
    Array.from({ length: 6 }, (_, i) => `<path d="M${BILL_W / 2 - 68} ${BILL_H / 2 - 8 + i * 3} h13"/>`).join('') +
    `</g>` +
    `<text x="${BILL_W / 2}" y="${BILL_H - 14}" font-family="Georgia, serif" font-size="9" fill="${P.ink}" text-anchor="middle" letter-spacing="1.5">ONE DOLLAR</text>` +
    `<text x="${BILL_W / 2 + 62}" y="${BILL_H / 2 + 5}" font-family="Georgia, serif" font-size="20" font-weight="700" fill="${P.ink}" text-anchor="middle">1</text>` +
    `</svg>`
}

/** The bill as a data: URI, for use as a CSS `background-image` tiled with
 *  `repeat-x` — the only way to show a strip that might be hundreds of bills
 *  long without putting hundreds of nodes in the DOM. */
export function billDataUri(): string {
  return `data:image/svg+xml,${encodeURIComponent(billSvg())}`
}
