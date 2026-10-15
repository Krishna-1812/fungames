/**
 * Challenge a friend: a link that carries your result, so the game opens on
 * "A friend scored 87.3% here. Beat it." and ends on whether you did.
 *
 * The link is the game's own address with `?ref=challenge&vs=<value>~<text>`:
 * `value` is the number the game already ranks a run by (what it hands
 * `shell.considerBest`, higher better), `text` how the game writes it
 * ("87.3%", "212 keys"). Nothing else: no name, nothing typed, nothing that
 * leaves the two browsers except the link itself. A link someone has edited
 * can only claim a different score, which is the oldest trick in friendly
 * competition and does no harm.
 *
 * Only games where beating somebody means something take part, each with its
 * own words for the brag, the dare and the banner (`CHALLENGES`). Trolley is
 * not a contest, so its challenge is a comparison: what kind of moral
 * reasoner your friend turned out to be, and which you are.
 *
 * scripts/check-challenge.mjs holds the encoding and the copy to account.
 */
import { bump } from './quests'

export type Kind = 'beat' | 'compare'
export type Spec = {
  kind: Kind
  /** What the sender says about their run. */
  brag: (t: string) => string
  /** The dare that goes with it. */
  dare: string
  /** What the friend sees over the game. */
  banner: (t: string) => string
}

// 'a utilitarian', not 'an': the same rule Trolley's own verdict uses.
const an = (w: string) => (/^[aeio]/i.test(w) ? 'an' : 'a')

/** "9 / 11" as a sentence says it: "9 of the 11". */
const ofThe = (t: string) => t.replace(/^(\d+) \/ (\d+)$/, '$1 of the $2')
/** "212 keys" in full. */
const keys = (t: string) => t.replace(/ keys$/, ' keystrokes')
/** The auction's "+£12,400" as "£12,400 up", "−£3,000" as "£3,000 down", "±£0" as "level". */
const upDown = (t: string) => (/^\+/.test(t) ? `${t.slice(1)} up` : /^[−-]/.test(t) ? `${t.slice(1)} down` : 'level')

export const CHALLENGES: Record<string, Spec> = {
  'steady-hand': {
    kind: 'beat',
    brag: (t) => `My hand was rated ${t} steady on Steady Hand.`,
    dare: 'Think yours is steadier?',
    banner: (t) => `A friend’s round was rated ${t}. Draw a steadier one.`,
  },
  'from-memory': {
    kind: 'beat',
    brag: (t) => `I drew ten everyday things from memory, ${t} like the real thing.`,
    dare: 'Bet you can’t remember what a bicycle looks like.',
    banner: (t) => `A friend’s drawings were ${t} like the real thing. Remember better.`,
  },
  'constellation-draw': {
    kind: 'beat',
    brag: (t) => `I traced the constellations from memory, ${t} right.`,
    dare: 'Can you do it without peeking?',
    banner: (t) => `A friend traced the constellations ${t} right. Beat that.`,
  },
  'dark-patterns': {
    kind: 'beat',
    brag: (t) => `I got through ${ofThe(t)} websites without falling for the trick.`,
    dare: 'The internet is out to get you. Can you see through more?',
    banner: (t) => `A friend saw through ${ofThe(t)} tricks. Can you see through more?`,
  },
  'not-a-robot': {
    kind: 'beat',
    brag: (t) => `A website decided I am ${t} human.`,
    dare: 'Are you more human than me?',
    banner: (t) => `A friend came out ${t} human. Are you more human?`,
  },
  'rule-cascade': {
    kind: 'beat',
    brag: (t) => `I satisfied all 31 password rules in ${keys(t)}.`,
    dare: 'Can you do it in fewer?',
    banner: (t) => `A friend satisfied all 31 rules in ${keys(t)}. Do it in fewer.`,
  },
  auction: {
    kind: 'beat',
    brag: (t) => (upDown(t) === 'level' ? 'I finished the auction dead level with the appraisal.' : `I finished the auction ${upDown(t)} on the appraisal.`),
    dare: 'Can you beat the room by more?',
    banner: (t) => (upDown(t) === 'level' ? 'A friend finished the auction dead level. Finish up on it.' : `A friend finished the auction ${upDown(t)} on the appraisal. Do better.`),
  },
  trolley: {
    kind: 'compare',
    brag: (t) => (t === 'split' ? 'Twenty-six trolley problems, and I could not pick a side.' : `Twenty-six trolley problems, and it turns out I argue like ${an(t)} ${t.toLowerCase()}.`),
    dare: 'What are you?',
    banner: (t) => (t === 'split' ? 'A friend split down the middle on these. What will you turn out to be?' : `A friend argued like ${an(t)} ${t.toLowerCase()}. What will you turn out to be?`),
  },
}

export type Vs = { value: number; text: string }

/** What a result's text may contain: what the games write, and nothing else. */
const TEXT_RE = /^[\p{L}\p{N} %.,£$€:/+±−-]{1,24}$/u

export function encodeVs(v: Vs): string {
  return `${Math.round(v.value * 1000) / 1000}~${v.text}`
}

