import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle,
  Download,
  Lock,
  RefreshCw,
  Unlock,
  Upload,
  X,
} from "lucide-react";
import {
  exportData,
  importData,
  isEncrypted,
  type DataSyncExportResult,
  type DataSyncImportResult,
} from "@/shared/lib/dataSync";
import { PrivacyPolicy } from "./PrivacyPolicy";

type TabId = "export" | "import";
type ImportMode = "merge" | "replace";
type Phase = "idle" | "working" | "success" | "error";

interface DataSyncModalProps {
  open: boolean;
  onRequestClose?: () => void;
}

export function DataSyncModal({ open, onRequestClose }: DataSyncModalProps) {
  const { t } = useTranslation();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="sync-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={(e) => {
            // Only close when the backdrop itself is clicked — not when a
            // nested overlay (e.g. PrivacyPolicy) is dismissed.
            if (e.target === e.currentTarget) onRequestClose?.();
          }}
          role="dialog"
          aria-modal="true"
          aria-label={t("sync.title")}
        >
          <DataSyncModalContent onRequestClose={onRequestClose} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Inner modal content. Mounted fresh every time the modal opens (the parent
 * only renders it while `open` is true), so all state starts at its defaults
 * without needing a reset effect.
 */
function DataSyncModalContent({
  onRequestClose,
}: {
  onRequestClose?: () => void;
}) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const [activeTab, setActiveTab] = useState<TabId>("export");
  const [showPrivacy, setShowPrivacy] = useState(false);

  // Export state
  const [encryptEnabled, setEncryptEnabled] = useState(false);
  const [exportPassword, setExportPassword] = useState("");
  const [showExportPassword, setShowExportPassword] = useState(false);
  const [exportPhase, setExportPhase] = useState<Phase>("idle");
  const [exportResult, setExportResult] = useState<DataSyncExportResult | null>(
    null,
  );

  // Import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [fileEncrypted, setFileEncrypted] = useState(false);
  const [importPassword, setImportPassword] = useState("");
  const [showImportPassword, setShowImportPassword] = useState(false);
  const [importMode, setImportMode] = useState<ImportMode>("merge");
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [importPhase, setImportPhase] = useState<Phase>("idle");
  const [importResult, setImportResult] = useState<DataSyncImportResult | null>(
    null,
  );
  const [importError, setImportError] = useState<
    "invalid" | "wrongPassword" | null
  >(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Focus trap + Escape close
  useEffect(() => {
    const timer = setTimeout(() => closeButtonRef.current?.focus(), 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onRequestClose?.();
        return;
      }
      if (e.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = dialog.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
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

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onRequestClose]);

  const handleTablistKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const tabs: TabId[] = ["export", "import"];
    const idx = tabs.indexOf(activeTab);
    const next =
      e.key === "ArrowRight"
        ? (idx + 1) % tabs.length
        : (idx - 1 + tabs.length) % tabs.length;
    setActiveTab(tabs[next]);
  };

  const handleExport = async () => {
    if (exportPhase === "working") return;
    setExportPhase("working");
    setExportResult(null);
    try {
      const result = await exportData({
        password: encryptEnabled && exportPassword ? exportPassword : undefined,
      });
      setExportResult(result);
      setExportPhase("success");
    } catch {
      setExportPhase("error");
    }
  };

  const handleFileChange = async (file: File | null) => {
    setImportFile(file);
    setImportPhase("idle");
    setImportResult(null);
    setImportError(null);
    setConfirmReplace(false);
    if (!file) {
      setFileEncrypted(false);
      return;
    }
    try {
      setFileEncrypted(await isEncrypted(file));
    } catch {
      setFileEncrypted(false);
    }
  };

  const handleImport = async () => {
    if (!importFile || importPhase === "working") return;
    // "Replace all" is destructive — require explicit confirmation first.
    if (importMode === "replace" && !confirmReplace) {
      setConfirmReplace(true);
      return;
    }
    setConfirmReplace(false);
    setImportPhase("working");
    setImportResult(null);
    setImportError(null);
    try {
      const result = await importData(importFile, {
        password: fileEncrypted && importPassword ? importPassword : undefined,
        mode: importMode,
      });
      setImportResult(result);
      setImportPhase("success");
    } catch (error) {
      const err = error as { code?: "INVALID_FILE" | "WRONG_PASSWORD" };
      setImportError(
        err?.code === "WRONG_PASSWORD" ? "wrongPassword" : "invalid",
      );
      setImportPhase("error");
    }
  };

  const handleModeChange = (mode: ImportMode) => {
    setImportMode(mode);
    setConfirmReplace(false);
  };

  return (
    <>
      <motion.div
        ref={dialogRef}
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        className="surface rounded-xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 p-6 pb-4">
          <div className="p-2.5 rounded-full bg-[var(--color-accent)]/10">
            <RefreshCw className="w-5 h-5 text-[var(--color-accent)]" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
              {t("sync.title")}
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            onClick={onRequestClose}
            aria-label={t("common.close")}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div
          role="tablist"
          aria-label={t("sync.title")}
          onKeyDown={handleTablistKeyDown}
          className="flex gap-1 px-6 pb-2 border-b border-[var(--color-border)]"
        >
          <TabButton
            id="export"
            active={activeTab === "export"}
            label={t("sync.export.tab")}
            onSelect={setActiveTab}
          />
          <TabButton
            id="import"
            active={activeTab === "import"}
            label={t("sync.import.tab")}
            onSelect={setActiveTab}
          />
        </div>

        {/* Active panel */}
        <div
          role="tabpanel"
          id={`sync-panel-${activeTab}`}
          aria-labelledby={`sync-tab-${activeTab}`}
          className="p-6 space-y-5"
        >
          {activeTab === "export" ? (
            <ExportTab
              encryptEnabled={encryptEnabled}
              setEncryptEnabled={setEncryptEnabled}
              exportPassword={exportPassword}
              setExportPassword={setExportPassword}
              showExportPassword={showExportPassword}
              setShowExportPassword={setShowExportPassword}
              phase={exportPhase}
              result={exportResult}
              onExport={handleExport}
            />
          ) : (
            <ImportTab
              file={importFile}
              fileEncrypted={fileEncrypted}
              onFileChange={handleFileChange}
              importPassword={importPassword}
              setImportPassword={setImportPassword}
              showImportPassword={showImportPassword}
              setShowImportPassword={setShowImportPassword}
              mode={importMode}
              setMode={handleModeChange}
              confirmReplace={confirmReplace}
              onConfirmReplace={handleImport}
              onCancelReplace={() => setConfirmReplace(false)}
              phase={importPhase}
              result={importResult}
              error={importError}
              onImport={handleImport}
              dragOver={dragOver}
              setDragOver={setDragOver}
              fileInputRef={fileInputRef}
            />
          )}
        </div>

        {/* LGPD footer */}
        <div className="px-6 py-4 border-t border-[var(--color-border)]">
          <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
            {t("sync.lgpd_notice")}{" "}
            <button
              onClick={() => setShowPrivacy(true)}
              className="text-[var(--color-accent)] hover:text-[var(--color-accent-light)] underline underline-offset-2 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
            >
              {t("sync.privacy_link")}
            </button>
          </p>
        </div>
      </motion.div>

      <PrivacyPolicy open={showPrivacy} onClose={() => setShowPrivacy(false)} />
    </>
  );
}

