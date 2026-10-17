// The island's animals, modelled to the people's scale (a person is about
// 2 m): sheep (1.3 m) grazing or looking up, deer (1.7 m) the same, ducks on
// the pond, crabs on the beach, gulls standing or on the wing (wings up or
// down), dolphins, a whale's back, butterflies and pigeons. The smallest are
// made a little larger than life, so they still read at the island's size.
// Each faces +z when built and is turned to its facing like everything else.
using UnityEngine;

namespace Island
{
    public static partial class Buildings
    {
        static Bm Creature(ActorRec a)
        {
            var b = new Bm();
            var r = new Rig(b);
            float R01(int k) => Hash01(a.v * 31 + k, 77);
            switch (a.kind)
            {
                case "sheep":
                {
                    var wool = Real("#eceaf0", Cloth); var face = Real("#2a2a33", Paint);
                    // The fleece: tufts over an egg of a body.
                    var c = new Vector3(0, 0.125f, 0);
                    r.Blob(c, new Vector3(0.075f, 0.068f, 0.12f), wool, Cloth, 16, 10);
                    for (int k = 0; k < 26; k++)
                    {
                        float t = R01(k) * Mathf.PI * 2, u = R01(k + 40) * 1.6f - 0.6f;
                        var d = new Vector3(Mathf.Cos(t) * Mathf.Cos(u), Mathf.Sin(u), Mathf.Sin(t) * Mathf.Cos(u) * 1.5f).normalized;
                        r.Blob(c + Vector3.Scale(d, new Vector3(0.068f, 0.062f, 0.11f)), Vector3.one * (0.026f + R01(k + 80) * 0.012f), wool, Cloth, 8, 6);
                    }
                    foreach (var (x, z) in new[] { (-0.04f, 0.075f), (0.04f, 0.075f), (-0.04f, -0.075f), (0.04f, -0.075f) })
                        r.Limb(new Vector3(x, 0.09f, z), new Vector3(x, 0.004f, z), 0.011f, 0.009f, face, Paint, 8);
                    bool up = a.pose == "up";
                    var neck = new Vector3(0, up ? 0.17f : 0.1f, 0.12f); var head = new Vector3(0, up ? 0.2f : 0.05f, up ? 0.17f : 0.19f);
                    r.Limb(neck, head, 0.03f, 0.024f, wool, Cloth, 10);
                    r.Blob(head + new Vector3(0, -0.005f, 0.02f), new Vector3(0.022f, 0.026f, 0.04f), face, Paint, 12, 8, null, Quaternion.Euler(up ? -20 : 50, 0, 0));
                    foreach (var s in new[] { -1f, 1f }) r.Blob(head + new Vector3(s * 0.03f, 0.012f, -0.005f), new Vector3(0.018f, 0.007f, 0.01f), face, Paint, 8, 4);
                    break;
                }
                case "deer":
                {
                    var coat = Real("#8e817f", Paint); var pale = Real("#e7e3e3", Paint); var dark = Real("#3a3436", Paint); var horn = Real("#d8d0c8", Paint);
                    r.Blob(new Vector3(0, 0.205f, 0), new Vector3(0.068f, 0.078f, 0.155f), coat, Paint, 16, 10);
                    r.Blob(new Vector3(0, 0.22f, 0.11f), new Vector3(0.058f, 0.07f, 0.06f), coat, Paint, 12, 8);
                    r.Blob(new Vector3(0, 0.205f, -0.13f), new Vector3(0.045f, 0.05f, 0.03f), pale, Paint, 10, 6);
                    foreach (var (x, z) in new[] { (-0.035f, 0.11f), (0.035f, 0.1f), (-0.035f, -0.11f), (0.035f, -0.1f) })
                    {
                        r.Limb(new Vector3(x, 0.17f, z), new Vector3(x, 0.08f, z + (z > 0 ? 0.01f : -0.012f)), 0.016f, 0.01f, coat, Paint, 8);
                        r.Limb(new Vector3(x, 0.08f, z + (z > 0 ? 0.01f : -0.012f)), new Vector3(x, 0.004f, z), 0.009f, 0.007f, dark, Paint, 6);
                    }
                    bool up = a.pose == "up";
                    var neck0 = new Vector3(0, 0.25f, 0.13f); var head = up ? new Vector3(0, 0.37f, 0.21f) : new Vector3(0, 0.07f, 0.25f);
                    r.Limb(neck0, head, 0.042f, 0.02f, coat, Paint, 10);
                    var rot = Quaternion.Euler(up ? -10 : 60, 0, 0);
                    r.Blob(head + rot * new Vector3(0, 0, 0.03f), new Vector3(0.022f, 0.026f, 0.05f), coat, Paint, 12, 8, null, rot);
                    foreach (var s in new[] { -1f, 1f })
                    {
                        r.Blob(head + rot * new Vector3(s * 0.028f, 0.02f, -0.005f), new Vector3(0.016f, 0.008f, 0.01f), coat, Paint, 8, 4);
                        // Antlers: a beam back and up, two tines forward.
                        var base0 = head + rot * new Vector3(s * 0.012f, 0.026f, 0.005f);
                        var beam = base0 + new Vector3(s * 0.03f, 0.07f, -0.02f);
                        r.Limb(base0, beam, 0.004f, 0.003f, horn, Paint, 5);
                        r.Limb(base0 + (beam - base0) * 0.45f, base0 + (beam - base0) * 0.45f + new Vector3(s * 0.008f, 0.025f, 0.02f), 0.003f, 0.002f, horn, Paint, 4);
                        r.Limb(beam, beam + new Vector3(s * 0.01f, 0.018f, 0.018f), 0.003f, 0.002f, horn, Paint, 4);
                    }
                    break;
                }
                case "duck":
                {
                    bool white = a.shirt == "ffffff";
                    var body = white ? Real("#f4f5f8", Paint) : Real("#9ea2ad", Paint); var head = white ? body : Real("#1f6b55", Paint); var bill = Real("#d9cf9a", Paint);
                    if (!white)
                    {
                        // A drake: the dark chest under a white collar.
                        r.Blob(new Vector3(0, 0.02f, 0.05f), new Vector3(0.042f, 0.03f, 0.04f), Real("#4a3f4a", Paint), Paint, 10, 8, d => d.y > -0.2f);
                        r.Blob(new Vector3(0, 0.048f, 0.058f), new Vector3(0.02f, 0.006f, 0.02f), Real("#f4f5f8", Paint), Paint, 10, 4);
                    }
                    // Afloat: only what is above the water.
                    r.Blob(new Vector3(0, 0.0f, 0), new Vector3(0.05f, 0.04f, 0.085f), body, Paint, 14, 10, d => d.y > -0.15f);
                    r.Blob(new Vector3(0, 0.035f, -0.07f), new Vector3(0.03f, 0.02f, 0.035f), body, Paint, 10, 6, null, Quaternion.Euler(-30, 0, 0));
                    var h = new Vector3(0, 0.075f, 0.06f);
                    r.Limb(new Vector3(0, 0.03f, 0.05f), h, 0.018f, 0.016f, head, Paint, 8);
                    r.Blob(h, new Vector3(0.022f, 0.024f, 0.028f), head, Paint, 12, 8);
                    r.Blob(h + new Vector3(0, -0.006f, 0.032f), new Vector3(0.011f, 0.006f, 0.018f), bill, Paint, 8, 6);
                    break;
                }
                case "crab":
                {
                    var shell = Real("#" + a.shirt, Paint); var dark = shell * 0.7f; dark.a = 1;
                    r.Blob(new Vector3(0, 0.018f, 0), new Vector3(0.045f, 0.016f, 0.034f), shell, Paint, 14, 8, d => d.y > -0.3f);
                    foreach (var s in new[] { -1f, 1f })
                    {
                        for (int k = 0; k < 3; k++) { float z = -0.018f + k * 0.016f; var hip = new Vector3(s * 0.04f, 0.016f, z); var knee = hip + new Vector3(s * 0.02f, 0.012f, 0); r.Limb(hip, knee, 0.004f, 0.0035f, dark, Paint, 5); r.Limb(knee, knee + new Vector3(s * 0.012f, -0.028f, 0.002f), 0.0035f, 0.002f, dark, Paint, 5); }
                        var arm = new Vector3(s * 0.03f, 0.022f, 0.03f); var claw = arm + new Vector3(s * 0.022f, 0.012f, 0.03f);
                        r.Limb(arm, claw, 0.005f, 0.006f, shell, Paint, 6);
                        r.Blob(claw, new Vector3(0.012f, 0.009f, 0.016f), shell, Paint, 8, 6);
                        r.Limb(new Vector3(s * 0.012f, 0.03f, 0.03f), new Vector3(s * 0.014f, 0.045f, 0.034f), 0.002f, 0.002f, dark, Paint, 4);
                    }
                    break;
                }
                case "gull":
                {
                    var white = Real("#f4f5f8", Paint); var grey = Real("#9aa3b8", Paint); var bill = Real("#e0c86a", Paint); var leg = Real("#d99a86", Paint);
                    bool fly = a.pose == "up" || a.pose == "down";
                    var y0 = fly ? 0 : 0.06f;
                    r.Blob(new Vector3(0, y0 + 0.03f, 0), new Vector3(0.028f, 0.026f, 0.07f), white, Paint, 12, 8);
                    r.Blob(new Vector3(0, y0 + 0.055f, 0.06f), new Vector3(0.02f, 0.02f, 0.024f), white, Paint, 10, 6);
                    r.Limb(new Vector3(0, y0 + 0.053f, 0.08f), new Vector3(0, y0 + 0.048f, 0.105f), 0.005f, 0.002f, bill, Paint, 5);
                    r.Blob(new Vector3(0, y0 + 0.03f, -0.07f), new Vector3(0.012f, 0.005f, 0.03f), grey, Paint, 8, 4);
                    if (!fly)
                    {
                        foreach (var s in new[] { -1f, 1f }) r.Blob(new Vector3(s * 0.022f, y0 + 0.04f, -0.01f), new Vector3(0.012f, 0.014f, 0.055f), grey, Paint, 8, 6);
                        foreach (var s in new[] { -1f, 1f }) r.Limb(new Vector3(s * 0.01f, y0 + 0.01f, 0), new Vector3(s * 0.012f, 0, 0.004f), 0.003f, 0.0025f, leg, Paint, 4);
                    }
                    else
                    {
                        // Wings out, raised or lowered: a long tapering arm and hand each side.
                        // Wings out, raised or lowered: the arm broad, the hand swept back and tapering to a dark tip.
                        float lift = a.pose == "up" ? 0.05f : -0.035f;
                        var tipCol = Real("#3a3d48", Paint);
                        foreach (var s in new[] { -1f, 1f })
                        {
                            var rootF = new Vector3(s * 0.018f, 0.038f, 0.03f); var rootB = new Vector3(s * 0.018f, 0.036f, -0.025f);
                            var elbF = new Vector3(s * 0.11f, 0.036f + lift * 0.6f, 0.02f); var elbB = new Vector3(s * 0.11f, 0.034f + lift * 0.6f, -0.03f);
                            var tip = new Vector3(s * 0.21f, 0.034f + lift, -0.035f); var tipB = new Vector3(s * 0.19f, 0.033f + lift, -0.05f);
                            b.Quad(rootF, elbF, elbB, rootB, grey, Paint);
                            b.Quad(elbF, tip, tipB, elbB, grey, Paint);
                            b.Tri(tip, tipB, tip + (tip - elbF).normalized * 0.02f, tipCol, Paint);
                        }
                    }
                    break;
                }
                case "pigeon":
                {
                    var g = Real("#8e93a6", Paint); var dark = Real("#5e6378", Paint); var neck = Real("#6f8a8a", Paint);
                    bool peck = a.pose == "peck", fly = a.pose == "up" || a.pose == "down";
                    r.Blob(new Vector3(0, 0.03f, 0), new Vector3(0.022f, 0.022f, 0.04f), g, Paint, 10, 8);
                    if (fly)
                    {
                        float lift = a.pose == "up" ? 0.035f : -0.02f;
                        foreach (var s in new[] { -1f, 1f })
                        {
                            var rootF = new Vector3(s * 0.016f, 0.038f, 0.02f); var rootB = new Vector3(s * 0.016f, 0.036f, -0.02f);
                            var tip = new Vector3(s * 0.085f, 0.036f + lift, -0.025f); var tipB = new Vector3(s * 0.075f, 0.035f + lift, -0.04f);
                            b.Quad(rootF, tip, tipB, rootB, g, Paint);
                        }
                    }
                    r.Blob(new Vector3(0, 0.032f, -0.045f), new Vector3(0.012f, 0.005f, 0.022f), dark, Paint, 8, 4);
                    var hp = peck ? new Vector3(0, 0.02f, 0.05f) : new Vector3(0, 0.06f, 0.03f);
                    r.Limb(new Vector3(0, 0.04f, 0.025f), hp, 0.012f, 0.01f, neck, Paint, 8);
                    r.Blob(hp, new Vector3(0.012f, 0.012f, 0.014f), dark, Paint, 8, 6);
                    break;
                }
                case "dolphin":
                {
                    var back = Real("#6f7f9e", Paint); var belly = Real("#d6dbe6", Paint);
                    r.Blob(Vector3.zero, new Vector3(0.06f, 0.07f, 0.26f), back, Paint, 18, 12);
                    r.Blob(new Vector3(0, -0.02f, 0.02f), new Vector3(0.05f, 0.05f, 0.22f), belly, Paint, 16, 10, d => d.y < -0.2f);
                    r.Limb(new Vector3(0, 0, 0.24f), new Vector3(0, -0.005f, 0.32f), 0.03f, 0.012f, back, Paint, 10);
                    r.Blob(new Vector3(0, 0.08f, -0.02f), new Vector3(0.008f, 0.045f, 0.04f), back, Paint, 8, 6, null, Quaternion.Euler(-30, 0, 0));
                    r.Limb(new Vector3(0, 0, -0.22f), new Vector3(0, 0.01f, -0.3f), 0.02f, 0.012f, back, Paint, 8);
                    r.Blob(new Vector3(0, 0.012f, -0.32f), new Vector3(0.08f, 0.008f, 0.03f), back, Paint, 10, 4);
                    foreach (var s in new[] { -1f, 1f }) r.Blob(new Vector3(s * 0.06f, -0.04f, 0.1f), new Vector3(0.035f, 0.006f, 0.02f), back, Paint, 8, 4, null, Quaternion.Euler(0, 0, s * 30));
                    break;
                }
                case "whale":
                {
                    var back = Real("#4f5a74", Paint);
                    if (a.pose == "breach")
                    {
                        // A humpback breaching at dawn: the body out of the sea to its flippers, arching back, the pale grooved
                        // throat towards us, one long white flipper flung out. Its spine an arc from the water to the snout.
                        var belly = Real("#e4e8f0", Paint); var groove = Real("#b8c0d2", Paint); var eye = Real("#1b1d24", Paint);
                        Vector3 S(float t) => new Vector3(0, 1.7f * t, -0.25f + 0.95f * t - 0.8f * t * t);
                        float Rad(float t) => 0.1f + 0.3f * Mathf.Sin(Mathf.PI * (0.28f + 0.62f * t)) * (1 - 0.45f * t * t);
                        const int n = 14;
                        for (int k = 0; k < n; k++)
                        {
                            float t0 = (float)k / n, t1 = (float)(k + 1) / n;
                            r.Limb(S(t0), S(t1), Rad(t0), Rad(t1), back, Paint, 18);
                            // The throat: a paler band down its front, grooved.
                            var fwd0 = Vector3.Cross(Vector3.right, S(t1) - S(t0)).normalized;
                            r.Limb(S(t0) + fwd0 * Rad(t0) * 0.42f, S(t1) + fwd0 * Rad(t1) * 0.42f, Rad(t0) * 0.66f, Rad(t1) * 0.66f, t0 > 0.45f ? belly : groove, Paint, 14);
                        }
                        r.Blob(S(1) + new Vector3(0, 0.02f, 0.02f), new Vector3(0.08f, 0.11f, 0.08f), back, Paint, 12, 8);
                        foreach (var sd in new[] { -1f, 1f }) r.Blob(S(0.78f) + new Vector3(sd * Rad(0.78f) * 0.88f, 0, 0.05f), new Vector3(0.012f, 0.014f, 0.012f), eye, Paint, 6, 4);
                        // The flippers: long, pale, one flung out wide, the other close along its side.
                        r.Limb(S(0.42f) + new Vector3(Rad(0.42f) * 0.8f, 0, 0.05f), S(0.42f) + new Vector3(0.95f, -0.1f, 0.25f), 0.07f, 0.025f, belly, Paint, 10);
                        r.Limb(S(0.42f) + new Vector3(-Rad(0.42f) * 0.8f, 0, 0.05f), S(0.42f) + new Vector3(-0.45f, -0.45f, 0.18f), 0.07f, 0.03f, groove, Paint, 10);
                        break;
                    }
                    // Its back, only what breaks the surface, and the flukes of its tail lifting.
                    r.Blob(Vector3.zero, new Vector3(0.36f, 0.16f, 1.25f), back, Paint, 24, 14, d => d.y > 0.25f);
                    r.Blob(new Vector3(0, 0.12f, -0.5f), new Vector3(0.02f, 0.06f, 0.08f), back, Paint, 8, 6);
                    r.Limb(new Vector3(0, 0.02f, -1.2f), new Vector3(0, 0.22f, -1.5f), 0.07f, 0.035f, back, Paint, 10);
                    r.Blob(new Vector3(0, 0.26f, -1.55f), new Vector3(0.36f, 0.02f, 0.12f), back, Paint, 14, 6, null, Quaternion.Euler(-35, 0, 0));
                    break;
                }
                case "bfly":
                {
                    var wing = Real("#" + a.shirt, Cloth); var body = Real("#2a2a33", Paint);
                    r.Limb(new Vector3(0, 0, -0.012f), new Vector3(0, 0, 0.014f), 0.0025f, 0.002f, body, Paint, 5);
                    float open = a.pose == "up" ? 0.9f : 0.3f;
                    foreach (var s in new[] { -1f, 1f })
                    {
                        var q = Quaternion.Euler(0, 0, s * (90 - open * 90));
                        r.Blob(q * new Vector3(s * 0.018f, 0, 0.006f), new Vector3(0.018f, 0.001f, 0.014f), wing, Cloth, 8, 3, null, q);
                        r.Blob(q * new Vector3(s * 0.013f, 0, -0.011f), new Vector3(0.012f, 0.001f, 0.01f), wing, Cloth, 8, 3, null, q);
                    }
                    break;
                }
                case "robot":
                {
                    // A robot in a hat and a stuck-on moustache, doing its best to pass for a person.
                    var body = Real("#8ccbff", Paint); var head = Real("#dfe4f5", Metal); var dark = Real("#2c355e", Paint); var steel = Real("#9aa3c0", Metal);
                    // Built in fractions of a person's height (its hat's top a little above).
                    float u = PersonHeight / 2.4f;
                    foreach (var s in new[] { -1f, 1f }) Round(b, new Vector3(s * 0.04f * u * 2.4f, 0.12f * u * 2.4f, 0), new Vector3(0.022f, 0.12f, 0.022f) * u * 2.4f, 0.4f, steel, Metal, 10, 6);
                    Round(b, new Vector3(0, 0.36f * u * 2.4f, 0), new Vector3(0.13f, 0.12f, 0.08f) * u * 2.4f, 0.25f, body, Paint, 16, 10);
                    Round(b, new Vector3(0, 0.36f * u * 2.4f, 0.075f * u * 2.4f), new Vector3(0.07f, 0.04f, 0.01f) * u * 2.4f, 0.3f, Real("#f4f6fc", Paint), Paint, 10, 6);
                    Round(b, new Vector3(0, 0.58f * u * 2.4f, 0), new Vector3(0.1f, 0.09f, 0.08f) * u * 2.4f, 0.25f, head, Metal, 16, 10);
                    foreach (var s in new[] { -1f, 1f }) Round(b, new Vector3(s * 0.04f * u * 2.4f, 0.6f * u * 2.4f, 0.08f * u * 2.4f), Vector3.one * 0.016f * u * 2.4f, 0.8f, dark, Paint, 8, 6);
                    Round(b, new Vector3(0, 0.54f * u * 2.4f, 0.082f * u * 2.4f), new Vector3(0.05f, 0.012f, 0.008f) * u * 2.4f, 0.6f, dark, Paint, 10, 4);
                    Round(b, new Vector3(0, 0.69f * u * 2.4f, 0), new Vector3(0.14f, 0.01f, 0.13f) * u * 2.4f, 0.6f, dark, Paint, 16, 4);
                    Round(b, new Vector3(0, 0.73f * u * 2.4f, 0), new Vector3(0.085f, 0.05f, 0.08f) * u * 2.4f, 0.7f, dark, Paint, 14, 8, q => q.y > -0.2f);
                    // Arms: one at its side, one up in a wave.
                    r.Limb(new Vector3(0.14f, 0.44f, 0) * u * 2.4f, new Vector3(0.16f, 0.24f, 0.02f) * u * 2.4f, 0.025f * u * 2.4f, 0.022f * u * 2.4f, steel, Metal, 8);
                    r.Limb(new Vector3(-0.14f, 0.44f, 0) * u * 2.4f, new Vector3(-0.26f, 0.62f, 0.04f) * u * 2.4f, 0.025f * u * 2.4f, 0.022f * u * 2.4f, steel, Metal, 8);
                    break;
                }
                case "dog":
                {
                    // A medium dog in its coat, trotting: four frames of its gait (pose c0..c3), its tail up; or standing.
                    var coat = Real("#" + a.shirt, Paint); var dark = a.shirt == "d8d2cc" ? Real("#5b5157", Paint) : new Color(coat.r * 0.42f, coat.g * 0.42f, coat.b * 0.42f, 1);
                    int fr = a.pose.Length > 1 && a.pose[0] == 'c' ? a.pose[1] - '0' : 0;
                    float ph = fr * Mathf.PI / 2, sw = a.pose == "stand" ? 0 : Mathf.Sin(ph) * 24;
                    r.Blob(new Vector3(0, 0.1f, 0), new Vector3(0.048f, 0.048f, 0.115f), coat, Paint, 14, 10);
                    r.Blob(new Vector3(0, 0.108f, 0.08f), new Vector3(0.052f, 0.054f, 0.05f), coat, Paint, 12, 8);
                    foreach (var (x, z, sgn) in new[] { (-0.028f, 0.085f, 1f), (0.028f, 0.085f, -1f), (-0.028f, -0.08f, -1f), (0.028f, -0.08f, 1f) })
                    {
                        float t = sgn * sw * Mathf.Deg2Rad;
                        var hip = new Vector3(x, 0.09f, z); var foot = hip + new Vector3(0, -Mathf.Cos(t), Mathf.Sin(t)) * 0.09f;
                        r.Limb(hip, foot, 0.014f, 0.009f, coat, Paint, 6);
                    }
                    var head = new Vector3(0, 0.165f, 0.155f);
                    r.Limb(new Vector3(0, 0.12f, 0.1f), head, 0.03f, 0.024f, coat, Paint, 8);
                    r.Blob(head, new Vector3(0.03f, 0.03f, 0.034f), coat, Paint, 10, 8);
                    r.Blob(head + new Vector3(0, -0.01f, 0.04f), new Vector3(0.016f, 0.014f, 0.025f), coat, Paint, 8, 6);
                    r.Blob(head + new Vector3(0, -0.006f, 0.064f), new Vector3(0.008f, 0.007f, 0.006f), dark, Paint, 6, 4);
                    foreach (var s in new[] { -1f, 1f }) r.Blob(head + new Vector3(s * 0.024f, 0.022f, -0.008f), new Vector3(0.008f, 0.02f, 0.012f), dark, Paint, 6, 4, null, Quaternion.Euler(-15, 0, s * 20));
                    r.Limb(new Vector3(0, 0.12f, -0.1f), new Vector3(0, 0.18f, -0.15f + Mathf.Sin(ph * 2) * 0.01f), 0.01f, 0.005f, coat, Paint, 6);
                    break;
                }
                case "balloon":
                {
                    // An envelope of gores in two colours, swelling from the mouth to a round crown; ropes to a wicker basket; two aboard.
                    var c1 = Real("#" + a.shirt, Cloth); var c2 = Real("#" + (a.skin == "0" ? "ffffff" : a.skin), Cloth);
                    var wick = Real("#9b8bd6", Timber); var rope = Real("#c3c8de", Paint);
                    (float y, float rr)[] prof = { (0.55f, 0.14f), (0.66f, 0.26f), (0.82f, 0.44f), (1.02f, 0.6f), (1.25f, 0.67f), (1.48f, 0.64f), (1.66f, 0.54f), (1.8f, 0.38f), (1.89f, 0.2f), (1.92f, 0f) };
                    int gores = 14;
                    for (int g = 0; g < gores; g++)
                    {
                        float a0 = g * Mathf.PI * 2 / gores, a1 = (g + 1) * Mathf.PI * 2 / gores;
                        var col = g % 2 == 0 ? c1 : c2;
                        for (int q = 0; q + 1 < prof.Length; q++)
                            for (int k = 0; k < 3; k++)
                            {
                                float b0 = Mathf.Lerp(a0, a1, k / 3f), b1 = Mathf.Lerp(a0, a1, (k + 1) / 3f);
                                // Each gore bulges a little between its seams.
                                float bul0 = 1 + 0.03f * Mathf.Sin(Mathf.PI * k / 3f), bul1 = 1 + 0.03f * Mathf.Sin(Mathf.PI * (k + 1) / 3f);
                                Vector3 P(int i, float t, float bl) => new Vector3(Mathf.Sin(t) * prof[i].rr * bl, prof[i].y, Mathf.Cos(t) * prof[i].rr * bl);
                                b.Quad(P(q, b1, bul1), P(q, b0, bul0), P(q + 1, b0, bul0), P(q + 1, b1, bul1), col, Cloth);
                            }
                    }
                    // The basket, its rim, and the ropes up to the mouth.
                    Round(b, new Vector3(0, 0.1f, 0), new Vector3(0.12f, 0.1f, 0.12f), 0.3f, wick, Timber, 16, 10);
                    Round(b, new Vector3(0, 0.205f, 0), new Vector3(0.128f, 0.012f, 0.128f), 0.3f, Real("#7d6e8a", Paint), Paint, 16, 6);
                    foreach (var (x, z) in new[] { (-0.1f, -0.1f), (0.1f, -0.1f), (0.1f, 0.1f), (-0.1f, 0.1f) })
                        Tube(b, new Vector3(x, 0.21f, z), new Vector3(x * 1.2f, 0.56f, z * 1.2f), 0.004f, rope, Paint, 4);
                    foreach (var (dx, sh) in new[] { (-0.045f, "8ccbff"), (0.05f, "ff4f6e") })
                    {
                        var p = Person(new ActorRec { name = a.name, kind = "person", shirt = sh, skin = dx < 0 ? "e8c4a8" : "a8714e", hat = "0", v = dx < 0 ? 5 : 12, pose = "stand", facing = "se", frame = 0 });
                        p.Apply(Matrix4x4.Translate(new Vector3(dx, 0.04f, 0.02f)));
                        b.Append(p);
                    }
                    break;
                }
                case "plane":
                {
                    // A little high-winged plane: fuselage, cabin glass, wing on struts, tail, wheels, a spinning propeller's disc.
                    var white = Real("#f4f6fc", Paint); var red = Real("#" + a.shirt, Paint); var glass = Real("#7f92ad", Glass); var dark = Real("#30333d", Paint);
                    Round(b, new Vector3(0, 0, 0.05f), new Vector3(0.11f, 0.11f, 0.48f), 0.55f, white, Paint, 20, 12);
                    Round(b, new Vector3(0, 0.035f, -0.48f), new Vector3(0.04f, 0.05f, 0.12f), 0.6f, white, Paint, 12, 8);
                    Round(b, new Vector3(0, 0.07f, 0.16f), new Vector3(0.1f, 0.06f, 0.16f), 0.45f, glass, Glass, 16, 8, d => d.y > 0);
                    Round(b, new Vector3(0, 0.15f, 0.1f), new Vector3(0.62f, 0.014f, 0.1f), 0.4f, white, Paint, 20, 6);
                    foreach (var s in new[] { -1f, 1f })
                    {
                        Round(b, new Vector3(s * 0.5f, 0.152f, 0.1f), new Vector3(0.12f, 0.016f, 0.102f), 0.4f, red, Paint, 10, 4);
                        Tube(b, new Vector3(s * 0.07f, -0.06f, 0.12f), new Vector3(s * 0.35f, 0.14f, 0.1f), 0.006f, dark, Paint, 4);
                        Tube(b, new Vector3(s * 0.06f, -0.1f, 0.18f), new Vector3(s * 0.1f, -0.17f, 0.2f), 0.008f, dark, Paint, 4);
                        Round(b, new Vector3(s * 0.1f, -0.18f, 0.2f), new Vector3(0.015f, 0.035f, 0.035f), 0.6f, dark, Paint, 10, 6);
                    }
                    Round(b, new Vector3(0, 0.03f, -0.58f), new Vector3(0.24f, 0.01f, 0.07f), 0.4f, white, Paint, 14, 4);
                    Round(b, new Vector3(0, 0.12f, -0.6f), new Vector3(0.01f, 0.1f, 0.07f), 0.4f, red, Paint, 8, 8);
                    Round(b, new Vector3(0, 0, 0.55f), new Vector3(0.05f, 0.05f, 0.04f), 0.8f, red, Paint, 10, 6);
                    // The propeller, turning: a faint disc.
                    for (int k = 0; k < 24; k++) { float t0 = k * Mathf.PI * 2 / 24, t1 = (k + 1) * Mathf.PI * 2 / 24; b.Tri(new Vector3(0, 0, 0.6f), new Vector3(Mathf.Cos(t0) * 0.18f, Mathf.Sin(t0) * 0.18f, 0.6f), new Vector3(Mathf.Cos(t1) * 0.18f, Mathf.Sin(t1) * 0.18f, 0.6f), Real("#c9cde0", Paint), Paint); }
                    break;
                }
                case "cloud":
                {
                    // A fair-weather cumulus: a heap of puffs on a flat base, piled highest in the middle.
                    var white = Real("#fbfcff", Paint);
                    int seed = a.pose.Length > 1 ? a.pose[1] - '0' : 0;
                    var rnd = new System.Random(seed * 7919 + 13);
                    float Rn() => (float)rnd.NextDouble();
                    float rx = 1.05f + seed * 0.08f, rz = 0.7f;
                    // The base: wide, low, flattened lobes.
                    for (int k = 0; k < 14; k++)
                    {
                        float t = Rn() * Mathf.PI * 2, d = Mathf.Sqrt(Rn()) * 0.9f;
                        var p = new Vector3(Mathf.Cos(t) * d * rx, 0.08f, Mathf.Sin(t) * d * rz);
                        float rr = 0.2f + Rn() * 0.14f;
                        r.Blob(p, new Vector3(rr * 1.3f, rr * 0.55f, rr * 1.2f), white, Paint, 14, 8, q => q.y > -0.4f);
                    }
                    // The towers: big puffs in the middle, heaped, and smaller ones crowding their flanks.
                    for (int k = 0; k < 70; k++)
                    {
                        float t = Rn() * Mathf.PI * 2, d = Mathf.Pow(Rn(), 0.7f);
                        var p = new Vector3(Mathf.Cos(t) * d * rx * 0.85f, 0, Mathf.Sin(t) * d * rz * 0.8f);
                        float centre = 1 - d;
                        float rr = k < 18 ? Mathf.Lerp(0.18f, 0.34f, Rn()) * (0.6f + centre * 0.6f) : Mathf.Lerp(0.05f, 0.15f, Rn());
                        p.y = 0.1f + centre * 0.42f * (0.5f + Rn() * 0.7f) + rr * 0.3f;
                        r.Blob(p, Vector3.one * rr, white, Paint, 12, 8, q => q.y > -0.6f);
                    }
                    break;
                }
                case "globe": Globe.Build(b, a); return b;
                case "pod":
                {
                    // The space elevator's climber: a rounded capsule in its colour, a band of windows, a steel collar top and bottom round the cable.
                    var body = Real("#" + a.shirt, Paint); var glass = Real("#7f92ad", Glass); var steel = Real("#5d6478", Metal);
                    float h = 28 / IslandBuild.PxPerHeight, rr = Px(10);
                    (float y, float r)[] prof = { (0, rr * 0.55f), (h * 0.08f, rr * 0.9f), (h * 0.2f, rr), (h * 0.8f, rr), (h * 0.92f, rr * 0.88f), (h, rr * 0.5f) };
                    for (int q = 0; q + 1 < prof.Length; q++)
                        for (int k = 0; k < 24; k++)
                        {
                            float a0 = k * Mathf.PI * 2 / 24, a1 = (k + 1) * Mathf.PI * 2 / 24;
                            Vector3 P(int i, float t) => new Vector3(Mathf.Sin(t) * prof[i].r, prof[i].y, Mathf.Cos(t) * prof[i].r);
                            b.Quad(P(q, a1), P(q, a0), P(q + 1, a0), P(q + 1, a1), body, Paint);
                        }
                    for (int k = 0; k < 24; k++)
                    {
                        float a0 = k * Mathf.PI * 2 / 24, a1 = (k + 1) * Mathf.PI * 2 / 24, R1 = rr * 1.01f, y0 = h * 0.52f, y1 = h * 0.74f;
                        if (k % 4 == 3) continue;
                        b.Quad(new Vector3(Mathf.Sin(a1) * R1, y0, Mathf.Cos(a1) * R1), new Vector3(Mathf.Sin(a0) * R1, y0, Mathf.Cos(a0) * R1), new Vector3(Mathf.Sin(a0) * R1, y1, Mathf.Cos(a0) * R1), new Vector3(Mathf.Sin(a1) * R1, y1, Mathf.Cos(a1) * R1), glass, Glass);
                    }
                    Round(b, new Vector3(0, -Px(1.5f), 0), new Vector3(rr * 0.6f, Px(2), rr * 0.6f), 0.5f, steel, Metal, 16, 6);
                    Round(b, new Vector3(0, h + Px(1.5f), 0), new Vector3(rr * 0.6f, Px(2), rr * 0.6f), 0.5f, steel, Metal, 16, 6);
                    break;
                }
                default: if (!MoreCreatures(b, a)) return null; break;
            }
            // The smallest creatures a little larger than life, to read at the island's size.
            float big = a.kind switch { "duck" => 1.5f, "crab" => 1.8f, "gull" => 1.4f, "pigeon" => 1.6f, "bfly" => 2.4f, _ => 1f };
            b.Apply(Matrix4x4.TRS(Vector3.zero, Quaternion.Euler(0, Yaw(a.facing), 0), Vector3.one * big));
            return b;
        }
    }
}

