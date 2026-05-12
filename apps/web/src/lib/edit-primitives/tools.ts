/**
 * Anthropic tool definitions for the Festivus Agent chat (spec 029).
 *
 * Three tools: list_candidates -> propose_edit -> apply_edit.
 * Every tool call is rate-limited and audited downstream. The agent
 * may only edit fields present in `AGENT_EDITABLE_FIELDS` — the server
 * rejects anything else via the Zod gate in
 * `api/src/validation/patch-schemas.ts`.
 */

import { AGENT_EDITABLE_FIELDS, AGENT_EDITABLE_TABLES, type IAgentEditableTable } from "./allowlist"

/** Minimal subset of Anthropic's tool shape (input_schema is raw JSON Schema). */
export interface IAgentTool {
  name: string
  description: string
  input_schema: Record<string, unknown>
}

const TABLE_ENUM = [...AGENT_EDITABLE_TABLES]

/**
 * Build the tool definitions used by the Anthropic Messages API. A
 * single `field` string is constrained by enum per-table inside
 * `description` rather than via a `oneOf` of (table, field) pairs —
 * Claude reliably pattern-matches this shape without the JSON-Schema
 * oneOf blowup (spec 029 § Token / context budget).
 */
export function buildTools(): IAgentTool[] {
  return [
    {
      name: "list_candidates",
      description:
        "Find rows on a domain table where a specific field is null, missing, or stale. Use this first to show the user concrete candidates before proposing an edit. Returns up to `limit` rows with their slug, name, and current value.",
      input_schema: {
        type: "object",
        properties: {
          table: {
            type: "string",
            enum: TABLE_ENUM,
            description: "Which domain table to search.",
          },
          field: {
            type: "string",
            description:
              "The field to search for nulls / missing values. Must be one of the agent-editable fields for the chosen table; see tool description for the per-table list.",
          },
          limit: {
            type: "integer",
            minimum: 1,
            maximum: 25,
            default: 10,
            description: "Max rows to return. Keep small to stay under token budget.",
          },
        },
        required: ["table", "field"],
      },
    },
    {
      name: "propose_edit",
      description:
        "Draft an edit to a single scalar field on a single row. The edit is not applied — it is returned as a confirmation_token the user must approve before you call apply_edit. Always ask the user before calling apply_edit.",
      input_schema: {
        type: "object",
        properties: {
          table: {
            type: "string",
            enum: TABLE_ENUM,
            description: "Which domain table the row lives on.",
          },
          slug: {
            type: "string",
            description: "Unique slug identifier for the row (e.g. 'boston-dynamics-atlas').",
          },
          field: {
            type: "string",
            description:
              "The field to edit. Must be one of the agent-editable scalar fields for the chosen table. Server rejects name, slug, *_id, hf_*, arrays, and nested objects with field_not_agent_editable.",
          },
          value: {
            description: "The new value. Type must match the field's declared type (number, string, bool, enum, or null).",
          },
          reason: {
            type: "string",
            description: "Short justification the moderator sees when reviewing. Plain prose, one sentence.",
          },
        },
        required: ["table", "slug", "field", "value"],
      },
    },
    {
      name: "apply_edit",
      description:
        "Submit a previously-proposed edit for moderation. Only call this after the user explicitly confirms. The edit goes into pending_review and generates a moderator email; it is NOT immediately live.",
      input_schema: {
        type: "object",
        properties: {
          confirmation_token: {
            type: "string",
            description: "The opaque token returned by propose_edit. Short-lived (5 min). Verified server-side.",
          },
        },
        required: ["confirmation_token"],
      },
    },
  ]
}

/**
 * Per-table allowlist preamble for the system prompt. Claude reads this
 * before the first user turn and uses it to pick valid fields for
 * list_candidates and propose_edit.
 */
export function buildAllowlistPreamble(): string {
  const lines: string[] = ["## Per-table agent-editable fields"]
  for (const table of AGENT_EDITABLE_TABLES) {
    const fields = AGENT_EDITABLE_FIELDS[table as IAgentEditableTable]
    lines.push(`- **${table}**: ${fields.join(", ")}`)
  }
  return lines.join("\n")
}
