import { describe, it, expect, beforeEach } from "vitest";
import { useConsentStore } from "../consentStore";

describe("useConsentStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useConsentStore.setState({
      privacyBannerDismissed: false,
      consentGiven: false,
      consentDate: null,
    });
  });

  // ── Initial state ──────────────────────────────────────────────
  it("initial state has all flags false/empty", () => {
    const state = useConsentStore.getState();
    expect(state.privacyBannerDismissed).toBe(false);
    expect(state.consentGiven).toBe(false);
    expect(state.consentDate).toBeNull();
  });

  // ── dismissBanner ──────────────────────────────────────────────
  it("dismissBanner() sets privacyBannerDismissed to true", () => {
    expect(useConsentStore.getState().privacyBannerDismissed).toBe(false);
    useConsentStore.getState().dismissBanner();
    expect(useConsentStore.getState().privacyBannerDismissed).toBe(true);
  });

  // ── dismissBanner does NOT affect consentGiven ─────────────────
  it("dismissBanner() does not affect consentGiven", async () => {
    await useConsentStore.getState().giveConsent();
    useConsentStore.getState().dismissBanner();
    expect(useConsentStore.getState().consentGiven).toBe(true);
    expect(useConsentStore.getState().privacyBannerDismissed).toBe(true);
  });

  // ── giveConsent ────────────────────────────────────────────────
  it("giveConsent() issues a verified receipt and records date", async () => {
    const before = Date.now();
    await useConsentStore.getState().giveConsent();
    const after = Date.now();
    const state = useConsentStore.getState();

    expect(state.consentGiven).toBe(true);
    expect(state.consentDate).not.toBeNull();
    expect(state.consentDate!).toBeGreaterThanOrEqual(before);
    expect(state.consentDate!).toBeLessThanOrEqual(after);
    // SPEC-04 §3: the proof of consent is the receipt, not the flag.
    expect(state.receipt).not.toBeNull();
    expect(state.receipt!.policy_version).toBe("1.3");
    expect(state.receiptDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  // ── giveConsent also dismisses banner ──────────────────────────
  it("giveConsent() also dismisses banner", async () => {
    await useConsentStore.getState().giveConsent();
    expect(useConsentStore.getState().privacyBannerDismissed).toBe(true);
  });

  // ── resetConsent ───────────────────────────────────────────────
  it("resetConsent() resets all flags to initial state", async () => {
    await useConsentStore.getState().giveConsent();
    useConsentStore.getState().resetConsent();

    const state = useConsentStore.getState();
    expect(state.privacyBannerDismissed).toBe(false);
    expect(state.consentGiven).toBe(false);
    expect(state.consentDate).toBeNull();
  });

  // ── needsConsent ───────────────────────────────────────────────
  it("needsConsent() returns true when consent not given", () => {
    expect(useConsentStore.getState().needsConsent()).toBe(true);
  });

  it("needsConsent() returns false after consent given", async () => {
    await useConsentStore.getState().giveConsent();
    expect(useConsentStore.getState().needsConsent()).toBe(false);
  });

  // ── Persistence ────────────────────────────────────────────────
  it("persists state to localStorage under open3dcalc_consent_v1", async () => {
    await useConsentStore.getState().giveConsent();
    const stored = localStorage.getItem("open3dcalc_consent_v1");
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.state.consentGiven).toBe(true);
    expect(parsed.state.privacyBannerDismissed).toBe(true);
    expect(parsed.state.consentDate).toBeTypeOf("number");
  });
});
