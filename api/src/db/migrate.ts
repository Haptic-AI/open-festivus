import { execSync } from "node:child_process"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { closePool } from "./pool.js"

const __dirname = dirname(fileURLToPath(import.meta.url))

// api/src/db -> api
const API_ROOT = resolve(__dirname, "..", "..")

export async function migrate(): Promise<void> {
  execSync("pnpm exec prisma migrate deploy", {
    cwd: API_ROOT,
    stdio: "inherit",
    env: process.env,
  })
}

const isMain =
  process.argv[1] && import.meta.url === `file://${resolve(process.argv[1])}`

if (isMain) {
  migrate()
    .then(async () => {
      console.warn("migrate: prisma migrate deploy complete")
      await closePool()
    })
    .catch(async (err) => {
      console.error("migrate: failed", err)
      await closePool()
      process.exit(1)
    })
}
