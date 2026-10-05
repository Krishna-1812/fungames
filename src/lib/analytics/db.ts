/**
 * Analytics: the database.
 *
 * Neon Postgres in production (Vercel's Storage tab connects it and sets
 * DATABASE_URL). In `astro dev`, with no DATABASE_URL, PGlite (Postgres
 * compiled to WebAssembly) keeps the same tables in node_modules/.cache/funsite-pglite (outside what the dev server watches), so the
 * endpoints and the admin page can be tried without an account. The checker
 * hands `useDb()` an in-memory PGlite and runs the real SQL.
 *
 * Two tables:
 *
 * - `views`: one row per page load, with everything known about where it
 *   came from and what it ran on. Its engaged time, scroll depth and
 *   last-seen are brought up to date as the page sends more.
 * - `events`: one row per thing done on the page, pointing at its view.
 *
 * and `salts`, one random value per day for the daily hash, dropped the day
 * after, so last week's hashes cannot be recomputed by anyone.
 */

export type Db = { query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]> }

let db: Db | null = null
let ready: Promise<void> | null = null

/** Point the module at a database (the checker does). */
export function useDb(d: Db | null) {
  db = d
  ready = null
}

/** A server environment variable (there is no `process` in a browser, and none is needed there). */
export const env = (k: string): string | undefined => (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env[k]

/** Whether a database is configured at all (for /api/health/). */
export const hasDb = () => !!(db || env('DATABASE_URL') || env('POSTGRES_URL') || import.meta.env?.DEV)

async function connect(): Promise<Db> {
  const url = env('DATABASE_URL') || env('POSTGRES_URL')
  if (url) {
    const { neon } = await import('@neondatabase/serverless')
    const sql = neon(url)
    return { query: (text, params = []) => sql.query(text, params) as unknown as Promise<never> }
  }
  if (import.meta.env?.DEV) {
    // Named at run time so the bundler leaves PGlite (18 MB of WebAssembly,
    // a dev-only dependency) alone; astro.config.mjs keeps it out of the function.
    const name = ['@electric-sql', 'pglite'].join('/')
    const { PGlite } = (await import(/* @vite-ignore */ name)) as typeof import('@electric-sql/pglite')
    const pg = new PGlite('./node_modules/.cache/funsite-pglite')
    return { query: async (text, params = []) => (await pg.query(text, params)).rows as never }
  }
  throw new Error('no-db')
}

export const SCHEMA = [
  `create table if not exists views (
    pid text primary key,
    ts timestamptz not null default now(),
    seen timestamptz not null default now(),
    vid text,
    dh text not null,
    test boolean not null default false,
    consent text,
    path text not null,
    game text,
    title text,
    status smallint,
    ref_host text, ref_path text, from_path text, sref text,
    utm_source text, utm_medium text, utm_campaign text,
    country text, region text, city text, lat real, lon real,
    device text, os text, browser text, bver text,
    sw smallint, sh smallint, vw smallint, vh smallint, dpr real, touch boolean,
    lang text, tz text, dark boolean, rm boolean, conn text, mem real, cpu smallint,
    first_days integer, games_seen smallint, visit_days integer,
    engaged_ms integer not null default 0,
    scroll smallint not null default 0
  )`,
  `create index if not exists views_ts on views (ts)`,
  `create index if not exists views_seen on views (seen)`,
  `create index if not exists views_vid on views (vid) where vid is not null`,
  `create table if not exists events (
    id bigserial primary key,
    pid text not null,
    ts timestamptz not null,
    name text not null,
    game text,
    props jsonb not null default '{}'
  )`,
  `create index if not exists events_ts on events (ts)`,
  `create index if not exists events_name_ts on events (name, ts)`,
  `create index if not exists events_pid on events (pid)`,
  `create table if not exists salts (day date primary key, salt text not null)`,
]

/** The database, with its tables made if they are not there yet (once per process). */
export async function getDb(): Promise<Db> {
  if (!db) db = await connect()
  const d = db
  if (!ready) {
    ready = (async () => { for (const s of SCHEMA) await d.query(s) })()
    ready.catch(() => { ready = null })
  }
  await ready
  return d
}

/* ---- the daily hash --------------------------------------------------- */

let saltCache: { day: string; salt: string } | null = null

function randomHex(bytes: number) {
  const a = new Uint8Array(bytes)
  crypto.getRandomValues(a)
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function sha256(s: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Today's salt (UTC day), made once by whichever request comes first; older ones are dropped. */
export async function todaysSalt(d: Db, now = new Date()): Promise<string> {
  const day = now.toISOString().slice(0, 10)
  if (saltCache?.day === day) return saltCache.salt
  await d.query('insert into salts (day, salt) values ($1, $2) on conflict (day) do nothing', [day, randomHex(16)])
  const [row] = await d.query<{ salt: string }>('select salt from salts where day = $1', [day])
  await d.query('delete from salts where day < $1', [day])
  saltCache = { day, salt: row.salt }
  return row.salt
}

/**
 * A visitor with no ID, counted for one day: the same address and browser
 * give the same 16 characters until midnight UTC, and nothing at all after.
 */
export async function dailyHash(d: Db, ip: string, ua: string, now = new Date()) {
  return (await sha256(`${await todaysSalt(d, now)}|${ip}|${ua}`)).slice(0, 16)
}
