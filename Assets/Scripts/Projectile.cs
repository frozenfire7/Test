using UnityEngine;

public class Projectile : MonoBehaviour
{
    static readonly RaycastHit[] buf = new RaycastHit[16];

    public Unit owner;
    public Vector3 velocity;
    public float damage;
    public float splash;
    public float radius = 0.35f;
    public float maxDist = 80f;
    public Color color = Color.white;
    float travelled;

    public static Projectile Spawn(Unit owner, Vector3 pos, Vector3 velocity, float damage, float splash,
        Color color, float size, float maxDist)
    {
        var go = Vis.Prim(PrimitiveType.Sphere, GameManager.WorldRoot, pos, Vector3.one * size, color, false);
        var p = go.AddComponent<Projectile>();
        p.owner = owner;
        p.velocity = velocity;
        p.damage = damage;
        p.splash = splash;
        p.radius = size * 0.5f;
        p.color = color;
        p.maxDist = maxDist;
        return p;
    }

    void Update()
    {
        if (owner == null) { Destroy(gameObject); return; }

        Vector3 step = velocity * Time.deltaTime;
        float len = step.magnitude;
        if (len > 0f)
        {
            int n = Physics.SphereCastNonAlloc(transform.position, radius, step / len, buf, len, ~0,
                QueryTriggerInteraction.Ignore);
            float best = float.MaxValue;
            int bi = -1;
            for (int i = 0; i < n; i++)
            {
                var h = buf[i];
                var u = h.collider.GetComponentInParent<Unit>();
                if (u != null && (u == owner || u.team == owner.team || u.IsDead)) continue;
                if (h.distance < best) { best = h.distance; bi = i; }
            }
            if (bi >= 0)
            {
                Explode(buf[bi].point, buf[bi].collider.GetComponentInParent<Unit>());
                return;
            }
        }

        transform.position += step;
        travelled += len;
        if (travelled >= maxDist || transform.position.y < -1f) Explode(transform.position, null);
    }

    void Explode(Vector3 p, Unit direct)
    {
        if (splash > 0f)
        {
            Combat.Splash(owner, p, splash, damage);
            Vis.Flash(p, splash * 0.6f, color);
        }
        else
        {
            if (direct != null) Combat.Damage(owner, direct, damage);
            Vis.Flash(p, 0.4f, color);
        }
        Destroy(gameObject);
    }
}
