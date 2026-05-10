/**
 * Side-effect module: load `.env` into `process.env` before any other api
 * module reads from it. Must be the very first import in `src/index.ts` and
 * in any standalone script under `src/scripts/`.
 *
 * Why not `tsx --env-file=.env`? tsx 4 treats unknown Node CLI flags as
 * positional args and fails with ERR_MODULE_NOT_FOUND on `./watch`. Node's
 * `process.loadEnvFile()` (Node 21.7+) is the workspace-friendly alternative.
 *
 * Why not dotenv? It's an extra dep and `process.loadEnvFile()` is built in.
 */

import { existsSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const candidates = [
  resolve(here, "../.env.local"),
  resolve(process.cwd(), ".env.local"),
  resolve(here, "../.env"),
  resolve(process.cwd(), ".env"),
]
for (const p of candidates) {
  if (existsSync(p)) {
    process.loadEnvFile(p)
    break
  }
}
