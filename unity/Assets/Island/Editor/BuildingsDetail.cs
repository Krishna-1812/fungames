// What makes a box a building: its windows and doors are openings in the
// wall, with reveals going in, the glass set back and a sill standing out;
// its foot on a plinth; a flat roof behind a coping, with a vent or a plant
// box on it; a pitched roof with a ridge, gutters along the eaves, downpipes
// to the ground and, on most houses, a chimney.
//
// The site draws a building's walls, then its windows and doors on them, in
// runs (Buildings.cs). Prepare reads a whole building first, so each wall
// knows its openings, which roofs have nothing standing on them, and where
// the building's foot is.
using System.Collections.Generic;
using UnityEngine;

namespace Island
{
    public static partial class Buildings
    {
        class Hole { public string face; public float u0, u1, z0, z1; public bool door; }
        static readonly Dictionary<string, List<Hole>> holes = new();
        static readonly List<Vector3> stands = new();
        /** Glass walls: not cut (their windows are drawn on). */
        static readonly HashSet<string> glassy = new();
        /** Every box's footprint and its top: what stands on what. */
        static readonly List<(float x, float y, float w, float d, float z0, float top)> boxes = new();
        static float foot;

        static string Key(float x, float y, float w, float d, float z0, float h) =>
            string.Format(System.Globalization.CultureInfo.InvariantCulture, "{0:F4},{1:F4},{2:F4},{3:F4},{4:F3},{5:F3}", x, y, w, d, z0, h);
        static string Key(SolidBox b) => Key(b.x, b.y, b.w, b.d, b.z0, b.h);

        /** How far in an opening goes before the glass, and the room behind it. */
        const float Reveal = 0.034f, Room = 0.07f;

        /** Read a whole building before building any of its runs. */
        public static void Prepare(BuildingSolids bs)
        {
            holes.Clear(); stands.Clear(); glassy.Clear(); boxes.Clear(); foot = float.MaxValue;
            HeroOf(bs);
            foreach (var run in bs.runs)
                foreach (var s in Parse(run))
                    if (s.k == "box" && WallOf(s.fill) == Glass) glassy.Add(Key(s.x, s.y, s.w, s.d, s.z0, s.h));
            foreach (var run in bs.runs)
                foreach (var s in Parse(run))
                {
                    switch (s.k)
                    {
                        case "box":
                            foot = Mathf.Min(foot, s.z0);
                            boxes.Add((s.x, s.y, s.w, s.d, s.z0, s.z0 + s.h));
                            break;
                        case "win":
                            {
                                float slot = 1f / s.cols, ww = slot * s.wide;
                                for (int r = 0; r < s.rows; r++)
                                    for (int c = 0; c < s.cols; c++)
                                    {
                                        float u = slot * (c + 0.5f), z = s.z0 + r * (s.h + s.gap);
                                        Add(s.b, new Hole { face = s.face, u0 = u - ww / 2, u1 = u + ww / 2, z0 = z, z1 = z + s.h });
                                    }
                            }
                            break;
                        case "door":
                            {
                                float len = s.face == "x" ? s.b.d : s.b.w, w = s.w / len;
                                Add(s.b, new Hole { face = s.face, u0 = s.u - w / 2, u1 = s.u + w / 2, z0 = 0, z1 = s.h, door = true });
                            }
                            break;
                        case "gable": case "pyramid": stands.Add(new Vector3(s.x + s.w / 2, s.y + s.d / 2, s.z)); break;
                        case "cyl": case "cone": case "dome": stands.Add(new Vector3(s.cx, s.cy, s.z0)); break;
                        case "sphere": case "disc": stands.Add(new Vector3(s.cx, s.cy, s.z)); break;
                        case "model": stands.Add(new Vector3(s.x, s.y, s.z)); break;
                        case "rod": case "poly":
                            if (s.pts != null) for (int k = 0; k + 2 < s.pts.Length; k += 3) stands.Add(new Vector3(s.pts[k], s.pts[k + 1], s.pts[k + 2]));
                            break;
                    }
                }
            if (foot == float.MaxValue) foot = 0;
            auditGeology = bs.slug == "deep-time";
        }
        static void Add(SolidBox b, Hole h)
        {
            var k = Key(b);
            if (glassy.Contains(k)) return;
            if (!holes.TryGetValue(k, out var list)) holes[k] = list = new List<Hole>();
            // Inside the wall only.
            h.u0 = Mathf.Clamp01(h.u0); h.u1 = Mathf.Clamp01(h.u1); h.z0 = Mathf.Clamp(h.z0, 0, b.h); h.z1 = Mathf.Clamp(h.z1, 0, b.h);
            if (h.u1 - h.u0 > 1e-4f && h.z1 - h.z0 > 0.2f) list.Add(h);
        }
        static List<Hole> HolesOf(SolidBox b) => holes.TryGetValue(Key(b), out var l) ? l : null;

