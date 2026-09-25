import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useCatalogStore,
  type CatalogPrinter,
} from "@/shared/stores/catalogStore";
import { X } from "lucide-react";

interface PrinterTagEditorProps {
  printer: CatalogPrinter;
}

/**
 * Inline tag editor for a custom catalog printer.
 * Writes straight through to the store (normalized + deduped there), so there
 * is no local draft state to reconcile on unmount.
 */
export function PrinterTagEditor({ printer }: PrinterTagEditorProps) {
  const { t } = useTranslation();
  const store = useCatalogStore();
  const [draft, setDraft] = useState("");

  const tags = printer.tags ?? [];

  const submit = () => {
    const value = draft.trim();
    if (!value) return;
    store.addPrinterTag(printer.id, value);
    setDraft("");
  };

  return (
    <div className="space-y-2 pt-2 border-t border-[var(--color-border)]">
      <div className="text-xs font-medium text-[var(--color-text-secondary)]">
        {t("catalog.tagsLabel")}
      </div>

      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)]"
            >
              {tag}
              <button
                type="button"
                onClick={() => store.removePrinterTag(printer.id, tag)}
                aria-label={t("catalog.removeTag", { tag })}
                title={t("catalog.removeTag", { tag })}
                className="p-0.5 rounded-full text-[var(--color-text-muted)] hover:text-[var(--color-danger)] focus-visible:ring-2 focus-visible:ring-[var(--color-danger)] focus-visible:outline-none"
              >
                <X className="w-3 h-3" aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <div className="text-xs text-[var(--color-text-secondary)]">
          {t("catalog.noTags")}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={t("catalog.tagPlaceholder")}
          aria-label={t("catalog.addTag")}
          className="flex-1 min-w-0 px-3 py-1.5 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!draft.trim()}
          className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--accent-fill)] text-white hover:bg-[var(--accent-fill-hover)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
        >
          {t("catalog.addTag")}
        </button>
      </div>
    </div>
  );
}
