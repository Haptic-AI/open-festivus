/**
 * Spec 017 Phase 4: enrich curated robots from scraped product-page markdown.
 *
 * Pipeline per row:
 *   1. scrape(row.product_page_url) via @festivus/scrape (disk-cached, retrying)
 *   2. Anthropic Claude (temperature=0, tool-use schema) extracts structured
 *      fields with per-field confidence scores
 *   3. Fields with confidence < CONFIDENCE_THRESHOLD become null (honest
 *      unknowns rather than guesses)
 *   4. UPDATE robots SET data = jsonb-merged with the extracted top-level
 *      fields + a full {value, confidence} audit trail under data->'enrichment'
 *   5. Idempotency: sha256(markdown) stored as data->'enrichment'->'input_hash'.
 *      A subsequent run skips the LLM + DB update when the hash matches.
 *
 * Flags:
 *   --dry-run   log what would change, do not UPDATE
 *   --only=<slug>,<slug>   restrict run to specific slugs (comma-separated)
 *   --scrape-only   Phase-4.1 skeleton mode: scrape + log, no LLM, no DB
 *
 * Verify: bash scripts/sql-gates.sh must remain green after a full run.
 */

import "../_load-env.js"
import { readFileSync, writeFileSync, existsSync, appendFileSync } from "node:fs"
import { createHash } from "node:crypto"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import Anthropic from "@anthropic-ai/sdk"
import { scrape } from "@festivus/scrape"
import type { IScrapeResult } from "@festivus/scrape"
import { closePool, getPgPool } from "../db/pool.js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, "../../..")
const SEED_PATH = resolve(REPO_ROOT, "data/robots_seed.json")

const CONFIDENCE_THRESHOLD = 0.7
const MARKDOWN_CHAR_BUDGET = 20_000
const MODEL = "claude-sonnet-4-20250514"

// Product pages that need JS rendering — known SPA hosts from spec + scrape skill.
const JS_HEAVY_HOSTS = new Set([
  "www.unitree.com",
  "www.tesla.com",
  "www.figure.ai",
  "www.1x.tech",
  "apptronik.com",
])

interface ISeedRow {
  slug: string
  name: string
  manufacturer: string
  product_page_url: string
  [key: string]: unknown
}

export interface IConfidenceField<T> {
  value: T
  confidence: number
}

export interface IExtraction {
  dof: IConfidenceField<number | null>
  weight_kg: IConfidenceField<number | null>
  price_usd: IConfidenceField<number | null>
  price_availability: IConfidenceField<"public" | "on_request" | "not_public" | "unknown">
  description_sentence: IConfidenceField<string | null>
  description_paragraph: IConfidenceField<string | null>
  sensors: IConfidenceField<string[] | null>
  actuators: IConfidenceField<string | null>
}

