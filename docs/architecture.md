# Architecture Decisions

## Monorepo with pnpm workspaces

Single repo, pnpm workspaces for package management. No Turborepo or Nx yet.
One developer, two packages. The overhead of a build orchestrator is not justified
until there are enough packages that build order and caching actually matter.

## Package structure

```
apps/
  web/       — Next.js 16 App Router frontend (the product)
packages/
  types/     — Shared TypeScript types for the robotics domain
```

Deployable apps live in `apps/`, shared libraries in `packages/`.
This follows the Turborepo convention so we can adopt it later if needed.

**apps/web**: All UI, pages, API routes, and static seed data live here.
This is the only deployable artifact for now.

**packages/types**: Domain types shared across packages: Policy, Robot, Hardware,
SimulationConfig, Benchmark, ActionSpace, ObservationSpace, etc. Imported by
apps/web directly via workspace protocol (`workspace:*`). No build step
needed if using TypeScript path references.

Types live in their own package so that when we add a backend service or CLI
tool later, they can import the same domain types without depending on the
web app.

## Hardcoded seed data + Upstash Redis

Robotics domain data (policies, robots, datasets, environments) is static
fixtures in apps/web. Pages import data directly from TypeScript files.

Workbench project state (canvas nodes, connections, messages, snapshots) is
persisted in Postgres via API routes. The storage layer uses an
`IProjectStore` interface with three implementations:
- `ApiProjectStore` -- signed-in users; calls `/api/workbench/*` routes which write directly to Postgres via Prisma, scoped to the Clerk-verified `user.id`
- `LocalProjectStore` -- offline/guest fallback, backed by localStorage
- `MemoryStore` -- test double, in-memory Map

The `apps/web` `/api/workbench/*` routes authenticate via Clerk JWT and forward to
the `api/` Express service (`GET/PUT/DELETE /v1/internal/workbench-projects[/:id]`),
which owns the Prisma write to the `workbench_projects` table.
The `useProjectPersistence` hook handles debounced auto-save and load-on-mount.

No moderator key is needed for normal saves — auth is scoped per Clerk user.

## Auth

Authentication uses Clerk behind an `IAuthProvider` abstraction:
- `ClerkAuthProvider` -- production, uses Clerk's `auth()` and `currentUser()`
- `DevAuthProvider` -- dev/OSS fallback, auto-authenticates as "dev-user"
- Factory: `getAuthProvider()` returns Clerk if `CLERK_SECRET_KEY` is set, Dev otherwise

Middleware protects `/workbench` and `/api/workbench` routes. Public pages
(homepage, explore, policies, contribute) are accessible without auth.

