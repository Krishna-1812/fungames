/**
 * Who Was Alive — the record itself, and the arithmetic over it.
 *
 * Eighty-nine people, every birth and death year a well-established fact at
 * the level Wikipedia and Britannica agree on. Nothing here is rounded to
 * make a nicer chart and nobody is invented to fill a gap: the eight-century
 * hole between Augustus and Charlemagne is a hole in *this list*, not in
 * history, and the page says so rather than papering over it.
 *
 * Years use the historical BC/AD labelling, not astronomical year numbering:
 * `birth: -63` means 63 BC, and **there is no year zero**. That one fact is
 * the reason `yearsBetween` exists instead of a subtraction. Getting it wrong
 * makes every span that crosses the era boundary a year too long — Augustus
 * came out 77 before this function did, against a real 76 calendar years
 * between 63 BC and AD 14. `scripts/check-who-was-alive.mjs` holds it to that.
 *
 * Everything below is pure functions over plain data, the same shape as
 * `lib/progress-time.ts` and `lib/day-model.ts`, so the checker can run the
 * whole model headlessly.
 */

export type Category =
  | 'ruler' | 'philosopher' | 'scientist' | 'writer' | 'artist'
  | 'explorer' | 'leader' | 'inventor' | 'military' | 'athlete' | 'other'

export type Person = {
  name: string
  birth: number // negative = BCE
  death: number | null // null = still living
  category: Category
  place: string
  blurb: string // one cited-fact sentence, no editorializing
}

