// What grows on the island, and its rocks, in 3D: every figure the site names
// (lib/island/props.ts: "round-leaf2", "pine-teal0", "palm1", "rock2"...),
// built at the world's origin at a size of 1, the same every time for the
// same name (its random numbers come from its name).
//
// Trees are grown here rather than taken whole from Poly Haven, whose trees
// are made for film (hundreds of MB each, where a tree here is a hundred
// pixels): a trunk and branches as tapered tubes in bark, and the crown as
// cards cut from Poly Haven's leaf, needle and twig photographs
// (scripts/fetch-textures.mjs), each card coloured as its species is. The
// rocks are Poly Haven's own models.
//
// Sizes are in world units (a tile is 1; a site height z is z / 39.19), as
// the site draws each at a size of 1.
using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEngine;

namespace Island
{
    public static class Plants
    {
        /* ---- materials ---------------------------------------------------------- */

        const string Trees = "Textures/trees";
        static Material twig, fern, needle, leaflet, barkPine, barkSmooth, barkPalm, deadWood, cactusSkin, softRock, reedHead;
        static readonly Dictionary<string, Material> rockMats = new();

        /** A cut-out leaf sheet: the colour photo with the alpha photo as its alpha. */
        static Material Leaves(string colour, string alpha)
        {
            var c = Read(Path.Combine(Trees, colour), false);
            var a = Read(Path.Combine(Trees, alpha), true);
            var cp = c.GetPixels32();
            var ap = a.GetPixels32();
            double sum = 0; int n = 0;
            for (int k = 0; k < cp.Length; k++)
            {
                cp[k].a = ap[k].r;
                if (ap[k].r > 128) { sum += Mathf.GammaToLinearSpace((cp[k].r * 0.3f + cp[k].g * 0.59f + cp[k].b * 0.11f) / 255f); n++; }
            }
            var t = new Texture2D(c.width, c.height, TextureFormat.RGBA32, true, false) { wrapMode = TextureWrapMode.Clamp, filterMode = FilterMode.Trilinear, anisoLevel = 4 };
            t.SetPixels32(cp); t.Apply(true);
            var m = new Material(Shader.Find("Island/Foliage"));
            m.SetTexture("_BaseMap", t);
            m.SetColor("_BaseColor", Color.white);
            m.SetFloat("_Cutoff", 0.45f);
            m.SetFloat("_Mean", (float)(sum / Mathf.Max(1, n)));
            m.EnableKeyword("_ALPHATEST_ON");
            return m;
        }

        static Material Bark(string colour, string normal, float tile, Color tint, float detail = 1)
        {
            var c = Read(Path.Combine(Trees, colour), false);
            var m = new Material(Shader.Find("Island/Bark"));
            m.SetTexture("_BaseMap", c);
            m.SetTextureScale("_BaseMap", new Vector2(1, tile));
            m.SetFloat("_Mean", Mean(c));
            m.SetColor("_BaseColor", tint);
            m.SetFloat("_Detail", detail);
            if (normal != null)
            {
                m.SetTexture("_Normal", Read(Path.Combine(Trees, normal), true));
                m.SetFloat("_HasNormal", 1);
            }
            return m;
        }

        static float Mean(Texture2D t)
        {
            var p = t.GetPixels32();
            double s = 0;
            for (int k = 0; k < p.Length; k += 5) s += Mathf.GammaToLinearSpace((p[k].r * 0.3f + p[k].g * 0.59f + p[k].b * 0.11f) / 255f);
            return (float)(s / ((p.Length + 4) / 5));
        }

        static Texture2D Read(string file, bool linear)
        {
            if (!File.Exists(file)) throw new FileNotFoundException($"{file} is missing: run node scripts/fetch-textures.mjs");
            var t = new Texture2D(2, 2, TextureFormat.RGBA32, true, linear) { wrapMode = TextureWrapMode.Repeat, filterMode = FilterMode.Trilinear, anisoLevel = 4 };
            t.LoadImage(File.ReadAllBytes(file));
            return t;
        }

        public static void Load()
        {
            if (twig != null) return;
            twig = Leaves("tree_small_02_leaves_diff.jpg", "tree_small_02_leaves_alpha.jpg");
            fern = Leaves("jacaranda_tree_leaves_diff.jpg", "jacaranda_tree_leaves_alpha.jpg");
            needle = Leaves("pine_tree_01_twig_diff.jpg", "pine_tree_01_twig_alpha.jpg");
            leaflet = Leaves("island_tree_01_leaves_diff.jpg", "island_tree_01_leaves_alpha.jpg");
            barkPine = Bark("pine_tree_01_bark_diff.jpg", "pine_tree_01_bark_nor_gl.jpg", 3, Hex("#6f6a68"));
            barkSmooth = Bark("jacaranda_tree_trunk_diff.jpg", "jacaranda_tree_trunk_nor_gl.jpg", 3, Hex("#76726f"));
            barkPalm = Bark("tree_small_02_branch_diff.jpg", null, 14, Hex("#9a968f"), 1.4f);
            deadWood = Bark("jacaranda_tree_trunk_diff.jpg", "jacaranda_tree_trunk_nor_gl.jpg", 3, Hex("#a3a2a8"), 1.3f);
            cactusSkin = Bark("tree_small_02_branch_diff.jpg", null, 2, Hex("#4f8570"), 0.35f);
            cactusSkin.SetFloat("_Spec", 0.12f);
            // The Badlands' soft rock: the cliff photo's layers and grain on banded vertex colours.
            softRock = Bark("../cliff_side_diff.jpg", "../cliff_side_nor.jpg", 1, Color.white, 1.1f);
            reedHead = Bark("jacaranda_tree_trunk_diff.jpg", null, 4, Hex("#4b423f"), 0.6f);
        }

        /* ---- the leaf sheets' pieces (in the photo, x right and y down, 0 to 1) ---- */

        static readonly Rect[] TwigCards = { R(0.0f, 0.29f, 0.5f, 0.9f), R(0.0f, 0.29f, 0.5f, 0.9f), R(0.21f, 0.28f, 0.51f, 0.75f), R(0.0f, 0.3f, 0.24f, 0.57f) };
        static readonly Rect[] FernCards = { R(0.29f, 0.03f, 0.82f, 0.46f), R(0.76f, 0.06f, 0.985f, 0.42f), R(0.1f, 0.33f, 0.34f, 0.5f), R(0.445f, 0.79f, 0.69f, 0.99f), R(0.117f, 0.516f, 0.297f, 0.688f) };
        static readonly Rect[] NeedleCards = { R(0.045f, 0.075f, 0.205f, 0.43f), R(0.675f, 0.365f, 0.925f, 0.495f), R(0.72f, 0.665f, 0.925f, 0.77f) };
        static readonly Rect[] LeafletCards = { R(0.016f, 0.023f, 0.148f, 0.398f), R(0.164f, 0.023f, 0.336f, 0.391f), R(0.695f, 0.031f, 0.813f, 0.414f), R(0.359f, 0.039f, 0.484f, 0.359f), R(0.516f, 0.047f, 0.648f, 0.359f) };
        /** A piece of a sheet, from the photo's own coordinates to UVs (whose v runs up). */
        static Rect R(float x0, float y0, float x1, float y1) => Rect.MinMaxRect(x0, 1 - y1, x1, 1 - y0);

