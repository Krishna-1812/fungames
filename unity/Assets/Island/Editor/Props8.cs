// The last of the island's small things the site used to draw flat, modelled (kit.ts, Pen.model):
// towels on the sand, the cottages' window boxes, a topiary ball in its pot, toadstools, a pram,
// an easel, a parked bicycle, the stork's nest, the trolley problem's railway, the Mint's conveyor,
// the sundial at Where Does The Day Go, a telescope on a tripod.
using UnityEngine;

namespace Island
{
    public static partial class Buildings
    {
        /** A small lumpy ball of leaves (a topiary, a window box's plants): clumps on a sphere, each its own green. */
        static void Leafy(Bm b, Vector3 c, Vector3 r, Color leaf, int seed, int clumps = 26)
        {
            var rnd = new System.Random(seed);
            float R() => (float)rnd.NextDouble();
            Round(b, c, r * 0.88f, 1, leaf * 0.7f, Paint, 12, 8);
            for (int k = 0; k < clumps; k++)
            {
                // Spread evenly over the ball (a spiral), each clump a little in or out.
                float t = Mathf.Acos(1 - 2 * (k + 0.5f) / clumps), a = k * 2.39996f;
                var d = new Vector3(Mathf.Sin(t) * Mathf.Sin(a), Mathf.Cos(t), Mathf.Sin(t) * Mathf.Cos(a));
                var o = c + Vector3.Scale(d, r) * (0.82f + 0.1f * R());
                float s = (0.32f + 0.12f * R()) * Mathf.Max(r.x, r.z);
                var col = leaf * (0.78f + 0.4f * R()); col.a = 1;
                // Lit from above more than below.
                col *= 0.85f + 0.25f * Mathf.Max(0, d.y);
                Round(b, o, new Vector3(s, s * 0.8f, s), 0.9f, col, Paint, 8, 5);
            }
        }

        /** A towel laid flat: s.w by s.d tiles, white, three stripes of s.fill across its length; rumpled a little. */
        static void Towel(Bm b, SolidRec s)
        {
            var white = Real("#f6f6f2", Cloth); var stripe = Real(s.fill ?? "#ff9fb2", Cloth);
            bool alongI = s.w >= s.d;
            float L = alongI ? s.w : s.d, Wd = alongI ? s.d : s.w;
            int nl = 34, nw = 8;
            float z = s.z + 0.35f;
            Vector3 P(float u, float v)
            {
                // u along its length from 0, v across from 0: lifted where it rucks.
                float lift = 0.25f * Mathf.Sin(u * 31 + v * 7) * Mathf.Sin(v * 23) + 0.2f * Mathf.Sin(u * 13);
                float i = alongI ? s.x - L / 2 + u : s.x - Wd / 2 + v, j = alongI ? s.y - Wd / 2 + v : s.y - L / 2 + u;
                return W(i, j, z + lift);
            }
            for (int a = 0; a < nl; a++)
                for (int c = 0; c < nw; c++)
                {
                    float u0 = L * a / nl, u1 = L * (a + 1) / nl, v0 = Wd * c / nw, v1 = Wd * (c + 1) / nw;
                    float um = (u0 + u1) / 2 / L * 0.34f;
                    bool st = false;
                    for (int k = 0; k < 3; k++) if (um > 0.04f + k * 0.11f && um < 0.09f + k * 0.11f) st = true;
                    b.Quad(P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1), st ? stripe : white, Cloth);
                }
        }

