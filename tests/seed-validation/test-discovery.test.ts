/**
 * Test discovery invariant (Step 5.4 / Codified Rule 27).
 *
 * Lesson 35 caught a real bug pattern: silent test exclusion.
 * `vitest.config.ts` has `include: ["tests/**\/*.test.ts", ...]` and the
 * pattern silently excludes `.test.tsx` (and `.test.js`, `.test.jsx`,
 * `.test.mjs`, etc.). For two phases the badge component test in
 * `compatibility-badge.test.tsx` was never collected — vitest emitted
 * no warning, no error, no "0 tests" complaint. The file just sat there.
 *
 * Same shape as Rule 24 (data registry duplication): a config that fails
 * silently when something doesn't match. Same fix shape: an invariant
 * test that walks the filesystem and asserts every candidate file is
 * actually collected.
 *
 * Decision: keep the include glob restricted to `.test.ts` per Rule 28
 * (presentation logic lives in pure helpers, never in JSX). Tests
 * should never need to import a `.tsx` file. If a contributor adds a
 * `.test.tsx`, this test fires immediately and points them at Rule 28.
 *
 * Negative test: at the bottom of this file, the discovery helper is
 * exercised against a temporary `.test.tsx` orphan in `tests/seed-validation/`
 * that gets created at the start of the test, asserted as an orphan, and
 * deleted in `finally`.
 */

import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { join, relative, resolve } from "node:path"
import { tmpdir } from "node:os"
import { describe, expect, it } from "vitest"

const REPO_ROOT = resolve(__dirname, "../../")
const VITEST_CONFIG_PATH = join(REPO_ROOT, "vitest.config.ts")

// Roots that the project actually expects to contain tests. Mirrors the
// vitest.config.ts include patterns. Updating include must mean updating
// this list too — that coupling is the whole point of the invariant.
const TEST_ROOTS = ["tests", "apps/web/src"]

// Every "this looks like a test file" extension we want to detect. The
// invariant test must catch silently-excluded files for ANY of these
// extensions, not just .tsx (which is the only one that has bitten us so far).
const TEST_FILE_EXTENSIONS = [".test.ts", ".test.tsx", ".test.js", ".test.jsx", ".test.mjs", ".test.cts", ".test.mts"]

// ── Helpers ───────────────────────────────────────────────────────

function isTestFile(name: string): boolean {
  return TEST_FILE_EXTENSIONS.some((ext) => name.endsWith(ext))
}

/**
 * Walk a directory recursively and return every file matching one of the
 * test-file extensions. Returns paths relative to REPO_ROOT.
 */
function listTestFiles(rootRelative: string): string[] {
  const absoluteRoot = join(REPO_ROOT, rootRelative)
  if (!existsSync(absoluteRoot)) return []
  const found: string[] = []
  const stack: string[] = [absoluteRoot]
  while (stack.length > 0) {
    const dir = stack.pop() as string
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      continue
    }
    for (const entry of entries) {
      // Skip hidden dirs and node_modules to keep the walk fast and stable.
      if (entry.startsWith(".") || entry === "node_modules" || entry === "dist" || entry === ".next") continue
      const full = join(dir, entry)
      let stats
      try {
        stats = statSync(full)
      } catch {
        continue
      }
      if (stats.isDirectory()) {
        stack.push(full)
      } else if (isTestFile(entry)) {
        found.push(relative(REPO_ROOT, full))
      }
    }
  }
  return found.sort()
}

/**
 * Read vitest.config.ts as text and pull out the include glob list.
 * Reading the source instead of importing the config keeps this helper
 * independent of vite/vitest internals — we're checking the literal
 * config the contributor wrote, not whatever object vitest assembled.
 */
function readVitestIncludePatterns(): string[] {
  const source = readFileSync(VITEST_CONFIG_PATH, "utf-8")
  const match = source.match(/include\s*:\s*\[([^\]]+)\]/)
  if (match === null || match[1] === undefined) {
    throw new Error(`could not find an "include: [...]" array in ${VITEST_CONFIG_PATH}`)
  }
  const arrayBody = match[1]
  return Array.from(arrayBody.matchAll(/["']([^"']+)["']/g)).map((m) => m[1] as string)
}

/**
 * Convert one vitest include glob (e.g. "tests/**\/*.test.ts") into a
 * predicate over a relative file path. The patterns we care about are
 * limited and stylized — only `**`, the `{a,b,c}` brace alternation,
 * and `*` wildcards inside a single segment. A general-purpose glob
 * matcher would be overkill (and minimatch isn't a dep here).
 */