        /* ---- meshes -------------------------------------------------------------- */

        class Mb
        {
            public readonly List<Vector3> v = new(), n = new(), crown = new();
            public readonly List<Vector4> tan = new();
            public readonly List<Color> c = new();
            public readonly List<Vector2> uv = new();
            public readonly List<int> t = new();

            /** A card: centred at p, facing `face`, its picture's up along `up`, w by h, coloured col, alpha ao; lit as if its normal were `cn`. */
            public void Card(Vector3 p, Vector3 face, Vector3 up, float w, float h, Rect r, Color col, float ao, Vector3 cn)
            {
                face = face.normalized;
                var right = Vector3.Cross(up, face).normalized;
                up = Vector3.Cross(face, right).normalized;
                int k = v.Count;
                var hw = right * w / 2; var hh = up * h / 2;
                v.Add(p - hw - hh); uv.Add(new Vector2(r.xMin, r.yMin));
                v.Add(p + hw - hh); uv.Add(new Vector2(r.xMax, r.yMin));
                v.Add(p + hw + hh); uv.Add(new Vector2(r.xMax, r.yMax));
                v.Add(p - hw + hh); uv.Add(new Vector2(r.xMin, r.yMax));
                col.a = ao;
                for (int q = 0; q < 4; q++) { n.Add(face); c.Add(col); crown.Add(cn.normalized); tan.Add(new Vector4(right.x, right.y, right.z, 1)); }
                t.AddRange(new[] { k, k + 2, k + 1, k, k + 3, k + 2 });
            }

            /** A tube along pts, radius rad at each, `sides` round; bark's v runs with its length. */
            public void Tube(IList<Vector3> pts, IList<float> rad, int sides, Color col, float aoBase = 0.55f, System.Func<float, float, float> bump = null)
            {
                float len = 0;
                Vector3 prevSide = Vector3.zero;
                int k0 = v.Count;
                for (int i = 0; i < pts.Count; i++)
                {
                    var dir = (i < pts.Count - 1 ? pts[i + 1] - pts[i] : pts[i] - pts[i - 1]).normalized;
                    if (i > 0) len += (pts[i] - pts[i - 1]).magnitude;
                    // A frame carried along the tube, so it does not twist.
                    var side = i == 0 ? Vector3.Cross(dir, Mathf.Abs(dir.y) < 0.9f ? Vector3.up : Vector3.right).normalized : Vector3.ProjectOnPlane(prevSide, dir).normalized;
                    prevSide = side;
                    var other = Vector3.Cross(dir, side);
                    float ao = Mathf.Lerp(aoBase, 1, Mathf.Clamp01(len * 3));
                    for (int s = 0; s <= sides; s++)
                    {
                        float a = s * Mathf.PI * 2 / sides;
                        var nrm = side * Mathf.Cos(a) + other * Mathf.Sin(a);
                        float r = rad[i] * (bump != null ? bump(a, len) : 1);
                        v.Add(pts[i] + nrm * r); n.Add(nrm); crown.Add(nrm);
                        var tg = Vector3.Cross(dir, nrm).normalized;
                        tan.Add(new Vector4(tg.x, tg.y, tg.z, 1));
                        uv.Add(new Vector2((float)s / sides, len / Mathf.Max(0.05f, rad[0] * 6)));
                        var cc = col; cc.a = ao; c.Add(cc);
                    }
                }
                int ring = sides + 1;
                for (int i = 0; i < pts.Count - 1; i++)
                    for (int s = 0; s < sides; s++)
                    {
                        int a = k0 + i * ring + s, b = a + ring;
                        t.AddRange(new[] { a, b, a + 1, a + 1, b, b + 1 });
                    }
            }

            public Mesh Mesh(string name)
            {
                var m = new Mesh { name = name, indexFormat = UnityEngine.Rendering.IndexFormat.UInt32 };
                m.SetVertices(v); m.SetNormals(n); m.SetColors(c); m.SetUVs(0, uv); m.SetUVs(1, crown); m.SetTangents(tan); m.SetTriangles(t, 0);
                m.RecalculateBounds();
                return m;
            }
        }

        /* ---- the random numbers, from the name ------------------------------------- */

        class Rng
        {
            System.Random r;
            public Rng(string name) { uint h = 2166136261; foreach (char ch in name) h = (h ^ ch) * 16777619; r = new System.Random((int)h); }
            public float F() => (float)r.NextDouble();
            public float F(float a, float b) => a + (b - a) * F();
            public int I(int n) => r.Next(n);
            public Vector3 Sphere() { Vector3 p; do p = new Vector3(F(-1, 1), F(-1, 1), F(-1, 1)); while (p.sqrMagnitude > 1 || p.sqrMagnitude < 0.01f); return p; }
        }

        static Color Hex(string h) { ColorUtility.TryParseHtmlString(h, out var c); return c; }
        /** A species colour (sRGB), varied a little: for a vertex, so linear. */
        static Color Vary(Rng r, Color c, float amount = 0.1f)
        {
            Color.RGBToHSV(c, out var hh, out var s, out var vv);
            var o = Color.HSVToRGB(Mathf.Repeat(hh + r.F(-0.015f, 0.015f), 1), Mathf.Clamp01(s * r.F(1 - amount, 1 + amount)), Mathf.Clamp01(vv * r.F(1 - amount * 1.5f, 1 + amount)));
            return o.linear;
        }

        /** Towards the island's camera (yaw 225°, down 30°): cards half turned to it fill a crown out. */
        static readonly Vector3 ToEye = -(Quaternion.Euler(30, 225, 0) * Vector3.forward);

        static GameObject Hold(string name) => new GameObject(name);
        static void Put(GameObject parent, Mb b, Material m, string name)
        {
            if (b.v.Count == 0) return;
            var go = new GameObject(name);
            go.transform.SetParent(parent.transform, false);
            go.AddComponent<MeshFilter>().sharedMesh = b.Mesh(name);
            var mr = go.AddComponent<MeshRenderer>();
            mr.sharedMaterial = m;
            mr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.On;
            mr.receiveShadows = true;
        }

