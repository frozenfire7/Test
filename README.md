# Lanefront - 6v6 shooter MOBA (Unity)

A third-person hero-shooter MOBA in the spirit of Deadlock, with Smite-style rules:
over-the-shoulder aiming, three lanes, minion waves, towers, a core, levels, gold and an item shop.

You pick one of 6 heroes and play on a team of 6 (you + 5 AI) against 6 AI enemies. Destroy the enemy Core to win.

## Run it

1. Install **Unity 6** (6000.0.x) via Unity Hub. Other recent versions work if Hub offers to upgrade the project.
2. In Unity Hub: **Add > Add project from disk** and pick this folder.
3. Open any scene (a new empty one is fine) and press **Play**.

No scene setup or art assets are needed. The map, heroes, minions, towers and UI are all built at runtime
by `GameManager`, which bootstraps itself.

## Controls

| Key | Action |
| --- | --- |
| WASD | Move |
| Mouse | Aim |
| Left mouse | Fire |
| Space | Jump |
| Q / E | Hero abilities |
| B | Item shop (only in your base) |
| Hold Tab | Scoreboard |
| Esc | Release cursor (click to recapture) |

## Heroes

| Hero | Role | Weapon | Q | E |
| --- | --- | --- | --- | --- |
| Bulwark | Tank | Scattergun (hitscan, 9 pellets) | Iron Wall (damage reduction) | Ground Pound (AoE) |
| Hawk | Sniper | Longbow Rifle (hitscan, 150m) | Roll (dash) | Deadeye (2.5x next shot) |
| Pyra | Mage | Fireball (splash projectile) | Meteor Orb (big AoE) | Nova (PBAoE) |
| Sera | Support | Pulse SMG | Revitalize (team heal) | Adrenaline (speed) |
| Shade | Assassin | Twin Pistols | Shadowstep (blink) | Execute (3x next shot) |
| Havoc | Gunner | Assault Rifle | Frag Grenade | Overdrive (fire rate) |

## Rules

- Three lanes (left, mid, right) with an outer and inner tower per lane per team, two guard towers and a Core in each base.
- Inner towers are invulnerable until the outer tower in that lane falls. Guard towers need one inner tower down. The Core needs both guards down.
- Minion waves spawn every ~30 seconds in each lane for both teams.
- Heroes gain XP from nearby kills and level up to 15 (more health and damage). Gold comes from kills and passive income.
- Spend gold at the fountain shop: health, damage, fire rate, speed, damage reduction, cooldown reduction, lifesteal (3 stacks each).
- Dying costs a respawn timer that grows with level.

## Layout

All code is in `Assets/Scripts`:

- `GameManager` - match flow, spawning, waves, rewards, win condition
- `MapBuilder` - procedural arena (lanes, jungle, bases, towers, cores)
- `Hero` / `CharacterData` - hero stats, weapons, abilities, items, leveling
- `PlayerController` / `BotController` - human input and AI
- `Minion`, `Tower`, `Projectile`, `Combat`, `Unit` - gameplay units and damage
- `Hud` - character select, HUD, minimap, scoreboard, shop
- `GameInput` - works with either the old or new Unity input backend

## Not done yet

- Online multiplayer (all other players are AI bots). Netcode for GameObjects would be the natural next step.
- Jungle camps, a boss, and an ultimate ability per hero.
- Real art, animation and audio (everything is primitive shapes).
- Bot AI is basic: it does not dodge or path around jungle obstacles.
