using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public enum GameState { Select, Playing, Over }

public class FeedEntry
{
    public string text;
    public float time;
    public int team;
}

// Owns match flow: character select, spawning, minion waves, rewards, win condition.
// Bootstraps itself, so any scene works - just press Play.
public class GameManager : MonoBehaviour
{
    public static GameManager Instance;
    public static Transform WorldRoot;

    public GameState State = GameState.Select;
    public Hero Player;
    public PlayerController PlayerCtl;
    public readonly List<Hero> Heroes = new List<Hero>();
    public readonly List<FeedEntry> Feed = new List<FeedEntry>();
    public int[] teamKills = new int[2];
    public int winner = -1;
    public float matchTime;
    public bool shopOpen;
    public Camera MainCam;

    public bool UiOpen { get { return State != GameState.Playing || shopOpen; } }

    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
    static void Boot()
    {
        if (Instance != null) return;
        var go = new GameObject("MobaGame");
        go.AddComponent<GameManager>();
        go.AddComponent<Hud>();
    }

    void Awake()
    {
        Instance = this;
    }

    void OnEnable() { Unit.AnyDied += OnUnitDied; }
    void OnDisable() { Unit.AnyDied -= OnUnitDied; }

    void Start()
    {
        MainCam = EnsureCamera();
        BuildWorld();
    }

    static Camera EnsureCamera()
    {
        var c = Camera.main;
        if (c == null) c = FindFirstObjectByType<Camera>();
        if (c == null)
        {
            var go = new GameObject("MainCamera");
            go.tag = "MainCamera";
            c = go.AddComponent<Camera>();
            go.AddComponent<AudioListener>();
        }
        c.fieldOfView = 70f;
        c.farClipPlane = 900f;
        return c;
    }

    void BuildWorld()
    {
        WorldRoot = new GameObject("World").transform;
        MapBuilder.Build(WorldRoot);
        State = GameState.Select;
        Cursor.lockState = CursorLockMode.None;
        Cursor.visible = true;
    }

    void Update()
    {
        if (State == GameState.Select)
        {
            // Slow orbit around the blue base behind the select screen.
            float a = Time.time * 0.1f;
            Vector3 c = MapBuilder.Spawn(0) + Vector3.up * 5f;
            MainCam.transform.position = c + new Vector3(Mathf.Sin(a) * 60f, 25f, Mathf.Cos(a) * 60f);
            MainCam.transform.LookAt(c);
            return;
        }

        if (State != GameState.Playing) return;
        matchTime += Time.deltaTime;

        if (Player != null)
        {
            if (Player.unit.IsDead) shopOpen = false;
            else if (GameInput.Shop() && (shopOpen || Player.InBase)) shopOpen = !shopOpen;
            else if (shopOpen && (GameInput.Escape() || !Player.InBase)) shopOpen = false;
        }

        for (int i = Feed.Count - 1; i >= 0; i--)
            if (Time.time - Feed[i].time > 7f) Feed.RemoveAt(i);
    }

    // ---- Match setup ------------------------------------------------------------------------

    public void StartMatch(int characterIndex)
    {
        if (State != GameState.Select) return;

        var allyPool = new List<int>();
        var enemyPool = new List<int>();
        for (int i = 0; i < Characters.All.Length; i++)
        {
            enemyPool.Add(i);
            if (i != characterIndex) allyPool.Add(i);
        }
        Shuffle(allyPool);
        Shuffle(enemyPool);

        for (int team = 0; team < 2; team++)
        {
            for (int slot = 0; slot < 6; slot++)
            {
                bool isPlayer = team == 0 && slot == 0;
                int ci = isPlayer ? characterIndex : (team == 0 ? allyPool[slot - 1] : enemyPool[slot]);
                Vector3 spawn = MapBuilder.Spawn(team) + new Vector3((slot - 2.5f) * 4f, 0f, 0f);
                var h = Hero.Create(Characters.All[ci], team, isPlayer, spawn, WorldRoot);
                Heroes.Add(h);
                if (isPlayer) Player = h;
                else h.gameObject.AddComponent<BotController>().Init(h, slot % 3);
            }
        }

        PlayerCtl = gameObject.AddComponent<PlayerController>();
        PlayerCtl.Init(Player, MainCam);

        matchTime = 0f;
        State = GameState.Playing;
        AddFeed("Match started - destroy the enemy Core!", 0);
        StartCoroutine(Waves());
    }