        static float Overlap(float ax, float aw, float bx, float bw) => Mathf.Max(0, Mathf.Min(ax + aw, bx + bw) - Mathf.Max(ax, bx));
        /** Whether a box's top is covered (another storey on most of it, a roof, a dome: anything but a few things on a roof). */
        static bool Covered(SolidRec s)
        {
            float top = s.z0 + s.h;
            foreach (var p in stands)
                if (p.z >= top - 1.5f && p.z <= top + 1.5f && p.x > s.x + 0.01f && p.x < s.x + s.w - 0.01f && p.y > s.y + 0.01f && p.y < s.y + s.d - 0.01f) return true;
            foreach (var q in boxes)
                if (Mathf.Abs(q.z0 - top) < 1.5f && Overlap(q.x, q.w, s.x, s.w) * Overlap(q.y, q.d, s.y, s.d) > 0.5f * s.w * s.d) return true;
            return false;
        }
        /** Whether anything stands on a box's top at all (no plant room or vents, then). */
        static bool Busy(SolidRec s)
        {
            float top = s.z0 + s.h;
            foreach (var q in boxes)
                if (Mathf.Abs(q.z0 - top) < 1.5f && Overlap(q.x, q.w, s.x, s.w) * Overlap(q.y, q.d, s.y, s.d) > 0) return true;
            foreach (var p in stands)
                if (p.z >= top - 1.5f && p.x > s.x && p.x < s.x + s.w && p.y > s.y && p.y < s.y + s.d) return true;
            return false;
        }
        /** Whether a pitched roof stands on walls (a house), not on posts (a canopy, a noticeboard). */
        static bool OnWalls(SolidRec g)
        {
            foreach (var q in boxes)
                if (Mathf.Abs(q.top - g.z) < 1.5f && Overlap(q.x, q.w, g.x, g.w) * Overlap(q.y, q.d, g.y, g.d) > 0.5f * g.w * g.d) return true;
            return false;
        }

        /** A fixed hash of a few numbers, 0..1. */
        static float H(float a, float b, float c = 0) { float v = Mathf.Sin(a * 127.1f + b * 311.7f + c * 74.7f) * 43758.5453f; return v - Mathf.Floor(v); }

        /* ---- a face, and things on it -------------------------------------------- */

        /** A point on a box's face ('x': the +i face, u along j; 'y': the +j face, u along i), z up from its foot, `out` from the wall. */
        static Vector3 On(SolidBox x, string face, float u, float z, float outward = 0) =>
            face == "x" ? W(x.x + x.w + outward, x.y + u * x.d, x.z0 + z) : W(x.x + u * x.w, x.y + x.d + outward, x.z0 + z);
        static float LenOf(SolidBox x, string face) => face == "x" ? x.d : x.w;

