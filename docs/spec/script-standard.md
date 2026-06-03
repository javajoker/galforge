# GVNF — GalForge Visual-Novel Format

**The game data & script standard.**

**Spec version:** 1.0 · **Date:** 2026-06-03 · **Status:** Draft (normative)

> Companion: [Whitepaper](../whitepaper.md) · [PRD](../PRD.md) · [JSON Schemas](schemas/) · [Sample game](../samples/)

---

## 1. Introduction & conventions

This document defines **GVNF v1.0**, the normative on-disk data format for a GalForge
gal-game: project manifest, resource manifest, character definitions, localized strings,
and branching scene scripts.

### 1.1 Requirement levels

The keywords **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** are used per
RFC 2119. A document that violates a MUST is **invalid**; `galforge lint` reports it as an
error. A SHOULD violation is a warning.

### 1.2 Encoding & format

- All files are **UTF-8 JSON**. (YAML authoring is permitted as a convenience; it MUST map
  1:1 to this JSON model and is converted before validation. JSON is the interchange form.)
- Object key order is insignificant. Unknown keys prefixed with `_` (e.g. `_comment`,
  `_note`) are **ignored** by runtimes and validators — use them for authoring notes since
  JSON has no comments.
- Identifiers (`id`, character ids, asset ids, scene ids, labels, variable names) match
  `^[a-z0-9][a-z0-9_]*$` unless stated otherwise (lower snake_case).
- Durations are integer **milliseconds**. Colors are `#RRGGBB` or `#RRGGBBAA`.
- Positions are the enumerated strings in §6.

### 1.3 Displayable text & the `@key` convention

Any field that is shown to the player (`text`, `caption`, choice `text`, character
`name`, ending titles, …) accepts a **string** that is interpreted as follows:

- A string beginning with **`@`** is an **i18n key reference**, resolved against the locale
  string tables (§4). Example: `"@s01.aoi.greet"`.
- Any other string is **inline literal prose** (allowed for drafts; flagged by
  `lint --strict`, see §12).
- A literal leading `@` is escaped as `@@`.

> Rationale: one unambiguous rule, terse to author, trivial to generate, and lint can tell
> drafts (inline) from shippable (keyed) content.

### 1.4 Versioning

Every top-level file carries `"gvnf": "1.0"`. Runtimes MUST reject a major version they do
not implement and SHOULD warn on an unknown minor version while attempting playback.

### 1.5 Project layout

A GVNF project is a directory:

```
<project>/
├── game.json                 # §2  project manifest  (required, exactly one)
├── characters/               # §5  one file per character (required: ≥1)
│   └── <char_id>.json
├── resources/
│   └── manifest.json         # §3  resource manifest (required, exactly one)
├── i18n/                     # §4  per-locale string tables (required: default locale)
│   └── <locale>.json
└── scenes/                   # §8  scene scripts (required: ≥1; entry scene must exist)
    └── <scene_id>.json
```

Paths inside the manifest are **relative to the project root**. Runtimes resolve assets
only through the manifest (§3), never by guessing filenames.

---

## 2. Project manifest — `game.json`

The single entry point. Declares metadata, presentation defaults, locales, the entry
scene, and global variables.

| Field | Type | Req | Description |
|-------|------|-----|-------------|
| `gvnf` | string | ✓ | Format version, `"1.0"`. |
| `id` | id | ✓ | Project id. |
| `title` | text | ✓ | Display title (`@key` or inline). |
| `version` | string | ✓ | Game content version (SemVer recommended). |
| `authors` | string[] | – | Credits. |
| `screen` | object | ✓ | `{ "width": int, "height": int }` reference resolution (px). |
| `locales` | object | ✓ | `{ "default": "<locale>", "supported": ["en","ja",…] }`. |
| `entry` | id | ✓ | Scene id where playback begins. |
| `voicePattern` | string | – | Template for `"voice":"auto"` resolution. Default `"{speaker}/{line}"`. Tokens: `{speaker}`, `{line}`, `{locale}`. |
| `text` | object | – | Defaults: `{ "speed": "normal"|int, "autoDelayMs": int }`. |
| `audio` | object | – | Default bus volumes `{ "bgm": 0..1, "se": 0..1, "voice": 0..1 }`. |
| `stage` | object | – | Stage defaults (§6): `{ "mode": "auto"|"manual", "emphasis": {…} }`. |
| `transitions` | object | – | Default transition per change type (§7), e.g. `{ "bg": "dissolve", "char": "dissolve" }`. |
| `variables` | object | – | Global variable initial values (§9). Keys are var names; values are `bool|int|number|string`. |
| `endings` | object | – | `{ "<ending_id>": { "title": text } }` for end screens & gallery. |
| `meta` | object | – | Free-form: cover image asset id, description, tags, rating. |

```json
{
  "gvnf": "1.0",
  "id": "aoi_after_school",
  "title": "@game.title",
  "version": "1.0.0",
  "authors": ["GalForge Sample Team"],
  "screen": { "width": 1920, "height": 1080 },
  "locales": { "default": "en", "supported": ["en", "ja"] },
  "entry": "s01_classroom",
  "voicePattern": "{speaker}/{line}",
  "text": { "speed": "normal", "autoDelayMs": 1200 },
  "audio": { "bgm": 0.8, "se": 0.9, "voice": 1.0 },
  "stage": { "mode": "auto", "emphasis": { "dim": 0.55, "offsetY": 0 } },
  "transitions": { "bg": "dissolve", "char": "dissolve", "cg": "fade" },
  "variables": { "aoi_affection": 0, "rin_affection": 0, "met_rin": false, "route": "common" },
  "endings": {
    "good": { "title": "@ending.good.title" },
    "normal": { "title": "@ending.normal.title" }
  },
  "meta": { "cover": "cg_cover", "rating": "all-ages" }
}
```

