import { defineConfig, mergeConfig } from "vite";
import baseConfig from "./vite.base.config";

export default defineConfig(
  mergeConfig(baseConfig, {
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: ["./src/shared/test/setup.ts"],
      css: true,

      // ── Timeouts ────────────────────────────────────────────────────────
      // Vitest's own default for this pool is `testTimeout: 5000`; it was
      // previously left unconfigured here, so the budget was implicit.
      //
      // Why this number: the slowest measured test in the Electron/secret
      // family (electron/__tests__/{cryptoCapability,legacyRecovery,
      // legacyScan,osKeyring,persistGate,piiDomainTables,piiStage,
      // piiStageResidue}.test.ts) runs 2564-3331ms, i.e. 51-67% of that 5000ms
      // budget. 10s is ~3x the worst observation and above the 2x margin floor
      // (6662ms), which leaves room for a loaded CI runner.
      //
      // Scope, deliberately: `hookTimeout` and `teardownTimeout` are NOT set
      // here. The Electron family registers no beforeAll/afterAll, so the slow
      // work is test bodies, and teardown is not a hot spot — configuring a
      // knob with no consumer is noise. The 6781ms crypto self-test already
      // declares its own 180_000ms budget at the call site
      // (crypto.selftest.test.ts), so it needs no global margin.
      //
      // This is honest margin, NOT a flake fix: the reported flake did not
      // reproduce in 5 runs under load 2.99. Upstream vitest-dev/vitest#9751
      // ("Unify and simplify timeout configuration") documents how these knobs
      // are scattered across `testTimeout` / `expect.poll.timeout` /
      // `browser.providerOptions.actionTimeout` with no single place to reason
      // about them; this block is the single place for this repo.
      testTimeout: 10_000,

      exclude: [
        "node_modules",
        "web",
        "desktop",
        "dist",
        "dist-web",
        "Example/**",
        // Browser-mode specs run in a real Chromium via `vitest.browser.config.ts`
        // (`npm run test:browser`) and would fail here: jsdom has no IndexedDB
        // and reports `window.isSecureContext` as `undefined`, which the vault's
        // gate correctly treats as a denial. They match the default include glob,
        // so they must be excluded explicitly; the browser config's own `include`
        // is the other half of the split. Both extensions are excluded so a
        // future `*.browser.test.tsx` cannot fall into the jsdom suite.
        "src/**/*.browser.test.ts",
        "src/**/*.browser.test.tsx",
        // This script uses node:test plus Playwright against the running preview;
        // keep it out of Vitest's file discovery and run it separately with
        // `node --test scripts/tests/calculator-classic-layout.playwright.test.mjs`.
        "scripts/tests/calculator-classic-layout.playwright.test.mjs",
      ],
      coverage: {
        provider: "v8",
        reporter: ["text", "json", "html"],
        include: [
          // Main-process code. Extension-qualified so the generated output
          // under electron/dist/** and electron/tsconfig.json are never
          // picked up as "untested source" (see exclude below).
          //
          // `**/*.cts` is deliberately absent: electron/preload.cts is the
          // only .cts under electron/ and the v8 provider's AST pass
          // (rolldown) cannot parse its `import type ... with
          // { "resolution-mode": "import" }` syntax — it drops the file with
          // a warning regardless of configuration. See exclude below.
          "electron/**/*.ts",
          "src/shared/lib/**",
          "src/shared/stores/**",
          "src/shared/hooks/**",
          "src/shared/components/**",
          "src/platform/desktop/overrides/**",
          "src/platform/desktop/components/**",
          "db/schema/**",
        ],
        exclude: [
          "src/shared/App.tsx",
          "src/shared/stores/calculatorStore.types.ts",
          "**/__tests__/**",
          "**/*.test.*",
          "**/*.stories.*",
          "**/*.d.ts",
          // Compiled output of electron/tsconfig.json (tsc outDir). Generated
          // bytes, not source: measuring them double-counts the .ts above and
          // reports coverage for code nobody wrote.
          "electron/dist/**",
          // The crypto self-test harness is executed by the REAL Electron
          // binary in a separate process; vitest's v8 coverage only observes
          // the vitest process, so it can only ever report this file as 0%.
          // The harness itself is exercised by
          // electron/__tests__/crypto.selftest.test.ts (which asserts on its
          // JSON report), not by importing it.
          "electron/selftest/**",
          // Not instrumentable by the v8 provider: rolldown's parser rejects
          // the import-attributes syntax above, so the provider always drops
          // this file with a "Failed to parse ... Excluding it from coverage"
          // warning. Excluding it explicitly keeps the report honest instead
          // of silently absent.
          "electron/preload.cts",
        ],
        // ── Release gate (beta.12) ──────────────────────────────────────
        // Raised from the placeholder 30/26/28/33 to the project's stated
        // minimum (80% across the board) after a full green run measured
        // repo-wide 87.41% statements / 81.28% branches / 84.64% functions /
        // 88.71% lines (4704 tests, 334 files). The gate is a floor, never a
        // target: it must not be lowered to make a change pass — add tests.
        thresholds: {
          statements: 80,
          branches: 80,
          functions: 80,
          lines: 80,
        },
      },
    },
  }),
);
