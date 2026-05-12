import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses"
import type { IMutation } from "@festivus/types"

const AWS_REGION = process.env["AWS_SES_REGION"] ?? "us-west-2"
const FROM_EMAIL = process.env["SES_FROM_EMAIL"] ?? "festivus@hapticlabs.ai"

// Moderator distribution list. Set MODERATOR_EMAILS in env (comma-split):
// e.g. `MODERATOR_EMAILS=a@example.com,b@example.com`. The legacy
// single-address MODERATOR_EMAIL env is still honoured for backwards compat
// but discouraged. When neither is set, notifyModerator no-ops (no shipped
// fallback list, so the codebase publishes cleanly without baking in any
// real addresses).
function moderatorRecipients(): string[] {
  const raw = process.env["MODERATOR_EMAILS"] ?? process.env["MODERATOR_EMAIL"]
  if (!raw) return []
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

/**
 * SES client. Credentials resolve via the standard AWS SDK chain:
 *   1. Env vars (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
 *   2. IAM instance role (on EC2)
 *   3. ~/.aws/credentials (local dev)
 *
 * Tags on the SES resource:
 *   service=ses, product=supabase-moderation, region=us-west-2, stage=production
 */
let sesClient: SESClient | null = null

function getSesClient(): SESClient {
  if (!sesClient) {
    sesClient = new SESClient({ region: AWS_REGION })
  }
  return sesClient
}

function sesTags() {
  return [
    { Name: "service", Value: "ses" },
    { Name: "product", Value: "supabase-moderation" },
    { Name: "region", Value: "us-west-2" },
    { Name: "stage", Value: "production" },
  ]
}

function sesEnabled(): boolean {
  return process.env["SES_ENABLED"] === "true"
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function valuesTable(vals: Record<string, unknown>): string {
  return JSON.stringify(vals, null, 2)
}

function mutationHeaderRows(mutation: IMutation, changedFields: string): string {
  const actor = `${mutation.actor_id}${mutation.actor_email ? ` (${escapeHtml(mutation.actor_email)})` : ""}`
  return `
      <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Table</td><td>${escapeHtml(mutation.table_name)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Record</td><td>${escapeHtml(mutation.slug)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Fields</td><td>${escapeHtml(changedFields)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Actor</td><td>${actor}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Reason</td><td>${escapeHtml(mutation.reason ?? "(none)")}</td></tr>
  `.trim()
}

/**
 * Moderator notification fired on every new PATCH submission. Goes to the
 * moderator distribution list. Non-blocking on the request path.
 */
export async function notifyModerator(mutation: IMutation): Promise<void> {
  if (!sesEnabled()) return

  const recipients = moderatorRecipients()
  if (recipients.length === 0) return

  const changedFields = mutation.field_path.split(",").join(", ")
  const subject = `[Festivus] Live edit · ${mutation.table_name}/${mutation.slug} (${changedFields})`

  const oldVals = valuesTable(mutation.old_values)
  const newVals = valuesTable(mutation.new_values)
  const webBase = (process.env["FESTIVUS_WEB_URL"] ?? "http://localhost:3000").replace(/\/$/, "")
  const moderateHref = `${webBase}/moderate#mutation-${mutation.id}`
  const recordHref = `${webBase}/data/${mutation.table_name}/${mutation.slug}`

  const html = `
    <h2>Live edit applied — review to keep or revert</h2>
    <p style="color:#555;font-size:13px;">
      The change is already live. Reject in the moderator panel to
      restore the previous value.
    </p>
    <p>
      <a href="${moderateHref}" style="display:inline-block;padding:8px 14px;background:#0a2540;color:#fff;text-decoration:none;border-radius:4px;font-weight:600;font-size:13px;">
        Review in moderator panel →
      </a>
      &nbsp;
      <a href="${recordHref}" style="color:#0a2540;font-size:13px;">View record</a>
    </p>
    <table style="border-collapse:collapse;font-family:monospace;font-size:14px;">
      ${mutationHeaderRows(mutation, changedFields)}
    </table>
    <h3>Before</h3>
    <pre style="background:#f4f4f4;padding:12px;border-radius:4px;">${escapeHtml(oldVals)}</pre>
    <h3>After</h3>
    <pre style="background:#f4f4f4;padding:12px;border-radius:4px;">${escapeHtml(newVals)}</pre>
    <p style="color:#888;font-size:12px;">
      Mutation #${mutation.id} &middot; ${escapeHtml(mutation.created_at)}<br/>
      API: <code>POST /v1/mutations/${mutation.id}/review</code>
    </p>
  `.trim()

  const command = new SendEmailCommand({
    Source: FROM_EMAIL,
    Destination: { ToAddresses: recipients },
    Message: {
      Subject: { Data: subject, Charset: "UTF-8" },
      Body: { Html: { Data: html, Charset: "UTF-8" } },
    },
    Tags: sesTags(),
  })

  await getSesClient().send(command)
}

/**
 * Submitter confirmation fired on every new PATCH submission. Goes to the
 * owner_email snapshotted on the api_keys row. No-ops when the mutation has
 * no actor_email (older keys minted before the owner_email column existed).
 */
export async function notifySubmitter(mutation: IMutation): Promise<void> {
  if (!sesEnabled()) return
  if (!mutation.actor_email) return

  const changedFields = mutation.field_path.split(",").join(", ")
  const subject = `[Festivus] Your edit to ${mutation.table_name}/${mutation.slug} is live`
  const newVals = valuesTable(mutation.new_values)

  const html = `
    <h2>Thanks — your edit is live</h2>
    <p>The change is already applied to the record. A moderator will review it
    and either keep it or revert. You'll get a second email if it's reverted.</p>
    <table style="border-collapse:collapse;font-family:monospace;font-size:14px;">
      ${mutationHeaderRows(mutation, changedFields)}
    </table>
    <h3>Proposed values</h3>
    <pre style="background:#f4f4f4;padding:12px;border-radius:4px;">${escapeHtml(newVals)}</pre>
    <p style="color:#888;font-size:12px;">
      Mutation #${mutation.id} &middot; ${escapeHtml(mutation.created_at)}<br/>
      Status: pending_review
    </p>
  `.trim()

  const command = new SendEmailCommand({
    Source: FROM_EMAIL,
    Destination: { ToAddresses: [mutation.actor_email] },
    Message: {
      Subject: { Data: subject, Charset: "UTF-8" },
      Body: { Html: { Data: html, Charset: "UTF-8" } },
    },
    Tags: sesTags(),
  })

  await getSesClient().send(command)
}

/**
 * Review-outcome notification fired after a moderator approves, rejects, or
 * reverts a mutation. Goes to the submitter (mutation.actor_email). No-ops
 * when the mutation has no actor_email.
 */
export async function notifyReviewOutcome(
  mutation: IMutation,
  action: "approve" | "reject" | "revert",
): Promise<void> {
  if (!sesEnabled()) return
  if (!mutation.actor_email) return

  const statusMap = { approve: "approved", reject: "rejected", revert: "reverted" } as const
  const status = statusMap[action]
  const headlineMap = {
    approve: "Your edit was approved and applied",
    reject: "Your edit was rejected",
    revert: "Your edit was reverted",
  } as const

  const changedFields = mutation.field_path.split(",").join(", ")
  const subject = `[Festivus] Edit ${status}: ${mutation.table_name}/${mutation.slug}`
  const newVals = valuesTable(mutation.new_values)
  const oldVals = valuesTable(mutation.old_values)

  const html = `
    <h2>${headlineMap[action]}</h2>
    <table style="border-collapse:collapse;font-family:monospace;font-size:14px;">
      ${mutationHeaderRows(mutation, changedFields)}
      <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Outcome</td><td>${status}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Moderator note</td><td>${escapeHtml(mutation.review_note ?? "(none)")}</td></tr>
    </table>
    <h3>Before</h3>
    <pre style="background:#f4f4f4;padding:12px;border-radius:4px;">${escapeHtml(oldVals)}</pre>
    <h3>Proposed</h3>
    <pre style="background:#f4f4f4;padding:12px;border-radius:4px;">${escapeHtml(newVals)}</pre>
    <p style="color:#888;font-size:12px;">
      Mutation #${mutation.id} &middot; reviewed at ${escapeHtml(mutation.reviewed_at ?? "")}
    </p>
  `.trim()

  const command = new SendEmailCommand({
    Source: FROM_EMAIL,
    Destination: { ToAddresses: [mutation.actor_email] },
    Message: {
      Subject: { Data: subject, Charset: "UTF-8" },
      Body: { Html: { Data: html, Charset: "UTF-8" } },
    },
    Tags: sesTags(),
  })

  await getSesClient().send(command)
}
