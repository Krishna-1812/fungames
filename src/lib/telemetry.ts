/**
 * Behavioural telemetry — the measurements behind I'm Not a Robot.
 *
 * Every number that game shows you is computed here from your actual input:
 * where the pointer went, how evenly you clicked, how evenly you typed, how
 * still you can hold your hand, how round your circle was. Real bot detection
 * looks at exactly these channels, which is why the joke works at all.
 *
 * The *thresholds* that decide "human" are invented for the bit, and the page
 * says so. The measurements are not invented, so the analysis lives in pure
 * functions over plain arrays and scripts/check-telemetry.mjs feeds them
 * synthetic input with answers worked out by hand.
 */

export type Sample = { x: number; y: number; t: number }
export type Point = { x: number; y: number }

/* -------------------------------------------------------------------------- */
/* Pointer path                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Split a trace into strokes — runs of movement separated by a pause.
 *
 * Measuring a whole session as one path is meaningless: the straight-line
 * distance from the first sample to the last says nothing about how you moved.
 * A stroke is one intentional journey across the screen, which is the unit the
 * straightness and velocity-profile numbers actually describe.
 */
export function splitStrokes(samples: Sample[], gapMs = 250): Sample[][] {
  const out: Sample[][] = []
  let cur: Sample[] = []
  for (const s of samples) {
    if (cur.length && s.t - cur[cur.length - 1].t > gapMs) {
      out.push(cur)
      cur = []
    }
    cur.push(s)
  }
  if (cur.length) out.push(cur)
  return out
}

/** Perpendicular distance from C to the infinite line through A and B. */
function perpDistance(a: Point, b: Point, c: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy)
  // Degenerate chord: the neighbours coincide, so the only sensible distance
  // is straight to them.
  if (len < 1e-9) return Math.hypot(c.x - a.x, c.y - a.y)
  return Math.abs(dx * (c.y - a.y) - dy * (c.x - a.x)) / len
}

export type PathStats = {
  samples: number
  strokes: number
  /** Total distance travelled, px. */
  pathLength: number
  /** Mean over strokes of (displacement / path length). 1 is a ruler. */
  straightness: number
  /** RMS deviation of each sample from the chord between its neighbours, px. */
  jitter: number
  /** Fastest instantaneous speed seen, px/s. */
  peakSpeed: number
  /**
   * Mean fraction of a stroke spent after its peak speed. A hand throws the
   * pointer most of the way and then creeps the last bit onto the target, so
   * this lands above a half; a linear interpolation peaks immediately and
   * holds, which reads as 1.
   */
  correction: number
}

/** Long enough to describe. Below this the honest answer is "not measured". */
const MIN_PATH_SAMPLES = 24
const MIN_STROKE_SAMPLES = 8

export function pathStats(samples: Sample[], gapMs = 250): PathStats | null {
  if (samples.length < MIN_PATH_SAMPLES) return null

  const strokes = splitStrokes(samples, gapMs).filter(
    (s) => s.length >= MIN_STROKE_SAMPLES,
  )
  if (!strokes.length) return null

  let pathLength = 0
  let jitterSq = 0
  let jitterN = 0
  let peakSpeed = 0
  const straightnesses: number[] = []
  const corrections: number[] = []

  for (const st of strokes) {
    let len = 0
    const speeds: number[] = []

    for (let i = 1; i < st.length; i++) {
      const d = Math.hypot(st[i].x - st[i - 1].x, st[i].y - st[i - 1].y)
      len += d
      // Coalesced pointer events can share a timestamp; a zero dt is not a
      // speed of infinity, it is two samples belonging to the same moment.
      const dt = (st[i].t - st[i - 1].t) / 1000
      speeds.push(dt > 0 ? d / dt : 0)
    }
    pathLength += len

    for (let i = 1; i < st.length - 1; i++) {
      const d = perpDistance(st[i - 1], st[i + 1], st[i])
      jitterSq += d * d
      jitterN++
    }

    // A stroke that never went anywhere has no meaningful direction.
    if (len > 20) {
      const disp = Math.hypot(
        st[st.length - 1].x - st[0].x,
        st[st.length - 1].y - st[0].y,
      )
      straightnesses.push(Math.min(1, disp / len))
    }

    if (speeds.length > 1) {
      let peak = 0
      for (let i = 1; i < speeds.length; i++) if (speeds[i] > speeds[peak]) peak = i
      peakSpeed = Math.max(peakSpeed, speeds[peak])
      corrections.push(1 - peak / (speeds.length - 1))
    }
  }

  if (!straightnesses.length || !corrections.length) return null

  const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length
  return {
    samples: samples.length,
    strokes: strokes.length,
    pathLength,
    straightness: mean(straightnesses),
    jitter: jitterN ? Math.sqrt(jitterSq / jitterN) : 0,
    peakSpeed,
    correction: mean(corrections),
  }
}

