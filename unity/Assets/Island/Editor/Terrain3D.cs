// The island's ground as one surface, from the site's tiles.
//
// Every tile's middle stays at the site's height for it, so everything the
// site draws on the ground (people, trees, bottles, buildings) still stands
// on it. Only the edges change: where the next tile is lower, the ground
// falls to it across a band inside the higher tile, narrow and rocky for a
// cliff (the peaks' terraces, a coast with no beach), wide and gentle for a
// grass bank down to a beach, wider still for a beach running into the sea.
// The sea floor shelves from just under the water at the coast to deep water
// a few tiles out.
//
// Heights are in the site's units (P()'s z); world Y is z / 39.19
// (IslandBuild.Y). Tile coordinates are u = i, v = j; world X = v, Z = u.
using System.Collections.Generic;
using UnityEngine;

namespace Island
{
    public class Terrain3D
    {
        public const int Lo = -6, Hi = 36, Span = Hi - Lo;
        public const int PerTile = 28, TexPerTile = 96, DepthPerTile = 16;

        readonly IslandData d;
        readonly float[,] seaFloor;
        readonly List<(Vector2 a, Vector2 b)> roads = new();
        readonly List<(Vector2 a, Vector2 b)> wash = new();
        readonly Dictionary<string, (Color a, Color b)> districts = new();
        readonly HashSet<(int, int)> river = new(), pond = new();
        readonly Dictionary<(int, int), Building> plaza = new();
        Rect pondBox;

        public Terrain3D(IslandData data)
        {
            d = data;
            // How far each sea tile is from land, in tiles, for the sea floor's shelf.
            var dist = new int[Span, Span];
            var q = new Queue<(int, int)>();
            for (int i = Lo; i < Hi; i++)
                for (int j = Lo; j < Hi; j++)
                {
                    dist[i - Lo, j - Lo] = d.Land(i, j) ? 0 : 99;
                    if (d.Land(i, j)) q.Enqueue((i, j));
                }
            while (q.Count > 0)
            {
                var (i, j) = q.Dequeue();
                foreach (var (a, b) in new[] { (1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1) })
                {
                    int ni = i + a, nj = j + b;
                    if (ni < Lo || nj < Lo || ni >= Hi || nj >= Hi) continue;
                    if (dist[ni - Lo, nj - Lo] <= dist[i - Lo, j - Lo] + 1) continue;
                    dist[ni - Lo, nj - Lo] = dist[i - Lo, j - Lo] + 1;
                    q.Enqueue((ni, nj));
                }
            }
            seaFloor = new float[Span, Span];
            for (int i = 0; i < Span; i++)
                for (int j = 0; j < Span; j++)
                    seaFloor[i, j] = d.sea - 3.5f - 26f * Mathf.SmoothStep(0, 1, Mathf.Clamp01((dist[i, j] - 1) / 5f));

            foreach (var r in d.routes)
                for (int k = 0; k + 3 < r.pts.Length; k += 2)
                    roads.Add((new Vector2(r.pts[k] + 0.5f, r.pts[k + 1] + 0.5f), new Vector2(r.pts[k + 2] + 0.5f, r.pts[k + 3] + 0.5f)));
            for (int k = 0; k + 3 < (d.wash?.Length ?? 0); k += 2)
                wash.Add((new Vector2(d.wash[k], d.wash[k + 1]), new Vector2(d.wash[k + 2], d.wash[k + 3])));
            foreach (var c in d.districts)
            {
                ColorUtility.TryParseHtmlString(c.a, out var ca); ColorUtility.TryParseHtmlString(c.b, out var cb);
                districts[c.key] = (ca, cb);
            }
            for (int k = 0; k + 1 < d.river.Length; k += 2) river.Add((d.river[k], d.river[k + 1]));
            float pi0 = 99, pi1 = -99, pj0 = 99, pj1 = -99;
            for (int k = 0; k + 1 < d.pond.Length; k += 2)
            {
                pond.Add((d.pond[k], d.pond[k + 1]));
                pi0 = Mathf.Min(pi0, d.pond[k]); pi1 = Mathf.Max(pi1, d.pond[k] + 1);
                pj0 = Mathf.Min(pj0, d.pond[k + 1]); pj1 = Mathf.Max(pj1, d.pond[k + 1] + 1);
            }
            pondBox = new Rect(pi0, pj0, pi1 - pi0, pj1 - pj0);
            foreach (var b in d.buildings)
                if (!b.water)
                    for (int i = Mathf.FloorToInt(b.i); i < Mathf.CeilToInt(b.i + b.w); i++)
                        for (int j = Mathf.FloorToInt(b.j); j < Mathf.CeilToInt(b.j + b.d); j++)
                            plaza[(i, j)] = b;
        }

