import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { ToastContainer } from "@/shared/components/ui/Toast";
import { useCurrency } from "@/shared/hooks/useCurrency";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { useCatalogStore } from "@/shared/stores/catalogStore";
import { useFilamentInventory } from "@/shared/stores/filamentInventory";
import { useShallow } from "zustand/react/shallow";
import { useKeyboardShortcuts } from "@/shared/hooks/useKeyboardShortcuts";
import { QuickStartBanner } from "@/shared/components/ui/QuickStartBanner";
import { ResultsPanel } from "./ResultsPanel";
import { TechToggle } from "./TechToggle";
import { LevelToggle } from "./LevelToggle";
import { ProductName } from "./ProductName";
import { SectionNav } from "./SectionNav";
import { SectionRenderer } from "./SectionRenderer";
import { MobileBottomBar } from "./MobileBottomBar";

export function Calculator() {
	const { t } = useTranslation()
  const undo = useCalculatorStore((s) => s.undo)

  useKeyboardShortcuts([
    { key: 'z', ctrl: true, handler: () => undo(), description: 'Desfazer' },
    { key: 'e', ctrl: true, handler: () => (document.querySelector('[data-shortcut="export"]') as HTMLElement)?.click(), description: 'Exportar' },
    { key: 'p', ctrl: true, handler: () => window.print(), description: 'Imprimir' },
  ]);
	const store = useCalculatorStore();

	const { printers: catalogPrinters, materials: catalogMaterials } = useCatalogStore(
		useShallow((s) => ({ printers: s.printers, materials: s.materials })),
	);
	const inventorySpools = useFilamentInventory((s) => s.spools);
	const [showSpoolSelector, setShowSpoolSelector] = useState(false);

	const [activeSection, setActiveSection] = useState("material");
	const [toastItems, setToastItems] = useState<
		{ id: number; message: string; type: "error" | "success" | "info" }[]
	>([]);

	const dismissToast = (id: number) => {
		setToastItems((prev) => prev.filter((t) => t.id !== id));
	};

	const isFDM = store.activeTab === "fdm";
	const { symbol: currencySymbol } = useCurrency();

	const handlePrinterSelect = (id: string) => {
		const p = catalogPrinters.find((p) => p.id === id);
		if (p) {
			store.setSelectedPrinter(
				p as Parameters<typeof store.setSelectedPrinter>[0],
			);
			store.setFdmPrintParams({
				...store.fdmPrintParams,
				printerPowerWatts: p.power,
			});
			store.setFdmMachine({ ...store.fdmMachine, machineCost: p.value });
		}
	};

	const handleInput = useCallback(
		(value: string, setter: (v: number) => void) => {
			setter(value === "" ? 0 : parseFloat(value) || 0);
		},
		[],
	);

	const results = store.results;

	if (!results) {
		return (
			<div className="flex items-center justify-center py-20">
				<div className="text-[var(--color-text-muted)] text-sm">{t('common.loading')}</div>
			</div>
		);
	}

	return (
		<>
			<ToastContainer items={toastItems} onDismiss={dismissToast} />
			<h1 className="sr-only">{t('nav.calculator')}</h1>
			<div className="flex gap-5 xl:gap-8 pb-[220px] lg:pb-0">
				<SectionNav activeSection={activeSection} onSectionClick={setActiveSection} />
				<div className="flex-1 min-w-0 space-y-5">
					<QuickStartBanner />
						<div className="flex flex-wrap items-center gap-2 sm:gap-3 py-1">
						<TechToggle />
						<LevelToggle />
					</div>
					<ProductName />
					<SectionRenderer
						t={t}
						currencySymbol={currencySymbol}
						handleInput={handleInput}
						isFDM={isFDM}
						showSpoolSelector={showSpoolSelector}
						setShowSpoolSelector={setShowSpoolSelector}
						inventorySpools={inventorySpools}
						catalogMaterials={catalogMaterials}
						catalogPrinters={catalogPrinters}
						handlePrinterSelect={handlePrinterSelect}
					/>
				</div>
				<div data-tutorial="results-sidebar" className="hidden lg:flex flex-col gap-5 w-[320px] xl:w-[360px] shrink-0 sticky top-[92px] self-start max-h-[calc(100vh-120px)] overflow-y-auto">
					<ResultsPanel variant="sidebar" />
				</div>
			</div>
			<MobileBottomBar activeSection={activeSection} onSectionClick={setActiveSection} />
		</>
	);
}
