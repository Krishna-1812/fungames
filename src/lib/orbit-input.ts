export type Aim = { x0: number; y0: number; x1: number; y1: number }

/** Moving a launch point preserves velocity, including at the world edges. */
export function adjustAim(aim: Aim, direction: [number, number], velocity: boolean, w: number, h: number): Aim {
  const [dx, dy] = direction
  if (velocity) {
    const clamp = (n: number) => Math.max(-300, Math.min(300, n))
    return { ...aim, x1: aim.x0 + clamp(aim.x1 - aim.x0 + dx * 5), y1: aim.y0 + clamp(aim.y1 - aim.y0 + dy * 5) }
  }
  const x0 = Math.max(0, Math.min(w, aim.x0 + dx * 10))
  const y0 = Math.max(0, Math.min(h, aim.y0 + dy * 10))
  return { x0, y0, x1: aim.x1 + x0 - aim.x0, y1: aim.y1 + y0 - aim.y0 }
}
