// The buildings in 3D, from the solids the site draws them with
// (lib/island/kit.ts, Solids): every box, roof, cylinder, dome, window and
// door, written down in the world's units and in runs (the solids drawn one
// after another). Each run is built here as real geometry in real materials
// (Building.shader) and rendered on its own, with the rest of its building
// there only to cast shadows on it; scripts/unity-buildings.mjs gives the
// site a picture of each run, which it draws where the run began, so what the
// site draws by hand between two runs (signs, people, wheels) stays between
// them, as before.
//
// Colours are the site's, made real: a little less saturated, as paint in
// daylight is, and each surface given the material its colour and shape say
// it is (white walls plaster, a pitched roof tiles, a pyramid slate, a dome
// metal, pale blue glass).
using System;
using System.Collections.Generic;
using System.IO;
using UnityEngine;

namespace Island
{
    [Serializable] public class SolidBox { public float x, y, w, d, z0, h; }
    [Serializable]
    public class SolidRec
    {
        public string k, fill, top, side, trim, face, axis, pane, frame, name;
        public float x, y, w, d, z0, h, z, cx, cy, r, u, u0, u1, z1, over, gap, wide, dx, dy, half;
        public float @out;
        public int rows, cols;
        public SolidBox b;
        public float[] pts, bandZ;
        /** Artwork printed on a model (kit.ts, print), by name: Prints.cs. */
        public string[] prints;
        /** Where a plaque's posts stand (site height); not a number when it has none. */
        public float foot = float.NaN;
        public string[] bandC, colours;
    }
    [Serializable] public class SolidRun { public string[] items; }
    /** A building's solids; a set piece (the site's HERO) is built k times bigger about `at` (tile i, j, site height z). */
    [Serializable] public class BuildingSolids { public string slug; public SolidRun[] runs; public float k; public float[] at; }

    public static partial class Buildings
    {
        /* ---- set pieces: built bigger about the front corner of their plot ---- */

        /** The building being built's scale and the point it is about (world units), set by Prepare. */
        static float heroK = 1; static Vector3 heroAt;
        static void HeroOf(BuildingSolids bs)
        {
            heroK = bs.k > 0 ? bs.k : 1;
            heroAt = bs.at != null && bs.at.Length == 3 ? new Vector3(bs.at[1], IslandBuild.Y(bs.at[2]), bs.at[0]) : Vector3.zero;
        }
        /** Where a point of the building being built ends up. */
        public static Vector3 HeroPt(Vector3 p) => heroK == 1 ? p : heroAt + (p - heroAt) * heroK;
        /** A run of a building, put where it stands: a set piece's grown about its point. */
        public static void Hero(GameObject go, BuildingSolids bs)
        {
            float k = bs.k > 0 ? bs.k : 1;
            if (k == 1 || bs.at == null || bs.at.Length != 3) return;
            var a = new Vector3(bs.at[1], IslandBuild.Y(bs.at[2]), bs.at[0]);
            go.transform.localPosition = a * (1 - k);
            go.transform.localScale = Vector3.one * k;
        }
        /** The same on the site's map (P()'s units): a box round a piece that turns, for its picture. */
        public static Rect HeroBox(Rect r, BuildingSolids bs)
        {
            float k = bs.k > 0 ? bs.k : 1;
            if (k == 1 || bs.at == null || bs.at.Length != 3) return r;
            float ax = (bs.at[0] - bs.at[1]) * 32, ay = (bs.at[0] + bs.at[1]) * 16 - bs.at[2];
            return Rect.MinMaxRect(ax + (r.xMin - ax) * k, ay + (r.yMin - ay) * k, ax + (r.xMax - ax) * k, ay + (r.yMax - ay) * k);
        }
        /** A footprint (j0, i0, j1, i1), or a round one (j, i, r, -1), of a set piece where it stands. */
        public static Vector4 HeroFoot(Vector4 v, BuildingSolids bs)
        {
            float k = bs.k > 0 ? bs.k : 1;
            if (k == 1 || bs.at == null || bs.at.Length != 3) return v;
            float aj = bs.at[1], ai = bs.at[0];
            return v.w < 0 ? new Vector4(aj + (v.x - aj) * k, ai + (v.y - ai) * k, v.z * k, -1) : new Vector4(aj + (v.x - aj) * k, ai + (v.y - ai) * k, aj + (v.z - aj) * k, ai + (v.w - ai) * k);
        }

        public const int Plaster = 0, Brick = 1, Tiles = 2, Slate = 3, Timber = 4, Metal = 5, Glass = 6, Concrete = 7, Paint = 8, Cloth = 9, Pane = 10, Printed = 11;
        static Material mat;
        public static Material Mat => mat != null ? mat : (mat = NewMat());

        /** The material, dressed in the wall photographs (Photos.Walls): how many times each repeats in a world unit (about 5 m: a door is 2). */
        static Material NewMat()
        {
            var m = new Material(Shader.Find("Island/Building"));
            if (Photos.WallColour == null) Photos.LoadWalls();
            m.SetTexture("_WallColour", Photos.WallColour);
            m.SetTexture("_WallNormal", Photos.WallNormal);
            m.SetVectorArray("_WallMean", Photos.WallMeans);
            var rep = new float[16];
            for (int i = 0; i < Photos.WallMetres.Length; i++) rep[i] = MetresPerUnit / Photos.WallMetres[i];
            m.SetFloatArray("_WallRep", rep);
            Prints.Load();
            if (Prints.Sheet != null) m.SetTexture("_Prints", Prints.Sheet);
            return m;
        }
        /** A world unit in metres: the site's doors are 16 px (0.41 of a unit) tall, a door is 2 m. */
        public const float MetresPerUnit = 5f;

