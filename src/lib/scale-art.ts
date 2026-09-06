/**
 * Scale's objects, drawn.
 *
 * The page used to render every solid thing as one lit sphere: a proton, an
 * ant, the Eiffel Tower and a blue whale, all the same ball in a different
 * colour. For a planet that is correct. For everything else it meant the game
 * had nothing to show you — you scrolled forty-two decades past a colour
 * palette. This is the part of Scale that was missing.
 *
 * Two rules hold the set together.
 *
 * **Shape is data, not decoration.** Every drawing declares the object's real
 * extent in metres, `wm` by `hm`, and the page sizes the element from those
 * rather than from one number. That fixes a lie the old code told: `m` for the
 * Eiffel Tower is 330 metres of *height*, and the square disc was therefore
 * drawn 330 metres wide — nearly three times the tower's actual footprint.
 * `quoted` says which of the two `m` is, and `check-scale-art.mjs` proves it
 * matches the registry rather than trusting the comment.
 *
 * **Ids must be unique.** All forty-three things inline into one document, so
 * every gradient and clip is prefixed with the object's own slug. This is the
 * same trap `tile-art.ts` documents, and it is silent when you get it wrong:
 * the first definition on the page wins and every later object borrows it.
 *
 * Nothing here is fed to the WebGL layer. The shader is good at the things it
 * was written for — lit spheres, rings, nebulae, a wave — and those entries
 * keep it. An object with a drawing opts out, or it would be painted twice.
 */

/* ---- colour ------------------------------------------------------------ */

const chan = (h: string) => {
  const n = parseInt(h.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const hexOf = (a: number[]) =>
  '#' + a.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')

/** Plain sRGB mixing. The page's own palette is authored in sRGB, so matching
 *  it matters more here than perceptual correctness would. */
export const mix = (a: string, b: string, t: number) => {
  const [x, y] = [chan(a), chan(b)]
  return hexOf(x.map((v, i) => v + (y[i] - v) * t))
}
export const lt = (c: string, t: number) => mix(c, '#ffffff', t)
export const dk = (c: string, t: number) => mix(c, '#000000', t)

/** Deterministic scatter. Same generator as `tile-art.ts`, same reason: a
 *  granulation pattern that re-rolls on every render is a shimmer, not a
 *  surface. */
export const rnd = (seed: number, k: number) => {
  const x = Math.sin(seed * 9301 + k * 49297) * 233280
  return x - Math.floor(x)
}

/* ---- the type ---------------------------------------------------------- */

export type Drawing = {
  /** What it is, in words, so the checker can print something useful. */
  subject: string
  /** Real width in metres. */
  wm: number
  /** Real height in metres. */
  hm: number
  /**
   * Which axis the registry's `m` measures — nothing more. These two used to
   * be one field and it did not survive contact with the objects: Everest is
   * quoted by *height* and is nearly twice as wide as it is tall, and
   * Manhattan is quoted by its *length*, which runs down the drawing rather
   * than across it. Neither word tells you which axis on its own.
   */
  axis: 'w' | 'h'
  /** What the size chip calls that axis, in words. */
  word: 'across' | 'tall' | 'long'
  /** Inner SVG on a viewBox of `0 0 1000*wm/max 1000*hm/max`. */
  draw: (c: string, id: string) => string
}

/** `Grain of sand` -> `grain-of-sand`. The id prefix for that object's defs. */
export const slugOf = (name: string) =>
  name
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/* ---- shared bits ------------------------------------------------------- */

/** A lit ball. Used by the handful of objects that really are spheres, so
 *  their surface detail sits on the same shading everything else has. */
const ballShade = (id: string, c: string) => `
  <radialGradient id="${id}-lit" cx="34%" cy="28%" r="78%">
    <stop offset="0%" stop-color="${lt(c, 0.5)}"/>
    <stop offset="52%" stop-color="${c}"/>
    <stop offset="100%" stop-color="${dk(c, 0.62)}"/>
  </radialGradient>`

/** The dark crescent at the far limb. Sells roundness more than the
 *  highlight does, on every sphere here. */
const limb = (id: string, cx: number, cy: number, r: number) => `
  <radialGradient id="${id}-limb" cx="50%" cy="50%" r="50%">
    <stop offset="72%" stop-color="#000" stop-opacity="0"/>
    <stop offset="100%" stop-color="#000" stop-opacity="0.55"/>
  </radialGradient>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${id}-limb)"/>`

/* ---- the smallest things ------------------------------------------------

   Down here nothing has a surface to light, so none of these are shaded like
   a ball. A nucleus is a bag of nucleons and is drawn as one; a molecule is
   its geometry and nothing else. --------------------------------------- */

const proton: Drawing = {
  subject: 'a proton — three quarks and the gluon field holding them',
  wm: 1.7e-15,
  hm: 1.7e-15,
  axis: 'w',
  word: 'across',
  draw: (c, id) => {
    // The three colour charges are the actual convention, not a palette
    // choice: a proton is colour-neutral because its quarks carry one each.
    const q = [
      { x: 500, y: 330, f: '#e4574f', l: 'u' },
      { x: 340, y: 620, f: '#4fa85e', l: 'u' },
      { x: 660, y: 620, f: '#4f74d8', l: 'd' },
    ]
    // Gluon flux tubes, drawn as the springs every textbook draws them as.
    const flux = q
      .map((a, i) => {
        const b = q[(i + 1) % 3]
        const mx = (a.x + b.x) / 2 + (500 - (a.x + b.x) / 2) * 0.42
        const my = (a.y + b.y) / 2 + (525 - (a.y + b.y) / 2) * 0.42
        return `<path d="M${a.x} ${a.y} Q${mx} ${my} ${b.x} ${b.y}" fill="none"
          stroke="${lt(c, 0.4)}" stroke-width="16" stroke-linecap="round" opacity="0.5"/>`
      })
      .join('')
    return `
      <defs>
        <radialGradient id="${id}-bag" cx="50%" cy="48%" r="50%">
          <stop offset="0%" stop-color="${lt(c, 0.3)}" stop-opacity="0.5"/>
          <stop offset="62%" stop-color="${c}" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="${c}" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <circle cx="500" cy="500" r="500" fill="url(#${id}-bag)"/>
      <circle cx="500" cy="500" r="392" fill="none" stroke="${lt(c, 0.5)}"
              stroke-width="7" stroke-dasharray="26 30" opacity="0.6"/>
      ${flux}
      ${q
        .map(
          (v) => `
        <circle cx="${v.x}" cy="${v.y}" r="118" fill="${v.f}"/>
        <circle cx="${v.x - 34}" cy="${v.y - 38}" r="40" fill="#fff" opacity="0.34"/>`,
        )
        .join('')}`
  },
}

/** Nucleons packed into a shape, as tightly as a spiral will pack them.
 *  Used for both nuclei so the two read as the same kind of object at
 *  different counts, which is exactly what they are. */
function nucleus(id: string, c: string, protons: number, neutrons: number, prolate: number) {
  const n = protons + neutrons
  // Exactly the right count of each, then shuffled. Alternating runs out of
  // protons partway through and leaves uranium with an all-neutron surface.
  const species = Array.from({ length: n }, (_, i) => i < protons)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd(2, i) * (i + 1))
    const t = species[i]
    species[i] = species[j]
    species[j] = t
  }
  const cx = 500 * prolate
  const cy = 500
  // A sunflower spiral fills a disc evenly with no gaps and no lattice, which
  // is the right texture: a nucleus is a liquid drop, not a crystal.
  // Solve for the two together: the outermost nucleon sits at ~0.98 of R and
  // needs its own radius inside the frame. With only twelve of them that
  // radius is large enough that ignoring it put carbon 140 units off-frame.
  const r = Math.max(9, 640 / (Math.sqrt(n) + 1.35))
  const R = 494 - r
  const parts: string[] = []
  for (let i = 0; i < n; i++) {
    const f = Math.sqrt((i + 0.5) / n)
    const a = i * 2.399963
    const x = cx + Math.cos(a) * f * R * prolate
    const y = cy + Math.sin(a) * f * R
    const f0 = species[i] ? c : mix(c, '#8c93a8', 0.78)
    parts.push(
      `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${f0}"/>` +
        `<circle cx="${(x - r * 0.3).toFixed(1)}" cy="${(y - r * 0.32).toFixed(1)}" r="${(r * 0.34).toFixed(
          1,
        )}" fill="#fff" opacity="0.32"/>`,
    )
  }
  return `
    <defs>
      <radialGradient id="${id}-halo" cx="50%" cy="50%" r="50%">
        <stop offset="60%" stop-color="${c}" stop-opacity="0.24"/>
        <stop offset="100%" stop-color="${c}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <g transform="scale(${(1 / prolate).toFixed(6)})">
      <ellipse cx="${cx}" cy="${cy}" rx="${500 * prolate}" ry="500" fill="url(#${id}-halo)"/>
      ${parts.join('')}
    </g>`
}

const carbonNucleus: Drawing = {
  subject: 'a carbon nucleus — six protons and six neutrons',
  wm: 5.0e-15,
  hm: 5.0e-15,
  axis: 'w',
  word: 'across',
  draw: (c, id) => nucleus(id, c, 6, 6, 1),
}

const uraniumNucleus: Drawing = {
  subject: 'a uranium-238 nucleus — 92 protons, 146 neutrons, and not round',
  wm: 1.5e-14,
  // U-238 is one of the most deformed stable nuclei there is; drawing it as a
  // ball would throw away the only interesting thing about its shape, and the
  // deformation is why it fissions the way it does.
  hm: 1.5e-14 / 1.3,
  axis: 'w',
  word: 'long',
  draw: (c, id) => nucleus(id, c, 92, 146, 1.3),
}

