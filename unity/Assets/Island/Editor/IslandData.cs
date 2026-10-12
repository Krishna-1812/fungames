// The island as the site describes it: written by scripts/export-island.mjs
// from lib/island/world.ts (buildIsland's `model`), read here. Arrays of
// pairs are flattened (i0, j0, i1, j1, ...), as JsonUtility cannot read
// arrays of arrays.
using System;
using UnityEngine;

namespace Island
{
    [Serializable] public class Anchor { public float x0, y0, x1, y1, bx, by; }
    [Serializable] public class Building { public string slug, district; public float i, j, w, d, z; public bool water; public Anchor anchor; }
    [Serializable] public class Field { public int i, j, w, d; public string kind; }
    [Serializable] public class Pier { public float[] from, to; }
    [Serializable] public class Route { public float[] pts; }
    [Serializable] public class DistrictColours { public string key, a, b; }
    /** A tree, rock or cactus (lib/island/props.ts, figure()): its figure's name, where it stands (tile x = i, y = j; height z), and its size. */
    [Serializable] public class Plant { public string name; public float x, y, z, k; }

    [Serializable]
    public class IslandData
    {
        public int grid, tile;
        public float sea, beachZ;
        public string ground;
        public float[] height;
        public string[] district;
        public int[] river, pond, road, bales, hoodoos, boulders, buttes, mill, arch;
        public float[] wash;
        public Field[] fields;
        public Pier[] piers;
        public Building[] buildings;
        public Route[] routes;
        public DistrictColours[] districts;
        public Plant[] plants;
        /** The rocks standing in the sea: i, j, size, flattened. */
        public float[] seaRocks;
        /** The stones at the waterline: x (i), y (j), size, flattened. */
        public float[] shoreRocks;
        /** Each building's solids, in runs (Buildings.cs). */
        public BuildingSolids[] solids;
        /** The people (and the rest of what moves) the site draws, each one pose of one facing (Buildings.Actor). */
        public ActorRec[] actors;
        public float[] viewBox;

        public static IslandData Load(string path) => JsonUtility.FromJson<IslandData>(System.IO.File.ReadAllText(path));

        public char Ground(int i, int j) => i < 0 || j < 0 || i >= grid || j >= grid ? '0' : ground[i * grid + j];
        public bool Land(int i, int j) => Ground(i, j) != '0';
        /** A tile's top, in the site's height units (P()'s z): the sea's level where there is no land. */
        public float Z(int i, int j) => Land(i, j) ? height[i * grid + j] : sea;
        public string District(int i, int j) => district[i * grid + j];
    }
}
