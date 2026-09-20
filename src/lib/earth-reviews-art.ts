/**
 * Earth Reviews' twenty-two phenomena, drawn.
 *
 * A parody storefront whose product tiles carry an emoji, a stock photograph
 * or a generic icon is not a parody storefront — it is a list. Every product
 * on this page is a real natural phenomenon, so every one gets a real drawing:
 * the Sun with genuine limb darkening and two prominences off its own limb, a
 * mosquito with veined wings and a proboscis, a black hole with an accretion
 * disc that passes both in front of and lensed over the top of the horizon.
 *
 * Two existing contracts, both deliberately:
 *
 *  - **The cut-out contract** from `ambient-art.ts` / `auction-art.ts` /
 *    `deep-sea-art.ts`: no card box, no painted backdrop of its own, bled to
 *    the tile's own edges, and a `dominantMood` colour computed from the
 *    drawing's own fills by drawn area so a tile's glow is the thing's own
 *    colour rather than one site accent applied to twenty-two different
 *    subjects. `MOOD` below is that, precomputed.
 *  - **The id-prefixing convention** from `spend-art.ts`: every `id=` starts
 *    with that phenomenon's own key. All twenty-two inline into one document
 *    — the storefront grid shows every one of them at once — and SVG ids are
 *    global to the document, so two drawings sharing an id means one of them
 *    silently renders with the other's gradient. `check-earth-reviews.mjs`
 *    fails on an unprefixed id, a duplicate id, and a `url(#…)` naming an id
 *    the same drawing does not define.
 *
 * Authored on one 120×120 stage so tiles are interchangeable, and inlined
 * once each as an SVG `<symbol>` that both the grid and the product page
 * reference with `<use>` — the same trick `robot-scene.ts` uses to put nine
 * copies of one street on a page without nine copies of its markup. That is
 * also the reason the prefixing is load-bearing rather than tidy: the symbol
 * defines its gradients once, in a document that has twenty-one other
 * drawings' gradients in it.
 */

export type Drawing = {
  /** What it depicts, in words. For the checker's report and the next editor. */
  subject: string
  /** Every colour the drawing uses. The checker fails on any colour not listed. */
  palette: string[]
  /** Inner SVG markup on a 0 0 120 120 grid. Deterministic. */
  draw: () => string
}

export const VIEWBOX = '0 0 120 120'

/** The soft ground shadow a few of these stand on, so they sit somewhere. */
const ground = (cx: number, cy: number, rx: number, ry: number, fill: string) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" opacity="0.26"/>`