const waterMolecule: Drawing = {
  subject: 'a water molecule — one oxygen, two hydrogens, bent at 104.5°',
  wm: 2.8e-10,
  // The van der Waals envelope is 3.91 A wide by 3.31 A tall. The registry
  // quotes the width, so the height follows from that ratio rather than from
  // a number picked to look right.
  hm: 2.8e-10 * (3.31 / 3.91),
  axis: 'w',
  word: 'across',
  draw: (c, id) => {
    // Space-filling, at real radii: O is 1.52 A, H is 1.20 A, the bond is
    // 0.958 A and the angle is 104.5°. The hydrogens sit mostly *inside* the
    // oxygen and show as two bumps, which is what water actually looks like.
    const u = 1000 / 3.91 // units per angstrom, across the widest span
    const ox = 500
    const oR = 1.52 * u
    const hR = 1.2 * u
    const bond = 0.958 * u
    const half = ((104.5 / 2) * Math.PI) / 180
    const oy = bond * Math.cos(half) + hR
    const hs = [-1, 1].map((s) => ({
      x: ox + Math.sin(half) * bond * s,
      y: oy - Math.cos(half) * bond,
    }))
    return `
      <defs>
        <radialGradient id="${id}-o" cx="34%" cy="28%" r="76%">
          <stop offset="0%" stop-color="${lt(c, 0.55)}"/>
          <stop offset="60%" stop-color="${c}"/>
          <stop offset="100%" stop-color="${dk(c, 0.5)}"/>
        </radialGradient>
        <radialGradient id="${id}-h" cx="34%" cy="28%" r="76%">
          <stop offset="0%" stop-color="#ffffff"/>
          <stop offset="70%" stop-color="#dfe8f2"/>
          <stop offset="100%" stop-color="#93a6bb"/>
        </radialGradient>
      </defs>
      ${hs
        .map(
          (h) =>
            `<circle cx="${h.x.toFixed(1)}" cy="${h.y.toFixed(1)}" r="${hR.toFixed(
              1,
            )}" fill="url(#${id}-h)"/>`,
        )
        .join('')}
      ${hs
        .map(
          (h) =>
            `<circle cx="${h.x.toFixed(1)}" cy="${h.y.toFixed(1)}" r="${hR.toFixed(
              1,
            )}" fill="none" stroke="${dk(c, 0.62)}" stroke-width="16"/>`,
        )
        .join('')}
      <circle cx="${ox}" cy="${oy.toFixed(1)}" r="${oR.toFixed(1)}" fill="url(#${id}-o)"/>
      <circle cx="${ox}" cy="${oy.toFixed(1)}" r="${oR.toFixed(
        1,
      )}" fill="none" stroke="${dk(c, 0.62)}" stroke-width="16"/>
      <circle cx="${(ox - oR * 0.34).toFixed(1)}" cy="${(oy - oR * 0.4).toFixed(
        1,
      )}" r="${(oR * 0.24).toFixed(1)}" fill="#fff" opacity="0.34"/>`
  },
}

/** Truncated icosahedron, computed rather than drawn by hand.
 *
 *  The 60 vertices are the cyclic permutations of (0, ±1, ±3φ), (±1, ±(2+φ),
 *  ±2φ) and (±φ, ±2, ±(2φ+1)); edges are the vertex pairs exactly 2 apart.
 *  Doing it properly costs about fifteen lines and gets the pentagons and
 *  hexagons in the right places, which eyeballing would not. */
function fullerene() {
  const P = (1 + Math.sqrt(5)) / 2
  const base = [
    [0, 1, 3 * P],
    [1, 2 + P, 2 * P],
    [P, 2, 2 * P + 1],
  ]
  const vs: number[][] = []
  for (const b of base)
    for (const p of [
      [0, 1, 2],
      [1, 2, 0],
      [2, 0, 1],
    ])
      for (const sx of [1, -1])
        for (const sy of [1, -1])
          for (const sz of [1, -1]) {
            const v = [b[p[0]] * sx, b[p[1]] * sy, b[p[2]] * sz]
            if (!vs.some((u) => Math.hypot(u[0] - v[0], u[1] - v[1], u[2] - v[2]) < 1e-9)) vs.push(v)
          }
  const es: number[][] = []
  for (let i = 0; i < vs.length; i++)
    for (let j = i + 1; j < vs.length; j++)
      if (Math.abs(Math.hypot(vs[i][0] - vs[j][0], vs[i][1] - vs[j][1], vs[i][2] - vs[j][2]) - 2) < 1e-6)
        es.push([i, j])
  return { vs, es }
}

const buckyball: Drawing = {
  subject: 'a buckyball — sixty carbon atoms in a truncated icosahedron',
  wm: 1.0e-9,
  hm: 1.0e-9,
  axis: 'w',
  word: 'across',
  draw: (c, id) => {
    const { vs, es } = fullerene()
    // Tilted so a pentagon faces you slightly off-centre; straight down an
    // axis it reads as a flat rosette rather than a ball.
    const ca = Math.cos(0.62)
    const sa = Math.sin(0.62)
    const cb = Math.cos(0.38)
    const sb = Math.sin(0.38)
    const R = 4.9558
    const pts = vs.map(([x, y, z]) => {
      const x1 = x * ca - z * sa
      const z1 = x * sa + z * ca
      const y1 = y * cb - z1 * sb
      const z2 = y * sb + z1 * cb
      return { x: 500 + (x1 / R) * 470, y: 500 - (y1 / R) * 470, z: z2 / R }
    })
    const back = es.filter(([i, j]) => (pts[i].z + pts[j].z) / 2 < 0)
    const front = es.filter(([i, j]) => (pts[i].z + pts[j].z) / 2 >= 0)
    const bonds = (list: number[][], w: number, o: number) =>
      list
        .map(
          ([i, j]) =>
            `<path d="M${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)} L${pts[j].x.toFixed(1)} ${pts[
              j
            ].y.toFixed(1)}" stroke="${c}" stroke-width="${w}" stroke-linecap="round" opacity="${o}"/>`,
        )
        .join('')
    const atoms = pts
      .filter((p) => p.z >= 0)
      .map(
        (p) =>
          `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${(15 + p.z * 9).toFixed(
            1,
          )}" fill="${lt(c, 0.55)}"/>`,
      )
      .join('')
    return `
      <defs>
        <radialGradient id="${id}-in" cx="42%" cy="34%" r="66%">
          <stop offset="0%" stop-color="${lt(c, 0.3)}" stop-opacity="0.24"/>
          <stop offset="100%" stop-color="${dk(c, 0.4)}" stop-opacity="0.14"/>
        </radialGradient>
      </defs>
      <circle cx="500" cy="500" r="470" fill="url(#${id}-in)"/>
      ${bonds(back, 8, 0.3)}
      ${bonds(front, 15, 1)}
      ${atoms}`
  },
}

const dna: Drawing = {
  subject: 'B-DNA seen across the helix, with its two unequal grooves',
  wm: 2.0e-9,
  // Quoted across the helix, so the frame is the helix's own width. A full
  // turn is 3.4 nm and would not fit; this is the 2 nm of it that does.
  hm: 2.0e-9,
  axis: 'w',
  word: 'across',
  draw: (c, id) => {
    // The two backbones are not opposite each other — they sit about 140° and
    // 220° apart, and that asymmetry is the major and minor groove. Drawing
    // them 180° apart is the common mistake and loses the grooves entirely.
    const turn = 1000 / 0.588 // 2 nm of a 3.4 nm pitch
    const amp = 380
    const path = (phase: number) => {
      const pts: string[] = []
      for (let t = 0; t <= 1.001; t += 0.02) {
        const y = t * 1000
        const x = 500 + Math.sin((y / turn) * Math.PI * 2 + phase) * amp
        pts.push(`${x.toFixed(1)} ${y.toFixed(1)}`)
      }
      return 'M' + pts.join(' L')
    }
    const a = 0
    const b = (140 / 180) * Math.PI
    const rungs: string[] = []
    for (let y = 30; y < 1000; y += 62) {
      const x1 = 500 + Math.sin((y / turn) * Math.PI * 2 + a) * amp
      const x2 = 500 + Math.sin((y / turn) * Math.PI * 2 + b) * amp
      const depth = (Math.cos((y / turn) * Math.PI * 2 + a) + 1) / 2
      rungs.push(
        `<path d="M${x1.toFixed(1)} ${y} L${x2.toFixed(1)} ${y}" stroke="${
          y % 124 < 62 ? lt(c, 0.1) : mix(c, '#ffd48a', 0.6)
        }" stroke-width="34" stroke-linecap="round" opacity="${(0.35 + depth * 0.6).toFixed(2)}"/>`,
      )
    }
    return `
      ${rungs.join('')}
      <path d="${path(a)}" fill="none" stroke="${dk(c, 0.32)}" stroke-width="86" stroke-linecap="round"/>
      <path d="${path(a)}" fill="none" stroke="${lt(c, 0.42)}" stroke-width="52" stroke-linecap="round"/>
      <path d="${path(b)}" fill="none" stroke="${dk(c, 0.5)}" stroke-width="86" stroke-linecap="round" opacity="0.9"/>
      <path d="${path(b)}" fill="none" stroke="${c}" stroke-width="52" stroke-linecap="round"/>`
  },
}

const influenza: Drawing = {
  subject: 'an influenza virion, with both of its spike proteins',
  wm: 9.0e-8,
  hm: 9.0e-8,
  axis: 'w',
  word: 'across',
  draw: (c, id) => {
    // Two spike types, and the difference between them is the whole naming
    // system: haemagglutinin is the rod, neuraminidase the mushroom. H1N1.
    const R = 372
    const spikes: string[] = []
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * Math.PI * 2 + rnd(7, i) * 0.06
      const cs = Math.cos(a)
      const sn = Math.sin(a)
      const x0 = 500 + cs * (R - 10)
      const y0 = 500 + sn * (R - 10)
      const len = i % 5 === 0 ? 118 : 96
      const x1 = 500 + cs * (R + len)
      const y1 = 500 + sn * (R + len)
      spikes.push(
        `<path d="M${x0.toFixed(1)} ${y0.toFixed(1)} L${x1.toFixed(1)} ${y1.toFixed(1)}"
           stroke="${lt(c, 0.3)}" stroke-width="17" stroke-linecap="round"/>`,
      )
      spikes.push(
        i % 5 === 0
          ? `<circle cx="${x1.toFixed(1)}" cy="${y1.toFixed(1)}" r="30" fill="${lt(c, 0.62)}"/>`
          : `<circle cx="${x1.toFixed(1)}" cy="${y1.toFixed(1)}" r="19" fill="${lt(c, 0.45)}"/>`,
      )
    }
    // Eight RNA segments — the reason two flu strains that meet in one cell
    // can shuffle into something nobody has immunity to.
    const rna: string[] = []
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.4
      const x = 500 + Math.cos(a) * 170
      const y = 500 + Math.sin(a) * 170
      rna.push(
        `<path d="M${(x - 44).toFixed(1)} ${(y - 44).toFixed(1)} Q${x.toFixed(1)} ${(y + 26).toFixed(
          1,
        )} ${(x + 44).toFixed(1)} ${(y - 40).toFixed(1)}" fill="none" stroke="${lt(c, 0.72)}"
           stroke-width="16" stroke-linecap="round" opacity="0.85"/>`,
      )
    }
    return `
      <defs>${ballShade(id, c)}</defs>
      ${spikes.join('')}
      <circle cx="500" cy="500" r="${R}" fill="url(#${id}-lit)"/>
      <circle cx="500" cy="500" r="${R}" fill="none" stroke="${dk(c, 0.45)}" stroke-width="22" opacity="0.7"/>
      ${rna.join('')}`
  },
}

