/**
 * Tiny Island — what the page puts on the map for this visitor alone: a flag
 * on every building they have finished, and today's balloon over the day's
 * building. Made here as the engine's own nodes (lib/island/scene), drawn
 * over everything else, and moved by the island's own keyframes.
 */
import type { Anim, Node } from './scene'

const INK = '#1b2340'
const loop = (kf: string, dur: number, org: [number, number], ref: [number, number]): Anim => ({ kf, dur, delay: 0, ease: 'ease-in-out', iter: Infinity, dir: 0, fill: 0, org, ref })

/** A small flag, its pole's foot at (x, y), fluttering from the pole. */
export function flagNodes(x: number, y: number): Node[] {
  return [{
    k: 'g',
    kids: [
      { k: 'v', d: `M${x} ${y}v-30`, st: { f: null, s: INK, w: 2.2 } },
      // .flutter: round the middle of its own left edge (fill-box, 0 50%).
      { k: 'v', d: `M${x} ${y - 30}l18 5l-18 6z`, st: { f: '#ff4f6e', s: INK, w: 1.6, join: 'round' }, a: [loop('isl-flutter', 1.2, [x, y - 24.5], [18, 11])] },
    ],
  }]
}

/** Today's balloon: tied above (x, top), bobbing, with its label. */
export function balloonNodes(x: number, top: number): Node[] {
  const y = top - 70
  const stroke = (d: string, w: number, extra: object = {}): Node => ({ k: 'v', d, st: { f: null, s: INK, w, ...extra } })
  return [{
    k: 'g',
    kids: [
      stroke(`M${x} ${y + 44}C${x - 6} ${y + 70} ${x + 6} ${y + 80} ${x} ${top + 10}`, 1.4, { dash: [3, 4] }),
      {
        k: 'g',
        a: [loop('isl-bob', 3.6, [0, 0], [0, 0])],
        kids: [
          { k: 'v', d: `M${x - 26} ${y - 8}a26 28 0 1 1 52 0c0 15-11 24-17 30h-18c-6-6-17-15-17-30z`, st: { f: '#ff4f6e', s: INK, w: 2.2 } },
          { k: 'v', d: `M${x - 8} ${y - 34}c-7 26-5 46 0 56M${x + 8} ${y - 34}c7 26 5 46 0 56`, st: { f: null, s: '#ffffff', w: 5 } },
          stroke(`M${x - 9} ${y + 22}l3 9M${x + 9} ${y + 22}l-3 9`, 1.6),
          { k: 'v', d: rect(x - 8, y + 30, 16, 12, 3), st: { f: '#b8a1ff', s: INK, w: 2 } },
          { k: 'v', d: rect(x - 30, y - 62, 60, 18, 9), st: { f: '#4fe3c1', s: INK, w: 2 } },
          { k: 'txt', s: 'TODAY', x, y: y - 49, font: '700 11px Fredoka, sans-serif', fill: INK, anchor: 'center', bl: 'alphabetic' },
        ],
      },
    ],
  }]
}

/** A rounded rectangle as path data. */
function rect(x: number, y: number, w: number, h: number, r: number) {
  return `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}z`
}
