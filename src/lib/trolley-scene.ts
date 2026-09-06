/**
 * The picture Trolley draws.
 *
 * It used to be a line, some sleepers, a dot and a diagonal — an accurate
 * diagram of a track layout and not a picture of anything happening. The plan
 * called it "an abstract track diagram" and that was fair.
 *
 * Two things changed. The scene is now a *place*: a field, a ballast bed under
 * each track, two rails instead of one, scrub either side, and a tram with a
 * front and a driver rather than a box with two circles. And the drawing lives
 * out here as pure functions over the same scene data the dilemmas already
 * carry, so `scripts/check-trolley-scene.mjs` can render all twenty-six of
 * them and measure what comes out.
 *
 * **Every colour is in the markup.** The page used to set them from scoped CSS
 * and had to write every rule as `:global` — because nodes built at runtime do
 * not carry Astro's scoped attribute, so without it the rules matched nothing
 * and the branch rail rendered as a solid black wedge. That comment is still in
 * the page and it is the fifth time this trap has come up on this site. Putting
 * the fills in the markup removes it rather than documenting it again, and it
 * is also the only way the checker sees what the browser sees.
 *
 * The two things that stay in CSS are the two that have to: the lever's rotate
 * transition and the tram's transform, both of which are animation.
 */

export type Token = {
  kind: 'people' | 'you' | 'friend' | 'lobsters' | 'chickens' | 'box' | 'empty'
  n: number
  label?: string
  consent?: boolean
}

export type Scene = {
  straight?: Token
  branch?: Token
  /** The branch rejoins the straight track, so diverting changes nothing. */
  loop?: boolean
  /** The footbridge case: no second track and no lever, because there is none. */
  bridge?: boolean
  /** A lever wired to nothing, drawn as wired to nothing. */
  dead?: boolean
  money?: boolean
}

/** Geometry the page's animation also needs, so there is one copy of it. */
export const GEO = {
  W: 320,
  H: 152,
  Y_STRAIGHT: 112,
  Y_BRANCH: 58,
  FORK: 148,
  /** Where the tram stops, just short of whoever is standing there. */
  STOP: 268,
  START: 28,
} as const

const C = {
  fieldFar: '#e3e6cd',
  fieldNear: '#d3dab6',
  ballast: '#cabfae',
  sleeper: '#a3866c',
  rail: '#877462',
  railDead: '#c6b9ab',
  scrubDark: '#7f9257',
  scrub: '#9bb06b',
  body: '#5a4636',
  // Both of these were mid-warm on a mid-warm ballast and measured under the
  // separation bar; the ballast is what they stand on, not the white card.
  you: '#9c4820',
  friend: '#7e4f92',
  lobster: '#c0442e',
  chicken: '#b3821c',
  chickenLine: '#553c08',
  beak: '#c0442e',
  lever: '#d97742',
  post: '#b9a08d',
  bridge: '#9c7f6a',
  tram: '#c0442e',
  tramDark: '#8e3122',
  tramRoof: '#7d3a2a',
  glass: '#dbeaf0',
  iron: '#3d1f14',
  lamp: '#ffe6a8',
  boxFill: '#efe1d5',
  boxLine: '#b9a08d',
  boxInk: '#5f4232',
  mark: '#8a6a55',
  money: '#3f6b4c',
} as const

/** Deterministic scatter, same generator as the other art modules. */
export const rnd = (seed: number, k: number) => {
  const x = Math.sin(seed * 9301 + k * 49297) * 233280
  return x - Math.floor(x)
}

/* ---- the world --------------------------------------------------------- */

/** A tuft of scrub. Small, and there are a lot of them, so it is two arcs. */
const scrub = (x: number, y: number, s: number, fill: string) =>
  `<path d="M${x} ${y} q${-2.4 * s} ${-1.6 * s} ${-1.2 * s} ${-4.4 * s} q${1.4 * s} ${1.2 * s} ${
    1.2 * s
  } ${2.2 * s} q${0.4 * s} ${-3 * s} ${2 * s} ${-4 * s} q${0.2 * s} ${2.6 * s} ${-0.6 * s} ${
    4 * s
  } q${1.6 * s} ${-1.4 * s} ${3 * s} ${-1.2 * s} q${-1 * s} ${2 * s} ${-3 * s} ${
    3 * s
  }Z" fill="${fill}"/>`