const ecoli: Drawing = {
  subject: 'E. coli — a rod, a nucleoid, pili and four flagella',
  wm: 2.0e-6,
  hm: 5.0e-7,
  axis: 'w',
  word: 'long',
  draw: (c, id) => {
    const W = 1000
    const H = 250
    // The flagella really are several times longer than the cell. They are
    // kept inside the frame here because the frame is the cell's own size,
    // and the note under the drawing is not the place to argue about it.
    const flag = [0.34, 0.5, 0.66, 0.8]
      .map((f, i) => {
        const y = H * f
        const pts: string[] = []
        for (let t = 0; t <= 1.001; t += 0.05) {
          const x = 118 - t * 116
          pts.push(`${x.toFixed(1)} ${(y + Math.sin(t * 13 + i * 1.7) * 26 * t).toFixed(1)}`)
        }
        return `<path d="M${pts.join(' L')}" fill="none" stroke="${lt(c, 0.35)}"
          stroke-width="9" stroke-linecap="round" opacity="0.8"/>`
      })
      .join('')
    const pili = Array.from({ length: 26 }, (_, i) => {
      const t = 0.16 + (i / 26) * 0.8
      const x = 130 + t * 740
      const up = i % 2 === 0
      // Inward, not outward: the frame is the cell's own 0.5 um and there is
      // nowhere outside it to draw.
      const y = up ? 5 : H - 5
      const dy = up ? 22 : -22
      return `<path d="M${x.toFixed(1)} ${y} l${(rnd(3, i) * 16 - 8).toFixed(1)} ${dy}"
        stroke="${lt(c, 0.3)}" stroke-width="7" stroke-linecap="round" opacity="0.5"/>`
    }).join('')
    return `
      <defs>
        <linearGradient id="${id}-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${lt(c, 0.42)}"/>
          <stop offset="45%" stop-color="${c}"/>
          <stop offset="100%" stop-color="${dk(c, 0.5)}"/>
        </linearGradient>
      </defs>
      ${flag}
      ${pili}
      <rect x="127" y="7" width="866" height="${H - 14}" rx="${H / 2 - 7}" fill="url(#${id}-body)"/>
      <rect x="127" y="7" width="866" height="${H - 14}" rx="${H / 2 - 7}" fill="none"
            stroke="${dk(c, 0.4)}" stroke-width="14"/>
      <path d="M300 ${H * 0.3} q90 -34 190 4 q110 42 200 -6 q70 -36 130 10"
            fill="none" stroke="${lt(c, 0.7)}" stroke-width="30" stroke-linecap="round" opacity="0.55"/>
      ${Array.from({ length: 16 }, (_, i) => {
        const x = 210 + rnd(11, i) * 730
        const y = 34 + rnd(11, i + 40) * (H - 68)
        return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(7 + rnd(11, i + 90) * 6).toFixed(
          1,
        )}" fill="${lt(c, 0.8)}" opacity="0.5"/>`
      }).join('')}`
  },
}

const redBloodCell: Drawing = {
  subject: 'a red blood cell — the biconcave dimple, face on',
  wm: 8.0e-6,
  hm: 8.0e-6,
  axis: 'w',
  word: 'across',
  draw: (c, id) => `
      <defs>
        <radialGradient id="${id}-rbc" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="${dk(c, 0.34)}"/>
          <stop offset="26%" stop-color="${dk(c, 0.22)}"/>
          <stop offset="52%" stop-color="${c}"/>
          <stop offset="82%" stop-color="${lt(c, 0.18)}"/>
          <stop offset="100%" stop-color="${dk(c, 0.42)}"/>
        </radialGradient>
        <radialGradient id="${id}-dimple" cx="42%" cy="36%" r="60%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.4"/>
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="${id}-well" cx="40%" cy="34%" r="72%">
          <stop offset="0%" stop-color="${dk(c, 0.44)}"/>
          <stop offset="100%" stop-color="${dk(c, 0.72)}"/>
        </radialGradient>
      </defs>
      <circle cx="500" cy="500" r="496" fill="url(#${id}-rbc)"/>
      <circle cx="500" cy="500" r="292" fill="url(#${id}-well)"/>
      <circle cx="500" cy="500" r="292" fill="none" stroke="${lt(c, 0.3)}" stroke-width="26"/>
      <circle cx="500" cy="500" r="196" fill="${dk(c, 0.62)}" opacity="0.55"/>
      <ellipse cx="470" cy="450" rx="250" ry="230" fill="url(#${id}-dimple)"/>
      <ellipse cx="360" cy="330" rx="132" ry="92" fill="#fff" opacity="0.3" transform="rotate(-28 360 330)"/>`,
}

const hair: Drawing = {
  subject: 'a human hair, close enough to see the cuticle scales',
  wm: 7.0e-5,
  hm: 7.0e-5,
  axis: 'w',
  word: 'across',
  draw: (c, id) => {
    // Overlapping scales, like roof tiles pointing at the tip. This is the
    // only thing that makes a hair read as a hair rather than a rope.
    // Chevrons, not bands: each scale is a tile whose free edge points up the
    // shaft, which is why a hair feels smooth one way and rough the other.
    const scales = Array.from({ length: 13 }, (_, i) => {
      // Uneven, because they are: a cuticle is grown, not machined, and the
      // regular version read as turned wood.
      const y = -70 + i * 92 + rnd(67, i) * 34
      const dip = 26 + rnd(67, i + 20) * 26
      const off = (rnd(67, i + 40) - 0.5) * 240
      const edge = `M-40 ${(y + dip).toFixed(1)} Q${(500 + off).toFixed(1)} ${(y - dip * 0.4).toFixed(
        1,
      )} 1040 ${(y + dip).toFixed(1)}`
      return (
        // The free edge of each scale overhangs the next, so the shadow under
        // it is what you actually see.
        `<path d="${edge}" fill="none" stroke="${dk(c, 0.55)}" stroke-width="13" opacity="0.4"/>` +
        `<path d="${edge}" transform="translate(0 -7)" fill="none" stroke="${lt(c, 0.55)}"
          stroke-width="6" opacity="0.34"/>`
      )
    }).join('')
    return `
      <defs>
        <linearGradient id="${id}-shaft" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="${dk(c, 0.72)}"/>
          <stop offset="14%" stop-color="${dk(c, 0.3)}"/>
          <stop offset="30%" stop-color="${lt(c, 0.55)}"/>
          <stop offset="46%" stop-color="${c}"/>
          <stop offset="78%" stop-color="${dk(c, 0.4)}"/>
          <stop offset="100%" stop-color="${dk(c, 0.75)}"/>
        </linearGradient>
        <clipPath id="${id}-clip"><rect x="0" y="0" width="1000" height="1000"/></clipPath>
      </defs>
      <g clip-path="url(#${id}-clip)">
        <rect x="0" y="0" width="1000" height="1000" fill="url(#${id}-shaft)"/>
        ${scales}
        <rect x="268" y="0" width="26" height="1000" fill="#fff" opacity="0.3"/>
        <rect x="238" y="0" width="76" height="1000" fill="#fff" opacity="0.08"/>
      </g>`
  },
}

const sandGrain: Drawing = {
  subject: 'a grain of quartz sand — sub-angular, pitted, part translucent',
  wm: 5.0e-4,
  hm: 5.0e-4 * 0.86,
  axis: 'w',
  word: 'across',
  draw: (c, id) => {
    const H = 860
    const cx = 500
    const cy = 430
    // Eleven vertices at varying radius, corners eased rather than rounded
    // off: that is what "sub-angular" means, and it is the difference between
    // a grain of sand and a potato.
    const N = 11
    const pts = Array.from({ length: N }, (_, i) => {
      const a = (i / N) * Math.PI * 2 + rnd(59, i) * 0.22
      const r = 340 + rnd(59, i + 20) * 120
      return [cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.86]
    })
    const outline =
      'M' +
      pts
        .map(([x, y], i) => {
          const [px, py] = pts[(i + N - 1) % N]
          const ex = x + (px - x) * 0.11
          const ey = y + (py - y) * 0.11
          const [nx, ny] = pts[(i + 1) % N]
          const sx = x + (nx - x) * 0.11
          const sy = y + (ny - y) * 0.11
          return `${i === 0 ? '' : 'L'}${ex.toFixed(1)} ${ey.toFixed(1)} Q${x.toFixed(
            1,
          )} ${y.toFixed(1)} ${sx.toFixed(1)} ${sy.toFixed(1)}`
        })
        .join(' ') +
      'Z'
    // Flat faces, each catching the light differently. A conchoidal fracture
    // gives large faces, so three or four, not a mosaic.
    const faces = [
      { i: 0, k: 4, f: lt(c, 0.72) },
      { i: 3, k: 3, f: lt(c, 0.22) },
      { i: 6, k: 3, f: dk(c, 0.16) },
      { i: 8, k: 4, f: dk(c, 0.34) },
    ]
      .map(
        (g) =>
          `<path d="M${cx} ${cy} ${Array.from({ length: g.k + 1 }, (_, j) => {
            const [x, y] = pts[(g.i + j) % N]
            return `L${x.toFixed(1)} ${y.toFixed(1)}`
          }).join(' ')}Z" fill="${g.f}"/>`,
      )
      .join('')
    const pits = Array.from({ length: 26 }, (_, i) => {
      const a = rnd(61, i) * Math.PI * 2
      const rr = Math.sqrt(rnd(61, i + 40)) * 300
      return `<ellipse cx="${(cx + Math.cos(a) * rr).toFixed(1)}" cy="${(
        cy +
        Math.sin(a) * rr * 0.86
      ).toFixed(1)}" rx="${(6 + rnd(61, i + 80) * 16).toFixed(1)}" ry="${(
        4 +
        rnd(61, i + 120) * 11
      ).toFixed(1)}" fill="${dk(c, 0.6)}" opacity="0.24"
        transform="rotate(${(rnd(61, i + 160) * 180).toFixed(0)} ${(cx + Math.cos(a) * rr).toFixed(
        1,
      )} ${(cy + Math.sin(a) * rr * 0.86).toFixed(1)})"/>`
    }).join('')
    return `
      <defs>
        <clipPath id="${id}-grain"><path d="${outline}"/></clipPath>
        <linearGradient id="${id}-q" x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stop-color="${lt(c, 0.6)}"/>
          <stop offset="50%" stop-color="${c}"/>
          <stop offset="100%" stop-color="${dk(c, 0.3)}"/>
        </linearGradient>
      </defs>
      <path d="${outline}" fill="url(#${id}-q)"/>
      <g clip-path="url(#${id}-grain)">
        ${faces}
        ${pits}
        <path d="M120 180 Q420 300 340 700" fill="none" stroke="${dk(c, 0.62)}"
              stroke-width="10" opacity="0.45"/>
        <path d="M700 90 Q640 400 880 620" fill="none" stroke="${dk(c, 0.62)}"
              stroke-width="9" opacity="0.4"/>
        <ellipse cx="330" cy="230" rx="150" ry="74" fill="#fff" opacity="0.34"
                 transform="rotate(-26 330 230)"/>
      </g>
      <path d="${outline}" fill="none" stroke="${dk(c, 0.42)}" stroke-width="13"/>`
  },
}

