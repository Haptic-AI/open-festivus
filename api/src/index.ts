import "./_load-env.js"
import { resolve } from "node:path"
import { PrismaClient } from "@prisma/client"
import { createOneclickClient } from "./clients/oneclick.js"
import { environments } from "./db/environments-data.js"
import { getPool } from "./db/pool.js"
import { PrismaRepo } from "./repo/prisma.js"
import { TypesenseDecoratedRepo } from "./repo/typesense-decorator.js"
import { PrismaEpisodeStore } from "./routes/episodes.js"
import { createServer } from "./server.js"
import { createTypesenseClientFromEnv } from "./typesense/client.js"

export const PORT = 8000 as const

const isMain =
  process.argv[1] && import.meta.url === `file://${resolve(process.argv[1])}`

if (isMain) {
  const prisma = new PrismaClient()
  const baseRepo = new PrismaRepo(prisma, environments)
  // When TYPESENSE_* env is set, wrap the repo so every write also lands in
  // Typesense (best-effort, never blocks the write). When env is absent, the
  // factory returns null and we use the bare PrismaRepo — local dev without
  // a Typesense host stays functional.
  const typesense = createTypesenseClientFromEnv()
  const repo = typesense ? new TypesenseDecoratedRepo(baseRepo, typesense) : baseRepo
  // The api-key middleware still needs a raw IPool — it reads/writes the
  // api_keys table directly and does not yet go through Prisma.
  const pool = getPool()
  // Spec 025 iter-1 / 026: wire the oneclick render client only when
  // ONECLICK_API_KEY is set. When the key is missing we deliberately skip
  // mounting /v1/episodes rather than crashing — read-side traffic (robots,
  // policies, …) should still boot so local dev without a render key is
  // still useful.
  const hasOneclickKey = Boolean(process.env["ONECLICK_API_KEY"])
  const episodes = hasOneclickKey
    ? {
        store: new PrismaEpisodeStore(prisma),
        oneclick: createOneclickClient(),
      }
    : undefined
  // Spec 026: /v1/simulations mounts against Prisma in prod. GET works
  // without oneclick; POST requires it. We always pass oneclick when the key
  // is set (same gate as /v1/episodes) so both routes behave consistently.
  const simulations = hasOneclickKey
    ? { prisma, oneclick: createOneclickClient() }
    : { prisma }
  const app = createServer(repo, { db: pool, episodes, simulations, prisma, typesense })
  const port = Number.parseInt(process.env["PORT"] ?? String(PORT), 10)
  app.listen(port, () => {
    console.warn(`festivus-api listening on :${port}`)
    if (!hasOneclickKey) {
      console.warn(
        "note: ONECLICK_API_KEY missing — /v1/episodes is not mounted",
      )
    }
  })
}
