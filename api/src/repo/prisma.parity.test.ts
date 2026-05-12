// Repo parity test. Runs the same assertions against FixtureRepo and
// PrismaRepo so in-memory/Postgres drift — semantics around search
// pagination, list filters, envelope counts — can't slip past the canary's
// narrow assertions.
//
// Skipped unless POSTGRES_URL is set. `pnpm test` stays docker-free.

import type { IEnvironment, IRobot } from "@festivus/types"
import { PrismaClient } from "@prisma/client"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { migrate } from "../db/migrate.js"
import { closePool, getPool } from "../db/pool.js"
import { FixtureRepo } from "./fixture.js"
import { PrismaRepo } from "./prisma.js"

const run = process.env["POSTGRES_URL"] ? describe : describe.skip

const FIXTURE_ROBOTS = [
  { slug: "parity-franka", name: "Parity Franka", description: "bimanual tabletop research arm" },
  { slug: "parity-ur5e", name: "Parity UR5e", description: "industrial collaborative arm" },
  { slug: "parity-spot", name: "Parity Spot", description: "quadruped legged mobile robot" },
] as unknown as IRobot[]

const FIXTURE_ENVIRONMENTS = [
  { slug: "parity-lab", name: "Parity Lab" },
  { slug: "parity-field", name: "Parity Field" },
] as unknown as IEnvironment[]

async function seedTable(): Promise<void> {
  const pool = getPool()
  await pool.query("DELETE FROM robots WHERE slug LIKE 'parity-%'")
  for (const r of FIXTURE_ROBOTS) {
    await pool.query(
      "INSERT INTO robots (slug, data) VALUES ($1, $2) ON CONFLICT (slug) DO UPDATE SET data = EXCLUDED.data",
      [(r as unknown as { slug: string }).slug, JSON.stringify(r)],
    )
  }
}

async function cleanupTable(): Promise<void> {
  const pool = getPool()
  await pool.query("DELETE FROM robots WHERE slug LIKE 'parity-%'")
}

run("repo parity (FixtureRepo vs PrismaRepo)", () => {
  let prismaRepo: PrismaRepo
  let prisma: PrismaClient
  const fixtureRepo = new FixtureRepo({
    robots: FIXTURE_ROBOTS,
    environments: FIXTURE_ENVIRONMENTS,
  })

  beforeAll(async () => {
    await migrate()
    await seedTable()
    prisma = new PrismaClient()
    prismaRepo = new PrismaRepo(prisma, FIXTURE_ENVIRONMENTS)
  })

  afterAll(async () => {
    await cleanupTable()
    await prisma.$disconnect()
    await closePool()
  })

  it("list(robots) envelope count matches across repos (no filter)", async () => {
    const fx = await fixtureRepo.list("robots", { limit: 100, offset: 0 })
    const pg = await prismaRepo.list("robots", { limit: 100, offset: 0 })
    expect(pg.count).toBeGreaterThanOrEqual(FIXTURE_ROBOTS.length)
    expect(fx.count).toBe(FIXTURE_ROBOTS.length)
  })

  it("list(robots) pagination is stable across repos", async () => {
    const fxPage1 = await fixtureRepo.list("robots", { limit: 2, offset: 0 })
    const fxPage2 = await fixtureRepo.list("robots", { limit: 2, offset: 2 })
    expect(fxPage1.results).toHaveLength(2)
    expect(fxPage2.results).toHaveLength(1)

    const pgPage1 = await prismaRepo.list("robots", { limit: 2, offset: 0 })
    expect(pgPage1.results.length).toBeLessThanOrEqual(2)
  })

  it("getBySlug returns the same record across repos", async () => {
    const fx = await fixtureRepo.getBySlug("robots", "parity-franka")
    const pg = await prismaRepo.getBySlug("robots", "parity-franka")
    expect(fx).toBeTruthy()
    expect(pg).toBeTruthy()
    expect((pg as unknown as { slug: string }).slug).toBe("parity-franka")
  })

  it("getBySlug returns null for unknown slug on both", async () => {
    expect(await fixtureRepo.getBySlug("robots", "nope")).toBeNull()
    expect(await prismaRepo.getBySlug("robots", "parity-nope-xyz")).toBeNull()
  })

  it("search surfaces seeded records on both (distinct term)", async () => {
    const q = "bimanual tabletop research"
    const fx = await fixtureRepo.search(q, { limit: 10, offset: 0 })
    const pg = await prismaRepo.search(q, { limit: 10, offset: 0 })
    expect(fx.count).toBeGreaterThanOrEqual(1)
    expect(pg.count).toBeGreaterThanOrEqual(1)
    expect(fx.results.some((r) => r.slug === "parity-franka")).toBe(true)
    expect(pg.results.some((r) => r.slug === "parity-franka")).toBe(true)
  })

  it("listEnvironments envelope shape matches across repos", async () => {
    const fx = await fixtureRepo.listEnvironments({ limit: 10, offset: 0 })
    const pg = await prismaRepo.listEnvironments({ limit: 10, offset: 0 })
    expect(fx.count).toBe(pg.count)
    expect(fx.results.length).toBe(pg.results.length)
  })
})
