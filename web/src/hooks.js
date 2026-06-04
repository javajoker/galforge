import { useEffect, useRef, useState } from "react";
import { Engine } from "./engine/engine.js";
import { contentBase } from "./config.js";

/* Boot a GVNF Engine for a game id and subscribe to its view model. */
export function useEngine(gameId) {
  const [view, setView] = useState(null);
  const [error, setError] = useState(null);
  const engineRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setView(null);
    setError(null);
    const eng = new Engine(contentBase(gameId));
    engineRef.current = eng;
    if (import.meta.env.DEV) window.__gf = eng; // dev-only debug handle
    const unsub = eng.subscribe((v) => {
      if (!cancelled) setView(v);
    });
    eng.boot().catch((e) => {
      if (!cancelled) setError(e && e.message ? e.message : String(e));
    });
    return () => {
      cancelled = true;
      unsub();
      engineRef.current = null;
    };
  }, [gameId]);

  return { view, error, engine: engineRef.current };
}

/* True when the viewport is taller than it is wide ("vertical screen").
 * Drives the single-character portrait stage.
 *
 * Uses matchMedia + resize/orientationchange + a ResizeObserver on the root
 * element so it reacts to every way a viewport can change (rotation, window
 * resize, and emulated device-metrics overrides). */
export function useOrientation() {
  const get = () =>
    typeof window !== "undefined" &&
    (window.matchMedia("(orientation: portrait)").matches || window.innerHeight > window.innerWidth);
  const [portrait, setPortrait] = useState(get);
  useEffect(() => {
    const on = () => setPortrait(get());
    const mq = window.matchMedia("(orientation: portrait)");
    if (mq.addEventListener) mq.addEventListener("change", on);
    else mq.addListener(on);
    window.addEventListener("resize", on);
    window.addEventListener("orientationchange", on);
    let ro;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(on);
      ro.observe(document.documentElement);
    }
    on(); // sync once after mount in case the viewport changed pre-effect
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", on);
      else mq.removeListener(on);
      window.removeEventListener("resize", on);
      window.removeEventListener("orientationchange", on);
      if (ro) ro.disconnect();
    };
  }, []);
  return portrait;
}

/* Typewriter reveal for a dialogue line. Re-types whenever lineId changes;
 * `instant` (skip mode) reveals immediately. */
export function useTypewriter(text, lineId, speed, instant) {
  const [shown, setShown] = useState("");
  const [typing, setTyping] = useState(false);
  const timer = useRef(null);
  const full = useRef("");

  useEffect(() => {
    full.current = text || "";
    clearInterval(timer.current);
    if (text == null || text === "") {
      setShown("");
      setTyping(false);
      return;
    }
    if (instant) {
      setShown(text);
      setTyping(false);
      return;
    }
    setShown("");
    setTyping(true);
    let i = 0;
    timer.current = setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(timer.current);
        setTyping(false);
      }
    }, speed || 18);
    return () => clearInterval(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineId]);

  const finish = () => {
    clearInterval(timer.current);
    setShown(full.current);
    setTyping(false);
  };
  return { shown, typing, finish };
}

/* Process the engine's one-shot audio effects + manage the looping BGM. */
export function useAudio(view) {
  const bgm = useRef(null);
  const voice = useRef(null);
  const curBgm = useRef(null);
  const lastFx = useRef(0);

  useEffect(() => {
    if (!view) return;
    const want = (view.audio && view.audio.bgm) || null;
    if (want !== curBgm.current) {
      if (bgm.current) {
        try { bgm.current.pause(); } catch { /* ignore */ }
        bgm.current = null;
      }
      curBgm.current = want;
      if (want && view.audio.bgmSrc) {
        const a = new Audio(view.audio.bgmSrc);
        a.loop = true;
        a.volume = view.audio.volume != null ? view.audio.volume : 0.8;
        a.play().catch(() => {});
        bgm.current = a;
      }
    }
    for (const f of view.fx || []) {
      if (f.id <= lastFx.current) continue;
      lastFx.current = f.id;
      if (f.type === "se" && f.src) {
        const a = new Audio(f.src);
        a.volume = f.volume != null ? f.volume : 0.9;
        a.play().catch(() => {});
      } else if (f.type === "voice") {
        if (voice.current) { try { voice.current.pause(); } catch { /* ignore */ } voice.current = null; }
        if (f.src) {
          const a = new Audio(f.src);
          a.volume = f.volume != null ? f.volume : 1;
          a.play().catch(() => {});
          voice.current = a;
        }
      } else if (f.type === "stopVoice") {
        if (voice.current) { try { voice.current.pause(); } catch { /* ignore */ } voice.current = null; }
      }
    }
  }, [view]);

  useEffect(
    () => () => {
      if (bgm.current) { try { bgm.current.pause(); } catch { /* ignore */ } }
      if (voice.current) { try { voice.current.pause(); } catch { /* ignore */ } }
    },
    []
  );
}
