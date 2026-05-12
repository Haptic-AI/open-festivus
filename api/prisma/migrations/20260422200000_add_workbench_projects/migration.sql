-- Spec 028: Workbench project autosave
-- Moves workbench projects from Upstash Redis to Postgres.
-- One row per user × project; data JSONB holds the full IPersistedWorkbenchState.

CREATE TABLE "workbench_projects" (
    "id"         SERIAL PRIMARY KEY,
    "project_id" TEXT NOT NULL,
    "user_id"    TEXT NOT NULL,
    "name"       TEXT NOT NULL,
    "data"       JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "workbench_projects_project_id_user_id_key" UNIQUE ("project_id", "user_id")
);

CREATE INDEX "idx_workbench_projects_user_updated"
    ON "workbench_projects" ("user_id", "updated_at" DESC);
