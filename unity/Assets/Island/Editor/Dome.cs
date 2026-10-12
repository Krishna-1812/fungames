// The island lit as the real world is: by the sun, and by the whole sky.
//
// A render here is many renders added up. One is the sun alone, with its
// shadow. Each of the rest is one patch of the sky taken as a light: its
// direction, its colour times its share of the sky, and its own shadow. A
// point under the eaves, at the foot of a wall, in a doorway or under a tree
// sees less of the sky than a point on an open lawn, so fewer of those
// passes reach it, and it comes out darker by exactly as much sky as it
// cannot see: soft shadow in every corner and crease, the deep shade under a
// canopy, the light from one side in a street, all from the geometry, with
// nothing painted on. The light the sunlit ground throws back up comes with
// the sun's pass (_IslandBounce).
//
// The passes are added up in floating point on the GPU (Accumulate.shader),
// read back once, put through the tone curve (Knee: straight up to 0.8, then
// rolling off towards white), averaged down from the supersampled render,
// and written as an sRGB PNG.
using System.IO;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace Island
{
    public static class Dome
    {
        /** Patches of sky, and samples of the sun's disc. */
        public static int SkyN = 64, SunN = 8;
        /** How far across the sun's samples spread (degrees): a soft edge to every shadow, as daylight gives, and no stair-steps from the shadow map. */
        public static float SunSpread = 1.1f;
        /** The sky's light on open level ground, against the sun's (about 0.71 there, at 40° up). */
        public static float SkyLevel = 0.42f;
        /** The light the sunlit ground throws back up. */
        public static Color Bounce = new Color(0.17f, 0.2f, 0.19f);
        /** A little more contrast in the midtones, after the tone curve. */
        public static float Contrast = 0.08f;
        /** For looking at one light alone: "sun" or "sky" (else both). */
        public static string Only = "";

        static Material add;
        static Light sun;
        static Quaternion sunRot;
        static Color sunCol;
        static float sunInt;

        /** Towards the sun. */
        public static Vector3 ToSun => -(sunRot * Vector3.forward);
        /** Take over the scene's sun (IslandBuild.Light made it) for the passes. */
        public static void Use(Light s)
        {
            sun = s; sunRot = s.transform.rotation; sunCol = s.color; sunInt = s.intensity;
        }

        /** The sky's patches: directions from 6° above the horizon to the zenith, even over the dome, and each one's light. */
        static (Vector3 dir, Color col)[] Sky(Vector3 toSun)
        {
            int n = SkyN;
            var list = new (Vector3, Color)[n];
            float lo = Mathf.Sin(6 * Mathf.Deg2Rad), omega = 2 * Mathf.PI * (1 - lo) / n;
            float golden = Mathf.PI * (3 - Mathf.Sqrt(5));
            double eh = 0;
            for (int k = 0; k < n; k++)
            {
                float u = (k + 0.5f) / n, sy = lo + u * (1 - lo), cy = Mathf.Sqrt(1 - sy * sy), az = k * golden;
                var dir = new Vector3(cy * Mathf.Cos(az), sy, cy * Mathf.Sin(az));
                // Paler and brighter towards the horizon, deeper blue overhead, and brighter round the sun.
                var zenith = new Color(0.36f, 0.5f, 0.78f); var horizon = new Color(0.78f, 0.84f, 0.92f);
                var c = Color.Lerp(horizon, zenith, Mathf.Sqrt(sy));
                float glow = Mathf.Pow(Mathf.Max(0, Vector3.Dot(dir, toSun)), 6);
                c += new Color(0.9f, 0.92f, 0.95f) * glow * 0.9f;
                list[k] = (dir, c * omega);
                eh += (c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722) * omega * sy;
            }
            // Scaled so the sky lights open level ground as much as SkyLevel says.
            float s = (float)(SkyLevel / eh);
            for (int k = 0; k < n; k++) list[k].Item2 *= s;
            return list;
        }

        /** The tone curve: straight up to the knee, then rolling off towards white (IslandCommon.hlsl, islandUnknee, undoes it). */
        public static float Knee(float x)
        {
            const float k = 0.8f;
            return x < k ? Mathf.Max(0, x) : k + (1 - k) * (1 - Mathf.Exp(-(x - k) / (1 - k)));
        }

        static float Grade(float v)
        {
            // In display space: a gentle S, pinned at black, white and the middle.
            return Mathf.Clamp01(v + Contrast * (v - 0.5f) * (1 - Mathf.Abs(2 * v - 1)) * 2);
        }

        /**
         * Render through `cam`, lit by the sun and the sky, to a PNG of pw × ph
         * (rendered ss times larger and averaged down). `figure`: on nothing,
         * averaged by coverage so the edges do not darken (else opaque).
         */
        public static void Shoot(Camera cam, int pw, int ph, string file, int ss, bool figure)
        {
            var t0 = System.DateTime.Now;
            if (add == null) add = new Material(Shader.Find("Hidden/Island/Accumulate"));
            int rw = pw * ss, rh = ph * ss;
            var rt = new RenderTexture(rw, rh, 24, RenderTextureFormat.ARGBHalf, RenderTextureReadWrite.Linear);
            var acc = new RenderTexture(rw, rh, 0, RenderTextureFormat.ARGBFloat, RenderTextureReadWrite.Linear);
            cam.targetTexture = rt;
            cam.allowHDR = true;

            var toSun = -(sunRot * Vector3.forward);
            sun.shadowStrength = 1;
            bool first = true;
            void Pass()
            {
                cam.Render();
                if (first) { Graphics.Blit(rt, acc); first = false; }
                else Graphics.Blit(rt, acc, add);
            }
            // The sun: its disc sampled, each sample a share of its light.
            Shader.SetGlobalFloat("_IslandPass", 1);
            Shader.SetGlobalFloat("_IslandSelf", 1f / SunN);
            Shader.SetGlobalColor("_IslandBounce", Bounce);
            var axisA = Vector3.Cross(toSun, Vector3.up).normalized; var axisB = Vector3.Cross(toSun, axisA);
            for (int k = 0; k < SunN; k++)
            {
                float a = k * 2.39996f, r = SunN == 1 ? 0 : Mathf.Sqrt((k + 0.5f) / SunN) * SunSpread * Mathf.Deg2Rad;
                var d = (toSun + (axisA * Mathf.Cos(a) + axisB * Mathf.Sin(a)) * r).normalized;
                sun.transform.rotation = Quaternion.LookRotation(-d);
                sun.color = sunCol; sun.intensity = Only == "sky" ? 0 : sunInt / SunN;
                if (Only == "sky") Shader.SetGlobalColor("_IslandBounce", Color.black);
                Pass();
                if (k == 0) Shader.SetGlobalColor("_IslandBounce", Color.black);
            }
            // The sky, patch by patch.
            Shader.SetGlobalFloat("_IslandPass", 2);
            foreach (var (dir, col) in Sky(toSun))
            {
                if (Only == "sun") break;
                sun.transform.rotation = Quaternion.LookRotation(-dir);
                float m = Mathf.Max(col.r, Mathf.Max(col.g, col.b));
                // (A light's colour is given in display terms: Unity takes it to linear itself.)
                sun.color = (col / m).gamma; sun.intensity = m;
                Pass();
            }
            // Back as it was, for anything rendered the old way.
            Shader.SetGlobalFloat("_IslandPass", 0);
            Shader.SetGlobalFloat("_IslandSelf", 1);
            sun.transform.rotation = sunRot; sun.color = sunCol; sun.intensity = sunInt;
            cam.targetTexture = null;

            RenderTexture.active = acc;
            var big = new Texture2D(rw, rh, TextureFormat.RGBAFloat, false, true);
            big.ReadPixels(new Rect(0, 0, rw, rh), 0, 0);
            RenderTexture.active = null;
            var src = big.GetPixels();
            Object.DestroyImmediate(big); Object.DestroyImmediate(rt); Object.DestroyImmediate(acc);

            var dst = new Color32[pw * ph];
            byte B(float lin) => (byte)Mathf.Round(Grade(Mathf.LinearToGammaSpace(Knee(lin))) * 255);
            for (int y = 0; y < ph; y++)
                for (int x = 0; x < pw; x++)
                {
                    float r = 0, g = 0, b = 0, a = 0;
                    for (int dy = 0; dy < ss; dy++)
                        for (int dx = 0; dx < ss; dx++)
                        {
                            var c = src[(y * ss + dy) * rw + x * ss + dx];
                            float w = figure ? Mathf.Clamp01(c.a) : 1;
                            r += c.r * w; g += c.g * w; b += c.b * w; a += w;
                        }
                    if (a <= 0) { dst[y * pw + x] = new Color32(0, 0, 0, 0); continue; }
                    // Averaged in linear light, then toned.
                    dst[y * pw + x] = new Color32(B(r / a), B(g / a), B(b / a), figure ? (byte)Mathf.Round(a / (ss * ss) * 255) : (byte)255);
                }
            var tex = new Texture2D(pw, ph, TextureFormat.RGBA32, false, false);
            tex.SetPixels32(dst); tex.Apply();
            Directory.CreateDirectory(Path.GetDirectoryName(file));
            File.WriteAllBytes(file, tex.EncodeToPNG());
            Object.DestroyImmediate(tex);
            Debug.Log($"[island] lit {file} ({pw}×{ph}, {1 + SkyN} passes) in {(System.DateTime.Now - t0).TotalSeconds:0.0}s");
        }
    }
}
