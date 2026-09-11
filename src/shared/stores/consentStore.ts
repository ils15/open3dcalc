import { create } from "zustand";
import { persist } from "zustand/middleware";
import { manifestStorage } from "@/shared/lib/manifestStorage";

interface ConsentStore {
  privacyBannerDismissed: boolean;
  consentGiven: boolean;
  consentDate: number | null;

  dismissBanner(): void;
  giveConsent(): void;
  resetConsent(): void;
  needsConsent(): boolean;
}

export const useConsentStore = create<ConsentStore>()(
  persist(
    (set, get) => ({
      privacyBannerDismissed: false,
      consentGiven: false,
      consentDate: null,

      dismissBanner: () => set({ privacyBannerDismissed: true }),

      giveConsent: () =>
        set({
          consentGiven: true,
          consentDate: Date.now(),
          privacyBannerDismissed: true,
        }),

      resetConsent: () =>
        set({
          privacyBannerDismissed: false,
          consentGiven: false,
          consentDate: null,
        }),

      needsConsent: () => !get().consentGiven,
    }),
    {
      name: "open3dcalc_consent_v1",
      version: 1,
      storage: manifestStorage(),
    },
  ),
);
