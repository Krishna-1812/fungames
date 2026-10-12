// The pieces of the island that are not boxes and roofs, modelled here by
// name (kit.ts, Pen.model): the lighthouse, the windmill and its sails, the
// big wheel and its cars; and every line the site draws between two points,
// as a rod (a post, a mast, a stay, a ladder's rails).
//
// Each is built where the site draws it, at the site's sizes: a height in
// the site's pixels, a width in screen pixels (a ground circle of radius r
// tiles is r * PxPerUnit pixels across each way). A piece that turns in the
// picture (the sails, the wheel) is built facing the camera, so turning its
// picture is turning it.
using System;
using System.Collections.Generic;
using UnityEngine;

namespace Island
{
    public static partial class Buildings
    {
        static readonly Quaternion Cam = Quaternion.Euler(30, 225, 0);
        static Vector3 CamR => Cam * Vector3.right;
        static Vector3 CamU => Cam * Vector3.up;
        static Vector3 CamF => Cam * Vector3.forward;
        /** Towards the camera, along the ground. */
        static Vector3 Facing { get { var f = -CamF; f.y = 0; return f.normalized; } }
        /** Screen pixels as world units. */
        static float Px(float px) => px / IslandBuild.PxPerUnit;
        /** A point moved across the picture, dx right and dy down, in pixels. */
        static Vector3 Scr(Vector3 at, float dx, float dy) => at + (CamR * dx - CamU * dy) / IslandBuild.PxPerUnit;
        /** Up, in the site's height pixels. */
        static Vector3 Up(float px) => Vector3.up * Hy(px);

        /* ---- shapes ----------------------------------------------------------- */

        /** A round bar from a to c. */
        static void Tube(Bm b, Vector3 a, Vector3 c, float r, Color col, int mat, int sides = 10)
        {
            var ax = c - a; float len = ax.magnitude;
            if (len < 1e-5f || r <= 0) return;
            ax /= len;
            var u = Vector3.Cross(ax, Mathf.Abs(ax.y) < 0.9f ? Vector3.up : Vector3.right).normalized;
            var v = Vector3.Cross(ax, u);
            for (int k = 0; k < sides; k++)
            {
                float a0 = k * Mathf.PI * 2 / sides, a1 = (k + 1) * Mathf.PI * 2 / sides;
                Vector3 o0 = (u * Mathf.Cos(a0) + v * Mathf.Sin(a0)) * r, o1 = (u * Mathf.Cos(a1) + v * Mathf.Sin(a1)) * r;
                b.Quad(a + o0, a + o1, c + o1, c + o0, col, mat);
                b.Tri(c, c + o0, c + o1, col, mat);
                b.Tri(a, a + o1, a + o0, col, mat);
            }
        }

        /** A ring of bar round a centre, in the plane of two directions. */
        static void Hoop(Bm b, Vector3 c, Vector3 e1, Vector3 e2, float R, float r, Color col, int mat, int segs = 60)
        {
            for (int k = 0; k < segs; k++)
            {
                float a0 = k * Mathf.PI * 2 / segs, a1 = (k + 1) * Mathf.PI * 2 / segs;
                Tube(b, c + (e1 * Mathf.Cos(a0) + e2 * Mathf.Sin(a0)) * R, c + (e1 * Mathf.Cos(a1) + e2 * Mathf.Sin(a1)) * R, r, col, mat, 6);
            }
        }

        /**
         * Something turned on a lathe, round an upright axis: rings at heights
         * (site pixels above z) of radii (tiles), each band between two in its
         * colour; a lid on top if the last radius is not 0.
         */
        static void Lathe(Bm b, float cx, float cy, float z, (float h, float r)[] rings, Func<int, Color> col, int mat, int sides = 40, bool lid = true)
        {
            for (int q = 0; q + 1 < rings.Length; q++)
            {
                var c = col(q);
                for (int k = 0; k < sides; k++)
                {
                    float a0 = k * Mathf.PI * 2 / sides, a1 = (k + 1) * Mathf.PI * 2 / sides;
                    Vector3 P(float a, int i) => W(cx + Mathf.Sin(a) * rings[i].r, cy + Mathf.Cos(a) * rings[i].r, z + rings[i].h);
                    b.Quad(P(a1, q), P(a0, q), P(a0, q + 1), P(a1, q + 1), c, mat, q == 0 && rings[0].h <= 0.5f ? 0.75f : 1);
                }
            }
            var top = rings[rings.Length - 1];
            if (lid && top.r > 0) Lid(b, cx, cy, top.r, z + top.h, col(rings.Length - 2), mat);
        }

