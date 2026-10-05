/**
 * bench-island — how fast the homepage island moves, in a real browser.
 *
 * The island is drawn on a canvas every frame (src/lib/island/engine.ts), so
 * what decides whether it moves smoothly is how much each frame asks of the
 * canvas. New art or a new feature can quietly make that more, and an island
 * left alone always looks fine: the trouble only shows while it is dragged.
 * So this drags it, in headless Chrome, and fails when it cannot keep up:
 *
 *   1. On a laptop-sized window (1280 × 800): left alone, then dragged round
 *      in circles for three seconds. Either below 45 frames a second fails.
 *   2. Its canvas calls at five views (the whole island, the opening view,
 *      closer in, closest, and the whole island at night). Each frame's calls
 *      are what a phone's main thread pays for, a few microseconds apiece, so
 *      a view over its budget fails, on any machine, however fast.
 *   3. On a phone-sized screen (390 × 844, three pixels to the point, touch)
 *      with the CPU slowed down (2× unless --cpu says otherwise): dragged with
 *      a finger. Below 40 a second is a warning, not a failure, since how
 *      slow "slowed down" is depends on the machine this runs on.
 *
 *   node scripts/bench-island.mjs                serves the build (dist/client; npm run build first)
 *   node scripts/bench-island.mjs --url <url>    a running or deployed site instead
 *   node scripts/bench-island.mjs --cpu 4        slow the phone CPU down more
 *   node scripts/bench-island.mjs --strict       fail, rather than skip, without Chrome
 *
 * It finds Chrome (or Edge, or Chromium) where they usually are, or at
 * CHROME_PATH. The numbers come from the page's own ?perf hooks (perf.ts),
 * which exist only with ?perf in the address.
 */
import { spawn, execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const args = process.argv.slice(2)
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined }
const STRICT = args.includes('--strict')
const CPU = Number(opt('--cpu') ?? 2)

/** Frames a second below which a drag or an idle island fails, and the phone's warning line. */
const MIN_FPS = 45
const PHONE_WARN = 40
/**
 * Canvas calls a frame, at most, at each view: about 30% above what the
 * island needed when these were set (1351, 1330, 636, 158 and 1465 in
 * October 2026; after the art pass added rings on the water and people
 * walking in front of buildings, 1480, 1368, 707, 183 and 1603), so ordinary
 * new art fits and a slip (a thousand shapes left as outlines, every tree a
 * sprite of its own) does not.
 */
const BUDGET = { whole: 1750, opening: 1750, closer: 850, closest: 320, night: 1900 }

const root = fileURLToPath(new URL('../', import.meta.url))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let failures = 0, warnings = 0
const fail = (m) => { failures++; console.log(`  FAIL  ${m}`) }
const warn = (m) => { warnings++; console.log(`  warn  ${m}`) }
const ok = (m) => console.log(`  ok    ${m}`)

/* ---- a browser ------------------------------------------------------------ */
function findChrome() {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH
  const local = process.env.LOCALAPPDATA ?? ''
  const spots = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    join(local, 'Google/Chrome/Application/chrome.exe'),
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ]
  for (const p of spots) if (existsSync(p)) return p
  for (const name of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge']) {
    try { const p = execFileSync('which', [name], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); if (p) return p } catch {}
  }
  return null
}

/* ---- the built site, served -------------------------------------------- */
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2', '.txt': 'text/plain', '.xml': 'application/xml', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon' }
function serve(dir) {
  const server = createServer(async (req, res) => {
    let f = join(dir, decodeURIComponent(new URL(req.url, 'http://x').pathname))
    try { if ((await stat(f)).isDirectory()) f = join(f, 'index.html') } catch {}
    try { const b = await readFile(f); res.writeHead(200, { 'content-type': TYPES[extname(f)] ?? 'application/octet-stream' }); res.end(b) }
    catch { res.writeHead(404); res.end('not found') }
  })
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r(server)))
}