        /**
         * A block on a face: u0..u1 along it, z0..z1 up it, from `d0` to `d1`
         * out from the wall (negative: into it), with its front, top, bottom
         * and ends.
         */
        static void Block(Bm b, SolidBox x, string face, float u0, float u1, float z0, float z1, float d0, float d1, Color col, int mat, float ao = 1)
        {
            // Along the face from the eye's left to its right: for 'x' u rises, for 'y' it falls.
            float ua = face == "x" ? u0 : u1, ub = face == "x" ? u1 : u0;
            var o = On(x, face, 0, 0, d1);
            b.QuadAt(On(x, face, ua, z0, d1), On(x, face, ub, z0, d1), On(x, face, ub, z1, d1), On(x, face, ua, z1, d1), col, mat, ao, 1, o);
            b.Quad(On(x, face, ua, z1, d0), On(x, face, ua, z1, d1), On(x, face, ub, z1, d1), On(x, face, ub, z1, d0), col, mat, 1, 1);
            b.Quad(On(x, face, ub, z0, d0), On(x, face, ub, z0, d1), On(x, face, ua, z0, d1), On(x, face, ua, z0, d0), col, mat, ao, ao);
            b.Quad(On(x, face, ua, z0, d0), On(x, face, ua, z0, d1), On(x, face, ua, z1, d1), On(x, face, ua, z1, d0), col, mat, ao, 1);
            b.Quad(On(x, face, ub, z0, d1), On(x, face, ub, z0, d0), On(x, face, ub, z1, d0), On(x, face, ub, z1, d1), col, mat, ao, 1);
        }
        /** An axis-aligned block in the site's units (tiles; z in its heights). */
        static void Slab(Bm b, float i0, float j0, float i1, float j1, float z0, float z1, Color col, int mat, float ao = 1)
        {
            var x = new SolidBox { x = i0, y = j0, w = i1 - i0, d = j1 - j0, z0 = z0, h = z1 - z0 };
            b.Quad(W(i1, j0, z0), W(i1, j1, z0), W(i1, j1, z1), W(i1, j0, z1), col, mat, ao, 1);
            b.Quad(W(i1, j1, z0), W(i0, j1, z0), W(i0, j1, z1), W(i1, j1, z1), col, mat, ao, 1);
            b.Quad(W(i0, j1, z0), W(i0, j0, z0), W(i0, j0, z1), W(i0, j1, z1), col, mat, ao, 1);
            b.Quad(W(i0, j0, z0), W(i1, j0, z0), W(i1, j0, z1), W(i0, j0, z1), col, mat, ao, 1);
            b.Quad(W(i0, j0, z1), W(i1, j0, z1), W(i1, j1, z1), W(i0, j1, z1), col, mat);
            _ = x;
        }

