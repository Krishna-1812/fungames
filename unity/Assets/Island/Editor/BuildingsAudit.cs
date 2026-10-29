// Deep Time's cliff as rock: its seven boxes become strata with eroded,
// uneven edges (first tried in the audit preview, now the building itself).
using UnityEngine;

namespace Island
{
    public static partial class Buildings
    {
        static bool geology;

        // Every layer uses the same continuous contour function and global
        // height. Adjacent strata share vertices rather than leaving seams.
        static Vector3 RockPoint(SolidRec s, float perimeter, float height)
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

        static void Stratum(Bm b, SolidRec s)
        {
            const int edgeSteps = 8, heightSteps = 3;
            // Earth's own colours, oldest at the foot: dark shale, mudstones and sandstones going paler upwards, and
            // the pale clay of the line where the dinosaurs end (the site's 66 MYA). Taken as they are, not through
            // Real (which would make them the town's dressed stone), in the rough concrete's grain.
            string[] stone = { "#4a4b55", "#6a645c", "#827768", "#9d8c75", "#d7d0c1", "#8c806e", "#b0a28a" };
            int layer = Mathf.Clamp(Mathf.RoundToInt((s.z0 - foot) / 11), 0, 6);
            var colour = Hex(stone[layer]).linear;
            for (int edge = 0; edge < 4; edge++)
                for (int segment = 0; segment < edgeSteps; segment++)
                    for (int h = 0; h < heightSteps; h++)
                    {
                        float a = edge + segment / (float)edgeSteps, c = edge + (segment + 1f) / edgeSteps;
                        float z0 = s.z0 + s.h * h / heightSteps, z1 = s.z0 + s.h * (h + 1) / heightSteps;
                        b.Quad(RockPoint(s, a, z0), RockPoint(s, c, z0),
                            RockPoint(s, c, z1), RockPoint(s, a, z1), colour, Concrete);
                    }
            // Close every layer; the common perimeter also closes the top's
            // irregular outline. Existing top props keep their registration.
            float top = s.z0 + s.h;
            var centre = W(s.x + s.w * 0.5f, s.y + s.d * 0.5f, top);
            // The top rough dry grass, and the ledges where a layer is worn back rough rock: in plaster's grain, not Concrete's
            // (whose sky-facing side is paving).
            bool last = layer == 6;
            var topColour = last ? Hex("#7f8c5c").linear : colour;
            for (int k = 0; k < edgeSteps * 4; k++)
                b.Tri(centre, RockPoint(s, k / (float)edgeSteps, top),
                    RockPoint(s, (k + 1f) / edgeSteps, top), topColour, Plaster);
        }
    }
}