/* ---- Chrome, over its debugging socket -------------------------------- */
async function launch(exe) {
  const port = 9300 + Math.floor(Math.random() * 600)
  const profile = mkdtempSync(join(tmpdir(), 'bench-island-'))
  const proc = spawn(exe, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--window-size=1280,800', '--no-first-run', '--no-default-browser-check', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--mute-audio', 'about:blank'], { stdio: 'ignore' })
  let tabs = []
  for (let i = 0; i < 75 && !tabs.length; i++) { try { tabs = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).filter((t) => t.type === 'page') } catch {} if (!tabs.length) await sleep(200) }
  if (!tabs.length) { proc.kill(); throw new Error('Chrome started but never opened a page') }
  const ws = new WebSocket(tabs[0].webSocketDebuggerUrl)
  await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j) })
  let id = 0
  const pending = new Map()
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
  const ev = async (expression) => {
    const m = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (m.result?.exceptionDetails) throw new Error(m.result.exceptionDetails.exception?.description ?? m.result.exceptionDetails.text)
    return m.result?.result?.value
  }
  await send('Page.enable')
  // A fresh visit every time: the island keeps its view for the visit, in sessionStorage.
  await send('Page.addScriptToEvaluateOnNewDocument', { source: 'try { sessionStorage.removeItem("isl-view") } catch (e) {}' })
  return { send, ev, close: () => { try { ws.close() } catch {} proc.kill(); setTimeout(() => { try { rmSync(profile, { recursive: true, force: true }) } catch {} }, 500) } }
}

/* ---- in the page ------------------------------------------------------- */
// Frame gaps by requestAnimationFrame, and the engine's own drawing time for each.
const START = `(() => { const b = window.__b = { gaps: [], ms: [], last: 0, on: true }; (function f(t) { if (!b.on) return; if (b.last) { b.gaps.push(t - b.last); const s = window.__island.stats(); if (s) b.ms.push(s.ms) } b.last = t; requestAnimationFrame(f) })(performance.now()); return 1 })()`
const STOP = `(() => { const b = window.__b; b.on = false; const a = b.gaps.slice(2).sort((x, y) => x - y), n = a.length; if (!n) return null; const sum = a.reduce((s, x) => s + x, 0); const ms = b.ms.slice(2); return { fps: n * 1000 / sum, p95: a[Math.floor(n * 0.95)], worst: a[n - 1], slow: a.filter((x) => x > 1000 / 45 + 0.5).length, n, draw: ms.reduce((s, x) => s + x, 0) / Math.max(1, ms.length) } })()`

async function open(page, url, { w, h, dpr = 1, mobile = false }) {
  await page.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dpr, mobile })
  await page.send('Emulation.setTouchEmulationEnabled', { enabled: mobile, maxTouchPoints: mobile ? 5 : 1 })
  await page.send('Page.navigate', { url })
  for (let i = 0; i < 150; i++) {
    await sleep(200)
    const ready = await page.ev('!!(window.__island && window.__island.stats() && window.__island.sharp())').catch(() => false)
    if (ready) { await sleep(2600); return true } // the buildings drop in and the camera settles
  }
  return false
}

/** Drag round a circle for ms, with the mouse or a finger, and what the frames did. */
async function drag(page, { w, h, touch = false, ms = 3000 }) {
  const cx = w / 2, cy = h / 2, rx = Math.min(220, w * 0.3), ry = Math.min(150, h * 0.18)
  const at = (k) => ({ x: cx + Math.cos(k) * rx - rx, y: cy + Math.sin(k) * ry })
  const p0 = at(0)
  if (touch) await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p0.x, y: p0.y }] })
  else await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p0.x, y: p0.y, button: 'left', buttons: 1, clickCount: 1 })
  await page.ev(START)
  const t0 = Date.now()
  let p = p0
  while (Date.now() - t0 < ms) {
    p = at(((Date.now() - t0) / ms) * Math.PI * 2)
    if (touch) await page.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: p.x, y: p.y }] })
    else await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y, button: 'left', buttons: 1 })
    await sleep(8)
  }
  const r = await page.ev(STOP)
  if (touch) await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  else await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', clickCount: 1 })
  await sleep(1200)
  return r
}
async function idle(page, ms = 3000) { await page.ev(START); await sleep(ms); return page.ev(STOP) }

/** The calls a frame at a view: the most over a second of frames (things move), and the drawing time. */
async function callsAt(page, x, y, n, time = 'day') {
  await page.ev(`window.__island.time(${JSON.stringify(time)}), window.__island.jump(${x}, ${y}, ${n}), 1`)
  for (let i = 0; i < 100; i++) { await sleep(150); if (await page.ev('window.__island.sharp()')) break }
  await sleep(400)
  return page.ev(`new Promise((done) => { const out = { calls: 0, images: 0, paths: 0, ms: [] }; let k = 0; (function f() { const s = window.__island.stats(); if (s.calls > out.calls) Object.assign(out, { calls: s.calls, images: s.images, paths: s.paths, texts: s.texts, transforms: s.transforms }); out.ms.push(s.ms); if (++k < 60) requestAnimationFrame(f); else done({ ...out, ms: out.ms.reduce((a, b) => a + b, 0) / out.ms.length, level: s.level, canvas: s.w + '×' + s.h }) })() })`)
}

