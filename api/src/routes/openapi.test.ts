import request from "supertest"
import { describe, expect, it } from "vitest"
import { FixtureRepo } from "../repo/fixture.js"
import { createServer } from "../server.js"

describe("GET /v1/openapi.json (spec 027 phase 4)", () => {
  it("returns an OpenAPI 3.1 document", async () => {
    const app = createServer(new FixtureRepo({}))
    const res = await request(app).get("/v1/openapi.json")

    expect(res.status).toBe(200)
    expect(res.body.openapi).toBe("3.1.0")
    expect(res.body.info.title).toBe("Festivus API")
  })

  it("declares the AgentApiKey security scheme", async () => {
    const app = createServer(new FixtureRepo({}))
    const res = await request(app).get("/v1/openapi.json")

    expect(res.body.components.securitySchemes.AgentApiKey).toMatchObject({
      type: "apiKey",
      in: "header",
      name: "x-api-key",
    })
  })

  it("describes PATCH paths for every writable table with the AgentApiKey requirement", async () => {
    // Issue #65 expanded the single `/v1/write/{table}/{slug}` into 11
    // concrete paths (one per writable table). Every one of them needs the
    // same security + response shape.
    const app = createServer(new FixtureRepo({}))
    const res = await request(app).get("/v1/openapi.json")

    const tables = [
      "robots", "policies", "datasets", "benchmarks", "deploy_notes",
      "environments", "tasks", "papers", "hardware",
      "compatibility_edges", "laundry_compat_edges",
    ]
    for (const table of tables) {
      const patch = res.body.paths[`/v1/write/${table}/{slug}`]?.patch
      expect(patch, `missing per-table PATCH path for ${table}`).toBeDefined()
      expect(patch.security).toEqual([{ AgentApiKey: [] }])
      expect(Object.keys(patch.responses)).toEqual(
        expect.arrayContaining(["202", "401", "403", "404", "422", "429"]),
      )
    }
  })

  it("emits a per-table patch body schema with additionalProperties:false + enumerated columns", async () => {
    // Issue #65 core assertion — the manifest must now tell an agent which
    // columns are writable without forcing it to GET a row first.
    const app = createServer(new FixtureRepo({}))
    const res = await request(app).get("/v1/openapi.json")

    const robotBody = res.body.components.schemas.RobotPatchBody
    expect(robotBody).toBeDefined()
    expect(robotBody.type).toBe("object")
    expect(robotBody.additionalProperties).toBe(false)
    // Real writable columns surface with types.
    expect(robotBody.properties.dof).toMatchObject({ type: "number", nullable: true })
    expect(robotBody.properties.weight_kg).toMatchObject({ type: "number", nullable: true })
    expect(robotBody.properties.type.enum).toEqual(
      expect.arrayContaining(["arm", "humanoid", "quadruped"]),
    )
    // Paraphrased / hallucinated columns stay out.
    expect(robotBody.properties).not.toHaveProperty("degrees_of_freedom")
    expect(robotBody.properties).not.toHaveProperty("name")
    expect(robotBody.properties).not.toHaveProperty("slug")

    // Sample a second table to prove the translator isn't robots-only.
    const laundryBody = res.body.components.schemas.LaundryCompatEdgePatchBody
    expect(laundryBody.additionalProperties).toBe(false)
    // z.union of literal ints → integer enum.
    expect(laundryBody.properties.tier).toMatchObject({ type: "integer", enum: [1, 2, 3] })
    // z.boolean
    expect(laundryBody.properties.simulator_first).toMatchObject({ type: "boolean" })
  })

  it("stays under the 32 KB LLM-fetch budget", async () => {
    // Budget rose from 10 KB → 32 KB when the manifest started enumerating
    // every writable column per table (issue #65). 32 KB is still <0.02% of
    // a 200K context window, so fetching once per session is cheap.
    const app = createServer(new FixtureRepo({}))
    const res = await request(app).get("/v1/openapi.json")
    const size = JSON.stringify(res.body).length
    expect(size).toBeLessThan(32_000)
  })

  it("does NOT leak internal moderator routes", async () => {
    const app = createServer(new FixtureRepo({}))
    const res = await request(app).get("/v1/openapi.json")
    const paths = Object.keys(res.body.paths)
    expect(paths).not.toContain("/v1/mutations")
    expect(paths.some((p) => p.includes("mutations"))).toBe(false)
  })

  it("sets a cache header so agents don't refetch on every call", async () => {
    const app = createServer(new FixtureRepo({}))
    const res = await request(app).get("/v1/openapi.json")
    expect(res.headers["cache-control"]).toContain("max-age")
  })
})
