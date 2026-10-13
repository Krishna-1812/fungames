// What drives on the island's roads, modelled to scale with its people (a
// person is about 2 m, 16 of the site's pixels): a small car (4.2 m), a town
// bus (12 m), and a bicycle with its rider. Each faces +z when built (its
// front), and is turned to its facing like a person (Actors.cs).
//
// Car bodies are superellipsoids: a box with its edges and corners rounded,
// as pressed steel is; the glass is the island's glass (Building.shader).
using System.Collections.Generic;
using UnityEngine;

namespace Island
{
    public static partial class Buildings
    {
        /** A rounded box (a superellipsoid): r its half sizes, e how square (1 a ball, towards 0 a box). */
        static void Round(Bm b, Vector3 c, Vector3 r, float e, Color col, int mat, int lon = 24, int lat = 14, System.Func<Vector3, bool> keep = null)
        {
            float P(float x) => Mathf.Sign(x) * Mathf.Pow(Mathf.Abs(x), e);
            for (int y = 0; y < lat; y++)
            {
                float t0 = -Mathf.PI / 2 + Mathf.PI * y / lat, t1 = -Mathf.PI / 2 + Mathf.PI * (y + 1) / lat;
                for (int x = 0; x < lon; x++)
                {
                    float a0 = x * Mathf.PI * 2 / lon, a1 = (x + 1) * Mathf.PI * 2 / lon;
                    Vector3 D(float t, float a) => new Vector3(P(Mathf.Cos(t)) * P(Mathf.Sin(a)), P(Mathf.Sin(t)), P(Mathf.Cos(t)) * P(Mathf.Cos(a)));
                    if (keep != null && !keep(D((t0 + t1) / 2, (a0 + a1) / 2))) continue;
                    Vector3 Q(float t, float a) { var d = D(t, a); return c + new Vector3(d.x * r.x, d.y * r.y, d.z * r.z); }
                    b.Quad(Q(t0, a0), Q(t0, a1), Q(t1, a1), Q(t1, a0), col, mat);
                }
            }
        }

        /** A wheel: a tyre round an axle across the vehicle (along x), and a hub on its outer face. */
        static void Wheel(Bm b, Vector3 c, float r, float w, float side)
        {
            var tyre = Real("#25262c", Paint); var hub = Real("#c9cde0", Metal);
            var axis = Vector3.right;
            int n = 20;
            for (int k = 0; k < n; k++)
            {
                float a0 = k * Mathf.PI * 2 / n, a1 = (k + 1) * Mathf.PI * 2 / n;
                Vector3 R(float a) => new Vector3(0, Mathf.Cos(a), Mathf.Sin(a));
                b.Quad(c - axis * w / 2 + R(a0) * r, c - axis * w / 2 + R(a1) * r, c + axis * w / 2 + R(a1) * r, c + axis * w / 2 + R(a0) * r, tyre, Paint);
                var o = c + axis * side * w / 2;
                b.Tri(o, o + R(a0) * r, o + R(a1) * r, tyre, Paint);
                var oh = o + axis * side * 0.002f;
                b.Tri(oh, oh + R(a0) * r * 0.62f, oh + R(a1) * r * 0.62f, hub, Metal);
            }
        }