        /** A box on three directions (half sizes along each). */
        static void Cuboid(Bm b, Vector3 c, Vector3 X, Vector3 Y, Vector3 Z, float hx, float hy, float hz, Color col, int mat)
        {
            X *= hx; Y *= hy; Z *= hz;
            Vector3 P(int i, int j, int k) => c + X * i + Y * j + Z * k;
            b.Quad(P(-1, -1, -1), P(1, -1, -1), P(1, 1, -1), P(-1, 1, -1), col, mat);
            b.Quad(P(1, -1, 1), P(-1, -1, 1), P(-1, 1, 1), P(1, 1, 1), col, mat);
            b.Quad(P(-1, -1, 1), P(-1, -1, -1), P(-1, 1, -1), P(-1, 1, 1), col, mat);
            b.Quad(P(1, -1, -1), P(1, -1, 1), P(1, 1, 1), P(1, 1, -1), col, mat);
            b.Quad(P(-1, 1, -1), P(1, 1, -1), P(1, 1, 1), P(-1, 1, 1), col, mat);
            b.Quad(P(-1, -1, 1), P(1, -1, 1), P(1, -1, -1), P(-1, -1, -1), col, mat);
        }

        /** A flat panel on the face of something round, facing the camera: a door, a window. */
        static void Front(Bm b, Vector3 foot, float w, float z0, float z1, Color col, int mat)
        {
            var f = Facing; var side = Vector3.Cross(Vector3.up, f).normalized * Px(w) / 2;
            b.Quad(foot - side + Up(z0), foot + side + Up(z0), foot + side + Up(z1), foot - side + Up(z1), col, mat);
        }

        /* ---- the rods ---------------------------------------------------------- */

        /** A line between two points, made a bar as thick as the line was wide. */
        static void Rod(Bm b, SolidRec s)
        {
            if (s.pts == null || s.pts.Length < 6) return;
            var a = W(s.pts[0], s.pts[1], s.pts[2]); var c = W(s.pts[3], s.pts[4], s.pts[5]);
            int m = Is(s.fill, "#9b8bd6") ? Timber : Is(s.fill, "#1b2340", "#2c355e", "#9aa3c0", "#c9cde0") ? Metal : Paint;
            // Ink is the drawing's outline colour: as a thing, dark steel.
            var col = Is(s.fill, "#1b2340") ? Real("#3d4458", Metal) : Real(s.fill, m);
            Tube(b, a, c, Mathf.Max(Px(s.r), 0.006f), col, m);
        }

        /* ---- the models -------------------------------------------------------- */

        static void Model(Bm b, SolidRec s)
        {
            switch (s.name)
            {
                case "lighthouse": Lighthouse(b, s); break;
                case "windmill": Windmill(b, s); break;
                case "sails": Sails(b, s); break;
                case "wheel": Wheel(b, s); break;
                case "car": Car(b, s); break;
                case "lamp": Lamp(b, s); break;
                case "umbrella": Umbrella(b, s); break;
                case "surfboard": Surfboard(b, s); break;
                case "kite": KiteModel(b, s); break;
                case "flowers": Flowers(b, s); break;
                default: Debug.LogWarning($"[island] no model called {s.name}"); break;
            }
        }

        /** A model rendered square round its own point (a piece that turns): that square on the map, in P()'s units. */
        public static bool Centred(SolidRun run, out Rect box)
        {
            box = default;
            var list = Parse(run);
            if (list.Count != 1 || list[0].k != "model" || list[0].half <= 0) return false;
            var s = list[0];
            float px = (s.x - s.y) * 32, py = (s.x + s.y) * 16 - s.z;
            box = new Rect(px - s.half, py - s.half, s.half * 2, s.half * 2);
            return true;
        }

