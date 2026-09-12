/**
 * The site's deploy base path.
 *
 * Empty at a domain root; `/fungames` on GitHub Pages, where this repo is
 * served from `https://<user>.github.io/fungames/` rather than the domain
 * root. Astro injects the real value from `base` in `astro.config.mjs` at
 * build time, so every hand-written root-relative link in the codebase runs
 * through `withBase` instead of being typed as a literal `/slug/` — the one
 * thing that would otherwise silently 404 the moment this deploys anywhere
 * but a root domain.
 *
 * `Astro.url` already includes the base for the page actually being
 * rendered, so this is only needed for a path built as a literal string:
 * the homepage link in the chrome bar, a tile's own href, a cross-game
 * "related" link, an OG image path.
 */
export const BASE = import.meta.env.BASE_URL.replace(/\/$/, '')

/** Prefix a root-relative path ('/foo') with the deploy base. */
export const withBase = (path: string) => `${BASE}${path}`
