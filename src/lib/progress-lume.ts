/**
 * The colour a span of time glows in Progress's register: cold for the slow
 * ones, hot for the fast, so a still picture of the list still says which is
 * which. It came with the old ring dial, which mixed the same two constants
 * in its shader; the dial is gone and the register kept its colours.
 */
export const LUME_COLD = [0.12, 0.075, 0.36] as const
export const LUME_HOT = [1.16, 0.44, 1.02] as const

const aces = (x: number) =>
  Math.min(1, Math.max(0, (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14)))

/** The colour a ring of this rate is drawn in, as CSS. */
export function lumeCss(rate: number, gain = 1) {
  const sp = Math.min(1, Math.max(0, rate))
  const k = sp * sp * (3 - 2 * sp)
  const ch = (i: number) => {
    const lin = (LUME_COLD[i] + (LUME_HOT[i] - LUME_COLD[i]) * k) * gain
    return Math.round(Math.pow(aces(lin), 1 / 2.2) * 255)
  }
  return `rgb(${ch(0)} ${ch(1)} ${ch(2)})`
}
