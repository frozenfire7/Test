using UnityEngine;

// All UI is immediate-mode (OnGUI) so the project needs no canvas, fonts or prefabs.
public class Hud : MonoBehaviour
{
    static readonly Color Ally = new Color(0.30f, 0.70f, 1f);
    static readonly Color Enemy = new Color(1f, 0.35f, 0.30f);
    static readonly Color Panel = new Color(0.07f, 0.08f, 0.11f, 0.92f);

    GUIStyle label;
    float W, s;
    const float H = 1080f;

    void OnGUI()
    {
        var gm = GameManager.Instance;
        if (gm == null) return;
        if (label == null) label = new GUIStyle(GUI.skin.label) { wordWrap = false };

        s = Screen.height / H;
        W = Screen.width / s;
        GUI.matrix = Matrix4x4.Scale(new Vector3(s, s, 1f));

        switch (gm.State)
        {
            case GameState.Select: DrawSelect(gm); break;
            case GameState.Playing: DrawHud(gm); break;
            case GameState.Over: DrawHud(gm); DrawOver(gm); break;
        }
    }

    // ---- helpers ----------------------------------------------------------------------------

    void Box(Rect r, Color c)
    {
        var old = GUI.color;
        GUI.color = c;
        GUI.DrawTexture(r, Texture2D.whiteTexture);
        GUI.color = old;
    }

    void Text(Rect r, string t, int size, Color c, TextAnchor a = TextAnchor.UpperLeft, bool bold = false, bool wrap = false)
    {
        label.fontSize = size;
        label.alignment = a;
        label.fontStyle = bold ? FontStyle.Bold : FontStyle.Normal;
        label.wordWrap = wrap;
        label.normal.textColor = Color.black;
        GUI.Label(new Rect(r.x + 1, r.y + 1, r.width, r.height), t, label);
        label.normal.textColor = c;
        GUI.Label(r, t, label);
    }

    // ---- character select -------------------------------------------------------------------

    void DrawSelect(GameManager gm)
    {
        Box(new Rect(0, 0, W, H), new Color(0f, 0f, 0f, 0.55f));
        Text(new Rect(0, 40, W, 80), "CHOOSE YOUR HERO", 56, Color.white, TextAnchor.MiddleCenter, true);
        Text(new Rect(0, 115, W, 40), "6v6  -  you and 5 AI allies vs 6 AI enemies. Destroy the enemy Core.",
            24, new Color(0.8f, 0.85f, 0.9f), TextAnchor.MiddleCenter);

        float cw = 290f, ch = 650f, gap = 20f;
        float x0 = (W - (6 * cw + 5 * gap)) * 0.5f;
        float y0 = 190f;

        for (int i = 0; i < Characters.All.Length; i++)
        {
            var d = Characters.All[i];
            var r = new Rect(x0 + i * (cw + gap), y0, cw, ch);
            Box(r, Panel);
            Box(new Rect(r.x, r.y, cw, 90), d.color);
            Text(new Rect(r.x + 14, r.y + 6, cw - 28, 50), d.name.ToUpper(), 36, Color.white, TextAnchor.UpperLeft, true);
            Text(new Rect(r.x + 14, r.y + 52, cw - 28, 30), d.role, 22, new Color(1f, 1f, 1f, 0.85f));

            float y = r.y + 102;
            Text(new Rect(r.x + 14, y, cw - 28, 80), d.blurb, 18, new Color(0.85f, 0.88f, 0.92f), TextAnchor.UpperLeft, false, true);
            y += 90;
            Text(new Rect(r.x + 14, y, cw - 28, 26), "HP " + d.health.ToString("0") + "    Speed " + d.speed.ToString("0.0"), 20, Color.white);
            y += 36;
            string pel = d.weapon.pellets > 1 ? " x" + d.weapon.pellets : "";
            Text(new Rect(r.x + 14, y, cw - 28, 26), "WEAPON", 16, new Color(1f, 0.8f, 0.3f), TextAnchor.UpperLeft, true);
            y += 22;
            Text(new Rect(r.x + 14, y, cw - 28, 50), d.weapon.name + ": " + d.weapon.damage.ToString("0") + pel + " dmg, " +
                d.weapon.rate.ToString("0.#") + "/s", 18, Color.white, TextAnchor.UpperLeft, false, true);
            y += 56;
            for (int a = 0; a < d.abilities.Length; a++)
            {
                var ab = d.abilities[a];
                Text(new Rect(r.x + 14, y, cw - 28, 24), (a == 0 ? "[Q] " : "[E] ") + ab.name + "  (" + ab.cooldown.ToString("0") + "s)",
                    18, new Color(0.6f, 0.9f, 1f), TextAnchor.UpperLeft, true);
                y += 24;
                Text(new Rect(r.x + 14, y, cw - 28, 50), ab.desc, 16, new Color(0.85f, 0.88f, 0.92f), TextAnchor.UpperLeft, false, true);
                y += 58;
            }

            if (GUI.Button(new Rect(r.x + 20, r.yMax - 66, cw - 40, 48), "SELECT"))
                gm.StartMatch(i);
        }
    }

