using System.Collections.Generic;
using UnityEngine;

// Simple lane-pushing AI: walks its lane, fights what is in range, retreats when hurt,
// shops at the fountain and avoids diving towers without minion support.
public class BotController : MonoBehaviour
{
    Hero hero;
    List<Vector3> path;
    int idx;
    bool retreating, wasDead, holdBack;
    Unit target;
    Hero targetHero;
    float thinkTimer, strafeSign = 1f;
    Vector3 jitter;

    public void Init(Hero h, int lane)
    {
        hero = h;
        path = MapBuilder.Lanes[lane].PathFor(h.unit.team);
        thinkTimer = Random.value * 0.3f;
    }

    static Vector3 Flat(Vector3 v)
    {
        v.y = 0f;
        return v;
    }

    void Update()
    {
        if (hero == null) return;
        if (hero.unit.IsDead)
        {
            wasDead = true;
            hero.wishMove = Vector3.zero;
            return;
        }
        if (wasDead)
        {
            wasDead = false;
            idx = 0;
            retreating = false;
            target = null;
        }
        if (GameManager.Instance.State != GameState.Playing)
        {
            hero.wishMove = Vector3.zero;
            return;
        }

        thinkTimer -= Time.deltaTime;
        if (thinkTimer <= 0f)
        {
            thinkTimer = 0.2f + Random.value * 0.1f;
            Think();
        }
        Act();
    }

    int NearestIdx(Vector3 pos)
    {
        int best = 0;
        float bd = float.MaxValue;
        for (int i = 0; i < path.Count - 1; i++)
        {
            float d = Flat(path[i] - pos).sqrMagnitude;
            if (d < bd) { bd = d; best = i; }
        }
        return best;
    }

    int CountNear(Vector3 pos, float range, UnitKind kind, int team)
    {
        int n = 0;
        for (int i = 0; i < Unit.All.Count; i++)
        {
            var u = Unit.All[i];
            if (u == null || u.IsDead || u.team != team || u.kind != kind) continue;
            if (u.DistanceTo(pos) <= range) n++;
        }
        return n;
    }

    void Think()
    {
        var u = hero.unit;
        Vector3 pos = hero.transform.position;
        float hpFrac = u.health / u.maxHealth;

        if (!retreating && hpFrac < 0.30f) retreating = true;
        else if (retreating && hpFrac > 0.85f) retreating = false;

        if (hero.InBase) TryShop();

        int minions = CountNear(pos, 22f, UnitKind.Minion, u.team);
        int heroes = CountNear(pos, 25f, UnitKind.Hero, u.team);
        bool safe = minions > 0 || heroes >= 3;

        float range = Mathf.Min(hero.def.weapon.range, 45f);
        target = Unit.Nearest(pos, u.team, range, e => e.kind == UnitKind.Hero);
        if (target == null) target = Unit.Nearest(pos, u.team, range, e => !e.Protected && (e.kind == UnitKind.Minion || safe));
        targetHero = target != null ? target.GetComponent<Hero>() : null;

        var tower = Unit.Nearest(pos, u.team, 36f, e => e.kind == UnitKind.Tower);
        holdBack = !safe && tower != null;

        if (Random.value < 0.15f) strafeSign = -strafeSign;
        jitter = Random.insideUnitSphere * 0.8f;

        UseAbilities(hpFrac, pos);
    }

    void TryShop()
    {
        if (hero.gold < 400) return;
        int start = Random.Range(0, Items.All.Length);
        for (int k = 0; k < Items.All.Length; k++)
        {
            int i = (start + k) % Items.All.Length;
            if (hero.Buy(i)) return;
        }
    }

    void UseAbilities(float hpFrac, Vector3 pos)
    {
        for (int s = 0; s < 2; s++)
        {
            if (hero.cd[s] > 0f) continue;
            var a = hero.def.abilities[s];
            float d = target != null ? target.DistanceTo(pos) : 999f;
            bool cast = false;

            switch (a.kind)
            {
                case AbilityKind.Slam:
                    cast = target != null && d < a.radius * 0.85f;
                    break;
                case AbilityKind.Grenade:
                    cast = target != null && targetHero != null && d < 38f;
                    break;
                case AbilityKind.Overcharge:
                case AbilityKind.Overdrive:
                    cast = targetHero != null && d < hero.def.weapon.range * 0.8f;
                    break;
                case AbilityKind.Barrier:
                    cast = targetHero != null && hpFrac < 0.75f;
                    break;
                case AbilityKind.HealPulse:
                    cast = AlliesNeedHeal(pos, a.radius);
                    break;
                case AbilityKind.Dash:
                case AbilityKind.Blink:
                    cast = retreating && target != null;
                    break;
                case AbilityKind.SpeedBoost:
                    cast = retreating;
                    break;
            }
            if (cast) hero.TryCast(s);
        }
    }

    bool AlliesNeedHeal(Vector3 pos, float radius)
    {
        for (int i = 0; i < Unit.All.Count; i++)
        {
            var u = Unit.All[i];
            if (u == null || u.IsDead || u.team != hero.unit.team || u.kind != UnitKind.Hero) continue;
            if (u.DistanceTo(pos) <= radius && u.health < u.maxHealth * 0.7f) return true;
        }
        return false;
    }

    void Act()
    {
        Vector3 pos = hero.transform.position;
        Vector3 move = Vector3.zero;
        Vector3 face = Vector3.zero;
        bool targetValid = target != null && !target.IsDead;

        if (retreating)
        {
            int ni = NearestIdx(pos);
            Vector3 goal = ni <= 0 ? hero.spawnPoint : path[ni - 1];
            if (ni <= 0 && Flat(hero.spawnPoint - pos).magnitude < 3f) goal = pos;
            move = Flat(goal - pos).normalized;
            face = move;
        }
        else if (targetValid)
        {
            Vector3 to = Flat(target.transform.position - pos);
            float d = to.magnitude;
            Vector3 dir = d > 0.01f ? to / d : Vector3.forward;
            float want = Mathf.Clamp(hero.def.weapon.range * 0.55f, 7f, 28f);
            if (d > want + 3f) move = dir;
            else if (d < want * 0.5f) move = -dir;
            move += Vector3.Cross(Vector3.up, dir) * strafeSign * 0.6f;
            face = dir;
        }
        else if (!holdBack)
        {
            idx = NearestIdx(pos);
            if (Flat(path[idx] - pos).magnitude < 8f && idx < path.Count - 1) idx++;
            move = Flat(path[idx] - pos).normalized;
            face = move;
        }

        hero.wishMove = move.sqrMagnitude > 0.01f ? move.normalized : Vector3.zero;
        if (face.sqrMagnitude > 0.01f)
        {
            float want = Mathf.Atan2(face.x, face.z) * Mathf.Rad2Deg;
            hero.yaw = Mathf.LerpAngle(hero.yaw, want, Time.deltaTime * 12f);
        }

        // Aim and shoot
        hero.aimOrigin = pos + Vector3.up * 1.6f;
        if (targetValid)
        {
            var w = hero.def.weapon;
            Vector3 aimPoint = target.AimPoint;
            float dist = Vector3.Distance(hero.aimOrigin, aimPoint);
            if (w.projectile && targetHero != null) aimPoint += targetHero.velocity * (dist / w.projSpeed);
            aimPoint += jitter * Mathf.Clamp(dist / 20f, 0.3f, 2f);
            hero.aimDir = (aimPoint - hero.aimOrigin).normalized;
            if (dist <= w.range) hero.TryFire();
        }
        else if (face.sqrMagnitude > 0.01f)
        {
            hero.aimDir = face.normalized;
        }
    }
}