        /* ---- the species ------------------------------------------------------------ */

        /** The figure a site name stands for, at the origin. */
        public static GameObject Build(string name)
        {
            Load();
            var r = new Rng(name);
            string kind = name.TrimEnd('0', '1', '2', '3', '4', '5', '6', '7', '8', '9');
            switch (kind)
            {
                case "round-leaf": return Broadleaf(name, r, Hex("#3f7350"), null, 0);
                case "round-teal": return Broadleaf(name, r, Hex("#6a958c"), null, 0, wide: 1.05f);
                case "round-bloom": return Broadleaf(name, r, Hex("#4b7a58"), Hex("#8f80d8"), 0.7f, wide: 1.15f, flat: 0.8f, sheet: "fern");
                case "blossom": return Broadleaf(name, r, Hex("#4a7c5a"), Hex("#f1d4e4"), 0.62f);
                case "bush-leaf": return Bush(name, r, Hex("#44754f"), null);
                case "bush-teal": return Bush(name, r, Hex("#5e8f86"), null);
                case "bush-bloom": return Bush(name, r, Hex("#4a7a56"), Hex("#b49de0"));
                case "pine-leaf": return Conifer(name, r, Hex("#2f5a43"), false);
                case "pine-teal": return Conifer(name, r, Hex("#2c5858"), false);
                case "pine-bloom": return Conifer(name, r, Hex("#6d8ea3"), false);
                case "snowpine-leaf": return Conifer(name, r, Hex("#2f5a43"), true);
                case "snowpine-teal": return Conifer(name, r, Hex("#2c5858"), true);
                case "snowpine-bloom": return Conifer(name, r, Hex("#6d8ea3"), true);
                case "cypress-leaf": return Cypress(name, r, Hex("#2c5240"));
                case "cypress-teal": return Cypress(name, r, Hex("#33605c"));
                case "cypress-bloom": return Cypress(name, r, Hex("#4d6b78"));
                case "palm": return Palm(name, r);
                case "snag": return Snag(name, r);
                case "cactus": return Saguaro(name, r, false);
                case "cactus-flower": return Saguaro(name, r, true);
                case "barrel": return Barrel(name, r);
                case "rock": return Rock(name, r);
                case "searock": return SeaRock(name, r);
                case "boulders": return Boulders(name, r);
                case "reeds": return Reeds(name, r);
            }
            // Named with their sizes: "hoodoo-44-10" (44 high, a girth of 1.0), "butte-34".
            var parts = name.Split('-');
            switch (parts[0])
            {
                case "hoodoo": return Hoodoo(name, r, float.Parse(parts[1]), float.Parse(parts[2]) / 10f);
                case "butte": return Butte(name, r, float.Parse(parts[1]));
            }
            Debug.LogWarning($"[island] no plant called {name}");
            return null;
        }

        /** A curved trunk from the ground up to `top`, as points. */
        static List<Vector3> Curve(Vector3 a, Vector3 b, Vector3 bend, int n)
        {
            var pts = new List<Vector3>();
            for (int i = 0; i <= n; i++) { float t = (float)i / n; pts.Add(Vector3.Lerp(a, b, t) + bend * Mathf.Sin(t * Mathf.PI)); }
            return pts;
        }
        static List<float> Taper(int n, float r0, float r1) { var l = new List<float>(); for (int i = 0; i <= n; i++) l.Add(Mathf.Lerp(r0, r1, Mathf.Pow((float)i / n, 0.8f))); return l; }

        /**
         * A broadleaf tree: a trunk that forks into a few limbs, and a crown of
         * lumps, each a cluster of twig cards; `bloom` colours that share of the
         * cards as flowers.
         */
        static GameObject Broadleaf(string name, Rng r, Color leaf, Color? bloom, float bloomShare, float wide = 1, float flat = 1, string sheet = "twig")
        {
            var root = Hold(name);
            float trunkH = r.F(0.19f, 0.24f);
            var crownC = new Vector3(r.F(-0.02f, 0.02f), trunkH + 0.27f * flat, r.F(-0.02f, 0.02f));
            var rad = new Vector3(0.33f * wide, 0.29f * flat, 0.33f * wide);
            var bark = new Mb();
            var top = new Vector3(crownC.x * 0.6f, trunkH, crownC.z * 0.6f);
            bark.Tube(Curve(Vector3.zero, top, new Vector3(r.F(-0.02f, 0.02f), 0, r.F(-0.02f, 0.02f)), 6), Taper(6, 0.035f, 0.024f), 9, Color.white);
            int limbs = 3 + r.I(3);
            for (int i = 0; i < limbs; i++)
            {
                float a = (i + r.F(-0.3f, 0.3f)) / limbs * Mathf.PI * 2;
                var end = crownC + new Vector3(Mathf.Cos(a) * rad.x * 0.62f, r.F(-0.05f, 0.12f), Mathf.Sin(a) * rad.z * 0.62f);
                bark.Tube(Curve(top, end, Vector3.up * 0.04f, 5), Taper(5, 0.02f, 0.006f), 6, Color.white);
            }
            Put(root, bark, barkSmooth, "bark");

            // Lumps: a crown is never one ball.
            int lumpN = 6 + r.I(4);
            var lumps = new List<(Vector3 c, float s)>();
            for (int i = 0; i < lumpN; i++)
            {
                var d = r.Sphere().normalized; d.y = Mathf.Abs(d.y) * 0.8f + 0.1f;
                lumps.Add((crownC + Vector3.Scale(d.normalized, rad) * r.F(0.35f, 0.62f), r.F(0.42f, 0.58f)));
            }
            var mat = sheet == "fern" ? fern : twig;
            var rects = sheet == "fern" ? FernCards : TwigCards;
            var leaves = new Mb(); var flowers = new Mb();
            int cards = sheet == "fern" ? 300 : 280;
            for (int i = 0; i < cards; i++)
            {
                var (lc, ls) = lumps[r.I(lumps.Count)];
                var dir = r.Sphere().normalized;
                var p = lc + Vector3.Scale(dir, rad) * ls * r.F(0.55f, 1f);
                // Inside the crown's own outline, give or take.
                var q = new Vector3((p.x - crownC.x) / rad.x, (p.y - crownC.y) / rad.y, (p.z - crownC.z) / rad.z);
                if (q.magnitude > 1.08f) { i--; continue; }
                var outward = (p - crownC); outward = new Vector3(outward.x / rad.x, outward.y / rad.y, outward.z / rad.z).normalized;
                float depth = Mathf.Clamp01(q.magnitude);
                float ao = Mathf.Lerp(0.25f, 1f, Mathf.SmoothStep(0.2f, 1f, depth)) * Mathf.Lerp(0.8f, 1f, Mathf.Clamp01(outward.y + 0.5f));
                var face = (outward * 0.55f + r.Sphere() * 0.45f + ToEye * 0.35f).normalized;
                var up = (Vector3.up + r.Sphere() * 0.9f).normalized;
                float s = r.F(0.075f, 0.12f) * (sheet == "fern" ? 1.1f : 1f);
                bool isBloom = bloom.HasValue && r.F() < bloomShare && depth > 0.55f;
                if (isBloom) flowers.Card(p + outward * 0.012f, face, up, s * 0.6f, s * 0.6f, TwigCards[r.I(TwigCards.Length)], Vary(r, bloom.Value, 0.16f), ao, outward);
                else leaves.Card(p, face, up, s, s, rects[r.I(rects.Length)], Vary(r, leaf), ao, outward);
            }
            Put(root, leaves, mat, "leaves");
            Put(root, flowers, twig, "flowers");
            return root;
        }

