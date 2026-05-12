"use client"

import { X } from "lucide-react"
import { usePathname, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  classifyKeyCheckResponse,
  deriveHasActiveKey,
} from "@/lib/agent-chat/active-key-view"
import { buildMintKeyHref } from "@/lib/agent-chat/return-path-view"
import { useAgentChat, type IPageContext } from "@/lib/agent-chat/use-agent-chat"
import { ConfirmationCard } from "./ConfirmationCard"
import { MessageList } from "./MessageList"

/**
 * Slide-in right-side chat drawer. The provider owns visibility — this
 * component is mounted only when the drawer is open, so each open/close
 * cycle starts with fresh hook state. Page context (table/slug/recordName)
 * flows into the system prompt of every POST to `/api/agent-chat` so
 * Claude never drifts off the active record between turns.
 */

interface IChatDrawerProps {
  context: IPageContext
  onClose: () => void
}

export function ChatDrawer({ context, onClose }: IChatDrawerProps) {
  const { table, slug, recordName } = context
  const {
    messages,
    status,
    pendingConfirmation,
    sendMessage,
    confirmEdit,
    cancelEdit,
  } = useAgentChat({ table, slug, recordName })
  const [draft, setDraft] = useState("")
  const [hasActiveKey, setHasActiveKey] = useState<boolean | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const pathname = usePathname() ?? "/"
  const searchParams = useSearchParams()
  const mintKeyHref = useMemo(() => {
    const search = searchParams?.toString() ?? ""
    const fullPath = search.length > 0 ? `${pathname}?${search}` : pathname
    return buildMintKeyHref(fullPath)
  }, [pathname, searchParams])

  useEffect(() => {
    if (inputRef.current !== null) {
      inputRef.current.focus()
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function check(): Promise<void> {
      try {
        const res = await fetch("/api/api-keys", { method: "GET" })
        let body: { keys?: Array<{ revoked_at: string | null }> } | null = null
        if (res.ok) {
          try {
            body = (await res.json()) as typeof body
          } catch {
            body = null
          }
        }
        const input = classifyKeyCheckResponse(res.status, body)
        if (!cancelled) setHasActiveKey(deriveHasActiveKey(input))
      } catch {
        // Network throw → upstream-error semantics: optimistic-true.
        if (!cancelled) setHasActiveKey(deriveHasActiveKey({ kind: "upstream-error" }))
      }
    }
    void check()
    return () => {
      cancelled = true
    }
  }, [])

  const needsKey = hasActiveKey === false || status === "needs_api_key"

  useEffect(() => {
    if (scrollRef.current !== null) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages.length, pendingConfirmation])

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => { window.removeEventListener("keydown", onKey) }
  }, [onClose])

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return
    setDraft("")
    await sendMessage(text)
  }

  return (
    <>
      <div
        aria-hidden="true"
        className="fixed inset-0 z-40 bg-black/20 transition-opacity"
        onClick={onClose}
      />
      <aside
        aria-label="Festivus Agent chat"
        className="bg-drafting-cream border-blueprint-navy/20 fixed right-0 top-0 z-50 flex h-full w-full flex-col border-l shadow-xl sm:w-[420px]"
        data-testid="agent-chat-drawer"
      >
        <header className="border-blueprint-navy/10 flex items-center justify-between border-b px-4 py-3">
          <div className="min-w-0">
            <p className="text-blueprint-navy/50 font-mono text-[13px] font-bold uppercase tracking-[0.2em]">
              Festivus Agent · {table}
            </p>
            <h2 className="text-blueprint-navy truncate text-sm font-bold">{recordName}</h2>
          </div>
          <button
            aria-label="Close chat"
            className="text-blueprint-navy/50 hover:text-blueprint-navy"
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-3" ref={scrollRef}>
          {needsKey && messages.length === 0 ? (
            <div className="mt-4 rounded border border-amber-300 bg-amber-50 p-4 text-sm leading-relaxed">
              <p className="text-blueprint-navy mb-2 font-bold">One-time setup</p>
              <p className="text-blueprint-navy/80 mb-3">
                The agent needs an API key to make edits on your behalf. It&apos;s free and takes a few seconds.
              </p>
              <a
                className="bg-blueprint-navy text-drafting-cream inline-block rounded px-3 py-2 text-xs font-bold uppercase tracking-[0.15em] hover:opacity-90"
                href={mintKeyHref}
              >
                Mint API Key
              </a>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-blueprint-navy/60 mt-4 text-sm leading-relaxed">
              <p className="mb-2">
                I&apos;m on the <strong>{recordName}</strong> page. Try:
              </p>
              <ul className="list-disc space-y-1 pl-5 text-[16px]">
                <li>&ldquo;Update the weight to 90kg&rdquo;</li>
                <li>&ldquo;Change the price to $55,000&rdquo;</li>
                <li>&ldquo;What fields are missing?&rdquo;</li>
              </ul>
            </div>
          ) : (
            <MessageList messages={messages} />
          )}
        </div>

        {needsKey && messages.length > 0 ? (
          <div className="border-blueprint-navy/10 border-t bg-amber-50 p-3 text-sm">
            You need an API key to make edits.{" "}
            <a className="underline" href={mintKeyHref}>
              Mint one
            </a>
            .
          </div>
        ) : null}

        {pendingConfirmation !== null ? (
          <div className="border-blueprint-navy/10 border-t px-4 py-3">
            <ConfirmationCard
              busy={status === "streaming"}
              onCancel={cancelEdit}
              onConfirm={() => {
                void confirmEdit()
              }}
              pending={pendingConfirmation}
            />
          </div>
        ) : null}

        <form className="border-blueprint-navy/10 flex gap-2 border-t px-4 py-3" onSubmit={submit}>
          <input
            className="border-blueprint-navy/20 bg-white text-blueprint-navy flex-1 rounded border px-3 py-2 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 disabled:bg-neutral-100"
            data-testid="agent-chat-input"
            disabled={status === "streaming" || needsKey}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={
              needsKey
                ? "Mint an API key to start chatting"
                : status === "streaming"
                  ? "Streaming..."
                  : "What should change?"
            }
            ref={inputRef}
            value={draft}
          />
          <button
            className="bg-safety-yellow text-blueprint-navy rounded px-3 py-2 text-sm font-bold uppercase tracking-wider hover:opacity-90 disabled:opacity-40"
            data-testid="agent-chat-send"
            disabled={status === "streaming" || needsKey || draft.trim().length === 0}
            type="submit"
          >
            Send
          </button>
        </form>
        {/* Errors render as assistant messages in the thread above —
            no red footer text. The thread is the single source of truth
            for what the agent has to say to the user. */}
      </aside>
    </>
  )
}
