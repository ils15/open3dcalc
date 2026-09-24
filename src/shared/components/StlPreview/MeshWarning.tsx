import { AlertTriangle } from "lucide-react";
import type { MeshValidation } from "@/shared/lib/meshValidation";

/**
 * D-EA7: aviso NÃO-bloqueador de integridade da malha. A estimativa continua
 * calculando (nunca é "corrigida" nem bloqueada) — a malha doente só é
 * sinalizada, porque o volume assinado só é exato em malhas fechadas e bem
 * orientadas. Malha íntegra → o componente renderiza null (zero ruído).
 */
interface MeshWarningProps {
  validation: MeshValidation;
  /** `t` injetada (padrão da casa): testes usam identidade p/ validar chaves. */
  t: (key: string) => string;
}

interface IssueLine {
  key: string;
  count?: number;
}

function collectIssues(v: MeshValidation): IssueLine[] {
  const lines: IssueLine[] = [];
  if (v.openEdges > 0)
    lines.push({ key: "stl.meshWarning.open", count: v.openEdges });
  if (v.windingInconsistent) lines.push({ key: "stl.meshWarning.winding" });
  if (v.nonManifoldEdges > 0)
    lines.push({
      key: "stl.meshWarning.nonManifold",
      count: v.nonManifoldEdges,
    });
  if (v.degenerateTriangles > 0)
    lines.push({
      key: "stl.meshWarning.degenerate",
      count: v.degenerateTriangles,
    });
  if (v.partial) lines.push({ key: "stl.meshWarning.partial" });
  return lines;
}

export function MeshWarning({ validation, t }: MeshWarningProps) {
  const lines = collectIssues(validation);
  if (lines.length === 0) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      title={t("stl.meshWarning.tooltip")}
      className="flex items-start gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 p-2.5 text-xs text-amber-400"
    >
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="space-y-1">
        <p className="font-semibold">{t("stl.meshWarning.title")}</p>
        <ul className="space-y-0.5 text-[11px] text-amber-400/90">
          {lines.map((line) => (
            <li key={line.key} className="flex items-center gap-1.5">
              <span>{t(line.key)}</span>
              {line.count != null && (
                <span className="rounded-full border border-amber-500/40 px-1.5 text-[10px]">
                  {line.count.toLocaleString()}
                </span>
              )}
            </li>
          ))}
        </ul>
        <p className="inline-flex items-center rounded-full border border-amber-500/40 px-1.5 py-0.5 text-[10px]">
          {t("stl.meshWarning.badge")}
        </p>
      </div>
    </div>
  );
}
