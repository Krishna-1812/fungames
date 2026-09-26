/**
 * Internet Artifacts' twenty-five markers, drawn.
 *
 * Same contract as `space-elevator-art.ts` and `earth-reviews-art.ts`: a cut-out
 * per marker, composited directly over the page's own real background (here,
 * the era-appropriate two-tone `sky` from `internet-artifacts.ts`'s `ZONES`,
 * not an invented one) — real gradient shading allowed and expected, and
 * every `id=` (a gradient, a clip path, anything) prefixed with `slug(title)`
 * so twenty-five scenes can inline into one document without ever stealing
 * each other's gradients. `check-internet-artifacts-art.mjs` fails on an
 * unprefixed id, a duplicate id, and a `url(#…)` naming an id the scene
 * itself does not define.
 *
 * **One palette.** A handful of neutrals for the hardware and paper
 * (`frost`/`paper`/`steel`/`cloud`/`slate`/`slate2`/`ink`), a CRT-terminal
 * green pair for the ARPANET-era scenes (`phosphor`/`phosphor2`), warm tones
 * for anything lit or "hot" (`amber`/`gold`/`ember`/`ember2`), and a small
 * set of louder colours (`cyan`/`sky2`/`magenta`/`violet`/`fur`) reserved for
 * the later, more colourful web-culture scenes — the same "the palette gets
 * louder as the internet does" arc the page's own zone-sky colours follow.
 * A gradient's own stop colours count as uses of the palette too.
 *
 * These are real historical artifacts, not logos — nothing here traces or
 * reproduces an actual company trademark (no real Twitter bird, no real
 * YouTube play-button wordmark, no real Google lettering). Every scene is an
 * original drawing of the *thing that happened*, the same way Earth Reviews
 * draws its own mosquito rather than borrowing a stock one.
 */

export const P = {
  frost: '#eaf3ff',
  paper: '#f0e6d2',
  steel: '#c7d4e2',
  cloud: '#8fa0b8',
  slate: '#3a4a66',
  slate2: '#232d40',
  ink: '#12161f',
  phosphor: '#7cfc8a',
  phosphor2: '#3ea24a',
  amber: '#ffb347',
  gold: '#ffd27a',
  ember: '#ff9d5c',
  ember2: '#ff6b6b',
  cyan: '#6ee7ff',
  sky2: '#4fa8e0',
  magenta: '#ff6ec7',
  violet: '#a78bfa',
  fur: '#e8b04a',
} as const

export type Scene = {
  subject: string
  draw: () => string
}

const W = 120
const H = 120

/** Deterministic scatter, same generator as the other art modules. */
export const rnd = (seed: number, k: number) => {
  const x = Math.sin(seed * 9301 + k * 49297) * 233280
  return x - Math.floor(x)
}

/** A marker's title is a full sentence, not a plain key — every gradient/
 *  clipPath id in this module is prefixed with `slug(title)` instead, and
 *  `check-internet-artifacts-art.mjs` imports this same function to verify
 *  it, so the two can never drift. */
export const slug = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

