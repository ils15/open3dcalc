import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import enUS from "@/shared/i18n/locales/en-US.json";
import ptBR from "@/shared/i18n/locales/pt-BR.json";
import i18n from "@/shared/i18n/i18n";
import { useLegacyKeepReadOnlyStore } from "@/shared/stores/legacyKeepReadOnlyStore";
import { useConsentStore } from "@/shared/stores/consentStore";
import { PrivacyScreen } from "../PrivacyScreen";

// ---------------------------------------------------------------------------
// D1.1 S4 — privacy screen: presents the quarantine state (metadata only)
// and the two explicit exits (migrate / eliminate — ADR-002 §2.2.3/§2.2.4).
// ---------------------------------------------------------------------------

const hoisted = vi.hoisted(() => ({
  quarantineReport: vi.fn(),
  authorizeErasure: vi.fn(),
  claimErasure: vi.fn(),
  erasureStatus: vi.fn(),
  startErasure: vi.fn(),
  purgeRendererStores: vi.fn(),
  purgeCalls: [] as unknown[][],
  migrateKey: vi.fn(),
  eliminateKey: vi.fn(),
  legacyRows: vi.fn(),
  evaluateReceipt: vi.fn(),
  // `t` is the IDENTITY by default, because the specs above pin i18n KEYS and
  // a resolving `t` would rename every assertion in them. The SPEC-04 spec at
  // the bottom flips this to the real i18next instance, which is the only way
  // to see what a wrong namespace prefix does: it renders the key itself.
  tMode: "identity" as "identity" | "real",
}));

vi.mock("@/shared/lib/erasureSaga/rendererSweep", () => ({
  purgeRendererStores: (...args: unknown[]) => {
    hoisted.purgeCalls.push(args);
    return hoisted.purgeRendererStores(...args);
  },
}));

vi.mock("@/shared/lib/consentReceipt", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/shared/lib/consentReceipt")>();
  return { ...actual, evaluateReceipt: hoisted.evaluateReceipt };
});

vi.mock("react-i18next", () => {
  const identity = (key: string, opts?: Record<string, unknown>) => {
    if (opts && "key" in opts) return `${key}:${String(opts.key)}`;
    if (opts && "count" in opts) return `${key}:${String(opts.count)}`;
    return key;
  };
  // One stable `t`, not one per render: `loadReport` is a `useCallback` over
  // `t`, so a fresh function every render would re-fire the report effect on
  // every commit and the specs above would see six loads instead of one.
  const t = (key: string, opts?: Record<string, unknown>): string =>
    hoisted.tMode === "real" ? i18n.t(key, opts) : identity(key, opts);
  return {
    useTranslation: () => ({ t }),
    // `@/shared/i18n/i18n` calls `.use(initReactI18next)` at import time and the
    // SPEC-04 spec reads real copy off that instance. `useTranslation` is
    // mocked, so the plugin has nothing left to wire up.
    initReactI18next: { type: "3rdParty", init: () => undefined },
  };
});

const baseReport = {
  scannedAt: new Date().toISOString(),
  entries: [
    { key: "open3dcalc_quotes_v1", status: "quarantined", recordCount: 3 },
    { key: "open3dcalc_settings_v2", status: "non_pii" },
  ],
  quarantinedKeys: ["open3dcalc_quotes_v1"],
};

