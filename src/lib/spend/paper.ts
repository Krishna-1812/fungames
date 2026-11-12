/**
 * The surfaces of the money, drawn on canvases: a note's face, the edges of
 * a stack of them, the paper strap round a bundle, and the wooden pallet.
 *
 * The notes are our own. They are not dollars and not any other real
 * currency — no portrait, no issuer, no seal — but they are built the way
 * real notes are, because that is what makes a stack of paper read as money
 * from across a room: a tinted cotton paper with fibres in it, fine-line
 * guilloché that turns to a soft colour at a distance, a big numeral, a
 * foil stripe that catches the light, and serial numbers. Each value has its
 * own colour, all of them cool.
 *
 * Everything is deterministic (seeded), so the same note is drawn every time.
 */

export const NOTE_COLOURS: Record<number, { ink: string; tint: string; deep: string }> = {
  100: { ink: '#1f6f7c', tint: '#cfe6e2', deep: '#123f48' },
  50: { ink: '#5a4fa8', tint: '#e3e0f2', deep: '#2f2866' },
  20: { ink: '#2f5f9e', tint: '#dbe5f2', deep: '#1a355c' },
  10: { ink: '#3b7a5c', tint: '#dcebe2', deep: '#1f4634' },
  5: { ink: '#9a4f86', tint: '#efe0ea', deep: '#58284c' },
  1: { ink: '#4f5b6b', tint: '#e2e6eb', deep: '#2a313b' },
}

const WORDS: Record<number, string> = { 100: 'ONE HUNDRED', 50: 'FIFTY', 20: 'TWENTY', 10: 'TEN', 5: 'FIVE', 1: 'ONE' }

function rng(seed: number) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

function canvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  return [c, c.getContext('2d')!] as const
}

/** A rosette of fine looping lines, the kind an engraving lathe makes. */
function rosette(g: CanvasRenderingContext2D, cx: number, cy: number, R: number, r: number, loops: number, lines: number, colour: string, width: number) {
  g.strokeStyle = colour
  g.lineWidth = width
  for (let k = 0; k < lines; k++) {
    const ph = (k / lines) * Math.PI * 2 / loops
    const rr = R - (k / lines) * r * 0.6
    g.beginPath()
    for (let i = 0; i <= 360; i++) {
      const t = (i / 360) * Math.PI * 2
      const m = rr + r * Math.sin(loops * t + ph * loops)
      const x = cx + Math.cos(t) * m, y = cy + Math.sin(t) * m
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y)
    }
    g.stroke()
  }
}

/**
 * The face of a note, 1024 × 435 — the proportions of a 156 × 66 mm note.
 * Used for both sides: from where the camera is, nobody turns one over.
 */
