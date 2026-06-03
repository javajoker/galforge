# GalForge — Product Requirements Document

**Version:** 1.0
**Date:** 2026-06-03
**Status:** Draft

> Companion documents: [Whitepaper](whitepaper.md) · [Script Standard (GVNF v1.0)](spec/script-standard.md) · [Sample game](samples/)

---

## 1. Executive Summary

**GalForge** is a framework and open data standard for **generating gal-games** (visual
novels / dating sims) from structured, engine-agnostic JSON: image / BGM / voice resources,
character definitions, conversations, and branching scene scripts. It serves writers who
want portability, studios who want validation, and **AI pipelines that need a complete,
validatable target to generate an entire game into**. The format (GVNF) is human-writable,
machine-validatable, and runtime-neutral. **Value proposition: describe a gal-game once, as
validated data, and author it by hand or by AI, play it anywhere, and localize it without
touching the script.**

---

## 2. Goals and Non-Goals

### 2.1 Goals (in scope)

- Define a **normative, schema-validated data standard** (GVNF v1.0) covering the full
  content of a gal-game: project manifest, resources (image/BGM/SE/voice), characters,
  conversations, and branching scene scripts.
- Make the format **equally authorable by humans and by AI generators**, with sensible
  defaults so common cases are terse.
- Specify a **stage model** enforcing the **two-character limit** and **alternating display**
  for multi-character conversations.
- Make **transition effects**, **facial-expression changes**, **clothing/outfit changes**,
  and **item close-ups** first-class, standardized features.
- Provide **JSON Schemas** for every document type and define cross-file **validation rules**
  (reference resolution, dangling branches, missing assets, missing localization keys).
- Define a **runtime execution contract** so any conforming interpreter plays a game
  identically (same choices → same path → same save state).
- Make **localization structural**: per-locale string tables keyed by ID.
- Ship a **complete sample game** that exercises every feature and validates clean.
- Define a **resource manifest** that doubles as the **work order** for asset-generation
  pipelines.

### 2.2 Non-Goals (explicitly out of scope for v1)

- Building a production renderer for any specific platform (the standard defines semantics;
  runtimes are separate deliverables; a reference web runtime's *semantics* are specified
  but pixel-level rendering is not mandated).
- Real-time / action gameplay, mini-games, 3D scene graphs, or physics.
- Networked or multiplayer features.
- A visual editor IDE (post-v1).
- Animated sprites / Live2D rigs, lip-sync, and voice auto-generation (hooks reserved;
  not normative in v1).
- Digital-rights management, store, or distribution infrastructure.
- Asset *generation* itself (image/voice models) — GalForge specifies the manifest those
  tools consume/produce, not the models.

---

## 3. User Personas

### 3.1 Scenario Writer ("Writer")
- **Background:** Writes branching dialogue and routes; comfortable with text, not code.
- **Goals:** Write character-driven, branching stories; preview quickly; not fight an engine.
- **Pain points:** Engine-specific scripting languages; runtime-only error discovery;
  re-typing the same stage-management boilerplate.
- **Technical comfort:** Low–medium (can edit JSON/YAML with a schema-aware editor).

### 3.2 AI Game Generator ("Generator")
- **Background:** An LLM-driven pipeline that turns a premise/outline into a full game.
- **Goals:** Emit one complete, validatable artifact (script + manifest + characters +
  localization) that plays without hand-fixing.
- **Pain points:** No declarative target; engine APIs are imperative and un-validatable;
  no crisp asset work order to coordinate with image/voice generation.
- **Technical comfort:** High (but needs an unambiguous spec and schemas to target).

### 3.3 Resource Artist / Asset Pipeline ("Artist")
- **Background:** Produces backgrounds, layered character art, CGs, BGM, SE, and voice —
  or operates the models that do.
- **Goals:** Know **exactly** what assets are required (which expression, which outfit,
  which line of voice) and in what format/dimensions.
- **Pain points:** Vague or drifting asset lists; assets produced but never referenced;
  references with no asset.
- **Technical comfort:** Medium.

### 3.4 Runtime / Tool Engineer ("Engineer")
- **Background:** Builds an interpreter (web/native), exporter, or validator.
- **Goals:** Implement against a precise, testable contract; pass a conformance suite.
- **Pain points:** Ambiguous semantics; under-specified edge cases (save mid-transition,
  stage rule on the third speaker).
- **Technical comfort:** High.

### 3.5 Player ("Player")
- **Background:** Plays the resulting game.
- **Goals:** A coherent, well-paced story with clear focus, working choices, voice, music,
  save/load, and their chosen language.
- **Pain points:** Missing art/voice, broken branches, confusing "who's talking", lost saves.
- **Technical comfort:** Any.

---

## 4. User Stories

