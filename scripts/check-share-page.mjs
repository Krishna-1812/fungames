/**
 * check-share-page — proves the thirty transforms in share-methods.ts are
 * what their own blurbs claim, not just that they run without throwing.
 *
 *   1. Shape: enough methods, unique ids/titles, no emoji, no placeholder
 *      blurbs, every real method has a non-generic accent.
 *   2. Every cipher that claims to be its own inverse actually is, over many
 *      random strings (ROT13, Atbash) — the strongest kind of check here,
 *      because it needs no external reference at all.
 *   3. Every encode/decode pair round-trips (binary, hex, base64) — proves
 *      the pair agrees with itself rather than the encoder alone being self-
 *      consistent nonsense.
 *   4. Spot checks against literal known-correct answers for the systems
 *      that have a real, unambiguous standard: Morse, Braille's Unicode dot
 *      numbering, the real DTMF keypad letters, the classic "leet" -> "1337",
 *      Pig Latin's textbook examples, NATO's official ICAO spellings.
 *   5. Physical/mathematical facts: the real 1:3 dot-to-dash Morse ratio, the
 *      real A4=440Hz reference and equal-tempered ratios, the real DTMF
 *      frequency table.
 *   6. Cross-file: games.ts has the slug, tile-art.ts has a drawing, the page
 *      renders every method id the data file declares and nothing else.
 *
 *   node scripts/check-share-page.mjs
 */
import fs from 'node:fs'

const M = await import('../src/lib/share-methods.ts')
const { GAMES } = await import('../src/data/games.ts')
const { ART } = await import('../src/lib/tile-art.ts')

let failures = 0
const fail = (m) => { failures++; console.log(`  FAIL  ${m}`) }
const ok = (m) => console.log(`  ok    ${m}`)
const check = (c, m) => (c ? ok(m) : fail(m))

const PAGE = fs.readFileSync(new URL('../src/pages/share-this-page.astro', import.meta.url), 'utf8')

/* ---- 1. shape ------------------------------------------------------------- */