export const ART: Record<string, Drawing> = {
  /* ---- Fundamental Forces ------------------------------------------------ */

  gravity: {
    subject: 'an apple mid-fall, three fading ghosts of it above, a shadow waiting underneath',
    palette: ['#2a3340', '#c0392b', '#8e2a20', '#e8705f', '#4a7c3f', '#6b4a2f'],
    draw: () =>
      ground(60, 108, 26, 7, '#2a3340') +
      `<circle cx="60" cy="16" r="11" fill="#c0392b" opacity="0.14"/>` +
      `<circle cx="60" cy="30" r="15" fill="#c0392b" opacity="0.22"/>` +
      `<circle cx="60" cy="46" r="20" fill="#c0392b" opacity="0.38"/>` +
      `<circle cx="60" cy="72" r="27" fill="#c0392b"/>` +
      `<path d="M60 45 C74 45 87 57 87 72 C87 88 74 99 60 99 C72 92 76 82 76 72 C76 60 72 51 60 45Z" fill="#8e2a20"/>` +
      `<ellipse cx="50" cy="61" rx="8" ry="5" fill="#e8705f" opacity="0.75" transform="rotate(-28 50 61)"/>` +
      `<path d="M60 47 C59 40 59 36 61 32" fill="none" stroke="#6b4a2f" stroke-width="3.2" stroke-linecap="round"/>` +
      `<path d="M61 36 C69 30 78 32 80 38 C74 44 65 43 61 36Z" fill="#4a7c3f"/>` +
      `<path d="M63 38 C69 36 74 37 78 39" fill="none" stroke="#2a3340" stroke-width="0.9" opacity="0.4"/>`,
  },

  'static-electricity': {
    subject: 'an index finger a few millimetres from a door knob, the gap already arcing over',
    palette: ['#b9c2c9', '#7d868d', '#e6edf2', '#c8a882', '#a68765', '#8fd6ff', '#eaf7ff'],
    draw: () => {
      const sparks = [
        'M67 62 L72 58 L70 62 L76 57',
        'M67 62 L73 63 L70 65 L78 66',
        'M67 62 L72 68 L69 68 L75 75',
        'M67 62 L71 54 L70 58 L74 49',
        'M67 62 L69 72 L67 71 L68 83',
        'M67 62 L68 50 L67 54 L66 41',
        'M67 62 L76 62 L73 65 L84 64',
        'M67 62 L74 69 L70 69 L79 78',
      ]
      return (
        // The halo at the contact point, and the reason this tile glows the
        // colour of the spark rather than the colour of the door furniture:
        // the sparks themselves are stroked, and a stroke has no fill area for
        // dominantMood to weigh.
        `<ellipse cx="68" cy="62" rx="42" ry="36" fill="#8fd6ff" opacity="0.1"/>` +
        `<rect x="96" y="2" width="24" height="116" fill="#b9c2c9"/>` +
        `<rect x="96" y="2" width="6" height="116" fill="#e6edf2" opacity="0.5"/>` +
        `<rect x="114" y="2" width="6" height="116" fill="#7d868d" opacity="0.6"/>` +
        `<rect x="84" y="44" width="14" height="34" rx="4" fill="#7d868d"/>` +
        `<circle cx="84" cy="61" r="13" fill="#b9c2c9"/>` +
        `<circle cx="84" cy="61" r="13" fill="none" stroke="#7d868d" stroke-width="1.6" opacity="0.7"/>` +
        `<ellipse cx="79" cy="56" rx="4.5" ry="3.4" fill="#e6edf2" opacity="0.85" transform="rotate(-25 79 56)"/>` +
        `<path d="M0 94 L0 60 C0 55 5 52 12 52 L32 55 L32 94Z" fill="#c8a882"/>` +
        `<ellipse cx="38" cy="72" rx="17" ry="16" fill="#c8a882"/>` +
        `<path d="M38 56 C48 56 55 63 55 72 C55 81 48 88 38 88 C47 83 50 78 50 72 C50 65 47 60 38 56Z" fill="#a68765"/>` +
        `<rect x="44" y="57" width="16" height="10" rx="5" fill="#c8a882"/>` +
        `<circle cx="62" cy="62" r="5" fill="#c8a882"/>` +
        `<path d="M44 66 L58 66" fill="none" stroke="#a68765" stroke-width="1.1" opacity="0.5"/>` +
        `<path d="M30 64 C36 61 42 61 47 63 M30 73 C36 70 42 70 46 72 M31 82 C36 79 42 79 46 80" fill="none" stroke="#a68765" stroke-width="1.4" opacity="0.7"/>` +
        sparks
          .map(
            (d, i) =>
              `<path d="${d}" fill="none" stroke="${i % 3 === 0 ? '#eaf7ff' : '#8fd6ff'}" stroke-width="${
                i % 3 === 0 ? 2.2 : 1.5
              }" stroke-linecap="round" stroke-linejoin="round" opacity="${0.55 + (i % 4) * 0.12}"/>`,
          )
          .join('') +
        `<circle cx="67" cy="62" r="3.6" fill="#eaf7ff"/>` +
        `<circle cx="67" cy="62" r="8" fill="#8fd6ff" opacity="0.3"/>`
      )
    },
  },

  lightning: {
    subject: 'a forked bolt with a white core stepping out of a low cloud, ground lit underneath',
    palette: ['#2a3140', '#1b2029', '#a9b6c9', '#ffd23f', '#fff3b0'],
    draw: () =>
      `<ellipse cx="60" cy="72" rx="32" ry="44" fill="#ffd23f" opacity="0.1"/>` +
      `<circle cx="32" cy="32" r="14" fill="#2a3140"/>` +
      `<circle cx="52" cy="24" r="19" fill="#2a3140"/>` +
      `<circle cx="76" cy="30" r="16" fill="#2a3140"/>` +
      `<circle cx="94" cy="36" r="10" fill="#2a3140"/>` +
      `<rect x="20" y="32" width="86" height="14" rx="7" fill="#2a3140"/>` +
      `<path d="M20 40 C34 36 48 34 62 36 C78 38 92 42 106 42 L106 46 L20 46Z" fill="#1b2029"/>` +
      `<path d="M38 20 C46 9 62 8 70 17" fill="none" stroke="#a9b6c9" stroke-width="3" stroke-linecap="round" opacity="0.4"/>` +
      `<path d="M78 23 C84 18 90 20 94 27" fill="none" stroke="#a9b6c9" stroke-width="2.4" stroke-linecap="round" opacity="0.28"/>` +
      `<path d="M22 30 C26 21 34 19 40 23" fill="none" stroke="#a9b6c9" stroke-width="2.2" stroke-linecap="round" opacity="0.25"/>` +
      `<path d="M60 44 L44 76 L57 76 L46 106 L78 68 L63 68 L76 44Z" fill="#ffd23f"/>` +
      `<path d="M60 47 L50 73 L59 73 L52 96 L72 69 L61 69 L71 47Z" fill="#fff3b0"/>` +
      `<path d="M66 60 L82 52" fill="none" stroke="#ffd23f" stroke-width="2.4" stroke-linecap="round" opacity="0.8"/>` +
      `<path d="M55 84 L40 92" fill="none" stroke="#ffd23f" stroke-width="2" stroke-linecap="round" opacity="0.65"/>` +
      `<ellipse cx="50" cy="110" rx="34" ry="6" fill="#ffd23f" opacity="0.22"/>`,
  },

  /* ---- Celestial Bodies -------------------------------------------------- */

  'the-sun': {
    subject: 'a G-type disc with real limb darkening, granulation, and two prominences off the limb',
    palette: ['#ff7a1f', '#ffb43a', '#ff9a2a', '#fff3c4', '#ff4e11', '#ffd98a'],
    draw: () => {
      const defs =
        `<defs><radialGradient id="the-sun-limb" cx="42%" cy="38%" r="68%">` +
        `<stop offset="0%" stop-color="#fff3c4" stop-opacity="0.9"/>` +
        `<stop offset="55%" stop-color="#ffb43a" stop-opacity="0.18"/>` +
        `<stop offset="100%" stop-color="#ff4e11" stop-opacity="0.72"/>` +
        `</radialGradient></defs>`
      const granules = [
        [48, 46, 5.5], [66, 42, 4], [74, 58, 6], [52, 68, 5], [40, 58, 3.6],
        [62, 74, 4.4], [78, 46, 3.2], [58, 56, 7], [44, 76, 3.4], [70, 70, 3],
      ]
        .map(
          ([x, y, r], i) =>
            `<circle cx="${x}" cy="${y}" r="${r}" fill="${i % 3 === 0 ? '#ffd98a' : '#ff9a2a'}" opacity="${
              i % 3 === 0 ? 0.42 : 0.55
            }"/>`,
        )
        .join('')
      return (
        defs +
        `<circle cx="60" cy="60" r="54" fill="#ff7a1f" opacity="0.1"/>` +
        `<circle cx="60" cy="60" r="44" fill="#ff7a1f" opacity="0.16"/>` +
        `<path d="M94 34 C104 26 112 30 114 40 C108 36 102 37 97 42Z" fill="#ff4e11"/>` +
        `<path d="M24 78 C14 84 10 94 16 102 C18 92 24 87 32 85Z" fill="#ff4e11"/>` +
        `<circle cx="60" cy="60" r="35" fill="#ffb43a"/>` +
        granules +
        `<circle cx="60" cy="60" r="35" fill="url(#the-sun-limb)"/>` +
        `<path d="M92 40 C99 34 106 36 108 43" fill="none" stroke="#ff4e11" stroke-width="2.6" stroke-linecap="round" opacity="0.85"/>` +
        `<circle cx="60" cy="60" r="35" fill="none" stroke="#ff4e11" stroke-width="1.6" opacity="0.5"/>`
      )
    },
  },

  'the-moon': {
    subject: 'a waning gibbous with real maria, three craters lit from the right, a soft terminator',
    palette: ['#d8d4c8', '#a8a394', '#8d8878', '#f2efe6', '#5e5a4e'],
    draw: () => {
      const crater = (cx: number, cy: number, r: number) =>
        `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#8d8878" opacity="0.7"/>` +
        `<path d="M${cx - r} ${cy} A${r} ${r} 0 0 1 ${cx + r} ${cy}" fill="none" stroke="#f2efe6" stroke-width="${
          r * 0.32
        }" opacity="0.55"/>` +
        `<circle cx="${cx}" cy="${cy + r * 0.2}" r="${r * 0.6}" fill="#5e5a4e" opacity="0.35"/>`
      return (
        `<circle cx="58" cy="60" r="46" fill="#d8d4c8" opacity="0.08"/>` +
        `<circle cx="58" cy="60" r="40" fill="#d8d4c8"/>` +
        `<path d="M58 20 A40 40 0 0 0 58 100 C36 92 26 76 26 60 C26 44 36 28 58 20Z" fill="#8d8878" opacity="0.5"/>` +
        `<ellipse cx="48" cy="46" rx="15" ry="11" fill="#a8a394" transform="rotate(-18 48 46)"/>` +
        `<ellipse cx="72" cy="66" rx="12" ry="9" fill="#a8a394" transform="rotate(14 72 66)"/>` +
        `<ellipse cx="56" cy="80" rx="9" ry="6" fill="#a8a394" opacity="0.85"/>` +
        crater(78, 42, 8) +
        crater(64, 92, 5.5) +
        crater(40, 70, 6.5) +
        crater(86, 76, 4) +
        `<circle cx="58" cy="60" r="40" fill="none" stroke="#f2efe6" stroke-width="1.2" opacity="0.32"/>`
      )
    },
  },

  'black-holes': {
    subject: 'an event horizon with a photon ring, its accretion disc in front and lensed over the top',
    palette: ['#0b0a12', '#ff9a3c', '#ffd88a', '#c76aff', '#6b3fb0'],
    draw: () => {
      const defs =
        `<defs><linearGradient id="black-holes-disc" x1="0" y1="0" x2="1" y2="0">` +
        `<stop offset="0%" stop-color="#6b3fb0"/><stop offset="30%" stop-color="#ff9a3c"/>` +
        `<stop offset="55%" stop-color="#ffd88a"/><stop offset="100%" stop-color="#c76aff"/>` +
        `</linearGradient></defs>`
      return (
        defs +
        `<ellipse cx="60" cy="62" rx="56" ry="15" fill="#ff9a3c" opacity="0.16"/>` +
        `<path d="M8 56 C8 26 30 12 60 12 C90 12 112 26 112 56 C104 34 84 24 60 24 C36 24 16 34 8 56Z" fill="#ff9a3c" opacity="0.8"/>` +
        `<path d="M14 52 C16 30 34 19 60 19 C86 19 104 30 106 52 C98 36 82 29 60 29 C38 29 22 36 14 52Z" fill="#ffd88a" opacity="0.7"/>` +
        `<circle cx="60" cy="58" r="26" fill="#0b0a12"/>` +
        `<circle cx="60" cy="58" r="27.5" fill="none" stroke="#ffd88a" stroke-width="2.2" opacity="0.9"/>` +
        `<circle cx="60" cy="58" r="31" fill="none" stroke="#ff9a3c" stroke-width="1.1" opacity="0.45"/>` +
        `<path d="M4 66 C4 78 28 88 60 88 C92 88 116 78 116 66 C116 74 92 82 60 82 C28 82 4 74 4 66Z" fill="url(#black-holes-disc)"/>` +
        `<ellipse cx="60" cy="66" rx="56" ry="12" fill="none" stroke="#c76aff" stroke-width="1.4" opacity="0.5"/>` +
        `<circle cx="22" cy="30" r="1.6" fill="#ffd88a" opacity="0.6"/>` +
        `<circle cx="100" cy="96" r="1.4" fill="#c76aff" opacity="0.55"/>`
      )
    },
  },

  /* ---- Seasonal, Terrain, Water ------------------------------------------ */

  winter: {
    subject: 'a bare tree loaded with snow standing in a drift, flakes crossing in front of it',
    palette: ['#dbe9f5', '#f2f7fb', '#6b5a48', '#4a3d31', '#8fa9bd', '#c9dae8'],
    draw: () =>
      `<ellipse cx="60" cy="106" rx="56" ry="16" fill="#dbe9f5"/>` +
      `<ellipse cx="26" cy="112" rx="26" ry="10" fill="#c9dae8" opacity="0.8"/>` +
      `<path d="M55 104 L57 56 L63 56 L65 104Z" fill="#6b5a48"/>` +
      `<path d="M61 104 L63 56 L65 56 L65 104Z" fill="#4a3d31"/>` +
      `<path d="M59 60 L38 40 M59 68 L42 56 M61 58 L82 36 M61 70 L80 54 M60 50 L60 30 M59 46 L46 30 M61 46 L74 28" fill="none" stroke="#6b5a48" stroke-width="3.4" stroke-linecap="round"/>` +
      `<path d="M52 44 L38 38 M53 62 L43 55 M68 44 L81 34 M68 64 L79 53 M60 36 L60 28" fill="none" stroke="#4a3d31" stroke-width="1.6" stroke-linecap="round" opacity="0.6"/>` +
      `<ellipse cx="39" cy="38" rx="7" ry="3" fill="#f2f7fb" transform="rotate(-18 39 38)"/>` +
      `<ellipse cx="80" cy="35" rx="7" ry="3" fill="#f2f7fb" transform="rotate(16 80 35)"/>` +
      `<ellipse cx="60" cy="28" rx="6" ry="2.8" fill="#f2f7fb"/>` +
      `<ellipse cx="44" cy="55" rx="5.5" ry="2.6" fill="#f2f7fb" transform="rotate(-14 44 55)"/>` +
      `<ellipse cx="78" cy="53" rx="5" ry="2.4" fill="#f2f7fb" transform="rotate(12 78 53)"/>` +
      `<circle cx="20" cy="26" r="2.4" fill="#f2f7fb" opacity="0.85"/>` +
      `<circle cx="100" cy="60" r="2" fill="#f2f7fb" opacity="0.7"/>` +
      `<circle cx="30" cy="76" r="1.8" fill="#8fa9bd" opacity="0.8"/>` +
      `<circle cx="96" cy="20" r="1.6" fill="#8fa9bd" opacity="0.65"/>`,
  },

  deserts: {
    subject: 'three dune ridges with wind ripples, a lit face and a shadow face, one weathered rock',
    palette: ['#e3b877', '#c2914f', '#f2d7a3', '#8a6a3f', '#6b5130', '#a87a3f'],
    draw: () =>
      `<ellipse cx="34" cy="112" rx="56" ry="30" fill="#e3b877"/>` +
      `<ellipse cx="98" cy="104" rx="42" ry="24" fill="#c2914f"/>` +
      `<path d="M0 94 C22 74 44 72 62 86 C48 82 30 86 14 100Z" fill="#f2d7a3" opacity="0.9"/>` +
      `<path d="M58 88 C74 74 96 72 120 84 L120 94 C100 82 78 84 62 94Z" fill="#c2914f"/>` +
      `<path d="M62 86 C80 76 100 76 120 84" fill="none" stroke="#f2d7a3" stroke-width="2.4" opacity="0.8"/>` +
      `<path d="M8 104 C24 98 40 98 54 102 M18 112 C34 106 50 106 64 110 M74 98 C88 94 102 96 114 100" fill="none" stroke="#a87a3f" stroke-width="1.5" opacity="0.5"/>` +
      `<path d="M78 90 L84 72 L94 68 L102 80 L98 92Z" fill="#8a6a3f"/>` +
      `<path d="M94 68 L102 80 L98 92 L94 88Z" fill="#6b5130"/>` +
      `<path d="M80 80 L92 74 M84 86 L98 82" fill="none" stroke="#6b5130" stroke-width="1.2" opacity="0.7"/>`,
  },

  quicksand: {
    subject: 'a wellington going down at an angle, toe already under, the surface slumping in after it',
    palette: ['#9a917a', '#7d7461', '#bdb49b', '#4a3b2c', '#2e251b', '#6b6353'],
    draw: () =>
      // The sand is drawn in two passes with the boot between them, so the
      // lower half of the boot is genuinely behind the surface rather than
      // sitting on top of a drawing of one.
      `<ellipse cx="60" cy="82" rx="58" ry="24" fill="#9a917a"/>` +
      `<ellipse cx="62" cy="78" rx="32" ry="13" fill="#7d7461"/>` +
      `<ellipse cx="62" cy="77" rx="19" ry="8" fill="#6b6353"/>` +
      `<g transform="rotate(-20 58 50)">` +
      `<path d="M44 14 L72 14 C76 32 75 48 74 58 L88 66 C93 68 94 75 90 79 L42 79 C38 62 38 30 44 14Z" fill="#4a3b2c"/>` +
      `<path d="M62 14 L72 14 C76 32 75 48 74 58 L88 66 C93 68 94 75 90 79 L62 79Z" fill="#2e251b"/>` +
      `<rect x="41" y="15" width="32" height="9" rx="3" fill="#2e251b"/>` +
      `<ellipse cx="57" cy="17" rx="16" ry="4.5" fill="#2e251b"/>` +
      `<path d="M42 70 L91 75" fill="none" stroke="#bdb49b" stroke-width="2.4" opacity="0.45"/>` +
      `<path d="M46 36 C54 33 64 33 72 36" fill="none" stroke="#2e251b" stroke-width="2" opacity="0.8"/>` +
      `</g>` +
      `<ellipse cx="60" cy="96" rx="58" ry="18" fill="#9a917a"/>` +
      `<ellipse cx="60" cy="84" rx="46" ry="21" fill="none" stroke="#bdb49b" stroke-width="1.6" opacity="0.6"/>` +
      `<ellipse cx="60" cy="83" rx="30" ry="13" fill="none" stroke="#bdb49b" stroke-width="1.4" opacity="0.45"/>` +
      `<path d="M8 94 C26 90 44 90 58 93 M72 96 C86 92 100 92 112 94" fill="none" stroke="#bdb49b" stroke-width="1.3" opacity="0.4"/>` +
      `<circle cx="26" cy="76" r="2" fill="#bdb49b" opacity="0.7"/>` +
      `<circle cx="98" cy="80" r="1.7" fill="#bdb49b" opacity="0.6"/>`,
  },

  'the-ocean': {
    subject: 'a wave at the moment the lip throws over, foam cells on the face, spray off the crest',
    palette: ['#11556b', '#1c7d96', '#4fb3c9', '#eaf6f8', '#bfe2ea', '#0a3d4e'],
    draw: () =>
      `<ellipse cx="60" cy="108" rx="60" ry="22" fill="#11556b"/>` +
      `<path d="M0 86 C18 84 30 76 44 60 C58 42 76 32 96 36 C112 39 120 50 120 62 L120 96 C90 90 40 92 0 100Z" fill="#1c7d96"/>` +
      `<path d="M44 60 C58 42 76 32 96 36 C108 39 114 48 114 58 C108 46 94 42 82 46 C68 51 58 62 50 74 C46 70 44 65 44 60Z" fill="#4fb3c9"/>` +
      `<path d="M96 36 C112 39 120 50 120 62 C114 52 104 46 92 46 C78 46 66 55 58 68 C62 52 78 33 96 36Z" fill="#eaf6f8" opacity="0.92"/>` +
      `<path d="M0 88 C16 86 28 80 40 68 C34 82 20 92 0 96Z" fill="#eaf6f8" opacity="0.65"/>` +
      `<circle cx="104" cy="44" r="4" fill="#eaf6f8" opacity="0.85"/>` +
      `<circle cx="112" cy="52" r="2.6" fill="#eaf6f8" opacity="0.7"/>` +
      `<circle cx="96" cy="38" r="2.2" fill="#eaf6f8" opacity="0.75"/>` +
      `<circle cx="86" cy="24" r="2.8" fill="#bfe2ea" opacity="0.7"/>` +
      `<circle cx="100" cy="18" r="2" fill="#bfe2ea" opacity="0.6"/>` +
      `<circle cx="72" cy="20" r="1.7" fill="#bfe2ea" opacity="0.55"/>` +
      `<path d="M10 100 C34 94 74 92 118 98" fill="none" stroke="#0a3d4e" stroke-width="2" opacity="0.4"/>`,
  },

  /* ---- Geology ----------------------------------------------------------- */

  volcanoes: {
    subject: 'an ash plume standing off a layered cone, one lava flow reaching the flank, a lit crater',
    palette: ['#ff6b1f', '#ffd05a', '#4a4038', '#2f2926', '#6b5e50', '#9aa0a6'],
    draw: () =>
      `<circle cx="58" cy="26" r="17" fill="#9aa0a6" opacity="0.4"/>` +
      `<circle cx="72" cy="20" r="12" fill="#9aa0a6" opacity="0.32"/>` +
      `<circle cx="46" cy="18" r="10" fill="#9aa0a6" opacity="0.28"/>` +
      `<path d="M52 44 C48 34 50 24 58 14 C62 26 66 32 70 42Z" fill="#9aa0a6" opacity="0.45"/>` +
      // The eruption glow over the summit — also what makes this tile glow
      // lava orange rather than ash grey, since the plume is the largest
      // thing in the frame by area and would otherwise decide it.
      `<ellipse cx="60" cy="56" rx="36" ry="24" fill="#ff6b1f" opacity="0.17"/>` +
      `<path d="M8 108 L46 46 L74 46 L112 108Z" fill="#4a4038"/>` +
      `<path d="M60 46 L74 46 L112 108 L66 108Z" fill="#2f2926"/>` +
      `<path d="M8 108 L46 46 L52 46 L26 108Z" fill="#6b5e50" opacity="0.7"/>` +
      `<path d="M46 46 L74 46 L69 54 L51 54Z" fill="#ff6b1f"/>` +
      `<ellipse cx="60" cy="48" rx="13" ry="4.5" fill="#ffd05a"/>` +
      `<path d="M56 50 C52 66 58 80 50 108 L62 108 C66 82 62 66 66 50Z" fill="#ff6b1f"/>` +
      `<path d="M58 52 C55 66 59 80 54 106 L60 106 C63 82 60 66 63 52Z" fill="#ffd05a" opacity="0.85"/>` +
      `<path d="M70 52 C78 62 80 76 86 92" fill="none" stroke="#ff6b1f" stroke-width="3.2" stroke-linecap="round" opacity="0.8"/>` +
      `<path d="M62 36 C66 28 62 24 60 20" fill="none" stroke="#ff6b1f" stroke-width="2" stroke-linecap="round" opacity="0.55"/>` +
      `<circle cx="84" cy="34" r="2.4" fill="#ff6b1f" opacity="0.8"/>` +
      `<circle cx="38" cy="40" r="1.8" fill="#ffd05a" opacity="0.7"/>`,
  },

  earthquakes: {
    subject: 'two ground slabs thrown out of register by a fissure, soil layers showing in the cut',
    palette: ['#7a6a55', '#5a4d3d', '#9c8a70', '#3a3229', '#c7b9a0', '#463c30'],
    draw: () =>
      // Each slab is a plain rectangular body plus the path that carries its
      // torn edge. Identical on screen to one path, and it gives the soil a
      // real area so the tile glows soil-brown rather than topsoil-pale.
      `<rect x="0" y="54" width="50" height="50" fill="#7a6a55"/>` +
      `<rect x="74" y="66" width="46" height="46" fill="#7a6a55"/>` +
      `<path d="M0 54 L52 54 L58 70 L50 86 L56 104 L0 104Z" fill="#7a6a55"/>` +
      `<path d="M66 66 L120 66 L120 112 L62 112 L70 96 L62 80Z" fill="#7a6a55"/>` +
      `<path d="M0 54 L52 54 L54 62 L0 62Z" fill="#9c8a70"/>` +
      `<path d="M66 66 L120 66 L120 74 L68 74Z" fill="#9c8a70"/>` +
      `<path d="M0 74 L53 74 M0 90 L52 90 M68 86 L120 86 M64 100 L120 100" fill="none" stroke="#5a4d3d" stroke-width="2" opacity="0.65"/>` +
      `<path d="M52 54 L58 70 L50 86 L56 104 L62 112 L70 96 L62 80 L66 66 L60 54Z" fill="#3a3229"/>` +
      `<path d="M54 58 L60 72 L52 86 L58 102" fill="none" stroke="#463c30" stroke-width="1.6" opacity="0.8"/>` +
      `<circle cx="34" cy="46" r="4" fill="#c7b9a0"/>` +
      `<circle cx="46" cy="44" r="2.6" fill="#9c8a70"/>` +
      `<circle cx="80" cy="58" r="3.4" fill="#c7b9a0"/>` +
      `<circle cx="92" cy="60" r="2.2" fill="#9c8a70"/>` +
      `<path d="M22 46 L30 40 L38 46" fill="none" stroke="#c7b9a0" stroke-width="1.4" opacity="0.6"/>`,
  },

  /* ---- Wildlife and the body --------------------------------------------- */

  mosquitoes: {
    subject: 'a mosquito in profile, two veined wings over a banded abdomen, six legs and the proboscis down',
    palette: ['#3f3a33', '#231f1b', '#cfd8dc', '#7a5340', '#b9a88f', '#8e5a4a', '#8d8175', '#eef3f5'],
    draw: () =>
      // The legs are drawn in a pale grey rather than the body's near-black:
      // six hairlines in ink-on-ink vanished completely against a dark card,
      // and the legs are most of what makes the silhouette read as an insect.
      `<path d="M44 38 C56 25 78 23 98 33 C82 40 60 42 46 44Z" fill="#cfd8dc" opacity="0.5"/>` +
      `<path d="M46 44 C60 33 82 33 102 46 C86 50 62 50 48 50Z" fill="#cfd8dc" opacity="0.34"/>` +
      `<path d="M47 40 C63 31 81 30 95 36 M49 45 C65 39 83 40 97 47" fill="none" stroke="#eef3f5" stroke-width="0.9" opacity="0.6"/>` +
      `<path d="M40 56 L22 76 L14 88 M45 58 L34 84 L30 98 M50 58 L50 86 L55 100 M56 56 L72 78 L81 90 M60 54 L84 70 L95 76 M58 52 L90 60 L104 60" fill="none" stroke="#8d8175" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<ellipse cx="68" cy="55" rx="26" ry="8" fill="#7a5340" transform="rotate(16 68 55)"/>` +
      `<ellipse cx="93" cy="62" rx="8" ry="4.6" fill="#7a5340" transform="rotate(16 93 62)"/>` +
      `<path d="M58 52 L61 61 M66 55 L69 64 M74 58 L77 66 M82 61 L85 69" fill="none" stroke="#8e5a4a" stroke-width="1.8" opacity="0.9"/>` +
      `<ellipse cx="42" cy="48" rx="13" ry="11" fill="#3f3a33"/>` +
      `<circle cx="28" cy="46" r="8.5" fill="#3f3a33"/>` +
      `<circle cx="25" cy="44" r="5" fill="#231f1b"/>` +
      `<circle cx="23.4" cy="42.4" r="1.6" fill="#b9a88f" opacity="0.85"/>` +
      `<path d="M24 53 L20 98" fill="none" stroke="#231f1b" stroke-width="3" stroke-linecap="round"/>` +
      `<path d="M24 53 L20 98" fill="none" stroke="#8d8175" stroke-width="1.1" stroke-linecap="round" opacity="0.65"/>` +
      `<path d="M22 38 L8 24 M27 36 L18 19" fill="none" stroke="#8d8175" stroke-width="1.4" stroke-linecap="round"/>`,
  },

  hiccups: {
    subject: 'the folk cure — a tumbler of water and a spoon of sugar — with the spasm arcing over it',
    palette: ['#bcd8e8', '#8fbcd6', '#e8f4fa', '#c3ccd4', '#f0e6d2', '#e05a3a'],
    draw: () =>
      `<rect x="40" y="56" width="38" height="44" fill="#bcd8e8"/>` +
      `<path d="M36 40 L82 40 L78 102 C68 106 50 106 40 102Z" fill="#e8f4fa" opacity="0.28"/>` +
      `<path d="M36 40 L82 40 L78 102 C68 106 50 106 40 102Z" fill="none" stroke="#e8f4fa" stroke-width="2.6"/>` +
      `<ellipse cx="59" cy="56" rx="21" ry="5" fill="#8fbcd6"/>` +
      `<ellipse cx="59" cy="56" rx="21" ry="5" fill="none" stroke="#e8f4fa" stroke-width="1.4" opacity="0.8"/>` +
      `<path d="M44 68 C50 64 56 70 62 66 M46 82 C52 78 58 84 64 80" fill="none" stroke="#8fbcd6" stroke-width="1.8" opacity="0.7"/>` +
      `<path d="M44 44 L48 98" fill="none" stroke="#e8f4fa" stroke-width="3" opacity="0.5"/>` +
      `<path d="M86 34 L98 74" fill="none" stroke="#c3ccd4" stroke-width="3.4" stroke-linecap="round"/>` +
      `<ellipse cx="84" cy="28" rx="9" ry="6.5" fill="#c3ccd4" transform="rotate(-16 84 28)"/>` +
      `<ellipse cx="84" cy="27" rx="6" ry="4" fill="#f0e6d2" transform="rotate(-16 84 27)"/>` +
      `<rect x="80" y="20" width="2.6" height="2.6" fill="#f0e6d2" transform="rotate(20 81 21)"/>` +
      `<rect x="88" y="22" width="2.2" height="2.2" fill="#f0e6d2" transform="rotate(-14 89 23)"/>` +
      `<path d="M14 40 L24 22 L22 34 L34 18" fill="none" stroke="#e05a3a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<path d="M16 58 L26 48" fill="none" stroke="#e05a3a" stroke-width="2.4" stroke-linecap="round" opacity="0.7"/>`,
  },

  allergies: {
    subject: 'a dandelion clock coming apart, seeds drifting off it, pollen loose in the air',
    palette: ['#e6eddc', '#c9d6b8', '#7a9c56', '#5c7a3e', '#e8d46a', '#f5f9f0'],
    draw: () => {
      const seeds = Array.from({ length: 16 }, (_, i) => {
        const a = (i / 16) * Math.PI * 2
        const x = 48 + Math.cos(a) * 24
        const y = 44 + Math.sin(a) * 24
        return (
          `<path d="M48 44 L${x.toFixed(1)} ${y.toFixed(1)}" stroke="#c9d6b8" stroke-width="0.9" opacity="0.8"/>` +
          `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.6" fill="#f5f9f0" opacity="0.85"/>`
        )
      }).join('')
      const drift = (x: number, y: number, s: number, o: number) =>
        `<path d="M${x} ${y} L${x + s} ${y + s * 0.8}" stroke="#c9d6b8" stroke-width="0.9" opacity="${o}"/>` +
        `<circle cx="${x}" cy="${y}" r="${s * 0.5}" fill="#f5f9f0" opacity="${o}"/>` +
        `<path d="M${x - s * 0.6} ${y - s * 0.5} L${x} ${y} L${x + s * 0.6} ${y - s * 0.5}" fill="none" stroke="#e6eddc" stroke-width="0.9" opacity="${o}"/>`
      return (
        `<circle cx="48" cy="44" r="27" fill="#e6eddc" opacity="0.22"/>` +
        seeds +
        `<circle cx="48" cy="44" r="4.5" fill="#c9d6b8"/>` +
        `<path d="M48 48 C50 66 46 84 52 112" fill="none" stroke="#7a9c56" stroke-width="3.4" stroke-linecap="round"/>` +
        `<path d="M50 74 C62 68 72 72 78 82 C66 84 56 82 50 76Z" fill="#5c7a3e"/>` +
        `<path d="M49 92 C38 88 30 92 26 100 C36 102 45 99 49 94Z" fill="#7a9c56"/>` +
        drift(86, 26, 5, 0.9) +
        drift(100, 52, 4, 0.75) +
        drift(92, 82, 3.4, 0.6) +
        `<circle cx="78" cy="40" r="2.4" fill="#e8d46a" opacity="0.9"/>` +
        `<circle cx="96" cy="36" r="1.8" fill="#e8d46a" opacity="0.8"/>` +
        `<circle cx="84" cy="62" r="2" fill="#e8d46a" opacity="0.75"/>` +
        `<circle cx="106" cy="70" r="1.6" fill="#e8d46a" opacity="0.65"/>` +
        `<circle cx="70" cy="96" r="1.8" fill="#e8d46a" opacity="0.6"/>`
      )
    },
  },

  'growing-old': {
    subject: 'a sawn log end, one growth ring per year, bark on the rim and a heart check opening up',
    palette: ['#d9b98a', '#c09a65', '#5c4230', '#8a6a4a', '#b99a6a', '#a6814e'],
    draw: () => {
      const rings = [36, 31, 26.5, 22.5, 19, 15.5, 12.5, 9.5, 7, 4.5]
        .map(
          (r, i) =>
            `<ellipse cx="58" cy="60" rx="${r + 4}" ry="${r}" fill="none" stroke="${
              i % 2 ? '#c09a65' : '#a6814e'
            }" stroke-width="${i < 3 ? 2.2 : 1.5}" opacity="${0.55 + i * 0.03}"/>`,
        )
        .join('')
      return (
        `<path d="M14 66 C14 86 34 98 58 98 C82 98 102 86 102 66 L102 80 C102 100 82 112 58 112 C34 112 14 100 14 80Z" fill="#8a6a4a"/>` +
        `<path d="M14 66 C14 86 34 98 58 98 L58 112 C34 112 14 100 14 80Z" fill="#5c4230" opacity="0.5"/>` +
        `<ellipse cx="58" cy="61" rx="42" ry="30" fill="#d9b98a"/>` +
        `<ellipse cx="58" cy="61" rx="43" ry="31.5" fill="none" stroke="#5c4230" stroke-width="6"/>` +
        rings +
        `<ellipse cx="58" cy="60" rx="3" ry="2.2" fill="#8a6a4a"/>` +
        `<path d="M58 60 L86 44 M58 60 L44 34 M58 60 L36 76" fill="none" stroke="#8a6a4a" stroke-width="2" stroke-linecap="round" opacity="0.8"/>` +
        `<path d="M22 54 C34 44 46 40 58 40" fill="none" stroke="#b99a6a" stroke-width="1.6" opacity="0.45"/>`
      )
    },
  },

  /* ---- Scheduling, thermodynamics, the end ------------------------------- */

  mondays: {
    subject: 'a red desk-calendar holder, one page torn half off, the first column of the week ringed',
    palette: ['#b3392f', '#8c2a22', '#f4efe4', '#d9d2c2', '#3a3a42', '#d94f3d'],
    draw: () => {
      const grid = Array.from({ length: 20 }, (_, i) => {
        const c = i % 5
        const r = Math.floor(i / 5)
        const x = 32 + c * 12
        const y = 58 + r * 11
        return `<rect x="${x}" y="${y}" width="8" height="7" rx="1.5" fill="#3a3a42" opacity="${
          c === 0 ? 0.9 : 0.3
        }"/>`
      }).join('')
      return (
        `<rect x="14" y="20" width="92" height="88" rx="6" fill="#b3392f"/>` +
        `<rect x="14" y="20" width="92" height="18" rx="6" fill="#8c2a22"/>` +
        `<rect x="22" y="38" width="76" height="66" rx="3" fill="#f4efe4"/>` +
        `<rect x="22" y="38" width="76" height="10" fill="#d9d2c2"/>` +
        grid +
        `<ellipse cx="36" cy="61.5" rx="9" ry="7" fill="none" stroke="#d94f3d" stroke-width="2.6"/>` +
        `<path d="M22 96 C40 102 62 100 98 92 L98 104 C62 110 40 108 22 104Z" fill="#d9d2c2"/>` +
        `<path d="M32 14 L32 26 M52 14 L52 26 M68 14 L68 26 M88 14 L88 26" fill="none" stroke="#d9d2c2" stroke-width="3.4" stroke-linecap="round"/>` +
        `<rect x="22" y="43" width="76" height="1.6" fill="#3a3a42" opacity="0.25"/>`
      )
    },
  },

  time: {
    subject: 'an hourglass on its posts, the upper bulb half gone, a stream landing on a cone below',
    palette: ['#8a6a44', '#6b5133', '#dfe8ee', '#e6c77e', '#c9a45c', '#b08a52'],
    draw: () =>
      `<path d="M32 26 L88 26 L66 60 L88 94 L32 94 L54 60Z" fill="#dfe8ee" opacity="0.22"/>` +
      `<path d="M36 30 L84 30 L62 60 L84 90 L36 90 L58 60Z" fill="none" stroke="#dfe8ee" stroke-width="2.2" opacity="0.85"/>` +
      `<path d="M40 32 L80 32 L63 56 L57 56Z" fill="#e6c77e"/>` +
      `<path d="M40 32 L80 32 L76 37 L44 37Z" fill="#c9a45c" opacity="0.7"/>` +
      `<rect x="58.6" y="56" width="2.8" height="26" fill="#e6c77e"/>` +
      `<path d="M46 88 C48 76 54 70 60 70 C66 70 72 76 74 88Z" fill="#e6c77e"/>` +
      `<ellipse cx="60" cy="88" rx="14" ry="3" fill="#c9a45c"/>` +
      `<rect x="26" y="18" width="68" height="10" rx="3" fill="#8a6a44"/>` +
      `<rect x="26" y="92" width="68" height="11" rx="3" fill="#8a6a44"/>` +
      `<rect x="26" y="99" width="68" height="4" rx="2" fill="#6b5133"/>` +
      `<rect x="26" y="24" width="68" height="4" rx="2" fill="#6b5133"/>` +
      `<rect x="29" y="26" width="6" height="68" rx="3" fill="#b08a52"/>` +
      `<rect x="85" y="26" width="6" height="68" rx="3" fill="#b08a52"/>` +
      `<rect x="29" y="26" width="2.4" height="68" fill="#6b5133" opacity="0.6"/>` +
      `<rect x="88.6" y="26" width="2.4" height="68" fill="#6b5133" opacity="0.6"/>`,
  },

  'jet-lag': {
    subject: 'a dial half in night and half in day, two sets of hands an ocean apart, a plane crossing it',
    palette: ['#2b3550', '#1a2030', '#f5e7c0', '#e8a04a', '#c8d4e8', '#3e4a6b'],
    draw: () => {
      const ticks = Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2
        const x1 = 60 + Math.cos(a) * 33
        const y1 = 60 + Math.sin(a) * 33
        const x2 = 60 + Math.cos(a) * 38
        const y2 = 60 + Math.sin(a) * 38
        return `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(
          1,
        )}" stroke="#c8d4e8" stroke-width="${i % 3 === 0 ? 2.8 : 1.4}" stroke-linecap="round" opacity="0.8"/>`
      }).join('')
      return (
        `<circle cx="60" cy="60" r="46" fill="#2b3550" opacity="0.28"/>` +
        `<circle cx="60" cy="60" r="42" fill="#2b3550"/>` +
        `<path d="M60 18 A42 42 0 0 1 60 102 Z" fill="#f5e7c0" opacity="0.85"/>` +
        `<circle cx="60" cy="60" r="42" fill="none" stroke="#3e4a6b" stroke-width="3.4"/>` +
        ticks +
        `<circle cx="38" cy="36" r="1.6" fill="#c8d4e8" opacity="0.9"/>` +
        `<circle cx="30" cy="52" r="1.2" fill="#c8d4e8" opacity="0.7"/>` +
        `<circle cx="36" cy="80" r="1.3" fill="#c8d4e8" opacity="0.6"/>` +
        `<path d="M60 60 L60 32 M60 60 L80 70" fill="none" stroke="#e8a04a" stroke-width="3.4" stroke-linecap="round" opacity="0.5"/>` +
        `<path d="M60 60 L44 40 M60 60 L58 86" fill="none" stroke="#1a2030" stroke-width="3.6" stroke-linecap="round"/>` +
        `<circle cx="60" cy="60" r="4.2" fill="#e8a04a"/>` +
        `<circle cx="60" cy="60" r="1.8" fill="#1a2030"/>` +
        `<g transform="rotate(34 96 26)">` +
        `<ellipse cx="96" cy="26" rx="3.6" ry="17" fill="#c8d4e8"/>` +
        `<path d="M96 24 L78 33 L79 37 L94 33 L98 33 L113 37 L114 33Z" fill="#c8d4e8"/>` +
        `<path d="M96 39 L88 45 L104 45Z" fill="#c8d4e8"/>` +
        `<ellipse cx="96" cy="13" rx="3" ry="4" fill="#e8a04a"/>` +
        `</g>` +
        `<path d="M72 34 C62 40 52 42 42 40" fill="none" stroke="#c8d4e8" stroke-width="1.4" stroke-dasharray="4 4" opacity="0.5"/>`
      )
    },
  },

  entropy: {
    subject: 'a neat stack of three blocks on the left and four tumbling out of it to the right, dust behind',
    palette: ['#8892a6', '#5d6675', '#c3cbd8', '#3a4150', '#6f7b8f', '#aab4c4'],
    draw: () => {
      const cube = (x: number, y: number, s: number, rot: number) =>
        `<g transform="rotate(${rot} ${x + s / 2} ${y + s / 2})">` +
        `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="#8892a6"/>` +
        `<path d="M${x} ${y} L${x + s * 0.3} ${y - s * 0.3} L${x + s * 1.3} ${y - s * 0.3} L${x + s} ${y}Z" fill="#c3cbd8"/>` +
        `<path d="M${x + s} ${y} L${x + s * 1.3} ${y - s * 0.3} L${x + s * 1.3} ${y + s * 0.7} L${x + s} ${
          y + s
        }Z" fill="#5d6675"/>` +
        `</g>`
      return (
        ground(62, 110, 52, 7, '#3a4150') +
        `<circle cx="86" cy="48" r="13" fill="#3a4150" opacity="0.35"/>` +
        `<circle cx="100" cy="66" r="9" fill="#3a4150" opacity="0.28"/>` +
        cube(14, 82, 22, 0) +
        cube(14, 58, 22, 0) +
        cube(15, 34, 22, 0) +
        cube(52, 78, 20, 14) +
        cube(76, 88, 17, -22) +
        cube(72, 58, 15, 38) +
        cube(94, 70, 13, -9) +
        `<circle cx="66" cy="50" r="2.4" fill="#aab4c4" opacity="0.7"/>` +
        `<circle cx="90" cy="38" r="1.8" fill="#aab4c4" opacity="0.6"/>` +
        `<circle cx="106" cy="52" r="1.5" fill="#aab4c4" opacity="0.5"/>` +
        `<circle cx="46" cy="64" r="1.6" fill="#6f7b8f" opacity="0.6"/>` +
        `<path d="M40 30 L52 26 M44 40 L58 34" fill="none" stroke="#aab4c4" stroke-width="1.4" opacity="0.4"/>`
      )
    },
  },

  death: {
    subject: 'a candle just gone out, wax run down the side, one thread of smoke still leaving the wick',
    palette: ['#e6d9bd', '#c9b892', '#f6eeda', '#9aa3ad', '#3c3a36', '#7d7360'],
    draw: () =>
      ground(60, 108, 32, 7, '#3c3a36') +
      `<ellipse cx="60" cy="104" rx="30" ry="8" fill="#e6d9bd"/>` +
      `<rect x="44" y="40" width="32" height="64" fill="#e6d9bd"/>` +
      `<rect x="66" y="40" width="10" height="64" fill="#c9b892"/>` +
      `<rect x="44" y="40" width="7" height="64" fill="#f6eeda" opacity="0.7"/>` +
      `<ellipse cx="60" cy="40" rx="16" ry="5.5" fill="#f6eeda"/>` +
      `<ellipse cx="60" cy="41" rx="9" ry="3" fill="#c9b892"/>` +
      `<path d="M47 43 C45 54 49 60 46 72 C43 62 43 50 47 43Z" fill="#f6eeda"/>` +
      `<path d="M71 44 C74 52 70 58 73 66 C76 58 75 48 71 44Z" fill="#f6eeda" opacity="0.85"/>` +
      `<path d="M60 40 L60 32" fill="none" stroke="#3c3a36" stroke-width="2.6" stroke-linecap="round"/>` +
      `<circle cx="60" cy="31" r="2.2" fill="#7d7360"/>` +
      `<path d="M60 28 C66 22 54 16 60 8 C64 4 62 2 60 0" fill="none" stroke="#9aa3ad" stroke-width="2.4" stroke-linecap="round" opacity="0.7"/>` +
      `<path d="M60 26 C55 21 63 17 59 12" fill="none" stroke="#9aa3ad" stroke-width="1.4" stroke-linecap="round" opacity="0.45"/>`,
  },

  photosynthesis: {
    subject: 'a leaf with real branching venation under a shaft of light, oxygen leaving its surface',
    palette: ['#3f8f3a', '#2c6b2a', '#7fc25c', '#fff0b8', '#dff3ff', '#1f4d1e'],
    draw: () => {
      const veins = [
        'M58 84 C50 78 44 72 38 62',
        'M62 74 C56 66 50 60 44 52',
        'M66 64 C62 56 58 50 52 44',
        'M70 54 C68 46 66 40 62 34',
        'M56 88 C62 84 70 82 80 80',
        'M60 78 C68 72 76 70 86 68',
        'M64 68 C72 62 80 58 90 56',
        'M68 58 C76 52 84 48 92 44',
      ]
      return (
        // Sunlight as a handful of bright rays rather than one big translucent
        // parallelogram: over a dark card the parallelogram rendered as a grey
        // slab lying across the leaf, which is the opposite of light.
        `<path d="M6 10 L26 2 M2 30 L24 20 M6 52 L26 42 M10 74 L28 65" fill="none" stroke="#fff0b8" stroke-width="3" stroke-linecap="round" opacity="0.4"/>` +
        `<path d="M16 22 L32 15 M18 44 L34 36" fill="none" stroke="#fff0b8" stroke-width="2" stroke-linecap="round" opacity="0.28"/>` +
        `<ellipse cx="62" cy="58" rx="40" ry="26" fill="#3f8f3a" transform="rotate(-42 62 58)"/>` +
        `<path d="M52 96 C62 74 82 46 100 26 C92 22 78 26 66 38 C50 54 44 76 52 96Z" fill="#7fc25c" opacity="0.55"/>` +
        veins
          .map(
            (d) =>
              `<path d="${d}" fill="none" stroke="#2c6b2a" stroke-width="1.8" stroke-linecap="round" opacity="0.9"/>`,
          )
          .join('') +
        `<path d="M50 102 C62 78 82 48 104 24" fill="none" stroke="#2c6b2a" stroke-width="3.2" stroke-linecap="round"/>` +
        `<path d="M50 102 C46 108 42 112 36 114" fill="none" stroke="#1f4d1e" stroke-width="3.4" stroke-linecap="round"/>` +
        `<circle cx="84" cy="34" r="4" fill="#dff3ff" opacity="0.9"/>` +
        `<circle cx="94" cy="46" r="2.8" fill="#dff3ff" opacity="0.8"/>` +
        `<circle cx="76" cy="22" r="2.4" fill="#dff3ff" opacity="0.7"/>` +
        `<circle cx="100" cy="30" r="2" fill="#dff3ff" opacity="0.6"/>` +
        `<circle cx="88" cy="58" r="2.2" fill="#dff3ff" opacity="0.55"/>` +
        `<path d="M100 88 L112 94 M104 76 L116 82" fill="none" stroke="#fff0b8" stroke-width="2" stroke-linecap="round" opacity="0.32"/>`
      )
    },
  },

  /* ---- the second wave ---------------------------------------------------- */

  rainbows: {
    subject: 'seven concentric arced bands rising from a rounded hill, a soft cloud at each foot of the arc',
    palette: ['#6b5b95', '#eef2f7', '#e0453c', '#f2843c', '#f5cd4a', '#63b76c', '#4a90c9', '#5c6bc0', '#8a5cbf'],
    draw: () => {
      const bands: [number, string][] = [
        [52, '#e0453c'],
        [47, '#f2843c'],
        [42, '#f5cd4a'],
        [37, '#63b76c'],
        [32, '#4a90c9'],
        [27, '#5c6bc0'],
        [22, '#8a5cbf'],
      ]
      return (
        `<ellipse cx="60" cy="150" rx="92" ry="50" fill="#6b5b95"/>` +
        bands
          .map(
            ([r, c]) =>
              `<path d="M${60 - r} 118 A ${r} ${r} 0 0 1 ${60 + r} 118" fill="none" stroke="${c}" stroke-width="5.2" stroke-linecap="round"/>`,
          )
          .join('') +
        `<ellipse cx="19" cy="103" rx="14" ry="9" fill="#eef2f7"/>` +
        `<ellipse cx="27" cy="98" rx="10" ry="7" fill="#eef2f7"/>` +
        `<ellipse cx="101" cy="103" rx="14" ry="9" fill="#eef2f7"/>` +
        `<ellipse cx="93" cy="98" rx="10" ry="7" fill="#eef2f7"/>`
      )
    },
  },

  'traffic-jams': {
    subject: 'three cars queued nose to tail on a dark road, brake lights lit, a skyline waiting behind them',
    palette: ['#232733', '#33363d', '#e8c34a', '#3d5a80', '#8f3985', '#c9a227', '#c9dcea', '#ff4d4d'],
    draw: () => {
      const cars: [number, number, number, number, string][] = [
        [24, 78, 30, 20, '#3d5a80'],
        [56, 66, 26, 18, '#8f3985'],
        [84, 56, 22, 15, '#c9a227'],
      ]
      return (
        `<rect x="0" y="0" width="120" height="70" fill="#232733"/>` +
        `<rect x="4" y="20" width="10" height="34" fill="#33363d" opacity="0.6"/>` +
        `<rect x="18" y="10" width="14" height="44" fill="#33363d" opacity="0.6"/>` +
        `<rect x="96" y="14" width="12" height="40" fill="#33363d" opacity="0.6"/>` +
        `<rect x="0" y="52" width="120" height="68" fill="#33363d"/>` +
        Array.from(
          { length: 5 },
          (_, i) => `<rect x="${8 + i * 24}" y="84" width="12" height="4" fill="#e8c34a"/>`,
        ).join('') +
        cars
          .map(
            ([x, y, w, h, c]) =>
              `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${c}"/>` +
              `<rect x="${x + w * 0.18}" y="${y - h * 0.32}" width="${w * 0.64}" height="${h * 0.4}" rx="3" fill="${c}"/>` +
              `<rect x="${x + w * 0.24}" y="${y - h * 0.24}" width="${w * 0.52}" height="${h * 0.28}" rx="2" fill="#c9dcea"/>` +
              `<circle cx="${x + w * 0.86}" cy="${y + h * 0.5}" r="${h * 0.16}" fill="#ff4d4d"/>`,
          )
          .join('')
      )
    },
  },
}