        /**
         * The lighthouse: a tapering tower in bands of white and red on a stone
         * plinth, a door and three windows, a gallery with its rail, the glass
         * lantern in its frame, and a domed cap with a ball and a vane.
         */
        static void Lighthouse(Bm b, SolidRec s)
        {
            float x = s.x, y = s.y, z = s.z;
            var white = Real("#ffffff", Plaster); var red = Real(s.fill, Plaster);
            var dark = Real(s.top ?? "#2c355e", Metal);
            float R(float h) => Px(17 - 0.075f * h);
            // The plinth, then the tower in its bands.
            Lathe(b, x, y, z, new[] { (-3f, Px(20)), (3f, Px(20)) }, _ => Real("#c3c8de", Concrete), Concrete);
            var bands = new[] { 0f, 24, 44, 66, 86 };
            var rings = new List<(float, float)>();
            foreach (var h in bands) rings.Add((h, R(h)));
            Lathe(b, x, y, z, rings.ToArray(), q => q % 2 == 0 ? white : red, Plaster, 48, false);
            // The door and the windows, on the side we see.
            var axis = W(x, y, z);
            Front(b, axis + Facing * (R(5) + 0.004f), 8, 0, 12, Real("#2c355e", Timber), Timber);
            Front(b, axis + Facing * (R(5) + 0.006f), 10, 12, 13.5f, Real("#d5d9ea", Concrete), Concrete);
            foreach (var h in new[] { 34f, 56, 76 })
            {
                Front(b, axis + Facing * (R(h + 3) + 0.004f), 6.4f, h - 0.8f, h + 6.8f, Real("#f4f6fc", Paint), Paint);
                Front(b, axis + Facing * (R(h + 3) + 0.007f), 4.6f, h, h + 6, Real("#9fd4ff", Glass), Glass);
            }
            // The gallery: a deck standing out on brackets, and its rail.
            Lathe(b, x, y, z, new[] { (84f, Px(13)), (86.5f, Px(19)), (89f, Px(19.5f)) }, _ => dark, Metal, 48);
            var steel = Real("#3d4458", Metal);
            for (int k = 0; k < 18; k++)
            {
                float a = k * Mathf.PI * 2 / 18, rr = 18.6f;
                Tube(b, W(x + Mathf.Sin(a) * Px(rr), y + Mathf.Cos(a) * Px(rr), z + 89), W(x + Mathf.Sin(a) * Px(rr), y + Mathf.Cos(a) * Px(rr), z + 96), Px(0.5f), steel, Metal, 5);
            }
            Hoop(b, W(x, y, z + 96), Vector3.right, Vector3.forward, Px(18.6f), Px(0.7f), steel, Metal, 48);
            Hoop(b, W(x, y, z + 92.5f), Vector3.right, Vector3.forward, Px(18.6f), Px(0.4f), steel, Metal, 48);
            // The lantern: a low wall, the glass in its frame, and the cap.
            Lathe(b, x, y, z, new[] { (89f, Px(11.5f)), (93f, Px(11.5f)) }, _ => dark, Metal, 32);
            Lathe(b, x, y, z, new[] { (93f, Px(10.5f)), (108f, Px(10.5f)) }, _ => Real("#9fd4ff", Glass), Glass, 32, false);
            for (int k = 0; k < 8; k++)
            {
                float a = (k + 0.5f) * Mathf.PI * 2 / 8, rr = 10.8f;
                Tube(b, W(x + Mathf.Sin(a) * Px(rr), y + Mathf.Cos(a) * Px(rr), z + 93), W(x + Mathf.Sin(a) * Px(rr), y + Mathf.Cos(a) * Px(rr), z + 108), Px(0.6f), dark, Metal, 5);
            }
            Lathe(b, x, y, z, new[] { (107.5f, Px(12)), (109.5f, Px(14.5f)), (110f, Px(14.5f)), (113f, Px(13)), (117f, Px(10.5f)), (121f, Px(7)), (125f, Px(3.5f)), (127.5f, Px(1.2f)), (128f, 0f) }, _ => dark, Metal, 40, false);
            Ball(b, W(x, y, z + 129.5f), Px(2.2f), -1, dark, Metal);
            var tip = W(x, y, z + 141);
            Tube(b, W(x, y, z + 131), tip, Px(0.6f), steel, Metal, 6);
            Tube(b, W(x, y, z + 137) - CamR * Px(6), W(x, y, z + 137) + CamR * Px(6), Px(0.5f), steel, Metal, 6);
        }

