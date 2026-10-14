// The island at night, lit by its own lights: the street lamps, the windows
// of the rooms with someone home, the strings of bulbs, the lighthouse.
//
// The site makes the night by laying a deep blue over the day (moonlight is
// the day's light, dimmed and cooled) and then, over that, the light the town
// gives off. That light is rendered here (IslandBuild.Glow): the whole island
// in 3D, lit by nothing but its lamps. Each lamp is a light where the site
// says it is (lib/island/world.ts, model.lights), with a pool on the ground
// round its foot, its light on the walls and trees near it, its glass
// glowing, and its shadow: what stands between the lamp and a point is found
// on a map of the tallest thing over every point of the island (Height),
// marched along in the shader (IslandCommon.hlsl, islandLampShadow). A lit
// window shows its room (Building.shader) and lets a little light out on to
// the pavement in front of it; the sea gives back each light as a broken
// streak. Bright things bloom a little, as they do to an eye or a lens.
//
// What comes out is light alone, over black: each pixel's colour and how
// strong it is (alpha), so the site can lay it straight over its night.
using System;
using System.Collections.Generic;
using System.IO;
using UnityEngine;

namespace Island
{
    /** A light (world.ts, model.lights): where (tile i, j; height z), what it is, its colour, and whether it is on. */
    [Serializable] public class NightLight { public float i, j, z; public string kind, face, col; public bool lit; }

    public static class Night
    {
        /** The light in a lit room (display colours): a soft warm white, a plain white, a cool white, and a television's blue. */
        public static readonly Color[] Rooms = { new Color(1f, 0.9f, 0.77f), new Color(1f, 0.96f, 0.91f), new Color(0.86f, 0.92f, 1f), new Color(0.56f, 0.7f, 1f) };
        static readonly float[] RoomLevel = { 1.05f, 1.0f, 0.95f, 0.5f };
        /** A street lamp's light: a clean, slightly cool white. */
        static readonly Color LampColour = new Color(0.94f, 0.97f, 1f);

        struct L { public Vector3 p, n; public Color c; public float range, core, kind; }
        static List<L> lights;
        static List<(Vector3 p, int room)> panes;

        public static bool On => lights != null;

        /** Which of the room lights a lit window gets: mostly warm or plain white, a few cool, now and then a television. */
        static int PickRoom(Vector3 p)
        {
            float h = Mathf.Sin(p.x * 41.3f + p.y * 17.9f + p.z * 73.1f) * 43758.5453f; h -= Mathf.Floor(h);
            return h < 0.42f ? 0 : h < 0.78f ? 1 : h < 0.93f ? 2 : 3;
        }

        static Color Hex(string h) { if (string.IsNullOrEmpty(h) || !ColorUtility.TryParseHtmlString(h, out var c)) c = Color.white; return c; }

        /** Read the night's lights, before the buildings are built (their lit panes are marked as they are). */
        public static void Load(IslandData d)
        {
            lights = new List<L>(); panes = new List<(Vector3, int)>();
            foreach (var x in d.lights ?? new NightLight[0])
            {
                if (!x.lit) continue;
                var p = new Vector3(x.j, x.z / IslandBuild.PxPerHeight, x.i);
                if (x.kind == "win")
                {
                    // Face x looks out along +i (world +Z), face y along +j (world +X).
                    var n = x.face == "x" ? Vector3.forward : Vector3.right;
                    int room = PickRoom(p);
                    panes.Add((p, room));
                    lights.Add(new L { p = p + n * 0.05f, n = n, c = Rooms[room].linear * RoomLevel[room] * 0.04f, range = 0.9f, kind = 1 });
                }
                else if (x.kind == "lamp")
                    lights.Add(new L { p = p, c = LampColour.linear * 0.7f, range = 1.5f, core = 0.055f, kind = 0 });
                else if (x.z > 90 && string.Equals(x.col, "#fff8e0", StringComparison.OrdinalIgnoreCase))
                    // The lighthouse's lantern: bright, and seen far off.
                    lights.Add(new L { p = p, c = LampColour.linear * 1.4f, range = 3.2f, core = 0.12f, kind = 3 });
                else
                    lights.Add(new L { p = p, c = Hex(x.col).linear * 0.07f, range = 0.75f, kind = 2 });
            }
            if (lights.Count > 256) { Debug.LogWarning($"[island] {lights.Count} night lights: only 256 used"); lights.RemoveRange(256, lights.Count - 256); }
            Debug.Log($"[island] night: {lights.Count} lights, {panes.Count} lit windows");
        }

