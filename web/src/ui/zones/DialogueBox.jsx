/* Zone 3 — the conversation dialogue box.
 *
 * Nameplate (tinted with the speaker's colour) + the typewriter line + an
 * advance caret. Position is entirely layout-driven (bottom bar in ADV, a large
 * reading panel in NVL, a side column in the dock layouts) — see styles.css
 * `[data-layout=…] .gf-dialogue`. This component just renders the content. */
export default function DialogueBox({ view, shown, typing }) {
  const sp = view.speaker;
  return (
    <div className="gf-dialogue" style={sp ? { "--nc": sp.color || "#cfcfd6" } : undefined}>
      {sp ? <div className="gf-name">{sp.name}</div> : null}
      <div className="gf-text">{shown}</div>
      {!typing ? <div className="gf-advance">▾</div> : null}
    </div>
  );
}