        /**
         * The windmill: a boarded smock tower, eight-sided and narrowing, on a
         * stone base, with a stage round it, a door and a window, and its cap;
         * the windshaft coming out of the cap to where the sails turn.
         */
        static void Windmill(Bm b, SolidRec s)
        {
            float x = s.x, y = s.y, z = s.z;
            var boards = Real("#f4f6fc", Timber);
            Lathe(b, x, y, z, new[] { (0f, Px(15)), (8f, Px(14.5f)) }, _ => Real("#c3c8de", Concrete), Concrete, 8);
            Lathe(b, x, y, z, new[] { (8f, Px(14)), (46f, Px(8.5f)) }, _ => boards, Timber, 8);
            // The stage, on its posts, and its rail.
            Lathe(b, x, y, z, new[] { (17f, Px(18)), (18.5f, Px(18)) }, _ => Real("#9b8bd6", Timber), Timber, 8);
            var wood = Real("#8a8396", Timber);
            for (int k = 0; k < 8; k++)
            {
                float a = (k + 0.5f) * Mathf.PI * 2 / 8, a2 = (k + 1.5f) * Mathf.PI * 2 / 8, rr = Px(17.4f);
                var p0 = W(x + Mathf.Sin(a) * rr, y + Mathf.Cos(a) * rr, z + 18.5f);
                Tube(b, p0, p0 + Up(6), Px(0.5f), wood, Timber, 5);
                Tube(b, W(x + Mathf.Sin(a) * rr, y + Mathf.Cos(a) * rr, z + 24.5f), W(x + Mathf.Sin(a2) * rr, y + Mathf.Cos(a2) * rr, z + 24.5f), Px(0.5f), wood, Timber, 5);
                Tube(b, W(x + Mathf.Sin(a) * Px(14), y + Mathf.Cos(a) * Px(14), z + 10), p0 - Up(0.6f), Px(0.5f), wood, Timber, 5);
            }
            var axis = W(x, y, z);
            Front(b, axis + Facing * (Px(14.6f) + 0.004f), 8, 0, 10, Real(s.top ?? "#5b82ff", Timber), Timber);
            Front(b, axis + Facing * (Px(11.6f) + 0.004f), 6.4f, 23.2f, 30.8f, Real("#f4f6fc", Paint), Paint);
            Front(b, axis + Facing * (Px(11.6f) + 0.007f), 4.6f, 24, 30, Real("#9fd4ff", Glass), Glass);
            // The cap, a rounded hood, and the windshaft.
            Lathe(b, x, y, z, new[] { (45f, Px(10.5f)), (46.5f, Px(12)), (50f, Px(11.5f)), (53.5f, Px(9)), (56.5f, Px(5)), (58.5f, 0f) }, _ => Real(s.fill, Timber), Timber, 24, false);
            var hub = W(x, y, z + 47);
            Tube(b, hub, hub - CamF * 0.34f, Px(2), Real("#2c355e", Metal), Metal, 8);
        }

        /** The sails: four stocks, each with a lattice frame and its cloth, facing the camera round the hub. */
        static void Sails(Bm b, SolidRec s)
        {
            var hub = W(s.x, s.y, s.z) - CamF * 0.34f;
            var stock = Real("#8a8396", Timber); var lath = Real("#d5d9ea", Timber); var cloth = Real("#f4f6fc", Cloth);
            for (int k = 0; k < 4; k++)
            {
                float a = k * Mathf.PI / 2;
                // Out along the stock, and across to the side the sail is on, in screen pixels.
                Vector3 At(float along, float across) => Scr(hub, Mathf.Sin(a) * along + Mathf.Cos(a) * across, -Mathf.Cos(a) * along + Mathf.Sin(a) * across);
                Tube(b, At(0, 0), At(34.5f, 0), Px(1.1f), stock, Timber, 6);
                foreach (var t in new[] { 8f, 14.25f, 20.5f, 26.75f, 33f }) Tube(b, At(t, 0), At(t, 9), Px(0.45f), lath, Timber, 5);
                Tube(b, At(8, 9), At(33, 9), Px(0.55f), lath, Timber, 5);
                Tube(b, At(8, 5), At(33, 5), Px(0.3f), lath, Timber, 4);
                // The cloth, a little behind the lattice.
                var back = CamF * 0.006f;
                b.Quad(At(8.5f, 1.2f) + back, At(32.5f, 1.2f) + back, At(32.5f, 8.6f) + back, At(8.5f, 8.6f) + back, cloth, Cloth);
            }
            Tube(b, hub + CamF * 0.04f, hub - CamF * 0.05f, Px(3.2f), Real("#2c355e", Metal), Metal, 12);
        }

