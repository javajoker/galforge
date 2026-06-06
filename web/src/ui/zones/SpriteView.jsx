import { FadeImg, emoji, hashHue } from "./visuals.jsx";

/* Zone 2 — the sprite view (the two-character stage, §6).
 *
 * Renders the visible characters with alternating emphasis (active speaker at
 * full brightness, the other dimmed). On a portrait screen we never show two
 * sprites side-by-side — only the active speaker is drawn — so phones stay clean.
 * Layouts may scale/shift this zone via CSS but the markup is the same.
 *
 * Slots are keyed by *position* (left/center/right), rendered in a fixed order,
 * NOT by character. The alternating-display model (§6.3) evicts and re-adds
 * characters and can reorder the visible array, so keying by character made React
 * unmount/remount sprite elements — replaying the `gf-fade` entrance and flashing
 * a character that is actually *staying on stage*. Keying by slot makes each slot
 * a stable container whose occupant can change in place: a character that keeps
 * its slot is never disturbed, and only a slot that truly changes occupant updates
 * (its body/face cross-fades via FadeImg; a fresh entrance still dissolves in). */
const SLOT_ORDER = ["left", "center", "right"];

function Sprite({ s }) {
  const color = s.color || `hsl(${hashHue(s.char)} 40% 35%)`;
  return (
    <div className={`gf-slot ${s.slot}${s.dim ? " dim" : ""}${s.active ? " active" : ""}`} data-char={s.char}>
      <div className="gf-sprite">
        <div className="gf-ph" style={{ "--c": color }}>
          <span className="em">{emoji(s.face)}</span>
          <span className="nm">{s.name}</span>
          <span className="st">
            {s.outfit} · {s.face}
          </span>
        </div>
        <FadeImg src={s.body} className="body" />
        <FadeImg src={s.faceImg} className="face" />
      </div>
    </div>
  );
}

export default function SpriteView({ sprites, portrait }) {
  let list = sprites || [];
  if (portrait && list.length > 1) {
    const act = list.find((s) => s.active) || list[list.length - 1];
    list = act ? [{ ...act, dim: false }] : [];
  }
  const bySlot = new Map(list.map((s) => [s.slot, s]));
  return (
    <div className={`gf-sprites${portrait ? " portrait" : ""}`}>
      {SLOT_ORDER.filter((slot) => bySlot.has(slot)).map((slot) => (
        <Sprite key={slot} s={bySlot.get(slot)} />
      ))}
    </div>
  );
}
