-- Spec 027 phase 1: scoped Postgres roles.
--
-- Run ONCE per environment as the DB superuser (postgres). The Prisma
-- migration engine already runs as the owner of the schema and does NOT
-- need either of these roles; these exist so app connections stop using
-- the superuser string.
--
-- Expected flow:
--   1. DBA: supabase studio SQL editor → paste + run this file, setting
--      the <set-here> passwords to random values.
--   2. DBA: store the two plaintext passwords in 1Password as
--      `festivus_api_db_password` and `festivus_web_db_password`.
--   3. Ops: update each app's POSTGRES_URL to use the new role+password:
--          apps/web: postgres://festivus_web:<pw>@host:5432/postgres
--          api/:     postgres://festivus_api:<pw>@host:5432/postgres
--   4. Ops: deploy both apps. Verify curl-smoke tests still pass.
--
-- Rollback: connect as postgres, drop the roles, revert POSTGRES_URL.
-- Prisma migrations are unaffected (they run as postgres / owner).

-- ─── Role: festivus_api ──────────────────────────────────────────────
-- The Express API connects as this. Reads every domain table, writes to
-- every domain table (PATCH handler + moderator approvals), reads api_keys
-- (tier check), writes to mutations (queue + review). Nothing else.

CREATE ROLE festivus_api WITH LOGIN PASSWORD '<set-here>';

GRANT CONNECT ON DATABASE postgres TO festivus_api;
GRANT USAGE ON SCHEMA public TO festivus_api;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  robots, policies, datasets, benchmarks, deploy_notes, environments,
  tasks, papers, hardware, compatibility_edges, laundry_compat_edges
TO festivus_api;

GRANT SELECT ON api_keys TO festivus_api;
GRANT UPDATE (last_used_at) ON api_keys TO festivus_api;
GRANT SELECT, INSERT, UPDATE ON mutations TO festivus_api;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO festivus_api;

-- ─── Role: festivus_web ──────────────────────────────────────────────
-- apps/web connects as this. Reads + writes api_keys (mint/revoke/list).
-- Updates mutations for the cascade on revoke. Does NOT touch domain
-- tables — /moderate proxies those writes to the API with a write-tier
-- key. If this role ever gets domain-table writes, phase 2 (pending-by-
-- default) is bypassed.

CREATE ROLE festivus_web WITH LOGIN PASSWORD '<set-here>';

GRANT CONNECT ON DATABASE postgres TO festivus_web;
GRANT USAGE ON SCHEMA public TO festivus_web;

GRANT SELECT, INSERT, UPDATE ON api_keys TO festivus_web;
GRANT SELECT, UPDATE ON mutations TO festivus_web;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO festivus_web;

-- ─── Sanity: anon and authenticated stay locked out of writes ───────
-- PostgREST exposes the `anon` and `authenticated` roles. RLS is on
-- everywhere, but belt+suspenders: explicit REVOKE so a future RLS
-- misconfigure can't suddenly leak write access.

REVOKE INSERT, UPDATE, DELETE ON
  robots, policies, datasets, benchmarks, deploy_notes, environments,
  tasks, papers, hardware, compatibility_edges, laundry_compat_edges
FROM anon, authenticated;

REVOKE INSERT, UPDATE, DELETE ON api_keys, mutations FROM anon, authenticated;
