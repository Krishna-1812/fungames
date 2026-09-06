/**
 * Deep Time's events, and when they happened.
 *
 * Lifted out of the page so `scripts/check-time-art.mjs` reads the same list
 * the page renders — a drawing keyed on a title that has since been reworded
 * is invisible on the page and silent everywhere else.
 *
 * `at` is years before present. `big` marks the ones that get a larger card:
 * roughly, the events where the planet stopped being one thing and started
 * being another.
 */
export type Event = { at: number; title: string; note?: string; big?: boolean }

export const EVENTS: Event[] = [
  { at: 4_540_000_000, title: 'Earth forms', note: 'A disc of dust and rock finishes clumping together.', big: true },
  { at: 4_510_000_000, title: 'Something the size of Mars hits us', note: 'The debris becomes the Moon.' },
  { at: 4_400_000_000, title: 'The first oceans', note: 'The surface finally cools enough for liquid water.' },
  { at: 4_100_000_000, title: 'Heavy bombardment', note: 'The inner solar system is still being pelted.' },
  { at: 3_700_000_000, title: 'The oldest trace of life', note: 'Carbon signatures in Greenland rock.', big: true },
  { at: 3_500_000_000, title: 'Cyanobacteria', note: 'Mats of bacteria start splitting water for energy.' },
  { at: 2_400_000_000, title: 'The Great Oxidation', note: 'Free oxygen poisons almost everything alive.', big: true },
  { at: 2_100_000_000, title: 'The first complex cell', note: 'One cell swallows another and keeps it. Mitochondria.' },
  { at: 1_000_000_000, title: 'The first multicellular life' },
  { at: 720_000_000, title: 'Snowball Earth', note: 'Ice reaches the equator. Twice.' },
  { at: 541_000_000, title: 'The Cambrian explosion', note: 'Almost every animal body plan appears at once.', big: true },
  { at: 470_000_000, title: 'Plants move onto land' },
  { at: 440_000_000, title: 'The first mass extinction' },
  { at: 375_000_000, title: 'A fish crawls out of the water', note: 'Tiktaalik. Everything with a spine and legs comes from this.', big: true },
  { at: 350_000_000, title: 'The coal forests', note: 'The trees rotting now are the fuel of the 1800s.' },
  { at: 320_000_000, title: 'The first reptiles' },
  { at: 252_000_000, title: 'The Great Dying', note: 'Ninety-six percent of marine species stop existing.', big: true },
  { at: 230_000_000, title: 'The first dinosaurs' },
  { at: 225_000_000, title: 'The first mammals', note: 'Small, nocturnal, and about to wait 160 million years.' },
  { at: 150_000_000, title: 'Feathers and flight' },
  { at: 130_000_000, title: 'The first flower' },
  { at: 66_000_000, title: 'The asteroid', note: 'Ten kilometres wide. Seventy-five percent of species gone.', big: true },
  { at: 55_000_000, title: 'The first primates' },
  { at: 20_000_000, title: 'The first apes' },
  { at: 7_000_000, title: 'Our line splits from chimpanzees', big: true },
  { at: 3_200_000, title: 'Lucy walks upright' },
  { at: 2_600_000, title: 'The first stone tool' },
  { at: 1_000_000, title: 'Fire, kept and carried' },
  { at: 300_000, title: 'Homo sapiens', note: 'Us. Anatomically modern, and still 290,000 years from farming.', big: true },
  { at: 70_000, title: 'Out of Africa' },
  { at: 40_000, title: 'Cave paintings at Chauvet' },
  { at: 12_000, title: 'Somebody plants a seed on purpose', note: 'Agriculture. Everything after this is very fast.', big: true },
  { at: 5_500, title: 'Writing' },
  { at: 4_500, title: 'The Great Pyramid' },
  { at: 2_000, title: 'The Roman Empire' },
  { at: 570, title: 'The printing press' },
  { at: 250, title: 'The steam engine' },
  { at: 160, title: 'The telephone' },
  { at: 123, title: 'Twelve seconds of powered flight' },
  { at: 80, title: 'The first computer' },
  { at: 55, title: 'Footprints on the Moon' },
  { at: 35, title: 'The World Wide Web' },
  { at: 19, title: 'A computer in everyone\u2019s pocket' },
  { at: 0, title: 'You, scrolling', note: 'You just fell through 4.54 billion years. It took a few minutes.', big: true },
]
