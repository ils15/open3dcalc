import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Crosshair, X, AlertCircle, Loader2 } from "lucide-react";
import { GcodePreview } from "@chestnutlabs/gcode-preview-react";
import type { GcodePreviewHandle } from "@chestnutlabs/gcode-preview-react";
import { EmptyState } from "@/shared/components/ui/EmptyState";
import { FileCode2 } from "lucide-react";
import {
  useOwnedBytes,
  MAX_TOOLPATH_BYTES,
  MAX_TOOLPATH_LINES,
} from "./useOwnedBytes";

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

  const { status } = useOwnedBytes(file);

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
          onReady={() => {
            setStage("ready");
            setPercent(null);
          }}
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