    static void Shuffle(List<int> list)
    {
        for (int i = list.Count - 1; i > 0; i--)
        {
            int j = Random.Range(0, i + 1);
            int t = list[i]; list[i] = list[j]; list[j] = t;
        }
    }

    IEnumerator Waves()
    {
        yield return new WaitForSeconds(8f);
        while (State == GameState.Playing)
        {
            float scale = 1f + matchTime / 600f * 0.5f;
            for (int i = 0; i < 5; i++)
            {
                for (int team = 0; team < 2; team++)
                    for (int lane = 0; lane < 3; lane++)
                        Minion.Create(team, MapBuilder.Lanes[lane].PathFor(team), i == 4, scale, WorldRoot);
                yield return new WaitForSeconds(0.7f);
            }
            yield return new WaitForSeconds(30f);
        }
    }

    public void Restart()
    {
        StartCoroutine(RestartRoutine());
    }

    IEnumerator RestartRoutine()
    {
        StopAllCoroutines();
        if (PlayerCtl != null) Destroy(PlayerCtl);
        if (WorldRoot != null) Destroy(WorldRoot.gameObject);
        Heroes.Clear();
        Feed.Clear();
        Player = null;
        PlayerCtl = null;
        teamKills = new int[2];
        winner = -1;
        shopOpen = false;
        State = GameState.Select;
        yield return null; // let the old world finish destroying
        BuildWorld();
    }

    // ---- Rewards & win condition ------------------------------------------------------------

    void OnUnitDied(Unit victim, Unit killer)
    {
        if (State != GameState.Playing) return;
        int enemyTeam = 1 - victim.team;
        Hero kh = killer != null ? killer.GetComponent<Hero>() : null;

        switch (victim.kind)
        {
            case UnitKind.Hero:
            {
                var vh = victim.GetComponent<Hero>();
                teamKills[enemyTeam]++;
                if (kh != null)
                {
                    kh.kills++;
                    kh.gold += 250 + 20 * vh.level;
                }
                ShareXp(victim.transform.position, enemyTeam, 120 + 15 * vh.level, 60f);
                string who = killer != null ? killer.displayName : "the lane";
                AddFeed(who + " defeated " + victim.displayName, enemyTeam);
                break;
            }
            case UnitKind.Minion:
                if (kh != null) kh.gold += 22;
                ShareXp(victim.transform.position, enemyTeam, 38, 40f);
                break;

            case UnitKind.Tower:
                foreach (var h in Heroes)
                    if (h.unit.team == enemyTeam) { h.gold += 200; h.AddXp(120); }
                AddFeed((victim.team == 0 ? "Blue" : "Red") + " tower destroyed", enemyTeam);
                break;

            case UnitKind.Core:
                winner = enemyTeam;
                State = GameState.Over;
                shopOpen = false;
                AddFeed((enemyTeam == 0 ? "Blue" : "Red") + " team wins!", enemyTeam);
                break;
        }
    }

    void ShareXp(Vector3 pos, int team, int amount, float radius)
    {
        foreach (var h in Heroes)
        {
            if (h.unit.team != team || h.unit.IsDead) continue;
            Vector3 d = h.transform.position - pos;
            d.y = 0f;
            if (d.magnitude <= radius) h.AddXp(amount);
        }
    }

    public void AddFeed(string text, int team)
    {
        Feed.Add(new FeedEntry { text = text, time = Time.time, team = team });
        if (Feed.Count > 6) Feed.RemoveAt(0);
    }
}
