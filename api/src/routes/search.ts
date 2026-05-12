import { Router } from "express"
import type { IPaginatedResponse } from "@festivus/types"
import type { IDomainTable, IRepository, ISearchResult } from "../repo/types.js"
import type { ITypesenseClient } from "../typesense/client.js"
import { collectionFor, SEARCHABLE_TABLES } from "../typesense/schemas.js"
import { parseListFilters } from "./_factory.js"

interface IBuildSearchOptions {
  /** When provided, search runs against Typesense. Otherwise falls back to repo.search. */
  typesense?: ITypesenseClient | null
}

const QUERY_BY = "name,description,summary,tags" as const

/**
 * GET /v1/search?q=&limit=&offset=
 *
 * Backed by Typesense when configured (TYPESENSE_HOST etc set). Falls back
 * to the Postgres-based repo.search when Typesense is unavailable so local
 * dev without the search box stays functional.
 */
export function buildSearchRouter(
  repo: IRepository,
  options: IBuildSearchOptions = {},
): Router {
  const router = Router()
  router.get("/", async (req, res, next) => {
    try {
      const q = typeof req.query["q"] === "string" ? (req.query["q"] as string) : ""
      if (!q) {
        res.status(400).json({ error: "missing_query", message: "?q= is required" })
        return
      }
      const filters = parseListFilters(req.query as Record<string, unknown>)

      // Optional `tables` filter — comma-separated list of domain tables.
      // Defaults to every searchable table.
      const tablesParam = typeof req.query["tables"] === "string" ? (req.query["tables"] as string) : ""
      const tables = parseTablesParam(tablesParam)

      if (options.typesense) {
        const body = await searchTypesense(options.typesense, q, filters, tables)
        res.json(body)
        return
      }

      const { count, results } = await repo.search(q, filters)
      const body: IPaginatedResponse<ISearchResult> = {
        count,
        limit: filters.limit,
        offset: filters.offset,
        results,
      }
      res.json(body)
    } catch (err) {
      next(err)
    }
  })
  return router
}

function parseTablesParam(raw: string): readonly IDomainTable[] {
  if (!raw) return SEARCHABLE_TABLES
  const requested = raw.split(",").map((s) => s.trim()).filter(Boolean)
  const valid = requested.filter((t): t is IDomainTable =>
    (SEARCHABLE_TABLES as readonly string[]).includes(t),
  )
  return valid.length > 0 ? valid : SEARCHABLE_TABLES
}

async function searchTypesense(
  client: ITypesenseClient,
  q: string,
  filters: { limit: number; offset: number },
  tables: readonly IDomainTable[],
): Promise<IPaginatedResponse<ISearchResult>> {
  // Per-collection fan-out via multi_search. We pull `limit + offset` per
  // collection so cross-collection pagination on the merged list still works
  // for typical first-page reads. (Deep pagination beyond a few hundred is
  // not yet a use case.)
  const perPage = Math.max(filters.limit + filters.offset, filters.limit)
  const requests = tables.map((t) => ({
    collection: collectionFor(t),
    q,
    query_by: QUERY_BY,
    per_page: perPage,
  }))

  const grouped = await client.multiSearch(requests)

  type IRanked = { result: ISearchResult; score: number }
  const ranked: IRanked[] = []
  grouped.forEach((hits, idx) => {
    const table = tables[idx]
    if (!table) return
    for (const h of hits) {
      const slug = typeof h.document["slug"] === "string" ? h.document["slug"] : null
      const data = h.document["data"]
      if (!slug || typeof data !== "object" || data === null) continue
      ranked.push({
        result: {
          table,
          slug,
          data: data as Record<string, unknown>,
        },
        score: h.text_match ?? 0,
      })
    }
  })

  // Highest match first. Stable enough since text_match already incorporates
  // term overlap + position; ties fall back to insertion order.
  ranked.sort((a, b) => b.score - a.score)

  const page = ranked.slice(filters.offset, filters.offset + filters.limit)
  return {
    count: ranked.length,
    limit: filters.limit,
    offset: filters.offset,
    results: page.map((r) => r.result),
  }
}
