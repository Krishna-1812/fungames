/**
 * The thirty things you can buy, and the money you have to do it with.
 *
 * Out here rather than in the page's frontmatter so scripts/check-icons.mjs
 * can read the list: every entry names an icon, and the checker fails if one
 * of them has no drawing, or if a drawing exists that nothing buys.
 *
 * The joke only lands if the numbers are real, so prices are researched
 * ballpark figures rather than round invented ones, and the budget is large
 * enough that buying every single item still leaves money behind. The player
 * has to actively try to get to zero.
 */
export type Item = {
  name: string
  price: number
  /** Key into lib/icons.ts. */
  icon: string
}

export const ITEMS: Item[] = [
  { name: 'Big Mac', price: 6, icon: 'burger' },
  { name: 'Latte', price: 5, icon: 'coffee' },
  { name: 'Cinema ticket', price: 15, icon: 'film' },
  { name: 'Hardback book', price: 25, icon: 'book' },
  { name: 'Video game', price: 70, icon: 'gamepad' },
  { name: 'Concert ticket', price: 180, icon: 'ticket' },
  { name: 'Camera drone', price: 450, icon: 'drone' },
  { name: 'Smartphone', price: 1_000, icon: 'phone' },
  { name: 'Laptop', price: 2_400, icon: 'laptop' },
  { name: 'Grand piano', price: 7_500, icon: 'piano' },
  { name: 'Motorcycle', price: 9_000, icon: 'motorcycle' },
  { name: 'Diamond ring', price: 18_000, icon: 'ring' },
  { name: 'Electric car', price: 42_000, icon: 'car' },
  { name: 'Sports car', price: 95_000, icon: 'sports-car' },
  { name: 'Racehorse', price: 250_000, icon: 'horse' },
  { name: 'Family home', price: 400_000, icon: 'house' },
  { name: 'Beach villa', price: 1_500_000, icon: 'villa' },
  { name: 'Superyacht', price: 4_000_000, icon: 'yacht' },
  { name: 'Formula 1 car', price: 9_000_000, icon: 'f1' },
  { name: 'Private jet', price: 25_000_000, icon: 'jet' },
  { name: 'A Van Gogh', price: 60_000_000, icon: 'painting' },
  { name: 'Skyscraper', price: 120_000_000, icon: 'skyscraper' },
  { name: 'Boeing 787', price: 250_000_000, icon: 'airliner' },
  { name: 'Cruise ship', price: 600_000_000, icon: 'cruise' },
  { name: 'Football club', price: 1_000_000_000, icon: 'football' },
  { name: 'Orbital rocket', price: 2_500_000_000, icon: 'rocket' },
  { name: 'Nuclear submarine', price: 5_000_000_000, icon: 'submarine' },
  { name: 'Aircraft carrier', price: 13_000_000_000, icon: 'carrier' },
  { name: 'Mission to Mars', price: 20_000_000_000, icon: 'mars' },
  { name: 'A social network', price: 44_000_000_000, icon: 'network' },
]

export const BUDGET = 100_000_000_000
