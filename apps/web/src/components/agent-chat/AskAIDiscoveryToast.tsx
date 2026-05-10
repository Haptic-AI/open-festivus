"use client"

import { useUser } from "@clerk/nextjs"
import { X } from "lucide-react"
import { useEffect, useState } from "react"

interface IAskAIDiscoveryToastProps {
  storageKey: string
  message: string
  variant: "bottom-right" | "right-sidebar"
}

/**
 * First-visit nudge pointing at whichever agent-entry surface the current
 * page exposes. Bottom-right variant points at the floating AskAIButton on
 * /data/<domain>/[slug] pages; right-sidebar variant points at the Festivus
 * Agent panel on /workbench. Fires once per browser per surface via
 * localStorage. Signed-out users never see it.
 */
export function AskAIDiscoveryToast({ storageKey, message, variant }: IAskAIDiscoveryToastProps) {
  const { isSignedIn, isLoaded } = useUser()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!isLoaded || isSignedIn !== true) return
    if (typeof window === "undefined") return
    if (window.localStorage.getItem(storageKey) === "1") return
    setVisible(true)
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(storageKey, "1")
      setVisible(false)
    }, 12000)
    return () => { window.clearTimeout(timer) }
  }, [isLoaded, isSignedIn, storageKey])

  function dismiss() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, "1")
    }
    setVisible(false)
  }

  if (!visible) return null

  const positionClass = variant === "bottom-right"
    ? "bottom-20 right-6"
    : "top-24 right-[21rem] hidden md:flex"

  const arrow = variant === "bottom-right" ? "↘" : "→"

  return (
    <div
      aria-live="polite"
      className={`bg-drafting-cream border-blueprint-navy/25 text-blueprint-navy fixed ${positionClass} z-40 flex max-w-[280px] items-start gap-2 rounded-lg border px-3 py-2.5 text-xs shadow-lg`}
      data-testid="ask-ai-discovery-toast"
      role="status"
    >
      <span aria-hidden className="mt-[1px] text-sm leading-none">{arrow}</span>
      <span className="flex-1 leading-snug">{message}</span>
      <button
        aria-label="Dismiss"
        className="text-blueprint-navy/50 hover:text-blueprint-navy -mr-1 -mt-0.5 shrink-0 cursor-pointer p-0.5"
        onClick={dismiss}
        type="button"
      >
        <X size={12} />
      </button>
    </div>
  )
}
