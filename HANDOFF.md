# Moving this project to another machine

Everything you need is in this folder. There is no database, no cloud service,
no account, and nothing outside it. The site is fifteen self-contained pages and
a build step.

---

## Where it currently lives

| | |
|---|---|
| Path on the old laptop | `/Users/teampx/config/Test/funsite` |
| Git | initialised in this folder, one commit, **no remote** |
| GitHub | **not pushed anywhere** |
| Anything else off-machine | **none** |

The folder is ~152 MB, but **only ~580 KB of that is real**. The rest is
`node_modules/`, which is rebuilt exactly from `package-lock.json` on the new
machine. That is why the archive is small.

---

## What you need on the new laptop

| Requirement | Version | Check with | Get it |
|---|---|---|---|
| **Node.js** | 20 or newer (built on 25.9.0) | `node -v` | <https://nodejs.org> or `brew install node` |
| **npm** | ships with Node | `npm -v` | — |
| git | any recent | `git --version` | comes with Xcode CLT / `brew install git` |

Nothing else. No global packages, no CLI tools, no API keys. The optional
Cloudflare Worker needs `npx wrangler`, which downloads on demand.

---

## Option A — the archive (simplest, works offline)

You have `funsite-handoff.tar.gz`. Move it across however you like: AirDrop, a
USB stick, Google Drive, email it to yourself.

On the new laptop:

```bash
mkdir -p ~/projects && cd ~/projects
tar -xzf ~/Downloads/funsite-handoff.tar.gz
cd funsite
npm ci
npm run build
npm run preview
```

Open <http://localhost:4400>. That is the whole thing.

`npm ci` installs the exact dependency versions from `package-lock.json`, so
the new machine gets a byte-identical dependency tree. Use `npm ci`, not
`npm install` — `install` is free to bump versions.

The archive already contains the git history, so you can carry on committing
immediately.

---

## Option B — via GitHub (better if you want it backed up)

`gh` is installed on the old laptop but **not logged in**, so I could not push
for you. Two commands do it.

**On the old laptop**, after `gh auth login`:

```bash
cd /Users/teampx/config/Test/funsite && gh repo create funsite --private --source=. --push
```

If you would rather not use `gh`, create an empty repo on github.com and then:

```bash
cd /Users/teampx/config/Test/funsite
git remote add origin git@github.com:YOURNAME/funsite.git
git branch -M main && git push -u origin main
```

**On the new laptop**:

```bash
git clone git@github.com:YOURNAME/funsite.git
cd funsite && npm ci && npm run preview
```

> Keep it **private** unless you want the code public. Nothing in here is
> secret — there are no keys — but that is your call to make deliberately.

---

## Verifying it worked

Run these on the new laptop. All three should pass before you delete anything.

```bash
npm run build
```

Expect `17 page(s) built` and no errors.

```bash
ls dist/*.html dist/*/index.html | wc -l
```

Expect `16` — the homepage, fourteen game pages, and 404. (`sitemap.xml` and
`robots.txt` sit alongside them.)

Then `npm run preview`, open <http://localhost:4400>, and click into **Powder**.
If sand falls and piles up, the whole toolchain is working.

---

## Day-to-day commands

```bash
npm run dev        # dev server with hot reload -> localhost:4321
npm run build      # production build -> dist/
npm run preview    # serve the real build -> localhost:4400
```

**Test against `npm run preview`, not `npm run dev`.** Astro's dev server caches
component CSS aggressively and will serve you a stale stylesheet after an edit.
If styles look wrong in dev: stop it, `rm -rf node_modules/.vite .astro`, start
again.

---

## What is in the folder

```
funsite/
├── README.md                  the full write-up: research, architecture, every game
├── HANDOFF.md                 this file
├── docs/
│   └── neal-fun-research.md   the game-by-game teardown of neal.fun
├── package.json               scripts and the single dependency (astro)
├── package-lock.json          exact dependency tree — do not delete
├── astro.config.mjs           site URL, trailing slashes, static output
├── tsconfig.json
├── netlify.toml               deploy config
├── wrangler.toml              Cloudflare Worker config (optional backend)
├── .gitignore
├── .claude/launch.json        dev-server config for Claude Code's browser pane
├── public/
│   └── _headers               cache headers (Netlify + Cloudflare Pages read this)
├── worker/
│   └── fusion-worker.js       the optional edge API for the Fusion game
└── src/
    ├── site.config.ts         ← RENAME THE SITE HERE
    ├── data/games.ts          the game registry — one entry per game
    ├── styles/global.css      design tokens
    ├── lib/
    │   ├── audio.ts           the synthesiser (every sound on the site)
    │   └── fx.ts              particles, screen shake, floating text
    ├── layouts/
    │   ├── Base.astro         <head>, meta, fonts, analytics, ads
    │   └── GameLayout.astro   game chrome: back link, title, share, mute
    ├── components/
    │   ├── GameTile.astro     homepage tile
    │   ├── TileArt.astro      fifteen generated tile illustrations
    │   └── AdSlot.astro       AdSense unit (renders nothing until configured)
    └── pages/
        ├── index.astro        the grid
        ├── 404.astro
        ├── sitemap.xml.ts     generated from the registry
        ├── robots.txt.ts
        └── ...15 game pages
```

### The fifteen games

`powder` · `orbit` · `overstimulated` · `deep-time` · `scale` · `rule-cascade` ·
`spend-it` · `steady-hand` · `fusion` · `trolley` · `paper-folds` ·
`ambient-mix` · `progress` · `from-memory` · `life-in-weeks`

---

## First things to do on the new machine

1. **Rename the site.** Everything user-facing is in `src/site.config.ts`:
   name, domain, tagline, contact, socials, Plausible domain, AdSense id.
   Analytics and ads render nothing until those are filled in.
2. **Set the real domain** in `astro.config.mjs` (`site:`) — it drives canonical
   URLs, the sitemap and Open Graph tags.
3. Deploy. `dist/` is a plain static folder; drag it onto Netlify or Cloudflare
   Pages, or point either at the repo with build command `npm run build` and
   publish directory `dist`.

---

## Nothing to migrate

No database. No environment variables. No secrets. No accounts.

Player progress (Fusion discoveries, Steady Hand best score, Spend It basket,
your birth date in Life in Weeks, the mute setting) lives in each visitor's own
`localStorage`. It is per-browser by design and does not transfer — which also
means there is no personal data on the old laptop to clean up.

The only optional backend is the Fusion worker, and it is **not deployed**. If
you want it later, `README.md` has the steps.

---

## Removing it from the old laptop

**Do this only after the new laptop builds and Powder runs.**

```bash
rm -rf /Users/teampx/config/Test/funsite /Users/teampx/config/Test/.claude
```

That is the only copy on this machine. Once it is gone it is gone, so if you
went the archive route rather than GitHub, keep the `.tar.gz` somewhere safe
until you are certain.
