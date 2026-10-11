import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),

    tailwindcss(),

    VitePWA({
      registerType: 'autoUpdate',

      manifest: {
        name: 'OsteoMap Skeletal Inventory',
        short_name: 'OsteoMap',
        display: 'standalone',
        // start_url is left out so it follows Vite's base path, which the
        // GitHub Pages build sets to /3200_53/ (see .github/workflows/deploy.yml).
        orientation: 'portrait',
        theme_color: '#0284c7',
        background_color: '#ffffff',
        // Browsers only offer to install an app whose manifest has icons of at
        // least 192 and 512 pixels. The artwork is the Centre for Forensic
        // Anthropology logo (public/CFA Logo.JPG). Android crops maskable icons
        // to a circle or squircle, so that one has extra white margin to keep
        // the lettering clear of the crop.
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})