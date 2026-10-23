using System.Collections.Generic;
using UnityEngine;

public class Minion : MonoBehaviour
{
    public Unit unit;
    List<Vector3> path;
    int idx;
    bool ranged;
    float dmg, range, interval, atkTimer, scanTimer;
    const float Speed = 6f;
    Unit target;

    public static Minion Create(int team, List<Vector3> lanePath, bool ranged, float scale, Transform parent)
    {
        var go = new GameObject(ranged ? "RangedMinion" : "Minion");
        go.transform.SetParent(parent, false);

        // Small lateral offset so a wave doesn't stack on one line.
        Vector3 off = new Vector3(Random.Range(-3f, 3f), 0f, Random.Range(-1.5f, 1.5f));
        var p = new List<Vector3>(lanePath.Count);
        foreach (var v in lanePath) p.Add(v + off);
        go.transform.position = p[0];

        var u = go.AddComponent<Unit>();
        u.team = team;
        u.kind = UnitKind.Minion;
        u.displayName = "Minion";
        u.maxHealth = u.health = (ranged ? 220f : 320f) * scale;
        u.height = 1.4f;
        u.radius = 0.6f;

        var rb = go.AddComponent<Rigidbody>();
        rb.isKinematic = true;

        Color c = team == 0 ? new Color(0.3f, 0.6f, 1f) : new Color(1f, 0.35f, 0.3f);
        Vis.Prim(PrimitiveType.Capsule, go.transform, new Vector3(0f, 0.6f, 0f), new Vector3(0.8f, 0.6f, 0.8f), c, true);
        if (ranged) Vis.Prim(PrimitiveType.Sphere, go.transform, new Vector3(0f, 1.45f, 0f), Vector3.one * 0.5f, new Color(0.9f, 0.9f, 0.3f), false);

        var m = go.AddComponent<Minion>();
        m.unit = u;
        m.path = p;
        m.ranged = ranged;
        m.dmg = (ranged ? 12f : 16f) * scale;
        m.range = ranged ? 12f : 2.5f;
        m.interval = ranged ? 1.1f : 0.9f;
        m.scanTimer = Random.value * 0.3f;
        return m;
    }

    void Update()
    {
        if (unit.IsDead || GameManager.Instance.State != GameState.Playing) return;
        float dt = Time.deltaTime;
        atkTimer -= dt;
        scanTimer -= dt;
        Vector3 pos = transform.position;

        if (scanTimer <= 0f)
        {
            scanTimer = 0.3f;
            target = Unit.Nearest(pos, unit.team, 16f, e => !e.Protected);
        }
        if (target != null && target.IsDead) target = null;

        Vector3 move = Vector3.zero;
        if (target != null)
        {
            Vector3 to = target.transform.position - pos;
            to.y = 0f;
            float d = target.DistanceTo(pos);
            if (to.sqrMagnitude > 0.01f) transform.rotation = Quaternion.LookRotation(to);
            if (d <= range)
            {
                if (atkTimer <= 0f)
                {
                    atkTimer = interval;
                    if (ranged) Vis.Tracer(pos + Vector3.up * 1.2f, target.AimPoint, new Color(1f, 0.9f, 0.4f), 0.05f, 0.08f);
                    Combat.Damage(unit, target, dmg);
                }
            }
            else move = to.normalized;
        }
        else if (idx < path.Count)
        {
            Vector3 to = path[idx] - pos;
            to.y = 0f;
            if (to.magnitude < 2f) idx++;
            else
            {
                move = to.normalized;
                transform.rotation = Quaternion.LookRotation(move);
            }
        }

        if (move != Vector3.zero) transform.position += move * Speed * dt;
    }
}
