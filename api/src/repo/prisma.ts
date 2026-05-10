import { PrismaClient } from "@prisma/client"
import type { IEnvironment } from "@festivus/types"
import type { IMutation } from "@festivus/types"
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

// Tables safe to interpolate into raw SQL. Anything not in this set must
// never reach $queryRawUnsafe — the table name is the only dynamic piece of
// the queries below and is gated here, not by caller trust.
const TABLES: readonly IDomainTable[] = [
  "robots",
  "policies",
  "datasets",
  "benchmarks",
  "deploy_notes",
  "environments",
  "tasks",
  "papers",
  "hardware",
  "compatibility_edges",
  "laundry_compat_edges",
] as const

const SEARCHABLE_TABLES: readonly IDomainTable[] = [
  "robots",
  "policies",
  "datasets",
  "benchmarks",
  "tasks",
  "papers",
  "hardware",
  "laundry_compat_edges",
] as const

function assertTable(t: string): asserts t is IDomainTable {
  if (!TABLES.includes(t as IDomainTable)) {
    throw new Error(`unknown table: ${t}`)
  }
}

interface IDelegate {
  findMany: (args: {
    skip: number
    take: number
    orderBy: { id: "asc" }
  }) => Promise<{ data: unknown }[]>
  findUnique: (args: { where: { slug: string } }) => Promise<{ data: unknown } | null>
  count: () => Promise<number>
  upsert: (args: {
    where: { slug: string }
    create: { slug: string; data: unknown }
    update: { data: unknown }
  }) => Promise<{ data: unknown }>
  update: (args: {
    where: { slug: string }
    data: { data: unknown }
  }) => Promise<{ data: unknown }>
  delete: (args: { where: { slug: string } }) => Promise<{ data: unknown }>
}

