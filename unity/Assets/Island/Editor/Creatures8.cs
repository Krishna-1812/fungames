// The last of the island's moving things the site drew flat, rendered alone like the animals
// (IslandBuild.ActorShots) and moved by the page: the superyacht at Spend It, bobbing at anchor;
// the atom over the Tower of Scales, turning (24 frames, as the globe); a harbour buoy; the
// Internet Museum's balloon, a pixel face in silver foil with a rainbow streamer; the stork
// bringing another baby to Every Second. Each faces +z when built.
using UnityEngine;

namespace Island
{
    public static partial class Buildings
    {
        static bool MoreCreatures(Bm b, ActorRec a)
        {
            switch (a.kind)
            {
                case "yacht": Yacht(b, a); return true;
                case "atom": Atom(b, a); return true;
                case "buoy": Buoy(b, a); return true;
                case "pixelballoon": PixelBalloon(b, a); return true;
                case "stork": Stork(b, a); return true;
                case "cart": Cart(b, a); return true;
                case "jetski": JetSki(b, a); return true;
                case "bottle":
                    // A message in a bottle, afloat: the beached one (Models.cs, Bottle), sunk to its middle.
                    Bottle(b, new SolidRec { x = 0, y = 0, z = 0, fill = "#" + a.shirt });
                    b.Apply(Matrix4x4.Translate(Vector3.down * Hy(4)));
                    return true;
                default: return false;
            }
        }

