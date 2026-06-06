# Extensions demo — importing developer-built presentation

A tiny, **lint-clean, runnable** GVNF project whose only job is to show how the two
import skills fold a **game developer's** hand-built presentation into a project:

- **`galforge-import-layout`** → a custom **stage layout** (`visor`) that re-skins the play screen.
- **`galforge-import-adhoc`** → an **adhoc scene** (`quiz`) for a beat the §8 command grammar can't model.

The contract both follow is specified in
[`docs/spec/developer-extensions.md`](../../docs/spec/developer-extensions.md). This project is
the worked example that spec points at.

## The flow

`s01_intro` (a normal `script` scene) introduces the two extensions, `call`s the adhoc quiz
`q_quiz`, then branches on the `passed` flag the quiz wrote back, and ends.

```
s01_intro ──call q_quiz (ADHOC §14: 3-question quiz module)
              ├─ exit "pass" (return, passed=true)  ─┐
              └─ exit "fail" (return, passed=false) ─┤→ resume s01_intro
                                                      └→ if passed → "you passed" line
                                                         else      → "didn't pass" line  → end "cleared"
```

## Layout

```
extensions-demo/
├── game.json                 # entry s01_intro; `ui.layouts` registers the `visor` layout
├── characters/guide.json
├── resources/manifest.json
├── i18n/en.json
├── scenes/
│   ├── s01_intro.json        # script scene: intro → call q_quiz → branch → end
│   └── q_quiz.json           # ADHOC scene: wires adhoc/quiz.js (params/exits/fallback)
├── adhoc/                    # the developer's adhoc-scene module + style (drop-in)
│   ├── quiz.js               #   generic multiple-choice quiz; follows the §14.2 fn spec
│   └── quiz.css
└── ui/
    └── layouts/
        └── visor.css         # the developer's custom layout (drop-in), scoped to data-layout="visor"
```

## How each was imported

### 1. Custom layout — `galforge-import-layout`

The developer brings **`ui/layouts/visor.css`** — a stylesheet scoped entirely under
`.gf-stage[data-layout="visor"]` that targets only the standard stage zones (the "layout API"
in developer-extensions.md §2.3). Importing it = placing the file under `ui/layouts/` and adding
one entry to `game.json`:

```jsonc
"ui": {
  "layout": "adv",                       // game default (visor is offered, not forced)
  "layouts": [
    { "id": "visor", "name": "Visor HUD (custom)", "short": "Visor",
      "style": "ui/layouts/visor.css", "interaction": "overlay" }
  ]
}
```

At runtime the player lists *Visor HUD (custom)* in its **Layout** picker and toggles it on by
setting `data-layout="visor"` on the stage root. (Lint-safe: `ui` is a web-runtime extension the
schema tolerates and `galforge lint` ignores.)

### 2. Adhoc scene — `galforge-import-adhoc`

The developer brings **`adhoc/quiz.js`** (+ `quiz.css`), an ES module that follows the adhoc
function spec: `export default mount(ctx) -> { exit, set }`, renders its own DOM into
`ctx.root`, honours `ctx.signal`, and is fully driven by `adhoc.params`. Importing it = placing
the files under `adhoc/` and authoring **`scenes/q_quiz.json`** with an `adhoc` block declaring
the module, its `params` (questions/passMark/exit ids), the `reads`/`writes` variable interface,
the `exits` (`pass`/`fail`, both `return`), and a mandatory `fallback`. A normal scene reaches it
with `{ "call": "q_quiz" }`.

## Validate & run

```bash
python3 tools/galforge_lint.py games/extensions-demo --strict   # clean ✓

# In the web runtime (web/), this game is bundled (web/scripts/sync-content.mjs):
#   npm --prefix web run dev   →   open #/play/extensions-demo
#   pick "Visor HUD (custom)" from the Layout control; play into the quiz.
```
