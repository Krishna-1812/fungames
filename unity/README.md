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
in the editor first: two Unitys cannot open it at once.

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

## Phases

1. Pipeline and registration (done): the ground from the site's tiles, blocks
   for buildings, one sun, proven to line up.
2. The ground made real: materials, roads, river, fields, trees and rocks,
   soft shadows and ambient occlusion, rendered into the bake's ground cells.
3. The buildings, modelled one by one, rendered as the bake's sprites.
4. Night: a night render, lit from the windows.
