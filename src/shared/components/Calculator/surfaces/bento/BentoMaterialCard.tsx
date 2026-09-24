import { Boxes } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";

import { isFieldVisibleForLevel } from "../../Calculator.constants";
import { useCurrency } from "@/shared/hooks/useCurrency";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { useCatalogStore } from "@/shared/stores/catalogStore";
import { useSpoolStore } from "@/shared/stores/spoolStore";
import { BentoCard } from "./BentoCard";
import { BentoField } from "./BentoField";
import { BentoMetric } from "./BentoMetric";
import { BentoSpoolGauge } from "./BentoSpoolGauge";

export interface BentoMaterialCardProps {
  readonly materialType: string;
  readonly unitWeight: number;
  readonly costPerKg: number;
  readonly materialCost: number;
  readonly selectedSpoolId: string | null;
}

function parseNumber(value: string): number {
  return value === "" ? 0 : Number.parseFloat(value) || 0;
}

/** Editable material assumptions plus a gauge backed by the user's real spool inventory. */
export function BentoMaterialCard({
  materialType,
  unitWeight,
  costPerKg,
  materialCost,
  selectedSpoolId,
}: BentoMaterialCardProps): React.ReactElement {
  const { t } = useTranslation();
  const { format, symbol } = useCurrency();
  const materials = useCatalogStore((state) => state.materials);
  const spools = useSpoolStore((state) => state.spools);
  const {
    activeTab,
    calcLevel,
    hiddenFields,
    fdmMaterial,
    resinMaterial,
    selectedSpoolId: storeSelectedSpoolId,
    setFdmMaterial,
    setResinMaterial,
    setSelectedSpoolId,
  } = useCalculatorStore(
    useShallow((state) => ({
      activeTab: state.activeTab,
      calcLevel: state.calcLevel,
      hiddenFields: state.hiddenFields,
      fdmMaterial: state.fdmMaterial,
      resinMaterial: state.resinMaterial,
      selectedSpoolId: state.selectedSpoolId,
      setFdmMaterial: state.setFdmMaterial,
      setResinMaterial: state.setResinMaterial,
      setSelectedSpoolId: state.setSelectedSpoolId,
    })),
  );

  const isFDM = activeTab === "fdm";
  const currentType = isFDM
    ? fdmMaterial.type || materialType
    : resinMaterial.type || materialType;
  const currentWeight = Number.isFinite(fdmMaterial.weightUsed)
    ? fdmMaterial.weightUsed
    : unitWeight;
  const currentCostPerKg = Number.isFinite(fdmMaterial.costPerKg)
    ? fdmMaterial.costPerKg
    : costPerKg;
  const activeSpoolId = storeSelectedSpoolId ?? selectedSpoolId;
  const isVisible = (fieldId: string): boolean =>
    isFieldVisibleForLevel(calcLevel, hiddenFields, "material", fieldId);

  const materialOptions = materials
    .filter((item) => item.type === (isFDM ? "fdm" : "resin"))
    .map((item) => ({ label: item.name, value: item.name }));
  if (currentType && !materialOptions.some((option) => option.value === currentType)) {
    materialOptions.unshift({ label: currentType, value: currentType });
  }

  const compatibleSpools = spools.filter(
    (item) =>
      item.status === "in_stock" &&
      item.material.toLowerCase() === currentType.toLowerCase(),
  );
  const spoolOptions = compatibleSpools.map((item) => ({
    label: `${item.brand} · ${item.material} · ${item.color}`,
    value: item.id,
  }));
  const selectedSpool = spools.find((item) => item.id === activeSpoolId);
  if (selectedSpool && !spoolOptions.some((option) => option.value === selectedSpool.id)) {
    spoolOptions.unshift({
      label: `${selectedSpool.brand} · ${selectedSpool.material} · ${selectedSpool.color}`,
      value: selectedSpool.id,
    });
  }

  const spool =
    selectedSpool ??
    spools.find(
      (item) =>
        item.status === "in_stock" &&
        item.material.toLowerCase() === currentType.toLowerCase(),
    ) ??
    null;

  return (
    <BentoCard title={t("bento.cards.material")} icon={Boxes}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {isVisible("type") && (
          <BentoField
            label={isFDM ? t("calc.filamentType") : t("calc.resinType")}
            value={currentType}
            onChange={(value) =>
              isFDM
                ? setFdmMaterial({ ...fdmMaterial, type: value })
                : setResinMaterial({ ...resinMaterial, type: value })
            }
            options={materialOptions}
            helper={t(isFDM ? "tooltip.filamentType" : "bento.helpers.resinType")}
            className="sm:col-span-2"
          />
        )}
        {isFDM ? (
          <>
            {isVisible("weightUsed") && (
              <BentoField
                label={t("calc.weight")}
                value={currentWeight}
                onChange={(value) =>
                  setFdmMaterial({ ...fdmMaterial, weightUsed: parseNumber(value) })
                }
                type="number"
                unit="g"
                step="0.1"
                min="0"
                helper={t("tooltip.weightUsed")}
              />
            )}
            {isVisible("costPerKg") && (
              <BentoField
                label={t("calc.costPerKg")}
                value={currentCostPerKg}
                onChange={(value) =>
                  setFdmMaterial({ ...fdmMaterial, costPerKg: parseNumber(value) })
                }
                type="number"
                prefix={symbol}
                unit="/kg"
                step="0.01"
                min="0"
                helper={t("tooltip.costPerKg")}
              />
            )}
            {isVisible("purgeWeight") && (
              <BentoField
                label={t("calc.purge")}
                value={fdmMaterial.purgeWeight}
                onChange={(value) =>
                  setFdmMaterial({ ...fdmMaterial, purgeWeight: parseNumber(value) })
                }
                type="number"
                unit="g"
                step="0.1"
                min="0"
                helper={t("tooltip.purge")}
              />
            )}
            {isVisible("density") && (
              <BentoField
                label={t("calc.density")}
                value={fdmMaterial.density}
                onChange={(value) =>
                  setFdmMaterial({ ...fdmMaterial, density: parseNumber(value) })
                }
                type="number"
                unit="g/cm³"
                step="0.01"
                min="0"
                helper={t("tooltip.density")}
              />
            )}
            {isVisible("spoolEfficiency") && (
              <BentoField
                label={t("calc.spoolEfficiency")}
                value={fdmMaterial.spoolEfficiency}
                onChange={(value) =>
                  setFdmMaterial({ ...fdmMaterial, spoolEfficiency: parseNumber(value) })
                }
                type="number"
                unit="%"
                step="0.1"
                min="0"
                helper={t("tooltip.spoolEfficiency")}
              />
            )}
          </>
        ) : (
          <>
            {isVisible("costPerLiter") && (
              <BentoField
                label={t("calc.costPerLiter")}
                value={resinMaterial.costPerLiter}
                onChange={(value) =>
                  setResinMaterial({ ...resinMaterial, costPerLiter: parseNumber(value) })
                }
                type="number"
                prefix={symbol}
                unit="/L"
                step="0.01"
                min="0"
                helper={t("tooltip.costPerLiter")}
              />
            )}
            {isVisible("volumeUsedMl") && (
              <BentoField
                label={t("calc.volumeMl")}
                value={resinMaterial.volumeUsedMl}
                onChange={(value) =>
                  setResinMaterial({ ...resinMaterial, volumeUsedMl: parseNumber(value) })
                }
                type="number"
                unit="ml"
                step="0.1"
                min="0"
                helper={t("tooltip.volumeMl")}
              />
            )}
            {isVisible("wasteMargin") && (
              <BentoField
                label={t("calc.wasteMargin")}
                value={resinMaterial.wasteMarginPercent}
                onChange={(value) =>
                  setResinMaterial({
                    ...resinMaterial,
                    wasteMarginPercent: parseNumber(value),
                  })
                }
                type="number"
                unit="%"
                step="0.1"
                min="0"
                helper={t("tooltip.wasteMargin")}
              />
            )}
          </>
        )}
        {isFDM && spoolOptions.length > 0 && (
          <BentoField
            label={t("bento.fields.spool")}
            value={activeSpoolId ?? ""}
            onChange={(value) => setSelectedSpoolId(value || null)}
            options={[{ label: t("bento.noSpoolSelected"), value: "" }, ...spoolOptions]}
            helper={t("bento.helpers.spool")}
            className="sm:col-span-2"
          />
        )}
      </div>
      <dl className="mt-3">
        <BentoMetric
          label={t("bento.fields.materialCost")}
          value={format(materialCost)}
          tone="cost"
        />
      </dl>
      <div className="mt-3">
        <BentoSpoolGauge spool={spool} />
      </div>
    </BentoCard>
  );
}