> Format: *As a {persona}, I want to {action}, so that {outcome}.*

### 4.1 Writer
- US-1.1: As a writer, I want to write a line as `{ "say": "aoi", "text": "..." }`, so that I
  focus on dialogue, not engine calls.
- US-1.2: As a writer, I want a character's expression and outfit to change mid-scene with a
  one-word command, so that emotional beats are effortless.
- US-1.3: As a writer, I want to add a third (and fourth) speaker to a conversation without
  managing who is on screen, so that the stage rule is handled for me.
- US-1.4: As a writer, I want choices that set flags and branch to other scenes, so that I
  can write routes.
- US-1.5: As a writer, I want validation to tell me about a typo'd sprite or a dead branch
  before I playtest, so that I waste no time.

### 4.2 Generator (AI)
- US-2.1: As a generator, I want one JSON target that fully describes a game, so that I can
  emit a complete, playable artifact in one pass.
- US-2.2: As a generator, I want the format to have defaults (default position, default
  transition, auto-stage), so that minimal output is still valid and good.
- US-2.3: As a generator, I want a manifest that enumerates every required asset, so that I
  can hand a precise work order to image/voice models.
- US-2.4: As a generator, I want a linter exit code, so that I can self-correct until valid.

### 4.3 Artist / Asset Pipeline
- US-3.1: As an artist, I want every sprite layer (pose, outfit, expression) enumerated with
  dimensions and an anchor, so that I produce exactly what's needed.
- US-3.2: As an artist, I want a report of assets referenced-but-missing and present-but-
  unused, so that production stays in sync with the script.
- US-3.3: As an artist, I want voice lines keyed to specific script lines, so that recording/
  generation maps 1:1 to dialogue.

### 4.4 Engineer
- US-4.1: As an engineer, I want a precise command list and execution loop, so that my
  runtime is conformant.
- US-4.2: As an engineer, I want the two-character/alternating rules specified to the edge,
  so that all runtimes agree on what's on screen.
- US-4.3: As an engineer, I want a save-state schema, so that saves are portable across
  builds of the same game.

### 4.5 Player
- US-5.1: As a player, I want to always see who is speaking, so that I follow the conversation.
- US-5.2: As a player, I want save/load, skip, auto, and backlog, so that I control pacing.
- US-5.3: As a player, I want to play in my language, so that the story is mine.

---

## 5. Feature List

| ID | Feature | Description | Priority | Persona |
|----|---------|-------------|----------|---------|
| F-001 | Project manifest (`game.json`) | Metadata, resolution, locales, entry scene, registries, global vars | P0 | All |
| F-002 | Resource manifest | Declares every bg / sprite-layer / cg / item / bgm / se / voice / ui asset with metadata | P0 | Artist, Engineer, Generator |
| F-003 | Character definitions | Name (i18n), name color, layered sprite (poses/outfits × expressions), voice defaults, default position | P0 | Writer, Artist |
| F-004 | Scene scripts (command list) | Ordered commands per scene: `say`, `narrate`, `bg`, `show`, `hide`, `bgm`, `se`, … | P0 | Writer, Generator |
| F-005 | Dialogue & narration | `say` (speaker + text + optional voice/face) and `narrate` | P0 | Writer, Player |
| F-006 | **Two-character stage model** | Max 2 visible sprites; slots; default positions | P0 | All |
| F-007 | **Alternating display (auto-stage)** | Multi-character convo: speaker takes a slot, evicts non-active partner; speaker highlighted, others dimmed | P0 | Writer, Engineer, Player |
| F-008 | **Facial expression change** | `face` command / per-line `face`; layered face state | P0 | Writer, Artist |
| F-009 | **Clothing / outfit change** | `outfit` command; layered body state | P0 | Writer, Artist |
| F-010 | **Transition effects** | `transition` on any visual change; named catalog (dissolve, fades, slides, wipes, shake, flash, …) | P0 | Writer, Engineer |
| F-011 | **Item close-up** | `closeup` foregrounds an item image (zoom/pan + caption) over dimmed scene | P0 | Writer, Player |
| F-012 | CG / event images | `cg` full-screen event art with transition | P0 | Writer, Artist |
| F-013 | BGM control | Play / stop / fade / loop-points / cross-fade | P0 | Writer, Player |
| F-014 | Sound effects | `se` one-shots; optional positional/volume | P1 | Writer |
| F-015 | Voice playback | Per-line voice, per-locale, with character voice defaults | P0 | Writer, Player, Artist |
| F-016 | Choices / menus | `choice` with options → branch; option conditions & flag effects | P0 | Writer, Player |
| F-017 | Variables / flags | `set`, `if`, expressions; affection/route conventions | P0 | Writer, Generator |
| F-018 | Labels & jumps | In-scene `label`; `jump` to scene or label; `call`/`return` | P0 | Writer |
| F-019 | Localization (i18n) | Per-locale string tables keyed by ID; fallback chain; inline text for drafts | P0 | Writer, Player |
| F-020 | Save / load state | Snapshot schema: scene + index + vars + stage + audio | P0 | Player, Engineer |
| F-021 | JSON Schemas | Schema per document type | P0 | Engineer, Generator |
| F-022 | Validator (`galforge lint`) | Schema + cross-file checks + stage-rule checks | P0 | All |
| F-023 | Playback controls | Skip / auto / backlog / text speed / save anywhere | P1 | Player |
| F-024 | Scaffold / template | `galforge new` from sample | P1 | Writer, Generator |
| F-025 | Asset work-order export | Manifest ↔ script diff → list for generators | P1 | Artist, Generator |
| F-026 | Camera effects | Screen shake, flash, pan/zoom on background | P1 | Writer |
| F-027 | Exporters | GVNF → Ren'Py / web bundle / native | P2 | Engineer |
| F-028 | Animated / Live2D sprite hooks | Optional animated layer declarations | P2 | Artist |
| F-029 | Conformance test suite | Reference scripts + expected state traces | P1 | Engineer |
| F-030 | Settings/config | Per-game default text speed, skip rules, volume buses | P1 | Player |

