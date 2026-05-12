"use client"

import type { IChatMessage } from "@/lib/agent-chat/use-agent-chat"

export function MessageList({ messages }: { messages: IChatMessage[] }) {
  if (messages.length === 0) {
    return (
      <div className="text-sm text-neutral-500">
        Ask about a field you&apos;d like to fix, e.g. &ldquo;Find robots with missing weight_kg&rdquo;.
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-3">
      {messages.map((m) => (
        <div
          className={
            m.role === "user"
              ? "self-end rounded-lg bg-neutral-900 px-3 py-2 text-sm text-white dark:bg-white dark:text-neutral-900"
              : m.role === "assistant"
              ? "self-start rounded-lg bg-neutral-100 px-3 py-2 text-sm text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
              : "self-center rounded-md bg-neutral-50 px-3 py-1 text-xs text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400"
          }
          data-testid={`chat-msg-${m.role}`}
          key={m.id}
        >
          {m.text}
        </div>
      ))}
    </div>
  )
}