export const PEOPLE: Person[] = [
  { name: 'Confucius', birth: -551, death: -479, category: 'philosopher', place: 'China', blurb: "Chinese philosopher whose ideas on ethics and governance shaped East Asian culture for millennia." },
  { name: 'Socrates', birth: -470, death: -399, category: 'philosopher', place: 'Greece', blurb: "Athenian philosopher who taught by relentless questioning and left no writings of his own." },
  { name: 'Plato', birth: -428, death: -348, category: 'philosopher', place: 'Greece', blurb: "Founded the Academy in Athens; his dialogues are the main source for what we know of Socrates." },
  { name: 'Aristotle', birth: -384, death: -322, category: 'philosopher', place: 'Greece', blurb: "Tutored Alexander the Great; his work founded formal logic and much of Western science." },
  { name: 'Alexander the Great', birth: -356, death: -323, category: 'ruler', place: 'Macedon', blurb: "Conquered an empire stretching from Greece to India before dying at 32." },
  { name: 'Archimedes', birth: -287, death: -212, category: 'scientist', place: 'Sicily', blurb: "Calculated pi to remarkable accuracy and founded the field of hydrostatics." },
  { name: 'Qin Shi Huang', birth: -259, death: -210, category: 'ruler', place: 'China', blurb: "First emperor of a unified China; began the Great Wall and was buried with the Terracotta Army." },
  { name: 'Julius Caesar', birth: -100, death: -44, category: 'ruler', place: 'Rome', blurb: "Roman general and statesman assassinated by senators on the Ides of March." },
  { name: 'Cleopatra VII', birth: -69, death: -30, category: 'ruler', place: 'Egypt', blurb: "Last active ruler of the Ptolemaic Kingdom of Egypt." },
  { name: 'Augustus', birth: -63, death: 14, category: 'ruler', place: 'Rome', blurb: "Rome's first emperor, ending the Republic and beginning two centuries of relative peace." },
  { name: 'Ibn Sina (Avicenna)', birth: 980, death: 1037, category: 'scientist', place: 'Persia', blurb: "Persian polymath whose Canon of Medicine was a standard European medical text for centuries." },
  { name: 'Charlemagne', birth: 742, death: 814, category: 'ruler', place: 'Francia', blurb: "United much of Western Europe and was crowned the first Holy Roman Emperor." },
  { name: 'Genghis Khan', birth: 1162, death: 1227, category: 'ruler', place: 'Mongolia', blurb: "Founded the Mongol Empire, the largest contiguous land empire in history." },
  { name: 'Marco Polo', birth: 1254, death: 1324, category: 'explorer', place: 'Venice', blurb: "His travel accounts introduced Europe to the Silk Road and imperial China." },
  { name: 'Dante Alighieri', birth: 1265, death: 1321, category: 'writer', place: 'Italy', blurb: "Wrote the Divine Comedy, shaping the Italian language itself." },
  { name: 'Geoffrey Chaucer', birth: 1343, death: 1400, category: 'writer', place: 'England', blurb: "Wrote The Canterbury Tales; often called the father of English literature." },
  { name: 'Joan of Arc', birth: 1412, death: 1431, category: 'military', place: 'France', blurb: "Led French troops to victory at 17, then was burned at the stake at 19." },
  { name: 'Johannes Gutenberg', birth: 1400, death: 1468, category: 'inventor', place: 'Germany', blurb: "His movable-type printing press made mass-produced books possible." },
  { name: 'Leonardo da Vinci', birth: 1452, death: 1519, category: 'artist', place: 'Italy', blurb: "Painted the Mona Lisa and filled notebooks with anatomy, flight and engineering." },
  { name: 'Christopher Columbus', birth: 1451, death: 1506, category: 'explorer', place: 'Genoa / Spain', blurb: "His 1492 voyage opened sustained European contact with the Americas." },
  { name: 'Nicolaus Copernicus', birth: 1473, death: 1543, category: 'scientist', place: 'Poland', blurb: "Proposed that the Earth orbits the Sun, not the other way around." },
  { name: 'Michelangelo', birth: 1475, death: 1564, category: 'artist', place: 'Italy', blurb: "Painted the Sistine Chapel ceiling and sculpted David." },
  { name: 'Martin Luther', birth: 1483, death: 1546, category: 'leader', place: 'Germany', blurb: "His 95 Theses in 1517 launched the Protestant Reformation." },
  { name: 'Henry VIII', birth: 1491, death: 1547, category: 'ruler', place: 'England', blurb: "Broke from the Catholic Church to secure a divorce; married six times." },
  { name: 'Suleiman the Magnificent', birth: 1494, death: 1566, category: 'ruler', place: 'Ottoman Empire', blurb: "Ottoman sultan whose 46-year reign is considered the empire's golden age." },
  { name: 'Elizabeth I', birth: 1533, death: 1603, category: 'ruler', place: 'England', blurb: "Presided over England's defeat of the Spanish Armada and a golden age of theatre." },
  { name: 'Akbar the Great', birth: 1542, death: 1605, category: 'ruler', place: 'Mughal Empire', blurb: "Mughal emperor known for religious tolerance and sweeping administrative reform." },
  { name: 'William Shakespeare', birth: 1564, death: 1616, category: 'writer', place: 'England', blurb: "Wrote 39 plays and 154 sonnets that still dominate English literature." },
  { name: 'Galileo Galilei', birth: 1564, death: 1642, category: 'scientist', place: 'Italy', blurb: "Improved the telescope and was tried by the Inquisition for saying Earth moves." },
  { name: 'Johannes Kepler', birth: 1571, death: 1630, category: 'scientist', place: 'Germany', blurb: "Worked out the real, elliptical shape of planetary orbits." },
  { name: 'René Descartes', birth: 1596, death: 1650, category: 'philosopher', place: 'France', blurb: "'I think, therefore I am' — laid groundwork for modern philosophy." },
  { name: 'Oliver Cromwell', birth: 1599, death: 1658, category: 'ruler', place: 'England', blurb: "Led the overthrow of the English monarchy and ruled as Lord Protector." },
  { name: 'Rembrandt', birth: 1606, death: 1669, category: 'artist', place: 'Netherlands', blurb: "Dutch painter of light and shadow; his self-portraits span his whole life." },
  { name: 'Isaac Newton', birth: 1642, death: 1727, category: 'scientist', place: 'England', blurb: "Formulated the laws of motion and universal gravitation in a single book." },
  { name: 'Louis XIV', birth: 1638, death: 1715, category: 'ruler', place: 'France', blurb: "The Sun King; ruled France for 72 years, longer than any monarch in European history." },
  { name: 'Johann Sebastian Bach', birth: 1685, death: 1750, category: 'artist', place: 'Germany', blurb: "Composed over a thousand works; his structures still teach musicians today." },
  { name: 'Voltaire', birth: 1694, death: 1778, category: 'writer', place: 'France', blurb: "Wrote relentlessly for free speech and against religious intolerance." },
  { name: 'Benjamin Franklin', birth: 1706, death: 1790, category: 'inventor', place: 'USA', blurb: "Flew a kite in a storm, invented bifocals, and signed the Declaration of Independence." },
  { name: 'James Cook', birth: 1728, death: 1779, category: 'explorer', place: 'England', blurb: "Mapped New Zealand, eastern Australia and much of the Pacific across three voyages." },
  { name: 'George Washington', birth: 1732, death: 1799, category: 'leader', place: 'USA', blurb: "Commanded the Continental Army and became the first US president." },
  { name: 'Marie Antoinette', birth: 1755, death: 1793, category: 'ruler', place: 'France', blurb: "Queen of France, executed by guillotine during the Revolution." },
  { name: 'Wolfgang Amadeus Mozart', birth: 1756, death: 1791, category: 'artist', place: 'Austria', blurb: "Composed over 600 works before dying at 35." },
  { name: 'Thomas Jefferson', birth: 1743, death: 1826, category: 'leader', place: 'USA', blurb: "Drafted the Declaration of Independence; died on its 50th anniversary." },
  { name: 'Napoleon Bonaparte', birth: 1769, death: 1821, category: 'ruler', place: 'France', blurb: "Crowned himself Emperor of France and redrew the map of Europe." },
  { name: 'Ludwig van Beethoven', birth: 1770, death: 1827, category: 'artist', place: 'Germany', blurb: "Composed his greatest symphonies after going almost completely deaf." },
  { name: 'Jane Austen', birth: 1775, death: 1817, category: 'writer', place: 'England', blurb: "Wrote six novels that reinvented the marriage plot with sharp social wit." },
  { name: 'Simón Bolívar', birth: 1783, death: 1830, category: 'leader', place: 'South America', blurb: "Led the independence of six South American nations from Spanish rule." },
  { name: 'Abraham Lincoln', birth: 1809, death: 1865, category: 'leader', place: 'USA', blurb: "Led the US through the Civil War and ended slavery, then was assassinated." },
  { name: 'Charles Darwin', birth: 1809, death: 1882, category: 'scientist', place: 'England', blurb: "Proposed evolution by natural selection after a five-year voyage on the Beagle." },
  { name: 'Ada Lovelace', birth: 1815, death: 1852, category: 'scientist', place: 'England', blurb: "Wrote what's considered the first computer program, for a machine never built in her lifetime." },
  { name: 'Karl Marx', birth: 1818, death: 1883, category: 'philosopher', place: 'Germany', blurb: "Co-wrote The Communist Manifesto and Das Kapital." },
  { name: 'Florence Nightingale', birth: 1820, death: 1910, category: 'leader', place: 'England', blurb: "Modernised nursing after the Crimean War, using statistics to prove her methods worked." },
  { name: 'Louis Pasteur', birth: 1822, death: 1895, category: 'scientist', place: 'France', blurb: "Proved germ theory and invented pasteurisation." },
  { name: 'Leo Tolstoy', birth: 1828, death: 1910, category: 'writer', place: 'Russia', blurb: "Wrote War and Peace and Anna Karenina." },
  { name: 'Vincent van Gogh', birth: 1853, death: 1890, category: 'artist', place: 'Netherlands', blurb: "Sold one painting in his lifetime; is now among the most famous artists ever." },
  { name: 'Nikola Tesla', birth: 1856, death: 1943, category: 'inventor', place: 'Serbia / USA', blurb: "Pioneered the alternating-current electricity that still powers the world's grid." },
  { name: 'Sigmund Freud', birth: 1856, death: 1939, category: 'scientist', place: 'Austria', blurb: "Founded psychoanalysis and the modern idea of the unconscious mind." },
  { name: 'Marie Curie', birth: 1867, death: 1934, category: 'scientist', place: 'Poland / France', blurb: "Only person ever to win Nobel Prizes in two different sciences." },
  { name: 'Wilbur Wright', birth: 1867, death: 1912, category: 'inventor', place: 'USA', blurb: "With his brother Orville, flew the first powered aircraft in 1903." },
  { name: 'Mahatma Gandhi', birth: 1869, death: 1948, category: 'leader', place: 'India', blurb: "Led India to independence through organised nonviolent civil disobedience." },
  { name: 'Winston Churchill', birth: 1874, death: 1965, category: 'leader', place: 'England', blurb: "Led Britain through WWII and won the Nobel Prize in Literature." },
  { name: 'Albert Einstein', birth: 1879, death: 1955, category: 'scientist', place: 'Germany / USA', blurb: "Relativity rewrote physics' understanding of space, time and gravity." },
  { name: 'Pablo Picasso', birth: 1881, death: 1973, category: 'artist', place: 'Spain', blurb: "Co-founded Cubism and produced an estimated 50,000 works." },
  { name: 'Franklin D. Roosevelt', birth: 1882, death: 1945, category: 'leader', place: 'USA', blurb: "Only US president elected four times; led through the Depression and WWII." },
  { name: 'Charlie Chaplin', birth: 1889, death: 1977, category: 'artist', place: 'England / USA', blurb: "Silent-film icon who wrote, directed, scored and starred in his own films." },
  { name: 'Adolf Hitler', birth: 1889, death: 1945, category: 'leader', place: 'Germany', blurb: "Dictator whose regime started WWII in Europe and industrialised genocide in the Holocaust." },
  { name: 'Mao Zedong', birth: 1893, death: 1976, category: 'leader', place: 'China', blurb: "Founded the People's Republic of China and led it for 27 years." },
  { name: 'Alan Turing', birth: 1912, death: 1954, category: 'scientist', place: 'England', blurb: "Broke the Enigma code and laid the theoretical foundation of computer science." },
  { name: 'Frida Kahlo', birth: 1907, death: 1954, category: 'artist', place: 'Mexico', blurb: "Mexican painter known for surreal self-portraits exploring pain and identity." },
  { name: 'Anne Frank', birth: 1929, death: 1945, category: 'writer', place: 'Netherlands', blurb: "Her hidden diary became one of the most widely read accounts of the Holocaust." },
  { name: 'Rosa Parks', birth: 1913, death: 2005, category: 'leader', place: 'USA', blurb: "Her refusal to give up a bus seat helped ignite the US civil rights movement." },
  { name: 'John F. Kennedy', birth: 1917, death: 1963, category: 'leader', place: 'USA', blurb: "35th US president, assassinated in Dallas in 1963." },
  { name: 'Nelson Mandela', birth: 1918, death: 2013, category: 'leader', place: 'South Africa', blurb: "Spent 27 years in prison, then became South Africa's first Black president." },
  { name: 'Martin Luther King Jr.', birth: 1929, death: 1968, category: 'leader', place: 'USA', blurb: "Led the US civil rights movement through organised nonviolent protest." },
  { name: 'Marilyn Monroe', birth: 1926, death: 1962, category: 'artist', place: 'USA', blurb: "The definitive Hollywood star of the 1950s." },
  { name: 'Queen Elizabeth II', birth: 1926, death: 2022, category: 'ruler', place: 'England', blurb: "Britain's longest-reigning monarch, on the throne for 70 years." },
  { name: 'John Lennon', birth: 1940, death: 1980, category: 'artist', place: 'England', blurb: "Co-founded the Beatles and was shot outside his own apartment building." },
  { name: 'Muhammad Ali', birth: 1942, death: 2016, category: 'athlete', place: 'USA', blurb: "Three-time heavyweight boxing champion and a leading voice against the Vietnam War." },
  { name: 'Stephen Hawking', birth: 1942, death: 2018, category: 'scientist', place: 'England', blurb: "Explained black holes to millions despite losing his voice to ALS." },
  { name: 'Freddie Mercury', birth: 1946, death: 1991, category: 'artist', place: 'England / Zanzibar', blurb: "Queen's frontman, one of rock's most powerful vocalists." },
  { name: 'Diana, Princess of Wales', birth: 1961, death: 1997, category: 'leader', place: 'England', blurb: "Used her fame to campaign against landmines and de-stigmatise HIV/AIDS." },
  { name: 'Steve Jobs', birth: 1955, death: 2011, category: 'inventor', place: 'USA', blurb: "Co-founded Apple and reshaped personal computing three separate times." },
  { name: 'Wangari Maathai', birth: 1940, death: 2011, category: 'leader', place: 'Kenya', blurb: "Founded the Green Belt Movement and became the first African woman to win the Nobel Peace Prize." },
  { name: 'Jane Goodall', birth: 1934, death: null, category: 'scientist', place: 'England / Tanzania', blurb: "Redefined primatology by living among wild chimpanzees in Tanzania." },
  { name: 'David Attenborough', birth: 1926, death: null, category: 'other', place: 'England', blurb: "Broadcaster whose nature documentaries have run continuously since the 1950s." },
  { name: 'Bob Dylan', birth: 1941, death: null, category: 'artist', place: 'USA', blurb: "Songwriter who won the Nobel Prize in Literature in 2016." },
  { name: 'Buzz Aldrin', birth: 1930, death: null, category: 'explorer', place: 'USA', blurb: "Second person to walk on the Moon, in 1969." },
  { name: 'Malala Yousafzai', birth: 1997, death: null, category: 'leader', place: 'Pakistan', blurb: "Survived a targeted shooting and became the youngest Nobel laureate ever." },
  { name: 'Serena Williams', birth: 1981, death: null, category: 'athlete', place: 'USA', blurb: "Won 23 Grand Slam singles titles, more than any player in the Open era." },
]

