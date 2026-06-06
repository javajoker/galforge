---
name: galforge-import-layout
description: >-
  Import a game developer's own custom stage layout (a CSS stylesheet that re-arranges /
  re-skins the play screen) into a GalForge GVNF project: place it under ui/layouts/, register
  it in game.json `ui.layouts`, verify it is correctly scoped to the layout's data-layout id
  and targets only the standard stage zones, and confirm `galforge lint` stays clean. The `ui`
  block is a lint-safe web-runtime extension (not GVNF core). USE THIS when a developer hands
  you a layout/theme CSS and says "wire this layout into my game", "add my custom stage
  layout", "register this player skin", "import this look", or asks to make a game default to a
  bespoke layout. For a fully bespoke *beat* (minigame/map/terminal) use galforge-import-adhoc
  instead — that's an adhoc *scene*; this is a layout for the *normal* play screen.
---

# galforge-import-layout — wire a developer's custom stage layout into a project

A **custom layout** re-styles the *standard* play screen (it does not replace it) by shipping
a scoped stylesheet with the game and registering it in `game.json` under a `ui` block. The
web runtime injects the stylesheet, adds the layout to the player's **Layout** picker (under
*Custom (this game)*), and toggles it on by setting `data-layout="<id>"` on the stage root —
no player fork. This is the layout-level counterpart to the §14 adhoc *scene* escape hatch.

> **Contract (read first).**
> [`docs/spec/developer-extensions.md` §2](../../../docs/spec/developer-extensions.md) — the
> authoritative `ui.layouts` + `data-layout` scoping + zone-class API. Web-runtime detail:
> [`web/README.md` › *Developer (adhoc) layouts*](../../../web/README.md).
> **Worked examples.** Runnable demo:
> [`games/extensions-demo/ui/layouts/visor.css`](../../../games/extensions-demo/ui/layouts/visor.css)
> (+ its [`README`](../../../games/extensions-demo/README.md)); also
> [`docs/samples/aoi-after-school/ui/layouts/scrapbook.css`](../../../docs/samples/aoi-after-school/ui/layouts/scrapbook.css)
> and [`games/umbrella-share/ui/layouts/spotlight.css`](../../../games/umbrella-share/ui/layouts/spotlight.css).
> Engine resolution: `web/src/ui/layouts.js`, `web/src/engine/engine.js` (`buildUI`).

## 0. Intake — establish before wiring

Ask only what you cannot infer from the file or the project:

1. **The stylesheet** — the developer's CSS (file or content) and which **project** it belongs to.
2. **Layout id** — a short id, **must not collide** with a built-in: `adv`, `nvl`,
   `dock-left`, `dock-right`, `cinematic`. (Layout ids are web ids, so hyphens are fine, e.g.
   `noir`, `dock-wide`.) The file goes at `ui/layouts/<id>.css`.
3. **Display name** (shown in the picker, e.g. `"Noir (custom)"`), optional **short** label,
   optional **desc**.
4. **Interaction mode** — `overlay` (choices/adhoc float centered over the stage) or `dock`
   (they live in a side panel). Default `overlay`.
5. **Default?** — should this be the game's default layout (`ui.layout: "<id>"`), or just
   *offered* in the picker (leave `ui.layout` as-is / `adv`)?

## 1. Audit the CSS against the zone contract (the load-bearing step)

A custom layout may **only restyle the existing zones**; it cannot add DOM. Two hard rules:

- **Scope every rule under the layout id.** Each selector MUST start with
  `.gf-stage[data-layout="<id>"]` (landscape-only rules: `.gf-stage:not(.portrait)[data-layout="<id>"]`).
  Unscoped rules leak into the other layouts — reject/scope them. Portrait is left alone so
  phones keep the clean single-character bottom bar (Script Standard §6 portrait collapse).
- **Target only the standard stage-zone classes** the player exposes:

  | Selector (under `.gf-stage[data-layout="ID"]`) | Zone |
  |---|---|
  | `.gf-scene` | zone 1+2: background + sprites (`.gf-slot.active` / `.gf-slot.dim`; `--c` = char colour) |
  | `.gf-dialogue` | zone 3: dialogue box (`--nc` custom prop = the speaker's nameplate colour) |
  | `.gf-interaction.overlay` / `.dock` | zone 4: choices / adhoc (also `.expanded` / `.collapsed`) |
  | `.gf-name`, `.gf-text`, `.gf-advance` | nameplate / line / advance caret |
  | `.gf-controls`, `.gf-bgm-hud` | player chrome — shift these if your layout needs the corner |

  Selectors outside this set (or unscoped) are a smell: a layout that needs new structure or
  its own controls wants an **adhoc scene** (`galforge-import-adhoc`), not a layout.

If the developer's CSS isn't scoped, wrap/prefix its selectors with the `data-layout` id
rather than passing it through unchanged.

## 2. Place the file

```
<project>/
└── ui/
    └── layouts/
        └── <id>.css
```

Keep the project relative path; the manifest is not involved (layouts are not GVNF assets).

## 3. Register it in `game.json` `ui.layouts`

Create the `ui` block if absent (top-level key, alongside `stage`/`transitions`):

```jsonc
"ui": {
  "layout": "adv",            // game default ("<id>" to default to the custom one)
  "layouts": [
    {
      "id": "<id>",                 // your id; must not collide with a built-in
      "name": "<Name> (custom)",    // shown in the Layout picker
      "short": "<Short>",           // optional compact label
      "desc": "<one line>",         // optional, shown in the picker
      "style": "ui/layouts/<id>.css", // project-relative href (or absolute URL)
      "interaction": "overlay"      // "overlay" | "dock"
    }
  ]
}
```

- `style` is resolved exactly like an adhoc scene's `style` (project-root-relative → URL).
- Multiple custom layouts: add more entries to the `layouts` array (each its own file/id).
- The runtime keeps each stylesheet loaded but inert (scoped by `data-layout`), so switching
  is instant and flash-free.

## 4. Verify — lint clean + (if a runtime is handy) render

```bash
python3 tools/galforge_lint.py <project> --strict   # must stay clean ✓
```

The `ui` block is a **web-runtime extension, not GVNF core**: `game.schema.json` tolerates it
(top-level `additionalProperties`) and `galforge_lint.py` does **not** interpret it — so it is
lint-safe and portable (a runtime that doesn't know layouts just renders its default screen).
Lint will *not* validate the CSS, the `style` path, or the layout id; that's a runtime concern.

If a web runtime is available, confirm live (see `web/README.md`): the layout appears in the
**Layout** picker as *<Name> (custom)*; selecting it sets `data-layout="<id>"`; a stylesheet
`<link data-gf-layout-style="<id>">` is injected; the look only applies in landscape; and
`--nc` on `.gf-dialogue` tracks the active speaker. No console errors.

## Trust & boundary

Custom-layout CSS is **game content** (same trust level as a §14 adhoc module, which already
runs JS). It can only restyle the existing zones. The moment a developer needs *new*
presentation or interaction (a minigame, a map, a data terminal, bespoke controls), that's an
adhoc **scene** — hand off to `galforge-import-adhoc`.
