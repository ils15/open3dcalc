import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { PiiLockedShell } from "../PiiLockedShell";

describe("PiiLockedShell", () => {
  it("does not probe or delete the historical vault on Stable startup", () => {
    const previousIndexedDb = Object.getOwnPropertyDescriptor(
      window,
      "indexedDB",
    );
    const open = vi.fn();
    const deleteDatabase = vi.fn();
    Object.defineProperty(window, "indexedDB", {
      configurable: true,
      value: { open, deleteDatabase },
    });

    const { container } = render(<PiiLockedShell />);

    expect(container.firstChild).toBeNull();
    expect(open).not.toHaveBeenCalled();
    expect(deleteDatabase).not.toHaveBeenCalled();
    if (previousIndexedDb) {
      Object.defineProperty(window, "indexedDB", previousIndexedDb);
    } else {
      Reflect.deleteProperty(window, "indexedDB");
    }
  });
});