const fmt = (r) => `${r.fps.toFixed(1)} fps (slowest frames ${r.p95.toFixed(1)} ms at the 95th percentile, ${r.worst.toFixed(1)} worst; drawing ${r.draw.toFixed(2)} ms a frame)`

/* ---- the run ------------------------------------------------------------- */
const exe = findChrome()
if (!exe) {
  const msg = 'Chrome, Edge or Chromium not found (set CHROME_PATH): the island was not timed.'
  if (STRICT) { console.log(`  FAIL  ${msg}`); process.exit(1) }
  console.log(`  skip  ${msg}`); process.exit(0)
}
let server = null, base = opt('--url')
if (!base) {
  // The Vercel adapter puts the static site in dist/client; a plain static build in dist.
  const dist = existsSync(join(root, 'dist', 'client', 'index.html')) ? join(root, 'dist', 'client') : join(root, 'dist')
  if (!existsSync(join(dist, 'index.html'))) { console.log('  FAIL  no dist/index.html: run `npm run build` first, or pass --url'); process.exit(1) }
  server = await serve(dist)
  base = `http://127.0.0.1:${server.address().port}/`
}
const url = new URL('?perf', base).href
console.log(`bench-island: ${url}\n  in ${exe}`)
const page = await launch(exe)
try {
  console.log('\na laptop window, 1280 × 800')
  const W = 1280, H = 800
  if (!(await open(page, url, { w: W, h: H }))) throw new Error('the island never finished loading')
  const still = await idle(page)
  ;(still.fps >= MIN_FPS ? ok : fail)(`left alone: ${fmt(still)}`)
  const dragged = await drag(page, { w: W, h: H })
  ;(dragged.fps >= MIN_FPS ? ok : fail)(`dragged: ${fmt(dragged)}`)

  console.log('\ncanvas calls a frame, against each view\'s budget')
  const geo = await page.ev('({ b: window.__island.bounds, a: window.__island.anchors })')
  const [bx, by, bw, bh] = geo.b, cx = bx + bw / 2
  // The busiest close view: the building with the most others round it.
  const lm = Object.values(geo.a).map((a) => ({ x: (a.x0 + a.x1) / 2, y: (a.y0 + a.y1) / 2 }))
  const busy = lm.map((p) => ({ p, k: lm.filter((q) => Math.hypot(q.x - p.x, q.y - p.y) < 260).length })).sort((a, b) => b.k - a.k)[0].p
  const views = [
    ['whole', 'the whole island', cx, by + bh * 0.56, 1, 'day'],
    ['opening', 'the opening view', cx, by + bh * 0.54, 1.6, 'day'],
    ['closer', 'closer in, on the busiest corner', busy.x, busy.y, 3, 'day'],
    ['closest', 'as close as it goes, there', busy.x, busy.y, 7, 'day'],
    ['night', 'the whole island at night', cx, by + bh * 0.56, 1, 'night'],
  ]
  for (const [key, name, x, y, n, time] of views) {
    const r = await callsAt(page, x, y, n, time)
    const line = `${name}: ${r.calls} calls (${r.images} images, ${r.paths} shapes, ${r.texts} lettering, ${r.transforms} moves), drawn in ${r.ms.toFixed(2)} ms; budget ${BUDGET[key]}`
    ;(r.calls <= BUDGET[key] ? ok : fail)(line)
  }

  console.log(`\na phone, 390 × 844 at 3× (touch, CPU ${CPU}× slower)`)
  await page.send('Emulation.setCPUThrottlingRate', { rate: 1 })
  if (!(await open(page, url, { w: 390, h: 844, dpr: 3, mobile: true }))) throw new Error('the island never finished loading on the phone')
  await page.send('Emulation.setCPUThrottlingRate', { rate: CPU })
  const finger = await drag(page, { w: 390, h: 844, touch: true })
  await page.send('Emulation.setCPUThrottlingRate', { rate: 1 })
  ;(finger.fps >= PHONE_WARN ? ok : warn)(`dragged with a finger: ${fmt(finger)}`)
} catch (e) {
  fail(String(e?.message ?? e))
} finally {
  page.close()
  server?.close()
}
console.log(`\n${failures ? `${failures} failed` : 'all passed'}${warnings ? `, ${warnings} warning${warnings > 1 ? 's' : ''}` : ''}.`)
process.exit(failures ? 1 : 0)
