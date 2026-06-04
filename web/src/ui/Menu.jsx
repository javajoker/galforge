import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CONFIG, contentBase, contentIndexURL } from "../config.js";

async function fetchJSON(url) {
  const r = await fetch(url, { cache: "no-cache" });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json();
}
function flatten(obj, pre = "", out = {}) {
  for (const k in obj) {
    const v = obj[k];
    const key = pre + k;
    if (v && typeof v === "object") flatten(v, key + ".", out);
    else out[key] = v;
  }
  return out;
}
function hashHue(s) {
  let h = 0;
  for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

async function loadGameMeta(id) {
  const base = contentBase(id);
  const game = await fetchJSON(`${base}/game.json`);
  let strings = {};
  try {
    strings = flatten((await fetchJSON(`${base}/i18n/${game.locales.default}.json`)).strings || {});
  } catch {
    /* title may be a literal */
  }
  const resolve = (s) => (typeof s === "string" && s[0] === "@" ? strings[s.slice(1)] || s.slice(1) : s);
  return {
    id,
    title: resolve(game.title) || id,
    rating: game.meta && game.meta.rating,
    locales: (game.locales && game.locales.supported) || [],
  };
}

export default function Menu() {
  const [games, setGames] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const idx = await fetchJSON(contentIndexURL());
        const metas = await Promise.all((idx.games || []).map(loadGameMeta));
        if (!cancel) setGames(metas);
      } catch (e) {
        if (!cancel) setError(e && e.message ? e.message : String(e));
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  return (
    <div className="gf-menu">
      <header className="gf-menu-head">
        <h1>{CONFIG.appTitle}</h1>
        <p>GVNF v1.0 reference runtime · React</p>
      </header>

      {error ? <div className="gf-menu-error">Couldn’t list games: {error}</div> : null}
      {!games && !error ? <div className="gf-menu-loading">Loading library…</div> : null}

      <div className="gf-menu-grid">
        {(games || []).map((g) => (
          <Link key={g.id} to={`/play/${g.id}`} className="gf-card">
            <div
              className="gf-card-cover"
              style={{
                background: `linear-gradient(135deg,hsl(${hashHue(g.id)} 50% 32%),hsl(${(hashHue(g.id) + 50) % 360} 45% 18%))`,
              }}
            >
              <span className="gf-card-id">{g.id}</span>
            </div>
            <div className="gf-card-body">
              <div className="gf-card-title">{g.title}</div>
              <div className="gf-card-meta">
                {g.rating ? <span className="tag">{g.rating}</span> : null}
                {g.locales.map((l) => (
                  <span className="tag" key={l}>
                    {l}
                  </span>
                ))}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {games && games.length === 0 ? (
        <div className="gf-menu-loading">
          No games bundled. Run <code>npm run sync</code> to copy GVNF projects into <code>public/content/</code>.
        </div>
      ) : null}

      <footer className="gf-menu-foot">
        Pick a title to play. Add games by editing <code>web/scripts/sync-content.mjs</code>.
      </footer>
    </div>
  );
}
