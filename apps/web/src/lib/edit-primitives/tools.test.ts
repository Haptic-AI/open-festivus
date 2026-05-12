import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { AGENT_EDITABLE_FIELDS, AGENT_EDITABLE_TABLES, type IAgentEditableTable } from "./allowlist"
import { buildAllowlistPreamble, buildTools } from "./tools"

/**
 * Spec 029 Step 3.1. Two concerns:
 *
 *   1. Tool definitions: shape assertions, coverage per table.
 *   2. Drift detection: the apps/web allowlist mirror must stay in
 *      sync with api/src/validation/patch-schemas.ts. Read that file
 *      directly and regex-extract the field names under each
 *      per-table `.strict().partial()` block.
 */

function extractServerAllowlist(): Record<string, string[]> {
  const path = resolve(
    __dirname,
    "..",
    "..",
    "..",
    "..",
    "..",
    "api",
    "src",
    "validation",
    "patch-schemas.ts",
  )
  const src = readFileSync(path, "utf-8")

  // Map the `const <name>PatchSchema = z.object({ ... }).strict().partial()`
  // blocks to their table names.
  const blockToTable: Record<string, string> = {
    robot: "robots",
    policy: "policies",
    dataset: "datasets",
    benchmarkRecord: "benchmarks",
    environment: "environments",
    deployNote: "deploy_notes",
    paper: "papers",
    task: "tasks",
    hardware: "hardware",
    compatibilityEdge: "compatibility_edges",
    laundryCompatEdge: "laundry_compat_edges",
  }

  const out: Record<string, string[]> = {}
  for (const [blockName, table] of Object.entries(blockToTable)) {
    const regex = new RegExp(
      `const ${blockName}PatchSchema = z\\.object\\(\\{([\\s\\S]*?)\\}\\)\\.strict\\(\\)\\.partial\\(\\)`,
      "m",
    )
    const match = regex.exec(src)
    if (!match) throw new Error(`could not locate ${blockName}PatchSchema in patch-schemas.ts`)
    const body = match[1]
    if (!body) throw new Error(`empty body for ${blockName}PatchSchema`)
    const keyRe = /^\s*([a-z_][a-z0-9_]*)\s*:/gim
    const keys: string[] = []
    let keyMatch: RegExpExecArray | null
    while ((keyMatch = keyRe.exec(body)) !== null) {
      if (keyMatch[1]) keys.push(keyMatch[1])
    }
    out[table] = keys
  }
  return out
}

describe("agent-chat tools (spec 029 step 3.1)", () => {
  it("defines 3 tools with the expected names", () => {
    const tools = buildTools()
    expect(tools.map((t) => t.name)).toEqual(["list_candidates", "propose_edit", "apply_edit"])
  })

  it("exposes every domain table in the `table` enum of both candidate and propose tools", () => {
    const tools = buildTools()
    for (const name of ["list_candidates", "propose_edit"]) {
      const tool = tools.find((t) => t.name === name)
      expect(tool).toBeDefined()
      const input_schema = tool!.input_schema as {
        properties: { table: { enum: string[] } }
      }
      expect([...input_schema.properties.table.enum].sort()).toEqual([...AGENT_EDITABLE_TABLES].sort())
    }
  })

  it("allowlist includes weight_kg for robots and excludes name", () => {
    const robots = AGENT_EDITABLE_FIELDS.robots
    expect(robots).toContain("weight_kg")
    expect(robots).not.toContain("name")
  })

  it("allowlist includes license for policies and excludes hf_repo_id", () => {
    const policies = AGENT_EDITABLE_FIELDS.policies
    expect(policies).toContain("license")
    expect(policies).not.toContain("hf_repo_id")
  })

  it("allowlist includes difficulty for deploy_notes and excludes name", () => {
    // Spec 029 Success criterion #4 explicitly names this combo.
    expect(AGENT_EDITABLE_FIELDS.deploy_notes).toContain("severity")
    expect(AGENT_EDITABLE_FIELDS.deploy_notes).not.toContain("name")
  })

  it("preamble contains every table + its allowlist", () => {
    const preamble = buildAllowlistPreamble()
    for (const table of AGENT_EDITABLE_TABLES) {
      expect(preamble).toContain(table)
      for (const field of AGENT_EDITABLE_FIELDS[table as IAgentEditableTable]) {
        expect(preamble).toContain(field)
      }
    }
  })

  it("parity: apps/web allowlist matches api/src/validation/patch-schemas.ts field names", () => {
    const serverFields = extractServerAllowlist()
    for (const table of AGENT_EDITABLE_TABLES) {
      const clientKeys = [...AGENT_EDITABLE_FIELDS[table as IAgentEditableTable]].sort()
      const serverKeys = (serverFields[table] ?? []).slice().sort()
      expect(clientKeys, `drift on table ${table}`).toEqual(serverKeys)
    }
  })
})