export function noteFace(value: number): HTMLCanvasElement {
  const W = 1024, H = 435
  const [c, g] = canvas(W, H)
  const col = NOTE_COLOURS[value] ?? NOTE_COLOURS[100]
  const rand = rng(value * 7919 + 17)

  // Cotton paper, tinted, a shade lighter in the middle where the watermark is.
  const base = g.createLinearGradient(0, 0, W, H)
  base.addColorStop(0, col.tint)
  base.addColorStop(0.5, '#f4f6f4')
  base.addColorStop(1, col.tint)
  g.fillStyle = base
  g.fillRect(0, 0, W, H)
  // Fibres: short curls, mostly paper-coloured, a few in the note's ink.
  for (let i = 0; i < 900; i++) {
    const x = rand() * W, y = rand() * H, a = rand() * Math.PI, l = 3 + rand() * 9
    g.strokeStyle = rand() < 0.06 ? col.ink + '66' : 'rgba(120,130,140,0.07)'
    g.lineWidth = 0.8
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * l, y + Math.sin(a) * l * 0.4, x + Math.cos(a + 0.5) * l, y + Math.sin(a + 0.5) * l)
    g.stroke()
  }

  // A fine wave field over the whole face: at a distance it is just colour.
  g.globalAlpha = 0.5
  for (let k = 0; k < 70; k++) {
    g.strokeStyle = col.ink + '30'
    g.lineWidth = 0.7
    g.beginPath()
    for (let x = 0; x <= W; x += 8) {
      const y = (k / 70) * H + Math.sin(x * 0.018 + k * 0.4) * 9 + Math.sin(x * 0.005 + k) * 6
      if (x === 0) g.moveTo(x, y); else g.lineTo(x, y)
    }
    g.stroke()
  }
  g.globalAlpha = 1

  // The frame: a band of interlaced waves round the edge.
  const band = 26
  g.save()
  g.beginPath(); g.rect(8, 8, W - 16, H - 16); g.rect(8 + band, 8 + band, W - 16 - 2 * band, H - 16 - 2 * band)
  g.clip('evenodd')
  g.fillStyle = col.ink + '22'; g.fillRect(0, 0, W, H)
  for (let k = 0; k < 9; k++) {
    g.strokeStyle = k % 2 ? col.ink : col.deep
    g.globalAlpha = 0.55
    g.lineWidth = 0.9
    g.beginPath()
    const per = 2 * (W + H)
    for (let s = 0; s <= per; s += 3) {
      // Walk round the rectangle, waving in and out of the band.
      let x, y, nx, ny
      if (s < W) { x = s; y = 8; nx = 0; ny = 1 }
      else if (s < W + H) { x = W - 8; y = s - W; nx = -1; ny = 0 }
      else if (s < 2 * W + H) { x = W - (s - W - H); y = H - 8; nx = 0; ny = -1 }
      else { x = 8; y = H - (s - 2 * W - H); nx = 1; ny = 0 }
      const o = band / 2 + Math.sin(s * 0.11 + k * 0.7) * (band * 0.42)
      if (s === 0) g.moveTo(x + nx * o, y + ny * o); else g.lineTo(x + nx * o, y + ny * o)
    }
    g.stroke()
  }
  g.restore()
  g.globalAlpha = 1
  g.strokeStyle = col.deep; g.lineWidth = 2
  g.strokeRect(8, 8, W - 16, H - 16)
  g.lineWidth = 1
  g.strokeRect(8 + band, 8 + band, W - 16 - 2 * band, H - 16 - 2 * band)

  // The emblem, left of centre: a compass rose inside engraved rings.
  const ex = W * 0.36, ey = H * 0.5
  rosette(g, ex, ey, 112, 14, 18, 12, col.ink + 'aa', 0.8)
  rosette(g, ex, ey, 78, 9, 24, 8, col.deep + '99', 0.7)
  g.fillStyle = col.deep
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2, long = i % 2 === 0 ? 58 : 34
    g.beginPath()
    g.moveTo(ex + Math.cos(a) * long, ey + Math.sin(a) * long)
    g.lineTo(ex + Math.cos(a + 0.32) * 12, ey + Math.sin(a + 0.32) * 12)
    g.lineTo(ex, ey)
    g.closePath(); g.fill()
    g.globalAlpha = 0.55
    g.beginPath()
    g.moveTo(ex + Math.cos(a) * long, ey + Math.sin(a) * long)
    g.lineTo(ex + Math.cos(a - 0.32) * 12, ey + Math.sin(a - 0.32) * 12)
    g.lineTo(ex, ey)
    g.closePath(); g.fill()
    g.globalAlpha = 1
  }
  g.beginPath(); g.arc(ex, ey, 7, 0, Math.PI * 2); g.fillStyle = col.tint; g.fill()

  // A rosette on the right, behind the numeral.
  rosette(g, W * 0.78, H * 0.5, 120, 18, 14, 10, col.ink + '55', 0.8)

  // The foil stripe: a band of iridescent metal.
  const fx = W * 0.6
  const foil = g.createLinearGradient(0, 0, 0, H)
  foil.addColorStop(0, '#c9d6e6'); foil.addColorStop(0.25, '#e9eef8'); foil.addColorStop(0.45, '#a9b9d8')
  foil.addColorStop(0.6, '#d7c9ec'); foil.addColorStop(0.8, '#b8e0de'); foil.addColorStop(1, '#cdd8e8')
  g.fillStyle = foil
  g.fillRect(fx, 8, 34, H - 16)
  g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 1
  for (let y = 14; y < H - 10; y += 22) { g.beginPath(); g.arc(fx + 17, y, 6, 0, Math.PI * 2); g.stroke() }

  // The numeral, big on the right and small in the corners.
  const num = String(value)
  g.textAlign = 'center'; g.textBaseline = 'middle'
  g.font = `900 ${value >= 100 ? 150 : value >= 10 ? 170 : 190}px Georgia, 'Times New Roman', serif`
  g.lineWidth = 6; g.strokeStyle = col.tint
  g.strokeText(num, W * 0.8, H * 0.52)
  g.fillStyle = col.deep
  g.fillText(num, W * 0.8, H * 0.52)
  g.font = `800 46px Georgia, 'Times New Roman', serif`
  g.fillStyle = col.ink
  g.fillText(num, 78, 66); g.fillText(num, W - 82, H - 62)
  g.fillText(num, W - 82, 66); g.fillText(num, 78, H - 62)

  // The words and the serials.
  g.font = `700 30px Georgia, 'Times New Roman', serif`
  g.fillStyle = col.deep
  g.fillText(WORDS[value] ?? num, W * 0.36, H - 54)
  g.font = `600 24px 'Courier New', monospace`
  g.fillStyle = '#25324a'
  const serial = 'TI ' + String(Math.floor(rand() * 9e7) + 1e7) + ' ' + 'ABCDEFGH'[value % 8]
  g.textAlign = 'left'
  g.fillText(serial, 64, 128)
  // The second serial low down, just left of the foil, clear of the numeral.
  g.textAlign = 'right'
  g.fillText(serial, W * 0.6 - 16, H - 104)
  // Microtext along the top of the frame's inner edge.
  g.font = `600 9px Arial, sans-serif`
  g.textAlign = 'left'
  g.fillStyle = col.deep
  g.fillText('SPEND IT · '.repeat(40), 40, 44)
  return c
}

