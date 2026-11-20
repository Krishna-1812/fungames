/**
 * bake-earth-reviews — photograph Earth Reviews' products in their packaging.
 *
 * For each phenomenon (src/data/earth-reviews.ts) and its pack
 * (src/lib/earth-reviews-packs.ts) this
 *
 *   1. prints the label: the shop's band, the drawing the shop already had
 *      for the product (lib/earth-reviews-art.ts), its name, its real star
 *      average and how many reviewed it, the net contents, and round the
 *      sides the tagline, the directions and a barcode — laid out to the
 *      pack's own proportions, so a carton's front panel is exactly its front;
 *   2. photographs the pack in the studio (earth-reviews-bake/studio.glsl)
 *      with the label wrapped round it, sixteen samples a pixel, in a
 *      headless browser;
 *   3. writes public/earth-reviews/<id>.webp (1200 square) and -s.webp (600).
 *
 * The pictures are committed; the site never runs any of this.
 *
 *   node scripts/bake-earth-reviews.mjs gravity the-ocean     bake two
 *   node scripts/bake-earth-reviews.mjs --all                 bake all of them
 *   node scripts/bake-earth-reviews.mjs gravity --out dir     PNG previews (and labels) there instead
 *   --size 600 --ss 2                                          a quick draft
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { register } from 'node:module'
import sharp from 'sharp'
register('./resolve-ts.mjs', import.meta.url)

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, '..')
const { PACKS } = await import('../src/lib/earth-reviews-packs.ts')
const { PHENOMENA, averageRating } = await import('../src/data/earth-reviews.ts')
const { ART } = await import('../src/lib/earth-reviews-art.ts')

const argv = process.argv.slice(2)
const flag = (n) => argv.includes(n)
const opt = (n) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : null)
const outDir = opt('--out')
const SIZE = Number(opt('--size')) || 1200
const SS = Number(opt('--ss')) || 4
const ids = flag('--all') ? PHENOMENA.map((p) => p.id) : argv.filter((a, i) => !a.startsWith('--') && !['--out', '--size', '--ss'].includes(argv[i - 1]))
if (!ids.length) { console.log('nothing to bake: name a product or pass --all'); process.exit(1) }
for (const id of ids) if (!PACKS[id] || !ART[id]) { console.log(`no pack or drawing for ${id}`); process.exit(1) }

/* ---- the label ----------------------------------------------------------- */

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const FONT = "'Segoe UI', 'Helvetica Neue', Arial, sans-serif"
const HEAVY = "'Segoe UI Black', 'Arial Black', 'Segoe UI', Arial, sans-serif"

/** Lines no wider than `chars` characters, broken at spaces. */
function wrap(text, chars) {
  const out = []
  let line = ''
  for (const w of text.split(/\s+/)) {
    if ((line + ' ' + w).trim().length > chars && line) { out.push(line); line = w } else line = (line + ' ' + w).trim()
  }
  if (line) out.push(line)
  return out
}

/** Stars, as five shapes filled to the average. */
function stars(x, y, size, value, fill, empty) {
  const path = (cx, cy, r) => {
    let d = ''
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r
      d += `${i ? 'L' : 'M'}${(cx + rr * Math.cos(a)).toFixed(1)} ${(cy + rr * Math.sin(a)).toFixed(1)}`
    }
    return d + 'Z'
  }
  let s = ''
  for (let i = 0; i < 5; i++) {
    const cx = x + size * 0.5 + i * size * 1.12, cy = y + size * 0.5
    const f = Math.max(0, Math.min(1, value - i))
    s += `<path d="${path(cx, cy, size * 0.5)}" fill="${empty}"/>`
    if (f > 0) s += `<clipPath id="st${i}"><rect x="${cx - size * 0.5}" y="${cy - size * 0.5}" width="${size * f}" height="${size}"/></clipPath><path d="${path(cx, cy, size * 0.5)}" fill="${fill}" clip-path="url(#st${i})"/>`
  }
  return s
}

/** A barcode whose bars are the product's own name, hashed: the same every bake. */
function barcode(x, y, w, h, seed, ink) {
  let s = '', cx = x, k = 0
  for (const ch of seed) k = (k * 31 + ch.charCodeAt(0)) >>> 0
  while (cx < x + w) {
    k = (k * 1103515245 + 12345) >>> 0
    const bw = 2 + (k >>> 28) % 4
    if ((k >>> 20) & 1) s += `<rect x="${cx}" y="${y}" width="${bw}" height="${h}" fill="${ink}"/>`
    cx += bw + 1
  }
  return s
}

/**
 * The label as an SVG strip, wrapped round the pack: u across it goes once
 * round (the front panel in the middle), v from the label's foot to its top.
 * Returns the SVG and its pixel size, which keeps the pack's own proportions.
 */