        /** A shrub: no trunk to speak of, a low mound of twig cards, perhaps in flower. */
        static GameObject Bush(string name, Rng r, Color leaf, Color? bloom)
        {
            var root = Hold(name);
            var c = new Vector3(0, 0.13f, 0);
            var rad = new Vector3(0.24f, 0.17f, 0.24f);
            var leaves = new Mb(); var flowers = new Mb();
            var lumps = new List<Vector3>();
            for (int i = 0; i < 4; i++) { var d = r.Sphere(); d.y = Mathf.Abs(d.y); lumps.Add(c + Vector3.Scale(d, rad) * 0.5f); }
            for (int i = 0; i < 230; i++)
            {
                var lc = lumps[r.I(lumps.Count)];
                var d = r.Sphere().normalized; if (d.y < -0.2f) d.y = -d.y * 0.3f;
                var p = lc + Vector3.Scale(d, rad) * r.F(0.4f, 0.75f);
                if (p.y < 0.02f) p.y = 0.02f + r.F(0, 0.03f);
                var outward = (p - c).normalized;
                float depth = Mathf.Clamp01(new Vector3((p.x - c.x) / rad.x, (p.y - c.y) / rad.y, (p.z - c.z) / rad.z).magnitude);
                float ao = Mathf.Lerp(0.3f, 1f, Mathf.SmoothStep(0.2f, 1f, depth)) * Mathf.Lerp(0.6f, 1f, Mathf.Clamp01(p.y / 0.2f));
                var face = (outward * 0.6f + r.Sphere() * 0.4f + ToEye * 0.3f).normalized;
                float s = r.F(0.055f, 0.085f);
                if (bloom.HasValue && r.F() < 0.5f && depth > 0.6f) flowers.Card(p + outward * 0.01f, face, (Vector3.up + r.Sphere()).normalized, s * 0.7f, s * 0.7f, TwigCards[r.I(TwigCards.Length)], Vary(r, bloom.Value, 0.08f), ao, outward);
                else leaves.Card(p, face, (Vector3.up + r.Sphere()).normalized, s, s, TwigCards[r.I(TwigCards.Length)], Vary(r, leaf), ao, outward);
            }
            Put(root, leaves, twig, "leaves");
            Put(root, flowers, twig, "flowers");
            return root;
        }

        /**
         * A conifer: a straight trunk to the tip, whorls of branches drooping
         * from it, shorter towards the top, each a row of needle sprays; with
         * snow lying along the tops of the branches if `snow`.
         */
        static GameObject Conifer(string name, Rng r, Color needles, bool snow)
        {
            var root = Hold(name);
            float H = r.F(0.98f, 1.1f), Rb = r.F(0.23f, 0.28f), h0 = 0.12f;
            var bark = new Mb();
            bark.Tube(Curve(Vector3.zero, new Vector3(0, H, 0), new Vector3(r.F(-0.01f, 0.01f), 0, r.F(-0.01f, 0.01f)), 8), Taper(8, 0.03f, 0.004f), 8, Color.white);
            var sprays = new Mb(); var white = new Mb();
            var snowCol = new Color(0.93f, 0.95f, 1f).linear;
            for (float y = h0; y < H - 0.03f; y += r.F(0.045f, 0.06f))
            {
                float tY = (y - h0) / (H - h0);
                float L = Rb * Mathf.Pow(1 - tY, 0.95f) + 0.035f;
                int n = 5 + r.I(3);
                float a0 = r.F(0, Mathf.PI * 2);
                for (int b = 0; b < n; b++)
                {
                    float a = a0 + b * Mathf.PI * 2 / n + r.F(-0.25f, 0.25f);
                    var dir = new Vector3(Mathf.Cos(a), 0, Mathf.Sin(a));
                    float droop = r.F(-0.35f, -0.15f);
                    var basePt = new Vector3(0, y, 0);
                    int steps = Mathf.Max(2, Mathf.RoundToInt(L / 0.045f));
                    for (int s = 1; s <= steps; s++)
                    {
                        float t = (float)s / steps;
                        var p = basePt + dir * (L * t) + Vector3.up * (droop * L * t * t) + r.Sphere() * 0.01f;
                        var cn = (dir + Vector3.up * 0.55f).normalized;
                        float ao = Mathf.Lerp(0.3f, 1f, t) * Mathf.Lerp(0.75f, 1f, tY);
                        float size = Mathf.Lerp(0.07f, 0.1f, t) * Mathf.Lerp(1f, 0.7f, tY);
                        // Two cards crossed along the branch: one lying flat, one on edge.
                        var up = (dir + r.Sphere() * 0.25f).normalized;
                        sprays.Card(p, (Vector3.up + r.Sphere() * 0.35f + ToEye * 0.2f).normalized, up, size, size * 1.3f, NeedleCards[r.I(NeedleCards.Length)], Vary(r, needles, 0.08f), ao, cn);
                        sprays.Card(p, (Vector3.Cross(dir, Vector3.up) + r.Sphere() * 0.3f).normalized, up, size * 0.9f, size * 1.2f, NeedleCards[r.I(NeedleCards.Length)], Vary(r, needles, 0.08f), ao * 0.9f, cn);
                        if (snow && t > 0.15f && r.F() < 0.75f)
                            white.Card(p + Vector3.up * 0.014f, (Vector3.up + r.Sphere() * 0.15f).normalized, up, size * 0.95f, size * 1.25f, NeedleCards[r.I(NeedleCards.Length)], snowCol * r.F(0.95f, 1.03f), Mathf.Lerp(0.7f, 1f, t), Vector3.up);
                    }
                }
            }
            // The leader at the tip.
            sprays.Card(new Vector3(0, H, 0), ToEye, Vector3.up, 0.05f, 0.12f, NeedleCards[0], Vary(r, needles, 0.05f), 1, Vector3.up);
            Put(root, bark, barkPine, "bark");
            Put(root, sprays, needle, "needles");
            Put(root, white, needle, "snow");
            return root;
        }

