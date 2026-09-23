import { useState } from "react";
import { Header } from "@/shared/components/Header/Header";
import { DemoModeIndicator } from "@/shared/components/DemoMode/DemoModeIndicator";
import { DemoExportBlockedToast } from "@/shared/components/DemoMode/DemoExportBlockedToast";
import { PrivacyBanner } from "@/shared/components/ui/PrivacyBanner";
import { Tutorial } from "@/shared/components/ui/Tutorial";
import { AppShell } from "@/shared/components/AppShell/AppShell";
import { useAppInit } from "@/shared/hooks/useAppInit";
import type { Tab } from "@/shared/components/AppShell/tabs";
import { SecondaryNavigation } from "./SecondaryNavigation";
import { MobileNav } from "./components/MobileNav";
import { Footer } from "./components/Footer";

// The TABS contract is re-exported here so tabsParity.test keeps locking the
// web/desktop/tutorial sets together after the array moved into AppShell.
export { TABS } from "@/shared/components/AppShell/tabs";

function App() {
  const [activeTab, setActiveTab] = useState<Tab>("calculator");

  useAppInit(setActiveTab);

  return (
    <div className="min-h-dvh flex flex-col overflow-x-clip">
      <Header />
      <DemoModeIndicator />
      <DemoExportBlockedToast />
      <PrivacyBanner />

      <div className="flex flex-1 w-full max-w-[1600px] 2xl:max-w-[1920px] mx-auto overflow-x-clip">
        <AppShell
          activeTab={activeTab}
          onTabChange={setActiveTab}
          sidebarFooter={
            <SecondaryNavigation
              desktop
              onInternalNavigate={setActiveTab}
            />
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
        />
      </div>

      <MobileNav activeTab={activeTab} onTabChange={setActiveTab} />
      <Footer onInternalNavigate={setActiveTab} />

      <Tutorial />
    </div>
  );
}

export default App;
