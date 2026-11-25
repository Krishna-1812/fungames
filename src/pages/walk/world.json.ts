import type { APIRoute } from 'astro'
import { homeIsland, homeGames } from '../../lib/island/home'
import { withBase } from '../../lib/base'

/**
 * The island, as facts, for the walk (lib/walk): the same model Unity builds
 * the realistic island from (world.ts, IslandModel) — the ground a tile at a
 * time and its heights, the roads, the river, the pond and the piers, every
 * building's solids and every tree and rock, the pictures its boards and
 * posters carry — and each game's title and page,
 * so walking up to its building can take you in. Built once with the site.
 */
export const GET: APIRoute = () => {
  const m = homeIsland('cartoon').model
  const games = Object.fromEntries(homeGames().map((g) => [g.slug, { title: g.title, href: withBase(`/${g.slug}/`) }]))
  const body = {
    grid: m.grid, sea: m.sea, beachZ: m.beachZ, ground: m.ground, height: m.height, district: m.district,
    river: m.river, pond: m.pond, road: m.road, piers: m.piers, fields: m.fields,
    buildings: m.buildings, solids: m.solids, plants: m.plants.map((p) => [p.name, +p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(1), +p.k.toFixed(2)]),
    seaRocks: m.seaRocks, isles: m.isles, games, prints: m.prints,
  }
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } })
}
