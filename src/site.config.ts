/**
 * Single place to rebrand the whole site.
 * Everything downstream — meta tags, share cards, analytics, ads, sitemap —
 * reads from here.
 *
 * `name`, `domain`, `url` and `email` below are placeholders, not a decided
 * brand — swap them for the real thing once a name and domain are picked
 * (see `astro.config.mjs`'s `site`, which must match `url` exactly).
 */
export const SITE = {
  name: 'Your Site Name',
  domain: 'yoursite.com',
  url: 'https://yoursite.com',
  tagline: 'games, toys and other weird stuff',
  description:
    'Games, visualisations, interactives and other weird stuff. Made to be played, not scrolled past.',
  author: 'You',
  email: 'hi@yoursite.com',
  social: {
    twitter: '',
    instagram: '',
    newsletter: '',
  },

  /** Privacy-friendly analytics, the same choice neal.fun makes. '' disables it. */
  plausibleDomain: '',

  /** Google AdSense publisher id, e.g. 'ca-pub-0000000000000000'. '' disables ads. */
  adsenseClient: '',

  /** Origin of the deployed Cloudflare Worker that backs /fusion/. */
  fusionApi: '/api/fusion/pair',

  /**
   * Buy Me a Coffee handle — the part of buymeacoffee.com/<handle> after the
   * slash, not a full URL. '' hides the button entirely, same as
   * adsenseClient above. The payment itself is never this site's problem:
   * Buy Me a Coffee is the merchant of record and runs its own hosted
   * checkout, so nothing here ever touches a card number.
   *
   * 'yourhandle' is a placeholder — swap it for a real account before this
   * goes live, the same way `name`/`domain`/`email` above are placeholders
   * until a real brand is picked.
   */
  buyMeACoffee: 'yourhandle',
} as const
