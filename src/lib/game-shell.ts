/**
 * The game shell's runtime. A game calls `createShell()` once and then only
 * ever talks to the frame through the object it gets back: it never reaches
 * into the score strip, the panels or the result card itself. That is what
 * keeps every game's score, best, pause and ending behaving identically.
 */
import { roll, confetti, PLAY } from './motion'
import { isMuted, setMuted, unlock, sfx } from './audio'
import { bestKey } from '../data/game-meta'

export type ShellOptions = {
  slug: string
  /** Called when the player restarts. Default: reload the page. */
  onRestart?: () => void
  onPause?: () => void
  onResume?: () => void
}

export type Ending = {
  title: string
  /** The big figure on the result card, already formatted. */
  score: string
  /** Where the odometer starts from; defaults to zeros of the same shape. */
  from?: string
  kicker?: string
  lines?: string[]
  againLabel?: string
}

export type Best = { value: number; text: string }

const $ = <T extends Element = HTMLElement>(root: ParentNode, sel: string) => root.querySelector(sel) as T

function readBest(slug: string): Best | null {
  try {
    const raw = localStorage.getItem(bestKey(slug))
    if (!raw) return null
    const v = JSON.parse(raw)
    return typeof v?.value === 'number' && typeof v?.text === 'string' ? v : null
  } catch {
    return null
  }
}
function writeBest(slug: string, b: Best) {
  try { localStorage.setItem(bestKey(slug), JSON.stringify(b)) } catch { /* storage blocked: the game still plays */ }
}

