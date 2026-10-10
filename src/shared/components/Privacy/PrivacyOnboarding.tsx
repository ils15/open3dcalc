import { PrivacyBanner } from "@/shared/components/ui/PrivacyBanner";

/** Local-data disclosure shared by Stable and Beta; saving never needs a password. */
export function PrivacyOnboarding() {
  return <PrivacyBanner />;
}
