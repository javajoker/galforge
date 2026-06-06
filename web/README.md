# GalForge — React runtime (publishable web app)

A **React + Vite** player for **GVNF v1.0** projects. Unlike the zero-build
reference in [`../runtime/`](../runtime/), this one is meant to be **built and
shipped**: games are bundled into the app and selected by **route**, so the
output of `npm run build` is a self-contained static site you can drop on any
host — **no query string, no server**.

It also adds **responsive design** and **selectable stage layouts**: the play
screen is built from four swappable zones (background, sprites, dialogue,
interaction) that a game engineer can re-arrange via named layout presets
(ADV / NVL / dock / cinematic) — see [Stage layouts](#stage-layouts). On a
vertical (portrait) screen the stage shows a **single character at a time** (the
active speaker, on its own side) instead of two side-by-side, so phones stay
clean.

> The engine in [`src/engine/`](src/engine/) is a UI-agnostic port of the
> canonical [`../runtime/galforge.js`](../runtime/galforge.js) — same format
> semantics (two-character stage, alternating display, transitions, layered
> sprites, branching, i18n, voice, §11 save/load, and §14 adhoc scenes), just
> driven by React.

## Quick start

```bash
cd web
npm install
npm run dev            # http://localhost:5173  → game menu
npm run build          # → dist/  (static, self-contained)
npm run preview        # serve the built dist/ locally
```

`npm run dev`/`build` first run `scripts/sync-content.mjs`, which copies the
GVNF projects into `public/content/<id>/` (git-ignored) so the build ships the
games it can play.

## Selecting a game — by route, not query string

Routing is **hash-based** (`HashRouter`) so deep links work on any static host
(including project sub-paths like GitHub Pages) with no rewrite rules:

| URL | Shows |
|-----|-------|
| `#/` | the game-select menu |
| `#/play/umbrella-share` | plays that game |
| `#/play/aoi-after-school` | plays that game |

### Publish a single title

Set one field in [`src/config.js`](src/config.js) and `#/` boots straight into
the game (no menu):

```js
export const CONFIG = { appTitle: "…", defaultGame: "umbrella-share" };
```

Then `npm run build` and deploy `dist/` anywhere. Because Vite is configured
with `base: "./"`, the bundle is path-relative and works at any URL depth.

## Adding / changing bundled games

Edit the `SOURCES` array in [`scripts/sync-content.mjs`](scripts/sync-content.mjs)
to point at any GVNF project directory (the one containing `game.json`). The
menu and router are then fully data-driven from `public/content/index.json`.

## Responsive (vertical screen) behaviour

The stage adapts to orientation:

- **Landscape** — the full **two-character** stage with alternating emphasis
  (active bright, partner dimmed).
- **Portrait** — only the **active speaker** is drawn, on its own side
  (left/right, alternating as the speaker changes); the stage fills the whole
  viewport instead of letterboxing. The underlying two-character *model* is
  unchanged — this is purely a presentation choice for narrow screens.

## Stage layouts

The play screen is composed of **four swappable zones**, each its own component
under [`src/ui/zones/`](src/ui/zones/):

| # | Zone | Component | Draws |
|---|------|-----------|-------|
| 1 | **Background view** | `BackgroundView.jsx` | scene backdrop, CG, item close-up |
| 2 | **Sprite view** | `SpriteView.jsx` | the two-character stage (single character in portrait) |
| 3 | **Dialogue box** | `DialogueBox.jsx` | nameplate + typewriter line + advance caret |
| 4 | **Interaction** | `InteractionView.jsx` | branch choices **and** adhoc scenes — *expandable* |

A **layout** is a named arrangement of those zones. The zones never change; a
layout only decides *where* the dialogue + interaction sit and how much room the
stage gets. It is applied as a `data-layout` attribute on the stage root, so all
positioning lives in CSS and a layout swaps live with **no re-mount**. Five
presets ship (see [`src/ui/layouts.js`](src/ui/layouts.js)):

| id | Layout |
|----|--------|
| `adv` | **ADV** — dialogue bar across the bottom, stage above (default) |
| `nvl` | **NVL** — a large translucent reading panel over dimmed sprites |
| `dock-right` | **Dock R** — dialogue + interaction in a right-hand side panel |
| `dock-left` | **Dock L** — same, mirrored to the left |
| `cinematic` | **Cinematic** — letterboxed frame with a centered subtitle line |

**Expandable interaction.** Zone 4 hosts both choices and adhoc modules and can
be **expanded ⇄ docked** at runtime with the `⤢`/`⤡` toggle: in the dock layouts
choices live in the side panel and expand to a full-stage overlay; in the bar
layouts they fill the stage and collapse to a compact bottom strip. A
*fullscreen* adhoc scene (§14) is an immersive takeover that ignores layout
entirely.

**Choosing a layout** (highest priority first):

1. **Live** — the **Layout** control on the play screen (great for previewing).
   The choice persists across games and reloads (`localStorage`); pick **Auto**
   to follow whatever each game asks for.
2. **Per game** — declare a default in `game.json`:
   ```json
   "ui": { "layout": "nvl" }
   ```
   (a web-runtime extension; lint-safe — the schema ignores it).
3. **App default** — `CONFIG.layout` in [`src/config.js`](src/config.js).
4. Otherwise the built-in default, `adv`.

Portrait screens always collapse to the clean single-character bottom-bar form
regardless of the selected layout.

### Developer (adhoc) layouts — design your own

A game isn't limited to the five built-ins: a developer can **register their own
stage layout** by shipping a stylesheet with the game and listing it under
`game.json` `ui.layouts`. The runtime injects the stylesheet, adds the layout to
the **Layout** picker (under *Custom (this game)*), and toggles it on with
`data-layout="<your-id>"` — no player fork required. This is the layout-level
counterpart to the §14 adhoc *scene* escape hatch.

```jsonc
// game.json
"ui": {
  "layout": "spotlight",          // make it the game's default (optional)
  "layouts": [
    {
      "id": "spotlight",           // your id (must not collide with a built-in)
      "name": "Spotlight (custom)",// shown in the picker
      "short": "Spot",             // optional compact label
      "style": "ui/layouts/spotlight.css",  // game-relative href (or absolute URL)
      "interaction": "overlay"     // default interaction-zone mode: overlay | dock
    }
  ]
}
```

Your CSS targets the same **zone classes** the player exposes, and **must be
scoped** under your `data-layout` id so it only applies when active:

| Selector | Zone |
|----------|------|
| `.gf-stage[data-layout="ID"] .gf-scene` | background + sprites (`.gf-slot.active` / `.gf-slot.dim`) |
| `… .gf-dialogue` | dialogue box — `--nc` custom prop carries the speaker's colour |
| `… .gf-interaction.overlay` / `.dock` | choices / adhoc zone (also `.expanded` / `.collapsed`) |
| `… .gf-controls`, `… .gf-bgm-hud` | player chrome (shift these if your layout needs the corner) |

Scope landscape-only rules with `.gf-stage:not(.portrait)[data-layout="ID"] …`
so portrait keeps the clean phone form. A worked example ships with the
umbrella-share game:
[`games/umbrella-share/ui/layouts/spotlight.css`](../games/umbrella-share/ui/layouts/spotlight.css)
— a focus-vignette layout that spotlights the active speaker and floats the line
in a card accented with the speaker's colour.

> Custom-layout CSS is game content (same trust level as §14 adhoc modules,
> which already run JS). It can only restyle the existing zones — for fully
> bespoke *presentation/interaction* (a minigame, map, terminal…), reach for an
> adhoc **scene** instead.

## No art? No problem.

The sample projects ship **no binary assets**. Missing images/audio degrade to
labelled placeholders (colour-keyed silhouettes with the character / outfit /
expression; gradients + id for backgrounds, CG and items; a `♪ id` HUD for
music). Drop real files at the manifest's paths and they appear automatically —
`body` + `face` layers are composited per the layered-sprite model.

## Controls

- **Click / Space / Enter** — advance (first press completes the typewriter).
- **Auto** (or `A`) — auto-advance. **Skip** — fast-forward.
- **Log** — backlog. **Save / Load** — 4 `localStorage` slots (snapshot per §11).
- **Layout** — switch stage layout live (ADV / NVL / Dock / Cinematic / Auto).
- **Language** — switch among the project's locales (shown when >1).
- **⤢ / ⤡** — expand or dock the interaction zone (during a choice / adhoc scene).
- **☰** — back to the game list.

## Verified

Browser-verified end-to-end (both bundled games): route-based boot, two-character
alternating emphasis, third-speaker eviction (never 3 sprites), expression
swaps, item close-up + caption, bg transitions, branching choice → variables →
route → CG → ending, EN↔JA live locale switch, and a save/load round-trip whose
snapshot validates against `save.schema.json`. Portrait mode verified to render a
single active character that alternates sides with the speaker. All five stage
layouts verified live (ADV / NVL / dock-left / dock-right / cinematic), plus the
expand⇄dock interaction toggle, the fullscreen-adhoc takeover, and a
developer-registered **custom layout** (umbrella-share's `spotlight`) loading its
own stylesheet from the game's content and appearing in the Layout picker.

## Source map

| Path | Role |
|------|------|
| `src/engine/engine.js` | GVNF state machine (UI-agnostic): loader, command loop, two-character stage, save/load — emits an immutable view model. |
| `src/engine/evalExpr.js` | Safe expression evaluator (§9.3), shared semantics with the vanilla runtime. |
| `src/hooks.js` | `useEngine`, `useOrientation`, `useTypewriter`, `useAudio`. |
| `src/ui/layouts.js` | Stage-layout registry (the 5 presets) + resolution order + `useLayoutPref`. |
| `src/ui/Stage.jsx` | Composes the background + sprite zones inside `.gf-scene`. |
| `src/ui/zones/BackgroundView.jsx` | Zone 1 — backdrop, CG, item close-up. |
| `src/ui/zones/SpriteView.jsx` | Zone 2 — two-character stage (portrait single-character rule). |
| `src/ui/zones/DialogueBox.jsx` | Zone 3 — nameplate + line text + advance caret. |
| `src/ui/zones/InteractionView.jsx` | Zone 4 — choices + adhoc, with the expand/dock toggle. |
| `src/ui/zones/visuals.jsx` | Shared no-art placeholders + the fade-in `<img>`. |
| `src/ui/Player.jsx` | Play screen: composes the zones per layout; controls, panels, ending, effects. |
| `src/ui/Adhoc.jsx` | Mounts an adhoc scene's module (§14): dynamic-imports it, hands it a host context + container, reports the result back to the engine. |
| `src/ui/Menu.jsx` | Game-select grid (data-driven from `content/index.json`). |
| `scripts/sync-content.mjs` | Bundles GVNF projects into `public/content/`. |
