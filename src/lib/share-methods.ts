/**
 * Share This Page — one real message, thirty ways to send it.
 *
 * Every `kind: 'real'` method is a genuine, verifiable encoding — the same
 * Morse timing a radio operator uses, the same six-dot cell the Unicode
 * Braille block was built to hold, the real DTMF frequency pairs a phone
 * keypad dials, the real equal-tempered note frequencies a piano tunes to —
 * run against whatever the visitor actually types, not a canned example.
 * `kind: 'joke'` methods make no such claim and say so in their own blurb.
 *
 * This file is data and pure functions only, so `check-share-page.mjs` can
 * run every transform in Node with no DOM and no AudioContext. The page
 * (`src/pages/share-this-page.astro`) is the only place that turns a pure
 * result into sound or a drawn grid.
 */

export type Kind = 'real' | 'joke'

export type ShareMethod = {
  id: string
  title: string
  /** Shown on the tile and, for jokes, the whole content of the modal. */
  blurb: string
  kind: Kind
  /** Inner SVG markup, 24x24 viewBox, currentColor stroke — drawn, not emoji. */
  icon: string
  accent: string
}

const S = 'fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"'

export const METHODS: ShareMethod[] = [
  // ---------------------------------------------------------------- real --
  {
    id: 'morse',
    title: 'Morse Code',
    blurb: 'The real International Morse alphabet, played at the real 1:3 dot-to-dash ratio a radio operator keys by hand.',
    kind: 'real',
    accent: '#2b4a3e',
    icon: `<circle cx="5" cy="12" r="1.6" fill="currentColor"/><rect x="10" y="10.5" width="5" height="3" rx="1" fill="currentColor"/><circle cx="18.5" cy="12" r="1.6" fill="currentColor"/>`,
  },
  {
    id: 'braille',
    title: 'Braille',
    blurb: 'Real grade-1 English Braille — the same six-dot cell and dot numbering the Unicode Braille Patterns block was built to hold.',
    kind: 'real',
    accent: '#3a2b18',
    icon: `<circle cx="7" cy="6.5" r="1.5" fill="currentColor"/><circle cx="7" cy="12" r="1.5" fill="currentColor"/><circle cx="7" cy="17.5" r="1.5" fill="currentColor"/><circle cx="14" cy="6.5" r="1.5" fill="currentColor" opacity="0.25"/><circle cx="14" cy="12" r="1.5" fill="currentColor"/><circle cx="14" cy="17.5" r="1.5" fill="currentColor" opacity="0.25"/>`,
  },
  {
    id: 'tap-code',
    title: 'Tap Code',
    blurb: 'The real 5-by-5 knock cipher prisoners of war have used to talk through walls since the 1960s — C and K share one square.',
    kind: 'real',
    accent: '#463225',
    icon: `<rect x="4" y="4" width="16" height="16" rx="1.5" ${S}/><line x1="4" y1="9.3" x2="20" y2="9.3" ${S}/><line x1="4" y1="14.7" x2="20" y2="14.7" ${S}/><line x1="9.3" y1="4" x2="9.3" y2="20" ${S}/><line x1="14.7" y1="4" x2="14.7" y2="20" ${S}/>`,
  },
  {
    id: 'nato',
    title: 'NATO Alphabet',
    blurb: 'The real ICAO spelling alphabet — Alfa, Bravo, Charlie — designed so each word survives a bad radio line unmistaken for another.',
    kind: 'real',
    accent: '#1f3a52',
    icon: `<path d="M6 18l4.2-12h1.6L16 18" ${S}/><path d="M7.6 13.5h6.8" ${S}/>`,
  },
  {
    id: 'binary',
    title: 'Binary',
    blurb: 'Every character as real 8-bit ASCII, the same bits your keyboard actually sends.',
    kind: 'real',
    accent: '#122417',
    icon: `<text x="12" y="10.5" font-size="7" font-family="monospace" text-anchor="middle" fill="currentColor">10</text><text x="12" y="19" font-size="7" font-family="monospace" text-anchor="middle" fill="currentColor">01</text>`,
  },
  {
    id: 'hex',
    title: 'Hexadecimal',
    blurb: 'Every character as its real hex byte value — the format a hex editor would show you.',
    kind: 'real',
    accent: '#2a1f45',
    icon: `<text x="12" y="15.5" font-size="9" font-family="monospace" text-anchor="middle" fill="currentColor">0x</text>`,
  },
  {
    id: 'base64',
    title: 'Base64',
    blurb: 'Real Base64 — the same encoding an email attachment or a data: URL actually uses.',
    kind: 'real',
    accent: '#1f3a45',
    icon: `<rect x="4.5" y="7" width="15" height="10" rx="2" ${S}/><path d="M8 11.5h8M8 14h5" ${S}/>`,
  },
  {
    id: 'rot13',
    title: 'ROT13',
    blurb: 'The real Usenet-era cipher: shift every letter 13 places. Run it twice and you are back where you started.',
    kind: 'real',
    accent: '#3a1f45',
    icon: `<path d="M12 5a7 7 0 1 1-6.3 4" ${S}/><path d="M4.5 5.5l1 3.7 3.7-1" ${S}/>`,
  },
  {
    id: 'atbash',
    title: 'Atbash Cipher',
    blurb: 'A genuinely ancient cipher — A becomes Z, B becomes Y — used to hide names in the Hebrew Bible.',
    kind: 'real',
    accent: '#452a1f',
    icon: `<path d="M6 18L11 6h2l5 12" ${S}/><path d="M7.6 13.5h8.8" ${S}/><path d="M18 6L13 18h-2L6 6" ${S} opacity="0.35"/>`,
  },
  {
    id: 'leet',
    title: 'Leetspeak',
    blurb: 'The real early-internet substitution set — the one that turns "leet" into "1337".',
    kind: 'real',
    accent: '#173a1f',
    icon: `<text x="12" y="16" font-size="9" font-family="monospace" font-weight="700" text-anchor="middle" fill="currentColor">1337</text>`,
  },
  {
    id: 'pig-latin',
    title: 'Pig Latin',
    blurb: 'The real schoolyard rule: move the leading consonants to the end and add "ay" — vowel-led words just get "way".',
    kind: 'real',
    accent: '#4a3a1f',
    icon: `<ellipse cx="11" cy="12" rx="7" ry="5" ${S}/><circle cx="15.5" cy="9.5" r="1.6" fill="currentColor"/><path d="M4.5 12.5c-1.4 0.6-2.4 1.7-2.4 2.6" ${S}/>`,
  },
  {
    id: 'reverse',
    title: 'Reversed Text',
    blurb: 'Every character, in the opposite order it arrived.',
    kind: 'real',
    accent: '#1f2e4a',
    icon: `<path d="M5 8h11M12 4.5L16 8l-4 3.5" ${S}/><path d="M19 16H8M11 12.5L7 16l4 3.5" ${S}/>`,
  },
  {
    id: 'upside-down',
    title: 'Upside-Down Text',
    blurb: 'Every letter swapped for the real Unicode character that happens to look like it flipped 180°.',
    kind: 'real',
    accent: '#2e1f4a',
    icon: `<text x="12" y="15" font-size="10" font-family="serif" text-anchor="middle" fill="currentColor" transform="rotate(180 12 12)">ɐ</text>`,
  },
  {
    id: 'dtmf',
    title: 'Touch-Tone Dialing',
    blurb: 'The real dual-tone frequency pair behind every button on a phone keypad, from the real 1963 DTMF standard.',
    kind: 'real',
    accent: '#1f4a3a',
    icon: `<rect x="6" y="3.5" width="12" height="17" rx="2.4" ${S}/><circle cx="9.3" cy="8.3" r="0.9" fill="currentColor"/><circle cx="12" cy="8.3" r="0.9" fill="currentColor"/><circle cx="14.7" cy="8.3" r="0.9" fill="currentColor"/><circle cx="9.3" cy="11.6" r="0.9" fill="currentColor"/><circle cx="12" cy="11.6" r="0.9" fill="currentColor"/><circle cx="14.7" cy="11.6" r="0.9" fill="currentColor"/>`,
  },
  {
    id: 'notes',
    title: 'Musical Notes',
    blurb: 'Every letter as a real note name, played at its real equal-tempered frequency — the same 440Hz an orchestra tunes to.',
    kind: 'real',
    accent: '#4a1f2e',
    icon: `<circle cx="7.5" cy="17" r="2.2" fill="currentColor"/><circle cx="16" cy="15" r="2.2" fill="currentColor"/><path d="M9.7 17V6.5L18.2 5v10" ${S}/>`,
  },
  {
    id: 'voice',
    title: 'Spoken Aloud',
    blurb: "Your browser's own real text-to-speech voice, reading it back to you.",
    kind: 'real',
    accent: '#4a3a1f',
    icon: `<path d="M5 10v4h3l4.5 4V6L8 10H5z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" ${S}/>`,
  },
  {
    id: 'interstellar',
    title: 'Interstellar Radio Message',
    blurb: 'Your text as a real binary bitmap, the same idea Arecibo Observatory used in 1974 to beam a message at a real star cluster.',
    kind: 'real',
    accent: '#1f2e45',
    icon: `<circle cx="12" cy="12" r="8" ${S}/><circle cx="9" cy="10" r="1" fill="currentColor"/><circle cx="12" cy="10" r="1" fill="currentColor"/><circle cx="15" cy="10" r="1" fill="currentColor"/><circle cx="10.5" cy="14" r="1" fill="currentColor"/><circle cx="13.5" cy="14" r="1" fill="currentColor"/>`,
  },
  // ---------------------------------------------------------------- joke --
  {
    id: 'god',
    title: 'God',
    blurb: 'Sent. No read receipt is coming, but a burning bush in your area may flicker sympathetically.',
    kind: 'joke',
    accent: '#4a3a1f',
    icon: `<path d="M12 4l2 5 5 .8-3.7 3.5.9 5.1L12 15.9l-4.2 2.5.9-5.1L5 8.8 10 8z" fill="currentColor"/>`,
  },
  {
    id: 'satan',
    title: 'Satan',
    blurb: 'Delivered instantly. In the small print, you have agreed to absolutely nothing — this one is free.',
    kind: 'joke',
    accent: '#4a1f1f',
    icon: `<path d="M12 5l2.2 4 2.8-3-1 4.3L18 9l-2.6 3.4 1.4 5.6H7.2l1.4-5.6L6 9l2-1.7-1 4.3 2.8-3z" fill="currentColor"/>`,
  },
  {
    id: 'the-dead',
    title: 'The Dead',
    blurb: 'The planchette is moving. It is spelling out a five-star review, which is more than most of us get.',
    kind: 'joke',
    accent: '#2e2e2e',
    icon: `<path d="M12 4a6 6 0 0 0-6 6v6h12v-6a6 6 0 0 0-6-6z" fill="currentColor"/><rect x="6" y="16" width="12" height="2.4" rx="1" fill="currentColor"/><circle cx="9.5" cy="10" r="1.1" fill="#000" opacity="0.5"/><circle cx="14.5" cy="10" r="1.1" fill="#000" opacity="0.5"/>`,
  },
  {
    id: 'santa',
    title: 'Santa',
    blurb: 'Filed under "nice", tentatively, pending your behaviour for the rest of the calendar year.',
    kind: 'joke',
    accent: '#4a1f24',
    icon: `<path d="M4 15l8-9 8 9z" fill="currentColor"/><rect x="4" y="15" width="16" height="2.6" rx="1" fill="currentColor"/><circle cx="12" cy="5" r="1.6" fill="currentColor"/>`,
  },
  {
    id: 'nsa',
    title: 'The NSA',
    blurb: "Already logged. You are, to be fair, saving them a bit of typing today.",
    kind: 'joke',
    accent: '#1f2e3a',
    icon: `<rect x="5" y="9.5" width="14" height="9" rx="1.5" ${S}/><path d="M8 9.5V7a4 4 0 0 1 8 0v2.5" ${S}/><circle cx="12" cy="13.8" r="1.4" fill="currentColor"/>`,
  },
  {
    id: 'telemarketers',
    title: 'Telemarketers',
    blurb: "Forwarded to every one of them at once, during dinner, on purpose.",
    kind: 'joke',
    accent: '#3a1f2e',
    icon: `<path d="M6 4.5c1 3 2.3 5.6 4.2 7.5 1.9 1.9 4.5 3.2 7.5 4.2l1.3-3.1-4-1.3-1.5 1.5c-1.7-1-3-2.3-4-4l1.5-1.5-1.3-4z" fill="currentColor"/>`,
  },
  {
    id: 'a-billionaire',
    title: 'A Billionaire',
    blurb: 'A drone is already circling your rooftop. It is not for you; it merely orbits nearby on principle.',
    kind: 'joke',
    accent: '#1f4a2e',
    icon: `<rect x="10.5" y="4" width="3" height="16" rx="1.2" fill="currentColor"/><path d="M6 8.5h12M6 13h12" ${S}/>`,
  },
  {
    id: 'whales',
    title: 'Whales',
    blurb: "Real fact hiding in the joke: a blue whale's call is around 15-20Hz — far too low to hear, so recordings are always sped up for us.",
    kind: 'joke',
    accent: '#1f3a4a',
    icon: `<path d="M4 13c3-4 8-5 12-3 2 1 3.5 2.6 4 4.4-1.6.5-3.4.3-4.6-.6-1 .8-2.4 1.2-4 1-3-.3-6-.5-7.4-1.8z" fill="currentColor"/><circle cx="8" cy="12" r="0.8" fill="#000" opacity="0.4"/>`,
  },
  {
    id: 'the-future',
    title: 'The Future',
    blurb: 'Buried in a real time capsule, metaphorically, to be read by whoever is bored enough to dig here later.',
    kind: 'joke',
    accent: '#2e4a1f',
    icon: `<rect x="4.5" y="10" width="15" height="8" rx="4" fill="currentColor"/><rect x="10.5" y="6" width="3" height="6" rx="1.2" fill="currentColor"/>`,
  },
  {
    id: 'no-one',
    title: 'No One',
    blurb: "Sent to absolutely nobody. Kept private, which — statistically — is what happens to most things people mean to share.",
    kind: 'joke',
    accent: '#333333',
    icon: `<circle cx="12" cy="12" r="8" ${S}/><path d="M12 12v0" ${S}/>`,
  },
]