/**
 * The ground. Two flat bands rather than a gradient, because the whole set of
 * drawings on this site is flat colour and a gradient here would be the only
 * one; the lighter band reads as further away.
 */
function ground() {
  const horizon = 34
  let out =
    `<rect width="${GEO.W}" height="${GEO.H}" fill="${C.fieldFar}"/>` +
    `<path d="M0 ${horizon} q40 -5 82 -1 q46 5 84 -2 q44 -7 90 1 q34 6 64 -2 V${GEO.H} H0Z" fill="${C.fieldNear}"/>`
  // Scrub, thicker towards the bottom so the field reads as receding.
  for (let i = 0; i < 34; i++) {
    const x = rnd(9, i) * GEO.W
    const t = rnd(9, i + 60)
    const y = horizon + 6 + t * t * (GEO.H - horizon - 10)
    // Keep it off both tracks; a bush growing out of a rail is a bush nobody
    // believes and the checker would not catch it.
    if (Math.abs(y - GEO.Y_STRAIGHT) < 15 || Math.abs(y - GEO.Y_BRANCH) < 13) continue
    out += scrub(x, y, 0.7 + t * 0.9, rnd(9, i + 120) > 0.5 ? C.scrub : C.scrubDark)
  }
  return out
}

/** Ballast, sleepers and two rails — a track, rather than a line with ticks. */
function track(x1: number, x2: number, y: number, dead = false) {
  const gauge = 5.2
  // Edge to edge, so the line reads as going somewhere rather than stopping.
  let out = `<rect x="0" y="${y - 11}" width="${GEO.W}" height="22" fill="${C.ballast}"/>`
  for (let x = 2; x <= GEO.W; x += 11)
    out += `<rect x="${x - 2.6}" y="${(y - 9).toFixed(1)}" width="5.2" height="18" rx="1" fill="${
      C.sleeper
    }"/>`
  const stroke = dead ? C.railDead : C.rail
  const dash = dead ? ' stroke-dasharray="6 6"' : ''
  out +=
    `<path d="M0 ${y - gauge} H${GEO.W}" stroke="${stroke}" stroke-width="2.6"${dash}/>` +
    `<path d="M0 ${y + gauge} H${GEO.W}" stroke="${stroke}" stroke-width="2.6"${dash}/>`
  return out
}

/** The branch, which is a curve, so its ballast and rails follow the path. */
function curvedTrack(d: string, dead: boolean) {
  const stroke = dead ? C.railDead : C.rail
  const dash = dead ? ' stroke-dasharray="6 6"' : ''
  return (
    // Butt, not round: a round cap on a 22-wide stroke puts a lump eleven
    // units past the end of the rail, which lands outside the frame.
    `<path d="${d}" fill="none" stroke="${C.ballast}" stroke-width="22" stroke-linecap="butt"/>` +
    `<path d="${d}" fill="none" stroke="${C.sleeper}" stroke-width="18" stroke-linecap="butt" stroke-dasharray="5 6"/>` +
    `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="2.6" stroke-linecap="butt" transform="translate(0 -5.2)"${dash}/>` +
    `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="2.6" stroke-linecap="butt" transform="translate(0 5.2)"${dash}/>`
  )
}

/* ---- who is standing there --------------------------------------------- */

/**
 * One person, as a filled silhouette.
 *
 * The old figure was a 2-unit stroke: a circle and four line segments. At the
 * size a group of five gets, that is a diagram of a person. A filled body
 * carries at the same size and takes the same space.
 */
