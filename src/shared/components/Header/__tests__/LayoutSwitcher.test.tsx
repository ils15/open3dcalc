import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { labels } = vi.hoisted(() => ({
  labels: {
    "layoutSwitcher.ariaLabel": "Escolher layout da calculadora",
    "layoutSwitcher.classic": "Clássico",
    "layoutSwitcher.guided": "Fluxo Guiado",
    "layoutSwitcher.bento": "Bento Grid",
  } as Record<string, string>,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => labels[key] ?? key,
  }),
}));

import { LayoutSwitcher } from "../LayoutSwitcher";
import { useLayoutStore, type LayoutMode } from "@/shared/stores/layoutStore";

const originalSetLayoutMode = useLayoutStore.getState().setLayoutMode;

beforeEach(() => {
  localStorage.clear();
  useLayoutStore.setState({
    layoutMode: "classic",
    setLayoutMode: originalSetLayoutMode,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("LayoutSwitcher", () => {
  it("renders one accessible button for every layout mode", () => {
    render(<LayoutSwitcher />);

    expect(screen.getAllByRole("button")).toHaveLength(3);
    expect(
      screen.getByRole("button", { name: "Clássico" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Fluxo Guiado" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Bento Grid" }),
    ).toBeInTheDocument();
  });

  it("calls setLayoutMode with the selected mode", async () => {
    const user = userEvent.setup();
    const setLayoutMode = vi.fn();
    useLayoutStore.setState({ setLayoutMode });

    render(<LayoutSwitcher />);
    await user.click(screen.getByRole("button", { name: "Fluxo Guiado" }));

    expect(setLayoutMode).toHaveBeenCalledWith("guided");
  });

  it("reflects the active mode with aria-current and aria-pressed", () => {
    useLayoutStore.setState({ layoutMode: "guided" });

    render(<LayoutSwitcher />);

    expect(
      screen.getByRole("button", { name: "Fluxo Guiado" }),
    ).toHaveAttribute("aria-current", "true");
    expect(
      screen.getByRole("button", { name: "Fluxo Guiado" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: "Clássico" }),
    ).not.toHaveAttribute("aria-current");
    expect(
      screen.getByRole("button", { name: "Bento Grid" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("supports native keyboard navigation and activation", async () => {
    const user = userEvent.setup();
    render(<LayoutSwitcher />);

    const classic = screen.getByRole("button", { name: "Clássico" });
    const guided = screen.getByRole("button", { name: "Fluxo Guiado" });
    classic.focus();

    await user.keyboard("{Tab}");
    expect(guided).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(useLayoutStore.getState().layoutMode).toBe("guided");
  });

  it("accepts bento without coupling the control to a future surface", async () => {
    const user = userEvent.setup();
    render(<LayoutSwitcher />);

    await user.click(screen.getByRole("button", { name: "Bento Grid" }));

    expect(useLayoutStore.getState().layoutMode).toBe("bento");
    expect(
      screen.getByRole("button", { name: "Bento Grid" }),
    ).not.toHaveAttribute("disabled");
  });
});

void (undefined as unknown as LayoutMode);
