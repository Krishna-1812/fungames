# Getting this running on a new machine

This is a normal git repository, hosted on GitHub at
<https://github.com/Krishna-1812/fungames>. There is no database, no cloud
service tied to any one machine, and nothing to migrate by hand — cloning the
repo is the whole handoff.

---

## Requirements

| Requirement | Check with | Get it |
|---|---|---|
| **Node.js 20+** | `node -v` | <https://nodejs.org> or `brew install node` |
| **npm** (ships with Node) | `npm -v` | — |
| git | `git --version` | comes with Xcode CLT / `brew install git` |

Nothing else. No global packages, no CLI tools, no API keys. The optional
Cloudflare Worker (see README's "Deploying" section) needs `npx wrangler`,
which downloads on demand.

---

## Set up

```bash
git clone https://github.com/Krishna-1812/fungames.git
cd fungames
npm ci
npm run build
npm run preview
```

Open <http://localhost:4400> and click into **Powder**. If sand falls and
piles up, the whole toolchain is working.

`npm ci` installs the exact dependency versions from `package-lock.json` —
use it instead of `npm install` on a fresh clone, since `install` is free to
bump versions.

---

## Day-to-day commands

```bash
npm run dev        # dev server with hot reload -> localhost:4321
npm run build      # production build -> dist/
npm run preview    # serve the real build -> localhost:4400
```

**Test against `npm run preview`, not `npm run dev`.** Astro's dev server
caches component CSS aggressively and will happily serve a stale stylesheet
after an edit. If styles look wrong in dev: stop it,
`rm -rf node_modules/.vite .astro`, and start again.

---

## Repo layout, top level

```
fungames/
├── README.md               architecture, every game, adding one, deploying
├── HANDOFF.md               this file
├── docs/
│   └── neal-fun-research.md the game-by-game teardown of neal.fun this was built from
├── package.json             scripts and dependencies (astro, three)
├── package-lock.json        exact dependency tree — do not delete
├── astro.config.mjs         site URL, trailing slashes, static output
├── tsconfig.json
├── netlify.toml             deploy config
├── wrangler.toml            Cloudflare Worker config (optional backend)
├── .claude/launch.json      dev-server config for Claude Code's browser pane
├── public/
│   └── _headers             cache headers (Netlify + Cloudflare Pages read this)
├── worker/
│   └── fusion-worker.js     the optional edge API for the Fusion game
└── src/                     see README.md for the full breakdown
```

### The fifteen games

`overstimulated` · `orbit` · `powder` · `deep-time` · `scale` · `rule-cascade`
· `spend-it` · `steady-hand` · `fusion` · `trolley` · `paper-folds` ·
`ambient-mix` · `progress` · `from-memory` · `life-in-weeks`

---

## Nothing to migrate

No database. No environment variables. No secrets. No accounts.

Player progress (Fusion discoveries, Steady Hand's best score, Spend It's
basket, your birth date in Life in Weeks, the mute setting) lives in each
visitor's own browser `localStorage`. It is per-browser by design, does not
transfer between machines, and was never anywhere on disk to begin with.

The only optional backend is the Fusion Cloudflare Worker, and it is **not
deployed**. `README.md`'s "Deploying" section has the steps if you want it.

---

## Everything else

`README.md` has the full picture: what this repo is and why Astro over Nuxt,
the architecture, a rundown of all fifteen games, the accessibility and
performance bar it's held to, adding a new game, rebranding
(`src/site.config.ts` and `astro.config.mjs`'s `site` — the two must match),
and deploying.
