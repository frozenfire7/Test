using UnityEngine;

public enum AbilityKind { Dash, Blink, Barrier, Slam, Grenade, HealPulse, SpeedBoost, Overcharge, Overdrive }

public class AbilityDef
{
    public string name;
    public string desc;
    public AbilityKind kind;
    public float cooldown;
    public float value;     // damage / heal / distance / multiplier depending on kind
    public float radius;
    public float duration;
    public float speed;     // projectile speed (Grenade)
}

public class WeaponDef
{
    public string name;
    public bool projectile;
    public float damage;
    public float rate;      // shots per second
    public float range;
    public float spread;    // degrees
    public int pellets = 1;
    public float projSpeed;
    public float splash;
    public float projSize = 0.4f;
    public Color color = Color.white;
}

public class CharacterDef
{
    public string name;
    public string role;
    public string blurb;
    public float health;
    public float speed;
    public float armor;
    public Color color;
    public WeaponDef weapon;
    public AbilityDef[] abilities;
}

public static class Characters
{
    public static readonly CharacterDef[] All =
    {
        new CharacterDef
        {
            name = "Bulwark", role = "Tank", health = 1100, speed = 5.8f, armor = 0.15f,
            blurb = "Frontline brawler. Soaks damage and shreds anything that gets close.",
            color = new Color(0.90f, 0.55f, 0.15f),
            weapon = new WeaponDef { name = "Scattergun", damage = 9, pellets = 9, rate = 1.1f, range = 24, spread = 6, color = new Color(1f, 0.85f, 0.4f) },
            abilities = new[]
            {
                new AbilityDef { name = "Iron Wall", kind = AbilityKind.Barrier, cooldown = 14, value = 0.55f, duration = 4, desc = "Take 55% less damage for 4s." },
                new AbilityDef { name = "Ground Pound", kind = AbilityKind.Slam, cooldown = 10, value = 110, radius = 9, desc = "Slam the ground for 110 AoE damage." },
            }
        },
        new CharacterDef
        {
            name = "Hawk", role = "Sniper", health = 560, speed = 6.8f, armor = 0f,
            blurb = "Long-range marksman. One precise shot can swing a fight.",
            color = new Color(0.25f, 0.70f, 0.35f),
            weapon = new WeaponDef { name = "Longbow Rifle", damage = 80, rate = 1.0f, range = 150, spread = 0, color = new Color(0.6f, 1f, 0.6f) },
            abilities = new[]
            {
                new AbilityDef { name = "Roll", kind = AbilityKind.Dash, cooldown = 6, value = 10, desc = "Quick dash in your move direction." },
                new AbilityDef { name = "Deadeye", kind = AbilityKind.Overcharge, cooldown = 9, value = 2.5f, desc = "Next shot deals 2.5x damage." },
            }
        },
        new CharacterDef
        {
            name = "Pyra", role = "Mage", health = 580, speed = 6.6f, armor = 0f,
            blurb = "Throws fireballs and area bursts. Great at zoning out lanes.",
            color = new Color(0.85f, 0.20f, 0.35f),
            weapon = new WeaponDef { name = "Fireball", projectile = true, damage = 60, splash = 3.5f, rate = 1.5f, range = 90, projSpeed = 50, projSize = 0.6f, color = new Color(1f, 0.45f, 0.1f) },
            abilities = new[]
            {
                new AbilityDef { name = "Meteor Orb", kind = AbilityKind.Grenade, cooldown = 8, value = 150, radius = 7, speed = 30, desc = "Slow orb that explodes for 150 AoE." },
                new AbilityDef { name = "Nova", kind = AbilityKind.Slam, cooldown = 9, value = 95, radius = 8, desc = "Burst around you for 95 AoE damage." },
            }
        },
        new CharacterDef
        {
            name = "Sera", role = "Support", health = 650, speed = 6.8f, armor = 0f,
            blurb = "Keeps the team alive with burst heals and a fast-firing SMG.",
            color = new Color(0.30f, 0.80f, 0.85f),
            weapon = new WeaponDef { name = "Pulse SMG", damage = 13, rate = 8f, range = 45, spread = 2.2f, color = new Color(0.5f, 1f, 1f) },
            abilities = new[]
            {
                new AbilityDef { name = "Revitalize", kind = AbilityKind.HealPulse, cooldown = 10, value = 160, radius = 14, desc = "Heal yourself and nearby allies for 160." },
                new AbilityDef { name = "Adrenaline", kind = AbilityKind.SpeedBoost, cooldown = 12, value = 1.5f, duration = 4, desc = "50% faster movement for 4s." },
            }
        },
        new CharacterDef
        {
            name = "Shade", role = "Assassin", health = 520, speed = 7.8f, armor = 0f,
            blurb = "Fast and fragile. Blink in, delete a target, blink out.",
            color = new Color(0.55f, 0.30f, 0.80f),
            weapon = new WeaponDef { name = "Twin Pistols", damage = 26, rate = 4f, range = 50, spread = 1.5f, color = new Color(0.85f, 0.6f, 1f) },
            abilities = new[]
            {
                new AbilityDef { name = "Shadowstep", kind = AbilityKind.Blink, cooldown = 7, value = 12, desc = "Teleport 12m where you aim." },
                new AbilityDef { name = "Execute", kind = AbilityKind.Overcharge, cooldown = 8, value = 3f, desc = "Next shot deals 3x damage." },
            }
        },
        new CharacterDef
        {
            name = "Havoc", role = "Gunner", health = 760, speed = 6.3f, armor = 0.05f,
            blurb = "Sustained damage dealer with grenades and a berserk fire rate.",
            color = new Color(0.75f, 0.75f, 0.20f),
            weapon = new WeaponDef { name = "Assault Rifle", damage = 20, rate = 8.5f, range = 65, spread = 2.8f, color = new Color(1f, 0.95f, 0.5f) },
            abilities = new[]
            {
                new AbilityDef { name = "Frag Grenade", kind = AbilityKind.Grenade, cooldown = 9, value = 130, radius = 6, speed = 26, desc = "Explosive for 130 AoE damage." },
                new AbilityDef { name = "Overdrive", kind = AbilityKind.Overdrive, cooldown = 14, value = 1.8f, duration = 4.5f, desc = "Fire 80% faster for 4.5s." },
            }
        },
    };
}
