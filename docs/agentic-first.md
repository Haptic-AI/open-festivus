# Agentic-first, then human

Festivus is being built for an agentic experience before a human one. When a feature has two plausible shapes, pick the one that's easier for an agent — LLM running tools over HTTP with an API key — even if it's clunkier for a person clicking buttons.

## What this looks like in practice

- **Agent API keys are the primary write surface.** Clerk-authenticated humans can mint them from `/settings/api-keys`, but the keys are the thing that gets used. There is no human-form write path in production today.
- **Moderator queue, not inline edits.** `PATCH` enqueues a pending mutation; a human approves. Agents can keep submitting in a loop without trampling each other; humans still hold the veto.
- **Read surface is public and CORS-open.** `GET` routes don't need a key. Agents and browsers hit the same routes with the same shape.
- **Email notifications close the loop for both sides.** Submitters (human or agent-operated account) get an email per `PATCH` and per review outcome. Agents learn from their email the way a human does.
- **OpenAPI is the source of truth.** Every agent discovers the API by hitting `/v1/openapi.json`. The shape has to stay honest for agents to not hallucinate routes.

## How to apply

When designing a new feature:

1. Ask how a Claude / OpenAI agent with only an API key would call it. If that's painful, fix that before fixing the human-clicks-a-button version.
2. Prefer structured responses over flashy UI. A JSON envelope with a clear `status` field beats a toast.
3. Don't hide state behind auth modals. Agents can't see modals. Put the state in a response the tool call can read.
4. Human UI is a nice-to-have on top of the agent-ready surface, not the other way around.
