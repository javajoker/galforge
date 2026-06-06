/* ============================================================================
 * quiz — a developer ADHOC-SCENE module, imported with `galforge-import-adhoc`.
 *
 * An adhoc scene (GVNF Script Standard §14) is a beat the §8 command grammar
 * deliberately can't model — here, a multiple-choice quiz minigame. The runtime
 * hands the module a host context + an empty container; the module renders its
 * OWN DOM/UI, then resolves a RESULT that writes back game variables and takes
 * one of the scene's DECLARED exits, rejoining the common flow.
 *
 * THE FUNCTION SPEC (docs/spec/developer-extensions.md §3.2; standard §14.2):
 *
 *   export default function mount(ctx) -> result | Promise<result>
 *
 *   ctx = {
 *     root,                       // empty element to render into; ours until exit
 *     params,                     // deep copy of the scene's adhoc.params
 *     vars,                       // read-only snapshot of game variables
 *     locale, defaultLocale,      // active / default locale codes
 *     t(key),                     // i18n resolver, accepts "@key" or "key"
 *     asset(group, id),           // manifest asset id -> URL, or null
 *     screen,                     // { width, height } reference resolution
 *     signal,                     // AbortSignal — fired on teardown; we must stop
 *   }
 *
 *   result = { exit: "<declared-exit-id>", set?: { <var>: value | "+n" | "=expr" } }
 *
 * Rules the module MUST follow: confine all DOM to `ctx.root`; assume NO GVNF UI
 * is present; honour `ctx.signal` (drop listeners/timers, stop); restrict writes
 * to the scene's declared `writes`; return a result whose `exit` is one of the
 * scene's declared exits.
 *
 * This module is GENERIC — the questions, pass mark and exit ids are all driven
 * by `adhoc.params`, so the same file works for any quiz. See the scene file
 * scenes/q_quiz.json for how it is wired.
 *   params = {
 *     questions: [ { q: "@key", options: [ { t: "@key", correct?: true }, … ] }, … ],
 *     passMark: <int>,            // correct answers needed to take the pass exit
 *     scoreVar: "<var>",          // variable to write the score into
 *     passVar:  "<var>",          // boolean variable set to (score >= passMark)
 *     passExit: "<exit-id>",      // exit taken when score >= passMark
 *     failExit: "<exit-id>"       // exit taken otherwise
 *   }
 * ============================================================================ */

export default function mount(ctx) {
  const { root, params, t, signal } = ctx;
  const questions = (params && params.questions) || [];
  const passMark = (params && params.passMark) || questions.length;
  const scoreVar = (params && params.scoreVar) || "quiz_score";
  const passVar = (params && params.passVar) || "passed";
  const passExit = (params && params.passExit) || "pass";
  const failExit = (params && params.failExit) || "fail";

  return new Promise((resolve) => {
    let settled = false;
    let i = 0;
    let score = 0;
    const cleanups = [];

    const finish = (result) => {
      if (settled) return;
      settled = true;
      cleanups.forEach((fn) => fn());
      resolve(result);
    };

    // Honour teardown (save/load/restart mid-scene): stop and let the engine
    // apply the scene's declared fallback (§14.5). Returning null is fine.
    if (signal) {
      if (signal.aborted) return finish(null);
      const onAbort = () => finish(null);
      signal.addEventListener("abort", onAbort);
      cleanups.push(() => signal.removeEventListener("abort", onAbort));
    }

    root.classList.add("gx-quiz");

    const render = () => {
      root.replaceChildren();

      if (i >= questions.length) {
        const passed = score >= passMark;
        // The RESULT: choose a declared exit by id, and write the score + flag
        // back into the flow (assignment syntax §9.2: a literal here).
        return finish({
          exit: passed ? passExit : failExit,
          set: { [scoreVar]: score, [passVar]: passed },
        });
      }

      const q = questions[i];

      const hud = el("div", "gx-quiz-hud");
      hud.textContent = `${t("@quiz.label")}  ${i + 1}/${questions.length}`;
      root.appendChild(hud);

      const card = el("div", "gx-quiz-card");
      root.appendChild(card);

      const prompt = el("p", "gx-quiz-q");
      prompt.textContent = t(q.q);
      card.appendChild(prompt);

      const list = el("div", "gx-quiz-opts");
      (q.options || []).forEach((o) => {
        const b = el("button", "gx-quiz-opt");
        b.type = "button";
        b.textContent = t(o.t);
        b.onclick = () => {
          if (o.correct) score += 1;
          i += 1;
          render();
        };
        list.appendChild(b);
      });
      card.appendChild(list);
    };

    render();
  });
}

function el(tag, cls) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  return node;
}
