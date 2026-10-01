/**
 * The tab icon: the homepage's island, shrunk to a tile. The lighthouse on it
 * is the island's own lighthouse, and on the homepage its lamp blinks the
 * same Morse "HI" in the tab (see index.astro).
 *
 * It is drawn on a 32-unit grid with heavy ink so it still reads at 16 px.
 * scripts/make-favicon.mjs rasterises it for the places that want a PNG.
 */
const INK = '#1b2340'

export function faviconSvg(lit = true): string {
  const lamp = lit ? '#f4fdff' : '#34426b'
  const beam = lit
    ? `<path d="M21.6 6.2 31 2v9.4z" fill="#fff" opacity=".75"/><path d="M16.4 6.2 7 3.6v6z" fill="#fff" opacity=".45"/>`
    : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">` +
    `<defs><linearGradient id="fv-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b4e2ff"/><stop offset=".62" stop-color="#7cc2fb"/><stop offset=".62" stop-color="#3f93ea"/><stop offset="1" stop-color="#2f7fdc"/></linearGradient>` +
    `<clipPath id="fv-tile"><rect width="32" height="32" rx="7.5"/></clipPath></defs>` +
    `<g clip-path="url(#fv-tile)">` +
    `<rect width="32" height="32" fill="url(#fv-sky)"/>` +
    beam +
    // a cloud, and the sea's highlights
    `<path d="M2.5 13.2a2.2 2.2 0 0 1 2.6-2.6 3 3 0 0 1 5.6.9 1.9 1.9 0 0 1 .2 3.7H4a1.7 1.7 0 0 1-1.5-2z" fill="#fff"/>` +
    `<path d="M3 29.2q1.6-1 3.2 0t3.2 0M22 30q1.6-1 3.2 0t3.2 0" fill="none" stroke="#bfe6ff" stroke-width="1.2" stroke-linecap="round"/>` +
    // the island: sides, then the grass on top
    `<path d="M3 20.5 15.5 14.3 28 20.5v3.6L15.5 30.3 3 24.1z" fill="#2a8b85" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>` +
    `<path d="M15.5 26.7v3.6" stroke="${INK}" stroke-width="1.5"/>` +
    `<path d="M15.5 26.7 28 20.5v3.6l-12.5 6.2z" fill="#1f6f6f"/>` +
    `<path d="M15.5 26.7 28 20.5v3.6L15.5 30.3z" fill="none" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>` +
    `<path d="M3 20.5 15.5 14.3 28 20.5l-12.5 6.2z" fill="#4fe3c1" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>` +
    // a tree
    `<path d="M8.6 21.2v-2" stroke="${INK}" stroke-width="1.4" stroke-linecap="round"/>` +
    `<circle cx="8.6" cy="17.6" r="2.7" fill="#17b48e" stroke="${INK}" stroke-width="1.4"/>` +
    // the lighthouse
    `<path d="M17.3 9.4h4l1.3 13h-6.6z" fill="#fff" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>` +
    `<path d="M16.9 13.6h4.8M16.4 18h5.8" stroke="#3b5bff" stroke-width="2.1"/>` +
    `<path d="M17.3 9.4h4l1.3 13h-6.6z" fill="none" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>` +
    `<rect x="17.4" y="5.4" width="3.8" height="4" rx=".7" fill="${lamp}" stroke="${INK}" stroke-width="1.4"/>` +
    `<path d="M16.6 5.6 19.3 3l2.7 2.6z" fill="#3b5bff" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/>` +
    `</g>` +
    `<rect x=".75" y=".75" width="30.5" height="30.5" rx="6.9" fill="none" stroke="${INK}" stroke-width="1.5"/>` +
    `</svg>`
}

export const faviconHref = (lit = true) => 'data:image/svg+xml,' + encodeURIComponent(faviconSvg(lit))