/* ---- mood, the same contract the rest of the site's art uses ------------- */

/**
 * Which colour a phenomenon's tile glows with: its own dominant fill, weighted
 * by drawn area.
 *
 * Lifted deliberately from `auction-art.ts` rather than reinvented — a lot of
 * this site's art now agrees that a card's light should come out of the
 * drawing rather than out of a palette chosen to sit beside it. `fill="none"`
 * and `fill="url(#…)"` are skipped: a gradient has no single colour to be, and
 * every drawing here also carries flat fills, so nothing ends up moodless.
 * Shapes whose area cannot be read off two attributes (paths, polygons) count
 * as a fixed nominal area, which is why a drawing that wants a particular
 * glow says it in how much of that colour it actually lays down.
 */
export function dominantMood(svg: string): string {
  const weight = new Map<string, number>()
  const num = (attrs: string, name: string) => {
    const m = attrs.match(new RegExp(`${name}="(-?[\\d.]+)"`))
    return m ? Number(m[1]) : undefined
  }
  const attr = (attrs: string, name: string) => attrs.match(new RegExp(`${name}="([^"]*)"`))?.[1]
  for (const m of svg.matchAll(/<(rect|circle|ellipse|path|polygon)\s+([^>]*?)\/?>/g)) {
    const [, tag, attrs] = m
    const fill = attr(attrs, 'fill')
    if (!fill || fill === 'none' || !fill.startsWith('#')) continue
    let area = 260
    if (tag === 'rect') {
      const w = num(attrs, 'width')
      const h = num(attrs, 'height')
      if (w && h) area = w * h
    } else if (tag === 'circle') {
      const r = num(attrs, 'r')
      if (r) area = Math.PI * r * r
    } else if (tag === 'ellipse') {
      const rx = num(attrs, 'rx')
      const ry = num(attrs, 'ry')
      if (rx && ry) area = Math.PI * rx * ry
    }
    weight.set(fill, (weight.get(fill) ?? 0) + area)
  }
  let best: string | null = null
  let bestArea = 0
  for (const [hex, area] of weight) if (area > bestArea) [best, bestArea] = [hex, area]
  return best ?? '#8fa3b8'
}

