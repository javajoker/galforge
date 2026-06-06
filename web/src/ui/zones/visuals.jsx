import { useEffect, useRef, useState } from "react";

/* Shared no-art placeholder helpers + a fading <img>, used by the background and
 * sprite zones. In "no-art mode" (demo games ship no binaries) a deterministic
 * gradient/emoji stands in for each asset; a real bitmap fades in over it once
 * loaded. */

export const FACE_EMOJI = {
  neutral: "🙂", smile: "😊", grin: "😁", laugh: "😄", blush: "😳", shy: "☺️",
  sad: "🙁", cry: "😢", angry: "😠", pout: "😤", surprised: "😲", shocked: "😧",
  thinking: "🤔", smug: "😏", sleepy: "😴", determined: "😤",
};
export const emoji = (f) => FACE_EMOJI[f] || "🙂";

export function hashHue(s) {
  let h = 0;
  for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

export const phGradient = (id) =>
  `linear-gradient(135deg,hsl(${hashHue(id)} 45% 28%),hsl(${(hashHue(id) + 40) % 360} 40% 16%))`;

/* A cross-fading <img>.
 *
 * When `src` changes we must NOT blink: the old version of the original FadeImg
 * reset the image to opacity 0 and re-faded it on every src change, which on a
 * character switch (or expression swap) briefly dropped the sprite to transparent
 * and revealed the placeholder behind it — the "flash". Instead we *pre-decode*
 * the new image off-screen and only swap it in once it's ready, keeping the old
 * frame visible underneath until the new one fades over it. The displayed image
 * therefore never dips to transparent (except its very first appearance), so a
 * character/expression change cross-fades smoothly with no flash.
 *
 * Renders nothing until something has loaded, so a missing/invalid bitmap lets
 * the placeholder show through (no-art mode), exactly as before. */
export function FadeImg({ src, className }) {
  const [cur, setCur] = useState(null); // shown (decoded) src — fades in on top
  const [prev, setPrev] = useState(null); // outgoing src, held under during xfade
  const curRef = useRef(null);
  useEffect(() => {
    curRef.current = cur;
  }, [cur]);

  useEffect(() => {
    if (!src) {
      setCur(null);
      setPrev(null);
      return undefined;
    }
    if (src === curRef.current) return undefined;
    let alive = true;
    const apply = () => {
      if (!alive || src === curRef.current) return;
      setPrev(curRef.current); // keep the old frame visible beneath the new one
      setCur(src);
    };
    const img = new Image();
    img.onload = apply;
    img.onerror = () => {}; // invalid bitmap → keep whatever we had (placeholder if none)
    img.src = src;
    if (img.complete && img.naturalWidth) apply(); // already cached/decoded
    return () => {
      alive = false;
    };
  }, [src]);

  // drop the outgoing layer once the cross-fade is done
  useEffect(() => {
    if (prev == null) return undefined;
    const t = setTimeout(() => setPrev(null), 340);
    return () => clearTimeout(t);
  }, [prev]);

  if (!cur) return null;
  return (
    <>
      {prev && prev !== cur ? <img className={className + " loaded"} src={prev} alt="" /> : null}
      {/* keyed by src so each swap is a fresh element → its gf-fade entrance replays */}
      <img key={cur} className={className + " loaded"} src={cur} alt="" style={{ animation: "gf-fade 0.3s ease" }} />
    </>
  );
}
