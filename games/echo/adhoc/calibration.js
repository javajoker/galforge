/* ECHO — adhoc-scene module: the Mirror Gallery "calibration terminal".
 *
 * A GVNF adhoc scene (GalForge script-standard §14). The runtime hands us a
 * host context + an empty, stage-sized container; we render a fully custom,
 * terminal-styled profiling UI — our own layout, styles, and interactions, none
 * of which the GVNF command grammar (§8) models — and resolve a *result* that
 * writes the three "lean" variables back into the common game flow and takes a
 * declared exit.
 *
 * Contract (§14.2): export `mount(ctx) -> Promise<{ exit, set }>`.
 *   ctx.root      empty element to render into (owned by us until exit)
 *   ctx.params    adhoc.params from the scene file (our probe data)
 *   ctx.vars      read-only snapshot of game variables
 *   ctx.t(key)    i18n resolver ("@key" or "key")
 *   ctx.signal    AbortSignal — fired if the scene is torn down (load/restart)
 *
 * Result (§14.4): { exit: "<declared-exit-id>", set?: { var: value, … } }.
 *   exit "done" → return to the caller (s04);  exit "skip" → jump to the decision.
 */

export function mount(ctx) {
  const { root, params, vars, t, signal } = ctx;
  const probes = (params && params.probes) || [];
  const weight = (params && params.weight) || 1;
  const tally = { order: 0, chaos: 0, shelter: 0 };

  return new Promise((resolve) => {
    let settled = false;
    const cleanups = [];
    const finish = (result) => {
      if (settled) return;
      settled = true;
      cleanups.forEach((fn) => fn());
      resolve(result);
    };

    // Honour teardown: if the player loads/restarts mid-scene, stop cleanly and
    // let the engine apply the declared fallback (§14.5).
    if (signal) {
      if (signal.aborted) return finish(null);
      const onAbort = () => finish(null);
      signal.addEventListener("abort", onAbort);
      cleanups.push(() => signal.removeEventListener("abort", onAbort));
    }

    // ---- shell (confined to root, scoped under .echo-cal) ----
    root.classList.add("echo-cal");
    const panel = el("div", "echo-cal-panel");
    root.appendChild(panel);

    const head = el("div", "echo-cal-head");
    head.appendChild(el("span", "echo-cal-dot"));
    const title = el("span", "echo-cal-title");
    title.textContent = t("@s04cal.title");
    head.appendChild(title);
    panel.appendChild(head);

    const intro = el("div", "echo-cal-intro");
    intro.textContent = t("@s04cal.intro");
    panel.appendChild(intro);

    const baseline = el("div", "echo-cal-base");
    baseline.textContent = `◇ O:${num(vars.order_lean)}  C:${num(vars.chaos_lean)}  S:${num(vars.shelter_lean)}`;
    panel.appendChild(baseline);

    const body = el("div", "echo-cal-body");
    panel.appendChild(body);

    const refuse = el("button", "echo-cal-refuse");
    refuse.type = "button";
    refuse.textContent = t("@s04cal.refuse");
    refuse.onclick = () => finish({ exit: "skip" });
    panel.appendChild(refuse);

    // ---- probe flow ----
    let idx = 0;

    function renderProbe() {
      body.className = "echo-cal-body";
      body.replaceChildren();
      const p = probes[idx];
      const prog = el("div", "echo-cal-prog");
      prog.textContent = `${t("@s04cal.probe")} ${idx + 1} / ${probes.length}`;
      body.appendChild(prog);
      const q = el("div", "echo-cal-q");
      q.textContent = t(p.q);
      body.appendChild(q);
      const opts = el("div", "echo-cal-opts");
      (p.a || []).forEach((a) => {
        const b = el("button", "echo-cal-opt");
        b.type = "button";
        b.textContent = t(a.t);
        b.onclick = () => {
          if (a.lean && a.lean in tally) tally[a.lean] += weight;
          idx += 1;
          if (idx >= probes.length) renderReading();
          else renderProbe();
        };
        opts.appendChild(b);
      });
      body.appendChild(opts);
    }

    function dominant() {
      const order = ["order", "chaos", "shelter"].sort((a, b) => tally[b] - tally[a]);
      if (tally[order[0]] === 0) return "tie";
      if (tally[order[0]] === tally[order[1]]) return "tie";
      return order[0];
    }

    function renderReading() {
      body.className = "echo-cal-body reading";
      body.replaceChildren();
      const dom = dominant();
      const read = el("div", "echo-cal-read");
      read.textContent = t("@s04cal.reading." + dom);
      body.appendChild(read);

      const bars = el("div", "echo-cal-bars");
      const max = Math.max(1, probes.length);
      ["order", "chaos", "shelter"].forEach((k) => {
        const row = el("div", "echo-cal-bar");
        const fill = el("span", "fill");
        fill.dataset.lean = k;
        fill.style.width = Math.round((tally[k] / max) * 100) + "%";
        row.appendChild(fill);
        bars.appendChild(row);
      });
      body.appendChild(bars);

      const ack = el("button", "echo-cal-ack");
      ack.type = "button";
      ack.textContent = t("@s04cal.ack");
      ack.onclick = () =>
        finish({
          exit: "done",
          set: {
            order_lean: "+" + tally.order,
            chaos_lean: "+" + tally.chaos,
            shelter_lean: "+" + tally.shelter,
            saw_truth: true,
          },
        });
      body.appendChild(ack);
    }

    if (probes.length) renderProbe();
    else renderReading();
  });
}

export default mount;

// ---- tiny DOM helpers ----
function el(tag, cls) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  return node;
}
function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