        static Bm Car(ActorRec a)
        {
            var b = new Bm();
            var body = Real("#" + a.shirt, Paint); var glass = Real("#9fb4cc", Glass); var trim = Real("#30333d", Paint);
            var lamp = Real("#f4f6fc", Paint); var tail = Real("#e0607a", Paint);
            // The body below the windows, and the cabin over it: glass all round, the roof in the body's colour.
            Round(b, new Vector3(0, 0.118f, 0), new Vector3(0.178f, 0.058f, 0.415f), 0.28f, body, Paint);
            Round(b, new Vector3(0, 0.2f, -0.035f), new Vector3(0.156f, 0.058f, 0.235f), 0.34f, glass, Glass, 24, 14, d => d.y < 0.86f);
            Round(b, new Vector3(0, 0.256f, -0.05f), new Vector3(0.142f, 0.008f, 0.172f), 0.22f, body, Paint);
            // Pillars at the corners of the cabin, holding the roof.
            foreach (var (x, z) in new[] { (-0.145f, 0.17f), (0.145f, 0.17f), (-0.145f, -0.235f), (0.145f, -0.235f) })
                Tube(b, new Vector3(x, 0.165f, z), new Vector3(x * 0.95f, 0.254f, z * 0.84f), 0.008f, body, Paint, 6);
            // Bumpers, lights, mirrors.
            Round(b, new Vector3(0, 0.078f, 0.405f), new Vector3(0.17f, 0.022f, 0.022f), 0.35f, trim, Paint, 16, 8);
            Round(b, new Vector3(0, 0.078f, -0.405f), new Vector3(0.17f, 0.022f, 0.022f), 0.35f, trim, Paint, 16, 8);
            foreach (var s in new[] { -1f, 1f })
            {
                Round(b, new Vector3(s * 0.118f, 0.138f, 0.412f), new Vector3(0.036f, 0.016f, 0.008f), 0.5f, lamp, Paint, 10, 6);
                Round(b, new Vector3(s * 0.13f, 0.142f, -0.413f), new Vector3(0.032f, 0.016f, 0.007f), 0.5f, tail, Paint, 10, 6);
                Round(b, new Vector3(s * 0.188f, 0.185f, 0.13f), new Vector3(0.016f, 0.012f, 0.008f), 0.5f, body, Paint, 8, 6);
            }
            // The wheels, under their arches.
            foreach (var z in new[] { 0.265f, -0.265f }) foreach (var s in new[] { -1f, 1f }) Wheel(b, new Vector3(s * 0.155f, 0.064f, z), 0.064f, 0.05f, s);
            return b;
        }

        static Bm Bus(ActorRec a)
        {
            var b = new Bm();
            var body = Real("#" + a.shirt, Paint); var glass = Real("#8ea4bf", Glass); var roof = Real("#e6e9f6", Paint); var trim = Real("#30333d", Paint);
            Round(b, new Vector3(0, 0.3f, 0), new Vector3(0.25f, 0.24f, 1.2f), 0.14f, body, Paint, 28, 16);
            // A band of windows down both sides and across the front, the windscreen deeper.
            Round(b, new Vector3(0, 0.42f, -0.02f), new Vector3(0.254f, 0.075f, 1.16f), 0.12f, glass, Glass, 28, 10, d => Mathf.Abs(d.y) < 0.9f);
            Round(b, new Vector3(0, 0.36f, 1.15f), new Vector3(0.22f, 0.12f, 0.06f), 0.2f, glass, Glass, 16, 10, d => d.z > 0);
            Round(b, new Vector3(0, 0.548f, 0), new Vector3(0.24f, 0.012f, 1.17f), 0.2f, roof, Paint, 20, 6);
            // Window posts, a door, bumpers, the destination sign, lights.
            for (int k = -5; k <= 5; k++) foreach (var s in new[] { -1f, 1f })
                Tube(b, new Vector3(s * 0.257f, 0.35f, k * 0.2f), new Vector3(s * 0.257f, 0.49f, k * 0.2f), 0.008f, body, Paint, 5);
            Round(b, new Vector3(0.252f, 0.28f, 0.82f), new Vector3(0.006f, 0.2f, 0.11f), 0.2f, glass, Glass, 8, 8);
            Round(b, new Vector3(0, 0.08f, 1.205f), new Vector3(0.24f, 0.028f, 0.02f), 0.3f, trim, Paint, 14, 6);
            Round(b, new Vector3(0, 0.08f, -1.205f), new Vector3(0.24f, 0.028f, 0.02f), 0.3f, trim, Paint, 14, 6);
            Round(b, new Vector3(0, 0.505f, 1.205f), new Vector3(0.16f, 0.022f, 0.006f), 0.3f, Real("#2c355e", Paint), Paint, 10, 6);
            foreach (var s in new[] { -1f, 1f }) Round(b, new Vector3(s * 0.19f, 0.14f, 1.208f), new Vector3(0.03f, 0.016f, 0.006f), 0.5f, Real("#f4f6fc", Paint), Paint, 8, 6);
            foreach (var z in new[] { 0.78f, -0.72f }) foreach (var s in new[] { -1f, 1f }) Wheel(b, new Vector3(s * 0.215f, 0.09f, z), 0.09f, 0.07f, s);
            return b;
        }

