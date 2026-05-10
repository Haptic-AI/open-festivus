# @festivus/scrape

Batch-time HTML-to-markdown scraping for the monorepo. Thin wrapper around
ScrapingBee with retry/backoff, disk cache, and credit tracking baked in.

## Conventions

- Interfaces prefixed with `I` (e.g., `IScrapeOptions`, `IScrapeResult`)
- `import type` for type-only imports (required by `verbatimModuleSyntax`)
- `.js` extensions on relative imports (required by `nodenext` resolution)
- Consumed via `@festivus/scrape` (workspace link), source-run under `tsx`
- No build step — consumers import `./src/index.ts` directly

## Public surface

- `scrape(url, opts?)` — fetch a page, return clean markdown + metadata
- `checkCredits()` — query ScrapingBee quota
- Types: `IScrapeOptions`, `IScrapeResult`, `IScrapeCredits`

## Playbook

Full usage guide and gotchas live at `.claude/skills/scrape/SKILL.md`.
That's the skill Claude reads when it needs to scrape. This CLAUDE.md is
the package-level quick reference.

## Env vars

- `SCRAPINGBEE_API_KEY` — required. Put in `.env.local`, never commit.
