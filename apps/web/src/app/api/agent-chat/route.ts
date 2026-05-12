import Anthropic from "@anthropic-ai/sdk"
import type { MessageParam, Tool, ToolUseBlock } from "@anthropic-ai/sdk/resources/messages"
import { getRequestUser } from "@/lib/auth"
import { listKeysFor } from "@/lib/api-keys-forwarder"
import {
  executeApplyEdit,
  executeListCandidates,
  executeProposeEdit,
  type IToolExecutorDeps,
} from "@/lib/edit-primitives/execute-tool"
import { AGENT_CHAT_SYSTEM_PROMPT } from "@/lib/agent-chat/system-prompt"
import { buildTools } from "@/lib/edit-primitives/tools"

/**
 * Spec 029 Festivus Agent chat SSE endpoint.
 *
 * Gates, in order:
 *   1. Clerk auth: `getRequestUser()`. 401 if null.
 *   2. Active fek_*: user must have at least one un-revoked api_keys row.
 *      If zero, emit a `needs_api_key` SSE event and close (NOT a 403).
 *
 * Tool-use loop:
 *   - Anthropic Messages API with { system, tools } — up to N turns.
 *   - Every `tool_use` block is executed server-side:
 *       list_candidates → read API passthrough
 *       propose_edit    → mint HMAC confirmation token
 *       apply_edit      → verify token, forward to /v1/write via
 *                         moderator key + X-On-Behalf-Of-User-Id header.
 *
 * Leak invariants (spec 029 § Invariants):
 *   - ANTHROPIC_API_KEY never in any SSE payload.
 *   - fek_* / moderator key never in any SSE payload.
 *   - Clerk session token never in any SSE payload.
 *
 * The route streams these SSE events to the browser:
 *   - type="text_delta"         incremental Claude text.
 *   - type="tool_result"        sanitized tool-result snapshot.
 *   - type="needs_api_key"      user has no fek_*; close immediately.
 *   - type="done"               conversation over (max turns or stop).
 *   - type="error"              fatal error; close with detail but no secrets.
 */

const MODEL = "claude-sonnet-4-20250514"
const MAX_TURNS = 12

interface IChatRequestBody {
  message: string
  /** Prior assistant/user messages. Caller keeps history ephemeral (spec 029 § Open Questions #2). */
  history?: MessageParam[]
  /** The record the UI is currently scoped to. Appended to the system prompt on every request so Claude never loses context between turns. */
  context?: {
    table: string
    slug: string
    recordName: string
    /** When the drawer was opened from a per-field flag chip, the field name rides along so Claude targets the right scalar from turn one. */
    field?: string
  } | null
}

function sseEvent(encoder: TextEncoder, payload: Record<string, unknown>): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
}

