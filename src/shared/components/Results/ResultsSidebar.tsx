import { useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import {
  BarChart3,
  LayoutGrid,
  ListChecks,
  PanelBottom,
  Rows3,
  type LucideIcon,
} from "lucide-react";
import {
  useLayoutStore,
  type SidebarMode,
} from "@/shared/stores/layoutStore";
import {
  ResultsPanel,
  type ResultsCompactView,
  type ResultsSidebarTab,
} from "./ResultsPanel";

export interface ResultsSidebarProps {
  readonly onExportBlocked?: (message: string) => void;
}

interface SidebarModeOption {
  readonly mode: SidebarMode;
  readonly labelKey: string;
  readonly icon: LucideIcon;
}

interface SidebarTabOption {
  readonly tab: ResultsSidebarTab;
  readonly labelKey: string;
  readonly icon: LucideIcon;
}

const MODE_OPTIONS: readonly SidebarModeOption[] = [
  { mode: "compact", labelKey: "results.sidebar.compact", icon: LayoutGrid },
  { mode: "tabs", labelKey: "results.sidebar.tabs", icon: ListChecks },
  { mode: "dock", labelKey: "results.sidebar.dock", icon: PanelBottom },
  { mode: "expanded", labelKey: "results.sidebar.expanded", icon: Rows3 },
];

const TAB_OPTIONS: readonly SidebarTabOption[] = [
  { tab: "chart", labelKey: "results.sidebar.chart", icon: BarChart3 },
  { tab: "bars", labelKey: "results.sidebar.bars", icon: BarChart3 },
  { tab: "actions", labelKey: "results.sidebar.actions", icon: ListChecks },
];

function controlClass(active: boolean): string {
  return `inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none ${
    active
      ? "bg-[var(--accent)] text-[var(--text-inverse)] shadow-sm"
      : "text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]"
  }`;
}

/**
 * Presentation shell for the classic results inspector.
 *
 * The global calculator layout remains in `layoutMode`; this component reads
 * the independent `sidebarMode` preference from the same layout store. The
 * content region remains a normal scrollable sidebar when content exceeds
 * the available height; no overflow status is presented to the user.
 */
export function ResultsSidebar({
  onExportBlocked,
}: ResultsSidebarProps): ReactElement {
  const { t } = useTranslation();
  const sidebarMode = useLayoutStore((state) => state.sidebarMode);
  const setSidebarMode = useLayoutStore((state) => state.setSidebarMode);
  const [activeTab, setActiveTab] = useState<ResultsSidebarTab>("chart");
  const [compactView, setCompactView] =
    useState<ResultsCompactView>("chart");

  return (
    <div
      role="complementary"
      aria-label={t("results.sidebar.modeLabel")}
      data-testid="results-sidebar-shell"
      data-sidebar-mode={sidebarMode}
      className="flex min-h-0 h-full flex-col gap-3"
    >
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div
            role="group"
            aria-label={t("results.sidebar.modeLabel")}
            className="grid min-w-0 flex-1 grid-cols-4 gap-1 rounded-xl border border-[var(--border-default)] bg-[var(--surface-overlay)] p-1"
          >
            {MODE_OPTIONS.map(({ mode, labelKey, icon: Icon }) => {
              const active = sidebarMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  data-testid={`sidebar-mode-${mode}`}
                  data-sidebar-mode={mode}
                  aria-label={t(labelKey)}
                  aria-pressed={active}
                  title={t(labelKey)}
                  onClick={() => setSidebarMode(mode)}
                  className={`${controlClass(active)} min-w-0 px-1.5`}
                >
                  <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">{t(labelKey)}</span>
                </button>
              );
            })}
          </div>
        </div>

        {sidebarMode === "compact" && (
          <div
            role="group"
            aria-label={t("results.sidebar.viewLabel")}
            className="grid grid-cols-2 gap-1 rounded-lg border border-[var(--border-default)] bg-[var(--surface-sunken)] p-1"
          >
            {(["chart", "bars"] as const).map((view) => {
              const active = compactView === view;
              return (
                <button
                  key={view}
                  type="button"
                  data-testid={`sidebar-compact-${view}`}
                  aria-pressed={active}
                  onClick={() => setCompactView(view)}
                  className={controlClass(active)}
                >
                  <BarChart3 className="size-3.5" aria-hidden="true" />
                  {t(view === "chart" ? "results.sidebar.chart" : "results.sidebar.bars")}
                </button>
              );
            })}
          </div>
        )}

        {sidebarMode === "tabs" && (
          <div
            role="tablist"
            aria-label={t("results.sidebar.viewLabel")}
            className="grid grid-cols-3 gap-1 rounded-lg border border-[var(--border-default)] bg-[var(--surface-sunken)] p-1"
          >
            {TAB_OPTIONS.map(({ tab, labelKey, icon: Icon }) => {
              const active = activeTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  data-testid={`sidebar-tab-${tab}`}
                  aria-selected={active}
                  aria-controls="results-sidebar-panel"
                  onClick={() => setActiveTab(tab)}
                  className={controlClass(active)}
                >
                  <Icon className="size-3.5" aria-hidden="true" />
                  {t(labelKey)}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div
        id="results-sidebar-panel"
        data-testid="results-sidebar-scroll-region"
        className="min-h-0 flex-1 overflow-y-auto pr-1"
      >
        <ResultsPanel
          variant="sidebar"
          onExportBlocked={onExportBlocked}
          sidebarMode={sidebarMode}
          sidebarTab={activeTab}
          compactView={compactView}
        />
      </div>
    </div>
  );
}
