import { Cpu } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useCurrency } from "@/shared/hooks/useCurrency";
import type { MachineCosts } from "@/shared/types";
import { BentoCard } from "./BentoCard";
import { BentoMetric } from "./BentoMetric";

export interface BentoMachineCardProps {
  readonly printerName: string;
  readonly printHours: number;
  readonly printerPowerWatts: number;
  readonly energyCost: number;
  readonly machineCost: number;
  readonly machine: MachineCosts;
}

/** Read-only machine, energy, depreciation and maintenance view. */
export function BentoMachineCard({
  printerName,
  printHours,
  printerPowerWatts,
  energyCost,
  machineCost,
  machine,
}: BentoMachineCardProps): React.ReactElement {
  const { t, i18n } = useTranslation();
  const { format } = useCurrency();
  const locale = i18n.resolvedLanguage?.startsWith("en") ? "en-US" : "pt-BR";
  const hours = printHours.toLocaleString(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const months = t("bento.monthCount", { count: machine.depreciationMonths });
  const maintenance = machine.maintenanceEnabled
    ? `${format(machine.maintenanceCost)} / ${t("bento.perMonth")}`
    : t("bento.notIncluded");

  return (
    <BentoCard title={t("bento.cards.machine")} icon={Cpu}>
      <dl className="grid grid-cols-2 gap-2">
        <BentoMetric
          label={t("bento.fields.printer")}
          value={printerName}
          tone="machine"
        />
        <BentoMetric
          label={t("bento.fields.printHours")}
          value={`${hours} h`}
          tone="machine"
        />
        <BentoMetric
          label={t("bento.fields.energy")}
          value={format(energyCost)}
          tone="energy"
        />
        <BentoMetric
          label={t("bento.fields.power")}
          value={`${printerPowerWatts} W`}
          tone="energy"
        />
        <BentoMetric
          label={t("bento.fields.depreciation")}
          value={`${format(machineCost)} · ${months}`}
          tone="machine"
        />
        <BentoMetric
          label={t("bento.fields.maintenance")}
          value={maintenance}
          tone="machine"
        />
      </dl>
    </BentoCard>
  );
}
