/**
 * Single place to rebrand the whole site.
 * Everything downstream — meta tags, share cards, analytics, ads, sitemap —
 * reads from here.
 *
 * `name`, `domain` and `email` below are placeholders, not a decided brand —
 * swap them for the real thing once a name and domain are picked.
 *
 * `url` is the full deployed URL *including* any base path, built from
 * `astro.config.mjs`'s `site` and `base` — which work out the host at build
 * time (Vercel's production domain, plus BASE_PATH if a host ever needs one)
 * — so it is
 * never typed in and never goes stale when a custom domain is attached. The
 * optional chaining is for the checkers, which import this under plain Node
 * where there is no `import.meta.env`.
 */
const ORIGIN = (import.meta.env?.SITE ?? 'http://localhost:4321').replace(/\/+$/, '')
const BASE_PATH = (import.meta.env?.BASE_URL ?? '/').replace(/\/+$/, '')

export const SITE = {
  name: 'Your Site Name',
  domain: 'yoursite.com',
  url: ORIGIN + BASE_PATH,
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
   * The button sits in the homepage's footer.
   */
  buyMeACoffee: 'krishna18',

  /**
   * NASA's open API key, used by /days-since-incident/ to read NASA DONKI's
   * live solar-flare, geomagnetic-storm and interplanetary-shock logs
   * straight from the visitor's own browser — no backend of this site's own
   * sees or needs the key. `'DEMO_KEY'` works with no signup, and is the
   * honest default here, but it is shared globally across every app on the
   * internet that hasn't changed it and is capped at roughly 30 requests an
   * hour *in total, across all of them* — this page can start failing with
   * no relation to this site's own traffic. A real key is instant, free and
   * unlimited-in-practice (1,000/hour) at https://api.nasa.gov/, and dropping
   * it in here is the only thing that needs to change.
   */
  nasaApiKey: 'DEMO_KEY',
} as const
