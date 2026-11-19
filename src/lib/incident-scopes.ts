/**
 * Days Since Incident — the instruments behind the rows.
 *
 * Each row on the sign is one number: days since the last event at some
 * strength. These are the readings those numbers are taken from, drawn the
 * way the people who watch them draw them:
 *
 *  - Earthquakes: every M4.5+ earthquake USGS has recorded in the last
 *    thirty days, where it was, sized by magnitude and coloured by depth.
 *    Drawn on a map centred on the Pacific, they trace the plate edges on
 *    their own: the Ring of Fire is not drawn, it appears.
 *  - Solar flares: the long-band X-ray brightness of the Sun from the GOES
 *    satellite over the last week, on the log scale the A/B/C/M/X classes
 *    are cut from, each M and X flare named at its peak.
 *  - The Earth's field: the planetary Kp index every three hours for the
 *    last thirty days, each bar coloured by NOAA's G-level, and the
 *    interplanetary shocks that arrived in that time marked where they hit.
 *
 * The arithmetic is at the top (pure, checked by check-incident-scopes.mjs);
 * the drawing below it is plain canvas, redrawn when the data or the size
 * changes and never otherwise.
 */

export type Trace = { t0: number; step: number; v: (number | null)[] }
export type Quake = { lat: number; lon: number; depth: number; mag: number; time: number; place: string }

const DAY = 86_400_000

/* -------------------------------------------------------------------------- */
/* The arithmetic                                                               */
/* -------------------------------------------------------------------------- */

/** The map's middle longitude: the Pacific, so the Ring of Fire is drawn whole. */
export const MAP_LON0 = 150
/** Its top and bottom latitudes: the Arctic coasts down to the Southern Ocean. */
export const MAP_TOP = 80
export const MAP_BOTTOM = -62
/** Width over height of the map, for a picture with square degrees. */
export const MAP_ASPECT = 360 / (MAP_TOP - MAP_BOTTOM)

/** A place on a map `w` by `h`, longitudes wrapped round the Pacific middle. */
export function mapXY(lat: number, lon: number, w: number, h: number): [number, number] {
  const d = ((((lon - MAP_LON0) % 360) + 540) % 360) - 180
  return [((d + 180) / 360) * w, ((MAP_TOP - lat) / (MAP_TOP - MAP_BOTTOM)) * h]
}

const LETTERS = ['A', 'B', 'C', 'M', 'X']
/** log10 of a long-band flux in W/m² to its GOES class: -5.04 is M9.1, -3.0 is X10. */
export function goesClass(log10: number): string {
  const e = Math.floor(log10 + 1e-9)
  const i = Math.max(0, Math.min(4, e + 8))
  const v = 10 ** (log10 - (i - 8))
  return `${LETTERS[i]}${v.toFixed(1)}`
}

/** Shallow quakes in sea-green, intermediate in blue, deep ones (300 km and more) in violet. */
export function depthColour(km: number): string {
  if (km < 70) return '#5ee6c8'
  if (km < 300) return '#5b93ff'
  return '#b07cff'
}

/** NOAA's G-levels, in the page's cool palette: quiet slate, then teal, cyan, blue, violet, magenta. */
export function kpColour(kp: number): string {
  if (kp >= 9) return '#e45cff'
  if (kp >= 8) return '#9d6dff'
  if (kp >= 7) return '#4f7dff'
  if (kp >= 6) return '#38c3e6'
  if (kp >= 5) return '#2fbf9f'
  if (kp >= 4) return '#3f7593'
  return '#2b4b63'
}

/**
 * A dot's radius for a magnitude. Each whole magnitude is about 32 times
 * the energy; drawn as area that would make an M8 a continent, so the
 * radius grows 1.55 times a magnitude: an M7 reads as clearly bigger than
 * an M5 without hiding the coast under it.
 */
export const quakeRadius = (mag: number, scale = 1) => Math.max(1.2, 1.9 * 1.55 ** (mag - 4.5)) * scale

