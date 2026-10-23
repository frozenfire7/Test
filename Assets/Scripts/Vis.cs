using System.Collections.Generic;
using UnityEngine;

// Procedural visuals: everything in the game is built from primitives so no art assets are needed.
public static class Vis
{
    static Material template;
    static readonly Dictionary<Color, Material> mats = new Dictionary<Color, Material>();
    static readonly Dictionary<Color, Material> lineMats = new Dictionary<Color, Material>();

    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
    static void ResetStatics()
    {
        template = null;
        mats.Clear();
        lineMats.Clear();
    }

    static Material Template()
    {
        if (template == null)
        {
            var p = GameObject.CreatePrimitive(PrimitiveType.Cube);
            template = p.GetComponent<Renderer>().sharedMaterial;
            Object.Destroy(p);
        }
        return template;
    }

    public static Material Mat(Color c)
    {
        if (!mats.TryGetValue(c, out var m) || m == null)
        {
            m = new Material(Template());
            m.color = c;
            mats[c] = m;
        }
        return m;
    }

    static Material LineMat(Color c)
    {
        if (!lineMats.TryGetValue(c, out var m) || m == null)
        {
            var sh = Shader.Find("Sprites/Default");
            m = sh != null ? new Material(sh) : new Material(Template());
            m.color = c;
            lineMats[c] = m;
        }
        return m;
    }

    public static GameObject Prim(PrimitiveType type, Transform parent, Vector3 localPos, Vector3 scale, Color c, bool collider)
    {
        var go = GameObject.CreatePrimitive(type);
        go.transform.SetParent(parent, false);
        go.transform.localPosition = localPos;
        go.transform.localScale = scale;
        go.GetComponent<Renderer>().sharedMaterial = Mat(c);
        if (!collider)
        {
            var col = go.GetComponent<Collider>();
            if (col != null) Object.DestroyImmediate(col);
        }
        return go;
    }

    public static void Tracer(Vector3 a, Vector3 b, Color c, float width = 0.06f, float life = 0.07f)
    {
        var go = new GameObject("Tracer");
        if (GameManager.WorldRoot != null) go.transform.SetParent(GameManager.WorldRoot, false);
        var lr = go.AddComponent<LineRenderer>();
        lr.positionCount = 2;
        lr.SetPosition(0, a);
        lr.SetPosition(1, b);
        lr.startWidth = lr.endWidth = width;
        lr.sharedMaterial = LineMat(c);
        lr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
        lr.receiveShadows = false;
        Object.Destroy(go, life);
    }

    public static void Flash(Vector3 pos, float radius, Color c, float life = 0.18f)
    {
        var go = Prim(PrimitiveType.Sphere, GameManager.WorldRoot, pos, Vector3.one * radius * 2f, c, false);
        Object.Destroy(go, life);
    }

    public static void Ring(Vector3 pos, float radius, Color c, float life = 0.3f)
    {
        var go = Prim(PrimitiveType.Cylinder, GameManager.WorldRoot, pos + Vector3.up * 0.1f,
            new Vector3(radius * 2f, 0.05f, radius * 2f), c, false);
        Object.Destroy(go, life);
    }
}
