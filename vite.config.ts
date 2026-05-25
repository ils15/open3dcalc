import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Open3DCalc - Calculadora 3D Livre',
        short_name: 'Open3DCalc',
        description: 'Calculadora de custos de impressão 3D gratuita, open-source e segura.',
        theme_color: '#8b5cf6',
        background_color: '#020617',
        display: 'standalone',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  optimizeDeps: {
    exclude: ['three', '@react-three/fiber', '@react-three/drei'],
  },
  resolve: {
    alias: { '@': '/src' },
  },
})
