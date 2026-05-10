-- Spec 026 Phase 2.1: rename simulations table to episodes + add Simulations parent.
--
-- Local dev only — spec open question #4 resolution: wipe existing spec-025
-- simulations rows rather than back-filling simulation_id for them. There is no
-- prod data for this table; it was only ever used in development.

TRUNCATE TABLE "simulations";

-- Rename the spec-025 `simulations` table (flat render log) to `episodes`.
ALTER TABLE "simulations" RENAME TO "episodes";
ALTER TABLE "episodes" RENAME CONSTRAINT "simulations_pkey" TO "episodes_pkey";
ALTER INDEX "idx_simulations_status" RENAME TO "idx_episodes_status";
ALTER INDEX "idx_simulations_created_at" RENAME TO "idx_episodes_created_at";
ALTER INDEX "idx_simulations_env_slug" RENAME TO "idx_episodes_env_slug";

-- Phase 2.1: new columns are nullable; Phase 3.3 tightens them to NOT NULL.
ALTER TABLE "episodes" ADD COLUMN "simulation_id" TEXT;
ALTER TABLE "episodes" ADD COLUMN "episode_index" INTEGER;

-- New parent Simulations table (spec 026 taxonomy).
CREATE TABLE "simulations" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "policy_slug" TEXT NOT NULL,
    "environment_slug" TEXT NOT NULL,
    "task_slug" TEXT,
    "robot_slug" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "simulations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "simulations_slug_key" ON "simulations"("slug");
CREATE INDEX "idx_simulations_policy_slug" ON "simulations"("policy_slug");
CREATE INDEX "idx_simulations_environment_slug" ON "simulations"("environment_slug");

-- FK from episodes to new simulations parent.
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_simulation_id_fkey"
    FOREIGN KEY ("simulation_id") REFERENCES "simulations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "idx_episodes_simulation_id" ON "episodes"("simulation_id");