function person(x: number, y: number, fill: string, seed: number) {
  // Two stances, alternating, so a row of five is a group and not a stamp.
  const lean = rnd(seed, Math.round(x)) > 0.5 ? 1 : -1
  return (
    `<g class="fig">` +
    `<circle cx="${x}" cy="${y - 15.5}" r="3.2" fill="${fill}"/>` +
    `<path d="M${x - 3.4} ${y - 11.6} q3.4 -1.8 6.8 0 l1.1 7.4 q-4.5 1.5 -9 0Z" fill="${fill}"/>` +
    `<path d="M${x - 3.2} ${y - 11} q${-3 * lean} 3 ${-2.4 * lean} 6.6" stroke="${fill}" stroke-width="1.8" fill="none" stroke-linecap="round"/>` +
    `<path d="M${x + 3.2} ${y - 11} q${3 * lean} 3 ${2.4 * lean} 6.6" stroke="${fill}" stroke-width="1.8" fill="none" stroke-linecap="round"/>` +
    `<path d="M${x - 1.6} ${y - 4.2} l-1.4 4.4 M${x + 1.6} ${y - 4.2} l1.4 4.4" stroke="${fill}" stroke-width="2.2" stroke-linecap="round"/>` +
    `</g>`
  )
}

/**
 * Not a person, and it has to be obvious at a glance that it is not.
 *
 * Seen from above, because that is the view where a lobster is unmistakable:
 * two claws forward, a segmented body, a fan tail. The first version was a
 * small ellipse with two dots, and five of them in a row read as one red line.
 */
function lobster(x: number, y: number) {
  const t = y - 6
  const claw = (s: number) =>
    `<path d="M${x + 5.4 * s} ${t - 3.6} q${3.6 * s} -2.6 ${3 * s} -5.6 q${-3.2 * s} 0.6 ${
      -4.6 * s
    } 3Z" fill="${C.lobster}"/><path d="M${x + 3.4 * s} ${t - 2.6} l${2.6 * s} -2" stroke="${
      C.lobster
    }" stroke-width="1.5" stroke-linecap="round"/>`
  const feeler = (s: number) =>
    `<path d="M${x + 1.4 * s} ${t - 4.4} q${1.6 * s} -3.6 ${4 * s} -5" fill="none" stroke="${
      C.lobster
    }" stroke-width="1" stroke-linecap="round"/>`
  return (
    `<g class="fig">` +
    claw(-1) +
    claw(1) +
    feeler(-1) +
    feeler(1) +
    `<ellipse cx="${x}" cy="${t - 0.4}" rx="3.4" ry="4" fill="${C.lobster}"/>` +
    `<path d="M${x - 2.6} ${t + 2.6} h5.2 l-0.8 4 h-3.6Z" fill="${C.lobster}"/>` +
    `<path d="M${x - 3.4} ${t + 6.6} q3.4 2.6 6.8 0 q-1.2 2.6 -3.4 2.6 q-2.2 0 -3.4 -2.6Z" fill="${C.lobster}"/>` +
    // Dark scoring across the shell: the segments, and the only dark in it.
    `<path d="M${x - 3} ${t - 1.4} h6 M${x - 3} ${t + 1} h6 M${x - 2.4} ${t + 4} h4.8" stroke="${
      C.tramDark
    }" stroke-width="0.9"/>` +
    `</g>`
  )
}

/** Not a person either, and rounder than a lobster so the two do not blur. */
function chicken(x: number, y: number) {
  return (
    `<g class="fig">` +
    `<ellipse cx="${x - 0.4}" cy="${y - 5.4}" rx="4" ry="4.4" fill="${C.chicken}" stroke="${
      C.chickenLine
    }" stroke-width="1.1"/>` +
    `<path d="M${x - 4} ${y - 6} q-2.6 1.4 -3.4 4 q2.8 -0.6 4 -2.2Z" fill="${C.chickenLine}"/>` +
    `<circle cx="${x + 1.8}" cy="${y - 11}" r="2.5" fill="${C.chicken}" stroke="${
      C.chickenLine
    }" stroke-width="1"/>` +
    `<path d="M${x + 1.4} ${y - 13.2} q0.6 -2 2 -2.2 q-0.4 1.6 -0.8 2.4Z" fill="${C.beak}"/>` +
    `<path d="M${x + 4} ${y - 11.2} l2.8 1.2 l-2.8 1.2Z" fill="${C.beak}"/>` +
    `<path d="M${x - 1} ${y - 1.2} v2 M${x + 2} ${y - 1.2} v2" stroke="${C.beak}" stroke-width="1.2" stroke-linecap="round"/>` +
    `</g>`
  )
}

