import React from "react";
import ReactDOM from "react-dom/client";
import App from "@/platform/web/App";
import "@/shared/i18n/i18n";
import "./index.css";
import { initTheme } from "@/shared/hooks/useTheme";
import { ErrorBoundary } from "@/shared/components/ErrorBoundary";
// Initialize theme BEFORE React renders to prevent flash of wrong theme.
try {
  initTheme();
} catch (e) {
  console.warn("[main.tsx] Failed to initialize theme:", e);
}

const rootEl = document.getElementById("root");
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>,
  );
}
