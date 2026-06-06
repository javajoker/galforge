# GalForge developer extensions

**How a game developer hands hand-built presentation to a GVNF project.**

> Companion: [Script Standard (GVNF v1.0)](script-standard.md) · [Sample game](../samples/) ·
> Worked demo: [`games/extensions-demo/`](../../games/extensions-demo/) · Import skills:
> [`galforge-import-layout`](../../.claude/skills/galforge-import-layout/SKILL.md),
> [`galforge-import-adhoc`](../../.claude/skills/galforge-import-adhoc/SKILL.md)

---

## 1. Two extension points

The GVNF command grammar (Script Standard §8) plus the stage model (§6) cover ordinary
visual-novel presentation: dialogue, sprites, backgrounds, choices, branching. A **game
developer** can extend a project in exactly two sanctioned ways, each *bounded* so the project
stays lint-able and portable:

| | **Custom layout** | **Adhoc scene** |
|---|---|---|
| Re-skins the **normal** play screen | Adds a **new beat** the grammar can't model |
| What it is | a scoped **CSS** stylesheet | a **JS module** (+ optional CSS) |
| It may | re-position / re-style the existing stage zones | render any DOM + interaction it likes |
| It may **not** | add DOM or new structure | assume any GVNF UI is present |
| Where it's declared | `game.json` `ui.layouts` (web-runtime extension) | a scene's `adhoc` block (Standard §14, **core**) |
| Granularity | whole game (a picker option) | one scene |
| Import skill | `galforge-import-layout` | `galforge-import-adhoc` |

If a developer wants a *different look* on the normal screen → **layout**. If they want a
*minigame / map / puzzle / data-terminal / bespoke cutscene* → **adhoc scene**.

Both are demonstrated end-to-end, lint-clean, in [`games/extensions-demo/`](../../games/extensions-demo/);
the canonical sample [`docs/samples/aoi-after-school/`](../samples/aoi-after-school/) also ships
one of each (the `scrapbook` layout and the `keepsake` adhoc scene).

---

## 2. Custom stage layouts (web-runtime extension)

> **Status: web-runtime extension, NOT GVNF core.** Layouts live in a top-level `ui` block in
> `game.json`. The core schema tolerates it (`game.schema.json` top-level `additionalProperties`)
> and `galforge lint` does not interpret it, so it is **lint-safe and portable**: a runtime that
> doesn't implement layouts simply renders its default play screen. The contract below is the
> one the reference web runtime (`web/`) implements.

### 2.1 The `ui` block

```jsonc
// game.json (top level, alongside `stage` / `transitions`)
"ui": {
  "layout": "adv",            // OPTIONAL: the game's default stage layout id
  "layouts": [                 // OPTIONAL: developer-registered custom layouts
    {
      "id": "visor",                  // required; must not collide with a built-in
      "name": "Visor HUD (custom)",   // shown in the player's Layout picker
      "short": "Visor",               // optional compact label
      "desc": "one line for the picker",
      "style": "ui/layouts/visor.css",// project-root-relative href (or absolute URL)
      "interaction": "overlay"        // "overlay" | "dock" — default interaction-zone mode
    }
  ]
}
```

| Field | Type | Req | Description |
|-------|------|-----|-------------|
| `layout` | string | – | Default layout id for this game. Resolves against built-ins + registered customs. |
| `layouts` | object[] | – | Custom layouts this game ships (each restyles the screen via its own CSS). |
| `layouts[].id` | string | ✓ | Layout id; activates `data-layout="<id>"`. **Must not** collide with a built-in (`adv`, `nvl`, `dock-left`, `dock-right`, `cinematic`). Hyphens allowed. |
| `layouts[].name` | string | – | Display name in the Layout picker. Defaults to `id`. |
| `layouts[].short` | string | – | Compact label. |
| `layouts[].desc` | string | – | One-line description. |
| `layouts[].style` | string | – | Path to the CSS, resolved exactly like an adhoc scene's `style` (project-root-relative → URL). Injected once, kept inert until active. |
| `layouts[].interaction` | enum | – | `overlay` (choices/adhoc float over the stage) or `dock` (side panel). Default `overlay`. |

### 2.2 Activation & scoping

The runtime applies a layout by setting `data-layout="<id>"` on the stage root and injecting
each registered `style` as a `<link data-gf-layout-style="<id>">`. Therefore a custom layout's
CSS **MUST**:

- **Scope every selector** under `.gf-stage[data-layout="<id>"]`. Unscoped rules leak into other
  layouts. Landscape-only rules add `:not(.portrait)`:
  `.gf-stage:not(.portrait)[data-layout="<id>"] …`. Portrait is left to the runtime so phones
  keep the clean single-character bottom bar (Standard §6 portrait collapse).
- **Target only the standard stage-zone classes** (§2.3). It must not rely on DOM it didn't
  author, and must not add DOM (that's an adhoc scene's job).

### 2.3 The layout API — stage-zone classes

A layout may restyle these and only these (all under `.gf-stage[data-layout="<id>"]`):

