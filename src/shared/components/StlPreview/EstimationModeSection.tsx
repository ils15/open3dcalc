import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Upload, X } from "lucide-react";
import { Tooltip } from "@/shared/components/ui/Tooltip";
import {
  K_MAX,
  K_MIN,
  K_STEP,
  type EstimationMode,
} from "@/shared/types/estimation";
import { DEFAULT_MAX_CHARS } from "@/shared/lib/gcodeTotals";

export interface GcodeAnchor {
  fileName: string;
  grams: number;
  minutes?: number;
}

interface EstimationModeSectionProps {
  mode: EstimationMode;
  onModeChange: (mode: EstimationMode) => void;
  calibrationK: number;
  onCalibrationKChange: (k: number) => void;
  gcodeAnchor: GcodeAnchor | null;
  onGcodeAnchor: (anchor: GcodeAnchor) => void;
  onClearGcodeAnchor: () => void;
}

// Caps and calibration bounds are single-sourced from the domain
// (`@/shared/types/estimation`, `@/shared/lib/gcodeTotals`) — never duplicate
// them here. `file.size` (bytes) is checked against `DEFAULT_MAX_CHARS` as a
// close approximation (G-code is ASCII, so 1 byte ≈ 1 char).

function clampK(raw: number): number | undefined {
  if (!Number.isFinite(raw)) return undefined;
  return Math.min(K_MAX, Math.max(K_MIN, raw));
}

/**
 * Standard|Custom selector (ANTI-COMPLEXITY: Standard by default, nothing new
 * visible) + collapsed custom section: calibration k and local G-code anchor.
 */
