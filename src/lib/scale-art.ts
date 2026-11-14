/**
 * Scale's solid objects: what each is a picture of, and how big it really is.
 *
 * Every one of these is a small 3D model — `scripts/scale-bake/models/` —
 * photographed once by `scripts/bake-scale.mjs` and shown as that photograph,
 * `public/scale/<slug>.webp`. This file is the part the page, the studio and
 * the checker all have to agree on: the object's real footprint.
 *
 * **Shape is data.** A picture knows the object's width *and* its height, and
 * the registry's `m` is only one of them: for the Eiffel Tower it is 330
 * metres of height, and a page that sized things from `m` alone drew the tower
 * 330 metres wide. So each entry gives both, says which one `m` is, and
 * `check-scale-art.mjs` proves that against the registry and against the
 * proportions of the picture actually on disk.
 *
 * The frame is the frame of the photograph, so where a model is seen at an
 * angle the other axis is what it measures *as seen*: the red blood cell is
 * eight micrometres across and leaned back, so it is 6.6 tall in the picture.
 */

export type Picture = {
  /** What it is, in words, so the checker can print something useful. */
  subject: string
  /** Real width in metres, as framed. */
  wm: number
  /** Real height in metres, as framed. */
  hm: number
  /** Which axis the registry's `m` measures. */
  axis: 'w' | 'h'
  /** What the caption calls that axis. */
  word: 'across' | 'tall' | 'long'
}

/** How much empty margin a photograph carries on every side, as a fraction of
 *  the object's box. The studio frames with it and the page sizes with it. */
export const PAD = 0.04

/** `Grain of sand` -> `grain-of-sand`: the model's file, and the picture's. */
export const slugOf = (name: string) =>
  name
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const across = (m: number, subject: string, ratio = 1): Picture => ({ subject, wm: m, hm: m * ratio, axis: 'w', word: 'across' })
const long = (m: number, subject: string, ratio: number): Picture => ({ subject, wm: m, hm: m * ratio, axis: 'w', word: 'long' })
const tall = (m: number, subject: string, ratio: number): Picture => ({ subject, wm: m * ratio, hm: m, axis: 'h', word: 'tall' })

/** Keyed on the names in `scale-things`; the checker proves the two agree. */
export const SCALE_ART: Record<string, Picture> = {
  Proton: across(1.7e-15, 'a proton — three quarks, the gluon field between them, and the region that confines them'),
  'Carbon nucleus': across(5.0e-15, 'a carbon-12 nucleus — six protons and six neutrons, close-packed'),
  'Uranium nucleus': long(1.5e-14, 'a uranium-238 nucleus — 238 nucleons, a quarter longer than it is wide', 1 / 1.3),
  'Water molecule': across(2.8e-10, 'a water molecule at its van der Waals surface, bent at 104.5°', 0.8466),
  Buckyball: across(1.0e-9, 'a buckyball — sixty carbons at the corners of a truncated icosahedron'),
  'DNA, across the helix': across(2.0e-9, 'two turns of B-DNA, with its two unequal grooves', 3.4),
  'Influenza virus': across(9.0e-8, 'an influenza virion, crowded with both of its spike proteins'),
  'E. coli': long(2.0e-6, 'E. coli — a wrinkled rod in a coat of pili', 0.25),
  'Red blood cell': across(8.0e-6, 'a red blood cell, leaned back so the dimple shows', 0.825),
  'Human hair, across': across(7.0e-5, 'a length of human hair, cuticle scales outside and the cortex at the cut', 3),
  'Grain of sand': across(5.0e-4, 'a grain of quartz sand — rolled, pitted, iron-stained', 0.86),
  Ant: long(5.0e-3, 'an ant, side on', 0.3226),
  'A coin': across(2.45e-2, 'a coin of no country, with a reeded edge'),
  'A person': tall(1.7, 'a person, standing', 0.33),
  'A car': long(4.5, 'a car, side on', 1 / 3),
  'Blue whale': long(30, 'a blue whale — throat pleats, a tiny dorsal fin, notched flukes', 5 / 27),
  'Football pitch': long(105, 'a football pitch from above, mown in stripes', 68 / 105),
  'Eiffel Tower': tall(330, 'the Eiffel Tower, latticed, a little off square-on', 139 / 330),
  'Burj Khalifa': tall(828, 'the Burj Khalifa, setbacks spiralling up three wings', 100 / 828),
  // Quoted by elevation and far wider than it is high: the block goes down to
  // sea level because that is what 8,849 metres is measured from.
  'Mount Everest': tall(8849, 'Everest and its neighbours, in a block cut down to sea level', 1.9),
  // Quoted by its length, which runs up the picture rather than across it.
  Manhattan: { subject: 'Manhattan from the south — the island, the grid, the park, two clumps of towers', wm: 21000 / 5.7, hm: 21000, axis: 'h', word: 'long' },
  'The Grand Canyon': long(446000, 'the Grand Canyon from above — a plateau, and a trench cut through it in steps', 1 / 4.4),
  'The Moon': across(3.474e6, 'the Moon, near side — the seas where they are, and Tycho’s rays'),
  Earth: across(1.2742e7, 'Earth, Africa and Europe facing, on the real coastline, with weather'),
  Jupiter: across(1.3982e8, 'Jupiter — flattened by its spin, belted, with the Great Red Spot', 0.935),
  'The Sun': across(1.392e9, 'the Sun in white light — granulation, spots, a darker and redder limb'),
}

/** The metres the registry quotes for a picture — its `m`, by construction. */
export const quotedMetres = (d: Picture) => (d.axis === 'h' ? d.hm : d.wm)