| Selector | Zone / meaning |
|----------|----------------|
| `.gf-stage` | the stage root (also carries `.portrait`) |
| `.gf-scene` | zone 1+2: background + sprites (resize / frame it here) |
| `.gf-slot` | a character slot; `.gf-slot.active` = current speaker, `.gf-slot.dim` = the dimmed partner |
| `.gf-ph` | placeholder shown until sprite art loads (`--c` = the character's colour) |
| `.gf-dialogue` | zone 3: dialogue box. **`--nc`** custom property = the active speaker's nameplate colour |
| `.gf-name` / `.gf-text` / `.gf-advance` | nameplate / line text / advance caret |
| `.gf-interaction` | zone 4: choices + adhoc. Modes `.overlay` / `.dock`; states `.expanded` / `.collapsed` |
| `.gf-controls` / `.gf-bgm-hud` | player chrome — shift these if your layout needs a corner |

### 2.4 Resolution order

The layout actually rendered is resolved (highest priority first):

1. A live engineer override in the player's **Layout** control (persisted; `auto` = follow the game).
2. `game.json` `ui.layout`.
3. The app default (`CONFIG.layout` in `web/src/config.js`).
4. The built-in default, `adv`.

### 2.5 Trust

Custom-layout CSS is **game content** — same trust level as a §14 adhoc module (which already
runs JS). It can only restyle existing zones; it cannot exfiltrate data or add behaviour. The
moment a developer needs new structure or controls, that's an adhoc **scene**, not a layout.

---

## 3. Adhoc scenes (GVNF core, Standard §14)

An adhoc scene is GVNF's bounded escape hatch: a scene carrying an `adhoc` block instead of a
`script`, whose presentation is a developer **module**. It returns a **result** that writes back
game variables and takes one of its **declared exits**, rejoining the common flow. This is
**core GVNF** and fully normative in [Script Standard §14](script-standard.md); this section is
the developer-facing summary the import skill enforces.

### 3.1 The scene `adhoc` block (§14.1)

A scene has **exactly one** of `script` or `adhoc`. Set `"kind":"adhoc"` for clarity.

| Field | Type | Req | Description |
|-------|------|-----|-------------|
| `module` | string | ✓ | Project-root-relative path to the ES module. |
| `style` | string | – | CSS injected while the scene runs, removed on exit. |
| `entry` | string | – | Named export to invoke. Default: the default export, else `mount`. |
| `title` | text | – | Displayable label (`@key` or inline) — **lint-checked** as displayable text. |
| `fullscreen` | bool | – | `true` = viewport takeover, player chrome hidden. Default `false` = a stage-sized surface. |
| `params` | object | – | Static JSON handed to the module as `ctx.params`. |
| `reads` / `writes` | id[] | – | The variable interface. Lint treats `reads` as reads, `writes` as declarations; runtimes SHOULD reject writes outside `writes`. |
| `exits` | exit[] | ✓ | ≥1 declared ways to leave; each exactly one of `jump` / `end` / `return` (+ optional `set`). |
| `fallback` | object | ✓ | `{ exit, set? }` taken when the module can't run; `exit` MUST name a declared exit. |

### 3.2 The module function spec (§14.2)

```js
// the entry: default export, the export named by `entry`, or `mount`
export default function mount(ctx) /* -> result | Promise<result> */ {
  // …render UI into ctx.root, await interaction (honouring ctx.signal)…
  return { exit: "<declared-exit-id>", set: { /* var: value | "+n" | "=expr" */ } };
}
```

Host context `ctx` (normative minimum):

| Member | Description |
|--------|-------------|
| `root` | empty container the module owns until exit (stage-sized, or viewport-sized if `fullscreen`) |
| `params` | deep copy of `adhoc.params` |
| `vars` | read-only snapshot of game variables (≥ the `reads` set) |
| `locale` / `defaultLocale` | active / default locale codes |
| `t(key)` | resolves displayable text — accepts `"@key"` or `"key"` |
| `asset(group, id)` | manifest asset id → URL, or `null` |
| `screen` | `{ width, height }` reference resolution |
| `signal` | `AbortSignal`, fired on teardown (load / restart / unmount) — the module MUST stop and clean up |

The module **MUST**: confine its DOM to `ctx.root`; assume **no** GVNF UI is present; honour
`ctx.signal`; restrict writes to `writes`; return a result whose `exit` is one of the declared
exits.

### 3.3 Result, exits, write-back & fallback (§14.3–§14.5)

- **Exits**: each declared exit has exactly **one** of `jump` (transfer to scene/label), `end`
  (end with an ending id / `true`), or `return` (pop the call stack — resume the `call`er).
- **Write-back (§14.4)**: the runtime applies the exit's static `set`, then the result's dynamic
  `set` (assignment syntax §9.2), then transfers control via the exit.
- **Fallback (§14.5)**: **mandatory** — keeps the project completable without the module (a
  non-JS player, an analysis tool, a blocked/failed `import`, or a thrown module). Choose a
  fallback that keeps the story sensible.
- **Determinism/saves (§14.6)**: the scene is atomic; a mid-scene save records the entry, so it
  re-runs from the start; results of *completed* adhoc scenes persist.

### 3.4 Lint (§14.7)

`galforge lint` enforces: exactly one of `script`/`adhoc`; `module` + non-empty `exits` +
`fallback` present; each exit has exactly one of `jump`/`end`/`return` and each `jump`/`end`
resolves; `fallback.exit` names a declared exit; `reads`/`writes`/`set` keys count as variable
reads/declarations; reachability follows each exit's `jump`. It does **not** verify `module` /
`style` paths or the module's *internal* i18n keys (these resolve at runtime).

---

## 4. References

- Worked, runnable demo: [`games/extensions-demo/`](../../games/extensions-demo/) (its
  [`README`](../../games/extensions-demo/README.md) walks the two imports).
- In the canonical sample: [`scrapbook` layout](../samples/aoi-after-school/ui/layouts/scrapbook.css)
  and the [`keepsake` adhoc scene](../samples/aoi-after-school/scenes/s01b_desk.json).
- Reference web runtime: [`web/README.md`](../../web/README.md) (zone components, layout picker).
- Import procedures: [`galforge-import-layout`](../../.claude/skills/galforge-import-layout/SKILL.md),
  [`galforge-import-adhoc`](../../.claude/skills/galforge-import-adhoc/SKILL.md).
