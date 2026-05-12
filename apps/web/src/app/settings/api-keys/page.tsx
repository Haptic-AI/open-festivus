"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { ApiKeysPanel } from "@/components/settings/ApiKeysPanel"
import { resolveReturnPath } from "@/lib/agent-chat/return-path-view"

// Reads ?source=agent from the URL — split into its own component so the
// Suspense boundary below can satisfy Next 15's CSR-bailout requirement
// during static-render. Without it, `next build` errors on this page
// with "useSearchParams() should be wrapped in a suspense boundary".
function AgentReturnBanner() {
  const params = useSearchParams()
  const fromAgent = params.get("source") === "agent"
  if (!fromAgent) return null
  // The drawer encodes the page the user came from as `return_to=…`. We
  // pass it through resolveReturnPath which whitelists same-origin paths
  // and falls back to `/`. Hard-coding href="/agent" used to 404 because
  // there's no /agent route.
  const returnTo = resolveReturnPath(params.get("return_to"))
  return (
    <div
      className="mx-auto my-4 max-w-2xl rounded-md border border-blue-300 bg-blue-50 p-3 text-sm dark:border-blue-700 dark:bg-blue-950"
      data-testid="agent-return-banner"
    >
      <div className="mb-2 font-medium">Coming from Festivus Agent</div>
      <div className="mb-3 text-neutral-700 dark:text-neutral-300">
        Mint a write-tier API key below, then return to continue your chat.
      </div>
      <Link
        className="inline-block rounded-md bg-neutral-900 px-3 py-1 text-sm text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        data-testid="agent-return-cta"
        href={returnTo}
      >
        Return to Festivus Agent
      </Link>
    </div>
  )
}

export default function ApiKeysPage() {
  return (
    <>
      <Suspense fallback={null}>
        <AgentReturnBanner />
      </Suspense>
      <ApiKeysPanel />
    </>
  )
}
