/**
 * Progress's watch.
 *
 * The page used to draw fifteen spans of time as fifteen rings, and fifteen
 * rings look alike. This is the same fifteen as one astronomical watch, each
 * span shown by the thing that has always shown it:
 *
 *   second, minute, hour   the three hands
 *   today                  the Earth from over the pole, turning under a
 *                          fixed Sun, against a 24-hour ring
 *   week, weekend          a day-of-the-week dial, the last two days tinted
 *   lunar cycle            the Moon, at the phase it is at
 *   month                  a pointer on a ring of thirty-one dates
 *   quarter, year          a dial of twelve months in four arcs
 *   decade, century,       the year on four drums, each rolling as its own
 *   millennium             span runs out
 *   32-bit time            the count itself, in lamps
 *   the Sun's life         a reserve gauge
 *
 * This file is the arithmetic and the drawing, with no imports, so the node
 * check reads it as it is. The page moves the hands; the Earth is a small
 * shader of its own (progress-earth.ts) set into the lower dial.
 *
 * Everything is drawn in one square of 1000 units, centre at 0,0.
 */

export const SUB = { moon: [0, -212], week: [-212, 0], annual: [212, 0], earth: [0, 212] } as const
export const SUB_R = 112
/** The Earth's disc inside its dial, as a fraction of the watch's width: centre x, centre y, radius. */
export const EARTH_BOX = { cx: 0.5, cy: 0.5 + 212 / 1000, r: 84 / 1000 }

const DAY = 86_400_000

/** Hands, in degrees clockwise from twelve. Local time, and the seconds hand sweeps. */
export function handAngles(d: Date) {
  const s = d.getSeconds() + d.getMilliseconds() / 1000
  const m = d.getMinutes() + s / 60
  const h = (d.getHours() % 12) + m / 60
  const dayFrac = (d.getHours() + m / 60) / 24
  return {
    second: s * 6,
    minute: m * 6,
    hour: h * 30,
    /** A slot of 1/31 of the ring for each date; the pointer is inside today's. */
    date: ((d.getDate() - 1 + dayFrac) / 31) * 360,
  }
}

/**
 * Where the Sun is overhead, in degrees: longitude east, latitude north.
 * Good to about a degree of latitude and four of longitude (the equation of
 * time is left out), which on a dial a centimetre across is nothing.
 */
export function subsolar(d: Date) {
  const utcHours = (((+d % DAY) + DAY) % DAY) / 3_600_000
  const start = Date.UTC(d.getUTCFullYear(), 0, 1)
  const dayOfYear = (+d - start) / DAY
  let lon = (12 - utcHours) * 15
  if (lon <= -180) lon += 360
  return { lon, lat: -23.44 * Math.cos((2 * Math.PI * (dayOfYear + 10)) / 365.2422) }
}

/**
 * The year as four drums. A drum shows its digit, and rolls toward the next
 * only while the drum to its right is going from nine to nought, which is
 * how an odometer does it: so the tens drum moves through the last year of a
 * decade, the hundreds through the last year of a century.
 */
export function drums(year: number, yearFrac: number) {
  const out: { digit: number; next: number; roll: number }[] = []
  let roll = yearFrac
  let rest = year
  for (let k = 0; k < 4; k++) {
    const digit = rest % 10
    // A drum holds its digit for most of its span and turns over at the end of it,
    // or the year would read as next year from July.
    out.unshift({ digit, next: (digit + 1) % 10, roll: Math.pow(roll, 24) })
    roll = digit === 9 ? roll : 0
    rest = Math.floor(rest / 10)
  }
  return out
}

/** The lit part of the Moon as a path, for a phase from 0 (new) through 0.5 (full) to 1. Lit on the right while waxing, as seen from the north. */
export function moonPath(phase: number, R: number) {
  const p = ((phase % 1) + 1) % 1
  const rx = Math.max(0.01, Math.abs(Math.cos(2 * Math.PI * p)) * R).toFixed(2)
  const waxing = p < 0.5
  const crescent = waxing ? p < 0.25 : p > 0.75
  // Drawn as if waxing, then mirrored for the other half of the month.
  const path = `M0 ${-R}A${R} ${R} 0 0 1 0 ${R}A${rx} ${R} 0 0 ${crescent ? 0 : 1} 0 ${-R}Z`
  return { d: path, flip: !waxing, lit: (1 - Math.cos(2 * Math.PI * p)) / 2 }
}

/** Unix time as its 32 signed bits, most significant first. */
export function bits(d: Date) {
  const s = Math.floor(+d / 1000)
  let out = ''
  for (let k = 31; k >= 0; k--) out += Math.floor(s / 2 ** k) % 2 ? '1' : '0'
  return out
}

