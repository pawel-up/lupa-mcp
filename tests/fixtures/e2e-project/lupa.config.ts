import { defineConfig } from '@pawel-up/lupa/runner'
import type { Assert } from '@pawel-up/lupa/assert'

export default defineConfig({
  files: ['tests/**/*.spec.ts'],
  vite: {
    optimizeDeps: {
      exclude: ['@pawel-up/lupa'],
    },
  },
})

declare module '@pawel-up/lupa/testing' {
  interface TestContext {
    assert: Assert
  }
}
