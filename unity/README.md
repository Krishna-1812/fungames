# The island in 3D (Unity)

The homepage's Tiny Island, rebuilt as a lit 3D scene in Unity, so its
artwork can be rendered with real light: soft shadows, light from one sun,
reflections, night lit from the windows. Unity only renders. The site keeps
drawing the island in the browser, from the images Unity makes; Vercel never
runs Unity.

- **The island comes from the site.** `scripts/export-island.mjs` writes
  `Assets/Island/Data/island.json` from `buildIsland`'s `model`
  (`src/lib/island/world.ts`): every tile's ground, height and district, the
  water, roads, fields, piers, and where each building stands.
- **The camera sees it as the site draws it.** The site's projection
  (`src/lib/island/kit.ts`, `P`) is a 2:1 isometric view; here that is an
  orthographic camera at a yaw of 225° looking down 30°, with world X = tile j,
  Z = tile i, 45.25 px a world unit, and a site height z at z / 39.19 units up.
  `Assets/Island/Editor/IslandBuild.cs` says why.
- **Proven, not assumed.** The registration render paints every tile's top
  with its own number; `scripts/unity-registration.mjs` reads it back and
  checks every visible tile lands exactly where the site draws it.

## Running it

### Audit artwork preview in an already licensed editor

Run `node scripts/export-island.mjs` from the repository root, then open
`unity/` in Unity 6. Choose **Island → Audit → Render building art preview**.
This is an explicit menu action; it never runs on editor startup. It creates
an additive review scene, restores the previously active scene when finished,
and writes selected building runs and registration metadata to
`unity/Renders/art-review/`. It uses 4× scale, 3× supersampling, 128 sky samples
and 8 sun samples. Existing production renders are preserved.

The Deep Time candidate replaces the seven regular box sides with a shared
eroded contour and muted, rough stone. Adjacent layers share boundary vertices.
Steady Hand, Rule Cascade and the ferris wheel are included as reference
renders under the same lighting. They are not additional geometry revisions.
The candidate is enabled only by this preview command. Compilation alone does
not establish visual quality: inspect fossil and ladder registration, contact
shadows, vegetation scale and day/night integration before promoting assets.
Do not run `unity-buildings.mjs --skip-unity` on this preview folder: it is
not the complete production render set.

Unity 6 (6000.5.5f1), with a signed-in licence in Unity Hub. Close the project
in the editor first: two Unitys cannot open it at once. The ground's photographs
and models are not in git; fetch them once (about 70 MB, CC0, from Poly Haven):

```bash
node scripts/fetch-textures.mjs
```

```bash
node scripts/export-island.mjs
```

```bash
"/c/Program Files/Unity/Hub/Editor/6000.5.5f1/Editor/Unity.exe" -batchmode -projectPath unity -executeMethod Island.IslandBuild.Registration -quit -logFile -
```

```bash
node scripts/unity-registration.mjs
```

`Island.IslandBuild.Preview` renders the lit island. Both take `-scale n`
(pixels a map unit) and `-out file`. Renders go to `unity/Renders/`, which
git ignores.

## Traps already met

- **Cyan everything:** Unity draws shaders it is still compiling with a cyan
  stand-in, and a one-shot render never waits. `Pipeline()` turns background
  compilation off.
- **Every object the same colour:** materials made in code share one constant
  buffer under URP's SRP Batcher in a one-shot render, so each took the last
  material's colour. The batcher is off for these renders.
- **Washed-out colour:** the project was in gamma colour; light only adds up
  properly in linear, which `Pipeline()` sets.
- **A blank plate:** a shader that does not compile draws nothing, and Unity
  still exits happily; `unity-plate.mjs` stops on any "Shader error" in the log.
- **Streaks down every face:** anything laid on from above (the colour map,
  the splat maps) smears down a steep face. Cliff faces take their colour in the
  shader instead (rock in strata, by height) and their photo from the side.
- **Faces lit inside out:** on Direct3D a render into a texture is flipped, and
  `SV_IsFrontFace` with it, so a two-sided surface's normal pointed in. Shaders
  turn a normal to face the camera instead.
- **The sky's light vanishing:** with Unity's default (gamma) light intensity,
  a light of intensity 0.01 comes out as 0.01^2.2. `Pipeline()` sets
  `lightsUseLinearIntensity`.
- **A self-lit surface counted over:** glass and water light themselves; with
  the sun sampled n times (Dome), they carry 1/n each (`_IslandSelf`).