        /**
         * A superyacht at anchor, its waterline at y 0: a long white hull with a raked bow and a dark boot
         * stripe, a teak deck with a rail round it, three tiers of superstructure each with its band of dark
         * glass, a radar arch and dome, a mast with its pennant, a helipad aft and a pool forward.
         */
        static void Yacht(Bm b, ActorRec a)
        {
            var white = Real("#f6f7f9", Paint); var stripe = Real("#" + a.shirt, Paint); var navy = Real("#1b2238", Paint);
            var teak = Real("#a7835c", Timber); var glass = Real("#1c2335", Paint); var steel = Real("#d9dde5", Metal);
            var pad = Real("#8d929e", Concrete); var pool = Real("#58c4d8", Glass); var flag = Real("#4fe3c1", Cloth);
            const float L = 3.0f;
            const int N = 48;
            // Along the hull (s 0 stern .. 1 bow): half its beam at the deck, the deck's height (its sheer rising to the bow),
            // and how far forward of its foot the deck reaches there (the stem's rake).
            float Half(float s) => s < 0.5f ? 0.3f - 0.03f * Mathf.Pow((0.5f - s) / 0.5f, 2) : 0.3f * Mathf.Pow(Mathf.Max(0, (1 - s) / 0.5f), 0.62f);
            float Deck(float s) => 0.3f + 0.13f * s * s;
            float Rake(float s) => 0.32f * Mathf.Pow(Mathf.Max(0, (s - 0.62f) / 0.38f), 1.6f);
            float Z(float s) => (s - 0.5f) * L;
            // A point on its side: t 0 the waterline .. 1 the deck edge; the topsides flare out as they rise, the bow raked back below.
            Vector3 Side(float s, float t, float side)
            {
                float w = Half(s) * (0.8f + 0.2f * Mathf.Sqrt(t)), z = Z(s) - Rake(s) * (1 - t);
                return new Vector3(side * w, Deck(s) * t, z);
            }
            // Colour up the side: the boot stripe at the water, white, a dark sheer line under the deck edge, white again.
            (float t0, float t1, Color c)[] bands = { (0, 0.1f, stripe), (0.1f, 0.13f, white), (0.13f, 0.78f, white), (0.78f, 0.83f, navy), (0.83f, 1, white) };
            for (int i = 0; i < N; i++)
            {
                float s0 = (float)i / N, s1 = (float)(i + 1) / N;
                foreach (var side in new[] { -1f, 1f })
                    foreach (var (t0, t1, c) in bands)
                    {
                        if (side > 0) b.Quad(Side(s0, t0, side), Side(s1, t0, side), Side(s1, t1, side), Side(s0, t1, side), c, Paint);
                        else b.Quad(Side(s1, t0, side), Side(s0, t0, side), Side(s0, t1, side), Side(s1, t1, side), c, Paint);
                    }
                // The deck: teak, a white margin at its edge, and a low bulwark round it.
                Vector3 D(float s, float x, float up = 0) => new Vector3(x * Half(s), Deck(s) + up, Z(s));
                b.Quad(D(s0, -0.88f), D(s0, 0.88f), D(s1, 0.88f), D(s1, -0.88f), teak, Timber);
                foreach (var sd in new[] { -1f, 1f })
                {
                    b.Quad(D(s0, 0.88f * sd), D(s0, sd), D(s1, sd), D(s1, 0.88f * sd), white, Paint);
                    b.Quad(D(s0, sd), D(s1, sd), D(s1, sd, 0.035f), D(s0, sd, 0.035f), white, Paint);
                }
            }
            // The transom, with a bathing platform at the water.
            for (int q = 0; q < 8; q++)
            {
                float t0 = q / 8f, t1 = (q + 1) / 8f;
                b.Quad(Side(0, t0, -1), Side(0, t0, 1), Side(0, t1, 1), Side(0, t1, -1), t1 <= 0.13f ? stripe : white, Paint);
            }
            // A row of windows along each side of the hull (the cabins below).
            foreach (var side in new[] { -1f, 1f })
                for (float s = 0.2f; s < 0.72f; s += 0.045f)
                {
                    Vector3 Wn(float ss, float t) => Side(ss, t, side) + new Vector3(side * 0.003f, 0, 0);
                    var q0 = Wn(s, 0.5f); var q1 = Wn(s + 0.03f, 0.5f); var q2 = Wn(s + 0.03f, 0.62f); var q3 = Wn(s, 0.62f);
                    if (side > 0) b.Quad(q0, q1, q2, q3, glass, Paint); else b.Quad(q1, q0, q3, q2, glass, Paint);
                }
            // The rail: stanchions and a top line round the deck.
            foreach (var side in new[] { -1f, 1f })
            {
                Vector3 prev = Vector3.zero;
                for (int i = 0; i <= 26; i++)
                {
                    float s = 0.02f + 0.93f * i / 26;
                    var foot = new Vector3(side * Half(s) * 0.97f, Deck(s) + 0.035f, Z(s)); var top = foot + Vector3.up * 0.045f;
                    Tube(b, foot, top, 0.003f, steel, Metal, 4);
                    if (i > 0) Tube(b, prev, top, 0.0028f, steel, Metal, 4);
                    prev = top;
                }
            }
            // The superstructure: three decks stepping back, each with its raked front, a band of dark glass all round.
            float y = Deck(0.42f);
            (float s0, float s1, float hw, float h, float rake)[] tiers = { (0.13f, 0.76f, 0.24f, 0.19f, 0.22f), (0.22f, 0.66f, 0.205f, 0.16f, 0.2f), (0.31f, 0.56f, 0.165f, 0.13f, 0.14f) };
            foreach (var (ta, tb, hw, h, rk) in tiers)
            {
                float z0 = Z(ta), z1 = Z(tb);
                // A box with rounded corners in plan, its front leaning back (the windscreen).
                const int R = 10;
                Vector3[] Plan(float yy, float front)
                {
                    var pts = new Vector3[R * 4];
                    float cr = hw * 0.45f;
                    for (int k = 0; k < R * 4; k++)
                    {
                        int qd = k / R; float an = (k % R) / (float)(R - 1) * Mathf.PI / 2;
                        float cx = qd == 0 || qd == 3 ? hw - cr : -(hw - cr), cz = qd < 2 ? front - cr : z0 + cr;
                        float a0 = qd * Mathf.PI / 2;
                        pts[k] = new Vector3(cx + Mathf.Cos(a0 + an) * cr * (qd == 0 || qd == 3 ? 1 : 1), yy, cz + Mathf.Sin(a0 + an) * cr);
                    }
                    return pts;
                }
                var lo = Plan(y, z1); var mid = Plan(y + h * 0.45f, z1 - rk * h * 0.45f / h * 0.5f); var hi = Plan(y + h, z1 - rk * 0.5f);
                for (int k = 0; k < lo.Length; k++)
                {
                    int k2 = (k + 1) % lo.Length;
                    b.Quad(lo[k], lo[k2], mid[k2], mid[k], white, Paint);
                    b.Quad(mid[k], mid[k2], hi[k2], hi[k], glass, Paint);
                }
                // Its roof, white, overhanging a little.
                var c = Vector3.zero; foreach (var p in hi) c += p; c /= hi.Length;
                for (int k = 0; k < hi.Length; k++) { int k2 = (k + 1) % hi.Length; var e0 = c + (hi[k] - c) * 1.06f + Vector3.up * 0.012f; var e1 = c + (hi[k2] - c) * 1.06f + Vector3.up * 0.012f; b.Tri(c + Vector3.up * 0.012f, e1, e0, white, Paint); b.Quad(hi[k], hi[k2], e1, e0, white, Paint); }
                y += h + 0.012f;
            }
            // The radar arch, its dome, the mast and its pennant.
            float zA = Z(0.4f);
            foreach (var side in new[] { -1f, 1f }) Tube(b, new Vector3(side * 0.13f, y, zA), new Vector3(side * 0.04f, y + 0.14f, zA - 0.03f), 0.014f, white, Paint, 8);
            Tube(b, new Vector3(-0.045f, y + 0.14f, zA - 0.03f), new Vector3(0.045f, y + 0.14f, zA - 0.03f), 0.016f, white, Paint, 8);
            Ball(b, new Vector3(0, y + 0.2f, zA - 0.03f), 0.05f, -1, white, Paint);
            Tube(b, new Vector3(0, y, Z(0.48f)), new Vector3(0, y + 0.36f, Z(0.48f)), 0.007f, steel, Metal, 6);
            var pt = new Vector3(0, y + 0.36f, Z(0.48f));
            b.Quad(pt, pt + new Vector3(0, -0.012f, -0.13f), pt + new Vector3(0, -0.062f, -0.12f), pt + new Vector3(0, -0.065f, 0), flag, Cloth);
            // The helipad aft: a grey circle, a white ring and an H.
            float zH = Z(0.09f) + 0.06f, yH = Deck(0.09f) + 0.004f;
            for (int q = 0; q < 36; q++)
            {
                float a0 = q * Mathf.PI * 2 / 36, a1 = (q + 1) * Mathf.PI * 2 / 36;
                Vector3 C(float an, float rr) => new Vector3(Mathf.Sin(an) * rr, yH, zH + Mathf.Cos(an) * rr);
                b.Tri(new Vector3(0, yH, zH), C(a1, 0.2f), C(a0, 0.2f), pad, Concrete);
                b.Quad(C(a0, 0.165f), C(a1, 0.165f), C(a1, 0.18f), C(a0, 0.18f), white, Paint);
            }
            foreach (var (x0, z0, x1, z1) in new[] { (-0.065f, -0.07f, -0.042f, 0.07f), (0.042f, -0.07f, 0.065f, 0.07f), (-0.042f, -0.012f, 0.042f, 0.012f) })
                b.Quad(new Vector3(x0, yH + 0.001f, zH + z0), new Vector3(x1, yH + 0.001f, zH + z0), new Vector3(x1, yH + 0.001f, zH + z1), new Vector3(x0, yH + 0.001f, zH + z1), white, Paint);
            // The pool forward, set into the deck.
            float zP = Z(0.83f), yP = Deck(0.83f) + 0.003f;
            b.Quad(new Vector3(-0.1f, yP, zP - 0.12f), new Vector3(0.1f, yP, zP - 0.12f), new Vector3(0.1f, yP, zP + 0.1f), new Vector3(-0.1f, yP, zP + 0.1f), pool, Glass);
        }

