// Supabase Edge Function: mutation-notify
//
// Spec 027 phase 7. Called by a Database Webhook on every INSERT/UPDATE of
// the `mutations` table. Emails:
//   - On INSERT (new pending): moderator list.
//   - On UPDATE of `status`: the submitter, so they know if their edit landed.
//
// The Express API still fires notifyModerator() inline (belt + suspenders).
// This function becomes the primary path once prod has run it for a week
// without dropped emails; the inline caller then goes away.
//
// Deploy:
//   supabase functions deploy mutation-notify
//   supabase secrets set \
//     AWS_SES_REGION=us-east-2 \
//     AWS_ACCESS_KEY_ID=... \
//     AWS_SECRET_ACCESS_KEY=... \
//     SES_FROM_EMAIL=festivus@hapticlabs.ai \
//     MODERATOR_EMAILS=alice@example.com,bob@example.com \
//     WEBHOOK_SECRET=<random>
//
// Configure the Database Webhook in Supabase Studio → Integrations →
// Database Webhooks → "Create a new webhook" targeting this function.
// See docs/runbooks/mutation-notify-webhook.md for the full step list.

// @ts-ignore — Deno-provided global.
const env = (key: string): string | undefined => Deno.env.get(key)

interface IWebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE"
  table: string
  record: {
    id: number
    table_name: string
    slug: string
    status: string
    actor_id: string
    actor_email: string | null
    field_path: string
    old_values: Record<string, unknown>
    new_values: Record<string, unknown>
    reason: string | null
  }
  old_record?: IWebhookPayload["record"]
  schema: string
}

function moderatorEmails(): string[] {
  const raw = env("MODERATOR_EMAILS") ?? ""
  return raw.split(",").map((s) => s.trim()).filter(Boolean)
}

async function sendEmail(to: string[], subject: string, body: string): Promise<void> {
  // Placeholder. v1 keeps the Express API's notifyModerator() doing the
  // real SES send. This function logs so the webhook is wired end-to-end
  // and the runbook step-through can be validated.
  //
  // v2 replaces this body with an AWS SigV4-signed POST to
  // https://email.<region>.amazonaws.com/?Action=SendEmail ... using
  // AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY.
  console.log(JSON.stringify({ level: "info", event: "email.stub", to, subject, body_bytes: body.length }))
}

// @ts-ignore — Deno.serve provided at runtime.
Deno.serve(async (req: Request) => {
  // Shared-secret header check. The Database Webhook must include this
  // header verbatim; anything else is rejected.
  const providedSecret = req.headers.get("x-webhook-secret")
  const expectedSecret = env("WEBHOOK_SECRET")
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    })
  }

  let payload: IWebhookPayload
  try {
    payload = (await req.json()) as IWebhookPayload
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    })
  }

  if (payload.table !== "mutations") {
    return new Response(JSON.stringify({ ok: true, skipped: "not_mutations_table" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })
  }

  const { record } = payload

  if (payload.type === "INSERT") {
    const mods = moderatorEmails()
    const subject = `[Festivus moderate] ${record.table_name}/${record.slug} — ${record.field_path}`
    const body = [
      `New pending edit from ${record.actor_email ?? record.actor_id}`,
      ``,
      `Table: ${record.table_name}`,
      `Slug:  ${record.slug}`,
      `Field: ${record.field_path}`,
      ``,
      `Old: ${JSON.stringify(record.old_values)}`,
      `New: ${JSON.stringify(record.new_values)}`,
      ``,
      `Reason: ${record.reason ?? "(none)"}`,
      ``,
      `Review: https://festivus.hapticlabs.ai/moderate`,
    ].join("\n")
    await sendEmail(mods, subject, body)
    return new Response(JSON.stringify({ ok: true, sent_to: mods.length }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })
  }

  if (payload.type === "UPDATE" && payload.old_record && payload.old_record.status !== record.status) {
    const submitter = record.actor_email
    if (!submitter) {
      return new Response(
        JSON.stringify({ ok: true, skipped: "no_submitter_email" }),
        { status: 200, headers: { "content-type": "application/json" } },
      )
    }
    const verb = record.status === "approved" ? "approved" : record.status === "rejected" ? "rejected" : "updated"
    const subject = `[Festivus] your edit was ${verb}`
    const body = `Your edit to ${record.table_name}/${record.slug} (${record.field_path}) was ${verb}.`
    await sendEmail([submitter], subject, body)
    return new Response(JSON.stringify({ ok: true, sent_to: 1 }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })
  }

  return new Response(JSON.stringify({ ok: true, noop: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  })
})