        /** A site point (tile i, j; height z) in the world. */
        static Vector3 W(float i, float j, float z) => new Vector3(j, z / IslandBuild.PxPerHeight, i);
        static float Hy(float z) => z / IslandBuild.PxPerHeight;

        class Bm
        {
            public readonly List<Vector3> v = new(), n = new();
            public readonly List<Vector4> tan = new();
            public readonly List<Color> c = new();
            public readonly List<Vector2> uv = new(), m = new();
            public readonly List<int> t = new();

            /** A quad a (bottom left), b (bottom right), cc (top right), d (top left), seen from its front; its pattern in world units from a. */
            public void Quad(Vector3 a, Vector3 b, Vector3 cc, Vector3 d, Color col, int material, float aoBottom = 1, float aoTop = 1) => QuadAt(a, b, cc, d, col, material, aoBottom, aoTop, a);
            /** The same, its pattern measured from o (a point in its plane): the pieces of one wall, cut round its windows, carry one pattern on. */
            public void QuadAt(Vector3 a, Vector3 b, Vector3 cc, Vector3 d, Color col, int material, float aoBottom, float aoTop, Vector3 o)
            {
                // From the diagonals: sound even where two corners meet (a quad at a sphere's pole is a triangle).
                var nrm = Unit(Vector3.Cross(cc - a, d - b));
                if (nrm.sqrMagnitude < 0.5f) nrm = Unit(Vector3.Cross(b - a, d - a));
                var across = (b - a); float lu = across.magnitude;
                // Where a and b meet (a quad at a sphere's pole), the top edge gives the direction instead: never a zero tangent.
                if (lu < 1e-6f) { across = cc - d; lu = across.magnitude; }
                if (lu < 1e-6f) { across = Vector3.Cross(nrm, Mathf.Abs(nrm.y) < 0.9f ? Vector3.up : Vector3.right); lu = across.magnitude; }
                across /= Mathf.Max(lu, 1e-6f);
                var upn = Unit(Vector3.Cross(nrm, across));
                if (Vector3.Dot(upn, d - a) < 0) upn = -upn;
                int k = v.Count;
                v.AddRange(new[] { a, b, cc, d });
                foreach (var p in new[] { a, b, cc, d }) uv.Add(new Vector2(Vector3.Dot(p - o, across), Vector3.Dot(p - o, upn)));
                float seed = Seed(o); for (int q = 0; q < 4; q++) { n.Add(nrm); tan.Add(new Vector4(across.x, across.y, across.z, 1)); m.Add(new Vector2(material, seed)); }
                var cb = col; cb.a = aoBottom; var ct = col; ct.a = aoTop;
                c.Add(cb); c.Add(cb); c.Add(ct); c.Add(ct);
                t.AddRange(new[] { k, k + 2, k + 1, k, k + 3, k + 2 });
            }
            /** A quad whose pattern runs 0..1 across it and up it (a window's pane), with a seed of its own. */
            public void QuadUnit(Vector3 a, Vector3 b, Vector3 cc, Vector3 d, Color col, int material, float seed)
            {
                // From the diagonals: sound even where two corners meet (a quad at a sphere's pole is a triangle).
                var nrm = Unit(Vector3.Cross(cc - a, d - b));
                if (nrm.sqrMagnitude < 0.5f) nrm = Unit(Vector3.Cross(b - a, d - a));
                var across = Unit(b - a);
                int k = v.Count;
                v.AddRange(new[] { a, b, cc, d });
                uv.Add(new Vector2(0, 0)); uv.Add(new Vector2(1, 0)); uv.Add(new Vector2(1, 1)); uv.Add(new Vector2(0, 1));
                for (int q = 0; q < 4; q++) { n.Add(nrm); tan.Add(new Vector4(across.x, across.y, across.z, 1)); m.Add(new Vector2(material, seed)); }
                var c1 = col; c1.a = 1;
                c.Add(c1); c.Add(c1); c.Add(c1); c.Add(c1);
                t.AddRange(new[] { k, k + 2, k + 1, k, k + 3, k + 2 });
            }
            /** A quad with its texture coordinates given: from uv0 at a (bottom left) to uv1 at cc (top right). A print on a face. */
            public void QuadUV(Vector3 a, Vector3 b, Vector3 cc, Vector3 d, Color col, int material, Vector2 uv0, Vector2 uv1)
            {
                var nrm = Unit(Vector3.Cross(cc - a, d - b));
                if (nrm.sqrMagnitude < 0.5f) nrm = Unit(Vector3.Cross(b - a, d - a));
                var across = Unit(b - a);
                int k = v.Count;
                v.AddRange(new[] { a, b, cc, d });
                uv.Add(uv0); uv.Add(new Vector2(uv1.x, uv0.y)); uv.Add(uv1); uv.Add(new Vector2(uv0.x, uv1.y));
                for (int q = 0; q < 4; q++) { n.Add(nrm); tan.Add(new Vector4(across.x, across.y, across.z, 1)); m.Add(new Vector2(material, 0.5f)); var c1 = col; c1.a = 1; c.Add(c1); }
                t.AddRange(new[] { k, k + 2, k + 1, k, k + 3, k + 2 });
            }
            /** A quad with a colour at each corner (blended across it): a painted sphere. */
            public void QuadColours(Vector3 a, Vector3 b, Vector3 cc, Vector3 d, Color ca, Color cb, Color ccol, Color cd, int material)
            {
                int k0 = v.Count;
                Quad(a, b, cc, d, ca, material);
                ca.a = 1; cb.a = 1; ccol.a = 1; cd.a = 1;
                c[k0] = ca; c[k0 + 1] = cb; c[k0 + 2] = ccol; c[k0 + 3] = cd;
            }
            public void Tri(Vector3 a, Vector3 b, Vector3 cc, Color col, int material)
            {
                var nrm = Unit(Vector3.Cross(b - a, cc - a));
                var across = Unit(b - a); var up = Vector3.Cross(nrm, across);
                int k = v.Count;
                v.AddRange(new[] { a, b, cc });
                foreach (var p in new[] { a, b, cc }) uv.Add(new Vector2(Vector3.Dot(p - a, across), Vector3.Dot(p - a, up)));
                float seed = Seed(a); for (int q = 0; q < 3; q++) { n.Add(nrm); tan.Add(new Vector4(across.x, across.y, across.z, 1)); m.Add(new Vector2(material, seed)); var cc2 = col; cc2.a = 1; c.Add(cc2); }
                t.AddRange(new[] { k, k + 2, k + 1 });
            }
            /**
             * A direction of length one, however short the vector: Unity's .normalized gives
             * zero below 1e-5, which is every face of a small thing (a flower, a lamp's globe,
             * a person's ear), whose edges' cross product is far smaller than that.
             */
            public static Vector3 Unit(Vector3 v)
            {
                double x = v.x, y = v.y, z = v.z, m = System.Math.Sqrt(x * x + y * y + z * z);
                return m > 1e-30 ? new Vector3((float)(x / m), (float)(y / m), (float)(z / m)) : Vector3.zero;
            }
            /** Where in its photograph a face starts (0..1), so that no two walls show the same patch. */
            static float Seed(Vector3 a) { float h = Mathf.Sin(a.x * 12.9898f + a.y * 78.233f + a.z * 37.719f) * 43758.5453f; return h - Mathf.Floor(h); }
            /**
             * Auto-smooth: where faces meet at less than limit degrees (round a
             * cylinder, over a dome), their shared corners take one normal, the
             * average, so the surface reads as curved and not cut in facets; a sharper
             * edge (a box's corner, a roof's ridge) stays crisp.
             */
            void Smooth(float limit = 35)
            {
                float cos = Mathf.Cos(limit * Mathf.Deg2Rad);
                var at = new Dictionary<Vector3Int, List<int>>();
                for (int i = 0; i < v.Count; i++)
                {
                    var key = Vector3Int.RoundToInt(v[i] * 2000);
                    if (!at.TryGetValue(key, out var l)) at[key] = l = new List<int>();
                    l.Add(i);
                }
                var outN = new Vector3[v.Count];
                foreach (var l in at.Values)
                    foreach (var i in l)
                    {
                        var sum = Vector3.zero;
                        foreach (var j in l) if (Vector3.Dot(n[i], n[j]) >= cos) sum += n[j];
                        outN[i] = sum.sqrMagnitude > 1e-24f ? Unit(sum) : n[i];
                    }
                for (int i = 0; i < v.Count; i++) n[i] = outN[i];
            }
            /** Everything another builder has, added to this one's. */
            public void Append(Bm o)
            {
                int k0 = v.Count;
                v.AddRange(o.v); n.AddRange(o.n); tan.AddRange(o.tan); c.AddRange(o.c); uv.AddRange(o.uv); m.AddRange(o.m);
                foreach (var i in o.t) t.Add(i + k0);
            }
            /** Move, turn and scale everything built so far. */
            public void Apply(Matrix4x4 mx)
            {
                for (int i = 0; i < v.Count; i++)
                {
                    v[i] = mx.MultiplyPoint3x4(v[i]);
                    n[i] = Unit(mx.MultiplyVector(n[i]));
                    var t3 = Unit(mx.MultiplyVector(new Vector3(tan[i].x, tan[i].y, tan[i].z)));
                    tan[i] = new Vector4(t3.x, t3.y, t3.z, tan[i].w);
                }
            }
            /** Flatten onto the ground along a direction (towards the sun): a shadow's shape. */
            public void Flatten(Vector3 toSun)
            {
                for (int i = 0; i < v.Count; i++) { var p = v[i]; v[i] = new Vector3(p.x - toSun.x * p.y / toSun.y, 0.0005f, p.z - toSun.z * p.y / toSun.y); n[i] = Vector3.up; c[i] = Color.black; }
            }
            public Mesh Mesh(string name)
            {
                Smooth();
                var mesh = new Mesh { name = name, indexFormat = UnityEngine.Rendering.IndexFormat.UInt32 };
                mesh.SetVertices(v); mesh.SetNormals(n); mesh.SetTangents(tan); mesh.SetColors(c); mesh.SetUVs(0, uv); mesh.SetUVs(1, m); mesh.SetTriangles(t, 0);
                mesh.RecalculateBounds();
                return mesh;
            }
        }

