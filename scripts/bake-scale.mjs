/**
 * bake-scale — photograph Scale's models.
 *
 * Each solid object in Scale is a signed-distance model in
 * `scripts/scale-bake/models/<slug>.glsl`. This renders them in a headless
 * browser — the studio in `scale-bake/studio.glsl`, sixteen samples a pixel —
 * and writes `public/scale/<slug>.webp` (and a half-size `-s` for phones).
 * The pictures are committed; the site never runs these shaders, so nothing
 * here has to be fast and every device shows the same render.
 *
 *   node scripts/bake-scale.mjs coin ant        bake two
 *   node scripts/bake-scale.mjs --all           bake every model
 *   node scripts/bake-scale.mjs coin --draft    1024px, 4 samples, to look at
 *   node scripts/bake-scale.mjs coin --out dir  write PNG previews there instead
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
const { SCALE_ART, slugOf, PAD } = await import('../src/lib/scale-art.ts')

const argv = process.argv.slice(2)
const flag = (n) => argv.includes(n)
const opt = (n) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : null)
const draft = flag('--draft')
const outDir = opt('--out')
const SIZE = Number(opt('--size')) || (draft ? 1024 : 2048)
const SS = Number(opt('--ss')) || (draft ? 2 : 4)

const modelDir = path.join(here, 'scale-bake', 'models')
const bySlug = Object.fromEntries(Object.entries(SCALE_ART).map(([name, a]) => [slugOf(name), a]))
const have = fs.readdirSync(modelDir).filter((f) => f.endsWith('.glsl')).map((f) => f.slice(0, -5))
const names = flag('--all') ? have : argv.filter((a, i) => !a.startsWith('--') && !['--out', '--size', '--ss'].includes(argv[i - 1]))
if (!names.length) { console.log('nothing to bake: name a model or pass --all'); process.exit(1) }
for (const n of names) {
  if (!have.includes(n)) { console.log(`no model ${n}.glsl`); process.exit(1) }
  if (!bySlug[n]) { console.log(`${n}.glsl has no entry in scale-art.ts`); process.exit(1) }
}

/* ---- a browser ---------------------------------------------------------- */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const exe = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].find((p) => p && fs.existsSync(p))
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

/* ---- the darkroom, which runs in the page ------------------------------- */

const DARKROOM = `
window.bake = async (frag, W, H, half, SS, texUrl) => {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H
  const gl = cv.getContext('webgl2', { antialias: false })
  if (!gl.getExtension('EXT_color_buffer_float')) throw new Error('no float targets')
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s)
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s }
  const pr = gl.createProgram()
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, '#version 300 es\\nin vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }'))
  gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, frag))
  gl.linkProgram(pr)
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr))
  gl.useProgram(pr)
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  gl.enableVertexAttribArray(0); gl.bindAttribLocation(pr, 0, 'a'); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
  const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA16F, W, H)
  const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
  if (texUrl) {
    const img = new Image(); img.src = texUrl; await img.decode()
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture())
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
    gl.generateMipmap(gl.TEXTURE_2D)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.uniform1i(gl.getUniformLocation(pr, 'u_tex'), 1)
    gl.activeTexture(gl.TEXTURE0)
  }
  gl.viewport(0, 0, W, H)
  gl.uniform2f(gl.getUniformLocation(pr, 'u_res'), W, H)
  gl.uniform2f(gl.getUniformLocation(pr, 'u_half'), half[0], half[1])
  const jit = gl.getUniformLocation(pr, 'u_jit')
  const acc = new Float32Array(W * H * 4), px = new Float32Array(W * H * 4)
  const T = 256
  gl.enable(gl.SCISSOR_TEST)
  for (let s = 0; s < SS * SS; s++) {
    gl.uniform2f(jit, ((s % SS) + 0.5) / SS - 0.5, (Math.floor(s / SS) + 0.5) / SS - 0.5)
    // In tiles, finished one at a time: one draw of a heavy shader across the
    // whole target is long enough for the GPU process to be presumed hung.
    for (let y = 0; y < H; y += T) for (let x = 0; x < W; x += T) {
      gl.scissor(x, y, T, T); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.finish()
      await 0
    }
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.FLOAT, px)
    for (let i = 0; i < acc.length; i += 4) { const a = px[i + 3]; acc[i] += px[i] * a; acc[i + 1] += px[i + 1] * a; acc[i + 2] += px[i + 2] * a; acc[i + 3] += a }
  }
  // Un-premultiply, encode, flip (GL's origin is the bottom left).
  const out = new Uint8ClampedArray(W * H * 4), n = SS * SS
  const enc = (v) => 255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4, j = ((H - 1 - y) * W + x) * 4, a = acc[i + 3]
    if (a > 0) { out[j] = enc(acc[i] / a); out[j + 1] = enc(acc[i + 1] / a); out[j + 2] = enc(acc[i + 2] / a) }
    out[j + 3] = 255 * a / n
  }
  const c2 = document.createElement('canvas'); c2.width = W; c2.height = H
  c2.getContext('2d').putImageData(new ImageData(out, W, H), 0, 0)
  gl.getExtension('WEBGL_lose_context')?.loseContext()
  return c2.toDataURL('image/png').split(',')[1]
}; 1`
await ev(DARKROOM)

