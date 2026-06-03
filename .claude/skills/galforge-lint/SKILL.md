---
name: galforge-lint
description: >-
  Validate a GalForge GVNF project (game.json + characters/ + resources/manifest.json +
  i18n/ + scenes/) and interpret the results: JSON-Schema shape errors, cross-file reference
  errors (missing assets, undeclared sprite expressions/outfits, dangling jump/choice
  targets, missing i18n keys), the two-character stage-rule check, and warnings (unused
  assets, unreachable scenes, inline text, undeclared variables). USE THIS when the user
  says "lint this game", "validate the GVNF project", "is this VN project valid", "check the
  script standard compliance", or after generating/editing any GVNF files. Wraps
  tools/galforge_lint.py.
---

# galforge-lint — validate a GVNF project

Runs `tools/galforge_lint.py` against a GalForge project and turns its output into concrete
fixes, tied to the standard [`docs/spec/script-standard.md` §12](../../../docs/spec/script-standard.md).

## Run

```bash
python3 tools/galforge_lint.py <project_dir>            # errors + warnings, human-readable
python3 tools/galforge_lint.py <project_dir> --strict   # warnings fail too (ship gate)
python3 tools/galforge_lint.py <project_dir> --json      # machine-readable (for fix loops)
python3 tools/galforge_lint.py <project_dir> --schemas docs/spec/schemas  # explicit schemas
```

Exit codes: `0` clean (no errors; `--strict` also requires no warnings) · `1` errors ·
`2` project could not be loaded. Shape validation needs `jsonschema`+`referencing`; if they
are absent the tool says so and still runs the cross-file + stage checks.

## What it checks (and how to fix)

**Errors (must fix):**
- *Schema shape* — a file violates its JSON Schema. Fix the offending field per
  `docs/spec/schemas/`.
- *Missing asset* — `background/cg/item/bgm/se/voice 'X' not in manifest`: add X to
  `resources/manifest.json` (§3) or correct the reference.
- *Undeclared sprite state* — `'aoi' has no expression/outfit/pose 'X'`: add the layer to
  the character's `sprites` entry (§3.3) or use a declared id.
- *Dangling flow* — `jump target scene/label not found`: fix the `jump`/`call`/option
  target (§8.19).
- *Stage violation* — `stage shows 3 characters simultaneously`: the **two-character rule**
  (§6.1). Use `stageMode: "auto"` and let alternation handle extra speakers, or `hide`
  someone before the third `show`.
- *Localization* — `i18n key 'k' missing from default locale`: add it to the default
  `i18n/<default>.json` (§4).
- *Verb resolution* — `command does not resolve to exactly one verb`: a command has two
  primary verbs, or a dual-use `face`/`outfit`/`voice` is ambiguous (§8.0).

**Warnings (fix before ship; `--strict` makes them fail):**
- Inline literal text where an `@key` is expected → run the localizer.
- Unused declared asset / unreachable scene / variable read but never declared.
- Scene ends without an explicit `jump`/`end`.

## Fix loop

1. Run with `--json`; parse `errors`/`warnings`.
2. Fix the highest-impact errors first (missing assets and stage violations cascade).
3. Re-run. Repeat until `--strict` exits `0`.
4. Report: counts before/after and the final `RESULT: clean ✓`.

## Quick self-check

```bash
python3 tools/galforge_lint.py docs/samples/aoi-after-school --strict   # must be clean ✓
```
If the bundled sample does not lint clean, the tool or schemas regressed — investigate
before trusting results on other projects.