        /* ---- height -------------------------------------------------------------- */

        float Floor(int i, int j) => i < Lo || j < Lo || i >= Hi || j >= Hi ? d.sea - 29.5f : seaFloor[i - Lo, j - Lo];
        float SeaCentre(int i, int j) => d.Land(i, j) ? d.sea - 1.5f : Floor(i, j);

        /** The sea's floor, smooth between tile middles (a land tile counts as just under the water). */
        public float SeaH(float u, float v)
        {
            // Shelving with the true distance from the coastline, a little uneven (sandbars, hollows):
            // just under the water at the shore, deep two or three tiles out.
            float dist = Coast(u, v) + (Noise.Fbm(u * 0.8f, v * 0.8f, 3, 41) - 0.5f) * 0.9f;
            return d.sea - 1.5f - 30f * Mathf.SmoothStep(0, 1, Mathf.Clamp01(dist / 3.4f));
        }

        // The distance from the coastline, in tiles, on a grid CoastPerTile fine (a chamfer distance transform of the land field).
        const int CoastPerTile = 8;
        float[,] coast;
        float Coast(float u, float v)
        {
            if (coast == null) BuildCoast();
            int n = coast.GetLength(0);
            float x = (u - Lo) * CoastPerTile, y = (v - Lo) * CoastPerTile;
            int x0 = Mathf.Clamp(Mathf.FloorToInt(x), 0, n - 2), y0 = Mathf.Clamp(Mathf.FloorToInt(y), 0, n - 2);
            float fx = Mathf.Clamp01(x - x0), fy = Mathf.Clamp01(y - y0);
            return Mathf.Lerp(Mathf.Lerp(coast[x0, y0], coast[x0, y0 + 1], fy), Mathf.Lerp(coast[x0 + 1, y0], coast[x0 + 1, y0 + 1], fy), fx);
        }
        void BuildCoast()
        {
            int n = Span * CoastPerTile + 1;
            coast = new float[n, n];
            const float big = 1e6f, s = 1f / CoastPerTile, dg = 1.41421f / CoastPerTile;
            for (int a = 0; a < n; a++)
                for (int b = 0; b < n; b++)
                    coast[a, b] = Field(Lo + a * s, Lo + b * s) >= 0.5f ? 0 : big;
            for (int pass = 0; pass < 2; pass++)
            {
                for (int a = 0; a < n; a++)
                    for (int b = 0; b < n; b++)
                    {
                        float c = coast[a, b];
                        if (a > 0) c = Mathf.Min(c, coast[a - 1, b] + s);
                        if (b > 0) c = Mathf.Min(c, coast[a, b - 1] + s);
                        if (a > 0 && b > 0) c = Mathf.Min(c, coast[a - 1, b - 1] + dg);
                        if (a > 0 && b < n - 1) c = Mathf.Min(c, coast[a - 1, b + 1] + dg);
                        coast[a, b] = c;
                    }
                for (int a = n - 1; a >= 0; a--)
                    for (int b = n - 1; b >= 0; b--)
                    {
                        float c = coast[a, b];
                        if (a < n - 1) c = Mathf.Min(c, coast[a + 1, b] + s);
                        if (b < n - 1) c = Mathf.Min(c, coast[a, b + 1] + s);
                        if (a < n - 1 && b < n - 1) c = Mathf.Min(c, coast[a + 1, b + 1] + dg);
                        if (a < n - 1 && b > 0) c = Mathf.Min(c, coast[a + 1, b - 1] + dg);
                        coast[a, b] = c;
                    }
            }
        }

