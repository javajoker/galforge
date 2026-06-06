---
name: galforge-import-adhoc
description: >-
  Import a game developer's own adhoc scene — a code module (ES module JS, optional CSS) that
  renders bespoke presentation/interaction the command grammar can't model (a minigame, map,
  puzzle, data-terminal, drag-and-drop, custom cutscene) — into a GalForge GVNF project per
  Script Standard §14: place the module under adhoc/, author the scenes/<id>.json `adhoc`
  block, declare statically-analysable exits + a mandatory fallback + the reads/writes
  variable interface, wire it into the flow (call/jump), and drive `galforge lint` clean. USE
  THIS when a developer hands you a module and says "wire this minigame into my game", "add
  this custom scene", "import this interactive beat", "hook up my puzzle/map/terminal", or
  asks to make an adhoc/§14 scene. For only re-skinning the *normal* play screen, use
  galforge-import-layout instead.
---

# galforge-import-adhoc — wire a developer's §14 adhoc scene into a project

An **adhoc scene** is GVNF's bounded escape hatch (Script Standard §14): a scene that carries
an `adhoc` block instead of a `script`, handing its presentation to a developer **module**
drawn with its own layout/controls. When it finishes it returns a **result** that writes back
game variables and takes one of its **declared exits**, rejoining the common flow. Bounded =
the *ways it can leave are fixed up front*, so the flow graph stays static, lint-able, and
deterministic.

> **Contract (read first).** [`docs/spec/script-standard.md` §14](../../../docs/spec/script-standard.md)
> (normative; read §14.1–§14.7) and the developer-facing summary +
> module function spec in
> [`docs/spec/developer-extensions.md` §3](../../../docs/spec/developer-extensions.md). Schema:
> [`docs/spec/schemas/scene.schema.json`](../../../docs/spec/schemas/scene.schema.json)
> (`$defs.adhoc`, `$defs.adhocExit`).
> **Worked examples.** Runnable demo (a generic, params-driven quiz):
> [`games/extensions-demo/adhoc/quiz.js`](../../../games/extensions-demo/adhoc/quiz.js) +
> [`scenes/q_quiz.json`](../../../games/extensions-demo/scenes/q_quiz.json) (+ its
> [`README`](../../../games/extensions-demo/README.md)); also
> [`docs/samples/aoi-after-school/scenes/s01b_desk.json`](../../../docs/samples/aoi-after-school/scenes/s01b_desk.json)
> + [`adhoc/keepsake.js`](../../../docs/samples/aoi-after-school/adhoc/keepsake.js) /
> [`keepsake.css`](../../../docs/samples/aoi-after-school/adhoc/keepsake.css).

## 0. Intake — establish before wiring

Ask only what you cannot read off the module:

1. **The module** (JS) + optional **style** (CSS), and which **project** it belongs to.
2. **Entry export** — default export, an export named `mount`, or a named one (`entry:`).
3. **How the game reaches it** — `call` from a scene (subroutine; pair with a `return` exit)
   or `jump` to it. And **what flows after** each way of leaving.
4. **Exits** — every declared way to leave, each exactly **one** of `jump` / `end` / `return`.
5. **Fallback** — the exit (and any `set`) to take when the module can't run; **mandatory**.
6. **Variable interface** — which variables it `reads` and `writes`; plus `params` (static
   JSON handed in), `title`, and `fullscreen?`.

## 1. Check the module against the contract (§14.2) — do not skip

The module is an ES module the runtime loads. Verify the developer's code honours the host
contract; flag (and, where small, fix) violations before wiring:

- **Entry** resolves: the export named by `entry`, else the default export, else `mount`.
- **Signature**: invoked with a single host-context `ctx`; returns (or resolves to)
  `{ exit: "<id>", set?: { … } }` whose `exit` is one of the **declared** exit ids.
- **DOM**: confines its DOM to `ctx.root` (a cleared, stage-sized container — viewport-sized
  if `fullscreen`); MUST NOT assume any GVNF UI is present.
- **Teardown**: honours `ctx.signal` (AbortSignal) — drops timers/listeners and stops on abort
  (load / restart / unmount).
