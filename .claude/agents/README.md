# GalForge generation agents

A pipeline of specialised agents that turn a **novel** or **plaintext game script** into a
complete, lint-clean [GVNF v1.0](../../docs/spec/script-standard.md) gal-game. Orchestrated
by the [`galforge-generate`](../skills/galforge-generate/SKILL.md) skill; gated by
[`galforge-lint`](../skills/galforge-lint/SKILL.md) (`tools/galforge_lint.py`).

## The group & hand-offs

```
source text
   │
   ▼
[galforge-adaptation-director] ──► adaptation-plan.md + game.json skeleton
   │   (scene map, cast, POV, branch graph, where CGs/close-ups/expressions go)
   ▼
[galforge-character-designer]  ──► characters/*.json + sprite-layer plan
   │   (name/color/voice; declared expressions & outfits per character)
   ▼
[galforge-resource-planner]    ──► resources/manifest.json  (the asset work-order)
   │   (backgrounds, layered sprites, cg, items, bgm, se, voice — declared up front)
   ▼
[galforge-scene-writer]        ──► scenes/*.json + game.json (entry/vars/endings)
   │   (command lists: say/show/face/outfit/bg/bgm/closeup/choice/jump …,
   │    obeying the two-character stage rule and transitions)
   ▼
[galforge-localizer]           ──► i18n/<locale>.json  (+ rewrite inline text to @keys)
   │
   ▼
[galforge-lint-qa]             ──► `galforge lint --strict` clean ✓  (fix loop)
```

| From → To | Artifact passed | The receiver accepts it when… |
|-----------|-----------------|-------------------------------|
| director → character-designer | `adaptation-plan.md` | cast list + each character's needed expressions/outfits are enumerated |
| character-designer → resource-planner | `characters/*.json` | every character validates against `character.schema.json`; sprite states listed |
| resource-planner → scene-writer | `resources/manifest.json` | validates against `resource-manifest.schema.json`; covers the plan's assets |
| scene-writer → localizer | `scenes/*.json` + `game.json` | `galforge lint` has **0 errors** (warnings about inline text are expected) |
| localizer → lint-qa | `i18n/*.json` | default locale holds every `@key`; scenes use keys not prose |
| lint-qa → (delivery) | whole project | `galforge lint --strict` exits 0 |

## Shared contract (every agent obeys)

- **Source of truth:** [`docs/spec/script-standard.md`](../../docs/spec/script-standard.md) +
  [`docs/spec/schemas/`](../../docs/spec/schemas/). Cite section numbers; never invent format.
- **Reference example:** [`docs/samples/aoi-after-school/`](../../docs/samples/aoi-after-school/) —
  the gold-standard shape for every file type.
- **Validate continuously:** run `python3 tools/galforge_lint.py <project>` after your phase;
  do not hand off with errors you introduced.
- **Two-character stage rule (§6):** never produce a state with 3 visible sprites; prefer
  `stageMode: "auto"`.
- **`@key` localization (§1.3):** the scene-writer may draft inline; the localizer makes it
  keyed; the default locale must hold every key.

## Running them

These are invoked by the `galforge-generate` orchestrator via the Agent tool. If no
subagents are available, a single Claude can execute each phase inline using that agent's
file as the phase spec.

## Adjacent: importing developer-built presentation

The pipeline above turns *prose* into a project. When a **game developer** supplies hand-built
presentation to fold into a project, it is *imported* (not generated) by a dedicated skill and
re-validated on the same lint gate. These run on demand, independent of the source-text flow:

- [`galforge-import-layout`](../skills/galforge-import-layout/SKILL.md) — wire a developer's
  custom **stage layout** (a scoped CSS that re-skins the normal play screen) into
  `ui/layouts/` + `game.json` `ui.layouts` (a lint-safe web-runtime extension, not GVNF core).
- [`galforge-import-adhoc`](../skills/galforge-import-adhoc/SKILL.md) — wire a developer's
  **adhoc scene** (a JS module for a beat the §8 grammar can't model — minigame / map /
  puzzle) into `adhoc/` + a `scenes/<id>.json` `adhoc` block (Script Standard §14).

The `galforge-scene-writer` recognises both and leaves any developer `ui` block / adhoc scene
intact when it finalises `game.json` and scenes. The contract for both extension points is
specified in [`docs/spec/developer-extensions.md`](../../docs/spec/developer-extensions.md), with
a runnable demo in [`games/extensions-demo/`](../../games/extensions-demo/).
