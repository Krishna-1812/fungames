/**
 * Who Was Alive — where each of the eighty-nine was.
 *
 * The record says what country somebody belongs to ("England", "Germany /
 * USA"). The map wants a point, so each person has the town they were born
 * in, and, if they made their life in another country, the place they made
 * it: Einstein from Ulm to Princeton, Marx from Trier to London, Freddie
 * Mercury from Stone Town to London, Napoleon from Ajaccio to Saint Helena.
 * Moves inside one country are left out (Mozart's Salzburg to Vienna is the
 * same Austria), so an arc on the map always means a border was crossed.
 *
 * Birthplaces are as the usual references give them, to a tenth of a degree
 * or so. Where nobody knows (Charlemagne), the place most tied to the person
 * stands in, and says so in `note`.
 *
 * No imports, so the node check reads it as it is.
 */

/** [latitude, longitude], degrees, north and east positive. */
export type LatLon = [number, number]

export type Whereabouts = {
  /** Where they were born. */
  born: LatLon
  bornAt: string
  /** Where they made their life, if that was another country. */
  later?: LatLon
  laterAt?: string
  note?: string
}

export const PLACES: Record<string, Whereabouts> = {
  'Confucius': { born: [35.6, 117.0], bornAt: 'Qufu' },
  'Socrates': { born: [38.0, 23.7], bornAt: 'Athens' },
  'Plato': { born: [38.0, 23.7], bornAt: 'Athens' },
  'Aristotle': { born: [40.5, 23.8], bornAt: 'Stagira' },
  'Alexander the Great': { born: [40.8, 22.5], bornAt: 'Pella', later: [32.5, 44.4], laterAt: 'Babylon' },
  'Archimedes': { born: [37.1, 15.3], bornAt: 'Syracuse' },
  'Qin Shi Huang': { born: [36.6, 114.5], bornAt: 'Handan' },
  'Julius Caesar': { born: [41.9, 12.5], bornAt: 'Rome' },
  'Cleopatra VII': { born: [31.2, 29.9], bornAt: 'Alexandria' },
  'Augustus': { born: [41.9, 12.5], bornAt: 'Rome' },
  'Ibn Sina (Avicenna)': { born: [39.8, 64.4], bornAt: 'Afshana, near Bukhara', later: [34.8, 48.5], laterAt: 'Hamadan' },
  'Charlemagne': { born: [50.8, 6.1], bornAt: 'Aachen', note: 'His birthplace is not known; Aachen was his capital.' },
  'Genghis Khan': { born: [48.5, 110.6], bornAt: 'the Onon valley' },
  'Marco Polo': { born: [45.4, 12.3], bornAt: 'Venice' },
  'Dante Alighieri': { born: [43.8, 11.3], bornAt: 'Florence' },
  'Geoffrey Chaucer': { born: [51.5, -0.1], bornAt: 'London' },
  'Joan of Arc': { born: [48.4, 5.7], bornAt: 'Domrémy' },
  'Johannes Gutenberg': { born: [50.0, 8.3], bornAt: 'Mainz' },
  'Leonardo da Vinci': { born: [43.8, 10.9], bornAt: 'Vinci', later: [47.4, 1.0], laterAt: 'Amboise' },
  'Christopher Columbus': { born: [44.4, 8.9], bornAt: 'Genoa', later: [37.4, -6.0], laterAt: 'Seville' },
  'Nicolaus Copernicus': { born: [53.0, 18.6], bornAt: 'Toruń' },
  'Michelangelo': { born: [43.6, 12.0], bornAt: 'Caprese' },
  'Martin Luther': { born: [51.5, 11.5], bornAt: 'Eisleben' },
  'Henry VIII': { born: [51.5, 0.0], bornAt: 'Greenwich' },
  'Suleiman the Magnificent': { born: [41.0, 39.7], bornAt: 'Trabzon' },
  'Elizabeth I': { born: [51.5, 0.0], bornAt: 'Greenwich' },
  'Akbar the Great': { born: [25.4, 69.7], bornAt: 'Umerkot', later: [27.2, 78.0], laterAt: 'Agra' },
  'William Shakespeare': { born: [52.2, -1.7], bornAt: 'Stratford-upon-Avon' },
  'Galileo Galilei': { born: [43.7, 10.4], bornAt: 'Pisa' },
  'Johannes Kepler': { born: [48.8, 8.9], bornAt: 'Weil der Stadt', later: [50.1, 14.4], laterAt: 'Prague' },
  'René Descartes': { born: [47.0, 0.7], bornAt: 'La Haye en Touraine', later: [52.2, 4.5], laterAt: 'Leiden' },
  'Oliver Cromwell': { born: [52.3, -0.2], bornAt: 'Huntingdon' },
  'Rembrandt': { born: [52.2, 4.5], bornAt: 'Leiden' },
  'Isaac Newton': { born: [52.8, -0.6], bornAt: 'Woolsthorpe' },
  'Louis XIV': { born: [48.9, 2.1], bornAt: 'Saint-Germain-en-Laye' },
  'Johann Sebastian Bach': { born: [51.0, 10.3], bornAt: 'Eisenach' },
  'Voltaire': { born: [48.9, 2.4], bornAt: 'Paris' },
  'Benjamin Franklin': { born: [42.4, -71.1], bornAt: 'Boston' },
  'James Cook': { born: [54.5, -1.2], bornAt: 'Marton', later: [19.5, -155.9], laterAt: 'Kealakekua Bay, Hawaii' },
  'George Washington': { born: [38.2, -76.9], bornAt: 'Westmoreland County, Virginia' },
  'Marie Antoinette': { born: [48.2, 16.4], bornAt: 'Vienna', later: [48.8, 2.1], laterAt: 'Versailles' },
  'Wolfgang Amadeus Mozart': { born: [47.8, 13.0], bornAt: 'Salzburg' },
  'Thomas Jefferson': { born: [38.0, -78.4], bornAt: 'Shadwell, Virginia' },
  'Napoleon Bonaparte': { born: [41.9, 8.7], bornAt: 'Ajaccio', later: [-16.0, -5.7], laterAt: 'Saint Helena' },
  'Ludwig van Beethoven': { born: [50.7, 7.1], bornAt: 'Bonn', later: [48.2, 16.4], laterAt: 'Vienna' },
  'Jane Austen': { born: [51.2, -1.2], bornAt: 'Steventon' },
  'Simón Bolívar': { born: [10.5, -66.9], bornAt: 'Caracas', later: [11.2, -74.2], laterAt: 'Santa Marta' },
  'Abraham Lincoln': { born: [37.6, -85.7], bornAt: 'Hodgenville, Kentucky' },
  'Charles Darwin': { born: [52.7, -2.8], bornAt: 'Shrewsbury' },
  'Ada Lovelace': { born: [51.5, -0.1], bornAt: 'London' },
  'Karl Marx': { born: [49.8, 6.6], bornAt: 'Trier', later: [51.5, -0.1], laterAt: 'London' },
  'Florence Nightingale': { born: [43.8, 11.3], bornAt: 'Florence', later: [51.5, -0.1], laterAt: 'London' },
  'Louis Pasteur': { born: [47.1, 5.5], bornAt: 'Dole' },
  'Leo Tolstoy': { born: [54.1, 37.5], bornAt: 'Yasnaya Polyana' },
  'Vincent van Gogh': { born: [51.5, 4.7], bornAt: 'Zundert', later: [43.7, 4.6], laterAt: 'Arles' },
  'Nikola Tesla': { born: [44.6, 15.3], bornAt: 'Smiljan', later: [40.7, -74.0], laterAt: 'New York' },
  'Sigmund Freud': { born: [49.6, 18.1], bornAt: 'Příbor', later: [48.2, 16.4], laterAt: 'Vienna' },
  'Marie Curie': { born: [52.2, 21.0], bornAt: 'Warsaw', later: [48.9, 2.3], laterAt: 'Paris' },
  'Wilbur Wright': { born: [40.0, -85.3], bornAt: 'Millville, Indiana' },
  'Mahatma Gandhi': { born: [21.6, 69.6], bornAt: 'Porbandar' },
  'Winston Churchill': { born: [51.8, -1.4], bornAt: 'Blenheim Palace' },
  'Albert Einstein': { born: [48.4, 10.0], bornAt: 'Ulm', later: [40.3, -74.7], laterAt: 'Princeton' },
  'Pablo Picasso': { born: [36.7, -4.4], bornAt: 'Málaga', later: [48.9, 2.3], laterAt: 'Paris' },
  'Franklin D. Roosevelt': { born: [41.8, -73.9], bornAt: 'Hyde Park, New York' },
  'Charlie Chaplin': { born: [51.5, -0.1], bornAt: 'London', later: [34.1, -118.3], laterAt: 'Hollywood' },
  'Adolf Hitler': { born: [48.3, 13.0], bornAt: 'Braunau am Inn', later: [52.5, 13.4], laterAt: 'Berlin' },
  'Mao Zedong': { born: [27.9, 112.5], bornAt: 'Shaoshan' },
  'Alan Turing': { born: [51.5, -0.2], bornAt: 'London' },
  'Frida Kahlo': { born: [19.4, -99.2], bornAt: 'Coyoacán' },
  'Anne Frank': { born: [50.1, 8.7], bornAt: 'Frankfurt', later: [52.4, 4.9], laterAt: 'Amsterdam' },
  'Rosa Parks': { born: [32.4, -85.7], bornAt: 'Tuskegee, Alabama' },
  'John F. Kennedy': { born: [42.3, -71.1], bornAt: 'Brookline, Massachusetts' },
  'Nelson Mandela': { born: [-31.9, 28.5], bornAt: 'Mvezo' },
  'Martin Luther King Jr.': { born: [33.7, -84.4], bornAt: 'Atlanta' },
  'Marilyn Monroe': { born: [34.1, -118.2], bornAt: 'Los Angeles' },
  'Queen Elizabeth II': { born: [51.5, -0.1], bornAt: 'London' },
  'John Lennon': { born: [53.4, -3.0], bornAt: 'Liverpool', later: [40.8, -74.0], laterAt: 'New York' },
  'Muhammad Ali': { born: [38.3, -85.8], bornAt: 'Louisville' },
  'Stephen Hawking': { born: [51.8, -1.3], bornAt: 'Oxford' },
  'Freddie Mercury': { born: [-6.2, 39.2], bornAt: 'Stone Town, Zanzibar', later: [51.5, -0.2], laterAt: 'London' },
  'Diana, Princess of Wales': { born: [52.8, 0.5], bornAt: 'Sandringham' },
  'Steve Jobs': { born: [37.8, -122.4], bornAt: 'San Francisco' },
  'Wangari Maathai': { born: [-0.4, 37.0], bornAt: 'Ihithe, Nyeri' },
  'Jane Goodall': { born: [51.5, -0.1], bornAt: 'London', later: [-4.7, 29.6], laterAt: 'Gombe' },
  'David Attenborough': { born: [51.5, -0.3], bornAt: 'Isleworth' },
  'Bob Dylan': { born: [46.8, -92.1], bornAt: 'Duluth' },
  'Buzz Aldrin': { born: [40.8, -74.2], bornAt: 'Glen Ridge, New Jersey' },
  'Malala Yousafzai': { born: [34.8, 72.4], bornAt: 'Mingora', later: [52.5, -1.9], laterAt: 'Birmingham' },
  'Serena Williams': { born: [43.4, -84.0], bornAt: 'Saginaw, Michigan' },
}

