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

## echo — *ECHO*

A longer adaptation (English-first, full Simplified-Chinese track) with four routes, screen-
presence characters, CGs, and an **adhoc scene** demonstrating the §14 escape hatch: in the
Mirror Gallery the system runs a custom-styled *calibration terminal*
([`adhoc/calibration.js`](echo/adhoc/calibration.js) + [`adhoc/calibration.css`](echo/adhoc/calibration.css)),
a profiling quiz with its own layout and interactions. It is `call`ed from
`s04_mirror_gallery`; its result tunes the three "lean" variables and a `return` exit resumes
the scene (a `skip` exit and a `fallback` keep the game completable either way).

- Adhoc scene: [`scenes/s04b_calibration.json`](echo/scenes/s04b_calibration.json) (`kind: "adhoc"`)
- Validate: `python3 tools/galforge_lint.py games/echo --strict` → **clean ✓**
- Entry scene: `s01_order_hall` · Endings: `order_end`, `chaos_end`, `shelter_end`, `refuse_end`
