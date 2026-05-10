"use client"

import { useUser } from "@clerk/nextjs"
import { Sparkles } from "lucide-react"
import { useAgentChatDrawer } from "@/lib/agent-chat/drawer-context"
import { AskAIDiscoveryToast } from "./AskAIDiscoveryToast"

interface IAskAIButtonProps {
  table: string
  slug: string
  recordName: string
}

/**
 * Floating bottom-right toggle. Opens the app-wide `AgentChatDrawer`
 * scoped to the current record. Hidden when the user is not signed in so
 * we do not surface a button that would 401 the moment it is used.
 */
export function AskAIButton({ table, slug, recordName }: IAskAIButtonProps) {
  const { isSignedIn, isLoaded } = useUser()
  const { openDrawer } = useAgentChatDrawer()

  if (!isLoaded || !isSignedIn) return null

  return (
    <>
      <AskAIDiscoveryToast
        message="See something wrong? Ask AI to edit this record."
        storageKey="festivus_ask_ai_toast_seen"
        variant="bottom-right"
      />
      <button
        aria-label="Ask AI to edit this record"
        className="bg-blueprint-navy text-drafting-cream hover:bg-blueprint-navy/90 fixed bottom-6 right-6 z-30 flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold shadow-lg transition-transform hover:scale-[1.02]"
        data-testid="agent-chat-toggle"
        onClick={() => { openDrawer({ table, slug, recordName }) }}
        type="button"
      >
        <Sparkles size={16} />
        <span>Ask AI to edit</span>
      </button>
    </>
  )
}
