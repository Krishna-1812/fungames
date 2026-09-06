import { makeBody, MAX_BODIES, type Body } from './orbit-sim'

export const SCENE_KEY = 'orbit.scene.v1'
export type Scene = {
  v: 1; w: number; h: number; trails: boolean; mass: number
  bodies: number[][]
}
const finite = (n: unknown, limit: number) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= limit

/** Treat browser storage and URL fragments as untrusted input. */
export function readScene(raw: unknown): Scene | null {
  if (!raw || typeof raw !== 'object') return null
  const s = raw as Scene
  if (s.v !== 1 || !finite(s.w, 10000) || !finite(s.h, 10000) || s.w < 8 || s.h < 8 ||
      typeof s.trails !== 'boolean' || ![6, 30, 260].includes(s.mass) ||
      !Array.isArray(s.bodies) || s.bodies.length > MAX_BODIES) return null
  for (const row of s.bodies) {
    if (!Array.isArray(row) || row.length !== 6 ||
        !row.slice(0, 2).every((n) => finite(n, 100000)) ||
        !row.slice(2, 4).every((n) => finite(n, 10000)) ||
        !finite(row[4], 1e8) || row[4] <= 0 || ![0, 1].includes(row[5])) return null
  }
  return { v: 1, w: s.w, h: s.h, trails: s.trails, mass: s.mass, bodies: s.bodies.map((row) => [...row]) }
}

export function captureScene(bodies: Body[], w: number, h: number, trails: boolean, mass: number): Scene {
  return { v: 1, w, h, trails, mass, bodies: bodies.map((b) => [b.x, b.y, b.vx, b.vy, b.m, Number(b.mine)]) }
}

export function sceneBodies(scene: Scene, shared = false): Body[] {
  // A friend's launch must not become your own earned challenge progress.
  return scene.bodies.map(([x, y, vx, vy, mass, mine]) => makeBody(x, y, vx, vy, mass, !shared && mine === 1))
}

export function encodeScene(scene: Scene): string | null {
  if (!readScene(scene)) return null
  const code = btoa(JSON.stringify(scene)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
  return code.length <= 8000 ? code : null
}

export function decodeScene(code: string): Scene | null {
  if (!code || code.length > 8000 || !/^[A-Za-z0-9_-]+$/.test(code)) return null
  try { return readScene(JSON.parse(atob(code.replaceAll('-', '+').replaceAll('_', '/')))) }
  catch { return null }
}

/** Letterbox the world instead of stretching its physics during a resize. */
export function fitScene(w: number, h: number, viewportW: number, viewportH: number) {
  const scale = Math.min(viewportW / w, viewportH / h)
  return { scale, left: (viewportW - w * scale) / 2, top: (viewportH - h * scale) / 2 }
}
