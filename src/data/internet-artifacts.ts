/**
 * Internet Artifacts — twenty-five real, dated moments from the internet's
 * own history, in the order they actually happened.
 *
 * Same shape as `space-elevator.ts`: `Zone`s carve the scroll into eras, each
 * with its own pixels-per-year density and its own two-tone sky; `Marker`s
 * are real events, placed by real date. Where a source gives a full date
 * (day, month, year) `year` is that date converted to a decimal — purely a
 * layout position, never shown. What's shown is `date`, a plain string, and
 * its precision is honest: "October 29, 1969" where a day is documented,
 * "November 1993" where only a month is, "1971" where not even Ray Tomlinson
 * himself could recall which day he sent the first network email. Nothing
 * here is rounded up to a fake precision to make the timeline feel tidier.
 *
 * Every fact was checked against at least one independent source (Wikipedia,
 * the CMU page hosting Scott Fahlman's original smiley post, CERN's own
 * history pages, the FBI's account of the Morris Worm) before it went in
 * here; where sources genuinely disagree — Google's domain registration vs.
 * its incorporation, the exact minute of the first tweet — the note says so
 * rather than picking one silently. Sources are in the commit that added
 * this file.
 */
export type Marker = {
  /** Decimal year — a layout position only, never rendered. */
  year: number
  /** What's actually shown. Precision matches what's really documented. */
  date: string
  title: string
  note: string
  /** The ones that changed what the internet was, not just what was on it. */
  big?: boolean
}

export type Zone = {
  id: string
  /** What this page calls the era, in the seam between zones. */
  label: string
  from: number
  to: number
  /** How many pixels of scroll one year gets in this era. */
  pxPerYear: number
  /** Two tones for the seam rule and the sky — this era's own first and last colour. */
  sky: [string, string]
  note: string
}

// Five eras, running the same visual arc the internet itself did: a dim,
// monochrome terminal green at the start, warming through blue and teal as
// the Web arrives, into the saturated, over-designed colour of the dot-com
// and video years. Density (pxPerYear) tracks how much actually happened —
// the sparse 1969-1983 decade gets fewer pixels per year than the four years
// spanning the Web's public launch, which is where six of the twenty-five
// artifacts land.
export const ZONES: Zone[] = [
  {
    id: 'arpanet', label: 'The ARPANET era',
    from: 1969, to: 1983, pxPerYear: 60,
    sky: ['#0b2b12', '#03110a'],
    note: 'Networked computers existed, but almost nobody outside a handful of universities and defence contractors had ever touched one.',
  },
  {
    id: 'early-internet', label: 'Before the Web',
    from: 1983, to: 1991, pxPerYear: 70,
    sky: ['#132a3d', '#081420'],
    note: 'Email and bulletin boards were the internet’s whole social life — there was no web to browse yet.',
  },
  {
    id: 'world-wide-web', label: 'The Web goes public',
    from: 1991, to: 1995, pxPerYear: 150,
    sky: ['#0e3b45', '#06181d'],
    note: 'Tim Berners-Lee’s web software went from an internal CERN tool to something anyone with a browser could read.',
  },
  {
    id: 'dot-com', label: 'The dot-com years',
    from: 1995, to: 2001, pxPerYear: 110,
    sky: ['#2a1245', '#150822'],
    note: 'The web became a place you could actually buy something, search for something, or lose an afternoon to.',
  },
  {
    id: 'web-two', label: 'Web 2.0 and viral video',
    from: 2001, to: 2012, pxPerYear: 70,
    sky: ['#3d0f2e', '#1c0716'],
    note: 'Video, and the crowd, took over — anyone with a webcam could reach more people than a TV network.',
  },
]

export const TOTAL_YEARS = ZONES[ZONES.length - 1].to - ZONES[0].from
export const START_YEAR = ZONES[0].from
export const END_YEAR = ZONES[ZONES.length - 1].to