export function EstimationModeSection({
  mode,
  onModeChange,
  calibrationK,
  onCalibrationKChange,
  gcodeAnchor,
  onGcodeAnchor,
  onClearGcodeAnchor,
}: EstimationModeSectionProps) {
  const { t } = useTranslation();
  const gcodeInputRef = useRef<HTMLInputElement>(null);
  const gcodeUploadButtonRef = useRef<HTMLButtonElement>(null);
  const [gcodeError, setGcodeError] = useState<string | null>(null);
  const [parsingGcode, setParsingGcode] = useState(false);

  const handleGcodeFile = async (file: File | undefined) => {
    setGcodeError(null);
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "g" && ext !== "gcode") {
      setGcodeError(t("stl.gcodeInvalidType"));
      return;
    }
    if (file.size > DEFAULT_MAX_CHARS) {
      setGcodeError(t("stl.gcodeTooLarge"));
      return;
    }
    setParsingGcode(true);
    try {
      const text = await file.text();
      const { parseGcodeTotals } = await import("@/shared/lib/gcodeTotals");
      const totals = parseGcodeTotals(text);
      if (!Number.isFinite(totals.extrudedGrams) || totals.extrudedGrams <= 0) {
        setGcodeError(t("stl.gcodeParseError"));
        return;
      }
      onGcodeAnchor({
        fileName: file.name,
        grams: totals.extrudedGrams,
        ...(totals.timeMinutes !== undefined
          ? { minutes: totals.timeMinutes }
          : {}),
      });
    } catch {
      setGcodeError(t("stl.gcodeParseError"));
    } finally {
      setParsingGcode(false);
    }
  };

  return (
    <div className="space-y-2">
      <fieldset>
        <legend className="mb-1">
          <span className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
            {t("stl.estimationModeLabel")}
            <Tooltip content={t("stl.estimationModeHelp")}>
              <button
                type="button"
                aria-label={t("stl.estimationModeHelp")}
                className="w-5 h-5 inline-flex items-center justify-center rounded-full text-[11px] text-[var(--color-text-muted)] border border-[var(--color-border)] hover:text-[var(--color-text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
              >
                ?
              </button>
            </Tooltip>
          </span>
        </legend>
        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl surface">
          {(
            [
              {
                value: "simple",
                label: t("stl.estimationModeStandard"),
                description: t("stl.estimationModeStandardDescription"),
              },
              {
                value: "advanced",
                label: t("stl.estimationModeCustom"),
                description: t("stl.estimationModeCustomDescription"),
              },
            ] as const
          ).map((opt) => {
            const active = mode === opt.value;
            const descId = `estimation-mode-desc-${opt.value}`;
            return (
              <label
                key={opt.value}
                className={`min-h-[44px] flex flex-col items-center justify-center rounded-lg px-3 py-2 text-center cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-[var(--color-accent)] focus-within:outline-none ${
                  active
                    ? "bg-[var(--color-accent)] text-white"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]"
                }`}
              >
                <input
                  type="radio"
                  name="estimation-mode"
                  value={opt.value}
                  checked={active}
                  onChange={() => onModeChange(opt.value)}
                  aria-label={opt.label}
                  aria-describedby={descId}
                  className="sr-only"
                />
                <span className="text-xs font-medium">{opt.label}</span>
                <span
                  id={descId}
                  className={`mt-0.5 text-[10px] leading-tight font-normal ${
                    active ? "text-white/80" : "text-[var(--color-text-muted)]"
                  }`}
                >
                  {opt.description}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {mode === "advanced" && (
        <div className="space-y-3 rounded-xl border border-[var(--color-border)]/60 p-3">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <label
                htmlFor="estimation-k"
                className="text-xs text-[var(--color-text-secondary)]"
              >
                {t("stl.calibrationK")}
              </label>
              <Tooltip content={t("stl.calibrationKFormula")}>
                <button
                  type="button"
                  aria-label={t("stl.calibrationKFormula")}
                  className="w-5 h-5 inline-flex items-center justify-center rounded-full text-[11px] text-[var(--color-text-muted)] border border-[var(--color-border)] hover:text-[var(--color-text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
                >
                  ?
                </button>
              </Tooltip>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={K_MIN}
                max={K_MAX}
                step={K_STEP}
                value={calibrationK}
                onChange={(e) => {
                  const next = clampK(parseFloat(e.target.value));
                  if (next !== undefined) onCalibrationKChange(next);
                }}
                aria-label={t("stl.calibrationK")}
                className="flex-1 accent-[var(--color-accent)]"
              />
              <input
                id="estimation-k"
                type="number"
                min={K_MIN}
                max={K_MAX}
                step={K_STEP}
                value={calibrationK}
                onChange={(e) => {
                  const next = clampK(parseFloat(e.target.value));
                  if (next !== undefined) onCalibrationKChange(next);
                }}
                className="w-20 min-h-[44px] rounded-lg surface border border-[var(--color-border)]/60 px-2 text-xs text-[var(--color-text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            <input
              ref={gcodeInputRef}
              type="file"
              accept=".g,.gcode"
              aria-label={t("stl.gcodeUpload")}
              onChange={(e) => {
                void handleGcodeFile(e.target.files?.[0]);
                e.target.value = "";
              }}
              className="hidden"
            />
            <button
              type="button"
              ref={gcodeUploadButtonRef}
              onClick={() => gcodeInputRef.current?.click()}
              disabled={parsingGcode}
              aria-busy={parsingGcode}
              aria-describedby={gcodeError ? "gcode-error" : undefined}
              className="min-h-[44px] w-full inline-flex items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--color-border)] px-3 py-2 text-xs text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:bg-[var(--color-bg-hover)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none disabled:opacity-70"
            >
              <Upload className="w-4 h-4" />
              {parsingGcode ? t("stl.processing") : t("stl.gcodeUpload")}
            </button>
            {gcodeError && (
              <div
                id="gcode-error"
                role="alert"
                className="text-xs text-[var(--color-danger)]"
              >
                {gcodeError}
              </div>
            )}
            {gcodeAnchor && (
              <div className="flex items-center justify-between gap-2 rounded-lg surface px-2.5 py-2 text-xs">
                <p
                  title={gcodeAnchor.fileName}
                  className="min-w-0 flex-1 truncate text-[var(--color-text-secondary)]"
                >
                  {gcodeAnchor.fileName} · {gcodeAnchor.grams.toFixed(1)} g
                  {gcodeAnchor.minutes != null
                    ? ` · ${gcodeAnchor.minutes} min`
                    : ""}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onClearGcodeAnchor();
                    gcodeUploadButtonRef.current?.focus();
                  }}
                  aria-label={t("stl.gcodeClear")}
                  title={t("stl.gcodeClear")}
                  className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <p className="text-[11px] leading-relaxed text-[var(--color-text-muted)]">
            {t("stl.advancedUncertainty")}
          </p>
        </div>
      )}
    </div>
  );
}
