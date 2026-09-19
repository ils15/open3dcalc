import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores([
    "dist*/",
    "dist-electron/",
    "coverage/",
    "storybook-static/",
    "node_modules/",
    "web/",
    "desktop/",
    "db/",
    "electron/dist/",
  ]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    // Root App entries re-export TABS/MORE_TABS/MOBILE_VISIBLE_TABS so the
    // tabs-parity gate (src/shared/components/ui/__tests__/tabsParity.test.tsx)
    // can compare both platforms' navigation surfaces. Fast refresh is
    // unaffected: App is the root boundary and reloads in full regardless.
    files: ["src/platform/**/App.tsx"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
  {
    files: ["scripts/**/*.mjs"],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      "no-control-regex": "off",
      "no-useless-escape": "off",
    },
  },
]);