    // ---- in-game HUD -------------------------------------------------------------------------

    void DrawHud(GameManager gm)
    {
        var p = gm.Player;
        if (p == null) return;
        var cam = gm.PlayerCtl != null ? gm.PlayerCtl.Cam : null;

        if (cam != null) DrawWorldBars(gm, p, cam);
        DrawCrosshair(gm);
        DrawBottom(p);
        DrawTop(gm);
        DrawMinimap(gm, p);
        DrawFeed(gm);

        Text(new Rect(20, H - 40, 900, 30),
            "WASD move  |  Mouse aim  |  LMB fire  |  Space jump  |  Q / E abilities  |  B shop (in base)  |  Hold Tab scoreboard",
            16, new Color(1f, 1f, 1f, 0.55f));

        if (p.unit.IsDead && gm.State == GameState.Playing)
        {
            Text(new Rect(0, 300, W, 80), "YOU DIED", 64, new Color(1f, 0.3f, 0.3f), TextAnchor.MiddleCenter, true);
            Text(new Rect(0, 370, W, 40), "Respawning in " + Mathf.CeilToInt(p.respawnTimer) + "s", 28, Color.white, TextAnchor.MiddleCenter);
        }

        if (GameInput.Scoreboard() || gm.State == GameState.Over) DrawScoreboard(gm);
        if (gm.shopOpen) DrawShop(p);
    }

    void DrawCrosshair(GameManager gm)
    {
        if (gm.UiOpen) return;
        float cx = W * 0.5f, cy = H * 0.5f;
        Color c = new Color(1f, 1f, 1f, 0.9f);
        Box(new Rect(cx - 1, cy - 12, 2, 8), c);
        Box(new Rect(cx - 1, cy + 4, 2, 8), c);
        Box(new Rect(cx - 12, cy - 1, 8, 2), c);
        Box(new Rect(cx + 4, cy - 1, 8, 2), c);
    }

