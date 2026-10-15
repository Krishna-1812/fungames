/**
 * A quest finished by the round that just ended, said in the result card
 * (ShellResult.astro), with the way to the passport where it is kept.
 */
import { gather, sync } from './quests'
import { QUEST_COVERS } from './bottles'

export function questsAfterRun(games: { slug: string; cat: string; district: string }[], home: string, track: (n: 'quest_done', p: Record<string, string>) => void): void {
  const box = document.querySelector<HTMLElement>('[data-quest]')
  if (!box || !games.length) return
  const fresh = sync(gather(games))
  if (!fresh.length) return
  const q = fresh[fresh.length - 1]
  const cover = QUEST_COVERS.find((c) => c.key === q.cover)
  box.querySelector('[data-quest-name]')!.textContent = fresh.length > 1 ? `${q.name}, and ${fresh.length - 1} more` : q.name
  box.querySelector('[data-quest-line]')!.textContent = cover ? `${q.line} It earns your passport a new cover: ${cover.name}.` : q.line
  // The note is itself the link to the passport.
  box.setAttribute('href', `${home}#quests`)
  box.hidden = false
  for (const f of fresh) track('quest_done', { quest: f.id })
}
