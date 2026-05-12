import pg from "pg"

/**
 * Common query interface for callers that only need `.query()`. `pg.Pool`
 * satisfies it natively; tests can swap in a mock without pulling the full
 * pg surface.
 */
export interface IPool {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>
}

let _pool: pg.Pool | null = null

/**
 * Returns the process-wide `pg.Pool` typed as the lean `IPool` interface.
 * Paths that need `.connect()` for transactional blocks should call
 * `getPgPool()` instead — same underlying instance, fuller type.
 *
 * The Neon HTTP driver branch (FESTIVUS_DRIVER=neon) was removed in spec
 * 022's cutover to self-hosted Supabase. The repo now only talks to a real
 * Postgres via TCP, both locally (Supabase Docker on :54322) and in prod
 * (self-hosted Supabase on EC2).
 */
export function getPool(): IPool {
  if (_pool) return _pool
  const connectionString = process.env["POSTGRES_URL"]
  if (!connectionString) {
    throw new Error("POSTGRES_URL is not set — required for any live-DB code path")
  }
  // AWS RDS rejects non-encrypted connections. The `pg` driver does NOT
  // auto-set SSL from `sslmode=require` in the URL — it has to be passed
  // explicitly. Enable when the hostname looks like an AWS RDS endpoint
  // (amazonaws.com) or the URL includes `sslmode=require`. Use
  // `rejectUnauthorized: false` because the RDS CA isn't in Node's default
  // trust store; transport is still encrypted.
  const needsSsl =
    connectionString.includes("amazonaws.com") ||
    /sslmode=require/i.test(connectionString)
  _pool = new pg.Pool({
    connectionString,
    ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  })
  return _pool
}

/**
 * Same instance as `getPool()`, typed as `pg.Pool` so callers can reach
 * `.connect()` for transactional blocks (currently: `src/db/seed.ts`).
 */
export function getPgPool(): pg.Pool {
  if (_pool) return _pool
  getPool()
  if (!_pool) {
    throw new Error("getPgPool(): failed to initialise pg.Pool")
  }
  return _pool
}

export async function closePool(): Promise<void> {
  if (_pool) {
    await _pool.end()
    _pool = null
  }
}