        /** An atom, as the vane over the Tower of Scales has it: a nucleus of red and grey, three rings round it, an electron on each; turned a 24th further each frame. */
        static void Atom(Bm b, ActorRec a)
        {
            int frame = a.pose.Length > 1 && int.TryParse(a.pose.Substring(1), out var fr) ? fr : 0;
            var red = Real("#d8424f", Paint); var grey = Real("#cfd3de", Paint); var e = Real("#f4f8ff", Paint);
            Color[] rings = { Real("#5b82ff", Metal), Real("#ff4f6e", Metal), Real("#4fe3c1", Metal) };
            var rnd = new System.Random(5);
            float R() => (float)rnd.NextDouble() - 0.5f;
            for (int q = 0; q < 9; q++)
                Ball(b, new Vector3(R(), R(), R()) * Px(3.2f), Px(1.45f), -1, q % 2 == 0 ? red : grey, Paint);
            float Rr = Px(13), tilt = 68 * Mathf.Deg2Rad;
            for (int k = 0; k < 3; k++)
            {
                float th = k * Mathf.PI * 2 / 3;
                var n = new Vector3(Mathf.Sin(tilt) * Mathf.Cos(th), Mathf.Cos(tilt), Mathf.Sin(tilt) * Mathf.Sin(th));
                var e1 = Vector3.Cross(n, Vector3.up).normalized; var e2 = Vector3.Cross(n, e1);
                Hoop(b, Vector3.zero, e1, e2, Rr, Px(0.55f), rings[k], Metal, 72);
                float an = frame * Mathf.PI * 2 / 8 + k * 2.1f;
                Ball(b, (e1 * Mathf.Cos(an) + e2 * Mathf.Sin(an)) * Rr, Px(1.25f), -1, e, Paint);
            }
            b.Apply(Matrix4x4.Rotate(Quaternion.Euler(0, frame * 15, 0)));
        }

