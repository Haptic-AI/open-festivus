# Festivus

Open source Physical AI platform by Haptic. A curated dataset of robots,
policies, environments, datasets, and benchmarks plus the tooling to
explore, contribute to, and deploy them.

## 🎯 What this is

A monorepo with three runnable surfaces and a typed dataset:

- `apps/web`: Next.js app for browsing the corpus and editing records.
- `api/`: Express API serving the dataset over HTTP.
- `data/`: JSON seed files: robots, policies, datasets, papers,
  benchmarks, environments, tasks, simulations, compatibility edges,
  deploy notes. See `data/PROVENANCE.md` for upstream sources.
- `packages/types`: shared TypeScript interfaces.

If you build agents that touch the physical world, this is a base layer
to point them at.

## ⚡ Quickstart

Prerequisites: Node 20.x, [pnpm](https://pnpm.io/), the
[Supabase CLI](https://supabase.com/docs/guides/local-development), and
Docker (Supabase boots a local Postgres in a container).

```bash
git clone https://github.com/Haptic-AI/open-festivus.git
cd open-festivus
pnpm install
cp .env.example .env.local
cp api/.env.example api/.env.local
cp apps/web/.env.example apps/web/.env.local
supabase start
pnpm dev
```

Web on `:3000`, API on `:8000`, Supabase Studio on `:54323`. The
`.env.example` files have working defaults for the local stack.

## 📐 Architecture

Single-language TypeScript monorepo. Web reads from API; API reads from
Postgres; Postgres is seeded from `data/*.json`. No separate Python
runtime, no message bus, no service mesh. The tradeoffs are documented
in [`docs/architecture.md`](docs/architecture.md).

## 🤝 Contributing

Code changes go through GitHub PRs. Read
[`CONTRIBUTING.md`](CONTRIBUTING.md) first. Every commit must carry a
DCO sign-off (`git commit -s`).

Record changes (adding a robot, fixing a dataset description, flagging a
broken policy link) are NOT GitHub PRs. They go through the in-app
`/contribute` flow. The model is "code is open, data is curated."

## 📜 License

Apache 2.0. See [`LICENSE`](LICENSE).

## 🛡️ Security

Found a vulnerability? Report it privately first. See
[`SECURITY.md`](SECURITY.md) for the disclosure channel and SLA.

## 📚 Further reading

- [`docs/architecture.md`](docs/architecture.md): system design and
  decisions.
- [`docs/coding-guide.md`](docs/coding-guide.md): code style and
  conventions.
- [`docs/agentic-first.md`](docs/agentic-first.md): the design
  principle behind the platform.
- [`docs/brand.md`](docs/brand.md): voice and visual identity.
- [`docs/public-api.md`](docs/public-api.md): the API surface.
- [`docs/prompting-guide.md`](docs/prompting-guide.md): prompt
  conventions.
- [`docs/testing.md`](docs/testing.md): test strategy.
- [`docs/observability.md`](docs/observability.md): what we track.