        /**
         * A wall with its openings cut out: the wall in pieces round them (one
         * pattern running on across the pieces), and each opening's reveal
         * going into the wall, and the dark of the room behind.
         */
        static void Wall(Bm b, SolidBox x, string face, Color col, int wm, float ao0, List<Hole> hs)
        {
            var us = new List<float> { 0, 1 }; var zs = new List<float> { 0, x.h };
            var mine = new List<Hole>();
            if (hs != null) foreach (var h in hs) if (h.face == face) { mine.Add(h); us.Add(h.u0); us.Add(h.u1); zs.Add(h.z0); zs.Add(h.z1); }
            us.Sort(); zs.Sort();
            var o = On(x, face, 0, 0);
            float Ao(float z) => Mathf.Lerp(ao0, 1, Mathf.Clamp01(z / Mathf.Max(x.h, 1) * 2.5f));
            for (int a = 0; a + 1 < us.Count; a++)
                for (int c = 0; c + 1 < zs.Count; c++)
                {
                    float u0 = us[a], u1 = us[a + 1], z0 = zs[c], z1 = zs[c + 1];
                    if (u1 - u0 < 1e-5f || z1 - z0 < 1e-3f) continue;
                    float um = (u0 + u1) / 2, zm = (z0 + z1) / 2;
                    bool inHole = false;
                    foreach (var h in mine) if (um > h.u0 && um < h.u1 && zm > h.z0 && zm < h.z1) { inHole = true; break; }
                    if (inHole) continue;
                    float ua = face == "x" ? u0 : u1, ub = face == "x" ? u1 : u0;
                    b.QuadAt(On(x, face, ua, z0), On(x, face, ub, z0), On(x, face, ub, z1), On(x, face, ua, z1), col, wm, Ao(z0), Ao(z1), o);
                }
            // The reveals: the wall's thickness, round each opening, in its own material a shade lighter where the light catches it; the room behind, dark.
            var rev = col * 0.96f; rev.a = 1;
            var room = new Color(0.025f, 0.028f, 0.035f);
            foreach (var h in mine)
            {
                float ua = face == "x" ? h.u0 : h.u1, ub = face == "x" ? h.u1 : h.u0;
                // Jambs, head and (for a window) the bottom.
                b.Quad(On(x, face, ua, h.z0, 0), On(x, face, ua, h.z0, -Room), On(x, face, ua, h.z1, -Room), On(x, face, ua, h.z1, 0), rev, wm, 0.8f, 0.8f);
                b.Quad(On(x, face, ub, h.z0, -Room), On(x, face, ub, h.z0, 0), On(x, face, ub, h.z1, 0), On(x, face, ub, h.z1, -Room), rev, wm, 0.8f, 0.8f);
                b.Quad(On(x, face, ua, h.z1, 0), On(x, face, ua, h.z1, -Room), On(x, face, ub, h.z1, -Room), On(x, face, ub, h.z1, 0), rev, wm, 0.7f, 0.7f);
                if (!h.door) b.Quad(On(x, face, ub, h.z0, 0), On(x, face, ub, h.z0, -Room), On(x, face, ua, h.z0, -Room), On(x, face, ua, h.z0, 0), rev, wm, 0.85f, 0.85f);
                b.Quad(On(x, face, ua, h.z0, -Room), On(x, face, ub, h.z0, -Room), On(x, face, ub, h.z1, -Room), On(x, face, ua, h.z1, -Room), room, Paint, 0.5f, 0.5f);
            }
        }

        /** A box: its walls cut for their openings, on a plinth; a roof behind a coping if nothing stands on it. */
        static void BoxDetailed(Bm b, SolidRec s)
        {
            var x = new SolidBox { x = s.x, y = s.y, w = s.w, d = s.d, z0 = s.z0, h = s.h };
            int wm = WallOf(s.fill);
            var col = Real(s.fill, wm);
            bool onGround = s.z0 <= foot + 0.5f;
            float ao0 = onGround ? 0.62f : 0.85f;
            var hs = HolesOf(x);
            float i0 = s.x, j0 = s.y, i1 = s.x + s.w, j1 = s.y + s.d, z0 = s.z0, z1 = s.z0 + s.h;
            // The two walls the site shows, cut for their windows and doors; the two behind whole.
            Wall(b, x, "x", col, wm, ao0, hs);
            Wall(b, x, "y", col, wm, ao0, hs);
            b.Quad(W(i0, j1, z0), W(i0, j0, z0), W(i0, j0, z1), W(i0, j1, z1), col, wm, ao0);
            b.Quad(W(i0, j0, z0), W(i1, j0, z0), W(i1, j0, z1), W(i0, j0, z1), col, wm, ao0);
            int tm = wm == Glass ? Glass : Concrete;
            var topCol = Real(s.top ?? s.fill, tm);
            bool roof = !Covered(s) && s.h >= 2 && s.w >= 0.2f && s.d >= 0.2f && wm != Glass;
            b.Quad(W(i0, j0, z1), W(i1, j0, z1), W(i1, j1, z1), W(i0, j1, z1), topCol, tm, roof ? 0.85f : 1, roof ? 0.85f : 1);
            if (!string.IsNullOrEmpty(s.trim)) Cornice(b, x, s.trim);
            // A plinth along the foot of the walls we see, broken for the doors.
            if (onGround && s.h >= 10 && (wm == Plaster || wm == Brick || wm == Concrete || wm == Timber))
            {
                var pl = Real(s.fill, Concrete) * 0.74f; pl.a = 1;
                foreach (var face in new[] { "x", "y" })
                {
                    var cuts = new List<(float, float)>();
                    if (hs != null) foreach (var h in hs) if (h.face == face && h.door) cuts.Add((h.u0 - 0.01f, h.u1 + 0.01f));
                    cuts.Sort();
                    float u = 0;
                    foreach (var (a, c) in cuts) { if (a > u) Block(b, x, face, u, a, 0, 3.2f, 0, 0.009f, pl, Concrete, 0.7f); u = Mathf.Max(u, c); }
                    if (u < 1) Block(b, x, face, u, 1, 0, 3.2f, 0, 0.009f, pl, Concrete, 0.7f);
                }
            }
            if (roof) RoofTop(b, s, col, topCol);
        }

