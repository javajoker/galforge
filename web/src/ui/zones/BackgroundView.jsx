import { FadeImg, phGradient } from "./visuals.jsx";

/* Zone 1 — the stage background view.
 *
 * Draws the scene backdrop and the two full-frame overlays that sit on it: a CG
 * (event illustration) and an item close-up. Layout-agnostic: it always fills
 * its container (`.gf-scene`), and layouts decide how big that container is. */

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

export default function BackgroundView({ view }) {
  return (
    <>
      <div className="gf-bg">{view.bg ? <Bg bg={view.bg} /> : <div className="layer base show" />}</div>
      {view.cg ? <Cg cg={view.cg} /> : null}
      {view.closeup ? <Closeup c={view.closeup} /> : null}
    </>
  );
}
