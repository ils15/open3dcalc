import {
  Check,
  Copy,
  Flame,
  Info,
  MessageCircle,
  Activity,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { guardExport } from "@/shared/lib/demoExportGuard";

export interface MaterialProfile {
  name: string;
  nozzleTemp: string;
  bedTemp: string;
  infillOptimal: string;
  warpingRisk: string;
  warpingColor: string;
  tips: string;
}

interface LocalRecommendationsPanelProps {
  profile: MaterialProfile;
}

export function LocalRecommendationsPanel({
  profile,
}: LocalRecommendationsPanelProps) {
  const { t } = useTranslation();

  return (
    <div
      role="tabpanel"
      id="copilot-panel-tech"
      aria-labelledby="copilot-tab-tech"
      tabIndex={0}
      className="space-y-4"
    >
      <div className="flex items-start gap-2 rounded-xl border border-blue-900/40 bg-blue-950/20 p-3.5 text-slate-200">
        <Info
          className="mt-0.5 h-4 w-4 shrink-0 text-blue-300"
          aria-hidden="true"
        />
        <div className="space-y-1">
          <strong className="text-xs font-semibold text-blue-200">
            {t("copilot.localDisclosure")}
          </strong>
          <p className="text-[11px] text-slate-300">
            {t("copilot.localDescription")}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-300">
          <Flame className="h-4 w-4 text-orange-400" aria-hidden="true" />
          Parâmetros térmicos e dicas locais ({profile.name})
        </h3>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <RecommendationValue
            label="Bico / Nozzle"
            value={profile.nozzleTemp}
          />
          <RecommendationValue label="Mesa / Bed" value={profile.bedTemp} />
          <RecommendationValue
            label="Preenchimento"
            value={profile.infillOptimal}
            valueClassName="text-emerald-400"
          />
          <RecommendationValue
            label="Risco de warping"
            value={profile.warpingRisk}
            valueClassName={profile.warpingColor}
          />
        </div>
        <div className="space-y-1 rounded-xl border border-[#1e293b] bg-[#080d19] p-3.5">
          <strong className="block text-[11px] font-semibold text-slate-300">
            Dica de processo:
          </strong>
          <p className="text-xs text-slate-300">{profile.tips}</p>
        </div>
      </div>
    </div>
  );
}

interface RecommendationValueProps {
  label: string;
  value: string;
  valueClassName?: string;
}

function RecommendationValue({
  label,
  value,
  valueClassName = "text-white",
}: RecommendationValueProps) {
  return (
    <div className="rounded-xl border border-[#1e293b] bg-[#080d19] p-3">
      <span className="block font-mono text-[10px] uppercase text-slate-400">
        {label}
      </span>
      <strong className={`text-xs font-bold ${valueClassName}`}>{value}</strong>
    </div>
  );
}

interface SalesPitchPanelProps {
  pitch: string;
  price: string;
  copied: boolean;
  onCopy: () => void;
}

export function SalesPitchPanel({
  pitch,
  price,
  copied,
  onCopy,
}: SalesPitchPanelProps) {
  const { t } = useTranslation();

  return (
    <div
      role="tabpanel"
      id="copilot-panel-pitch"
      aria-labelledby="copilot-tab-pitch"
      tabIndex={0}
      className="space-y-4"
    >
      <div className="space-y-1.5">
        <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-300">
          <MessageCircle
            className="h-4 w-4 text-emerald-400"
            aria-hidden="true"
          />
          Proposta pronta para WhatsApp e negociação
        </h3>
        <p className="text-[11px] text-slate-300">
          Texto de modelo montado localmente com os valores desta calculadora:
        </p>
      </div>

      <div className="relative">
        <div className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-800 bg-[#080d19] p-4 font-mono text-xs leading-relaxed text-emerald-300">
          {pitch}
        </div>
        <button
          type="button"
          onClick={onCopy}
          aria-label={
            copied ? t("copilot.copiedPitch") : t("copilot.copyPitch")
          }
          className="absolute right-3 top-3 flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-100 shadow hover:bg-slate-700"
        >
          {copied ? (
            <Check
              className="h-3.5 w-3.5 text-emerald-400"
              aria-hidden="true"
            />
          ) : (
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {copied ? t("copilot.copiedShort") : t("copilot.copyShort")}
        </button>
      </div>

      <div className="flex items-center justify-between gap-3 pt-1">
        <span className="text-[11px] text-slate-300">
          Valor orçado: <strong className="text-white">{price}</strong>
        </span>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(pitch)}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => {
            if (guardExport()) event.preventDefault();
          }}
          aria-label={t("copilot.openWhatsApp")}
          className="flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-md transition-all hover:bg-emerald-800 active:scale-95"
        >
          <MessageCircle className="h-4 w-4" aria-hidden="true" />
          {t("copilot.openWhatsApp")}
        </a>
      </div>
    </div>
  );
}

interface MarginPanelProps {
  cost: string;
  margin: number;
  price: string;
  hourlyProfit: number;
  breakEvenUnits: number;
  format: (value: number) => string;
}

export function MarginPanel({
  cost,
  margin,
  price,
  hourlyProfit,
  breakEvenUnits,
  format,
}: MarginPanelProps) {
  return (
    <div
      role="tabpanel"
      id="copilot-panel-finance"
      aria-labelledby="copilot-tab-finance"
      tabIndex={0}
      className="space-y-4"
    >
      <div className="space-y-1 rounded-xl border border-blue-900/40 bg-blue-950/20 p-3.5">
        <strong className="flex items-center gap-1 text-xs font-semibold text-blue-200">
          <Activity className="h-4 w-4" aria-hidden="true" />
          Diagnóstico de viabilidade econômica local
        </strong>
        <p className="text-xs text-slate-200">
          Para cobrir o custo de produção de{" "}
          <strong className="text-white">{cost}</strong> com margem de{" "}
          <strong className="text-emerald-300">{margin}%</strong>, o preço
          sugerido é <strong className="text-white">{price}</strong>.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1 rounded-xl border border-[#1e293b] bg-[#080d19] p-3.5">
          <span className="text-[11px] text-slate-300">
            Retorno por hora de máquina:
          </span>
          <div className="text-lg font-bold text-emerald-300">
            {format(hourlyProfit)}/h
          </div>
          <p className="text-[10px] text-slate-300">
            {hourlyProfit >= 15
              ? "Margem horária acima da referência de R$ 15/h."
              : "Atenção: margem horária apertada para peças longas."}
          </p>
        </div>
        <div className="space-y-1 rounded-xl border border-[#1e293b] bg-[#080d19] p-3.5">
          <span className="text-[11px] text-slate-300">
            Ponto de equilíbrio da impressora:
          </span>
          <div className="text-lg font-bold text-blue-300">
            {breakEvenUnits > 0 ? `${breakEvenUnits} peças` : "N/A"}
          </div>
          <p className="text-[10px] text-slate-300">
            Quantidade deste projeto para cobrir o valor de aquisição da
            máquina.
          </p>
        </div>
      </div>
    </div>
  );
}
