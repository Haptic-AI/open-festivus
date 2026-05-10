import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"

/**
 * HMAC-signed confirmation token (spec 029). The chat server hands the
 * browser an opaque string — the browser echoes it back to confirm the
 * edit — the server verifies and extracts { table, slug, field, value,
 * user_id }. 5-minute TTL so a lingering browser can't replay an edit
 * after the user's attention has moved on.
 *
 * Token shape: `<base64url(payload-json)>.<base64url(hmac(payload))>`.
 * Symmetric HMAC because only the chat server creates + verifies.
 */

const TOKEN_TTL_MS = 5 * 60 * 1000

export interface IConfirmationPayload {
  table: string
  slug: string
  field: string
  value: unknown
  user_id: string
  nonce: string
  exp: number
}

function secret(): Buffer {
  const raw = process.env["FESTIVUS_AGENT_CHAT_SECRET"]
  if (raw && raw.length >= 32) return Buffer.from(raw, "utf-8")
  // Dev fallback: derive from another high-entropy local secret so tokens
  // remain valid within a single process lifetime but don't leak in CI
  // transcripts. Production MUST set FESTIVUS_AGENT_CHAT_SECRET.
  const fallback = process.env["CLERK_SECRET_KEY"] ?? process.env["ANTHROPIC_API_KEY"] ?? ""
  if (fallback.length >= 32) return Buffer.from(fallback, "utf-8")
  throw new Error(
    "FESTIVUS_AGENT_CHAT_SECRET is not set and no fallback secret with >=32 chars is available",
  )
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4))
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64")
}

export function signConfirmationToken(
  payload: Omit<IConfirmationPayload, "nonce" | "exp">,
  now: number = Date.now(),
): string {
  const full: IConfirmationPayload = {
    ...payload,
    nonce: randomBytes(8).toString("hex"),
    exp: now + TOKEN_TTL_MS,
  }
  const payloadB64 = b64url(Buffer.from(JSON.stringify(full), "utf-8"))
  const sig = createHmac("sha256", secret()).update(payloadB64).digest()
  return `${payloadB64}.${b64url(sig)}`
}

export type IVerifyResult =
  | { ok: true; payload: IConfirmationPayload }
  | { ok: false; reason: "malformed" | "bad_signature" | "expired" }

export function verifyConfirmationToken(token: string, now: number = Date.now()): IVerifyResult {
  const parts = token.split(".")
  if (parts.length !== 2) return { ok: false, reason: "malformed" }
  const [payloadB64, sigB64] = parts as [string, string]

  const expectedSig = createHmac("sha256", secret()).update(payloadB64).digest()
  const actualSig = b64urlDecode(sigB64)
  if (expectedSig.length !== actualSig.length) return { ok: false, reason: "bad_signature" }
  if (!timingSafeEqual(expectedSig, actualSig)) return { ok: false, reason: "bad_signature" }

  let payload: IConfirmationPayload
  try {
    payload = JSON.parse(b64urlDecode(payloadB64).toString("utf-8")) as IConfirmationPayload
  } catch {
    return { ok: false, reason: "malformed" }
  }
  if (typeof payload.exp !== "number" || payload.exp < now) {
    return { ok: false, reason: "expired" }
  }
  return { ok: true, payload }
}
