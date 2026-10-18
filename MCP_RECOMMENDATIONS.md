# Top 10 MCPs for AI-Assisted JRPG Development

Pick one engine MCP (Unity **or** Godot) and layer the rest on top.
Community MCP servers change quickly, so check each repo's README for current install steps before connecting.

| # | MCP | Category | Why it helps a JRPG |
|---|-----|----------|---------------------|
| 1 | **Godot MCP** (e.g. `Coding-Solo/godot-mcp`) | Engine | Run the project, read debug output, create and edit scenes and nodes. Godot is a strong fit for 2D and pixel-art JRPGs. |
| 2 | **Unity MCP** (e.g. `CoplayDev/unity-mcp`) | Engine | Drive the Unity Editor: GameObjects, scripts, prefabs, console. Use it if you want HD-2D or 3D. |
| 3 | **GitHub MCP** | Source control | Branches, issues and PRs. Track quests, systems and bugs as issues. Already available in this session. |
| 4 | **Figma MCP** | UI design | Design menus, battle HUD, dialogue boxes and inventory screens, then pull them into code. Already available in this session. |
| 5 | **Miro MCP** | Planning | Board out story arcs, world maps, quest flow, dungeon layouts and party and skill trees. Already available in this session. |
| 6 | **Blender MCP** (e.g. `ahujasid/blender-mcp`) | 3D assets | Generate and edit characters, props and environments for 3D or HD-2D scenes. |
| 7 | **Image generation MCP** (ComfyUI / Stable Diffusion / OpenAI Images) | 2D art | Concept art, character portraits, enemy sprites, tilesets and item icons. Keep a consistent style prompt. |
| 8 | **Audio / music MCP** (e.g. ElevenLabs) | Audio | Voice lines, sound effects and ambient audio. Pair with a music generator for town and battle themes. |
| 9 | **Context7** | Docs | Up-to-date engine and library docs (Godot, Unity, plugins) in context, so the AI stops guessing at stale APIs. |
| 10 | **Filesystem + Memory MCPs** | Project knowledge | Filesystem handles bulk edits to data files (items, enemies, dialogue JSON/CSV). Memory keeps your lore, naming rules and design pillars across sessions. |

## Suggested starter stack

1. Engine MCP (Godot or Unity)
2. GitHub
3. Context7
4. Memory

Add Figma, Miro, image generation and audio as you reach UI, planning and art/audio work.

## JRPG-specific tips

- Keep game data (stats, skills, items, dialogue) in plain JSON/CSV so the AI can edit it safely and you can diff it.
- Write a short design bible (tone, setting, battle system, naming conventions) and store it in Memory so generated content stays consistent.
- Prototype the core battle loop first, then exploration, then story content.
- Review every AI-generated asset and script for licensing and quality before shipping.
