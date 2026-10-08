/** @vitest-environment node */

/**
 * Preload surface contract (Beta12 release hardening).
 *
 * The legacy privacy stubs `scanReport`, `quarantineReport`, `recoveryReport`
 * and `recoverKey` are rejected by the main process and are no longer exposed
 * through the preload bridge: exposing them advertises a renderer capability the
 * app permanently refuses. The main-process disabled-channel registry is
 * retained (see `electron/__tests__/startup-privacy-safety.test.ts`); this suite
 * pins the RENDERER half of the contract.
 *
 * WHY SOURCE INSPECTION AND NOT AN IMPORT: `electron/preload.cts` cannot be
 * loaded by the Vitest toolchain — rolldown's parser rejects its
 * `import type … with { "resolution-mode": "import" }` syntax, which is why the
 * coverage config excludes it (see `vitest.config.ts`). A source assertion is
 * therefore the only executable check of the object the preload builds, and the
 * comments are stripped first so a removal note naming a stub cannot satisfy or
 * defeat the assertion.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const PRELOAD = fileURLToPath(new URL("../preload.cts", import.meta.url));
const TYPES = fileURLToPath(
  new URL("../../src/platform/desktop/types/electron.d.ts", import.meta.url),
);

/** Remove block and line comments so prose cannot be mistaken for code. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** The four legacy stubs that must no longer be reachable from the renderer. */
const REMOVED = [
  "scanReport",
  "quarantineReport",
  "recoveryReport",
  "recoverKey",
] as const;

/** The legacy IPC channels those stubs invoked. */
const REMOVED_CHANNELS = [
  "privacy:scan-report",
  "privacy:quarantine-report",
  "privacy:recovery-report",
  "privacy:recover-key",
] as const;

describe("preload privacy contract", () => {
  const preloadCode = code(readFileSync(PRELOAD, "utf8"));
  const typesCode = code(readFileSync(TYPES, "utf8"));

  it.each(REMOVED)("does not expose the disabled stub %s", (method) => {
    expect(preloadCode).not.toMatch(new RegExp(`\\b${method}\\b`));
    expect(typesCode).not.toMatch(new RegExp(`\\b${method}\\b`));
  });

  it.each(REMOVED_CHANNELS)(
    "does not invoke the disabled channel %s",
    (channel) => {
      expect(preloadCode).not.toContain(channel);
    },
  );

  it("still exposes the live privacy surface (the desktop re-home reader)", () => {
    expect(preloadCode).toContain("privacy:legacy-rows");
    expect(typesCode).toMatch(/\blegacyRows\b/);
  });
});