/* -------------------------------------------------------------------------- */
/* Rhythm                                                                     */
/* -------------------------------------------------------------------------- */

export type Variation = {
  count: number
  /** ms */ mean: number
  /** ms */ sd: number
  /**
   * Coefficient of variation, sd/mean. Scale-free, so a fast typist and a slow
   * one are compared on evenness rather than on speed.
   */
  cv: number
}

const MIN_INTERVALS = 5

/**
 * Spread of a set of intervals.
 *
 * Gaps longer than `maxMs` are dropped: they are you reading the question, not
 * you typing, and one of them swamps everything else in the deviation.
 */
export function variation(intervals: number[], maxMs = 5000): Variation | null {
  const use = intervals.filter((d) => d > 0 && d <= maxMs)
  if (use.length < MIN_INTERVALS) return null
  const mean = use.reduce((a, b) => a + b, 0) / use.length
  const sd = Math.sqrt(
    use.reduce((a, b) => a + (b - mean) * (b - mean), 0) / use.length,
  )
  return { count: use.length, mean, sd, cv: mean > 0 ? sd / mean : 0 }
}

/** Convenience: turn a list of timestamps into the gaps between them. */
export function gaps(times: number[]): number[] {
  const out: number[] = []
  for (let i = 1; i < times.length; i++) out.push(times[i] - times[i - 1])
  return out
}

/* -------------------------------------------------------------------------- */
/* Shape                                                                      */
/* -------------------------------------------------------------------------- */

export type CircleStats = {
  /** Isoperimetric quotient 4*pi*A / P^2. A true circle is 1, a square 0.785. */
  roundness: number
  /** Distance from the first point to the last, as a fraction of the width. */
  gap: number
  diameter: number
  points: number
}

/**
 * How circular a freehand stroke is.
 *
 * Radius variance is the obvious measure and it is far too forgiving — a square
 * scores over 0.9 on it. The isoperimetric quotient is the standard answer and
 * it punishes exactly what a bad circle does wrong: spending perimeter without
 * enclosing area. A scribble tends to zero.
 */
export function circleStats(pts: Point[]): CircleStats | null {
  if (pts.length < 12) return null

  // Shoelace and perimeter over the closed loop, so the open end of a
  // three-quarter arc costs area rather than being quietly ignored.
  let area2 = 0
  let perim = 0
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    area2 += a.x * b.y - b.x * a.y
    perim += Math.hypot(b.x - a.x, b.y - a.y)
  }
  if (perim < 40) return null

  const area = Math.abs(area2) / 2
  const roundness = Math.min(1, (4 * Math.PI * area) / (perim * perim))

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const p of pts) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  const diameter = Math.max(maxX - minX, maxY - minY)
  const first = pts[0]
  const last = pts[pts.length - 1]

  return {
    roundness,
    gap: diameter > 0 ? Math.hypot(last.x - first.x, last.y - first.y) / diameter : 1,
    diameter,
    points: pts.length,
  }
}