const extractionToolSchema = {
  name: "emit_robot_facts",
  description:
    "Emit structured robot facts extracted from a manufacturer product page. For every field include a confidence in [0,1] reflecting how directly the value comes from the text (not inferred, not guessed). When the page does not contain the fact, return null with confidence 0.",
  input_schema: {
    type: "object",
    required: [
      "dof",
      "weight_kg",
      "price_usd",
      "price_availability",
      "description_sentence",
      "description_paragraph",
      "sensors",
      "actuators",
    ],
    properties: {
      dof: {
        type: "object",
        required: ["value", "confidence"],
        properties: {
          value: { type: ["number", "null"], description: "Degrees of freedom (joint count), or null" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
      },
      weight_kg: {
        type: "object",
        required: ["value", "confidence"],
        properties: {
          value: { type: ["number", "null"] },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
      },
      price_usd: {
        type: "object",
        required: ["value", "confidence"],
        properties: {
          value: { type: ["number", "null"], description: "Publicly listed USD price, or null" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
      },
      price_availability: {
        type: "object",
        required: ["value", "confidence"],
        properties: {
          value: { type: "string", enum: ["public", "on_request", "not_public", "unknown"] },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
      },
      description_sentence: {
        type: "object",
        required: ["value", "confidence"],
        properties: {
          value: { type: ["string", "null"], description: "One-sentence vendor description (<=160 chars)" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
      },
      description_paragraph: {
        type: "object",
        required: ["value", "confidence"],
        properties: {
          value: { type: ["string", "null"], description: "One-paragraph vendor description (<=600 chars)" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
      },
      sensors: {
        type: "object",
        required: ["value", "confidence"],
        properties: {
          value: {
            type: ["array", "null"],
            items: { type: "string" },
            description: "Onboard sensor list as strings (cameras, IMU, lidar, encoders, etc.)",
          },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
      },
      actuators: {
        type: "object",
        required: ["value", "confidence"],
        properties: {
          value: { type: ["string", "null"], description: "Concise actuator description" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
      },
    },
  },
} as const

function loadSeed(): ISeedRow[] {
  return JSON.parse(readFileSync(SEED_PATH, "utf-8")) as ISeedRow[]
}

export function hashMarkdown(markdown: string): string {
  return createHash("sha256").update(markdown).digest("hex")
}

function parseFlags(argv: string[]): {
  dryRun: boolean
  scrapeOnly: boolean
  only: Set<string> | null
  patchesOut: string | null
  stateFile: string
} {
  let dryRun = false
  let scrapeOnly = false
  let only: Set<string> | null = null
  let patchesOut: string | null = null
  let stateFile = resolve(__dirname, ".enrichment-state.json")
  for (const a of argv.slice(2)) {
    if (a === "--dry-run") dryRun = true
    else if (a === "--scrape-only") scrapeOnly = true
    else if (a.startsWith("--only=")) only = new Set(a.slice("--only=".length).split(","))
    else if (a.startsWith("--patches-out=")) patchesOut = a.slice("--patches-out=".length)
    else if (a.startsWith("--state-file=")) stateFile = a.slice("--state-file=".length)
  }
  return { dryRun, scrapeOnly, only, patchesOut, stateFile }
}

function loadState(path: string): Record<string, string> {
  if (!existsSync(path)) return {}
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as Record<string, string>
  } catch {
    return {}
  }
}

function saveState(path: string, state: Record<string, string>): void {
  writeFileSync(path, JSON.stringify(state, null, 2))
}

async function extractWithLlm(
  client: Anthropic,
  row: ISeedRow,
  markdown: string,
): Promise<IExtraction | null> {
  const clipped = markdown.slice(0, MARKDOWN_CHAR_BUDGET)
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    temperature: 0,
    system:
      "You are a structured data extractor. Given markdown scraped from a robot manufacturer's product page, emit facts via the emit_robot_facts tool. For every field include a confidence in [0,1] reflecting how directly the value comes from the text. If the markdown does not contain the information, return null with confidence 0. Never guess, never infer from general knowledge. Prefer null over a plausible-looking fabrication.",
    tools: [extractionToolSchema as unknown as Anthropic.Tool],
    tool_choice: { type: "tool", name: "emit_robot_facts" },
    messages: [
      {
        role: "user",
        content: `Robot: ${row.name} (slug=${row.slug}, manufacturer=${row.manufacturer})\n\nScraped markdown (first ${MARKDOWN_CHAR_BUDGET} chars):\n\n${clipped}`,
      },
    ],
  })
  for (const block of response.content) {
    if (block.type === "tool_use" && block.name === "emit_robot_facts") {
      return block.input as unknown as IExtraction
    }
  }
  return null
}

export function applyConfidenceThreshold(raw: IExtraction): IExtraction {
  const gate = <T>(f: IConfidenceField<T>, nullValue: T): IConfidenceField<T> =>
    f.confidence < CONFIDENCE_THRESHOLD ? { value: nullValue, confidence: f.confidence } : f
  return {
    dof: gate(raw.dof, null),
    weight_kg: gate(raw.weight_kg, null),
    price_usd: gate(raw.price_usd, null),
    // Spec allows 'unknown' as a legitimate low-confidence fallback for the enum.
    price_availability:
      raw.price_availability.confidence < CONFIDENCE_THRESHOLD
        ? { value: "unknown", confidence: raw.price_availability.confidence }
        : raw.price_availability,
    description_sentence: gate(raw.description_sentence, null),
    description_paragraph: gate(raw.description_paragraph, null),
    sensors: gate(raw.sensors, null),
    actuators: gate(raw.actuators, null),
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return ""
  }
}

async function main(): Promise<void> {
  const { dryRun, scrapeOnly, only, patchesOut, stateFile } = parseFlags(process.argv)
  const seed = loadSeed()
  const rows = only ? seed.filter((r) => only.has(r.slug)) : seed

  const anthropicKey = process.env["ANTHROPIC_API_KEY"]
  if (!scrapeOnly && !anthropicKey) {
    throw new Error("ANTHROPIC_API_KEY is not set — required for enrichment")
  }
  const anthropic = scrapeOnly ? null : new Anthropic({ apiKey: anthropicKey })

  // When --patches-out is set we skip the DB entirely and emit a JSONL stream
  // of {slug, patch} lines for a downstream psql applier. This sidesteps the
  // host-postgres port conflict on this workstation without abandoning the
  // canonical pg.Pool code path.
  const usePool = !scrapeOnly && !dryRun && patchesOut === null
  const pool = usePool ? getPgPool() : null
  const state = loadState(stateFile)

  if (patchesOut !== null) writeFileSync(patchesOut, "")

  let totalCost = 0
  let cacheHits = 0
  let thinPages = 0
  let dbUpdates = 0
  let dbSkipsIdempotent = 0
  let llmFailures = 0

  for (const row of rows) {
    const opts = JS_HEAVY_HOSTS.has(hostOf(row.product_page_url))
      ? { waitSeconds: 5, renderJs: true }
      : {}
    let result: IScrapeResult
    try {
      result = await scrape(row.product_page_url, opts)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.log(`FAIL ${row.slug} scrape_error="${msg}"`)
      continue
    }
    totalCost += result.cost
    if (result.cached) cacheHits += 1
    const len = result.markdown.length
    const thin = len < 500
    if (thin) thinPages += 1
    console.log(
      `SCRAPE ${row.slug} cost=${result.cost} cached=${result.cached} js=${result.renderedJs} len=${len}${thin ? " THIN" : ""}`,
    )
    if (scrapeOnly) continue

    const markdownHash = hashMarkdown(result.markdown)

    // Idempotency — prefer the DB as source of truth, fall back to local state file.
    let stored: string | null = null
    if (pool) {
      const existing = await pool.query<{ stored: string | null }>(
        "SELECT (data->'enrichment'->>'input_hash') AS stored FROM robots WHERE slug = $1",
        [row.slug],
      )
      stored = existing.rows[0]?.stored ?? null
    } else {
      stored = state[row.slug] ?? null
    }
    if (stored === markdownHash) {
      dbSkipsIdempotent += 1
      console.log(`SKIP  ${row.slug} enrichment_hash matches — idempotent`)
      continue
    }

    let raw: IExtraction | null = null
    try {
      if (!anthropic) throw new Error("anthropic client missing")
      raw = await extractWithLlm(anthropic, row, result.markdown)
    } catch (err) {
      llmFailures += 1
      const msg = err instanceof Error ? err.message : String(err)
      console.log(`LLM-FAIL ${row.slug} error="${msg}"`)
      continue
    }
    if (!raw) {
      llmFailures += 1
      console.log(`LLM-FAIL ${row.slug} no tool_use block`)
      continue
    }

    const extraction = applyConfidenceThreshold(raw)
    const enrichmentBlob = {
      input_hash: markdownHash,
      extracted_at: new Date().toISOString(),
      ...extraction,
    }

    console.log(
      `EXTRACT ${row.slug} dof=${extraction.dof.value}(${extraction.dof.confidence.toFixed(2)}) ` +
        `weight=${extraction.weight_kg.value}(${extraction.weight_kg.confidence.toFixed(2)}) ` +
        `price=${extraction.price_usd.value}(${extraction.price_usd.confidence.toFixed(2)}) ` +
        `avail=${extraction.price_availability.value}(${extraction.price_availability.confidence.toFixed(2)})`,
    )

    // Merge top-level fields (where confidence cleared the bar) + attach enrichment audit trail.
    // Spec 017 safety: never write 0 to dof/price_usd even if the LLM insists — null is the only
    // legal non-positive. This protects the SQL gates from a confident-but-wrong extraction.
    const patch: Record<string, unknown> = { enrichment: enrichmentBlob }
    if (extraction.dof.value !== null && extraction.dof.value > 0) patch["dof"] = extraction.dof.value
    if (extraction.weight_kg.value !== null && extraction.weight_kg.value > 0)
      patch["weight_kg"] = extraction.weight_kg.value
    if (extraction.price_usd.value !== null && extraction.price_usd.value > 0)
      patch["price_usd"] = extraction.price_usd.value
    if (extraction.price_availability.value !== "unknown")
      patch["price_availability"] = extraction.price_availability.value
    if (extraction.description_paragraph.value !== null)
      patch["description"] = extraction.description_paragraph.value
    if (extraction.sensors.value !== null) patch["sensors"] = extraction.sensors.value
    if (extraction.actuators.value !== null && extraction.actuators.value.length > 0)
      patch["actuators"] = extraction.actuators.value

    if (dryRun) continue

    if (patchesOut !== null) {
      appendFileSync(patchesOut, JSON.stringify({ slug: row.slug, patch }) + "\n")
      state[row.slug] = markdownHash
      saveState(stateFile, state)
      dbUpdates += 1
      continue
    }

    if (pool) {
      await pool.query("UPDATE robots SET data = data || $2::jsonb WHERE slug = $1", [
        row.slug,
        JSON.stringify(patch),
      ])
      state[row.slug] = markdownHash
      saveState(stateFile, state)
      dbUpdates += 1
    }
  }

  console.log(
    `\nSUMMARY rows=${rows.length} cost=${totalCost.toFixed(2)} cache_hits=${cacheHits} ` +
      `thin=${thinPages} db_updates=${dbUpdates} idempotent_skips=${dbSkipsIdempotent} ` +
      `llm_failures=${llmFailures}`,
  )
  if (pool) await closePool()
}

const isMain = process.argv[1] && import.meta.url === `file://${resolve(process.argv[1])}`
if (isMain) {
  main().catch(async (err) => {
    console.error("enrich: failed", err)
    try {
      await closePool()
    } catch {
      // ignore
    }
    process.exit(1)
  })
}
