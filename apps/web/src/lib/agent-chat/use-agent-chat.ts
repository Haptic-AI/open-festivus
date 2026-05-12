"use client"

import { useRouter } from "next/navigation"
import { useCallback, useRef, useState } from "react"

/**
 * Client-side SSE hook for /api/agent-chat (spec 029 Step 4.2).
 *
 * Owns the UI's conversation state. POSTs the user message (plus any
 * prior history) to the SSE endpoint, parses `data:` frames, and
 * surfaces typed hooks:
 *
 *   - `messages`: running chat log (user / assistant / system bubbles).
 *   - `sendMessage(text)`: push a user turn.
 *   - `pendingConfirmation`: non-null when Claude has called propose_edit
 *     and the user has yet to confirm. UI renders a confirmation card.
 *   - `confirmEdit()` / `cancelEdit()`: answer the pending confirmation
 *     by sending "yes" (Claude will then call apply_edit) or "no".
 *   - `status`: idle / streaming / needs_api_key / error.
 *
 * The hook never touches fek_* plaintexts, ANTHROPIC_API_KEY, or any
 * server secret. Everything interesting lives in /api/agent-chat.
 */

export type IChatStatus =
  | "idle"
  | "streaming"
  | "needs_api_key"
  | "error"

export type IChatRole = "user" | "assistant" | "system"

export interface IChatMessage {
  id: string
  role: IChatRole
  text: string
}

export interface IPendingConfirmation {
  toolUseId: string
  table: string
  slug: string
  field: string
  value: unknown
  reason: string | null
  confirmation_token: string
}

function newId(): string {
  return Math.random().toString(36).slice(2, 11)
}

// PDT/PST wall-clock for edit-latency logs. Mirror of the helper in
// app/workbench/workbench-canvas.tsx so both surfaces format timings
// identically. Worth keeping duplicated until the Phase B trace module
// lands; promoting now would be premature.
function tsNow(): string {
  const d = new Date()
  const ms = String(d.getMilliseconds()).padStart(3, "0")
  const base = d.toLocaleTimeString("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "short",
  })
  return base.replace(" ", `.${ms} `)
}

export interface IPageContext {
  table: string
  slug: string
  recordName: string
  /**
   * Optional scalar field the user clicked to open the drawer (flag-chip
   * entry point). When set, the server pins it into the system prompt so
   * Claude opens the conversation targeting that exact field.
   */
  field?: string
}

export interface IUseAgentChatApi {
  messages: IChatMessage[]
  status: IChatStatus
  errorDetail: string | null
  pendingConfirmation: IPendingConfirmation | null
  sendMessage: (text: string) => Promise<void>
  confirmEdit: () => Promise<void>
  cancelEdit: () => void
  reset: () => void
}

/**
 * Walks a byte stream and yields each `data: ...\n\n` SSE frame.
 * Exported for tests.
 */
export async function* readSseFrames(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<Record<string, unknown>, void, void> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    // Split on blank lines (SSE frame separator).
    let sep = buffer.indexOf("\n\n")
    while (sep !== -1) {
      const frame = buffer.slice(0, sep)
      buffer = buffer.slice(sep + 2)
      const line = frame.split("\n").find((l) => l.startsWith("data: "))
      if (line) {
        const raw = line.slice(6)
        try {
          yield JSON.parse(raw) as Record<string, unknown>
        } catch {
          // skip malformed frame
        }
      }
      sep = buffer.indexOf("\n\n")
    }
  }
}

