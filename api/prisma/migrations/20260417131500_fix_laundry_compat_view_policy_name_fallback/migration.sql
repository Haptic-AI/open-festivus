-- Migration: fallback to edge's own policy_name when the policy slug is
-- not present in the `policies` table (e.g. docs/recipe references like
-- `lerobot-act`, `lerobot-diffusion-policy`, `nvidia-gr00t-n15-3b`).
--
-- Spec: specs/021-laundry-folding-compat-dataset.md
-- Issue caught during Phase 4 smoke: 3 of 9 G1 edges had null policy_name
-- in the view because the JOIN on policies.slug came up empty.

CREATE OR REPLACE VIEW "v_laundry_compat" AS
SELECT
    e.id AS edge_id,
    e.slug AS edge_slug,
    e.data->>'robot_slug' AS robot_slug,
    r.data->>'name' AS robot_name,
    r.data->>'manufacturer' AS robot_manufacturer,
    e.data->>'policy_slug' AS policy_slug,
    COALESCE(p.data->>'name', e.data->>'policy_name') AS policy_name,
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
