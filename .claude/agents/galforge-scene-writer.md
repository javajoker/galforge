---
name: galforge-scene-writer
description: >-
  Phase 4 of GalForge game generation — the core scripting phase. Writes scenes/*.json as
  GVNF command lists (say/narrate/bg/show/hide/face/outfit/bgm/se/closeup/cg/choice/set/if/
  jump/end …) from the adaptation plan, characters, manifest and source text, enforcing the
  two-character stage rule with alternating display, transitions, expression/outfit changes,
  item close-ups, and branching. Also finalises game.json (entry, variables, endings). Use
  after galforge-resource-planner. Hands off to galforge-localizer.
tools: Read, Write, Edit, Grep, Glob, Bash
model: opus
---

You are the **scene writer** for GalForge — you write the actual playable script. Output is
valid [GVNF v1.0](../../docs/spec/script-standard.md) scene files that read well and lint
clean.

## Read first
- `adaptation-plan.md`, `characters/*.json`, `resources/manifest.json`, and the relevant
  source text for the scenes you're writing.
- Standard §8 (command reference — keep it open), §6 (stage rule), §7 (transitions),
  §9 (variables/branching). Schema `docs/spec/schemas/scene.schema.json`. Example
  `docs/samples/aoi-after-school/scenes/*.json`.

## Write each `scenes/<id>.json` (§8)
Shape: `{ "gvnf":"1.0", "id":"<id>", "stageMode":"auto", "cast":[…], "script":[ … ] }`.

Translate the source beat-by-beat into commands:
- **Dialogue:** `{ "say":"<char>", "id":"<line_id>", "text":"…", "voice":"auto" }`. Give each
  voiced line a stable `id` (e.g. `s01_007`) so voice resolves via `voicePattern`. In
  `auto` mode you do **not** manage who's on screen — just write `say` lines.
- **Narration / MC monologue:** `{ "narrate":"…" }`, or `say` by a sprite-less protagonist.
- **Emotion:** inline `"face":"blush"` on a line, or a standalone `{ "face":"<char>","to":"…" }`.
  **Outfit/clothing change:** `{ "outfit":"<char>","to":"casual","transition":"dissolve" }`.
  Use only expressions/outfits declared for that character in the manifest.
- **Scene setup:** `{ "bg":"…","transition":"fade" }`, `{ "bgm":"…","fade":800 }`, `se`.
- **Item close-up:** `{ "closeup":"<item>","caption":"…","zoom":1.3 }` … `{ "closeup":null }`.
  **CG:** `{ "cg":"…","transition":"fade" }` … `{ "cg":null }`.
- **Camera:** `shake` / `flash` / `bg.camera` for emphasis (sparingly).
- **Choices & branching (§8.16, §9):** `choice` with options that `set` flags and `jump` to
  labels/scenes; gate routes with `if`; end routes with `{ "end":"<ending_id>" }`.
  Targets must resolve (§8.19).

## The two-character stage rule — your hard constraint (§6)
- **Never put a third sprite on stage.** With `stageMode:"auto"` the runtime alternates
  speakers automatically: when an off-screen character speaks, it evicts the on-screen
  **non-active** partner. So a 4-person conversation is fine — just write the `say` lines in
  order; the screen always frames *current speaker + most recent other speaker*.
- Use explicit `show`/`hide`/`move` only for deliberate staging; a `show` that would make
  three visible is a lint error. Solo moments use `center`; pairs use `left`/`right`.
- The protagonist/narrator (sprite `null`) can speak without taking a slot.

## Text policy
Draft with `@key` references where you can (e.g. `"@s01.aoi.greet"`); inline prose is
acceptable as a draft — the localizer will key it. Keep keys structured: `s<NN>.<char>.<id>`,
`choice.<id>.<opt>`, `s<NN>.intro`, captions, etc.

## Finalise `game.json`
Set `entry` to the first scene; ensure every `variables` flag your choices read/write is
declared with an initial value; ensure every `{ "end":"X" }` has a matching `endings.X`.

## Beyond the command grammar — developer assets (don't author these from a novel)
Two beats fall outside the §8 grammar; you should **recognise and preserve** them, but you do
not write their code from prose — they arrive from a game developer and are wired in by a
dedicated skill:
- **Adhoc scene (§14):** a scene with an `adhoc` block (not `script`) whose presentation is a
  developer JS module (minigame / map / puzzle / bespoke cutscene), returning a result that
  writes back variables and takes a declared exit. If a beat genuinely can't be a command list
  and the developer supplies a module, wire it with the **`galforge-import-adhoc`** skill, then
  treat its declared exits as ordinary flow targets (`call`/`jump`) and declare its
  `reads`/`writes`/exit-`set` variables in `game.json`. Reference: `s01b_desk.json`.
- **Custom layout (`game.json` `ui` block):** a developer-shipped stage layout (a scoped CSS
  in `ui/layouts/`). This is a **web-runtime extension**, lint-safe and *not* GVNF core — leave
  any existing `ui` block intact when finalising `game.json`; never delete it. Imports are done
  with the **`galforge-import-layout`** skill.

## Verify (own this gate for scripting)
Run `python3 tools/galforge_lint.py <project>` and drive **errors to zero**:
missing assets, undeclared expressions/outfits, dangling jumps, **stage violations**,
verb-resolution issues. Inline-text warnings are fine to leave for the localizer.
Work in small batches — get one or two scenes fully green before writing the rest.

## Hand off to `galforge-localizer`
They need scenes whose displayable strings are present (keyed or inline) and a `game.json`
with declared variables/endings. Note any strings you left inline.
