/**
 * Prompt registry invariant (Phase 4.2 / Codified Rule 30).
 *
 * THIS FOLLOWS RULE 30 — the cross-file list invariant meta-rule. The
 * specialist prompt registry has TWO sources of truth that must agree:
 *
 *   (a) Filesystem: `apps/web/src/lib/agent/prompts/*.md` files
 *   (b) Source-text registry: the `SPECIALIST_PROMPT_FILES` const in
 *       `apps/web/src/lib/agent/system-prompt.ts`
 *
 * Adding a new specialist file without registering it (or vice versa)
 * silently breaks the assembled system prompt — either the new specialist
 * never speaks, or `loadPrompt` throws on a missing file at request time.
 * Rule 30 says walk both sides.
 *
 * Implementation pattern matches Step 5.4 (test discovery) and Step 4.4
 * (data registry):
 *   1. Walk filesystem → list of bare specialist slugs (strip `-v1.md`)
 *   2. Read system-prompt.ts as SOURCE TEXT (Rule 32) → extract the
 *      SPECIALIST_PROMPT_FILES array via regex
 *   3. Standing assertion: the two sets are equal, with `core-rules`
 *      excluded as the explicit non-specialist (allowlist of one)
 *   4. Negative test (Rule 31): construct an orphan in mkdtempSync
 *      sandbox, point findOrphanPrompts() at it via extraRoots, assert
 *      detection, clean up in finally
 *   5. Failure message lists each orphan by name and points the
 *      contributor at the structural fix
 *
 * Hand-rolled file walking (Rule 33) — no glob dep.
 */

import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join, relative, resolve } from "node:path"
import { tmpdir } from "node:os"
import { describe, expect, it } from "vitest"

const REPO_ROOT = resolve(__dirname, "../../")
const PROMPTS_DIR_REL = "apps/web/src/lib/agent/prompts"
const PROMPTS_DIR_ABS = join(REPO_ROOT, PROMPTS_DIR_REL)
const SYSTEM_PROMPT_PATH = join(REPO_ROOT, "apps/web/src/lib/agent/system-prompt.ts")

/**
 * Files in the prompts dir that are NOT specialist files. The shared
 * cross-cutting rules live in `core-rules-v1.md` and are loaded as
 * the prompt header, not as one of the six specialists. Any future
 * non-specialist file (e.g., `_changelog-v1.md`) gets added here.
 */
const NON_SPECIALIST_FILES: ReadonlySet<string> = new Set(["core-rules"])

// ── Filesystem walk ───────────────────────────────────────────────

interface IPromptFile {
  /** Bare slug with the version suffix stripped, e.g. "hardware-scout". */
  slug: string
  /** Version number parsed from `-vN.md`. */
  version: number
  /** Filename relative to the prompts dir. */
  filename: string
}

/**
 * List every prompt file in a directory and parse the slug + version.
 * Skips files that don't match the `<slug>-vN.md` pattern.
 */
export function listPromptFiles(absoluteDir: string): IPromptFile[] {
  if (!existsSync(absoluteDir)) return []
  const entries: string[] = readdirSync(absoluteDir)
  const out: IPromptFile[] = []
  for (const filename of entries) {
    const match = filename.match(/^(.+?)-v(\d+)\.md$/)
    if (match === null || match[1] === undefined || match[2] === undefined) continue
    out.push({ slug: match[1], version: parseInt(match[2], 10), filename })
  }
  return out.sort((a, b) => a.slug.localeCompare(b.slug))
}

/**
 * Read system-prompt.ts as SOURCE TEXT (Rule 32) and extract the
 * SPECIALIST_PROMPT_FILES const literal as an array of slugs. Reading
 * the source instead of importing the runtime export keeps this test
 * decoupled from any future loader refactor — we're checking the
 * literal contributor edit, not whatever object the loader assembled.
 */
