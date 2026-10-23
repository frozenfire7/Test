using UnityEngine;

public class ItemDef
{
    public string name;
    public string desc;
    public int cost;
    public System.Action<Hero> apply;
}

public static class Items
{
    public const int MaxStacks = 3;

    public static readonly ItemDef[] All =
    {
        new ItemDef { name = "Vitality Core",   desc = "+150 max health",        cost = 500, apply = h => h.bonusHp += 150f },
        new ItemDef { name = "Heavy Rounds",    desc = "+15% weapon & ability damage", cost = 600, apply = h => h.dmgMult += 0.15f },
        new ItemDef { name = "Quickdraw",       desc = "+20% fire rate",         cost = 600, apply = h => h.rateMult += 0.2f },
        new ItemDef { name = "Sprint Boots",    desc = "+1 move speed",          cost = 400, apply = h => h.bonusSpeed += 1f },
        new ItemDef { name = "Plating",         desc = "+10% damage reduction",  cost = 700, apply = h => h.bonusArmor += 0.1f },
        new ItemDef { name = "Cooldown Coil",   desc = "-12% ability cooldowns", cost = 500, apply = h => h.cdr = Mathf.Min(0.4f, h.cdr + 0.12f) },
        new ItemDef { name = "Vampiric Rounds", desc = "10% lifesteal",          cost = 800, apply = h => h.lifesteal += 0.1f },
    };
}

[RequireComponent(typeof(Unit))]
public class Hero : MonoBehaviour
{
    public const int MaxLevel = 15;

    public CharacterDef def;
    public Unit unit;
    public CharacterController cc;
    public Transform model;
    public bool isPlayer;
    public Vector3 spawnPoint;

    // Set each frame by PlayerController / BotController.
    public Vector3 wishMove;
    public bool wishJump;
    public float yaw;
    public Vector3 aimOrigin;
    public Vector3 aimDir = Vector3.forward;
    public Vector3 velocity;

    // Progression
    public int level = 1, xp, gold = 600, kills, deaths;
    public float lifesteal, dmgMult = 1f, rateMult = 1f, cdr, bonusSpeed, bonusArmor, bonusHp;
    public int[] itemCounts = new int[Items.All.Length];

    public float[] cd = new float[2];
    public float respawnTimer;

    float fireTimer, barrierTimer, barrierMult = 1f, speedTimer, speedMult = 1f;
    float overdriveTimer, overdriveMult = 1f, overchargeTimer, overcharge = 1f;
    float dashTimer, vy, goldAcc;
    Vector3 dashVel;

    public float LevelDmg => 1f + 0.06f * (level - 1);
    public bool IsOvercharged => overcharge > 1f;
    public Vector3 Muzzle => model.TransformPoint(new Vector3(0.4f, 1.25f, 1.0f));
    public static int XpFor(int lvl) { return 120 + 60 * lvl; }

    public bool InBase
    {
        get
        {
            Vector3 d = spawnPoint - transform.position;
            d.y = 0f;
            return d.magnitude < 26f;
        }
    }

    public static Hero Create(CharacterDef def, int team, bool player, Vector3 spawn, Transform parent)
    {
        var go = new GameObject((player ? "Player_" : "Hero_") + def.name);
        go.transform.SetParent(parent, false);
        go.transform.position = spawn;

        var u = go.AddComponent<Unit>();
        u.team = team;
        u.kind = UnitKind.Hero;
        u.displayName = def.name;
        u.height = 2.4f;
        u.radius = 0.6f;

        var cc = go.AddComponent<CharacterController>();
        cc.height = 2f;
        cc.radius = 0.45f;
        cc.center = new Vector3(0f, 1f, 0f);
        cc.stepOffset = 0.4f;

        var h = go.AddComponent<Hero>();
        h.def = def;
        h.unit = u;
        h.cc = cc;
        h.isPlayer = player;
        h.spawnPoint = spawn;
        h.yaw = team == 0 ? 0f : 180f;
        h.BuildModel(team);
        h.RecalcStats(true);
        u.Died += h.OnDied;
        return h;
    }

