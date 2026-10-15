/**
 * The daily challenge on a game's page (GameShell.astro): a banner over the
 * game when it is today's, and, when a round of it ends, a block in the result
 * card with the verdict, the streak, the last two weeks and tomorrow's game.
 * The streak itself is lib/daily.ts.
 */
import { dailyFor } from '../data/game-meta'
import { readDaily, streakOf, recordDaily, calendar, utcDay, msToNext, inWords, shareText, type Streak, type CalDay } from './daily'
import { state as remindState, turnOn, reportDone, downloadCalendar, hourWords } from './remind'
import { readLink } from './sync'

type Track = (n: 'daily_done' | 'share' | 'remind', p: Record<string, string | number | boolean>, g: string) => void

const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => `&#${ch.charCodeAt(0)};`)
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`

/** The row of dots: one a day, oldest first, today last. */
function calHtml(cal: CalDay[]): string {
  const say = { won: 'beaten', played: 'played', forgiven: 'missed, forgiven', missed: 'missed', open: 'not played yet' }
  return cal.map((c) => {
    const d = new Date(c.day + 'T12:00:00Z')
    const name = d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
    return `<li class="dly-dot is-${c.state}" title="${esc(name)}: ${say[c.state]}"><span class="sr-only">${esc(name)}: ${say[c.state]}</span><i aria-hidden="true">${d.toLocaleDateString(undefined, { weekday: 'narrow', timeZone: 'UTC' })}</i></li>`
  }).join('')
}

const tomorrow = (now: Date) => dailyFor(new Date(Date.parse(utcDay(now) + 'T12:00:00Z') + 864e5))

export function mountDaily(slug: string, track: Track): { finish: (ok: boolean, note: string) => void; reset: () => void } {
  const banner = document.querySelector<HTMLElement>('[data-daily-banner]')
  const block = document.querySelector<HTMLElement>('[data-daily]')
  const none = { finish() {}, reset() {} }
  const now = new Date()
  const today = dailyFor(now)
  if (today.slug !== slug || !banner || !block) return none

  /* ---- the banner over the game ---- */
  const paintBanner = () => {
    const f = readDaily()
    const st = streakOf(f.days, utcDay(), f.best)
    const done = st.today?.g === slug
    banner.querySelector('[data-daily-goal]')!.textContent = today.goal
    banner.querySelector('[data-daily-meta]')!.innerHTML = done
      ? `<b>${st.today!.ok ? '✓ Beaten today' : '✓ Played today'}</b> · ${st.n > 1 ? `${st.n}-day streak` : 'streak started'} · a new one in ${inWords(msToNext())}`
      : st.n > 0
        ? `<b>${st.n}-day streak</b> · finish a round today to keep it`
        : `Finish a round to start a streak · a new challenge every day`
  }
  paintBanner()
  banner.hidden = false

  /* ---- the block in the result card ---- */
  let last: { ok: boolean; streak: Streak; cal: CalDay[] } | null = null
  let tick = 0
  const paintNext = () => {
    const t = tomorrow(new Date())
    const el = block.querySelector('[data-daily-next]')
    if (el) el.textContent = `Tomorrow’s challenge: ${t.title}, in ${inWords(msToNext())}.`
  }

  block.querySelector('[data-daily-share]')?.addEventListener('click', async (e) => {
    if (!last) return
    const btn = e.currentTarget as HTMLButtonElement
    const text = shareText({ title: today.title, ok: last.ok, streak: last.streak, cal: last.cal, url: location.origin + location.pathname })
    let outcome = 'dismissed'
    try {
      if (navigator.share) { await navigator.share({ text }); outcome = 'shared' }
      else { await navigator.clipboard.writeText(text); outcome = 'copied' }
    } catch (err) { outcome = (err as Error)?.name === 'AbortError' ? 'dismissed' : 'failed' }
    track('share', { outcome, what: 'daily' }, slug)
    if (outcome === 'copied') {
      const label = btn.querySelector('span')!
      label.textContent = 'Copied'
      setTimeout(() => { label.textContent = 'Share today’s result' }, 1600)
    }
  })

  /* ---- tomorrow: a reminder, and the streak kept safe on other devices ---- */
  const keep = block.querySelector<HTMLElement>('[data-daily-keep]')
  const remindBtn = keep?.querySelector<HTMLButtonElement>('[data-daily-remind]')
  const kept = keep?.querySelector<HTMLElement>('[data-daily-kept]')
  const saveLink = keep?.querySelector<HTMLElement>('[data-daily-save]')
  // Remind at the hour this round was played: the time of day that suits them is the one they chose.
  const hour = new Date().getHours()
  let calendarOnly = false
  const paintKeep = async (streak: Streak) => {
    if (!keep || !remindBtn || !kept || !saveLink) return
    const r = await remindState()
    const at = hourWords(r.hour ?? hour)
    calendarOnly = r.state !== 'off'
    remindBtn.hidden = r.state === 'on'
    remindBtn.querySelector('span')!.textContent = r.state === 'off' ? `Remind me tomorrow at ${hourWords(hour)}` : 'Add a daily reminder to my calendar'
    kept.textContent = r.state === 'on' ? `✓ A reminder comes at ${at} each day, unless you have played.`
      : r.state === 'blocked' ? 'Notifications are blocked for this site, so a calendar reminder is the way.'
      : r.state === 'home' ? 'On an iPhone, add the island to your Home Screen for notifications. Or:' : ''
    saveLink.hidden = !!readLink() || streak.n < 2
    keep.hidden = false
  }
  remindBtn?.addEventListener('click', async () => {
    if (calendarOnly) { downloadCalendar(hour); track('remind', { action: 'calendar', via: 'daily' }, slug); kept!.textContent = '✓ Open the file to add it to your calendar.'; return }
    remindBtn.disabled = true
    const out = await turnOn(hour)
    remindBtn.disabled = false
    track('remind', { action: out, via: 'daily' }, slug)
    if (last) paintKeep(last.streak)
    if (out === 'failed') kept!.textContent = 'That did not work just now. A calendar reminder works anywhere:'
    if (out === 'failed') { calendarOnly = true; remindBtn.querySelector('span')!.textContent = 'Add a daily reminder to my calendar' }
  })

  return {
    finish(ok, note) {
      const { streak, first, beatenNow } = recordDaily(slug, ok)
      const f = readDaily()
      const cal = calendar(f.days, utcDay(), streak.forgiven)
      const okToday = streak.today?.ok ?? ok
      last = { ok: okToday, streak, cal }
      track('daily_done', { ok, streak: streak.n, first }, slug)
      block.classList.toggle('is-won', okToday)
      block.querySelector('[data-daily-state]')!.textContent = ok ? '✓ Beaten' : okToday ? '✓ Beaten earlier today' : 'Not this time'
      block.querySelector('[data-daily-note]')!.textContent = note
      block.querySelector('[data-daily-n]')!.textContent = String(streak.n)
      const best = block.querySelector<HTMLElement>('[data-daily-best]')!
      best.textContent = streak.best > streak.n ? `Best ${plural(streak.best, 'day')}` : streak.n > 1 ? 'Your longest yet' : ''
      best.hidden = !best.textContent
      block.querySelector('[data-daily-cal]')!.innerHTML = calHtml(cal)
      block.querySelector('[data-daily-why]')!.textContent = streak.forgiven.length
        ? `You missed ${streak.forgiven.length === 1 ? 'a day' : 'a few days'}, and ${streak.forgiven.length === 1 ? 'it was' : 'they were'} forgiven: one missed day a week is.`
        : beatenNow && streak.n === 1 ? 'A streak counts every day you finish the challenge, beaten or not. One missed day a week is forgiven.'
        : 'Every day you finish the challenge counts, beaten or not. One missed day a week is forgiven.'
      paintNext()
      clearInterval(tick)
      tick = window.setInterval(paintNext, 30_000)
      block.hidden = false
      paintBanner()
      paintKeep(streak)
      // A reminder is not needed for a day already played.
      reportDone()
    },
    reset() { block.hidden = true; clearInterval(tick) },
  }
}
