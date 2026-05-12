const API_BASE = (
  process.env["FESTIVUS_DATASET_API_URL"] ?? "https://api.festivus.hapticlabs.ai"
).replace(/\/$/, "")

// Auth headers are built by the route handler (where request context is available)
// and passed in here. Keeps this module free of Next.js request-context dependencies.
type AuthHeaders = { Authorization: string } | { "X-Dev-User-Id": string }

export function buildAuthHeaders(userId: string, clerkToken: string | null): AuthHeaders {
  if (clerkToken) return { Authorization: `Bearer ${clerkToken}` }
  // Dev fallback: api/ accepts X-Dev-User-Id when CLERK_SECRET_KEY is absent
  return { "X-Dev-User-Id": userId }
}

export async function workbenchApiList(authHeaders: AuthHeaders): Promise<Response> {
  return fetch(`${API_BASE}/v1/internal/workbench-projects`, { headers: authHeaders })
}

export async function workbenchApiGet(
  authHeaders: AuthHeaders,
  projectId: string,
): Promise<Response> {
  return fetch(`${API_BASE}/v1/internal/workbench-projects/${projectId}`, {
    headers: authHeaders,
  })
}

export async function workbenchApiPut(
  authHeaders: AuthHeaders,
  projectId: string,
  body: unknown,
): Promise<Response> {
  return fetch(`${API_BASE}/v1/internal/workbench-projects/${projectId}`, {
    method: "PUT",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

export async function workbenchApiDelete(
  authHeaders: AuthHeaders,
  projectId: string,
): Promise<Response> {
  return fetch(`${API_BASE}/v1/internal/workbench-projects/${projectId}`, {
    method: "DELETE",
    headers: authHeaders,
  })
}
