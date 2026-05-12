# Testing

## Framework
Vitest. No exceptions. No bash scripts, no raw Node.js scripts.

## Commands

```bash
pnpm test              # Fast loop: seed validation only (<1s, no server)
pnpm test:smoke        # Medium loop: one API call (~10s, auto-starts server)
pnpm test:personas     # Full persona suite (15 personas, ~4 min, batched 3x parallel)
pnpm test:all          # Everything: vitest + personas (~5 min)
pnpm test:types        # Validate seed data TypeScript types
pnpm test:dashboard    # Live dashboard: watches files, auto-reruns, shows pass/fail
pnpm test:watch        # Watch mode (re-runs on file changes)
```

Developers run `pnpm test` constantly. `pnpm test:personas` runs in the background in a separate terminal.

## Live dashboard

For continuous testing, run `pnpm test:dashboard` in a dedicated terminal. It watches `system-prompt.ts` and seed data files, automatically re-runs all tests on changes, and shows a live pass/fail dashboard with per-persona results, failure details, token usage, and cost estimates. Leave it running while you code.

## Test server

Integration tests (persona tests, agent API tests) start their own
server on port 3001 via Vitest globalSetup. They never depend on the
dev server at localhost:3000. Unit tests and seed validation tests
don't need a server.

The global setup (tests/setup/global-setup.ts):
- Starts `next dev -p 3001` in the apps/web directory
- Polls until the server responds
- Sets TEST_BASE_URL env var for all test files
- Kills the server in teardown

If a server is already running on port 3001, the setup reuses it
instead of starting a new one.

## File conventions
- Test files: *.test.ts next to the file they test, or in __tests__/ folders
- Persona tests: tests/persona-tests/*.test.ts (integration, needs server)
- Seed data validation: tests/seed-validation/*.test.ts (offline, no server)
- Global setup: tests/setup/global-setup.ts

## Rules
- Every test uses describe/it/expect
- No console.log assertions — use expect()
- Async tests use async/await, not callbacks
- Mock external API calls (Claude API) — never make real API calls in unit tests
- Integration tests use TEST_BASE_URL env var — never hardcode localhost:3000
- Seed data validation tests run offline — they just check JSON structure, cross-references, and URL format