        /* ---- colour and material ---------------------------------------------- */

        static Color Hex(string h) { if (string.IsNullOrEmpty(h) || !ColorUtility.TryParseHtmlString(h, out var c)) c = Color.white; return c; }
        /** The site's colour as a real surface's: less saturated, never quite white or black; linear. */
        /**
         * The site's colour for a thing, as what it is made of really looks. The site paints in a
         * cartoon's pastels; a real town is whitewash and limestone, terracotta and slate, timber,
         * copper gone green, and paint. So walls and roofs are read for what they stand for (a pale
         * wall is render or stone, a pink roof terracotta, a lilac one slate, the lilac "wood" timber),
         * and paint and cloth keep their colour, as strong as real paint is.
         */
        static Color Real(string hex, int material) => RealSrgb(hex, material).linear;
        static Color RealSrgb(string hex, int material)
        {
            var c = Hex(hex);
            Color.RGBToHSV(c, out var hh, out var s, out var v);
            float deg = hh * 360;
            Color H(float d, float sat, float val) => Color.HSVToRGB(((d % 360) + 360) % 360 / 360f, Mathf.Clamp01(sat), Mathf.Clamp(val, 0.04f, 0.92f));
            // A steady pick for each colour, so the same paint is the same stone everywhere.
            int pick = 0; foreach (var ch in hex.ToLowerInvariant()) pick = pick * 31 + ch; pick &= 0x7fffffff;
            switch (material)
            {
                case Plaster: case Concrete: case Brick:
                {
                    if (s < 0.12f && v > 0.9f)
                        // White: lime-washed render, or pale limestone.
                        return material == Concrete ? H(38, 0.07f, 0.84f) : (pick % 3 == 0 ? H(40, 0.1f, 0.9f) : H(36, 0.06f, 0.92f));
                    if (s < 0.32f && v > 0.6f)
                    {
                        // Pale tinted greys: dressed stone and render in their quiet colours.
                        var stones = new[] { H(38, 0.16f, 0.8f), H(30, 0.12f, 0.74f), H(210, 0.08f, 0.76f), H(45, 0.2f, 0.84f), H(200, 0.06f, 0.82f) };
                        var st = stones[pick % stones.Length];
                        return Color.Lerp(st, H(deg, s * 0.5f, v * 0.85f), 0.25f);
                    }
                    if (v < 0.35f) return H(deg, s * 0.35f, v * 0.85f);
                    // A coloured wall: painted render, the colour kept but weathered.
                    return H(deg, s * 0.55f, Mathf.Min(v * 0.8f, 0.78f));
                }
                case Timber:
                    // The site's lilac wood is wood; other colours are painted boards.
                    if (deg > 225 && deg < 290 && s < 0.5f) return H(26 + (pick % 7), 0.42f, 0.42f + 0.12f * v);
                    return H(deg, s * 0.6f, v * 0.72f);
                case Tiles: case Slate:
                {
                    float shade = 0.85f + 0.15f * v;
                    if (s < 0.15f) return H(215, 0.08f, 0.5f * shade);                                     // lead and grey slate
                    if (deg >= 320 || deg < 25) return H(6 + (pick % 5), 0.5f, 0.52f * shade);             // terracotta
                    if (deg >= 25 && deg < 70) return H(30, 0.45f, 0.62f * shade);                          // old clay
                    if (deg >= 140 && deg < 200) return H(166, 0.36f, 0.56f * shade);                      // copper gone green
                    if (deg >= 200 && deg < 235 && s > 0.45f) return H(214, 0.3f, 0.44f * shade);          // blue-black slate
                    return H(222 + (pick % 9), 0.2f, 0.5f * shade);                                         // slate
                }
                case Metal:
                    return H(deg, s * 0.4f, Mathf.Clamp(v * 0.82f, 0.1f, 0.8f));
                case Glass:
                    return H(deg, s * 0.5f, Mathf.Clamp(v * 0.93f, 0.08f, 0.9f));
                default:
                    // Paint, cloth, skin: the colour as paint and dye really give it.
                    return H(deg, s * 0.82f, Mathf.Clamp(v * 0.9f, 0.06f, 0.88f));
            }
        }
        static bool Is(string hex, params string[] any) { foreach (var a in any) if (string.Equals(hex, a, StringComparison.OrdinalIgnoreCase)) return true; return false; }
        /** What a wall of this colour is made of. */
        static int WallOf(string hex)
        {
            if (Is(hex, "#9fd4ff", "#d8eeff", "#8ccbff")) return Glass;
            if (Is(hex, "#9b8bd6")) return Timber;
            if (Is(hex, "#d5d9ea", "#c3c8de", "#eef1fa", "#f4f6fc")) return Concrete;
            if (Is(hex, "#2c355e", "#1b2340")) return Metal;
            return Plaster;
        }
        static int PanelOf(string hex) => Is(hex, "#9fd4ff", "#d8eeff", "#8ccbff", "#2c355e") ? Glass : Paint;