        /** A harbour buoy, floating, waterline at y 0: a red float, a white band, a cage and a light on top. */
        static void Buoy(Bm b, ActorRec a)
        {
            var red = Real("#" + a.shirt, Paint); var white = Real("#f2f3f6", Paint); var dark = Real("#2c2f38", Metal); var lamp = Real("#ffe6a1", Glass);
            Lathe(b, 0, 0, -2, new[] { (0f, 0.09f), (2.5f, 0.1f), (3.2f, 0.085f), (8f, 0.05f), (8f, 0.05f), (11f, 0.04f), (11.5f, 0.04f), (12f, 0f) }, q => q == 3 ? white : red, Paint, 24);
            // (Lathe is in tiles about a ground point; here the creature's own origin, x = j, z = i: the same at 0, 0.)
            for (int k = 0; k < 4; k++)
            {
                float an = k * Mathf.PI / 2;
                Tube(b, new Vector3(Mathf.Sin(an) * 0.035f, Hy(10), Mathf.Cos(an) * 0.035f), new Vector3(Mathf.Sin(an) * 0.02f, Hy(15.5f), Mathf.Cos(an) * 0.02f), 0.004f, dark, Metal, 4);
            }
            Ball(b, new Vector3(0, Hy(16), 0), 0.018f, -1, lamp, Glass);
        }

        /** The Internet Museum's balloon (lm-funfair.ts): a puffy square of silver foil, a dark screen with a green pixel face, and a rainbow streamer of ribbons. */
        static void PixelBalloon(Bm b, ActorRec a)
        {
            var foil = Real("#e4e8f0", Metal); var screen = Real("#14202e", Glass); var px = Real("#4fe3c1", Paint);
            Round(b, Vector3.zero, new Vector3(0.21f, 0.21f, 0.07f), 0.32f, foil, Metal, 28, 14);
            var f = new Vector3(0, 0, 0.072f);
            void Sq(float x0, float y0, float x1, float y1, Color c, int m, float z = 0) => b.Quad(f + new Vector3(x0, y0, z), f + new Vector3(x1, y0, z), f + new Vector3(x1, y1, z), f + new Vector3(x0, y1, z), c, m);
            Sq(-0.15f, -0.12f, 0.15f, 0.13f, screen, Glass);
            Sq(-0.09f, 0.03f, -0.04f, 0.08f, px, Paint, 0.002f); Sq(0.04f, 0.03f, 0.09f, 0.08f, px, Paint, 0.002f);
            Sq(-0.09f, -0.06f, 0.09f, -0.03f, px, Paint, 0.002f);
            // The streamer: six ribbons side by side, rippling away behind it.
            string[] rainbow = { "ff4f6e", "f6f6f2", "4fe3c1", "8ccbff", "5b82ff", "b8a1ff" };
            for (int r = 0; r < 6; r++)
            {
                var col = Real("#" + rainbow[r], Cloth);
                for (int q = 0; q < 16; q++)
                {
                    float x0 = 0.2f + q * 0.05f, x1 = x0 + 0.05f;
                    float W0(float x) => 0.03f * Mathf.Sin(x * 14);
                    float y0 = 0.12f - r * 0.042f;
                    b.Quad(new Vector3(x1, y0 + W0(x1), 0.02f * Mathf.Sin(x1 * 9)), new Vector3(x0, y0 + W0(x0), 0.02f * Mathf.Sin(x0 * 9)), new Vector3(x0, y0 - 0.042f + W0(x0), 0.02f * Mathf.Sin(x0 * 9)), new Vector3(x1, y0 - 0.042f + W0(x1), 0.02f * Mathf.Sin(x1 * 9)), col, Cloth);
                }
            }
            // It faces the camera: turned so its face is towards us whatever its facing.
            b.Apply(Matrix4x4.Rotate(Quaternion.Euler(0, 45, 0)));
        }

