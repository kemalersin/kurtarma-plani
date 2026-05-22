import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
  base: './',
  plugins: [vue(), viteSingleFile()],
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
  },
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
})
