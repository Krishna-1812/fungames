// What sails and motors round the island, modelled to the people's scale
// (about 9 of the site's pixels a metre): a sailing dinghy-cruiser (7 m) with
// its mast, boom, mainsail and jib; the ferry (13 m) with its cabin and
// wheelhouse; fishing boats (9 m); a speedboat (5 m); rowing boats (3.5 m).
// Only what is above the water is built (the sea hides the rest). Each faces
// +z (its bow) when built, and is turned to its heading like everything else.
//
// A boat that moves leaves a wake: WakeOf flattens a V of foam behind it
// onto the water, rendered as a mask (IslandBuild.ActorShots) that
// scripts/unity-actors.mjs lays under the boat in white.
using UnityEngine;

namespace Island
{
    public static partial class Buildings
    {
        /**
         * A hull, lofted from its sections: L long, B in the beam, F of
         * freeboard (deck above the water), its sheer rising to the bow, a
         * pointed bow and a flat transom; the topsides in its colour with a
         * white stripe under the deck edge, and a deck (or, `open`, a floor
         * inside it, as a rowing boat has).
         */
        static void Hull(Bm b, float L, float B, float F, Color side, Color deck, bool open = false)
        {
            int n = 18;
            var stripe = Real("#f4f6fc", Paint);
            Vector3[] up = new Vector3[n + 1], low = new Vector3[n + 1], mid = new Vector3[n + 1];
            float Half(float z)
            {
                float t = z / (L / 2);
                return z >= 0 ? B / 2 * Mathf.Pow(Mathf.Max(0, 1 - Mathf.Pow(t, 2.2f)), 0.55f) : B / 2 * Mathf.Lerp(1, 0.84f, t * t);
            }
            for (int k = 0; k <= n; k++)
            {
                float z = -L / 2 + L * k / n, hb = Half(z), y = F * (1 + 0.35f * Mathf.Pow(Mathf.Max(0, z / (L / 2)), 2));
                up[k] = new Vector3(hb, y, z); mid[k] = new Vector3(hb * 0.99f, y - F * 0.18f, z); low[k] = new Vector3(hb * 0.86f, 0, z);
            }
            foreach (var s in new[] { -1f, 1f })
            {
                Vector3 S(Vector3 p) => new Vector3(p.x * s, p.y, p.z);
                for (int k = 0; k < n; k++)
                {
                    b.Quad(S(low[k]), S(low[k + 1]), S(mid[k + 1]), S(mid[k]), side, Paint);
                    b.Quad(S(mid[k]), S(mid[k + 1]), S(up[k + 1]), S(up[k]), stripe, Paint);
                }
            }
            // The deck, or the floor of an open boat with its sides' inner faces.
            float dy = open ? F * 0.8f : 0;
            for (int k = 0; k < n; k++)
                b.Quad(new Vector3(-up[k].x, up[k].y - dy, up[k].z), new Vector3(up[k].x, up[k].y - dy, up[k].z), new Vector3(up[k + 1].x, up[k + 1].y - dy, up[k + 1].z), new Vector3(-up[k + 1].x, up[k + 1].y - dy, up[k + 1].z), deck, Timber);
            if (open)
                foreach (var s in new[] { -1f, 1f })
                    for (int k = 0; k < n; k++)
                        b.Quad(new Vector3(up[k].x * s * 0.94f, up[k].y, up[k].z), new Vector3(up[k + 1].x * s * 0.94f, up[k + 1].y, up[k + 1].z), new Vector3(up[k + 1].x * s * 0.94f, up[k + 1].y - dy, up[k + 1].z), new Vector3(up[k].x * s * 0.94f, up[k].y - dy, up[k].z), deck, Timber);
            // The transom.
            b.Quad(new Vector3(-low[0].x, 0, low[0].z), new Vector3(low[0].x, 0, low[0].z), new Vector3(up[0].x, up[0].y, up[0].z), new Vector3(-up[0].x, up[0].y, up[0].z), side, Paint);
            // A rubbing strake along the deck edge.
            foreach (var s in new[] { -1f, 1f })
                for (int k = 0; k < n; k++) Tube(b, new Vector3(up[k].x * s, up[k].y, up[k].z), new Vector3(up[k + 1].x * s, up[k + 1].y, up[k + 1].z), 0.0055f, Real("#c9cde0", Paint), Paint, 5);
        }

