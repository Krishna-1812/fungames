import type { M } from './scene'

type Context = { setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void }

/** Avoid identical native transform calls; invalidate after restore or outside drawing. */
export function canvasTransforms(current: () => Context) {
  let context: Context | null = null, valid = false
  const matrix: M = [1, 0, 0, 1, 0, 0]
  return {
    set(next: M): boolean {
      const target = current()
      if (context === target && valid && matrix[0] === next[0] && matrix[1] === next[1] && matrix[2] === next[2] && matrix[3] === next[3] && matrix[4] === next[4] && matrix[5] === next[5]) return false
      target.setTransform(next[0], next[1], next[2], next[3], next[4], next[5])
      context = target
      // The caller may reuse and mutate its matrix for the next node.
      for (let i = 0; i < 6; i++) matrix[i] = next[i]
      valid = true
      return true
    },
    invalidate() { valid = false },
  }
}