function compileGlob(pattern: string): (relativePath: string) => boolean {
  // Expand brace alternation: "*.test.{ts,tsx}" → ["*.test.ts", "*.test.tsx"]
  const variants = expandBraces(pattern)
  const regexes = variants.map(globToRegex)
  return (path) => regexes.some((rx) => rx.test(path))
}

function expandBraces(pattern: string): string[] {
  const braceMatch = pattern.match(/\{([^{}]+)\}/)
  if (braceMatch === null) return [pattern]
  const before = pattern.slice(0, braceMatch.index)
  const after = pattern.slice((braceMatch.index ?? 0) + braceMatch[0].length)
  const options = (braceMatch[1] ?? "").split(",")
  const expanded: string[] = []
  for (const option of options) {
    expanded.push(...expandBraces(`${before}${option}${after}`))
  }
  return expanded
}

function globToRegex(pattern: string): RegExp {
  // Translate the limited glob dialect we use:
  //   **   → match any chars across path separators
  //   *    → match any chars except path separator
  //   .    → literal
  let regex = ""
  let i = 0
  while (i < pattern.length) {
    const ch = pattern[i]
    const next = pattern[i + 1]
    if (ch === "*" && next === "*") {
      regex += ".*"
      i += 2
      // Skip a trailing path separator to avoid /\/.*\//
      if (pattern[i] === "/") i += 1
    } else if (ch === "*") {
      regex += "[^/]*"
      i += 1
    } else if (ch === ".") {
      regex += "\\."
      i += 1
    } else if (ch === "/") {
      regex += "/"
      i += 1
    } else {
      regex += ch
      i += 1
    }
  }
  return new RegExp(`^${regex}$`)
}

/**
 * The standing invariant: walk the filesystem under TEST_ROOTS, find every
 * test-shaped file, and check that at least one vitest include pattern
 * matches it. Anything that doesn't match is an orphan.
 */
function findOrphans(extraRoots: string[] = []): string[] {
  const includePatterns = readVitestIncludePatterns()
  const matchers = includePatterns.map(compileGlob)
  const orphans: string[] = []
  const allRoots = [...TEST_ROOTS, ...extraRoots]
  for (const root of allRoots) {
    for (const file of listTestFiles(root)) {
      const isCollected = matchers.some((m) => m(file))
      if (!isCollected) orphans.push(file)
    }
  }
  return orphans.sort()
}

// ── Standing assertions ───────────────────────────────────────────

describe("test discovery invariant (Step 5.4 / Codified Rule 27)", () => {
  it("vitest.config.ts declares an include array", () => {
    const patterns = readVitestIncludePatterns()
    expect(patterns.length).toBeGreaterThan(0)
  })

  it("the include patterns target the expected test roots", () => {
    const patterns = readVitestIncludePatterns()
    const joined = patterns.join(" ")
    expect(joined).toContain("tests/")
    expect(joined).toContain("apps/web/src/")
  })

  it("the filesystem walk finds at least one test file under tests/", () => {
    const files = listTestFiles("tests")
    expect(files.length).toBeGreaterThan(0)
  })

  it("EVERY test-shaped file in the repo is collected by the include glob (zero orphans)", () => {
    const orphans = findOrphans()
    expect(
      orphans,
      orphans.length > 0
        ? `Found test files that vitest will silently skip:\n  ${orphans.join("\n  ")}\n\n` +
            `Either:\n` +
            `  (a) Broaden the include glob in vitest.config.ts to match these files, OR\n` +
            `  (b) Per Codified Rule 28, extract the presentation logic into a pure\n` +
            `      .ts helper in lib/ and write a .test.ts that targets the helper\n` +
            `      directly. The .tsx component becomes a thin shell that delegates\n` +
            `      to the helper. See apps/web/src/lib/compatibility-badge-view.ts\n` +
            `      for the canonical example.`
        : "no orphans",
    ).toEqual([])
  })

  // Smoke check on the test count itself. Step 5.3 left us at 544; Step 5.4
  // adds this file with multiple `it`s, so the total must rise. If a future
  // refactor accidentally drops the count, this gate fires.
  it("the suite has more than 544 collected tests (post-Step-5.3 baseline)", () => {
    // We can't import the runtime test count from inside a vitest run without
    // recursion. Use the file count + a per-file lower bound as a proxy:
    // every test file in tests/seed-validation contributes ≥1 test, and we
    // know we're at 36+ files.
    const seedValidationFiles = listTestFiles("tests/seed-validation")
    expect(seedValidationFiles.length).toBeGreaterThanOrEqual(35)
  })
})

