import Adhoc from "../Adhoc.jsx";

/* Zone 4 — the interaction component (choices + adhoc scenes).
 *
 * One zone hosts every interactive beat the player can act on: branch `choice`
 * menus and `adhoc` developer modules (§14). It is *expandable*: `mode` is the
 * layout's default presentation —
 *
 *   - "overlay" → floats centered over the whole stage (ADV / NVL / cinematic)
 *   - "dock"    → sits inside the side panel next to the dialogue (dock layouts)
 *
 * and the engineer can flip between docked and full-stage at runtime with the
 * expand toggle. A *fullscreen* adhoc scene (§14) is an immersive takeover that
 * portals to <body>; it ignores layout/dock chrome entirely. */

function Choices({ view, onChoose }) {
  return (
    <div className="gf-choices">
      {view.prompt ? <div className="gf-choice-prompt">{view.prompt}</div> : null}
      <div className="gf-choice-list">
        {view.choices.map((c) => (
          <button key={c.pos} className="gf-choice" disabled={c.enabled === false} onClick={() => onChoose(c.pos)}>
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function InteractionView({ view, engine, mode, expanded, onToggleExpand }) {
  const status = view.status;
  if (status !== "choice" && status !== "adhoc") return null;

  const isAdhoc = status === "adhoc";
  // A fullscreen adhoc scene owns the whole viewport via its own <body> portal;
  // no dock/expand affordance applies.
  if (isAdhoc && view.adhoc && view.adhoc.fullscreen) {
    return <Adhoc view={view} engine={engine} />;
  }

  const cls =
    `gf-interaction gf-ui-block ${mode} ${expanded ? "expanded" : "collapsed"} ` +
    (isAdhoc ? "adhoc-host" : "choices-host");

  return (
    <div className={cls} data-mode={mode}>
      <button
        className="gf-int-toggle"
        onClick={onToggleExpand}
        title={expanded ? "Dock interaction" : "Expand interaction"}
        aria-label={expanded ? "Dock interaction" : "Expand interaction"}
      >
        {expanded ? "⤡" : "⤢"}
      </button>
      <div className="gf-int-body">
        {isAdhoc ? (
          <Adhoc view={view} engine={engine} />
        ) : (
          <Choices view={view} onChoose={(p) => engine.choose(p)} />
        )}
      </div>
    </div>
  );
}