        /** An Italian cypress: a narrow flame of dense foliage, widest a third of the way up. */
        static GameObject Cypress(string name, Rng r, Color col)
        {
            var root = Hold(name);
            float H = r.F(1.22f, 1.36f), Rm = r.F(0.13f, 0.16f);
            var bark = new Mb();
            bark.Tube(Curve(Vector3.zero, new Vector3(0, 0.12f, 0), Vector3.zero, 2), Taper(2, 0.03f, 0.026f), 8, Color.white);
            Put(root, bark, barkPine, "bark");
            var fol = new Mb();
            for (int i = 0; i < 360; i++)
            {
                float t = Mathf.Pow(r.F(), 0.9f);
                float y = 0.08f + t * (H - 0.08f);
                float prof = Mathf.Sin(Mathf.Pow(t, 0.62f) * Mathf.PI) * (t < 0.3f ? 1 : 1) + 0.08f;
                float rr = Rm * Mathf.Clamp01(prof) * r.F(0.55f, 1.02f);
                float a = r.F(0, Mathf.PI * 2);
                var outward = new Vector3(Mathf.Cos(a), 0.25f, Mathf.Sin(a)).normalized;
                var p = new Vector3(Mathf.Cos(a) * rr, y, Mathf.Sin(a) * rr);
                float ao = Mathf.Lerp(0.35f, 1, rr / Rm) * Mathf.Lerp(0.7f, 1, t);
                float s = r.F(0.07f, 0.1f);
                fol.Card(p, (outward * 0.6f + r.Sphere() * 0.3f + ToEye * 0.3f).normalized, (Vector3.up + r.Sphere() * 0.4f).normalized, s, s * 1.3f, NeedleCards[r.I(NeedleCards.Length)], Vary(r, col, 0.08f), ao, outward);
            }
            Put(root, fol, needle, "foliage");
            return root;
        }

        /** A coconut palm: a leaning, ringed trunk and a crown of arching fronds, each a spine of leaflets. */
        static GameObject Palm(string name, Rng r)
        {
            var root = Hold(name);
            float lean = r.F(0, Mathf.PI * 2);
            var leanDir = new Vector3(Mathf.Cos(lean), 0, Mathf.Sin(lean));
            var top = new Vector3(0, r.F(0.62f, 0.7f), 0) + leanDir * r.F(0.06f, 0.12f);
            var trunkPts = new List<Vector3>();
            for (int i = 0; i <= 10; i++) { float t = i / 10f; trunkPts.Add(new Vector3(0, top.y * t, 0) + leanDir * (top - new Vector3(0, top.y, 0)).magnitude * t * t); }
            var bark = new Mb();
            // Rings: the trunk's radius ripples a little all the way up.
            bark.Tube(trunkPts, Taper(10, 0.034f, 0.024f), 10, Color.white, 0.6f, (a, len) => 1 + 0.08f * Mathf.Pow(Mathf.Abs(Mathf.Sin(len * 70)), 4));
            Put(root, bark, barkPalm, "trunk");
            var fronds = new Mb();
            var green = Hex("#4f8a5a");
            int n = 11 + r.I(3);
            for (int f = 0; f < n; f++)
            {
                float a = f * Mathf.PI * 2 / n + r.F(-0.2f, 0.2f);
                var dir = new Vector3(Mathf.Cos(a), 0, Mathf.Sin(a));
                float L = r.F(0.36f, 0.46f), rise = r.F(0.1f, 0.35f);
                Vector3 Spine(float t) => top + dir * (L * t) + Vector3.up * (L * (rise * t - (0.38f + rise) * t * t));
                var col = Vary(r, green, 0.1f);
                for (int s = 1; s <= 18; s++)
                {
                    float t = s / 18f;
                    var p = Spine(t);
                    var along = (Spine(Mathf.Min(1, t + 0.05f)) - Spine(Mathf.Max(0, t - 0.05f))).normalized;
                    var across = Vector3.Cross(along, Vector3.up).normalized;
                    float len = 0.12f * Mathf.Sin(Mathf.Clamp01(t * 1.1f) * Mathf.PI * 0.95f) + 0.015f;
                    foreach (var side in new[] { -1f, 1f })
                    {
                        // A leaflet hangs from the spine, out and down.
                        var outDir = (across * side + Vector3.down * 0.35f + along * 0.3f).normalized;
                        var c = p + outDir * len * 0.5f;
                        var face = Vector3.Cross(outDir, along).normalized; if (face.y < 0) face = -face;
                        fronds.Card(c, (face + ToEye * 0.2f).normalized, outDir, len * 0.3f, len, LeafletCards[r.I(LeafletCards.Length)], col * r.F(0.9f, 1.08f), Mathf.Lerp(0.55f, 1, t), (outDir + Vector3.up).normalized);
                    }
                }
            }
            Put(root, fronds, leaflet, "fronds");
            return root;
        }

        /** A dead tree: a grey trunk and bare limbs, forking twice. */
        static GameObject Snag(string name, Rng r)
        {
            var root = Hold(name);
            var b = new Mb();
            var top = new Vector3(r.F(-0.03f, 0.03f), r.F(0.42f, 0.52f), r.F(-0.03f, 0.03f));
            b.Tube(Curve(Vector3.zero, top, new Vector3(r.F(-0.03f, 0.03f), 0, 0.02f), 6), Taper(6, 0.04f, 0.016f), 8, Color.white);
            void Limb(Vector3 from, Vector3 dir, float len, float rad, int depth)
            {
                var end = from + dir * len;
                b.Tube(Curve(from, end, Vector3.up * len * 0.1f, 4), Taper(4, rad, rad * 0.45f), 6, Color.white);
                if (depth == 0) return;
                for (int k = 0; k < 2; k++)
                {
                    var nd = (dir + r.Sphere() * 0.7f + Vector3.up * 0.3f).normalized;
                    Limb(end, nd, len * r.F(0.5f, 0.7f), rad * 0.5f, depth - 1);
                }
            }
            int limbs = 2 + r.I(2);
            for (int i = 0; i < limbs; i++)
            {
                var d = (r.Sphere() * 0.8f + Vector3.up).normalized;
                Limb(Vector3.Lerp(Vector3.zero, top, r.F(0.55f, 1f)), d, r.F(0.16f, 0.24f), 0.016f, 2);
            }
            Put(root, b, deadWood, "wood");
            return root;
        }

