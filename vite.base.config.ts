import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// D-CL5 — toolpath preview flag default. Dogfooded through the beta channel
// (v1.13.0-beta.1..3) and validated for stable release; ON for everyone now.
// An explicit VITE_TOOLPATH_PREVIEW env var always wins (see featureFlags.ts).
const TOOLPATH_PREVIEW = process.env.VITE_TOOLPATH_PREVIEW ?? "true";

export default defineConfig({
  base: "./",
  define: {
    "import.meta.env.VITE_TOOLPATH_PREVIEW": JSON.stringify(TOOLPATH_PREVIEW),
    // Selo visual de beta no app; false em builds estáveis. O workflow
    // beta-deploy.yml publica com VITE_BETA_CHANNEL=true.
    "import.meta.env.VITE_BETA_CHANNEL": JSON.stringify(
      process.env.VITE_BETA_CHANNEL === "true",
    ),
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@/platform": path.resolve(__dirname, "src/platform"),
      "@/shared": path.resolve(__dirname, "src/shared"),
    },
  },
  server: {
    allowedHosts: true,
  },
  optimizeDeps: {
    // use-sync-external-store (transitive dep of zustand/react) is CJS and
    // breaks Vite's interop ("does not provide an export named 'default'").
    // Pre-bundling the main entry AND the /shim/with-selector.js subpath that
    // zustand imports forces correct CJS interop.
    include: [
      "use-sync-external-store",
      "use-sync-external-store/shim/with-selector.js",
      "scheduler",
      "stats.js",
    ],
    exclude: ["three", "@react-three/fiber", "@react-three/drei"],
  },
});
