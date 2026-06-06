# Sample game — *Aoi, After School*

A small but **complete and schema-valid** GVNF v1.0 project that exercises every feature of
the [Script Standard](../spec/script-standard.md). It ships no binary assets — the resource
manifest lists illustrative paths so you can read the *data shape* end to end.

## Layout

```
aoi-after-school/
├── game.json                 # project manifest (entry: s01_classroom)
├── characters/
│   ├── aoi.json              # heroine — 2 outfits (uniform, casual), 5 expressions
│   ├── rin.json              # friend
│   ├── mei.json              # student-council — the THIRD speaker
│   └── yuu.json              # protagonist — no sprite (nameplate only)
├── resources/manifest.json   # every bg / sprite-layer / cg / item / bgm / se / voice / ui
├── i18n/
│   ├── en.json               # default locale (contains every key)
│   └── ja.json               # Japanese
├── adhoc/                    # §14 adhoc-scene module + style
│   ├── keepsake.js           #   custom-styled "a moment to spare" card
│   └── keepsake.css
├── ui/                       # web-runtime extension: developer custom layouts
│   └── layouts/
│       └── scrapbook.css     #   a registered stage layout (game.json `ui.layouts`)
└── scenes/
    ├── s01_classroom.json    # intro, 3-way alternating dialogue, close-up, calls s01b, choice
    ├── s01b_desk.json        # ADHOC scene (§14): custom module; returns to the flow
    └── s02_rooftop.json      # branch on `route`, CG, outfit change, two endings
```

## Feature coverage

| Feature | Where |
|---------|-------|
| Project manifest, locales, globals, endings | `game.json` |
| Resource manifest (all asset classes) | `resources/manifest.json` |
| Layered sprites (body = pose+outfit, face = expression) | `manifest.json` › `sprites` |
| Character with **no sprite** (nameplate-only speaker) | `characters/yuu.json` |
| **Facial expression change** | `s01`: `{ "face": "aoi", "to": "smile" }`, inline `face` on lines |
| **Clothing / outfit change** | `s02`: `show aoi … "outfit": "casual"` (was `uniform`) |
| **Two-character stage limit + alternating display** | `s01` — see trace below |
| **Transition effects** | `fade`, `dissolve` throughout; object & shorthand forms |
| **Item close-up** | `s01`: `{ "closeup": "class_key", "caption": …, "zoom": 1.3 }` |
| CG event image | `s02`: `{ "cg": "cg_first_meeting" }` |
| BGM (with loop points) + SE | `school_theme`/`tender`; `door`, `heartbeat` |
| Voice (`auto`, per-locale) | `s01_001` (aoi), `s01_004` (rin) → `voice/{locale}/…` |
| Choice → variables → branch | `s01`: `choice "lunch"` sets `route`, jumps `#join` / `#leave` |
| Conditional (`if`/`then`/`else`) | `s02`: `route == 'aoi'` |
| Labels & jumps | `#join`, `#leave`, `jump "s02_rooftop"` |
| Camera effect | `s02`: `{ "flash": … }` |
| Localization (en default + ja) | `i18n/` |
| **Adhoc scene** (custom module, write-back, declared exits, **fullscreen**) | `s01b_desk.json` (`kind:"adhoc"`, `fullscreen:true`) + `adhoc/keepsake.*`; `call`ed from `s01` |
| **Developer custom layout** (web-runtime extension) | `game.json` › `ui.layouts` (`scrapbook`) + `ui/layouts/scrapbook.css` |
| Endings | `good`, `normal` |

## The two-character rule in action (s01 stage trace)

`stageMode: "auto"`. The runtime manages who is visible from the `say` speakers
(Script Standard §6.3). `yuu` has no sprite, so his lines change nothing on stage and do not
change `lastSpeaker`. Watch the **visible** column never exceed two:

| # | Command | Action | Visible (left · right) | active / lastSpeaker |
|---|---------|--------|------------------------|----------------------|
| 5 | `show aoi at left` | aoi enters | **aoi** · — | — |
| 6 | `say aoi` | already visible | **aoi** · — | aoi / aoi |
| 7 | `say yuu` | no sprite → nameplate only | **aoi** · — | aoi / aoi |
| 8 | `face aoi → smile` | expression swap | **aoi** · — | aoi / aoi |
| 9 | `say aoi` | — | **aoi** · — | aoi / aoi |
| 11 | `say rin` | <2 visible → rin enters at `right` | **aoi** · **rin** | rin / rin |
| 12 | `say aoi` | already visible | **aoi** · **rin** | aoi / aoi |
| 13 | `say mei` | **2 visible, mei off** → evict non-active partner **rin**; mei takes `right` | **aoi** · **mei** | mei / mei |
| 14 | `say aoi` | already visible | **aoi** · **mei** | aoi / aoi |
| 15–16 | `closeup class_key` / `closeup null` | item foreground, then restore | **aoi** · **mei** | aoi / aoi |
| 17 | `say rin` | **2 visible, rin off** → evict non-active **mei**; rin re-enters `right` | **aoi** · **rin** | rin / rin |