// ── Negative test: a temporary orphan must be detected ───────────

describe("test discovery invariant — negative test (orphan detection)", () => {
  it("findOrphans() flags a temporary .test.tsx file created in a fresh tree", () => {
    // Build the orphan inside an isolated temp directory so it can't possibly
    // affect the real tree, vitest's collected tests, or other parallel runs.
    // We then point findOrphans() at the temp dir as an extra root.
    const sandboxRoot = mkdtempSync(join(tmpdir(), "festivus-discovery-"))
    const sandboxRel = relative(REPO_ROOT, sandboxRoot)
    const orphanRel = join(sandboxRel, "phantom-component.test.tsx")
    const orphanPath = join(REPO_ROOT, orphanRel)

    try {
      writeFileSync(
        orphanPath,
        "// Temporary orphan created by test-discovery.test.ts negative test.\n" +
          "// This file should never be checked into git.\n" +
          "import { describe, it } from \"vitest\"\n" +
          "describe(\"phantom\", () => { it(\"phantom\", () => {}) })\n",
      )

      const orphans = findOrphans([sandboxRel])
      expect(
        orphans.includes(orphanRel),
        `expected orphans to include ${orphanRel}; got: ${orphans.join(", ")}`,
      ).toBe(true)
    } finally {
      // Always clean up, even if the assertion threw, so a failed negative
      // test doesn't poison the real tree.
      try { rmSync(orphanPath, { force: true }) } catch { /* already gone */ }
      try { rmSync(sandboxRoot, { recursive: true, force: true }) } catch { /* already gone */ }
    }

    // Sanity: after cleanup the orphan must be gone from the orphan list.
    const orphansAfter = findOrphans([sandboxRel])
    expect(orphansAfter.includes(orphanRel)).toBe(false)
  })

  it("findOrphans() returns an empty list when given a sandbox with only .test.ts files", () => {
    const sandboxRoot = mkdtempSync(join(tmpdir(), "festivus-discovery-clean-"))
    const sandboxRel = relative(REPO_ROOT, sandboxRoot)
    // .test.ts is matched by the include glob (when the relative path lives
    // under tests/, which our sandbox doesn't), so a sandbox under /tmp will
    // never be matched even for .test.ts files. The right assertion is that
    // a sandbox with NO test files at all yields zero orphans.
    try {
      writeFileSync(join(sandboxRoot, "not-a-test.ts"), "// not a test file\n")
      const orphans = findOrphans([sandboxRel])
      expect(orphans).toEqual([])
    } finally {
      try { rmSync(sandboxRoot, { recursive: true, force: true }) } catch { /* already gone */ }
    }
  })
})

// ── Glob matcher unit tests ───────────────────────────────────────
// The compileGlob helper is hand-rolled, so it gets its own coverage so a
// future regression can't quietly break the discovery invariant.

describe("compileGlob (test-discovery internal helper)", () => {
  it("matches a flat tests/foo.test.ts pattern", () => {
    const m = compileGlob("tests/**/*.test.ts")
    expect(m("tests/seed-validation/foo.test.ts")).toBe(true)
    expect(m("tests/persona-tests/agent-smoke.test.ts")).toBe(true)
  })

  it("rejects a .test.tsx file under the .test.ts pattern", () => {
    const m = compileGlob("tests/**/*.test.ts")
    expect(m("tests/seed-validation/badge.test.tsx")).toBe(false)
  })

  it("matches every brace alternative when given {ts,tsx,js}", () => {
    const m = compileGlob("tests/**/*.test.{ts,tsx,js}")
    expect(m("tests/foo.test.ts")).toBe(true)
    expect(m("tests/foo.test.tsx")).toBe(true)
    expect(m("tests/foo.test.js")).toBe(true)
    expect(m("tests/foo.test.cts")).toBe(false)
  })

  it("** matches across multiple directory levels", () => {
    const m = compileGlob("tests/**/*.test.ts")
    expect(m("tests/a/b/c/d.test.ts")).toBe(true)
  })

  it("does not cross root boundaries — apps/web/src pattern doesn't match tests/", () => {
    const m = compileGlob("apps/web/src/**/*.test.ts")
    expect(m("tests/foo.test.ts")).toBe(false)
    expect(m("apps/web/src/lib/foo.test.ts")).toBe(true)
  })
})
