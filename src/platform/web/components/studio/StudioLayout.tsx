import React, { useState, useEffect, useRef, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Calculator, Clock, FileText, Warehouse } from "lucide-react";
import { isWorkshopRoute, Tab } from "@/shared/components/AppShell/tabs";
import { useLayoutStore } from "@/shared/stores/layoutStore";
import {
  WORKSPACE_CONTAINER_CLASSES,
  WORKSPACE_MAIN_PADDING,
} from "./workspaceWidth";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { useHistoryStore } from "@/shared/stores/historyStore";
import { useQuoteStore } from "@/shared/stores/quoteStore";
import { useFilamentInventory } from "@/shared/stores/filamentInventory";
import { isLowStockSpool } from "@/shared/stores/spoolStore";
import { LOW_STOCK_GRAMS } from "@/shared/components/SpoolShelf/SpoolCard";
import { StudioCalculatorModeSelector } from "./StudioCalculatorModeSelector";
import { StudioHeader } from "./StudioHeader";
import { StudioSidebar } from "./StudioSidebar";
import { StudioCockpitDock } from "./StudioCockpitDock";
import { StudioDashboardView } from "./StudioDashboardView";
import { StudioMiniDashOverlay } from "./StudioMiniDashOverlay";
import { StudioCopilotModal } from "./StudioCopilotModal";
import { StudioShortcutsModal } from "./StudioShortcutsModal";
import {
  StudioQuoteModal,
  type StudioQuoteModalSeed,
} from "./StudioQuoteModal";
import { StudioCommandPalette } from "./StudioCommandPalette";
import {
  StudioWhatsAppModal,
  type StudioWhatsAppModalInitialData,
} from "./StudioWhatsAppModal";
import { StudioHistoryView } from "./StudioHistoryView";
import { StudioCustomerView } from "./StudioCustomerView";
import { StudioQuotesView } from "./StudioQuotesView";
import { StudioProductsView } from "./StudioProductsView";

// Existing shared surfaces for remaining tabs
import { InfillCalculator } from "@/shared/components/Calculator/InfillCalculator";
import { WorkshopHub } from "@/shared/components/Catalog/WorkshopHub";
import { WikiPage } from "@/shared/components/Wiki/WikiPage";
import { ChangelogPage } from "@/shared/components/Changelog/ChangelogPage";
import { PrivacyScreen } from "@/shared/components/Privacy/PrivacyScreen";
import { CalculatorSurface } from "@/shared/components/Calculator/surfaces/CalculatorSurface";
import { DemoModeIndicator } from "@/shared/components/DemoMode/DemoModeIndicator";
import { DemoExportBlockedToast } from "@/shared/components/DemoMode/DemoExportBlockedToast";
import { useAppInit } from "@/shared/hooks/useAppInit";
import { useReducedMotion } from "@/shared/hooks/useReducedMotion";
import { PrivacyOnboarding } from "@/shared/components/Privacy/PrivacyOnboarding";
import { isBetaChannel } from "@/shared/config/betaChannel";