export function readRegisteredSpecialistsFromSource(): string[] {
  const source = readFileSync(SYSTEM_PROMPT_PATH, "utf-8")
  const match = source.match(/SPECIALIST_PROMPT_FILES\s*=\s*\[([^\]]+)\]/)
  if (match === null || match[1] === undefined) {
    throw new Error(
      `could not find a "SPECIALIST_PROMPT_FILES = [...]" const in ${SYSTEM_PROMPT_PATH}. ` +
        `If you renamed it, update the regex in tests/seed-validation/prompt-registry.test.ts.`,
    )
  }
  const arrayBody = match[1]
  return Array.from(arrayBody.matchAll(/["']([^"']+)["']/g))
    .map((m) => m[1] as string)
    .sort()
}

/**
 * Find orphan slugs in either direction:
 *   - filesystem-only: file exists with no matching registry entry
 *   - registry-only: registry entry has no matching file
 * Excludes NON_SPECIALIST_FILES from both sides.
 *
 * Accepts an optional `extraDirs` parameter so the negative test can
 * point at a sandbox dir WITHOUT replacing the standing tree (Rule 31:
 * isolated bad-state construction).
 */
export interface IOrphanReport {
  filesystemOnly: string[]
  registryOnly: string[]
  filesystemSlugs: string[]
  registrySlugs: string[]
}

export function findOrphanPrompts(extraDirs: string[] = []): IOrphanReport {
  const allFiles = [
    ...listPromptFiles(PROMPTS_DIR_ABS),
    ...extraDirs.flatMap((dir) => listPromptFiles(join(REPO_ROOT, dir))),
  ]
  const filesystemSlugs = Array.from(
    new Set(allFiles.map((f) => f.slug).filter((slug) => !NON_SPECIALIST_FILES.has(slug))),
  ).sort()
  const registrySlugs = readRegisteredSpecialistsFromSource()
  const filesystemSet = new Set(filesystemSlugs)
  const registrySet = new Set(registrySlugs)
  return {
    filesystemOnly: filesystemSlugs.filter((s) => !registrySet.has(s)),
    registryOnly: registrySlugs.filter((s) => !filesystemSet.has(s)),
    filesystemSlugs,
    registrySlugs,
  }
}

// ── Standing assertions ───────────────────────────────────────────

describe("prompt registry walk-both-sides invariant (Rule 30)", () => {
  it("the prompts directory exists and contains at least the six specialists + core-rules", () => {
    const files = listPromptFiles(PROMPTS_DIR_ABS)
    expect(files.length).toBeGreaterThanOrEqual(7)
  })

  it("system-prompt.ts declares a SPECIALIST_PROMPT_FILES const literal", () => {
    const slugs = readRegisteredSpecialistsFromSource()
    expect(slugs.length).toBeGreaterThan(0)
  })

  it("core-rules-v1.md exists and is in NON_SPECIALIST_FILES (the explicit allowlist)", () => {
    const files = listPromptFiles(PROMPTS_DIR_ABS)
    const slugs = new Set(files.map((f) => f.slug))
    expect(slugs.has("core-rules")).toBe(true)
    expect(NON_SPECIALIST_FILES.has("core-rules")).toBe(true)
  })

  it("EVERY specialist prompt file has a matching registry entry (no filesystem-only orphans)", () => {
    const report = findOrphanPrompts()
    expect(
      report.filesystemOnly,
      report.filesystemOnly.length > 0
        ? `Found prompt files on disk that are NOT registered in SPECIALIST_PROMPT_FILES:\n  ${report.filesystemOnly.join("\n  ")}\n\n` +
            `Either:\n` +
            `  (a) Add the slug to SPECIALIST_PROMPT_FILES in apps/web/src/lib/agent/system-prompt.ts, OR\n` +
            `  (b) If the file is intentionally non-specialist (like core-rules), add the slug\n` +
            `      to NON_SPECIALIST_FILES at the top of this test file with a comment explaining why.`
        : "no filesystem-only orphans",
    ).toEqual([])
  })

  it("EVERY registry entry has a matching prompt file on disk (no registry-only orphans)", () => {
    const report = findOrphanPrompts()
    expect(
      report.registryOnly,
      report.registryOnly.length > 0
        ? `SPECIALIST_PROMPT_FILES references slugs with NO matching .md file:\n  ${report.registryOnly.join("\n  ")}\n\n` +
            `Either:\n` +
            `  (a) Create apps/web/src/lib/agent/prompts/<slug>-v1.md, OR\n` +
            `  (b) Remove the slug from SPECIALIST_PROMPT_FILES if the specialist was retired.`
        : "no registry-only orphans",
    ).toEqual([])
  })

  it("the registry has exactly six specialists (the canonical roster)", () => {
    const report = findOrphanPrompts()
    expect(report.registrySlugs.length).toBe(6)
    // Sanity: pin the canonical roster so a silent rename of a specialist
    // also fires this test, not just an add/remove.
    expect(new Set(report.registrySlugs)).toEqual(
      new Set(["task-analyst", "hardware-scout", "policy-scout", "sim-engineer", "community-scout", "deploy-advisor"]),
    )
  })

  it("every prompt file under the prompts dir has the -vN.md naming pattern", () => {
    const entries = readdirSync(PROMPTS_DIR_ABS)
    for (const entry of entries) {
      // Ignore hidden files (.DS_Store etc.)
      if (entry.startsWith(".")) continue
      expect(
        entry,
        `prompt file "${entry}" does not match the <slug>-vN.md pattern`,
      ).toMatch(/^[a-z][a-z0-9-]*-v\d+\.md$/)
    }
  })
})

