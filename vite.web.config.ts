import { defineConfig, mergeConfig } from "vite";
import baseConfig from "./vite.base.config";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

export default defineConfig(
  mergeConfig(baseConfig, {
    plugins: [
      {
        // O plugin-react injeta o preamble do fast-refresh como script INLINE
        // apenas em dev. A CSP de prod (script-src 'self') bloquearia esse script;
        // liberamos 'unsafe-inline' SOMENTE no modo serve. O build de produção
        // usa o index.web.html intocado => CSP segura sem inline.
        name: "web-csp-dev-inline",
        apply: "serve",
        transformIndexHtml(html) {
          return html.replace(
            /script-src 'self'/,
            "script-src 'self' 'unsafe-inline'",
          );
        },
      },
      VitePWA({
        registerType: "autoUpdate",
        workbox: {
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        },
        manifest: {
          name: "Open3DCalc - Calculadora 3D Livre",
          short_name: "Open3DCalc",
          description:
            "Calculadora de custos de impressão 3D gratuita, open-source e segura.",
          theme_color: "#8b5cf6",
          background_color: "#020617",
          display: "standalone",
          icons: [
            { src: "icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          ],
        },
      }),
    ],
    build: {
      outDir: "dist-web",
      emptyOutDir: true,
      rollupOptions: {
        input: path.resolve(__dirname, "index.web.html"),
      },
    },
  }),
);