    void BuildModel(int team)
    {
        var root = new GameObject("Model");
        root.transform.SetParent(transform, false);
        model = root.transform;
        Color teamCol = team == 0 ? new Color(0.25f, 0.55f, 1f) : new Color(1f, 0.3f, 0.25f);
        Vis.Prim(PrimitiveType.Capsule, model, new Vector3(0f, 1f, 0f), new Vector3(0.9f, 1f, 0.9f), def.color, false);
        Vis.Prim(PrimitiveType.Sphere, model, new Vector3(0f, 2.15f, 0f), Vector3.one * 0.5f, teamCol, false);
        Vis.Prim(PrimitiveType.Cylinder, model, new Vector3(0f, 1.15f, 0f), new Vector3(1.0f, 0.07f, 1.0f), teamCol, false);
        Vis.Prim(PrimitiveType.Cube, model, new Vector3(0.4f, 1.2f, 0.5f), new Vector3(0.18f, 0.18f, 0.9f), new Color(0.15f, 0.15f, 0.17f), false);
    }

    public void RecalcStats(bool full)
    {
        float ratio = unit.maxHealth > 0f ? unit.health / unit.maxHealth : 1f;
        unit.maxHealth = def.health * (1f + 0.08f * (level - 1)) + bonusHp;
        unit.armor = Mathf.Clamp(def.armor + bonusArmor, 0f, 0.75f);
        if (full) unit.health = unit.maxHealth;
        else if (!unit.IsDead) unit.health = Mathf.Max(1f, unit.maxHealth * ratio);
    }

    public void AddXp(int amount)
    {
        if (level >= MaxLevel) return;
        xp += amount;
        while (level < MaxLevel && xp >= XpFor(level))
        {
            xp -= XpFor(level);
            level++;
            RecalcStats(false);
        }
    }

    public bool Buy(int index)
    {
        var it = Items.All[index];
        if (itemCounts[index] >= Items.MaxStacks || gold < it.cost) return false;
        gold -= it.cost;
        itemCounts[index]++;
        it.apply(this);
        RecalcStats(false);
        return true;
    }

    void Update()
    {
        float dt = Time.deltaTime;
        if (unit.IsDead)
        {
            respawnTimer -= dt;
            if (respawnTimer <= 0f) Respawn();
            return;
        }

        fireTimer -= dt;
        for (int i = 0; i < cd.Length; i++) cd[i] = Mathf.Max(0f, cd[i] - dt);
        barrierTimer -= dt;
        speedTimer -= dt;
        overdriveTimer -= dt;
        dashTimer -= dt;
        overchargeTimer -= dt;
        if (overchargeTimer <= 0f) overcharge = 1f;
        unit.damageTakenMult = barrierTimer > 0f ? barrierMult : 1f;

        goldAcc += 5f * dt;
        if (goldAcc >= 1f) { int g = Mathf.FloorToInt(goldAcc); gold += g; goldAcc -= g; }
        if (InBase) unit.Heal(unit.maxHealth * 0.12f * dt);

        Move(dt);
        model.rotation = Quaternion.Euler(0f, yaw, 0f);
    }

    void Move(float dt)
    {
        float speed = def.speed + bonusSpeed;
        if (speedTimer > 0f) speed *= speedMult;
        Vector3 horiz = Vector3.ClampMagnitude(wishMove, 1f) * speed;
        if (dashTimer > 0f) horiz += dashVel;

        if (cc.isGrounded && vy < 0f) vy = -2f;
        if (wishJump && cc.isGrounded) vy = 7.5f;
        wishJump = false;
        vy -= 20f * dt;

        velocity = horiz;
        cc.Move((horiz + Vector3.up * vy) * dt);

        if (transform.position.y < -10f) Teleport(spawnPoint);
    }

    void Teleport(Vector3 pos)
    {
        cc.enabled = false;
        transform.position = pos;
        cc.enabled = true;
        vy = 0f;
    }

    void OnDied(Unit victim, Unit killer)
    {
        deaths++;
        respawnTimer = 6f + level * 1.5f;
        barrierTimer = speedTimer = overdriveTimer = dashTimer = 0f;
        overcharge = 1f;
        wishMove = Vector3.zero;
        model.gameObject.SetActive(false);
        cc.enabled = false;
    }

    void Respawn()
    {
        cc.enabled = false;
        transform.position = spawnPoint;
        cc.enabled = true;
        vy = 0f;
        unit.Revive();
        model.gameObject.SetActive(true);
        fireTimer = 0f;
        cd[0] = cd[1] = 0f;
    }

    static Vector3 Flat(Vector3 v)
    {
        v.y = 0f;
        return v.sqrMagnitude > 0.0001f ? v.normalized : Vector3.zero;
    }

