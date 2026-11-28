# The walk, round two: from "it is all there" to "it looks filmed"

PLAN.md item 70 built the walk's fifteen areas. Each one now exists and
works. This round looks at the same fifteen through a different lens.

**The new point of view.** Round one asked *what does each thing need to
exist?* Round two asks *what would a camera see that gives it away?* Every
phase now starts from the "tells": the few details that make a picture read
as computer-made at a glance. Each phase fixes those first, judged three ways:

- **Against photographs:** real reference, not our memory of a game.
- **By measurement:** albedo, luminance, metres, milliseconds.
- **With captured data where hand-made noise is the tell:** CC0 photo
  textures, field recordings, motion capture.

The quality bar named is GTA VI. That means its *techniques and qualities*:

- light that bounces;
- one atmosphere that colours sky, haze, clouds and reflections alike;
- contact shadows, wetness and density;
- weight in every movement.

It never means its content. Nothing here copies its places, characters, art,
logos or music. The island stays ours.

## What we start from (28 Nov 2026)

There is a nine-view "before" gallery: the start, you up close, a passer-by,
a parked car, aerial, sunset, night, rain and the harbour. The gallery and
the research notes are in the session scratchpad; the findings that matter
are folded into each phase below. What gives it away today:

1. **The light is flat, the whites clip.** Pavements, fences and white
   walls are pure white (albedo 1.0, where real white paint is about 0.8),
   so they blow out. Shade is a uniform hemisphere light, not the sky
   bouncing. Exposure is a formula, not metered. Tone mapping is ACES, so
   saturated lights skew. Sunset reads dark and muddy; night is murky.
2. **Nothing is a real material.** Not one texture is loaded. Every surface
   is value noise from a shader, which reads as smeared CG. There are no
   normal, roughness or AO maps anywhere.
3. **The shapes are a diorama.** Buildings are the cartoon map's blocks
   (pink gables, primary-colour walls), with flat normals, no bevels and no
   UVs. Trees are 7-sided trunks with hand-drawn leaf cards. You and the
   passers-by are capsule mannequins with no faces or hands.
4. **Nothing reflects anything but the sky.** Water, glass, wet roads and
   car paint all show only the sky.
5. **Edges shimmer.** SMAA only: grass, leaf cards and thin rails alias in
   motion. There are no motion vectors, so there is no temporal AA, no
   motion blur and no upscaling.
6. **Movement has no weight.** The car has no weight transfer, wheel spin or
   suspension. People slide on their feet. The props live in a separate,
   unmaintained engine (cannon-es) that cars and people don't use.
7. **Synthesised sound.** The engines and footsteps are oscillators and
   noise. There is no reverb, occlusion or Doppler.

## Rules for every phase

- **One phase per turn.** Push its commits, give the update, then stop and
  wait for "start next phase".
- **The gallery.** Every phase reshoots the nine-view gallery (plus a phone
  view and a reduced-motion view) and shows before beside after.
- **Speed budget.**
  - High on a desktop: 60 fps at 1080p.
  - Medium on a phone: at least 30 fps (emulated, CPU throttled 4×).
  - No phase may lose more than 10% on High without saying so. Profile
    before optimising (`prof.mjs`), and A/B back to back because the laptop
    throttles.
- **Assets.**
  - CC0 only: Poly Haven, ambientCG, Quaternius, CMU mocap, Freesound CC0.
  - Credited on a credits line anyway.
  - Shipped as KTX2 or WebP/Opus.
  - Under 12 MB on first load; the rest streamed per district.
  - A new `public/` folder goes in `check-public-boundary.mjs` first.
  - **Each download is named to you and approved before it happens.**
- **check-walk** grows with every phase. What can be measured gets a number
  checked: albedo ranges, luminance at noon and midnight, tyre forces,
  ragdoll settling. What can only be seen gets a gallery picture in the
  update.
- **Honesty.**
  - Say what a feature costs in fps.
  - Say what was measured headless rather than on a real device.
  - Say what still falls short of the bar.

## The order, and why it changed

The same fifteen areas, in an order where each phase builds on the ones
before:

- **Light and the sky come first.** Every material, colour and texture after
  them is judged by the light they make, so fixing them later would mean
  re-tuning everything.
- **Physics comes before you, the cars and the people.** The new engine
  carries all three.

| # | Phase | Round one's number |
|---|---|---|
| 1 | The eye: exposure, light and the lens | 3 |
| 2 | The sky and the air | 4 |
| 3 | The ground | 1 |
| 4 | The water | 2 |
| 5 | Buildings | 5 |
| 6 | What grows | 6 |
| 7 | Physics, one engine for everything | 12 |
| 8 | You | 7 |
| 9 | Cars and driving | 8 |
| 10 | Life | 9 |
| 11 | Weather | 10 |
| 12 | The street | 13 |
| 13 | Sound | 11 |
| 14 | The camera, the HUD and photo mode | 14 |
| 15 | Every device, at last | 15 |

