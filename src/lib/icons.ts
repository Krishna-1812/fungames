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
  gold: '#a67f1f',
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
  coffee: {
    subject: 'a mug of coffee with steam off it',
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
  /* ---- things you can buy ------------------------------------------------ */
  burger: {
    subject: 'a burger, in section',
    draw: () => `
      <path d="M3.4 9.6a8.6 6 0 0 1 17.2 0Z" fill="${P.clay}"/>
      <rect x="2.8" y="9.6" width="18.4" height="2.6" fill="${P.green}"/>
      <rect x="2.8" y="12.2" width="18.4" height="3.2" fill="${P.rust}"/>
      <path d="M2.8 15.4h18.4v1.8a3.2 3.2 0 0 1-3.2 3.2H6a3.2 3.2 0 0 1-3.2-3.2Z" fill="${P.clay}"/>
      <g fill="currentColor" opacity="0.4">
        <circle cx="8" cy="7" r="0.9"/><circle cx="12.4" cy="5.8" r="0.9"/><circle cx="16.4" cy="7.2" r="0.9"/>
      </g>`,
  },
  ticket: {
    subject: 'a torn ticket stub',
    draw: () => `
      <g transform="rotate(-18 12 12)">
        <path d="M1.4 7.4h21.2v2.8a2 2 0 0 0 0 3.8v2.8H1.4v-2.8a2 2 0 0 0 0-3.8Z" fill="${P.plum}"/>
        <path d="M14.6 7.4v9.4" stroke="currentColor" stroke-width="2.2" stroke-dasharray="2 2.2" opacity="0.55"/>
        <path d="M4.6 10.8h6M4.6 13.6h4" stroke="currentColor" stroke-width="2.2"
              stroke-linecap="round" opacity="0.7"/>
      </g>`,
  },
  film: {
    subject: 'a strip of film',
    draw: () => `
      <g transform="rotate(-34 12 12)">
        <rect x="-2" y="7" width="28" height="10" fill="${P.slate}"/>
        <g fill="currentColor" opacity="0.85">
          <rect x="1.2" y="9.8" width="5.2" height="4.4" rx="0.6"/>
          <rect x="9.4" y="9.8" width="5.2" height="4.4" rx="0.6"/>
          <rect x="17.6" y="9.8" width="5.2" height="4.4" rx="0.6"/>
        </g>
        <g fill="currentColor" opacity="0.45">
          <rect x="0" y="7.8" width="1.6" height="1.5"/><rect x="4" y="7.8" width="1.6" height="1.5"/>
          <rect x="8" y="7.8" width="1.6" height="1.5"/><rect x="12" y="7.8" width="1.6" height="1.5"/>
          <rect x="16" y="7.8" width="1.6" height="1.5"/><rect x="20" y="7.8" width="1.6" height="1.5"/>
          <rect x="0" y="14.7" width="1.6" height="1.5"/><rect x="4" y="14.7" width="1.6" height="1.5"/>
          <rect x="8" y="14.7" width="1.6" height="1.5"/><rect x="12" y="14.7" width="1.6" height="1.5"/>
          <rect x="16" y="14.7" width="1.6" height="1.5"/><rect x="20" y="14.7" width="1.6" height="1.5"/>
        </g>
      </g>`,
  },
  book: {
    subject: 'a hardback, standing',
    draw: () => `
      <path d="M4 3.6h13.2a2.8 2.8 0 0 1 2.8 2.8v14.2H6.8A2.8 2.8 0 0 1 4 17.8Z" fill="${P.indigo}"/>
      <path d="M4 17.8a2.8 2.8 0 0 1 2.8-2.8H20v5.6H6.8A2.8 2.8 0 0 1 4 17.8Z" fill="currentColor" opacity="0.22"/>
      <path d="M8 7.4h8M8 10.4h5.6" stroke="currentColor" stroke-width="2.2"
            stroke-linecap="round" opacity="0.75"/>`,
  },
  gamepad: {
    subject: 'a controller, two grips and a d-pad',
    draw: () => `
      <path d="M5 6.4h14a4.8 4.8 0 0 1 4.7 5.7l-1 5.2a3.1 3.1 0 0 1-5.6 1.1L15.2 16H8.8l-1.9 2.4a3.1 3.1 0 0 1-5.6-1.1l-1-5.2A4.8 4.8 0 0 1 5 6.4Z" fill="${P.indigo}"/>
      <g stroke="currentColor" stroke-width="2.4" stroke-linecap="round" opacity="0.9">
        <path d="M4.6 11h3.6"/><path d="M6.4 9.2v3.6"/>
      </g>
      <g fill="currentColor" opacity="0.9">
        <circle cx="16.2" cy="9.4" r="1.35"/><circle cx="19.2" cy="12.2" r="1.35"/>
      </g>`,
  },
  drone: {
    subject: 'a quadcopter, from above',
    draw: () => `
      <g stroke="${P.slate}" stroke-width="2.4" stroke-linecap="round">
        <path d="M7.4 7.4 5 5"/><path d="M16.6 7.4 19 5"/>
        <path d="M7.4 16.6 5 19"/><path d="M16.6 16.6 19 19"/>
      </g>
      <g fill="currentColor" opacity="0.55">
        <ellipse cx="4.4" cy="4.4" rx="3.2" ry="1.1"/><ellipse cx="19.6" cy="4.4" rx="3.2" ry="1.1"/>
        <ellipse cx="4.4" cy="19.6" rx="3.2" ry="1.1"/><ellipse cx="19.6" cy="19.6" rx="3.2" ry="1.1"/>
      </g>
      <rect x="8" y="8" width="8" height="8" rx="2.4" fill="${P.slate}"/>
      <circle cx="12" cy="12" r="2.2" fill="${P.blue}"/>`,
  },
  phone: {
    subject: 'a phone',
    draw: () => `
      <rect x="6.6" y="1.8" width="10.8" height="20.4" rx="2.6" fill="${P.slate}"/>
      <rect x="8.2" y="4.6" width="7.6" height="13.6" rx="0.8" fill="currentColor" opacity="0.28"/>
      <rect x="10.4" y="19.4" width="3.2" height="1.4" rx="0.7" fill="currentColor" opacity="0.6"/>
      <rect x="10.8" y="3" width="2.4" height="0.9" rx="0.45" fill="currentColor" opacity="0.6"/>`,
  },
  laptop: {
    subject: 'an open laptop',
    draw: () => `
      <path d="M5 4.6h14v11H5Z" fill="${P.slate}"/>
      <rect x="6.6" y="6.2" width="10.8" height="7.8" fill="currentColor" opacity="0.28"/>
      <path d="M2.2 16.2h19.6l-1.2 2.4a1.8 1.8 0 0 1-1.6 1H5a1.8 1.8 0 0 1-1.6-1Z" fill="${P.ash}"/>`,
  },
  piano: {
    subject: 'a keyboard, four white keys and three black',
    draw: () => `
      <path d="M1.8 4.4h20.4a1.4 1.4 0 0 1 1.4 1.4v2.2H0.4V5.8a1.4 1.4 0 0 1 1.4-1.4Z" fill="${P.slate}"/>
      <rect x="1.8" y="8" width="20.4" height="11.6" rx="1.2" fill="${P.ash}"/>
      <g stroke="currentColor" stroke-width="2.2" opacity="0.4">
        <path d="M6.9 13.6v6"/><path d="M11.9 13.6v6"/><path d="M16.9 13.6v6"/>
      </g>
      <g fill="currentColor" opacity="0.9">
        <rect x="5.4" y="8" width="3" height="5.8" rx="0.6"/>
        <rect x="10.4" y="8" width="3" height="5.8" rx="0.6"/>
        <rect x="15.4" y="8" width="3" height="5.8" rx="0.6"/>
      </g>`,
  },
  motorcycle: {
    subject: 'a motorcycle',
    draw: () => `
      <g stroke="currentColor" stroke-width="2.4" fill="none">
        <circle cx="5.4" cy="16.6" r="4"/><circle cx="18.6" cy="16.6" r="4"/>
      </g>
      <path d="M5.4 16.6 9.6 9.6h4.8l4.2 7" fill="none" stroke="${P.brick}"
            stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>
      <path d="M8.4 9.6h6.8" stroke="${P.brick}" stroke-width="2.6" stroke-linecap="round"/>
      <path d="M14.8 9.2 18 6.2h2.6" fill="none" stroke="currentColor" stroke-width="2.2"
            stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  ring: {
    subject: 'a solitaire',
    draw: () => `
      <circle cx="12" cy="16" r="5.6" fill="none" stroke="${P.gold}" stroke-width="2.6"/>
      <path d="M8.6 6.2h6.8l2.6 3.4L12 14 6 9.6Z" fill="${P.blue}"/>
      <path d="M8.6 6.2 12 14l3.4-7.8" fill="none" stroke="currentColor" stroke-width="2.2" opacity="0.4"/>`,
  },
  car: {
    subject: 'a small electric hatchback, plugged in',
    draw: () => `
      <path d="M2.4 17.4v-3.2l2-.4 2.4-4.4a2.4 2.4 0 0 1 2.1-1.2h4.7a2.4 2.4 0 0 1 1.9.9l3.1 4.1 1.4.6v3.6Z" fill="${P.green}"/>
      <path d="M9.4 10.2h1.9v3.2H7.6Zm3.5 0h1.3l2.4 3.2h-3.7Z" fill="currentColor" opacity="0.4"/>
      <g fill="currentColor">
        <circle cx="7" cy="17.8" r="2.6"/><circle cx="16.4" cy="17.8" r="2.6"/>
      </g>
      <g fill="${P.ash}">
        <circle cx="7" cy="17.8" r="1"/><circle cx="16.4" cy="17.8" r="1"/>
      </g>
      <path d="M21.4 13v-3.4" stroke="${P.gold}" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M19.8 8.4V6M23 8.4V6" stroke="${P.gold}" stroke-width="2.2" stroke-linecap="round"/>`,
  },
  'sports-car': {
    subject: 'a low wedge, side on',
    draw: () => `
      <path d="M1.6 16.4 4 13.2l5.4-2.8h4.8l4.4 2.8 3.8 1.2v2.6a1.6 1.6 0 0 1-1.6 1.6H3.2a1.6 1.6 0 0 1-1.6-1.6Z" fill="${P.brick}"/>
      <path d="M8 11.6h5.6l3 2.2H5.4Z" fill="currentColor" opacity="0.3"/>
      <g fill="currentColor">
        <circle cx="7" cy="18.4" r="2.6"/><circle cx="17.4" cy="18.4" r="2.6"/>
      </g>
      <path d="M2.4 8.6h5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" opacity="0.4"/>`,
  },
  f1: {
    subject: 'an open-wheeler, wing at each end',
    draw: () => `
      <path d="M1.4 14.4h3.4l3.6-1.4h3.4l1.4-3h2.6l.6 3h4.2v3.6H1.4Z" fill="${P.rust}"/>
      <circle cx="12.4" cy="11.8" r="1.7" fill="currentColor" opacity="0.45"/>
      <path d="M0.8 11.4h4.4v2.2H0.8Z" fill="${P.rust}"/>
      <path d="M17.8 5.6h5.4v2.6h-5.4Z" fill="${P.rust}"/>
      <path d="M20.5 8.2v6.4" stroke="${P.rust}" stroke-width="2.4"/>
      <g fill="currentColor">
        <circle cx="6.6" cy="17.6" r="3.2"/><circle cx="17.4" cy="17.6" r="3.2"/>
      </g>
      <g fill="${P.ash}">
        <circle cx="6.6" cy="17.6" r="1.2"/><circle cx="17.4" cy="17.6" r="1.2"/>
      </g>`,
  },
  horse: {
    subject: 'a horse in profile, ears up',
    draw: () => `
      <path d="M20.8 10.2 16.4 13.8 12.8 14.8 10.2 21.6H5.6L8.2 11.4C9.1 7.7 11.7 5.4 15.2 5.4c3.2 0 5.6 2 5.6 4.8Z" fill="${P.clay}"/>
      <path d="M13.4 5.6 12 1.8l3.4 2.6Z" fill="${P.clay}"/>
      <path d="M17 5.8 20.4 2.8l-.8 3.6Z" fill="${P.clay}"/>
      <path d="M8.6 10.4c2.2-1 3.6-2.6 4-4.6-2.6.8-4 2.2-4 4.6Z" fill="currentColor" opacity="0.32"/>
      <circle cx="16.6" cy="9" r="1.05" fill="currentColor"/>
      <path d="M18.6 12.6c-1.8.8-3.2.9-4.4.3" fill="none" stroke="currentColor"
            stroke-width="2.2" stroke-linecap="round" opacity="0.5"/>`,
  },
  house: {
    subject: 'a house with a chimney',
    draw: () => `
      <path d="M12 2.6 22.4 11h-3v10.4H4.6V11h-3Z" fill="${P.brick}"/>
      <rect x="16.4" y="4.4" width="2.8" height="4" fill="${P.brick}"/>
      <rect x="10.2" y="14.4" width="3.6" height="7" fill="currentColor" opacity="0.45"/>
      <rect x="5.8" y="12.4" width="3" height="3" fill="currentColor" opacity="0.3"/>
      <rect x="15.2" y="12.4" width="3" height="3" fill="currentColor" opacity="0.3"/>`,
  },
  villa: {
    subject: 'a beach house under a palm',
    draw: () => `
      <path d="M2.4 21.4h19.2" stroke="${P.gold}" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M4 19.6v-7.2h10.4v7.2Z" fill="${P.teal}"/>
      <path d="M2.6 12.8 9.2 8l6.6 4.8Z" fill="currentColor" opacity="0.5"/>
      <rect x="7.4" y="14.6" width="3.4" height="5" fill="currentColor" opacity="0.4"/>
      <path d="M18.6 19.6c0-4 .6-6.8 1.4-8.6" fill="none" stroke="${P.clay}"
            stroke-width="2.4" stroke-linecap="round"/>
      <g fill="${P.green}">
        <path d="M20 10.4c2.4-1.6 3.8-.8 4 .8-1.6-.6-3-.2-4-.8Z"/>
        <path d="M20 10.4c-2.4-1.6-3.8-.8-4 .8 1.6-.6 3-.2 4-.8Z"/>
        <path d="M20 10.2c-.6-2.6.4-3.6 2-3.6-1 1.2-1.2 2.6-2 3.6Z"/>
      </g>`,
  },
  yacht: {
    subject: 'a motor yacht with a flybridge',
    draw: () => `
      <g transform="rotate(-9 12 15)">
        <path d="M1 15.2h22l-2.6 3.6a2 2 0 0 1-1.6.8H4.4a2 2 0 0 1-1.7-1Z" fill="${P.teal}"/>
        <path d="M4.6 13.2 7.4 10h8.2l3.2 3.2Z" fill="currentColor" opacity="0.75"/>
        <path d="M4.6 13.2h14.2v2H4.6Z" fill="currentColor" opacity="0.45"/>
        <path d="M15 9.8V6.4h4" fill="none" stroke="currentColor" stroke-width="2.2"
              stroke-linecap="round" opacity="0.5"/>
      </g>
      <path d="M1 21.6c2-1.4 3.6-1.4 5.2 0s3.2 1.4 4.8 0" fill="none" stroke="${P.blue}"
            stroke-width="2.2" stroke-linecap="round"/>`,
  },
  jet: {
    subject: 'a small jet, side on',
    draw: () => `
      <path d="M1.6 13.6c0-1.8 2-3 5.4-3.2l8-.6c3.6-.3 6.4.3 7.6 1.6-1.2 1.4-4 2.1-7.6 1.9l-8-.4C3.6 12.7 1.6 13.6 1.6 13.6Z" fill="currentColor" opacity="0.9"/>
      <path d="M9.4 12.2 6.6 6.4h2.2l4.6 5.4Z" fill="${P.blue}"/>
      <path d="M9.6 13 7.4 17.6h2l3.8-4.2Z" fill="${P.blue}"/>
      <path d="M17.6 11.4 16.4 7.4h1.6l2.4 3.6Z" fill="${P.blue}"/>
      <circle cx="4.4" cy="12.4" r="0.9" fill="${P.blue}"/>`,
  },
  painting: {
    subject: 'a framed canvas',
    draw: () => `
      <rect x="2.6" y="3.6" width="18.8" height="16.8" rx="1.2" fill="${P.gold}"/>
      <rect x="5" y="6" width="14" height="12" fill="${P.indigo}"/>
      <path d="M5 14.6c2.4-3.2 4-3.2 6 0s3.4 2 8-1.6V18H5Z" fill="${P.green}"/>
      <circle cx="16.4" cy="9" r="2" fill="${P.gold}"/>`,
  },
  skyscraper: {
    subject: 'a tower with a smaller one behind it',
    draw: () => `
      <path d="M13.6 8h6.8v13.4h-6.8Z" fill="${P.ash}"/>
      <path d="M3.6 4.4h9.4v17H3.6Z" fill="${P.slate}"/>
      <path d="M8.3 1.2v3.2" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
      <g fill="currentColor" opacity="0.42">
        <rect x="5.6" y="7" width="2.2" height="2.4"/><rect x="8.8" y="7" width="2.2" height="2.4"/>
        <rect x="5.6" y="11.4" width="2.2" height="2.4"/><rect x="8.8" y="11.4" width="2.2" height="2.4"/>
        <rect x="5.6" y="15.8" width="2.2" height="2.4"/><rect x="8.8" y="15.8" width="2.2" height="2.4"/>
        <rect x="15.6" y="10.6" width="2.2" height="2.4"/><rect x="15.6" y="15" width="2.2" height="2.4"/>
      </g>`,
  },
  airliner: {
    subject: 'an airliner, from above',
    draw: () => `
      <path d="M12 1.4c1.5 0 2.4 1.6 2.6 4.2l.2 3.2 7.6 4.4v2.4l-7.6-2.2.2 3.6 2.6 1.8v1.8L12 19.4l-5.6 1.2v-1.8l2.6-1.8.2-3.6-7.6 2.2v-2.4l7.6-4.4.2-3.2C9.6 3 10.5 1.4 12 1.4Z" fill="${P.blue}"/>
      <circle cx="12" cy="7" r="1.4" fill="currentColor" opacity="0.55"/>`,
  },
  cruise: {
    subject: 'a liner with a funnel and rows of cabins',
    draw: () => `
      <path d="M1.6 16.8h20.8l-2.2 4a1.8 1.8 0 0 1-1.6 1H5.4a1.8 1.8 0 0 1-1.6-1Z" fill="${P.slate}"/>
      <rect x="3.4" y="12" width="17.2" height="4.8" fill="currentColor" opacity="0.8"/>
      <rect x="5.6" y="7.6" width="12.8" height="4.4" fill="currentColor" opacity="0.55"/>
      <rect x="14.4" y="3.4" width="3.4" height="4.2" rx="0.8" fill="${P.brick}"/>
      <g fill="${P.blue}">
        <rect x="5.2" y="13.6" width="1.8" height="1.8"/><rect x="8.4" y="13.6" width="1.8" height="1.8"/>
        <rect x="11.6" y="13.6" width="1.8" height="1.8"/><rect x="14.8" y="13.6" width="1.8" height="1.8"/>
        <rect x="18" y="13.6" width="1.8" height="1.8"/>
      </g>`,
  },
  football: {
    subject: 'a football, panels and all',
    draw: () => `
      <circle cx="12" cy="12" r="9.6" fill="currentColor" opacity="0.13"/>
      <circle cx="12" cy="12" r="9.6" fill="none" stroke="currentColor" stroke-width="2.4"/>
      <path d="M12 7 16.1 10 14.5 14.8h-5L7.9 10Z" fill="currentColor"/>
      <path d="M12 1.4 15.6 3.4 16.3 7.4 12 5.2 7.7 7.4 8.4 3.4Z" fill="currentColor"/>
      <path d="M1.6 13.6 2 9.4 5.9 9.2 4.6 13.8 7.6 17.8 3.6 17.2Z" fill="currentColor"/>
      <path d="M22.4 13.6 22 9.4 18.1 9.2 19.4 13.8 16.4 17.8 20.4 17.2Z" fill="currentColor"/>`,
  },
  rocket: {
    subject: 'a rocket on the way up',
    draw: () => `
      <path d="M12 1.4c3 2.6 4.6 6.4 4.6 10.6v3.4H7.4V12c0-4.2 1.6-8 4.6-10.6Z" fill="currentColor" opacity="0.92"/>
      <circle cx="12" cy="8.4" r="2.2" fill="${P.blue}"/>
      <path d="M7.4 12.4 4 17.4v-2.6a6 6 0 0 1 3.4-5.4Z" fill="${P.brick}"/>
      <path d="M16.6 12.4 20 17.4v-2.6a6 6 0 0 0-3.4-5.4Z" fill="${P.brick}"/>
      <path d="M9.6 15.4h4.8L12 22.6Z" fill="${P.rust}"/>`,
  },
  submarine: {
    subject: 'a submarine under the surface',
    draw: () => `
      <path d="M2.4 3.2c2-1.6 3.6-1.6 5.2 0s3.2 1.6 4.8 0 3.2-1.6 4.8 0 2.4 1.6 4.2.2"
            fill="none" stroke="${P.blue}" stroke-width="2.4" stroke-linecap="round"/>
      <rect x="2.6" y="12" width="17" height="7.4" rx="3.7" fill="${P.slate}"/>
      <path d="M9.4 8.6h4.4v3.6H9.4Z" fill="${P.slate}"/>
      <path d="M11 5.4v3.4" stroke="${P.slate}" stroke-width="2.2" stroke-linecap="round"/>
      <g fill="currentColor" opacity="0.55">
        <circle cx="6.6" cy="15.7" r="1.2"/><circle cx="10.6" cy="15.7" r="1.2"/><circle cx="14.6" cy="15.7" r="1.2"/>
      </g>
      <path d="M19.6 14.2 22.6 12v7.4l-3-2.2Z" fill="${P.slate}"/>`,
  },
  carrier: {
    subject: 'a flat-top with an island and an aircraft on deck',
    draw: () => `
      <path d="M1.4 14.6h21.2l-2 5.2a1.8 1.8 0 0 1-1.7 1.2H5.1a1.8 1.8 0 0 1-1.7-1.2Z" fill="${P.ash}"/>
      <rect x="1.4" y="11.8" width="21.2" height="2.8" fill="currentColor" opacity="0.85"/>
      <path d="M2.6 13.2h16" stroke="${P.gold}" stroke-width="2.2" stroke-dasharray="2.4 2.4"/>
      <rect x="16.4" y="6.8" width="3.4" height="5" fill="${P.slate}"/>
      <path d="M18.1 3.6v3.2" stroke="${P.slate}" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M7.4 7.4 9.6 11h-4.4Z" fill="${P.brick}"/>`,
  },
  mars: {
    subject: 'a red planet with a lander on its way',
    draw: () => `
      <circle cx="13.6" cy="13.6" r="8.2" fill="${P.brick}"/>
      <g fill="currentColor" opacity="0.28">
        <ellipse cx="10.6" cy="10.6" rx="2.8" ry="1.8"/>
        <ellipse cx="16.6" cy="16" rx="3.2" ry="2"/>
        <circle cx="17" cy="9.6" r="1.4"/>
      </g>
      <path d="M1.6 8.4 8 4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" opacity="0.55"/>
      <rect x="6.4" y="2.2" width="3.6" height="3.6" rx="0.8" fill="${P.slate}"
            transform="rotate(-34 8.2 4)"/>`,
  },
  network: {
    subject: 'a network of people, all connected',
    draw: () => `
      <g stroke="currentColor" stroke-width="2.2" opacity="0.5">
        <path d="M12 5.4 5 12.6M12 5.4 19 12.6M5 12.6 12 19.6M19 12.6 12 19.6M12 5.4v14.2"/>
      </g>
      <circle cx="12" cy="4.6" r="3.2" fill="${P.plum}"/>
      <circle cx="4.6" cy="12.6" r="3" fill="${P.blue}"/>
      <circle cx="19.4" cy="12.6" r="3" fill="${P.teal}"/>
      <circle cx="12" cy="20" r="3" fill="${P.green}"/>`,
  },
  /* ---- how far a folded sheet gets ---------------------------------------- */
  sheet: {
    subject: 'a sheet of paper with one corner turned',
    draw: () => `
      <path d="M4.6 2.6h9.8l5 5v13.8a1 1 0 0 1-1 1H4.6a1 1 0 0 1-1-1V3.6a1 1 0 0 1 1-1Z" fill="currentColor" opacity="0.2"/>
      <path d="M4.6 2.6h9.8l5 5v13.8a1 1 0 0 1-1 1H4.6a1 1 0 0 1-1-1V3.6a1 1 0 0 1 1-1Z"
            fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/>
      <path d="M14.4 2.6v5h5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/>
      <g stroke="currentColor" stroke-width="2.2" stroke-linecap="round" opacity="0.5">
        <path d="M7.4 12.4h8"/><path d="M7.4 16.4h5.4"/>
      </g>`,
  },
  'credit-card': {
    subject: 'a bank card, stripe and chip',
    draw: () => `
      <g transform="rotate(-11 12 12)">
        <rect x="3" y="6.2" width="18" height="11.6" rx="2.4" fill="${P.slate}"/>
        <rect x="3" y="8.6" width="18" height="2.8" fill="currentColor" opacity="0.75"/>
        <rect x="5.4" y="13.6" width="5.4" height="2.2" rx="1.1" fill="currentColor" opacity="0.45"/>
        <rect x="15.2" y="13" width="3.4" height="2.8" rx="0.7" fill="${P.gold}"/>
      </g>`,
  },
  lego: {
    subject: 'a plastic brick with four studs',
    draw: () => `
      <g fill="${P.brick}">
        <rect x="3.4" y="4.6" width="3.6" height="3" rx="1.2"/>
        <rect x="8.4" y="4.6" width="3.6" height="3" rx="1.2"/>
        <rect x="13.4" y="4.6" width="3.6" height="3" rx="1.2"/>
        <rect x="18" y="4.6" width="2.6" height="3" rx="1.2"/>
      </g>
      <rect x="2.4" y="7.2" width="19.2" height="7.4" rx="1.2" fill="${P.brick}"/>
      <rect x="2.4" y="14.6" width="19.2" height="4.4" rx="1.2" fill="currentColor" opacity="0.28"/>`,
  },
  toddler: {
    subject: 'a small child, arms out',
    draw: () => `
      <circle cx="12" cy="6" r="4.4" fill="${P.clay}"/>
      <path d="M8.6 12h6.8a2 2 0 0 1 2 2.2l-.6 4.4h-9.6l-.6-4.4a2 2 0 0 1 2-2.2Z" fill="${P.plum}"/>
      <g stroke="${P.clay}" stroke-width="2.6" stroke-linecap="round">
        <path d="M7.4 13.4 3.6 11"/><path d="M16.6 13.4 20.4 11"/>
        <path d="M9.4 18.6v3.2"/><path d="M14.6 18.6v3.2"/>
      </g>`,
  },
  statue: {
    subject: 'a green statue holding up a torch',
    draw: () => `
      <path d="M17.8 2.4 19 6.4h-2.4Z" fill="${P.gold}"/>
      <path d="M17.8 6.6v3.4" stroke="${P.green}" stroke-width="2.4" stroke-linecap="round"/>
      <circle cx="10.6" cy="6.6" r="2.6" fill="${P.green}"/>
      <g stroke="${P.green}" stroke-width="2.2" stroke-linecap="round">
        <path d="M8.6 4.4 7.4 2.6"/><path d="M10.6 3.8V1.8"/><path d="M12.6 4.4 13.8 2.6"/>
      </g>
      <path d="M8.4 10.2h4.4l2.4 8.4H6.6Z" fill="${P.green}"/>
      <path d="M12.6 10.4 17 9.2" stroke="${P.green}" stroke-width="2.4" stroke-linecap="round"/>
      <rect x="4.6" y="18.6" width="12.4" height="3.2" rx="0.8" fill="currentColor" opacity="0.42"/>`,
  },
  skyline: {
    subject: 'a tapering tower with a spire',
    draw: () => `
      <path d="M12 5.4l2.6 4.6 1.4 11.4H8L9.4 10Z" fill="${P.gold}"/>
      <path d="M12 5.4V1.4" stroke="${P.gold}" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M4.6 21.4h14.8" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" opacity="0.5"/>
      <g stroke="currentColor" stroke-width="2.2" opacity="0.35">
        <path d="M9.8 12h4.4"/><path d="M9.4 15.4h5.2"/><path d="M9 18.8h6"/>
      </g>`,
  },
  satellite: {
    subject: 'a satellite with its panels out',
    draw: () => `
      <rect x="9.4" y="8.6" width="5.2" height="6.8" rx="1" fill="${P.slate}"/>
      <rect x="0.8" y="9" width="7.4" height="6" rx="0.8" fill="${P.blue}"/>
      <rect x="15.8" y="9" width="7.4" height="6" rx="0.8" fill="${P.blue}"/>
      <path d="M12 8.4V5" stroke="${P.slate}" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M8.6 4.6a5 5 0 0 1 6.8 0" fill="none" stroke="currentColor"
            stroke-width="2.2" stroke-linecap="round" opacity="0.7"/>
      <path d="M12 15.6v3.6" stroke="${P.slate}" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M9 21.4h6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" opacity="0.55"/>`,
  },
  map: {
    subject: 'a folded map with a route across it',
    draw: () => `
      <path d="M1.4 6.4 8 3.2v13.6l-6.6 3.2Z" fill="${P.olive}"/>
      <path d="M8 3.2 15.4 6.4v14l-7.4-3.6Z" fill="${P.green}"/>
      <path d="M15.4 6.4 22.6 2.6v13.8l-7.2 4Z" fill="${P.olive}"/>
      <path d="M4.4 16.4c2.4-3.8 3.6-5.6 6.6-6.2s4.6-2.4 7.6-5.6" fill="none"
            stroke="currentColor" stroke-width="2.2" stroke-linecap="round"
            stroke-dasharray="2.6 2.6" opacity="0.85"/>
      <circle cx="18.8" cy="4.4" r="1.6" fill="currentColor" opacity="0.85"/>`,
  },
  earth: {
    subject: 'the Earth',
    draw: () => `
      <circle cx="12" cy="12" r="9.6" fill="${P.blue}"/>
      <g fill="${P.green}">
        <path d="M5 7.6c2.6-.6 4.4.4 5.4 3 1 2.6.2 4.2-2.4 4.8-2 .4-3.6-.6-4.6-3-.4-2.6.2-4.2 1.6-4.8Z"/>
        <path d="M15 5.6c2 .4 3.4 1.6 4.2 3.6-1.6 1.4-3 1.6-4.2.6-1.2-1-1.2-2.4 0-4.2Z"/>
        <path d="M13.4 14c2.4-.8 4.2-.2 5.4 1.8-1.2 2.4-2.8 3.8-4.8 4.2-1.4-2-1.6-4-.6-6Z"/>
      </g>`,
  },
  moon: {
    subject: 'a crescent Moon with two craters on it',
    draw: () => `
      <path d="M15.2 1.8a10.4 10.4 0 1 0 4.6 18.6 8.6 8.6 0 0 1-4.6-18.6Z" fill="${P.ash}"/>
      <g fill="currentColor" opacity="0.28">
        <circle cx="9" cy="8.6" r="2.2"/><circle cx="7.4" cy="15.4" r="1.5"/>
      </g>`,
  },
  sun: {
    subject: 'the Sun',
    draw: () => `
      <g stroke="${P.gold}" stroke-width="2.6" stroke-linecap="round">
        <path d="M12 1.4v3"/><path d="M12 19.6v3"/><path d="M1.4 12h3"/><path d="M19.6 12h3"/>
        <path d="M4.5 4.5 6.6 6.6"/><path d="M17.4 17.4l2.1 2.1"/>
        <path d="M19.5 4.5 17.4 6.6"/><path d="M6.6 17.4 4.5 19.5"/>
      </g>
      <circle cx="12" cy="12" r="6.2" fill="${P.gold}"/>
      <circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.16"/>`,
  },
  'ringed-planet': {
    subject: 'a planet with a ring round it',
    draw: () => `
      <circle cx="12" cy="11" r="7" fill="${P.plum}"/>
      <g fill="currentColor" opacity="0.22">
        <ellipse cx="12" cy="8.4" rx="6.4" ry="1.3"/><ellipse cx="12" cy="13.4" rx="6.6" ry="1.5"/>
      </g>
      <ellipse cx="12" cy="13.4" rx="11" ry="3.6" transform="rotate(-18 12 13.4)"
               fill="none" stroke="${P.gold}" stroke-width="2.4"/>`,
  },
  star: {
    subject: 'a single bright star',
    draw: () => `
      <path d="M12 1.6 15.3 8.9 23.2 9.8 17.3 15.1 19 22.9 12 18.9 5 22.9 6.7 15.1.8 9.8 8.7 8.9Z" fill="${P.gold}"/>
      <circle cx="12" cy="12.4" r="2.6" fill="currentColor" opacity="0.18"/>`,
  },
  galaxy: {
    subject: 'a spiral galaxy, tilted',
    draw: () => `
      <g transform="rotate(-24 12 12)">
        <ellipse cx="12" cy="12" rx="11" ry="6" fill="${P.indigo}" opacity="0.45"/>
        <path d="M12 12c0-3.4 3-5 6.6-4.2-2.6-.4-4.6.8-5 2.6" fill="none" stroke="${P.indigo}" stroke-width="2.6" stroke-linecap="round"/>
        <path d="M12 12c0 3.4-3 5-6.6 4.2 2.6.4 4.6-.8 5-2.6" fill="none" stroke="${P.indigo}" stroke-width="2.6" stroke-linecap="round"/>
        <ellipse cx="12" cy="12" rx="3.4" ry="2.4" fill="${P.gold}"/>
      </g>`,
  },
  galaxies: {
    subject: 'a handful of galaxies, some way off',
    draw: () => `
      <ellipse cx="7" cy="7.4" rx="5.2" ry="2.6" transform="rotate(-28 7 7.4)" fill="${P.indigo}"/>
      <ellipse cx="17.4" cy="12" rx="4.2" ry="2.2" transform="rotate(22 17.4 12)" fill="${P.plum}"/>
      <ellipse cx="8.6" cy="17.6" rx="4.6" ry="2.4" transform="rotate(14 8.6 17.6)" fill="${P.blue}"/>
      <g fill="currentColor" opacity="0.45">
        <circle cx="18.6" cy="4.6" r="1.2"/><circle cx="3.2" cy="12.4" r="1.1"/>
        <circle cx="16.4" cy="20" r="1.2"/>
      </g>`,
  },
  universe: {
    subject: 'everything there is, with an edge round it',
    draw: () => `
      <circle cx="12" cy="12" r="10.2" fill="none" stroke="currentColor"
              stroke-width="2.4" stroke-dasharray="3.2 2.6" opacity="0.7"/>
      <g fill="${P.indigo}">
        <ellipse cx="8.8" cy="9" rx="3" ry="1.5" transform="rotate(-26 8.8 9)"/>
        <ellipse cx="15.4" cy="14.6" rx="2.6" ry="1.3" transform="rotate(18 15.4 14.6)"/>
      </g>
      <g fill="${P.gold}">
        <circle cx="15.4" cy="8.4" r="1.4"/><circle cx="8.4" cy="15.4" r="1.3"/>
      </g>
      <circle cx="12" cy="12" r="1.2" fill="currentColor" opacity="0.5"/>`,
  },
  /* ---- the rest of the site ----------------------------------------------- */
  die: {
    subject: 'a die showing five — the site mark',
    draw: () => `
      <rect x="3" y="3" width="18" height="18" rx="4.6" fill="${P.brick}"/>
      <g fill="currentColor" opacity="0.92">
        <circle cx="8.2" cy="8.2" r="1.9"/><circle cx="15.8" cy="8.2" r="1.9"/>
        <circle cx="12" cy="12" r="1.9"/>
        <circle cx="8.2" cy="15.8" r="1.9"/><circle cx="15.8" cy="15.8" r="1.9"/>
      </g>`,
  },
  compass: {
    subject: 'a field compass in a square case',
    draw: () => `
      <rect x="3.6" y="3.6" width="16.8" height="16.8" rx="3" fill="none" stroke="${P.slate}" stroke-width="2.6"/>
      <circle cx="12" cy="12" r="6.6" fill="${P.slate}"/>
      <circle cx="12" cy="12" r="6.6" fill="currentColor" opacity="0.18"/>
      <path d="M15.8 8.2 13.5 13.5 8.2 15.8 10.5 10.5Z" fill="${P.brick}"/>
      <path d="M13.5 13.5 8.2 15.8 10.5 10.5Z" fill="currentColor" opacity="0.55"/>
      <circle cx="12" cy="12" r="1.3" fill="currentColor"/>
      <g fill="${P.gold}">
        <path d="M12 3.4 13.1 5.8H10.9Z"/><path d="M12 20.6 10.9 18.2h2.2Z"/>
      </g>`,
  },
  trophy: {
    subject: 'a cup on a plinth',
    draw: () => `
      <path d="M6.6 2.6h10.8v6.2a5.4 5.4 0 0 1-10.8 0Z" fill="${P.gold}"/>
      <path d="M6.6 4.2H3.4v1.6a4 4 0 0 0 3.6 4" fill="none" stroke="${P.gold}" stroke-width="2.4"/>
      <path d="M17.4 4.2h3.2v1.6a4 4 0 0 1-3.6 4" fill="none" stroke="${P.gold}" stroke-width="2.4"/>
      <path d="M12 14.2v3.4" stroke="${P.gold}" stroke-width="2.6" stroke-linecap="round"/>
      <rect x="6.6" y="17.4" width="10.8" height="4" rx="1.2" fill="currentColor" opacity="0.55"/>`,
  },
  cat: {
    subject: 'a cat, going somewhere',
    draw: () => `
      <path d="M4.4 18.6v-4.4c0-3.2 2.4-5.4 6-5.4h5.2c2.6 0 4.4 1.6 4.4 4v5.8h-3.2v-3.4h-6.8v3.4Z" fill="${P.ash}"/>
      <path d="M15.6 9 17 3.8l3.4 3.6c1.6.4 2.6 1.8 2.6 3.6 0 2-1.4 3.4-3.6 3.4h-3.8Z" fill="${P.ash}"/>
      <path d="M18.2 5.4 17.4 2l2.8 2.4Z" fill="${P.ash}"/>
      <circle cx="20" cy="10.2" r="1" fill="currentColor"/>
      <path d="M4.4 15.6C2.6 15 1.6 13.4 1.6 11" fill="none" stroke="${P.ash}"
            stroke-width="2.6" stroke-linecap="round"/>`,
  },
  duck: {
    subject: 'a duck',
    draw: () => `
      <path d="M7.6 19.6c-3 0-5.2-2.2-5.2-5.2 0-3.4 2.8-5.6 6.8-5.6h5.2v-2a4 4 0 0 1 4-4v6.2c0 6-3.6 10.6-9 10.6Z" fill="${P.gold}"/>
      <path d="M18.4 4.2h4.2l-2 3.4-2.2-.6Z" fill="${P.rust}"/>
      <circle cx="18.8" cy="5.4" r="1" fill="currentColor"/>
      <path d="M6.4 19.6 5 22.4h6l-1.4-2.8Z" fill="${P.rust}"/>`,
  },
  snail: {
    subject: 'a snail, in no hurry',
    draw: () => `
      <path d="M2.4 19.4h6.2c-1.6-1.4-2.4-2.6-2.4-4.4 0-1.2.6-2 1.6-2 .8 0 1.4.6 1.4 1.6h2.6c0-2.6-1.8-4.4-4.2-4.4V7.6c0-.8-.6-1.4-1.4-1.4h-.8" fill="none" stroke="${P.clay}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="13.6" cy="13.8" r="6.6" fill="${P.clay}"/>
      <path d="M13.6 13.8a3 3 0 1 1 3-3 5 5 0 0 1-5 5 6.8 6.8 0 0 1 0-8" fill="none"
            stroke="currentColor" stroke-width="2.2" opacity="0.4"/>
      <path d="M5 19.4h16" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" opacity="0.4"/>`,
  },
  dino: {
    subject: 'a small dinosaur',
    draw: () => `
      <path d="M20.6 4.4c1.6 0 2.4 1.2 2.4 2.8 0 2.6-1.4 4.4-4 5.2v3.2c0 3-2 4.8-5.2 4.8H8.4c-3.4 0-5.8-2.2-5.8-5.4 0-2.4 1.4-4.2 3.8-4.8V6.6c0-1.4 1-2.2 2.4-2.2Z" fill="${P.green}"/>
      <circle cx="19" cy="7.6" r="1.05" fill="currentColor"/>
      <path d="M6.4 20.4v1.8M13 20.4v1.8" stroke="${P.green}" stroke-width="2.6" stroke-linecap="round"/>
      <path d="M2.6 13.4 0.8 15.4l2.4 1.6" fill="none" stroke="${P.green}" stroke-width="2.4"
            stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  scooter: {
    subject: 'a kick scooter',
    draw: () => `
      <g fill="none" stroke="currentColor" stroke-width="2.4">
        <circle cx="4.6" cy="17.6" r="3.4"/><circle cx="19.4" cy="17.6" r="3.4"/>
      </g>
      <path d="M4.6 17.6h11.2l1.6-12.4" fill="none" stroke="${P.teal}" stroke-width="2.8"
            stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M14 4.6h6" stroke="${P.teal}" stroke-width="2.8" stroke-linecap="round"/>
      <path d="M19.4 17.6 17.4 5.2" fill="none" stroke="${P.teal}" stroke-width="2.6" stroke-linecap="round"/>`,
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
