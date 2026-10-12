// The island's people, modelled: a body in proportion (eight heads tall),
// jointed at the hips, knees, shoulders and elbows, dressed (a shirt, trousers
// or shorts or a skirt, shoes, now and then a hat), with hair; posed (standing,
// waving, looking up, or one of the eight frames of a stride), turned to face
// the way they go, and rendered at the foot (IslandBuild.ActorShots) for the
// site to draw where they stand or walk.
//
// Everyone is a spec the site asks for (lib/island/actors.ts): the shirt's
// colour, the skin's, a hat's (or none), and a number that picks the rest
// (build, hair, what they wear below), so the same person always looks the
// same. A person stands 16 of the site's pixels tall (about 2 m by the site's
// doors).
using System;
using System.Collections.Generic;
using UnityEngine;

namespace Island
{
    [Serializable] public class ActorRec { public string name, kind, shirt, skin, hat, pose, facing; public int v, frame; }

    public static partial class Buildings
    {
        /** A person's height, in world units. */
        public const float PersonHeight = 16f / IslandBuild.PxPerHeight;
        public const int WalkFrames = 8;

        static readonly string[] Hair = { "#1d1a1f", "#2e2420", "#4a3628", "#6b4a33", "#8f8f96", "#d6d6dc" };
        static readonly string[] Bottoms = { "#2f3a56", "#22252e", "#4b5266", "#6f7891", "#c3c8de", "#3d4a3f", "#3a3f63", "#5c5470" };
        static readonly string[] ShoeCols = { "#1b1c22", "#f0f0f4", "#3a3030", "#2c355e" };

        /** The facings: which way someone walking along +i, +j, -i, -j looks (the site's se, sw, nw, ne on screen). */
        static float Yaw(string facing) => facing switch { "se" => 0, "s" => 45, "sw" => 90, "w" => 135, "nw" => 180, "n" => -135, "ne" => -90, "e" => -45, _ => 0 };

        /** Something posed, in its own frame: y up, z forward, x to its left. */
        class Rig
        {
            public readonly Bm b;
            public Rig(Bm b) { this.b = b; }
            /** A tapering limb from a to c, radius ra to rc, capped round at both ends. */
            public void Limb(Vector3 a, Vector3 c, float ra, float rc, Color col, int mat, int sides = 12)
            {
                var ax = c - a; float len = ax.magnitude; if (len < 1e-5f) return; ax /= len;
                var u = Vector3.Cross(ax, Mathf.Abs(ax.y) < 0.9f ? Vector3.up : Vector3.right).normalized;
                var v = Vector3.Cross(ax, u);
                for (int k = 0; k < sides; k++)
                {
                    float a0 = k * Mathf.PI * 2 / sides, a1 = (k + 1) * Mathf.PI * 2 / sides;
                    Vector3 o0 = u * Mathf.Cos(a0) + v * Mathf.Sin(a0), o1 = u * Mathf.Cos(a1) + v * Mathf.Sin(a1);
                    b.Quad(a + o0 * ra, a + o1 * ra, c + o1 * rc, c + o0 * rc, col, mat);
                }
                Blob(a, new Vector3(ra, ra, ra), col, mat, 10, 6);
                Blob(c, new Vector3(rc, rc, rc), col, mat, 10, 6);
            }
            /** An ellipsoid, or the part of it a test keeps (on its unit directions). */
            public void Blob(Vector3 c, Vector3 r, Color col, int mat, int lon = 16, int lat = 10, Func<Vector3, bool> keep = null, Quaternion? rot = null)
            {
                var q = rot ?? Quaternion.identity;
                for (int y = 0; y < lat; y++)
                {
                    float t0 = -Mathf.PI / 2 + Mathf.PI * y / lat, t1 = -Mathf.PI / 2 + Mathf.PI * (y + 1) / lat;
                    for (int x = 0; x < lon; x++)
                    {
                        float a0 = x * Mathf.PI * 2 / lon, a1 = (x + 1) * Mathf.PI * 2 / lon;
                        Vector3 D(float t, float a) => new Vector3(Mathf.Cos(t) * Mathf.Sin(a), Mathf.Sin(t), Mathf.Cos(t) * Mathf.Cos(a));
                        if (keep != null && !keep(D((t0 + t1) / 2, (a0 + a1) / 2))) continue;
                        Vector3 P(float t, float a) { var d = D(t, a); return c + q * new Vector3(d.x * r.x, d.y * r.y, d.z * r.z); }
                        b.Quad(P(t0, a0), P(t0, a1), P(t1, a1), P(t1, a0), col, mat);
                    }
                }
            }
            /** A body of elliptical rings up its height: (y, half-width, half-depth, forward shift), each band in its colour. */
            public void Loft((float y, float rx, float rz, float dz)[] rings, Func<int, (Color, int)> band, int sides = 16)
            {
                for (int q = 0; q + 1 < rings.Length; q++)
                {
                    var (col, mat) = band(q);
                    for (int k = 0; k < sides; k++)
                    {
                        float a0 = k * Mathf.PI * 2 / sides, a1 = (k + 1) * Mathf.PI * 2 / sides;
                        Vector3 P(int i, float a) => new Vector3(Mathf.Sin(a) * rings[i].rx, rings[i].y, Mathf.Cos(a) * rings[i].rz + rings[i].dz);
                        b.Quad(P(q, a0), P(q, a1), P(q + 1, a1), P(q + 1, a0), col, mat);
                    }
                }
                // Closed at the bottom.
                var r0 = rings[0];
                var c0 = new Vector3(0, r0.y, r0.dz);
                for (int k = 0; k < sides; k++)
                {
                    float a0 = k * Mathf.PI * 2 / sides, a1 = (k + 1) * Mathf.PI * 2 / sides;
                    b.Tri(c0, new Vector3(Mathf.Sin(a1) * r0.rx, r0.y, Mathf.Cos(a1) * r0.rz + r0.dz), new Vector3(Mathf.Sin(a0) * r0.rx, r0.y, Mathf.Cos(a0) * r0.rz + r0.dz), band(0).Item1, band(0).Item2);
                }
            }
        }

