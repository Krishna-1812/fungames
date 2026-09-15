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
  Plant: {
    subject: 'a two-leaf sprout curling up out of a mound of earth',
    draw: () => `
      <path d="M3.4 20.4a7.2 4.4 0 0 1 17.2 0Z" fill="${P.clay}"/>
      <path d="M12 20V11.6" fill="none" stroke="${P.green}" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M12 14c-3.6-.2-5.6-2.4-5.8-5.8 3.8.2 6 2.2 6.4 5.6Z" fill="${P.green}"/>
      <path d="M12 12c3.2-.6 4.8-2.6 5-5.8-3.2.4-5.2 2.2-5.6 5.2Z" fill="${P.green}" opacity="0.85"/>
    `,
  },
  Steam: {
    subject: 'two wavy ribbons of vapor rising off a surface and thinning out',
    draw: () => `
      <path d="M4.4 21.2h6.4" fill="none" stroke="${P.blue}" stroke-width="2.4" stroke-linecap="round" opacity="0.5"/>
      <path d="M9 20.4c1.8-1.1 1.8-2.5 0-3.9s-1.8-2.8 0-3.9 1.8-2.5 0-3.9"
            fill="none" stroke="${P.teal}" stroke-width="3" stroke-linecap="round"/>
      <path d="M15 20.4c1.8-1.1 1.8-2.5 0-3.9s-1.8-2.8 0-3.9"
            fill="none" stroke="${P.teal}" stroke-width="3" stroke-linecap="round" opacity="0.75"/>
    `,
  },
  Lava: {
    subject: 'a squat molten rock with a glowing crack running through it',
    draw: () => `
      <path d="M2.8 15.6c-.3-3.4 2-6 5.3-6.4-.5-2 .4-3.7 2.3-4.5 2.5 1.3 2.9 3.3 1.6 5.2 3.4-.2 6 1.8 6.4 5.1.4 3.5-2.3 6.4-5.8 6.4H8.5c-3.3 0-5.4-2.3-5.7-5.8Z" fill="${P.rust}"/>
      <path d="M7.6 8.8 10.6 13.2 8.6 15.6 13.2 18.4" fill="none" stroke="${P.gold}"
            stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="13.4" cy="18.6" r="1.2" fill="${P.gold}"/>
    `,
  },
  Dust: {
    subject: 'a low puff kicked up off the ground, with coarse grit flying out of it',
    draw: () => `
      <path d="M2.6 20.6a3.1 3.1 0 0 1 .4-6.1A4.4 4.4 0 0 1 12 14.2a2.6 2.6 0 0 1 2.7 2.6c0 .6-.2 1.1-.5 1.5a2.6 2.6 0 0 1-2.3 3.7H5.4c-1.3 0-2.6-.3-2.8-1.4Z" fill="${P.clay}"/>
      <g fill="currentColor">
        <circle cx="19.4" cy="8.8" r="1.2"/>
        <circle cx="21.8" cy="13.6" r="1"/>
        <circle cx="16" cy="5.6" r="1"/>
      </g>
    `,
  },
  Smoke: {
    subject: 'a narrow column of smoke curling into a spiral, rising off an ember',
    draw: () => `
      <path d="M9.6 21.6h4.8" fill="none" stroke="${P.rust}" stroke-width="2.4" stroke-linecap="round" opacity="0.75"/>
      <path d="M11 21c-1.8-2.2-1.8-4.2 0-6.2s1.8-4-.4-6.4c2.6.6 3.6 2.4 2.8 4.8-.6 1.8-1.6 2.8-1 4.4.4 1.1 1.3 1.7 2.6 1.7a2.3 2.3 0 1 1-2.3 2.3"
            fill="none" stroke="${P.slate}" stroke-width="2.4" stroke-linecap="round"/>
    `,
  },
  Wave: {
    subject: 'a swell curling over into a breaking crest',
    draw: () => `
      <path d="M2.4 18.6c2.4-2.4 4.6-2.4 7 0s4.6 2.4 7 0 3.2-2.1 4.6-1" fill="none" stroke="${P.blue}"
            stroke-width="2.6" stroke-linecap="round"/>
      <path d="M13.2 14.6c2.1-2.9 1.5-5.8-1.6-7.2 3.4-.5 5.9 1.3 6.1 4.4.2 2.7-1.6 4.7-4.5 5.1Z" fill="${P.blue}"/>
      <path d="M14.2 9.6c.9.8 1.3 1.7 1.1 2.9" fill="none" stroke="currentColor" stroke-width="2.2"
            stroke-linecap="round" opacity="0.6"/>
    `,
  },
  Stone: {
    subject: 'an angular, rough boulder',
    draw: () => `
      <path d="M3.4 14.6 7 8.2l6-2.6 6.6 3-1.4 7.6-4.2 5.4H8.2Z" fill="${P.slate}"/>
      <path d="M7 8.2 12 12l1-6.4" fill="none" stroke="${P.ash}" stroke-width="2.2"
            stroke-linejoin="round" stroke-linecap="round" opacity="0.65"/>
    `,
  },
  Swamp: {
    subject: 'a murky pool, rippling, with reeds growing out of it',
    draw: () => `
      <ellipse cx="12" cy="18.6" rx="9" ry="3.2" fill="${P.teal}"/>
      <path d="M9.8 18.4c.6-4.2 0-6.8-2-9.1 2.9.6 4.4 2.9 4.4 6.4 0 1.1-.2 1.9-.6 2.7Z" fill="${P.green}"/>
      <path d="M13.6 18c-.2-3.3 1-5.2 3.1-6.6-.4 3.3-1.4 5.2-3.1 6.6Z" fill="${P.green}" opacity="0.85"/>
      <path d="M6.2 18.8c2-1 3.6-1 5.6 0s3.6 1 5.6 0" fill="none" stroke="currentColor"
            stroke-width="2.2" stroke-linecap="round" opacity="0.3"/>
    `,
  },
  Ash: {
    subject: 'fine flakes drifting down onto a small heap',
    draw: () => `
      <path d="M4.8 21.6a7.2 4 0 0 1 14.4 0Z" fill="${P.ash}"/>
      <g fill="currentColor" opacity="0.75">
        <ellipse cx="7.2" cy="11.4" rx="1.7" ry="0.9" transform="rotate(30 7.2 11.4)"/>
        <ellipse cx="13" cy="5.8" rx="1.7" ry="0.9" transform="rotate(-20 13 5.8)"/>
        <ellipse cx="17.6" cy="12" rx="1.7" ry="0.9" transform="rotate(15 17.6 12)"/>
        <ellipse cx="10" cy="16.2" rx="1.5" ry="0.8" transform="rotate(40 10 16.2)"/>
        <ellipse cx="15.8" cy="17" rx="1.5" ry="0.8" transform="rotate(-30 15.8 17)"/>
      </g>
    `,
  },
  Sand: {
    subject: 'a heaped dune with a flat top and a sharp windward edge',
    draw: () => `
      <path d="M3.2 21.2 3.2 15.4 8.6 10 14 10 21 21.2Z" fill="${P.gold}"/>
      <path d="M11 17.6 16.4 17.6" fill="none" stroke="currentColor" stroke-width="2.2"
            stroke-linecap="round" opacity="0.3"/>
    `,
  },
  Glass: {
    subject: 'a rounded vessel of glass, transparent, with a highlight down one side',
    draw: () => `
      <path d="M6.6 3.4h10.8l-1.4 15a4.4 4.4 0 0 1-4.4 4h-.4a4.4 4.4 0 0 1-4.4-4Z"
            fill="currentColor" opacity="0.1" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/>
      <ellipse cx="12" cy="3.4" rx="5.4" ry="1.6" fill="none" stroke="currentColor" stroke-width="2.2"/>
      <path d="M8.8 6.6 7.7 16" fill="none" stroke="currentColor" stroke-width="2.2"
            stroke-linecap="round" opacity="0.55"/>
    `,
  },
  Forest: {
    subject: 'two overlapping pines',
    draw: () => `
      <path d="M7 21.4h3.2V17.4H7Z" fill="${P.clay}"/>
      <path d="M16.2 21.4h2.8v-3.6h-2.8Z" fill="${P.clay}" opacity="0.9"/>
      <path d="M17.6 8.2 21.2 14.4h-1.8l2.4 4.4h-8.2l2.4-4.4h-1.8Z" fill="${P.olive}"/>
      <path d="M8.6 4.2 13.4 11.8h-2.2l3 5.4H4.2l3-5.4H5.2Z" fill="${P.green}"/>
    `,
  },
  Volcano: {
    subject: 'a squat erupting cone under a big ash plume, with a lava streak',
    draw: () => `
      <path d="M4 21 9.6 14.6h4.8L20 21Z" fill="${P.clay}"/>
      <path d="M9.6 14.6h4.8l-.9 2.2h-3Z" fill="${P.rust}"/>
      <path d="M11.2 16.8 12.8 16.8 12.4 21 10.2 21Z" fill="${P.rust}"/>
      <g ${soft(0.42)}>
        <circle cx="12" cy="8.6" r="4.2"/>
        <circle cx="7.6" cy="10.2" r="2.6"/>
        <circle cx="16.4" cy="10.4" r="2.7"/>
        <circle cx="12.4" cy="4" r="2.3"/>
      </g>`,
  },
  Geyser: {
    subject: 'a jet of water blasting up out of a low vent, with spray',
    draw: () => `
      <path d="M5 21c-.5-2.6 0-4.4 1.6-5.6h10.8c1.6 1.2 2.1 3 1.6 5.6Z" fill="${P.slate}"/>
      <path d="M10.8 15.4c-1.1-4.8-1.5-8.4.4-12.6 1.1 4.4.5 7.8 2.2 12.6Z" fill="${P.blue}"/>
      <g fill="${P.blue}">
        <circle cx="7.2" cy="10.6" r="1.3" opacity="0.85"/>
        <circle cx="16.8" cy="9" r="1.4" opacity="0.85"/>
        <circle cx="9" cy="5.4" r="1.1" opacity="0.7"/>
        <circle cx="15.4" cy="4.8" r="1.2" opacity="0.7"/>
      </g>`,
  },
  Alcohol: {
    subject: 'a stout bottle with a neck, cap and label band',
    draw: () => `
      <path d="M10 2.2h4v3.2c1.8 1.1 2.8 2.9 2.8 5.2v9a2 2 0 0 1-2 2h-5.6a2 2 0 0 1-2-2v-9c0-2.3 1-4.1 2.8-5.2Z"
            fill="${P.green}"/>
      <rect x="9.2" y="13.6" width="5.6" height="3" fill="${P.gold}"/>
      <rect x="10.1" y="1.2" width="3.8" height="1.8" rx="0.6" fill="${P.clay}"/>
      <path d="M9.3 9.6h5.4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" opacity="0.28"/>`,
  },
  Mountain: {
    subject: 'a clean snow-capped peak with a ridge line',
    draw: () => `
      <path d="M2.4 20.6 9.6 7.4l3 4.6 2.4-3 6.2 11.6Z" fill="${P.slate}"/>
      <path d="M9.6 7.4 12.2 11.6 10.6 13.6 8 12Z" ${soft(0.42)}/>
      <path d="M15 9 16.4 11.2 15.2 12.8 13.8 11.4Z" ${soft(0.42)}/>
      <path d="M5.2 20.6 11.2 11.2" fill="none" stroke="currentColor" stroke-width="2.2"
            stroke-linecap="round" opacity="0.25"/>`,
  },
  River: {
    subject: 'a winding ribbon of water narrowing away between grassy banks',
    draw: () => `
      <path d="M1.6 21 8.4 4.6h7.2L22.4 21Z" fill="${P.olive}"/>
      <path d="M12 21c2.4-3 2.6-5-.4-6.6 3-1 3.2-3 .4-5.4 2.4-1 2.6-2.6.6-4.6" fill="none"
            stroke="${P.blue}" stroke-width="4.4" stroke-linecap="round"/>
      <path d="M12 21c2.4-3 2.6-5-.4-6.6 3-1 3.2-3 .4-5.4 2.4-1 2.6-2.6.6-4.6" fill="none"
            stroke="currentColor" stroke-width="2.2" stroke-linecap="round" opacity="0.18"/>`,
  },
  Desert: {
    subject: 'two rolling dunes under a hot sun',
    draw: () => `
      <circle cx="17.4" cy="6" r="3.4" fill="${P.gold}"/>
      <path d="M1 21c1-6 3.5-9 6-9s5 3 6 9Z" fill="${P.clay}" opacity="0.5"/>
      <path d="M6 21c1-4 4-5.5 9-5.5s8 1.5 9 5.5Z" fill="${P.clay}"/>`,
  },
  Tsunami: {
    subject: 'a single wave curling over into a breaking crest',
    draw: () => `
      <path d="M2 21c0-8 4.4-14.6 12-16.8-3.4 3-4.4 6.4-2.6 10 3-.4 5-2.4 5.4-5.8 1.4 4-.4 7.4-4 9-3.6 1.6-7.2 1.6-10.8 1.6Z"
            fill="${P.teal}"/>
      <g ${soft(0.4)}>
        <circle cx="12.4" cy="8.6" r="1.3"/>
        <circle cx="15.2" cy="10.6" r="1"/>
      </g>`,
  },
  Mud: {
    subject: 'a thick low puddle with a couple of viscous bubbles',
    draw: () => `
      <ellipse cx="12" cy="15.6" rx="10.2" ry="4.6" fill="${P.clay}"/>
      <circle cx="8.8" cy="14.2" r="1.6" fill="none" stroke="currentColor" stroke-width="2.2" opacity="0.32"/>
      <circle cx="15" cy="16.4" r="1.1" fill="none" stroke="currentColor" stroke-width="2.2" opacity="0.32"/>`,
  },
  Lake: {
    subject: 'a still, closed body of water with a far shore behind it',
    draw: () => `
      <path d="M2 11.4c2.4-2.2 5-3.4 7.6-3.4 3 0 5 1.4 7.6 1.4 2 0 3.4-.6 4.8-1.8v3.2c-1.4 1.2-2.8 1.8-4.8 1.8-2.6 0-4.6-1.4-7.6-1.4-2.6 0-5.2 1.2-7.6 3.4Z"
            fill="${P.olive}" opacity="0.55"/>
      <ellipse cx="12" cy="16.4" rx="10.2" ry="5" fill="${P.blue}"/>
      <path d="M4.6 16c2.6-1.4 4.6-1.4 7 0s4.6 1.4 7 0" fill="none" stroke="currentColor"
            stroke-width="2.2" stroke-linecap="round" opacity="0.22"/>`,
  },
  Land: {
    subject: 'a landmass seen from above, coastline on every side, with a ridge across it',
    draw: () => `
      <path d="M4.4 6.4c3-2.2 6.6-2.4 9.6-1 2.8 1.3 4.4.8 6 2.2 1.8 1.6 1.4 4-.6 5.4-1.8 1.3-1.6 2.6-.4 4 1.2 1.4.6 3.4-1.6 4-2.6.7-4.6-.6-7-.4-2.6.2-4.4 1.4-6.4.2-2-1.2-2.2-3.6-.8-5.4 1.3-1.7 1.2-2.8 0-4.2-1.3-1.6-.8-3.6 1.2-4.8Z" fill="${P.olive}"/>
      <path d="M6.4 14.4c2.2-2.6 4.6-4 7.2-4.2 2.2-.2 3.8.4 5 1.8" fill="none" stroke="${P.clay}" stroke-width="2.6" stroke-linecap="round"/>
      <g fill="${P.green}">
        <circle cx="8.2" cy="17" r="1.5"/><circle cx="14.6" cy="17.6" r="1.2"/>
      </g>`,
  },
  Tornado: {
    subject: 'a funnel twisting down to a point where it touches down',
    draw: () => `
      <path d="M3 4.4h18L15.5 9 13 14 12 20.5 11 14 8.5 9Z" fill="${P.slate}"/>
      <path d="M6 7.6c2.6 1 8.6 1 13 0" fill="none" stroke="currentColor" stroke-width="2.2"
            stroke-linecap="round" opacity="0.3"/>
      <path d="M8 12c2 .8 6.8.8 8.8 0" fill="none" stroke="currentColor" stroke-width="2.2"
            stroke-linecap="round" opacity="0.3"/>
      <path d="M9.4 21.4c1-.6 2-.6 3 0s2 .6 3 0" fill="none" stroke="currentColor" stroke-width="2.2"
            stroke-linecap="round" opacity="0.3"/>`,
  },
  Brick: {
    subject: 'a single brick in three-quarter view, its top and side face visible',
    draw: () => `
      <path d="M3 19 L3 12 L15 12 L15 19 Z" fill="${P.brick}"/>
      <path d="M3 12 L8 9 L20 9 L15 12 Z" fill="${P.clay}"/>
      <path d="M15 12 L20 9 L20 16 L15 19 Z" fill="${P.rust}"/>`,
  },
  Wall: {
    subject: 'a bonded course of bricks with staggered joints under a capping row',
    draw: () => `
      <rect x="2" y="7" width="20" height="13" fill="${P.slate}"/>
      <rect x="1.5" y="3" width="21" height="4" rx="0.6" fill="${P.clay}"/>
      <g fill="${P.brick}">
        <rect x="2.5" y="7.5" width="8" height="3.5"/>
        <rect x="11.5" y="7.5" width="8" height="3.5"/>
        <rect x="2.5" y="11.5" width="3.5" height="3.5"/>
        <rect x="7" y="11.5" width="8" height="3.5"/>
        <rect x="16" y="11.5" width="4" height="3.5"/>
        <rect x="2.5" y="15.5" width="8" height="3.5"/>
        <rect x="11.5" y="15.5" width="8" height="3.5"/>
      </g>`,
  },
  House: {
    subject: 'one dwelling close up, a peaked roof, chimney, door and two windows',
    draw: () => `
      <rect x="4" y="13" width="16" height="8" fill="${P.clay}"/>
      <path d="M12 3.5 L2 13 L22 13 Z" fill="${P.rust}"/>
      <rect x="14.5" y="2" width="2.4" height="6" fill="${P.slate}"/>
      <rect x="6" y="15" width="3.6" height="3.6" fill="${P.blue}"/>
      <rect x="14.4" y="15" width="3.6" height="3.6" fill="${P.blue}"/>
      <rect x="10" y="17" width="4" height="4" rx="0.6" fill="currentColor" opacity="0.55"/>`,
  },
  Charcoal: {
    subject: 'three matte irregular lumps with a brown mineral fleck',
    draw: () => `
      <path d="M5 12 L7 9 L11 9 L14 12 L13 17 L7 17 Z" fill="${P.ash}"/>
      <path d="M14.5 10 L16 7.5 L19 8 L20 11 L17.5 12.5 Z" fill="${P.slate}"/>
      <path d="M13.5 17.5 L15 16 L18 16.5 L18.5 19 L15.5 20 Z" fill="${P.ash}"/>
      <path d="M8.5 11 L10.5 10 L9.5 13 Z" fill="${P.rust}"/>
      <path d="M16.5 9 L18 9.5 L17 11 Z" fill="${P.rust}"/>`,
  },
  Hourglass: {
    subject: 'two glass bulbs in a frame with sand falling through the neck',
    draw: () => `
      <rect x="5" y="2.5" width="14" height="2" rx="1" fill="${P.clay}"/>
      <rect x="5" y="19.5" width="14" height="2" rx="1" fill="${P.clay}"/>
      <path d="M6.4 4.5 L6.4 19.5" stroke="currentColor" stroke-width="2.2" opacity="0.35" stroke-linecap="round"/>
      <path d="M17.6 4.5 L17.6 19.5" stroke="currentColor" stroke-width="2.2" opacity="0.35" stroke-linecap="round"/>
      <path d="M7 4.5 C7 9 12 11 12 12 C12 11 17 9 17 4.5 Z" fill="${P.teal}" opacity="0.28"/>
      <path d="M7 19.5 C7 15 12 13 12 12 C12 13 17 15 17 19.5 Z" fill="${P.teal}" opacity="0.28"/>
      <path d="M8.5 5 C9 7.6 12 9 12 10.2 C12 9 15 7.6 15.5 5 Z" fill="${P.gold}"/>
      <rect x="11.5" y="10.6" width="1" height="2.6" fill="${P.gold}"/>
      <path d="M8.7 19.2 C9.2 17 14.8 17 15.3 19.2 Z" fill="${P.gold}"/>`,
  },
  Metal: {
    subject: 'a machined bar with a hard diagonal specular highlight',
    draw: () => `
      <rect x="3" y="8" width="18" height="8" rx="1" fill="${P.slate}"/>
      <path d="M8 8 L9.8 8 L14.8 16 L13 16 Z" fill="${P.ash}"/>`,
  },
  Blade: {
    subject: 'a knife blade with a centre bevel, a brass guard and a wrapped grip',
    draw: () => `
      <path d="M11 2 L13 2 L15.5 14 L8.5 14 Z" fill="${P.slate}"/>
      <path d="M12 3.2 L12 12.8" stroke="currentColor" stroke-width="2.2" opacity="0.4" stroke-linecap="round"/>
      <rect x="6" y="14" width="12" height="1.8" fill="${P.gold}"/>
      <rect x="10.4" y="15.8" width="3.2" height="6" rx="1" fill="${P.clay}"/>
      <circle cx="12" cy="22" r="1.6" fill="${P.gold}"/>`,
  },
  Village: {
    subject: 'three small roofs clustered at different depths above a lane',
    draw: () => `
      <path d="M9 22 L15 22 L13 20 L11 20 Z" fill="currentColor" opacity="0.18"/>
      <rect x="2.5" y="11" width="5" height="3" fill="${P.clay}"/>
      <path d="M5 8 L2.5 11 L7.5 11 Z" fill="${P.rust}"/>
      <rect x="16.5" y="10.5" width="5" height="3" fill="${P.clay}"/>
      <path d="M19 7.5 L16.5 10.5 L21.5 10.5 Z" fill="${P.rust}"/>
      <rect x="7" y="15" width="10" height="5" fill="${P.clay}"/>
      <path d="M12 10 L7 15 L17 15 Z" fill="${P.rust}"/>`,
  },
  City: {
    subject: 'a skyline of towers of differing heights, lit windows in the silhouette',
    draw: () => `
      <g fill="currentColor">
        <rect x="2" y="13" width="3" height="7"/>
        <rect x="5.3" y="9" width="2.6" height="11"/>
        <rect x="8.2" y="5" width="3.4" height="15"/>
        <rect x="12" y="11" width="2.8" height="9"/>
        <rect x="15.2" y="7" width="3" height="13"/>
        <rect x="18.6" y="14" width="3.2" height="6"/>
      </g>
      <g fill="${P.gold}">
        <rect x="9" y="8" width="0.9" height="0.9"/>
        <rect x="9" y="11" width="0.9" height="0.9"/>
        <rect x="16" y="10" width="0.9" height="0.9"/>
        <rect x="16" y="13" width="0.9" height="0.9"/>
        <rect x="5.9" y="12" width="0.8" height="0.8"/>
        <rect x="13" y="14" width="0.8" height="0.8"/>
      </g>`,
  },
  Sun: {
    subject: 'a disc with a ring of corona rays, no flower and no arcs',
    draw: () => `
      <circle cx="12" cy="12" r="5" fill="${P.gold}"/>
      <g stroke="currentColor" stroke-width="2.4" stroke-linecap="round" opacity="0.75">
        <path d="M18 12 L20.5 12"/>
        <path d="M16.24 16.24 L18.01 18.01"/>
        <path d="M12 18 L12 20.5"/>
        <path d="M7.76 16.24 L5.99 18.01"/>
        <path d="M6 12 L3.5 12"/>
        <path d="M7.76 7.76 L5.99 5.99"/>
        <path d="M12 6 L12 3.5"/>
        <path d="M16.24 7.76 L18.01 5.99"/>
      </g>`,
  },
  Rainbow: {
    subject: 'four concentric arcs banding upward, no disc at the centre',
    draw: () => `
      <g fill="none" stroke-width="2.4" stroke-linecap="round">
        <path d="M3 22 A9 9 0 0 1 21 22" stroke="${P.brick}"/>
        <path d="M5 22 A7 7 0 0 1 19 22" stroke="${P.gold}"/>
        <path d="M7 22 A5 5 0 0 1 17 22" stroke="${P.green}"/>
        <path d="M9 22 A3 3 0 0 1 15 22" stroke="${P.blue}"/>
      </g>`,
  },
  Sunflower: {
    subject: 'a dark seed head ringed by petals, on a stem with two leaves',
    draw: () => `
      <path d="M12 13 C11.3 16.4 12.7 19 12 22" fill="none" stroke="${P.green}" stroke-width="2.6"
            stroke-linecap="round"/>
      <path d="M12 17.4 C9.2 16.6 7 18 7 19.6 C9.6 20.1 11.6 19 12 17.4 Z" fill="${P.green}"/>
      <path d="M12 19.6 C14.7 19.1 16.8 20 16.8 21.6 C14.2 22.1 12.3 21 12 19.6 Z" fill="${P.green}"/>
      <g fill="${P.gold}">
        <ellipse cx="12" cy="5.2" rx="1.8" ry="3" transform="rotate(0 12 10)"/>
        <ellipse cx="12" cy="5.2" rx="1.8" ry="3" transform="rotate(45 12 10)"/>
        <ellipse cx="12" cy="5.2" rx="1.8" ry="3" transform="rotate(90 12 10)"/>
        <ellipse cx="12" cy="5.2" rx="1.8" ry="3" transform="rotate(135 12 10)"/>
        <ellipse cx="12" cy="5.2" rx="1.8" ry="3" transform="rotate(180 12 10)"/>
        <ellipse cx="12" cy="5.2" rx="1.8" ry="3" transform="rotate(225 12 10)"/>
        <ellipse cx="12" cy="5.2" rx="1.8" ry="3" transform="rotate(270 12 10)"/>
        <ellipse cx="12" cy="5.2" rx="1.8" ry="3" transform="rotate(315 12 10)"/>
      </g>
      <circle cx="12" cy="10" r="3.2" fill="${P.rust}"/>`,
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
