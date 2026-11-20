/**
 * Earth Reviews — how each phenomenon is packed.
 *
 * A shop photographs what it sells, and what this shop sells cannot be
 * photographed: there is no picture of Mondays. So every product is shot the
 * way a real shop shoots anything it cannot show — in its packaging. Gravity
 * comes in a heavy tin, the Ocean in a glass jar with the ocean in it,
 * Mondays in a carton, Death in a very plain black box. The label on each is
 * printed from the drawing the shop already had for it, the product's name,
 * and a line of small print saying how much is inside.
 *
 * `scripts/bake-earth-reviews.mjs` builds each label, models the pack in the
 * studio (`scripts/earth-reviews-bake/`) and writes
 * `public/earth-reviews/<id>.webp`; the page only ever shows the pictures.
 * Import-free, so the bake and its checker read it as it is.
 */

/** A carton, a tin can, or a glass jar with a screw lid. */
export type PackKind = 'box' | 'tin' | 'jar'

/** What can be seen through a jar's glass, below its label. */
export type Contents =
  | { kind: 'liquid'; colour: string; level: number }
  | { kind: 'grain'; colour: string; level: number }
  | { kind: 'glow'; colour: string }
  | { kind: 'haze'; colour: string }

export type Pack = {
  kind: PackKind
  /** Width, height and depth in the studio's units (a pack is about 1 tall); a tin or jar uses width as its diameter. */
  size: [number, number, number]
  /** The label's ground, its print, and the colour of its top band. */
  paper: string
  ink: string
  band: string
  /** A tin's metal, or a jar's lid. */
  metal?: 'steel' | 'black' | 'white'
  /** How the pack is turned toward the camera, in degrees. */
  turn: number
  /** The small print: how much is inside. */
  net: string
  contents?: Contents
}