Env vars: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` (optional --
app works without them using DevAuthProvider)

## API routes

Next.js API routes handle server-side logic:
- `/api/agent` -- Claude Sonnet agent (SSE streaming)
- `/api/workbench/[projectId]` -- GET/PUT/DELETE project state (auth required)
- `/api/workbench` -- GET list of user's projects (auth required)

Everything runs as a single Next.js deployment on Vercel.

## HF Hub integration deferred

Festivus will eventually pull model and dataset metadata from the HF Hub API
and enrich it with robotics-native fields. For now we fake it with realistic
seed data that matches the shape of what HF Hub would return. This lets us
design the UI and type system without depending on an external API.

## Strict TypeScript everywhere

Both packages use strict mode with all the flags from the coding guide:
noUnusedLocals, noUnusedParameters, noUncheckedIndexedAccess,
verbatimModuleSyntax. No `any` types. Types are the contract between packages.

## Pages

Homepage (/) defined in spec 001. Two-column hero with entry cards
linking to /workbench. Workbench landing (/workbench) has
scenario-specific cards that create projects at /workbench/[project-id].

Mobile: sidebar becomes bottom sheet below 768px. Landing cards
become 2-column grid. React Flow handles pinch-zoom natively.
Three breakpoints: mobile <768px, tablet 768-1024px, desktop >1024px.

## Workbench

Landing page at /workbench shows 17 quick-start cards in 5 groups
(I Have a Task, I Have a Robot, I Have a Policy, Explore by
Capability, Advanced). Card click sends a natural language prompt
to the agent and starts a project.

### LLM integration (Claude API)

The workbench uses Claude Sonnet via the Anthropic SDK for its
agentic experience. Architecture:

- Single API route: /api/agent (POST, SSE streaming)
- One system prompt with 6 AI agent roles (Task Analyst, Hardware Scout,
  Policy Scout, Sim Engineer, Community Scout, Deploy Advisor) — Task Analyst speaks first on new goals
- Seed data (~50-80KB JSON) injected into context, not RAG
- Tool use for structured output (add_node, show_agent_message, ask_user, etc.)
  ask_user renders as clickable pill buttons in the sidebar. Used after
  every exploration lane to guide the user's next action.
- Multi-turn tool use loop: when the LLM returns tool calls
  (stop_reason: "tool_use"), the API sends back tool results
  and lets the LLM continue. Up to 8 turns per user message.
  This is critical — without it, the LLM only gets to make
  one set of tool calls before stopping.
- Guaranteed ask_user fallback: the API tracks whether ask_user
  was called during the response. If robot/policy/environment
  nodes were added but ask_user was never called, the API
  auto-injects a fallback ask_user before closing the stream.
  Tool results also nudge the LLM with reminders when
  exploration lanes are detected without ask_user.
- Frontend parses SSE events: "text" (rendered as agent message),
  "tool_call" (dispatched to canvas state), "done", "error"
- ~$0.02/turn, ~$0.40-0.60/session with prompt caching

Env var: ANTHROPIC_API_KEY

### Node cards and detail panels

Hardware cards, policy cards, and environment cards have distinct designs.
Only environment cards use dark backgrounds (#111). Hardware and policy
cards are white on the cream canvas.

Clicking a hardware or policy card expands it inline within the
exploration lane (180px → 360px). The sidebar conversation always stays
visible — nothing overlays it. State: expandedCardId in workbench-canvas.tsx.
Sim viewer is a separate page: apps/web/src/app/workbench/[projectId]/sim/[envId]/page.tsx

## Dual contributor model: humans and agents

Festivus is designed for two types of contributors: humans via
the web interface and agents via API/MCP. Both paths submit to
the same review pipeline and produce the same structured data.
Every endpoint that a human can use through the UI has a
corresponding API endpoint that an agent can call.

This is a core architectural decision, not a feature. The data
model, validation, and contribution pipeline are designed from
the start to handle both human-submitted forms and programmatic
API calls identically.

## Deployment

- Vercel for hosting. The apps/web Next.js app deploys to Vercel.
- Vercel Root Directory: `apps/web`
- Main branch auto-deploys to production.
- Preview deployments on every PR.
- Environment variables: ANTHROPIC_API_KEY, KV_REST_API_URL, KV_REST_API_TOKEN,
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY, POSTGRES_URL
  (see `apps/web/.env.example` for the full list and per-key notes)
- Domain: festivus.hapticlabs.ai

Note: run `vercel env pull` from inside `apps/web/` so it writes to
`apps/web/.env.local` (the workspace Next.js reads). Per spec 024, no
`.env*` files should exist at the repo root.

## Explicitly deferred

These are intentionally not built yet. Do not add them until there is a
concrete reason:

- **Separate read API** — `api/` (Express + Prisma) handles domain reads and workbench project writes. Next.js is a thin forwarder, not a direct DB writer for domain data.
- **API service** — no Express, no tRPC, no separate server.
- **HF Hub integration** — no API calls to huggingface.co.
- **Simulation runtime** — no MuJoCo, Isaac Sim, or PyBullet integration.
- **Turborepo / Nx** — no build orchestrator until we outgrow pnpm workspaces.
