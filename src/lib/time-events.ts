/**
 * Deep Time's events, and when they happened.
 *
 * Lifted out of the page so `scripts/check-time-earth.mjs` reads the same list
 * the page renders.
 *
 * `at` is years before present. `big` marks the turning points: roughly, the
 * events where the planet stopped being one thing and started being another.
 *
 * `where` is degrees east and north, and is only given for the last seven
 * million years: that is how far back the globe's coastline is the real one,
 * so that is how far back a mark on it is in the right place. The globe turns
 * to show it. `'moon'` is the one event that did not happen here.
 */
export type Event = {
  at: number
  title: string
  note?: string
  big?: boolean
  place?: string
  where?: [number, number] | 'moon'
}

export const EVENTS: Event[] = [
  { at: 4_540_000_000, title: 'Earth forms', note: 'A disc of dust and rock finishes clumping together.', big: true },
  { at: 4_510_000_000, title: 'Something the size of Mars hits us', note: 'The debris becomes the Moon.' },
  { at: 4_400_000_000, title: 'The first oceans', note: 'The surface finally cools enough for liquid water.' },
  { at: 4_100_000_000, title: 'Heavy bombardment', note: 'The inner solar system is still being pelted.' },
  { at: 3_700_000_000, title: 'The oldest trace of life', note: 'Carbon signatures in Greenland rock.', big: true },
  { at: 3_500_000_000, title: 'Cyanobacteria', note: 'Mats of bacteria start splitting water for energy.' },
  { at: 2_400_000_000, title: 'The Great Oxidation', note: 'Free oxygen poisons almost everything alive.', big: true },
  { at: 2_100_000_000, title: 'The first complex cell', note: 'One cell swallows another and keeps it. Mitochondria.' },
  { at: 1_000_000_000, title: 'The first multicellular life', note: 'Cells that stay together and divide the work between them.' },
  { at: 720_000_000, title: 'Snowball Earth', note: 'Ice reaches the equator. Twice.' },
  { at: 541_000_000, title: 'The Cambrian explosion', note: 'Almost every animal body plan appears at once.', big: true },
  { at: 470_000_000, title: 'Plants move onto land', note: 'A few centimetres high, on rock that has been bare for four billion years.' },
  { at: 440_000_000, title: 'The first mass extinction', note: 'An ice age at the South Pole. Eighty-five percent of marine species.' },
  { at: 375_000_000, title: 'A fish crawls out of the water', note: 'Tiktaalik. Everything with a spine and legs comes from this.', big: true },
  { at: 350_000_000, title: 'The coal forests', note: 'The trees rotting now are the fuel of the 1800s.' },
  { at: 320_000_000, title: 'The first reptiles', note: 'An egg with a shell: animals that never have to go back to the water.' },
  { at: 252_000_000, title: 'The Great Dying', note: 'Ninety-six percent of marine species stop existing.', big: true },
  { at: 230_000_000, title: 'The first dinosaurs', note: 'Small, on two legs, and not yet in charge of anything.' },
  { at: 225_000_000, title: 'The first mammals', note: 'Small, nocturnal, and about to wait 160 million years.' },
  { at: 150_000_000, title: 'Feathers and flight', note: 'Archaeopteryx, over a lagoon in what will be Bavaria.' },
  { at: 130_000_000, title: 'The first flower', note: 'Every fruit, grain and blossom since descends from something like it.' },
  { at: 66_000_000, title: 'The asteroid', note: 'Ten kilometres wide. Seventy-five percent of species gone.', big: true },
  { at: 55_000_000, title: 'The first primates', note: 'Hands that grip and eyes that face forward, in a much hotter world.' },
  { at: 20_000_000, title: 'The first apes', note: 'No tail.' },
  { at: 7_000_000, title: 'Our line splits from chimpanzees', note: 'The oldest skull on our side of the split is from Chad.', big: true, place: 'Central Africa', where: [17.5, 16.2] },
  { at: 3_200_000, title: 'Lucy walks upright', note: 'Australopithecus afarensis, a little over a metre tall.', place: 'Hadar, Ethiopia', where: [40.6, 11.1] },
  { at: 2_600_000, title: 'The first stone tool', note: 'A cobble with a flake knocked off it, to make an edge.', place: 'Gona, Ethiopia', where: [40.5, 11.1] },
  { at: 1_000_000, title: 'Fire, kept and carried', note: 'Ash and burnt bone, thirty metres inside a cave.', place: 'Wonderwerk Cave, South Africa', where: [23.55, -27.85] },
  { at: 300_000, title: 'Homo sapiens', note: 'Us. Anatomically modern, and still 290,000 years from farming.', big: true, place: 'Jebel Irhoud, Morocco', where: [-8.87, 31.85] },
  { at: 70_000, title: 'Out of Africa', note: 'A few thousand people. Everyone outside Africa descends from them.', place: 'The Red Sea crossing', where: [43.3, 12.6] },
  { at: 36_000, title: 'Cave paintings at Chauvet', note: 'Lions, rhinos and horses, in charcoal, by lamplight.', place: 'Ardèche, France', where: [4.42, 44.39] },
  { at: 12_000, title: 'Somebody plants a seed on purpose', note: 'Agriculture. Everything after this is very fast.', big: true, place: 'The Fertile Crescent', where: [38.0, 36.5] },
  { at: 5_500, title: 'Writing', note: 'Marks pressed into wet clay, to count grain and sheep.', place: 'Uruk, Mesopotamia', where: [45.64, 31.32] },
  { at: 4_500, title: 'The Great Pyramid', note: 'The tallest thing anyone builds for the next 3,800 years.', place: 'Giza, Egypt', where: [31.13, 29.98] },
  { at: 2_000, title: 'The Roman Empire', note: 'About a fifth of everyone alive, under one government.', place: 'Rome', where: [12.5, 41.9] },
  { at: 570, title: 'The printing press', note: 'Gutenberg. A book stops being a year of someone’s life.', place: 'Mainz, Germany', where: [8.27, 50.0] },
  { at: 250, title: 'The steam engine', note: 'Watt’s. Power that is not muscle, wind or water.', place: 'Birmingham, England', where: [-1.9, 52.48] },
  { at: 150, title: 'The telephone', note: 'Bell: “Mr Watson, come here.”', place: 'Boston, USA', where: [-71.06, 42.36] },
  { at: 123, title: 'Twelve seconds of powered flight', note: 'The Wright brothers, thirty-seven metres along the sand.', place: 'Kitty Hawk, USA', where: [-75.67, 36.02] },
  { at: 80, title: 'The first computer', note: 'ENIAC: about eighteen thousand valves, and thirty tons.', place: 'Philadelphia, USA', where: [-75.19, 39.95] },
  { at: 57, title: 'Footprints on the Moon', note: 'Apollo 11. The prints are still there.', place: 'The Sea of Tranquility', where: 'moon' },
  { at: 35, title: 'The World Wide Web', note: 'One server, on a desk at CERN.', place: 'Geneva, Switzerland', where: [6.05, 46.23] },
  { at: 19, title: 'A computer in everyone’s pocket', note: 'With more computing in it than Apollo had, and a camera.', place: 'California, USA', where: [-122.03, 37.32] },
  { at: 0, title: 'You, scrolling', note: 'You just fell through 4.54 billion years. It took a few minutes.', big: true },
]
