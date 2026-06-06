/* App configuration.
 *
 * Games are bundled into web/public/content/<id>/ at build time (see
 * scripts/sync-content.mjs) and selected by ROUTE (#/play/<id>), never by
 * query string — so the built /dist is a self-contained static site that can
 * be dropped at any URL and deep-linked.
 */
export const CONFIG = {
  appTitle: "GalForge Player",

  // null  → show the game-select menu at "/".
  // "<id>" → boot straight into that one game (single-title static publish).
  //          e.g. defaultGame: "umbrella-share"
  defaultGame: null,

  // Default stage layout when a game doesn't declare its own `ui.layout`.
  // null → fall back to the built-in default ("adv"). One of the ids in
  // src/ui/layouts.js: "adv" | "nvl" | "dock-right" | "dock-left" | "cinematic".
  // An engineer can still switch live from the player's Layout control.
  layout: null,
};

function baseURL() {
  // Vite injects BASE_URL from vite.config `base`. "./" keeps it path-relative
  // so the bundle works at any deploy sub-path.
  return (import.meta.env.BASE_URL || "./").replace(/\/?$/, "/");
}

export function contentBase(id) {
  return `${baseURL()}content/${id}`;
}
export function contentIndexURL() {
  return `${baseURL()}content/index.json`;
}
