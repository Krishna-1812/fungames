# Implementation progress

Baseline reviewed: `092d685`, 6 September 2026. The working tree was clean.

The four commits since the earlier audit add 18 individual tile drawings,
65 shared icons, and raster checks. Preserve this visual direction and its
checks; do not repeat the earlier recommendation to replace generic tile art.
Reviewed the changed tile components, icon/art modules and checkers, plus the
commit descriptions and updated documentation.

## Phase 1 — reliability and release foundation

Implemented in the first batch:

- Fusion's 36 local recipes use ingredient tuples and a canonical pair function.
  Tests check every recipe in both orders and reachability from the four seeds.
- Browser and worker keys use JSON pairs, avoiding delimiter collisions.
  Browser save migration preserves discovered elements and discards ambiguous
  old recipe caches. Invalid data and storage failures have regression tests.
- Worker origin checks compare exact origins and reject lookalike domains;
  an untrusted Origin cannot be overridden by a trusted Referer. Configure
  allowed origins through `wrangler.toml` environment variables.
- Removed the cached global `isNew` claim. Personal discoveries remain in the
  browser. Model output validation and external-request timeouts are added.
- Fusion reports unavailable recipes in player-facing language, announces
  feedback, protects in-flight ingredients against another merge, and cancels
  interrupted drags without combining them.
- `npm test` runs all checkers and reports failing suites. `npm run check`
  includes the production build. CI runs the same gate on Node 24.
- Orbit advances physics at 60 simulation ticks per second, independently of
  display refresh. Background gaps pause time and short stalls have bounded
  catch-up. Tests compare actual trajectories and challenge progress at
  30/60/90/120/144 Hz.

Verification: all 14 check suites passed in the final aggregate run, including
art/icons, Fusion regressions and refresh-rate independence. `git diff --check`
passed. Fusion loaded saved discoveries and spawned an element from the tray.
Orbit rendered its five-body scene and its Pause/Resume controls worked. The
failed build invalidated Vite's development dependency cache; a config-watcher
restart regenerated it and restored normal development rendering.
Production build verification remains blocked by
`Cannot read directory "..": Access is denied` from esbuild while resolving
existing aria-query/axobject-query dependencies. Granting project write and
parent read access did not resolve it. Do not treat development rendering as
proof of a successful production build, or this batch as deployment-ready.

Still open in Phase 1:

- Reproduce and pass the production build in an unrestricted development/CI
  environment; run desktop and phone gameplay checks against the built output.
- Leave name/domain undecided, per the owner's instruction. Existing placeholder
  metadata is not launch-ready. Publication-date cleanup remains pending.
- API spend/rate limits and concurrency coordination before public API launch.
  KV alone does not enforce unique generation or global first discoveries.
- Complete interaction/accessibility checks, including a keyboard alternative
  to Fusion's drag operation and real-device orientation checks.

## Phase 2 — homepage and Orbit experience

Retain the new illustrations; improve homepage hierarchy and feature one
complete Orbit experience. Next implement first-orbit onboarding, clear launch
feedback, versioned scene save/restore, and a reproducible challenge share.
The timing fix above establishes the physics prerequisite. Review the entire
first-minute path on desktop and phone before expanding decorative effects.

## Phase 3 — launch trio

From Memory: sketchbook, reference comparison and a downloadable postcard.
Auction: coherent lot artwork, bidder presentation and a shareable result.

## Phase 4 — remaining collection

Start with Powder world preservation across resizing; then apply the same
state, interaction, accessibility and art checks to the remaining games.
Unity stays an optional later prototype, not a replacement for the Astro site.