        /* ---- the solids ------------------------------------------------------- */

        const float Off = 0.004f;

        static void Add(Bm b, SolidRec s)
        {
            switch (s.k)
            {
                case "box": BoxDetailed(b, s); break;
                case "band": Band(b, s.b, s.z0, s.z1, s.fill); break;
                case "quad": Panel(b, s.b, s.face, s.u0, s.u1, s.z0, s.z1, Real(s.fill, PanelOf(s.fill)), PanelOf(s.fill), Off); break;
                case "win": if (HolesOf(s.b) != null) WindowsDetailed(b, s); else Windows(b, s); break;
                case "door": if (HolesOf(s.b) != null) DoorDetailed(b, s); else Door(b, s); break;
                case "awning": Awning(b, s); break;
                case "gable": Gable(b, s); GableDetail(b, s); break;
                case "pyramid": Pyramid(b, s); PyramidDetail(b, s); break;
                case "cyl": Cyl(b, s); break;
                case "cone": Cone(b, s); break;
                case "dome": Dome(b, s); break;
                case "sphere": Sphere(b, s); break;
                case "disc": Disc(b, s); break;
                case "poly": Poly(b, s); break;
                case "rod": Rod(b, s); break;
                case "model": Model(b, s); break;
            }
        }

        static void Box(Bm b, SolidRec s)
        {
            float i0 = s.x, j0 = s.y, i1 = s.x + s.w, j1 = s.y + s.d, z0 = s.z0, z1 = s.z0 + s.h;
            int wm = WallOf(s.fill);
            var col = Real(s.fill, wm);
            float ao0 = z0 <= 1 ? 0.62f : 0.85f;
            // The four walls, each seen from outside.
            b.Quad(W(i1, j0, z0), W(i1, j1, z0), W(i1, j1, z1), W(i1, j0, z1), col, wm, ao0);    // +i (the site's face 'x')
            b.Quad(W(i1, j1, z0), W(i0, j1, z0), W(i0, j1, z1), W(i1, j1, z1), col, wm, ao0);    // +j (face 'y')
            b.Quad(W(i0, j1, z0), W(i0, j0, z0), W(i0, j0, z1), W(i0, j1, z1), col, wm, ao0);
            b.Quad(W(i0, j0, z0), W(i1, j0, z0), W(i1, j0, z1), W(i0, j0, z1), col, wm, ao0);
            // The top: a flat roof, or a floor, or a plinth's top.
            int tm = wm == Glass ? Glass : Concrete;
            b.Quad(W(i0, j0, z1), W(i1, j0, z1), W(i1, j1, z1), W(i0, j1, z1), Real(s.top ?? s.fill, tm), tm);
            if (!string.IsNullOrEmpty(s.trim)) Band(b, new SolidBox { x = s.x, y = s.y, w = s.w, d = s.d, z0 = s.z0, h = s.h }, s.h - 3, s.h, s.trim, 0.012f);
        }