/* ---- the categories, as the page presents them --------------------------- */

/**
 * Display order, plural label, and the drawn icon each category gets.
 *
 * The icon keys are real entries in `lib/icons.ts`; `lib/icon-uses.ts` reads
 * this table rather than repeating it, so a category added here without a
 * drawing fails `check-icons` on the next run instead of rendering a gap.
 */
export const CATEGORY_ORDER: { key: Category; label: string; icon: string; note: string }[] = [
  { key: 'ruler', label: 'Rulers', icon: 'crown', note: 'held a throne' },
  { key: 'leader', label: 'Leaders', icon: 'rostrum', note: 'led without one' },
  { key: 'military', label: 'Soldiers', icon: 'sword', note: 'led in the field' },
  { key: 'philosopher', label: 'Philosophers', icon: 'column', note: 'argued for a living' },
  { key: 'scientist', label: 'Scientists', icon: 'flask', note: 'measured something first' },
  { key: 'inventor', label: 'Inventors', icon: 'cog', note: 'built something that had not existed' },
  { key: 'explorer', label: 'Explorers', icon: 'sextant', note: 'went and looked' },
  { key: 'writer', label: 'Writers', icon: 'quill', note: 'wrote it down' },
  { key: 'artist', label: 'Artists', icon: 'palette', note: 'painted, sculpted, composed or performed' },
  { key: 'athlete', label: 'Athletes', icon: 'laurel', note: 'competed' },
  { key: 'other', label: 'Elsewhere', icon: 'hourglass', note: 'none of the above' },
]