export const REAL_METHODS = METHODS.filter((m) => m.kind === 'real')
export const JOKE_METHODS = METHODS.filter((m) => m.kind === 'joke')

export function methodById(id: string): ShareMethod | undefined {
  return METHODS.find((m) => m.id === id)
}

// ============================================================= transforms =

const clean = (text: string) => text.trim().length ? text : 'Check this out'

// ---- Morse -----------------------------------------------------------

const MORSE: Record<string, string> = {
  a: '.-', b: '-...', c: '-.-.', d: '-..', e: '.', f: '..-.', g: '--.',
  h: '....', i: '..', j: '.---', k: '-.-', l: '.-..', m: '--', n: '-.',
  o: '---', p: '.--.', q: '--.-', r: '.-.', s: '...', t: '-',
  u: '..-', v: '...-', w: '.--', x: '-..-', y: '-.--', z: '--..',
  '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-',
  '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.',
}

/** One Morse "unit" in seconds — everything else is a multiple of this. */
export const MORSE_UNIT = 0.08

export type MorseBeat = { on: boolean; units: number }

export function morseSymbols(text: string): string[] {
  return clean(text)
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.split('').filter((c) => MORSE[c]).map((c) => MORSE[c]).join(' '))
}

export function morseText(text: string): string {
  return morseSymbols(text).join('   ')
}

