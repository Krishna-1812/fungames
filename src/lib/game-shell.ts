/**
 * The game shell's runtime. A game calls `createShell()` once and then only
 * ever talks to the frame through the object it gets back: it never reaches
 * into the score strip, the panels or the result card itself. That is what
 * keeps every game's score, best, pause and ending behaving identically.
 */
import { roll, confetti, PLAY } from './motion'
import { isMuted, setMuted, unlock, sfx } from './audio'
import { bestKey, dailyFor } from '../data/game-meta'
import { recordVisit, readPassport, localDay } from './passport'
import { mountNext } from './next-up'
import { mountDaily } from './daily-ui'
import { readDaily, utcDay } from './daily'
import { mountChallenge, type Vs } from './challenge'
import { questsAfterRun } from './quests-ui'
import { track, onLeave } from './analytics/client'
import { progressText } from './progress-label'

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
  /**
   * A win that is only an ending, not a triumph: no fanfare, no confetti. For
   * a result that is a report of something grim — an impact's death toll is
   * finished, not celebrated.
   */
  celebrate?: boolean
  /**
   * What a challenge to a friend carries from this run (lib/challenge.ts).
   * By default the best this run offered `considerBest`; a game whose
   * challenge is not a score (Trolley's: what kind of reasoner you were)
   * says what it is.
   */
  vs?: Vs
  /**
   * Leave the page where it is rather than bringing the card into view — for
   * an ending the player is still scrolling toward, like the top of a climb
   * with more to read on the way up to it.
   */
  scroll?: boolean
}

export type Best = { value: number; text: string }

const $ = <T extends Element = HTMLElement>(root: ParentNode, sel: string) => root.querySelector(sel) as T