        /** A saguaro: a ribbed column with an arm or two turned up; white flowers on top if in flower. */
        static GameObject Saguaro(string name, Rng r, bool flower)
        {
            var root = Hold(name);
            var b = new Mb();
            System.Func<float, float, float> ribs = (a, len) => 1 + 0.11f * Mathf.Pow(Mathf.Abs(Mathf.Cos(a * 7)), 3) - 0.05f;
            float H = r.F(0.72f, 0.8f), rad = 0.058f;
            var pts = Curve(Vector3.zero, new Vector3(0, H, 0), Vector3.zero, 12);
            var radii = new List<float>(); for (int i = 0; i <= 12; i++) { float t = i / 12f; radii.Add(rad * (t > 0.88f ? Mathf.Sqrt(Mathf.Max(0.04f, 1 - Mathf.Pow((t - 0.88f) / 0.12f, 2))) : 1)); }
            b.Tube(pts, radii, 20, Color.white, 0.7f, ribs);
            int arms = 1 + r.I(2);
            for (int k = 0; k < arms; k++)
            {
                float a = r.F(0, Mathf.PI * 2) + k * Mathf.PI;
                var d = new Vector3(Mathf.Cos(a), 0, Mathf.Sin(a));
                float y0 = r.F(0.3f, 0.45f), out_ = r.F(0.13f, 0.17f), up = r.F(0.18f, 0.28f);
                var ap = new List<Vector3>(); var ar = new List<float>();
                for (int i = 0; i <= 10; i++)
                {
                    float t = i / 10f;
                    // Out, then a bend, then up.
                    float x = out_ * Mathf.Sin(Mathf.Min(1, t * 1.6f) * Mathf.PI / 2), y = y0 + (t < 0.45f ? t * 0.08f : 0.036f + (t - 0.45f) / 0.55f * up);
                    ap.Add(d * x + Vector3.up * y);
                    ar.Add(rad * 0.72f * (t > 0.9f ? 0.7f : 1));
                }
                b.Tube(ap, ar, 16, Color.white, 0.7f, ribs);
            }
            Put(root, b, cactusSkin, "cactus");
            if (flower)
            {
                var fl = new Mb();
                for (int i = 0; i < 5; i++)
                {
                    float a = i * 1.25f;
                    var p = new Vector3(Mathf.Cos(a) * rad * 0.6f, H + 0.005f, Mathf.Sin(a) * rad * 0.6f);
                    fl.Card(p, (Vector3.up + ToEye * 0.5f).normalized, Vector3.forward, 0.045f, 0.045f, TwigCards[2], new Color(0.97f, 0.9f, 0.95f).linear, 1, Vector3.up);
                }
                Put(root, fl, leaflet, "flowers");
            }
            return root;
        }

        /** A barrel cactus: a ribbed ball, a little taller than wide. */
        static GameObject Barrel(string name, Rng r)
        {
            var root = Hold(name);
            var b = new Mb();
            float R0 = r.F(0.11f, 0.14f);
            var pts = new List<Vector3>(); var rad = new List<float>();
            for (int i = 0; i <= 12; i++) { float t = i / 12f; pts.Add(Vector3.up * (t * R0 * 2.1f)); rad.Add(R0 * Mathf.Max(0.12f, Mathf.Sin(Mathf.Lerp(0.25f, 1, t) * Mathf.PI))); }
            b.Tube(pts, rad, 24, Color.white, 0.6f, (a, len) => 1 + 0.09f * Mathf.Pow(Mathf.Abs(Mathf.Cos(a * 8)), 2) - 0.04f);
            Put(root, b, cactusSkin, "barrel");
            return root;
        }

        /** A rock: one of Poly Haven's, in the island's cool grey, as wide as the site's. */
        static GameObject Rock(string name, Rng r)
        {
            float[] widths = { 0.48f, 0.5f, 0.46f }, heights = { 0.28f, 0.45f, 0.32f };
            int v = name[name.Length - 1] - '0';
            var holder = new GameObject(name);
            RockModel(v % 3, widths[v % 3], heights[v % 3], r.F(0, 360)).transform.SetParent(holder.transform, false);
            return holder;
        }

        /** A rock out in the sea, its foot under the water (IslandBuild.Scene stands it a little below the surface). */
        static GameObject SeaRock(string name, Rng r)
        {
            var holder = new GameObject(name);
            RockModel(1, 0.62f, 0.5f, r.F(0, 360)).transform.SetParent(holder.transform, false);
            return holder;
        }

        /** A heap of boulders, big and small, as the site draws them, with a few stones round it. */
        static GameObject Boulders(string name, Rng r)
        {
            var holder = new GameObject(name);
            // The site's boulders: screen offsets (px) and radii, turned into tiles.
            foreach (var (dx, dy, rad) in new[] { (-8f, -1f, 7f), (6f, -3f, 9.5f), (-1f, 3f, 5.5f), (14f, 3f, 4f), (-15f, 4f, 1.6f), (19f, 5f, 1.6f), (2f, 8f, 1.4f) })
            {
                float ti = (dx / 32 + dy / 16) / 2, tj = (dy / 16 - dx / 32) / 2;
                float w = rad * 2 / IslandBuild.PxPerUnit * 1.15f;
                var go = RockModel(r.I(3), w, w * r.F(0.55f, 0.8f), r.F(0, 360));
                go.transform.SetParent(holder.transform, false);
                go.transform.localPosition += new Vector3(tj, 0, ti);
            }
            return holder;
        }

