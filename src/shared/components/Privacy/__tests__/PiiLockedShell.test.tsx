/**
 * T3.3 — the locked shell and its minimal unlock.
 *
 * The shell is the honest face of a vault the app cannot open: it renders when
 * the environment is incapable, when the vault is locked, or when an unlock
 * FAILED — never a blank window, and never an empty customer list mistaken for
 * lost data. These specs drive the REAL gate (real Web Crypto, fake IndexedDB)
 * so the assertion is about the wiring, not about a mock of it.
 *
 * MEDIUM-1 — "create" is not "unlock". A profile with NO vault record is being
 * CREATED: the passphrase is chosen, must be confirmed, and cannot be reset. A
 * profile WITH a record is being UNLOCKED from a single field, and a wrong
 * passphrase is possible but the data is still recoverable. The two modes are
 * driven from `hasExistingPiiProfile()` (real presence read, fake IndexedDB).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import "@/shared/stores/customerStore";
import "@/shared/stores/quoteStore";
import "@/shared/stores/historyStore";

import { PiiLockedShell } from "../PiiLockedShell";
import {
  configurePiiStoreRuntime,
  getPiiStoreAccessState,
  resetPiiStoreHydrationForTests,
  unlockPiiStoresAndRehydrate,
} from "@/shared/lib/crypto/piiStoreHydration";
import {
  createPiiStore,
  lockAllPiiStores,
  resetPiiStoreRuntimeForTests,
} from "@/shared/lib/crypto/piiStore";
import {
  resetPiiStoreGateForTests,
  setDemoSuppressedForPiiGate,
} from "@/shared/lib/crypto/piiStoreCapability";
import { zeroizeSessionPassphrase } from "@/shared/lib/crypto/passphraseSession";
import { PII_STORE_ENVIRONMENT } from "@/shared/lib/crypto/__tests__/piiStoreFixtures";
import { createFakeIndexedDb } from "@/shared/test/fakeIndexedDb";

const CUSTOMERS = "open3dcalc_customers_v1";
const PASS = "senha-sintetica-acesso-4242";
const WRONG_PASS = "senha-sintetica-errada-1717";

const LOCKED_TITLE = "privacy.vault.lockedTitle";
const CREATE_TITLE = "privacy.vault.createTitle";
const UNAVAILABLE_TITLE = "privacy.vault.unavailableTitle";
const CONFIRM_LABEL = "privacy.vault.confirmPassphraseLabel";
const CREATE_BUTTON = "privacy.vault.create";
const UNLOCK_BUTTON = "privacy.vault.unlock";
const MISMATCH_ERROR = "privacy.vault.mismatchError";
const IRRECOVERABLE_NOTICE = "privacy.vault.irrecoverableNotice";

function passphraseInput(): HTMLInputElement {
  return screen.getByLabelText("privacy.vault.passphraseLabel");
}

function confirmInput(): HTMLInputElement {
  return screen.getByLabelText(CONFIRM_LABEL);
}

describe("T3.3 — PiiLockedShell", () => {
  const user = userEvent.setup();
  let idb: ReturnType<typeof createFakeIndexedDb>;
  let container: HTMLElement;
  const options = () => ({
    indexedDb: idb.factory,
    environment: PII_STORE_ENVIRONMENT,
  });

  function renderShell(): HTMLElement {
    container = render(<PiiLockedShell />).container;
    return container;
  }

  /**
   * Leave a sealed record behind while the vault is locked, so the shell sees
   * an EXISTING profile and must offer "unlock" rather than "create".
   */
  async function seedExistingProfile(): Promise<void> {
    await unlockPiiStoresAndRehydrate(PASS, options());
    await createPiiStore(CUSTOMERS, options()).write(
      '{"state":{"customers":[]},"version":1}',
    );
    lockAllPiiStores();
    resetPiiStoreRuntimeForTests();
    resetPiiStoreHydrationForTests();
    configurePiiStoreRuntime(options());
  }

  beforeEach(() => {
    idb = createFakeIndexedDb();
    resetPiiStoreGateForTests();
    lockAllPiiStores();
    resetPiiStoreRuntimeForTests();
    resetPiiStoreHydrationForTests();
    configurePiiStoreRuntime(options());
    window.localStorage.clear();
    zeroizeSessionPassphrase();
  });

  afterEach(() => {
    resetPiiStoreGateForTests();
    lockAllPiiStores();
    resetPiiStoreRuntimeForTests();
    resetPiiStoreHydrationForTests();
    window.localStorage.clear();
    zeroizeSessionPassphrase();
    delete (window as { electronAPI?: unknown }).electronAPI;
  });

  it("renders a labelled create form for a fresh, locked, capable vault", async () => {
    renderShell();

    expect(
      screen.getByRole("region", { name: "privacy.vault.ariaLabel" }),
    ).toBeInTheDocument();

    await screen.findByLabelText(CONFIRM_LABEL);
    expect(screen.getByText(CREATE_TITLE)).toBeInTheDocument();
    expect(passphraseInput()).toHaveAttribute("type", "password");
    expect(confirmInput()).toHaveAttribute("type", "password");
    expect(
      screen.getByRole("button", { name: CREATE_BUTTON }),
    ).toBeInTheDocument();
    // Irrecoverability is stated BEFORE a passphrase is chosen, not after.
    expect(screen.getByText(IRRECOVERABLE_NOTICE)).toBeInTheDocument();
  });

  it("moves focus to the passphrase input once the form is ready", async () => {
    renderShell();

    await waitFor(() => expect(passphraseInput()).toHaveFocus());
  });

  it("offers a single passphrase field when a profile already exists", async () => {
    await seedExistingProfile();

    renderShell();

    await screen.findByRole("button", { name: UNLOCK_BUTTON });
    expect(screen.getByText(LOCKED_TITLE)).toBeInTheDocument();
    // No confirmation field and no create affordance for an existing profile.
    expect(screen.queryByLabelText(CONFIRM_LABEL)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: CREATE_BUTTON }),
    ).not.toBeInTheDocument();
  });

  it("explains an incapable environment and offers no unlock form", () => {
    resetPiiStoreGateForTests();
    configurePiiStoreRuntime({
      indexedDb: idb.factory,
      environment: { ...PII_STORE_ENVIRONMENT, webCryptoAvailable: false },
    });

    renderShell();

    expect(screen.getByText(UNAVAILABLE_TITLE)).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(CONFIRM_LABEL)).not.toBeInTheDocument();
  });

  it("stays silent for an intentional demo session", () => {
    setDemoSuppressedForPiiGate(true);

    render(<PiiLockedShell />);

    expect(screen.queryByText(LOCKED_TITLE)).not.toBeInTheDocument();
    expect(screen.queryByText(CREATE_TITLE)).not.toBeInTheDocument();
    expect(screen.queryByText(UNAVAILABLE_TITLE)).not.toBeInTheDocument();
  });

  it("renders nothing when the vault is already hydrated", async () => {
    await unlockPiiStoresAndRehydrate(PASS, options());

    const { container: rendered } = render(<PiiLockedShell />);

    expect(rendered).toBeEmptyDOMElement();
  });

  // --- create mode (MEDIUM-1) ---------------------------------------------

  it("requires the confirmation before a passphrase can be created", async () => {
    renderShell();
    await screen.findByLabelText(CONFIRM_LABEL);

    const button = screen.getByRole("button", { name: CREATE_BUTTON });
    expect(button).toBeDisabled();

    await user.type(passphraseInput(), PASS);
    expect(button).toBeDisabled();

    await user.type(confirmInput(), PASS);
    expect(button).toBeEnabled();
  });

  it("blocks creation and reports a mismatch without touching the vault", async () => {
    renderShell();
    await screen.findByLabelText(CONFIRM_LABEL);

    await user.type(passphraseInput(), PASS);
    await user.type(confirmInput(), WRONG_PASS);
    await user.click(screen.getByRole("button", { name: CREATE_BUTTON }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(MISMATCH_ERROR);
    expect(getPiiStoreAccessState()).toEqual({
      status: "locked",
      reason: "profile_locked",
    });
    // Nothing was derived, sealed or persisted.
    expect(window.localStorage.length).toBe(0);
  });

  it("creates the passphrase and rehydrates when both fields match", async () => {
    renderShell();
    await screen.findByLabelText(CONFIRM_LABEL);

    await user.type(passphraseInput(), PASS);
    await user.type(confirmInput(), PASS);
    await user.click(screen.getByRole("button", { name: CREATE_BUTTON }));

    await waitFor(() => expect(container).toBeEmptyDOMElement());
    expect(getPiiStoreAccessState()).toEqual({ status: "hydrated" });
    // Memory-only: the passphrase never reaches localStorage.
    expect(window.localStorage.length).toBe(0);
  });

  it("does not inspect legacy sources during startup or after creating a profile", async () => {
    const legacyRows = vi.fn().mockResolvedValue({ rows: [] });
    (window as unknown as { electronAPI: unknown }).electronAPI = {
      privacy: { legacyRows },
    };
    renderShell();
    await screen.findByLabelText(CONFIRM_LABEL);

    await user.type(passphraseInput(), PASS);
    await user.type(confirmInput(), PASS);
    await user.click(screen.getByRole("button", { name: CREATE_BUTTON }));
    await waitFor(() => expect(container).toBeEmptyDOMElement());
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(legacyRows).not.toHaveBeenCalled();
  });

  // --- unlock mode (MEDIUM-1) ---------------------------------------------

  it("unlocks with the passphrase typed and Enter, rehydrating the stores", async () => {
    await seedExistingProfile();
    renderShell();
    await screen.findByRole("button", { name: UNLOCK_BUTTON });

    await user.type(passphraseInput(), PASS);
    await user.keyboard("{Enter}");

    await waitFor(() => expect(container).toBeEmptyDOMElement());
    expect(getPiiStoreAccessState()).toEqual({ status: "hydrated" });
    // Memory-only: the passphrase never reaches localStorage.
    expect(window.localStorage.length).toBe(0);
  });

  it("keeps the shell up and reports a failed unlock without clearing the input safely", async () => {
    // Seed a real record so a wrong passphrase fails at unlock, then lock again.
    await seedExistingProfile();

    renderShell();
    await screen.findByRole("button", { name: UNLOCK_BUTTON });
    await user.type(passphraseInput(), WRONG_PASS);
    await user.keyboard("{Enter}");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("privacy.vault.unlockError");
    expect(getPiiStoreAccessState()).toEqual({
      status: "locked",
      reason: "profile_locked",
    });
    // The failed passphrase is dropped from the field, never retained.
    expect(passphraseInput()).toHaveValue("");
    expect(window.localStorage.length).toBe(0);
  });

  // --- recovery, reset and visibility (UI affordances) ---------------------

  it("toggles passphrase visibility without changing the value", async () => {
    renderShell();
    await screen.findByLabelText(CONFIRM_LABEL);

    await user.type(passphraseInput(), PASS);
    expect(passphraseInput()).toHaveAttribute("type", "password");

    await user.click(screen.getByTitle("privacy.vault.showPassphrase"));
    expect(passphraseInput()).toHaveAttribute("type", "text");
    expect(passphraseInput()).toHaveValue(PASS);

    await user.click(screen.getByTitle("privacy.vault.hidePassphrase"));
    expect(passphraseInput()).toHaveAttribute("type", "password");
  });

  it("saves a password hint when creating a profile", async () => {
    renderShell();
    await screen.findByLabelText(CONFIRM_LABEL);

    await user.type(passphraseInput(), PASS);
    await user.type(confirmInput(), PASS);
    await user.type(
      screen.getByPlaceholderText("Dica de senha (opcional)..."),
      "dica-sintetica",
    );
    await user.click(screen.getByRole("button", { name: CREATE_BUTTON }));

    await waitFor(() => expect(container).toBeEmptyDOMElement());
    expect(window.localStorage.getItem("open3dcalc_vault_hint")).toBe(
      "dica-sintetica",
    );
  });

  it("reveals a stored password hint on the unlock surface", async () => {
    await seedExistingProfile();
    window.localStorage.setItem("open3dcalc_vault_hint", "dica-guardada");

    renderShell();
    await screen.findByRole("button", { name: UNLOCK_BUTTON });
    await user.click(screen.getByRole("button", { name: "Dica" }));

    expect(screen.getByText("dica-guardada")).toBeInTheDocument();
  });

  it("states plainly when no password hint was ever stored", async () => {
    await seedExistingProfile();

    renderShell();
    await screen.findByRole("button", { name: UNLOCK_BUTTON });
    await user.click(screen.getByRole("button", { name: "Dica" }));

    expect(screen.getByText(/Nenhuma dica de senha/)).toBeInTheDocument();
  });

  it("opens and cancels the reset confirmation without touching the vault", async () => {
    await seedExistingProfile();

    renderShell();
    await screen.findByRole("button", { name: UNLOCK_BUTTON });
    await user.click(screen.getByRole("button", { name: "Esqueci a Senha" }));
    expect(
      screen.getByRole("button", { name: "Redefinir e Criar Nova Senha" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(
      screen.queryByRole("button", { name: "Redefinir e Criar Nova Senha" }),
    ).toBeNull();
    // Still on the unlock surface.
    expect(
      screen.getByRole("button", { name: UNLOCK_BUTTON }),
    ).toBeInTheDocument();
  });

  it("resets the local vault back to a fresh create surface", async () => {
    await seedExistingProfile();
    window.localStorage.setItem("open3dcalc_vault_hint", "dica-antiga");

    renderShell();
    await screen.findByRole("button", { name: UNLOCK_BUTTON });
    await user.click(screen.getByRole("button", { name: "Esqueci a Senha" }));
    await user.click(
      screen.getByRole("button", { name: "Redefinir e Criar Nova Senha" }),
    );

    await screen.findByLabelText(CONFIRM_LABEL);
    expect(screen.getByText(CREATE_TITLE)).toBeInTheDocument();
    expect(window.localStorage.getItem("open3dcalc_vault_hint")).toBeNull();
  });
});