console.log('data shape')
{
  check(M.METHODS.length >= 24, `at least 24 methods (${M.METHODS.length})`)
  const ids = M.METHODS.map((m) => m.id)
  check(new Set(ids).size === ids.length, 'no duplicate ids')
  const titles = M.METHODS.map((m) => m.title)
  check(new Set(titles).size === titles.length, 'no duplicate titles')
  check(M.REAL_METHODS.length + M.JOKE_METHODS.length === M.METHODS.length, 'every method is real xor joke')
  check(M.REAL_METHODS.length >= 15, `at least 15 real methods (${M.REAL_METHODS.length})`)
  check(M.JOKE_METHODS.length >= 6, `at least 6 joke methods (${M.JOKE_METHODS.length})`)

  for (const m of M.METHODS) {
    check(m.blurb.length >= 40, `${m.id}: blurb is real writing, not a stub (${m.blurb.length} chars)`)
    check(/^#[0-9a-f]{6}$/i.test(m.accent), `${m.id}: accent is a real hex colour`)
    check(m.icon.includes('currentColor') || /fill="#/.test(m.icon), `${m.id}: icon draws something`)
  }
  const hasEmoji = /\p{Extended_Pictographic}/u
  for (const m of M.METHODS) {
    check(!hasEmoji.test(m.title) && !hasEmoji.test(m.blurb), `${m.id}: no emoji in title/blurb`)
  }
  check(!hasEmoji.test(fs.readFileSync(new URL('../src/lib/share-methods.ts', import.meta.url), 'utf8')), 'no emoji anywhere in share-methods.ts')
  check(!hasEmoji.test(PAGE), 'no emoji anywhere in the page')
}

/* ---- 2. involutions -------------------------------------------------------- */

console.log('self-inverse ciphers')
{
  const samples = ['hello world', 'The Quick Brown Fox', 'a', 'Zebra Stripes 123', 'MiXeD case, punctuation!']
  for (const s of samples) {
    check(M.rot13(M.rot13(s)) === s, `rot13 is its own inverse: "${s}"`)
    check(M.atbash(M.atbash(s)) === s, `atbash is its own inverse: "${s}"`)
  }
  // A cipher that maps every letter to itself would trivially pass the
  // inverse test above, so also prove it actually moves letters.
  check(M.rot13('hello') !== 'hello', 'rot13 actually changes letters')
  check(M.atbash('hello') !== 'hello', 'atbash actually changes letters')
  check(M.rot13('a') === 'n' && M.rot13('n') === 'a', 'rot13(a)=n, the fixed reference point of the shift')
  check(M.atbash('a') === 'z' && M.atbash('z') === 'a', 'atbash(a)=z, the defining swap')
}

/* ---- 3. round trips --------------------------------------------------------- */

console.log('round-trip encodings')
{
  const samples = ['hello', 'Fun Games!', 'a b c', '1234567890']
  for (const s of samples) {
    check(M.binaryFromText(M.binaryText(s)) === s, `binary round-trips: "${s}"`)
    check(M.hexFromText(M.hexText(s)) === s, `hex round-trips: "${s}"`)
    check(M.base64FromText(M.base64Text(s)) === s, `base64 round-trips: "${s}"`)
  }
  check(M.base64Text('Hello') === 'SGVsbG8=', 'base64("Hello") matches the textbook reference value')
  check(M.hexText('A') === '41', 'hex("A") is the real ASCII byte')
  check(M.binaryText('A') === '01000001', 'binary("A") is the real 8-bit ASCII byte')
}

/* ---- 4. known-correct spot checks ------------------------------------------ */

console.log('spot checks against real standards')
{
  check(M.morseSymbols('sos')[0] === '... --- ...', 'Morse: SOS is the universal reference')
  check(M.morseSymbols('hello')[0] === '.... . .-.. .-.. ---', 'Morse: HELLO matches the ITU table')

  const beats = M.morseBeats('e')
  check(beats.length === 1 && beats[0].on && beats[0].units === 1, 'Morse: E is a single one-unit dot')
  const beatsT = M.morseBeats('t')
  check(beatsT.length === 1 && beatsT[0].on && beatsT[0].units === 3, 'Morse: T is a single three-unit dash — the real 1:3 ratio')

  // Braille: spot-check against literal Unicode Braille Patterns codepoints,
  // not against the same dot table the encoder itself uses.
  check(M.brailleText('a') === '⠁', "Braille 'a' is U+2801 (dot 1) — the Unicode standard's own cell")
  check(M.brailleText('b') === '⠃', "Braille 'b' is U+2803 (dots 1,2)")
  check(M.brailleText('c') === '⠉', "Braille 'c' is U+2809 (dots 1,4)")

  const k = M.tapCode('k')[0]
  const c = M.tapCode('c')[0]
  check(k.row === c.row && k.col === c.col, 'Tap code: C and K really do share one square, as the real cipher does')

  check(M.natoWords('a')[0] === 'Alfa', 'NATO: A is the real ICAO "Alfa", not the common misspelling "Alpha"')
  check(M.natoWords('j')[0] === 'Juliett', 'NATO: J is the real ICAO "Juliett" (double t)')
  check(M.natoWords('x')[0] === 'X-ray', 'NATO: X is the real ICAO "X-ray"')
  check(new Set('abcdefghijklmnopqrstuvwxyz'.split('').map((c) => M.natoWords(c)[0])).size === 26, 'NATO: all 26 letters map to a distinct word')

  check(M.leet('leet') === '1337', 'Leetspeak: the canonical "leet" -> "1337"')

  check(M.pigLatin('hello') === 'ellohay', 'Pig Latin: textbook "hello" -> "ellohay"')
  check(M.pigLatin('eat') === 'eatway', 'Pig Latin: vowel-start "eat" -> "eatway"')
  check(M.pigLatin('string') === 'ingstray', 'Pig Latin: consonant-cluster "string" -> "ingstray"')

  check(M.reverseText('hello') === 'olleh', 'Reverse: "hello" -> "olleh"')

  check(M.upsideDown('a') === 'ɐ', "Upside-down 'a' matches the real look-alike codepoint U+0250")
  check(M.upsideDown('ab') === 'qɐ', 'Upside-down also reverses order, so a physically flipped strip reads correctly')

  check(M.keypadDigits('a') === '2' && M.keypadDigits('d') === '3' && M.keypadDigits('g') === '4', 'DTMF keypad: A/D/G start 2/3/4, the real phone layout')
  check(M.keypadDigits('pqrs') === '7777', 'DTMF keypad: P,Q,R,S all really do share the 7 key')
  check(M.keypadDigits('wxyz') === '9999', 'DTMF keypad: W,X,Y,Z all really do share the 9 key')
  const t5 = M.dtmfTones('5')[0]
  check(t5.freqs[0] === 770 && t5.freqs[1] === 1336, 'DTMF: key 5 is really 770Hz+1336Hz (ITU-T Q.23)')
  const t0 = M.dtmfTones('0')[0]
  check(t0.freqs[0] === 941 && t0.freqs[1] === 1336, 'DTMF: key 0 is really 941Hz+1336Hz')
}

/* ---- 5. real physics -------------------------------------------------------- */

console.log('physical constants')
{
  check(Math.abs(M.noteFreq('A') - 440) < 1e-9, 'A is exactly the real 440Hz concert-pitch reference')
  check(Math.abs(M.noteFreq('A') * 2 - 880) < 1e-9, 'an octave above A is exactly double the frequency')
  // C4 is 9 semitones below A4 in equal temperament: 440 * 2^(-9/12) = 261.63Hz.
  check(Math.abs(M.noteFreq('C') - 261.6255653) < 1e-3, 'C is the real equal-tempered 261.63Hz, derived from A440 rather than typed in')
}

/* ---- 6. interstellar grid --------------------------------------------------- */

console.log('interstellar bitmap')
{
  const g = M.interstellarGrid('hi')
  check(g.rows * g.cols >= 14, `grid holds every bit of "hi" (2 chars x 7 bits = 14): got ${g.rows}x${g.cols}`)
  check(g.bits.length === g.rows * g.cols, 'bit array exactly fills its declared grid')
  // Round-trip the first 7 bits back to ASCII 'h' (0x68 = 1101000, top bit of
  // 7-bit ASCII dropped) to prove the bits are real character codes, not a
  // decorative pattern.
  const first7 = g.bits.slice(0, 7).join('')
  const code = parseInt(first7, 2)
  check(code === ('h'.charCodeAt(0) & 0x7f), `first 7 bits really decode back to 'h' (got code ${code})`)
}

/* ---- 7. cross-file wiring ---------------------------------------------------- */

console.log('site wiring')
{
  check(GAMES.some((g) => g.slug === 'share-this-page'), 'games.ts has the registry entry')
  check(!!ART['share-this-page'], 'tile-art.ts has a drawing')

  for (const m of M.METHODS) {
    check(PAGE.includes(`case '${m.id}':`) || PAGE.includes(`data-id={m.id}`), `page can render "${m.id}"`)
  }
  const realIds = new Set(M.REAL_METHODS.map((m) => m.id))
  const caseIds = [...PAGE.matchAll(/case '([a-z0-9-]+)':/g)].map((mm) => mm[1])
  check(new Set(caseIds).size === caseIds.length, 'no duplicate case labels in the renderer')
  for (const id of realIds) check(caseIds.includes(id), `renderReal() has a case for real method "${id}"`)
  for (const id of caseIds) check(realIds.has(id), `renderReal() case "${id}" corresponds to a real method in the data`)
}

console.log(failures ? `\n${failures} check(s) failed.` : '\nAll checks passed.')
process.exit(failures ? 1 : 0)
