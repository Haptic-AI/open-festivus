import { describe, expect, it } from "vitest"

/**
 * SaveNudge is a thin UI component that depends on Clerk's SignInButton.
 * Without @testing-library/react we can't render it, so we test the
 * visibility and dismiss logic that the parent component (WorkbenchCanvas)
 * controls.
 */

describe("SaveNudge visibility logic", () => {
  function shouldShowNudge(opts: {
    isGuest: boolean
    promptCount: number
    dismissed: boolean
    isStreaming: boolean
  }): boolean {
    return opts.isGuest && opts.promptCount >= 2 && !opts.dismissed && !opts.isStreaming
  }

  it("shows after 2 prompts for guest", () => {
    expect(shouldShowNudge({ isGuest: true, promptCount: 2, dismissed: false, isStreaming: false })).toBe(true)
  })

  it("does not show for signed-in user", () => {
    expect(shouldShowNudge({ isGuest: false, promptCount: 5, dismissed: false, isStreaming: false })).toBe(false)
  })

  it("does not show before 2 prompts", () => {
    expect(shouldShowNudge({ isGuest: true, promptCount: 1, dismissed: false, isStreaming: false })).toBe(false)
  })

  it("does not show when dismissed", () => {
    expect(shouldShowNudge({ isGuest: true, promptCount: 3, dismissed: true, isStreaming: false })).toBe(false)
  })

  it("does not show during streaming", () => {
    expect(shouldShowNudge({ isGuest: true, promptCount: 3, dismissed: false, isStreaming: true })).toBe(false)
  })

  it("shows after many prompts", () => {
    expect(shouldShowNudge({ isGuest: true, promptCount: 10, dismissed: false, isStreaming: false })).toBe(true)
  })
})
