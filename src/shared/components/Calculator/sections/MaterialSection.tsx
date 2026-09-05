import { useCallback } from "react";
import {
  FlaskConical,
  Layers,
  Package,
  Database,
  CheckCircle2,
  X,
} from "lucide-react";
import { EmptyState } from "@/shared/components/ui/EmptyState";
import { InputGroup } from "@/shared/components/ui/InputGroup";
import { Select } from "@/shared/components/ui/Select";
import type { CalculatorState } from "@/shared/stores/calculatorStore";
import type { FilamentSpool } from "@/shared/stores/filamentInventory";
import type { AMSSlot } from "@/shared/types";
import { selectSpool } from "@/shared/stores/storeBridge";
import type { FileParseResult } from "@/shared/components/StlPreview/StlPreview";
import { StlPreview } from "@/shared/components/StlPreview/StlPreview";

export interface MaterialSectionProps {
  renderSectionHeader: (
    Icon: typeof Layers,
    title: string,
    subtitle?: string,
    sectionId?: string,
  ) => React.ReactNode;
  t: (key: string) => string;
  currencySymbol: string;
  handleInput: (value: string, setter: (v: number) => void) => void;
  isFDM: boolean;
  store: CalculatorState;
  isFieldVisible: (sectionId: string, fieldId: string) => boolean;
  showSpoolSelector: boolean;
  setShowSpoolSelector: (show: boolean) => void;
  inventorySpools: FilamentSpool[];
  catalogMaterials: Array<{
    name: string;
    type: string;
  }>;
}