        /** How wide the fall is from tile t down to its neighbour n: rock is steep, sand is gentle. */
        float Band(int ti, int tj, int ni, int nj)
        {
            if (!d.Land(ni, nj)) return d.Ground(ti, tj) == 'b' ? 0.5f : 0.15f;
            if (d.Ground(ni, nj) == 'b' && d.Z(ti, tj) <= 0 && !plaza.ContainsKey((ti, tj))) return 0.3f;
            return 0.12f;
        }

        static readonly (int, int)[] Around = { (1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1) };

        /** The ground's height at (u, v), and how far into a rocky fall it is (0 none, 1 the middle of one). */
        public float H(float u, float v) => H(u, v, out _);
        public float H(float u, float v, out float rock)
        {
            rock = 0;
            // The coastline is where the land field crosses a half: on a tile edge
            // along a straight shore, as the site has it, and rounded at the corners.
            float L = Field(u, v);
            if (L < 0.5f) return SeaH(u, v);
            // Every height the ground steps up to near here, lowest first. Each has
            // its own smooth outline (all the tiles at least that high), and the
            // step up to it rises just inside that outline: a bank down to the
            // beach, a cliff for a terrace or a building's plaza.
            int ci = Mathf.FloorToInt(u - 0.5f), cj = Mathf.FloorToInt(v - 0.5f);
            var levels = new List<float>(4);
            for (int a = 0; a <= 1; a++)
                for (int b = 0; b <= 1; b++)
                    if (d.Land(ci + a, cj + b))
                    {
                        float z = d.Z(ci + a, cj + b);
                        if (z > d.beachZ && !levels.Contains(z)) levels.Add(z);
                    }
            levels.Sort();
            float h = d.beachZ, prev = d.beachZ;
            foreach (var z in levels)
            {
                float w = z <= 0 ? 0.3f : 0.12f;
                // A cliff's edge wanders a little in and out, as rock breaks, rather than running ruler-straight.
                float dk = Inside(u, v, z) + (w < 0.2f ? Wander(u, v, z) : 0);
                if (dk <= 0) break;
                float s = Mathf.SmoothStep(0, 1, Mathf.Clamp01(dk / w));
                float step = z - prev;
                h += step * s;
                if (w < 0.2f && s > 0 && s < 1) rock = Mathf.Max(rock, 1 - Mathf.Abs(2 * s - 1));
                prev = z;
                if (s < 1) break;
            }
            // The coast: a beach runs gently into the sea, anything higher stands in it as a cliff.
            float wc = h <= d.beachZ + 1 ? 0.5f : 0.15f;
            float dc = Inside(u, v, float.NegativeInfinity) + (wc < 0.2f ? Wander(u, v, -1) : 0);
            if (dc < wc)
            {
                float s = Mathf.SmoothStep(0, 1, dc / wc);
                float t = Mathf.Lerp(SeaH(u, v), h, s);
                if (wc < 0.2f) rock = Mathf.Max(rock, 1 - Mathf.Abs(2 * s - 1));
                h = Mathf.Min(h, t);
            }
            return h;
        }

        /** How far a cliff's edge is pushed in or out here, in tiles: broad bays and headlands, and small notches. */
        static float Wander(float u, float v, float z) =>
            (Noise.Fbm(u * 1.7f, v * 1.7f + z * 0.07f, 3, 41) - 0.5f) * 0.1f + (Noise.Fbm(u * 6.1f, v * 6.1f, 2, 43) - 0.5f) * 0.035f;

