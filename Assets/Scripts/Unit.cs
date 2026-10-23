using System;
using System.Collections.Generic;
using UnityEngine;

public enum UnitKind { Hero, Minion, Tower, Core }

// Anything that has health and a team: heroes, minions, towers and cores.
public class Unit : MonoBehaviour
{
    public static readonly List<Unit> All = new List<Unit>();
    public static event Action<Unit, Unit> AnyDied; // victim, killer

    public int team;
    public UnitKind kind;
    public string displayName = "Unit";
    public float maxHealth = 100f;
    public float health = 100f;
    public float armor;                 // fraction of damage ignored, 0..0.75
    public float damageTakenMult = 1f;  // temporary effects (barrier)
    public float height = 2f;
    public float radius = 0.5f;
    public Func<bool> shield;           // returns true while this unit cannot be damaged

    public event Action<Unit, Unit> Died;

    public bool IsDead { get; private set; }
    public bool Protected => shield != null && shield();
    public Vector3 AimPoint => transform.position + Vector3.up * height * 0.6f;

    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
    static void ResetStatics()
    {
        All.Clear();
        AnyDied = null;
    }

    void OnEnable() { All.Add(this); }
    void OnDisable() { All.Remove(this); }

    // Planar distance to the unit's surface.
    public float DistanceTo(Vector3 p)
    {
        Vector3 d = transform.position - p;
        d.y = 0f;
        return Mathf.Max(0f, d.magnitude - radius);
    }

    public float TakeDamage(float amount, Unit attacker)
    {
        if (IsDead || amount <= 0f || Protected) return 0f;
        amount *= (1f - Mathf.Clamp(armor, 0f, 0.75f)) * damageTakenMult;
        float dealt = Mathf.Min(amount, health);
        health -= amount;
        if (health <= 0f)
        {
            health = 0f;
            IsDead = true;
            Died?.Invoke(this, attacker);
            AnyDied?.Invoke(this, attacker);
            if (kind != UnitKind.Hero) Destroy(gameObject, 0.05f);
        }
        return dealt;
    }

    public void Heal(float amount)
    {
        if (!IsDead) health = Mathf.Min(maxHealth, health + amount);
    }

    public void Revive()
    {
        IsDead = false;
        health = maxHealth;
    }

    public static Unit Nearest(Vector3 pos, int team, float range, Func<Unit, bool> filter = null)
    {
        Unit best = null;
        float bestD = range;
        for (int i = 0; i < All.Count; i++)
        {
            var u = All[i];
            if (u == null || u.IsDead || u.team == team) continue;
            if (filter != null && !filter(u)) continue;
            float d = u.DistanceTo(pos);
            if (d < bestD) { bestD = d; best = u; }
        }
        return best;
    }
}