    void DrawWorldBars(GameManager gm, Hero p, Camera cam)
    {
        for (int i = 0; i < Unit.All.Count; i++)
        {
            var u = Unit.All[i];
            if (u == null || u.IsDead || u == p.unit) continue;

            float maxD = u.kind == UnitKind.Hero ? 90f : (u.kind == UnitKind.Minion ? 35f : 140f);
            Vector3 wp = u.transform.position + Vector3.up * (u.height + 0.6f);
            if (Vector3.Distance(cam.transform.position, wp) > maxD) continue;
            Vector3 sp = cam.WorldToScreenPoint(wp);
            if (sp.z <= 0f) continue;

            float gx = sp.x / s, gy = (Screen.height - sp.y) / s;
            float bw, bh;
            switch (u.kind)
            {
                case UnitKind.Hero: bw = 72f; bh = 8f; break;
                case UnitKind.Minion: bw = 38f; bh = 5f; break;
                case UnitKind.Tower: bw = 110f; bh = 10f; break;
                default: bw = 170f; bh = 12f; break;
            }

            Color c = u.team == p.unit.team ? Ally : Enemy;
            float frac = Mathf.Clamp01(u.health / u.maxHealth);
            Box(new Rect(gx - bw * 0.5f - 1, gy - bh - 1, bw + 2, bh + 2), new Color(0f, 0f, 0f, 0.7f));
            Box(new Rect(gx - bw * 0.5f, gy - bh, bw * frac, bh), c);

            if (u.kind == UnitKind.Hero)
            {
                var h = u.GetComponent<Hero>();
                Text(new Rect(gx - 90, gy - bh - 24, 180, 22), u.displayName + "  Lv" + h.level, 16, c, TextAnchor.MiddleCenter, true);
            }
            else if (u.Protected)
            {
                Text(new Rect(gx - 90, gy - bh - 22, 180, 20), "SHIELDED", 14, new Color(1f, 0.9f, 0.4f), TextAnchor.MiddleCenter, true);
            }
        }
    }

    void DrawBottom(Hero p)
    {
        float bw = 560f, bh = 28f;
        float bx = (W - bw) * 0.5f, by = H - 96f;

        Text(new Rect(bx, by - 30, bw, 26), p.def.name + "   Lv " + p.level, 22, Color.white, TextAnchor.MiddleLeft, true);
        Box(new Rect(bx - 2, by - 2, bw + 4, bh + 4), new Color(0f, 0f, 0f, 0.75f));
        Box(new Rect(bx, by, bw * Mathf.Clamp01(p.unit.health / p.unit.maxHealth), bh), new Color(0.25f, 0.85f, 0.35f));
        Text(new Rect(bx, by, bw, bh), p.unit.health.ToString("0") + " / " + p.unit.maxHealth.ToString("0"), 18, Color.white, TextAnchor.MiddleCenter, true);

        float xpFrac = p.level >= Hero.MaxLevel ? 1f : (float)p.xp / Hero.XpFor(p.level);
        Box(new Rect(bx, by + bh + 4, bw, 6), new Color(0f, 0f, 0f, 0.75f));
        Box(new Rect(bx, by + bh + 4, bw * xpFrac, 6), new Color(0.65f, 0.4f, 1f));

        for (int i = 0; i < 2; i++)
        {
            var a = p.def.abilities[i];
            var r = new Rect(bx - 170 + i * 84, by - 22, 76, 76);
            Box(new Rect(r.x - 2, r.y - 2, r.width + 4, r.height + 4), new Color(0f, 0f, 0f, 0.75f));
            Box(r, p.def.color * 0.8f);
            Text(new Rect(r.x + 4, r.y + 2, 30, 24), i == 0 ? "Q" : "E", 20, Color.white, TextAnchor.UpperLeft, true);
            Text(new Rect(r.x, r.y + 30, r.width, 44), a.name, 13, Color.white, TextAnchor.MiddleCenter, false, true);
            if (p.cd[i] > 0f)
            {
                Box(r, new Color(0f, 0f, 0f, 0.7f));
                Text(r, p.cd[i].ToString("0.0"), 24, Color.white, TextAnchor.MiddleCenter, true);
            }
        }

        Text(new Rect(bx + bw + 30, by - 4, 300, 36), "Gold  " + p.gold, 30, new Color(1f, 0.85f, 0.25f), TextAnchor.MiddleLeft, true);
        Text(new Rect(bx + bw + 30, by + 30, 300, 26), "K " + p.kills + "   D " + p.deaths, 20, Color.white);
        if (p.InBase && !p.unit.IsDead)
            Text(new Rect(bx + bw + 30, by + 56, 300, 26), "[B] Open shop", 18, new Color(0.6f, 1f, 0.7f), TextAnchor.UpperLeft, true);
    }

