using UnityEngine;

// Over-the-shoulder third-person controls for the human player.
public class PlayerController : MonoBehaviour
{
    const float CamDist = 4.4f;
    const float Sensitivity = 1.6f;

    Hero hero;
    Camera cam;
    float yaw, pitch = 10f;
    bool freeCursor;

    public Camera Cam { get { return cam; } }

    public void Init(Hero h, Camera c)
    {
        hero = h;
        cam = c;
        yaw = h.yaw;
    }

    bool Blocked { get { return GameManager.Instance.UiOpen || freeCursor; } }

    void OnDestroy()
    {
        Cursor.lockState = CursorLockMode.None;
        Cursor.visible = true;
    }

    void Update()
    {
        if (hero == null) return;

        if (GameInput.Escape()) freeCursor = true;
        if (freeCursor && !GameManager.Instance.UiOpen && GameInput.FireDown()) freeCursor = false;

        bool blocked = Blocked;
        Cursor.lockState = blocked ? CursorLockMode.None : CursorLockMode.Locked;
        Cursor.visible = blocked;

        if (blocked)
        {
            hero.wishMove = Vector3.zero;
            return;
        }

        Vector2 look = GameInput.Look();
        yaw += look.x * Sensitivity;
        pitch = Mathf.Clamp(pitch - look.y * Sensitivity, -35f, 60f);

        Vector2 m = GameInput.Move();
        hero.wishMove = Quaternion.Euler(0f, yaw, 0f) * new Vector3(m.x, 0f, m.y);
        hero.yaw = yaw;
        if (GameInput.Jump()) hero.wishJump = true;
    }

    void LateUpdate()
    {
        if (hero == null || cam == null) return;

        Vector3 pivot = hero.transform.position + Vector3.up * 1.7f;
        Quaternion rot = Quaternion.Euler(pitch, yaw, 0f);
        Vector3 desired = pivot + rot * new Vector3(0.9f, 0.3f, -CamDist);

        Vector3 dir = desired - pivot;
        float dist = dir.magnitude;
        dir /= dist;
        if (Combat.RaycastWorld(pivot, dir, dist + 0.3f, out var wp)) desired = wp - dir * 0.3f;

        cam.transform.SetPositionAndRotation(desired, rot);

        // Shoot along the camera ray, starting past the player so nothing behind them gets hit.
        hero.aimOrigin = desired + rot * Vector3.forward * Vector3.Distance(desired, pivot);
        hero.aimDir = rot * Vector3.forward;

        if (Blocked || hero.unit.IsDead) return;
        if (GameInput.Fire()) hero.TryFire();
        if (GameInput.Ability1()) hero.TryCast(0);
        if (GameInput.Ability2()) hero.TryCast(1);
    }
}