/* ---- things you could hold --------------------------------------------- */

const ant: Drawing = {
  subject: 'an ant, side on',
  wm: 5.0e-3,
  hm: 5.0e-3 / 3.1,
  axis: 'w',
  word: 'long',
  draw: (c, id) => {
    const H = 323
    const leg = (x: number, dx: number, dy: number) =>
      `<path d="M${x} 180 q${dx * 0.4} ${dy * 0.7} ${dx} ${dy} q${dx * 0.5} ${-dy * 0.35} ${dx * 1.1} ${
        dy * 0.55
      }"
        fill="none" stroke="${dk(c, 0.2)}" stroke-width="16" stroke-linecap="round"/>`
    return `
      <defs>
        <radialGradient id="${id}-seg" cx="36%" cy="26%" r="78%">
          <stop offset="0%" stop-color="${lt(c, 0.5)}"/>
          <stop offset="60%" stop-color="${c}"/>
          <stop offset="100%" stop-color="${dk(c, 0.55)}"/>
        </radialGradient>
      </defs>
      ${leg(430, -120, 96)}${leg(455, -20, 118)}${leg(480, 120, 96)}
      ${leg(410, -150, 78)}${leg(500, 150, 78)}
      <path d="M330 168 L446 158" stroke="${dk(c, 0.3)}" stroke-width="20"/>
      <path d="M560 152 L640 150" stroke="${dk(c, 0.3)}" stroke-width="22"/>
      <ellipse cx="820" cy="150" rx="180" ry="132" fill="url(#${id}-seg)"/>
      <ellipse cx="500" cy="152" rx="112" ry="88" fill="url(#${id}-seg)"/>
      <ellipse cx="228" cy="150" rx="132" ry="112" fill="url(#${id}-seg)"/>
      <circle cx="176" cy="120" r="30" fill="#241a12"/>
      <circle cx="166" cy="112" r="10" fill="#fff" opacity="0.6"/>
      <path d="M150 106 q-70 -66 -128 -76" fill="none" stroke="${dk(c, 0.2)}" stroke-width="15" stroke-linecap="round"/>
      <path d="M150 150 q-74 -30 -134 -22" fill="none" stroke="${dk(c, 0.2)}" stroke-width="15" stroke-linecap="round"/>
      <path d="M104 176 q-44 20 -74 8" fill="none" stroke="${dk(c, 0.35)}" stroke-width="13" stroke-linecap="round"/>
      <path d="M104 194 q-40 30 -78 26" fill="none" stroke="${dk(c, 0.35)}" stroke-width="13" stroke-linecap="round"/>
      <ellipse cx="770" cy="106" rx="96" ry="42" fill="#fff" opacity="0.22" transform="rotate(-14 770 106)"/>
      <path d="M700 ${H - 100} q120 40 232 -18" fill="none" stroke="${dk(c, 0.5)}" stroke-width="12" opacity="0.5"/>`
  },
}

