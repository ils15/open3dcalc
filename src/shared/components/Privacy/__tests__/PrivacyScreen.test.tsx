import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import enUS from "@/shared/i18n/locales/en-US.json";
import ptBR from "@/shared/i18n/locales/pt-BR.json";
import i18n from "@/shared/i18n/i18n";
import { useLegacyKeepReadOnlyStore } from "@/shared/stores/legacyKeepReadOnlyStore";
import { PrivacyScreen } from "../PrivacyScreen";

// ---------------------------------------------------------------------------
// D1.1 S4 — privacy screen: presents the quarantine state (metadata only)
// and the two explicit exits (migrate / eliminate — ADR-002 §2.2.3/§2.2.4).
// ---------------------------------------------------------------------------

const hoisted = vi.hoisted(() => ({
  quarantineReport: vi.fn(),
  migrateKey: vi.fn(),
  eliminateKey: vi.fn(),
  erasureStart: vi.fn(),
  evaluateReceipt: vi.fn(),
  // `t` is the IDENTITY by default, because the specs above pin i18n KEYS and
  // a resolving `t` would rename every assertion in them. The SPEC-04 spec at
  // the bottom flips this to the real i18next instance, which is the only way
  // to see what a wrong namespace prefix does: it renders the key itself.
  tMode: "identity" as "identity" | "real",
}));

vi.mock("@/shared/lib/consentReceipt", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/shared/lib/consentReceipt")>();
  return { ...actual, evaluateReceipt: hoisted.evaluateReceipt };
});

vi.mock("@/shared/lib/erasureSaga/rendererSweep", () => ({
  purgeRendererStores: vi.fn().mockResolvedValue({}),
}));

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

