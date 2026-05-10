/**
 * Per-table Typesense collection schemas.
 *
 * One collection per searchable table; the union covers everything that
 * `repo.search()` was scanning over. Each doc has a stable `id` =
 * `${table}:${slug}` so dual-write upserts and deletes can target it without
 * an extra lookup.
 *
 * Fields:
 *   - `name` / `description` / `summary` / `tags` are the searched-by columns.
 *   - `slug`, `table` are filterable scalars.
 *   - `data` (auto, no-index) holds the original JSONB blob so the search
 *     route can return the same `ISearchResult.data` shape without a Postgres
 *     round-trip per hit.
 */
import type { IDomainTable } from "../repo/types.js"
import type { ITypesenseCollectionSchema } from "./types.js"

export const SEARCHABLE_TABLES: readonly IDomainTable[] = [
  "robots",
  "policies",
  "datasets",
  "benchmarks",
  "tasks",
  "papers",
  "hardware",
  "laundry_compat_edges",
] as const

/** Every collection shares this base shape — keeps multi_search uniform. */
function baseFields(): ITypesenseCollectionSchema["fields"] {
  return [
    { name: "slug", type: "string", facet: true },
    { name: "table", type: "string", facet: true },
    { name: "name", type: "string", optional: true },
    { name: "description", type: "string", optional: true },
    { name: "summary", type: "string", optional: true },
    { name: "tags", type: "string[]", optional: true, facet: true },
    // Original record. `auto` lets Typesense store arbitrary JSON without
    // schema-validating every nested key. `index: false` keeps the field
    // available on hits but out of the inverted index (saves RAM).
    { name: "data", type: "auto", optional: true, index: false },
  ]
}

/** Resolve a Typesense collection name from a domain table name. */
export function collectionFor(table: IDomainTable): string {
  return `festivus_${table}`
}

export function schemaFor(table: IDomainTable): ITypesenseCollectionSchema {
  return {
    name: collectionFor(table),
    fields: baseFields(),
  }
}

export function allSchemas(): ITypesenseCollectionSchema[] {
  return SEARCHABLE_TABLES.map(schemaFor)
}
