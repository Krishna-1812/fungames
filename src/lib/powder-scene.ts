import { createWorld, type World } from './powder-sim'
import { MATERIALS, REACTIONS } from './powder-rules'

export const POWDER_SAVE = 'powder.experiment.v1'
export type Experiment = { v: 1; w: number; h: number; frame: number; grid: number[]; life: number[]; shade: number[]; fired: string[] }
export function captureExperiment(world: World): Experiment {
  return { v: 1, w: world.w, h: world.h, frame: world.frame,
    grid: Array.from(world.grid), life: Array.from(world.life), shade: Array.from(world.shade), fired: [...world.fired] }
}
export function readExperiment(raw: unknown): Experiment | null {
  if (!raw || typeof raw !== 'object') return null
  const s = raw as Experiment
  if (s.v !== 1 || !Number.isInteger(s.w) || !Number.isInteger(s.h) || s.w < 80 || s.w > 340 || s.h < 60 || s.h > 250
    || !Number.isSafeInteger(s.frame) || s.frame < 0) return null
  const n = s.w * s.h
  const bytes = (a: unknown): a is number[] => Array.isArray(a) && a.length === n && a.every(x => Number.isInteger(x) && x >= 0 && x <= 255)
  if (!bytes(s.grid) || !bytes(s.life) || !bytes(s.shade)) return null
  const materials = new Set([0, ...MATERIALS.map(m => m.id)])
  if (!s.grid.every(x => materials.has(x))) return null
  const reactions = new Set(REACTIONS.map(r => r.id))
  if (!Array.isArray(s.fired) || s.fired.length > reactions.size || !s.fired.every(x => reactions.has(x))) return null
  return { v: 1, w: s.w, h: s.h, frame: s.frame, grid: [...s.grid], life: [...s.life], shade: [...s.shade], fired: [...new Set(s.fired)] }
}
export function restoreExperiment(scene: Experiment, rand: () => number = Math.random): World {
  const world = createWorld(scene.w, scene.h, rand)
  world.grid.set(scene.grid); world.life.set(scene.life); world.shade.set(scene.shade)
  world.frame = scene.frame; world.fired = new Set(scene.fired)
  return world
}
