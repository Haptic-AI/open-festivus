/**
 * Spec 017 Phase 4.3: enrichment idempotency + honesty unit tests.
 *
 * Validates the pure-logic helpers that gate the LLM output before it
 * touches the DB. No network, no DB, no real LLM call — these assertions
 * must pass offline.
 *
 *   1. hashMarkdown is deterministic (idempotency foundation)
 *   2. applyConfidenceThreshold nulls out below-0.7 values (honesty gate)
 *   3. applyConfidenceThreshold is itself idempotent — applying twice
 *      yields byte-identical output (serialized), proving the threshold
 *      logic has no hidden state
 */

import { describe, expect, it } from "vitest"
import { applyConfidenceThreshold, hashMarkdown, type IExtraction } from "./enrich-robots.js"

const sampleExtraction = (): IExtraction => ({
  dof: { value: 56, confidence: 0.95 },
  weight_kg: { value: 80, confidence: 0.4 },
  price_usd: { value: null, confidence: 0 },
  price_availability: { value: "not_public", confidence: 0.92 },
  description_sentence: { value: "An electric humanoid from Boston Dynamics.", confidence: 0.88 },
  description_paragraph: { value: "Atlas is a research humanoid robot.", confidence: 0.3 },
  sensors: { value: ["stereo camera", "IMU"], confidence: 0.75 },
  actuators: { value: "Electric brushless joint motors", confidence: 0.68 },
})

describe("hashMarkdown", () => {
  it("is deterministic for the same input", () => {
    const a = hashMarkdown("# Atlas\n\n**DoF** 56\n")
    const b = hashMarkdown("# Atlas\n\n**DoF** 56\n")
    expect(a).toBe(b)
  })

  it("changes when the input changes", () => {
    const a = hashMarkdown("# Atlas")
    const b = hashMarkdown("# Spot")
    expect(a).not.toBe(b)
  })
})

describe("applyConfidenceThreshold", () => {
  it("keeps high-confidence values intact", () => {
    const out = applyConfidenceThreshold(sampleExtraction())
    expect(out.dof).toEqual({ value: 56, confidence: 0.95 })
    expect(out.price_availability).toEqual({ value: "not_public", confidence: 0.92 })
    expect(out.description_sentence.value).toBe("An electric humanoid from Boston Dynamics.")
  })

  it("nulls out values with confidence < 0.7", () => {
    const out = applyConfidenceThreshold(sampleExtraction())
    expect(out.weight_kg.value).toBeNull()
    expect(out.weight_kg.confidence).toBe(0.4)
    expect(out.description_paragraph.value).toBeNull()
    expect(out.actuators.value).toBeNull()
    expect(out.actuators.confidence).toBe(0.68)
  })

  it("falls back to 'unknown' for low-confidence price_availability", () => {
    const raw = sampleExtraction()
    raw.price_availability = { value: "public", confidence: 0.5 }
    const out = applyConfidenceThreshold(raw)
    expect(out.price_availability.value).toBe("unknown")
  })

  it("is itself idempotent — applying twice yields byte-identical output", () => {
    const raw = sampleExtraction()
    const a = applyConfidenceThreshold(raw)
    const b = applyConfidenceThreshold(raw)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    const c = applyConfidenceThreshold(a)
    expect(JSON.stringify(c)).toBe(JSON.stringify(a))
  })
})
