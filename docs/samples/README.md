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
└── scenes/
    ├── s01_classroom.json    # intro, 3-way alternating dialogue, close-up, choice
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
s01_classroom ──choice "lunch"
                 ├─ join  → set route="aoi", aoi_affection+=2, met_rin=true → s02 → if route=='aoi' → ending "good"
                 └─ leave → set aoi_affection-=1                            → s02 → else            → ending "normal"
```

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