        /**
         * A street lamp: a moulded cast-iron base, a fluted post tapering up,
         * an arm curving out to the right (as the site draws it), and a lantern
         * hanging from it, its glass under a shade. s.h: the post's height.
         */
        static void Lamp(Bm b, SolidRec s)
        {
            var iron = Real("#2f3542", Metal); var glass = Real("#eef0f6", Paint);
            float x = s.x, y = s.y, z = s.z, h = s.h > 0 ? s.h : 26;
            Lathe(b, x, y, z, new[] { (0f, Px(2.2f)), (1.2f, Px(2.2f)), (1.8f, Px(1.6f)), (3.4f, Px(1.4f)), (4f, Px(1.0f)), (h - 1.2f, Px(0.7f)), (h - 0.6f, Px(1.0f)), (h, Px(0.8f)) }, _ => iron, Metal, 12);
            // The arm: a quarter turn out and over, towards the right of the picture.
            var top = W(x, y, z + h); var right = CamR; right.y = 0; right.Normalize();
            Vector3 prev = top;
            for (int k = 1; k <= 6; k++)
            {
                float t = k / 6f * Mathf.PI / 2;
                var p = top + right * Px(5) * (1 - Mathf.Cos(t)) + Vector3.up * Hy(3) * Mathf.Sin(t);
                Tube(b, prev, p, Px(0.55f), iron, Metal, 6); prev = p;
            }
            // The lantern, hanging just past the arm's end: a shade, the glass, a finial.
            var head = top + right * Px(5.5f) + Vector3.up * Hy(1.2f);
            Tube(b, prev, head + Vector3.up * Hy(1.6f), Px(0.4f), iron, Metal, 5);
            Ball(b, head, Px(2.1f), -1, glass, Paint);
            Lathe(b, head.z, head.x, head.y * IslandBuild.PxPerHeight, new[] { (1.2f, Px(2.6f)), (1.9f, Px(2.4f)), (3.0f, Px(1.0f)), (3.4f, 0f) }, _ => iron, Metal, 14, false);
        }

        /** A beach umbrella: a pole leaning a little, and a canopy of panels in two colours, its ribs showing. s.fill: the colour. */
        static void Umbrella(Bm b, SolidRec s)
        {
            var pole = Real("#e6e9f6", Paint); var c1 = Real(s.fill ?? "#ff4f6e", Cloth); var c2 = Real("#f7f8fc", Cloth);
            var foot = W(s.x, s.y, s.z); var tip = W(s.x + 0.02f, s.y - 0.02f, s.z + 30);
            Tube(b, foot, tip + Vector3.up * Hy(2), Px(0.7f), pole, Paint, 6);
            int n = 8; float R = 0.24f, sag = Hy(4);
            var up = (tip - foot).normalized;
            var u = Vector3.Cross(up, Vector3.forward).normalized; var v = Vector3.Cross(up, u);
            for (int k = 0; k < n; k++)
            {
                float a0 = k * Mathf.PI * 2 / n, a1 = (k + 1) * Mathf.PI * 2 / n;
                var e0 = tip + (u * Mathf.Cos(a0) + v * Mathf.Sin(a0)) * R - up * sag; var e1 = tip + (u * Mathf.Cos(a1) + v * Mathf.Sin(a1)) * R - up * sag;
                // Each panel bellies a little between its ribs.
                var mid = tip + (u * Mathf.Cos((a0 + a1) / 2) + v * Mathf.Sin((a0 + a1) / 2)) * R * 0.98f - up * sag * 0.9f;
                var col = k % 2 == 0 ? c1 : c2;
                b.Tri(tip, e0, mid, col, Cloth); b.Tri(tip, mid, e1, col, Cloth);
                Tube(b, tip, e0, Px(0.25f), pole, Paint, 4);
            }
        }