> The conversation has **four** participants (aoi, rin, mei, yuu) but the screen never shows
> more than **two** sprites. The third sprite always displaces the *non-active partner*
> (the visible character who is not the most recent speaker), which is exactly
> *"in multi-player scenes the characters are displayed alternately based on dialogue."*

## Branch / ending map

```
s01_classroom ──call s01b_desk (ADHOC §14)
                 ├─ exit "stay"      → aoi_affection ±    → resume → choice "lunch"
                 │                                                    ├─ join  → route="aoi", aoi_affection+=2, met_rin=true → s02 → if route=='aoi' → ending "good"
                 │                                                    └─ leave → aoi_affection-=1                            → s02 → else            → ending "normal"
                 └─ exit "slip_away" → aoi_affection-=1   → jump s01#leave → s02 → else → ending "normal"
```

## The adhoc scene (§14)

`s01b_desk` is an **adhoc scene**: it carries an `adhoc` block instead of a `script`, so
presentation is handed to a developer module ([`adhoc/keepsake.js`](aoi-after-school/adhoc/keepsake.js),
styled by [`adhoc/keepsake.css`](aoi-after-school/adhoc/keepsake.css)) that draws its own
card UI. `s01` reaches it with `{ "call": "s01b_desk" }`; the module returns a result
`{ exit, set }`. The runtime writes the result's variables (`aoi_affection`) and takes the
named exit: **`stay`** (`return: true`) resumes `s01` at the next command, while
**`slip_away`** (`jump`) branches to `s01`'s `#leave`. A mandatory **`fallback`** exit keeps
the game completable on any runtime that can't run the module, so exits stay statically
analysable and `galforge lint` can still verify reachability.

This scene also sets **`"fullscreen": true`** (§14.1): the module takes over the whole
viewport (past the 16:9 letterbox) and the player chrome is hidden for its duration — an
immersive takeover. Drop the flag (the default) to render the module into a stage-sized
surface inside the frame, with the controls still available above it.

## Developer custom layout

Where an *adhoc scene* hands one beat's whole presentation to developer code, a **custom
layout** lets the developer re-style the *standard* play screen without forking the player.
A game registers its own stage layout in `game.json` under a `ui` block, and ships a scoped
stylesheet the runtime injects:

```jsonc
// game.json
"ui": {
  "layout": "adv",                 // the game's default stage layout
  "layouts": [
    {
      "id": "scrapbook",           // your id (must not collide with a built-in)
      "name": "Scrapbook (custom)",// shown in the player's Layout picker
      "short": "Scrap",
      "style": "ui/layouts/scrapbook.css",  // project-relative href (like adhoc styles)
      "interaction": "overlay"     // default interaction-zone mode: overlay | dock
    }
  ]
}
```

The runtime adds *Scrapbook (custom)* to the **Layout** control (under *Custom (this game)*)
and toggles it on by setting `data-layout="scrapbook"` on the stage root. The stylesheet
([`ui/layouts/scrapbook.css`](aoi-after-school/ui/layouts/scrapbook.css)) targets the same
**stage-zone classes** the player exposes — `.gf-scene` (background + sprites,
`.gf-slot.active`/`.dim`), `.gf-dialogue` (the `--nc` custom property carries the speaker's
nameplate colour), `.gf-interaction` — and **must be scoped** under `[data-layout="scrapbook"]`
so it only applies when active. Landscape-only rules are scoped `:not(.portrait)` so phones
keep the clean single-character bottom bar (§6 portrait collapse). The shipped layout mats
the scene like a photo on a warm scrapbook page and floats the line in a caption card
accented with the speaker's colour.

The `ui` block is a **web-runtime extension**, not part of the GVNF core schema: the schema
ignores it (`additionalProperties`) and `galforge lint` does not interpret it, so it stays
lint-safe and portable — a runtime that doesn't know about layouts just renders its default
play screen. (For a fully bespoke beat — a minigame, map, terminal — reach for an adhoc
**scene** instead; for a different *look* on the normal screen, a custom layout.)

## Validate it

```bash
cd docs/spec/schemas

ajv validate -s game.schema.json      -r common.schema.json -d ../../samples/aoi-after-school/game.json
ajv validate -s resource-manifest.schema.json -r common.schema.json -d ../../samples/aoi-after-school/resources/manifest.json
ajv validate -s character.schema.json -r common.schema.json -d "../../samples/aoi-after-school/characters/*.json"
ajv validate -s locale.schema.json    -r common.schema.json -d "../../samples/aoi-after-school/i18n/*.json"
ajv validate -s scene.schema.json     -r common.schema.json -d "../../samples/aoi-after-school/scenes/*.json"
```

Schema validation checks **shape**. A full `galforge lint` would additionally resolve
cross-file references and the stage rule (Script Standard §12).