/* -------------------------------------------------------------------------- */
/* The verdict                                                                */
/* -------------------------------------------------------------------------- */

export type Metric = {
  key: string
  label: string
  /** Formatted for display, or null when the channel was never exercised. */
  display: string | null
  /** What a person usually scores, for the report card. */
  expected: string
  /** null = not measured, so it counts neither for nor against you. */
  ok: boolean | null
  /** Shown when ok is false. Says which way you were wrong. */
  note: string
}

export type Evidence = {
  path: PathStats | null
  clicks: Variation | null
  keys: Variation | null
  /** px of drift during the hold-still challenge. */
  drift: number | null
  /** roundness of the drawn circle. */
  roundness: number | null
}

/**
 * Bands chosen so that a person doing the challenges honestly passes, and the
 * ways of failing are the ways a script would: a ruler-straight path, no
 * tremor, a metronome for a hand.
 */
const BANDS = {
  straightness: [0.55, 0.988] as const,
  jitter: [0.08, 8] as const,
  correction: [0.2, 0.92] as const,
  clickCv: [0.1, 3] as const,
  keyCv: [0.12, 2.5] as const,
  drift: [0.4, 90] as const,
  roundness: [0.5, 0.988] as const,
}

const inBand = (v: number | null, band: readonly [number, number]) =>
  v === null ? null : v >= band[0] && v <= band[1]

const fmt = (v: number, dp = 2) => v.toFixed(dp)

export function metrics(e: Evidence): Metric[] {
  const p = e.path
  return [
    {
      key: 'straightness',
      label: 'Pointer straightness',
      display: p ? fmt(p.straightness) : null,
      expected: '0.55 – 0.99',
      ok: inBand(p ? p.straightness : null, BANDS.straightness),
      note:
        p && p.straightness > BANDS.straightness[1]
          ? 'Your pointer travelled in near-perfect lines. Arms do not do that.'
          : 'Your pointer wandered much further than it needed to.',
    },
    {
      key: 'jitter',
      label: 'Tremor',
      display: p ? fmt(p.jitter) + ' px' : null,
      expected: '0.1 – 8 px',
      ok: inBand(p ? p.jitter : null, BANDS.jitter),
      note:
        p && p.jitter < BANDS.jitter[0]
          ? 'No detectable tremor. Every hand has some.'
          : 'Unusually noisy, even for a hand.',
    },
    {
      key: 'correction',
      label: 'Approach profile',
      display: p ? fmt(p.correction) : null,
      expected: '0.2 – 0.92',
      ok: inBand(p ? p.correction : null, BANDS.correction),
      note:
        p && p.correction > BANDS.correction[1]
          ? 'You reached full speed instantly and held it. That is interpolation.'
          : 'You never slowed down as you arrived anywhere.',
    },
    {
      key: 'clicks',
      label: 'Click rhythm',
      display: e.clicks ? fmt(e.clicks.cv) : null,
      expected: '0.10 – 3.0',
      ok: inBand(e.clicks ? e.clicks.cv : null, BANDS.clickCv),
      note:
        e.clicks && e.clicks.cv < BANDS.clickCv[0]
          ? 'Your clicks were spaced like a clock. Hands are worse than that.'
          : 'Your click timing was wildly irregular, even for a person.',
    },
    {
      key: 'keys',
      label: 'Typing rhythm',
      display: e.keys ? fmt(e.keys.cv) : null,
      expected: '0.12 – 2.5',
      ok: inBand(e.keys ? e.keys.cv : null, BANDS.keyCv),
      note:
        e.keys && e.keys.cv < BANDS.keyCv[0]
          ? 'Every keystroke landed the same distance apart.'
          : 'Long pauses in the middle of words. Thinking, or pasting.',
    },
    {
      key: 'drift',
      label: 'Hand drift',
      display: e.drift === null ? null : fmt(e.drift, 1) + ' px',
      expected: '0.4 – 90 px',
      ok: inBand(e.drift, BANDS.drift),
      note:
        e.drift !== null && e.drift < BANDS.drift[0]
          ? 'You held completely still. Nothing alive does that.'
          : 'You could not stay on the target.',
    },
    {
      key: 'roundness',
      label: 'Freehand circle',
      display: e.roundness === null ? null : fmt(e.roundness, 3),
      expected: '0.50 – 0.99',
      ok: inBand(e.roundness, BANDS.roundness),
      note:
        e.roundness !== null && e.roundness > BANDS.roundness[1]
          ? 'That circle was geometrically perfect. Suspicious.'
          : 'That was not a circle.',
    },
  ]
}

