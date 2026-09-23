import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { HistoryCard } from "../HistoryCard";
import { useHistoryStore } from "@/shared/stores/historyStore";
import type { HistoryEntry } from "@/shared/types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { resolvedLanguage: "pt-BR", language: "pt-BR" },
  }),
}));

const entries: HistoryEntry[] = [
  {
    id: "e1",
    timestamp: Date.now(),
    type: "fdm",
    name: "Vaso",
    summary: "PLA · 85g · 5h",
    totalCost: 60,
    profit: 30,
    sellPrice: 105.88,
    result: undefined as never,
    snapshot: null,
  },
  {
    id: "e2",
    timestamp: Date.now(),
    type: "resin",
    name: "Mini",
    summary: "Standard · 12ml · 2h",
    totalCost: 25,
    profit: 12,
    sellPrice: 45,
    result: undefined as never,
    snapshot: null,
  },
];

beforeEach(() => {
  localStorage.clear();
  useHistoryStore.setState({ entries: [] });
});

describe("HistoryCard", () => {
  it("renders nothing when the history is empty", () => {
    const { container } = render(<HistoryCard />);

    expect(container).toBeEmptyDOMElement();
  });

  it("shows up to three recent entries with the total count", () => {
    useHistoryStore.setState({
      entries: [...entries, ...entries.map((e) => ({ ...e, id: e.id + "x" }))],
    });

    render(<HistoryCard />);

    expect(screen.getByText(/calc.history/)).toHaveTextContent("(4)");
    expect(screen.getAllByText("PLA · 85g · 5h")).toHaveLength(2);
    expect(screen.getByText("Standard · 12ml · 2h")).toBeInTheDocument();
  });

  it("clears the history after confirming", async () => {
    const user = userEvent.setup();
    useHistoryStore.setState({ entries });

    render(<HistoryCard />);
    await user.click(
      screen.getByRole("button", { name: "calc.clearHistory" }),
    );

    const dialog = screen.getByRole("dialog", { name: "calc.clearHistory" });
    await user.click(
      within(dialog).getByRole("button", { name: "common.confirm" }),
    );

    expect(useHistoryStore.getState().entries).toHaveLength(0);
  });

  it("keeps the history when the clear is cancelled", async () => {
    const user = userEvent.setup();
    useHistoryStore.setState({ entries });

    render(<HistoryCard />);
    await user.click(
      screen.getByRole("button", { name: "calc.clearHistory" }),
    );
    const dialog = screen.getByRole("dialog", { name: "calc.clearHistory" });
    await user.click(
      within(dialog).getByRole("button", { name: "common.cancel" }),
    );

    expect(useHistoryStore.getState().entries).toHaveLength(entries.length);
  });
});
