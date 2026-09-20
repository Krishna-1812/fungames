/**
 * Space Elevator's twenty-nine markers, drawn.
 *
 * These used to be inline SVG strings in the page itself, each one a flat
 * rect the exact colour of its zone's sky with a small scene painted on top —
 * a porthole, the same shape Deep Sea's creatures were in before
 * `deep-sea-art.ts` cut them loose. The page already computes the real sky
 * colour for the metre you are looking at (`mix(zone.sky[0], zone.sky[1],
 * zt)` in `space-elevator.astro`), so a marker painting its own approximation
 * of that colour behind its subject was always going to drift from the real
 * thing as you scrolled past it. These are cut-outs instead: no background of
 * their own, composited directly over the climb's real sky.
 *
 * Two consequences of that:
 *
 * - A handful of the originals had no subject at all — 'A grey, overcast
 *   sky' was four flat bars the width of the frame, and 'The Kármán line' was
 *   a filled rectangle standing for the void above it. A block of colour is
 *   invisible with no block to sit on, so both are redrawn as an actual thing:
 *   a real stratus deck with a top and an underside, and a boundary line with
 *   a glow rather than a fill.
 * - Small decorative "stars" scattered through a few of the originals (the
 *   U-2, Falcon 9, Noctilucent clouds, the X-15) are gone. The climb already
 *   has its own starfield past the stratosphere — `.starfield` in
 *   `space-elevator.astro` — so a marker drawing three more of its own was
 *   duplicate work that would drift out of register with the real ones.
 *
 * **Gradients are allowed, and every scene should reach for real shading
 * now** — this module's original flat-cut-out bar was deliberately raised
 * to match neal.fun's own illustrations, which lean on soft form and light
 * rather than single-tone silhouettes. The one rule that survives from the
 * old "no gradients" era, carried over from `earth-reviews-art.ts` and
 * `deep-sea-art.ts` instead: every `id=` — a gradient, a clip path, anything
 * — must start with that scene's own key, because all twenty-nine still
 * inline into one shared document and an unprefixed id can silently steal
 * another scene's gradient. `check-space-elevator-art.mjs` fails on an
 * unprefixed id, a duplicate id, and a `url(#…)` naming an id the scene
 * itself does not define.
 *
 * **One palette**, tuned for the sky rather than the sea: the pale
 * ice-and-metal tones almost everything is drawn in read against troposphere
 * blue, stratosphere navy and thermosphere black alike, and the warm tones
 * (gold, ember, flare) are reserved for things that are genuinely hot or lit
 * from within — a contrail catching the sun, a fireball, a mushroom cloud.
 * A gradient's own stop colours count as uses of the palette too.
 */

