/**
 * check-auction-room — the Auction Game's saleroom around its engine.
 *
 * The engine (lib/auction.ts) has its own check; this holds the room to it:
 *
 *   1. Every lot in the catalogue has a model in scripts/auction-bake/lots/
 *      and both photographs, 3:2 at 1500 and 750 wide, none of them blank,
 *      and each one's corners the stage's own colour — the photograph has no
 *      edge on the page because its backdrop falls away to #151b22.
 *   2. The studio and the models name nothing with a GLSL reserved word.
 *   3. Every rival has a seat and a paddle, no two paddles share a number,
 *      and nobody holds yours.
 *   4. The currency board's arithmetic: conversions round to the board's
 *      step, a broken rates answer is refused rather than shown, and the
 *      fallback rates are a real day's.
 *   5. The page shows the photographs, the board and the paddles, and the
 *      old drawings are gone; public/auction is on the deploy allowlist.
 *   6. The result card still renders the game's three kinds of ending.
 *
 *   node scripts/check-auction-room.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { register } from 'node:module'
import sharp from 'sharp'
register('./resolve-ts.mjs', import.meta.url)

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const { CATALOGUE } = await import('../src/data/lots.ts')
const { makeRivals } = await import('../src/lib/auction.ts')
const room = await import('../src/lib/auction-room.ts')
const { resultCardSvg } = await import('../src/lib/result-card.ts')

let failures = 0
const fail = (m) => { failures++; console.log(`  FAIL  ${m}`) }
const ok = (m) => console.log(`  ok    ${m}`)
const check = (c, m) => (c ? ok(m) : fail(m))
const ids = CATALOGUE.map((l) => l.id)

/* -------------------------------------------------------------------------- */
console.log('\nthe photographs')
/* -------------------------------------------------------------------------- */
{
  const lotDir = path.join(root, 'scripts/auction-bake/lots')
  const models = fs.readdirSync(lotDir).filter((f) => f.endsWith('.glsl')).map((f) => f.slice(0, -5))
  const missing = ids.filter((id) => !models.includes(id))
  const stray = models.filter((m) => !ids.includes(m))
  check(!missing.length && !stray.length, `a model for each of the ${ids.length} lots and none for anything else${missing.length ? ' — none for ' + missing.join(', ') : ''}${stray.length ? ' — stray ' + stray.join(', ') : ''}`)

  const problems = [], edges = []
  for (const id of ids) {
    for (const [small, w] of [[false, 1500], [true, 750]]) {
      const f = path.join(root, 'public', room.lotPhoto(id, small))
      if (!fs.existsSync(f)) { problems.push(`${id}${small ? ' (small)' : ''} missing`); continue }
      const m = await sharp(f).metadata()
      if (m.width !== w || m.height !== Math.round((w * 2) / 3)) problems.push(`${id} ${m.width}x${m.height}`)
      if (small) continue
      const s = await sharp(f).stats()
      if (s.channels.slice(0, 3).every((c) => c.stdev < 6)) problems.push(`${id} is a blank frame`)
      // The four corners, 24 pixels square each, against the stage colour.
      const { data, info } = await sharp(f).raw().toBuffer({ resolveWithObject: true })
      for (const [cx, cy] of [[0, 0], [w - 24, 0], [0, info.height - 24], [w - 24, info.height - 24]]) {
        let r = 0, g = 0, b = 0
        for (let y = cy; y < cy + 24; y++) for (let x = cx; x < cx + 24; x++) {
          const i = (y * w + x) * info.channels; r += data[i]; g += data[i + 1]; b += data[i + 2]
        }
        const n = 24 * 24, d = Math.max(Math.abs(r / n - 0x15), Math.abs(g / n - 0x1b), Math.abs(b / n - 0x22))
        if (d > 4) edges.push(`${id} corner ${cx ? 'right' : 'left'}-${cy ? 'bottom' : 'top'} off by ${d.toFixed(1)}`)
      }
    }
  }
  check(!problems.length, `both photographs for all ${ids.length}, 3:2 at 1500 and 750 wide, none blank${problems.length ? ' — ' + problems.slice(0, 6).join('; ') : ''}`)
  check(!edges.length, `every photograph's corners are the stage's #151b22, so a lot has no frame on the page${edges.length ? ' — ' + edges.slice(0, 4).join('; ') : ''}`)
}

/* -------------------------------------------------------------------------- */
console.log('\nthe studio')
/* -------------------------------------------------------------------------- */
{
  const strip = (t) => t.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
  const files = ['studio.glsl', ...fs.readdirSync(path.join(root, 'scripts/auction-bake/lots')).filter((f) => f.endsWith('.glsl')).map((f) => 'lots/' + f)]
  const bad = files.filter((f) => /\b(half|input|output|sample|filter)\b/.test(strip(fs.readFileSync(path.join(root, 'scripts/auction-bake', f), 'utf8'))))
  check(!bad.length, `no GLSL reserved word used as a name in the studio or any of ${files.length - 1} models${bad.length ? ' — ' + bad.join(', ') : ''}`)
  const studio = fs.readFileSync(path.join(root, 'scripts/auction-bake/studio.glsl'), 'utf8')
  check(/EDGE = vec3\(0\.0823, 0\.1059, 0\.1333\)/.test(studio), "the studio's sweep falls away to #151b22, the stage's colour")
}

