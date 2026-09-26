/**
 * check-paper — holds the Paper & Ink design system to its own rules.
 *
 *   1. Tokens: every token the README promises exists on :root, and every
 *      text/ground pairing the system relies on clears WCAG AA — ink on each
 *      block colour, the text-safe shades on paper and card, ink3 at its floor.
 *   2. Colour discipline: the paper stylesheets use no literal colours outside
 *      tokens.css (a stray hex is exactly how a tint or a glow creeps in), and
 *      the only gradients are the marker, the progress bar, and game covers.
 *   3. Motion discipline: every hidden or offset starting state in motion.css
 *      is scoped under `html.play`; nothing transitions a layout property; the
 *      one per-index delay allowed is the footer wordmark's letters.
 *   4. Reduced motion switches everything off (the block exists and kills
 *      both animation and transition).
 *   5. Registry: every listed game has presentation meta with a real icon, and
 *      every game in SHELL_GAMES really is built on the shared GameShell.
 *
 *   node scripts/check-paper.mjs
 */
import fs from 'node:fs'

const { listedGames } = await import('../src/data/games.ts')
const { META, SHELL_GAMES, dailyFor } = await import('../src/data/game-meta.ts')
const { ICONS } = await import('../src/lib/icons.ts')

let failures = 0
const fail = (m) => { failures++; console.log(`  FAIL  ${m}`) }
const ok = (m) => console.log(`  ok    ${m}`)
const check = (c, m) => (c ? ok(m) : fail(m))
const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8')

const tokens = read('src/styles/paper/tokens.css')
const base = read('src/styles/paper/base.css')
const motion = read('src/styles/paper/motion.css')
const shell = read('src/styles/paper/game-shell.css')

/* ---- 1. tokens and contrast ------------------------------------------- */

console.log('tokens')
const tok = Object.fromEntries([...tokens.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]))
for (const t of ['paper', 'paper2', 'paper3', 'card', 'ink', 'ink2', 'ink3', 'ink-paper', 'cobalt', 'cobalt-hi', 'mint', 'sky', 'red', 'lilac', 'marker', 'r', 'r-lg', 'r-pill', 'shadow-block', 'shadow-pill', 'ease', 'spring', 'glide', 'ease-io'])
  check(t in tok, `--${t} is defined`)

