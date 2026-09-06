/**
 * Trolley's twenty-six problems.
 *
 * The reference game shows "what % of players chose this", which needs a backend
 * collecting votes. Rather than invent plausible-looking percentages, every
 * problem here records what each of four ethical positions actually says about
 * it, and the ending scores your answers against all four. The numbers at the
 * end are therefore about you and nothing else — no fabricated crowd.
 *
 * `endorse` is the content. Writing it forces a real judgement on every case:
 * a position either takes a side or is explicitly recorded as having nothing to
 * say, and scripts/check-trolley.mjs checks that the four stay far enough apart
 * to be worth distinguishing.
 */

export type Position = 'util' | 'deon' | 'contract' | 'virtue'

export const POSITIONS: Record<Position, { name: string; short: string }> = {
  util: {
    name: 'Utilitarian',
    short: 'Add up the outcomes and take the better total. Who caused it does not enter into it.',
  },
  deon: {
    name: 'Deontologist',
    short: 'Some things may not be done to people, whatever the arithmetic says. Killing is not the same as letting die.',
  },
  contract: {
    name: 'Contractualist',
    short: 'A choice is justified if nobody it falls on could reasonably reject it. Consent and prior agreement do real work.',
  },
  virtue: {
    name: 'Virtue ethicist',
    short: 'Ask what the choice makes of you. Loyalty, courage and not handing the decision to someone else all count.',
  },
}

export type Side = 'left' | 'right'

export type Option = {
  label: string
  /** How many people die if you pick this. */
  deaths: number
  /** Did you actively intervene? The act/omission distinction turns on it. */
  acts: boolean
  outcome: string
}

export type Token = {
  kind: 'people' | 'friend' | 'you' | 'lobsters' | 'chickens' | 'crowd' | 'box' | 'driver' | 'empty'
  n: number
  consent?: boolean
  /** Shown under a crowd, where drawing n figures is not an option. */
  label?: string
}

export type Scene = {
  straight: Token
  branch: Token
  /** The branch rejoins the main line at the same person. */
  loop?: boolean
  /** The lever is not connected to anything. */
  dead?: boolean
  money?: boolean
  /** A footbridge over the track, with someone on it. There is no lever. */
  bridge?: boolean
}

export type Dilemma = {
  title: string
  setup: string
  scene: Scene
  left: Option
  right: Option
  /**
   * What each position says. A position that genuinely has nothing to say about
   * a case is left out rather than given a side it does not hold.
   */
  endorse: Partial<Record<Position, Side>>
}

