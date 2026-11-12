/**
 * check-spend-cash — is the money on the floor really the money in the bank?
 *
 * lib/spend/cash.ts turns the balance into pallets, bricks, bundles and notes
 * and puts each one somewhere. The page draws exactly that, so if it is wrong
 * the picture lies about the one number the game is about. This holds it to:
 *
 *   1. it adds up: the pieces are worth exactly the balance, for every
 *      balance — the edges where a unit breaks, every price in the shop, and
 *      a few thousand at random;
 *   2. it is the fewest pieces: never ten bundles where a brick would do;
 *   3. the pieces are physical: nothing overlaps anything, nothing hangs off
 *      its pallet or sinks into the floor, and the hundred billion fits in a
 *      warehouse;
 *   4. spending only ever takes away: a full pallet never moves or comes back
 *      because something else was bought.
 *
 *   node scripts/check-spend-cash.mjs
 */
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

const C = await import('../src/lib/spend/cash.ts')
const { ITEMS, BUDGET } = await import('../src/lib/spend-items.ts')

let failures = 0
const check = (c, m) => { if (!c) failures++; if (!c || process.env.VERBOSE) console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${m}`) }

let seed = 12345
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647

const balances = new Set([0, 1, 4, 5, 9, 49, 50, 51, 99, 100, 101, 199, 9_999, 10_000, 10_001, 99_999, 100_000,
  100_001, 99_999_999, 100_000_000, 100_000_001, 4_321_987_654, BUDGET - 1, BUDGET])
for (const it of ITEMS) { balances.add(it.price); balances.add(BUDGET - it.price); balances.add(BUDGET % it.price) }
for (let i = 0; i < 3000; i++) balances.add(Math.floor(Math.pow(rand(), 3) * BUDGET))

console.log('\nit adds up, in the fewest pieces')
let wrong = 0, notFewest = 0
for (const b of balances) {
  const c = C.breakDown(b)
  if (C.total(c) !== b) wrong++
  const changeSum = c.change.reduce((a, v) => a + v, 0)
  if (c.bricks >= C.BRICKS_PER_PALLET || c.bundles >= C.BUNDLES_PER_BRICK || c.notes >= C.NOTES_PER_BUNDLE || changeSum >= 100) notFewest++
  // The change is made with the fewest notes too: greedy is optimal for 50/20/10/5/1.
  const best = (() => { let d = changeSum, n = 0; for (const v of C.CHANGE) { n += Math.floor(d / v); d %= v } return n })()
  if (c.change.length !== best) notFewest++
}
check(wrong === 0, `the pieces are worth exactly the balance, for ${balances.size} balances (${wrong} wrong)`)
check(notFewest === 0, `never more pieces than it needs (${notFewest} not)`)
const full = C.breakDown(BUDGET)
check(full.pallets === C.PALLETS && full.bricks + full.bundles + full.notes + full.change.length === 0, 'the whole fortune is exactly a thousand pallets')

console.log('\nthe pieces are physical')
const overlap = (a, b) => {
  const e = 1e-9
  return Math.abs(a.x - b.x) < (a.w + b.w) / 2 - e && Math.abs(a.y - b.y) < (a.h + b.h) / 2 - e && Math.abs(a.z - b.z) < (a.d + b.d) / 2 - e
}
// Pallets on the floor: none touching, and the lot in a warehouse.
const fullP = C.pieces(full)
let palletClash = 0
const xs = fullP.bases.map((p) => p.x), zs = fullP.bases.map((p) => p.z)
for (let i = 0; i < fullP.bases.length; i++) for (let j = i + 1; j < fullP.bases.length; j++) if (overlap(fullP.bases[i], fullP.bases[j])) palletClash++
check(palletClash === 0, `no two of the thousand pallets touch (${palletClash})`)
const w = Math.max(...xs) - Math.min(...xs) + C.BASE.w, d = Math.max(...zs) - Math.min(...zs) + C.BASE.d
check(w < 50 && d < 50, `they fit on a warehouse floor: ${w.toFixed(1)} × ${d.toFixed(1)} m`)
check(C.BLOCK.w <= C.BASE.w && C.BLOCK.d <= C.BASE.d, `a pallet's cash fits on its pallet (${C.BLOCK.w.toFixed(3)} × ${C.BLOCK.d.toFixed(3)} on ${C.BASE.w} × ${C.BASE.d})`)
const vol = C.BLOCK.w * C.BLOCK.d * C.BLOCK.h, notesPer = C.BRICKS_PER_PALLET * C.BUNDLES_PER_BRICK * C.NOTES_PER_BUNDLE
check(Math.abs(vol - notesPer * C.NOTE.w * C.NOTE.d * C.NOTE.h) / vol < 1e-9, `a pallet is a million notes, ${vol.toFixed(2)} m³ of paper`)

let clash = 0, hanging = 0, sunk = 0, counted = 0
for (const b of balances) {
  const c = C.breakDown(b), ps = C.pieces(c)
  if (ps.pallets.length !== c.pallets || ps.bricks.length !== c.bricks || ps.bundles.length !== c.bundles ||
    ps.notes.length !== c.notes || ps.change.length !== c.change.length) counted++
  // The loose money: bricks, bundles and the top note (notes and change are a
  // stack, so only check them against the bricks and bundles).
  const loose = [...ps.bricks, ...ps.bundles]
  for (let i = 0; i < loose.length; i++) for (let j = i + 1; j < loose.length; j++) if (overlap(loose[i], loose[j])) clash++
  const stack = [...ps.notes, ...ps.change]
  for (const n of stack) for (const l of loose) if (overlap({ ...n, w: n.w * 0.9, d: n.d * 0.9 }, l)) clash++
  // Everything on the open pallet stays over it.
  const base = ps.bases[c.pallets]
  if (base) for (const p of [...ps.bricks, ...ps.bundles, ...ps.notes]) {
    if (Math.abs(p.x - base.x) + p.w / 2 > base.w / 2 + 0.002 || Math.abs(p.z - base.z) + p.d / 2 > base.d / 2 + 0.002) hanging++
  }
  for (const p of [...ps.pallets, ...ps.bases, ...ps.bricks, ...ps.bundles, ...ps.notes, ...ps.change]) if (p.y - p.h / 2 < -1e-9) sunk++
}
check(counted === 0, `one piece drawn for every piece counted (${counted} off)`)
check(clash === 0, `nothing on the open pallet passes through anything else (${clash})`)
check(hanging === 0, `nothing hangs off the pallet it is on (${hanging})`)
check(sunk === 0, `nothing sinks into the floor (${sunk})`)

console.log('\nspending only takes away')
let moved = 0, back = 0
for (let i = 0; i < 2000; i++) {
  const b = Math.floor(rand() * BUDGET), it = ITEMS[Math.floor(rand() * ITEMS.length)]
  if (it.price > b) continue
  const before = C.pieces(C.breakDown(b)), after = C.pieces(C.breakDown(b - it.price))
  const was = new Map(before.pallets.map((p) => [p.key, p]))
  for (const p of after.pallets) {
    const q = was.get(p.key)
    if (!q) back++
    else if (q.x !== p.x || q.z !== p.z) moved++
  }
}
check(back === 0, `buying something never brings a pallet back (${back})`)
check(moved === 0, `and never moves one that stays (${moved})`)

const bb = C.bounds(C.breakDown(5))
check(!!bb && bb.max[1] - bb.min[1] < 0.001 && bb.max[0] - bb.min[0] < 0.2, 'five dollars is one note, lying on the pallet')
check(C.bounds(C.breakDown(0)) === null, 'and nothing is nothing')

console.log(failures ? `\n${failures} failure(s)\n` : '\nall cash checks passed\n')
process.exit(failures ? 1 : 0)
