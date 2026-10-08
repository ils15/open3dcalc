import React from "react";
import ReactDOM from "react-dom/client";
import App from "@/platform/desktop/App";
import "@/shared/i18n/i18n";
import "./index.css";
import { initTheme } from "@/platform/desktop/hooks/useTheme";
import {
  DbErrorBanner,
  PiiUnavailableBanner,
  StartupBridgeFailure,
} from "@/platform/desktop/components/PersistenceBridgeError/PersistenceBridgeError";

// Initialize theme BEFORE React renders to prevent flash of wrong theme.
initTheme();

// Initialize SQLite persistence bridge BEFORE React renders.
// This loads data from SQLite → localStorage so Zustand stores
// hydrate with durable data instead of stale/empty localStorage.
//
// BOTH outcomes below are terminal and neither is a blank window. The promise
// used to carry only a `.then`, so a rejection — a CryptoDeniedError on a
// quarantined PII key (ADR-002 §2.2.1), an unreadable manifest, a SQLite error
// on the first listKeys — left an empty #root with no message and no focusable
// element, and the app looked broken rather than refused. Failing closed is
// still the rule: a renderer that hydrated from stale localStorage would look
// like it worked and then lose every write. It just says so now.
const isBetaBuild = import.meta.env.VITE_BETA_CHANNEL === true;
const persistenceReady = isBetaBuild
  ? Promise.resolve()
  : import("@/platform/desktop/overrides/persistence-bridge").then(
      ({ initPersistenceBridge }) => initPersistenceBridge(),
    );

persistenceReady
  .then(() => {
    ReactDOM.createRoot(document.getElementById("root")!).render(
      <React.StrictMode>
        {/* The production subscribers for the bridge's two signals. They live
            here rather than in App because the app is not guaranteed to mount —
            a bridge that works at startup and fails later still has to be able
            to say so.

            `PiiUnavailableBanner` is the visible half of ADR-001 §3.6 per-key
            isolation: the app now STARTS on a profile whose legacy blobs it
            cannot read, quarantines those keys and hydrates the rest, and this
            is what stops that from being indistinguishable from data loss. It
            is mounted unconditionally because the event fires DURING
            `initPersistenceBridge()`, i.e. before this tree exists — the
            banner reads it from a ref-free module-level latch so a signal
            raised before mount is not lost. */}
        <DbErrorBanner />
        <PiiUnavailableBanner />
        <App />
      </React.StrictMode>,
    );
  })
  .catch((error: unknown) => {
    ReactDOM.createRoot(document.getElementById("root")!).render(
      <React.StrictMode>
        <StartupBridgeFailure error={error} />
      </React.StrictMode>,
    );
  });