        /** A band round a box: a cornice or a string course, standing a little proud of the wall. */
        static void Band(Bm b, SolidBox x, float z0, float z1, string fill, float proud = 0.007f)
        {
            float i0 = x.x - proud, j0 = x.y - proud, i1 = x.x + x.w + proud, j1 = x.y + x.d + proud;
            float Z0 = x.z0 + z0, Z1 = x.z0 + z1;
            var col = Real(fill, Paint);
            b.Quad(W(i1, j0, Z0), W(i1, j1, Z0), W(i1, j1, Z1), W(i1, j0, Z1), col, Paint);
            b.Quad(W(i1, j1, Z0), W(i0, j1, Z0), W(i0, j1, Z1), W(i1, j1, Z1), col, Paint);
            b.Quad(W(i0, j1, Z0), W(i0, j0, Z0), W(i0, j0, Z1), W(i0, j1, Z1), col, Paint);
            b.Quad(W(i0, j0, Z0), W(i1, j0, Z0), W(i1, j0, Z1), W(i0, j0, Z1), col, Paint);
            b.Quad(W(i0, j0, Z1), W(i1, j0, Z1), W(i1, j1, Z1), W(i0, j1, Z1), col, Paint);
        }

        /** A rectangle on a box's face ('x': the +i face, along j; 'y': the +j face, along i), u in 0..1 along it, z up from the box's foot, `off` out from the wall. */
        static void Panel(Bm b, SolidBox x, string face, float u0, float u1, float z0, float z1, Color col, int material, float off, float aoBottom = 1)
        {
            float Z0 = x.z0 + z0, Z1 = x.z0 + z1;
            if (face == "x")
            {
                float i = x.x + x.w + off, ja = x.y + u0 * x.d, jb = x.y + u1 * x.d;
                b.Quad(W(i, ja, Z0), W(i, jb, Z0), W(i, jb, Z1), W(i, ja, Z1), col, material, aoBottom);
            }
            else
            {
                float j = x.y + x.d + off, ia = x.x + u0 * x.w, ib = x.x + u1 * x.w;
                b.Quad(W(ib, j, Z0), W(ia, j, Z0), W(ia, j, Z1), W(ib, j, Z1), col, material, aoBottom);
            }
        }
        /** A small block standing out from a face (a sill, a step, a frame's edge): its front and top. */
        static void Ledge(Bm b, SolidBox x, string face, float u0, float u1, float z0, float z1, float depth, Color col, int material)
        {
            Panel(b, x, face, u0, u1, z0, z1, col, material, depth);
            float Z = x.z0 + z1;
            if (face == "x")
            {
                float i = x.x + x.w, ja = x.y + u0 * x.d, jb = x.y + u1 * x.d;
                b.Quad(W(i, ja, Z), W(i + depth, ja, Z), W(i + depth, jb, Z), W(i, jb, Z), col, material);
            }
            else
            {
                float j = x.y + x.d, ia = x.x + u0 * x.w, ib = x.x + u1 * x.w;
                b.Quad(W(ib, j, Z), W(ib, j + depth, Z), W(ia, j + depth, Z), W(ia, j, Z), col, material);
            }
        }

