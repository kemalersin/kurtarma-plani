import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  plugins: [
    vue(),
    VitePWA({
      // SW kaydını koşullu yapabilmek için elle (main.ts) yönetiyoruz.
      injectRegister: false,
      registerType: 'prompt',
      strategies: 'generateSW',
      // Manifest `public/manifest.webmanifest` dosyasını kullanıyoruz; eklenti
      // ayrıca kendi manifest'ini üretmesin.
      manifest: false,
      workbox: {
        // viteSingleFile her şeyi `index.html` içine gömüyor; precache yalnız
        // HTML kabuğu ve manifest/ikon yan dosyaları olmalı.
        globPatterns: ['index.html', 'manifest.webmanifest', '*.svg'],
        // Tek-dosya bundle 2 MB varsayılan eşiğini aşar; 12 MB güvenli üst sınır.
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
        // Hash routing (`#/...`) ile her yol `index.html` döndürmeli.
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: false,
        runtimeCaching: [
          {
            // Google Fonts (steering istisnası): yazı tipi varlıkları uzun süre cache.
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'kp-google-fonts-webfonts',
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 32, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'kp-google-fonts-stylesheets',
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
    viteSingleFile(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0'),
    __APP_BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
  build: {
    target: 'es2022',
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 4000,
  },
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      '/kp-ai-proxy/anthropic': {
        target: 'https://api.anthropic.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/kp-ai-proxy\/anthropic/, ''),
      },
      '/kp-ai-proxy/openai': {
        target: 'https://api.openai.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/kp-ai-proxy\/openai/, ''),
      },
      '/kp-ai-proxy/gemini': {
        target: 'https://generativelanguage.googleapis.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/kp-ai-proxy\/gemini/, ''),
      },
      '/kp-ai-proxy/deepseek': {
        target: 'https://api.deepseek.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/kp-ai-proxy\/deepseek/, ''),
      },
    },
  },
  optimizeDeps: {
    include: [
      'marked',
      'dompurify',
      'echarts/core',
      'echarts/charts',
      'echarts/components',
      'echarts/renderers',
    ],
  },
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts', 'scripts/**/*.spec.ts'],
  },
})