        /**
         * Whether the pane with this middle is a lit room's (its light's kind, 0..3), or -1: matched to the
         * window lights by where they are (the site's light is at the middle of the window in the wall's face;
         * the pane is set back in its reveal).
         */
        public static int PaneLight(Vector3 c)
        {
            if (panes == null) return -1;
            foreach (var (p, room) in panes)
            {
                var d = c - p;
                if (Mathf.Abs(d.y) < 0.09f && d.x * d.x + d.z * d.z < 0.09f * 0.09f) return room;
            }
            return -1;
        }

        /* ---- the height map ------------------------------------------------- */

        /** Over world x and z from Lo to Lo + Span, Res texels a unit. */
        const float Lo = -6, Span = 42; const int Res = 20;

        /** The tallest thing over every point, from the ground's mesh and the buildings' (not the trees': light comes through leaves). */
        static Texture2D Height(params GameObject[] roots)
        {
            int N = Mathf.RoundToInt(Span * Res);
            var h = new float[N * N];
            for (int k = 0; k < h.Length; k++) h[k] = -10;
            void Mark(float x, float z, float y)
            {
                int tx = (int)((x - Lo) * Res), tz = (int)((z - Lo) * Res);
                if (tx < 0 || tz < 0 || tx >= N || tz >= N) return;
                int k = tz * N + tx;
                if (y > h[k]) h[k] = y;
            }
            long tris = 0;
            foreach (var root in roots)
            {
                if (root == null) continue;
                foreach (var mf in root.GetComponentsInChildren<MeshFilter>())
                {
                    var m = mf.sharedMesh; if (m == null) continue;
                    // Not the small things (a lamp's own post and arm would shade its light; a bench or a bin is too small to matter).
                    var rb = mf.GetComponent<MeshRenderer>()?.bounds;
                    if (rb.HasValue && rb.Value.size.x < 0.4f && rb.Value.size.z < 0.4f) continue;
                    var mx = mf.transform.localToWorldMatrix;
                    var vs = m.vertices; for (int i = 0; i < vs.Length; i++) vs[i] = mx.MultiplyPoint3x4(vs[i]);
                    var ts = m.triangles; tris += ts.Length / 3;
                    for (int t = 0; t < ts.Length; t += 3)
                    {
                        Vector3 a = vs[ts[t]], b = vs[ts[t + 1]], c = vs[ts[t + 2]];
                        // Its edges (a wall, seen from above, is only its edges)...
                        foreach (var (p, q) in new[] { (a, b), (b, c), (c, a) })
                        {
                            float len = new Vector2(q.x - p.x, q.z - p.z).magnitude;
                            int steps = Mathf.CeilToInt(len * Res * 2) + 1;
                            for (int s = 0; s <= steps; s++) { var r = Vector3.Lerp(p, q, s / (float)steps); Mark(r.x, r.z, r.y); }
                        }
                        // ...and whatever it covers.
                        float area = (b.x - a.x) * (c.z - a.z) - (c.x - a.x) * (b.z - a.z);
                        if (Mathf.Abs(area) < 1e-7f) continue;
                        int x0 = Mathf.Max(0, (int)((Mathf.Min(a.x, Mathf.Min(b.x, c.x)) - Lo) * Res)), x1 = Mathf.Min(N - 1, (int)((Mathf.Max(a.x, Mathf.Max(b.x, c.x)) - Lo) * Res));
                        int z0 = Mathf.Max(0, (int)((Mathf.Min(a.z, Mathf.Min(b.z, c.z)) - Lo) * Res)), z1 = Mathf.Min(N - 1, (int)((Mathf.Max(a.z, Mathf.Max(b.z, c.z)) - Lo) * Res));
                        for (int tz = z0; tz <= z1; tz++)
                            for (int tx = x0; tx <= x1; tx++)
                            {
                                float px = Lo + (tx + 0.5f) / Res, pz = Lo + (tz + 0.5f) / Res;
                                float w1 = ((b.x - px) * (c.z - pz) - (c.x - px) * (b.z - pz)) / area;
                                float w2 = ((c.x - px) * (a.z - pz) - (a.x - px) * (c.z - pz)) / area;
                                float w3 = 1 - w1 - w2;
                                if (w1 < -1e-4f || w2 < -1e-4f || w3 < -1e-4f) continue;
                                float y = a.y * w1 + b.y * w2 + c.y * w3;
                                int k = tz * N + tx;
                                if (y > h[k]) h[k] = y;
                            }
                    }
                }
            }
            var tex = new Texture2D(N, N, TextureFormat.RFloat, false, true) { filterMode = FilterMode.Point, wrapMode = TextureWrapMode.Clamp };
            tex.SetPixelData(h, 0); tex.Apply(false);
            Debug.Log($"[island] night height map {N}² from {tris} triangles");
            if (Environment.GetCommandLineArgs().Length > 0 && Array.IndexOf(Environment.GetCommandLineArgs(), "-heightpng") >= 0)
            {
                var px = new Color32[N * N];
                for (int k = 0; k < h.Length; k++) { byte v = (byte)Mathf.Clamp(Mathf.RoundToInt((h[k] + 1) * 60), 0, 255); px[k] = new Color32(v, v, v, 255); }
                var t2 = new Texture2D(N, N, TextureFormat.RGBA32, false); t2.SetPixels32(px); t2.Apply();
                File.WriteAllBytes("Renders/height.png", t2.EncodeToPNG());
            }
            return tex;
        }