/**
 * Every phenomenon's mood, computed once on first use.
 *
 * Deliberately a function rather than a `const` evaluated at module scope.
 * The browser side of `earth-reviews.astro` imports `starsSvg` and `symbolId`
 * from this file and nothing else — the drawings themselves are already in
 * the page as an SVG sprite — but a top-level `Object.fromEntries(...)` call
 * is not something Rollup can prove side-effect-free, so it kept the call,
 * and the call kept `ART`, and all twenty-two drawings shipped a second time
 * inside the JavaScript bundle: 38 KB of markup the client never reads.
 * Behind a function they tree-shake away cleanly.
 */
let moodCache: Record<string, string> | null = null
export function moodMap(): Record<string, string> {
  return (moodCache ??= Object.fromEntries(
    Object.keys(ART).map((id) => [id, dominantMood(ART[id].draw())]),
  ))
}

/** The glow colour for one phenomenon's tile. */
export const moodOf = (id: string): string => moodMap()[id] ?? '#8fa3b8'

/** #rrggbb -> "r, g, b", for a glow's rgba(). */
export function rgbTriplet(hex: string): string {
  const v = parseInt(hex.slice(1), 16)
  return `${(v >> 16) & 255}, ${(v >> 8) & 255}, ${v & 255}`
}

/* ---- inlining ------------------------------------------------------------ */