export type Report = {
  metrics: Metric[]
  measured: number
  passed: number
  /** 0–100. Share of the channels we could measure that looked human. */
  humanity: number
  verdict: string
  detail: string
}

export function report(e: Evidence): Report {
  const ms = metrics(e)
  const scored = ms.filter((m) => m.ok !== null)
  const passed = scored.filter((m) => m.ok).length
  const humanity = scored.length ? Math.round((passed / scored.length) * 100) : 0
  const failed = scored.filter((m) => !m.ok)

  let verdict: string
  let detail: string
  if (!scored.length) {
    verdict = 'Inconclusive'
    detail =
      'You got through every check without generating one usable signal. That is its own kind of answer.'
  } else if (!failed.length) {
    verdict = 'Human'
    detail = 'Every channel looked like a person. Verification granted, grudgingly.'
  } else if (failed.length === 1) {
    verdict = 'Probably human'
    detail = `One channel did not sit right — ${failed[0].label.toLowerCase()}. ${failed[0].note}`
  } else if (humanity >= 50) {
    verdict = 'Unverified'
    detail = `${failed.length} channels came back wrong. ${failed[0].note}`
  } else {
    verdict = 'Not a human'
    detail = `${failed.length} of ${scored.length} channels failed. ${failed[0].note} You may appeal, to us, in writing.`
  }

  return { metrics: ms, measured: scored.length, passed, humanity, verdict, detail }
}

/* -------------------------------------------------------------------------- */
/* The live recorder                                                          */
/* -------------------------------------------------------------------------- */

/** Roughly two minutes of continuous movement. Old samples are dropped. */
const MAX_SAMPLES = 4000

/** Collects the raw channels. All the analysis stays in the pure functions. */
export class Profiler {
  samples: Sample[] = []
  clickTimes: number[] = []
  keyTimes: number[] = []
  private detach: (() => void)[] = []

  attach(target: Document | HTMLElement = document) {
    const onMove = (e: PointerEvent) => {
      this.samples.push({ x: e.clientX, y: e.clientY, t: performance.now() })
      if (this.samples.length > MAX_SAMPLES) this.samples.splice(0, 400)
    }
    const onDown = () => this.clickTimes.push(performance.now())
    const onKey = (e: KeyboardEvent) => {
      // A modifier on its own is not a keystroke rhythm.
      if (e.key.length === 1 || e.key === 'Backspace') this.keyTimes.push(performance.now())
    }
    target.addEventListener('pointermove', onMove as EventListener, { passive: true })
    target.addEventListener('pointerdown', onDown as EventListener, { passive: true })
    target.addEventListener('keydown', onKey as EventListener, { passive: true })
    this.detach.push(() => {
      target.removeEventListener('pointermove', onMove as EventListener)
      target.removeEventListener('pointerdown', onDown as EventListener)
      target.removeEventListener('keydown', onKey as EventListener)
    })
  }

  stop() {
    for (const fn of this.detach) fn()
    this.detach = []
  }

  path(): PathStats | null { return pathStats(this.samples) }
  clicks(): Variation | null { return variation(gaps(this.clickTimes)) }
  keys(): Variation | null { return variation(gaps(this.keyTimes)) }
}
