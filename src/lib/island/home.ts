/**
 * The homepage's island, built once per build.
 *
 * The page draws it and the files it is baked into are served beside it
 * (pages/island/[...file].ts); both must start from the same island, built
 * the same way, or the page would ask for a bake that was never served.
 */
import { listedGames } from '../../data/games'
import { withBase } from '../base'
import { buildIsland } from './world'
import { resvgRaster } from './raster'
import { bakedIsland } from './bake'

/** The listed games, newest first, as the homepage shows them. */
export const homeGames = () => listedGames().sort((a, b) => b.added.localeCompare(a.added))

let built: ReturnType<typeof buildIsland> | null = null
export function homeIsland() {
  built ??= buildIsland(homeGames().map((g) => ({ slug: g.slug, title: g.title, blurb: g.blurb, href: withBase(`/${g.slug}/`) })), { raster: resvgRaster })
  return built
}

/** The island, baked; and where its files are served from. */
export function homeBake() {
  const b = bakedIsland(homeIsland())
  return { ...b, base: withBase(`/island/${b.hash}/`) }
}