        /** Hand the lights and the height map to the shaders. */
        public static void Upload(params GameObject[] roots)
        {
            var P = new Vector4[256]; var C = new Vector4[256]; var D = new Vector4[256];
            for (int k = 0; k < lights.Count; k++)
            {
                var l = lights[k];
                P[k] = new Vector4(l.p.x, l.p.y, l.p.z, l.range);
                C[k] = new Vector4(l.c.r, l.c.g, l.c.b, l.core);
                D[k] = new Vector4(l.n.x, l.n.y, l.n.z, l.kind);
            }
            Shader.SetGlobalVectorArray("_IslandLampP", P);
            Shader.SetGlobalVectorArray("_IslandLampC", C);
            Shader.SetGlobalVectorArray("_IslandLampD", D);
            Shader.SetGlobalFloat("_IslandLampN", lights.Count);
            var rooms = new Vector4[4];
            for (int k = 0; k < 4; k++) { var c = Rooms[k].linear * RoomLevel[k]; rooms[k] = new Vector4(c.r, c.g, c.b, 1); }
            Shader.SetGlobalVectorArray("_IslandRooms", rooms);
            Shader.SetGlobalTexture("_IslandHeight", Height(roots));
            Shader.SetGlobalVector("_IslandHeightMap", new Vector4(Lo, Lo, 1f / Span, 0));
        }

        /* ---- the render ------------------------------------------------------ */

        /** A blur: a box `r` texels wide each way, three times over (near enough a Gaussian), on one channel. */
        static void Blur(float[] a, int w, int h, int r)
        {
            var tmp = new float[a.Length];
            for (int pass = 0; pass < 3; pass++)
            {
                for (int y = 0; y < h; y++)
                {
                    float s = 0; int row = y * w;
                    for (int x = -r; x <= r; x++) s += a[row + Mathf.Clamp(x, 0, w - 1)];
                    for (int x = 0; x < w; x++) { tmp[row + x] = s / (2 * r + 1); s += a[row + Mathf.Min(x + r + 1, w - 1)] - a[row + Mathf.Max(x - r, 0)]; }
                }
                for (int x = 0; x < w; x++)
                {
                    float s = 0;
                    for (int y = -r; y <= r; y++) s += tmp[Mathf.Clamp(y, 0, h - 1) * w + x];
                    for (int y = 0; y < h; y++) { a[y * w + x] = s / (2 * r + 1); s += tmp[Mathf.Min(y + r + 1, h - 1) * w + x] - tmp[Mathf.Max(y - r, 0) * w + x]; }
                }
            }
        }

        /** All the island's light at night together, against the moonlit day (phase 9: the graded day is deeper, so its lights must carry). */
        public static float Exposure = 1.7f;
        /** How strongly the brightest things bloom: a tight glow and a wide one. */
        public static float BloomNear = 0.3f, BloomFar = 0.22f;