- **Small things black:** Unity's `Vector3.normalized` returns zero for a
  vector shorter than 1e-5, so a small ball's normals vanished. Mesh code
  normalizes with `Bm.Unit` (in doubles) instead.

## The light: the sun and the whole sky (Dome.cs)

Every picture that reaches the site (the plate, the trees, the buildings, the
people) is lit the same way: rendered many times and added up in floating
point. One pass per sample of the sun's disc (8, spread over about a degree,
so every shadow has a soft edge), and one per patch of the sky (128 over the
dome, each a light of the sky's colour from that direction times its share of
the sky, with its own shadow). A point in a corner, under the eaves, at the
foot of a wall, in a doorway or under a tree sees less of the sky, so fewer of
those passes reach it: real ambient occlusion and soft shade from the geometry
itself, painted nowhere. The sunlit ground's light thrown back up comes with
the sun's pass. The sum is graded (Dome.Tone: exposure, saturation and
vibrance, a filmic curve, a gentle S) and goes out as sRGB.
Building shots include the terrain and the plants, unseen, so a wall by a
cliff or under a tree is shaded by them. `-dome 0` is the old quick look;
`-sky n`, `-sunn n` set the sampling.

## The life: people, vehicles, boats, animals (Actors.cs, Vehicles.cs, Boats.cs, Creatures.cs)

Everything that moves or stands about on the island is modelled and rendered
alone at its foot (`IslandBuild.ActorShots`, `node scripts/unity-actors.mjs`),
in every pose and facing the site asks for (`lib/island/actors.ts` writes each
one down; `export-island` hands the list over):

