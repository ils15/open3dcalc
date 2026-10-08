import { useEffect, useRef, useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, RefreshCw, X } from "lucide-react";
// The LEAF module, deliberately not the bridge: the bridge is what a test of
// the entry point mocks, so importing it from a component mounted by that same
// entry point makes every such mock incomplete. See unavailableClasses.ts.
import {
  getUnavailableClasses,
  type UnavailableEntry,
} from "@/platform/desktop/overrides/unavailableClasses";

/**
 * The two faces of a persistence bridge that could not do its job.
 *
 * The desktop entry starts the SQLite bridge and only renders `<App/>` once it
 * resolves, so stores hydrate from durable data instead of stale localStorage.
 * That ordering is the point — and it had no rejection path, so every failure
 * the bridge can raise produced a BLANK WINDOW: a `CryptoDeniedError`
 * refusal on a quarantined PII key (ADR-002 §2.2.1, `persistGate.ts`), a
 * manifest that will not load, a SQLite error on the first `listKeys`. The
 * renderer had nothing on screen, so there was nothing to read, nothing to
 * focus and no record that the app had decided not to start.
 *
 * `<StartupBridgeFailure>` is that missing rejection path. `<DbErrorBanner>`
 * is the production subscriber for `open3dcalc:db-error`, the event the bridge
 * dispatches on `document` after five consecutive failures — a signal that
 * until now had exactly one listener in the tree, and it was a test.
 *
 * Neither reads a store. The bridge can fail *because* a gated key is
 * quarantined, so anything that resolves a PII store to render this would be
 * reading the very state that caused it; both take their whole input from
 * props and from the DOM event, and nothing else.
 */

/** The event the bridge dispatches on `document` once failures pile up. */
export const DB_ERROR_EVENT = "open3dcalc:db-error";

/**
 * The event the bridge dispatches when a key exists but could not be read.
 *
 * LISTENED ON `window`, not `document`, and the bridge dispatches on both. That
 * is not redundancy: jsdom (and the DOM) default `CustomEvent.bubbles` to
 * false, so an event dispatched on `document` never reaches a listener on
 * `window`. Dispatching only on `document` made this signal unobservable from
 * anywhere except a `document` listener, which is how an announcement nobody
 * can receive becomes indistinguishable from no announcement.
 */
export const PII_UNAVAILABLE_EVENT = "open3dcalc:pii-unavailable";

/**
 * The main-process refusal code for "the manifest ITSELF could not be loaded".
 *
 * Distinct from every per-key reason: on this class no key can be classified,
 * so the surface says the whole profile is unavailable rather than offering
 * per-key recovery. Reusing the per-key copy here would describe data that
 * "could not be decrypted" when the actual failure is that nothing could be
 * evaluated at all.
 */
const MANIFEST_UNAVAILABLE_REASON = "manifest_unavailable";

// `UnavailableEntry` is re-exported from the leaf module so a consumer can name
// the type without importing this component. It is NOT declared here: a second
// copy of this shape is a second thing to keep in step with the bridge.
export type { UnavailableEntry } from "@/platform/desktop/overrides/unavailableClasses";

interface BridgeErrorSurfaceProps {
  /** Names the landmark, so it is reachable and announced as a region. */
  label: string;
  title: string;
  /** Announced on arrival — this is the text a screen reader must read out. */
  message: string;
  /** Technical detail, or null when there is nothing to add. */
  detail?: string | null;
  actionLabel: string;
  onAction: () => void;
  actionIcon: ReactElement;
  /** When set, a second control that only closes the surface. */
  dismissLabel?: string;
  onDismiss?: () => void;
  /**
   * `page` fills the window — the app never mounted, so this IS the app.
   * `banner` is a persistent strip above a running app, the shape
   * `DemoModeIndicator` already uses.
   */
  variant: "page" | "banner";
}

/**
 * The shared shell of both surfaces.
 *
 * Follows `DemoModeIndicator`: a `<section aria-label>` landmark, because this
 * is a PERSISTENT state rather than a transient — it does not dismiss itself
 * on a timer, so it must not be a toast. The failure text itself is
 * `role="alert"`, which is the `Toast` pattern: drawn *and* announced.
 *
 * Deliberately in normal flow with no `z-index`. Nothing else is mounted in
 * the `page` case, and in the `banner` case this sits above a running app the
 * way the demo and update notices do — so it cannot end up in the modal tier
 * that `focusModeLayering` pins.
 *
 * Contrast: the pair is `--danger-fill` / `--danger-fill-fg`, the same
 * non-flipping ink over a solid fill `Toast` uses. The wash scanner's family
 * is exactly `accent|primary|positive|success|danger|critical|warning|info|
 * revenue|cost`, so `-fill` suffixed tokens are outside its scope — and the
 * pairing is already measured in both themes, so this is not a new claim.
 */
