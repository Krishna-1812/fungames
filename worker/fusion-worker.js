/**
 * Fusion pair API — a Cloudflare Worker.
 *
 * This is a faithful copy of the architecture neal.fun actually uses for
 * Infinite Craft, which I confirmed by measuring the live endpoint:
 *
 *   GET /api/infinite-craft/pair?first=Earth&second=Water
 *   -> {"result":"Plant","emoji":"🌱","isNew":false}
 *   cache-control: public, max-age=86400, s-maxage=259200
 *   cf-cache-status: HIT   age: 45501
 *
 * Three things make it cheap enough to run at millions of plays:
 *
 *  1. Determinism. The pair is normalised and sorted, so "Fire+Water" and
 *     "Water+Fire" are one key and every player on Earth gets the same answer.
 *  2. A persistent store. Once a pair is resolved it is written to KV and the
 *     model is never asked about it again.
 *  3. Long edge caching. Requests are answered from the Cloudflare cache
 *     before they even reach this code, so the vast majority cost nothing.
 *
 * The model is therefore only ever hit on a genuinely novel pair, which is a
 * tiny and shrinking fraction of traffic.
 */

const ALLOWED_ORIGINS = [
  'https://example.com',
  'https://www.example.com',
  'http://localhost:4321', // astro dev
]

const BROWSER_TTL = 86_400 // 1 day
const EDGE_TTL = 259_200 // 3 days

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') return preflight(request)
    if (request.method !== 'GET') return text('Method not allowed', 405)
    if (!url.pathname.endsWith('/pair')) return text('Not found', 404)

    // Referer/Origin gate. Same thing neal.fun does — hotlinking the endpoint
    // from another page returns 403 "Not allowed".
    if (!isAllowed(request)) return text('Not allowed', 403)

    const first = (url.searchParams.get('first') || '').trim()
    const second = (url.searchParams.get('second') || '').trim()
    if (!first || !second) return text('Missing first or second', 400)
    if (first.length > 60 || second.length > 60) return text('Too long', 400)

    // 1. Edge cache. Normalise the cache key so ordering never splits the cache.
    const key = pairKey(first, second)
    const cacheUrl = new URL(url)
    cacheUrl.search = `?pair=${encodeURIComponent(key)}`
    const cacheKey = new Request(cacheUrl.toString(), { method: 'GET' })
    const cache = caches.default

    const cached = await cache.match(cacheKey)
    if (cached) return withCors(cached, request)

    // 2. Durable store.
    let record = await env.FUSION.get(key, { type: 'json' })
    let isNew = false

    // 3. Model — only on a true miss.
    if (!record) {
      try {
        record = await ask(env, first, second)
      } catch (err) {
        return text('Upstream unavailable', 502)
      }
      if (!record) return text('Upstream unavailable', 502)

      isNew = true
      // Write behind the response so the player never waits on the store.
      ctx.waitUntil(env.FUSION.put(key, JSON.stringify(record)))
    }

    const body = JSON.stringify({ result: record.result, emoji: record.emoji, isNew })
    const res = new Response(body, {
      headers: {
        'content-type': 'application/json',
        'cache-control': `public, max-age=${BROWSER_TTL}, s-maxage=${EDGE_TTL}`,
      },
    })
    ctx.waitUntil(cache.put(cacheKey, res.clone()))
    return withCors(res, request)
  },
}

/** Order-independent, case-insensitive key so the world shares one answer. */
function pairKey(a, b) {
  return [a.toLowerCase(), b.toLowerCase()].sort().join('|')
}

function isAllowed(request) {
  const ref = request.headers.get('referer') || request.headers.get('origin') || ''
  return ALLOWED_ORIGINS.some((o) => ref.startsWith(o))
}

/**
 * Ask the model for a single combined noun plus one emoji.
 * Uses Workers AI when the binding exists, otherwise any OpenAI-compatible
 * endpoint via LLM_BASE_URL + LLM_API_KEY + LLM_MODEL.
 */
async function ask(env, first, second) {
  const system =
    'You combine two things into one new thing, like an alchemy game. ' +
    'Reply with ONLY compact JSON: {"result":"<Thing>","emoji":"<one emoji>"}. ' +
    'The result must be a single common noun in Title Case, at most three words. ' +
    'It must be a real, recognisable thing or concept — never a sentence, never a ' +
    'repeat of an input unless that genuinely is the answer. Be imaginative but sensible.'
  const user = `${first} + ${second}`

  let raw
  if (env.AI) {
    const out = await env.AI.run(env.AI_MODEL || '@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.2,
      max_tokens: 60,
    })
    raw = out?.response ?? ''
  } else {
    const r = await fetch(`${env.LLM_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${env.LLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.LLM_MODEL,
        temperature: 0.2,
        max_tokens: 60,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    })
    if (!r.ok) throw new Error(`llm ${r.status}`)
    const j = await r.json()
    raw = j?.choices?.[0]?.message?.content ?? ''
  }

  return parseResult(raw)
}

/** Models wrap JSON in prose and code fences often enough to plan for it. */
function parseResult(raw) {
  const match = String(raw).match(/\{[\s\S]*?\}/)
  if (!match) return null
  let obj
  try {
    obj = JSON.parse(match[0])
  } catch {
    return null
  }
  const result = String(obj.result ?? '').trim().slice(0, 60)
  const emoji = String(obj.emoji ?? '').trim().slice(0, 8)
  if (!result) return null
  return { result, emoji: emoji || '✨' }
}

function text(message, status) {
  return new Response(message, { status, headers: { 'content-type': 'text/plain' } })
}

function withCors(res, request) {
  const origin = request.headers.get('origin')
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) return res
  const out = new Response(res.body, res)
  out.headers.set('access-control-allow-origin', origin)
  out.headers.set('vary', 'origin')
  return out
}

function preflight(request) {
  const origin = request.headers.get('origin') || ''
  if (!ALLOWED_ORIGINS.includes(origin)) return text('Not allowed', 403)
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': origin,
      'access-control-allow-methods': 'GET, OPTIONS',
      'access-control-max-age': '86400',
      vary: 'origin',
    },
  })
}
