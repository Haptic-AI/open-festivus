import { resolve } from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "apps/web/src"),
    },
  },
  test: {
    // Step 5.3 fix: only include .test.ts here. The badge tests target the
    // pure presentation logic in lib/compatibility-badge-view.ts so they
    // never touch the JSX file — vitest doesn't need a JSX transform at all.
    // .test.tsx files are intentionally NOT collected; if you find yourself
    // wanting to write one, extract a pure helper into lib/ instead.
    include: ["tests/**/*.test.ts", "apps/web/src/**/*.test.ts"],
    testTimeout: 30000,
    globalSetup: ["./tests/setup/global-setup.ts"],
    // Per-worker env loader: reads apps/web/.env.local into process.env
    // so fast-tier tests (e.g. the festivus-api canary) see the same
    // config the Next app reads. Missing file is tolerated so fresh
    // clones still run `pnpm test` green.
    setupFiles: ["./tests/setup/load-env.ts"],
  },
})