const mark = (x: number, y: number, text: string, money = false) =>
  `<text x="${x}" y="${y}" text-anchor="middle" fill="${money ? C.money : C.mark}" ` +
  `font-size="${money ? 10 : 9}" font-weight="600" ` +
  `font-family="system-ui, -apple-system, Segoe UI, sans-serif"` +
  (money ? '' : ' letter-spacing="0.06em"') +
  `>${text}</text>`

function tokens(t: Token | undefined, cx: number, y: number) {
  if (!t || t.kind === 'empty' || !t.n) return ''
  if (t.kind === 'box') {
    return (
      `<g class="fig"><rect x="${cx - 19}" y="${y - 32}" width="38" height="30" rx="3" fill="${
        C.boxFill
      }" stroke="${C.boxLine}" stroke-width="2.5"/>` +
      `<text x="${cx}" y="${y - 12}" text-anchor="middle" fill="${C.boxInk}" font-size="15" ` +
      `font-weight="700" font-family="system-ui, -apple-system, Segoe UI, sans-serif">?</text></g>`
    )
  }
  // Fifty million people and ten thousand chickens cannot be drawn one at a
  // time, so a handful stand for the group and the number is written above
  // them. Pretending the picture is a headcount would be worse than saying so.
  // A lobster is nearly twice as wide as a person once its claws are out, so
  // one pitch for all three kinds ran the lobsters into each other and the row
  // read as a single red smear.
  const wide = t.kind === 'lobsters' || t.kind === 'chickens'
  const pitch = t.label ? (wide ? 11 : 9) : wide ? 15 : 13
  const x0 = cx - ((t.n - 1) * pitch) / 2
  let out = ''
  for (let k = 0; k < t.n; k++) {
    const x = x0 + k * pitch
    if (t.kind === 'lobsters') out += lobster(x, y)
    else if (t.kind === 'chickens') out += chicken(x, y)
    else out += person(x, y, t.kind === 'you' ? C.you : t.kind === 'friend' ? C.friend : C.body, 21)
  }
  if (t.label) out += mark(cx, y - 26, t.label)
  // A small tick over a group that signed the form; the dilemma turns on it.
  if (t.consent) out += mark(cx, y - 26, 'signed')
  if (t.kind === 'you') out += mark(cx, y - 26, 'you')
  if (t.kind === 'friend') out += mark(cx, y - 26, 'friend')
  return out
}

/* ---- the tram ---------------------------------------------------------- */

/**
 * A tram, drawn from the side and slightly in front, with a driver.
 *
 * The old one was a 26 by 15 rectangle with a smaller rectangle in it and two
 * circles under it. It is the thing the entire game is named after and it was
 * the least-drawn object on the page.
 *
 * Drawn around its own origin so the page can keep translating it along the
 * rail without knowing anything about its shape.
 */
export function tramMarkup(x = GEO.START, y = GEO.Y_STRAIGHT) {
  // Positioned here rather than by the caller. It used to be drawn at the
  // origin and was only ever right because the page translated it on the very
  // next line; rendered on its own the tram sat half outside the frame, which
  // is what the checker found.
  return (
    `<g class="trolley" id="trolley" transform="translate(${x},${y})">` +
    // Pole and the wire it takes power from.
    `<path d="M6 -22 L16 -34" stroke="${C.iron}" stroke-width="1.4" stroke-linecap="round"/>` +
    `<circle cx="16" cy="-34" r="1.6" fill="${C.iron}"/>` +
    // Body, with the front end raked back.
    `<path d="M-16 -6 v-13 q0 -3 3 -3.6 l24 0 q4 0.6 5 4 l1 12.6 q0 2 -2.4 2 h-28 q-2.6 0 -2.6 -2Z" fill="${C.tram}"/>` +
    `<path d="M-16 -22.6 h29 q4 0.6 5 4 h-37 q0.4 -3.4 3 -4Z" fill="${C.tramRoof}"/>` +
    // Windows: two saloon panes and the raked driver's screen at the front.
    `<rect x="-13" y="-19" width="9" height="7" rx="1.2" fill="${C.glass}"/>` +
    `<rect x="-2.5" y="-19" width="9" height="7" rx="1.2" fill="${C.glass}"/>` +
    `<path d="M8.5 -19 h4.4 q1.6 0 2 1.6 l0.8 5.4 h-7.2Z" fill="${C.glass}"/>` +
    // A driver, so it is something being driven.
    `<circle cx="11.5" cy="-15.5" r="1.9" fill="${C.body}"/>` +
    // Skirt, lamp and a destination board.
    `<path d="M-16 -8 h33" stroke="${C.tramDark}" stroke-width="1.6"/>` +
    `<circle cx="15.5" cy="-9.5" r="2" fill="${C.lamp}"/>` +
    `<rect x="-14" y="-23.6" width="12" height="2.4" rx="1" fill="${C.glass}"/>` +
    // Bogies.
    `<rect x="-13" y="-6" width="26" height="2.6" fill="${C.iron}"/>` +
    `<circle cx="-8" cy="-2.2" r="3" fill="${C.iron}"/>` +
    `<circle cx="8" cy="-2.2" r="3" fill="${C.iron}"/>` +
    `<circle cx="-8" cy="-2.2" r="1.1" fill="${C.ballast}"/>` +
    `<circle cx="8" cy="-2.2" r="1.1" fill="${C.ballast}"/>` +
    `</g>`
  )
}

