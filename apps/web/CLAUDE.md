# @festivus/web

Next.js app. Dev server: `pnpm dev` (port 3000).

## Key directories

- `src/app/api/agent/` -- LLM agent endpoint (Claude API, SSE streaming, tool calls)
- `src/app/api/workbench/` -- project persistence CRUD (forwards to api/ via Clerk JWT)
- `src/app/workbench/` -- workbench canvas (React Flow, 6 specialist agents)
- `src/lib/auth/` -- auth abstraction (`IAuthProvider` with Clerk and Dev implementations)
- `src/lib/workbench/store/` -- persistence layer (`IProjectStore` with Api, localStorage, memory implementations)
- `src/lib/workbench/hooks/` -- `useProjectPersistence` (debounced auto-save/load)
- `src/lib/agent/` -- system prompt, tool definitions, seed data loader
- `src/components/` -- shared components (SiteHeader, etc.)
- `src/data/seed/` -- seed JSON files (robots, policies, environments, datasets)

## Architecture patterns

### Auth

`getRequestUser()` from `src/lib/auth` is the single entry point for all API routes.
Returns `IUser | null`. Behind `IAuthProvider` interface -- Clerk in production,
DevAuthProvider (auto-authenticated) when Clerk env vars are absent. See spec 011
for guest vs signed-in behavior.

> [!IMPORTANT]
> **Production REQUIRES `CLERK_SECRET_KEY` and `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
> on the `festivus` Vercel project.** Without them, `middleware.ts` falls back to
> a noop, `getAuthProvider()` returns `DevAuthProvider`, and **every request is
> silently authenticated as a fixed `dev-user`** -- collapsing all access control
> across every route. Found the hard way during spec 016 cutover when the new
> `/api/api-keys` routes shipped to a Clerk-less prod and became wide-open key
> minting endpoints. Before shipping any new auth-gated route to apps/web, run
> `vercel env ls production --cwd <festivus-link-dir> | grep CLERK_SECRET_KEY` and
> halt if missing.
>
> **Rotation is also load-bearing.** Rotating the secret in Clerk Dashboard
> without updating Vercel silently breaks every signed-in user with no
> thrown error -- `auth()` returns `userId: null`, `__session` JWT can't
> refresh, `/api/api-keys` 401s. The first probe on any "signed-in user
> can't do X" report is `vercel logs --query api-keys` looking for
> `secret-key-invalid`. Full procedure:
> [`docs/runbooks/clerk-secret-rotation.md`](../../docs/runbooks/clerk-secret-rotation.md).

### Persistence

All project storage goes through `IProjectStore` interface (defined in `@festivus/types`).
Signed-in users: `ApiProjectStore` calls `apps/web`'s own `/api/workbench/*` routes, which
forward to the Express api/ via Clerk JWT (or `X-Dev-User-Id` in dev). Guest/offline:
`LocalProjectStore` (localStorage). Tests: `MemoryStore`.
Zod schemas in `src/lib/workbench/store/schemas.ts` validate data at every load boundary.

### API routes

- Validate input with Zod at the boundary
- Return `NextResponse.json()` with appropriate status codes
- Check auth with `getRequestUser()` -- return 401 if null
- Workbench routes (`/api/workbench/*`) forward to `api/` via `workbench-api-client.ts` with Clerk JWT auth

### Workbench canvas

`workbench-canvas.tsx` is the main component (~2000 lines). All canvas state
(nodes, connections, messages, snapshots, tray) lives in React `useState`. The
`useProjectPersistence` hook auto-saves state changes via the active store.
Types (`ICanvasNode`, `IConnection`, etc.) come from `@festivus/types`.

### LLM integration

Single `/api/agent` route. Streams SSE events. 7 tool calls (`add_node`,
`update_node`, `connect_nodes`, `show_agent_message`, `set_canvas_status`,
`ask_user`, `update_recipe`). Seed data (~50-80KB) injected into system prompt
on every request. Model: `claude-sonnet-4-20250514`.
