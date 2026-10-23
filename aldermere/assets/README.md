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
| `npc_<id>.png` ✅ | Same layout as the hero. Ids: `thorne`, `aldous`, `brannoch`, `quillon`, `pell`, `juniper`, `tobias`, `ghost`, `hob`, `cassius`, `chef`, `bryony` | Named NPCs (Cassius also in his duel) |
| `portrait_<id>.png` ✅ | Square cells side by side: neutral, happy, shocked, sad (128px each). Ids as above plus `hero`, `mira`, `warden`, `nurse` | Dialogue box portrait and battle panel face |
| `foe_<art>.png` ✅ | 4 cols × 2 rows of square frames: 64px for small foes, 96px for big ones (`gargoyle`, `shade`, `bone`, `apprentice`, `cgolem`, `echo`); `foe_warden.png` uses 128px. Row 1 idle ×4; row 2 attack ×3, then hurt. Arts: `dummy`, `imp`, `broom`, `wisp`, `toad`, `slime`, `emberslime`, `moth`, `shroom`, `scarab`, `gargoyle`, `shade`, `bone`, `apprentice`, `cgolem`, `echo`, `warden` | Enemies on the map and in battle. Built from `source/foes_[a-d]_gen.png` (one foe per row: 4 idle poses, 2 attack poses) |
| `tiles.png` ✅ | 6 cols × 4 rows of 32×32 tiles, in the order below | Every map |
| `tile_fountain.png` ✅ | 64×64 | Courtyard fountain, drawn across 2×2 tiles |
| `fx_<Name>.png` ✅ | 8 frames of 96×96 in one row. Names: `Fire_Burst`, `Water_Splash`, `Nature_Bloom`, `Wind_Slash`, `Arcane_Rune`, `Star_Shower`, `Dark_Pulse`, `Time_Stop`, `Healing_Aura`, `Haste`, `Familiar_Summon`, `Barrier` | Spell impacts, heals, Haste, Techs and familiar summons. Built from `source/fx_[a-c]_gen.png` with the glow separated from the magenta |
| `fam_<id>.png` ✅ | 4 frames of 40×40: 2 idle, 2 moving. Ids: `cat`, `rabbit`, `owl`, `sprout` | Familiars following the party and in battle |
| `prop_<Name>.png` ✅ | 64×64, standing on the bottom edge. Names in `PROPS` in `tools/build_assets.py` | Furniture, chests (with an open version), banners, the wishing well, the arena glyph and the Oracle Lantern |
| `gear48.png` ✅ | 6 cols × 5 rows of 48×48 (positions in `GEAR_ICONS` in `index.html`) | Equipment icons |
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

## Magic Academy Art Pack (`pack/`)

A curated subset of the "Magic Academy Art Pack, Part 1" (see `pack/PACK_README.md`). These are native 1x pixel art, drawn at half size on the 2x canvas so each pixel lands exactly. Every one of them now has an HD replacement above, so the game only downloads a pack file when its HD version is missing from `AVAILABLE`.

| Files | Layout | Used for |
|---|---|---|
| `char_<Name>.png` | 10 cols × 4 rows of 32×48 (idle 0–1, walk 2–5, cast 6–9) | NPCs on the field, the rival in battle, portrait fallbacks (mapping in `NPC_CHAR`) |
| `foe_<Name>.png` | 6 frames of 48×48 (idle 0–3, attack 4–5) | Enemies (mapping and battle scale in `FOE_PACK`) |
| `fam_<Name>.png` | 8 frames of 32×32 | Familiars following the party and in battle |
| `fx_<Name>.png` | 8 frames of 48×48 | Spell impacts, heals, haste, Tech and familiar summons |
| `prop_<Name>.png` | 64×64 transparent | Chests, dorm furniture, banners, the wishing well and the arena glyph |
| `items24.png` | 8 × 8 grid of 24×24 icons (order in `ITEM_ICONS`) | Equipment icons |

The pack's concept atlases were used as design reference only: they are illustrations, not sliced sprites.