export const P = {
  frost: '#eaf3ff',
  steel: '#dfe6ee',
  cloud: '#c7d4e2',
  cloud2: '#8fa0b8',
  slate: '#3a4a66',
  slate2: '#4c5568',
  umber: '#2a2010',
  gold: '#ffd27a',
  ember: '#ff9d5c',
  ember2: '#ff8a5c',
  flare: '#ffb066',
  flare2: '#ffd9a8',
  skin: '#ffe3c2',
  cyan: '#6ee7ff',
  sky2: '#5aa9e8',
  noc: '#bfe8ff',
  noc2: '#8fd0ff',
  stem: '#c98a5a',
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

/**
 * A marker's title is a full sentence ("Mount Everest's summit"), not a
 * plain slug like `earth-reviews-art.ts`'s keys — so it cannot be used
 * directly as an SVG id prefix. Every gradient/clipPath id in this module
 * is prefixed with `slug(title)` instead, and `check-space-elevator-art.mjs`
 * imports this same function to verify it, so the two can never drift.
 */
export const slug = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

export const SPACE_ELEVATOR_ART: Record<string, Scene> = {
  'The highest a bird has ever been confirmed flying': {
    subject: 'a griffon vulture gliding on broad, upswept wings, primary feathers fingered at each tip',
    draw: () => {
      const k = slug('The highest a bird has ever been confirmed flying')
      const feathers = (side: 1 | -1) => {
        const tipX = 60 + side * 54
        const tipY = 46
        const rootX = 60 + side * 30
        const rootY = 62
        return Array.from({ length: 5 }, (_, i) => {
          const t = i / 4
          const x0 = rootX + (tipX - rootX) * (0.72 + t * 0.05)
          const y0 = rootY + (tipY - rootY) * (0.72 + t * 0.05)
          const len = 16 - i * 1.6
          const ang = -0.9 + i * 0.34
          const x1 = x0 + side * Math.cos(ang) * len
          const y1 = y0 - Math.sin(ang) * len
          return `<path d="M${x0.toFixed(1)} ${y0.toFixed(1)} L${x1.toFixed(1)} ${y1.toFixed(1)}" stroke="${P.slate}" stroke-width="1.6" stroke-linecap="round" opacity="0.7"/>`
        }).join('')
      }
      return (
        `<defs>` +
        `<linearGradient id="${k}-wing" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${P.frost}"/><stop offset="1" stop-color="${P.cloud2}"/>` +
        `</linearGradient>` +
        `</defs>` +
        // Both wings as real filled shapes (a shallow M, upswept at the
        // shoulder) rather than a single stroked curve standing in for them.
        `<path d="M60 64 Q30 40 4 58 Q6 66 18 66 Q34 62 54 70Z" fill="url(#${k}-wing)"/>` +
        `<path d="M60 64 Q90 40 116 58 Q114 66 102 66 Q86 62 66 70Z" fill="url(#${k}-wing)"/>` +
        // The far wing's own underside, a shade darker, so the near one
        // reads as closer to the light.
        `<path d="M60 64 Q34 62 18 66 Q30 68 50 72Z" fill="${P.cloud2}" opacity="0.55"/>` +
        `<path d="M60 64 Q86 62 102 66 Q90 68 70 72Z" fill="${P.cloud2}" opacity="0.55"/>` +
        feathers(-1) +
        feathers(1) +
        // Body, head and hooked bill.
        `<path d="M54 62 Q60 54 66 62 L64 82 Q60 88 56 82Z" fill="${P.cloud2}"/>` +
        `<circle cx="60" cy="53" r="5.2" fill="${P.cloud}"/>` +
        `<path d="M60 51 L67 52.5 L60.5 55Z" fill="${P.gold}"/>` +
        `<circle cx="61.5" cy="52" r="0.9" fill="${P.slate2}"/>`
      )
    },
  },
  'The highest a glider has ever flown': {
    subject: 'the Perlan 2, an engineless pressurised sailplane banking on very long slender straight wings',
    draw: () => {
      const k = slug('The highest a glider has ever flown')
      return (
        `<defs>` +
        `<linearGradient id="${k}-wing" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${P.frost}"/><stop offset="1" stop-color="${P.cloud2}"/>` +
        `</linearGradient>` +
        `<linearGradient id="${k}-canopy" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${P.frost}"/><stop offset="1" stop-color="${P.cyan}"/>` +
        `</linearGradient>` +
        `<linearGradient id="${k}-boom" x1="0" y1="0" x2="1" y2="0">` +
        `<stop offset="0" stop-color="${P.steel}"/><stop offset="1" stop-color="${P.cloud2}"/>` +
        `</linearGradient>` +
        `</defs>` +
        // A high-aspect-ratio wing seen banked, not swept — a long thin
        // triangle rather than a fuselage with two separate panels.
        `<path d="M12 60 L108 60 L60 46Z" fill="url(#${k}-wing)"/>` +
        // Trailing-edge shadow band, a second tone beyond the gradient.
        `<path d="M22 59 L98 59 L92 62 L28 62Z" fill="${P.cloud2}" opacity="0.5"/>` +
        // Upturned winglets at each tip.
        `<path d="M12 60 L18 51 L22 53 L16 61Z" fill="${P.steel}"/>` +
        `<path d="M108 60 L102 51 L98 53 L104 61Z" fill="${P.steel}"/>` +
        // A tapering pod, not a bare stroke, down to a filled V-tail.
        `<path d="M57 48 L63 48 L61 96 L59 96Z" fill="url(#${k}-boom)"/>` +
        `<path d="M60 96 L48 106 L52 108 L61 98Z" fill="${P.steel}"/>` +
        `<path d="M60 96 L72 106 L68 108 L59 98Z" fill="${P.steel}"/>` +
        // The pressurised bubble canopy — no intake, no exhaust, just glass.
        `<ellipse cx="60" cy="44" rx="6.5" ry="4.5" fill="url(#${k}-canopy)"/>` +
        `<ellipse cx="58" cy="42.3" rx="2" ry="1.1" fill="${P.frost}" opacity="0.85"/>`
      )
    },
  },
  'Felix Baumgartner’s jump': {
    subject: 'a figure in a sleek modern pressure suit, arms and legs swept wide in a stable freefall spread',
    draw: () => {
      const k = slug('Felix Baumgartner’s jump')
      // A tapered filled limb — real width at the shoulder narrowing toward
      // the hand or boot — instead of a flat-width stroke standing in for it.
      const limb = (x1: number, y1: number, x2: number, y2: number, w1: number, w2: number) => {
        const dx = x2 - x1, dy = y2 - y1
        const len = Math.hypot(dx, dy) || 1
        const nx = -dy / len, ny = dx / len
        const p1 = [x1 + (nx * w1) / 2, y1 + (ny * w1) / 2]
        const p2 = [x1 - (nx * w1) / 2, y1 - (ny * w1) / 2]
        const p3 = [x2 - (nx * w2) / 2, y2 - (ny * w2) / 2]
        const p4 = [x2 + (nx * w2) / 2, y2 + (ny * w2) / 2]
        return `<path d="M${p1[0].toFixed(1)} ${p1[1].toFixed(1)} L${p4[0].toFixed(1)} ${p4[1].toFixed(1)} L${p3[0].toFixed(1)} ${p3[1].toFixed(1)} L${p2[0].toFixed(1)} ${p2[1].toFixed(1)}Z" fill="url(#${k}-suit)"/>`
      }
      return (
        `<defs>` +
        `<linearGradient id="${k}-suit" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0" stop-color="${P.ember2}"/><stop offset="1" stop-color="${P.slate}"/>` +
        `</linearGradient>` +
        `<radialGradient id="${k}-helmet" cx="0.35" cy="0.3" r="0.75">` +
        `<stop offset="0" stop-color="${P.frost}"/><stop offset="1" stop-color="${P.cloud2}"/>` +
        `</radialGradient>` +
        `</defs>` +
        limb(60, 53, 38, 65, 7, 4) +
        limb(60, 53, 82, 65, 7, 4) +
        limb(60, 78, 44, 102, 7, 4) +
        limb(60, 78, 76, 102, 7, 4) +
        `<path d="M50 42 Q60 37 70 42 L68 80 Q60 86 52 80Z" fill="url(#${k}-suit)"/>` +
        `<path d="M50 42 Q60 37 70 42 L68 50 Q60 46 52 50Z" fill="${P.ember2}" opacity="0.55"/>` +
        `<circle cx="60" cy="38" r="9" fill="url(#${k}-helmet)"/>` +
        `<path d="M55 33 a5 5 0 0 1 10 0" fill="none" stroke="${P.slate2}" stroke-width="2.2"/>` +
        `<circle cx="57" cy="35" r="1.5" fill="${P.frost}" opacity="0.85"/>` +
        // Boot fins — the sleek, modern detail neither of the other two suits have.
        `<path d="M44 102 L37 111 L48 106Z" fill="${P.slate2}"/>` +
        `<path d="M76 102 L83 111 L72 106Z" fill="${P.slate2}"/>` +
        `<path d="M56 58 L64 58" stroke="${P.gold}" stroke-width="2" stroke-linecap="round"/>` +
        `<path d="M60 20 L60 6" stroke="${P.ember}" stroke-width="2" stroke-dasharray="2 3"/>`
      )
    },
  },
  'The current highest skydive on record': {
    subject: 'a suited figure trailing below a stratospheric balloon on a thin line, no capsule at all',
    draw: () => {
      const k = slug('The current highest skydive on record')
      return (
        `<defs>` +
        `<linearGradient id="${k}-balloon" x1="0" y1="0" x2="1" y2="0">` +
        `<stop offset="0" stop-color="${P.frost}"/><stop offset="1" stop-color="${P.cloud2}"/>` +
        `</linearGradient>` +
        `<linearGradient id="${k}-suit" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0" stop-color="${P.steel}"/><stop offset="1" stop-color="${P.slate}"/>` +
        `</linearGradient>` +
        `</defs>` +
        // The balloon, alone above him — no gondola, just the envelope and
        // the line down, its far side shaded so it reads as a real sphere.
        `<ellipse cx="60" cy="18" rx="28" ry="11" fill="url(#${k}-balloon)"/>` +
        `<path d="M40 12 Q60 22 80 12 M34 18 Q60 27 86 18" fill="none" stroke="${P.cloud2}" stroke-width="1" opacity="0.6"/>` +
        `<path d="M60 7 L60 29" stroke="${P.cloud2}" stroke-width="1" opacity="0.5"/>` +
        `<path d="M36 22 L58 50 M84 22 L62 50" stroke="${P.frost}" stroke-width="1.4" opacity="0.8"/>` +
        // Diver: a stable dive, arms swept back and legs together — a
        // different silhouette from the wide X-spread jumps above it.
        `<path d="M52 58 Q60 52 68 58 L66 84 Q60 90 54 84Z" fill="url(#${k}-suit)"/>` +
        `<path d="M52 58 Q60 52 68 58 L66 66 Q60 62 54 66Z" fill="${P.steel}" opacity="0.55"/>` +
        `<rect x="52" y="60" width="16" height="14" rx="2" fill="${P.slate2}" opacity="0.7"/>` +
        `<circle cx="60" cy="52" r="7.5" fill="${P.skin}"/>` +
        `<path d="M55 49 a5 5 0 0 1 10 0" fill="none" stroke="${P.slate2}" stroke-width="2"/>` +
        `<path d="M54 62 L34 70 M66 62 L86 70" stroke="${P.slate}" stroke-width="5" stroke-linecap="round"/>` +
        `<path d="M56 84 L50 108 M64 84 L70 108" stroke="${P.slate2}" stroke-width="6" stroke-linecap="round"/>`
      )
    },
  },
  'A grey, overcast sky': {
    subject: 'a stratus deck, flat-bottomed, lit thin along its own top and dark underneath',
    draw: () => {
      const k = slug('A grey, overcast sky')
      // A wavering top edge from real points (no under-specified Q commands —
      // each control/end pair is written out in full), a flat-ish underside,
      // and both short of the side edges so the deck reads as a slab of cloud
      // rather than a crop of one.
      const pts = Array.from({ length: 8 }, (_, i) => {
        const x = 8 + (i * (W - 16)) / 7
        const y = 40 + Math.sin(i * 1.7 + 0.4) * 7 + rnd(41, i) * 4
        return [x, y]
      })
      let top = `M8 ${pts[0][1].toFixed(1)}`
      for (let i = 1; i < pts.length; i++) {
        const [px, py] = pts[i - 1]
        const [x, y] = pts[i]
        const cx = (px + x) / 2
        top += ` Q${cx.toFixed(1)} ${py.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`
      }
      const path = `${top} L112 88 Q60 100 8 88 Z`
      return (
        `<defs>` +
        `<linearGradient id="${k}-deck" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${P.cloud2}"/><stop offset="1" stop-color="${P.slate2}"/>` +
        `</linearGradient>` +
        `<linearGradient id="${k}-under" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${P.slate2}"/><stop offset="1" stop-color="${P.slate}"/>` +
        `</linearGradient>` +
        `</defs>` +
        `<path d="${path}" fill="url(#${k}-deck)"/>` +
        // A darker underside slab layered beneath the lit deck, so the whole
        // thing reads as thickness rather than one flat card of grey.
        `<path d="M14 72 Q60 66 106 72 L112 88 Q60 100 8 88Z" fill="url(#${k}-under)" opacity="0.92"/>` +
        `<path d="M18 58 Q40 48 62 55 Q86 48 102 58" fill="none" stroke="${P.cloud}" stroke-width="2.4"/>` +
        `<path d="M14 72 Q50 82 106 72" fill="none" stroke="${P.slate}" stroke-width="2.4"/>` +
        `<path d="M22 90 Q60 98 98 90" fill="none" stroke="${P.frost}" stroke-width="1.6" opacity="0.5"/>`
      )
    },
  },
  'A fair-weather cumulus': {
    subject: 'a cartoon cumulus, flat-bottomed and cauliflower-topped, lit from above',
    draw: () => {
      const k = slug('A fair-weather cumulus')
      return (
        `<defs>` +
        `<radialGradient id="${k}-puff" cx="0.35" cy="0.25" r="0.85">` +
        `<stop offset="0" stop-color="${P.frost}"/><stop offset="1" stop-color="${P.cloud2}"/>` +
        `</radialGradient>` +
        `<linearGradient id="${k}-base" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${P.cloud2}"/><stop offset="1" stop-color="${P.slate2}"/>` +
        `</linearGradient>` +
        `</defs>` +
        `<circle cx="42" cy="66" r="20" fill="url(#${k}-puff)"/>` +
        `<circle cx="68" cy="56" r="26" fill="url(#${k}-puff)"/>` +
        `<circle cx="92" cy="70" r="16" fill="url(#${k}-puff)"/>` +
        `<rect x="32" y="72" width="72" height="18" rx="9" fill="url(#${k}-base)"/>` +
        // The underside proper, and the crevices where each puff overlaps
        // the next — the two places a cartoon cloud actually gets form.
        `<path d="M32 78 Q68 96 104 78 L104 88 Q68 104 32 88Z" fill="${P.slate2}" opacity="0.85"/>` +
        `<path d="M56 58 Q60 72 52 82" fill="none" stroke="${P.slate}" stroke-width="3" opacity="0.6" stroke-linecap="round"/>` +
        `<path d="M82 60 Q86 72 78 82" fill="none" stroke="${P.slate}" stroke-width="3" opacity="0.55" stroke-linecap="round"/>` +
        `<circle cx="60" cy="46" r="15" fill="${P.steel}"/>` +
        `<circle cx="55" cy="41" r="7" fill="${P.frost}"/>` +
        `<path d="M42 66 a20 20 0 0 1 26 -10 M68 56 a26 26 0 0 1 24 14" fill="none" stroke="${P.frost}" stroke-width="1.4" opacity="0.7"/>`
      )
    },
  },
  'Mount Everest’s summit': {
    subject: 'a snow-capped peak, sunlit on one face and shadowed on the other, a plume of blown snow off the summit',
    draw: () => {
      const k = slug('Mount Everest’s summit')
      return (
        `<defs>` +
        `<linearGradient id="${k}-lit" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0" stop-color="${P.steel}"/><stop offset="1" stop-color="${P.slate}"/>` +
        `</linearGradient>` +
        `<linearGradient id="${k}-shadow" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0" stop-color="${P.slate}"/><stop offset="1" stop-color="${P.umber}"/>` +
        `</linearGradient>` +
        `<linearGradient id="${k}-snow" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${P.frost}"/><stop offset="1" stop-color="${P.cloud}"/>` +
        `</linearGradient>` +
        `<radialGradient id="${k}-halo" cx="0.55" cy="0.15" r="0.6">` +
        `<stop offset="0" stop-color="${P.frost}" stop-opacity="0.5"/><stop offset="1" stop-color="${P.frost}" stop-opacity="0"/>` +
        `</radialGradient>` +
        `</defs>` +
        `<circle cx="70" cy="22" r="34" fill="url(#${k}-halo)"/>` +
        // Lit face (sun from the upper right) and the shadowed face behind it.
        `<path d="M2 100 L38 34 L54 58 L70 22 L118 100Z" fill="url(#${k}-lit)"/>` +
        `<path d="M2 100 L38 34 L44 45 L20 100Z" fill="url(#${k}-shadow)"/>` +
        `<path d="M70 22 L118 100 L96 100 L82 60Z" fill="url(#${k}-shadow)" opacity="0.85"/>` +
        // Ridge lines — the one piece of structure a flat gradient alone
        // cannot give: real rock strata catching the light unevenly.
        `<path d="M24 88 L40 62 M32 96 L48 70 M76 60 L88 78 M84 56 L98 82" stroke="${P.slate2}" stroke-width="1.3" opacity="0.5"/>` +
        // Snow cap, with its own shaded underside so it reads as a solid
        // mass rather than a flat sticker on the rock.
        `<path d="M60 34 L70 22 L82 42 L70 40Z" fill="url(#${k}-snow)"/>` +
        `<path d="M28 62 L38 34 L48 56Z" fill="url(#${k}-snow)"/>` +
        `<path d="M70 22 L74 30 L70 33 L64 30Z" fill="${P.frost}"/>` +
        // Blown-snow plume off the summit — the detail that says "this
        // peak is high enough to have its own weather".
        `<path d="M74 26 Q90 24 104 30 Q92 28 82 32" fill="none" stroke="${P.cloud}" stroke-width="1.6" opacity="0.6" stroke-linecap="round"/>` +
        `<path d="M74 30 Q94 32 108 40" fill="none" stroke="${P.cloud}" stroke-width="1.2" opacity="0.4" stroke-linecap="round"/>`
      )
    },
  },
  'A bumblebee, in a lab': {
    subject: 'a bumblebee, fuzzy and striped, suspended inside a sealed glass pressure chamber',
    draw: () => {
      const k = slug('A bumblebee, in a lab')
      return (
        `<defs>` +
        `<linearGradient id="${k}-glass" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0" stop-color="${P.frost}" stop-opacity="0.5"/><stop offset="1" stop-color="${P.cloud2}" stop-opacity="0.2"/>` +
        `</linearGradient>` +
        `<linearGradient id="${k}-body" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${P.gold}"/><stop offset="1" stop-color="${P.ember}"/>` +
        `</linearGradient>` +
        `<clipPath id="${k}-bodyclip"><ellipse cx="60" cy="70" rx="22" ry="16"/></clipPath>` +
        `</defs>` +
        // The chamber: a glass dome sealed onto a metal base, with a real
        // highlight streak down its near side rather than a flat tint.
        `<path d="M18 96 A42 42 0 0 1 102 96 L102 100 Q60 108 18 100Z" fill="url(#${k}-glass)"/>` +
        `<path d="M18 96 A42 42 0 0 1 102 96" fill="none" stroke="${P.frost}" stroke-width="2" opacity="0.85"/>` +
        `<ellipse cx="40" cy="52" rx="8" ry="20" fill="${P.frost}" opacity="0.4" transform="rotate(-14 40 52)"/>` +
        `<rect x="12" y="100" width="96" height="12" rx="3" fill="${P.slate2}"/>` +
        `<rect x="12" y="100" width="96" height="5" fill="${P.slate}" opacity="0.7"/>` +
        // Wings, blurred with flight, one shaded behind the other.
        `<ellipse cx="72" cy="58" rx="16" ry="9" fill="${P.cloud2}" opacity="0.4" transform="rotate(14 72 58)"/>` +
        `<ellipse cx="46" cy="58" rx="16" ry="9" fill="${P.frost}" opacity="0.55" transform="rotate(-14 46 58)"/>` +
        // Body: a lit gradient base with real dark stripes clipped to its
        // curve, not a single stroke standing in for the whole pattern.
        `<g clip-path="url(#${k}-bodyclip)">` +
        `<ellipse cx="60" cy="70" rx="22" ry="16" fill="url(#${k}-body)"/>` +
        `<rect x="38" y="52" width="7" height="36" fill="${P.umber}"/>` +
        `<rect x="53" y="52" width="7" height="36" fill="${P.umber}"/>` +
        `<rect x="68" y="52" width="7" height="36" fill="${P.umber}"/>` +
        `</g>` +
        `<ellipse cx="60" cy="70" rx="22" ry="16" fill="none" stroke="${P.umber}" stroke-width="1" opacity="0.5"/>` +
        // Head and antennae.
        `<circle cx="60" cy="55" r="8" fill="${P.umber}"/>` +
        `<circle cx="57" cy="53" r="1.3" fill="${P.frost}"/>` +
        `<path d="M56 48 L52 40 M64 48 L68 40" stroke="${P.umber}" stroke-width="1.6" stroke-linecap="round"/>`
      )
    },
  },
  'Where your flight is probably cruising': {
    subject: 'an ordinary twin-engine airliner, swept wings, seen from above with its contrail behind',
    draw: () => {
      const k = slug('Where your flight is probably cruising')
      return (
        `<defs>` +
        `<linearGradient id="${k}-fuselage" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${P.frost}"/><stop offset="1" stop-color="${P.cloud2}"/>` +
        `</linearGradient>` +
        `<linearGradient id="${k}-wing" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0" stop-color="${P.steel}"/><stop offset="1" stop-color="${P.cloud2}"/>` +
        `</linearGradient>` +
        `<linearGradient id="${k}-engine" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${P.cloud2}"/><stop offset="1" stop-color="${P.slate}"/>` +
        `</linearGradient>` +
        `</defs>` +
        `<path d="M2 66 Q60 78 118 66" fill="none" stroke="${P.sky2}" stroke-width="1.6" opacity="0.5"/>` +
        // Far wing, drawn first and shaded darker, so the near one reads
        // as closer to the light.
        `<path d="M50 70 L20 86 L28 82 L62 70Z" fill="${P.cloud2}" opacity="0.55"/>` +
        // A capsule fuselage with real taper, not a flat bar.
        `<path d="M14 65 Q20 59 34 59 L90 59 Q100 59 106 65 Q100 71 90 71 L34 71 Q20 71 14 65Z" fill="url(#${k}-fuselage)"/>` +
        // Near wing, swept back, on top.
        `<path d="M50 60 L18 44 L26 50 L62 60Z" fill="url(#${k}-wing)"/>` +
        `<ellipse cx="34" cy="50" rx="8" ry="3" fill="url(#${k}-engine)" transform="rotate(-25 34 50)"/>` +
        `<ellipse cx="30" cy="49" rx="2.2" ry="0.9" fill="${P.frost}" opacity="0.7" transform="rotate(-25 30 49)"/>` +
        // Tailplane and a small vertical fin.
        `<path d="M90 60 L100 48 L104 50 L94 62Z" fill="url(#${k}-wing)"/>` +
        `<path d="M92 60 L98 44 L102 46 L96 61Z" fill="${P.steel}"/>` +
        // Windows.
        `<circle cx="18" cy="64" r="1.6" fill="${P.slate}" opacity="0.8"/>` +
        `<path d="M40 63 L84 63" stroke="${P.slate}" stroke-width="1" stroke-dasharray="1.5 3" opacity="0.5"/>`
      )
    },
  },
  'A cumulonimbus, flattening into an anvil': {
    subject: 'a thunderhead colliding with the stratosphere, its crown sheared flat',
    draw: () => {
      const k = slug('A cumulonimbus, flattening into an anvil')
      return (
        `<defs>` +
        `<linearGradient id="${k}-body" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${P.cloud2}"/><stop offset="1" stop-color="${P.slate}"/>` +
        `</linearGradient>` +
        `<linearGradient id="${k}-anvil" x1="0" y1="0" x2="1" y2="0.3">` +
        `<stop offset="0" stop-color="${P.frost}"/><stop offset="1" stop-color="${P.cloud2}"/>` +
        `</linearGradient>` +
        `</defs>` +
        `<path d="M18 92 Q14 66 40 62 Q44 42 68 44 Q78 30 96 40 Q112 42 108 60 Q118 64 112 82 L18 92Z" fill="url(#${k}-body)"/>` +
        `<path d="M18 92 Q14 66 40 62 Q44 46 60 46 Q46 68 40 92Z" fill="${P.slate2}" opacity="0.65"/>` +
        `<path d="M96 40 Q112 42 108 60 Q118 64 112 82 L90 82 Q100 62 96 40Z" fill="${P.slate}" opacity="0.6"/>` +
        // The anvil itself, sheared flat and spread sideways where it hit
        // the stratosphere — a wide, low shelf rather than a puff, brightest
        // along its own flat top where the sun catches it.
        `<path d="M56 46 Q66 26 98 24 Q116 24 114 32 Q94 28 76 34 Q62 38 56 46Z" fill="url(#${k}-anvil)"/>` +
        `<path d="M68 28 Q88 25 108 27" fill="none" stroke="${P.frost}" stroke-width="2" opacity="0.85" stroke-linecap="round"/>` +
        `<path d="M54 92 L46 108 L56 104 L48 120" fill="none" stroke="${P.gold}" stroke-width="3" stroke-linecap="round"/>` +
        `<path d="M56 94 L64 104 L58 106" fill="none" stroke="${P.gold}" stroke-width="1.6" opacity="0.7" stroke-linecap="round"/>`
      )
    },
  },
  'Concorde’s cruising altitude': {
    subject: 'Concorde, a drooped needle nose fused into one long delta wing, no engines visible on its silhouette',
    draw: () => {
      const k = slug('Concorde’s cruising altitude')
      return (
        `<defs>` +
        `<linearGradient id="${k}-body" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${P.frost}"/><stop offset="1" stop-color="${P.steel}"/>` +
        `</linearGradient>` +
        `</defs>` +
        `<path d="M6 66 Q60 76 112 66" fill="none" stroke="${P.ember}" stroke-width="1.4" stroke-dasharray="2 4" opacity="0.6"/>` +
        // The drooped needle nose — a separate thin spike kinked below the
        // body's own centreline, the one feature that reads as "Concorde"
        // even in silhouette.
        `<path d="M6 68 L18 64" stroke="${P.slate}" stroke-width="2.2" stroke-linecap="round"/>` +
        // Fuselage and delta wing as one continuous ogee dart, not a
        // separate rectangular wing root — no pod, no tail engine.
        `<path d="M16 65 L88 40 L104 58 L116 65 L104 72 L88 90 L16 65Z" fill="url(#${k}-body)"/>` +
        `<path d="M16 65 L88 90 L80 86 L30 66Z" fill="${P.cloud2}" opacity="0.5"/>` +
        // The four engines, blended flush into the trailing edge rather
        // than hung in pods.
        `<rect x="96" y="60" width="8" height="3" rx="1" fill="${P.slate}" opacity="0.85"/>` +
        `<rect x="96" y="67" width="8" height="3" rx="1" fill="${P.slate}" opacity="0.85"/>` +
        `<path d="M22 63 L34 61" stroke="${P.slate2}" stroke-width="1.6" opacity="0.6" stroke-linecap="round"/>`
      )
    },
  },
  'The U-2’s service ceiling': {
    subject: 'the U-2, straight glider-proportioned wings, a nose camera pod and a single swept tail fin',
    draw: () => {
      const k = slug('The U-2’s service ceiling')
      return (
        `<defs>` +
        `<linearGradient id="${k}-wing" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${P.steel}"/><stop offset="1" stop-color="${P.cloud2}"/>` +
        `</linearGradient>` +
        `<linearGradient id="${k}-canopy" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${P.frost}"/><stop offset="1" stop-color="${P.cyan}"/>` +
        `</linearGradient>` +
        `</defs>` +
        // Shifted noticeably higher in the frame than the airliner (whose
        // fuselage sits around y 59-71) — the one lever that actually moves
        // this shape's own grid signature, since both are pale horizontal
        // bars and colour alone barely registers against mostly-transparent
        // surroundings at the distinctness check's resolution.
        `<g transform="translate(0 -20)">` +
        // A real wingspan relative to its fuselage — a U-2's wings are closer
        // to a glider's than a jet's, which is the whole reason it can hold
        // this altitude at all, so the silhouette is drawn wide and thin
        // rather than swept, with actual chord depth rather than a sliver.
        `<path d="M6 66 L44 62 L44 58 L76 58 L76 62 L114 66 L76 70 L76 74 L44 74 L44 70Z" fill="url(#${k}-wing)"/>` +
        // Underside shadow confined to the fuselage box itself, not the
        // full wingspan — a strip that shades the body rather than a
        // separate shape hanging beneath the wing.
        `<rect x="44" y="70" width="32" height="4" fill="${P.slate}" opacity="0.4"/>` +
        // Cockpit canopy sitting right on the fuselage's own top edge.
        `<ellipse cx="60" cy="58" rx="5" ry="3.5" fill="url(#${k}-canopy)"/>` +
        // Nose camera pod, flush with the thin front boom, picked out in a
        // warm tone — a real sensor window, and one more thing that never
        // appears on the airliner's own silhouette.
        `<ellipse cx="9" cy="65.5" rx="4" ry="1.8" fill="${P.ember}" opacity="0.9"/>` +
        // A single tail fin, swept, its root flush with the thin rear boom
        // — not the twin canted pair a Blackbird carries.
        `<path d="M84 63.5 L84 68.5 L100 44Z" fill="${P.slate2}"/>` +
        `</g>`
      )
    },
  },
  'Inside the ozone layer': {
    subject: 'UV, absorbed before it reaches the ground, inside a glowing shell of gas',
    draw: () => {
      const k = slug('Inside the ozone layer')
      return (
        // A band, not a ring: the layer is a thickness of gas the incoming
        // ray is stopped inside, so it is drawn as a solid arc of atmosphere
        // with the ray running into it and stopping, rather than a diagram
        // of rings. Still abstract — there is no literal object here — but
        // the band now has real depth: brightest along its top skin, darker
        // where the gas thickens toward its underside, with a soft core glow
        // where the ray is actually being absorbed.
        `<defs>` +
        `<linearGradient id="${k}-band" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${P.cyan}" stop-opacity="0.85"/><stop offset="1" stop-color="${P.sky2}" stop-opacity="0.3"/>` +
        `</linearGradient>` +
        `<radialGradient id="${k}-core" cx="0.5" cy="0.4" r="0.55">` +
        `<stop offset="0" stop-color="${P.gold}"/><stop offset="1" stop-color="${P.gold}" stop-opacity="0"/>` +
        `</radialGradient>` +
        `</defs>` +
        `<path d="M4 82 A64 64 0 0 1 116 82 L116 100 A82 82 0 0 0 4 100Z" fill="url(#${k}-band)"/>` +
        `<path d="M4 82 A64 64 0 0 1 116 82" fill="none" stroke="${P.frost}" stroke-width="2.6"/>` +
        `<path d="M116 100 A82 82 0 0 0 4 100" fill="none" stroke="${P.slate2}" stroke-width="2.2" opacity="0.85"/>` +
        `<circle cx="60" cy="60" r="26" fill="url(#${k}-core)" opacity="0.65"/>` +
        `<path d="M60 4 L60 50" stroke="${P.ember}" stroke-width="3.2" stroke-linecap="round"/>` +
        `<circle cx="60" cy="58" r="7" fill="${P.gold}"/>`
      )
    },
  },
  'The SR-71’s altitude record': {
    subject: 'the Blackbird, all-black, a chined fuselage and twin canted tail fins over two mid-wing nacelles',
    draw: () => {
      const k = slug('The SR-71’s altitude record')
      return (
        `<defs>` +
        `<linearGradient id="${k}-body" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${P.slate}"/><stop offset="1" stop-color="${P.umber}"/>` +
        `</linearGradient>` +
        `<linearGradient id="${k}-chine" x1="0" y1="0" x2="1" y2="0">` +
        `<stop offset="0" stop-color="${P.cloud2}"/><stop offset="1" stop-color="${P.slate2}"/>` +
        `</linearGradient>` +
        `</defs>` +
        `<path d="M6 68 Q60 80 112 66" fill="none" stroke="${P.ember2}" stroke-width="1.6" stroke-dasharray="1 3" opacity="0.6"/>` +
        // Chined fuselage blending straight into the wing, drawn near-black.
        `<path d="M8 68 L60 60 L70 38 L76 38 L72 60 L106 62 L114 66 L72 66 L52 80 L44 80 L58 66 L8 68Z" fill="url(#${k}-body)"/>` +
        // The lit chine edge — the one highlight a fully black airframe
        // still shows in flight.
        `<path d="M8 68 L60 60 L64 63 L18 70Z" fill="url(#${k}-chine)" opacity="0.85"/>` +
        `<path d="M60 60 L68 42 L72 42 L68 60Z" fill="${P.cloud2}"/>` +
        // Two engine nacelles set mid-wing, each with its own tail fin
        // canted inward over it — never at the wingtips, never upright.
        `<ellipse cx="80" cy="51" rx="10" ry="3.2" fill="${P.slate2}" transform="rotate(-16 80 51)"/>` +
        `<path d="M78 49 L84 34 L88 36 L82 51Z" fill="${P.slate2}"/>` +
        `<circle cx="90" cy="52.5" r="2" fill="${P.ember}"/>` +
        `<ellipse cx="102" cy="59" rx="9" ry="3" fill="${P.slate2}" transform="rotate(-12 102 59)"/>` +
        `<path d="M100 57 L106 43 L110 45 L104 59Z" fill="${P.slate2}"/>` +
        `<circle cx="111" cy="60.5" r="2.2" fill="${P.ember}"/>`
      )
    },
  },
  'The Chelyabinsk meteor': {
    subject: 'an airburst, mid-shatter, trailing a streak of superheated air',
    draw: () => {
      const k = slug('The Chelyabinsk meteor')
      return (
        `<defs>` +
        `<linearGradient id="${k}-trail" gradientUnits="userSpaceOnUse" x1="104" y1="14" x2="42" y2="92">` +
        `<stop offset="0" stop-color="${P.ember}" stop-opacity="0"/><stop offset="1" stop-color="${P.flare}"/>` +
        `</linearGradient>` +
        `<radialGradient id="${k}-glow" cx="0.45" cy="0.4" r="0.6">` +
        `<stop offset="0" stop-color="${P.flare2}"/><stop offset="0.55" stop-color="${P.ember}"/><stop offset="1" stop-color="${P.ember}" stop-opacity="0"/>` +
        `</radialGradient>` +
        `<radialGradient id="${k}-core" cx="0.4" cy="0.35" r="0.55">` +
        `<stop offset="0" stop-color="${P.frost}"/><stop offset="1" stop-color="${P.gold}"/>` +
        `</radialGradient>` +
        `</defs>` +
        `<path d="M104 14 L42 92" stroke="url(#${k}-trail)" stroke-width="7" stroke-linecap="round"/>` +
        `<circle cx="40" cy="96" r="27" fill="url(#${k}-glow)"/>` +
        `<circle cx="40" cy="96" r="15" fill="url(#${k}-core)"/>` +
        `<circle cx="35" cy="90" r="6" fill="${P.frost}"/>` +
        `<circle cx="46" cy="102" r="3" fill="${P.umber}" opacity="0.65"/>` +
        `<circle cx="30" cy="104" r="2.4" fill="${P.umber}" opacity="0.6"/>` +
        `<path d="M22 100 L6 110 M28 114 L18 126 M52 108 L60 122" stroke="${P.gold}" stroke-width="2" opacity="0.65" stroke-linecap="round"/>`
      )
    },
  },
  'Where most weather balloons pop': {
    subject: 'a weather balloon, skin stretched translucent-thin, tearing open at its own equator',
    draw: () => {
      const k = slug('Where most weather balloons pop')
      return (
        `<defs>` +
        `<radialGradient id="${k}-skin" cx="0.4" cy="0.28" r="0.75">` +
        `<stop offset="0" stop-color="${P.frost}" stop-opacity="0.85"/><stop offset="1" stop-color="${P.steel}" stop-opacity="0.4"/>` +
        `</radialGradient>` +
        `<radialGradient id="${k}-burst" cx="0.5" cy="0.5" r="0.5">` +
        `<stop offset="0" stop-color="${P.frost}"/><stop offset="0.55" stop-color="${P.gold}"/><stop offset="1" stop-color="${P.gold}" stop-opacity="0"/>` +
        `</radialGradient>` +
        `</defs>` +
        // Stretched taller than it is wide — over-inflated, not merely
        // round — with the rupture torn open at its own equator and the
        // burst itself flashing straight through and past the silhouette.
        `<ellipse cx="60" cy="44" rx="27" ry="34" fill="url(#${k}-skin)"/>` +
        `<path d="M60 10 a27 34 0 1 0 0.1 0Z" fill="none" stroke="${P.frost}" stroke-width="2" opacity="0.8"/>` +
        `<circle cx="33" cy="46" r="15" fill="url(#${k}-burst)"/>` +
        `<path d="M22 40 L40 34 L34 46 L50 40 L44 52 L60 44" fill="none" stroke="${P.frost}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>` +
        `<path d="M27 28 L36 36 M19 54 L29 58" fill="none" stroke="${P.frost}" stroke-width="1.6" opacity="0.75" stroke-linecap="round"/>` +
        `<path d="M46 70 L52 88 L68 88 L74 70" fill="none" stroke="${P.frost}" stroke-width="1.8"/>` +
        `<rect x="52" y="88" width="16" height="12" fill="${P.gold}" opacity="0.9"/>` +
        `<path d="M26 26 L14 14 M92 28 L104 16" stroke="${P.ember}" stroke-width="2.2" opacity="0.75" stroke-linecap="round"/>` +
        `<path d="M84 34 L96 28 M18 50 L6 46" stroke="${P.ember2}" stroke-width="1.8" opacity="0.6" stroke-linecap="round"/>`
      )
    },
  },
  'Joseph Kittinger’s jump': {
    subject: 'a figure in a bulky 1960s pressure suit, one boot still hooked on the ledge, stepping out of an open gondola',
    draw: () => {
      const k = slug('Joseph Kittinger’s jump')
      return (
        `<defs>` +
        `<linearGradient id="${k}-suit" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0" stop-color="${P.cloud2}"/><stop offset="1" stop-color="${P.slate}"/>` +
        `</linearGradient>` +
        `<linearGradient id="${k}-helmet" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${P.frost}"/><stop offset="1" stop-color="${P.cloud2}"/>` +
        `</linearGradient>` +
        `</defs>` +
        // The open gondola he is stepping out of — a boxy rail well clear of
        // his helmet, not a padded modern capsule, drawn as bare structure
        // rather than a filled cabin.
        `<path d="M24 4 L92 4 L92 18 L24 18Z" fill="none" stroke="${P.frost}" stroke-width="2.4"/>` +
        `<path d="M24 18 L92 18" stroke="${P.steel}" stroke-width="3"/>` +
        `<path d="M84 4 L84 18" stroke="${P.frost}" stroke-width="1.6" opacity="0.7"/>` +
        // Torso: barrel-shaped and thick, the bulk of an era before suits
        // were tailored close to the body.
        `<path d="M48 46 Q60 40 72 46 L76 82 Q60 92 44 82Z" fill="url(#${k}-suit)"/>` +
        `<path d="M48 46 Q60 40 72 46 L69 56 Q60 51 51 56Z" fill="${P.steel}" opacity="0.55"/>` +
        // The era's own boxy parachute pack, humped on the back.
        `<rect x="42" y="50" width="11" height="24" rx="2" fill="${P.slate2}" opacity="0.85"/>` +
        // Helmet: rounder and heavier than a modern one, a narrow visor slit.
        `<circle cx="60" cy="34" r="11.5" fill="url(#${k}-helmet)"/>` +
        `<path d="M52 32 a8 8 0 0 0 16 0 L66 40 Q60 44 54 40Z" fill="${P.slate2}"/>` +
        `<circle cx="58" cy="32" r="4" fill="${P.skin}"/>` +
        // Thick gloved arms — one still hooked over the rail above him, the
        // other already reaching down into the fall.
        `<path d="M48 52 L30 18" stroke="${P.slate}" stroke-width="7.5" stroke-linecap="round"/>` +
        `<path d="M72 52 L90 70" stroke="${P.slate}" stroke-width="7.5" stroke-linecap="round"/>` +
        `<circle cx="30" cy="18" r="4.5" fill="${P.cloud2}"/><circle cx="90" cy="70" r="4.5" fill="${P.cloud2}"/>` +
        // One boot still hooked on the gondola floor, the other already
        // swinging clear — the mid-step this jump is remembered for.
        `<path d="M50 82 L42 104" stroke="${P.slate2}" stroke-width="7.5" stroke-linecap="round"/>` +
        `<path d="M70 82 L82 108" stroke="${P.slate2}" stroke-width="7.5" stroke-linecap="round"/>` +
        `<path d="M36 102 L48 106" stroke="${P.umber}" stroke-width="5.5" stroke-linecap="round"/>` +
        `<path d="M76 106 L90 112" stroke="${P.umber}" stroke-width="5.5" stroke-linecap="round"/>`
      )
    },
  },
  'The highest a balloon has ever reached': {
    subject: 'an unmanned high-altitude balloon alone at the top of its climb, a small instrument payload below',
    draw: () => {
      const k = slug('The highest a balloon has ever reached')
      return (
        `<defs>` +
        `<linearGradient id="${k}-skin" x1="0" y1="0" x2="1" y2="0">` +
        `<stop offset="0" stop-color="${P.frost}"/><stop offset="0.55" stop-color="${P.steel}"/><stop offset="1" stop-color="${P.cloud2}"/>` +
        `</linearGradient>` +
        `</defs>` +
        // The envelope: a lit near side fading across to a shadowed far side,
        // rather than one flat grey fill.
        `<ellipse cx="60" cy="42" rx="27" ry="36" fill="url(#${k}-skin)"/>` +
        // Its own seam lines, pole to pole — the gore panels a real balloon
        // this size is stitched from.
        `<path d="M60 6 Q42 42 60 78" fill="none" stroke="${P.cloud2}" stroke-width="1.2" opacity="0.6"/>` +
        `<path d="M60 6 Q78 42 60 78" fill="none" stroke="${P.slate}" stroke-width="1.2" opacity="0.5"/>` +
        `<path d="M60 6 Q51 42 60 78" fill="none" stroke="${P.cloud}" stroke-width="1" opacity="0.5"/>` +
        `<path d="M60 6 Q69 42 60 78" fill="none" stroke="${P.slate}" stroke-width="1" opacity="0.4"/>` +
        `<ellipse cx="49" cy="26" rx="8" ry="15" fill="${P.frost}" opacity="0.35"/>` +
        `<path d="M38 74 L46 96 L74 96 L82 74" fill="none" stroke="${P.steel}" stroke-width="1.8"/>` +
        `<rect x="48" y="96" width="24" height="14" rx="2" fill="${P.slate2}" stroke="${P.frost}" stroke-width="1.4"/>` +
        `<circle cx="56" cy="103" r="1.8" fill="${P.gold}"/>`
      )
    },
  },
  'Where a Falcon 9 lets its first stage go': {
    subject: 'a Falcon 9 booster falling away, grid fins deployed, flame still lit at its base — a rocket, not a plane',
    draw: () => {
      const k = slug('Where a Falcon 9 lets its first stage go')
      return (
        `<defs>` +
        `<linearGradient id="${k}-body" x1="0" y1="0" x2="1" y2="0">` +
        `<stop offset="0" stop-color="${P.frost}"/><stop offset="1" stop-color="${P.steel}"/>` +
        `</linearGradient>` +
        `<radialGradient id="${k}-flame" cx="0.5" cy="0.1" r="0.9">` +
        `<stop offset="0" stop-color="${P.flare}"/><stop offset="0.55" stop-color="${P.gold}"/>` +
        `<stop offset="1" stop-color="${P.ember}" stop-opacity="0"/>` +
        `</radialGradient>` +
        `</defs>` +
        // Second stage, already gone its own way above.
        `<rect x="53" y="16" width="14" height="26" rx="2" fill="url(#${k}-body)"/>` +
        `<path d="M53 16 L60 6 L67 16Z" fill="${P.frost}"/>` +
        `<path d="M60 42 L60 52" stroke="${P.gold}" stroke-width="1.4" stroke-dasharray="2 2" opacity="0.8"/>` +
        // The booster itself: a tall white cylinder, an interstage band,
        // grid fins near the top, flame still burning at the base.
        `<rect x="49" y="52" width="22" height="42" rx="2" fill="url(#${k}-body)"/>` +
        `<rect x="49" y="52" width="22" height="5" fill="${P.slate}" opacity="0.8"/>` +
        `<path d="M60 58 L60 94" stroke="${P.cloud2}" stroke-width="1" opacity="0.4"/>` +
        `<rect x="41" y="54" width="7" height="11" fill="${P.steel}"/>` +
        `<path d="M41 57 L48 57 M41 61 L48 61" stroke="${P.slate}" stroke-width="0.8" opacity="0.6"/>` +
        `<rect x="72" y="54" width="7" height="11" fill="${P.steel}"/>` +
        `<path d="M72 57 L79 57 M72 61 L79 61" stroke="${P.slate}" stroke-width="0.8" opacity="0.6"/>` +
        `<path d="M50 94 L70 94 L64 118 L56 118Z" fill="url(#${k}-flame)"/>` +
        `<ellipse cx="60" cy="97" rx="5" ry="4" fill="${P.gold}" opacity="0.9"/>`
      )
    },
  },
  'Noctilucent clouds': {
    subject: 'electric-blue cloud, lit after the ground has gone dark, its ribbons combed by high wind',
    draw: () => {
      const k = slug('Noctilucent clouds')
      return (
        // Bands of real width rather than single strokes — noctilucent cloud
        // photographs read as ribbons of light, not wire-frame lines, and a
        // 2px stroke at 46px is a scratch. Each ribbon is its own gradient
        // now, brighter toward its leading edge, so the sheet reads as light
        // raking across it rather than three flat washes stacked up.
        `<defs>` +
        `<linearGradient id="${k}-b1" x1="0" y1="0" x2="1" y2="0.25">` +
        `<stop offset="0" stop-color="${P.frost}"/><stop offset="1" stop-color="${P.noc}"/>` +
        `</linearGradient>` +
        `<linearGradient id="${k}-b2" x1="0" y1="0" x2="1" y2="0.25">` +
        `<stop offset="0" stop-color="${P.noc}"/><stop offset="1" stop-color="${P.noc2}"/>` +
        `</linearGradient>` +
        `<linearGradient id="${k}-b3" x1="0" y1="0" x2="1" y2="0.25">` +
        `<stop offset="0" stop-color="${P.noc2}"/><stop offset="1" stop-color="${P.sky2}"/>` +
        `</linearGradient>` +
        `</defs>` +
        `<path d="M4 60 Q40 46 76 60 Q98 70 120 56 L120 66 Q98 80 76 70 Q40 56 4 70Z" fill="url(#${k}-b1)" opacity="0.92"/>` +
        `<path d="M8 76 Q44 64 80 76 Q100 84 118 72 L118 80 Q100 92 80 84 Q44 72 8 84Z" fill="url(#${k}-b2)" opacity="0.85"/>` +
        `<path d="M16 92 Q48 84 82 92 L82 98 Q48 90 16 98Z" fill="url(#${k}-b3)" opacity="0.6"/>` +
        // The streaking the real thing is named for — thin combed lines along
        // the ribbon, catching more or less light than the sheet around them.
        `<path d="M14 62 Q40 52 66 62 M20 66 Q46 58 90 64" stroke="${P.frost}" stroke-width="1" opacity="0.55" fill="none"/>` +
        `<path d="M18 78 Q48 70 86 80 M30 82 Q60 76 100 82" stroke="${P.frost}" stroke-width="1" opacity="0.45" fill="none"/>`
      )
    },
  },
  'Tsar Bomba’s mushroom cloud': {
    subject: 'the largest detonation ever tested, a stem climbing into a genuinely overhanging, turbulent cap',
    draw: () => {
      const k = slug('Tsar Bomba’s mushroom cloud')
      return (
        `<defs>` +
        `<linearGradient id="${k}-stem" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${P.ember}"/><stop offset="1" stop-color="${P.umber}"/>` +
        `</linearGradient>` +
        `<radialGradient id="${k}-cap" cx="0.42" cy="0.3" r="0.8">` +
        `<stop offset="0" stop-color="${P.flare2}"/><stop offset="0.45" stop-color="${P.flare}"/><stop offset="1" stop-color="${P.ember2}"/>` +
        `</radialGradient>` +
        `<radialGradient id="${k}-core" cx="0.5" cy="0.5" r="0.5">` +
        `<stop offset="0" stop-color="${P.gold}"/><stop offset="1" stop-color="${P.flare}" stop-opacity="0"/>` +
        `</radialGradient>` +
        `</defs>` +
        // Stem, lit on one side by the fireball still burning above it.
        `<path d="M52 112 L54 64 L66 64 L68 112Z" fill="url(#${k}-stem)"/>` +
        `<path d="M52 112 L54 64 L58 64 L56 112Z" fill="${P.ember}" opacity="0.4"/>` +
        // The cap itself: genuinely wider than the neck and curling back in
        // underneath at both shoulders, not a lid sitting flat on the stem.
        `<path d="M50 66 Q20 60 16 38 Q14 16 40 10 Q60 6 80 10 Q106 16 104 38 Q100 60 70 66 ` +
        `Q88 70 84 82 Q80 92 66 86 Q60 82 60 74 Q60 82 54 86 Q40 92 36 82 Q32 70 50 66Z" fill="url(#${k}-cap)"/>` +
        `<circle cx="60" cy="30" r="26" fill="url(#${k}-core)"/>` +
        // Turbulence: cauliflower lumps of shifting tone along the rolling rim.
        `<circle cx="26" cy="32" r="10" fill="${P.flare}" opacity="0.85"/>` +
        `<circle cx="94" cy="30" r="11" fill="${P.ember2}" opacity="0.8"/>` +
        `<circle cx="44" cy="12" r="9" fill="${P.flare2}" opacity="0.9"/>` +
        `<circle cx="78" cy="10" r="8" fill="${P.flare2}" opacity="0.85"/>` +
        `<circle cx="18" cy="42" r="7" fill="${P.umber}" opacity="0.4"/>` +
        `<circle cx="100" cy="44" r="7" fill="${P.umber}" opacity="0.4"/>` +
        `<circle cx="80" cy="78" r="7" fill="${P.umber}" opacity="0.4"/>` +
        `<circle cx="42" cy="80" r="6" fill="${P.umber}" opacity="0.35"/>`
      )
    },
  },
  'The Kármán line': {
    subject: 'the boundary itself, a soft glowing band of light with nothing on either side',
    draw: () => {
      const k = slug('The Kármán line')
      return (
        `<defs>` +
        // A true glow, not a diagram — the line has no object to draw, so
        // it is drawn as the thing it actually is: a radial wash that fades
        // to nothing well before the frame edges, with a brighter linear
        // core running through the middle of it.
        `<radialGradient id="${k}-glow" cx="0.5" cy="0.5" r="0.55">` +
        `<stop offset="0" stop-color="${P.frost}" stop-opacity="0.95"/>` +
        `<stop offset="0.45" stop-color="${P.cyan}" stop-opacity="0.5"/>` +
        `<stop offset="1" stop-color="${P.cyan}" stop-opacity="0"/>` +
        `</radialGradient>` +
        `<linearGradient id="${k}-core" x1="0" y1="0" x2="1" y2="0">` +
        `<stop offset="0" stop-color="${P.cyan}" stop-opacity="0"/>` +
        `<stop offset="0.5" stop-color="${P.frost}" stop-opacity="0.95"/>` +
        `<stop offset="1" stop-color="${P.cyan}" stop-opacity="0"/>` +
        `</linearGradient>` +
        `</defs>` +
        `<ellipse cx="60" cy="60" rx="70" ry="30" fill="url(#${k}-glow)"/>` +
        `<rect x="4" y="51" width="112" height="18" fill="${P.cyan}" opacity="0.28"/>` +
        `<rect x="4" y="57.5" width="112" height="2" fill="url(#${k}-core)"/>` +
        // Grain in the glow's own core, so the band is not one flat wash —
        // flecks of brighter and darker light scattered along it.
        Array.from({ length: 12 }, (_, i) => {
          const x = 10 + rnd(53, i) * 100
          const y = 50 + rnd(53, i + 20) * 18
          const op = (0.3 + rnd(53, i + 40) * 0.45).toFixed(2)
          return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(0.7 + rnd(53, i + 60) * 1.1).toFixed(1)}" fill="${P.frost}" opacity="${op}"/>`
        }).join('') +
        Array.from({ length: 6 }, (_, i) => {
          const x = 14 + rnd(53, i + 80) * 92
          const y = 52 + rnd(53, i + 100) * 14
          return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(0.6 + rnd(53, i + 120) * 0.8).toFixed(1)}" fill="${P.slate}" opacity="0.35"/>`
        }).join('')
      )
    },
  },
  'The X-15’s highest flight': {
    subject: 'a stubby rocket plane, off the top of the chart',
    draw: () => {
      const k = slug('The X-15’s highest flight')
      return (
        `<defs>` +
        `<linearGradient id="${k}-body" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${P.frost}"/><stop offset="1" stop-color="${P.cloud2}"/>` +
        `</linearGradient>` +
        `<radialGradient id="${k}-flame" cx="0.5" cy="0.5" r="0.6">` +
        `<stop offset="0" stop-color="${P.gold}"/><stop offset="1" stop-color="${P.flare}"/>` +
        `</radialGradient>` +
        `</defs>` +
        `<path d="M18 96 Q50 46 84 20" fill="none" stroke="${P.ember2}" stroke-width="2" stroke-dasharray="3 4" opacity="0.7"/>` +
        // A rocket plane, not a jet: short, thick, wedge-nosed, stub wings
        // rather than a swept jet silhouette — the shape that made it a rocket
        // with a cockpit rather than an aircraft with an engine.
        `<g transform="translate(84 20) rotate(-32)">` +
        `<path d="M-24 -5 L18 -5 L26 0 L18 5 L-24 5 L-18 0Z" fill="url(#${k}-body)"/>` +
        `<path d="M-24 -5 L2 -5 L2 5 L-24 5Z" fill="${P.cloud2}" opacity="0.55"/>` +
        `<path d="M-4 -5 L-16 -16 L-8 -16 L2 -5Z" fill="${P.steel}"/>` +
        `<path d="M-4 5 L-16 16 L-8 16 L2 5Z" fill="${P.steel}" opacity="0.85"/>` +
        `<path d="M-24 -3 L-34 -3 L-34 3 L-24 3Z" fill="${P.slate}"/>` +
        // A solid, fully opaque exhaust plume (still visible at 46px), lit
        // by a real gradient rather than a single flat tone.
        `<ellipse cx="-32" cy="0" rx="6" ry="4" fill="url(#${k}-flame)"/>` +
        `<ellipse cx="-36" cy="0" rx="3" ry="2.2" fill="${P.frost}"/>` +
        `</g>`
      )
    },
  },

  /* ---- filling the 1,500m-to-Everest gap ----------------------------------- */

  'Where altitude sickness starts to bite': {
    subject: 'a hiker sitting on a boulder, head down, wrapped around their knees, cold and shaded',
    draw: () => {
      const k = slug('Where altitude sickness starts to bite')
      return (
        `<defs>` +
        `<radialGradient id="${k}-boulder" cx="0.4" cy="0.25" r="0.85">` +
        `<stop offset="0" stop-color="${P.cloud}"/><stop offset="1" stop-color="${P.slate2}"/>` +
        `</radialGradient>` +
        `<linearGradient id="${k}-jacket" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0" stop-color="${P.steel}"/><stop offset="1" stop-color="${P.slate}"/>` +
        `</linearGradient>` +
        `<linearGradient id="${k}-skin" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${P.skin}"/><stop offset="1" stop-color="${P.cloud2}"/>` +
        `</linearGradient>` +
        `</defs>` +
        `<path d="M18 100 Q22 78 44 78 Q62 78 64 96 Q66 106 48 108 L22 108 Q14 106 18 100Z" fill="url(#${k}-boulder)"/>` +
        `<path d="M20 102 Q30 98 40 100" fill="none" stroke="${P.umber}" stroke-width="1.6" opacity="0.35"/>` +
        `<path d="M24 92 Q34 84 46 88" fill="none" stroke="${P.frost}" stroke-width="1.2" opacity="0.4"/>` +
        `<path d="M40 68 Q40 58 50 58 Q60 58 60 70 L58 92 Q58 100 49 100 Q40 100 40 90Z" fill="url(#${k}-jacket)"/>` +
        `<path d="M50 58 Q60 58 60 70 L58 92 Q58 100 49 100 Q52 96 52 84 Q52 70 50 58Z" fill="${P.slate}" opacity="0.4"/>` +
        `<circle cx="49" cy="52" r="8.5" fill="url(#${k}-skin)"/>` +
        `<path d="M44 92 L36 104 M56 92 L64 102" stroke="${P.steel}" stroke-width="4.5" stroke-linecap="round"/>` +
        `<path d="M56 92 L64 102" stroke="${P.slate}" stroke-width="1.6" opacity="0.4"/>` +
        `<path d="M42 66 L34 82 M56 66 L64 80" stroke="url(#${k}-skin)" stroke-width="3.6" stroke-linecap="round"/>` +
        `<path d="M45 68 Q49 74 53 68" fill="none" stroke="${P.cloud2}" stroke-width="1.4" opacity="0.6"/>` +
        `<path d="M84 30 L90 104" stroke="${P.stem}" stroke-width="2.6" stroke-linecap="round"/>`
      )
    },
  },
  'La Paz, the highest capital city on Earth': {
    subject: 'a city built up the walls of a bowl-shaped valley, closer buildings lit and the bowl itself shadowed, a cable car crossing above it',
    draw: () => {
      const k = slug('La Paz, the highest capital city on Earth')
      return (
        `<defs>` +
        `<linearGradient id="${k}-valley" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${P.cloud2}"/><stop offset="1" stop-color="${P.umber}"/>` +
        `</linearGradient>` +
        `<linearGradient id="${k}-near" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${P.frost}"/><stop offset="1" stop-color="${P.steel}"/>` +
        `</linearGradient>` +
        `</defs>` +
        `<path d="M2 108 Q30 54 60 54 Q90 54 118 108Z" fill="url(#${k}-valley)"/>` +
        `<path d="M2 108 Q30 54 60 54 Q90 54 118 108" fill="none" stroke="${P.slate2}" stroke-width="1.6" opacity="0.6"/>` +
        `<path d="M14 96 Q60 66 106 96" fill="none" stroke="${P.slate2}" stroke-width="1.2" opacity="0.45"/>` +
        // Far buildings, deeper in the bowl's own shadow.
        `<rect x="41" y="78" width="6" height="30" fill="${P.cloud2}"/>` +
        `<rect x="66" y="94" width="6" height="14" fill="${P.cloud2}"/>` +
        // Near buildings, catching real light down the near wall.
        `<rect x="32" y="86" width="7" height="22" fill="url(#${k}-near)"/>` +
        `<rect x="49" y="90" width="6" height="18" fill="${P.cloud}"/>` +
        `<rect x="57" y="82" width="7" height="26" fill="url(#${k}-near)"/>` +
        `<rect x="74" y="88" width="6" height="20" fill="${P.cloud}"/>` +
        `<rect x="83" y="96" width="6" height="12" fill="url(#${k}-near)"/>` +
        `<circle cx="35.5" cy="92" r="0.9" fill="${P.slate}"/><circle cx="44" cy="84" r="0.9" fill="${P.slate}"/>` +
        `<circle cx="60.5" cy="88" r="0.9" fill="${P.slate}"/><circle cx="77" cy="94" r="0.9" fill="${P.slate}"/>` +
        `<path d="M16 62 L104 92" stroke="${P.cloud2}" stroke-width="1.3" opacity="0.7"/>` +
        `<line x1="56" y1="80" x2="56" y2="75" stroke="${P.cloud2}" stroke-width="1"/>` +
        `<rect x="51" y="75" width="10" height="6.5" rx="2" fill="${P.gold}"/>`
      )
    },
  },
  'Mont Blanc’s summit': {
    subject: 'a jagged, narrow double-peaked rock massif, snow on its two highest points and a shadowed face below',
    draw: () => {
      const k = slug('Mont Blanc’s summit')
      return (
        `<defs>` +
        `<linearGradient id="${k}-rock" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0" stop-color="${P.slate2}"/><stop offset="1" stop-color="${P.umber}"/>` +
        `</linearGradient>` +
        `<linearGradient id="${k}-shadow" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0" stop-color="${P.slate}"/><stop offset="1" stop-color="${P.umber}"/>` +
        `</linearGradient>` +
        `<linearGradient id="${k}-snow" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${P.frost}"/><stop offset="1" stop-color="${P.cloud}"/>` +
        `</linearGradient>` +
        `</defs>` +
        `<path d="M8 106 L50 32 L62 48 L76 20 L112 106Z" fill="url(#${k}-rock)"/>` +
        `<path d="M62 48 L76 20 L82 32 L68 58Z" fill="url(#${k}-shadow)"/>` +
        `<path d="M42 46 L50 32 L56 40 L46 58Z" fill="url(#${k}-shadow)" opacity="0.85"/>` +
        `<path d="M76 20 L90 42 L70 46 L62 48Z" fill="url(#${k}-snow)"/>` +
        `<path d="M50 32 L60 44 L42 46Z" fill="url(#${k}-snow)" opacity="0.95"/>` +
        `<path d="M66 40 L74 52 M78 34 L86 46" stroke="${P.cloud2}" stroke-width="2" opacity="0.85"/>` +
        `<path d="M20 92 L42 60 M32 98 L52 70 M84 92 L98 66" stroke="${P.cloud2}" stroke-width="1.8" opacity="0.6"/>`
      )
    },
  },
  'Kilimanjaro’s summit': {
    subject: 'a broad, flat-topped massif spanning nearly the full frame, a band of snow along its rim and cloud collar below',
    draw: () => {
      const k = slug('Kilimanjaro’s summit')
      return (
        `<defs>` +
        `<linearGradient id="${k}-rock" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${P.slate}"/><stop offset="1" stop-color="${P.slate2}"/>` +
        `</linearGradient>` +
        `<linearGradient id="${k}-snow" x1="0" y1="0" x2="1" y2="0">` +
        `<stop offset="0" stop-color="${P.frost}"/><stop offset="1" stop-color="${P.cloud}"/>` +
        `</linearGradient>` +
        `<linearGradient id="${k}-collar" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${P.cloud}"/><stop offset="1" stop-color="${P.cloud2}"/>` +
        `</linearGradient>` +
        `</defs>` +
        `<path d="M6 106 L34 52 Q60 38 86 52 L114 106Z" fill="url(#${k}-rock)"/>` +
        `<path d="M6 106 L34 52 Q60 42 60 48 Q60 60 34 92Z" fill="${P.umber}" opacity="0.3"/>` +
        `<path d="M34 52 Q60 40 86 52 L82 60 Q60 50 38 60Z" fill="url(#${k}-snow)"/>` +
        `<path d="M28 92 L44 64 M50 98 L64 66 M76 94 L92 64" stroke="${P.slate2}" stroke-width="1.3" opacity="0.55"/>` +
        `<ellipse cx="60" cy="80" rx="58" ry="10" fill="url(#${k}-collar)" opacity="0.65"/>` +
        `<ellipse cx="60" cy="86" rx="48" ry="8" fill="${P.cloud2}" opacity="0.5"/>`
      )
    },
  },
  'The highest-altitude spider ever found': {
    subject: 'a jumping spider, eight legs splayed, on a bare patch of rock, lit from the upper left',
    draw: () => {
      const k = slug('The highest-altitude spider ever found')
      return (
        `<defs>` +
        `<radialGradient id="${k}-rock" cx="0.4" cy="0.3" r="0.75">` +
        `<stop offset="0" stop-color="${P.steel}"/><stop offset="1" stop-color="${P.slate2}"/>` +
        `</radialGradient>` +
        `<linearGradient id="${k}-body" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${P.slate2}"/><stop offset="1" stop-color="${P.umber}"/>` +
        `</linearGradient>` +
        `</defs>` +
        `<ellipse cx="61" cy="99" rx="33" ry="9" fill="${P.slate}" opacity="0.4"/>` +
        `<ellipse cx="60" cy="96" rx="31" ry="9" fill="url(#${k}-rock)"/>` +
        `<path d="M30 96 Q46 91 60 95 Q78 91 92 96" fill="none" stroke="${P.slate2}" stroke-width="1" opacity="0.5"/>` +
        // Back legs, in the rock's own shadow — a shade darker than the
        // front pair, so the body reads as lit from one side.
        `<path d="M53 63 L34 70 M53 70 L37 89" fill="none" stroke="${P.cloud2}" stroke-width="2" stroke-linecap="round"/>` +
        `<path d="M67 63 L86 70 M67 70 L83 89" fill="none" stroke="${P.cloud2}" stroke-width="2" stroke-linecap="round"/>` +
        // Front legs, catching the light.
        `<path d="M53 50 L36 40 M53 56 L32 55" fill="none" stroke="${P.frost}" stroke-width="2" stroke-linecap="round"/>` +
        `<path d="M67 50 L84 40 M67 56 L88 55" fill="none" stroke="${P.frost}" stroke-width="2" stroke-linecap="round"/>` +
        `<ellipse cx="60" cy="63" rx="11" ry="14" fill="url(#${k}-body)"/>` +
        `<ellipse cx="56" cy="57" rx="4" ry="5" fill="${P.cloud2}" opacity="0.5"/>` +
        `<circle cx="60" cy="47" r="7.5" fill="url(#${k}-body)"/>` +
        `<circle cx="57" cy="45" r="1.3" fill="${P.frost}"/><circle cx="63" cy="45" r="1.3" fill="${P.frost}"/>` +
        `<circle cx="57.6" cy="44.4" r="0.5" fill="${P.slate2}"/><circle cx="63.6" cy="44.4" r="0.5" fill="${P.slate2}"/>` +
        `<path d="M52 60 Q60 66 68 60" fill="none" stroke="${P.slate}" stroke-width="1.2" opacity="0.5"/>`
      )
    },
  },
  'A bar-headed goose, crossing the Himalaya': {
    subject: 'a goose in level flight, neck extended, black bars across a pale head, wings modelled in real light',
    draw: () => {
      const k = slug('A bar-headed goose, crossing the Himalaya')
      return (
        `<defs>` +
        `<linearGradient id="${k}-wing" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${P.frost}"/><stop offset="1" stop-color="${P.cloud2}"/>` +
        `</linearGradient>` +
        `<linearGradient id="${k}-body" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0" stop-color="${P.frost}"/><stop offset="1" stop-color="${P.steel}"/>` +
        `</linearGradient>` +
        `</defs>` +
        `<path d="M10 106 L30 88 L46 102 L64 82 L84 102 L104 90 L118 106Z" fill="${P.slate2}" opacity="0.6"/>` +
        // Far wing, in its own shadow.
        `<path d="M52 62 Q30 42 14 48 Q28 60 50 68Z" fill="${P.cloud2}" opacity="0.9"/>` +
        `<path d="M46 54 Q34 50 24 52" fill="none" stroke="${P.slate2}" stroke-width="1" opacity="0.5"/>` +
        // Near wing, real gradient span from root to tip, plus feather
        // separation instead of one flat fan.
        `<path d="M70 62 Q92 42 108 48 Q94 60 72 68Z" fill="url(#${k}-wing)"/>` +
        `<path d="M76 56 Q90 48 102 50 M74 62 Q90 56 100 56" stroke="${P.steel}" stroke-width="1" opacity="0.55" fill="none"/>` +
        `<path d="M40 66 Q60 54 82 62 Q76 70 60 70 Q46 70 40 66Z" fill="url(#${k}-body)"/>` +
        `<path d="M78 62 Q92 58 99 66" fill="none" stroke="${P.frost}" stroke-width="5" stroke-linecap="round"/>` +
        `<circle cx="101" cy="67" r="5" fill="${P.frost}"/>` +
        `<path d="M97 63 Q101 61 105 63" fill="none" stroke="${P.slate}" stroke-width="1.6"/>` +
        `<path d="M98 70 Q101 72 104 70" fill="none" stroke="${P.slate}" stroke-width="1.6"/>` +
        `<path d="M106 66 L111 67 L106 69Z" fill="${P.gold}"/>`
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
  Object.entries(SPACE_ELEVATOR_ART).map(([title, s]) => [title, dominantMood(s.draw())]),
)

/** Full standalone SVG, sized to fill whatever box the marker gives it. */
export function sceneSvg(title: string): string {
  const s = SPACE_ELEVATOR_ART[title]
  if (!s) return ''
  return (
    `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" ` +
    `style="width:100%;height:100%;display:block" aria-hidden="true" focusable="false">` +
    `${s.draw()}</svg>`
  )
}