/** The symbol id one phenomenon's drawing is defined under. */
export const symbolId = (id: string) => `er-art-${id}`

/**
 * Every drawing, once, as `<symbol>`s inside one hidden `<svg>`. The grid and
 * the product page both point `<use>` at these rather than each carrying their
 * own copy of twenty-two illustrations.
 */
export function spriteSvg(): string {
  return (
    `<svg class="er-sprite" aria-hidden="true" focusable="false" width="0" height="0">` +
    Object.keys(ART)
      .map((id) => `<symbol id="${symbolId(id)}" viewBox="${VIEWBOX}">${ART[id].draw()}</symbol>`)
      .join('') +
    `</svg>`
  )
}

/* ---- stars --------------------------------------------------------------- */

/**
 * A five-pointed star as an explicit polygon, and its exact left half.
 *
 * Both are worked out from the same ten points — outer radius 10, inner radius
 * 3.82, first point straight up — rather than drawn by eye, so the half star
 * really is half a star rather than a star with a rectangle over it. That
 * matters here for a specific reason: clipping would need a `clipPath` with an
 * id, and these render dozens at a time on one page, which is the exact
 * collision this module's prefixing rule exists to avoid.
 *
 * The polygon crosses x=0 at exactly two of its ten points — the top outer
 * point and the bottom inner point — so the left half needs no interpolation.
 */