function readBest(slug: string): Best | null {
  try {
    const raw = localStorage.getItem(bestKey(slug))
    if (!raw) return null
    const v = JSON.parse(raw)
    return typeof v?.value === 'number' && Number.isFinite(v.value) && typeof v?.text === 'string'
      ? { value: v.value, text: progressText(slug, v.value, v.text) } : null
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

  // A stamp in the island's passport: once a day, however often the page loads.
  recordVisit(opts.slug)
  // Three more games: at the foot of the page, and in the result card once there is one.
  // Today's challenge, unless it is already done today.
  const todays = dailyFor(new Date()).slug
  const next = mountNext(opts.slug, { visits: readPassport().visits, today: localDay(), daily: readDaily().days[utcDay()]?.g === todays ? null : todays, track: (n, p, g) => track(n, p, g) })
  // The daily challenge's banner and streak, when this is today's game.
  const daily = mountDaily(opts.slug, (n, p, g) => track(n, p, g))
  // A friend's challenge, if the page was opened from one, and the button to send one on.
  const challenge = mountChallenge(opts.slug, document.title, (n, p, g) => track(n, p, g))
  /** The best this run has offered considerBest: what a challenge sends. */
  let runTop: Vs | null = null

  // Analytics: every game reports the same things through here (see
  // lib/analytics/shape.ts for the list). The game starts at the first touch,
  // click or key, and its ending says how long that took.
  const slug = opts.slug
  const sent = (n: Parameters<typeof track>[0], p: Parameters<typeof track>[1] = {}) => track(n, p, slug)
  let startedAt = 0
  // A run is "going" from the first touch until an ending; a page hidden
  // while one is going says where it stopped (game_quit), which is how the
  // dashboard knows where people give up.
  let going = false, runAt = 0, levels = 0, at: string | number | null = null, told = false
  const begin = () => {
    if (startedAt) return
    startedAt = performance.now()
    going = true; runAt = startedAt
    sent('game_start', { after_ms: Math.round(startedAt) })
  }
  onLeave(() => {
    if (!going) return
    const p: Record<string, string | number> = { ms: Math.round(performance.now() - runAt), levels }
    if (at !== null) p.at = at
    if (shown.score !== undefined) p.score = shown.score
    sent('game_quit', p)
  })
  // Choices and discoveries, at most 300 a page (a long Fusion session finds a lot).
  let picks = 0
  addEventListener('pointerdown', begin, { once: true, capture: true })
  addEventListener('keydown', begin, { once: true, capture: true })
  // A wheel is a hand on the game too: the scroll-through pages are often only ever wheeled.
  addEventListener('wheel', begin, { once: true, capture: true, passive: true })

  let paused = false
  let best = readBest(opts.slug)
  let runStartBest = best
  let beatenThisRun = false
  let opener: HTMLElement | null = null

  /* ---- the strip -------------------------------------------------- */

  // A number that is still "—" means nothing yet, so its chip waits out of sight until it does.
  const known = (name: string, text: string) => tile(name).classList.toggle('is-empty', text.trim() === '—' || !text.trim())
  if (best) { val('best').textContent = best.text; known('best', best.text) }

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
    if (name === 'level' && !told) at = text
    if (shown[name] === text) return
    const first = shown[name] === undefined
    shown[name] = text
    known(name, text)
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
   * tile floods cobalt and the badge pops in, once per run), or false.
   */
  function considerBest(value: number, text: string): 'first' | 'beaten' | false {
    if (value <= 0) return false
    if (!runTop || value > runTop.value) runTop = { value, text }
    if (best && value <= best.value) return false
    best = { value, text }
    writeBest(opts.slug, best)
    known('best', text)
    roll(val('best'), text)
    // Beaten means beaten *the best this run started with* — improving on
    // something you set two minutes ago in the same game is not a record.
    if (!runStartBest) { sent('game_best', { kind: 'first', value, text }); return 'first' }
    if (value <= runStartBest.value) return false
    if (!beatenThisRun) {
      sent('game_best', { kind: 'beaten', value, text })
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
    levels++
    if (!told) at = text
    sent('game_level', { text, i: levels })
    levelT = window.setTimeout(() => { levelUpEl.hidden = true }, PLAY ? 1450 : 900)
  }

  /* ---- endings ---------------------------------------------------- */

  function end(kind: 'win' | 'lose', e: Ending) {
    going = false
    sent('game_end', { kind, score: e.score, title: e.title, ms: startedAt ? Math.round(performance.now() - startedAt) : 0 })
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
    next.ended()
    challenge.ended(e.vs ?? runTop)
    // A quest this round finished (the passport keeps them).
    try {
      const nd = JSON.parse(document.getElementById('next-data')?.textContent ?? '{}')
      questsAfterRun((nd.games ?? []).map((g: { slug: string; cat: string; district?: string }) => ({ slug: g.slug, cat: g.cat, district: g.district ?? '' })), nd.home?.[nd.world] ?? '/', (n, p) => track(n, p, slug))
    } catch { /* the quests are a bonus; the ending is not */ }
    result.hidden = false
    result.classList.remove('is-in')
    void result.offsetWidth
    result.classList.add('is-in')
    const scoreEl = $(result, '[data-result-score]')
    roll(scoreEl, e.score, { from: e.from ?? e.score.replace(/\d/g, '0'), ms: 1400 })
    if (e.scroll !== false) result.scrollIntoView({ behavior: PLAY ? 'smooth' : 'auto', block: 'center' })
    result.focus({ preventScroll: true })
    announce(`${e.title}. ${e.score}.`)
    if (kind === 'win' && e.celebrate === false) {
      sfx.click()
    } else if (kind === 'win') {
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
    next.reset()
    daily.reset()
    challenge.reset()
    const qn = document.querySelector<HTMLElement>('[data-quest]'); if (qn) qn.hidden = true
    runTop = null
    stage.classList.remove('is-lost')
    beatenThisRun = false
    runStartBest = best
    levels = 0; at = null; told = false
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
    // A new run is going as soon as it is asked for.
    if (startedAt) { going = true; runAt = performance.now() }
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

  // The ⋯ menu (Pause, Restart) folds away after a choice, a click anywhere else, or Esc.
  const more = shell.querySelector<HTMLDetailsElement>('.shell-more')
  document.addEventListener('click', (e) => { if (more?.open && !more.contains(e.target as Node)) more.open = false })
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && more?.open) { more.open = false; more.querySelector('summary')?.focus() } })

  document.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null
    if (!b) return
    if (more?.contains(b)) more.open = false
    const act = b.dataset.act
    if (act === 'pause') { sent('game_pause'); openPanel(pausePanel, b) }
    else if (act === 'howto') { sent('game_howto'); openPanel(howtoPanel, b) }
    else if (act === 'restart' || act === 'again') { sent('game_restart', { from: act }); restart() }
    else if (act === 'sound') {
      unlock()
      setMuted(!isMuted())
      paintSound()
      sent('sound', { on: !isMuted() })
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
    /**
     * A round of today's challenge has ended (call it before win or lose):
     * `ok` is whether its target was beaten, `note` says what the target was.
     * Does nothing on any other day's game.
     */
    daily: (ok: boolean, note: string) => { if (dailyFor(new Date()).slug === opts.slug) daily.finish(ok, note) },
    /**
     * A choice, a discovery or a step inside the game, for the crowd's
     * statistics on the admin page: `what` names the question ("Choice on
     * each dilemma"), `v` is the answer ("Pull the lever", or a number), and
     * `of` splits it ("The fat man"). Only ever values from the game's own
     * lists or numbers it computed: never anything the player typed.
     */
    pick(what: string, v: string | number | boolean, of?: string) {
      if (picks++ >= 300) return
      const p: Record<string, string | number | boolean> = { what, v }
      if (of !== undefined) p.of = of
      sent('game_pick', p)
    },
    /**
     * Where the player has got to (a rule, a level, a depth, a check), for
     * "where people stop" if the page is left before an ending. setLevel's
     * text stands in for games that never call it.
     */
    progress(where: string | number) { at = where; told = true },
  }
}

export type Shell = ReturnType<typeof createShell>