export function useAgentChat(context?: IPageContext): IUseAgentChatApi {
  const router = useRouter()
  const [messages, setMessages] = useState<IChatMessage[]>([])
  const [status, setStatus] = useState<IChatStatus>("idle")
  const [errorDetail, setErrorDetail] = useState<string | null>(null)
  const [pendingConfirmation, setPendingConfirmation] = useState<IPendingConfirmation | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  // Spec 029 phase 3.7 (latency Phase A). Mirror of the workbench ref so
  // we can compare edit-loop latency between surfaces.
  const editLatencyRef = useRef<{ tSend?: number; tEditStart?: number; tPropose?: number; tConfirm?: number; tApply?: number }>({})

  const appendMessage = useCallback((role: IChatRole, text: string): void => {
    if (!text.trim()) return
    setMessages((prev) => [...prev, { id: newId(), role, text }])
  }, [])

  const extendLastAssistant = useCallback((delta: string): void => {
    setMessages((prev) => {
      if (prev.length === 0 || prev[prev.length - 1]?.role !== "assistant") {
        return [...prev, { id: newId(), role: "assistant" as const, text: delta }]
      }
      const copy = prev.slice()
      const last = copy[copy.length - 1]
      if (last) copy[copy.length - 1] = { ...last, text: last.text + delta }
      return copy
    })
  }, [])

  const streamResponse = useCallback(
    async (payload: { message: string }) => {
      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl
      setStatus("streaming")
      setErrorDetail(null)

      try {
        const res = await fetch("/api/agent-chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...payload, context: context ?? null }),
          signal: ctrl.signal,
        })
        if (!res.ok || !res.body) {
          // Surface error states as assistant messages in the chat thread
          // itself — that's the natural place for the user's eye to land
          // after they hit Send, and it's the difference between "broken"
          // and "the assistant is helping me figure out what to do".
          if (res.status === 401) {
            setStatus("needs_api_key")
            appendMessage(
              "assistant",
              "You need a personal API key to chat. Mint one — it takes 10 seconds — and try again. The link is right above this input.",
            )
            return
          }
          if (res.status === 429) {
            setStatus("error")
            appendMessage(
              "assistant",
              "Hitting the rate limit. Wait a minute and try again.",
            )
            return
          }
          if (res.status >= 500) {
            setStatus("error")
            appendMessage(
              "assistant",
              "Festivus API hiccup. Try again — if it keeps failing, ping the team.",
            )
            return
          }
          setStatus("error")
          appendMessage(
            "assistant",
            `Couldn't reach the chat agent (HTTP ${res.status}). Refresh the page and try again.`,
          )
          return
        }

        for await (const event of readSseFrames(res.body)) {
          const type = event["type"]
          if (type === "text_delta" && typeof event["text"] === "string") {
            extendLastAssistant(event["text"])
          } else if (type === "needs_api_key") {
            setStatus("needs_api_key")
          } else if (type === "tool_result") {
            // Show a brief system-line per tool result so the user sees
            // what's happening, plus capture propose_edit confirmation.
            const name = event["name"]
            const result = event["result"] as Record<string, unknown> | undefined
            if (name === "propose_edit" && result && typeof result["confirmation_token"] === "string") {
              setPendingConfirmation({
                toolUseId: String(event["tool_use_id"] ?? ""),
                table: String(result["table"] ?? ""),
                slug: String(result["slug"] ?? ""),
                field: String(result["field"] ?? ""),
                value: result["value"],
                reason: (result["reason"] as string | null) ?? null,
                confirmation_token: String(result["confirmation_token"]),
              })
              // Phase A latency — send → propose_edit
              editLatencyRef.current.tPropose = performance.now()
              editLatencyRef.current.tEditStart = editLatencyRef.current.tSend
              if (editLatencyRef.current.tEditStart !== undefined) {
                // eslint-disable-next-line no-console
                console.log(`[${tsNow()}] [edit-latency:drawer] send → propose_edit: ${Math.round(editLatencyRef.current.tPropose - editLatencyRef.current.tEditStart)}ms`)
              }
            } else if (name === "apply_edit" && result) {
              const ok = result["ok"] === true
              const status = result["status"] as number | undefined
              const body = result["body"] as Record<string, unknown> | undefined
              if (ok && body && typeof body["mutation_id"] === "number") {
                appendMessage(
                  "system",
                  `Edit live. Mutation #${body["mutation_id"]} — moderator can revert.`,
                )
                // Re-run the server component for the current route so the
                // mutated value replaces the stale render. Client state
                // (this drawer, open + mid-chat) is preserved by refresh.
                router.refresh()
                // Phase A latency — log the full edit-loop splits
                editLatencyRef.current.tApply = performance.now()
                const { tEditStart, tPropose, tConfirm, tApply } = editLatencyRef.current
                if (tEditStart !== undefined && tPropose !== undefined && tConfirm !== undefined) {
                  const legPropose = Math.round(tPropose - tEditStart)
                  const legThink = Math.round(tConfirm - tPropose)
                  const legApply = Math.round(tApply - tConfirm)
                  const total = Math.round(tApply - tEditStart)
                  // eslint-disable-next-line no-console
                  console.log(`[${tsNow()}] [edit-latency:drawer] propose=${String(legPropose)}ms think=${String(legThink)}ms apply=${String(legApply)}ms total=${String(total)}ms`)
                }
                editLatencyRef.current = {}
              } else if (status === 429) {
                const limit = body?.["limit"] ?? 200
                const hours = body?.["retry_after_hours"] ?? 24
                appendMessage(
                  "system",
                  `Rate limit hit: ${String(limit)} edits per ${String(hours)}h. Try again later.`,
                )
              } else if (status === 401) {
                appendMessage("system", "Auth expired. Sign in again, then retry.")
              } else if (body?.["error"] === "field_not_agent_editable") {
                const field = body["field_rejections"] as Array<{ field?: string }> | undefined
                const fname = field?.[0]?.field ?? "that field"
                appendMessage("system", `Cannot edit ${fname} — it's not agent-editable.`)
              } else {
                appendMessage(
                  "system",
                  `Edit failed${status !== undefined ? ` (${String(status)})` : ""}. Try rephrasing.`,
                )
              }
              setPendingConfirmation(null)
            } else if (name === "list_candidates" && result && typeof result["count"] === "number") {
              appendMessage("system", `Found ${result["count"]} candidate(s).`)
            }
          } else if (type === "error") {
            setStatus("error")
            const detail = String(event["detail"] ?? event["error"] ?? "unknown")
            appendMessage("assistant", `Something broke on my side: ${detail}. Try rephrasing or reload.`)
          } else if (type === "done") {
            setStatus("idle")
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setStatus("error")
          appendMessage(
            "assistant",
            `Network hiccup: ${(err as Error).message}. Try sending again.`,
          )
        }
      }
    },
    [appendMessage, extendLastAssistant, context, router],
  )

  const sendMessage = useCallback(
    async (text: string): Promise<void> => {
      editLatencyRef.current.tSend = performance.now()
      appendMessage("user", text)
      await streamResponse({ message: text })
    },
    [appendMessage, streamResponse],
  )

  const confirmEdit = useCallback(async (): Promise<void> => {
    const pc = pendingConfirmation
    if (!pc) return
    // Echo a plain 'yes' to Claude; Claude will call apply_edit with the
    // same confirmation_token on the next turn. The server verifies TTL.
    editLatencyRef.current.tConfirm = performance.now()
    appendMessage("user", "yes")
    await streamResponse({ message: `yes — apply the edit using confirmation_token ${pc.confirmation_token}` })
  }, [appendMessage, pendingConfirmation, streamResponse])

  const cancelEdit = useCallback((): void => {
    setPendingConfirmation(null)
    appendMessage("system", "Edit canceled.")
  }, [appendMessage])

  const reset = useCallback((): void => {
    abortRef.current?.abort()
    setMessages([])
    setStatus("idle")
    setErrorDetail(null)
    setPendingConfirmation(null)
  }, [])

  return {
    messages,
    status,
    errorDetail,
    pendingConfirmation,
    sendMessage,
    confirmEdit,
    cancelEdit,
    reset,
  }
}
