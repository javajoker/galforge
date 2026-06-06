---
name: galforge-generate
description: >-
  Generate a complete, lint-clean GalForge gal-game (a GVNF v1.0 project — game.json,
  characters, resources manifest, scene scripts, i18n) from a source text: a NOVEL / prose
  fiction, or a PLAINTEXT GAME SCRIPT (speaker: line dialogue, possibly with stage
  directions and choices). Orchestrates the galforge-* agents phase by phase and gates the
  result on `tools/galforge_lint.py`. USE THIS when the user says things like "turn this
  novel into a visual novel / galge", "generate a GalForge game from this script", "adapt
  this story into GVNF", "make a gal-game from this text", or drops a story/script file and
  asks for a playable VN project.
---

# galforge-generate — source text → playable GVNF project

Turns a **novel** or a **plaintext game script** into a complete, **lint-clean**
[GVNF v1.0](../../../docs/spec/script-standard.md) project, by running a fixed pipeline of
specialised agents and validating with `galforge lint`.

> **Read the standard first.** The authoritative format is
> [`docs/spec/script-standard.md`](../../../docs/spec/script-standard.md); schemas are in
> [`docs/spec/schemas/`](../../../docs/spec/schemas/); a worked example is
> [`docs/samples/aoi-after-school/`](../../../docs/samples/aoi-after-school/). Every agent
> below is bound to these. Do **not** invent format details — cite section numbers.

## 0. Intake — clarify before generating

Establish, asking the user only what you cannot infer:

1. **Source & mode.** Is the input a *novel/prose* (needs adaptation: scene segmentation,
   POV choice, invented branching) or a *plaintext game script* (mostly transcription +
   stage/resource filling)? Detect from the text; confirm only if ambiguous.
2. **Game id & title**, output directory (default `games/<game-id>/`).
3. **Branching.** Keep it linear, or introduce choices/routes/endings? (Novels usually
   need invented branch points; scripts may already have them.)
4. **Locales.** Default locale + any translations (default: source language only; offer
   `en` + `zh-TW`/`ja` if relevant).
5. **Scale guard.** If the source is large (a whole novel), agree a chapter range or an
   episode count for v1 rather than adapting everything at once.

Keep this short — one `AskUserQuestion` round at most. Sensible defaults beat interrogation.

## 1. Pipeline (each phase = one agent; hand off the artifact, then verify)

Run in order. After **every** phase, the conductor (you) runs `galforge lint` so errors are
caught at the boundary, not at the end.

| Phase | Agent | Reads | Produces |
|-------|-------|-------|----------|
| 1. Adapt | `galforge-adaptation-director` | source text | `adaptation-plan.md` + `game.json` skeleton |
| 2. Cast | `galforge-character-designer` | plan, source | `characters/*.json` + sprite-layer plan (in plan) |
| 3. Resources | `galforge-resource-planner` | plan, characters | `resources/manifest.json` (asset work-order) |
| 4. Script | `galforge-scene-writer` | plan, characters, manifest, source | `scenes/*.json`; updates `game.json` (entry, variables, endings) |
| 5. Localize | `galforge-localizer` | scenes, game, characters | `i18n/<locale>.json`; rewrites inline text to `@keys` |
| 6. QA | `galforge-lint-qa` | whole project | green `galforge lint`; fix loop until clean |

**Ordering rationale:** the manifest is a *contract* the scene-writer must honour (it may
add assets but must keep the manifest in sync); localization runs after scripting so it can
extract every displayable string; QA is last and owns the lint-clean gate.

## 2. The lint gate (non-negotiable)

```bash
python3 tools/galforge_lint.py games/<game-id>           # errors + warnings
python3 tools/galforge_lint.py games/<game-id> --strict  # ship gate: warnings fail too
python3 tools/galforge_lint.py games/<game-id> --json     # machine-readable for fix loops
```

- A phase is **not done** until `galforge lint` has no *new* errors attributable to it.
- The project is **deliverable** only when `--strict` exits 0 (0 errors, 0 warnings).
- The lint rules are the standard's [§12](../../../docs/spec/script-standard.md): missing
  assets, undeclared sprite states, dangling jumps, the **two-character stage limit**,
  missing default-locale keys, malformed conditions, etc.

## 3. Invariants every phase must uphold (from the standard)

- **Two-character stage rule (§6):** ≤ 2 sprites visible; multi-character scenes use
  `stageMode: "auto"` so the speaker alternation is handled — the scene-writer just writes
  `say` lines. Never emit a state that forces a third sprite.
- **Layered sprites (§3.3, §5):** expressions and outfits are declared per character and
  swapped with `face`/`outfit`; only use declared ids.
- **`@key` text (§1.3):** shippable text is i18n keys; the default locale must contain
  every key. (Drafts may be inline; the localizer converts them.)
- **Resolvable flow (§8.19):** every `jump`/`call`/choice target resolves to a scene/label.
- **Transitions / close-ups / CGs (§7, §8.9–§8.10):** use them deliberately for scene
  changes, item beats, and emotional CGs — they are first-class.

## 4. Delivery

Produce the project tree, then report:

```
games/<game-id>/
├── game.json
├── adaptation-plan.md          # design rationale, scene map, cast, branch graph
├── characters/*.json
├── resources/manifest.json     # also the asset work-order for art/voice generation
├── i18n/<locale>.json
└── scenes/*.json
```

Final summary to the user:
> Generated **<title>** — N scenes, N characters, N choices, N endings; locales: …
> `galforge lint --strict`: **clean ✓**.
> Resource work-order: N backgrounds, N sprite layers (poses×outfits + faces), N CGs,
> N items, N bgm, N se, N voice lines — see `resources/manifest.json` to hand to an
> art/voice pipeline.
> To play: point any GVNF runtime at `games/<game-id>/` (entry: `<entry-scene>`).

## Importing developer assets (out-of-band from the source-text pipeline)

The pipeline above adapts a *story* into a generated project. A **game developer** may also
hand you hand-built presentation to fold into a project — these are not generated from prose;
they are *imported* and wired in by a dedicated skill, then re-validated with `galforge lint`:

| Developer brings… | Use skill | Wires into |
|-------------------|-----------|------------|
| A custom **stage layout** (a scoped CSS that re-skins the normal play screen) | [`galforge-import-layout`](../galforge-import-layout/SKILL.md) | `ui/layouts/<id>.css` + `game.json` `ui.layouts` (web-runtime extension, lint-safe) |
| An **adhoc scene** (a JS module for a beat the §8 grammar can't model — minigame/map/puzzle) | [`galforge-import-adhoc`](../galforge-import-adhoc/SKILL.md) | `adhoc/<name>.js` (+ css) + a `scenes/<id>.json` `adhoc` block (§14), reached by `call`/`jump` |

Both are safe to run **before, during, or after** generation; both end on the same lint gate.
When generating, the scene-writer leaves any developer `ui` block / adhoc scene intact.

## Notes for the conductor

- If no galforge-* agents are available in this environment, run the phases inline yourself
  using each agent file in `.claude/agents/` as the spec for that phase.
- Prefer **small, valid increments**: generate one or two scenes end-to-end (through lint)
  before scaling to the whole source — surfaces format mistakes cheaply.
- Keep the manifest and scenes in lockstep; `galforge lint` reports referenced-but-missing
  and declared-but-unused assets — both should be zero at delivery.