export function createShell(opts: ShellOptions) {
  const shell = $(document, '[data-shell]')
  const tile = (name: string) => $(shell, `[data-tile="${name}"]`)
  const val = (name: string) => $(tile(name), '[data-val]')
  const stage = $(shell, '[data-stage]')
  const announcer = $(shell, '[data-announce]')
  const result = $(shell, '[data-result]')
  const levelUpEl = $(stage, '[data-level-up]')
  const pausePanel = $<HTMLDialogElement>(document, '[data-panel="pause"]')
  const howtoPanel = $<HTMLDialogElement>(document, '[data-panel="howto"]')
  const soundBtn = $<HTMLButtonElement>(shell, '[data-act="sound"]')
  const soundLabel = $(soundBtn, '[data-sound-label]')
  const newBestBadge = $(tile('best'), '[data-new-best]')

  let paused = false
  let best = readBest(opts.slug)
  let runStartBest = best
  let beatenThisRun = false
  let opener: HTMLElement | null = null

  /* ---- the strip -------------------------------------------------- */

  if (best) val('best').textContent = best.text

  let announceT = 0
  const pending: string[] = []
  function announce(msg: string) {
    pending.push(msg)
    clearTimeout(announceT)
    announceT = window.setTimeout(() => { announcer.textContent = pending.join(' '); pending.length = 0 }, 500)
  }

  const labelOf = (name: string) => tile(name).querySelector('.label')?.textContent ?? name
  const shown: Record<string, string> = {}

  function set(name: 'score' | 'level' | 'moves', text: string) {
    if (shown[name] === text) return
    const first = shown[name] === undefined
    shown[name] = text
    roll(val(name), text, { ms: name === 'moves' ? 500 : 900 })
    // The odometer's columns are aria-hidden, so the change is said here,
    // batched with anything else announced in the same half-second. Moves
    // tick on every keystroke and would drown everything else out.
    if (!first && name !== 'moves') announce(`${labelOf(name)}: ${text}.`)
  }

  /**
   * Offer a candidate best. Higher `value` wins.
   *
   * Returns 'first' when there was no best yet (recorded quietly — there was
   * nothing to beat), 'beaten' when a stored best was genuinely beaten (the
   * tile floods orange and the badge pops in, once per run), or false.
   */
  function considerBest(value: number, text: string): 'first' | 'beaten' | false {
    if (value <= 0) return false
    if (best && value <= best.value) return false
    best = { value, text }
    writeBest(opts.slug, best)
    roll(val('best'), text)
    // Beaten means beaten *the best this run started with* — improving on
    // something you set two minutes ago in the same game is not a record.
    if (!runStartBest) return 'first'
    if (value <= runStartBest.value) return false
    if (!beatenThisRun) {
      beatenThisRun = true
      tile('best').classList.add('is-best')
      newBestBadge.hidden = false
      announce(`New personal best: ${text}.`)
    }
    return 'beaten'
  }

  /* ---- feedback --------------------------------------------------- */

  function replay(el: Element, cls: string, ms: number) {
    el.classList.remove(cls)
    void (el as HTMLElement).offsetWidth
    el.classList.add(cls)
    setTimeout(() => el.classList.remove(cls), ms)
  }
  const pop = (el: Element = stage) => replay(el, 'fx-pop', 280)
  const shake = (el: Element = stage) => { replay(el, 'fx-shake', 320); replay(el, 'fx-wrong', 620) }

  let levelT = 0
  function levelUp(text: string) {
    clearTimeout(levelT)
    $(levelUpEl, '[data-level-text]').textContent = text
    levelUpEl.hidden = false
    // Restart the CSS animation if two level-ups land close together.
    levelUpEl.style.animation = 'none'
    void levelUpEl.offsetWidth
    levelUpEl.style.animation = ''
    announce(text + '.')
    levelT = window.setTimeout(() => { levelUpEl.hidden = true }, PLAY ? 1450 : 900)
  }

  /* ---- endings ---------------------------------------------------- */

  function end(kind: 'win' | 'lose', e: Ending) {
    stage.classList.toggle('is-lost', kind === 'lose')
    $(result, '[data-result-kicker]').textContent = e.kicker ?? (kind === 'win' ? '✓ Finished' : 'Game over')
    $(result, '[data-result-title]').textContent = e.title
    const lines = $(result, '[data-result-lines]')
    lines.innerHTML = ''
    for (const l of e.lines ?? []) {
      const p = document.createElement('p')
      p.textContent = l
      lines.append(p)
    }
    $(result, '[data-again-label]').textContent = e.againLabel ?? (kind === 'win' ? 'Play again' : 'Try again')
    result.hidden = false
    result.classList.remove('is-in')
    void result.offsetWidth
    result.classList.add('is-in')
    const scoreEl = $(result, '[data-result-score]')
    roll(scoreEl, e.score, { from: e.from ?? e.score.replace(/\d/g, '0'), ms: 1400 })
    result.scrollIntoView({ behavior: PLAY ? 'smooth' : 'auto', block: 'center' })
    result.focus({ preventScroll: true })
    announce(`${e.title}. ${e.score}.`)
    if (kind === 'win') {
      sfx.great()
      if (PLAY) {
        const r = result.getBoundingClientRect()
        setTimeout(() => confetti(innerWidth / 2, Math.max(80, Math.min(innerHeight * 0.4, r.top)), 70), 180)
      }
    } else {
      sfx.bad()
    }
  }
  const win = (e: Ending) => end('win', e)
  const lose = (e: Ending) => end('lose', e)
  function reset() {
    result.hidden = true
    stage.classList.remove('is-lost')
    beatenThisRun = false
    runStartBest = best
    tile('best').classList.remove('is-best')
    newBestBadge.hidden = true
  }

  /* ---- panels ----------------------------------------------------- */

  function openPanel(d: HTMLDialogElement, from?: HTMLElement | null) {
    opener = from ?? (document.activeElement as HTMLElement | null)
    // Either panel stops the clock: nobody should lose a lot while reading
    // the rules.
    pause()
    if (typeof d.showModal === 'function') d.showModal()
    else d.setAttribute('open', '')
  }
  function closePanel(d: HTMLDialogElement) {
    if (typeof d.close === 'function' && d.open) d.close()
    else d.removeAttribute('open')
  }
  for (const d of [pausePanel, howtoPanel]) {
    d.addEventListener('close', () => {
      resume()
      // Focus goes back to whatever opened the panel.
      opener?.focus?.()
      opener = null
    })
    d.addEventListener('click', (e) => {
      // A click on the backdrop lands on the dialog element itself.
      if (e.target === d) closePanel(d)
      if ((e.target as HTMLElement).closest('[data-close]')) closePanel(d)
    })
  }

  function pause() {
    if (paused) return
    paused = true
    opts.onPause?.()
  }
  function resume() {
    if (!paused) return
    paused = false
    opts.onResume?.()
  }

  const restart = () => {
    for (const d of [pausePanel, howtoPanel]) closePanel(d)
    reset()
    if (opts.onRestart) opts.onRestart()
    else location.reload()
  }

  /* ---- sound: off by default, remembered -------------------------- */

  const paintSound = () => {
    const on = !isMuted()
    soundBtn.setAttribute('aria-pressed', String(on))
    soundLabel.textContent = on ? 'Sound on' : 'Sound off'
  }
  paintSound()

  /* ---- wiring ------------------------------------------------------ */

  document.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null
    if (!b) return
    const act = b.dataset.act
    if (act === 'pause') openPanel(pausePanel, b)
    else if (act === 'howto') openPanel(howtoPanel, b)
    else if (act === 'restart' || act === 'again') restart()
    else if (act === 'sound') {
      unlock()
      setMuted(!isMuted())
      paintSound()
      if (!isMuted()) sfx.click()
    }
  })

  document.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement
    const typing = t.closest('input, textarea, select, [contenteditable="true"]')
    if (typing || e.metaKey || e.ctrlKey || e.altKey) return
    if ((e.key === 'p' || e.key === 'P') && !pausePanel.open && !howtoPanel.open) {
      e.preventDefault()
      openPanel(pausePanel, t)
    }
  })

  addEventListener('pointerdown', unlock, { once: true, capture: true })
  addEventListener('keydown', unlock, { once: true, capture: true })

  return {
    stage,
    resultExtra: $(result, '[data-result-extra]'),
    get paused() { return paused },
    get best() { return best },
    setScore: (text: string) => set('score', text),
    setLevel: (text: string) => set('level', text),
    setMoves: (text: string) => set('moves', text),
    considerBest,
    announce,
    pop,
    shake,
    levelUp,
    win,
    lose,
    reset,
    openHowTo: () => openPanel(howtoPanel),
  }
}

export type Shell = ReturnType<typeof createShell>
