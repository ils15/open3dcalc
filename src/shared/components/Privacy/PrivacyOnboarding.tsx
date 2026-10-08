import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { isBetaChannel } from "@/shared/config/betaChannel";
import { PrivacyBanner } from "@/shared/components/ui/PrivacyBanner";

/**
 * Privacy disclosure surface. Stable users get non-blocking information;
 * Beta keeps its synthetic-only first-run disclosure.
 */
export function PrivacyOnboarding() {
  if (isBetaChannel) return <BetaFirstRunDisclosure />;
  return <StablePrivacyOnboarding />;
}

function BetaFirstRunDisclosure() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const prevFocus = useRef<HTMLElement | null>(null);

  // Capture the previously focused element, move focus into the dialog,
  // and isolate the background (scroll lock). Restore on unmount.
  useEffect(() => {
    prevFocus.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
      prevFocus.current?.focus?.();
    };
  }, []);

  // Restore focus + scroll when dismissed via state (Escape / close button).
  // The unmount cleanup above also restores, but state-close unmounts
  // asynchronously — restore eagerly so tests and keyboard users land
  // immediately.
  useEffect(() => {
    if (!open) {
      document.body.style.overflow = "";
      prevFocus.current?.focus?.();
    }
  }, [open]);

  // Escape dismissal + Tab focus trap while open.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        return;
      }
      if (e.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = dialog.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      data-testid="beta-first-run-scrim"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="beta-first-run-title"
        className="mx-auto w-full max-w-3xl rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-4 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="beta-first-run-title" className="font-semibold">
            {t("privacy.betaFirstRun.title")}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t("common.close")}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="mt-2 space-y-1 text-sm text-[var(--color-text-secondary)]">
          <p>{t("privacy.betaFirstRun.testOnly")}</p>
          <p>{t("privacy.betaFirstRun.syntheticOnly")}</p>
          <p>{t("privacy.betaFirstRun.plaintextLocal")}</p>
          <p>{t("privacy.betaFirstRun.noPassword")}</p>
          <p>{t("privacy.betaFirstRun.noMigration")}</p>
          <p>{t("privacy.betaFirstRun.noExport")}</p>
          <p>{t("privacy.betaFirstRun.disposable")}</p>
        </div>
      </div>
    </div>
  );
}

function StablePrivacyOnboarding() {
  return <PrivacyBanner />;
}
