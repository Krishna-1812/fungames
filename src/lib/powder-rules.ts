/**
 * Powder's materials and its reaction table.
 *
 * These used to be an if-chain inside the page, which worked but meant the
 * reactions could not be counted, listed, or tested — and a sandbox with
 * nothing to find is a toy you put down after thirty seconds. As a table they
 * become content: the game can tell you there are forty of them and which ones
 * you have not found yet, and scripts/check-powder.mjs can run every single one
 * and check it does what its name says.
 *
 * A reaction is strictly a *pair* of adjacent materials. Things a single cell
 * does on its own — falling, burning down, evaporating — stay in the engine,
 * because "steam eventually condenses" is not something you discover.
 */

/* -------------------------------------------------------------------------- */
/* Materials                                                                  */
/* -------------------------------------------------------------------------- */

export const EMPTY = 0, SAND = 1, WATER = 2, STONE = 3, WOOD = 4, FIRE = 5,
  SMOKE = 6, STEAM = 7, OIL = 8, LAVA = 9, ICE = 10, PLANT = 11,
  ACID = 12, POWDER = 13, GLASS = 14, EMBER = 15,
  SALT = 16, BRINE = 17, DIRT = 18, MUD = 19, SEED = 20, METAL = 21,
  RUST = 22, SPARK = 23, COAL = 24, ASH = 25, NITRO = 26, CLOUD = 27,
  SNOW = 28, THERMITE = 29, FUNGUS = 30, SLIME = 31

/** Wide enough for every id with room to add more without resizing anything. */
export const SLOTS = 48

export type Kind = 0 | 1 | 2 | 3 // static, powder, liquid, gas

export type Material = {
  id: number
  name: string
  type: Kind
  /** Who sinks past whom. */
  density: number
  rgb: [number, number, number]
  vary: number
  life?: number
  flammable?: boolean
  /** False for materials that only ever appear as the result of a reaction. */
  draw?: boolean
  hint?: string
}

