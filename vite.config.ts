import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

import autoprefixer from 'autoprefixer'
import tailwind from 'tailwindcss'

import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Sin esto, /api/postulantes etc. caen en el SPA y devuelven HTML → "Unexpected token '<'" al parsear JSON.
  // Alineado con uniacc-api (.env.example PORT=3001).
  const admisionApiTarget =
    env.VITE_ADMISION_API_TARGET?.trim() || 'http://127.0.0.1:3001'

  // Ayuda a diagnosticar ECONNREFUSED / timeouts del proxy (solo proceso Node de Vite).
  // Si defines VITE_API_URL, el front no usa este proxy para admisión/OTP.
  console.info(`[rematricula-vite] VITE_API_URL=${env.VITE_API_URL?.trim() || '(vacío)'} | proxy admisión → ${admisionApiTarget}`)

  const admisionProxy = {
    target: admisionApiTarget,
    changeOrigin: true,
    configure(proxy: import('http-proxy').Server) {
      proxy.on('error', (err: Error, req) => {
        const url = (req as import('http').IncomingMessage).url ?? ''
        console.error(`[vite-proxy] ${url} → ${admisionApiTarget}: ${err.message}`)
      })
    },
  }

  return {
    css: {
      postcss: {
        plugins: [tailwind(), autoprefixer()],
      },
    },
    plugins: [
      vue(),
      vueDevTools(), // comentar si da problemas de overlay en cypress
      AutoImport({
        include: [
          /\.[tj]sx?$/, // .ts, .tsx, .js, .jsx
          /\.vue$/,
          /\.vue\?vue/, // .vue
          /\.md$/, // .md
        ],
        imports: [
          // presets
          'vue',
          'vue-router',
          { pinia: ['defineStore', 'storeToRefs', 'acceptHMRUpdate'] },

          // custom
          {
            '@/services/supabaseClient': ['supabase', 'supabaseClient'],
            // add more here instead of creating another object
          },

          // types
          // {
          //   from: 'src/types/supabase',
          //   imports: ['Database', 'Tables'],
          //   type: true,
          // },
          {
            from: 'src/types/Error',
            imports: ['CustomError', 'ExtendedPostgresError'],
            type: true,
          },
          {
            from: '@supabase/supabase-js',
            imports: ['QueryData', 'Session', 'User', 'PostgrestError'],
            type: true,
          },
        ],
        dirs: ['src/stores/**/*.ts'],
        dts: true,
        viteOptimizeDeps: true,
      }),
      Components({
        dts: true,
        dirs: ['src/components', 'src/views'],
      }),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    build: {
      // Configuración explícita para producción
      outDir: 'dist',
      assetsDir: 'assets',
      emptyOutDir: true,
      sourcemap: false,
      // Optimizaciones
      minify: 'esbuild',
      target: 'esnext',
      cssCodeSplit: true,
      // Ignorar errores de TypeScript en build de producción
      // El type-check se hace por separado en desarrollo
      rollupOptions: {
        onwarn(warning, warn) {
          // Ignorar warnings de circular dependencies que son comunes en Vue
          if (warning.code === 'CIRCULAR_DEPENDENCY') return
          warn(warning)
        },
        output: {
          // Asegurar que los archivos JS tengan nombres consistentes
          entryFileNames: 'assets/[name].[hash].js',
          chunkFileNames: 'assets/[name].[hash].js',
          assetFileNames: 'assets/[name].[hash].[ext]',
          // Configuración de MIME types
          manualChunks: undefined,
        },
      },
    },
    server: {
      port: 9501,
      proxy: {
        '/api/auth': {
          target: env.AUTH_API_URL || 'http://localhost:9502',
          changeOrigin: true,
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (env.REMATRICULA_API_KEY) {
                proxyReq.setHeader('X-API-Key', env.REMATRICULA_API_KEY)
              }
            })
          }
        },
        '/api/postulantes': admisionProxy,
        '/api/matriculados': admisionProxy,
        '/api/firma-acepta': admisionProxy,
        '/api/rematricula': admisionProxy,
        '/mineduc': {
          target: 'https://apiede.mineduc.cl',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/mineduc/, ''),
        },
      },
    },
  }
})
