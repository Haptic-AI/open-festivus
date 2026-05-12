"use client"

/**
 * Shared confirmation card rendered whenever propose_edit fires —
 * both agent-chat (drawer) and workbench (floating bottom-center) use
 * this. Promoted to edit-primitives in spec 029 phase 3.5 so the two
 * agents stay visually consistent without crossing the separation-of-
 * agents boundary.
 */

export interface IConfirmationCardPending {
  table: string
  slug: string
  field: string
  value: unknown
  reason: string | null
}

export function ConfirmationCard({
  pending,
  onConfirm,
  onCancel,
  busy = false,
}: {
  pending: IConfirmationCardPending
  onConfirm: () => void
  onCancel: () => void
  busy?: boolean
}) {
  return (
    <div
      className="border-blueprint-navy/20 bg-drafting-cream text-blueprint-navy rounded-lg border p-4 text-sm"
      data-testid="agent-confirmation-card"
    >
      <div className="mb-2 font-semibold">Confirm edit</div>
      <div className="mb-3">
        Change <code className="bg-white/60 rounded px-1 font-mono">{pending.field}</code> on{" "}
        <code className="bg-white/60 rounded px-1 font-mono">
          {pending.table}/{pending.slug}
        </code>{" "}
        to <code className="bg-white/60 rounded px-1 font-mono">{JSON.stringify(pending.value)}</code>?
      </div>
      {pending.reason ? (
        <div className="text-blueprint-navy/70 mb-3 text-xs">
          Reason: {pending.reason}
        </div>
      ) : null}
      <div className="flex gap-2">
        <button
          aria-busy={busy}
          className="bg-safety-yellow text-blueprint-navy rounded-md px-3 py-1 text-sm font-bold uppercase tracking-wider hover:opacity-90 disabled:cursor-wait disabled:opacity-50"
          data-testid="agent-confirm-btn"
          disabled={busy}
          onClick={onConfirm}
          type="button"
        >
          {busy ? "Updating..." : "Update"}
        </button>
        <button
          className="border-blueprint-navy/30 text-blueprint-navy/80 hover:bg-blueprint-navy/5 rounded-md border bg-white px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="agent-cancel-btn"
          disabled={busy}
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
      </div>
      <div className="text-blueprint-navy/60 mt-2 text-xs">
        Every edit goes to moderator review. Live edits can be rejected later.
      </div>
    </div>
  )
}