    void DrawTop(GameManager gm)
    {
        var r = new Rect((W - 360) * 0.5f, 16, 360, 56);
        Box(r, new Color(0f, 0f, 0f, 0.55f));
        Text(new Rect(r.x, r.y, 140, r.height), gm.teamKills[0].ToString(), 36, Ally, TextAnchor.MiddleRight, true);
        Text(new Rect(r.x + 220, r.y, 140, r.height), gm.teamKills[1].ToString(), 36, Enemy, TextAnchor.MiddleLeft, true);
        int t = Mathf.FloorToInt(gm.matchTime);
        Text(new Rect(r.x + 140, r.y, 80, r.height), (t / 60).ToString("00") + ":" + (t % 60).ToString("00"), 24, Color.white, TextAnchor.MiddleCenter, true);
    }

    void DrawFeed(GameManager gm)
    {
        float y = 90f;
        foreach (var f in gm.Feed)
        {
            Text(new Rect(20, y, 700, 26), f.text, 20, f.team == 0 ? Ally : Enemy, TextAnchor.UpperLeft, true);
            y += 26f;
        }
    }

    void DrawMinimap(GameManager gm, Hero p)
    {
        float mw = 200f, mh = mw * (MapBuilder.HalfZ / MapBuilder.HalfX);
        var r = new Rect(W - mw - 20, 20, mw, mh);
        Box(new Rect(r.x - 3, r.y - 3, r.width + 6, r.height + 6), new Color(0f, 0f, 0f, 0.8f));
        Box(r, new Color(0.14f, 0.2f, 0.14f));

        foreach (var lane in MapBuilder.Lanes)
        {
            for (int i = 1; i < lane.pts.Count; i++)
            {
                Vector3 a = lane.pts[i - 1], b = lane.pts[i];
                int steps = Mathf.CeilToInt(Vector3.Distance(a, b) / 6f);
                for (int k = 0; k <= steps; k++)
                {
                    Vector2 m = ToMap(Vector3.Lerp(a, b, k / (float)Mathf.Max(1, steps)), r);
                    Box(new Rect(m.x - 1.5f, m.y - 1.5f, 3, 3), new Color(0.6f, 0.55f, 0.45f));
                }
            }
        }

        for (int i = 0; i < Unit.All.Count; i++)
        {
            var u = Unit.All[i];
            if (u == null || u.IsDead) continue;
            float sz;
            switch (u.kind)
            {
                case UnitKind.Hero: sz = 7f; break;
                case UnitKind.Minion: sz = 3f; break;
                case UnitKind.Tower: sz = 6f; break;
                default: sz = 11f; break;
            }
            Vector2 m = ToMap(u.transform.position, r);
            if (u == p.unit) Box(new Rect(m.x - sz * 0.5f - 2, m.y - sz * 0.5f - 2, sz + 4, sz + 4), Color.white);
            Box(new Rect(m.x - sz * 0.5f, m.y - sz * 0.5f, sz, sz), u.team == p.unit.team ? Ally : Enemy);
        }
    }

    static Vector2 ToMap(Vector3 w, Rect r)
    {
        float u = (w.x + MapBuilder.HalfX) / (MapBuilder.HalfX * 2f);
        float v = 1f - (w.z + MapBuilder.HalfZ) / (MapBuilder.HalfZ * 2f);
        return new Vector2(r.x + u * r.width, r.y + v * r.height);
    }

