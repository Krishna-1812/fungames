/**
 * A Node resolver hook so scripts/ can import the site's real source files.
 *
 * Everything under src/ imports extensionlessly ("./gl", "../data/world"),
 * because that is what Vite resolves and what the whole codebase already looks
 * like. Node's ESM resolver will not do that on its own, so rather than putting
 * .ts extensions through the source to satisfy a test harness, the harness
 * adapts. Registered from check-impact.mjs before it imports anything from src.
 */
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const EXTS = ['.ts', '.js', '.mjs']

export async function resolve(specifier, context, nextResolve) {
  const bare = specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)
  if (bare && context.parentURL) {
    const base = new URL(specifier, context.parentURL).href
    for (const ext of EXTS) {
      if (existsSync(fileURLToPath(base + ext))) return nextResolve(base + ext, context)
    }
  }
  return nextResolve(specifier, context)
}
