# MAGIC ACADEMY JRPG — EXPANDED PIXEL ART PACK

A magic-academy-themed pixel asset bundle, building on your retro JRPG lookbook and earlier protagonist sprites / tileset.

## INCLUDED
- **3** newly generated high-detail concept atlases featuring many character, enemy, boss, environmental, spell and prop ideas.
- **30** new hero/NPC roles — 4 facing directions (down/left/right/up) × 10 frames per direction = **1200** character frames.
- **32** enemies — **192** enemy animation frames (4 idle + 2 attack).
- **12** familiars with 8-frame mini strips.
- **64** terrain/ground/water/stone/archives tiles, each **32×32 PNG**.
- **48** standalone transparent props, each on a **64×64 canvas**.
- **20** spell effects with 8 animation frames, **48×48 px** per frame.
- **64** item & equipment icons **24×24 px**.
- UI dialogue and menu panels, gauges, cursors, and a sample campus map.
- Six labeled PNG catalog previews, plus selected earlier reference art.

## INTEGRATION
**Character sheet:** 320×192, composed of 10 columns × 4 rows of 32×48 pixels. Row order: down, left, right, up.
Frame 0-1: idle breathing; 2-5: walk cycle; 6-9: casting.
**Enemy:** 288×48, 6 columns × 1 row of 48×48. Frames 0-3 idle; 4-5 attack.
**Familiar:** 256×32, 8 columns × 1 row of 32×32.
**Spell strip:** 384×48, 8 columns × 1 row of 48×48.
**Tile atlas:** 10 columns, each 32×32, order listed in `asset_manifest.json`.
**Prop atlas:** 8 columns of 64×64.
**Icons atlas:** 8 columns of 24×24.

All engine sprite sheets, terrain, props and icons are RGBA PNG files made at native resolution with crisp pixel boundaries. Render with nearest-neighbor scaling and point sampling. Use sorting by Y-position for a 3/4 top-down field.

## IMPORTANT LIMITATION / USE CASE
The high-detail art in `01_Concept_Art` and `11_Original_References` is **visual exploration**: it has mixed sprite sizes, some compositional overlaps and nonstandard alpha; it has NOT been pixel-perfect sliced into game-engine frames. The sprites in `02_Characters`, `03_Enemies`, etc. are a *new*, **programmatically created, structurally consistent mini-pixel style** optimized for direct integration; they intentionally simplify the richly illustrated concept art and should be considered a production starting point rather than final polished commissioned art.

## FOLDER MAP
`01_Concept_Art/` → generated detailed art atlases + 14 thematic view crops
`02_Characters/` → complete animation sheets + 1,200 individual frames
`03_Enemies/` → enemy strips + 192 individual frames
`04_Familiars/` → sidekicks
`05_Tiles/` → 32×32 seamless terrain PNG and atlas
`06_Props/` → transparent environment objects
`07_Spell_FX/` → spell strips
`08_Items_Icons/` → items and icons
`09_UI/` → transparent game UI panels
`10_Previews/` → six illustrated catalog sheets, campus demonstration
`11_Original_References/` → your earlier pixel lookbooks and art

## COLOR KEY
#1b1f33 #1f4fa3 #2f8fbf #2fb3a8 #dfe5df #f2c89a #f5a93a #ec8a2f #d23f3a #f08aa0 #c07ad8 #6b46a8 #4f8a3c
Shades of these tones are used for sprite highlights and shadows. Transparent backgrounds throughout the engine assets.

## TERMS
New art generated for this user request. No third-party sprite rips included. Visual inspiration: classic neo-retro JRPG pixel art, an original magic academy world.