        /** A window box under a cottage window (town.ts, cottage): a timber trough on the wall (s.face: the wall it hangs on, x or y), and flowers spilling over it. */
        static void WindowBox(Bm b, SolidRec s)
        {
            var wood = Real("#8a6b52", Timber); var leaf = Real("#4c7a3c", Paint);
            var pink = Real(s.fill ?? "#ff9fb2", Paint); var white = Real("#f7f6f2", Paint); var lilac = Real("#b8a1ff", Paint);
            var c = W(s.x, s.y, s.z);
            Vector3 n = s.face == "x" ? Vector3.forward : Vector3.right, t = s.face == "x" ? Vector3.right : Vector3.forward;
            float len = 0.11f, dep = 0.035f, h = Hy(1.6f);
            Cuboid(b, c + n * dep + Vector3.up * (h / 2), t, Vector3.up, n, len, h / 2, dep, wood, Timber);
            var rnd = new System.Random((int)(s.x * 977 + s.y * 131));
            float R() => (float)rnd.NextDouble();
            for (int k = 0; k < 7; k++)
            {
                var o = c + n * dep + t * ((R() - 0.5f) * len * 1.8f) + Vector3.up * (h + Hy(0.6f));
                Leafy(b, o, new Vector3(0.026f, 0.02f, 0.026f), leaf, k + (int)(s.x * 31), 6);
            }
            for (int k = 0; k < 16; k++)
            {
                var o = c + n * (dep * (1 + R() * 1.4f)) + t * ((R() - 0.5f) * len * 1.9f) + Vector3.up * (h + Hy(0.4f + R() * 1.8f));
                var col = k % 4 == 3 ? white : k % 5 == 4 ? lilac : pink;
                Ball(b, o, 0.0075f + R() * 0.004f, -1, col * (0.9f + 0.2f * R()), Paint);
            }
        }

        /** A topiary ball in a pot (nature.ts): a terracotta pot, a short trunk, a clipped ball of box. s.r: its scale. */
        static void Topiary(Bm b, SolidRec s)
        {
            float k = s.r > 0 ? s.r : 1;
            var pot = Real("#b9714f", Concrete); var trunk = Real("#6e5443", Timber); var leaf = Real("#3d6f3a", Paint);
            Lathe(b, s.x, s.y, s.z, new[] { (0f, 0.055f * k), (5.4f * k, 0.075f * k), (6f * k, 0.082f * k), (6.6f * k, 0.082f * k), (6.6f * k, 0.07f * k) }, _ => pot, Concrete, 28);
            Lid(b, s.x, s.y, 0.07f * k, s.z + 6.2f * k, Real("#5a4636", Concrete), Concrete);
            Tube(b, W(s.x, s.y, s.z + 6), W(s.x, s.y, s.z + 13 * k), Px(0.9f * k), trunk, Timber, 8);
            float r = Px(6.6f * k);
            Leafy(b, W(s.x, s.y, s.z) + Up(17 * k), new Vector3(r, r * 0.95f, r), leaf, (int)(s.x * 100 + s.y * 7), 34);
        }

        /** A ring of toadstools (nature.ts): white stems, red caps spotted white, in the site's places round the point. */
        static void Toadstools(Bm b, SolidRec s)
        {
            var stem = Real("#efe9dc", Paint); var cap = Real("#c8323a", Paint); var spot = Real("#f7f4ec", Paint);
            foreach (var (dx, dy, k) in new[] { (-5f, 0f, 1f), (1f, -2f, 0.8f), (5f, 1f, 1.1f), (-1f, 3f, 0.7f) })
            {
                float ti = (dx / 32 + dy / 16) / 2, tj = (dy / 16 - dx / 32) / 2;
                var f = W(s.x + ti, s.y + tj, s.z);
                float sr = Px(0.8f * k), sh = Hy(3.6f * k);
                Tube(b, f, f + Vector3.up * sh, sr, stem, Paint, 10);
                float cr = Px(3.3f * k);
                var cc = f + Vector3.up * sh * 0.9f;
                Round(b, cc, new Vector3(cr, Hy(2.6f * k), cr), 1, cap, Paint, 18, 10, d => d.y > -0.05f);
                for (int q = 0; q < 5; q++)
                {
                    float a = q * 1.7f + k, t = 0.45f + 0.25f * (q % 2);
                    var d = new Vector3(Mathf.Sin(a) * Mathf.Sin(t), Mathf.Cos(t), Mathf.Cos(a) * Mathf.Sin(t));
                    Ball(b, cc + new Vector3(d.x * cr, d.y * Hy(2.6f * k), d.z * cr), cr * 0.16f, -1, spot, Paint);
                }
            }
        }