const STAR_FULL =
  'M0 -10 L2.245 -3.09 L9.511 -3.09 L3.633 1.181 L5.878 8.09 L0 3.82 ' +
  'L-5.878 8.09 L-3.633 1.181 L-9.511 -3.09 L-2.245 -3.09 Z'
const STAR_LEFT = 'M0 -10 L-2.245 -3.09 L-9.511 -3.09 L-3.633 1.181 L-5.878 8.09 L0 3.82 Z'

/** The gold a filled star is painted. */
export const STAR_GOLD = '#f5a623'

/**
 * Five stars for a rating, as inline SVG.
 *
 * **Filled and empty differ by fill, not by hue.** A filled star is a solid
 * gold shape with a dark keyline; an empty one is an unfilled outline in the
 * surrounding text colour. Someone who cannot tell gold from grey can still
 * count the solid ones, which is the whole job. A partial star is the left
 * half filled inside a complete outline — a shape difference again, and one
 * that survives at sixteen pixels.
 *
 * `value` is already rounded by `averageRating`; a star is filled at each
 * whole point and half-filled from a quarter onwards, so 4.8 shows four and a
 * half rather than rounding itself up to a clean five.
 */
export function starsSvg(value: number, height = 20, label?: string): string {
  const full = Math.floor(value)
  const half = value - full >= 0.25 ? 1 : 0
  const w = (106 / 24) * height
  const stars = Array.from({ length: 5 }, (_, i) => {
    const at = `<g transform="translate(${13 + i * 20} 12)">`
    if (i < full)
      return `${at}<path d="${STAR_FULL}" fill="${STAR_GOLD}" stroke="#6b4a10" stroke-width="1.1" stroke-linejoin="round"/></g>`
    if (i === full && half)
      return (
        `${at}<path d="${STAR_LEFT}" fill="${STAR_GOLD}"/>` +
        `<path d="${STAR_FULL}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" opacity="0.65"/></g>`
      )
    return `${at}<path d="${STAR_FULL}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" opacity="0.5"/></g>`
  }).join('')
  const a11y = label
    ? `role="img" aria-label="${label}"`
    : `role="img" aria-label="${value} out of 5 stars"`
  return `<svg class="er-stars" viewBox="0 0 106 24" width="${w.toFixed(
    1,
  )}" height="${height}" ${a11y}>${stars}</svg>`
}

/** One drawing, placed. `label` is the accessible name, or '' for decoration. */
export function useArt(id: string, cls: string, label = ''): string {
  const a11y = label
    ? `role="img" aria-label="${label.replace(/"/g, '&quot;')}"`
    : 'aria-hidden="true" focusable="false"'
  return `<svg class="${cls}" viewBox="${VIEWBOX}" ${a11y}><use href="#${symbolId(id)}"/></svg>`
}