**Priority key** — **P0:** required for v1; removing it kills core value. **P1:** important,
deferrable to fast-follow. **P2:** nice-to-have / polish.

---

## 6. Business Rules

> "Business rules" here are the **normative content & playback rules** of the standard. The
> Script Standard is the authoritative source; this section is the product-level summary.

### 6.1 Stage & display rules
- **BR-1 (two-character limit):** At most **two** character sprites may be *visible*
  simultaneously. A runtime MUST reject (lint error) or auto-resolve any state that would
  show three.
- **BR-2 (positions):** Solo characters default to `center`; pairs default to `left` and
  `right`. A character may be re-positioned but never to a slot occupied by another visible
  character.
- **BR-3 (alternating display):** In a conversation with >2 participants, when an off-screen
  participant speaks under **auto-stage**, the runtime brings them on screen and evicts the
  currently visible **non-active** participant (the one who is not the current speaker's
  partner / least-recently active). The screen therefore always shows *current speaker +
  one partner*.
- **BR-4 (speaker emphasis):** The active speaker's sprite is emphasized (full
  brightness/forward); non-speaking visible sprites are de-emphasized (dimmed/back). This is
  the visual form of "alternating based on dialogue".
- **BR-5 (manual override):** A scene may opt out of auto-stage and manage `show`/`hide`
  explicitly, but BR-1 still holds — an explicit third `show` is a lint error.

### 6.2 Resource rules
- **BR-6 (declared assets):** Every asset referenced by a script MUST exist in the resource
  manifest; every voice line referenced MUST map to a voice asset (or be explicitly silent).
- **BR-7 (layered sprites):** A character sprite is `body(pose+outfit)` + `face(expression)`.
  Expressions and outfits MUST be drawn from the character's declared enumerations.
- **BR-8 (formats):** Recommended asset formats and constraints are defined per type
  (Script Standard §3). Runtimes MUST support the baseline set; others are optional.

### 6.3 Script & branching rules
- **BR-9 (deterministic flow):** Given identical player input, execution order is
  deterministic. Randomness, if used, MUST go through a seeded RNG recorded in save state.
- **BR-10 (resolvable jumps):** Every `jump`/`call`/choice target MUST resolve to an existing
  scene or label. Dangling targets are a lint error.
- **BR-11 (reachability):** Every scene SHOULD be reachable from the entry scene; unreachable
  scenes are a lint warning.
- **BR-12 (variables declared):** Variables read by `if`/conditions SHOULD be initialized in
  `game.json` globals or `set` before first read; reading an undeclared variable is a lint
  warning and defaults to a typed zero value at runtime.

### 6.4 Localization rules
- **BR-13 (keys not prose):** Shipping content references i18n keys; every key used MUST
  exist in the default locale. Missing keys in a non-default locale fall back per **BR-14**.
- **BR-14 (fallback chain):** Resolution order is `requested-locale → default-locale → key`.
  A missing default-locale key is a lint error; a missing non-default key is a warning.
- **BR-15 (inline drafts):** Inline string text is permitted during drafting but flagged by
  lint in `--strict` (ship) mode.

### 6.5 Validation & limits
- **BR-16:** A game is **shippable** only if `galforge lint --strict` returns zero errors.
- **BR-17 (limits):** Recommended caps — line text ≤ 1000 chars; ≤ 64 visible-able characters
  per game; ≤ 2 visible at once (hard); choice options ≤ 8 per menu; nesting depth of
  `if`/`call` ≤ 16. Runtimes MAY raise these but MUST document deviations.

