# Observability

Local-dev trace sink for the `/api/agent` route. Spec:
`specs/014-agent-trace-observability.md`.

## What you get

Every `/api/agent` request in dev mode writes a file to
`.festivus-traces/<ISO>-<request_id>.jsonl` — one structured event per
line, strictly append-only within a request. The producer is the Rule
21 event bus, already wired through the route; this is its first
non-test consumer.

## How to use

Look at the latest trace for a single request:

```
cat .festivus-traces/$(ls -t .festivus-traces | head -1) | jq .
```

Watch traces land live while you iterate on a prompt:

```
tail -f .festivus-traces/*.jsonl
```

Filter to just tool calls:

```
jq 'select(.type == "api_tool_called") | .gen_ai.tool' \
  .festivus-traces/*.jsonl
```

## Paste into Claude

The acceptance signal for this whole feature is that pasting a trace
into Claude yields a useful diagnostic. Recommended prompt:

> Here is a trace from "[your question]". Walk me through what the
> agent did and where prompt iteration has leverage.

If Claude's walkthrough matches your mental model and points at real
leverage (a missed tool, a bad specialist handoff, a fallback that
should have fired earlier), the trace is doing its job.

## OTEL naming

Field names follow OpenTelemetry GenAI semantic conventions for
LLM-generic fields (`gen_ai.system`, `gen_ai.request.model`,
`gen_ai.tool.name`, `gen_ai.tool.call.arguments`,
`gen_ai.tool.call.result_preview`, `gen_ai.usage.input_tokens`). Project-
specific fields live under a `festivus.*` prefix
(`festivus.router.shape`, `festivus.specialist.name`,
`festivus.chunk.index`). This keeps the wire format portable: a future
backend (Langfuse, OTEL exporter, something else) plugs in as a new
sink implementation without a schema migration.

## Environment variables

| Var | Default | Effect |
|---|---|---|
| `FESTIVUS_TRACE_DIR` | `.festivus-traces/` when `NODE_ENV === "development"`, else unset | When set, `resolveSink` returns a `JSONLFileSink` writing to that dir. When unset in production, `resolveSink` returns `NoopTraceSink` — zero I/O, zero cost. |

`.festivus-traces/` is gitignored.

## Rule references

- **Rule 21** — Event-bus producer. Emissions in
  `apps/web/src/app/api/agent/route.ts` are the source of truth. This
  feature does not modify them; it adds a sink.
- **Spec 014** — Event taxonomy, sink interface, test strategy, the
  anti-patterns this design forbids from day one, and the exit-cost
  argument for using the pattern before adopting a hosted backend.
