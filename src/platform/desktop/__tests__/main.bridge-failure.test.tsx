/**
 * The desktop entry point's rejection path.
 *
 * `main.tsx` starts the SQLite persistence bridge and only renders `<App/>`
 * once it resolves. That ordering is the point — stores must hydrate from
 * durable data, not stale localStorage — but the promise had no `.catch`, so
 * every failure the bridge can raise (a local storage refusal, a manifest
 * that will not load, a SQLite error on the very first `listKeys`) left the user staring at an empty window
 * with nothing in it: no message, no way out, and no record that the app had
 * decided not to start.
 *
 * These specs drive the real entry module. Mocking `<App/>` away would prove
 * nothing about what the user gets, but mocking the BRIDGE is the thing under
 * test: the bridge is what rejects.
 */

import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/shared/i18n/i18n";

const hoisted = vi.hoisted(() => ({
  initPersistenceBridge: vi.fn<() => Promise<void>>(),
  initTheme: vi.fn<() => string>(),
}));

vi.mock("@/platform/desktop/overrides/persistence-bridge", () => ({
  initPersistenceBridge: hoisted.initPersistenceBridge,
}));
vi.mock("@/platform/desktop/hooks/useTheme", () => ({
  initTheme: hoisted.initTheme,
}));
vi.mock("@/platform/desktop/App", () => ({
  default: () => <div data-testid="desktop-app">App</div>,
}));
// The entry also imports the real i18n bundle, which reads `document` and
// `localStorage`; both exist in jsdom, so it is left alone on purpose — the
// error surface resolves copy through it.
//
// `t` is the REAL i18next instance, not a key-echo. The startup detail is
// `persistence.bridge.startupDetail`, which reaches the user only through
// `{{reason}}` interpolation; a `t` that returned the key would make "the
// reason reached the surface" unfalsifiable, which is precisely how the reason
// went missing while the surface still looked finished.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: i18n.t }),
  initReactI18next: { type: "3rdParty", init: () => undefined },
}));

const ROOT_ID = "root";

function storageUnavailable(reason: string): Error & { reason: string } {
  return Object.assign(new Error(`local storage unavailable (${reason})`), {
    reason,
  });
}

/** The real `document` element the entry renders into. */
function rootElement(): HTMLElement {
  const node = document.getElementById(ROOT_ID);
  if (!node) throw new Error("index.desktop.html must provide #root");
  return node;
}

/** The entry renders through `createRoot`, which commits asynchronously. */
async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  hoisted.initTheme.mockReturnValue("dark");
  hoisted.initPersistenceBridge.mockReset();
  const root = document.createElement("div");
  root.id = ROOT_ID;
  document.body.appendChild(root);
});

afterEach(() => {
  // React roots are not unmountable from outside, so each spec gets a fresh
  // document body rather than a leftover tree from the previous one.
  document.body.innerHTML = "";
  vi.resetModules();
  vi.restoreAllMocks();
});

describe("desktop entry — the persistence bridge has a rejection path", () => {
  it("renders the app when the bridge resolves, as before", async () => {
    hoisted.initPersistenceBridge.mockResolvedValue(undefined);
    await import("../main");
    await settle();

    expect(rootElement()).toHaveTextContent("App");
  });

  it("renders an accessible failure surface instead of a blank window", async () => {
    hoisted.initPersistenceBridge.mockRejectedValue(
      storageUnavailable("legacy_data_unavailable"),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});

    await import("../main");
    await settle();

    const surface = rootElement().querySelector<HTMLElement>("section");
    expect(
      surface,
      "a rejected bridge must not leave #root empty",
    ).not.toBeNull();
    expect(
      rootElement().textContent?.trim(),
      "the window must say why it is empty",
    ).not.toBe("");

    // The message is an ALERT, so it is announced rather than merely drawn,
    // and the surface carries a name so it is reachable as a landmark.
    const alert = rootElement().querySelector<HTMLElement>('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert!.textContent?.trim()).toBeTruthy();
    expect(surface!.getAttribute("aria-label")?.trim()).toBeTruthy();

    // Keyboard reachable: the surface owns a focusable control, so a user is
    // never stranded on a document with no focusable element at all.
    const action = rootElement().querySelector<HTMLButtonElement>("button");
    expect(action, "the failure must offer an action").not.toBeNull();
    expect(action!.disabled).toBe(false);
    act(() => action!.focus());
    expect(document.activeElement).toBe(action);
  });

  it.each([
    "database_unavailable",
    "manifest_unavailable",
    "legacy_data_unavailable",
  ])("shows the storage failure reason %s", async (reason) => {
    hoisted.initPersistenceBridge.mockRejectedValue(storageUnavailable(reason));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await import("../main");
    await settle();

    const detail = rootElement().textContent ?? "";
    expect(detail, `the ${reason} code must reach the surface`).toContain(
      reason,
    );
    expect(detail).not.toContain("CryptoDeniedError");
  });

  it("mounts a production subscriber for the bridge's db-error event", async () => {
    // `persistence-bridge.ts` dispatches `open3dcalc:db-error` after five
    // consecutive failures. Until now the only listener in the tree was a
    // test, so the signal went nowhere at runtime.
    hoisted.initPersistenceBridge.mockResolvedValue(undefined);
    await import("../main");
    await settle();

    act(() => {
      document.dispatchEvent(
        new CustomEvent("open3dcalc:db-error", {
          detail: {
            message:
              "Database unavailable — data will not persist between sessions.",
          },
        }),
      );
    });
    await settle();

    expect(rootElement().querySelector('[role="alert"]')).not.toBeNull();
    expect(rootElement().textContent).toContain(
      "Database unavailable — data will not persist between sessions.",
    );
  });

  it("does not mount the app when the bridge rejected", async () => {
    hoisted.initPersistenceBridge.mockRejectedValue(
      new Error("manifest unavailable"),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});

    await import("../main");
    await settle();

    // Fail-closed is the whole design of the bridge: a renderer that hydrated
    // from stale localStorage would look like it worked and then lose writes.
    expect(
      rootElement().querySelector('[data-testid="desktop-app"]'),
    ).toBeNull();
  });
});
