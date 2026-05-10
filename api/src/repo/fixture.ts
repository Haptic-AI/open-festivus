import type { IEnvironment, IMutation } from "@festivus/types"
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

export interface IFixtureSeed {
  robots?: IDomainRecordMap["robots"][]
  policies?: IDomainRecordMap["policies"][]
  datasets?: IDomainRecordMap["datasets"][]
  benchmarks?: IDomainRecordMap["benchmarks"][]
  deploy_notes?: IDomainRecordMap["deploy_notes"][]
  environments?: IEnvironment[]
  tasks?: IDomainRecordMap["tasks"][]
  papers?: IDomainRecordMap["papers"][]
  hardware?: IDomainRecordMap["hardware"][]
  compatibility_edges?: IDomainRecordMap["compatibility_edges"][]
  laundry_compat_edges?: IDomainRecordMap["laundry_compat_edges"][]
}

export class FixtureRepo implements IRepository {
  private robots: IDomainRecordMap["robots"][]
  private policies: IDomainRecordMap["policies"][]
  private datasets: IDomainRecordMap["datasets"][]
  private benchmarks: IDomainRecordMap["benchmarks"][]
  private deploy_notes: IDomainRecordMap["deploy_notes"][]
  private environments: IEnvironment[]
  private tasks: IDomainRecordMap["tasks"][]
  private papers: IDomainRecordMap["papers"][]
  private hardware: IDomainRecordMap["hardware"][]
  private compatibility_edges: IDomainRecordMap["compatibility_edges"][]
  private laundry_compat_edges: IDomainRecordMap["laundry_compat_edges"][]
  private mutations: IMutation[] = []
  private mutationIdSeq = 1

  constructor(seed: IFixtureSeed = {}) {
    this.robots = seed.robots ?? []
    this.policies = seed.policies ?? []
    this.datasets = seed.datasets ?? []
    this.benchmarks = seed.benchmarks ?? []
    this.deploy_notes = seed.deploy_notes ?? []
    this.environments = seed.environments ?? []
    this.tasks = seed.tasks ?? []
    this.papers = seed.papers ?? []
    this.hardware = seed.hardware ?? []
    this.compatibility_edges = seed.compatibility_edges ?? []
    this.laundry_compat_edges = seed.laundry_compat_edges ?? []
  }

  async ping(): Promise<void> {}

  private table<K extends IDomainTable>(t: K): IDomainRecordMap[K][] {
    switch (t) {
      case "robots":
        return this.robots as IDomainRecordMap[K][]
      case "policies":
        return this.policies as IDomainRecordMap[K][]
      case "datasets":
        return this.datasets as IDomainRecordMap[K][]
      case "benchmarks":
        return this.benchmarks as IDomainRecordMap[K][]
      case "deploy_notes":
        return this.deploy_notes as IDomainRecordMap[K][]
      case "environments":
        return this.environments as IDomainRecordMap[K][]
      case "tasks":
        return this.tasks as IDomainRecordMap[K][]
      case "papers":
        return this.papers as IDomainRecordMap[K][]
      case "hardware":
        return this.hardware as IDomainRecordMap[K][]
      case "compatibility_edges":
        return this.compatibility_edges as IDomainRecordMap[K][]
      case "laundry_compat_edges":
        return this.laundry_compat_edges as IDomainRecordMap[K][]
      default: {
        const never: never = t
        throw new Error(`unknown table ${String(never)}`)
      }
    }
  }

  async list<K extends IDomainTable>(
    table: K,
    filters: IListFilters,
  ): Promise<IListResult<IDomainRecordMap[K]>> {
    const all = this.table(table)
    const filtered = filters.q
      ? all.filter((r) => JSON.stringify(r).toLowerCase().includes(filters.q!.toLowerCase()))
      : all
    const page = filtered.slice(filters.offset, filters.offset + filters.limit)
    return { count: filtered.length, results: page }
  }

  async getBySlug<K extends IDomainTable>(
    table: K,
    slug: string,
  ): Promise<IDomainRecordMap[K] | null> {
    const all = this.table(table)
    const found = all.find((r) => (r as { slug?: string }).slug === slug)
    return found ?? null
  }

  async listEnvironments(filters: IListFilters): Promise<IListResult<IEnvironment>> {
    // File-backed path for the existing /v1/environments route. Resolves
    // against the same in-memory seed as list("environments", ...) — they
    // are two names for the same data in fixture mode.
    const page = this.environments.slice(filters.offset, filters.offset + filters.limit)
    return { count: this.environments.length, results: page }
  }

  async stats(): Promise<IStats> {
    return {
      robots: this.robots.length,
      policies: this.policies.length,
      datasets: this.datasets.length,
      benchmarks: this.benchmarks.length,
      deploy_notes: this.deploy_notes.length,
      environments: this.environments.length,
      tasks: this.tasks.length,
      papers: this.papers.length,
      hardware: this.hardware.length,
      compatibility_edges: this.compatibility_edges.length,
      laundry_compat_edges: this.laundry_compat_edges.length,
    }
  }

  async upsertBySlug<K extends IDomainTable>(
    table: K,
    slug: string,
    data: IDomainRecordMap[K],
  ): Promise<IDomainRecordMap[K]> {
    const all = this.table(table)
    const idx = all.findIndex((r) => (r as { slug?: string }).slug === slug)
    const normalized = { ...(data as object), slug } as IDomainRecordMap[K]
    if (idx >= 0) {
      all[idx] = normalized
    } else {
      all.push(normalized)
    }
    return normalized
  }