        /** Windows: a frame, the glass set back in it, glazing bars, a stone sill. */
        static void Windows(Bm b, SolidRec s)
        {
            float len = s.face == "x" ? s.b.d : s.b.w;
            float slot = 1f / s.cols, ww = slot * s.wide;
            var frame = Real(s.frame, Paint);
            var glass = Real(s.pane, Glass);
            var sill = Real("#d5d9ea", Concrete);
            float bar = 0.007f / Mathf.Max(len, 0.05f);
            for (int r = 0; r < s.rows; r++)
                for (int c = 0; c < s.cols; c++)
                {
                    float u = slot * (c + 0.5f), z = s.z0 + r * (s.h + s.gap);
                    float fu = 1.6f / (64 * len);
                    Panel(b, s.b, s.face, u - ww / 2 - fu, u + ww / 2 + fu, z - 1.5f, z + s.h + 1.5f, frame, Paint, Off);
                    // The pane: a room behind it, as in a window set in a wall (and lit at night).
                    float ua = s.face == "x" ? u - ww / 2 : u + ww / 2, ub = s.face == "x" ? u + ww / 2 : u - ww / 2, o = Off + 0.002f;
                    b.QuadUnit(On(s.b, s.face, ua, z, o), On(s.b, s.face, ub, z, o), On(s.b, s.face, ub, z + s.h, o), On(s.b, s.face, ua, z + s.h, o), glass, Pane, PaneSeed(s, u, z, H(s.b.x + u * 7.3f, s.b.y + z * 0.37f, r * 3 + c)));
                    // Glazing bars: one down the middle, one across a little above it.
                    Panel(b, s.b, s.face, u - bar, u + bar, z, z + s.h, frame, Paint, Off + 0.004f);
                    Panel(b, s.b, s.face, u - ww / 2, u + ww / 2, z + s.h * 0.58f - 0.5f, z + s.h * 0.58f + 0.5f, frame, Paint, Off + 0.004f);
                    Ledge(b, s.b, s.face, u - ww / 2 - fu * 2, u + ww / 2 + fu * 2, z - 2.8f, z - 1.2f, 0.016f, sill, Concrete);
                }
        }

        /** A door: a frame, a panelled leaf in its colour, a fanlight, a step. */
        static void Door(Bm b, SolidRec s)
        {
            float len = s.face == "x" ? s.b.d : s.b.w;
            float w = s.w / len, edge = 0.02f / len;
            Panel(b, s.b, s.face, s.u - w / 2 - edge, s.u + w / 2 + edge, 0, s.h + 2, Real("#f4f6fc", Paint), Paint, Off);
            Panel(b, s.b, s.face, s.u - w / 2, s.u + w / 2, 0, s.h * 0.78f, Real(s.fill, Paint), Timber, Off + 0.002f, 0.7f);
            Panel(b, s.b, s.face, s.u - w / 2, s.u + w / 2, s.h * 0.8f, s.h, Real("#9fd4ff", Glass), Glass, Off + 0.002f);
            Ledge(b, s.b, s.face, s.u - w / 2 - edge * 2, s.u + w / 2 + edge * 2, -0.5f, 1.2f, 0.035f, Real("#c3c8de", Concrete), Concrete);
        }

        /** A striped awning, sloping out and down from a face. */
        static void Awning(Bm b, SolidRec s)
        {
            int n = s.colours.Length * 2;
            float Z = s.b.z0 + s.z;
            for (int k = 0; k < n; k++)
            {
                float a = s.u0 + (s.u1 - s.u0) * k / n, c = s.u0 + (s.u1 - s.u0) * (k + 1) / n;
                var col = Real(s.colours[k % s.colours.Length], Cloth);
                if (s.face == "y")
                {
                    float j = s.b.y + s.b.d;
                    float ia = s.b.x + a * s.b.w, ic = s.b.x + c * s.b.w;
                    b.Quad(W(ic, j + s.@out, Z - 7), W(ia, j + s.@out, Z - 7), W(ia, j, Z), W(ic, j, Z), col, Cloth);
                }
                else
                {
                    float i = s.b.x + s.b.w;
                    float ja = s.b.y + a * s.b.d, jc = s.b.y + c * s.b.d;
                    b.Quad(W(i + s.@out, ja, Z - 7), W(i + s.@out, jc, Z - 7), W(i, jc, Z), W(i, ja, Z), col, Cloth);
                }
            }
        }

