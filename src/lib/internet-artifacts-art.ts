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

  'The first network email': {
    subject: 'a boxy 1970s terminal with a glowing @ on its screen and a curling paper ticket, a dashed line reaching to a distant second machine',
    draw: () => {
      const k = slug('The first network email')
      return (
        `<defs>` +
        `<linearGradient id="${k}-case" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${P.cloud}"/><stop offset="1" stop-color="${P.slate}"/>` +
        `</linearGradient>` +
        `<radialGradient id="${k}-glow" cx="0.5" cy="0.45" r="0.65">` +
        `<stop offset="0" stop-color="${P.phosphor}" stop-opacity="0.9"/>` +
        `<stop offset="1" stop-color="${P.phosphor2}" stop-opacity="0"/>` +
        `</radialGradient>` +
        `</defs>` +
        // main console body
        `<path d="M18 48 L96 48 L100 88 L14 88Z" fill="url(#${k}-case)"/>` +
        // top bezel/lid
        `<path d="M18 48 L96 48 L92 40 L22 40Z" fill="${P.steel}"/>` +
        // screen recess with a glowing @
        `<rect x="24" y="54" width="34" height="24" rx="2" fill="${P.ink}"/>` +
        `<rect x="24" y="54" width="34" height="24" rx="2" fill="url(#${k}-glow)"/>` +
        `<text x="41" y="71" font-family="monospace" font-size="15" font-weight="700" text-anchor="middle" fill="${P.phosphor}">@</text>` +
        // keys row
        `<rect x="24" y="82" width="6" height="4" rx="1" fill="${P.slate2}"/>` +
        `<rect x="33" y="82" width="6" height="4" rx="1" fill="${P.slate2}"/>` +
        `<rect x="42" y="82" width="6" height="4" rx="1" fill="${P.slate2}"/>` +
        `<rect x="51" y="82" width="6" height="4" rx="1" fill="${P.slate2}"/>` +
        // paper output slot with a curling printed ticket
        `<rect x="66" y="50" width="24" height="4" fill="${P.ink}"/>` +
        `<path d="M68 50 C 66 38 78 26 90 22 C 82 32 76 40 74 50Z" fill="${P.paper}" stroke="${P.slate}" stroke-width="1"/>` +
        `<path d="M72 44 L82 41 M71 39 L80 36" stroke="${P.slate2}" stroke-width="1" opacity="0.5"/>` +
        // a dashed link reaching to a distant second machine
        `<path d="M96 58 Q 106 48 104 34" fill="none" stroke="${P.phosphor2}" stroke-width="1.4" stroke-dasharray="3 3"/>` +
        `<rect x="98" y="20" width="14" height="12" rx="1" fill="${P.cloud}"/>` +
        `<rect x="101" y="23" width="8" height="5" rx="1" fill="${P.ink}"/>` +
        // feet/vents on console
        `<path d="M28 88 L30 92 M40 88 L42 92 M52 88 L54 92" stroke="${P.slate2}" stroke-width="1.4" stroke-linecap="round"/>`
      )
    },
  },

  'The first spam email': {
    subject: 'an old teletype printer fanning out five identical paper slips like a hand of cards, each bearing the same ruled lines',
    draw: () => {
      const k = slug('The first spam email')
      return (
        `<defs>` +
        `<linearGradient id="${k}-case" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${P.steel}"/><stop offset="1" stop-color="${P.slate2}"/>` +
        `</linearGradient>` +
        `<linearGradient id="${k}-slip" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${P.paper}"/><stop offset="1" stop-color="${P.steel}"/>` +
        `</linearGradient>` +
        `</defs>` +
        // printer body, bottom center
        `<path d="M36 78 L84 78 L88 100 L32 100Z" fill="url(#${k}-case)"/>` +
        `<rect x="40" y="70" width="40" height="10" rx="2" fill="${P.slate}"/>` +
        // five identical slips fanning out of the print slot
        `<g transform="translate(60 74)">` +
        `<g transform="rotate(-28)"><rect x="-13" y="-46" width="26" height="34" rx="1" fill="url(#${k}-slip)" stroke="${P.slate}" stroke-width="0.6"/><path d="M-8 -38 L8 -38 M-8 -32 L8 -32 M-8 -26 L4 -26" stroke="${P.slate2}" stroke-width="1" opacity="0.5"/></g>` +
        `<g transform="rotate(-14)"><rect x="-13" y="-48" width="26" height="34" rx="1" fill="url(#${k}-slip)" stroke="${P.slate}" stroke-width="0.6"/><path d="M-8 -40 L8 -40 M-8 -34 L8 -34 M-8 -28 L4 -28" stroke="${P.slate2}" stroke-width="1" opacity="0.5"/></g>` +
        `<g transform="rotate(0)"><rect x="-13" y="-50" width="26" height="34" rx="1" fill="url(#${k}-slip)" stroke="${P.slate}" stroke-width="0.6"/><path d="M-8 -42 L8 -42 M-8 -36 L8 -36 M-8 -30 L4 -30" stroke="${P.ember}" stroke-width="1.2"/></g>` +
        `<g transform="rotate(14)"><rect x="-13" y="-48" width="26" height="34" rx="1" fill="url(#${k}-slip)" stroke="${P.slate}" stroke-width="0.6"/><path d="M-8 -40 L8 -40 M-8 -34 L8 -34 M-8 -28 L4 -28" stroke="${P.slate2}" stroke-width="1" opacity="0.5"/></g>` +
        `<g transform="rotate(28)"><rect x="-13" y="-46" width="26" height="34" rx="1" fill="url(#${k}-slip)" stroke="${P.slate}" stroke-width="0.6"/><path d="M-8 -38 L8 -38 M-8 -32 L8 -32 M-8 -26 L4 -26" stroke="${P.slate2}" stroke-width="1" opacity="0.5"/></g>` +
        `</g>` +
        // warning glow on the printer
        `<circle cx="76" cy="75" r="2" fill="${P.ember2}"/>` +
        // vents
        `<path d="M42 92 L44 96 M50 92 L52 96 M58 92 L60 96" stroke="${P.slate2}" stroke-width="1.2" stroke-linecap="round"/>`
      )
    },
  },

  'ARPANET’s flag day': {
    subject: 'six small networked machines around a central flagpole, half still glowing green and half gone dark as the cutover happens',
    draw: () => {
      const k = slug('ARPANET’s flag day')
      return (
        `<defs>` +
        `<radialGradient id="${k}-glow" cx="0.5" cy="0.5" r="0.6">` +
        `<stop offset="0" stop-color="${P.phosphor}" stop-opacity="0.85"/>` +
        `<stop offset="1" stop-color="${P.phosphor2}" stop-opacity="0"/>` +
        `</radialGradient>` +
        `</defs>` +
        // spokes from the flagpole out to six machines
        `<path d="M60 60 L28 34 M60 60 L60 24 M60 60 L92 34 M60 60 L28 86 M60 60 L60 96 M60 60 L92 86" stroke="${P.slate}" stroke-width="1.4"/>` +
        // flagpole and flag, mid-cutover
        `<line x1="60" y1="60" x2="60" y2="30" stroke="${P.steel}" stroke-width="2"/>` +
        `<path d="M60 30 L76 36 L60 42Z" fill="${P.ember}"/>` +
        `<circle cx="60" cy="60" r="5" fill="${P.steel}"/>` +
        // three machines still lit on the network
        `<rect x="20" y="26" width="16" height="12" rx="2" fill="${P.slate2}"/>` +
        `<rect x="20" y="26" width="16" height="12" rx="2" fill="url(#${k}-glow)"/>` +
        `<rect x="52" y="10" width="16" height="12" rx="2" fill="${P.slate2}"/>` +
        `<rect x="52" y="10" width="16" height="12" rx="2" fill="url(#${k}-glow)"/>` +
        `<rect x="84" y="26" width="16" height="12" rx="2" fill="${P.slate2}"/>` +
        `<rect x="84" y="26" width="16" height="12" rx="2" fill="url(#${k}-glow)"/>` +
        // three machines dropped off, dark
        `<rect x="20" y="80" width="16" height="12" rx="2" fill="${P.ink}" stroke="${P.slate}" stroke-width="1"/>` +
        `<rect x="52" y="90" width="16" height="12" rx="2" fill="${P.ink}" stroke="${P.slate}" stroke-width="1"/>` +
        `<rect x="84" y="80" width="16" height="12" rx="2" fill="${P.ink}" stroke="${P.slate}" stroke-width="1"/>` +
        // indicator lights
        `<circle cx="24" cy="32" r="1.4" fill="${P.phosphor}"/>` +
        `<circle cx="56" cy="16" r="1.4" fill="${P.phosphor}"/>` +
        `<circle cx="88" cy="32" r="1.4" fill="${P.phosphor}"/>` +
        `<circle cx="24" cy="86" r="1.4" fill="${P.slate}"/>` +
        `<circle cx="56" cy="96" r="1.4" fill="${P.slate}"/>` +
        `<circle cx="88" cy="86" r="1.4" fill="${P.slate}"/>`
      )
    },
  },

  'The first .com domain': {
    subject: 'a boxy workstation with ".com" glowing on its screen beside a ribboned registration plaque',
    draw: () => {
      const k = slug('The first .com domain')
      return (
        `<defs>` +
        `<linearGradient id="${k}-case" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${P.cloud}"/><stop offset="1" stop-color="${P.slate}"/>` +
        `</linearGradient>` +
        `<radialGradient id="${k}-glow" cx="0.5" cy="0.45" r="0.65">` +
        `<stop offset="0" stop-color="${P.amber}" stop-opacity="0.85"/>` +
        `<stop offset="1" stop-color="${P.ember}" stop-opacity="0"/>` +
        `</radialGradient>` +
        `</defs>` +
        // monitor body
        `<path d="M18 26 L64 26 L68 74 L14 74Z" fill="url(#${k}-case)"/>` +
        `<rect x="24" y="34" width="34" height="26" rx="2" fill="${P.ink}"/>` +
        `<rect x="24" y="34" width="34" height="26" rx="2" fill="url(#${k}-glow)"/>` +
        `<text x="41" y="52" font-family="monospace" font-size="10" font-weight="700" text-anchor="middle" fill="${P.amber}">.com</text>` +
        // stand and base
        `<rect x="34" y="74" width="14" height="8" fill="${P.slate2}"/>` +
        `<rect x="24" y="82" width="34" height="5" rx="2" fill="${P.slate}"/>` +
        // keyboard
        `<rect x="18" y="90" width="46" height="10" rx="2" fill="${P.steel}"/>` +
        `<path d="M22 93 L24 93 M28 93 L30 93 M34 93 L36 93 M40 93 L42 93 M46 93 L48 93 M52 93 L54 93 M22 97 L24 97 M28 97 L30 97 M34 97 L36 97 M40 97 L42 97 M46 97 L48 97" stroke="${P.slate2}" stroke-width="1.4" stroke-linecap="round"/>` +
        // registration plaque beside the workstation
        `<rect x="76" y="40" width="30" height="38" rx="2" fill="${P.paper}" stroke="${P.slate}" stroke-width="1"/>` +
        `<path d="M80 48 L102 48 M80 54 L102 54 M80 60 L94 60" stroke="${P.slate2}" stroke-width="1.2" opacity="0.6"/>` +
        // a ribbon seal on the plaque
        `<circle cx="91" cy="70" r="6" fill="${P.gold}"/>` +
        `<path d="M87 74 L84 84 L91 80 L98 84 L95 74Z" fill="${P.ember2}"/>`
      )
    },
  },

  'The Morris Worm': {
    subject: 'a thick coiled worm looping tightly around itself with a raised head, three crashed machines pinned inside its coils and glowing red',
    draw: () => {
      const k = slug('The Morris Worm')
      return (
        `<defs>` +
        `<linearGradient id="${k}-worm" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0" stop-color="${P.phosphor}"/><stop offset="1" stop-color="${P.phosphor2}"/>` +
        `</linearGradient>` +
        `<radialGradient id="${k}-bad" cx="0.5" cy="0.5" r="0.65">` +
        `<stop offset="0" stop-color="${P.ember2}" stop-opacity="0.95"/>` +
        `<stop offset="0.7" stop-color="${P.ember}" stop-opacity="0.5"/>` +
        `<stop offset="1" stop-color="${P.ember}" stop-opacity="0"/>` +
        `</radialGradient>` +
        `</defs>` +
        // a wide red glow field behind the whole coil, from the crashed machines
        `<circle cx="60" cy="64" r="46" fill="url(#${k}-bad)"/>` +
        // three crashed machines pinned inside the coils, larger and off-axis
        `<rect x="22" y="30" width="20" height="15" rx="2" transform="rotate(-10 32 37)" fill="${P.slate2}" stroke="${P.ember2}" stroke-width="1.2"/>` +
        `<rect x="70" y="26" width="20" height="15" rx="2" transform="rotate(8 80 33)" fill="${P.slate2}" stroke="${P.ember2}" stroke-width="1.2"/>` +
        `<rect x="46" y="86" width="20" height="15" rx="2" transform="rotate(-4 56 93)" fill="${P.slate2}" stroke="${P.ember2}" stroke-width="1.2"/>` +
        `<circle cx="32" cy="37" r="1.6" fill="${P.ember2}"/>` +
        `<circle cx="80" cy="33" r="1.6" fill="${P.ember2}"/>` +
        `<circle cx="56" cy="93" r="1.6" fill="${P.ember2}"/>` +
        // the worm, one thick body coiling tightly on itself twice
        `<path d="M60 60 C 30 60 24 30 52 24 C 84 18 96 46 76 58 C 60 68 40 58 44 42 C 47 30 62 28 68 38 C 72 46 64 52 58 48 C 90 70 88 100 60 104 C 34 108 16 86 30 68" ` +
        `fill="none" stroke="url(#${k}-worm)" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>` +
        // segment ridges along the body for texture
        `<path d="M38 30 L35 25 M56 22 L57 17 M76 24 L80 20 M88 40 L93 38 M70 55 L74 60 M50 34 L45 32 M50 100 L48 105 M24 78 L19 76" ` +
        `stroke="${P.phosphor2}" stroke-width="1.8" stroke-linecap="round"/>` +
        // the head, raised and larger, with an eye
        `<circle cx="30" cy="68" r="7" fill="url(#${k}-worm)"/>` +
        `<path d="M25 62 Q30 54 37 60" fill="none" stroke="url(#${k}-worm)" stroke-width="8" stroke-linecap="round"/>` +
        `<circle cx="34" cy="59" r="1.3" fill="${P.ink}"/>`
      )
    },
  },

  'The World Wide Web goes public': {
    subject: 'an early browser window, its page showing ruled text and one glowing underlined hyperlink with a cursor poised over it',
    draw: () => {
      const k = slug('The World Wide Web goes public')
      return (
        `<defs>` +
        `<linearGradient id="${k}-chrome" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${P.steel}"/><stop offset="1" stop-color="${P.slate}"/>` +
        `</linearGradient>` +
        `<radialGradient id="${k}-glow" cx="0.5" cy="0.5" r="0.6">` +
        `<stop offset="0" stop-color="${P.cyan}" stop-opacity="0.55"/>` +
        `<stop offset="1" stop-color="${P.cyan}" stop-opacity="0"/>` +
        `</radialGradient>` +
        `</defs>` +
        // Window body and title bar — a generous steel bezel stays visible around the page.
        `<rect x="14" y="20" width="92" height="82" rx="3" fill="url(#${k}-chrome)"/>` +
        `<path d="M14 23 Q14 20 17 20 L103 20 Q106 20 106 23 L106 30 L14 30Z" fill="${P.slate2}"/>` +
        `<circle cx="21" cy="25" r="1.6" fill="${P.frost}"/>` +
        `<circle cx="27" cy="25" r="1.6" fill="${P.frost}"/>` +
        `<circle cx="33" cy="25" r="1.6" fill="${P.frost}"/>` +
        `<path d="M18 34 L102 34" stroke="${P.slate}" stroke-width="1" opacity="0.5"/>` +
        // Page content, inset well within the frame.
        `<rect x="27" y="40" width="66" height="48" fill="${P.frost}"/>` +
        `<path d="M33 48 L87 48" stroke="${P.slate2}" stroke-width="2" opacity="0.7" stroke-linecap="round"/>` +
        // The hyperlink glow and line.
        `<circle cx="48" cy="60" r="13" fill="url(#${k}-glow)"/>` +
        `<path d="M33 60 L60 60" stroke="${P.cyan}" stroke-width="2.6" stroke-linecap="round"/>` +
        `<path d="M33 64 L60 64" stroke="${P.cyan}" stroke-width="1" opacity="0.6"/>` +
        `<path d="M65 60 L87 60" stroke="${P.slate2}" stroke-width="2" opacity="0.7" stroke-linecap="round"/>` +
        `<path d="M33 72 L85 72 M33 80 L64 80" stroke="${P.slate2}" stroke-width="2" opacity="0.7" stroke-linecap="round"/>` +
        // Cursor arrow poised over the link.
        `<path d="M50 74 L50 90 L53.5 86.5 L56 93 L58.5 92 L56 85.5 L60.5 85.5Z" fill="${P.ink}"/>` +
        // Faint reach rays beneath — the page going public.
        `<path d="M30 106 L23 112 M50 108 L47 114 M70 108 L73 114 M90 106 L97 112" stroke="${P.cyan}" stroke-width="1.4" opacity="0.45" stroke-linecap="round"/>`
      )
    },
  },

  'The first photo on the Web': {
    subject: 'a tilted scrap of printout, mostly given over to a large framed mosaic of colour pixels, an <IMG> tag bracketing the frame',
    draw: () => {
      const k = slug('The first photo on the Web')
      const pixels = [
        [P.ember, P.gold, P.frost, P.slate2, P.cyan, P.gold, P.ember],
        [P.gold, P.frost, P.ember, P.cyan, P.slate2, P.frost, P.gold],
        [P.frost, P.ember2, P.gold, P.frost, P.ember, P.cyan, P.frost],
        [P.cyan, P.gold, P.frost, P.ember, P.frost, P.slate2, P.cyan],
        [P.slate2, P.cyan, P.gold, P.ember2, P.gold, P.frost, P.ember],
      ]
      const px = pixels
        .map((row, ry) =>
          row
            .map((c, rx) => `<rect x="${(24 + rx * 10.3).toFixed(1)}" y="${40 + ry * 9.2}" width="10" height="9.4" fill="${c}"/>`)
            .join(''),
        )
        .join('')
      return (
        `<defs>` +
        `<linearGradient id="${k}-scan" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${P.steel}" stop-opacity="0.6"/>` +
        `<stop offset="0.5" stop-color="${P.steel}" stop-opacity="0"/>` +
        `<stop offset="1" stop-color="${P.steel}" stop-opacity="0"/>` +
        `</linearGradient>` +
        `</defs>` +
        `<g transform="rotate(3 60 60)">` +
        // A small torn scrap of printout, not a full page.
        `<path d="M18 24 L98 20 L100 96 L20 100Z" fill="${P.paper}"/>` +
        `<path d="M18 24 L98 20 L100 96 L20 100Z" fill="none" stroke="${P.slate}" stroke-width="1" opacity="0.4"/>` +
        // One short line of caption text above the photo, that's all.
        `<path d="M27 32 L70 31" stroke="${P.slate2}" stroke-width="2" opacity="0.6" stroke-linecap="round"/>` +
        // <IMG> brackets flanking the frame.
        `<text x="20" y="72" font-family="monospace" font-size="12" font-weight="700" fill="${P.slate}">&lt;</text>` +
        `<text x="93" y="72" font-family="monospace" font-size="12" font-weight="700" fill="${P.slate}">&gt;</text>` +
        // The frame and the mosaic itself, filling most of the scrap.
        `<rect x="22" y="38" width="73" height="48" fill="${P.steel}"/>` +
        px +
        `<rect x="24" y="40" width="72.1" height="46" fill="url(#${k}-scan)"/>` +
        `<rect x="22" y="38" width="73" height="48" fill="none" stroke="${P.frost}" stroke-width="1.6"/>` +
        // One short caption line beneath.
        `<path d="M27 92 L58 92" stroke="${P.slate2}" stroke-width="2" opacity="0.6" stroke-linecap="round"/>` +
        `</g>`
      )
    },
  },

  'The first concert streamed live online': {
    subject: 'a guitar whose sound rings radiate outward and resolve into a handful of linked network nodes',
    draw: () => {
      const k = slug('The first concert streamed live online')
      return (
        `<defs>` +
        `<linearGradient id="${k}-body" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0" stop-color="${P.ember}"/><stop offset="1" stop-color="${P.gold}"/>` +
        `</linearGradient>` +
        `</defs>` +
        // Sound rings, centred on the sound hole, drawn first so the guitar sits over them.
        `<circle cx="40" cy="68" r="16" fill="none" stroke="${P.cyan}" stroke-width="1.4" opacity="0.55"/>` +
        `<circle cx="40" cy="68" r="24" fill="none" stroke="${P.cyan}" stroke-width="1.2" opacity="0.4"/>` +
        `<circle cx="40" cy="68" r="31" fill="none" stroke="${P.phosphor}" stroke-width="1" opacity="0.3"/>` +
        // Guitar body.
        `<path d="M22 70 Q17 55 30 49 Q46 42 55 55 Q61 66 53 79 Q45 93 29 90 Q16 87 22 70Z" fill="url(#${k}-body)"/>` +
        `<circle cx="36" cy="67" r="6" fill="${P.ink}"/>` +
        `<path d="M27 82 Q40 88 50 78" fill="none" stroke="${P.slate2}" stroke-width="1.4" opacity="0.6"/>` +
        // Neck and headstock.
        `<path d="M46 50 L86 22" stroke="${P.slate2}" stroke-width="7" stroke-linecap="round"/>` +
        `<path d="M45 47 L85 20 M48.5 53 L88.5 26" stroke="${P.frost}" stroke-width="0.8" opacity="0.7"/>` +
        `<rect x="79" y="12" width="15" height="11" rx="2" fill="${P.slate2}" transform="rotate(-32 86.5 17.5)"/>` +
        // Signal reaching out into a small network.
        `<circle cx="79" cy="28" r="3" fill="${P.phosphor}"/>` +
        `<circle cx="97" cy="38" r="2.6" fill="${P.cyan}"/>` +
        `<circle cx="101" cy="58" r="2.6" fill="${P.phosphor2}"/>` +
        `<path d="M62 54 L79 28 M79 28 L97 38 M97 38 L101 58" stroke="${P.cyan}" stroke-width="1" opacity="0.6" stroke-dasharray="2 2"/>`
      )
    },
  },

  'A coffee pot gets the first webcam': {
    subject: 'a glowing percolator watched by a small boxy camera perched beside it on a mount, steam curling above',
    draw: () => {
      const k = slug('A coffee pot gets the first webcam')
      return (
        `<defs>` +
        `<linearGradient id="${k}-pot" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${P.steel}"/><stop offset="1" stop-color="${P.slate}"/>` +
        `</linearGradient>` +
        `<radialGradient id="${k}-glow" cx="0.5" cy="0.5" r="0.6">` +
        `<stop offset="0" stop-color="${P.gold}"/><stop offset="0.7" stop-color="${P.amber}"/>` +
        `<stop offset="1" stop-color="${P.ember}"/>` +
        `</radialGradient>` +
        `<linearGradient id="${k}-cam" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${P.frost}"/><stop offset="1" stop-color="${P.steel}"/>` +
        `</linearGradient>` +
        `</defs>` +
        // Steam.
        `<path d="M52 44 Q50 38 54 34 Q58 30 54 24" stroke="${P.frost}" stroke-width="1.4" fill="none" opacity="0.5" stroke-linecap="round"/>` +
        `<path d="M66 44 Q68 38 64 34 Q60 30 64 25" stroke="${P.frost}" stroke-width="1.4" fill="none" opacity="0.5" stroke-linecap="round"/>` +
        // Pot body.
        `<path d="M40 58 Q38 50 48 48 L72 48 Q82 50 80 58 L78 92 Q78 100 68 100 L52 100 Q42 100 42 92Z" fill="url(#${k}-pot)"/>` +
        `<ellipse cx="60" cy="49" rx="16" ry="4" fill="${P.steel}"/>` +
        `<circle cx="60" cy="45" r="3" fill="${P.frost}"/>` +
        `<path d="M40 66 L28 60 L40 72Z" fill="${P.slate}"/>` +
        `<path d="M80 62 Q92 64 90 78 Q88 90 76 88" fill="none" stroke="${P.slate2}" stroke-width="4" stroke-linecap="round"/>` +
        // The coffee gauge, glowing.
        `<circle cx="60" cy="73" r="9" fill="url(#${k}-glow)"/>` +
        `<circle cx="60" cy="73" r="9" fill="none" stroke="${P.slate2}" stroke-width="1.4"/>` +
        // The camera, aimed square at the pot.
        `<path d="M84 58 L92 58 L86 66Z" fill="${P.slate2}"/>` +
        `<path d="M92 48 L86 58" stroke="${P.slate2}" stroke-width="2.4" stroke-linecap="round"/>` +
        `<rect x="82" y="34" width="20" height="14" rx="2" fill="url(#${k}-cam)"/>` +
        `<circle cx="87" cy="41" r="4" fill="${P.ink}"/>` +
        `<circle cx="87" cy="41" r="4" fill="none" stroke="${P.cyan}" stroke-width="1.4"/>` +
        `<circle cx="98" cy="37" r="1.6" fill="${P.ember2}"/>`
      )
    },
  },

  'The first secure online purchase': {
    subject: 'a reflective CD beside an old mechanical padlock, a zigzag of encrypted data stitching the two together',
    draw: () => {
      const k = slug('The first secure online purchase')
      return (
        `<defs>` +
        `<radialGradient id="${k}-disc" cx="0.4" cy="0.35" r="0.75">` +
        `<stop offset="0" stop-color="${P.frost}"/><stop offset="0.6" stop-color="${P.steel}"/>` +
        `<stop offset="1" stop-color="${P.slate}"/>` +
        `</radialGradient>` +
        `<linearGradient id="${k}-lock" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${P.gold}"/><stop offset="1" stop-color="${P.amber}"/>` +
        `</linearGradient>` +
        `</defs>` +
        // The disc.
        `<circle cx="42" cy="52" r="26" fill="url(#${k}-disc)"/>` +
        `<path d="M22 60 A26 26 0 0 1 38 27" fill="none" stroke="${P.violet}" stroke-width="1.6" opacity="0.55"/>` +
        `<path d="M26 39 A26 26 0 0 1 54 29" fill="none" stroke="${P.magenta}" stroke-width="1.4" opacity="0.5"/>` +
        `<circle cx="42" cy="52" r="5" fill="${P.ink}"/>` +
        `<circle cx="42" cy="52" r="5" fill="none" stroke="${P.frost}" stroke-width="0.8"/>` +
        // Encrypted data, zigzagging from the disc to the lock.
        `<path d="M64 58 L72 50 L78 62 L86 54 L91 65" fill="none" stroke="${P.cyan}" stroke-width="1.6" stroke-linecap="round" stroke-dasharray="3 2"/>` +
        `<circle cx="72" cy="50" r="1.6" fill="${P.phosphor}"/>` +
        `<circle cx="78" cy="62" r="1.6" fill="${P.phosphor}"/>` +
        `<circle cx="86" cy="54" r="1.6" fill="${P.phosphor}"/>` +
        // The padlock.
        `<path d="M82 76 L82 64 Q82 54 89 54 Q96 54 96 64 L96 76" fill="none" stroke="${P.slate2}" stroke-width="5" stroke-linecap="round"/>` +
        `<rect x="76" y="76" width="26" height="22" rx="3" fill="url(#${k}-lock)"/>` +
        `<circle cx="89" cy="85" r="3" fill="${P.ink}"/>` +
        `<path d="M89 88 L89 93" stroke="${P.ink}" stroke-width="3" stroke-linecap="round"/>`
      )
    },
  },

  'The first banner ad': {
    subject: 'a bold rectangular banner, dominating a narrow strip of document, a cursor mid-click at its centre with a small burst',
    draw: () => {
      const k = slug('The first banner ad')
      return (
        `<defs>` +
        `<linearGradient id="${k}-banner" x1="0" y1="0" x2="1" y2="0.3">` +
        `<stop offset="0" stop-color="${P.ember}"/><stop offset="1" stop-color="${P.gold}"/>` +
        `</linearGradient>` +
        `</defs>` +
        // A narrow strip of document, just enough to place the banner in context.
        `<rect x="18" y="40" width="84" height="42" fill="${P.paper}"/>` +
        `<path d="M25 48 L60 48" stroke="${P.slate2}" stroke-width="2" opacity="0.6" stroke-linecap="round"/>` +
        // The banner itself, big and bold, breaking out past the strip.
        `<rect x="14" y="52" width="92" height="26" rx="2" fill="url(#${k}-banner)"/>` +
        `<rect x="14" y="52" width="92" height="26" rx="2" fill="none" stroke="${P.amber}" stroke-width="1.4"/>` +
        `<path d="M24 61 L42 61 M50 61 L82 61 M24 69 L58 69 M64 69 L96 69" stroke="${P.ink}" stroke-width="2.2" opacity="0.55" stroke-linecap="round"/>` +
        `<path d="M25 75 L48 75" stroke="${P.slate2}" stroke-width="2" opacity="0.6" stroke-linecap="round"/>` +
        // Cursor mid-click, dead centre on the banner.
        `<path d="M56 46 L56 62 L59.5 58.5 L62 65 L64.5 64 L62 57.5 L66.5 57.5Z" fill="${P.ink}"/>` +
        `<path d="M62 44 L64 40 M69 48 L74 45 M71 55 L76 55" stroke="${P.gold}" stroke-width="1.6" opacity="0.8" stroke-linecap="round"/>`
      )
    },
  },

  'The first eBay sale': {
    subject: 'a broken handheld laser pointer snapped in two, sparking, with a price tag on a string',
    draw: () => {
      const k = slug('The first eBay sale')
      return (
        `<defs>` +
        `<linearGradient id="${k}-barrel" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0" stop-color="${P.frost}"/><stop offset="1" stop-color="${P.cloud}"/>` +
        `</linearGradient>` +
        `<radialGradient id="${k}-spark" cx="0.5" cy="0.5" r="0.5">` +
        `<stop offset="0" stop-color="${P.ember2}" stop-opacity="0.9"/><stop offset="1" stop-color="${P.ember2}" stop-opacity="0"/>` +
        `</radialGradient>` +
        `</defs>` +
        // Back half of the pointer, broken free of the tip.
        `<rect x="18" y="68" width="44" height="15" rx="7" fill="url(#${k}-barrel)" transform="rotate(-15 40 75)"/>` +
        `<circle cx="32" cy="72" r="3" fill="${P.amber}" transform="rotate(-15 40 75)"/>` +
        // Front tip, knocked askew, showing the break.
        `<rect x="64" y="56" width="28" height="13" rx="6" fill="url(#${k}-barrel)" transform="rotate(-6 78 62)"/>` +
        `<circle cx="90" cy="59" r="2.4" fill="${P.ink}" transform="rotate(-6 78 62)"/>` +
        // Crack and shatter bits between the two halves.
        `<path d="M58 72 L64 66 L60 70 L67 63 L63 68" fill="none" stroke="${P.ink}" stroke-width="1.1" stroke-linecap="round"/>` +
        `<path d="M59 68 L62 65 L61 69Z" fill="${P.frost}"/>` +
        `<path d="M64 72 L67 70 L66 74Z" fill="${P.frost}" opacity="0.8"/>` +
        // A dying, broken beam.
        `<path d="M93 58 L100 54" stroke="${P.ember2}" stroke-width="1.6" stroke-linecap="round" stroke-dasharray="2 3"/>` +
        `<circle cx="102" cy="52" r="9" fill="url(#${k}-spark)"/>` +
        `<path d="M102 45 L104 51 L110 52 L104 54 L102 60 L100 54 L94 52 L100 51Z" fill="${P.ember2}"/>` +
        // The price tag, still attached.
        `<path d="M52 66 Q66 50 76 40" fill="none" stroke="${P.slate}" stroke-width="1"/>` +
        `<rect x="70" y="26" width="26" height="16" rx="3" fill="${P.paper}" stroke="${P.slate2}" stroke-width="0.8" transform="rotate(8 83 34)"/>` +
        `<circle cx="75" cy="30" r="1.4" fill="${P.ink}" transform="rotate(8 83 34)"/>` +
        `<text x="86" y="38" font-family="monospace" font-size="7" font-weight="700" text-anchor="middle" fill="${P.slate2}" transform="rotate(8 83 34)">$14.83</text>`
      )
    },
  },

  'The Dancing Baby': {
    subject: 'a stylized flat-shaded 3D toddler mid dance move, one arm thrown up, one leg kicked out',
    draw: () => {
      const k = slug('The Dancing Baby')
      return (
        `<defs>` +
        `<radialGradient id="${k}-skin" cx="0.4" cy="0.35" r="0.75">` +
        `<stop offset="0" stop-color="${P.gold}"/><stop offset="1" stop-color="${P.amber}"/>` +
        `</radialGradient>` +
        `</defs>` +
        // Kicked leg and standing leg, drawn behind the body.
        `<path d="M68 86 L92 94" stroke="${P.gold}" stroke-width="6" stroke-linecap="round"/>` +
        `<rect x="88" y="90" width="8" height="5" rx="2" fill="${P.steel}" transform="rotate(18 92 92)"/>` +
        `<path d="M54 87 L49 105" stroke="${P.gold}" stroke-width="6" stroke-linecap="round"/>` +
        `<rect x="42" y="103" width="9" height="5" rx="2" fill="${P.steel}"/>` +
        // Torso and head.
        `<ellipse cx="60" cy="64" rx="14" ry="19" fill="url(#${k}-skin)"/>` +
        `<path d="M48 56 Q60 48 72 56" fill="none" stroke="${P.ember}" stroke-width="1.6" opacity="0.7"/>` +
        `<rect x="47" y="75" width="26" height="13" rx="6" fill="${P.paper}"/>` +
        `<circle cx="60" cy="34" r="14" fill="url(#${k}-skin)"/>` +
        `<path d="M56 24 Q60 20 64 24" fill="none" stroke="${P.ember}" stroke-width="1.6" stroke-linecap="round"/>` +
        // Arms, one raised, one out.
        `<path d="M72 56 L87 30" stroke="${P.gold}" stroke-width="5" stroke-linecap="round"/>` +
        `<circle cx="87" cy="30" r="4" fill="${P.gold}"/>` +
        `<circle cx="85" cy="28" r="1.2" fill="${P.frost}" opacity="0.8"/>` +
        `<path d="M48 58 L33 66" stroke="${P.gold}" stroke-width="5" stroke-linecap="round"/>` +
        `<circle cx="33" cy="66" r="4" fill="${P.gold}"/>` +
        // Face.
        `<circle cx="55" cy="33" r="1.7" fill="${P.ink}"/>` +
        `<circle cx="65" cy="33" r="1.7" fill="${P.ink}"/>` +
        `<circle cx="52" cy="38" r="2.4" fill="${P.ember}" opacity="0.55"/>` +
        `<circle cx="68" cy="38" r="2.4" fill="${P.ember}" opacity="0.55"/>` +
        `<path d="M55 41 Q60 46 65 41" fill="none" stroke="${P.ink}" stroke-width="1.3" stroke-linecap="round"/>` +
        // Motion lines by the kicked foot.
        `<path d="M96 84 L102 82 M97 90 L104 90 M95 96 L102 98" stroke="${P.cloud}" stroke-width="1.2" stroke-linecap="round" opacity="0.7"/>`
      )
    },
  },

  'The Hampster Dance': {
    subject: 'three small hamsters in a row, mid-kick in three different dance poses on a bright dance floor',
    draw: () => {
      const k = slug('The Hampster Dance')
      const hamster = (cx: number, cy: number, armsUp: boolean, kickLeft: boolean) =>
        `<ellipse cx="${cx}" cy="${cy}" rx="11" ry="9" fill="url(#${k}-fur)"/>` +
        `<circle cx="${cx}" cy="${cy - 10}" r="8" fill="url(#${k}-fur)"/>` +
        `<circle cx="${cx - 6}" cy="${cy - 17}" r="4" fill="${P.ember}"/>` +
        `<circle cx="${cx - 6}" cy="${cy - 17}" r="2" fill="${P.paper}"/>` +
        `<circle cx="${cx + 6}" cy="${cy - 17}" r="4" fill="${P.ember}"/>` +
        `<circle cx="${cx + 6}" cy="${cy - 17}" r="2" fill="${P.paper}"/>` +
        `<circle cx="${cx - 3}" cy="${cy - 11}" r="1.1" fill="${P.ink}"/>` +
        `<circle cx="${cx + 3}" cy="${cy - 11}" r="1.1" fill="${P.ink}"/>` +
        `<circle cx="${cx}" cy="${cy - 8}" r="0.9" fill="${P.ember2}"/>` +
        `<circle cx="${cx - 5}" cy="${cy - 6}" r="2" fill="${P.paper}" opacity="0.7"/>` +
        `<circle cx="${cx + 5}" cy="${cy - 6}" r="2" fill="${P.paper}" opacity="0.7"/>` +
        (armsUp
          ? `<path d="M${cx - 9} ${cy - 2} L${cx - 15} ${cy - 12} M${cx + 9} ${cy - 2} L${cx + 15} ${cy - 12}" stroke="${P.fur}" stroke-width="3" stroke-linecap="round"/>`
          : `<path d="M${cx - 10} ${cy} L${cx - 17} ${cy + 2} M${cx + 10} ${cy} L${cx + 17} ${cy + 2}" stroke="${P.fur}" stroke-width="3" stroke-linecap="round"/>`) +
        (kickLeft
          ? `<path d="M${cx - 6} ${cy + 8} L${cx - 14} ${cy + 14} M${cx + 6} ${cy + 8} L${cx + 6} ${cy + 16}" stroke="${P.fur}" stroke-width="3.4" stroke-linecap="round"/>`
          : `<path d="M${cx - 6} ${cy + 8} L${cx - 6} ${cy + 16} M${cx + 6} ${cy + 8} L${cx + 14} ${cy + 14}" stroke="${P.fur}" stroke-width="3.4" stroke-linecap="round"/>`)
      return (
        `<defs>` +
        `<linearGradient id="${k}-fur" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${P.fur}"/><stop offset="1" stop-color="${P.ember}"/>` +
        `</linearGradient>` +
        `<linearGradient id="${k}-floor" x1="0" y1="0" x2="1" y2="0">` +
        `<stop offset="0" stop-color="${P.magenta}"/><stop offset="1" stop-color="${P.violet}"/>` +
        `</linearGradient>` +
        `</defs>` +
        `<rect x="14" y="94" width="92" height="9" rx="4" fill="url(#${k}-floor)"/>` +
        `<rect x="14" y="94" width="92" height="3" rx="1.5" fill="${P.frost}" opacity="0.35"/>` +
        hamster(32, 74, true, true) +
        hamster(60, 70, false, false) +
        hamster(88, 74, true, false)
      )
    },
  },

  'Google is founded': {
    subject: 'a magnifying glass over a small web of connected pages, framed in an open garage doorway',
    draw: () => {
      const k = slug('Google is founded')
      return (
        `<defs>` +
        `<radialGradient id="${k}-glass" cx="0.4" cy="0.35" r="0.7">` +
        `<stop offset="0" stop-color="${P.frost}" stop-opacity="0.4"/><stop offset="1" stop-color="${P.cyan}" stop-opacity="0.15"/>` +
        `</radialGradient>` +
        `</defs>` +
        // Garage doorway, open, with a hanging bulb.
        `<path d="M18 108 L18 58 Q18 38 60 38 Q102 38 102 58 L102 108" fill="none" stroke="${P.steel}" stroke-width="3"/>` +
        `<path d="M12 108 L108 108" stroke="${P.slate}" stroke-width="2.4"/>` +
        `<path d="M60 38 L60 47" stroke="${P.slate}" stroke-width="1.2"/>` +
        `<circle cx="60" cy="50" r="4" fill="${P.amber}"/>` +
        // A small web of pages.
        `<rect x="29" y="21" width="11" height="8" rx="1.5" fill="${P.paper}"/>` +
        `<rect x="50" y="14" width="11" height="8" rx="1.5" fill="${P.paper}"/>` +
        `<rect x="70" y="20" width="11" height="8" rx="1.5" fill="${P.paper}"/>` +
        `<rect x="40" y="33" width="11" height="8" rx="1.5" fill="${P.paper}"/>` +
        `<rect x="72" y="35" width="11" height="8" rx="1.5" fill="${P.paper}"/>` +
        `<path d="M34 25 L34 25 M34 25 L36 25" stroke="${P.ink}" stroke-width="0.8"/>` +
        `<path d="M39 25 L50 18 M61 18 L70 24 M75 28 L75 35 M45 33 L55 18 M45 37 L72 39 M75 35 L80 28" stroke="${P.cloud}" stroke-width="1" opacity="0.75"/>` +
        `<path d="M33 24 L37 24 M54 17 L58 17 M74 23 L78 23 M44 36 L48 36 M76 38 L80 38" stroke="${P.ink}" stroke-width="0.9" opacity="0.7"/>` +
        // The magnifying glass, held over the cluster.
        `<circle cx="58" cy="27" r="21" fill="url(#${k}-glass)" stroke="${P.steel}" stroke-width="3.5"/>` +
        `<rect x="70" y="42" width="7" height="24" rx="3" fill="${P.slate}" transform="rotate(38 73.5 54)"/>`
      )
    },
  },

  'Napster launches': {
    subject: 'a cassette tape and musical note flowing along a dashed line between two small terminals',
    draw: () => {
      const k = slug('Napster launches')
      return (
        `<defs>` +
        `<linearGradient id="${k}-case" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${P.steel}"/><stop offset="1" stop-color="${P.slate}"/>` +
        `</linearGradient>` +
        `<radialGradient id="${k}-glow" cx="0.5" cy="0.5" r="0.6">` +
        `<stop offset="0" stop-color="${P.phosphor}" stop-opacity="0.8"/><stop offset="1" stop-color="${P.phosphor2}" stop-opacity="0"/>` +
        `</radialGradient>` +
        `</defs>` +
        // Two terminals, facing each other.
        `<rect x="8" y="52" width="30" height="24" rx="2" fill="url(#${k}-case)"/>` +
        `<rect x="12" y="56" width="22" height="14" rx="1" fill="${P.ink}"/>` +
        `<rect x="12" y="56" width="22" height="14" rx="1" fill="url(#${k}-glow)"/>` +
        `<rect x="18" y="76" width="10" height="6" fill="${P.slate2}"/>` +
        `<rect x="10" y="82" width="26" height="4" rx="1" fill="${P.slate}"/>` +
        `<rect x="82" y="52" width="30" height="24" rx="2" fill="url(#${k}-case)"/>` +
        `<rect x="86" y="56" width="22" height="14" rx="1" fill="${P.ink}"/>` +
        `<rect x="86" y="56" width="22" height="14" rx="1" fill="url(#${k}-glow)"/>` +
        `<rect x="92" y="76" width="10" height="6" fill="${P.slate2}"/>` +
        `<rect x="84" y="82" width="26" height="4" rx="1" fill="${P.slate}"/>` +
        // The link between them.
        `<path d="M40 56 Q60 28 80 56" fill="none" stroke="${P.cloud}" stroke-width="2" stroke-dasharray="4 3"/>` +
        `<path d="M44 44 L50 41 L47 47Z" fill="${P.cyan}"/>` +
        `<path d="M76 44 L70 41 L73 47Z" fill="${P.sky2}"/>` +
        // The cassette, mid-flight.
        `<rect x="48" y="27" width="24" height="15" rx="2" fill="${P.paper}" stroke="${P.slate2}" stroke-width="0.8" transform="rotate(-5 60 34)"/>` +
        `<circle cx="54" cy="34.5" r="3" fill="${P.ink}" transform="rotate(-5 60 34)"/>` +
        `<circle cx="66" cy="34.5" r="3" fill="${P.ink}" transform="rotate(-5 60 34)"/>` +
        `<circle cx="54" cy="34.5" r="1.2" fill="${P.gold}" transform="rotate(-5 60 34)"/>` +
        `<circle cx="66" cy="34.5" r="1.2" fill="${P.gold}" transform="rotate(-5 60 34)"/>` +
        `<rect x="57" y="33" width="6" height="2" fill="${P.slate2}" transform="rotate(-5 60 34)"/>` +
        // A musical note escaping it.
        `<ellipse cx="83" cy="22" rx="3.2" ry="2.3" fill="${P.gold}" transform="rotate(-18 83 22)"/>` +
        `<path d="M86 21 L86 8" stroke="${P.gold}" stroke-width="1.5" stroke-linecap="round"/>` +
        `<path d="M86 8 Q92 10 89 15" fill="none" stroke="${P.gold}" stroke-width="1.5" stroke-linecap="round"/>`
      )
    },
  },

  '“All your base are belong to us”': {
    subject: 'a blocky pixel-art speech bubble with green terminal text rows over a scanlined CRT screen fragment',
    draw: () => {
      const k = slug('“All your base are belong to us”')
      return (
        `<defs>` +
        `<linearGradient id="${k}-crt" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${P.slate2}"/><stop offset="1" stop-color="${P.ink}"/>` +
        `</linearGradient>` +
        `</defs>` +
        // A fragment of CRT screen, bottom-left, with scanlines and a cursor.
        `<rect x="8" y="76" width="42" height="30" rx="1" fill="url(#${k}-crt)" stroke="${P.slate}" stroke-width="2"/>` +
        `<path d="M12 83 L46 83 M12 89 L46 89 M12 95 L46 95 M12 101 L46 101" stroke="${P.phosphor2}" stroke-width="1" opacity="0.55"/>` +
        `<rect x="12" y="97" width="5" height="7" fill="${P.phosphor}"/>` +
        // Blocky pixel tail, stepping up to the bubble.
        `<rect x="26" y="66" width="8" height="8" fill="${P.paper}" stroke="${P.slate2}" stroke-width="1.6"/>` +
        `<rect x="19" y="59" width="8" height="8" fill="${P.paper}" stroke="${P.slate2}" stroke-width="1.6"/>` +
        `<rect x="12" y="52" width="8" height="8" fill="${P.paper}" stroke="${P.slate2}" stroke-width="1.6"/>` +
        // The speech bubble itself, square and blocky.
        `<rect x="22" y="14" width="70" height="42" fill="${P.paper}" stroke="${P.slate2}" stroke-width="2.6"/>` +
        // Abstracted rows of blocky pixel text.
        `<path d="M29 24 L47 24 M51 24 L63 24 M67 24 L83 24" stroke="${P.phosphor2}" stroke-width="4" stroke-linecap="square"/>` +
        `<path d="M29 33 L41 33 M45 33 L69 33 M73 33 L85 33" stroke="${P.phosphor2}" stroke-width="4" stroke-linecap="square"/>` +
        `<path d="M29 42 L53 42 M57 42 L79 42" stroke="${P.phosphor2}" stroke-width="4" stroke-linecap="square"/>` +
        // A blocky double exclamation, pixel-style.
        `<rect x="78" y="16" width="5" height="16" fill="${P.magenta}"/>` +
        `<rect x="78" y="35" width="5" height="6" fill="${P.magenta}"/>` +
        `<rect x="86" y="16" width="5" height="16" fill="${P.magenta}"/>` +
        `<rect x="86" y="35" width="5" height="6" fill="${P.magenta}"/>`
      )
    },
  },

  'The first Wikipedia edit': {
    subject: 'an open book with two fanned pages of ruled text, a pencil mid-stroke adding a fresh glowing line and a blinking cursor',
    draw: () => {
      const k = slug('The first Wikipedia edit')
      return (
        `<defs>` +
        `<linearGradient id="${k}-pageL" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${P.paper}"/><stop offset="1" stop-color="${P.cloud}"/>` +
        `</linearGradient>` +
        `<linearGradient id="${k}-pageR" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${P.frost}"/><stop offset="1" stop-color="${P.steel}"/>` +
        `</linearGradient>` +
        `</defs>` +
        // Open book, two pages fanned from a shared spine.
        `<path d="M60 32 L16 40 L16 94 L60 86Z" fill="url(#${k}-pageL)"/>` +
        `<path d="M60 32 L104 40 L104 94 L60 86Z" fill="url(#${k}-pageR)"/>` +
        `<path d="M60 32 L60 86" stroke="${P.slate}" stroke-width="1.4" opacity="0.6"/>` +
        // Old ruled text, left page.
        `<path d="M24 52 L52 49 M24 60 L52 57 M24 68 L52 65 M24 76 L48 73" stroke="${P.slate}" stroke-width="1.4" opacity="0.55" stroke-linecap="round"/>` +
        // Existing lines, right page, then the fresh edit glowing amber underneath the pencil.
        `<path d="M68 48 L96 51 M68 56 L96 59 M68 64 L96 67" stroke="${P.slate}" stroke-width="1.4" opacity="0.55" stroke-linecap="round"/>` +
        `<path d="M68 73 L92 76" stroke="${P.amber}" stroke-width="2.2" stroke-linecap="round"/>` +
        `<rect x="93" y="71" width="2.2" height="7" fill="${P.amber}"/>` +
        // Pencil, nib planted right at the new line, eraser cap up and away.
        `<path d="M90 46 L70 76" stroke="${P.ember2}" stroke-width="5" stroke-linecap="round"/>` +
        `<circle cx="90" cy="46" r="3.4" fill="${P.slate2}"/>` +
        `<path d="M70 76 L64 84 L74 80Z" fill="${P.ink}"/>`
      )
    },
  },

  'The Numa Numa Dance': {
    subject: 'a figure mid-twist with one arm flung up and one leg kicked out, framed inside a rounded webcam window with a lens and a recording dot',
    draw: () => {
      const k = slug('The Numa Numa Dance')
      return (
        `<defs>` +
        `<linearGradient id="${k}-shirt" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0" stop-color="${P.magenta}"/><stop offset="1" stop-color="${P.ember2}"/>` +
        `</linearGradient>` +
        `</defs>` +
        // Webcam window frame, lens, recording dot.
        `<rect x="14" y="16" width="92" height="86" rx="8" fill="none" stroke="${P.steel}" stroke-width="3"/>` +
        `<circle cx="60" cy="12" r="4" fill="${P.slate2}"/>` +
        `<circle cx="60" cy="12" r="1.6" fill="${P.cloud}"/>` +
        `<circle cx="97" cy="24" r="3" fill="${P.ember2}"/>` +
        // Motion arcs behind the figure.
        `<path d="M24 40 Q30 32 40 30" fill="none" stroke="${P.cyan}" stroke-width="1.6" opacity="0.5" stroke-linecap="round"/>` +
        `<path d="M22 50 Q28 44 38 42" fill="none" stroke="${P.cyan}" stroke-width="1.6" opacity="0.4" stroke-linecap="round"/>` +
        // Figure: head, hair, twisting torso, flung arm, kicked leg.
        `<circle cx="58" cy="46" r="9" fill="${P.gold}"/>` +
        `<path d="M52 40 Q58 33 65 39" fill="${P.slate2}"/>` +
        `<path d="M52 56 L66 58 L70 82 L58 86 L52 78Z" fill="url(#${k}-shirt)"/>` +
        `<path d="M62 58 L84 44" stroke="${P.gold}" stroke-width="5" stroke-linecap="round"/>` +
        `<path d="M55 60 L38 66" stroke="${P.gold}" stroke-width="5" stroke-linecap="round"/>` +
        `<path d="M62 82 L84 92" stroke="${P.slate2}" stroke-width="6" stroke-linecap="round"/>` +
        `<path d="M56 84 L44 100" stroke="${P.slate2}" stroke-width="6" stroke-linecap="round"/>` +
        `<circle cx="86" cy="43" r="3" fill="${P.gold}"/>` +
        `<circle cx="37" cy="67" r="3" fill="${P.gold}"/>`
      )
    },
  },

  'The first YouTube video': {
    subject: 'a small standing figure beside a big-eared elephant with a curled trunk, framed inside a video-player window with a seek bar and a corner play badge',
    draw: () => {
      const k = slug('The first YouTube video')
      return (
        `<defs>` +
        `<linearGradient id="${k}-ele" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0" stop-color="${P.cloud}"/><stop offset="1" stop-color="${P.slate}"/>` +
        `</linearGradient>` +
        `</defs>` +
        // Player chrome and seek bar.
        `<rect x="10" y="12" width="100" height="88" rx="6" fill="none" stroke="${P.steel}" stroke-width="2.4"/>` +
        `<rect x="16" y="92" width="88" height="4" rx="2" fill="${P.slate2}"/>` +
        `<rect x="16" y="92" width="40" height="4" rx="2" fill="${P.ember2}"/>` +
        `<path d="M16 88 L104 88" stroke="${P.slate2}" stroke-width="1.6" opacity="0.6"/>` +
        // Elephant: big fan ear, domed head, sloping body, curled trunk, legs, tail, eye.
        `<path d="M64 46 Q86 42 96 58 Q100 68 94 78 L66 80 Q58 72 60 58Z" fill="url(#${k}-ele)"/>` +
        `<path d="M68 46 Q56 38 48 46 Q46 58 60 60 Q56 52 68 46Z" fill="${P.slate}"/>` +
        `<path d="M63 58 Q54 62 52 72 Q52 78 58 78 Q60 72 60 66 Q62 60 63 58Z" fill="${P.cloud}"/>` +
        `<path d="M66 80 L64 90 M76 80 L76 90 M88 78 L90 90" stroke="${P.slate2}" stroke-width="3.2" stroke-linecap="round"/>` +
        `<path d="M94 66 Q100 70 96 76" fill="none" stroke="${P.slate}" stroke-width="2" stroke-linecap="round"/>` +
        `<circle cx="90" cy="54" r="1.6" fill="${P.ink}"/>` +
        // Small standing figure, watching.
        `<circle cx="30" cy="62" r="5" fill="${P.gold}"/>` +
        `<path d="M30 67 L30 80" stroke="${P.gold}" stroke-width="4" stroke-linecap="round"/>` +
        `<path d="M30 72 L23 78 M30 72 L37 76" stroke="${P.gold}" stroke-width="3" stroke-linecap="round"/>` +
        `<path d="M30 80 L25 90 M30 80 L35 90" stroke="${P.slate2}" stroke-width="3.4" stroke-linecap="round"/>` +
        // Play badge, corner, away from the subjects.
        `<circle cx="94" cy="30" r="9" fill="${P.frost}" opacity="0.9"/>` +
        `<path d="M91 25 L100 30 L91 35Z" fill="${P.slate2}"/>`
      )
    },
  },

  'The first tweet': {
    subject: 'a rounded speech bubble holding three short lines of text, a small original bird perched on its top edge',
    draw: () => {
      const k = slug('The first tweet')
      return (
        `<defs>` +
        `<linearGradient id="${k}-bubble" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${P.sky2}"/><stop offset="1" stop-color="${P.slate}"/>` +
        `</linearGradient>` +
        `</defs>` +
        // Speech bubble with a tail.
        `<path d="M20 34 Q20 24 32 24 L88 24 Q100 24 100 36 L100 66 Q100 78 88 78 L46 78 L32 92 L36 76 Q20 74 20 62Z" fill="url(#${k}-bubble)"/>` +
        // Text lines, shortest last.
        `<path d="M32 40 L84 40 M32 50 L76 50 M32 60 L68 60" stroke="${P.frost}" stroke-width="2.4" opacity="0.85" stroke-linecap="round"/>` +
        // An original bird, perched on the bubble's top edge.
        `<circle cx="82" cy="18" r="8" fill="${P.frost}"/>` +
        `<path d="M89 17 L98 15 L90 21Z" fill="${P.amber}"/>` +
        `<path d="M76 14 L70 8 L78 12Z" fill="${P.steel}"/>` +
        `<circle cx="85" cy="15" r="1.2" fill="${P.ink}"/>` +
        `<path d="M80 25 L78 30" stroke="${P.amber}" stroke-width="1.6" stroke-linecap="round"/>`
      )
    },
  },

  'The first Rickroll': {
    subject: 'a video-thumbnail frame split by a bent swap arrow, a game-controller decoy crossed out on one side and a music note bursting from the other',
    draw: () => {
      const k = slug('The first Rickroll')
      return (
        `<defs>` +
        `<radialGradient id="${k}-burst" cx="0.5" cy="0.5" r="0.6">` +
        `<stop offset="0" stop-color="${P.violet}" stop-opacity="0.9"/>` +
        `<stop offset="1" stop-color="${P.violet}" stop-opacity="0"/>` +
        `</radialGradient>` +
        `</defs>` +
        // Player frame.
        `<rect x="12" y="18" width="96" height="80" rx="6" fill="none" stroke="${P.steel}" stroke-width="2.4"/>` +
        // Decoy: a small controller, crossed out.
        `<rect x="24" y="48" width="26" height="14" rx="6" fill="${P.slate}"/>` +
        `<circle cx="30" cy="55" r="2" fill="${P.cloud}"/>` +
        `<circle cx="44" cy="55" r="2" fill="${P.cloud}"/>` +
        `<path d="M20 44 L54 66" stroke="${P.ember2}" stroke-width="2.4" stroke-linecap="round"/>` +
        // Bent swap arrow from the decoy toward the reveal.
        `<path d="M52 46 Q68 32 82 46" fill="none" stroke="${P.gold}" stroke-width="2.2" stroke-linecap="round"/>` +
        `<path d="M76 40 L82 46 L75 50Z" fill="${P.gold}"/>` +
        // Reveal: a burst behind a music note.
        `<circle cx="82" cy="62" r="20" fill="url(#${k}-burst)"/>` +
        `<circle cx="80" cy="72" r="6" fill="${P.frost}"/>` +
        `<path d="M86 72 L86 44" stroke="${P.frost}" stroke-width="2.6" stroke-linecap="round"/>` +
        `<path d="M86 44 Q95 47 92 56" fill="none" stroke="${P.frost}" stroke-width="2.6" stroke-linecap="round"/>` +
        // Play triangle, bottom centre.
        `<path d="M50 82 L72 92 L50 100Z" fill="${P.amber}"/>`
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