        static Bm Bike(ActorRec a)
        {
            var b = new Bm();
            var frame = Real("#" + a.shirt, Paint); var dark = Real("#25262c", Paint); var steel = Real("#c9cde0", Metal);
            float r = 0.068f, zb = -0.11f, zf = 0.12f;
            // The wheels: tyres round the rims, spokes.
            foreach (var z in new[] { zb, zf })
            {
                var c = new Vector3(0, r, z);
                Hoop(b, c, Vector3.forward, Vector3.up, r, 0.0065f, dark, Paint, 28);
                for (int k = 0; k < 8; k++) { float t = k * Mathf.PI / 4; Tube(b, c, c + (Vector3.forward * Mathf.Cos(t) + Vector3.up * Mathf.Sin(t)) * r, 0.0014f, steel, Metal, 3); }
            }
            // The frame: a diamond, the fork, the seat post and saddle, the bars.
            var bb = new Vector3(0, r * 0.95f, -0.005f); var seat = new Vector3(0, 0.155f, -0.045f); var head = new Vector3(0, 0.16f, 0.085f);
            foreach (var (p, q) in new[] { (bb, seat), (bb, head), (seat, head), (bb, new Vector3(0, r, zb)), (seat, new Vector3(0, r, zb)), (head, new Vector3(0, r, zf)) })
                Tube(b, p, q, 0.0055f, frame, Paint, 6);
            Round(b, seat + new Vector3(0, 0.012f, -0.005f), new Vector3(0.016f, 0.008f, 0.03f), 0.5f, dark, Paint, 10, 6);
            Tube(b, head, head + new Vector3(0, 0.025f, -0.01f), 0.005f, steel, Metal, 6);
            Tube(b, head + new Vector3(-0.045f, 0.025f, -0.01f), head + new Vector3(0.045f, 0.025f, -0.01f), 0.0045f, dark, Paint, 6);
            // The rider, sitting and pedalling, in the island's walkers' clothes.
            var rider = Person(new ActorRec { name = a.name, kind = "person", shirt = "4fe3c1", skin = "e8c4a8", hat = "0", v = a.v, pose = "cycle", facing = "se", frame = 0 });
            rider.Apply(Matrix4x4.Translate(new Vector3(0, seat.y + 0.018f - PersonHeight * 0.5f, seat.z - 0.01f)));
            b.Append(rider);
            return b;
        }

        /** Whatever an actor is, built at the origin facing +z (people turn themselves). */
        static Bm Build(ActorRec a)
        {
            switch (a.kind)
            {
                case "person": return Person(a);
                case "sheep": case "deer": case "duck": case "crab": case "gull": case "pigeon": case "dolphin": case "whale": case "bfly": case "cloud": case "balloon": case "plane": case "dog": case "robot": case "globe": case "pod": return Creature(a);
                case "car": case "bus": case "bike": case "sail": case "ferry": case "fishing": case "speed": case "row":
                    var b = a.kind switch { "car" => Car(a), "bus" => Bus(a), "bike" => Bike(a), "sail" => Sailboat(a), "ferry" => Ferry(a), "fishing" => Fishing(a), "speed" => Speedboat(a), _ => Rowboat(a) };
                    b.Apply(Matrix4x4.Rotate(Quaternion.Euler(0, Yaw(a.facing), 0)));
                    return b;
            }
            return null;
        }
    }
}
