import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CAPACITIES, TokenBucket } from "./token-bucket.js"

describe("TokenBucket", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"))
  })

  it("allows 50 anon takes then rejects the 51st in a burst", () => {
    const bucket = new TokenBucket(DEFAULT_CAPACITIES, () => Date.now())
    let accepted = 0
    let rejected = 0
    for (let i = 0; i < 51; i++) {
      if (bucket.take("1.2.3.4", "anon")) accepted++
      else rejected++
    }
    expect(accepted).toBe(50)
    expect(rejected).toBe(1)
  })

  it("allows 500 keyed takes then rejects the 501st", () => {
    const bucket = new TokenBucket(DEFAULT_CAPACITIES, () => Date.now())
    let accepted = 0
    let rejected = 0
    for (let i = 0; i < 501; i++) {
      if (bucket.take("1.2.3.4", "keyed")) accepted++
      else rejected++
    }
    expect(accepted).toBe(500)
    expect(rejected).toBe(1)
  })

  it("refills fully after one second of wall time", () => {
    const bucket = new TokenBucket(DEFAULT_CAPACITIES, () => Date.now())
    for (let i = 0; i < 50; i++) bucket.take("1.2.3.4", "anon")
    expect(bucket.take("1.2.3.4", "anon")).toBe(false)
    vi.advanceTimersByTime(1000)
    for (let i = 0; i < 50; i++) {
      expect(bucket.take("1.2.3.4", "anon")).toBe(true)
    }
    expect(bucket.take("1.2.3.4", "anon")).toBe(false)
  })

  it("tracks different IPs independently", () => {
    const bucket = new TokenBucket(DEFAULT_CAPACITIES, () => Date.now())
    for (let i = 0; i < 50; i++) bucket.take("1.1.1.1", "anon")
    expect(bucket.take("1.1.1.1", "anon")).toBe(false)
    expect(bucket.take("2.2.2.2", "anon")).toBe(true)
  })

  it("tracks anon and keyed tiers independently for the same key", () => {
    const bucket = new TokenBucket(DEFAULT_CAPACITIES, () => Date.now())
    for (let i = 0; i < 50; i++) bucket.take("1.1.1.1", "anon")
    expect(bucket.take("1.1.1.1", "anon")).toBe(false)
    expect(bucket.take("1.1.1.1", "keyed")).toBe(true)
  })

  it("evicts entries idle longer than idleTtlMs on the next sweep", () => {
    const bucket = new TokenBucket(
      DEFAULT_CAPACITIES,
      () => Date.now(),
      { idleTtlMs: 10 * 60 * 1000, sweepIntervalMs: 60 * 1000 },
    )
    // Touch 3 keys at t=0, then a 4th at t=11min. The first three should be
    // evicted; the 4th survives.
    bucket.take("1.1.1.1", "anon")
    bucket.take("2.2.2.2", "anon")
    bucket.take("3.3.3.3", "anon")
    expect(bucket.size()).toBe(3)

    vi.advanceTimersByTime(11 * 60 * 1000)
    bucket.take("4.4.4.4", "anon") // triggers maybeSweep

    expect(bucket.size()).toBe(1)
  })

  it("does not evict entries that were recently active", () => {
    const bucket = new TokenBucket(
      DEFAULT_CAPACITIES,
      () => Date.now(),
      { idleTtlMs: 10 * 60 * 1000, sweepIntervalMs: 60 * 1000 },
    )
    bucket.take("active", "anon")
    // 5 minutes pass — still within TTL.
    vi.advanceTimersByTime(5 * 60 * 1000)
    bucket.take("active", "anon") // refresh lastRefill
    // Another 8 minutes — total 13 min, but `active` was touched 8 min ago.
    vi.advanceTimersByTime(8 * 60 * 1000)
    bucket.take("trigger-sweep", "anon")
    expect(bucket.size()).toBe(2)
  })

  it("amortizes sweep cost — does not sweep more than once per sweepIntervalMs", () => {
    const bucket = new TokenBucket(
      DEFAULT_CAPACITIES,
      () => Date.now(),
      { idleTtlMs: 10 * 60 * 1000, sweepIntervalMs: 60 * 1000 },
    )
    // Seed two stale entries (more than TTL old).
    bucket.take("stale-1", "anon")
    bucket.take("stale-2", "anon")
    vi.advanceTimersByTime(11 * 60 * 1000)

    // First take after the gap sweeps — both stale entries go.
    bucket.take("trigger", "anon")
    expect(bucket.size()).toBe(1)

    // Add another stale entry by jumping the clock back is not possible —
    // instead, take more entries and confirm no extra sweep happens within
    // the next sweepIntervalMs. We rely on the sweep counter via spy.
    const spy = vi.spyOn(bucket, "sweep")
    vi.advanceTimersByTime(30 * 1000) // half a sweep interval
    bucket.take("trigger", "anon")
    bucket.take("trigger", "anon")
    expect(spy).not.toHaveBeenCalled()

    // Cross the interval — next take sweeps once.
    vi.advanceTimersByTime(31 * 1000)
    bucket.take("trigger", "anon")
    expect(spy).toHaveBeenCalledTimes(1)
  })
})
