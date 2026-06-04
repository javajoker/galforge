import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useEngine, useOrientation, useTypewriter, useAudio } from "../hooks.js";
import Stage from "./Stage.jsx";

/* ----------------------------------------------------------------- Dialogue */
function Dialogue({ view, shown, typing }) {
  const sp = view.speaker;
  return (
    <div className="gf-dialogue" style={sp ? { "--nc": sp.color || "#cfcfd6" } : undefined}>
      {sp ? <div className="gf-name">{sp.name}</div> : null}
      <div className="gf-text">{shown}</div>
      {!typing ? <div className="gf-advance">▾</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ Choices */
function Choices({ view, onChoose }) {
  return (
    <div className="gf-choices gf-ui-block">
      {view.prompt ? <div className="gf-choice-prompt">{view.prompt}</div> : null}
      {view.choices.map((c) => (
        <button key={c.pos} className="gf-choice" disabled={c.enabled === false} onClick={() => onChoose(c.pos)}>
          {c.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ Ending */
function Ending({ view, onRestart }) {
  return (
    <div className="gf-ending gf-ui-block">
      <div className="gf-ending-card">
        <div className="gf-ending-kicker">END</div>
        <div className="gf-ending-title">{view.ending.title}</div>
        <div className="gf-ending-actions">
          <button onClick={onRestart}>Play again</button>
          <Link className="gf-btn-link" to="/">
            Game list
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Backlog */
function Backlog({ view, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, []);
  return (
    <div className="gf-panel gf-ui-block">
      <div className="gf-panel-head">
        <span>History</span>
        <button onClick={onClose}>✕</button>
      </div>
      <div className="gf-backlog-list" ref={ref}>
        {(view.backlog || []).slice(-200).map((b, i) => (
          <div className="gf-backlog-row" key={i}>
            <div className="who">{b.who}</div>
            <div className="ln">{b.line}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- SaveLoad */
function SaveLoad({ engine, mode, onClose, onLoaded }) {
  const [slots, setSlots] = useState(() => engine.listSaves());
  const refresh = () => setSlots(engine.listSaves());
  const click = (slot, data) => {
    if (mode === "save") {
      engine.save(slot);
      refresh();
    } else if (data) {
      engine.load(slot);
      onLoaded();
    }
  };
  return (
    <div className="gf-panel gf-ui-block">
      <div className="gf-panel-head">
        <span>{mode === "save" ? "Save" : "Load"}</span>
        <button onClick={onClose}>✕</button>
      </div>
      <div className="gf-saves-list">
        {slots.map(({ slot, data }) => (
          <button key={slot} className="gf-save-slot" onClick={() => click(slot, data)} disabled={mode === "load" && !data}>
            <span className="slot">Slot {slot}</span>
            <span className="meta">
              {data ? `${(data.pc && data.pc.scene) || data.scene} · ${new Date(data.savedAt).toLocaleString()}` : "— empty —"}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- Controls */
function Controls({ view, engine, auto, skip, onAuto, onSkip, onPanel }) {
  return (
    <div className="gf-controls gf-ui-block">
      <Link className="gf-ctl" to="/" title="Game list">
        ☰
      </Link>
      <button className={`gf-ctl${auto ? " active" : ""}`} onClick={onAuto} title="Auto (A)">
        Auto
      </button>
      <button className={`gf-ctl${skip ? " active" : ""}`} onClick={onSkip} title="Skip">
        Skip
      </button>
      <button className="gf-ctl" onClick={() => onPanel("backlog")} title="History">
        Log
      </button>
      <button className="gf-ctl" onClick={() => onPanel("save")} title="Save">
        Save
      </button>
      <button className="gf-ctl" onClick={() => onPanel("load")} title="Load">
        Load
      </button>
      {view.locales && view.locales.length > 1 ? (
        <select className="gf-lang" value={view.locale} onChange={(e) => engine.setLocale(e.target.value)} title="Language">
          {view.locales.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}

/* ======================================================================= */
export default function Player() {
  const { gameId } = useParams();
  const { view, error, engine } = useEngine(gameId);
  const portrait = useOrientation();
  useAudio(view);

  const [panel, setPanel] = useState(null); // 'backlog' | 'save' | 'load'
  const [auto, setAuto] = useState(false);
  const [skip, setSkip] = useState(false);
  const [shakeN, setShakeN] = useState(0);
  const [flash, setFlash] = useState(null);
  const stageRef = useRef(null);
  const lastVisFx = useRef(0);

  const isLine = view && view.status === "line";
  const { shown, typing, finish } = useTypewriter(isLine ? view.text : "", view && view.lineId, 18, skip);

  // visual one-shot effects (shake / flash)
  useEffect(() => {
    if (!view) return;
    for (const f of view.fx || []) {
      if (f.id <= lastVisFx.current) continue;
      lastVisFx.current = f.id;
      if (f.type === "shake") setShakeN((n) => n + 1);
      else if (f.type === "flash") setFlash({ color: f.color, dur: f.dur, key: f.id });
    }
  }, [view]);
  useEffect(() => {
    if (!shakeN || !stageRef.current) return;
    const el = stageRef.current;
    el.classList.remove("shake");
    void el.offsetWidth; // reflow → restart animation
    el.classList.add("shake");
    const t = setTimeout(() => el.classList.remove("shake"), 460);
    return () => clearTimeout(t);
  }, [shakeN]);

  const advance = useCallback(() => {
    if (panel || !view || !engine) return;
    if (view.status === "line" || view.status === "tap" || view.status === "wait") {
      if (typing) {
        finish();
        return;
      }
      engine.advance();
    }
  }, [panel, view, engine, typing, finish]);

  // keyboard
  useEffect(() => {
    const onKey = (e) => {
      if (e.code === "Escape") {
        setPanel(null);
        return;
      }
      if (panel) return;
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        advance();
      } else if (e.code === "KeyA") {
        setAuto((a) => !a);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advance, panel]);

  // auto / skip
  useEffect(() => {
    if (!view || !engine || panel) return;
    if (view.status !== "line") return;
    if (skip) {
      const t = setTimeout(() => engine.advance(), 45);
      return () => clearTimeout(t);
    }
    if (auto && !typing) {
      const delay = (engine.game && engine.game.text && engine.game.text.autoDelayMs) || 1200;
      const t = setTimeout(() => engine.advance(), delay);
      return () => clearTimeout(t);
    }
  }, [view, engine, auto, skip, typing, panel]);

  // auto-advance through timed `wait <ms>` beats (e.g. a momentary close-up)
  useEffect(() => {
    if (!view || !engine || panel) return;
    if (view.status !== "wait") return;
    const ms = skip ? 20 : view.waitMs || 0;
    const t = setTimeout(() => engine.advance(), ms);
    return () => clearTimeout(t);
  }, [view, engine, panel, skip]);

  if (error) {
    return (
      <div className="gf-boot err">
        <div className="gf-boot-card">
          <h2>Couldn’t load “{gameId}”.</h2>
          <pre>{error}</pre>
          <Link className="gf-btn-link" to="/">
            ← Game list
          </Link>
        </div>
      </div>
    );
  }
  if (!view) {
    return (
      <div className="gf-boot">
        <div className="gf-boot-card">Loading…</div>
      </div>
    );
  }

  const onStageClick = (e) => {
    if (e.target.closest(".gf-ui-block")) return;
    advance();
  };

  return (
    <div className={`gf-stage${portrait ? " portrait" : ""}`}>
      <div className="gf-frame" ref={stageRef} onClick={onStageClick}>
        <Stage view={view} portrait={portrait} />

        {view.status === "choice" ? (
          <Choices view={view} onChoose={(p) => engine.choose(p)} />
        ) : view.status === "line" ? (
          <Dialogue view={view} shown={shown} typing={typing} />
        ) : null}

        <Controls
          view={view}
          engine={engine}
          auto={auto}
          skip={skip}
          onAuto={() => setAuto((a) => !a)}
          onSkip={() => {
            setSkip((s) => !s);
            finish();
          }}
          onPanel={(p) => setPanel(p)}
        />

        {view.audio && view.audio.bgm ? <div className="gf-bgm-hud">♪ {view.audio.bgm}</div> : null}

        {view.status === "ended" ? <Ending view={view} onRestart={() => engine.restart()} /> : null}

        {panel === "backlog" ? <Backlog view={view} onClose={() => setPanel(null)} /> : null}
        {panel === "save" || panel === "load" ? (
          <SaveLoad engine={engine} mode={panel} onClose={() => setPanel(null)} onLoaded={() => setPanel(null)} />
        ) : null}

        {flash ? (
          <div
            className="gf-flash"
            key={flash.key}
            style={{ background: flash.color, "--t": flash.dur + "ms" }}
            onAnimationEnd={() => setFlash(null)}
          />
        ) : null}
      </div>
    </div>
  );
}
