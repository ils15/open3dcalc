import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "@/shared/i18n/i18n";
import { useWikiNamespace } from "../useWikiNamespace";

// loadWikiBundle is the seam: this file verifies the i18n contract of the hook
// (ready transitions, addResourceBundle, languageChanged, cleanup), while
// loadWikiBundle.test.ts covers the bundle assembly and locale fallback.
const { loadWikiBundleMock } = vi.hoisted(() => ({
  loadWikiBundleMock: vi.fn(),
}));

vi.mock("@/shared/lib/wiki/loadWikiBundle", () => ({
  WIKI_NAMESPACE: "wiki",
  loadWikiBundle: loadWikiBundleMock,
}));

const PT_BR_BUNDLE = {
  inventario: {
    title: "Inventário",
    order: 1,
    toc: [{ depth: 1, text: "Inventário", slug: "user-content-inventario" }],
    html: "<h1>Inventário</h1>",
  },
};
const EN_US_BUNDLE = {
  inventario: {
    title: "Inventory",
    order: 1,
    toc: [{ depth: 1, text: "Inventory", slug: "user-content-inventory" }],
    html: "<h1>Inventory</h1>",
  },
};

const SUPPORTED = ["pt-BR", "en-US"];

describe("useWikiNamespace", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // i18n is real (that is the point of this file); spy through it so the
    // recorded calls AND the actual resource bundles are both observable.
    vi.spyOn(i18n, "addResourceBundle");
    loadWikiBundleMock.mockImplementation(async (locale: string) =>
      locale === "en-US" ? EN_US_BUNDLE : PT_BR_BUNDLE,
    );
    for (const lng of SUPPORTED) i18n.removeResourceBundle(lng, "wiki");
    await i18n.changeLanguage("pt-BR");
  });

  afterEach(async () => {
    for (const lng of SUPPORTED) i18n.removeResourceBundle(lng, "wiki");
    await i18n.changeLanguage("pt-BR");
  });

  it("is not ready until the first bundle resolves", () => {
    const { result } = renderHook(() => useWikiNamespace());

    expect(result.current.ready).toBe(false);
    expect(loadWikiBundleMock).toHaveBeenCalledTimes(1);
  });

  it("adds the active locale's bundle to the wiki namespace and turns ready", async () => {
    const { result } = renderHook(() => useWikiNamespace());

    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(loadWikiBundleMock).toHaveBeenCalledWith("pt-BR");
    expect(i18n.addResourceBundle).toHaveBeenCalledWith(
      "pt-BR",
      "wiki",
      PT_BR_BUNDLE,
      true,
      true,
    );
    // The bundle resolves through real i18n, exactly like ChangelogPage reads
    // `t("changelog.versions", { returnObjects: true })`.
    expect(i18n.getResourceBundle("pt-BR", "wiki")).toEqual(PT_BR_BUNDLE);
    expect(i18n.t("wiki:inventario.title")).toBe("Inventário");
  });

  it("reloads when the language changes and keeps both locales", async () => {
    const { result } = renderHook(() => useWikiNamespace());
    await waitFor(() => expect(result.current.ready).toBe(true));

    await act(async () => {
      await i18n.changeLanguage("en-US");
    });

    expect(loadWikiBundleMock).toHaveBeenCalledWith("en-US");
    expect(i18n.getResourceBundle("en-US", "wiki")).toEqual(EN_US_BUNDLE);
    expect(i18n.t("wiki:inventario.title")).toBe("Inventory");
    // ready never dips (R2): the previous locale stays resolvable while the
    // new bundle loads, so there is no flash of raw keys.
    expect(result.current.ready).toBe(true);
    // The pt-BR bundle is kept, so switching back is instant.
    expect(i18n.getResourceBundle("pt-BR", "wiki")).toEqual(PT_BR_BUNDLE);
  });

  it("does not refetch a locale already added (idempotency)", async () => {
    const { result } = renderHook(() => useWikiNamespace());
    await waitFor(() => expect(result.current.ready).toBe(true));
    await act(async () => {
      await i18n.changeLanguage("en-US");
    });

    const callsBefore = loadWikiBundleMock.mock.calls.length;
    await act(async () => {
      await i18n.changeLanguage("pt-BR");
    });

    expect(loadWikiBundleMock.mock.calls).toHaveLength(callsBefore);
    expect(result.current.ready).toBe(true);
  });

  it("follows the resolved language when the requested one is unsupported", async () => {
    const { result } = renderHook(() => useWikiNamespace());
    await waitFor(() => expect(result.current.ready).toBe(true));

    // i18n resolves es-ES to the pt-BR fallback, so the wiki stays with the
    // language the rest of the UI actually displays.
    await act(async () => {
      await i18n.changeLanguage("es-ES");
    });

    expect(loadWikiBundleMock).not.toHaveBeenCalledWith("es-ES");
    expect(result.current.ready).toBe(true);
    expect(i18n.t("wiki:inventario.title")).toBe("Inventário");
  });

  it("removes its languageChanged listener on unmount (no leak)", async () => {
    const { result, unmount } = renderHook(() => useWikiNamespace());
    await waitFor(() => expect(result.current.ready).toBe(true));
    const off = vi.spyOn(i18n, "off");

    unmount();

    expect(off).toHaveBeenCalledOnce();
    expect(off).toHaveBeenCalledWith(
      "languageChanged",
      expect.any(Function),
    );

    // A language switch after unmount must not touch i18n through this hook.
    const callsBefore = loadWikiBundleMock.mock.calls.length;
    await act(async () => {
      await i18n.changeLanguage("en-US");
    });
    expect(loadWikiBundleMock.mock.calls).toHaveLength(callsBefore);
  });

  it("drops a load that resolves after unmount instead of mutating i18n", async () => {
    // Never resolves on its own: the hook awaits it, we unmount, then we
    // settle it manually and assert addResourceBundle was never called.
    let settle: ((bundle: unknown) => void) | undefined;
    loadWikiBundleMock.mockImplementation(
      () => new Promise((resolve) => void (settle = resolve)),
    );
    const { unmount } = renderHook(() => useWikiNamespace());

    unmount();
    expect(settle).toBeDefined();
    settle?.(PT_BR_BUNDLE);
    await Promise.resolve();

    expect(i18n.addResourceBundle).not.toHaveBeenCalled();
  });
});
