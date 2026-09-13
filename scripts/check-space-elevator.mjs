/**
 * check-space-elevator — proves the atmosphere model is the real one, and
 * the marker data is internally consistent.
 *
 *   1. standardTemperatureK reproduces the US Standard Atmosphere 1976's own
 *      well-known reference points: 15°C at sea level, -56.5°C at the
 *      tropopause (11km), -2.5°C at the stratopause (51km), and a mesopause
 *      cold enough to land in the real, published -80 to -95°C range.
 *   2. Temperature is continuous across every layer boundary — no jump —
 *      and returns null above the model's real 86km ceiling rather than a
 *      fabricated number.
 *   3. approxPressureRatio is 1 at sea level, strictly decreasing with
 *      altitude, and never negative.
 *   4. ZONES are contiguous and ascending with no gaps or overlaps.
 *   5. MARKERS are sorted by real altitude, every one lands inside the zone
 *      its altitude claims, and the two headline records (Kármán line,
 *      highest-ever winged flight) are consistent with each other.
 *
 *   node scripts/check-space-elevator.mjs
 */
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

const {
  standardTemperatureK, kelvinToC, approxPressureRatio, ATMOSPHERE_MODEL_CEILING_M, KARMAN_LINE_M,
} = await import('../src/lib/space-elevator-model.ts')
const { ZONES, MARKERS, TOTAL_ALTITUDE } = await import('../src/data/space-elevator.ts')

let failures = 0
function check(cond, label) {
  if (cond) {
    console.log(`  ok    ${label}`)
  } else {
    console.log(`  FAIL  ${label}`)
    failures++
  }
}

console.log('temperature model matches real reference points')
{
  const c = (m) => kelvinToC(standardTemperatureK(m))
  check(Math.abs(c(0) - 15) < 0.1, `sea level is 15°C (got ${c(0).toFixed(2)})`)
  check(Math.abs(c(11_000) - -56.5) < 0.1, `tropopause is -56.5°C (got ${c(11_000).toFixed(2)})`)
  check(Math.abs(c(51_000) - -2.5) < 0.1, `stratopause is -2.5°C (got ${c(51_000).toFixed(2)})`)
  const mesopause = c(ATMOSPHERE_MODEL_CEILING_M)
  check(mesopause < -80 && mesopause > -100, `mesopause is in the real -80 to -100°C range (got ${mesopause.toFixed(1)})`)
  check(standardTemperatureK(ATMOSPHERE_MODEL_CEILING_M + 1) === null, 'no fabricated temperature above the model’s real 86km ceiling')
  check(standardTemperatureK(-1) === null, 'no fabricated temperature below sea level')
}

console.log('\ntemperature is continuous across every layer seam')
{
  const seams = [11_000, 20_000, 32_000, 47_000, 51_000, 71_000]
  for (const s of seams) {
    const below = standardTemperatureK(s - 0.001)
    const at = standardTemperatureK(s)
    check(Math.abs(below - at) < 0.01, `no jump at ${s}m (${below.toFixed(3)}K vs ${at.toFixed(3)}K)`)
  }
}

console.log('\npressure falls the way a real atmosphere does')
{
  check(Math.abs(approxPressureRatio(0) - 1) < 1e-9, 'sea level ratio is exactly 1')
  let prev = 1
  let monotonic = true
  for (let m = 1000; m <= 100_000; m += 1000) {
    const r = approxPressureRatio(m)
    if (r >= prev || r < 0) monotonic = false
    prev = r
  }
  check(monotonic, 'strictly decreasing and non-negative from 0 to 100km')
  check(approxPressureRatio(100_000) < 0.001, 'less than 0.1% of sea-level pressure remains at the Kármán line')
}

console.log('\nzones are contiguous, ascending, and cover the whole climb')
{
  let ok = true
  for (let i = 0; i < ZONES.length; i++) {
    if (ZONES[i].to <= ZONES[i].from) ok = false
    if (ZONES[i].pxPerMetre <= 0) ok = false
    if (i > 0 && ZONES[i].from !== ZONES[i - 1].to) ok = false
  }
  check(ok, `${ZONES.length} zones, each contiguous with the last`)
  check(ZONES[0].from === 0, 'the climb starts at sea level')
  check(TOTAL_ALTITUDE === ZONES[ZONES.length - 1].to, 'TOTAL_ALTITUDE matches the last zone’s ceiling')
}

console.log('\nmarkers are real, sorted, and land in the zone they claim')
{
  let sorted = true
  for (let i = 1; i < MARKERS.length; i++) {
    if (MARKERS[i].altitude < MARKERS[i - 1].altitude) sorted = false
  }
  check(sorted, `all ${MARKERS.length} markers are in ascending altitude order`)

  let allLand = true
  for (const m of MARKERS) {
    const zone = ZONES.find((z) => m.altitude >= z.from && m.altitude <= z.to)
    if (!zone) allLand = false
  }
  check(allLand, 'every marker’s altitude falls inside a real zone')

  const withNotes = MARKERS.every((m) => m.note && m.note.length > 40)
  check(withNotes, 'every marker carries a real, non-trivial note')

  const everest = MARKERS.find((m) => m.title.includes('Everest'))
  check(everest && Math.abs(everest.altitude - 8_848.86) < 1, 'Everest’s summit is the real 2020-remeasured height')

  const karman = MARKERS.find((m) => m.altitude === KARMAN_LINE_M)
  check(!!karman, 'the Kármán line marker sits at exactly 100,000m')

  const x15 = MARKERS.find((m) => m.title.includes('X-15'))
  check(x15 && x15.altitude > KARMAN_LINE_M, 'the X-15’s record flight actually cleared the Kármán line')
}

console.log(failures === 0 ? '\nAll space-elevator checks passed.' : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)
