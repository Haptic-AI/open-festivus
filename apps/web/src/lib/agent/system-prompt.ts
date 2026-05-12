/**
 * System prompt for the Festivus Workbench agent.
 *
 * The prompt contains ONLY behavioral rules — no seed data is inlined.
 * The model fetches every robot, policy, task, environment, and dataset
 * record on demand via the API tools (search_robots, search_policies, etc.).
 * This keeps the prompt under ~3K tokens regardless of dataset size.
 *
 * Phase 4.2: each specialist's section lives in its own versioned `.md`
 * file under `prompts/`, plus one shared `core-rules-v1.md` for the
 * cross-cutting tools / tiers / behavioral rules / patterns / node shapes.
 * This file just loads them and concatenates. Versioning lets us A/B
 * one specialist without rewriting the whole prompt.
 *
 * Rule 30 (cross-file list invariant): the prompt files on disk under
 * `prompts/` and the import list in `SPECIALIST_PROMPT_FILES` below MUST
 * agree. The walk-both-sides check lives in
 * `tests/seed-validation/prompt-registry.test.ts` — adding a new
 * specialist file without registering it (or vice versa) fails the
 * registry test immediately.
 *
 * Rule 32: the registry test reads THIS file as source text and pulls
 * the constants below via regex, not via runtime import. Keep the const
 * declarations as plain string-literal arrays so the regex extractor
 * (`/SPECIALIST_PROMPT_FILES\s*=\s*\[([^\]]+)\]/`) keeps working.
 */

import { PROMPT_TEXT } from "./prompts.generated"

/**
 * Specialist prompt registry. Order in this array is the order specialist
 * sections appear in the assembled system prompt.
 *
 * To add a new specialist:
 *   1. Create `<slug>-vN.md` under `apps/web/src/lib/agent/prompts/`
 *   2. Add the bare slug here (no `-vN`, no `.md`)
 *   3. Update `SPECIALIST_PROMPT_VERSION` if you're bumping versions
 *   4. The Rule 30 registry test will fire if either side is missed
 */
export const SPECIALIST_PROMPT_FILES = [
  "task-analyst",
  "hardware-scout",
  "policy-scout",
  "sim-engineer",
  "community-scout",
  "deploy-advisor",
] as const

/** The shared cross-cutting rules section that wraps every specialist. */
export const CORE_RULES_FILE = "core-rules"

/** Bumping this means a new vN.md file for every specialist. v1 is the initial split. */
export const SPECIALIST_PROMPT_VERSION = 1

// Prompt content is bundled into `prompts.generated.ts` by
// `apps/web/scripts/build-prompts.mjs`. Static imports are required
// for Vercel's nft bundler to trace the prompt files into the serverless
// function — a runtime `readFileSync(import.meta.url + ...)` 500'd in
// prod with ENOENT because nft can't follow a dynamic path.
function loadPrompt(slug: string, version: number): string {
  const key = `${slug}-v${version}`
  const text = PROMPT_TEXT[key]
  if (text === undefined) {
    throw new Error(
      `Missing prompt "${key}" in prompts.generated.ts. Run \`pnpm --filter @festivus/web build:prompts\`.`,
    )
  }
  return text
}

/**
 * Stable prefix for Anthropic prompt caching (spec 029 phase 3.8). ~3.8k
 * tokens that are byte-identical across every turn of a session. The route
 * wraps this in a `{type:"text", cache_control:{type:"ephemeral"}}` block
 * so Anthropic serves cached-prefix turns ~10x faster.
 *
 * Any edit here changes the cache key — first request after a deploy pays
 * the cache-write, subsequent turns are hot.
 */
export function buildStableSystemPrompt(): string {
  const core = loadPrompt(CORE_RULES_FILE, SPECIALIST_PROMPT_VERSION)
  const specialists = SPECIALIST_PROMPT_FILES
    .map((slug) => loadPrompt(slug, SPECIALIST_PROMPT_VERSION))
    .join("\n\n")
  return `${core}

## Six specialists

${specialists}`
}

/**
 * Per-request tail — project state + self-check. Small (≤ 500 tokens)
 * and changes every turn as the canvas evolves, so it sits after the
 * cached block with no cache_control of its own.
 */
export function buildDynamicSystemPrompt(projectState: string): string {
  return `## Current project state
${projectState}

Self-check before ending: did I add a robot? → deployment message. Did I populate a lane? → ask_user. Was this a new goal? → task decomposed first.`
}

export function buildSystemPrompt(_seedData: string, projectState: string): string {
  // _seedData is intentionally unused — kept in the signature so the route
  // call site doesn't need to change. Step 2.3 deleted seed-data injection.
  // Composes the cacheable prefix + per-turn tail for single-string
  // consumers (tests, legacy non-caching paths).
  return `${buildStableSystemPrompt()}

${buildDynamicSystemPrompt(projectState)}`
}
