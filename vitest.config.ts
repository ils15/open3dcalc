import { defineConfig, mergeConfig } from "vite";
import baseConfig from "./vite.base.config";

export default defineConfig(
  mergeConfig(baseConfig, {
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: ["./src/shared/test/setup.ts"],
      css: true,
      exclude: ["node_modules", "web", "desktop", "dist", "dist-web"],
      coverage: {
        provider: "v8",
        reporter: ["text", "json", "html"],
        include: [
          "electron/update.ts",
          "src/shared/lib/**",
          "src/shared/stores/**",
          "src/shared/hooks/**",
          "src/shared/components/**",
          "src/platform/desktop/overrides/**",
          "db/schema/**",
        ],
        exclude: [
          "src/shared/App.tsx",
          "src/shared/stores/calculatorStore.types.ts",
          "**/__tests__/**",
          "**/*.test.*",
          "**/*.stories.*",
          "**/*.d.ts",
        ],
        thresholds: {
          statements: 30,
          branches: 26,
          functions: 28,
          lines: 33,
        },
      },
    },
  }),
);
