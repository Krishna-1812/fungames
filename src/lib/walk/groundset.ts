/**
 * The ground's materials (terrain.ts): photographed surfaces, one layer each of two array textures the page loads
 * (public/walk-ground/, made by scripts/build-ground.mjs from CC0 Poly Haven sets).
 *
 *   - colour: the surface's albedo (sRGB) and, in alpha, its height (for blending one surface into another by
 *     what stands proud — sand settling into the joints of paving, grass in the cracks — and for parallax);
 *   - detail: its normal (x, y; z worked out), its roughness and its ambient occlusion (linear).
 *
 * Each layer's albedo is held, in the build, to what that surface measures in the real world (the mean of its
 * photograph scaled to it, its hue kept or eased), so every layer lands inside the albedo rule's range (albedo.ts)
 * before any light touches it. `metres` is how much ground one repeat of the photograph covers; `hex` says whether
 * it may be laid by hex-tiling (Mikkelsen's: three rotated, offset copies blended, so no repeat can be seen) — which
 * suits anything natural, and would scramble anything laid in rows (paving, cobbles, a wall's courses).
 *
 * Plain data, no three: the build script and the checks import it too.
 */
export type GroundLayer = {
  /** Its name, and the file names in public/walk-ground/ (<key>-c.ktx2, <key>-d.ktx2). */
  key: string
  /** The Poly Haven set it was made from (CC0), and its maps' names in that set. */
  source: string
  diffuse?: string
  /** One repeat of the photograph, in metres. */
  metres: number
  /** The linear albedo its mean is scaled to (luminance), what it is in the real world. */
  albedo: number
  /** How much of its photograph's colour is kept (1 all, 0 grey): a red rock eased towards the island's grey one. */
  sat?: number
  /** A tint multiplied in after (linear), to turn a photograph's hue to the island's own. */
  tint?: [number, number, number]
  /** How much of its photograph's contrast is kept (snow's tyre ruts eased away). */
  contrast?: number
  /** Laid by hex-tiling (natural surfaces), or in plain repeats (anything laid in rows). */
  hex: boolean
  /** How rough it is, scaled (the photograph's roughness map times this). */
  rough?: number
}

export const GROUND: GroundLayer[] = [
  { key: 'asphalt', source: 'clean_asphalt', metres: 2.1, albedo: 0.075, hex: true },
  { key: 'asphalt-worn', source: 'asphalt_02', metres: 3, albedo: 0.11, sat: 0.6, hex: true },
  { key: 'paving', source: 'concrete_pavement', metres: 1.8, albedo: 0.27, sat: 0.8, hex: false },
  { key: 'cobbles', source: 'cobblestone_floor_08', metres: 2, albedo: 0.17, sat: 0.7, hex: false },
  { key: 'granite', source: 'granite_tile_04', metres: 2, albedo: 0.26, sat: 0.5, hex: false },
  { key: 'sand', source: 'sand_01', metres: 1.5, albedo: 0.42, sat: 0.85, hex: true },
  { key: 'sand-wet', source: 'damp_beach_sand', metres: 2, albedo: 0.19, sat: 1, tint: [1.08, 1, 0.88], hex: true },
  { key: 'grass', source: 'sparse_grass', metres: 2, albedo: 0.13, sat: 1.25, tint: [0.62, 1.2, 0.45], hex: true },
  { key: 'soil', source: 'dirt_floor', metres: 2.07, albedo: 0.17, sat: 0.75, hex: true },
  { key: 'mud', source: 'brown_mud_02', metres: 1.3, albedo: 0.085, hex: true },
  { key: 'rock', source: 'rock_face', metres: 2.38, albedo: 0.19, sat: 0.3, hex: true },
  { key: 'rock-sea', source: 'seaside_rock', metres: 2, albedo: 0.13, sat: 0.6, hex: true },
  { key: 'gravel', source: 'gravel_floor_03', metres: 2.5, albedo: 0.2, sat: 0.7, hex: true },
  { key: 'field', source: 'farm_soil', metres: 2, albedo: 0.11, sat: 0.85, hex: true },
  { key: 'snow', source: 'snow_02', metres: 2, albedo: 0.78, sat: 0.6, contrast: 0.35, hex: true, rough: 0.8 },
  { key: 'badland', source: 'dry_ground_rocks', metres: 4, albedo: 0.26, sat: 0.85, hex: true },
  { key: 'pebbles', source: 'river_small_rocks', metres: 2.9, albedo: 0.17, sat: 0.7, hex: true },
  { key: 'stone', source: 'stone_wall', metres: 2, albedo: 0.26, sat: 0.6, hex: false },
  { key: 'leaves', source: 'forest_leaves_02', diffuse: 'diffuse', metres: 3, albedo: 0.1, hex: true },
]

/** A layer's index by its key (the shader's numbering). */
export const LAYER = Object.fromEntries(GROUND.map((g, k) => [g.key, k])) as Record<string, number>

/** The size the build makes each layer (pixels a side), and the most the walk may load at first, all files together. */
export const GROUND_SIZE = 1024
export const GROUND_BUDGET_MB = 12
