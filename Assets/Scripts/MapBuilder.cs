using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

public class Lane
{
    // Waypoints from the blue base (-z) to the red base (+z).
    public List<Vector3> pts = new List<Vector3>();

    public float Length
    {
        get
        {
            float l = 0f;
            for (int i = 1; i < pts.Count; i++) l += Vector3.Distance(pts[i - 1], pts[i]);
            return l;
        }
    }

    public Vector3 PointAt(float t)
    {
        float target = Length * Mathf.Clamp01(t);
        float acc = 0f;
        for (int i = 1; i < pts.Count; i++)
        {
            float seg = Vector3.Distance(pts[i - 1], pts[i]);
            if (acc + seg >= target) return Vector3.Lerp(pts[i - 1], pts[i], (target - acc) / seg);
            acc += seg;
        }
        return pts[pts.Count - 1];
    }

    // Path a team's units walk: from their own base, along the lane, to the enemy core.
    public List<Vector3> PathFor(int team)
    {
        var p = new List<Vector3>(pts);
        if (team == 1) p.Reverse();
        p.Add(MapBuilder.CorePos(1 - team));
        return p;
    }
}

// Builds the whole arena at runtime: three lanes, jungle, bases, towers and cores.
public static class MapBuilder
{
    public const float HalfX = 230f;
    public const float HalfZ = 270f;
    public static readonly Lane[] Lanes = new Lane[3];

    public static Vector3 Spawn(int team) { return new Vector3(0f, 0.1f, team == 0 ? -215f : 215f); }
    public static Vector3 CorePos(int team) { return new Vector3(0f, 0f, team == 0 ? -240f : 240f); }

    static Vector3 P(float x, float z) { return new Vector3(x, 0f, z); }

    static bool Down(Tower t) { return t == null || t.unit.IsDead; }

    static bool AnyDown(List<Tower> list)
    {
        foreach (var t in list) if (Down(t)) return true;
        return false;
    }

    static bool AnyAlive(List<Tower> list)
    {
        foreach (var t in list) if (!Down(t)) return true;
        return false;
    }

    static float DistToSegment(Vector3 p, Vector3 a, Vector3 b)
    {
        p.y = a.y = b.y = 0f;
        Vector3 ab = b - a;
        float t = Mathf.Clamp01(Vector3.Dot(p - a, ab) / Mathf.Max(0.0001f, ab.sqrMagnitude));
        return Vector3.Distance(p, a + ab * t);
    }

    static float DistToLanes(Vector3 p)
    {
        float best = float.MaxValue;
        foreach (var lane in Lanes)
            for (int i = 1; i < lane.pts.Count; i++)
                best = Mathf.Min(best, DistToSegment(p, lane.pts[i - 1], lane.pts[i]));
        return best;
    }

    public static void Build(Transform root)
    {
        BuildLanes();

        Color ground = new Color(0.22f, 0.30f, 0.20f);
        Color laneCol = new Color(0.55f, 0.50f, 0.40f);
        Color rock = new Color(0.38f, 0.37f, 0.40f);

        // Ground + boundary walls
        Vis.Prim(PrimitiveType.Cube, root, new Vector3(0f, -0.5f, 0f), new Vector3(HalfX * 2f + 8f, 1f, HalfZ * 2f + 8f), ground, true);
        Vis.Prim(PrimitiveType.Cube, root, new Vector3(0f, 7f, HalfZ + 2f), new Vector3(HalfX * 2f + 8f, 14f, 4f), rock, true);
        Vis.Prim(PrimitiveType.Cube, root, new Vector3(0f, 7f, -HalfZ - 2f), new Vector3(HalfX * 2f + 8f, 14f, 4f), rock, true);
        Vis.Prim(PrimitiveType.Cube, root, new Vector3(HalfX + 2f, 7f, 0f), new Vector3(4f, 14f, HalfZ * 2f + 8f), rock, true);
        Vis.Prim(PrimitiveType.Cube, root, new Vector3(-HalfX - 2f, 7f, 0f), new Vector3(4f, 14f, HalfZ * 2f + 8f), rock, true);

        // River across the middle (cosmetic)
        Vis.Prim(PrimitiveType.Cube, root, new Vector3(0f, 0.03f, 0f), new Vector3(HalfX * 2f, 0.06f, 14f), new Color(0.2f, 0.4f, 0.65f), false);

        // Lane strips (cosmetic)
        foreach (var lane in Lanes)
        {
            for (int i = 1; i < lane.pts.Count; i++)
            {
                Vector3 a = lane.pts[i - 1], b = lane.pts[i];
                var seg = Vis.Prim(PrimitiveType.Cube, root, (a + b) * 0.5f + Vector3.up * 0.06f,
                    new Vector3(16f, 0.1f, Vector3.Distance(a, b) + 2f), laneCol, false);
                seg.transform.rotation = Quaternion.LookRotation(b - a);
            }
        }

        // Bases
        for (int team = 0; team < 2; team++)
        {
            float sign = team == 0 ? -1f : 1f;
            Color tint = team == 0 ? new Color(0.18f, 0.28f, 0.50f) : new Color(0.50f, 0.20f, 0.18f);
            Vis.Prim(PrimitiveType.Cube, root, new Vector3(0f, 0.04f, sign * 227f), new Vector3(130f, 0.08f, 76f), tint, false);
            Vis.Prim(PrimitiveType.Cylinder, root, Spawn(team) + Vector3.down * 0.05f, new Vector3(26f, 0.05f, 26f), new Color(0.4f, 0.9f, 0.9f), false);
        }

        BuildJungle(root, rock);
        BuildStructures(root);
        SetupLighting();
    }