interface TabButtonProps {
  id: TabId;
  active: boolean;
  label: string;
  onSelect: (id: TabId) => void;
}

function TabButton({ id, active, label, onSelect }: TabButtonProps) {
  return (
    <button
      role="tab"
      id={`sync-tab-${id}`}
      aria-selected={active}
      aria-controls={`sync-panel-${id}`}
      tabIndex={active ? 0 : -1}
      onClick={() => onSelect(id)}
      className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none ${
        active
          ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
          : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]"
      }`}
    >
      {label}
    </button>
  );
}

interface ExportTabProps {
  encryptEnabled: boolean;
  setEncryptEnabled: (v: boolean) => void;
  exportPassword: string;
  setExportPassword: (v: string) => void;
  showExportPassword: boolean;
  setShowExportPassword: React.Dispatch<React.SetStateAction<boolean>>;
  phase: Phase;
  result: DataSyncExportResult | null;
  onExport: () => void;
}

function ExportTab({
  encryptEnabled,
  setEncryptEnabled,
  exportPassword,
  setExportPassword,
  showExportPassword,
  setShowExportPassword,
  phase,
  result,
  onExport,
}: ExportTabProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-5">
      <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
        {t("sync.export.description")}
      </p>

      <label className="flex items-start gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={encryptEnabled}
          onChange={(e) => {
            setEncryptEnabled(e.target.checked);
            if (!e.target.checked) setExportPassword("");
          }}
          className="mt-0.5 w-4 h-4 rounded accent-[var(--color-accent)]"
        />
        <span className="text-sm text-[var(--color-text-secondary)]">
          {t("sync.export.encrypt")}
        </span>
      </label>

      {encryptEnabled && (
        <div className="space-y-1.5">
          <label
            htmlFor="sync-export-password"
            className="block text-xs font-medium text-[var(--color-text-secondary)]"
          >
            {t("sync.export.password")}
          </label>
          <div className="relative">
            <input
              id="sync-export-password"
              type={showExportPassword ? "text" : "password"}
              value={exportPassword}
              onChange={(e) => {
                setExportPassword(e.target.value);
                if (e.target.value) setEncryptEnabled(true);
              }}
              placeholder={t("sync.export.passwordPlaceholder")}
              className="w-full pr-10 px-3.5 py-2.5 rounded-xl text-sm bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            />
            <button
              type="button"
              onClick={() => setShowExportPassword((v) => !v)}
              aria-label={
                showExportPassword
                  ? t("sync.export.passwordHide", "Ocultar senha")
                  : t("sync.export.passwordShow", "Mostrar senha")
              }
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
            >
              {showExportPassword ? (
                <Unlock className="w-4 h-4" />
              ) : (
                <Lock className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <button
          onClick={onExport}
          disabled={phase === "working"}
          className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold bg-[var(--color-accent)] text-[var(--color-text-primary)] hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-60 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
        >
          <Download className="w-4 h-4" />
          {t("sync.export.button")}
        </button>

        {phase === "working" && (
          <p
            role="status"
            className="flex items-center justify-center gap-2 text-sm text-[var(--color-text-muted)]"
          >
            <span
              className="w-4 h-4 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin"
              aria-hidden="true"
            />
            {t("sync.export.downloading")}
          </p>
        )}

        {phase === "success" && result && (
          <p
            role="status"
            className="flex items-center justify-center gap-2 text-sm text-[var(--color-success)]"
          >
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>
              {t("sync.export.success")} — {result.fileName} (
              {formatBytes(result.sizeBytes)})
            </span>
          </p>
        )}

        {phase === "error" && (
          <p
            role="alert"
            className="flex items-center justify-center gap-2 text-sm text-[var(--color-danger)]"
          >
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {t("common.error")}
          </p>
        )}
      </div>
    </div>
  );
}

interface ImportTabProps {
  file: File | null;
  fileEncrypted: boolean;
  onFileChange: (file: File | null) => void;
  importPassword: string;
  setImportPassword: (v: string) => void;
  showImportPassword: boolean;
  setShowImportPassword: React.Dispatch<React.SetStateAction<boolean>>;
  mode: ImportMode;
  setMode: (m: ImportMode) => void;
  confirmReplace: boolean;
  onConfirmReplace: () => void;
  onCancelReplace: () => void;
  phase: Phase;
  result: DataSyncImportResult | null;
  error: "invalid" | "wrongPassword" | null;
  onImport: () => void;
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

function ImportTab({
  file,
  fileEncrypted,
  onFileChange,
  importPassword,
  setImportPassword,
  showImportPassword,
  setShowImportPassword,
  mode,
  setMode,
  confirmReplace,
  onConfirmReplace,
  onCancelReplace,
  phase,
  result,
  error,
  onImport,
  dragOver,
  setDragOver,
  fileInputRef,
}: ImportTabProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[var(--color-warning-muted)] border border-[var(--color-warning)]">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[var(--color-warning)]" />
        <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
          {t("sync.import.warning")}
        </p>
      </div>

      {/* File picker / dropzone */}
      <div
        role="button"
        tabIndex={0}
        aria-label={t("sync.import.selectFile")}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          onFileChange(e.dataTransfer.files?.[0] ?? null);
        }}
        className={`p-5 rounded-xl border-2 border-dashed text-center cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none ${
          dragOver
            ? "border-[var(--color-accent)] bg-[var(--color-accent)]/5"
            : "border-[var(--color-border)] hover:bg-[var(--color-bg-hover)]"
        }`}
      >
        <Upload className="w-6 h-6 mx-auto mb-2 text-[var(--color-accent)]" />
        <p className="text-sm text-[var(--color-text-secondary)] text-center break-all">
          {file ? file.name : t("sync.import.dragDrop")}
        </p>
        <p className="text-xs text-[var(--color-text-muted)] text-center mt-1">
          {t("sync.import.acceptedFormats")}
        </p>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".open3dcalc"
        onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
        className="sr-only"
        aria-label={t("sync.import.selectFile")}
      />

      {fileEncrypted && (
        <div className="space-y-1.5">
          <label
            htmlFor="sync-import-password"
            className="block text-xs font-medium text-[var(--color-text-secondary)]"
          >
            {t("sync.import.password")}
          </label>
          <div className="relative">
            <input
              id="sync-import-password"
              type={showImportPassword ? "text" : "password"}
              value={importPassword}
              onChange={(e) => setImportPassword(e.target.value)}
              placeholder={t("sync.import.passwordPlaceholder")}
              className="w-full pr-10 px-3.5 py-2.5 rounded-xl text-sm bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            />
            <button
              type="button"
              onClick={() => setShowImportPassword((v) => !v)}
              aria-label={
                showImportPassword
                  ? t("sync.import.passwordHide", "Ocultar senha")
                  : t("sync.import.passwordShow", "Mostrar senha")
              }
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
            >
              {showImportPassword ? (
                <Unlock className="w-4 h-4" />
              ) : (
                <Lock className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Import mode selector */}
      <fieldset>
        <legend className="text-xs font-medium text-[var(--color-text-secondary)] mb-2">
          {t("sync.import.mode")}
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <ModeOption
            mode="merge"
            selected={mode === "merge"}
            onSelect={setMode}
            title={t("sync.import.modeMerge")}
            description={t("sync.import.modeMergeDesc")}
          />
          <ModeOption
            mode="replace"
            selected={mode === "replace"}
            onSelect={setMode}
            title={t("sync.import.modeReplace")}
            description={t("sync.import.modeReplaceDesc")}
          />
        </div>
      </fieldset>

      {confirmReplace && (
        <div
          role="alert"
          className="p-3 rounded-xl bg-[var(--color-warning-muted)] border border-[var(--color-warning)] space-y-3"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[var(--color-warning)]" />
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              {t("sync.import.replaceConfirm")}
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancelReplace}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              onClick={onConfirmReplace}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-[var(--color-danger)] text-white hover:opacity-90 transition-opacity focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
            >
              {t("common.confirm")}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <button
          onClick={onImport}
          disabled={!file || phase === "working" || confirmReplace}
          className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold bg-[var(--color-accent)] text-[var(--color-text-primary)] hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-60 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
        >
          <Upload className="w-4 h-4" />
          {t("sync.import.button")}
        </button>

        {phase === "working" && (
          <p
            role="status"
            className="flex items-center justify-center gap-2 text-sm text-[var(--color-text-muted)]"
          >
            <span
              className="w-4 h-4 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin"
              aria-hidden="true"
            />
            {t("sync.import.importing")}
          </p>
        )}

        {phase === "success" && result && (
          <div role="status" className="space-y-1.5">
            <p className="flex items-center gap-2 text-sm text-[var(--color-success)]">
              <CheckCircle className="w-4 h-4 shrink-0" />
              {t("sync.import.success")}
            </p>
            <ul className="text-sm text-[var(--color-text-secondary)] space-y-1">
              <li>
                {t("sync.import.results.imported", { count: result.imported })}
              </li>
              <li>
                {t("sync.import.results.conflicts", {
                  count: result.conflicts,
                })}
              </li>
              {result.errors > 0 && (
                <li className="text-[var(--color-danger)]">
                  {t("sync.import.results.errors", { count: result.errors })}
                </li>
              )}
            </ul>
          </div>
        )}

        {phase === "error" && error && (
          <p
            role="alert"
            className="flex items-center gap-2 text-sm text-[var(--color-danger)]"
          >
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error === "wrongPassword"
              ? t("sync.import.wrongPassword")
              : t("sync.import.invalidFile")}
          </p>
        )}
      </div>
    </div>
  );
}

interface ModeOptionProps {
  mode: ImportMode;
  selected: boolean;
  onSelect: (m: ImportMode) => void;
  title: string;
  description: string;
}

function ModeOption({
  mode,
  selected,
  onSelect,
  title,
  description,
}: ModeOptionProps) {
  return (
    <label
      className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
        selected
          ? "border-[var(--color-accent)] bg-[var(--color-accent)]/5"
          : "border-[var(--color-border)] hover:bg-[var(--color-bg-hover)]"
      }`}
    >
      <input
        type="radio"
        name="sync-import-mode"
        value={mode}
        checked={selected}
        onChange={() => onSelect(mode)}
        className="mt-0.5 w-4 h-4 accent-[var(--color-accent)]"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-[var(--color-text-primary)]">
          {title}
        </span>
        <span className="block text-xs text-[var(--color-text-muted)] mt-0.5">
          {description}
        </span>
      </span>
    </label>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