function stubElectronApi(): void {
  vi.stubGlobal("navigator", { userAgent: "Electron/40.0" });
  vi.stubGlobal("electronAPI", {
    privacy: {
      quarantineReport: hoisted.quarantineReport,
      migrateKey: hoisted.migrateKey,
      eliminateKey: hoisted.eliminateKey,
      legacyRows: hoisted.legacyRows,
    },
    erasure: {
      authorize: hoisted.authorizeErasure,
      claim: hoisted.claimErasure,
      start: hoisted.startErasure,
      status: hoisted.erasureStatus,
    },
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
  hoisted.purgeCalls.length = 0;
  hoisted.tMode = "identity";
  hoisted.evaluateReceipt.mockResolvedValue({
    status: "absent",
    consentGiven: false,
    currentPolicyHash: "sha256:synthetic",
    currentPolicyVersion: "2026.09",
  });
  hoisted.quarantineReport.mockResolvedValue(baseReport);
  hoisted.authorizeErasure.mockResolvedValue({ token: "synthetic-token" });
  hoisted.claimErasure.mockResolvedValue({
    targets: [{ surface: "localStorage", id: "open3dcalc_customers_v1" }],
  });
  hoisted.erasureStatus.mockResolvedValue({ active: false, available: false });
  hoisted.startErasure.mockResolvedValue({
    receipt: {
      stores_completed: ["localstorage"],
      external_copies_notice: ["external copy notice"],
    },
    rolledBack: false,
  });
  hoisted.purgeRendererStores.mockResolvedValue({});
  hoisted.legacyRows.mockRejectedValue(new Error("disabled IPC"));
  hoisted.migrateKey.mockResolvedValue({
    key: "open3dcalc_quotes_v1",
    migrated: true,
    verified: true,
  });
  hoisted.eliminateKey.mockResolvedValue({
    key: "open3dcalc_quotes_v1",
    eliminated: true,
  });
});

describe("PrivacyScreen (D1.1 S4)", () => {
  it("reports unavailable quarantine status without invoking disabled IPC or claiming empty residue", async () => {
    stubElectronApi();
    render(<PrivacyScreen />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "privacy.quarantine.inspectionPaused",
    );
    expect(screen.queryByText("privacy.quarantine.noQuarantined")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "privacy.quarantine.migrate" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "privacy.quarantine.eliminate" }),
    ).toBeNull();
    expect(hoisted.quarantineReport).not.toHaveBeenCalled();
    expect(hoisted.migrateKey).not.toHaveBeenCalled();
    expect(hoisted.eliminateKey).not.toHaveBeenCalled();
    expect(
      await screen.findByRole("button", {
        name: "privacy.consent_receipt.grant",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "privacy.erasure.button" }),
    ).toBeInTheDocument();
  });

  it("does not call renderer purge when durable authorization persistence fails", async () => {
    stubElectronApi();
    hoisted.erasureStatus.mockResolvedValueOnce({
      active: false,
      available: true,
      blockerCodes: [],
    });
    hoisted.authorizeErasure.mockRejectedValueOnce(
      new Error("synthetic journal persistence failure"),
    );
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<PrivacyScreen />);

    const button = await screen.findByRole("button", {
      name: "privacy.erasure.button",
    });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);

    await waitFor(() =>
      expect(hoisted.authorizeErasure).toHaveBeenCalledOnce(),
    );
    expect(hoisted.claimErasure).not.toHaveBeenCalled();
    expect(hoisted.purgeRendererStores).not.toHaveBeenCalled();
  });

  it.each([
    ["missing authorization", undefined],
    ["invalid authorization", { token: "not-a-token" }],
    ["expired authorization", { token: "expired-token" }],
    ["replayed authorization", { token: "replayed-token" }],
  ])("does not purge when main rejects %s", async (_name, authorization) => {
    stubElectronApi();
    hoisted.erasureStatus.mockResolvedValueOnce({
      active: false,
      available: true,
      blockerCodes: [],
    });
    hoisted.authorizeErasure.mockResolvedValueOnce(authorization);
    hoisted.claimErasure.mockRejectedValueOnce(
      new Error("authorization denied"),
    );
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<PrivacyScreen />);

    const button = await screen.findByRole("button", {
      name: "privacy.erasure.button",
    });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);

    await waitFor(() => {
      if (authorization && typeof authorization.token === "string") {
        expect(hoisted.claimErasure).toHaveBeenCalledOnce();
      } else {
        expect(hoisted.authorizeErasure).toHaveBeenCalledOnce();
      }
    });
    expect(hoisted.purgeRendererStores).not.toHaveBeenCalled();
  });

  it("reports unavailable status when the Electron preload bridge is missing", () => {
    vi.stubGlobal("navigator", { userAgent: "Electron/40.0" });
    render(<PrivacyScreen />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "privacy.quarantine.inspectionPaused",
    );
    expect(screen.queryByText("privacy.quarantine.desktopOnly")).toBeNull();
    expect(
      screen.getByRole("button", { name: "privacy.erasure.button" }),
    ).toBeDisabled();
    expect(hoisted.quarantineReport).not.toHaveBeenCalled();
  });

  it("renders a truthful paused quarantine notice, never a load-failure claim", () => {
    stubElectronApi();
    render(<PrivacyScreen />);

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("privacy.quarantine.inspectionPaused");
    expect(status).not.toHaveTextContent("privacy.quarantine.loadError");
  });

  it("discloses that delete-all is unavailable and keeps the control disabled", async () => {
    stubElectronApi();
    render(<PrivacyScreen />);

    expect(await screen.findByTestId("erasure-unavailable")).toHaveTextContent(
      "privacy.erasure.unavailable",
    );
    expect(
      screen.getByRole("button", { name: "privacy.erasure.button" }),
    ).toBeDisabled();
  });

  it("surfaces the exact blocker codes behind an unavailable delete-all", async () => {
    stubElectronApi();
    hoisted.erasureStatus.mockResolvedValueOnce({
      active: false,
      available: false,
      blockerCodes: ["manifest_code_mismatch", "unmapped_pii_target"],
    });
    render(<PrivacyScreen />);

    // The disabled control must say WHY it is disabled, with the main process's
    // own blocker codes, so "unavailable" is diagnosable rather than a shrug.
    expect(await screen.findByTestId("erasure-unavailable")).toHaveTextContent(
      "privacy.erasure.unavailable",
    );
    const blockers = await screen.findByTestId("erasure-blockers");
    expect(blockers).toHaveTextContent("privacy.erasure.blockersLabel");
    expect(blockers).toHaveTextContent("manifest_code_mismatch");
    expect(blockers).toHaveTextContent("unmapped_pii_target");
    expect(
      screen.getByRole("button", { name: "privacy.erasure.button" }),
    ).toBeDisabled();
  });

  it("never claims success when main reports delete-all unavailable", async () => {
    stubElectronApi();
    hoisted.erasureStatus.mockResolvedValueOnce({
      active: false,
      available: false,
      blockerCodes: ["manifest_unavailable"],
    });
    render(<PrivacyScreen />);

    // The control is disabled, so there is no success path to reach; the
    // receipt block must never appear on an unavailable saga.
    await screen.findByTestId("erasure-unavailable");
    expect(screen.queryByText("privacy.erasure.done")).toBeNull();
    expect(hoisted.startErasure).not.toHaveBeenCalled();
    expect(hoisted.purgeRendererStores).not.toHaveBeenCalled();
  });

  it("does not render stale report values when quarantine IPC is disabled", () => {
    stubElectronApi();
    render(<PrivacyScreen />);
    expect(screen.queryByText(/open3dcalc_quotes_v1/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Fernanda/)).not.toBeInTheDocument();
  });

  it("shows the desktop-only notice on web (no electronAPI)", () => {
    render(<PrivacyScreen />);
    expect(
      screen.getByText("privacy.quarantine.desktopOnly"),
    ).toBeInTheDocument();
    expect(hoisted.quarantineReport).not.toHaveBeenCalled();
  });

  it("discloses the legacy residue panel on web (no electronAPI)", () => {
    render(<PrivacyScreen />);
    expect(
      screen.getByRole("region", { name: "privacy.residue.title" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "privacy.quarantine.refresh" }),
    ).toBeInTheDocument();
    expect(hoisted.quarantineReport).not.toHaveBeenCalled();
  });

  it("does not inspect desktop legacy residue until the user requests it", async () => {
    stubElectronApi();
    render(<PrivacyScreen />);
    expect(
      screen.getByRole("region", { name: "privacy.residue.title" }),
    ).toBeInTheDocument();
    expect(hoisted.legacyRows).not.toHaveBeenCalled();
    expect(hoisted.quarantineReport).not.toHaveBeenCalled();
  });

  it("runs the authorized plan and renders the honest receipt with external copies", async () => {
    stubElectronApi();
    hoisted.erasureStatus.mockResolvedValueOnce({
      active: false,
      available: true,
      blockerCodes: [],
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<PrivacyScreen />);

    const button = await screen.findByRole("button", {
      name: "privacy.erasure.button",
    });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);

    await waitFor(() =>
      expect(hoisted.authorizeErasure).toHaveBeenCalledOnce(),
    );
    await waitFor(() =>
      expect(hoisted.purgeCalls[0]?.[0]).toEqual([
        { surface: "localStorage", id: "open3dcalc_customers_v1" },
      ]),
    );
    expect(hoisted.startErasure).toHaveBeenCalledWith("synthetic-token", {});
    expect(await screen.findByText("privacy.erasure.done")).toBeInTheDocument();
    expect(screen.getByText("external copy notice")).toBeInTheDocument();
  });

  it("does not start the saga when the user cancels the confirmation", async () => {
    stubElectronApi();
    hoisted.erasureStatus.mockResolvedValueOnce({
      active: false,
      available: true,
      blockerCodes: [],
    });
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<PrivacyScreen />);

    const button = await screen.findByRole("button", {
      name: "privacy.erasure.button",
    });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);

    expect(hoisted.authorizeErasure).not.toHaveBeenCalled();
    expect(hoisted.startErasure).not.toHaveBeenCalled();
  });

  it("grants consent and refreshes into the active-receipt branch", async () => {
    stubElectronApi();
    const giveConsent = vi
      .spyOn(useConsentStore.getState(), "giveConsent")
      .mockResolvedValue(undefined);
    hoisted.evaluateReceipt
      .mockResolvedValueOnce({
        status: "absent",
        consentGiven: false,
        currentPolicyHash: "sha256:synthetic",
        currentPolicyVersion: "2026.09",
      })
      .mockResolvedValueOnce({
        status: "valid",
        consentGiven: true,
        currentPolicyHash: "sha256:synthetic",
        currentPolicyVersion: "2026.09",
      });
    const user = userEvent.setup();
    render(<PrivacyScreen />);

    await user.click(
      await screen.findByRole("button", {
        name: "privacy.consent_receipt.grant",
      }),
    );

    await waitFor(() => expect(giveConsent).toHaveBeenCalledOnce());
    expect(
      await screen.findByRole("button", {
        name: "privacy.consent_receipt.withdraw",
      }),
    ).toBeInTheDocument();
  });

  it("withdraws consent without surfacing an error on success", async () => {
    stubElectronApi();
    hoisted.evaluateReceipt.mockResolvedValue({
      status: "valid",
      consentGiven: true,
      currentPolicyHash: "sha256:synthetic",
      currentPolicyVersion: "2026.09",
    });
    const withdrawConsent = vi
      .spyOn(useConsentStore.getState(), "withdrawConsent")
      .mockResolvedValue(undefined);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    render(<PrivacyScreen />);

    await user.click(
      await screen.findByRole("button", {
        name: "privacy.consent_receipt.withdraw",
      }),
    );

    await waitFor(() => expect(withdrawConsent).toHaveBeenCalledOnce());
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

/**
 * L-2 — the way back to the legacy-migration choice. When a keep-read-only
 * decision is stored the screen must disclose it and offer to reopen the
 * choice, because the prompt no longer asks while the residue is unchanged.
 */
describe("PrivacyScreen (L-2) — reopen the keep-read-only choice", () => {
  afterEach(() => {
    useLegacyKeepReadOnlyStore.setState({ signature: null });
  });

  it("offers a way back to the choice when a decision is stored", () => {
    useLegacyKeepReadOnlyStore.setState({
      signature: "open3dcalc_customers_v1=1",
    });
    render(<PrivacyScreen />);

    expect(
      screen.getByText("privacy.migration.keepReadOnlyTitle"),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: "privacy.migration.keepReadOnlyReopen",
      }),
    );

    expect(useLegacyKeepReadOnlyStore.getState().signature).toBeNull();
    expect(
      screen.queryByRole("button", {
        name: "privacy.migration.keepReadOnlyReopen",
      }),
    ).toBeNull();
  });

  it("renders no control when no decision is stored", () => {
    render(<PrivacyScreen />);
    expect(
      screen.queryByRole("button", {
        name: "privacy.migration.keepReadOnlyReopen",
      }),
    ).toBeNull();
  });
});

