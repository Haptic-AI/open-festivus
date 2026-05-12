"use client"

import { useAgentChatDrawer } from "@/lib/agent-chat/drawer-context"

interface IGapClaimButtonProps {
  robotSlug: string
  robotName: string
  /** Kept in the prop shape for the caller but not pinned to the drawer — `compatible_policy_slugs` is array-typed and not agent-editable. The drawer opens scoped to the robot so the user can describe the desired addition. */
  policySlug?: string
  policyName?: string
}

export function GapClaimButton({ robotSlug, robotName }: IGapClaimButtonProps) {
  const { openDrawer } = useAgentChatDrawer()

  return (
    <button
      className="bg-blueprint-navy text-drafting-cream hover:opacity-90 rounded px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-opacity"
      onClick={() => {
        openDrawer({ table: "robots", slug: robotSlug, recordName: robotName })
      }}
      type="button"
    >
      Claim →
    </button>
  )
}
