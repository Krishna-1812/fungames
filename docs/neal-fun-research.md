# neal.fun — full game teardown

Every game on the site, probed in a real browser on 2026-09-03/04: page text,
DOM composition, asset counts, document height, bundle size and network calls.

## Infrastructure (measured, whole site)

- **Nuxt 2**, fully static (`data-n-head-ssr`, `/_nuxt/static/<buildId>/{state,payload,manifest}.js`)
- **Cloudflare** in front of everything; bot challenge on game routes
- **Cloudflare Workers** for game APIs — confirmed by `asteroid-launcher.neal-api.workers.dev`
- **DigitalOcean App Platform** for stateful/realtime services:
  - `wss://internet-roadtrip-listen-eqzms.ondigitalocean.app` (Internet Roadtrip)
  - `lionfish-app-xxqtp.ondigitalocean.app` (Wonders of Street View)
  - `wiki-spy-uaew8.ondigitalocean.app` (Wiki Spy)
- **Ads: two networks** — Google AdSense (`ca-pub-4556406968269041`) *and*
  Playwire RAMP (`cdn.intergient.com/1024587/73417/ramp`)
- **Plausible** analytics; **MailerLite** newsletter (`/api/newsletter/subscribe`)
- **Apple MapKit** for maps (`cdn.apple-mapkit.com`), token minted server-side
  via `/api/asteroid-launcher/getToken`
- **three.js** for 3D (Asteroid Launcher)
- Cloudflare **Turnstile** + a WASM anti-cheat (`pawtect_wasm_bg.wasm`) on Internet Roadtrip

## The games

Legend: `px` = document height, `kb` = JS chunk weight, `c` = canvases.

### Deep scroll stories (the signature format)

| Game | px | Notes |
|---|---|---|
| The Deep Sea | **183,642** | 128 images, 1 canvas, no API. The scroll *is* the game. |
| Universe Forecast | 21,438 | Future of the universe, pure text + scroll |
| Earth Reviews | 16,002 | 130 statically generated sub-pages, live rating counts |
| Who Was Alive? | 15,906 | 99 portraits, number input for a year |
| Spend Bill Gates' Money | 15,873 | 46 images, DOM only, no canvas |
| Sell! Sell! Sell! | 13,326 | 21 images, product-volume comparisons |
| Days Since Incident | 12,872 | **Live data** — earthquakes etc., "13 minutes ago" |
| Draw Logos From Memory | 11,507 | **12 canvases**, one per logo |
| Where does the day go? | 10,904 | Time-budget essay |
| Dark Patterns | 9,327 | Interactive essay, zero images |
| Speed | 8,495 | Live-updating "how far you've moved" |
| Let's Settle This | 8,283 | 41 images, poll/vote per question |
| Life Checklist | 7,969 | Emoji milestone list |
| Printing Money | 6,525 | **13 canvases**, money-printing rates |
| Progress | 5,387 | Live countdowns to everything |
| Share This Page | 5,072 | Joke: 20+ absurd ways to share |
| Ambient Chaos | 4,497 | Sound mixer, 38 sources |
| Baby Map | 2,132 | Live birth-rate simulation by country |
| Paper | 2,110 | Exponential folding |
| Wiki Spy | 2,218 | DigitalOcean backend |

### Fixed-viewport / swipe journeys (`px` = 818, i.e. locked)

| Game | Notes |
|---|---|
| The Size of Space | 3 canvases, 60 images, 1011 KB — horizontal swipe |
| Internet Artifacts | 904 KB, horizontal swipe through internet history |
| Size of Life | 13 audio files, illustrations commissioned from Julius Csotonyi |
| Space Elevator | 91 images, vertical journey |
| I'm Not a Robot | 4 audio, escalating CAPTCHA, **no backend at all** |
| The Auction Game | 4 images, bidding rounds |
| Design the next iPhone | Drag & drop, **generates a downloadable video** |
| Constellation Draw | Canvas + `/api/constellation-draw`, shared persistent sky |
| Unusual Suspects | Canvas drawing, **no API calls whatsoever** |

### Heaviest bundles

| Game | JS |
|---|---|
| Stimulation Clicker | 1,249 KB (2 canvas, 23 img, 8 audio) |
| Asteroid Launcher | 1,108 KB (4 canvas, three.js, Apple MapKit) |
| The Password Game | 1,015 KB — every rule, the chess engine and the word lists inline |
| The Size of Space | 1,011 KB |
| Internet Artifacts | 904 KB |

### Games with a real backend

| Game | Endpoint |
|---|---|
| Infinite Craft | `/api/infinite-craft/pair` — KV + 3-day edge cache + LLM on miss |
| The Password Game | `/api/password-game/wordle` — daily Wordle answer only |
| Asteroid Launcher | `/api/asteroid-launcher/getToken` — Apple MapKit JWT |
| Cursor Camp | `/api/cursor-camp/video`, `/api/cursor-camp/schedule` |
| Constellation Draw | `/api/constellation-draw` |
| Internet Roadtrip | websocket on DigitalOcean |
| Wonders of Street View | DigitalOcean (like counts) |
| Wiki Spy | DigitalOcean |
| (most others) | **none** |

## What the teardown actually teaches

1. **Most games have no server.** Of ~47, only 8 talk to a backend. The default
   is a self-contained page.
2. **Weight goes into content, not framework.** The Password Game is 1 MB of
   *rules and word lists*. The Deep Sea is 183,000 pixels of *illustration*.
3. **Two page shapes cover almost everything**: a very long scroll, or a locked
   viewport you swipe through.
4. **Live data is a cheap thrill.** Progress, Speed, Baby Map and Days Since
   Incident are all just `setInterval` over a clock or a public feed.
5. **He pays for art.** Size of Life credits a named palaeoartist. The tiles are
   hand-drawn SVGs.
6. **Monetisation is layered but light** — AdSense *and* Playwire, plus tips and
   a newsletter, never a paywall.