/**
 * D1.1 S8 / SPEC-04 — the consent receipt block is TRANSLATED, not keyed.
 *
 * The defect this pins is not a missing key. Every string the block needs is
 * present and fully written in both locales — under `privacy.consent_receipt.*`
 * — while the call sites asked `privacy.consent.*` for six of them, which
 * resolves to nothing and renders the raw key ("privacy.consent.absent") in
 * the user's face. `privacy.consent.*` is a DIFFERENT, real namespace: the
 * ConsentModal heading, so repointing the block there would have kept showing
 * a key. The assertion is therefore made against the real i18next resources,
 * because a key-echoing `t` (what the specs above use) cannot tell a resolved
 * string from an unresolved one.
 */
describe("PrivacyScreen (SPEC-04) — the consent receipt block resolves real copy", () => {
  const LOCALES = [
    ["pt-BR", ptBR],
    ["en-US", enUS],
  ] as const;

  afterEach(async () => {
    await i18n.changeLanguage("pt-BR");
    hoisted.tMode = "identity";
  });

  const VERSION = "2026.09";

  /**
   * Render with the real resolver in `locale` and wait for the receipt.
   *
   * The receipt is evaluated in a deferred microtask, and until it lands the
   * block shows "…" — which would make every assertion below vacuous. So the
   * wait is on the branch copy itself, not on the heading, which renders
   * before the receipt exists.
   */
  async function renderIn(
    locale: "pt-BR" | "en-US",
    branch: "absent" | "granted",
  ): Promise<{ container: HTMLElement }> {
    stubElectronApi();
    await i18n.changeLanguage(locale);
    hoisted.tMode = "real";
    const view = render(<PrivacyScreen />);
    const dict = locale === "pt-BR" ? ptBR : enUS;
    const receipt = dict.privacy.consent_receipt;
    await waitFor(() =>
      expect(
        screen.getByText(
          branch === "absent"
            ? receipt.absent
            : receipt.granted.replace("{{version}}", VERSION),
        ),
      ).toBeInTheDocument(),
    );
    return view;
  }

  it.each(LOCALES)(
    "renders the default-deny branch as translated text in %s",
    async (locale, dict) => {
      await renderIn(locale, "absent");

      const receipt = dict.privacy.consent_receipt;
      expect(
        screen.getByRole("heading", { name: receipt.title }),
      ).toBeInTheDocument();
      expect(screen.getByText(receipt.absent)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: receipt.grant }),
      ).toBeInTheDocument();
      expect(screen.getByText(receipt.flagsNote)).toBeInTheDocument();
    },
  );

  it.each(LOCALES)(
    "renders the active-receipt branch as translated text in %s",
    async (locale, dict) => {
      hoisted.evaluateReceipt.mockResolvedValue({
        status: "valid",
        consentGiven: true,
        currentPolicyHash: "sha256:synthetic",
        currentPolicyVersion: VERSION,
      });
      const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
      const user = userEvent.setup();
      await renderIn(locale, "granted");

      const receipt = dict.privacy.consent_receipt;
      expect(
        screen.getByRole("heading", { name: receipt.title }),
      ).toBeInTheDocument();
      // Interpolated on the version, so the resolved string — not the template.
      expect(
        screen.getByText(receipt.granted.replace("{{version}}", VERSION)),
      ).toBeInTheDocument();
      const withdraw = screen.getByRole("button", { name: receipt.withdraw });
      expect(withdraw).toBeInTheDocument();

      await user.click(withdraw);
      // The withdrawal prompt is copy too, and it is the one a user is most
      // likely to read before acting on it.
      expect(confirm).toHaveBeenCalledWith(receipt.withdrawConfirm);
    },
  );

  it.each(LOCALES)(
    "leaves no unresolved privacy.consent.* key on screen in %s",
    async (locale, dict) => {
      const { container } = await renderIn(locale, "absent");

      // The six that were wrong, plus the title: none of them may survive as a
      // literal key now that the block reads `privacy.consent_receipt.*`.
      for (const key of [
        "absent",
        "flagsNote",
        "grant",
        "granted",
        "withdraw",
        "withdrawConfirm",
        "title",
      ]) {
        expect(
          container.textContent,
          `privacy.consent.${key} is rendered raw in ${locale}`,
        ).not.toContain(`privacy.consent.${key}`);
      }
      // And the block is not reading the ConsentModal namespace either.
      expect(container.textContent).not.toContain(dict.privacy.consent.title);
    },
  );
});