        /** A cornice: a band standing proud at the top, and a thinner lip above it. */
        static void Cornice(Bm b, SolidBox x, string fill)
        {
            Band(b, x, x.h - 3, x.h - 0.8f, fill, 0.011f);
            Band(b, x, x.h - 0.8f, x.h, fill, 0.02f);
        }

        /** A flat roof: a coping round its edge, and what stands on a roof (vents, a plant box, a hatch). */
        static void RoofTop(Bm b, SolidRec s, Color wall, Color top)
        {
            float i0 = s.x, j0 = s.y, i1 = s.x + s.w, j1 = s.y + s.d, z = s.z0 + s.h;
            var cope = Real("#d5d9ea", Concrete);
            float t = 0.026f, p = 0.006f, hgt = 1.6f;
            Slab(b, i0 - p, j0 - p, i1 + p, j0 + t, z, z + hgt, cope, Concrete);
            Slab(b, i0 - p, j1 - t, i1 + p, j1 + p, z, z + hgt, cope, Concrete);
            Slab(b, i0 - p, j0 + t, i0 + t, j1 - t, z, z + hgt, cope, Concrete);
            Slab(b, i1 - t, j0 + t, i1 + p, j1 - t, z, z + hgt, cope, Concrete);
            float area = s.w * s.d;
            if (area < 0.12f || Busy(s)) return;
            var metal = Real("#c9cde0", Metal); var dark = Real("#3d4458", Metal);
            // A plant box (an air handler) with its fan, on bigger roofs.
            if (area > 0.3f && H(s.x, s.y, 1) < 0.75f)
            {
                float ci = Mathf.Lerp(i0 + 0.12f, i1 - 0.2f, H(s.x, s.y, 2)), cj = Mathf.Lerp(j0 + 0.12f, j1 - 0.16f, H(s.x, s.y, 3));
                Slab(b, ci, cj, ci + 0.11f, cj + 0.08f, z, z + 3.4f, metal, Metal, 0.7f);
                Lid(b, ci + 0.055f, cj + 0.04f, 0.026f, z + 3.45f, dark, Metal);
                for (int k = 0; k < 4; k++) Slab(b, ci + 0.11f, cj + 0.01f + k * 0.018f, ci + 0.114f, cj + 0.016f + k * 0.018f, z + 0.6f, z + 2.8f, dark, Metal);
            }
            // Vent pipes, and a hatch.
            int vents = 1 + (int)(H(s.x, s.y, 4) * 2.99f);
            for (int k = 0; k < vents; k++)
            {
                float vi = Mathf.Lerp(i0 + 0.06f, i1 - 0.06f, H(s.x, s.y, 10 + k)), vj = Mathf.Lerp(j0 + 0.06f, j1 - 0.06f, H(s.x, s.y, 20 + k));
                var bottom = W(vi, vj, z); var cap = W(vi, vj, z + 2.6f + H(k, s.x) * 1.5f);
                Tube(b, bottom, cap, 0.009f, metal, Metal, 8);
                Lathe(b, vi, vj, 0, new[] { (cap.y * IslandBuild.PxPerHeight, 0.016f), (cap.y * IslandBuild.PxPerHeight + 0.8f, 0.016f) }, _ => dark, Metal, 10);
            }
            if (area > 0.2f)
            {
                float hi = Mathf.Lerp(i0 + 0.05f, i1 - 0.1f, H(s.x, s.y, 30)), hj = Mathf.Lerp(j0 + 0.05f, j1 - 0.1f, H(s.x, s.y, 31));
                Slab(b, hi, hj, hi + 0.06f, hj + 0.06f, z, z + 1.1f, Real("#9aa3c0", Metal), Metal, 0.75f);
            }
        }

