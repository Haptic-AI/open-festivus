import { describe, expect, it } from "vitest"
import {
  computeCompatibility,
  normalizeSuccessRate,
  COMPAT_GREEN,
  COMPAT_AMBER,
  COMPAT_RED,
} from "../../apps/web/src/lib/workbench/compatibility"

describe("computeCompatibility", () => {
  const alohaPolicy = {
    compatible_robot_slugs: ["aloha-2"],
    benchmarks: [{ robot: "ALOHA 2", success_rate: 0.96, episodes: 500 }],
  }

  const octoBase = {
    compatible_robot_slugs: ["franka-panda", "aloha-2"],
    benchmarks: [
      { robot: "Franka Panda", success_rate: 0.63, episodes: 200 },
    ],
  }

  const octoSmall = {
    compatible_robot_slugs: ["franka-panda", "so-100", "koch-v11", "so-arm101"],
    benchmarks: [{ robot: "WidowX", success_rate: 0.68, episodes: 100 }],
  }

  it("returns green for >75% match", () => {
    const result = computeCompatibility(alohaPolicy, "aloha-2", "ALOHA 2")
    expect(result.score).toBe(96)
    expect(result.color).toBe(COMPAT_GREEN)
    expect(result.label).toBe("96%")
    expect(result.explanation).toContain("Best match")
  })

  it("returns amber for 40-75% match", () => {
    const result = computeCompatibility(octoBase, "franka-panda", "Franka Panda")
    expect(result.score).toBe(63)
    expect(result.color).toBe(COMPAT_AMBER)
    expect(result.explanation).toContain("fine-tuning")
  })

  it("returns red/N/A for incompatible robot", () => {
    const result = computeCompatibility(alohaPolicy, "so-100", "SO-100")
    expect(result.score).toBe(0)
    expect(result.color).toBe(COMPAT_RED)
    expect(result.label).toBe("N/A")
    expect(result.explanation).toContain("Not built for SO-100")
  })

  it("returns amber/Untested for compatible but no benchmark", () => {
    const result = computeCompatibility(octoSmall, "so-100", "SO-100")
    expect(result.score).toBeNull()
    expect(result.color).toBe(COMPAT_AMBER)
    expect(result.label).toBe("Untested")
    expect(result.explanation).toContain("no benchmark")
  })

  it("handles empty benchmarks array", () => {
    const policy = { compatible_robot_slugs: ["so-100"], benchmarks: [] }
    const result = computeCompatibility(policy, "so-100", "SO-100")
    expect(result.score).toBeNull()
    expect(result.label).toBe("Untested")
  })

  it("handles missing fields gracefully", () => {
    const result = computeCompatibility({}, "so-100", "SO-100")
    expect(result.score).toBe(0)
    expect(result.label).toBe("N/A")
  })

  it("returns red for very low success rate (<40%)", () => {
    const policy = {
      compatible_robot_slugs: ["so-100"],
      benchmarks: [{ robot: "SO-100", success_rate: 0.15, episodes: 50 }],
    }
    const result = computeCompatibility(policy, "so-100", "SO-100")
    expect(result.score).toBe(15)
    expect(result.color).toBe(COMPAT_RED)
    expect(result.explanation).toContain("Low success")
  })

  it("handles boundary value 75% as amber (not green)", () => {
    const policy = {
      compatible_robot_slugs: ["so-100"],
      benchmarks: [{ robot: "SO-100", success_rate: 0.75, episodes: 100 }],
    }
    const result = computeCompatibility(policy, "so-100", "SO-100")
    expect(result.score).toBe(75)
    expect(result.color).toBe(COMPAT_AMBER)
  })

  it("handles boundary value 76% as green", () => {
    const policy = {
      compatible_robot_slugs: ["so-100"],
      benchmarks: [{ robot: "SO-100", success_rate: 0.76, episodes: 100 }],
    }
    const result = computeCompatibility(policy, "so-100", "SO-100")
    expect(result.score).toBe(76)
    expect(result.color).toBe(COMPAT_GREEN)
  })

  it("handles boundary value 40% as amber", () => {
    const policy = {
      compatible_robot_slugs: ["so-100"],
      benchmarks: [{ robot: "SO-100", success_rate: 0.40, episodes: 100 }],
    }
    const result = computeCompatibility(policy, "so-100", "SO-100")
    expect(result.score).toBe(40)
    expect(result.color).toBe(COMPAT_AMBER)
  })

  it("handles boundary value 39% as red", () => {
    const policy = {
      compatible_robot_slugs: ["so-100"],
      benchmarks: [{ robot: "SO-100", success_rate: 0.39, episodes: 100 }],
    }
    const result = computeCompatibility(policy, "so-100", "SO-100")
    expect(result.score).toBe(39)
    expect(result.color).toBe(COMPAT_RED)
  })

  it("handles null success_rate in benchmark", () => {
    const policy = {
      compatible_robot_slugs: ["so-100"],
      benchmarks: [{ robot: "SO-100", success_rate: null, episodes: 100 }],
    }
    const result = computeCompatibility(policy, "so-100", "SO-100")
    expect(result.score).toBeNull()
    expect(result.label).toBe("Untested")
  })

  it("handles 100% success rate", () => {
    const policy = {
      compatible_robot_slugs: ["aloha-2"],
      benchmarks: [{ robot: "ALOHA 2", success_rate: 1.0, episodes: 500 }],
    }
    const result = computeCompatibility(policy, "aloha-2", "ALOHA 2")
    expect(result.score).toBe(100)
    expect(result.color).toBe(COMPAT_GREEN)
    expect(result.label).toBe("100%")
  })

  it("handles 0% success rate for compatible robot", () => {
    const policy = {
      compatible_robot_slugs: ["so-100"],
      benchmarks: [{ robot: "SO-100", success_rate: 0.0, episodes: 10 }],
    }
    const result = computeCompatibility(policy, "so-100", "SO-100")
    expect(result.score).toBe(0)
    expect(result.color).toBe(COMPAT_RED)
  })

  it("fuzzy matches robot names with special characters", () => {
    const policy = {
      compatible_robot_slugs: ["koch-v11"],
      benchmarks: [{ robot: "Koch v1.1", success_rate: 0.80, episodes: 100 }],
    }
    const result = computeCompatibility(policy, "koch-v11", "Koch v1.1")
    expect(result.score).toBe(80)
    expect(result.color).toBe(COMPAT_GREEN)
  })

  it("matches when benchmark robot name is substring of query", () => {
    const policy = {
      compatible_robot_slugs: ["franka-panda"],
      benchmarks: [{ robot: "Franka", success_rate: 0.70, episodes: 100 }],
    }
    const result = computeCompatibility(policy, "franka-panda", "Franka Emika Panda")
    expect(result.score).toBe(70)
  })
})

