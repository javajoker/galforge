import { useCallback, useEffect, useState } from "react";
import { CONFIG } from "../config.js";

/* GalForge stage layouts.
 *
 * A *layout* is a named arrangement of the four stage zones the player draws on
 * top of each other:
 *
 *   1. background view  (.gf-scene → BackgroundView)   bg / cg / close-up
 *   2. sprite view      (.gf-scene → SpriteView)       the two-character stage
 *   3. dialogue box     (DialogueBox)                  nameplate + line text
 *   4. interaction      (InteractionView)              choices + adhoc scenes
 *
 * The zones are layout-agnostic React components; a layout only decides *where*
 * the dialogue + interaction zones sit (and how much room the scene gets). It is
 * applied purely as a `data-layout` attribute on the stage root, so all the
 * positioning lives in CSS (`[data-layout=…]` rules) and a layout can be swapped
 * live with no re-mount.
 *
 * Two sources of layouts:
 *   - the BUILT-IN presets below, styled in styles.css.
 *   - DEVELOPER (adhoc) layouts a game registers in game.json `ui.layouts`,
 *     each pointing at its own stylesheet the runtime injects. This lets a game
 *     developer design their own stage layout — targeting the same zone classes,
 *     scoped under `.gf-stage[data-layout="<their-id>"]` — without forking the
 *     player. See useCustomLayoutStyles + web/README.
 *
 * `interaction` is the layout's default interaction-zone mode:
 *   - "overlay" → choices/adhoc float centered over the whole stage
 *   - "dock"    → they live inside the side dock alongside the dialogue
 * An engineer can still expand/collapse the interaction zone at runtime.
 */
export const LAYOUTS = [
  {
    id: "adv",
    name: "ADV — Bottom bar",
    short: "ADV",
    desc: "Classic adventure layout: a dialogue bar across the bottom, the two-character stage above it.",
    interaction: "overlay",
  },
  {
    id: "nvl",
    name: "NVL — Novel panel",
    short: "NVL",
    desc: "Text fills a large translucent reading panel over dimmed sprites — for narration-heavy scenes.",
    interaction: "overlay",
  },
  {
    id: "dock-right",
    name: "Dock — Right panel",
    short: "Dock R",
    desc: "Dialogue and interactions dock to a right-hand panel; the stage fills the remaining space.",
    interaction: "dock",
  },
  {
    id: "dock-left",
    name: "Dock — Left panel",
    short: "Dock L",
    desc: "Same as the right dock, mirrored to the left.",
    interaction: "dock",
  },
  {
    id: "cinematic",
    name: "Cinematic",
    short: "Cine",
    desc: "Letterboxed 2.4:1 frame with larger sprites and a minimal, inset subtitle line.",
    interaction: "overlay",
  },
];

export const DEFAULT_LAYOUT = "adv";

const BY_ID = new Map(LAYOUTS.map((l) => [l.id, l]));

function shorten(name) {
  return name.length > 9 ? name.slice(0, 9) : name;
}

/* The developer (adhoc) layouts the current game registered, normalized.
 * Built-in ids are reserved, so a colliding custom id is ignored. */
export function customLayoutsFromView(view) {
  const defs = (view && view.ui && view.ui.layouts) || [];
  const out = [];
  for (const d of defs) {
    if (!d || typeof d.id !== "string" || BY_ID.has(d.id)) continue;
    const name = d.name || d.id;
    out.push({
      id: d.id,
      name,
      short: d.short || shorten(name),
      desc: d.desc || "Custom layout shipped with this game.",
      interaction: d.interaction === "dock" ? "dock" : "overlay",
      custom: true,
      styleHref: d.styleHref || null,
    });
  }
  return out;
}

/* Built-ins + this game's custom layouts. */
export function allLayouts(view) {
  return LAYOUTS.concat(customLayoutsFromView(view));
}

export function isLayoutId(id, view) {
  if (typeof id !== "string") return false;
  if (BY_ID.has(id)) return true;
  return customLayoutsFromView(view).some((l) => l.id === id);
}

export function getLayout(id, view) {
  return allLayouts(view).find((l) => l.id === id) || BY_ID.get(DEFAULT_LAYOUT);
}

/* The layout a game *intends*, before any engineer override:
 *   game.json `ui.layout`  →  CONFIG.layout  →  DEFAULT_LAYOUT
 * (view.ui is surfaced by the engine; see engine.buildUI). */
export function gameDefaultLayoutId(view) {
  const fromGame = view && view.ui && view.ui.layout;
  if (isLayoutId(fromGame, view)) return fromGame;
  if (isLayoutId(CONFIG.layout)) return CONFIG.layout;
  return DEFAULT_LAYOUT;
}

/* Resolve the layout to actually render. An explicit engineer override (anything
 * other than "auto", and valid for this game) wins; otherwise the game default. */
export function resolveLayoutId(view, override) {
  if (override && override !== "auto" && isLayoutId(override, view)) return override;
  return gameDefaultLayoutId(view);
}

const PREF_KEY = "galforge:layout";

/* Engineer's live layout preference, persisted across games and reloads. The
 * value is stored as-is (it may name a game-specific custom layout) — validity
 * is resolved per-view by resolveLayoutId, so a preference that doesn't apply to
 * the current game harmlessly falls back to that game's default. "auto" follows
 * whatever the game asks for. */
export function useLayoutPref() {
  const [override, setOverride] = useState(() => {
    try {
      return localStorage.getItem(PREF_KEY) || "auto";
    } catch {
      return "auto";
    }
  });
  const set = useCallback((v) => {
    const next = v || "auto";
    setOverride(next);
    try {
      localStorage.setItem(PREF_KEY, next);
    } catch {
      /* storage disabled — preference is in-memory only */
    }
  }, []);
  // react to changes from other tabs/windows so a preview stays in sync
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === PREF_KEY) setOverride(e.newValue || "auto");
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return [override, set];
}

/* Inject a <link> for every custom-layout stylesheet this game declares, once,
 * for the player's lifetime. They are scoped by `[data-layout="<id>"]`, so the
 * inactive ones are inert; keeping them all loaded means switching to a custom
 * layout is instant and flash-free, exactly like the built-ins. */
export function useCustomLayoutStyles(view) {
  const customs = customLayoutsFromView(view).filter((l) => l.styleHref);
  const key = customs.map((l) => `${l.id}=${l.styleHref}`).join("|");
  useEffect(() => {
    if (!key) return undefined;
    const els = customs.map((l) => {
      const el = document.createElement("link");
      el.rel = "stylesheet";
      el.href = l.styleHref;
      el.dataset.gfLayoutStyle = l.id;
      document.head.appendChild(el);
      return el;
    });
    return () => els.forEach((el) => el.remove());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
