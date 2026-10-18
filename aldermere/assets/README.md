# Aldermere art assets

The game draws everything with code until a PNG for it is here. To add art:

1. Save the PNG in this folder with the exact file name below.
2. Add the file name to the `AVAILABLE` list near the top of the `art assets` section in `../index.html`.

Anything missing from `AVAILABLE` keeps its drawn stand-in, so you can add art one file at a time.

All sprites use a transparent background and hard pixel edges. The game world is 480×270 and drawn at 2×, so a 64px frame shows as 32 game pixels.

Generated sources live in `source/` (`*_gen.png`, made with Figma AI on a magenta background) and in the Figma file "Aldermere Art Assets". `python3 ../tools/build_assets.py` rebuilds every game file from them.

To clean up a single ChatGPT sheet before adding it, run `python3 ../tools/process_sheet.py SOURCE.png OUT.png` (see `--help` for grid size).

| File | Layout | Used for |
|---|---|---|
| `hero_field.png` ✅ | 6 cols × 4 rows of 64×64. Rows: down, left, right, up. Cols 1–2 idle, 3–6 walk. Scarf drawn red; the game recolours it per House. | Player on the map and in battle |
| `mira_field.png` ✅ | Same layout as the hero | Mira on the map and in battle |
| `npc_<id>.png` | Same layout as the hero. Ids: `thorne`, `aldous`, `brannoch`, `quillon`, `pell`, `juniper`, `tobias`, `ghost` | Named NPCs |
| `portrait_<id>.png` ✅ hero, mira, thorne, brannoch, quillon | Square cells side by side: neutral, happy, shocked, sad (128px each). Ids as above plus `hero`, `mira`, `warden` | Dialogue box portrait and battle panel face |
| `foe_<art>.png` | 4 cols × 2 rows of 64×64 (`foe_warden.png`: 128×128). Row 1 idle ×4; row 2 attack ×3, then hurt. Arts: `dummy`, `imp`, `broom`, `wisp`, `toad`, `gargoyle`, `shade`, `warden` | Enemies on the map and in battle |
| `tiles.png` ✅ | 6 cols × 4 rows of 32×32 tiles, in the order below | Every map |
| `tile_fountain.png` ✅ | 64×64 | Courtyard fountain, drawn across 2×2 tiles |
| `fx_<element>.png` | 8 cols × 2 rows of 64×64. Row 1: 4-frame projectile loop (cols 1–4). Row 2: 8-frame impact. Elements: `fire`, `water`, `earth`, `air`, `arcane`, `light`, `shadow`, `time` | Spell effects |
| `ui_window.png` ✅ | 192×192 nine-slice frame with 32px corners | Replaces every window frame |
| `icons.png` ✅ | 6 cols × 4 rows of 48×48 (order in `ICONS` in `index.html`) | Menu, item, spell and pause icons |
| `crests.png` ✅ | 4 × 96×96: Emberhold, Tidewyrm, Thornveil, Galecrest | Pause menu and the Oracle Lantern's portrait after sorting |
| `title_bg.png` ✅ | 960×540 | Title screen |
| `logo.png` ✅ | 720px wide, transparent | Title logo |
| `btn_dpad.png`, `btn_a.png`, `btn_b.png`, `btn_menu.png` ✅ | Transparent, about 2× on-screen size | Phone touch controls |

## `tiles.png` order

| Row | Col 1 | Col 2 | Col 3 | Col 4 | Col 5 | Col 6 |
|---|---|---|---|---|---|---|
| 1 | Grass A | Grass B | Stone path | Polished floor | Red carpet | Arena sand |
| 2 | Castle wall | Wall with lit window | Wooden door | Bookshelf | Table with candle* | Brazier* |
| 3 | Green tree* | Cherry blossom tree* | Lamp post* | Flower bed* | Water | Fountain (drawn across 2×2 tiles)* |
| 4 | Seal door, closed | Seal door, open | Archive floor | Archive wall | (unused) | (unused) |

\* Drawn on a transparent background. The game places grass, floor or path underneath.