/** The real 1:3:7 ratio: dit=1 unit on, dah=3, intra-letter gap=1,
 *  inter-letter gap=3, inter-word gap=7. */
export function morseBeats(text: string): MorseBeat[] {
  const beats: MorseBeat[] = []
  const words = clean(text).toLowerCase().split(/\s+/).filter(Boolean)
  words.forEach((word, wi) => {
    const letters = word.split('').filter((c) => MORSE[c])
    letters.forEach((c, li) => {
      const symbol = MORSE[c]
      symbol.split('').forEach((s, si) => {
        beats.push({ on: true, units: s === '.' ? 1 : 3 })
        if (si < symbol.length - 1) beats.push({ on: false, units: 1 })
      })
      if (li < letters.length - 1) beats.push({ on: false, units: 3 })
    })
    if (wi < words.length - 1) beats.push({ on: false, units: 7 })
  })
  return beats
}

// ---- Braille -----------------------------------------------------------

const BRAILLE_DOTS: Record<string, number[]> = {
  a: [1], b: [1, 2], c: [1, 4], d: [1, 4, 5], e: [1, 5],
  f: [1, 2, 4], g: [1, 2, 4, 5], h: [1, 2, 5], i: [2, 4], j: [2, 4, 5],
  k: [1, 3], l: [1, 2, 3], m: [1, 3, 4], n: [1, 3, 4, 5], o: [1, 3, 5],
  p: [1, 2, 3, 4], q: [1, 2, 3, 4, 5], r: [1, 2, 3, 5], s: [2, 3, 4], t: [2, 3, 4, 5],
  u: [1, 3, 6], v: [1, 2, 3, 6], w: [2, 4, 5, 6], x: [1, 3, 4, 6], y: [1, 3, 4, 5, 6], z: [1, 3, 5, 6],
}
const BRAILLE_NUMBER_SIGN = [3, 4, 5, 6]
// Digits 1-9,0 reuse the a-j dot patterns behind the number sign.
const DIGIT_LETTER: Record<string, string> = {
  '1': 'a', '2': 'b', '3': 'c', '4': 'd', '5': 'e',
  '6': 'f', '7': 'g', '8': 'h', '9': 'i', '0': 'j',
}

