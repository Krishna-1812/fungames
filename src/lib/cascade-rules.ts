/**
 * Rule Cascade's thirty rules.
 *
 * They live here rather than in the page for one reason: with this many
 * interlocking constraints — a fixed digit sum, a prime length, a prime vowel
 * count, a Roman-numeral product, a live clock, and a letter taken away from you
 * mid-game — nobody can verify by hand that the form can still be filled in.
 * scripts/check-cascade.mjs builds a solution for all 24 hours and all 26
 * possible sacrifices and checks every rule against it, which is only possible
 * because `ok` is a pure function of the text and the context.
 *
 * One design rule holds the whole thing together: **no rule may depend on a
 * single irreplaceable word.** The sacrifice can take any letter of the
 * alphabet, so a rule that only "no" satisfies becomes unsatisfiable the moment
 * n or o is taken. Every word rule below offers a wide set of answers, and the
 * checker proves that is enough.
 */

export type Ctx = {
  /** 0–23. Injected rather than read from the clock so it can be tested. */
  hour: number
  /** How many rules are on screen. Rule 23 is about this number. */
  unlocked: number
  /** The letter the sacrifice took, or null before it fires. */
  banned: string | null
}

export type Rule = {
  id: number
  text: (c: Ctx) => string
  ok: (s: string, c: Ctx) => boolean
  /** Rules the page has to do something about beyond validating them. */
  live?: 'moth' | 'sacrifice'
}

/* -------------------------------------------------------------------------- */
/* Word lists                                                                 */
/* -------------------------------------------------------------------------- */

export const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
]

/** Two-letter symbols only, so "a chemical element" is an unambiguous test. */
export const ELEMENTS = [
  'He', 'Li', 'Be', 'Ne', 'Na', 'Mg', 'Al', 'Si', 'Cl', 'Ar', 'Ca', 'Fe', 'Cu',
  'Zn', 'Ga', 'Ge', 'As', 'Se', 'Br', 'Kr', 'Ag', 'Sn', 'Au', 'Hg', 'Pb', 'Ti',
  'Cr', 'Mn', 'Co', 'Ni', 'Xe', 'Rn', 'Pt', 'Sr', 'Ba', 'Zr', 'Nb', 'Ru',
]

export const NOBLE_GASES = ['He', 'Ne', 'Ar', 'Kr', 'Xe', 'Rn']

export const GREEK = [
  'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta', 'iota',
  'kappa', 'lambda', 'sigma', 'omega', 'phi', 'chi', 'psi', 'rho', 'tau', 'mu',
  'nu', 'xi', 'pi', 'omicron', 'upsilon',
]

export const SINS = ['pride', 'greed', 'wrath', 'envy', 'lust', 'gluttony', 'sloth']

export const COLOURS = [
  'red', 'blue', 'green', 'gold', 'black', 'white', 'grey', 'pink', 'amber',
  'teal', 'cyan', 'ochre', 'rust', 'jade', 'plum', 'ivory',
]

export const PLANETS = [
  'mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune',
]

export const SHAPES = [
  'circle', 'square', 'triangle', 'hexagon', 'oval', 'cube', 'cone', 'prism',
  'rhombus', 'star', 'wedge', 'helix',
]

export const NUMBER_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight',
  'nine', 'ten', 'eleven', 'twelve', 'twenty', 'forty', 'fifty', 'hundred',
]

export const APOLOGIES = ['sorry', 'apologies', 'my bad', 'forgive me', 'regret']

/** A spread wide enough that losing any one letter leaves plenty. */
export const COUNTRY_CODES = [
  'BR', 'SE', 'AT', 'NO', 'FR', 'DE', 'JP', 'KE', 'PE', 'TH', 'ZA', 'NZ', 'GB',
  'PT', 'FI', 'HU', 'EG', 'AR', 'BE', 'PH', 'TR', 'UY', 'QA', 'GH', 'NG', 'VN',
]

const NUMERAL: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 }

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/** Code-point aware, so one emoji counts as one character. */
export const chars = (s: string) => Array.from(s)

export const digitSum = (s: string) =>
  (s.match(/\d/g) || []).reduce((a, d) => a + +d, 0)

export const isPrime = (n: number) => {
  if (n < 2) return false
  for (let i = 2; i * i <= n; i++) if (n % i === 0) return false
  return true
}

export const numeralProduct = (s: string) => {
  const found = s.match(/[IVXLCDM]/g) || []
  return found.length ? found.reduce((a, c) => a * NUMERAL[c], 1) : 0
}

/**
 * Any palindrome of three characters or more.
 *
 * Expanding around each centre rather than testing every substring: the old
 * version started from the longest possible window and worked down, which is
 * cubic and runs on every keystroke. Almost every string that contains a
 * palindrome contains a three-character one, so the cheapest answer is also the
 * one found first.
 */
export const hasPalindrome = (s: string) => {
  const a = chars(s.toLowerCase())
  for (let i = 0; i + 2 < a.length; i++) {
    // Testing only lengths 3 and 4 is not an approximation. Every palindrome of
    // length 5 or more contains a shorter one of the same parity at its centre,
    // so anything longer is caught here too.
    if (a[i] === a[i + 2]) return true
    if (i + 3 < a.length && a[i] === a[i + 3] && a[i + 1] === a[i + 2]) return true
  }
  return false
}

export const vowelCount = (s: string) => (s.toLowerCase().match(/[aeiou]/g) || []).length

