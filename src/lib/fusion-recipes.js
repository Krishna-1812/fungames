import { pairKey } from './fusion-pair.js'

// Ingredients are canonicalised once, so reversed recipes stay reachable.
// [ingredient, ingredient, result]. No fourth column: the elements are drawn
// now (src/lib/fusion-art.ts), so a picture character per row is both unused
// and the thing this site does not do.
export const RECIPES = [
  ['earth', 'water', 'Plant'],
  ['fire', 'water', 'Steam'],
  ['earth', 'fire', 'Lava'],
  ['earth', 'wind', 'Dust'],
  ['fire', 'wind', 'Smoke'],
  ['water', 'wind', 'Wave'],
  ['lava', 'water', 'Stone'],
  ['plant', 'water', 'Swamp'],
  ['plant', 'fire', 'Ash'],
  ['stone', 'wind', 'Sand'],
  ['fire', 'sand', 'Glass'],
  ['plant', 'plant', 'Forest'],
  ['lava', 'lava', 'Volcano'],
  ['steam', 'earth', 'Geyser'],
  ['swamp', 'fire', 'Alcohol'],
  ['stone', 'stone', 'Mountain'],
  ['mountain', 'water', 'River'],
  ['sand', 'sand', 'Desert'],
  ['wave', 'wave', 'Tsunami'],
  ['dust', 'water', 'Mud'],
  ['mud', 'fire', 'Brick'],
  ['brick', 'brick', 'Wall'],
  ['wall', 'wall', 'House'],
  ['forest', 'fire', 'Charcoal'],
  ['glass', 'sand', 'Hourglass'],
  ['stone', 'fire', 'Metal'],
  ['metal', 'fire', 'Blade'],
  ['house', 'house', 'Village'],
  ['village', 'village', 'City'],
  ['water', 'water', 'Lake'],
  ['earth', 'earth', 'Land'],
  ['wind', 'wind', 'Tornado'],
  ['fire', 'fire', 'Sun'],
  ['sun', 'water', 'Rainbow'],
  ['sun', 'plant', 'Sunflower'],
  ['lake', 'fire', 'Steam'],
]

export const LOCAL = Object.fromEntries(RECIPES.map(([a, b, text]) => [pairKey(a, b), { text }]))
