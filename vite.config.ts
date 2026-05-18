import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

const isProd = (command: string, mode: string) => command === 'build' && mode !== 'test'

export default defineConfig(({ command, mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      base: isProd(command, mode) ? '/ozler-uys-v3/' : '/',
      scope: isProd(command, mode) ? '/ozler-uys-v3/' : '/',
      manifest: {
        name: 'Özler UYS — Operatör Paneli',
        short_name: 'UYS Operatör',
        description: 'Özler Üretim Yönetim Sistemi — Operatör Paneli',
        theme_color: '#0f0f17',
        background_color: '#0f0f17',
        display: 'standalone',
        orientation: 'portrait',
        start_url: isProd(command, mode) ? '/ozler-uys-v3/#/operator' : '/#/operator',
        scope: isProd(command, mode) ? '/ozler-uys-v3/' : '/',
        icons: [
          { src: 'pwa-192.svg', sizes: '192x192', type: 'image/svg+xml' },
          { src: 'pwa-512.svg', sizes: '512x512', type: 'image/svg+xml' },
          { src: 'pwa-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff,woff2}'],
        navigateFallback: null,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.hostname.endsWith('.supabase.co'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api',
              networkTimeoutSeconds: 5,
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  base: isProd(command, mode) ? '/ozler-uys-v3/' : '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    minify: 'esbuild',
    esbuild: {
      drop: ['console', 'debugger'],
    },
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            if (id.includes('react-dom') || id.includes('react-router-dom') || /[\\/]react[\\/]/.test(id)) return 'vendor-react'
            if (id.includes('@supabase')) return 'vendor-supabase'
            if (id.includes('recharts')) return 'vendor-charts'
            if (id.includes('@radix-ui')) return 'vendor-radix'
            if (id.includes('lucide-react')) return 'vendor-icons'
            if (id.includes('date-fns')) return 'vendor-date'
          }
        },
      },
    },
  },
}))
