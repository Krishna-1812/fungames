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
            urp.shadowDistance = 600;
            urp.shadowCascadeCount = 1;
            urp.mainLightShadowmapResolution = 4096;
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

        /** A box for each building, as tall as its drawing: a stand-in until the buildings are modelled. */
        static Mesh Blocks(IslandData d)
        {
            var b = new Builder();
            foreach (var s in d.buildings)
            {
                // The drawing's height above its footprint's front corner, less the footprint's own depth on screen.
                float px = Mathf.Max(16, (s.anchor.y1 - s.anchor.y0) - (s.w + s.d) * 16 - 8);
                float y0 = Y(s.z), y1 = y0 + px / PxPerHeight;
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
            go.transform.position = new Vector3(tj, 0, ti) - go.transform.forward * 300;
            cam.nearClipPlane = 1; cam.farClipPlane = 700;
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.allowMSAA = false; cam.allowHDR = false;
            var extra = cam.GetUniversalAdditionalCameraData();
            extra.renderPostProcessing = false;
            extra.antialiasing = AntialiasingMode.None;
            return cam;
        }

        static void Shoot(Camera cam, int pw, int ph, string file, bool linear)
        {
            var rt = new RenderTexture(pw, ph, 24, RenderTextureFormat.ARGB32, linear ? RenderTextureReadWrite.Linear : RenderTextureReadWrite.sRGB);
            cam.targetTexture = rt;
            cam.Render();
            RenderTexture.active = rt;
            var tex = new Texture2D(pw, ph, TextureFormat.RGBA32, false, linear);
            tex.ReadPixels(new Rect(0, 0, pw, ph), 0, 0);
            tex.Apply();
            RenderTexture.active = null;
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
    }
}
