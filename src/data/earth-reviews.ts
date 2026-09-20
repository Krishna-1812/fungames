/**
 * Earth Reviews — twenty-two real natural phenomena, physical laws and facts
 * of existence, reviewed by invented customers who did not ask for any of them.
 *
 * This is the one file on this site where the writing is deliberately comic
 * rather than factual. Everywhere else the register is dry and the numbers are
 * the point; here the numbers are still the point, but the copy is a joke. Both
 * halves have to hold:
 *
 *  - **The phenomena are real.** Gravity, the Moon, photosynthesis, entropy.
 *    Nothing invented, nothing mythological, nothing that needs explaining
 *    before the joke can land.
 *  - **The reviewers are not.** Every display name here is made up. No review
 *    targets a real, identifiable person, and nothing in this file is a retold
 *    version of anyone else's published joke — it is all written for this file.
 *  - **The arithmetic is real.** A phenomenon's displayed average is the actual
 *    mean of its own reviews' star ratings, and the star-distribution bars are
 *    the actual counts. `scripts/check-earth-reviews.mjs` proves both over every
 *    phenomenon rather than trusting the page to add up.
 *
 * Pure functions over plain data, no DOM, so the checker can run the same code
 * the page runs — the convention listed at the bottom of README's "Running it".
 *
 * ### The rounding rule, stated once
 *
 * A displayed average is the mean of the integer ratings, **rounded to one
 * decimal place, halves away from zero**. It is computed as
 * `Math.round(sum * 10 / n) / 10` rather than `Math.round((sum / n) * 10) / 10`
 * so the division happens exactly once: `sum` and `n` are integers, so
 * `sum * 10 / n` lands on a representable half whenever the true mean has one,
 * and 2.25 rounds to 2.3 rather than to whatever a second float operation
 * happened to leave it just under. Thirteen of the twenty-two phenomena average
 * exactly x.x5, so this is not a theoretical distinction.
 *
 * ### The dates
 *
 * Every `date` is invented and fixed. Nothing here is live and nothing updates:
 * "Most recent" sorts by a date somebody typed, and the page says so out loud
 * rather than implying a feed. They exist because a review site without dates
 * reads as a list of quotations, and because sorting by date has to actually
 * reorder something for the control to be worth having.
 */

export type Review = {
  /** Invented display name. Never a real, identifiable person. */
  name: string
  /** Integer, 1–5. */
  rating: number
  title: string
  body: string
  /** "N people found this helpful" — invented, fixed, and never sent anywhere. */
  helpful: number
  /** ISO date. Invented and static; see the note above. */
  date: string
}

export type Phenomenon = {
  /** Stable key. Also the art key in lib/earth-reviews-art.ts and the URL hash. */
  id: string
  name: string
  /** The storefront department, for the breadcrumb. */
  department: string
  /** One line of dry e-commerce product copy. */
  tagline: string
  /** Two other phenomena, for the "customers also regretted" row. */
  alsoRegretted: [string, string]
  reviews: Review[]
}

