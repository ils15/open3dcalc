import { describe, expect, it } from "vitest";
import {
  beginPiiSurfaceWrite,
  PII_STORE_KEY,
} from "@/shared/lib/localPiiPersistence";

describe("local customer data uses readable browser storage", () => {
  it("allows browser writes without an additional setup step", () => {
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0",
    });
    expect(beginPiiSurfaceWrite(PII_STORE_KEY.customers)).toBeNull();
  });
});