function BridgeErrorSurface({
  label,
  title,
  message,
  detail,
  actionLabel,
  onAction,
  actionIcon,
  dismissLabel,
  onDismiss,
  variant,
}: BridgeErrorSurfaceProps): ReactElement {
  const actionRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Moving focus is right on FIRST mount — nothing else has been focused,
    // so `document.body` owns it — and wrong on every later commit, where the
    // user is mid-interaction somewhere. Same rule as `DemoModeIndicator`.
    if (document.activeElement === document.body) {
      actionRef.current?.focus();
    }
  }, []);

  const filled = variant === "page";

  return (
    <section
      aria-label={label}
      className={
        filled
          ? "min-h-dvh w-full flex items-center justify-center p-6 bg-[var(--surface-canvas)]"
          : "w-full border-b border-[var(--color-danger)]/30 bg-[var(--color-danger-fill)]"
      }
    >
      <div
        className={
          filled
            ? "surface rounded-2xl p-6 sm:p-8 w-full max-w-2xl space-y-4 border-l-4 border-[var(--color-danger)]"
            : "px-4 sm:px-6 lg:px-12 py-3 flex items-center gap-3"
        }
      >
        <AlertTriangle
          className={
            filled
              ? "w-6 h-6 shrink-0 mt-1 text-[var(--color-danger)]"
              : "w-5 h-5 shrink-0 text-[var(--danger-fill-fg)]"
          }
          aria-hidden="true"
        />

        <div className="min-w-0 flex-1">
          <h1
            className={
              filled
                ? "text-lg font-bold text-[var(--color-text-primary)]"
                : "text-sm font-bold text-[var(--danger-fill-fg)]"
            }
          >
            {title}
          </h1>
          <p
            role="alert"
            className={
              filled
                ? "text-sm text-[var(--color-text-secondary)] mt-1"
                : "text-xs text-[var(--danger-fill-fg)]"
            }
          >
            {message}
          </p>
          {detail && (
            <p
              className={
                filled
                  ? "text-xs text-[var(--color-text-muted)] mt-1 font-mono break-words"
                  : "text-[11px] text-[var(--danger-fill-fg)] opacity-90"
              }
            >
              {detail}
            </p>
          )}
        </div>

        <div
          className={
            filled
              ? "flex items-center gap-3"
              : "flex items-center gap-2 shrink-0"
          }
        >
          <button
            ref={actionRef}
            type="button"
            onClick={onAction}
            className={
              filled
                ? "inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-xl text-sm font-semibold bg-[var(--color-danger-fill)] text-[var(--color-danger-fill-fg)] hover:bg-[var(--color-danger-fill-hover)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
                : "inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 text-xs font-bold rounded-lg bg-[var(--danger-fill-fg)] text-[var(--danger-fill)] hover:opacity-90 transition-opacity focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
            }
          >
            {actionIcon}
            {actionLabel}
          </button>
          {onDismiss && dismissLabel && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label={dismissLabel}
              className={
                filled
                  ? "inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-xl text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
                  : "shrink-0 rounded focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
              }
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * Why the bridge refused, as a bare code — never its message.
 *
 * A `CryptoDeniedError` carries a reason code (`quarantined_read_only`,
 * `no_capability`, `write_path_disabled`, `locked`, `unknown_key`, …) and a
 * SQLite error carries a message that can name a file path on disk. Only the
 * code and the error class are shown: those identify the failure for support,
 * and they are what the bridge's own logs already carry (key NAMES only, never
 * values, §3.2).
 *
 * The reason is read from the `reason` FIELD, not out of the message. The two
 * used to be conflated — the constructor took a reason and only interpolated
 * it — and every denial then rendered as the bare class name
 * `CryptoDeniedError`, which tells support nothing about which of five
 * mutually exclusive causes they are looking at. `CryptoDeniedError.reason` is
 * a compile-time constant at every construction site, so it carries no PII.
 *
 * KNOWN LIMIT — the reason does not survive the IPC boundary, yet. The bridge
 * reaches SQLite through `ipcRenderer.invoke`, and a handler that throws is
 * serialised on its way back, so only the fields Electron's serialisation
 * preserves (`name`, `message`, `stack`) are guaranteed to arrive in the
 * renderer; a custom own property is not among them. This function therefore
 * resolves the reason only for errors raised IN the renderer, and falls back
 * to the class name for a refusal that crossed `db:save`. Closing that needs
 * the main process to hand back a structured reason of its own
 * (`electron/main.ts`), which is out of scope for this change — so the surface
 * says what it can and does not pretend the rest.
 */
function refusalReason(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const candidate = error as { reason?: unknown; name?: unknown };
    if (typeof candidate.reason === "string" && candidate.reason) {
      return candidate.reason;
    }
    if (typeof candidate.name === "string" && candidate.name)
      return candidate.name;
  }
  return typeof error === "string" && error ? error : "unknown";
}

