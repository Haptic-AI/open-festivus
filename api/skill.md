---
name: festivus-data-api
description: Public HTTP API for the Festivus Physical AI corpus — robots, policies, datasets, benchmarks, environments, tasks, papers, and compatibility edges.
---

# Festivus Data API — skill

What this service can DO for an agent. For HTTP shape, see [`docs/public-api.md`](../docs/public-api.md).

## Use this when

- You need facts about a real-world robot, policy, dataset, benchmark, environment, task, or research paper in Physical AI.
- You need to answer "what policies run on this robot?", "what datasets train this policy?", "which sim environments cover this task?".
- You're an agent assembling a hardware + software stack and need to check compatibility before recommending it.
- You want stats on the corpus (row counts, coverage gaps).

## Don't use this when

- You need real-time telemetry from a running robot. This is a static curated corpus, not a fleet endpoint.
- You need to push new records. Reads are public; writes need an issued `tier=write` API key. Contributions go through the in-app `/contribute` flow, not direct writes.
- You need vector search or embeddings. Search is full-text (Postgres `to_tsvector`), not semantic.

## Required inputs

- **Base URL** — `https://api.festivus.hapticlabs.ai` for production, `http://localhost:8000` for local dev.
- **A resource and (optionally) a slug** — `robots`, `policies`, `datasets`, `benchmarks`, `environments`, `tasks`, `papers`, `deploy-notes`, `stats`, `health`. Detail routes need a `slug` (or `id` for papers).
- **An API key (`X-API-Key: fek_<key>`)** — only required if you exceed the 50 req/s anonymous tier or need write access. Get one at `https://festivus.hapticlabs.ai/settings/api-keys`.
- **Optional query params** — `limit` (max 500), `offset`, `q` (full-text search), `sort` (e.g. `-updated_at`).

## What you can ask it

| Capability | How |
|---|---|
| List robots | `GET /v1/robots?limit=50&q=humanoid&sort=-popularity` |
| Get one robot with compatible policies and datasets | `GET /v1/robots/<slug>/full` |
| List policies, datasets, benchmarks, environments, tasks, papers, deploy notes | `GET /v1/<resource>` |
| Look up by slug | `GET /v1/<resource>/<slug>` |
| Search across the corpus | `?q=<term>` on any list endpoint |
| Row counts per domain | `GET /v1/stats` |
| Health check | `GET /health` |

## Auth and limits

- **Anonymous**: no header, 50 req/s per IP. Fine for ad-hoc agent lookups.
- **Keyed**: `X-API-Key: fek_<key>` header, 500 req/s per key. Get one at `https://festivus.hapticlabs.ai/settings/api-keys`.
- Heavy bursts can trip Vercel's edge protection (HTTP 403, header `x-vercel-mitigated: challenge`). Back off; do not retry.
- Rate limit response is HTTP 429 with `{"error":"rate_limit","tier":"anon"|"keyed"}`. Respect it.

## Response shape

Every list endpoint:

```json
{ "count": <int>, "results": [ { "slug": "...", "...": "..." }, ... ] }
```

`limit` is server-capped at 500. Paginate with `offset`. `slug` is the stable id.

## Examples an agent will actually run

```
curl https://api.festivus.hapticlabs.ai/v1/stats
curl 'https://api.festivus.hapticlabs.ai/v1/robots?q=so-100&limit=5'
curl https://api.festivus.hapticlabs.ai/v1/robots/aloha/full
curl 'https://api.festivus.hapticlabs.ai/v1/datasets?sort=-updated_at&limit=20'
```

Detailed contracts and error shapes: [`docs/public-api.md`](../docs/public-api.md).