        /** A pitched roof: two slopes of tiles overhanging the walls, fascia boards along the eaves, the gable ends walled. */
        static void Gable(Bm b, SolidRec s)
        {
            float e = s.over;
            float x = s.x - e, y = s.y - e, w = s.w + e * 2, d = s.d + e * 2, z = s.z, h = s.h;
            var roof = Real(s.fill, Tiles);
            var end = Real("#eceef4", Plaster);
            var fascia = Real("#f4f6fc", Paint);
            float drop = 2.2f;
            if (s.axis == "x")
            {
                float my = y + d / 2;
                // The slopes, from each eave up to the ridge (pattern up the slope).
                b.Quad(W(x + w, y + d, z), W(x, y + d, z), W(x, my, z + h), W(x + w, my, z + h), roof, Tiles, 0.85f);
                b.Quad(W(x, y, z), W(x + w, y, z), W(x + w, my, z + h), W(x, my, z + h), roof, Tiles, 0.85f);
                // The gable ends, inside the overhang.
                b.Tri(W(x + w - e, y + e, z), W(x + w - e, y + d - e, z), W(x + w - e, my, z + h - 1), end, Plaster);
                b.Tri(W(x + e, y + d - e, z), W(x + e, y + e, z), W(x + e, my, z + h - 1), end, Plaster);
                // Fascia boards along both eaves.
                b.Quad(W(x + w, y + d, z - drop), W(x, y + d, z - drop), W(x, y + d, z), W(x + w, y + d, z), fascia, Paint);
                b.Quad(W(x, y, z - drop), W(x + w, y, z - drop), W(x + w, y, z), W(x, y, z), fascia, Paint);
                // Barge boards up the gable ends.
                b.Quad(W(x + w, y, z - drop), W(x + w, my, z + h - drop), W(x + w, my, z + h), W(x + w, y, z), fascia, Paint);
                b.Quad(W(x + w, my, z + h - drop), W(x + w, y + d, z - drop), W(x + w, y + d, z), W(x + w, my, z + h), fascia, Paint);
            }
            else
            {
                float mx = x + w / 2;
                b.Quad(W(x + w, y, z), W(x + w, y + d, z), W(mx, y + d, z + h), W(mx, y, z + h), roof, Tiles, 0.85f);
                b.Quad(W(x, y + d, z), W(x, y, z), W(mx, y, z + h), W(mx, y + d, z + h), roof, Tiles, 0.85f);
                b.Tri(W(x + w - e, y + d - e, z), W(x + e, y + d - e, z), W(mx, y + d - e, z + h - 1), end, Plaster);
                b.Tri(W(x + e, y + e, z), W(x + w - e, y + e, z), W(mx, y + e, z + h - 1), end, Plaster);
                b.Quad(W(x + w, y, z - drop), W(x + w, y + d, z - drop), W(x + w, y + d, z), W(x + w, y, z), fascia, Paint);
                b.Quad(W(x, y + d, z - drop), W(x, y, z - drop), W(x, y, z), W(x, y + d, z), fascia, Paint);
                b.Quad(W(x + w, y + d, z - drop), W(mx, y + d, z + h - drop), W(mx, y + d, z + h), W(x + w, y + d, z), fascia, Paint);
                b.Quad(W(mx, y + d, z + h - drop), W(x, y + d, z - drop), W(x, y + d, z), W(mx, y + d, z + h), fascia, Paint);
            }
        }

        /** A pyramid roof, in slate. */
        static void Pyramid(Bm b, SolidRec s)
        {
            var col = Real(s.fill, Slate);
            var apex = W(s.x + s.w / 2, s.y + s.d / 2, s.z + s.h);
            var c0 = W(s.x, s.y, s.z); var c1 = W(s.x + s.w, s.y, s.z); var c2 = W(s.x + s.w, s.y + s.d, s.z); var c3 = W(s.x, s.y + s.d, s.z);
            b.Tri(c1, c2, apex, col, Slate); b.Tri(c2, c3, apex, col, Slate); b.Tri(c3, c0, apex, col, Slate); b.Tri(c0, c1, apex, col, Slate);
        }