namespace Island
{
    public static partial class Buildings
    {
    /**
     * The giant globe at How Fast (lm-peaks.ts), turning on its tilted axis:
     * an Earth-like world (not this one's map: seas, continents green and
     * dry, ice at the poles, clouds), drawn on the sphere in its vertices'
     * colours and shot in 24 frames of a turn (pose f0..f23), which the site
     * shows in turn.
     */
    static class Globe
    {
        /** Its axis: tilted over to the left on the picture, as the site draws it. */
        public static Vector3 Axis => (Quaternion.Euler(30, 225, 0) * new Vector3(-Mathf.Sin(14 * Mathf.Deg2Rad), Mathf.Cos(14 * Mathf.Deg2Rad), 0)).normalized;

        // An integer hash (a sine hash goes blocky at these scales: its float runs out of digits).
        static float H3(int x, int y, int z)
        {
            unchecked
            {
                uint h = (uint)x * 0x8da6b343u ^ (uint)y * 0xd8163841u ^ (uint)z * 0xcb1ab31fu;
                h = (h ^ (h >> 15)) * 0x2c1b3c6du; h = (h ^ (h >> 12)) * 0x297a2d39u; h ^= h >> 15;
                return h / 4294967296f;
            }
        }
        static float N3(float x, float y, float z)
        {
            int ix = Mathf.FloorToInt(x), iy = Mathf.FloorToInt(y), iz = Mathf.FloorToInt(z);
            float fx = x - ix, fy = y - iy, fz = z - iz;
            fx = fx * fx * fx * (fx * (fx * 6 - 15) + 10); fy = fy * fy * fy * (fy * (fy * 6 - 15) + 10); fz = fz * fz * fz * (fz * (fz * 6 - 15) + 10);
            float L(float a, float b, float t) => a + (b - a) * t;
            return L(L(L(H3(ix, iy, iz), H3(ix + 1, iy, iz), fx), L(H3(ix, iy + 1, iz), H3(ix + 1, iy + 1, iz), fx), fy),
                     L(L(H3(ix, iy, iz + 1), H3(ix + 1, iy, iz + 1), fx), L(H3(ix, iy + 1, iz + 1), H3(ix + 1, iy + 1, iz + 1), fx), fy), fz);
        }
        static float Fbm(float x, float y, float z, int oct) { float a = 0, k = 1, n = 0, w = 1; for (int i = 0; i < oct; i++) { a += N3(x * k + i * 17.3f, y * k, z * k) * w; n += w; k *= 2.03f; w *= 0.5f; } return a / n; }
        static float Ss(float a, float b, float x) { float t = Mathf.Clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); }

