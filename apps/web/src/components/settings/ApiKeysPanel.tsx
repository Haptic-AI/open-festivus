"use client"

import { useCallback, useEffect, useState } from "react"
import { KeyCreatedModal } from "@/components/settings/KeyCreatedModal"
import { useTrackedAction } from "@/lib/latency"

interface IApiKeyRow {
  id: number
  name: string | null
  tier: string
  // Snapshot of the owner's Clerk email at mint time. `null` on keys minted
  // before the owner_email column landed — those won't receive submitter
  // notifications until re-minted.
  owner_email: string | null
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
}

interface IApiKeysPanelProps {
  // When true, render a tighter layout (narrower headings, no outer page chrome)
  // so the panel fits inside Clerk's UserProfile modal. Defaults to false for
  // the standalone /settings/api-keys route.
  compact?: boolean
}

const AGENT_VENDORS = [
  { value: "claude", label: "Claude" },
  { value: "openai", label: "OpenAI" },
  { value: "openclaw", label: "OpenClaw" },
] as const

type IAgentVendor = (typeof AGENT_VENDORS)[number]["value"]

export function ApiKeysPanel({ compact = false }: IApiKeysPanelProps) {
  const [keys, setKeys] = useState<IApiKeyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [standardName, setStandardName] = useState("")
  const [agentName, setAgentName] = useState("")
  const [agentVendor, setAgentVendor] = useState<IAgentVendor>("claude")
  const [creating, setCreating] = useState<"standard" | "agent" | null>(null)
  const [plaintext, setPlaintext] = useState<string | null>(null)

  const loadKeys = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/api-keys", { method: "GET" })
      if (!res.ok) {
        setError("Could not load keys")
        return
      }
      const body = (await res.json()) as { keys: IApiKeyRow[] }
      setKeys(body.keys)
    } catch {
      setError("Could not load keys")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadKeys()
  }, [loadKeys])

  const createStandardImpl = async (): Promise<void> => {
    if (!standardName.trim()) return
    setCreating("standard")
    setError(null)
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: standardName.trim(), tier: "keyed" }),
      })
      if (!res.ok) {
        setError("Could not create key")
        return
      }
      const body = (await res.json()) as { key: { plaintext: string } }
      setPlaintext(body.key.plaintext)
      setStandardName("")
    } catch {
      setError("Could not create key")
    } finally {
      setCreating(null)
    }
  }
  const { run: createStandard } = useTrackedAction("api-keys.create-standard", createStandardImpl)

  const createAgentImpl = async (): Promise<void> => {
    if (!agentName.trim()) return
    setCreating("agent")
    setError(null)
    try {
      const vendorLabel = AGENT_VENDORS.find((v) => v.value === agentVendor)?.label ?? agentVendor
      const composedName = `Agent (${vendorLabel}) - ${agentName.trim()}`
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: composedName, tier: "write" }),
      })
      if (!res.ok) {
        setError("Could not create key")
        return
      }
      const body = (await res.json()) as { key: { plaintext: string } }
      setPlaintext(body.key.plaintext)
      setAgentName("")
    } catch {
      setError("Could not create key")
    } finally {
      setCreating(null)
    }
  }
  const { run: createAgent } = useTrackedAction("api-keys.create-agent", createAgentImpl)

  const handleRevokeImpl = async (id: number): Promise<void> => {
    if (!window.confirm("Revoke this key? Any service using it will immediately start getting 401s.")) {
      return
    }
    try {
      const res = await fetch(`/api/api-keys/${id}`, { method: "DELETE" })
      if (!res.ok) {
        setError("Could not revoke key")
        return
      }
      await loadKeys()
    } catch {
      setError("Could not revoke key")
    }
  }
  const { run: handleRevoke } = useTrackedAction("api-keys.revoke", handleRevokeImpl)

  const handleModalClose = async (): Promise<void> => {
    setPlaintext(null)
    await loadKeys()
  }

  const headingClass = compact
    ? "text-sm font-semibold text-neutral-900"
    : "text-sm font-semibold text-neutral-900"
  const sectionClass = compact
    ? "mt-4 rounded border border-neutral-200 bg-white p-4"
    : "mt-6 rounded border border-neutral-200 bg-white p-6"

  return (
    <div data-testid="api-keys-panel">
      {!compact && (
        <>
          <h1 className="text-2xl font-semibold text-neutral-900">API keys</h1>
          <p className="mt-2 text-sm text-neutral-700">
            Keys tie to your account. Standard keys raise the anonymous rate limit on read
            endpoints. Agent keys authorize a specific AI client to edit Festivus data via
            the write API. Plaintext is shown exactly once — copy it when created.
          </p>
        </>
      )}

      <section className={sectionClass}>
        <h2 className={headingClass}>Standard API key</h2>
        <p className="mt-1 text-xs text-neutral-600">
          Raises rate limit on <code className="font-mono">GET /v1/*</code>. Read-only.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            className="flex-1 rounded border border-neutral-300 px-3 py-2 text-sm"
            data-testid="standard-key-name"
            onChange={(e) => setStandardName(e.target.value)}
            placeholder="Name (e.g. laptop, ci-runner)"
            type="text"
            value={standardName}
          />
          <button
            className="rounded bg-blueprint-navy px-4 py-2 text-sm font-medium text-white hover:bg-blueprint-navy/90 disabled:opacity-50"
            data-testid="create-standard-key"
            disabled={creating !== null || !standardName.trim()}
            onClick={() => void createStandard()}
            type="button"
          >
            {creating === "standard" ? "Creating..." : "Create standard key"}
          </button>
        </div>
      </section>

      <section className={sectionClass}>
        <h2 className={headingClass}>Agent API key</h2>
        <p className="mt-1 text-xs text-neutral-600">
          Write access. Authorizes an AI client (Claude, OpenAI, OpenClaw) to edit
          Festivus data via <code className="font-mono">PATCH /v1/write/*</code>.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <select
            aria-label="Agent vendor"
            className="rounded border border-neutral-300 px-3 py-2 text-sm"
            data-testid="agent-vendor"
            onChange={(e) => setAgentVendor(e.target.value as IAgentVendor)}
            value={agentVendor}
          >
            {AGENT_VENDORS.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </select>
          <input
            className="flex-1 rounded border border-neutral-300 px-3 py-2 text-sm"
            data-testid="agent-key-name"
            onChange={(e) => setAgentName(e.target.value)}
            placeholder="Name (e.g. my laptop)"
            type="text"
            value={agentName}
          />
          <button
            className="rounded bg-blueprint-navy px-4 py-2 text-sm font-medium text-white hover:bg-blueprint-navy/90 disabled:opacity-50"
            data-testid="create-agent-key"
            disabled={creating !== null || !agentName.trim()}
            onClick={() => void createAgent()}
            type="button"
          >
            {creating === "agent" ? "Creating..." : "Create agent key"}
          </button>
        </div>
      </section>

      {error && <p className="mt-4 text-sm text-red-700">{error}</p>}

      <section className={compact ? "mt-4" : "mt-8"}>
        <h2 className={headingClass}>Your keys</h2>
        {loading ? (
          <p className="mt-3 text-sm text-neutral-600">Loading...</p>
        ) : keys.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-600">
            No keys yet. Create one above to get started.
          </p>
        ) : (
          <>
            {keys.some((k) => !k.revoked_at && !k.owner_email) && (
              <div
                className="mt-3 rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900"
                data-testid="remint-banner"
              >
                <p className="font-medium">Some keys are missing notification emails.</p>
                <p className="mt-1">
                  Keys minted before the email-notification feature shipped don&apos;t
                  have an email on file. Re-mint them below to start receiving
                  &quot;queued for review&quot; and approval/rejection emails on edits
                  made with those keys. Revoke the old one once the new key is in use.
                </p>
              </div>
            )}
            <ul className="mt-3 divide-y divide-neutral-200 rounded border border-neutral-200 bg-white">
              {keys.map((k) => (
                <li className="flex items-center justify-between p-4" key={k.id}>
                  <div>
                    <p className="text-sm font-medium text-neutral-900">
                      {k.name ?? "(unnamed)"}
                      {k.revoked_at && (
                        <span className="ml-2 rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                          revoked
                        </span>
                      )}
                      {!k.revoked_at && !k.owner_email && (
                        <span
                          className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800"
                          data-testid={`no-email-badge-${k.id}`}
                          title="This key has no email on file — re-mint to get notifications"
                        >
                          no email
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-neutral-600">
                      tier: <span className="font-mono">{k.tier}</span> · created:{" "}
                      {new Date(k.created_at).toLocaleDateString()} · last used:{" "}
                      {k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : "never"}
                    </p>
                  </div>
                  {!k.revoked_at && (
                    <button
                      className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
                      data-testid={`revoke-button-${k.id}`}
                      onClick={() => void handleRevoke(k.id)}
                      type="button"
                    >
                      Revoke
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {plaintext && <KeyCreatedModal onClose={() => void handleModalClose()} plaintext={plaintext} />}
    </div>
  )
}