function stubElectronApi(): void {
  vi.stubGlobal("electronAPI", {
    privacy: {
      quarantineReport: hoisted.quarantineReport,
      migrateKey: hoisted.migrateKey,
      eliminateKey: hoisted.eliminateKey,
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  hoisted.tMode = "identity";
  hoisted.evaluateReceipt.mockResolvedValue({
    status: "absent",
    consentGiven: false,
    currentPolicyHash: "sha256:synthetic",
    currentPolicyVersion: "2026.09",
  });
  hoisted.erasureStart.mockResolvedValue({
    receipt: {
      stores_completed: ["test-store"],
      external_copies_notice: ["test-export"],
    },
    rolledBack: false,
  });
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
  it("shows unavailable without invoking disabled quarantine IPCs", async () => {
    stubElectronApi();
    render(<PrivacyScreen />);
    expect(
      await screen.findByText("privacy.quarantine.unavailable"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("privacy.quarantine.noQuarantined"),
    ).not.toBeInTheDocument();
    expect(hoisted.quarantineReport).not.toHaveBeenCalled();
    expect(hoisted.migrateKey).not.toHaveBeenCalled();
    expect(hoisted.eliminateKey).not.toHaveBeenCalled();
  });

  it("shows the desktop-only notice on web (no electronAPI)", () => {
    render(<PrivacyScreen />);
    expect(
      screen.getByText("privacy.quarantine.desktopOnly"),
    ).toBeInTheDocument();
    expect(hoisted.quarantineReport).not.toHaveBeenCalled();
  });

  it("reports unavailable when the quarantine bridge is missing", async () => {
    const electronAPI = { privacy: {} };
    Object.defineProperty(window, "electronAPI", {
      configurable: true,
      value: electronAPI,
    });
    render(<PrivacyScreen />);

    expect(
      await screen.findByText("privacy.quarantine.unavailable"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("privacy.quarantine.noQuarantined"),
    ).not.toBeInTheDocument();
    expect(hoisted.quarantineReport).not.toHaveBeenCalled();
  });

  it("does not invoke a present but disabled report IPC", async () => {
    stubElectronApi();
    hoisted.quarantineReport.mockRejectedValueOnce(new Error("disabled"));
    render(<PrivacyScreen />);

    expect(
      await screen.findByText("privacy.quarantine.unavailable"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("privacy.quarantine.noQuarantined"),
    ).not.toBeInTheDocument();
    expect(hoisted.quarantineReport).not.toHaveBeenCalled();
    expect(hoisted.migrateKey).not.toHaveBeenCalled();
    expect(hoisted.eliminateKey).not.toHaveBeenCalled();
  });

  it("reports the returned deletion receipt without claiming every copy was erased", async () => {
    vi.stubGlobal("electronAPI", {
      erasure: { start: hoisted.erasureStart },
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    render(<PrivacyScreen />);

    await user.click(
      screen.getByRole("button", { name: "privacy.erasure.button" }),
    );

    const done = await screen.findByText("privacy.erasure.done");
    const report = done.closest('[role="status"]');
    expect(report).not.toBeNull();
    expect(report).toHaveTextContent("test-store");
    expect(report).toHaveTextContent("test-export");
    expect(hoisted.erasureStart).toHaveBeenCalledTimes(1);
  });

  it("discloses the legacy residue panel on web (no electronAPI)", () => {
    render(<PrivacyScreen />);
    expect(
      screen.getByRole("region", { name: "privacy.residue.title" }),
    ).toBeInTheDocument();
  });

  it("discloses the legacy residue panel on desktop too", async () => {
    stubElectronApi();
    render(<PrivacyScreen />);
    expect(
      screen.getByRole("region", { name: "privacy.residue.title" }),
    ).toBeInTheDocument();
    expect(hoisted.quarantineReport).not.toHaveBeenCalled();
  });
});

describe("PrivacyScreen — automatic migration choice stays unavailable", () => {
  afterEach(() => {
    useLegacyKeepReadOnlyStore.setState({ signature: null });
  });

  it("does not offer an inert reopen control when migration choices are disabled", () => {
    useLegacyKeepReadOnlyStore.setState({
      signature: "open3dcalc_customers_v1=1",
    });
    render(<PrivacyScreen />);

    expect(
      screen.queryByRole("button", {
        name: "privacy.migration.keepReadOnlyReopen",
      }),
    ).not.toBeInTheDocument();
    expect(useLegacyKeepReadOnlyStore.getState().signature).toBe(
      "open3dcalc_customers_v1=1",
    );
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

  it.each([
    [
      "pt-BR",
      ptBR,
      {
        description:
          "Remove todos os seus dados de todas as superfícies de armazenamento do aplicativo (banco de dados, arquivos, caches e backups internos), de forma verificável e com recibo. Pacotes de exportação que você salvou fora do app não são alcançáveis.",
        done: "O processo de exclusão retornou um recibo. Ele informa os armazenamentos processados, mas não verifica se todas as cópias foram removidas.",
        confirm:
          "Apagar TODOS os seus dados? Um snapshot criptografado permite reverter por até 7 dias em caso de falha. Depois de concluído, a remoção é definitiva. Continuar?",
        failed:
          "O processo de exclusão informou uma falha. Não foi possível confirmar o estado final; revise seus dados antes de tentar novamente.",
        processedStores: "Armazenamentos informados como processados:",
        withdrawConfirm:
          "Retirar o consentimento? Os dados coletados sob essa permissão serão apagados conforme a política (SPEC-04 §6) e os recursos afetados serão bloqueados.",
        section8Lgpd:
          "Em conformidade com o Art. 18 da LGPD (direito à portabilidade dos dados), você pode exportar seus dados a qualquer momento e importá-los em outro dispositivo.",
      },
    ],
    [
      "en-US",
      enUS,
      {
        description:
          "Removes all your data from every app storage surface (database, files, caches and internal backups), verifiably and with a receipt. Export packages you saved outside the app are out of reach.",
        done: "The deletion process returned a receipt. It reports stores processed but does not verify that every copy was removed.",
        confirm:
          "Delete ALL your data? An encrypted snapshot allows rollback for up to 7 days in case of failure. Once committed, removal is permanent. Continue?",
        failed:
          "The deletion process reported a failure. The final state could not be confirmed; review your data before trying again.",
        processedStores: "Stores reported as processed:",
        withdrawConfirm:
          "Withdraw consent? Data collected under it will be erased per policy (SPEC-04 §6) and the affected features will be blocked.",
        section8Lgpd:
          "In compliance with LGPD Art. 18 (right to data portability), you can export your data at any time and import it on another device.",
      },
    ],
  ] as const)(
    "keeps policy copy unchanged and uses operational deletion status copy in %s",
    (_locale, dict, expected) => {
      expect(dict.privacy.erasure.description).toBe(expected.description);
      expect(dict.privacy.erasure.done).toBe(expected.done);
      expect(dict.privacy.erasure.confirm).toBe(expected.confirm);
      expect(dict.privacy.erasure.failed).toBe(expected.failed);
      expect(dict.privacy.erasure.processedStores).toBe(
        expected.processedStores,
      );
      expect(dict.privacy.consent_receipt.withdrawConfirm).toBe(
        expected.withdrawConfirm,
      );
      expect(dict.privacy.policy.section8Lgpd).toBe(expected.section8Lgpd);
    },
  );
});
