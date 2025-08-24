import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

// 👈 make sure this line exists and the path matches your file
import "./theme.css";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element #root not found");
createRoot(rootEl).render(<App />);