        /** One of the three rock models, w wide and h high, turned yaw degrees, its foot at the origin. */
        static GameObject RockModel(int which, float w, float h, float yaw)
        {
            string[] models = { "rock_07", "boulder_01", "namaqualand_boulder_02" };
            string m = models[which % 3];
            var name = m;

            var src = AssetDatabase.LoadAssetAtPath<GameObject>($"Assets/Island/Models/{m}/{m}.fbx");
            if (src == null) throw new FileNotFoundException($"Assets/Island/Models/{m}/{m}.fbx is missing: run node scripts/fetch-textures.mjs");
            var go = Object.Instantiate(src);
            go.name = name;
            if (!rockMats.TryGetValue(m, out var mat))
            {
                mat = new Material(Shader.Find("Island/Bark"));
                var diff = AssetDatabase.LoadAssetAtPath<Texture2D>($"Assets/Island/Models/{m}/textures/{m}_diff_1k.jpg");
                var nor = AssetDatabase.LoadAssetAtPath<Texture2D>($"Assets/Island/Models/{m}/textures/{m}_nor_gl_1k.exr");
                mat.SetTexture("_BaseMap", diff);
                mat.SetFloat("_Mean", diff != null && diff.isReadable ? Mean(diff) : 0.25f);
                mat.SetColor("_BaseColor", Hex("#9a9caa"));
                mat.SetFloat("_Detail", 1.1f);
                if (nor != null) { mat.SetTexture("_Normal", nor); mat.SetFloat("_HasNormal", 1); }
                rockMats[m] = mat;
            }
            foreach (var mr in go.GetComponentsInChildren<MeshRenderer>())
            {
                var mats = mr.sharedMaterials;
                for (int k = 0; k < mats.Length; k++) mats[k] = mat;
                mr.sharedMaterials = mats;
                mr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.On;
                mr.receiveShadows = true;
            }
            // As wide and tall as asked, standing on the ground (a little sunk into it), turned.
            var holder = new GameObject(name);
            go.transform.SetParent(holder.transform, false);
            go.transform.localRotation = Quaternion.Euler(0, yaw, 0) * go.transform.localRotation;
            var bb = Bounds(go);
            float sx = w / Mathf.Max(bb.size.x, bb.size.z), sy = h / bb.size.y;
            go.transform.localScale = Vector3.Scale(go.transform.localScale, new Vector3(sx, sy, sx));
            bb = Bounds(go);
            go.transform.position -= new Vector3(bb.center.x, bb.min.y + h * 0.08f, bb.center.z);
            return holder;
        }

        /** A band of the Badlands' soft rock: pale and darker layers by height, the same everywhere. */
        static Color Strata(float y, float seed)
        {
            float b = Mathf.Sin(y * 26 + seed) * 0.5f + 0.5f, fine = Mathf.Sin(y * 71 + seed * 2.3f) * 0.5f + 0.5f;
            var c = Color.Lerp(Hex("#7f788c"), Hex("#aaa2b4"), Mathf.SmoothStep(0, 1, b * 0.75f + fine * 0.25f));
            return c.linear;
        }