    static Vector3 Spread(Vector3 dir, float deg)
    {
        if (deg <= 0f) return dir;
        Vector2 r = Random.insideUnitCircle * Mathf.Tan(deg * Mathf.Deg2Rad);
        return (Quaternion.LookRotation(dir) * new Vector3(r.x, r.y, 1f)).normalized;
    }

    // Where the crosshair is pointing (terrain or enemy), used to aim projectiles from the muzzle.
    Vector3 AimTarget(float range)
    {
        Combat.Raycast(aimOrigin, aimDir, range, unit, false, out var p, out var _);
        return p;
    }

    public bool TryFire()
    {
        if (unit.IsDead || fireTimer > 0f) return false;
        var w = def.weapon;
        float rate = w.rate * rateMult * (overdriveTimer > 0f ? overdriveMult : 1f);
        fireTimer = 1f / rate;

        float dmg = w.damage * dmgMult * LevelDmg * overcharge;
        overcharge = 1f;
        overchargeTimer = 0f;

        Vector3 muzzle = Muzzle;
        if (!w.projectile)
        {
            for (int i = 0; i < w.pellets; i++)
            {
                Combat.Hitscan(unit, muzzle, aimOrigin, Spread(aimDir, w.spread), w.range, dmg,
                    w.color, w.pellets > 1 ? 0.03f : 0.06f);
            }
        }
        else
        {
            Vector3 dir = (AimTarget(w.range) - muzzle).normalized;
            Projectile.Spawn(unit, muzzle, Spread(dir, w.spread) * w.projSpeed, dmg, w.splash, w.color, w.projSize, w.range);
        }
        return true;
    }

    public bool TryCast(int slot)
    {
        if (unit.IsDead || cd[slot] > 0f) return false;
        var a = def.abilities[slot];
        Vector3 pos = transform.position;
        float dmg = a.value * dmgMult * LevelDmg;

        switch (a.kind)
        {
            case AbilityKind.Barrier:
                barrierTimer = a.duration;
                barrierMult = 1f - a.value;
                Vis.Ring(pos, 1.6f, new Color(0.6f, 0.8f, 1f), a.duration * 0.2f);
                break;

            case AbilityKind.Slam:
                Combat.Splash(unit, pos, a.radius, dmg);
                Vis.Ring(pos, a.radius, def.color);
                break;

            case AbilityKind.Grenade:
            {
                Vector3 dir = (AimTarget(60f) - Muzzle).normalized;
                Projectile.Spawn(unit, Muzzle, dir * a.speed, dmg, a.radius, def.color, 0.7f, 70f);
                break;
            }

            case AbilityKind.HealPulse:
                for (int i = 0; i < Unit.All.Count; i++)
                {
                    var u = Unit.All[i];
                    if (u == null || u.IsDead || u.team != unit.team || u.kind != UnitKind.Hero) continue;
                    if (u.DistanceTo(pos) <= a.radius) u.Heal(a.value * LevelDmg);
                }
                Vis.Ring(pos, a.radius, new Color(0.3f, 1f, 0.4f));
                break;

            case AbilityKind.SpeedBoost:
                speedTimer = a.duration;
                speedMult = a.value;
                break;

            case AbilityKind.Overcharge:
                overcharge = a.value;
                overchargeTimer = 8f;
                break;

            case AbilityKind.Overdrive:
                overdriveTimer = a.duration;
                overdriveMult = a.value;
                break;

            case AbilityKind.Dash:
            {
                Vector3 dir = Flat(wishMove);
                if (dir == Vector3.zero) dir = Flat(aimDir);
                if (dir == Vector3.zero) dir = Flat(transform.forward);
                dashVel = dir * (a.value / 0.2f);
                dashTimer = 0.2f;
                break;
            }

            case AbilityKind.Blink:
            {
                // Players blink where they aim, bots blink where they are moving.
                Vector3 dir = isPlayer ? Flat(aimDir) : Flat(wishMove);
                if (dir == Vector3.zero) dir = Flat(aimDir);
                if (dir == Vector3.zero) dir = Flat(transform.forward);
                Vector3 origin = pos + Vector3.up;
                float d = a.value;
                if (Combat.Raycast(origin, dir, d + 1f, unit, false, out var hp, out var _))
                    d = Mathf.Max(0f, Vector3.Distance(origin, hp) - 1f);
                Vis.Ring(pos, 1.5f, def.color, 0.25f);
                Teleport(pos + dir * d);
                Vis.Ring(transform.position, 1.5f, def.color, 0.25f);
                break;
            }
        }

        cd[slot] = a.cooldown * (1f - cdr);
        return true;
    }
}
