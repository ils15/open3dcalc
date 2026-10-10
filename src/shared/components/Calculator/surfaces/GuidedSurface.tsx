import { GuidedWizard } from "@/shared/components/Wizard/GuidedWizard";

export function GuidedSurface({
  onManagePrinters,
}: {
  onManagePrinters?: () => void;
}): React.ReactElement {
  return <GuidedWizard onManagePrinters={onManagePrinters} />;
}
