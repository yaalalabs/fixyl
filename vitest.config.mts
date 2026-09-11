import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import commonjs from 'vite-plugin-commonjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Unit tests for the renderer-side services. They run in plain Node (no Electron,
// no DOM): anything that touches window.api or React is mocked inside the tests.
export default defineConfig({
  plugins: [commonjs()],
  resolve: {
    alias: {
      src: path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    restoreMocks: true,
  },
})