/* ------------------------------------------------------------- drawing -- */

const f = (n: number) => +n.toFixed(2)
const polar = (r: number, deg: number): [number, number] => {
  const a = ((deg - 90) * Math.PI) / 180
  return [f(r * Math.cos(a)), f(r * Math.sin(a))]
}
const arc = (r: number, a0: number, a1: number) => {
  const [x0, y0] = polar(r, a0), [x1, y1] = polar(r, a1)
  return `M${x0} ${y0}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`
}

/** A hand and its shadow. The shadow is a second copy set down and to the right, not a filter: a filter on something that turns every frame is re-rasterised every frame. */
function hand(id: string, unit: string, shape: string, lift: number) {
  return `<g transform="translate(${lift} ${lift * 1.6})"><g class="hand-shadow" data-hand="${id}">${shape.replace(/class="[^"]*"/g, 'class="sh"')}</g></g>` +
    `<g class="hand wc" data-hand="${id}" data-u="${unit}">${shape}</g>`
}

/** The Sun's reserve gauge, filled to a fraction. */
export const sunArc = (frac: number) => arc(44, -135, -135 + 270 * Math.min(1, Math.max(0.01, frac)))

/**
 * Two layers, because the Earth is a canvas and the hands have to pass over
 * it: everything under the Earth, and everything above.
 */