        /** A pram, parked (lm-town.ts): a deep body on a sprung frame, its hood up, four wheels, a handle. */
        static void Pram(Bm b, SolidRec s)
        {
            var body = Real(s.fill ?? "#8ccbff", Cloth); var hood = body * 0.82f; hood.a = 1; var steel = Real("#c7ccd8", Metal); var tyre = Real("#26272d", Paint);
            var f = W(s.x, s.y, s.z); var R = Across; var F = Facing;
            var c = f + Up(6.2f);
            Round(b, c, new Vector3(Px(5.6f), Hy(3f), Px(3.4f)), 0.55f, body, Cloth, 20, 10, d => d.y < 0.55f);
            // The hood over the back half: a quarter of a ball.
            Round(b, c + R * Px(-2.2f) + Up(1.2f), new Vector3(Px(3.4f), Hy(4.4f), Px(3.5f)), 0.8f, hood, Cloth, 16, 8, d => d.y > 0 && (R.x * d.x + R.z * d.z) < 0.1f);
            foreach (var sx in new[] { -1f, 1f })
                foreach (var sz in new[] { -1f, 1f })
                {
                    var w = f + R * Px(4.2f * sx) + F * Px(3.2f * sz) + Up(1.7f);
                    Hoop(b, w, R, Vector3.up, Px(1.6f), Px(0.45f), tyre, Paint, 14);
                    Tube(b, w, c + R * Px(2.6f * sx) + F * Px(2.2f * sz) - Up(2.2f), Px(0.25f), steel, Metal, 4);
                }
            Tube(b, c + R * Px(4.6f) + Up(1), c + R * Px(8.4f) + Up(6.5f), Px(0.35f), steel, Metal, 6);
            Tube(b, c + R * Px(8.4f) + Up(6.5f) - F * Px(2.4f), c + R * Px(8.4f) + Up(6.5f) + F * Px(2.4f), Px(0.45f), Real("#2c2f38", Paint), Paint, 6);
        }

        /** An easel (lm-town.ts, From Memory): three legs to a peak, a ledge across; the canvas is a plaque (its sketch printed). */
        static void Easel(Bm b, SolidRec s)
        {
            var wood = Real("#a07e5e", Timber);
            var At = Frame(W(s.x, s.y, s.z));
            var top = At(0, 27, -1);
            Tube(b, At(-7, 0, 1.5f), top, Px(0.6f), wood, Timber, 6);
            Tube(b, At(7, 0, 1.5f), top, Px(0.6f), wood, Timber, 6);
            Tube(b, At(1.5f, 0, -8), top, Px(0.6f), wood, Timber, 6);
            Cuboid(b, At(0, 10.6f, 1.2f), Across, Vector3.up, Facing, Px(10), Hy(0.6f), Px(1.2f), wood, Timber);
        }

        /** A bicycle leant on its stand (lm-town.ts, From Memory): two wheels with spokes, a diamond frame in its colour, saddle and bars. */
        static void Bicycle(Bm b, SolidRec s)
        {
            var frame = Real(s.fill ?? "#ff4f6e", Paint); var tyre = Real("#26272d", Paint); var steel = Real("#c7ccd8", Metal); var black = Real("#2c2f38", Paint);
            var At = Frame(W(s.x, s.y, s.z));
            float r = 4.5f;
            Vector3 back = At(-8, r, 0), front = At(8, r, 0);
            foreach (var w in new[] { back, front })
            {
                Hoop(b, w, Across, Vector3.up, Px(r), Px(0.55f), tyre, Paint, 24);
                for (int k = 0; k < 8; k++) { float a = k * Mathf.PI / 4; Tube(b, w, w + (Across * Mathf.Cos(a) + Vector3.up * Mathf.Sin(a)) * Px(r - 0.4f), Px(0.08f), steel, Metal, 3); }
            }
            Vector3 crank = At(-1, r - 0.4f, 0), seat = At(-4, r + 7, 0), head = At(4.5f, r + 7.6f, 0);
            foreach (var (a, c) in new[] { (back, crank), (back, seat), (crank, seat), (seat, head), (crank, head), (head, front) }) Tube(b, a, c, Px(0.6f), frame, Paint, 6);
            Round(b, seat + Up(1.6f), new Vector3(Px(1.8f), Hy(0.6f), Px(1f)), 0.6f, black, Paint, 10, 6);
            Tube(b, seat, seat + Up(1.4f), Px(0.4f), steel, Metal, 4);
            Tube(b, head, head + Up(2.4f) + Across * Px(-0.8f), Px(0.4f), steel, Metal, 4);
            Tube(b, head + Up(2.4f) + Across * Px(-0.8f) - Facing * Px(2.6f), head + Up(2.4f) + Across * Px(-0.8f) + Facing * Px(2.6f), Px(0.4f), black, Paint, 5);
        }

