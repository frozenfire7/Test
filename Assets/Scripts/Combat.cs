using UnityEngine;

public static class Combat
{
    static readonly RaycastHit[] buf = new RaycastHit[48];

    public static float Damage(Unit attacker, Unit victim, float amount)
    {
        if (victim == null) return 0f;
        float dealt = victim.TakeDamage(amount, attacker);
        if (dealt > 0f && attacker != null)
        {
            var h = attacker.GetComponent<Hero>();
            if (h != null && h.lifesteal > 0f) attacker.Heal(dealt * h.lifesteal);
        }
        return dealt;
    }

    // Ray against the world. Units on the shooter's team (and the shooter) are ignored unless hitFriendly.
    // Returns true if anything was hit; `unit` is the Unit hit (null for terrain).
    public static bool Raycast(Vector3 origin, Vector3 dir, float range, Unit shooter, bool hitFriendly,
        out Vector3 point, out Unit unit)
    {
        int n = Physics.RaycastNonAlloc(origin, dir, buf, range, ~0, QueryTriggerInteraction.Ignore);
        float best = float.MaxValue;
        point = origin + dir * range;
        unit = null;
        bool any = false;
        for (int i = 0; i < n; i++)
        {
            var h = buf[i];
            var u = h.collider.GetComponentInParent<Unit>();
            if (u != null)
            {
                if (u == shooter || u.IsDead) continue;
                if (!hitFriendly && shooter != null && u.team == shooter.team) continue;
            }
            if (h.distance < best)
            {
                best = h.distance;
                point = h.point;
                unit = u;
                any = true;
            }
        }
        return any;
    }

    // Ray that only sees terrain/props (used for the camera).
    public static bool RaycastWorld(Vector3 origin, Vector3 dir, float range, out Vector3 point)
    {
        int n = Physics.RaycastNonAlloc(origin, dir, buf, range, ~0, QueryTriggerInteraction.Ignore);
        float best = float.MaxValue;
        point = origin + dir * range;
        bool any = false;
        for (int i = 0; i < n; i++)
        {
            var h = buf[i];
            if (h.collider.GetComponentInParent<Unit>() != null) continue;
            if (h.distance < best) { best = h.distance; point = h.point; any = true; }
        }
        return any;
    }

    public static Unit Hitscan(Unit shooter, Vector3 muzzle, Vector3 origin, Vector3 dir, float range,
        float dmg, Color tracer, float width)
    {
        Raycast(origin, dir, range, shooter, false, out var p, out var u);
        Vis.Tracer(muzzle, p, tracer, width);
        if (u != null) Damage(shooter, u, dmg);
        return u;
    }

    public static void Splash(Unit attacker, Vector3 center, float radius, float dmg)
    {
        int count = Unit.All.Count;
        for (int i = 0; i < count && i < Unit.All.Count; i++)
        {
            var u = Unit.All[i];
            if (u == null || u.IsDead || u.team == attacker.team) continue;
            float d = u.DistanceTo(center);
            if (d > radius) continue;
            Damage(attacker, u, dmg * Mathf.Lerp(1f, 0.5f, d / radius));
        }
    }
}