---

## Phase 1: The eye (exposure, light and the lens) — done 28 Nov 2026

**Done as planned:** calibrated albedo (with the albedo view and its
check), AgX tone mapping, metered exposure (plus highlight protection, added
when a dusk sky burned out over a dark street), the light in proportion
(hemisphere and ambient gone, the sky's light measured, the ground's bounce
in the environment), temporal anti-aliasing, two shadow cascades, contact
shadows, occlusion from the main drawing, and the lens's glow, fall-off,
fringing and grain.

**Not done, and moved:**
- Soft shadows that grow with distance from the caster (PCSS) need the
  shadow map's raw depth. three r185 reads it only through hardware
  compare, so the penumbra is held to the sun's average instead.
- The reversed depth buffer would break the occlusion's and the steadying's
  depth reconstruction for little gain, since nothing flickers at present.
- Spreading environment rebuilds over frames: the sky's light is rebuilt
  whole in Phase 2.

**New point of view:** a cinematographer's real camera, not a renderer's
defaults. Light in physical proportion, metered and graded like film.

**Why it reads fake now:**
- Albedos above 0.9 clip.
- Exposure is a hand curve.
- Ambient light is a hemisphere plus a constant.
- ACES tone mapping.
- One shadow map that ends at 118 m.
- No contact shadows.
- SMAA shimmer.
- GTAO costs a whole second drawing of the scene.

**Work:**
1. **Calibrated albedo.** Measure every base colour in the walk: terrain
   paints, facade colours, cars, people, props, street, boats.
   - Pull them into real ranges: asphalt 0.04–0.12, concrete 0.25–0.40,
     white paint 0.70–0.80, grass 0.10–0.25, sand 0.30–0.45, foliage
     0.05–0.20, skin 0.10–0.55.
   - Clamp what clips.
   - `?debug=albedo` shows the unlit base colour, with anything out of
     range in false colour.
   - check-walk asserts no material's linear albedo is over 0.85 (emissive,
     glass and snow aside).
2. **AgX tone mapping.** Lights roll off to white the way film does; no
   ACES hue skew.
3. **Metered exposure.**
   - Each frame the GPU averages the scene's log luminance (centre-weighted)
     into a 1×1 target, then eases towards it: about 1 s into bright, about
     3 s into dark, as eyes adapt.
   - It runs before the bloom, so glow thresholds mean something. Nothing is
     read back to the processor.
   - A compensation curve keeps night darker than day and sunset golden
     rather than metered flat.
4. **The light in proportion.**
   - The hemisphere and ambient fudges go.
   - Shade is lit by the sky itself (the sky's environment map at its
     measured strength). The sun's strength is set against the sky's from
     measured illuminance: on a clear noon the sun about 5× the sky on level
     ground.
   - Environment rebuilds are spread over frames, so the running clock no
     longer hitches.
5. **Temporal anti-aliasing.**
   - Sub-pixel jitter, a Halton(2,3) sequence.
   - Reprojection of the last picture from depth and both cameras.
   - YCoCg neighbourhood clipping and luminance-weighted blending, against
     ghosting and fireflies.
   - A light sharpen afterwards.
   - It replaces SMAA. Grass, leaf cards, rails and shadow edges stop
     shimmering, and the ambient occlusion can take fewer samples because
     time smooths it.
6. **Shadows.**
   - Two cascades: a sharp one round you, and a wide one reaching about
     400 m so far hills and buildings keep their shadows.
   - The edges grow softer the further they fall from what casts them
     (PCSS-style), for the sun's real 0.5° size.
   - Screen-space contact shadows, marched towards the sun through the
     depth, under feet, tyres, kerbs and props.
   - All done in three's shared shadow code, so none of the existing
     material patches break.
7. **Occlusion from the main drawing.** GTAO reads the scene's own depth
   instead of drawing everything twice. This pays for the anti-aliasing.
8. **The lens.**
   - The glow reworked: a low, wide, physically plausible spread of all
     light, not a threshold.
   - A cos⁴ vignette.
   - A trace of chromatic aberration at the corners only.
   - Grain weighted by luminance, as film grain is. Still when motion is
     calm.
9. **Depth precision.** A reversed depth buffer where the browser supports
   it, so no distant surfaces flicker against each other.

