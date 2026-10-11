// Value noise and its sums, the same everywhere for the same input: the
// island's ground is made from these, so a render is the same every time.
using UnityEngine;

namespace Island
{
    public static class Noise
    {
        static float Hash(int x, int y, int seed)
        {
            unchecked
            {
                uint h = (uint)(x * 374761393 + y * 668265263 + seed * 1442695041);
                h = (h ^ (h >> 13)) * 1274126177u;
                h ^= h >> 16;
                return (h & 0xffffff) / (float)0xffffff;
            }
        }

        /** Smooth value noise in 0..1. */
        public static float Value(float x, float y, int seed = 0)
        {
            int xi = Mathf.FloorToInt(x), yi = Mathf.FloorToInt(y);
            float fx = x - xi, fy = y - yi;
            fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
            float a = Hash(xi, yi, seed), b = Hash(xi + 1, yi, seed), c = Hash(xi, yi + 1, seed), d = Hash(xi + 1, yi + 1, seed);
            return Mathf.Lerp(Mathf.Lerp(a, b, fx), Mathf.Lerp(c, d, fx), fy);
        }

        /** A sum of octaves, each twice as fine and half as strong: 0..1, centred on 0.5. */
        public static float Fbm(float x, float y, int octaves, int seed = 0)
        {
            float sum = 0, amp = 0.5f, norm = 0;
            for (int o = 0; o < octaves; o++)
            {
                sum += Value(x, y, seed + o * 31) * amp;
                norm += amp; amp *= 0.5f; x *= 2.03f; y *= 2.03f;
            }
            return sum / norm;
        }

        /** Cells: the distance to the nearest of a jittered grid of points, and to the second nearest (for cracks and stones). */
        public static Vector2 Cells(float x, float y, int seed = 0)
        {
            int xi = Mathf.FloorToInt(x), yi = Mathf.FloorToInt(y);
            float d1 = 9, d2 = 9;
            for (int a = -1; a <= 1; a++)
                for (int b = -1; b <= 1; b++)
                {
                    float px = xi + a + Hash(xi + a, yi + b, seed), py = yi + b + Hash(xi + a, yi + b, seed + 7);
                    float d = (px - x) * (px - x) + (py - y) * (py - y);
                    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
                }
            return new Vector2(Mathf.Sqrt(d1), Mathf.Sqrt(d2));
        }
    }
}