/** A `vs` parameter read back, or null for anything that is not one. */
export function decodeVs(raw: string | null): Vs | null {
  if (!raw || raw.length > 64) return null
  const i = raw.indexOf('~')
  if (i < 1) return null
  const value = Number(raw.slice(0, i)), text = raw.slice(i + 1)
  if (!Number.isFinite(value) || Math.abs(value) > 1e12 || !TEXT_RE.test(text)) return null
  return { value, text }
}

/** The link that carries a result. */
export function challengeUrl(href: string, v: Vs): string {
  const u = new URL(href)
  u.hash = ''
  u.search = ''
  u.searchParams.set('ref', 'challenge')
  u.searchParams.set('vs', encodeVs(v))
  return u.href
}

export type Verdict = { won: boolean; tie: boolean; line: string }

/** How a run went against the friend's. */
export function verdict(kind: Kind, mine: Vs, theirs: Vs): Verdict {
  if (kind === 'compare') {
    const same = mine.text === theirs.text
    const said = (t: string) => (t === 'split' ? 'split down the middle' : `argued like ${an(t)} ${t.toLowerCase()}`)
    return { won: false, tie: same, line: same ? `You both ${said(mine.text)}. Great minds.` : `Your friend ${said(theirs.text)}. You ${said(mine.text)}.` }
  }
  if (mine.value === theirs.value) return { won: false, tie: true, line: `A dead heat: ${mine.text} each.` }
  return mine.value > theirs.value
    ? { won: true, tie: false, line: `You beat your friend: ${mine.text} against their ${theirs.text}.` }
    : { won: false, tie: false, line: `Not this time: ${mine.text} against their ${theirs.text}.` }
}

/** The message that goes with the link. */
export const message = (slug: string, v: Vs) => {
  const s = CHALLENGES[slug]
  return s ? `${s.brag(v.text)} ${s.dare}` : ''
}

/* ---- in the page ------------------------------------------------------ */

type Track = (n: 'challenge_open' | 'challenge_done' | 'share', p: Record<string, string | number | boolean>, g: string) => void

const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`)

/**
 * The challenge on a game's page (GameShell.astro): the banner when the page
 * was opened from one, and, when a run ends, the verdict against the friend
 * and the button that sends a challenge on. The shell calls `ended` with the
 * run's result, or null when the run has nothing to send.
 */
export function mountChallenge(slug: string, title: string, track: Track): { ended: (mine: Vs | null) => void; reset: () => void } {
  const spec = CHALLENGES[slug]
  const btn = document.querySelector<HTMLButtonElement>('[data-challenge]')
  const box = document.querySelector<HTMLElement>('[data-vs]')
  const banner = document.querySelector<HTMLElement>('[data-vs-banner]')
  if (!spec || !btn || !box || !banner) return { ended() {}, reset() {} }
  const theirs = decodeVs(new URLSearchParams(location.search).get('vs'))

  if (theirs) {
    banner.querySelector('[data-vs-line]')!.textContent = spec.banner(theirs.text)
    banner.hidden = false
    track('challenge_open', { kind: spec.kind }, slug)
  }

  let mine: Vs | null = null
  btn.addEventListener('click', async () => {
    if (!mine) return
    const url = challengeUrl(location.href, mine)
    const text = message(slug, mine)
    const label = btn.querySelector('span')!
    let outcome = 'dismissed'
    try {
      if (navigator.share) { await navigator.share({ title, text, url }); outcome = 'shared' }
      else { await navigator.clipboard.writeText(`${text} ${url}`); outcome = 'copied' }
    } catch (err) { outcome = (err as Error)?.name === 'AbortError' ? 'dismissed' : 'failed' }
    track('share', { outcome, what: 'challenge' }, slug)
    // For the passport's quests: a challenge that left this browser.
    if (outcome === 'shared' || outcome === 'copied') bump('sent')
    if (outcome === 'copied') {
      const was = label.textContent
      label.textContent = 'Link copied: paste it to a friend'
      setTimeout(() => { label.textContent = was }, 2400)
    } else if (outcome === 'failed') {
      // The browser would not copy it: put it where it can be copied by hand.
      const copy = document.querySelector<HTMLElement>('[data-vs-copy]')
      const area = copy?.querySelector('textarea')
      if (copy && area) { area.value = `${text} ${url}`; copy.hidden = false; area.focus(); area.select() }
    }
  })

  return {
    ended(run) {
      mine = run
      btn.hidden = !run
      if (!run) return
      btn.querySelector('span')!.textContent = theirs ? (spec.kind === 'compare' ? 'Send yours back' : 'Challenge them back') : 'Challenge a friend'
      if (!theirs) return
      const v = verdict(spec.kind, run, theirs)
      box.className = `vs-verdict ${v.won ? 'is-won' : v.tie ? 'is-tie' : 'is-lost'}`
      box.innerHTML = `<p class="label">${spec.kind === 'compare' ? 'You and your friend' : 'Your friend’s challenge'}</p><p class="vs-line">${esc(v.line)}</p>`
      box.hidden = false
      track('challenge_done', { won: v.won, tie: v.tie, kind: spec.kind }, slug)
      if (v.won) bump('won')
    },
    reset() { box.hidden = true; const c = document.querySelector<HTMLElement>('[data-vs-copy]'); if (c) c.hidden = true },
  }
}