export const DILEMMAS: Dilemma[] = [
  {
    title: 'The original',
    setup: 'A trolley is heading towards five people. You can pull a lever to divert it onto a track with one person.',
    scene: { straight: { kind: 'people', n: 5 }, branch: { kind: 'people', n: 1 } },
    left: { label: 'Do nothing', deaths: 5, acts: false, outcome: 'Five people die. You did not touch anything.' },
    right: { label: 'Pull the lever', deaths: 1, acts: true, outcome: 'One person dies, because of a decision you made.' },
    endorse: { util: 'right', deon: 'left', contract: 'right', virtue: 'right' },
  },
  {
    title: 'The maths',
    setup: 'The trolley is heading towards one person. Pulling the lever diverts it onto a track with five people.',
    scene: { straight: { kind: 'people', n: 1 }, branch: { kind: 'people', n: 5 } },
    left: { label: 'Do nothing', deaths: 1, acts: false, outcome: 'One person dies. This was the easy one.' },
    right: { label: 'Pull the lever', deaths: 5, acts: true, outcome: 'Five people die and it is entirely your fault.' },
    endorse: { util: 'left', deon: 'left', contract: 'left', virtue: 'left' },
  },
  {
    title: 'The friend',
    setup: 'Five strangers are on the main track. Your closest friend is on the other.',
    scene: { straight: { kind: 'people', n: 5 }, branch: { kind: 'friend', n: 1 } },
    left: { label: 'Do nothing', deaths: 5, acts: false, outcome: 'Five strangers die. Your friend never finds out how close it was.' },
    right: { label: 'Pull the lever', deaths: 1, acts: true, outcome: 'You saved five people. You will not be telling anyone how.' },
    endorse: { util: 'right', deon: 'left', contract: 'right', virtue: 'left' },
  },
  {
    title: 'The footbridge',
    setup: 'Five people are on the track. You are on a footbridge above it, beside a very large stranger. Pushing them off would stop the trolley. There is no lever.',
    scene: { straight: { kind: 'people', n: 5 }, branch: { kind: 'empty', n: 0 }, bridge: true },
    left: { label: 'Do nothing', deaths: 5, acts: false, outcome: 'Five people die. The stranger beside you never learns what you were considering.' },
    right: { label: 'Push them', deaths: 1, acts: true, outcome: 'It works. You have stopped a trolley with a person.' },
    // The case that splits utilitarianism from everything else: the arithmetic
    // is identical to the original, and almost nobody answers it the same way.
    endorse: { util: 'right', deon: 'left', contract: 'left', virtue: 'left' },
  },
  {
    title: 'The box',
    setup: 'Five people are on the main track. The other track disappears into a large opaque box. You have no idea what is inside.',
    scene: { straight: { kind: 'people', n: 5 }, branch: { kind: 'box', n: 1 } },
    left: { label: 'Do nothing', deaths: 5, acts: false, outcome: 'Five people die. The box remains a mystery.' },
    right: { label: 'Pull the lever', deaths: 2, acts: true, outcome: 'It was two people and a lot of packing foam. You got lucky.' },
    endorse: { util: 'right', deon: 'left', contract: 'right', virtue: 'left' },
  },
  {
    title: 'The lobsters',
    setup: 'One person is on the main track. Five lobsters are on the other. The lobsters are, by all accounts, having a lovely time.',
    scene: { straight: { kind: 'people', n: 1 }, branch: { kind: 'lobsters', n: 5 } },
    left: { label: 'Do nothing', deaths: 1, acts: false, outcome: 'A person dies. The lobsters continue their lovely time.' },
    right: { label: 'Pull the lever', deaths: 0, acts: true, outcome: 'Five lobsters die. Nobody counts this as a death, including us.' },
    endorse: { util: 'right', deon: 'left', contract: 'right', virtue: 'right' },
  },
  {
    title: 'The offer',
    setup: 'The trolley is heading towards an empty track. Nobody is in danger. If you pull the lever, one person dies and you are given one million dollars.',
    scene: { straight: { kind: 'empty', n: 0 }, branch: { kind: 'people', n: 1 }, money: true },
    left: { label: 'Do nothing', deaths: 0, acts: false, outcome: 'Nothing happens. You remain poor and blameless.' },
    right: { label: 'Pull the lever', deaths: 1, acts: true, outcome: 'A person dies. You are now rich and everyone knows why.' },
    endorse: { util: 'left', deon: 'left', contract: 'left', virtue: 'left' },
  },
  {
    title: 'The consent',
    setup: 'Five people are tied to the main track, and all five have signed a form saying they accept the risk. One person on the other track signed nothing and is very annoyed.',
    scene: { straight: { kind: 'people', n: 5, consent: true }, branch: { kind: 'people', n: 1 } },
    left: { label: 'Do nothing', deaths: 5, acts: false, outcome: 'Five consenting people die. The paperwork is in order.' },
    right: { label: 'Pull the lever', deaths: 1, acts: true, outcome: 'One non-consenting person dies. The paperwork is not in order.' },
    // The one case where contractualism and utilitarianism come apart cleanly:
    // five people agreed to the risk and the sixth agreed to nothing.
    endorse: { util: 'right', deon: 'left', contract: 'left', virtue: 'right' },
  },
  {
    title: 'The arm',
    setup: 'Five people are on the main track. The lever is welded to a stranger’s forearm. Pulling it will save the five and break the arm. The stranger is shouting.',
    scene: { straight: { kind: 'people', n: 5 }, branch: { kind: 'empty', n: 0 } },
    left: { label: 'Do nothing', deaths: 5, acts: false, outcome: 'Five people die. The stranger’s arm is fine.' },
    right: { label: 'Pull the lever', deaths: 0, acts: true, outcome: 'Nobody dies. One person will need a cast and an explanation.' },
    endorse: { util: 'right', deon: 'left', contract: 'left', virtue: 'right' },
  },
  {
    title: 'The self',
    setup: 'Five people are on the main track. On the other track is you, forty years from now.',
    scene: { straight: { kind: 'people', n: 5 }, branch: { kind: 'you', n: 1 } },
    left: { label: 'Do nothing', deaths: 5, acts: false, outcome: 'Five people die. You go on to have a long life about it.' },
    right: { label: 'Pull the lever', deaths: 1, acts: true, outcome: 'You die, eventually, on schedule, on a train track.' },
    endorse: { util: 'right', deon: 'left', contract: 'right', virtue: 'right' },
  },
  {
    title: 'The sleeping driver',
    setup: 'The trolley has a driver, asleep at the controls, heading for five people. You can wake them. They will then have to decide, and they will divert onto the one.',
    scene: { straight: { kind: 'people', n: 5 }, branch: { kind: 'people', n: 1 }, },
    left: { label: 'Do nothing', deaths: 5, acts: false, outcome: 'Five people die and the driver sleeps through it.' },
    right: { label: 'Wake the driver', deaths: 1, acts: true, outcome: 'One person dies. The driver made the call. You made the driver make the call.' },
    // Everything approves except virtue, which notices you have arranged not to
    // be the one who decided.
    endorse: { util: 'right', deon: 'right', contract: 'right', virtue: 'left' },
  },
  {
    title: 'The pointless lever',
    setup: 'Five people are on the track. The lever is not connected to anything. Pulling it will change nothing at all.',
    scene: { straight: { kind: 'people', n: 5 }, branch: { kind: 'empty', n: 0 }, dead: true },
    left: { label: 'Do nothing', deaths: 5, acts: false, outcome: 'Five people die and you stood still.' },
    right: { label: 'Pull the lever', deaths: 5, acts: true, outcome: 'Five people die and you tried. It made no difference. It may have made a difference to you.' },
    // Nothing changes in the world, so only the account of your character does.
    endorse: { virtue: 'right' },
  },
  {
    title: 'The loop',
    setup: 'One person is tied to the main track. The other track loops around and rejoins the first, at the exact spot where that same person is tied.',
    scene: { straight: { kind: 'people', n: 1 }, branch: { kind: 'empty', n: 0 }, loop: true },
    left: { label: 'Do nothing', deaths: 1, acts: false, outcome: 'They die.' },
    right: { label: 'Pull the lever', deaths: 1, acts: true, outcome: 'They die, slightly later, having watched you decide.' },
    // The loop is the case that embarrasses the means/side-effect distinction:
    // the outcome is identical and only the deontologist's route changes.
    endorse: { deon: 'left', virtue: 'left' },
  },
  {
    title: 'The delay',
    setup: 'Five people are on the main track and two on the other. Pulling the lever adds four minutes to the journey, and in four minutes one of the two would free themselves.',
    scene: { straight: { kind: 'people', n: 5 }, branch: { kind: 'people', n: 2 } },
    left: { label: 'Do nothing', deaths: 5, acts: false, outcome: 'Five die, promptly. Nobody had time to work through the arithmetic.' },
    right: { label: 'Pull the lever', deaths: 1, acts: true, outcome: 'One dies. The other worked their hands free at the third minute and is now walking home.' },
    endorse: { util: 'right', deon: 'left', contract: 'right', virtue: 'right' },
  },
  {
    title: 'The specks',
    setup: 'One person is on the main track. On the other track are fifty million people who will each get a single speck of dust in one eye.',
    scene: {
      straight: { kind: 'people', n: 1 },
      branch: { kind: 'crowd', n: 7, label: '50,000,000' },
    },
    left: { label: 'Do nothing', deaths: 1, acts: false, outcome: 'A person dies. Fifty million eyes remain clear.' },
    right: { label: 'Pull the lever', deaths: 0, acts: true, outcome: 'Nobody dies. Fifty million people blink, once, and forget about it.' },
    // Strict aggregation says fifty million tiny harms outweigh one death. That
    // is the conclusion, and it is the reason people distrust the method.
    endorse: { util: 'left', deon: 'right', contract: 'right', virtue: 'right' },
  },
  {
    title: 'The future',
    setup: 'Five people are on the main track. They are alive in two hundred years. On the other track is one person, alive today, whom you can see.',
    scene: { straight: { kind: 'people', n: 5 }, branch: { kind: 'people', n: 1 } },
    left: { label: 'Do nothing', deaths: 5, acts: false, outcome: 'Five people die, eventually, and none of them exist yet to mind.' },
    right: { label: 'Pull the lever', deaths: 1, acts: true, outcome: 'A person alive today dies, in front of you, for people who are not born.' },
    endorse: { util: 'right', deon: 'left', contract: 'right', virtue: 'left' },
  },
  {
    title: 'The chickens',
    setup: 'One person is on the main track. Ten thousand chickens are on the other.',
    scene: {
      straight: { kind: 'people', n: 1 },
      branch: { kind: 'chickens', n: 6, label: '10,000' },
    },
    left: { label: 'Do nothing', deaths: 1, acts: false, outcome: 'A person dies. Ten thousand chickens are unharmed and unaware.' },
    right: { label: 'Pull the lever', deaths: 0, acts: true, outcome: 'Ten thousand chickens die. The counter above does not move.' },
    endorse: { util: 'right', deon: 'left', contract: 'right', virtue: 'left' },
  },
  {
    title: 'The vote',
    setup: 'Five people are on the main track. They have taken a vote, three to two, that you should pull the lever. One person is on the other track. They did not get a vote.',
    scene: { straight: { kind: 'people', n: 5, consent: true }, branch: { kind: 'people', n: 1 } },
    left: { label: 'Do nothing', deaths: 5, acts: false, outcome: 'Five people die, two of whom voted against this and are, technically, vindicated.' },
    right: { label: 'Pull the lever', deaths: 1, acts: true, outcome: 'One person dies, having had no say in the procedure that killed them.' },
    endorse: { util: 'right', deon: 'left', contract: 'left', virtue: 'right' },
  },
  {
    title: 'The machine',
    setup: 'An automatic system assessed this in nine milliseconds and has already thrown the lever, towards the five. It has reasons. You can throw it back.',
    scene: { straight: { kind: 'people', n: 1 }, branch: { kind: 'people', n: 5 } },
    left: { label: 'Leave it', deaths: 5, acts: false, outcome: 'Five people die. The system logs the outcome as nominal.' },
    right: { label: 'Override it', deaths: 1, acts: true, outcome: 'One person dies. The system files a note that you intervened.' },
    endorse: { util: 'right', deon: 'left', contract: 'right', virtue: 'right' },
  },
  {
    title: 'The compensation',
    setup: 'Five people are on the main track and one on the other. The railway pays generous compensation to the families of anyone killed by an unattended trolley, and nothing at all where a member of the public intervened.',
    scene: { straight: { kind: 'people', n: 5 }, branch: { kind: 'people', n: 1 }, money: true },
    left: { label: 'Do nothing', deaths: 5, acts: false, outcome: 'Five people die and five families are paid. The railway considers the matter closed.' },
    right: { label: 'Pull the lever', deaths: 1, acts: true, outcome: 'One person dies and their family gets nothing, because you helped.' },
    endorse: { util: 'right', deon: 'left', contract: 'left', virtue: 'right' },
  },
  {
    title: 'The audience',
    setup: 'Five people are on the main track, one on the other, and the whole thing is being filmed. The footage will be shown to first-year ethics students for the next forty years.',
    scene: { straight: { kind: 'people', n: 5 }, branch: { kind: 'people', n: 1 } },
    left: { label: 'Do nothing', deaths: 5, acts: false, outcome: 'Five people die. The students will discuss what your stillness meant.' },
    right: { label: 'Pull the lever', deaths: 1, acts: true, outcome: 'One person dies. You will be a slide.' },
    endorse: { util: 'right', deon: 'left', contract: 'right', virtue: 'left' },
  },
  {
    title: 'The next one along',
    setup: 'Five people are on the main track. The other track has one person on it and, further down, another lever with another person standing at it, who will face exactly this decision.',
    scene: { straight: { kind: 'people', n: 5 }, branch: { kind: 'people', n: 1 } },
    left: { label: 'Do nothing', deaths: 5, acts: false, outcome: 'Five people die. The person at the next lever goes home having decided nothing.' },
    right: { label: 'Pull the lever', deaths: 1, acts: true, outcome: 'You have handed the trolley, and the problem, to a stranger further down the line.' },
    endorse: { util: 'right', deon: 'right', virtue: 'left' },
  },
  {
    title: 'The inventor',
    setup: 'Five people are on the main track. On the other track is the philosopher who invented the trolley problem.',
    scene: { straight: { kind: 'people', n: 5 }, branch: { kind: 'people', n: 1 } },
    left: { label: 'Do nothing', deaths: 5, acts: false, outcome: 'Five people die. The philosopher takes extensive notes.' },
    right: { label: 'Pull the lever', deaths: 1, acts: true, outcome: 'The trolley problem is now, in one narrow sense, solved.' },
    endorse: { util: 'right', deon: 'left', contract: 'right', virtue: 'right' },
  },
  {
    title: 'The empty track',
    setup: 'Five people are on the main track. The other track is empty. Completely empty. Nobody is on it and nothing will happen if you use it.',
    scene: { straight: { kind: 'people', n: 5 }, branch: { kind: 'empty', n: 0 } },
    left: { label: 'Do nothing', deaths: 5, acts: false, outcome: 'Five people die. There was an empty track right there.' },
    right: { label: 'Pull the lever', deaths: 0, acts: true, outcome: 'Nobody dies. This one was not a dilemma. You should still think about how long you took.' },
    endorse: { util: 'right', deon: 'right', contract: 'right', virtue: 'right' },
  },
  {
    title: 'The original, again',
    setup: 'A trolley is heading towards five people. You can pull a lever to divert it onto a track with one person. You have seen this one before.',
    scene: { straight: { kind: 'people', n: 5 }, branch: { kind: 'people', n: 1 } },
    left: { label: 'Do nothing', deaths: 5, acts: false, outcome: 'Five people die. Same as last time, if that is what you did last time.' },
    right: { label: 'Pull the lever', deaths: 1, acts: true, outcome: 'One person dies. Same as last time, if that is what you did last time.' },
    endorse: { util: 'right', deon: 'left', contract: 'right', virtue: 'right' },
  },
  {
    title: 'The last one',
    setup: 'The trolley is heading towards you. There is nobody else here. The lever is within reach and would divert it onto an empty track.',
    scene: { straight: { kind: 'you', n: 1 }, branch: { kind: 'empty', n: 0 } },
    left: { label: 'Do nothing', deaths: 1, acts: false, outcome: 'You have made a series of choices and this is the last one.' },
    right: { label: 'Pull the lever', deaths: 0, acts: true, outcome: 'Nobody dies. Notice how easy that was.' },
    endorse: { util: 'right', deon: 'right', contract: 'right', virtue: 'right' },
  },
]

