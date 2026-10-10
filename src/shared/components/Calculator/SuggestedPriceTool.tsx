import { useId, useMemo, useState } from "react";
import { BadgeDollarSign, Check, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useCurrency } from "@/shared/hooks/useCurrency";
import {
  suggestPrices,
  type SuggestedPriceGoal,
  type SuggestedPriceScenario,
} from "@/shared/lib/suggestedPrice";
import type { VolumeDiscount } from "@/shared/types";

type GoalKind = SuggestedPriceGoal["kind"];

export interface SuggestedPriceToolProps {
  readonly totalCost: number;
  readonly taxPercent: number;
  readonly marketplaceFeePercent: number;
  readonly marketplaceFeeFixed?: number;
  readonly quantity: number;
  readonly volumeDiscounts: readonly VolumeDiscount[];
  readonly initialMarginPercent: number;
  readonly initialProfit: number;
  readonly initialSellPrice: number;
  readonly onApply: (scenario: SuggestedPriceScenario) => void;
}

const GOAL_KEYS: readonly GoalKind[] = [
  "target_margin",
  "profit_per_part",
  "monthly_profit",
  "break_even",
  "competitor",
];

function parseNumber(value: string): number {
  if (!value.trim()) return 0;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function initialAmount(value: number): string {
  return (Number.isFinite(value) ? Math.max(0, value) : 0).toFixed(2);
}

function initialQuantity(value: number): string {
  return String(Number.isFinite(value) ? Math.max(1, Math.round(value)) : 1);
}

export function SuggestedPriceTool({
  totalCost,
  taxPercent,
  marketplaceFeePercent,
  marketplaceFeeFixed = 0,
  quantity,
  volumeDiscounts,
  initialMarginPercent,
  initialProfit,
  initialSellPrice,
  onApply,
}: SuggestedPriceToolProps): React.ReactElement {
  const { t } = useTranslation();
  const { format, symbol } = useCurrency();
  const panelId = useId();
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [goalKind, setGoalKind] = useState<GoalKind>("target_margin");
  const [goalValue, setGoalValue] = useState(() =>
    initialAmount(initialMarginPercent),
  );
  const [unitsPerMonth, setUnitsPerMonth] = useState(() =>
    initialQuantity(quantity),
  );
  const [appliedPrice, setAppliedPrice] = useState<number | null>(null);

  const goal = useMemo<SuggestedPriceGoal>(() => {
    const value = parseNumber(goalValue);
    switch (goalKind) {
      case "target_margin":
        return { kind: goalKind, marginPercent: value };
      case "profit_per_part":
        return { kind: goalKind, profit: value };
      case "monthly_profit":
        return {
          kind: goalKind,
          monthlyProfit: value,
          unitsPerMonth: parseNumber(unitsPerMonth),
        };
      case "break_even":
        return { kind: goalKind };
      case "competitor":
        return { kind: goalKind, competitorPrice: value };
    }
  }, [goalKind, goalValue, unitsPerMonth]);

  const scenarios = useMemo(
    () =>
      suggestPrices(
        {
          totalCost,
          taxPercent,
          marketplaceFeePercent,
          marketplaceFeeFixed,
          quantity,
          volumeDiscounts,
        },
        goal,
      ),
    [
      goal,
      marketplaceFeeFixed,
      marketplaceFeePercent,
      quantity,
      taxPercent,
      totalCost,
      volumeDiscounts,
    ],
  );

  const goalLabel = t(`calc.suggestedPrice.goals.${goalKind}`);
  const numericLabel =
    goalKind === "target_margin"
      ? t("calc.suggestedPrice.targetMargin")
      : goalKind === "profit_per_part"
        ? t("calc.suggestedPrice.profitPerPart", { currency: symbol })
        : goalKind === "monthly_profit"
          ? t("calc.suggestedPrice.monthlyProfit", { currency: symbol })
          : goalKind === "competitor"
            ? t("calc.suggestedPrice.competitorPrice", { currency: symbol })
            : "";

  const handleApply = (scenario: SuggestedPriceScenario): void => {
    onApply(scenario);
    setAppliedPrice(scenario.sellPrice);
  };

  const scenarioTitle = (scenario: SuggestedPriceScenario): string => {
    const title = t(`calc.suggestedPrice.scenarios.${scenario.key}`);
    return scenario.tier
      ? t("calc.suggestedPrice.scenarios.withTier", {
          title,
          quantity: scenario.tier.minQuantity,
          discount: scenario.tier.discountPercent,
        })
      : title;
  };

  const scenarioNote = (scenario: SuggestedPriceScenario): string | null => {
    if (!scenario.feasible) {
      switch (scenario.infeasibility) {
        case "margin_target_unreachable":
          return t("calc.suggestedPrice.notes.marginTargetUnreachable");
        case "fees_consume_price":
          return t("calc.suggestedPrice.notes.feesConsumePrice");
        case "monthly_units_required":
          return t("calc.suggestedPrice.notes.monthlyUnitsRequired");
        default:
          return t("calc.suggestedPrice.notes.belowBreakEven", {
            loss: format(Math.abs(scenario.profit)),
          });
      }
    }
    if (scenario.tier) {
      return t("calc.suggestedPrice.notes.volumeTier", {
        margin: scenario.marginReal,
      });
    }
    if (scenario.key === "target_margin") {
      return t("calc.suggestedPrice.notes.marginMarkup", {
        markup: scenario.markup,
      });
    }
    return scenario.key === "break_even"
      ? t("calc.suggestedPrice.notes.breakEven")
      : null;
  };

  return (
    <section
      data-testid="suggested-price-tool"
      className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-raised)] p-3 sm:p-4"
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-11 w-full flex-wrap items-center justify-between gap-2 rounded-lg text-left text-sm font-semibold text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      >
        <span className="flex min-w-0 items-center gap-2">
          <BadgeDollarSign
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-[var(--accent)]"
          />
          <span>{t("calc.suggestedPrice.open")}</span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          id={panelId}
          data-testid="suggested-price-panel"
          className="mt-3 space-y-3 border-t border-[var(--border-default)] pt-3"
        >
          <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
            {t("calc.suggestedPrice.intro", {
              percent: marketplaceFeePercent,
              fixed: format(marketplaceFeeFixed),
            })}
          </p>

          <p className="rounded-lg bg-[var(--surface-sunken)] px-3 py-2 text-xs leading-relaxed text-[var(--text-secondary)]">
            {t("calc.suggestedPrice.applyHint")}
          </p>

          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="min-w-0">
              <label
                htmlFor={`${inputId}-goal`}
                className="mb-1 block text-xs font-medium text-[var(--text-secondary)]"
              >
                {t("calc.suggestedPrice.goal")}
              </label>
              <select
                id={`${inputId}-goal`}
                value={goalKind}
                onChange={(event) => {
                  const nextKind = event.target.value as GoalKind;
                  setGoalKind(nextKind);
                  const nextValue =
                    nextKind === "target_margin"
                      ? initialMarginPercent
                      : nextKind === "profit_per_part"
                        ? initialProfit
                        : nextKind === "monthly_profit"
                          ? initialProfit * Number(initialQuantity(quantity))
                          : nextKind === "competitor"
                            ? initialSellPrice
                            : 0;
                  setGoalValue(initialAmount(nextValue));
                  setUnitsPerMonth(initialQuantity(quantity));
                  setAppliedPrice(null);
                }}
                className="min-h-11 w-full min-w-0 rounded-lg border border-[var(--border-default)] bg-[var(--surface-input)] px-3 text-sm text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              >
                {GOAL_KEYS.map((kind) => (
                  <option key={kind} value={kind}>
                    {t(`calc.suggestedPrice.goals.${kind}`)}
                  </option>
                ))}
              </select>
            </div>

            {numericLabel && (
              <div className="min-w-0">
                <label
                  htmlFor={`${inputId}-value`}
                  className="mb-1 block text-xs font-medium text-[var(--text-secondary)]"
                >
                  {numericLabel}
                </label>
                <input
                  id={`${inputId}-value`}
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={goalValue}
                  onChange={(event) => {
                    setGoalValue(event.target.value);
                    setAppliedPrice(null);
                  }}
                  className="min-h-11 w-full min-w-0 rounded-lg border border-[var(--border-default)] bg-[var(--surface-input)] px-3 text-sm text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                />
              </div>
            )}

            {goalKind === "monthly_profit" && (
              <div className="min-w-0">
                <label
                  htmlFor={`${inputId}-units`}
                  className="mb-1 block text-xs font-medium text-[var(--text-secondary)]"
                >
                  {t("calc.suggestedPrice.unitsPerMonth")}
                </label>
                <input
                  id={`${inputId}-units`}
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  value={unitsPerMonth}
                  onChange={(event) => {
                    setUnitsPerMonth(event.target.value);
                    setAppliedPrice(null);
                  }}
                  className="min-h-11 w-full min-w-0 rounded-lg border border-[var(--border-default)] bg-[var(--surface-input)] px-3 text-sm text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                />
              </div>
            )}
          </div>

          <div
            role="group"
            aria-label={t("calc.suggestedPrice.resultsLabel", {
              goal: goalLabel,
            })}
            className="space-y-2"
          >
            {scenarios.map((scenario, index) => (
              <article
                key={`${scenario.key}-${index}`}
                className="min-w-0 rounded-lg border border-[var(--border-default)] bg-[var(--surface-sunken)] p-3"
              >
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                  <h3 className="min-w-0 text-sm font-semibold text-[var(--text-primary)]">
                    {scenarioTitle(scenario)}
                  </h3>
                  {!scenario.feasible && (
                    <span className="rounded-full border border-[var(--critical)]/50 px-2 py-0.5 text-[10px] font-semibold text-[var(--critical)]">
                      {t("calc.suggestedPrice.unavailable")}
                    </span>
                  )}
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                  <div>
                    <dt className="text-[var(--text-muted)]">
                      {t("calc.suggestedPrice.sellPrice")}
                    </dt>
                    <dd className="mt-0.5 break-words font-semibold text-[var(--text-primary)]">
                      {format(scenario.sellPrice)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--text-muted)]">
                      {t("calc.suggestedPrice.profit")}
                    </dt>
                    <dd
                      className={`mt-0.5 break-words font-semibold ${scenario.profit < 0 ? "text-[var(--critical)]" : "text-[var(--positive)]"}`}
                    >
                      {format(scenario.profit)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--text-muted)]">
                      {t("calc.suggestedPrice.margin")}
                    </dt>
                    <dd className="mt-0.5 font-medium text-[var(--text-primary)]">
                      {scenario.marginReal.toFixed(2)}%
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--text-muted)]">
                      {t("calc.suggestedPrice.markup")}
                    </dt>
                    <dd className="mt-0.5 font-medium text-[var(--text-primary)]">
                      {scenario.markup.toFixed(2)}%
                    </dd>
                  </div>
                </dl>
                {scenarioNote(scenario) && (
                  <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
                    {scenarioNote(scenario)}
                  </p>
                )}
                <button
                  type="button"
                  disabled={!scenario.feasible}
                  onClick={() => handleApply(scenario)}
                  className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[var(--accent)] px-3 text-xs font-semibold text-[var(--accent)] transition-colors hover:bg-[var(--accent-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t("calc.suggestedPrice.apply")}
                </button>
              </article>
            ))}
          </div>

          {appliedPrice !== null && (
            <p
              role="status"
              className="flex items-center gap-2 text-sm text-[var(--positive)]"
            >
              <Check aria-hidden="true" className="h-4 w-4 shrink-0" />
              {t("calc.suggestedPrice.applied", {
                price: format(appliedPrice),
              })}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
