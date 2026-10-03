import { defineConfig } from 'astro/config'

/*
 * Where the site is served from, worked out from the host building it rather
 * than typed in, so adding a custom domain needs no commit.
 *
 * - On Vercel, VERCEL_PROJECT_PRODUCTION_URL is the project's production
 *   domain: the custom domain once one is attached, <project>.vercel.app
 *   until then. Vercel sets it on every build, previews included, so a
 *   preview's canonical links still point at the real site.
 * - SITE_URL overrides that anywhere (an origin, no path).
 * - BASE_PATH is only for a host that serves from a subpath, e.g. '/fungames'.
 *   GitHub Pages needed it (a repo called `fungames` publishes at
 *   <user>.github.io/fungames/); nothing sets it now that Pages is retired.
 */
const vercelDomain = process.env.VERCEL_PROJECT_PRODUCTION_URL
const site = (process.env.SITE_URL || (vercelDomain ? `https://${vercelDomain}` : 'http://localhost:4321')).replace(/\/+$/, '')
const base = process.env.BASE_PATH || '/'

export default defineConfig({
  // The origin only — Astro requires that, and appends `base` itself for
  // every URL it builds (Astro.url, the sitemap's `site` param, etc). The
  // *full* deployed URL, origin plus base, is src/site.config.ts's `url`,
  // for the handful of places that build a link as a literal string instead
  // (see src/lib/base.ts).
  site,
  base,
  // Trailing slashes match neal.fun's /game-name/ URL shape.
  trailingSlash: 'always',
  build: { format: 'directory' },
  output: 'static',
  vite: { plugins: [islandFilesInDev()] },
})

/**
 * The homepage island's baked files are served by one catch-all endpoint
 * (src/pages/island/[...file].ts). Built, they are plain files; but in
 * `astro dev`, trailingSlash 'always' turns away /island/<hash>/c/0/0_0.webp
 * for not ending in a slash, and the island never loads. This adds the slash
 * on the way in, in dev only.
 */
function islandFilesInDev() {
  return {
    name: 'island-files-in-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url && /\/island\/[0-9a-f]+\/[^?]+\.(?:webp|json)(?:\?|$)/.test(req.url)) req.url = req.url.replace(/\.(webp|json)(\?|$)/, (_, ext, q) => `.${ext}/${q}`)
        next()
      })
    },
  }
}