        /* ---- windows and doors ------------------------------------------------- */

        /** A pane's seed, and over it (in twos) whether its room is lit tonight and by which light (Night.PaneLight). */
        static float PaneSeed(SolidRec s, float u, float z, float seed)
        {
            int room = Night.PaneLight(HeroPt(On(s.b, s.face, u, z + s.h / 2)));
            return Mathf.Clamp(seed, 0, 0.999f) + (room >= 0 ? 2 * (room + 1) : 0);
        }

        /** Windows set into their openings: the glass back in the reveal, its frame and bars, a stone sill standing out under it, a lintel over it. */
        static void WindowsDetailed(Bm b, SolidRec s)
        {
            float len = LenOf(s.b, s.face);
            float slot = 1f / s.cols, ww = slot * s.wide;
            var frame = Real(s.frame, Paint);
            var glass = Real(s.pane, Glass);
            var stone = Real("#d5d9ea", Concrete);
            int wallMat = WallOf("#ffffff");
            float fu = 0.011f / Mathf.Max(len, 0.05f), bar = 0.0042f / Mathf.Max(len, 0.05f), eu = 0.016f / Mathf.Max(len, 0.05f);
            const float g = -Reveal;
            for (int r = 0; r < s.rows; r++)
                for (int c = 0; c < s.cols; c++)
                {
                    float u = slot * (c + 0.5f), z = s.z0 + r * (s.h + s.gap);
                    float u0 = u - ww / 2, u1 = u + ww / 2, z1 = z + s.h;
                    // The glass (each pane its own room behind it), and the frame round it in the reveal.
                    float ua = s.face == "x" ? u0 : u1, ub = s.face == "x" ? u1 : u0;
                    b.QuadUnit(On(s.b, s.face, ua, z, g), On(s.b, s.face, ub, z, g), On(s.b, s.face, ub, z1, g), On(s.b, s.face, ua, z1, g), glass, Pane, PaneSeed(s, u, z, H(s.b.x + u * 7.3f, s.b.y + z * 0.37f, r * 3 + c)));
                    Block(b, s.b, s.face, u0, u0 + fu, z, z1, g, g + 0.008f, frame, Paint);
                    Block(b, s.b, s.face, u1 - fu, u1, z, z1, g, g + 0.008f, frame, Paint);
                    Block(b, s.b, s.face, u0, u1, z1 - 1.1f, z1, g, g + 0.008f, frame, Paint);
                    Block(b, s.b, s.face, u0, u1, z, z + 1.1f, g, g + 0.008f, frame, Paint);
                    // Glazing bars: one down the middle, a transom a little above halfway.
                    Block(b, s.b, s.face, u - bar, u + bar, z, z1, g, g + 0.006f, frame, Paint);
                    Block(b, s.b, s.face, u0, u1, z + s.h * 0.62f - 0.45f, z + s.h * 0.62f + 0.45f, g, g + 0.006f, frame, Paint);
                    // The sill, out from the wall and a little wider than the opening; a lintel over it.
                    Block(b, s.b, s.face, u0 - eu, u1 + eu, z - 1.3f, z, g, 0.02f, stone, Concrete);
                    Block(b, s.b, s.face, u0 - eu * 0.6f, u1 + eu * 0.6f, z1, z1 + 1.5f, 0, 0.005f, stone, Concrete);
                }
            _ = wallMat;
        }