const hex = (h) => { const v = h.replace('#', ''); return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16)) }
const lum = (h) => {
  const [r, g, b] = hex(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }

console.log('contrast (AA, 4.5:1 for text)')
for (const block of ['cobalt', 'mint', 'sky', 'red', 'lilac'])
  check(ratio(tok.ink, tok[block]) >= 4.5, `ink on --${block}: ${ratio(tok.ink, tok[block]).toFixed(2)}:1`)
check(ratio(tok['ink-paper'], tok.ink) >= 4.5, `ink-paper on ink: ${ratio(tok['ink-paper'], tok.ink).toFixed(2)}:1`)
for (const t of ['t-cobalt', 't-red', 't-blue', 't-teal', 't-green']) {
  check(ratio(tok[t], tok.paper) >= 4.5, `--${t} on paper: ${ratio(tok[t], tok.paper).toFixed(2)}:1`)
  check(ratio(tok[t], tok.card) >= 4.5, `--${t} on card: ${ratio(tok[t], tok.card).toFixed(2)}:1`)
}
check(ratio(tok.ink3, tok.paper) >= 4.5, `ink3 on paper (the floor): ${ratio(tok.ink3, tok.paper).toFixed(2)}:1`)
check(ratio(tok.ink2, tok.paper2) >= 4.5, `ink2 on paper2: ${ratio(tok.ink2, tok.paper2).toFixed(2)}:1`)
// Block colours must never be text on paper — and they would fail if they were.
for (const block of ['cobalt', 'mint', 'sky'])
  check(ratio(tok[block], tok.paper) < 4.5, `--${block} is correctly unusable as text on paper (${ratio(tok[block], tok.paper).toFixed(2)}:1), so the rule matters`)

/* ---- 2. colour discipline -------------------------------------------- */

console.log('colour discipline')
for (const [name, css] of [['base.css', base], ['motion.css', motion], ['game-shell.css', shell]]) {
  const body = css.replace(/\/\*[\s\S]*?\*\//g, '')
  // The view-transition backdrop is the one literal: custom properties are
  // not reliably resolved on that pseudo-element in every engine.
  const literals = [...body.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0]).filter((h) => h.toLowerCase() !== '#5b82ff')
  check(!literals.length, `${name}: no literal colours outside tokens${literals.length ? ' — found ' + literals.join(', ') : ''}`)
  const grads = [...body.matchAll(/[\w.#:\-\[\]='\s]*\{[^}]*gradient\([^}]*\}/g)].map((m) => m[0].trim().split('{')[0].trim())
  const allowed = grads.filter((sel) => !/progress-bar|marker/.test(sel))
  check(!allowed.length, `${name}: the only gradients are the marker and the progress bar${allowed.length ? ' — also: ' + allowed.join(' | ') : ''}`)
}

/* ---- 3. motion discipline -------------------------------------------- */

console.log('motion discipline')
{
  const body = motion.replace(/\/\*[\s\S]*?\*\//g, '')
  const rules = [...body.matchAll(/([^{}@]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1].trim(), decl: m[2] }))
  const hiding = rules.filter((r) =>
    /transform:\s*(translate|scale\(0|scaleX\(0)|clip-path:\s*inset\(0 100%|background-size:\s*0%/.test(r.decl) &&
    !/@keyframes|from|to|\d+%/.test(r.sel))
  const unscoped = hiding.filter((r) => !r.sel.split(',').every((s) => s.trim().startsWith('html.play')))
  check(hiding.length > 5, `found the armed starting states (${hiding.length})`)
  check(!unscoped.length, `every hidden/offset starting state is under html.play${unscoped.length ? ' — ' + unscoped.map((r) => r.sel).join(' | ') : ''}`)

  const layoutProps = /transition(?:-property)?:[^;]*\b(width|height|top|left|right|bottom|margin|padding)\b/
  for (const [name, css] of [['motion.css', motion], ['game-shell.css', shell], ['base.css', base]])
    check(!layoutProps.test(css.replace(/\/\*[\s\S]*?\*\//g, '')), `${name}: no transition on a layout property`)

  const staggers = rules.filter((r) => /delay:\s*calc\(var\(--i/.test(r.decl))
  check(staggers.every((r) => r.sel.includes('.wordmark')), 'the only per-index delay is the wordmark (type, not cards)')
  check(!/gcard[^{]*\{[^}]*delay/.test(body), 'directory cards carry no arrival delay')
}

/* ---- 4. reduced motion ----------------------------------------------- */

console.log('reduced motion')
{
  const block = motion.match(/@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/)
  check(!!block, 'motion.css has a reduced-motion block')
  check(!!block && /animation:\s*none\s*!important/.test(block[1]) && /transition:\s*none\s*!important/.test(block[1]),
    'it turns animation AND transition off, not down')
  const layout = read('src/layouts/Paper.astro')
  check(/prefers-reduced-motion: reduce/.test(layout) && /classList\.add\('play'\)/.test(layout),
    'the head script only adds `play` when reduced motion is not requested')
  check(/motion-ready/.test(layout), 'the head script withdraws `play` if motion.ts never arrives')
  const js = read('src/lib/motion.ts')
  const inits = [...js.matchAll(/function (init\w+)\(/g)].map((m) => m[1])
  // initMotion is the entry point; the reveal, odometer and wordmark inits
  // each branch on PLAY internally to write their finished state instead;
  // the masthead is a scroll indicator, not motion.
  for (const fn of inits.filter((f) => !['initMotion', 'initReveals', 'initMasthead', 'initOdometers', 'initWordmark'].includes(f))) {
    const bodyOf = js.slice(js.indexOf(`function ${fn}(`)).split('\nfunction ')[0]
    check(/if \(!PLAY/.test(bodyOf) || /!PLAY \|\|/.test(bodyOf), `${fn}() skips itself without PLAY`)
  }
}

/* ---- 5. registry ----------------------------------------------------- */

console.log('registry')
{
  const games = listedGames()
  for (const g of games) {
    const m = META[g.slug]
    if (!m) { fail(`${g.slug}: no entry in game-meta.ts`); continue }
    if (!ICONS[m.icon]) fail(`${g.slug}: icon "${m.icon}" is not in lib/icons.ts`)
  }
  ok(`${games.length} games checked for meta and icon`)
  for (const slug of SHELL_GAMES) {
    const page = read(`src/pages/${slug}.astro`)
    check(/import GameShell from/.test(page) && /createShell\(/.test(page), `${slug} is really built on the GameShell`)
    check(/slot="howto"/.test(page), `${slug} says how to play`)
  }
  // Every daily challenge must point at a game that is actually in the shell.
  for (let d = 0; d < 20; d++) {
    const daily = dailyFor(new Date(Date.UTC(2026, 0, 1 + d)))
    if (!SHELL_GAMES.has(daily.slug)) fail(`daily challenge on day ${d} points at ${daily.slug}, which is not in the shell`)
  }
  ok('daily challenges only ever pick shell games')
}

console.log(failures ? `\n${failures} check(s) failed.` : '\nAll checks passed.')
process.exit(failures ? 1 : 0)
