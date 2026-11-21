/**
 * Internet Artifacts' photographs: one object for each of the twenty-five
 * moments, made for this page as a signed-distance model and photographed
 * offline (scripts/artifact-bake/<slug>.glsl, baked by
 * `node scripts/bake-artifacts.mjs` to public/internet-artifacts/<slug>.webp,
 * 960 square, and <slug>-s.webp, 480). They are cut out: transparent but for
 * the object and the shadow it throws, so each lies on its era's sky as if it
 * stood there.
 *
 * None of them is the original thing, and the page says so; most moments
 * never had one object to photograph at all. Each is the object that stands
 * for its moment best: the log book the first message was written down in,
 * the badge people wore after flag day, the coffee pot itself.
 */
export type Photo = {
  /** File name under public/internet-artifacts/, without .webp. */
  slug: string
  /** What the photograph shows, said plainly: the caption and the alt text. */
  caption: string
}

/** Keyed by the moment's title, exactly as in src/data/internet-artifacts.ts. */
export const PHOTOS: Record<string, Photo> = {
  'The first message ever sent between two computers': { slug: 'logbook', caption: 'A lab log book, open at the night of October 29, 1969' },
  'The first network email': { slug: 'teletype-keys', caption: 'A teleprinter keyboard, and its top row: QWERTYUIOP' },
  'The first spam email': { slug: 'spam-printout', caption: 'The announcement, printed out on green-bar paper' },
  'The first emoticon': { slug: 'crt-terminal', caption: 'A green-screen terminal showing the post' },
  'ARPANET’s flag day': { slug: 'tcp-button', caption: 'The badge people wore afterwards' },
  'The first .com domain': { slug: 'rotary-file', caption: 'A desk card file, open at Symbolics' },
  'The Morris Worm': { slug: 'floppy-disk', caption: 'A 3.5-inch floppy, like the one that holds the worm’s source code' },
  'The World Wide Web goes public': { slug: 'server-cube', caption: 'A black cube workstation, with the warning taped to it' },
  'The first photo on the Web': { slug: 'photo-print', caption: 'A print of it: four singers in front of a painted backdrop' },
  'The first concert streamed live online': { slug: 'microphone', caption: 'A stage microphone, for a band playing to a few hundred screens' },
  'A coffee pot gets the first webcam': { slug: 'coffee-pot', caption: 'The coffee pot, a third full, as the camera usually found it' },
  'The first secure online purchase': { slug: 'compact-disc', caption: 'A compact disc, which is what was bought' },
  'The first banner ad': { slug: 'ball-mouse', caption: 'A ball mouse, of the kind the ad asked you to click' },
  'The first eBay sale': { slug: 'laser-pointer', caption: 'A broken laser pointer, sold for $14.83' },
  'The Dancing Baby': { slug: 'beige-monitor', caption: 'A beige monitor, and the inbox it spread through' },
  'The Hampster Dance': { slug: 'modem', caption: 'A 56K modem, which is how everyone got there' },
  'Google is founded': { slug: 'brick-server', caption: 'Hard drives in a case built of toy bricks, as Google’s first were' },
  'Napster launches': { slug: 'mp3-player', caption: 'An early MP3 player' },
  '“All your base are belong to us”': { slug: 'game-cartridge', caption: 'A cartridge with the line on its label' },
  'The first Wikipedia edit': { slug: 'laptop', caption: 'A 2001 laptop, open at the first edit' },
  'The Numa Numa Dance': { slug: 'webcam', caption: 'A USB webcam, the kind he sang into' },
  'The first YouTube video': { slug: 'digital-camera', caption: 'A compact digital camera of 2005' },
  'The first tweet': { slug: 'flip-phone', caption: 'A flip phone: the first tweets were text messages' },
  'The first Rickroll': { slug: 'vinyl-single', caption: 'A seven-inch single from 1987' },
  'Nyan Cat': { slug: 'pop-tart', caption: 'A frosted toaster pastry, one corner gone' },
}