function labelSvg(ph, pk) {
  const [w, h, d] = pk.size
  const perimeter = pk.kind === 'box' ? 2 * w + 2 * d : Math.PI * w
  const tall = pk.kind === 'box' ? h : pk.kind === 'tin' ? h * 0.86 : h * 0.82 * 0.44
  const aspect = perimeter / tall
  const W = Math.min(4096, Math.round(1100 * aspect)), H = Math.round(W / aspect)
  // The front panel: a carton's whole front, a third of a can or jar's round.
  const fw = pk.kind === 'box' ? (w / perimeter) * W : W * 0.3
  const fx = (W - fw) / 2
  const avg = averageRating(ph)
  const wide = fw / H > 1.25
  const pad = Math.min(fw, H) * 0.06
  const band = Math.round(H * (wide ? 0.17 : 0.11))
  let s = `<rect width="${W}" height="${H}" fill="${pk.paper}"/>`
  // The band, all the way round.
  s += `<rect width="${W}" height="${band}" fill="${pk.band}"/>`
  s += `<rect y="${H - band * 0.42}" width="${W}" height="${band * 0.42}" fill="${pk.band}"/>`
  const bandInk = '#f4f7fa'
  s += `<text x="${W / 2}" y="${band * 0.64}" font-family="${FONT}" font-weight="700" font-size="${band * 0.42}" letter-spacing="${band * 0.08}" fill="${bandInk}" text-anchor="middle">EARTH ESSENTIALS</text>`
  s += `<text x="${W / 2}" y="${H - band * 0.12}" font-family="${FONT}" font-weight="700" font-size="${band * 0.26}" letter-spacing="${band * 0.1}" fill="${bandInk}" text-anchor="middle">NON-RETURNABLE · NON-REFUNDABLE · NON-OPTIONAL</text>`
  const drawing = (x, y, size) => `<circle cx="${x + size / 2}" cy="${y + size / 2}" r="${size * 0.52}" fill="${pk.ink}" opacity="0.07"/><svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 120 120">${ART[ph.id].draw()}</svg>`
  const name = ph.name.toUpperCase()
  const fit = (text, width, max) => Math.min(max, width / (text.length * 0.66))
  if (!wide) {
    const art = Math.min(fw - pad * 2, (H - band * 1.6) * 0.48)
    s += drawing(fx + (fw - art) / 2, band + pad, art)
    let y = band + pad + art + pad * 1.1
    const fs1 = fit(name, fw - pad * 2, H * 0.085)
    for (const line of wrap(name, Math.max(8, Math.floor((fw - pad * 2) / (fs1 * 0.62))))) {
      s += `<text x="${W / 2}" y="${y + fs1 * 0.85}" font-family="${HEAVY}" font-weight="900" font-size="${fs1}" fill="${pk.ink}" text-anchor="middle">${esc(line)}</text>`
      y += fs1 * 1.02
    }
    const sz = H * 0.03
    s += stars(W / 2 - sz * 2.8 - sz * 1.4, y + pad * 0.5, sz, avg, pk.ink, pk.ink + '40')
    s += `<text x="${W / 2 + sz * 2.4}" y="${y + pad * 0.5 + sz * 0.85}" font-family="${FONT}" font-weight="700" font-size="${sz * 0.95}" fill="${pk.ink}">${avg.toFixed(1)}</text>`
    s += `<text x="${W / 2}" y="${y + pad * 0.5 + sz * 2.3}" font-family="${FONT}" font-weight="600" font-size="${sz * 0.62}" fill="${pk.ink}" opacity="0.75" text-anchor="middle">RATED BY ${ph.reviews.length} RESIDENTS</text>`
    s += `<text x="${W / 2}" y="${H - band * 0.42 - pad * 0.8}" font-family="${FONT}" font-weight="700" font-size="${H * 0.028}" letter-spacing="${H * 0.002}" fill="${pk.ink}" text-anchor="middle">${esc(pk.net)}</text>`
  } else {
    // A jar's band is wide and short: the drawing at the left, the words beside it.
    const art = H - band * 1.42 - pad * 2
    s += drawing(fx + pad, band + pad, art)
    const tx = fx + pad * 2 + art, tw = fw - (tx - fx) - pad
    const fs1 = fit(name, tw, H * 0.16)
    const lines = wrap(name, Math.max(6, Math.floor(tw / (fs1 * 0.62))))
    let y = band + pad + fs1 * 0.9
    for (const line of lines) { s += `<text x="${tx}" y="${y}" font-family="${HEAVY}" font-weight="900" font-size="${fs1}" fill="${pk.ink}">${esc(line)}</text>`; y += fs1 * 1.02 }
    // Every line sized to the room it has: a wide jar band and a wide carton front differ a lot.
    const rate = `${avg.toFixed(1)} · ${ph.reviews.length} RESIDENTS`
    const sz = Math.min(H * 0.07, tw / (6.2 + rate.length * 0.62))
    s += stars(tx, y - fs1 * 0.2 + pad * 0.3, sz, avg, pk.ink, pk.ink + '40')
    s += `<text x="${tx + sz * 6}" y="${y - fs1 * 0.2 + pad * 0.3 + sz * 0.85}" font-family="${FONT}" font-weight="700" font-size="${sz * 0.9}" fill="${pk.ink}">${rate}</text>`
    const nfs = Math.min(H * 0.055, tw / (pk.net.length * 0.66))
    s += `<text x="${tx}" y="${H - band * 0.42 - pad * 0.9}" font-family="${FONT}" font-weight="700" font-size="${nfs}" fill="${pk.ink}">${esc(pk.net)}</text>`
  }
  // Round the sides: what it is, how to use it, and the code.
  const side = (x, width, title, body) => {
    const fs = Math.min(H * 0.026, width / 22)
    let t = `<text x="${x}" y="${band + pad * 1.4 + fs}" font-family="${FONT}" font-weight="800" font-size="${fs * 0.95}" letter-spacing="${fs * 0.08}" fill="${pk.ink}">${title}</text>`
    let y = band + pad * 1.4 + fs * 2.6
    for (const line of wrap(body, Math.floor(width / (fs * 0.52)))) { t += `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${fs}" fill="${pk.ink}" opacity="0.85">${esc(line)}</text>`; y += fs * 1.35 }
    return t
  }
  const sideW = Math.min(fx * 0.8, H * 0.9)
  if (sideW > 120) {
    s += side(fx - sideW - pad, sideW, 'ABOUT THIS PRODUCT', ph.tagline)
    s += side(fx + fw + pad, sideW, 'DIRECTIONS', 'None required. It happens anyway. Store anywhere. Keep out of reach of nobody, because that is not possible. Made on Earth, from Earth.')
    const bx = (W - fw) / 2 + fw / 2 + W / 2, bw = Math.min(sideW * 0.8, 380)
    const bxx = (bx % W) - bw / 2
    s += `<rect x="${bxx - 14}" y="${H * 0.5 - 14}" width="${bw + 28}" height="${H * 0.22 + 46}" fill="#ffffff"/>` + barcode(bxx, H * 0.5, bw, H * 0.22, ph.id, '#111')
    s += `<text x="${bxx + bw / 2}" y="${H * 0.72 + 26}" font-family="${FONT}" font-size="22" fill="#111" text-anchor="middle">0 00000 ${String(ph.id.length * 7919 % 100000).padStart(5, '0')} 0</text>`
  }
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${s}</svg>`, W, H }
}

/* ---- a browser ----------------------------------------------------------- */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const exe = [process.env.CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => p && fs.existsSync(p))
if (!exe) { console.log('no Chrome found; set CHROME to its path'); process.exit(1) }
const port = 9300 + Math.floor(Math.random() * 600)
const proc = spawn(exe, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${fs.mkdtempSync(path.join(tmpdir(), 'bake-'))}`,
  '--no-first-run', '--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11', '--disable-gpu-watchdog', '--mute-audio', 'about:blank'], { stdio: 'ignore' })
