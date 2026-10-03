/**
 * Tiny Island — the ?perf meter.
 *
 * Add ?perf to the homepage's address and a small panel in the island's
 * corner shows how the canvas is keeping up, four times a second: the frame
 * rate and the slowest frames, a strip of the last two seconds of frames
 * against the lines for 60 and 45 a second, how long the engine took to draw
 * one, and what it drew (canvas calls, which are what decide the speed on a
 * phone, then cells, sprites, shapes and lettering), the level and zoom, and
 * what is loaded.
 *
 * Nothing of it exists without ?perf. scripts/bench-island.mjs reads the same
 * numbers through window.__island, which also only exists with ?perf.
 */
import type { Engine } from './engine'

export type Stats = ReturnType<Engine['stats']>

const N = 120

export function perfMeter(box: HTMLElement) {
  const el = document.createElement('div')
  el.className = 'isl-perf'
  el.setAttribute('aria-hidden', 'true')
  el.innerHTML = '<p class="isl-perf-fps"><b>–</b> fps</p><canvas width="240" height="56"></canvas><pre></pre>'
  box.append(el)
  const fpsEl = el.querySelector('b')!, pre = el.querySelector('pre')!
  const cv = el.querySelector('canvas')!, g = cv.getContext('2d')!
  const css = document.createElement('style')
  css.textContent = `
    .isl-perf { position: absolute; left: 14px; top: 76px; z-index: 9; width: 252px; padding: 8px 8px 6px; pointer-events: none;
      font: 11px/1.45 ui-monospace, 'Cascadia Mono', Menlo, Consolas, monospace; color: #dfe9ff;
      background: rgb(16 22 44 / 0.84); border-radius: 12px; box-shadow: 0 6px 20px rgb(0 0 0 / 0.25); backdrop-filter: blur(6px); }
    .isl-perf-fps { margin: 0 0 4px 2px; font-size: 12px; color: #9fb0d9; }
    .isl-perf-fps b { font-size: 22px; font-weight: 700; color: #7cf2c6; margin-right: 2px; }
    .isl-perf-fps b.is-low { color: #ff8fb1; }
    .isl-perf canvas { display: block; width: 240px; height: 56px; margin: 0 auto 4px; border-radius: 6px; background: rgb(255 255 255 / 0.05); }
    .isl-perf pre { margin: 0 2px; font: inherit; white-space: pre; }
  `
  document.head.append(css)

  // The gaps between frames, and the engine's own time for each.
  const gaps = new Float32Array(N), work = new Float32Array(N)
  let at = 0, count = 0, lastT = 0, shown = 0, stats: Stats | null = null
  const sorted: number[] = []

  function draw() {
    const w = cv.width, h = cv.height
    g.clearRect(0, 0, w, h)
    // 0 to 50 ms, top to bottom.
    const y = (ms: number) => h - (Math.min(ms, 50) / 50) * h
    g.lineWidth = 1
    for (const [ms, c] of [[1000 / 60, 'rgb(124 242 198 / 0.5)'], [1000 / 45, 'rgb(255 143 177 / 0.55)']] as const) {
      g.strokeStyle = c; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(0, y(ms) + 0.5); g.lineTo(w, y(ms) + 0.5); g.stroke()
    }
    g.setLineDash([])
    const bw = w / N
    for (let i = 0; i < Math.min(count, N); i++) {
      const k = (at - 1 - i + N) % N, x = w - (i + 1) * bw
      const ms = gaps[k]
      g.fillStyle = ms > 1000 / 45 + 0.5 ? '#ff8fb1' : ms > 1000 / 58 ? '#a9b8ff' : '#7cf2c6'
      g.fillRect(x, y(ms), Math.max(1, bw - 0.5), h - y(ms))
      // What part of it was the engine drawing.
      g.fillStyle = 'rgb(255 255 255 / 0.55)'
      g.fillRect(x, y(work[k]), Math.max(1, bw - 0.5), h - y(work[k]))
    }
  }

  function text() {
    const n = Math.min(count, N)
    sorted.length = 0
    let sum = 0, drawSum = 0
    for (let i = 0; i < n; i++) { const k = (at - 1 - i + N) % N; sorted.push(gaps[k]); sum += gaps[k]; drawSum += work[k] }
    sorted.sort((a, b) => a - b)
    const fps = n ? (n * 1000) / sum : 0
    const p95 = n ? sorted[Math.floor(n * 0.95)] : 0, worst = n ? sorted[n - 1] : 0
    const slow = sorted.filter((x) => x > 1000 / 45 + 0.5).length
    fpsEl.textContent = n ? fps.toFixed(0) : '–'
    fpsEl.classList.toggle('is-low', n > 10 && fps < 45)
    const s = stats
    const lines = [
      `frame  p95 ${p95.toFixed(1)}  worst ${worst.toFixed(1)} ms`,
      `slow   ${slow} of the last ${n} (under 45/s)`,
      `draw   ${n ? (drawSum / n).toFixed(2) : '–'} ms a frame`,
    ]
    if (s) {
      lines.push(
        `calls  ${s.calls}  (images ${s.images}, moves ${s.transforms},`,
        `       shapes ${s.paths}, text ${s.texts})`,
        `drew   ${s.frags} cells, ${s.sprites} sprites${s.apart ? `, ${s.apart} apart` : ''}`,
        `level  ${s.level} (${s.scale} px/unit) · dpr ${s.dpr}`,
        `canvas ${s.w}×${s.h}`,
        `loaded ${s.loaded} images · ${(s.bytes / 1e6).toFixed(0)} MB${s.queued ? ` · ${s.queued} coming` : ''}`,
        `view   ${s.gaps ? 'loading' : s.blurry ? 'sharpening' : 'sharp'}`,
      )
    } else lines.push('', 'the map is loading')
    pre.textContent = lines.join('\n')
  }

  return {
    /** A frame was drawn at time t (the engine's stats, if it has drawn). */
    tick(t: number, s: Stats | null) {
      const gap = lastT ? t - lastT : 0
      lastT = t
      // A pause longer than this is the loop asleep (nothing moving), not a slow frame.
      if (gap > 0 && gap < 250) { gaps[at] = gap; work[at] = s?.ms ?? 0; at = (at + 1) % N; count++ }
      if (s) stats = s
      if (t - shown > 250) { shown = t; draw(); text() }
    },
  }
}
