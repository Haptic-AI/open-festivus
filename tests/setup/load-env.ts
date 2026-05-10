/**
 * Vitest per-worker env loader.
 *
 * Reads `apps/web/.env.local` into `process.env` so fast-tier tests
 * that depend on the same config as the Next app (e.g. the
 * Festivus data API canary) can see `FESTIVUS_DATASET_API_URL`,
 * `ANTHROPIC_API_KEY`, etc. without a shell-side prefix on every
 * `pnpm test` invocation.
 *
 * Why `setupFiles` and not `globalSetup`: vitest forks workers per
 * test file, and `globalSetup` runs in the parent process — its
 * `process.env` mutations do not reach the workers. `setupFiles`
 * runs inside each worker, so the env is populated before any test
 * in that worker loads.
 *
 * Missing `.env.local` is tolerated: a fresh clone with no local
 * config still runs `pnpm test` green. The canary test skips itself
 * when its env var is unset.
 */

import { resolve } from "node:path"

const ENV_PATH = resolve(__dirname, "../../apps/web/.env.local")

try {
  process.loadEnvFile(ENV_PATH)
} catch {
  // fresh clone or gitignored; nothing to load
}
