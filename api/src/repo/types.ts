import type {
  IBenchmarkRecord,
  ICompatibilityEdge,
  IDataset,
  IDeployNote,
  IEnvironment,
  IHardwareSKU,
  ILaundryCompatEdge,
  IMutation,
  IMutationStatus,
  IPaper,
  IPolicy,
  IRobot,
  ITask,
} from "@festivus/types"

export type IDomainTable =
  | "robots"
  | "policies"
  | "datasets"
  | "benchmarks"
  | "deploy_notes"
  | "environments"
  | "tasks"
  | "papers"
  | "hardware"
  | "compatibility_edges"
  | "laundry_compat_edges"

export interface IDomainRecordMap {
  robots: IRobot
  policies: IPolicy
  datasets: IDataset
  benchmarks: IBenchmarkRecord
  deploy_notes: IDeployNote
  environments: IEnvironment
  tasks: ITask
  papers: IPaper
  hardware: IHardwareSKU
  compatibility_edges: ICompatibilityEdge
  laundry_compat_edges: ILaundryCompatEdge
}

export interface IListFilters {
  limit: number
  offset: number
  q?: string
}

export interface IListResult<T> {
  count: number
  results: T[]
}

export interface IStats {
  robots: number
  policies: number
  datasets: number
  benchmarks: number
  deploy_notes: number
  environments: number
  tasks: number
  papers: number
  hardware: number
  compatibility_edges: number
  laundry_compat_edges: number
}

export interface ISearchResult {
  table: IDomainTable
  slug: string
  data: Record<string, unknown>
}

export interface IRepository {
  ping(): Promise<void>
  list<K extends IDomainTable>(table: K, filters: IListFilters): Promise<IListResult<IDomainRecordMap[K]>>
  getBySlug<K extends IDomainTable>(table: K, slug: string): Promise<IDomainRecordMap[K] | null>
  listEnvironments(filters: IListFilters): Promise<IListResult<IEnvironment>>
  stats(): Promise<IStats>
  search(q: string, filters: IListFilters): Promise<IListResult<ISearchResult>>

  // Write surface. Added for spec 021's CRUD push path — lets holders of a
  // write-tier API key upsert / patch / delete any JSONB record by slug.
  //
  // upsertBySlug:  PUT semantics — replace the whole `data` blob for the slug
  //                (create if it doesn't exist).
  // patchBySlug:   PATCH semantics — shallow-merge the incoming JSON into the
  //                existing `data` blob. Null values clear fields.
  // deleteBySlug:  DELETE semantics — remove the row; returns true if a row
  //                was actually deleted, false if the slug was already missing.
  upsertBySlug<K extends IDomainTable>(
    table: K,
    slug: string,
    data: IDomainRecordMap[K],
  ): Promise<IDomainRecordMap[K]>
  patchBySlug<K extends IDomainTable>(
    table: K,
    slug: string,
    patch: Partial<IDomainRecordMap[K]>,
  ): Promise<IDomainRecordMap[K] | null>
  deleteBySlug(table: IDomainTable, slug: string): Promise<boolean>

  // Mutation audit trail. Every PATCH creates a mutation row that lands
  // in pending_review. Moderators can approve, reject, or revert.
  createMutation(input: ICreateMutationInput): Promise<IMutation>
  listMutations(filters: IMutationFilters): Promise<IListResult<IMutation>>
  getMutation(id: number): Promise<IMutation | null>
  reviewMutation(
    id: number,
    action: "approve" | "reject" | "revert",
    reviewerId: string,
    note?: string,
  ): Promise<IMutation | null>

  // Spec 027 phase 3: count mutations by a given user in the last N hours.
  // Used by the rate-limit middleware to enforce 200 writes / 24h / user.
  // Joins mutations.actor_id::int → api_keys.id → api_keys.user_id so the
  // cap spans every key the user has minted.
  countMutationsByUserSince(userId: string, sinceHours: number): Promise<number>
}

export interface ICreateMutationInput {
  table_name: IDomainTable
  slug: string
  field_path: string
  actor_id: string
  actor_email?: string
  // Canonical users.id (spec 029). Optional for backwards compatibility with
  // older callers; new code should always pass it.
  author_id?: string | null
  reason?: string
  patch: Record<string, unknown>
  old_values: Record<string, unknown>
  new_values: Record<string, unknown>
}

export interface IMutationFilters {
  limit: number
  offset: number
  status?: IMutationStatus
  table_name?: IDomainTable
  slug?: string
  actor_id?: string
}
