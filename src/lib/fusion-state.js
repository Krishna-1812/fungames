export const KEY = 'fusion:v1'
export const SEED = [
  { text: 'Water', emoji: '💧' }, { text: 'Fire', emoji: '🔥' },
  { text: 'Earth', emoji: '🌍' }, { text: 'Wind', emoji: '🌬️' },
]

export function validItem(item) {
  return item && typeof item.text === 'string' && item.text.trim().length > 0 &&
    item.text.length <= 60 && typeof item.emoji === 'string' && item.emoji.length <= 32
}

export function restoreState(raw) {
  const items = new Map(SEED.map((item) => [item.text.toLowerCase(), { ...item }]))
  const recipes = {}
  if (raw && Array.isArray(raw.items)) {
    for (const item of raw.items) {
      if (validItem(item)) items.set(item.text.trim().toLowerCase(), { text: item.text.trim(), emoji: item.emoji })
    }
    // Old '+' keys cannot be migrated unambiguously. Keep earned items and
    // rebuild only the recipe cache as pairs are tried again.
    if (raw.version === 2 && raw.recipes && typeof raw.recipes === 'object') {
      for (const [key, item] of Object.entries(raw.recipes)) {
        try {
          const pair = JSON.parse(key)
          if (Array.isArray(pair) && pair.length === 2 && pair.every((s) => typeof s === 'string') && validItem(item)) {
            recipes[key] = { text: item.text, emoji: item.emoji }
          }
        } catch { /* Discard only the invalid cache entry. */ }
      }
    }
  }
  return { items: [...items.values()], recipes }
}

export function loadState(storage) {
  try { return restoreState(JSON.parse(storage.getItem(KEY) || 'null')) }
  catch { return restoreState(null) }
}

export function saveState(storage, state) {
  try { storage.setItem(KEY, JSON.stringify({ ...state, version: 2 })); return true }
  catch { return false }
}
