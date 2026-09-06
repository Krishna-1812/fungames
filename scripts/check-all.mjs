import { readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const checks = readdirSync(new URL('.', import.meta.url))
  .filter((name) => /^check-.+\.mjs$/.test(name) && name !== 'check-all.mjs').sort()
const failed = []
for (const name of checks) {
  const result = spawnSync(process.execPath, [`scripts/${name}`], {
    cwd: root, encoding: 'utf8', timeout: 120_000, maxBuffer: 16 * 1024 * 1024,
  })
  const ok = result.status === 0 && !result.error
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) {
    failed.push(name)
    console.error(result.stdout, result.stderr, result.error ?? '')
  }
}
console.log(`${checks.length - failed.length}/${checks.length} check suites passed.`)
process.exitCode = failed.length ? 1 : 0