export const CATEGORIES: Category[] = CATEGORY_ORDER.map((c) => c.key)

export const categoryMeta = (key: Category) =>
  CATEGORY_ORDER.find((c) => c.key === key) ?? CATEGORY_ORDER[CATEGORY_ORDER.length - 1]

/* ---- the axis ------------------------------------------------------------ */

/** The earliest year the picker will go to. Confucius is born in 551 BC. */
export const MIN_YEAR = -700

/** The latest year the picker will go to — today, wherever "today" is. */
export const maxYear = () => new Date().getUTCFullYear()

export const clampYear = (y: number, max = maxYear()) =>
  Math.max(MIN_YEAR, Math.min(max, Math.round(y)))

/**
 * Years elapsed from one labelled year to another, honouring the absent year
 * zero.
 *
 * `1 BC` is `-1` here and `AD 1` is `1`, and exactly one year separates them —
 * a plain subtraction says two. Every span that crosses the era boundary is
 * wrong without this, and only one is in the data (Augustus, 63 BC to AD 14),
 * which is precisely the kind of single case that ships unnoticed.
 */
export function yearsBetween(from: number, to: number): number {
  const d = to - from
  if (from < 0 && to > 0) return d - 1
  if (from > 0 && to < 0) return d + 1
  return d
}