/* -------------------------------------------------------------------------- */
console.log('\nthe room')
/* -------------------------------------------------------------------------- */
{
  const rivals = makeRivals()
  check(rivals.every((b) => room.SEATS[b.id]) && Object.keys(room.SEATS).length === rivals.length, `a seat for each of the ${rivals.length} rivals, and no empty seats`)
  const paddles = Object.values(room.SEATS).map((s) => s.paddle)
  check(new Set(paddles).size === paddles.length && !paddles.includes(room.YOUR_PADDLE), 'no two paddles share a number, and nobody else holds yours')
  const via = new Set(Object.values(room.SEATS).map((s) => s.via))
  check(via.has('room') && via.has('phone') && via.has('online'), 'bidders in the room, on the telephone and online, as a real sale has')
  const svg = room.paddleSvg('104')
  check(svg.startsWith('<svg') && svg.includes('>104<') && !/<script|https?:\/\/(?!www\.w3)/.test(svg), 'a paddle is a self-contained drawing with its number on it')
}

/* -------------------------------------------------------------------------- */
console.log('\nthe currency board')
/* -------------------------------------------------------------------------- */
{
  const { convert, parseRates, FALLBACK_RATES, BOARD, grouped, rateDate } = room
  check(convert(1000, 1.3125, 1) === 1313 && convert(1000, 208.22, 100) === 208200 && convert(380, 10.2884, 10) === 3910, 'bids convert and round to the board’s step (£1,000 → US$1,313, ¥208,200)')
  check(BOARD.every((c) => FALLBACK_RATES.rates[c.code] > 0) && /^\d{4}-\d{2}-\d{2}$/.test(FALLBACK_RATES.date), 'the fallback has a rate for every currency on the board, and a date')
  const good = { amount: 1, base: 'GBP', date: '2026-11-20', rates: { USD: 1.31, EUR: 1.19, CHF: 1.1, HKD: 10.3, JPY: 208 } }
  check(parseRates(good)?.rates.JPY === 208, 'a real answer from the rates service is read')
  check(parseRates(null) === null && parseRates({ date: 'x' }) === null && parseRates({ ...good, rates: { ...good.rates, USD: 'n/a' } }) === null && parseRates({ ...good, rates: { ...good.rates, JPY: 2.08 } }) === null,
    'a missing, broken or absurd answer is refused, so the board keeps the fallback')
  check(grouped(1312500) === '1,312,500' && rateDate('2026-11-20') === '20 Nov 2026', 'the board prints thousands and the rates’ date the way a London board does')
}

/* -------------------------------------------------------------------------- */
console.log('\nthe page')
/* -------------------------------------------------------------------------- */
{
  const page = fs.readFileSync(path.join(root, 'src/pages/auction.astro'), 'utf8')
  check(/lotPhoto\(/.test(page) && /class="au-img/.test(page), 'the rostrum shows the lot’s photograph')
  check(/data-fx=/.test(page) && /RATES_URL/.test(page) && /for guidance only/.test(page), 'the currency board converts every bid and says it is for guidance only')
  check(/paddleSvg\(seat\.paddle\)/.test(page) && /paddleSvg\(YOUR_PADDLE, true\)/.test(page), 'every seat has its paddle, and so do you')
  check(!/auction-art|auction-bidders/.test(page) && !fs.existsSync(path.join(root, 'src/lib/auction-art.ts')), 'the old flat drawings and cartoon portraits are gone')
  check(/\.stage:has\(> \.au\)[^}]*#151b22/.test(page), 'the stage is painted the photographs’ edge colour')
  const allow = fs.readFileSync(path.join(root, 'scripts/check-public-boundary.mjs'), 'utf8')
  check(allow.includes("'auction'"), 'public/auction is on the deploy allowlist')
}

/* -------------------------------------------------------------------------- */
console.log('\nthe result card')
/* -------------------------------------------------------------------------- */
{
  const all = ['Kept every penny', 'Up £12,345', 'Down £12,000'].every((headline) =>
    resultCardSvg({ slug: 'auction', siteName: '', headline, sub: 'At the end of fourteen lots', stats: [
      { label: 'Bought', value: '14' }, { label: 'Paid', value: '£12,000' }, { label: 'Appraised', value: '£99,999' },
    ] }).includes('<svg'))
  check(all, 'the result card renders all three kinds of ending')
}

console.log(failures ? `\n${failures} failed` : '\nall good')
process.exit(failures ? 1 : 0)
