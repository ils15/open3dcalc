import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HistoryEntry } from "@/shared/types";
import { useDemoModeStore } from "@/shared/stores/demoModeStore";
import i18n from "@/shared/i18n/i18n";
import { useHistoryStore } from "@/shared/stores/historyStore";
import { StudioDashboardView } from "./StudioDashboardView";

vi.mock("recharts", () => ({
  Area: () => null,
  AreaChart: () => null,
  Cell: () => null,
  Pie: () => null,
  PieChart: () => null,
  ResponsiveContainer: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

function makeEntry(
  id: string,
  type: HistoryEntry["type"],
  timestamp: number,
  snapshot: HistoryEntry["snapshot"],
): HistoryEntry {
  return {
    id,
    type,
    timestamp,
    name: id,
    summary: id,
    totalCost: 10,
    sellPrice: 20,
    profit: 10,
    result: {} as HistoryEntry["result"],
    snapshot,
  };
}

afterEach(() => {
  useHistoryStore.setState({ entries: [] });
  useDemoModeStore.setState({ isActive: false, snapshot: null });
});

describe("StudioDashboardView", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("pt-BR");
  });
  it("uses saved history for the selected period and keeps material units separate", () => {
    const now = Date.now();
    const fdmSnapshot = {
      fdmPrintParams: { printTimeHours: 1.5 },
      fdmMaterial: { type: "PLA", weightUsed: 50, purgeWeight: 5 },
      fdmAmsEnabled: false,
      fdmAmsSlots: [],
    } as unknown as HistoryEntry["snapshot"];
    const resinSnapshot = {
      resinPrintParams: { printTimeHours: 2 },
      resinMaterial: { volumeUsedMl: 12 },
    } as unknown as HistoryEntry["snapshot"];
    const olderResinSnapshot = {
      resinPrintParams: { printTimeHours: 4 },
      resinMaterial: { volumeUsedMl: 100 },
    } as unknown as HistoryEntry["snapshot"];

    useHistoryStore.setState({
      entries: [
        makeEntry("FDM recente", "fdm", now - 2 * 86400000, fdmSnapshot),
        makeEntry("Resina recente", "resin", now - 4 * 86400000, resinSnapshot),
        makeEntry(
          "Resina antiga",
          "resin",
          now - 60 * 86400000,
          olderResinSnapshot,
        ),
      ],
    });

    render(
      <StudioDashboardView onTabChange={vi.fn()} onOpenCopilot={vi.fn()} />,
    );

    expect(screen.getByText("2 cálculos")).toBeInTheDocument();
    expect(
      screen.getByText("Cálculos FDM").nextElementSibling,
    ).toHaveTextContent("1");
    expect(
      screen.getByText("Cálculos de resina").nextElementSibling,
    ).toHaveTextContent("1");
    expect(screen.getAllByText("55 g").length).toBeGreaterThan(0);
    expect(screen.getByText("12 ml de resina")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tudo" }));

    expect(screen.getByText("3 cálculos")).toBeInTheDocument();
    expect(screen.getByText("112 ml de resina")).toBeInTheDocument();
    expect(
      screen.queryByText(/R\$ 5\.000|BACKLOG EM CARTEIRA|65%/i),
    ).toBeNull();
  });

  it("shows a real-data empty state instead of invented activity", () => {
    useHistoryStore.setState({ entries: [] });

    render(
      <StudioDashboardView onTabChange={vi.fn()} onOpenCopilot={vi.fn()} />,
    );

    expect(
      screen.getByText(i18n.t("dashboardView.waitingTitle")),
    ).toBeVisible();
    expect(
      screen.getByText(i18n.t("dashboardView.noDataInPeriod")),
    ).toBeVisible();
    expect(
      screen.getByText(i18n.t("dashboardView.noFdmConsumption")),
    ).toBeVisible();
    expect(
      screen.queryByText(/BACKLOG|projeção anual|meta mensal/i),
    ).toBeNull();
  });
});