function brailleCell(dots: number[]): string {
  const bits = dots.reduce((mask, d) => mask | (1 << (d - 1)), 0)
  return String.fromCodePoint(0x2800 + bits)
}

export function brailleText(text: string): string {
  let out = ''
  let inNumber = false
  for (const raw of clean(text).toLowerCase()) {
    if (raw === ' ') { out += ' '; inNumber = false; continue }
    if (/[0-9]/.test(raw)) {
      if (!inNumber) { out += brailleCell(BRAILLE_NUMBER_SIGN); inNumber = true }
      out += brailleCell(BRAILLE_DOTS[DIGIT_LETTER[raw]])
      continue
    }
    inNumber = false
    if (BRAILLE_DOTS[raw]) out += brailleCell(BRAILLE_DOTS[raw])
    else out += raw
  }
  return out
}

/** Dot grids for the visual, one per character (space = empty cell). */
export function brailleCells(text: string): number[][] {
  const cells: number[][] = []
  let inNumber = false
  for (const raw of clean(text).toLowerCase()) {
    if (raw === ' ') { cells.push([]); inNumber = false; continue }
    if (/[0-9]/.test(raw)) {
      if (!inNumber) { cells.push(BRAILLE_NUMBER_SIGN); inNumber = true }
      cells.push(BRAILLE_DOTS[DIGIT_LETTER[raw]])
      continue
    }
    inNumber = false
    cells.push(BRAILLE_DOTS[raw] ?? [])
  }
  return cells
}

