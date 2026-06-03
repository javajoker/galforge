import { useEffect, useState } from "react";

/* ---- placeholder helpers (no-art mode) ---- */
const FACE_EMOJI = {
  neutral: "🙂", smile: "😊", grin: "😁", laugh: "😄", blush: "😳", shy: "☺️",
  sad: "🙁", cry: "😢", angry: "😠", pout: "😤", surprised: "😲", shocked: "😧",
  thinking: "🤔", smug: "😏", sleepy: "😴", determined: "😤",
};
const emoji = (f) => FACE_EMOJI[f] || "🙂";
function hashHue(s) {
  let h = 0;
  for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}
const phGradient = (id) =>
  `linear-gradient(135deg,hsl(${hashHue(id)} 45% 28%),hsl(${(hashHue(id) + 40) % 360} 40% 16%))`;

/* An <img> that fades in once loaded; renders nothing if src is missing,
 * letting the placeholder behind it show through (no-art mode). */
function FadeImg({ src, className }) {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    setOk(false);
  }, [src]);
  if (!src) return null;
  return (
    <img
      className={className + (ok ? " loaded" : "")}
      src={src}
      alt=""
      onLoad={() => setOk(true)}
      onError={() => setOk(false)}
    />
  );
}

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

function Bg({ bg }) {
  const dur = (bg.transition && bg.transition.duration != null ? bg.transition.duration : 500) + "ms";
  return (
    <div className="layer show" key={bg.id} style={{ "--t": dur, background: phGradient(bg.id) }}>
      <FadeImg src={bg.src} className="bg-img" />
      <div className="gf-ph-label">bg: {bg.id}</div>
    </div>
  );
}

function Cg({ cg }) {
  const dur = (cg.transition && cg.transition.duration != null ? cg.transition.duration : 500) + "ms";
  return (
    <div className="gf-cg on" key={cg.id} style={{ "--t": dur, background: phGradient(cg.id) }}>
      <FadeImg src={cg.src} className="cg-img" />
      <div className="gf-ph-label">cg: {cg.id}</div>
    </div>
  );
}

function Closeup({ c }) {
  const dur = (c.transition && c.transition.duration != null ? c.transition.duration : 400) + "ms";
  return (
    <div className="gf-closeup on" style={{ "--t": dur, "--dim": c.dim }}>
      <div className="gf-closeup-img" style={{ "--zoom": c.zoom, background: phGradient(c.id) }}>
        <FadeImg src={c.src} className="item-img" />
        <div className="gf-ph-label">{c.id}</div>
      </div>
      {c.caption ? <div className="gf-closeup-cap">{c.caption}</div> : null}
    </div>
  );
}

/* The visual stage: background, sprites, CG, close-up.
 *
 * Responsive rule (§ task 2): on a vertical screen we never show two sprites
 * side-by-side — only the active speaker is drawn, on its own side (left/right),
 * so portrait phones stay clean and readable. Landscape keeps the two-character
 * stage with alternating emphasis.
 */
export default function Stage({ view, portrait }) {
  let sprites = view.sprites || [];
  if (portrait && sprites.length > 1) {
    const act = sprites.find((s) => s.active) || sprites[sprites.length - 1];
    sprites = act ? [{ ...act, dim: false }] : [];
  }
  return (
    <div className="gf-scene">
      <div className="gf-bg">{view.bg ? <Bg bg={view.bg} /> : <div className="layer base show" />}</div>
      <div className={`gf-sprites${portrait ? " portrait" : ""}`}>
        {sprites.map((s) => (
          <Sprite key={s.char} s={s} />
        ))}
      </div>
      {view.cg ? <Cg cg={view.cg} /> : null}
      {view.closeup ? <Closeup c={view.closeup} /> : null}
    </div>
  );
}