        /** A door set in its opening: a panelled leaf, a fanlight, a painted surround standing out round it, a stone step. */
        static void DoorDetailed(Bm b, SolidRec s)
        {
            float len = LenOf(s.b, s.face);
            float w = s.w / len, u0 = s.u - w / 2, u1 = s.u + w / 2, e = 0.018f / len;
            var leaf = Real(s.fill, Paint); var trim = Real("#f4f6fc", Paint); var stone = Real("#c3c8de", Concrete);
            float g = -Reveal * 0.8f, top = s.h * 0.78f;
            Panel(b, s.b, s.face, u0, u1, 0, top, leaf, Timber, g, 0.7f);
            // Raised panels on the leaf: two tall, one low.
            float pu = (u1 - u0) * 0.12f;
            Block(b, s.b, s.face, u0 + pu, s.u - pu * 0.5f, top * 0.42f, top * 0.92f, g, g + 0.004f, leaf, Timber);
            Block(b, s.b, s.face, s.u + pu * 0.5f, u1 - pu, top * 0.42f, top * 0.92f, g, g + 0.004f, leaf, Timber);
            Block(b, s.b, s.face, u0 + pu, u1 - pu, top * 0.1f, top * 0.34f, g, g + 0.004f, leaf, Timber);
            // The fanlight, its frame, and the transom between.
            Panel(b, s.b, s.face, u0, u1, top, s.h, Real("#9fd4ff", Glass), Glass, g);
            Block(b, s.b, s.face, u0, u1, top - 0.4f, top + 0.6f, g, g + 0.008f, trim, Paint);
            // The surround, and the step.
            Block(b, s.b, s.face, u0 - e, u0, 0, s.h + 1.2f, 0, 0.009f, trim, Paint);
            Block(b, s.b, s.face, u1, u1 + e, 0, s.h + 1.2f, 0, 0.009f, trim, Paint);
            Block(b, s.b, s.face, u0 - e * 1.4f, u1 + e * 1.4f, s.h, s.h + 1.6f, 0, 0.012f, trim, Paint);
            Block(b, s.b, s.face, u0 - e * 2, u1 + e * 2, 0, 1.2f, g, 0.04f, stone, Concrete, 0.8f);
        }

        /* ---- roofs --------------------------------------------------------------- */

