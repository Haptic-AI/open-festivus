export type Tier = "anon" | "keyed"

export interface ITokenBucketCapacities {
  anon: number
  keyed: number
}

export const DEFAULT_CAPACITIES: ITokenBucketCapacities = {
  anon: 50,
  keyed: 500,
}

// How long a bucket entry can sit untouched before it's evicted. Once the
// last `take()` for a key was longer than this ago, the bucket has fully
// refilled (capacity refills in 1s) so dropping it loses no information —
// the next request from that key just allocates a fresh entry. Default 10
// minutes is generous; the only cost of going lower is a few extra allocs.
const DEFAULT_IDLE_TTL_MS = 10 * 60 * 1000

// Don't sweep on every take — for a hot bucket that's wasteful. Once a
// minute is plenty: even at 1k req/s a sweep is amortized to O(1) per take.
const DEFAULT_SWEEP_INTERVAL_MS = 60 * 1000

interface IBucketState {
  tokens: number
  lastRefill: number
}

export interface ITokenBucketOptions {
  idleTtlMs?: number
  sweepIntervalMs?: number
}

export class TokenBucket {
  private readonly buckets = new Map<string, IBucketState>()
  private readonly capacities: ITokenBucketCapacities
  private readonly now: () => number
  private readonly idleTtlMs: number
  private readonly sweepIntervalMs: number
  private lastSweep = 0

  constructor(
    capacities: ITokenBucketCapacities = DEFAULT_CAPACITIES,
    now: () => number = Date.now,
    options: ITokenBucketOptions = {},
  ) {
    this.capacities = capacities
    this.now = now
    this.idleTtlMs = options.idleTtlMs ?? DEFAULT_IDLE_TTL_MS
    this.sweepIntervalMs = options.sweepIntervalMs ?? DEFAULT_SWEEP_INTERVAL_MS
  }

  take(key: string, tier: "anon" | "keyed"): boolean {
    const nowMs = this.now()
    this.maybeSweep(nowMs)

    const capacity = tier === "anon" ? this.capacities.anon : this.capacities.keyed
    const bucketKey = `${tier}:${key}`
    const state = this.buckets.get(bucketKey) ?? { tokens: capacity, lastRefill: nowMs }

    const elapsedSec = (nowMs - state.lastRefill) / 1000
    if (elapsedSec > 0) {
      const refillTokens = elapsedSec * capacity
      state.tokens = Math.min(capacity, state.tokens + refillTokens)
      state.lastRefill = nowMs
    }

    if (state.tokens >= 1) {
      state.tokens -= 1
      this.buckets.set(bucketKey, state)
      return true
    }

    this.buckets.set(bucketKey, state)
    return false
  }

  size(): number {
    return this.buckets.size
  }

  // Drop entries that haven't been touched within `idleTtlMs`. Public so
  // tests can force a sweep without waiting; production calls it via
  // `maybeSweep` inside `take`.
  sweep(nowMs: number = this.now()): number {
    const cutoff = nowMs - this.idleTtlMs
    let evicted = 0
    for (const [key, state] of this.buckets) {
      if (state.lastRefill < cutoff) {
        this.buckets.delete(key)
        evicted++
      }
    }
    this.lastSweep = nowMs
    return evicted
  }

  private maybeSweep(nowMs: number): void {
    if (nowMs - this.lastSweep < this.sweepIntervalMs) return
    this.sweep(nowMs)
  }
}