export const PHENOMENA: Phenomenon[] = [
  {
    id: 'gravity',
    name: 'Gravity',
    department: 'Fundamental Forces',
    tagline: 'Keeps everything where you left it, provided where you left it was the floor.',
    alsoRegretted: ['black-holes', 'growing-old'],
    reviews: [
      {
        name: 'Marla Vanterpool',
        rating: 1,
        title: 'Works too well',
        body: 'I have never once asked for this and it has never once stopped. Tried turning it off by jumping. It came back.',
        helpful: 3104,
        date: '2026-03-11',
      },
      {
        name: 'Desmond Okereke',
        rating: 5,
        title: 'Genuinely load-bearing',
        body: 'Complained about it for forty years, then read what happens without it. Withdrew the complaint the same afternoon.',
        helpful: 2211,
        date: '2025-11-02',
      },
      {
        name: 'Priya Anselm',
        rating: 2,
        title: 'Inconsistent coverage',
        body: 'Advertised as universal. Somehow the dust under my sofa is exempt and my keys are not, and support have not replied.',
        helpful: 640,
        date: '2026-01-19',
      },
      {
        name: 'Ivo Brandt',
        rating: 1,
        title: 'Arrived with a bookshelf I ordered',
        body: 'Came bundled, unasked, with a flat-pack unit I bought for the hallway. The unit is now doing something called sagging.',
        helpful: 418,
        date: '2026-05-27',
      },
    ],
  },
  {
    id: 'the-sun',
    name: 'The Sun',
    department: 'Celestial Bodies',
    tagline: 'A class G main-sequence star. One per system. Non-returnable.',
    alsoRegretted: ['photosynthesis', 'deserts'],
    reviews: [
      {
        name: 'Colette Ferreira',
        rating: 1,
        title: 'Too bright',
        body: 'Cannot be looked at, cannot be moved, cannot be dimmed. I have blinds, a hat and an opinion, and it has beaten all three.',
        helpful: 1889,
        date: '2026-07-04',
      },
      {
        name: 'Hal Ninnemann',
        rating: 4,
        title: 'Reliable but arrogant',
        body: 'Turns up every day without being asked, which I respect, and then stays for fourteen hours in June, which I do not.',
        helpful: 902,
        date: '2026-06-21',
      },
      {
        name: 'Renata Oyelaran',
        rating: 1,
        title: 'Burned my shoulders through a cloud',
        body: 'I was assured the cloud counted as cover. The cloud did not count as cover. I would review the cloud separately if it had a page.',
        helpful: 1455,
        date: '2025-08-13',
      },
      {
        name: 'Bertie Halloway',
        rating: 5,
        title: 'The garden has never looked better',
        body: 'Everything I planted in March is thriving and the tomatoes are ridiculous. Knocking nothing off, since the sunburn is arguably a skin issue.',
        helpful: 771,
        date: '2026-08-30',
      },
      {
        name: 'Yolande Prischke',
        rating: 2,
        title: 'Eight minutes late with everything',
        body: 'Every piece of information this product sends me is eight minutes and twenty seconds out of date on arrival. If it went out this morning I would not find out until I was most of the way through a sandwich.',
        helpful: 1988,
        date: '2026-02-08',
      },
    ],
  },
  {
    id: 'the-moon',
    name: 'The Moon',
    department: 'Celestial Bodies',
    tagline: 'A natural satellite, 384,400 km away. Visible most nights. No trial period.',
    alsoRegretted: ['the-ocean', 'time'],
    reviews: [
      {
        name: 'Yusuf Kellerman',
        rating: 3,
        title: 'Only ever shows one side',
        body: 'Four billion years and it has not turned around once. I do not know what is back there and at this point I am afraid to ask.',
        helpful: 1233,
        date: '2026-04-16',
      },
      {
        name: 'Doreen Slatterly',
        rating: 1,
        title: 'Ruined a fishing trip',
        body: 'The water simply left. Nobody told me at any point in my life that this thing operates the tide.',
        helpful: 688,
        date: '2025-09-28',
      },
      {
        name: 'Amara Tchen',
        rating: 5,
        title: 'Beautiful',
        body: 'I have taken nine hundred photographs of it and every single one came out as a pale smudge of rice. That is my camera failing, not the Moon.',
        helpful: 2604,
        date: '2026-10-02',
      },
      {
        name: 'Gus Pemberly',
        rating: 2,
        title: 'The phases are a subscription model',
        body: 'You get the complete product for about four nights a month. The rest of the time some of it is quietly withheld and nobody will tell me why.',
        helpful: 1071,
        date: '2026-01-05',
      },
    ],
  },
  {
    id: 'mondays',
    name: 'Mondays',
    department: 'Scheduling',
    tagline: 'The first business day of the standard working week. Ships weekly. No pause option.',
    alsoRegretted: ['time', 'entropy'],
    reviews: [
      {
        name: 'Nell Corvino',
        rating: 1,
        title: 'Arrives every seven days without fail',
        body: 'I have moved house twice and changed careers once. It found me both times.',
        helpful: 4402,
        date: '2026-09-07',
      },
      {
        name: 'Tobias Marchetti',
        rating: 1,
        title: 'Fraudulent product description',
        body: 'Marketed as a fresh start. Functions as an invoice for the weekend.',
        helpful: 3115,
        date: '2026-02-23',
      },
      {
        name: 'Winifred Oduya',
        rating: 4,
        title: 'Actually fine, and I need you all to stop telling people',
        body: 'Nobody books anything on a Monday because everyone assumes you are busy suffering. I get more done than the rest of the week combined.',
        helpful: 1980,
        date: '2025-10-20',
      },
      {
        name: 'Emeka Lindqvist',
        rating: 2,
        title: 'Bank holidays are not the win you think',
        body: 'You skip one and it simply re-attaches itself to Tuesday. The total quantity of Monday in the universe appears to be conserved.',
        helpful: 2444,
        date: '2026-05-04',
      },
    ],
  },
  {
    id: 'winter',
    name: 'Winter',
    department: 'Seasonal',
    tagline: 'A quarter of the year, delivered cold. Duration varies by latitude.',
    alsoRegretted: ['the-sun', 'jet-lag'],
    reviews: [
      {
        name: 'Freya Ostrander',
        rating: 1,
        title: 'Dark at four in the afternoon',
        body: 'I left the house in daylight and came back in what was clearly the middle of the night. It was twenty past four.',
        helpful: 2890,
        date: '2025-12-09',
      },
      {
        name: 'Lars Ibbotson',
        rating: 5,
        title: 'Perfect',
        body: 'Everything I dislike is asleep. The wasps are gone, the grass has stopped growing and nobody expects me outdoors. I would pay extra for a longer one.',
        helpful: 1620,
        date: '2026-01-14',
      },
      {
        name: 'Marguerite Dansby',
        rating: 2,
        title: 'The product is free, the accessories are not',
        body: 'Nothing about winter itself costs anything. Surviving it came to four hundred and ten pounds between November and March.',
        helpful: 1344,
        date: '2026-03-02',
      },
      {
        name: 'Callum Rhydderch',
        rating: 1,
        title: 'Wrong item sent',
        body: 'Ordered a crisp, bright, frost-on-the-hedge winter. Received four months of grey drizzle at six degrees. This is not the winter in the photographs.',
        helpful: 2077,
        date: '2026-02-11',
      },
    ],
  },
  {
    id: 'mosquitoes',
    name: 'Mosquitoes',
    department: 'Wildlife',
    tagline: 'A flying insect, approximately 3 mm. Locally sourced. Arrives in quantity.',
    alsoRegretted: ['allergies', 'the-ocean'],
    reviews: [
      {
        name: 'Sunita Ravenscroft',
        rating: 1,
        title: 'The noise is the worst part',
        body: 'Being bitten I could almost forgive. It is the twenty minutes of high-pitched reconnaissance beforehand, in the dark, at ear height.',
        helpful: 5211,
        date: '2026-07-19',
      },
      {
        name: 'Piotr Nkemdirim',
        rating: 1,
        title: 'Goes straight through fabric',
        body: 'I was assured that clothing worked. I have now been bitten through a sock, a tent and what I had believed to be a wall.',
        helpful: 1877,
        date: '2026-06-30',
      },
      {
        name: 'Delphine Aubrey-Marr',
        rating: 2,
        title: 'One star for the ecological role, one for persistence',
        body: 'I am told something eats these. I have never met it and I have serious questions about its commitment to the work.',
        helpful: 1401,
        date: '2025-08-22',
      },
      {
        name: 'Rufus Aldergate',
        rating: 1,
        title: 'Only bites me',
        body: 'Sat outside with four other people for three hours. Eleven bites. Everyone else got nothing. Either this is a personalised product or my blood is on some kind of list.',
        helpful: 3266,
        date: '2026-08-05',
      },
      {
        name: 'Otto Nwachukwu-Grey',
        rating: 5,
        title: 'Excellent at their job, and I want to be fair about it',
        body: 'Nothing else I have ever reviewed performs its intended function this reliably, this quietly, or this close to my ear.',
        helpful: 2544,
        date: '2026-07-27',
      },
    ],
  },
  {
    id: 'entropy',
    name: 'Entropy',
    department: 'Thermodynamics',
    tagline: 'The tendency of every closed system toward disorder. Applies automatically.',
    alsoRegretted: ['growing-old', 'time'],
    reviews: [
      {
        name: 'Ottoline Brack',
        rating: 1,
        title: 'Only goes one way',
        body: 'Every other product I own has a reverse. I have read the documentation twice and there is genuinely no undo.',
        helpful: 1755,
        date: '2026-04-01',
      },
      {
        name: 'Ken Abiodun-Reilly',
        rating: 3,
        title: 'Explains a lot, fixes nothing',
        body: 'I now know exactly why the kitchen becomes a mess on its own. The kitchen still becomes a mess on its own.',
        helpful: 2212,
        date: '2025-11-16',
      },
      {
        name: 'Hester Vaillancourt',
        rating: 5,
        title: 'The only honest listing in the catalogue',
        body: 'Everything else here implies it might work out. This one tells you up front precisely how it ends and then does exactly that, on schedule, forever.',
        helpful: 3390,
        date: '2026-06-12',
      },
      {
        name: 'Barnaby Ellsworth-Quayle',
        rating: 2,
        title: 'Made my tea cold',
        body: 'Left it for nine minutes. Came back to a mug of disappointment at room temperature. Apparently this is working as intended.',
        helpful: 1102,
        date: '2026-03-25',
      },
    ],
  },
  {
    id: 'death',
    name: 'Death',
    department: 'Lifecycle Management',
    tagline: 'The permanent cessation of biological function. One per customer. Final sale.',
    alsoRegretted: ['growing-old', 'entropy'],
    reviews: [
      {
        name: 'Ferdinand Marchbank',
        rating: 1,
        title: 'No returns policy',
        body: 'I have read the terms four times. There is no returns policy. There is not even an address to write to.',
        helpful: 8804,
        date: '2026-05-18',
      },
      {
        name: 'Constance Aitchison',
        rating: 1,
        title: 'Delivery window far too vague',
        body: 'Somewhere between this afternoon and eighty years from now. I cannot plan around that and I have tried.',
        helpful: 6120,
        date: '2026-02-27',
      },
      {
        name: 'Mirembe Halloran',
        rating: 5,
        title: 'Gives everything else its value',
        body: 'It took me sixty-one years to work out that this is the entire reason any of the rest of it counts. Still not looking forward to it.',
        helpful: 7441,
        date: '2025-12-30',
      },
      {
        name: 'Jonas Petrakis',
        rating: 2,
        title: 'Universally available, universally unwelcome',
        body: 'The one item in this catalogue with genuinely global distribution, and not one customer has ever come back to review it afterwards.',
        helpful: 5388,
        date: '2026-08-14',
      },
    ],
  },
  {
    id: 'hiccups',
    name: 'Hiccups',
    department: 'Bodily Functions',
    tagline: 'An involuntary spasm of the diaphragm. Repeats at irregular intervals.',
    alsoRegretted: ['allergies', 'static-electricity'],
    reviews: [
      {
        name: 'Lacey Thorogood',
        rating: 1,
        title: 'No off switch',
        body: 'Tried water, tried a fright, tried holding my breath, tried a teaspoon of sugar recommended by a stranger in a car park. It stopped forty minutes later on its own, having ignored all four.',
        helpful: 2933,
        date: '2026-04-22',
      },
      {
        name: 'Dev Rasmussen',
        rating: 2,
        title: 'Stops the moment you mention it',
        body: 'Had them for an hour. Told a colleague. Gone. Told him they had gone. Back.',
        helpful: 1866,
        date: '2026-01-30',
      },
      {
        name: 'Odile Vantongeren',
        rating: 1,
        title: 'Struck during a presentation',
        body: 'Slide four of nineteen. It did not let up until slide fifteen. My colleagues were extremely kind about it, which was worse.',
        helpful: 2410,
        date: '2025-10-08',
      },
      {
        name: 'Bram Oyekan',
        rating: 4,
        title: 'The best reminder available that I am a machine made of meat',
        body: 'Nothing else I own does something this stupid entirely without my permission. Genuinely humbling, four stars.',
        helpful: 1188,
        date: '2026-06-03',
      },
    ],
  },
  {
    id: 'jet-lag',
    name: 'Jet Lag',
    department: 'Travel Accessories',
    tagline: 'A temporal misalignment supplied free with long-haul travel. No opt-out at checkout.',
    alsoRegretted: ['time', 'mondays'],
    reviews: [
      {
        name: 'Nerissa Coutts',
        rating: 1,
        title: 'Bundled without consent',
        body: 'I paid for a flight. I received a flight and four consecutive nights of being awake at three in the morning thinking about a conversation from 2011.',
        helpful: 3104,
        date: '2026-03-18',
      },
      {
        name: 'Hugo Mwanza-Beattie',
        rating: 1,
        title: 'Considerably worse in one direction',
        body: 'Flew east and lost a week. Flew home and lost nothing at all. Nobody at the airline could explain the asymmetry and one of them laughed.',
        helpful: 1729,
        date: '2025-09-11',
      },
      {
        name: 'Saoirse Duplantis',
        rating: 3,
        title: 'Six free early mornings',
        body: 'I was up at five for most of a week and got more done before breakfast than I usually manage in a fortnight. Then it wore off and I went back to being me.',
        helpful: 1493,
        date: '2026-07-09',
      },
      {
        name: 'Gerald Ffoulkes',
        rating: 2,
        title: 'Reviewing the hotel, actually',
        body: 'Two stars. Breakfast finished at nine, I was asleep at nine and awake at two, and at this stage I genuinely cannot work out whose fault that is.',
        helpful: 987,
        date: '2026-05-06',
      },
    ],
  },
  {
    id: 'the-ocean',
    name: 'The Ocean',
    department: 'Water Features',
    tagline: '361 million square kilometres of salt water. Sold as seen. Depth varies.',
    alsoRegretted: ['deserts', 'the-moon'],
    reviews: [
      {
        name: 'Imogen Haverstock',
        rating: 1,
        title: 'Salt',
        body: 'Why. Nobody has ever answered this. It is the largest body of water on the planet and not one drop of it is any use to a thirsty person.',
        helpful: 4022,
        date: '2026-06-26',
      },
      {
        name: 'Teodor Balan',
        rating: 5,
        title: 'Enormous',
        body: 'Went to look at it. It was much larger than I expected, and I had already expected it to be quite large. Sat down for two hours.',
        helpful: 3611,
        date: '2026-08-19',
      },
      {
        name: 'Annike Saltzmann',
        rating: 2,
        title: 'Contents not clearly listed',
        body: 'Around eighty per cent of it has never been mapped. Imagine buying anything else where the seller shrugs about four fifths of it.',
        helpful: 2870,
        date: '2025-11-29',
      },
      {
        name: 'Clive Okonjo-Bright',
        rating: 1,
        title: 'Took my sunglasses',
        body: 'One wave. Forty pounds. It has not offered to return them and there is no one to contact.',
        helpful: 1622,
        date: '2026-07-31',
      },
      {
        name: 'Perpetua Kaneko-Bright',
        rating: 3,
        title: 'Comes with the weather attached',
        body: 'I did not fully appreciate when I moved near it that I was also moving near everything it decides to do to the sky.',
        helpful: 1433,
        date: '2026-02-17',
      },
    ],
  },
  {
    id: 'volcanoes',
    name: 'Volcanoes',
    department: 'Geology',
    tagline: 'A rupture in the crust through which molten rock is delivered. Schedule not published.',
    alsoRegretted: ['earthquakes', 'deserts'],
    reviews: [
      {
        name: 'Serafina Volkov',
        rating: 1,
        title: 'No notice period',
        body: 'Lived there eleven years. At no point did anyone mention that the mountain was a temporary arrangement.',
        helpful: 2044,
        date: '2026-04-09',
      },
      {
        name: 'Emmanuel Draycott',
        rating: 4,
        title: 'Makes outstanding soil',
        body: 'Genuinely the best tomatoes I have grown anywhere, and I now understand completely why people keep moving back. Docking one star for the obvious.',
        helpful: 1755,
        date: '2026-05-21',
      },
      {
        name: 'Kira Hollandsworth',
        rating: 2,
        title: 'Very loud',
        body: 'I was told it would be spectacular and it was spectacular. It was also audible from a hundred and sixty kilometres away, and the ash got inside a sealed jar.',
        helpful: 1288,
        date: '2025-10-27',
      },
      {
        name: 'Ade Fairweather',
        rating: 5,
        title: 'This is where the land came from',
        body: 'Everyone leaving one star is standing on the previous review.',
        helpful: 3902,
        date: '2026-09-03',
      },
    ],
  },
  {
    id: 'earthquakes',
    name: 'Earthquakes',
    department: 'Geology',
    tagline: 'A sudden release of accumulated strain along a fault. Frequency: eventually.',
    alsoRegretted: ['volcanoes', 'quicksand'],
    reviews: [
      {
        name: 'Thandiwe Brockhurst',
        rating: 1,
        title: 'Moved the entire floor',
        body: 'The floor. The one item in the house I had not budgeted for moving.',
        helpful: 2611,
        date: '2026-03-06',
      },
      {
        name: 'Rasmus Olalekan',
        rating: 2,
        title: 'Aftershocks were not in the listing',
        body: 'You get the main event and then an unspecified number of smaller ones over the following weeks, each of which makes you put your cup down.',
        helpful: 1503,
        date: '2026-06-17',
      },
      {
        name: 'Bibi Arkwright',
        rating: 1,
        title: 'My shelf fell down',
        body: 'I want to be clear that I hold the shelf partly responsible for this.',
        helpful: 1944,
        date: '2025-12-04',
      },
      {
        name: 'Peregrine Nakamura-Boyle',
        rating: 3,
        title: 'Extremely well studied, entirely unpredictable',
        body: 'People have given whole careers to forecasting these and the honest answer is still "somewhere on this fault, within thirty years". Three stars for the honesty.',
        helpful: 2205,
        date: '2026-08-08',
      },
    ],
  },
  {
    id: 'black-holes',
    name: 'Black Holes',
    department: 'Celestial Bodies',
    tagline: 'A region where gravitation prevents escape. Mass varies. No collection available.',
    alsoRegretted: ['gravity', 'time'],
    reviews: [
      {
        name: 'Zephyr Aldington',
        rating: 1,
        title: 'Kept the light',
        body: 'I sent light in. Standard procedure, I was told. That was four years ago.',
        helpful: 3355,
        date: '2026-01-23',
      },
      {
        name: 'Marisol Fenwyck',
        rating: 5,
        title: 'Exactly as described',
        body: 'The listing said nothing escapes. Nothing escaped. This is the most accurate product description I have encountered anywhere.',
        helpful: 5102,
        date: '2026-07-14',
      },
      {
        name: 'Oskar Vennerstrom',
        rating: 2,
        title: 'Confusing time policy',
        body: 'I watched a friend fall in. From where I am standing he is still falling in. He has been still falling in since Tuesday and I have things to do.',
        helpful: 2790,
        date: '2026-04-28',
      },
      {
        name: 'Junipero Blaise',
        rating: 1,
        title: 'Spaghettification',
        body: 'One star. I will not be elaborating and I am no longer in a position to.',
        helpful: 4413,
        date: '2025-09-19',
      },
    ],
  },
  {
    id: 'static-electricity',
    name: 'Static Electricity',
    department: 'Fundamental Forces',
    tagline: 'A surface charge imbalance, discharged on contact. Included with most carpets.',
    alsoRegretted: ['lightning', 'winter'],
    reviews: [
      {
        name: 'Rowan Pyke-Ashby',
        rating: 1,
        title: 'Attacked me at a petrol station',
        body: 'I have done nothing to this planet and it electrocuted me for touching a car I had already paid for.',
        helpful: 1866,
        date: '2026-02-02',
      },
      {
        name: 'Marisa Oyibo',
        rating: 2,
        title: 'Free with every jumper',
        body: 'Take the jumper off in a dark room and it is genuinely quite good. Put your hand on a door handle nine seconds later and it is genuinely not.',
        helpful: 1477,
        date: '2025-12-16',
      },
      {
        name: 'Hadley Prosser',
        rating: 3,
        title: 'Only performs when unwanted',
        body: 'I spent a whole afternoon trying to reproduce it for a child and got nothing. Reached for the fridge on Tuesday with no audience at all and got the full experience.',
        helpful: 1290,
        date: '2026-05-13',
      },
      {
        name: 'Nkechi Vandermolen',
        rating: 1,
        title: 'My hair',
        body: 'I took a hat off in front of approximately forty people. That is all I am prepared to say about it.',
        helpful: 2088,
        date: '2026-01-11',
      },
    ],
  },
  {
    id: 'lightning',
    name: 'Lightning',
    department: 'Fundamental Forces',
    tagline: 'An electrostatic discharge of roughly a billion joules. Around 44 events per second worldwide.',
    alsoRegretted: ['static-electricity', 'volcanoes'],
    reviews: [
      {
        name: 'Theodora Mbeki-Lund',
        rating: 1,
        title: 'Extremely loud',
        body: 'The light arrives first and then you get about four seconds to think about what is coming. I consider that a design flaw rather than a courtesy.',
        helpful: 2711,
        date: '2026-06-08',
      },
      {
        name: 'Wilbur Achebe-Strand',
        rating: 5,
        title: 'Best thing in the sky',
        body: 'I have paid real money for fireworks. This is free, considerably bigger, and does not smell.',
        helpful: 3844,
        date: '2026-07-22',
      },
      {
        name: 'Georgiana Twist',
        rating: 1,
        title: 'Hit my tree',
        body: 'Reviewing the tree as well, one star, it had precisely one job and it did it.',
        helpful: 2166,
        date: '2025-08-29',
      },
      {
        name: 'Idris Fennimore',
        rating: 2,
        title: 'Struck the same place twice',
        body: 'The saying is wrong and I have both the photographs and the insurance correspondence to prove it.',
        helpful: 1955,
        date: '2026-04-04',
      },
    ],
  },
  {
    id: 'time',
    name: 'Time',
    department: 'Scheduling',
    tagline: 'A monotonic, one-directional quantity. Rate fixed at one second per second.',
    alsoRegretted: ['entropy', 'mondays'],
    reviews: [
      {
        name: 'Beatrix Onyango-Hale',
        rating: 1,
        title: 'Speed is wildly inconsistent',
        body: 'Advertised at a constant rate. A dentist’s waiting room and a Sunday afternoon are plainly not running the same product and I would like this investigated.',
        helpful: 6241,
        date: '2026-05-30',
      },
      {
        name: 'Casimir Bly',
        rating: 1,
        title: 'Cannot be saved for later',
        body: 'There is no way to bank any of it. You either use it or it is simply gone, which is the worst storage policy I have ever encountered.',
        helpful: 4802,
        date: '2026-02-05',
      },
      {
        name: 'Antonia Kestrel-Vaughn',
        rating: 4,
        title: 'Extremely well made',
        body: 'Has not lost a second in 13.8 billion years. Show me another product with that service record.',
        helpful: 3577,
        date: '2026-08-26',
      },
      {
        name: 'Olufemi Barrowclough',
        rating: 2,
        title: 'Far too slow and then far too fast',
        body: 'My twenties took nine hundred years. My thirties arrived in a single Thursday.',
        helpful: 5119,
        date: '2026-03-29',
      },
      {
        name: 'Ezekiel Wren-Achebe',
        rating: 5,
        title: 'Cannot be argued with',
        body: 'I have tried. In a car park, at four in the afternoon, out loud. It continued.',
        helpful: 2911,
        date: '2025-11-08',
      },
    ],
  },
  {
    id: 'photosynthesis',
    name: 'Photosynthesis',
    department: 'Plant Care',
    tagline: 'Converts light, water and carbon dioxide into sugar and oxygen. Runs in daylight.',
    alsoRegretted: ['the-sun', 'deserts'],
    reviews: [
      {
        name: 'Ingrid Osei-Mensah',
        rating: 5,
        title: 'Makes the air',
        body: 'I would gently point out to the other reviewers on this page that they are breathing while typing.',
        helpful: 4266,
        date: '2026-09-12',
      },
      {
        name: 'Norbert Chiwetel-Frank',
        rating: 1,
        title: 'Does not work on me',
        body: 'Stood outside for three hours holding a glass of water. Still hungry.',
        helpful: 3911,
        date: '2026-06-01',
      },
      {
        name: 'Susannah Leverett',
        rating: 3,
        title: 'Slow',
        body: 'Two and a half billion years to oxygenate the atmosphere. I accept it was a large job, but there was no communication at all during the process.',
        helpful: 1688,
        date: '2025-10-14',
      },
      {
        name: 'Emil Ngata-Boothroyd',
        rating: 4,
        title: 'Efficiency is honestly a bit disappointing',
        body: 'Somewhere between three and six per cent of the light landing on a leaf becomes anything at all. My solar panels manage twenty. Four stars because my solar panels cannot make a tree.',
        helpful: 2033,
        date: '2026-04-19',
      },
    ],
  },
  {
    id: 'deserts',
    name: 'Deserts',
    department: 'Terrain',
    tagline: 'An arid region receiving under 250 mm of rain a year. Roughly a fifth of the land surface.',
    alsoRegretted: ['the-sun', 'the-ocean'],
    reviews: [
      {
        name: 'Georgia Fanshawe-Idowu',
        rating: 1,
        title: 'No water',
        body: 'This is the entire review.',
        helpful: 3188,
        date: '2026-07-06',
      },
      {
        name: 'Adisa Trenholm',
        rating: 2,
        title: 'Hot and then immediately freezing',
        body: 'Forty-one degrees at three in the afternoon and close to zero by two in the morning. Pick one.',
        helpful: 1922,
        date: '2026-05-25',
      },
      {
        name: 'Linnea Ferreira-Akpan',
        rating: 5,
        title: 'The stars',
        body: 'Nowhere else on this planet is this dark. I have now seen the Milky Way with my own eyes and I have no further complaints about the sand.',
        helpful: 2755,
        date: '2026-03-14',
      },
      {
        name: 'Marcus Oyibo-Delacroix',
        rating: 1,
        title: 'Sand in absolutely everything',
        body: 'Every seam, every lens, every sandwich, the inside of a sealed camera bag, and somehow the glove compartment of a car I did not take with me.',
        helpful: 2311,
        date: '2025-09-05',
      },
    ],
  },
  {
    id: 'allergies',
    name: 'Allergies',
    department: 'Bodily Functions',
    tagline: 'An immune response to a substance posing no actual threat. Seasonal and year-round.',
    alsoRegretted: ['mosquitoes', 'hiccups'],
    reviews: [
      {
        name: 'Ottilie Brandvold',
        rating: 1,
        title: 'My own body, attacking a flower',
        body: 'Not a virus. Not a wound. A flower. Somewhere a system refined over hundreds of millions of years has looked at a flower and declared an emergency.',
        helpful: 3455,
        date: '2026-05-09',
      },
      {
        name: 'Kwabena Lindstrom',
        rating: 1,
        title: 'Developed one at thirty-four',
        body: 'Ate peanuts for thirty-four years with no trouble whatsoever. At thirty-five, apparently a medical event. No warning and no changelog.',
        helpful: 2620,
        date: '2026-02-20',
      },
      {
        name: 'Verity Mashaba-Cole',
        rating: 2,
        title: 'The medication turns me into a ghost',
        body: 'It works. I also cannot tell you a single thing that happened to me between April and June.',
        helpful: 1877,
        date: '2026-06-24',
      },
      {
        name: 'Fitzwilliam Oduya',
        rating: 4,
        title: 'Got me out of eleven years of gym class',
        body: 'Genuinely one of the more useful things my immune system has ever done for me.',
        helpful: 1544,
        date: '2025-10-31',
      },
    ],
  },
  {
    id: 'quicksand',
    name: 'Quicksand',
    department: 'Terrain',
    tagline: 'A saturated granular suspension that loses shear strength under load. Rarely encountered.',
    alsoRegretted: ['deserts', 'earthquakes'],
    reviews: [
      {
        name: 'Saskia Merryweather',
        rating: 1,
        title: 'Nowhere near as common as advertised',
        body: 'I was promised, at length and by a great deal of childhood television, that this would be a weekly problem. I am forty-six. It has never once come up.',
        helpful: 4911,
        date: '2026-08-02',
      },
      {
        name: 'Rodrigo Ettinger',
        rating: 2,
        title: 'Denser than a person',
        body: 'You float. You actually float. I spent an entire childhood frightened of something that will not even let you sink properly.',
        helpful: 3266,
        date: '2026-04-13',
      },
      {
        name: 'Nadia Pemberton-Ojo',
        rating: 1,
        title: 'Took my boot',
        body: 'It did not take me. It took one boot, at the ankle, and kept it, and I walked two miles back across a car park with one sock.',
        helpful: 1755,
        date: '2025-11-21',
      },
      {
        name: 'Cormac Tetteh-Bailey',
        rating: 5,
        title: 'Outstanding value as a childhood fear',
        body: 'Provided several decades of entirely unnecessary anxiety at no cost and required no maintenance of any kind.',
        helpful: 3902,
        date: '2026-09-16',
      },
    ],
  },
  {
    id: 'growing-old',
    name: 'Growing Old',
    department: 'Lifecycle Management',
    tagline: 'A progressive accumulation of cellular damage. Begins on delivery. One year per year.',
    alsoRegretted: ['death', 'entropy'],
    reviews: [
      {
        name: 'Lavinia Okwuosa',
        rating: 1,
        title: 'Started without asking',
        body: 'There was no setup screen. I simply noticed, somewhere around thirty-one, that it had been running the whole time in the background.',
        helpful: 3744,
        date: '2026-03-22',
      },
      {
        name: 'Ruaridh Nakashima',
        rating: 2,
        title: 'Knees',
        body: 'Everything else on the list I could argue about. Not the knees. The knees are not up for discussion.',
        helpful: 2988,
        date: '2026-07-28',
      },
      {
        name: 'Philippa Osagie-Crewe',
        rating: 5,
        title: 'Vastly preferable to the alternative',
        body: 'Go and read the reviews for the other product in this department, then come back and tell me about your knees.',
        helpful: 6023,
        date: '2026-08-11',
      },
      {
        name: 'Hamish Bellweather',
        rating: 3,
        title: 'You stop caring what people think, far too late to be useful',
        body: 'The confidence arrives roughly thirty years after the occasions that actually needed it. A delivery error, presumably.',
        helpful: 2811,
        date: '2026-01-27',
      },
      {
        name: 'Marguerite Salcedo-Pike',
        rating: 1,
        title: 'Nobody warned me about the noise',
        body: 'At some point a restaurant became "too loud" and I have no memory of agreeing to that.',
        helpful: 2177,
        date: '2025-12-19',
      },
    ],
  },

  /* ---- the second wave ---------------------------------------------------- */

  {
    id: 'rainbows',
    name: 'Rainbows',
    department: 'Optics',
    tagline: 'A refraction and reflection of sunlight through water droplets, arced across the sky. No pot of gold included.',
    alsoRegretted: ['fog', 'snow'],
    reviews: [
      {
        name: 'Marisela Quon',
        rating: 2,
        title: 'Gone before I found my phone',
        body: 'Spotted a full double arc over the car park. Took four minutes to unlock my phone. Found a very nice photograph of a hedge instead.',
        helpful: 812,
        date: '2025-04-11',
      },
      {
        name: 'Osric Bellamy',
        rating: 5,
        title: 'Free and enormous',
        body: 'A complete spectrum of visible light, arranged in a perfect arc, delivered after nearly every rain shower I have ever stood through. Never once billed for it.',
        helpful: 2290,
        date: '2026-06-02',
      },
      {
        name: 'Winnifred Adeyemi-Cross',
        rating: 1,
        title: 'The second one is not advertised',
        body: 'A fainter, reversed copy appears just above the first with no warning whatsoever. I counted the wrong one for an embarrassing length of time.',
        helpful: 566,
        date: '2025-09-23',
      },
      {
        name: 'Callahan Nkosi',
        rating: 3,
        title: 'Never touches the ground where I checked',
        body: 'Walked to where it appeared to end. Found a recycling bin behind a supermarket. No gold, no end, just municipal waste management.',
        helpful: 1140,
        date: '2026-02-14',
      },
    ],
  },
  {
    id: 'fog',
    name: 'Fog',
    department: 'Weather',
    tagline: 'A cloud resting directly on the ground, cutting visibility to a few metres. Lifts by late morning, allegedly.',
    alsoRegretted: ['snow', 'puberty'],
    reviews: [
      {
        name: 'Petra Lindgren',
        rating: 1,
        title: 'Drove through a wall of nothing',
        body: 'The motorway simply stopped existing forty metres ahead of the bonnet for eleven minutes. I have complained to no one, because I do not know who is responsible.',
        helpful: 1988,
        date: '2025-11-05',
      },
      {
        name: 'Amadou Diarra',
        rating: 4,
        title: 'Makes the town look like it means something',
        body: 'Every building I have seen a thousand times looked genuinely mysterious for one entire Tuesday morning. Docking one star because the bus was also late.',
        helpful: 977,
        date: '2026-01-18',
      },
      {
        name: 'Sable Okonkwo-Vance',
        rating: 2,
        title: 'Advertised as lifting by ten',
        body: 'Still there at half past one. Contacted absolutely no customer service line, because there is not one, and there never was.',
        helpful: 640,
        date: '2025-12-30',
      },
      {
        name: 'Quentin Fairbrass',
        rating: 5,
        title: 'Photographed beautifully from the hill',
        body: 'Stood above it while the whole valley disappeared under a soft grey sea. Worth the climb, worth the cold, worth being late to work.',
        helpful: 1521,
        date: '2026-05-09',
      },
    ],
  },
  {
    id: 'snow',
    name: 'Snow',
    department: 'Weather',
    tagline: 'Frozen precipitation, delivered white. Beautiful for roughly one hour. Non-negotiable after that.',
    alsoRegretted: ['puberty', 'wisdom-teeth'],
    reviews: [
      {
        name: 'Ines Castellano',
        rating: 5,
        title: 'Turned the bins into sculpture',
        body: 'Woke up to a garden that looked entirely unlike my garden. Kept the illusion for exactly one hour before somebody walked a dog through it.',
        helpful: 2244,
        date: '2026-01-04',
      },
      {
        name: 'Bertram Achinike',
        rating: 1,
        title: 'Shut down the entire street over two centimetres',
        body: 'Two centimetres. The bus service, the school and my brother-in-law all cancelled independently, as if consulting one another.',
        helpful: 1799,
        date: '2025-12-09',
      },
      {
        name: 'Seraphine Kowalczyk',
        rating: 2,
        title: 'Melts into the one substance nobody wants',
        body: 'Pristine for a morning, then a grey slush that gets into every shoe I own regardless of how sealed the shoe claimed to be.',
        helpful: 933,
        date: '2026-02-21',
      },
      {
        name: 'Tobiah Lindqvist-Wren',
        rating: 4,
        title: 'No two alike, allegedly',
        body: 'I have not personally verified this claim across the estimated one septillion snowflakes that have ever fallen, but I am choosing to believe it.',
        helpful: 1207,
        date: '2025-01-27',
      },
    ],
  },
  {
    id: 'puberty',
    name: 'Puberty',
    department: 'Lifecycle Management',
    tagline: 'An adolescent developmental transition, driven by hormones. Duration: several deeply confusing years.',
    alsoRegretted: ['wisdom-teeth', 'brain-freeze'],
    reviews: [
      {
        name: 'Malachi Ferrante',
        rating: 1,
        title: 'Voice changed mid-sentence, repeatedly',
        body: 'Started a sentence in one register and finished it in an entirely different one, in front of the whole class, more than once.',
        helpful: 3110,
        date: '2025-06-15',
      },
      {
        name: 'Odalys Renwick',
        rating: 2,
        title: 'No onboarding documentation whatsoever',
        body: 'Was handed an entirely new body with zero instructions and an expectation that I would simply cope, which I did not, initially.',
        helpful: 2477,
        date: '2026-03-08',
      },
      {
        name: 'Ferdinand Osei',
        rating: 5,
        title: 'Worked exactly as designed, eventually',
        body: 'Deeply unpleasant for about four years and then quietly finished the job it set out to do. Reviewing in hindsight, which I understand is the only honest way.',
        helpful: 1866,
        date: '2026-07-19',
      },
      {
        name: 'Livia Trentham',
        rating: 1,
        title: 'Emotional range increased without my consent',
        body: 'Cried at an advert for kitchen roll. Was furious about a sandwich. Neither event has ever been adequately explained to me.',
        helpful: 2955,
        date: '2025-10-02',
      },
    ],
  },
  {
    id: 'wisdom-teeth',
    name: 'Wisdom Teeth',
    department: 'Bodily Functions',
    tagline: 'A third set of molars, arriving roughly a decade after the others. Space not guaranteed.',
    alsoRegretted: ['brain-freeze', 'deja-vu'],
    reviews: [
      {
        name: 'Nkosana Beaumont',
        rating: 1,
        title: 'Arrived to a property with no vacancies',
        body: 'Showed up at twenty-two demanding room that had been fully allocated to other teeth since I was twelve. Had to be removed by a professional.',
        helpful: 2811,
        date: '2026-04-25',
      },
      {
        name: 'Cressida Wrenfield',
        rating: 2,
        title: 'At least two of mine never even surfaced',
        body: 'Apparently still down there, sideways, doing nothing useful. My dentist shows me the X-ray every visit like it is new information.',
        helpful: 1344,
        date: '2025-08-17',
      },
      {
        name: 'Baldric Osunde',
        rating: 4,
        title: 'The swelling made me look like I was storing food',
        body: 'For four days I resembled someone mid-hibernation. Ate soup exclusively. The soup, at least, has no complaints on record.',
        helpful: 987,
        date: '2026-06-30',
      },
      {
        name: 'Perpetua Kilbride',
        rating: 1,
        title: 'Zero warning before the pain started',
        body: 'Fine on Monday. By Wednesday evening I could not close my own jaw without an opinion from the entire left side of my face.',
        helpful: 1622,
        date: '2025-11-11',
      },
    ],
  },
  {
    id: 'brain-freeze',
    name: 'Brain Freeze',
    department: 'Bodily Functions',
    tagline: 'A sharp headache triggered by cold food against the roof of the mouth. Self-resolving. Entirely avoidable.',
    alsoRegretted: ['deja-vu', 'solar-eclipse'],
    reviews: [
      {
        name: 'Edmund Achterberg',
        rating: 1,
        title: 'Struck mid-sentence at a wedding toast',
        body: 'Took one large spoonful of the dessert while still speaking and lost the ability to form words for a genuinely alarming eleven seconds.',
        helpful: 1455,
        date: '2026-08-01',
      },
      {
        name: 'Yara Boedeker',
        rating: 3,
        title: 'Entirely my own fault, every single time',
        body: 'I know exactly how to avoid this. I have never once avoided it. The ice cream is simply too good to eat slowly.',
        helpful: 902,
        date: '2025-07-14',
      },
      {
        name: 'Casimir Adeyinka',
        rating: 5,
        title: 'Gone in under thirty seconds, no lasting damage',
        body: 'Genuinely the most honest pain I own. Arrives fast, leaves fast, no follow-up appointment required.',
        helpful: 1188,
        date: '2026-02-27',
      },
      {
        name: 'Thomasina Okereke',
        rating: 2,
        title: 'The tongue-to-roof trick works about half the time',
        body: 'Pressed my tongue to the roof of my mouth as instructed by a stranger online. Successful on alternating Tuesdays only.',
        helpful: 733,
        date: '2025-05-19',
      },
    ],
  },
  {
    id: 'deja-vu',
    name: 'Déjà Vu',
    department: 'Neuroscience',
    tagline: 'The sensation of having already lived the present moment. Duration: a few seconds. Explanation: none supplied.',
    alsoRegretted: ['solar-eclipse', 'magnetism'],
    reviews: [
      {
        name: 'Ansel Draycombe',
        rating: 3,
        title: 'Convinced I had already had this exact coffee',
        body: 'Stood in the same queue, ordered the same thing, and for four seconds was completely certain this had all happened once before. It had not.',
        helpful: 1966,
        date: '2026-01-09',
      },
      {
        name: 'Guinevere Osafo',
        rating: 1,
        title: 'Never comes with an explanation attached',
        body: 'Happens perhaps four times a year and every single time I am left to work out the mechanism entirely on my own.',
        helpful: 2340,
        date: '2025-09-04',
      },
      {
        name: 'Roscoe Vantongeren',
        rating: 5,
        title: 'Genuinely unsettling in a way I respect',
        body: 'Nothing else my own brain does to me manages to be this quietly impressive. Five stars for the sheer audacity of it.',
        helpful: 1711,
        date: '2026-05-30',
      },
      {
        name: 'Fenwick Adelakun',
        rating: 2,
        title: 'Always at the least useful moment',
        body: 'Struck during a meeting I was already struggling to concentrate in, adding an extra layer of confusion I did not request.',
        helpful: 855,
        date: '2025-12-22',
      },
    ],
  },
  {
    id: 'solar-eclipse',
    name: 'Solar Eclipse',
    department: 'Celestial Bodies',
    tagline: 'The Moon passing directly between Earth and the Sun. Totality lasts minutes. Proper eyewear required.',
    alsoRegretted: ['magnetism', 'traffic-jams'],
    reviews: [
      {
        name: 'Rosalind Achebe',
        rating: 5,
        title: 'Went dark at two in the afternoon and I wept',
        body: 'Stood in a car park with several hundred strangers and watched the sky do something none of us had words for. Worth every mile of the drive.',
        helpful: 3204,
        date: '2026-04-08',
      },
      {
        name: 'Thaddeus Okonjo',
        rating: 1,
        title: 'Scheduling is not remotely convenient',
        body: 'The next one visible from anywhere near me is apparently decades away. I do not appreciate being expected to plan around geology.',
        helpful: 1509,
        date: '2025-03-20',
      },
      {
        name: 'Isolde Prendergast',
        rating: 2,
        title: 'The glasses cost more than I expected',
        body: 'Four minutes of totality and an entire industry of cardboard eyewear built around it. Somebody is doing very well out of this.',
        helpful: 1077,
        date: '2026-06-11',
      },
      {
        name: 'Barnaby Achufusi',
        rating: 4,
        title: 'The birds genuinely stopped singing',
        body: 'Did not believe this would actually happen until it happened, at which point the whole car park went quiet along with them.',
        helpful: 1642,
        date: '2025-10-27',
      },
    ],
  },
  {
    id: 'magnetism',
    name: 'Magnetism',
    department: 'Fundamental Forces',
    tagline: 'A force between moving charges. Attracts some metals with total commitment. Ignores the rest completely.',
    alsoRegretted: ['traffic-jams', 'rainbows'],
    reviews: [
      {
        name: 'Aurelio Ntumba',
        rating: 2,
        title: 'Only interested in a small list of metals',
        body: 'Tried it on a great deal of my kitchen before discovering it only cares about iron, nickel and cobalt, and frankly does not care about my feelings either.',
        helpful: 733,
        date: '2026-03-02',
      },
      {
        name: 'Wren Castellanos',
        rating: 5,
        title: 'Held my entire shopping list to the fridge for a year',
        body: 'Unpaid, unasked, and has never once let a single reminder fall off. More reliable than most people I know.',
        helpful: 1855,
        date: '2025-08-29',
      },
      {
        name: 'Delacroix Owusu',
        rating: 1,
        title: 'Erased a hard drive I left too close to a speaker',
        body: 'Nobody told me these things repel data as enthusiastically as they attract paperclips. Lost a decade of holiday photographs.',
        helpful: 2201,
        date: '2026-01-16',
      },
      {
        name: 'Philomena Osagie',
        rating: 3,
        title: 'The compass thing is admittedly impressive',
        body: 'Points reliably at magnetic north regardless of where on the planet I am standing, which I will grudgingly admit is useful.',
        helpful: 966,
        date: '2025-06-07',
      },
    ],
  },
  {
    id: 'traffic-jams',
    name: 'Traffic Jams',
    department: 'Infrastructure',
    tagline: 'A queue of vehicles moving slower than walking pace. Cause frequently unclear. Duration frequently worse.',
    alsoRegretted: ['rainbows', 'fog'],
    reviews: [
      {
        name: 'Emeric Vantwist',
        rating: 1,
        title: 'Ninety minutes to travel eleven miles',
        body: 'Watched a cyclist, a jogger and eventually a determined-looking pigeon all overtake the car. The pigeon looked back once.',
        helpful: 2588,
        date: '2026-02-19',
      },
      {
        name: 'Saoirse Mbeki',
        rating: 2,
        title: 'No incident, no reason, no explanation at the front',
        body: 'Reached the front after forty minutes to find an entirely clear road and nothing whatsoever to account for any of it.',
        helpful: 1922,
        date: '2025-11-30',
      },
      {
        name: 'Cordelia Achterberg',
        rating: 4,
        title: 'The radio traffic report is somehow always right',
        body: 'Confirmed I was, in fact, in the queue it warned me about eleven minutes earlier. Genuinely useful, if a little smug about it.',
        helpful: 855,
        date: '2026-07-05',
      },
      {
        name: 'Percival Ogunleye',
        rating: 3,
        title: 'Brake lights as far as I could see',
        body: 'Every single car ahead lit red at once like a very slow firework display, and stayed that way for most of an hour.',
        helpful: 1344,
        date: '2025-04-14',
      },
    ],
  },
]