describe("normalizeSuccessRate", () => {
  it("converts decimal 0.82 to 82", () => {
    expect(normalizeSuccessRate(0.82)).toBe(82)
  })

  it("converts decimal 0.96 to 96", () => {
    expect(normalizeSuccessRate(0.96)).toBe(96)
  })

  it("keeps whole number 82 as 82", () => {
    expect(normalizeSuccessRate(82)).toBe(82)
  })

  it("converts 1.0 to 100 (edge case)", () => {
    expect(normalizeSuccessRate(1.0)).toBe(100)
  })

  it("converts 0.008 to 1 (very low rate)", () => {
    expect(normalizeSuccessRate(0.008)).toBe(1)
  })

  it("rounds correctly", () => {
    expect(normalizeSuccessRate(0.955)).toBe(96)
    expect(normalizeSuccessRate(0.954)).toBe(95)
  })

  it("handles 0", () => {
    expect(normalizeSuccessRate(0)).toBe(0)
  })

  it("handles 100 as already a percentage", () => {
    expect(normalizeSuccessRate(100)).toBe(100)
  })

  it("handles values just above 1 as percentages", () => {
    expect(normalizeSuccessRate(1.5)).toBe(2)
    expect(normalizeSuccessRate(50)).toBe(50)
  })

  it("handles very small decimals", () => {
    expect(normalizeSuccessRate(0.001)).toBe(0)
  })
})
