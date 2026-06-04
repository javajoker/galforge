import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

// Note: no <StrictMode> on purpose — it double-invokes effects in dev, which
// would boot the Engine (and double-fetch the project) twice. Production builds
// don't double-invoke regardless.
createRoot(document.getElementById("root")).render(<App />);