export async function POST(request: Request): Promise<Response> {
  const user = await getRequestUser()
  if (!user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    })
  }

  let body: IChatRequestBody
  try {
    body = (await request.json()) as IChatRequestBody
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    })
  }
  if (!body.message || typeof body.message !== "string") {
    return new Response(JSON.stringify({ error: "missing_message" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    })
  }

  // needs_api_key gate. If the user has no active fek_*, emit a single SSE
  // event and close — the browser renders the onboarding card inline.
  let hasActiveKey = false
  try {
    const keys = await listKeysFor(user.id)
    hasActiveKey = keys.some((k) => k.revoked_at === null)
  } catch {
    // Upstream hiccup shouldn't block the auth gate; fall through to the
    // tool loop which will surface its own error if needed.
    hasActiveKey = true
  }

  const encoder = new TextEncoder()
  const moderatorKey = process.env["FESTIVUS_MODERATOR_KEY"] ?? ""
  const readApiUrl = process.env["FESTIVUS_DATASET_API_URL"] ?? "https://api.festivus.hapticlabs.ai"
  const anthropicKey = process.env["ANTHROPIC_API_KEY"]

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const close = (): void => {
        try {
          controller.close()
        } catch {
          // already closed; safe to ignore.
        }
      }
      const send = (obj: Record<string, unknown>): void => {
        controller.enqueue(sseEvent(encoder, obj))
      }

      if (!hasActiveKey) {
        send({ type: "needs_api_key", cta: "/settings/api-keys?source=agent" })
        send({ type: "done", reason: "needs_api_key" })
        close()
        return
      }

      if (!anthropicKey) {
        send({ type: "error", error: "anthropic_unconfigured" })
        close()
        return
      }
      if (!moderatorKey) {
        send({ type: "error", error: "moderator_key_unconfigured" })
        close()
        return
      }

      const deps: IToolExecutorDeps = {
        readApiUrl,
        writeApiUrl: readApiUrl,
        moderatorKey,
        userClerkId: user.id,
      }

      const client = new Anthropic({ apiKey: anthropicKey })
      const tools = buildTools() as Tool[]

      // Prompt caching (spec 029 phase 3.8). The AGENT_CHAT_SYSTEM_PROMPT
      // (~1.5k tokens incl. allowlist preamble) is byte-identical across
      // every turn of a session. Mark it cache_control:ephemeral so
      // Anthropic serves follow-up turns ~10x faster. The per-turn
      // "Active page context" block sits AFTER the cache boundary so it
      // doesn't invalidate the cache.
      const ctx = body.context
      const contextBlock = ctx
        ? (() => {
            const fieldLine = ctx.field
              ? `\n\nThe user opened the chat from the \`${ctx.field}\` field. Target that field for the first edit unless the user asks for something else.`
              : ""
            return `## Active page context (authoritative)\n\nThe user is viewing the **${ctx.recordName}** record. Every edit targets \`${ctx.table}/${ctx.slug}\` unless the user explicitly names a different row. Do not call list_candidates to search for this row — you already have it. When the user refers to "it", "this", "the record", or a field name without a slug, they mean this one.${fieldLine}`
          })()
        : null
      const systemBlocks = contextBlock !== null
        ? [
            { type: "text" as const, text: AGENT_CHAT_SYSTEM_PROMPT, cache_control: { type: "ephemeral" as const } },
            { type: "text" as const, text: contextBlock },
          ]
        : [
            { type: "text" as const, text: AGENT_CHAT_SYSTEM_PROMPT, cache_control: { type: "ephemeral" as const } },
          ]
      // Cache tools too (small, but saves per-turn deserialization).
      const cachedTools = tools.length > 0
        ? [
            ...tools.slice(0, -1),
            { ...tools[tools.length - 1]!, cache_control: { type: "ephemeral" as const } },
          ]
        : tools

      const messages: MessageParam[] = [
        ...(body.history ?? []),
        { role: "user", content: body.message },
      ]

      try {
        for (let turn = 0; turn < MAX_TURNS; turn += 1) {
          const turnStart = Date.now()
          const resp = await client.messages.create({
            model: MODEL,
            max_tokens: 1024,
            system: systemBlocks,
            tools: cachedTools,
            messages,
          })
          // Spec 029 phase 3.8 — per-turn wall-clock + cache stats.
          const usage = resp.usage as (typeof resp.usage & {
            cache_read_input_tokens?: number
            cache_creation_input_tokens?: number
          }) | undefined
          const cacheRead = usage?.cache_read_input_tokens ?? 0
          const cacheWrite = usage?.cache_creation_input_tokens ?? 0
          const turnMs = Date.now() - turnStart
          // eslint-disable-next-line no-console
          console.log(`[agent-chat/turn] turn=${String(turn)} ms=${String(turnMs)} in=${String(usage?.input_tokens ?? 0)} out=${String(usage?.output_tokens ?? 0)} cache_read=${String(cacheRead)} cache_write=${String(cacheWrite)} stop=${String(resp.stop_reason ?? "?")}`)

          // Stream text blocks to the browser and collect tool_use blocks.
          const assistantBlocks: Array<
            | { type: "text"; text: string }
            | ToolUseBlock
          > = []
          const toolUses: ToolUseBlock[] = []
          for (const block of resp.content) {
            if (block.type === "text") {
              send({ type: "text_delta", text: block.text })
              assistantBlocks.push({ type: "text", text: block.text })
            } else if (block.type === "tool_use") {
              assistantBlocks.push(block)
              toolUses.push(block)
            }
          }

          if (toolUses.length === 0) {
            send({ type: "done", reason: resp.stop_reason ?? "end_turn", turn })
            break
          }

          messages.push({ role: "assistant", content: assistantBlocks })

          // Execute each tool_use server-side; stream sanitized results.
          const toolResults: Array<{ type: "tool_result"; tool_use_id: string; content: string }> = []
          for (const tu of toolUses) {
            let result: unknown
            try {
              if (tu.name === "list_candidates") {
                result = await executeListCandidates(deps, tu.input as never)
              } else if (tu.name === "propose_edit") {
                result = await executeProposeEdit(deps, tu.input as never)
              } else if (tu.name === "apply_edit") {
                result = await executeApplyEdit(deps, tu.input as never)
              } else {
                result = { error: "unknown_tool", name: tu.name }
              }
            } catch (err) {
              result = {
                error: "tool_execution_failed",
                detail: err instanceof Error ? err.message : String(err),
              }
            }

            // Do NOT include moderatorKey / anthropicKey / raw Authorization
            // headers in the payload the browser sees. `result` is sourced
            // from our own executor output and is safe to stream.
            send({
              type: "tool_result",
              tool_use_id: tu.id,
              name: tu.name,
              result,
            })
            toolResults.push({
              type: "tool_result",
              tool_use_id: tu.id,
              content: JSON.stringify(result),
            })
          }

          messages.push({ role: "user", content: toolResults })

          if (resp.stop_reason === "end_turn" && toolUses.length === 0) {
            send({ type: "done", reason: "end_turn", turn })
            break
          }
        }

        if (messages.length > 0 && messages[messages.length - 1]?.role === "user") {
          send({ type: "done", reason: "max_turns" })
        }
      } catch (err) {
        // Surface a human-readable failure but scrub anything that looks
        // like a key. Anthropic errors can contain the request id + headers.
        const raw = err instanceof Error ? err.message : String(err)
        const scrubbed = raw
          .replace(/sk-ant-[A-Za-z0-9_-]+/g, "<redacted>")
          .replace(/fek_[A-Za-z0-9]+/g, "<redacted>")
        send({ type: "error", error: "llm_or_tool_failed", detail: scrubbed })
      } finally {
        close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  })
}
