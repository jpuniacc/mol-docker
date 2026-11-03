import { fileURLToPath } from 'node:url'
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'
import viteConfig from './vite.config'

export default defineConfig(async (configEnv) => {
  const base =
    typeof viteConfig === 'function' ? await viteConfig(configEnv) : viteConfig
  return mergeConfig(
    base,
    defineConfig({
      test: {
        environment: 'jsdom',
        exclude: [...configDefaults.exclude, 'e2e/**', '.worktrees/**'],
        root: fileURLToPath(new URL('./', import.meta.url)),
      },
    }),
  )
})
