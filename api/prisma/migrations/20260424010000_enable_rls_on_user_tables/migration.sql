-- Enable RLS on tables that hold user-scoped data and audit history.
-- Without RLS, these tables are reachable via PostgREST + the public anon
-- key, leaking Clerk user ids, emails, edit history, and per-user
-- workbench state. Prisma connects as `postgres` (BYPASSRLS), so the
-- Express API is unaffected. No policies are added, matching the existing
-- pattern on the other 13 public tables: anon and authenticated roles see
-- nothing because no policy permits access.

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workbench_projects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mutations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "simulations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "episodes" ENABLE ROW LEVEL SECURITY;
