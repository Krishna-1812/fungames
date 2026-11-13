/**
 * Ambient Mix's twelve layers, as sound.
 *
 * Each layer id (the same ids as lib/mix-code.ts, so shared links keep
 * working) maps to a physical model in this folder. They are normalised here
 * so that every layer at full volume sits at about the same loudness — by
 * measurement, not by ear: TRIM is what scripts/check-ambient-sound.mjs
 * measures each one needs, so a model can change without the mix lurching.
 *
 * SEND is how much of each goes to the shared room (a convolution reverb on
 * the page): a clock is in a room, a café is a room, birds are outdoors but
 * not in a vacuum, and thunder echoes for miles.
 */
import { birds } from './birds'
import { cafe } from './cafe'
import { clock } from './clock'
import { crickets } from './crickets'
import type { Source, SourceCtx } from './dsp'
import { fire } from './fire'
import { modem } from './modem'
import { mower } from './mower'
import { rain } from './rain'
import { thunder } from './thunder'
import { traffic } from './traffic'
import { waves } from './waves'
import { wind } from './wind'

export const SOURCES: Record<string, (c: SourceCtx) => Source> = {
  rain, waves, wind, fire, cafe, birds, crickets, traffic, clock, thunder, mower, dial: modem,
}

/** Loudness trims, measured. See the header. */
export const TRIM: Record<string, number> = {
  rain: 6.5, waves: 1.56, wind: 1.6, fire: 2.6, cafe: 0.73, birds: 0.69,
  // Impulsive layers sit a little under the rest: a click at the common
  // loudness would be far too loud.
  crickets: 0.42, traffic: 0.56, clock: 0.6, thunder: 1, mower: 1.15, dial: 0.83,
}

/** Reverb send per layer, 0..1. */
export const SEND: Record<string, number> = {
  rain: 0.06, waves: 0.05, wind: 0.04, fire: 0.08, cafe: 0.3, birds: 0.2,
  crickets: 0.12, traffic: 0.12, clock: 0.32, thunder: 0.3, mower: 0.18, dial: 0.22,
}

/** A layer's model, trimmed to the common loudness. */
export function createSource(id: string, c: SourceCtx): Source {
  const make = SOURCES[id]
  if (!make) throw new Error(`No such layer: ${id}`)
  const src = make(c)
  const k = TRIM[id] ?? 1
  return {
    render(L, R, n, t) {
      src.render(L, R, n, t)
      if (k !== 1) for (let i = 0; i < n; i++) { L[i] *= k; R[i] *= k }
    },
    state: src.state ? () => src.state!() : undefined,
  }
}

export { Rng } from './dsp'
export type { AmbientEvent, Source, SourceCtx } from './dsp'
