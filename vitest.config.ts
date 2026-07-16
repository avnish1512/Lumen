import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Isolated test configuration. The main vite.config.ts wires up many
// dev-server proxies that pull in Node-only server code; tests do not need
// those, so the test runner uses this lean config instead.
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
