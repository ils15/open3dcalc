import { WorkshopHub } from "@/shared/components/Catalog/WorkshopHub";
import { HistoryTab } from "@/shared/components/Calculator/HistoryTab/HistoryTab";
import { Dashboard } from "@/shared/components/Dashboard/Dashboard";
import { ChangelogPage } from "@/shared/components/Changelog/ChangelogPage";
import { WikiPage } from "@/shared/components/Wiki/WikiPage";
import { InfillCalculator } from "@/shared/components/Calculator/InfillCalculator";
import { CustomerTab } from "@/shared/components/Catalog/CustomerTab";
import { StudioQuotesView } from "@/platform/web/components/studio/StudioQuotesView";
import { StudioProductsView } from "@/platform/web/components/studio/StudioProductsView";
import { PrivacyScreen } from "@/shared/components/Privacy/PrivacyScreen";
import { CalculatorSurface } from "@/shared/components/Calculator/surfaces/CalculatorSurface";
import { isWorkshopRoute, type Tab } from "./tabs";

/**
 * The tab → surface switch shared by both platforms (V2.0 Wave 1).
 *
 * The calculator branch is the single layout switch point: it renders
 * CalculatorSurface, which picks the classic/guided/bento surface from the
 * layout store. Every other tab renders its surface directly.
 */
interface MainContentProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  /** Called when HistoryTab loads an item back into the calculator. */
  onSelectCalculator: () => void;
  /** Opens the printer catalog from the Guided calculator. */
  onManagePrinters?: () => void;
}

export function MainContent({
  activeTab,
  onTabChange,
  onSelectCalculator,
  onManagePrinters,
}: MainContentProps): React.ReactElement {
  const isWorkshop = isWorkshopRoute(activeTab);

  return (
    <>
      {activeTab === "calculator" && (
        <CalculatorSurface onManagePrinters={onManagePrinters} />
      )}
      {activeTab === "dashboard" && <Dashboard />}
      {activeTab === "infill" && <InfillCalculator />}
      {isWorkshop && (
        <WorkshopHub activeTab={activeTab} onTabChange={onTabChange} />
      )}
      {activeTab === "history" && (
        <HistoryTab onLoadToCalculator={onSelectCalculator} />
      )}
      {activeTab === "changelog" && <ChangelogPage />}
      {activeTab === "wiki" && <WikiPage />}
      {activeTab === "quotes" && <StudioQuotesView />}
      {activeTab === "customers" && <CustomerTab />}
      {activeTab === "products" && <StudioProductsView />}
      {activeTab === "privacy" && <PrivacyScreen />}
    </>
  );
}
