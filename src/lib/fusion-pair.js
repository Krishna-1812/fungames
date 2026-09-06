export function pairKey(a, b) {
  return JSON.stringify([a.trim().toLowerCase(), b.trim().toLowerCase()].sort())
}
