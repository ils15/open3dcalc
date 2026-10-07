import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { LegacyMigrationPrompt } from "../LegacyMigrationPrompt";

describe("LegacyMigrationPrompt", () => {
  it("does not inspect legacy PII or present an automatic startup choice", () => {
    const legacyRows = vi.fn();
    (window as unknown as { electronAPI: unknown }).electronAPI = {
      privacy: { legacyRows },
    };

    try {
      const { container } = render(<LegacyMigrationPrompt />);
      expect(container).toBeEmptyDOMElement();
      expect(legacyRows).not.toHaveBeenCalled();
    } finally {
      delete (window as { electronAPI?: unknown }).electronAPI;
    }
  });
});
