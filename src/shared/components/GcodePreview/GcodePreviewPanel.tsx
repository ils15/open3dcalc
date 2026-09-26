import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Crosshair,
  X,
  AlertCircle,
  Loader2,
  Layers,
  Ruler,
} from "lucide-react";
import { GcodePreview } from "@chestnutlabs/gcode-preview-react";
import type { GcodePreviewHandle } from "@chestnutlabs/gcode-preview-react";
import { EmptyState } from "@/shared/components/ui/EmptyState";
import { FileCode2 } from "lucide-react";
import {
  useOwnedBytes,
  MAX_TOOLPATH_BYTES,
  MAX_TOOLPATH_LINES,
} from "./useOwnedBytes";
import { useObjectDimensions } from "./useObjectDimensions";
import type { ChestnutBounds, DimensionsStatus } from "./useObjectDimensions";

/**
 * 3D G-code toolpath preview, backed by `@chestnutlabs/gcode-preview`.
 *
 * This is the *viewer* side of G-code handling: it draws the actual toolpath
 * (how the print runs) from the chestnut IR, and is deliberately independent of
 * the calculation engine and its D-CL3/4 migration — the toolpath UX must not
 * be blocked by that riskier work.
 *
 * **Byte ownership** (see `useOwnedBytes`): the panel never receives a borrowed
 * buffer. It loads the `File` and slices a private copy, so chestnut's
 * zero-copy/transfer parse cannot detach a buffer belonging to someone else,
 * and the StrictMode remount re-parse always gets a pristine copy.
 *
 * The component is exported lazy (`./index.ts`) so an OFF build or a user that
 * never opens the viewer pays nothing for it.
 */

const toolbarButtonClass =
  "min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg " +
  "bg-[var(--color-bg-elevated)]/85 backdrop-blur-sm border border-[var(--color-border)]/60 " +
  "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] " +
  "hover:bg-[var(--color-bg-elevated)] transition-colors " +
  "focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none";

/**
 * The staged-preparation phases chestnut reports via `onStage`. Mirrors the
 * `PreparationStage` contract of the engine without depending on a transitive
 * package's type path — each literal doubles as an i18n key under
 * `gcodePreview.stage.*`. `reading` is a local pre-parse phase (our own file
 * read), so the UI shows progress before the engine ever starts.
 */
type ToolpathStage =
  | "reading"
  | "parsing"
  | "classifying"
  | "building-geometry"
  | "preparing-gpu"
  | "ready";

export interface GcodePreviewPanelProps {
  /** The G-code file to render. `null` shows the empty state. */
  file: File | null;
  /** Called when the user dismisses the viewer (toolbar close / Escape). */
  onClose?: () => void;
  /** Extra classes for the outer container. */
  className?: string;
}