    void DrawScoreboard(GameManager gm)
    {
        var r = new Rect((W - 900) * 0.5f, 200, 900, 560);
        Box(r, Panel);
        Text(new Rect(r.x, r.y + 8, r.width, 40), "SCOREBOARD", 30, Color.white, TextAnchor.MiddleCenter, true);

        float y = r.y + 60;
        for (int team = 0; team < 2; team++)
        {
            Color c = team == 0 ? Ally : Enemy;
            Text(new Rect(r.x + 20, y, 400, 28), (team == 0 ? "BLUE TEAM" : "RED TEAM") + "  -  " + gm.teamKills[team] + " kills", 22, c, TextAnchor.UpperLeft, true);
            Text(new Rect(r.x + 420, y, 80, 28), "Lv", 18, Color.white, TextAnchor.UpperLeft, true);
            Text(new Rect(r.x + 520, y, 80, 28), "K", 18, Color.white, TextAnchor.UpperLeft, true);
            Text(new Rect(r.x + 620, y, 80, 28), "D", 18, Color.white, TextAnchor.UpperLeft, true);
            Text(new Rect(r.x + 720, y, 120, 28), "Gold", 18, Color.white, TextAnchor.UpperLeft, true);
            y += 32;
            foreach (var h in gm.Heroes)
            {
                if (h.unit.team != team) continue;
                Color tc = h.isPlayer ? new Color(1f, 0.95f, 0.5f) : Color.white;
                Text(new Rect(r.x + 30, y, 380, 26), h.def.name + (h.isPlayer ? "  (you)" : "") + (h.unit.IsDead ? "  [dead]" : ""), 20, tc);
                Text(new Rect(r.x + 420, y, 80, 26), h.level.ToString(), 20, tc);
                Text(new Rect(r.x + 520, y, 80, 26), h.kills.ToString(), 20, tc);
                Text(new Rect(r.x + 620, y, 80, 26), h.deaths.ToString(), 20, tc);
                Text(new Rect(r.x + 720, y, 120, 26), h.gold.ToString(), 20, tc);
                y += 28;
            }
            y += 14;
        }
    }

    void DrawShop(Hero p)
    {
        var r = new Rect((W - 760) * 0.5f, 220, 760, 120 + Items.All.Length * 64);
        Box(r, Panel);
        Text(new Rect(r.x, r.y + 10, r.width, 40), "ITEM SHOP", 32, Color.white, TextAnchor.MiddleCenter, true);
        Text(new Rect(r.x, r.y + 52, r.width, 30), "Gold: " + p.gold + "    (press B or Esc to close)", 20, new Color(1f, 0.85f, 0.25f), TextAnchor.MiddleCenter);

        for (int i = 0; i < Items.All.Length; i++)
        {
            var it = Items.All[i];
            float y = r.y + 96 + i * 64;
            Text(new Rect(r.x + 24, y, 480, 28), it.name + "   (" + p.itemCounts[i] + "/" + Items.MaxStacks + ")", 22, Color.white, TextAnchor.UpperLeft, true);
            Text(new Rect(r.x + 24, y + 28, 480, 24), it.desc, 17, new Color(0.8f, 0.85f, 0.9f));
            bool maxed = p.itemCounts[i] >= Items.MaxStacks;
            GUI.enabled = !maxed && p.gold >= it.cost;
            if (GUI.Button(new Rect(r.xMax - 190, y + 4, 166, 44), maxed ? "MAXED" : "Buy  " + it.cost))
                p.Buy(i);
            GUI.enabled = true;
        }
    }

    void DrawOver(GameManager gm)
    {
        bool won = gm.winner == 0;
        Box(new Rect(0, 0, W, 330), new Color(0f, 0f, 0f, 0.65f));
        Text(new Rect(0, 60, W, 110), won ? "VICTORY" : "DEFEAT", 96, won ? new Color(0.4f, 0.9f, 1f) : new Color(1f, 0.35f, 0.3f), TextAnchor.MiddleCenter, true);
        Text(new Rect(0, 170, W, 40), (gm.winner == 0 ? "The Blue" : "The Red") + " Core has been victorious.", 26, Color.white, TextAnchor.MiddleCenter);
        if (GUI.Button(new Rect((W - 260) * 0.5f, 230, 260, 60), "PLAY AGAIN")) gm.Restart();
    }
}