        /**
         * How far inside the outline of the ground at least `z` high a point is,
         * in tiles (negative outside): from the smooth field of those tiles and
         * its slope. NegativeInfinity asks about all land, so it is the coastline.
         */
        float Inside(float u, float v, float z)
        {
            float f = Field(u, v, z);
            if (f >= 0.999f) return 9;
            if (f <= 0.001f) return -9;
            const float e = 0.02f;
            float gu = (Field(u + e, v, z) - Field(u - e, v, z)) / (2 * e), gv = (Field(u, v + e, z) - Field(u, v - e, z)) / (2 * e);
            return (f - 0.5f) / Mathf.Max(Mathf.Sqrt(gu * gu + gv * gv), 0.5f);
        }

        /** How much land there is round a point, smoothly between tile middles: 1 inland, 0 at sea, a half on the coastline. */
        public float Field(float u, float v) => Field(u, v, float.NegativeInfinity);

        /** The same for the land at least `z` high. */
        public float Field(float u, float v, float z)
        {
            float cu = u - 0.5f, cv = v - 0.5f;
            int i0 = Mathf.FloorToInt(cu), j0 = Mathf.FloorToInt(cv);
            float fu = cu - i0, fv = cv - j0;
            fu = fu * fu * (3 - 2 * fu); fv = fv * fv * (3 - 2 * fv);
            float A(int i, int j) => d.Land(i, j) && d.Z(i, j) >= z - 0.01f ? 1 : 0;
            return Mathf.Lerp(Mathf.Lerp(A(i0, j0), A(i0, j0 + 1), fv), Mathf.Lerp(A(i0 + 1, j0), A(i0 + 1, j0 + 1), fv), fu);
        }

        /** The ground's height with the buildings' blocks on it, in world units: for working out how shut in a place is. */
        public float WorldWithBlocks(float u, float v)
        {
            float y = IslandBuild.Y(H(u, v));
            if (plaza.TryGetValue((Mathf.FloorToInt(u), Mathf.FloorToInt(v)), out var b))
                if (u > b.i + 0.12f && u < b.i + b.w - 0.12f && v > b.j + 0.12f && v < b.j + b.d - 0.12f)
                    y = Mathf.Max(y, IslandBuild.Y(b.z) + IslandBuild.BlockHeight(b) / IslandBuild.PxPerHeight);
            return y;
        }

        /* ---- the mesh ------------------------------------------------------------- */

        /** The ground as a mesh, with how open to the sky each point is (ambient occlusion) in its colour's red. */
        public Mesh Mesh()
        {
            int n = Span * PerTile + 1;
            var verts = new Vector3[n * n];
            var norms = new Vector3[n * n];
            var cols = new Color[n * n];
            const float e = 0.03f;
            for (int a = 0; a < n; a++)
                for (int b = 0; b < n; b++)
                {
                    float u = Lo + (float)a / PerTile, v = Lo + (float)b / PerTile;
                    float y = IslandBuild.Y(H(u, v));
                    verts[a * n + b] = new Vector3(v, y, u);
                    float dyu = (IslandBuild.Y(H(u + e, v)) - IslandBuild.Y(H(u - e, v))) / (2 * e);
                    float dyv = (IslandBuild.Y(H(u, v + e)) - IslandBuild.Y(H(u, v - e))) / (2 * e);
                    norms[a * n + b] = new Vector3(-dyv, 1, -dyu).normalized;
                    cols[a * n + b] = new Color(Occlusion(u, v), 0, 0, 1);
                }
            var tris = new int[(n - 1) * (n - 1) * 6];
            int k = 0;
            for (int a = 0; a < n - 1; a++)
                for (int b = 0; b < n - 1; b++)
                {
                    int p00 = a * n + b, p01 = a * n + b + 1, p10 = (a + 1) * n + b, p11 = (a + 1) * n + b + 1;
                    tris[k++] = p00; tris[k++] = p10; tris[k++] = p11;
                    tris[k++] = p00; tris[k++] = p11; tris[k++] = p01;
                }
            var m = new Mesh { name = "terrain", indexFormat = UnityEngine.Rendering.IndexFormat.UInt32 };
            m.vertices = verts; m.normals = norms; m.colors = cols; m.triangles = tris;
            m.RecalculateBounds();
            return m;
        }

