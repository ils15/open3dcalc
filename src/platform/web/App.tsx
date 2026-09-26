import { useEffect } from "react";
import { Header } from "@/shared/components/Header/Header";
import { DemoModeIndicator } from "@/shared/components/DemoMode/DemoModeIndicator";
import { DemoExportBlockedToast } from "@/shared/components/DemoMode/DemoExportBlockedToast";
import { PrivacyBanner } from "@/shared/components/ui/PrivacyBanner";
import { Tutorial } from "@/shared/components/ui/Tutorial";
import { AppShell } from "@/shared/components/AppShell/AppShell";
import { useAppInit } from "@/shared/hooks/useAppInit";
import { useLayoutStore } from "@/shared/stores/layoutStore";
import { useTutorialStore } from "@/shared/stores/tutorialStore";
import {
  useActiveTab,
  useFocusMode,
  useNavigateToTab,
} from "@/shared/components/AppShell/NavigationContext";
import { NavigationProvider } from "@/shared/components/AppShell/NavigationProvider";
import { PreferenceProvider } from "@/shared/contexts/PreferenceProvider";
import { SecondaryNavigation } from "./SecondaryNavigation";
import { MobileNav } from "./components/MobileNav";
import { Footer } from "./components/Footer";

// The TABS contract is re-exported here so tabsParity.test keeps locking the
// web/desktop/tutorial sets together after the array moved into AppShell.
export { TABS } from "@/shared/components/AppShell/tabs";

function App(): React.ReactElement {
  return (
    <PreferenceProvider>
      <NavigationProvider>
        <AppContent />
      </NavigationProvider>
    </PreferenceProvider>
  );
}

function AppContent(): React.ReactElement {
  const activeTab = useActiveTab();
  const navigateToTab = useNavigateToTab();
  const { active: focusMode } = useFocusMode();

  useAppInit(navigateToTab);
  const layoutMode = useLayoutStore((state) => state.layoutMode);

  // Classic is the only surface with these tour anchors. A tour pointing to a
  // missing control is worse than no tour; Guided is already its own experience.
  useEffect(() => {
    if (layoutMode !== "classic" && useTutorialStore.getState().isActive) {
      useTutorialStore.getState().skipTutorial();
    }
  }, [layoutMode]);

  return (
    <div className="min-h-dvh flex flex-col overflow-x-clip">
      {/* Focus Mode (Phase 7o s4) takes the header, the mobile bar and the
          footer away — they are the chrome, and the stage's own exit bar takes
          their place. The indicators, banners and the tutorial are NOT chrome:
          a consent or a download must never be hidden by a focus state, so
          they stay mounted and the mode simply draws over them. */}
      {!focusMode && <Header />}
      <DemoModeIndicator />
      <DemoExportBlockedToast />
      <PrivacyBanner />

      <div className="flex flex-1 w-full max-w-[1600px] 2xl:max-w-[1920px] mx-auto overflow-x-clip">
        <AppShell
          activeTab={activeTab}
          onTabChange={navigateToTab}
          sidebarFooter={
            <SecondaryNavigation desktop onInternalNavigate={navigateToTab} />
          }
          skipLink={
            <a
              href="#main"
              className="skip-link"
              aria-label="Pular para o conteúdo principal"
            >
              Pular para o conteúdo
            </a>
          }
          mainId="main"
          mainClassName="flex-1 min-w-0 px-6 sm:px-8 lg:px-10 xl:px-14 py-8 sm:py-10 pb-32 lg:pb-10"
          // Same rhythm without the fixed bottom bar's reserve, and wider
          // gutters now that there is no sidebar to sit beside.
          mainFocusClassName="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-10"
        />
      </div>

      {!focusMode && (
        <MobileNav activeTab={activeTab} onTabChange={navigateToTab} />
      )}
      {!focusMode && <Footer onInternalNavigate={navigateToTab} />}

      {layoutMode === "classic" && <Tutorial />}
    </div>
  );
}

export default App;