        static float Hash01(int v, int salt) { float h = Mathf.Sin(v * 91.37f + salt * 17.13f) * 43758.5453f; return h - Mathf.Floor(h); }

        /**
         * A person: their spec (shirt, skin, hat, the number that picks the
         * rest), posed and turned. Returns the mesh's builder, in world units,
         * with the foot at the origin.
         */
        static Bm Person(ActorRec a)
        {
            var b = new Bm();
            var r = new Rig(b);
            int v = a.v;
            bool fem = Hash01(v, 1) < 0.5f;
            float build = Mathf.Lerp(0.92f, 1.1f, Hash01(v, 2));
            var skin = Real("#" + a.skin, Paint);
            var shirt = Real("#" + a.shirt, Cloth);
            var lowCol = Real(Bottoms[(int)(Hash01(v, 3) * Bottoms.Length) % Bottoms.Length], Cloth);
            // Mostly dark hair; grey and white now and then.
            var hair = Real(Hair[Mathf.Min(Hair.Length - 1, (int)(Mathf.Pow(Hash01(v, 4), 1.8f) * Hair.Length))], Paint);
            var shoe = Real(ShoeCols[(int)(Hash01(v, 5) * ShoeCols.Length) % ShoeCols.Length], Paint);
            // Below the waist: trousers, shorts, or a skirt.
            int lower = fem ? (Hash01(v, 6) < 0.45f ? 2 : Hash01(v, 6) < 0.7f ? 1 : 0) : (Hash01(v, 6) < 0.25f ? 1 : 0);
            bool longSleeves = Hash01(v, 7) < 0.4f;
            int hairStyle = fem ? (Hash01(v, 8) < 0.6f ? 2 : Hash01(v, 8) < 0.85f ? 3 : 1) : (Hash01(v, 8) < 0.12f ? 0 : 1);

            // The pose: hips, knees, shoulders, elbows (degrees; forward positive), the head's tilt, and the body's rise.
            float hipL = 0, hipR = 0, kneeL = 4, kneeR = 4, armL = 4, armR = 4, elbL = 10, elbR = 10, headTilt = 0, rise = 0, lean = 0;
            bool waveR = false;
            if (a.pose == "walk")
            {
                float ph = a.frame * Mathf.PI * 2 / WalkFrames;
                // A walk: each thigh swings about 20° either way; the knee folds most as the leg swings through
                // (about 55°) and stays nearly straight while it bears the weight; the arms swing against the legs.
                hipL = Mathf.Sin(ph) * 21; hipR = -hipL;
                float swingL = Mathf.Max(0, Mathf.Sin(ph + 1.4f)), swingR = Mathf.Max(0, Mathf.Sin(ph + 1.4f + Mathf.PI));
                kneeL = 5 + Mathf.Pow(swingL, 1.4f) * 52; kneeR = 5 + Mathf.Pow(swingR, 1.4f) * 52;
                armL = -hipL * 0.85f; armR = -hipR * 0.85f; elbL = 14 + Mathf.Max(0, armL) * 0.9f; elbR = 14 + Mathf.Max(0, armR) * 0.9f;
                // Highest as the legs pass each other.
                rise = Mathf.Abs(Mathf.Cos(ph)) * 0.01f; lean = 3;
            }
            else if (a.pose == "wave" || a.pose == "wave1") { waveR = true; }
            else if (a.pose == "look") { headTilt = -24; armL = 2; armR = 2; }
            else if (a.pose == "cycle") { hipL = 72; kneeL = 108; hipR = 46; kneeR = 64; armL = armR = 52; elbL = elbR = 12; lean = 9; }
            else if (a.pose == "sit") { hipL = hipR = 88; kneeL = kneeR = 86; armL = armR = 22; elbL = elbR = 40; }
            // Sitting on the ground: legs out in front, a little bent, leaning back on the hands.
            else if (a.pose == "ground") { hipL = hipR = 84; kneeL = 22; kneeR = 34; armL = armR = -32; elbL = elbR = 6; rise = -0.43f; lean = -10; }
            // Flying a kite: one arm up, holding the line.
            else if (a.pose == "kite") { waveR = true; headTilt = -14; }

            float H = 1;   // built a unit tall, scaled at the end
            float sx = (fem ? 0.93f : 1) * build, hipW = fem ? 1.08f : 0.95f;
            float baseY = rise;
            Vector3 J(float x, float y, float z) => new Vector3(x * sx, y * H + baseY, z * sx);

            // Legs: thigh and shin, then the foot.
            float hipY = 0.5f, thigh = 0.245f, shin = 0.235f;
            void Leg(float side, float hipDeg, float kneeDeg)
            {
                var hip = J(side * 0.047f * hipW, hipY, 0);
                float t1 = hipDeg * Mathf.Deg2Rad, t2 = (hipDeg - kneeDeg) * Mathf.Deg2Rad;
                var knee = hip + new Vector3(0, -Mathf.Cos(t1), Mathf.Sin(t1)) * thigh;
                var ankle = knee + new Vector3(0, -Mathf.Cos(t2), Mathf.Sin(t2)) * shin;
                var thighCol = lower == 2 ? skin : lowCol; var shinCol = lower == 0 ? lowCol : skin;
                r.Limb(hip, knee, 0.042f * sx * (fem ? 1.04f : 1), 0.03f * sx, thighCol, lower == 2 ? Paint : Cloth);
                r.Limb(knee, ankle, 0.029f * sx, 0.02f * sx, shinCol, lower == 0 ? Cloth : Paint);
                // The shoe: along the ground forward from the ankle, its sole level.
                var foot = ankle + new Vector3(0, -0.012f, 0.045f);
                r.Blob(foot, new Vector3(0.026f, 0.022f, 0.062f) * sx, shoe, Paint, 12, 8);
            }
            Leg(1, hipL, kneeL); Leg(-1, hipR, kneeR);

            // The body: hips and trunk in rings, a skirt over the hips if they wear one.
            float w = fem ? 0.92f : 1f, chest = fem ? 0.95f : 1.05f;
            var trunk = new[]
            {
                (hipY - 0.04f, 0.075f * hipW, 0.05f, 0f),
                (hipY + 0.03f, 0.082f * hipW, 0.054f, 0f),
                (0.58f, 0.074f * w, 0.05f, 0f),
                (0.64f, 0.068f * w, 0.048f, 0.003f),
                (0.71f, 0.08f * chest, 0.055f, 0.008f),
                (0.77f, 0.088f * chest, 0.058f, 0.006f),
                (0.81f, 0.086f, 0.052f, 0f),
                (0.835f, 0.05f, 0.04f, 0f),
            };
            for (int k = 0; k < trunk.Length; k++) trunk[k] = (trunk[k].Item1 * H + baseY, trunk[k].Item2 * sx, trunk[k].Item3 * sx, trunk[k].Item4 + lean * 0.0008f * (trunk[k].Item1 - hipY) * 10);
            r.Loft(trunk, q => q < 2 ? (lowCol, Cloth) : (shirt, Cloth));
            if (lower == 2)
                r.Loft(new[] { (0.6f * H + baseY, 0.075f * sx, 0.052f * sx, 0f), (0.5f * H + baseY, 0.098f * sx, 0.075f * sx, 0f), (0.33f * H + baseY, 0.13f * sx, 0.105f * sx, 0f) }, _ => (lowCol, Cloth));

            // Arms: from the shoulder, out a little and down; upper arm in the sleeve, forearm and hand.
            void Arm(float side, float deg, float elbow, bool wave)
            {
                var sh = J(side * 0.098f, 0.785f, 0.002f);
                Vector3 elb, wr;
                if (a.pose == "balance")
                {
                    // Out to the side, a little forward, holding the pole.
                    elb = sh + new Vector3(side * 0.16f, -0.03f, 0.05f);
                    wr = elb + new Vector3(side * 0.12f, 0.0f, 0.07f);
                }
                else if (wave)
                {
                    elb = sh + new Vector3(side * 0.11f, 0.12f, 0.03f).normalized * 0.165f;
                    wr = elb + new Vector3(side * 0.02f, 0.155f, 0.02f);
                }
                else
                {
                    float t1 = deg * Mathf.Deg2Rad, t2 = (deg + elbow) * Mathf.Deg2Rad;
                    elb = sh + new Vector3(side * 0.018f, -Mathf.Cos(t1), Mathf.Sin(t1)).normalized * 0.165f;
                    wr = elb + new Vector3(side * 0.006f, -Mathf.Cos(t2), Mathf.Sin(t2)).normalized * 0.15f;
                }
                r.Blob(sh, new Vector3(0.028f, 0.026f, 0.029f) * sx, shirt, Cloth, 10, 6);
                r.Limb(sh, elb, 0.027f * sx, 0.022f * sx, shirt, Cloth, 10);
                r.Limb(elb, wr, 0.021f * sx, 0.017f * sx, longSleeves ? shirt : skin, longSleeves ? Cloth : Paint, 10);
                r.Blob(wr + (wr - elb).normalized * 0.022f, new Vector3(0.017f, 0.026f, 0.014f) * sx, skin, Paint, 10, 6);
            }
            Arm(1, armL, elbL, false); Arm(-1, armR, elbR, waveR && (a.pose == "wave" || a.pose == "kite"));
            if (waveR && a.pose == "wave1") { }

            // Neck and head; the head tilted back to look up.
            var neckA = J(0, 0.82f, 0); var neckB = J(0, 0.875f, 0.004f);
            r.Limb(neckA, neckB, 0.026f * sx, 0.024f * sx, skin, Paint, 10);
            var hc = J(0, 0.932f, 0.006f);
            var tilt = Quaternion.Euler(headTilt, 0, 0);
            r.Blob(hc, new Vector3(0.058f, 0.071f, 0.064f) * sx, skin, Paint, 16, 10, null, tilt);
            // Ears and nose: small, but they catch the light and read as a face.
            r.Blob(hc + tilt * new Vector3(0, -0.006f, 0.064f) * sx, new Vector3(0.008f, 0.013f, 0.01f), skin, Paint, 6, 4);
            foreach (var s2 in new[] { -1f, 1f }) r.Blob(hc + tilt * new Vector3(s2 * 0.058f, 0, 0) * sx, new Vector3(0.008f, 0.016f, 0.012f), skin, Paint, 6, 4);
            // Hair: a cap over the crown and back (short), longer down the back, or tied up.
            if (hairStyle > 0)
            {
                bool Cap(Vector3 d) => d.y > -0.1f || d.z < -0.35f;
                r.Blob(hc + tilt * new Vector3(0, 0.008f, -0.006f) * sx, new Vector3(0.063f, 0.072f, 0.07f) * sx, hair, Paint, 16, 10, d => Cap(d) && !(d.z > 0.55f && d.y < 0.45f), tilt);
                if (hairStyle == 2) r.Blob(hc + tilt * new Vector3(0, -0.07f, -0.045f) * sx, new Vector3(0.062f, 0.1f, 0.035f) * sx, hair, Paint, 12, 8, null, tilt);
                if (hairStyle == 3) r.Blob(hc + tilt * new Vector3(0, 0.05f, -0.06f) * sx, new Vector3(0.032f, 0.03f, 0.03f) * sx, hair, Paint, 10, 6, null, tilt);
            }
            // A hat: a cap with a peak, or a brimmed sun hat.
            if (!string.IsNullOrEmpty(a.hat) && a.hat != "0")
            {
                var hatCol = Real("#" + a.hat.TrimStart('#'), Cloth);
                bool sunhat = Hash01(v, 9) < 0.4f;
                var top = hc + tilt * new Vector3(0, 0.03f, -0.004f) * sx;
                r.Blob(top, new Vector3(0.066f, 0.05f, 0.07f) * sx, hatCol, Cloth, 16, 8, d => d.y > -0.05f, tilt);
                if (sunhat) r.Blob(top + tilt * new Vector3(0, -0.002f, 0) * sx, new Vector3(0.12f, 0.006f, 0.12f) * sx, hatCol, Cloth, 20, 4, null, tilt);
                else r.Blob(top + tilt * new Vector3(0, -0.004f, 0.06f) * sx, new Vector3(0.05f, 0.005f, 0.05f) * sx, hatCol, Cloth, 14, 4, d => d.z > -0.2f, tilt);
            }

            // To the world: a person's height, turned to their facing.
            float s = PersonHeight;
            var m = Matrix4x4.TRS(Vector3.zero, Quaternion.Euler(0, Yaw(a.facing), 0), Vector3.one * s);
            b.Apply(m);
            return b;
        }

