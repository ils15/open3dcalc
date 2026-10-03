import React, { useEffect } from "react";
import { NavigationProvider } from "@/shared/components/AppShell/NavigationProvider";
import { PreferenceProvider } from "@/shared/contexts/PreferenceProvider";
import { Tutorial } from "@/shared/components/ui/Tutorial";
import { useLayoutStore } from "@/shared/stores/layoutStore";
import { useTutorialStore } from "@/shared/stores/tutorialStore";
import { StudioLayout } from "./components/studio/StudioLayout";

// The TABS contract is re-exported here for compatibility
export { TABS } from "@/shared/components/AppShell/tabs";

function App(): React.ReactElement {
  const layoutMode = useLayoutStore((state) => state.layoutMode);

  // Classic is the only surface with these tour anchors. A tour pointing to a
  // missing control is worse than no tour; Guided is already its own experience.
  useEffect(() => {
    if (layoutMode !== "classic" && useTutorialStore.getState().isActive) {
      useTutorialStore.getState().skipTutorial();
    }
  }, [layoutMode]);

  return (
    <PreferenceProvider>
      <NavigationProvider>
        <StudioLayout />
        {layoutMode === "classic" && <Tutorial />}
      </NavigationProvider>
    </PreferenceProvider>
  );
}

export default App;