    static void BuildLanes()
    {
        Lanes[0] = new Lane { pts = { P(0, -200), P(0, -130), P(0, -65), P(0, 0), P(0, 65), P(0, 130), P(0, 200) } };
        for (int i = 0; i < 2; i++)
        {
            float s = i == 0 ? -1f : 1f;
            Lanes[i + 1] = new Lane
            {
                pts = { P(s * 25, -195), P(s * 90, -150), P(s * 130, -80), P(s * 130, 0), P(s * 130, 80), P(s * 90, 150), P(s * 25, 195) }
            };
        }
    }

    static void BuildJungle(Transform root, Color rockCol)
    {
        var rng = new System.Random(1337);
        int placed = 0, tries = 0;
        while (placed < 150 && tries < 4000)
        {
            tries++;
            float x = (float)(rng.NextDouble() * 2.0 - 1.0) * (HalfX - 10f);
            float z = (float)(rng.NextDouble() * 2.0 - 1.0) * (HalfZ - 10f);
            Vector3 p = P(x, z);
            if (Mathf.Abs(z) < 12f) continue;                        // keep the river clear
            if (Mathf.Abs(z) > 185f && Mathf.Abs(x) < 75f) continue; // keep the bases clear
            if (DistToLanes(p) < 20f) continue;                      // keep lanes clear

            if (rng.NextDouble() < 0.35)
            {
                float w = 3f + (float)rng.NextDouble() * 6f;
                float h = 3f + (float)rng.NextDouble() * 7f;
                var r = Vis.Prim(PrimitiveType.Cube, root, p + Vector3.up * (h * 0.5f), new Vector3(w, h, w * (0.6f + (float)rng.NextDouble() * 0.8f)), rockCol, true);
                r.transform.rotation = Quaternion.Euler(0f, (float)rng.NextDouble() * 360f, 0f);
            }
            else
            {
                float h = 7f + (float)rng.NextDouble() * 5f;
                Vis.Prim(PrimitiveType.Cylinder, root, p + Vector3.up * (h * 0.5f), new Vector3(1.2f, h * 0.5f, 1.2f), new Color(0.35f, 0.25f, 0.15f), true);
                Vis.Prim(PrimitiveType.Sphere, root, p + Vector3.up * (h + 1.5f), Vector3.one * (5f + (float)rng.NextDouble() * 2f), new Color(0.12f, 0.38f + (float)rng.NextDouble() * 0.15f, 0.15f), false);
            }
            placed++;
        }
    }

    static void BuildStructures(Transform root)
    {
        for (int team = 0; team < 2; team++)
        {
            var inners = new List<Tower>();
            var guards = new List<Tower>();
            float sign = team == 0 ? -1f : 1f;

            for (int l = 0; l < 3; l++)
            {
                float tOuter = team == 0 ? 0.30f : 0.70f;
                float tInner = team == 0 ? 0.15f : 0.85f;
                var outer = Tower.Create(team, Lanes[l].PointAt(tOuter), 2600f, null, root);
                var inner = Tower.Create(team, Lanes[l].PointAt(tInner), 3000f, () => !Down(outer), root);
                inners.Add(inner);
            }

            // Guard towers beside the core: protected until at least one lane's inner tower has fallen.
            for (int g = 0; g < 2; g++)
            {
                float x = g == 0 ? -16f : 16f;
                guards.Add(Tower.Create(team, P(x, sign * 205f), 3200f, () => !AnyDown(inners), root));
            }

            BuildCore(team, root, () => AnyAlive(guards));
        }
    }

    static void BuildCore(int team, Transform root, System.Func<bool> shield)
    {
        var go = new GameObject("Core");
        go.transform.SetParent(root, false);
        go.transform.position = CorePos(team);

        var u = go.AddComponent<Unit>();
        u.team = team;
        u.kind = UnitKind.Core;
        u.displayName = "Core";
        u.maxHealth = u.health = 6000f;
        u.armor = 0.2f;
        u.height = 10f;
        u.radius = 6f;
        u.shield = shield;

        Color c = team == 0 ? new Color(0.25f, 0.55f, 1f) : new Color(1f, 0.3f, 0.25f);
        Vis.Prim(PrimitiveType.Cylinder, go.transform, new Vector3(0f, 1.5f, 0f), new Vector3(12f, 1.5f, 12f), new Color(0.35f, 0.35f, 0.4f), true);
        Vis.Prim(PrimitiveType.Sphere, go.transform, new Vector3(0f, 6f, 0f), Vector3.one * 7f, c, false);
        u.Died += (v, k) => Vis.Flash(go.transform.position + Vector3.up * 6f, 14f, c, 0.6f);
    }

    static void SetupLighting()
    {
        var light = Object.FindFirstObjectByType<Light>();
        if (light == null)
        {
            var go = new GameObject("Sun");
            light = go.AddComponent<Light>();
            light.type = LightType.Directional;
        }
        light.transform.rotation = Quaternion.Euler(50f, -30f, 0f);
        light.intensity = 1.1f;
        light.shadows = LightShadows.Soft;
        RenderSettings.ambientMode = AmbientMode.Flat;
        RenderSettings.ambientLight = new Color(0.50f, 0.54f, 0.60f);
    }
}