/**
 * The edge of a bundle — a hundred sheets side on, each a slightly different
 * white — with the strap across its middle when `strap` is set. A bundle's
 * long sides show the strap; its ends do not.
 * 256 × 200: one bundle's thickness top to bottom.
 */
export function edges(strap: boolean): HTMLCanvasElement {
  const W = 256, H = 200
  const [c, g] = canvas(W, H)
  const rand = rng(strap ? 41 : 43)
  for (let i = 0; i < 100; i++) {
    const y = (i / 100) * H, v = 222 + Math.floor(rand() * 26)
    g.fillStyle = `rgb(${v - 4} ${v} ${v - 2})`
    g.fillRect(0, y, W, H / 100 + 0.5)
    // The hairline between sheets, slightly wavy.
    g.strokeStyle = 'rgba(70,90,92,0.28)'
    g.lineWidth = 0.6
    g.beginPath()
    const ph = rand() * 6
    for (let x = 0; x <= W; x += 16) g.lineTo(x, y + Math.sin(x * 0.04 + ph) * 0.5)
    g.stroke()
  }
  // A tint of the notes' own colour where the face shows at the edge.
  g.fillStyle = 'rgba(31,111,124,0.13)'
  g.fillRect(0, 0, W, H)
  // The same strap as on top, seen edge on: too narrow there for its print.
  if (strap) strapBand(g, W * 0.44, W * 0.12, H, true, false)
  return c
}

