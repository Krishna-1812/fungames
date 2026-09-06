/**
 * Drawn icons — the replacement for the emoji inside the games.
 *
 * Emoji were doing real work here: an item in Spend It, a layer in Ambient
 * Mix, a milestone in Paper Folds. They were also the loudest remaining tell
 * that nobody drew anything, and worse than that, they are not one set. 🍔 and
 * 🛥️ and 🪐 come from different corners of one vendor's library, drawn by
 * different people at different times, and they render as three other people's
 * work again on Android, Windows and iOS. A row of thirty of them cannot look
 * deliberate, because it isn't.
 *
 * These are one set. Every icon is drawn on the same 24-unit grid with the
 * same 1.8 stroke and round caps, and scripts/check-icons.mjs rasterises the
 * lot and fails if one drifts off that grid, is unreadable at the size it
 * actually renders, or is close enough to another that they should have been
 * the same icon.
 *
 * ---- colour ----
 *
 * Ink is `currentColor`, so the page decides: Spend It and Paper Folds are
 * cream pages with dark ink, Ambient Mix is nearly black with pale ink, and
 * the same drawing has to work on both. Fills come from PALETTE, whose entries
 * are deliberately all mid-tone — every one clears 3:1 against both a cream
 * page and a near-black one, which is a narrow band to design in and the
 * reason these read as muted rather than as emoji. The checker enforces the
 * band; widening it means an icon that vanishes on one of the two.
 *
 * Where something wants to be pale — paper, milk, a shirt — it uses
 * currentColor at low opacity rather than white, so it inverts with the page
 * instead of disappearing into it.
 */

/**
 * Every fill an icon may use. Mid-tone by necessity: see the note above.
 * check-icons fails on any literal colour outside this table.
 */
export const PALETTE = {
  rust: '#b5651d',
  gold: '#b8912a',
  olive: '#6f7f2e',
  green: '#2e7d5b',
  teal: '#1f7d80',
  blue: '#3a6ea5',
  indigo: '#5f6ab8',
  plum: '#9a4f91',
  brick: '#c04545',
  clay: '#a86b4c',
  slate: '#5b6b78',
  ash: '#767c7a',
} as const

export type IconKey = string

export type Icon = {
  /** What it is a picture of. */
  subject: string
  /** Inner markup on a 0 0 24 24 grid. */
  draw: () => string
}

const P = PALETTE

/** Ink at a fraction of the page's own text colour — inverts with the page. */
const soft = (o: number) => `fill="currentColor" opacity="${o}"`