        /** A ring of vertices round the y axis at height y, radius rad(angle), coloured; returns its first index. */
        static int Ring(Mb b, float y, int sides, System.Func<float, float> rad, Color col, float ao, float vScale)
        {
            int k = b.v.Count;
            for (int s = 0; s <= sides; s++)
            {
                float a = s * Mathf.PI * 2 / sides;
                float rr = rad(a);
                var p = new Vector3(Mathf.Cos(a) * rr, y, Mathf.Sin(a) * rr);
                b.v.Add(p); var nrm = new Vector3(Mathf.Cos(a), 0, Mathf.Sin(a));
                b.n.Add(nrm); b.crown.Add(nrm);
                b.tan.Add(new Vector4(-Mathf.Sin(a), 0, Mathf.Cos(a), 1));
                // The photo at its own scale: about a tile and a half to a repeat, round and up.
                b.uv.Add(new Vector2((float)s / sides * Mathf.PI * 2 * rr * 1.6f, y * 1.6f));
                col.a = ao; b.c.Add(col);
            }
            return k;
        }
        static void Join(Mb b, int lo, int hi, int sides)
        {
            for (int s = 0; s < sides; s++) b.t.AddRange(new[] { lo + s, hi + s, lo + s + 1, lo + s + 1, hi + s, hi + s + 1 });
        }
        /** A lathe: rings up the y axis, their normals from the surface they make. */
        static Mesh Lathe(Mb b, string name)
        {
            var m = b.Mesh(name);
            m.RecalculateNormals();
            m.SetUVs(1, new List<Vector3>(m.normals));
            m.RecalculateTangents();
            return m;
        }
        static void PutMesh(GameObject parent, Mesh mesh, Material mat, string name)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent.transform, false);
            go.AddComponent<MeshFilter>().sharedMesh = mesh;
            var mr = go.AddComponent<MeshRenderer>();
            mr.sharedMaterial = mat;
            mr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.On;
            mr.receiveShadows = true;
        }

        /**
         * A hoodoo: a column of soft banded rock, wasting away unevenly, under a
         * cap of harder, darker rock that keeps it standing. h in the site's
         * height units, k its girth (1 is the site's widest).
         */
        static GameObject Hoodoo(string name, Rng r, float h, float k)
        {
            var root = Hold(name);
            float H = h / IslandBuild.PxPerHeight, w0 = 7.5f / IslandBuild.PxPerUnit * k * 1.1f, w1 = 3.8f / IslandBuild.PxPerUnit * k * 1.1f;
            float seed = r.F(0, 10), ph1 = r.F(0, 6), ph2 = r.F(0, 6);
            var b = new Mb();
            int sides = 22, rows = 30, prev = -1;
            for (int q = 0; q <= rows; q++)
            {
                float t = (float)q / rows, y = t * H;
                // Narrower as it rises, waisted where softer layers wear back, never round.
                float baseR = Mathf.Lerp(w0, w1, Mathf.Pow(t, 0.8f)) * (1 + 0.16f * Mathf.Sin(t * 13 + ph1) + 0.08f * Mathf.Sin(t * 29 + ph2));
                int row = Ring(b, y, sides, a => baseR * (1 + 0.1f * Mathf.Sin(a * 3 + ph1 + t * 2) + 0.06f * Mathf.Sin(a * 7 + ph2)), Strata(y, seed), Mathf.Lerp(0.55f, 1, Mathf.Clamp01(t * 3)), 1.2f);
                if (prev >= 0) Join(b, prev, row, sides);
                prev = row;
            }
            PutMesh(root, Lathe(b, "column"), softRock, "column");
            // The cap: a flat slab, overhanging, darker, its top lit.
            var cap = new Mb();
            float cr = w1 * 2.1f, ct = 0.05f * k + 0.02f;
            int c0 = Ring(cap, H - 0.01f, sides, a => cr * (0.75f + 0.12f * Mathf.Sin(a * 2 + seed)), Hex("#7f7787").linear, 0.8f, 2);
            int c1 = Ring(cap, H + ct * 0.6f, sides, a => cr * (1 + 0.1f * Mathf.Sin(a * 2 + seed) + 0.05f * Mathf.Sin(a * 5)), Hex("#8a8392").linear, 1, 2);
            int c2 = Ring(cap, H + ct, sides, a => cr * (0.85f + 0.1f * Mathf.Sin(a * 2 + seed)), Hex("#958e9d").linear, 1, 2);
            Join(cap, c0, c1, sides); Join(cap, c1, c2, sides);
            int mid = cap.v.Count;
            cap.v.Add(new Vector3(0, H + ct * 1.15f, 0)); cap.n.Add(Vector3.up); cap.crown.Add(Vector3.up); cap.tan.Add(new Vector4(1, 0, 0, 1)); cap.uv.Add(new Vector2(0.5f, 0.5f));
            var cc = Hex("#9c95a3").linear; cc.a = 1; cap.c.Add(cc);
            for (int s = 0; s < sides; s++) cap.t.AddRange(new[] { c2 + s, mid, c2 + s + 1 });
            PutMesh(root, Lathe(cap, "cap"), softRock, "cap");
            return root;
        }

        /**
         * A butte: a flat-topped hill of layered rock with cliff sides, standing
         * on a skirt of fallen stone, a little scrub on top. h in the site's
         * height units; as wide as the site's (0.36 of a tile each way at its
         * foot, 0.24 at its top).
         */
        static GameObject Butte(string name, Rng r, float h)
        {
            var root = Hold(name);
            float H = h / IslandBuild.PxPerHeight;
            float seed = r.F(0, 10), ph = r.F(0, 6);
            var b = new Mb();
            int sides = 40, rows = 26, prev = -1;
            // Squarish, as the site's is, with its corners worn round and its faces broken.
            System.Func<float, float, float> plan = (a, t) =>
            {
                float sq = 1 / Mathf.Max(Mathf.Abs(Mathf.Cos(a - Mathf.PI / 4)), Mathf.Abs(Mathf.Sin(a - Mathf.PI / 4)));
                float round = Mathf.Lerp(sq, 1.12f, 0.45f);
                return round * (1 + 0.05f * Mathf.Sin(a * 9 + ph + t * 3) + 0.04f * Mathf.Sin(a * 17 + seed));
            };
            for (int q = 0; q <= rows; q++)
            {
                float t = (float)q / rows, y = t * H;
                // A skirt of scree at the foot, then cliffs, stepped where harder layers jut out.
                float skirt = t < 0.22f ? Mathf.Lerp(1.45f, 1f, Mathf.SmoothStep(0, 1, t / 0.22f)) : 1;
                float step = 1 + 0.035f * Mathf.Round(Mathf.Sin(t * 9 + ph) * 2) / 2;
                float rr = Mathf.Lerp(0.36f, 0.25f, t) * skirt * step / 1.15f;
                int row = Ring(b, y, sides, a => rr * plan(a, t), Strata(y, seed), Mathf.Lerp(0.55f, 1, Mathf.Clamp01(t * 2.5f)), 1);
                if (prev >= 0) Join(b, prev, row, sides);
                prev = row;
            }
            // The flat top.
            int mid = b.v.Count;
            b.v.Add(new Vector3(0, H, 0)); b.n.Add(Vector3.up); b.crown.Add(Vector3.up); b.tan.Add(new Vector4(1, 0, 0, 1)); b.uv.Add(new Vector2(0.5f, 0.5f));
            var tc = Hex("#b0a7bd").linear; tc.a = 1; b.c.Add(tc);
            for (int s = 0; s < sides; s++) b.t.AddRange(new[] { prev + s, mid, prev + s + 1 });
            PutMesh(root, Lathe(b, "butte"), softRock, "butte");
            // Fallen stones round the foot.
            for (int i = 0; i < 9; i++)
            {
                float a = r.F(0, Mathf.PI * 2), d = r.F(0.38f, 0.5f);
                float w = r.F(0.05f, 0.11f);
                var st = RockModel(r.I(3), w, w * 0.6f, r.F(0, 360));
                st.transform.SetParent(root.transform, false);
                st.transform.localPosition += new Vector3(Mathf.Cos(a) * d, 0, Mathf.Sin(a) * d);
            }
            // Scrub on top.
            var scrub = new Mb();
            for (int i = 0; i < 26; i++)
            {
                var p = new Vector3(r.F(-0.15f, 0.15f), H + 0.015f, r.F(-0.15f, 0.15f));
                float s = r.F(0.03f, 0.05f);
                scrub.Card(p, (Vector3.up * 0.4f + ToEye + r.Sphere() * 0.3f).normalized, Vector3.up, s, s, TwigCards[r.I(TwigCards.Length)], Vary(r, Hex("#5d7a62")), 0.85f, Vector3.up);
            }
            Put(root, scrub, twig, "scrub");
            return root;
        }

        /** Cattails: a clump of tall blades and a few stems with their dark seed heads. */
        static GameObject Reeds(string name, Rng r)
        {
            var root = Hold(name);
            var blades = new Mb();
            var green = Hex("#4f7d5d");
            for (int i = 0; i < 34; i++)
            {
                float a = r.F(0, Mathf.PI * 2), d = r.F(0, 0.07f);
                var foot = new Vector3(Mathf.Cos(a) * d, 0, Mathf.Sin(a) * d);
                float hgt = r.F(0.22f, 0.42f);
                var lean = new Vector3(Mathf.Cos(a), 0, Mathf.Sin(a)) * r.F(0.02f, 0.09f);
                var up = (Vector3.up * hgt + lean).normalized;
                var face = (Vector3.Cross(up, new Vector3(-Mathf.Sin(a), 0, Mathf.Cos(a))) + ToEye * 0.4f).normalized;
                blades.Card(foot + up * hgt * 0.5f, face, up, 0.022f, hgt, LeafletCards[r.I(LeafletCards.Length)], Vary(r, green, 0.12f), 0.85f, (up + Vector3.up).normalized);
            }
            Put(root, blades, leaflet, "blades");
            var heads = new Mb();
            var stem = new Mb();
            for (int i = 0; i < 5; i++)
            {
                float a = r.F(0, Mathf.PI * 2), d = r.F(0, 0.05f);
                var foot = new Vector3(Mathf.Cos(a) * d, 0, Mathf.Sin(a) * d);
                float hgt = r.F(0.42f, 0.56f);
                var top = foot + Vector3.up * hgt + new Vector3(Mathf.Cos(a), 0, Mathf.Sin(a)) * r.F(0.01f, 0.05f);
                stem.Tube(Curve(foot, top, Vector3.zero, 3), Taper(3, 0.006f, 0.004f), 5, Hex("#55785c").linear);
                var dir = (top - foot).normalized;
                heads.Tube(Curve(top - dir * 0.13f, top - dir * 0.02f, Vector3.zero, 3), new List<float> { 0.012f, 0.019f, 0.019f, 0.012f }, 8, Color.white);
            }
            Put(root, stem, cactusSkin, "stems");
            Put(root, heads, reedHead, "heads");
            return root;
        }


        static Bounds Bounds(GameObject go)
        {
            var rs = go.GetComponentsInChildren<Renderer>();
            var b = rs[0].bounds;
            foreach (var x in rs) b.Encapsulate(x.bounds);
            return b;
        }
    }
}
