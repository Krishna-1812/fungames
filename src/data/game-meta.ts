/**
 * Presentation facts about each game that the registry (games.ts) does not
 * carry: which drawn icon stands for it, how hard it is, and whether it has
 * moved into the shared Paper & Ink game shell yet.
 *
 * Kept apart from games.ts on purpose — the registry is read by the OG-card,
 * sitemap and tile-art checkers, and none of them should have to change
 * because a homepage card grew a difficulty tag.
 */
export type Difficulty = 'Easy' | 'Medium' | 'Hard' | 'Explore'

export type GameMeta = {
  /** Key into lib/icons.ts, drawn in ink on the card. */
  icon: string
  difficulty: Difficulty
}

export const META: Record<string, GameMeta> = {
  'share-this-page': { icon: 'link', difficulty: 'Explore' },
  'internet-artifacts': { icon: 'modem', difficulty: 'Explore' },
  'earth-reviews': { icon: 'earth', difficulty: 'Explore' },
  'who-was-alive': { icon: 'hourglass', difficulty: 'Explore' },
  'printing-money': { icon: 'ticket', difficulty: 'Explore' },
  'constellation-draw': { icon: 'star', difficulty: 'Easy' },
  'days-since-incident': { icon: 'quake', difficulty: 'Explore' },
  'space-elevator': { icon: 'rocket', difficulty: 'Explore' },
  speed: { icon: 'galaxy', difficulty: 'Explore' },
  'day-go': { icon: 'clock', difficulty: 'Explore' },
  'dark-patterns': { icon: 'phone', difficulty: 'Easy' },
  'every-second': { icon: 'toddler', difficulty: 'Explore' },
  'deep-sea': { icon: 'submarine', difficulty: 'Explore' },
  'universe-forecast': { icon: 'moon', difficulty: 'Explore' },
  auction: { icon: 'rostrum', difficulty: 'Medium' },
  'not-a-robot': { icon: 'traffic', difficulty: 'Medium' },
  asteroid: { icon: 'mars', difficulty: 'Easy' },
  overstimulated: { icon: 'gamepad', difficulty: 'Easy' },
  orbit: { icon: 'satellite', difficulty: 'Hard' },
  powder: { icon: 'flask', difficulty: 'Medium' },
  'deep-time': { icon: 'dino', difficulty: 'Explore' },
  scale: { icon: 'universe', difficulty: 'Explore' },
  'rule-cascade': { icon: 'quill', difficulty: 'Hard' },
  'spend-it': { icon: 'yacht', difficulty: 'Easy' },
  'steady-hand': { icon: 'compass', difficulty: 'Medium' },
  fusion: { icon: 'fire', difficulty: 'Medium' },
  trolley: { icon: 'car', difficulty: 'Easy' },
  'paper-folds': { icon: 'sheet', difficulty: 'Easy' },
  'ambient-mix': { icon: 'rain', difficulty: 'Explore' },
  progress: { icon: 'cog', difficulty: 'Explore' },
  'from-memory': { icon: 'palette', difficulty: 'Medium' },
  'life-in-weeks': { icon: 'laurel', difficulty: 'Explore' },
}

/** Games already running inside the shared shell. Grows two per phase. */
export const SHELL_GAMES = new Set(['rule-cascade', 'auction', 'dark-patterns', 'trolley'])

/** localStorage key the shell keeps a game's personal best under. */
export const bestKey = (slug: string) => `paper:best:${slug}`

/**
 * One challenge per shell game. The day picks the game and nudges the
 * target, so it is the same challenge for everyone on the same date without
 * any server deciding it.
 */
export type Daily = { slug: string; title: string; goal: string }

export function dailyFor(date: Date): Daily {
  const day = Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86_400_000)
  const pick = day % 4
  if (pick === 0) {
    const cap = 300 + (day % 5) * 40
    return {
      slug: 'rule-cascade',
      title: 'Rule Cascade',
      goal: `Satisfy all 31 rules in fewer than ${cap} keystrokes.`,
    }
  }
  if (pick === 1) {
    const lots = 2 + (day % 3)
    return {
      slug: 'auction',
      title: 'The Auction Game',
      goal: `Win at least ${lots} lots and still finish the sale up on the appraisal.`,
    }
  }
  if (pick === 2) {
    return {
      slug: 'dark-patterns',
      title: 'Dark Patterns',
      goal: `Get through at least ${dailyDodges(day)} of the 11 websites without falling for the trick.`,
    }
  }
  return {
    slug: 'trolley',
    title: 'Trolley',
    goal: `Argue for one ethical position at least ${dailyConsistency(day)}% of the time, across all 26 levers.`,
  }
}

/* The daily targets, exposed so each game can grade itself against the same
   number the homepage printed. */
const dayOf = (date: Date) => Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86_400_000)
function dailyDodges(day: number) { return 8 + (day % 3) }
function dailyConsistency(day: number) { return 80 + (day % 3) * 5 }
export const dailyTarget = {
  dodges: (date: Date) => dailyDodges(dayOf(date)),
  consistency: (date: Date) => dailyConsistency(dayOf(date)),
}
