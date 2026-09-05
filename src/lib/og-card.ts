/**
 * Social share images.
 *
 * `og:image`/`twitter:image` were wired up in Base.astro from the start — the
 * prop exists, the meta tags render — but no page ever passed one, so every
 * link shared from this site rendered as a bare title-and-URL card.
 *
 * Generated at build time as SVG, one per game, using nothing but data
 * already in the registry (title, blurb, accent colours) — the same "derive
 * it, don't hand-author it" rule sitemap.xml and robots.txt already follow.
 * Rasterised to PNG by `og/[slug].png.ts` via resvg, since Facebook's and
 * Twitter's card crawlers do not reliably render an SVG `og:image` — Slack
 * and Discord do, but the two biggest platforms do not, so PNG is the only
 * choice that works everywhere.
 *
 * Text renders in a generic sans-serif stack rather than the site's actual
 * Bricolage Grotesque / Inter: those are loaded from Google Fonts at runtime
 * in the browser, and resvg has no network access at build time to fetch
 * them. Shipping the real font files just for this would be its own can of
 * worms (licensing files, binary assets in git); a plain system sans is an
 * honest trade against that.
 */

const W = 1200
const H = 630

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Break a string into lines no longer than `max` characters, on word boundaries. */
function wrap(text: string, max: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const next = line ? `${line} ${w}` : w
    if (next.length > max && line) {
      lines.push(line)
      line = w
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  return lines
}

/** Relative luminance of a hex colour, for picking readable ink over it. */
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16 & 255) / 255
  const g = (n >> 8 & 255) / 255
  const b = (n & 255) / 255
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

export type CardInput = {
  title: string
  blurb: string
  accent: string
  accent2: string
  siteName: string
}

/** The card shared for a single game: title, blurb, and that game's own colours. */
export function gameCardSvg({ title, blurb, accent, accent2, siteName }: CardInput): string {
  const ink = luminance(accent2) > 0.35 ? '#14121a' : '#ffffff'
  const inkSoft = luminance(accent2) > 0.35 ? 'rgba(20,18,26,0.72)' : 'rgba(255,255,255,0.78)'
  const titleLines = wrap(title, 16).slice(0, 2)
  const blurbLines = wrap(blurb, 40).slice(0, 2)
  const titleY = 300 - (titleLines.length - 1) * 34

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${accent}" />
      <stop offset="1" stop-color="${accent2}" />
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)" />
  <circle cx="${W - 120}" cy="120" r="340" fill="${ink}" opacity="0.06" />
  <text x="90" y="${titleY}" font-family="Arial, Helvetica, sans-serif" font-size="76" font-weight="700" fill="${ink}">
    ${titleLines.map((l, i) => `<tspan x="90" dy="${i === 0 ? 0 : 88}">${esc(l)}</tspan>`).join('')}
  </text>
  <text x="90" y="${titleY + 90 + (titleLines.length - 1) * 88}" font-family="Arial, Helvetica, sans-serif" font-size="34" fill="${inkSoft}">
    ${blurbLines.map((l, i) => `<tspan x="90" dy="${i === 0 ? 46 : 46}">${esc(l)}</tspan>`).join('')}
  </text>
  <text x="90" y="${H - 56}" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="700" fill="${inkSoft}">${esc(siteName)}</text>
</svg>`
}

/** The card shared for the homepage itself: no single game's colours apply. */
export function siteCardSvg({ name, tagline }: { name: string; tagline: string }): string {
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#171226" />
      <stop offset="1" stop-color="#3a2a63" />
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)" />
  <circle cx="${W - 160}" cy="140" r="360" fill="#ffffff" opacity="0.05" />
  <text x="90" y="300" font-family="Arial, Helvetica, sans-serif" font-size="88" font-weight="700" fill="#ffffff">${esc(name)}</text>
  <text x="90" y="368" font-family="Arial, Helvetica, sans-serif" font-size="36" fill="rgba(255,255,255,0.78)">${esc(tagline)}</text>
</svg>`
}
