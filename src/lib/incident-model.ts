/**
 * Days Since Incident — the model.
 *
 * Every row on the page answers one question: how long since the most
 * recent real event that cleared some real, published threshold. Nothing
 * here is simulated or invented — it is parsed straight out of four live
 * feeds, three of them public U.S. government instruments:
 *
 *  - USGS's earthquake catalogue (magnitude)
 *  - NASA DONKI's solar-flare log (GOES X-ray class)
 *  - NASA DONKI's geomagnetic-storm log (NOAA's own G-scale, derived from
 *    the storm's own peak planetary Kp index)
 *  - NASA DONKI's interplanetary-shock log (no sub-classification — a shock
 *    either reached a spacecraft or it didn't)
 *
 * Hurricanes and tsunamis were tried first and dropped. GDACS's cyclone feed
 * labels the identical wind speed "Tropical Storm" in one record and
 * "Hurricane/Typhoon" in another, because different member agencies report
 * sustained wind over different averaging windows (1-minute vs 10-minute),
 * and there is no clean tsunami feed at all behind it. Categorising on top
 * of a source that already disagrees with itself would be worse than not
 * having the row.
 */

export type IncidentKind = 'quake' | 'flare' | 'storm' | 'shock'

export interface IncidentEvent {
  kind: IncidentKind
  /** Epoch milliseconds, UTC. */
  time: number
  /** A real, human sentence describing exactly what happened. */
  detail: string
  /** The number a threshold is measured against: magnitude, X-ray flux (W/m^2), or Kp. */
  value: number
}

export interface IncidentCategory {
  id: string
  kind: IncidentKind
  /** Row title, e.g. "Magnitude 7.0+ Earthquake". */
  title: string
  /** The real published threshold, restated in the category's own units. */
  thresholdLabel: string
  min: number
}

export const EARTHQUAKE_CATEGORIES: IncidentCategory[] = [
  { id: 'eq-2.5', kind: 'quake', title: 'Earthquake', thresholdLabel: 'M2.5+', min: 2.5 },
  { id: 'eq-4.5', kind: 'quake', title: 'Magnitude 4.5+ Earthquake', thresholdLabel: 'M4.5+', min: 4.5 },
  { id: 'eq-6.0', kind: 'quake', title: 'Magnitude 6.0+ Earthquake', thresholdLabel: 'M6.0+', min: 6.0 },
  { id: 'eq-7.0', kind: 'quake', title: 'Magnitude 7.0+ Earthquake', thresholdLabel: 'M7.0+ ("major")', min: 7.0 },
  { id: 'eq-8.0', kind: 'quake', title: 'Magnitude 8.0+ Earthquake', thresholdLabel: 'M8.0+ ("great")', min: 8.0 },
]

/**
 * GOES soft X-ray flux, 1-8 Å, in W/m^2 — the real NOAA class boundaries.
 * Each letter is a decade above the last; X has no fixed ceiling.
 */
export const FLARE_CATEGORIES: IncidentCategory[] = [
  { id: 'fl-c', kind: 'flare', title: 'Solar Flare', thresholdLabel: 'C-class+', min: 1e-6 },
  { id: 'fl-m', kind: 'flare', title: 'Class M Solar Flare', thresholdLabel: 'M-class+', min: 1e-5 },
  { id: 'fl-x', kind: 'flare', title: 'Class X Solar Flare', thresholdLabel: 'X-class+', min: 1e-4 },
  { id: 'fl-x5', kind: 'flare', title: 'Class X5 Solar Flare', thresholdLabel: 'X5.0+', min: 5e-4 },
  { id: 'fl-x10', kind: 'flare', title: 'Class X10 Solar Flare', thresholdLabel: 'X10+', min: 1e-3 },
]

/** NOAA's own G-scale (1-5), keyed on a storm's own peak planetary Kp index. */
export const STORM_CATEGORIES: IncidentCategory[] = [
  { id: 'gs-g1', kind: 'storm', title: 'G1 Geomagnetic Storm', thresholdLabel: 'minor (Kp 5+)', min: 5 },
  { id: 'gs-g2', kind: 'storm', title: 'G2 Geomagnetic Storm', thresholdLabel: 'moderate (Kp 6+)', min: 6 },
  { id: 'gs-g3', kind: 'storm', title: 'G3 Geomagnetic Storm', thresholdLabel: 'strong (Kp 7+)', min: 7 },
  { id: 'gs-g4', kind: 'storm', title: 'G4 Geomagnetic Storm', thresholdLabel: 'severe (Kp 8+)', min: 8 },
  { id: 'gs-g5', kind: 'storm', title: 'G5 Geomagnetic Storm', thresholdLabel: 'extreme (Kp 9)', min: 9 },
]