/** Index of the problem that repeats the first one, so the ending can compare. */
export const REPEAT_OF_FIRST = DILEMMAS.findIndex((d) => d.title === 'The original, again')

/** How many problems each position takes a side on. */
export function coverage(): Record<Position, number> {
  const out = { util: 0, deon: 0, contract: 0, virtue: 0 }
  for (const d of DILEMMAS)
    for (const p of Object.keys(out) as Position[]) if (d.endorse[p]) out[p]++
  return out
}

/**
 * Score a set of answers against all four positions.
 *
 * The denominator is per position — how many problems it actually took a side
 * on — so a position that stays out of the pointless-lever case is not punished
 * for it.
 */
export function scoreAnswers(picks: (Side | null)[]) {
  const agree = { util: 0, deon: 0, contract: 0, virtue: 0 }
  const total = { util: 0, deon: 0, contract: 0, virtue: 0 }
  picks.forEach((side, i) => {
    if (!side || !DILEMMAS[i]) return
    for (const p of Object.keys(agree) as Position[]) {
      const view = DILEMMAS[i].endorse[p]
      if (!view) continue
      total[p]++
      if (view === side) agree[p]++
    }
  })
  return (Object.keys(agree) as Position[])
    .map((p) => ({
      key: p,
      name: POSITIONS[p].name,
      agreed: agree[p],
      of: total[p],
      pct: total[p] ? Math.round((agree[p] / total[p]) * 100) : 0,
    }))
    .sort((a, b) => b.pct - a.pct || a.key.localeCompare(b.key))
}