/* ---- the whole scene --------------------------------------------------- */

/** The branch path for a scene, which the page's animation also needs. */
export function branchPath(sc: Scene) {
  const { FORK, Y_STRAIGHT, Y_BRANCH } = GEO
  return sc.loop
    ? `M${FORK} ${Y_STRAIGHT} C 178 ${Y_BRANCH}, 214 ${Y_BRANCH}, 236 ${Y_BRANCH} ` +
        `C 262 ${Y_BRANCH}, 286 ${Y_BRANCH + 20}, 286 ${Y_STRAIGHT}`
    : `M${FORK} ${Y_STRAIGHT} C 176 ${Y_STRAIGHT}, 186 ${Y_BRANCH}, 214 ${Y_BRANCH} H ${GEO.W}`
}

/** Everything inside the `<svg viewBox="0 0 320 152">`, tram included. */
export function sceneSvg(
  sc: Scene,
  tramAt: readonly [number, number] = [GEO.START, GEO.Y_STRAIGHT],
): string {
  const { Y_STRAIGHT, Y_BRANCH, FORK, STOP } = GEO
  return (
    ground() +
    (sc.bridge ? '' : curvedTrack(branchPath(sc), !!sc.dead)) +
    track(8, 312, Y_STRAIGHT) +
    (sc.bridge
      ? // The footbridge case has no second track and no lever, because it has
        // none — drawing one would contradict the setup, which is the point of
        // that problem.
        `<path d="M92 ${Y_STRAIGHT - 46} H204 v4 H92Z" fill="${C.bridge}"/>` +
        `<path d="M100 ${Y_STRAIGHT - 42} v32 M196 ${Y_STRAIGHT - 42} v32" stroke="${C.bridge}" stroke-width="2.6" stroke-linecap="round"/>` +
        `<path d="M92 ${Y_STRAIGHT - 52} H204" stroke="${C.bridge}" stroke-width="1.6" opacity="0.7"/>` +
        `<path d="M104 ${Y_STRAIGHT - 52} v6 M124 ${Y_STRAIGHT - 52} v6 M144 ${Y_STRAIGHT - 52} v6 ` +
          `M164 ${Y_STRAIGHT - 52} v6 M184 ${Y_STRAIGHT - 52} v6" stroke="${C.bridge}" stroke-width="1.4" opacity="0.7"/>` +
        person(172, Y_STRAIGHT - 46, C.friend, 33)
      : `<rect x="${FORK - 29}" y="${Y_STRAIGHT - 4}" width="6" height="18" rx="2" fill="${C.post}"/>` +
        `<path class="switch" id="switchRail" d="M${FORK - 26} ${Y_STRAIGHT - 4} l14 -9" ` +
          `stroke="${C.lever}" stroke-width="4.5" stroke-linecap="round" fill="none"/>`) +
    tokens(sc.straight, STOP, Y_STRAIGHT) +
    (sc.loop ? '' : tokens(sc.branch, STOP, Y_BRANCH)) +
    (sc.money ? mark(STOP, Y_BRANCH - 26, '$1,000,000', true) : '') +
    tramMarkup(tramAt[0], tramAt[1])
  )
}
