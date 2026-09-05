import { defineConfig } from 'astro/config'

export default defineConfig({
  // Placeholder — must match `url` in src/site.config.ts exactly. Used for
  // canonical URLs, the sitemap and OG tags; change both together.
  site: 'https://yoursite.com',
  // Trailing slashes match neal.fun's /game-name/ URL shape.
  trailingSlash: 'always',
  build: { format: 'directory' },
  output: 'static',
})