        /** A bed of flowers: a low mound of leaves, and the flowers dotted over it in two colours and white. */
        static void Flowers(Bm b, SolidRec s)
        {
            var leaf = Real("#3f7a5c", Paint); var c1 = Real(s.fill ?? "#ff9fb2", Paint); var c2 = Real(s.top ?? "#b8a1ff", Paint); var w = Real("#f7f8fc", Paint);
            var c = W(s.x, s.y, s.z);
            var rnd = new System.Random((int)(s.x * 1000 + s.y * 7));
            float R() => (float)rnd.NextDouble();
            // The leaves: overlapping clumps.
            for (int k = 0; k < 9; k++)
            {
                var o = c + new Vector3((R() - 0.5f) * 0.28f, 0, (R() - 0.5f) * 0.2f);
                float r = 0.04f + R() * 0.03f;
                for (int y = 0; y < 5; y++) for (int x = 0; x < 10; x++)
                {
                    float t0 = Mathf.PI / 2 * y / 5, t1 = Mathf.PI / 2 * (y + 1) / 5, a0 = x * Mathf.PI * 2 / 10, a1 = (x + 1) * Mathf.PI * 2 / 10;
                    Vector3 P(float t, float a) => o + new Vector3(Mathf.Cos(t) * Mathf.Sin(a) * r, Mathf.Sin(t) * r * 0.8f, Mathf.Cos(t) * Mathf.Cos(a) * r);
                    b.Quad(P(t0, a0), P(t0, a1), P(t1, a1), P(t1, a0), leaf * (0.85f + R() * 0.3f), Paint);
                }
            }
            // The flowers.
            for (int k = 0; k < 34; k++)
            {
                var o = c + new Vector3((R() - 0.5f) * 0.3f, 0.035f + R() * 0.03f, (R() - 0.5f) * 0.22f);
                var col = k % 3 == 0 ? c1 : k % 3 == 1 ? c2 : w;
                Ball(b, o, 0.009f + R() * 0.005f, -1, col, Paint);
            }
        }

        /** A surfboard stood on its tail in the sand. s.fill: its colour. */
        static void Surfboard(Bm b, SolidRec s)
        {
            var col = Real(s.fill ?? "#5b82ff", Paint); var stripe = Real("#f7f8fc", Paint);
            var foot = W(s.x, s.y, s.z);
            var right = CamR; right.y = 0; right.Normalize();
            var face = Facing;
            int n = 12; float L = Hy(26), W0 = Px(3.4f);
            for (int k = 0; k < n; k++)
            {
                float t0 = (float)k / n, t1 = (float)(k + 1) / n;
                float w0 = W0 * Mathf.Sqrt(Mathf.Sin(Mathf.PI * Mathf.Lerp(0.04f, 0.97f, t0))), w1 = W0 * Mathf.Sqrt(Mathf.Sin(Mathf.PI * Mathf.Lerp(0.04f, 0.97f, t1)));
                var p0 = foot + Vector3.up * L * t0 + face * 0.004f * Mathf.Sin(Mathf.PI * t0); var p1 = foot + Vector3.up * L * t1 + face * 0.004f * Mathf.Sin(Mathf.PI * t1);
                b.Quad(p0 - right * w0, p0 + right * w0, p1 + right * w1, p1 - right * w1, col, Paint);
                b.Quad(p0 - right * w0 - face * 0.01f, p0 + right * w0 - face * 0.01f, p1 + right * w1 - face * 0.01f, p1 - right * w1 - face * 0.01f, col, Paint);
                b.Quad(p0 - right * w0 * 0.12f + face * 0.002f, p0 + right * w0 * 0.12f + face * 0.002f, p1 + right * w1 * 0.12f + face * 0.002f, p1 - right * w1 * 0.12f + face * 0.002f, stripe, Paint);
            }
        }

        /** A kite: a diamond of sailcloth on two spars, flying, and its tail of ribbons. Drawn round its middle, facing the camera. */
        static void KiteModel(Bm b, SolidRec s)
        {
            var c = W(s.x, s.y, s.z);
            var cloth = Real(s.fill ?? "#b8a1ff", Cloth); var dark = cloth * 0.7f; dark.a = 1; var spar = Real("#9b8bd6", Timber);
            Vector3 S(float dx, float dy) => Scr(c, dx, dy);
            var top = S(0, -12); var bot = S(0, 12); var l = S(-9, 0); var r = S(9, 0); var mid = S(0, -0.5f) + CamF * -0.01f;
            b.Tri(top, l, mid, cloth, Cloth); b.Tri(top, mid, r, dark, Cloth); b.Tri(l, bot, mid, dark, Cloth); b.Tri(mid, bot, r, cloth, Cloth);
            Tube(b, top, bot, Px(0.35f), spar, Timber, 4); Tube(b, l, r, Px(0.35f), spar, Timber, 4);
            // The tail: bows of ribbon down a line.
            var red = Real("#ff4f6e", Cloth);
            for (int k = 0; k < 3; k++)
            {
                var q = S(Mathf.Sin(k * 1.7f) * 2.5f, 15 + k * 6.5f);
                b.Tri(q + (S(-2.4f, -1.4f) - c), q + (S(2.4f, 1.4f) - c), q + (S(2.4f, -1.4f) - c), red, Cloth);
                b.Tri(q + (S(-2.4f, -1.4f) - c), q + (S(-2.4f, 1.4f) - c), q + (S(2.4f, 1.4f) - c), red, Cloth);
            }
        }

