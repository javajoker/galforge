import { FadeImg, emoji, hashHue } from "./visuals.jsx";

/* Zone 2 — the sprite view (the two-character stage, §6).
 *
 * Renders the visible characters with alternating emphasis (active speaker at
 * full brightness, the other dimmed). On a portrait screen we never show two
 * sprites side-by-side — only the active speaker is drawn — so phones stay clean.
 * Layouts may scale/shift this zone via CSS but the markup is the same. */

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
  return (
    <div className={`gf-sprites${portrait ? " portrait" : ""}`}>
      {list.map((s) => (
        <Sprite key={s.char} s={s} />
      ))}
    </div>
  );
}