        /** A sail: a triangle (tack, head, clew), bellied a little to leeward, in sailcloth. */
        static void Sail(Bm b, Vector3 tack, Vector3 head, Vector3 clew, float belly, Color col)
        {
            int n = 8;
            var side = Vector3.right * belly;
            for (int k = 0; k < n; k++)
                for (int q = 0; q < n - k; q++)
                {
                    Vector3 P(int i, int j)
                    {
                        float u = (float)i / n, v = (float)j / n;
                        var p = tack + (head - tack) * v + (clew - tack) * u;
                        return p + side * Mathf.Sin(Mathf.PI * Mathf.Clamp01(u + v)) * (1 - v) * 4 * u * (1 - u - v + 0.25f);
                    }
                    b.Tri(P(q, k), P(q + 1, k), P(q, k + 1), col, Cloth);
                    if (q + k + 1 < n) b.Tri(P(q + 1, k), P(q + 1, k + 1), P(q, k + 1), col, Cloth);
                }
        }

        static Bm Sailboat(ActorRec a)
        {
            var b = new Bm();
            float L = 1.4f, B = 0.46f, F = 0.11f;
            Hull(b, L, B, F, Real("#" + a.shirt, Paint), Real("#d8d2e8", Timber));
            // A low cabin top, its windows, and the cockpit behind it.
            Round(b, new Vector3(0, F + 0.035f, 0.05f), new Vector3(0.15f, 0.04f, 0.26f), 0.3f, Real("#f4f6fc", Paint), Paint);
            foreach (var s in new[] { -1f, 1f }) Round(b, new Vector3(s * 0.147f, F + 0.05f, 0.06f), new Vector3(0.006f, 0.012f, 0.12f), 0.3f, Real("#4b5a78", Glass), Glass, 8, 6);
            // The mast, the boom, the forestay and the backstay.
            var steel = Real("#c9cde0", Metal); var mastFoot = new Vector3(0, F, 0.22f); var mastHead = new Vector3(0, F + 1.62f, 0.22f);
            Tube(b, mastFoot, mastHead, 0.011f, steel, Metal, 8);
            var gooseneck = mastFoot + Vector3.up * 0.2f; var boomEnd = new Vector3(0.09f, F + 0.21f, -0.5f);
            Tube(b, gooseneck, boomEnd, 0.009f, steel, Metal, 8);
            var bow = new Vector3(0, F * 1.35f, L / 2 - 0.02f);
            Tube(b, bow, mastFoot + Vector3.up * 1.4f, 0.0025f, steel, Metal, 4);
            Tube(b, new Vector3(0, F, -L / 2 + 0.03f), mastHead, 0.0025f, steel, Metal, 4);
            // The mainsail and the jib, full of wind.
            var cloth = Real("#f7f8fc", Cloth);
            Sail(b, gooseneck + Vector3.up * 0.01f, mastHead - Vector3.up * 0.04f, boomEnd + Vector3.up * 0.01f, 0.07f, cloth);
            Sail(b, bow + Vector3.up * 0.02f, mastFoot + Vector3.up * 1.36f, new Vector3(0.12f, F + 0.12f, -0.02f), 0.05f, cloth);
            return b;
        }

