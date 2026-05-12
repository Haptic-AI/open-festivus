-- Migration: provision the OpenClaw developer write-tier API key.
--
-- Spec: specs/021-laundry-folding-compat-dataset.md (CRUD push path).
--
-- Only the sha256 HASH of the plaintext key is stored in the database.
-- The plaintext (prefix `ocp_`) is shared with the developer out of band and
-- passed via the `x-api-key` header. The hash here is the authoritative
-- lookup value — if the plaintext ever needs to be rotated, update BOTH
-- the hash in this migration (or a new migration) AND the shared secret.
--
-- The idempotent ON CONFLICT clause lets this migration re-apply cleanly
-- without duplicating the row.

INSERT INTO "api_keys" (user_id, key_hash, name, tier, created_at)
VALUES (
  'openclaw-dev',
  'a2b4f354d063bffa08826f22b68a24b28c16b4b10cc0e6cca1bdc875bbddc50a',
  'openclaw-dev push key',
  'write',
  now()
)
ON CONFLICT (key_hash) DO UPDATE
  SET tier = EXCLUDED.tier,
      name = EXCLUDED.name,
      user_id = EXCLUDED.user_id,
      revoked_at = NULL;
