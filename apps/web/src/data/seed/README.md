# `apps/web/src/data/seed/` — not what you think it is

These seed files are a manually curated subset with UI-friendly shapes
(camelCase, nested hardware). They are **NOT auto-generated** from
`data/*.json`.

- The Python scraping scripts in `scripts/` write to `data/`, not here.
- The `/v1/*` API (in `api/`) reads from `data/`, not here.
- The workbench uses these files for offline demos and tests.

If you edit a seed file here and the field is also served by the API, make
sure the change is reflected upstream in `data/` too. Divergence between the
two directories grows every time the scrapers run, and silently propagates
into the UI when an API-backed surface and a seed-backed surface disagree.

Background: `specs/015-monorepo-api-consolidation.md` (§Gotchas G1, G4).