/* ---- pure helpers -------------------------------------------------------- */

export const phenomenonById = (id: string): Phenomenon | undefined =>
  PHENOMENA.find((p) => p.id === id)

/** Every star value a review may carry, highest first — the order the bar chart draws in. */
export const STARS = [5, 4, 3, 2, 1] as const

/**
 * The mean of a phenomenon's own review ratings, to one decimal place, halves
 * away from zero. See the rounding note at the top of this file for why the
 * division happens exactly once.
 */
export function averageRating(p: Phenomenon): number {
  const n = p.reviews.length
  if (n === 0) return 0
  const sum = p.reviews.reduce((s, r) => s + r.rating, 0)
  return Math.round((sum * 10) / n) / 10
}

/**
 * How many reviews gave each star value. Keyed 1–5, and the five counts sum
 * to `p.reviews.length` by construction — which is exactly the invariant the
 * checker proves for every phenomenon rather than assuming.
 */
export function ratingDistribution(p: Phenomenon): Record<number, number> {
  const out: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (const r of p.reviews) out[r.rating]++
  return out
}

/** Total votes claimed across a phenomenon's reviews. */
export const totalHelpful = (p: Phenomenon): number =>
  p.reviews.reduce((s, r) => s + r.helpful, 0)

export type ReviewSort = 'helpful' | 'recent'

