/**
 * Vitest browser mode: Beta profile isolation in a REAL browser.
 *
 * ## Why this config exists next to `vitest.config.ts`
 *
 * These specs exercise the Beta profile's namespace isolation and storage
 * behavior in Chromium rather than a simulated browser environment.
 *
 * This config runs only `*.browser.test.ts` in Chromium through Playwright, with
 * NO injected environment and NO store double. `vitest.config.ts` is untouched
 * apart from excluding the same glob, so the jsdom suite keeps its own spec set
 * and neither suite can silently adopt the other's files.
 *
 * Run it with `npm run test:browser` (which passes `--config` explicitly, so the
 * default config stays the jsdom one).
 */

import { defineConfig, mergeConfig } from "vite";
import { playwright } from "@vitest/browser-playwright";
import baseConfig from "./vite.base.config";

export default defineConfig(
  mergeConfig(baseConfig, {
    test: {
      // Only the browser specs. `vitest.config.ts` excludes these same globs, so
      // a file belongs to exactly one suite. Both extensions are listed so a
      // future `*.browser.test.tsx` cannot silently fall into the jsdom suite.
      include: ["src/**/*.browser.test.ts", "src/**/*.browser.test.tsx"],
      browser: {
        enabled: true,
        // Explicit rather than CI-derived: a headless run must never depend on
        // `process.env.CI`, or a local `npm run test:browser` would try to open
        // a window. These specs assert storage behavior, not pixels.
        headless: true,
        provider: playwright(),
        instances: [{ browser: "chromium" }],
        // Vitest defaults this to `true` in a non-UI run and writes a screenshot
        // into `__screenshots__/` beside the spec. These specs assert storage
        // contracts, never on pixels, so screenshots would add no value.
        screenshotFailures: false,
      },
    },
  }),
);
