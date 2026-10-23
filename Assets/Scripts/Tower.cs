using System;
using UnityEngine;

public class Tower : MonoBehaviour
{
    public Unit unit;
    const float Range = 30f;
    const float Interval = 1.3f;
    const float DmgMinion = 120f;
    const float DmgHero = 110f;
    float timer;
    Vector3 top;

    public static Tower Create(int team, Vector3 pos, float hp, Func<bool> shield, Transform parent)
    {
        var go = new GameObject("Tower");
        go.transform.SetParent(parent, false);
        go.transform.position = pos;

        var u = go.AddComponent<Unit>();
        u.team = team;
        u.kind = UnitKind.Tower;
        u.displayName = "Tower";
        u.maxHealth = u.health = hp;
        u.armor = 0.3f;
        u.height = 9f;
        u.radius = 2.5f;
        u.shield = shield;

        Color c = team == 0 ? new Color(0.25f, 0.5f, 0.95f) : new Color(0.9f, 0.3f, 0.25f);
        Color stone = new Color(0.45f, 0.45f, 0.5f);
        Vis.Prim(PrimitiveType.Cylinder, go.transform, new Vector3(0f, 0.75f, 0f), new Vector3(5f, 0.75f, 5f), stone, false);
        Vis.Prim(PrimitiveType.Cylinder, go.transform, new Vector3(0f, 4f, 0f), new Vector3(2.4f, 3.5f, 2.4f), stone, true);
        Vis.Prim(PrimitiveType.Sphere, go.transform, new Vector3(0f, 8.2f, 0f), Vector3.one * 2.2f, c, false);

        var t = go.AddComponent<Tower>();
        t.unit = u;
        t.top = pos + Vector3.up * 8.2f;
        u.Died += (v, k) => Vis.Flash(t.top, 6f, new Color(1f, 0.6f, 0.2f), 0.4f);
        return t;
    }

    void Update()
    {
        if (unit.IsDead || GameManager.Instance.State != GameState.Playing) return;
        timer -= Time.deltaTime;
        if (timer > 0f) return;

        Vector3 pos = transform.position;
        var t = Unit.Nearest(pos, unit.team, Range, e => e.kind == UnitKind.Minion);
        if (t == null) t = Unit.Nearest(pos, unit.team, Range, e => e.kind == UnitKind.Hero);
        if (t == null) return;

        timer = Interval;
        Vis.Tracer(top, t.AimPoint, new Color(1f, 0.6f, 0.2f), 0.3f, 0.12f);
        Combat.Damage(unit, t, t.kind == UnitKind.Hero ? DmgHero : DmgMinion);
    }
}