let tabs = []
for (let i = 0; i < 60 && !tabs.length; i++) {
  try { tabs = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).filter((t) => t.type === 'page') } catch {}
  if (!tabs.length) await sleep(200)
}
const ws = new WebSocket(tabs[0].webSocketDebuggerUrl)
await new Promise((r) => ws.addEventListener('open', r))
let seq = 0
const pending = new Map()
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
const send = (method, params = {}) => new Promise((r) => { const i = ++seq; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
const ev = async (x) => {
  const m = await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true })
  if (m.result?.exceptionDetails) throw new Error(m.result.exceptionDetails.exception?.description ?? JSON.stringify(m.result.exceptionDetails))
  return m.result?.result?.value
}
await send('Runtime.enable')

// The same darkroom as bake-scale.mjs: tiles, jittered samples averaged in float, sRGB at the end.
await ev(`window.bake = async (frag, W, H, SS, texUrl) => {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H
  const gl = cv.getContext('webgl2', { antialias: false })
  if (!gl.getExtension('EXT_color_buffer_float')) throw new Error('no float targets')
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s)
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s }
  const pr = gl.createProgram()
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, '#version 300 es\\nin vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }'))
  gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, frag))
  gl.bindAttribLocation(pr, 0, 'a'); gl.linkProgram(pr)
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr))
  gl.useProgram(pr)
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
  const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA16F, W, H)
  const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
  const img = new Image(); img.src = texUrl; await img.decode()
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, gl.createTexture())
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
  gl.generateMipmap(gl.TEXTURE_2D)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.uniform1i(gl.getUniformLocation(pr, 'u_tex'), 1)
  gl.activeTexture(gl.TEXTURE0)
  gl.viewport(0, 0, W, H)
  gl.uniform2f(gl.getUniformLocation(pr, 'u_res'), W, H)
  gl.uniform2f(gl.getUniformLocation(pr, 'u_half'), 1, 1)
  const jit = gl.getUniformLocation(pr, 'u_jit')
  const acc = new Float32Array(W * H * 4), px = new Float32Array(W * H * 4)
  const T = 192
  gl.enable(gl.SCISSOR_TEST)
  for (let s = 0; s < SS * SS; s++) {
    gl.uniform2f(jit, ((s % SS) + 0.5) / SS - 0.5, (Math.floor(s / SS) + 0.5) / SS - 0.5)
    for (let y = 0; y < H; y += T) for (let x = 0; x < W; x += T) { gl.scissor(x, y, T, T); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.finish(); await 0 }
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.FLOAT, px)
    for (let i = 0; i < acc.length; i++) acc[i] += px[i]
  }
  const out = new Uint8ClampedArray(W * H * 4), n = SS * SS
  const enc = (v) => 255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4, j = ((H - 1 - y) * W + x) * 4
    out[j] = enc(acc[i] / n); out[j + 1] = enc(acc[i + 1] / n); out[j + 2] = enc(acc[i + 2] / n); out[j + 3] = 255
  }
  const c2 = document.createElement('canvas'); c2.width = W; c2.height = H
  c2.getContext('2d').putImageData(new ImageData(out, W, H), 0, 0)
  gl.getExtension('WEBGL_lose_context')?.loseContext()
  return c2.toDataURL('image/png').split(',')[1]
}; 1`)