        /** What a pitched roof has besides its slopes: a ridge, gutters along the eaves, downpipes at the front corners, and on most houses a chimney. */
        static void GableDetail(Bm b, SolidRec s)
        {
            float e = s.over;
            float x = s.x - e, y = s.y - e, w = s.w + e * 2, d = s.d + e * 2, z = s.z, h = s.h;
            var roof = Real(s.fill, Tiles); var ridge = roof * 0.8f; ridge.a = 1;
            var gut = Real("#e6e9f6", Metal);
            float drop = 2.2f, gz = z - drop * 0.6f;
            bool alongI = s.axis == "x";
            // The ridge, end to end.
            if (alongI) Tube(b, W(x, y + d / 2, z + h + 0.3f), W(x + w, y + d / 2, z + h + 0.3f), 0.012f, ridge, Tiles, 8);
            else Tube(b, W(x + w / 2, y, z + h + 0.3f), W(x + w / 2, y + d, z + h + 0.3f), 0.012f, ridge, Tiles, 8);
            if (!OnWalls(s)) return;
            // Gutters along both eaves, and downpipes down from their front ends.
            float down = foot;
            if (alongI)
            {
                foreach (var jj in new[] { y - 0.012f, y + d + 0.012f })
                    Tube(b, W(x, jj, gz), W(x + w, jj, gz), 0.011f, gut, Metal, 8);
                foreach (var jj in new[] { s.y + 0.014f, s.y + s.d - 0.014f })
                {
                    var top = W(s.x + s.w - 0.03f, jj, gz); var bot = W(s.x + s.w + 0.012f, jj, down + 0.5f);
                    var mid = W(s.x + s.w + 0.012f, jj, gz - 3);
                    Tube(b, top, mid, 0.008f, gut, Metal, 8); Tube(b, mid, bot, 0.008f, gut, Metal, 8);
                }
            }
            else
            {
                foreach (var ii in new[] { x - 0.012f, x + w + 0.012f })
                    Tube(b, W(ii, y, gz), W(ii, y + d, gz), 0.011f, gut, Metal, 8);
                foreach (var ii in new[] { s.x + 0.014f, s.x + s.w - 0.014f })
                {
                    var top = W(ii, s.y + s.d - 0.03f, gz); var bot = W(ii, s.y + s.d + 0.012f, down + 0.5f);
                    var mid = W(ii, s.y + s.d + 0.012f, gz - 3);
                    Tube(b, top, mid, 0.008f, gut, Metal, 8); Tube(b, mid, bot, 0.008f, gut, Metal, 8);
                }
            }
            // A chimney, on a house (a roof over walls with a door in them): a brick stack astride the ridge near one end, a coping, and pots.
            if (s.w * s.d >= 0.18f && H(s.x, s.y, 7) < 0.7f && HasDoor(s))
            {
                float t = H(s.x, s.y, 8) < 0.5f ? 0.24f : 0.76f;
                float ci = alongI ? x + w * t : x + w / 2, cj = alongI ? y + d / 2 : y + d * t;
                float hw = 0.055f, hd = 0.045f;
                var brick = Real("#a49dcf", Brick);
                float zb = z + h * 0.45f, zt = z + h + 7;
                Slab(b, ci - hw, cj - hd, ci + hw, cj + hd, zb, zt, brick, Brick, 0.8f);
                Slab(b, ci - hw - 0.008f, cj - hd - 0.008f, ci + hw + 0.008f, cj + hd + 0.008f, zt, zt + 1.1f, Real("#d5d9ea", Concrete), Concrete);
                var pot = Real("#7d74b8", Concrete);
                foreach (var k in new[] { -1f, 1f })
                {
                    float pi = ci + (alongI ? k * hw * 0.5f : 0), pj = cj + (alongI ? 0 : k * hd * 0.5f);
                    Lathe(b, pi, pj, zt + 1.1f, new[] { (0f, 0.016f), (2.6f, 0.013f), (3.0f, 0.016f) }, _ => pot, Concrete, 12);
                }
            }
        }

        /** Whether the walls under a pitched roof have a door in them (a house, not a booth or a shed of screens). */
        static bool HasDoor(SolidRec g)
        {
            foreach (var kv in holes)
            {
                var p = kv.Key.Split(',');
                float x = float.Parse(p[0], System.Globalization.CultureInfo.InvariantCulture), y = float.Parse(p[1], System.Globalization.CultureInfo.InvariantCulture);
                float w = float.Parse(p[2], System.Globalization.CultureInfo.InvariantCulture), d = float.Parse(p[3], System.Globalization.CultureInfo.InvariantCulture);
                if (Overlap(x, w, g.x, g.w) * Overlap(y, d, g.y, g.d) < 0.3f * g.w * g.d) continue;
                foreach (var h in kv.Value) if (h.door) return true;
            }
            return false;
        }
        /** A pyramid roof's hips, rolled; a finial at the top. */
        static void PyramidDetail(Bm b, SolidRec s)
        {
            var col = Real(s.fill, Slate) * 0.82f; col.a = 1;
            var apex = W(s.x + s.w / 2, s.y + s.d / 2, s.z + s.h);
            foreach (var (ci, cj) in new[] { (s.x, s.y), (s.x + s.w, s.y), (s.x + s.w, s.y + s.d), (s.x, s.y + s.d) })
                Tube(b, W(ci, cj, s.z), apex, 0.011f, col, Slate, 8);
            Ball(b, apex + Vector3.up * 0.02f, 0.02f, -1, Real("#c9cde0", Metal), Metal);
        }
    }
}