const coin: Drawing = {
  subject: 'a coin, face up, with a milled edge',
  wm: 2.45e-2,
  hm: 2.45e-2,
  axis: 'w',
  word: 'across',
  draw: (c, id) => {
    const mill = Array.from({ length: 120 }, (_, i) => {
      const a = (i / 120) * Math.PI * 2
      const x0 = 500 + Math.cos(a) * 452
      const y0 = 500 + Math.sin(a) * 452
      const x1 = 500 + Math.cos(a) * 496
      const y1 = 500 + Math.sin(a) * 496
      return `<path d="M${x0.toFixed(1)} ${y0.toFixed(1)} L${x1.toFixed(1)} ${y1.toFixed(1)}"
        stroke="${dk(c, 0.42)}" stroke-width="9" opacity="0.7"/>`
    }).join('')
    const leaf = (a: number, s: number) => {
      const x = 500 + Math.cos(a) * 320
      const y = 500 + Math.sin(a) * 320
      const d = ((a * 180) / Math.PI + 90 * s).toFixed(1)
      return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="56" ry="24" fill="${dk(c, 0.3)}"
        opacity="0.75" transform="rotate(${d} ${x.toFixed(1)} ${y.toFixed(1)})"/>`
    }
    const wreath = Array.from({ length: 18 }, (_, i) => {
      const a = Math.PI * 0.32 + (i / 17) * Math.PI * 1.36
      return leaf(a, i % 2 ? 1 : -1)
    }).join('')
    return `
      <defs>
        <radialGradient id="${id}-face" cx="36%" cy="30%" r="76%">
          <stop offset="0%" stop-color="${lt(c, 0.55)}"/>
          <stop offset="58%" stop-color="${c}"/>
          <stop offset="100%" stop-color="${dk(c, 0.4)}"/>
        </radialGradient>
      </defs>
      <circle cx="500" cy="500" r="498" fill="${dk(c, 0.45)}"/>
      ${mill}
      <circle cx="500" cy="500" r="452" fill="url(#${id}-face)"/>
      <circle cx="500" cy="500" r="410" fill="none" stroke="${dk(c, 0.3)}" stroke-width="12" opacity="0.6"/>
      ${wreath}
      <path d="M470 330 L560 330 L560 690 L620 690 L620 740 L400 740 L400 690 L470 690Z"
            fill="${dk(c, 0.34)}" opacity="0.85"/>
      <path d="M470 330 L560 330 L560 350 L470 350Z" fill="#fff" opacity="0.3"/>
      <ellipse cx="360" cy="290" rx="180" ry="90" fill="#fff" opacity="0.16" transform="rotate(-30 360 290)"/>`
  },
}

const person: Drawing = {
  subject: 'a person, standing',
  wm: 1.7 * 0.33,
  hm: 1.7,
  axis: 'h',
  word: 'tall',
  draw: (c, id) => {
    const W = 330
    return `
      <defs>
        <linearGradient id="${id}-cloth" x1="0" y1="0" x2="1" y2="0.2">
          <stop offset="0%" stop-color="${lt(c, 0.36)}"/>
          <stop offset="58%" stop-color="${c}"/>
          <stop offset="100%" stop-color="${dk(c, 0.42)}"/>
        </linearGradient>
      </defs>
      <path d="M136 262 q29 -18 58 0 q22 14 22 46 v22 q0 40 -32 52 h-38 q-32 -12 -32 -52 v-22 q0 -32 22 -46Z"
            fill="${lt(c, 0.62)}"/>
      <path d="M124 300 q-16 -74 41 -78 q57 4 41 78 q-6 -34 -41 -30 q-35 -4 -41 30Z" fill="${dk(c, 0.68)}"/>
      <path d="M150 382 h30 l6 30 h-42Z" fill="${lt(c, 0.5)}"/>
      <path d="M112 404 q53 -22 106 0 q34 14 34 74 v182 q0 26 -18 26 h-138 q-18 0 -18 -26 v-182 q0 -60 34 -74Z"
            fill="url(#${id}-cloth)"/>
      <path d="M112 410 q-30 16 -34 76 l-8 168 q-2 22 18 24 q18 2 22 -22 l16 -164Z" fill="${dk(c, 0.2)}"/>
      <path d="M218 410 q30 16 34 76 l8 168 q2 22 -18 24 q-18 2 -22 -22 l-16 -164Z" fill="${dk(c, 0.3)}"/>
      <circle cx="76" cy="694" r="22" fill="${lt(c, 0.62)}"/>
      <circle cx="254" cy="694" r="22" fill="${lt(c, 0.62)}"/>
      <path d="M104 682 h56 l-4 316 q0 22 -22 22 q-22 0 -24 -22Z" fill="${dk(c, 0.5)}"/>
      <path d="M170 682 h56 l6 316 q2 22 -22 22 q-22 0 -24 -22Z" fill="${dk(c, 0.58)}"/>
      <path d="M100 1000 q-14 -34 8 -44 h54 l4 44Z" fill="${dk(c, 0.74)}"/>
      <path d="M176 1000 l4 -44 h54 q22 10 8 44Z" fill="${dk(c, 0.74)}"/>
      <path d="M112 470 q53 -16 106 0" fill="none" stroke="#fff" stroke-width="7" opacity="0.24"/>`
  },
}

const car: Drawing = {
  subject: 'a car, side on',
  wm: 4.5,
  hm: 4.5 / 3,
  axis: 'w',
  word: 'long',
  draw: (c, id) => {
    const H = 333
    const wheel = (x: number) => `
      <circle cx="${x}" cy="256" r="66" fill="#1b1c20"/>
      <circle cx="${x}" cy="256" r="36" fill="#b9bfc7"/>
      <circle cx="${x}" cy="256" r="13" fill="#7d848d"/>
      ${Array.from({ length: 5 }, (_, i) => {
        const a = (i / 5) * Math.PI * 2 - 0.5
        return `<path d="M${x} 256 L${(x + Math.cos(a) * 32).toFixed(1)} ${(256 + Math.sin(a) * 32).toFixed(
          1,
        )}" stroke="#8b929b" stroke-width="11" stroke-linecap="round"/>`
      }).join('')}`
    return `
      <defs>
        <linearGradient id="${id}-paint" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${lt(c, 0.5)}"/>
          <stop offset="40%" stop-color="${c}"/>
          <stop offset="100%" stop-color="${dk(c, 0.48)}"/>
        </linearGradient>
        <linearGradient id="${id}-glass" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stop-color="#dfeaf5"/>
          <stop offset="100%" stop-color="#7f97ad"/>
        </linearGradient>
      </defs>
      <path d="M34 252 q0 -66 66 -80 l104 -18 q64 -74 176 -76 q118 -2 176 76 l186 26 q90 16 216 44
               q42 14 42 52 v34 q0 22 -26 22 h-902 q-38 0 -38 -34Z" fill="url(#${id}-paint)"/>
      <path d="M232 168 q54 -60 142 -62 q92 -2 138 62 l-4 8 h-272Z" fill="url(#${id}-glass)"/>
      <path d="M534 176 q66 4 148 22 l60 14 h-208Z" fill="url(#${id}-glass)"/>
      <path d="M226 178 h520 q-8 12 -22 12 h-482q-12 0 -16 -12Z" fill="${dk(c, 0.6)}" opacity="0.5"/>
      <path d="M520 178 v78" stroke="${dk(c, 0.5)}" stroke-width="8" opacity="0.7"/>
      <path d="M400 220 h64" stroke="${dk(c, 0.55)}" stroke-width="14" stroke-linecap="round"/>
      <path d="M600 224 h58" stroke="${dk(c, 0.55)}" stroke-width="14" stroke-linecap="round"/>
      <path d="M46 232 q34 -8 62 0 q6 20 0 32 h-62Z" fill="#ffe9a8"/>
      <path d="M958 230 q-32 -6 -56 2 q-6 18 0 28 h56Z" fill="#e26a5e"/>
      <path d="M120 200 q180 -34 640 12" fill="none" stroke="#fff" stroke-width="9" opacity="0.24"/>
      <path d="M34 272 h930" stroke="${dk(c, 0.66)}" stroke-width="10" opacity="0.5"/>
      ${wheel(228)}${wheel(760)}
      <ellipse cx="500" cy="${H - 14}" rx="440" ry="12" fill="#000" opacity="0.2"/>`
  },
}

/* ---- big things -------------------------------------------------------- */

const blueWhale: Drawing = {
  subject: 'a blue whale — rorqual pleats, a tiny dorsal fin, notched flukes',
  wm: 30,
  hm: 30 / 5.4,
  axis: 'w',
  word: 'long',
  draw: (c, id) => {
    const H = 185
    // Pleats run from the chin to the navel and are the reason the throat can
    // balloon to hold ninety tonnes of water. They stop at about a third of
    // the body; drawing them the whole length would make it a fish again.
    const pleats = Array.from({ length: 17 }, (_, i) => {
      const t = i / 16
      const x = 56 + t * 268
      const yTop = 112 + t * 20
      const len = 26 + Math.sin(t * Math.PI) * 16
      return `<path d="M${x.toFixed(1)} ${yTop.toFixed(1)} q${(6 - t * 10).toFixed(1)} ${(
        len / 2
      ).toFixed(1)} ${(2 - t * 8).toFixed(1)} ${len.toFixed(1)}" fill="none"
        stroke="${dk(c, 0.42)}" stroke-width="3.4" stroke-linecap="round" opacity="0.55"/>`
    }).join('')
    const mottle = Array.from({ length: 26 }, (_, i) => {
      const x = 210 + rnd(5, i) * 600
      const y = 62 + rnd(5, i + 30) * 62
      return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${(
        11 +
        rnd(5, i + 60) * 15
      ).toFixed(1)}" ry="${(5 + rnd(5, i + 90) * 4).toFixed(1)}" fill="${lt(
      c,
      0.5,
    )}" opacity="0.22"/>`
    }).join('')
    return `
      <defs>
        <linearGradient id="${id}-skin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${dk(c, 0.5)}"/>
          <stop offset="42%" stop-color="${c}"/>
          <stop offset="72%" stop-color="${mix(c, '#cfc6a6', 0.44)}"/>
          <stop offset="100%" stop-color="${mix(c, '#ded5b4', 0.66)}"/>
        </linearGradient>
      </defs>
      <path d="M846 82 C892 58 936 30 992 16 C982 58 958 84 906 94
               C958 104 982 130 992 172 C936 158 892 130 846 106Z" fill="${dk(c, 0.4)}"/>
      <path d="M300 126 C346 148 402 166 452 172 C428 148 372 126 322 118Z" fill="${dk(c, 0.32)}"/>
      <path d="M718 74 Q742 44 762 78 Q740 72 718 74Z" fill="${dk(c, 0.45)}"/>
      <path d="M26 100 C58 66 132 46 236 44 C420 42 660 62 880 92
               L880 98 C660 126 420 148 236 146 C132 146 58 130 26 100Z"
            fill="url(#${id}-skin)"/>
      ${mottle}
      ${pleats}
      <path d="M26 100 C86 108 156 116 214 118" fill="none" stroke="${dk(c, 0.5)}"
            stroke-width="4" stroke-linecap="round" opacity="0.8"/>
      <path d="M104 66 q9 -10 18 -1 q-9 5 -18 1Z" fill="${dk(c, 0.55)}"/>
      <circle cx="196" cy="106" r="6" fill="#10151b"/>
      <circle cx="194" cy="104" r="2" fill="#fff" opacity="0.7"/>
      <path d="M300 50 C500 60 700 76 852 92" fill="none" stroke="${lt(c, 0.35)}"
            stroke-width="3" opacity="0.3"/>`
  },
}

const pitch: Drawing = {
  subject: 'a football pitch from above, mown in stripes',
  wm: 105,
  hm: 68,
  axis: 'w',
  word: 'long',
  draw: (c, id) => {
    const W = 1000
    const H = 648
    const stripes = Array.from({ length: 10 }, (_, i) =>
      i % 2
        ? `<rect x="${(i * W) / 10}" y="0" width="${W / 10}" height="${H}" fill="${dk(c, 0.16)}"/>`
        : '',
    ).join('')
    const box = (x: number, w: number, h: number) =>
      `<rect x="${x}" y="${(H - h) / 2}" width="${w}" height="${h}" fill="none" stroke="#fff" stroke-width="7"/>`
    return `
      <rect x="0" y="0" width="${W}" height="${H}" fill="${c}"/>
      ${stripes}
      <rect x="26" y="26" width="${W - 52}" height="${H - 52}" fill="none" stroke="#fff" stroke-width="7"/>
      <path d="M500 26 V${H - 26}" stroke="#fff" stroke-width="7"/>
      <circle cx="500" cy="${H / 2}" r="87" fill="none" stroke="#fff" stroke-width="7"/>
      <circle cx="500" cy="${H / 2}" r="10" fill="#fff"/>
      ${box(26, 157, 380)}${box(W - 26 - 157, 157, 380)}
      ${box(26, 52, 172)}${box(W - 26 - 52, 52, 172)}
      <circle cx="130" cy="${H / 2}" r="9" fill="#fff"/>
      <circle cx="${W - 130}" cy="${H / 2}" r="9" fill="#fff"/>
      <path d="M183 ${H / 2 - 60} a87 87 0 0 0 0 120" fill="none" stroke="#fff" stroke-width="7"/>
      <path d="M${W - 183} ${H / 2 - 60} a87 87 0 0 1 0 120" fill="none" stroke="#fff" stroke-width="7"/>
      <path d="M26 42 a16 16 0 0 0 16 -16" fill="none" stroke="#fff" stroke-width="6"/>
      <path d="M${W - 26} 42 a16 16 0 0 1 -16 -16" fill="none" stroke="#fff" stroke-width="6"/>
      <path d="M26 ${H - 42} a16 16 0 0 1 16 16" fill="none" stroke="#fff" stroke-width="6"/>
      <path d="M${W - 26} ${H - 42} a16 16 0 0 0 -16 16" fill="none" stroke="#fff" stroke-width="6"/>
      <rect x="6" y="${H / 2 - 46}" width="20" height="92" fill="#fff" opacity="0.85"/>
      <rect x="${W - 26}" y="${H / 2 - 46}" width="20" height="92" fill="#fff" opacity="0.85"/>`
  },
}