        static Bm Ferry(ActorRec a)
        {
            var b = new Bm();
            float L = 2.6f, B = 0.82f, F = 0.16f;
            var white = Real("#f4f6fc", Paint); var glass = Real("#7f92ad", Glass); var blue = Real("#5b82ff", Paint);
            Hull(b, L, B, F, white, Real("#c3c8de", Timber));
            // The passenger cabin: a long box, windows all round, a roof deck with a rail.
            Round(b, new Vector3(0, F + 0.14f, -0.15f), new Vector3(0.34f, 0.14f, 0.85f), 0.12f, white, Paint, 24, 12);
            Round(b, new Vector3(0, F + 0.17f, -0.15f), new Vector3(0.343f, 0.055f, 0.8f), 0.1f, glass, Glass, 24, 8, d => Mathf.Abs(d.y) < 0.9f);
            Round(b, new Vector3(0, F + 0.035f, -0.15f), new Vector3(0.345f, 0.018f, 0.86f), 0.1f, blue, Paint, 24, 6);
            // The wheelhouse forward of it, up on the roof, and the funnel and mast.
            Round(b, new Vector3(0, F + 0.36f, 0.48f), new Vector3(0.22f, 0.09f, 0.18f), 0.15f, white, Paint, 18, 10);
            Round(b, new Vector3(0, F + 0.38f, 0.48f), new Vector3(0.223f, 0.04f, 0.181f), 0.12f, glass, Glass, 18, 8, d => Mathf.Abs(d.y) < 0.9f);
            Round(b, new Vector3(0, F + 0.46f, -0.35f), new Vector3(0.07f, 0.12f, 0.09f), 0.4f, Real("#ff4f6e", Paint), Paint, 14, 10);
            Round(b, new Vector3(0, F + 0.56f, -0.35f), new Vector3(0.072f, 0.02f, 0.092f), 0.4f, Real("#2c355e", Paint), Paint, 14, 6);
            Tube(b, new Vector3(0, F + 0.45f, 0.55f), new Vector3(0, F + 0.95f, 0.55f), 0.008f, Real("#c9cde0", Metal), Metal, 6);
            // A rail round the roof.
            var rail = Real("#c9cde0", Metal);
            for (int k = -4; k <= 3; k++) foreach (var s in new[] { -1f, 1f }) Tube(b, new Vector3(s * 0.32f, F + 0.28f, k * 0.2f), new Vector3(s * 0.32f, F + 0.36f, k * 0.2f), 0.004f, rail, Metal, 4);
            foreach (var s in new[] { -1f, 1f }) Tube(b, new Vector3(s * 0.32f, F + 0.36f, -0.85f), new Vector3(s * 0.32f, F + 0.36f, 0.62f), 0.004f, rail, Metal, 4);
            // Lifebuoys on the cabin sides.
            foreach (var s in new[] { -1f, 1f }) Hoop(b, new Vector3(s * 0.35f, F + 0.13f, 0.3f), Vector3.forward, Vector3.up, 0.04f, 0.011f, Real("#ff4f6e", Paint), Paint, 16);
            return b;
        }

        static Bm Fishing(ActorRec a)
        {
            var b = new Bm();
            float L = 1.8f, B = 0.6f, F = 0.15f;
            Hull(b, L, B, F, Real("#" + a.shirt, Paint), Real("#b7aecf", Timber));
            var white = Real("#f4f6fc", Paint); var glass = Real("#7f92ad", Glass);
            // The wheelhouse aft of the middle, its windows, and the gear: a mast with a derrick, nets, buoys.
            Round(b, new Vector3(0, F + 0.14f, -0.25f), new Vector3(0.2f, 0.14f, 0.22f), 0.15f, white, Paint, 18, 12);
            Round(b, new Vector3(0, F + 0.21f, -0.25f), new Vector3(0.203f, 0.045f, 0.223f), 0.12f, glass, Glass, 18, 8, d => Mathf.Abs(d.y) < 0.9f);
            Round(b, new Vector3(0, F + 0.29f, -0.25f), new Vector3(0.21f, 0.012f, 0.235f), 0.2f, Real("#2c355e", Paint), Paint, 14, 6);
            var steel = Real("#c9cde0", Metal);
            var foot = new Vector3(0, F, 0.3f);
            Tube(b, foot, foot + Vector3.up * 0.95f, 0.012f, steel, Metal, 8);
            Tube(b, foot + Vector3.up * 0.85f, new Vector3(0, F + 0.2f, 0.75f), 0.006f, steel, Metal, 6);
            Tube(b, foot + Vector3.up * 0.85f, new Vector3(0, F + 0.18f, -0.75f), 0.006f, steel, Metal, 6);
            Round(b, new Vector3(0.05f, F + 0.04f, 0.55f), new Vector3(0.12f, 0.04f, 0.14f), 0.7f, Real("#9aa3c0", Cloth), Cloth, 12, 8);
            foreach (var z in new[] { 0.5f, 0.62f }) Round(b, new Vector3(-0.15f, F + 0.03f, z), new Vector3(0.03f, 0.03f, 0.03f), 0.9f, Real("#ff4f6e", Paint), Paint, 8, 6);
            Round(b, foot + Vector3.up * 0.97f, new Vector3(0.05f, 0.022f, 0.004f), 0.5f, Real("#ff4f6e", Cloth), Cloth, 6, 4);
            return b;
        }