- **Writes**: SHOULD restrict variable writes to the declared `writes` set.
- Uses only host-context members it can rely on (§14.2): `root`, `params`, `vars`, `locale`/
  `defaultLocale`, `t(key)`, `asset(group,id)`, `screen`, `signal`.

## 2. Place the files

```
<project>/
└── adhoc/
    ├── <name>.js     # the module
    └── <name>.css    # optional style (injected while the scene runs, removed on exit)
```

## 3. Author `scenes/<id>.json` — the `adhoc` block (§14.1)

A scene has **exactly one** of `script` or `adhoc`. Set `"kind":"adhoc"` for clarity (the
presence of `adhoc` is authoritative).

```jsonc
{
  "gvnf": "1.0",
  "id": "<id>",
  "kind": "adhoc",
  "adhoc": {
    "module": "adhoc/<name>.js",     // required, project-root-relative
    "style":  "adhoc/<name>.css",    // optional
    "entry":  "mount",                // optional; default export / mount otherwise
    "title":  "@<id>.title",          // optional displayable text (menus / a11y)
    "fullscreen": false,              // true = viewport takeover, chrome hidden (§14.1)
    "params": { },                    // optional static JSON → ctx.params
    "reads":  ["<var>"],              // informational; lint treats as variable reads
    "writes": ["<var>"],              // runtimes SHOULD reject writes outside this set
    "exits": [                         // required, ≥1; each exactly one of jump/end/return
      { "id": "done",  "return": true },
      { "id": "leave", "jump": "<scene_or_scene#label>", "set": { "<var>": "-1" } },
      { "id": "bad",   "end": "normal" }
    ],
    "fallback": { "exit": "done", "set": { } }  // required; MUST name a declared exit
  }
}
```

Exit rules (§14.3): exactly **one** of `jump` (transfer to scene/label), `end` (end with an
ending id / `true`), or `return` (pop the call stack — resume the `call`er; the most direct
realisation of "the result is set back into the common flow"). A `return` exit with an empty
call stack behaves as a generic `end`. Each exit MAY carry a static `set` applied when taken.

## 4. Wire it into the flow

From a normal script scene, reach the adhoc scene:

- **Subroutine** (recommended when it should resume the caller): `{ "call": "<id>" }` paired
  with a `return` exit — runs the next command after the call when the module returns.
- **Branch**: `{ "jump": "<id>" }` — control transfers via the chosen exit's `jump`/`end`.

Then close the loop in `game.json`: declare every variable in `reads`/`writes`/exit-`set`/
fallback-`set` under `variables`, and ensure every exit `end:"X"` has a matching `endings.X`
and every exit `jump` target resolves.

## 5. Portability & saves (§14.5–§14.6) — keep these true

- **Fallback is mandatory** so the project is completable **without** the module — a non-JS
  player, an export/analysis tool, a blocked/failed `import`, or a thrown module applies
  `fallback.set` then takes `fallback.exit`. Pick a fallback that keeps the story sensible.
- **Atomic for saves**: a save taken mid-scene records the program counter at the adhoc
  scene's *entry*, so resuming re-runs it from the start; results of *previously completed*
  adhoc scenes persist. (Optional `serialize()`/`restore()` hooks are post-v1.)

## 6. Verify — lint clean (own the §14.7 gate)

```bash
python3 tools/galforge_lint.py <project> --strict   # drive to clean ✓
```

Lint enforces (§14.7): exactly one of `script`/`adhoc`; `module`, non-empty `exits`, and
`fallback` present; each exit has exactly one of `jump`/`end`/`return`, each `jump` resolves to
a scene/label and each `end` is a declared ending; `fallback.exit` names a declared exit;
`reads`/`writes`/`set` keys are treated as variable reads/declarations; reachability follows
each exit's `jump` and the scene is reachable when `call`ed/`jumped` to. Lint does **not**
verify `module`/`style` paths or the module's *internal* i18n keys (they resolve at runtime) —
so keep those correct yourself, and prefer keys present in the locale tables.

## Boundary

An adhoc scene is the place for *new* presentation/interaction. If the developer only wants the
*normal* play screen to look different (reposition/re-skin the existing dialogue, sprites,
choices), that's a custom **layout** — hand off to `galforge-import-layout`.