export const INTERNET_ARTIFACTS_ART: Record<string, Scene> = {
  'The first message ever sent between two computers': {
    subject: 'a CRT terminal mid-crash, the word LO glowing on screen and a crack of static tearing through it',
    draw: () => {
      const k = slug('The first message ever sent between two computers')
      return (
        `<defs>` +
        `<linearGradient id="${k}-case" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${P.steel}"/><stop offset="1" stop-color="${P.slate}"/>` +
        `</linearGradient>` +
        `<radialGradient id="${k}-glow" cx="0.5" cy="0.42" r="0.6">` +
        `<stop offset="0" stop-color="${P.phosphor}" stop-opacity="0.9"/>` +
        `<stop offset="1" stop-color="${P.phosphor2}" stop-opacity="0"/>` +
        `</radialGradient>` +
        `</defs>` +
        // A boxy terminal cabinet, isometric enough to read as a machine.
        `<path d="M18 30 L102 30 L108 90 L12 90Z" fill="url(#${k}-case)"/>` +
        `<path d="M18 30 L102 30 L98 22 L22 22Z" fill="${P.steel}"/>` +
        `<rect x="26" y="38" width="68" height="44" rx="2" fill="${P.ink}"/>` +
        `<rect x="26" y="38" width="68" height="44" rx="2" fill="url(#${k}-glow)"/>` +
        // The word LO, glowing, with the third letter already breaking apart.
        `<text x="60" y="64" font-family="monospace" font-size="16" font-weight="700" text-anchor="middle" fill="${P.phosphor}">LO</text>` +
        `<path d="M74 58 L82 52 L78 60 L86 56 L80 64 L88 62" fill="none" stroke="${P.phosphor}" stroke-width="1.4" stroke-linecap="round" opacity="0.85"/>` +
        // A crack of static across the glass.
        `<path d="M30 42 L48 50 L40 58 L58 62 L50 72 L70 76" fill="none" stroke="${P.frost}" stroke-width="1" opacity="0.35"/>` +
        // Vents and a small power light, for weight.
        `<path d="M32 86 L34 90 M40 86 L42 90 M48 86 L50 90 M56 86 L58 90" stroke="${P.slate2}" stroke-width="1.6" stroke-linecap="round"/>` +
        `<circle cx="98" cy="86" r="2" fill="${P.amber}"/>`
      )
    },
  },

  'The first emoticon': {
    subject: 'a scanned bulletin-board post, typed monospace text with a glowing colon-hyphen-parenthesis smiley circled',
    draw: () => {
      const k = slug('The first emoticon')
      return (
        `<defs>` +
        `<linearGradient id="${k}-paper" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${P.paper}"/><stop offset="1" stop-color="${P.steel}"/>` +
        `</linearGradient>` +
        `</defs>` +
        // A slightly rotated sheet of printout, like a recovered backup page.
        `<g transform="rotate(-2 60 60)">` +
        `<rect x="16" y="18" width="88" height="84" rx="3" fill="url(#${k}-paper)"/>` +
        `<rect x="16" y="18" width="88" height="84" rx="3" fill="none" stroke="${P.slate}" stroke-width="1" opacity="0.4"/>` +
        // Ruled lines of "typed" text.
        `<path d="M26 32 L98 32 M26 40 L90 40 M26 48 L94 48" stroke="${P.slate}" stroke-width="1.6" opacity="0.45" stroke-linecap="round"/>` +
        // The proposal line itself, larger.
        `<text x="60" y="68" font-family="monospace" font-size="13" font-weight="700" text-anchor="middle" fill="${P.slate2}">:-)</text>` +
        `<circle cx="60" cy="63" r="14" fill="none" stroke="${P.ember}" stroke-width="1.6"/>` +
        `<path d="M26 82 L86 82 M26 90 L70 90" stroke="${P.slate}" stroke-width="1.6" opacity="0.45" stroke-linecap="round"/>` +
        `</g>`
      )
    },
  },

  'Nyan Cat': {
    subject: 'a Pop-Tart-bodied cat mid-flight trailing a five-band rainbow, star flecks around it',
    draw: () => {
      const k = slug('Nyan Cat')
      const stars = Array.from({ length: 6 }, (_, i) => {
        const x = 82 + rnd(31, i) * 30
        const y = 18 + rnd(31, i + 20) * 60
        const r = 1.4 + rnd(31, i + 40) * 1.4
        return `<path d="M${x.toFixed(1)} ${(y - r).toFixed(1)} L${(x + r * 0.3).toFixed(1)} ${(y - r * 0.3).toFixed(1)} L${(x + r).toFixed(1)} ${y.toFixed(1)} L${(x + r * 0.3).toFixed(1)} ${(y + r * 0.3).toFixed(1)} L${x.toFixed(1)} ${(y + r).toFixed(1)} L${(x - r * 0.3).toFixed(1)} ${(y + r * 0.3).toFixed(1)} L${(x - r).toFixed(1)} ${y.toFixed(1)} L${(x - r * 0.3).toFixed(1)} ${(y - r * 0.3).toFixed(1)}Z" fill="${P.frost}" opacity="0.9"/>`
      }).join('')
      return (
        `<defs>` +
        `<linearGradient id="${k}-pop" x1="0" y1="0" x2="1" y2="0.4">` +
        `<stop offset="0" stop-color="${P.ember}"/><stop offset="1" stop-color="${P.gold}"/>` +
        `</linearGradient>` +
        `</defs>` +
        // Rainbow trail, five bands, tapering toward the tail end.
        `<path d="M4 74 Q30 60 54 66" fill="none" stroke="${P.ember2}" stroke-width="6" stroke-linecap="round"/>` +
        `<path d="M4 68 Q30 54 54 60" fill="none" stroke="${P.gold}" stroke-width="6" stroke-linecap="round"/>` +
        `<path d="M4 62 Q30 48 54 54" fill="none" stroke="${P.phosphor}" stroke-width="6" stroke-linecap="round"/>` +
        `<path d="M4 56 Q30 42 54 48" fill="none" stroke="${P.cyan}" stroke-width="6" stroke-linecap="round"/>` +
        `<path d="M4 50 Q30 36 54 42" fill="none" stroke="${P.violet}" stroke-width="6" stroke-linecap="round"/>` +
        // Pop-Tart body.
        `<rect x="52" y="34" width="46" height="34" rx="4" fill="url(#${k}-pop)" transform="rotate(-8 75 51)"/>` +
        `<rect x="56" y="38" width="38" height="26" rx="3" fill="${P.frost}" opacity="0.25" transform="rotate(-8 75 51)"/>` +
        // Cat head, ears, and a stripe of fur colour.
        `<circle cx="96" cy="44" r="13" fill="${P.fur}"/>` +
        `<path d="M87 34 L91 24 L95 36Z" fill="${P.fur}"/>` +
        `<path d="M101 34 L105 24 L109 37Z" fill="${P.fur}"/>` +
        `<circle cx="92" cy="43" r="1.6" fill="${P.ink}"/>` +
        `<circle cx="100" cy="43" r="1.6" fill="${P.ink}"/>` +
        `<path d="M93 50 Q96 53 99 50" fill="none" stroke="${P.ink}" stroke-width="1.2" stroke-linecap="round"/>` +
        `<path d="M78 44 L86 42 M78 48 L86 47" stroke="${P.slate2}" stroke-width="1" opacity="0.6"/>` +
        // Legs, mid-stride.
        `<path d="M60 66 L54 78 M70 68 L66 80 M80 66 L84 78" stroke="${P.fur}" stroke-width="4" stroke-linecap="round"/>` +
        stars
      )
    },
  },
} as const