        /** A jet ski at speed, waterline at y 0: a white hull with its colour along the top, a seat, bars, and its rider. */
        static void JetSki(Bm b, ActorRec a)
        {
            var white = Real("#f2f4f8", Paint); var col = Real("#" + a.shirt, Paint); var black = Real("#24262d", Paint);
            Round(b, new Vector3(0, 0.03f, 0), new Vector3(0.07f, 0.04f, 0.2f), 0.55f, white, Paint, 18, 10, d => d.y > -0.4f);
            Round(b, new Vector3(0, 0.07f, 0.03f), new Vector3(0.06f, 0.025f, 0.15f), 0.6f, col, Paint, 16, 8, d => d.y > 0);
            Round(b, new Vector3(0, 0.1f, -0.04f), new Vector3(0.03f, 0.015f, 0.07f), 0.7f, black, Paint, 10, 6);
            Tube(b, new Vector3(0, 0.09f, 0.1f), new Vector3(0, 0.15f, 0.08f), 0.008f, black, Paint, 6);
            Tube(b, new Vector3(-0.05f, 0.15f, 0.08f), new Vector3(0.05f, 0.15f, 0.08f), 0.007f, black, Paint, 6);
            var rider = Person(new ActorRec { name = a.name, kind = "person", shirt = "ffb36b", skin = "d3a27f", hat = "0", v = 21, pose = "sit", facing = "se", frame = 0 });
            if (rider != null) { rider.Apply(Matrix4x4.Translate(new Vector3(0, -0.035f, -0.05f))); b.Append(rider); }
        }

        /** The trolley problem's cart (lm-proving.ts): a steel tub in its colour on a low chassis, four flanged wheels for the rails. */
        static void Cart(Bm b, ActorRec a)
        {
            var body = Real("#" + a.shirt, Paint); var steel = Real("#7d8494", Metal); var dark = Real("#2a2d35", Metal); var rim = Real("#e9ecf2", Paint);
            Cuboid(b, new Vector3(0, 0.05f, 0), Vector3.right, Vector3.up, Vector3.forward, 0.12f, 0.012f, 0.22f, dark, Metal);
            // The tub: sides leaning out a little, open at the top, a pale rim round it.
            float h0 = 0.065f, h1 = 0.19f;
            Vector3[] lo = { new(-0.1f, h0, -0.2f), new(0.1f, h0, -0.2f), new(0.1f, h0, 0.2f), new(-0.1f, h0, 0.2f) };
            Vector3[] hi = { new(-0.125f, h1, -0.235f), new(0.125f, h1, -0.235f), new(0.125f, h1, 0.235f), new(-0.125f, h1, 0.235f) };
            for (int k = 0; k < 4; k++) { int k2 = (k + 1) % 4; b.Quad(lo[k], lo[k2], hi[k2], hi[k], body, Paint); }
            b.Quad(lo[0], lo[3], lo[2], lo[1], body * 0.6f, Paint);
            for (int k = 0; k < 4; k++) { int k2 = (k + 1) % 4; Tube(b, hi[k], hi[k2], 0.008f, rim, Paint, 6); }
            foreach (var x in new[] { -0.105f, 0.105f })
                foreach (var z in new[] { -0.14f, 0.14f })
                {
                    Hoop(b, new Vector3(x, 0.038f, z), Vector3.forward, Vector3.up, 0.032f, 0.008f, steel, Metal, 16);
                    Round(b, new Vector3(x, 0.038f, z), new Vector3(0.006f, 0.03f, 0.03f), 1, dark, Metal, 10, 6);
                }
        }

