import { describe, expect, it } from "vitest"
import {
  buildMintKeyHref,
  isSafeReturnPath,
  resolveReturnPath,
} from "./return-path-view"

describe("isSafeReturnPath", () => {
  it("accepts a plain same-origin path", () => {
    expect(isSafeReturnPath("/data/robots/optimus-gen-2")).toBe(true)
  })

  it("accepts a path with query string", () => {
    expect(isSafeReturnPath("/explore?tab=robots&category=humanoid")).toBe(true)
  })

  it("accepts the root path", () => {
    expect(isSafeReturnPath("/")).toBe(true)
  })

  it("rejects empty string", () => {
    expect(isSafeReturnPath("")).toBe(false)
  })

  it("rejects undefined / null / non-string", () => {
    expect(isSafeReturnPath(undefined)).toBe(false)
    expect(isSafeReturnPath(null)).toBe(false)
    expect(isSafeReturnPath(123)).toBe(false)
    expect(isSafeReturnPath({})).toBe(false)
  })

  it("rejects protocol-relative URL injection (//evil.com)", () => {
    expect(isSafeReturnPath("//evil.com")).toBe(false)
    expect(isSafeReturnPath("//evil.com/data/robots/x")).toBe(false)
  })

  it("rejects backslash-prefixed protocol-relative URL", () => {
    // Some browsers normalize \\ to // before navigation.
    expect(isSafeReturnPath("/\\evil.com")).toBe(false)
  })

  it("rejects absolute URL", () => {
    expect(isSafeReturnPath("https://evil.com/data")).toBe(false)
    expect(isSafeReturnPath("http://festivus.hapticlabs.ai/data")).toBe(false)
  })

  it("rejects javascript: scheme", () => {
    expect(isSafeReturnPath("javascript:alert(1)")).toBe(false)
  })

  it("rejects data URI", () => {
    expect(isSafeReturnPath("data:text/html,<script>")).toBe(false)
  })

  it("rejects relative paths (no leading /)", () => {
    expect(isSafeReturnPath("data/robots/x")).toBe(false)
    expect(isSafeReturnPath("../etc/passwd")).toBe(false)
  })

  it("rejects newline / control char smuggling", () => {
    expect(isSafeReturnPath("/data\nSet-Cookie: evil=1")).toBe(false)
    expect(isSafeReturnPath("/data\rfoo")).toBe(false)
  })
})

describe("resolveReturnPath", () => {
  it("returns the value if safe", () => {
    expect(resolveReturnPath("/data/robots/optimus-gen-2")).toBe(
      "/data/robots/optimus-gen-2",
    )
  })

  it("returns root for null / undefined / unsafe inputs", () => {
    expect(resolveReturnPath(null)).toBe("/")
    expect(resolveReturnPath(undefined)).toBe("/")
    expect(resolveReturnPath("")).toBe("/")
    expect(resolveReturnPath("//evil.com")).toBe("/")
    expect(resolveReturnPath("javascript:alert(1)")).toBe("/")
    expect(resolveReturnPath("https://evil.com/data")).toBe("/")
  })
})

describe("buildMintKeyHref", () => {
  it("appends a URL-encoded return_to when the current path is safe", () => {
    expect(buildMintKeyHref("/data/robots/optimus-gen-2")).toBe(
      "/settings/api-keys?source=agent&return_to=%2Fdata%2Frobots%2Foptimus-gen-2",
    )
  })

  it("encodes query strings inside the path", () => {
    expect(buildMintKeyHref("/explore?tab=robots&category=humanoid")).toBe(
      "/settings/api-keys?source=agent&return_to=%2Fexplore%3Ftab%3Drobots%26category%3Dhumanoid",
    )
  })

  it("falls back to no return_to when input is empty / null / undefined", () => {
    const base = "/settings/api-keys?source=agent"
    expect(buildMintKeyHref(null)).toBe(base)
    expect(buildMintKeyHref(undefined)).toBe(base)
    expect(buildMintKeyHref("")).toBe(base)
  })

  it("falls back to no return_to when input is unsafe (open-redirect attempt)", () => {
    const base = "/settings/api-keys?source=agent"
    expect(buildMintKeyHref("//evil.com")).toBe(base)
    expect(buildMintKeyHref("javascript:alert(1)")).toBe(base)
    expect(buildMintKeyHref("https://evil.com/x")).toBe(base)
    expect(buildMintKeyHref("/data\n")).toBe(base)
  })
})