/**
 * The whole window, for a bridge that refused to start at all.
 *
 * Rendered INSTEAD of `<App/>`, never beside it: a renderer that hydrated from
 * localStorage after a failed migration looks like it worked, and then loses
 * every write the user makes. The retry control reloads the window, which
 * re-runs the bridge — the only honest way back, since the refusal usually
 * comes from on-disk state (a quarantined row, a manifest that moved) and not
 * from anything this renderer can repair.
 */
export function StartupBridgeFailure({
  error,
}: {
  error: unknown;
}): ReactElement {
  const { t } = useTranslation();

  return (
    <BridgeErrorSurface
      variant="page"
      label={t("persistence.bridge.startupAriaLabel")}
      title={t("persistence.bridge.startupTitle")}
      message={t("persistence.bridge.startupMessage")}
      detail={t("persistence.bridge.startupDetail", {
        reason: refusalReason(error),
      })}
      actionLabel={t("persistence.bridge.retry")}
      actionIcon={<RefreshCw className="w-4 h-4" aria-hidden="true" />}
      onAction={() => window.location.reload()}
    />
  );
}

/**
 * The bridge's own `open3dcalc:db-error` signal, finally listened to.
 *
 * Fires after five consecutive failures, which is the bridge's "the user
 * should know" threshold rather than its first hiccup — a persistent strip is
 * the right shape for it, and the one control it carries is a dismissal,
 * because the app is still running and still usable; only durability is gone.
 * The message is the bridge's, verbatim, so there is one wording of the
 * failure in the product rather than two.
 */
export function DbErrorBanner(): ReactElement | null {
  const { t } = useTranslation();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const onDbError = (event: Event): void => {
      const detail = (event as CustomEvent<{ message?: unknown }>).detail;
      setMessage(
        typeof detail?.message === "string" && detail.message
          ? detail.message
          : t("persistence.bridge.runtimeTitle"),
      );
    };
    document.addEventListener(DB_ERROR_EVENT, onDbError);
    return () => document.removeEventListener(DB_ERROR_EVENT, onDbError);
  }, [t]);

  if (message === null) return null;

  return (
    <BridgeErrorSurface
      variant="banner"
      label={t("persistence.bridge.runtimeAriaLabel")}
      title={t("persistence.bridge.runtimeTitle")}
      message={message}
      actionLabel={t("persistence.bridge.dismiss")}
      actionIcon={<X className="w-3.5 h-3.5" aria-hidden="true" />}
      onAction={() => setMessage(null)}
      dismissLabel={t("persistence.bridge.dismiss")}
      onDismiss={() => setMessage(null)}
    />
  );
}

/**
 * Keep only entries that are shaped like a refusal: a key NAME and a code.
 *
 * An event `detail` is untrusted input — anything can dispatch on `window` — so
 * a malformed entry is dropped rather than rendered. A refusal must never
 * degrade into `[object Object]` in a surface whose whole job is to be
 * diagnosable.
 */
function parseUnavailable(raw: unknown): UnavailableEntry[] {
  return Array.isArray(raw)
    ? raw.filter(
        (u): u is UnavailableEntry =>
          typeof u === "object" &&
          u !== null &&
          typeof (u as UnavailableEntry).key === "string" &&
          typeof (u as UnavailableEntry).reason === "string",
      )
    : [];
}