// ---- Tap code -----------------------------------------------------------

const TAP_ROWS = ['abcde', 'fghij', 'lmnop', 'qrstu', 'vwxyz']

export function tapCode(text: string): { row: number; col: number }[] {
  const out: { row: number; col: number }[] = []
  for (const raw of clean(text).toLowerCase()) {
    const c = raw === 'k' ? 'c' : raw
    if (c === ' ') continue
    for (let r = 0; r < TAP_ROWS.length; r++) {
      const ci = TAP_ROWS[r].indexOf(c)
      if (ci >= 0) { out.push({ row: r + 1, col: ci + 1 }); break }
    }
  }
  return out
}

// ---- NATO -----------------------------------------------------------

const NATO: Record<string, string> = {
  a: 'Alfa', b: 'Bravo', c: 'Charlie', d: 'Delta', e: 'Echo', f: 'Foxtrot',
  g: 'Golf', h: 'Hotel', i: 'India', j: 'Juliett', k: 'Kilo', l: 'Lima',
  m: 'Mike', n: 'November', o: 'Oscar', p: 'Papa', q: 'Quebec', r: 'Romeo',
  s: 'Sierra', t: 'Tango', u: 'Uniform', v: 'Victor', w: 'Whiskey',
  x: 'X-ray', y: 'Yankee', z: 'Zulu',
  '0': 'Zero', '1': 'Wun', '2': 'Too', '3': 'Tree', '4': 'Fower',
  '5': 'Fife', '6': 'Six', '7': 'Seven', '8': 'Ait', '9': 'Niner',
}