        static Color Hex(string h) { ColorUtility.TryParseHtmlString(h, out var c); return c; }
        static readonly Color Deep = Hex("#0a2350"), Ocean = Hex("#123f86"), Shelf = Hex("#1f6ea8"), Lagoon = Hex("#3aa0b8"),
            Forest = Hex("#24561f"), Green = Hex("#3d7a2c"), Grass = Hex("#7f8a3e"), Savanna = Hex("#a99a58"), Desert = Hex("#d6b27a"), Dune = Hex("#e2c48e"),
            Rock = Hex("#7a6a55"), Tundra = Hex("#8e8d74"), Ice = Hex("#f2f6fb"), Cloud = Hex("#fbfcfe");

        /**
         * The world's colour at a point on its unit sphere (in its own turning frame; y up its axis), in sRGB:
         * continents from warped noise (so the coasts wander and the land comes in a few big masses, under a
         * third of it), shallow seas at their coasts and the deep ocean beyond, forest in the tropics, deserts
         * under the subtropical highs, rock and snow on the ranges, tundra and ice towards the poles, and
         * cloud in streaks along the latitudes, thick at the equator and in the storm belts.
         * (Prototyped in JS to judge it: the same numbers.)
         */
        static Color At(Vector3 q)
        {
            float x = q.x, y = q.y, z = q.z;
            float lat = Mathf.Asin(Mathf.Clamp(y, -1, 1)) * Mathf.Rad2Deg, al = Mathf.Abs(lat);
            float wx = Fbm(x * 1.3f + 5.2f, y * 1.3f, z * 1.3f, 4) - 0.5f, wy = Fbm(x * 1.3f, y * 1.3f + 9.1f, z * 1.3f, 4) - 0.5f, wz = Fbm(x * 1.3f, y * 1.3f, z * 1.3f + 2.7f, 4) - 0.5f;
            float px = x + wx * 1.1f, py = y + wy * 1.1f, pz = z + wz * 1.1f;
            float land = Fbm(px * 1.25f + 3.1f, py * 1.25f, pz * 1.25f + 7.7f, 7);
            const float sea = 0.565f;
            Color c;
            if (land < sea)
            {
                float d = sea - land;
                c = Color.Lerp(Lagoon, Shelf, Ss(0, 0.012f, d));
                c = Color.Lerp(c, Ocean, Ss(0.008f, 0.03f, d));
                c = Color.Lerp(c, Deep, Ss(0.03f, 0.09f, d) * 0.85f);
            }
            else
            {
                float h = land - sea;
                float wet = Fbm(x * 3.1f + 11, y * 3.1f, z * 3.1f, 4);
                float belt = Mathf.Exp(-Mathf.Pow((al - 24) / 12, 2));
                float arid = Ss(0.5f, 0.7f, wet * 0.6f + belt * 0.45f + Ss(0, 0.08f, h) * 0.12f - 0.05f);
                float tropic = 1 - Ss(12, 30, al);
                var veg = Color.Lerp(Green, Forest, tropic * 0.8f + 0.2f * Fbm(x * 9, y * 9, z * 9, 2));
                veg = Color.Lerp(veg, Grass, Ss(0.3f, 0.6f, arid) * 0.8f);
                var dry = Color.Lerp(Savanna, Color.Lerp(Desert, Dune, Fbm(x * 14, y * 14, z * 14, 3)), Ss(0.6f, 0.9f, arid));
                c = Color.Lerp(veg, dry, Ss(0.45f, 0.8f, arid));
                float ridge = 1 - Mathf.Abs(Fbm(x * 6 + 1, y * 6, z * 6, 4) * 2 - 1);
                c = Color.Lerp(c, Rock, Ss(0.05f, 0.16f, h) * Ss(0.55f, 0.85f, ridge) * 0.85f);
                c = Color.Lerp(c, Tundra, Ss(50, 64, al + 6 * (wet - 0.5f)));
                c = Color.Lerp(c, Ice, Ss(0.13f, 0.2f, h) * Ss(0.7f, 0.9f, ridge) * 0.7f);
            }
            c = Color.Lerp(c, Ice, Ss(68, 74, al + 10 * (Fbm(x * 5, y * 5, z * 5, 3) - 0.5f)));
            float cw = Fbm(x * 3, y * 3 + 4, z * 3, 3) - 0.5f;
            float cl = Fbm(x * 3.2f + cw * 1.5f, y * 8 + cw * 2.5f, z * 3.2f + cw * 1.5f + 4, 6);
            float zone = 0.55f + 0.25f * Mathf.Exp(-Mathf.Pow(lat / 8, 2)) + 0.3f * Mathf.Exp(-Mathf.Pow((al - 55) / 10, 2)) - 0.25f * Mathf.Exp(-Mathf.Pow((al - 25) / 8, 2));
            float cover = Ss(0.52f, 0.72f, cl * zone + 0.22f) * 0.92f;
            return Color.Lerp(c, Cloud, cover).linear;
        }

