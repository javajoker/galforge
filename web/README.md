# GalForge — React runtime (publishable web app)

A **React + Vite** player for **GVNF v1.0** projects. Unlike the zero-build
reference in [`../runtime/`](../runtime/), this one is meant to be **built and
shipped**: games are bundled into the app and selected by **route**, so the
output of `npm run build` is a self-contained static site you can drop on any
host — **no query string, no server**.

It also adds **responsive design**: on a vertical (portrait) screen the stage
shows a **single character at a time** (the active speaker, on its own side)
instead of two side-by-side, so phones stay clean.

> The engine in [`src/engine/`](src/engine/) is a UI-agnostic port of the
> canonical [`../runtime/galforge.js`](../runtime/galforge.js) — same format
> semantics (two-character stage, alternating display, transitions, layered
> sprites, branching, i18n, voice, §11 save/load), just driven by React.

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
- **Language** — switch among the project's locales (shown when >1).
- **☰** — back to the game list.

## Verified

Browser-verified end-to-end (both bundled games): route-based boot, two-character
alternating emphasis, third-speaker eviction (never 3 sprites), expression
swaps, item close-up + caption, bg transitions, branching choice → variables →
route → CG → ending, EN↔JA live locale switch, and a save/load round-trip whose
snapshot validates against `save.schema.json`. Portrait mode verified to render a
single active character that alternates sides with the speaker.

## Layout

| Path | Role |
|------|------|
| `src/engine/engine.js` | GVNF state machine (UI-agnostic): loader, command loop, two-character stage, save/load — emits an immutable view model. |
| `src/engine/evalExpr.js` | Safe expression evaluator (§9.3), shared semantics with the vanilla runtime. |
| `src/hooks.js` | `useEngine`, `useOrientation`, `useTypewriter`, `useAudio`. |
| `src/ui/Stage.jsx` | Background, sprites (incl. portrait single-character rule), CG, close-up. |
| `src/ui/Player.jsx` | Play screen: dialogue, choices, controls, panels, ending, effects. |
| `src/ui/Menu.jsx` | Game-select grid (data-driven from `content/index.json`). |
| `scripts/sync-content.mjs` | Bundles GVNF projects into `public/content/`. |