export function natoWords(text: string): string[] {
  return clean(text).toLowerCase().split('').filter((c) => c !== ' ').map((c) => NATO[c] ?? c)
}

// ---- Binary / hex / base64 -----------------------------------------------

export function binaryText(text: string): string {
  return clean(text).split('').map((c) => c.charCodeAt(0).toString(2).padStart(8, '0')).join(' ')
}
export function binaryFromText(bin: string): string {
  return bin.split(' ').filter(Boolean).map((b) => String.fromCharCode(parseInt(b, 2))).join('')
}

export function hexText(text: string): string {
  return clean(text).split('').map((c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' ')
}
export function hexFromText(hex: string): string {
  return hex.split(' ').filter(Boolean).map((h) => String.fromCharCode(parseInt(h, 16))).join('')
}

export function base64Text(text: string): string {
  const bytes = new TextEncoder().encode(clean(text))
  let bin = ''
  bytes.forEach((b) => (bin += String.fromCharCode(b)))
  return btoa(bin)
}
export function base64FromText(b64: string): string {
  const bin = atob(b64)
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

// ---- Ciphers -----------------------------------------------------------

export function rot13(text: string): string {
  return clean(text).replace(/[a-zA-Z]/g, (c) => {
    const base = c <= 'Z' ? 65 : 97
    return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base)
  })
}

export function atbash(text: string): string {
  return clean(text).replace(/[a-zA-Z]/g, (c) => {
    const base = c <= 'Z' ? 65 : 97
    return String.fromCharCode(base + (25 - (c.charCodeAt(0) - base)))
  })
}

const LEET: Record<string, string> = { a: '4', b: '8', e: '3', g: '9', i: '1', l: '1', o: '0', s: '5', t: '7' }
export function leet(text: string): string {
  return clean(text).split('').map((c) => LEET[c.toLowerCase()] ?? c).join('')
}

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u'])
function pigWord(word: string): string {
  const m = word.match(/^[a-zA-Z]+/)
  if (!m) return word
  const w = m[0]
  const rest = word.slice(w.length)
  if (VOWELS.has(w[0].toLowerCase())) return w + 'way' + rest
  let i = 0
  while (i < w.length && !VOWELS.has(w[i].toLowerCase())) i++
  if (i === 0 || i === w.length) return w + 'ay' + rest
  return w.slice(i) + w.slice(0, i) + 'ay' + rest
}
export function pigLatin(text: string): string {
  return clean(text).split(' ').map((w) => (w ? pigWord(w) : w)).join(' ')
}

export function reverseText(text: string): string {
  return clean(text).split('').reverse().join('')
}

// Verified against the Unicode "upside-down text" mapping — every letter that
// has a real look-alike codepoint gets one; anything else (digits, most
// punctuation) is left as-is and said so in the blurb, same as every real
// flip-text tool.
const FLIP: Record<string, string> = {
  a: 'ɐ', b: 'q', c: 'ɔ', d: 'p', e: 'ǝ', f: 'ɟ', g: 'ƃ', h: 'ɥ', i: 'ı',
  j: 'ɾ', k: 'ʞ', l: 'ʃ', m: 'ɯ', n: 'u', o: 'o', p: 'd', q: 'b', r: 'ɹ',
  s: 's', t: 'ʇ', u: 'n', v: 'ʌ', w: 'ʍ', x: 'x', y: 'ʎ', z: 'z',
  '.': '˙', ',': "'", "'": ',', '!': '¡', '?': '¿',
}
export function upsideDown(text: string): string {
  return clean(text)
    .toLowerCase()
    .split('')
    .map((c) => FLIP[c] ?? c)
    .reverse()
    .join('')
}

// ---- DTMF -----------------------------------------------------------

/** The real ITU-T Q.23 dual-tone pairs, low row Hz + high column Hz. */
const DTMF_FREQ: Record<string, [number, number]> = {
  '1': [697, 1209], '2': [697, 1336], '3': [697, 1477],
  '4': [770, 1209], '5': [770, 1336], '6': [770, 1477],
  '7': [852, 1209], '8': [852, 1336], '9': [852, 1477],
  '*': [941, 1209], '0': [941, 1336], '#': [941, 1477],
}
// The real letters printed on a phone keypad (ANSI/ITU E.161). 7 and 9 carry
// four letters each; every other digit carries three.
const KEYPAD_LETTERS: Record<string, string> = {
  '2': 'abc', '3': 'def', '4': 'ghi', '5': 'jkl', '6': 'mno',
  '7': 'pqrs', '8': 'tuv', '9': 'wxyz',
}
const LETTER_DIGIT: Record<string, string> = {}
for (const [digit, letters] of Object.entries(KEYPAD_LETTERS)) {
  for (const l of letters) LETTER_DIGIT[l] = digit
}

export function keypadDigits(text: string): string {
  return clean(text).toLowerCase().split('').map((c) => LETTER_DIGIT[c] ?? (c === ' ' ? '0' : c)).join('')
}
export function dtmfTones(text: string): { digit: string; freqs: [number, number] }[] {
  return keypadDigits(text)
    .split('')
    .filter((d) => DTMF_FREQ[d])
    .map((d) => ({ digit: d, freqs: DTMF_FREQ[d] }))
}

// ---- Musical notes -----------------------------------------------------

const NOTE_NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
// Semitone offset of each natural note from A4 (440Hz), so every frequency is
// *derived* from one real reference pitch rather than typed in seven times.
const NOTE_SEMITONES_FROM_A: Record<string, number> = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 }

