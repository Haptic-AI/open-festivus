---
name: festivus-web
description: Browse the Festivus Physical AI corpus, drive the workbench agent, and link to canonical record URLs on festivus.hapticlabs.ai.
---

# Festivus Web App — skill

What the web surface (`festivus.hapticlabs.ai`) can DO for an agent. For app architecture, see [`CLAUDE.md`](CLAUDE.md).

## Use this when

- You want a human-browseable view of the corpus (robots, policies, datasets, benchmarks, environments, tasks, papers, deploys).
- You want to drive the **workbench agent** — a multi-specialist canvas that assembles a Physical AI recipe (robot + policy + dataset + sim env) by chatting in natural language.
- You want to surface a structured contribution flow (`/contribute`) so a human can correct or extend the dataset.
- You want canonical, indexable URLs for each record (these match the slugs in the data API).

## Don't use this when

- You're a script that needs raw data. Hit the API instead: `https://api.festivus.hapticlabs.ai`. The web app is a renderer, not a data source.
- You're trying to write data programmatically. The `/contribute` flow is human-mediated and curated.
- You want to embed the workbench in another product. There's no embed surface; deep-link to `/workbench` instead.

## Required inputs

To use this skill effectively, an agent needs:

- **A record slug or search term** — for direct lookups (`<slug>` matches the API). Optional for browse routes like `/explore` or `/data/gaps`.
- **A signed-in session** — only required for the `/contribute` flow, `/settings/api-keys`, and cross-device workbench sync. Anonymous browsing covers everything else.
- **No API key** — the web surface is read-public. Programmatic data fetching should hit `https://api.festivus.hapticlabs.ai` directly; see [`api/skill.md`](../../api/skill.md) for keyed access.

## Capabilities

| Capability | URL |
|---|---|
| Browse corpus | `https://festivus.hapticlabs.ai/explore` |
| Robot detail | `https://festivus.hapticlabs.ai/data/robots/<slug>` |
| Policy detail | `https://festivus.hapticlabs.ai/data/policies/<slug>` (also `/policies/<slug>` for featured) |
| Dataset detail | `https://festivus.hapticlabs.ai/data/datasets/<slug>` |
| Benchmark detail | `https://festivus.hapticlabs.ai/data/benchmarks/<slug>` |
| Environment detail | `https://festivus.hapticlabs.ai/data/environments/<slug>` |
| Task detail | `https://festivus.hapticlabs.ai/data/tasks/<slug>` |
| Paper detail | `https://festivus.hapticlabs.ai/data/papers/<id>` |
| Deploy note | `https://festivus.hapticlabs.ai/data/deploys/<slug>` |
| Coverage gaps | `https://festivus.hapticlabs.ai/data/gaps` |
| Workbench (agent canvas) | `https://festivus.hapticlabs.ai/workbench` |
| Contribute a record | `https://festivus.hapticlabs.ai/contribute` |
| API key management | `https://festivus.hapticlabs.ai/settings/api-keys` |
| Sitemap | `https://festivus.hapticlabs.ai/sitemap.xml` |
| Agent index | `https://festivus.hapticlabs.ai/llms.txt` |

## Workbench agent

`/workbench` is a React Flow canvas with 6 specialist agents (driven by Claude Sonnet) that compose a stack from the corpus. It can `add_node`, `update_node`, `connect_nodes`, `show_agent_message`, `set_canvas_status`, `ask_user`, `update_recipe`. Persistence is auto-saved; signed-in users sync across devices, guests get localStorage. See [`CLAUDE.md`](CLAUDE.md) for the route topology and tool list.

## Auth

Public read: no auth. Editing records, creating API keys, saving workbench projects across devices: sign in via Clerk on the live site. Local dev uses `DevAuthProvider` (auto-authenticated as `dev-user`) when Clerk env vars are absent.

## What an agent should do first

1. Read [`https://festivus.hapticlabs.ai/llms.txt`](https://festivus.hapticlabs.ai/llms.txt) for the link map.
2. For data lookups, hit the API directly — it's faster and rate limits are documented.
3. For human-facing references in your output (citations, "see this robot"), link to the canonical web URLs above.
