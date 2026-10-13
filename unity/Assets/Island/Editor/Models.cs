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

        /** A print (Prints.cs) laid on a face: its middle, the face's across and up (unit directions), its width and height in world units. */
        static void Print(Bm b, Vector3 mid, Vector3 across, Vector3 up, float w, float h, string name)
        {
            if (!Prints.Find(name, out var uv0, out var uv1)) { Debug.LogWarning($"[island] no print called {name}"); return; }
            var x = across * (w / 2); var y = up * (h / 2);
            b.QuadUV(mid - x - y, mid + x - y, mid + x + y, mid - x + y, Color.white, Printed, uv0, uv1);
        }

        /** Across the picture and up, from a foot: dx screen pixels right, h site pixels up, dz screen pixels towards the camera. */
        static Func<float, float, float, Vector3> Frame(Vector3 foot)
        {
            var r = CamR; r.y = 0; r.Normalize(); var fw = Facing;
            return (dx, h, dz) => foot + r * Px(dx) + Up(h) + fw * Px(dz);
        }
        static Vector3 Across { get { var r = CamR; r.y = 0; return r.normalized; } }

        /**
         * The noticeboard (town.ts): two timber posts, a framed board with its
         * pinned papers printed on it, a little pitched metal roof over it, and
         * the board its name is painted on (the page writes the name).
         */
        static void Noticeboard(Bm b, SolidRec s)
        {
            var At = Frame(W(s.x, s.y, s.z)); var R = Across; var F = Facing;
            var timber = Real("#9b8bd6", Timber); var frame = Real("#d9cdb8", Timber); var roof = Real("#5b82ff", Metal); var white = Real("#f4f6fc", Paint);
            foreach (var dx in new[] { -12f, 12f }) Cuboid(b, At(dx, 16.5f, -1.4f), R, Vector3.up, F, Px(1.3f), Hy(16.5f), Px(1.3f), timber, Timber);
            Cuboid(b, At(0, 20.5f, 0), R, Vector3.up, F, Px(15.4f), Hy(9.9f), Px(0.9f), frame, Timber);
            if (s.prints != null && s.prints.Length > 0) Print(b, At(0, 20.5f, 0.95f), R, Vector3.up, Px(30), Hy(19), s.prints[0]);
            // The roof: a ridge running back, two slopes down to eaves either side, each a thin sheet.
            foreach (var side in new[] { -1f, 1f })
            {
                Vector3 r0 = At(0, 38, 6), r1 = At(0, 38, -6), e0 = At(19 * side, 30.5f, 6), e1 = At(19 * side, 30.5f, -6);
                b.Quad(e0, r0, r1, e1, roof, Metal);
                var dn = Up(-1.1f);
                b.Quad(e0 + dn, e0, e1, e1 + dn, roof * 0.8f, Metal);
                b.Quad(e0 + dn, r0 + dn, r0, e0, roof * 0.85f, Metal);
            }
            // The name board, standing on the ridge.
            Cuboid(b, At(0, 41.5f, 3), R, Vector3.up, F, Px(11), Hy(3.5f), Px(0.6f), white, Paint);
            foreach (var dx in new[] { -7f, 7f }) Tube(b, At(dx, 37, 3), At(dx, 38.2f, 3), Px(0.5f), timber, Timber, 6);
        }

        /**
         * A board facing the viewer (kit.ts, plaque): a panel s.w by s.h screen pixels, s.d thick (1.6 if not
         * given), bottom-centred on its point, edged in s.side, its artwork printed on its face; on two posts
         * down to s.foot if it has one.
         */
        static void Plaque(Bm b, SolidRec s)
        {
            var At = Frame(W(s.x, s.y, s.z)); var R = Across; var F = Facing;
            float depth = s.d > 0 ? s.d : 1.6f;
            var edge = Real(s.side ?? "#d5d9ea", Paint);
            Cuboid(b, At(0, s.h / 2, -depth / 2), R, Vector3.up, F, Px(s.w / 2), Hy(s.h / 2), Px(depth / 2), edge, Paint);
            if (s.prints != null && s.prints.Length > 0) Print(b, At(0, s.h / 2, 0.06f), R, Vector3.up, Px(s.w), Hy(s.h), s.prints[0]);
            if (!float.IsNaN(s.foot) && s.foot < s.z - 0.5f)
            {
                var steel = Real("#3d4458", Metal);
                float inset = Mathf.Min(6, s.w * 0.18f), down = s.foot - s.z;
                foreach (var side in new[] { -1f, 1f })
                    Tube(b, At(side * (s.w / 2 - inset), s.h * 0.6f, -depth - 0.7f), At(side * (s.w / 2 - inset), down, -depth - 0.7f), Px(0.9f), steel, Metal, 8);
            }
        }

        /**
         * A dish aerial (lm-badlands.ts): a shallow paraboloid s.r screen pixels across each way, its
         * hollow turned up to the sky and a little towards us, on a short neck from the mast's top; a
         * feed arm out to the receiver at its focus.
         */
        static void Dish(Bm b, SolidRec s)
        {
            var top = W(s.x, s.y, s.z);
            var white = Real("#eef0f6", Paint); var steel = Real("#3d4458", Metal);
            var axis = (Vector3.up * 0.9f - Across * 0.38f + Facing * 0.08f).normalized;
            var u = Vector3.Cross(axis, Vector3.right).normalized; var v = Vector3.Cross(axis, u);
            float R = Px(s.r > 0 ? s.r : 16), depth = R * 0.32f;
            var vertex = top + Up(4);
            Tube(b, top, vertex, Px(1.2f), steel, Metal, 8);
            const int rings = 8, sides = 28;
            Vector3 P(int ring, int k) { float t = ring / (float)rings, a = k * Mathf.PI * 2 / sides; return vertex + axis * (depth * t * t) + (u * Mathf.Cos(a) + v * Mathf.Sin(a)) * (R * t); }
            for (int q = 0; q < rings; q++)
                for (int k = 0; k < sides; k++)
                    b.Quad(P(q, k), P(q, k + 1), P(q + 1, k + 1), P(q + 1, k), white, Paint, q == 0 ? 0.8f : 1);
            // Its rim, a little thicker; the feed arm and the receiver at the focus.
            Hoop(b, vertex + axis * depth, u, v, R, Px(0.55f), white, Paint, 40);
            var focus = vertex + axis * (R * R / (4 * depth));
            Tube(b, vertex + axis * depth * 0.2f + u * R * 0.35f, focus, Px(0.5f), steel, Metal, 6);
            Ball(b, focus, Px(1.6f), -1, Real("#ff4f6e", Paint), Paint);
        }

        /**
         * The observatory's telescope (lm-peaks.ts), up out of its dome: a dark
         * pier, a fork, and the white tube pointing at the constellation,
         * banded and capped, with its little finder and eyepiece.
         */
        static void Telescope(Bm b, SolidRec s)
        {
            var At = Frame(W(s.x, s.y, s.z)); var R = Across; var F = Facing;
            var navy = Real("#1f2a5c", Metal); var white = Real("#f4f6fc", Paint); var cobalt = Real("#5b82ff", Paint); var black = Real("#25282f", Metal);
            Cuboid(b, At(0, 19, -1), R, Vector3.up, F, Px(4.6f), Hy(19), Px(4.6f), navy, Metal);
            Cuboid(b, At(0, 39.5f, -1), R, Vector3.up, F, Px(6.2f), Hy(1.5f), Px(6.2f), navy, Metal);
            // The tube: from its tail, low behind the pier's top, up to its mouth.
            Vector3 tail = At(-3, 18, 0), mouth = At(32, 60, 0), ax = (mouth - tail).normalized;
            float r = Px(4.4f);
            Tube(b, tail, mouth, r, white, Paint, 20);
            Tube(b, tail + ax * 0.02f, tail + ax * 0.09f, r * 1.08f, cobalt, Paint, 20);
            Tube(b, mouth - ax * 0.05f, mouth + ax * 0.01f, r * 1.12f, black, Metal, 20);
            // The fork it turns in, the finder along its top, the eyepiece at its tail.
            foreach (var side in new[] { -1f, 1f }) Tube(b, At(0, 39, -1) + F * Px(5 * side), Vector3.Lerp(tail, mouth, 0.35f) + F * Px(5 * side), Px(1.1f), navy, Metal, 8);
            var up = Vector3.Cross(ax, Vector3.Cross(Vector3.up, ax)).normalized;
            Tube(b, Vector3.Lerp(tail, mouth, 0.45f) + up * r * 1.6f, Vector3.Lerp(tail, mouth, 0.75f) + up * r * 1.6f, r * 0.3f, black, Metal, 10);
            Tube(b, tail + up * r * 0.6f, tail + up * r * 0.6f - ax * Px(3) + up * Px(1.5f), Px(0.9f), black, Metal, 8);
        }

        /**
         * The orrery at Orbit (lm-peaks.ts): steel tracks level round the sun,
         * one for each planet that rides it (s.colours: each track's radius in
         * screen pixels across), each held by three thin spokes from the sun's
         * column.
         */
        static void Orrery(Bm b, SolidRec s)
        {
            var c = W(s.x, s.y, s.z);
            var steel = Real("#b8bfd6", Metal); var dark = Real("#5d6478", Metal);
            if (s.colours == null) return;
            int n = 0;
            foreach (var rs in s.colours)
            {
                float R = float.Parse(rs, System.Globalization.CultureInfo.InvariantCulture) / IslandBuild.PxPerUnit;
                Hoop(b, c, Vector3.right, Vector3.forward, R, Px(0.7f), steel, Metal, 96);
                for (int k = 0; k < 3; k++)
                {
                    float a = k * Mathf.PI * 2 / 3 + n * 0.6f;
                    var dir = new Vector3(Mathf.Cos(a), 0, Mathf.Sin(a));
                    Tube(b, c + dir * Px(15) + Up(-1.5f * n), c + dir * R, Px(0.35f), dark, Metal, 5);
                }
                n++;
            }
        }

        /**
         * The giant desk globe's meridian at How Fast (lm-peaks.ts): a steel ring
         * round the globe, face on, held at the poles on its tilted axis, and the
         * stand from the plinth up to it. (The globe itself turns: Creatures.cs, Globe.)
         */
        static void Meridian(Bm b, SolidRec s)
        {
            var c = W(s.x, s.y, s.z);
            var steel = Real("#c3c8de", Metal); var dark = Real("#4d556c", Metal);
            float R = Px(40);
            Vector3 right = Across, upS = Vector3.Cross(Facing, right).normalized;
            if (Vector3.Dot(upS, Vector3.up) < 0) upS = -upS;
            Hoop(b, c, right, upS, R, Px(1.5f), steel, Metal, 120);
            Hoop(b, c, right, upS, R - Px(1.6f), Px(0.55f), dark, Metal, 120);
            var axis = Globe.Axis;
            Tube(b, c + axis * Px(31), c + axis * (R + Px(1)), Px(1.4f), dark, Metal, 8);
            Tube(b, c - axis * Px(31), c - axis * (R + Px(1)), Px(1.4f), dark, Metal, 8);
            // The stand: from the ring's foot down to the plinth's top.
            var foot = c - upS * R;
            Tube(b, foot, new Vector3(foot.x, Hy(s.z - 36 + 0.5f) + (c.y - Hy(s.z)), foot.z), Px(3.2f), dark, Metal, 14);
        }

        /**
         * A print on a box's face (kit.ts, decal): the face's drawing, at u
         * along it and z up it, over [dx, dx + w] across (screen pixels, to
         * the right) and [dy, dy + h] down, laid a hair out from the face.
         */
        static void Decal(Bm b, SolidRec s)
        {
            if (s.b == null || s.prints == null || s.prints.Length == 0 || !Prints.Find(s.prints[0], out var uv0, out var uv1)) return;
            var x = s.b; bool fx = s.face == "x";
            float len = fx ? x.d : x.w;
            // Across the face, to the right on the picture: +i on face y, -j on face x; 32 screen pixels a tile.
            float U(float px) => s.u + (fx ? -px : px) / (32 * len);
            float uL = U(s.dx), uR = U(s.dx + s.w), zB = s.z - (s.dy + s.h), zT = s.z - s.dy;
            const float lift = 0.005f;
            b.QuadUV(On(x, s.face, uL, zB, lift), On(x, s.face, uR, zB, lift), On(x, s.face, uR, zT, lift), On(x, s.face, uL, zT, lift), Color.white, Printed, uv0, uv1);
        }

        /** A scarecrow in the garden at Life in Weeks: a pole and a crossbar, an old shirt in s.fill stuffed full, a sacking head, a hat in s.top. */
        static void Scarecrow(Bm b, SolidRec s)
        {
            var foot = W(s.x, s.y, s.z); var At = Frame(foot);
            var wood = Real("#8f7d6a", Timber); var shirt = Real(s.fill ?? "#5b82ff", Cloth); var sack = Real("#d8cbb0", Cloth); var hat = Real(s.top ?? "#b8a1ff", Cloth); var straw = Real("#d9c48a", Cloth);
            Tube(b, foot, At(0, 31, 0), Px(1.1f), wood, Timber, 8);
            Tube(b, At(-11, 21, 0), At(11, 21, 0), Px(0.9f), wood, Timber, 8);
            // The shirt: a stuffed body, and sleeves along the bar, straw at the cuffs.
            Round(b, At(0, 19, 0), new Vector3(Px(5), Hy(6.5f), Px(3.6f)), 0.45f, shirt, Cloth, 14, 10);
            foreach (var side in new[] { -1f, 1f })
            {
                Tube(b, At(side * 3, 21.5f, 0), At(side * 9.5f, 21, 0), Px(1.9f), shirt, Cloth, 10);
                Tube(b, At(side * 9.5f, 21, 0), At(side * 11.5f, 20, 0), Px(1.1f), straw, Cloth, 6);
            }
            Tube(b, At(0, 12.5f, 0), At(0, 10.5f, 0), Px(2.2f), straw, Cloth, 8);
            // The head, and the hat on it.
            Ball(b, At(0, 29, 0), Px(4.2f), -1, sack, Cloth);
            var crown = At(0, 33, 0);
            Round(b, crown + Up(-0.5f), new Vector3(Px(7.5f), Hy(0.6f), Px(7.5f)), 0.3f, hat, Cloth, 20, 4);
            Round(b, crown + Up(1.8f), new Vector3(Px(3.8f), Hy(2.6f), Px(3.8f)), 0.5f, hat, Cloth, 16, 8);
        }

        /** A watering can, put down by the beds: a round-shouldered body in s.fill, a long spout with its rose, a handle over the top. */
        static void WateringCan(Bm b, SolidRec s)
        {
            var At = Frame(W(s.x, s.y, s.z)); var tin = Real(s.fill ?? "#8ccbff", Metal);
            Round(b, At(-0.5f, 3.6f, 0), new Vector3(Px(4.4f), Hy(3.8f), Px(3.4f)), 0.7f, tin, Metal, 16, 10);
            Tube(b, At(2.5f, 3.5f, 0), At(9.5f, 8.5f, 0), Px(0.7f), tin, Metal, 8);
            Round(b, At(10, 9, 0), new Vector3(Px(1.4f), Hy(1.4f), Px(1.4f)), 0.6f, tin, Metal, 10, 6);
            for (int k = 0; k < 8; k++)
            {
                float t0 = Mathf.PI * k / 8, t1 = Mathf.PI * (k + 1) / 8;
                Tube(b, At(-4 + 6.5f * (1 - Mathf.Cos(t0)) / 2, 7.4f + Mathf.Sin(t0) * 3.2f, 0), At(-4 + 6.5f * (1 - Mathf.Cos(t1)) / 2, 7.4f + Mathf.Sin(t1) * 3.2f, 0), Px(0.55f), tin, Metal, 6);
            }
        }

        /** A round sign on a pole (the bus stop's): a steel pole s.h high, a plate s.r across in s.fill, edged, facing the viewer; its letter the page's. */
        static void RoundSign(Bm b, SolidRec s)
        {
            var At = Frame(W(s.x, s.y, s.z)); var R = Across; var F = Facing;
            var steel = Real("#5d6478", Metal); var plate = Real(s.fill ?? "#4fe3c1", Paint); var rim = Real("#f4f6fc", Paint);
            Tube(b, At(0, 0, -0.8f), At(0, s.h - s.r, -0.8f), Px(0.9f), steel, Metal, 8);
            var c = At(0, s.h, 0);
            const int n = 32;
            for (int k = 0; k < n; k++)
            {
                float a0 = k * Mathf.PI * 2 / n, a1 = (k + 1) * Mathf.PI * 2 / n;
                Vector3 P(float a, float r) => c + R * (Mathf.Cos(a) * Px(r)) + Vector3.up * (Mathf.Sin(a) * Hy(r));
                b.Tri(c, P(a0, s.r - 0.5f), P(a1, s.r - 0.5f), plate, Paint);
                b.Quad(P(a0, s.r - 0.5f), P(a1, s.r - 0.5f), P(a1, s.r), P(a0, s.r), rim, Paint);
                b.Quad(P(a0, s.r), P(a1, s.r), P(a1, s.r) - F * Px(0.8f), P(a0, s.r) - F * Px(0.8f), steel, Metal);
            }
        }

        /**
         * What a market stall sells, on its counter (town.ts, stall; s.side the kind): fruit in
         * shallow crates, fish on ice, potted flowers, ice creams, second-hand books.
         */
        static void Goods(Bm b, SolidRec s)
        {
            var At = Frame(W(s.x, s.y, s.z)); var R = Across; var F = Facing;
            var crate = Real("#a8957f", Timber); var rnd = new System.Random((int)(s.x * 97 + s.y * 31));
            float Rn() => (float)rnd.NextDouble();
            switch (s.side)
            {
                case "fruit":
                {
                    var kinds = new[] { Real("#d8344a", Paint), Real("#ff9fb2", Paint), Real("#7dbb3c", Paint), Real("#6f4a8e", Paint) };
                    for (int q = 0; q < 3; q++)
                    {
                        float cx = -7 + q * 7;
                        Cuboid(b, At(cx, 0.9f, 0), R, Vector3.up, F, Px(3.2f), Hy(0.9f), Px(2.6f), crate, Timber);
                        var col = kinds[q % kinds.Length];
                        for (int k = 0; k < 6; k++) Ball(b, At(cx - 2 + (k % 3) * 2, 2.6f + (k / 3) * 0.6f, -1.2f + (k / 3) * 2), Px(1.15f + Rn() * 0.15f), -1, col * (0.9f + Rn() * 0.2f), Paint);
                    }
                    break;
                }
                case "fish":
                {
                    var ice = Real("#eef3fa", Paint); var fish = Real("#9fb0cc", Metal); var tray = Real("#c3c8de", Metal);
                    Cuboid(b, At(0, 0.6f, 0), R, Vector3.up, F, Px(10), Hy(0.6f), Px(3), tray, Metal);
                    Cuboid(b, At(0, 1.3f, 0), R, Vector3.up, F, Px(9.5f), Hy(0.3f), Px(2.7f), ice, Paint);
                    for (int k = 0; k < 4; k++) Round(b, At(-7 + k * 4.6f, 1.9f, (k % 2) - 0.5f), new Vector3(Px(2.2f), Hy(0.6f), Px(0.9f)), 0.6f, fish * (0.9f + Rn() * 0.2f), Metal, 12, 6);
                    break;
                }
                case "flowers":
                {
                    var pot = Real("#5b82ff", Paint); var leaf = Real("#4a7a3c", Paint);
                    var blooms = new[] { Real("#ff9fb2", Cloth), Real("#ffffff", Cloth), Real("#b8a1ff", Cloth), Real("#ffd1da", Cloth) };
                    for (int k = 0; k < 4; k++)
                    {
                        float cx = -7.5f + k * 5;
                        Round(b, At(cx, 1.6f, 0), new Vector3(Px(1.5f), Hy(1.6f), Px(1.5f)), 0.8f, pot, Paint, 12, 6);
                        Round(b, At(cx, 3.6f, 0), new Vector3(Px(1.8f), Hy(1.2f), Px(1.8f)), 0.3f, leaf, Paint, 10, 6);
                        for (int q = 0; q < 5; q++) Ball(b, At(cx - 1.2f + Rn() * 2.4f, 4.4f + Rn() * 1.6f, Rn() * 1.6f - 0.8f), Px(0.75f), -1, blooms[k], Cloth);
                    }
                    break;
                }
                case "ices":
                {
                    var white = Real("#f4f6fc", Paint); var glass = Real("#9fd4ff", Glass); var cone = Real("#d9b984", Paint); var scoop = Real("#ffd1da", Paint);
                    Cuboid(b, At(-4, 2, 0), R, Vector3.up, F, Px(5), Hy(2), Px(2.6f), white, Paint);
                    b.Quad(At(-8.6f, 4.05f, 2.4f), At(0.6f, 4.05f, 2.4f), At(0.6f, 4.05f, -2.4f), At(-8.6f, 4.05f, -2.4f), glass, Glass);
                    Tube(b, At(5, 0.5f, 0), At(5, 4.5f, 0), Px(0.9f), cone, Paint, 10);
                    Ball(b, At(5, 5.4f, 0), Px(1.7f), -1, scoop, Paint);
                    break;
                }
                case "books":
                {
                    var cols = new[] { Real("#5b82ff", Paint), Real("#ff4f6e", Paint), Real("#4fe3c1", Paint), Real("#b8a1ff", Paint), Real("#e8e1d0", Paint) };
                    for (int k = 0; k < 8; k++)
                    {
                        float h = 2.5f + Rn() * 1.6f, th = 0.9f + Rn() * 0.6f;
                        Cuboid(b, At(-9 + k * 2.4f, h / 2, 0), R, Vector3.up, F, Px(th), Hy(h / 2), Px(2.2f), cols[k % cols.Length] * (0.85f + Rn() * 0.2f), Paint);
                    }
                    break;
                }
            }
        }

        /**
         * A market stall's canvas (town.ts, stall): six stripes, the colour and white in turn, sloping
         * from the back (s.z high) down to the front (s.h lower) over s.w by s.d tiles, sagging a little
         * between its poles, and a scalloped valance hanging along the front.
         */
        static void StallAwning(Bm b, SolidRec s)
        {
            var col = Real(s.fill ?? "#ff4f6e", Cloth); var white = Real("#f4f6fc", Cloth);
            const int n = 6, rows = 6;
            Vector3 P(float t, float u) { float sag = Mathf.Sin(t * Mathf.PI) * 0.6f; return W(s.x + s.w * t, s.y + s.d * u, s.z - s.h * u - sag); }
            for (int k = 0; k < n; k++)
                for (int q = 0; q < rows; q++)
                {
                    float t0 = (float)k / n, t1 = (float)(k + 1) / n, u0 = (float)q / rows, u1 = (float)(q + 1) / rows;
                    b.Quad(P(t0, u0), P(t1, u0), P(t1, u1), P(t0, u1), k % 2 == 0 ? col : white, Cloth);
                }
            // The valance: scallops hanging from the front edge.
            for (int k = 0; k < n; k++)
            {
                var c = k % 2 == 0 ? col : white;
                for (int q = 0; q < 6; q++)
                {
                    float t0 = (k + q / 6f) / n, t1 = (k + (q + 1) / 6f) / n;
                    float d0 = 2.2f + 2.2f * Mathf.Sin(Mathf.PI * q / 6f), d1 = 2.2f + 2.2f * Mathf.Sin(Mathf.PI * (q + 1) / 6f);
                    var a = P(t0, 1); var bb = P(t1, 1);
                    b.Quad(a - Vector3.up * Hy(d0), bb - Vector3.up * Hy(d1), bb, a, c, Cloth);
                }
            }
        }

        /** A campfire on the beach: a ring of stones, two logs crossed and charred, embers in the ash. (Its flame is the page's: it moves.) */
        static void Campfire(Bm b, SolidRec s)
        {
            var c = W(s.x, s.y, s.z);
            var stone = Real("#9a9cad", Concrete); var log = Real("#7a6656", Timber); var char_ = Real("#2c2828", Paint); var ash = Real("#5e5a5c", Concrete); var ember = Real("#c4472c", Paint);
            var rnd = new System.Random((int)(s.x * 131 + s.y * 17));
            for (int k = 0; k < 8; k++)
            {
                float a = k * Mathf.PI * 2 / 8 + (float)rnd.NextDouble() * 0.3f, r = 0.17f;
                var at = c + new Vector3(Mathf.Cos(a) * r, 0, Mathf.Sin(a) * r);
                Round(b, at + Up(1), new Vector3(Px(2.4f), Hy(1.6f + (float)rnd.NextDouble()), Px(2.1f)), 0.75f, stone * (0.85f + (float)rnd.NextDouble() * 0.3f), Concrete, 10, 6);
            }
            Round(b, c + Up(0.3f), new Vector3(0.13f, Hy(0.5f), 0.13f), 0.5f, ash, Concrete, 16, 4);
            foreach (var (a, lift) in new[] { (0.6f, 1.2f), (-0.7f, 2.4f) })
            {
                var d = new Vector3(Mathf.Cos(a), 0, Mathf.Sin(a)) * 0.15f;
                Tube(b, c - d + Up(lift), c + d + Up(lift + 1.4f), Px(1.3f), log, Timber, 10);
                Tube(b, c - d * 0.25f + Up(lift + 0.6f), c + d * 0.25f + Up(lift + 0.9f), Px(1.38f), char_, Paint, 10);
            }
            for (int k = 0; k < 5; k++) Ball(b, c + new Vector3(((float)rnd.NextDouble() - 0.5f) * 0.12f, Hy(0.8f), ((float)rnd.NextDouble() - 0.5f) * 0.12f), Px(0.9f), -1, ember, Paint);
        }

        /**
         * A message in a bottle, washed up (town.ts, beachBottle): a bottle of tinted glass (s.fill)
         * lying on the sand, the rolled note showing pale through it, a cork in its neck.
         */
        static void Bottle(Bm b, SolidRec s)
        {
            var c = W(s.x, s.y, s.z);
            var glass = Real(s.fill ?? "#7fd1b9", Paint); var note = Real("#f6f1e2", Paint); var cork = Real("#b08e6e", Timber);
            float k = s.rows == 1 ? -1 : 1;
            var ax = (Across * k * Mathf.Cos(9 * Mathf.Deg2Rad) + Vector3.up * 0.16f).normalized;
            var u = Vector3.Cross(ax, Facing).normalized; var v = Vector3.Cross(ax, u).normalized;
            var start = c + Up(3.4f) - ax * Px(9);
            // Along the bottle: its radius at each distance from its base (screen pixels).
            (float d, float r)[] prof = { (0, 0), (0.3f, 3.0f), (1.0f, 3.35f), (11.5f, 3.35f), (13.5f, 2.4f), (15f, 1.25f), (18f, 1.15f), (18.6f, 1.35f), (19.2f, 1.2f) };
            const int sides = 20;
            for (int q = 0; q + 1 < prof.Length; q++)
                for (int i = 0; i < sides; i++)
                {
                    float a0 = i * Mathf.PI * 2 / sides, a1 = (i + 1) * Mathf.PI * 2 / sides;
                    Vector3 P(int j, float a) => start + ax * Px(prof[j].d) + (u * Mathf.Cos(a) + v * Mathf.Sin(a)) * Px(prof[j].r);
                    // The note inside shows through the glass along the middle of the body, palest on the side towards us.
                    float mid = (prof[q].d + prof[q + 1].d) / 2;
                    bool paper = mid > 1.5f && mid < 9.5f;
                    var col = paper ? Color.Lerp(glass, note, 0.55f) : glass;
                    b.Quad(P(q, a0), P(q, a1), P(q + 1, a1), P(q + 1, a0), col, Paint);
                }
            Tube(b, start + ax * Px(18.8f), start + ax * Px(21.4f), Px(1.25f), cork, Timber, 12);
        }

        /** A paper boat, a boat's size, tied up at Paper Folds: a folded hull, its sail-peak rising from the middle, creased where it was folded. */
        static void PaperBoat(Bm b, SolidRec s)
        {
            var At = Frame(W(s.x, s.y, s.z)); var paper = Real("#f4f6fc", Paint); var fold = Real("#dfe4f5", Paint);
            // The hull: wider at the top than at the keel, both sides folded up.
            Vector3 tl = At(-13, 5, 0), tr = At(13, 5, 0), bl = At(-8, -2, 0), br = At(8, -2, 0);
            Vector3 tlB = At(-13, 5, -6), trB = At(13, 5, -6), blB = At(-8, -2, -3), brB = At(8, -2, -3);
            b.Quad(bl, br, tr, tl, paper, Paint);
            b.Quad(blB, brB, trB, tlB, fold, Paint);
            b.Quad(bl, blB, brB, br, fold, Paint);
            b.Tri(tl, bl, blB, fold, Paint); b.Tri(tl, blB, tlB, fold, Paint);
            b.Tri(tr, br, brB, paper, Paint); b.Tri(tr, brB, trB, paper, Paint);
            // The peak in the middle: two folded triangles, a crease down between them.
            Vector3 apex = At(0, 21, -3), pl = At(-7, 5, -3), pr = At(7, 5, -3), mid = At(0, 5, -1.5f);
            b.Tri(pl, mid, apex, paper, Paint); b.Tri(mid, pr, apex, fold, Paint);
            b.Tri(pl, apex, At(0, 5, -4.5f), fold, Paint); b.Tri(At(0, 5, -4.5f), apex, pr, paper, Paint);
        }

        /**
         * A finger-post at a district's edge (town.ts, signpost): a square timber post s.h high with a
         * little pyramid cap, and an arm for each way (s.pts: its direction on the ground, in threes),
         * pointed at its tip, painted in its district's colour (s.colours) with its emblem (s.prints) on
         * the side we see. The names are the page's.
         */
        static void Fingerpost(Bm b, SolidRec s)
        {
            var foot = W(s.x, s.y, s.z);
            var wood = Real("#8f7d6a", Timber);
            float half = Px(2.1f);
            Cuboid(b, foot + Up(s.h / 2), Vector3.right, Vector3.up, Vector3.forward, half, Hy(s.h / 2), half, wood, Timber);
            var top = foot + Up(s.h);
            var c0 = top + new Vector3(-half, 0, -half); var c1 = top + new Vector3(half, 0, -half); var c2 = top + new Vector3(half, 0, half); var c3 = top + new Vector3(-half, 0, half); var apex = top + Up(2.6f);
            b.Tri(c0, c1, apex, wood * 0.85f, Timber); b.Tri(c1, c2, apex, wood * 0.85f, Timber); b.Tri(c2, c3, apex, wood * 0.85f, Timber); b.Tri(c3, c0, apex, wood * 0.85f, Timber);
            if (s.pts == null) return;
            for (int n = 0; n * 3 + 1 < s.pts.Length; n++)
            {
                float di = s.pts[n * 3], dj = s.pts[n * 3 + 1];
                var dir = new Vector3(dj, 0, di).normalized;
                var side = Vector3.Cross(Vector3.up, dir).normalized;
                // An arm 32 screen pixels long along an axis of the ground: a tile.
                float r0 = 1.2f / 32, r1 = (32 - 4.6f) / 32, r2 = 1f;
                float hb = Hy(3.7f), th = 0.012f;
                var mid = foot + Up(s.h - 5 - n * 8.2f);
                var col = Real(s.colours != null && n < s.colours.Length ? s.colours[n] : "#5b82ff", Paint);
                Vector3 P(float r, float up, float sd) => mid + dir * r + Vector3.up * up + side * sd;
                foreach (var sd in new[] { -th / 2, th / 2 })
                {
                    b.Quad(P(r0, -hb, sd), P(r1, -hb, sd), P(r1, hb, sd), P(r0, hb, sd), col, Paint);
                    b.Tri(P(r1, -hb, sd), P(r2, 0, sd), P(r1, hb, sd), col, Paint);
                }
                b.Quad(P(r0, hb, -th / 2), P(r1, hb, -th / 2), P(r1, hb, th / 2), P(r0, hb, th / 2), col * 1.08f, Paint);
                b.Quad(P(r1, hb, -th / 2), P(r2, 0, -th / 2), P(r2, 0, th / 2), P(r1, hb, th / 2), col * 1.04f, Paint);
                b.Quad(P(r0, -hb, -th / 2), P(r1, -hb, -th / 2), P(r1, -hb, th / 2), P(r0, -hb, th / 2), col * 0.8f, Paint);
                b.Quad(P(r1, -hb, -th / 2), P(r2, 0, -th / 2), P(r2, 0, th / 2), P(r1, -hb, th / 2), col * 0.8f, Paint);
                // Its emblem, on the face towards us, a hair out from it; read left to right on the picture.
                if (s.prints != null && n < s.prints.Length && Prints.Find(s.prints[n], out var uv0, out var uv1))
                {
                    float face = Vector3.Dot(side, Facing) >= 0 ? th / 2 + 0.002f : -th / 2 - 0.002f;
                    bool rightward = Vector3.Dot(dir, Across) >= 0;
                    float e = 0.82f * 7f / 32, ec = 7.2f / 32;
                    Vector3 a = P(ec - e / 2, -Hy(2.87f), face), bb = P(ec + e / 2, -Hy(2.87f), face), cc = P(ec + e / 2, Hy(2.87f), face), d = P(ec - e / 2, Hy(2.87f), face);
                    if (rightward) b.QuadUV(a, bb, cc, d, Color.white, Printed, uv0, uv1);
                    else b.QuadUV(bb, a, d, cc, Color.white, Printed, uv0, uv1);
                }
            }
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
                case "noticeboard": Noticeboard(b, s); break;
                case "plaque": Plaque(b, s); break;
                case "dish": Dish(b, s); break;
                case "decal": Decal(b, s); break;
                case "scarecrow": Scarecrow(b, s); break;
                case "can": WateringCan(b, s); break;
                case "roundsign": RoundSign(b, s); break;
                case "goods": Goods(b, s); break;
                case "stallawning": StallAwning(b, s); break;
                case "campfire": Campfire(b, s); break;
                case "bottle": Bottle(b, s); break;
                case "paperboat": PaperBoat(b, s); break;
                case "fingerpost": Fingerpost(b, s); break;
                case "telescope": Telescope(b, s); break;
                case "orrery": Orrery(b, s); break;
                case "meridian": Meridian(b, s); break;
                // The trench: Unity's sea floor (Terrain3D, Isle), nothing to build.
                case "trench": break;
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
