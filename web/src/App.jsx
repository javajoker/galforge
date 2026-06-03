import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { CONFIG } from "./config.js";
import Menu from "./ui/Menu.jsx";
import Player from "./ui/Player.jsx";

/* HashRouter → deep links (#/play/<id>) work on any static host with no
 * server rewrites. The game is chosen by route, not by query string. */
export default function App() {
  return (
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route
          path="/"
          element={CONFIG.defaultGame ? <Navigate to={`/play/${CONFIG.defaultGame}`} replace /> : <Menu />}
        />
        <Route path="/play/:gameId" element={<Player />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