/* ---- mood, and the standalone svg wrapper -------------------------------- */

export function dominantMood(svg: string): string {
  const weight = new Map<string, number>()
  const add = (hex: string | undefined, area: number) => {
    if (!hex || !hex.startsWith('#')) return
    weight.set(hex, (weight.get(hex) ?? 0) + area)
  }
  const num = (attrs: string, name: string) => {
    const m = attrs.match(new RegExp(`${name}="(-?[\\d.]+)"`))
    return m ? Number(m[1]) : undefined
  }
  const attr = (attrs: string, name: string) => attrs.match(new RegExp(`${name}="([^"]*)"`))?.[1]

  for (const m of svg.matchAll(/<(rect|circle|ellipse|path|polygon|line|text)\s+([^>]*)\/?>/g)) {
    const [, tag, attrs] = m
    const fill = attr(attrs, 'fill')
    const stroke = attr(attrs, 'stroke')
    let area = 40
    if (tag === 'rect') {
      const w = num(attrs, 'width'), h = num(attrs, 'height')
      if (w && h) area = w * h
    } else if (tag === 'circle') {
      const r = num(attrs, 'r')
      if (r) area = Math.PI * r * r
    } else if (tag === 'ellipse') {
      const rx = num(attrs, 'rx'), ry = num(attrs, 'ry')
      if (rx && ry) area = Math.PI * rx * ry
    } else if (tag === 'path' || tag === 'polygon') {
      area = fill && fill !== 'none' ? 260 : 60
    } else {
      area = 60
    }
    if (fill && fill !== 'none') add(fill, area)
    else if (stroke && stroke !== 'none') add(stroke, area * 0.3)
  }

  let best: string | null = null
  let bestArea = 0
  for (const [hex, area] of weight) if (area > bestArea) { best = hex; bestArea = area }
  return best ?? P.frost
}

export const MOOD: Record<string, string> = Object.fromEntries(
  Object.entries(INTERNET_ARTIFACTS_ART).map(([title, s]) => [title, dominantMood(s.draw())]),
)

/** Full standalone SVG, sized to fill whatever box the marker gives it. */
export function sceneSvg(title: string): string {
  const s = INTERNET_ARTIFACTS_ART[title]
  if (!s) return ''
  return (
    `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" ` +
    `style="width:100%;height:100%;display:block" aria-hidden="true" focusable="false">` +
    `${s.draw()}</svg>`
  )
}