        public static void Build(Bm b, ActorRec a)
        {
            int frame = a.pose.Length > 1 && int.TryParse(a.pose.Substring(1), out var k) ? k : 0;
            float turn = frame * 360f / 24;
            float R = 32 / IslandBuild.PxPerUnit;
            var axis = Axis;
            // Its own frame: y up the axis.
            var spin = Quaternion.FromToRotation(Vector3.up, axis) * Quaternion.AngleAxis(-turn, Vector3.up);
            int lon = 360, lat = 180;
            var cols = new Color[lon + 1, lat + 1];
            for (int j = 0; j <= lat; j++) for (int i = 0; i <= lon; i++) { float th0 = Mathf.PI * j / lat - Mathf.PI / 2, ph0 = Mathf.PI * 2 * i / lon; cols[i, j] = At(new Vector3(Mathf.Cos(th0) * Mathf.Cos(ph0), Mathf.Sin(th0), Mathf.Cos(th0) * Mathf.Sin(ph0))); }
            Vector3 V(int i, int j) { float th = Mathf.PI * j / lat - Mathf.PI / 2, ph = Mathf.PI * 2 * i / lon; return new Vector3(Mathf.Cos(th) * Mathf.Cos(ph), Mathf.Sin(th), Mathf.Cos(th) * Mathf.Sin(ph)); }
            for (int j = 0; j < lat; j++)
                for (int i = 0; i < lon; i++)
                {
                    Vector3 q0 = V(i, j), q1 = V(i + 1, j), q2 = V(i + 1, j + 1), q3 = V(i, j + 1);
                    b.QuadColours(spin * q0 * R, spin * q1 * R, spin * q2 * R, spin * q3 * R, cols[i, j], cols[i + 1, j], cols[i + 1, j + 1], cols[i, j + 1], Paint);
                }
        }
    }
    }
}