export const MATERIALS: Material[] = [
  // --- the original twelve you can draw with -----------------------------
  { id: SAND, name: 'Sand', type: 1, density: 6, rgb: [214, 180, 104], vary: 22, draw: true },
  { id: WATER, name: 'Water', type: 2, density: 3, rgb: [58, 122, 214], vary: 14, draw: true },
  { id: STONE, name: 'Stone', type: 0, density: 9, rgb: [124, 124, 132], vary: 16, draw: true },
  { id: WOOD, name: 'Wood', type: 0, density: 9, rgb: [128, 84, 48], vary: 16, flammable: true, draw: true },
  { id: PLANT, name: 'Plant', type: 0, density: 9, rgb: [66, 168, 74], vary: 22, flammable: true, draw: true, hint: 'Drinks water and spreads' },
  { id: OIL, name: 'Oil', type: 2, density: 2, rgb: [74, 58, 42], vary: 12, flammable: true, draw: true, hint: 'Floats on water, burns fast' },
  { id: LAVA, name: 'Lava', type: 2, density: 7, rgb: [232, 96, 24], vary: 26, draw: true, hint: 'Melts ice, burns wood, turns sand to glass' },
  { id: ICE, name: 'Ice', type: 0, density: 9, rgb: [168, 218, 240], vary: 14, draw: true, hint: 'Slowly freezes water beside it' },
  { id: ACID, name: 'Acid', type: 2, density: 3, rgb: [150, 232, 40], vary: 18, draw: true, hint: 'Dissolves nearly anything, and itself' },
  { id: POWDER, name: 'Gunpowder', type: 1, density: 6, rgb: [64, 62, 68], vary: 14, flammable: true, draw: true, hint: 'Do not put this near fire' },
  { id: FIRE, name: 'Fire', type: 3, density: 0, rgb: [255, 150, 40], vary: 40, life: 46, draw: true },
  { id: GLASS, name: 'Glass', type: 0, density: 9, rgb: [186, 226, 232], vary: 10, draw: true, hint: 'Acid cannot touch it. That is why acid comes in bottles.' },

  // --- twelve more ---------------------------------------------------------
  { id: SALT, name: 'Salt', type: 1, density: 6, rgb: [236, 236, 232], vary: 12, draw: true, hint: 'Melts ice, ruins water, kills plants' },
  { id: DIRT, name: 'Dirt', type: 1, density: 6, rgb: [110, 82, 56], vary: 18, draw: true, hint: 'Wet it and grow something' },
  { id: SEED, name: 'Seed', type: 1, density: 6, rgb: [176, 148, 68], vary: 16, flammable: true, draw: true, hint: 'Needs water. Prefers mud.' },
  { id: METAL, name: 'Metal', type: 0, density: 9, rgb: [158, 164, 176], vary: 10, draw: true, hint: 'Carries a spark. Rusts. Melts.' },
  { id: SPARK, name: 'Spark', type: 3, density: 0, rgb: [255, 236, 130], vary: 30, life: 12, draw: true, hint: 'Travels through metal and water' },
  { id: COAL, name: 'Coal', type: 1, density: 7, rgb: [46, 44, 48], vary: 10, flammable: true, draw: true, hint: 'Burns for a very long time' },
  { id: NITRO, name: 'Nitro', type: 2, density: 4, rgb: [206, 70, 130], vary: 16, draw: true, hint: 'Extremely unreasonable' },
  { id: CLOUD, name: 'Cloud', type: 3, density: 0, rgb: [222, 228, 238], vary: 10, draw: true, hint: 'Rains. Can be persuaded to storm.' },
  { id: SNOW, name: 'Snow', type: 1, density: 4, rgb: [244, 250, 255], vary: 8, draw: true, hint: 'Packs into ice, melts into water' },
  { id: THERMITE, name: 'Thermite', type: 1, density: 7, rgb: [186, 96, 58], vary: 18, flammable: true, draw: true, hint: 'Burns through metal' },
  { id: FUNGUS, name: 'Fungus', type: 0, density: 9, rgb: [186, 136, 196], vary: 20, flammable: true, draw: true, hint: 'Eats wood and plants' },
  { id: SLIME, name: 'Slime', type: 2, density: 5, rgb: [120, 200, 150], vary: 18, flammable: true, draw: true, hint: 'Thick, and not fireproof' },

  // --- only ever produced, never drawn -------------------------------------
  { id: SMOKE, name: 'Smoke', type: 3, density: 0, rgb: [110, 110, 116], vary: 18, life: 130 },
  { id: STEAM, name: 'Steam', type: 3, density: 0, rgb: [198, 210, 222], vary: 14, life: 170 },
  { id: EMBER, name: 'Ember', type: 1, density: 6, rgb: [226, 78, 30], vary: 30, life: 120 },
  { id: BRINE, name: 'Brine', type: 2, density: 4, rgb: [96, 150, 190], vary: 14 },
  { id: MUD, name: 'Mud', type: 1, density: 6, rgb: [82, 62, 44], vary: 14 },
  { id: RUST, name: 'Rust', type: 0, density: 9, rgb: [150, 88, 52], vary: 20 },
  { id: ASH, name: 'Ash', type: 1, density: 5, rgb: [128, 122, 118], vary: 16 },
]

export const byId = (id: number) => MATERIALS.find((m) => m.id === id)
export const nameOf = (id: number) => byId(id)?.name ?? 'Nothing'

/* -------------------------------------------------------------------------- */
/* Reactions                                                                  */
/* -------------------------------------------------------------------------- */

export type Reaction = {
  /** Stable across releases: it is the key a player's discoveries are saved under. */
  id: string
  /** The acting cell. */
  a: number
  /** Its neighbour. */
  b: number
  /** What the acting cell becomes. Undefined leaves it alone. */
  a2?: number
  /** What the neighbour becomes. Undefined leaves it alone. */
  b2?: number
  /** Chance per adjacent pair per frame. */
  p: number
  /** Blast radius, for the ones that do not merely change colour. */
  boom?: number
  /** One line, shown in the log once you have found it. */
  note: string
}

/**
 * The forty-seven.
 *
 * Ordered roughly by how likely you are to stumble into them, because the log
 * shows them in this order and the first few should feel findable.
 */
