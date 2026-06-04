import { useEffect, useRef } from "react";

/* Renders a GVNF adhoc scene (script-standard §14).
 *
 * An adhoc scene hands presentation to a developer-supplied ES module. We
 * dynamically import that module, give it a host context + an empty container,
 * and report whatever it resolves back to the engine — which writes the result's
 * variables and takes the chosen declared exit. If the module fails to load or
 * throws, we report `null` and the engine applies the scene's declared fallback
 * (§14.5), so the game stays completable.
 *
 * Re-runs whenever a new adhoc scene starts (keyed on view.adhoc.key). On
 * teardown (load/restart/unmount) we abort the module's AbortSignal and clear
 * its DOM. */
export default function Adhoc({ view, engine }) {
  const ref = useRef(null);
  const a = view.adhoc;
  const key = a && a.key;

  useEffect(() => {
    if (!a || !engine) return undefined;
    let alive = true;
    const ctrl = new AbortController();
    const root = ref.current;
    let styleEl = null;

    (async () => {
      if (a.styleHref) {
        styleEl = document.createElement("link");
        styleEl.rel = "stylesheet";
        styleEl.href = a.styleHref;
        styleEl.dataset.adhoc = a.sceneId;
        document.head.appendChild(styleEl);
      }
      let result = null;
      try {
        const mod = await import(/* @vite-ignore */ a.moduleHref);
        const fn = (a.entry && mod[a.entry]) || mod.default || mod.mount;
        if (typeof fn !== "function") throw new Error(`adhoc module ${a.moduleHref} has no entry function`);
        result = await fn(engine.adhocContext(root, ctrl.signal));
      } catch (e) {
        if (import.meta.env.DEV) console.warn("[adhoc] module failed; applying fallback:", e);
        result = null;
      }
      if (alive) engine.finishAdhoc(result);
    })();

    return () => {
      alive = false;
      ctrl.abort();
      if (styleEl) styleEl.remove();
      if (root) root.replaceChildren();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return <div className="gf-adhoc gf-ui-block" ref={ref} aria-label={a && a.title ? a.title : "Interactive scene"} />;
}