- **People** at about 2 m (16 px by the site's doors): a body in proportion,
  jointed hips, knees, shoulders and elbows, clothes (shirt, trousers, shorts
  or a skirt, shoes, now and then a hat), hair, ears and a nose; standing,
  waving, looking up, sitting, on the ground, flying a kite, balancing, or one
  of eight frames of a walk, in four facings. A walker on the site carries all
  its facings, each shown while it heads that way, and its stride's frames
  turning over.
- **Vehicles**: a car (superellipsoid body, glass cabin, wheels, lights), the
  bus, a bicycle with its rider pedalling. **Boats**: lofted hulls (a
  sailboat with mainsail and jib, the ferry, fishing boats, the speedboat,
  rowing boats), eight headings for those that sail round, and a foam wake laid
  under each one that moves. **Animals**: sheep and deer (grazing or looking
  up), ducks, crabs, gulls (standing, or wings up and down), pigeons, a dog,
  dolphins, the whale, butterflies; and cumulus clouds, hot-air balloons, the
  plane, a robot.
- Each picture has its shadow on the ground laid under it (the model
  flattened along the sun, softened); boats' are faint, and nothing aloft has
  one.
- The page's canvas (the parade, the pigeons) draws from a sheet of these
  pictures the bake makes (`sprites.webp`).

## The night: the island lit by its own lights (Night.cs)

The site's realistic night is the day's picture multiplied down to moonlight
(a deep blue) with some of its colour taken out, and over that the light the
island gives off, rendered here: `node scripts/unity-glow.mjs`
(`IslandBuild.Glow`), over the plate's box and in its tiles, into
`src/lib/island/glow/`. The whole island in 3D (ground, sea, buildings,
trees) lit by nothing but its lights, each where the site says it is
(`model.lights`, from `Pen.light`, now with its place in the world):

- **Street lamps**: a light under the lantern, shaded above, a pool on the
  ground round the foot, light on the walls and trees near it, the glass
  glowing; their shadows found on a map of the tallest thing over every point
  (`Night.Height`, from the ground's and the buildings' meshes, the small
  things left out) and marched along in the shader (`islandLampShadow`).
- **Lit windows** (about four in five; the site's choice): the room behind the
  pane lit (Building.shader: a ceiling light, the far wall, the furniture's
  dark line; drawn curtains glowing through, blinds in stripes; warm, plain,
  cool or a television's blue), and a little light out on to the pavement.
  Panes are matched to their lights by place (`Night.PaneLight`) and carry it
  in their seed (TEXCOORD1.y over 2).
- **The sea** gives each light back as a streak broken by the ripples.
- Bright things bloom (two blurs of what is brighter than white).
- Each tile is rendered with a margin, so a glow by an edge is whole; it comes
  out as colour and strength (alpha), to lay straight over the site's night.

On the site the night layer then goes over the sky's (clouds, balloons and
birds darken with everything else), under only the districts' names.

The ground under a building is lit as open ground in the plate
(`Footprints`, `islandUnderFoot`): it is only seen as the building lifts or
drops in, and was black. The moon and its glints on the sea are made by
`node scripts/make-night-sky.mjs` (the near side's seas where they are, the
dust's flat light; the path in thousands of glints, two sets that shimmer).

## Signs, posters and props: prints (Prints.cs)

Lettering stays the page's (it draws it live, in its own fonts, over
everything); what it is written on is Unity's. Artwork the site draws on a
sign or a wall (a board's pinned papers, a poster, an emblem) is *printed*:
`kit.ts, print` names it and keeps its SVG, `export-island` rasterises every
print onto one sheet (`Data/prints.png`, `prints.json`), and a model lays
its print on a face (`Buildings.Print`, `QuadUV`; Building.shader material
11, cut out by its alpha, lit as everything is). Three ways in:

- **`p.plaque`**: a board facing the viewer, a little thick, its art printed
  on its face, on posts if it stands on the ground (`sign()` is one; so are
  the Days Since board and the "32").
- **`p.decal` + `p.printFace`**: what is drawn on a box's face (`p.face`)
  printed there instead: `decal` first (the print lies under anything drawn
  after), `printFace` after drawing, which prints everything but the words
  and anything with a class (it moves or changes), and on the realistic
  island leaves only those in the page's drawing.
- **a named model** with `prints` (the noticeboard's papers, the finger-posts'
  emblems).

Props modelled by name (`Models.cs`): the noticeboard, plaques, decals, dish
aerials, the observatory telescope, the orrery's rings, the globe's meridian,
the scarecrow, a watering can, round signs, market goods and striped stall
canvas, the campfire, bottles, the paper boat, finger-posts. The globe at How
Fast turns in 24 frames (`Creatures.cs, Globe`; the site cross-fades them,
`frame24`), and the space elevator's climber is a creature too.

The sea's drawn marks are gone on the realistic island (the coast's contour
lines, rings round the rocks, wave squiggles): its picture has its own
ripples and foam. The sandbar and the castaway's islet are banks of sand the
terrain raises out of the water (`Terrain3D.Isle`, `model.isles`), the Deep
Sea a trench it lets fall away, so the water's own shallows and depth show
them.

The last of the small things (`Props8.cs`): towels on the sand, the cottages'
window boxes, topiary in pots, toadstools, a pram, an easel (its canvas a
plaque, the sketch printed), a parked bicycle, the stork's nest, the trolley
problem's railway (ballast, sleepers, rails, along `s.pts`), the Mint's
conveyor, the sundial at Where Does The Day Go (the day's parts inlaid in
stone; the gnomon's shadow is the page's), a telescope on a tripod. The
moving ones are rendered alone like the animals (`Creatures8.cs`): the
superyacht at Spend It, the atom over the Tower of Scales (24 frames, as the
globe), the harbour buoys, the Internet Museum's foil balloon, the stork in
flight, the trolley's cart (a picture for each heading it takes), the drifting
bottle, and the humpback breaching at dawn (the whale's `breach` pose).
Windows the page lights itself (Every Second's) are Unity's too: only their
panes are the page's, unfilled until lit.

The river's falls are water, not a smear of the ground's colour (`Falls.cs`):
a sheet leaving each lip and curving out as it drops, streaked and breaking
white (Building.shader, material 12), and ragged foam where it lands; the
page keeps only a few glints running down them.

## Run by run: the check

`node scripts/check-island-runs.mjs` (in the suite) builds the island plainly
and realistically and compares every building's and thing's runs: pictures are
placed by run number, so a solid drawn on only one of them would move every
picture after it.

## The plate: how the render reaches the site

`node scripts/unity-plate.mjs` renders the ground (`IslandBuild.Plate`: the
terrain, the sea round it, and the buildings' shadows but not the buildings,
which the site draws) in 2048 px tiles at 4 px a map unit, stitches them,
fades the edges into the site's own sea, and writes `src/lib/island/plate/`:
WebP tiles, `low.png` (a small copy), and `plate.json`. About 1½ minutes.

- The island's SVG (`world.ts`) draws `low.png` as one `<image>` at the
  bottom of the sea layer, in place of its own ground and still shallows
  (the falls, waves, glints, surf, rocks and everything else still draw).
- The bake (`bake/draw.ts`) paints each map cell the plate is in from the
  full-size tiles instead, as lossy WebP (a photograph, not a drawing).
- The realistic island is a page of its own, `/realistic/` (`pages/realistic.astro`;
  `/` is the cartoon one), and a switch in the island's header goes between
  them, remembered in `localStorage` (`isl-world`) with the camera and the hour
  kept. `plate.json`'s `live` makes the realistic one the default for
  visitors who have not picked; until then it is the one you ask for.

## The ground

`Terrain3D.cs`: tile middles stay at the site's heights (so all it draws on
the ground still stands on it); every height (the coast, the beach, each
terrace, each plaza) has a smooth outline, so corners round off; a step falls
just inside its outline, rocky where steep. The sea floor shelves with the
true distance from the coast. A colour map at 64 texels a tile (grass in each
district's colour, sand, rock in layers, roads, plazas, fields, the river,
the pond, the dry wash), with what each spot is in its alpha for the shader's
fine detail.

Its detail is photographic (`Photos.cs`; `scripts/fetch-textures.mjs`):
ten CC0 sets from Poly Haven, for grass (two, in patches), dry and wet sand,
rock from above and cliff from the side, asphalt, paving, cobbles (the old
town) and cracked mud (the Badlands, the wash, the fields' furrows). Which goes
where is in two splat maps beside the colour map. The photos are warm and the
island cool, so the shader takes from each only how it varies from its own
average (its grain, cracks, stones and blades) and keeps the colour map's
colour; each is sampled twice, turned and shifted, so its repeats don't show.
Under the shallows, caustics. `Ground.shader` and `Water.shader` light them (one sun with soft
shadows, the sky, how shut in each point is); the open sea's colour is
measured round the plate's edges and the site paints its own sea in it
(plate.json `sea`), so the two meet without a seam.

## The figures: what grows on it

Every tree, rock and cactus the site draws has a name (`lib/island/props.ts`,
`figure()`: "pine-teal0", "round-bloom2", "hoodoo-44-10", "rock1"), and the
site writes down each one it draws, where, and how big (`model.plants`).
`node scripts/unity-figures.mjs` grows each named one in Unity
(`Editor/Plants.cs`) and renders it alone, lit and seen as the island is;
the pictures and where each one's foot is go to `src/lib/island/figures/`,
and the site draws a figure in place of its own drawing whenever the plate is
on. The plate casts every one's shadow on the ground where it stands.

- **Trees are grown, not downloaded.** Poly Haven's trees are film models,
  hundreds of MB each, for something a hundred pixels high. Here: trunks and
  limbs as tapered tubes in bark, and crowns of cards cut from Poly Haven's
  leaf, needle and twig photographs, each card in its species' colour (the
  photo gives only its light and shade). Broadleaf crowns are lumps of twig
  cards; conifers are whorls of drooping branches carrying needle sprays (with
  snow along their tops in the Peaks); cypresses are flames; palms are fronds
  of leaflets. The site's colours become species: its leaf green a broadleaf,
  its purple a jacaranda in flower (or a blue spruce), its teal a eucalyptus or
  a fir.
- **Rocks are Poly Haven's models**, in the island's cool grey; the Badlands'
  hoodoos and buttes are lathed from banded soft rock under the cliff photo.
- **The rocks in the sea and at the waterline** stand in the plate itself
  (nothing on the site is ever in front of them), each in its own foam.
- `Foliage.shader` lights a crown as a crown (its normals lean out from the
  middle, the sun comes through leaves lit from behind, the inside is darker);
  `Bark.shader` lays a photo's detail on a colour, for bark, cactus and rock.

## The buildings

The site draws its buildings with a pen whose solids (`lib/island/kit.ts`,
`Solids`: boxes, pitched and pyramid roofs, cylinders, cones, domes, balls,
platforms, windows, doors, awnings, bands and painted panels) are each written
down in the world's units, in *runs*: the solids drawn one after another with
nothing else between. `node scripts/unity-buildings.mjs` builds every run in
Unity (`Editor/Buildings.cs`) as real geometry in real materials and renders
it on its own, with the rest of its building casting shadows on it; the site
draws each run's picture where the run began, so whatever it draws by hand
between two runs (a sign, a wheel, someone at the door) stays between them,
as before. A window drawn this way leaves its pane behind, unseen, so the
night still lights it (and still knows when something stands in front of it).
The plate casts the real buildings' shadows.

Lines between two points are rods, as thick as the line was wide (a line
drawn twice, thick in ink and thin in a colour, is one rod in that colour).
The pieces that are neither boxes nor roofs are modelled by name
(`Editor/Models.cs`, from `Pen.model` in kit.ts): the lighthouse, the
windmill (which has a sink of its own, though it is not a landmark), and the
big wheel. What turns in the picture (the sails, the wheel) is built facing
the camera and rendered square round its hub, untrimmed, so turning its
picture about its middle turns it.

- **Materials** (`Building.shader`): plaster, brick, roof tiles, slate,
  timber boards, metal sheet and panels, and concrete are Poly Haven
  photographs (`Photos.Walls`, in `Textures/buildings/`), each at its real
  size (a unit is about 5 m: the site's doors are 2 m) and started at a
  different place on each face; as with the ground, only the photo's light
  and shade is taken, on the site's colour made real (less saturated, as
  paint in daylight is). Pale plaster is clean render, pale brick painted
  brick. Glass, paint and awning cloth are drawn in the shader. Walls in the shade take
  light thrown back by the ground and sky.
- **What it makes of each solid:** a pitched roof overhangs its walls, with
  fascia and barge boards and walled gable ends; windows have frames, glass
  set back, glazing bars and a stone sill; doors a panelled leaf, a fanlight
  and a step; cornices stand proud of the wall.

## Phases

1. Pipeline and registration (done): the ground from the site's tiles, blocks
   for buildings, one sun, proven to line up.
2. The ground made real (done): the shape, the water, the light, and photo
   textures; baked into the site behind the `live` switch.
3. Trees and rocks (done): every tree, shrub, cactus, reed bed, rock, hoodoo
   and butte, grown or modelled in 3D and drawn as Unity renders it.
4. The buildings: (a, done) every building's solids built and rendered in
   photographed materials; (b, done) every line between two points a rod
   (posts, masts, cranes, scaffolds, ladders, stays), and the lighthouse,
   the windmill and its sails, and the big wheel and its cars modelled
   (`Models.cs`). Signs, posters, painted faces and the small props stay
   drawn: they are the island's lettering.
5. People, boats, birds and the parade (done): every person, vehicle, boat
   and animal modelled and posed (`Actors.cs`, `Vehicles.cs`, `Boats.cs`,
   `Creatures.cs`), the whole island lit by the dome (sun and sky), buildings
   detailed (openings, cornices, gutters, chimneys), lamps, flowers, umbrellas
   and surfboards modelled, and the drawn outlines softened to the fill.
6. Night (done): the island lit by its street lamps, lit rooms, bulbs and
   lighthouse (`Night.cs`), over the day multiplied down to moonlight; a
   real moon and its path on the sea; the beam a soft shaft of light.
7. Signs and props (done): prints, plaques and decals for what the site
   draws on things; the remaining props modelled; the sea's drawn marks gone,
   its banks and trench in the terrain.
8. The last drawn things (done): every prop the site still drew modelled or
   rendered (Props8.cs, Creatures8.cs), the river's falls made water
   (Falls.cs), the globe a real Earth; what the page draws over the plate is
   now only words, lights, moving glints and the interface.
9. The look (done): the island graded and coloured as a photograph is.
   The light: a clear, slightly warm sun against a deep blue sky that fills
   the shade less (Dome.SkyLevel), so there is real contrast between sun
   and shadow. The grade (Dome.Tone): exposure, colour as strong as a good
   photograph's (vibrance lifts what is weak), a filmic curve (ACES) that
   keeps whites and rich shadows, and a gentle S; every picture Unity makes
   goes through it, so they all match. The materials (Buildings.RealSrgb):
   the site's pastels read for what they stand for (white walls lime-wash
   and limestone, pale greys dressed stone, pink roofs terracotta, lilac
   ones slate, mint ones copper gone green, the lilac "wood" timber, paint
   kept as strong as real paint). The ground in real colours (coral sand,
   stone cliffs, asphalt, dry earth). The sea (Water.shader): clear aqua over
   the sand, turquoise over the shelf, deep ocean blue beyond and deeper
   still far out, in broad patches, with a swell under the ripples, the sky
   in it, glitter, and lines of surf; the site paints its own sea in the
   colour the plate measures at its edges (plate.json `sea`). The clouds are
   volumes, not balls (scripts/make-clouds.mjs: a density field ray-marched
   along the island's view, lit by the same sun, toned the same; run it after
   unity-actors and again with --skip-unity). `-split 1` on Realistic writes
   the light before the curve (all, and the sun alone) for trying the balance
   and the grade offline.
