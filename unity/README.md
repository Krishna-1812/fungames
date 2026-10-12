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
the sun's pass. The sum goes through a tone curve (straight to 0.8, then rolling
off to white) and a gentle S, and out as sRGB; the sea is put through the
curve's inverse first, so it still meets the site's own sea exactly.
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
- `plate.json`'s `live` says whether the site uses it. Until the island is
  real all through, it is off; `ISLAND_PLATE=1` turns it on locally.

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
shadows, the sky, how shut in each point is); the deep water is exactly the
site's sea colour in the sun, so the two meet without a seam.

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
6. Night: a night render, lit from the windows.
