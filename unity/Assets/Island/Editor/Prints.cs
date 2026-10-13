// The artwork Unity prints on what it builds (lib/island/kit.ts, print): a
// board's pinned papers, a poster, a painted emblem. scripts/export-island.mjs
// rasterises each one and packs them all on one sheet (Data/prints.png), with
// where each one is (Data/prints.json); a model lays its print on a face
// (Buildings.Print), and Building.shader draws it, lit as everything else is.
using System;
using System.Collections.Generic;
using System.IO;
using UnityEngine;

namespace Island
{
    public static class Prints
    {
        [Serializable] class Item { public string name; public float[] r; }
        [Serializable] class List { public Item[] items; }

        public static Texture2D Sheet;
        static Dictionary<string, Vector4> at;

        public static void Load()
        {
            if (at != null) return;
            at = new Dictionary<string, Vector4>();
            const string dir = "Assets/Island/Data/";
            if (!File.Exists(dir + "prints.png") || !File.Exists(dir + "prints.json")) return;
            Sheet = new Texture2D(2, 2, TextureFormat.RGBA32, true, false) { wrapMode = TextureWrapMode.Clamp, filterMode = FilterMode.Trilinear, anisoLevel = 8 };
            Sheet.LoadImage(File.ReadAllBytes(dir + "prints.png"));
            Sheet.Apply(true);
            foreach (var it in JsonUtility.FromJson<List>(File.ReadAllText(dir + "prints.json")).items)
                at[it.name] = new Vector4(it.r[0], it.r[1], it.r[2], it.r[3]);
            Debug.Log($"[island] prints: {at.Count} on a {Sheet.width}×{Sheet.height} sheet");
        }

        /** Where a print is on the sheet: bottom left and top right, in texture coordinates. */
        public static bool Find(string name, out Vector2 uv0, out Vector2 uv1)
        {
            Load();
            if (name != null && at.TryGetValue(name, out var r)) { uv0 = new Vector2(r.x, r.y); uv1 = new Vector2(r.z, r.w); return true; }
            uv0 = uv1 = Vector2.zero;
            return false;
        }
    }
}
