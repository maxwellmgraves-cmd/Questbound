import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ command }) => {
  const base = process.env.VITE_BASE_PATH || (command === 'build' ? '/Questbound/' : '/')
  return {
    base,
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'],
        manifest: {
          name: 'Questbound',
          short_name: 'Questbound',
          description: 'A family life RPG for routines, independence, and rewards.',
          theme_color: '#0b1730',
          background_color: '#07111f',
          display: 'standalone',
          orientation: 'portrait-primary',
          start_url: '.',
          scope: '.',
          icons: [
            { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
          ]
        },
        workbox: {
          navigateFallback: 'index.html',
          cleanupOutdatedCaches: true
        }
      })
    ]
  }
})
