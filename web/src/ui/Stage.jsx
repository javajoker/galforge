import BackgroundView from "./zones/BackgroundView.jsx";
import SpriteView from "./zones/SpriteView.jsx";

/* The visual stage = the background view + the sprite view, composed inside
 * `.gf-scene`. Dialogue and interaction are drawn by the Player as sibling zones
 * on top, so a layout can resize `.gf-scene` (e.g. the dock layouts confine it to
 * one side) without touching the backdrop or sprites.
 *
 * Portrait rule (§task 2): SpriteView collapses to a single, larger character so
 * vertical screens stay readable; landscape keeps the two-character stage. */
export default function Stage({ view, portrait }) {
  return (
    <div className="gf-scene">
      <BackgroundView view={view} />
      <SpriteView sprites={view.sprites} portrait={portrait} />
    </div>
  );
}
