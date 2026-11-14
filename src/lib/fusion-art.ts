/**
 * Drawn elements for Fusion — one picture per thing you can hold.
 *
 * Fusion shipped with emoji in every piece, and PLAN.md grandfathered them on
 * a specific argument: the tree was meant to be open-ended, so there was
 * "nothing to draw in advance." That argument does not survive contact with
 * the actual game. The recipe table is a closed set (a hundred and twelve now),
 * all of them reachable from the four starters and all of them known at build
 * time, so there is nothing to draw in advance *except* every one of them.
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

  /* ---- the five newest ---------------------------------------------------- */
  Island: {
    subject: 'a small landmass ringed by open water, a single leaning palm',
    draw: () => `
      <ellipse cx="12" cy="16.2" rx="10.6" ry="4.4" fill="${P.blue}"/>
      <path d="M5.4 16c.8-2.4 3.2-4 6.6-4s5.8 1.6 6.6 4c-2.1.9-4.2 1.3-6.6 1.3s-4.5-.4-6.6-1.3Z" fill="${P.olive}"/>
      <path d="M12.4 12.4c.4-3.4 1.6-5.6 3.6-6.8" fill="none" stroke="${P.clay}" stroke-width="2.2" stroke-linecap="round"/>
      <g fill="${P.green}">
        <path d="M16 5.6c1.6-.6 3-.4 4 .6-1.4.8-2.8.8-4-.6Z"/>
        <path d="M16 5.6c-.2-1.6.4-2.8 1.6-3.6-.2 1.6.2 2.8-1.6 3.6Z"/>
        <path d="M16 5.6c1.6.4 2.6 1.4 2.8 2.8-1.6-.2-2.6-1-2.8-2.8Z"/>
      </g>`,
  },
  Oasis: {
    subject: 'a ring of dunes around a small pool of water, one palm',
    draw: () => `
      <path d="M1 21c1.4-5.6 4.4-8.4 7.6-8.4s6.2 2.8 7.6 8.4Z" fill="${P.clay}" opacity="0.55"/>
      <path d="M8 21c1-4.4 3.4-6.6 7-6.6s6 2.2 7 6.6Z" fill="${P.clay}"/>
      <ellipse cx="12" cy="19.6" rx="4.2" ry="1.8" fill="${P.blue}"/>
      <path d="M9.4 15c.2-3.2 1.2-5.2 3-6.4" fill="none" stroke="${P.clay}" stroke-width="2.2" stroke-linecap="round"/>
      <g fill="${P.green}">
        <path d="M12.4 8.6c1.4-.8 2.8-.8 3.8 0-1.2 1-2.6 1-3.8 0Z"/>
        <path d="M12.4 8.6c-.4-1.4.2-2.6 1.4-3.4 0 1.4-.2 2.6-1.4 3.4Z"/>
      </g>`,
  },
  Ruins: {
    subject: 'three broken wall stumps at different heights, rubble at their feet',
    draw: () => `
      <path d="M3 21V12l1.6 2 1-2.6 1.4 2.4V21Z" fill="${P.slate}"/>
      <path d="M9.4 21V8.4l1.8 2.6 1.2-3 1.6 2.8V21Z" fill="${P.ash}"/>
      <path d="M16 21V14l1.4 1.8.9-2.2 1.3 2V21Z" fill="${P.slate}" opacity="0.85"/>
      <path d="M2 21h20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" opacity="0.28"/>
      <g ${soft(0.3)}><circle cx="6.4" cy="20" r="1"/><circle cx="13" cy="20.2" r="0.8"/></g>`,
  },
  Fog: {
    subject: 'a low bank of fog with two wisps drifting above it',
    draw: () => `
      <path d="M2.4 21c-.2-3.6 2.2-6.2 5.6-6.2h8c3.4 0 5.8 2.6 5.6 6.2Z" fill="${P.teal}"/>
      <path d="M3 9.4c2.6-1.6 5-1.6 7.4 0s5 1.6 7.6 0 4-1.6 5-1" fill="none" stroke="currentColor"
            stroke-width="2.6" stroke-linecap="round" opacity="0.6"/>
      <path d="M4 14c2.4-1.4 4.6-1.4 6.8 0s4.6 1.4 7 0 3.6-1.4 4.6-.9" fill="none" stroke="currentColor"
            stroke-width="2.6" stroke-linecap="round" opacity="0.4"/>`,
  },
  Sandstorm: {
    subject: 'a leaning wall of blowing dust with a curling top and streaming grit',
    draw: () => `
      <path d="M2 21c.4-6.4 3-11.4 7.4-13.4-2.6 3.6-3.4 8-3 13.4Z" fill="${P.clay}"/>
      <path d="M9.4 7.6c3-.6 5 1 5.4 3.6.3 2-1 3.4-3 3-1.3-.3-1.8-1.4-1.2-2.4" fill="none"
            stroke="${P.gold}" stroke-width="2.4" stroke-linecap="round" opacity="0.85"/>
      <path d="M13 15.4h7.4M15 18.4h6.4M12.4 21h6.6" stroke="currentColor" stroke-width="2.2"
            stroke-linecap="round" opacity="0.4"/>`,
  },

  /* ---- weather ---------------------------------------------------------- */
  Cloud: {
    subject: 'one fair-weather cloud, three bumps on a flat base',
    draw: () => `
      <path d="M6.6 18.6a4.6 4.6 0 0 1-.5-9.2 6.1 6.1 0 0 1 11.6-1 4.9 4.9 0 0 1 .1 10.2Z" fill="currentColor" opacity="0.96"/>`,
  },
  Rain: {
    subject: 'a grey cloud with three slanting streaks of rain under it',
    draw: () => `
      <path d="M7 12.4a3.8 3.8 0 0 1-.4-7.6 5 5 0 0 1 9.6-.8 4 4 0 0 1 .2 8.4Z" fill="${P.slate}"/>
      <path d="M8.4 15.4l-1.6 4.8M12.6 15.4 11 20.2M16.8 15.4l-1.6 4.8" fill="none" stroke="${P.blue}"
            stroke-width="2.6" stroke-linecap="round"/>`,
  },
  Storm: {
    subject: 'a heavy dark cloud with a small bolt dropping out of it',
    draw: () => `
      <path d="M5.6 13a4.4 4.4 0 0 1-.4-8.8 5.8 5.8 0 0 1 11-1 4.7 4.7 0 0 1 .2 9.8Z" fill="${P.indigo}"/>
      <path d="M12.6 13.4 9 18.6h3l-1.4 4 4.6-5.8h-3l1.6-3.4Z" fill="${P.gold}"/>`,
  },
  Lightning: {
    subject: 'a single large forked bolt, corner to corner',
    draw: () => `
      <path d="M14.6 1.6 5.4 13h5l-2.6 9.4L18.6 9.8h-5.2Z" fill="${P.gold}"/>
      <path d="M19 15.6l2 1M17.4 19.4l1.6 1.8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" opacity="0.5"/>`,
  },
  Snow: {
    subject: 'a six-armed snowflake',
    draw: () => `
      <g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" opacity="0.9">
        <path d="M12 2.6v18.8M3.9 7.3l16.2 9.4M20.1 7.3 3.9 16.7"/>
        <path d="M9.6 4.6 12 7l2.4-2.4M9.6 19.4 12 17l2.4 2.4"/>
      </g>
      <path d="M12 8.600 14.900 10.300v3.400L12 15.400 9.100 13.700v-3.400Z" fill="${P.blue}"/>`,
  },
  Ice: {
    subject: 'a cube of ice seen from a corner, lit on top',
    draw: () => `
      <path d="M12 2.8 20.4 7.4 12 12 3.6 7.4Z" fill="currentColor" opacity="0.85"/>
      <path d="M3.6 7.4 12 12v9.4l-8.4-4.6Z" fill="${P.teal}"/>
      <path d="M20.4 7.4 12 12v9.4l8.4-4.6Z" fill="${P.blue}"/>`,
  },
  Glacier: {
    subject: 'a tongue of ice coming down between two dark peaks',
    draw: () => `
      <path d="M1.6 20.6 8 6.4l4 7.2 3.6-5.2 6.8 12.2Z" fill="${P.slate}"/>
      <path d="M9.4 20.6c.4-4 1.2-6.6 2.6-8.6 1.6 2 2.6 4.6 3 8.6Z" fill="currentColor" opacity="0.88"/>
      <path d="M2 21.6h20" stroke="${P.teal}" stroke-width="2.4" stroke-linecap="round"/>`,
  },
  Blizzard: {
    subject: 'two curling gusts driving snowflakes sideways',
    draw: () => `
      <path d="M2.4 8.4h10.2a2.8 2.8 0 1 0-2.6-3.8M2.4 14.6h14a3 3 0 1 1-2.8 4" fill="none" stroke="${P.indigo}"
            stroke-width="2.4" stroke-linecap="round"/>
      <g fill="currentColor" opacity="0.9"><circle cx="18.4" cy="6.4" r="1.7"/><circle cx="5.4" cy="19.6" r="1.7"/><circle cx="20" cy="11.6" r="1.4"/></g>`,
  },
  Snowman: {
    subject: 'a snowman: two balls, a hat and a carrot nose',
    draw: () => `
      <circle cx="12" cy="16.4" r="5.6" fill="currentColor" opacity="0.88"/>
      <circle cx="12" cy="8.6" r="3.8" fill="currentColor" opacity="0.88"/>
      <path d="M8.4 5.4h7.2M9.8 5.2V2.2h4.4v3" fill="${P.slate}" stroke="${P.slate}" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M12 8.4l4.2 1.2-4.2.8Z" fill="${P.rust}"/>`,
  },
  Flood: {
    subject: 'a roof and chimney standing out of rising water',
    draw: () => `
      <path d="M5 13.6 12 6.6l7 7Z" fill="${P.brick}"/>
      <path d="M15.4 9.4V5.6h2.2v6Z" fill="${P.slate}"/>
      <path d="M1.6 15.4c2-1.6 3.6-1.6 5.4 0s3.6 1.6 5.4 0 3.6-1.6 5.4 0 3 1.4 4.6.4V22H1.6Z" fill="${P.blue}"/>`,
  },
  Waterspout: {
    subject: 'a twisting column of water rising from the sea to a cloud',
    draw: () => `
      <path d="M4.4 3.4h15.2c-.8 2.4-2.6 3.6-4.6 4.6-1.6 2.6-.6 5 .6 7.6l-2 3-2.4-.4c.8-3.4.2-6.2-1.8-8.6C6.8 8.2 5 6.4 4.4 3.4Z" fill="${P.blue}"/>
      <path d="M2.4 20.6c2.2-1.6 4-1.6 6 0s4.4 1.6 6.6 0 4.2-1.4 6.6 0" fill="none" stroke="${P.teal}" stroke-width="2.6" stroke-linecap="round"/>`,
  },
  Smog: {
    subject: 'two chimney stacks under a flat lid of dirty haze',
    draw: () => `
      <path d="M5 21.4V11.6h3.4v9.8ZM13 21.4v-7h3.6v7Z" fill="${P.slate}"/>
      <path d="M2.4 8.6c2-2.4 4.4-3 6.6-1.8 2.2-2.6 5.6-2.8 7.8-.6 2-.4 3.8.4 4.8 2.4-2.6 1.6-5 1.2-6.8-.2-2.6 2-5.4 2-7.6.2-1.8 1-3.4 1-4.8 0Z" fill="${P.ash}"/>
      <path d="M2 21.6h20" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" opacity="0.3"/>`,
  },

  /* ---- growing things --------------------------------------------------- */
  Flower: {
    subject: 'one flower: five round petals, a gold eye, a stem with a leaf',
    draw: () => `
      <path d="M12 12v9.6" stroke="${P.green}" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M12 18c2.6-.2 4-1.4 4.4-3.4-2.4 0-3.8 1-4.4 3.4Z" fill="${P.green}"/>
      <g fill="${P.plum}"><circle cx="12" cy="4.4" r="2.9"/><circle cx="16.3" cy="7.6" r="2.9"/><circle cx="14.7" cy="12.4" r="2.9"/><circle cx="9.3" cy="12.4" r="2.9"/><circle cx="7.7" cy="7.6" r="2.9"/></g>
      <circle cx="12" cy="8.6" r="2.3" fill="${P.gold}"/>`,
  },
  Garden: {
    subject: 'three different flowers in a row behind a low picket fence',
    draw: () => `
      <path d="M5 20V12.6M12 20V10M19 20v-7.4" stroke="${P.green}" stroke-width="2.2" stroke-linecap="round"/>
      <circle cx="5" cy="10" r="3" fill="${P.brick}"/><circle cx="12" cy="7" r="3.4" fill="${P.gold}"/><circle cx="19" cy="10" r="3" fill="${P.indigo}"/>
      <path d="M2 17.4h20M2 21h20" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" opacity="0.45"/>
      <path d="M8.5 15.4v6.4M15.5 15.4v6.4" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" opacity="0.45"/>`,
  },
  Field: {
    subject: 'ploughed rows running away to a flat horizon',
    draw: () => `
      <path d="M2 21.4 8.4 9h7.2L22 21.4Z" fill="${P.olive}"/>
      <path d="M12 9v12.4M9.6 9 6.4 21.4M14.4 9l3.2 12.4" stroke="${P.green}" stroke-width="2.2"/>
      <path d="M2 8.6h20" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" opacity="0.4"/>
      <circle cx="17.6" cy="4.6" r="2" fill="${P.gold}"/>`,
  },
  Wheat: {
    subject: 'a single ear of wheat, grains in a herringbone up the stalk',
    draw: () => `
      <path d="M12 22V4" stroke="${P.gold}" stroke-width="2.2" stroke-linecap="round"/>
      <g fill="${P.gold}">
        <path d="M12 6.4c-3.2-.4-4.4-2-4.4-4.2 2.6.2 4.2 1.6 4.4 4.2ZM12 6.4c3.2-.4 4.4-2 4.4-4.2-2.6.2-4.2 1.6-4.4 4.2Z"/>
        <path d="M12 11.4c-3.2-.4-4.6-2-4.6-4.2 2.6.2 4.4 1.6 4.6 4.2ZM12 11.4c3.2-.4 4.6-2 4.6-4.2-2.6.2-4.4 1.6-4.6 4.2Z"/>
        <path d="M12 16.4c-3.2-.4-4.6-2-4.6-4.2 2.6.2 4.4 1.6 4.6 4.2ZM12 16.4c3.2-.4 4.6-2 4.6-4.2-2.6.2-4.4 1.6-4.6 4.2Z"/>
      </g>`,
  },
  Flour: {
    subject: 'a tied sack of flour with a spilt heap beside it',
    draw: () => `
      <path d="M6 8.6c-2 3.4-2.6 8.6-1 12.8h10c1.6-4.2 1-9.4-1-12.8Z" fill="${P.clay}"/>
      <path d="M6.4 8.4 5 4.4h10l-1.4 4Z" fill="${P.clay}"/>
      <path d="M5.6 8.6h8.8" stroke="${P.rust}" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M14.6 21.4c.6-2.8 2-4.2 3.8-4.2s3 1.400 3.600 4.200Z" fill="currentColor" opacity="0.88"/>`,
  },
  Dough: {
    subject: 'a round of dough on a board, a rolling pin behind it',
    draw: () => `
      <path d="M2.6 6.4h18.8" stroke="${P.clay}" stroke-width="3.4" stroke-linecap="round"/>
      <path d="M4.4 17.6c0-4.400 3.400-7.400 7.600-7.400s7.600 3 7.600 7.400Z" fill="${P.gold}"/>
      <path d="M2.4 19.6h19.200" stroke="${P.slate}" stroke-width="3" stroke-linecap="round"/>
      <path d="M8.4 14.4c.8-1.200 2-1.800 3.400-1.800" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" opacity="0.5"/>`,
  },
  Bread: {
    subject: 'a crusty loaf with three slashes across the top',
    draw: () => `
      <path d="M2.6 15.4c0-5 4-8.400 9.400-8.400s9.400 3.400 9.400 8.400c0 2-1.200 3.200-3 3.200H5.600c-1.800 0-3-1.200-3-3.200Z" fill="${P.rust}"/>
      <path d="M7.400 9.600 9 13.400M11.400 8.800l1.400 4M15.600 9.400l1.200 3.800" stroke="${P.gold}" stroke-width="2.4" stroke-linecap="round"/>`,
  },
  Cactus: {
    subject: 'a saguaro with two raised arms on a strip of sand',
    draw: () => `
      <path d="M12 21V4.400M12 14H7.800a1.600 1.600 0 0 1-1.600-1.600V9M12 11.600h4.200a1.600 1.600 0 0 0 1.600-1.600V7.400" fill="none" stroke="${P.green}"
            stroke-width="3.6" stroke-linecap="round"/>
      <path d="M3 21.400h18" stroke="${P.clay}" stroke-width="2.6" stroke-linecap="round"/>`,
  },
  Dune: {
    subject: 'two crescent dunes, the nearer one casting a shadow',
    draw: () => `
      <path d="M1.600 15.400c3.400-5.400 7.400-7.400 11.400-5.400 2.400 1.200 4 3.200 5 5.400Z" fill="${P.clay}"/>
      <path d="M4.400 21.400c3.600-6 8-8 12.400-5.600 2.200 1.200 3.800 3.200 5.200 5.600Z" fill="${P.gold}"/>
      <circle cx="18.600" cy="5.400" r="2.400" fill="${P.rust}"/>`,
  },

  /* ---- wood, and what is made of it ------------------------------------- */
  Wood: {
    subject: 'a sawn log lying on its side, rings showing on the cut end',
    draw: () => `
      <path d="M6.400 7.400h11.200a4.600 4.600 0 0 1 0 9.200H6.400Z" fill="${P.clay}"/>
      <ellipse cx="6.400" cy="12" rx="3.400" ry="4.600" fill="${P.gold}"/>
      <ellipse cx="6.400" cy="12" rx="1.300" ry="1.900" fill="none" stroke="${P.rust}" stroke-width="2.200"/>
      <path d="M12.400 10.400h5M11.400 13.600h3.600" stroke="${P.rust}" stroke-width="2.200" stroke-linecap="round"/>`,
  },
  Campfire: {
    subject: 'two crossed logs with a flame rising from where they meet',
    draw: () => `
      <path d="M3.400 20.400 20.600 15M3.400 15l17.200 5.400" stroke="${P.clay}" stroke-width="3.400" stroke-linecap="round"/>
      <path d="M12 2.400c3 3.800 4.800 6 4.800 8.600a4.800 4.800 0 0 1-9.600 0c0-2.600 1.800-4.800 4.800-8.600Z" fill="${P.rust}"/>
      <path d="M12 8.600c1.400 2 2.200 3 2.200 4.200a2.200 2.200 0 0 1-4.400 0c0-1.200.8-2.200 2.200-4.200Z" fill="${P.gold}"/>`,
  },
  Boat: {
    subject: 'an open rowing boat on the water, one oar out',
    draw: () => `
      <path d="M2.400 11.400h19.200c-.6 4-3.200 6.200-6.400 6.200H8.800c-3.200 0-5.800-2.200-6.400-6.200Z" fill="${P.clay}"/>
      <path d="M8 11.400h8" stroke="${P.rust}" stroke-width="2.400" stroke-linecap="round"/>
      <path d="M14.400 5 19.600 16" stroke="currentColor" stroke-width="2.200" stroke-linecap="round" opacity="0.6"/>
      <path d="M2 21c2.400-1.400 4.600-1.400 6.800 0s4.600 1.400 6.800 0 4.200-1.400 6.400-.2" fill="none" stroke="${P.blue}" stroke-width="2.400" stroke-linecap="round"/>`,
  },
  Sailboat: {
    subject: 'a small boat under one tall white sail and a jib',
    draw: () => `
      <path d="M11.400 2.400v13.200H3.600Z" fill="currentColor" opacity="0.88"/>
      <path d="M13.400 6v9.600h6.200Z" fill="${P.brick}"/>
      <path d="M2.400 17.400h19.200l-2.600 4.200H5Z" fill="${P.clay}"/>`,
  },
  Paper: {
    subject: 'a sheet of paper with one corner folded and three lines of writing',
    draw: () => `
      <path d="M5 2.400h9.600L19 6.800v14.800H5Z" fill="currentColor" opacity="0.9"/>
      <path d="M14.600 2.400v4.400H19Z" fill="${P.slate}"/>
      <path d="M8 11h8M8 14.400h8M8 17.800h5" stroke="${P.slate}" stroke-width="2.200" stroke-linecap="round"/>`,
  },
  Book: {
    subject: 'a closed book lying flat, page edges showing, a ribbon out of it',
    draw: () => `
      <path d="M3 6.400 14.400 3.600 21 6v10.400L9.600 19.400 3 16.800Z" fill="${P.indigo}"/>
      <path d="M9.600 9.200 21 6v10.400L9.600 19.400Z" fill="currentColor" opacity="0.85"/>
      <path d="M9.600 9.200V19.400" stroke="${P.indigo}" stroke-width="2.200"/>
      <path d="M15.400 17.400v4.200l1.400-1.200 1.400 1.200v-5" fill="${P.brick}"/>`,
  },
  Library: {
    subject: 'a shelf of four books of different heights, one leaning',
    draw: () => `
      <path d="M3.400 19V6.400h3.400V19Z" fill="${P.brick}"/>
      <path d="M7.800 19V4h3.600v15Z" fill="${P.teal}"/>
      <path d="M12.400 19V8h3v11Z" fill="${P.gold}"/>
      <path d="M16.400 19 18.800 6.600l3 .6L19.600 19Z" fill="${P.indigo}"/>
      <path d="M2 20.600h20" stroke="${P.clay}" stroke-width="3" stroke-linecap="round"/>`,
  },

  /* ---- clay --------------------------------------------------------------- */
  Clay: {
    subject: 'a wet lump of clay with a thumbprint pressed into it',
    draw: () => `
      <path d="M3 17.600c-.6-4.600 1.600-8.400 5.600-9.600 2.400-2 6-2 8.200.2 3.400 1.400 5 5 4.200 9.400-.4 2.400-2 3.400-4.200 3.400H7c-2.200 0-3.800-1.200-4-3.400Z" fill="${P.clay}"/>
      <ellipse cx="13" cy="12.600" rx="3.200" ry="2.200" fill="${P.rust}"/>`,
  },
  Pot: {
    subject: 'a fired two-handled pot with a painted band',
    draw: () => `
      <path d="M8.400 3h7.200v2.600c3 1.600 4.800 4.400 4.800 7.800 0 4.600-3.400 8-8.400 8s-8.400-3.400-8.400-8c0-3.400 1.800-6.200 4.800-7.800Z" fill="${P.rust}"/>
      <path d="M4.200 11.400h15.600" stroke="${P.gold}" stroke-width="2.600"/>
      <path d="M7.600 2.800h8.800" stroke="${P.clay}" stroke-width="2.600" stroke-linecap="round"/>`,
  },

  /* ---- metal -------------------------------------------------------------- */
  Rust: {
    subject: 'an old hex nut, half eaten by orange rust',
    draw: () => `
      <path d="M12 2.400 20.400 7.200v9.600L12 21.600 3.600 16.800V7.200Z" fill="${P.slate}"/>
      <path d="M12 2.400 20.400 7.200v5.400c-2.600.4-4-1-4.600-3-2 .2-3.600-.8-3.800-2.800Z" fill="${P.rust}"/>
      <path d="M3.600 14c2 .2 3.200 1.400 3.400 3.200l2.600 2.600-6-3Z" fill="${P.rust}"/>
      <circle cx="12" cy="12" r="3.200" fill="currentColor" opacity="0.85"/>`,
  },
  Engine: {
    subject: 'a steam engine: a boiler, a piston rod and a spoked flywheel',
    draw: () => `
      <path d="M2.400 9.400h10.200v8H2.400Z" fill="${P.slate}"/>
      <path d="M5 9.400V5.400h3v4" fill="${P.slate}"/>
      <circle cx="17.400" cy="15" r="4.600" fill="none" stroke="${P.gold}" stroke-width="2.600"/>
      <path d="M12.600 12.400 17.400 15" stroke="${P.rust}" stroke-width="2.400" stroke-linecap="round"/>
      <path d="M2 20.600h20" stroke="currentColor" stroke-width="2.200" stroke-linecap="round" opacity="0.35"/>`,
  },
  Steamship: {
    subject: 'a steamer with one tall red funnel trailing a puff of steam',
    draw: () => `
      <path d="M1.800 14.400h20.400l-2.800 6H5Z" fill="${P.slate}"/>
      <path d="M6 14.400v-3.600h9.400v3.600Z" fill="currentColor" opacity="0.85"/>
      <path d="M9.600 10.800V5.400h3.400v5.400Z" fill="${P.brick}"/>
      <circle cx="16.400" cy="4.400" r="2.200" fill="currentColor" opacity="0.6"/><circle cx="20" cy="3.400" r="1.500" fill="currentColor" opacity="0.6"/>`,
  },
  Train: {
    subject: 'a steam locomotive side-on: boiler, cab, chimney and three wheels',
    draw: () => `
      <path d="M2.400 8.400h6.200v8.200H2.400Z" fill="${P.brick}"/>
      <path d="M8.600 10.800h10.600a2 2 0 0 1 2 2v3.800H8.600Z" fill="${P.brick}"/>
      <path d="M15.600 10.800V6.400h3v4.400Z" fill="${P.slate}"/>
      <g fill="${P.slate}"><circle cx="5.600" cy="18.400" r="2.800"/><circle cx="12.400" cy="18.800" r="2.400"/><circle cx="18.200" cy="18.800" r="2.400"/></g>`,
  },
  Steel: {
    subject: 'a steel I-beam end-on: two flanges and the web between them',
    draw: () => `
      <path d="M3 3.400h18v4.200H3ZM3 16.400h18v4.200H3Z" fill="${P.slate}"/>
      <path d="M9.600 7.600h4.800v8.800H9.600Z" fill="${P.ash}"/>
      <path d="M5 5.500h14" stroke="currentColor" stroke-width="2.200" stroke-linecap="round" opacity="0.45"/>`,
  },
  Skyscraper: {
    subject: 'one tall tower with lit windows between two shorter blocks',
    draw: () => `
      <path d="M2.600 21.400v-9h4.600v9ZM16.800 21.400v-12h4.600v12Z" fill="${P.slate}"/>
      <path d="M8.200 21.400V4.400L12 2l3.800 2.400v17Z" fill="${P.indigo}"/>
      <g fill="${P.gold}"><path d="M10.200 7h3.600v2.200h-3.600ZM10.200 11.400h3.600v2.200h-3.600ZM10.200 15.800h3.600V18h-3.600Z"/></g>`,
  },
  Diamond: {
    subject: 'a cut diamond, table up, facets catching the light',
    draw: () => `
      <path d="M6.400 4h11.200l4 5.400L12 21.400 2.400 9.400Z" fill="${P.teal}"/>
      <path d="M6.400 4 9 9.400h6L17.600 4Z" fill="currentColor" opacity="0.85"/>
      <path d="M9 9.400 12 21.400l3-12Z" fill="${P.blue}"/>`,
  },

  /* ---- glass and light ---------------------------------------------------- */
  Mirror: {
    subject: 'an oval hand mirror in a gold frame, a glint across the glass',
    draw: () => `
      <ellipse cx="12" cy="9.400" rx="6.800" ry="7.400" fill="${P.gold}"/>
      <ellipse cx="12" cy="9.400" rx="4.600" ry="5.200" fill="${P.teal}"/>
      <path d="M9.600 8.400 13 5.600" stroke="currentColor" stroke-width="2.200" stroke-linecap="round" opacity="0.8"/>
      <path d="M12 16.800v5.200" stroke="${P.gold}" stroke-width="3" stroke-linecap="round"/>`,
  },
  Lens: {
    subject: 'a convex lens edge-on, bending three rays to one point',
    draw: () => `
      <path d="M9 2.400c3.400 3 3.400 16.200 0 19.200-3.400-3-3.400-16.200 0-19.200Z" fill="${P.teal}"/>
      <path d="M1.600 6h5M1.600 12h5M1.600 18h5" stroke="${P.gold}" stroke-width="2.200" stroke-linecap="round"/>
      <path d="M11.400 6 21.400 12M11.400 12h10M11.400 18l10-6" stroke="${P.gold}" stroke-width="2.200" stroke-linecap="round"/>`,
  },
  Telescope: {
    subject: 'a brass-banded telescope pointed up on a tripod',
    draw: () => `
      <path d="M3.400 13 17.600 3.400l3 4.400L6.400 17.400Z" fill="${P.slate}"/>
      <path d="M14.400 5.600l3 4.400" stroke="${P.gold}" stroke-width="2.600"/>
      <path d="M11 13.400v8.200M11 14.400 6 21.600M11 14.400l5 7.200" stroke="currentColor" stroke-width="2.200" stroke-linecap="round" opacity="0.6"/>`,
  },
  Greenhouse: {
    subject: 'a glasshouse in panes, with a plant growing inside it',
    draw: () => `
      <path d="M3 21.400V10.400L12 3.400l9 7v11Z" fill="${P.teal}" opacity="0.9"/>
      <path d="M3 10.400h18M12 3.400v18" stroke="currentColor" stroke-width="2.200" opacity="0.75"/>
      <path d="M7.400 21.400c-.2-3.600.6-5.600 2.600-6.600.6 2.800-.2 5-2.600 6.600Z" fill="${P.green}"/>
      <path d="M16.400 21.400c.2-3-.4-4.800-2.200-5.800-.6 2.400 0 4.400 2.200 5.800Z" fill="${P.green}"/>`,
  },
  Prism: {
    subject: 'a glass prism splitting one white ray into three colours',
    draw: () => `
      <path d="M12 3.400 20.400 19H3.600Z" fill="none" stroke="currentColor" stroke-width="2.400" stroke-linejoin="round" opacity="0.85"/>
      <path d="M1.400 14.400 8.600 11.800" stroke="currentColor" stroke-width="2.400" stroke-linecap="round"/>
      <path d="M15 10.600l7.200-1.200" stroke="${P.brick}" stroke-width="2.400" stroke-linecap="round"/>
      <path d="M15.800 13h6.600" stroke="${P.gold}" stroke-width="2.400" stroke-linecap="round"/>
      <path d="M16.600 15.400l5.800 1.600" stroke="${P.blue}" stroke-width="2.400" stroke-linecap="round"/>`,
  },

  /* ---- electricity -------------------------------------------------------- */
  Electricity: {
    subject: 'a spark jumping between two terminals',
    draw: () => `
      <path d="M3.600 21.400V9.400M20.400 21.400V9.400" stroke="${P.slate}" stroke-width="3.400" stroke-linecap="round"/>
      <circle cx="3.600" cy="7" r="2.600" fill="${P.slate}"/><circle cx="20.400" cy="7" r="2.600" fill="${P.slate}"/>
      <path d="M6.400 7l3.200-3.200 2.400 6 2.600-5.600 3 2.800" fill="none" stroke="${P.gold}" stroke-width="2.600" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  'Light bulb': {
    subject: 'a lit bulb with a screw base and three rays',
    draw: () => `
      <path d="M12 3.400a6.400 6.400 0 0 1 3.600 11.700v2.300H8.400v-2.300A6.400 6.400 0 0 1 12 3.400Z" fill="${P.gold}"/>
      <path d="M8.800 19.600h6.400M10 22h4" stroke="${P.slate}" stroke-width="2.400" stroke-linecap="round"/>
      <path d="M2.400 9.600h2.200M19.400 9.600h2.200M5 3.600l1.600 1.600M19 3.600l-1.600 1.600" stroke="currentColor" stroke-width="2.200" stroke-linecap="round" opacity="0.55"/>`,
  },
  Magnet: {
    subject: 'a red horseshoe magnet with pale pole tips',
    draw: () => `
      <path d="M5 3.400v9a7 7 0 0 0 14 0v-9" fill="none" stroke="${P.brick}" stroke-width="5"/>
      <path d="M2.500 3.400h5v3.800h-5ZM16.500 3.400h5v3.800h-5Z" fill="currentColor" opacity="0.88"/>`,
  },
  Compass: {
    subject: 'a compass: a ring, a red-tipped needle, a pivot',
    draw: () => `
      <circle cx="12" cy="12" r="8.600" fill="none" stroke="${P.gold}" stroke-width="2.800"/>
      <path d="M12 12 9.600 9.600 16.400 7.600Z" fill="${P.brick}"/>
      <path d="M12 12l2.400 2.400L7.600 16.400Z" fill="currentColor" opacity="0.85"/>
      <circle cx="12" cy="12" r="1.500" fill="${P.slate}"/>`,
  },
  Fulgurite: {
    subject: 'a branching tube of fused glass running down through sand',
    draw: () => `
      <path d="M2 6.400h20" stroke="${P.clay}" stroke-width="3" stroke-linecap="round"/>
      <path d="M12 6.400v6l-4.600 3.800v4.600M12 12.400l4.600 3v5.400M12 12.400v9" fill="none" stroke="${P.teal}"
            stroke-width="2.800" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M13.400 1.400 11 4.400" stroke="${P.gold}" stroke-width="2.400" stroke-linecap="round"/>`,
  },

  /* ---- water, at every size ----------------------------------------------- */
  Dam: {
    subject: 'a curved dam wall, water high behind it and a trickle below',
    draw: () => `
      <path d="M2 7.400h9.600v14H2Z" fill="${P.blue}"/>
      <path d="M11 4.400h3.600l3.400 17h-7Z" fill="${P.slate}"/>
      <path d="M18.600 21.400c1-.8 2-.8 3.400 0" fill="none" stroke="${P.blue}" stroke-width="2.400" stroke-linecap="round"/>
      <path d="M3.400 11c1.400-1 2.600-1 4 0" fill="none" stroke="currentColor" stroke-width="2.200" stroke-linecap="round" opacity="0.6"/>`,
  },
  Beach: {
    subject: 'a striped umbrella on sand at the edge of the sea',
    draw: () => `
      <path d="M2 21.400c5-5.600 12.400-7 20-4.800v4.800Z" fill="${P.gold}"/>
      <path d="M13.600 20 10.400 8.400" stroke="${P.slate}" stroke-width="2.200" stroke-linecap="round"/>
      <path d="M3.400 10.400c2-5.400 9.200-7.400 14.200-3.800Z" fill="${P.brick}"/>
      <path d="M17.400 13.400c1.400-.8 3-.8 4.600 0" fill="none" stroke="${P.blue}" stroke-width="2.400" stroke-linecap="round"/>`,
  },
  Sea: {
    subject: 'open water to a flat horizon, a gull over it',
    draw: () => `
      <path d="M1.600 9.400h20.800V22H1.600Z" fill="${P.blue}"/>
      <path d="M4 14c1.800-1.200 3.400-1.200 5 0s3.400 1.200 5 0M11 18.400c1.800-1.200 3.400-1.200 5 0s3.200 1.200 4.600.2" fill="none" stroke="currentColor"
            stroke-width="2.200" stroke-linecap="round" opacity="0.7"/>
      <path d="M13 5.400c1.200-1.400 2.400-1.400 3.200 0 .8-1.400 2-1.400 3.200 0" fill="none" stroke="currentColor" stroke-width="2.200" stroke-linecap="round" opacity="0.7"/>`,
  },
  Ocean: {
    subject: 'the flukes of a whale tail lifted clear of a deep swell',
    draw: () => `
      <path d="M12 15.400c-.600-2.600-.600-4.600 0-6.400C9 9 6 7.400 4.400 3.800c3.400.200 6 1.400 7.600 3.600 1.600-2.200 4.200-3.400 7.600-3.600C18 7.400 15 9 12 9c.600 1.800.600 3.800 0 6.400Z" fill="${P.slate}"/>
      <path d="M1.600 15c2.400-1.800 4.600-1.800 6.800 0s4.800 1.800 7.200 0 4.600-1.600 6.800 0V22H1.600Z" fill="${P.indigo}"/>
      <path d="M5 19.400c1.600-1 3-1 4.400 0" fill="none" stroke="currentColor" stroke-width="2.200" stroke-linecap="round" opacity="0.5"/>`,
  },
  Salt: {
    subject: 'a heap of square salt crystals',
    draw: () => `
      <path d="M2.400 21.400c1.400-5 5-8.400 9.600-8.400s8.200 3.400 9.600 8.400Z" fill="currentColor" opacity="0.6"/>
      <g fill="currentColor" opacity="0.92">
        <path d="M9.400 3.400h5.200v5.200H9.400ZM4.400 10h4.400v4.400H4.400ZM15.400 9.400h4.600V14h-4.600Z"/>
      </g>`,
  },
  Coral: {
    subject: 'a branching red coral on the sea bed',
    draw: () => `
      <path d="M12 21.400v-8M12 15.400 6.400 11V6.400M12 13.400l5.600-4V4.400M6.400 11H3M17.600 9.400H21M12 13.400V3.400" fill="none"
            stroke="${P.brick}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M3 21.600h18" stroke="${P.gold}" stroke-width="2.600" stroke-linecap="round"/>`,
  },
  Seaweed: {
    subject: 'three wavering fronds of kelp rising from the bottom',
    draw: () => `
      <path d="M6 21.400c-2-3 2-5 0-8s2-5 0-8M12 21.400c2-3.400-2-5.600 0-9s-2-5.600 0-9M18 21.400c-2-2.600 2-4.400 0-7s2-4.400 0-6.400" fill="none"
            stroke="${P.green}" stroke-width="3" stroke-linecap="round"/>
      <path d="M2.600 21.600h18.800" stroke="${P.clay}" stroke-width="2.400" stroke-linecap="round"/>`,
  },
  Waterfall: {
    subject: 'water pouring over a cliff edge into a pool of spray',
    draw: () => `
      <path d="M2 3.400h8.400v18H2Z" fill="${P.slate}"/>
      <path d="M10.400 3.400h5.200c1.600 0 2.600 1 2.600 2.600v12h-7.800Z" fill="${P.blue}"/>
      <path d="M13 7.400v8M15.800 9v6" stroke="currentColor" stroke-width="2.200" stroke-linecap="round" opacity="0.65"/>
      <g fill="currentColor" opacity="0.85"><circle cx="12" cy="20" r="2.200"/><circle cx="16.400" cy="20.400" r="2.400"/><circle cx="20.400" cy="20" r="1.800"/></g>`,
  },
  Canyon: {
    subject: 'a river at the bottom of a gorge between two stepped walls',
    draw: () => `
      <path d="M1.600 3.400h7.200v5H10.400v5H12v8.200H1.600Z" fill="${P.rust}"/>
      <path d="M22.400 3.400h-6.200v6H14.600v5H13v7.200h9.400Z" fill="${P.clay}"/>
      <path d="M11.400 21.600h2.200" stroke="${P.blue}" stroke-width="3.400" stroke-linecap="round"/>`,
  },
  Obsidian: {
    subject: 'a sharp shard of black volcanic glass with one bright edge',
    draw: () => `
      <path d="M9.400 2.400 18.400 8l2.200 9.400-8.200 4.200-8.800-6Z" fill="${P.indigo}"/>
      <path d="M9.400 2.400 12.400 21.600 3.600 15.600Z" fill="${P.slate}"/>
      <path d="M11.400 5 17.400 9" stroke="currentColor" stroke-width="2.200" stroke-linecap="round" opacity="0.8"/>`,
  },

  /* ---- life ---------------------------------------------------------------- */
  Life: {
    subject: 'a single cell: a membrane, a nucleus, a few specks',
    draw: () => `
      <path d="M12 2.800c5.200 0 9.200 3.800 9.200 8.800 0 5.400-4 9.600-9.600 9.600-5 0-8.800-3.600-8.800-8.800 0-5.400 4-9.600 9.200-9.600Z" fill="none"
            stroke="${P.green}" stroke-width="2.800"/>
      <circle cx="10.400" cy="11.400" r="3.400" fill="${P.plum}"/>
      <g fill="${P.green}"><circle cx="16.400" cy="9" r="1.400"/><circle cx="15.400" cy="15.400" r="1.600"/></g>`,
  },
  Fish: {
    subject: 'a fish side-on: body, forked tail, one eye',
    draw: () => `
      <path d="M2.400 12c3-4.600 6.600-6.400 10.400-5.400 2 .6 3.600 1.800 4.800 3.600L21.800 6v12l-4.200-4.200c-1.200 1.800-2.800 3-4.800 3.600-3.800 1-7.400-.8-10.400-5.400Z" fill="${P.blue}"/>
      <circle cx="7.400" cy="11" r="1.400" fill="currentColor"/>
      <path d="M11 9.400c1 1.600 1 3.600 0 5.200" fill="none" stroke="currentColor" stroke-width="2.200" stroke-linecap="round" opacity="0.55"/>`,
  },
  Bird: {
    subject: 'a small bird perched on a twig, beak to the right',
    draw: () => `
      <path d="M4 15.400c0-4.600 3-7.600 7-7.600 1.400 0 2.600.4 3.600 1a3.400 3.400 0 1 1 3 5.400c-.8 3-3.400 5-6.600 5H2.400Z" fill="${P.brick}"/>
      <path d="M20.400 10.400 23 11.400l-2.600 1Z" fill="${P.gold}"/>
      <circle cx="17.600" cy="10.600" r="1" fill="currentColor"/>
      <path d="M3 21.600h18" stroke="${P.clay}" stroke-width="2.400" stroke-linecap="round"/>`,
  },
  Egg: {
    subject: 'one pale egg sitting in a twig nest',
    draw: () => `
      <path d="M12 2.800c3.400 0 6 5 6 9.200 0 3.800-2.600 6.200-6 6.200s-6-2.400-6-6.200c0-4.200 2.600-9.200 6-9.200Z" fill="currentColor" opacity="0.9"/>
      <path d="M2.400 15.400c1.400 4 5 6.200 9.600 6.200s8.200-2.200 9.600-6.200" fill="none" stroke="${P.clay}" stroke-width="3.200" stroke-linecap="round"/>
      <path d="M5 18.400l3.400-1.400M19 18.400l-3.400-1.400" stroke="${P.rust}" stroke-width="2.200" stroke-linecap="round"/>`,
  },

  /* ---- the sky ---------------------------------------------------------------- */
  Star: {
    subject: 'a five-pointed star',
    draw: () => `
      <path d="M12 2.400l2.900 6.300 6.900.8-5.100 4.700 1.400 6.800-6.100-3.400-6.100 3.400 1.400-6.800L2.200 9.500l6.900-.8Z" fill="${P.gold}"/>`,
  },
  Continent: {
    subject: 'a landmass seen from above, with a bay and an offshore island',
    draw: () => `
      <path d="M5.400 4.400c3-1.800 6.600-1.400 8.400.6 2.600-.4 5 1 5.600 3.400.6 2.400-.6 4-2.600 4.800.6 3-1 5.600-4 6.400-3 .8-5.600-.4-6.600-2.800-2.600-.6-4-2.600-3.800-5.200.2-3 1.200-5.600 3-7.200Z" fill="${P.green}"/>
      <path d="M9 9.400c1.600-.6 3-.2 3.800 1 .8 1.400.2 2.800-1.200 3.400-1.600.6-3 0-3.600-1.400-.4-1.200 0-2.400 1-3Z" fill="${P.olive}"/>
      <circle cx="19.400" cy="18.400" r="2" fill="${P.green}"/>`,
  },
  Planet: {
    subject: 'a ringed planet, the ring passing in front and behind',
    draw: () => `
      <circle cx="12" cy="12" r="6.400" fill="${P.teal}"/>
      <path d="M5.800 10.400C3 11.600 1.400 13 1.800 14.200c.600 1.800 5.600 1.800 11.200 0s9.800-4.600 9.200-6.400c-.400-1.200-2.600-1.600-5.600-1.200" fill="none"
            stroke="${P.gold}" stroke-width="2.600" stroke-linecap="round"/>
      <path d="M8.400 9.400c.800-1.200 2-2 3.400-2.200" fill="none" stroke="currentColor" stroke-width="2.200" stroke-linecap="round" opacity="0.55"/>`,
  },
  Moon: {
    subject: 'a crescent moon with two craters',
    draw: () => `
      <path d="M15.400 2.600a9.600 9.600 0 1 0 6 13.800A8.200 8.200 0 0 1 15.400 2.600Z" fill="currentColor" opacity="0.9"/>
      <circle cx="8.400" cy="12.400" r="1.900" fill="${P.ash}"/><circle cx="12.400" cy="17.600" r="1.400" fill="${P.ash}"/>`,
  },
  Tide: {
    subject: 'a small moon pulling a bulge up in the sea beneath it',
    draw: () => `
      <circle cx="12" cy="5.400" r="3.200" fill="currentColor" opacity="0.9"/>
      <path d="M1.600 21.600v-4c3.400-.4 5.600-2 7-4.400 1.400-2 5.400-2 6.800 0 1.400 2.400 3.600 4 7 4.400v4Z" fill="${P.blue}"/>
      <path d="M12 9.800v1.600" stroke="currentColor" stroke-width="2.200" stroke-linecap="round" opacity="0.5"/>`,
  },
  Eclipse: {
    subject: 'a black disc covering the sun, its corona flaring round the edge',
    draw: () => `
      <circle cx="12" cy="12" r="9.200" fill="${P.gold}"/>
      <circle cx="12" cy="12" r="6.800" fill="${P.slate}"/>
      <path d="M17.400 6.200l1.800-1.800" stroke="currentColor" stroke-width="2.400" stroke-linecap="round" opacity="0.9"/>`,
  },
  Galaxy: {
    subject: 'a two-armed spiral galaxy around a bright core',
    draw: () => `
      <path d="M12 12c0-3 2.400-5 5.400-4.400 3 .6 4.600 3.600 3.800 6.800M12 12c0 3-2.400 5-5.400 4.400-3-.6-4.600-3.600-3.800-6.800" fill="none"
            stroke="${P.plum}" stroke-width="2.800" stroke-linecap="round"/>
      <path d="M12 12c-2.400-1.600-3-4.600-1.400-7M12 12c2.400 1.600 3 4.600 1.400 7" fill="none" stroke="${P.indigo}" stroke-width="2.600" stroke-linecap="round"/>
      <circle cx="12" cy="12" r="2.600" fill="${P.gold}"/>`,
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
