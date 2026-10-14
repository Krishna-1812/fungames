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
import { plateRef, skyArt } from './plate'
import { figureSet, buildingSet } from './figures'

/** The listed games, newest first, as the homepage shows them. */
export const homeGames = () => listedGames().sort((a, b) => b.added.localeCompare(a.added))

/**
 * Which island: the cartoon one, drawn by the site itself, or the realistic
 * one, its ground, buildings and creatures rendered in Unity (unity/). Each is
 * a page of its own (pages/index.astro, pages/realistic.astro); a switch in the
 * island's header goes between them, and the camera and the hour come along.
 */
export type World = 'cartoon' | 'real'
export const WORLDS: World[] = ['cartoon', 'real']

/** The Unity renders: the ground, and the trees and rocks on it, on or off together. */
function realism(world: World) {
  const plate = world === 'real' ? plateRef('plate', true) : null
  return { plate, glow: plate ? plateRef('glow', true) : null, sky: plate ? skyArt() : null, figures: plate ? figureSet() : null, buildings: plate ? buildingSet() : null }
}

const built = new Map<World, ReturnType<typeof buildIsland>>()
export function homeIsland(world: World = 'cartoon') {
  let b = built.get(world)
  if (!b) built.set(world, (b = buildIsland(homeGames().map((g) => ({ slug: g.slug, title: g.title, blurb: g.blurb, href: withBase(`/${g.slug}/`) })), { raster: resvgRaster, ...realism(world) })))
  return b
}

/** The island, baked; and where its files are served from. */
export function homeBake(world: World = 'cartoon') {
  const b = bakedIsland(homeIsland(world))
  return { ...b, base: withBase(`/island/${b.hash}/`) }
}

/** Whether the realistic island can be built at all: Unity's renders are in the repo. */
export const hasRealWorld = () => !!plateRef('plate', true)
