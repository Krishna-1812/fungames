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
  ['volcano', 'water', 'Island'],
  ['desert', 'water', 'Oasis'],
  ['city', 'fire', 'Ruins'],
  ['swamp', 'wind', 'Fog'],
  ['tornado', 'sand', 'Sandstorm'],

  // Weather: what water does once it is in the air.
  ['steam', 'wind', 'Cloud'],
  ['cloud', 'water', 'Rain'],
  ['cloud', 'cloud', 'Storm'],
  ['storm', 'metal', 'Lightning'],
  ['cloud', 'mountain', 'Snow'],
  ['snow', 'water', 'Ice'],
  ['ice', 'mountain', 'Glacier'],
  ['snow', 'wind', 'Blizzard'],
  ['snow', 'snow', 'Snowman'],
  ['rain', 'rain', 'Flood'],
  ['tornado', 'water', 'Waterspout'],
  ['smoke', 'fog', 'Smog'],

  // Growing things, and bread, the long way round.
  ['plant', 'rain', 'Flower'],
  ['flower', 'flower', 'Garden'],
  ['plant', 'land', 'Field'],
  ['field', 'sun', 'Wheat'],
  ['wheat', 'stone', 'Flour'],
  ['flour', 'water', 'Dough'],
  ['dough', 'fire', 'Bread'],
  ['desert', 'plant', 'Cactus'],
  ['desert', 'wind', 'Dune'],

  // Wood.
  ['forest', 'blade', 'Wood'],
  ['wood', 'fire', 'Campfire'],
  ['wood', 'water', 'Boat'],
  ['boat', 'wind', 'Sailboat'],
  ['wood', 'steam', 'Paper'],
  ['paper', 'paper', 'Book'],
  ['book', 'book', 'Library'],

  // Clay.
  ['mud', 'sand', 'Clay'],
  ['clay', 'fire', 'Pot'],

  // Metal, steam and carbon.
  ['metal', 'water', 'Rust'],
  ['metal', 'steam', 'Engine'],
  ['engine', 'boat', 'Steamship'],
  ['engine', 'land', 'Train'],
  ['charcoal', 'metal', 'Steel'],
  ['steel', 'city', 'Skyscraper'],
  ['charcoal', 'mountain', 'Diamond'],

  // Glass and light.
  ['glass', 'metal', 'Mirror'],
  ['glass', 'glass', 'Lens'],
  ['lens', 'lens', 'Telescope'],
  ['glass', 'house', 'Greenhouse'],
  ['glass', 'rainbow', 'Prism'],

  // Electricity.
  ['lightning', 'metal', 'Electricity'],
  ['electricity', 'glass', 'Light bulb'],
  ['electricity', 'metal', 'Magnet'],
  ['magnet', 'metal', 'Compass'],
  ['lightning', 'sand', 'Fulgurite'],

  // Water, at every size.
  ['river', 'wall', 'Dam'],
  ['wave', 'sand', 'Beach'],
  ['lake', 'lake', 'Sea'],
  ['sea', 'sea', 'Ocean'],
  ['sea', 'sun', 'Salt'],
  ['sea', 'stone', 'Coral'],
  ['sea', 'plant', 'Seaweed'],
  ['river', 'mountain', 'Waterfall'],
  ['river', 'stone', 'Canyon'],
  ['lava', 'wave', 'Obsidian'],

  // Life.
  ['swamp', 'lightning', 'Life'],
  ['life', 'water', 'Fish'],
  ['life', 'wind', 'Bird'],
  ['bird', 'bird', 'Egg'],

  // The sky.
  ['sun', 'sun', 'Star'],
  ['land', 'land', 'Continent'],
  ['continent', 'ocean', 'Planet'],
  ['planet', 'stone', 'Moon'],
  ['moon', 'sea', 'Tide'],
  ['moon', 'sun', 'Eclipse'],
  ['star', 'star', 'Galaxy'],
]

export const LOCAL = Object.fromEntries(RECIPES.map(([a, b, text]) => [pairKey(a, b), { text }]))
