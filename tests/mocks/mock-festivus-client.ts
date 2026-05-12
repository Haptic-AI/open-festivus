/**
 * Test convenience re-export of MockFestivusClient.
 *
 * The mock implementation lives under apps/web/src/lib/api/ so the agent
 * route can import it directly without crossing the tests/ boundary
 * (Next.js refuses to bundle tests/). This file just gives test code a
 * stable path to import from.
 *
 * Reference: docs/exec-plans/active/2026-04-12-agentic-robotics-platform.md,
 * Step 3.5 — file manifest lists this path explicitly.
 */

export {
  MockFestivusClient,
  MOCK_DATASETS,
  MOCK_DEPLOY_NOTES,
  MOCK_EDGES,
  MOCK_ENVIRONMENTS,
  MOCK_POLICIES,
  MOCK_ROBOTS,
  MOCK_TASKS,
} from "@/lib/api/mock-festivus-client"
