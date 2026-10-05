import React, { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Tab } from "@/shared/components/AppShell/tabs";
import { useLayoutStore } from "@/shared/stores/layoutStore";
import { StudioHeader } from "./StudioHeader";
import { StudioSubHeader } from "./StudioSubHeader";
import { StudioSidebar } from "./StudioSidebar";
import { StudioCockpitDock } from "./StudioCockpitDock";
import { StudioDashboardView } from "./StudioDashboardView";
import { StudioCalculatorView } from "./StudioCalculatorView";
import { StudioSpoolView } from "./StudioSpoolView";
import { StudioMiniDashOverlay } from "./StudioMiniDashOverlay";
import { StudioCopilotModal } from "./StudioCopilotModal";
import { StudioShortcutsModal } from "./StudioShortcutsModal";
import { StudioQuoteModal } from "./StudioQuoteModal";
import { StudioHistoryView } from "./StudioHistoryView";
import { StudioCustomerView } from "./StudioCustomerView";
import { StudioQuotesView } from "./StudioQuotesView";
import { StudioProductsView } from "./StudioProductsView";

// Existing shared surfaces for remaining tabs
import { InfillCalculator } from "@/shared/components/Calculator/InfillCalculator";
import { CatalogTab } from "@/shared/components/Catalog/CatalogTab";
import { MarketplaceBrowseTab } from "@/shared/components/Catalog/MarketplaceBrowseTab";
import { WikiPage } from "@/shared/components/Wiki/WikiPage";
import { ChangelogPage } from "@/shared/components/Changelog/ChangelogPage";
import { PrivacyScreen } from "@/shared/components/Privacy/PrivacyScreen";
import { BentoSurface } from "@/shared/components/Calculator/surfaces/BentoSurface";
import { GuidedSurface } from "@/shared/components/Calculator/surfaces/GuidedSurface";
import { DemoModeIndicator } from "@/shared/components/DemoMode/DemoModeIndicator";
import { DemoExportBlockedToast } from "@/shared/components/DemoMode/DemoExportBlockedToast";
import { useAppInit } from "@/shared/hooks/useAppInit";
import { useReducedMotion } from "@/shared/hooks/useReducedMotion";
import { PrivacyOnboarding } from "@/shared/components/Privacy/PrivacyOnboarding";
import { LegacyMigrationPrompt } from "@/shared/components/Privacy/LegacyMigrationPrompt";
import { PiiLockedShell } from "@/shared/components/Privacy/PiiLockedShell";