        static Bm Speedboat(ActorRec a)
        {
            var b = new Bm();
            float L = 1.0f, B = 0.42f, F = 0.1f;
            Hull(b, L, B, F, Real("#" + a.shirt, Paint), Real("#f4f6fc", Paint));
            Round(b, new Vector3(0, F + 0.05f, 0.05f), new Vector3(0.16f, 0.05f, 0.02f), 0.3f, Real("#8ea4bf", Glass), Glass, 12, 6);
            Round(b, new Vector3(0, F + 0.02f, -0.15f), new Vector3(0.14f, 0.025f, 0.16f), 0.4f, Real("#e6e9f6", Cloth), Cloth, 12, 6);
            // The driver.
            var p = Person(new ActorRec { name = a.name, kind = "person", shirt = "ff4f6e", skin = "d3a27f", hat = "0", v = 11, pose = "sit", facing = "se", frame = 0 });
            p.Apply(Matrix4x4.Translate(new Vector3(0, F + 0.04f - PersonHeight * 0.5f, -0.08f)));
            b.Append(p);
            Round(b, new Vector3(0, F + 0.01f, -L / 2 - 0.03f), new Vector3(0.06f, 0.06f, 0.035f), 0.4f, Real("#25262c", Paint), Paint, 10, 8);
            return b;
        }

        static Bm Rowboat(ActorRec a)
        {
            var b = new Bm();
            float L = 0.7f, B = 0.3f, F = 0.07f;
            Hull(b, L, B, F, Real("#" + a.shirt, Paint), Real("#9b8bd6", Timber), true);
            var wood = Real("#9b8bd6", Timber);
            foreach (var z in new[] { -0.12f, 0.1f }) Slab(b, z - 0.022f, -0.13f, z + 0.022f, 0.13f, F * IslandBuild.PxPerHeight * 0.55f, F * IslandBuild.PxPerHeight * 0.65f, wood, Timber);
            foreach (var s in new[] { -1f, 1f }) Tube(b, new Vector3(s * 0.14f, F, 0.0f), new Vector3(s * 0.04f, F * 0.9f, -0.3f), 0.006f, wood, Timber, 6);
            return b;
        }

        /** The foam a moving boat leaves on the water: a wave off each side of the bow, spreading behind, and the wash astern. */
        static Bm WakeOf(ActorRec a)
        {
            float L = a.kind == "ferry" ? 2.6f : a.kind == "fishing" ? 1.8f : a.kind == "speed" ? 1.0f : a.kind == "row" ? 0.7f : 1.4f;
            float B = L * 0.32f, spread = a.kind == "speed" ? 0.36f : 0.26f, back = a.kind == "speed" ? 0.9f : 0.6f;
            var b = new Bm(); var white = Color.white;
            var rnd = new System.Random(a.name.GetHashCode());
            float R() => (float)rnd.NextDouble();
            void Patch(Vector3 c, float r)
            {
                // A ragged patch of foam: a few overlapping flecks.
                for (int k = 0; k < 3; k++)
                {
                    var o = c + new Vector3((R() - 0.5f) * r, 0, (R() - 0.5f) * r);
                    float rr = r * (0.4f + R() * 0.5f), t = R() * 3.14f;
                    var u = new Vector3(Mathf.Cos(t), 0, Mathf.Sin(t)) * rr; var v = new Vector3(-Mathf.Sin(t), 0, Mathf.Cos(t)) * rr * 0.6f;
                    b.Quad(o - u - v, o + u - v, o + u + v, o - u + v, white, Paint);
                }
            }
            // The bow wave: along each arm of the V, back from the bow, thinning and breaking up.
            foreach (var s in new[] { -1f, 1f })
                for (int k = 0; k < 26; k++)
                {
                    float t = k / 25f;
                    if (R() < t * 0.55f) continue;
                    var p = new Vector3(s * (B * 0.48f + t * L * back * spread * 2), 0, L * 0.42f - t * (L + L * back));
                    Patch(p, Mathf.Lerp(0.035f, 0.014f, t) * (a.kind == "ferry" ? 1.5f : 1));
                }
            // The wash astern, churned white close behind and fading.
            for (int k = 0; k < 22; k++)
            {
                float t = k / 21f;
                if (R() < t * 0.6f) continue;
                Patch(new Vector3((R() - 0.5f) * B * (0.6f + t * 0.6f), 0, -L / 2 - t * L * back * 0.9f), Mathf.Lerp(0.05f, 0.018f, t) * (a.kind == "ferry" ? 1.4f : 1));
            }
            b.Apply(Matrix4x4.Translate(Vector3.up * 0.002f));
            return b;
        }
    }
}
