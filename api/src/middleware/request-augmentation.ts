import type { Tier } from "./token-bucket.js"

declare global {
  namespace Express {
    interface Request {
      tier?: Tier
      apiKeyId?: number
      // The `tier` column on the `api_keys` row that authenticated this
      // request. "write" tier unlocks the CRUD endpoints added for spec 021.
      apiKeyTier?: string
      // user_id from the api_keys row. Used by spec 027 rate limiting to
      // count writes per user, not per key — so minting 5 keys doesn't
      // multiply the ceiling.
      apiKeyUserId?: string
      // owner_email snapshotted at mint time. Populated by apiKeyMiddleware
      // and used by write.ts to stamp mutation.actor_email and to address
      // submitter notifications.
      apiKeyOwnerEmail?: string | null
      // FK to users.id on the api_keys row that authenticated this request
      // (spec 029). Populated by apiKeyMiddleware. Used by write.ts to stamp
      // mutation.author_id for CLI-originated writes (the chat path uses
      // req.user.id directly).
      apiKeyOwnerId?: string | null
      // userId from a verified Clerk session JWT. Set by requireClerkAuth().
      // Used by user-owned routes (e.g. workbench-projects) — distinct from
      // api-key auth, which covers platform/editorial data.
      clerkUserId?: string
      // Canonical internal user row for the authenticated caller (spec 029).
      // Set by requireClerkAuth() after upsert-on-first-sight against
      // `users.clerk_user_id`. Consumers that stamp attribution FKs
      // (mutations.author_id, api_keys.owner_id) read `user.id` from here.
      user?: {
        id: string
        clerk_user_id: string
        email: string | null
      }
    }
  }
}

export {}
