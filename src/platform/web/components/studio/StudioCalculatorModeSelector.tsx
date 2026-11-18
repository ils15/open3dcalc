import { useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import {
  Check,
  FileText,
  GitCompareArrows,
  Layers,
  LayoutGrid,
  ListOrdered,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  X,
  Zap,
} from "lucide-react";

import { useCurrency } from "@/shared/hooks/useCurrency";
import {
  CALCULATOR_PRESETS,
  type CalculatorPresetId,
} from "@/shared/lib/calculatorPresets";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import type { LayoutMode } from "@/shared/stores/layoutStore";
import { useQuoteStore } from "@/shared/stores/quoteStore";
import {
  computeEffectiveMarginPercent,
  computeScenarioDeltas,
  useScenarioComparisonStore,
} from "@/shared/stores/scenarioComparisonStore";
import { useWizardStore } from "@/shared/stores/wizardStore";

interface StudioCalculatorModeSelectorProps {
  mode: LayoutMode;
  onModeChange: (mode: LayoutMode) => void;
}

/**
 * Calculator Workbench Control Deck.
 * Combines layout mode switching (Clássico / Bento / Guiado), 1-click quick
 * calculation presets, example/reset actions, and a live A/B scenario
 * comparator strip without altering the calculator's internal focus order.
 */
export function StudioCalculatorModeSelector({
  mode,
  onModeChange,
}: StudioCalculatorModeSelectorProps): ReactElement {
  const { t, i18n } = useTranslation();
  const isEn = Boolean(i18n?.language?.startsWith("en"));
  const { format: formatCurrency } = useCurrency();

  const results = useCalculatorStore((state) => state.results);
  const lastAppliedPresetId = useCalculatorStore(
    (state) => state.lastAppliedPresetId,
  );
  const applyCalculatorPreset = useCalculatorStore(
    (state) => state.applyCalculatorPreset,
  );
  const setQuickStart = useCalculatorStore((state) => state.setQuickStart);
  const resetCalculator = useCalculatorStore((state) => state.resetCalculator);

  const pinnedScenario = useScenarioComparisonStore(
    (state) => state.pinnedScenario,
  );
  const pinFromCalculator = useScenarioComparisonStore(
    (state) => state.pinFromCalculator,
  );
  const clearPinnedScenario = useScenarioComparisonStore(
    (state) => state.clearPinnedScenario,
  );
  const [abQuoteSaved, setAbQuoteSaved] = useState(false);

  const tr = (key: string, ptFallback: string, enFallback: string): string => {
    const resolved = t(key);
    if (resolved && resolved !== key) return resolved;
    return isEn ? enFallback : ptFallback;
  };

  const handleCreateAbQuote = () => {
    if (!pinnedScenario || !results) return;
    const calcState = useCalculatorStore.getState();
    const isResin = calcState.activeTab === "resin";
    const currentMaterial = isResin
      ? `${calcState.resinMaterial.type} · ${calcState.resinMaterial.volumeUsedMl}ml`
      : `${calcState.fdmMaterial.type} · ${calcState.fdmMaterial.weightUsed}g`;
    const currentLabel =
      calcState.productName.trim() || currentMaterial;
    const qtyA = Math.max(1, pinnedScenario.quantity || 1);
    const qtyB = Math.max(1, calcState.quantity || 1);

    useQuoteStore.getState().addQuote({
      title: isEn
        ? `A/B Comparison: ${pinnedScenario.label}`
        : `Comparativo A/B: ${pinnedScenario.label}`,
      items: [
        {
          historyEntryId: "ab-baseline",
          name: isEn
            ? `Option A (Baseline): ${pinnedScenario.label} (${pinnedScenario.materialSummary} · ${pinnedScenario.infillPercent}% infill)`
            : `Opção A (Base): ${pinnedScenario.label} (${pinnedScenario.materialSummary} · ${pinnedScenario.infillPercent}% infill)`,
          quantity: qtyA,
          unitPrice: Number((pinnedScenario.sellPrice / qtyA).toFixed(2)),
          discountPercent: 0,
        },
        {
          historyEntryId: "ab-current",
          name: isEn
            ? `Option B (Alternative): ${currentLabel} (${currentMaterial} · ${calcState.infillPercent}% infill)`
            : `Opção B (Alternativa): ${currentLabel} (${currentMaterial} · ${calcState.infillPercent}% infill)`,
          quantity: qtyB,
          unitPrice: Number((results.sellPrice / qtyB).toFixed(2)),
          discountPercent: 0,
        },
      ],
      globalDiscountPercent: 0,
      status: "draft",
      validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10),
      paymentTerms: isEn
        ? "50% upfront, 50% on delivery"
        : "50% na aprovação, 50% na entrega",
      deliveryEstimate: isEn ? "3–5 business days" : "3 a 5 dias úteis",
      footerNote: isEn
        ? "Comparative quote with two production options (A vs. B)."
        : "Orçamento comparativo com duas opções de produção (A vs. B).",
    });
    setAbQuoteSaved(true);
    setTimeout(() => setAbQuoteSaved(false), 2500);
  };

  const syncWizardIfGuided = (action: "reseed" | "reset") => {
    if (mode !== "guided") return;
    const wiz = useWizardStore.getState();
    wiz.reset();
    if (action === "reseed") {
      wiz.start();
    }
  };

  const handleApplyPreset = (presetId: CalculatorPresetId) => {
    applyCalculatorPreset(presetId);
    syncWizardIfGuided("reseed");
  };

  const handleQuickStart = () => {
    setQuickStart();
    syncWizardIfGuided("reseed");
  };

  const handleReset = () => {
    resetCalculator();
    syncWizardIfGuided("reset");
  };

  const modes: ReadonlyArray<{
    mode: LayoutMode;
    label: string;
    hint: string;
    icon: ReactElement;
  }> = [
    {
      mode: "classic",
      label: "Clássico",
      hint: tr(
        "studio.modeClassicHint",
        "Formulário técnico completo",
        "Full technical form",
      ),
      icon: <Layers aria-hidden="true" />,
    },
    {
      mode: "bento",
      label: "Bento",
      hint: tr(
        "studio.modeBentoHint",
        "Painel visual compacto",
        "Compact visual grid",
      ),
      icon: <LayoutGrid aria-hidden="true" />,
    },
    {
      mode: "guided",
      label: "Guiado",
      hint: tr(
        "studio.modeGuidedHint",
        "Passo a passo assistido",
        "Step-by-step wizard",
      ),
      icon: <ListOrdered aria-hidden="true" />,
    },
  ];

  const scenarioDeltas =
    pinnedScenario && results
      ? computeScenarioDeltas(pinnedScenario, results)
      : null;

  const currentMarginPercent = results
    ? computeEffectiveMarginPercent(results.sellPrice, results.profit)
    : 0;

  const formatSignedCurrency = (delta: number): string => {
    if (Math.abs(delta) < 0.005) return formatCurrency(0);
    const sign = delta > 0 ? "+" : "-";
    return `${sign}${formatCurrency(Math.abs(delta))}`;
  };

  const formatSignedPp = (deltaPp: number): string => {
    if (Math.abs(deltaPp) < 0.05) return "0.0 pp";
    const sign = deltaPp > 0 ? "+" : "";
    return `${sign}${deltaPp.toFixed(1)} pp`;
  };

  // Full width on purpose: the card must share the calculator grid's left and
  // right edges below it — centering it made the two drift apart on wide
  // viewports.
  return (
    <section className="mb-3.5 flex w-full flex-col gap-2.5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3.5 py-2.5 shadow-[var(--shadow-xs)] sm:px-4">
      {/* Row 1: Mode Selector + Workbench Quick Actions */}
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="hidden sm:flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent-subtle)] border border-[var(--color-border-accent)] text-[var(--color-accent)]">
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xs font-bold text-[var(--color-text-primary)] leading-tight">
              {tr(
                "studio.modeTitle",
                "Visualização da calculadora",
                "Calculator view",
              )}
            </h2>
            <p className="text-[11px] text-[var(--color-text-secondary)] truncate">
              {tr(
                "studio.modeSub",
                "Escolha o fluxo que combina com seu cálculo.",
                "Choose the workflow that fits your calculation.",
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
          <div
            role="group"
            aria-label="Modo da calculadora"
            className="grid w-full grid-cols-3 gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-1 sm:flex sm:w-auto"
          >
            {modes.map(({ mode: option, label, hint, icon }) => {
              const isActive = mode === option;
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={isActive}
                  title={hint}
                  onClick={() => onModeChange(option)}
                  className={`flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] sm:min-w-[6.25rem] sm:px-3.5 sm:text-xs [&_svg]:size-3.5 ${
                    isActive
                      ? "bg-[var(--color-accent-fill)] text-[var(--color-accent-fill-fg)] shadow-sm"
                      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
                  }`}
                >
                  {icon}
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          <div className="hidden sm:flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => pinFromCalculator()}
              disabled={!results}
              aria-pressed={Boolean(pinnedScenario)}
              title={tr(
                "studio.comparePinTitle",
                "Fixar o resultado atual como Cenário A para comparar alterações ao vivo",
                "Pin current result as Scenario A to compare live changes",
              )}
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] disabled:opacity-50 ${
                pinnedScenario
                  ? "border-[var(--color-border-accent)] bg-[var(--color-accent-subtle)] text-[var(--color-accent)]"
                  : "border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              <GitCompareArrows
                className="h-3.5 w-3.5 shrink-0"
                aria-hidden="true"
              />
              <span>
                {pinnedScenario
                  ? tr(
                      "studio.comparePinnedBtn",
                      "Base A Fixada",
                      "Baseline A Pinned",
                    )
                  : tr(
                      "studio.comparePinBtn",
                      "Fixar Cenário Base (A/B)",
                      "Pin Baseline (A/B)",
                    )}
              </span>
            </button>

            <button
              type="button"
              onClick={handleQuickStart}
              title={tr(
                "studio.workbenchFillExampleTitle",
                "Preencher calculadora com exemplo realista",
                "Fill calculator with a realistic sample part",
              )}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            >
              <Sparkles
                className="h-3.5 w-3.5 shrink-0 text-[var(--color-accent)]"
                aria-hidden="true"
              />
              <span>
                {tr("studio.workbenchFillExample", "Exemplo", "Example")}
              </span>
            </button>

            <button
              type="button"
              onClick={handleReset}
              title={tr(
                "studio.workbenchResetTitle",
                "Restaurar todos os valores padrão da calculadora",
                "Restore all default calculator values",
              )}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            >
              <RotateCcw className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{tr("studio.workbenchReset", "Resetar", "Reset")}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Row 2: 1-Click Quick Calculation Presets */}
      <div className="hidden sm:flex sm:flex-row sm:items-center sm:justify-between gap-1.5 border-t border-[var(--color-border)] pt-2">
        <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--color-text-muted)] shrink-0">
          <Zap
            className="h-3.5 w-3.5 text-[var(--color-accent)]"
            aria-hidden="true"
          />
          <span>
            {tr("studio.presetsLabel", "Perfis Rápidos", "Quick Presets")}
          </span>
        </div>

        <div
          role="group"
          aria-label={tr(
            "studio.presetsGroupLabel",
            "Perfis rápidos de cálculo",
            "Quick calculation presets",
          )}
          className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap sm:items-center"
        >
          {CALCULATOR_PRESETS.map((preset) => {
            const isPresetActive = lastAppliedPresetId === preset.id;
            const label = tr(preset.labelKey, preset.ptLabel, preset.enLabel);
            const hint = tr(preset.hintKey, preset.ptHint, preset.enHint);
            return (
              <button
                key={preset.id}
                type="button"
                aria-pressed={isPresetActive}
                title={hint}
                onClick={() => handleApplyPreset(preset.id)}
                className={`flex min-h-11 items-center justify-between gap-2 rounded-xl border px-2.5 py-1.5 text-left text-[11px] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
                  isPresetActive
                    ? "border-[var(--color-border-accent)] bg-[var(--color-accent-subtle)] font-bold text-[var(--color-accent)] shadow-xs"
                    : "border-[var(--color-border)] bg-[var(--color-bg-secondary)] font-semibold text-[var(--color-text-secondary)] hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                <span className="truncate">{label}</span>
                <span
                  className={`hidden xl:inline-block rounded-md px-1.5 py-0.5 font-mono text-[10px] leading-none ${
                    isPresetActive
                      ? "bg-[var(--color-accent-fill)] text-[var(--color-accent-fill-fg)]"
                      : "bg-[var(--color-bg-primary)] text-[var(--color-text-muted)]"
                  }`}
                >
                  {preset.badgeText}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Row 3: Live Scenario A/B Comparator Strip */}
      {pinnedScenario && results && scenarioDeltas && (
        <div
          role="region"
          aria-label={tr(
            "studio.compareBannerTitle",
            "Comparador de Cenários A/B",
            "A/B Scenario Comparator",
          )}
          className="mt-0.5 flex flex-col gap-2.5 rounded-xl border border-[var(--color-border-accent)] bg-surface-sunken p-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <span className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border-accent)] bg-[var(--color-accent-subtle)] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--color-accent)]">
                <GitCompareArrows className="h-3 w-3" aria-hidden="true" />
                {tr("studio.compareBaselineLabel", "Base (A)", "Baseline (A)")}
              </span>
              <span className="truncate text-xs font-bold text-text-primary">
                {pinnedScenario.label}
              </span>
              <span className="font-mono text-[11px] text-text-secondary">
                ({pinnedScenario.materialSummary} ·{" "}
                {pinnedScenario.infillPercent}% infill ·{" "}
                {pinnedScenario.profitMarginPercent}% markup)
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={handleCreateAbQuote}
                title={tr(
                  "studio.compareCreateQuoteTitle",
                  "Criar rascunho de orçamento com as duas opções (A vs. B)",
                  "Create a quote draft with both options (A vs. B)",
                )}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-[var(--color-border-accent)] bg-[var(--color-accent-subtle)] px-2.5 py-1 text-[11px] font-bold text-[var(--color-accent)] transition-colors hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
              >
                {abQuoteSaved ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-positive" aria-hidden="true" />
                    <span className="text-positive">
                      {tr(
                        "studio.compareQuoteCreated",
                        "Orçamento A/B criado!",
                        "A/B Quote created!",
                      )}
                    </span>
                  </>
                ) : (
                  <>
                    <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>
                      {tr(
                        "studio.compareCreateQuote",
                        "Gerar Orçamento (A vs. B)",
                        "Create A/B Quote",
                      )}
                    </span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => pinFromCalculator()}
                className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-2.5 py-1 text-[11px] font-semibold text-text-secondary transition-colors hover:bg-[var(--color-bg-hover)] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
              >
                <RefreshCw className="h-3 w-3" aria-hidden="true" />
                <span>
                  {tr(
                    "studio.compareUpdatePin",
                    "Atualizar Base",
                    "Update Baseline",
                  )}
                </span>
              </button>
              <button
                type="button"
                onClick={clearPinnedScenario}
                aria-label={tr(
                  "studio.compareClearPin",
                  "Limpar Comparação",
                  "Clear Comparison",
                )}
                title={tr(
                  "studio.compareClearPin",
                  "Limpar Comparação",
                  "Clear Comparison",
                )}
                className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-2.5 py-1 text-[11px] font-semibold text-text-secondary transition-colors hover:bg-[var(--color-bg-hover)] hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">
                  {tr(
                    "studio.compareClearPin",
                    "Limpar Comparação",
                    "Clear Comparison",
                  )}
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {/* Metric 1: Total Cost (Lower is positive) */}
            <div className="rounded-lg border border-border-subtle bg-surface-raised px-2.5 py-2">
              <div className="text-[10px] font-mono uppercase tracking-wider text-text-muted">
                {tr("studio.compareCost", "Custo", "Cost")}
              </div>
              <div className="mt-0.5 flex flex-wrap items-baseline justify-between gap-1">
                <span className="font-mono text-xs font-bold text-text-primary">
                  {formatCurrency(pinnedScenario.totalCost)} →{" "}
                  {formatCurrency(results.totalCost)}
                </span>
                <span
                  className={`font-mono text-[11px] font-bold ${
                    scenarioDeltas.costDelta < -0.005
                      ? "text-positive"
                      : scenarioDeltas.costDelta > 0.005
                        ? "text-danger"
                        : "text-text-secondary"
                  }`}
                >
                  {formatSignedCurrency(scenarioDeltas.costDelta)}
                </span>
              </div>
            </div>

            {/* Metric 2: Sell Price */}
            <div className="rounded-lg border border-border-subtle bg-surface-raised px-2.5 py-2">
              <div className="text-[10px] font-mono uppercase tracking-wider text-text-muted">
                {tr("studio.comparePrice", "Preço de Venda", "Sell Price")}
              </div>
              <div className="mt-0.5 flex flex-wrap items-baseline justify-between gap-1">
                <span className="font-mono text-xs font-bold text-text-primary">
                  {formatCurrency(pinnedScenario.sellPrice)} →{" "}
                  {formatCurrency(results.sellPrice)}
                </span>
                <span
                  className={`font-mono text-[11px] font-bold ${
                    Math.abs(scenarioDeltas.sellPriceDelta) < 0.005
                      ? "text-text-secondary"
                      : "text-accent"
                  }`}
                >
                  {formatSignedCurrency(scenarioDeltas.sellPriceDelta)}
                </span>
              </div>
            </div>

            {/* Metric 3: Net Profit (Higher is positive) */}
            <div className="rounded-lg border border-border-subtle bg-surface-raised px-2.5 py-2">
              <div className="text-[10px] font-mono uppercase tracking-wider text-text-muted">
                {tr("studio.compareProfit", "Lucro Líquido", "Net Profit")}
              </div>
              <div className="mt-0.5 flex flex-wrap items-baseline justify-between gap-1">
                <span className="font-mono text-xs font-bold text-text-primary">
                  {formatCurrency(pinnedScenario.profit)} →{" "}
                  {formatCurrency(results.profit)}
                </span>
                <span
                  className={`font-mono text-[11px] font-bold ${
                    scenarioDeltas.profitDelta > 0.005
                      ? "text-positive"
                      : scenarioDeltas.profitDelta < -0.005
                        ? "text-danger"
                        : "text-text-secondary"
                  }`}
                >
                  {formatSignedCurrency(scenarioDeltas.profitDelta)}
                </span>
              </div>
            </div>

            {/* Metric 4: Margin % (Higher is positive) */}
            <div className="rounded-lg border border-border-subtle bg-surface-raised px-2.5 py-2">
              <div className="text-[10px] font-mono uppercase tracking-wider text-text-muted">
                {tr("studio.compareMargin", "Margem", "Margin")}
              </div>
              <div className="mt-0.5 flex flex-wrap items-baseline justify-between gap-1">
                <span className="font-mono text-xs font-bold text-text-primary">
                  {pinnedScenario.effectiveMarginPercent.toFixed(1)}% →{" "}
                  {currentMarginPercent.toFixed(1)}%
                </span>
                <span
                  className={`font-mono text-[11px] font-bold ${
                    scenarioDeltas.marginDeltaPp > 0.05
                      ? "text-positive"
                      : scenarioDeltas.marginDeltaPp < -0.05
                        ? "text-danger"
                        : "text-text-secondary"
                  }`}
                >
                  {formatSignedPp(scenarioDeltas.marginDeltaPp)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
