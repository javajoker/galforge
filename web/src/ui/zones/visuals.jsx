import { useEffect, useState } from "react";

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

/* An <img> that fades in once loaded; renders nothing if src is missing, letting
 * the placeholder behind it show through. */
export function FadeImg({ src, className }) {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    setOk(false);
  }, [src]);
  if (!src) return null;
  return (
    <img
      className={className + (ok ? " loaded" : "")}
      src={src}
      alt=""
      onLoad={() => setOk(true)}
      onError={() => setOk(false)}
    />
  );
}