        static readonly Vector2[] Dirs = { new(1, 0), new(-1, 0), new(0, 1), new(0, -1), new(0.707f, 0.707f), new(-0.707f, 0.707f), new(0.707f, -0.707f), new(-0.707f, -0.707f) };
        static readonly float[] Steps = { 0.06f, 0.13f, 0.25f, 0.42f, 0.7f, 1.1f };

        /** How much of the sky a point sees: 1 open, less at the foot of a cliff or a building. */
        public float Occlusion(float u, float v)
        {
            float y0 = WorldWithBlocks(u, v) + 0.01f, sum = 0;
            foreach (var dir in Dirs)
            {
                float best = 0;
                foreach (var r in Steps)
                {
                    float t = (WorldWithBlocks(u + dir.x * r, v + dir.y * r) - y0) / r;
                    if (t > best) best = t;
                }
                sum += best / Mathf.Sqrt(1 + best * best);
            }
            return Mathf.Clamp01(1 - sum / Dirs.Length * 1.1f);
        }

        /* ---- the colour of the ground ---------------------------------------------- */

        static Color Hex(string h) { ColorUtility.TryParseHtmlString(h, out var c); return c; }
        static readonly Color Deep = Hex("#3a6b52"), Sand = Hex("#d2d0c8"), Wet = Hex("#8f9a9e"), Floor0 = Hex("#c4d2cf"),
            Rock = Hex("#8d91a5"), RockHi = Hex("#a9adbf"), RockLo = Hex("#6f7389"), Paving = Hex("#878c97"), Kerb = Hex("#b4b8c2"),
            Plaza = Hex("#b3b8c6"), Soil = Hex("#5d6372"), Lavender = Hex("#7c6fa6"), Sage = Hex("#93a89c"), Greens = Hex("#3f6f55"),
            River = Hex("#5aa8d8"), RiverHi = Hex("#a6d8f2"), Foam = Hex("#eef5fa"), Pond = Hex("#3d8a9c"), Mud = Hex("#cbc7d9"), MudDark = Hex("#9d98b2");

        static float SegDist(Vector2 p, Vector2 a, Vector2 b)
        {
            var ab = b - a; float t = Mathf.Clamp01(Vector2.Dot(p - a, ab) / Mathf.Max(1e-6f, ab.sqrMagnitude));
            return Vector2.Distance(p, a + ab * t);
        }
        static float PathDist(List<(Vector2 a, Vector2 b)> segs, Vector2 p)
        {
            float best = 99;
            foreach (var (a, b) in segs) { float dd = SegDist(p, a, b); if (dd < best) best = dd; }
            return best;
        }

        // The segments that come within a tile of each tile, so a texel looks only at its neighbourhood.
        readonly Dictionary<(int, int), List<(Vector2 a, Vector2 b)>> near = new();
        List<(Vector2 a, Vector2 b)> Near(List<(Vector2 a, Vector2 b)> segs, int ti, int tj, int tag)
        {
            var key = (ti * 4 + tag, tj);
            if (near.TryGetValue(key, out var list)) return list;
            list = new List<(Vector2 a, Vector2 b)>();
            var mid = new Vector2(ti + 0.5f, tj + 0.5f);
            foreach (var sg in segs) if (SegDist(mid, sg.a, sg.b) < 1.3f) list.Add(sg);
            return near[key] = list;
        }