/**
 * Per-key isolation, made visible.
 *
 * The app now STARTS with a profile whose legacy blobs it cannot read: the
 * bridge quarantines the unreadable keys, hydrates every other key, and says
 * so. This banner is the other half of that promise — without it the isolation
 * is invisible, and "my customers are gone" is indistinguishable from "this app
 * decided not to show you your customers", which is the reading a user forms
 * from empty state. It states explicitly that nothing was deleted.
 *
 * The codes are rendered verbatim rather than translated: they are the
 * main process's own refusal codes, they are what a bug report needs, and a
 * paraphrase of `legacy_unbound_encryption` diagnoses nothing. Only key NAMES
 * and codes reach this surface — never a value (§3.2).
 */
export function PiiUnavailableBanner(): ReactElement | null {
  const { t } = useTranslation();
  // Read the latch in the INITIALIZER, not in an effect. The bridge raised this
  // during `initPersistenceBridge()`, which main.tsx awaits before rendering, so
  // the event has already fired by the time this mounts and a listener alone
  // would subscribe to nothing. A lazy initializer reads that latched state
  // during the first render; setting it from inside the effect body would be a
  // second render pass for a value that is already known.
  const [entries, setEntries] = useState<UnavailableEntry[] | null>(() => {
    const latched = parseUnavailable(getUnavailableClasses());
    return latched.length > 0 ? latched : null;
  });

  useEffect(() => {
    const onUnavailable = (event: Event): void => {
      const detail = (event as CustomEvent<{ unavailable?: unknown }>).detail;
      const parsed = parseUnavailable(detail?.unavailable);
      if (parsed.length > 0) setEntries(parsed);
    };
    window.addEventListener(PII_UNAVAILABLE_EVENT, onUnavailable);
    return () =>
      window.removeEventListener(PII_UNAVAILABLE_EVENT, onUnavailable);
  }, []);

  if (entries === null) return null;

  // An unloadable manifest is not a per-key refusal: there is no key to
  // recover, and "some of your data could not be decrypted" is the wrong
  // reading. It gets its own copy that says plainly that nothing is being
  // written OR deleted, because that is exactly what the bridge now does —
  // refuses writes and skips the sweep — and a user staring at an empty app
  // needs to know their data is still on disk. The reason code is shown because
  // it is what support diagnoses from.
  if (entries.some((e) => e.reason === MANIFEST_UNAVAILABLE_REASON)) {
    return (
      <BridgeErrorSurface
        variant="banner"
        label={t("persistence.manifestUnavailable.ariaLabel")}
        title={t("persistence.manifestUnavailable.title")}
        message={t("persistence.manifestUnavailable.message")}
        detail={t("persistence.manifestUnavailable.detail", {
          reason: MANIFEST_UNAVAILABLE_REASON,
        })}
        actionLabel={t("persistence.bridge.dismiss")}
        actionIcon={<X className="w-3.5 h-3.5" aria-hidden="true" />}
        onAction={() => setEntries(null)}
        dismissLabel={t("persistence.bridge.dismiss")}
        onDismiss={() => setEntries(null)}
      />
    );
  }

  const detail = entries
    .map(
      (e) =>
        `${e.key} (${e.reason}) — ${
          e.recoverable
            ? t("persistence.recovery.recoverable")
            : t("persistence.recovery.unrecoverable")
        }`,
    )
    .join("\n");

  // Per-key legacy recovery is PERMANENTLY DISABLED: `privacy:recover-key` is
  // rejected by the main process and is no longer exposed through the preload
  // bridge, so this surface must not offer an action that can never succeed. It
  // discloses the refusal codes (what support diagnoses from) plus an explicit
  // unavailability note, and offers only a dismissal — no value is read and
  // nothing is deleted.
  return (
    <BridgeErrorSurface
      variant="banner"
      label={t("persistence.recovery.ariaLabel")}
      title={t("persistence.recovery.title")}
      message={t("persistence.recovery.message")}
      detail={[
        t("persistence.recovery.detail", { reason: detail }),
        t("persistence.recovery.unavailable"),
      ]
        .filter(Boolean)
        .join("\n")}
      actionLabel={t("persistence.bridge.dismiss")}
      actionIcon={<X className="w-3.5 h-3.5" aria-hidden="true" />}
      onAction={() => setEntries(null)}
      dismissLabel={t("persistence.bridge.dismiss")}
      onDismiss={() => setEntries(null)}
    />
  );
}