**Proof:**
- The gallery before and after, and the albedo debug view.
- check-walk: albedo ranges; exposure converges in under 4 s; noon midtones
  land at 0.18 ± 0.05; the cascade covers 400 m.
- fps A/B on High and on a phone.

---

## Phase 2: The sky and the air — done 28 Nov 2026

**Done:**
- The physical sky with its four tables, and the haze over everything
  (the linear fog is gone).
- The light in the shade and in reflections, taken from the same sky.
- Volumetric clouds, shadowing the ground from the same cloud field.
- Light shafts and the morning mist.
- The real star field, the Milky Way, airglow and the town's glow.
- The moon in its phase.
- Twilight from the physics.
- Each day's air a little different.

**Moved:**
- The light-probe grid for bounce light goes to Phase 5, where the
  buildings it bounces off get real materials.
- The clouds' own reprojection (updating a sixteenth of the pixels each
  frame) was not needed: a quarter-size march smoothed by the steadying
  holds up.

**New point of view:** one atmosphere (Bauer's lesson from RDR2). The sky,
the haze on distant things, the clouds, the light in shade and the
reflections all come from one scattering model, so they can never disagree.

**Why it reads fake now:**
- Preetham's 1999 analytic sky, with a hand-tuned night dome over it.
- Linear grey fog from 14 to 70.
- A flat 2D cloud layer.
- Uniform star dots and a white ball of a moon.
- The light's colour is a curve that is separate from the sky.

**Work:**
1. **A physically based sky** (Hillaire 2020).
   - A transmittance lookup table, multiple scattering, a sky-view table
     each frame, and an aerial-perspective volume.
   - Rayleigh and Mie scattering plus ozone, Earth radius, the sun's real
     angular size and limb darkening.
2. **Aerial perspective on everything:** far hills turn blue, buildings
   across the bay sit in haze. The linear fog goes.
3. **Ambient and reflections from the same sky.**
   - Spherical harmonics and a reflection map, both from the sky-view table.
   - The sun's colour taken from its transmittance through the air.
   - A light-probe grid (three's `LightProbeGrid`) for bounce light per
     district: green off the lawns, warm off sunlit walls, dark under
     arcades. Re-baked as the sun moves, spread over frames.
4. **Volumetric clouds.**
   - Raymarched cumulus: Perlin-Worley 3D noise, light marched towards the
     sun, a powder term and silver linings.
   - Quarter resolution, reprojected over time.
   - Coverage and type from the weather.
   - The clouds shadow the ground from their own density.
5. **Light shafts** when the sun is low behind buildings or cloud, from a
   sun-occlusion mask. Height fog and morning mist in the hollows and over
   the sea at dawn, burning off.
6. **Night.**
   - Real stars: the brightest few thousand from a catalogue at their
     magnitudes and colours, twinkling near the horizon.
   - A faint Milky Way.
   - A textured moon with its phase, lit from the sun's side, with earthshine
     and a halo in haze.
   - Airglow.
   - The night sky's light measured, not invented.
7. **Twilight done physically:** the Earth's shadow and the Belt of Venus
   opposite sunset, the blue hour from ozone.
8. **Days that differ:** a bit of turbidity drift and humidity haze.

**Proof:**
- A time-lapse strip of sixteen frames of the same view from 4:00 to 23:00.
- check-walk: the sky's zenith luminance at noon and at midnight in
  realistic proportion; sunset colours; clouds' fps cost on High.

---

## Phase 3: The ground

**New point of view:** photographed materials, laid by a road crew and worn
by use. A road is asphalt with aggregate, patches, cracks, oil, worn paint
and drains, not a dark-blue noise.

**Why it reads fake now:**
- Value noise everywhere.
- 1.5 m height resolution.
- Painted kerbs.
- Puddles that only reflect the sky.
- Visible tile seams.
- Faceted slopes under a low sun.

**Work:**
1. **The texture pipeline.**
   - KTX2 / Basis Universal: ETC1S for colour and packed AO/roughness/
     metalness, UASTC for normal maps.
   - A `DataArrayTexture` of ground layers.
   - The transcoder shipped with three.
   - A build script that turns CC0 source sets (ambientCG, Poly Haven) into
     the compressed set, sized at 1K–2K.
   - Allowlisted in `public/`.
2. **Ground sets:**
   - fresh and worn asphalt; concrete paving slabs; cobbles; granite kerbs;
   - sand (dry, wet, rippled); grass soil; mud;
   - rock (cliff, sea-worn); gravel; field soil;
   - snow on the peaks.
3. **No visible tiling.**
   - Stochastic (hex-tile) sampling.
   - A macro variation map over the whole island.
   - Height-blended transitions: sand into the cracks of paving, grass
     breaking through at edges.
4. **Real kerbs and edges as geometry:** bevelled granite kerbs, drop kerbs
   at crossings, drain grates, manhole covers, gutters.
5. **Decals:**
   - worn lane and crossing paint; patched and cracked asphalt; oil stains;
     tyre marks at junctions;
   - leaf litter under trees; sand blown onto the promenade;
   - batched into a few draw calls.
6. **Parallax occlusion** on cobbles and paving near the camera, faded out
   with distance.
7. **Terrain shape.**
   - Finer slopes where the camera can see.
   - Normals from a baked high-resolution height map, not 1/6-tile faces.
   - Cliffs textured triplanar with strata.
   - Scattered rocks, pebbles and driftwood.
8. **Footprints and tyre tracks in sand and snow:** a deformation target
   round you, fading as wind and sea smooth it.
9. **Cavity and contact:** baked occlusion where the ground meets walls,
   kerbs and posts.

**Proof:**
- A close-up gallery of eight surfaces at noon and grazing sunset.
- check-walk: every surface ID has a material, there are no tile seams, and
  the first-load texture budget is met.
- fps cost.

---

## Phase 4: The water

**New point of view:** water as an optical material, which absorbs,
refracts, reflects by Fresnel and scatters, moved by a real wave spectrum.

**Why it reads fake now:**
- Three sine waves.
- Alpha blending instead of refraction.
- Only the sky reflected.
- Procedural foam.
- No view from under water.
- A 139k-triangle grid always drawn.

**Work:**
1. **A wave spectrum.**
   - Ten to sixteen Gerstner waves from a JONSWAP spectrum driven by the
     wind, plus FFT-style detail normals in two cascades.
   - Sharper crests.
   - The CPU copy matches for swimming, boats and buoyancy.
2. **Optics.**
   - Refraction from the scene's colour and depth, with Beer–Lambert
     absorption per colour: red goes first, so shallows are clear and
     turquoise and the deep is blue-black.
   - Scattering towards the sun through wave crests.
   - Schlick Fresnel.
3. **Reflections.**
   - A half-resolution planar reflection of the island, boats and sky,
     distorted by the waves.
   - Screen-space reflections, on desktop, to sharpen what is near.
4. **Surf.**
   - Waves that shoal and break along each beach (crest geometry and foam
     driven by depth and distance from shore).
   - Swash running up the sand and back, leaving a dark wet line.
   - Foam from a texture, advected and decaying.
5. **Wakes and ripples.** A 256² wave simulation round you, disturbed by
   swimmers, boats, wading and rain. Kelvin wakes behind boats; bow spray.
6. **Caustics** projected onto the sea floor and onto anything under water,
   from the wave normals.
7. **Under water.**
   - Fog by depth and absorption.
   - Light shafts.
   - The surface seen from below, with total internal reflection.
   - Muffled sound (with Phase 13).
8. **The stream and the pond:** flow maps, falls with mist and spray
   particles, and wet rocks.
9. **A cheaper grid:** a projected or LOD sea grid instead of the fixed
   139k triangles.

**Proof:**
- The harbour and the beach at noon, at sunset and at night; underwater
  pictures.
- check-walk: the CPU and GPU waves match, and boats stay afloat on the new
  waves.
- fps.

---

## Phase 5: Buildings

**New point of view:** built by real trades and lived in for twenty years.
Each building is made of materials (render, brick, stone, painted timber,
clay tile, glass, metal) with the wear of weather and use.

**Why it reads fake now:**
- Cartoon colours.
- Boxes with flat normals.
- No UVs.
- One shared procedural look.
- Glass shows only the sky.
- Nothing on the walls: no gutters, pipes, cables or balconies.

**Work:**
1. **UVs** on every built surface: box-projected at a real scale, with
   seams at corners.
2. **Materials from photographs:** lime render, painted stucco, brick (two
   kinds), dressed stone, painted timber, clay roof tiles, slate, metal
   sheet, concrete, marble steps.
3. **A natural palette.** The cartoon hues are mapped to sun-faded,
   believable versions (each game's brand colour kept as paint or signage),
   so the island reads as one town.
4. **Weathering masks:** dirt streaks under sills, rising damp, edge wear,
   paint peeling on old wood, salt bloom near the sea. Driven by baked
   occlusion and exposure to the weather.
5. **Geometry detail:**
   - bevelled edges; window reveals;
   - balconies with railings; shutters; awnings (cloth in Phase 7);
   - gutters and downpipes; cables between buildings;
   - air-conditioning units, satellite dishes, chimneys, roof flashing.
   - Shop fronts with glazed displays.
6. **Glass:**
   - box-projected local reflection probes per street, so windows reflect
     the street and not the sky;
   - interior mapping kept and improved (curtains with light through them,
     depth, lamps);
   - the slight waviness of old glass.
7. **Signs that light their surroundings:** emissive signs and neon each
   lighting the wall and pavement nearby, through the many-lights system
   (clustered or baked).
8. **LOD:** near detail, mid simplified, far impostors. One-sided materials
   where the inside is never seen.

**Proof:**
- A street gallery at noon, at sunset and at night.
- check-walk: Unity parity (every solid still built), every face has UVs,
  albedo in range, draw calls within budget.

---

## Phase 6: What grows

**New point of view:** plants as living translucent things in a canopy.
Light passes through leaves; wind moves trunk, branch and leaf at different
speeds; nothing repeats.

**Why it reads fake now:**
- Hand-drawn canvas leaves.
- 7-sided trunks.
- No translucency.
- Hard, aliased cut-outs.
- One sway.
- Grass that never bends.
- About 200 trees on the island.

**Work:**
1. **Leaves and bark from photographs:**
   - leaf atlases for broadleaf, pine, palm and flowering trees, with normal
     and translucency maps;
   - bark sets.
2. **Tree structure:** branching grown by rules (space colonisation), real
   trunk flare and roots, palms with ringed trunks, frond detail and dead
   fronds.
3. **Shading:**
   - light through leaves when seen against the sun;
   - per-tree and per-leaf colour variation;
   - specular on waxy palm leaves;
   - occlusion from inside the crown;
   - dithered edges resolved by the temporal AA.
4. **Wind in three layers:** the trunk bending with gusts, branches swaying,
   leaves fluttering, each phase-shifted by position. Palms whip in a storm.
5. **Grass:**
   - individually bent blades near you (GPU instanced, with their width set
     in view space so they never vanish edge-on);
   - clumps further out, then the ground texture;
   - density and colour from soil and moisture;
   - wildflowers.
   - It bends under you, people and tyres (a trample texture) and springs
     back.
6. **Undergrowth and scatter:** shrubs, hedges, weeds in cracks and at wall
   feet, fallen leaves, more trees where the map leaves room.
7. **Impostors** (octahedral, baked) for far trees, so the canopy reaches
   the horizon.

**Proof:**
- A back-lit tree, a palm in a storm, grass bending under a car.
- check-walk: tree counts, impostor switch distance, no plants on roads.
- fps.

---

## Phase 7: Physics, one engine for everything

**New point of view:** one physical world. The props, you, the cars, the
people and the boats all push on each other with real mass, instead of
three separate systems that ignore each other.

**Why it feels fake now:**
- cannon-es is unmaintained.
- Its ground exists only around the prop clusters.
- Cars and people bypass it.
- About 15 props.
- Nothing breaks.

**Work:**
1. **Jolt Physics** (MIT, WebAssembly, single-threaded, separate `.wasm`,
   loaded only on the walk).
   - Behind an adapter, with fixed 1/120 s steps, in metres.
   - The island's ground as one height field; buildings as static compound
     shapes.
   - Rapier is the fall-back choice if Jolt disappoints on phones.
   - **Asks your OK before installing.**
2. **The props ported**, then many more:
   - bins that tip and spill; café chairs and tables; bollards;
   - bottles and cans; traffic cones; barrels; pallets; wheelie bins;
     signs on breakaway posts; fence panels.
3. **Breakables:** pre-fractured crates, pallets, fences and glass panes
   (seeded Voronoi). Debris capped and faded.
4. **Buoyancy:** multi-point Archimedes and drag on the hulls, floating
   props, rope moorings (Verlet chains that tighten).
5. **Cloth:** XPBD flags, awnings, washing lines and the yachts' sails,
   driven by the same wind as the trees.
6. **Sound and dust from contacts:** impact strength and material choose
   the sound and particles (sparks for metal on asphalt, dust on earth,
   spray in water).
7. **Determinism for the checks:** fixed seeds and fixed steps, so
   check-walk results never depend on the machine's load.

**Proof:**
- A clip-strip of things knocked over, breaking and floating.
- check-walk: the masses, a kicked ball's distance, a crate's slide, a
  boat's draught, debris capped, the same results twice.

---

## Phase 8: You

**New point of view:** a person, not a puppet. Skin, hair, clothes and a
face, carried by motion capture, with feet that plant.

**Why it reads fake now:**
- Thirty capsules in seven flat colours.
- No face, hands or hair.
- Sine-wave walking.
- Feet that slide and float on slopes.
- Getting into a car is a snap.

**Work:**
1. **A skinned human** from CC0 sources (MakeHuman-derived or Quaternius
   base meshes):
   - a face with eyes (wet specular, a catch-light), teeth and brows;
   - hands with fingers;
   - real proportions, 1.75 m.
2. **Materials:**
   - pre-integrated skin scattering (red bleed at ears and fingertips in
     back-light);
   - hair cards with Kajiya-Kay highlights;
   - cotton, denim and trainer materials with folds in their normal maps;
   - sweat and wetness on skin, hair and clothes from rain or the sea.
3. **Motion capture:** Quaternius' CC0 Universal Animation Library and CMU
   clips (walk, jog, run, sprint, starts, stops, turns, idles, jump, land,
   swim, climb, sit, get in and out of a car), retargeted to the rig.
4. **Blending that holds up:**
   - inertialisation between states;
   - speed-matched cycles (stride from speed, so no sliding);
   - turn-in-place;
   - a step-up on kerbs.
5. **IK:**
   - two-bone foot IK on every step, with the hips lowered to the lower
     foot;
   - feet tilted to the slope;
   - hand IK onto the steering wheel and the door handle;
   - the head looking at things worth looking at (a passing car, a gull,
     the sea).
6. **Lean:** into turns and against acceleration.
7. **Secondary motion:** a hood or bag bounce and hair sway (spring bones).
8. **Physical reactions** through Jolt's motor-driven ragdoll: stumbles
   when bumped, and falling off a wall into a ragdoll, then getting up. No
   violence, only mishaps.
9. **The controller on Jolt's `CharacterVirtual`.** The ledge climb, wading
   and swimming are kept as states on top.

**Proof:**
- A turnaround of you at noon and in back-light.
- A walk, run, stop and turn strip showing planted feet.
- check-walk: no foot slide over 2 cm a step on flat ground, climb heights,
  ragdoll settling.

---

## Phase 9: Cars and driving

**New point of view:** a car is suspension and four contact patches. How it
handles comes from the tyres and the weight moving between them; how it
looks comes from paint reflecting the street.

**Why it feels fake now:**
- A bicycle model with fixed axle loads.
- No wheel spin, so no wheelspin or lock-up.
- Body lean that is only visual.
- Paint that reflects only the sky.
- No skid marks, smoke, damage or drivers in the traffic.

**Work:**
1. **Jolt's vehicle constraint:**
   - raycast or cylinder-cast suspension, springs at 1.5–2 Hz with ζ
     0.3/0.5;
   - anti-roll bars.
2. **Tyres:**
   - Pacejka-shaped slip curves, with load sensitivity and the friction
     ellipse;
   - a relaxation length, so low speeds behave without hacks;
   - grip per surface (asphalt, cobbles, sand, grass, wet).
3. **Drivetrain:** torque curves per model, five gears with a clutch,
   differentials, rev limiter, engine braking. ABS, traction control and
   stability control, switchable.
4. **Paint and glass:**
   - clear coat over metallic flake;
   - reflections from the street's probes, or a per-car capture near you;
   - dirt and dust on the lower body; water beading in rain.
5. **Damage:** dents pushed into the body where it hits, scratched paint,
   broken lamps, a bumper hanging off past a threshold. It changes nothing
   unfair about the handling.
6. **Marks and smoke:** skid marks laid as segments that fade; tyre smoke
   in hard slides; dust off the sand; spray off a wet road.
7. **Lights:**
   - the traffic's headlights lighting the road;
   - every lamp glowing through its lens;
   - indicators that flash for turns;
   - brake lights.
8. **Interiors and drivers:** a dashboard with lit dials; drivers in the
   traffic (sharing the people's rig) with hands on the wheel.
9. **The chase camera:** a critically damped spring with look-ahead; field
   of view widening with speed; shake from the suspension and impacts.

**Proof:**
- A 0–100 km/h time, braking distance, skidpad grip, a weight-transfer
  trace.
- Gallery of paint at noon, sunset and in rain.
- check-walk: tyre forces against the curve, no tunnelling at top speed,
  traffic interacting with your car.

---

## Phase 10: Life

**New point of view:** a town with routines. People with somewhere to be,
who notice each other, the weather, the traffic and you. Animals doing what
animals do.

**Why it reads fake now:**
- Forty mannequins popping in and out at nine tiles.
- Only walkers.
- No reactions.

**Work:**
1. **People on the Phase 8 rig.**
   - Variety from shape keys, skin, hair and clothing sets.
   - Instanced with animations baked to textures, so 150–200 can be drawn
     cheaply, with impostors far off.
2. **Routines by the hour:** commuters at 8 and 17; shoppers; joggers in
   the morning; people on the beach at midday; a café crowd; a night crowd
   near the lights. Rain sends them under awnings.
3. **Behaviours:**
   - talking in groups with gestures; sitting; phoning; photographing the
     sea; walking dogs (a real dog rig);
   - children; cyclists on the road;
   - a busker; a fisher on the pier.
4. **Reactions:**
   - stepping out of your way;
   - a glance at you;
   - startling at a car that brakes hard;
   - stumbling (active ragdoll) if bumped, then getting up and brushing
     off.
5. **The traffic:**
   - lane discipline; indicators; queues at lights;
   - giving way; horns when blocked;
   - parking and pulling out;
   - the bus at its stops; delivery vans with hazard lights.
6. **Animals:**
   - gulls (better feathers and flocking);
   - pigeons in the squares;
   - herons in the shallows;
   - crabs on the rocks at dusk;
   - fish schools that hold together;
   - a stray cat;
   - insects round the lamps at night.
7. **Boats:** wakes and spray (Phase 4), crew aboard, ropes, the ferry
   loading people.

**Proof:**
- A street at 8:00, 13:00, 18:00 and 23:00.
- check-walk: no one walks through anything, routines by the hour, traffic
  rules, the cost of 150 people.

---

## Phase 11: Weather

**New point of view:** weather as a change of material state, not an
overlay. Water soaks into what is porous and lies on what is not; wind
carries things; storms come from somewhere.

**Why it reads fake now:**
- Wet means darker and a bit glossier.
- Puddles reflect only the sky.
- No drips, run-off, wet people or cars, or rain on the lens.
- Lightning is a flash with no bolt.

**Work:**
1. **A wet material model:**
   - porosity per material (asphalt and render darken; glass and metal
     bead);
   - a standing-water layer with near-mirror roughness;
   - puddles where the ground is low, filling and drying over minutes.
2. **Reflections in puddles and wet roads:** screen-space reflections with
   the planar or probe fallback; lamps and signs stretched by the wet road
   at night.
3. **Rain:**
   - drops lit by the lamps and headlights;
   - splashes by surface;
   - drips from eaves and leaves;
   - run-off in the gutters;
   - streaks down windows;
   - drops on the camera when you look up or drive (wipers in the car).
4. **Mist and fog banks** rolling in off the sea; storm light; wet skin,
   hair and clothes; umbrellas that catch the wind.
5. **Storms:**
   - lightning bolts as branched geometry, lighting the clouds from inside;
   - thunder delayed by distance;
   - waves and spray up;
   - leaves, litter and paper blown about.
6. **Regional weather:** a shower can cross the island while the far side
   stays sunny, visible as a grey curtain under a cloud. A rainbow opposite
   the sun after rain.
7. **Calmer kinds:** heat haze on the roads at noon, sea mist at dawn,
   dust in a dry wind.

**Proof:**
- The same street dry, in rain and after rain; night rain with
  reflections.
- check-walk: soak and dry timings, puddle fill, the lightning rate stays
  WCAG-safe.

---

## Phase 12: The street

**New point of view:** a street is a dense, used place. Everything people
need has been put there, and every object is made of something.

**Why it reads fake now:**
- Box benches, bins and signals.
- Orb lamps.
- Flat canvas signs.
- No clutter.

**Work:**
1. **Remodel the furniture with materials:**
   - cast-iron and modern lamp posts with heads that throw light down;
   - traffic signals with hoods and backplates;
   - benches in slatted wood and cast iron;
   - litter bins with liners;
   - bollards; railings; bus stops with shelters and timetables;
     hydrants; parking meters; bike racks with bikes; post boxes; phone
     boxes; recycling bins.
2. **Clutter:**
   - café tables and parasols; market stalls by day; A-boards; planters;
     newspaper stands;
   - delivery crates; scaffolding on one building;
   - roadworks with barriers (Phase 7's props).
3. **Overhead:** cables, festoon lights over a square, flags, bunting
   (cloth from Phase 7).
4. **Lighting the street at night:** every lamp lights its pool (clustered
   lights or baked pools, not only the nearest six), sodium and LED tones
   mixed, signs lighting the pavement.
5. **Signs:** street signs with backplates and reflective film; road
   markings for parking bays; bus lanes; shop and café names that fit each
   game.
6. **Wear:** gum spots, stains, chipped paint on bollards, rust on old
   railings.

**Proof:**
- The gallery's street views; a night square.
- check-walk: every piece solid, nothing blocks the pavements' flow, draw
  calls.

---

## Phase 13: Sound

**New point of view:** a sound engineer's mix of the world. Recorded
textures placed in real acoustics, rather than synthesised tones.

**Why it sounds fake now:**
- Oscillator engines and noise footsteps.
- No reverb, occlusion or Doppler.
- Surfaces are guessed.

**Work:**
1. **CC0 field recordings**, compressed (Opus), streamed:
   - surf on sand and on rocks;
   - wind; rain on each surface;
   - a town murmur; café chatter; birds by species;
   - footsteps per surface in several takes; the ferry; gulls.
2. **Engines by granular synthesis** from recorded loops across the RPM
   range, with load, gear changes, turbo whine and a different sound per
   model.
3. **Acoustics:**
   - convolution reverb per place (street canyon, open beach, under an
     arcade, inside a car);
   - occlusion and obstruction, low-passed by what is in the way (a ray to
     each source);
   - Doppler from the sources' velocities;
   - air absorption with distance.
4. **Surfaces from the true material under each foot and tyre**, not a
   guess by tile. Wet variants.
5. **The interior of the car:** engine through the firewall, tyres on the
   road surface, rain on the roof, the indicator's tick.
6. **A radio in the car:** original, generated or CC0 music only.
7. **The mix:** ducking for close events, a limiter, levels per bus,
   loudness kept to a standard.

**Proof:**
- A recorded 30 s walk and drive.
- check-walk: every surface has a sound; the reverb follows the place;
  Doppler on a passing car.

---

## Phase 14: The camera, the HUD and photo mode

**New point of view:** a director of photography and a quiet interface. The
camera moves like an operated camera, and the HUD shows only what you need
and then gets out of the way.

**Why it reads fake now:**
- The camera follows rigidly.
- The HUD is always on.
- Photo mode has no lens.
- The map is flat colour.

**Work:**
1. **The camera:**
   - a spring with lag and look-ahead;
   - collision that pulls in smoothly;
   - framing over the shoulder when still;
   - a slight handheld drift when idle;
   - motion blur (per-object velocity from the TAA vectors, shutter at
     180°).
2. **The HUD:**
   - fades when you are not using it;
   - the minimap as a rendered top view (the island drawn in miniature)
     with the route as a GPS line;
   - icons for cars, games and waypoints;
   - subtle compass; district title cards with a little typography.
3. **Photo mode:**
   - focal length (16–200 mm), aperture with real depth of field (bokeh
     shaped by the blades), focus distance, roll, shutter-speed motion
     blur;
   - LUT looks from real `.cube` grades;
   - time and weather overrides;
   - a super-resolution capture (tiled, at 2–4×);
   - frames.
4. **A cinematic camera:** a slow fly-through of the island's best views
   for the first visit, skippable.
5. **Loading:** a proper loading screen, with the world streamed in by
   priority.

**Proof:**
- Photo-mode samples: portrait, landscape, night, rain.
- check-walk: HUD fade, camera never inside a wall, capture size.

---

## Phase 15: Every device, at last

**New point of view:** budget the frame like a console studio. Measure GPU
time per pass, stream what you are near, upscale what you can't afford.

**Why it is limited now:**
- Merged whole-island meshes that can't be culled or reduced in detail.
- The sea's 139k triangles always drawn.
- No GPU timing.
- Phones are processor-bound.
- Big shader compiles stall.

**Work:**
1. **GPU timers** per pass (`EXT_disjoint_timer_query_webgl2`) in
   `__walk.perf()` and the frame-rate readout.
2. **Split by district:** culled, with levels of detail and impostors, and
   streamed (textures, sounds, people) with priorities.
3. **Dynamic resolution with temporal upscaling** (the Phase 1 TAA as
   TAAU), holding a target frame time per level.
4. **Physics and people's behaviour moved off the main thread** (a worker)
   where it pays.
5. **Shader warm-up behind the loading screen**, with compile times
   measured, so nothing stalls on first sight.
6. **The quality levels re-tuned** for everything the round added, and
   Auto re-checked.
7. **Real-device checks** on your own phone (with your help), not only
   emulation.
8. **Memory and battery:** texture memory capped per level; 30 fps cap on
   battery saver.

**Proof:**
- A table of GPU ms per pass per level.
- A phone run on a real device.
- check-walk: budgets per level.

---

## What this cannot be, honestly

GTA VI was made by thousands of artists, with ray-tracing hardware, at 30
fps on a console. In a browser, with WebGL 2 at 60 fps, much of its look
must come from baking, screen-space tricks and art direction:

- Ray-traced bounce light becomes probes plus screen-space.
- Its reflections become planar plus screen-space plus probes.

Real photo textures, motion capture and recordings will close much of the
gap. Hand-authored hero assets at Rockstar's density will not happen. Each
phase's update will say plainly where it still falls short.
