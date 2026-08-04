import { defineConfig, mergeConfig } from "vite";
import baseConfig from "./vite.base.config";
import path from "node:path";

export default defineConfig(
  mergeConfig(baseConfig, {
    plugins: [
      {
        // @vitejs/plugin-react injeta um script INLINE no index.html apenas em dev
        // (preamble do fast-refresh). A CSP de prod (script-src 'self') quebraria
        // esse preamble; portanto liberamos 'unsafe-inline' SOMENTE no modo serve.
        // O build de produção usa o index.desktop.html intocado => CSP segura.
        name: "desktop-csp-dev-inline",
        apply: "serve",
        transformIndexHtml(html) {
          return html.replace(
            /script-src 'self'/,
            "script-src 'self' 'unsafe-inline'",
          );
        },
      },
    ],
    build: {
      outDir: "dist",
      emptyOutDir: true,
      target: "esnext",
      sourcemap: process.env.NODE_ENV === "development",
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        input: path.resolve(__dirname, "index.desktop.html"),
      },
    },
    server: {
      port: 5173,
      strictPort: true,
      cors: true,
    },
  }),
);
