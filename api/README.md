# @festivus/api

The Festivus data API. Express. Prisma. Postgres.

Read routes are public. Writes need a tier=`write` API key.

## What it does

Serves the Festivus dataset over HTTP. Robots, policies, datasets, benchmarks, tasks, papers, hardware, environments, compatibility edges. Full-text search. Row-count stats. Rate-limited by API key tier.

Production: `https://api.festivus.hapticlabs.ai`.

Full endpoint list: [`docs/public-api.md`](../docs/public-api.md).
Runtime topology: [`docs/infrastructure.md`](../docs/infrastructure.md).

## Run it locally

```bash
supabase start
pnpm dev
```

API listens on `:8000`. Health: `curl http://localhost:8000/health`. Postgres: `postgresql://postgres:postgres@localhost:54322/postgres`. Studio: `http://localhost:54323`.

Web app at `:3000` talks to it via `FESTIVUS_DATASET_API_URL=http://localhost:8000`.

## Layout

```
api/
  prisma/            Prisma schema + migrations. Baselined from the live DB.
  src/
    index.ts         Boot. Wires Prisma → repo → server → :8000.
    server.ts        Express app. Mounts routes + middleware.
    db/              Pool, migrate, seed, environments data.
    repo/            Data layer. prisma.ts is the real one; fixture.ts is for tests.
    routes/          One file per resource. `/v1/robots`, `/v1/policies`, etc.
    middleware/      api-key, rate-limit, request-log, require-write-tier.
    scripts/         smoke-local, enrich-robots.
```

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Watch mode. `tsx watch src/index.ts`. |
| `pnpm typecheck` | `tsc --noEmit`. |
| `pnpm lint` | `eslint src`. |
| `pnpm test` | `vitest run`. |
| `pnpm smoke` | Local smoke test against `:8000`. |
| `pnpm reset:robots` | Reset robots table from `data/robots_seed.json`. |
| `pnpm reset:compatibility-edges` | Reset compat edges from `data/compatibility_edges.json`. |
| `pnpm reset:laundry-compat-edges` | Reset laundry compat edges from `data/laundry_compat_edges.json`. |
| `pnpm sync:laundry-review` | Sync G1 laundry review JSON into Postgres. |
| `pnpm enrich` | LLM-enrich robot records. |

## Env vars

Local: `api/.env`. Production: Dokku config on the EC2 host.

| Var | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string. Required. |
| `PORT` | HTTP port. Default `8000`. |
| `ANTHROPIC_API_KEY` | Used by `enrich` script. Optional. |

No secrets in the repo. See [`docs/infrastructure.md`](../docs/infrastructure.md#environment-variable-scopes).

## Prisma workflow

Schema of record: `prisma/schema.prisma`. Baselined from the live DB — it reflects reality, not a greenfield design.

- Change the schema → `pnpm --filter @festivus/api exec prisma migrate dev --name <slug>`.
- Apply in prod → Dokku runs `prisma migrate deploy` on release.
- Regenerate the client → happens on `pnpm install` (postinstall hook).

No raw SQL in the repo layer. Prisma or nothing.

## Writes

`PUT | PATCH | DELETE /v1/write/:table/:slug`. Requires `X-API-Key` with `tier='write'`. Keys are issued manually — not self-serve. See [`src/routes/write.ts`](src/routes/write.ts).

## Deploy

Production runs on Dokku via [`Dockerfile.api`](../Dockerfile.api) at the repo root. Push to the Dokku remote, Dokku builds and swaps the container. TLS via Let's Encrypt, managed by Dokku.

Deploy + rollback runbook: [`docs/runbooks/api-deploy-rollback.md`](../docs/runbooks/api-deploy-rollback.md).

## Tests

- `vitest` under `src/**/*.test.ts`.
- Route tests use `FixtureRepo` — no DB needed.
- `prisma.parity.test.ts` runs the same assertions against `PrismaRepo` and `FixtureRepo` to catch drift.

Run them: `pnpm test`.
