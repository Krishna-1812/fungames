import assert from 'node:assert/strict'
import worker from '../worker/fusion-worker.js'
import { pairKey } from '../src/lib/fusion-pair.js'
import { RECIPES, LOCAL } from '../src/lib/fusion-recipes.js'
import { loadState, restoreState, saveState } from '../src/lib/fusion-state.js'

const discovered = { text: 'Glass', emoji: '🪟' }
const migrated = restoreState({ items: [discovered, discovered, null, { text: 42 }], recipes: { 'fire+sand': discovered } })
assert.equal(migrated.items.length, 5)
assert.ok(migrated.items.some((i) => i.text === 'Glass'))
assert.deepEqual(migrated.recipes, {})
let saved
assert.equal(saveState({ setItem(_, value) { saved = value } }, migrated), true)
assert.deepEqual(loadState({ getItem() { return saved } }), migrated)
const blockedStorage = { getItem() { throw new Error('denied') }, setItem() { throw new Error('full') } }
assert.equal(loadState(blockedStorage).items.length, 4)
assert.equal(saveState(blockedStorage, migrated), false)
assert.equal(loadState({ getItem() { return '{broken' } }).items.length, 4)
const cacheKey = pairKey('Fire', 'Sand')
assert.deepEqual(restoreState({ version: 2, items: [], recipes: { [cacheKey]: discovered, '__proto__': {}, bad: discovered } }).recipes, { [cacheKey]: discovered })

assert.equal(RECIPES.length, 36)
assert.equal(Object.keys(LOCAL).length, RECIPES.length, 'duplicate recipe pair')
for (const [a, b, text] of RECIPES) {
  assert.equal(LOCAL[pairKey(a, b)].text, text)
  assert.equal(LOCAL[pairKey(b.toUpperCase(), ` ${a} `)].text, text)
}
const reached = new Set(['earth', 'fire', 'water', 'wind'])
let previous
do {
  previous = reached.size
  for (const [a, b, text] of RECIPES) {
    if (reached.has(a) && reached.has(b)) reached.add(text.toLowerCase())
  }
} while (reached.size !== previous)
for (const [, , text] of RECIPES) assert.ok(reached.has(text.toLowerCase()), `unreachable: ${text}`)
assert.notEqual(pairKey('a|b', 'c'), pairKey('a', 'b|c'))
assert.notEqual(pairKey('a+b', 'c'), pairKey('a', 'b+c'))

const edge = new Map(), kv = new Map(), pending = []
let calls = 0
globalThis.caches = { default: {
  async match(request) { return edge.get(request.url)?.clone() },
  async put(request, response) { edge.set(request.url, response.clone()) },
} }
const env = {
  ALLOWED_ORIGINS: 'https://games.test,https://other.test',
  FUSION: { async get(key) { return kv.get(key) }, async put(key, value) { kv.set(key, JSON.parse(value)) } },
  AI: { async run() { calls++; return { response: '{"result":"Cloud","emoji":"☁️"}' } } },
}
const ctx = { waitUntil(promise) { pending.push(promise) } }
async function request(headers = { origin: 'https://games.test' }, first = 'Water', second = 'Wind', method = 'GET') {
  const response = await worker.fetch(new Request(`https://api.test/api/fusion/pair?first=${encodeURIComponent(first)}&second=${encodeURIComponent(second)}`, { headers, method }), env, ctx)
  await Promise.all(pending.splice(0))
  return response
}
for (const headers of [
  {}, { referer: 'not a URL' }, { origin: 'null' },
  { referer: 'https://games.test.evil.invalid/fusion/' },
  { referer: 'https://games.test@evil.invalid/fusion/' },
  { origin: 'https://evil.invalid', referer: 'https://games.test/fusion/' },
]) assert.equal((await request(headers)).status, 403)
assert.equal(calls, 0, 'denied requests must not spend model calls')
assert.equal((await request(undefined, '', 'Fire')).status, 400)
assert.equal((await request(undefined, 'a'.repeat(61), 'Fire')).status, 400)
assert.equal((await request(undefined, 'Water', 'Wind', 'POST')).status, 405)
assert.equal((await request(undefined, 'Water', 'Wind', 'OPTIONS')).status, 204)
const first = await request()
assert.equal(first.headers.get('access-control-allow-origin'), 'https://games.test')
assert.deepEqual(await first.json(), { result: 'Cloud', emoji: '☁️' })
const second = await request({ origin: 'https://other.test' }, 'wind', 'water')
assert.equal(second.headers.get('access-control-allow-origin'), 'https://other.test')
assert.deepEqual(await second.json(), { result: 'Cloud', emoji: '☁️' })
assert.equal(calls, 1, 'reversed pair must reuse edge answer')
edge.clear()
assert.equal((await request({ referer: 'https://games.test/fusion/' })).status, 200)
assert.equal(calls, 1, 'KV must survive an edge miss')
await request(undefined, 'a|b', 'c')
await request(undefined, 'a', 'b|c')
assert.equal(calls, 3, 'delimiter-containing pairs must not collide')
env.AI.run = async () => ({ response: '{"result":{},"emoji":42}' })
assert.equal((await request(undefined, 'Bad', 'Shape')).status, 502)
env.AI.run = async () => { throw new Error('offline') }
assert.equal((await request(undefined, 'No', 'Network')).status, 502)
console.log('Fusion: 36 recipes reachable in both orders; origin, validation, cache and failure regressions passed.')
