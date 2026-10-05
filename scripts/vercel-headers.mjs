/**
 * vercel-headers — after `astro build`, carry vercel.json's headers into the
 * adapter's own routing table.
 *
 * With @astrojs/vercel the build hands Vercel a finished Build Output
 * (.vercel/output/config.json), and Vercel routes by that alone: the
 * `headers` in vercel.json would quietly stop applying, taking the island's
 * year-long cache and the security headers with them. So each one is written
 * into the table here, first, as a route that only adds headers and lets the
 * request carry on. vercel.json stays the one place they are listed.
 *
 *   node scripts/vercel-headers.mjs        (run by `npm run build`)
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const out = '.vercel/output/config.json'
if (!existsSync(out)) {
  console.log('vercel-headers: no .vercel/output (not an adapter build), nothing to do')
  process.exit(0)
}
const config = JSON.parse(readFileSync(out, 'utf8'))
const { headers = [] } = JSON.parse(readFileSync('vercel.json', 'utf8'))

// vercel.json's sources here are all of the form /prefix/(.*): letters, slashes,
// underscores and one capture. Anything else would need a real translation, so refuse it.
const toSrc = (source) => {
  if (!/^\/[a-z_/]*\(\.\*\)$/.test(source)) throw new Error(`vercel-headers: cannot translate source ${source}`)
  return '^' + source + '$'
}
const ours = headers.map((h) => ({ src: toSrc(h.source), headers: Object.fromEntries(h.headers.map((x) => [x.key, x.value])), continue: true }))
const mine = new Set(ours.map((r) => r.src + JSON.stringify(r.headers)))
config.routes = [...ours, ...config.routes.filter((r) => !(r.continue && mine.has(r.src + JSON.stringify(r.headers))))]
writeFileSync(out, JSON.stringify(config, null, '\t'))
console.log(`vercel-headers: ${ours.length} header rules added to ${out}`)
