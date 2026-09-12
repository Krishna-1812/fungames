/**
 * Dark Patterns — eleven manipulative UI tricks, named the way the people who
 * study them actually name them, with a live fake widget built to demonstrate
 * each one rather than just describe it.
 *
 * Every `real` field cites the actual published taxonomy a pattern comes from
 * — Harry Brignull's original 2010 list (the man who coined "dark pattern"),
 * the Princeton/CHI 2019 "Dark Patterns at Scale" study of eleven thousand
 * shopping sites, or the FTC's 2022 "Bringing Dark Patterns to Light" report —
 * rather than an invented, vibes-based name for the same idea. This file is
 * data only; `src/pages/dark-patterns.astro` supplies one `mount()` function
 * per `id` and `scripts/check-dark-patterns.mjs` proves the two lists match.
 */
export type Pattern = {
  id: string
  title: string
  /** The fake domain shown in the browser chrome — a different invented site
   *  for every pattern, so this reads as eleven places rather than one. */
  site: string
  /** The catalogued name and source — what makes this a documented pattern
   *  rather than an invented one. */
  real: string
  /** Set-up copy shown before the widget, in the second person, present tense
   *  — you are about to do the ordinary thing, not warned about a trick. */
  lede: string
  /** What actually happened, shown after you interact. Names the mechanism. */
  reveal: string
}

export const PATTERNS: Pattern[] = [
  {
    id: 'basket',
    title: 'Sneak into Basket',
    site: 'fenwickandoates.com',
    real: 'Brignull, Dark Patterns (2010)',
    lede: 'Fenwick & Oates sells three things. Buy one.',
    reveal:
      'The basket you land on is never just the thing you clicked. A "protection plan" and a second, unrelated item ride along, pre-checked, priced small enough to not be worth the trouble of noticing.',
  },
  {
    id: 'confirmshame',
    title: 'Confirmshaming',
    site: 'dailybrewblog.com',
    real: 'Brignull, Dark Patterns (2010)',
    lede: 'A newsletter wants your email before you can close this.',
    reveal:
      'The two options were never balanced. One is a plain button. The other is a sentence written to make declining feel like a personality flaw, which is the entire mechanism — no dark pattern here touches your data until the guilt does its work first.',
  },
  {
    id: 'roach',
    title: 'Roach Motel',
    site: 'chorusplus.tv',
    real: 'Brignull, Dark Patterns (2010)',
    lede: 'Cancel a subscription to Chorus+.',
    reveal:
      "Easy in, hard out — the pattern's own name, coined for exactly this shape. Every retention screen you clicked through is a real, commonly reported design: a discount you did not ask for, a guilt-trip about what you will miss, and a final step that quietly requires a phone call during business hours.",
  },
  {
    id: 'urgency',
    title: 'False Urgency',
    site: 'get-it-now.deals',
    real: 'FTC, Bringing Dark Patterns to Light (2022)',
    lede: 'A sale is ending. The countdown says how soon.',
    reveal:
      'Let it hit zero. The clock was never counting down to anything — it quietly resets itself, because the deadline was never a real inventory or calendar event. It exists to make you decide before you think, which is the entire function of a countdown that cannot actually run out.',
  },
  {
    id: 'ads',
    title: 'Disguised Ads',
    site: 'freewaredepot.net',
    real: 'Brignull, Dark Patterns (2010)',
    lede: 'Download the file from this page.',
    reveal:
      "Three of those four buttons were adverts styled to look exactly like the download you came for, on a page that put the real one last and smallest. This is the oldest pattern on this list — free-software download pages have used it for over twenty years.",
  },
  {
    id: 'drip',
    title: 'Drip Pricing',
    site: 'ticketloop.live',
    real: 'Princeton/CHI, Dark Patterns at Scale (2019)',
    lede: 'A ticket costs $45. Buy it.',
    reveal:
      'The price you compared against every other site was never the price you were going to pay. A service fee, a facility fee, a "convenience" fee and a fee for processing the fee only appear once you have already committed to checking out — each one small enough on its own to not be worth abandoning the cart over.',
  },
  {
    id: 'continuity',
    title: 'Forced Continuity',
    site: 'loomline.app',
    real: 'Brignull, Dark Patterns (2010)',
    lede: 'Start a free trial of Loomline Pro.',
    reveal:
      "The trial was free. What happens after it was disclosed, truthfully, in a sentence sized and placed so that reading it was never really part of the plan — a real card number, taken up front, that starts billing the moment the free part ends unless you find your own way back here first.",
  },
  {
    id: 'trick',
    title: 'Trick Questions',
    site: 'accountsettings.io',
    real: 'Brignull, Dark Patterns (2010)',
    lede: 'Turn tracking off in these settings. Just that.',
    reveal:
      'Every checkbox on that screen was worded as a double negative, precisely so that the "obviously correct" click leaves you in the state you were trying to leave. Reading each one twice was not caution — it was the only way this pattern loses.',
  },
  {
    id: 'zuckering',
    title: 'Privacy Zuckering',
    site: 'frennet.social',
    real: "Brignull, Dark Patterns (2010) — named for Mark Zuckerberg",
    lede: 'Set your privacy for FrenNet.',
    reveal:
      "One button is enormous, green, and does the sharing platform wants. The path to actually restricting anything is a grey link in a sentence, one click smaller at every step, and this exact shape has a name because one platform ran it on billions of people for over a decade.",
  },
  {
    id: 'social',
    title: 'Fake Social Proof',
    site: 'shopnimbus.store',
    real: 'Princeton/CHI, Dark Patterns at Scale (2019)',
    lede: 'Watch the corner of this product page for a while.',
    reveal:
      "Every one of those notifications was drawn from the same three names and the same three cities, and every one said \"2 minutes ago\" no matter how long you actually watched. Real activity does not repeat on a fixed loop — manufactured urgency does.",
  },
  {
    id: 'nagging',
    title: 'Nagging',
    site: 'dailybriefing.news',
    real: 'Princeton/CHI, Dark Patterns at Scale (2019)',
    lede: 'A site would like to send you notifications.',
    reveal:
      "Declining was never the end of the question — only of that particular asking. The same prompt was always going to come back, on the theory that the number of times you will type the word \"no\" has a limit, and eventually you will just click yes to make it stop.",
  },
]