        /** The stork's nest on a chimney (lm-town.ts, Every Second): a ring of sticks, and the stork standing in it. */
        static void Nest(Bm b, SolidRec s)
        {
            var c = W(s.x, s.y, s.z);
            var twig = Real("#7d6550", Timber); var white = Real("#f2f2ee", Paint); var black = Real("#24262c", Paint); var beak = Real("#d9533b", Paint);
            var rnd = new System.Random(7);
            float R() => (float)rnd.NextDouble();
            for (int k = 0; k < 46; k++)
            {
                float a = R() * Mathf.PI * 2, rr = Px(5.2f + R() * 1.6f), y = Hy(R() * 2.4f);
                var d = new Vector3(Mathf.Sin(a), 0, Mathf.Cos(a));
                var t = Vector3.Cross(Vector3.up, d);
                var m = c + d * rr + Vector3.up * y;
                var col = twig * (0.75f + 0.45f * R()); col.a = 1;
                Tube(b, m - t * Px(2.6f) + Vector3.up * Hy(R() - 0.5f), m + t * Px(2.6f) + Vector3.up * Hy(R() - 0.5f), Px(0.35f), col, Timber, 4);
            }
            Lid(b, s.x, s.y, Px(5.4f) / 1f, s.z + 1.2f, twig * 0.7f, Timber);
            // The stork: standing, facing left of us, neck up.
            var F = -Across; var body = c + Up(5.5f);
            Round(b, body, new Vector3(Px(2.4f), Hy(2.2f), Px(2.4f)), 0.9f, white, Paint, 14, 8);
            Round(b, body - F * Px(1.6f) + Up(0.4f), new Vector3(Px(2.2f), Hy(1.4f), Px(1.8f)), 0.9f, black, Paint, 12, 6, d => d.y > -0.2f && Vector3.Dot(new Vector3(d.x, 0, d.z), F) < 0.2f);
            var neckTop = body + F * Px(2.2f) + Up(7.5f);
            Tube(b, body + F * Px(1.6f) + Up(1.2f), neckTop, Px(0.7f), white, Paint, 8);
            Ball(b, neckTop, Px(1.1f), -1, white, Paint);
            Tube(b, neckTop + F * Px(0.8f), neckTop + F * Px(4.2f) - Up(1.2f), Px(0.35f), beak, Paint, 6);
        }

