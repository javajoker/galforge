# GalForge — Whitepaper

**A framework and open data standard for generating gal-games.**

**Version:** 1.0 · **Date:** 2026-06-03 · **Status:** Draft

---

## 1. Abstract

Gal-games (visual novels, "galge", dating sims, story/adventure games) are built from
a small, well-understood vocabulary: backgrounds, character sprites, music, voice,
sound effects, and a branching script of dialogue and choices. Yet every team rebuilds
this vocabulary in an ad-hoc, engine-specific way — making content non-portable, hard to
validate, and nearly impossible to generate programmatically.

**GalForge** defines an **engine-agnostic, schema-validated data standard** (the *GalForge
Visual-Novel Format*, **GVNF**) for the complete content of a gal-game, plus a reference
framework for authoring, validating, and playing it. The format is plain JSON: simple
enough for a human to write by hand, structured enough for a machine to validate, and
declarative enough for an **AI model to generate an entire game** — script, resource
manifest, and branching — from a premise.

The thesis: **if the content of a gal-game is fully described by data, then writing,
generating, localizing, porting, and tooling all become problems over data**, not over a
particular engine's API.

---

## 2. Motivation

### 2.1 The problem

- **Engine lock-in.** Content written for Ren'Py, Kirikiri, TyranoScript, Unity, or a
  bespoke engine cannot move between them. The story is entangled with the runtime.
- **No validation.** A misspelled sprite name, a missing voice clip, or a dangling
  branch is discovered at runtime — or by a player.
- **Hard to generate.** AI is now good at writing branching dialogue, but there is no
  *target format* an AI can emit that is both complete (resources + script + branching)
  and directly playable.
- **Localization as an afterthought.** Text is hard-coded into scripts, so adding a
  language means editing the script, not adding a data file.
- **Repeated plumbing.** Stage management, "who is on screen", transitions, expression
  swaps, and save/load are re-implemented per project with subtly different rules.

### 2.2 Why now

Two trends make a standard valuable today:

1. **AI-native content creation.** Models can write coherent, branching, character-driven
   dialogue at scale. They need a *declarative, validatable target* to emit into.
2. **Asset generation.** Image and voice models can produce backgrounds, layered
   character art, and voiced lines — but only if there is a **resource manifest** that
   says precisely what is needed (which character, which expression, which outfit, which
   line of voice).

GalForge is the contract that sits between *content generation* and *playback*.

---

## 3. Design principles

1. **Data over code.** A game is a set of JSON documents. The runtime is an interpreter,
   not a host for game logic.
