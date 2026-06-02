import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { viteSingleFile } from 'vite-plugin-singlefile'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Senkronla monorepo kökü — SENKRONLA_ROOT veya bilinen konumlar */
function resolveSenkronlaRoot(): string {
  const candidates = [
    process.env.SENKRONLA_ROOT,
    path.resolve(__dirname, '../senkronla'),
    path.resolve(__dirname, 'senkronla'),
  ].filter((p): p is string => Boolean(p))
  for (const root of candidates) {
    if (fs.existsSync(path.join(root, 'packages/client/src/index.ts'))) return root
  }
  return candidates[0] ?? path.resolve(__dirname, '../senkronla')
}

const SENKRONLA_ROOT = resolveSenkronlaRoot()

const SENKRONLA_CLIENT_ENTRY = path.join(
  SENKRONLA_ROOT,
  'packages/client/src/index.ts',
)

function senkronlaLocalAliases(): Record<string, string> {
  return {
    '@senkronla/client': path.join(SENKRONLA_ROOT, 'packages/client/src'),
  }
}

function senkronlaClientInNodeModules(): boolean {
  return fs.existsSync(path.join(__dirname, 'node_modules/@senkronla/client/package.json'))
}

/**
 * Yerel monorepo alias: `VITE_LOCAL_SENKRONLA_PACKAGES=true` zorlar;
 * `false` = npm tercih (kuruluysa); npm yoksa yerel kaynak fallback (yayımlanmamış paket).
 */
function useLocalSenkronla(env: Record<string, string>, mode: string): boolean {
  const localEntryExists = fs.existsSync(SENKRONLA_CLIENT_ENTRY)
  const npmInstalled = senkronlaClientInNodeModules()

  if (env.VITE_LOCAL_SENKRONLA_PACKAGES === 'true') return localEntryExists
  if (env.VITE_LOCAL_SENKRONLA_PACKAGES === 'false') return npmInstalled ? false : localEntryExists

  const isDevOrTest = mode === 'development' || mode === 'test'
  if (isDevOrTest && localEntryExists) return true
  return !npmInstalled && localEntryExists
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '')
  const localSenkronla = useLocalSenkronla(env, mode)

  return {
    base: './',
    plugins: [vue(), viteSingleFile()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        ...(localSenkronla ? senkronlaLocalAliases() : {}),
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
      commonjsOptions: {
        include: [/node_modules/],
      },
    },
    server: {
      port: 5173,
      strictPort: false,
      // fs.allow verildiğinde Vite workspace kökünü otomatik eklemez — proje + senkronla
      ...(localSenkronla
        ? { fs: { allow: [__dirname, SENKRONLA_ROOT] } }
        : {}),
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
      exclude: localSenkronla ? ['@senkronla/client'] : [],
    },
    test: {
      environment: 'node',
      include: ['src/**/*.spec.ts', 'scripts/**/*.spec.ts'],
    },
  }
})
