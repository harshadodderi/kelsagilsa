import { defineConfig } from 'vitest/config'
import path from 'node:path'

// Only pure logic is unit-tested here: everything under src/lib is deliberately
// free of React Native imports so it runs in plain node. The privacy assertion
// (§3.1) is a database test, in supabase/tests.
export default defineConfig({
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
})
