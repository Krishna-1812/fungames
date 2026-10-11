// The island in 3D, built from the site's own description of it, and rendered
// through a camera that sees it exactly as the site draws it.
//
// The site's projection (lib/island/kit.ts): a point at tile (i, j) and
// height z is drawn at x = (i - j) * 32, y = (i + j) * 16 - z. Here a tile is
// one world unit, with world X = j and Z = i, and the camera looks down 30°
// from a yaw of 225°: that sees i - j across and i + j down the screen, at
// 45.25 px a world unit (32 / cos 45°), and a world unit of height as 39.19 px
// (45.25 * cos 30°). So a site height z is z / 39.19 world units high.
//
// Run from the command line (unity/README.md):
//   Unity -batchmode -projectPath unity -executeMethod Island.IslandBuild.Registration -quit
//   Unity -batchmode -projectPath unity -executeMethod Island.IslandBuild.Preview -quit
using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace Island
{
    public static class IslandBuild
    {
        public const float PxPerUnit = 45.254834f;           // 32 / cos 45°
        public const float PxPerHeight = PxPerUnit * 0.8660254f; // and cos 30°
        const string Data = "Assets/Island/Data/island.json";
        const string Settings = "Assets/Island/Settings";

        public static float Y(float z) => z / PxPerHeight;

        /* ---- the pipeline ---------------------------------------------------- */

        /** The project's URP asset, made once: one main light with soft shadows over the whole island. */
        public static UniversalRenderPipelineAsset Pipeline()
        {
            // A one-shot render cannot wait for shaders compiled in the background: Unity would draw them
            // with its cyan stand-in. And light adds up properly only in linear colour.
            EditorSettings.asyncShaderCompilation = false;
            ShaderUtil.allowAsyncCompilation = false;
            if (PlayerSettings.colorSpace != ColorSpace.Linear) PlayerSettings.colorSpace = ColorSpace.Linear;
            var path = Settings + "/IslandURP.asset";
            var urp = AssetDatabase.LoadAssetAtPath<UniversalRenderPipelineAsset>(path);
            if (urp == null)
            {
                Directory.CreateDirectory(Settings);
                var renderer = ScriptableObject.CreateInstance<UniversalRendererData>();
                AssetDatabase.CreateAsset(renderer, Settings + "/IslandRenderer.asset");
                urp = UniversalRenderPipelineAsset.Create(renderer);
                AssetDatabase.CreateAsset(urp, path);
            }
            urp.shadowDistance = 120;
            urp.shadowCascadeCount = 1;
            urp.mainLightShadowmapResolution = 8192;
            urp.supportsHDR = false;
            urp.msaaSampleCount = 1;
            // Materials made in code share one constant buffer under the SRP Batcher in a one-shot render: every object took the last one's colour.
            urp.useSRPBatcher = false;
            EditorUtility.SetDirty(urp);
            AssetDatabase.SaveAssets();
            GraphicsSettings.defaultRenderPipeline = urp;
            QualitySettings.renderPipeline = urp;
            return urp;
        }

        /* ---- the meshes -------------------------------------------------------- */

        class Builder
        {
            public readonly List<Vector3> v = new();
            public readonly List<Vector3> n = new();
            public readonly List<Color> c = new();
            public readonly List<int> t = new();

            /** A quad facing `normal`, wound so that it is the front (Unity: Cross(b - a, c - a) points out of the front). */
            public void Quad(Vector3 a, Vector3 b, Vector3 cc, Vector3 d, Vector3 normal, Color col)
            {
                if (Vector3.Dot(Vector3.Cross(b - a, cc - a), normal) < 0) { (b, d) = (d, b); }
                int k = v.Count;
                v.AddRange(new[] { a, b, cc, d });
                for (int q = 0; q < 4; q++) { n.Add(normal); c.Add(col); }
                t.AddRange(new[] { k, k + 1, k + 2, k, k + 2, k + 3 });
            }

            public Mesh Mesh(string name)
            {
                var m = new Mesh { name = name, indexFormat = IndexFormat.UInt32 };
                m.SetVertices(v); m.SetNormals(n); m.SetColors(c); m.SetTriangles(t, 0);
                m.RecalculateBounds();
                return m;
            }
        }

        /**
         * The ground: every land tile's top at its height, and a wall down every
         * edge where the next tile is lower (the sea's level, for the coast).
         * `top` colours a tile's top; `wall` a wall's face.
         */
        static Mesh Ground(IslandData d, System.Func<int, int, Color> top, System.Func<int, int, Color> wall)
        {
            var b = new Builder();
            for (int i = 0; i < d.grid; i++)
                for (int j = 0; j < d.grid; j++)
                {
                    if (!d.Land(i, j)) continue;
                    float y = Y(d.Z(i, j));
                    // World X = j, Z = i.
                    b.Quad(new Vector3(j, y, i), new Vector3(j + 1, y, i), new Vector3(j + 1, y, i + 1), new Vector3(j, y, i + 1), Vector3.up, top(i, j));
                    foreach (var (di, dj) in new[] { (1, 0), (-1, 0), (0, 1), (0, -1) })
                    {
                        float ny = d.Land(i + di, j + dj) ? Y(d.Z(i + di, j + dj)) : Y(d.sea) - 0.6f;
                        if (ny >= y) continue;
                        var normal = new Vector3(dj, 0, di);
                        // The edge shared with the neighbour.
                        Vector3 e0, e1;
                        if (di != 0) { float z = di > 0 ? i + 1 : i; e0 = new Vector3(j, 0, z); e1 = new Vector3(j + 1, 0, z); }
                        else { float x = dj > 0 ? j + 1 : j; e0 = new Vector3(x, 0, i); e1 = new Vector3(x, 0, i + 1); }
                        b.Quad(e0 + Vector3.up * y, e1 + Vector3.up * y, e1 + Vector3.up * ny, e0 + Vector3.up * ny, normal, wall(i, j));
                    }
                }
            return b.Mesh("ground");
        }

        /** A building's height in the site's units: its drawing's height above its footprint, less the footprint's own depth on screen. */
        public static float BlockHeight(Building s) => Mathf.Max(16, (s.anchor.y1 - s.anchor.y0) - (s.w + s.d) * 16 - 8);

        /** A box for each building, as tall as its drawing: a stand-in until the buildings are modelled. */
        static Mesh Blocks(IslandData d)
        {
            var b = new Builder();
            foreach (var s in d.buildings)
            {
                float y0 = Y(s.z), y1 = y0 + BlockHeight(s) / PxPerHeight;
                float inset = 0.12f;
                float x0 = s.j + inset, x1 = s.j + s.d - inset, z0 = s.i + inset, z1 = s.i + s.w - inset;
                var col = new Color(0.93f, 0.91f, 0.87f);
                b.Quad(new Vector3(x0, y1, z0), new Vector3(x1, y1, z0), new Vector3(x1, y1, z1), new Vector3(x0, y1, z1), Vector3.up, col);
                b.Quad(new Vector3(x0, y0, z1), new Vector3(x1, y0, z1), new Vector3(x1, y1, z1), new Vector3(x0, y1, z1), Vector3.forward, col);
                b.Quad(new Vector3(x0, y0, z0), new Vector3(x1, y0, z0), new Vector3(x1, y1, z0), new Vector3(x0, y1, z0), Vector3.back, col);
                b.Quad(new Vector3(x1, y0, z0), new Vector3(x1, y0, z1), new Vector3(x1, y1, z1), new Vector3(x1, y1, z0), Vector3.right, col);
                b.Quad(new Vector3(x0, y0, z0), new Vector3(x0, y0, z1), new Vector3(x0, y1, z1), new Vector3(x0, y1, z0), Vector3.left, col);
            }
            return b.Mesh("blocks");
        }

        static GameObject Place(Mesh mesh, Material mat, string name)
        {
            var go = new GameObject(name);
            go.AddComponent<MeshFilter>().sharedMesh = mesh;
            var r = go.AddComponent<MeshRenderer>();
            r.sharedMaterial = mat;
            r.shadowCastingMode = ShadowCastingMode.On;
            r.receiveShadows = true;
            return go;
        }

        /* ---- the camera ---------------------------------------------------------- */

        /**
         * A camera that sees the site's map box [x, y, w, h] (P()'s units) exactly,
         * at `scale` pixels a map unit.
         */
        static Camera Eye(float x, float y, float w, float h)
        {
            var go = new GameObject("eye");
            var cam = go.AddComponent<Camera>();
            cam.orthographic = true;
            cam.orthographicSize = h / 2 / PxPerUnit;
            cam.aspect = w / h;
            go.transform.rotation = Quaternion.Euler(30, 225, 0);
            // The world point at height 0 that the site draws at the box's middle.
            float cx = x + w / 2, cy = y + h / 2;
            float a = cx / 32, s = cy / 16;            // i - j, i + j
            float ti = (a + s) / 2, tj = (s - a) / 2;
            go.transform.position = new Vector3(tj, 0, ti) - go.transform.forward * 70;
            cam.nearClipPlane = 20; cam.farClipPlane = 130;
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.allowMSAA = false; cam.allowHDR = false;
            var extra = cam.GetUniversalAdditionalCameraData();
            extra.renderPostProcessing = false;
            extra.antialiasing = AntialiasingMode.None;
            return cam;
        }

        /** Render to a file, ss times larger and averaged down, for smooth edges. */
        static void Shoot(Camera cam, int pw, int ph, string file, bool linear, int ss = 1)
        {
            int rw = pw * ss, rh = ph * ss;
            var rt = new RenderTexture(rw, rh, 24, RenderTextureFormat.ARGB32, linear ? RenderTextureReadWrite.Linear : RenderTextureReadWrite.sRGB);
            cam.targetTexture = rt;
            cam.Render();
            RenderTexture.active = rt;
            var big = new Texture2D(rw, rh, TextureFormat.RGBA32, false, linear);
            big.ReadPixels(new Rect(0, 0, rw, rh), 0, 0);
            RenderTexture.active = null;
            var src = big.GetPixels32();
            var dst = new Color32[pw * ph];
            for (int y = 0; y < ph; y++)
                for (int x = 0; x < pw; x++)
                {
                    int r = 0, g = 0, b = 0, a = 0;
                    for (int dy = 0; dy < ss; dy++)
                        for (int dx = 0; dx < ss; dx++) { var c = src[(y * ss + dy) * rw + x * ss + dx]; r += c.r; g += c.g; b += c.b; a += c.a; }
                    int n = ss * ss;
                    dst[y * pw + x] = new Color32((byte)(r / n), (byte)(g / n), (byte)(b / n), (byte)(a / n));
                }
            Object.DestroyImmediate(big);
            var tex = new Texture2D(pw, ph, TextureFormat.RGBA32, false, linear);
            tex.SetPixels32(dst); tex.Apply();
            cam.targetTexture = null;
            Directory.CreateDirectory(Path.GetDirectoryName(file));
            File.WriteAllBytes(file, tex.EncodeToPNG());
            Object.DestroyImmediate(rt);
            Debug.Log($"[island] wrote {file} ({pw}×{ph})");
        }

        static string Arg(string name, string fallback)
        {
            var a = System.Environment.GetCommandLineArgs();
            for (int k = 0; k < a.Length - 1; k++) if (a[k] == name) return a[k + 1];
            return fallback;
        }

        /* ---- the renders --------------------------------------------------------- */

        /**
         * Every land tile's top painted with its own number (red = i * 8 + 4,
         * green = j * 8 + 4), walls black, sea dark: scripts/check-unity-island.mjs
         * reads it back to prove each tile is drawn where the site draws it.
         */
        public static void Registration()
        {
            Pipeline();
            var d = IslandData.Load(Data);
            var flat = new Material(Shader.Find("Island/VertexColorUnlit"));
            var ground = Ground(d, (i, j) => new Color((i * 8 + 4) / 255f, (j * 8 + 4) / 255f, 200 / 255f), (i, j) => Color.black);
            Place(ground, flat, "ground");
            float scale = float.Parse(Arg("-scale", "1"), System.Globalization.CultureInfo.InvariantCulture);
            var vb = d.viewBox;
            var cam = Eye(vb[0], vb[1], vb[2], vb[3]);
            cam.backgroundColor = new Color(0, 0, 50 / 255f);
            Shoot(cam, Mathf.RoundToInt(vb[2] * scale), Mathf.RoundToInt(vb[3] * scale), Arg("-out", "Renders/registration.png"), true);
        }

        /** A first look: plain colours, one sun, soft shadows, blocks for buildings. */
        public static void Preview()
        {
            Pipeline();
            var d = IslandData.Load(Data);
            var litShader = Shader.Find("Universal Render Pipeline/Lit");
            // URP's Lit shader has no vertex colour: one material each for grass, sand, rock and blocks.
            Material Tint(Color c) { var m = new Material(litShader); m.SetColor("_BaseColor", c); m.SetFloat("_Smoothness", 0.15f); return m; }
            var grass = Ground(d, (i, j) => Color.white, (i, j) => Color.white);
            Place(grass, Tint(new Color(0.55f, 0.74f, 0.45f)), "ground");
            Place(Blocks(d), Tint(new Color(0.93f, 0.91f, 0.87f)), "blocks");
            var sea = GameObject.CreatePrimitive(PrimitiveType.Plane);
            sea.transform.position = new Vector3(15, Y(d.sea), 15);
            sea.transform.localScale = new Vector3(12, 1, 12);
            sea.GetComponent<MeshRenderer>().sharedMaterial = Tint(new Color(0.36f, 0.66f, 0.80f));

            var sun = new GameObject("sun").AddComponent<Light>();
            sun.type = LightType.Directional;
            sun.intensity = 1.1f;
            sun.shadows = LightShadows.Soft;
            sun.shadowStrength = 0.7f;
            // Behind and to the right, as the site's shadows have it: they fall towards -i, +j.
            float e = 38 * Mathf.Deg2Rad;
            sun.transform.rotation = Quaternion.LookRotation(new Vector3(0.707f * Mathf.Cos(e), -Mathf.Sin(e), -0.707f * Mathf.Cos(e)));
            RenderSettings.ambientMode = AmbientMode.Trilight;
            RenderSettings.ambientSkyColor = new Color(0.62f, 0.70f, 0.82f);
            RenderSettings.ambientEquatorColor = new Color(0.55f, 0.58f, 0.60f);
            RenderSettings.ambientGroundColor = new Color(0.35f, 0.33f, 0.30f);

            float scale = float.Parse(Arg("-scale", "1"), System.Globalization.CultureInfo.InvariantCulture);
            var vb = d.viewBox;
            var cam = Eye(vb[0], vb[1], vb[2], vb[3]);
            cam.backgroundColor = new Color(0.36f, 0.66f, 0.80f);
            Shoot(cam, Mathf.RoundToInt(vb[2] * scale), Mathf.RoundToInt(vb[3] * scale), Arg("-out", "Renders/preview.png"), false);
        }

        /** The sun and the sky, the same for every render: from behind on the right, as the site's shadows fall. */
        static void Light()
        {
            var sun = new GameObject("sun").AddComponent<Light>();
            sun.type = LightType.Directional;
            sun.color = new Color(1.0f, 0.98f, 0.95f);
            sun.intensity = 1.1f;
            sun.shadows = LightShadows.Soft;
            sun.shadowStrength = 0.85f;
            sun.shadowBias = 0.02f; sun.shadowNormalBias = 0.2f;
            sun.GetUniversalAdditionalLightData().softShadowQuality = SoftShadowQuality.High;
            float e = 40 * Mathf.Deg2Rad;
            sun.transform.rotation = Quaternion.LookRotation(new Vector3(0.707f * Mathf.Cos(e), -Mathf.Sin(e), -0.707f * Mathf.Cos(e)));
            Shader.SetGlobalColor("_IslandSky", new Color(0.36f, 0.42f, 0.52f));
            Shader.SetGlobalColor("_IslandGround", new Color(0.22f, 0.24f, 0.26f));
        }

        /**
         * The ground's scene: its one surface with its colour map, the sea over
         * it, the buildings as blocks (`blocks`: "show", "shadow" for only their
         * shadows, or "none"), and the sun.
         */
        static void Scene(IslandData d, string blocks)
        {
            var t0 = System.DateTime.Now;
            var ground = new Terrain3D(d);
            var map = new Vector4(Terrain3D.Lo, Terrain3D.Lo, Terrain3D.Span, Terrain3D.Span);

            var gm = new Material(Shader.Find("Island/Ground"));
            var albedo = ground.AlbedoMap(out var splatA, out var splatB);
            gm.SetTexture("_Albedo", albedo); gm.SetVector("_Map", map);
            gm.SetTexture("_SplatA", splatA); gm.SetTexture("_SplatB", splatB);
            Photos.Load();
            gm.SetTexture("_Photo", Photos.Colour); gm.SetTexture("_PhotoN", Photos.Normal);
            gm.SetVectorArray("_PhotoMean", Photos.Means);
            Debug.Log($"[island] colour map {albedo.width}² in {(System.DateTime.Now - t0).TotalSeconds:0.0}s");
            if (Arg("-maps", "") == "1") File.WriteAllBytes("Renders/albedo.png", albedo.EncodeToPNG());
            t0 = System.DateTime.Now;
            Place(ground.Mesh(), gm, "ground");
            Debug.Log($"[island] ground mesh in {(System.DateTime.Now - t0).TotalSeconds:0.0}s");

            Shader.SetGlobalFloat("_IslandSea", Y(d.sea));
            var wm = new Material(Shader.Find("Island/Water"));
            wm.SetTexture("_Depth", ground.DepthMap()); wm.SetVector("_Map", map);
            var sea = GameObject.CreatePrimitive(PrimitiveType.Plane);
            sea.transform.position = new Vector3(15, Y(d.sea), 15);
            sea.transform.localScale = new Vector3(14, 1, 14);
            var sr = sea.GetComponent<MeshRenderer>();
            sr.sharedMaterial = wm; sr.shadowCastingMode = ShadowCastingMode.Off;

            // The rocks standing in the sea: in the plate whole (nothing on the site stands in
            // front of them), their feet under the water, foam round each (Water.shader).
            var rocks = new Vector4[48];
            int nRocks = 0;
            if (d.seaRocks != null)
                for (int q = 0; q + 2 < d.seaRocks.Length && nRocks < 48; q += 3)
                {
                    float ri = d.seaRocks[q] + 0.5f, rj = d.seaRocks[q + 1] + 0.5f, rk = d.seaRocks[q + 2];
                    var rock = Plants.Build("searock" + nRocks);
                    rock.transform.position = new Vector3(rj, Y(d.sea) - 0.12f * rk, ri);
                    rock.transform.localScale = Vector3.one * rk;
                    rocks[nRocks++] = new Vector4(rj, ri, 0.27f * rk, 0);
                }
            // The stones at the waterline: three, a big one and two small, as the site draws them.
            if (d.shoreRocks != null)
                for (int q = 0; q + 2 < d.shoreRocks.Length; q += 3)
                {
                    float ri = d.shoreRocks[q], rj = d.shoreRocks[q + 1], big = d.shoreRocks[q + 2];
                    int n = q / 3;
                    foreach (var (dx, dy, k) in new[] { (0f, 0f, big), (10 * big, 3f, big * 0.6f), (-9 * big, 3.5f, big * 0.45f) })
                    {
                        float ti = (dx / 32 + dy / 16) / 2, tj = (dy / 16 - dx / 32) / 2;
                        var rock = Plants.Build("rock" + ((n + (int)(k * 10)) % 3));
                        rock.transform.position = new Vector3(rj + tj, Y(d.sea) - 0.06f, ri + ti);
                        rock.transform.localScale = Vector3.one * k * 0.95f;
                    }
                    if (nRocks < 48) rocks[nRocks++] = new Vector4(rj, ri, 0.2f * big, 0);
                }
            wm.SetVectorArray("_Rocks", rocks);
            wm.SetFloat("_RockCount", nRocks);

            // What grows on the ground: in the plate, only its shadow (the site draws each
            // figure itself, from IslandBuild.Figures, over the plate).
            if (blocks != "none" && d.plants != null)
            {
                Plants.Load();
                var holder = new GameObject("plants");
                foreach (var pl in d.plants)
                {
                    var go = Plants.Build(pl.name);
                    if (go == null) continue;
                    go.transform.SetParent(holder.transform, false);
                    go.transform.localPosition = new Vector3(pl.y, Y(pl.z), pl.x);
                    go.transform.localScale = Vector3.one * pl.k;
                    foreach (var mr in go.GetComponentsInChildren<MeshRenderer>())
                        mr.shadowCastingMode = blocks == "shadow" ? ShadowCastingMode.ShadowsOnly : ShadowCastingMode.On;
                }
            }
            if (blocks != "none")
            {
                var bm = new Material(Shader.Find("Universal Render Pipeline/Lit"));
                bm.SetColor("_BaseColor", new Color(0.92f, 0.92f, 0.94f)); bm.SetFloat("_Smoothness", 0.1f);
                var go = Place(Blocks(d), bm, "blocks");
                if (blocks == "shadow") go.GetComponent<MeshRenderer>().shadowCastingMode = ShadowCastingMode.ShadowsOnly;
            }
            Light();
        }

        /** The site's own sea colour (lib/island/kit.ts, C.water): behind everything, where the render shows no sea of its own. */
        static readonly Color SiteSea = new Color(0x8c / 255f, 0xcb / 255f, 1f);

        static float[] Floats(string s) => System.Array.ConvertAll(s.Split(','), x => float.Parse(x, System.Globalization.CultureInfo.InvariantCulture));

        /**
         * The ground made real (phase 2), to look at: the whole map box, or
         * `-box x,y,w,h` (P()'s units), at `-scale` pixels a map unit.
         * `-blocks show|shadow|none`; `-ss n` renders n times larger and averages down.
         */
        public static void Realistic()
        {
            Pipeline();
            var d = IslandData.Load(Data);
            Scene(d, Arg("-blocks", "show"));
            float scale = float.Parse(Arg("-scale", "1"), System.Globalization.CultureInfo.InvariantCulture);
            int ss = int.Parse(Arg("-ss", "2"));
            var box = Arg("-box", "");
            var vb = box != "" ? Floats(box) : d.viewBox;
            var cam = Eye(vb[0], vb[1], vb[2], vb[3]);
            cam.backgroundColor = SiteSea;
            Shoot(cam, Mathf.RoundToInt(vb[2] * scale), Mathf.RoundToInt(vb[3] * scale), Arg("-out", "Renders/realistic.png"), false, ss);
        }

        /**
         * Every figure the island names (its plants: lib/island/props.ts), alone,
         * lit and seen as the island is, on nothing: Renders/figures/NAME.png at
         * `-scale` pixels a map unit (rendered `-ss` times larger and averaged
         * down), each over the same map box round the origin, where the figure's
         * foot is; scripts/unity-figures.mjs trims them for the site.
         */
        public static void Figures()
        {
            Pipeline();
            var d = IslandData.Load(Data);
            Light();
            float scale = float.Parse(Arg("-scale", "5"), System.Globalization.CultureInfo.InvariantCulture);
            int ss = int.Parse(Arg("-ss", "3"));
            var only = Arg("-only", "");
            var names = new SortedSet<string>();
            foreach (var p in d.plants) names.Add(p.name);
            Directory.CreateDirectory("Renders/figures");
            if (only == "") foreach (var f in Directory.GetFiles("Renders/figures")) File.Delete(f);
            // The box round the foot (P()'s units): wide enough for a palm's fronds, tall enough for a cypress.
            float bx = -72, by = -136, bw = 144, bh = 156;
            int made = 0;
            foreach (var name in names)
            {
                if (only != "" && !name.StartsWith(only)) continue;
                var go = Plants.Build(name);
                if (go == null) continue;
                var cam = Eye(bx, by, bw, bh);
                cam.backgroundColor = new Color(0, 0, 0, 0);
                ShootFigure(cam, Mathf.RoundToInt(bw * scale), Mathf.RoundToInt(bh * scale), $"Renders/figures/{name}.png", ss);
                Object.DestroyImmediate(cam.gameObject);
                Object.DestroyImmediate(go);
                made++;
            }
            var inv = System.Globalization.CultureInfo.InvariantCulture;
            File.WriteAllText("Renders/figures/figures.json", $"{{\"scale\":{scale.ToString(inv)},\"box\":[{bx.ToString(inv)},{by.ToString(inv)},{bw.ToString(inv)},{bh.ToString(inv)}]}}");
            Debug.Log($"[island] figures: {made} at {scale} px a unit");
        }

        /** Render a figure on nothing: averaged down by its coverage, so its edges do not darken against the empty background. */
        static void ShootFigure(Camera cam, int pw, int ph, string file, int ss)
        {
            int rw = pw * ss, rh = ph * ss;
            var rt = new RenderTexture(rw, rh, 24, RenderTextureFormat.ARGB32, RenderTextureReadWrite.sRGB);
            cam.targetTexture = rt;
            cam.Render();
            RenderTexture.active = rt;
            var big = new Texture2D(rw, rh, TextureFormat.RGBA32, false, false);
            big.ReadPixels(new Rect(0, 0, rw, rh), 0, 0);
            RenderTexture.active = null;
            var src = big.GetPixels32();
            var dst = new Color32[pw * ph];
            for (int y = 0; y < ph; y++)
                for (int x = 0; x < pw; x++)
                {
                    float r = 0, g = 0, b = 0, a = 0;
                    for (int dy = 0; dy < ss; dy++)
                        for (int dx = 0; dx < ss; dx++)
                        {
                            var c = src[(y * ss + dy) * rw + x * ss + dx];
                            float w = c.a / 255f;
                            r += c.r * w; g += c.g * w; b += c.b * w; a += w;
                        }
                    dst[y * pw + x] = a > 0 ? new Color32((byte)Mathf.Round(r / a), (byte)Mathf.Round(g / a), (byte)Mathf.Round(b / a), (byte)Mathf.Round(a / (ss * ss) * 255)) : new Color32(0, 0, 0, 0);
                }
            Object.DestroyImmediate(big);
            var tex = new Texture2D(pw, ph, TextureFormat.RGBA32, false, false);
            tex.SetPixels32(dst); tex.Apply();
            cam.targetTexture = null;
            Directory.CreateDirectory(Path.GetDirectoryName(file));
            File.WriteAllBytes(file, tex.EncodeToPNG());
            Object.DestroyImmediate(rt); Object.DestroyImmediate(tex);
        }

        /**
         * The plate the site bakes from (scripts/unity-plate.mjs): the ground and
         * the sea round it, with the buildings' shadows but not the buildings
         * (the site draws those), over the map box `-box x0,y0,x1,y1` at `-scale`
         * pixels a map unit, in tiles of `-tile` pixels: Renders/plate/r_c.png,
         * and plate.json to say where they go.
         */
        public static void Plate()
        {
            Pipeline();
            var d = IslandData.Load(Data);
            Scene(d, "shadow");
            var b = Floats(Arg("-box", "-1216,-200,1216,1130"));
            float scale = float.Parse(Arg("-scale", "4"), System.Globalization.CultureInfo.InvariantCulture);
            int tile = int.Parse(Arg("-tile", "2048")), ss = int.Parse(Arg("-ss", "2"));
            float step = tile / scale;
            int cols = Mathf.CeilToInt((b[2] - b[0]) / step), rows = Mathf.CeilToInt((b[3] - b[1]) / step);
            Directory.CreateDirectory("Renders/plate");
            foreach (var f in Directory.GetFiles("Renders/plate")) File.Delete(f);
            for (int r = 0; r < rows; r++)
                for (int c = 0; c < cols; c++)
                {
                    var cam = Eye(b[0] + c * step, b[1] + r * step, step, step);
                    cam.backgroundColor = SiteSea;
                    Shoot(cam, tile, tile, $"Renders/plate/{r}_{c}.png", false, ss);
                    Object.DestroyImmediate(cam.gameObject);
                }
            var inv = System.Globalization.CultureInfo.InvariantCulture;
            File.WriteAllText("Renders/plate/plate.json",
                $"{{\"box\":[{b[0].ToString(inv)},{b[1].ToString(inv)},{(b[0] + cols * step).ToString(inv)},{(b[1] + rows * step).ToString(inv)}],\"scale\":{scale.ToString(inv)},\"tile\":{tile},\"cols\":{cols},\"rows\":{rows}}}");
            Debug.Log($"[island] plate: {cols}×{rows} tiles of {tile}px at {scale} px a unit");
        }
    }
}