  async patchBySlug<K extends IDomainTable>(
    table: K,
    slug: string,
    patch: Partial<IDomainRecordMap[K]>,
  ): Promise<IDomainRecordMap[K] | null> {
    const all = this.table(table)
    const idx = all.findIndex((r) => (r as { slug?: string }).slug === slug)
    if (idx < 0) return null
    const existing = all[idx]!
    const merged = { ...(existing as object), ...(patch as object), slug } as IDomainRecordMap[K]
    all[idx] = merged
    return merged
  }

  async deleteBySlug(table: IDomainTable, slug: string): Promise<boolean> {
    // Rebuild the array since table() returns a typed view. Use a switch
    // on the table name to mutate the right backing array.
    const before = this.table(table).length
    const filtered = this.table(table).filter((r) => (r as { slug?: string }).slug !== slug)
    if (filtered.length === before) return false
    switch (table) {
      case "robots": this.robots = filtered as IDomainRecordMap["robots"][]; break
      case "policies": this.policies = filtered as IDomainRecordMap["policies"][]; break
      case "datasets": this.datasets = filtered as IDomainRecordMap["datasets"][]; break
      case "benchmarks": this.benchmarks = filtered as IDomainRecordMap["benchmarks"][]; break
      case "deploy_notes": this.deploy_notes = filtered as IDomainRecordMap["deploy_notes"][]; break
      case "environments": this.environments = filtered as IEnvironment[]; break
      case "tasks": this.tasks = filtered as IDomainRecordMap["tasks"][]; break
      case "papers": this.papers = filtered as IDomainRecordMap["papers"][]; break
      case "hardware": this.hardware = filtered as IDomainRecordMap["hardware"][]; break
      case "compatibility_edges": this.compatibility_edges = filtered as IDomainRecordMap["compatibility_edges"][]; break
      case "laundry_compat_edges": this.laundry_compat_edges = filtered as IDomainRecordMap["laundry_compat_edges"][]; break
    }
    return true
  }

  async search(q: string, filters: IListFilters): Promise<IListResult<ISearchResult>> {
    const needle = q.toLowerCase()
    const hits: ISearchResult[] = []
    const tables: IDomainTable[] = [
      "robots",
      "policies",
      "datasets",
      "benchmarks",
      "tasks",
      "papers",
      "hardware",
    ]
    for (const t of tables) {
      for (const r of this.table(t)) {
        if (JSON.stringify(r).toLowerCase().includes(needle)) {
          hits.push({
            table: t,
            slug: (r as { slug: string }).slug,
            data: r as unknown as Record<string, unknown>,
          })
        }
      }
    }
    const page = hits.slice(filters.offset, filters.offset + filters.limit)
    return { count: hits.length, results: page }
  }

  // ── Mutation audit trail (in-memory) ────────────────────────────────

  async createMutation(input: ICreateMutationInput): Promise<IMutation> {
    const mutation: IMutation = {
      id: this.mutationIdSeq++,
      created_at: new Date().toISOString(),
      table_name: input.table_name,
      slug: input.slug,
      field_path: input.field_path,
      actor_id: input.actor_id,
      actor_email: input.actor_email ?? null,
      author_id: input.author_id ?? null,
      reason: input.reason ?? null,
      patch: input.patch,
      old_values: input.old_values,
      new_values: input.new_values,
      status: "pending_review",
      reviewed_by: null,
      reviewed_at: null,
      review_note: null,
    }
    this.mutations.push(mutation)
    return mutation
  }

  async listMutations(filters: IMutationFilters): Promise<IListResult<IMutation>> {
    let filtered = [...this.mutations]
    if (filters.status) filtered = filtered.filter((m) => m.status === filters.status)
    if (filters.table_name) filtered = filtered.filter((m) => m.table_name === filters.table_name)
    if (filters.slug) filtered = filtered.filter((m) => m.slug === filters.slug)
    if (filters.actor_id) filtered = filtered.filter((m) => m.actor_id === filters.actor_id)
    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    const page = filtered.slice(filters.offset, filters.offset + filters.limit)
    return { count: filtered.length, results: page }
  }

  async getMutation(id: number): Promise<IMutation | null> {
    return this.mutations.find((m) => m.id === id) ?? null
  }

  // Spec 027 phase 3. In fixture mode we treat actor_id as the user_id
  // directly — there's no api_keys table to join through. Tests that want
  // to exercise the real join live in the prisma parity suite.
  async countMutationsByUserSince(userId: string, sinceHours: number): Promise<number> {
    const cutoff = Date.now() - sinceHours * 60 * 60 * 1000
    return this.mutations.filter(
      (m) => m.actor_id === userId && new Date(m.created_at).getTime() > cutoff,
    ).length
  }

  async reviewMutation(
    id: number,
    action: "approve" | "reject" | "revert",
    reviewerId: string,
    note?: string,
  ): Promise<IMutation | null> {
    const idx = this.mutations.findIndex((m) => m.id === id)
    if (idx < 0) return null
    const mutation = this.mutations[idx]!

    // Spec 029 optimistic flow. Approve is status-only because the patch
    // went live at PATCH time. Reject and revert both restore old_values.
    if (action === "reject" || action === "revert") {
      const table = mutation.table_name as IDomainTable
      await this.patchBySlug(table, mutation.slug, mutation.old_values as never)
    }

    const statusMap = { approve: "approved", reject: "rejected", revert: "reverted" } as const
    mutation.status = statusMap[action]
    mutation.reviewed_by = reviewerId
    mutation.reviewed_at = new Date().toISOString()
    mutation.review_note = note ?? null

    return mutation
  }
}