export function watchSvg(): { base: string; top: string } {
  const p: string[] = []
  const open = (cls: string, extra = '') => `<svg class="watch-svg ${cls}" viewBox="-500 -500 1000 1000"${extra}>`
  p.push(open('watch-base', ' role="img" aria-label="A watch showing every span of time in the list below"'))
  p.push(`<defs>
    <linearGradient id="pw-steel" x1="0" y1="0" x2="0.35" y2="1"><stop offset="0" stop-color="#f4f6fc"/><stop offset="0.28" stop-color="#9aa1b8"/><stop offset="0.5" stop-color="#e3e7f2"/><stop offset="0.74" stop-color="#5a6077"/><stop offset="1" stop-color="#b9bfd2"/></linearGradient>
    <linearGradient id="pw-steel2" x1="0" y1="1" x2="0.4" y2="0"><stop offset="0" stop-color="#eef1f8"/><stop offset="0.45" stop-color="#6d7389"/><stop offset="1" stop-color="#d7dbe8"/></linearGradient>
    <radialGradient id="pw-dial" cx="0.42" cy="0.36" r="0.75"><stop offset="0" stop-color="#3a2f78"/><stop offset="0.55" stop-color="#1c1746"/><stop offset="1" stop-color="#0a0820"/></radialGradient>
    <radialGradient id="pw-sub" cx="0.5" cy="0.42" r="0.6"><stop offset="0" stop-color="#151235"/><stop offset="1" stop-color="#07061a"/></radialGradient>
    <linearGradient id="pw-lip" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#05040f"/><stop offset="1" stop-color="#8f96b4"/></linearGradient>
    <linearGradient id="pw-hand" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#f7f8fd"/><stop offset="0.49" stop-color="#e2e6f2"/><stop offset="0.51" stop-color="#8d94ad"/><stop offset="1" stop-color="#c9cedd"/></linearGradient>
    <radialGradient id="pw-moon" cx="0.4" cy="0.35" r="0.75"><stop offset="0" stop-color="#fbfbff"/><stop offset="1" stop-color="#b9bdd0"/></radialGradient>
    <linearGradient id="pw-glare" x1="0.1" y1="0" x2="0.6" y2="0.8"><stop offset="0" stop-color="#fff" stop-opacity="0.16"/><stop offset="0.45" stop-color="#fff" stop-opacity="0.03"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <radialGradient id="pw-edge" cx="0.5" cy="0.5" r="0.5"><stop offset="0.86" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.55"/></radialGradient>
    <clipPath id="pw-moonclip"><circle r="92"/></clipPath>
  </defs>`)

  /* ---- case ---- */
  p.push(`<g class="case">`)
  p.push(`<rect x="478" y="-34" width="22" height="68" rx="7" fill="url(#pw-steel2)"/>`)
  for (let k = -3; k <= 3; k++) p.push(`<rect x="480" y="${k * 9 - 1.5}" width="18" height="3" fill="#000" opacity="0.28"/>`)
  p.push(`<circle r="486" fill="url(#pw-steel)"/><circle r="486" fill="none" stroke="#0b0c14" stroke-opacity="0.5" stroke-width="2"/>`)
  // Brushing on the bezel: fine radial strokes, too faint to count.
  const brush: string[] = []
  for (let k = 0; k < 240; k++) { const [x0, y0] = polar(446, k * 1.5), [x1, y1] = polar(484, k * 1.5); brush.push(`M${x0} ${y0}L${x1} ${y1}`) }
  p.push(`<path d="${brush.join('')}" stroke="#fff" stroke-opacity="0.10" stroke-width="1.6"/>`)
  p.push(`<circle r="446" fill="none" stroke="url(#pw-steel2)" stroke-width="10"/><circle r="440" fill="url(#pw-lip)"/>`)
  p.push(`</g>`)

  /* ---- dial ---- */
  p.push(`<circle r="434" fill="url(#pw-dial)"/>`)
  const rays: string[] = []
  for (let k = 0; k < 120; k++) { const [x, y] = polar(434, k * 3 + (k % 2 ? 0.7 : 0)); rays.push(`M0 0L${x} ${y}`) }
  p.push(`<path class="rays" d="${rays.join('')}" stroke="#b9a8ff" stroke-opacity="0.045" stroke-width="5"/>`)

  // Seconds and minutes: one track of sixty at the edge.
  const ticks: string[] = [], fives: string[] = []
  for (let k = 0; k < 60; k++) { const [x0, y0] = polar(k % 5 ? 420 : 412, k * 6), [x1, y1] = polar(430, k * 6); (k % 5 ? ticks : fives).push(`M${x0} ${y0}L${x1} ${y1}`) }
  p.push(`<g class="wc" data-u="second minute"><path d="${ticks.join('')}" stroke="#c9cbe6" stroke-opacity="0.7" stroke-width="2"/><path d="${fives.join('')}" stroke="#fff" stroke-width="4"/></g>`)

  // The date ring.
  p.push(`<g class="wc" data-u="month"><circle class="hit" r="386" fill="none" stroke-width="30"/>`)
  for (let n = 1; n <= 31; n++) {
    const a = ((n - 0.5) / 31) * 360
    const [x, y] = polar(388, a)
    p.push(n % 2 ? `<text class="t-date" x="${x}" y="${y}" transform="rotate(${f(a > 90 && a < 270 ? a + 180 : a)} ${x} ${y})">${n}</text>` : `<circle cx="${x}" cy="${y}" r="2.6" fill="#8e8fc0"/>`)
  }
  p.push(`</g>`)

  // Hours: batons, except where a dial sits.
  p.push(`<g class="wc" data-u="hour">`)
  for (let h = 0; h < 12; h++) {
    if (h % 3 === 0) { const [x, y] = polar(346, h * 30); p.push(`<circle cx="${x}" cy="${y}" r="7" fill="#eef0fa"/><circle cx="${x}" cy="${y}" r="4" fill="#bff5e6"/>`); continue }
    p.push(`<g transform="rotate(${h * 30})"><rect x="-8.5" y="-364" width="17" height="52" rx="3" fill="#05040f" opacity="0.45" transform="translate(3 4)"/><rect x="-8.5" y="-364" width="17" height="52" rx="3" fill="url(#pw-hand)"/><rect x="-4" y="-358" width="8" height="40" rx="2" fill="#bff5e6"/></g>`)
  }
  p.push(`</g>`)

  const sub = (c: readonly [number, number] | readonly number[], r = SUB_R) =>
    `<circle cx="${c[0]}" cy="${c[1]}" r="${r + 5}" fill="url(#pw-lip)"/><circle cx="${c[0]}" cy="${c[1]}" r="${r}" fill="url(#pw-sub)"/>` +
    [0.86, 0.7, 0.54].map((k) => `<circle cx="${c[0]}" cy="${c[1]}" r="${f(r * k)}" fill="none" stroke="#fff" stroke-opacity="0.035"/>`).join('')

  /* ---- the Moon ---- */
  p.push(`<g class="wc" data-u="lunation" transform="translate(${SUB.moon[0]} ${SUB.moon[1]})">${sub([0, 0])}`)
  p.push(`<g clip-path="url(#pw-moonclip)">`)
  for (const [x, y, r] of [[-70, -40, 1.6], [-52, 48, 1.2], [62, -58, 1.4], [74, 30, 1.8], [-30, -76, 1.1], [40, 72, 1.3], [-80, 10, 1.0], [14, -84, 1.5]]) p.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="#dfe3ff" opacity="0.8"/>`)
  p.push(`<circle r="58" fill="#1a1c33"/><g id="pw-moon-lit"><path id="pw-moon-path" fill="url(#pw-moon)"/></g>`)
  // A few seas, drawn over lit and unlit alike: they are there either way.
  for (const [x, y, r] of [[-16, -20, 15], [12, -30, 10], [-26, 8, 11], [20, 6, 13], [2, 30, 9]]) p.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="#1a1c33" opacity="0.16"/>`)
  p.push(`</g><text class="t-cap" y="92">MOON</text><circle class="hit" r="${SUB_R}"/></g>`)

  /* ---- the week ---- */
  p.push(`<g class="wc" data-u="week" transform="translate(${SUB.week[0]} ${SUB.week[1]})">${sub([0, 0])}`)
  p.push(`<circle class="hit" r="${SUB_R}"/>`)
  // Saturday and Sunday are the last two sevenths.
  p.push(`<g class="wc" data-u="weekend"><path d="${arc(96, (5 / 7) * 360 + 2, 358)}" stroke="#b8a1ff" stroke-width="20" stroke-opacity="0.26" fill="none"/><path class="hit" d="${arc(84, (5 / 7) * 360, 360)}" stroke-width="56" fill="none"/></g>`)
  'MTWTFSS'.split('').forEach((ch, k) => {
    const [x, y] = polar(84, ((k + 0.5) / 7) * 360)
    p.push(`<text class="t-sub${k > 4 ? ' t-we' : ''}" x="${x}" y="${y}">${ch}</text>`)
    const [x0, y0] = polar(100, (k / 7) * 360), [x1, y1] = polar(110, (k / 7) * 360)
    p.push(`<path d="M${x0} ${y0}L${x1} ${y1}" stroke="#c9cbe6" stroke-width="2"/>`)
  })
  p.push(`<g id="pw-week-hand"><path d="M-3.5 14L0 -74L3.5 14Z" fill="url(#pw-hand)"/></g><circle r="7" fill="url(#pw-steel)"/></g>`)

  /* ---- the year ---- */
  p.push(`<g class="wc" data-u="year" transform="translate(${SUB.annual[0]} ${SUB.annual[1]})">${sub([0, 0])}`)
  p.push(`<circle class="hit" r="${SUB_R}"/>`)
  p.push(`<g class="wc" data-u="quarter">`)
  for (let q = 0; q < 4; q++) p.push(`<path d="${arc(103, q * 90 + 4, q * 90 + 86)}" stroke="#${q % 2 ? '8e8fc0' : 'd9dbf2'}" stroke-width="5" fill="none"/><path class="hit" d="${arc(100, q * 90, q * 90 + 90)}" stroke-width="24" fill="none"/>`)
  p.push(`</g>`)
  'JFMAMJJASOND'.split('').forEach((ch, k) => { const [x, y] = polar(80, (k + 0.5) * 30); p.push(`<text class="t-sub t-mo" x="${x}" y="${y}">${ch}</text>`) })
  p.push(`<g id="pw-year-hand"><path d="M-3.5 14L0 -86L3.5 14Z" fill="url(#pw-hand)"/></g><circle r="7" fill="url(#pw-steel)"/></g>`)

  /* ---- the Earth ---- */
  p.push(`<g class="wc" data-u="day" transform="translate(${SUB.earth[0]} ${SUB.earth[1]})">${sub([0, 0])}`)
  // Noon at the top, where the Sun is. The Earth turns anticlockwise seen from over the pole, so the hours run that way too.
  for (let h = 0; h < 24; h++) {
    const a = -(h - 12) * 15
    const [x0, y0] = polar(h % 6 ? 104 : 100, a), [x1, y1] = polar(110, a)
    p.push(`<path d="M${x0} ${y0}L${x1} ${y1}" stroke="#c9cbe6" stroke-width="${h % 6 ? 1.5 : 3}"/>`)
  }
  for (const [h, label] of [[12, '12'], [18, '18'], [0, '24'], [6, '6']] as const) { const [x, y] = polar(97, -(h - 12) * 15); p.push(`<text class="t-24" x="${x}" y="${y}">${label}</text>`) }
  p.push(`<circle id="pw-earth-seat" r="84" fill="#0c1430"/><circle class="hit" r="${SUB_R}"/></g>`)

  /* ---- the count, in lamps ---- */
  p.push(`<g class="wc" data-u="y2038" transform="translate(165 -165)"><rect x="-56" y="-31" width="112" height="62" rx="8" fill="url(#pw-lip)"/><rect x="-53" y="-28" width="106" height="56" rx="6" fill="#07061a"/>`)
  for (let k = 0; k < 32; k++) p.push(`<circle class="bit" data-bit="${k}" cx="${-42 + (k % 8) * 12}" cy="${-18 + Math.floor(k / 8) * 12}" r="3.6"/>`)
  p.push(`<rect class="hit" x="-56" y="-31" width="112" height="62"/></g>`)

  /* ---- the year, on drums ---- */
  p.push(`<g transform="translate(165 165)"><rect x="-58" y="-28" width="116" height="56" rx="8" fill="url(#pw-lip)"/>`)
  ;['millennium', 'century', 'decade', 'year'].forEach((u, k) => {
    const x = -52 + k * 26
    p.push(`<g class="wc" data-u="${u}"><clipPath id="pw-drum-${k}"><rect x="${x}" y="-23" width="25" height="46" rx="3"/></clipPath><rect x="${x}" y="-23" width="25" height="46" rx="3" fill="#eceef8"/>` +
      `<g clip-path="url(#pw-drum-${k})"><g class="drum" data-drum="${k}"><text class="t-drum" x="${x + 12.5}" y="0">0</text><text class="t-drum" x="${x + 12.5}" y="46">0</text></g>` +
      `<rect x="${x}" y="-23" width="25" height="14" fill="#000" opacity="0.28"/><rect x="${x}" y="9" width="25" height="14" fill="#000" opacity="0.22"/></g><rect class="hit" x="${x}" y="-28" width="26" height="56"/></g>`)
  })
  p.push(`</g>`)

  /* ---- the Sun's reserve ---- */
  p.push(`<g class="wc" data-u="sun" transform="translate(-165 165)"><path d="${arc(44, -135, 135)}" stroke="#07061a" stroke-width="12" fill="none" stroke-linecap="round"/><path id="pw-sun-arc" stroke="#e8e2ff" stroke-width="6" fill="none" stroke-linecap="round"/>`)
  p.push(`<circle r="13" fill="#f2efff"/><g stroke="#f2efff" stroke-width="2.5">${Array.from({ length: 8 }, (_, k) => { const [x0, y0] = polar(18, k * 45), [x1, y1] = polar(25, k * 45); return `<path d="M${x0} ${y0}L${x1} ${y1}"/>` }).join('')}</g>`)
  p.push(`<text class="t-cap" y="50">SUN</text><circle class="hit" r="56"/></g>`)

  /* ---- the name ---- */
  p.push(`<g transform="translate(-165 -165)"><text class="t-name" y="-4">Progress</text><text class="t-cap" y="20">PERPETUAL</text></g>`)

  p.push(`</svg>`)
  const base = p.join('')
  p.length = 0
  p.push(open('watch-top', ' aria-hidden="true"'))

  /* ---- hands ---- */
  p.push(hand('date', 'month', `<path class="h-date" d="M-1.5 30L-1.5 -352L1.5 -352L1.5 30Z"/><path class="h-date" d="M0 -378A13 13 0 1 0 0 -352A9.5 9.5 0 1 1 0 -378Z"/><path class="hit" fill="none" d="M0 0L0 -380"/>`, 2))
  p.push(hand('hour', 'hour', `<path class="h-main" d="M-11 34L-13 -150L0 -238L13 -150L11 34Z"/><path class="h-lume" d="M-5 -40L-6 -148L0 -212L6 -148L5 -40Z"/><path class="hit" fill="none" d="M0 0L0 -238"/>`, 3))
  p.push(hand('minute', 'minute', `<path class="h-main" d="M-8.5 36L-10 -230L0 -346L10 -230L8.5 36Z"/><path class="h-lume" d="M-3.6 -60L-4.5 -228L0 -316L4.5 -228L3.6 -60Z"/><path class="hit" fill="none" d="M0 0L0 -346"/>`, 4))
  p.push(hand('second', 'second', `<path class="h-sec" d="M-2 90L-2 -400L2 -400L2 90Z"/><circle class="h-sec" cy="68" r="11"/><circle class="h-sec" cy="-300" r="7"/><path class="hit" fill="none" d="M0 80L0 -400"/>`, 5))
  p.push(`<circle r="17" fill="url(#pw-steel)"/><circle r="6" fill="#0b0c14"/>`)

  /* ---- crystal ---- */
  p.push(`<circle r="436" fill="url(#pw-edge)" pointer-events="none"/><path d="M-420 -110A434 434 0 0 1 250 -356A720 720 0 0 0 -420 -110Z" fill="url(#pw-glare)" pointer-events="none"/><circle r="436" fill="url(#pw-glare)" pointer-events="none"/>`)
  p.push(`</svg>`)
  return { base, top: p.join('') }
}
