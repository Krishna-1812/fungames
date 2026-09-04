/**
 * Single place to rebrand the whole site.
 * Everything downstream — meta tags, share cards, analytics, ads, sitemap —
 * reads from here.
 */
export const SITE = {
  name: 'Playbox',
  domain: 'example.com',
  url: 'https://example.com',
  tagline: 'games, toys and other weird stuff',
  description:
    'Games, visualisations, interactives and other weird stuff. Made to be played, not scrolled past.',
  author: 'You',
  email: 'hi@example.com',
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
} as const