export const StudioLayout: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>("calculator");
  const mainRef = useRef<HTMLElement>(null);
  // `layoutMode` is SHARED state, not local. It used to be a local `useState`,
  // which meant `useLayoutStore` kept reporting its `"classic"` default no matter
  // what the user picked here — so `useAppInit`'s first-visit tutorial guard
  // (`useLayoutStore.getState().layoutMode !== "classic"`) could never reject,
  // and the layout preference was never persisted or readable from anywhere
  // else. Reading and writing the store makes both guards honest.
  const layoutMode = useLayoutStore((state) => state.layoutMode);
  const setLayoutMode = useLayoutStore((state) => state.setLayoutMode);
  const workspaceWidth = useLayoutStore(
    (state) => state.workspaceWidth ?? "standard",
  );
  const cycleWorkspaceWidth = useLayoutStore(
    (state) => state.cycleWorkspaceWidth,
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth < 1280;
    }
    return false;
  });
  const prefersReduced = useReducedMotion();
  const [focusMode, setFocusMode] = useState(false);

  // Header actions and every calculator surface share these values. Reading
  // them from the calculator store keeps technology and project name in sync
  // when the user moves between Classic, Bento, and Guided.
  const activeTechnology = useCalculatorStore((state) => state.activeTab);
  const currentProjectName = useCalculatorStore((state) => state.productName);
  const fdmMaterial = useCalculatorStore((state) => state.fdmMaterial);
  const resinMaterial = useCalculatorStore((state) => state.resinMaterial);
  const fdmPrintParams = useCalculatorStore((state) => state.fdmPrintParams);
  const resinPrintParams = useCalculatorStore(
    (state) => state.resinPrintParams,
  );
  const currentResults = useCalculatorStore((state) => state.results);
  const historyCount = useHistoryStore((state) => state.entries.length);
  const quotesCount = useQuoteStore((state) => state.quotes.length);
  const spools = useFilamentInventory((state) => state.spools);
  const lowSpoolCount = useMemo(
    () =>
      spools.filter((spool) => isLowStockSpool(spool, LOW_STOCK_GRAMS)).length,
    [spools],
  );

  const sidebarModuleOverrides = useMemo(
    () => [
      {
        id: "calculator" as Tab,
        label: t("nav.calculator"),
        icon: <Calculator className="w-4 h-4" />,
      },
      {
        id: "quotes" as Tab,
        label: t("nav.quotes"),
        icon: <FileText className="w-4 h-4" />,
        countBadge: quotesCount > 0 ? quotesCount : undefined,
      },
      {
        id: "history" as Tab,
        label: t("nav.history"),
        icon: <Clock className="w-4 h-4" />,
        countBadge: historyCount > 0 ? historyCount : undefined,
      },
      {
        id: "catalog" as Tab,
        label: t("nav.catalog"),
        icon: <Warehouse className="w-4 h-4" />,
        countBadge: lowSpoolCount > 0 ? lowSpoolCount : undefined,
        subItems: [
          {
            id: "catalog" as Tab,
            label: t("nav.workshopSubPrinters"),
          },
          {
            id: "inventory" as Tab,
            label: t("nav.workshopSubInventory"),
            countBadge: lowSpoolCount > 0 ? lowSpoolCount : undefined,
          },
          {
            id: "marketplace" as Tab,
            label: t("nav.workshopSubMarketplace"),
          },
        ],
      },
    ],
    [t, quotesCount, historyCount, lowSpoolCount],
  );

  useEffect(() => {
    if (typeof mainRef.current?.scrollTo === "function") {
      mainRef.current.scrollTo(0, 0);
    }
  }, [activeTab, layoutMode]);

  // Initialize channel-specific data, stable defaults, tutorial, and shared URLs.
  useAppInit(setActiveTab);

  // Auto-collapse sidebar on resolutions < 1280px (responsive behavior)
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1280) {
        setSidebarCollapsed(true);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Modals state
  const [isMiniDashOpen, setIsMiniDashOpen] = useState(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [quoteSeed, setQuoteSeed] = useState<StudioQuoteModalSeed | null>(null);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [whatsAppData, setWhatsAppData] = useState<
    StudioWhatsAppModalInitialData | undefined
  >(undefined);

  const openQuoteModalWithSeed = (seed?: StudioQuoteModalSeed) => {
    setQuoteSeed(seed ?? null);
    setIsQuoteModalOpen(true);
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Global Command Palette (Ctrl+K / Cmd+K) works from anywhere
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
        return;
      }

      // Cycle Workspace Display Width (Alt+W) works from anywhere
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === "w") {
        e.preventDefault();
        cycleWorkspaceWidth();
        return;
      }

      // Don't trigger single-key shortcuts inside inputs or textareas
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        setIsMiniDashOpen((prev) => !prev);
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        setFocusMode((prev) => !prev);
      } else if (e.key === "?") {
        e.preventDefault();
        setIsShortcutsOpen(true);
      } else if (e.key === "Escape") {
        setIsCommandPaletteOpen(false);
        setIsMiniDashOpen(false);
        setIsCopilotOpen(false);
        setIsShortcutsOpen(false);
        setIsQuoteModalOpen(false);
        setIsWhatsAppModalOpen(false);
        if (focusMode) setFocusMode(false);
      } else if (e.key === "1") {
        setActiveTab("calculator");
      } else if (e.key === "2") {
        setActiveTab("dashboard");
      } else if (e.key === "3") {
        setActiveTab("catalog");
      } else if (e.key === "4") {
        setActiveTab("inventory");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [focusMode, cycleWorkspaceWidth]);

  const containerWidthClass = focusMode
    ? "max-w-[84rem] mx-auto w-full"
    : WORKSPACE_CONTAINER_CLASSES[workspaceWidth];
  const mainPaddingClass = focusMode
    ? "p-4 sm:p-6 lg:p-8"
    : WORKSPACE_MAIN_PADDING[workspaceWidth];

  return (
    <div
      data-workspace-width={workspaceWidth}
      className={`${isBetaChannel ? "min-h-screen" : "h-dvh overflow-hidden"} bg-surface-canvas text-text-primary flex flex-col font-sans selection:bg-[var(--color-accent-fill)] selection:text-[var(--color-accent-fill-fg)]`}
    >
      {/* Global guard feedback must survive focus mode, which removes the chrome. */}
      <DemoExportBlockedToast focusMode={focusMode} />

      {/* Top Header */}
      {!focusMode && (
        <>
          <StudioHeader
            activeTab={activeTab}
            onTabChange={setActiveTab}
            activeTechnology={activeTechnology}
            onOpenQuoteModal={() => openQuoteModalWithSeed()}
            onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
            onOpenWhatsAppModal={() => {
              setWhatsAppData({
                projectName: currentProjectName || "Projeto 3D",
              });
              setIsWhatsAppModalOpen(true);
            }}
            currentProjectName={currentProjectName}
          />
          <DemoModeIndicator />
          <PrivacyOnboarding />
        </>
      )}

      {/* Main Workspace with Sidebar */}
      <div
        className={`flex-1 flex w-full relative ${
          isBetaChannel ? "" : "min-h-0 overflow-hidden"
        }`}
      >
        {/* Left Navigation Sidebar */}
        {!focusMode && (
          <StudioSidebar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
            modules={sidebarModuleOverrides}
          />
        )}

        {/* Main Content Area */}
        <main
          ref={mainRef}
          className={`flex-1 min-w-0 ${mainPaddingClass} ${
            isBetaChannel ? "" : "min-h-0 overflow-y-auto overscroll-y-contain"
          } ${containerWidthClass}`}
        >
          {/* Focus mode exit banner. */}
          {focusMode && (
            <div className="mb-4 flex items-center justify-between p-2.5 rounded-xl bg-accent-subtle border border-accent/40 text-xs">
              <span className="text-accent font-semibold">
                Modo Foco Ativo • Visualização maximizada para produção
              </span>
              <button
                onClick={() => setFocusMode(false)}
                className="px-3 py-1 rounded-lg bg-[var(--color-accent-fill)] hover:ring-2 hover:ring-accent/40 text-[var(--color-accent-fill-fg)] font-bold"
              >
                Sair do Modo Foco (Esc)
              </button>
            </div>
          )}

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={isWorkshopRoute(activeTab) ? "workshop" : activeTab}
              initial={prefersReduced ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReduced ? { opacity: 1 } : { opacity: 0, y: -6 }}
              transition={{
                duration: prefersReduced ? 0 : 0.16,
                ease: "easeOut",
              }}
            >
              {activeTab === "dashboard" && (
                <StudioDashboardView
                  onTabChange={setActiveTab}
                  onOpenCopilot={() => setIsCopilotOpen(true)}
                />
              )}

              {activeTab === "calculator" && (
                <>
                  <StudioCalculatorModeSelector
                    mode={layoutMode}
                    onModeChange={setLayoutMode}
                  />
                  <CalculatorSurface
                    onManagePrinters={() => setActiveTab("catalog")}
                  />
                </>
              )}

              {(activeTab === "catalog" ||
                activeTab === "inventory" ||
                activeTab === "marketplace") && (
                <WorkshopHub activeTab={activeTab} onTabChange={setActiveTab} />
              )}

              {activeTab === "history" && (
                <StudioHistoryView
                  onTabChange={setActiveTab}
                  onOpenQuoteModal={openQuoteModalWithSeed}
                />
              )}

              {activeTab === "infill" && (
                <div className="mx-auto w-full bg-surface-raised/0 pb-20">
                  <InfillCalculator
                    onApplyInfill={(pct) => {
                      useCalculatorStore.getState().setInfillPercent(pct);
                      setActiveTab("calculator");
                    }}
                  />
                </div>
              )}

              {activeTab === "customers" && (
                <StudioCustomerView
                  onTabChange={setActiveTab}
                  onOpenQuoteModal={openQuoteModalWithSeed}
                />
              )}

              {activeTab === "quotes" && (
                <StudioQuotesView
                  onTabChange={setActiveTab}
                  onOpenNewQuote={() => openQuoteModalWithSeed()}
                />
              )}

              {activeTab === "products" && (
                <StudioProductsView
                  onTabChange={setActiveTab}
                  onOpenQuoteModal={openQuoteModalWithSeed}
                />
              )}

              {activeTab === "wiki" && (
                <div className="w-full mx-auto pb-10">
                  <WikiPage />
                </div>
              )}

              {activeTab === "changelog" && (
                <div className="w-full mx-auto pb-10">
                  <ChangelogPage />
                </div>
              )}

              {activeTab === "privacy" && !isBetaChannel && (
                <div className="w-full mx-auto pb-10">
                  <PrivacyScreen />
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Floating Bottom Cockpit Dock */}
      {!focusMode && (
        <StudioCockpitDock
          onOpenMiniDash={() => setIsMiniDashOpen(true)}
          onToggleFocusMode={() => setFocusMode(!focusMode)}
          onOpenShortcuts={() => setIsShortcutsOpen(true)}
          onTabChange={setActiveTab}
          onOpenCopilot={() => setIsCopilotOpen(true)}
          onOpenNewQuote={() => openQuoteModalWithSeed()}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        />
      )}

      {/* Modals & Overlays */}
      <StudioCommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenQuoteModal={() => openQuoteModalWithSeed()}
        onOpenWhatsAppModal={() => {
          setWhatsAppData({
            projectName: currentProjectName || "Projeto 3D",
          });
          setIsWhatsAppModalOpen(true);
        }}
        onOpenCopilot={() => setIsCopilotOpen(true)}
        onOpenMiniDash={() => setIsMiniDashOpen(true)}
        onToggleFocusMode={() => setFocusMode((prev) => !prev)}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
      />

      <StudioMiniDashOverlay
        isOpen={isMiniDashOpen}
        onClose={() => setIsMiniDashOpen(false)}
        onTabChange={setActiveTab}
      />

      <StudioCopilotModal
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
        projectName={currentProjectName || "Peça 3D"}
      />

      <StudioShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      <StudioQuoteModal
        isOpen={isQuoteModalOpen}
        onClose={() => {
          setIsQuoteModalOpen(false);
          setQuoteSeed(null);
        }}
        projectName={
          quoteSeed?.projectName ?? (currentProjectName || "Peça 3D")
        }
        material={
          quoteSeed?.material ??
          (activeTechnology === "fdm"
            ? fdmMaterial?.type || "PLA"
            : resinMaterial?.type || "Resina")
        }
        weightGrams={
          quoteSeed?.weightGrams ??
          (activeTechnology === "fdm"
            ? fdmMaterial?.weightUsed
            : resinMaterial?.volumeUsedMl)
        }
        hours={
          quoteSeed?.hours ??
          Math.floor(
            activeTechnology === "fdm"
              ? (fdmPrintParams?.printTimeHours ?? 0)
              : (resinPrintParams?.printTimeHours ?? 0),
          )
        }
        minutes={
          quoteSeed?.minutes ??
          Math.round(
            ((activeTechnology === "fdm"
              ? (fdmPrintParams?.printTimeHours ?? 0)
              : (resinPrintParams?.printTimeHours ?? 0)) %
              1) *
              60,
          )
        }
        totalCost={quoteSeed?.totalCost ?? currentResults?.totalCost}
        sellPrice={quoteSeed?.sellPrice ?? currentResults?.sellPrice}
        profit={quoteSeed?.profit ?? currentResults?.profit}
        initialCustomerId={quoteSeed?.initialCustomerId}
      />

      <StudioWhatsAppModal
        isOpen={isWhatsAppModalOpen}
        onClose={() => setIsWhatsAppModalOpen(false)}
        initialData={whatsAppData}
      />
    </div>
  );
};
