/**
 * Decorator around any IRepository that mirrors writes into Typesense.
 *
 * Why a decorator instead of touching PrismaRepo directly?
 *   - PrismaRepo stays single-purpose (Postgres only).
 *   - FixtureRepo (tests) stays untouched — tests don't need Typesense.
 *   - Live edits go through the same code path as a one-time backfill.
 *
 * Live-edit semantics:
 *   - upsertBySlug → fire-and-forget upsert into Typesense.
 *   - patchBySlug → fire-and-forget upsert with the merged record (we read
 *     the result of the underlying patch so the doc reflects the live row).
 *   - deleteBySlug → fire-and-forget delete (404 swallowed).
 *
 * Errors are logged but never thrown — the source of truth is Postgres, and
 * we never want a Typesense hiccup to fail a write request. The next
 * `pnpm typesense:backfill` run reconciles drift.
 */
import type {
  ICreateMutationInput,
  IDomainRecordMap,
  IDomainTable,
  IListFilters,
  IListResult,
  IMutationFilters,
  IRepository,
  ISearchResult,
  IStats,
} from "./types.js"
import type { IEnvironment, IMutation } from "@festivus/types"
import type { ITypesenseClient } from "../typesense/client.js"
import { syncDelete, syncUpsert } from "../typesense/sync.js"

export class TypesenseDecoratedRepo implements IRepository {
  constructor(
    private readonly inner: IRepository,
    private readonly typesense: ITypesenseClient,
  ) {}

  ping(): Promise<void> {
    return this.inner.ping()
  }
  list<K extends IDomainTable>(table: K, filters: IListFilters): Promise<IListResult<IDomainRecordMap[K]>> {
    return this.inner.list(table, filters)
  }
  getBySlug<K extends IDomainTable>(table: K, slug: string): Promise<IDomainRecordMap[K] | null> {
    return this.inner.getBySlug(table, slug)
  }
  listEnvironments(filters: IListFilters): Promise<IListResult<IEnvironment>> {
    return this.inner.listEnvironments(filters)
  }
  stats(): Promise<IStats> {
    return this.inner.stats()
  }
  search(q: string, filters: IListFilters): Promise<IListResult<ISearchResult>> {
    return this.inner.search(q, filters)
  }

  async upsertBySlug<K extends IDomainTable>(
    table: K,
    slug: string,
    data: IDomainRecordMap[K],
  ): Promise<IDomainRecordMap[K]> {
    const result = await this.inner.upsertBySlug(table, slug, data)
    void syncUpsert(
      this.typesense,
      table,
      slug,
      result as unknown as Record<string, unknown>,
    )
    return result
  }

  async patchBySlug<K extends IDomainTable>(
    table: K,
    slug: string,
    patch: Partial<IDomainRecordMap[K]>,
  ): Promise<IDomainRecordMap[K] | null> {
    const result = await this.inner.patchBySlug(table, slug, patch)
    if (result) {
      void syncUpsert(
        this.typesense,
        table,
        slug,
        result as unknown as Record<string, unknown>,
      )
    }
    return result
  }

  async deleteBySlug(table: IDomainTable, slug: string): Promise<boolean> {
    const ok = await this.inner.deleteBySlug(table, slug)
    if (ok) {
      void syncDelete(this.typesense, table, slug)
    }
    return ok
  }

  createMutation(input: ICreateMutationInput): Promise<IMutation> {
    return this.inner.createMutation(input)
  }
  listMutations(filters: IMutationFilters): Promise<IListResult<IMutation>> {
    return this.inner.listMutations(filters)
  }
  getMutation(id: number): Promise<IMutation | null> {
    return this.inner.getMutation(id)
  }
  reviewMutation(
    id: number,
    action: "approve" | "reject" | "revert",
    reviewerId: string,
    note?: string,
  ): Promise<IMutation | null> {
    return this.inner.reviewMutation(id, action, reviewerId, note)
  }
  countMutationsByUserSince(userId: string, sinceHours: number): Promise<number> {
    return this.inner.countMutationsByUserSince(userId, sinceHours)
  }
}