---

## 3. Resource manifest — `resources/manifest.json`

The **single source of truth** for every asset. A script MUST reference assets only by the
ids declared here (BR-6). This file is also the **work order** an asset pipeline fulfils.

Top level:

```json
{
  "gvnf": "1.0",
  "backgrounds": { … },
  "sprites":     { … },
  "cg":          { … },
  "items":       { … },
  "bgm":         { … },
  "se":          { … },
  "voice":       { … },
  "ui":          { … }
}
```

### 3.1 Common asset fields

Every asset entry is an object with at least:

| Field | Type | Req | Description |
|-------|------|-----|-------------|
| `path` | string | ✓* | Path relative to project root. (*Sprite layer groups nest paths — see §3.3.) |
| `w`,`h` | int | – | Intrinsic pixel dimensions (recommended for images). |
| `tags` | string[] | – | Free-form, for generators/galleries. |
| `_note` | string | – | Authoring note (ignored). |

### 3.2 Backgrounds, CG, Items, UI (full-frame / standalone images)

```json
"backgrounds": {
  "classroom_day":   { "path": "bg/classroom_day.png",   "w": 1920, "h": 1080 },
  "classroom_sunset":{ "path": "bg/classroom_sunset.png","w": 1920, "h": 1080 },
  "rooftop_sunset":  { "path": "bg/rooftop_sunset.png",  "w": 1920, "h": 1080 }
},
"cg": {
  "cg_cover":        { "path": "cg/cover.png",        "w": 1920, "h": 1080 },
  "cg_first_meeting":{ "path": "cg/first_meeting.png","w": 1920, "h": 1080, "tags": ["event"] }
},
"items": {
  "love_letter": { "path": "item/love_letter.png", "w": 900, "h": 1200 },
  "class_key":   { "path": "item/class_key.png",   "w": 800, "h": 800 }
},
"ui": {
  "namebox": { "path": "ui/namebox.png" },
  "textbox": { "path": "ui/textbox.png" }
}
```

### 3.3 Sprites — the layered character art model

A character sprite is composed at runtime from a **body layer** (`pose` + `outfit`) and a
**face layer** (`expression`). This is what makes **clothing changes** (F-009) and **facial
expression changes** (F-008) cheap state swaps instead of new full images.

Each entry under `sprites` is keyed by **character id** and declares the available layers:

```json
"sprites": {
  "aoi": {
    "anchor": { "x": 0.5, "y": 1.0 },        // bottom-center pivot (feet)
    "baseScale": 1.0,
    "bodies": {
      "uniform": {                             // outfit id
        "stand":   { "path": "char/aoi/body/uniform_stand.png",   "w": 700, "h": 1500 },
        "arms_crossed": { "path": "char/aoi/body/uniform_arms.png","w": 700, "h": 1500 }
      },
      "casual": {
        "stand":   { "path": "char/aoi/body/casual_stand.png",    "w": 700, "h": 1500 }
      }
    },
    "faces": {                                 // expression id → image, aligned to body
      "neutral":  { "path": "char/aoi/face/neutral.png",  "w": 300, "h": 320, "offset": {"x":0,"y":120} },
      "smile":    { "path": "char/aoi/face/smile.png",    "w": 300, "h": 320, "offset": {"x":0,"y":120} },
      "blush":    { "path": "char/aoi/face/blush.png",    "w": 300, "h": 320, "offset": {"x":0,"y":120} },
      "sad":      { "path": "char/aoi/face/sad.png",      "w": 300, "h": 320, "offset": {"x":0,"y":120} },
      "surprised":{ "path": "char/aoi/face/surprised.png","w": 300, "h": 320, "offset": {"x":0,"y":120} }
    }
  }
}
```

Rules:

- **R-3.3a** A character's available **outfits** are the keys of `bodies`; its **poses** are
  the keys within each outfit; its **expressions** are the keys of `faces`. Scripts MUST use
  only declared ids (BR-7).