/**
 * A labelled year as a position on a continuous number line — astronomical
 * year numbering, where 1 BC is 0 and the gap between 1 BC and AD 1 is one
 * unit wide. This is what the timeline plots against, so a bar's drawn length
 * is its real length in years rather than its length plus one.
 */
export const toAxis = (y: number) => (y < 0 ? y + 1 : y)

/** The inverse of `toAxis`. */
export const fromAxis = (a: number) => (a <= 0 ? a - 1 : a)

/** "551 BC" / "AD 14" / "1969". */
export function formatYear(y: number): string {
  if (y < 0) return `${-y} BC`
  if (y < 1000) return `AD ${y}`
  return String(y)
}

/** "1533 – 1603", "1934 – present", "551 BC – 479 BC". */
export function lifespanLabel(p: Person): string {
  return `${formatYear(p.birth)} – ${p.death === null ? 'present' : formatYear(p.death)}`
}

/* ---- who was alive ------------------------------------------------------- */

/** Inclusive at both ends: the year you are born and the year you die count. */
export function isAliveIn(person: Person, year: number): boolean {
  return person.birth <= year && (person.death === null || year <= person.death)
}

/** Everyone alive in `year`, oldest first (earliest birth first). */
export function peopleAliveIn(year: number, people: Person[] = PEOPLE): Person[] {
  return people.filter((p) => isAliveIn(p, year)).sort((a, b) => a.birth - b.birth || a.name.localeCompare(b.name))
}