const eiffel: Drawing = {
  subject: 'the Eiffel Tower, latticed',
  wm: 125,
  hm: 330,
  axis: 'h',
  word: 'tall',
  draw: (c, id) => {
    const W = 379
    const H = 1000
    // The silhouette is close to an exponential, which is not a coincidence:
    // it was shaped so wind load is carried straight down the legs.
    const curve = (t: number) => 176 * Math.exp(-3.05 * t) + 12
    const pts = (side: number) => {
      const out: string[] = []
      for (let i = 0; i <= 40; i++) {
        const t = i / 40
        out.push(`${(W / 2 + side * curve(t)).toFixed(1)} ${(H - t * (H - 76)).toFixed(1)}`)
      }
      return out
    }
    const legL = pts(-1)
    const legR = pts(1)
    const body = `M${legL.join(' L')} L${legR.reverse().join(' L')}Z`
    const lattice: string[] = []
    for (let i = 0; i < 26; i++) {
      const t = i / 26
      const t2 = (i + 1) / 26
      const y1 = H - t * (H - 76)
      const y2 = H - t2 * (H - 76)
      const a = curve(t)
      const b = curve(t2)
      lattice.push(
        `<path d="M${(W / 2 - a).toFixed(1)} ${y1.toFixed(1)} L${(W / 2 + b).toFixed(1)} ${y2.toFixed(1)}
           M${(W / 2 + a).toFixed(1)} ${y1.toFixed(1)} L${(W / 2 - b).toFixed(1)} ${y2.toFixed(1)}"
           stroke="${dk(c, 0.45)}" stroke-width="4" opacity="0.55"/>`,
      )
    }
    return `
      <defs>
        <linearGradient id="${id}-iron" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="${dk(c, 0.42)}"/>
          <stop offset="34%" stop-color="${lt(c, 0.3)}"/>
          <stop offset="100%" stop-color="${dk(c, 0.5)}"/>
        </linearGradient>
      </defs>
      <path d="${body}" fill="url(#${id}-iron)"/>
      ${lattice.join('')}
      <path d="M${W / 2 - 176} 828 h352" stroke="${dk(c, 0.3)}" stroke-width="26"/>
      <path d="M${W / 2 - 176} 828 a176 92 0 0 1 352 0" fill="none" stroke="${dk(c, 0.36)}" stroke-width="12"/>
      <rect x="${W / 2 - 92}" y="524" width="184" height="24" fill="${dk(c, 0.28)}"/>
      <rect x="${W / 2 - 40}" y="196" width="80" height="26" fill="${dk(c, 0.24)}"/>
      <rect x="${W / 2 - 30}" y="150" width="60" height="48" rx="6" fill="${lt(c, 0.2)}"/>
      <path d="M${W / 2} 150 V26" stroke="${lt(c, 0.4)}" stroke-width="9"/>
      <circle cx="${W / 2}" cy="20" r="10" fill="#ffe9a8"/>
      <path d="M${W / 2 - 130} 1000 h260" stroke="${dk(c, 0.6)}" stroke-width="10" opacity="0.5"/>`
  },
}

const burj: Drawing = {
  subject: 'the Burj Khalifa, setbacks spiralling up three wings',
  wm: 100,
  hm: 828,
  axis: 'h',
  word: 'tall',
  draw: (c, id) => {
    const W = 121
    const H = 1000
    // 27 setbacks in a spiral is the actual design, and the reason it tapers
    // in steps rather than smoothly. The spire is the top 244 m of nothing.
    const tiers: string[] = []
    const top = 246
    for (let i = 0; i < 26; i++) {
      const t = i / 26
      const y = H - 26 - t * (H - 26 - top)
      const h = (H - 26 - top) / 26 + 1
      const w = 100 * Math.pow(1 - t, 0.52) + 9
      const off = Math.sin(i * 1.1) * 3
      tiers.push(
        `<rect x="${(W / 2 - w / 2 + off).toFixed(1)}" y="${(y - h).toFixed(1)}" width="${w.toFixed(
          1,
        )}" height="${h.toFixed(1)}" fill="url(#${id}-glass)"/>` +
          `<rect x="${(W / 2 - w / 2 + off).toFixed(1)}" y="${(y - h).toFixed(1)}" width="${w.toFixed(
            1,
          )}" height="2.6" fill="${lt(c, 0.7)}" opacity="0.75"/>`,
      )
    }
    const mullions = Array.from({ length: 13 }, (_, i) => {
      const x = W / 2 - 46 + i * 7.7
      return `<path d="M${x.toFixed(1)} ${H - 26} V${top + 40}" stroke="${dk(c, 0.4)}"
        stroke-width="1.6" opacity="0.4"/>`
    }).join('')
    return `
      <defs>
        <linearGradient id="${id}-glass" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="${dk(c, 0.42)}"/>
          <stop offset="30%" stop-color="${lt(c, 0.45)}"/>
          <stop offset="62%" stop-color="${c}"/>
          <stop offset="100%" stop-color="${dk(c, 0.5)}"/>
        </linearGradient>
      </defs>
      ${tiers.join('')}
      ${mullions}
      <path d="M${W / 2 - 5} ${top + 20} L${W / 2 - 2.2} 26 L${W / 2 + 2.2} 26 L${W / 2 + 5} ${top + 20}Z"
            fill="${lt(c, 0.35)}"/>
      <circle cx="${W / 2}" cy="22" r="4.4" fill="#ffdf8f"/>
      <ellipse cx="${W / 2}" cy="${H - 22}" rx="62" ry="12" fill="#000" opacity="0.22"/>`
  },
}

