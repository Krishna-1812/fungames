/**
 * The Deep Sea — every marker, and the real depth it sits at.
 *
 * Lifted out of the page for the same reason `time-events.ts` and
 * `scale-things.ts` are: `scripts/check-deep-sea-art.mjs` reads the same list
 * the page renders, so a scene keyed on a title that has since been reworded
 * cannot go silently missing.
 *
 * `depth` is metres below the surface. Every number here is a real recorded
 * depth — a species' documented range, a shipwreck's surveyed position, a
 * dive that actually happened — not an invented waypoint. Sources are in the
 * commit that added this file; where a range exists, `depth` is picked from
 * inside it rather than at an edge, and the note says so.
 */
export type Marker = {
  depth: number
  title: string
  note: string
  /** The turning points — a zone's defining fact, or a genuine record. */
  big?: boolean
}

export type Zone = {
  id: string
  /** Standard oceanographic name. */
  name: string
  /** What this page calls it, in the HUD and the seam. */
  label: string
  from: number
  to: number
  /** How many pixels of scroll one metre of real depth gets in this zone. */
  pxPerMetre: number
  /** Two tones for the seam rule — this zone's own first and last colour. */
  sky: [string, string]
  temp: string
  light: string
}

// Standard oceanographic zone boundaries — these are the textbook figures,
// not this page's invention. Density falls zone over zone: the sunlight zone
// is a thousand pixels for two hundred metres because that is where almost
// everything a person has ever seen alive actually lives; the trenches get
// more total height than any other zone despite being the emptiest, because
// they hold the whole back half of this page's real story.
export const ZONES: Zone[] = [
  {
    id: 'sunlight', name: 'Epipelagic', label: 'The sunlight zone',
    from: 0, to: 200, pxPerMetre: 5,
    sky: ['#bdeaf5', '#0e4a68'], temp: '~20°C at the surface', light: 'full daylight, fading fast',
  },
  {
    id: 'twilight', name: 'Mesopelagic', label: 'The twilight zone',
    from: 200, to: 1000, pxPerMetre: 3,
    sky: ['#0e4a68', '#0a1f30'], temp: '~5–12°C', light: 'a deep blue gloom, then none',
  },
  {
    id: 'midnight', name: 'Bathypelagic', label: 'The midnight zone',
    from: 1000, to: 4000, pxPerMetre: 1.6,
    sky: ['#0a1f30', '#050b14'], temp: '~4°C', light: 'none at all, ever',
  },
  {
    id: 'abyss', name: 'Abyssopelagic', label: 'The abyss',
    from: 4000, to: 6000, pxPerMetre: 1,
    sky: ['#050b14', '#03070d'], temp: '~2°C', light: 'none',
  },
  {
    id: 'trenches', name: 'Hadalpelagic', label: 'The trenches',
    from: 6000, to: 10_935, pxPerMetre: 1.3,
    sky: ['#03070d', '#000000'], temp: '~1–4°C', light: 'none',
  },
]

export const TOTAL_DEPTH = ZONES[ZONES.length - 1].to

