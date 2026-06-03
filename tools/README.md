# GalForge tools

## `galforge_lint.py` — validate a GVNF project

Validates a [GVNF v1.0](../docs/spec/script-standard.md) project against the script standard
([§12](../docs/spec/script-standard.md)): JSON-Schema shape, cross-file references, the
two-character stage rule, localization completeness, and flow integrity.

```bash
python3 tools/galforge_lint.py <project_dir>            # errors + warnings
python3 tools/galforge_lint.py <project_dir> --strict   # warnings fail too (ship gate)
python3 tools/galforge_lint.py <project_dir> --json      # machine-readable
python3 tools/galforge_lint.py <project_dir> --schemas docs/spec/schemas
```

Exit codes: `0` clean · `1` errors (or warnings under `--strict`) · `2` load failure.

**Dependencies:** none required to run. Shape (JSON Schema) validation additionally uses
`jsonschema` + `referencing` if installed:

```bash
pip install jsonschema referencing
```

If they are absent the tool prints a notice and still performs the cross-file and stage-rule
checks (pure Python).

### What it enforces
- **Errors:** schema violations; missing assets (bg/cg/item/bgm/se/voice); undeclared sprite
  expression/outfit/pose; dangling `jump`/`call`/choice targets; **>2 visible sprites**
  (the two-character rule, §6.1); missing default-locale i18n keys; ambiguous command verbs;
  undeclared endings.
- **Warnings** (fail under `--strict`): inline text where an `@key` is expected; unused
  declared assets; unreachable scenes; variables read but never declared; scenes without an
  explicit `jump`/`end`; missing keys in non-default locales.

### Self-check
```bash
python3 tools/galforge_lint.py docs/samples/aoi-after-school --strict   # RESULT: clean ✓
```

Used by the [`galforge-lint`](../.claude/skills/galforge-lint/SKILL.md) skill and the
[`galforge-lint-qa`](../.claude/agents/galforge-lint-qa.md) agent.