const everest: Drawing = {
  subject: 'Everest, drawn from sea level because that is what 8,849 metres means',
  // Quoted by elevation, and the massif around it is wider than it is high.
  // Sizing this from `m` alone was the clearest case for the two-axis change.
  wm: 8849 * 1.9,
  hm: 8849,
  // Quoted by elevation, and wider than that elevation. This entry is the one
  // that broke the single-field version of this: "tall" here names the axis
  // `m` measures, not the longer of the two.
  axis: 'h',
  word: 'tall',
  draw: (c, id) => {
    // Authored on the massif's own 1900x1000 and scaled into the viewBox,
    // which is 1000 across because here the width is the longer side.
    const W = 1900
    const H = 1000
    const k = (1000 / W).toFixed(6)
    const snow = lt(c, 0.55)
    return `
      <defs>
        <linearGradient id="${id}-rock" x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stop-color="#7a6f60"/>
          <stop offset="46%" stop-color="#544a3f"/>
          <stop offset="100%" stop-color="#2e2822"/>
        </linearGradient>
        <linearGradient id="${id}-haze" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0"/>
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0.12"/>
        </linearGradient>
      </defs>
      <g transform="scale(${k})">
      <path d="M0 ${H} L150 780 L330 840 L520 560 L660 660 L900 120 L1090 470 L1240 380
               L1420 700 L1610 600 L1760 810 L1900 ${H}Z" fill="url(#${id}-rock)"/>
      <path d="M900 120 L1010 350 L960 372 L880 300 L820 356 L760 300Z" fill="${snow}"/>
      <path d="M900 120 L820 356 L760 300 L840 240Z" fill="#ffffff" opacity="0.55"/>
      <path d="M520 560 L586 640 L540 660 L470 620Z" fill="${snow}" opacity="0.8"/>
      <path d="M1240 380 L1300 470 L1240 490 L1190 440Z" fill="${snow}" opacity="0.8"/>
      <path d="M900 120 L1090 470 L1240 380 L1420 700 L1610 600 L1760 810 L1900 ${H} L1500 ${H}Z"
            fill="#000" opacity="0.34"/>
      <path d="M900 120 L660 660 L520 560 L330 840 L150 780 L0 ${H} L520 ${H}Z" fill="#fff" opacity="0.1"/>
      ${Array.from({ length: 9 }, (_, i) => {
        const x = 300 + rnd(13, i) * 1300
        const y = 380 + rnd(13, i + 20) * 480
        return `<path d="M${x.toFixed(1)} ${y.toFixed(1)} l${(40 + rnd(13, i + 40) * 60).toFixed(1)} ${(
          70 +
          rnd(13, i + 60) * 80
        ).toFixed(1)}" stroke="${snow}" stroke-width="9" stroke-linecap="round" opacity="0.5"/>`
      }).join('')}
      <path d="M900 130 q220 -46 420 20 q-200 60 -420 -20Z" fill="#fff" opacity="0.45"/>
      <rect x="0" y="${H - 260}" width="${W}" height="260" fill="url(#${id}-haze)"/>
      </g>`
  },
}

const manhattan: Drawing = {
  subject: 'Manhattan from above — the island, the park and the grid',
  wm: 21000 / 5.7,
  hm: 21000,
  // The island runs up the drawing, so its length is the vertical axis. The
  // other entry that pulled the axis and the word apart.
  axis: 'h',
  word: 'long',
  draw: (c, id) => {
    const W = 175
    const H = 1000
    const island =
      'M96 4 L128 74 L140 190 L134 300 L146 392 L138 470 L150 560 L140 660 L124 742 ' +
      'L106 830 L86 900 L58 962 L36 996 L20 972 L14 880 L22 780 L14 690 L24 590 L16 500 ' +
      'L26 400 L20 300 L34 200 L52 110 L72 40Z'
    // Cross streets run east-west, avenues north-south, and the grid stops at
    // the bottom because the old city was built before anyone planned it.
    const streets = Array.from({ length: 44 }, (_, i) => {
      const y = 60 + i * 19
      return `<path d="M0 ${y} H${W}" stroke="${dk(c, 0.62)}" stroke-width="2" opacity="0.75"/>`
    }).join('')
    const aves = Array.from({ length: 8 }, (_, i) => {
      const x = 22 + i * 17
      return `<path d="M${x} 40 V860" stroke="${dk(c, 0.68)}" stroke-width="2.6" opacity="0.8"/>`
    }).join('')
    return `
      <defs>
        <clipPath id="${id}-isl"><path d="${island}"/></clipPath>
        <linearGradient id="${id}-city" x1="0" y1="0" x2="1" y2="0.4">
          <stop offset="0%" stop-color="${lt(c, 0.34)}"/>
          <stop offset="60%" stop-color="${c}"/>
          <stop offset="100%" stop-color="${dk(c, 0.55)}"/>
        </linearGradient>
      </defs>
      <path d="${island}" fill="url(#${id}-city)"/>
      <g clip-path="url(#${id}-isl)">
        ${streets}${aves}
        <rect x="48" y="196" width="56" height="150" fill="#3f7d47"/>
        <ellipse cx="76" cy="252" rx="18" ry="26" fill="#3f7fb8"/>
        <rect x="30" y="520" width="14" height="26" fill="${lt(c, 0.6)}"/>
        <rect x="96" y="470" width="12" height="30" fill="${lt(c, 0.55)}"/>
        <rect x="58" y="612" width="16" height="22" fill="${lt(c, 0.5)}"/>
        <path d="M0 860 q90 -20 175 6 V1000 H0Z" fill="${dk(c, 0.22)}"/>
        <path d="M0 300 q60 30 175 -10" fill="none" stroke="${dk(c, 0.5)}" stroke-width="3" opacity="0.5"/>
      </g>
      <path d="${island}" fill="none" stroke="${lt(c, 0.55)}" stroke-width="4"/>`
  },
}

const grandCanyon: Drawing = {
  subject: 'the Grand Canyon from above — a ragged hole with a river in it',
  wm: 446000,
  hm: 446000 / 4.4,
  axis: 'w',
  word: 'long',
  draw: (c, id) => {
    const W = 1000
    const H = 227
    // One centreline, and everything is built off it: the rim, the inner
    // bench, the side canyons and the river. Drawn independently they drift.
    const mid = (t: number) => 113 + Math.sin(t * 7.4 + 0.6) * 42
    // Width varies, and the rim is crenulated at a finer scale than that —
    // which is most of why an aerial photograph of it looks the way it does.
    const halfW = (t: number, side: number) =>
      34 +
      15 * Math.sin(t * 12.7 + side * 2.1) +
      10 * Math.sin(t * 31.3 + side * 4.7) +
      7 * Math.sin(t * 79.1 + side) +
      4 * Math.sin(t * 173.3 + side * 3)
    // The loop direction comes from the step, not from which side of the
    // centreline this edge is. Reading it off `side` meant both edges exited
    // before their first iteration and the canyon rim was never drawn at all —
    // and nothing caught it, because the river and the side canyons left
    // enough ink and enough contrast for every measurement to pass.
    const edge = (side: number, from0: number, to0: number, step: number) => {
      const out: string[] = []
      for (let t = from0; step > 0 ? t <= to0 + 1e-9 : t >= to0 - 1e-9; t += step) {
        const tt = Math.min(1, Math.max(0, t))
        out.push(`${(tt * W).toFixed(1)} ${(mid(tt) + side * halfW(tt, side)).toFixed(1)}`)
      }
      return out
    }
    const rim = 'M' + edge(-1, 0, 1, 0.008).join(' L') + ' L' + edge(1, 1, 0, -0.008).join(' L') + 'Z'
    const bench =
      'M' +
      edge(-0.58, 0, 1, 0.012).join(' L') +
      ' L' +
      edge(0.58, 1, 0, -0.012).join(' L') +
      'Z'
    const river =
      'M' +
      Array.from({ length: 81 }, (_, i) => {
        const t = i / 80
        return `${(t * W).toFixed(1)} ${(mid(t) + Math.sin(t * 23) * 7).toFixed(1)}`
      }).join(' L')
    /* Side canyons. Drawn as tapering valleys rather than wedges: a triangle
       with a sharp apex reads as a thorn stuck on the outside of the gorge,
       which is what the first version looked like. Each is a curve stroked
       three times at falling width with round caps, and forks once, because
       a drainage network is self-similar and one level of that is enough for
       the eye to accept it. */
    const valley = (x, y, ax, ay, len, w, k) => {
      const cxp = x + ax * len * 0.5 - ay * len * 0.26
      const cyp = y + ay * len * 0.5 + ax * len * 0.26
      const x2 = x + ax * len
      const y2 = y + ay * len
      const d = `M${x.toFixed(1)} ${y.toFixed(1)} Q${cxp.toFixed(1)} ${cyp.toFixed(1)} ${x2.toFixed(
        1,
      )} ${y2.toFixed(1)}`
      let out = ''
      for (const [f, o] of [
        [1, 1],
        [0.62, 1],
        [0.3, 1],
      ]) {
        out += `<path d="${d}" fill="none" stroke="${dk(c, 0.5)}" stroke-width="${(w * f).toFixed(
          1,
        )}" stroke-linecap="round" opacity="${o}"/>`
      }
      if (k > 0) {
        for (const turn of [-0.62, 0.58]) {
          const bx = x + ax * len * 0.5
          const by = y + ay * len * 0.5
          out += valley(
            bx,
            by,
            ax * Math.cos(turn) - ay * Math.sin(turn),
            ax * Math.sin(turn) + ay * Math.cos(turn),
            len * 0.5,
            w * 0.55,
            k - 1,
          )
        }
      }
      return out
    }
    const side = Array.from({ length: 15 }, (_, i) => {
      const t = 0.045 + (i / 15) * 0.91
      const s0 = i % 2 === 0 ? -1 : 1
      const y0 = mid(t) + s0 * (halfW(t, s0) - 6)
      const lean = (rnd(17, i + 60) - 0.5) * 1.1
      return valley(
        t * W,
        y0,
        Math.sin(lean),
        s0 * Math.cos(lean),
        30 + rnd(17, i) * 32,
        22 + rnd(17, i + 30) * 12,
        1,
      )
    }).join('')
    return `
      <defs>
        <linearGradient id="${id}-plateau" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${lt(c, 0.34)}"/>
          <stop offset="52%" stop-color="${c}"/>
          <stop offset="100%" stop-color="${dk(c, 0.26)}"/>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="${W}" height="${H}" fill="url(#${id}-plateau)"/>
      ${Array.from({ length: 30 }, (_, i) => {
        const x = rnd(19, i) * W
        const y = rnd(19, i + 40) * H
        return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${(
          14 +
          rnd(19, i + 80) * 34
        ).toFixed(1)}" ry="${(5 + rnd(19, i + 120) * 9).toFixed(1)}" fill="${dk(
      c,
      0.24,
    )}" opacity="0.22"/>`
      }).join('')}
      ${side}
      <path d="${rim}" fill="${dk(c, 0.5)}"/>
      <path d="${bench}" fill="${dk(c, 0.66)}"/>
      <path d="${river}" fill="none" stroke="${dk(c, 0.82)}" stroke-width="13" stroke-linecap="round"/>
      <path d="${river}" fill="none" stroke="#4f93c2" stroke-width="6" stroke-linecap="round"/>
      <path d="${rim}" fill="none" stroke="${lt(c, 0.4)}" stroke-width="3" opacity="0.55"/>`
  },
}

/* ---- the four that really are spheres -----------------------------------

   These kept the lit ball, and gained a surface. A featureless sphere is not
   wrong for a planet the way it is wrong for a whale, but it is not Earth
   either — it is any ball in Earth's colour, and that is most of the
   difference between a diagram and a picture. -------------------------- */

const moon: Drawing = {
  subject: 'the Moon, near side — the maria and Tycho’s rays',
  wm: 3.474e6,
  hm: 3.474e6,
  axis: 'w',
  word: 'across',
  draw: (c, id) => {
    const maria = [
      [402, 300, 152, 118, -18],
      [560, 336, 96, 86, 0],
      [606, 466, 92, 74, 14],
      [742, 352, 68, 62, 0],
      [286, 452, 128, 168, 8],
      [318, 268, 74, 62, 0],
      [470, 560, 74, 58, 0],
    ]
    const craters = Array.from({ length: 34 }, (_, i) => {
      const a = rnd(23, i) * Math.PI * 2
      const rr = Math.sqrt(rnd(23, i + 50)) * 452
      const x = 500 + Math.cos(a) * rr
      const y = 500 + Math.sin(a) * rr
      const r = 8 + rnd(23, i + 100) * 30
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${dk(
        c,
        0.28,
      )}" opacity="0.5"/><circle cx="${(x - r * 0.2).toFixed(1)}" cy="${(y - r * 0.2).toFixed(
        1,
      )}" r="${(r * 0.72).toFixed(1)}" fill="${lt(c, 0.24)}" opacity="0.45"/>`
    }).join('')
    // Tycho is 108 million years old and its rays cross most of the near
    // side, which is why the Moon looks scratched at full phase.
    const rays = Array.from({ length: 20 }, (_, i) => {
      const a = (i / 20) * Math.PI * 2 + 0.3
      const len = 240 + rnd(29, i) * 300
      return `<path d="M430 742 l${(Math.cos(a) * len).toFixed(1)} ${(Math.sin(a) * len).toFixed(1)}"
        stroke="${lt(c, 0.5)}" stroke-width="${(6 + rnd(29, i + 20) * 10).toFixed(
        1,
      )}" stroke-linecap="round" opacity="0.28"/>`
    }).join('')
    return `
      <defs>
        ${ballShade(id, c)}
        <clipPath id="${id}-disc"><circle cx="500" cy="500" r="500"/></clipPath>
      </defs>
      <circle cx="500" cy="500" r="500" fill="url(#${id}-lit)"/>
      <g clip-path="url(#${id}-disc)">
        ${rays}
        ${maria
          .map(
            ([x, y, rx, ry, rot]) =>
              `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${dk(
                c,
                0.42,
              )}" opacity="0.72" transform="rotate(${rot} ${x} ${y})"/>`,
          )
          .join('')}
        ${craters}
        <circle cx="430" cy="742" r="26" fill="${lt(c, 0.6)}"/>
        <circle cx="430" cy="742" r="14" fill="${dk(c, 0.3)}"/>
      </g>
      ${limb(id, 500, 500, 500)}`
  },
}

const earth: Drawing = {
  subject: 'Earth, Africa and Europe facing you, with weather',
  wm: 1.2742e7,
  hm: 1.2742e7,
  axis: 'w',
  word: 'across',
  draw: (c, id) => {
    const land = '#4e8f52'
    const arid = '#c2a05e'
    return `
      <defs>
        <radialGradient id="${id}-sea" cx="34%" cy="28%" r="82%">
          <stop offset="0%" stop-color="${lt(c, 0.42)}"/>
          <stop offset="56%" stop-color="${c}"/>
          <stop offset="100%" stop-color="${dk(c, 0.62)}"/>
        </radialGradient>
        <clipPath id="${id}-disc"><circle cx="500" cy="500" r="500"/></clipPath>
        <radialGradient id="${id}-air" cx="50%" cy="50%" r="50%">
          <stop offset="86%" stop-color="#8fd0ff" stop-opacity="0"/>
          <stop offset="100%" stop-color="#bfe6ff" stop-opacity="0.7"/>
        </radialGradient>
      </defs>
      <circle cx="500" cy="500" r="500" fill="url(#${id}-sea)"/>
      <g clip-path="url(#${id}-disc)">
        <!-- Africa: the Sahara across the top, the Gulf of Guinea bitten out of
             the west, and the long taper to the Cape. -->
        <path d="M366 286 L470 268 L588 272 L648 300 L654 350 L628 386 L604 430
                 L588 486 L566 548 L536 612 L502 668 L462 692 L440 646 L442 586
                 L414 528 L388 460 L364 392 L352 330Z" fill="${land}"/>
        <path d="M366 286 L470 268 L588 272 L648 300 L640 342 L520 356 L398 348 L356 320Z" fill="${arid}"/>
        <!-- Arabia, then Eurasia running off the eastern limb. -->
        <path d="M656 302 L724 316 L742 366 L700 396 L662 372 L650 334Z" fill="${arid}"/>
        <path d="M470 268 L512 214 L602 200 L660 224 L642 262 L556 268Z" fill="${land}" opacity="0.92"/>
        <path d="M660 224 L780 178 L900 200 L946 258 L888 300 L774 296 L700 268Z" fill="${arid}" opacity="0.94"/>
        <path d="M760 300 L868 322 L906 380 L830 408 L748 372 L734 326Z" fill="${land}"/>
        <!-- Madagascar, because its absence is the thing people notice. -->
        <path d="M624 566 L648 600 L636 660 L608 640 L608 590Z" fill="${land}"/>
        <ellipse cx="500" cy="16" rx="330" ry="86" fill="#eef7ff" opacity="0.9"/>
        <ellipse cx="500" cy="984" rx="300" ry="80" fill="#eef7ff" opacity="0.9"/>
        ${Array.from({ length: 16 }, (_, i) => {
          const a = rnd(31, i) * Math.PI * 2
          const rr = Math.sqrt(rnd(31, i + 40)) * 470
          const x = 500 + Math.cos(a) * rr
          const y = 500 + Math.sin(a) * rr
          const w = 70 + rnd(31, i + 80) * 150
          return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${w.toFixed(1)}" ry="${(
            w * 0.3
          ).toFixed(1)}" fill="#fff" opacity="${(0.22 + rnd(31, i + 120) * 0.3).toFixed(2)}"/>`
        }).join('')}
        <path d="M120 600 q60 -70 150 -40 q80 26 40 96 q-44 76 -132 40 q-76 -32 -58 -96Z" fill="#fff" opacity="0.5"/>
      </g>
      ${limb(id, 500, 500, 500)}
      <circle cx="500" cy="500" r="500" fill="url(#${id}-air)"/>`
  },
}

const jupiter: Drawing = {
  subject: 'Jupiter — the belts, the zones and the Great Red Spot',
  wm: 1.3982e8,
  hm: 1.3982e8,
  axis: 'w',
  word: 'across',
  draw: (c, id) => {
    // Belts are the dark descending bands, zones the pale rising ones. The
    // planet is oblate by about 6.5% — visibly so, and the reason the bands
    // bow the way they do.
    const bands = [
      [-1.0, -0.82, 0.5],
      [-0.82, -0.6, 0.16],
      [-0.6, -0.42, 0.46],
      [-0.42, -0.2, 0.1],
      [-0.2, -0.04, 0.44],
      [-0.04, 0.14, 0.06],
      [0.14, 0.34, 0.5],
      [0.34, 0.52, 0.12],
      [0.52, 0.72, 0.4],
      [0.72, 1.0, 0.2],
    ]
    return `
      <defs>
        <clipPath id="${id}-disc"><circle cx="500" cy="500" r="500"/></clipPath>
        <radialGradient id="${id}-lim" cx="38%" cy="32%" r="78%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.22"/>
          <stop offset="58%" stop-color="#ffffff" stop-opacity="0"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0.58"/>
        </radialGradient>
      </defs>
      <circle cx="500" cy="500" r="500" fill="${c}"/>
      <g clip-path="url(#${id}-disc)">
        ${bands
          .map(([a, b, d]) => {
            const y = 500 + (a as number) * 500
            const h = ((b as number) - (a as number)) * 500
            return `<rect x="0" y="${y.toFixed(1)}" width="1000" height="${h.toFixed(1)}" fill="${
              (d as number) > 0.3 ? dk(c, d as number) : lt(c, 0.5 - (d as number))
            }"/>`
          })
          .join('')}
        ${Array.from({ length: 26 }, (_, i) => {
          const y = 40 + rnd(37, i) * 920
          const w = 120 + rnd(37, i + 30) * 340
          const x = rnd(37, i + 60) * 1000
          return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${w.toFixed(1)}" ry="${(
            8 +
            rnd(37, i + 90) * 16
          ).toFixed(1)}" fill="${rnd(37, i + 120) > 0.5 ? lt(c, 0.4) : dk(c, 0.36)}" opacity="0.42"/>`
        }).join('')}
        <ellipse cx="372" cy="646" rx="132" ry="72" fill="#b4482f"/>
        <ellipse cx="372" cy="646" rx="96" ry="48" fill="#d2664a"/>
        <ellipse cx="360" cy="636" rx="52" ry="24" fill="#e88b64" opacity="0.8"/>
        <ellipse cx="372" cy="646" rx="132" ry="72" fill="none" stroke="${dk(c, 0.5)}" stroke-width="9" opacity="0.6"/>
        <ellipse cx="700" cy="330" rx="60" ry="26" fill="${lt(c, 0.65)}" opacity="0.7"/>
      </g>
      <circle cx="500" cy="500" r="500" fill="url(#${id}-lim)"/>`
  },
}

const sun: Drawing = {
  subject: 'the Sun — granulation, spots, and a prominence off the limb',
  wm: 1.392e9,
  hm: 1.392e9,
  axis: 'w',
  word: 'across',
  draw: (c, id) => {
    const R = 420
    const gran = Array.from({ length: 200 }, (_, i) => {
      const a = rnd(41, i) * Math.PI * 2
      const rr = Math.sqrt(rnd(41, i + 300)) * (R - 12)
      const x = 500 + Math.cos(a) * rr
      const y = 500 + Math.sin(a) * rr
      const s = 10 + rnd(41, i + 600) * 20
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${s.toFixed(1)}" fill="${
        rnd(41, i + 900) > 0.5 ? lt(c, 0.45) : dk(c, 0.2)
      }" opacity="0.4"/>`
    }).join('')
    const spot = (x: number, y: number, r: number) => `
      <ellipse cx="${x}" cy="${y}" rx="${r * 1.5}" ry="${r}" fill="${dk(c, 0.42)}" opacity="0.85"/>
      <ellipse cx="${x}" cy="${y}" rx="${r * 0.8}" ry="${r * 0.52}" fill="${dk(c, 0.78)}"/>`
    return `
      <defs>
        <radialGradient id="${id}-corona" cx="50%" cy="50%" r="50%">
          <stop offset="${((R / 500) * 100).toFixed(0)}%" stop-color="${lt(c, 0.3)}" stop-opacity="0.5"/>
          <stop offset="100%" stop-color="${c}" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="${id}-face" cx="42%" cy="38%" r="66%">
          <stop offset="0%" stop-color="#fffce8"/>
          <stop offset="52%" stop-color="${lt(c, 0.28)}"/>
          <stop offset="88%" stop-color="${c}"/>
          <stop offset="100%" stop-color="${dk(c, 0.35)}"/>
        </radialGradient>
        <clipPath id="${id}-disc"><circle cx="500" cy="500" r="${R}"/></clipPath>
      </defs>
      <circle cx="500" cy="500" r="500" fill="url(#${id}-corona)"/>
      <path d="M862 342 q112 -104 118 -226 q-42 130 -164 176 q86 -122 44 -220 q-16 128 -118 196Z"
            fill="${lt(c, 0.35)}" opacity="0.75"/>
      <path d="M232 786 q-96 62 -170 46 q104 -8 152 -84Z" fill="${lt(c, 0.35)}" opacity="0.65"/>
      <circle cx="500" cy="500" r="${R}" fill="url(#${id}-face)"/>
      <g clip-path="url(#${id}-disc)">
        ${gran}
        ${spot(628, 424, 34)}
        ${spot(690, 452, 18)}
        ${spot(392, 636, 26)}
      </g>
      <circle cx="500" cy="500" r="${R}" fill="none" stroke="${lt(c, 0.5)}" stroke-width="6" opacity="0.5"/>`
  },
}

