-- Spec 026 Phase 3.3: enforce invariant I1 — every Episode has a non-null
-- parent Simulation. After Phase 3.2 the creation flow always populates
-- simulation_id + episode_index, so the only orphan rows are leftover from
-- pre-3.2 testing of the flat /api/episodes proxy. Local-dev cleanup is the
-- pragmatic move; spec open question #4's "wipe local rows" precedent applies.

DELETE FROM "episodes" WHERE "simulation_id" IS NULL;

ALTER TABLE "episodes" ALTER COLUMN "simulation_id" SET NOT NULL;
ALTER TABLE "episodes" ALTER COLUMN "episode_index" SET NOT NULL;