/** Age reached during `year`, as a difference of years. */
export const ageIn = (p: Person, year: number) => yearsBetween(p.birth, year)

/** Full lifespan in years. Someone still living is measured to `max`. */
export const lifespan = (p: Person, max = maxYear()) => yearsBetween(p.birth, p.death ?? max)

/** The earliest-born person alive that year, with their age. */
export function oldestAliveIn(year: number, people: Person[] = PEOPLE) {
  const alive = peopleAliveIn(year, people)
  if (!alive.length) return null
  const p = alive[0]
  return { person: p, age: ageIn(p, year) }
}

/** The latest-born person alive that year, with their age. */
export function youngestAliveIn(year: number, people: Person[] = PEOPLE) {
  const alive = peopleAliveIn(year, people)
  if (!alive.length) return null
  const p = alive[alive.length - 1]
  return { person: p, age: ageIn(p, year) }
}

/** How many of each category were alive that year, in display order. */
export function countByCategory(year: number, people: Person[] = PEOPLE): Record<Category, number> {
  const out = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>
  for (const p of peopleAliveIn(year, people)) out[p.category]++
  return out
}

/** Everyone alive that year, split into the page's own category sections. */
export function rosterFor(year: number, people: Person[] = PEOPLE) {
  const alive = peopleAliveIn(year, people)
  return CATEGORY_ORDER.map((c) => ({ ...c, people: alive.filter((p) => p.category === c.key) }))
    .filter((s) => s.people.length > 0)
}

/* ---- the holes in the record --------------------------------------------- */

/**
 * The stretches of years in which nobody in this record was alive.
 *
 * Stated rather than hidden. Eighty-nine people cannot cover 2,500 years, and
 * the biggest hole here — the seven centuries between Augustus dying in AD 14
 * and Charlemagne being born in 742 — is a fact about the list, not about the
 * first millennium.
 */
export function emptyStretches(people: Person[] = PEOPLE): { from: number; to: number }[] {
  const spans = people
    .map((p) => ({ a: toAxis(p.birth), b: toAxis(p.death ?? maxYear()) }))
    .sort((x, y) => x.a - y.a)
  const gaps: { from: number; to: number }[] = []
  let reach = spans[0].b
  for (const s of spans.slice(1)) {
    if (s.a > reach + 1) gaps.push({ from: fromAxis(reach + 1), to: fromAxis(s.a - 1) })
    reach = Math.max(reach, s.b)
  }
  return gaps
}

/** The closest year to `year` in which anybody in the record was alive. */
export function nearestPopulatedYear(year: number, people: Person[] = PEOPLE): number {
  if (peopleAliveIn(year, people).length) return year
  let best = year
  let bestDist = Infinity
  for (const p of people) {
    for (const edge of [p.birth, p.death ?? maxYear()]) {
      const d = Math.abs(toAxis(edge) - toAxis(year))
      if (d < bestDist) { bestDist = d; best = edge }
    }
  }
  return best
}

/* ---- typing a year in ---------------------------------------------------- */

/**
 * Parse whatever somebody types into the "go to year" box.
 *
 * Accepts `1492`, `1,492`, `44 BC`, `44BCE`, `-44`, `AD 800`, `800 CE`.
 * Returns null for anything it cannot read, and for year zero specifically —
 * there isn't one, and silently accepting it would put a year on the axis
 * that the rest of the model says does not exist.
 *
 * Only the comma is stripped, not the full stop. The first version stripped
 * both as "separators", which turned `12.5` into the year 125 and handed the
 * counter a year the visitor never typed — caught by the checker's reject
 * list, not by reading the code.
 */
export function parseYearInput(raw: string, max = maxYear()): number | null {
  const s = raw.trim().toLowerCase().replace(/−/g, '-').replace(/,/g, '')
  if (!s) return null
  const m = s.match(/^(?:(ad|ce)\s*)?(-?\d{1,4})(?:\s*(bc|bce|ad|ce))?$/)
  if (!m) return null
  const [, prefix, digits, suffix] = m
  let n = Number(digits)
  if (!Number.isFinite(n)) return null
  const bc = suffix === 'bc' || suffix === 'bce'
  if (bc && n < 0) return null // "-44 BC" is two claims at once
  if (bc) n = -n
  if ((prefix || suffix === 'ad' || suffix === 'ce') && n < 0) return null
  if (n === 0) return null
  if (n < MIN_YEAR || n > max) return null
  return n
}