        Color Grass(float u, float v)
        {
            // The district's colour, blended between tile middles so districts meet softly.
            float cu = u - 0.5f, cv = v - 0.5f;
            int i0 = Mathf.FloorToInt(cu), j0 = Mathf.FloorToInt(cv);
            float fu = cu - i0, fv = cv - j0;
            Color Of(int i, int j)
            {
                int ci = Mathf.Clamp(i, 0, d.grid - 1), cj = Mathf.Clamp(j, 0, d.grid - 1);
                return districts.TryGetValue(d.District(ci, cj), out var c) ? c.a : Hex("#86e9cf");
            }
            var site = Color.Lerp(Color.Lerp(Of(i0, j0), Of(i0, j0 + 1), fv), Color.Lerp(Of(i0 + 1, j0), Of(i0 + 1, j0 + 1), fv), fu);
            // Real grass is darker and less bright than a flat illustration's: the site's colour,
            // deepened, a little greyer, and a little less blue.
            var g = Color.Lerp(site, Deep, 0.62f);
            float lum = g.r * 0.3f + g.g * 0.59f + g.b * 0.11f;
            g = Color.Lerp(g, new Color(lum, lum, lum), 0.36f);
            g.b *= 0.8f;
            g *= 0.97f;
            // Real turf: drier, paler stretches and lush dark hollows, worn lighter in places, never one flat green.
            float patch = Noise.Fbm(u * 0.9f, v * 0.9f, 4, 3);
            float tuft = Noise.Fbm(u * 6f, v * 6f, 3, 5);
            float mid = Noise.Fbm(u * 14f, v * 14f, 2, 7);
            var dry = Color.Lerp(g, new Color(0.47f, 0.52f, 0.47f), 0.45f);
            var lush = new Color(g.r * 0.72f, g.g * 0.86f, g.b * 0.8f);
            g = Color.Lerp(g, dry, Mathf.Clamp01((patch - 0.55f) * 3f));
            g = Color.Lerp(g, lush, Mathf.Clamp01((0.45f - patch) * 3f));
            g *= 0.86f + 0.18f * patch + 0.2f * (tuft - 0.5f) + 0.14f * (mid - 0.5f);
            return g;
        }

        /** What a spot is, in the colour map's alpha, for the shader's fine detail. */
        public const float IsWater = 0, IsPaving = 0.25f, IsRock = 0.5f, IsSand = 0.75f, IsGrass = 1;
        float kind;
        /**
         * Which photograph a spot is made of (Photos.Layers 0-7: grass, dry sand,
         * wet sand, rock, road, plaza, cobbles, mud), as weights, for the splat
         * maps; all nought where it is water, which has no photograph.
         */
        readonly float[] w = new float[8];
        void Only(int k) { System.Array.Clear(w, 0, w.Length); if (k >= 0) w[k] = 1; }

