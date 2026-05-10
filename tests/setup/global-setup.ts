/**
 * Vitest global setup: starts an isolated Next.js dev server on port 3001
 * so integration tests don't depend on the dev server at localhost:3000.
 *
 * Only runs when integration tests are included (persona-tests/).
 * Seed validation tests don't need a server and skip this entirely.
 */

import { spawn, type ChildProcess } from "node:child_process"
import { resolve } from "node:path"

const TEST_PORT = process.env["TEST_PORT"] ?? "3001"
const TEST_BASE_URL = `http://localhost:${TEST_PORT}`
const STARTUP_TIMEOUT_MS = 60_000
const POLL_INTERVAL_MS = 500

let serverProcess: ChildProcess | null = null

async function waitForServer(url: string, timeoutMs: number): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url)
      if (res.ok || res.status === 404) return // server is up
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
  }
  throw new Error(`Test server failed to start within ${timeoutMs}ms at ${url}`)
}

export async function setup(): Promise<void> {
  // Skip entirely when no integration tests are in the run (seed-validation / api-only).
  // Integration tests live under tests/persona-tests/ and are the only consumers of TEST_BASE_URL.
  const argv = process.argv.join(" ")
  if (!argv.includes("persona-tests")) return

  // Check if a server is already running on the test port
  try {
    const res = await fetch(TEST_BASE_URL)
    if (res.ok || res.status === 404) {
      // Server already running — use it (e.g., user started one manually)
      process.env["TEST_BASE_URL"] = TEST_BASE_URL
      return
    }
  } catch {
    // Not running — we need to start one
  }

  const webDir = resolve(__dirname, "../../apps/web")

  serverProcess = spawn("npx", ["next", "dev", "-p", TEST_PORT], {
    cwd: webDir,
    stdio: "pipe",
    env: { ...process.env, NODE_ENV: "development" },
    detached: false,
  })

  // Log server errors for debugging
  serverProcess.stderr?.on("data", (chunk: Buffer) => {
    const text = chunk.toString()
    // Only log actual errors, not noisy Next.js dev warnings
    if (text.includes("Error") || text.includes("error")) {
      process.stderr.write(`[test-server] ${text}`)
    }
  })

  serverProcess.on("error", (err) => {
    process.stderr.write(`[test-server] Failed to start: ${err.message}\n`)
  })

  process.env["TEST_BASE_URL"] = TEST_BASE_URL

  await waitForServer(TEST_BASE_URL, STARTUP_TIMEOUT_MS)
}

export async function teardown(): Promise<void> {
  if (serverProcess !== null && serverProcess.exitCode === null) {
    serverProcess.kill("SIGTERM")
    // Give it a moment to shut down gracefully
    await new Promise((r) => setTimeout(r, 1000))
    if (serverProcess.exitCode === null) {
      serverProcess.kill("SIGKILL")
    }
    serverProcess = null
  }
}
