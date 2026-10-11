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
and models are not in git; fetch them once (about 57 MB, CC0, from Poly Haven):

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

## Phases

1. Pipeline and registration (done): the ground from the site's tiles, blocks
   for buildings, one sun, proven to line up.
2. The ground made real (done): the shape, the water, the light, and photo
   textures; baked into the site behind the `live` switch.
3. Trees and rocks (done): every tree, shrub, cactus, reed bed, rock, hoodoo
   and butte, grown or modelled in 3D and drawn as Unity renders it.
4. The buildings, modelled one by one, rendered as the bake's sprites.
5. People, boats, birds and the parade, to match.
6. Night: a night render, lit from the windows.