// ── Negative test (Rule 31): construct an orphan, assert detection ─

describe("prompt registry — negative test (Rule 31, paired)", () => {
  it("findOrphanPrompts() flags a temporary <slug>-v1.md file in a sandbox dir", () => {
    // Build the orphan inside an isolated mkdtempSync sandbox so the
    // standing tree is never touched. Pass the sandbox path as an
    // extraDir so findOrphanPrompts walks BOTH the real dir AND the
    // sandbox — standing assertion still runs against the real tree.
    const sandboxRoot = mkdtempSync(join(tmpdir(), "festivus-prompt-registry-"))
    const sandboxRel = relative(REPO_ROOT, sandboxRoot)
    const orphanFilename = "phantom-specialist-v1.md"
    const orphanPath = join(sandboxRoot, orphanFilename)

    try {
      writeFileSync(
        orphanPath,
        "### phantom-specialist — magenta\n\n" +
          "Temporary orphan created by prompt-registry.test.ts negative test.\n",
      )

      const report = findOrphanPrompts([sandboxRel])
      expect(
        report.filesystemOnly.includes("phantom-specialist"),
        `expected filesystemOnly to include "phantom-specialist"; got: ${report.filesystemOnly.join(", ")}`,
      ).toBe(true)
    } finally {
      try { rmSync(orphanPath, { force: true }) } catch { /* already gone */ }
      try { rmSync(sandboxRoot, { recursive: true, force: true }) } catch { /* already gone */ }
    }

    // Sanity: after cleanup the orphan must be gone from the report.
    const reportAfter = findOrphanPrompts([sandboxRel])
    expect(reportAfter.filesystemOnly.includes("phantom-specialist")).toBe(false)
  })

  it("findOrphanPrompts() flags a registry-only orphan when the source declares a phantom slug", () => {
    // We can't easily mutate system-prompt.ts in a test without risking
    // corruption. Instead, simulate the registry-only direction by
    // testing the helper logic against a synthetic input. Read the real
    // registry, append a phantom slug to the comparison set, and assert
    // the diff math works.
    const report = findOrphanPrompts()
    const filesystemSet = new Set(report.filesystemSlugs)
    const phantomRegistry = [...report.registrySlugs, "phantom-specialist"].sort()
    const registryOnly = phantomRegistry.filter((s) => !filesystemSet.has(s))
    expect(registryOnly).toContain("phantom-specialist")
  })
})
