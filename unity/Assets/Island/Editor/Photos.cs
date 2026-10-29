using System.IO;
using UnityEngine;

namespace Island
{
    /**
     * The photographs the ground is made of (scripts/fetch-textures.mjs puts
     * them in unity/Textures/): ten CC0 sets from Poly Haven, a colour photo and
     * a normal map each, as two texture arrays for Ground.shader.
     *
     * The photos are warm (sunlit sand, ochre cliffs) and the island is cool, so
     * the shader takes from each photo only how it varies from its own average
     * colour (its grain, cracks, stones, blades) and keeps the colour map's
     * colour. Each layer's average is measured here for that.
     */
    public static class Photos
    {
        /** The layers, in the order of Terrain3D's splat weights and Ground.shader's slices. */
        public static readonly string[] Layers =
        {
            "aerial_grass_rock",  // 0 grass
            "aerial_beach_01",    // 1 dry sand
            "coast_sand_01",      // 2 wet sand
            "aerial_rocks_02",    // 3 rock from above (cliff_side on its faces)
            "aerial_asphalt_01",  // 4 roads
            "concrete_pavers_02", // 5 plazas
            "cobblestone_square", // 6 the old town
            "mud_cracked_dry_03", // 7 badlands, the wash, the fields' soil
            "forest_ground_04",   // 8 grass's second texture, mixed in patches
            "cliff_side",         // 9 cliff faces
        };
        public const int Size = 1024;

        /**
         * The buildings' materials (Building.shader), from Textures/buildings/, and
         * each one's width in metres (Poly Haven's own measure), so that a brick
         * is a brick's size.
         */
        public static readonly string[] Walls =
        {
            "painted_plaster_wall", // 0 plaster
            "white_plaster_02",     // 1 pale plaster
            "painted_brick",        // 2 painted brick
            "brick_wall_02",        // 3 brick
            "grey_roof_tiles",      // 4 roof tiles
            "roof_slates_02",       // 5 slate
            "weathered_planks",     // 6 timber boards
            "corrugated_iron_02",   // 7 metal sheet, on walls
            "metal_plate_02",       // 8 metal panels: roofs and domes
            "concrete_wall_008",    // 9 concrete and stone
            "concrete_pavers_02",   // 10 concrete underfoot: plinths, platforms, flat roofs
        };
        public static readonly float[] WallMetres = { 2, 1, 1.8f, 2, 3, 3, 2, 2.7f, 2, 2.71f, 2.5f };

        public static Texture2DArray Colour, Normal, WallColour, WallNormal;
        /** Each layer's average colour (linear), for taking the detail without the colour. */
        public static Vector4[] Means, WallMeans;

        public static void Load(string dir = "Textures")
        {
            LoadSet(dir, Layers, out Colour, out Normal, out Means);
            Debug.Log($"[island] photos: {Layers.Length} layers at {Size}²");
        }

        public static void LoadWalls(string dir = "Textures/buildings")
        {
            LoadSet(dir, Walls, out WallColour, out WallNormal, out WallMeans);
            Debug.Log($"[island] wall photos: {Walls.Length} layers");
        }

        static void LoadSet(string dir, string[] layers, out Texture2DArray Colour, out Texture2DArray Normal, out Vector4[] Means)
        {
            Colour = new Texture2DArray(Size, Size, layers.Length, TextureFormat.RGBA32, true, false) { wrapMode = TextureWrapMode.Repeat, filterMode = FilterMode.Trilinear, anisoLevel = 8 };
            Normal = new Texture2DArray(Size, Size, layers.Length, TextureFormat.RGBA32, true, true) { wrapMode = TextureWrapMode.Repeat, filterMode = FilterMode.Trilinear, anisoLevel = 8 };
            Means = new Vector4[16];
            for (int i = 0; i < layers.Length; i++)
            {
                var c = Read(Path.Combine(dir, layers[i] + "_diff.jpg"), false);
                var n = Read(Path.Combine(dir, layers[i] + "_nor.jpg"), true);
                var px = c.GetPixels32();
                Colour.SetPixels32(px, i);
                Normal.SetPixels32(n.GetPixels32(), i);
                // The average, in linear light (the shader compares linear colours).
                double r = 0, g = 0, b = 0;
                for (int k = 0; k < px.Length; k += 7)
                {
                    r += Mathf.GammaToLinearSpace(px[k].r / 255f);
                    g += Mathf.GammaToLinearSpace(px[k].g / 255f);
                    b += Mathf.GammaToLinearSpace(px[k].b / 255f);
                }
                int count = (px.Length + 6) / 7;
                Means[i] = new Vector4((float)(r / count), (float)(g / count), (float)(b / count), 1);
                Object.DestroyImmediate(c); Object.DestroyImmediate(n);
            }
            Colour.Apply(true); Normal.Apply(true);
        }

        static Texture2D Read(string file, bool linear)
        {
            if (!File.Exists(file)) throw new FileNotFoundException($"{file} is missing: run node scripts/fetch-textures.mjs");
            var t = new Texture2D(2, 2, TextureFormat.RGBA32, false, linear);
            t.LoadImage(File.ReadAllBytes(file));
            if (t.width != Size || t.height != Size)
            {
                // Any other size, scaled to fit the array.
                var rt = RenderTexture.GetTemporary(Size, Size, 0, RenderTextureFormat.ARGB32, linear ? RenderTextureReadWrite.Linear : RenderTextureReadWrite.sRGB);
                Graphics.Blit(t, rt);
                var s = new Texture2D(Size, Size, TextureFormat.RGBA32, false, linear);
                var was = RenderTexture.active; RenderTexture.active = rt;
                s.ReadPixels(new Rect(0, 0, Size, Size), 0, 0); s.Apply(false);
                RenderTexture.active = was; RenderTexture.ReleaseTemporary(rt);
                Object.DestroyImmediate(t);
                t = s;
            }
            return t;
        }
    }
}