        /**
         * A railway track (lm-proving.ts, Trolley): along s.pts (tile i, j pairs), a bed of ballast, timber
         * sleepers across it, and two steel rails on them.
         */
        static void Track(Bm b, SolidRec s)
        {
            if (s.pts == null || s.pts.Length < 4) return;
            var stone = Real("#8e8a84", Concrete); var sleeper = Real("#5f4c3d", Timber); var rail = Real("#a3a8b2", Metal); var rust = Real("#7c5a46", Metal);
            int n = s.pts.Length / 2;
            float half = 0.17f, gauge = 0.055f, z = s.z;
            float along = 0;
            for (int q = 0; q + 1 < n; q++)
            {
                Vector2 a = new Vector2(s.x + s.pts[q * 2], s.y + s.pts[q * 2 + 1]), c = new Vector2(s.x + s.pts[q * 2 + 2], s.y + s.pts[q * 2 + 3]);
                var d = (c - a); float len = d.magnitude; if (len < 1e-4f) continue; d /= len;
                var nrm = new Vector2(-d.y, d.x);
                Vector3 G(Vector2 p, float off, float h) { var o = p + nrm * off; return W(o.x, o.y, z + h); }
                // The ballast: a low bank, sloping at its sides.
                b.Quad(G(a, -half * 0.7f, 1.2f), G(c, -half * 0.7f, 1.2f), G(c, half * 0.7f, 1.2f), G(a, half * 0.7f, 1.2f), stone, Concrete);
                b.Quad(G(a, -half, 0), G(c, -half, 0), G(c, -half * 0.7f, 1.2f), G(a, -half * 0.7f, 1.2f), stone * 0.9f, Concrete);
                b.Quad(G(a, half * 0.7f, 1.2f), G(c, half * 0.7f, 1.2f), G(c, half, 0), G(a, half, 0), stone * 0.9f, Concrete);
                // Sleepers every so often along it.
                for (float t = Mathf.Ceil(along / 0.075f) * 0.075f - along; t < len; t += 0.075f)
                {
                    var m = a + d * t;
                    var ctr = W(m.x, m.y, z + 1.2f + 0.45f);
                    Cuboid(b, ctr, new Vector3(nrm.y, 0, nrm.x), Vector3.up, new Vector3(d.y, 0, d.x), half * 0.62f, Hy(0.45f), 0.018f, sleeper, Timber);
                }
                along += len;
                // The rails: a head on a web, shining on top.
                foreach (var side in new[] { -gauge, gauge })
                {
                    b.Quad(G(a, side - 0.007f, 2.5f), G(c, side - 0.007f, 2.5f), G(c, side + 0.007f, 2.5f), G(a, side + 0.007f, 2.5f), rail, Metal);
                    b.Quad(G(a, side - 0.007f, 1.6f), G(c, side - 0.007f, 1.6f), G(c, side - 0.007f, 2.5f), G(a, side - 0.007f, 2.5f), rust, Metal);
                    b.Quad(G(a, side + 0.007f, 2.5f), G(c, side + 0.007f, 2.5f), G(c, side + 0.007f, 1.6f), G(a, side + 0.007f, 1.6f), rust, Metal);
                }
            }
        }

        /** The Mint's conveyor (lm-market.ts): a dark rubber belt between steel side rails on rollers, on legs; s.x, s.y its corner, s.w by s.d, s.z its top. */
        static void Conveyor(Bm b, SolidRec s)
        {
            var belt = Real("#2b2f3a", Paint); var steel = Real("#b9bfcb", Metal); var leg = Real("#6c7384", Metal);
            float z = s.z;
            var c = W(s.x + s.w / 2, s.y + s.d / 2, z - 0.4f);
            Cuboid(b, c, Vector3.forward, Vector3.up, Vector3.right, s.w / 2, Hy(0.4f), s.d / 2 - 0.02f, belt, Paint);
            foreach (var side in new[] { -1f, 1f })
                Cuboid(b, W(s.x + s.w / 2, s.y + s.d / 2 + side * (s.d / 2 - 0.01f), z - 0.3f), Vector3.forward, Vector3.up, Vector3.right, s.w / 2 + 0.02f, Hy(1.3f), 0.012f, steel, Metal);
            foreach (var u in new[] { 0f, s.w })
                Tube(b, W(s.x + u, s.y, z - 0.6f), W(s.x + u, s.y + s.d, z - 0.6f), Px(1.2f), steel, Metal, 12);
            for (float u = 0.1f; u < s.w; u += 0.5f)
                foreach (var v in new[] { 0.03f, s.d - 0.03f })
                    Tube(b, W(s.x + u, s.y + v, 0), W(s.x + u, s.y + v, z - 1), Px(0.6f), leg, Metal, 6);
        }