        /** A person as an object at the origin, in the island's material. */
        public static GameObject Actor(ActorRec a)
        {
            Bm b = Build(a);
            if (b == null) return null;
            var go = new GameObject(a.name);
            go.AddComponent<MeshFilter>().sharedMesh = b.Mesh(a.name);
            var mr = go.AddComponent<MeshRenderer>();
            mr.sharedMaterial = Mat;
            mr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.On;
            return go;
        }

        /** A moving boat's wake, flat on the water and turned to its heading, in white: a mask for the site to lay under it. */
        public static GameObject ActorWake(ActorRec a, Material flat)
        {
            if (a.kind != "sail" && a.kind != "ferry" && a.kind != "speed") return null;
            var b = WakeOf(a);
            b.Apply(Matrix4x4.Rotate(Quaternion.Euler(0, Yaw(a.facing), 0)));
            for (int i = 0; i < b.c.Count; i++) b.c[i] = Color.white;
            var go = new GameObject(a.name + "-wake");
            go.AddComponent<MeshFilter>().sharedMesh = b.Mesh(a.name + "-wake");
            var mr = go.AddComponent<MeshRenderer>();
            mr.sharedMaterial = flat;
            mr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            return go;
        }

        /** The same person flattened onto the ground along the sun: its shadow, for the site to lay under it. */
        public static GameObject ActorShadow(ActorRec a, Vector3 toSun, Material flat)
        {
            Bm b = Build(a);
            if (b == null) return null;
            b.Flatten(toSun);
            var go = new GameObject(a.name + "-shadow");
            go.AddComponent<MeshFilter>().sharedMesh = b.Mesh(a.name + "-shadow");
            var mr = go.AddComponent<MeshRenderer>();
            mr.sharedMaterial = flat;
            mr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            return go;
        }
    }
}
