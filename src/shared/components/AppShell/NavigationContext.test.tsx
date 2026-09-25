import { fireEvent, render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useActiveTab, useNavigateToTab } from "./NavigationContext";
import { NavigationProvider } from "./NavigationProvider";

function ActiveTabProbe(): React.ReactElement {
  const activeTab = useActiveTab();
  return <output aria-label="active tab">{activeTab}</output>;
}

function NavigationActionProbe({
  onRender,
}: {
  onRender: () => void;
}): React.ReactElement {
  onRender();
  const navigateToTab = useNavigateToTab();
  return (
    <button type="button" onClick={() => navigateToTab("history")}>
      Show history
    </button>
  );
}

describe("NavigationProvider", () => {
  it("defaults to calculator and accepts typed tab transitions", () => {
    render(
      <NavigationProvider>
        <ActiveTabProbe />
        <NavigationActionProbe onRender={vi.fn()} />
      </NavigationProvider>,
    );

    expect(screen.getByLabelText("active tab")).toHaveTextContent("calculator");

    fireEvent.click(screen.getByRole("button", { name: "Show history" }));

    expect(screen.getByLabelText("active tab")).toHaveTextContent("history");
  });

  it("does not rerender action-only consumers when the active tab changes", () => {
    const onActionConsumerRender = vi.fn();
    render(
      <NavigationProvider>
        <ActiveTabProbe />
        <NavigationActionProbe onRender={onActionConsumerRender} />
      </NavigationProvider>,
    );

    expect(onActionConsumerRender).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Show history" }));

    expect(onActionConsumerRender).toHaveBeenCalledTimes(1);
  });

  it("reports consumers that are rendered outside the provider", () => {
    expect(() => renderHook(() => useActiveTab())).toThrow(
      "useActiveTab must be used within NavigationProvider",
    );
    expect(() => renderHook(() => useNavigateToTab())).toThrow(
      "useNavigateToTab must be used within NavigationProvider",
    );
  });
});
