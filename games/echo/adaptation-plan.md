# Adaptation Plan — 《ECHO》

**Source:** `ECHO.md` (Simplified-Chinese prose: a five-chapter story + a settings bible).
**Mode:** Novel → visual-novel adaptation (scene segmentation, POV framing, stage/resource
filling, branch graph derived from the story's own *四种命运 / Four Fates*).
**Target:** GVNF v1.0, lint-clean (`galforge lint --strict` exits 0).
**Locales:** `zh-CN` (default, the original prose) + `en` (full translation).

---

## 1. POV & protagonist

The source is written in the **second person** — *你*, a system maintainer who is pulled
out of "order" and asked to choose a faction. The protagonist therefore has **no sprite and
no nameplate**: their inner voice is carried by `narrate`, and their one outward act — the
refusal — is also narration. This keeps the player *inside* the "you" the story addresses,
which is the whole point of an experiment about human subjectivity.

The three named consciousnesses are the cast — each a faction leader trying (or pretending)
to recruit you.

## 2. Cast

| id | Name | Role | Nameplate | Sprite plan |
|----|------|------|-----------|-------------|
| `chaos` | 混沌 / CHAOS | Embodiment of the Chaos Protocol. An artist who rewrites the system's signage with a glowing spray-can. Provocative, gleeful. | `#e0427a` (hot magenta) | outfit `street`; faces `neutral, grin, smug, laugh, angry, surprised` |
| `shelter` | 庇护 / SHELTER | Embodiment of the Shelter Protocol (the uploaded researcher *Aegis*). Keeper of deleted memories; her space is a museum of old photos. Gentle, sorrowful. | `#4fb3a6` (soft teal) | outfit `gown`; faces `neutral, smile, sad, worried, surprised, cry` |
| `order` | 秩序 / ORDER | The system's creator. In-system: the absolute authority on every screen. In reality: a 100-year-old man at your bedside. Cold, then — at the very end — repentant. | `#6f8fd6` (cold blue) | outfits `system`, `elder`; faces `neutral, stern, smug, smile, sad, surprised` |

ORDER's two outfits (`system` → `elder`) carry the story's central reveal — the god of the
machine is a dying old man — as a single on-stage **outfit change** in the epilogue.

> **Two-character rule (§6):** every scene runs in `stage.mode: auto`. The protagonist is
> sprite-less, so they never occupy a slot. Even the *镜廊 / Mirror Gallery* scene, where all
> three leaders are present, is written as plain `say` lines — auto-alternation always frames
> *current speaker + most-recent other speaker*, never a third sprite.

## 3. Scene / episode map

| Scene | Chapter | Setting (bg) | Beats |
|-------|---------|--------------|-------|
| `s01_order_hall` (entry) | 第一章 秩序的裂痕 | `order_hall` | The white Hall of Order; ORDER's broadcasts; the CHAOS pop-up *「发现世界的真相了吗？」* (item close-up `glitch_window`); a glimpsed 1999 family photo CG; the alarm; you are flagged *潜在异常体* and flee. |
| `s02_the_crack` | 第二章 裂缝 | `pipes` → `data_graveyard` | The infrastructure pipes, graffiti, the CHAOS tag; meeting CHAOS; his creed (order = control); **minor choice** (how you answer him → `chaos_lean`); he leads you to the data graveyard. |
| `s03_shelter` | 第三章 庇护 | `memory_museum` | SHELTER's archive; the photo was a *real, deleted memory* (CG + item close-up `memory_shard`); the surface truth of ECHO; **minor choice** (→ `shelter_lean`, sets `saw_truth`). |
| `s04_mirror_gallery` | 第四章 镜廊 | `mirror_gallery` | Drones close in (`se_drone`); the Mirror Gallery the system can't fully control; the three desire-illusions CG; ORDER appears in person and offers the Order faction; **minor choice** (→ `order_lean`). |
| `s05_four_fates` | 第五章 四种命运 | `mirror_gallery` / `white_void` | **The decision.** A 4-option `choice`: Order / Chaos / Shelter / **Refuse**. Three options resolve to their endings on the spot; *Refuse* whites out the system and jumps to the epilogue. |
| `s06_echo` | 结局 回声 | `pod_room` → `real_city` | Waking in the maintenance pod; ORDER as a centenarian (`order` outfit `system`→`elder`); his confession and apology; you turn to the window — the real, unpredictable city; *refuse to become an echo.* |

Flow: `s01 → s02 → s03 → s04 → s05`; from `s05` the Refuse branch alone continues to `s06`.
Every scene is reachable from the entry; every path terminates in an explicit `end`.

## 4. Branch / route / ending graph

The three "model" fates are *predictable* — the story's thesis — so they are quick, decisive
endings. The fourth, *Refuse*, is the true ending and the only one with an epilogue.

```
                 s05_four_fates  (choice: id = "fate")
                 ┌──────────────┬──────────────┬───────────────┐
        choose order      choose chaos   choose shelter   refuse all
            │                  │               │               │
       cg_order_throne   cg_chaos_collapse cg_shelter_sleep  white_void
            │                  │               │            se_shatter
        end order_end      end chaos_end   end shelter_end      │
                                                          jump s06_echo
                                                                │
                                                          end refuse_end
```

Minor early choices (`chaos_lean`, `shelter_lean`, `order_lean`, `saw_truth`) **do not gate
routes** — every fate stays available, because the point is that you can always say *no*.
They tune flavour lines via `if` at the start of `s05` (which leader's argument echoes loudest
as you decide) and a `saw_truth` aside in `s04`. All four endings are reachable regardless.

**Endings (`game.json.endings`):**
- `order_end` — 新的秩序 (become the new administrator)
- `chaos_end` — 崩解 (destroy the system)
- `shelter_end` — 长眠 (sleep forever in memory)
- `refuse_end` — 回声 (the true ending: refuse to be defined)

## 5. Variables

| var | type | use |
|-----|------|-----|
| `route` | string | active fate; set by the s05 choice (`order`/`chaos`/`shelter`/`refuse`). |
| `order_lean` / `chaos_lean` / `shelter_lean` | int | how strongly each leader's pitch landed; raised by the minor choices; read by `if` for flavour at s05. |
| `saw_truth` | bool | set when SHELTER reveals the deleted memory; gates an aside in s04. |

## 6. Presentation beats (transitions / CG / close-up / audio)

- **Transitions:** `pixelate` for digital/system shifts (entering the hall, the system locking
  you out), `ripple` for memory (the 1999 photo, the museum), `fadeWhite` for the refusal
  white-out, `dissolve`/`fade` elsewhere.
- **Item close-ups (§8.10):** `glitch_window` (the CHAOS pop-up message) in s01;
  `memory_shard` (a preserved memory fragment) in s03.
- **CGs (§8.9):** `cg_photo_1999` (the warm, forbidden memory), `cg_mirror_desires` (the three
  desire-illusions), the three ending CGs, `cg_awakening`, `cg_real_city`. `cg_cover` is the
  gallery cover.
- **Camera/instant:** `shake` + `flash` on the alarm and the system crash.
- **BGM arc:** `bgm_order` (sterile) → `bgm_alarm` (flight) → `bgm_underground` (CHAOS) →
  `bgm_memory` (SHELTER) → `bgm_mirror` (the gallery & the choice) → `bgm_collapse` (refusal)
  → `bgm_reality` (the real world).
- **Voice:** partial voicing — key emotional lines per leader carry `voice: "auto"` and a
  matching manifest entry (default `zh-CN`, with an `@en` variant declared as the work-order
  for an English dub).

## 7. Deliverable check

`game.json` · 3 characters · `resources/manifest.json` (the asset work-order) · 6 scenes ·
`i18n/zh-CN.json` + `i18n/en.json` · 1 major choice + 3 minor choices · 4 endings.
Gate: `galforge lint --strict` → clean.
