# games/

Generated GalForge games (GVNF projects). Each subdirectory is a self-contained project a
GVNF runtime can play.

## umbrella-share — *The Umbrella We Shared*

A **pipeline dry-run**: produced by the [`galforge-generate`](../.claude/skills/galforge-generate/SKILL.md)
flow from an original short novel ([`source.md`](umbrella-share/source.md)), running each
phase agent inline. It exercises the full standard — sprite-less protagonist, a 4-speaker
conversation that never shows more than two sprites (Rui's entrance evicts the non-active
partner), expression + outfit changes, an item close-up, two CG endings, a branching choice,
variables, and localization.

- Design rationale & scene map: [`adaptation-plan.md`](umbrella-share/adaptation-plan.md)
- Validate: `python3 tools/galforge_lint.py games/umbrella-share --strict` → **clean ✓**
- Entry scene: `s01_busstop` · Endings: `nao_end`, `shizuku_end`