        /** A white stork in flight, wings spread, long neck forward, carrying a bundle in its beak. */
        static void Stork(Bm b, ActorRec a)
        {
            var white = Real("#f3f3ef", Paint); var black = Real("#202228", Paint); var beak = Real("#d9533b", Paint); var bundle = Real("#ffe1e8", Cloth); var cord = Real("#e8e2d0", Paint);
            // The body: a long egg, the tail tapering behind.
            Round(b, new Vector3(0, 0, 0.01f), new Vector3(0.045f, 0.04f, 0.115f), 0.95f, white, Paint, 18, 10);
            Round(b, new Vector3(0, 0.005f, -0.12f), new Vector3(0.03f, 0.012f, 0.05f), 0.9f, white, Paint, 10, 6);
            foreach (var side in new[] { -1f, 1f })
            {
                // A broad wing, gliding: white near the body, black flight feathers along its trailing edge and fingered at its tip.
                Vector3 W2(float x, float z, float y = 0) => new Vector3(side * x, 0.02f + y + 0.12f * x * x, z);
                int n = 8;
                for (int k = 0; k < n; k++)
                {
                    float x0 = 0.03f + 0.36f * k / n, x1 = 0.03f + 0.36f * (k + 1) / n;
                    float Lead(float x) => 0.07f - 0.05f * (x / 0.39f) * (x / 0.39f);
                    float Trail(float x) => -0.07f + 0.02f * (x / 0.39f);
                    float Mid(float x) => Mathf.Lerp(Trail(x), Lead(x), 0.45f + 0.25f * (x / 0.39f));
                    var col = x1 > 0.28f ? black : white;
                    b.Quad(W2(x0, Mid(x0)), W2(x1, Mid(x1)), W2(x1, Lead(x1)), W2(x0, Lead(x0)), col, Paint);
                    b.Quad(W2(x0, Trail(x0), -0.002f), W2(x1, Trail(x1), -0.002f), W2(x1, Mid(x1)), W2(x0, Mid(x0)), black, Paint);
                }
                // The primaries: five fingers spread at the tip.
                for (int q = 0; q < 5; q++)
                {
                    float z = 0.04f - q * 0.022f;
                    var root = W2(0.38f, z);
                    var tip = W2(0.47f - q * 0.012f, z - 0.01f - q * 0.006f, 0.01f);
                    var across = new Vector3(0, 0, 0.008f);
                    b.Quad(root - across, tip - across * 0.3f, tip + across * 0.3f, root + across, black, Paint);
                }
            }
            // The neck straight out ahead, the head, the long red bill, and the bundle hanging from it on a cord.
            Tube(b, new Vector3(0, 0.015f, 0.11f), new Vector3(0, 0.025f, 0.24f), 0.014f, white, Paint, 10);
            Round(b, new Vector3(0, 0.03f, 0.255f), new Vector3(0.017f, 0.018f, 0.024f), 0.95f, white, Paint, 12, 8);
            Tube(b, new Vector3(0, 0.026f, 0.275f), new Vector3(0, 0.012f, 0.37f), 0.0065f, beak, Paint, 8);
            foreach (var side in new[] { -1f, 1f }) Tube(b, new Vector3(side * 0.012f, -0.02f, -0.1f), new Vector3(side * 0.01f, -0.032f, -0.27f), 0.0045f, beak, Paint, 5);
            Tube(b, new Vector3(0, 0.012f, 0.35f), new Vector3(0, -0.07f, 0.35f), 0.002f, cord, Paint, 4);
            Round(b, new Vector3(0, -0.098f, 0.35f), new Vector3(0.036f, 0.03f, 0.03f), 0.85f, bundle, Cloth, 12, 8);
            Round(b, new Vector3(0, -0.068f, 0.35f), new Vector3(0.012f, 0.008f, 0.012f), 0.9f, bundle * 0.9f, Cloth, 8, 5);
        }
    }
}
