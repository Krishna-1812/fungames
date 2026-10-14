// The river's falls: where it steps down a terrace, a sheet of water leaving the lip and
// curving out as it drops, streaked and breaking white on the way down (Building.shader,
// material 12), and foam on the water at its foot. The ground under it (Terrain3D) is
// the rock face the river runs over; this is the water, standing just off it.
using UnityEngine;

namespace Island
{
    public static partial class Buildings
    {
        public const int Falling = 12;

        public static Mesh Falls(IslandData d, Terrain3D ground)
        {
            var b = new Bm();
            if (d.river == null) return null;
            int made = 0;
            for (int k = 0; k + 3 < d.river.Length; k += 2)
            {
                int i = d.river[k], j = d.river[k + 1], ni = d.river[k + 2], nj = d.river[k + 3];
                float h = d.Z(i, j), hd = d.Z(ni, nj);
                // Only a real drop down a terrace (a cliff): a gentle bank the ground's foam has.
                if (h - hd < 6 || nj != j + 1 || ni != i) continue;
                Fall(b, ground, i + 0.5f, j + 1, h, hd, made++);
            }
            // And over the cliff at the end, into the sea.
            int li = d.river[d.river.Length - 2], lj = d.river[d.river.Length - 1];
            if (!d.Land(li, lj + 1) && d.Z(li, lj) - d.sea >= 6) Fall(b, ground, li + 0.5f, lj + 1, d.Z(li, lj), d.sea, made++);
            if (made == 0) return null;
            Debug.Log($"[island] falls: {made}");
            return b.Mesh("falls");
        }

        /** One fall: across u = c ± 0.15, from the lip near v = edge down to height hd. */
        static void Fall(Bm b, Terrain3D ground, float c, float edge, float h, float hd, int seed)
        {
            const int Cols = 10, Rows = 18;
            const float half = 0.15f;
            // Where the ground leaves the top and where it reaches the bottom, along the river's middle.
            float Find(float z, float from)
            {
                float v = from;
                for (int s = 0; s < 200 && ground.H(c, v) > z; s++) v += 0.004f;
                return v;
            }
            float lip = Find(h - 0.4f, edge - 0.45f), foot = Find(hd + 0.4f, lip);
            float reach = foot - lip + 0.06f;
            var pts = new Vector3[Cols + 1, Rows + 1];
            for (int r = 0; r <= Rows; r++)
            {
                float s = (float)r / Rows;
                float z = Mathf.Lerp(h + 0.25f, hd + 0.2f, s);
                for (int q = 0; q <= Cols; q++)
                {
                    float u = c - half + 2 * half * q / Cols;
                    // A jet: out fast at the top, then mostly down; never into the rock.
                    float v = lip + reach * Mathf.Sqrt(s);
                    float rock = Find(z, lip - 0.02f);
                    v = Mathf.Max(v, rock + 0.035f);
                    // The sheet sags a little towards its middle, as water does over a lip.
                    float bow = 1 - Mathf.Pow(2f * q / Cols - 1, 2);
                    pts[q, r] = W(u, v + 0.015f * bow * Mathf.Sqrt(s), z);
                }
            }
            for (int r = 0; r < Rows; r++)
                for (int q = 0; q < Cols; q++)
                    b.QuadUV(pts[q, r + 1], pts[q + 1, r + 1], pts[q + 1, r], pts[q, r], Color.white, Falling,
                        new Vector2((float)q / Cols, (float)(r + 1) / Rows), new Vector2((float)(q + 1) / Cols, (float)r / Rows));
            // Foam where it lands: a ragged patch on the water (uv.y from 1 at its middle to 2 at its edge, past the sheet's own 0..1).
            const int Rings = 5, Spokes = 20;
            float fx = c, fy = foot + 0.1f, fz = hd + 0.12f;
            for (int a = 0; a < Rings; a++)
                for (int s = 0; s < Spokes; s++)
                {
                    float r0 = 0.25f * a / Rings, r1 = 0.25f * (a + 1) / Rings;
                    float t0 = Mathf.PI * 2 * s / Spokes, t1 = Mathf.PI * 2 * (s + 1) / Spokes;
                    Vector3 P(float rr, float t) => W(fx + Mathf.Cos(t) * rr, fy + Mathf.Sin(t) * rr * 0.8f, fz);
                    b.QuadUV(P(r0, t0), P(r0, t1), P(r1, t1), P(r1, t0), Color.white, Falling,
                        new Vector2(0.5f, 1 + (float)a / Rings + 0.001f), new Vector2(0.5f, 1 + (float)(a + 1) / Rings));
                }
        }
    }
}
