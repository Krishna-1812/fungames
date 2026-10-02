/**
 * The island, baked: built (build.ts), painted (draw.ts), and kept.
 *
 * Baking takes a minute and a half and its result depends only on the
 * island's own markup and this code, so it is kept on disk under a hash of
 * both and only done again when either changes. It runs in a process of its
 * own (scripts/bake-island.mjs), where it can collect resvg's native memory
 * as it goes and where nothing it does can take the site's build down with
 * it; the homepage and its files ask for the result with bakedIsland().
 */
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import type { Scene } from '../scene'
import { RULES, KEYFRAMES, LAYERS, POKES, LANDMARK } from '../moves'

/** Bump when the baked format or the way it is painted changes. */
export const BAKE_VERSION = 1
/** Layers the canvas does not draw (the page writes the district names itself); the still picture for a page without script has them. */
export const SKIP_LAYERS = new Set(['banners'])

type IslandLike = { layers: { kind: string; slug?: string; body: string }[]; css: string; viewBox: [number, number, number, number] }

// The project: builds (and the bake script) run from it. Not import.meta.url, which a bundled build moves.
const root = process.cwd()
const cacheDir = path.join(root, 'node_modules', '.cache', 'island')

/** A hash of everything the bake depends on. */
export function bakeHash(island: IslandLike): string {
  const h = createHash('sha256')
  h.update(String(BAKE_VERSION))
  for (const l of island.layers) h.update(`${l.kind}:${l.slug ?? ''}:${l.body}`)
  h.update(island.css)
  h.update(JSON.stringify(island.viewBox))
  h.update(JSON.stringify({ RULES, KEYFRAMES, LAYERS, POKES, LANDMARK }))
  for (const f of ['build.ts', 'draw.ts', 'xml.ts', '../anim.ts', '../keyframes.ts', '../scene.ts', '../../../../scripts/bake-island.mjs']) h.update(fs.readFileSync(path.join(root, 'src/lib/island/bake', f)))
  return h.digest('hex').slice(0, 12)
}

export type Baked = { hash: string; scene: Scene; cards: Record<string, string>; files: string[]; dir: string }
const memo = new Map<string, Baked>()

/** The baked island for this markup: from the cache, or baked now (in a process of its own). */
export function bakedIsland(island: IslandLike): Baked {
  const hash = bakeHash(island)
  const hit = memo.get(hash)
  if (hit) return hit
  const dir = path.join(cacheDir, hash)
  const done = path.join(dir, 'done.json')
  if (!fs.existsSync(done)) {
    const t0 = Date.now()
    console.log(`[island] baking ${hash} (about a minute and a half, once per change to the island)`)
    // The island exactly as the page built it, for the bake to read.
    fs.mkdirSync(cacheDir, { recursive: true })
    const input = path.join(cacheDir, `${hash}.input.json`)
    fs.writeFileSync(input, JSON.stringify({ layers: island.layers, css: island.css, viewBox: island.viewBox }))
    const r = spawnSync(process.execPath, ['--expose-gc', '--max-old-space-size=4096', path.join(root, 'scripts/bake-island.mjs'), input, dir, hash], { cwd: root, stdio: 'inherit', timeout: 20 * 60_000 })
    fs.rmSync(input, { force: true })
    if (r.status !== 0 || !fs.existsSync(done)) throw new Error(`[island] the bake failed (exit ${r.status}${r.error ? `, ${r.error.message}` : ''})`)
    console.log(`[island] baked in ${((Date.now() - t0) / 1000).toFixed(0)}s`)
    // Keep only the newest few bakes.
    try {
      const old = fs.readdirSync(cacheDir).filter((d) => d !== hash).map((d) => ({ d, t: fs.statSync(path.join(cacheDir, d)).mtimeMs })).sort((a, b) => b.t - a.t).slice(2)
      for (const { d } of old) fs.rmSync(path.join(cacheDir, d), { recursive: true, force: true })
    } catch { /* fine */ }
  }
  const meta = JSON.parse(fs.readFileSync(done, 'utf8')) as { files: string[] }
  const out: Baked = { hash, dir, files: meta.files, scene: JSON.parse(fs.readFileSync(path.join(dir, 'scene.json'), 'utf8')), cards: JSON.parse(fs.readFileSync(path.join(dir, 'cards.json'), 'utf8')) }
  memo.set(hash, out)
  return out
}

/** One baked file's bytes. */
export const bakedFile = (b: Baked, file: string) => fs.readFileSync(path.join(b.dir, file))
