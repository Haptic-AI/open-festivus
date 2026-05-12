"use client"

import { createContext, useCallback, useContext, useState, type ReactNode } from "react"
import type { IPageContext } from "@/lib/agent-chat/use-agent-chat"
import { ChatDrawer } from "@/components/agent-chat/ChatDrawer"

/**
 * Single-instance drawer state for the entire app. `AskAIButton` and the
 * per-field flag chip both call `openDrawer(ctx)` to pop the same drawer
 * with a new page context. The drawer is keyed on table/slug/field so
 * navigating from one record to another starts a fresh chat instead of
 * inheriting the previous conversation.
 */

interface IAgentChatDrawer {
  readonly context: IPageContext | null
  readonly isOpen: boolean
  openDrawer: (context: IPageContext) => void
  closeDrawer: () => void
}

const AgentChatDrawerContext = createContext<IAgentChatDrawer | null>(null)

export function AgentChatDrawerProvider({ children }: { children: ReactNode }) {
  const [context, setContext] = useState<IPageContext | null>(null)

  const openDrawer = useCallback((next: IPageContext): void => {
    setContext(next)
  }, [])

  const closeDrawer = useCallback((): void => {
    setContext(null)
  }, [])

  const drawerKey = context === null ? null : `${context.table}/${context.slug}`

  return (
    <AgentChatDrawerContext.Provider
      value={{ context, isOpen: context !== null, openDrawer, closeDrawer }}
    >
      {children}
      {context !== null && drawerKey !== null ? (
        <ChatDrawer context={context} key={drawerKey} onClose={closeDrawer} />
      ) : null}
    </AgentChatDrawerContext.Provider>
  )
}

export function useAgentChatDrawer(): IAgentChatDrawer {
  const value = useContext(AgentChatDrawerContext)
  if (value === null) {
    throw new Error(
      "useAgentChatDrawer must be called from inside <AgentChatDrawerProvider>",
    )
  }
  return value
}