/**
 * Withdrawal honesty. The prior copy promised that data "will be erased",
 * while the store only removed locally reachable consent-basis localStorage
 * keys. Full-device erasure is unavailable in this slice, so the copy and the
 * failure path must say so instead of claiming erasure.
 */
describe("PrivacyScreen (SPEC-04) — honest withdrawal", () => {
  const LOCALES = [
    ["pt-BR", ptBR],
    ["en-US", enUS],
  ] as const;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(LOCALES)(
    "withdrawal copy does not promise erasure in %s",
    (_locale, dict) => {
      const receipt = dict.privacy.consent_receipt;
      expect(receipt.withdrawConfirm).not.toMatch(
        /will be erased|serão apagados/i,
      );
      expect(receipt.withdrawConfirm.length).toBeGreaterThan(0);
      expect(receipt.withdrawScopeNote.length).toBeGreaterThan(0);
      expect(receipt.withdrawFailed.length).toBeGreaterThan(0);
      expect(receipt.withdrawRetry.length).toBeGreaterThan(0);
    },
  );

  async function renderGranted(): Promise<void> {
    stubElectronApi();
    hoisted.evaluateReceipt.mockResolvedValue({
      status: "valid",
      consentGiven: true,
      currentPolicyHash: "sha256:synthetic",
      currentPolicyVersion: "2026.09",
    });
    render(<PrivacyScreen />);
    await screen.findByRole("button", {
      name: "privacy.consent_receipt.withdraw",
    });
  }

  it("shows the honest withdrawal scope note on the granted branch", async () => {
    await renderGranted();
    expect(
      screen.getByText("privacy.consent_receipt.withdrawScopeNote"),
    ).toBeInTheDocument();
  });

  it("surfaces a withdrawal failure with a retry, without claiming erasure", async () => {
    await renderGranted();
    const withdraw = vi
      .spyOn(useConsentStore.getState(), "withdrawConsent")
      .mockRejectedValueOnce(new Error("synthetic withdrawal failure"));
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();

    await user.click(
      screen.getByRole("button", { name: "privacy.consent_receipt.withdraw" }),
    );

    expect(withdraw).toHaveBeenCalledOnce();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("privacy.consent_receipt.withdrawFailed");
    expect(
      screen.getByRole("button", {
        name: "privacy.consent_receipt.withdrawRetry",
      }),
    ).toBeInTheDocument();
  });
});