/* ---- the registry ------------------------------------------------------ */

/** Keyed on the thing's name in `scale-things.ts`. The checker proves the two
 *  key sets agree, so a rename cannot silently drop a drawing. */
export const SCALE_ART: Record<string, Drawing> = {
  Proton: proton,
  'Carbon nucleus': carbonNucleus,
  'Uranium nucleus': uraniumNucleus,
  'Water molecule': waterMolecule,
  Buckyball: buckyball,
  'DNA, across the helix': dna,
  'Influenza virus': influenza,
  'E. coli': ecoli,
  'Red blood cell': redBloodCell,
  'Human hair, across': hair,
  'Grain of sand': sandGrain,
  Ant: ant,
  'A coin': coin,
  'A person': person,
  'A car': car,
  'Blue whale': blueWhale,
  'Football pitch': pitch,
  'Eiffel Tower': eiffel,
  'Burj Khalifa': burj,
  'Mount Everest': everest,
  Manhattan: manhattan,
  'The Grand Canyon': grandCanyon,
  'The Moon': moon,
  Earth: earth,
  Jupiter: jupiter,
  'The Sun': sun,
}

/** The viewBox a drawing is authored on: 1000 units along its longer side. */
export function boxOf(d: Drawing) {
  const max = Math.max(d.wm, d.hm)
  return { w: Math.round((1000 * d.wm) / max), h: Math.round((1000 * d.hm) / max) }
}

/** The metres the registry quotes for a drawing — its `m`, by construction. */
export const quotedMetres = (d: Drawing) => (d.axis === 'h' ? d.hm : d.wm)

/** Full standalone SVG, sized to fill whatever box the page gives it. */
export function artSvg(name: string, colour: string): string {
  const d = SCALE_ART[name]
  if (!d) return ''
  const { w, h } = boxOf(d)
  const id = slugOf(name)
  return (
    `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" ` +
    `style="width:100%;height:100%;display:block;overflow:visible" ` +
    `aria-hidden="true" focusable="false">${d.draw(colour, id)}</svg>`
  )
}