export const StudioLayout: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>("calculator");
  const needsCockpitBottomInset =
    activeTab === "catalog" || activeTab === "marketplace";
  // `layoutMode` is SHARED state, not local. It used to be a local `useState`,
  // which meant `useLayoutStore` kept reporting its `"classic"` default no matter
  // what the user picked here — so `useAppInit`'s first-visit tutorial guard
  // (`useLayoutStore.getState().layoutMode !== "classic"`) could never reject,
  // and the layout preference was never persisted or readable from anywhere
  // else. Reading and writing the store makes both guards honest.
  const layoutMode = useLayoutStore((state) => state.layoutMode);
  const setLayoutMode = useLayoutStore((state) => state.setLayoutMode);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth < 1280;
    }
    return false;
  });
  const prefersReduced = useReducedMotion();
  const [focusMode, setFocusMode] = useState(false);
  const [currency, setCurrency] = useState("BRL");

  // Demo mode templates: 'fdm' or 'resin'
  const [demoTemplate, setDemoTemplate] = useState<"fdm" | "resin">("fdm");
  const [currentProjectName, setCurrentProjectName] = useState("");

  // Initialize app bootstrap (legacy migrations, PII hydrations, tutorial, URL shared calculations)
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

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts inside inputs or textareas
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
        setIsMiniDashOpen(false);
        setIsCopilotOpen(false);
        setIsShortcutsOpen(false);
        setIsQuoteModalOpen(false);
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
  }, [focusMode]);

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] flex flex-col font-sans selection:bg-[var(--color-accent-muted)] selection:text-[var(--color-text-primary)]">
      {/* Global guard feedback must survive focus mode, which removes the chrome. */}
      <DemoExportBlockedToast focusMode={focusMode} />

      {/* Top Header */}
      {!focusMode && (
        <>
          <StudioHeader
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onOpenCopilot={() => setIsCopilotOpen(true)}
            demoTemplate={demoTemplate}
            onSelectDemoTemplate={setDemoTemplate}
            currentProjectName={currentProjectName}
          />
          <StudioSubHeader
            activeTab={activeTab}
            onTabChange={setActiveTab}
            layoutMode={layoutMode}
            onLayoutChange={setLayoutMode}
            currency={currency}
            onCurrencyChange={setCurrency}
            focusMode={focusMode}
            onToggleFocusMode={() => setFocusMode(!focusMode)}
            onOpenMiniDash={() => setIsMiniDashOpen(true)}
            onOpenCopilot={() => setIsCopilotOpen(true)}
            onOpenShortcuts={() => setIsShortcutsOpen(true)}
            onOpenQuoteModal={() => setIsQuoteModalOpen(true)}
          />
          <DemoModeIndicator />
          <PrivacyOnboarding />
          <LegacyMigrationPrompt />
          <PiiLockedShell />
        </>
      )}

      {/* Main Workspace with Sidebar */}
      <div className="flex-1 flex w-full relative">
        {/* Left Navigation Sidebar */}
        {!focusMode && (
          <StudioSidebar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
            currency={currency}
            onCurrencyChange={setCurrency}
          />
        )}

        {/* Main Content Area */}
        <main
          className={`flex-1 min-w-0 p-4 sm:p-6 lg:p-8 ${needsCockpitBottomInset ? "pb-24 sm:pb-24 lg:pb-24" : ""} ${focusMode ? "max-w-7xl mx-auto" : ""}`}
        >
          {/* Focus mode exit banner */}
          {focusMode && (
            <div className="mb-4 flex items-center justify-between p-2.5 rounded-xl bg-purple-950/40 border border-purple-500/40 text-xs">
              <span className="text-purple-300 font-semibold">
                Modo Foco Ativo • Visualização maximizada para produção
              </span>
              <button
                onClick={() => setFocusMode(false)}
                className="px-3 py-1 rounded-lg bg-purple-600 hover:ring-2 hover:ring-purple-500/40 text-white font-bold"
              >
                Sair do Modo Foco (Esc)
              </button>
            </div>
          )}

          {/* Tab Views.
              Without a transition the previous view is torn out of the DOM and
              the next one appears in the same frame: a hard cut that reads as
              a flicker. `framer-motion` is already a dependency (Tutorial uses
              it), so this adds no new one. Keying the wrapper on `activeTab`
              is what gives AnimatePresence a child to exit — the individual
              `activeTab === …` blocks below stay exactly as they were. */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeTab}
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
                  {layoutMode === "bento" ? (
                    <BentoSurface />
                  ) : layoutMode === "guided" ? (
                    <GuidedSurface />
                  ) : (
                    <StudioCalculatorView
                      onOpenCopilot={() => setIsCopilotOpen(true)}
                      onOpenQuoteModal={() => setIsQuoteModalOpen(true)}
                      demoTemplate={demoTemplate}
                      onSelectDemoTemplate={setDemoTemplate}
                      onProjectNameChange={setCurrentProjectName}
                      onTabChange={setActiveTab}
                    />
                  )}
                </>
              )}

              {activeTab === "inventory" && (
                <StudioSpoolView onTabChange={setActiveTab} />
              )}

              {activeTab === "catalog" && (
                <div className="flex max-w-full flex-col gap-6 text-[var(--color-text-primary)]">
                  <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-5">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-accent)] animate-pulse" />
                      <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-accent)] font-bold">
                        PARÂMETROS DE PRODUÇÃO & TAXAS
                      </span>
                    </div>
                    <h1 className="text-xl font-bold tracking-tight text-[var(--color-text-primary)]">
                      Cadastros Gerais da Oficina
                    </h1>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                      Gerenciamento de impressoras 3D, especificações de
                      materiais e taxas de marketplaces
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-6">
                    <CatalogTab />
                  </div>
                </div>
              )}

              {activeTab === "marketplace" && <MarketplaceBrowseTab />}

              {activeTab === "history" && (
                <StudioHistoryView
                  onTabChange={setActiveTab}
                  onOpenQuoteModal={() => setIsQuoteModalOpen(true)}
                />
              )}

              {activeTab === "infill" && (
                <div className="flex flex-col gap-6 text-slate-100 max-w-full pb-20">
                  <div className="bg-[#0c111e] border border-[#1b253b] rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                      <span className="text-[10px] font-mono uppercase tracking-wider text-blue-400 font-bold">
                        GEOMETRIA & DENSIDADE VOLUMÉTRICA
                      </span>
                    </div>
                    <h1 className="text-xl font-bold tracking-tight text-white">
                      Calculadora de Preenchimento (Infill)
                    </h1>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Simulação de consumo volumétrico, economia de filamento e
                      tempo por padrão de infill
                    </p>
                  </div>
                  <div className="bg-[#0c111e] border border-[#1b253b] rounded-2xl p-6">
                    <InfillCalculator />
                  </div>
                </div>
              )}

              {activeTab === "customers" && (
                <StudioCustomerView
                  onTabChange={setActiveTab}
                  onOpenQuoteModal={() => setIsQuoteModalOpen(true)}
                />
              )}

              {activeTab === "quotes" && (
                <StudioQuotesView onTabChange={setActiveTab} />
              )}

              {activeTab === "products" && (
                <StudioProductsView onTabChange={setActiveTab} />
              )}

              {activeTab === "wiki" && (
                <div className="max-w-5xl mx-auto">
                  <WikiPage />
                </div>
              )}

              {activeTab === "changelog" && (
                <div className="max-w-4xl mx-auto">
                  <ChangelogPage />
                </div>
              )}

              {activeTab === "privacy" && (
                <div className="max-w-4xl mx-auto">
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
          onOpenNewQuote={() => setIsQuoteModalOpen(true)}
        />
      )}

      {/* Modals & Overlays */}
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
        onClose={() => setIsQuoteModalOpen(false)}
        projectName={currentProjectName || "Peça 3D"}
      />
    </div>
  );
};