        public Color Albedo(float u, float v)
        {
            kind = IsGrass;
            Only(0);
            int ti = Mathf.FloorToInt(u), tj = Mathf.FloorToInt(v);
            float h = H(u, v, out float rock);
            float e = 0.02f;
            float slope = new Vector2(H(u + e, v) - H(u - e, v), H(u, v + e) - H(u, v - e)).magnitude / (2 * e);
            var p = new Vector2(u, v);
            float grain = Noise.Value(u * 40, v * 40, 9);

            // Under the water: pale sand, darker as it deepens (the water's own colour comes from its shader).
            if (h < d.sea - 0.4f)
            {
                kind = IsSand; Only(2);
                return Color.Lerp(Floor0, Hex("#6f949c"), Mathf.Clamp01((d.sea - h) / 22f)) * (0.95f + 0.1f * grain);
            }

            Color c;
            bool isLand = d.Land(ti, tj);
            bool beachish = !isLand || d.Ground(ti, tj) == 'b' || (h < d.beachZ + 1.5f && !plaza.ContainsKey((ti, tj)));
            if (rock > 0.05f || slope > 40)
            {
                // Rock, in layers that run on at the same heights everywhere.
                float band = Mathf.Sin(h * 0.55f + Noise.Value(u * 3, v * 3, 2) * 2.5f);
                c = Color.Lerp(RockLo, RockHi, 0.5f + 0.5f * band) * (0.9f + 0.2f * Noise.Fbm(u * 12, v * 12, 3, 4));
                c = Color.Lerp(c, Rock, 0.35f);
                kind = IsRock; Only(3);
            }
            else if (beachish)
            {
                c = Sand * (0.94f + 0.1f * grain);
                // Wet sand down the last of the slope into the sea.
                float wet = Mathf.Clamp01(1 - (h - d.sea) / 2.2f);
                c = Color.Lerp(c, Wet, wet * 0.85f);
                kind = IsSand; Only(1); w[1] = 1 - wet; w[2] = wet;
            }
            else if (plaza.ContainsKey((ti, tj)))
            {
                // Paving round a building (its slabs or cobbles come from the photograph): cobbles in the old town.
                c = Plaza * (0.95f + 0.08f * Noise.Value(u * 2.1f, v * 2.1f, 6));
                kind = IsPaving; Only(d.District(ti, tj) == "oldtown" ? 6 : 5);
            }
            else if (districts.ContainsKey(d.District(ti, tj)) && d.District(ti, tj) == "badlands")
            {
                // Dust, cracked into plates.
                var site = districts["badlands"].a;
                c = Color.Lerp(site, Hex("#9b99a6"), 0.66f) * (0.9f + 0.18f * Noise.Fbm(u * 1.5f, v * 1.5f, 4, 8));
                var cell = Noise.Cells(u * 5, v * 5, 21);
                if (cell.y - cell.x < 0.05f) c *= 0.82f;
                kind = IsSand; Only(7);
            }
            else c = Grass(u, v);

            if (isLand && !beachish && rock < 0.05f)
            {
                // Fields, in rows.
                foreach (var f in d.fields)
                    if (u >= f.i + 0.06f && u <= f.i + f.w - 0.06f && v >= f.j + 0.06f && v <= f.j + f.d - 0.06f)
                    {
                        float row = Mathf.Repeat(u * 5.5f, 1);
                        var crop = f.kind == "lavender" ? Lavender : f.kind == "wheat" ? Sage : Greens;
                        // Each row a rounded line of plants, lit on top and shaded at its sides, with a dark furrow between.
                        float round = Mathf.Sin(Mathf.PI * Mathf.Clamp01(row / 0.68f));
                        c = row < 0.68f
                            ? crop * (0.62f + 0.48f * round) * (0.85f + 0.3f * Noise.Fbm(u * 30, v * 9, 2, 12))
                            : Soil * (0.75f + 0.15f * grain);
                        Only(row < 0.68f ? 0 : 7);
                    }
                // The dry wash across the Badlands.
                if (wash.Count > 0)
                {
                    float wd = PathDist(Near(wash, ti, tj, 1), p) + (Noise.Value(u * 4, v * 4, 13) - 0.5f) * 0.06f;
                    if (wd < 0.2f)
                    {
                        var cell = Noise.Cells(u * 9, v * 9, 14);
                        c = Mud * (0.95f + 0.08f * grain);
                        if (cell.y - cell.x < 0.06f) c = MudDark;
                        Only(7);
                    }
                    else if (wd < 0.27f) c = Color.Lerp(c, MudDark, 0.6f);
                }
                // Roads: a paved way, a kerb, and grass worn either side.
                float rd = PathDist(Near(roads, ti, tj, 0), p);
                if (rd < 0.25f)
                {
                    var cell = Noise.Cells(u * 10, v * 10, 17);
                    c = Paving * (0.93f + 0.1f * Noise.Value(u * 25, v * 25, 18));
                    if (cell.y - cell.x < 0.045f) c *= 0.9f;
                    kind = IsPaving; Only(4);
                }
                else if (rd < 0.285f) { c = Kerb; kind = IsPaving; Only(5); }
                else if (rd < 0.42f) c = Color.Lerp(c, c * 0.8f + Soil * 0.08f, 1 - (rd - 0.285f) / 0.135f);
            }

            // The river, falling down the terraces, white where it falls.
            if (river.Contains((ti, tj)))
            {
                float across = Mathf.Abs(u - (ti + 0.5f));
                if (across < 0.17f)
                {
                    c = Color.Lerp(River, RiverHi, across / 0.17f * 0.7f);
                    kind = IsWater; Only(-1);
                    if (slope > 25) c = Color.Lerp(c, Foam, 0.85f);
                }
                else if (across < 0.23f) { c = Color.Lerp(RockLo, Rock, grain); Only(3); }
            }
            // The pond: a sandy rim, deep middle, lily pads.
            if (pond.Count > 0 && pondBox.Contains(new Vector2(u, v)))
            {
                float x = Mathf.Min(u - pondBox.xMin, pondBox.xMax - u), y = Mathf.Min(v - pondBox.yMin, pondBox.yMax - v);
                float inside = Mathf.Min(x, y);
                if (inside > 0.22f)
                {
                    c = Color.Lerp(RiverHi, Pond, Mathf.Clamp01((inside - 0.22f) / 0.3f));
                    kind = IsWater; Only(-1);
                    var pad = Noise.Cells(u * 3.2f, v * 3.2f, 31);
                    if (pad.x < 0.13f && Noise.Value(u * 1.3f, v * 1.3f, 32) > 0.45f) c = Hex("#3f8a5e");
                }
                else if (inside > 0.1f) { c = Sand * 0.95f; Only(1); }
            }
            c.a = kind;
            return c;
        }

