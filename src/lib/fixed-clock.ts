/** Run simulation ticks independently of display refresh. Long gaps are paused,
 * not replayed; short stalls may catch up by at most five ticks per paint. */
export class FixedClock {
  private previous: number | null = null
  private accumulated = 0
  readonly interval = 1000 / 60

  reset() { this.previous = null; this.accumulated = 0 }

  advance(now: number, tick: () => void) {
    if (this.previous === null) { this.previous = now; return }
    const elapsed = now - this.previous
    this.previous = now
    if (elapsed < 0 || elapsed > 250) { this.accumulated = 0; return }
    this.accumulated = Math.min(this.accumulated + elapsed, 5 * this.interval)
    while (this.accumulated + 1e-7 >= this.interval) {
      this.accumulated = Math.max(0, this.accumulated - this.interval)
      tick()
    }
  }
}