export class PrismaRepo implements IRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly environments: IEnvironment[],
  ) {}

  async ping(): Promise<void> {
    await this.prisma.$queryRawUnsafe("SELECT 1")
  }

  private delegate(table: IDomainTable): IDelegate {
    // Prisma's generated client exposes each model as a camelCase-ish
    // property. For our snake_case model names the property is identical.
    const client = this.prisma as unknown as Record<string, IDelegate>
    const d = client[table]
    if (!d) throw new Error(`prisma delegate not found for table: ${table}`)
    return d
  }

  async list<K extends IDomainTable>(
    table: K,
    filters: IListFilters,
  ): Promise<IListResult<IDomainRecordMap[K]>> {
    assertTable(table)

    // With a q filter we need tsvector matching, which Prisma has no native
    // support for. Fall back to raw SQL — same semantics as the old repo.
    if (filters.q) {
      const countRows = await this.prisma.$queryRawUnsafe<{ count: bigint }[]>(
        `SELECT COUNT(*)::bigint AS count FROM "${table}" WHERE search_text @@ plainto_tsquery('english', $1)`,
        filters.q,
      )
      const count = Number(countRows[0]?.count ?? 0n)
      const rows = await this.prisma.$queryRawUnsafe<{ data: IDomainRecordMap[K] }[]>(
        `SELECT data FROM "${table}" WHERE search_text @@ plainto_tsquery('english', $1) ORDER BY id LIMIT $2 OFFSET $3`,
        filters.q,
        filters.limit,
        filters.offset,
      )
      return { count, results: rows.map((r) => r.data) }
    }

    const d = this.delegate(table)
    const [count, rows] = await Promise.all([
      d.count(),
      d.findMany({
        skip: filters.offset,
        take: filters.limit,
        orderBy: { id: "asc" },
      }),
    ])
    return {
      count,
      results: rows.map((r) => r.data as IDomainRecordMap[K]),
    }
  }

  async getBySlug<K extends IDomainTable>(
    table: K,
    slug: string,
  ): Promise<IDomainRecordMap[K] | null> {
    assertTable(table)
    const row = await this.delegate(table).findUnique({ where: { slug } })
    if (!row) return null
    return row.data as IDomainRecordMap[K]
  }

  async listEnvironments(filters: IListFilters): Promise<IListResult<IEnvironment>> {
    const page = this.environments.slice(filters.offset, filters.offset + filters.limit)
    return { count: this.environments.length, results: page }
  }

  async stats(): Promise<IStats> {
    const counts = await Promise.all(TABLES.map((t) => this.delegate(t).count()))
    const out = {} as IStats
    TABLES.forEach((t, i) => {
      out[t] = counts[i] ?? 0
    })
    return out
  }

  async upsertBySlug<K extends IDomainTable>(
    table: K,
    slug: string,
    data: IDomainRecordMap[K],
  ): Promise<IDomainRecordMap[K]> {
    assertTable(table)
    const row = await this.delegate(table).upsert({
      where: { slug },
      create: { slug, data: data as unknown },
      update: { data: data as unknown },
    })
    return row.data as IDomainRecordMap[K]
  }

  async patchBySlug<K extends IDomainTable>(
    table: K,
    slug: string,
    patch: Partial<IDomainRecordMap[K]>,
  ): Promise<IDomainRecordMap[K] | null> {
    assertTable(table)
    // Shallow-merge: fetch current, spread patch over it, write back. Keeps
    // semantics predictable for JSONB blobs where a deep merge would surprise
    // callers that pass `tags: []` intending to clear the array.
    const current = await this.delegate(table).findUnique({ where: { slug } })
    if (!current) return null
    const merged = {
      ...(current.data as Record<string, unknown>),
      ...(patch as Record<string, unknown>),
      slug,
    } as unknown as IDomainRecordMap[K]
    const row = await this.delegate(table).update({
      where: { slug },
      data: { data: merged as unknown },
    })
    return row.data as IDomainRecordMap[K]
  }

  async deleteBySlug(table: IDomainTable, slug: string): Promise<boolean> {
    assertTable(table)
    try {
      await this.delegate(table).delete({ where: { slug } })
      return true
    } catch (err) {
      // Prisma throws P2025 when the record to delete does not exist.
      // Surface that as "not deleted" rather than a 500.
      const code = (err as { code?: string }).code
      if (code === "P2025") return false
      throw err
    }
  }

  async search(q: string, filters: IListFilters): Promise<IListResult<ISearchResult>> {
    const hits: ISearchResult[] = []
    let count = 0
    for (const t of SEARCHABLE_TABLES) {
      const countRows = await this.prisma.$queryRawUnsafe<{ count: bigint }[]>(
        `SELECT COUNT(*)::bigint AS count FROM "${t}" WHERE search_text @@ plainto_tsquery('english', $1)`,
        q,
      )
      count += Number(countRows[0]?.count ?? 0n)
      const rows = await this.prisma.$queryRawUnsafe<{
        slug: string
        data: Record<string, unknown>
      }[]>(
        `SELECT slug, data FROM "${t}" WHERE search_text @@ plainto_tsquery('english', $1) ORDER BY id LIMIT 100`,
        q,
      )
      for (const r of rows) {
        hits.push({ table: t, slug: r.slug, data: r.data })
      }
    }
    const page = hits.slice(filters.offset, filters.offset + filters.limit)
    return { count, results: page }
  }

  // ── Mutation audit trail ────────────────────────────────────────────

  private toIMutation(row: {
    id: number
    created_at: Date
    table_name: string
    slug: string
    field_path: string
    actor_id: string
    actor_email: string | null
    author_id: string | null
    reason: string | null
    patch: unknown
    old_values: unknown
    new_values: unknown
    status: string
    reviewed_by: string | null
    reviewed_at: Date | null
    review_note: string | null
  }): IMutation {
    return {
      id: row.id,
      created_at: row.created_at.toISOString(),
      table_name: row.table_name,
      slug: row.slug,
      field_path: row.field_path,
      actor_id: row.actor_id,
      actor_email: row.actor_email,
      author_id: row.author_id,
      reason: row.reason,
      patch: row.patch as Record<string, unknown>,
      old_values: row.old_values as Record<string, unknown>,
      new_values: row.new_values as Record<string, unknown>,
      status: row.status as IMutation["status"],
      reviewed_by: row.reviewed_by,
      reviewed_at: row.reviewed_at?.toISOString() ?? null,
      review_note: row.review_note,
    }
  }

  async createMutation(input: ICreateMutationInput): Promise<IMutation> {
    const row = await this.prisma.mutations.create({
      data: {
        table_name: input.table_name,
        slug: input.slug,
        field_path: input.field_path,
        actor_id: input.actor_id,
        actor_email: input.actor_email ?? null,
        author_id: input.author_id ?? null,
        reason: input.reason ?? null,
        patch: input.patch as never,
        old_values: input.old_values as never,
        new_values: input.new_values as never,
      },
    })
    return this.toIMutation(row)
  }

  async listMutations(filters: IMutationFilters): Promise<IListResult<IMutation>> {
    const where: Record<string, unknown> = {}
    if (filters.status) where["status"] = filters.status
    if (filters.table_name) where["table_name"] = filters.table_name
    if (filters.slug) where["slug"] = filters.slug
    if (filters.actor_id) where["actor_id"] = filters.actor_id

    const [count, rows] = await Promise.all([
      this.prisma.mutations.count({ where }),
      this.prisma.mutations.findMany({
        where,
        skip: filters.offset,
        take: filters.limit,
        orderBy: { created_at: "desc" },
      }),
    ])
    return { count, results: rows.map((r) => this.toIMutation(r)) }
  }

  async getMutation(id: number): Promise<IMutation | null> {
    const row = await this.prisma.mutations.findUnique({ where: { id } })
    return row ? this.toIMutation(row) : null
  }

  async countMutationsByUserSince(userId: string, sinceHours: number): Promise<number> {
    const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000)
    // Spec 029: a mutation counts toward a user's rate-limit bucket if
    // EITHER its author_id resolves to the user's users row OR (legacy /
    // chat-path) its actor_id joins to an api_keys row owned by that user.
    // OUTER JOINs cover pre-spec rows where author_id is NULL.
    const rows = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) AS count
      FROM mutations m
      LEFT JOIN users u ON u.id = m.author_id
      LEFT JOIN api_keys k ON k.id::text = m.actor_id
      WHERE m.created_at > ${since}
        AND (u.clerk_user_id = ${userId} OR k.user_id = ${userId})
    `
    const first = rows[0]
    return first ? Number(first.count) : 0
  }

  async reviewMutation(
    id: number,
    action: "approve" | "reject" | "revert",
    reviewerId: string,
    note?: string,
  ): Promise<IMutation | null> {
    const existing = await this.prisma.mutations.findUnique({ where: { id } })
    if (!existing) return null

    // Spec 029 optimistic flow. Writes go live at PATCH time, so the
    // moderator's approve action is a bookkeeping status flip. Reject
    // undoes the change by restoring old_values to the live row. Revert
    // keeps the same restore semantics for a previously approved row
    // (legacy shape; used from the moderator UI's "revert" button).
    if (action === "reject" || action === "revert") {
      const table = existing.table_name as IDomainTable
      const oldValues = existing.old_values as Record<string, unknown>
      await this.patchBySlug(table, existing.slug, oldValues as never)
    }

    const statusMap = { approve: "approved", reject: "rejected", revert: "reverted" } as const
    const row = await this.prisma.mutations.update({
      where: { id },
      data: {
        status: statusMap[action],
        reviewed_by: reviewerId,
        reviewed_at: new Date(),
        review_note: note ?? null,
      },
    })

    return this.toIMutation(row)
  }
}