- **R-3.3b** Each outfit SHOULD provide the same pose set; a missing pose for an outfit is a
  lint warning (runtime falls back to the outfit's first pose).
- **R-3.3c** `anchor` is the sprite's pivot in normalized coords (0..1) used to place it at a
  stage slot. `face.offset` positions the face over the body in body-pixel space.
- **R-3.3d** A character with no face layers (e.g. a silhouette extra) MAY omit `faces`;
  `face` commands targeting it are then no-ops (lint warning).
- **R-3.3e** Optional `variants` MAY nest under a body pose for minor overlays (e.g.
  `wet`, `damaged`); v1 runtimes MAY ignore unknown overlay keys.

### 3.4 Audio — BGM, SE, Voice

```json
"bgm": {
  "school_theme": { "path": "bgm/school_theme.ogg", "loop": true,
                    "loopStart": 2300, "loopEnd": 96000 },
  "tender":       { "path": "bgm/tender.ogg", "loop": true }
},
"se": {
  "bell":   { "path": "se/school_bell.ogg" },
  "door":   { "path": "se/door_slide.ogg" },
  "heartbeat": { "path": "se/heartbeat.ogg" }
},
"voice": {
  "aoi/s01_012": { "path": "voice/en/aoi/s01_012.ogg", "locale": "en", "char": "aoi" },
  "aoi/s01_012@ja": { "path": "voice/ja/aoi/s01_012.ogg", "locale": "ja", "char": "aoi" }
}
```

- **R-3.4a** BGM `loop`, `loopStart`, `loopEnd` (ms) define seamless looping. Absent loop
  points → loop whole file.
- **R-3.4b** Voice ids are free-form but the **convention** matching `voicePattern` is
  `"{speaker}/{line}"`; per-locale variants append `@{locale}` (the default locale needs no
  suffix). Runtimes resolve `"voice":"auto"` by formatting `voicePattern` from the speaker
  and the line's `id`, then trying `<id>@<locale>` before `<id>`.
- **R-3.4c** Recommended formats: audio `.ogg`/`.m4a`; images `.png` (sprites/items, alpha),
  `.jpg`/`.webp` (backgrounds/CG). Runtimes MUST support `.png` and `.ogg` as the baseline.

### 3.5 Manifest ↔ script consistency

- Every asset id referenced by any scene MUST exist here (error if missing).
- Every declared asset SHOULD be referenced somewhere (warning if unused; galleries/covers
  are exempt via `tags:["gallery"]`).

---

## 4. Localization — `i18n/<locale>.json`

A locale file is a flat or nested map of **i18n key → string**. Keys referenced in scripts
as `@dotted.key` resolve here.

```json
// i18n/en.json
{
  "gvnf": "1.0",
  "locale": "en",
  "strings": {
    "game.title": "Aoi, After School",
    "s01.aoi.greet": "Oh— you're still here?",
    "s01.aoi.001": "I thought everyone had gone home already.",
    "choice.lunch.prompt": "What should I say?",
    "choice.lunch.opt_join": "“Mind if I join you?”",
    "choice.lunch.opt_leave": "“…I should get going.”",
    "ending.good.title": "Two of Us"
  }
}
```

Rules:

- **R-4a** The **default locale** file MUST contain every key any script references (error
  on missing — BR-13).
- **R-4b** Resolution order: `requested-locale → default-locale → literal "@key"` (BR-14).
  Missing non-default keys are warnings.
- **R-4c** Keys MAY be nested objects; runtimes flatten with `.`; `strings."a.b"` and
  `strings.a.b` are equivalent. A key MUST resolve to a string.
- **R-4d** Simple interpolation: `{var}` tokens in a string are replaced by the runtime from
  current variables (§9), e.g. `"You have {coins} coins."` Unmatched tokens are left literal
  (warning).
- **R-4e** Per-locale **voice** is handled in the manifest (§3.4), not here.

---

## 5. Characters — layered sprites

> File: `characters/<char_id>.json`

Defines a character's identity and how its sprite is presented. The art layers themselves
live in the manifest (§3.3); this file declares **defaults and presentation**.

| Field | Type | Req | Description |
|-------|------|-----|-------------|
| `gvnf` | string | ✓ | `"1.0"`. |
| `id` | id | ✓ | Character id (matches filename & `sprites` key). |
| `name` | text | ✓ | Display name (`@key` recommended for i18n). |
| `nameColor` | color | – | Color of the nameplate text. |
| `sprite` | id | – | Sprites manifest key (defaults to `id`). Omit for voice-only/narrator. |
| `defaultOutfit` | id | – | Initial outfit; defaults to first declared. |
| `defaultPose` | id | – | Initial pose; defaults to first declared. |
| `defaultFace` | id | – | Initial expression; defaults to `neutral` or first declared. |
| `defaultPosition` | position | – | Preferred stage slot (`left`/`right`/`center`); see §6. |
| `voice` | object | – | Voice defaults: `{ "default": "auto"|assetId|null, "pitch": number }`. |
| `tags` | string[] | – | e.g. `["heroine"]`, `["protagonist"]`, `["extra"]`. |

```json
{
  "gvnf": "1.0",
  "id": "aoi",
  "name": "@char.aoi.name",
  "nameColor": "#5b8def",
  "sprite": "aoi",
  "defaultOutfit": "uniform",
  "defaultPose": "stand",
  "defaultFace": "neutral",
  "defaultPosition": "left",
  "voice": { "default": "auto" },
  "tags": ["heroine"]
}
```

- A **narrator / protagonist** with no on-screen sprite declares no `sprite` (or `sprite:
  null`). Lines spoken by them render the nameplate (or none) but place no character on
  stage. The reserved id `narrator` (no nameplate) MAY be used for pure narration; prefer the
  `narrate` command (§8.2).
- Changing **expression** (`face` command / inline `face`) selects a key from the
  character's `faces`; changing **outfit** (`outfit` command) selects a key from `bodies`.
  Both MUST be declared ids.

---

## 6. Stage model & the two-character rule

The **stage** is the set of currently visible character sprites. This section is normative
and is what makes the constraint *"a maximum of two characters can appear simultaneously; in
multi-player scenes characters are displayed alternately based on dialogue"* a property of
the format.

### 6.1 Slots & positions

- Positions are `left`, `center`, `right`.
- **The stage holds at most TWO visible character sprites at any instant (hard limit, BR-1).**
- A **solo** character uses `center` by default. A **pair** uses `left` + `right`. `center`
  and (`left`|`right`) are mutually exclusive occupancy patterns: a runtime MUST NOT show a
  `center` sprite together with a `left` or `right` sprite (that would imply three-ish
  framing); when a second character appears, a lone `center` character moves to its default
  side.
- No two visible characters may occupy the same slot.

### 6.2 Stage modes

Set globally in `game.json` (`stage.mode`) and overridable per scene (`stageMode`):

- **`auto`** (default) — the runtime manages visibility from `say` speakers (§6.3). Writers
  and AI need not emit `show`/`hide`; they just write dialogue. `show`/`hide`/`move` remain
  available for explicit beats and are reconciled with the rule.
- **`manual`** — the writer fully controls `show`/`hide`/`move`. The two-character limit is
  still enforced (a `show` that would make three visible is an error). `say` by an off-stage
  character is a warning.

### 6.3 Auto-alternate algorithm (normative)

State: `visible` = ordered list of up to two `{char, slot}`; `lastSpeaker` = char id or null.

On `say` (or `narrate`-then-`say`) by character **C** with a declared sprite:

```
1. If C is already visible:
      active ← C;  emphasize(C);  deemphasize(others);  lastSpeaker ← C.   // no entrance

2. Else if |visible| < 2:
      slot ← preferredFreeSlot(C)         // C.defaultPosition if free, else the open side
      enter C at slot (with char transition)
      active ← C; emphasize(C); deemphasize(others); lastSpeaker ← C.

3. Else (|visible| == 2, C not visible):    // ALTERNATING DISPLAY
      victim ← the visible char that is NOT lastSpeaker
               (if lastSpeaker is not visible/!null tie → least-recently-active)
      slot ← victim.slot
      exit victim (with char transition);  enter C at slot (with char transition)
      active ← C; emphasize(C); deemphasize(others); lastSpeaker ← C.
```

- `preferredFreeSlot(C)`: if `C.defaultPosition` ∈ {left,right} and free → that; else the
  single free side; if stage empty and C is the sole expected speaker so far → `center`
  collapses to `left` once a second speaker appears.
- **Emphasis** (`emphasize`/`deemphasize`): the active speaker renders at full brightness
  (and optional `offsetY`); non-active visible sprites render dimmed by `stage.emphasis.dim`
  (default 0.55). This is the *alternating display* readers see.
- **Narration** (`narrate`, or `say` with no speaker) does **not** change `visible` and does
  **not** change `lastSpeaker`; it MAY neutralize emphasis (all sprites at a mid brightness)
  per `stage.emphasis.narration` (default: keep last emphasis).
- **Sprite-less speakers** — a `say` whose speaker has no declared `sprite` (e.g. the
  protagonist, an off-screen voice) renders the nameplate and text but, like narration, does
  **not** change `visible` or `lastSpeaker`. Only speakers **with** a sprite drive steps 1–3
  above.
- A character entering/leaving uses the change's `transition` if given, else
  `transitions.char` (§7), else `dissolve`.

> Result: in a four-person conversation the screen always frames *the current speaker plus
> the most recent other speaker*, swapping the third/fourth person in and out as the
> dialogue moves — never exceeding two sprites.

### 6.4 Interaction with explicit commands

- `show C` makes C visible (entrance). In `auto` mode it pins C as if they had just spoken
  without emphasis; if the stage already has two, `show` performs an eviction per §6.3 step 3
  using `lastSpeaker` to choose the victim, unless `at` names an occupied slot's character to
  replace explicitly.
- `hide C` removes C. `move C to <slot>` relocates within the two-slot constraint (target
  slot MUST be free or occupied by C).
- A `show` that would yield three simultaneously visible sprites is a **lint error** (BR-1),
  regardless of mode.

### 6.5 Per-scene override

A scene file MAY set `"stageMode": "manual"` and MAY declare an initial stage via a leading
`show`/`bg`. If omitted, the scene inherits `game.json` stage defaults and an empty stage.

---

## 7. Transition effects

A **transition** is an optional object attached to any visual-change command (`bg`, `show`,
`hide`, `move`, `cg`, `closeup`, `outfit`, `face`*). It declares *intent*; runtimes render a
visually-equivalent effect.

```json
"transition": { "type": "dissolve", "duration": 500, "easing": "easeInOut" }
```

Shorthand: a bare string is sugar for `{ "type": <string> }` with default duration/easing,
e.g. `"transition": "dissolve"`.

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `type` | enum | per change type (§2 `transitions`) or `dissolve` | See catalog. |
| `duration` | int ms | 500 | 0 = instant cut. |
| `easing` | enum | `easeInOut` | `linear`,`easeIn`,`easeOut`,`easeInOut`. |
| `color` | color | `#000000` | For `fade`/`flash` variants. |
| `direction` | enum | `left` | For slides/wipes: `left`,`right`,`up`,`down`. |

### 7.1 Transition catalog (v1 baseline — runtimes MUST support)

| `type` | Effect |
|--------|--------|
| `none` / `cut` | Instant change (duration ignored). Always supported. |
| `dissolve` | Cross-fade old → new. |
| `fade` | Fade out to `color`, then in (a.k.a. fade-through-black/white via `color`). |
| `fadeBlack` | `fade` with `color:#000000`. |
| `fadeWhite` | `fade` with `color:#ffffff`. |
| `slide` | New image slides in from `direction`. |
| `push` | New pushes old out toward opposite of `direction`. |
| `wipe` | Hard-edged directional reveal. |

### 7.2 Extended catalog (v1 optional — runtimes SHOULD support, MAY fall back to `dissolve`)

| `type` | Effect |
|--------|--------|
| `blinds` | Horizontal/vertical blinds reveal. |
| `ripple` | Watery ripple dissolve (memory/dream). |
| `irisIn` / `irisOut` | Circular open/close. |
| `pixelate` | Pixel-dissolve. |

### 7.3 Camera/instant effects (commands, not transitions)

These are emitted as their own commands (§8): `shake` (screen shake), `flash` (full-screen
color flash), and background `pan`/`zoom` via the `bg` command's `camera` field.

`*` Note: `face`/`outfit` transitions apply only to the swapped layer (e.g. cross-fade the
face). If unspecified, layer swaps are instant.

---

## 8. Scene scripts & command reference

A scene file is an ordered program of commands.

```json
{
  "gvnf": "1.0",
  "id": "s01_classroom",
  "stageMode": "auto",
  "script": [
    { "bg": "classroom_sunset", "transition": "fade" },
    { "bgm": "school_theme", "fade": 800 },
    { "narrate": "@s01.intro" },
    { "show": "aoi", "outfit": "uniform", "face": "surprised", "at": "left" },
    { "say": "aoi", "id": "s01_001", "text": "@s01.aoi.greet", "face": "surprised", "voice": "auto" }
  ]
}
```

Scene file fields: `gvnf` (✓), `id` (✓, matches filename), `script` (✓, array of commands),
optional `stageMode`, optional `cast` (id[] hint for tooling), optional `_note`.

### 8.0 Command form

Each command is a JSON object identified by exactly one **command verb** — a key holding the
command's primary argument — plus option keys. (`_`-prefixed keys are ignored.) A command
the runtime does not recognize is skipped with a warning (forward-compat).

**Dual-use keys.** Three keys are both standalone verbs *and* inline option keys:
`face`, `outfit`, and `voice`. They are disambiguated mechanically, so "exactly one verb"
always holds:

- `face` / `outfit` are **standalone commands only when the object also has a `to` field**
  (the target expression/outfit). As inline options on `say`/`show` they carry **no** `to`
  and modify the dialogue/stage command instead.
- `voice` is a **standalone command only when no `say`/`narrate` is present**; alongside a
  line it is that line's voice clip.

So `{ "say":"aoi","text":"@k","face":"smile" }` is one `say` command (inline face), while
`{ "face":"aoi","to":"smile" }` is one `face` command. Lint enforces that every command
resolves to exactly one verb under these rules.

The verbs are listed below. **Quick reference table is in Appendix A.**

### 8.1 `say` — dialogue line

| Key | Type | Req | Description |
|-----|------|-----|-------------|
| `say` | char id \| null | ✓ | Speaker. `null` ⇒ narration (prefer `narrate`). |
| `text` | text | ✓ | Line content (`@key` or inline). |
| `id` | string | – | Line id, used for `voice:"auto"` and backlog/voice mapping. |
| `face` | expr id | – | Set speaker's expression for/at this line. |
| `outfit` | outfit id | – | Set speaker's outfit at this line. |
| `voice` | `"auto"`\|assetId\|null | – | Voice clip; `"auto"` uses `voicePattern`+`id`. |
| `at` | position | – | Force speaker's slot (auto-stage placement override). |
| `as` | text | – | Override displayed name (e.g. `"@name.unknown"` for a mystery voice). |
| `transition` | transition | – | Transition for any entrance this line triggers. |

In `auto` mode a bare `{ "say": "aoi", "text": "@k" }` triggers the §6.3 algorithm
(entrance/eviction/emphasis) automatically.

### 8.2 `narrate` — narration

`{ "narrate": "@s01.intro" }` — sugar for `{ "say": null, "text": … }`. Shows narration text
with no nameplate and no stage change (§6.3). Optional `id` for voice (narrator voice).

### 8.3 `bg` — background

| Key | Type | Req | Description |
|-----|------|-----|-------------|
| `bg` | bg asset id \| null | ✓ | Background to show; `null` clears to empty/black. |
| `transition` | transition | – | Defaults to `transitions.bg` then `dissolve`. |
| `camera` | object | – | `{ "zoom": 1.2, "x": 0.3, "y": 0.5, "duration": 1000 }` pan/zoom. |

### 8.4 `show` — bring a character on stage

| Key | Type | Req | Description |
|-----|------|-----|-------------|
| `show` | char id | ✓ | Character to show. |
| `at` | position | – | Slot; defaults to character's `defaultPosition` or a free side. |
| `outfit` | outfit id | – | Defaults to current/`defaultOutfit`. |
| `pose` | pose id | – | Defaults to current/`defaultPose`. |
| `face` | expr id | – | Defaults to current/`defaultFace`. |
| `transition` | transition | – | Entrance effect. |

Subject to the two-character rule (§6.4).

### 8.5 `hide` — remove a character

`{ "hide": "rin", "transition": "fade" }`. `{ "hide": "all" }` clears the stage.

### 8.6 `move` — relocate a visible character

`{ "move": "aoi", "to": "right", "transition": "slide" }`. Target slot MUST be free or held
by the same character.

### 8.7 `face` — change expression (facial expression change)

`{ "face": "aoi", "to": "blush", "transition": "dissolve" }`. `to` MUST be a declared
expression. Transition optional (default instant). Inline `face` on `say`/`show` is
equivalent for the affected character.

### 8.8 `outfit` — change clothing

`{ "outfit": "aoi", "to": "casual", "pose": "stand", "transition": "dissolve" }`. `to` MUST
be a declared outfit.

### 8.9 `cg` — full-screen event image

`{ "cg": "cg_first_meeting", "transition": "fade" }` shows a CG over the whole stage.
`{ "cg": null }` dismisses it and restores the prior stage/background.

### 8.10 `closeup` — item close-up

Foregrounds an **item** image (zoom/pan, optional caption) over a dimmed scene; restores on
exit. First-class support for the "inspect an object" beat.

| Key | Type | Req | Description |
|-----|------|-----|-------------|
| `closeup` | item asset id \| null | ✓ | Item to foreground; `null` exits the close-up. |
| `caption` | text | – | Caption shown with the item (`@key` or inline). |
| `zoom` | number | – | Scale factor (default 1.0). |
| `pan` | object | – | `{ "x":0..1, "y":0..1 }` focal point. |
| `dim` | number | – | Background dim 0..1 (default 0.6). |
| `transition` | transition | – | Default `dissolve`. |

```json
{ "closeup": "love_letter", "caption": "@s01.letter.caption", "zoom": 1.3,
  "dim": 0.7, "transition": "dissolve" }
```

Exit with `{ "closeup": null }` (or it auto-exits when a `bg`/`cg`/`show` changes the frame —
runtimes SHOULD treat an un-closed close-up at the next frame change as auto-exit and warn).

### 8.11 `bgm` — background music

| Key | Type | Req | Description |
|-----|------|-----|-------------|
| `bgm` | bgm asset id \| null \| `"stop"` | ✓ | Track to play; `null`/`"stop"` stops. |
| `fade` | int ms | – | Fade-in (or fade-out when stopping). Default 0. |
| `loop` | bool | – | Override manifest loop flag. |
| `volume` | 0..1 | – | Override bus default for this track. |

Switching to a different track while one plays performs a cross-fade over `fade`.

### 8.12 `se` — sound effect (one-shot)

`{ "se": "bell", "volume": 0.9 }`. Non-blocking by default; `{ "se":"door", "wait": true }`
blocks until the clip ends.

### 8.13 `voice` — standalone voice (rare)

`{ "voice": "aoi/s01_012" }` plays a voice clip outside a `say` (most voice is inline on
`say`). `{ "voice": "stop" }` halts current voice.

### 8.14 `shake` / `flash` — instant camera effects

`{ "shake": { "intensity": "medium", "duration": 400 } }` — intensity `light|medium|heavy`.
`{ "flash": { "color": "#ffffff", "duration": 200 } }`.

### 8.15 `wait` — pause

`{ "wait": 800 }` (ms) or `{ "wait": "click" }` (await player advance). Most `say` lines
implicitly wait for advance; `wait` is for timed beats between non-`say` commands.

### 8.16 `choice` — player decision

| Key | Type | Req | Description |
|-----|------|-----|-------------|
| `choice` | text | – | Prompt shown above options (optional). |
| `id` | string | – | Choice id (analytics/save). |
| `options` | option[] | ✓ | 1–8 options (§6 BR-17). |

Each **option**:

| Key | Type | Req | Description |
|-----|------|-----|-------------|
| `text` | text | ✓ | Option label. |
| `if` | condition | – | Option shown/enabled only if true (§9). |
| `hideIfFalse` | bool | – | If `if` false: hide (true) or show-disabled (false, default). |
| `set` | assignments | – | Variable effects applied on select (§9). |
| `do` | command[] | – | Inline commands to run on select. |
| `jump` | jump target | – | Branch to scene/label after `do`/`set`. |

```json
{ "choice": "@choice.lunch.prompt", "id": "lunch",
  "options": [
    { "text": "@choice.lunch.opt_join",  "set": { "aoi_affection": "+2", "route": "aoi" }, "jump": "#join" },
    { "text": "@choice.lunch.opt_leave", "set": { "aoi_affection": "-1" }, "jump": "#leave" }
  ] }
```

If an option has neither `jump` nor `do`, execution continues with the next command after the
`choice` (a "set a flag and move on" choice).

### 8.17 `set` — assign variables

`{ "set": { "met_rin": true, "rin_affection": "+1", "coins": "=coins-5" } }`. See §9.2 for
assignment value syntax.

### 8.18 `if` — conditional block

```json
{ "if": "aoi_affection >= 5",
  "then": [ { "narrate": "@s01.warm" } ],
  "elif": [ { "if": "aoi_affection >= 2", "then": [ { "narrate": "@s01.neutral" } ] } ],
  "else": [ { "narrate": "@s01.cold" } ] }
```

`then`/`else` are command arrays; `elif` is an array of `{ if, then }`.

### 8.19 `label`, `jump`, `call`, `return`

- `{ "label": "join" }` — a jump target within the scene.
- `{ "jump": "<target>" }` — transfer control. Targets:
  - `"s02_rooftop"` → start of scene `s02_rooftop`.
  - `"#join"` → label `join` in the **current** scene.
  - `"s02_rooftop#intro"` → label `intro` in scene `s02_rooftop`.
- `{ "call": "<target>" }` / `{ "return": true }` — push/pop a return address (e.g. a shared
  eyecatch or common route). Nesting depth ≤ 16 (BR-17).

### 8.20 `end` — end of game / route

`{ "end": "good" }` ends playback with ending id `good` (must exist in `game.json.endings`);
`{ "end": true }` is a generic end. Reaching the end of a `script` with no `jump`/`end` is an
implicit `{ "end": true }` (lint warning — prefer explicit).

---

## 9. Variables, conditions & branching

### 9.1 Variable model

- Variables are declared with initial values in `game.json.variables` (global). Types are
  inferred from initial value: `bool`, `int`, `number`, `string`.
- Reading an undeclared variable yields a typed zero (`false`/`0`/`""`) and a lint warning
  (BR-12).
- The reserved convention `<char>_affection` (int) holds relationship scores; `route`
  (string) holds the active route. These are conventions, not keywords.

### 9.2 Assignment syntax (`set` / option `set`)

Each entry `"<var>": <value>`:

- Literal: `true`, `false`, `12`, `3.5`, `"aoi"`.
- Relative int/number: `"+2"`, `"-1"` (add/subtract from current).
- Expression assignment: a string beginning with `=` is evaluated, e.g. `"=coins - 5"`,
  `"=min(aoi_affection+1, 10)"`.

### 9.3 Condition / expression grammar

A small, **safe, side-effect-free** expression language (no arbitrary code):

```
expr      := orExpr
orExpr    := andExpr ( "||" andExpr )*
andExpr   := notExpr ( "&&" notExpr )*
notExpr   := "!"? compare
compare   := add ( ("=="|"!="|"<"|"<="|">"|">=") add )?
add       := mul ( ("+"|"-") mul )*
mul       := atom ( ("*"|"/"|"%") atom )*
atom      := number | string | bool | varName | func "(" args? ")" | "(" expr ")"
func      := "min" | "max" | "abs" | "has"        // has(flag) ⇒ truthy
```

Used by `if`, `elif`, and option `if`. Strings are `"..."` or `'...'`. Variable names are
bare identifiers. Booleans/ints/strings compare per type; mixing types is a lint error.

### 9.4 Branching & flow

- Choices (§8.16) and `jump`/`call` (§8.19) drive flow. Every target MUST resolve (BR-10).
- Routes are conventionally implemented by a `route` variable + `if`/`jump` at scene starts.
- Flow is deterministic (BR-9). Any randomness MUST use `rand(seed)`-style functions seeded
  from save state (reserved for post-v1; not in the v1 grammar).

---

## 10. Runtime execution contract

A conforming runtime MUST implement these semantics; two conforming runtimes given the same
game + same player choices MUST produce the same narrative path and the same save snapshots
(modulo rendering).

### 10.1 Boot

1. Load & schema-validate `game.json`; reject on major-version mismatch.
2. Load the resource manifest, all character files, the default + requested locale tables.
   (Lazy asset loading is allowed; metadata must be available.)
3. Initialize variables from `game.json.variables`.
4. Set the program counter to the first command of `game.json.entry`.

### 10.2 Execution loop

Maintain: current scene + command index (PC), variable store, **stage state** (visible
chars with slot/outfit/pose/face + `lastSpeaker` + active), **audio state** (current bgm +
position), call stack, history/backlog.

For each command:

- Resolve displayable text via the locale chain (§4) with `{var}` interpolation.
- Apply the command's effect; for visual changes, run the transition (§7).
- For `say`/`narrate`: render text, run §6.3 stage logic, then **block** until the player
  advances (respecting skip/auto). Push the line to backlog.
- For `choice`: block until the player selects a (visible, enabled) option; apply
  `set`→`do`→`jump`.
- For `wait`/`se(wait)`/blocking transitions: block as specified.
- Advance PC; on `jump`/`call`/`return`/`end`, transfer/terminate accordingly.

### 10.3 Stage enforcement

- Enforce the two-character limit (§6.1) at every step; an illegal explicit state is a fatal
  content error (should have been caught by lint; at runtime, refuse the third sprite and
  warn).
- Apply auto-alternate (§6.3) when `stageMode == auto`.

### 10.4 Asset resolution

- Resolve all assets via manifest ids only. A missing referenced id is a fatal content error
  (lint should have caught it). For `voice:"auto"`, format `voicePattern` and try
  `<id>@<locale>` then `<id>`; if absent, play nothing (warn in dev).

### 10.5 Player controls (runtime features)

A runtime SHOULD provide: advance, **skip** (read/all), **auto**, **backlog/history**, **save
anywhere / load**, text-speed, and per-bus volume — none of which alter the deterministic
script path.

---

## 11. Save-state model

A save **snapshot** fully determines resumed playback (BR-18). Recommended shape:

```json
{
  "gvnf": "1.0",
  "game": "aoi_after_school",
  "gameVersion": "1.0.0",
  "savedAt": "2026-06-03T12:00:00Z",
  "locale": "en",
  "pc": { "scene": "s01_classroom", "index": 14 },
  "callStack": [],
  "variables": { "aoi_affection": 3, "rin_affection": 1, "met_rin": true, "route": "aoi" },
  "stage": {
    "mode": "auto",
    "lastSpeaker": "aoi",
    "active": "aoi",
    "visible": [
      { "char": "aoi", "slot": "left",  "outfit": "uniform", "pose": "stand", "face": "blush" },
      { "char": "rin", "slot": "right", "outfit": "uniform", "pose": "stand", "face": "smile" }
    ],
    "bg": "classroom_sunset",
    "cg": null,
    "closeup": null
  },
  "audio": { "bgm": "school_theme", "bgmPositionMs": 30400 },
  "backlogCursor": 57
}
```

- A runtime MUST be able to restore from this snapshot to a visually/narratively equivalent
  state. `bgmPositionMs` MAY be bucketed/approximate.
- Save format is versioned with `gameVersion`; loading across incompatible content versions
  MAY warn or migrate.

---

## 12. Validation rules (`galforge lint`)

The validator runs **schema validation** (§ schemas) then **cross-file checks**. Exit
non-zero on any error; `--strict` promotes ship-blocking warnings to errors (BR-16).

**Errors (MUST fix):**
- Schema violation in any file.
- Referenced asset id not in manifest (bg/sprite/cg/item/bgm/se/voice/ui). [BR-6]
- Sprite uses an outfit/pose/expression not declared for the character. [BR-7]
- `jump`/`call`/choice target does not resolve to a scene or label. [BR-10]
- A state that forces **three** simultaneously visible sprites. [BR-1]
- i18n key referenced but missing from the **default** locale. [BR-13]
- Type-mismatched comparison in a condition; malformed expression grammar.
- Unknown major `gvnf` version.

**Warnings (SHOULD fix; `--strict` → error):**
- Inline literal text where a key is expected (ship mode). [BR-15]
- Unreachable scene; unused declared asset (non-gallery). [BR-11, §3.5]
- Reading an undeclared variable. [BR-12]
- Missing key in a non-default locale. [BR-14]
- Outfit missing a pose present in other outfits. [R-3.3b]
- Implicit end of script (no explicit `end`). [§8.20]
- Un-closed `closeup` at the next frame change. [§8.10]

The validator SHOULD also emit a **manifest diff** (referenced-but-missing,
present-but-unused) as the asset work order (F-025).

---

## 13. Authoring conventions & defaults (non-normative)

- **Minimal line:** `{ "say": "aoi", "text": "@k", "id": "s01_001", "voice": "auto" }` — the
  stage takes care of itself in auto mode.
- **Emotional beat:** add `"face": "blush"` to the `say`.
- **Outfit change:** a standalone `{ "outfit": "aoi", "to": "casual" }` before the next line.
- **Bring in a third speaker:** just `say` as them — auto-alternate swaps the stage.
- **Inspect an object:** `{ "closeup": "class_key", "caption": "@k" }` … `{ "closeup": null }`.
- **Scene transition:** end with `{ "jump": "s02_rooftop" }` or `{ "end": "good" }`.
- **Drafting:** write inline prose first; run `galforge i18n` to auto-extract keys before
  ship.

---

## Appendix A — Command quick reference

| Verb | Purpose | Minimal example |
|------|---------|-----------------|
| `say` | Dialogue | `{ "say":"aoi","text":"@k" }` |
| `narrate` | Narration | `{ "narrate":"@k" }` |
| `bg` | Background | `{ "bg":"classroom_day","transition":"fade" }` |
| `show` | Enter character | `{ "show":"aoi","at":"left" }` |
| `hide` | Exit character | `{ "hide":"aoi" }` |
| `move` | Reposition | `{ "move":"aoi","to":"right" }` |
| `face` | Expression change | `{ "face":"aoi","to":"smile" }` |
| `outfit` | Clothing change | `{ "outfit":"aoi","to":"casual" }` |
| `cg` | Event image | `{ "cg":"cg_first_meeting" }` |
| `closeup` | Item close-up | `{ "closeup":"love_letter","caption":"@k" }` |
| `bgm` | Music | `{ "bgm":"school_theme","fade":800 }` |
| `se` | Sound effect | `{ "se":"bell" }` |
| `voice` | Standalone voice | `{ "voice":"aoi/s01_012" }` |
| `shake` | Screen shake | `{ "shake":{"intensity":"medium","duration":400} }` |
| `flash` | Screen flash | `{ "flash":{"color":"#fff","duration":200} }` |
| `wait` | Pause | `{ "wait":800 }` |
| `choice` | Player choice | `{ "choice":"@k","options":[…] }` |
| `set` | Assign vars | `{ "set":{"met_rin":true} }` |
| `if` | Conditional | `{ "if":"x>=2","then":[…],"else":[…] }` |
| `label` | Jump target | `{ "label":"join" }` |
| `jump` | Branch | `{ "jump":"s02_rooftop#intro" }` |
| `call`/`return` | Subroutine | `{ "call":"eyecatch" }` / `{ "return":true }` |
| `end` | End route | `{ "end":"good" }` |

## Appendix B — Suggested enumerations (non-normative)

- **Expressions:** `neutral, smile, grin, laugh, blush, shy, sad, cry, angry, pout,
  surprised, shocked, thinking, smug, sleepy, determined`.
- **Outfits:** `uniform, casual, sportswear, swimsuit, formal, winter, pajamas`.
- **Positions:** `left, center, right` (normative — §6).
- **Transitions:** see §7.1–§7.2.

Characters declare the subset they actually provide in the manifest (§3.3); these lists are
naming guidance for consistency across a project and for AI generators.