        /** A round wall up from z0, h high, in bands of colour; a lid on top. */
        static void Cyl(Bm b, SolidRec s)
        {
            int wm = WallOf(s.side ?? s.fill);
            var bounds = new List<(float z, string c)> { (0, s.side ?? s.fill) };
            if (s.bandZ != null)
                for (int k = 0; k + 1 < s.bandZ.Length; k += 2) { bounds.Add((s.bandZ[k], s.bandC[k / 2])); bounds.Add((s.bandZ[k + 1], s.side ?? s.fill)); }
            bounds.Sort((p, q) => p.z.CompareTo(q.z));
            bounds.Add((s.h, null));
            int sides = 48;
            for (int q = 0; q + 1 < bounds.Count; q++)
            {
                float za = s.z0 + Mathf.Clamp(bounds[q].z, 0, s.h), zb = s.z0 + Mathf.Clamp(bounds[q + 1].z, 0, s.h);
                if (zb <= za) continue;
                bool band = bounds[q].c != (s.side ?? s.fill);
                var col = Real(bounds[q].c, band ? Paint : wm);
                for (int k = 0; k < sides; k++)
                {
                    float a0 = k * Mathf.PI * 2 / sides, a1 = (k + 1) * Mathf.PI * 2 / sides;
                    float r = s.r + (band ? 0.004f : 0);
                    var p0 = W(s.cx + Mathf.Sin(a0) * r, s.cy + Mathf.Cos(a0) * r, za); var p1 = W(s.cx + Mathf.Sin(a1) * r, s.cy + Mathf.Cos(a1) * r, za);
                    b.Quad(p1, p0, p0 + Vector3.up * (Hy(zb) - Hy(za)), p1 + Vector3.up * (Hy(zb) - Hy(za)), col, band ? Paint : wm, za - s.z0 < 1 ? 0.7f : 1);
                }
                // Each piece's own pattern should run on round the wall, not restart: good enough at this size.
            }
            Lid(b, s.cx, s.cy, s.r, s.z0 + s.h, Real(s.top ?? s.fill, wm == Glass ? Glass : Concrete), wm == Glass ? Glass : Concrete);
        }
        static void Lid(Bm b, float cx, float cy, float r, float z, Color col, int material)
        {
            int sides = 48;
            var c = W(cx, cy, z);
            for (int k = 0; k < sides; k++)
            {
                float a0 = k * Mathf.PI * 2 / sides, a1 = (k + 1) * Mathf.PI * 2 / sides;
                b.Tri(c, W(cx + Mathf.Sin(a1) * r, cy + Mathf.Cos(a1) * r, z), W(cx + Mathf.Sin(a0) * r, cy + Mathf.Cos(a0) * r, z), col, material);
            }
        }
        static void Cone(Bm b, SolidRec s)
        {
            var col = Real(s.fill, Slate);
            var apex = W(s.cx, s.cy, s.z0 + s.h);
            int sides = 48;
            for (int k = 0; k < sides; k++)
            {
                float a0 = k * Mathf.PI * 2 / sides, a1 = (k + 1) * Mathf.PI * 2 / sides;
                b.Tri(W(s.cx + Mathf.Sin(a1) * s.r, s.cy + Mathf.Cos(a1) * s.r, s.z0), W(s.cx + Mathf.Sin(a0) * s.r, s.cy + Mathf.Cos(a0) * s.r, s.z0), apex, col, Slate);
            }
        }
        /** A hemisphere of metal sheet; or a whole ball (a sphere's radius is in screen pixels). */
        static void Ball(Bm b, Vector3 c, float r, float from, Color col, int material)
        {
            int lon = 40, lat = 20;
            for (int y = 0; y < lat; y++)
            {
                float t0 = Mathf.Lerp(from, 1, (float)y / lat) * Mathf.PI / 2, t1 = Mathf.Lerp(from, 1, (float)(y + 1) / lat) * Mathf.PI / 2;
                for (int x = 0; x < lon; x++)
                {
                    float a0 = x * Mathf.PI * 2 / lon, a1 = (x + 1) * Mathf.PI * 2 / lon;
                    Vector3 P(float t, float a) => c + new Vector3(Mathf.Cos(t) * Mathf.Sin(a), Mathf.Sin(t), Mathf.Cos(t) * Mathf.Cos(a)) * r;
                    b.Quad(P(t0, a0), P(t0, a1), P(t1, a1), P(t1, a0), col, material);
                }
            }
        }
        static void Dome(Bm b, SolidRec s) => Ball(b, W(s.cx, s.cy, s.z0), s.r, 0, Real(s.fill, Metal), Metal);
        static void Sphere(Bm b, SolidRec s) => Ball(b, W(s.cx, s.cy, s.z), s.r / IslandBuild.PxPerUnit, -1, Real(s.fill, Paint), Paint);
        /** A round platform: a low drum of stone. */
        static void Disc(Bm b, SolidRec s)
        {
            var col = Is(s.fill, "#62e8c9", "#8aeed6") ? Real("#87987a", Concrete) : Real(s.fill, Concrete);
            int sides = 48; float z0 = s.z - 1.5f;
            for (int k = 0; k < sides; k++)
            {
                float a0 = k * Mathf.PI * 2 / sides, a1 = (k + 1) * Mathf.PI * 2 / sides;
                var p0 = W(s.cx + Mathf.Sin(a0) * s.r, s.cy + Mathf.Cos(a0) * s.r, z0); var p1 = W(s.cx + Mathf.Sin(a1) * s.r, s.cy + Mathf.Cos(a1) * s.r, z0);
                b.Quad(p1, p0, p0 + Vector3.up * Hy(1.5f), p1 + Vector3.up * Hy(1.5f), col, Concrete, 0.7f);
            }
            Lid(b, s.cx, s.cy, s.r, s.z, col, Concrete);
        }
        /** A flat shape between 3D points: a sign, a sail, a ramp. */
        static void Poly(Bm b, SolidRec s)
        {
            if (s.pts == null || s.pts.Length < 9) return;
            var p = new List<Vector3>();
            for (int k = 0; k + 2 < s.pts.Length; k += 3) p.Add(W(s.pts[k], s.pts[k + 1], s.pts[k + 2]));
            int m = PanelOf(s.fill);
            var col = Real(s.fill, m);
            // Facing the camera: a flat shape is seen from its front.
            var toEye = -(Quaternion.Euler(30, 225, 0) * Vector3.forward);
            bool flip = p.Count >= 3 && Vector3.Dot(Vector3.Cross(p[1] - p[0], p[2] - p[0]), toEye) < 0;
            for (int k = 1; k + 1 < p.Count; k++) { if (flip) b.Tri(p[0], p[k + 1], p[k], col, m); else b.Tri(p[0], p[k], p[k + 1], col, m); }
        }

        /* ---- building them ---------------------------------------------------- */

        public static List<SolidRec> Parse(SolidRun run)
        {
            var list = new List<SolidRec>();
            foreach (var s in run.items) list.Add(JsonUtility.FromJson<SolidRec>(s));
            return list;
        }

        /** A run's solids as one object. */
        public static GameObject Run(SolidRun run, string name)
        {
            var b = new Bm();
            foreach (var s in Parse(run)) Add(b, s);
            var go = new GameObject(name);
            go.AddComponent<MeshFilter>().sharedMesh = b.Mesh(name);
            var mr = go.AddComponent<MeshRenderer>();
            mr.sharedMaterial = Mat;
            mr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.On;
            mr.receiveShadows = true;
            return go;
        }

        /** Where a mesh lies on the site's map: its box in P()'s units. */
        public static Rect MapBox(Mesh mesh, Transform t)
        {
            float x0 = float.MaxValue, y0 = float.MaxValue, x1 = float.MinValue, y1 = float.MinValue;
            foreach (var v in mesh.vertices)
            {
                var w = t.TransformPoint(v);
                float i = w.z, j = w.x, z = w.y * IslandBuild.PxPerHeight;
                float px = (i - j) * 32, py = (i + j) * 16 - z;
                x0 = Mathf.Min(x0, px); x1 = Mathf.Max(x1, px); y0 = Mathf.Min(y0, py); y1 = Mathf.Max(y1, py);
            }
            return Rect.MinMaxRect(x0, y0, x1, y1);
        }
    }
}
