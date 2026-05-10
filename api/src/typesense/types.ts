/**
 * Typesense types we care about. Trimmed to the surface this client uses —
 * full schema reference: https://typesense.org/docs/0.25.2/api/
 */

export interface ITypesenseField {
  name: string
  type:
    | "string"
    | "string[]"
    | "int32"
    | "int64"
    | "float"
    | "bool"
    | "auto"
  facet?: boolean
  optional?: boolean
  index?: boolean
  /** Set false to keep the field on disk but skip search — useful for `data` blob. */
  sort?: boolean
}

export interface ITypesenseCollectionSchema {
  name: string
  fields: ITypesenseField[]
  default_sorting_field?: string
}

export interface ITypesenseDocument extends Record<string, unknown> {
  id: string
}

export interface ITypesenseSearchRequest {
  collection: string
  q: string
  query_by: string
  /** Comma-separated list — default 10. */
  per_page?: number
  page?: number
  sort_by?: string
  filter_by?: string
  /** Highlight in addition to matching — default off. */
  highlight_full_fields?: string
}

export interface ITypesenseSearchHit {
  document: ITypesenseDocument
  highlights?: { field: string; snippet: string }[]
  text_match?: number
}