export function GcodePreviewPanel({
  file,
  onClose,
  className,
}: GcodePreviewPanelProps) {
  const { t } = useTranslation();
  const handleRef = useRef<GcodePreviewHandle | null>(null);
  const [stage, setStage] = useState<ToolpathStage>("reading");
  const [parseError, setParseError] = useState<string | null>(null);
  const [percent, setPercent] = useState<number | null>(null);

  // D-CL6: real layer count. `onReady` is the engine's own post-parse summary
  // and carries `layers` (Z-change-detected), so the slider's scale costs no
  // second parse — the IR already exists at that point.
  const [layerCount, setLayerCount] = useState<number>(0);

  // D-CL6: visible-layer clip. `null` = show every layer; a tuple is the
  // engine's inclusive [start, end] range. Driven through the declarative
  // `layerRange` prop, which the engine applies as a cheap draw-range update
  // (its internal effect maps the prop to `controls.setLayerRange`, which
  // never rebuilds geometry — only the rendered layer span).
  const [layerRange, setLayerRange] = useState<[number, number] | null>(null);

  const { status, bytes } = useOwnedBytes(file);

  // D-CL6: object dimensions — a parallel adapter pass over the SAME owned
  // bytes (never the calculation engine), extracted into `useObjectDimensions`
  // so this panel keeps a single source of truth. The hook owns the framing
  // precedence (modelBounds → objectBounds → bounds), the D-EA6 null-guard, and
  // the stale-result discipline ("measuring" until the fresh pass settles).
  const dimsStatus = useObjectDimensions(bytes);

  // ---- error / guard states (rendered INSTEAD of the viewer, never a crash)
  if (status.kind === "error") {
    const message =
      status.code === "over-byte-cap"
        ? t("gcodePreview.tooLarge", {
            mb: Math.round(MAX_TOOLPATH_BYTES / (1024 * 1024)),
          })
        : status.code === "over-line-cap"
          ? t("gcodePreview.tooManyLines", {
              lines: MAX_TOOLPATH_LINES.toLocaleString(),
            })
          : t("gcodePreview.readFailed");
    return (
      <div
        className={`flex flex-col items-center justify-center gap-3 p-6 ${className ?? ""}`}
      >
        {/* contrast-site: gcode-preview-read-error-banner */}
        <div
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm bg-[var(--color-danger)]/90 text-[var(--color-text-primary)] border border-red-500/30 shadow-lg"
          role="alert"
        >
          <AlertCircle className="w-4 h-4 shrink-0 text-red-300" />
          <span>{message}</span>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={t("gcodePreview.close")}
            className={toolbarButtonClass}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  }

  // ---- empty state: nothing to render yet
  if (status.kind === "idle") {
    return (
      <div className={className}>
        <EmptyState
          icon={FileCode2}
          title={t("gcodePreview.emptyTitle")}
          description={t("gcodePreview.emptyDescription")}
        />
      </div>
    );
  }

  // ---- parse error from the engine (onParseError / onError) — treated state
  if (parseError) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-3 p-6 ${className ?? ""}`}
      >
        {/* contrast-site: gcode-preview-parse-error-banner */}
        <div
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm bg-[var(--color-danger)]/90 text-[var(--color-text-primary)] border border-red-500/30 shadow-lg"
          role="alert"
        >
          <AlertCircle className="w-4 h-4 shrink-0 text-red-300" />
          <span>{parseError}</span>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={t("gcodePreview.close")}
            className={toolbarButtonClass}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  }

  const isWorking = status.kind === "reading" || stage !== "ready";

  return (
    <div
      className={`relative w-full h-full overflow-hidden ${className ?? ""}`}
      role="region"
      aria-label={t("gcodePreview.containerLabel")}
    >
      {/* The chestnut viewer owns its <canvas>; it mounts only once every guard
          has passed, so a guard-failed file never spins up WebGL.

          SOURCE IS THE FILE, ON PURPOSE. chestnut's parser does a zero-copy
          parse: for a Uint8Array it transfers the underlying ArrayBuffer
          (session.js: `transfer = [input.buffer]`), detaching the view. React
          StrictMode double-invokes the viewer's parse effect, and the second
          invocation re-posts that now-detached buffer → DataCloneError. A
          `File` is a cloneable handle — it is never in the transfer list, so
          every parse re-reads it fresh. That makes the viewer StrictMode-safe
          by construction, with no reliance on parse/cancel race timing.

          The hook still owns a sliced copy of the bytes (useOwnedBytes) for the
          line-count guard — that copy is never handed to the transfer path. */}
      {status.kind === "ready" && file && (
        <GcodePreview
          ref={handleRef}
          source={file}
          onStage={(e) => {
            setStage(e.stage);
            setPercent(
              e.progress != null ? Math.round(e.progress * 100) : null,
            );
          }}
          onParseProgress={(p) =>
            setPercent(
              p.totalBytes > 0
                ? Math.round((p.bytesProcessed / p.totalBytes) * 100)
                : null,
            )
          }
          onParseError={() => setParseError(t("gcodePreview.parseError"))}
          onError={() => setParseError(t("gcodePreview.parseError"))}
          onReady={(summary) => {
            setStage("ready");
            setPercent(null);
            // The engine reports its own Z-change layer count here, so the
            // slider scale needs no separate parse. Guarded: a malformed
            // summary must never set a negative/NaN slider max.
            const layers = Math.max(0, Math.floor(summary.layers ?? 0));
            setLayerCount(layers);
            if (layers > 0 && layerRange === null) {
              // Default to the full build: clipping starts at the top, so a
              // fresh preview shows the complete toolpath until the user scrubs.
              setLayerRange([0, layers - 1]);
            }
          }}
          // Declarative layer clip — the engine's own effect maps this to a
          // draw-range update (no geometry rebuild). `null` renders all layers.
          layerRange={layerRange}
        />
      )}

      {/* Loading overlay: staged progress (parsing → building-geometry → …) */}
      {isWorking && (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-[var(--color-bg-base)]/80 backdrop-blur-sm"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="w-6 h-6 animate-spin text-[var(--color-accent)]" />
          <p className="text-sm text-[var(--color-text-secondary)]">
            {t(`gcodePreview.stage.${stage}`)}
          </p>
          {percent != null && (
            <p className="text-xs text-[var(--color-text-muted)]">{percent}%</p>
          )}
        </div>
      )}

      {/* Layer slider + object dimensions — bottom overlay.
          The slider is only offered once the engine has reported a real layer
          count, so a still-parsing file shows nothing interactive (and never a
          max of 0). The dimensions chip lives here, next to the geometry it
          describes, rather than in the StlPreview info panel: it is derived
          from the *toolpath* (the chestnut IR), not from the mesh, so keeping
          it inside the viewer keeps the two data sources from being conflated. */}
      {layerCount > 0 && (
        <div className="absolute bottom-2 left-2 right-2 z-20 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-start">
          <LayerSlider
            layerCount={layerCount}
            layerRange={layerRange}
            onChange={(range) => setLayerRange(range)}
          />
          <DimensionsChip dims={dimsStatus} />
        </div>
      )}

      {/* Toolbar overlay — mirrors the StlPreview toolbar (same classes, 44px
          targets, aria-labels) so the two previews feel like one feature. */}
      <div className="absolute top-2 right-2 z-20 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => handleRef.current?.controls.frame()}
          aria-label={t("gcodePreview.fit")}
          title={t("gcodePreview.fit")}
          className={toolbarButtonClass}
        >
          <Crosshair className="w-4 h-4" />
        </button>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={t("gcodePreview.close")}
            title={t("gcodePreview.close")}
            className={toolbarButtonClass}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Formats a bounds box as `W × D × H mm`, or `—` when unmeasurable.
 *
 * The em-dash (never `0.0×0.0×0.0`) is the D-EA6 null-guard: an absent or
 * ±Infinity box is "not measurable", not a zero-size object. Rounding to one
 * decimal matches the calculator's existing dimension formatting.
 */
function formatDimensions(bounds: ChestnutBounds): string {
  const { dimensions } = bounds;
  const fmt = (n: number): string => (Number.isFinite(n) ? n.toFixed(1) : "—");
  return `${fmt(dimensions.x)} × ${fmt(dimensions.y)} × ${fmt(dimensions.z)} mm`;
}

/**
 * Layer-range slider for the toolpath preview (D-CL6).
 *
 * Clips the rendered toolpath to layers `[0, end]` through the engine's
 * declarative `layerRange` prop, which maps internally to a draw-range update
 * — no geometry is rebuilt while scrubbing.
 *
 * A11y: a native `<input type="range">` (implicit `role="slider"`) with an
 * explicit label, `aria-valuetext` announcing "Layer N of M", step 1, and a
 * 44px-tall hit area. Arrow-key scrubbing comes from the native control.
 */
function LayerSlider({
  layerCount,
  layerRange,
  onChange,
}: {
  layerCount: number;
  layerRange: [number, number] | null;
  onChange: (range: [number, number]) => void;
}) {
  const { t } = useTranslation();
  const end = layerRange ? layerRange[1] : layerCount - 1;
  const valueText = layerRange
    ? t("gcodePreview.layerValue", { current: end + 1, total: layerCount })
    : t("gcodePreview.layerFull", { total: layerCount });

  return (
    <div className="flex w-full max-w-md flex-col gap-1 rounded-lg bg-[var(--color-bg-elevated)]/85 px-3 py-2 backdrop-blur-sm border border-[var(--color-border)]/60">
      <label
        htmlFor="gcode-layer-slider"
        className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-secondary)]"
      >
        <Layers className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>{t("gcodePreview.layerSliderLabel")}</span>
        <span
          className="tabular-nums text-[var(--color-text-muted)]"
          aria-live="polite"
        >
          {valueText}
        </span>
      </label>
      <input
        id="gcode-layer-slider"
        type="range"
        min={0}
        max={layerCount - 1}
        step={1}
        value={end}
        onChange={(e) => {
          const next = Number(e.target.value);
          // Clamp guards against a stray non-integer/NaN; the range the engine
          // accepts is inclusive [0, end].
          if (Number.isFinite(next)) {
            onChange([
              0,
              Math.min(layerCount - 1, Math.max(0, Math.floor(next))),
            ]);
          }
        }}
        aria-label={t("gcodePreview.layerSliderLabel")}
        aria-valuetext={valueText}
        className="h-11 w-full cursor-pointer accent-[var(--color-accent)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
      />
    </div>
  );
}

/**
 * Small read-only chip showing the printed object's dimensions.
 *
 * `honest` marks data derived from `modelBounds` (excludes skirt/brim/support/
 * wipe towers — the most precise box) vs a plain extrusion fallback, disclosed
 * via a tooltip rather than an invented precision tier.
 */
function DimensionsChip({ dims }: { dims: DimensionsStatus }) {
  const { t } = useTranslation();

  if (dims.kind === "measuring") {
    // No layout shift: reserves the chip's final footprint while the parallel
    // parse settles, and keeps `—` for unmeasurable files distinct from
    // "still working".
    return (
      <div
        className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)]/60 bg-[var(--color-bg-elevated)]/85 px-3 py-2 text-xs text-[var(--color-text-muted)] backdrop-blur-sm"
        role="status"
        aria-live="polite"
      >
        <Ruler
          className="w-3.5 h-3.5 shrink-0 animate-pulse"
          aria-hidden="true"
        />
        <span className="tabular-nums">—</span>
      </div>
    );
  }

  if (dims.kind === "unavailable") {
    // D-EA6: unmeasurable → em-dash, never zeros.
    return (
      <div
        className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)]/60 bg-[var(--color-bg-elevated)]/85 px-3 py-2 text-xs text-[var(--color-text-muted)] backdrop-blur-sm"
        title={t("gcodePreview.dimensionsUnavailable")}
      >
        <Ruler className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>{t("gcodePreview.objectDimensions")}: —</span>
      </div>
    );
  }

  const tooltip = dims.honest
    ? t("gcodePreview.dimensionsObject")
    : t("gcodePreview.dimensionsExtrusion");

  return (
    <div
      className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)]/60 bg-[var(--color-bg-elevated)]/85 px-3 py-2 text-xs text-[var(--color-text-secondary)] backdrop-blur-sm"
      title={tooltip}
    >
      <Ruler className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span className="font-medium">{t("gcodePreview.objectDimensions")}</span>
      <span className="tabular-nums">{formatDimensions(dims.bounds)}</span>
    </div>
  );
}