/** Where a person was in a year of their life: born somewhere, and later somewhere else if they moved. */
export function whereabouts(name: string): Whereabouts | undefined {
  return PLACES[name]
}

/* -------------------------------------------------------------------------- */
/* The view of the map                                                          */
/* -------------------------------------------------------------------------- */

/** How much of the world the map ever shows: no further north or south than people have lived in this record and a margin. */
export const WORLD = { south: -58, north: 78 }

/** A view: the longitude and latitude at its middle, and how many degrees of latitude it is tall. */
export type View = { lon: number; lat: number; span: number }

/** A longitude brought to within half a turn of another. */
export const nearLon = (lon: number, to: number) => lon - 360 * Math.round((lon - to) / 360)

/**
 * The view that holds the points given, with room round them, on a map of
 * this aspect (width over height). Never closer in than `minSpan` degrees
 * tall, so one person is not shown on a map of one town, and never more than
 * the world is tall.
 *
 * The world goes round, so the points' longitudes are a circle: the view is
 * centred on the shortest arc that holds them all, which for Cook's Hawaii
 * and London is across the Pacific's edge and not across Asia. When they do
 * not all fit across (on a phone, the Americas, Europe and China in one
 * year), it is the window of that width with the most of them in.
 */
export function fitView(points: LatLon[], aspect: number, minSpan = 30): View {
  const tall = WORLD.north - WORLD.south
  if (!points.length) return { lon: 10, lat: (WORLD.north + WORLD.south) / 2, span: Math.min(tall, 360 / aspect) }
  let s = 90, n = -90
  for (const [la] of points) { s = Math.min(s, la); n = Math.max(n, la) }

  // The shortest arc round the world that holds every longitude: the gap
  // between neighbours that is biggest is the part of the world left out.
  const lons = points.map((p) => ((p[1] % 360) + 540) % 360 - 180).sort((a, b) => a - b)
  let gap = -1, after = 0
  for (let i = 0; i < lons.length; i++) {
    const g = (i + 1 < lons.length ? lons[i + 1] : lons[0] + 360) - lons[i]
    if (g > gap) { gap = g; after = i }
  }
  const w = lons[(after + 1) % lons.length]
  const arc = lons.length === 1 ? 0 : 360 - gap
  const padY = Math.max(8, (n - s) * 0.2), padX = Math.max(10, arc * 0.12)
  let span = Math.max(minSpan, n - s + 2 * padY, (arc + 2 * padX) / aspect)
  span = Math.min(span, tall)
  const across = span * aspect
  let lon = w + arc / 2
  // A narrower margin is better than leaving somebody off: only when even
  // eight degrees each side will not do is it a choice of whom to show.
  if (arc + 16 > across) {
    const padX = 8
    // Not all of them: the window this wide with the most in it, centred on those.
    const inner = across - 2 * padX
    let best = -1
    for (let i = 0; i < lons.length; i++) {
      let count = 0, last = lons[i]
      for (let j = 0; j < lons.length; j++) {
        const d = ((lons[j] - lons[i]) % 360 + 360) % 360
        if (d <= inner) { count++; last = Math.max(last, lons[i] + d) }
      }
      if (count > best) { best = count; lon = (lons[i] + last) / 2 }
    }
  }
  const halfH = span / 2
  const lat = Math.max(WORLD.south + halfH, Math.min(WORLD.north - halfH, (n + s) / 2))
  return { lon: ((lon % 360) + 540) % 360 - 180, lat, span }
}

/** A place on a view of `w` x `h` pixels, as x and y in pixels. */
export function toScreen(v: View, w: number, h: number, lat: number, lon: number): [number, number] {
  const k = h / v.span
  // The copy of the place nearest the middle of the view: the map goes round.
  return [w / 2 + (nearLon(lon, v.lon) - v.lon) * k, h / 2 - (lat - v.lat) * k]
}

/**
 * Several people at one place: each a little way round the place, on a
 * sunflower spiral, so a crowd in London is a crowd and not one dot. `i` of
 * `n`, at `gap` pixels between neighbours. The first is on the place itself.
 */
export function crowdOffset(i: number, gap: number): [number, number] {
  if (i === 0) return [0, 0]
  const r = gap * Math.sqrt(i) * 0.9
  const a = i * 2.39996323
  return [Math.cos(a) * r, Math.sin(a) * r]
}