        /**
         * The big wheel: two rims tied together, spokes from a drum of a hub,
         * an inner ring, and the axle; facing the camera, so that turning its
         * picture turns it.
         */
        static void Wheel(Bm b, SolidRec s)
        {
            var hub = W(s.x, s.y, s.z);
            var rim = Real(s.fill ?? "#b8a1ff", Paint); var steel = Real("#c9cde0", Metal); var dark = Real("#3d4458", Metal);
            float R = Px(58), deep = 0.075f;
            foreach (var side in new[] { -1f, 1f })
            {
                var c = hub + CamF * deep * side;
                Hoop(b, c, CamR, CamU, R, Px(1.6f), rim, Paint, 80);
                Hoop(b, c, CamR, CamU, Px(40), Px(0.6f), steel, Metal, 60);
                for (int k = 0; k < 10; k++)
                {
                    float a = k * Mathf.PI * 2 / 10;
                    var dir = CamR * Mathf.Cos(a) + CamU * -Mathf.Sin(a);
                    Tube(b, c + dir * Px(7), c + dir * R, Px(0.55f), steel, Metal, 5);
                    // A brace between neighbouring spokes, at the inner ring.
                    float a2 = (k + 0.5f) * Mathf.PI * 2 / 10;
                    var mid = CamR * Mathf.Cos(a2) + CamU * -Mathf.Sin(a2);
                    Tube(b, c + dir * Px(40), c + mid * R, Px(0.4f), steel, Metal, 4);
                }
            }
            for (int k = 0; k < 20; k++)
            {
                float a = k * Mathf.PI * 2 / 20;
                var dir = CamR * Mathf.Cos(a) + CamU * -Mathf.Sin(a);
                Tube(b, hub + dir * R - CamF * deep, hub + dir * R + CamF * deep, Px(0.6f), rim, Paint, 5);
            }
            Tube(b, hub - CamF * 0.11f, hub + CamF * 0.11f, Px(7), Real(s.top ?? "#ff4f6e", Paint), Paint, 20);
            Tube(b, hub - CamF * 0.2f, hub + CamF * 0.2f, Px(2.5f), dark, Metal, 10);
        }

        /** A car of the big wheel, hanging level from its pin on the rim: a cabin, its posts, and a roof. */
        static void Car(Bm b, SolidRec s)
        {
            var pin = Scr(W(s.x, s.y, s.z), s.dx, s.dy);
            var X = CamR; var Z = -CamF; Z.y = 0; Z.Normalize();
            var body = Real(s.fill, Paint); var dark = Real("#3d4458", Metal);
            float hw = Px(7), hd = 0.075f;
            // The pin, the hanger, and the roof.
            Tube(b, pin - Z * 0.09f, pin + Z * 0.09f, Px(0.8f), dark, Metal, 6);
            Cuboid(b, pin - Up(1.2f), X, Vector3.up, Z, hw * 1.05f, Hy(0.7f), hd * 1.1f, body, Paint);
            // The posts between the roof and the cabin, open to the air.
            foreach (var i in new[] { -1f, 1f }) foreach (var k in new[] { -1f, 1f })
                Tube(b, pin - Up(1.8f) + X * hw * 0.9f * i + Z * hd * 0.9f * k, pin - Up(5) + X * hw * 0.9f * i + Z * hd * 0.9f * k, Px(0.4f), dark, Metal, 4);
            Cuboid(b, pin - Up(7.5f), X, Vector3.up, Z, hw, Hy(2.5f), hd, body, Paint);
            Cuboid(b, pin - Up(10.2f), X, Vector3.up, Z, hw * 0.8f, Hy(0.4f), hd * 0.8f, body, Paint);
        }
    }
}