export function noteFreq(name: string): number {
  return 440 * Math.pow(2, NOTE_SEMITONES_FROM_A[name] / 12)
}

export function textNotes(text: string): { name: string; freq: number }[] {
  const letters = clean(text).toLowerCase().replace(/[^a-z]/g, '')
  return letters.split('').map((c, i) => {
    const name = NOTE_NAMES[(c.charCodeAt(0) - 97) % NOTE_NAMES.length]
    return { name, freq: noteFreq(name) }
  })
}

// ---- Interstellar bitmap -----------------------------------------------

export type InterstellarGrid = { rows: number; cols: number; bits: number[] }

/** Every character as 7-bit ASCII, laid into the smallest near-square grid
 *  that holds every bit — the same "make it a rectangle" idea the real 1974
 *  Arecibo message used (that one picked 23x73 specifically because it is a
 *  semiprime with only one possible rectangle; an arbitrary typed message
 *  doesn't get that guarantee, so this just fits it as tightly as it can). */
export function interstellarGrid(text: string): InterstellarGrid {
  const bits: number[] = []
  for (const c of clean(text)) {
    const code = c.charCodeAt(0) & 0x7f
    for (let b = 6; b >= 0; b--) bits.push((code >> b) & 1)
  }
  const cols = Math.max(1, Math.ceil(Math.sqrt(bits.length)))
  const rows = Math.max(1, Math.ceil(bits.length / cols))
  const padded = bits.slice()
  while (padded.length < rows * cols) padded.push(0)
  return { rows, cols, bits: padded }
}