/** USGS's summary feed into quakes; anything without a place or a time is dropped. */
export function parseQuakeFeed(j: unknown): Quake[] {
  const fs = (j as { features?: unknown[] })?.features
  if (!Array.isArray(fs)) return []
  const out: Quake[] = []
  for (const f of fs as { properties?: { mag?: number; time?: number; place?: string }; geometry?: { coordinates?: number[] } }[]) {
    const c = f?.geometry?.coordinates, p = f?.properties
    if (!c || !p || !Number.isFinite(c[0]) || !Number.isFinite(c[1]) || !Number.isFinite(p.mag) || !Number.isFinite(p.time)) continue
    out.push({ lon: c[0], lat: c[1], depth: Number.isFinite(c[2]) ? c[2] : 0, mag: p.mag!, time: p.time!, place: p.place ?? '' })
  }
  return out.sort((a, b) => a.time - b.time)
}

/** "M 8.8 - 2025 Kamchatka Peninsula, Russia Earthquake" to "Kamchatka Peninsula, Russia"; "122 km NNE of Punta Cana, Dominican Republic" to "Punta Cana". */
export function shortPlace(detail: string): string {
  let s = detail.replace(/^M\s*[\d.]+\s*-\s*/, '').replace(/^\d+\s*km\s+[NSEW]{1,3}\s+of\s+/i, '').replace(/^\d{4}\s+/, '').replace(/\s+Earthquake$/i, '').trim()
  if (s.length > 26) s = s.split(',')[0].trim()
  return s
}

/**
 * Where the site's 2000 × 1000 coastline path (x = (longitude + 180) / 0.18,
 * y = (90 - latitude) / 0.18) goes on this map, copy `k` of the wrap: a
 * shift and one scale (degrees are square, so x and y scale alike).
 */
export function landTransform(w: number, h: number, k: number): { tx: number; ty: number; s: number } {
  const span = MAP_TOP - MAP_BOTTOM
  return { tx: (k - MAP_LON0 / 360) * w, ty: ((MAP_TOP - 90) / span) * h, s: w / 2000 }
}

/** Midnights (UTC) between two times, every `every` days. */
export function dayTicks(from: number, to: number, every = 1): number[] {
  const out: number[] = []
  for (let t = Math.ceil(from / DAY) * DAY; t <= to; t += DAY) if (Math.round(t / DAY) % every === 0) out.push(t)
  return out
}

