/**
 * Drawn elements for Fusion — one picture per thing you can hold.
 *
 * Fusion shipped with emoji in every piece, and PLAN.md grandfathered them on
 * a specific argument: the tree was meant to be open-ended, so there was
 * "nothing to draw in advance." That argument does not survive contact with
 * the actual game. The recipe table is a closed set of thirty-nine elements,
 * all of them reachable from the four starters and all of them known at build
 * time, so there is nothing to draw in advance *except* thirty-nine things.
 * Every other page on this site draws its own subjects (see the doc comment at
 * the top of lib/icons.ts for why emoji are banned site-wide: they are three
 * other people's artwork depending on whose device you are holding).
 *
 * ---- why these follow the ICON conventions, not the product-art ones ----
 *
 * A Fusion element renders inline in a draggable pill at about 20px, and the
 * same drawing appears again in the dark tray chip. That is the icon problem
 * exactly — small, and on two very different backgrounds — so these use the
 * same 24-unit grid and the same mid-tone PALETTE that lib/icons.ts uses, for
 * the same reason: one drawing has to clear 3:1 against a near-white tile and
 * a dark violet chip at once. They live here rather than in ICONS because a
 * shared registry of a hundred-odd glyphs makes the distinctness test a
 * treadmill, and because nothing outside this one game wants a picture of
 * Swamp.
 *
 * Conventions, all enforced by scripts/check-fusion-art.mjs:
 *  - Inner markup on a `0 0 24 24` grid. Deterministic.
 *  - Every fill and stroke is a PALETTE entry, `currentColor`, or `none`.
 *  - Stroke widths at or above 2.2 — thinner is a hairline at 20px.
 *  - No emoji, no `<text>`.
 */
import { PALETTE } from './icons'

const P = PALETTE

/** Ink at a fraction of the host's own text colour — inverts with the chip. */
const soft = (o: number) => `fill="currentColor" opacity="${o}"`

export type Element = {
  /** What it is a picture of. For the checker's report and the next editor. */
  subject: string
  /** Inner markup on a 0 0 24 24 grid. */
  draw: () => string
}

export const FUSION_ART: Record<string, Element> = {
  /* ---- the four you start with ----------------------------------------- */
  Water: {
    subject: 'a single falling droplet with a lit edge',
    draw: () => `
      <path d="M12 2.4c4.2 5.2 6.4 8.6 6.4 11.6a6.4 6.4 0 0 1-12.8 0c0-3 2.2-6.4 6.4-11.6Z" fill="${P.blue}"/>
      <path d="M9.4 14.6a2.6 2.6 0 0 0 2.6 2.6" fill="none" stroke="currentColor" stroke-width="2.2"
            stroke-linecap="round" opacity="0.5"/>`,
  },
  Fire: {
    subject: 'a flame with a hotter core inside it',
    draw: () => `
      <path d="M12 1.8c3.6 4.6 5.8 7.4 5.8 10.4a5.8 5.8 0 0 1-11.6 0c0-3 2.2-5.8 5.8-10.4Z" fill="${P.rust}"/>
      <path d="M12 9.2c1.8 2.6 2.8 4 2.8 5.4a2.8 2.8 0 0 1-5.6 0c0-1.4 1-2.8 2.8-5.4Z" fill="${P.gold}"/>
      <path d="M5 20.4c4.6 1.6 9.4 1.6 14 0" fill="none" stroke="${P.rust}" stroke-width="2.2"
            stroke-linecap="round" opacity="0.7"/>`,
  },
  Earth: {
    subject: 'a clod of ground in section, grass on top',
    draw: () => `
      <path d="M2.6 9.4h18.8v8.2a3 3 0 0 1-3 3H5.6a3 3 0 0 1-3-3Z" fill="${P.clay}"/>
      <path d="M2.6 9.4h18.8v3.2H2.6Z" fill="${P.olive}"/>
      <g fill="${P.green}">
        <path d="M6 9.4c0-2 1-3.4 2.6-4-.4 1.8-.2 3 .6 4Z"/>
        <path d="M13.4 9.4c0-2.4 1.2-4 3.2-4.6-.6 2-.4 3.4.6 4.6Z"/>
      </g>
      <g ${soft(0.28)}>
        <circle cx="8" cy="16.4" r="1.5"/><circle cx="15.4" cy="17.4" r="1.2"/>
      </g>`,
  },
  Wind: {
    subject: 'three gusts, the longest curling back on itself',
    draw: () => `
      <g fill="none" stroke-width="2.6" stroke-linecap="round">
        <path d="M2.6 7.4h9.4a2.6 2.6 0 1 0-2.6-2.6" stroke="currentColor" opacity="0.85"/>
        <path d="M2.6 12.4h12.8a2.9 2.9 0 1 1-2.9 2.9" stroke="${P.teal}"/>
        <path d="M2.6 17.6h7a2.3 2.3 0 1 1-2.3 2.3" stroke="currentColor" opacity="0.6"/>
      </g>`,
  },
}

/**
 * The stand-in for an element this build has no drawing for.
 *
 * Every element in the recipe tree is drawn, so in the shipped game this is
 * never used. It exists because lib/site.config can point Fusion at a live
 * pair API, and anything that invents a new element at runtime cannot have
 * been drawn in advance. A neutral mark is the honest answer there — falling
 * back to an emoji would put back exactly the thing this file removed.
 */
export const UNKNOWN_MARK =
  `<svg viewBox="0 0 24 24" style="width:100%;height:100%;display:block" ` +
  `aria-hidden="true" focusable="false">` +
  `<circle cx="12" cy="12" r="8.4" fill="none" stroke="currentColor" stroke-width="2.4" ` +
  `stroke-dasharray="3.4 3" opacity="0.75"/>` +
  `<circle cx="12" cy="12" r="2.6" fill="currentColor" opacity="0.6"/></svg>`
/** One element as a complete inline `<svg>`, filling whatever box it is given. */
export function elementSvg(name: string): string {
  const e = FUSION_ART[name]
  if (!e) return ''
  return (
    `<svg viewBox="0 0 24 24" style="width:100%;height:100%;display:block" ` +
    `aria-hidden="true" focusable="false">${e.draw()}</svg>`
  )
}

export const elementNames = () => Object.keys(FUSION_ART)