export const REACTIONS: Reaction[] = [
  // --- heat and water ------------------------------------------------------
  { id: 'fire-water', a: FIRE, b: WATER, a2: STEAM, p: 1, note: 'Water puts fire out, and the fire leaves as steam.' },
  { id: 'lava-water', a: LAVA, b: WATER, a2: STONE, b2: STEAM, p: 0.45, note: 'Quenched lava is how every island here gets made.' },
  { id: 'lava-sand', a: LAVA, b: SAND, b2: GLASS, p: 0.12, note: 'Sand plus enough heat is glass. This is genuinely how it works.' },
  { id: 'lava-ice', a: LAVA, b: ICE, b2: WATER, p: 0.9, note: 'Ice does not last long next to molten rock.' },
  { id: 'fire-ice', a: FIRE, b: ICE, b2: WATER, p: 0.5, note: 'Slower than lava, but it gets there.' },
  { id: 'water-ice', a: WATER, b: ICE, a2: ICE, p: 0.0016, note: 'Ice spreads through still water, given time.' },
  { id: 'snow-fire', a: SNOW, b: FIRE, a2: WATER, p: 0.7, note: 'Snow goes straight to water.' },
  { id: 'snow-lava', a: SNOW, b: LAVA, a2: STEAM, p: 0.9, note: 'Snow on lava skips the water entirely.' },
  { id: 'snow-water', a: SNOW, b: WATER, a2: ICE, p: 0.02, note: 'Snow packs down into ice where it settles in water.' },

  // --- burning -------------------------------------------------------------
  { id: 'fire-wood', a: FIRE, b: WOOD, b2: EMBER, p: 0.09, note: 'Wood does not flare — it goes to embers and stays there.' },
  { id: 'fire-oil', a: FIRE, b: OIL, b2: FIRE, p: 0.34, note: 'Oil catches four times faster than anything else here.' },
  { id: 'fire-plant', a: FIRE, b: PLANT, b2: FIRE, p: 0.09, note: 'A thicket is a fuse you grew yourself.' },
  { id: 'fire-coal', a: FIRE, b: COAL, b2: EMBER, p: 0.05, note: 'Coal is slow to catch and then burns for ages.' },
  { id: 'fire-slime', a: FIRE, b: SLIME, b2: FIRE, p: 0.12, note: 'Slime is not fireproof, whatever it looks like.' },
  { id: 'fire-fungus', a: FIRE, b: FUNGUS, b2: FIRE, p: 0.14, note: 'Dry fungus goes up quickly.' },
  { id: 'fire-seed', a: FIRE, b: SEED, b2: FIRE, p: 0.1, note: 'Nothing grows after this.' },
  { id: 'ember-wood', a: EMBER, b: WOOD, b2: EMBER, p: 0.06, note: 'Embers spread through timber without ever making a flame.' },
  { id: 'lava-wood', a: LAVA, b: WOOD, b2: FIRE, p: 0.16, note: 'Lava does not need an introduction.' },
  { id: 'lava-metal', a: LAVA, b: METAL, b2: LAVA, p: 0.02, note: 'Given long enough, lava melts metal into more lava.' },
  { id: 'lava-glass', a: LAVA, b: GLASS, b2: LAVA, p: 0.03, note: 'Glass softens well below the temperature of lava, so it just joins in.' },

  // --- bangs ---------------------------------------------------------------
  { id: 'fire-powder', a: FIRE, b: POWDER, p: 1, boom: 9, note: 'Yes. This is the one everybody tries first.' },
  { id: 'lava-powder', a: LAVA, b: POWDER, p: 1, boom: 10, note: 'Bigger, because lava carries more heat into it.' },
  { id: 'spark-powder', a: SPARK, b: POWDER, p: 1, boom: 9, note: 'A spark is all it takes. That is the point of a spark.' },
  { id: 'fire-nitro', a: FIRE, b: NITRO, p: 1, boom: 16, note: 'The largest thing this simulation can do.' },
  { id: 'spark-nitro', a: SPARK, b: NITRO, p: 1, boom: 16, note: 'Do not run a wire through this.' },
  { id: 'fire-thermite', a: FIRE, b: THERMITE, b2: LAVA, p: 0.3, note: 'Thermite does not burn so much as become lava.' },
  { id: 'spark-thermite', a: SPARK, b: THERMITE, b2: LAVA, p: 0.5, note: 'One spark and the whole pile goes.' },

  // --- electricity ---------------------------------------------------------
  { id: 'spark-metal', a: SPARK, b: METAL, b2: SPARK, p: 0.55, note: 'Metal carries a spark as far as you laid the wire.' },
  { id: 'spark-water', a: SPARK, b: WATER, b2: SPARK, p: 0.3, note: 'So does water, which is worth remembering.' },
  { id: 'spark-brine', a: SPARK, b: BRINE, b2: SPARK, p: 0.6, note: 'Salt water conducts better than fresh. It really does.' },
  { id: 'spark-oil', a: SPARK, b: OIL, b2: FIRE, p: 0.5, note: 'A spark near oil is a fire near oil.' },
  { id: 'spark-cloud', a: SPARK, b: CLOUD, b2: SPARK, p: 0.8, note: 'A charged cloud. Stand somewhere else.' },

  // --- growing -------------------------------------------------------------
  { id: 'water-plant', a: WATER, b: PLANT, a2: PLANT, p: 0.006, note: 'Plants drink, and a puddle becomes a thicket.' },
  { id: 'seed-water', a: SEED, b: WATER, a2: PLANT, p: 0.05, note: 'All a seed ever wanted.' },
  { id: 'seed-mud', a: SEED, b: MUD, a2: PLANT, p: 0.16, note: 'Three times faster than plain water. Mud is better soil.' },
  { id: 'dirt-water', a: DIRT, b: WATER, a2: MUD, b2: MUD, p: 0.3, note: 'Dirt and water make more mud than you expect.' },
  { id: 'mud-fire', a: MUD, b: FIRE, a2: DIRT, p: 0.2, note: 'Baked back to dirt.' },
  { id: 'fungus-wood', a: FUNGUS, b: WOOD, b2: FUNGUS, p: 0.02, note: 'Fungus eats through timber slowly and completely.' },
  { id: 'fungus-plant', a: FUNGUS, b: PLANT, b2: FUNGUS, p: 0.03, note: 'And through anything green rather faster.' },

  // --- salt and rot --------------------------------------------------------
  { id: 'salt-water', a: SALT, b: WATER, a2: BRINE, b2: BRINE, p: 0.4, note: 'Salt does not sit in water. It becomes it.' },
  { id: 'salt-ice', a: SALT, b: ICE, b2: WATER, p: 0.3, note: 'Which is why they put it on roads.' },
  { id: 'salt-plant', a: SALT, b: PLANT, b2: DIRT, p: 0.2, note: 'Salting the earth. It works.' },
  { id: 'brine-plant', a: BRINE, b: PLANT, b2: DIRT, p: 0.08, note: 'Slower than dry salt, and just as final.' },
  { id: 'brine-fire', a: BRINE, b: FIRE, a2: SALT, p: 0.4, note: 'Boil it off and the salt is still there.' },
  { id: 'metal-water', a: METAL, b: WATER, a2: RUST, p: 0.0009, note: 'Very slow. Leave it and come back.' },
  { id: 'metal-acid', a: METAL, b: ACID, a2: RUST, p: 0.25, note: 'Much quicker, and it eats the acid too.' },
  { id: 'acid-stone', a: ACID, b: STONE, b2: EMPTY, p: 0.1, note: 'Even stone. Acid does not respect much.' },
]

/**
 * A flat lookup keyed on the ordered pair, so the hot loop does no searching.
 * Both orders are stored, pointing at the same reaction; the engine works out
 * which side it is on from `a`.
 */
export function buildLookup(): (Reaction | undefined)[] {
  const table: (Reaction | undefined)[] = new Array(SLOTS * SLOTS)
  for (const r of REACTIONS) {
    table[r.a * SLOTS + r.b] = r
    if (table[r.b * SLOTS + r.a] === undefined) table[r.b * SLOTS + r.a] = r
  }
  return table
}

/** The label the log shows: "Lava + Water → Stone". */
export function describe(r: Reaction): string {
  const products = [r.a2, r.b2].filter((p) => p !== undefined) as number[]
  const made = products.filter((p) => p !== EMPTY).map(nameOf)
  const to = r.boom ? 'Explosion' : made.length ? [...new Set(made)].join(' + ') : 'Nothing left'
  return `${nameOf(r.a)} + ${nameOf(r.b)} → ${to}`
}