        /**
         * The sundial (lm-town.ts, Where Does The Day Go): a round plaza of stone inlaid with the day's four
         * parts in coloured stone (s.pts: from and to, in hours of 24, in threes with nothing; s.colours), a
         * bronze ring round it with the hours marked. The gnomon is its own; the shadow the page's.
         */
        static void Sundial(Bm b, SolidRec s)
        {
            float R = s.r > 0 ? s.r : 0.95f;
            var rim = Real("#b98d5a", Metal); var mark = Real("#ece6d8", Paint);
            int seg = 96;
            Color Part(float hour)
            {
                for (int q = 0; q + 1 < (s.pts?.Length ?? 0); q += 3) if (hour >= s.pts[q] && hour < s.pts[q + 1]) return Real(s.colours[q / 3], Concrete);
                return Real("#c9c4b8", Concrete);
            }
            Vector3 P(float a, float r, float h) => W(s.x + Mathf.Sin(a) * r, s.y - Mathf.Cos(a) * r, s.z + h);
            for (int k = 0; k < seg; k++)
            {
                float a0 = k * Mathf.PI * 2 / seg, a1 = (k + 1) * Mathf.PI * 2 / seg;
                // The site's hour 0 is at the top of its plane (-y), going round clockwise on the ground.
                float hour = ((k + 0.5f) / seg) * 24;
                var col = Part(hour);
                b.Tri(P(0, 0, 0.6f), P(a1, R * 0.9f, 0.6f), P(a0, R * 0.9f, 0.6f), col, Concrete);
                b.Quad(P(a1, R * 0.9f, 0.6f), P(a1, R, 0.9f), P(a0, R, 0.9f), P(a0, R * 0.9f, 0.6f), rim, Metal);
                b.Quad(P(a0, R, 0), P(a0, R, 0.9f), P(a1, R, 0.9f), P(a1, R, 0), rim * 0.8f, Metal);
            }
            for (int h = 0; h < 24; h++)
            {
                float a = h * Mathf.PI * 2 / 24, w = h % 6 == 0 ? 0.012f : 0.006f;
                var d = new Vector3(Mathf.Sin(a), 0, -Mathf.Cos(a));
                b.Quad(P(a - w, R * 0.92f, 0.95f), P(a + w, R * 0.92f, 0.95f), P(a + w, R * 0.98f, 0.95f), P(a - w, R * 0.98f, 0.95f), mark, Paint);
            }
            // Thin brass lines between the parts of the day.
            for (int q = 0; q + 1 < (s.pts?.Length ?? 0); q += 3)
            {
                float a = s.pts[q] / 24 * Mathf.PI * 2, w = 0.004f / R;
                b.Quad(P(a - w, 0.05f, 0.7f), P(a + w, 0.05f, 0.7f), P(a + w, R * 0.9f, 0.7f), P(a - w, R * 0.9f, 0.7f), rim, Metal);
            }
        }

        /** A telescope on a tripod (lm-peaks.ts, Universe Forecast): three legs, a mount, a white tube pointed up at the sky. */
        static void TripodScope(Bm b, SolidRec s)
        {
            var leg = Real("#3f4352", Metal); var tube = Real("#eef0f4", Paint); var dark = Real("#2c2f38", Paint);
            var At = Frame(W(s.x, s.y, s.z));
            var head = At(0, 12, 0);
            foreach (var (dx, dz) in new[] { (-6f, 2f), (6f, 2f), (0f, -6f) }) Tube(b, At(dx, 0, dz), head, Px(0.5f), leg, Metal, 6);
            Round(b, head + Up(1), new Vector3(Px(1.2f), Hy(1.2f), Px(1.2f)), 0.7f, dark, Paint, 10, 6);
            Vector3 lo = At(-8, 11, 0), hi = At(8, 20, 0);
            Tube(b, lo, hi, Px(2f), tube, Paint, 16);
            Tube(b, hi, hi + (hi - lo).normalized * Px(1.8f), Px(2.3f), dark, Paint, 16);
            Tube(b, lo - (hi - lo).normalized * Px(1.2f), lo, Px(1f), dark, Paint, 10);
        }
    }
}
