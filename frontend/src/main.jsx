/**
 * main.jsx — Vite Entry Point
 *
 * Purpose: Mounts the React application into the #root div in index.html.
 * This is the first file Vite loads — keep it minimal.
 */

import React from "react";
import ReactDOM from "react-dom/client";
import "./theme.css";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
