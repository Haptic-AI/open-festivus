# Agent instructions

Entry point for AI coding agents (Claude Code, Cursor, Cline, Copilot, etc.) working on the Festivus monorepo. Humans should start with [`README.md`](README.md).

## What this repo is

Festivus is an open-source Physical AI platform. Three runnable surfaces over a typed dataset:

- `apps/web/` — Next.js 15 app (port 3000). Browses the corpus, edits records, hosts the in-app workbench agent.
- `api/` — Express + Prisma + Postgres (port 8000). Serves the dataset over HTTP. Production: `https://api.festivus.hapticlabs.ai`.
- `data/` — JSON seed files. Source of truth for the dataset until written to Postgres.
- `packages/types/` — shared TypeScript interfaces (`@festivus/types`).
- `packages/scrape/` — scrapers used to enrich the dataset.

## Bootstrapping

```bash
pnpm install
cp .env.example .env.local
cp api/.env.example api/.env.local
cp apps/web/.env.example apps/web/.env.local
supabase start
pnpm dev
```

Web on `:3000`, API on `:8000`, Supabase Studio on `:54323`. The defaults in `.env.example` work for the local stack — no secrets needed for read paths.

Prerequisites: Node 20.x, pnpm, Supabase CLI, Docker.

## Common tasks

| Task | Command |
|---|---|
| Run everything | `pnpm dev` |
| Type-check | `pnpm typecheck` |
| Lint | `pnpm lint` |
| Test (vitest) | `pnpm test` |
| Reset DB from seeds | `pnpm --filter @festivus/api reset:robots` |
| Smoke API locally | `pnpm --filter @festivus/api smoke` |

Run these before claiming a change is done. CI runs the same set.

## Where to make changes

- **Code** — open a GitHub PR. Every commit needs a DCO sign-off (`git commit -s`). See [`CONTRIBUTING.md`](CONTRIBUTING.md).
- **Dataset records** — NOT a PR. Use the in-app `/contribute` flow on the live site. The model is "code is open, data is curated."
- **API endpoints** — `api/src/routes/<resource>.ts`, one file per resource. Validate at the boundary, return JSON, document in `docs/public-api.md`.
- **Web pages** — `apps/web/src/app/<route>/page.tsx` (App Router).
- **Schema changes** — `api/prisma/schema.prisma`, then `pnpm --filter @festivus/api exec prisma migrate dev --name <slug>`.

## Conventions you must follow

- TypeScript only. No new Python, no new Go, no new runtimes.
- Validate external input with Zod at the boundary, then trust the typed value.
- Auth in `apps/web` goes through `getRequestUser()` from `src/lib/auth`. Never call Clerk directly from a route.
- Persistence in `apps/web` goes through `IProjectStore`. Never touch localStorage or the API directly from a component.
- API routes use Prisma via the `repo/` layer. No raw SQL.
- Tests live next to the code (`*.test.ts`). Route tests use `FixtureRepo`, not a real DB.
- Follow [`docs/coding-guide.md`](docs/coding-guide.md) for naming, comments, and error handling.

## What NOT to do

- Don't commit secrets. `.env.local` is gitignored — keep it that way.
- Don't bypass `IProjectStore` or `getRequestUser()` to "save a file" or "skip auth in dev." DevAuthProvider already covers the no-Clerk path.
- Don't add a separate Python service or message bus. Architecture decisions are documented in [`docs/architecture.md`](docs/architecture.md); revisit them via PR discussion, not code.
- Don't edit dataset JSON in `data/` to fix a record. Use the in-app `/contribute` flow so the change goes through curation.
- Don't skip the DCO sign-off. CI rejects unsigned commits.

## Per-package agent notes

Sub-packages have their own `CLAUDE.md` with package-specific guidance — read the one that matches what you're touching:

- [`apps/web/CLAUDE.md`](apps/web/CLAUDE.md) — auth, persistence, workbench canvas, LLM integration.
- [`packages/types/CLAUDE.md`](packages/types/CLAUDE.md) — shared type conventions.
- [`packages/scrape/CLAUDE.md`](packages/scrape/CLAUDE.md) — scraper patterns.

## Capability descriptions (skill.md)

If you want to know what a service *does* rather than how its routes are shaped, read the `skill.md` for that surface:

- [`api/skill.md`](api/skill.md) — what the public data API can answer.
- [`apps/web/skill.md`](apps/web/skill.md) — what the web app and workbench agent can do.

## Further reading

- [`README.md`](README.md) — quickstart and surface map.
- [`docs/architecture.md`](docs/architecture.md) — system design.
- [`docs/public-api.md`](docs/public-api.md) — full API surface, rate limits, auth.
- [`docs/agentic-first.md`](docs/agentic-first.md) — the design principle behind the platform.
- [`docs/coding-guide.md`](docs/coding-guide.md) — code style.
- [`docs/testing.md`](docs/testing.md) — test strategy.
- [`docs/observability.md`](docs/observability.md) — what we track.
- [`SECURITY.md`](SECURITY.md) — vulnerability disclosure.