export const MARKERS: Marker[] = [
  {
    year: 1969.827, date: 'October 29, 1969', title: 'The first message ever sent between two computers',
    note: 'Charley Kline typed “LO” from UCLA to the Stanford Research Institute — the system crashed before he could finish “LOGIN.” A full connection went through about an hour later. This is the moment ARPANET, the internet’s direct ancestor, first spoke to itself.',
    big: true,
  },
  {
    year: 1971.5, date: '1971', title: 'The first network email',
    note: 'Ray Tomlinson, at BBN, sent the first message between two separate computers on ARPANET and picked @ to separate a person’s name from the machine they were on. The exact date was never recorded — not even Tomlinson himself could later say which day it was.',
  },
  {
    year: 1978.337, date: 'May 3, 1978', title: 'The first spam email',
    note: 'Gary Thuerk, a DEC marketing manager, emailed roughly 393 ARPANET addresses at once to advertise a product demo. It worked well enough that DEC credited it with millions of dollars in sales — and it is the reason “spam” needed a name at all.',
  },
  {
    year: 1982.718, date: 'September 19, 1982', title: 'The first emoticon',
    note: 'Scott Fahlman posted to a Carnegie Mellon bulletin board: “I propose the following character sequence for joke markers: :-) Read it sideways.” The original post was lost for twenty years and recovered from a backup tape in 2002.',
  },
  {
    year: 1983.003, date: 'January 1, 1983', title: 'ARPANET’s flag day',
    note: 'Every machine on ARPANET was forced to switch from the old NCP protocol to TCP/IP in one coordinated cutover. Sites that weren’t ready simply dropped off the network. TCP/IP is still what your phone is speaking right now.',
    big: true,
  },
  {
    year: 1985.203, date: 'March 15, 1985', title: 'The first .com domain',
    note: 'Symbolics.com was registered by a Massachusetts computer maker, six years before the public had any reason to type a web address. Symbolics itself went bankrupt in 1996; the domain outlived the company by decades.',
  },
  {
    year: 1988.841, date: 'November 2, 1988', title: 'The Morris Worm',
    note: 'Robert Tappan Morris, a Cornell graduate student, released a self-replicating program meant only to gauge the size of the internet. A bug made it copy itself far more aggressively than intended, crippling roughly one in ten of the internet’s 60,000 connected computers and earning Morris the first felony conviction under the new Computer Fraud and Abuse Act.',
    big: true,
  },
  {
    year: 1991.597, date: 'August 6, 1991', title: 'The World Wide Web goes public',
    note: 'Tim Berners-Lee posted to the alt.hypertext newsgroup describing a new way to browse linked documents, pointing to a page at CERN. The software had existed inside CERN for about a year; this is the moment anyone outside it could actually try it.',
    big: true,
  },
  {
    year: 1992.548, date: 'July 18, 1992', title: 'The first photo on the Web',
    note: 'At Tim Berners-Lee’s own request, CERN’s Silvano de Gennaro uploaded a promotional photo of Les Horribles Cernettes, a parody pop group formed by CERN employees — making an in-joke band photo the first image the World Wide Web ever displayed.',
  },
  {
    year: 1993.479, date: 'June 24, 1993', title: 'The first concert streamed live online',
    note: 'The band Severe Tire Damage played from Xerox PARC while researchers demonstrated the “MBone,” an early internet video-multicast system — over a year before the Rolling Stones’ more famous 1994 webcast, for which Severe Tire Damage literally served as the opening act.',
  },
  {
    year: 1993.877, date: 'November 1993', title: 'A coffee pot gets the first webcam',
    note: 'Computer scientists at Cambridge University, tired of walking to an empty pot, pointed a camera at the Trojan Room coffee machine in 1991 for an internal video feed. In November 1993 they put it on the World Wide Web, and it became the most-watched pot of coffee in history.',
    big: true,
  },
  {
    year: 1994.611, date: 'August 11, 1994', title: 'The first secure online purchase',
    note: 'Dan Kohn sold a Sting CD for $12.48 plus shipping through his site NetMarket, using early SSL encryption to protect the buyer’s card number — the first proof that a credit card could survive a trip across the internet.',
  },
  {
    year: 1994.822, date: 'October 27, 1994', title: 'The first banner ad',
    note: '“Have you ever clicked your mouse right here? You will.” AT&T paid HotWired $30,000 for three months of one ad the size of a business card. Roughly 44% of everyone who saw it clicked — a rate no banner ad has come close to since.',
  },
  {
    year: 1995.679, date: 'September 1995', title: 'The first eBay sale',
    note: 'Pierre Omidyar’s new site, AuctionWeb, sold its first item over Labor Day weekend: a broken laser pointer, for $14.83, to a buyer who explained he collected broken laser pointers. Omidyar later said that email convinced him the site might actually work.',
  },
  {
    year: 1996.5, date: '1996', title: 'The Dancing Baby',
    note: 'A 3D animation bundled as sample content for a piece of animation software got tweaked, renamed “Baby Cha-Cha,” and emailed around the world as a GIF — one of the first pieces of media to spread purely because people kept forwarding it, years before anyone called that “going viral.”',
  },
  {
    year: 1998.2, date: '1998', title: 'The Hampster Dance',
    note: 'A Geocities page built by student Deidre LaCarte looped rows of hamster GIFs dancing to a sped-up sample — no plot, no product, nothing to click. It drew millions of visitors within a year, for reasons nobody, including LaCarte, ever fully explained.',
  },
  {
    year: 1998.677, date: 'September 4, 1998', title: 'Google is founded',
    note: 'Larry Page and Sergey Brin incorporated Google Inc. in a friend’s garage in Menlo Park. The domain google.com had already been registered the year before, while the search engine was still a Stanford research project called BackRub.',
    big: true,
  },
  {
    year: 1999.416, date: 'June 1, 1999', title: 'Napster launches',
    note: 'Shawn Fanning, an eighteen-year-old college dropout, released software that let anyone search and download MP3s directly from other users’ computers. It reached eighty million users before a lawsuit shut it down in 2001, and changed how the music industry sold music for good.',
    big: true,
  },
  {
    year: 2000.962, date: 'December 16, 2000', title: '“All your base are belong to us”',
    note: 'A clumsily translated line from the 1989 Sega game Zero Wing, already circulating in small pockets of the internet, exploded across early meme forums in a wave of Photoshopped images — one of the first phrases to spread purely through remixing rather than any original creator’s intent.',
  },
  {
    year: 2001.041, date: 'January 15, 2001', title: 'The first Wikipedia edit',
    note: 'A page called “HomePage” was edited to read “This is the new WikiPedia!” — the earliest surviving edit on the encyclopedia, made one day after the site launched. Founder Jimmy Wales has said an even earlier test edit, “Hello, World!”, didn’t survive.',
    big: true,
  },
  {
    year: 2004.934, date: 'December 6, 2004', title: 'The Numa Numa Dance',
    note: 'Gary Brolsma filmed himself lip-syncing and dancing to a Romanian pop song in his bedroom and uploaded it to Newgrounds under the name Gman250. It became one of the first webcam videos to make an ordinary person recognisable to millions of strangers.',
  },
  {
    year: 2005.310, date: 'April 23, 2005', title: 'The first YouTube video',
    note: '“Me at the zoo” — eighteen seconds of YouTube co-founder Jawed Karim standing in front of the elephants at the San Diego Zoo, noting that they have “really, really long trunks.” It is still on the site.',
    big: true,
  },
  {
    year: 2006.219, date: 'March 21, 2006', title: 'The first tweet',
    note: 'Jack Dorsey posted “just setting up my twttr” — the platform’s name before it owned enough vowels to be spelled normally. It remains the oldest tweet still on the service.',
  },
  {
    year: 2007.370, date: 'May 15, 2007', title: 'The first Rickroll',
    note: 'A 4chan user disguised a link as a leaked trailer for Grand Theft Auto IV; it actually played Rick Astley’s “Never Gonna Give You Up.” The bait-and-switch had a name within the year and has never really stopped happening since.',
  },
  {
    year: 2011.260, date: 'April 5, 2011', title: 'Nyan Cat',
    note: 'A looping GIF of a Pop-Tart cat trailing a rainbow, set to a looped vocal track, was turned into a YouTube video watched hundreds of millions of times since — an entire internet sense of humour compressed into nineteen seconds on repeat.',
    big: true,
  },
]

export const fmtYear = (y: number) => Math.round(y).toString()