/* ---- bake ---------------------------------------------------------------- */

const studio = fs.readFileSync(path.join(here, 'earth-reviews-bake', 'studio.glsl'), 'utf8')
const dest = outDir ?? path.join(root, 'public', 'earth-reviews')
fs.mkdirSync(dest, { recursive: true })
const rgb = (hex) => [1, 3, 5].map((i) => (parseInt(hex.slice(i, i + 2), 16) / 255).toFixed(4))
const glvec = (a) => `vec3(${a.join(', ')})`

let failed = 0
for (const id of ids) {
  const ph = PHENOMENA.find((p) => p.id === id), pk = PACKS[id]
  const t0 = Date.now()
  try {
    const { svg } = labelSvg(ph, pk)
    const label = await sharp(Buffer.from(svg)).png().toBuffer()
    if (outDir) fs.writeFileSync(path.join(dest, id + '-label.png'), label)
    const c = pk.contents
    const defs = [
      `#define KIND ${{ box: 0, tin: 1, jar: 2 }[pk.kind]}`,
      `#define SIZE vec3(${pk.size.map((v) => v.toFixed(4)).join(', ')})`,
      `#define TURN ${((pk.turn * Math.PI) / 180).toFixed(5)}`,
      `#define METAL ${{ steel: 0, black: 1, white: 2 }[pk.metal ?? 'steel']}`,
      `#define PAPER ${glvec(rgb(pk.paper))}`,
      `#define CONTENT ${c ? { liquid: 1, grain: 2, glow: 3, haze: 4 }[c.kind] : 0}`,
      `#define CCOL ${glvec(c ? rgb(c.colour).map((v) => Math.pow(+v, 2.2).toFixed(4)) : [0, 0, 0])}`,
      `#define CLEVEL ${(c && 'level' in c ? c.level : 0).toFixed(3)}`,
    ].join('\n')
    const frag = studio.replace('precision highp int;', 'precision highp int;\n' + defs)
    const b64 = await ev(`bake(${JSON.stringify(frag)}, ${SIZE}, ${SIZE}, ${SS}, ${JSON.stringify('data:image/png;base64,' + label.toString('base64'))})`)
    const png = Buffer.from(b64, 'base64')
    if (outDir) fs.writeFileSync(path.join(dest, id + '.png'), png)
    else {
      await sharp(png).webp({ quality: 86, effort: 6 }).toFile(path.join(dest, id + '.webp'))
      await sharp(png).resize(Math.round(SIZE / 2)).webp({ quality: 84, effort: 6 }).toFile(path.join(dest, id + '-s.webp'))
    }
    console.log(`  baked  ${id}  ${((Date.now() - t0) / 1000).toFixed(1)}s`)
  } catch (e) {
    failed++
    console.log(`  FAIL   ${id}\n${String(e.message).split('\n').slice(0, 14).join('\n')}`)
  }
}
ws.close(); proc.kill()
process.exit(failed ? 1 : 0)