/* -------------------------------------------------------------------------- */
/* Drawing                                                                      */
/* -------------------------------------------------------------------------- */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const dayLabel = (t: number) => { const d = new Date(t); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}` }
const MONO = "600 10.5px 'JetBrains Mono', ui-monospace, Menlo, monospace"
const SANS = "600 11.5px Inter, system-ui, sans-serif"

/** Size a canvas's backing store to its own box (never its container's) at the screen's density. */
function fit(canvas: HTMLCanvasElement) {
  const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight)
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const W = Math.round(w * dpr), H = Math.round(h * dpr)
  if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H }
  const g = canvas.getContext('2d')!
  g.setTransform(dpr, 0, 0, dpr, 0, 0)
  g.clearRect(0, 0, w, h)
  return { g, w, h }
}

/** Text with a dark halo, so it reads over a trace or a coast. */
function label(g: CanvasRenderingContext2D, text: string, x: number, y: number, colour: string, font = SANS, align: CanvasTextAlign = 'left') {
  g.font = font
  g.textAlign = align
  g.textBaseline = 'middle'
  g.lineJoin = 'round'
  g.lineWidth = 3.5
  g.strokeStyle = 'rgba(3, 6, 10, 0.92)'
  g.strokeText(text, x, y)
  g.fillStyle = colour
  g.fillText(text, x, y)
}

/* ---- the map -------------------------------------------------------------- */

let landCache: { key: string; pic: HTMLCanvasElement } | null = null

/** The sea, the graticule and the land, drawn once per size. */
function mapBase(w: number, h: number, dpr: number, land: Path2D): HTMLCanvasElement {
  const key = `${w}x${h}@${dpr}`
  if (landCache?.key === key) return landCache.pic
  const c = document.createElement('canvas')
  c.width = Math.round(w * dpr); c.height = Math.round(h * dpr)
  const g = c.getContext('2d')!
  g.setTransform(dpr, 0, 0, dpr, 0, 0)
  const sea = g.createRadialGradient(w * 0.5, h * 0.45, 0, w * 0.5, h * 0.45, w * 0.7)
  sea.addColorStop(0, '#0b1724'); sea.addColorStop(1, '#04080d')
  g.fillStyle = sea
  g.fillRect(0, 0, w, h)
  // Every 30 degrees, faintly.
  g.strokeStyle = 'rgba(120, 160, 205, 0.07)'
  g.lineWidth = 1
  for (let lon = -180; lon < 180; lon += 30) { const [x] = mapXY(0, lon, w, h); g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke() }
  for (let lat = -60; lat <= 60; lat += 30) { const [, y] = mapXY(lat, 0, w, h); g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke() }
  // The land: the 2000 × 1000 path the site already carries (longitude -180 at x = 0), shifted to the Pacific middle and drawn three times to wrap.
  for (const k of [0, 1]) {
    g.save()
    const { tx, ty, s } = landTransform(w, h, k)
    g.translate(tx, ty)
    g.scale(s, s)
    g.fillStyle = '#17232e'
    g.fill(land)
    g.lineWidth = (1.1 * 2000) / w
    g.strokeStyle = 'rgba(150, 188, 220, 0.3)'
    g.stroke(land)
    g.restore()
  }
  landCache = { key, pic: c }
  return c
}

/**
 * The map: the month's quakes, oldest first so the newest lie on top, each
 * fading with age; the rows' own record events ringed and named. Returns
 * where the newest quake is, for the page's pulsing ring.
 */
export function drawQuakeMap(
  canvas: HTMLCanvasElement, quakes: Quake[], marked: { tag: string; mag: number; lat: number; lon: number; detail: string; days: number }[],
  land: Path2D, now: number,
): { newest: { x: number; y: number; q: Quake } | null } {
  const { g, w, h } = fit(canvas)
  const dpr = canvas.width / w
  g.drawImage(mapBase(w, h, dpr, land), 0, 0, w, h)
  const s = Math.max(0.75, Math.min(1.35, w / 900))
  g.globalCompositeOperation = 'lighter'
  for (const q of quakes) {
    const [x, y] = mapXY(q.lat, q.lon, w, h)
    if (y < -10 || y > h + 10) continue
    const age = Math.min(1, (now - q.time) / (30 * DAY))
    const a = 0.85 - 0.55 * age
    const r = quakeRadius(q.mag, s)
    const col = depthColour(q.depth)
    // A soft glow for the big ones, then the dot.
    if (q.mag >= 5.5) {
      const halo = g.createRadialGradient(x, y, 0, x, y, r * 3.2)
      halo.addColorStop(0, col + '2e'); halo.addColorStop(1, col + '00')
      g.fillStyle = halo
      g.fillRect(x - r * 3.2, y - r * 3.2, r * 6.4, r * 6.4)
    }
    g.globalAlpha = a
    g.fillStyle = col
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill()
    g.globalAlpha = 1
  }
  g.globalCompositeOperation = 'source-over'
  // The records: ringed in white and named, the label kept inside the frame.
  const placed: [number, number][] = []
  for (const m of marked) {
    const [x, y] = mapXY(m.lat, m.lon, w, h)
    const r = quakeRadius(m.mag, s) + 4
    g.strokeStyle = 'rgba(240, 246, 255, 0.95)'
    g.lineWidth = 1.5
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke()
    // On a narrow map the names would only pile up; the rows below give each in full.
    if (w < 560) continue
    const right = x < w - 190
    let ly = y
    for (const [px, py] of placed) if (Math.abs(px - x) < 200 && Math.abs(py - ly) < 30) ly = py + 30
    placed.push([x, ly])
    const tx = right ? x + r + 7 : x - r - 7
    g.strokeStyle = 'rgba(240, 246, 255, 0.5)'; g.lineWidth = 1
    g.beginPath(); g.moveTo(right ? x + r : x - r, y); g.lineTo(tx - (right ? 3 : -3), ly); g.stroke()
    label(g, `${m.tag}  M${m.mag.toFixed(1)} ${shortPlace(m.detail)}`, tx, ly - 7, '#f2f6fb', SANS, right ? 'left' : 'right')
    label(g, m.days === 0 ? 'today' : `${m.days.toLocaleString('en-US')} day${m.days === 1 ? '' : 's'} ago`, tx, ly + 8, '#9fb2c6', "500 11px Inter, system-ui, sans-serif", right ? 'left' : 'right')
  }
  const last = quakes[quakes.length - 1]
  if (!last) return { newest: null }
  const [nx, ny] = mapXY(last.lat, last.lon, w, h)
  return { newest: { x: nx, y: ny, q: last } }
}

/* ---- the X-ray trace -------------------------------------------------------- */

const XLO = -8.6, XHI = -3.2

/** GOES's long band for the last week; the M and X flares named at their peaks. Returns the class right now. */
export function drawXray(canvas: HTMLCanvasElement, tr: Trace, flares: { time: number; cls: string }[], now: number): string | null {
  const { g, w, h } = fit(canvas)
  const L = 10, R = 30, T = 16, B = 24
  const pw = w - L - R, ph = h - T - B
  const t1 = now, t0 = now - 7 * DAY
  const X = (t: number) => L + ((t - t0) / (t1 - t0)) * pw
  const Y = (v: number) => T + (1 - (v - XLO) / (XHI - XLO)) * ph
  // The glass.
  const bg = g.createLinearGradient(0, 0, 0, h)
  bg.addColorStop(0, '#08111a'); bg.addColorStop(1, '#04070b')
  g.fillStyle = bg; g.fillRect(0, 0, w, h)
  // The classes: a decade each, M and X faintly tinted, their letters at the right.
  g.fillStyle = 'rgba(79, 125, 255, 0.07)'; g.fillRect(L, Y(-4), pw, Y(-5) - Y(-4))
  g.fillStyle = 'rgba(176, 124, 255, 0.10)'; g.fillRect(L, Y(XHI), pw, Y(-4) - Y(XHI))
  for (let e = -8; e <= -4; e++) {
    g.strokeStyle = 'rgba(140, 180, 220, 0.14)'; g.lineWidth = 1
    g.beginPath(); g.moveTo(L, Y(e)); g.lineTo(L + pw, Y(e)); g.stroke()
    const mid = e === -4 ? (Y(-4) + Y(XHI)) / 2 : (Y(e) + Y(e + 1)) / 2
    label(g, LETTERS[e + 8], L + pw + 15, mid, e >= -5 ? '#dfe8f3' : '#7f93a8', "700 12px Inter, system-ui, sans-serif", 'center')
  }
  // Days.
  for (const t of dayTicks(t0, t1)) {
    const x = X(t)
    g.strokeStyle = 'rgba(140, 180, 220, 0.08)'
    g.beginPath(); g.moveTo(x, T); g.lineTo(x, T + ph); g.stroke()
    label(g, dayLabel(t), x, h - 10, '#7f93a8', MONO, 'center')
  }
  // The trace, broken where the satellite had a gap.
  let current: number | null = null
  const pts: [number, number][][] = [[]]
  tr.v.forEach((v, i) => {
    const t = tr.t0 + i * tr.step
    if (t < t0 || t > t1) return
    if (v == null) { if (pts[pts.length - 1].length) pts.push([]); return }
    pts[pts.length - 1].push([X(t), Y(Math.max(XLO, Math.min(XHI, v)))])
    current = v
  })
  for (const run of pts) {
    if (run.length < 2) continue
    const fill = g.createLinearGradient(0, T, 0, T + ph)
    fill.addColorStop(0, 'rgba(127, 232, 255, 0.28)'); fill.addColorStop(1, 'rgba(127, 232, 255, 0.0)')
    g.beginPath(); g.moveTo(run[0][0], T + ph)
    for (const [x, y] of run) g.lineTo(x, y)
    g.lineTo(run[run.length - 1][0], T + ph); g.closePath()
    g.fillStyle = fill; g.fill()
    g.beginPath(); run.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)))
    g.strokeStyle = '#8fe9ff'; g.lineWidth = 1.4
    g.shadowColor = 'rgba(127, 232, 255, 0.7)'; g.shadowBlur = 6
    g.stroke()
    g.shadowBlur = 0
  }
  // The named flares, each at the top of its own spike; a name too close to the last is left off.
  let lastX = -1e9
  for (const f of [...flares].sort((a, b) => a.time - b.time)) {
    if (f.time < t0 || f.time > t1) continue
    const i = Math.round((f.time - tr.t0) / tr.step)
    let peak = -99
    for (let k = i - 2; k <= i + 2; k++) { const v = tr.v[k]; if (v != null && v > peak) peak = v }
    if (peak < -99 + 1) continue
    const x = X(f.time), y = Y(Math.min(XHI, peak))
    g.fillStyle = f.cls.startsWith('X') ? '#e45cff' : '#c8d6ff'
    g.beginPath(); g.arc(x, y, 2.6, 0, Math.PI * 2); g.fill()
    if (x - lastX > 34) { label(g, f.cls, x, Math.max(T + 6, y - 11), f.cls.startsWith('X') ? '#f1c8ff' : '#dfe8ff', "700 10.5px Inter, system-ui, sans-serif", 'center'); lastX = x }
  }
  // Now: a live point at the end of the trace.
  if (current != null) {
    const x = X(t1), y = Y(Math.max(XLO, Math.min(XHI, current)))
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(Math.min(x, L + pw - 2), y, 3, 0, Math.PI * 2); g.fill()
  }
  return current == null ? null : goesClass(current)
}

/* ---- the Kp bars ----------------------------------------------------------- */

/** Thirty days of three-hour Kp, each bar its G-level's colour; the shocks marked. Returns the latest Kp. */
export function drawKp(canvas: HTMLCanvasElement, tr: Trace, shocks: number[], now: number): number | null {
  const { g, w, h } = fit(canvas)
  const L = 10, R = 34, T = 14, B = 24
  const pw = w - L - R, ph = h - T - B
  const t1 = now, t0 = now - 30 * DAY
  const X = (t: number) => L + ((t - t0) / (t1 - t0)) * pw
  const Y = (k: number) => T + (1 - k / 9.4) * ph
  const bg = g.createLinearGradient(0, 0, 0, h)
  bg.addColorStop(0, '#08111a'); bg.addColorStop(1, '#04070b')
  g.fillStyle = bg; g.fillRect(0, 0, w, h)
  for (const t of dayTicks(t0, t1, 5)) {
    const x = X(t)
    g.strokeStyle = 'rgba(140, 180, 220, 0.08)'; g.lineWidth = 1
    g.beginPath(); g.moveTo(x, T); g.lineTo(x, T + ph); g.stroke()
    label(g, dayLabel(t), x, h - 10, '#7f93a8', MONO, 'center')
  }
  // The storm levels: a dashed line at each, its name at the right.
  for (let k = 5; k <= 9; k++) {
    g.setLineDash([3, 4]); g.strokeStyle = kpColour(k) + '88'; g.lineWidth = 1
    g.beginPath(); g.moveTo(L, Y(k)); g.lineTo(L + pw, Y(k)); g.stroke()
    g.setLineDash([])
    label(g, `G${k - 4}`, L + pw + 17, Y(k), kpColour(k), "700 11px Inter, system-ui, sans-serif", 'center')
  }
  const bw = Math.max(1, (tr.step / (t1 - t0)) * pw - 0.8)
  let latest: number | null = null
  tr.v.forEach((v, i) => {
    const t = tr.t0 + i * tr.step
    if (v == null || t < t0 - tr.step || t > t1) return
    const x = X(t), y = Y(v)
    const grad = g.createLinearGradient(0, y, 0, T + ph)
    grad.addColorStop(0, kpColour(v)); grad.addColorStop(1, kpColour(v) + '66')
    g.fillStyle = grad
    g.fillRect(x, y, bw, T + ph - y)
    latest = v
  })
  // Shocks: where one reached a spacecraft (or the ground felt it), a thin bright line.
  for (const s of shocks) {
    if (s < t0 || s > t1) continue
    const x = X(s)
    g.strokeStyle = 'rgba(235, 245, 255, 0.85)'; g.lineWidth = 1.2
    g.beginPath(); g.moveTo(x, T + 12); g.lineTo(x, T + ph); g.stroke()
    label(g, 'shock', x, T + 5, '#eef4ff', "700 10px Inter, system-ui, sans-serif", 'center')
  }
  return latest
}
