import { defineConfig } from 'astro/config'

export default defineConfig({
  // The origin only — Astro requires that, and appends `base` itself for
  // every URL it builds (Astro.url, the sitemap's `site` param, etc). The
  // *full* deployed URL, origin plus base, lives in src/site.config.ts's
  // `url`, for the handful of places that build a link as a literal string
  // instead (see src/lib/base.ts).
  site: 'https://krishna-1812.github.io',
  // This repo deploys to GitHub Pages as a project site — krishna-1812.github.io
  // is someone else's special `<user>.github.io` repo, not this one — so it is
  // served from a subpath rather than the domain root. Move to a custom
  // domain or a `<user>.github.io` repo and this goes back to '/'.
  base: '/fungames',
  // Trailing slashes match neal.fun's /game-name/ URL shape.
  trailingSlash: 'always',
  build: { format: 'directory' },
  output: 'static',
})
