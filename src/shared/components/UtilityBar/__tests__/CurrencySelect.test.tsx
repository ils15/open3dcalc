import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CurrencySelect } from "../CurrencySelect";
import type { CurrencyCode } from "@/shared/lib/currency";

/**
 * `CurrencySelect` is the merge of two previously separate implementations, one
 * per shell, into one shared file. These tests cover the parts of it that the
 * chrome suites cannot reach: the chrome suites stub the chrome around it and
 * assert WHERE the control lives, not what it does.
 *
 * The i18n mock is a resolver, for the reason recorded at the top of
 * `UtilityBar.test.tsx` — a passthrough would let an untranslated key render
 * and pass.
 */
function translate(key: string, locale: Record<string, unknown>): string {
  let node: unknown = locale;
  for (const part of key.split(".")) {
    if (typeof node !== "object" || node === null) return key;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : key;
}

const locale: Record<string, unknown> = {
  settings: {
    currency: "Moeda",
    currencyAuto: "Automático",
  },
};

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => translate(key, locale),
    i18n: {
      language: "pt-BR",
      resolvedLanguage: "pt-BR",
      changeLanguage: vi.fn(),
    },
  }),
}));
vi.mock("@/shared/hooks/useCurrency", () => ({
  useCurrency: () => ({ symbol: "R$", format: (v: number) => `R$ ${v}` }),
}));

describe("CurrencySelect", () => {
  const onChange = vi.fn();

  beforeEach(() => {
    onChange.mockClear();
  });

  const renderSelect = (setting: CurrencyCode | "auto" = "auto") =>
    render(<CurrencySelect setting={setting} onChange={onChange} />);

  it("shows the resolved symbol and the auto marker only when auto", () => {
    const { unmount } = renderSelect("auto");
    expect(screen.getByText("R$")).toBeInTheDocument();
    expect(screen.getByText("auto")).toBeInTheDocument();
    unmount();

    renderSelect("BRL");
    expect(screen.getByText("R$")).toBeInTheDocument();
    expect(screen.queryByText("auto")).toBeNull();
  });

  it("opens the menu and reports the chosen unit", async () => {
    const user = userEvent.setup();
    renderSelect("BRL");
    await user.click(screen.getByRole("button", { name: "Moeda" }));

    const menu = screen.getByRole("menu", { name: "Moeda" });
    const usd = screen.getByRole("menuitem", { name: /USD/ });
    expect(menu).toBeInTheDocument();

    await user.click(usd);
    expect(onChange).toHaveBeenCalledWith("USD");
    // Choosing a unit closes the menu — the panel must not be left open over
    // the band it is anchored to.
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("reports going back to auto", async () => {
    // The path the two chrome suites never take: they always click a concrete
    // currency, so `onChange("auto")` — the value the store actually starts on
    // — was uncovered until this component became a unit under test.
    const user = userEvent.setup();
    renderSelect("USD");
    await user.click(screen.getByRole("button", { name: "Moeda" }));
    await user.click(screen.getByRole("menuitem", { name: /Automático/ }));

    expect(onChange).toHaveBeenCalledWith("auto");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("marks the active unit as current", async () => {
    const user = userEvent.setup();
    renderSelect("USD");
    await user.click(screen.getByRole("button", { name: "Moeda" }));

    const checked = screen
      .getAllByRole("menuitem")
      .filter((el) => el.querySelector('svg[aria-hidden="true"]'));
    expect(checked).toHaveLength(1);
    expect(checked[0].textContent).toContain("USD");
  });

  it("closes on Escape and on outside click", async () => {
    const user = userEvent.setup();
    renderSelect("BRL");
    const trigger = screen.getByRole("button", { name: "Moeda" });

    await user.click(trigger);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();

    await user.click(trigger);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await user.click(document.body);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("keeps the menu on the scale step, not a literal", async () => {
    // `focusModeLayering.test.tsx` pins this at the source level too. Asserting
    // it here means the unit test fails for the same reason if the pairing
    // between trigger and panel is ever edited apart.
    //
    // The click is AWAITED: the panel only mounts once `handleToggle` has read
    // the trigger's rect, which happens in the click's own act() flush. Read
    // synchronously right after, the query runs a render too early and finds no
    // `role="menu"` — a failure that looks like a missing panel rather than a
    // missing await.
    const user = userEvent.setup();
    renderSelect("BRL");
    await user.click(screen.getByRole("button", { name: "Moeda" }));
    const menu = screen.getByRole("menu");
    expect(menu.style.zIndex).toBe("var(--z-dropdown)");
  });
});
