/**
 * Ambient Mix's twelve layers, drawn.
 *
 * Each layer used to be a 24-unit UI glyph from `lib/icons.ts` at 26px in a
 * dark settings-row card — the exact tell item 34 in PLAN.md names for
 * pre-fix Spend It: "a UI glyph floating in a card is what made a page about
 * [the real subject] read as a settings screen." Twelve real synthesised
 * audio layers deserve to look like the twelve places they actually are
 * (a coast, a campfire, a 3am road) rather than twelve icons in a list.
 *
 * Same cut-out contract as `deep-sea-art.ts` and `space-elevator-art.ts`: no
 * background of its own — every scene sits directly on the card's own dark
 * ground, which already reads as night — and a `dominantMood` glow lights the
 * card behind it. `lib/icons.ts`'s small glyphs are untouched; they still do
 * the job they were drawn for everywhere else on the site.
 *
 * **No gradients, no ids, no defs, no filters.** Flat colour only, so all
 * twelve inline into one document without colliding.
 */

export const P = {
  ink: '#101a26',
  steel: '#3a4a5c',
  steel2: '#5b6d82',
  mist: '#c7d6e2',
  glass: '#eef5fb',
  teal: '#2f7a82',
  leaf: '#5f9c58',
  leaf2: '#a9d98f',
  bark: '#5c4632',
  ember: '#ff8a3d',
  emberLight: '#ffd27a',
  coffee: '#8a5a3c',
  cream: '#f0e0c0',
  slateBlue: '#55607a',
  bolt: '#fef08a',
  brass: '#c9a227',
  asphalt: '#2e3742',
  laneLine: '#e7ecf0',
  car: '#23303d',
  headlight: '#ffe9a8',
  taillight: '#e0503f',
  moss: '#2d4a52',
  cricketBody: '#7a5230',
  star: '#f4e9b8',
  mowerRed: '#c23b3b',
  grassA: '#4f8f4a',
  grassB: '#3e7440',
  modemBody: '#c9c2a8',
  modemDark: '#2c2a24',
  ledGreen: '#5fd67a',
  ledAmber: '#f2b84b',
} as const

export type Scene = {
  subject: string
  draw: () => string
}

const W = 100
const H = 100