        /**
         * Render the night's light through `cam` (which sees `m` pixels more on every side than the picture, so
         * a glow near the edge is whole) to a PNG of pw × ph: the light as straight colour and its strength as
         * alpha, so that laid over the site's night (colour × alpha + what is there × (1 - alpha)) it adds.
         */
        public static void Shoot(Camera cam, int pw, int ph, int m, string file, int ss)
        {
            var t0 = DateTime.Now;
            int W = pw + 2 * m, H = ph + 2 * m, rw = W * ss, rh = H * ss;
            var rt = new RenderTexture(rw, rh, 24, RenderTextureFormat.ARGBFloat, RenderTextureReadWrite.Linear);
            cam.targetTexture = rt; cam.allowHDR = true;
            cam.backgroundColor = Color.black;
            // Nothing but the lamps: the sun out.
            var suns = UnityEngine.Object.FindObjectsByType<Light>(FindObjectsSortMode.None);
            var was = new float[suns.Length];
            for (int k = 0; k < suns.Length; k++) { was[k] = suns[k].intensity; suns[k].intensity = 0; }
            Shader.SetGlobalFloat("_IslandPass", 3);
            cam.Render();
            Shader.SetGlobalFloat("_IslandPass", 0);
            for (int k = 0; k < suns.Length; k++) suns[k].intensity = was[k];
            cam.targetTexture = null;
            RenderTexture.active = rt;
            var big = new Texture2D(rw, rh, TextureFormat.RGBAFloat, false, true);
            big.ReadPixels(new Rect(0, 0, rw, rh), 0, 0);
            RenderTexture.active = null;
            var src = big.GetPixels();
            UnityEngine.Object.DestroyImmediate(big); UnityEngine.Object.DestroyImmediate(rt);

            // Down to size, in linear light.
            var R = new float[W * H]; var G = new float[W * H]; var B = new float[W * H];
            float inv = 1f / (ss * ss);
            for (int y = 0; y < H; y++)
                for (int x = 0; x < W; x++)
                {
                    float r = 0, g = 0, b = 0;
                    for (int dy = 0; dy < ss; dy++)
                        for (int dx = 0; dx < ss; dx++) { var c = src[(y * ss + dy) * rw + x * ss + dx]; r += Mathf.Max(0, c.r); g += Mathf.Max(0, c.g); b += Mathf.Max(0, c.b); }
                    int k = y * W + x; R[k] = r * inv; G[k] = g * inv; B[k] = b * inv;
                }
            for (int k = 0; k < R.Length; k++) { R[k] *= Exposure; G[k] *= Exposure; B[k] *= Exposure; }
            // The bloom: what is brighter than white spreads a little round itself.
            foreach (var (radius, amount) in new[] { (2, BloomNear), (7, BloomFar) })
            {
                if (amount <= 0) continue;
                var br = new float[W * H]; var bg = new float[W * H]; var bb = new float[W * H];
                for (int k = 0; k < br.Length; k++) { br[k] = Mathf.Max(0, R[k] - 0.6f); bg[k] = Mathf.Max(0, G[k] - 0.6f); bb[k] = Mathf.Max(0, B[k] - 0.6f); }
                Blur(br, W, H, radius); Blur(bg, W, H, radius); Blur(bb, W, H, radius);
                for (int k = 0; k < br.Length; k++) { R[k] += br[k] * amount; G[k] += bg[k] * amount; B[k] += bb[k] * amount; }
            }
            // Toned as the day is (Dome.Knee), and as colour over strength. Rows go up in Unity's pictures.
            var dst = new Color32[pw * ph];
            for (int y = 0; y < ph; y++)
                for (int x = 0; x < pw; x++)
                {
                    int k = (y + m) * W + x + m;
                    float r = Mathf.LinearToGammaSpace(Dome.Knee(R[k])), g = Mathf.LinearToGammaSpace(Dome.Knee(G[k])), b = Mathf.LinearToGammaSpace(Dome.Knee(B[k]));
                    float a = Mathf.Max(r, Mathf.Max(g, b));
                    if (a < 0.5f / 255) { dst[y * pw + x] = new Color32(0, 0, 0, 0); continue; }
                    dst[y * pw + x] = new Color32((byte)Mathf.Round(r / a * 255), (byte)Mathf.Round(g / a * 255), (byte)Mathf.Round(b / a * 255), (byte)Mathf.Round(Mathf.Min(1, a) * 255));
                }
            var tex = new Texture2D(pw, ph, TextureFormat.RGBA32, false, false);
            tex.SetPixels32(dst); tex.Apply();
            Directory.CreateDirectory(Path.GetDirectoryName(file));
            File.WriteAllBytes(file, tex.EncodeToPNG());
            UnityEngine.Object.DestroyImmediate(tex);
            Debug.Log($"[island] night light {file} ({pw}×{ph}) in {(DateTime.Now - t0).TotalSeconds:0.0}s");
        }
    }
}
