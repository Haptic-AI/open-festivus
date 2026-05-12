/**
 * Thin re-export of the shared ConfirmationCard (spec 029 phase 3.5).
 * The real component lives in `lib/edit-primitives/ConfirmationCard.tsx`
 * so the workbench agent uses the same card without crossing the
 * separation-of-agents boundary.
 */
export { ConfirmationCard } from "@/lib/edit-primitives/ConfirmationCard"
export type { IConfirmationCardPending } from "@/lib/edit-primitives/ConfirmationCard"
