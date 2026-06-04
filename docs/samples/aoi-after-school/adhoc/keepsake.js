/* Aoi, After School — adhoc-scene module: "a moment to spare".
 *
 * A GVNF adhoc scene (GalForge script-standard §14). The runtime hands us a
 * host context + an empty, stage-sized container; we render a small custom-styled
 * card — our own layout and interactions, which the GVNF command grammar (§8)
 * does not model — and resolve a *result* that writes `aoi_affection` back into
 * the common flow and takes one of the scene's declared exits.
 *
 * Contract (§14.2): export `mount(ctx) -> Promise<{ exit, set }>`.
 *   ctx.root    empty element to render into (ours until exit)
 *   ctx.params  adhoc.params from the scene file (our option data)
 *   ctx.t(key)  i18n resolver ("@key" or "key")
 *   ctx.signal  AbortSignal — fired if the scene is torn down (load/restart)
 *
 * Result (§14.4): { exit: "stay" | "slip_away", set?: { … } }.
 */

export function mount(ctx) {
  const { root, params, t, signal } = ctx;
  const options = (params && params.options) || [];

  return new Promise((resolve) => {
    let settled = false;
    const cleanups = [];
    const finish = (result) => {
      if (settled) return;
      settled = true;
      cleanups.forEach((fn) => fn());
      resolve(result);
    };

    // Honour teardown (load / restart mid-scene): stop and let the engine apply
    // the declared fallback (§14.5).
    if (signal) {
      if (signal.aborted) return finish(null);
      const onAbort = () => finish(null);
      signal.addEventListener("abort", onAbort);
      cleanups.push(() => signal.removeEventListener("abort", onAbort));
    }

    root.classList.add("aoi-moment");
    const card = el("div", "aoi-moment-card");
    root.appendChild(card);

    const title = el("div", "aoi-moment-title");
    title.textContent = t("@s01b.title");
    card.appendChild(title);

    const intro = el("p", "aoi-moment-intro");
    intro.textContent = t("@s01b.intro");
    card.appendChild(intro);

    const list = el("div", "aoi-moment-opts");
    options.forEach((o) => {
      const b = el("button", "aoi-moment-opt");
      b.type = "button";
      b.textContent = t(o.t);
      b.onclick = () => finish({ exit: o.exit, set: o.set || undefined });
      list.appendChild(b);
    });
    card.appendChild(list);
  });
}

export default mount;

function el(tag, cls) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  return node;
}
