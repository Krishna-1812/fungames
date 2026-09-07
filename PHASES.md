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

Implemented in the second batch, based on pushed commit `dd4ef82`:

- Homepage Orbit spotlight reuses the authored artwork, with a direct Play
  action and clearer collection heading. All 18 illustrated tiles remain.
- Orbit flight school offers an example orbit and a repeatable manual-launch
  setup. Its start marker and velocity arrow use the real circular-speed
  calculation. Example launches do not earn personal challenges.
- Versioned local scene snapshots preserve positions, velocities, masses,
  trails and launch selection. Load is explicit and opens paused. Completed
  challenges remain; partially completed laps restart.
- The existing Share button opens a scene-link dialog with clipboard fallback.
  Links use the current origin and full numerical precision. Imported bodies
  do not acquire the recipient's launch ownership.
- Scene parsing rejects malformed and oversized links. Large scenes can still
  be saved locally when they exceed the link-size limit.
- Resizing fits the world without changing coordinates, physics or escape
  bounds. Pointer input follows the fitted view. Render buffers allocate
  displayed pixels rather than the dimensions of a large imported world.
- Phone controls fit into three rows, leaving more simulation visible.

Validation: all 15 check suites passed, including new scene round-trip,
future-trajectory, ownership, invalid-input, size-limit and viewport-fit tests.
Browser checks covered desktop and 390px homepage/Orbit layouts, example and
manual-launch setup, saving/clearing/loading, and opening a generated scene link
in a new tab. Dev logs showed no errors during those checks. This is viewport
QA, not a real-phone performance claim. The known production-build sandbox
limitation from Phase 1 remains outstanding; no production build success is
claimed for this batch.

Still to finish before declaring the whole phase complete: production build
and built-site QA, observed first-minute playtests, manual drag/keyboard
accessibility checks, optional trajectory preview, and result presentation.
The scene link shares a starting simulation, not full challenge-history state.

### Next Orbit batch — keyboard launches

Added a focusable sky and a visible Keyboard button. K starts aiming, arrow
keys move the start point, Shift plus arrows adjust velocity, Enter launches,
and Escape cancels. Screen-reader status announces position, velocity and the
result. Pointer and keyboard aiming do not consume each other's release events.

Validation: new input checks pass for independent velocity/position control,
boundary clamping, immutable input and speed limits. Orbit physics/challenges,
clock and scene suites also pass. Browser keyboard input launched exactly one
body into a paused empty scene; cancellation kept the body count unchanged.
No browser errors were logged. Full screen-reader and physical-device testing
remain open, alongside the production-build verification noted above.

Publishing: frozen patch scripts in the delivery outputs publish each batch
without accidentally staging later work. Push commands will accompany every
batch from now on, as requested by the owner.

## Phase 3 — launch trio

### Orbit mission/result follow-up (implemented; verification pending)

Added a persistent mission readout showing progress around the primary for
player-launched bodies, plus a personal flight-log dialog with earned goal
explanations and a downloadable text record. Opening the log pauses the sky;
closing it restores the previous running state. Best lap counts now persist
when they improve, and resetting achievements clears trajectory tracking.

Orbit physics/challenge checks and the new mission ownership/half-lap/pruning
regression passed. Full regression results and browser QA remain unverified:
the command environment stopped returning results and the replacement preview
could not write Astro's generated files because of Windows permissions.
Do not treat this batch as release-ready until those checks are completed.

From Memory: sketchbook, reference comparison and a downloadable postcard.
Auction: coherent lot artwork, bidder presentation and a shareable result.

From Memory's first presentation batch adds a warm sketchbook layout, a
side-by-side comparison (stacked on narrow phones), and a 1200×800 PNG postcard
containing the actual drawing and reference. It reuses the shared download
helper. Export snapshots the strokes before asynchronous work. Pointer input
now keeps one active pointer; undo and clear finish any active stroke first.
Browser QA covered a drawn mark, reveal, comparison, PNG creation and moving
to the next prompt at desktop and 390px widths. Astro compilation returned no
diagnostics. Full regression results are recorded in the delivery notes.

Orbit follow-up: the running development site now shows the mission readout;
the flight-log dialog opens, restores focus on close and resumes a previously
running sky. This does not replace real-device or built-site release testing.

## Phase 4 — remaining collection

### Auction bidder presentation and release-check follow-up

Added five distinct decorative bidder portraits, collapsible descriptions of
bidding styles, and visible reactions for watching, leading, insufficient
funds and winning. A live status near the bid button identifies the current
leader. Budget bars now use each bidder's own initial funds as their baseline.

All 23 automated suites passed in the complete aggregate run. Desktop browser
checks covered the portraits, opening state, bidding and player-leading
announcement, and the first lot's winner. The production build still fails
inside existing aria-query/axobject-query dependency resolution with Windows
`Cannot read directory "..": Access is denied`. This is not a successful
release build. Development preview was restored after the failed build.

Start with Powder world preservation across resizing; then apply the same
state, interaction, accessibility and art checks to the remaining games.
Unity stays an optional later prototype, not a replacement for the Astro site.

Powder state batch: resize now fits the existing world with square cells,
preserving cells, lifetimes, shades, reaction history and active scenario
statistics. The scenario drawing mask follows the fitted canvas. Resize ends
the active drawing gesture rather than joining points across two layouts.
Sandbox experiments have an explicit local save/load slot; loads validate all
arrays and material IDs before replacement and open paused, with rain off.
Scenario sessions cannot save/load sandbox snapshots. Saves do not capture the
random generator, so future evolution is not promised to be identical.

Snapshot regression checks and Powder's complete reaction/scenario suite pass.
Browser verification remains pending because Astro's development overlay is
blocked by the existing dependency-access error. User device testing is deferred
until the collection work is complete, per the owner's instruction.
