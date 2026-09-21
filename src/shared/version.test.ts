import { describe, it, expect } from "vitest";
import { APP_VERSION } from "./version";

describe("version", () => {
  it("is injected from package.json at build time", () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });
});
