# Festivus Public API

The Festivus data API is open. Anyone can curl it. Spec 016.

## Endpoint

```
https://festivus-data.hapticlabs.ai
```

## Rate limits

| Tier | Limit | How to use it |
|---|---|---|
| Anonymous | 50 requests per second per IP | No header, just curl. |
| Keyed | 500 requests per second per key | `X-API-Key: fek_<your key>` header. Create one at `https://festivus.hapticlabs.ai/settings/api-keys`. |

Limits are in-process per warm serverless instance. A cold start resets the bucket, and Vercel's serverless runtime fans incoming requests across multiple Lambda instances under load, so a well-behaved client sending under a hundred requests from one IP at once will normally see only 200s — the per-instance ceiling is not being hit. Aggressive clients hit one of two defenses:

- **Our rate-limit middleware** responds with HTTP 429 once a single Lambda instance's 50 rps (anon) or 500 rps (keyed) bucket is empty. Shape:
  ```
  HTTP/1.1 429 Too Many Requests
  {"error":"rate_limit","tier":"anon"}
  ```
- **Vercel's edge-level Attack Challenge** fires on heavier traffic patterns and returns HTTP 403 with a `x-vercel-mitigated: challenge` header. This is Vercel's own platform-level DDoS protection and is upstream of our function; we neither control it nor want to disable it.

In practice, a client that needs more headroom than the anon tier should get a key. A client that trips edge protection is doing something abusive and should not retry.

## Anonymous example

```
curl "https://festivus-data.hapticlabs.ai/v1/robots?limit=5"
```

## Keyed example

```
curl -H "X-API-Key: fek_abc123..." "https://festivus-data.hapticlabs.ai/v1/robots?limit=100"
```

## Get a key

Sign into `https://festivus.hapticlabs.ai` with any supported provider, then visit `https://festivus.hapticlabs.ai/settings/api-keys`. Click "Create key", give it a name, and **copy it immediately**. The plaintext is shown exactly once. If you lose it, revoke it from the same page and create a new one.

## Endpoints

| Path | Description |
|---|---|
| `/health` | `{"status":"ok"}` for monitors |
| `/v1/robots` | list robots, supports `limit`, `offset`, `q`, `sort` |
| `/v1/robots/:slug` | single robot by slug |
| `/v1/robots/:slug/full` | robot with compatible policies and datasets |
| `/v1/policies` | list policies |
| `/v1/policies/:slug` | single policy by slug |
| `/v1/datasets` | list datasets |
| `/v1/datasets/:slug` | single dataset by slug |
| `/v1/benchmarks` | list benchmarks |
| `/v1/deploy-notes` | list deploy notes |
| `/v1/environments` | list simulator environments |
| `/v1/stats` | row counts per domain |
| `/v1/search` | full-text search across all domains |

Every list endpoint returns an envelope:

```
{"count": 4378, "limit": 5, "offset": 0, "results": [ ... ]}
```

The `count` field is the total matching the filter, not the size of `results`.

## Wire format stability

Response shapes are frozen. They match the dataset schemas in `https://github.com/Haptic-AI/festivus/blob/main/packages/types/src/index.ts`. If a field you rely on changes, that is a bug — file an issue at `https://github.com/Haptic-AI/festivus/issues`.

## What this API is not

Not a write API. Everything is read-only. Contributions to the underlying dataset happen through pull requests at `https://github.com/Haptic-AI/festivus/pulls`, not through this endpoint.

Not a Physical AI inference API. You will not train a model or run a policy through this endpoint. It serves metadata about robots, policies, and datasets — the answer to "which policies are compatible with my hardware", not the policy weights themselves.

## Incident contact

Report outages at `https://github.com/Haptic-AI/festivus/issues`.