/** The paper strap round a bundle: a lavender band with its value printed. */
function strapBand(g: CanvasRenderingContext2D, x: number, w: number, h: number, vertical: boolean, print = true) {
  const grd = vertical ? g.createLinearGradient(x, 0, x + w, 0) : g.createLinearGradient(0, x, 0, x + w)
  grd.addColorStop(0, '#7c76b8'); grd.addColorStop(0.5, '#958fcd'); grd.addColorStop(1, '#7c76b8')
  g.fillStyle = grd
  if (vertical) g.fillRect(x, 0, w, h); else g.fillRect(0, x, h, w)
  if (!print) return
  g.fillStyle = 'rgba(255,255,255,0.85)'
  g.font = `800 ${Math.round(w * 0.32)}px Arial, sans-serif`
  g.textAlign = 'center'; g.textBaseline = 'middle'
  g.save()
  if (vertical) { g.translate(x + w / 2, h / 2); g.rotate(-Math.PI / 2) } else g.translate(h / 2, x + w / 2)
  g.fillText('$10,000', 0, 0)
  g.restore()
}

/** The top of a bundle: a note, with the strap across it. */
export function bundleTop(): HTMLCanvasElement {
  const face = noteFace(100)
  const [c, g] = canvas(face.width, face.height)
  g.drawImage(face, 0, 0)
  strapBand(g, face.width * 0.44, face.width * 0.12, face.height, true)
  return c
}

/**
 * A wooden pallet from the side: deck board on top, three blocks with the
 * dark open space between them, a bottom board. `long` is the 1.36 m side.
 */
export function palletSide(long: boolean): HTMLCanvasElement {
  const W = long ? 1024 : 600, H = 108
  const [c, g] = canvas(W, H)
  const rand = rng(long ? 7 : 9)
  // The dark under the deck.
  g.fillStyle = '#16120e'
  g.fillRect(0, 0, W, H)
  const wood = (x: number, y: number, w: number, h: number) => {
    const v = 0.9 + rand() * 0.18
    g.fillStyle = `rgb(${Math.round(176 * v)} ${Math.round(146 * v)} ${Math.round(104 * v)})`
    g.fillRect(x, y, w, h)
    // Grain.
    g.strokeStyle = 'rgba(96,68,40,0.25)'
    g.lineWidth = 1
    for (let k = 0; k < h / 3; k++) {
      const yy = y + rand() * h
      g.beginPath(); g.moveTo(x, yy)
      for (let xx = x; xx <= x + w; xx += 20) g.lineTo(xx, yy + Math.sin(xx * 0.03 + k) * 1.2)
      g.stroke()
    }
    g.strokeStyle = 'rgba(40,28,16,0.6)'; g.lineWidth = 1.5
    g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1)
  }
  const deck = Math.round(H * 0.17)
  wood(0, 0, W, deck)
  wood(0, H - deck, W, deck)
  const bw = Math.round(W * (long ? 0.08 : 0.13))
  for (const x of [0, (W - bw) / 2, W - bw]) {
    wood(Math.round(x), deck, bw, H - 2 * deck)
    // Nail heads.
    g.fillStyle = '#4a4f55'
    g.beginPath(); g.arc(x + bw / 2, deck / 2, 2.2, 0, Math.PI * 2); g.fill()
  }
  return c
}

/** The pallet's deck from above: boards along its length with gaps between. */
export function palletTop(): HTMLCanvasElement {
  const W = 256, H = 436
  const [c, g] = canvas(W, H)
  const rand = rng(13)
  g.fillStyle = '#16120e'; g.fillRect(0, 0, W, H)
  const boards = 7, gap = 9, bw = (W - gap * (boards - 1)) / boards
  for (let i = 0; i < boards; i++) {
    const x = i * (bw + gap), v = 0.9 + rand() * 0.18
    g.fillStyle = `rgb(${Math.round(182 * v)} ${Math.round(152 * v)} ${Math.round(110 * v)})`
    g.fillRect(x, 0, bw, H)
    g.strokeStyle = 'rgba(96,68,40,0.22)'
    for (let k = 0; k < 14; k++) {
      const xx = x + rand() * bw
      g.beginPath(); g.moveTo(xx, 0)
      for (let y = 0; y <= H; y += 24) g.lineTo(xx + Math.sin(y * 0.02 + k) * 1.5, y)
      g.stroke()
    }
  }
  return c
}