### 6.6 Save-state rules
- **BR-18:** A save snapshot fully determines resumed playback: current scene + command
  index + all variables + stage state (visible chars, positions, expressions, outfits) +
  audio state (bgm + loop position bucket). Save format is versioned with the game.

---

## 7. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Spec completeness | 100% of P0 features have a schema + sample coverage | Checklist vs sample game |
| Generation success | ≥ 80% of AI-generated games pass `lint --strict` on first or second pass | Generator eval harness |
| Validator coverage | Linter catches 100% of seeded defect classes (missing asset, dangling jump, 3-char state, missing default key) | Conformance fault-injection suite |
| Runtime conformance | 2+ independent runtimes produce identical state traces on the test suite | Trace diff |
| Authoring effort | A standard 2-character dialogue line is ≤ 1 JSON object with ≤ 3 keys | Sample inspection |
| Localization effort | Adding a language = adding 1 locale file, 0 script edits | Sample (en + ja) |
| Asset sync | 0 referenced-but-missing and 0 unused-but-present assets in shippable games | `galforge manifest` diff |

---

## 8. Risks and Open Questions

### 8.1 Technical Risks
- **R-1 Stage-rule ambiguity.** "Evict the non-active partner" must be specified to the edge
  (ties, simultaneous entrance, narration between speakers). *Mitigation:* §6 of the Script
  Standard defines the eviction policy precisely; conformance suite covers the cases.
- **R-2 Transition portability.** Runtimes render effects differently. *Mitigation:* the
  catalog defines *intent + duration + easing*; exact pixels are runtime-defined but must be
  visually equivalent; `none` is always supported as a floor.
- **R-3 Determinism vs randomness.** Random events threaten reproducible saves.
  *Mitigation:* seeded RNG recorded in save state (BR-9).

### 8.2 Product Risks
- **R-4 Format too verbose → poor AI/human ergonomics**, or **too terse → ambiguous**.
  *Mitigation:* defaults + optional verbosity; the sample is the ergonomics benchmark.
- **R-5 Adoption / cold start.** A standard with one runtime is just an engine.
  *Mitigation:* keep the format thin and the validator authoritative; ship exporters early.

### 8.3 Open Questions (decide before/with v1 implementation)
- **Q-1 Authoring surface:** Is JSON the only authored form, or is a friendlier DSL/YAML the
  primary writing surface that compiles to GVNF JSON? *(Default this doc set assumes: JSON is
  the normative interchange; YAML is an allowed authoring convenience that maps 1:1.)*
- **Q-2 Reference runtime platform:** Web-first (canvas/DOM) as the canonical runtime?
  *(Default assumption: yes — web reference runtime defines canonical semantics.)*
- **Q-3 Expression model depth:** Flat expression IDs (v1) vs composable face parts
  (eyes/mouth/brows). *(Default: flat IDs in v1; composable parts deferred to post-v1.)*
- **Q-4 Voice/lip-sync metadata:** include timing hooks in v1 or defer? *(Default: defer;
  reserve fields.)*
- **Q-5 Conditional/expression language:** how rich? *(Default: a small, safe expression
  grammar — comparisons, boolean ops, arithmetic on declared vars; no arbitrary code.)*

---

## 9. Glossary

| Term | Definition |
|------|------------|
| Gal-game | A visual-novel / dating-sim style narrative game (galge). |
| GalForge | The framework + standard defined by this document set. |
| GVNF | GalForge Visual-Novel Format — the JSON data standard. |
| Scene | An ordered list of commands; the unit of script. |
| Command | A single instruction in a scene (`say`, `show`, `bg`, `choice`, …). |
| Stage | The visible set of character slots (max two). |
| Slot / position | A stage location: `left`, `center`, `right`. |
| Auto-stage | Mode where the runtime manages who is visible from `say` speakers. |
| Active speaker | The character whose line is currently displayed; emphasized on stage. |
| Layered sprite | Character art composed of `body(pose+outfit)` + `face(expression)`. |
| Expression | A face state (neutral, smile, angry, …). |
| Outfit | A clothing/body state (uniform, casual, …). |
| Transition | A named visual effect applied to a change (dissolve, fade, slide, …). |
| CG | A full-screen event illustration. |
| Close-up | A foregrounded item image with optional zoom/pan and caption. |
| Manifest | The resource manifest: the declared list of all assets. |
| i18n key | An identifier resolved to display text via per-locale string tables. |
| Save snapshot | The serialized state that fully determines resumed playback. |
| Runtime | A conforming interpreter that plays a GVNF game. |
| Lint | Schema + cross-file validation (`galforge lint`). |
