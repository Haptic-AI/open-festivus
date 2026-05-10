-- Migration: add laundry_compat_edges table + v_laundry_compat view
-- Spec: specs/021-laundry-folding-compat-dataset.md
-- Created: 2026-04-17
--
-- WHY: new dedicated table for (robot × policy × task=fold-laundry) edges,
-- separate from the task-agnostic `compatibility_edges` table.
-- The view `v_laundry_compat` joins robots + policies + edges for Navicat browsing.

-- CreateTable
CREATE TABLE "laundry_compat_edges" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "search_text" tsvector GENERATED ALWAYS AS (to_tsvector('english'::regconfig, ((((((((((COALESCE((data ->> 'policy_name'::text), ''::text) || ' '::text) || COALESCE((data ->> 'notes'::text), ''::text)) || ' '::text) || COALESCE((data ->> 'robot_slug'::text), ''::text)) || ' '::text) || COALESCE((data ->> 'policy_slug'::text), ''::text)) || ' '::text) || COALESCE((data ->> 'task_slug'::text), ''::text)) || ' '::text) || COALESCE((data ->> 'slug'::text), ''::text)))) STORED,

    CONSTRAINT "laundry_compat_edges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "laundry_compat_edges_slug_key" ON "laundry_compat_edges"("slug");

-- CreateIndex (GIN on JSONB for fast containment queries)
CREATE INDEX "idx_laundry_compat_edges_data" ON "laundry_compat_edges" USING GIN ("data");

-- CreateIndex (GIN on tsvector for full-text search)
CREATE INDEX "idx_laundry_compat_edges_search" ON "laundry_compat_edges" USING GIN ("search_text");

-- CreateView: flat-column view of edges joined with robots + policies for Navicat
CREATE OR REPLACE VIEW "v_laundry_compat" AS
SELECT
    e.id AS edge_id,
    e.slug AS edge_slug,
    e.data->>'robot_slug' AS robot_slug,
    r.data->>'name' AS robot_name,
    r.data->>'manufacturer' AS robot_manufacturer,
    e.data->>'policy_slug' AS policy_slug,
    p.data->>'name' AS policy_name,
    e.data->>'policy_hf_url' AS policy_hf_url,
    e.data->>'task_slug' AS task_slug,
    (e.data->>'tier')::int AS tier,
    e.data->>'status' AS status,
    e.data->>'environment' AS environment,
    (e.data->>'simulator_first')::boolean AS simulator_first,
    e.data->>'evidence_type' AS evidence_type,
    e.data->>'evidence_url' AS evidence_url,
    e.data->>'policy_license' AS policy_license,
    e.data->>'license_short' AS license_short,
    e.data->>'confidence' AS confidence,
    e.data->>'notes' AS notes,
    e.data->>'sourced_at' AS sourced_at
FROM "laundry_compat_edges" e
LEFT JOIN "robots" r ON r.slug = e.data->>'robot_slug'
LEFT JOIN "policies" p ON p.slug = e.data->>'policy_slug';
