# GalForge — reference web runtime

A dependency-free, single-page **GVNF v1.0** interpreter. It implements the runtime
contract of the [script standard](../docs/spec/script-standard.md): the command loop (§8/§10),
the **two-character stage model with alternating display** (§6), transitions (§7), layered
sprites with expression/outfit swaps (§3.3/§5), item close-ups and CG (§8.9–§8.10),
variables & branching (§9), localization (§1.3/§4), voice (§3.4), and save/load (§11).

It is the **canonical playback semantics** for the format — when a runtime's behaviour and
this one disagree, this one is right (or the spec is, and both should be fixed).

## Run it

Any static file server works (it `fetch`es the project files, so `file://` won't work):

```bash
# from the repo root
python3 -m http.server 8000
# then open:
#   http://localhost:8000/runtime/?game=../games/umbrella-share        (pipeline dry-run)
#   http://localhost:8000/runtime/?game=../docs/samples/aoi-after-school
```

The `?game=<path>` query points at any GVNF project directory (the one containing
`game.json`); it defaults to `../games/umbrella-share`.

## No art? No problem.

The sample projects ship **no binary assets**. When an image or audio file is missing the
stage renders a **labelled placeholder** (a colour-keyed silhouette showing the character,
outfit, and expression; a gradient + id for backgrounds/CG/items; a `♪ id` HUD for music).
Drop real files at the manifest's paths and they appear automatically — body + face images
are composited per the layered-sprite model.

## Controls

- **Click / Space / Enter** — advance (first press completes the typewriter, second advances).
- **Auto** — auto-advance after each line. **Skip** — fast-forward.
- **Log** — backlog/history. **Save / Load** — 4 slots in `localStorage` (snapshot per §11).
- **Language** — switch among the project's `locales.supported`.

## What it demonstrates (verified)

Playing `games/umbrella-share` exercises, in one short story:

| Feature | Where it shows |
|---------|----------------|
| Two-character limit + **alternating display** (active bright, partner dimmed) | the bus-stop conversation |
| **Third-speaker eviction** (Rui replaces the non-active partner) | Rui's entrance |
| Expression + outfit changes (layered sprite) | Nao's mood flickers; Shizuku uniform→casual |
| Item close-up with caption | the dropped charm |
| Transitions (fade/dissolve/slide) | every bg/character change |
| Branching choice → variables → route → CG → ending | "Which rain do I walk into?" |
| Localization via `@key` resolution | all on-screen text |
| Save/load snapshot (§11-conformant) | Save/Load buttons |

## Files

| File | Role |
|------|------|
| `index.html` | Page shell (everything lives inside the 16:9 stage). |
| `galforge.css` | Stage, sprite slots, dialogue, choices, panels, placeholders. |
| `galforge.js` | The interpreter: loader, i18n, safe expression evaluator, stage model, command handlers, transitions, audio, save/load. |

## Limitations (v1 reference)

- Transition *types* are mapped to a small visual set (dissolve/fade/slide/cut); exotic
  catalog entries fall back to a cross-fade (the spec permits this).
- Animated/Live2D sprites are not implemented (post-v1, §9 of the whitepaper).
- A choice option's inline `do` block is run, but saving *inside* one is not resumable
  (rare; save at dialogue/choice boundaries).
