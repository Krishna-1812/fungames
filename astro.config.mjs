import { defineConfig } from 'astro/config'

export default defineConfig({
  // Change to your real domain — used for canonical URLs, sitemap and OG tags.
  site: 'https://example.com',
  // Trailing slashes match neal.fun's /game-name/ URL shape.
  trailingSlash: 'always',
  build: { format: 'directory' },
  output: 'static',
})
