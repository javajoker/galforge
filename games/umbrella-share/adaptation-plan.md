# Adaptation plan — *The Umbrella We Shared*

**Mode:** novel / prose fiction → adapt (segment scenes, choose POV, invent one branch point).
**Source:** `source.md` (~500 words, single scene). **Target length:** 2 scenes, 1 choice,
2 endings. **Default locale:** `en` (en-only for this dry-run).

## Logline & tone
A boy misses the last bus in a thunderstorm and shares a rain shelter with two classmates —
loud, lucky Nao and quiet Shizuku. A dropped charm forces a small choice: chase the yellow
umbrella, or wait out the rain with the quiet girl. Warm, wistful, slice-of-life.

## POV
First-person MC **Yuuto** → a **sprite-less** protagonist (§5): his lines show a nameplate
but place nothing on stage and never affect the two-character rule.

## Cast
| id | role | sprite? | nameColor | expressions needed | outfits |
|----|------|---------|-----------|--------------------|---------|
| `yuuto` | protagonist (MC) | no (`sprite:null`) | `#bcbcbc` | — | — |
| `nao` | heroine — energetic | yes | `#e8a13a` | neutral, smile, grin, surprised, pout | uniform |
| `shizuku` | heroine — quiet | yes | `#4f9db0` | neutral, smile, blush, sad, surprised | uniform, casual |
| `rui` | Nao's track friend (comic) | yes | `#6aa84f` | neutral, surprised, grin | uniform |

## Scene map
1. **`s01_busstop`** — bg `busstop_rain`, bgm `rain_theme`. Yuuto misses the bus; Nao ducks
   in (entrance + `grin`); Yuuto banters; **thunder** `se` + Nao's `surprised` flicker;
   Shizuku speaks from the bench (2nd sprite enters). **Rui bursts in** = the *third speaker*
   → auto-stage evicts the non-active partner (demonstrates the two-character rule). Rui drags
   Nao off (`hide`). Yuuto spots the dropped charm → **item close-up** `bus_charm`. Shizuku
   offers to wait. **Choice:** chase Nao / stay with Shizuku.
2. **`s02_after`** — bg `street_evening`, bgm `tender`. `if route`:
   - `nao` → **CG** `cg_yellow_umbrella`, Nao `smile`, ending `nao_end`.
   - `shizuku` → Shizuku **outfit change** uniform→`casual` (drying off), `blush`, **CG**
     `cg_shared_shelter`, ending `shizuku_end`.

## Stage notes
`stageMode: "auto"` everywhere. s01 has 4 speakers (yuuto sprite-less + nao/shizuku/rui) — the
3 sprite girls never exceed 2 on screen; Rui's entrance triggers an eviction.

## Branch graph
```
s01_busstop ── choice "umbrella"
   ├─ chase   → set route=nao,     nao_affection+=2,    has_charm=true → s02 → if nao     → end nao_end
   └─ wait    → set route=shizuku, shizuku_affection+=2, has_charm=true → s02 → else (shizuku) → end shizuku_end
```
`met_rui` is set true when Rui appears (flavor flag, read nowhere — kept minimal/declared).

## Resource intent (→ work-order for resource-planner)
- bg: `busstop_rain`, `street_evening`. cg: `cg_yellow_umbrella`, `cg_shared_shelter`,
  `cg_cover` (gallery). item: `bus_charm`. bgm: `rain_theme`, `tender`. se: `thunder`.
  voice: `nao/s01_002`, `shizuku/s01_006` (en). ui: `namebox`, `textbox`.
- Sprite layers: see Cast table (outfits × `stand` pose + the listed faces).

## Localization
`en` only for this dry-run. All displayable text via `@keys`; key scheme
`s<NN>.<char>.<id>`, `s<NN>.intro`, `choice.umbrella.*`, `char.<id>.name`, `ending.<id>.title`.