export const ICONS: Record<IconKey, Icon> = {
  /* ---- weather and outdoors ------------------------------------------- */
  rain: {
    subject: 'a cloud with rain falling out of it',
    draw: () => `
      <path d="M6.5 13a3.6 3.6 0 0 1 .5-7.1A5 5 0 0 1 16.4 7 3 3 0 0 1 17 13Z" fill="${P.slate}"/>
      <g stroke="${P.blue}" stroke-width="2.2" stroke-linecap="round">
        <path d="M8.6 15 6 22"/><path d="M13 15 10.4 22.6"/><path d="M17.4 15 14.8 22"/>
      </g>`,
  },
  waves: {
    subject: 'three lines of swell',
    draw: () => `
      <g fill="none" stroke="${P.teal}" stroke-width="2.4" stroke-linecap="round">
        <path d="M2.5 8.5c2-2 3.6-2 5.2 0s3.2 2 4.8 0 3.2-2 4.8 0 2.4 2 4.2.4"/>
      </g>
      <g fill="none" stroke="${P.blue}" stroke-width="2.4" stroke-linecap="round">
        <path d="M2.5 13.5c2-2 3.6-2 5.2 0s3.2 2 4.8 0 3.2-2 4.8 0 2.4 2 4.2.4"/>
        <path d="M2.5 18.5c2-2 3.6-2 5.2 0s3.2 2 4.8 0 3.2-2 4.8 0 2.4 2 4.2.4" opacity="0.55"/>
      </g>`,
  },
  wind: {
    subject: 'three gusts, one of them curling back',
    draw: () => `
      <g fill="none" stroke-width="2.6" stroke-linecap="round">
        <path d="M2.5 7.6h9.6a2.6 2.6 0 1 0-2.6-2.6" stroke="currentColor"/>
        <path d="M2.5 12.4h13a2.9 2.9 0 1 1-2.9 2.9" stroke="${P.teal}"/>
        <path d="M2.5 17.4h7.2a2.3 2.3 0 1 1-2.3 2.3" stroke="currentColor"/>
      </g>`,
  },
  fire: {
    subject: 'a campfire over two logs',
    draw: () => `
      <path d="M12 2.6c3.4 4.2 5.4 6.6 5.4 9.2a5.4 5.4 0 0 1-10.8 0c0-2.6 2-5 5.4-9.2Z" fill="${P.rust}"/>
      <path d="M12 9.6c1.7 2.4 2.6 3.6 2.6 4.9a2.6 2.6 0 0 1-5.2 0c0-1.3.9-2.5 2.6-4.9Z" fill="${P.gold}"/>
      <g stroke="${P.clay}" stroke-width="2" stroke-linecap="round">
        <path d="M4.4 19.6 19 21"/><path d="M5 21.2 19.6 19.4"/>
      </g>`,
  },
  thunder: {
    subject: 'a bolt out of a heavy cloud',
    draw: () => `
      <path d="M13 1.4 4.6 13.6h4.8l-2 9 12-13.4h-5.2l3-7.8Z" fill="${P.gold}"/>
      <path d="M4.6 12.8a3.2 3.2 0 0 1 .6-6.3 4.4 4.4 0 0 1 8.2.7 2.7 2.7 0 0 1 .3 5.4Z"
            fill="${P.slate}" opacity="0.92"/>`,
  },

  /* ---- living things ---------------------------------------------------- */
  bird: {
    subject: 'a small bird on a branch',
    draw: () => `
      <path d="M14.6 5.6a3.6 3.6 0 0 0-6.7 1.8c0 2.2-1.6 3.3-3.4 4 2.1.9 3.7 2.9 6.4 2.9 3.3 0 5.6-2.2 5.6-5.1 0-.9-.2-1.6-.5-2.2l2.6-1.8-3.1-.4Z" fill="${P.teal}"/>
      <circle cx="14.6" cy="6.6" r="0.85" fill="currentColor"/>
      <path d="M17.4 9.8c1.6.6 2.9 1.9 3.4 3.6" fill="none" stroke="${P.teal}" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M3 18.6h18" stroke="${P.clay}" stroke-width="2.2" stroke-linecap="round"/>
      <g stroke="${P.clay}" stroke-width="2.2" stroke-linecap="round">
        <path d="M10.4 15.2v3.2"/><path d="M12.6 15.2v3.2"/>
      </g>`,
  },
  cricket: {
    subject: 'a cricket, mid-chirp',
    draw: () => `
      <ellipse cx="12.5" cy="13.5" rx="6.2" ry="4" transform="rotate(-12 12.5 13.5)" fill="${P.olive}"/>
      <circle cx="18.4" cy="10.6" r="2.5" fill="${P.olive}"/>
      <circle cx="19.2" cy="10" r="0.8" fill="currentColor"/>
      <g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" opacity="0.8">
        <path d="M19.6 8.4 22.4 5.4"/><path d="M18.6 8 19.6 4.4"/>
        <path d="M13.4 15.8 15 20.6"/><path d="M9 16.2 6.6 20.8"/>
        <path d="M8 11.6 4.4 8.6"/>
      </g>`,
  },

  /* ---- rooms and things in them ----------------------------------------- */
  cafe: {
    subject: 'a takeaway cup with steam off it',
    draw: () => `
      <g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" opacity="0.55">
        <path d="M9.6 4.6c-1 -1.2 1 -2.2 0 -3.4"/><path d="M13.6 4.6c-1 -1.2 1 -2.2 0 -3.4"/>
      </g>
      <path d="M2.6 8.6h13.2v7.6a4.4 4.4 0 0 1-4.4 4.4H7a4.4 4.4 0 0 1-4.4-4.4Z" fill="${P.clay}"/>
      <path d="M15.8 10.4h2.4a3.2 3.2 0 0 1 0 6.4h-2.4" fill="none" stroke="${P.clay}" stroke-width="2.4"/>
      <rect x="2.6" y="8.6" width="13.2" height="2.6" fill="currentColor" opacity="0.28"/>
      <path d="M1.4 21.6h17" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" opacity="0.5"/>`,
  },
  clock: {
    subject: 'a mantel clock at ten past ten',
    draw: () => `
      <circle cx="12" cy="12.6" r="8.4" fill="${P.gold}"/>
      <circle cx="12" cy="12.6" r="6.4" ${soft(0.16)}/>
      <g stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
        <path d="M12 12.6V7.8"/><path d="M12 12.6l3.6 2.4"/>
      </g>
      <circle cx="12" cy="12.6" r="1" fill="currentColor"/>
      <g stroke="${P.gold}" stroke-width="1.9" stroke-linecap="round">
        <path d="M6.4 4.2 8 5.8"/><path d="M17.6 4.2 16 5.8"/>
      </g>`,
  },
  modem: {
    subject: 'a modem with its lights on, and a cable',
    draw: () => `
      <rect x="2.6" y="10.4" width="18.8" height="7.4" rx="1.8" fill="${P.slate}"/>
      <g fill="${P.green}">
        <circle cx="6.4" cy="14.1" r="1.15"/><circle cx="10" cy="14.1" r="1.15"/>
      </g>
      <circle cx="13.6" cy="14.1" r="1.15" fill="${P.gold}"/>
      <rect x="16.2" y="12.9" width="3.4" height="2.4" rx="0.6" ${soft(0.3)}/>
      <path d="M18.4 10.4V6.6a2 2 0 0 0-2-2H9.2" fill="none" stroke="currentColor"
            stroke-width="2.2" stroke-linecap="round" opacity="0.75"/>
      <path d="M11 2.8 8.4 4.6 11 6.4" fill="none" stroke="currentColor" stroke-width="2.2"
            stroke-linecap="round" stroke-linejoin="round" opacity="0.75"/>`,
  },

  /* ---- outside, loud ---------------------------------------------------- */
  traffic: {
    subject: 'a road running to the horizon',
    draw: () => `
      <path d="M9.6 6.4h4.8l4.4 15H5.2Z" fill="${P.slate}"/>
      <g stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
        <path d="M12 8.4v1.8"/><path d="M12 12.6v2.2"/><path d="M12 17.4v2.4"/>
      </g>
      <path d="M2.6 6.4h18.8" stroke="currentColor" stroke-width="1.7"
            stroke-linecap="round" opacity="0.5"/>
      <path d="M14.6 4.6h3.6l1.6 1.8h-6.8Z" fill="${P.brick}"/>`,
  },
  mower: {
    subject: 'a lawnmower, with the grass it has not reached yet',
    draw: () => `
      <path d="M3.4 17.2v-3.6h7.2l1.8-3.2h4.4v6.8Z" fill="${P.green}"/>
      <path d="M16.8 10.4h3.4v6.8h-3.4Z" fill="${P.olive}"/>
      <path d="M10.6 13.6 14.4 5a1.7 1.7 0 0 1 1.6-1h3.6" fill="none" stroke="currentColor"
            stroke-width="2.2" stroke-linecap="round" opacity="0.8"/>
      <circle cx="6.6" cy="18.6" r="2.6" fill="currentColor" opacity="0.75"/>
      <circle cx="17.6" cy="18.8" r="2.2" fill="currentColor" opacity="0.75"/>
      <g stroke="${P.olive}" stroke-width="1.6" stroke-linecap="round">
        <path d="M2.2 21.4v-2.6"/><path d="M4.6 21.4v-3.4"/>
      </g>`,
  },
}

/* ---- rendering ----------------------------------------------------------- */

/**
 * One icon as a complete inline `<svg>`, filling whatever box it is put in.
 *
 * It carries its own sizing inline rather than relying on a stylesheet rule,
 * because every page inserts these with `set:html` and Astro's scoped styles
 * do not reach nodes that arrive that way. A `.glyph svg { ... }` rule in the
 * page would silently do nothing. Give the parent a width and a height; this
 * fills it.
 */
export function iconSvg(key: IconKey): string {
  const ic = ICONS[key]
  if (!ic) return ''
  return (
    `<svg viewBox="0 0 24 24" style="width:100%;height:100%;display:block" ` +
    `aria-hidden="true" focusable="false">${ic.draw()}</svg>`
  )
}

export const iconKeys = () => Object.keys(ICONS)
