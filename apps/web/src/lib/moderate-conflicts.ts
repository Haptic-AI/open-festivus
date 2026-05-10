import type { IMutation } from "@festivus/types"

/**
 * Spec 027 phase 10. Two pending mutations that touch the same
 * (table, slug, field) are in conflict: approving both would have the
 * later one silently overwrite the earlier one with no moderator signal.
 *
 * Returns the set of composite keys that appear more than once across the
 * given mutations. The caller renders a yellow border + link on any card
 * whose field_path contains a key from the set.
 */
export function computeConflictKeys(mutations: IMutation[]): Set<string> {
  const counts = new Map<string, number>()
  for (const m of mutations) {
    for (const field of m.field_path.split(",").filter(Boolean)) {
      const key = `${m.table_name}:${m.slug}:${field}`
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }
  const conflicts = new Set<string>()
  for (const [key, count] of counts) {
    if (count > 1) conflicts.add(key)
  }
  return conflicts
}