export const PACKS: Record<string, Pack> = {
  gravity:            { kind: 'tin', size: [0.78, 0.92, 0.78], paper: '#e9edf0', ink: '#14202c', band: '#14202c', metal: 'steel', turn: -14, net: 'NET WT 9.81 m/s²' },
  'the-sun':          { kind: 'jar', size: [0.82, 1.02, 0.82], paper: '#0f1c2b', ink: '#f2f5f8', band: '#22364d', metal: 'black', turn: 8, net: '1 STAR · CLASS G2V', contents: { kind: 'glow', colour: '#ffb347' } },
  'the-moon':         { kind: 'box', size: [0.82, 1.06, 0.5], paper: '#141b2b', ink: '#e6ebf2', band: '#2b3650', turn: -22, net: '1 NATURAL SATELLITE · PHASES INCLUDED' },
  mondays:            { kind: 'box', size: [0.96, 0.78, 0.42], paper: '#f2f4f6', ink: '#1a2330', band: '#3a5a8c', turn: 18, net: '52 PER YEAR · NO PAUSE OPTION' },
  winter:             { kind: 'jar', size: [0.8, 1.0, 0.8], paper: '#eef4f8', ink: '#173048', band: '#4f7da3', metal: 'white', turn: -10, net: '1 SEASON · ABOUT 3 MONTHS', contents: { kind: 'grain', colour: '#f4f8fb', level: 0.55 } },
  mosquitoes:         { kind: 'jar', size: [0.72, 1.0, 0.72], paper: '#e8efe9', ink: '#1d2a22', band: '#2f5a44', metal: 'steel', turn: 12, net: 'APPROX. 110 TRILLION', contents: { kind: 'haze', colour: '#3a3f3a' } },
  entropy:            { kind: 'tin', size: [0.7, 1.08, 0.7], paper: '#2a2240', ink: '#efe9fb', band: '#4b3c78', metal: 'steel', turn: 20, net: 'CONTENTS ALWAYS INCREASING' },
  death:              { kind: 'box', size: [0.7, 1.08, 0.7], paper: '#0e0f11', ink: '#d8dce0', band: '#0e0f11', turn: -6, net: '1 PER CUSTOMER · FINAL SALE' },
  hiccups:            { kind: 'tin', size: [0.62, 0.74, 0.62], paper: '#e6f2f2', ink: '#173436', band: '#2c7a7b', metal: 'steel', turn: -16, net: 'AT IRREGULAR INTERVALS' },
  'jet-lag':          { kind: 'box', size: [0.66, 0.98, 0.4], paper: '#1b2440', ink: '#e7ecf7', band: '#3d4f8a', turn: 24, net: '1 PER TIME ZONE CROSSED' },
  'the-ocean':        { kind: 'jar', size: [0.84, 1.08, 0.84], paper: '#f1f6f9', ink: '#0d2c44', band: '#1f5f8a', metal: 'steel', turn: -8, net: '1.335 BILLION km³ · SOLD AS SEEN', contents: { kind: 'liquid', colour: '#1f6f9a', level: 0.62 } },
  volcanoes:          { kind: 'tin', size: [0.8, 0.86, 0.8], paper: '#1a1a1d', ink: '#eeeef0', band: '#3a3a44', metal: 'black', turn: 14, net: 'CONTENTS MAY ERUPT' },
  earthquakes:        { kind: 'box', size: [0.92, 0.9, 0.48], paper: '#ecedea', ink: '#22262a', band: '#5b6168', turn: -18, net: 'DO NOT SHAKE · ALREADY SHAKEN' },
  'black-holes':      { kind: 'tin', size: [0.76, 0.8, 0.76], paper: '#050506', ink: '#a7b0bc', band: '#050506', metal: 'black', turn: 6, net: 'MASS VARIES · NOTHING ESCAPES' },
  'static-electricity': { kind: 'box', size: [0.74, 0.86, 0.36], paper: '#eef1fb', ink: '#1b2350', band: '#4256c4', turn: 16, net: 'UP TO 25,000 VOLTS' },
  lightning:          { kind: 'jar', size: [0.74, 1.1, 0.74], paper: '#121826', ink: '#e8eefc', band: '#2b3a62', metal: 'steel', turn: -12, net: 'APPROX. 44 PER SECOND', contents: { kind: 'glow', colour: '#cfe0ff' } },
  time:               { kind: 'tin', size: [0.86, 0.66, 0.86], paper: '#f3f1ec', ink: '#1d232b', band: '#1d232b', metal: 'steel', turn: -20, net: 'ONE DIRECTION ONLY' },
  photosynthesis:     { kind: 'jar', size: [0.78, 0.96, 0.78], paper: '#f0f6ef', ink: '#183a22', band: '#2f7a45', metal: 'white', turn: 10, net: 'REQUIRES DAYLIGHT', contents: { kind: 'liquid', colour: '#4d9a52', level: 0.5 } },
  deserts:            { kind: 'jar', size: [0.76, 0.92, 0.76], paper: '#f4f2ee', ink: '#2c2620', band: '#6b6255', metal: 'steel', turn: -14, net: 'CONTAINS SAND', contents: { kind: 'grain', colour: '#d9b98a', level: 0.6 } },
  allergies:          { kind: 'box', size: [0.64, 0.94, 0.34], paper: '#f6f7f9', ink: '#202733', band: '#7a5cc4', turn: -24, net: 'MAY CONTAIN EVERYTHING' },
  quicksand:          { kind: 'jar', size: [0.84, 0.82, 0.84], paper: '#ecefea', ink: '#26302a', band: '#53625a', metal: 'black', turn: 18, net: 'DO NOT STAND ON CONTENTS', contents: { kind: 'grain', colour: '#a8916a', level: 0.66 } },
  'growing-old':      { kind: 'box', size: [0.8, 1.02, 0.46], paper: '#eef0f3', ink: '#1f2630', band: '#59677a', turn: 12, net: 'ONE YEAR PER YEAR' },
  rainbows:           { kind: 'box', size: [1.0, 0.7, 0.4], paper: '#f7f8fa', ink: '#1a2030', band: '#3e4c7a', turn: -16, net: '7 COLOURS, ROUGHLY' },
  fog:                { kind: 'jar', size: [0.8, 1.02, 0.8], paper: '#e9edf1', ink: '#2a3440', band: '#6f7f90', metal: 'steel', turn: 6, net: 'CONTENTS OBSCURED', contents: { kind: 'haze', colour: '#dfe6ec' } },
  snow:               { kind: 'jar', size: [0.72, 0.94, 0.72], paper: '#f3f7fa', ink: '#1b3550', band: '#3f6f9e', metal: 'white', turn: -6, net: 'NO TWO ALIKE', contents: { kind: 'grain', colour: '#f7fafc', level: 0.7 } },
  puberty:            { kind: 'box', size: [0.74, 1.0, 0.42], paper: '#f2eff8', ink: '#2a1f40', band: '#6c4fb0', turn: 20, net: 'SEVERAL CONFUSING YEARS' },
  'wisdom-teeth':     { kind: 'box', size: [0.7, 0.62, 0.42], paper: '#eef6f6', ink: '#16353a', band: '#2a8a8f', turn: -12, net: 'SET OF 4 · SPACE NOT GUARANTEED' },
  'brain-freeze':     { kind: 'tin', size: [0.64, 1.0, 0.64], paper: '#e3f1fb', ink: '#0f2d48', band: '#2f7fc0', metal: 'white', turn: 22, net: 'SERVE CHILLED' },
  'deja-vu':          { kind: 'box', size: [0.78, 0.9, 0.44], paper: '#eff1f6', ink: '#1e2438', band: '#45507e', turn: -20, net: 'YOU HAVE SEEN THIS ONE' },
  'solar-eclipse':    { kind: 'box', size: [0.9, 0.9, 0.38], paper: '#0b0d12', ink: '#e9edf3', band: '#1d2232', turn: 14, net: 'EYEWEAR SOLD SEPARATELY' },
  magnetism:          { kind: 'tin', size: [0.74, 0.86, 0.74], paper: '#eceff2', ink: '#15202c', band: '#b22a3a', metal: 'steel', turn: -10, net: 'ATTRACTS · REPELS' },
  'traffic-jams':     { kind: 'box', size: [1.02, 0.66, 0.44], paper: '#f1f2f4', ink: '#1b2027', band: '#2b4f7a', turn: 22, net: 'STATIONARY · DURATION UNKNOWN' },
}

/** The pictures the bake writes, and the page shows. */
export const packPhoto = (id: string, small = false) => `earth-reviews/${id}${small ? '-s' : ''}.webp`
