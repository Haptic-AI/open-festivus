/**
 * Bridge between the API's domain records and Typesense documents.
 *
 * `flattenForSearch` walks a JSONB blob and pulls the searchable strings into
 * the standard schema slots (name/description/summary/tags) — the rest of the
 * record rides along verbatim in `data` so search results carry enough info
 * for the UI without a follow-up GET.
 */
import type { IDomainTable } from "../repo/types.js"
import type { ITypesenseClient } from "./client.js"
import { collectionFor, SEARCHABLE_TABLES } from "./schemas.js"
import type { ITypesenseDocument } from "./types.js"

export function isSearchable(table: IDomainTable): boolean {
  return (SEARCHABLE_TABLES as readonly string[]).includes(table)
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined
}

function asStringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined
  const out = v.filter((x): x is string => typeof x === "string" && x.length > 0)
  return out.length > 0 ? out : undefined
}

/** Stable, deterministic Typesense document id for any (table, slug) pair. */
export function documentId(table: IDomainTable, slug: string): string {
  return `${table}:${slug}`
}

/**
 * Flatten a domain record into a Typesense document. Pulls the common search
 * fields out of the JSONB blob and stashes the original under `data` so the
 * /v1/search route can return ISearchResult-shaped hits.
 *
 * For tables without a top-level `name` (e.g. compatibility-style edges) we
 * fall back to deterministic combinations so the doc still has something
 * discoverable.
 */
export function flattenForSearch(
  table: IDomainTable,
  slug: string,
  record: Record<string, unknown>,
): ITypesenseDocument {
  const name =
    asString(record["name"]) ??
    asString(record["title"]) ??
    asString(record["display_name"])
  const description =
    asString(record["description"]) ??
    asString(record["overview"])
  const summary =
    asString(record["summary"]) ??
    asString(record["one_liner"]) ??
    asString(record["caption"])
  const tags =
    asStringArray(record["tags"]) ??
    asStringArray(record["keywords"]) ??
    asStringArray(record["topics"])

  const doc: ITypesenseDocument = {
    id: documentId(table, slug),
    slug,
    table,
    data: record,
  }
  if (name) doc["name"] = name
  if (description) doc["description"] = description
  if (summary) doc["summary"] = summary
  if (tags) doc["tags"] = tags
  return doc
}

/**
 * Best-effort upsert. Errors are logged + swallowed so a Typesense outage
 * never blocks a domain write — eventual consistency is restored by the
 * next backfill run.
 */
export async function syncUpsert(
  client: ITypesenseClient,
  table: IDomainTable,
  slug: string,
  record: Record<string, unknown>,
): Promise<void> {
  if (!isSearchable(table)) return
  try {
    const doc = flattenForSearch(table, slug, record)
    await client.upsertDocument(collectionFor(table), doc)
  } catch (err) {
    console.warn(`typesense.syncUpsert failed for ${table}/${slug}:`, err)
  }
}

export async function syncDelete(
  client: ITypesenseClient,
  table: IDomainTable,
  slug: string,
): Promise<void> {
  if (!isSearchable(table)) return
  try {
    await client.deleteDocument(collectionFor(table), documentId(table, slug))
  } catch (err) {
    console.warn(`typesense.syncDelete failed for ${table}/${slug}:`, err)
  }
}