export const hour24 = (h: number) => String(h).padStart(2, '0')

const has = (s: string, list: string[]) => {
  const low = s.toLowerCase()
  return list.some((w) => low.includes(w.toLowerCase()))
}

/** A real leap year, four digits, anywhere in the string. */
export const hasLeapYear = (s: string) => {
  for (const m of s.matchAll(/\d{4}/g)) {
    const y = +m[0]
    if (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) return true
  }
  return false
}

/** A chess square: file a–h, rank 1–8. */
export const hasChessSquare = (s: string) => /[a-h][1-8]/.test(s.toLowerCase())

/**
 * Two of the same letter side by side, ignoring case.
 *
 * Letters, deliberately, not characters. At midnight the clock rule wants "00"
 * in your username and a no-repeats rule that counted digits would make the
 * form unsolvable for three hours of every day — 00, 11 and 22.
 */
export const hasDoubledRun = (s: string) => {
  const a = chars(s.toLowerCase())
  for (let i = 1; i < a.length; i++)
    if (a[i] === a[i - 1] && /[a-z]/.test(a[i])) return true
  return false
}

/* -------------------------------------------------------------------------- */
/* The rules                                                                  */
/* -------------------------------------------------------------------------- */

export const RULES: Rule[] = [
  { id: 1, text: () => 'Your username must be at least 5 characters.', ok: (s) => chars(s).length >= 5 },
  { id: 2, text: () => 'It must include a number.', ok: (s) => /\d/.test(s) },
  { id: 3, text: () => 'It must include an uppercase letter.', ok: (s) => /[A-Z]/.test(s) },
  { id: 4, text: () => 'It must include a month of the year.', ok: (s) => has(s, MONTHS) },
  { id: 5, text: () => 'It must include an emoji.', ok: (s) => /\p{Extended_Pictographic}/u.test(s) },
  { id: 6, text: () => 'It must include a Roman numeral.', ok: (s) => /[IVXLCDM]/.test(s) },
  {
    id: 7,
    text: () => 'The Roman numerals must multiply to exactly 50.',
    ok: (s) => numeralProduct(s) === 50,
  },
  { id: 8, text: () => 'The digits in your username must add up to 25.', ok: (s) => digitSum(s) === 25 },
  { id: 9, text: () => 'It must include a chemical element symbol, spelled correctly.', ok: (s) => ELEMENTS.some((e) => s.includes(e)) },
  { id: 10, text: () => 'Its length must be a prime number.', ok: (s) => isPrime(chars(s).length) },
  { id: 11, text: () => 'It must contain a palindrome at least 3 characters long.', ok: (s) => hasPalindrome(s) },
  {
    id: 12,
    text: (c) => `It must include the current hour on a 24-hour clock. It is ${hour24(c.hour)}.`,
    ok: (s, c) => s.includes(hour24(c.hour)),
  },
  { id: 13, text: () => 'It must include a Greek letter, spelled out.', ok: (s) => has(s, GREEK) },
  { id: 14, text: () => 'It must include one of the seven deadly sins.', ok: (s) => has(s, SINS) },
  { id: 15, text: () => 'It must include a colour.', ok: (s) => has(s, COLOURS) },
  { id: 16, text: () => 'It must include a chess square, like d4.', ok: (s) => hasChessSquare(s) },
  { id: 17, text: () => 'It must include a leap year.', ok: (s) => hasLeapYear(s) },
  { id: 18, text: () => 'No letter may appear twice in a row.', ok: (s) => !hasDoubledRun(s) },
  { id: 19, text: () => 'It must include a country’s two-letter code, in capitals.', ok: (s) => COUNTRY_CODES.some((c) => s.includes(c)) },
  { id: 20, text: () => 'The number of vowels must be a prime number.', ok: (s) => isPrime(vowelCount(s)) },
  { id: 21, text: () => 'It must include the symbol of a noble gas.', ok: (s) => NOBLE_GASES.some((g) => s.includes(g)) },
  { id: 22, text: () => 'It must include a number spelled out in words.', ok: (s) => has(s, NUMBER_WORDS) },
  {
    id: 23,
    text: (c) => `It must include the number of rules currently on screen. There are ${c.unlocked}.`,
    ok: (s, c) => s.includes(String(c.unlocked)),
  },
  {
    id: 24,
    live: 'moth',
    text: () =>
      'A moth has got into your username and is eating a character every six seconds. Deal with it. 🕷',
    ok: (s) => /🕷/u.test(s),
  },
  {
    id: 25,
    live: 'sacrifice',
    text: (c) =>
      c.banned
        ? `You were leaning on the letter “${c.banned}”. It has been taken away. It is not coming back.`
        : 'One of your letters is about to be taken away.',
    // Before the sacrifice fires there is nothing to check; after it, the letter
    // is gone in both cases, because a capital is the same letter.
    ok: (s, c) => !c.banned || !s.toLowerCase().includes(c.banned),
  },
  { id: 26, text: () => 'It must include a planet.', ok: (s) => has(s, PLANETS) },
  { id: 27, text: () => 'It must include the name of a shape.', ok: (s) => has(s, SHAPES) },
  { id: 28, text: () => 'The number of digits must be even.', ok: (s) => (s.match(/\d/g) || []).length % 2 === 0 },
  { id: 29, text: () => 'It must not contain the word “username”.', ok: (s) => !s.toLowerCase().includes('username') },
  { id: 30, text: () => 'It must contain an apology.', ok: (s) => has(s, APOLOGIES) },
]
