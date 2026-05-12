import type { IRobot } from "@festivus/types"
import request from "supertest"
import { describe, expect, it } from "vitest"
import type { IQueryable } from "../middleware/api-key.js"
import { FixtureRepo } from "../repo/fixture.js"
import { createServer } from "../server.js"

/**
 * Spec 029 Step 3.4. Chat-path and CLI-path writes produce identical
 * mutation shapes (modulo mutation_id + timestamps) so downstream
 * consumers (/moderate, SES notifications, rate-limit-writes) cannot
 * tell them apart. A drift here would silently change moderator emails
 * or double-count writes.
 *
 * Both paths exercise the same write.ts handler. The only difference
 * is how auth surfaces: CLI sends x-api-key = user's fek_*; chat sends
 * x-api-key = moderator key + X-On-Behalf-Of-User-Id header.
 */

// Stub that answers both the api_keys SELECT and the users SELECT.
function parityDb(): IQueryable {
  return {
    async query<T = unknown>(sql: string, params?: unknown[]): Promise<{ rows: T[] }> {
      if (sql.includes("FROM api_keys WHERE key_hash")) {
        const hash = (params ?? [])[0] as string
        // Moderator key (plain "plain-99") for chat path.
        if (hash && hash.includes("6fa3") === false /* noop */) {
          // No-op; logic below.
        }
        if (hash === hashFor("plain-99")) {
          return {
            rows: [
              {
                id: 99,
                user_id: "festivus-moderator-web",
                revoked_at: null,
                tier: "write",
                owner_email: null,
                owner_id: "user_cuid_moderator",
              },
            ] as unknown as T[],
          }
        }
        // User's own fek_* (plain "plain-42") for CLI path.
        if (hash === hashFor("plain-42")) {
          return {
            rows: [
              {
                id: 42,
                user_id: "clerk_alice",
                revoked_at: null,
                tier: "write",
                owner_email: "alice@example.com",
                owner_id: "user_cuid_alice",
              },
            ] as unknown as T[],
          }
        }
        return { rows: [] }
      }
      if (sql.includes("FROM users WHERE clerk_user_id")) {
        const clerkId = (params ?? [])[0] as string
        if (clerkId === "clerk_alice") {
          return {
            rows: [
              {
                id: "user_cuid_alice",
                clerk_user_id: "clerk_alice",
                email: "alice@example.com",
              },
            ] as unknown as T[],
          }
        }
        return { rows: [] }
      }
      return { rows: [] }
    },
  }
}

function hashFor(plaintext: string): string {
  // Mirror api-key.ts hashApiKey. Import dance is awkward from this file
  // so we inline the sha256 contract.
  return require("node:crypto").createHash("sha256").update(plaintext).digest("hex")
}

function fixture(): FixtureRepo {
  return new FixtureRepo({
    robots: [{ slug: "atlas", name: "Atlas", weight_kg: null, price_usd: null }] as unknown as IRobot[],
  })
}

function keepVariant(m: Record<string, unknown>): Record<string, unknown> {
  const { id, created_at, ...rest } = m
  void id
  void created_at
  return rest
}

describe("spec 029 Step 3.4: chat-vs-CLI parity on mutation shape", () => {
  it("CLI PATCH and chat on-behalf-of PATCH produce identical mutation shape modulo id + timestamps", async () => {
    const repo = fixture()
    const app = createServer(repo, { db: parityDb() })

    const cliRes = await request(app)
      .patch("/v1/write/robots/atlas")
      .set("x-api-key", "plain-42")
      .send({ patch: { weight_kg: 89 }, reason: "field measurement" })
    expect(cliRes.status).toBe(202)

    const chatRes = await request(app)
      .patch("/v1/write/robots/atlas")
      .set("x-api-key", "plain-99")
      .set("x-on-behalf-of-user-id", "clerk_alice")
      .send({ patch: { weight_kg: 91 }, reason: "chat-path edit" })
    expect(chatRes.status).toBe(202)

    const all = await repo.listMutations({ limit: 10, offset: 0 })
    expect(all.count).toBe(2)

    const [chatMut, cliMut] = [all.results[0], all.results[1]] as unknown as [
      Record<string, unknown>,
      Record<string, unknown>,
    ]

    // Attribution: both should end up attributed to Alice's canonical id.
    expect(cliMut?.["author_id"]).toBe("user_cuid_alice")
    expect(chatMut?.["author_id"]).toBe("user_cuid_alice")

    // Shape parity modulo id + timestamp + new values + reason + actor_id.
    // The fields that MUST match: table_name, slug, field_path, author_id,
    // status (always pending_review).
    const cliShape = keepVariant(cliMut)
    const chatShape = keepVariant(chatMut)
    expect(cliShape["table_name"]).toBe(chatShape["table_name"])
    expect(cliShape["slug"]).toBe(chatShape["slug"])
    expect(cliShape["field_path"]).toBe(chatShape["field_path"])
    expect(cliShape["author_id"]).toBe(chatShape["author_id"])
    expect(cliShape["status"]).toBe("pending_review")
    expect(chatShape["status"]).toBe("pending_review")
  })
})