export const MARKERS: Marker[] = [
  {
    depth: 30, title: 'Coral reefs',
    note: 'Reef-building coral keeps algae living inside its own tissue, and that algae needs sunlight to photosynthesise — which is why almost no reef on Earth is built much deeper than this.',
  },
  {
    depth: 40, title: 'The recreational diving limit',
    note: 'Most scuba certifications stop training divers at forty metres. Go deeper than that on ordinary compressed air and the nitrogen you are breathing starts to act like a drug.',
  },
  {
    depth: 220, title: 'Ninety percent of what lives here makes its own light',
    note: 'Below two hundred metres, almost no sunlight survives. Lanternfish, hatchetfish and nearly everything around them glow — mostly to erase their own silhouette from whatever is underneath them, looking up.',
    big: true,
  },
  {
    depth: 332, title: 'The deepest a scuba diver has ever gone',
    note: 'Ahmed Gabr spent twelve minutes reaching this depth in the Red Sea in 2014, then more than thirteen hours decompressing on the way back up. It is a world record, and it is not yet a third of the way through this zone.',
  },
  {
    depth: 500, title: 'Giant squid',
    note: 'Architeuthis dux — up to twelve metres long, almost never seen alive. Most of what is known about it comes from bodies that washed ashore, or turned up in a sperm whale’s stomach.',
  },
  {
    depth: 700, title: 'Vampire squid',
    note: 'Vampyroteuthis infernalis lives inside the ocean’s oxygen-minimum zone, where there is too little dissolved oxygen for almost anything else to survive. Huge gills and a metabolism turned down to almost nothing are what let it stay there, safe from nearly every predator.',
  },
  {
    depth: 900, title: 'Blobfish',
    note: 'Psychrolutes marcidus is only famous for looking wrong out of water. Down here, under roughly ninety times the surface pressure, its gelatinous, nearly boneless body is simply what a fish looks like once it stops needing to fight gravity.',
  },
  {
    depth: 1050, title: 'Below this, no light has ever reached',
    note: 'Not starlight, not a lightning flash from a storm on the surface — nothing. Every point of light for the rest of this page is something down here making it itself.',
    big: true,
  },
  {
    depth: 1300, title: 'Anglerfish',
    note: 'The lure is grown out of its own spine, and in some species it runs on bacteria the fish cultivates inside it on purpose. The rest of the fish is built around one thing: a mouth big enough for whatever swims up to look.',
  },
  {
    depth: 1600, title: 'Sperm whales hunt here',
    note: 'A sperm whale can dive more than two kilometres chasing giant squid — deeper than eleven Empire State Buildings stacked end to end — and hold its breath for over an hour to do it.',
  },
  {
    depth: 2100, title: 'A hydrothermal vent',
    note: 'Mineral-choked water blasts out of the seafloor here at up to 400°C, feeding an ecosystem that runs on chemistry instead of sunlight — giant tube worms, blind shrimp, bacteria that metabolise metal. It is the closest thing on Earth to how life might survive on a moon with no sun at all.',
    big: true,
  },
  {
    depth: 2200, title: 'Colossal squid',
    note: 'Mesonychoteuthis hamiltoni is heavier than a giant squid and carries swivelling hooks instead of plain suckers. The evidence that it lives this deep is indirect: intact adult beaks, recovered from the stomachs of the sperm whales that hunt it.',
  },
  {
    depth: 2992, title: 'The deepest dive any mammal has ever made',
    note: 'A tagged Cuvier’s beaked whale, recorded diving 2,992 metres on a single breath — deeper than any other whale, seal, or human on record.',
  },
  {
    depth: 3682, title: 'The average depth of the entire ocean',
    note: 'If every mountain, trench and continental shelf on the seafloor were levelled flat, this is how deep the ocean would be — everywhere, all at once.',
    big: true,
  },
  {
    depth: 3810, title: 'The Titanic',
    note: 'It has rested here longer than it was ever afloat — since 1912, thirty-eight hundred and ten metres down, being slowly consumed by a species of rust-eating bacteria that did not have a name until divers found it living on the hull.',
  },
  {
    depth: 4200, title: 'Almost nothing lives here, and almost everything that does is beige',
    note: 'No sunlight, no plants, water a few degrees above freezing, and pressure that would crush a submarine hull not built for it. What survives mostly eats whatever sinks from above — a slow, endless snow of dead plankton, falling from a sunlight zone thousands of metres up.',
    big: true,
  },
  {
    depth: 5000, title: 'Sea cucumbers, grazing',
    note: 'Across vast, otherwise nearly empty plains scattered with potato-sized manganese nodules, deep-sea sea cucumbers are among the most common large animals left — working the seafloor for whatever organic matter that snow has provided.',
  },
  {
    depth: 6000, title: 'Past this line, life only exists in trenches',
    note: 'The hadal zone is not a layer of open ocean like the four above it. It exists only inside the cracks: the two dozen deep-sea trenches where one tectonic plate is being forced under another.',
    big: true,
  },
  {
    depth: 6957, title: 'The deepest-living octopus ever filmed',
    note: 'A dumbo octopus, recorded on camera in the Java Trench in 2020 — the first confirmed sighting of any octopus this deep, and further down than most researchers expected to find one at all.',
  },
  {
    depth: 8336, title: 'The deepest fish ever recorded',
    note: 'A snailfish, translucent and built almost entirely of loose, jelly-soft tissue, filmed in the Izu-Ogasawara Trench in 2022 — beating the previous record-holder, the Mariana snailfish, by little more than a hundred metres. Researchers studying both think fish physiology itself may simply stop working a few hundred metres deeper than this.',
    big: true,
  },
  {
    depth: 10_898, title: 'Fewer people have been here than on the Moon',
    note: 'James Cameron reached this depth alone in 2012, fifty-two years after the only other crewed descent. In the decades between those two dives, more people had walked on the Moon than had ever seen the bottom of the ocean.',
    big: true,
  },
  {
    depth: 10_935, title: 'Challenger Deep — the bottom',
    note: 'The deepest known point in any ocean on Earth, in the Mariana Trench, confirmed to within six metres by sonar surveys published in 2021. The pressure here is over a thousand times what it is at the surface. This is as far down as the ocean — or this page — goes.',
    big: true,
  },
]
