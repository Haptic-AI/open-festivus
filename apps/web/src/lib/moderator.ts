/**
 * Moderator gate. Reads the allowlist from the MODERATOR_EMAILS env var
 * (comma-split, lowercased on read). Empty when the env var is unset or
 * blank, in which case isModerator() always returns false. Production
 * deployments MUST set MODERATOR_EMAILS in their host environment.
 *
 * Checked server-side only. The client never sees this list, and the
 * authoritative check is always against the Clerk session email, never a
 * value the browser sends.
 */

export function getModeratorEmails(): readonly string[] {
  const raw = process.env["MODERATOR_EMAILS"]
  if (!raw) return []
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0)
}

export function isModerator(email: string | null | undefined): boolean {
  if (!email) return false
  const normalized = email.trim().toLowerCase()
  return getModeratorEmails().includes(normalized)
}