export function MaterialSection({
  renderSectionHeader,
  t,
  currencySymbol,
  handleInput,
  isFDM,
  store,
  isFieldVisible,
  showSpoolSelector,
  setShowSpoolSelector,
  inventorySpools,
  catalogMaterials,
}: MaterialSectionProps) {
  const handleStlParsed = useCallback(
    (data: FileParseResult) => {
      // Update print time
      if (data.printTimeHours > 0) {
        if (isFDM) {
          store.setFdmPrintParams({
            ...store.fdmPrintParams,
            printTimeHours: data.printTimeHours,
          });
        } else {
          store.setResinPrintParams({
            ...store.resinPrintParams,
            printTimeHours: data.printTimeHours,
          });
        }
      }
      // Update weight / material usage
      if (data.weight > 0) {
        if (isFDM) {
          if (store.fdmAmsEnabled) {
            const idx = store.fdmAmsSlots.findIndex((s) => s.enabled);
            if (idx >= 0) {
              const slot = {
                ...store.fdmAmsSlots[idx],
                weightUsedGrams: data.weight,
              };
              store.setFdmAmsSlot(idx, slot);
            }
          } else {
            store.setFdmMaterial({
              ...store.fdmMaterial,
              weightUsed: data.weight,
            });
          }
        } else {
          // Resin: model volume (cm³) → ml with ~10% waste factor; weight wired to store
          store.setResinMaterial({
            ...store.resinMaterial,
            volumeUsedMl: parseFloat((data.volumeCm3 * 1.1).toFixed(1)),
            weightUsed: data.weight,
          });
        }
      }
    },
    [store, isFDM],
  );

  const handleStlClear = useCallback(() => {
    if (isFDM) {
      store.setFdmPrintParams({
        ...store.fdmPrintParams,
        printTimeHours: 0,
      });
      if (store.fdmAmsEnabled) {
        const idx = store.fdmAmsSlots.findIndex((s) => s.enabled);
        if (idx >= 0) {
          const slot = { ...store.fdmAmsSlots[idx], weightUsedGrams: 0 };
          store.setFdmAmsSlot(idx, slot);
        }
      } else {
        store.setFdmMaterial({ ...store.fdmMaterial, weightUsed: 0 });
      }
    } else {
      store.setResinPrintParams({
        ...store.resinPrintParams,
        printTimeHours: 0,
      });
      store.setResinMaterial({
        ...store.resinMaterial,
        volumeUsedMl: 0,
        weightUsed: 0,
      });
    }
  }, [store, isFDM]);
  return (
    <div className="surface rounded-xl p-4 sm:p-5">
      {renderSectionHeader(
        isFDM ? Layers : FlaskConical,
        t("calc.material"),
        t(
          isFDM
            ? "calc.sectionDesc.fdmMaterial"
            : "calc.sectionDesc.resinMaterial",
        ),
        "material",
      )}
      {isFDM ? (
        <>
          {isFieldVisible("material", "purgeWeight") &&
            (store.selectedPrinter.maxFilaments ?? 1) > 1 && (
              <div className="flex items-center justify-end gap-2 mb-3">
                <span className="text-[10px] font-semibold text-[var(--color-info)] uppercase tracking-wide">
                  AMS Multi-material
                </span>
                <button
                  onClick={() => {
                    const was = store.fdmAmsEnabled;
                    if (!was) {
                      const slot0 = { ...store.fdmAmsSlots[0] };
                      slot0.materialType = store.fdmMaterial.type;
                      slot0.costPerKg = store.fdmMaterial.costPerKg;
                      slot0.weightUsedGrams = store.fdmMaterial.weightUsed;
                      slot0.purgeWeightGrams = store.fdmMaterial.purgeWeight;
                      slot0.density = store.fdmMaterial.density;
                      slot0.spoolEfficiency = store.fdmMaterial.spoolEfficiency;
                      store.setFdmAmsSlot(0, slot0);
                    }
                    store.setFdmAmsEnabled(!was);
                  }}
                  aria-pressed={store.fdmAmsEnabled}
                  className={`relative w-9 h-4 rounded-full transition-all focus-visible:ring-2 focus-visible:ring-[var(--color-info)] focus-visible:outline-none shrink-0 ${store.fdmAmsEnabled ? "bg-[var(--color-info)]" : "bg-[var(--color-bg-elevated)]"}`}
                >
                  <span
                    className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-md transition-all duration-200 ${store.fdmAmsEnabled ? "left-[18px]" : "left-0.5"}`}
                  />
                </button>
              </div>
            )}
          {store.fdmAmsEnabled ? (
            <>
              <div className="space-y-2">
                {store.fdmAmsSlots.map((slot: AMSSlot, i: number) => (
                  <div
                    key={i}
                    className="surface rounded-xl p-3 border-l-4"
                    style={{ borderLeftColor: slot.color }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-[var(--color-text-secondary)]">
                        Slot {i + 1}
                      </span>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={slot.color}
                          onChange={(e) =>
                            store.setFdmAmsSlot(i, {
                              ...slot,
                              color: e.target.value,
                            })
                          }
                          className="w-6 h-6 rounded cursor-pointer bg-transparent border-0 p-0"
                        />
                        <button
                          onClick={() => {
                            const s = { ...slot, enabled: !slot.enabled };
                            store.setFdmAmsSlot(i, s);
                          }}
                          className={`min-h-[44px] min-w-[44px] text-[10px] px-2 py-0.5 rounded-full transition-colors ${slot.enabled ? "bg-[var(--color-info)]/30 text-[var(--color-info)]" : "bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)]"}`}
                        >
                          {slot.enabled ? "Ativo" : "Inativo"}
                        </button>
                      </div>
                    </div>
                    {slot.enabled && (
                      <div className="space-y-2">
                        <Select
                          label=""
                          value={slot.materialType}
                          onChange={(v) =>
                            store.setFdmAmsSlot(i, { ...slot, materialType: v })
                          }
                          options={catalogMaterials
                            .filter((m) => m.type === "fdm")
                            .map((m) => ({ label: m.name, value: m.name }))}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <InputGroup
                            label="R$/kg"
                            value={slot.costPerKg}
                            onChange={(v) =>
                              store.setFdmAmsSlot(i, {
                                ...slot,
                                costPerKg: parseFloat(v) || 0,
                              })
                            }
                            type="number"
                            prefix={currencySymbol}
                          />
                          <InputGroup
                            label="Peso (g)"
                            value={slot.weightUsedGrams}
                            onChange={(v) =>
                              store.setFdmAmsSlot(i, {
                                ...slot,
                                weightUsedGrams: parseFloat(v) || 0,
                              })
                            }
                            type="number"
                            unit="g"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <InputGroup
                            label="Purga (g)"
                            value={slot.purgeWeightGrams}
                            onChange={(v) =>
                              store.setFdmAmsSlot(i, {
                                ...slot,
                                purgeWeightGrams: parseFloat(v) || 0,
                              })
                            }
                            type="number"
                            unit="g"
                          />
                          <InputGroup
                            label="Dens."
                            value={slot.density}
                            onChange={(v) =>
                              store.setFdmAmsSlot(i, {
                                ...slot,
                                density: parseFloat(v) || 0,
                              })
                            }
                            type="number"
                            unit="g/cm³"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="w-full min-w-0 mt-3">
                <StlPreview
                  onFileParsed={handleStlParsed}
                  onClear={handleStlClear}
                  materialDensity={store.fdmMaterial.density}
                  infillPercent={store.infillPercent}
                />
              </div>
            </>
          ) : (
            <div className="grid grid-cols-1 @form:grid-cols-2 gap-3">
              <Select
                label={t("calc.filamentType")}
                value={store.fdmMaterial.type}
                onChange={(v) =>
                  store.setFdmMaterial({ ...store.fdmMaterial, type: v })
                }
                options={catalogMaterials
                  .filter((m) => m.type === "fdm")
                  .map((m) => ({ label: m.name, value: m.name }))}
              />
              <div className="relative">
                <InputGroup
                  label={t("calc.costPerKg")}
                  value={store.fdmMaterial.costPerKg}
                  onChange={(v) =>
                    handleInput(v, (val) =>
                      store.setFdmMaterial({
                        ...store.fdmMaterial,
                        costPerKg: val,
                      }),
                    )
                  }
                  type="number"
                  prefix={currencySymbol}
                  tooltip={t("tooltip.costPerKg")}
                />
                {inventorySpools.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowSpoolSelector(!showSpoolSelector)}
                    className={`min-h-[44px] absolute right-2 top-7 text-[10px] px-2 py-1 rounded-md transition-colors ${
                      showSpoolSelector
                        ? "bg-[var(--color-accent)]/30 text-[var(--color-accent)] border border-[var(--color-accent)]/40"
                        : "bg-[var(--color-accent)]/30 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/50"
                    }`}
                  >
                    Inventário
                  </button>
                )}
                {showSpoolSelector && (
                  <div className="absolute z-20 mt-1 w-full surface border border-[var(--color-border)] rounded-xl p-1 max-h-48 overflow-y-auto shadow-xl">
                    {inventorySpools
                      .filter(
                        (s) =>
                          s.material.toLowerCase() ===
                            store.fdmMaterial.type.toLowerCase() ||
                          showSpoolSelector,
                      )
                      .slice(0, 10)
                      .map((spool) => (
                        <button
                          key={spool.id}
                          type="button"
                          onClick={() => {
                            selectSpool(spool);
                            setShowSpoolSelector(false);
                          }}
                          className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-[var(--color-bg-elevated)] transition-colors flex justify-between"
                        >
                          <span className="text-[var(--color-text-primary)]">
                            {spool.brand} - {spool.color}
                          </span>
                          <span className="text-[var(--color-accent)]">
                            R$ {spool.costPerKg.toFixed(2)}/kg
                          </span>
                        </button>
                      ))}
                    {inventorySpools.length === 0 && (
                      <EmptyState
                        icon={Package}
                        title="Inventário vazio"
                        description="Adicione filamentos ao seu inventário para selecionar rapidamente."
                      />
                    )}
                  </div>
                )}
              </div>
              <InputGroup
                label={t("calc.weight")}
                value={store.fdmMaterial.weightUsed}
                onChange={(v) =>
                  handleInput(v, (val) =>
                    store.setFdmMaterial({
                      ...store.fdmMaterial,
                      weightUsed: val,
                    }),
                  )
                }
                type="number"
                unit="g"
                tooltip={t("tooltip.weightUsed")}
              />
              {isFieldVisible("material", "purgeWeight") && (
                <InputGroup
                  label={t("calc.purge")}
                  value={store.fdmMaterial.purgeWeight}
                  onChange={(v) =>
                    handleInput(v, (val) =>
                      store.setFdmMaterial({
                        ...store.fdmMaterial,
                        purgeWeight: val,
                      }),
                    )
                  }
                  type="number"
                  unit="g"
                  tooltip={t("tooltip.purge")}
                />
              )}
              {isFieldVisible("material", "spoolEfficiency") && (
                <InputGroup
                  label={t("calc.spoolEfficiency")}
                  value={store.fdmMaterial.spoolEfficiency}
                  onChange={(v) =>
                    handleInput(v, (val) =>
                      store.setFdmMaterial({
                        ...store.fdmMaterial,
                        spoolEfficiency: val,
                      }),
                    )
                  }
                  type="number"
                  unit="%"
                  tooltip={t("tooltip.spoolEfficiency")}
                />
              )}
              {isFieldVisible("material", "density") && (
                <InputGroup
                  label={t("calc.density")}
                  value={store.fdmMaterial.density}
                  onChange={(v) =>
                    handleInput(v, (val) =>
                      store.setFdmMaterial({
                        ...store.fdmMaterial,
                        density: val,
                      }),
                    )
                  }
                  type="number"
                  unit="g/cm³"
                  tooltip={t("tooltip.density")}
                />
              )}
              <div className="w-full min-w-0 @form:col-span-2">
                <StlPreview
                  onFileParsed={handleStlParsed}
                  onClear={handleStlClear}
                  materialDensity={store.fdmMaterial.density}
                  infillPercent={store.infillPercent}
                />
              </div>
            </div>
          )}

          {/* Auto-deduction Spool Selector — FDM non-AMS only */}
          {isFDM &&
            !store.fdmAmsEnabled &&
            inventorySpools.length > 0 &&
            (() => {
              const unitWeight = store.results?.unitWeight ?? 0;
              const availableSpools = inventorySpools.filter(
                (s) =>
                  s.status === "in_stock" &&
                  s.material.toLowerCase() ===
                    store.fdmMaterial.type.toLowerCase() &&
                  s.weightGrams >= unitWeight,
              );
              return (
                <div className="mt-4 border-t border-[var(--color-border)] pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
                      {t("results.selectSpool")}
                    </span>
                    {store.selectedSpoolId && (
                      <button
                        type="button"
                        onClick={() => store.setSelectedSpoolId(null)}
                        className="text-[10px] text-[var(--color-text-muted)] hover:text-red-400 transition-colors flex items-center gap-1"
                      >
                        <X className="w-3 h-3" />
                        {t("results.clearSpool")}
                      </button>
                    )}
                  </div>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {availableSpools.length === 0 ? (
                      <p className="text-xs text-[var(--color-text-muted)] text-center py-2">
                        {t("common.noData")}
                      </p>
                    ) : (
                      availableSpools.map((spool) => {
                        const isSelected = store.selectedSpoolId === spool.id;
                        return (
                          <button
                            key={spool.id}
                            type="button"
                            onClick={() =>
                              store.setSelectedSpoolId(
                                isSelected ? null : spool.id,
                              )
                            }
                            className={`w-full text-left p-2 rounded-lg transition-colors flex items-center gap-2.5 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none ${
                              isSelected
                                ? "bg-emerald-800/30 border border-emerald-500/40"
                                : "bg-[var(--color-bg-hover)] hover:bg-[var(--color-bg-hover)] border border-transparent"
                            }`}
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-[var(--color-border)]"
                              style={{ backgroundColor: spool.colorHex }}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-xs text-[var(--color-text-primary)] font-medium truncate">
                                {spool.brand} — {spool.color}
                              </div>
                              <div className="text-[10px] text-[var(--color-text-muted)]">
                                {spool.material} &middot;{" "}
                                {t("results.deductAvailable").replace(
                                  "{{weight}}",
                                  spool.weightGrams.toFixed(0),
                                )}
                              </div>
                            </div>
                            {isSelected && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                  {store.selectedSpoolId && (
                    <p className="text-[10px] text-emerald-400/70 mt-1.5 text-center">
                      <Database className="w-3 h-3 inline mr-1 align-middle" />
                      {t("results.deductAvailable").replace(
                        "{{weight}}",
                        unitWeight.toFixed(0),
                      )}
                    </p>
                  )}
                </div>
              );
            })()}
        </>
      ) : (
        <div className="grid grid-cols-1 @form:grid-cols-2 gap-3">
          <Select
            label={t("calc.resinType")}
            value={store.resinMaterial.type}
            onChange={(v) =>
              store.setResinMaterial({ ...store.resinMaterial, type: v })
            }
            options={catalogMaterials
              .filter((m) => m.type === "resin")
              .map((m) => ({ label: m.name, value: m.name }))}
          />
          <InputGroup
            label={t("calc.costPerLiter")}
            value={store.resinMaterial.costPerLiter}
            onChange={(v) =>
              handleInput(v, (val) =>
                store.setResinMaterial({
                  ...store.resinMaterial,
                  costPerLiter: val,
                }),
              )
            }
            type="number"
            prefix={currencySymbol}
            tooltip={t("tooltip.costPerLiter")}
          />
          <InputGroup
            label={t("calc.volumeMl")}
            value={store.resinMaterial.volumeUsedMl}
            onChange={(v) =>
              handleInput(v, (val) =>
                store.setResinMaterial({
                  ...store.resinMaterial,
                  volumeUsedMl: val,
                }),
              )
            }
            type="number"
            unit="ml"
            tooltip={t("tooltip.volumeMl")}
          />
          {isFieldVisible("material", "wasteMargin") && (
            <InputGroup
              label={t("calc.wasteMargin")}
              value={store.resinMaterial.wasteMarginPercent}
              onChange={(v) =>
                handleInput(v, (val) =>
                  store.setResinMaterial({
                    ...store.resinMaterial,
                    wasteMarginPercent: val,
                  }),
                )
              }
              type="number"
              unit="%"
              tooltip={t("tooltip.wasteMargin")}
            />
          )}
          <div className="w-full min-w-0 @form:col-span-2">
            <StlPreview
              onFileParsed={handleStlParsed}
              onClear={handleStlClear}
              materialDensity={store.resinMaterial.density}
              infillPercent={100}
            />
          </div>
        </div>
      )}
    </div>
  );
}