        /** The colour map: TexPerTile texels a tile over the whole ground. */
        public Texture2D AlbedoMap() => AlbedoMap(out _, out _);

        /** The colour map, and the splat maps beside it: layers 0-3 in one's RGBA, 4-7 in the other's. */
        public Texture2D AlbedoMap(out Texture2D splatA, out Texture2D splatB)
        {
            int n = Span * TexPerTile;
            Texture2D Make(bool linear) => new Texture2D(n, n, TextureFormat.RGBA32, true, linear) { wrapMode = TextureWrapMode.Clamp, filterMode = FilterMode.Trilinear, anisoLevel = 8 };
            var tex = Make(false);
            splatA = Make(true); splatB = Make(true);
            var px = new Color32[n * n];
            var pa = new Color32[n * n];
            var pb = new Color32[n * n];
            byte B(float x) => (byte)Mathf.RoundToInt(Mathf.Clamp01(x) * 255);
            for (int y = 0; y < n; y++)
                for (int x = 0; x < n; x++)
                {
                    float u = Lo + (y + 0.5f) / TexPerTile, v = Lo + (x + 0.5f) / TexPerTile;
                    px[y * n + x] = Albedo(u, v);
                    pa[y * n + x] = new Color32(B(w[0]), B(w[1]), B(w[2]), B(w[3]));
                    pb[y * n + x] = new Color32(B(w[4]), B(w[5]), B(w[6]), B(w[7]));
                }
            tex.SetPixels32(px); tex.Apply(true);
            splatA.SetPixels32(pa); splatA.Apply(true);
            splatB.SetPixels32(pb); splatB.Apply(true);
            return tex;
        }

        /** How deep the water is (0 the shore, 1 thirty units down), for the water's colour and clearness. */
        public Texture2D DepthMap()
        {
            int n = Span * DepthPerTile;
            var tex = new Texture2D(n, n, TextureFormat.RGBA32, false, true) { wrapMode = TextureWrapMode.Clamp, filterMode = FilterMode.Bilinear };
            var px = new Color32[n * n];
            for (int y = 0; y < n; y++)
                for (int x = 0; x < n; x++)
                {
                    float u = Lo + (y + 0.5f) / DepthPerTile, v = Lo + (x + 0.5f) / DepthPerTile;
                    float depth = Mathf.Clamp01((d.sea - H(u, v)) / 30f);
                    byte b = (byte)Mathf.RoundToInt(depth * 255);
                    px[y * n + x] = new Color32(b, b, b, 255);
                }
            tex.SetPixels32(px); tex.Apply(false);
            return tex;
        }
    }
}
