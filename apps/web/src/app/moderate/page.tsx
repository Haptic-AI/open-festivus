import { redirect } from "next/navigation"
import { getRequestUser } from "@/lib/auth"
import { computeConflictKeys } from "@/lib/moderate-conflicts"
import { isModerator } from "@/lib/moderator"
import { listPendingMutations } from "@/lib/moderator-client"
import { MutationCard } from "@/components/moderate/MutationCard"

// Spec 027. Moderator queue. Four hardcoded email addresses (see
// apps/web/src/lib/moderator.ts) can approve or reject pending mutations
// submitted by Agent API keys. Everyone else gets redirected.

export const dynamic = "force-dynamic"

export default async function ModeratePage() {
  const user = await getRequestUser()
  if (!user) redirect("/sign-in")
  if (!isModerator(user.email)) redirect("/")

  let list
  let fetchError: string | null = null
  try {
    list = await listPendingMutations(50)
  } catch (err) {
    fetchError = err instanceof Error ? err.message : String(err)
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Moderate</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Pending edits submitted by Agent API keys. Approve applies the patch to the database.
          Reject closes the mutation without applying.
        </p>
      </header>

      {list && list.count > 50 ? (
        <div className="mb-4 rounded border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900">
          <strong>Queue is long ({list.count} pending).</strong> Consider a review sprint — Agent
          keys over 200 writes/24h will start 429ing, but pending items keep stacking until a
          moderator acts.
        </div>
      ) : null}

      {fetchError ? (
        <div className="rounded border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          <strong>Could not load the queue.</strong>
          <pre className="mt-2 whitespace-pre-wrap font-mono text-xs">{fetchError}</pre>
          <p className="mt-2">
            If this is a fresh setup, mint a moderator key with
            <code className="mx-1 rounded bg-red-100 px-1 py-0.5 font-mono">
              pnpm --filter @festivus/api exec tsx src/scripts/mint-moderator-web-key.ts
            </code>
            and paste the plaintext into <code>FESTIVUS_MODERATOR_KEY</code>.
          </p>
        </div>
      ) : !list || list.count === 0 ? (
        <p className="rounded border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
          Queue is empty. Nothing pending.
        </p>
      ) : (
        <section className="space-y-3">
          <p className="text-xs text-neutral-500">
            {list.count} pending · showing {list.results.length}
            {(() => {
              const conflicts = computeConflictKeys(list.results)
              return conflicts.size > 0 ? (
                <>
                  {" "}
                  ·{" "}
                  <span className="font-medium text-amber-700">
                    {conflicts.size} field conflict{conflicts.size === 1 ? "" : "s"}
                  </span>
                </>
              ) : null
            })()}
          </p>
          {(() => {
            const conflicts = computeConflictKeys(list.results)
            return list.results.map((m) => (
              <MutationCard conflicts={conflicts} key={m.id} mutation={m} />
            ))
          })()}
        </section>
      )}
    </main>
  )
}