export const AMBIENT_ART: Record<string, Scene> = {
  rain: {
    subject: 'a window, streaked, a roofline dark beyond the glass',
    draw: () =>
      `<path d="M6 66 L26 40 L46 66 L46 92 L6 92Z" fill="${P.ink}"/>` +
      `<path d="M50 70 L64 50 L78 70 L78 92 L50 92Z" fill="${P.ink}"/>` +
      `<rect x="20" y="16" width="60" height="46" rx="2" fill="none" stroke="${P.steel}" stroke-width="4"/>` +
      `<path d="M50 16 V62 M20 39 H80" stroke="${P.steel}" stroke-width="3"/>` +
      `<line x1="28" y1="22" x2="22" y2="36" stroke="${P.mist}" stroke-width="2" stroke-linecap="round" opacity="0.85"/>` +
      `<line x1="40" y1="20" x2="34" y2="34" stroke="${P.mist}" stroke-width="2" stroke-linecap="round" opacity="0.6"/>` +
      `<line x1="60" y1="24" x2="54" y2="38" stroke="${P.mist}" stroke-width="2" stroke-linecap="round" opacity="0.8"/>` +
      `<line x1="72" y1="21" x2="66" y2="35" stroke="${P.mist}" stroke-width="2" stroke-linecap="round" opacity="0.5"/>` +
      `<line x1="30" y1="45" x2="26" y2="57" stroke="${P.mist}" stroke-width="2" stroke-linecap="round" opacity="0.7"/>` +
      `<line x1="66" y1="47" x2="61" y2="59" stroke="${P.mist}" stroke-width="2" stroke-linecap="round" opacity="0.65"/>`,
  },
  waves: {
    subject: 'a shoreline, foam breaking on sand, a gull overhead',
    draw: () =>
      `<ellipse cx="50" cy="88" rx="46" ry="12" fill="${P.cream}"/>` +
      `<path d="M4 62 Q22 52 40 62 Q58 72 76 60 Q88 53 96 58" fill="none" stroke="${P.teal}" stroke-width="7" stroke-linecap="round"/>` +
      `<path d="M4 62 Q22 52 40 62 Q58 72 76 60 Q88 53 96 58 L96 80 L4 80Z" fill="${P.teal}" opacity="0.55"/>` +
      `<path d="M14 60 Q22 56 30 60" fill="none" stroke="${P.glass}" stroke-width="2.5" stroke-linecap="round"/>` +
      `<path d="M58 68 Q66 64 74 67" fill="none" stroke="${P.glass}" stroke-width="2.5" stroke-linecap="round"/>` +
      `<path d="M22 24 Q28 18 34 24 Q40 18 46 24" fill="none" stroke="${P.mist}" stroke-width="2.5" stroke-linecap="round"/>`,
  },
  wind: {
    subject: 'a leaning tree, grass swept the same way, a leaf loose in the air',
    draw: () =>
      `<path d="M60 92 L64 40" stroke="${P.bark}" stroke-width="5" stroke-linecap="round"/>` +
      `<path d="M64 40 Q40 34 30 46 Q46 40 62 48 Q42 50 34 60 Q52 54 66 52 Q52 60 48 68 Q60 60 70 54Z" fill="${P.leaf}"/>` +
      `<path d="M64 40 Q50 38 42 46" fill="none" stroke="${P.leaf2}" stroke-width="2" opacity="0.7"/>` +
      `<path d="M14 92 Q22 68 38 62" fill="none" stroke="${P.leaf}" stroke-width="4" stroke-linecap="round"/>` +
      `<path d="M22 92 Q28 72 42 66" fill="none" stroke="${P.leaf}" stroke-width="3.5" stroke-linecap="round"/>` +
      `<path d="M78 92 Q84 76 92 70" fill="none" stroke="${P.leaf}" stroke-width="3.5" stroke-linecap="round"/>` +
      `<ellipse cx="82" cy="34" rx="6" ry="3.2" fill="${P.leaf2}" transform="rotate(-30 82 34)" opacity="0.9"/>` +
      `<ellipse cx="90" cy="48" rx="4.5" ry="2.4" fill="${P.leaf2}" transform="rotate(-20 90 48)" opacity="0.7"/>`,
  },
  fire: {
    subject: 'logs crossed over embers, a flame standing above them',
    draw: () =>
      `<rect x="24" y="76" width="52" height="7" rx="3" fill="${P.bark}" transform="rotate(-6 50 80)"/>` +
      `<rect x="26" y="78" width="52" height="7" rx="3" fill="${P.bark}" transform="rotate(9 52 82)"/>` +
      `<circle cx="42" cy="80" r="2" fill="${P.emberLight}" opacity="0.8"/>` +
      `<circle cx="60" cy="82" r="1.6" fill="${P.emberLight}" opacity="0.7"/>` +
      `<path d="M50 88 C34 70 38 46 52 24 C60 44 50 54 58 62 C66 50 64 40 68 34 C74 52 70 70 50 88Z" fill="${P.ember}"/>` +
      `<path d="M50 84 C40 70 42 54 52 38 C56 50 50 56 54 62 C60 54 58 48 60 44 C64 56 62 68 50 84Z" fill="${P.emberLight}"/>` +
      `<circle cx="30" cy="52" r="2" fill="${P.emberLight}" opacity="0.75"/>` +
      `<circle cx="72" cy="40" r="1.6" fill="${P.emberLight}" opacity="0.6"/>` +
      `<circle cx="66" cy="20" r="1.4" fill="${P.ember}" opacity="0.55"/>`,
  },
  cafe: {
    subject: 'a cup on a saucer, steam curling off it',
    draw: () =>
      `<ellipse cx="50" cy="80" rx="30" ry="7" fill="${P.cream}"/>` +
      `<path d="M28 50 H68 L64 74 Q50 80 36 74Z" fill="${P.coffee}"/>` +
      `<ellipse cx="48" cy="50" rx="20" ry="5" fill="${P.ink}" opacity="0.5"/>` +
      `<path d="M68 56 Q84 56 82 68 Q80 76 66 74" fill="none" stroke="${P.coffee}" stroke-width="4.5"/>` +
      `<path d="M40 42 Q36 34 42 28 Q46 24 42 16" fill="none" stroke="${P.mist}" stroke-width="2.5" stroke-linecap="round" opacity="0.8"/>` +
      `<path d="M56 42 Q60 32 54 26 Q50 22 56 14" fill="none" stroke="${P.mist}" stroke-width="2.5" stroke-linecap="round" opacity="0.55"/>`,
  },
  birds: {
    subject: 'a bird perched on a branch, wings folded, a warm breast',
    draw: () =>
      `<path d="M4 62 L96 46" stroke="${P.bark}" stroke-width="5" stroke-linecap="round"/>` +
      `<ellipse cx="56" cy="42" rx="20" ry="16" fill="${P.steel2}"/>` +
      `<circle cx="38" cy="30" r="10" fill="${P.steel2}"/>` +
      `<path d="M28 29 L18 26 L28 33Z" fill="${P.brass}"/>` +
      `<circle cx="35" cy="27" r="1.6" fill="${P.ink}"/>` +
      `<path d="M46 44 Q58 54 70 46 Q60 58 46 56Z" fill="${P.ember}"/>` +
      `<path d="M56 46 Q68 44 76 52 L58 54Z" fill="${P.ink}" opacity="0.7"/>` +
      `<path d="M18 20 Q22 16 27 19" fill="none" stroke="${P.mist}" stroke-width="1.6" opacity="0.6"/>` +
      `<path d="M78 16 Q83 12 88 15" fill="none" stroke="${P.mist}" stroke-width="1.6" opacity="0.5"/>`,
  },
  crickets: {
    subject: 'a cricket on a blade of grass, at night, among a few stars',
    draw: () =>
      `<path d="M18 92 L24 44" stroke="${P.moss}" stroke-width="4" stroke-linecap="round"/>` +
      `<path d="M34 92 L38 30" stroke="${P.moss}" stroke-width="4" stroke-linecap="round"/>` +
      `<path d="M50 92 L48 50" stroke="${P.moss}" stroke-width="4" stroke-linecap="round"/>` +
      `<path d="M64 92 L62 40" stroke="${P.moss}" stroke-width="4" stroke-linecap="round"/>` +
      `<ellipse cx="60" cy="58" rx="16" ry="8" fill="${P.cricketBody}" transform="rotate(-10 60 58)"/>` +
      `<path d="M50 56 Q62 46 76 52 Q64 54 58 60Z" fill="${P.moss}" opacity="0.85"/>` +
      `<path d="M46 62 L34 70 M50 66 L42 78 M72 62 L82 56 M76 66 L86 66" stroke="${P.cricketBody}" stroke-width="2" stroke-linecap="round"/>` +
      `<path d="M48 52 L40 46 M52 52 L46 44" stroke="${P.cricketBody}" stroke-width="1.6" stroke-linecap="round"/>` +
      `<circle cx="14" cy="18" r="1.4" fill="${P.star}" opacity="0.85"/>` +
      `<circle cx="82" cy="14" r="1.6" fill="${P.star}" opacity="0.7"/>` +
      `<circle cx="90" cy="30" r="1.2" fill="${P.star}" opacity="0.6"/>`,
  },
  traffic: {
    subject: 'a car passing on a dark road, headlight and taillight glowing',
    draw: () =>
      `<rect x="0" y="58" width="100" height="26" fill="${P.asphalt}"/>` +
      `<rect x="4" y="70" width="14" height="3" fill="${P.laneLine}" opacity="0.85"/>` +
      `<rect x="30" y="70" width="14" height="3" fill="${P.laneLine}" opacity="0.85"/>` +
      `<rect x="56" y="70" width="14" height="3" fill="${P.laneLine}" opacity="0.85"/>` +
      `<rect x="82" y="70" width="14" height="3" fill="${P.laneLine}" opacity="0.85"/>` +
      `<path d="M18 62 L26 50 L62 50 L74 62Z" fill="${P.car}"/>` +
      `<path d="M30 51 L40 44 L54 44 L58 51Z" fill="${P.steel2}" opacity="0.7"/>` +
      `<ellipse cx="18" cy="60" rx="4.5" ry="6" fill="${P.headlight}"/>` +
      `<path d="M2 58 L18 60" stroke="${P.headlight}" stroke-width="2" opacity="0.4"/>` +
      `<ellipse cx="74" cy="60" rx="3" ry="4.5" fill="${P.taillight}"/>` +
      `<path d="M74 60 L96 58" stroke="${P.taillight}" stroke-width="2" opacity="0.35"/>`,
  },
  clock: {
    subject: 'a clock on the wall, hands past the hour',
    draw: () =>
      `<circle cx="50" cy="50" r="38" fill="${P.cream}"/>` +
      `<circle cx="50" cy="50" r="38" fill="none" stroke="${P.brass}" stroke-width="5"/>` +
      `<g stroke="${P.ink}" stroke-width="2.5" stroke-linecap="round">` +
      `<line x1="50" y1="16" x2="50" y2="22"/><line x1="50" y1="78" x2="50" y2="84"/>` +
      `<line x1="16" y1="50" x2="22" y2="50"/><line x1="78" y1="50" x2="84" y2="50"/>` +
      `<line x1="27" y1="27" x2="31" y2="31"/><line x1="73" y1="27" x2="69" y2="31"/>` +
      `<line x1="27" y1="73" x2="31" y2="69"/><line x1="73" y1="73" x2="69" y2="69"/></g>` +
      `<line x1="50" y1="50" x2="50" y2="26" stroke="${P.ink}" stroke-width="3.5" stroke-linecap="round"/>` +
      `<line x1="50" y1="50" x2="70" y2="60" stroke="${P.ink}" stroke-width="3" stroke-linecap="round"/>` +
      `<circle cx="50" cy="50" r="4" fill="${P.ink}"/>`,
  },
  thunder: {
    subject: 'a storm cloud, a bolt breaking from it, rain underneath',
    draw: () =>
      `<ellipse cx="40" cy="42" rx="22" ry="16" fill="${P.slateBlue}"/>` +
      `<ellipse cx="62" cy="38" rx="24" ry="18" fill="${P.slateBlue}"/>` +
      `<ellipse cx="50" cy="48" rx="26" ry="14" fill="${P.steel}"/>` +
      `<path d="M56 50 L44 66 L54 66 L42 92 L64 62 L52 62Z" fill="${P.bolt}"/>` +
      `<line x1="24" y1="68" x2="20" y2="80" stroke="${P.mist}" stroke-width="2" stroke-linecap="round" opacity="0.6"/>` +
      `<line x1="76" y1="66" x2="72" y2="80" stroke="${P.mist}" stroke-width="2" stroke-linecap="round" opacity="0.55"/>`,
  },
  mower: {
    subject: 'a lawnmower on cut grass, clippings behind it',
    draw: () =>
      `<path d="M10 88 Q30 82 50 88 Q70 82 90 88" fill="none" stroke="${P.grassA}" stroke-width="6" stroke-linecap="round"/>` +
      `<path d="M10 92 Q30 86 50 92 Q70 86 90 92" fill="none" stroke="${P.grassB}" stroke-width="6" stroke-linecap="round"/>` +
      `<path d="M46 40 L74 28" stroke="${P.ink}" stroke-width="5" stroke-linecap="round"/>` +
      `<rect x="18" y="52" width="46" height="26" rx="10" fill="${P.mowerRed}"/>` +
      `<circle cx="26" cy="80" r="9" fill="${P.ink}"/>` +
      `<circle cx="56" cy="80" r="9" fill="${P.ink}"/>` +
      `<circle cx="26" cy="80" r="3" fill="${P.steel2}"/>` +
      `<circle cx="56" cy="80" r="3" fill="${P.steel2}"/>` +
      `<rect x="34" y="46" width="14" height="10" rx="2" fill="${P.steel2}"/>` +
      `<ellipse cx="18" cy="30" rx="3" ry="6" fill="${P.leaf2}" transform="rotate(30 18 30)" opacity="0.8"/>` +
      `<ellipse cx="10" cy="42" rx="2.4" ry="5" fill="${P.leaf2}" transform="rotate(50 10 42)" opacity="0.65"/>`,
  },
  dial: {
    subject: 'a modem, lights blinking, a cable curling off the back',
    draw: () =>
      `<path d="M70 40 Q86 40 88 54 Q90 66 78 70" fill="none" stroke="${P.steel}" stroke-width="3.5" opacity="0.8"/>` +
      `<rect x="14" y="38" width="66" height="34" rx="6" fill="${P.modemBody}"/>` +
      `<rect x="14" y="38" width="66" height="10" rx="4" fill="${P.modemDark}"/>` +
      `<circle cx="24" cy="43" r="2.4" fill="${P.ledGreen}"/>` +
      `<circle cx="33" cy="43" r="2.4" fill="${P.ledAmber}"/>` +
      `<circle cx="42" cy="43" r="2.4" fill="${P.ledGreen}"/>` +
      `<line x1="22" y1="60" x2="72" y2="60" stroke="${P.modemDark}" stroke-width="2.5" opacity="0.6"/>` +
      `<line x1="22" y1="66" x2="72" y2="66" stroke="${P.modemDark}" stroke-width="2.5" opacity="0.6"/>` +
      `<line x1="14" y1="55" x2="6" y2="55" stroke="${P.ink}" stroke-width="3" stroke-linecap="round"/>`,
  },
}

/** Deterministic scatter, same generator as the other art modules. */
export const rnd = (seed: number, k: number) => {
  const x = Math.sin(seed * 9301 + k * 49297) * 233280
  return x - Math.floor(x)
}

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
    const opacityAttr = num(attrs, 'opacity')
    const opacity = opacityAttr === undefined ? 1 : opacityAttr
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
    area *= opacity
    if (fill && fill !== 'none') add(fill, area)
    else if (stroke && stroke !== 'none') add(stroke, area * 0.3)
  }

  let best: string | null = null
  let bestArea = 0
  for (const [hex, area] of weight) if (area > bestArea) { best = hex; bestArea = area }
  return best ?? P.mist
}

export const MOOD: Record<string, string> = Object.fromEntries(
  Object.entries(AMBIENT_ART).map(([id, s]) => [id, dominantMood(s.draw())]),
)

/** Full standalone SVG, sized to fill whatever box the layer gives it. */
export function sceneSvg(id: string): string {
  const s = AMBIENT_ART[id]
  if (!s) return ''
  return (
    `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" ` +
    `style="width:100%;height:100%;display:block" aria-hidden="true" focusable="false">` +
    `${s.draw()}</svg>`
  )
}
