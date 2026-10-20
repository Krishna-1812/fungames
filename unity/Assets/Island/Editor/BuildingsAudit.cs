// Candidate geometry for the explicit audit preview. Normal rendering retains
// the approved building set until these pictures have been visually reviewed.
using UnityEngine;

namespace Island
{
    public static partial class Buildings
    {
        static bool auditGeology;

        // Every layer uses the same continuous contour function and global
        // height. Adjacent strata share vertices rather than leaving seams.
        static Vector3 AuditRockPoint(SolidRec s, float perimeter, float height)
        {
            float side = Mathf.Repeat(perimeter, 4), x, y;
            if (side < 1) { x = s.x + s.w; y = s.y + s.d * side; }
            else if (side < 2) { x = s.x + s.w * (2 - side); y = s.y + s.d; }
            else if (side < 3) { x = s.x; y = s.y + s.d * (3 - side); }
            else { x = s.x + s.w * (side - 3); y = s.y; }
            float angle = perimeter * Mathf.PI * 0.5f;
            float z = (height - foot) / 77;
            float erosion = 0.035f + 0.045f * z +
                0.025f * Mathf.Sin(angle * 5 + z * 9) +
                0.015f * Mathf.Sin(angle * 9 - z * 15);
            float cx = s.x + s.w * 0.5f, cy = s.y + s.d * 0.5f;
            return W(cx + (x - cx) * (1 - erosion), cy + (y - cy) * (1 - erosion), height);
        }

        static void AuditStratum(Bm b, SolidRec s)
        {
            const int edgeSteps = 8, heightSteps = 3;
            // Cool sedimentary stone, using the existing rough concrete
            // material and the island's existing sun/sky lighting pipeline.
            string[] stone = { "#625c79", "#79718b", "#8b8196", "#a095aa", "#919bab", "#b7adbd", "#ccc3cc" };
            int layer = Mathf.Clamp(Mathf.RoundToInt((s.z0 - foot) / 11), 0, 6);
            var colour = Real(stone[layer], Concrete);
            for (int edge = 0; edge < 4; edge++)
                for (int segment = 0; segment < edgeSteps; segment++)
                    for (int h = 0; h < heightSteps; h++)
                    {
                        float a = edge + segment / (float)edgeSteps, c = edge + (segment + 1f) / edgeSteps;
                        float z0 = s.z0 + s.h * h / heightSteps, z1 = s.z0 + s.h * (h + 1) / heightSteps;
                        b.Quad(AuditRockPoint(s, a, z0), AuditRockPoint(s, c, z0),
                            AuditRockPoint(s, c, z1), AuditRockPoint(s, a, z1), colour, Concrete);
                    }
            // Close every layer; the common perimeter also closes the top's
            // irregular outline. Existing top props keep their registration.
            float top = s.z0 + s.h;
            var centre = W(s.x + s.w * 0.5f, s.y + s.d * 0.5f, top);
            var topColour = layer == 6 ? Real("#829d91", Concrete) : colour;
            for (int k = 0; k < edgeSteps * 4; k++)
                b.Tri(centre, AuditRockPoint(s, k / (float)edgeSteps, top),
                    AuditRockPoint(s, (k + 1f) / edgeSteps, top), topColour, Concrete);
        }
    }
}