2. **Engine-agnostic, runtime-neutral.** GVNF describes *intent* ("show Aoi, smiling, at
   left, with a dissolve"), not pixels or API calls. Any conforming runtime can play it.
3. **AI-authorable and human-authorable.** The same format must be pleasant to hand-write
   and unambiguous to generate. Defaults are sensible; verbosity is optional.
4. **Validate before you play.** Every document has a JSON Schema. A linter resolves all
   references (sprites, voice, jumps, variables) *before* runtime.
5. **Localization is structural.** Display text lives in per-locale string tables keyed by
   ID; the script references keys, never raw prose (inline prose is allowed for drafts).
6. **Resources are declared, not discovered.** A manifest enumerates every asset with
   metadata, so generators know exactly what to produce and runtimes know exactly what to
   load.
7. **The stage has rules.** The two-character limit, alternating display, expression and
   outfit swaps, and transitions are part of the *standard*, not per-project conventions.
8. **Deterministic playback.** Given the same script and the same player choices, two
   conforming runtimes produce the same narrative path and the same save state.

---

## 4. System architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                         AUTHORING / GENERATION                         │
│                                                                        │
│   Human writer     AI script generator     Asset generators            │
│   (editor/IDE)     (LLM → GVNF JSON)        (image/voice/BGM models)   │
│        │                  │                        │                   │
│        └──────────────────┴────────────────────────┘                   │
│                           ▼                                            │
│                 ┌───────────────────────┐                              │
│                 │   GVNF documents      │   game.json                  │
│                 │   (plain JSON)        │   characters/*.json          │
│                 │                       │   scenes/*.json              │
│                 │                       │   resources/manifest.json    │
│                 │                       │   i18n/<locale>.json         │
│                 └───────────┬───────────┘                              │
└─────────────────────────────┼──────────────────────────────────────────┘
                              ▼
                  ┌───────────────────────┐
                  │   VALIDATION LAYER    │   JSON Schema validation
                  │   (galforge lint)     │ + reference resolution
                  │                       │ + stage-rule checks
                  └───────────┬───────────┘   (2-char limit, dangling jumps,
                              │                 missing assets, unused keys)
                              ▼
        ┌────────────────────────────────────────────────────┐
        │                  RUNTIME LAYER                     │
        │   (interpreter; one per platform)                  │
        │                                                    │
        │   Web (canvas/DOM)   Ren'Py exporter   Unity/native│
        │        │                  │                  │     │
        │   Resolves assets · runs command loop ·            │
        │   enforces stage rules · manages save state        │
        └────────────────────────────────────────────────────┘
                              ▼
                          ▶  Player
```

**Layers:**

- **Authoring / generation** — humans and/or models produce GVNF JSON. GalForge ships
  authoring helpers but does not own this layer; the format is the only contract.
- **Validation** — `galforge lint` validates every file against its schema and performs
  cross-file checks (every referenced sprite/voice/jump exists; the two-character rule is
  satisfiable; no unreachable scenes; no missing i18n keys).
- **Runtime** — a thin interpreter executes the command list, resolves assets through the
  manifest, enforces the stage model, and persists save state. Runtimes are
  platform-specific but share the same execution semantics (Script Standard §10).

---

## 5. The content model in one page

A GalForge project is a directory of JSON:

```
my-game/
├── game.json              # project manifest: metadata, locales, entry scene, registries
├── characters/            # one file per character: name, color, sprite layers, voice
│   ├── aoi.json
│   └── rin.json
├── resources/
│   └── manifest.json      # every asset: bg, sprite layers, cg, item, bgm, se, voice, ui
├── i18n/                  # per-locale string tables, keyed by ID
│   ├── en.json
│   └── ja.json
└── scenes/                # the script: each scene is an ordered list of commands
    ├── s01_classroom.json
    └── s02_rooftop.json
```

- A **scene** is an ordered list of **commands** (`say`, `show`, `face`, `bg`, `bgm`,
  `closeup`, `choice`, `jump`, `set`, `if`, …).
- A **character** declares its **layered sprite** (pose/outfit × expression), name color,
  and voice defaults — enabling **facial-expression and clothing changes** as cheap state
  swaps rather than whole new images.
- The **resource manifest** is the single source of truth for what art/audio exists; it is
  also the **work order** an asset-generation pipeline fulfils.
- **Transitions** are attached to any visual change; **item close-ups** and **CG events**
  are first-class commands.

The full normative definition is the [Script Standard](spec/script-standard.md).

---

## 6. Distinctive design decisions

### 6.1 The two-character stage rule

Real gal-games rarely show more than two character sprites at once; crowds are conveyed by
swapping who is on screen as the conversation moves. GalForge makes this a **rule of the
standard**, not a per-project habit:

- The stage has at most **two visible slots** (typically `left` and `right`; solo scenes
  use `center`).
- In **multi-character conversations**, the runtime can run in **auto-alternate** mode:
  when an off-screen character speaks, it takes a slot — evicting the on-screen character
  least relevant to the current exchange (the non-active listener) — so the screen always
  shows the **current speaker and their partner**.
- The **active speaker is highlighted** and non-speakers are dimmed (alternating display),
  giving readers a clear focus without exceeding two sprites.

This keeps composition clean, art requirements bounded, and generation simple: a writer or
AI just writes `say` lines with speakers; the stage manages itself. See Script Standard §6.

### 6.2 Layered sprites for expression & outfit

A character sprite is composed of a **body layer** (pose + outfit) and a **face layer**
(expression). Changing a mood is a `face` command; changing clothes is an `outfit`
command. This:

- Cuts asset count from *poses × outfits × expressions* down to *poses × outfits + faces*.
- Makes mid-line emotional beats trivial (`"face": "blush"` on a line).
- Gives asset generators a crisp, enumerable shopping list.

### 6.3 Transitions as data

Every visual change (`bg`, `show`, `hide`, `cg`, `closeup`) accepts an optional
`transition` object (`type`, `duration`, `easing`). The standard defines a **catalog** of
named effects (dissolve, fade-to-black/white, slides, wipes, shake, flash, …) so content is
portable across runtimes that may render them differently but mean the same thing.

### 6.4 Item close-ups

Inspecting an object — a love letter, a key, a photograph — is a recurring beat. `closeup`
is a first-class command that foregrounds an item image (with optional zoom/pan and
caption) over a dimmed scene, then restores the stage.

---

## 7. Tooling & ecosystem (reference framework)

| Tool | Role |
|------|------|
| `galforge lint` | Schema validation + cross-file reference & stage-rule checks |
| `galforge play` (web runtime) | Reference interpreter; canonical playback semantics |
| `galforge new` | Scaffolds a project from the template in [samples/](samples/) |
| `galforge manifest` | Diffs script ↔ manifest; emits the asset work order for generators |
| `galforge i18n` | Extracts/auto-keys strings; reports missing/orphan locale keys |
| AI generator (adapter) | Emits GVNF JSON from a premise; output is `lint`-gated |
| Exporters | GVNF → Ren'Py / web bundle / native (community-extensible) |

The framework is intentionally thin: **the value is the format and its validator**, so the
ecosystem can grow independent runtimes and generators around a stable contract.

---

## 8. Why a standard wins

- **Portability.** Write once; play on web today, export to Ren'Py or native later.
- **Generability.** AI emits a single, complete, validatable target — not snippets glued to
  an engine.
- **Validatability.** Whole classes of bugs (missing assets, dangling branches, broken
  localization, illegal stage states) are caught by a linter, before a player ever sees
  them.
- **Localizability.** A new language is a new data file, not a script rewrite.
- **Separation of concerns.** Writers write script; artists fulfil a manifest; engineers
  build runtimes — all against one contract.

---

## 9. Scope & roadmap

**v1.0 (this document set):** the GVNF content model — manifest, characters, scenes,
commands, stage model (two-character rule + alternating display), transitions, expressions
& outfits, item close-ups, choices/branching, variables/flags, localization, save-state
contract; JSON Schemas; a complete sample game; the reference web runtime semantics.

**Post-v1 (non-normative directions):**
- Animated sprites / Live2D-style rig hooks (declared in the manifest, optional for
  runtimes).
- Affection/route engines as a standard variable convention.
- Voice/lip-sync metadata.
- Editor IDE with live preview.
- Marketplace of GVNF games and reusable resource packs.

**Out of scope (v1):** real-time/action gameplay, 3D scene graphs, networked multiplayer,
and engine-internal rendering details — GalForge describes *narrative intent*, not a render
pipeline.

---

## 10. Conclusion

Gal-games have a stable, small, well-understood content vocabulary. By committing that
vocabulary to a validatable, engine-agnostic, AI-authorable data standard, GalForge turns
"making a visual novel" into "producing and validating data" — unlocking portability,
tooling, localization, and large-scale AI generation while keeping the authored result a
clean, deterministic, human-readable artifact.

The normative format follows in the [PRD](PRD.md) and the
[Script Standard](spec/script-standard.md).