export const SHOCK_CATEGORIES: IncidentCategory[] = [
  { id: 'ips', kind: 'shock', title: 'Interplanetary Shock', thresholdLabel: 'detected at any spacecraft', min: 0 },
]

export const ALL_CATEGORIES: IncidentCategory[] = [
  ...EARTHQUAKE_CATEGORIES,
  ...FLARE_CATEGORIES,
  ...STORM_CATEGORIES,
  ...SHOCK_CATEGORIES,
]

export function daysSince(now: number, then: number): number {
  return Math.floor((now - then) / 86_400_000)
}

/** Whole days, hours and minutes since `then` — for the live hero readout. */
export function elapsedParts(now: number, then: number) {
  const totalMinutes = Math.max(0, Math.floor((now - then) / 60_000))
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  return { days, hours, minutes }
}

/** The most recent event of this category's kind that clears its threshold, or null if none supplied. */
export function mostRecentQualifying(events: IncidentEvent[], category: IncidentCategory): IncidentEvent | null {
  let best: IncidentEvent | null = null
  for (const e of events) {
    if (e.kind !== category.kind) continue
    if (e.value < category.min) continue
    if (!best || e.time > best.time) best = e
  }
  return best
}

const FLARE_LETTER_EXPONENT: Record<string, number> = { A: -8, B: -7, C: -6, M: -5, X: -4 }

/** "M2.3" -> 2.3e-5 W/m^2. Returns null for anything that isn't a real GOES class string. */
export function flareFlux(classType: string): number | null {
  const m = /^([ABCMX])(\d+(?:\.\d+)?)$/.exec(classType.trim())
  if (!m) return null
  const exponent = FLARE_LETTER_EXPONENT[m[1]]
  return Number(m[2]) * 10 ** exponent
}

/** The highest planetary Kp a DONKI GST record reached, and when. */
export function peakKp(allKpIndex: { kpIndex: number; observedTime: string }[] | undefined): { kp: number; time: number } | null {
  if (!allKpIndex || !allKpIndex.length) return null
  let best = allKpIndex[0]
  for (const k of allKpIndex) if (k.kpIndex > best.kpIndex) best = k
  const time = Date.parse(best.observedTime)
  return Number.isFinite(time) ? { kp: best.kpIndex, time } : null
}

/* ---- turning raw API JSON into IncidentEvent[] --------------------------- */

export interface UsgsFeature {
  properties: { mag: number; place: string; time: number; title: string; tsunami?: number }
}
export function parseUsgsFeature(f: UsgsFeature): IncidentEvent {
  const p = f.properties
  return { kind: 'quake', time: p.time, value: p.mag, detail: p.title }
}

export interface DonkiFlare {
  classType: string
  peakTime?: string | null
  beginTime: string
  sourceLocation?: string
}
export function parseDonkiFlare(f: DonkiFlare): IncidentEvent | null {
  const value = flareFlux(f.classType)
  if (value == null) return null
  const time = Date.parse(f.peakTime ?? f.beginTime)
  if (!Number.isFinite(time)) return null
  const where = f.sourceLocation ? ` at ${f.sourceLocation}` : ''
  return { kind: 'flare', time, value, detail: `Class ${f.classType} solar flare${where}` }
}

export interface DonkiStorm {
  allKpIndex?: { kpIndex: number; observedTime: string }[]
}
export function parseDonkiStorm(g: DonkiStorm): IncidentEvent | null {
  const peak = peakKp(g.allKpIndex)
  if (!peak) return null
  return { kind: 'storm', time: peak.time, value: peak.kp, detail: `Geomagnetic storm reached Kp ${peak.kp.toFixed(2)}` }
}

export interface DonkiShock {
  eventTime: string
  location?: string
}
export function parseDonkiShock(s: DonkiShock): IncidentEvent | null {
  const time = Date.parse(s.eventTime)
  if (!Number.isFinite(time)) return null
  const where = s.location ? ` at ${s.location}` : ''
  return { kind: 'shock', time, value: 1, detail: `Interplanetary shock detected${where}` }
}
