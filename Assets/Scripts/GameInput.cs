using UnityEngine;
#if ENABLE_INPUT_SYSTEM
using UnityEngine.InputSystem;
#endif

// Thin wrapper so the game works with either Unity input backend.
public static class GameInput
{
#if ENABLE_INPUT_SYSTEM
    public static Vector2 Move()
    {
        var k = Keyboard.current;
        if (k == null) return Vector2.zero;
        float x = (k.dKey.isPressed ? 1f : 0f) - (k.aKey.isPressed ? 1f : 0f);
        float y = (k.wKey.isPressed ? 1f : 0f) - (k.sKey.isPressed ? 1f : 0f);
        return new Vector2(x, y);
    }

    public static Vector2 Look()
    {
        var m = Mouse.current;
        return m == null ? Vector2.zero : m.delta.ReadValue() * 0.1f;
    }

    public static bool Fire() { var m = Mouse.current; return m != null && m.leftButton.isPressed; }
    public static bool FireDown() { var m = Mouse.current; return m != null && m.leftButton.wasPressedThisFrame; }
    public static bool Jump() { var k = Keyboard.current; return k != null && k.spaceKey.wasPressedThisFrame; }
    public static bool Ability1() { var k = Keyboard.current; return k != null && k.qKey.wasPressedThisFrame; }
    public static bool Ability2() { var k = Keyboard.current; return k != null && k.eKey.wasPressedThisFrame; }
    public static bool Shop() { var k = Keyboard.current; return k != null && k.bKey.wasPressedThisFrame; }
    public static bool Scoreboard() { var k = Keyboard.current; return k != null && k.tabKey.isPressed; }
    public static bool Escape() { var k = Keyboard.current; return k != null && k.escapeKey.wasPressedThisFrame; }
#else
    public static Vector2 Move()
    {
        float x = (Input.GetKey(KeyCode.D) ? 1f : 0f) - (Input.GetKey(KeyCode.A) ? 1f : 0f);
        float y = (Input.GetKey(KeyCode.W) ? 1f : 0f) - (Input.GetKey(KeyCode.S) ? 1f : 0f);
        return new Vector2(x, y);
    }

    public static Vector2 Look() { return new Vector2(Input.GetAxisRaw("Mouse X"), Input.GetAxisRaw("Mouse Y")); }
    public static bool Fire() { return Input.GetMouseButton(0); }
    public static bool FireDown() { return Input.GetMouseButtonDown(0); }
    public static bool Jump() { return Input.GetKeyDown(KeyCode.Space); }
    public static bool Ability1() { return Input.GetKeyDown(KeyCode.Q); }
    public static bool Ability2() { return Input.GetKeyDown(KeyCode.E); }
    public static bool Shop() { return Input.GetKeyDown(KeyCode.B); }
    public static bool Scoreboard() { return Input.GetKey(KeyCode.Tab); }
    public static bool Escape() { return Input.GetKeyDown(KeyCode.Escape); }
#endif
}