/**
 * A phenomenon's reviews in display order. Not in place: the page re-sorts on
 * every click and the source array has to stay the array it was authored as.
 * Ties break on the other key, so the order is total and the same every time.
 */
export function sortReviews(p: Phenomenon, mode: ReviewSort): Review[] {
  const rs = [...p.reviews]
  if (mode === 'recent') rs.sort((a, b) => b.date.localeCompare(a.date) || b.helpful - a.helpful)
  else rs.sort((a, b) => b.helpful - a.helpful || b.date.localeCompare(a.date))
  return rs
}

export type StoreSort = 'reviewed' | 'lowest' | 'name'

/** The storefront grid's own ordering. Pure, so the checker can exercise it. */
export function sortPhenomena(list: Phenomenon[], mode: StoreSort): Phenomenon[] {
  const ps = [...list]
  if (mode === 'lowest')
    ps.sort((a, b) => averageRating(a) - averageRating(b) || b.reviews.length - a.reviews.length)
  else if (mode === 'name') ps.sort((a, b) => a.name.localeCompare(b.name))
  else ps.sort((a, b) => b.reviews.length - a.reviews.length || totalHelpful(b) - totalHelpful(a))
  return ps
}

/**
 * The numbers in the storefront header. `mean` is the mean over every review
 * on the site — the mean of the per-phenomenon averages would be a different
 * number, and a slightly dishonest one, since the phenomena do not all carry
 * the same number of reviews.
 */
export function catalogueStats(): {
  phenomena: number
  reviews: number
  mean: number
  oneStarShare: number
} {
  const all = PHENOMENA.flatMap((p) => p.reviews)
  const sum = all.reduce((s, r) => s + r.rating, 0)
  const ones = all.filter((r) => r.rating === 1).length
  return {
    phenomena: PHENOMENA.length,
    reviews: all.length,
    mean: Math.round((sum * 10) / all.length) / 10,
    oneStarShare: Math.round((ones * 100) / all.length),
  }
}
