# GVNF JSON Schemas (v1.0)

Machine-validatable schemas for every GVNF document type. Normative prose lives in the
[Script Standard](../script-standard.md); these schemas are the enforceable subset.

| Schema | Validates | Spec |
|--------|-----------|------|
| [common.schema.json](common.schema.json) | Shared `$defs` (id, color, position, text, transition, condition, assignments) | §1 |
| [game.schema.json](game.schema.json) | `game.json` project manifest | §2 |
| [resource-manifest.schema.json](resource-manifest.schema.json) | `resources/manifest.json` | §3 |
| [locale.schema.json](locale.schema.json) | `i18n/<locale>.json` string tables | §4 |
| [character.schema.json](character.schema.json) | `characters/<id>.json` | §5 |
| [scene.schema.json](scene.schema.json) | `scenes/<id>.json` command scripts & adhoc scenes | §6–§9, §14 |
| [save.schema.json](save.schema.json) | Save snapshots | §11 |

## What schemas do and don't cover

Schemas enforce **shape**: required fields, types, enums, value ranges, and that every
command matches a known verb. They intentionally do **not** enforce **cross-file** rules —
those are the validator's job (Script Standard §12), e.g.:

- a referenced asset/voice id exists in the manifest;
- a sprite uses only a character's declared outfits/poses/expressions;
- every `jump`/`call`/choice target resolves;
- the two-character stage limit is satisfiable;
- every i18n key exists in the default locale.

A command resolves to **exactly one** command verb; the schema validates "matches at least
one verb shape" (`anyOf`) and leaves the exactly-one rule to lint. The keys `face`,
`outfit`, and `voice` are dual-use (standalone verb vs. inline modifier) and are
disambiguated per Script Standard §8.0.

## Using the schemas

Draft 2020-12. `$ref`s are relative, so validate with the `schemas/` directory intact.

```bash
# Example with ajv-cli (resolve siblings via -r)
ajv validate -c ajv-formats \
  -s game.schema.json \
  -r common.schema.json \
  -d ../../samples/aoi-after-school/game.json

ajv validate -s scene.schema.json -r common.schema.json \
  -d ../../samples/aoi-after-school/scenes/s01_classroom.json
```