/* ---- bake --------------------------------------------------------------- */

const common = fs.readFileSync(path.join(here, 'scale-bake', 'common.glsl'), 'utf8')
const studio = fs.readFileSync(path.join(here, 'scale-bake', 'studio.glsl'), 'utf8')
const dest = outDir ?? path.join(root, 'public', 'scale')
fs.mkdirSync(dest, { recursive: true })

let failed = 0
for (const slug of names) {
  const a = bySlug[slug]
  const long = Math.max(a.wm, a.hm)
  const half = [(0.5 * a.wm / long) * (1 + 2 * PAD), (0.5 * a.hm / long) * (1 + 2 * PAD)]
  const k = SIZE / (2 * Math.max(half[0], half[1]))
  const W = Math.round(2 * half[0] * k), H = Math.round(2 * half[1] * k)
  // A model may pull in a generated table (#include "name.glsl") and may have a
  // picture of its own, textures/<slug>.png, which arrives as u_tex.
  const texDir = path.join(here, 'scale-bake', 'textures')
  const model = fs.readFileSync(path.join(modelDir, slug + '.glsl'), 'utf8')
    .replace(/^#include "([\w.-]+)"$/gm, (_, f) => fs.readFileSync(path.join(texDir, f), 'utf8'))
  const frag = common + '\n' + model + '\n' + studio
  const texFile = path.join(texDir, slug + '.png')
  const texUrl = fs.existsSync(texFile) ? 'data:image/png;base64,' + fs.readFileSync(texFile).toString('base64') : null
  const t0 = Date.now()
  try {
    const b64 = await ev(`bake(${JSON.stringify(frag)}, ${W}, ${H}, ${JSON.stringify(half)}, ${SS}, ${JSON.stringify(texUrl)})`)
    const png = Buffer.from(b64, 'base64')
    if (outDir) fs.writeFileSync(path.join(dest, slug + '.png'), png)
    else {
      await sharp(png).webp({ quality: 88, alphaQuality: 92, effort: 6 }).toFile(path.join(dest, slug + '.webp'))
      await sharp(png).resize(Math.round(W / 2), Math.round(H / 2)).webp({ quality: 86, alphaQuality: 90, effort: 6 }).toFile(path.join(dest, slug + '-s.webp'))
    }
    console.log(`  baked  ${slug}  ${W}x${H}  ${((Date.now() - t0) / 1000).toFixed(1)}s`)
  } catch (e) {
    failed++
    console.log(`  FAIL   ${slug}\n${String(e.message).split('\n').slice(0, 12).join('\n')}`)
  }
}
ws.close(); proc.kill()
process.exit(failed ? 1 : 0)
